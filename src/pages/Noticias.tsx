import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { parseDateValue } from "@/lib/date";
import { getArticleImageStyle } from "@/lib/article-image";

interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  created_at: string;
  published_at: string | null;
  image_url: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
}

const PAGE_SIZE = 12;

export default function NoticiasPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchArticles = async (p: number) => {
    const { data } = await supabase
      .from("articles")
      .select("id, slug, headline, summary, created_at, published_at, image_url, image_position_x, image_position_y")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);
    if (data) {
      if (p === 0) setArticles(data);
      else setArticles((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
  };

  useEffect(() => {
    fetchArticles(0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-3">Noticias de poker</h1>
        <p className="text-muted-foreground max-w-2xl mb-6">
          Las últimas noticias del mundo del poker: torneos en vivo, resultados, novedades de salas online
          como GG Poker, ACR y PokerStars, deals, y toda la actualidad del poker en Uruguay y el mundo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a, index) => (
            <Link
              key={a.id}
              to={`/noticias/${a.slug}`}
              style={{ "--card-reveal-delay": `${Math.min(index, 9) * 45}ms` } as CSSProperties}
              className="card-reveal touch-manipulation bg-card border border-border rounded-lg overflow-hidden transition-colors group flex flex-col hover:border-primary/40 active:border-primary/45"
            >
              {a.image_url && (
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={a.image_url}
                    alt={a.headline}
                    style={getArticleImageStyle(a)}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-105"
                  />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-display font-semibold text-foreground transition-colors line-clamp-2 mb-2 group-hover:text-primary group-active:text-primary">
                  {a.headline}
                </h3>
                {a.summary && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{a.summary}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto">
                  <span>{format(parseDateValue(a.published_at || a.created_at), "d MMM yyyy", { locale: es })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

     

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
