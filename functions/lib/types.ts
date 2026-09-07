// Shared types + small utilities for the admin functions.

export interface Env {
  DB: D1Database;
  ADMIN_KV: KVNamespace;
  GITHUB_TOKEN: string;
  TOKEN_KEY: string;
  GOOGLE_SA_JSON?: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SITE_URL: string;
  RP_ID: string;
  RP_NAME: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'writer' | 'admin';
}

export interface Draft {
  id: string;
  slug: string;
  title: string;
  description: string;
  topic: string;
  tags: string;      // JSON
  tldr: string;      // JSON
  faq: string;       // JSON
  body: string;
  featured: number;
  research: number;
  status: 'draft' | 'review' | 'published' | 'rejected';
  author_id: string;
  pub_date: string | null;
  social: string;    // JSON
  seo_title?: string;        // optional manual overrides (ALTER TABLE migration)
  seo_description?: string;
  published_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// ── bytes ⇄ base64(url) ────────────────────────────────────────────────────
export function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function b64url(buf: ArrayBuffer | Uint8Array): string {
  return b64encode(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(s: string): Uint8Array {
  return b64decode(s.replace(/-/g, '+').replace(/_/g, '/'));
}

export function randomId(bytes = 16): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return b64url(b);
}

export async function sha256(data: string | ArrayBuffer): Promise<ArrayBuffer> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return crypto.subtle.digest('SHA-256', buf);
}

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function redirect(to: string, headers: HeadersInit = {}): Response {
  return new Response(null, { status: 303, headers: { location: to, ...headers } });
}

// Constant-time string compare.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
