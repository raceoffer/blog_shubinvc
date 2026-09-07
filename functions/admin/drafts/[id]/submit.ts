// Author submits a draft for admin review.
import { Env, User, Draft, redirect } from '../../../lib/types';
import { withMsg } from '../../../lib/layout';
import { audit } from '../../../lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ env, params, data }) => {
  const user = (data as any).user as User;
  const d = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(String(params.id)).first<Draft>();
  if (!d) return redirect(withMsg('/admin', undefined, 'Draft not found.'));
  const own = d.author_id === user.id;
  if (!(own || user.role === 'admin')) return new Response('Forbidden', { status: 403 });
  if (d.status !== 'draft' && d.status !== 'rejected') return redirect(withMsg(`/admin/drafts/${d.id}`, undefined, `Cannot submit from status "${d.status}".`));

  await env.DB.prepare("UPDATE drafts SET status = 'review', updated_at = datetime('now') WHERE id = ?").bind(d.id).run();
  await audit(env, user.id, 'draft_submit', d.title);
  return redirect(withMsg('/admin', 'Sent to review.'));
};
