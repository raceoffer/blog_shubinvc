// Serve a draft image from KV (authenticated).
import { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = decodeURIComponent(String(params.key));
  if (!key.startsWith('img:')) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.ADMIN_KV.getWithMetadata<{ contentType?: string }>(key, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, {
    headers: {
      'content-type': metadata?.contentType ?? 'image/png',
      'cache-control': 'private, max-age=3600',
    },
  });
};
