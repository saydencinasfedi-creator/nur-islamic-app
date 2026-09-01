import React from 'react';
import { useUser } from '../contexts/UserContext';
import CommunitySheet from './CommunitySheet';
import GoalIcon from './GoalIcon';
import type { Group } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  onPick: (group: Group) => void;
}

// Pick one of my circles — used by "Share in Community" from the personal
// Reflections screen and by the challenge target picker.
const GroupPickerSheet: React.FC<Props> = ({ isOpen, onClose, groups, onPick }) => {
  const { t } = useUser();
  return (
    <CommunitySheet isOpen={isOpen} onClose={onClose} title={t('community.pickACircle')}>
      {groups.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('community.noCirclesToShare')}</p>
      ) : (
        groups.map(g => (
          <button
            key={g.id}
            onClick={() => onPick(g)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 transition-colors text-left"
          >
            <div className="size-9 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-primary shrink-0">
              <GoalIcon
                icon={g.avatarUrl && !g.avatarUrl.startsWith('data:') ? g.avatarUrl : 'groups'}
                iconImage={g.avatarUrl && g.avatarUrl.startsWith('data:') ? g.avatarUrl : undefined}
                className="material-symbols-outlined text-lg w-6 h-6"
              />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 dark:text-white truncate">{g.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('community.membersCount', { count: g.memberCount })}</p>
            </div>
          </button>
        ))
      )}
    </CommunitySheet>
  );
};

export default GroupPickerSheet;
