-- Several planned outings may share a hall day. Two open outings may not
-- end at the same instant. She can be outside on only one.

DROP INDEX outings_one_open_day;

CREATE UNIQUE INDEX outings_one_return
  ON outings (resident_id, expected_return_at)
  WHERE status IN ('planned', 'outside');

PRAGMA user_version = 3;
