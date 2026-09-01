import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import CommunitySheet, { sheetField, sheetLabel, sheetPrimaryBtn } from './CommunitySheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (body: string, isAnonymous: boolean) => Promise<void>;
}

const DuaComposeSheet: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useUser();
  const [body, setBody] = useState('');
  const [anon, setAnon] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBody(''); setAnon(true); setError('');
  }, [isOpen]);

  const canSave = body.trim().length >= 3 && !busy;
  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(body.trim(), anon);
      onClose();
    } catch (e: any) {
      setError(e?.message || t('community.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommunitySheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('community.postDuaRequest')}
      footer={
        <button onClick={submit} disabled={!canSave} className={sheetPrimaryBtn(canSave)}>
          {busy ? '…' : t('community.post')}
        </button>
      }
    >
      <div>
        <label className={sheetLabel}>{t('community.duaBodyLabel')}</label>
        <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 500))} placeholder={t('community.duaBodyPlaceholder')} rows={4} className={sheetField} autoFocus />
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-right">{body.length}/500</p>
      </div>
      <label className="flex items-center justify-between py-1 cursor-pointer">
        <span className="text-sm text-slate-900 dark:text-white">{t('community.postAnonymously')}</span>
        <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} className="size-5 accent-primary" />
      </label>
      {error && <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}
    </CommunitySheet>
  );
};

export default DuaComposeSheet;
