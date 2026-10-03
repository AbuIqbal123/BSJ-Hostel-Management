-- Ordinary outings remember when the resident said she would leave.
-- Applied while user_version is 12. Leaves the version at 13.

ALTER TABLE outings ADD COLUMN starts_at TEXT
  CHECK (
    starts_at IS NULL
    OR (
      length(starts_at) = 20
      AND starts_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  );

PRAGMA user_version = 13;
