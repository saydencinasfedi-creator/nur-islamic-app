
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
    User, Location, PrayerTimes, Message, TasbihHistoryItem,
    PrayerName, PrayerCompletionDay, PrayerHistoryEntry,
    Goal, GoalsAggregate, PRAYER_NAMES,
    AdhanSound, AppNotification, NotifSettings, PageId,
    Reflection, Tag
} from '../types';
import { fetchPrayerTimes, reverseGeocode, forwardGeocode } from '../services/prayerService';
import { deleteAudioFile } from '../services/fileStorage';
import { Language, TranslationKey, translate, RTL_LANGUAGES } from '../services/i18n';

interface UserContextType {
    user: User | null;
    location: Location | null;
    prayerTimes: PrayerTimes | null;
    chatHistory: Message[];
    tasbihCounts: Record<string, number>;
    tasbihHistory: TasbihHistoryItem[];
    updateUser: (updates: Partial<User>) => void;
    signOut: () => void;
    updateLocation: () => Promise<void>;
    updateLocationManual: (city: string) => Promise<boolean>;
    refreshPrayerTimes: () => Promise<void>;
    updateChatHistory: (messages: Message[]) => void;
    updateTasbihCount: (dhikrName: string, count: number) => void;
    addToTasbihHistory: (item: Omit<TasbihHistoryItem, 'id'>) => void;

    // Prayer completion (manual check-off, see Feature 1). `prayerCompletionMap` holds a
    // rolling window of the last few days (today + EDITABLE_WINDOW_DAYS-1 back) so missed
    // prayers can still be checked retroactively; `prayerCompletion` is today's slice of it.
    prayerCompletionMap: Record<string, Record<PrayerName, boolean>>;
    prayerCompletion: PrayerCompletionDay;
    totalPrayersCompleted: number;
    prayerStreak: number;
    togglePrayerCompletion: (date: string, prayer: PrayerName) => void;

    // App language / translations
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
    textDirection: 'ltr' | 'rtl';

    // Daily goals (fully customizable, see Feature 3)
    goals: Goal[];
    goalsTodayPercent: number;
    goalsLifetimeAveragePercent: number;
    toggleBooleanGoal: (id: string) => void;
    markGoalDone: (id: string) => void;
    setGoalAmount: (id: string, value: number) => void;
    addGoal: (goal: Omit<Goal, 'id' | 'current' | 'done'>) => void;
    updateGoal: (id: string, updates: Partial<Omit<Goal, 'id'>>) => void;
    deleteGoal: (id: string) => void;
    reorderGoals: (orderedIds: string[]) => void;

    // Adhan sounds (user-uploaded, no bundled defaults)
    adhanSounds: AdhanSound[];
    activeAdhanId: string | null;
    addAdhanSound: (sound: Omit<AdhanSound, 'id' | 'uploadedAt'>) => void;
    renameAdhanSound: (id: string, label: string) => void;
    deleteAdhanSound: (id: string) => void;
    setActiveAdhanId: (id: string | null) => void;
    adhanVolumePercent: number;
    setAdhanVolumePercent: (percent: number) => void;
    adhanPrayerEnabled: Record<PrayerName, boolean>;
    updateAdhanPrayerEnabled: (prayer: PrayerName, enabled: boolean) => void;
    flipToStopAdhan: boolean;
    setFlipToStopAdhan: (enabled: boolean) => void;

    // Reflections (personal Qur'an/topic journal) + the global tag vocabulary they share
    reflections: Reflection[];
    tags: Tag[];
    addReflection: (data: Omit<Reflection, 'id' | 'createdAt' | 'updatedAt'>) => string;
    updateReflection: (id: string, updates: Partial<Omit<Reflection, 'id' | 'createdAt'>>) => void;
    deleteReflection: (id: string) => void;
    resolveTagNames: (names: string[]) => string[];
    deleteTag: (id: string) => void;

    // Customizable shortcuts shown in the BottomNav "+" quick-menu
    quickActionPages: PageId[];
    setQuickActionPages: (pages: PageId[]) => void;

    // Real notifications (in-app panel + system tray, see hooks/useNotificationEngine)
    notifications: AppNotification[];
    unreadNotificationCount: number;
    addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    notifSettings: NotifSettings;
    updateNotifSettings: (updates: Partial<NotifSettings>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const todayStr = () => new Date().toDateString();

const dateStrOffset = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toDateString();
};

// Today plus this many days back stay individually editable (checkboxes can be ticked
// for a missed prayer from a past day); older days only survive as the boolean summary
// in prayerHistory, used for the streak.
const EDITABLE_WINDOW_DAYS = 4;
const editableWindowDates = () => Array.from({ length: EDITABLE_WINDOW_DAYS }, (_, i) => dateStrOffset(-i));

const blankPrayerRecord = (): Record<PrayerName, boolean> => ({
    Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false
});

const isPrayerDayComplete = (day: Record<PrayerName, boolean>) => PRAYER_NAMES.every(p => day[p]);

const pruneToWindow = (map: Record<string, Record<PrayerName, boolean>>) => {
    const window = new Set(editableWindowDates());
    const pruned: Record<string, Record<PrayerName, boolean>> = {};
    for (const date of Object.keys(map)) {
        if (window.has(date)) pruned[date] = map[date];
    }
    return pruned;
};

const upsertHistory = (history: PrayerHistoryEntry[], date: string, allCompleted: boolean): PrayerHistoryEntry[] => {
    const idx = history.findIndex(h => h.date === date);
    if (idx === -1) return [{ date, allCompleted }, ...history].slice(0, 1000);
    if (history[idx].allCompleted === allCompleted) return history;
    const next = [...history];
    next[idx] = { date, allCompleted };
    return next;
};

// Walk backward day-by-day from today, counting consecutive fully-completed days.
// If today is already complete it counts as the first day of the streak; otherwise
// today doesn't break a streak built on prior days until the day actually ends.
const computePrayerStreak = (history: PrayerHistoryEntry[], today: PrayerCompletionDay): number => {
    const completedDates = new Set(history.filter(h => h.allCompleted).map(h => h.date));
    const cursor = new Date();
    let streak = 0;
    if (isPrayerDayComplete(today)) {
        streak = 1;
    }
    cursor.setDate(cursor.getDate() - 1);
    while (completedDates.has(cursor.toDateString())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
};

const DEFAULT_GOALS: Goal[] = [
    { id: 'Quran', label: 'Quran Reading', icon: 'menu_book', type: 'boolean', note: 'Read 1 page', current: 0, done: false },
    { id: 'Sadaqah', label: 'Daily Sadaqah', icon: 'volunteer_activism', type: 'boolean', note: 'Give charity', current: 0, done: false },
    { id: 'Dhikr', label: 'Morning Dhikr', icon: 'psychology', type: 'boolean', note: 'Complete set', current: 0, done: false },
    { id: 'Salat', label: '5 Daily Prayers', icon: 'mosque', type: 'boolean', note: 'Pray on time', current: 0, done: false },
];

const goalRatio = (g: Goal): number => {
    if (g.type === 'boolean') return g.done ? 1 : 0;
    const target = g.target && g.target > 0 ? g.target : 1;
    return Math.min(g.current / target, 1);
};

const goalsPercent = (goals: Goal[]): number => {
    if (goals.length === 0) return 0;
    return (goals.reduce((sum, g) => sum + goalRatio(g), 0) / goals.length) * 100;
};

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Persisted locally so the user doesn't have to log in again every time they open the app.
    const [user, setUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('nurUser');
        return saved ? JSON.parse(saved) : null;
    });
    const [location, setLocation] = useState<Location | null>(() => {
        const saved = localStorage.getItem('nurLocation');
        return saved ? JSON.parse(saved) : null;
    });
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);

    // --- Language / translations ---
    const [language, setLanguageState] = useState<Language>(() => {
        return (localStorage.getItem('nurLanguage') as Language) || 'en';
    });
    const setLanguage = (lang: Language) => setLanguageState(lang);
    useEffect(() => {
        localStorage.setItem('nurLanguage', language);
    }, [language]);
    const textDirection: 'ltr' | 'rtl' = RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = textDirection;
    }, [language, textDirection]);
    const t = useCallback(
        (key: TranslationKey, params?: Record<string, string | number>) => translate(key, language, params),
        [language]
    );

    const [chatHistory, setChatHistory] = useState<Message[]>([]);
    const [tasbihCounts, setTasbihCounts] = useState<Record<string, number>>({});
    const [tasbihHistory, setTasbihHistory] = useState<TasbihHistoryItem[]>(() => {
        const saved = localStorage.getItem('tasbihHistory');
        return saved ? JSON.parse(saved) : [];
    });

    // --- Prayer completion (Feature 1 + Feature 6: last few days stay editable) ---
    const [prayerCompletionMap, setPrayerCompletionMap] = useState<Record<string, Record<PrayerName, boolean>>>(() => {
        const savedMap = localStorage.getItem('nurPrayerCompletionMap');
        if (savedMap) {
            return pruneToWindow(JSON.parse(savedMap));
        }
        // Migrate from the old single-day model (pre-existing installs).
        const legacy = localStorage.getItem('nurPrayerCompletion');
        if (legacy) {
            const parsed: PrayerCompletionDay = JSON.parse(legacy);
            const { date, ...prayers } = parsed;
            return pruneToWindow({ [date]: prayers as Record<PrayerName, boolean> });
        }
        return {};
    });
    const [prayerHistory, setPrayerHistory] = useState<PrayerHistoryEntry[]>(() => {
        const saved = localStorage.getItem('nurPrayerHistory');
        let history: PrayerHistoryEntry[] = saved ? JSON.parse(saved) : [];
        // Any day that fell out of the editable window before it ever got upserted into
        // history (e.g. it aged out between app opens) still needs its final state recorded.
        const savedMap = localStorage.getItem('nurPrayerCompletionMap');
        const legacyCompletion = localStorage.getItem('nurPrayerCompletion');
        const rawMap: Record<string, Record<PrayerName, boolean>> = savedMap
            ? JSON.parse(savedMap)
            : legacyCompletion
                ? (() => { const { date, ...p } = JSON.parse(legacyCompletion) as PrayerCompletionDay; return { [date]: p as Record<PrayerName, boolean> }; })()
                : {};
        const window = new Set(editableWindowDates());
        for (const date of Object.keys(rawMap)) {
            if (!window.has(date)) {
                history = upsertHistory(history, date, isPrayerDayComplete(rawMap[date]));
            }
        }
        return history;
    });
    const [totalPrayersCompleted, setTotalPrayersCompleted] = useState<number>(() => {
        const saved = localStorage.getItem('nurPrayerLifetimeCount');
        return saved ? (parseInt(saved, 10) || 0) : 0;
    });

    useEffect(() => {
        localStorage.setItem('nurPrayerCompletionMap', JSON.stringify(prayerCompletionMap));
    }, [prayerCompletionMap]);

    useEffect(() => {
        localStorage.setItem('nurPrayerHistory', JSON.stringify(prayerHistory));
    }, [prayerHistory]);

    useEffect(() => {
        localStorage.setItem('nurPrayerLifetimeCount', String(totalPrayersCompleted));
    }, [totalPrayersCompleted]);

    const togglePrayerCompletion = (date: string, prayer: PrayerName) => {
        setPrayerCompletionMap(prev => {
            const day = prev[date] ?? blankPrayerRecord();
            const nextValue = !day[prayer];
            const nextDay = { ...day, [prayer]: nextValue };
            setTotalPrayersCompleted(c => Math.max(0, c + (nextValue ? 1 : -1)));
            setPrayerHistory(h => upsertHistory(h, date, isPrayerDayComplete(nextDay)));
            return { ...prev, [date]: nextDay };
        });
    };

    const prayerCompletion: PrayerCompletionDay = useMemo(() => {
        const today = todayStr();
        return { date: today, ...blankPrayerRecord(), ...(prayerCompletionMap[today] ?? {}) };
    }, [prayerCompletionMap]);

    const prayerStreak = useMemo(
        () => computePrayerStreak(prayerHistory, prayerCompletion),
        [prayerHistory, prayerCompletion]
    );

    // --- Daily goals (Feature 3) ---
    const [goals, setGoals] = useState<Goal[]>(() => {
        const today = todayStr();
        const savedDate = localStorage.getItem('nurGoalsDate');
        const saved = localStorage.getItem('nurGoals');
        if (saved && savedDate === today) {
            return JSON.parse(saved);
        }
        if (saved) {
            // New day: keep the user's goal list/config, reset progress.
            const prevGoals: Goal[] = JSON.parse(saved);
            return prevGoals.map(g => ({ ...g, current: 0, done: false }));
        }
        // First run after upgrading from the old flat-boolean `dailyGoals` model.
        const legacy = localStorage.getItem('dailyGoals');
        const legacyDate = localStorage.getItem('dailyGoalsDate');
        if (legacy && legacyDate === today) {
            const parsedLegacy = JSON.parse(legacy);
            return DEFAULT_GOALS.map(g => ({ ...g, done: !!parsedLegacy[g.id], current: parsedLegacy[g.id] ? 1 : 0 }));
        }
        return DEFAULT_GOALS;
    });

    const [goalsAggregate, setGoalsAggregate] = useState<GoalsAggregate>(() => {
        const saved = localStorage.getItem('nurGoalsAggregate');
        let aggregate: GoalsAggregate = saved ? JSON.parse(saved) : { days: 0, sumPercent: 0 };
        const today = todayStr();
        const savedDate = localStorage.getItem('nurGoalsDate');
        if (savedDate && savedDate !== today) {
            const savedGoalsRaw = localStorage.getItem('nurGoals');
            if (savedGoalsRaw) {
                const prevGoals: Goal[] = JSON.parse(savedGoalsRaw);
                aggregate = { days: aggregate.days + 1, sumPercent: aggregate.sumPercent + goalsPercent(prevGoals) };
            }
        }
        return aggregate;
    });

    useEffect(() => {
        localStorage.setItem('nurGoals', JSON.stringify(goals));
        localStorage.setItem('nurGoalsDate', todayStr());
    }, [goals]);

    useEffect(() => {
        localStorage.setItem('nurGoalsAggregate', JSON.stringify(goalsAggregate));
    }, [goalsAggregate]);

    // The `goals` useState initializer above only re-checks the date on a fresh mount — if
    // the app is just left open (or backgrounded, which on Android doesn't kill the JS
    // process) across midnight, goals stayed marked from the previous day indefinitely.
    // This re-runs the same "new day -> roll into aggregate, reset progress" check live,
    // on app resume/visibility and as a periodic fallback for sessions left foregrounded.
    const goalsRef = useRef(goals);
    goalsRef.current = goals;
    const lastGoalsDateRef = useRef(todayStr());

    useEffect(() => {
        const checkGoalsRollover = () => {
            const today = todayStr();
            if (today === lastGoalsDateRef.current) return;
            lastGoalsDateRef.current = today;
            setGoalsAggregate(prevAgg => ({
                days: prevAgg.days + 1,
                sumPercent: prevAgg.sumPercent + goalsPercent(goalsRef.current),
            }));
            setGoals(prev => prev.map(g => ({ ...g, current: 0, done: false })));
        };

        const onVisible = () => {
            if (document.visibilityState === 'visible') checkGoalsRollover();
        };
        document.addEventListener('visibilitychange', onVisible);
        const appStateSub = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) checkGoalsRollover();
        });
        // Safety net for a session that stays foregrounded/active straight through midnight
        // without ever backgrounding or losing visibility.
        const interval = setInterval(checkGoalsRollover, 5 * 60 * 1000);

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            appStateSub.then(handle => handle.remove());
            clearInterval(interval);
        };
    }, []);

    const toggleBooleanGoal = (id: string) => {
        setGoals(prev => prev.map(g => {
            if (g.id !== id || g.type !== 'boolean') return g;
            const done = !g.done;
            return { ...g, done, current: done ? 1 : 0 };
        }));
    };

    const markGoalDone = (id: string) => {
        setGoals(prev => prev.map(g => {
            if (g.id !== id || g.type !== 'boolean' || g.done) return g;
            return { ...g, done: true, current: 1 };
        }));
    };

    const setGoalAmount = (id: string, value: number) => {
        setGoals(prev => prev.map(g => {
            if (g.id !== id || g.type !== 'amount') return g;
            const target = g.target && g.target > 0 ? g.target : 1;
            const clamped = Math.max(0, Math.min(value, target));
            return { ...g, current: clamped, done: clamped >= target };
        }));
    };

    const addGoal = (goal: Omit<Goal, 'id' | 'current' | 'done'>) => {
        const newGoal: Goal = { ...goal, id: crypto.randomUUID(), current: 0, done: false };
        setGoals(prev => [...prev, newGoal]);
    };

    const updateGoal = (id: string, updates: Partial<Omit<Goal, 'id'>>) => {
        setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    };

    const deleteGoal = (id: string) => {
        setGoals(prev => prev.filter(g => g.id !== id));
    };

    // Goals have no separate "order" field — the array's own order IS the display order,
    // both on Dashboard and in the Daily Goals list — so reordering just replaces it directly.
    const reorderGoals = (orderedIds: string[]) => {
        setGoals(prev => {
            const byId = new Map(prev.map(g => [g.id, g]));
            const reordered = orderedIds.map(id => byId.get(id)).filter((g): g is Goal => !!g);
            // Any goal not present in orderedIds (shouldn't normally happen) stays appended.
            const missing = prev.filter(g => !orderedIds.includes(g.id));
            return [...reordered, ...missing];
        });
    };

    const goalsTodayPercent = useMemo(() => goalsPercent(goals), [goals]);

    const goalsLifetimeAveragePercent = useMemo(() => {
        const totalDays = goalsAggregate.days + 1; // +1 for today, counted live
        const totalPercent = goalsAggregate.sumPercent + goalsTodayPercent;
        return totalDays > 0 ? totalPercent / totalDays : 0;
    }, [goalsAggregate, goalsTodayPercent]);

    // --- Adhan sounds (Feature 6): no bundled defaults, purely user-uploaded ---
    const [adhanSounds, setAdhanSounds] = useState<AdhanSound[]>(() => {
        const saved = localStorage.getItem('nurAdhanSounds');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeAdhanId, setActiveAdhanIdState] = useState<string | null>(() => {
        return localStorage.getItem('nurActiveAdhanId') || null;
    });

    useEffect(() => {
        localStorage.setItem('nurAdhanSounds', JSON.stringify(adhanSounds));
    }, [adhanSounds]);

    useEffect(() => {
        if (activeAdhanId) localStorage.setItem('nurActiveAdhanId', activeAdhanId);
        else localStorage.removeItem('nurActiveAdhanId');
    }, [activeAdhanId]);

    // --- BottomNav "+" quick-menu shortcuts: user-customizable, default matches the
    // original hardcoded set so nobody's menu changes until they edit it themselves ---
    const [quickActionPages, setQuickActionPages] = useState<PageId[]>(() => {
        const saved = localStorage.getItem('nurQuickActionPages');
        return saved ? JSON.parse(saved) : ['reflections', 'daily-goals', 'tasbih', 'qibla'];
    });

    useEffect(() => {
        localStorage.setItem('nurQuickActionPages', JSON.stringify(quickActionPages));
    }, [quickActionPages]);

    const addAdhanSound = (sound: Omit<AdhanSound, 'id' | 'uploadedAt'>) => {
        const newSound: AdhanSound = { ...sound, id: crypto.randomUUID(), uploadedAt: Date.now() };
        setAdhanSounds(prev => [...prev, newSound]);
        setActiveAdhanIdState(prev => prev ?? newSound.id); // first upload becomes active automatically
    };

    const renameAdhanSound = (id: string, label: string) => {
        setAdhanSounds(prev => prev.map(s => s.id === id ? { ...s, label } : s));
    };

    const deleteAdhanSound = (id: string) => {
        setAdhanSounds(prev => {
            const sound = prev.find(s => s.id === id);
            if (sound) deleteAudioFile(sound.filePath).catch(() => { });
            return prev.filter(s => s.id !== id);
        });
        setActiveAdhanIdState(prev => prev === id ? null : prev);
    };

    const setActiveAdhanId = (id: string | null) => setActiveAdhanIdState(id);

    // How loud the adhan plays (applied by natively boosting the Alarm stream to this % of
    // its max right before ringing, see AdhanRingService.java) and which of the 5 prayers it
    // should actually sound for — someone may want the notification but not the audio for, say,
    // Fajr specifically.
    const [adhanVolumePercent, setAdhanVolumePercent] = useState<number>(() => {
        const saved = localStorage.getItem('nurAdhanVolumePercent');
        return saved !== null ? parseInt(saved, 10) : 100;
    });
    const [adhanPrayerEnabled, setAdhanPrayerEnabled] = useState<Record<PrayerName, boolean>>(() => {
        const saved = localStorage.getItem('nurAdhanPrayerEnabled');
        return saved ? JSON.parse(saved) : { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true };
    });
    // Turn the phone face down while the adhan is ringing to silence it (handled natively in
    // AdhanRingService). On by default; the toggle lives in Adhan Settings.
    const [flipToStopAdhan, setFlipToStopAdhan] = useState<boolean>(() => {
        const saved = localStorage.getItem('nurFlipToStopAdhan');
        return saved === null ? true : saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('nurAdhanVolumePercent', String(adhanVolumePercent));
    }, [adhanVolumePercent]);

    useEffect(() => {
        localStorage.setItem('nurAdhanPrayerEnabled', JSON.stringify(adhanPrayerEnabled));
    }, [adhanPrayerEnabled]);

    useEffect(() => {
        localStorage.setItem('nurFlipToStopAdhan', String(flipToStopAdhan));
    }, [flipToStopAdhan]);

    const updateAdhanPrayerEnabled = (prayer: PrayerName, enabled: boolean) => {
        setAdhanPrayerEnabled(prev => ({ ...prev, [prayer]: enabled }));
    };

    // --- Reflections + global tags (same localStorage + effect-persist pattern as goals) ---
    const [reflections, setReflections] = useState<Reflection[]>(() => {
        const saved = localStorage.getItem('nurReflections');
        return saved ? JSON.parse(saved) : [];
    });
    const [tags, setTags] = useState<Tag[]>(() => {
        const saved = localStorage.getItem('nurTags');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('nurReflections', JSON.stringify(reflections));
    }, [reflections]);
    useEffect(() => {
        localStorage.setItem('nurTags', JSON.stringify(tags));
    }, [tags]);

    const addReflection = (data: Omit<Reflection, 'id' | 'createdAt' | 'updatedAt'>): string => {
        const now = Date.now();
        const newReflection: Reflection = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
        setReflections(prev => [newReflection, ...prev]);
        return newReflection.id;
    };
    const updateReflection = (id: string, updates: Partial<Omit<Reflection, 'id' | 'createdAt'>>) => {
        setReflections(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r));
    };
    const deleteReflection = (id: string) => {
        // Deliberately does NOT touch `tags` — global vocabulary outlives any one reflection.
        setReflections(prev => prev.filter(r => r.id !== id));
    };
    // Map free-typed tag names to ids, reusing an existing tag on a case-insensitive match
    // (never creating "Sabr" twice) and creating the rest. Returns the resolved id list
    // synchronously; any newly-created tags are also committed to state.
    const resolveTagNames = (names: string[]): string[] => {
        const resolved: string[] = [];
        const toCreate: Tag[] = [];
        for (const raw of names) {
            const name = raw.trim();
            if (!name) continue;
            const key = name.toLowerCase();
            const existing = tags.find(t => t.name.trim().toLowerCase() === key)
                ?? toCreate.find(t => t.name.trim().toLowerCase() === key);
            if (existing) {
                if (!resolved.includes(existing.id)) resolved.push(existing.id);
            } else {
                const tag: Tag = { id: crypto.randomUUID(), name };
                toCreate.push(tag);
                resolved.push(tag.id);
            }
        }
        if (toCreate.length) setTags(prev => [...prev, ...toCreate]);
        return resolved;
    };
    const deleteTag = (id: string) => {
        setTags(prev => prev.filter(t => t.id !== id));
        setReflections(prev => prev.map(r =>
            r.tagIds.includes(id) ? { ...r, tagIds: r.tagIds.filter(tid => tid !== id) } : r
        ));
    };

    // --- Real notifications (Feature 8) ---
    const [notifications, setNotifications] = useState<AppNotification[]>(() => {
        const saved = localStorage.getItem('nurNotifications');
        return saved ? JSON.parse(saved) : [];
    });
    const [notifSettings, setNotifSettingsState] = useState<NotifSettings>(() => {
        const saved = localStorage.getItem('nurNotifSettings');
        return saved ? JSON.parse(saved) : { prayerTimes: true, dailyGoalReminder: true, streakAchievements: true };
    });

    useEffect(() => {
        localStorage.setItem('nurNotifications', JSON.stringify(notifications));
    }, [notifications]);

    useEffect(() => {
        localStorage.setItem('nurNotifSettings', JSON.stringify(notifSettings));
    }, [notifSettings]);

    const addNotification = (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const newNotif: AppNotification = { ...n, id: crypto.randomUUID(), timestamp: Date.now(), read: false };
        setNotifications(prev => [newNotif, ...prev].slice(0, 200));
    };

    const markNotificationRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllNotificationsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const updateNotifSettings = (updates: Partial<NotifSettings>) => {
        setNotifSettingsState(prev => ({ ...prev, ...updates }));
    };

    const unreadNotificationCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    useEffect(() => {
        localStorage.setItem('tasbihHistory', JSON.stringify(tasbihHistory));
    }, [tasbihHistory]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('nurUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('nurUser');
        }
    }, [user]);

    useEffect(() => {
        if (location) {
            localStorage.setItem('nurLocation', JSON.stringify(location));
        }
    }, [location]);

    const updateUser = (updates: Partial<User>) => {
        setUser(prev => {
            if (!prev) return { ...updates } as User;
            return { ...prev, ...updates };
        });
    };

    const signOut = () => {
        setUser(null);
    };

    const updateLocationManual = async (city: string): Promise<boolean> => {
        const foundLocation = await forwardGeocode(city);
        if (foundLocation && foundLocation.latitude && foundLocation.longitude) {
            const newLocation: Location = {
                latitude: foundLocation.latitude,
                longitude: foundLocation.longitude,
                city: foundLocation.city || city,
                country: foundLocation.country || 'Unknown'
            };
            setLocation(newLocation);
            if (user) {
                updateUser({ location: newLocation });
            }
            return true;
        }
        return false;
    }

    const updateLocation = async () => {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported by this browser.");
            return;
        }

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            const { latitude, longitude } = position.coords;
            const geoData = await reverseGeocode(latitude, longitude);

            const newLocation: Location = {
                latitude,
                longitude,
                city: geoData?.city || 'Unknown',
                country: geoData?.country || 'Unknown'
            };

            setLocation(newLocation);
            // update user profile with location if logged in
            if (user) {
                updateUser({ location: newLocation });
            }

        } catch (error) {
            console.error("Error getting location:", error);
            // Fallback to default if error (e.g. Cairo)
            setLocation({ city: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357 });
        }
    };

    const updateChatHistory = (messages: Message[]) => {
        setChatHistory(messages);
    };

    const updateTasbihCount = (dhikrName: string, count: number) => {
        setTasbihCounts(prev => ({
            ...prev,
            [dhikrName]: count
        }));
    };

    const addToTasbihHistory = (item: Omit<TasbihHistoryItem, 'id'>) => {
        const newItem: TasbihHistoryItem = {
            ...item,
            id: crypto.randomUUID()
        };
        setTasbihHistory(prev => [newItem, ...prev]);
    };

    const refreshPrayerTimes = async () => {
        if (location) {
            const times = await fetchPrayerTimes(location.latitude, location.longitude);
            if (times) {
                setPrayerTimes(times);
            }
        }
    };

    useEffect(() => {
        if (location) {
            refreshPrayerTimes();
        }
    }, [location]);

    return (
        <UserContext.Provider value={{
            user, location, prayerTimes, chatHistory, tasbihCounts, tasbihHistory,
            language, setLanguage, t, textDirection,
            updateUser, signOut, updateLocation, updateLocationManual, refreshPrayerTimes,
            updateChatHistory, updateTasbihCount, addToTasbihHistory,
            prayerCompletionMap, prayerCompletion, totalPrayersCompleted, prayerStreak, togglePrayerCompletion,
            goals, goalsTodayPercent, goalsLifetimeAveragePercent,
            toggleBooleanGoal, markGoalDone, setGoalAmount, addGoal, updateGoal, deleteGoal, reorderGoals,
            adhanSounds, activeAdhanId, addAdhanSound, renameAdhanSound, deleteAdhanSound, setActiveAdhanId,
            adhanVolumePercent, setAdhanVolumePercent, adhanPrayerEnabled, updateAdhanPrayerEnabled,
            flipToStopAdhan, setFlipToStopAdhan,
            reflections, tags, addReflection, updateReflection, deleteReflection, resolveTagNames, deleteTag,
            quickActionPages, setQuickActionPages,
            notifications, unreadNotificationCount, addNotification, markNotificationRead, markAllNotificationsRead,
            notifSettings, updateNotifSettings
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
