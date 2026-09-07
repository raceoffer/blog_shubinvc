// Auth gate for everything under /admin/*.
import { Env } from '../lib/types';
import { getSessionUser, checkOrigin, loginRedirect } from '../lib/auth';

const PUBLIC_PATHS = new Set([
  '/admin/login',
  '/admin/setup', // self-guards: only works while no users exist
  '/admin/passkeys/auth-options',
  '/admin/passkeys/auth',
]);

export const onRequest: PagesFunction<Env>[] = [
  async (ctx) => {
    const url = new URL(ctx.request.url);
    if (PUBLIC_PATHS.has(url.pathname)) return ctx.next();

    if (ctx.request.method !== 'GET' && !checkOrigin(ctx.request)) {
      return new Response('Bad origin', { status: 403 });
    }

    const user = await getSessionUser(ctx.env, ctx.request);
    if (!user) return loginRedirect();

    (ctx.data as any).user = user;
    return ctx.next();
  },
];
