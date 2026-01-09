-- Allow admins to view all recordings with metadata
CREATE POLICY "Admins can view all recordings"
ON public.recordings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));