CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram')),
  format TEXT NOT NULL DEFAULT 'carousel' CHECK (format IN ('carousel', 'image', 'story')),
  headline TEXT,
  caption TEXT NOT NULL,
  hashtags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'needs_approval' CHECK (
    status IN ('needs_approval', 'queued', 'publishing', 'published', 'failed', 'cancelled')
  ),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  remote_media_id TEXT,
  remote_permalink TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'image' CHECK (asset_type IN ('image', 'video')),
  url TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index > 0),
  remote_container_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, order_index)
);

CREATE TABLE IF NOT EXISTS public.social_publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'published', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  remote_media_id TEXT,
  remote_permalink TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_publisher_queue_idx
  ON public.social_posts (platform, status, scheduled_at, created_at);

CREATE INDEX IF NOT EXISTS social_assets_post_order_idx
  ON public.social_assets (post_id, order_index);

CREATE INDEX IF NOT EXISTS social_publish_jobs_queue_idx
  ON public.social_publish_jobs (status, created_at)
  WHERE status = 'queued';

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Admins can manage social assets" ON public.social_assets;
DROP POLICY IF EXISTS "Admins can manage social publish jobs" ON public.social_publish_jobs;

CREATE POLICY "Admins can manage social posts"
ON public.social_posts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage social assets"
ON public.social_assets
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage social publish jobs"
ON public.social_publish_jobs
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
