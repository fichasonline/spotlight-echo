-- ============================================================================
-- Jugadores: entidad propia + vínculo desde champions.
--
-- Hoy `champions.name` es texto libre, sin relación con articles ni events:
-- cargar dos veces al mismo campeón crea dos registros sin conexión. Esta
-- tabla es lo que hace posibles la ficha de jugador, el índice /jugadores/ y
-- el ranking.
--
-- Migración ADITIVA: `champions.name` se conserva tal cual y sigue siendo la
-- fuente que lee el portal actual. `player_id` es nullable y nadie lo lee
-- todavía.
-- ============================================================================

-- ── 1. Tabla de jugadores ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.players (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  country    text,
  avatar_url text,
  bio        text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.champions
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS champions_player_idx ON public.champions (player_id);

-- ── 2. RLS — lectura pública, escritura admin (mismo criterio que champions)

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_select" ON public.players;
CREATE POLICY "players_select" ON public.players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "players_write" ON public.players;
CREATE POLICY "players_write" ON public.players
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── 3. Backfill desde los campeones ya cargados ─────────────────────────────
-- Se agrupa por slug, así que "Juan Perez" y "Juan Pérez" caen en el mismo
-- jugador (slugify saca los acentos). Variantes con distinta ortografía real
-- ("Juan P. Perez") quedan como jugadores separados A PROPÓSITO: fusionar mal
-- dos personas distintas es peor que dejar dos fichas para unir a mano desde
-- el panel.

INSERT INTO public.players (slug, name)
SELECT DISTINCT ON (public.slugify(name))
       public.slugify(name) AS slug,
       name
  FROM public.champions
 WHERE name IS NOT NULL
   AND public.slugify(name) <> ''
 ORDER BY public.slugify(name), created_at
ON CONFLICT (slug) DO NOTHING;

UPDATE public.champions c
   SET player_id = p.id
  FROM public.players p
 WHERE c.player_id IS NULL
   AND public.slugify(c.name) = p.slug;
