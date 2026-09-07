// Admin manages the set of topics available for posts.
// Stored in D1 settings; on publish each topic is committed to
// src/content/topics/<slug>.md so /topics/<slug> pages stay in sync.
import { Env, User, esc, redirect, slugify } from '../lib/types';
import { page, html, flash, withMsg } from '../lib/layout';
import { requireAdmin, audit } from '../lib/auth';
import { getTopics, saveTopics, Topic } from '../lib/topics';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const topics = await getTopics(env);
  const usage = await env.DB.prepare(
    'SELECT topic, COUNT(*) AS n FROM drafts GROUP BY topic',
  ).all<{ topic: string; n: number }>();
  const counts = new Map((usage.results ?? []).map((r) => [r.topic, r.n]));

  const rows = topics.map((t) => {
    const used = counts.get(t.slug) ?? 0;
    return `<div class="net" style="align-items:flex-start">
      <div style="flex:1.6">
        <form method="post" action="/admin/topics">
          <input type="hidden" name="action" value="save">
          <input type="hidden" name="slug" value="${esc(t.slug)}">
          <div class="row" style="gap:10px">
            <div style="flex:0 0 130px"><label>Slug</label><input type="text" class="mono" value="${esc(t.slug)}" disabled></div>
            <div><label>Title</label><input type="text" name="title" value="${esc(t.title)}" required maxlength="80"></div>
          </div>
          <label style="margin-top:10px">Description (topic page lede, ≤ 200 chars)</label>
          <textarea name="description" rows="2" maxlength="200">${esc(t.description)}</textarea>
          <p style="margin-top:10px;display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost btn-sm">Save</button>
            <span class="hint">${used} post${used === 1 ? '' : 's'} in admin use it · <span class="mono">/topics/${esc(t.slug)}</span></span>
          </p>
        </form>
      </div>
      <form method="post" action="/admin/topics"
        onsubmit="return confirm('Delete topic ${esc(t.slug)}? The select in the editor loses it; already published posts keep their topic page in the repo.')">
        <input type="hidden" name="action" value="delete">
        <input type="hidden" name="slug" value="${esc(t.slug)}">
        <button class="btn btn-danger btn-sm" ${used ? 'disabled title="Used by drafts — reassign them first"' : ''}>Delete</button>
      </form>
    </div>`;
  }).join('');

  return html(page('Topics', user, `
    <h1>Topics</h1>
    <p class="sub">The topic set offered in the post editor. Each topic also becomes a landing page
      <span class="mono">/topics/&lt;slug&gt;</span> on the site — its file is committed to the repo on the next publish.</p>
    ${flash(request)}
    <div class="card">${rows || '<p class="sub">No topics yet.</p>'}</div>

    <h2>Add topic</h2>
    <div class="card">
      <form method="post" action="/admin/topics" class="row" style="align-items:end">
        <input type="hidden" name="action" value="add">
        <div><label>Slug</label><input type="text" name="slug" class="mono" required placeholder="ai-agents">
          <p class="hint">Lowercase Latin, dashes.</p></div>
        <div><label>Title</label><input type="text" name="title" required maxlength="80" placeholder="AI Agents"></div>
        <div style="flex:1.4"><label>Description</label><input type="text" name="description" maxlength="200" placeholder="What this topic covers"></div>
        <div><button class="btn btn-accent">Add</button></div>
      </form>
    </div>`));
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const topics = await getTopics(env);

  if (action === 'add') {
    const slug = slugify(String(form.get('slug') ?? ''));
    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    if (!slug || !title) return redirect(withMsg('/admin/topics', undefined, 'Slug and title are required.'));
    if (topics.some((t) => t.slug === slug)) {
      return redirect(withMsg('/admin/topics', undefined, `Topic "${slug}" already exists.`));
    }
    topics.push({ slug, title, description });
    await saveTopics(env, topics);
    await audit(env, user.id, 'topic_add', slug);
    return redirect(withMsg('/admin/topics', `Topic "${title}" added. It goes live on the site with the next publish.`));
  }

  if (action === 'save') {
    const slug = String(form.get('slug') ?? '');
    const t = topics.find((x) => x.slug === slug);
    if (!t) return redirect(withMsg('/admin/topics', undefined, 'Topic not found.'));
    t.title = String(form.get('title') ?? '').trim() || t.title;
    t.description = String(form.get('description') ?? '').trim();
    await saveTopics(env, topics);
    await audit(env, user.id, 'topic_save', slug);
    return redirect(withMsg('/admin/topics', `Topic "${t.title}" saved.`));
  }

  if (action === 'delete') {
    const slug = String(form.get('slug') ?? '');
    const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM drafts WHERE topic = ?')
      .bind(slug).first<{ n: number }>();
    if ((used?.n ?? 0) > 0) {
      return redirect(withMsg('/admin/topics', undefined, `"${slug}" is used by drafts — reassign them first.`));
    }
    await saveTopics(env, topics.filter((t) => t.slug !== slug));
    await audit(env, user.id, 'topic_delete', slug);
    return redirect(withMsg('/admin/topics', `Topic "${slug}" removed from the editor.`));
  }

  return redirect('/admin/topics');
};
