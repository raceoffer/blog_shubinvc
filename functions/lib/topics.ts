// Managed post topics — stored in D1 settings as JSON, editable in /admin/topics.
// On publish, the topic's markdown file is (re)committed to src/content/topics/
// so the site's /topics/<slug> pages always match the admin-managed set.
import { Env } from './types';
import { getSetting, setSetting } from './crypto';

export interface Topic {
  slug: string;
  title: string;
  description: string;
}

export const DEFAULT_TOPICS: Topic[] = [
  {
    slug: 'startups',
    title: 'Startups',
    description: 'Building companies from zero: teams, unit economics, mistakes and pivots — with real numbers.',
  },
  {
    slug: 'product',
    title: 'Product',
    description: 'Product management in practice: discovery, retention, metrics and roadmap trade-offs.',
  },
  {
    slug: 'ai',
    title: 'Artificial Intelligence',
    description: 'What AI actually changes in business: unit economics, agents, markets. No hype — with numbers and implementation teardowns.',
  },
  {
    slug: 'venture',
    title: 'Venture',
    description: 'Early-stage investing from the inside: term sheets, rounds, fund economics and founder–investor dynamics.',
  },
];

export async function getTopics(env: Env): Promise<Topic[]> {
  const raw = await getSetting(env, 'topics');
  if (!raw) return DEFAULT_TOPICS;
  try {
    const parsed = JSON.parse(raw) as Topic[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_TOPICS;
    return parsed.filter((t) => t && t.slug && t.title);
  } catch {
    return DEFAULT_TOPICS;
  }
}

export async function saveTopics(env: Env, topics: Topic[]): Promise<void> {
  await setSetting(env, 'topics', JSON.stringify(topics));
}

// Markdown file for src/content/topics/<slug>.md — committed on publish.
export function topicMarkdown(t: Topic): string {
  const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return `---\ntitle: ${q(t.title)}\ndescription: ${q(t.description)}\n---\n\n${t.description}\n`;
}
