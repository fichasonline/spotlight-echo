import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateValue } from "@/lib/date";
import { getArticleImageStyle } from "@/lib/article-image";
import { categoryLabel, categorySlug } from "@/lib/taxonomy";

export interface ArticleCard {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  created_at: string;
  published_at: string | null;
  image_url: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
  category?: string | null;
}

interface ArticleGridProps {
  articles: ArticleCard[];
  /**
   * Oculta el chip de categoría. Útil dentro de una página de categoría,
   * donde repetirlo en cada card no aporta nada.
   */
  hideCategory?: boolean;
}

/** Grilla de notas compartida por /noticias, las páginas de categoría y las de etiqueta. */
export function ArticleGrid({ articles, hideCategory }: ArticleGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => {
        const slug = categorySlug(article.category);
        return (
          <Link
            key={article.id}
            to={`/noticias/${article.slug}`}
            style={{ "--card-reveal-delay": `${Math.min(index, 9) * 45}ms` } as CSSProperties}
            className="card-reveal group flex touch-manipulation flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40 active:border-primary/45"
          >
            {article.image_url && (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={article.image_url}
                  alt={article.headline}
                  style={getArticleImageStyle(article)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-105"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              {!hideCategory && slug && (
                <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  {categoryLabel(article.category)}
                </span>
              )}
              <h3 className="mb-2 line-clamp-2 font-display font-semibold text-foreground transition-colors group-hover:text-primary group-active:text-primary">
                {article.headline}
              </h3>
              {article.summary && (
                <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
              )}
              <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {format(parseDateValue(article.published_at || article.created_at), "d MMM yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Columnas que necesita ArticleGrid, para no repetir la lista en cada página. */
export const ARTICLE_CARD_COLUMNS =
  "id, slug, headline, summary, created_at, published_at, image_url, image_position_x, image_position_y, category";
