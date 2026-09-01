// Direct messages (1:1). Mirrors the chat section of communityService.ts —
// same row<->camelCase mapper style, same db()/throwOnError guard — scoped to
// a thread instead of a circle. No moderator concept: only the two
// participants can ever act on a thread.

import { supabase, isSupabaseConfigured } from './supabase';
import type { CommunityProfile, DMMessage, DMThread } from '../types';
import { CommunityUnavailableError, getProfiles } from './communityService';

const db = () => {
  if (!isSupabaseConfigured) throw new CommunityUnavailableError();
  return supabase;
};

const myId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

const throwOnError = <T>(res: { data: T; error: any }): T => {
  if (res.error) throw res.error;
  return res.data;
};

const toProfile = (r: any): CommunityProfile => ({
  id: r.id,
  displayName: r.display_name ?? '',
  avatarUrl: r.avatar_url ?? null,
  bio: r.bio ?? null,
  ageRange: r.age_range ?? null,
  languages: r.languages ?? [],
  interests: r.interests ?? [],
  isAnonymous: !!r.is_anonymous,
});

const toDMMessage = (r: any): DMMessage => ({
  id: r.id,
  threadId: r.thread_id,
  authorId: r.author_id ?? null,
  body: r.body,
  replyTo: r.reply_to ?? null,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? null,
  deletedAt: r.deleted_at ?? null,
  author: r.author ? toProfile(r.author) : undefined,
});

// --- Threads -----------------------------------------------------------------

// Finds or creates the (canonical, order-independent) thread with another
// user. This is the only way a dm_threads row is created — see the RPC.
export const getOrCreateThread = async (otherUserId: string): Promise<string> =>
  throwOnError(await db().rpc('get_or_create_dm_thread', { p_other_user_id: otherUserId })) as string;

export const markThreadRead = async (threadId: string): Promise<void> => {
  const me = await myId();
  if (!me) return;
  throwOnError(
    await db()
      .from('dm_thread_reads')
      .upsert({ thread_id: threadId, user_id: me, last_read_at: new Date().toISOString() }, { onConflict: 'thread_id,user_id' })
      .select('thread_id')
      .single(),
  );
};

// Inbox list: dm_threads_view already scopes rows to the caller and resolves
// otherUserId server-side. Unread is a simple "newer than my last read" flag,
// not an exact count (see the migration's comment on dm_thread_reads).
export const listThreads = async (): Promise<DMThread[]> => {
  const me = await myId();
  if (!me) return [];
  const rows = throwOnError(
    await db().from('dm_threads_view').select('*').order('last_message_at', { ascending: false }),
  ) as any[];
  if (!rows.length) return [];

  const [profiles, reads] = await Promise.all([
    getProfiles(rows.map(r => r.other_user_id)),
    db().from('dm_thread_reads').select('thread_id,last_read_at').eq('user_id', me).in('thread_id', rows.map(r => r.id)),
  ]);
  const readAt: Record<string, string> = {};
  for (const r of (reads.data ?? []) as any[]) readAt[r.thread_id] = r.last_read_at;

  return rows.map((r): DMThread => ({
    id: r.id,
    otherUserId: r.other_user_id,
    otherProfile: profiles[r.other_user_id],
    lastMessageAt: r.last_message_at,
    lastMessagePreview: r.last_message_body ?? null,
    lastMessageAuthorId: r.last_message_author_id ?? null,
    isUnread: r.last_message_author_id !== me && (!readAt[r.id] || readAt[r.id] < r.last_message_at),
  }));
};

// --- Messages ------------------------------------------------------------

const MESSAGE_PAGE = 30;

export const listMessages = async (threadId: string, before?: string): Promise<DMMessage[]> => {
  let q = db()
    .from('dm_messages')
    .select('*, author:profiles!dm_messages_author_id_fkey(*)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE);
  if (before) q = q.lt('created_at', before);
  const rows = throwOnError(await q);
  return (rows ?? []).map(toDMMessage).reverse(); // chronological
};

export const getMessage = async (id: string): Promise<DMMessage | null> => {
  const row = throwOnError(
    await db().from('dm_messages').select('*, author:profiles!dm_messages_author_id_fkey(*)').eq('id', id).maybeSingle(),
  );
  return row ? toDMMessage(row) : null;
};

export const sendMessage = async (threadId: string, body: string, replyTo?: string): Promise<DMMessage> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('dm_messages')
      .insert({ thread_id: threadId, author_id: me, body: body.trim(), reply_to: replyTo ?? null })
      .select('*, author:profiles!dm_messages_author_id_fkey(*)')
      .single(),
  );
  return toDMMessage(row);
};

export const updateMessage = async (id: string, body: string): Promise<void> => {
  throwOnError(
    await db()
      .from('dm_messages')
      .update({ body: body.trim(), edited_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single(),
  );
};

export const softDeleteMessage = async (id: string): Promise<void> => {
  throwOnError(
    await db().from('dm_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single(),
  );
};
