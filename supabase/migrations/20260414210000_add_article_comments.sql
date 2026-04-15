-- Comentarios de usuarios en artículos de noticias
CREATE TABLE IF NOT EXISTS public.article_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid        NOT NULL REFERENCES public.articles(id)  ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS article_comments_article_id_idx ON public.article_comments (article_id);
CREATE INDEX IF NOT EXISTS article_comments_user_id_idx    ON public.article_comments (user_id);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer comentarios (incluyendo anónimos)
CREATE POLICY "public_read_article_comments"
  ON public.article_comments FOR SELECT
  USING (true);

-- Solo usuarios autenticados (no anónimos) pueden insertar sus propios comentarios
CREATE POLICY "authenticated_insert_article_comments"
  ON public.article_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Cada usuario puede borrar sus propios comentarios; los admins pueden borrar cualquiera
CREATE POLICY "delete_article_comments"
  ON public.article_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Habilitar replicación en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_comments;
