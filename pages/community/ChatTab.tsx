import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import * as community from '../../services/communityService';
import { subscribeGroupMessages } from '../../services/communityRealtime';
import Avatar from '../../components/Avatar';
import type { GroupMessage } from '../../types';

interface Props {
  groupId: string;
  isModerator: boolean;
  onGuestAction: () => boolean; // returns true if the action was blocked (guest)
}

const ChatTab: React.FC<Props> = ({ groupId, isModerator, onGuestAction }) => {
  const { t } = useUser();
  const { authUserId } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedBottom = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    community
      .listMessages(groupId)
      .then(rows => {
        if (!alive) return;
        setMessages(rows);
        setHasMore(rows.length >= 30);
        setLoading(false);
        requestAnimationFrame(scrollToBottom);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, scrollToBottom]);

  // Realtime: append new, patch updates (soft-delete).
  useEffect(() => {
    return subscribeGroupMessages(
      groupId,
      async row => {
        if (row.author_id === authUserId) return; // already added optimistically
        const full = await community.getMessage(row.id).catch(() => null);
        setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, full ?? {
          id: row.id, groupId, authorId: row.author_id, body: row.body, replyTo: row.reply_to ?? null,
          createdAt: row.created_at, editedAt: null, deletedAt: null,
        }]));
        if (pinnedBottom.current) requestAnimationFrame(scrollToBottom);
      },
      row => {
        setMessages(prev => prev.map(m => (m.id === row.id ? { ...m, deletedAt: row.deleted_at ?? m.deletedAt, body: row.body } : m)));
      },
    );
  }, [groupId, authUserId, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!messages.length) return;
    const oldest = messages[0].createdAt;
    const older = await community.listMessages(groupId, oldest).catch(() => []);
    if (older.length) {
      const el = scrollRef.current;
      const prevH = el?.scrollHeight ?? 0;
      setMessages(prev => [...older, ...prev]);
      setHasMore(older.length >= 30);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH; });
    } else {
      setHasMore(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (onGuestAction()) return;
    setSending(true);
    setDraft('');
    try {
      const msg = await community.sendMessage(groupId, body);
      setMessages(prev => [...prev, msg]);
      requestAnimationFrame(scrollToBottom);
    } catch {
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await community.softDeleteMessage(id);
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m)));
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('community.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('community.noMessages')}</p>
        ) : (
          <>
            {hasMore && (
              <button onClick={loadOlder} className="mx-auto block text-xs font-bold text-primary py-1">{t('community.loadOlder')}</button>
            )}
            {messages.map(m => {
              const mine = m.authorId === authUserId;
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && <Avatar src={m.author?.avatarUrl ?? undefined} className="size-7 rounded-full shrink-0 mt-1" iconClassName="text-sm" />}
                  <div className={`max-w-[76%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!mine && <span className="text-[11px] text-gray-500 dark:text-gray-400 px-1 mb-0.5">{m.author?.displayName || '…'}</span>}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                        m.deletedAt
                          ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 italic'
                          : mine
                            ? 'bg-primary text-background-dark'
                            : 'bg-gray-100 dark:bg-white/10 text-slate-900 dark:text-white'
                      }`}
                    >
                      {m.deletedAt ? t('community.messageDeleted') : m.body}
                    </div>
                    {!m.deletedAt && (mine || isModerator) && (
                      <button onClick={() => remove(m.id)} className="text-[10px] text-gray-400 dark:text-gray-500 px-1 mt-0.5 hover:text-red-500">
                        {t('community.deleteMessage')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-white/5">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t('community.chatPlaceholder')}
          className="flex-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="size-10 rounded-full bg-primary text-background-dark flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <span className="material-symbols-outlined text-xl">send</span>
        </button>
      </div>
    </div>
  );
};

export default ChatTab;
