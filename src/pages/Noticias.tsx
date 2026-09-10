import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArticleGrid, ARTICLE_CARD_COLUMNS, type ArticleCard } from "@/components/ArticleGrid";


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
        <PageHeader
          title={query ? `Resultados para “${query}”` : "Noticias de poker"}
          description={
            query
              ? loading
                ? "Buscando…"
                : articles.length === 0
                  ? "No encontramos notas con ese término."
                  : "Notas que mencionan ese término en el titular o la bajada."
              : "Las últimas noticias del mundo del poker: torneos en vivo, resultados, novedades de salas online como GG Poker, ACR y PokerStars, deals, y toda la actualidad del poker en Uruguay y el mundo."
          }
          /*
            En una búsqueda la salida hacia el listado completo tiene que verse
            siempre, también en mobile — es la forma de deshacer la búsqueda.
            Por eso va como acción y no dentro de la bajada, que se oculta en
            pantallas angostas.
          */
          actions={
            query ? (
              <Link to="/noticias" className="text-[12.5px] leading-caption text-primary hover:underline">
                Ver todas
              </Link>
            ) : undefined
          }
        />

        {/*
          Misma fila duplicada que había en Categoria: la sacamos porque el
          header ya muestra las secciones en todos los anchos, con "Todas"
          incluida y marcando la activa.
        */}
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
