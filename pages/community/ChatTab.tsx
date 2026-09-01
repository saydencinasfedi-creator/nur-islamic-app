import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import * as community from '../../services/communityService';
import { subscribeGroupMessages } from '../../services/communityRealtime';
import CommunitySheet from '../../components/CommunitySheet';
import Avatar from '../../components/Avatar';
import type { GroupMessage } from '../../types';

interface Props {
  groupId: string;
  isModerator: boolean;
  onGuestAction: () => boolean; // returns true if the action was blocked (guest)
}

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 12;

const ActionRow: React.FC<{ icon: string; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-2 py-3 rounded-xl text-sm font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-white/5 ${
      danger ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-white'
    }`}
  >
    <span className="material-symbols-outlined text-xl">{icon}</span>
    {label}
  </button>
);

const ChatTab: React.FC<Props> = ({ groupId, isModerator, onGuestAction }) => {
  const { t } = useUser();
  const { authUserId } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<GroupMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<GroupMessage | null>(null);
  const [editTarget, setEditTarget] = useState<GroupMessage | null>(null);
  const [repliedCache, setRepliedCache] = useState<Record<string, GroupMessage>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinnedBottom = useRef(true);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

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

  // Realtime: append new, patch updates (edit / soft-delete).
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
        setMessages(prev => prev.map(m => (m.id === row.id
          ? { ...m, deletedAt: row.deleted_at ?? m.deletedAt, body: row.body, editedAt: row.edited_at ?? m.editedAt }
          : m)));
      },
    );
  }, [groupId, authUserId, scrollToBottom]);

  // Fetch replied-to messages that aren't in the currently loaded window, so quoted
  // previews show real content instead of just an id.
  useEffect(() => {
    const missing = [...new Set(
      messages
        .map(m => m.replyTo)
        .filter((id): id is string => !!id && !messages.some(x => x.id === id) && !repliedCache[id]),
    )];
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map(id => community.getMessage(id).catch(() => null))).then(results => {
      if (!alive) return;
      setRepliedCache(prev => {
        const next = { ...prev };
        results.forEach((r, i) => { if (r) next[missing[i]] = r; });
        return next;
      });
    });
    return () => { alive = false; };
  }, [messages, repliedCache]);

  const findReplied = (id: string): GroupMessage | undefined => messages.find(x => x.id === id) ?? repliedCache[id];

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
    const wasEditing = editTarget;
    const wasReplyToId = replyTarget?.id;
    setDraft('');
    try {
      if (wasEditing) {
        await community.updateMessage(wasEditing.id, body);
        const editedAt = new Date().toISOString();
        setMessages(prev => prev.map(m => (m.id === wasEditing.id ? { ...m, body, editedAt } : m)));
        setEditTarget(null);
      } else {
        const msg = await community.sendMessage(groupId, body, wasReplyToId);
        setMessages(prev => [...prev, msg]);
        setReplyTarget(null);
        requestAnimationFrame(scrollToBottom);
      }
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

  const cancelComposerContext = () => {
    setReplyTarget(null);
    if (editTarget) { setEditTarget(null); setDraft(''); }
  };

  // Long-press (touch) / right-click (desktop) opens the Discord-style action menu.
  const clearPressTimer = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
    pressStart.current = null;
  };
  const beginPress = (m: GroupMessage) => (e: React.PointerEvent) => {
    if (m.deletedAt) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => { setActionMessage(m); pressStart.current = null; }, LONG_PRESS_MS);
  };
  const movePress = (e: React.PointerEvent) => {
    if (!pressStart.current) return;
    if (Math.abs(e.clientX - pressStart.current.x) > MOVE_CANCEL_PX || Math.abs(e.clientY - pressStart.current.y) > MOVE_CANCEL_PX) {
      clearPressTimer();
    }
  };
  const onContextMenu = (m: GroupMessage) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!m.deletedAt) setActionMessage(m);
  };

  const canEdit = (m: GroupMessage) => m.authorId === authUserId;
  const canDelete = (m: GroupMessage) => m.authorId === authUserId || isModerator;

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
              const replied = m.replyTo ? findReplied(m.replyTo) : undefined;
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && <Avatar src={m.author?.avatarUrl ?? undefined} className="size-7 rounded-full shrink-0 mt-1" iconClassName="text-sm" />}
                  <div className={`max-w-[76%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!mine && <span className="text-[11px] text-gray-500 dark:text-gray-400 px-1 mb-0.5">{m.author?.displayName || '…'}</span>}
                    <div
                      onPointerDown={beginPress(m)}
                      onPointerMove={movePress}
                      onPointerUp={clearPressTimer}
                      onPointerLeave={clearPressTimer}
                      onPointerCancel={clearPressTimer}
                      onContextMenu={onContextMenu(m)}
                      className={`px-3 py-2 rounded-2xl text-sm leading-snug select-none ${
                        m.deletedAt
                          ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 italic'
                          : mine
                            ? 'bg-primary text-background-dark'
                            : 'bg-gray-100 dark:bg-white/10 text-slate-900 dark:text-white'
                      }`}
                    >
                      {m.replyTo && !m.deletedAt && (
                        <div className={`mb-1 pl-2 border-l-2 text-[11px] line-clamp-1 ${mine ? 'border-background-dark/40 text-background-dark/70' : 'border-primary/60 text-gray-500 dark:text-gray-400'}`}>
                          <span className="font-bold">{replied?.author?.displayName || '…'}</span>
                          {' '}{replied ? (replied.deletedAt ? t('community.messageDeleted') : replied.body) : '…'}
                        </div>
                      )}
                      {m.deletedAt ? t('community.messageDeleted') : m.body}
                      {!m.deletedAt && m.editedAt && (
                        <span className={`ml-1 text-[10px] italic ${mine ? 'text-background-dark/60' : 'text-gray-400 dark:text-gray-500'}`}>
                          {t('community.messageEdited')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {(replyTarget || editTarget) && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <div className="flex-1 min-w-0 bg-gray-100 dark:bg-white/5 border-l-4 border-primary rounded-lg px-3 py-1.5">
            <p className="text-[11px] font-bold text-primary">
              {editTarget ? t('community.editingMessage') : t('community.replyingTo', { name: replyTarget?.author?.displayName || '' })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{(editTarget ?? replyTarget)?.body}</p>
          </div>
          <button onClick={cancelComposerContext} className="text-gray-400 hover:text-red-500 shrink-0">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-white/5">
        <input
          ref={inputRef}
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

      <CommunitySheet isOpen={!!actionMessage} onClose={() => setActionMessage(null)} title={t('community.messageActions')}>
        {actionMessage && (
          <div className="space-y-1 -mt-2">
            <ActionRow
              icon="reply"
              label={t('community.reply')}
              onClick={() => { setReplyTarget(actionMessage); setEditTarget(null); setActionMessage(null); inputRef.current?.focus(); }}
            />
            <ActionRow
              icon="content_copy"
              label={t('community.copyMessage')}
              onClick={() => { navigator.clipboard?.writeText(actionMessage.body).catch(() => {}); setActionMessage(null); }}
            />
            {canEdit(actionMessage) && (
              <ActionRow
                icon="edit"
                label={t('community.editMessage')}
                onClick={() => { setEditTarget(actionMessage); setReplyTarget(null); setDraft(actionMessage.body); setActionMessage(null); inputRef.current?.focus(); }}
              />
            )}
            {canDelete(actionMessage) && (
              <ActionRow
                icon="delete"
                danger
                label={t('community.deleteMessage')}
                onClick={() => { remove(actionMessage.id); setActionMessage(null); }}
              />
            )}
          </div>
        )}
      </CommunitySheet>
    </div>
  );
};

export default ChatTab;
