-- Hall records for docs/database.md. Applied once, while user_version is 0.

CREATE TABLE hall_settings (
  id TEXT PRIMARY KEY CHECK (id = 'hall'),
  hall_name TEXT NOT NULL CHECK (length(trim(hall_name)) > 0),
  university_name TEXT NOT NULL CHECK (length(trim(university_name)) > 0),
  timezone TEXT NOT NULL CHECK (timezone = 'Asia/Kolkata'),
  grace_minutes INTEGER NOT NULL CHECK (grace_minutes BETWEEN 0 AND 180),
  summer_hours_start TEXT NOT NULL CHECK (
    length(summer_hours_start) = 5
    AND substr(summer_hours_start, 3, 1) = ':'
    AND substr(summer_hours_start, 1, 2) GLOB '[0-9][0-9]'
    AND substr(summer_hours_start, 4, 2) GLOB '[0-9][0-9]'
    AND CAST(substr(summer_hours_start, 1, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(summer_hours_start, 4, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  summer_hours_end TEXT NOT NULL CHECK (
    length(summer_hours_end) = 5
    AND substr(summer_hours_end, 3, 1) = ':'
    AND substr(summer_hours_end, 1, 2) GLOB '[0-9][0-9]'
    AND substr(summer_hours_end, 4, 2) GLOB '[0-9][0-9]'
    AND CAST(substr(summer_hours_end, 1, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(summer_hours_end, 4, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  winter_hours_start TEXT NOT NULL CHECK (
    length(winter_hours_start) = 5
    AND substr(winter_hours_start, 3, 1) = ':'
    AND substr(winter_hours_start, 1, 2) GLOB '[0-9][0-9]'
    AND substr(winter_hours_start, 4, 2) GLOB '[0-9][0-9]'
    AND CAST(substr(winter_hours_start, 1, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(winter_hours_start, 4, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  winter_hours_end TEXT NOT NULL CHECK (
    length(winter_hours_end) = 5
    AND substr(winter_hours_end, 3, 1) = ':'
    AND substr(winter_hours_end, 1, 2) GLOB '[0-9][0-9]'
    AND substr(winter_hours_end, 4, 2) GLOB '[0-9][0-9]'
    AND CAST(substr(winter_hours_end, 1, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(winter_hours_end, 4, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  summer_season_start TEXT NOT NULL CHECK (
    length(summer_season_start) = 5
    AND substr(summer_season_start, 3, 1) = '-'
    AND substr(summer_season_start, 1, 2) GLOB '[0-9][0-9]'
    AND substr(summer_season_start, 4, 2) GLOB '[0-9][0-9]'
    AND CAST(substr(summer_season_start, 1, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(summer_season_start, 4, 2) AS INTEGER) BETWEEN 1 AND 31
  ),
  winter_season_start TEXT NOT NULL CHECK (
    length(winter_season_start) = 5
    AND substr(winter_season_start, 3, 1) = '-'
    AND substr(winter_season_start, 1, 2) GLOB '[0-9][0-9]'
    AND substr(winter_season_start, 4, 2) GLOB '[0-9][0-9]'
    AND CAST(substr(winter_season_start, 1, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(winter_season_start, 4, 2) AS INTEGER) BETWEEN 1 AND 31
  ),
  permission_early_minutes INTEGER NOT NULL CHECK (permission_early_minutes BETWEEN 0 AND 180),
  guest_max_inclusive_days INTEGER NOT NULL CHECK (guest_max_inclusive_days BETWEEN 1 AND 30),
  guest_min_lead_days INTEGER NOT NULL CHECK (guest_min_lead_days BETWEEN 0 AND 14),
  scan_duplicate_window_seconds INTEGER NOT NULL CHECK (scan_duplicate_window_seconds BETWEEN 0 AND 600),
  late_sms_template TEXT NOT NULL CHECK (length(trim(late_sms_template)) > 0),
  return_sms_template TEXT NOT NULL CHECK (length(trim(return_sms_template)) > 0),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    AND CAST(substr(updated_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(updated_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
    AND CAST(substr(updated_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(updated_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
    AND CAST(substr(updated_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  CHECK (summer_hours_end > summer_hours_start),
  CHECK (winter_hours_end > winter_hours_start),
  CHECK (summer_season_start <> winter_season_start)
) STRICT;

CREATE TABLE blocks (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  code TEXT NOT NULL CHECK (length(trim(code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  floors INTEGER CHECK (floors IS NULL OR floors >= 1),
  room_count INTEGER NOT NULL CHECK (room_count >= 1),
  beds_per_room INTEGER NOT NULL CHECK (beds_per_room >= 1),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE rooms (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  block_id TEXT NOT NULL REFERENCES blocks(id),
  number TEXT NOT NULL CHECK (length(trim(number)) > 0),
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  bed_count INTEGER NOT NULL CHECK (bed_count >= 1),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE destinations (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_other INTEGER NOT NULL CHECK (is_other IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE users (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  role TEXT NOT NULL CHECK (role IN ('resident', 'gate', 'warden', 'provost')),
  username TEXT NOT NULL CHECK (length(trim(username)) > 0),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  password_hash TEXT NOT NULL CHECK (password_hash GLOB '$argon2id$*'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  last_login_at TEXT CHECK (
    last_login_at IS NULL
    OR (
      length(last_login_at) = 20
      AND last_login_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  )
) STRICT;

CREATE TABLE residents (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  enrolment_number TEXT NOT NULL CHECK (length(trim(enrolment_number)) > 0),
  course TEXT CHECK (course IS NULL OR length(trim(course)) > 0),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  guardian_name TEXT NOT NULL CHECK (length(trim(guardian_name)) > 0),
  guardian_phone TEXT NOT NULL CHECK (
    length(guardian_phone) BETWEEN 9 AND 16
    AND substr(guardian_phone, 1, 2) GLOB '+[1-9]'
    AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      substr(guardian_phone, 2),
      '0', ''), '1', ''), '2', ''), '3', ''), '4', ''), '5', ''), '6', ''), '7', ''), '8', ''), '9', '') = ''
  ),
  qr_token TEXT NOT NULL CHECK (qr_token GLOB 'bsj:v1:*' AND length(qr_token) > 7),
  presence TEXT NOT NULL DEFAULT 'inside' CHECK (presence IN ('inside', 'outside')),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  )
) STRICT;

CREATE TABLE staff (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  job_title TEXT NOT NULL CHECK (length(trim(job_title)) > 0)
) STRICT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL CHECK (length(token_hash) > 0),
  expires_at TEXT NOT NULL CHECK (
    length(expires_at) = 20
    AND expires_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  revoked_at TEXT CHECK (
    revoked_at IS NULL
    OR (
      length(revoked_at) = 20
      AND revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  )
) STRICT;

CREATE TABLE permissions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  resident_id TEXT NOT NULL REFERENCES residents(user_id),
  type TEXT NOT NULL CHECK (type IN ('late_night', 'home_going')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled', 'in_use', 'completed', 'expired')
  ),
  short_place TEXT NOT NULL CHECK (length(trim(short_place)) > 0),
  destination_detail TEXT CHECK (destination_detail IS NULL OR length(trim(destination_detail)) > 0),
  address TEXT CHECK (address IS NULL OR length(trim(address)) > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  departure_at TEXT NOT NULL CHECK (
    length(departure_at) = 20
    AND departure_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  expected_return_at TEXT NOT NULL CHECK (
    length(expected_return_at) = 20
    AND expected_return_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
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
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  CHECK (expected_return_at > departure_at),
  CHECK (
    (type = 'home_going' AND address IS NOT NULL AND destination_detail IS NULL)
    OR (type = 'late_night' AND address IS NULL)
  ),
  CHECK ((decided_by IS NULL) = (decided_at IS NULL)),
  CHECK (
    (status = 'pending' AND decided_by IS NULL)
    OR status = 'cancelled'
    OR (
      status IN ('approved', 'rejected', 'in_use', 'completed', 'expired')
      AND decided_by IS NOT NULL
    )
  )
) STRICT;

CREATE TABLE outings (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  resident_id TEXT NOT NULL REFERENCES residents(user_id),
  permission_id TEXT REFERENCES permissions(id),
  type TEXT NOT NULL CHECK (type IN ('ordinary', 'late_night', 'home_going')),
  status TEXT NOT NULL CHECK (status IN ('planned', 'outside', 'returned', 'cancelled')),
  destination_id TEXT REFERENCES destinations(id),
  place TEXT NOT NULL CHECK (length(trim(place)) > 0),
  expected_return_at TEXT NOT NULL CHECK (
    length(expected_return_at) = 20
    AND expected_return_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  grace_ends_at TEXT NOT NULL CHECK (
    length(grace_ends_at) = 20
    AND grace_ends_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  exited_at TEXT CHECK (
    exited_at IS NULL
    OR (
      length(exited_at) = 20
      AND exited_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  exit_recorded_by TEXT REFERENCES users(id),
  returned_at TEXT CHECK (
    returned_at IS NULL
    OR (
      length(returned_at) = 20
      AND returned_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  return_recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    length(updated_at) = 20
    AND updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  cancelled_at TEXT CHECK (
    cancelled_at IS NULL
    OR (
      length(cancelled_at) = 20
      AND cancelled_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
    )
  ),
  CHECK (grace_ends_at >= expected_return_at),
  CHECK (
    (type = 'ordinary' AND permission_id IS NULL)
    OR (type IN ('late_night', 'home_going') AND permission_id IS NOT NULL)
  ),
  CHECK (type = 'ordinary' OR destination_id IS NULL),
  CHECK ((exited_at IS NULL) = (exit_recorded_by IS NULL)),
  CHECK ((returned_at IS NULL) = (return_recorded_by IS NULL)),
  CHECK (
    (
      status = 'planned'
      AND type = 'ordinary'
      AND exited_at IS NULL
      AND returned_at IS NULL
      AND cancelled_at IS NULL
    )
    OR (
      status = 'outside'
      AND exited_at IS NOT NULL
      AND returned_at IS NULL
      AND cancelled_at IS NULL
    )
    OR (
      status = 'returned'
      AND exited_at IS NOT NULL
      AND returned_at IS NOT NULL
      AND returned_at >= exited_at
      AND cancelled_at IS NULL
    )
    OR (
      status = 'cancelled'
      AND cancelled_at IS NOT NULL
      AND exited_at IS NULL
      AND returned_at IS NULL
    )
  )
) STRICT;

CREATE TABLE guest_stays (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  host_resident_id TEXT NOT NULL REFERENCES residents(user_id),
  guest_name TEXT NOT NULL CHECK (length(trim(guest_name)) > 0),
  relation TEXT NOT NULL CHECK (length(trim(relation)) > 0),
  start_date TEXT NOT NULL CHECK (date(start_date) = start_date),
  end_date TEXT NOT NULL CHECK (date(end_date) = end_date),
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
  CHECK (end_date >= start_date),
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
    (status = 'pending' AND decided_by IS NULL AND arrived_at IS NULL AND departed_at IS NULL)
    OR (status = 'cancelled' AND decided_by IS NULL AND arrived_at IS NULL AND departed_at IS NULL)
    OR (status = 'rejected' AND decided_by IS NOT NULL AND arrived_at IS NULL AND departed_at IS NULL)
    OR (status = 'approved' AND decided_by IS NOT NULL AND departed_at IS NULL)
    OR (
      status = 'departed'
      AND decided_by IS NOT NULL
      AND arrived_at IS NOT NULL
      AND departed_at IS NOT NULL
      AND payment_status = 'paid'
    )
  )
) STRICT;

CREATE TABLE guardian_messages (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  outing_id TEXT NOT NULL REFERENCES outings(id),
  resident_id TEXT NOT NULL REFERENCES residents(user_id),
  notice_type TEXT NOT NULL CHECK (notice_type IN ('late_notice', 'return_notice')),
  recipient_phone TEXT NOT NULL CHECK (
    length(recipient_phone) BETWEEN 9 AND 16
    AND substr(recipient_phone, 1, 2) GLOB '+[1-9]'
    AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      substr(recipient_phone, 2),
      '0', ''), '1', ''), '2', ''), '3', ''), '4', ''), '5', ''), '6', ''), '7', ''), '8', ''), '9', '') = ''
  ),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  driver TEXT NOT NULL CHECK (driver IN ('mock', 'dlt')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_reference TEXT CHECK (
    provider_reference IS NULL OR length(trim(provider_reference)) > 0
  ),
  error TEXT CHECK (error IS NULL OR length(trim(error)) > 0),
  created_at TEXT NOT NULL CHECK (
    length(created_at) = 20
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  CHECK (
    (status = 'sent' AND error IS NULL)
    OR (status = 'failed' AND error IS NOT NULL)
  )
) STRICT;

CREATE TABLE audit_log (
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
      'guest_stay.approved',
      'guest_stay.rejected',
      'guest_stay.payment_marked',
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

CREATE UNIQUE INDEX users_username ON users (username COLLATE NOCASE);
CREATE UNIQUE INDEX residents_enrolment_number ON residents (enrolment_number COLLATE NOCASE);
CREATE UNIQUE INDEX residents_qr_token ON residents (qr_token);
CREATE UNIQUE INDEX blocks_code ON blocks (code COLLATE NOCASE);
CREATE UNIQUE INDEX rooms_label ON rooms (label);
CREATE UNIQUE INDEX rooms_block_number ON rooms (block_id, number);
CREATE UNIQUE INDEX destinations_name ON destinations (name COLLATE NOCASE);
CREATE UNIQUE INDEX destinations_one_active_other
  ON destinations (is_other)
  WHERE is_other = 1 AND is_active = 1;
CREATE UNIQUE INDEX outings_one_open
  ON outings (resident_id)
  WHERE status IN ('planned', 'outside');
CREATE UNIQUE INDEX sessions_token_hash ON sessions (token_hash);
CREATE UNIQUE INDEX guardian_messages_one_per_type
  ON guardian_messages (outing_id, notice_type);

CREATE TRIGGER hall_settings_no_delete
BEFORE DELETE ON hall_settings
BEGIN
  SELECT RAISE(ABORT, 'the hall settings record stays');
END;

CREATE TRIGGER blocks_no_delete
BEFORE DELETE ON blocks
BEGIN
  SELECT RAISE(ABORT, 'a block is retired by marking it inactive');
END;

CREATE TRIGGER rooms_no_delete
BEFORE DELETE ON rooms
BEGIN
  SELECT RAISE(ABORT, 'a room is retired by marking it inactive');
END;

CREATE TRIGGER destinations_no_delete
BEFORE DELETE ON destinations
BEGIN
  SELECT RAISE(ABORT, 'a destination is retired by marking it inactive');
END;

CREATE TRIGGER outings_no_delete
BEFORE DELETE ON outings
BEGIN
  SELECT RAISE(ABORT, 'an outing is not deleted');
END;

CREATE TRIGGER permissions_no_delete
BEFORE DELETE ON permissions
BEGIN
  SELECT RAISE(ABORT, 'a permission is not deleted');
END;

CREATE TRIGGER guest_stays_no_delete
BEFORE DELETE ON guest_stays
BEGIN
  SELECT RAISE(ABORT, 'a guest stay is not deleted');
END;

CREATE TRIGGER guardian_messages_no_delete
BEFORE DELETE ON guardian_messages
BEGIN
  SELECT RAISE(ABORT, 'a guardian message is not deleted');
END;

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

CREATE TRIGGER rooms_label_insert
BEFORE INSERT ON rooms
FOR EACH ROW
WHEN NEW.label IS NOT (
  SELECT code || '-' || NEW.number FROM blocks WHERE id = NEW.block_id
)
BEGIN
  SELECT RAISE(ABORT, 'room label is the block code, a hyphen, and the door number');
END;

CREATE TRIGGER rooms_label_update
BEFORE UPDATE OF number, label, block_id ON rooms
FOR EACH ROW
WHEN NEW.label IS NOT (
  SELECT code || '-' || NEW.number FROM blocks WHERE id = NEW.block_id
)
BEGIN
  SELECT RAISE(ABORT, 'room label is the block code, a hyphen, and the door number');
END;

CREATE TRIGGER blocks_rename_updates_room_labels
AFTER UPDATE OF code ON blocks
FOR EACH ROW
BEGIN
  UPDATE rooms
  SET label = NEW.code || '-' || number
  WHERE block_id = NEW.id;
END;

CREATE TRIGGER residents_room_capacity_insert
BEFORE INSERT ON residents
FOR EACH ROW
WHEN (
  SELECT COUNT(*) FROM residents WHERE room_id = NEW.room_id
) >= (
  SELECT bed_count FROM rooms WHERE id = NEW.room_id
)
BEGIN
  SELECT RAISE(ABORT, 'this room already has as many residents as it has beds');
END;

CREATE TRIGGER residents_room_capacity_move
BEFORE UPDATE OF room_id ON residents
FOR EACH ROW
WHEN NEW.room_id <> OLD.room_id
AND (
  SELECT COUNT(*) FROM residents WHERE room_id = NEW.room_id
) >= (
  SELECT bed_count FROM rooms WHERE id = NEW.room_id
)
BEGIN
  SELECT RAISE(ABORT, 'this room already has as many residents as it has beds');
END;

CREATE TRIGGER rooms_bed_count_covers_residents
BEFORE UPDATE OF bed_count ON rooms
FOR EACH ROW
WHEN NEW.bed_count < (SELECT COUNT(*) FROM residents WHERE room_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'bed count cannot be below the residents still assigned to the room');
END;

CREATE TRIGGER residents_profile_insert
BEFORE INSERT ON residents
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.user_id) IS NOT 'resident'
OR EXISTS (SELECT 1 FROM staff WHERE user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'a resident profile belongs to a resident and not to a staff account');
END;

CREATE TRIGGER staff_profile_insert
BEFORE INSERT ON staff
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.user_id) NOT IN ('gate', 'warden', 'provost')
OR EXISTS (SELECT 1 FROM residents WHERE user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'a staff profile belongs to gate, warden, or provost, and not to a resident');
END;

CREATE TRIGGER users_role_matches_profile
BEFORE UPDATE OF role ON users
FOR EACH ROW
WHEN (
  NEW.role = 'resident' AND EXISTS (SELECT 1 FROM staff WHERE user_id = NEW.id)
) OR (
  NEW.role <> 'resident' AND EXISTS (SELECT 1 FROM residents WHERE user_id = NEW.id)
)
BEGIN
  SELECT RAISE(ABORT, 'the role has to match the resident or staff profile');
END;

-- Checked on insert only. Changing a username and an enrolment takes two
-- statements, and SQLite applies this check before the second statement runs.
CREATE TRIGGER residents_enrolment_insert
BEFORE INSERT ON residents
FOR EACH ROW
WHEN (
  SELECT username FROM users WHERE id = NEW.user_id
) COLLATE NOCASE <> NEW.enrolment_number COLLATE NOCASE
BEGIN
  SELECT RAISE(ABORT, 'enrolment number matches the username, ignoring capitals');
END;

CREATE TRIGGER outings_permission_type_insert
BEFORE INSERT ON outings
FOR EACH ROW
WHEN NEW.permission_id IS NOT NULL
AND (
  SELECT type FROM permissions WHERE id = NEW.permission_id
) IS NOT NEW.type
BEGIN
  SELECT RAISE(ABORT, 'the permission type matches the outing type');
END;

CREATE TRIGGER outings_permission_type_update
BEFORE UPDATE OF permission_id, type ON outings
FOR EACH ROW
WHEN NEW.permission_id IS NOT NULL
AND (
  SELECT type FROM permissions WHERE id = NEW.permission_id
) IS NOT NEW.type
BEGIN
  SELECT RAISE(ABORT, 'the permission type matches the outing type');
END;

CREATE TRIGGER permissions_decider_insert
BEFORE INSERT ON permissions
FOR EACH ROW
WHEN NEW.decided_by IS NOT NULL
AND (
  SELECT role FROM users WHERE id = NEW.decided_by
) NOT IN ('warden', 'provost')
BEGIN
  SELECT RAISE(ABORT, 'a warden or the provost decides a permission');
END;

CREATE TRIGGER permissions_decider_update
BEFORE UPDATE OF decided_by ON permissions
FOR EACH ROW
WHEN NEW.decided_by IS NOT NULL
AND (
  SELECT role FROM users WHERE id = NEW.decided_by
) NOT IN ('warden', 'provost')
BEGIN
  SELECT RAISE(ABORT, 'a warden or the provost decides a permission');
END;

CREATE TRIGGER outings_recorders_insert
BEFORE INSERT ON outings
FOR EACH ROW
WHEN (
  NEW.exit_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.exit_recorded_by) NOT IN ('gate', 'warden', 'provost')
) OR (
  NEW.return_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.return_recorded_by) NOT IN ('gate', 'warden', 'provost')
)
BEGIN
  SELECT RAISE(ABORT, 'exit and return are recorded by gate staff, a warden, or the provost');
END;

CREATE TRIGGER outings_recorders_update
BEFORE UPDATE OF exit_recorded_by, return_recorded_by ON outings
FOR EACH ROW
WHEN (
  NEW.exit_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.exit_recorded_by) NOT IN ('gate', 'warden', 'provost')
) OR (
  NEW.return_recorded_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.return_recorded_by) NOT IN ('gate', 'warden', 'provost')
)
BEGIN
  SELECT RAISE(ABORT, 'exit and return are recorded by gate staff, a warden, or the provost');
END;

CREATE TRIGGER guest_stays_length_insert
BEFORE INSERT ON guest_stays
FOR EACH ROW
WHEN (
  julianday(NEW.end_date) - julianday(NEW.start_date) + 1
) NOT BETWEEN 1 AND (
  SELECT guest_max_inclusive_days FROM hall_settings WHERE id = 'hall'
)
BEGIN
  SELECT RAISE(ABORT, 'guest stay length counts the first and last day and stays within the hall maximum');
END;

CREATE TRIGGER guest_stays_length_update
BEFORE UPDATE OF start_date, end_date ON guest_stays
FOR EACH ROW
WHEN (
  julianday(NEW.end_date) - julianday(NEW.start_date) + 1
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
BEFORE UPDATE OF decided_by, payment_marked_by, arrived_recorded_by, departed_recorded_by ON guest_stays
FOR EACH ROW
WHEN (
  NEW.decided_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.decided_by) NOT IN ('warden', 'provost')
) OR (
  NEW.payment_marked_by IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.payment_marked_by) NOT IN ('warden', 'provost')
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

INSERT INTO hall_settings (
  id,
  hall_name,
  university_name,
  timezone,
  grace_minutes,
  summer_hours_start,
  summer_hours_end,
  winter_hours_start,
  winter_hours_end,
  summer_season_start,
  winter_season_start,
  permission_early_minutes,
  guest_max_inclusive_days,
  guest_min_lead_days,
  scan_duplicate_window_seconds,
  late_sms_template,
  return_sms_template,
  updated_at
) VALUES (
  'hall',
  'Begum Sultan Jahan Hall',
  'Aligarh Muslim University',
  'Asia/Kolkata',
  30,
  '06:30',
  '18:30',
  '06:30',
  '17:30',
  '04-01',
  '10-01',
  30,
  7,
  1,
  45,
  '{resident_name} ({room}) was expected to return by {expected_return_local} and has not yet returned. Please contact the Hall Office if you need to speak to the duty warden.',
  '{resident_name} ({room}) has returned to {hall_name} at {returned_at_local}. Thank you.',
  '2026-09-30T00:00:00Z'
);

INSERT INTO blocks (id, code, name, floors, room_count, beds_per_room, is_active) VALUES
  ('01b885ad-e40d-56a4-81ab-2371f654f558', 'A', 'Block-A', 4, 50, 2, 1),
  ('d032aad6-a203-5ea0-ba9a-3a9257edbfc8', 'B', 'Block-B', 4, 58, 2, 1),
  ('dad52ee9-0b9a-53e2-a792-1dbee295ada9', 'C', 'Block-C', 4, 42, 2, 1),
  ('f75a0c4d-cf9e-5b03-9ba5-13f77337453d', 'D', 'Block-D', 4, 40, 2, 1),
  ('916c689d-598e-55b4-b3dc-fcf7120ca3b1', 'Utility', 'Utility', NULL, 16, 2, 1);

INSERT INTO destinations (id, name, is_other, is_active) VALUES
  ('1285f918-cd9c-5ef8-9c04-58a69285211c', 'J.N. Medical College', 0, 1),
  ('fc2da7c5-8d65-5680-8034-d8acb69745eb', 'Maulana Azad Library', 0, 1),
  ('f2008ef3-a1df-5ff0-b936-3466d0914781', 'Other', 1, 1),
  ('924e5c75-e9b6-57a9-bb04-720028253526', 'Shamshad Market', 0, 1),
  ('df29c4b7-63c5-525d-a9ec-798a980c64c8', 'Women''s College', 0, 1);

PRAGMA user_version = 1;
