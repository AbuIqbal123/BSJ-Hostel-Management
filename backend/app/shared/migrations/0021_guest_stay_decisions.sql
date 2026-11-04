CREATE TABLE guest_stay_decisions (
  id TEXT PRIMARY KEY,
  guest_stay_id TEXT NOT NULL REFERENCES guest_stays(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('roommate', 'provost')),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note TEXT,
  decided_at TEXT NOT NULL,
  UNIQUE (guest_stay_id, actor_user_id, role)
) STRICT;

CREATE INDEX guest_stay_decisions_stay ON guest_stay_decisions (guest_stay_id, decided_at);
