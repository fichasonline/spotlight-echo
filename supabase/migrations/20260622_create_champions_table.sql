CREATE TABLE IF NOT EXISTS public.champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tournament TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('UYU', 'USD')),
  image_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.champions ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can view champions
CREATE POLICY "champions_select" ON public.champions
  FOR SELECT USING (true);

-- RLS: Only admin/moderator can insert
CREATE POLICY "champions_insert" ON public.champions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- RLS: Only creator or admin/moderator can update/delete
CREATE POLICY "champions_update" ON public.champions
  FOR UPDATE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "champions_delete" ON public.champions
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- Storage bucket for champion images (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('champions', 'champions', true) ON CONFLICT DO NOTHING;

-- Allow public read access to champion images
CREATE POLICY "Public champion images" ON storage.objects
  FOR SELECT USING (bucket_id = 'champions');

-- Allow authenticated users with moderator/admin role to upload champion images
CREATE POLICY "Moderator champion image uploads" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'champions' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );
