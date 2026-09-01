import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase, isSupabaseConfigured } from './supabase';
import type { CommunityProfile } from '../types';

// The Capacitor custom-scheme deep link that Google OAuth and the email-confirmation
// link redirect back to. Must match android/app/src/main/AndroidManifest.xml and the
// Supabase redirect allow-list. On web we fall back to the current origin.
const OAUTH_REDIRECT = 'com.fedi.nur://auth-callback';
const emailRedirectTarget = (): string =>
  Capacitor.isNativePlatform() ? OAUTH_REDIRECT : window.location.origin;

export { isSupabaseConfigured };

// --- Email + password (with an 8-digit confirmation code on sign-up) ---------

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: emailRedirectTarget(),
    },
  });
  if (error) throw error;
  // When the email already has an account, Supabase returns no error but a user
  // object with an empty `identities` array — and it does NOT set this password.
  // Surface it so the UI sends the person to "log in" instead of a dead code step.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('User already registered');
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

// Confirms a just-created account with the 8-digit code from the sign-up email
// (only used if a custom SMTP template exposes {{ .Token }}; the default email is a link).
export async function verifySignupOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'signup',
  });
  if (error) throw error;
}

// Re-send the confirmation email (link) for an unconfirmed account.
export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: emailRedirectTarget() },
  });
  if (error) throw error;
}

// --- Password reset ----------------------------------------------------------
// Sends the recovery email. The link redirects back into the app (deep link on
// native), which bindOAuthDeepLink() below exchanges for a short-lived session;
// AuthContext catches the PASSWORD_RECOVERY event and routes to the reset screen.

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: emailRedirectTarget(),
  });
  if (error) throw error;
}

// Verifies the recovery code from the reset email. On success a session is
// established and supabase emits PASSWORD_RECOVERY, which AuthContext turns into
// recoveryMode -> the "set a new password" screen.
export async function verifyRecoveryOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'recovery',
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// --- Email OTP (8-digit code) — kept for password recovery / code-only login --

export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
}

// --- Google OAuth ----------------------------------------------------------------
// On native we open the provider URL in the system browser and complete the PKCE
// exchange when Android hands the app back the deep link. On web we just redirect.

export async function signInWithGoogle(): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: isNative ? OAUTH_REDIRECT : `${window.location.origin}`,
      skipBrowserRedirect: isNative,
    },
  });
  if (error) throw error;
  if (isNative && data?.url) {
    await Browser.open({ url: data.url });
  }
}

// Registered once at startup. Completes the session from the deep link that
// Google OAuth AND the password-reset email redirect back to. The link comes in
// one of two shapes depending on the flow / GoTrue config:
//   - PKCE:     com.fedi.nur://auth-callback?code=...
//   - implicit: com.fedi.nur://auth-callback#access_token=...&refresh_token=...&type=recovery
// `onRecovery` is fired when the link is a password-recovery one, so the app can
// force the "set a new password" screen.
let deepLinkBound = false;
export function bindOAuthDeepLink(onRecovery?: () => void): void {
  if (deepLinkBound || !Capacitor.isNativePlatform()) return;
  deepLinkBound = true;
  CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.startsWith(OAUTH_REDIRECT)) return;
    try {
      await Browser.close().catch(() => {});

      let parsed: URL | null = null;
      try { parsed = new URL(url); } catch { parsed = null; }
      const query = parsed?.searchParams ?? new URLSearchParams();
      const hash = new URLSearchParams((parsed?.hash ?? '').replace(/^#/, ''));
      const isRecovery = query.get('type') === 'recovery' || hash.get('type') === 'recovery';

      if (query.get('error') || hash.get('error')) {
        console.warn('[Nur] auth deep-link error:', query.get('error_description') || hash.get('error_description') || query.get('error'));
      } else if (query.get('code')) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) console.warn('[Nur] code exchange failed:', error.message);
      } else if (hash.get('access_token') && hash.get('refresh_token')) {
        const { error } = await supabase.auth.setSession({
          access_token: hash.get('access_token')!,
          refresh_token: hash.get('refresh_token')!,
        });
        if (error) console.warn('[Nur] setSession failed:', error.message);
      } else {
        console.warn('[Nur] auth deep-link had no code or tokens:', url);
      }

      if (isRecovery) onRecovery?.();
    } catch (e) {
      console.warn('[Nur] auth deep-link handling failed:', e);
    }
  });
}

// --- Guest / anonymous ---------------------------------------------------------

export async function signInAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

// Upgrade a guest (anonymous) session to a real email account without losing data.
export async function linkEmailToGuest(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// --- Profile -----------------------------------------------------------------

const rowToProfile = (r: any): CommunityProfile => ({
  id: r.id,
  displayName: r.display_name ?? '',
  avatarUrl: r.avatar_url ?? null,
  bio: r.bio ?? null,
  ageRange: r.age_range ?? null,
  languages: r.languages ?? [],
  interests: r.interests ?? [],
  isAnonymous: !!r.is_anonymous,
});

export async function fetchMyProfile(userId: string): Promise<CommunityProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

export interface ProfileDraft {
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  ageRange?: CommunityProfile['ageRange'];
  languages?: string[];
  interests?: string[];
}

export async function upsertMyProfile(userId: string, draft: ProfileDraft): Promise<CommunityProfile> {
  // A real upsert (not just UPDATE): the row is normally created by the
  // handle_new_user trigger, but this self-heals if it's missing — e.g. the
  // trigger didn't fire, or the profiles row was deleted out from under a
  // still-existing auth user.
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: draft.displayName.trim(),
      avatar_url: draft.avatarUrl ?? null,
      bio: draft.bio ?? null,
      age_range: draft.ageRange ?? null,
      languages: draft.languages ?? [],
      interests: draft.interests ?? [],
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return rowToProfile(data);
}
