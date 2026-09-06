# shubin.vc — Nick Shubin's professional blog

A personal expert blog-media: a hybrid of a personal site and a content archive.
Static site built with **Astro + Tailwind**, hosted on **Cloudflare Pages**.

## Quick start

```bash
npm install
npm run dev      # local dev server on :4321
npm run build    # build to dist/
npm run preview  # preview the build
```

## Deploy to Cloudflare Pages

1. Connect the repository in Cloudflare Pages (Workers & Pages → Create → Pages → Connect to Git).
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** set the env var `NODE_VERSION=20`
3. Attach the `shubin.vc` domain (Custom domains → Add).

`_headers` and `_redirects` from `public/` are picked up by Pages automatically.

## How to publish a post (≤ 10 minutes, no developer needed)

1. Copy any post in `src/content/blog/` to `src/content/blog/my-new-post.md` (file name = slug, lowercase Latin).
2. Fill in the frontmatter:

```yaml
---
title: "Post title"
description: "A 2–3 sentence lede — used in the card, meta description and link previews."
topic: startups        # one topic: startups | product | ai | venture
tags: [tag1, tag2]
pubDate: 2026-09-06
tldr:                  # 3–5 bullets — required (GEO)
  - "First takeaway."
faq:                   # optional — produces FAQPage markup
  - q: "Question?"
    a: "Answer."
attachments:           # optional — files live in public/attachments/
  - title: "Dataset (CSV)"
    url: "/attachments/file.csv"
research: false        # true — the post appears in /research
featured: false        # true — featured on the homepage
draft: false           # true — excluded from the production build
---
```

3. Write the body in Markdown below the frontmatter. Covers and OG images (1200×630)
   are generated automatically from the title and topic.
4. `git push` → Cloudflare Pages builds and deploys a branch preview / production from main.

### Publishing checklist (SEO/GEO)

- Title ≤ 60 chars, description ≤ 160 chars.
- Slug — lowercase Latin, short, no stop words (file name = slug).
- TL;DR with 3–5 bullets, ≥ 2 meaningful H2 subheadings.
- ≥ 2 internal links to older posts + 1 to the topic page.
- When changing a slug, add a 301 to `public/_redirects`.
- When updating a post, bump `updatedDate`.

## What's inside

- **Pages:** `/` (hero + feed), `/about`, `/blog` (archive with search and topic filters), `/blog/[slug]`, `/topics/[topic]`, `/newsletter`, `/research`, `404`.
- **SEO:** unique title/description, canonical, sitemap.xml, robots.txt, full-text RSS, Open Graph + Twitter Cards with auto-generated OG images, Schema.org (`BlogPosting`, `Person`, `BreadcrumbList`, `FAQPage`, `WebSite`+`SearchAction`).
- **GEO:** `llms.txt`, semantic static HTML, TL;DR blocks, FAQ, Person markup with sameAs.
- **Dark theme:** system-driven + manual toggle.
- **Performance budget:** 0 JS on reading pages (search lives only in `/blog`), self-hosted subsetted fonts, inlined critical CSS.

## Customizing

| What | Where |
|---|---|
| Name, description, socials, email | `src/consts.ts` |
| Newsletter (Buttondown action) | `src/consts.ts` → `NEWSLETTER.action` |
| Topics and their descriptions | `src/content/topics/*.md` |
| Palette and fonts | `src/styles/global.css`, `tailwind.config.mjs` |
| OG image template | `src/pages/og/[...slug].png.ts` |
| Analytics (Plausible/Umami) | add the script in `src/layouts/Base.astro` |

## Newsletter

The subscribe form works via [Buttondown](https://buttondown.com): sign up and
replace the username in `NEWSLETTER.action`. Double opt-in, list export and the
RSS-to-email digest are configured in the Buttondown dashboard — no code changes needed.
