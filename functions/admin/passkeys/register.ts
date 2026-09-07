// Finish passkey registration.
import { Env, User, json, randomId } from '../../lib/types';
import { verifyRegistration } from '../../lib/webauthn';
import { audit } from '../../lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const body = await request.json() as any;
  try {
    const { credentialId, publicKeyJwk, counter } = await verifyRegistration(env, request, user, body);
    await env.DB.prepare(
      'INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, name) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(randomId(), user.id, credentialId, JSON.stringify(publicKeyJwk), counter,
      String(body.name ?? 'Passkey').slice(0, 60)).run();
    await audit(env, user.id, 'passkey_add', String(body.name ?? ''));
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 400);
  }
};
