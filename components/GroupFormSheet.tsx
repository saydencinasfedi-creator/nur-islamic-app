import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import CommunitySheet, { sheetField, sheetLabel, sheetPrimaryBtn, sheetChip } from './CommunitySheet';
import IconPickerSheet from './IconPickerSheet';
import GoalIcon from './GoalIcon';
import type { GroupCategory, GroupGender, GroupPrivacy, Group } from '../types';
import type { GroupDraft } from '../services/communityService';
import type { TranslationKey } from '../services/i18n';

const CATEGORIES: { value: GroupCategory; key: TranslationKey }[] = [
  { value: 'quran', key: 'community.catQuran' },
  { value: 'salah', key: 'community.catSalah' },
  { value: 'hadith', key: 'community.catHadith' },
  { value: 'ramadan', key: 'community.catRamadan' },
  { value: 'self_dev', key: 'community.catSelfDev' },
  { value: 'brotherhood', key: 'community.catBrotherhood' },
  { value: 'sisters', key: 'community.catSisters' },
  { value: 'memorization', key: 'community.catMemorization' },
  { value: 'arabic', key: 'community.catArabic' },
  { value: 'general', key: 'community.catGeneral' },
  { value: 'other', key: 'community.catOther' },
];
const PRIVACY: { value: GroupPrivacy; key: TranslationKey; hint: TranslationKey }[] = [
  { value: 'public', key: 'community.privacyPublic', hint: 'community.privacyPublicHint' },
  { value: 'private', key: 'community.privacyPrivate', hint: 'community.privacyPrivateHint' },
  { value: 'invite_only', key: 'community.privacyInviteOnly', hint: 'community.privacyInviteOnlyHint' },
];
const GENDER: { value: GroupGender; key: TranslationKey }[] = [
  { value: 'mixed', key: 'community.genderMixed' },
  { value: 'brothers', key: 'community.genderBrothers' },
  { value: 'sisters', key: 'community.genderSisters' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: GroupDraft) => Promise<void>;
  editing?: Group | null;
}

const GroupFormSheet: React.FC<Props> = ({ isOpen, onClose, onSave, editing }) => {
  const { t } = useUser();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GroupCategory>('general');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('public');
  const [gender, setGender] = useState<GroupGender>('mixed');
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [showIcon, setShowIcon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setCategory(editing.category);
      setPrivacy(editing.privacy);
      setGender(editing.groupGender);
      setIcon(editing.avatarUrl ?? undefined);
    } else {
      setName(''); setDescription(''); setCategory('general'); setPrivacy('public'); setGender('mixed'); setIcon(undefined);
    }
  }, [isOpen, editing]);

  const canSave = name.trim().length >= 2 && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        privacy,
        groupGender: gender,
        avatarUrl: icon ?? null,
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
      title={editing ? t('community.editCircle') : t('community.createCircle')}
      footer={
        <button onClick={submit} disabled={!canSave} className={sheetPrimaryBtn(canSave)}>
          {busy ? '…' : editing ? t('community.save') : t('community.create')}
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowIcon(true)}
          className="size-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-primary shrink-0"
        >
          <GoalIcon
            icon={icon && !icon.startsWith('data:') ? icon : 'groups'}
            iconImage={icon && icon.startsWith('data:') ? icon : undefined}
            className="material-symbols-outlined text-2xl w-10 h-10"
          />
        </button>
        <div className="flex-1">
          <label className={sheetLabel}>{t('community.circleNameLabel')}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('community.circleNamePlaceholder')} className={sheetField} autoFocus />
        </div>
      </div>

      <div>
        <label className={sheetLabel}>{t('community.circleDescLabel')}</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('community.circleDescPlaceholder')} rows={2} className={sheetField} />
      </div>

      <div>
        <label className={sheetLabel}>{t('community.circleCategoryLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)} className={sheetChip(category === c.value)}>{t(c.key)}</button>
          ))}
        </div>
      </div>

      <div>
        <label className={sheetLabel}>{t('community.circleGenderLabel')}</label>
        <div className="flex gap-2">
          {GENDER.map(g => (
            <button key={g.value} onClick={() => setGender(g.value)} className={sheetChip(gender === g.value)}>{t(g.key)}</button>
          ))}
        </div>
      </div>

      <div>
        <label className={sheetLabel}>{t('community.circlePrivacyLabel')}</label>
        <div className="flex gap-2 mb-1">
          {PRIVACY.map(p => (
            <button key={p.value} onClick={() => setPrivacy(p.value)} className={sheetChip(privacy === p.value)}>{t(p.key)}</button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t(PRIVACY.find(p => p.value === privacy)!.hint)}</p>
      </div>

      {error && <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}

      <IconPickerSheet
        isOpen={showIcon}
        onClose={() => setShowIcon(false)}
        onSelect={name => { setIcon(name); setShowIcon(false); }}
        onSelectImage={dataUrl => { setIcon(dataUrl); setShowIcon(false); }}
        selected={icon}
      />
    </CommunitySheet>
  );
};

export default GroupFormSheet;
