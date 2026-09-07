// Password hashing (PBKDF2 via WebCrypto), sessions, role guards.
import {
  Env, User, b64encode, b64decode, randomId, sha256, safeEqual, redirect,
} from './types';

// Cloudflare Workers WebCrypto caps PBKDF2 at 100000 iterations.
const ITERATIONS = 100_000;
export const SESSION_COOKIE = 'sb_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256,
  );
  return `pbkdf2$${ITERATIONS}$${b64encode(salt)}$${b64encode(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, iter, saltB64, hashB64] = stored.split('$');
    if (algo !== 'pbkdf2') return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64decode(saltB64) as BufferSource, iterations: Number(iter) }, key, 256,
    );
    return safeEqual(b64encode(bits), hashB64);
  } catch {
    return false;
  }
}

// ── sessions ───────────────────────────────────────────────────────────────
export async function createSession(env: Env, userId: string, req: Request): Promise<string> {
  const token = randomId(32);
  const id = b64encode(await sha256(token));
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?)',
  ).bind(
    id, userId, expires,
    req.headers.get('cf-connecting-ip') ?? '',
    (req.headers.get('user-agent') ?? '').slice(0, 200),
  ).run();
  return token;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function getSessionUser(env: Env, req: Request): Promise<User | null> {
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!m) return null;
  const id = b64encode(await sha256(decodeURIComponent(m[1])));
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.password_hash, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now')`,
  ).bind(id).first<User>();
  return row ?? null;
}

export async function destroySession(env: Env, req: Request): Promise<void> {
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!m) return;
  const id = b64encode(await sha256(decodeURIComponent(m[1])));
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}

// ── guards ─────────────────────────────────────────────────────────────────
export function requireAdmin(user: User): Response | null {
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  return null;
}

// CSRF: SameSite=Strict cookie + Origin check on mutations.
export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin form posts may omit it
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

// Naive login rate limit: 10 attempts per 10 minutes per IP (via KV).
export async function rateLimited(env: Env, req: Request): Promise<boolean> {
  const ip = req.headers.get('cf-connecting-ip') ?? 'anon';
  const key = `rl:${ip}`;
  const cur = Number((await env.ADMIN_KV.get(key)) ?? '0');
  if (cur >= 10) return true;
  await env.ADMIN_KV.put(key, String(cur + 1), { expirationTtl: 600 });
  return false;
}

export async function audit(env: Env, userId: string | null, action: string, detail = ''): Promise<void> {
  await env.DB.prepare('INSERT INTO audit (user_id, action, detail) VALUES (?, ?, ?)')
    .bind(userId, action, detail.slice(0, 500)).run();
}

export const loginRedirect = () => redirect('/admin/login');
