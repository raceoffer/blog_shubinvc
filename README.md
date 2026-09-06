# shubin.vc — профессиональный блог Ника Шубина

Личный экспертный блог-медиа: гибрид сайта-визитки и контентного архива.
Статический сайт на **Astro + Tailwind**, хостинг — **Cloudflare Pages**.

## Быстрый старт

```bash
npm install
npm run dev      # локальная разработка на :4321
npm run build    # сборка в dist/
npm run preview  # предпросмотр сборки
```

## Деплой на Cloudflare Pages

1. Подключите репозиторий в Cloudflare Pages (Workers & Pages → Create → Pages → Connect to Git).
2. Настройки сборки:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** переменная окружения `NODE_VERSION=20`
3. Подключите домен `shubin.vc` (Custom domains → Add).

`_headers` и `_redirects` из `public/` подхватываются Pages автоматически.

## Как опубликовать пост (≤ 10 минут, без разработчика)

1. Скопируйте любой пост из `src/content/blog/` и создайте `src/content/blog/moy-novyi-post.md` (имя файла = slug, латиница).
2. Заполните frontmatter:

```yaml
---
title: "Заголовок поста"
description: "Лид на 2–3 предложения — идёт в карточку, meta description и превью."
topic: startups        # одна рубрика: startups | product | ai | venture
tags: [тег1, тег2]
pubDate: 2026-09-06
tldr:                  # 3–5 буллетов — обязательно (GEO)
  - "Первый вывод."
faq:                   # опционально — даёт разметку FAQPage
  - q: "Вопрос?"
    a: "Ответ."
attachments:           # опционально — файлы лежат в public/attachments/
  - title: "Датасет (CSV)"
    url: "/attachments/file.csv"
research: false        # true — пост попадёт в /research
featured: false        # true — флагман на главной
draft: false           # true — не попадёт в продакшен-сборку
---
```

3. Пишите текст в Markdown ниже frontmatter. Обложки и OG-картинки (1200×630)
   генерируются автоматически из заголовка и рубрики.
4. `git push` → Cloudflare Pages соберёт и задеплоит превью ветки / продакшен main.

### Чек-лист публикации (SEO/GEO)

- Title ≤ 60 симв., description ≤ 160 симв.
- Slug — латиница, короткий, без стоп-слов (имя файла = slug).
- TL;DR из 3–5 буллетов, ≥ 2 подзаголовка H2.
- ≥ 2 внутренних ссылки на старые посты + 1 на рубрику.
- При смене slug добавьте 301 в `public/_redirects`.
- При обновлении поста поднимите `updatedDate`.

## Что уже внутри

- **Страницы:** `/` (первый экран + лента), `/about`, `/blog` (архив с поиском и фильтром по рубрикам), `/blog/[slug]`, `/topics/[topic]`, `/newsletter`, `/research`, `404`.
- **SEO:** уникальные title/description, canonical, sitemap.xml, robots.txt, RSS полного текста, Open Graph + Twitter Cards с автогенерацией OG-картинок, Schema.org (`BlogPosting`, `Person`, `BreadcrumbList`, `FAQPage`, `WebSite`+`SearchAction`).
- **GEO:** `llms.txt`, семантический статический HTML, TL;DR-блоки, FAQ, разметка Person с sameAs.
- **Тёмная тема:** авто по системе + ручной переключатель.
- **Бюджет производительности:** 0 JS на страницах чтения (поиск — только в `/blog`), self-hosted шрифты с subset, инлайн критических стилей.

## Настройка под себя

| Что | Где |
|---|---|
| Имя, описание, соцсети, email | `src/consts.ts` |
| Рассылка (Buttondown action) | `src/consts.ts` → `NEWSLETTER.action` |
| Рубрики и их описания | `src/content/topics/*.md` |
| Палитра и шрифты | `src/styles/global.css`, `tailwind.config.mjs` |
| Шаблон OG-картинок | `src/pages/og/[...slug].png.ts` |
| Аналитика (Plausible/Umami) | добавить скрипт в `src/layouts/Base.astro` |

## Рассылка

Форма подписки работает через [Buttondown](https://buttondown.com): зарегистрируйтесь,
замените username в `NEWSLETTER.action`. Double opt-in, экспорт базы и RSS-to-email
дайджест настраиваются в кабинете Buttondown — код менять не нужно.
