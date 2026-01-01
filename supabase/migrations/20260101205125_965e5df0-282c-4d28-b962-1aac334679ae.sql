-- Reset all recall_calendar_users entries for EU migration
-- Old US-region recall_user_ids are no longer valid in EU

UPDATE public.recall_calendar_users
SET 
  google_connected = false,
  microsoft_connected = false,
  updated_at = now();