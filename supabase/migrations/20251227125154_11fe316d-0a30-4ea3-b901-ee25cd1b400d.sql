-- Create function for updating timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for Recall.ai Calendar Users
CREATE TABLE public.recall_calendar_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recall_user_id TEXT NOT NULL UNIQUE,
  google_connected BOOLEAN NOT NULL DEFAULT false,
  microsoft_connected BOOLEAN NOT NULL DEFAULT false,
  recording_preferences JSONB DEFAULT '{"record_all": true, "record_only_owned": false, "record_external": true, "auto_record": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recall_calendar_users ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth in this app)
CREATE POLICY "Anyone can view calendar users" 
ON public.recall_calendar_users 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert calendar users" 
ON public.recall_calendar_users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update calendar users" 
ON public.recall_calendar_users 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recall_calendar_users_updated_at
BEFORE UPDATE ON public.recall_calendar_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();