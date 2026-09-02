import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Supabase project URL + anon key. The anon key is safe to ship in the client
      // (it is public by design and gated by Row Level Security); the service_role
      // key must never appear here.
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
      // Gates services/pushNotifications.ts's call to PushNotifications.register().
      // Calling it without android/app/google-services.json in place doesn't just
      // fail quietly — FirebaseMessaging.getInstance() throws synchronously inside
      // the native plugin call, which crashes the whole app (confirmed via logcat,
      // not a guess). Only flip this on once google-services.json is actually there.
      'process.env.FCM_ENABLED': JSON.stringify(env.FCM_ENABLED === 'true' ? 'true' : 'false'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
