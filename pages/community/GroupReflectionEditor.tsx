import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import * as community from '../../services/communityService';
import ReflectionReferencePicker from '../../components/ReflectionReferencePicker';
import type { QuranReference, GroupReflection } from '../../types';

interface Props {
  groupId: string;
  existing?: GroupReflection | null;
  // Seeds a new reflection already tagged to this verse — e.g. "Reflect on
  // this verse" from the circle chat's Verse of the Day card. Ignored when
  // editing an existing reflection.
  prefillRef?: QuranReference | null;
  onDone: (saved: GroupReflection | null) => void;
  onCancel: () => void;
}

const GroupReflectionEditor: React.FC<Props> = ({ groupId, existing, prefillRef, onDone, onCancel }) => {
  const { t } = useUser();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.content ?? '');
  const [refs, setRefs] = useState<QuranReference[]>(existing?.quranRefs ?? (prefillRef ? [prefillRef] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.55)}px`;
  }, [body]);

  const addRef = (ref: QuranReference) => {
    const token = `[[quran:${ref.surahNumber}:${ref.ayahNumber}|${ref.surahName}]]`;
    const el = bodyRef.current;
    if (el && el.selectionStart != null) {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      setBody(`${body.slice(0, start)}${token} ${body.slice(end)}`);
    } else {
      setBody(b => (b ? `${b} ${token}` : token));
    }
    setRefs(prev => (prev.some(r => r.surahNumber === ref.surahNumber && r.ayahNumber === ref.ayahNumber) ? prev : [...prev, ref]));
    setShowPicker(false);
  };

  const canSave = (title.trim() || body.trim()) && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      const draft = { title: title.trim() || undefined, content: body, quranRefs: refs };
      if (existing) {
        await community.updateGroupReflection(existing.id, draft);
        onDone(await community.getGroupReflection(existing.id));
      } else {
        onDone(await community.createGroupReflection(groupId, draft));
      }
    } catch (e: any) {
      setError(e?.message || t('community.errorGeneric'));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      <header className="flex items-center gap-3 p-6 pt-12 pb-4">
        <button onClick={onCancel} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight flex-1 truncate">{existing ? t('community.editReflection') : t('community.newReflection')}</h1>
        <button
          onClick={save}
          disabled={!canSave}
          className={`px-4 py-2 rounded-full text-sm font-bold ${canSave ? 'bg-primary text-background-dark' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}
        >
          {busy ? '…' : t('community.publish')}
        </button>
      </header>

      <div className="flex-1 px-6 pb-10 space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('community.reflectionTitlePlaceholder')}
          className="w-full bg-transparent text-xl font-bold text-slate-900 dark:text-white placeholder-gray-400 outline-none"
        />
        <textarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={t('community.reflectionBodyPlaceholder')}
          className="w-full bg-transparent text-slate-900 dark:text-white placeholder-gray-400 outline-none resize-none leading-relaxed"
          rows={6}
        />
        {refs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {refs.map(r => (
              <span key={`${r.surahNumber}:${r.ayahNumber}`} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>menu_book</span>
                {r.surahName} {r.surahNumber}:{r.ayahNumber}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {t('community.addQuranRef')}
        </button>
        {error && <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}
      </div>

      <ReflectionReferencePicker isOpen={showPicker} onClose={() => setShowPicker(false)} onAdd={addRef} existing={refs} />
    </div>
  );
};

export default GroupReflectionEditor;
