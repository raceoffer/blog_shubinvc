// Optional: notify Google about a new/updated URL via the Indexing API.
//
// Important caveat: the Indexing API is officially supported only for
// JobPosting and live-stream (BroadcastEvent) content. For blog posts the
// reliable mechanism is the auto-updated sitemap.xml (fresh <lastmod> after
// every publish) — Google picks that up on its own crawl schedule. The old
// sitemap "ping" endpoint was shut down by Google in 2024.
//
// This hook is therefore OFF unless GOOGLE_SA_JSON (service account JSON with
// the Indexing API enabled, added as an owner of the Search Console property)
// is configured. Many publishers use it for regular pages and it works in
// practice — just don't rely on it as the only channel.
import { Env, b64url } from './types';

async function googleAccessToken(env: Env): Promise<string> {
  const sa = JSON.parse(env.GOOGLE_SA_JSON!);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));

  // PEM → CryptoKey
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`),
  );
  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const body = (await res.json()) as any;
  if (!res.ok) throw new Error(`token ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body.access_token;
}

export async function notifyGoogle(env: Env, url: string): Promise<'sent' | 'skipped' | 'error'> {
  if (!env.GOOGLE_SA_JSON) return 'skipped';
  try {
    const token = await googleAccessToken(env);
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    return res.ok ? 'sent' : 'error';
  } catch {
    return 'error';
  }
}
