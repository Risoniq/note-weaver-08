-- Add participants column to store participant list from Recall.ai
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS participants jsonb DEFAULT NULL;