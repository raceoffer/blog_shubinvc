# shubin.vc — Nik Shubin's professional blog

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
- **Admin:** `/admin` — Cloudflare Pages Functions CMS with two roles (writer/admin), passkey auth, GitHub publishing, crossposting. See "Admin" below.
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

## Binary assets (photos, PDFs)

Binary files are kept base64-encoded in `assets-src/` (e.g. `nik-shubin.jpg.b64`,
large ones split as `.b64.part1`, `.part2`, …) so they survive any Git client.
`scripts/prepare-assets.mjs` reassembles and decodes them into `public/`
automatically before every `npm run dev` / `npm run build` (registered as
`predev`/`prebuild` hooks). To add a new binary:
`base64 -w 76 file.jpg > assets-src/file.jpg.b64` and commit that.

## Admin (`/admin`) — Cloudflare Pages Functions

A real CMS lives in `functions/` and runs on the same domain via Pages Functions.

**Roles**

- **writer** — creates drafts, formats the body in Markdown (with preview in the
  site's typography), uploads images, fills TL;DR/FAQ and per-network social
  texts, sends the draft to review. Cannot publish, cannot touch service fields.
- **admin** — everything a writer can, plus: publishes (single commit to the
  repo → Pages rebuild), rejects back to the author, edits service fields
  (slug, date, featured/research flags), crossposts to LinkedIn / X / Medium /
  Threads with per-network texts, manages tokens, users and passkeys.

**Auth** — email + password (PBKDF2-210k), plus passkeys (WebAuthn ES256) as a
mandatory second factor once registered. Sessions: httpOnly, SameSite=Strict,
14 days. Login is rate-limited (10 attempts / 10 min per IP).

**Data** — D1 (users, sessions, passkeys, drafts, tokens, crosspost log, audit)
and KV (draft images, WebAuthn challenges, rate limits). API tokens are stored
AES-GCM-encrypted with the `TOKEN_KEY` secret.

### Setup (one time, ~10 minutes)

```bash
npm install          # wrangler is a devDependency
npx wrangler login

# 1. Database
wrangler d1 create shubinvc-admin            # copy database_id into wrangler.toml
wrangler d1 execute shindenvc-admin --remote --file=admin/schema.sql

# 2. KV for images/challenges
wrangler kv namespace create ADMIN_KV        # copy id into wrangler.toml

# 3. Secrets
wrangler secret put GITHUB_TOKEN
#     fine-grained PAT with Contents: Read & Write on this repo
wrangler secret put TOKEN_KEY
#     64 random hex chars:  openssl rand -hex 32
```

(The project deploys via **Workers Builds**: `npm run build` compiles the
Astro site to `dist/` *and* the `functions/` admin to `.worker/`, then
`npx wrangler deploy` ships both — config in `wrangler.toml`.)

Deploy → open `https://shubin.vc/admin/setup` → create the first administrator
(the page locks itself once a user exists) → log in → Settings → register a
passkey and fill in the crossposting tokens.

### Publishing & SEO side effects

Publishing commits `src/content/blog/<slug>.md` (+ images into
`public/uploads/<slug>/`) to `main`. Cloudflare Pages rebuilds automatically,
and the rebuild regenerates **sitemap.xml, rss.xml and llms.txt** — nothing
extra to do. Google: the old sitemap ping endpoint no longer exists (retired in
2024), so the reliable channel is the fresh `<lastmod>` in the sitemap. If you
want the extra push, create a Google Cloud service account with the Indexing
API enabled, add it as an owner of the Search Console property, and set
`wrangler secret put GOOGLE_SA_JSON` — every publish will then send
`URL_UPDATED` for the post (note: the API is officially intended for
job/streaming pages, sitemap remains the primary mechanism).

### Crossposting tokens

Managed in `/admin/settings` (encrypted at rest):

| Network | What to paste |
|---|---|
| LinkedIn | OAuth2 token with `w_member_social` + your person id (from `urn:li:person:<id>`) |
| X | API key/secret + access token/secret (OAuth 1.0a app with write) |
| Medium | Integration token (existing ones work; Medium no longer issues new) |
| Threads | Long-lived token + user id from the Threads API app |

Each network can be posted to separately from the published post's page, and
each uses its own text from the "Social texts" section — never a random summary.
