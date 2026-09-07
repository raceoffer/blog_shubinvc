// Finish passkey authentication → create the session.
import { Env, User, json } from '../../lib/types';
import { verifyAuthentication } from '../../lib/webauthn';
import { createSession, sessionCookie, audit } from '../../lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.json() as any;
  const ticket = String(body.uid ?? '');
  const userId = ticket ? await env.ADMIN_KV.get(`preauth:${ticket}`) : null;
  if (!userId) return json({ ok: false, error: 'session expired' }, 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
  if (!user) return json({ ok: false, error: 'unknown user' }, 401);

  try {
    await verifyAuthentication(env, request, user, body);
  } catch (e) {
    await audit(env, user.id, 'passkey_failed', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 401);
  }

  await env.ADMIN_KV.delete(`preauth:${ticket}`);
  const token = await createSession(env, user.id, request);
  await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();
  await audit(env, user.id, 'login', 'password + passkey');
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'set-cookie': sessionCookie(token) },
  });
};
