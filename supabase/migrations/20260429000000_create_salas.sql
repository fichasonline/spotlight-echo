create table if not exists public.salas (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  type        text not null default 'online' check (type in ('online', 'live', 'ambas')),
  status      text not null default 'draft' check (status in ('draft', 'published')),

  -- SEO fields (Junior fills these)
  seo_title        text,          -- override title tag, max 60 chars
  seo_description  text,          -- override meta description, max 160 chars
  short_description text not null, -- tagline shown in cards, max 120 chars

  -- Content (Junior generates markdown)
  body_markdown     text,          -- full page content

  -- Media
  logo_url          text,
  featured_image_url text,         -- og:image, 1200x630 recommended

  -- Links
  website_url       text,
  affiliate_url     text,          -- link with affiliate code for CTAs
  app_ios_url       text,
  app_android_url   text,

  -- Deal (Junior updates regularly)
  deal_headline     text,          -- e.g. "60% Rakeback + $600 bono"
  deal_description  text,          -- markdown, can include promo codes
  deal_updated_at   timestamptz,

  -- Ratings (0-10, Junior can set based on research)
  rating_overall    numeric(3,1) check (rating_overall between 0 and 10),
  rating_software   numeric(3,1) check (rating_software between 0 and 10),
  rating_traffic    numeric(3,1) check (rating_traffic between 0 and 10),
  rating_bonuses    numeric(3,1) check (rating_bonuses between 0 and 10),

  -- FAQ (Junior generates as JSONB array)
  -- format: [{"question": "...", "answer": "..."}, ...]
  faq               jsonb default '[]'::jsonb,

  -- Metadata
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_sala_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger salas_set_updated_at
  before update on public.salas
  for each row execute function public.set_sala_updated_at();

-- Public read for published salas
alter table public.salas enable row level security;

create policy "salas_public_read"
  on public.salas for select
  using (status = 'published');

create policy "salas_service_all"
  on public.salas for all
  using (auth.role() = 'service_role');

-- Indexes
create index salas_slug_idx on public.salas (slug);
create index salas_status_idx on public.salas (status);
create index salas_type_idx on public.salas (type);
