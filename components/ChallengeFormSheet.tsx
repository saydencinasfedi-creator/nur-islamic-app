import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import CommunitySheet, { sheetField, sheetLabel, sheetPrimaryBtn, sheetChip } from './CommunitySheet';
import IconPickerSheet from './IconPickerSheet';
import GoalIcon from './GoalIcon';
import type { Group, ChallengeNotifyFrequency } from '../types';
import type { ChallengeDraft } from '../services/communityService';
import type { TranslationKey } from '../services/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  myCircles: Group[];              // circles the viewer can create/propose challenges in
  lockedGroupId?: string | null;   // when opened from inside a circle
  submitLabelForTarget: (groupId: string | null) => string; // "Create" vs "Send for approval"
  onSubmit: (draft: ChallengeDraft) => Promise<void>;
}

const DURATIONS = [7, 30];
const FREQS: { value: ChallengeNotifyFrequency; key: TranslationKey }[] = [
  { value: 'none', key: 'community.notifyNone' },
  { value: 'daily', key: 'community.notifyDaily' },
  { value: 'fridays', key: 'community.notifyFridays' },
];

const ChallengeFormSheet: React.FC<Props> = ({ isOpen, onClose, myCircles, lockedGroupId, submitLabelForTarget, onSubmit }) => {
  const { t } = useUser();
  const [target, setTarget] = useState<string | null>(lockedGroupId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | undefined>('local_fire_department');
  const [showIcon, setShowIcon] = useState(false);
  const [durationPreset, setDurationPreset] = useState<number | 'custom'>(7);
  const [customDays, setCustomDays] = useState('14');
  const [freq, setFreq] = useState<ChallengeNotifyFrequency>('none');
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setTarget(lockedGroupId ?? null);
    setTitle(''); setDescription(''); setIcon('local_fire_department');
    setDurationPreset(7); setCustomDays('14'); setFreq('none'); setTime('09:00');
  }, [isOpen, lockedGroupId]);

  const durationDays = durationPreset === 'custom' ? Math.max(1, parseInt(customDays, 10) || 0) : durationPreset;
  const canSave = title.trim().length >= 2 && durationDays >= 1 && !busy && (freq === 'none' || !!time);

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        groupId: target,
        title: title.trim(),
        description: description.trim() || undefined,
        icon: icon ?? null,
        durationDays,
        notifyFrequency: freq,
        notifyAt: freq === 'none' ? null : time,
      });
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
      title={t('community.newChallenge')}
      footer={
        <button onClick={submit} disabled={!canSave} className={sheetPrimaryBtn(canSave)}>
          {busy ? '…' : submitLabelForTarget(target)}
        </button>
      }
    >
      {!lockedGroupId && (
        <div>
          <label className={sheetLabel}>{t('community.challengeTargetLabel')}</label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTarget(null)} className={sheetChip(target === null)}>{t('community.targetGlobal')}</button>
            {myCircles.map(g => (
              <button key={g.id} onClick={() => setTarget(g.id)} className={sheetChip(target === g.id)}>{g.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowIcon(true)}
          className="size-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-primary shrink-0"
        >
          <GoalIcon
            icon={icon && !icon.startsWith('data:') ? icon : 'local_fire_department'}
            iconImage={icon && icon.startsWith('data:') ? icon : undefined}
            className="material-symbols-outlined text-2xl w-10 h-10"
          />
        </button>
        <div className="flex-1">
          <label className={sheetLabel}>{t('community.challengeTitleLabel')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('community.challengeTitlePlaceholder')} className={sheetField} autoFocus />
        </div>
      </div>

      <div>
        <label className={sheetLabel}>{t('community.challengeDescLabel')}</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('community.challengeDescPlaceholder')} rows={2} className={sheetField} />
      </div>

      <div>
        <label className={sheetLabel}>{t('community.challengeDurationLabel')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map(d => (
            <button key={d} onClick={() => setDurationPreset(d)} className={sheetChip(durationPreset === d)}>
              {t('community.durationDaysN', { count: d })}
            </button>
          ))}
          <button onClick={() => setDurationPreset('custom')} className={sheetChip(durationPreset === 'custom')}>{t('community.durationCustom')}</button>
          {durationPreset === 'custom' && (
            <input
              inputMode="numeric"
              value={customDays}
              onChange={e => setCustomDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder={t('community.customDaysPlaceholder')}
              className={`${sheetField} w-20 py-1.5`}
            />
          )}
        </div>
      </div>

      <div>
        <label className={sheetLabel}>{t('community.notifyLabel')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {FREQS.map(f => (
            <button key={f.value} onClick={() => setFreq(f.value)} className={sheetChip(freq === f.value)}>{t(f.key)}</button>
          ))}
          {freq !== 'none' && (
            <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              {t('community.notifyTimeLabel')}
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={`${sheetField} w-28 py-1.5`} />
            </span>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}

      <IconPickerSheet
        isOpen={showIcon}
        onClose={() => setShowIcon(false)}
        onSelect={n => { setIcon(n); setShowIcon(false); }}
        onSelectImage={d => { setIcon(d); setShowIcon(false); }}
        selected={icon}
      />
    </CommunitySheet>
  );
};

export default ChallengeFormSheet;
