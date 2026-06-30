ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS image_position_x integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y integer NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_image_position_x_range'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_image_position_x_range
      CHECK (image_position_x >= 0 AND image_position_x <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_image_position_y_range'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_image_position_y_range
      CHECK (image_position_y >= 0 AND image_position_y <= 100);
  END IF;
END $$;
