-- Add 5th slot for a vertical content banner on home
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.home_banners'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%position%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.home_banners DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.home_banners
ADD CONSTRAINT home_banners_position_check
CHECK (position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right', 'content_vertical'));

INSERT INTO public.home_banners (position, alt_text)
VALUES ('content_vertical', 'Banner vertical de contenido')
ON CONFLICT (position) DO NOTHING;
