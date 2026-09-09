import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArticleGrid, ARTICLE_CARD_COLUMNS, type ArticleCard } from "@/components/ArticleGrid";
import { ARTICLE_CATEGORIES, categoryFromSlug } from "@/lib/taxonomy";
import { SITE_URL, applySeo, buildAbsoluteUrl } from "@/lib/seo";

const PAGE_SIZE = 12;

/** Bajada de cada sección. Es el texto que ve el lector y también la meta description. */
const DESCRIPTIONS: Record<string, string> = {
  torneos_en_vivo:
    "Cobertura de torneos presenciales: agenda, previas, día a día y mesas finales de los circuitos que se juegan en la región y el mundo.",
  poker_online:
    "Novedades de las salas y plataformas online: series majors, lanzamientos, promociones y regulación por país.",
  resultados:
    "Quién ganó, cuánto y dónde. Campeones, mesas finales y rankings de torneos presenciales y online ya terminados.",
  entrevistas:
    "Conversaciones con jugadores, organizadores y protagonistas de la industria del poker.",
  internacional:
    "Noticias globales del mundo del poker: regulación, negocios de la industria y cultura del juego.",
};

/** El slug llega por prop: cada categoría tiene su ruta estática en App.tsx. */
export default function CategoriaPage({ slug: categoria }: { slug: string }) {
  const category = categoryFromSlug(categoria);

  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const meta = ARTICLE_CATEGORIES.find((entry) => entry.value === category);

  useEffect(() => {
    if (!category || !meta) return;

    applySeo({
      title: `${meta.label} | Fichas News`,
      description: DESCRIPTIONS[category],
      path: `/${meta.slug}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: meta.label,
        description: DESCRIPTIONS[category],
        url: buildAbsoluteUrl(`/${meta.slug}`, SITE_URL),
        inLanguage: "es",
      },
    });
  }, [category, meta]);

  useEffect(() => {
    if (!category) return;

    // Reinicia el listado cuando se navega de una categoría a otra sin desmontar.
    setArticles([]);
    setPage(0);
    setHasMore(true);
    setLoading(true);

    void (async () => {
      const { data } = await (supabase as any)
        .from("articles")
        .select(ARTICLE_CARD_COLUMNS)
        .eq("status", "published")
        .eq("category", category)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      setArticles((data ?? []) as ArticleCard[]);
      setHasMore((data ?? []).length === PAGE_SIZE);
      setLoading(false);
    })();
  }, [category]);

  const loadMore = async () => {
    const next = page + 1;
    const { data } = await (supabase as any)
      .from("articles")
      .select(ARTICLE_CARD_COLUMNS)
      .eq("status", "published")
      .eq("category", category)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(next * PAGE_SIZE, (next + 1) * PAGE_SIZE - 1);

    setArticles((current) => [...current, ...((data ?? []) as ArticleCard[])]);
    setHasMore((data ?? []).length === PAGE_SIZE);
    setPage(next);
  };

  // Slug que no corresponde a ninguna categoría: que lo agarre el 404.
  if (!category || !meta) return <Navigate to="/404" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <nav aria-label="Secciones" className="mb-6 flex flex-wrap gap-2">
          <Link
            to="/noticias"
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Todas
          </Link>
          {ARTICLE_CATEGORIES.map((entry) => (
            <Link
              key={entry.value}
              to={`/${entry.slug}`}
              className={
                entry.value === category
                  ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  : "rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              }
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        <h1 className="font-display text-3xl font-bold">{meta.label}</h1>
        <p className="mb-8 mt-3 max-w-2xl text-muted-foreground">{DESCRIPTIONS[category]}</p>

        {loading ? (
          <p className="py-12 text-center text-muted-foreground">Cargando…</p>
        ) : articles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="font-medium text-foreground">Todavía no hay notas en esta sección.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Estamos clasificando el archivo. Mientras tanto, mirá{" "}
              <Link to="/noticias" className="text-primary hover:underline">
                todas las noticias
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <ArticleGrid articles={articles} hideCategory />
            {hasMore && (
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => void loadMore()}>
                  Cargar más
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
