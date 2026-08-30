
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { PageId, Surah, Ayah } from '../types';
import { getAllSurahs, getSurahDetails, getSurahTafsir, getSurahNameMeaning, RECITERS, Reciter } from '../services/quranService';
import { audioEngine } from '../services/audioEngine';
import { pushBackHandler } from '../services/backHandlerStack';
import {
  consumePendingQuranTarget,
  consumeReturnToReflectionId,
  setPendingReflectionDraft,
  setPendingOpenReflectionId,
} from '../services/reflectionsNav';
import { CapacitorMusicControls } from 'capacitor-music-controls-plugin';
import { useUser } from '../contexts/UserContext';

interface QuranProps {
  navigate: (page: PageId) => void;
  onBack: () => void;
  onRead: () => void;
  // The bottom nav is hoisted up to App.tsx now — this lets the reader (an immersive
  // sub-view) hide it, since App.tsx has no visibility into this page's internal `view` state.
  setNavHidden?: (hidden: boolean) => void;
}

interface QuranSettings {
  reciterId: string;
  playbackSpeed: number;
  repeatVerse: boolean;
  repeatMode: 'Off' | 'Surah' | 'Range';
  repeatRangeStart: number;
  repeatRangeEnd: number;
  audioTranslation: boolean;
  autoNextSurah: boolean;
  autoScroll: boolean;
  showTransliteration: boolean;
}

const DEFAULT_SETTINGS: QuranSettings = {
  reciterId: 'ar.alafasy',
  playbackSpeed: 1.0,
  repeatVerse: false,
  repeatMode: 'Off',
  repeatRangeStart: 1,
  repeatRangeEnd: 10,
  audioTranslation: true,
  autoNextSurah: false,
  autoScroll: true,
  showTransliteration: true,
};

interface AyahData {
  arabic: Ayah;
  translation: Ayah;
  transliteration: Ayah;
  audio: Ayah;
}

interface LastRead {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
}

interface BookmarkedAyah {
  id: string; // `${surahNumber}:${ayahNumberInSurah}`
  surahNumber: number;
  surahName: string;
  ayahNumberInSurah: number;
  arabic: string;
  translation: string;
  savedAt: number;
}

type BookmarkSort = 'quran' | 'custom';

const Quran: React.FC<QuranProps> = ({ navigate, onBack, onRead, setNavHidden }) => {
  const { t, language } = useUser();
  const [view, setView] = useState<'index' | 'reader'>('index');

  // The reader is an immersive full-screen sub-view — hide the (now hoisted) bottom nav
  // while it's open, same as before when this page rendered its own <BottomNav> only in index.
  useEffect(() => {
    setNavHidden?.(view === 'reader');
    return () => setNavHidden?.(false);
  }, [view, setNavHidden]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReciterListOpen, setIsReciterListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSurah, setLoadingSurah] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Debounced so mid-typing artifacts (Android predictive-text/autocorrect keyboards can
  // briefly fire an intermediate value that matches nothing) don't flash "No surahs found".
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // UseMemo for filtering to prevent double-renders and improve performance
  const filteredSurahs = React.useMemo(() => {
    if (!isSearchOpen || debouncedSearchQuery.trim() === '') return surahs;
    const lower = debouncedSearchQuery.toLowerCase();
    return surahs.filter(s =>
      s.englishName.toLowerCase().includes(lower) ||
      s.name.includes(lower) ||
      s.englishNameTranslation.toLowerCase().includes(lower) ||
      getSurahNameMeaning(s, language).toLowerCase().includes(lower) ||
      s.number.toString().includes(lower)
    );
  }, [surahs, debouncedSearchQuery, isSearchOpen, language]);

  // A second, longer gate before actually showing "No surahs found" — the debounce above
  // can still settle on a bad transient value from IME/autocorrect churn, so we hold off
  // rendering the empty state (keeping the last real list on screen) until it's genuinely stable.
  const [showNoResults, setShowNoResults] = useState(false);
  useEffect(() => {
    if (isSearchOpen && debouncedSearchQuery.trim() !== '' && filteredSurahs.length === 0) {
      const timer = setTimeout(() => setShowNoResults(true), 300);
      return () => clearTimeout(timer);
    }
    setShowNoResults(false);
  }, [filteredSurahs, isSearchOpen, debouncedSearchQuery]);

  // Settings
  const [savedSettings, setSavedSettings] = useState<QuranSettings>(DEFAULT_SETTINGS);
  const [tempSettings, setTempSettings] = useState<QuranSettings>(DEFAULT_SETTINGS);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [persistedDefaults, setPersistedDefaults] = useState<QuranSettings>(DEFAULT_SETTINGS);

  // Load Persisted Defaults
  useEffect(() => {
    try {
      const stored = localStorage.getItem('quranUserDefaults');
      if (stored) {
        setPersistedDefaults({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (e) { }
  }, []);

  // Reader State
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<AyahData[]>([]);

  // Last Read State
  const [lastRead, setLastRead] = useState<LastRead | null>(null);

  // Bookmarked Ayahs
  const [bookmarks, setBookmarks] = useState<BookmarkedAyah[]>(() => {
    const saved = localStorage.getItem('quranBookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [bookmarkOrder, setBookmarkOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('quranBookmarkOrder');
    return saved ? JSON.parse(saved) : [];
  });
  const [bookmarkSort, setBookmarkSort] = useState<BookmarkSort>(() => {
    const stored = localStorage.getItem('quranBookmarkSort');
    return stored === 'custom' ? 'custom' : 'quran';
  });
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null);
  const [isBookmarkReorderMode, setIsBookmarkReorderMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('quranBookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('quranBookmarkSort', bookmarkSort);
  }, [bookmarkSort]);

  // Keep the custom order in sync with the actual bookmark set: drop stale ids,
  // append newly-added ones at the end.
  useEffect(() => {
    setBookmarkOrder(prev => {
      const ids = bookmarks.map(b => b.id);
      const kept = prev.filter(id => ids.includes(id));
      const missing = ids.filter(id => !kept.includes(id));
      const next = [...kept, ...missing];
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('quranBookmarkOrder', JSON.stringify(bookmarkOrder));
  }, [bookmarkOrder]);

  const toggleBookmark = (v: AyahData) => {
    if (!currentSurah) return;
    const id = `${currentSurah.number}:${v.arabic.numberInSurah}`;
    const exists = bookmarks.some(b => b.id === id);
    if (exists) {
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } else {
      setBookmarks(prev => [...prev, {
        id,
        surahNumber: currentSurah.number,
        surahName: currentSurah.englishName,
        ayahNumberInSurah: v.arabic.numberInSurah,
        arabic: v.arabic.text,
        translation: v.translation.text,
        savedAt: Date.now()
      }]);
    }
  };

  const sortedBookmarks = React.useMemo(() => {
    if (bookmarkSort === 'quran') {
      return [...bookmarks].sort((a, b) => a.surahNumber - b.surahNumber || a.ayahNumberInSurah - b.ayahNumberInSurah);
    }
    const byId = new Map(bookmarks.map(b => [b.id, b]));
    return bookmarkOrder.map(id => byId.get(id)).filter((b): b is BookmarkedAyah => !!b);
  }, [bookmarks, bookmarkOrder, bookmarkSort]);

  const openBookmark = (b: BookmarkedAyah) => {
    const surah = surahs.find(s => s.number === b.surahNumber);
    if (surah) {
      setIsBookmarksOpen(false);
      handleSurahSelect(surah, b.ayahNumberInSurah - 1);
    }
  };

  // Reorder drag: the dragged row is pulled OUT of the normal list entirely (so it can't
  // leave a gap behind) and rendered as a floating overlay that tracks the finger. The
  // remaining rows reorder underneath and FLIP-ease into their new spot as you cross them.
  const bookmarkRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const bookmarkPrevRects = useRef<Map<string, DOMRect>>(new Map());
  const dragStartYRef = useRef(0);
  // Without this, hovering steadily over one row would re-trigger the swap on every
  // pointermove — and since the target's own index flips depending on whether the dragged
  // item currently sits before or after it, that re-triggering oscillated back and forth
  // forever instead of settling, which is what made this feel so broken.
  const lastSwapTargetRef = useRef<string | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const dragDeltaYRef = useRef(0); // live value for the pointerup handler's closure
  const [dragOriginRect, setDragOriginRect] = useState<DOMRect | null>(null);

  const handleBookmarkPointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    const rowEl = bookmarkRowRefs.current.get(id);
    setDragOriginRect(rowEl ? rowEl.getBoundingClientRect() : null);
    setDraggingBookmarkId(id);
    setDragDeltaY(0);
    dragDeltaYRef.current = 0;
    lastSwapTargetRef.current = null;
    dragStartYRef.current = e.clientY;
  };

  // The dragged row is removed from the list as soon as dragging starts (see the filter()
  // in the render below), which would also unmount the handle button that received the
  // pointerdown — taking any pointer capture and onPointerMove/Up handlers on it down with
  // it. Tracking the drag on `window` instead keeps it alive for the whole gesture.
  useEffect(() => {
    if (!draggingBookmarkId) return;
    const draggedId = draggingBookmarkId;
    const originRect = dragOriginRect;

    const handleMove = (e: PointerEvent) => {
      const delta = e.clientY - dragStartYRef.current;
      dragDeltaYRef.current = delta;
      setDragDeltaY(delta);

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest('[data-bookmark-id]') as HTMLElement | null;
      const targetId = row?.getAttribute('data-bookmark-id');
      if (!targetId || targetId === draggedId || targetId === lastSwapTargetRef.current) return;
      lastSwapTargetRef.current = targetId;

      // First: capture where the (non-dragged) rows currently are, before the swap moves them.
      const rects = new Map<string, DOMRect>();
      bookmarkRowRefs.current.forEach((rowEl, rowId) => rects.set(rowId, rowEl.getBoundingClientRect()));
      bookmarkPrevRects.current = rects;

      setBookmarkOrder(prev => {
        const fromIdx = prev.indexOf(draggedId);
        const toIdx = prev.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const updated = [...prev];
        updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, draggedId);
        return updated;
      });
    };

    const handleUp = () => {
      // Let the row that's about to rejoin the flow FLIP-ease in from wherever the
      // floating overlay last was, instead of just popping into its final slot.
      if (originRect) {
        bookmarkPrevRects.current.set(draggedId, { top: originRect.top + dragDeltaYRef.current } as DOMRect);
      }
      setDraggingBookmarkId(null);
      setDragOriginRect(null);
      setDragDeltaY(0);
      lastSwapTargetRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingBookmarkId, dragOriginRect]);

  // Last/Invert/Play: whenever rows land in a new spot — either because the array reordered
  // mid-drag, or because the dragged row just rejoined the list on drop — ease each one from
  // its previously-recorded position to where it actually ended up, instead of letting it jump.
  useLayoutEffect(() => {
    const prevRects = bookmarkPrevRects.current;
    if (prevRects.size === 0) return;
    bookmarkPrevRects.current = new Map();

    bookmarkRowRefs.current.forEach((rowEl, id) => {
      const before = prevRects.get(id);
      if (!before) return;
      const after = rowEl.getBoundingClientRect();
      const deltaY = before.top - after.top;
      if (Math.abs(deltaY) < 1) return;

      rowEl.style.transition = 'none';
      rowEl.style.transform = `translateY(${deltaY}px)`;
      rowEl.getBoundingClientRect(); // force reflow so the jump above isn't animated
      requestAnimationFrame(() => {
        rowEl.style.transition = 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)';
        rowEl.style.transform = '';
      });
    });
  }, [bookmarkOrder, draggingBookmarkId]);

  // Audio State
  // Removed local audio refs in favor of AudioEngine
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const isAutoSwitching = useRef(false);
  const targetAyahIndex = useRef(0);
  // One-shot scroll target when arriving from a Reflections "open reference" — independent
  // of the auto-scroll setting (which is shared with the audio cursor and may be off).
  const pendingScrollAyah = useRef<number | null>(null);
  // Set when we arrived here from a reflection's reference — hardware back returns there.
  const returnToReflectionId = useRef<string | null>(null);

  // Tafsir State
  const [tafsirData, setTafsirData] = useState<Ayah[] | null>(null);
  const [expandedTafsirAyah, setExpandedTafsirAyah] = useState<number | null>(null);
  const [isFullTafsirOpen, setIsFullTafsirOpen] = useState(false);
  const [loadingTafsir, setLoadingTafsir] = useState(false);

  // Load Settings & Surah List & Last Read
  useEffect(() => {
    const loadData = async () => {
      const storedSettings = localStorage.getItem('quranSettings_v3');
      if (storedSettings) {
        try {
          // Merge with default to ensure new keys exist
          const parsed = JSON.parse(storedSettings);
          setSavedSettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch (e) { console.error(e); }
      }

      const storedLastRead = localStorage.getItem('quranLastRead');
      if (storedLastRead) {
        try {
          setLastRead(JSON.parse(storedLastRead));
        } catch (e) { console.error(e); }
      }

      const surahList = await getAllSurahs();
      setSurahs(surahList);
      setLoading(false);

      // Reflections hand-off: jump straight to a referenced ayah, and remember to return
      // to that reflection on back.
      const rid = consumeReturnToReflectionId();
      if (rid) returnToReflectionId.current = rid;
      const target = consumePendingQuranTarget();
      if (target) {
        const targetSurah = surahList.find(x => x.number === target.surahNumber);
        if (targetSurah) {
          pendingScrollAyah.current = target.ayahNumber - 1;
          await handleSurahSelect(targetSurah, target.ayahNumber - 1);
        }
      }
    };

    loadData();
    onRead();
    // Intentionally mount-only: `onRead` is a new closure from App.tsx on every one of its
    // renders (unrelated to this page, e.g. while typing in search), and depending on it here
    // re-triggered this whole effect — including a full re-fetch of the surah list — on every
    // such render, which is what caused the search results list to flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Mark as read when entering reader view
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (view === 'reader' && currentSurah) {
      timer = setTimeout(() => {
        onRead();
      }, 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [view, currentSurah, onRead]);

  // Subscribe to Audio Engine Events
  useEffect(() => {
    const handleTimeUpdate = (data: { currentTime: number, duration: number }) => {
      // Optional: Update progress bar if we had one
    };

    const handleTrackChange = (index: number) => {
      setCurrentAyahIndex(index);
    };

    const handlePlaying = () => setIsPlaying(true);
    const handlePaused = () => setIsPlaying(false);

    audioEngine.on('timeupdate', handleTimeUpdate);
    audioEngine.on('trackchange', handleTrackChange);
    audioEngine.on('playing', handlePlaying);
    audioEngine.on('paused', handlePaused);

    return () => {
      audioEngine.off('timeupdate', handleTimeUpdate);
      audioEngine.off('trackchange', handleTrackChange);
      audioEngine.off('playing', handlePlaying);
      audioEngine.off('paused', handlePaused);
    };
  }, []);

  // Handle Auto-Play Next Surah
  useEffect(() => {
    const handleAudioEnded = () => {
      if (savedSettings.autoNextSurah && currentSurah && surahs.length > 0) {
        const nextNum = currentSurah.number + 1;
        if (nextNum <= 114) {
          const nextSurah = surahs.find(s => s.number === nextNum);
          if (nextSurah) {
            isAutoSwitching.current = true;
            handleSurahSelect(nextSurah);
          }
        }
      }
    };

    audioEngine.on('ended', handleAudioEnded);
    return () => audioEngine.off('ended', handleAudioEnded);
  }, [currentSurah, surahs, savedSettings.autoNextSurah]);


  // Media notification (lock screen + notification shade controls). The Web
  // navigator.mediaSession API doesn't reliably produce a real Android notification in this
  // WebView (it's really meant to pair with an <audio>/<video> element, not the raw Web
  // Audio API this engine uses), so this uses a native plugin instead.
  const controlsCreatedRef = useRef(false);

  useEffect(() => {
    if (!currentSurah || view !== 'reader') return;

    const currentReciter = RECITERS.find(r => r.id === savedSettings.reciterId) || RECITERS[0];
    const ayahNum = ayahs[currentAyahIndex]?.arabic.numberInSurah || (currentAyahIndex + 1);

    CapacitorMusicControls.create({
      track: `${currentSurah.englishName} • Ayah ${ayahNum}`,
      artist: currentReciter.name,
      album: 'Nur',
      isPlaying,
      hasPrev: true,
      hasNext: true,
      hasClose: true,
      dismissable: true,
      // The plugin's native Android code crashes with a NullPointerException if `cover` or
      // `notificationIcon` are left unset (it calls .isEmpty() on them without a null
      // check) — always pass empty strings rather than omitting these fields.
      // `icon.png` is the app's own icon, already bundled at the root of the web assets —
      // the plugin resolves a plain filename like this from the app's assets/public folder.
      cover: 'icon.png',
      ticker: '',
      // A real "drawable" resource (android/app/src/main/res/drawable/ic_notification.png,
      // copied from the launcher icon), resolved natively — more reliable than `cover`'s
      // asset-file lookup for the small status-bar icon specifically.
      notificationIcon: 'ic_notification',
      playIcon: '',
      pauseIcon: '',
      prevIcon: '',
      nextIcon: '',
      closeIcon: '',
    }).then(() => {
      controlsCreatedRef.current = true;
    }).catch(() => { });
  }, [currentSurah, currentAyahIndex, savedSettings.reciterId, view]);

  // Play/pause alone is a cheap update — no need to recreate the whole notification for it.
  useEffect(() => {
    if (!controlsCreatedRef.current) return;
    CapacitorMusicControls.updateIsPlaying({ isPlaying });
  }, [isPlaying]);

  // Route taps on the notification's prev/play/pause/next buttons back into the engine.
  useEffect(() => {
    const handleControlsEvent = (event: any) => {
      const message = event?.message;
      switch (message) {
        case 'music-controls-next':
          audioEngine.next();
          break;
        case 'music-controls-previous':
          audioEngine.prev();
          break;
        case 'music-controls-pause':
          audioEngine.pause();
          break;
        case 'music-controls-play':
          if (audioEngine.hasActiveTrack()) {
            audioEngine.resume();
          } else {
            audioEngine.initializeAndPlay();
          }
          break;
        case 'music-controls-destroy':
          controlsCreatedRef.current = false;
          break;
        default:
          break;
      }
    };
    document.addEventListener('controlsNotification', handleControlsEvent);
    return () => document.removeEventListener('controlsNotification', handleControlsEvent);
  }, []);

  // Sync Audio Queue when Ayahs change
  useEffect(() => {
    if (ayahs.length > 0) {
      const urls = ayahs.map(a => a.audio.audio);
      const startIndex = targetAyahIndex.current;
      audioEngine.setQueue(urls, startIndex);
      setCurrentAyahIndex(startIndex);
      targetAyahIndex.current = 0;

      if (isAutoSwitching.current) {
        audioEngine.initializeAndPlay();
        setIsPlaying(true);
        isAutoSwitching.current = false;
      } else {
        setIsPlaying(false);
      }
    }
  }, [ayahs]);

  // Sync Repeat Settings to Audio Engine
  useEffect(() => {
    audioEngine.setRepeatSettings({
      repeatVerse: savedSettings.repeatVerse,
      repeatMode: savedSettings.repeatMode,
      rangeStart: savedSettings.repeatRangeStart,
      rangeEnd: savedSettings.repeatRangeEnd
    });
  }, [savedSettings.repeatVerse, savedSettings.repeatMode, savedSettings.repeatRangeStart, savedSettings.repeatRangeEnd]);

  // Auto-Scroll to Active Ayah
  useEffect(() => {
    if (savedSettings.autoScroll && view === 'reader' && ayahs.length > 0) {
      const element = document.getElementById(`ayah-${currentAyahIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentAyahIndex, view, ayahs, savedSettings.autoScroll]);

  // Scroll to top when view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // One-shot scroll to a Reflections-linked ayah — runs regardless of the autoScroll
  // setting (that one is gated and shared with the audio cursor). Briefly rings the ayah.
  useEffect(() => {
    if (view !== 'reader' || ayahs.length === 0 || pendingScrollAyah.current === null) return;
    const idx = pendingScrollAyah.current;
    pendingScrollAyah.current = null;
    const timer = setTimeout(() => {
      const el = document.getElementById(`ayah-${idx}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const ring = ['ring-2', 'ring-primary', 'ring-offset-2', 'dark:ring-offset-background-dark'];
      el.classList.add(...ring);
      setTimeout(() => el.classList.remove(...ring), 2000);
    }, 350);
    return () => clearTimeout(timer);
  }, [view, ayahs]);

  // Audio Playback Speed Update
  useEffect(() => {
    audioEngine.setPlaybackRate(savedSettings.playbackSpeed);
  }, [savedSettings.playbackSpeed]);

  // Stop Audio when leaving index or unmounting
  useEffect(() => {
    if (view === 'index') {
      audioEngine.stop(); // Use stop/reset instead of just pause
      setIsPlaying(false);
      if (controlsCreatedRef.current) {
        controlsCreatedRef.current = false;
        CapacitorMusicControls.destroy().catch(() => { });
      }
    }

    return () => {
      // Cleanup on unmount
      audioEngine.stop();
      if (controlsCreatedRef.current) {
        controlsCreatedRef.current = false;
        CapacitorMusicControls.destroy().catch(() => { });
      }
    };
  }, [view]);

  // Track Last Read Position
  useEffect(() => {
    if (currentSurah && view === 'reader') {
      const newLastRead: LastRead = {
        surahNumber: currentSurah.number,
        surahName: currentSurah.englishName,
        ayahNumber: currentAyahIndex + 1
      };
      setLastRead(newLastRead);
      localStorage.setItem('quranLastRead', JSON.stringify(newLastRead));
    }
  }, [currentSurah, currentAyahIndex, view]);


  const handleSurahSelect = async (surah: Surah, initialAyahIndex = 0) => {
    setLoadingSurah(true);
    setCurrentSurah(surah);
    targetAyahIndex.current = initialAyahIndex;

    // Reset Tafsir
    setTafsirData(null);
    setExpandedTafsirAyah(null);
    setIsFullTafsirOpen(false);

    // Save Last Read
    const newLastRead: LastRead = {
      surahNumber: surah.number,
      surahName: surah.englishName,
      ayahNumber: initialAyahIndex + 1
    };
    setLastRead(newLastRead);
    localStorage.setItem('quranLastRead', JSON.stringify(newLastRead));

    await fetchSurahContent(surah.number, savedSettings.reciterId);

    setView('reader');
    setLoadingSurah(false);

    setIsPlaying(false);
  };

  const fetchSurahContent = async (surahNumber: number, reciterId: string) => {
    const details = await getSurahDetails(surahNumber, reciterId, language);
    if (details) {
      const zipped = details.arabic.map((ayah, index) => ({
        arabic: ayah,
        translation: details.translation[index],
        transliteration: details.transliteration[index],
        audio: details.audio[index]
      }));
      setAyahs(zipped);
    } else {
      alert(t('quran.failedToLoadSurah'));
    }
  };

  // Re-fetch the current surah's translation text if the user changes app language while
  // already reading it, so the ayah translations switch immediately instead of needing to
  // leave and reopen the surah. Skips the initial mount, where `view` is never 'reader' yet.
  const isFirstLanguageRender = useRef(true);
  useEffect(() => {
    if (isFirstLanguageRender.current) { isFirstLanguageRender.current = false; return; }
    if (view === 'reader' && currentSurah) {
      setLoadingSurah(true);
      fetchSurahContent(currentSurah.number, savedSettings.reciterId).then(() => setLoadingSurah(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleBackToIndex = () => {
    setView('index');
    setCurrentSurah(null);
    setAyahs([]);
    setIsPlaying(false);
    setSearchQuery('');
    setIsSearchOpen(false);
    audioEngine.pause();
    setCurrentAyahIndex(0);
  };

  // If we got here from a reflection's reference, "back" (hardware OR the on-screen arrow)
  // returns to that reflection. Returns true when it consumed the press.
  const returnToReflectionIfPending = (): boolean => {
    if (!returnToReflectionId.current) return false;
    const id = returnToReflectionId.current;
    returnToReflectionId.current = null;
    audioEngine.stop();
    setPendingOpenReflectionId(id);
    navigate('reflections');
    return true;
  };

  const handleReaderBack = () => {
    if (returnToReflectionIfPending()) return;
    handleBackToIndex();
  };

  const handleIndexBack = () => {
    if (returnToReflectionIfPending()) return;
    onBack();
  };

  // Claim the hardware back button/gesture while the reader is open, so it steps back to
  // the Surah list instead of falling through to App.tsx's dashboard-level navigation.
  useEffect(() => {
    if (view !== 'reader') return;
    return pushBackHandler(() => {
      handleReaderBack();
      return true;
    });
  }, [view]);

  // Reflection breadcrumb for the index view / any state the reader handler above misses.
  // Registered after the reader handler so it wins while the reader is open; falls through
  // (returns false) on a normal Qur'an visit.
  useEffect(() => {
    return pushBackHandler(() => returnToReflectionIfPending());
  }, [view, navigate]);

  // Same idea for the full-screen overlays: back should close them, not exit the page.
  useEffect(() => {
    if (!isBookmarksOpen) return;
    return pushBackHandler(() => {
      setIsBookmarksOpen(false);
      setIsBookmarkReorderMode(false);
      return true;
    });
  }, [isBookmarksOpen]);

  useEffect(() => {
    if (!isFullTafsirOpen) return;
    return pushBackHandler(() => {
      setIsFullTafsirOpen(false);
      return true;
    });
  }, [isFullTafsirOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    return pushBackHandler(() => {
      // If we're browsing the reciter list, back goes up to the main settings screen first.
      if (isReciterListOpen) {
        setIsReciterListOpen(false);
      } else {
        closeSettings();
      }
      return true;
    });
  }, [isSettingsOpen, isReciterListOpen]);

  // Handle Play/Pause Toggle
  const togglePlay = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else if (audioEngine.hasActiveTrack()) {
      // Resume exactly where we paused, instead of restarting the ayah from 0.
      audioEngine.resume();
    } else {
      audioEngine.initializeAndPlay();
    }
  };

  const playNext = () => {
    audioEngine.next();
  };

  const playPrev = () => {
    audioEngine.prev();
  };

  // Settings Logic
  const openSettings = () => {
    setTempSettings({ ...savedSettings });
    setIsSettingsOpen(true);
    setIsReciterListOpen(false);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  const savePreferences = () => {
    setSavedSettings(tempSettings);
    localStorage.setItem('quranSettings_v3', JSON.stringify(tempSettings));

    // Check if reciter changed AND we are in reader view AND the new reciter is valid
    if (view === 'reader' && currentSurah && tempSettings.reciterId !== savedSettings.reciterId) {
      setLoadingSurah(true);
      fetchSurahContent(currentSurah.number, tempSettings.reciterId).then(() => {
        setLoadingSurah(false);
      });
    }

    closeSettings();
  };

  const setAsDefault = () => {
    localStorage.setItem('quranUserDefaults', JSON.stringify(tempSettings));
    setPersistedDefaults(tempSettings);
    setDefaultSaved(true);
    setTimeout(() => setDefaultSaved(false), 2000);
  };

  const resetToDefaults = () => {
    setTempSettings(prev => ({
      ...persistedDefaults,
      reciterId: prev.reciterId
    }));
    setDefaultSaved(false);
  };

  const updateTempSetting = <K extends keyof QuranSettings>(key: K, value: QuranSettings[K]) => {
    // ...
    setTempSettings(prev => ({ ...prev, [key]: value }));
  };

  const currentReciter = RECITERS.find(r => r.id === savedSettings.reciterId) || RECITERS[0];
  const tempReciter = RECITERS.find(r => r.id === tempSettings.reciterId) || RECITERS[0];

  const ensureTafsirLoaded = async () => {
    if (!tafsirData && currentSurah && !loadingTafsir) {
      setLoadingTafsir(true);
      const data = await getSurahTafsir(currentSurah.number);
      setTafsirData(data);
      setLoadingTafsir(false);
      return data;
    }
    return tafsirData;
  };

  const toggleTafsir = async (index: number) => {
    if (expandedTafsirAyah === index) {
      setExpandedTafsirAyah(null);
    } else {
      setExpandedTafsirAyah(index);
      await ensureTafsirLoaded();
    }
  };

  const toggleFullTafsir = async () => {
    if (!isFullTafsirOpen) {
      setIsFullTafsirOpen(true);
      await ensureTafsirLoaded();
    } else {
      setIsFullTafsirOpen(false);
    }
  };

  // --- RENDERERS ---

  if (view === 'index') {
    return (
      <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white pb-32">
        {/* Keeps the camera safe-area opaque even once the header below has scrolled up
            against it — without this, scrolled content shows through that strip. Must stay
            `fixed` (not `absolute`) so it stays pinned to the viewport while this page's own
            content scrolls — the mount-flash this used to cause is now fixed at the source
            (index.css's .page-transition no longer uses `transform`). */}
        <div className="fixed top-0 left-0 right-0 z-[60] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm" style={{ height: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}></div>
        <header className="sticky sticky-safe-top z-50 flex items-center justify-between bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 pb-2 border-b border-gray-200 dark:border-gray-800 transition-colors duration-200 gap-4 h-[72px]">
          {isSearchOpen ? (
            <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">search</span>
                </div>
                <input
                  autoFocus
                  type="text"
                  className="block w-full pl-11 pr-10 py-2.5 bg-gray-100 dark:bg-gray-800 border-2 border-transparent focus:border-primary/20 rounded-full text-base focus:outline-none transition-all placeholder-gray-400 text-gray-900 dark:text-white"
                  placeholder={t('quran.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <span className="material-symbols-outlined text-xl">cancel</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                className="px-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
              >
                {t('quran.cancel')}
              </button>
            </div>
          ) : (
            <>
              <button onClick={handleIndexBack} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
              </button>
              <div className="flex flex-col items-center flex-1">
                <h2 className="text-lg font-bold leading-tight">{t('quran.title')}</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('quran.surahCount114')}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => navigate('reflections')} title={t('quran.reflections')} className="flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                  <span className="material-symbols-outlined text-2xl">edit_note</span>
                </button>
                <button onClick={() => navigate('quran-full-surahs' as any)} title={t('quran.listenFullSurahs')} className="flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                  <span className="material-symbols-outlined text-2xl">headphones</span>
                </button>
                <button onClick={() => setIsBookmarksOpen(true)} className="relative flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                  <span className="material-symbols-outlined text-2xl">bookmark</span>
                  {bookmarks.length > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold">
                      {bookmarks.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setIsSearchOpen(true)} className="flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                  <span className="material-symbols-outlined text-2xl">search</span>
                </button>
              </div>
            </>
          )}
        </header>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center pt-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 text-sm">{t('quran.loadingSurahs')}</p>
          </div>
        ) : (
          <main className="px-4 pt-4 flex flex-col gap-3">
            {/* Only show Last Read if not searching */}
            {lastRead && searchQuery === '' && (
              <div
                className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-4 text-white shadow-glow mb-2 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => {
                  const surah = surahs.find(s => s.number === lastRead.surahNumber);
                  if (surah) handleSurahSelect(surah, lastRead.ayahNumber - 1);
                }}
              >
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                  <span className="material-symbols-outlined text-[120px]">menu_book</span>
                </div>
                <div className="flex items-center gap-2 mb-1 opacity-80">
                  <span className="material-symbols-outlined text-sm">history</span>
                  <p className="text-xs font-medium uppercase tracking-wide">{t('quran.lastRead')}</p>
                </div>
                <h3 className="text-2xl font-bold mb-1">{lastRead.surahName}</h3>
                <p className="text-xs opacity-80">{t('quran.ayahLabel', { n: lastRead.ayahNumber })}</p>
              </div>
            )}

            {filteredSurahs.length === 0 ? (
              showNoResults ? <div className="text-center py-10 text-gray-500">{t('quran.noSurahsFound')}</div> : null
            ) : (
              filteredSurahs.map((surah) => (
                <div
                  key={surah.number}
                  onClick={() => handleSurahSelect(surah)}
                  className="bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center justify-center size-10 bg-primary/10 rounded-full text-primary font-bold text-sm relative">
                    {surah.number}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{surah.englishName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('quran.surahMeta', { translation: getSurahNameMeaning(surah, language), count: surah.numberOfAyahs })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-arabic text-xl dark:text-gray-200">{surah.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${surah.revelationType === 'Meccan' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                      {surah.revelationType === 'Meccan' ? t('quran.meccan') : t('quran.medinan')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </main>
        )}

        {loadingSurah && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {isBookmarksOpen && (
          <div
            className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-200"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-lg">{t('quran.bookmarkedAyahsTitle')}</h3>
                <p className="text-xs text-gray-500">{t('quran.savedCount', { count: bookmarks.length })}</p>
              </div>
              <button
                onClick={() => { setIsBookmarksOpen(false); setIsBookmarkReorderMode(false); }}
                className="size-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {([
                  { key: 'quran', label: t('quran.sortQuranOrder') },
                  { key: 'custom', label: t('quran.sortCustom') },
                ] as { key: BookmarkSort; label: string }[]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setBookmarkSort(opt.key); setIsBookmarkReorderMode(false); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${bookmarkSort === opt.key
                      ? 'text-white bg-primary shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {bookmarkSort === 'custom' && sortedBookmarks.length > 1 && (
                isBookmarkReorderMode ? (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
                      {t('quran.dragToReorder')}
                    </p>
                    <button onClick={() => setIsBookmarkReorderMode(false)} className="text-[11px] font-bold text-primary">{t('quran.done')}</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsBookmarkReorderMode(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary mt-2"
                  >
                    <span className="material-symbols-outlined text-[14px]">swap_vert</span>
                    {t('quran.reorder')}
                  </button>
                )
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sortedBookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center">
                  <span className="material-symbols-outlined text-4xl mb-2">bookmark_border</span>
                  <p>{t('quran.noBookmarksYet')}</p>
                  <p className="text-xs mt-1 max-w-[220px]">{t('quran.noBookmarksHint')}</p>
                </div>
              ) : (
                sortedBookmarks.map((b) => (
                  <div
                    key={b.id}
                    ref={(el) => {
                      if (el) bookmarkRowRefs.current.set(b.id, el);
                      else bookmarkRowRefs.current.delete(b.id);
                    }}
                    data-bookmark-id={b.id}
                    className="relative bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-xl p-4"
                    style={draggingBookmarkId === b.id ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {bookmarkSort === 'custom' && isBookmarkReorderMode && (
                        <button
                          onPointerDown={(e) => handleBookmarkPointerDown(e, b.id)}
                          className="touch-none cursor-grab active:cursor-grabbing text-gray-400 mt-1 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                        </button>
                      )}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openBookmark(b)}>
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <span className="text-xs font-bold text-primary truncate">{t('quran.bookmarkAyahLabel', { surah: b.surahName, n: b.ayahNumberInSurah })}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setBookmarks(prev => prev.filter(x => x.id !== b.id)); }}
                            className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
                          >
                            <span className="material-symbols-outlined text-[18px]">bookmark_remove</span>
                          </button>
                        </div>
                        <p className="text-right font-arabic text-xl leading-relaxed mb-2 text-gray-900 dark:text-white" dir="rtl">{b.arabic}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed line-clamp-2">{b.translation}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div className="h-6"></div>
            </div>

            {/* Floating clone of the dragged row: it's fully out of the normal list flow
                (see the filter() above), so it can't leave a gap while it tracks the finger. */}
            {draggingBookmarkId && dragOriginRect && (() => {
              const dragged = bookmarks.find(x => x.id === draggingBookmarkId);
              if (!dragged) return null;
              return (
                <div
                  style={{
                    position: 'fixed',
                    top: dragOriginRect.top + dragDeltaY,
                    left: dragOriginRect.left,
                    width: dragOriginRect.width,
                    zIndex: 200,
                    pointerEvents: 'none',
                    transform: 'scale(1.03)'
                  }}
                  className="bg-white dark:bg-card-dark border border-primary/40 rounded-xl p-4 shadow-2xl"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[20px] text-gray-400 mt-1 shrink-0">drag_indicator</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-primary truncate">{t('quran.bookmarkAyahLabel', { surah: dragged.surahName, n: dragged.ayahNumberInSurah })}</span>
                      <p className="text-right font-arabic text-xl leading-relaxed mt-2 mb-2 text-gray-900 dark:text-white" dir="rtl">{dragged.arabic}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed line-clamp-2">{dragged.translation}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // --- READER VIEW ---




  const currentAudioSrc = ayahs[currentAyahIndex]?.audio?.audio;

  return (
    <div className={`relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white transition-colors duration-200 ${isSettingsOpen ? 'overflow-hidden' : ''}`}>

      {/* Audio Engine handles playback, no inline audio elements needed */}

      {/* Keeps the camera safe-area opaque even once the ayah list has scrolled up
          against it — without this, scrolled content shows through that strip. Must stay
          `fixed` (not `absolute`) so it stays pinned to the viewport while this page's own
          content scrolls — the mount-flash this used to cause is now fixed at the source
          (index.css's .page-transition no longer uses `transform`). */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm" style={{ height: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}></div>

      <div aria-hidden={isSettingsOpen} className={`transition-all duration-300 ${isSettingsOpen ? 'filter blur-[2px] brightness-[0.85] pointer-events-none select-none' : ''}`}>
        <header className="sticky sticky-safe-top z-50 flex items-center justify-between bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 pb-2 border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
          <button onClick={handleReaderBack} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-lg font-bold leading-tight">{currentSurah?.englishName}</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {currentSurah && t('quran.revelationVerseCount', {
                type: currentSurah.revelationType === 'Meccan' ? t('quran.meccan') : t('quran.medinan'),
                count: currentSurah.numberOfAyahs,
              })}
            </span>
          </div>
          <button
            onClick={toggleFullTafsir}
            className={`flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${loadingTafsir ? 'opacity-50' : ''}`}
            title={t('quran.fullTafsirTitle')}
          >
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </button>
        </header>

        <main className="flex flex-col px-4 pt-4 pb-32">
          {/* Surah 1's ayah 1 IS the Bismillah (already rendered below), and Surah 9
              (At-Tawbah) is the one surah traditionally recited without it. */}
          {currentSurah?.number !== 1 && currentSurah?.number !== 9 && (
            <div className="flex flex-col items-center py-8">
              <h1 className="text-slate-900 dark:text-white font-arabic text-4xl font-bold leading-tight text-center px-4">بسم الله الرحمن الرحيم</h1>
            </div>
          )}

          {ayahs.map((v, idx) => (
            <div
              key={v.arabic.number}
              id={`ayah-${idx}`}
              className={`group relative flex flex-col gap-4 py-6 border-b border-gray-100 dark:border-gray-800 last:border-0 rounded-xl transition-all duration-300 px-2 ${currentAyahIndex === idx ? 'bg-primary/5 border-primary/20 scale-[1.01]' : 'hover:bg-white dark:hover:bg-gray-900'}`}
              onClick={() => {
                if (isPlaying) return;
                audioEngine.setIndex(idx);
              }}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col items-center gap-4 pt-2">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${currentAyahIndex === idx ? 'bg-primary text-white' : 'bg-primary/10 dark:bg-primary/20 text-primary'}`}>
                    {v.arabic.numberInSurah}
                  </div>
                  <div className="flex flex-col gap-3 opacity-30 group-hover:opacity-100 transition-opacity items-center">
                    {currentAyahIndex === idx && isPlaying ? (
                      <span className="material-symbols-outlined text-[20px] text-primary animate-pulse">volume_up</span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(v); }}
                        className={`transition-colors ${bookmarks.some(b => b.surahNumber === currentSurah?.number && b.ayahNumberInSurah === v.arabic.numberInSurah) ? 'text-primary' : 'hover:text-primary'}`}
                      >
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{
                            fontVariationSettings: bookmarks.some(b => b.surahNumber === currentSurah?.number && b.ayahNumberInSurah === v.arabic.numberInSurah)
                              ? "'FILL' 1" : "'FILL' 0"
                          }}
                        >
                          bookmark
                        </span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!currentSurah) return;
                        setPendingReflectionDraft({
                          quranRefs: [{
                            surahNumber: currentSurah.number,
                            surahName: currentSurah.englishName,
                            ayahNumber: v.arabic.numberInSurah,
                            ayahText: v.translation?.text,
                          }],
                        });
                        navigate('reflections');
                      }}
                      className="hover:text-primary transition-colors"
                      aria-label={t('quran.addReflection')}
                    >
                      <span className="material-symbols-outlined text-[20px]">rate_review</span>
                    </button>

                    {currentAyahIndex === idx && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTafsir(idx); }}
                        className={`hover:text-primary transition-colors ${expandedTafsirAyah === idx ? 'text-primary' : ''}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">chrome_reader_mode</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-6">
                  <p className={`text-slate-900 dark:text-white font-arabic text-3xl leading-[3.5rem] text-right transition-colors ${currentAyahIndex === idx ? 'text-primary dark:text-primary' : ''}`} dir="rtl">
                    {(currentSurah?.number !== 1 && v.arabic.numberInSurah === 1)
                      ? v.arabic.text.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s?/, '')
                      : v.arabic.text
                    }
                  </p>
                  {savedSettings.showTransliteration && v.transliteration?.text && (
                    <p className="text-primary/70 dark:text-primary/70 text-sm italic leading-relaxed -mt-3">{v.transliteration.text}</p>
                  )}
                  <p className="text-gray-600 dark:text-gray-300 text-base font-normal leading-relaxed">{v.translation.text}</p>

                  {expandedTafsirAyah === idx && (
                    <div
                      className="mt-2 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4 className="font-bold text-xs uppercase tracking-wider mb-2 text-primary opacity-80">{t('quran.tafsirIbnKathir')}</h4>
                      {loadingTafsir && !tafsirData ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          {t('quran.loading')}
                        </div>
                      ) : (
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {tafsirData?.[idx]?.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="h-24"></div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="absolute bottom-0 h-32 w-full bg-gradient-to-t from-background-light via-background-light/90 to-transparent dark:from-background-dark dark:via-background-dark/90 pointer-events-none"></div>

          <div className="relative px-3 sm:px-4 pb-4 sm:pb-6 pt-2 w-full max-w-[460px] mx-auto">
            <div className="flex items-center justify-between bg-white/95 dark:bg-[#1A2230]/95 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 rounded-2xl shadow-xl p-3 sm:p-4 transition-all duration-300">

              <div className="flex flex-col justify-center min-w-0 flex-1 mr-2">
                <p className="text-[10px] sm:text-xs font-bold text-primary tracking-wide uppercase truncate">
                  {t('quran.bookmarkAyahLabel', { surah: currentSurah?.englishName ?? '', n: ayahs[currentAyahIndex]?.arabic.numberInSurah ?? '' })}
                </p>
                <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium truncate">{currentReciter.name}</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <button onClick={playPrev} className="text-gray-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[24px] sm:text-[28px]">skip_previous</span></button>
                <button onClick={togglePlay} className="flex items-center justify-center size-10 sm:size-12 bg-primary rounded-full text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]" style={{ marginLeft: '2px' }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <button onClick={playNext} className="text-gray-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[24px] sm:text-[28px]">skip_next</span></button>
              </div>
              <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2 sm:mx-3 shrink-0"></div>
              <button
                onClick={openSettings}
                className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-primary px-1 sm:px-2 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[24px]">tune</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
          <div className="absolute inset-0 bg-[#0d121b]/60 backdrop-blur-sm transition-opacity" onClick={closeSettings}></div>
          <div className="relative w-full sm:w-[500px] max-h-[92vh] bg-white dark:bg-[#1A2230] rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-8 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>

            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {isReciterListOpen ? t('quran.selectReciter') : t('quran.settingsTitle')}
              </h2>
              {isReciterListOpen ? (
                <button
                  onClick={() => setIsReciterListOpen(false)}
                  className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  {t('quran.back')}
                </button>
              ) : (
                <button
                  onClick={closeSettings}
                  className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1">

              {!isReciterListOpen ? (
                <>
                  {/* Current Reciter Menu Item */}
                  <div
                    className="flex items-center p-3 rounded-2xl bg-background-light dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 cursor-pointer group hover:border-primary/50 transition-colors"
                    onClick={() => setIsReciterListOpen(true)}
                  >
                    <div className="size-14 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-primary mr-4 shrink-0 overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">{t('quran.reciterLabel')}</label>
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">{tempReciter.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tempReciter.subtext}</p>
                    </div>
                    <span className="material-symbols-outlined text-gray-400">arrow_forward_ios</span>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('quran.playbackSpeedLabel')}</label>
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 rounded-xl p-1 gap-1">
                      {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => updateTempSetting('playbackSpeed', speed)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg hover:shadow-sm transition-all ${tempSettings.playbackSpeed === speed
                            ? 'text-white bg-primary shadow-sm shadow-primary/20 font-bold'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
                            }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('quran.repeatAndFocus')}</label>
                    <div className="flex flex-col gap-2">
                      {/* Repeat Current Only */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>repeat</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('quran.repeatCurrentVerse')}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tempSettings.repeatVerse}
                            onChange={(e) => updateTempSetting('repeatVerse', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {/* Auto-Next Surah */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>queue_music</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('quran.autoPlayNextSurah')}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tempSettings.autoNextSurah}
                            onChange={(e) => updateTempSetting('autoNextSurah', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      <div className="h-px w-full bg-gray-100 dark:bg-gray-800"></div>

                      {/* Auto-Scroll */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>vertical_align_center</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('quran.autoScrollLabel')}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tempSettings.autoScroll}
                            onChange={(e) => updateTempSetting('autoScroll', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      <div className="h-px w-full bg-gray-100 dark:bg-gray-800"></div>

                      {/* Transliteration */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>translate</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('quran.showTransliteration')}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tempSettings.showTransliteration}
                            onChange={(e) => updateTempSetting('showTransliteration', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      <div className="h-px w-full bg-gray-100 dark:bg-gray-800"></div>

                      {/* Repeat Mode */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>repeat_on</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('quran.repeatModeLabel')}</p>
                          </div>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                          {(['Off', 'Surah', 'Range'] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => {
                                updateTempSetting('repeatMode', mode);
                                if (mode === 'Range') {
                                  updateTempSetting('repeatRangeStart', 1);
                                  updateTempSetting('repeatRangeEnd', ayahs.length || 1);
                                }
                              }}
                              className={`px-3 py-1.5 text-[11px] rounded-md transition-all ${tempSettings.repeatMode === mode
                                ? 'font-bold text-white bg-primary shadow-sm'
                                : 'font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                              {mode === 'Off' ? t('quran.repeatOff') : mode === 'Surah' ? t('quran.repeatSurah') : t('quran.repeatRange')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Range Inputs */}
                      {tempSettings.repeatMode === 'Range' && (
                        <div className="flex items-center gap-4 mt-2 px-2 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">{t('quran.fromAyah')}</label>
                            <div className="relative">
                              <select
                                value={tempSettings.repeatRangeStart}
                                onChange={(e) => updateTempSetting('repeatRangeStart', parseInt(e.target.value))}
                                className="w-full appearance-none bg-white dark:bg-gray-700 rounded-lg p-2 text-sm font-bold text-center border border-gray-200 dark:border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                              >
                                {Array.from({ length: tempSettings.repeatRangeEnd }, (_, i) => i + 1).map(num => (
                                  <option key={num} value={num}>{num}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                              </div>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">{t('quran.toAyah')}</label>
                            <div className="relative">
                              <select
                                value={tempSettings.repeatRangeEnd}
                                onChange={(e) => updateTempSetting('repeatRangeEnd', parseInt(e.target.value))}
                                className="w-full appearance-none bg-white dark:bg-gray-700 rounded-lg p-2 text-sm font-bold text-center border border-gray-200 dark:border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                              >
                                {Array.from({ length: (ayahs.length || 1) - tempSettings.repeatRangeStart + 1 }, (_, i) => i + tempSettings.repeatRangeStart).map(num => (
                                  <option key={num} value={num}>{num}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </>
              ) : (
                /* Reciter List View */
                <div className="space-y-2">
                  {RECITERS.map(reciter => (
                    <div
                      key={reciter.id}
                      onClick={() => {
                        updateTempSetting('reciterId', reciter.id);
                        setIsReciterListOpen(false);
                      }}
                      className={`flex items-center p-3 rounded-2xl border cursor-pointer group transition-colors ${tempSettings.reciterId === reciter.id ? 'bg-background-light dark:bg-gray-800/60 border-primary' : 'bg-transparent border-gray-100 dark:border-gray-700/50 hover:border-primary/50'}`}
                    >
                      <div className="size-10 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-primary mr-4 shrink-0 overflow-hidden border border-white dark:border-gray-700 shadow-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold truncate ${tempSettings.reciterId === reciter.id ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{reciter.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{reciter.subtext}</p>
                      </div>
                      {tempSettings.reciterId === reciter.id && (
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary text-white shadow-sm shadow-primary/30">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isReciterListOpen && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {(() => {
                      // Explicit Comparison
                      const isMatch =
                        tempSettings.playbackSpeed === persistedDefaults.playbackSpeed &&
                        tempSettings.repeatVerse === persistedDefaults.repeatVerse &&
                        tempSettings.repeatMode === persistedDefaults.repeatMode &&
                        tempSettings.repeatRangeStart === persistedDefaults.repeatRangeStart &&
                        tempSettings.repeatRangeEnd === persistedDefaults.repeatRangeEnd &&
                        tempSettings.audioTranslation === persistedDefaults.audioTranslation &&
                        tempSettings.autoNextSurah === persistedDefaults.autoNextSurah &&
                        tempSettings.autoScroll === persistedDefaults.autoScroll &&
                        tempSettings.showTransliteration === persistedDefaults.showTransliteration;

                      return (
                        <button
                          onClick={setAsDefault}
                          disabled={isMatch || defaultSaved}
                          className={`font-bold py-3 rounded-xl active:scale-[0.98] transition-colors duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm ${defaultSaved
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            : isMatch
                              ? 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {defaultSaved ? 'check' : 'bookmark_add'}
                          </span>
                          {defaultSaved ? t('quran.savedExclaim') : t('quran.setDefault')}
                        </button>
                      );
                    })()}
                    <button
                      onClick={resetToDefaults}
                      className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
                      {t('quran.resetButton')}
                    </button>
                  </div>

                  <button
                    onClick={savePreferences}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>save</span>
                    {t('quran.savePreferences')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Full Tafsir Modal */}
      {isFullTafsirOpen && (
        <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-lg">{t('quran.tafsirIbnKathir')}</h3>
              <p className="text-xs text-gray-500">{currentSurah?.englishName}</p>
            </div>
            <button onClick={() => setIsFullTafsirOpen(false)} className="size-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {loadingTafsir && !tafsirData ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              tafsirData?.map((ayah, i) => (
                <div key={i} className="pb-4 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{t('quran.ayahLabel', { n: i + 1 })}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {ayah.text}
                  </p>
                </div>
              ))
            )}
            <div className="h-20"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quran;
