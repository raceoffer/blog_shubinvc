// Admin triggers crossposting of a published post to one network.
import { Env, User, Draft, redirect } from '../../../lib/types';
import { withMsg } from '../../../lib/layout';
import { audit, requireAdmin } from '../../../lib/auth';
import { crosspost, NETWORKS, Network } from '../../../lib/crosspost';

export const onRequestPost: PagesFunction<Env> = async ({ env, request, params, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const d = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(String(params.id)).first<Draft>();
  if (!d || d.status !== 'published') {
    return redirect(withMsg('/admin', undefined, 'Only published posts can be crossposted.'));
  }

  const form = await request.formData();
  const network = String(form.get('network') ?? '') as Network;
  if (!(network in NETWORKS)) return redirect(withMsg(`/admin/drafts/${d.id}`, undefined, 'Unknown network.'));

  const result = await crosspost(env, d, network);
  await audit(env, user.id, 'crosspost', `${NETWORKS[network].label}: ${result.status}`);

  if (result.status === 'ok') {
    return redirect(withMsg(`/admin/drafts/${d.id}`, `${NETWORKS[network].label}: posted${result.url ? ` — ${result.url}` : '.'}`));
  }
  return redirect(withMsg(`/admin/drafts/${d.id}`, undefined,
    `${NETWORKS[network].label}: ${result.error ?? 'failed'}`));
};
