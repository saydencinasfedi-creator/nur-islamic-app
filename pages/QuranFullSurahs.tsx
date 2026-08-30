
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { PageId, Surah, CustomRecitation } from '../types';
import { getAllSurahs, getFullSurahAudioUrl, getSurahNameMeaning, RECITERS } from '../services/quranService';
import { saveAudioFile, getPlayableUrl, deleteAudioFile } from '../services/fileStorage';
import RecitationFormSheet from '../components/RecitationFormSheet';
import { pushBackHandler } from '../services/backHandlerStack';
import { CapacitorMusicControls } from 'capacitor-music-controls-plugin';
import { useUser } from '../contexts/UserContext';

interface QuranFullSurahsProps {
    navigate: (page: PageId) => void;
    onBack: () => void;
    onRead: () => void;
}

type NowPlaying =
    | { type: 'surah'; surahNumber: number; surahName: string; reciterName: string }
    | { type: 'custom'; recitation: CustomRecitation };

type RecitationSort = 'quran' | 'custom';

// A streamed mp3's <audio>.duration can briefly read as Infinity/NaN before the browser
// has worked out the real length (or never resolve for a broken stream) — guard against
// ever forwarding that to the native notification, which otherwise renders it as a
// nonsensical multi-hour duration.
const MAX_SANE_DURATION_SECONDS = 4 * 60 * 60;
const sanitizeDuration = (d: number): number => (isFinite(d) && d > 0 && d < MAX_SANE_DURATION_SECONDS ? d : 0);

const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const QuranFullSurahs: React.FC<QuranFullSurahsProps> = ({ navigate, onBack, onRead }) => {
    const { t, language } = useUser();
    const [surahs, setSurahs] = useState<Surah[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [customRecitations, setCustomRecitations] = useState<CustomRecitation[]>(() => {
        const saved = localStorage.getItem('nurCustomRecitations');
        if (!saved) return [];
        try {
            const parsed = JSON.parse(saved);
            // Recitations saved before "pinned" existed default to pinned, so they don't
            // silently vanish from the main screen after this update.
            return parsed.map((r: CustomRecitation) => ({ pinned: true, ...r }));
        } catch {
            return [];
        }
    });
    const [showRecitationForm, setShowRecitationForm] = useState(false);
    const [savingRecitation, setSavingRecitation] = useState(false);
    const [editingRecitation, setEditingRecitation] = useState<CustomRecitation | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const [recitationSort, setRecitationSort] = useState<RecitationSort>(() => {
        return (localStorage.getItem('quranRecitationSort') as RecitationSort) || 'quran';
    });
    const [recitationOrder, setRecitationOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('quranRecitationOrder');
        return saved ? JSON.parse(saved) : [];
    });
    const [draggingRecitationId, setDraggingRecitationId] = useState<string | null>(null);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [revealedActionsId, setRevealedActionsId] = useState<string | null>(null);
    const [confirmDeleteRecitation, setConfirmDeleteRecitation] = useState<CustomRecitation | null>(null);
    const longPressTimerRef = useRef<number | null>(null);
    const longPressFiredRef = useRef(false);

    const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loadingPlayback, setLoadingPlayback] = useState<number | null>(null);
    const [unavailableSurah, setUnavailableSurah] = useState<number | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const controlsCreatedRef = useRef(false);
    const lastElapsedPushRef = useRef(0);

    const [isReciterSettingsOpen, setIsReciterSettingsOpen] = useState(false);
    const [pickedReciterId, setPickedReciterId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('quranFullSurahsReciterId');
            if (saved) return saved;
            const stored = localStorage.getItem('quranSettings_v3') || localStorage.getItem('quranUserDefaults');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.reciterId) return parsed.reciterId;
            }
        } catch { }
        return 'ar.alafasy';
    });

    useEffect(() => {
        localStorage.setItem('quranFullSurahsReciterId', pickedReciterId);
    }, [pickedReciterId]);

    useEffect(() => {
        getAllSurahs().then(data => {
            setSurahs(data);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        localStorage.setItem('nurCustomRecitations', JSON.stringify(customRecitations));
    }, [customRecitations]);

    useEffect(() => {
        localStorage.setItem('quranRecitationSort', recitationSort);
    }, [recitationSort]);

    // Keep the custom order in sync with the actual recitation set: drop stale ids, append
    // any new ones at the end.
    useEffect(() => {
        setRecitationOrder(prev => {
            const ids = customRecitations.map(r => r.id);
            const kept = prev.filter(id => ids.includes(id));
            const missing = ids.filter(id => !kept.includes(id));
            if (kept.length === prev.length && missing.length === 0) return prev;
            return [...kept, ...missing];
        });
    }, [customRecitations]);

    useEffect(() => {
        localStorage.setItem('quranRecitationOrder', JSON.stringify(recitationOrder));
    }, [recitationOrder]);

    useEffect(() => {
        if (audioUrl && audioRef.current) {
            audioRef.current.play().catch(() => { });
        }
    }, [audioUrl]);

    useEffect(() => {
        if (!isReciterSettingsOpen) return;
        return pushBackHandler(() => {
            setIsReciterSettingsOpen(false);
            return true;
        });
    }, [isReciterSettingsOpen]);

    useEffect(() => {
        if (!isManagerOpen) return;
        return pushBackHandler(() => {
            setIsManagerOpen(false);
            setIsReorderMode(false);
            setRevealedActionsId(null);
            return true;
        });
    }, [isManagerOpen]);

    useEffect(() => {
        if (!confirmDeleteRecitation) return;
        return pushBackHandler(() => {
            setConfirmDeleteRecitation(null);
            return true;
        });
    }, [confirmDeleteRecitation]);

    // Media notification (lock screen + notification shade controls), so playback keeps
    // working while the app is backgrounded — same native plugin as the ayah-by-ayah reader.
    // Since this page plays one single track per surah (not a per-ayah queue), the
    // notification's prev/next buttons skip to the previous/next surah in Quran order
    // (only when a surah — not a custom recitation — is playing), and hasScrubbing turns on
    // Android's native draggable progress bar for fine-grained seeking.
    useEffect(() => {
        if (!nowPlaying) return;
        const track = nowPlaying.type === 'surah' ? nowPlaying.surahName : nowPlaying.recitation.surahName;
        const artist = nowPlaying.type === 'surah' ? nowPlaying.reciterName : nowPlaying.recitation.reciterName;
        const canStepSurah = nowPlaying.type === 'surah';
        const safeDuration = sanitizeDuration(duration);

        CapacitorMusicControls.create({
            track,
            artist,
            album: 'Nur',
            isPlaying,
            hasPrev: canStepSurah,
            hasNext: canStepSurah,
            hasScrubbing: true,
            hasClose: true,
            dismissable: true,
            // create()'s duration/elapsed are in seconds, same as updateElapsed() — the
            // native side (MusicControlsInfos.java) already does its own ×1000 conversion
            // to milliseconds internally. Multiplying here too silently produced a duration
            // 1000x too large (a 40s surah showing as ~11 hours in the notification).
            duration: Math.floor(safeDuration),
            elapsed: Math.floor(Math.min(currentTime, safeDuration || currentTime)),
            cover: 'icon.png',
            ticker: '',
            notificationIcon: 'ic_notification',
            playIcon: '',
            pauseIcon: '',
            prevIcon: '',
            nextIcon: '',
            closeIcon: '',
        }).then(() => {
            controlsCreatedRef.current = true;
        }).catch(() => { });
        // Intentionally excludes currentTime/isPlaying — those are pushed via the cheaper
        // updateIsPlaying/updateElapsed calls below instead of recreating the notification.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nowPlaying, duration]);

    useEffect(() => {
        if (!controlsCreatedRef.current) return;
        CapacitorMusicControls.updateIsPlaying({ isPlaying });
    }, [isPlaying]);

    useEffect(() => {
        if (!nowPlaying && controlsCreatedRef.current) {
            controlsCreatedRef.current = false;
            CapacitorMusicControls.destroy().catch(() => { });
        }
    }, [nowPlaying]);

    useEffect(() => {
        return () => {
            if (controlsCreatedRef.current) {
                controlsCreatedRef.current = false;
                CapacitorMusicControls.destroy().catch(() => { });
            }
        };
    }, []);

    // Route taps on the notification's buttons/progress-bar back into the audio element.
    useEffect(() => {
        const handleControlsEvent = (event: any) => {
            const message = event?.message;
            switch (message) {
                case 'music-controls-previous':
                    playAdjacentSurah(-1);
                    break;
                case 'music-controls-next':
                    playAdjacentSurah(1);
                    break;
                case 'music-controls-pause':
                    audioRef.current?.pause();
                    break;
                case 'music-controls-play':
                    audioRef.current?.play().catch(() => { });
                    break;
                case 'music-controls-seek-to':
                    if (typeof event.position === 'number') seekTo(event.position);
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
        // playAdjacentSurah closes over nowPlaying/surahs/pickedReciterId, so this must
        // re-subscribe whenever those change — otherwise the notification's buttons would
        // keep acting on whatever surah/reciter was current the first time this ran.
    }, [nowPlaying, surahs, pickedReciterId]);

    const filteredSurahs = searchQuery.trim() === ''
        ? surahs
        : surahs.filter(s =>
            s.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.name.includes(searchQuery) ||
            s.englishNameTranslation.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getSurahNameMeaning(s, language).toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.number.toString().includes(searchQuery)
        );

    const sortedRecitations = React.useMemo(() => {
        if (recitationSort === 'quran') {
            return [...customRecitations].sort((a, b) => a.surahNumber - b.surahNumber);
        }
        const byId = new Map(customRecitations.map(r => [r.id, r]));
        return recitationOrder.map(id => byId.get(id)).filter((r): r is CustomRecitation => !!r);
    }, [customRecitations, recitationOrder, recitationSort]);

    const pinnedRecitations = sortedRecitations.filter(r => r.pinned);

    const playSurah = async (surah: Surah, reciterId: string = pickedReciterId) => {
        audioRef.current?.pause();
        setUnavailableSurah(null);
        setLoadingPlayback(surah.number);
        const url = await getFullSurahAudioUrl(surah.number, reciterId);
        setLoadingPlayback(null);
        if (!url) {
            setUnavailableSurah(surah.number);
            return;
        }
        const reciter = RECITERS.find(r => r.id === reciterId);
        setCurrentTime(0);
        setDuration(0);
        setNowPlaying({ type: 'surah', surahNumber: surah.number, surahName: surah.englishName, reciterName: reciter?.name ?? '' });
        setAudioUrl(url);
        onRead();
    };

    const playAdjacentSurah = (direction: 1 | -1) => {
        if (nowPlaying?.type !== 'surah' || surahs.length === 0) return;
        const idx = surahs.findIndex(s => s.number === nowPlaying.surahNumber);
        if (idx === -1) return;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= surahs.length) return;
        playSurah(surahs[nextIdx]);
    };

    const playCustomRecitation = async (recitation: CustomRecitation) => {
        setCurrentTime(0);
        setDuration(0);
        setNowPlaying({ type: 'custom', recitation });
        const url = await getPlayableUrl(recitation.filePath);
        setAudioUrl(url);
        onRead();
    };

    const toggleAudioPlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(() => { });
        }
    };

    const skip = (deltaSeconds: number) => {
        if (!audioRef.current) return;
        const target = audioRef.current.currentTime + deltaSeconds;
        audioRef.current.currentTime = Math.min(Math.max(0, target), duration || audioRef.current.duration || target);
    };

    const seekTo = (seconds: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = seconds;
        setCurrentTime(seconds);
    };

    const stopPlayback = () => {
        audioRef.current?.pause();
        setNowPlaying(null);
        setIsPlaying(false);
        setAudioUrl(null);
        setCurrentTime(0);
        setDuration(0);
    };

    const togglePinRecitation = (id: string) => {
        setCustomRecitations(prev => prev.map(r => r.id === id ? { ...r, pinned: !r.pinned } : r));
    };

    const deleteRecitation = async (recitation: CustomRecitation) => {
        if (nowPlaying?.type === 'custom' && nowPlaying.recitation.id === recitation.id) {
            stopPlayback();
        }
        setCustomRecitations(prev => prev.filter(r => r.id !== recitation.id));
        await deleteAudioFile(recitation.filePath);
    };

    const confirmDelete = async () => {
        if (!confirmDeleteRecitation) return;
        await deleteRecitation(confirmDeleteRecitation);
        setConfirmDeleteRecitation(null);
        setRevealedActionsId(null);
    };

    // Long-press (not a plain tap) on a row reveals its pin/edit/delete actions, matching
    // the press-and-hold pattern most apps use instead of showing them all the time.
    const cancelLongPress = () => {
        if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleRowPointerDown = (id: string) => {
        longPressFiredRef.current = false;
        cancelLongPress();
        longPressTimerRef.current = window.setTimeout(() => {
            longPressFiredRef.current = true;
            setRevealedActionsId(id);
        }, 450);
    };

    const handleRowPointerUp = (r: CustomRecitation) => {
        cancelLongPress();
        if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
        }
        if (revealedActionsId) {
            setRevealedActionsId(null);
            return;
        }
        playCustomRecitation(r);
    };

    const openAddRecitation = () => {
        setEditingRecitation(null);
        setShowRecitationForm(true);
    };

    const openEditRecitation = (r: CustomRecitation) => {
        setEditingRecitation(r);
        setShowRecitationForm(true);
    };

    const handleSaveRecitation = async (data: { surahNumber: number; surahName: string; reciterName: string; file: File | null }) => {
        setSavingRecitation(true);
        try {
            if (editingRecitation) {
                let filePath = editingRecitation.filePath;
                if (data.file) {
                    const newPath = await saveAudioFile(data.file, 'recitations');
                    await deleteAudioFile(filePath);
                    filePath = newPath;
                }
                setCustomRecitations(prev => prev.map(r => r.id === editingRecitation.id ? {
                    ...r,
                    surahNumber: data.surahNumber,
                    surahName: data.surahName,
                    reciterName: data.reciterName,
                    filePath,
                } : r));
            } else if (data.file) {
                const filePath = await saveAudioFile(data.file, 'recitations');
                const newRecitation: CustomRecitation = {
                    id: crypto.randomUUID(),
                    surahNumber: data.surahNumber,
                    surahName: data.surahName,
                    reciterName: data.reciterName,
                    filePath,
                    addedDate: Date.now(),
                    pinned: false,
                };
                setCustomRecitations(prev => [...prev, newRecitation]);
            }
            setShowRecitationForm(false);
            setEditingRecitation(null);
        } finally {
            setSavingRecitation(false);
        }
    };

    // Reorder drag: the dragged row is pulled OUT of the normal list entirely (so it can't
    // leave a gap behind) and rendered as a floating overlay that tracks the finger. The
    // remaining rows reorder underneath and FLIP-ease into their new spot as you cross them.
    // Mirrors the same pattern used for bookmarked ayahs in the reader.
    const recitationRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Tapping anywhere outside the row whose actions are currently revealed dismisses them.
    useEffect(() => {
        if (!revealedActionsId) return;
        const revealedId = revealedActionsId;
        const handleOutsideTap = (e: PointerEvent) => {
            const rowEl = recitationRowRefs.current.get(revealedId);
            if (rowEl && e.target instanceof Node && rowEl.contains(e.target)) return;
            setRevealedActionsId(null);
        };
        document.addEventListener('pointerdown', handleOutsideTap);
        return () => document.removeEventListener('pointerdown', handleOutsideTap);
    }, [revealedActionsId]);

    const recitationPrevRects = useRef<Map<string, DOMRect>>(new Map());
    const dragStartYRef = useRef(0);
    const lastSwapTargetRef = useRef<string | null>(null);
    const [dragDeltaY, setDragDeltaY] = useState(0);
    const dragDeltaYRef = useRef(0);
    const [dragOriginRect, setDragOriginRect] = useState<DOMRect | null>(null);

    const handleRecitationPointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
        const rowEl = recitationRowRefs.current.get(id);
        setDragOriginRect(rowEl ? rowEl.getBoundingClientRect() : null);
        setDraggingRecitationId(id);
        setDragDeltaY(0);
        dragDeltaYRef.current = 0;
        lastSwapTargetRef.current = null;
        dragStartYRef.current = e.clientY;
    };

    useEffect(() => {
        if (!draggingRecitationId) return;
        const draggedId = draggingRecitationId;
        const originRect = dragOriginRect;

        const handleMove = (e: PointerEvent) => {
            const delta = e.clientY - dragStartYRef.current;
            dragDeltaYRef.current = delta;
            setDragDeltaY(delta);

            const el = document.elementFromPoint(e.clientX, e.clientY);
            const row = el?.closest('[data-recitation-id]') as HTMLElement | null;
            const targetId = row?.getAttribute('data-recitation-id');
            if (!targetId || targetId === draggedId || targetId === lastSwapTargetRef.current) return;
            lastSwapTargetRef.current = targetId;

            const rects = new Map<string, DOMRect>();
            recitationRowRefs.current.forEach((rowEl, rowId) => rects.set(rowId, rowEl.getBoundingClientRect()));
            recitationPrevRects.current = rects;

            setRecitationOrder(prev => {
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
            if (originRect) {
                recitationPrevRects.current.set(draggedId, { top: originRect.top + dragDeltaYRef.current } as DOMRect);
            }
            setDraggingRecitationId(null);
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
    }, [draggingRecitationId, dragOriginRect]);

    useLayoutEffect(() => {
        const prevRects = recitationPrevRects.current;
        if (prevRects.size === 0) return;
        recitationPrevRects.current = new Map();

        recitationRowRefs.current.forEach((rowEl, id) => {
            const before = prevRects.get(id);
            if (!before) return;
            const after = rowEl.getBoundingClientRect();
            const deltaY = before.top - after.top;
            if (Math.abs(deltaY) < 1) return;

            rowEl.style.transition = 'none';
            rowEl.style.transform = `translateY(${deltaY}px)`;
            rowEl.getBoundingClientRect();
            requestAnimationFrame(() => {
                rowEl.style.transition = 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)';
                rowEl.style.transform = '';
            });
        });
    }, [recitationOrder, draggingRecitationId]);

    const renderRecitationRow = (r: CustomRecitation) => (
        <div
            key={r.id}
            ref={(el) => {
                if (el) recitationRowRefs.current.set(r.id, el);
                else recitationRowRefs.current.delete(r.id);
            }}
            data-recitation-id={r.id}
            className="relative bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-xl p-3 flex items-center gap-3"
            style={draggingRecitationId === r.id ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
        >
            {recitationSort === 'custom' && isReorderMode && (
                <button
                    onPointerDown={(e) => handleRecitationPointerDown(e, r.id)}
                    className="touch-none cursor-grab active:cursor-grabbing text-gray-400 shrink-0"
                >
                    <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                </button>
            )}
            <div
                onPointerDown={() => handleRowPointerDown(r.id)}
                onPointerUp={() => handleRowPointerUp(r)}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                className="touch-none flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none"
            >
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-lg">graphic_eq</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{r.surahName}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.reciterName}</p>
                </div>
                {nowPlaying?.type === 'custom' && nowPlaying.recitation.id === r.id && (
                    <span className="material-symbols-outlined text-primary animate-pulse shrink-0">volume_up</span>
                )}
            </div>
            {revealedActionsId === r.id && (
                <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePinRecitation(r.id); }}
                        className={`size-8 flex items-center justify-center rounded-full transition-colors ${r.pinned ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                        title={r.pinned ? t('quranFullSurahs.unpinFromMain') : t('quranFullSurahs.pinToMain')}
                    >
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: r.pinned ? "'FILL' 1" : "'FILL' 0" }}>push_pin</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setRevealedActionsId(null); openEditRecitation(r); }}
                        className="size-8 flex items-center justify-center rounded-full text-gray-400 hover:text-primary transition-colors"
                        title={t('quranFullSurahs.edit')}
                    >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteRecitation(r); }}
                        className="size-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 transition-colors"
                        title={t('quranFullSurahs.delete')}
                    >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            )}
        </div>
    );

    // Shared between the main screen and the "My Recitations" manager overlay — the manager
    // renders it too (only while a custom recitation is playing, not a full surah) so
    // playback stays controllable without having to back out of the manager first.
    const playbackBar = nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
            <div className="absolute bottom-0 h-40 w-full bg-gradient-to-t from-background-light via-background-light/90 to-transparent dark:from-background-dark dark:via-background-dark/90 pointer-events-none"></div>
            <div className="relative px-4 pb-6 pt-2 w-full max-w-[460px] mx-auto">
                <div className="bg-white/95 dark:bg-[#1A2230]/95 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 rounded-2xl shadow-xl p-3 sm:p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col justify-center min-w-0 flex-1 mr-2">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wide truncate">
                                {nowPlaying.type === 'surah' ? t('quranFullSurahs.fullSurah') : t('quranFullSurahs.customRecitation')}
                            </p>
                            <p className="text-sm text-slate-900 dark:text-white font-medium truncate">
                                {nowPlaying.type === 'surah' ? `${nowPlaying.surahName} • ${nowPlaying.reciterName}` : `${nowPlaying.recitation.surahName} • ${nowPlaying.recitation.reciterName}`}
                            </p>
                        </div>
                        <button onClick={stopPlayback} className="text-gray-400 hover:text-primary transition-colors shrink-0">
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-medium w-8 text-right shrink-0">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={1}
                            value={Math.min(currentTime, duration || 0)}
                            onChange={(e) => seekTo(Number(e.target.value))}
                            className="flex-1 accent-primary h-1.5 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-400 font-medium w-8 shrink-0">{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center justify-center gap-6">
                        <button onClick={() => skip(-10)} className="flex items-center justify-center size-9 text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-2xl">replay_10</span>
                        </button>
                        <button
                            onClick={toggleAudioPlay}
                            className="flex items-center justify-center size-12 bg-primary rounded-full text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined text-[28px]" style={{ marginLeft: '2px' }}>
                                {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                        </button>
                        <button onClick={() => skip(10)} className="flex items-center justify-center size-9 text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-2xl">forward_10</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white transition-colors duration-200 pb-32">
            <audio
                ref={audioRef}
                src={audioUrl ?? undefined}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); setNowPlaying(null); setAudioUrl(null); setCurrentTime(0); setDuration(0); }}
                onLoadedMetadata={(e) => setDuration(sanitizeDuration(e.currentTarget.duration))}
                onDurationChange={(e) => setDuration(sanitizeDuration(e.currentTarget.duration))}
                onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setCurrentTime(t);
                    if (controlsCreatedRef.current && Math.floor(t) !== lastElapsedPushRef.current) {
                        lastElapsedPushRef.current = Math.floor(t);
                        CapacitorMusicControls.updateElapsed({ elapsed: t, isPlaying: !e.currentTarget.paused });
                    }
                }}
                className="hidden"
            />

            {/* Keeps the camera safe-area opaque even once content has scrolled up against it.
                Must stay `fixed` (not `absolute`) so it stays pinned to the viewport while this
                page's own content scrolls — the mount-flash this used to cause is now fixed at
                the source (index.css's .page-transition no longer uses `transform`). */}
            <div className="fixed top-0 left-0 right-0 z-[60] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm" style={{ height: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}></div>
            <header className="sticky sticky-safe-top z-50 flex items-center gap-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 pb-2 border-b border-gray-200 dark:border-gray-800">
                <button onClick={onBack} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <div className="flex flex-col flex-1">
                    <h2 className="text-lg font-bold leading-tight">{t('quranFullSurahs.title')}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('quranFullSurahs.subtitle')}</span>
                </div>
                <button
                    onClick={() => setIsReciterSettingsOpen(true)}
                    className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0 max-w-[130px]"
                >
                    <span className="material-symbols-outlined text-lg text-primary shrink-0">person</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                        {RECITERS.find(r => r.id === pickedReciterId)?.name ?? t('quranFullSurahs.reciter')}
                    </span>
                </button>
            </header>

            <main className="px-4 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white">{t('quranFullSurahs.myRecitations')}</h3>
                    <button onClick={() => setIsManagerOpen(true)} className="flex items-center gap-1 text-primary text-sm font-bold hover:text-primary/80 transition-colors">
                        {t('quranFullSurahs.seeAll')}
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                </div>

                {pinnedRecitations.length === 0 ? (
                    <p className="text-xs text-gray-400 mb-2">{t('quranFullSurahs.noPinnedRecitations')}</p>
                ) : (
                    <div className="flex flex-col gap-2 mb-2">
                        {pinnedRecitations.map(r => (
                            <div
                                key={r.id}
                                onClick={() => playCustomRecitation(r)}
                                className="bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.99]"
                            >
                                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <span className="material-symbols-outlined text-lg">graphic_eq</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{r.surahName}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.reciterName}</p>
                                </div>
                                {nowPlaying?.type === 'custom' && nowPlaying.recitation.id === r.id && (
                                    <span className="material-symbols-outlined text-primary animate-pulse">volume_up</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>

                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('quranFullSurahs.searchPlaceholder')}
                        className="w-full pl-10 pr-3 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm focus:outline-none placeholder-gray-400 text-gray-900 dark:text-white"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    filteredSurahs.map(surah => (
                        <div
                            key={surah.number}
                            onClick={() => playSurah(surah)}
                            className="bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.99]"
                        >
                            <div className="flex items-center justify-center size-10 bg-primary/10 rounded-full text-primary font-bold text-sm shrink-0">
                                {surah.number}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{surah.englishName}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {unavailableSurah === surah.number ? t('quranFullSurahs.notAvailableForReciter') : t('quranFullSurahs.surahMeta', { translation: getSurahNameMeaning(surah, language), count: surah.numberOfAyahs })}
                                </p>
                            </div>
                            {loadingPlayback === surah.number ? (
                                <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"></div>
                            ) : nowPlaying?.type === 'surah' && nowPlaying.surahNumber === surah.number ? (
                                <span className="material-symbols-outlined text-primary animate-pulse shrink-0">volume_up</span>
                            ) : (
                                <p className="font-arabic text-xl text-gray-700 dark:text-gray-200 shrink-0">{surah.name}</p>
                            )}
                        </div>
                    ))
                )}
            </main>

            {playbackBar}

            {isReciterSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
                    <div className="absolute inset-0 bg-[#0d121b]/60 backdrop-blur-sm transition-opacity" onClick={() => setIsReciterSettingsOpen(false)}></div>
                    <div className="relative w-full sm:w-[500px] max-h-[80vh] bg-white dark:bg-[#1A2230] rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-8 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col">
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>

                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t('quranFullSurahs.reciter')}</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('quranFullSurahs.usedEveryTime')}</p>
                            </div>
                            <button
                                onClick={() => setIsReciterSettingsOpen(false)}
                                className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all shrink-0"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
                            {RECITERS.map(reciter => (
                                <div
                                    key={reciter.id}
                                    onClick={() => {
                                        setPickedReciterId(reciter.id);
                                        setIsReciterSettingsOpen(false);
                                        if (nowPlaying?.type === 'surah') {
                                            const surah = surahs.find(s => s.number === nowPlaying.surahNumber);
                                            if (surah) playSurah(surah, reciter.id);
                                        }
                                    }}
                                    className={`flex items-center p-3 rounded-2xl border cursor-pointer group transition-colors ${pickedReciterId === reciter.id ? 'bg-background-light dark:bg-gray-800/60 border-primary' : 'bg-transparent border-gray-100 dark:border-gray-700/50 hover:border-primary/50'}`}
                                >
                                    <div className="size-10 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-primary mr-4 shrink-0 overflow-hidden border border-white dark:border-gray-700 shadow-sm">
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-bold truncate ${pickedReciterId === reciter.id ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{reciter.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{reciter.subtext}</p>
                                    </div>
                                    {pickedReciterId === reciter.id && (
                                        <div className="flex size-6 items-center justify-center rounded-full bg-primary text-white shadow-sm shadow-primary/30">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isManagerOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-200"
                    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                >
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                        <div>
                            <h3 className="font-bold text-lg">{t('quranFullSurahs.myRecitations')}</h3>
                            <p className="text-xs text-gray-500">{t('quranFullSurahs.recitationsSavedCount', { count: customRecitations.length })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={openAddRecitation} className="flex items-center gap-1 text-primary text-sm font-bold hover:text-primary/80 transition-colors px-2 py-1">
                                <span className="material-symbols-outlined text-lg">add</span>
                                {t('quranFullSurahs.add')}
                            </button>
                            <button
                                onClick={() => { setIsManagerOpen(false); setIsReorderMode(false); setRevealedActionsId(null); }}
                                className="size-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                            {([
                                { key: 'quran', label: t('quranFullSurahs.sortQuranOrder') },
                                { key: 'custom', label: t('quranFullSurahs.sortCustom') },
                            ] as { key: RecitationSort; label: string }[]).map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => { setRecitationSort(opt.key); setIsReorderMode(false); }}
                                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${recitationSort === opt.key
                                        ? 'text-white bg-primary shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {recitationSort === 'custom' && sortedRecitations.length > 1 && (
                            isReorderMode ? (
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
                                        {t('quranFullSurahs.dragToReorder')}
                                    </p>
                                    <button onClick={() => setIsReorderMode(false)} className="text-[11px] font-bold text-primary">{t('quranFullSurahs.done')}</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setIsReorderMode(true); setRevealedActionsId(null); }}
                                    className="flex items-center gap-1 text-[11px] font-bold text-primary mt-2"
                                >
                                    <span className="material-symbols-outlined text-[14px]">swap_vert</span>
                                    {t('quranFullSurahs.reorder')}
                                </button>
                            )
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {sortedRecitations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center">
                                <span className="material-symbols-outlined text-4xl mb-2">library_music</span>
                                <p>{t('quranFullSurahs.noRecitationsYet')}</p>
                                <p className="text-xs mt-1 max-w-[220px]">{t('quranFullSurahs.tapAddToUpload')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sortedRecitations.map(renderRecitationRow)}
                            </div>
                        )}
                        <div className="h-6"></div>
                    </div>

                    {draggingRecitationId && dragOriginRect && (() => {
                        const dragged = customRecitations.find(x => x.id === draggingRecitationId);
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
                                className="bg-white dark:bg-card-dark border border-primary/40 rounded-xl p-3 shadow-2xl flex items-center gap-3"
                            >
                                <span className="material-symbols-outlined text-[20px] text-gray-400 shrink-0">drag_indicator</span>
                                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <span className="material-symbols-outlined text-lg">graphic_eq</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{dragged.surahName}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dragged.reciterName}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {nowPlaying?.type === 'custom' && playbackBar}
                </div>
            )}

            {confirmDeleteRecitation && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteRecitation(null)}></div>
                    <div className="relative w-full max-w-sm bg-white dark:bg-[#1A2230] rounded-2xl p-5 shadow-2xl border border-gray-100 dark:border-gray-700/50">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">{t('quranFullSurahs.deleteRecitationTitle')}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                            {t('quranFullSurahs.deleteRecitationBody', { surah: confirmDeleteRecitation.surahName, reciter: confirmDeleteRecitation.reciterName })}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteRecitation(null)}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('quranFullSurahs.cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                {t('quranFullSurahs.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <RecitationFormSheet
                isOpen={showRecitationForm}
                onClose={() => { setShowRecitationForm(false); setEditingRecitation(null); }}
                surahs={surahs}
                editing={editingRecitation}
                onSave={handleSaveRecitation}
                saving={savingRecitation}
            />
        </div>
    );
};

export default QuranFullSurahs;
