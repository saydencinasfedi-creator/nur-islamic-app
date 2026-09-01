import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Project URL + anon key are inlined at build time by Vite (see vite.config.ts).
// The anon key is public by design — every table is guarded by Row Level Security.
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

// `true` only when both values were provided at build time. The rest of the app
// checks this before hitting any Community surface so a build without Supabase
// credentials still runs (everything except Community works offline/local).
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Nur] SUPABASE_URL / SUPABASE_ANON_KEY are not set — auth and Community are disabled. ' +
      'Add them to .env.local (see .env.example).'
  );
}

// Single shared client. In the Capacitor WebView the session persists in
// localStorage (survives app restarts -> the app opens straight to the dashboard,
// offline included). PKCE + manual deep-link handling for Google OAuth; email OTP
// needs neither, so detectSessionInUrl stays off.
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  }
);
