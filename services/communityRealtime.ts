// Thin Realtime wrappers. Only the surfaces where live updates actually matter:
// an open group chat, the global Salawat card, the dua-request feed, and the
// per-user community notification stream. Each returns an unsubscribe fn.

import { supabase, isSupabaseConfigured } from './supabase';
import type { GroupMessage, GlobalSalawat, DuaRequest } from '../types';

const noop = () => {};

export const subscribeGroupMessages = (
  groupId: string,
  onInsert: (row: any) => void,
  onUpdate?: (row: any) => void,
): (() => void) => {
  if (!isSupabaseConfigured) return noop;
  const channel = supabase
    .channel(`group_messages:${groupId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      payload => onInsert(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      payload => onUpdate?.(payload.new),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export const subscribeSalawat = (onChange: (s: GlobalSalawat) => void): (() => void) => {
  if (!isSupabaseConfigured) return noop;
  const channel = supabase
    .channel('global_salawat')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'global_salawat' },
      payload => {
        const r: any = payload.new;
        onChange({ totalCount: Number(r.total_count ?? 0), todayCount: Number(r.today_count ?? 0), todayDate: r.today_date });
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export const subscribeDuaRequests = (
  onInsert: (row: any) => void,
  onUpdate?: (row: any) => void,
): (() => void) => {
  if (!isSupabaseConfigured) return noop;
  const channel = supabase
    .channel('dua_requests')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dua_requests' }, p => onInsert(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dua_requests' }, p => onUpdate?.(p.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export const subscribeMyCommunityNotifications = (
  userId: string,
  onInsert: (row: any) => void,
): (() => void) => {
  if (!isSupabaseConfigured || !userId) return noop;
  const channel = supabase
    .channel(`community_notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'community_notifications', filter: `user_id=eq.${userId}` },
      payload => onInsert(payload.new),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export type { GroupMessage, DuaRequest };
