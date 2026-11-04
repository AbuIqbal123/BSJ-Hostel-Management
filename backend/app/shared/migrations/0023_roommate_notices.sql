-- One inbox row per resident. A host can also hear from each roommate, so
-- the unique key names that roommate when the notice is hers.

PRAGMA foreign_keys=OFF;

CREATE TABLE resident_notifications_next (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  resident_id TEXT NOT NULL REFERENCES residents(user_id),
  kind TEXT NOT NULL CHECK (
    kind IN (
      'permission_decided',
      'guest_stay_decided',
      'resident_late',
      'guest_stay_roommate_requested',
      'guest_stay_roommate_decided',
      'guest_stay_roommate_recorded'
    )
  ),
  record_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL DEFAULT '' CHECK (
    actor_user_id = ''
    OR (
      length(actor_user_id) = 36
      AND actor_user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
    )
  ),
  decision TEXT CHECK (decision IS NULL OR decision IN ('approved', 'rejected')),
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
  CHECK (
    (kind IN ('resident_late', 'guest_stay_roommate_requested')) = (decision IS NULL)
  ),
  CHECK ((kind = 'guest_stay_roommate_decided') = (actor_user_id <> '')),
  UNIQUE (kind, record_id, resident_id, actor_user_id)
) STRICT;

INSERT INTO resident_notifications_next (
  id, resident_id, kind, record_id, actor_user_id, decision, created_at, read_at
)
SELECT id, resident_id, kind, record_id, '', decision, created_at, read_at
FROM resident_notifications;

DROP TABLE resident_notifications;
ALTER TABLE resident_notifications_next RENAME TO resident_notifications;

CREATE INDEX resident_notifications_resident_created
  ON resident_notifications (resident_id, created_at);

PRAGMA foreign_keys=ON;
