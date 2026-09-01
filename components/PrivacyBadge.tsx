import React from 'react';
import { useUser } from '../contexts/UserContext';
import type { GroupPrivacy } from '../types';

const ICON: Record<GroupPrivacy, string> = {
  public: 'lock_open',
  private: 'lock',
  invite_only: 'link',
};

const PrivacyBadge: React.FC<{ privacy: GroupPrivacy; className?: string }> = ({ privacy, className = '' }) => {
  const { t } = useUser();
  const label =
    privacy === 'public' ? t('community.privacyPublic')
      : privacy === 'private' ? t('community.privacyPrivate')
        : t('community.privacyInviteOnly');
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-2 py-0.5 ${className}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{ICON[privacy]}</span>
      {label}
    </span>
  );
};

export default PrivacyBadge;
