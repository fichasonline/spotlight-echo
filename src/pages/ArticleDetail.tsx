import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { parseDateValue } from "@/lib/date";
import { ArticleComments } from "@/components/ArticleComments";
import {
  SITE_NAME,
  SITE_URL,
  applySeo,
  buildAbsoluteUrl,
  getDefaultSeoConfig,
  stripMarkdown,
  truncateText,
} from "@/lib/seo";

interface Article {
  id: string;
  created_at: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  published_at: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
}

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setIsLoaded(false);
    supabase
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        setArticle(data);
        setIsLoaded(true);
      });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    if (!article && isLoaded) {
      applySeo({
        ...getDefaultSeoConfig(`/noticias/${slug}`),
        title: `Artículo no encontrado | ${SITE_NAME}`,
        description: "La noticia que buscas no está disponible o fue removida.",
        path: `/noticias/${slug}`,
        robots: "noindex, nofollow",
      });
      return;
    }

    if (!article) return;

    const canonicalPath = `/noticias/${slug}`;
    const canonicalUrl = buildAbsoluteUrl(canonicalPath, SITE_URL);
    const description = truncateText(
      article.summary || stripMarkdown(article.body_markdown) || `Lee esta noticia en ${SITE_NAME}.`,
      160,
    );
    const publishedTime = article.published_at || article.created_at;

    applySeo({
      title: `${article.headline} | ${SITE_NAME}`,
      description,
      path: canonicalPath,
      imagePath: article.image_url,
      imageAlt: article.headline,
      ogType: "article",
      publishedTime,
      modifiedTime: publishedTime,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: article.headline,
          description,
          url: canonicalUrl,
          mainEntityOfPage: canonicalUrl,
          inLanguage: "es",
          datePublished: publishedTime,
          dateModified: publishedTime,
          image: article.image_url ? [article.image_url] : undefined,
          author: {
            "@type": "Organization",
            name: SITE_NAME,
          },
          publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            logo: {
              "@type": "ImageObject",
              url: buildAbsoluteUrl("/logo_fichas.png", SITE_URL),
            },
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Inicio",
              item: buildAbsoluteUrl("/", SITE_URL),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Noticias",
              item: buildAbsoluteUrl("/noticias", SITE_URL),
            },
            {
              "@type": "ListItem",
              position: 3,
              name: article.headline,
              item: canonicalUrl,
            },
          ],
        },
      ],
    });
  }, [article, isLoaded, slug]);

  if (!article && !isLoaded) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-3xl px-4 py-12 text-center">
          <h1 className="mb-3 text-2xl font-display font-bold">Noticia no encontrada</h1>
          <p className="mb-6 text-muted-foreground">
            Este artículo no está disponible o todavía no fue publicado.
          </p>
          <Link to="/noticias" className="text-primary hover:underline">
            Volver a noticias
          </Link>
        </div>
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

        {article.image_url && (
          <div className="w-full aspect-[21/9] md:aspect-[21/8] overflow-hidden rounded-lg mb-6">
            <img
              src={article.image_url}
              alt={article.headline}
              className="w-full h-full object-cover"
            />
          </div>
        )}

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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.image_url
                ? article.body_markdown.replace(
                    new RegExp(`!\\[[^\\]]*\\]\\(${article.image_url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g"),
                    "",
                  )
                : article.body_markdown}
            </ReactMarkdown>
          </div>
        )}

        <ArticleComments articleId={article.id} />
      </article>
    </div>
  );
}
