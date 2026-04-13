-- Table for home page banner ads (4 fixed positions)
CREATE TABLE IF NOT EXISTS public.home_banners (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  position    text        NOT NULL CHECK (position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right')),
  image_url   text,
  link_url    text,
  alt_text    text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position)
);

-- Seed the 4 slots so they always exist
INSERT INTO public.home_banners (position, alt_text) VALUES
  ('top_left',     'Banner superior izquierdo'),
  ('top_right',    'Banner superior derecho'),
  ('bottom_left',  'Banner inferior izquierdo'),
  ('bottom_right', 'Banner inferior derecho')
ON CONFLICT (position) DO NOTHING;

-- RLS
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read home_banners"
  ON public.home_banners FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage home_banners"
  ON public.home_banners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for banner images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'home-banners',
  'home-banners',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view home banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload home banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update home banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete home banner images" ON storage.objects;

CREATE POLICY "Public can view home banner images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'home-banners');

CREATE POLICY "Admins can upload home banner images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'home-banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update home banner images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'home-banners' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'home-banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete home banner images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'home-banners' AND public.has_role(auth.uid(), 'admin'));
