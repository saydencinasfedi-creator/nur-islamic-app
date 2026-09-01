import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageId, QuranReference, Reflection } from '../types';
import { useUser } from '../contexts/UserContext';
import { formatGregorianDate } from '../services/dateFormat';
import { pushBackHandler } from '../services/backHandlerStack';
import {
    consumePendingReflectionDraft,
    consumePendingOpenReflectionId,
    setPendingQuranTarget,
    setReturnToReflectionId,
} from '../services/reflectionsNav';
import MarkdownContent, { quranTokenToText } from '../components/MarkdownContent';
import ReflectionReferencePicker from '../components/ReflectionReferencePicker';
import GroupPickerSheet from '../components/GroupPickerSheet';
import { getAyahTranslations } from '../services/quranService';
import { useAuth } from '../contexts/AuthContext';
import * as community from '../services/communityService';
import type { Group } from '../types';

const TOKEN_SCAN_RE = /\[\[quran:(\d{1,3}):(\d{1,4})/g;

interface ReflectionsProps {
    navigate: (page: PageId) => void;
    onBack: () => void;
}

type View = 'list' | 'detail' | 'editor';
type SortMode = 'newest' | 'oldest' | 'updated';
type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';

const DRAFT_KEY = 'nurReflectionDraft';

const stripMarkdown = (md: string): string =>
    quranTokenToText(md)
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#*_`>~]/g, '')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

const refLabel = (r: QuranReference) => `${r.surahName} ${r.surahNumber}:${r.ayahNumber}`;

const ScreenHeader: React.FC<{ title: string; onBackClick: () => void; right?: React.ReactNode }> = ({ title, onBackClick, right }) => (
    <header className="flex items-center gap-3 p-6 pt-12 pb-4 bg-background-light dark:bg-background-dark z-10">
        <button onClick={onBackClick} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
            <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight flex-1 truncate">{title}</h1>
        {right}
    </header>
);

const ConfirmModal: React.FC<{
    title: string; body: string; cancelLabel: string; confirmLabel: string;
    onCancel: () => void; onConfirm: () => void;
}> = ({ title, body, cancelLabel, confirmLabel, onCancel, onConfirm }) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-6" onClick={onCancel}>
        <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{body}</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    {cancelLabel}
                </button>
                <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

const Reflections: React.FC<ReflectionsProps> = ({ navigate, onBack }) => {
    const {
        t, language, reflections, tags,
        addReflection, updateReflection, deleteReflection, resolveTagNames, deleteTag,
    } = useUser();

    const [view, setView] = useState<View>('list');
    const [activeId, setActiveId] = useState<string | null>(null);

    // list controls
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sort, setSort] = useState<SortMode>('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
    const [filterSurah, setFilterSurah] = useState<number | null>(null);
    const [filterDate, setFilterDate] = useState<DateRange>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [visibleCount, setVisibleCount] = useState(20);

    // editor state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const [draftRefs, setDraftRefs] = useState<QuranReference[]>([]);
    const [draftTagNames, setDraftTagNames] = useState<string[]>([]);
    const [tagQuery, setTagQuery] = useState('');
    const [showRefPicker, setShowRefPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'list' | 'inline'>('list');
    const [saveError, setSaveError] = useState(false);

    // deletes
    const [deleteTarget, setDeleteTarget] = useState<Reflection | null>(null);
    const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null);

    // share a reflection into a Community circle (server-side copy, never a move)
    const { bypassed: authBypassed, isGuest } = useAuth();
    const [shareTarget, setShareTarget] = useState<Reflection | null>(null);
    const [shareGroups, setShareGroups] = useState<Group[]>([]);
    const [shareConfirm, setShareConfirm] = useState<{ reflection: Reflection; group: Group } | null>(null);
    const [shareBusy, setShareBusy] = useState(false);
    const communityEnabled = !authBypassed && !isGuest;
    const openShare = (r: Reflection) => {
        setShareTarget(r);
        community.listMyGroups().then(gs => setShareGroups(gs.filter(g => g.myStatus === 'active'))).catch(() => setShareGroups([]));
    };
    const doShare = async () => {
        if (!shareConfirm || shareBusy) return;
        setShareBusy(true);
        try {
            await community.sharePersonalReflection(shareConfirm.reflection, shareConfirm.group.id);
            setShareConfirm(null);
            setShareTarget(null);
        } catch { /* ignore */ } finally { setShareBusy(false); }
    };

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const tagName = useCallback(
        (id: string) => tags.find(tg => tg.id === id)?.name ?? '',
        [tags]
    );

    const openEditor = useCallback((r: Reflection | null, prefillRefs?: QuranReference[]) => {
        if (r) {
            setEditingId(r.id);
            setDraftTitle(r.title);
            setDraftContent(r.content);
            setDraftRefs(r.quranRefs);
            setDraftTagNames(r.tagIds.map(tagName).filter(Boolean));
        } else {
            setEditingId(null);
            setDraftTitle('');
            setDraftContent('');
            setDraftRefs(prefillRefs ?? []);
            setDraftTagNames([]);
        }
        setTagQuery('');
        setSaveError(false);
        setView('editor');
    }, [tagName]);

    // Mount: honour a hand-off (new reflection from an ayah, or "reopen this reflection"),
    // otherwise restore an interrupted autosaved draft.
    useEffect(() => {
        const draft = consumePendingReflectionDraft();
        if (draft) {
            openEditor(null, draft.quranRefs);
            return;
        }
        const openId = consumePendingOpenReflectionId();
        if (openId && reflections.some(r => r.id === openId)) {
            setActiveId(openId);
            setView('detail');
            return;
        }
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const d = JSON.parse(saved);
                setEditingId(d.editingId ?? null);
                setDraftTitle(d.title ?? '');
                setDraftContent(d.content ?? '');
                setDraftRefs(Array.isArray(d.quranRefs) ? d.quranRefs : []);
                setDraftTagNames(Array.isArray(d.tagNames) ? d.tagNames : []);
                setSaveError(false);
                setView('editor');
            }
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounce search.
    useEffect(() => {
        const h = setTimeout(() => setDebouncedSearch(search), 150);
        return () => clearTimeout(h);
    }, [search]);

    // Reset the window when the query changes.
    useEffect(() => { setVisibleCount(20); }, [debouncedSearch, sort, filterTagIds, filterSurah, filterDate, customFrom, customTo]);

    // Hardware back per view.
    useEffect(() => {
        return pushBackHandler(() => {
            if (view === 'editor') { setView(editingId ? 'detail' : 'list'); return true; }
            if (view === 'detail') { setView('list'); return true; }
            onBack();
            return true;
        });
    }, [view, editingId, onBack]);

    // Autosave the editor draft (only once there's something worth keeping, so opening a
    // blank editor never clobbers a previously stored draft).
    useEffect(() => {
        if (view !== 'editor') return;
        if (!draftTitle.trim() && !draftContent.trim() && draftRefs.length === 0 && draftTagNames.length === 0) return;
        const h = setTimeout(() => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({
                    editingId, title: draftTitle, content: draftContent, quranRefs: draftRefs, tagNames: draftTagNames,
                }));
            } catch { /* quota — non-fatal */ }
        }, 500);
        return () => clearTimeout(h);
    }, [view, editingId, draftTitle, draftContent, draftRefs, draftTagNames]);

    // Grow the reflection textarea with its content.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el || view !== 'editor') return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.6))}px`;
    }, [draftContent, view]);

    const activeReflection = useMemo(
        () => reflections.find(r => r.id === activeId) ?? null,
        [reflections, activeId]
    );

    // If the reflection being viewed disappears (deleted elsewhere), fall back to the list.
    useEffect(() => {
        if (view === 'detail' && !activeReflection) setView('list');
    }, [view, activeReflection]);

    // Ayah text for the detail view: snapshots stored on the reference are used first;
    // anything missing (older reflections) is fetched once per surah and cached in memory.
    const seededAyahText = useMemo(() => {
        const m: Record<string, string> = {};
        activeReflection?.quranRefs.forEach(r => {
            if (r.ayahText) m[`${r.surahNumber}:${r.ayahNumber}`] = r.ayahText;
        });
        return m;
    }, [activeReflection]);
    const [fetchedAyahText, setFetchedAyahText] = useState<Record<string, string>>({});
    const ayahTextFor = useCallback(
        (s: number, a: number) => seededAyahText[`${s}:${a}`] ?? fetchedAyahText[`${s}:${a}`],
        [seededAyahText, fetchedAyahText]
    );

    useEffect(() => {
        if (view !== 'detail' || !activeReflection) return;
        const surahsToFetch = new Set<number>();
        activeReflection.quranRefs.forEach(r => {
            if (!r.ayahText) surahsToFetch.add(r.surahNumber);
        });
        for (const m of activeReflection.content.matchAll(TOKEN_SCAN_RE)) {
            if (!seededAyahText[`${m[1]}:${m[2]}`]) surahsToFetch.add(Number(m[1]));
        }
        if (surahsToFetch.size === 0) return;
        let cancelled = false;
        (async () => {
            for (const s of surahsToFetch) {
                const list = await getAyahTranslations(s, language);
                if (cancelled) return;
                setFetchedAyahText(prev => {
                    const next = { ...prev };
                    list.forEach(it => { next[`${s}:${it.numberInSurah}`] = it.text; });
                    return next;
                });
            }
        })();
        return () => { cancelled = true; };
    }, [view, activeReflection, language, seededAyahText]);

    const surahsInUse = useMemo(() => {
        const map = new Map<number, string>();
        reflections.forEach(r => r.quranRefs.forEach(ref => {
            if (!map.has(ref.surahNumber)) map.set(ref.surahNumber, ref.surahName);
        }));
        return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name }));
    }, [reflections]);

    const matchesSearch = useCallback((r: Reflection, raw: string) => {
        const q = raw.trim().toLowerCase();
        if (!q) return true;
        if (r.title.toLowerCase().includes(q)) return true;
        if (r.content.toLowerCase().includes(q)) return true;
        if (r.tagIds.map(tagName).join(' ').toLowerCase().includes(q)) return true;
        if (r.quranRefs.some(ref => ref.surahName.toLowerCase().includes(q))) return true;
        const pair = q.match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
        if (pair && r.quranRefs.some(ref => ref.surahNumber === +pair[1] && ref.ayahNumber === +pair[2])) return true;
        if (/^\d{1,3}$/.test(q) && r.quranRefs.some(ref => ref.surahNumber === +q)) return true;
        return false;
    }, [tagName]);

    const inDateRange = useCallback((r: Reflection) => {
        if (filterDate === 'all') return true;
        const now = new Date();
        if (filterDate === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); return r.createdAt >= s.getTime(); }
        if (filterDate === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); return r.createdAt >= s.getTime(); }
        if (filterDate === 'month') { const s = new Date(now); s.setMonth(s.getMonth() - 1); return r.createdAt >= s.getTime(); }
        const from = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : -Infinity;
        const to = customTo ? new Date(`${customTo}T23:59:59`).getTime() : Infinity;
        return r.createdAt >= from && r.createdAt <= to;
    }, [filterDate, customFrom, customTo]);

    const filtered = useMemo(() => {
        const list = reflections.filter(r =>
            matchesSearch(r, debouncedSearch) &&
            (filterTagIds.length === 0 || filterTagIds.some(id => r.tagIds.includes(id))) &&
            (filterSurah === null || r.quranRefs.some(ref => ref.surahNumber === filterSurah)) &&
            inDateRange(r)
        );
        const sorted = [...list];
        if (sort === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt);
        else if (sort === 'oldest') sorted.sort((a, b) => a.createdAt - b.createdAt);
        else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
        return sorted;
    }, [reflections, debouncedSearch, matchesSearch, filterTagIds, filterSurah, inDateRange, sort]);

    const visible = filtered.slice(0, visibleCount);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (view !== 'list') return;
        const el = sentinelRef.current;
        if (!el || visibleCount >= filtered.length) return;
        const obs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) setVisibleCount(c => c + 20);
        }, { rootMargin: '400px' });
        obs.observe(el);
        return () => obs.disconnect();
    }, [view, visibleCount, filtered.length]);

    const activeFilterCount =
        (filterTagIds.length ? 1 : 0) + (filterSurah !== null ? 1 : 0) + (filterDate !== 'all' ? 1 : 0);

    const clearFilters = () => {
        setFilterTagIds([]);
        setFilterSurah(null);
        setFilterDate('all');
        setCustomFrom('');
        setCustomTo('');
    };

    const addTagFromInput = () => {
        const name = tagQuery.trim().replace(/,$/, '').trim();
        if (!name) return;
        const exists = draftTagNames.some(n => n.toLowerCase() === name.toLowerCase());
        if (!exists) setDraftTagNames(prev => [...prev, name]);
        setTagQuery('');
    };

    const doSave = () => {
        const title = draftTitle.trim();
        const content = draftContent.trim();
        if (!title && !content) return;
        try {
            const tagIds = resolveTagNames(draftTagNames);
            if (editingId) {
                updateReflection(editingId, { title, content, quranRefs: draftRefs, tagIds });
                setActiveId(editingId);
            } else {
                const id = addReflection({ title, content, quranRefs: draftRefs, tagIds });
                setActiveId(id);
            }
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            setSaveError(false);
            setView('detail');
        } catch {
            setSaveError(true);
        }
    };

    const openQuranAt = useCallback((surahNumber: number, ayahNumber: number) => {
        if (activeReflection) setReturnToReflectionId(activeReflection.id);
        setPendingQuranTarget({ surahNumber, ayahNumber });
        navigate('quran');
    }, [activeReflection, navigate]);

    const openRef = (ref: QuranReference) => openQuranAt(ref.surahNumber, ref.ayahNumber);

    const openPicker = (mode: 'list' | 'inline') => {
        setPickerMode(mode);
        setShowRefPicker(true);
    };

    const insertRefToken = (ref: QuranReference) => {
        const token = `[[quran:${ref.surahNumber}:${ref.ayahNumber}|${ref.surahName}]]`;
        const el = textareaRef.current;
        const start = el ? el.selectionStart : draftContent.length;
        const end = el ? el.selectionEnd : draftContent.length;
        const before = draftContent.slice(0, start);
        const after = draftContent.slice(end);
        const pad = (s: string, trailing: boolean) => (s && !(trailing ? /^\s/ : /\s$/).test(s) ? ' ' : '');
        const chunk = `${pad(before, false)}${token}${pad(after, true)}`;
        const next = before + chunk + after;
        setDraftContent(next);
        if (!draftRefs.some(r => r.surahNumber === ref.surahNumber && r.ayahNumber === ref.ayahNumber)) {
            setDraftRefs(prev => [...prev, ref]);
        }
        requestAnimationFrame(() => {
            if (!el) return;
            const pos = (before + chunk).length;
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    };

    const onPickerAdd = (ref: QuranReference) => {
        if (pickerMode === 'inline') insertRefToken(ref);
        else setDraftRefs(prev => [...prev, ref]);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        deleteReflection(deleteTarget.id);
        try { if (editingId === deleteTarget.id) localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setDeleteTarget(null);
        setView('list');
    };

    const tagSuggestions = tags
        .filter(tg =>
            tg.name.toLowerCase().includes(tagQuery.trim().toLowerCase()) &&
            !draftTagNames.some(n => n.toLowerCase() === tg.name.toLowerCase())
        )
        .slice(0, 6);

    const canSave = draftTitle.trim().length > 0 || draftContent.trim().length > 0;

    // ---------- LIST ----------

    const renderList = () => (
        <>
            <ScreenHeader
                title={t('reflections.title')}
                onBackClick={onBack}
                right={
                    <button
                        onClick={() => openEditor(null)}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-2xl">add</span>
                    </button>
                }
            />

            <div className="px-6">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">search</span>
                    </div>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full pl-12 pr-4 py-3.5 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm shadow-soft"
                        placeholder={t('reflections.searchPlaceholder')}
                        type="text"
                    />
                </div>
            </div>

            {reflections.length > 0 && (
                <div className="flex items-center justify-between gap-2 px-6 mt-4">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t('reflections.countLabel', { count: filtered.length })}
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setShowSortMenu(o => !o)}
                                className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-100 dark:border-white/5 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">swap_vert</span>
                            </button>
                            {showSortMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                                    <div className="absolute right-0 top-12 z-50 w-52 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl shadow-xl p-1.5">
                                        {([
                                            ['newest', 'reflections.sortNewest'],
                                            ['oldest', 'reflections.sortOldest'],
                                            ['updated', 'reflections.sortUpdated'],
                                        ] as const).map(([key, label]) => (
                                            <button
                                                key={key}
                                                onClick={() => { setSort(key); setShowSortMenu(false); }}
                                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${sort === key ? 'bg-primary/10 text-primary' : 'text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                            >
                                                {t(label)}
                                                {sort === key && <span className="material-symbols-outlined text-[18px]">check</span>}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(true)}
                            className="relative size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-100 dark:border-white/5 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">tune</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 size-5 rounded-full bg-primary text-background-dark text-[10px] font-bold flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-4 pb-28">
                {reflections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5 text-primary">
                            <span className="material-symbols-outlined text-3xl">menu_book</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reflections.emptyTitle')}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6 max-w-[16rem]">{t('reflections.emptyBody')}</p>
                        <button
                            onClick={() => openEditor(null)}
                            className="px-5 py-3 rounded-xl bg-primary text-background-dark font-bold text-sm shadow-glow hover:scale-105 transition-transform"
                        >
                            {t('reflections.emptyCta')}
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                        <p className="text-sm">{t('reflections.noResults')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visible.map(r => (
                            <button
                                key={r.id}
                                onClick={() => { setActiveId(r.id); setView('detail'); }}
                                className="w-full text-left bg-white dark:bg-card-dark rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm hover:border-gray-200 dark:hover:border-white/10 transition-all active:scale-[0.99]"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{r.title || t('reflections.addTitle')}</h3>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatGregorianDate(new Date(r.createdAt), language)}</p>
                                    </div>
                                </div>
                                {r.content.trim() && (
                                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mt-3 line-clamp-2">{stripMarkdown(r.content)}</p>
                                )}
                                {r.tagIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {r.tagIds.map(tagName).filter(Boolean).slice(0, 4).map((name, i) => (
                                            <span key={i} className="text-[11px] font-medium text-primary bg-primary/10 border border-primary/15 px-2 py-0.5 rounded-full">#{name}</span>
                                        ))}
                                    </div>
                                )}
                                {r.quranRefs.length > 0 && (
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">menu_book</span>
                                        {r.quranRefs.length === 1
                                            ? refLabel(r.quranRefs[0])
                                            : t('reflections.refCount', { count: r.quranRefs.length })}
                                    </p>
                                )}
                            </button>
                        ))}
                        {visibleCount < filtered.length && <div ref={sentinelRef} className="h-8" />}
                    </div>
                )}
            </div>
        </>
    );

    // ---------- DETAIL ----------

    const renderDetail = () => {
        if (!activeReflection) return null;
        const r = activeReflection;
        const edited = r.updatedAt - r.createdAt > 60_000;
        return (
            <>
                <ScreenHeader
                    title=""
                    onBackClick={() => setView('list')}
                    right={
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openEditor(r)}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl">edit</span>
                            </button>
                            <button
                                onClick={() => setDeleteTarget(r)}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                        </div>
                    }
                />
                <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-28">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{r.title || t('reflections.addTitle')}</h1>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        {formatGregorianDate(new Date(r.createdAt), language)}
                        {edited && <span className="ml-2 opacity-70">· {t('reflections.editedOn', { date: formatGregorianDate(new Date(r.updatedAt), language) })}</span>}
                    </p>

                    {r.content.trim() && (
                        <div className="mt-6 text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">
                            <MarkdownContent onQuranRef={openQuranAt} resolveAyahText={ayahTextFor}>{r.content}</MarkdownContent>
                        </div>
                    )}

                    {r.quranRefs.length > 0 && (
                        <div className="mt-8">
                            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary opacity-80 mb-3">
                                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                                {t('reflections.referencesLabel')}
                            </h2>
                            <div className="space-y-2">
                                {r.quranRefs.map((ref, i) => {
                                    const text = ayahTextFor(ref.surahNumber, ref.ayahNumber);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => openRef(ref)}
                                            className="w-full flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 hover:border-primary/30 dark:hover:border-primary/30 transition-colors text-left active:scale-[0.99]"
                                        >
                                            <span className="material-symbols-outlined text-primary mt-0.5">menu_book</span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-bold text-slate-900 dark:text-white text-sm">{ref.surahName} {ref.surahNumber}:{ref.ayahNumber}</span>
                                                {text && <span className="block text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">{text}</span>}
                                            </span>
                                            <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 mt-0.5">chevron_right</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {r.tagIds.length > 0 && (
                        <div className="mt-8">
                            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary opacity-80 mb-3">
                                <span className="material-symbols-outlined text-[16px]">sell</span>
                                {t('reflections.tagsLabel')}
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {r.tagIds.map(tagName).filter(Boolean).map((name, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            const id = tags.find(tg => tg.name === name)?.id;
                                            if (id) { setFilterTagIds([id]); setView('list'); }
                                        }}
                                        className="text-sm font-medium text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
                                    >
                                        #{name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {communityEnabled && (
                        <button
                            onClick={() => openShare(r)}
                            className="mt-10 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-primary/30 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">groups</span>
                            {t('community.shareToCommunity')}
                        </button>
                    )}
                </div>
            </>
        );
    };

    // ---------- EDITOR ----------

    const renderEditor = () => (
        <>
            <ScreenHeader
                title={editingId ? t('reflections.editTitle') : t('reflections.addTitle')}
                onBackClick={() => setView(editingId ? 'detail' : 'list')}
                right={
                    <button
                        onClick={doSave}
                        disabled={!canSave}
                        className={`text-base font-bold px-2 transition-opacity ${canSave ? 'text-primary hover:opacity-80' : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
                    >
                        {t('common.save')}
                    </button>
                }
            />
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-28 space-y-5">
                {saveError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
                        {t('reflections.saveError')}
                    </div>
                )}

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('reflections.titleLabel')}</label>
                    <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder={t('reflections.titlePlaceholder')}
                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('reflections.bodyLabel')}</label>
                        <button
                            onClick={() => openPicker('inline')}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:opacity-80 transition-opacity"
                        >
                            <span className="material-symbols-outlined text-[16px]">menu_book</span>
                            {t('reflections.insertReference')}
                        </button>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        placeholder={t('reflections.bodyPlaceholder')}
                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-4 text-base leading-relaxed resize-none min-h-[200px]"
                    />
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{t('reflections.markdownHint')}</p>
                    {draftContent.includes('[[quran:') && (
                        <p className="text-[11px] text-primary/80 mt-1">{t('reflections.inlineRefHint')}</p>
                    )}
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('reflections.referencesLabel')}</label>
                    <div className="space-y-2">
                        {draftRefs.map((ref, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
                                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">menu_book</span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{ref.surahName} {ref.surahNumber}:{ref.ayahNumber}</span>
                                    {ref.ayahText && <span className="block text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5 line-clamp-2">{ref.ayahText}</span>}
                                </span>
                                <button
                                    onClick={() => setDraftRefs(prev => prev.filter((_, idx) => idx !== i))}
                                    className="size-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => openPicker('list')}
                        className="mt-2 w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-white/15 text-sm font-bold text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        {t('reflections.addReference')}
                    </button>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('reflections.tagsLabel')}</label>
                    {draftTagNames.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {draftTagNames.map((name, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-sm">
                                    #{name}
                                    <button
                                        onClick={() => setDraftTagNames(prev => prev.filter((_, idx) => idx !== i))}
                                        className="hover:text-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <input
                        type="text"
                        value={tagQuery}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v.endsWith(',')) { setTagQuery(v); addTagFromInput(); }
                            else setTagQuery(v);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); } }}
                        placeholder={t('reflections.addTagPlaceholder')}
                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3 text-sm"
                    />
                    {tagQuery.trim() && tagSuggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {tagSuggestions.map(tg => (
                                <button
                                    key={tg.id}
                                    onClick={() => { setDraftTagNames(prev => [...prev, tg.name]); setTagQuery(''); }}
                                    className="text-xs font-medium bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300"
                                >
                                    #{tg.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={doSave}
                    disabled={!canSave}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-colors ${canSave ? 'bg-primary text-background-dark hover:bg-primary/90 shadow-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
                >
                    {t('reflections.save')}
                </button>
            </div>
        </>
    );

    // ---------- FILTERS SHEET ----------

    const renderFiltersSheet = () => (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)}></div>
            <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between mb-5 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('reflections.filters')}</h2>
                    <button onClick={() => setShowFilters(false)} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                </div>

                <div className="overflow-y-auto no-scrollbar space-y-6 pb-4">
                    {tags.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('reflections.byTag')}</h3>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tg => {
                                    const on = filterTagIds.includes(tg.id);
                                    return (
                                        <button
                                            key={tg.id}
                                            onClick={() => setFilterTagIds(prev => on ? prev.filter(id => id !== tg.id) : [...prev, tg.id])}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${on ? 'bg-primary text-white shadow-glow' : 'bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                                        >
                                            #{tg.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {surahsInUse.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('reflections.bySurah')}</h3>
                            <div className="flex flex-wrap gap-2">
                                {surahsInUse.map(s => {
                                    const on = filterSurah === s.number;
                                    return (
                                        <button
                                            key={s.number}
                                            onClick={() => setFilterSurah(on ? null : s.number)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${on ? 'bg-primary text-white shadow-glow' : 'bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                                        >
                                            {s.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('reflections.byDate')}</h3>
                        <div className="flex flex-wrap gap-2">
                            {([
                                ['today', 'reflections.dateToday'],
                                ['week', 'reflections.dateWeek'],
                                ['month', 'reflections.dateMonth'],
                                ['all', 'reflections.dateAll'],
                                ['custom', 'reflections.dateCustom'],
                            ] as const).map(([key, label]) => {
                                const on = filterDate === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setFilterDate(key)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${on ? 'bg-primary text-white shadow-glow' : 'bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                                    >
                                        {t(label)}
                                    </button>
                                );
                            })}
                        </div>
                        {filterDate === 'custom' && (
                            <div className="flex items-center gap-3 mt-3">
                                <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('reflections.dateFrom')}
                                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white p-2.5 text-sm" />
                                </label>
                                <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('reflections.dateTo')}
                                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white p-2.5 text-sm" />
                                </label>
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('reflections.manageTags')}</h3>
                        {tags.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500">{t('reflections.noTagsYet')}</p>
                        ) : (
                            <div className="space-y-1.5">
                                {tags.map(tg => (
                                    <div key={tg.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5">
                                        <span className="text-sm text-slate-700 dark:text-gray-200">#{tg.name}</span>
                                        <button
                                            onClick={() => setDeleteTagTarget(tg.id)}
                                            className="size-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 pt-4 shrink-0">
                    <button onClick={clearFilters} className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                        {t('reflections.clearAll')}
                    </button>
                    <button onClick={() => setShowFilters(false)} className="flex-1 py-3 rounded-xl font-bold bg-primary text-background-dark shadow-glow hover:bg-primary/90 transition-colors">
                        {t('reflections.apply')}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display">
            {view === 'list' && renderList()}
            {view === 'detail' && renderDetail()}
            {view === 'editor' && renderEditor()}

            {showFilters && renderFiltersSheet()}

            <ReflectionReferencePicker
                isOpen={showRefPicker}
                onClose={() => setShowRefPicker(false)}
                existing={pickerMode === 'list' ? draftRefs : []}
                onAdd={onPickerAdd}
            />

            <GroupPickerSheet
                isOpen={!!shareTarget}
                onClose={() => setShareTarget(null)}
                groups={shareGroups}
                onPick={g => shareTarget && setShareConfirm({ reflection: shareTarget, group: g })}
            />
            {shareConfirm && (
                <ConfirmModal
                    title={t('community.shareToCommunity')}
                    body={t('community.shareConfirm', { name: shareConfirm.group.name })}
                    cancelLabel={t('common.cancel')}
                    confirmLabel={t('community.shareCta')}
                    onCancel={() => setShareConfirm(null)}
                    onConfirm={doShare}
                />
            )}

            {deleteTarget && (
                <ConfirmModal
                    title={t('reflections.deleteConfirmTitle')}
                    body={t('reflections.deleteConfirmBody')}
                    cancelLabel={t('common.cancel')}
                    confirmLabel={t('common.delete')}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                />
            )}
            {deleteTagTarget && (
                <ConfirmModal
                    title={t('reflections.deleteTagConfirmTitle')}
                    body={t('reflections.deleteTagConfirmBody')}
                    cancelLabel={t('common.cancel')}
                    confirmLabel={t('common.delete')}
                    onCancel={() => setDeleteTagTarget(null)}
                    onConfirm={() => {
                        deleteTag(deleteTagTarget);
                        setFilterTagIds(prev => prev.filter(id => id !== deleteTagTarget));
                        setDeleteTagTarget(null);
                    }}
                />
            )}
        </div>
    );
};

export default Reflections;
