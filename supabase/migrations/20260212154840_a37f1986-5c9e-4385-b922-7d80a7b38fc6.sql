
-- Create shared_recordings table
CREATE TABLE public.shared_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  shared_with UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(recording_id, shared_with)
);

-- Enable RLS
ALTER TABLE public.shared_recordings ENABLE ROW LEVEL SECURITY;

-- SELECT: User can see entries where they are shared_by or shared_with
CREATE POLICY "Users can view own shared recordings"
ON public.shared_recordings FOR SELECT
USING (auth.uid() = shared_by OR auth.uid() = shared_with);

-- INSERT: User can only share their own recordings
CREATE POLICY "Users can share own recordings"
ON public.shared_recordings FOR INSERT
WITH CHECK (
  auth.uid() = shared_by
  AND EXISTS (
    SELECT 1 FROM public.recordings
    WHERE recordings.id = recording_id
    AND recordings.user_id = auth.uid()
  )
);

-- DELETE: Only the sharer can revoke
CREATE POLICY "Users can unshare own shares"
ON public.shared_recordings FOR DELETE
USING (auth.uid() = shared_by);

-- Admin access
CREATE POLICY "Admins can manage shared recordings"
ON public.shared_recordings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- New SELECT policy on recordings for shared access
CREATE POLICY "Users can view shared recordings"
ON public.recordings FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.shared_recordings
    WHERE shared_recordings.recording_id = recordings.id
    AND shared_recordings.shared_with = auth.uid()
  )
);
