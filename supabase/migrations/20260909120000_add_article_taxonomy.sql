-- ============================================================================
-- Taxonomía de noticias: categoría, etiquetas cruzadas, autor y evento.
--
-- Migración ADITIVA. No borra ni renombra nada, no altera tipos existentes y
-- no toca las políticas RLS de `articles`. Las páginas que hoy están online
-- piden listas explícitas de columnas, así que nunca ven estas columnas
-- nuevas: el portal en producción sigue comportándose igual que antes.
--
-- `category` queda NULLABLE a propósito: las notas ya publicadas no tienen
-- categoría asignada y no se puede adivinar. El admin va a exponer un filtro
-- "sin categoría" para que el equipo editorial triaje el backlog. La
-- restricción de obligatoriedad se agrega en una migración posterior, recién
-- cuando ese backlog esté clasificado.
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.article_category AS ENUM (
    'torneos_en_vivo',
    'poker_online',
    'resultados',
    'entrevistas',
    'internacional'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tag_type AS ENUM (
    'circuito',
    'pais',
    'region',
    'sala',
    'tier'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Columnas nuevas en articles ──────────────────────────────────────────

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS category  public.article_category,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS event_id  uuid REFERENCES public.events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.articles.category IS
  'Categoría principal. Una sola por nota; todo lo demás va como etiqueta cruzada.';
COMMENT ON COLUMN public.articles.event_id IS
  'Evento del calendario que cubre esta nota. Alimenta la ficha de torneo individual.';

-- Backfill de autor: `created_by` es hoy lo más cercano a un autor real.
UPDATE public.articles
   SET author_id = created_by
 WHERE author_id IS NULL
   AND created_by IS NOT NULL;

-- ── 3. Etiquetas cruzadas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  type        public.tag_type NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.article_tags (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- ── 4. Índices ──────────────────────────────────────────────────────────────

-- Listado de una página de categoría, ordenado por fecha.
CREATE INDEX IF NOT EXISTS articles_category_published_idx
  ON public.articles (category, published_at DESC);

-- Listado de una página de etiqueta (/wsop/, /uruguay/…).
CREATE INDEX IF NOT EXISTS article_tags_tag_idx
  ON public.article_tags (tag_id);

CREATE INDEX IF NOT EXISTS articles_event_idx
  ON public.articles (event_id);

-- ── 5. RLS — espeja el criterio de `articles`: lectura pública, escritura admin

ALTER TABLE public.tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select" ON public.tags;
CREATE POLICY "tags_select" ON public.tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tags_write" ON public.tags;
CREATE POLICY "tags_write" ON public.tags
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "article_tags_select" ON public.article_tags;
CREATE POLICY "article_tags_select" ON public.article_tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "article_tags_write" ON public.article_tags;
CREATE POLICY "article_tags_write" ON public.article_tags
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── 6. Vocabulario inicial de etiquetas ─────────────────────────────────────
-- Los tiers quedan creados pero sin asignar: la clasificación A/B/C de cada
-- torneo depende del calendario sept–nov que entrega Franco.

INSERT INTO public.tags (slug, name, type) VALUES
  ('wsop',  'WSOP',  'circuito'),
  ('wpt',   'WPT',   'circuito'),
  ('ept',   'EPT',   'circuito'),
  ('bsop',  'BSOP',  'circuito'),
  ('wps',   'WPS',   'circuito'),
  ('lapt',  'LAPT',  'circuito'),
  ('capt',  'CAPT',  'circuito'),

  ('sudamerica',            'Sudamérica',              'region'),
  ('norteamerica',          'Norteamérica',            'region'),
  ('europa',                'Europa',                  'region'),
  ('centroamerica-caribe',  'Centroamérica y Caribe',  'region'),

  ('uruguay',  'Uruguay',  'pais'),
  ('argentina','Argentina','pais'),
  ('brasil',   'Brasil',   'pais'),
  ('chile',    'Chile',    'pais'),
  ('paraguay', 'Paraguay', 'pais'),
  ('peru',     'Perú',     'pais'),
  ('colombia', 'Colombia', 'pais'),
  ('mexico',   'México',   'pais'),
  ('espana',   'España',   'pais'),

  ('pokerstars', 'PokerStars', 'sala'),
  ('ggpoker',    'GGPoker',    'sala'),
  ('acr',        'ACR',        'sala'),
  ('suprema',    'Suprema',    'sala'),
  ('kkpoker',    'KKPoker',    'sala'),

  ('tier-a', 'Tier A', 'tier'),
  ('tier-b', 'Tier B', 'tier'),
  ('tier-c', 'Tier C', 'tier')
ON CONFLICT (slug) DO NOTHING;
