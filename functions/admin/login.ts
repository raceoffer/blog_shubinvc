// Login: email + password, then a mandatory passkey ceremony if the user
// has any registered (passkey = second factor; first factor is the password).
import { Env, User, redirect } from '../lib/types';
import { verifyPassword, createSession, sessionCookie, rateLimited, audit } from '../lib/auth';
import { page, html, flash, withMsg, ARROW_SVG } from '../lib/layout';

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('uid') ?? '';
  return html(page('Log in', null, `
    <div style="max-width:400px;margin:70px auto">
      <div style="display:flex;justify-content:center;margin-bottom:22px">${ARROW_SVG.replace('width="20" height="20"', 'width="34" height="34"')}</div>
      <h1 style="text-align:center">SHUBIN.vc admin</h1>
      ${flash(request)}
      <div class="card">
        <form method="post" action="/admin/login">
          <input type="hidden" name="uid" value="${userId}">
          <label>Email</label><input type="email" name="email" required autocomplete="username">
          <label>Password</label><input type="password" name="password" required autocomplete="current-password">
          <p style="margin-top:18px"><button class="btn btn-accent" type="submit" style="width:100%;justify-content:center">Log in</button></p>
        </form>
      </div>
      <div id="pk-zone"></div>
    </div>
    <script>
      const uid = ${JSON.stringify(userId)};
      if (uid) {
        // Password accepted → run the passkey ceremony.
        (async () => {
          const zone = document.getElementById('pk-zone');
          zone.innerHTML = '<div class="card"><p class="sub">Confirm with your passkey…</p></div>';
          try {
            const opts = await (await fetch('/admin/passkeys/auth-options', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ uid }),
            })).json();
            const cred = await navigator.credentials.get({
              publicKey: {
                ...opts,
                challenge: Uint8Array.from(atob(opts.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
                allowCredentials: opts.allowCredentials.map(c => ({
                  ...c,
                  id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0)),
                })),
              },
            });
            const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
            const res = await fetch('/admin/passkeys/auth', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                uid,
                id: cred.id,
                clientDataJSON: b64u(cred.response.clientDataJSON),
                authenticatorData: b64u(cred.response.authenticatorData),
                signature: b64u(cred.response.signature),
              }),
            });
            if (res.ok) location.href = '/admin';
            else zone.innerHTML = '<div class="flash flash-err">Passkey verification failed. <a href="/admin/login">Try again</a>.</div>';
          } catch (e) {
            zone.innerHTML = '<div class="flash flash-err">Passkey cancelled or unavailable. <a href="/admin/login">Try again</a>.</div>';
          }
        })();
      }
    </script>`));
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (await rateLimited(env, request)) {
    return redirect(withMsg('/admin/login', undefined, 'Too many attempts — try again in 10 minutes.'));
  }
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await audit(env, null, 'login_failed', email);
    return redirect(withMsg('/admin/login', undefined, 'Wrong email or password.'));
  }

  // Passkeys registered → second factor. The client runs the ceremony;
  // the session is created only by /admin/passkeys/auth after verification.
  const keys = await env.DB.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?')
    .bind(user.id).first<{ n: number }>();
  if ((keys?.n ?? 0) > 0) {
    // short-lived pre-auth ticket proves the password step passed
    const ticket = crypto.randomUUID();
    await env.ADMIN_KV.put(`preauth:${ticket}`, user.id, { expirationTtl: 300 });
    return redirect(withMsg('/admin/login', 'Password accepted.') + `&uid=${encodeURIComponent(ticket)}`);
  }

  const token = await createSession(env, user.id, request);
  await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();
  await audit(env, user.id, 'login', 'password only (no passkey registered)');
  return redirect('/admin', { 'set-cookie': sessionCookie(token) });
};
