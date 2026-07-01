ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS instagram_image_position_x integer,
  ADD COLUMN IF NOT EXISTS instagram_image_position_y integer,
  ADD COLUMN IF NOT EXISTS instagram_image_zoom integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_instagram_image_position_x_range'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_instagram_image_position_x_range
      CHECK (instagram_image_position_x IS NULL OR (instagram_image_position_x >= 0 AND instagram_image_position_x <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_instagram_image_position_y_range'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_instagram_image_position_y_range
      CHECK (instagram_image_position_y IS NULL OR (instagram_image_position_y >= 0 AND instagram_image_position_y <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_instagram_image_zoom_range'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_instagram_image_zoom_range
      CHECK (instagram_image_zoom IS NULL OR (instagram_image_zoom >= 100 AND instagram_image_zoom <= 180));
  END IF;
END $$;
