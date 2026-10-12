-- When a warden or provost last opened her notifications. Staff notifications
-- are derived from requests and late outings; this one instant is the only
-- thing stored for them.

ALTER TABLE staff ADD COLUMN notifications_read_at TEXT CHECK (
  notifications_read_at IS NULL
  OR (
    length(notifications_read_at) = 20
    AND notifications_read_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  )
);
