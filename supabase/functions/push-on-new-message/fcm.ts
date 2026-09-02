// Minimal FCM HTTP v1 client for Deno's Edge Runtime — no Node-only firebase-admin
// SDK available here, so this hand-rolls the two things it would otherwise give us:
// signing a service-account JWT and exchanging it for an OAuth2 access token.

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const base64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
};

// Cached across warm invocations of the same function instance — a token is valid
// for an hour, no need to mint a fresh one on every message.
let cachedToken: { value: string; expiresAt: number } | null = null;

const mintAccessToken = async (sa: ServiceAccount): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${claims}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in ?? 3600) };
  return cachedToken.value;
};

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

// Returns 'ok', 'invalid_token' (caller should delete it), or the raw FCM error
// text (transient — leave the token in place, it might work next time).
export const sendPush = async (sa: ServiceAccount, push: PushPayload): Promise<string> => {
  const accessToken = await mintAccessToken(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: push.token,
        notification: { title: push.title, body: push.body },
        data: push.data,
        android: { priority: 'high' },
      },
    }),
  });
  if (res.ok) return 'ok';
  const text = await res.text();
  // UNREGISTERED / INVALID_ARGUMENT on a stale token — FCM's documented way of
  // saying "this token will never work again, stop trying".
  if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) return 'invalid_token';
  return `error ${res.status}: ${text}`;
};
