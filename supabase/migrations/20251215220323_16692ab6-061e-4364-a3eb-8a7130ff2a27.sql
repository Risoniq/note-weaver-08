-- Create recordings table for meeting recordings
CREATE TABLE public.recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  video_url TEXT,
  transcript_url TEXT,
  transcript_text TEXT,
  meeting_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (no auth required per user requirements)
CREATE POLICY "Anyone can view recordings" 
ON public.recordings 
FOR SELECT 
USING (true);

-- Create policy for inserting recordings (via edge functions)
CREATE POLICY "Service role can insert recordings" 
ON public.recordings 
FOR INSERT 
WITH CHECK (true);

-- Create policy for updating recordings (via edge functions)
CREATE POLICY "Service role can update recordings" 
ON public.recordings 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recordings_updated_at
BEFORE UPDATE ON public.recordings
FOR EACH ROW
EXECUTE FUNCTION public.update_recordings_updated_at();