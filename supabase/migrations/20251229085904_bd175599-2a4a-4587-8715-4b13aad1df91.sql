-- Fix 1: Drop overly permissive storage policies for bot-avatars bucket
DROP POLICY IF EXISTS "Anyone can upload bot avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update bot avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete bot avatars" ON storage.objects;

-- Create secure storage policies requiring authentication and user ownership
CREATE POLICY "Authenticated users can upload own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bot-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bot-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bot-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 2: Drop overly permissive RLS policies on recordings table
DROP POLICY IF EXISTS "Anyone can view recordings" ON public.recordings;
DROP POLICY IF EXISTS "Service role can insert recordings" ON public.recordings;
DROP POLICY IF EXISTS "Service role can update recordings" ON public.recordings;

-- Add user_id column to recordings table for ownership
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create secure RLS policies for recordings
-- SELECT: Users can only view their own recordings
CREATE POLICY "Users can view own recordings"
ON public.recordings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies for authenticated users - only service role should write
-- Service role bypasses RLS automatically, so no policies needed for edge functions