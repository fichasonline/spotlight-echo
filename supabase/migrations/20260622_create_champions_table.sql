CREATE TABLE IF NOT EXISTS public.champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tournament TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('UYU', 'USD')),
  image_url TEXT,
  post_url TEXT,
  week_number INT NOT NULL DEFAULT (EXTRACT(WEEK FROM now())::INT),
  year_week TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-WW')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.champions ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can view champions
DROP POLICY IF EXISTS "champions_select" ON public.champions;
CREATE POLICY "champions_select" ON public.champions
  FOR SELECT USING (true);

-- RLS: Only admin can insert
DROP POLICY IF EXISTS "champions_insert" ON public.champions;
CREATE POLICY "champions_insert" ON public.champions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS: Only admin can update/delete
DROP POLICY IF EXISTS "champions_update" ON public.champions;
CREATE POLICY "champions_update" ON public.champions
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "champions_delete" ON public.champions;
CREATE POLICY "champions_delete" ON public.champions
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Storage bucket for champion images (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('champions', 'champions', true) ON CONFLICT DO NOTHING;

-- Allow public read access to champion images
DROP POLICY IF EXISTS "Public champion images" ON storage.objects;
CREATE POLICY "Public champion images" ON storage.objects
  FOR SELECT USING (bucket_id = 'champions');

-- Allow authenticated users with admin role to upload champion images
DROP POLICY IF EXISTS "Moderator champion image uploads" ON storage.objects;
CREATE POLICY "Moderator champion image uploads" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'champions' AND
    auth.uid() IS NOT NULL AND
    public.has_role(auth.uid(), 'admin'::app_role)
  );
