# Nur — Supabase setup (Phase 0)

Community and the new real authentication run on Supabase. Everything else in Nur
(Qur'an, prayer times, adhan, Nur AI, personal reflections, goals) stays local and
works offline. Until the two env vars below are set, the app runs in **bypass mode**:
the old local-only gate is used and Community is disabled — nothing crashes.

## 1. Create the project

1. Create a project at <https://supabase.com/dashboard> (free tier is fine).
2. Project Settings → API. Copy **Project URL** and the **anon public** key.
3. Add them to `.env.local` (git-ignored):

   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=<anon public key>
   ```

   Never put the `service_role` key in `.env.local` or the client build.

## 2. Apply the database

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push          # applies supabase/migrations/*
```

The migrations create every Community table, all Row Level Security policies, the
`SECURITY DEFINER` helper functions, and the RPCs. Re-runnable and additive.

Optional — run the security tests (needs the local Docker stack, `supabase start`):

```bash
npx supabase test db
```

## 3. Auth providers

**Email OTP** works out of the box (8-digit codes, set via `auth.email.otp_length` in
`config.toml`). For real sending in production,
set up SMTP under Authentication → Emails.

**Google:**

1. Google Cloud Console → OAuth 2.0 Client ID (type: Web application).
2. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
3. Supabase Dashboard → Authentication → Providers → Google: paste the client ID
   and secret, enable.
4. Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs**: add
   `com.fedi.nur://auth-callback` (the Android deep link) and your web dev origin.

**Anonymous sign-ins** ("continue as guest"): Authentication → Providers → enable
"Anonymous sign-ins".

For local development with `supabase start`, the same values are read from
`.env.local` via `config.toml` (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` /
`_SECRET`).

## 4. Android

The Google OAuth deep link is already wired:

- `android/app/src/main/AndroidManifest.xml` has the
  `com.fedi.nur://auth-callback` intent-filter.
- `services/authService.ts` opens the provider in the system browser and completes
  the PKCE exchange from `appUrlOpen`.

After pulling these changes: `npm i && npx cap sync android`, then rebuild the APK.

## 5. Verify

- `npm run dev`, sign in with an email OTP, complete the profile screen, reload →
  lands on the dashboard with the session restored.
- Airplane mode → the app still opens and all non-Community features work.
