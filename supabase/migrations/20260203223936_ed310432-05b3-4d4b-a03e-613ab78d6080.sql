-- Admins dürfen alle Recordings aktualisieren
CREATE POLICY "Admins can update all recordings"
ON public.recordings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));