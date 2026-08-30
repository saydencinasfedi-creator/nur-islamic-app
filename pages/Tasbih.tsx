import React, { useState, useEffect, useRef } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { PageId, Dhikr } from '../types';
import { useUser } from '../contexts/UserContext';
import { pushBackHandler } from '../services/backHandlerStack';
import { DEFAULT_DHIKR_CONTENT, SALAWAT_DHIKR_ID } from '../data/dhikrContent';
import { dhikrContentEn, DhikrText } from '../locales/content-dhikr-en';
import { dhikrContentEs } from '../locales/content-dhikr-es';
import { Language } from '../services/i18n';

interface TasbihProps {
    navigate: (page: PageId) => void;
    onBack: () => void;
    onComplete: () => void;
}

// Languages without their own content-dhikr-*.ts yet fall back to English, same fallback
// philosophy as the UI-chrome t() engine (services/i18n.ts) — swapped in as each language
// lands (see the translation plan).
const DHIKR_CONTENT_BY_LANG: Partial<Record<Language, Record<string, DhikrText>>> = {
    en: dhikrContentEn,
    es: dhikrContentEs,
};

// Builds the 6 built-in dhikrs' display text (name/translation/transliteration) for the
// given language, keeping Arabic and recommended count fixed from data/dhikrContent.ts.
const buildDefaultDhikrs = (language: Language): Dhikr[] => {
    const content = DHIKR_CONTENT_BY_LANG[language] ?? dhikrContentEn;
    return DEFAULT_DHIKR_CONTENT.map(item => {
        const text = content[item.id] ?? dhikrContentEn[item.id];
        return { name: text.name, arabic: item.arabic, translation: text.translation, transliteration: text.transliteration, recommended: item.recommended };
    });
};

// Identifies a saved dhikr as one of the 6 built-ins (vs. a genuinely user-added one) by
// matching its `name` — transliterated names are the same across every language's content
// file by convention (e.g. "SubhanAllah" isn't itself translated), so this stays stable
// regardless of which language the entry was originally saved under.
const defaultDhikrIdByName = (name: string): string | null => {
    for (const [id, text] of Object.entries(dhikrContentEn)) {
        if (text.name === name) return id;
    }
    return null;
};

const Tasbih: React.FC<TasbihProps> = ({ navigate, onBack, onComplete }) => {
    const { tasbihCounts, updateTasbihCount, tasbihHistory, addToTasbihHistory, language, t } = useUser();

    // State
    const [dhikrs, setDhikrs] = useState<Dhikr[]>(() => {
        const saved = localStorage.getItem('customDhikrs');
        let list: Dhikr[] = saved ? JSON.parse(saved) : buildDefaultDhikrs(language);

        // One-time migration: phones that already had `customDhikrs` saved (written as
        // soon as this page was ever visited, even without adding a custom dhikr) won't
        // pick up new entries added to DEFAULT_DHIKR_CONTENT otherwise.
        if (!localStorage.getItem('nurDhikrMigrationSalawat')) {
            if (!list.some(d => defaultDhikrIdByName(d.name) === SALAWAT_DHIKR_ID)) {
                list = [...list, buildDefaultDhikrs(language).find(d => defaultDhikrIdByName(d.name) === SALAWAT_DHIKR_ID)!];
            }
            localStorage.setItem('nurDhikrMigrationSalawat', '1');
        }

        return list;
    });

    // Keep any built-in dhikrs already in `dhikrs` (from localStorage, possibly saved under
    // a previous language) showing the current language's name/translation — Arabic and any
    // user-customized recommended count are preserved untouched; only genuinely custom
    // dhikrs (no matching id) are left alone entirely.
    useEffect(() => {
        setDhikrs(prev => prev.map(d => {
            const id = defaultDhikrIdByName(d.name);
            if (!id) return d;
            const content = DHIKR_CONTENT_BY_LANG[language] ?? dhikrContentEn;
            const text = content[id] ?? dhikrContentEn[id];
            return { ...d, name: text.name, translation: text.translation, transliteration: text.transliteration };
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [hapticEnabled, setHapticEnabled] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showLog, setShowLog] = useState(false);

    const [autoReset, setAutoReset] = useState(() => {
        const saved = localStorage.getItem('tasbihAutoReset');
        return saved ? JSON.parse(saved) : true;
    });

    // Save settings
    useEffect(() => {
        localStorage.setItem('tasbihAutoReset', JSON.stringify(autoReset));
    }, [autoReset]);

    // Back button/gesture closes these overlays instead of navigating away from the page.
    useEffect(() => {
        if (!isSettingsOpen) return;
        return pushBackHandler(() => {
            setIsSettingsOpen(false);
            return true;
        });
    }, [isSettingsOpen]);

    useEffect(() => {
        if (!showLog) return;
        return pushBackHandler(() => {
            setShowLog(false);
            return true;
        });
    }, [showLog]);

    // Current Dhikr
    const currentDhikr = dhikrs[currentIndex];
    const savedCount = tasbihCounts[currentDhikr.name] || 0;
    const [count, setCount] = useState(savedCount);

    // For Settings Modal
    const [newDhikrName, setNewDhikrName] = useState('');
    const [newDhikrArabic, setNewDhikrArabic] = useState('');
    const [newDhikrTranslation, setNewDhikrTranslation] = useState('');
    const [newDhikrTarget, setNewDhikrTarget] = useState(33);
    const [editTarget, setEditTarget] = useState(currentDhikr.recommended);
    const [isEditing, setIsEditing] = useState(false);

    // Sync count when index changes
    useEffect(() => {
        setCount(tasbihCounts[currentDhikr.name] || 0);
        setEditTarget(currentDhikr.recommended);
        // Reset edit form when switching
        setIsEditing(false);
        resetForm();
    }, [currentIndex, currentDhikr.name, tasbihCounts, currentDhikr.recommended]);

    // Save custom dhikrs
    useEffect(() => {
        localStorage.setItem('customDhikrs', JSON.stringify(dhikrs));
    }, [dhikrs]);

    // Circular Progress Calculation
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    // Calculate progress based on modulo if autoReset is off to show progress for next cycle
    const displayCount = count % currentDhikr.recommended;
    // Special handling: if count is 33 and target is 33, modulo is 0 but we want to show full circle before reset
    // Actually, simple way:
    const progressValue = autoReset ? count : (count % currentDhikr.recommended === 0 && count > 0 ? currentDhikr.recommended : count % currentDhikr.recommended);

    const progress = Math.min(progressValue, currentDhikr.recommended) / currentDhikr.recommended;
    const progressOffset = circumference - (progress * circumference);

    const resetForm = () => {
        setNewDhikrName('');
        setNewDhikrArabic('');
        setNewDhikrTranslation('');
        setNewDhikrTarget(33);
    };

    const handleCount = () => {
        let newCount = count + 1;

        if (hapticEnabled) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }

        // Check completion (every multiple of recommended)
        if (newCount > 0 && newCount % currentDhikr.recommended === 0) {
            Haptics.notification({ type: NotificationType.Success }).catch(() => {});

            addToTasbihHistory({
                dhikrName: currentDhikr.name,
                count: currentDhikr.recommended, // Log the chunk
                timestamp: new Date().toISOString()
            });
            onComplete();

            if (autoReset) {
                newCount = 0;
            }
        }

        setCount(newCount);
        updateTasbihCount(currentDhikr.name, newCount);
    };

    const handleReset = () => {
        setCount(0);
        updateTasbihCount(currentDhikr.name, 0);
        Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    };

    const handleNextDhikr = () => {
        setCurrentIndex((prev) => (prev + 1) % dhikrs.length);
    };

    const handlePrevDhikr = () => {
        setCurrentIndex((prev) => (prev - 1 + dhikrs.length) % dhikrs.length);
    };

    const handleSaveDhikr = () => {
        if (!newDhikrName) return;

        const newDhikr: Dhikr = {
            name: newDhikrName,
            arabic: newDhikrArabic || newDhikrName,
            translation: newDhikrTranslation || 'Custom Dhikr',
            transliteration: newDhikrName,
            recommended: newDhikrTarget
        };

        if (isEditing) {
            const updatedDhikrs = [...dhikrs];
            updatedDhikrs[currentIndex] = newDhikr;
            setDhikrs(updatedDhikrs);
            setIsEditing(false);
        } else {
            const updatedDhikrs = [...dhikrs, newDhikr];
            setDhikrs(updatedDhikrs);
            setCurrentIndex(updatedDhikrs.length - 1);
        }

        resetForm();
        setIsSettingsOpen(false);
    };

    const handleEditStart = () => {
        setNewDhikrName(currentDhikr.name);
        setNewDhikrArabic(currentDhikr.arabic);
        setNewDhikrTranslation(currentDhikr.translation);
        setNewDhikrTarget(currentDhikr.recommended);
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        resetForm();
    };

    const updateCurrentTarget = () => {
        const updatedDhikrs = [...dhikrs];
        updatedDhikrs[currentIndex] = { ...currentDhikr, recommended: editTarget };
        setDhikrs(updatedDhikrs);
        setIsSettingsOpen(false);
    };

    const handleDeleteDhikr = () => {
        if (dhikrs.length <= 1) return;
        const updatedDhikrs = dhikrs.filter((_, i) => i !== currentIndex);
        setDhikrs(updatedDhikrs);
        setCurrentIndex(0);
        setIsSettingsOpen(false);
    };

    return (
        <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200 selection:bg-primary/30">
            {/* Header */}
            <header className="relative z-10 flex items-center justify-between p-6 pt-8">
                <button onClick={onBack} className="flex items-center justify-center size-10 rounded-full text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <div className="flex flex-col items-center">
                    <h2 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">{t('tasbih.title')}</h2>
                    <span className="text-[10px] text-primary uppercase tracking-widest font-semibold">{t('tasbih.quickAccess')}</span>
                </div>
                <button onClick={() => setIsSettingsOpen(true)} className="flex items-center justify-center size-10 rounded-full text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined">tune</span>
                </button>
            </header>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col px-6 relative z-10 transition-all duration-300 ${isSettingsOpen || showLog ? 'blur-sm brightness-50 pointer-events-none' : ''}`}>

                {/* Info Card */}
                <div className="mb-6 relative">
                    <div className="bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl p-1 shadow-soft">
                        <div className="flex items-center justify-between p-2">
                            <button onClick={handlePrevDhikr} className="size-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <div className="flex-1 text-center px-2 py-2">
                                <h3 className="font-arabic text-2xl text-gold-accent mb-1 drop-shadow-sm">{currentDhikr.arabic}</h3>
                                <p className="text-slate-900 dark:text-white font-semibold text-lg">{currentDhikr.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentDhikr.translation}</p>
                            </div>
                            <button onClick={handleNextDhikr} className="size-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-center mt-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            {t('tasbih.targetTimes', { n: currentDhikr.recommended })}
                        </span>
                    </div>
                </div>

                {/* Circular Counter */}
                <div className="flex-1 flex flex-col items-center justify-center relative min-h-[320px]">
                    <div className="absolute w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative size-72 flex items-center justify-center">
                        {/* SVG Progress Circle */}
                        <svg className="absolute inset-0 size-full -rotate-90 transform drop-shadow-xl" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" fill="none" r="46" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-[#152820]"></circle>
                            <circle
                                className="transition-all duration-300 ease-out"
                                cx="50" cy="50" fill="none" r="46"
                                stroke="#11d483"
                                strokeDasharray={circumference}
                                strokeDashoffset={progressOffset}
                                strokeLinecap="round"
                                strokeWidth="3"
                            ></circle>
                        </svg>

                        {/* Main Button */}
                        <button
                            onClick={handleCount}
                            className="group relative size-60 rounded-full bg-gradient-to-b from-white to-gray-50 dark:from-[#1A2E25] dark:to-[#10221a] shadow-[0_8px_30px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-gray-100 dark:border-white/5 active:scale-[0.98] active:border-primary/30 transition-all duration-150 flex flex-col items-center justify-center overflow-hidden z-20 ripple-bg"
                        >
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-active:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <span className="text-7xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tighter drop-shadow-lg group-active:scale-110 transition-transform duration-100 select-none">
                                    {count}
                                </span>
                                <span className="text-gray-500 font-medium text-sm tracking-wide uppercase">{t('tasbih.count')}</span>
                                <div className="mt-2 opacity-50">
                                    <span className="material-symbols-outlined text-primary text-2xl animate-pulse">touch_app</span>
                                </div>
                            </div>
                        </button>

                        {/* Decorative Outer Ring */}
                        <div className="absolute inset-0 rounded-full border border-gray-100 dark:border-white/5 pointer-events-none"></div>
                    </div>
                </div>

                {/* Controls Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8 mx-4">
                    <button onClick={handleReset} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 active:bg-gray-300 dark:active:bg-white/15 border border-gray-100 dark:border-white/5 transition-all group">
                        <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">restart_alt</span>
                        <span className="text-[10px] uppercase font-bold text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 tracking-wider">{t('tasbih.reset')}</span>
                    </button>
                    <button onClick={() => setHapticEnabled(!hapticEnabled)} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all group active:scale-95 ${hapticEnabled ? 'bg-primary/10 border-primary/20' : 'bg-gray-100 dark:bg-white/5 border-gray-100 dark:border-white/5'}`}>
                        <span className={`material-symbols-outlined ${hapticEnabled ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>vibration</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${hapticEnabled ? 'text-primary' : 'text-gray-500'}`}>{t('tasbih.haptic')}</span>
                    </button>
                    <button onClick={() => setShowLog(true)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 active:bg-gray-300 dark:active:bg-white/15 border border-gray-100 dark:border-white/5 transition-all group">
                        <div className="relative">
                            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">history</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 tracking-wider">{t('tasbih.log')}</span>
                    </button>
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSettingsOpen(false)}></div>
                    <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">

                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('tasbih.settingsTitle')}</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto no-scrollbar space-y-6 pb-4">

                            {/* General Settings */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('tasbih.preferences')}</label>
                                {/* Auto Reset Toggle */}
                                <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">{t('tasbih.autoResetTitle')}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('tasbih.autoResetDesc')}</p>
                                    </div>
                                    <button
                                        onClick={() => setAutoReset(!autoReset)}
                                        className={`w-12 h-7 rounded-full p-1 transition-colors relative ${autoReset ? 'bg-primary' : 'bg-gray-300 dark:bg-white/10'}`}
                                    >
                                        <div className={`size-5 bg-white rounded-full shadow-sm transition-transform ${autoReset ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </button>
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 dark:bg-white/10 w-full my-4"></div>

                            {/* Target Setting */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('tasbih.currentTarget')}</label>
                                <div className="flex gap-2">
                                    {[33, 100, 1000].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setEditTarget(val)}
                                            className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors ${editTarget === val ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 bg-gray-100 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 min-w-16">{t('tasbih.custom')}</span>
                                    <input
                                        type="number"
                                        value={editTarget}
                                        onChange={(e) => setEditTarget(parseInt(e.target.value) || 0)}
                                        className="bg-transparent border-none text-slate-900 dark:text-white font-bold focus:ring-0 w-full p-0"
                                    />
                                </div>
                                <button onClick={updateCurrentTarget} className="w-full py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm border border-primary/20 hover:bg-primary/20 transition-colors">
                                    {t('tasbih.updateTargetFor', { name: currentDhikr.name })}
                                </button>
                            </div>

                            <div className="h-px bg-gray-100 dark:bg-white/10 w-full my-4"></div>

                            {/* Add/Edit Dhikr */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {isEditing ? t('tasbih.editDhikr') : t('tasbih.addNewDhikr')}
                                    </label>
                                    {isEditing && (
                                        <button onClick={cancelEdit} className="text-xs font-bold text-red-500 dark:text-red-400 hover:text-slate-900 dark:hover:text-white">{t('tasbih.cancelEdit')}</button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('tasbih.namePlaceholder')}
                                    value={newDhikrName}
                                    onChange={(e) => setNewDhikrName(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
                                />
                                <input
                                    type="text"
                                    placeholder={t('tasbih.arabicPlaceholder')}
                                    value={newDhikrArabic}
                                    onChange={(e) => setNewDhikrArabic(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3 font-arabic"
                                    dir="rtl"
                                />
                                <input
                                    type="text"
                                    placeholder={t('tasbih.meaningPlaceholder')}
                                    value={newDhikrTranslation}
                                    onChange={(e) => setNewDhikrTranslation(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
                                />
                                <input
                                    type="number"
                                    placeholder={t('tasbih.targetCountPlaceholder')}
                                    value={newDhikrTarget}
                                    onChange={(e) => setNewDhikrTarget(parseInt(e.target.value) || 33)}
                                    className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
                                />
                                <button
                                    onClick={handleSaveDhikr}
                                    disabled={!newDhikrName}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${newDhikrName ? 'bg-primary text-background-dark hover:bg-primary-dark shadow-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
                                >
                                    {isEditing ? t('tasbih.saveChanges') : t('tasbih.addDhikr')}
                                </button>
                            </div>

                            {/* Actions for Custom Dhikr */}
                            {dhikrs.length > DEFAULT_DHIKR_CONTENT.length && currentIndex >= DEFAULT_DHIKR_CONTENT.length && (
                                <>
                                    <div className="h-px bg-gray-100 dark:bg-white/10 w-full my-4"></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={handleEditStart}
                                            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold text-sm border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                            {t('tasbih.editDhikr')}
                                        </button>
                                        <button
                                            onClick={handleDeleteDhikr}
                                            className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 font-bold text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                            {t('tasbih.delete')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Log / History Modal */}
            {showLog && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowLog(false)}></div>
                    <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('tasbih.historyTitle')}</h2>
                            <button onClick={() => setShowLog(false)} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto no-scrollbar space-y-3 pb-4">
                            {tasbihHistory.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history</span>
                                    <p>{t('tasbih.noCompletionsYet')}</p>
                                </div>
                            ) : (
                                tasbihHistory.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{item.dhikrName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                                            {item.count}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tasbih;
