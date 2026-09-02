// Fired by pg_net from tg_notify_new_message() (see the push_notifications migration)
// on every new group_messages / dm_messages row. Resolves who should be notified,
// skips anyone who muted that circle/DM, and sends a push to each of their devices.
//
// This endpoint is deployed with verify_jwt = false (see supabase/config.toml) since
// its caller is Postgres, not a signed-in user — instead it checks its own shared
// secret (see PUSH_SHARED_SECRET below) so it can't be invoked with an arbitrary
// payload by anyone who finds the URL.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPush } from './fcm.ts';

interface MessagePayload {
  type: 'group' | 'dm';
  id: string;
  scopeId: string;
  authorId: string;
  body: string;
}

const MAX_PREVIEW = 120;

Deno.serve(async req => {
  const expected = Deno.env.get('PUSH_SHARED_SECRET');
  const auth = req.headers.get('Authorization');
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response('unauthorized', { status: 401 });
  }

  let payload: MessagePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}');
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    console.error('[push-on-new-message] FCM_SERVICE_ACCOUNT secret is not set — nothing to send with.');
    return new Response('ok', { status: 200 }); // don't fail the trigger's fire-and-forget call
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Who's in this conversation, other than the author.
  let recipientIds: string[] = [];
  let otherUserId: string | null = null; // for a DM, so the client can jump straight to the thread
  if (payload.type === 'group') {
    const { data } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', payload.scopeId)
      .in('status', ['active', 'muted']) // moderation-mute (can't post) ≠ notification-mute
      .neq('user_id', payload.authorId);
    recipientIds = (data ?? []).map(r => r.user_id);
  } else {
    const { data: thread } = await supabase
      .from('dm_threads')
      .select('user_a_id, user_b_id')
      .eq('id', payload.scopeId)
      .maybeSingle();
    if (thread) {
      otherUserId = thread.user_a_id === payload.authorId ? thread.user_b_id : thread.user_a_id;
      recipientIds = [otherUserId];
    }
  }
  if (!recipientIds.length) return new Response('ok', { status: 200 });

  // 2. Drop anyone who's muted this specific circle/DM.
  const { data: muted } = await supabase
    .from('notification_prefs')
    .select('user_id')
    .eq('scope_type', payload.type)
    .eq('scope_id', payload.scopeId)
    .eq('muted', true)
    .in('user_id', recipientIds);
  const mutedIds = new Set((muted ?? []).map(r => r.user_id));
  const finalRecipients = recipientIds.filter(id => !mutedIds.has(id));
  if (!finalRecipients.length) return new Response('ok', { status: 200 });

  // 3. Their devices.
  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', finalRecipients);
  if (!tokenRows?.length) return new Response('ok', { status: 200 });

  // 4. Author's name for the notification title.
  const { data: author } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', payload.authorId)
    .maybeSingle();
  const title = author?.display_name || 'Nur';
  const body = payload.body.length > MAX_PREVIEW ? payload.body.slice(0, MAX_PREVIEW) + '…' : payload.body;

  const data: Record<string, string> = {
    type: payload.type,
    scopeId: payload.scopeId,
    ...(otherUserId ? { otherUserId } : {}),
  };

  const staleTokens: string[] = [];
  await Promise.all(tokenRows.map(async row => {
    const result = await sendPush(sa, { token: row.token, title, body, data }).catch(() => 'error' as const);
    if (result === 'invalid_token') staleTokens.push(row.token);
  }));

  if (staleTokens.length) {
    await supabase.from('push_tokens').delete().in('token', staleTokens);
  }

  return new Response('ok', { status: 200 });
});
