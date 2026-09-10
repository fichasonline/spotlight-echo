import { useEffect, useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { parseDateValue } from "@/lib/date";
import { ArticleComments } from "@/components/ArticleComments";
import { ArticleMarkdown } from "@/components/ArticleMarkdown";
import { ArticleHTML } from "@/components/ArticleHTML";
import { getArticleImageStyle } from "@/lib/article-image";
import { categoryLabel, categorySlug, type Tag } from "@/lib/taxonomy";
import {
  SITE_NAME,
  SITE_URL,
  applySeo,
  buildAbsoluteUrl,
  getDefaultSeoConfig,
  stripMarkdown,
  truncateText,
} from "@/lib/seo";
import { BRAND_LOGO_URL } from "@/lib/brand";

interface Article {
  id: string;
  created_at: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  published_at: string | null;
  image_url: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
  category: string | null;
  source_name: string | null;
  source_url: string | null;
}

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!slug) return;
    setIsLoaded(false);
    (supabase as any)
      .from("articles")
      .select("id, created_at, headline, summary, body_markdown, published_at, image_url, image_position_x, image_position_y, category, source_name, source_url")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }: { data: Article | null }) => {
        setArticle(data);
        setIsLoaded(true);
      });
  }, [slug]);

  // Etiquetas de la nota, en un segundo paso: no bloquean el render del cuerpo.
  useEffect(() => {
    if (!article) {
      setTags([]);
      return;
    }
    void (async () => {
      const { data } = await (supabase as any)
        .from("article_tags")
        .select("tags(id, slug, name, type)")
        .eq("article_id", article.id);
      const rows = ((data ?? []) as { tags: Tag | null }[])
        .map((row) => row.tags)
        .filter((tag): tag is Tag => Boolean(tag));
      setTags(rows);
    })();
  }, [article]);

  /*
   * Registra la lectura para el ranking de "lo más leído".
   *
   * Depende de `article?.id` y no de `article`: el objeto se vuelve a crear en
   * cada fetch aunque sea la misma nota, y con el objeto como dependencia esto
   * dispararía de más y contaría lecturas que no ocurrieron.
   *
   * Falla en silencio a propósito. Un contador que no suma no es motivo para
   * romperle la lectura a nadie ni para llenarle la consola de errores.
   */
  const articleId = article?.id;
  useEffect(() => {
    if (!articleId) return;
    void (supabase as any).rpc("record_article_view", { p_article_id: articleId });
  }, [articleId]);

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
              url: buildAbsoluteUrl(BRAND_LOGO_URL, SITE_URL),
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
              style={getArticleImageStyle(article)}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {categorySlug(article.category) && (
          <Link
            to={`/${categorySlug(article.category)}`}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            {categoryLabel(article.category)}
          </Link>
        )}

        <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-3xl font-display font-bold md:text-4xl">{article.headline}</h1>
          <AdminEditLink to={`/admin/noticias?edit=${article.id}`} label="Editar nota" className="mt-1" />
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{format(parseDateValue(article.published_at || article.created_at), "d MMMM yyyy", { locale: es })}</span>
          {article.source_name && (
            <span>
              Fuente:{" "}
              {article.source_url ? (
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-primary hover:underline"
                >
                  {article.source_name}
                </a>
              ) : (
                article.source_name
              )}
            </span>
          )}
        </div>

        {article.summary && (
          <p className="text-lg text-foreground/80 italic border-l-2 border-primary pl-4 mb-8">{article.summary}</p>
        )}

        {article.body_markdown && (
          article.body_markdown.includes("<") && article.body_markdown.includes(">") ? (
            <ArticleHTML>{article.body_markdown}</ArticleHTML>
          ) : (
            <ArticleMarkdown imageUrlToOmit={article.image_url}>{article.body_markdown}</ArticleMarkdown>
          )
        )}

        {tags.length > 0 && (
          <div className="mt-10 border-t border-border pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Etiquetas
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/tag/${tag.slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <ArticleComments articleId={article.id} />
      </article>
    </div>
  );
}
