import { Env, redirect } from '../lib/types';
import { destroySession, clearSessionCookie } from '../lib/auth';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  await destroySession(env, request);
  return redirect('/admin/login', { 'set-cookie': clearSessionCookie() });
};
