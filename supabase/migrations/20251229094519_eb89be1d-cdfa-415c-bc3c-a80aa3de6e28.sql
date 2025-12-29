-- Add INSERT policy for recordings table
CREATE POLICY "Users can insert own recordings"
ON public.recordings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for recordings table
CREATE POLICY "Users can update own recordings"
ON public.recordings
FOR UPDATE
USING (auth.uid() = user_id);

-- Add DELETE policy for recordings table
CREATE POLICY "Users can delete own recordings"
ON public.recordings
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE policy for recall_calendar_users table
CREATE POLICY "Users can delete own calendar users"
ON public.recall_calendar_users
FOR DELETE
USING (supabase_user_id = auth.uid());