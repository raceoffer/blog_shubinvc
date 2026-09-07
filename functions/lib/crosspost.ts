// Crossposting to LinkedIn, X, Medium, Threads and Facebook.
// Tokens are stored encrypted in D1 settings and managed from /admin/settings.
import { Env, Draft, b64encode } from './types';
import { getSetting } from './crypto';

export interface CrosspostResult {
  status: 'ok' | 'error' | 'skipped';
  url?: string;
  error?: string;
}

const UA = { 'user-agent': 'shubinvc-admin' };

function postUrl(env: Env, d: Draft): string {
  return `${env.SITE_URL}/blog/${d.slug}`;
}

// ── LinkedIn (UGC Post, w_member_social token) ─────────────────────────────
async function toLinkedIn(env: Env, d: Draft, text: string): Promise<CrosspostResult> {
  const token = await getSetting(env, 'linkedin_token', true);
  const person = await getSetting(env, 'linkedin_person_id');
  if (!token || !person) return { status: 'skipped', error: 'LinkedIn token/person id not configured' };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...UA },
    body: JSON.stringify({
      author: `urn:li:person:${person}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'ARTICLE',
          media: [{
            status: 'READY',
            originalUrl: postUrl(env, d),
            title: { text: d.title },
            description: { text: d.description.slice(0, 200) },
          }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!res.ok) return { status: 'error', error: `LinkedIn ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = (await res.json().catch(() => ({}))) as any;
  return { status: 'ok', url: body.id ? `https://www.linkedin.com/feed/update/${body.id}` : undefined };
}

// ── X / Twitter (API v2, OAuth 1.0a user context) ──────────────────────────
function percent(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function oauth1Header(env: Env, method: string, url: string): Promise<string> {
  const ck = await getSetting(env, 'x_api_key', true);
  const cs = await getSetting(env, 'x_api_secret', true);
  const at = await getSetting(env, 'x_access_token', true);
  const ats = await getSetting(env, 'x_access_secret', true);
  if (!ck || !cs || !at || !ats) throw new Error('X credentials not configured');

  const nonce = b64encode(crypto.getRandomValues(new Uint8Array(24)).buffer).replace(/[^a-zA-Z0-9]/g, '');
  const ts = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    oauth_consumer_key: ck, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts, oauth_token: at, oauth_version: '1.0',
  };
  const base = `${method}&${percent(url)}&${percent(
    Object.keys(params).sort().map((k) => `${percent(k)}=${percent(params[k])}`).join('&'),
  )}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(`${percent(cs)}&${percent(ats)}`),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = b64encode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base)));
  return 'OAuth ' + Object.entries({ ...params, oauth_signature: sig })
    .map(([k, v]) => `${percent(k)}="${percent(v)}"`).join(', ');
}

async function toX(env: Env, d: Draft, text: string): Promise<CrosspostResult> {
  const url = 'https://api.x.com/2/tweets';
  let auth: string;
  try {
    auth = await oauth1Header(env, 'POST', url);
  } catch (e) {
    return { status: 'skipped', error: (e as Error).message };
  }
  const full = `${text}\n\n${postUrl(env, d)}`.slice(0, 280);
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json', ...UA },
    body: JSON.stringify({ text: full }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) return { status: 'error', error: `X ${res.status}: ${JSON.stringify(body).slice(0, 300)}` };
  const id = body?.data?.id;
  return { status: 'ok', url: id ? `https://x.com/i/status/${id}` : undefined };
}

// ── Medium (full article import with canonical URL) ────────────────────────
// NB: Medium no longer issues new integration tokens; existing ones still work.
async function toMedium(env: Env, d: Draft, _text: string): Promise<CrosspostResult> {
  const token = await getSetting(env, 'medium_token', true);
  if (!token) return { status: 'skipped', error: 'Medium token not configured' };

  let authorId = await getSetting(env, 'medium_author_id');
  if (!authorId) {
    const me = await fetch('https://api.medium.com/v1/me', { headers: { authorization: `Bearer ${token}`, ...UA } });
    if (!me.ok) return { status: 'error', error: `Medium /me ${me.status}: ${(await me.text()).slice(0, 300)}` };
    const meBody = (await me.json()) as any;
    authorId = meBody?.data?.id;
    if (!authorId) return { status: 'error', error: 'Medium: cannot resolve author id' };
    const { setSetting } = await import('./crypto');
    await setSetting(env, 'medium_author_id', authorId);
  }

  const tags = (JSON.parse(d.tags || '[]') as string[]).slice(0, 5);
  const res = await fetch(`https://api.medium.com/v1/users/${authorId}/posts`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...UA },
    body: JSON.stringify({
      title: d.title,
      contentFormat: 'markdown',
      content: `# ${d.title}\n\n${d.body}\n\n---\n*Originally published at [shubin.vc](${postUrl(env, d)})*`,
      tags,
      publishStatus: 'public',
      canonicalUrl: postUrl(env, d),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) return { status: 'error', error: `Medium ${res.status}: ${JSON.stringify(body).slice(0, 300)}` };
  return { status: 'ok', url: body?.data?.url };
}

// ── Threads (two-step container API) ───────────────────────────────────────
async function toThreads(env: Env, d: Draft, text: string): Promise<CrosspostResult> {
  const token = await getSetting(env, 'threads_token', true);
  const uid = await getSetting(env, 'threads_user_id');
  if (!token || !uid) return { status: 'skipped', error: 'Threads token/user id not configured' };

  const full = `${text}\n\n${postUrl(env, d)}`.slice(0, 500);
  const create = await fetch(
    `https://graph.threads.net/v1.0/${uid}/threads?media_type=TEXT&text=${encodeURIComponent(full)}&access_token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: UA },
  );
  const created = (await create.json().catch(() => ({}))) as any;
  if (!create.ok || !created.id) {
    return { status: 'error', error: `Threads create ${create.status}: ${JSON.stringify(created).slice(0, 300)}` };
  }
  const pub = await fetch(
    `https://graph.threads.net/v1.0/${uid}/threads_publish?creation_id=${created.id}&access_token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: UA },
  );
  const pubBody = (await pub.json().catch(() => ({}))) as any;
  if (!pub.ok) return { status: 'error', error: `Threads publish ${pub.status}: ${JSON.stringify(pubBody).slice(0, 300)}` };
  return { status: 'ok', url: pubBody.id ? `https://www.threads.net/post/${pubBody.id}` : undefined };
}

// ── Facebook (Page feed via Graph API) ─────────────────────────────────────
// Needs a long-lived PAGE access token with pages_manage_posts + page id.
async function toFacebook(env: Env, d: Draft, text: string): Promise<CrosspostResult> {
  const token = await getSetting(env, 'facebook_page_token', true);
  const pageId = await getSetting(env, 'facebook_page_id');
  if (!token || !pageId) return { status: 'skipped', error: 'Facebook page token/id not configured' };

  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...UA },
    body: JSON.stringify({ message: text, link: postUrl(env, d), access_token: token }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !body.id) {
    return { status: 'error', error: `Facebook ${res.status}: ${JSON.stringify(body).slice(0, 300)}` };
  }
  return { status: 'ok', url: `https://www.facebook.com/${body.id}` };
}

// ── dispatcher ─────────────────────────────────────────────────────────────
export const NETWORKS = {
  linkedin: { label: 'LinkedIn', fn: toLinkedIn },
  x: { label: 'X (Twitter)', fn: toX },
  medium: { label: 'Medium', fn: toMedium },
  threads: { label: 'Threads', fn: toThreads },
  facebook: { label: 'Facebook', fn: toFacebook },
} as const;

export type Network = keyof typeof NETWORKS;

export function defaultText(env: Env, d: Draft, network: Network): string {
  const social = JSON.parse(d.social || '{}');
  if (social[network]) return social[network] as string;
  // Fallbacks so a post never goes out with random text.
  const desc = d.description || d.title;
  return network === 'x' ? `${d.title}\n${desc}`.slice(0, 240) : `${d.title}\n\n${desc}`;
}

export async function crosspost(env: Env, d: Draft, network: Network): Promise<CrosspostResult> {
  const text = defaultText(env, d, network);
  const result = await NETWORKS[network].fn(env, d, text);
  await env.DB.prepare(
    'INSERT INTO crossposts (draft_id, network, status, url, error) VALUES (?, ?, ?, ?, ?)',
  ).bind(d.id, network, result.status, result.url ?? null, result.error ?? null).run();
  return result;
}
