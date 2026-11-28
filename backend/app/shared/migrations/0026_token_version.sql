-- Integer bumped on password change/reset and on suspend so access tokens
-- carrying an older "ver" claim are refused immediately (same-second safe).

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
