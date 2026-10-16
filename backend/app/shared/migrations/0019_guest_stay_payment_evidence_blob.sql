-- Receipt bytes live in Turso. The metadata columns on guest_stays stay.
-- Old paths pointed at files that a Render redeploy already lost, so those
-- five columns are cleared. The path column itself stays.

CREATE TABLE guest_stay_payment_evidence (
  guest_stay_id TEXT PRIMARY KEY REFERENCES guest_stays(id),
  content BLOB NOT NULL CHECK (length(content) BETWEEN 1 AND 2097152),
  size_bytes INTEGER NOT NULL CHECK (size_bytes = length(content))
) STRICT;

UPDATE guest_stays
SET
  payment_evidence_path = NULL,
  payment_evidence_original_name = NULL,
  payment_evidence_content_type = NULL,
  payment_evidence_uploaded_at = NULL,
  payment_evidence_uploaded_by = NULL
WHERE payment_evidence_uploaded_at IS NOT NULL;
