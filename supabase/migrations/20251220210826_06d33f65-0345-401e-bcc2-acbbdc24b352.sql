-- Create storage bucket for bot profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('bot-avatars', 'bot-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view bot avatars (public bucket)
CREATE POLICY "Bot avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'bot-avatars');

-- Allow anyone to upload bot avatars (for simplicity, since no auth yet)
CREATE POLICY "Anyone can upload bot avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bot-avatars');

-- Allow anyone to update their bot avatar
CREATE POLICY "Anyone can update bot avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'bot-avatars');

-- Allow anyone to delete bot avatars
CREATE POLICY "Anyone can delete bot avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'bot-avatars');