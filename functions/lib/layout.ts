// Admin HTML shell — standalone styling echoing the site's design language
// (Inter, warm paper background, thin rules, brand arrow).
import { esc, User } from './types';

export const ARROW_SVG = `<svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true"><polygon points="0,22 60,22 100,50 24,50" fill="#1a1a1a"/><polygon points="24,50 100,50 60,78 0,78" fill="#2f5d3a"/></svg>`;

export function page(title: string, user: User | null, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · SHUBIN.vc admin</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root {
    --paper:#faf9f6; --surface:#fff; --ink:#1a1a1a; --muted:#6b6b66; --line:#e4e2dc;
    --accent:#c9efa2; --accent-ink:#2c4a12;
    --danger:#b3382c; --ok:#2e7d32;
  }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--paper); color:var(--ink); font:15px/1.55 -apple-system,"Inter",Segoe UI,Roboto,sans-serif; }
  a { color:inherit; }
  .top { position:sticky; top:0; z-index:5; background:rgba(250,249,246,.92); backdrop-filter:blur(6px); border-bottom:1px solid var(--line); }
  .top-in { max-width:960px; margin:0 auto; padding:0 20px; height:56px; display:flex; align-items:center; justify-content:space-between; }
  .brand { display:flex; align-items:center; gap:9px; text-decoration:none; font-weight:800; letter-spacing:-.01em; }
  .brand small { color:var(--muted); font-size:.6rem; font-weight:700; align-self:flex-end; padding-bottom:2px; }
  .top nav { display:flex; gap:18px; font-size:.85rem; }
  .top nav a { color:var(--muted); text-decoration:none; }
  .top nav a:hover, .top nav a.on { color:var(--ink); }
  .wrap { max-width:960px; margin:0 auto; padding:32px 20px 80px; }
  h1 { font-size:1.5rem; font-weight:800; letter-spacing:-.02em; margin-bottom:6px; }
  h2 { font-size:1.05rem; font-weight:700; margin:34px 0 12px; display:flex; align-items:center; gap:8px; }
  .sub { color:var(--muted); font-size:.9rem; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:20px; margin-top:14px; }
  table { width:100%; border-collapse:collapse; font-size:.9rem; }
  th { text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-weight:600; padding:8px 10px; border-bottom:1px solid var(--line); }
  td { padding:10px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  label { display:block; font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); font-weight:600; margin:14px 0 5px; }
  input[type=text],input[type=email],input[type=password],input[type=date],input[type=url],select,textarea {
    width:100%; padding:9px 11px; border:1px solid var(--line); border-radius:7px; background:var(--surface);
    font:inherit; color:inherit;
  }
  textarea { font-family:ui-monospace,"JetBrains Mono",monospace; font-size:.86rem; line-height:1.5; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:var(--accent-ink); box-shadow:0 0 0 3px rgba(201,239,162,.45); }
  .btn { display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:999px; border:1px solid var(--ink);
    background:var(--ink); color:var(--paper); font:inherit; font-size:.82rem; font-weight:600; cursor:pointer; text-decoration:none; }
  .btn:hover { opacity:.85; }
  .btn-accent { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }
  .btn-ghost { background:transparent; color:var(--ink); }
  .btn-danger { background:transparent; border-color:var(--danger); color:var(--danger); }
  .btn-sm { padding:5px 12px; font-size:.76rem; }
  .row { display:flex; gap:14px; flex-wrap:wrap; }
  .row > * { flex:1; min-width:180px; }
  .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
  .b-draft { background:#eeece6; color:var(--muted); }
  .b-review { background:var(--surface); color:var(--accent-ink); box-shadow:inset 0 0 0 1.5px var(--accent-ink); }
  .b-published { background:var(--accent); color:var(--accent-ink); }
  .b-rejected { background:#f6d5d1; color:var(--danger); }
  .flash { padding:12px 16px; border-radius:8px; margin-bottom:18px; font-size:.9rem; }
  .flash-ok { background:var(--accent); color:var(--accent-ink); }
  .flash-err { background:#f6d5d1; color:var(--danger); }
  .muted { color:var(--muted); }
  .mono { font-family:ui-monospace,monospace; font-size:.8rem; }
  .toolbar { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:6px; }
  .toolbar button { border:1px solid var(--line); background:var(--surface); border-radius:6px; padding:4px 10px; font-size:.78rem; cursor:pointer; }
  .toolbar button:hover { background:var(--paper); }
  .hint { font-size:.78rem; color:var(--muted); margin-top:4px; }
  .net { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); }
  .net:last-child { border-bottom:0; }
  .dot { width:9px; height:9px; border-radius:50%; }
  .dot-on { background:var(--ok); } .dot-off { background:#cfcdc5; }
</style>
</head>
<body>
${user ? `
<header class="top"><div class="top-in">
  <a class="brand" href="/admin">${ARROW_SVG} SHUBIN<small>vc · admin</small></a>
  <nav>
    <a href="/admin">Posts</a>
    ${user.role === 'admin' ? '<a href="/admin/topics">Topics</a><a href="/admin/settings">Settings</a>' : ''}
    <a href="/" target="_blank">View site ↗</a>
    <a href="/admin/logout">Log out (${esc(user.name)})</a>
  </nav>
</div></header>` : ''}
<main class="wrap">${body}</main>
</body>
</html>`;
}

export function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export function flash(req: Request): string {
  const url = new URL(req.url);
  const ok = url.searchParams.get('ok');
  const err = url.searchParams.get('err');
  let out = '';
  if (ok) out += `<div class="flash flash-ok">${esc(ok)}</div>`;
  if (err) out += `<div class="flash flash-err">${esc(err)}</div>`;
  return out;
}

export function withMsg(to: string, ok?: string, err?: string): string {
  const u = new URL(to, 'https://x');
  if (ok) u.searchParams.set('ok', ok);
  if (err) u.searchParams.set('err', err);
  return u.pathname + u.search;
}
