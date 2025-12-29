-- Create storage bucket for transcript backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('transcript-backups', 'transcript-backups', false);

-- RLS policies for transcript-backups bucket
CREATE POLICY "Users can view own transcript backups"
ON storage.objects FOR SELECT
USING (bucket_id = 'transcript-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own transcript backups"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transcript-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own transcript backups"
ON storage.objects FOR UPDATE
USING (bucket_id = 'transcript-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own transcript backups"
ON storage.objects FOR DELETE
USING (bucket_id = 'transcript-backups' AND auth.uid()::text = (storage.foldername(name))[1]);