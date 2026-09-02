import React, { useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import * as dm from '../../services/dmService';
import { subscribeDMMessages } from '../../services/communityRealtime';
import MessageThread from '../../components/MessageThread';
import Avatar from '../../components/Avatar';
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

  // Mark read on open — best-effort, no need to block the UI on it.
  useEffect(() => { dm.markThreadRead(threadId).catch(() => {}); }, [threadId]);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - env(safe-area-inset-top, 0px))' }}>
      <header className="relative z-10 flex items-center gap-3 p-6 shrink-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-100 dark:border-white/5">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
        </button>
        <Avatar src={otherProfile?.avatarUrl ?? undefined} className="size-9 rounded-full shrink-0" iconClassName="text-sm" />
        <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{otherProfile?.displayName || '…'}</h1>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
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
          heightClass="h-full"
        />
      </div>
    </div>
  );
};

export default DMThreadView;
