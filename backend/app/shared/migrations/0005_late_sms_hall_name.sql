-- Align the default late SMS template with OpenAPI placeholders ({hall_name}).

UPDATE hall_settings
SET late_sms_template = '{resident_name} ({room}) was expected to return to {hall_name} by {expected_return_local} and has not yet returned. Please contact the Hall Office if you need to speak to the duty warden.'
WHERE id = 'hall';

PRAGMA user_version = 5;
