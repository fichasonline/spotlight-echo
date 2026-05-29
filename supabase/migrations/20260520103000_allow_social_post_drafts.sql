ALTER TABLE public.social_posts
DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE public.social_posts
ADD CONSTRAINT social_posts_status_check
CHECK (status IN ('draft', 'needs_approval', 'queued', 'publishing', 'published', 'failed', 'cancelled'));
