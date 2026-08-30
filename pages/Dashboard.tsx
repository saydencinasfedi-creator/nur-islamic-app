
import React, { useState, useEffect } from 'react';
import { PageId, User, PrayerTimes, Dhikr, Goal } from '../types';
import ProgressRing from '../components/ProgressRing';
import GoalIcon from '../components/GoalIcon';
import Avatar from '../components/Avatar';
import { useUser } from '../contexts/UserContext';
import { Share } from '@capacitor/share';
import AdhanSettings from './AdhanSettings';
import { formatHijriDate } from '../services/hijriDate';
import { VERSES, VerseRef } from '../data/dashboardContent';
import { versesEn } from '../locales/content-en/verses';
import { versesEs } from '../locales/content-es/verses';

interface DashboardProps {
    navigate: (page: PageId) => void;
    user: User | null; // Keep for prop compatibility, but use context
}

const Dashboard: React.FC<DashboardProps> = ({ navigate }) => {
    const { user, prayerTimes: currentPrayerTimes, location, goals, toggleBooleanGoal, setGoalAmount, unreadNotificationCount, language, t } = useUser();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; remaining: string } | null>(null);
    const [isAdhanSheetOpen, setIsAdhanSheetOpen] = useState(false);
    const [amountGoal, setAmountGoal] = useState<Goal | null>(null);
    const [amountInput, setAmountInput] = useState('');

    const saveAmount = () => {
        if (!amountGoal) return;
        setGoalAmount(amountGoal.id, parseInt(amountInput, 10) || 0);
        setAmountGoal(null);
    };

    // Verse of the Day State
    const [verseOfDay, setVerseOfDay] = useState(VERSES[0]);
    // Languages without their own content-{lang}/verses.ts yet fall back to English, same
    // fallback philosophy as the UI-chrome t() engine (services/i18n.ts).
    const verseText = (language === 'es' ? versesEs : versesEn)[verseOfDay.id] ?? versesEn[verseOfDay.id];

    // Initialize Verse of the Day Logic (Shuffle with persistence)
    useEffect(() => {
        const todayStr = new Date().toDateString();
        const savedDate = localStorage.getItem('verseDate');
        const savedVerseIndex = localStorage.getItem('verseIndex');
        let verseHistory = JSON.parse(localStorage.getItem('verseHistory') || '[]');

        if (savedDate === todayStr && savedVerseIndex) {
            setVerseOfDay(VERSES[parseInt(savedVerseIndex)] || VERSES[0]);
        } else {
            // Pick a new verse not in history
            let availableIndices = VERSES.map((_, i) => i).filter(i => !verseHistory.includes(i));

            if (availableIndices.length === 0) {
                // Reset history if all seen
                verseHistory = [];
                availableIndices = VERSES.map((_, i) => i);
            }

            const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

            // Save
            localStorage.setItem('verseDate', todayStr);
            localStorage.setItem('verseIndex', randomIndex.toString());
            localStorage.setItem('verseHistory', JSON.stringify([...verseHistory, randomIndex]));

            setVerseOfDay(VERSES[randomIndex]);
        }
    }, []);

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Date Formatters
    const hijriDate = formatHijriDate(currentTime);

    // Next Prayer Logic (Only relevant for Today)
    useEffect(() => {
        if (!currentPrayerTimes) return;
        // Logic remains same for "Hero" display when viewing Today
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const now = new Date();
        let found = false;

        for (const prayer of prayers) {
            const timeStr = currentPrayerTimes[prayer as keyof PrayerTimes];
            if (!timeStr) continue;

            const [hours, minutes] = timeStr.split(':').map(Number);
            const prayerDate = new Date(now);
            prayerDate.setHours(hours, minutes, 0, 0);

            if (prayerDate > now) {
                const diffMs = prayerDate.getTime() - now.getTime();
                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                const ampm = hours >= 12 ? 'PM' : 'AM';
                const hours12 = hours % 12 || 12;
                const formattedTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

                setNextPrayer({
                    name: prayer,
                    time: formattedTime,
                    remaining: diffHrs > 0
                        ? t('dashboard.remainingHoursMins', { hours: diffHrs, mins: diffMins })
                        : t('dashboard.remainingMins', { mins: diffMins })
                });
                found = true;
                break;
            }
        }

        if (!found) {
            const fajrTime = currentPrayerTimes['Fajr'];
            setNextPrayer({
                name: 'Fajr',
                time: fajrTime || t('dashboard.tomorrow'),
                remaining: t('dashboard.tomorrow')
            });
        }

    }, [currentPrayerTimes, currentTime, language]);

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200 pb-24">
            <header className="flex items-center justify-between p-6 pt-8">
                <div className="flex items-center gap-3">
                    <div className="relative group cursor-pointer" onClick={() => navigate('profile')}>
                        <Avatar
                            src={user?.avatar}
                            className="rounded-full size-10 border-2 border-gray-200 dark:border-white/10 shadow-sm transition-transform group-hover:scale-105"
                            iconClassName="text-xl"
                        />
                        <div className="absolute bottom-0 right-0 size-3 bg-primary rounded-full border-2 border-background-light dark:border-background-dark"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('dashboard.goodMorning')}</span>
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight">{user?.name || t('dashboard.guest')}</h2>
                    </div>
                </div>
                <button
                    onClick={() => navigate('notifications' as any)}
                    className="relative flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white shadow-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/5"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>notifications</span>
                    {unreadNotificationCount > 0 && (
                        <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full border border-background-light dark:border-background-dark"></span>
                    )}
                </button>
            </header>

            <div className="flex gap-3 px-6 pb-2 overflow-x-auto no-scrollbar mask-gradient-right">
                <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full pl-5 pr-5 shadow-sm bg-primary text-white shadow-glow ring-2 ring-primary/20">
                    <p className="text-sm font-bold whitespace-nowrap">{t('dashboard.todayHijri', { date: hijriDate })}</p>
                </div>
            </div>

            <div className="p-6">
                <div className="relative w-full rounded-2xl overflow-hidden shadow-soft group cursor-pointer border border-gray-100 dark:border-white/5 bg-white dark:bg-card-dark transition-all duration-500" style={{ minHeight: '16rem' }} onClick={() => navigate('salat')}>
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCr3aT5De8XwkSFPB239DA1SyB5EStcIm5OZbGPkej8ausZoDjQsx5Z9cliCMYZ3swRxgJ-osoTKyDddvOc6wldk0X_at8Bz39KhETxSrpfeLz-Nx2kogPWB_NpgRRRkTSOp6V8MwXQdYDaftc9d-Dg5FEKfOS0HZG-E9bZxo9jnXTGCbsmdEXhBLKg0d9xr8bzHNo80hc20Uiy7JRJmxd6If2DDNNBVll_mPaIjXn8tbFjkdiKsga4nuB5mNvlhxj1QpZ_RzTXog8")' }}></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1b16] via-[#0d1b16]/50 to-transparent opacity-90"></div>

                    <div className="relative h-full flex flex-col justify-between p-6 text-white min-h-[16rem]">
                        <div className="flex justify-between items-start">
                            <div className="backdrop-blur-md bg-primary/20 text-primary rounded-full px-4 py-1.5 border border-primary/20 shadow-sm">
                                <span className="text-xs font-bold tracking-wider uppercase text-white">{t('dashboard.nextPrayerBadge')}</span>
                            </div>

                            <div className="relative group/settings" onClick={(e) => e.stopPropagation()}>
                                <button className="flex items-center justify-center rounded-full size-8 hover:bg-white/10 transition-colors">
                                    <span className="material-symbols-outlined text-white/80">more_horiz</span>
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1a2e25] border border-gray-100 dark:border-white/10 rounded-lg shadow-2xl p-1.5 opacity-0 invisible group-hover/settings:opacity-100 group-hover/settings:visible transition-all z-20 origin-top-right transform scale-95 group-hover/settings:scale-100">
                                    <button onClick={() => setIsAdhanSheetOpen(true)} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">volume_up</span>
                                        {t('dashboard.adhanSettings')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <h1 className="text-4xl font-bold tracking-tight">{nextPrayer?.name || t('dashboard.loadingPrayer')}</h1>
                                <span className="text-xl font-medium text-primary">{nextPrayer?.time || '--:--'}</span>
                            </div>
                            <p className="text-gray-300 font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                                {nextPrayer?.remaining || t('dashboard.calculating')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 mb-2">
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t('dashboard.dailyGoalsTitle')}</h3>
                    <button onClick={() => navigate('daily-goals' as any)} className="text-sm font-medium text-primary hover:text-primary/80 cursor-pointer">{t('dashboard.viewAll')}</button>
                </div>
                <div className="flex justify-start gap-2 overflow-x-auto no-scrollbar py-2">
                    {goals.map(g => {
                        const target = g.target && g.target > 0 ? g.target : 1;
                        const isCompleted = g.type === 'boolean' ? g.done : g.current >= target;
                        const ratio = g.type === 'boolean' ? (g.done ? 1 : 0) : Math.min(g.current / target, 1);
                        const handleTap = () => {
                            if (g.type === 'boolean') { toggleBooleanGoal(g.id); return; }
                            setAmountGoal(g);
                            setAmountInput(String(g.current));
                        };
                        return (
                            <div key={g.id} className="flex flex-col items-center gap-2 group cursor-pointer min-w-[70px]" onClick={handleTap}>
                                <div className="relative size-16 flex items-center justify-center">
                                    <ProgressRing progress={ratio} strokeWidth={8} />
                                    <div className={`size-12 rounded-full ${isCompleted ? 'bg-primary text-white' : 'bg-primary/10 text-primary'} flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors overflow-hidden`}>
                                        <GoalIcon icon={g.icon} iconImage={g.iconImage} className="text-[20px] size-full" />
                                    </div>
                                    {isCompleted && (
                                        <div className="absolute bottom-0 right-0 bg-primary border-2 border-background-light dark:border-background-dark rounded-full size-5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate max-w-[70px]">{g.label}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="px-6 py-6">
                <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight mb-4">{t('dashboard.quickAccess')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div onClick={() => navigate('qibla')} className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl shadow-soft hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer flex flex-col gap-3 group border border-gray-100 dark:border-white/5">
                        <div className="size-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">explore</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Qibla</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.findDirection')}</p>
                        </div>
                    </div>
                    <div onClick={() => navigate('quran')} className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl shadow-soft hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer flex flex-col gap-3 group border border-gray-100 dark:border-white/5">
                        <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">auto_stories</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Quran</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.resumeReading')}</p>
                        </div>
                    </div>
                    <div onClick={() => navigate('dua')} className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl shadow-soft hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer flex flex-col gap-3 group border border-gray-100 dark:border-white/5">
                        <div className="size-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-500 dark:text-purple-400 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">pan_tool</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Dua</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.supplicationsSubtitle')}</p>
                        </div>
                    </div>
                    <div onClick={() => navigate('tasbih')} className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl shadow-soft hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer flex flex-col gap-3 group border border-gray-100 dark:border-white/5">
                        <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">touch_app</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Tasbih</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.digitalCounter')}</p>
                        </div>
                    </div>
                    <div onClick={() => navigate('reflections')} className="col-span-2 bg-gray-100 dark:bg-white/5 p-4 rounded-xl shadow-soft hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer flex items-center gap-3 group border border-gray-100 dark:border-white/5">
                        <div className="size-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                            <span className="material-symbols-outlined">edit_note</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{t('dashboard.reflections')}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.reflectionsSubtitle')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 mb-6">
                <div className="bg-white dark:bg-card-dark rounded-2xl p-6 relative overflow-hidden border border-gray-100 dark:border-white/5">
                    <div className="absolute -right-10 -top-10 size-40 bg-gray-100 dark:bg-white/5 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-primary text-sm">format_quote</span>
                            <span className="text-xs uppercase tracking-wider text-primary font-bold">{t('dashboard.verseOfTheDay')}</span>
                        </div>
                        <p className="text-slate-900 dark:text-white text-lg font-medium leading-relaxed font-serif italic mb-4">
                            "{verseText}"
                        </p>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-white/60 text-xs">{verseOfDay.surah} ({verseOfDay.index})</span>
                            <button
                                onClick={() => {
                                    Share.share({
                                        title: t('dashboard.verseOfTheDay'),
                                        text: `"${verseText}" - ${verseOfDay.surah} (${verseOfDay.index})`,
                                        url: 'https://nur-app.com/'
                                    }).catch(() => {});
                                }}
                                className="text-slate-900 dark:text-white hover:text-primary transition-colors"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>share</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 pb-6 text-center">
                <div className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
                    <span className="text-xs uppercase tracking-wide font-bold">{t('dashboard.dataStoredLocally')}</span>
                </div>
            </div>

            {isAdhanSheetOpen && <AdhanSettings onBack={() => setIsAdhanSheetOpen(false)} />}

            {amountGoal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200" onClick={() => setAmountGoal(null)}>
                    <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{amountGoal.label}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('dashboard.goalAmountPrompt', { target: amountGoal.target ?? 1 })}</p>
                        <input
                            type="number"
                            min={0}
                            value={amountInput}
                            onChange={(e) => setAmountInput(e.target.value)}
                            autoFocus
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-center text-2xl font-bold focus:outline-none focus:border-primary transition-colors mb-6"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setAmountGoal(null)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">{t('dashboard.cancel')}</button>
                            <button onClick={saveAmount} className="flex-1 py-3 rounded-xl font-bold bg-primary text-background-dark shadow-glow hover:scale-105 transition-transform">{t('dashboard.save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
