-- Create storage bucket for audio uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('audio-uploads', 'audio-uploads', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload their own audio files
CREATE POLICY "Users can upload audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can read their own audio files
CREATE POLICY "Users can read own audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can delete their own audio files
CREATE POLICY "Users can delete own audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);