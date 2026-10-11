-- Optional guest-stay payment evidence file metadata.
-- Keeps guest_stay.edited from 0007 and adds the evidence audit actions.

PRAGMA foreign_keys=OFF;

ALTER TABLE guest_stays ADD COLUMN payment_evidence_path TEXT
  CHECK (payment_evidence_path IS NULL OR length(trim(payment_evidence_path)) > 0);

ALTER TABLE guest_stays ADD COLUMN payment_evidence_original_name TEXT
  CHECK (payment_evidence_original_name IS NULL OR length(trim(payment_evidence_original_name)) > 0);

ALTER TABLE guest_stays ADD COLUMN payment_evidence_content_type TEXT
  CHECK (
    payment_evidence_content_type IS NULL
    OR payment_evidence_content_type IN ('image/jpeg', 'image/png', 'application/pdf')
  );

ALTER TABLE guest_stays ADD COLUMN payment_evidence_uploaded_at TEXT
  CHECK (
    payment_evidence_uploaded_at IS NULL
    OR (
      length(payment_evidence_uploaded_at) = 20
      AND payment_evidence_uploaded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  );

ALTER TABLE guest_stays ADD COLUMN payment_evidence_uploaded_by TEXT REFERENCES users(id);

DROP TRIGGER IF EXISTS guest_stays_staff_insert;
DROP TRIGGER IF EXISTS guest_stays_staff_update;

CREATE TRIGGER guest_stays_staff_insert
BEFORE INSERT ON guest_stays
FOR EACH ROW
WHEN (
  NEW.decided_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.decided_by) NOT IN ('warden', 'provost')
) OR (
  NEW.payment_marked_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.payment_marked_by) NOT IN ('warden', 'provost')
) OR (
  NEW.payment_evidence_uploaded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.payment_evidence_uploaded_by) NOT IN ('warden', 'provost')
) OR (
  NEW.arrived_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.arrived_recorded_by) NOT IN ('gate', 'warden', 'provost')
) OR (
  NEW.departed_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.departed_recorded_by) NOT IN ('gate', 'warden', 'provost')
)
BEGIN
  SELECT RAISE(ABORT, 'guest decisions and payment are marked by a warden or the provost; arrival and departure are recorded by gate staff, a warden, or the provost');
END;

CREATE TRIGGER guest_stays_staff_update
BEFORE UPDATE OF decided_by, payment_marked_by, payment_evidence_uploaded_by, arrived_recorded_by, departed_recorded_by ON guest_stays
FOR EACH ROW
WHEN (
  NEW.decided_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.decided_by) NOT IN ('warden', 'provost')
) OR (
  NEW.payment_marked_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.payment_marked_by) NOT IN ('warden', 'provost')
) OR (
  NEW.payment_evidence_uploaded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.payment_evidence_uploaded_by) NOT IN ('warden', 'provost')
) OR (
  NEW.arrived_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.arrived_recorded_by) NOT IN ('gate', 'warden', 'provost')
) OR (
  NEW.departed_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.departed_recorded_by) NOT IN ('gate', 'warden', 'provost')
)
BEGIN
  SELECT RAISE(ABORT, 'guest decisions and payment are marked by a warden or the provost; arrival and departure are recorded by gate staff, a warden, or the provost');
END;

DROP TRIGGER IF EXISTS audit_log_no_update;
DROP TRIGGER IF EXISTS audit_log_no_delete;

CREATE TABLE audit_log_new (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  occurred_at TEXT NOT NULL CHECK (
    length(occurred_at) = 20
    AND occurred_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL CHECK (
    action IN (
      'auth.login',
      'auth.logout',
      'resident.created',
      'resident.updated',
      'resident.suspended',
      'resident.reinstated',
      'hall_pass.reissued',
      'staff.created',
      'staff.updated',
      'room.created',
      'room.updated',
      'block.created',
      'block.updated',
      'destination.created',
      'destination.updated',
      'settings.updated',
      'outing.planned',
      'outing.cancelled',
      'outing.exit',
      'outing.return',
      'permission.submitted',
      'permission.cancelled',
      'permission.approved',
      'permission.rejected',
      'permission.expired',
      'guest_stay.submitted',
      'guest_stay.cancelled',
      'guest_stay.edited',
      'guest_stay.approved',
      'guest_stay.rejected',
      'guest_stay.payment_marked',
      'guest_stay.payment_evidence_uploaded',
      'guest_stay.payment_evidence_cleared',
      'guest_stay.arrived',
      'guest_stay.departed',
      'sms.late_notice',
      'sms.return_notice'
    )
  ),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN (
      'person',
      'resident',
      'staff',
      'room',
      'block',
      'destination',
      'settings',
      'outing',
      'permission',
      'guest_stay',
      'guardian_message',
      'hall_pass'
    )
  ),
  entity_id TEXT NOT NULL CHECK (length(trim(entity_id)) > 0),
  summary TEXT NOT NULL CHECK (length(trim(summary)) > 0),
  detail TEXT CHECK (detail IS NULL OR length(trim(detail)) > 0)
) STRICT;

INSERT INTO audit_log_new (
  id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
)
SELECT id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
FROM audit_log;

DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;

CREATE INDEX audit_log_occurred_at ON audit_log (occurred_at);

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'an audit log entry is not edited');
END;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'an audit log entry is not deleted');
END;

PRAGMA foreign_keys=ON;
