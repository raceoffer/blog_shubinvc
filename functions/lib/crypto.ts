// AES-GCM encryption for API tokens stored in D1 (key from TOKEN_KEY secret).
import { Env, b64encode, b64decode } from './types';

async function getKey(env: Env): Promise<CryptoKey> {
  const raw = b64decode(hexToB64(env.TOKEN_KEY));
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function hexToB64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b64encode(bytes);
}

export async function encryptValue(env: Env, plain: string): Promise<string> {
  if (!plain) return '';
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await getKey(env), new TextEncoder().encode(plain),
  );
  return `enc:v1:${b64encode(iv)}:${b64encode(cipher)}`;
}

export async function decryptValue(env: Env, stored: string): Promise<string> {
  if (!stored) return '';
  if (!stored.startsWith('enc:v1:')) return stored; // legacy plain value
  const [, , ivB64, cipherB64] = stored.split(':');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64) as BufferSource },
    await getKey(env),
    b64decode(cipherB64) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

// Settings helpers (encrypted for keys marked secret).
export async function getSetting(env: Env, key: string, secret = false): Promise<string> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key)
    .first<{ value: string }>();
  if (!row) return '';
  return secret ? decryptValue(env, row.value) : row.value;
}

export async function setSetting(env: Env, key: string, value: string, secret = false): Promise<void> {
  const stored = secret && value ? await encryptValue(env, value) : value;
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).bind(key, stored).run();
}
