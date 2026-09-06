import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Post content model.
// A post is a structured entity: slug, lede, topic, tags, TL;DR, FAQ, attachments.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    // Lede: used in the card, meta description and messenger previews.
    description: z.string().max(300),
    // Topic (exactly one) — a slug from the topics collection.
    topic: z.string(),
    tags: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    // Updated date — shown next to the publish date (the Damodaran practice).
    updatedDate: z.coerce.date().optional(),
    // TL;DR — 3–5 bullets at the top of the post (critical for GEO).
    tldr: z.array(z.string()).min(1).max(6).optional(),
    // FAQ block — produces FAQPage markup and direct answers for AI search.
    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .max(6)
      .optional(),
    // Post attachments: PDFs, spreadsheets, datasets (the Damodaran practice).
    attachments: z
      .array(z.object({ title: z.string(), url: z.string() }))
      .optional(),
    // Manual SEO field overrides (defaults to title/description).
    seo: z
      .object({ title: z.string().optional(), description: z.string().optional() })
      .optional(),
    // Flagship piece — appears in /research.
    research: z.boolean().default(false),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// Topics as full landing pages: unique text + post list (SEO).
const topics = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
  }),
});

export const collections = { blog, topics };
