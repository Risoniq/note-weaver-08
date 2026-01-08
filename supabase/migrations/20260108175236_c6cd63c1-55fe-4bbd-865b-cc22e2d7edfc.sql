-- Create user_presence table for online status tracking
CREATE TABLE public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Users can update their own presence
CREATE POLICY "Users can upsert own presence"
ON public.user_presence
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all presence data
CREATE POLICY "Admins can view all presence"
ON public.user_presence
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for presence updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Create index for faster lookups
CREATE INDEX idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX idx_user_presence_last_seen ON public.user_presence(last_seen);