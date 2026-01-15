-- Add source column to recordings table to distinguish between bot, desktop SDK, and manual recordings
ALTER TABLE public.recordings 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'bot';

-- Add check constraint for valid source values
ALTER TABLE public.recordings
ADD CONSTRAINT recordings_source_check 
CHECK (source IN ('bot', 'desktop_sdk', 'manual'));

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_recordings_source ON public.recordings(source);