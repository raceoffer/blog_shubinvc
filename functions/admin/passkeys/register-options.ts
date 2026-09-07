// Begin passkey registration for the logged-in user.
import { Env, User, json } from '../../lib/types';
import { registerOptions } from '../../lib/webauthn';

export const onRequestPost: PagesFunction<Env> = async ({ env, data }) => {
  const user = (data as any).user as User;
  return json(await registerOptions(env, user));
};
