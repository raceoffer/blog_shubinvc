// Admin rejects a draft (back to the author as "rejected" → editable again).
import { Env, User, Draft, redirect } from '../../../lib/types';
import { withMsg } from '../../../lib/layout';
import { audit, requireAdmin } from '../../../lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ env, params, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const d = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(String(params.id)).first<Draft>();
  if (!d) return redirect(withMsg('/admin', undefined, 'Draft not found.'));
  if (d.status !== 'review') return redirect(withMsg(`/admin/drafts/${d.id}`, undefined, 'Only posts in review can be rejected.'));

  await env.DB.prepare("UPDATE drafts SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").bind(d.id).run();
  await audit(env, user.id, 'draft_reject', d.title);
  return redirect(withMsg('/admin', 'Rejected — back to the author.'));
};
