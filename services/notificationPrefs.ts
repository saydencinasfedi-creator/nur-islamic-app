// Per-user, per-conversation notification mute (notification_prefs table) — same
// db()/throwOnError shape as communityService.ts. No row for a (user, scope) pair
// means "not muted", so reading is a maybeSingle() and writing is an upsert.

import { supabase, isSupabaseConfigured } from './supabase';
import { CommunityUnavailableError } from './communityService';

const db = () => {
  if (!isSupabaseConfigured) throw new CommunityUnavailableError();
  return supabase;
};

const myId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

export type NotificationScope = 'group' | 'dm';

export const isMuted = async (scopeType: NotificationScope, scopeId: string): Promise<boolean> => {
  const me = await myId();
  if (!me) return false;
  const { data, error } = await db()
    .from('notification_prefs')
    .select('muted')
    .eq('user_id', me)
    .eq('scope_type', scopeType)
    .eq('scope_id', scopeId)
    .maybeSingle();
  if (error) throw error;
  return data?.muted ?? false;
};

export const setMuted = async (scopeType: NotificationScope, scopeId: string, muted: boolean): Promise<void> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const { error } = await db()
    .from('notification_prefs')
    .upsert(
      { user_id: me, scope_type: scopeType, scope_id: scopeId, muted, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,scope_type,scope_id' },
    );
  if (error) throw error;
};
