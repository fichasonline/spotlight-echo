import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { parseDateValue } from "@/lib/date";

interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  published_at: string | null;
  source_name: string | null;
}

const PAGE_SIZE = 12;

export default function NoticiasPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchArticles = async (p: number) => {
    const { data } = await supabase
      .from("articles")
      .select("id, slug, headline, summary, published_at, source_name")
      .eq("status", "published")
      .order("published_at", { ascending: false })
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
        <h1 className="text-3xl font-display font-bold mb-6">Noticias</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <Link
              key={a.id}
              to={`/noticias/${a.slug}`}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors group"
            >
              <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                {a.headline}
              </h3>
              {a.summary && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{a.summary}</p>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {a.published_at && <span>{format(parseDateValue(a.published_at), "d MMM yyyy", { locale: es })}</span>}
                {a.source_name && <span>· {a.source_name}</span>}
              </div>
            </Link>
          ))}
        </div>

        {articles.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No hay noticias publicadas.</p>
        )}

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
