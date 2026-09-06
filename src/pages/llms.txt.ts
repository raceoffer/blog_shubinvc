import type { APIRoute } from 'astro';
import { AUTHOR, NEWSLETTER, SITE } from '../consts';
import { getPosts, getTopics } from '../utils/posts';

// llms.txt — машиночитаемая карта контента для LLM (GEO).
// Спецификация: https://llmstxt.org
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

Автор: ${AUTHOR.name} (${AUTHOR.nameEn}), ${AUTHOR.role.toLowerCase()}.
Профили: ${AUTHOR.socials.map((s) => `${s.label} — ${s.url}`).join('; ')}.
Рассылка: ${NEWSLETTER.name} — ${SITE.url}/newsletter. RSS полного текста: ${SITE.url}/rss.xml.

## Страницы

- [О Нике](${SITE.url}/about): биография, выступления, контакты, sameAs-профили.
- [Блог — архив](${SITE.url}/blog): все посты с поиском и фильтром по рубрикам.
- [Исследования](${SITE.url}/research): флагманские обзоры рынков с открытыми данными.
- [Рассылка](${SITE.url}/newsletter): еженедельное письмо и архив выпусков.

${byTopic.filter(Boolean).join('\n\n')}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
