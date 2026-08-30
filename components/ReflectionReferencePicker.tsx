import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QuranReference, Surah } from '../types';
import { useUser } from '../contexts/UserContext';
import { getAllSurahs, getAyahTranslations, getSurahNameMeaning } from '../services/quranService';
import { pushBackHandler } from '../services/backHandlerStack';

interface ReflectionReferencePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (ref: QuranReference) => void;
    existing: QuranReference[];
}

// Two-step bottom sheet: pick a surah, then its ayah — the ayah step shows the translated
// text of every verse so you can choose the right one even without remembering the number.
// Mirrors the app's FormSheet shell (AdhanFormSheet / IconPickerSheet).
const ReflectionReferencePicker: React.FC<ReflectionReferencePickerProps> = ({ isOpen, onClose, onAdd, existing }) => {
    const { t, language } = useUser();

    const [surahs, setSurahs] = useState<Surah[]>([]);
    const [surahLoading, setSurahLoading] = useState(false);
    const [surahError, setSurahError] = useState(false);
    const [surahQuery, setSurahQuery] = useState('');

    const [picked, setPicked] = useState<Surah | null>(null);
    const [ayahs, setAyahs] = useState<{ numberInSurah: number; text: string }[]>([]);
    const [ayahLoading, setAyahLoading] = useState(false);
    const [ayahError, setAyahError] = useState(false);
    const [ayahQuery, setAyahQuery] = useState('');

    const surahSeq = useRef(0);
    const ayahSeq = useRef(0);

    const loadSurahs = () => {
        setSurahLoading(true);
        setSurahError(false);
        const seq = ++surahSeq.current;
        getAllSurahs()
            .then(list => {
                if (seq !== surahSeq.current) return;
                if (list.length === 0) setSurahError(true);
                else setSurahs(list);
            })
            .catch(() => { if (seq === surahSeq.current) setSurahError(true); })
            .finally(() => { if (seq === surahSeq.current) setSurahLoading(false); });
    };

    const loadAyahs = (surah: Surah) => {
        setAyahLoading(true);
        setAyahError(false);
        setAyahs([]);
        const seq = ++ayahSeq.current;
        getAyahTranslations(surah.number, language)
            .then(list => {
                if (seq !== ayahSeq.current) return;
                if (list.length === 0) setAyahError(true);
                else setAyahs(list);
            })
            .catch(() => { if (seq === ayahSeq.current) setAyahError(true); })
            .finally(() => { if (seq === ayahSeq.current) setAyahLoading(false); });
    };

    useEffect(() => {
        if (!isOpen) return;
        setSurahQuery('');
        setAyahQuery('');
        setPicked(null);
        if (surahs.length === 0) loadSurahs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Hardware back: step 2 → step 1, else close.
    useEffect(() => {
        if (!isOpen) return;
        return pushBackHandler(() => {
            if (picked) { setPicked(null); return true; }
            onClose();
            return true;
        });
    }, [isOpen, picked, onClose]);

    const filteredSurahs = useMemo(() => {
        const q = surahQuery.trim().toLowerCase();
        if (!q) return surahs;
        return surahs.filter(s =>
            s.englishName.toLowerCase().includes(q) ||
            s.englishNameTranslation.toLowerCase().includes(q) ||
            String(s.number) === q
        );
    }, [surahs, surahQuery]);

    const filteredAyahs = useMemo(() => {
        const q = ayahQuery.trim().toLowerCase();
        if (!q) return ayahs;
        if (/^\d+$/.test(q)) return ayahs.filter(a => String(a.numberInSurah) === q || String(a.numberInSurah).startsWith(q));
        return ayahs.filter(a => a.text.toLowerCase().includes(q));
    }, [ayahs, ayahQuery]);

    if (!isOpen) return null;

    const isDuplicate = (n: number) =>
        !!picked && existing.some(r => r.surahNumber === picked.number && r.ayahNumber === n);

    const choose = (n: number, text: string) => {
        if (!picked || isDuplicate(n)) return;
        onAdd({ surahNumber: picked.number, surahName: picked.englishName, ayahNumber: n, ayahText: text });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-md h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        {picked && (
                            <button onClick={() => setPicked(null)} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0">
                                <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                            {picked ? picked.englishName : t('reflections.pickSurah')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                </div>

                {!picked ? (
                    <>
                        <div className="relative mb-3 shrink-0">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-lg">search</span>
                            <input
                                type="text"
                                value={surahQuery}
                                onChange={(e) => setSurahQuery(e.target.value)}
                                placeholder={t('quran.searchPlaceholder')}
                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary py-2.5 pl-10 pr-3 text-sm"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar -mx-1 px-1">
                            {surahLoading && (
                                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                                    <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    {t('quran.loadingSurahs')}
                                </div>
                            )}
                            {surahError && !surahLoading && (
                                <div className="flex flex-col items-center gap-3 py-10 text-center">
                                    <span className="material-symbols-outlined text-3xl text-gray-400">cloud_off</span>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('reflections.surahLoadError')}</p>
                                    <button onClick={loadSurahs} className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors">
                                        {t('reflections.retry')}
                                    </button>
                                </div>
                            )}
                            {!surahLoading && !surahError && filteredSurahs.map(s => (
                                <button
                                    key={s.number}
                                    onClick={() => { setPicked(s); setAyahQuery(''); loadAyahs(s); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-primary text-xs font-bold">{s.number}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-bold text-slate-900 dark:text-white text-sm truncate">{s.englishName}</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {getSurahNameMeaning(s, language)} · {s.numberOfAyahs}
                                        </span>
                                    </span>
                                    <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">chevron_right</span>
                                </button>
                            ))}
                            {!surahLoading && !surahError && filteredSurahs.length === 0 && (
                                <div className="flex flex-col items-center py-10 text-gray-500">
                                    <span className="material-symbols-outlined text-3xl mb-2">search_off</span>
                                    <p className="text-sm">{t('quran.noSurahsFound')}</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="relative mb-3 shrink-0">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-lg">search</span>
                            <input
                                type="text"
                                value={ayahQuery}
                                onChange={(e) => setAyahQuery(e.target.value)}
                                placeholder={t('reflections.searchAyah')}
                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary py-2.5 pl-10 pr-3 text-sm"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-1.5">
                            {ayahLoading && (
                                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                                    <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    {t('quran.loading')}
                                </div>
                            )}
                            {ayahError && !ayahLoading && (
                                <div className="flex flex-col items-center gap-3 py-10 text-center">
                                    <span className="material-symbols-outlined text-3xl text-gray-400">cloud_off</span>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('reflections.surahLoadError')}</p>
                                    <button onClick={() => picked && loadAyahs(picked)} className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors">
                                        {t('reflections.retry')}
                                    </button>
                                </div>
                            )}
                            {!ayahLoading && !ayahError && filteredAyahs.map(a => {
                                const dup = isDuplicate(a.numberInSurah);
                                return (
                                    <button
                                        key={a.numberInSurah}
                                        onClick={() => choose(a.numberInSurah, a.text)}
                                        disabled={dup}
                                        className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${dup ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                    >
                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-primary text-xs font-bold mt-0.5">{a.numberInSurah}</span>
                                        <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{a.text}</span>
                                        {dup && <span className="text-[10px] font-bold text-gray-400 shrink-0 mt-1">{t('reflections.refAlreadyAdded')}</span>}
                                    </button>
                                );
                            })}
                            {!ayahLoading && !ayahError && filteredAyahs.length === 0 && (
                                <div className="flex flex-col items-center py-10 text-gray-500">
                                    <span className="material-symbols-outlined text-3xl mb-2">search_off</span>
                                    <p className="text-sm">{t('reflections.noResults')}</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReflectionReferencePicker;
