CREATE TABLE users (
  tenant_slug TEXT NOT NULL,
  username TEXT NOT NULL,
  user_handle BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_slug, username),
  UNIQUE (tenant_slug, user_handle)
);

CREATE TABLE credentials (
  tenant_slug TEXT NOT NULL,
  id TEXT NOT NULL,
  username TEXT NOT NULL,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  PRIMARY KEY (tenant_slug, id),
  FOREIGN KEY (tenant_slug, username) REFERENCES users (tenant_slug, username) ON DELETE CASCADE
);
CREATE INDEX credentials_by_user ON credentials (tenant_slug, username);

CREATE TABLE webauthn_challenges (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  challenge TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('register', 'login')),
  username TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX webauthn_challenges_by_expiry ON webauthn_challenges (expires_at);
