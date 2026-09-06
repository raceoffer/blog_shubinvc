import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type Topic = CollectionEntry<'topics'>;

/** Все опубликованные посты, свежие сверху. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export async function getTopics(): Promise<Topic[]> {
  return getCollection('topics');
}

export function postsByTopic(posts: Post[], topic: string): Post[] {
  return posts.filter((p) => p.data.topic === topic);
}

/** Время чтения: ~180 слов/мин для русского технического текста. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

/** Связанные посты: та же рубрика, затем пересечение по тегам. */
export function relatedPosts(current: Post, all: Post[], limit = 3): Post[] {
  const scored = all
    .filter((p) => p.id !== current.id)
    .map((p) => {
      let score = 0;
      if (p.data.topic === current.data.topic) score += 2;
      score += p.data.tags.filter((t) => current.data.tags.includes(t)).length;
      return { p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.p.data.pubDate.getTime() - a.p.data.pubDate.getTime());
  return scored.slice(0, limit).map(({ p }) => p);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString();
}
