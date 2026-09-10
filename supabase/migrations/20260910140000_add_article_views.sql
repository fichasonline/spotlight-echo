-- ============================================================================
-- Conteo de lecturas de notas.
--
-- Guarda UNA FILA POR NOTA Y POR DÍA con un contador. No guarda IP, ni usuario,
-- ni identificador de sesión: no hay forma de reconstruir qué leyó una persona,
-- porque el dato que se necesita para rankear es cuántas veces se abrió una
-- nota, no quién la abrió.
--
-- La contrapartida es que un mismo lector que recarga cinco veces suma cinco.
-- Para un ranking de "lo más leído" eso es aceptable: infla parejo a todas las
-- notas y no cambia el orden.
--
-- El agregado por día (en lugar de una fila por lectura) mantiene la tabla
-- chica — 1 fila diaria por nota publicada — y hace directa la consulta de
-- "últimos 7 días".
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.article_views (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  -- Fecha en la zona del portal, no UTC: "los últimos 7 días" tiene que
  -- coincidir con los días que ve el equipo, no correrse unas horas.
  viewed_on  date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Montevideo')::date,
  views      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, viewed_on)
);

-- El ranking arranca filtrando por fecha y ordenando por lecturas.
CREATE INDEX IF NOT EXISTS article_views_recent_idx
  ON public.article_views (viewed_on DESC, views DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Lectura pública (el ranking se arma desde el navegador del visitante).
-- Escritura: NADIE directamente. Sumar lecturas va sólo por la función de
-- abajo, para que nadie pueda escribir un número arbitrario en la tabla.

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "article_views_select" ON public.article_views;
CREATE POLICY "article_views_select" ON public.article_views
  FOR SELECT USING (true);

-- ── Función para sumar una lectura ──────────────────────────────────────────
-- SECURITY DEFINER: es la única vía de escritura, y sólo sabe incrementar en 1.
-- No recibe la cantidad como parámetro justamente para que no se pueda inflar.

CREATE OR REPLACE FUNCTION public.record_article_view(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sólo cuenta notas publicadas: evita que un borrador sume lecturas.
  IF NOT EXISTS (
    SELECT 1 FROM public.articles
     WHERE id = p_article_id AND status = 'published'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.article_views (article_id, viewed_on, views)
  VALUES (p_article_id, (now() AT TIME ZONE 'America/Montevideo')::date, 1)
  ON CONFLICT (article_id, viewed_on)
  DO UPDATE SET views = public.article_views.views + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_article_view(uuid) TO anon, authenticated;

-- ── Vista del ranking de los últimos 7 días ─────────────────────────────────
-- Vive en la base y no en el front para que el "top" sea una sola consulta y
-- no traerse todas las filas al navegador para sumarlas ahí.

CREATE OR REPLACE VIEW public.article_views_last_week AS
SELECT article_id,
       SUM(views)::bigint AS views
  FROM public.article_views
 WHERE viewed_on >= ((now() AT TIME ZONE 'America/Montevideo')::date - INTERVAL '7 days')
 GROUP BY article_id;

GRANT SELECT ON public.article_views_last_week TO anon, authenticated;
