-- Instant after which an access token must have been issued. Set when the
-- password changes or the account is suspended so old access tokens stop
-- working immediately (refresh sessions are revoked separately).

ALTER TABLE users ADD COLUMN password_changed_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z'
CHECK (
  length(password_changed_at) = 20
  AND password_changed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
);

UPDATE users SET password_changed_at = created_at;
