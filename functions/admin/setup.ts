// First-run setup: creates the initial administrator.
// Available only while the users table is empty.
import { Env } from '../lib/types';
import { hashPassword, createSession, sessionCookie, audit } from '../lib/auth';
import { page, html, flash, withMsg } from '../lib/layout';
import { randomId, redirect } from '../lib/types';

async function hasUsers(env: Env): Promise<boolean> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  return (row?.n ?? 0) > 0;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (await hasUsers(env)) return redirect('/admin/login');
  return html(page('Setup', null, `
    <div style="max-width:420px;margin:60px auto">
      <h1>Welcome to SHUBIN.vc admin</h1>
      <p class="sub">Create the first administrator account. This page locks itself afterwards.</p>
      ${flash(request)}
      <div class="card">
        <form method="post" action="/admin/setup">
          <label>Name</label><input type="text" name="name" required autocomplete="name">
          <label>Email (login)</label><input type="email" name="email" required autocomplete="username">
          <label>Password (min 12 chars)</label><input type="password" name="password" required minlength="12" autocomplete="new-password">
          <p style="margin-top:18px"><button class="btn btn-accent" type="submit">Create administrator</button></p>
        </form>
      </div>
      <p class="hint" style="margin-top:14px">After logging in, register a passkey in Settings — it will be required on every next login.</p>
    </div>`));
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (await hasUsers(env)) return redirect('/admin/login');
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!name || !email.includes('@') || password.length < 12) {
    return redirect(withMsg('/admin/setup', undefined, 'Fill all fields; password must be at least 12 characters.'));
  }
  const id = randomId();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
  ).bind(id, email, name, await hashPassword(password)).run();
  await audit(env, id, 'setup', 'initial administrator created');
  const token = await createSession(env, id, request);
  return redirect('/admin', { 'set-cookie': sessionCookie(token) });
};
