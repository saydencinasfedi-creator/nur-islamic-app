import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import * as dm from '../../services/dmService';
import * as notificationPrefs from '../../services/notificationPrefs';
import { subscribeDMMessages } from '../../services/communityRealtime';
import MessageThread from '../../components/MessageThread';
import Avatar from '../../components/Avatar';
import SafeAreaTopFiller from '../../components/SafeAreaTopFiller';
import type { DMMessage, CommunityProfile } from '../../types';

interface Props {
  threadId: string;
  otherProfile?: CommunityProfile;
  onBack: () => void;
  onGuestAction: () => boolean;
}

const DMThreadView: React.FC<Props> = ({ threadId, otherProfile, onBack, onGuestAction }) => {
  const { t } = useUser();
  const { authUserId } = useAuth();
  const [muted, setMuted] = useState(false);

  // Mark read on open — best-effort, no need to block the UI on it.
  useEffect(() => { dm.markThreadRead(threadId).catch(() => {}); }, [threadId]);
  useEffect(() => { notificationPrefs.isMuted('dm', threadId).then(setMuted).catch(() => {}); }, [threadId]);
  const toggleMuted = () => {
    const next = !muted;
    setMuted(next); // optimistic — this is a personal preference, not worth blocking on
    notificationPrefs.setMuted('dm', threadId, next).catch(() => setMuted(!next));
  };

  // Same treatment as CircleDetail's chat tab: sticky header, everything else
  // (including the message list) scrolls with the page instead of living in an
  // isolated, fixed-height scroll island — see MessageThread's `pageScroll` mode.
  return (
    <div className="flex flex-col min-h-screen">
      <SafeAreaTopFiller />
      <header className="z-10 flex items-center gap-3 px-6 py-3 shrink-0 sticky sticky-safe-top bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-100 dark:border-white/5">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
        </button>
        <Avatar src={otherProfile?.avatarUrl ?? undefined} className="size-9 rounded-full shrink-0" iconClassName="text-sm" />
        <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{otherProfile?.displayName || '…'}</h1>
        <button
          onClick={toggleMuted}
          title={t('community.muteNotifications')}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          <span className={`material-symbols-outlined text-xl ${muted ? 'text-gray-400' : ''}`}>
            {muted ? 'notifications_off' : 'notifications'}
          </span>
        </button>
      </header>

      <MessageThread<DMMessage>
        threadId={threadId}
        myId={authUserId}
        onGuestAction={onGuestAction}
        fetchPage={dm.listMessages}
        fetchOne={dm.getMessage}
        send={dm.sendMessage}
        update={dm.updateMessage}
        softDelete={dm.softDeleteMessage}
        subscribe={subscribeDMMessages}
        canEdit={m => m.authorId === authUserId}
        canDelete={m => m.authorId === authUserId}
        placeholder={t('community.dmPlaceholder')}
        pageScroll
      />
    </div>
  );
};

export default DMThreadView;
