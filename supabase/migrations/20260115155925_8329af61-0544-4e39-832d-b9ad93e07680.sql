-- Add bot settings columns to recall_calendar_users table
ALTER TABLE recall_calendar_users 
ADD COLUMN IF NOT EXISTS bot_name TEXT DEFAULT 'Notetaker Bot',
ADD COLUMN IF NOT EXISTS bot_avatar_url TEXT;