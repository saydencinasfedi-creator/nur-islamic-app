
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageId, PrayerName, PrayerTimes } from '../types';
import { useUser } from '../contexts/UserContext';
import { fetchPrayerTimes } from '../services/prayerService';
import { TranslationKey } from '../services/i18n';

interface SalatProps {
    navigate: (page: PageId) => void;
    onBack: () => void;
    onComplete: () => void;
}

const PRAYER_DEFS: { name: PrayerName; icon: string }[] = [
    { name: 'Fajr', icon: 'wb_twilight' },
    { name: 'Dhuhr', icon: 'light_mode' },
    { name: 'Asr', icon: 'wb_sunny' },
    { name: 'Maghrib', icon: 'wb_twilight' },
    { name: 'Isha', icon: 'dark_mode' },
];

// 3 days back stay checkable (in case a prayer was forgotten); 7 days ahead are viewable
// (times only — you can't mark a prayer that hasn't happened yet).
const DAY_OFFSETS = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];

const dateAtOffset = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
};

const dayLabel = (offset: number, t: (key: TranslationKey) => string) => {
    if (offset === 0) return t('salat.today');
    if (offset === -1) return t('salat.yesterday');
    if (offset === 1) return t('salat.tomorrow');
    return dateAtOffset(offset).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
};

const Salat: React.FC<SalatProps> = ({ navigate, onBack, onComplete }) => {
    const { prayerTimes, location, prayerCompletionMap, togglePrayerCompletion, t } = useUser();
    const [timeLeft, setTimeLeft] = useState({ hrs: 0, min: 0, sec: 0 });
    const [dateOffset, setDateOffset] = useState(0);
    const [otherDayTimes, setOtherDayTimes] = useState<PrayerTimes | null>(null);
    const [loadingOther, setLoadingOther] = useState(false);
    const todayPillRef = useRef<HTMLButtonElement | null>(null);

    // Center "Today" in the day-selector row on open, instead of leaving it wherever the
    // scroll happens to start (buried among the 3-days-back pills to its left).
    useEffect(() => {
        todayPillRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }, []);

    const isToday = dateOffset === 0;
    const isFuture = dateOffset > 0;
    const selectedDateStr = useMemo(() => dateAtOffset(dateOffset).toDateString(), [dateOffset]);
    const displayedTimes = isToday ? prayerTimes : otherDayTimes;
    const dayCompletion = prayerCompletionMap[selectedDateStr];

    // Fetch prayer times for any day other than today when it's selected.
    useEffect(() => {
        if (isToday) { setOtherDayTimes(null); return; }
        if (!location) return;
        let cancelled = false;
        setLoadingOther(true);
        fetchPrayerTimes(location.latitude, location.longitude, dateAtOffset(dateOffset)).then(times => {
            if (!cancelled) {
                setOtherDayTimes(times);
                setLoadingOther(false);
            }
        });
        return () => { cancelled = true; };
    }, [dateOffset, isToday, location]);

    // Determine next prayer index and calculate time difference (today only)
    const { nextIndex, timeDiff } = useMemo(() => {
        if (!prayerTimes) return { nextIndex: -1, timeDiff: 0 };

        const now = new Date();
        const times = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        for (let i = 0; i < times.length; i++) {
            // Safe check for property existence
            const timeStr = (prayerTimes as any)[times[i]];
            if (!timeStr) continue;

            const [hours, minutes] = timeStr.split(':').map(Number);
            const prayerDate = new Date(now);
            prayerDate.setHours(hours, minutes, 0, 0);

            if (prayerDate > now) {
                return { nextIndex: i, timeDiff: prayerDate.getTime() - now.getTime() };
            }
        }

        // If no next prayer found today, it's Fajr tomorrow
        const fajrTime = prayerTimes.Fajr;
        if (fajrTime) {
            const [fHours, fMinutes] = fajrTime.split(':').map(Number);
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            tomorrow.setHours(fHours, fMinutes, 0, 0);
            return { nextIndex: 0, timeDiff: tomorrow.getTime() - now.getTime() };
        }

        return { nextIndex: -1, timeDiff: 0 };
    }, [prayerTimes]); // Re-run when prayerTimes changes

    // Update countdown (today only)
    useEffect(() => {
        if (!isToday || timeDiff <= 0) return;

        // Set initial from calculated diff
        let remaining = timeDiff;

        const update = () => {
            const hrs = Math.floor(remaining / (1000 * 60 * 60));
            const min = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const sec = Math.floor((remaining % (1000 * 60)) / 1000);
            setTimeLeft({ hrs, min, sec });
            remaining -= 1000;
        };

        update(); // Run immediately
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [timeDiff, isToday]);

    const format = (n: number) => n.toString().padStart(2, '0');

    const prayers = displayedTimes ? PRAYER_DEFS.map((p, i) => {
        const time = (displayedTimes as any)[p.name] as string;

        if (isFuture) {
            // Future day: times only, nothing to check off yet.
            return { ...p, time, active: false, completed: false, missed: false, locked: true, readOnly: true };
        }

        const completed = dayCompletion?.[p.name] ?? false;

        if (!isToday) {
            // Past day: every prayer's time has already passed, no "active"/"locked" concept.
            return { ...p, time, active: false, completed, missed: !completed, locked: false, readOnly: false };
        }

        // nextIndex === 0 late at night means "next up" is tomorrow's Fajr — today's own
        // 5 prayer times have all already passed, even though i < nextIndex can't show that.
        const isNightWrap = nextIndex === 0 && new Date().getHours() > 20;
        const timePassed = isNightWrap ? true : (nextIndex === -1 ? true : i < nextIndex);
        return {
            ...p,
            time,
            active: isNightWrap ? i === 0 : i === nextIndex,
            completed,
            missed: timePassed && !completed,
            // A prayer whose time hasn't arrived yet can't be checked off, even the
            // upcoming "Next Prayer" itself — only prayers whose time has actually passed.
            locked: !timePassed,
            readOnly: false,
        };
    }) : [];

    // Once every prayer for TODAY has been checked off, complete the day's Salat goal.
    useEffect(() => {
        if (isToday && prayers.length > 0 && prayers.every(p => p.completed)) {
            onComplete();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prayerCompletionMap, isToday]);

    const currentNextPrayer = prayers[nextIndex] || prayers[0];

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200">
            <header className="flex items-center justify-between p-6 pt-8 pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('salat.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">
                        {location ? `${location.city}, ${location.country}` : t('salat.locating')}
                    </p>
                </div>
                <button onClick={onBack} className="relative flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white shadow-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/5">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back_ios_new</span>
                </button>
            </header>

            <div className="flex gap-2 px-6 pb-2 overflow-x-auto no-scrollbar">
                {DAY_OFFSETS.map(offset => (
                    <button
                        key={offset}
                        ref={offset === 0 ? todayPillRef : undefined}
                        onClick={() => setDateOffset(offset)}
                        className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 shadow-sm cursor-pointer transition-all active:scale-95 ${dateOffset === offset ? 'bg-primary text-white shadow-glow ring-2 ring-primary/20' : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                    >
                        <p className="text-sm font-bold whitespace-nowrap">{dayLabel(offset, t)}</p>
                    </button>
                ))}
            </div>

            <div className="px-6 py-2 mb-4">
                <div className="relative w-full rounded-3xl overflow-hidden shadow-glow bg-white dark:bg-[#1A2E25] border border-gray-100 dark:border-white/5 p-6 flex flex-col items-center justify-center text-center">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -ml-10 -mb-10"></div>
                    {isToday ? (
                        <>
                            <span className="inline-flex items-center gap-1 text-primary text-xs font-bold tracking-wider uppercase mb-3 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-slate-900 dark:text-white">{t('salat.nextPrayer')}</span>
                            </span>
                            <h2 className="text-5xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{currentNextPrayer?.name || t('salat.loading')}</h2>
                            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-8 flex items-center gap-1 opacity-80">
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                {t('salat.beginsAt', { time: currentNextPrayer?.time || '--:--' })}
                            </div>

                            <div className="w-full flex items-center justify-center gap-6 mb-2">
                                <div className="flex flex-col items-center">
                                    <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white">{format(timeLeft.hrs)}</span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{t('salat.hrs')}</span>
                                </div>
                                <span className="text-2xl font-bold text-slate-300 dark:text-white/20 -mt-5">:</span>
                                <div className="flex flex-col items-center">
                                    <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white">{format(timeLeft.min)}</span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{t('salat.min')}</span>
                                </div>
                                <span className="text-2xl font-bold text-slate-300 dark:text-white/20 -mt-5">:</span>
                                <div className="flex flex-col items-center">
                                    <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white">{format(timeLeft.sec)}</span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{t('salat.sec')}</span>
                                </div>
                            </div>
                        </>
                    ) : isFuture ? (
                        <>
                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 text-xs font-bold tracking-wider uppercase mb-3 bg-gray-100 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10">
                                {t('salat.viewingUpcomingDay')}
                            </span>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{dayLabel(dateOffset, t)}</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                {loadingOther ? t('salat.loadingTimes') : t('salat.timesForThisDay')}
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 text-xs font-bold tracking-wider uppercase mb-3 bg-gray-100 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10">
                                {t('salat.viewingPastDay')}
                            </span>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{dayLabel(dateOffset, t)}</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                {loadingOther ? t('salat.loadingTimes') : t('salat.tapToMarkDone')}
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="px-6 flex flex-col gap-3">
                {prayers.map((p, i) => (
                    <React.Fragment key={p.name}>
                        <div
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p.active ? 'bg-white dark:bg-[#1A2E25] border-primary/40 shadow-glow overflow-hidden relative' : p.missed ? 'bg-amber-500/5 border-amber-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5'} ${p.locked && !p.active ? 'opacity-40' : ''}`}
                        >
                            {p.active && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-l-full"></div>}
                            <div className={`flex items-center gap-4 ${p.active ? 'relative z-10' : p.completed ? 'opacity-80' : ''}`}>
                                <div className={`size-10 rounded-full flex items-center justify-center ${p.active ? 'bg-primary/20 text-primary' : p.missed ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}>
                                    <span className={`material-symbols-outlined text-[20px] ${p.active ? 'filled' : ''}`}>{p.icon}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className={`font-semibold ${p.active ? 'text-xl font-bold' : 'text-lg'} text-slate-900 dark:text-white`}>{p.name}</span>
                                    <span className={`text-sm ${p.active ? 'text-primary font-medium' : p.missed ? 'text-amber-600 dark:text-amber-400/80' : 'text-gray-500 dark:text-gray-400'}`}>{p.time}{p.missed ? ` · ${t('salat.notChecked')}` : ''}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => togglePrayerCompletion(selectedDateStr, p.name)}
                                disabled={p.locked || p.readOnly}
                                className={`size-8 rounded-full flex items-center justify-center transition-all ${p.completed ? 'bg-primary border border-primary text-background-dark hover:brightness-110 active:scale-90' : (p.locked || p.readOnly) ? 'border-2 border-gray-200 dark:border-white/5 bg-transparent cursor-not-allowed' : 'border-2 border-gray-300 dark:border-white/10 bg-transparent hover:border-primary/50 active:scale-90'}`}
                            >
                                {p.completed && <span className="material-symbols-outlined text-lg font-bold text-white">check</span>}
                            </button>
                        </div>

                        {/* Sunrise: shown right after Fajr, purely informational — it's Sunnah, not
                            Fard, so unlike the 5 real prayers above it never gets a checkbox and
                            never touches prayerCompletionMap/streak (those are typed strictly to
                            PrayerName, which Sunrise deliberately isn't part of). */}
                        {i === 0 && displayedTimes?.Sunrise && (
                            <div className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 opacity-70">
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                                        <span className="material-symbols-outlined text-[20px]">wb_twilight</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-lg text-slate-900 dark:text-white">{t('salat.sunrise')}</span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">{displayedTimes.Sunrise}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="px-6 mt-8 mb-4 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('salat.timesSource')}</p>
            </div>
        </div>
    );
};

export default Salat;
