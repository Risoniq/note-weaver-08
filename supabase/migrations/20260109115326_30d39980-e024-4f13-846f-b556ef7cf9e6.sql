-- Admin RLS Policy für transcript-backups Storage Bucket
CREATE POLICY "Admins can view all transcript backups"
ON storage.objects
FOR SELECT
USING (bucket_id = 'transcript-backups' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can download all transcript backups"
ON storage.objects
FOR SELECT
USING (bucket_id = 'transcript-backups' AND public.has_role(auth.uid(), 'admin'::app_role));