-- ============================================================================
-- Índice único sobre events.slug — paso separado a propósito.
--
-- Correr ANTES esta verificación; tiene que devolver 0 filas:
--
--   SELECT slug, count(*)
--     FROM public.events
--    WHERE slug IS NOT NULL
--    GROUP BY slug
--   HAVING count(*) > 1;
--
-- Si devuelve algo, el backfill de 20260909120100 no resolvió alguna colisión:
-- corregir a mano esos slugs antes de aplicar esta migración. Crear el índice
-- con duplicados presentes falla y deja la migración a medio aplicar.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key
  ON public.events (slug)
  WHERE slug IS NOT NULL;
