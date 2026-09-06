import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { AUTHOR, SITE } from '../../consts';
import { getPosts, getTopics } from '../../utils/posts';

// Auto-generated OG images 1200×630 from post title and topic.
// Generated at build time — at runtime these are static PNGs on the CDN.

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

/** Rough word wrap: DejaVu Serif bold is wide — budget ~0.62em per char. */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function ogSvg(title: string, label: string): string {
  const lines = wrap(title, 26);
  const fontSize = lines.length >= 4 ? 50 : 56;
  const lineHeight = fontSize + 16;
  // First baseline: below the topic chip, title block centered in the 240–500 zone.
  let startY = 355 - ((lines.length - 1) * lineHeight) / 2;
  startY = Math.max(startY, 262);
  const tspans = lines
    .map((l, i) => `<text x="90" y="${startY + i * lineHeight}" class="title">${escapeXml(l)}</text>`)
    .join('\n');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <style>
    .label { font: 500 24px 'DejaVu Sans', sans-serif; letter-spacing: 4px; fill: #2f5d3a; text-transform: uppercase; }
    .title { font: 600 ${fontSize}px 'DejaVu Serif', Georgia, serif; fill: #1a1a1a; }
    .author { font: 500 30px 'DejaVu Sans', sans-serif; fill: #1a1a1a; }
    .domain { font: 500 26px 'DejaVu Sans', sans-serif; fill: #807d7a; }
  </style>
  <rect width="1200" height="630" fill="#f5f2ef"/>
  <rect x="90" y="150" width="${Math.min(48 + label.length * 19, 1020)}" height="44" fill="#c9efa2"/>
  <text x="104" y="181" class="label">${escapeXml(label.toUpperCase())}</text>
  ${tspans}
  <text x="90" y="560" class="author">${escapeXml(AUTHOR.name)}</text>
  <text x="1110" y="560" text-anchor="end" class="domain">shubin.vc</text>
</svg>`;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPosts();
  return [
    { params: { slug: 'default' }, props: { title: SITE.title, label: 'Blog' } },
    ...posts.map((post) => ({
      params: { slug: post.id },
      props: { title: post.data.title, label: '' },
    })),
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const { title, label } = props as { title: string; label: string };
  let resolvedLabel = label;
  if (!resolvedLabel) {
    const posts = await getPosts();
    const topics = await getTopics();
    const post = posts.find((p) => p.data.title === title);
    resolvedLabel = post
      ? (topics.find((t) => t.id === post.data.topic)?.data.title ?? 'Post')
      : 'Blog';
  }

  const png = await sharp(Buffer.from(ogSvg(title, resolvedLabel))).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
