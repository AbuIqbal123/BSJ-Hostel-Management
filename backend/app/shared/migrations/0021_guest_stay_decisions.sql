CREATE TABLE guest_stay_decisions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  guest_stay_id TEXT NOT NULL REFERENCES guest_stays(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('roommate', 'provost')),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note TEXT CHECK (note IS NULL OR length(trim(note)) > 0),
  decided_at TEXT NOT NULL CHECK (
    length(decided_at) = 20
    AND decided_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  UNIQUE (guest_stay_id, actor_user_id, role)
) STRICT;

CREATE INDEX guest_stay_decisions_stay ON guest_stay_decisions (guest_stay_id, decided_at);

CREATE TRIGGER guest_stay_decisions_no_update
BEFORE UPDATE ON guest_stay_decisions
BEGIN
  SELECT RAISE(ABORT, 'a guest stay decision is not edited');
END;

CREATE TRIGGER guest_stay_decisions_no_delete
BEFORE DELETE ON guest_stay_decisions
BEGIN
  SELECT RAISE(ABORT, 'a guest stay decision is not deleted');
END;
