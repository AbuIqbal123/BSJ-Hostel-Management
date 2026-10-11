-- Free-text payment note for off-system guest-stay payment proof.

ALTER TABLE guest_stays ADD COLUMN payment_note TEXT
  CHECK (payment_note IS NULL OR length(trim(payment_note)) > 0);
