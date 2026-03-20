ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS detailed_address text;

INSERT INTO storage.buckets (id, name, public) VALUES ('station-images', 'station-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view station images" ON storage.objects FOR SELECT USING (bucket_id = 'station-images');
CREATE POLICY "Authenticated users can upload station images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'station-images');
CREATE POLICY "Authenticated users can update station images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'station-images');
CREATE POLICY "Authenticated users can delete station images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'station-images');