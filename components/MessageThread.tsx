import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import CommunitySheet from './CommunitySheet';
import Avatar from './Avatar';
import type { CommunityProfile } from '../types';

// Structural shape both GroupMessage and DMMessage satisfy — this component
// doesn't care whether a message belongs to a circle or a DM thread, only
// that it looks like this.
export interface ThreadMessage {
  id: string;
  authorId: string | null;
  body: string;
  replyTo?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author?: CommunityProfile;
}

interface Props<T extends ThreadMessage> {
  threadId: string; // groupId or dm threadId
  myId: string | null;
  onGuestAction: () => boolean; // returns true if the action was blocked (guest)
  fetchPage: (id: string, before?: string) => Promise<T[]>;
  fetchOne: (id: string) => Promise<T | null>;
  send: (id: string, body: string, replyTo?: string) => Promise<T>;
  update: (id: string, body: string) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  subscribe: (id: string, onInsert: (row: any) => void, onUpdate?: (row: any) => void) => () => void;
  canEdit: (m: T) => boolean;
  canDelete: (m: T) => boolean;
  placeholder: string;
  // Optional: renders above the message list (e.g. the circle's Verse of the Day card).
  pinnedCard?: React.ReactNode;
  heightClass?: string;
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

function MessageThread<T extends ThreadMessage>({
  threadId, myId, onGuestAction, fetchPage, fetchOne, send, update, softDelete, subscribe,
  canEdit, canDelete, placeholder, pinnedCard, heightClass,
}: Props<T>) {
  const { t } = useUser();
  const [messages, setMessages] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<T | null>(null);
  const [replyTarget, setReplyTarget] = useState<T | null>(null);
  const [editTarget, setEditTarget] = useState<T | null>(null);
  const [repliedCache, setRepliedCache] = useState<Record<string, T>>({});
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
    fetchPage(threadId)
      .then(rows => {
        if (!alive) return;
        setMessages(rows);
        setHasMore(rows.length >= 30);
        setLoading(false);
        requestAnimationFrame(scrollToBottom);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Realtime: append new, patch updates (edit / soft-delete).
  useEffect(() => {
    return subscribe(
      threadId,
      async row => {
        if (row.author_id === myId) return; // already added optimistically
        const full = await fetchOne(row.id).catch(() => null);
        if (!full) return;
        setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, full]));
        if (pinnedBottom.current) requestAnimationFrame(scrollToBottom);
      },
      row => {
        setMessages(prev => prev.map(m => (m.id === row.id
          ? { ...m, deletedAt: row.deleted_at ?? m.deletedAt, body: row.body, editedAt: row.edited_at ?? m.editedAt }
          : m)));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, myId]);

  // Fetch replied-to messages that aren't in the currently loaded window, so
  // quoted previews show real content instead of just an id.
  useEffect(() => {
    const missing = [...new Set(
      messages
        .map(m => m.replyTo)
        .filter((id): id is string => !!id && !messages.some(x => x.id === id) && !repliedCache[id]),
    )];
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map(id => fetchOne(id).catch(() => null))).then(results => {
      if (!alive) return;
      setRepliedCache(prev => {
        const next = { ...prev };
        results.forEach((r, i) => { if (r) next[missing[i]] = r; });
        return next;
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, repliedCache]);

  const findReplied = (id: string): T | undefined => messages.find(x => x.id === id) ?? repliedCache[id];

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!messages.length) return;
    const oldest = messages[0].createdAt;
    const older = await fetchPage(threadId, oldest).catch(() => []);
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

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (onGuestAction()) return;
    setSending(true);
    const wasEditing = editTarget;
    const wasReplyToId = replyTarget?.id;
    setDraft('');
    try {
      if (wasEditing) {
        await update(wasEditing.id, body);
        const editedAt = new Date().toISOString();
        setMessages(prev => prev.map(m => (m.id === wasEditing.id ? { ...m, body, editedAt } : m)));
        setEditTarget(null);
      } else {
        const msg = await send(threadId, body, wasReplyToId);
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
      await softDelete(id);
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
  const beginPress = (m: T) => (e: React.PointerEvent) => {
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
  const onContextMenu = (m: T) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!m.deletedAt) setActionMessage(m);
  };

  return (
    <div className={`flex flex-col ${heightClass ?? 'h-[calc(100vh-14rem)]'}`}>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
        {pinnedCard}
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
              const mine = m.authorId === myId;
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
        <div className="flex items-center gap-2 px-4 pt-2 shrink-0">
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

      <div
        className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-white/5 shrink-0"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          className="flex-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={submit}
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
}

export default MessageThread;
