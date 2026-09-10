-- ============================================================================
-- Nacionalidad del campeón.
--
-- Se guarda el ISO 3166-1 alfa-2 ("UY", "AR"), no el nombre ni la bandera: el
-- nombre en español y el emoji se derivan en el front (src/lib/countries.ts),
-- así que renombrar un país o cambiar cómo se muestra no toca la base.
--
-- Nullable a propósito: los campeones ya cargados no tienen nacionalidad y no
-- queremos inventarles una. El panel la pide para los nuevos.
-- ============================================================================

ALTER TABLE public.champions
  ADD COLUMN IF NOT EXISTS country text;

-- Los campeones que ya están vinculados a un jugador con país heredan el suyo.
UPDATE public.champions c
   SET country = p.country
  FROM public.players p
 WHERE c.country IS NULL
   AND c.player_id = p.id
   AND p.country IS NOT NULL;
