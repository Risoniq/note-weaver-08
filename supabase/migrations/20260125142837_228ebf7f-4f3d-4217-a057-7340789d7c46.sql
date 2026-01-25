-- Tabelle für lernende Sprechervorschläge
CREATE TABLE IF NOT EXISTS public.speaker_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: Ein Name pro User
  UNIQUE(user_id, name)
);

-- Index für schnelles Nachschlagen
CREATE INDEX IF NOT EXISTS idx_speaker_suggestions_user_id ON public.speaker_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_speaker_suggestions_usage ON public.speaker_suggestions(user_id, usage_count DESC);

-- Enable Row Level Security
ALTER TABLE public.speaker_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: User sieht nur eigene Vorschläge
CREATE POLICY "Users can view own suggestions" 
ON public.speaker_suggestions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggestions" 
ON public.speaker_suggestions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions" 
ON public.speaker_suggestions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestions" 
ON public.speaker_suggestions 
FOR DELETE 
USING (auth.uid() = user_id);