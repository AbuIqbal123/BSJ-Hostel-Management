-- Non-unique indexes for common list and lookup filters.
-- Permissions queue: status + created_at (and resident own list).
-- Guest stays: status / host filters.
-- Audit log: newest-first by occurred_at.
-- Sessions: revoke all live rows for a user on logout / password change.
-- Guardian messages: lookup by outing when the register shows notice state.

CREATE INDEX permissions_status_created
  ON permissions (status, created_at);

CREATE INDEX permissions_resident_created
  ON permissions (resident_id, created_at);

CREATE INDEX guest_stays_status_arrived
  ON guest_stays (status, arrived_at);

CREATE INDEX guest_stays_host_created
  ON guest_stays (host_resident_id, created_at);

CREATE INDEX audit_log_occurred_at
  ON audit_log (occurred_at);

CREATE INDEX sessions_user_id
  ON sessions (user_id);

CREATE INDEX guardian_messages_outing_id
  ON guardian_messages (outing_id);
