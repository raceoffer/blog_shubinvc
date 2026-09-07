// Create a new draft (any role).
import { Env, User, randomId, redirect, slugify, esc } from '../../lib/types';
import { page, html, withMsg } from '../../lib/layout';
import { audit } from '../../lib/auth';

export const onRequestGet: PagesFunction<Env> = async ({ data }) => {
  const user = (data as any).user as User;
  return html(page('New post', user, `
    <h1>New post</h1>
    <p class="sub">It starts as a draft. An admin publishes it after review.</p>
    <div class="card">
      <form method="post" action="/admin/drafts/new">
        <label>Title</label>
        <input type="text" name="title" required maxlength="120" placeholder="Post title">
        <label>Slug</label>
        <input type="text" name="slug" class="mono" placeholder="generated-from-title">
        <p class="hint">Lowercase Latin, dashes. Leave empty to generate from the title.</p>
        <p style="margin-top:18px"><button class="btn btn-accent" type="submit">Create draft</button></p>
      </form>
    </div>`));
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  let slug = slugify(String(form.get('slug') ?? '') || title);
  if (!title || !slug) return redirect(withMsg('/admin/drafts/new', undefined, 'Title is required.'));

  // Unique slug
  const clash = await env.DB.prepare('SELECT id FROM drafts WHERE slug = ?').bind(slug).first();
  if (clash) slug = `${slug}-${randomId(4)}`;

  const id = randomId();
  await env.DB.prepare(
    'INSERT INTO drafts (id, slug, title, author_id) VALUES (?, ?, ?, ?)',
  ).bind(id, slug, title, user.id).run();
  await audit(env, user.id, 'draft_create', `${title} (${slug})`);
  return redirect(`/admin/drafts/${id}`);
};
