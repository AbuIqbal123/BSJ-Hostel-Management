-- Rename guest stay window columns for clarity on the API and in storage.
-- Applied while user_version is 5. Leaves the version at 6.

ALTER TABLE guest_stays RENAME COLUMN start_date TO guest_start_date;
ALTER TABLE guest_stays RENAME COLUMN end_date TO guest_end_date;

PRAGMA user_version = 6;
