import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { AUTHOR, SITE } from '../consts';
import { getPosts, getTopics } from '../utils/posts';

// Full-text RSS — valuable for readers and GEO alike.
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const topics = await getTopics();

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: `/blog/${post.id}`,
      pubDate: post.data.pubDate,
      author: `${AUTHOR.email} (${AUTHOR.name})`,
      categories: [
        topics.find((t) => t.id === post.data.topic)?.data.title ?? '',
        ...post.data.tags,
      ].filter(Boolean),
    })),
    customData: `<language>en</language>`,
  });
};
