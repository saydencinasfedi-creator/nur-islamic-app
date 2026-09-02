import React from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import * as community from '../../services/communityService';
import { subscribeGroupMessages } from '../../services/communityRealtime';
import MessageThread from '../../components/MessageThread';
import type { GroupMessage, QuranReference } from '../../types';

interface Props {
  groupId: string;
  isModerator: boolean;
  onGuestAction: () => boolean; // returns true if the action was blocked (guest)
  verseOfDay?: QuranReference | null;
  onReflectOnVerse?: (ref: QuranReference) => void;
}

const ChatTab: React.FC<Props> = ({ groupId, isModerator, onGuestAction, verseOfDay, onReflectOnVerse }) => {
  const { t } = useUser();
  const { authUserId } = useAuth();

  return (
    <MessageThread<GroupMessage>
      threadId={groupId}
      myId={authUserId}
      onGuestAction={onGuestAction}
      fetchPage={community.listMessages}
      fetchOne={community.getMessage}
      send={community.sendMessage}
      update={community.updateMessage}
      softDelete={community.softDeleteMessage}
      subscribe={subscribeGroupMessages}
      canEdit={m => m.authorId === authUserId}
      canDelete={m => m.authorId === authUserId || isModerator}
      placeholder={t('community.chatPlaceholder')}
      pageScroll
      loadReactions={ids => community.listReactions('message', ids)}
      onToggleReaction={(id, emoji, on) => community.toggleReaction('message', id, emoji, on)}
      pinnedCard={verseOfDay ? (
        <div className="bg-white dark:bg-card-dark rounded-2xl p-4 relative overflow-hidden border border-gray-100 dark:border-white/5 mb-1">
          <div className="absolute -right-6 -top-6 size-24 bg-primary/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-sm">format_quote</span>
              <span className="text-[11px] uppercase tracking-wider text-primary font-bold">{t('community.verseOfDay')}</span>
            </div>
            <p className="text-slate-900 dark:text-white text-sm font-medium leading-relaxed font-serif italic mb-2">
              "{verseOfDay.ayahText}"
            </p>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 text-xs">{verseOfDay.surahName} {verseOfDay.surahNumber}:{verseOfDay.ayahNumber}</span>
              {onReflectOnVerse && (
                <button onClick={() => onReflectOnVerse(verseOfDay)} className="text-xs font-bold text-primary">
                  {t('community.reflectOnVerse')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : undefined}
    />
  );
};

export default ChatTab;
