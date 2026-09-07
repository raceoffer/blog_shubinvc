// Admin settings: crossposting tokens, users, passkeys, integrations status.
import { Env, User, esc, randomId, redirect } from '../lib/types';
import { page, html, flash, withMsg } from '../lib/layout';
import { requireAdmin, hashPassword, audit } from '../lib/auth';
import { getSetting, setSetting } from '../lib/crypto';

// key → { label, secret, placeholder }
const TOKEN_FIELDS: Record<string, { label: string; secret: boolean; hint?: string }> = {
  linkedin_token: { label: 'LinkedIn access token', secret: true, hint: 'OAuth2 token with w_member_social' },
  linkedin_person_id: { label: 'LinkedIn person ID', secret: false, hint: 'the numeric id from urn:li:person:<id>' },
  x_api_key: { label: 'X API key', secret: true },
  x_api_secret: { label: 'X API secret', secret: true },
  x_access_token: { label: 'X access token', secret: true },
  x_access_secret: { label: 'X access secret', secret: true },
  medium_token: { label: 'Medium integration token', secret: true, hint: 'Medium no longer issues new ones; an existing token still works' },
  threads_token: { label: 'Threads access token', secret: true, hint: 'long-lived token from the Threads API app' },
  threads_user_id: { label: 'Threads user ID', secret: false },
  facebook_page_id: { label: 'Facebook page ID', secret: false, hint: 'numeric id of your Facebook Page' },
  facebook_page_token: { label: 'Facebook page access token', secret: true, hint: 'long-lived page token with pages_manage_posts' },
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  // ── tokens ──
  const tokenRows = await Promise.all(Object.entries(TOKEN_FIELDS).map(async ([key, f]) => {
    const val = await getSetting(env, key, f.secret);
    return `<div class="net">
      <span class="dot ${val ? 'dot-on' : 'dot-off'}"></span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:.88rem">${esc(f.label)}</div>
        ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}
      </div>
      <form method="post" action="/admin/settings" style="display:flex;gap:8px;flex:1.2">
        <input type="hidden" name="action" value="token">
        <input type="hidden" name="key" value="${key}">
        <input type="text" name="value" class="mono" placeholder="${val ? '•••••••• (saved — enter to replace)' : 'not set'}" autocomplete="off">
        <button class="btn btn-ghost btn-sm">Save</button>
        ${val ? `<button class="btn btn-danger btn-sm" name="clear" value="1" onclick="return confirm('Clear ${esc(f.label)}?')">Clear</button>` : ''}
      </form>
    </div>`;
  }));

  // ── users ──
  const users = await env.DB.prepare(
    'SELECT id, email, name, role, last_login FROM users ORDER BY created_at').all<User & { last_login: string | null }>();
  const userRows = (users.results ?? []).map((u) => `<tr>
      <td><strong>${esc(u.name)}</strong><br><span class="muted">${esc(u.email)}</span></td>
      <td><span class="badge ${u.role === 'admin' ? 'b-published' : 'b-review'}">${u.role}</span></td>
      <td class="muted">${esc(u.last_login ?? 'never')}</td>
      <td style="white-space:nowrap">
        ${u.id !== user.id ? `
        <form method="post" action="/admin/settings" style="display:inline">
          <input type="hidden" name="action" value="toggle_role"><input type="hidden" name="id" value="${u.id}">
          <button class="btn btn-ghost btn-sm">Make ${u.role === 'admin' ? 'writer' : 'admin'}</button></form>
        <form method="post" action="/admin/settings" style="display:inline" onsubmit="return confirm('Delete ${esc(u.name)}? Their drafts stay.')">
          <input type="hidden" name="action" value="delete_user"><input type="hidden" name="id" value="${u.id}">
          <button class="btn btn-danger btn-sm">Delete</button></form>` : '<span class="muted">you</span>'}
      </td></tr>`).join('');

  // ── passkeys of the current admin ──
  const keys = await env.DB.prepare('SELECT id, name, created_at FROM passkeys WHERE user_id = ?')
    .bind(user.id).all<{ id: string; name: string; created_at: string }>();
  const keyRows = (keys.results ?? []).map((k) => `<div class="net">
      <span class="dot dot-on"></span>
      <div style="flex:1"><strong>${esc(k.name)}</strong> <span class="muted">· added ${esc(k.created_at.slice(0, 10))}</span></div>
      <form method="post" action="/admin/settings" onsubmit="return confirm('Remove this passkey?')">
        <input type="hidden" name="action" value="delete_passkey"><input type="hidden" name="id" value="${k.id}">
        <button class="btn btn-danger btn-sm">Remove</button></form>
    </div>`).join('');

  const googleOn = !!env.GOOGLE_SA_JSON;

  return html(page('Settings', user, `
    <h1>Settings</h1>
    <p class="sub">Crossposting tokens are stored encrypted (AES-GCM) in the admin database.</p>
    ${flash(request)}

    <h2>Crossposting tokens</h2>
    <div class="card">${tokenRows.join('')}</div>

    <h2>Integrations</h2>
    <div class="card">
      <div class="net"><span class="dot dot-on"></span><div><strong>GitHub</strong> — <span class="mono">${esc(env.GITHUB_OWNER)}/${esc(env.GITHUB_REPO)}</span> (${esc(env.GITHUB_BRANCH)}) — publishing via Contents/Git API. Token lives in the <span class="mono">GITHUB_TOKEN</span> secret.</div></div>
      <div class="net"><span class="dot dot-on"></span><div><strong>Sitemap / RSS / llms.txt</strong> — regenerated automatically on every publish (the push triggers a Pages rebuild).</div></div>
      <div class="net"><span class="dot ${googleOn ? 'dot-on' : 'dot-off'}"></span><div><strong>Google Indexing API</strong> — ${googleOn ? 'configured: every publish sends URL_UPDATED.' : 'not configured (GOOGLE_SA_JSON secret missing). Not required: Google re-crawls the sitemap on its own; the old sitemap ping endpoint no longer exists.'}</div></div>
    </div>

    <h2>Users &amp; roles</h2>
    <div class="card">
      <table><thead><tr><th>User</th><th>Role</th><th>Last login</th><th></th></tr></thead><tbody>${userRows}</tbody></table>
      <h2 style="margin-top:22px">Add user</h2>
      <form method="post" action="/admin/settings" class="row" style="align-items:end">
        <input type="hidden" name="action" value="add_user">
        <div><label>Name</label><input type="text" name="name" required></div>
        <div><label>Email</label><input type="email" name="email" required></div>
        <div><label>Password (min 12)</label><input type="password" name="password" required minlength="12"></div>
        <div><label>Role</label><select name="role"><option value="writer">writer</option><option value="admin">admin</option></select></div>
        <div><button class="btn">Add</button></div>
      </form>
    </div>

    <h2>Your passkeys</h2>
    <div class="card">
      ${keyRows || '<p class="sub">No passkeys yet. Register one — from then on login requires it as a second factor.</p>'}
      <p style="margin-top:14px"><button class="btn" id="add-passkey">+ Register a passkey</button></p>
    </div>

    <script>
      document.getElementById('add-passkey').addEventListener('click', async () => {
        const name = prompt('Name this passkey (e.g. "MacBook Touch ID"):', 'Passkey');
        if (!name) return;
        try {
          const opts = await (await fetch('/admin/passkeys/register-options', { method: 'POST' })).json();
          const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
          const cred = await navigator.credentials.create({
            publicKey: {
              ...opts,
              challenge: Uint8Array.from(atob(opts.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
              user: { ...opts.user, id: Uint8Array.from(atob(opts.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) },
            },
          });
          const res = await fetch('/admin/passkeys/register', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name, id: cred.id,
              clientDataJSON: b64u(cred.response.clientDataJSON),
              attestationObject: b64u(cred.response.attestationObject),
            }),
          });
          const out = await res.json();
          if (out.ok) location.reload();
          else alert('Registration failed: ' + (out.error || 'unknown'));
        } catch (e) { alert('Cancelled or unsupported on this device.'); }
      });
    </script>`));
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request, data }) => {
  const user = (data as any).user as User;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const form = await request.formData();
  const action = String(form.get('action') ?? '');

  if (action === 'token') {
    const key = String(form.get('key'));
    const f = TOKEN_FIELDS[key];
    if (!f) return redirect(withMsg('/admin/settings', undefined, 'Unknown key.'));
    if (form.get('clear')) {
      await setSetting(env, key, '');
      await audit(env, user.id, 'token_clear', key);
      return redirect(withMsg('/admin/settings', `${f.label} cleared.`));
    }
    const value = String(form.get('value') ?? '').trim();
    if (!value) return redirect(withMsg('/admin/settings', undefined, 'Empty value — nothing saved.'));
    await setSetting(env, key, value, f.secret);
    await audit(env, user.id, 'token_set', key);
    return redirect(withMsg('/admin/settings', `${f.label} saved (encrypted).`));
  }

  if (action === 'add_user') {
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    const role = String(form.get('role')) === 'admin' ? 'admin' : 'writer';
    if (!name || !email.includes('@') || password.length < 12) {
      return redirect(withMsg('/admin/settings', undefined, 'Fill all fields; password min 12 chars.'));
    }
    try {
      await env.DB.prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .bind(randomId(), email, name, await hashPassword(password), role).run();
    } catch {
      return redirect(withMsg('/admin/settings', undefined, 'A user with this email already exists.'));
    }
    await audit(env, user.id, 'user_add', `${email} (${role})`);
    return redirect(withMsg('/admin/settings', `User ${name} added.`));
  }

  if (action === 'toggle_role') {
    const id = String(form.get('id'));
    if (id === user.id) return redirect(withMsg('/admin/settings', undefined, 'You cannot change your own role.'));
    await env.DB.prepare("UPDATE users SET role = CASE role WHEN 'admin' THEN 'writer' ELSE 'admin' END WHERE id = ?").bind(id).run();
    await audit(env, user.id, 'role_toggle', id);
    return redirect(withMsg('/admin/settings', 'Role updated.'));
  }

  if (action === 'delete_user') {
    const id = String(form.get('id'));
    if (id === user.id) return redirect(withMsg('/admin/settings', undefined, 'You cannot delete yourself.'));
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    await audit(env, user.id, 'user_delete', id);
    return redirect(withMsg('/admin/settings', 'User deleted.'));
  }

  if (action === 'delete_passkey') {
    await env.DB.prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?')
      .bind(String(form.get('id')), user.id).run();
    await audit(env, user.id, 'passkey_delete', '');
    return redirect(withMsg('/admin/settings', 'Passkey removed.'));
  }

  return redirect(withMsg('/admin/settings', undefined, 'Unknown action.'));
};
