// Minimal WebAuthn (passkeys) server: ES256, attestation "none".
// Includes a tiny CBOR decoder — enough for attestationObject and COSE keys.
import { Env, User, b64url, b64urlDecode, randomId, safeEqual } from './types';

// ── CBOR decode ────────────────────────────────────────────────────────────
type Cbor = number | string | Uint8Array | Cbor[] | Map<Cbor, Cbor> | boolean | null;

function cborDecode(buf: Uint8Array, pos = 0): [Cbor, number] {
  const ib = buf[pos];
  const major = ib >> 5;
  const minor = ib & 31;
  let p = pos + 1;
  const readN = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + buf[p++];
    return v;
  };
  let len: number;
  if (minor < 24) len = minor;
  else if (minor === 24) len = readN(1);
  else if (minor === 25) len = readN(2);
  else if (minor === 26) len = readN(4);
  else throw new Error('cbor: unsupported length');

  switch (major) {
    case 0: return [len, p];
    case 1: return [-1 - len, p];
    case 2: return [buf.slice(p, p + len), p + len];
    case 3: return [new TextDecoder().decode(buf.slice(p, p + len)), p + len];
    case 4: {
      const arr: Cbor[] = [];
      for (let i = 0; i < len; i++) { const [v, np] = cborDecode(buf, p); arr.push(v); p = np; }
      return [arr, p];
    }
    case 5: {
      const map = new Map<Cbor, Cbor>();
      for (let i = 0; i < len; i++) {
        const [k, np] = cborDecode(buf, p); p = np;
        const [v, np2] = cborDecode(buf, p); p = np2;
        map.set(k, v);
      }
      return [map, p];
    }
    case 7:
      if (minor === 20) return [false, p];
      if (minor === 21) return [true, p];
      if (minor === 22) return [null, p];
      throw new Error('cbor: unsupported simple');
    default:
      throw new Error('cbor: unsupported major ' + major);
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}

function parseClientData(raw: Uint8Array): ClientData {
  return JSON.parse(new TextDecoder().decode(raw));
}

function originAllowed(origin: string, env: Env, req: Request): boolean {
  const allowed = new Set([
    `https://${env.RP_ID}`,
    new URL(req.url).origin, // preview deployments
    'http://localhost:8788',
  ]);
  return allowed.has(origin);
}

// ── registration ───────────────────────────────────────────────────────────
export async function registerOptions(env: Env, user: User) {
  const challenge = randomId(32);
  await env.ADMIN_KV.put(`chal:reg:${user.id}`, challenge, { expirationTtl: 300 });
  return {
    challenge,
    rp: { name: env.RP_NAME, id: env.RP_ID },
    user: {
      id: b64url(new TextEncoder().encode(user.id)),
      name: user.email,
      displayName: user.name,
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    timeout: 60_000,
    attestation: 'none',
  };
}

export async function verifyRegistration(
  env: Env, req: Request, user: User, body: { id: string; clientDataJSON: string; attestationObject: string },
): Promise<{ credentialId: string; publicKeyJwk: JsonWebKey; counter: number }> {
  const expected = await env.ADMIN_KV.get(`chal:reg:${user.id}`);
  await env.ADMIN_KV.delete(`chal:reg:${user.id}`);
  if (!expected) throw new Error('challenge expired');

  const clientData = parseClientData(b64urlDecode(body.clientDataJSON));
  if (clientData.type !== 'webauthn.create') throw new Error('bad type');
  if (!safeEqual(clientData.challenge, expected)) throw new Error('bad challenge');
  if (!originAllowed(clientData.origin, env, req)) throw new Error('bad origin');

  const attObj = cborDecode(b64urlDecode(body.attestationObject))[0] as Map<Cbor, Cbor>;
  const authData = attObj.get('authData') as Uint8Array;

  const rpHash = await sha256Bytes(new TextEncoder().encode(env.RP_ID));
  if (b64url(authData.slice(0, 32)) !== b64url(rpHash)) throw new Error('bad rp hash');
  const flags = authData[32];
  if (!(flags & 0x01)) throw new Error('user not present');
  if (!(flags & 0x40)) throw new Error('no attested credential data');
  const counter = new DataView(authData.buffer, 33).getUint32(0);

  const credIdLen = new DataView(authData.buffer, 53).getUint16(0);
  const credId = authData.slice(55, 55 + credIdLen);
  const cose = cborDecode(authData.slice(55 + credIdLen))[0] as Map<Cbor, Cbor>;

  const kty = cose.get(1);
  const alg = cose.get(3);
  const crv = cose.get(-1);
  if (kty !== 2 || alg !== -7 || crv !== 1) throw new Error('only ES256 passkeys are supported');
  const x = cose.get(-2) as Uint8Array;
  const y = cose.get(-3) as Uint8Array;

  return {
    credentialId: b64url(credId),
    publicKeyJwk: { kty: 'EC', crv: 'P-256', x: b64url(x), y: b64url(y), ext: true },
    counter,
  };
}

// ── authentication ─────────────────────────────────────────────────────────
export async function authOptions(env: Env, user: User) {
  const keys = await env.DB.prepare('SELECT credential_id FROM passkeys WHERE user_id = ?')
    .bind(user.id).all<{ credential_id: string }>();
  const challenge = randomId(32);
  await env.ADMIN_KV.put(`chal:auth:${user.id}`, challenge, { expirationTtl: 300 });
  return {
    challenge,
    rpId: env.RP_ID,
    allowCredentials: (keys.results ?? []).map((k) => ({ type: 'public-key', id: k.credential_id })),
    userVerification: 'preferred',
    timeout: 60_000,
  };
}

export async function verifyAuthentication(
  env: Env, req: Request, user: User,
  body: { id: string; clientDataJSON: string; authenticatorData: string; signature: string },
): Promise<void> {
  const expected = await env.ADMIN_KV.get(`chal:auth:${user.id}`);
  await env.ADMIN_KV.delete(`chal:auth:${user.id}`);
  if (!expected) throw new Error('challenge expired');

  const clientData = parseClientData(b64urlDecode(body.clientDataJSON));
  if (clientData.type !== 'webauthn.get') throw new Error('bad type');
  if (!safeEqual(clientData.challenge, expected)) throw new Error('bad challenge');
  if (!originAllowed(clientData.origin, env, req)) throw new Error('bad origin');

  const key = await env.DB.prepare('SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ?')
    .bind(body.id, user.id).first<{ id: string; public_key: string; counter: number }>();
  if (!key) throw new Error('unknown credential');

  const authData = b64urlDecode(body.authenticatorData);
  const rpHash = await sha256Bytes(new TextEncoder().encode(env.RP_ID));
  if (b64url(authData.slice(0, 32)) !== b64url(rpHash)) throw new Error('bad rp hash');
  if (!(authData[32] & 0x01)) throw new Error('user not present');
  const counter = new DataView(authData.buffer, 33, 4).getUint32(0);

  const signed = concat(authData, await sha256Bytes(b64urlDecode(body.clientDataJSON)));
  const pub = await crypto.subtle.importKey(
    'jwk', JSON.parse(key.public_key), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  // WebAuthn signs with ASN.1 DER; WebCrypto wants raw r||s.
  const sig = derToRaw(b64urlDecode(body.signature));
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, pub, sig as BufferSource, signed as BufferSource,
  );
  if (!ok) throw new Error('bad signature');

  // Cloned-authenticator heuristic (0 = counter unsupported).
  if (counter !== 0 && key.counter !== 0 && counter <= key.counter) throw new Error('counter regression');
  await env.DB.prepare('UPDATE passkeys SET counter = ? WHERE id = ?').bind(counter, key.id).run();
}

function derToRaw(der: Uint8Array): Uint8Array {
  // SEQUENCE { INTEGER r, INTEGER s } → 64-byte r||s
  let p = 2;
  if (der[p++] !== 0x02) throw new Error('bad der');
  let rLen = der[p++];
  let r = der.slice(p, p + rLen); p += rLen;
  if (der[p++] !== 0x02) throw new Error('bad der');
  let sLen = der[p++];
  let s = der.slice(p, p + sLen);
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}
