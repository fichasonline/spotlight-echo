/**
 * Taxonomía del portal — fuente única de verdad para categorías y etiquetas.
 *
 * Los `value` coinciden exactamente con el enum `article_category` de Postgres
 * (migración 20260909120000). Los `slug` son los de la URL pública.
 */

export const ARTICLE_CATEGORIES = [
  { value: "torneos_en_vivo", label: "Torneos en Vivo", slug: "torneos-en-vivo" },
  { value: "poker_online", label: "Póker Online", slug: "poker-online" },
  { value: "resultados", label: "Resultados", slug: "resultados" },
  { value: "entrevistas", label: "Entrevistas", slug: "entrevistas" },
  { value: "internacional", label: "Internacional", slug: "internacional" },
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]["value"];

type CategoryEntry = (typeof ARTICLE_CATEGORIES)[number];

const BY_VALUE = new Map<string, CategoryEntry>(ARTICLE_CATEGORIES.map((c) => [c.value, c]));
const BY_SLUG = new Map<string, CategoryEntry>(ARTICLE_CATEGORIES.map((c) => [c.slug, c]));

/** Etiqueta legible de una categoría. Las notas sin clasificar caen en "Sin categoría". */
export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Sin categoría";
  return BY_VALUE.get(value)?.label ?? value;
}

/** Slug público de una categoría, para armar URLs. */
export function categorySlug(value: string | null | undefined): string | null {
  if (!value) return null;
  return BY_VALUE.get(value)?.slug ?? null;
}

/** Resuelve el slug de una URL a su valor de enum. Devuelve null si no existe. */
export function categoryFromSlug(slug: string | null | undefined): ArticleCategory | null {
  if (!slug) return null;
  return BY_SLUG.get(slug)?.value ?? null;
}

/** Tipos de etiqueta cruzada — coinciden con el enum `tag_type` de Postgres. */
export const TAG_TYPES = [
  { value: "circuito", label: "Circuito" },
  { value: "pais", label: "País" },
  { value: "region", label: "Región" },
  { value: "sala", label: "Sala" },
  { value: "tier", label: "Tier" },
] as const;

export type TagType = (typeof TAG_TYPES)[number]["value"];

export interface Tag {
  id: string;
  slug: string;
  name: string;
  type: TagType;
}
