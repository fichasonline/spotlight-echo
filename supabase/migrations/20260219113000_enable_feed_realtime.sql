-- Ensure feed tables are streamed through Supabase Realtime.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'posts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'post_likes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
    END IF;
  END IF;
END
$$;
