-- Public bucket for event images (hero + gallery)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-media',
  'event-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view event media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload event media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update event media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete event media" ON storage.objects;

CREATE POLICY "Public can view event media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-media');

CREATE POLICY "Admins can upload event media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-media'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update event media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-media'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'event-media'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete event media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-media'
  AND public.has_role(auth.uid(), 'admin')
);
