-- Rename ordinary outing window and permission lead columns on hall_settings.
-- SMS templates stay on this row; they are exposed only via /api/v1/admin/notifications.

ALTER TABLE hall_settings RENAME COLUMN summer_hours_start TO summer_outing_start;
ALTER TABLE hall_settings RENAME COLUMN summer_hours_end TO summer_outing_end;
ALTER TABLE hall_settings RENAME COLUMN winter_hours_start TO winter_outing_start;
ALTER TABLE hall_settings RENAME COLUMN winter_hours_end TO winter_outing_end;
ALTER TABLE hall_settings RENAME COLUMN permission_early_minutes TO permission_lead_minutes;

PRAGMA user_version = 9;
