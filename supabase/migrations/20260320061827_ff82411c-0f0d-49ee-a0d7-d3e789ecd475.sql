-- Add media_url column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url text;

-- Create storage bucket for whatsapp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read media files
CREATE POLICY "Authenticated read whatsapp media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow service role to insert media files
CREATE POLICY "Service role insert whatsapp media"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow public read access for media display
CREATE POLICY "Public read whatsapp media"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'whatsapp-media');