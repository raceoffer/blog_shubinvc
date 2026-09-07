// Image upload for a draft → KV. URL /admin/img/<key> works in preview;
// at publish time images move into the repo under public/uploads/<slug>/.
import { Env, User, Draft, json, randomId } from '../../../lib/types';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const onRequestPost: PagesFunction<Env> = async ({ env, request, params, data }) => {
  const user = (data as any).user as User;
  const d = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(String(params.id)).first<Draft>();
  if (!d) return json({ error: 'Draft not found' }, 404);
  if (user.role !== 'admin' && d.author_id !== user.id) return json({ error: 'Forbidden' }, 403);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'No file' }, 400);
  if (!file.type.startsWith('image/')) return json({ error: 'Images only' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Max 8 MB' }, 400);

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `img:${d.id}:${randomId(6)}.${ext}`;
  await env.ADMIN_KV.put(key, await file.arrayBuffer(), {
    metadata: { contentType: file.type },
  });
  return json({ url: `/admin/img/${encodeURIComponent(key)}`, key });
};
