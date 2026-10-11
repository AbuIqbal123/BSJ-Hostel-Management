-- Rename guest stay window columns for clarity on the API and in storage.

ALTER TABLE guest_stays RENAME COLUMN start_date TO guest_start_date;
ALTER TABLE guest_stays RENAME COLUMN end_date TO guest_end_date;
