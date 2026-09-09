-- ============================================================================
-- Calendario de torneos: campos que pide la propuesta y slug para la ficha
-- de torneo individual (/calendario/:slug).
--
-- Migración ADITIVA. `slug` se agrega SIN restricción de unicidad y se
-- backfillea acá; el índice único va en una migración aparte
-- (20260909120200) para poder verificar duplicados antes de aplicarlo.
-- Si dos eventos generan el mismo slug, queremos enterarnos con una consulta,
-- no con una migración que falla a mitad de camino.
-- ============================================================================

-- ── 1. Helper de slugs, compartido con la migración de jugadores ────────────
-- Sin depender de la extensión `unaccent`, que puede no estar habilitada.

CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT trim(BOTH '-' FROM
    regexp_replace(
      regexp_replace(
        lower(translate(
          value,
          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
        )),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- ── 2. Columnas nuevas ──────────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug          text,
  ADD COLUMN IF NOT EXISTS tier          text,
  ADD COLUMN IF NOT EXISTS satellites    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS package_value text,
  ADD COLUMN IF NOT EXISTS contact_url   text;

COMMENT ON COLUMN public.events.satellites IS
  'Lista de satélites: [{ "name", "date", "buy_in", "room" }]. JSONB en vez de tabla aparte por el volumen que maneja el calendario.';
COMMENT ON COLUMN public.events.package_value IS
  'Valor del paquete que se juega el torneo (texto libre: incluye moneda y detalle).';
COMMENT ON COLUMN public.events.contact_url IS
  'Destino del botón de consulta directa (gancho comercial del calendario).';

DO $$ BEGIN
  ALTER TABLE public.events
    ADD CONSTRAINT events_tier_check
    CHECK (tier IS NULL OR tier IN ('A', 'B', 'C'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Backfill de slugs ────────────────────────────────────────────────────
-- Nombre + año de inicio. El año desambigua las ediciones anuales del mismo
-- circuito ("WSOP Circuit" 2025 vs 2026), que es la colisión más probable.

UPDATE public.events
   SET slug = public.slugify(name) || '-' || EXTRACT(YEAR FROM start_date)::text
 WHERE slug IS NULL;

-- Si aun así quedan repetidos, se numeran por fecha de creación para dejar la
-- tabla lista para el índice único.
WITH duplicados AS (
  SELECT id,
         slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at, id) AS n
    FROM public.events
   WHERE slug IS NOT NULL
)
UPDATE public.events e
   SET slug = d.slug || '-' || d.n::text
  FROM duplicados d
 WHERE e.id = d.id
   AND d.n > 1;

CREATE INDEX IF NOT EXISTS events_start_date_idx ON public.events (start_date DESC);
