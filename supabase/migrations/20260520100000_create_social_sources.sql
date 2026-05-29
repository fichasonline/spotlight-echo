CREATE TABLE IF NOT EXISTS public.social_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'codigopoker_liveblog',
  url TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 10,
  max_stories_per_hour INTEGER NOT NULL DEFAULT 3,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_ingest_state (
  source_url TEXT PRIMARY KEY,
  last_item_key TEXT,
  last_item_ts TIMESTAMPTZ,
  last_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_sources_updated_at ON public.social_sources;
CREATE TRIGGER trg_social_sources_updated_at
BEFORE UPDATE ON public.social_sources
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS social_sources_enabled_poll_idx
  ON public.social_sources (enabled, poll_interval_minutes, updated_at);

ALTER TABLE public.social_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_ingest_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage social sources" ON public.social_sources;
DROP POLICY IF EXISTS "Admins can manage social ingest state" ON public.social_ingest_state;

CREATE POLICY "Admins can manage social sources"
ON public.social_sources
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage social ingest state"
ON public.social_ingest_state
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
