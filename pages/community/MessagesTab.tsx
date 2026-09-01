import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import * as dm from '../../services/dmService';
import Avatar from '../../components/Avatar';
import type { DMThread } from '../../types';

interface Props {
  onOpenThread: (thread: DMThread) => void;
}

const timeAgo = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const MessagesTab: React.FC<Props> = ({ onOpenThread }) => {
  const { t } = useUser();
  const [threads, setThreads] = useState<DMThread[] | null>(null);

  const load = () => dm.listThreads().then(setThreads).catch(() => setThreads([]));
  useEffect(() => { load(); }, []);

  return (
    <div className="px-6 pb-24 space-y-2">
      {threads === null ? (
        <p className="text-sm text-gray-400 py-6">{t('community.loading')}</p>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-8">
          <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">forum</span>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('community.noMessagesYet')}</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{t('community.noMessagesYetSub')}</p>
        </div>
      ) : (
        threads.map(th => (
          <button
            key={th.id}
            onClick={() => onOpenThread(th)}
            className={`relative w-full text-left bg-white dark:bg-card-dark p-4 rounded-2xl border overflow-hidden transition-colors flex items-center gap-3 ${
              th.isUnread ? 'border-primary/30 pl-5' : 'border-gray-100 dark:border-white/5'
            }`}
          >
            {th.isUnread && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
            <Avatar src={th.otherProfile?.avatarUrl ?? undefined} className="size-11 rounded-full shrink-0" iconClassName="text-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className={`truncate ${th.isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-gray-200'}`}>
                  {th.otherProfile?.displayName || '…'}
                </h4>
                <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(th.lastMessageAt)}</span>
              </div>
              <p className={`text-xs truncate ${th.isUnread ? 'text-slate-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {th.lastMessagePreview ?? ''}
              </p>
            </div>
            {th.isUnread && <span className="size-2.5 rounded-full bg-primary shrink-0" />}
          </button>
        ))
      )}
    </div>
  );
};

export default MessagesTab;
