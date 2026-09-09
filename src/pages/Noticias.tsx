import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArticleGrid, ARTICLE_CARD_COLUMNS, type ArticleCard } from "@/components/ArticleGrid";
import { ARTICLE_CATEGORIES } from "@/lib/taxonomy";


const PAGE_SIZE = 12;

export default function NoticiasPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchArticles = async (p: number) => {
    setLoading(true);
    let request = (supabase as any)
      .from("articles")
      .select(ARTICLE_CARD_COLUMNS)
      .eq("status", "published");

    // El buscador del masthead llega acá como ?q=. Busca en titular y bajada,
    // que es lo único indexable que trae la card.
    if (query) {
      const escaped = query.replace(/[%,]/g, " ");
      request = request.or(`headline.ilike.%${escaped}%,summary.ilike.%${escaped}%`);
    }

    const { data } = await request
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);
    if (data) {
      if (p === 0) setArticles(data as ArticleCard[]);
      else setArticles((prev) => [...prev, ...(data as ArticleCard[])]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(0);
    fetchArticles(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-3">
          {query ? `Resultados para “${query}”` : "Noticias de poker"}
        </h1>
        {query ? (
          <p className="text-muted-foreground max-w-2xl mb-6">
            {loading
              ? "Buscando…"
              : articles.length === 0
                ? "No encontramos notas con ese término."
                : "Notas que mencionan ese término en el titular o la bajada."}{" "}
            <Link to="/noticias" className="text-primary hover:underline">
              Ver todas las noticias
            </Link>
          </p>
        ) : (
          <p className="text-muted-foreground max-w-2xl mb-6">
            Las últimas noticias del mundo del poker: torneos en vivo, resultados, novedades de salas online
            como GG Poker, ACR y PokerStars, deals, y toda la actualidad del poker en Uruguay y el mundo.
          </p>
        )}

        <nav aria-label="Secciones" className="mb-8 flex flex-wrap gap-2">
          <span className="rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            Todas
          </span>
          {ARTICLE_CATEGORIES.map((category) => (
            <Link
              key={category.value}
              to={`/${category.slug}`}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {category.label}
            </Link>
          ))}
        </nav>

        <ArticleGrid articles={articles} />

        {hasMore && articles.length > 0 && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => { const next = page + 1; setPage(next); fetchArticles(next); }}>
              Cargar más
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
