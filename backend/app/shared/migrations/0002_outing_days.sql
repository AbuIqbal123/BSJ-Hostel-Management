-- One planned or outside outing per resident per hall day.

ALTER TABLE outings ADD COLUMN hall_date TEXT;

UPDATE outings
SET hall_date = date(
  datetime(replace(expected_return_at, 'Z', ''), '+5 hours', '+30 minutes')
);

DROP INDEX outings_one_open;

CREATE UNIQUE INDEX outings_one_open_day
  ON outings (resident_id, hall_date)
  WHERE status IN ('planned', 'outside');

CREATE UNIQUE INDEX outings_one_outside
  ON outings (resident_id)
  WHERE status = 'outside';

CREATE TRIGGER outings_hall_date_insert
BEFORE INSERT ON outings
WHEN NEW.hall_date IS NULL
  OR NEW.hall_date != date(
    datetime(replace(NEW.expected_return_at, 'Z', ''), '+5 hours', '+30 minutes')
  )
BEGIN
  SELECT RAISE(ABORT, 'hall_date must be the hall day of the expected return');
END;

CREATE TRIGGER outings_hall_date_update
BEFORE UPDATE OF expected_return_at, hall_date ON outings
WHEN NEW.hall_date IS NULL
  OR NEW.hall_date != date(
    datetime(replace(NEW.expected_return_at, 'Z', ''), '+5 hours', '+30 minutes')
  )
BEGIN
  SELECT RAISE(ABORT, 'hall_date must be the hall day of the expected return');
END;
