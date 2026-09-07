// Server-rendered preview of the draft body in the site's typography.
import { Env, User, Draft, esc } from '../../../lib/types';
import { renderMarkdown, PREVIEW_CSS } from '../../../lib/markdown';

export const onRequestPost: PagesFunction<Env> = async ({ env, request, params, data }) => {
  const user = (data as any).user as User;
  const d = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(String(params.id)).first<Draft>();
  if (!d) return new Response('Not found', { status: 404 });
  if (user.role !== 'admin' && d.author_id !== user.id) return new Response('Forbidden', { status: 403 });

  const { body, title } = await request.json() as { body?: string; title?: string };
  const htmlDoc = `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Preview — ${esc(title ?? d.title)}</title>
    <style>${PREVIEW_CSS}</style></head><body>
    <article class="prose">
      <p class="meta">${esc(d.topic)} · preview</p>
      <h1>${esc(title ?? d.title)}</h1>
      ${renderMarkdown(String(body ?? ''))}
    </article></body></html>`;
  return new Response(htmlDoc, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
