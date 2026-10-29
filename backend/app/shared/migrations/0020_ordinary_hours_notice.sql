-- Posted hall rules: ordinary outing 06:00–18:30. Keep one window for now
-- (summer and winter the same). Season columns stay so the hall can split later.
UPDATE hall_settings
SET
  summer_outing_start = '06:00',
  summer_outing_end = '18:30',
  winter_outing_start = '06:00',
  winter_outing_end = '18:30'
WHERE id = 'hall';
