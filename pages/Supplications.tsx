import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PageId } from '../types';
import { Share } from '@capacitor/share';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { pushBackHandler } from '../services/backHandlerStack';
import { useUser } from '../contexts/UserContext';
import { Language, TranslationKey } from '../services/i18n';
import { SUPPLICATIONS_SHAPE, DUA_OF_THE_DAY_SHAPE, SupplicationCategoryKey } from '../data/supplicationsContent';
import { supplicationsContentEn, supplicationsTopicTitlesEn, duaOfTheDayContentEn } from '../locales/content-supplications-en';
import { supplicationsContentEs, supplicationsTopicTitlesEs, duaOfTheDayContentEs } from '../locales/content-supplications-es';

interface SupplicationsProps {
  navigate: (page: PageId) => void;
  onBack: () => void;
}

interface Dua {
  id: string;
  arabic: string;
  transliteration?: string;
  translation: string;
  reference?: string;
}

interface SupplicationTopic {
  id: string;
  title: string;
  category: SupplicationCategoryKey;
  icon: string;
  color: string; // Tailwind class, e.g., 'bg-blue-400'
  shadowColor: string; // e.g., 'shadow-blue-400/50'
  duas: Dua[];
}

// Languages without their own content-supplications-*.ts yet fall back to English, same
// fallback philosophy as the UI-chrome t() engine (services/i18n.ts) — swapped in as each
// language lands (see the translation plan).
const SUPPLICATIONS_CONTENT_BY_LANG: Partial<Record<Language, Record<string, { translation: string; reference?: string }>>> = {
  en: supplicationsContentEn,
  es: supplicationsContentEs,
};
const TOPIC_TITLES_BY_LANG: Partial<Record<Language, Record<string, string>>> = {
  en: supplicationsTopicTitlesEn,
  es: supplicationsTopicTitlesEs,
};
const DUA_OF_DAY_CONTENT_BY_LANG: Partial<Record<Language, { translation: string; reference: string; context: string }>> = {
  en: duaOfTheDayContentEn,
  es: duaOfTheDayContentEs,
};

// Rebuilds the full (shape + translated content) supplications list for the given language —
// Arabic/transliteration/icon/color never change, only the translated meaning and topic title.
const buildSupplicationsData = (language: Language): SupplicationTopic[] => {
  const content = SUPPLICATIONS_CONTENT_BY_LANG[language] ?? supplicationsContentEn;
  const titles = TOPIC_TITLES_BY_LANG[language] ?? supplicationsTopicTitlesEn;
  return SUPPLICATIONS_SHAPE.map(topic => ({
    id: topic.id,
    title: titles[topic.id] ?? supplicationsTopicTitlesEn[topic.id],
    category: topic.categoryKey,
    icon: topic.icon,
    color: topic.color,
    shadowColor: topic.shadowColor,
    duas: topic.duas.map(d => {
      const c = content[d.id] ?? supplicationsContentEn[d.id];
      return {
        id: d.id,
        arabic: d.arabic,
        transliteration: d.transliteration,
        translation: c?.translation ?? '',
        reference: c?.reference,
      };
    }),
  }));
};

const buildDuaOfTheDay = (language: Language) => {
  const c = DUA_OF_DAY_CONTENT_BY_LANG[language] ?? duaOfTheDayContentEn;
  return {
    id: DUA_OF_THE_DAY_SHAPE.id,
    arabic: DUA_OF_THE_DAY_SHAPE.arabic,
    translation: c.translation,
    ref: c.reference,
    context: c.context,
  };
};

const TRANSITION_MS = 300;

// Fade/scale a modal in one frame after it mounts, so the entrance is an actual transition
// instead of popping in already fully visible. `requestClose` mirrors that on the way out:
// it flips back to the "not entered" visual state (animating out) and only unmounts the
// modal (via the real onClose) once that transition has actually finished playing.
function useModalTransition(isOpen: boolean, onClose: () => void) {
  const [entered, setEntered] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setEntered(false);
  }, [isOpen]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setEntered(false);
    timerRef.current = window.setTimeout(onClose, TRANSITION_MS);
  };

  return { entered, requestClose };
}

// Bottom-sheet drag-to-dismiss: drag the header down to close. Needs a drag past ~70% of the
// sheet's own height (or a fast flick) so a small accidental swipe doesn't close it. Every way
// of closing — drag, the X button, tapping the backdrop — goes through requestClose, so it
// always animates out smoothly instead of the sheet just vanishing.
function useDragToDismiss(isOpen: boolean, onClose: () => void) {
  const { entered, requestClose } = useModalTransition(isOpen, onClose);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ y: 0, t: 0 });
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) setDragY(0);
  }, [isOpen]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    startRef.current = { y: e.clientY, t: Date.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setDragY(Math.max(0, e.clientY - startRef.current.y));
  };
  const endDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const duration = Math.max(1, Date.now() - startRef.current.t);
    const velocity = dragY / duration; // px per ms
    const sheetHeight = sheetRef.current?.getBoundingClientRect().height || 500;
    if (dragY > sheetHeight * 0.7 || velocity > 1.3) {
      requestClose();
    } else {
      setDragY(0);
    }
  };

  const sheetHeight = sheetRef.current?.getBoundingClientRect().height || 500;
  const exitOffset = sheetHeight + 120;
  const offsetY = entered ? dragY : exitOffset;
  const backdropOpacity = !entered ? 0 : (isDragging ? Math.max(1 - dragY / (sheetHeight * 0.7), 0.25) : 1);

  return {
    sheetRef,
    offsetY,
    backdropOpacity,
    isDragging,
    requestClose,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }
  };
}

interface DuaCardProps {
  dua: Dua;
  label?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isPlaying: boolean;
  onToggleAudio: () => void;
  onCopy: () => void;
  onShare: () => void;
}

const DuaCard: React.FC<DuaCardProps> = ({ dua, label, isFavorite, onToggleFavorite, isPlaying, onToggleAudio, onCopy, onShare }) => {
  const { t } = useUser();
  return (
    <div className="bg-gray-100 dark:bg-black/20 rounded-2xl p-4 border border-gray-200 dark:border-white/5">
      <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-white/5 pb-3">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
        <div className="flex gap-1">
          <button onClick={onCopy} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors" title={t('supplications.copy')}>
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
          </button>
          <button onClick={onShare} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors" title={t('supplications.share')}>
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>
          <button
            onClick={onToggleAudio}
            className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors ${isPlaying ? 'text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
            title={t('supplications.playAudio')}
          >
            <span className="material-symbols-outlined text-[18px]">{isPlaying ? 'stop_circle' : 'volume_up'}</span>
          </button>
          <button
            onClick={onToggleFavorite}
            className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors ${isFavorite ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'}`}
            title={t('supplications.saveToFavorites')}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
            >
              favorite
            </span>
          </button>
        </div>
      </div>
      <p className="text-right font-arabic text-2xl sm:text-3xl leading-[2.2] mb-4 text-slate-900 dark:text-white drop-shadow-sm" dir="rtl">
        {dua.arabic}
      </p>
      <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed mb-3">
        {dua.translation}
      </p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="material-symbols-outlined text-[14px] text-primary">menu_book</span>
        <span className="text-xs text-primary font-medium">{dua.reference || t('supplications.sunnahFallback')}</span>
      </div>
    </div>
  );
};

const Supplications: React.FC<SupplicationsProps> = ({ navigate, onBack }) => {
  const { t, language } = useUser();
  const [activeCategory, setActiveCategory] = useState<'All' | 'Favorites' | SupplicationCategoryKey>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'az'>('default');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SupplicationTopic | null>(null);
  const [selectedFavoriteDua, setSelectedFavoriteDua] = useState<{ dua: Dua; topic: SupplicationTopic | null } | null>(null);
  const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
  const activeSpeechRef = useRef<string | null>(null);

  const SUPPLICATIONS_DATA = useMemo(() => buildSupplicationsData(language), [language]);
  const DuaOfTheDay = useMemo(() => buildDuaOfTheDay(language), [language]);

  // Two independent favorite lists: whole topics (grouped duas) and individual duas,
  // so a single dua can be saved even if the rest of its group isn't.
  const [favoriteTopicIds, setFavoriteTopicIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('favoriteTopicIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [favoriteDuaIds, setFavoriteDuaIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('favoriteDuaIds');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('favoriteTopicIds', JSON.stringify(favoriteTopicIds));
  }, [favoriteTopicIds]);

  useEffect(() => {
    localStorage.setItem('favoriteDuaIds', JSON.stringify(favoriteDuaIds));
  }, [favoriteDuaIds]);

  // Stop any in-progress speech when the screen unmounts.
  useEffect(() => {
    return () => {
      TextToSpeech.stop().catch(() => {});
    };
  }, []);

  // Lock background scroll while a modal is open, without touching this page's own layout
  // (changing this component's own height/overflow classes was squashing its content).
  useEffect(() => {
    const isModalOpen = !!selectedTopic || !!selectedFavoriteDua;
    document.body.style.overflow = isModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedTopic, selectedFavoriteDua]);

  const toggleFavoriteTopic = (topicId: string) => {
    setFavoriteTopicIds(prev => prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]);
  };

  const toggleFavoriteDua = (duaId: string) => {
    setFavoriteDuaIds(prev => prev.includes(duaId) ? prev.filter(id => id !== duaId) : [...prev, duaId]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // In a real app, show a toast here
  };

  // The system WebView doesn't implement navigator.share, so this goes through the
  // native Capacitor Share plugin instead (opens the real Android share sheet).
  const shareDua = (dua: Dua, groupTitle?: string) => {
    Share.share({
      title: groupTitle || t('supplications.duaFallbackTitle'),
      text: `${dua.arabic}\n\n${dua.translation}\n\n${t('supplications.referenceLabel', { reference: dua.reference || t('supplications.sunnahFallback') })}`,
    }).catch(() => {});
  };

  // The WebView's speechSynthesis is unreliable for Arabic, so this uses the native
  // Capacitor Text-to-Speech plugin (same reasoning as the speech-recognition plugin).
  const toggleAudio = async (dua: Dua) => {
    if (playingDuaId === dua.id) {
      activeSpeechRef.current = null;
      setPlayingDuaId(null);
      await TextToSpeech.stop();
      return;
    }
    activeSpeechRef.current = dua.id;
    setPlayingDuaId(dua.id);
    await TextToSpeech.stop();
    try {
      await TextToSpeech.speak({ text: dua.arabic, lang: 'ar-SA', rate: 0.75, pitch: 1.0, volume: 1.0, category: 'ambient' });
    } catch {
      // no Arabic voice installed on this device, or playback failed
    } finally {
      if (activeSpeechRef.current === dua.id) {
        setPlayingDuaId(null);
      }
    }
  };

  const categories: { key: 'All' | 'Favorites' | SupplicationCategoryKey; labelKey: TranslationKey }[] = [
    { key: 'All', labelKey: 'supplications.categoryAll' },
    { key: 'Favorites', labelKey: 'supplications.categoryFavorites' },
    { key: 'routine', labelKey: 'supplications.categoryRoutine' },
    { key: 'morningEvening', labelKey: 'supplications.categoryMorningEvening' },
    { key: 'emotion', labelKey: 'supplications.categoryEmotion' },
    { key: 'sleep', labelKey: 'supplications.categorySleep' },
    { key: 'travel', labelKey: 'supplications.categoryTravel' },
    { key: 'knowledge', labelKey: 'supplications.categoryKnowledge' },
    { key: 'family', labelKey: 'supplications.categoryFamily' },
    { key: 'worship', labelKey: 'supplications.categoryWorship' },
  ];

  // Local "topic detection" for search: if the query isn't a literal match on any title/
  // translation, fall back to matching it against a curated set of related words per
  // category, so e.g. searching "anxious" still surfaces the Emotion group's duas. Keyed
  // by categoryKey now (not the old English display string).
  const CATEGORY_KEYWORDS: Record<SupplicationCategoryKey, string[]> = {
    emotion: ['sad', 'sadness', 'anxious', 'anxiety', 'worried', 'worry', 'fear', 'afraid', 'angry', 'anger', 'stress', 'stressed', 'grief', 'sorrow', 'upset', 'nervous', 'hardship', 'difficult', 'depressed', 'distress'],
    sleep: ['sleep', 'bed', 'bedtime', 'night', 'rest', 'insomnia', 'nightmare', 'dream'],
    travel: ['travel', 'trip', 'journey', 'flight', 'drive', 'driving', 'car', 'road', 'vacation'],
    knowledge: ['knowledge', 'study', 'studying', 'learn', 'learning', 'exam', 'school', 'wisdom', 'understanding', 'memorize'],
    family: ['family', 'parents', 'children', 'kids', 'spouse', 'marriage', 'wife', 'husband', 'relatives'],
    worship: ['worship', 'prayer', 'salah', 'ibadah', 'dhikr', 'remembrance', 'mosque'],
    morningEvening: ['morning', 'evening', 'dawn', 'dusk', 'sunrise', 'sunset', 'wake', 'waking'],
    routine: ['daily', 'habit', 'routine', 'everyday', 'regular'],
  };

  // Flat list of individually-favorited duas, with a reference back to their parent topic.
  const favoriteDuas = useMemo(() => {
    const fromTopics = SUPPLICATIONS_DATA.flatMap(topic =>
      topic.duas
        .filter(dua => favoriteDuaIds.includes(dua.id))
        .map(dua => ({ dua, topic }))
    );
    if (favoriteDuaIds.includes(DuaOfTheDay.id)) {
      fromTopics.push({
        dua: { id: DuaOfTheDay.id, arabic: DuaOfTheDay.arabic, translation: DuaOfTheDay.translation, reference: DuaOfTheDay.ref },
        topic: null as unknown as SupplicationTopic
      });
    }
    return fromTopics;
  }, [favoriteDuaIds, SUPPLICATIONS_DATA, DuaOfTheDay]);

  const favoriteTopics = useMemo(
    () => SUPPLICATIONS_DATA.filter(topic => favoriteTopicIds.includes(topic.id)),
    [favoriteTopicIds, SUPPLICATIONS_DATA]
  );

  // Filter Logic
  const filteredTopics = useMemo(() => {
    let result: SupplicationTopic[];
    if (activeCategory === 'Favorites') {
      result = favoriteTopics;
    } else {
      const query = searchQuery.trim().toLowerCase();
      result = SUPPLICATIONS_DATA.filter(topic => {
        const matchesLiteral = query === '' ||
          topic.title.toLowerCase().includes(query) ||
          topic.duas.some(d => d.translation.toLowerCase().includes(query));
        const matchesTopicKeyword = query !== '' &&
          (CATEGORY_KEYWORDS[topic.category] ?? []).some(kw => kw.includes(query) || query.includes(kw));
        const matchesSearch = matchesLiteral || matchesTopicKeyword;
        const matchesCategory = activeCategory === 'All' || topic.category === activeCategory;

        return matchesSearch && matchesCategory;
      });
    }
    if (sortMode === 'az') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [searchQuery, activeCategory, favoriteTopics, sortMode, SUPPLICATIONS_DATA]);

  const topicDrag = useDragToDismiss(!!selectedTopic, () => setSelectedTopic(null));
  const favDuaModal = useModalTransition(!!selectedFavoriteDua, () => setSelectedFavoriteDua(null));

  // Back button/gesture closes these modals (with the same animation as the X button)
  // instead of navigating away from the page.
  useEffect(() => {
    if (!selectedTopic) return;
    return pushBackHandler(() => {
      topicDrag.requestClose();
      return true;
    });
  }, [selectedTopic]);

  useEffect(() => {
    if (!selectedFavoriteDua) return;
    return pushBackHandler(() => {
      favDuaModal.requestClose();
      return true;
    });
  }, [selectedFavoriteDua]);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto pb-28 bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200">
      <header className="flex items-center justify-between p-6 pt-8 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-100 dark:border-white/5 transition-colors">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t('supplications.title')}</h1>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('supplications.subtitle')}</span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsSortMenuOpen(o => !o)}
            className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-100 dark:border-white/5 transition-colors"
          >
            <span className="material-symbols-outlined">tune</span>
          </button>
          {isSortMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)}></div>
              <div className="absolute right-0 top-12 z-50 w-44 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                {([
                  { key: 'default', labelKey: 'supplications.sortDefault' },
                  { key: 'az', labelKey: 'supplications.sortAZ' },
                ] as { key: 'default' | 'az'; labelKey: TranslationKey }[]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortMode(opt.key); setIsSortMenuOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${sortMode === opt.key ? 'bg-primary/10 text-primary' : 'text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    {t(opt.labelKey)}
                    {sortMode === opt.key && <span className="material-symbols-outlined text-[18px]">check</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="px-6 mb-6">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">search</span>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-12 pr-4 py-3.5 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm shadow-soft"
            placeholder={t('supplications.searchPlaceholder')}
            type="text"
          />
        </div>
      </div>

      <div className="flex gap-2 px-6 pb-6 overflow-x-auto no-scrollbar mask-gradient-right">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${activeCategory === cat.key
              ? 'bg-primary text-white font-semibold shadow-glow'
              : 'bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            {cat.key === 'Favorites' && <span className="material-symbols-outlined text-[16px] text-red-400 filled" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>}
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      <div className="px-6 flex flex-col gap-5">
        {/* Dua of the Day Card */}
        {activeCategory === 'All' && !searchQuery && (
          <div className="relative w-full rounded-2xl overflow-hidden shadow-soft border border-white/5 bg-gradient-to-br from-card-dark to-[#0f241d] text-white group">
            <div className="absolute -top-10 -right-10 size-32 bg-primary/10 rounded-full blur-2xl"></div>
            <div className="relative p-6 z-10">
              <div className="flex justify-between items-start mb-5">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full border border-primary/10 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-primary text-[14px]">light_mode</span>
                  <span className="text-[10px] uppercase tracking-wide font-bold text-primary">{t('supplications.duaOfTheDay')}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => copyToClipboard(DuaOfTheDay.arabic + ' ' + DuaOfTheDay.translation)}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title={t('supplications.copy')}
                  >
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  </button>
                  <button
                    onClick={() => shareDua({ id: DuaOfTheDay.id, arabic: DuaOfTheDay.arabic, translation: DuaOfTheDay.translation, reference: DuaOfTheDay.ref }, t('supplications.duaOfTheDay'))}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title={t('supplications.share')}
                  >
                    <span className="material-symbols-outlined text-[20px]">share</span>
                  </button>
                  <button
                    onClick={() => toggleAudio({ id: DuaOfTheDay.id, arabic: DuaOfTheDay.arabic, translation: DuaOfTheDay.translation, reference: DuaOfTheDay.ref })}
                    className={`p-1 transition-colors ${playingDuaId === DuaOfTheDay.id ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                    title={t('supplications.playAudio')}
                  >
                    <span className="material-symbols-outlined text-[20px]">{playingDuaId === DuaOfTheDay.id ? 'stop_circle' : 'volume_up'}</span>
                  </button>
                  <button
                    onClick={() => toggleFavoriteDua(DuaOfTheDay.id)}
                    className={`p-1 transition-colors ${favoriteDuaIds.includes(DuaOfTheDay.id) ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: favoriteDuaIds.includes(DuaOfTheDay.id) ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      favorite
                    </span>
                  </button>
                </div>
              </div>
              <p className="text-right font-arabic text-3xl leading-loose mb-5 text-white drop-shadow-sm">
                {DuaOfTheDay.arabic}
              </p>
              <p className="text-gray-300 text-sm leading-relaxed mb-4 italic font-medium">
                {DuaOfTheDay.translation}
              </p>
              <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-500 text-[16px]">menu_book</span>
                  <span className="text-xs text-gray-400 font-medium">{DuaOfTheDay.ref}</span>
                </div>
                <button className="text-primary text-xs font-bold hover:underline">{t('supplications.readContext')}</button>
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'All' && !searchQuery && <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-2">{t('supplications.recommendedForYou')}</h2>}
        {activeCategory === 'Favorites' && filteredTopics.length > 0 && <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-2">{t('supplications.savedGroups')}</h2>}

        {filteredTopics.length > 0 ? (
          filteredTopics.map((topic) => (
            <div
              key={topic.id}
              onClick={() => setSelectedTopic(topic)}
              className="bg-white dark:bg-card-dark rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm hover:border-gray-200 dark:hover:border-white/10 transition-all cursor-pointer group active:scale-[0.99]"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${topic.color} ${topic.shadowColor}`}></div>
                  <h3 className="text-slate-900 dark:text-white font-semibold text-sm">{topic.title}</h3>
                  {topic.duas.length > 1 && (
                    <span className="bg-gray-100 dark:bg-white/10 text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">{topic.duas.length}</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavoriteTopic(topic.id); }}
                  className={`transition-colors ${favoriteTopicIds.includes(topic.id) ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-600 group-hover:text-red-500 dark:group-hover:text-red-400'}`}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: favoriteTopicIds.includes(topic.id) ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    favorite
                  </span>
                </button>
              </div>
              {/* Show first dua as preview */}
              <p className="text-right font-arabic text-2xl leading-relaxed mb-3 text-gray-700 dark:text-gray-100">
                {topic.duas[0].arabic}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-0 line-clamp-2">
                "{topic.duas[0].translation}"
              </p>
            </div>
          ))
        ) : activeCategory !== 'Favorites' || favoriteDuas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <span className="material-symbols-outlined text-4xl mb-2">
              {activeCategory === 'Favorites' ? 'favorite_border' : 'search_off'}
            </span>
            <p>{activeCategory === 'Favorites' ? t('supplications.noSavedDuas') : t('supplications.noSupplicationsFound')}</p>
          </div>
        ) : null}

        {activeCategory === 'Favorites' && favoriteDuas.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-2">{t('supplications.savedDuas')}</h2>
            {favoriteDuas.map(({ dua, topic }) => (
              <div
                key={dua.id}
                onClick={() => setSelectedFavoriteDua({ dua, topic })}
                className="bg-white dark:bg-card-dark rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm hover:border-gray-200 dark:hover:border-white/10 transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    {topic && <div className={`size-2 rounded-full ${topic.color} ${topic.shadowColor}`}></div>}
                    <h3 className="text-slate-900 dark:text-white font-semibold text-sm">{topic ? topic.title : t('supplications.duaOfTheDay')}</h3>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavoriteDua(dua.id); }}
                    className="text-red-500 dark:text-red-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                  </button>
                </div>
                <p className="text-right font-arabic text-2xl leading-relaxed mb-3 text-gray-700 dark:text-gray-100">
                  {dua.arabic}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-2">
                  "{dua.translation}"
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-primary">menu_book</span>
                  <span className="text-xs text-primary font-medium">{dua.reference || t('supplications.sunnahFallback')}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Detail Modal - whole topic group (bottom sheet, drag down to dismiss) */}
      {selectedTopic && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{
              opacity: topicDrag.backdropOpacity,
              transition: topicDrag.isDragging ? 'none' : 'opacity 0.3s ease'
            }}
            onClick={topicDrag.requestClose}
          ></div>
          <div
            ref={topicDrag.sheetRef}
            className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-0 shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-white/10"
            style={{
              transform: `translateY(${topicDrag.offsetY}px)`,
              transition: topicDrag.isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
            }}
          >
            {/* Modal Header - drag down to dismiss */}
            <div
              className="p-6 pb-2 shrink-0 bg-white dark:bg-[#1a2e25] z-10 touch-none cursor-grab active:cursor-grabbing"
              {...topicDrag.handlers}
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-6 shrink-0 opacity-50"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-full ${selectedTopic.color} flex items-center justify-center text-white shadow-glow`}>
                    <span className="material-symbols-outlined">{selectedTopic.icon}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedTopic.title}</h2>
                    <span className="text-xs text-primary font-medium">
                      {selectedTopic.duas.length} {selectedTopic.duas.length > 1 ? t('supplications.supplicationsPlural') : t('supplications.supplicationSingular')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={topicDrag.requestClose}
                  className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable List */}
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6 no-scrollbar">
              {selectedTopic.duas.map((dua, index) => (
                <DuaCard
                  key={dua.id}
                  dua={dua}
                  label={t('supplications.duaNumber', { n: index + 1 })}
                  isFavorite={favoriteDuaIds.includes(dua.id)}
                  onToggleFavorite={() => toggleFavoriteDua(dua.id)}
                  isPlaying={playingDuaId === dua.id}
                  onToggleAudio={() => toggleAudio(dua)}
                  onCopy={() => copyToClipboard(dua.arabic + ' ' + dua.translation)}
                  onShare={() => shareDua(dua, selectedTopic.title)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal - single saved dua: a compact centered card, not a full sheet */}
      {selectedFavoriteDua && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ opacity: favDuaModal.entered ? 1 : 0, transition: 'opacity 0.3s ease' }}
            onClick={favDuaModal.requestClose}
          ></div>
          <div
            className="relative w-full max-w-sm bg-white dark:bg-[#1a2e25] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden max-h-[80vh] flex flex-col"
            style={{
              opacity: favDuaModal.entered ? 1 : 0,
              transform: favDuaModal.entered ? 'scale(1)' : 'scale(0.92)',
              transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
            }}
          >
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                {selectedFavoriteDua.topic ? (
                  <div className={`size-8 rounded-full ${selectedFavoriteDua.topic.color} flex items-center justify-center text-white shadow-glow`}>
                    <span className="material-symbols-outlined text-[16px]">{selectedFavoriteDua.topic.icon}</span>
                  </div>
                ) : (
                  <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-glow">
                    <span className="material-symbols-outlined text-[16px]">light_mode</span>
                  </div>
                )}
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedFavoriteDua.topic ? selectedFavoriteDua.topic.title : t('supplications.duaOfTheDay')}
                </h2>
              </div>
              <button
                onClick={favDuaModal.requestClose}
                className="flex items-center justify-center size-7 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <div className="px-5 pb-5 overflow-y-auto no-scrollbar">
              <DuaCard
                dua={selectedFavoriteDua.dua}
                isFavorite={favoriteDuaIds.includes(selectedFavoriteDua.dua.id)}
                onToggleFavorite={() => toggleFavoriteDua(selectedFavoriteDua.dua.id)}
                isPlaying={playingDuaId === selectedFavoriteDua.dua.id}
                onToggleAudio={() => toggleAudio(selectedFavoriteDua.dua)}
                onCopy={() => copyToClipboard(selectedFavoriteDua.dua.arabic + ' ' + selectedFavoriteDua.dua.translation)}
                onShare={() => shareDua(selectedFavoriteDua.dua, selectedFavoriteDua.topic?.title)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[400px] z-50">
        <nav className="bg-white/95 dark:bg-[#1A2E25] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-gray-200 dark:border-white/10 p-2 flex justify-between items-center px-6">
          <button onClick={() => navigate('dashboard')} className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">home</span>
          </button>
          <button onClick={() => navigate('chat')} className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined">chat_bubble</span>
          </button>
          <button className="relative -top-6 bg-primary text-white rounded-full size-14 shadow-glow flex items-center justify-center border-4 border-background-light dark:border-background-dark transform transition-transform hover:scale-105 active:scale-95">
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>add</span>
          </button>
          <button onClick={() => navigate('community')} className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined">groups</span>
          </button>
          <button onClick={() => navigate('profile')} className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined">person</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Supplications;
