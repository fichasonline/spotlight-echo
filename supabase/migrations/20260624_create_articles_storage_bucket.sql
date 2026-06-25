-- Create articles storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'articles',
  'articles',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT DO NOTHING;

-- Allow public read access to article images
DROP POLICY IF EXISTS "Public read article images" ON storage.objects;
CREATE POLICY "Public read article images" ON storage.objects
  FOR SELECT USING (bucket_id = 'articles');

-- Allow authenticated admin users to upload article images
DROP POLICY IF EXISTS "Admin upload article images" ON storage.objects;
CREATE POLICY "Admin upload article images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'articles' AND
    auth.uid() IS NOT NULL AND
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Allow authenticated admin users to delete article images
DROP POLICY IF EXISTS "Admin delete article images" ON storage.objects;
CREATE POLICY "Admin delete article images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'articles' AND
    auth.uid() IS NOT NULL AND
    public.has_role(auth.uid(), 'admin'::app_role)
  );
