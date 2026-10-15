-- Staff and resident notifications: per-item reads, push tokens, more resident
-- inbox kinds, and indexes for date-range history queries.

-- A staff member who never opened her inbox starts read at the moment this
-- runs, so the hall's past does not arrive as unread. New accounts start at
-- users.created_at (read in code), not here.
UPDATE staff
SET notifications_read_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE notifications_read_at IS NULL;

-- One row per staff member and derived event she marked read on its own.
-- notification_id is '<kind>:<record_id>'. Mark-all clears her rows.
CREATE TABLE staff_notification_reads (
  user_id TEXT NOT NULL REFERENCES users(id),
  notification_id TEXT NOT NULL CHECK (length(notification_id) BETWEEN 3 AND 80),
  read_at TEXT NOT NULL CHECK (
    length(read_at) = 20
    AND read_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  PRIMARY KEY (user_id, notification_id)
) STRICT;

-- One Expo push token per phone, held by the account signed in on it.
CREATE TABLE push_tokens (
  token TEXT PRIMARY KEY CHECK (
    length(token) <= 200
    AND (token GLOB 'ExponentPushToken[[]*]' OR token GLOB 'ExpoPushToken[[]*]')
  ),
  user_id TEXT NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  )
) STRICT;

CREATE INDEX push_tokens_user_id ON push_tokens (user_id);

-- The resident inbox grows from permission decisions to guest-stay decisions
-- and late outings. (kind, record_id) is unique, so a late row is also the
-- sent-once marker for the late push to her and to staff.
CREATE TABLE resident_notifications_next (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  resident_id TEXT NOT NULL REFERENCES residents(user_id),
  kind TEXT NOT NULL CHECK (kind IN ('permission_decided', 'guest_stay_decided', 'resident_late')),
  record_id TEXT NOT NULL,
  decision TEXT CHECK (decision IN ('approved', 'rejected')),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  read_at TEXT CHECK (
    read_at IS NULL
    OR (
      length(read_at) = 20
      AND read_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  CHECK ((kind = 'resident_late') = (decision IS NULL)),
  UNIQUE (kind, record_id)
) STRICT;

INSERT INTO resident_notifications_next (id, resident_id, kind, record_id, decision, created_at, read_at)
SELECT id, resident_id, 'permission_decided', permission_id, decision, created_at, read_at
FROM resident_notifications;

DROP TABLE resident_notifications;
ALTER TABLE resident_notifications_next RENAME TO resident_notifications;

CREATE INDEX resident_notifications_resident_created
  ON resident_notifications (resident_id, created_at);

-- Residents already out late when this runs: their late row exists, read, so
-- the deploy sends no burst of late pushes.
INSERT INTO resident_notifications (id, resident_id, kind, record_id, decision, created_at, read_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-8' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
  resident_id, 'resident_late', id, NULL, grace_ends_at,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM outings
WHERE status = 'outside'
  AND grace_ends_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

-- Date-range reads over the permanent records (staff inbox window, office
-- queues, late returns, resident history).
CREATE INDEX permissions_created_at ON permissions (created_at);
CREATE INDEX guest_stays_created_at ON guest_stays (created_at);
CREATE INDEX outings_grace_ends_at ON outings (grace_ends_at);
CREATE INDEX outings_resident_expected ON outings (resident_id, expected_return_at);
