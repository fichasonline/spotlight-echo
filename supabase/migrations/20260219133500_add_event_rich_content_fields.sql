-- Add richer event content fields for detailed pages
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb;

UPDATE public.events
SET gallery = '[]'::jsonb
WHERE gallery IS NULL;

ALTER TABLE public.events
  ALTER COLUMN gallery SET DEFAULT '[]'::jsonb;

ALTER TABLE public.events
  ALTER COLUMN gallery SET NOT NULL;
