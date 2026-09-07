// Admin publishes a draft:
//   1. builds the markdown file with frontmatter,
//   2. moves draft images from KV into the repo (public/uploads/<slug>/),
//   3. commits everything to GitHub in ONE commit → Cloudflare Pages rebuilds,
//      and the rebuild regenerates sitemap.xml / rss.xml / llms.txt automatically,
//   4. optionally notifies Google (Indexing API — see lib/google.ts).
import { Env, User, Draft, redirect, b64encode } from '../../../lib/types';
import { withMsg } from '../../../lib/layout';
import { audit, requireAdmin } from '../../../lib/auth';
import { commitFiles, toBase64Utf8, CommitFile } from '../../../lib/github';
import { notifyGoogle } from '../../../lib/google';
import { getTopics, topicMarkdown } from '../../../lib/topics';

function yamlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, params, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const d = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(String(params.id)).first<Draft>();
  if (!d) return redirect(withMsg('/admin', undefined, 'Draft not found.'));
  if (d.status !== 'review' && d.status !== 'published') {
    return redirect(withMsg(`/admin/drafts/${d.id}`, undefined, 'Only posts in review can be published.'));
  }

  const tldr = JSON.parse(d.tldr || '[]') as string[];
  if (!d.title.trim() || !d.description.trim() || !d.body.trim() || tldr.length < 3) {
    return redirect(withMsg(`/admin/drafts/${d.id}`, undefined,
      'Missing required content: title, description, body and at least 3 TL;DR bullets.'));
  }

  const slug = d.slug;
  const pubDate = d.pub_date ?? new Date().toISOString().slice(0, 10);

  // ── move images from KV into the repo ──────────────────────────────────────
  const files: CommitFile[] = [];
  let body = d.body;
  const imgKeys = await env.ADMIN_KV.list({ prefix: `img:${d.id}:` });
  for (const k of imgKeys.keys) {
    const stored = await env.ADMIN_KV.get(k.name, 'arrayBuffer');
    if (!stored) continue;
    const fileName = k.name.split(':').pop()!;
    const repoPath = `public/uploads/${slug}/${fileName}`;
    files.push({ path: repoPath, content: b64encode(stored), encoding: 'base64' });
    body = body.replaceAll(`/admin/img/${encodeURIComponent(k.name)}`, `/uploads/${slug}/${fileName}`);
    body = body.replaceAll(`/admin/img/${k.name}`, `/uploads/${slug}/${fileName}`);
  }

  // ── markdown with frontmatter ──────────────────────────────────────────────
  const tags = JSON.parse(d.tags || '[]') as string[];
  const faq = JSON.parse(d.faq || '[]') as { q: string; a: string }[];
  const social = JSON.parse(d.social || '{}');

  const fm: string[] = [
    '---',
    `title: ${yamlString(d.title)}`,
    `description: ${yamlString(d.description)}`,
    `topic: ${d.topic}`,
  ];
  if (tags.length) fm.push(`tags: [${tags.map(yamlString).join(', ')}]`);
  fm.push(`pubDate: ${pubDate}`);
  if (tldr.length) fm.push('tldr:', ...tldr.map((t) => `  - ${yamlString(t)}`));
  if (faq.length) {
    fm.push('faq:');
    for (const f of faq) {
      fm.push(`  - q: ${yamlString(f.q)}`, `    a: ${yamlString(f.a)}`);
    }
  }
  if (d.featured) fm.push('featured: true');
  if (d.research) fm.push('research: true');
  if (d.seo_title || d.seo_description) {
    fm.push('seo:');
    if (d.seo_title) fm.push(`  title: ${yamlString(d.seo_title)}`);
    if (d.seo_description) fm.push(`  description: ${yamlString(d.seo_description)}`);
  }
  if (Object.keys(social).length) {
    fm.push('social:');
    for (const [k, v] of Object.entries(social)) fm.push(`  ${k}: ${yamlString(String(v))}`);
  }
  fm.push('---', '');

  // Topic landing pages: (re)commit the admin-managed topic set so a new topic
  // goes live with the same deploy. Deleted topics keep their files in the repo
  // so old posts never lose /topics/<slug>.
  const topics = await getTopics(env);
  for (const t of topics) {
    files.push({ path: `src/content/topics/${t.slug}.md`, content: topicMarkdown(t) });
  }

  files.push({
    path: `src/content/blog/${slug}.md`,
    content: fm.join('\n') + body.trim() + '\n',
  });

  try {
    await commitFiles(env, files, `post: ${d.title}`);
  } catch (e) {
    return redirect(withMsg(`/admin/drafts/${d.id}`, undefined, `GitHub publish failed: ${(e as Error).message.slice(0, 200)}`));
  }

  const publishedUrl = `${env.SITE_URL}/blog/${slug}`;
  await env.DB.prepare(
    `UPDATE drafts SET status = 'published', pub_date = ?, body = ?, published_url = ?,
       published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
  ).bind(pubDate, body, publishedUrl, d.id).run();
  await audit(env, user.id, 'publish', `${d.title} → ${publishedUrl}`);

  // Fire-and-forget: ask Google to re-crawl (skipped unless configured).
  const g = await notifyGoogle(env, publishedUrl);
  if (g !== 'skipped') await audit(env, user.id, 'google_ping', `${publishedUrl}: ${g}`);

  return redirect(withMsg(`/admin/drafts/${d.id}`,
    `Published! Pages is rebuilding — the post, sitemap, RSS and llms.txt go live in ~1–2 minutes.`));
};
