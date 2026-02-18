ALTER TABLE recall_calendar_users
ALTER COLUMN recording_preferences
SET DEFAULT '{"record_all": true, "auto_record": false, "record_external": true, "record_only_owned": false}'::jsonb;