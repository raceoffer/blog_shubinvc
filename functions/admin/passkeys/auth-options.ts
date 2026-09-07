// Begin passkey authentication. Public, but requires a valid pre-auth ticket
// (issued after the password step). `uid` in the body is the ticket id.
import { Env, User, json } from '../../lib/types';
import { authOptions } from '../../lib/webauthn';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const { uid } = await request.json() as any;
  const userId = uid ? await env.ADMIN_KV.get(`preauth:${uid}`) : null;
  if (!userId) return json({ error: 'session expired' }, 401);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
  if (!user) return json({ error: 'unknown user' }, 401);
  return json(await authOptions(env, user));
};
