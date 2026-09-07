-- shubin.vc admin — D1 schema
-- Apply: wrangler d1 execute shubinvc-admin --file=admin/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- pbkdf2$iterations$salt_b64$hash_b64
  role TEXT NOT NULL CHECK (role IN ('writer','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                  -- sha256 of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  ua TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,   -- base64url
  public_key TEXT NOT NULL,             -- JSON JWK (ES256)
  counter INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT 'Passkey',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);

-- Drafts / editorial workflow.
-- status: draft → review → published (admin) | rejected (back to draft)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'startups',
  tags TEXT NOT NULL DEFAULT '[]',      -- JSON array
  tldr TEXT NOT NULL DEFAULT '[]',      -- JSON array of bullets
  faq TEXT NOT NULL DEFAULT '[]',       -- JSON array of {q,a}
  body TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  research INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','rejected')),
  author_id TEXT NOT NULL REFERENCES users(id),
  pub_date TEXT,                        -- YYYY-MM-DD, set at publish
  social TEXT NOT NULL DEFAULT '{}',    -- JSON {linkedin,x,medium,threads} custom texts
  published_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_drafts_author ON drafts(author_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

-- Crossposting tokens and admin settings.
-- Secret values are stored AES-GCM-encrypted: enc:v1:<iv_b64>:<cipher_b64>
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crossposts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  network TEXT NOT NULL,
  status TEXT NOT NULL,                 -- ok | error | skipped
  url TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crossposts_draft ON crossposts(draft_id);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
