// Real (FCM) push registration + notification-tap handling for circle chat and
// DMs. See supabase/functions/push-on-new-message for the server side. No-ops
// quietly wherever push isn't available (bypassed/offline build, no
// google-services.json in this build, or the user denies the permission prompt) —
// none of this is required for the app to work, same spirit as every other
// best-effort sync in this codebase.

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase, isSupabaseConfigured } from './supabase';
import type { PendingCommunityTarget } from './communityNav';

let initialized = false;

const myId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

const saveToken = async (token: string) => {
  const me = await myId();
  if (!me) return;
  await supabase.from('push_tokens').upsert(
    { user_id: me, token, platform: 'android' },
    { onConflict: 'user_id,token' },
  ).then(({ error }) => { if (error) console.warn('[Nur] failed to save push token:', error); });
};

// data payload shape sent by the Edge Function: { type: 'group'|'dm', scopeId, otherUserId? }
export const communityTargetFromPushData = (data: Record<string, string>): PendingCommunityTarget | null => {
  if (data.type === 'group' && data.scopeId) return { groupId: data.scopeId };
  if (data.type === 'dm' && data.scopeId && data.otherUserId) {
    return { dmThreadId: data.scopeId, otherUserId: data.otherUserId };
  }
  return null;
};

// Requests permission + registers this device for push. The actual
// pushNotificationActionPerformed (tap) and pushNotificationReceived (foreground)
// listeners live in App.tsx, which has `navigate` and the notification inbox in
// scope — this only handles the permission/registration/token-save side.
// Call once per app session, after a real signed-in session exists (guests
// included — they can receive DMs/circle messages same as anyone). Safe to call
// more than once; only the first call in a session does anything.
export const initPush = async (): Promise<void> => {
  if (initialized) return;
  if (!isSupabaseConfigured) return;
  if (Capacitor.getPlatform() !== 'android') return; // no iOS build yet, no web push
  // Calling PushNotifications.register() without google-services.json in place
  // crashes the app outright (FirebaseMessaging.getInstance() throws synchronously
  // in the native plugin, confirmed via logcat) — this flag only flips on once
  // that file is actually in the build. See vite.config.ts.
  if (process.env.FCM_ENABLED !== 'true') return;
  initialized = true;

  try {
    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive === 'granted';
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive === 'granted';
    }
    if (!granted) return;

    await PushNotifications.register();
    PushNotifications.addListener('registration', ({ value }) => { saveToken(value).catch(() => {}); });
    PushNotifications.addListener('registrationError', err => {
      console.warn('[Nur] push registration failed:', err);
    });
  } catch (err) {
    console.warn('[Nur] push init failed:', err);
  }
};
