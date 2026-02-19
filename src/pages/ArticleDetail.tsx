import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { parseDateValue } from "@/lib/date";

interface Article {
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  published_at: string | null;
  source_name: string | null;
  source_url: string | null;
}

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase.from("articles").select("*").eq("slug", slug).single().then(({ data }) => {
      if (data) setArticle(data);
    });
  }, [slug]);

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <article className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/noticias" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver a noticias
        </Link>

        <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">{article.headline}</h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-8">
          {article.published_at && (
            <span>{format(parseDateValue(article.published_at), "d MMMM yyyy", { locale: es })}</span>
          )}
          {article.source_name && (
            <span className="flex items-center gap-1">
              Fuente: {article.source_url ? (
                <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  {article.source_name} <ExternalLink className="h-3 w-3" />
                </a>
              ) : article.source_name}
            </span>
          )}
        </div>

        {article.summary && (
          <p className="text-lg text-foreground/80 italic border-l-2 border-primary pl-4 mb-8">{article.summary}</p>
        )}

        {article.body_markdown && (
          <div
            className="
              prose prose-invert prose-base max-w-none
              prose-headings:font-display prose-headings:tracking-tight
              prose-p:leading-7 prose-p:text-foreground/90
              prose-li:leading-7
              prose-a:text-primary hover:prose-a:text-accent
              prose-strong:text-foreground
              prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80
              prose-hr:border-border
            "
          >
            <ReactMarkdown>{article.body_markdown}</ReactMarkdown>
          </div>
        )}
      </article>
    </div>
  );
}
