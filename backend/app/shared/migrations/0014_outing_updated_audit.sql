-- Remember when a resident changes a planned ordinary outing.
-- Adds outing.updated to the audit action check.

PRAGMA foreign_keys=OFF;

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
      'outing.updated',
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
