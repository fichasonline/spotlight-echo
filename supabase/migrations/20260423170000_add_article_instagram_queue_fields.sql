ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS instagram_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_order integer;

CREATE INDEX IF NOT EXISTS articles_instagram_queue_idx
  ON public.articles (instagram_selected, instagram_published, instagram_order, published_at DESC);
