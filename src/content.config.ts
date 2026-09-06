import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Контент-модель поста — см. ТЗ п. 2.3.
// Пост = структурированная сущность: slug, лид, рубрика, теги, TL;DR, FAQ, приложения.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    // Лид: идёт в карточку, meta description и превью в мессенджерах.
    description: z.string().max(300),
    // Рубрика (одна) — slug из коллекции topics.
    topic: z.string(),
    tags: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    // Дата обновления — выводится рядом с датой публикации (практика Damodaran).
    updatedDate: z.coerce.date().optional(),
    // TL;DR — 3–5 буллетов в начале поста (критично для GEO).
    tldr: z.array(z.string()).min(1).max(6).optional(),
    // FAQ-блок — даёт разметку FAQPage и прямые ответы для AI-поисковиков.
    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .max(6)
      .optional(),
    // Приложения к посту: PDF, XLSX, датасеты (практика Damodaran).
    attachments: z
      .array(z.object({ title: z.string(), url: z.string() }))
      .optional(),
    // Ручное переопределение SEO-полей (по умолчанию берутся title/description).
    seo: z
      .object({ title: z.string().optional(), description: z.string().optional() })
      .optional(),
    // Флагманский материал — попадает в раздел /research.
    research: z.boolean().default(false),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// Рубрики как полноценные лендинги: уникальный текст + список постов (SEO).
const topics = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
  }),
});

export const collections = { blog, topics };
