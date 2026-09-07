// Draft editor: markdown body with toolbar + live preview, image uploads,
// TL;DR / FAQ, per-network social texts, service fields (admin), crossposting.
import { Env, User, Draft, esc, redirect, slugify } from '../../lib/types';
import { page, html, flash, withMsg } from '../../lib/layout';
import { audit, requireAdmin } from '../../lib/auth';
import { NETWORKS, Network, defaultText } from '../../lib/crosspost';
import { getTopics } from '../../lib/topics';

function canEdit(user: User, d: Draft): boolean {
  if (user.role === 'admin') return true;
  return d.author_id === user.id && (d.status === 'draft' || d.status === 'rejected');
}

async function loadDraft(env: Env, id: string): Promise<Draft | null> {
  return env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(id).first<Draft>();
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params, data }) => {
  const user = (data as any).user as User;
  const d = await loadDraft(env, String(params.id));
  if (!d) return redirect(withMsg('/admin', undefined, 'Draft not found.'));
  const isAdmin = user.role === 'admin';
  const editable = canEdit(user, d);

  const tldr = (JSON.parse(d.tldr || '[]') as string[]).join('\n');
  const tags = (JSON.parse(d.tags || '[]') as string[]).join(', ');
  const faq = d.faq && d.faq !== '[]' ? d.faq : '';
  const social = JSON.parse(d.social || '{}');

  // Managed topics; keep the draft's current topic selectable even if removed.
  const topics = await getTopics(env);
  if (d.topic && !topics.some((t) => t.slug === d.topic)) {
    topics.push({ slug: d.topic, title: `${d.topic} (legacy)`, description: '' });
  }

  const socialFields = (Object.keys(NETWORKS) as Network[]).map((n) => `
    <label>${NETWORKS[n].label} text</label>
    <textarea name="social_${n}" rows="2" placeholder="${esc(d.title)} — ${esc(d.description.slice(0, 60))}…"
      ${n === 'x' ? 'maxlength="280"' : ''} ${editable ? '' : 'disabled'}>${esc(social[n] ?? '')}</textarea>
    <p class="hint">Leave empty to use the default (title + description).${n === 'x' ? ' Max 280 chars incl. link.' : n === 'medium' ? ' Medium receives the full article; this text is not used.' : ''}</p>`,
  ).join('');

  // crosspost log (published posts)
  let crosspostBlock = '';
  if (d.status === 'published') {
    const log = await env.DB.prepare(
      'SELECT * FROM crossposts WHERE draft_id = ? ORDER BY id DESC LIMIT 20').bind(d.id)
      .all<{ network: string; status: string; url: string | null; error: string | null; created_at: string }>();
    const rows = (log.results ?? []).map((r) => `<tr>
      <td>${esc(NETWORKS[r.network as Network]?.label ?? r.network)}</td>
      <td><span class="badge ${r.status === 'ok' ? 'b-published' : r.status === 'skipped' ? 'b-draft' : 'b-rejected'}">${r.status}</span></td>
      <td>${r.url ? `<a href="${esc(r.url)}" target="_blank">${esc(r.url)}</a>` : ''}${r.error ? `<span class="muted">${esc(r.error.slice(0, 120))}</span>` : ''}</td>
      <td class="muted">${esc(r.created_at.slice(0, 16))}</td></tr>`).join('');
    crosspostBlock = `
      <h2>Crossposting</h2>
      <div class="card">
        ${isAdmin ? `<div class="row" style="gap:8px">
          ${(Object.keys(NETWORKS) as Network[]).map((n) => `
            <form method="post" action="/admin/drafts/${d.id}/crosspost">
              <input type="hidden" name="network" value="${n}">
              <button class="btn btn-ghost btn-sm">Post to ${NETWORKS[n].label}</button>
            </form>`).join('')}
        </div><p class="hint">Each network uses its own text from the Social texts section (or the default). Medium gets the full article with a canonical link.</p>` : ''}
        ${rows ? `<table style="margin-top:14px"><thead><tr><th>Network</th><th>Status</th><th>Link / error</th><th>When</th></tr></thead><tbody>${rows}</tbody></table>`
               : '<p class="hint" style="margin-top:10px">No crossposts yet.</p>'}
      </div>`;
  }

  return html(page(`Edit: ${d.title}`, user, `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <h1>${esc(d.title || '(untitled)')}</h1>
        <p class="sub"><span class="badge b-${d.status}">${d.status}</span> &nbsp;<span class="mono">/blog/${esc(d.slug)}</span>
          ${d.published_url ? ` &nbsp;<a href="${esc(d.published_url)}" target="_blank">view live ↗</a>` : ''}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${editable && (d.status === 'draft' || d.status === 'rejected') ? `
          <form method="post" action="/admin/drafts/${d.id}/submit"><button class="btn">Send to review</button></form>` : ''}
        ${isAdmin && d.status === 'review' ? `
          <form method="post" action="/admin/drafts/${d.id}/publish"><button class="btn btn-accent">Publish</button></form>
          <form method="post" action="/admin/drafts/${d.id}/reject"><button class="btn btn-danger">Reject</button></form>` : ''}
        ${isAdmin && d.status === 'published' ? `
          <form method="post" action="/admin/drafts/${d.id}/publish" onsubmit="return confirm('Re-publish with current content? This overwrites the live post.')"><button class="btn btn-ghost">Re-publish</button></form>` : ''}
      </div>
    </div>
    ${flash(request)}

    <form method="post" action="/admin/drafts/${d.id}" id="editor">
      <div class="card">
        <div class="row">
          <div>
            <label>Title</label>
            <input type="text" name="title" value="${esc(d.title)}" maxlength="120" ${editable ? '' : 'disabled'}>
          </div>
          <div>
            <label>Topic</label>
            <select name="topic" ${editable ? '' : 'disabled'}>
              ${topics.map((t) => `<option value="${esc(t.slug)}" ${d.topic === t.slug ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
            </select>
          </div>
        </div>
        <label>Description (lede — cards, meta, previews)</label>
        <textarea name="description" rows="2" maxlength="300" ${editable ? '' : 'disabled'}>${esc(d.description)}</textarea>
        <div class="row">
          <div>
            <label>SEO title <span class="hint">(optional, ≤ 60 chars; empty = post title)</span></label>
            <input type="text" name="seo_title" value="${esc(d.seo_title ?? '')}" maxlength="60" ${editable ? '' : 'disabled'}>
          </div>
          <div>
            <label>SEO description <span class="hint">(optional, ≤ 160; empty = lede)</span></label>
            <input type="text" name="seo_description" value="${esc(d.seo_description ?? '')}" maxlength="160" ${editable ? '' : 'disabled'}>
          </div>
        </div>
        <div class="row">
          <div>
            <label>Tags (comma separated)</label>
            <input type="text" name="tags" value="${esc(tags)}" ${editable ? '' : 'disabled'}>
          </div>
        </div>
        <label>TL;DR — one bullet per line (3–5)</label>
        <textarea name="tldr" rows="4" ${editable ? '' : 'disabled'}>${esc(tldr)}</textarea>
        <label>FAQ — JSON [{"q":"…","a":"…"}], optional</label>
        <textarea name="faq" rows="3" class="mono" placeholder='[{"q":"Question?","a":"Answer."}]' ${editable ? '' : 'disabled'}>${esc(faq)}</textarea>
      </div>

      <h2>Body</h2>
      <div class="card">
        <div class="toolbar" ${editable ? '' : 'style="display:none"'}>
          <button type="button" data-md="**|**">Bold</button>
          <button type="button" data-md="*|*">Italic</button>
          <button type="button" data-md="\n## |\n">H2</button>
          <button type="button" data-md="\n### |\n">H3</button>
          <button type="button" data-md="[|](https://)">Link</button>
          <button type="button" data-md="\n> |\n">Quote</button>
          <button type="button" data-md="\n- |\n">List</button>
          <button type="button" data-md="\n\`\`\`\n|\n\`\`\`\n">Code</button>
          <button type="button" data-md="\n| Col | Col |\n|---|---|\n| | |\n">Table</button>
          <label class="btn btn-ghost btn-sm" style="margin:0">+ Image
            <input type="file" id="img-input" accept="image/*" hidden>
          </label>
          <button type="button" id="preview-btn">Preview</button>
        </div>
        <textarea name="body" id="body" rows="20" ${editable ? '' : 'disabled'}>${esc(d.body)}</textarea>
        <p class="hint">Markdown. Images upload to the draft and are inserted as <span class="mono">![alt](url)</span>.</p>
      </div>

      <h2>Social texts</h2>
      <div class="card">${socialFields}</div>

      ${isAdmin ? `
      <h2>Service fields <span class="badge b-draft">admin</span></h2>
      <div class="card">
        <div class="row">
          <div>
            <label>Slug</label>
            <input type="text" name="slug" class="mono" value="${esc(d.slug)}">
          </div>
          <div>
            <label>Publish date</label>
            <input type="date" name="pub_date" value="${esc(d.pub_date ?? '')}">
            <p class="hint">Empty = today at publish.</p>
          </div>
        </div>
        <p style="margin-top:12px;display:flex;gap:22px">
          <label style="margin:0;text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--ink)">
            <input type="checkbox" name="featured" ${d.featured ? 'checked' : ''}> Featured on homepage</label>
          <label style="margin:0;text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--ink)">
            <input type="checkbox" name="research" ${d.research ? 'checked' : ''}> Research section</label>
        </p>
      </div>` : ''}

      ${editable ? `<p style="margin-top:18px;display:flex;gap:10px">
        <button class="btn btn-accent" type="submit">Save draft</button>
        <a class="btn btn-ghost" href="/admin">Back</a>
      </p>` : `<p style="margin-top:18px"><a class="btn btn-ghost" href="/admin">Back</a>
        <span class="hint">Read-only: ${d.status === 'review' ? 'waiting for an admin review.' : 'only the author can edit drafts.'}</span></p>`}
    </form>
    ${crosspostBlock}

    <script>
      const ta = document.getElementById('body');
      document.querySelectorAll('[data-md]').forEach(btn => btn.addEventListener('click', () => {
        const tpl = btn.dataset.md;
        const [before, after] = tpl.split('|');
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.slice(s, e);
        ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
        ta.focus(); ta.selectionStart = ta.selectionEnd = s + before.length + sel.length + after.length;
      }));
      document.getElementById('img-input')?.addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/admin/drafts/${d.id}/images', { method: 'POST', body: fd });
        const out = await res.json();
        if (out.url) {
          const ins = '\\n![' + file.name.replace(/\\.[^.]+$/, '') + '](' + out.url + ')\\n';
          const s = ta.selectionStart;
          ta.value = ta.value.slice(0, s) + ins + ta.value.slice(s);
        } else alert(out.error || 'Upload failed');
        ev.target.value = '';
      });
      document.getElementById('preview-btn')?.addEventListener('click', async () => {
        const res = await fetch('/admin/drafts/${d.id}/preview', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: ta.value, title: document.querySelector('[name=title]').value }),
        });
        const htmlDoc = await res.text();
        const w = window.open('', '_blank');
        w.document.write(htmlDoc); w.document.close();
      });
    </script>`));
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request, params, data }) => {
  const user = (data as any).user as User;
  const d = await loadDraft(env, String(params.id));
  if (!d) return redirect(withMsg('/admin', undefined, 'Draft not found.'));
  if (!canEdit(user, d)) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const g = (k: string) => String(form.get(k) ?? '');

  const tldr = g('tldr').split('\n').map((s) => s.trim()).filter(Boolean);
  const tags = g('tags').split(',').map((s) => s.trim()).filter(Boolean);
  let faq = '[]';
  const faqRaw = g('faq').trim();
  if (faqRaw) {
    try {
      const parsed = JSON.parse(faqRaw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      faq = JSON.stringify(parsed);
    } catch {
      return redirect(withMsg(`/admin/drafts/${d.id}`, undefined, 'FAQ must be valid JSON: [{"q":"…","a":"…"}]'));
    }
  }

  const social: Record<string, string> = {};
  for (const n of Object.keys(NETWORKS)) {
    const v = g(`social_${n}`).trim();
    if (v) social[n] = v;
  }

  const fields = [
    g('title').trim(), g('description').trim(), g('topic'), JSON.stringify(tags),
    JSON.stringify(tldr), faq, g('body'), JSON.stringify(social), d.id,
  ];
  await env.DB.prepare(
    `UPDATE drafts SET title = ?, description = ?, topic = ?, tags = ?, tldr = ?, faq = ?,
       body = ?, social = ?, updated_at = datetime('now') WHERE id = ?`,
  ).bind(...fields).run();

  // SEO overrides live in columns added by a later migration — fail soft if absent.
  try {
    await env.DB.prepare('UPDATE drafts SET seo_title = ?, seo_description = ? WHERE id = ?')
      .bind(g('seo_title').trim(), g('seo_description').trim(), d.id).run();
  } catch { /* columns not migrated yet — see admin/schema.sql */ }

  // Admin-only service fields
  if (user.role === 'admin') {
    const slug = slugify(g('slug')) || d.slug;
    await env.DB.prepare(
      'UPDATE drafts SET slug = ?, pub_date = ?, featured = ?, research = ? WHERE id = ?',
    ).bind(slug, g('pub_date') || null, form.get('featured') ? 1 : 0, form.get('research') ? 1 : 0, d.id).run();
  }

  await audit(env, user.id, 'draft_save', d.title);
  return redirect(withMsg(`/admin/drafts/${d.id}`, 'Saved.'));
};
