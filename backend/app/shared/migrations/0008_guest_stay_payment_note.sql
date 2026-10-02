-- Free-text payment note for off-system guest-stay payment proof.
-- Applied while user_version is 7. Leaves the version at 8.

ALTER TABLE guest_stays ADD COLUMN payment_note TEXT
  CHECK (payment_note IS NULL OR length(trim(payment_note)) > 0);

PRAGMA user_version = 8;
