-- A roommate's no rejects the stay and leaves decided_by empty. The provost's
-- no, and the yes that completes approval, still name that provost. SQLite
-- cannot alter a table check, so the stay table is rebuilt with the same
-- columns and the rejected line relaxed.

PRAGMA foreign_keys=OFF;

CREATE TABLE guest_stays_new (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  host_resident_id TEXT NOT NULL REFERENCES residents(user_id),
  guest_name TEXT NOT NULL CHECK (length(trim(guest_name)) > 0),
  relation TEXT NOT NULL CHECK (length(trim(relation)) > 0),
  guest_start_date TEXT NOT NULL CHECK (date(guest_start_date) = guest_start_date),
  guest_end_date TEXT NOT NULL CHECK (date(guest_end_date) = guest_end_date),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled', 'departed')
  ),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  payment_marked_by TEXT REFERENCES users(id),
  payment_marked_at TEXT CHECK (
    payment_marked_at IS NULL
    OR (
      length(payment_marked_at) = 20
      AND payment_marked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT CHECK (
    decided_at IS NULL
    OR (
      length(decided_at) = 20
      AND decided_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  decision_note TEXT CHECK (decision_note IS NULL OR length(trim(decision_note)) > 0),
  arrived_at TEXT CHECK (
    arrived_at IS NULL
    OR (
      length(arrived_at) = 20
      AND arrived_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  arrived_recorded_by TEXT REFERENCES users(id),
  departed_at TEXT CHECK (
    departed_at IS NULL
    OR (
      length(departed_at) = 20
      AND departed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  departed_recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  payment_note TEXT CHECK (payment_note IS NULL OR length(trim(payment_note)) > 0),
  payment_evidence_path TEXT CHECK (
    payment_evidence_path IS NULL OR length(trim(payment_evidence_path)) > 0
  ),
  payment_evidence_original_name TEXT CHECK (
    payment_evidence_original_name IS NULL OR length(trim(payment_evidence_original_name)) > 0
  ),
  payment_evidence_content_type TEXT CHECK (
    payment_evidence_content_type IS NULL
    OR payment_evidence_content_type IN ('image/jpeg', 'image/png', 'application/pdf')
  ),
  payment_evidence_uploaded_at TEXT CHECK (
    payment_evidence_uploaded_at IS NULL
    OR (
      length(payment_evidence_uploaded_at) = 20
      AND payment_evidence_uploaded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  payment_evidence_uploaded_by TEXT REFERENCES users(id),
  CHECK (guest_end_date >= guest_start_date),
  CHECK (
    (payment_status = 'unpaid' AND payment_marked_by IS NULL AND payment_marked_at IS NULL)
    OR (payment_status = 'paid' AND payment_marked_by IS NOT NULL AND payment_marked_at IS NOT NULL)
  ),
  CHECK ((decided_by IS NULL) = (decided_at IS NULL)),
  CHECK ((arrived_at IS NULL) = (arrived_recorded_by IS NULL)),
  CHECK ((departed_at IS NULL) = (departed_recorded_by IS NULL)),
  CHECK (departed_at IS NULL OR (arrived_at IS NOT NULL AND departed_at >= arrived_at)),
  CHECK (arrived_at IS NULL OR payment_status = 'paid'),
  CHECK (
    (status = 'pending' AND decided_by IS NULL AND departed_at IS NULL)
    OR (status = 'cancelled' AND decided_by IS NULL AND arrived_at IS NULL AND departed_at IS NULL)
    OR (status = 'rejected' AND arrived_at IS NULL AND departed_at IS NULL)
    OR (status = 'approved' AND decided_by IS NOT NULL AND departed_at IS NULL)
    OR (
      status = 'departed'
      AND arrived_at IS NOT NULL
      AND departed_at IS NOT NULL
      AND payment_status = 'paid'
    )
  )
) STRICT;

INSERT INTO guest_stays_new (
  id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
  status, payment_status, payment_marked_by, payment_marked_at,
  decided_by, decided_at, decision_note,
  arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
  created_at, updated_at,
  payment_note, payment_evidence_path, payment_evidence_original_name,
  payment_evidence_content_type, payment_evidence_uploaded_at, payment_evidence_uploaded_by
)
SELECT
  id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
  status, payment_status, payment_marked_by, payment_marked_at,
  decided_by, decided_at, decision_note,
  arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
  created_at, updated_at,
  payment_note, payment_evidence_path, payment_evidence_original_name,
  payment_evidence_content_type, payment_evidence_uploaded_at, payment_evidence_uploaded_by
FROM guest_stays;

DROP TABLE guest_stays;
ALTER TABLE guest_stays_new RENAME TO guest_stays;

CREATE INDEX guest_stays_status_arrived ON guest_stays (status, arrived_at);
CREATE INDEX guest_stays_host_created ON guest_stays (host_resident_id, created_at);
CREATE INDEX guest_stays_created_at ON guest_stays (created_at);

CREATE TRIGGER guest_stays_no_delete
BEFORE DELETE ON guest_stays
BEGIN
  SELECT RAISE(ABORT, 'a guest stay is not deleted');
END;

CREATE TRIGGER guest_stays_length_insert
BEFORE INSERT ON guest_stays
FOR EACH ROW
WHEN (
  julianday(NEW.guest_end_date) - julianday(NEW.guest_start_date) + 1
) NOT BETWEEN 1 AND (
  SELECT guest_max_inclusive_days FROM hall_settings WHERE id = 'hall'
)
BEGIN
  SELECT RAISE(ABORT, 'guest stay length counts the first and last day and stays within the hall maximum');
END;

CREATE TRIGGER guest_stays_length_update
BEFORE UPDATE OF guest_start_date, guest_end_date ON guest_stays
FOR EACH ROW
WHEN (
  julianday(NEW.guest_end_date) - julianday(NEW.guest_start_date) + 1
) NOT BETWEEN 1 AND (
  SELECT guest_max_inclusive_days FROM hall_settings WHERE id = 'hall'
)
BEGIN
  SELECT RAISE(ABORT, 'guest stay length counts the first and last day and stays within the hall maximum');
END;

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

PRAGMA foreign_keys=ON;
