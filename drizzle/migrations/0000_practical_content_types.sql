ALTER TABLE public.practical_videos ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'video';
ALTER TABLE public.practical_videos ADD COLUMN IF NOT EXISTS case_text text;
ALTER TABLE public.practical_videos ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.practical_videos ADD COLUMN IF NOT EXISTS annotations jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.practical_videos ALTER COLUMN youtube_url SET DEFAULT '';
ALTER TABLE public.practical_videos ADD CONSTRAINT practical_videos_content_type_chk CHECK (content_type IN ('video','case','image'));

CREATE POLICY "Authenticated read practical media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'practical-media');
CREATE POLICY "Admins upload practical media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'practical-media' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update practical media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'practical-media' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete practical media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'practical-media' AND public.has_role(auth.uid(), 'admin'::app_role));