-- Add recall_bot_id column to recordings table for Recall.ai integration
ALTER TABLE public.recordings 
ADD COLUMN IF NOT EXISTS recall_bot_id TEXT;