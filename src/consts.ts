// Central site configuration.
// Everything you might want to customize lives here.

export const SITE = {
  url: 'https://shubin.vc',
  title: 'Nick Shubin — on startups, product & AI',
  shortTitle: 'Nick Shubin',
  description:
    'The personal blog of founder and investor Nick Shubin: startups, product, AI and venture — with numbers, tables and zero fluff.',
  lang: 'en',
  locale: 'en_US',
} as const;

export const AUTHOR = {
  name: 'Nick Shubin',
  nameNative: 'Ник Шубин',
  role: 'Founder & Investor',
  bio: 'I build tech companies and invest at the earliest stages. I write about what I have tested with my own money and mistakes.',
  email: 'hi@shubin.vc',
  // sameAs profiles — important for Schema.org Person and GEO (a unified author graph).
  socials: [
    { label: 'Telegram', url: 'https://t.me/nickshubin' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/nickshubin' },
    { label: 'X', url: 'https://x.com/nickshubin' },
    { label: 'GitHub', url: 'https://github.com/nickshubin' },
  ],
} as const;

// Subscription: Buttondown (double opt-in, exportable list, RSS-to-email).
// After signing up, replace `shubinvc` with your username — nothing else to change.
export const NEWSLETTER = {
  provider: 'buttondown',
  action: 'https://buttondown.com/api/emails/embed-subscribe/shubinvc',
  name: "Shubin's Letter",
  pitch: "One email a week: startup teardowns, numbers and takeaways I don't post on social media.",
} as const;

// Header navigation.
export const NAV = [
  { label: 'Blog', href: '/blog' },
  { label: 'Research', href: '/research' },
  { label: 'Newsletter', href: '/newsletter' },
  { label: 'About', href: '/about' },
] as const;
