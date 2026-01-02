-- Delete all calendar user entries to start fresh with EU region
-- Old US-region recall_user_ids are no longer valid
DELETE FROM public.recall_calendar_users;