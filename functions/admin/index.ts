// Dashboard: draft list with statuses and workflow actions.
import { Env, User, Draft, esc } from '../lib/types';
import { page, html, flash } from '../lib/layout';
import { NETWORKS, Network } from '../lib/crosspost';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const isAdmin = user.role === 'admin';

  const rows = isAdmin
    ? await env.DB.prepare(
        `SELECT d.*, u.name AS author_name FROM drafts d JOIN users u ON u.id = d.author_id
         ORDER BY d.updated_at DESC`).all<Draft & { author_name: string }>()
    : await env.DB.prepare(
        `SELECT d.*, u.name AS author_name FROM drafts d JOIN users u ON u.id = d.author_id
         WHERE d.author_id = ? ORDER BY d.updated_at DESC`).bind(user.id).all<Draft & { author_name: string }>();

  // Latest crosspost result per (draft, network) — shown as status chips.
  const latest = await env.DB.prepare(
    `SELECT c.draft_id, c.network, c.status, c.url FROM crossposts c
       JOIN (SELECT draft_id, network, MAX(id) AS mid FROM crossposts GROUP BY draft_id, network) t
         ON c.id = t.mid`,
  ).all<{ draft_id: string; network: string; status: string; url: string | null }>();
  const xp = new Map<string, Map<string, { status: string; url: string | null }>>();
  for (const r of latest.results ?? []) {
    if (!xp.has(r.draft_id)) xp.set(r.draft_id, new Map());
    xp.get(r.draft_id)!.set(r.network, { status: r.status, url: r.url });
  }

  const crosspostChips = (d: Draft): string => {
    if (d.status !== 'published') return '<span class="muted">—</span>';
    const per = xp.get(d.id);
    return (Object.keys(NETWORKS) as Network[]).map((n) => {
      const r = per?.get(n);
      const short = NETWORKS[n].label.replace(/ \(Twitter\)/, '');
      if (!r) return `<span class="hint" title="${short}: not posted yet">${short} ·</span>`;
      if (r.status === 'ok') {
        return `<a class="badge b-published" style="text-decoration:none" title="${short}: posted${r.url ? ` — ${esc(r.url)}` : ''}"
          ${r.url ? `href="${esc(r.url)}" target="_blank"` : ''}>${short} ✓</a>`;
      }
      if (r.status === 'skipped') return `<span class="badge b-draft" title="${short}: not configured">${short} off</span>`;
      return `<span class="badge b-rejected" title="${short}: error — open the post to retry">${short} ✗</span>`;
    }).join(' ');
  };

  const trs = (rows.results ?? []).map((d) => {
    const actions: string[] = [`<a class="btn btn-ghost btn-sm" href="/admin/drafts/${d.id}">Edit</a>`];
    if (d.status === 'draft' || d.status === 'rejected') {
      actions.push(`<form method="post" action="/admin/drafts/${d.id}/submit" style="display:inline">
        <button class="btn btn-ghost btn-sm">Send to review</button></form>`);
    }
    if (isAdmin && d.status === 'review') {
      actions.push(`<form method="post" action="/admin/drafts/${d.id}/publish" style="display:inline">
        <button class="btn btn-accent btn-sm">Publish</button></form>`);
      actions.push(`<form method="post" action="/admin/drafts/${d.id}/reject" style="display:inline">
        <button class="btn btn-danger btn-sm">Reject</button></form>`);
    }
    if (d.status === 'published' && d.published_url) {
      actions.push(`<a class="btn btn-ghost btn-sm" href="${esc(d.published_url)}" target="_blank">View ↗</a>`);
    }
    return `<tr>
      <td><strong>${esc(d.title || '(untitled)')}</strong><br><span class="muted mono">/blog/${esc(d.slug)}</span></td>
      <td><span class="badge b-${d.status}">${d.status}</span></td>
      <td>${crosspostChips(d)}</td>
      <td class="muted">${esc(d.author_name)}${isAdmin ? '' : ''}</td>
      <td class="muted">${esc((d.updated_at ?? '').slice(0, 16).replace('T', ' '))}</td>
      <td style="white-space:nowrap;display:flex;gap:6px">${actions.join('')}</td>
    </tr>`;
  }).join('');

  return html(page('Posts', user, `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><h1>Posts</h1><p class="sub">${isAdmin ? 'All drafts and published articles.' : 'Your drafts. An admin publishes them after review.'}</p></div>
      <a class="btn" href="/admin/drafts/new">+ New post</a>
    </div>
    ${flash(request)}
    <div class="card" style="padding:6px 10px">
      ${trs ? `<table><thead><tr><th>Post</th><th>Status</th><th>Crosspost</th><th>Author</th><th>Updated</th><th></th></tr></thead><tbody>${trs}</tbody></table>`
            : '<p class="sub" style="padding:18px 10px">No posts yet — create the first one.</p>'}
    </div>`));
};
