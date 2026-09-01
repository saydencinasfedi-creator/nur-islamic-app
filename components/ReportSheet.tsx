import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import CommunitySheet, { sheetField, sheetLabel, sheetPrimaryBtn, sheetChip } from './CommunitySheet';
import * as community from '../services/communityService';
import type { ReportEntityType } from '../types';
import type { TranslationKey } from '../services/i18n';

type Reason = 'spam' | 'harassment' | 'inappropriate' | 'hate' | 'misinfo' | 'other';
const REASONS: { value: Reason; key: TranslationKey }[] = [
  { value: 'spam', key: 'community.reportSpam' },
  { value: 'harassment', key: 'community.reportHarassment' },
  { value: 'inappropriate', key: 'community.reportInappropriate' },
  { value: 'hate', key: 'community.reportHate' },
  { value: 'misinfo', key: 'community.reportMisinfo' },
  { value: 'other', key: 'community.reportOther' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityType: ReportEntityType;
  entityId: string;
  groupId?: string | null;
  onDone?: () => void;
}

const ReportSheet: React.FC<Props> = ({ isOpen, onClose, entityType, entityId, groupId, onDone }) => {
  const { t } = useUser();
  const [reason, setReason] = useState<Reason>('spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (isOpen) { setReason('spam'); setDetail(''); setError(''); } }, [isOpen]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await community.reportEntity(entityType, entityId, reason, detail, groupId ?? null);
      onDone?.();
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
      title={t('community.reportTitle')}
      footer={<button onClick={submit} disabled={busy} className={sheetPrimaryBtn(!busy)}>{busy ? '…' : t('community.report')}</button>}
    >
      <div>
        <label className={sheetLabel}>{t('community.reportReasonLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {REASONS.map(r => (
            <button key={r.value} onClick={() => setReason(r.value)} className={sheetChip(reason === r.value)}>{t(r.key)}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={sheetLabel}>{t('community.reportDetailLabel')}</label>
        <textarea value={detail} onChange={e => setDetail(e.target.value.slice(0, 2000))} rows={3} className={sheetField} />
      </div>
      {error && <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}
    </CommunitySheet>
  );
};

export default ReportSheet;
