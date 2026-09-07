import type { APIRoute } from 'astro';
import { AUTHOR, NEWSLETTER, SITE } from '../consts';
import { getPosts, getTopics } from '../utils/posts';

// llms.txt — a machine-readable content map for LLMs (GEO).
// Spec: https://llmstxt.org
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const topics = await getTopics();

  const byTopic = topics.map((topic) => {
    const inTopic = posts.filter((p) => p.data.topic === topic.id);
    if (inTopic.length === 0) return '';
    const items = inTopic
      .map(
        (p) =>
          `- [${p.data.title}](${SITE.url}/blog/${p.id}): ${p.data.description}`,
      )
      .join('\n');
    return `## ${topic.data.title}\n\n${items}`;
  });

  const body = `# ${SITE.shortTitle}

> ${SITE.description}

Author: ${AUTHOR.name} (${AUTHOR.nameNative}), ${AUTHOR.role.toLowerCase()}.
Profiles: ${AUTHOR.socials.map((s) => `${s.label} — ${s.url}`).join('; ')}.
Newsletter: ${NEWSLETTER.name} — ${SITE.url}/newsletter. Full-text RSS: ${SITE.url}/rss.xml.

## Pages

- [About Nik](${SITE.url}/about): bio, talks, contacts, sameAs profiles.
- [Blog — archive](${SITE.url}/blog): all posts with search and topic filters.
- [Research](${SITE.url}/research): flagship market overviews with open data.
- [Newsletter](${SITE.url}/newsletter): the weekly email and issue archive.

${byTopic.filter(Boolean).join('\n\n')}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
