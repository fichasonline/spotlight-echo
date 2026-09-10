import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArticleGrid, ARTICLE_CARD_COLUMNS, type ArticleCard } from "@/components/ArticleGrid";
import { TAG_TYPES, type Tag } from "@/lib/taxonomy";
import { SITE_URL, applySeo, buildAbsoluteUrl } from "@/lib/seo";

const PAGE_SIZE = 12;

type State = "loading" | "not-found" | "ready";

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();

  const [tag, setTag] = useState<Tag | null>(null);
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [state, setState] = useState<State>("loading");

  const typeLabel = TAG_TYPES.find((entry) => entry.value === tag?.type)?.label;

  /**
   * Dos pasos en vez de un join: PostgREST no filtra la tabla principal por una
   * relación sin una vista, así que primero se resuelven los ids de la etiqueta
   * y después se piden esas notas.
   */
  const fetchPage = async (tagId: string, pageIndex: number) => {
    const db = supabase as any;
    const { data: links } = await db
      .from("article_tags")
      .select("article_id")
      .eq("tag_id", tagId)
      .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

    const ids = ((links ?? []) as { article_id: string }[]).map((row) => row.article_id);
    if (ids.length === 0) return { rows: [] as ArticleCard[], reachedEnd: true };

    const { data } = await db
      .from("articles")
      .select(ARTICLE_CARD_COLUMNS)
      .eq("status", "published")
      .in("id", ids)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    return { rows: (data ?? []) as ArticleCard[], reachedEnd: ids.length < PAGE_SIZE };
  };

  useEffect(() => {
    if (!slug) return;

    setState("loading");
    setArticles([]);
    setPage(0);

    void (async () => {
      const { data: tagRow } = await (supabase as any)
        .from("tags")
        .select("id, slug, name, type")
        .eq("slug", slug)
        .maybeSingle();

      if (!tagRow) {
        setState("not-found");
        // Sin esto la página respondería 200 con el SEO por defecto y Google
        // podría indexar una etiqueta que no existe.
        applySeo({
          title: "Etiqueta no encontrada | Fichas News",
          description: "La etiqueta que buscás no existe.",
          path: `/tag/${slug}`,
          robots: "noindex, nofollow",
        });
        return;
      }

      const found = tagRow as Tag;
      setTag(found);

      const { rows, reachedEnd } = await fetchPage(found.id, 0);
      setArticles(rows);
      setHasMore(!reachedEnd);
      setState("ready");

      const description = `Todas las noticias de Fichas News etiquetadas con ${found.name}.`;
      applySeo({
        title: `${found.name} | Fichas News`,
        description,
        path: `/tag/${found.slug}`,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: found.name,
          description,
          url: buildAbsoluteUrl(`/tag/${found.slug}`, SITE_URL),
          inLanguage: "es",
        },
      });
    })();
  }, [slug]);

  const loadMore = async () => {
    if (!tag) return;
    const next = page + 1;
    const { rows, reachedEnd } = await fetchPage(tag.id, next);
    setArticles((current) => [...current, ...rows]);
    setHasMore(!reachedEnd);
    setPage(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {state === "loading" && <p className="py-12 text-center text-muted-foreground">Cargando…</p>}

        {state === "not-found" && (
          <div className="py-16 text-center">
            <h1 className="font-display text-3xl font-bold">Etiqueta no encontrada</h1>
            <p className="mt-2 text-muted-foreground">
              No existe ninguna etiqueta con ese nombre.{" "}
              <Link to="/noticias" className="text-primary hover:underline">
                Ver todas las noticias
              </Link>
              .
            </p>
          </div>
        )}

        {state === "ready" && tag && (
          <>
            <PageHeader
              eyebrow={typeLabel}
              title={tag.name}
              description={`Noticias etiquetadas con ${tag.name}.`}
            />

            {articles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-16 text-center">
                <p className="font-medium text-foreground">Todavía no hay notas con esta etiqueta.</p>
                <Link to="/noticias" className="mt-1 inline-block text-sm text-primary hover:underline">
                  Ver todas las noticias
                </Link>
              </div>
            ) : (
              <>
                <ArticleGrid articles={articles} />
                {hasMore && (
                  <div className="mt-8 text-center">
                    <Button variant="outline" onClick={() => void loadMore()}>
                      Cargar más
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
