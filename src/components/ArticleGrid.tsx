import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
  /**
   * Etiquetas de la nota. Hoy ninguna de las queries del listado las trae
   * (ver ARTICLE_CARD_COLUMNS), así que llega vacío y sólo se pinta el pin de
   * categoría. Está acá para que sumarlas sea cambiar la query y nada más.
   */
  tags?: { name: string; slug?: string | null }[] | null;
}

interface ArticleGridProps {
  articles: ArticleCard[];
  /**
   * Oculta el pin de categoría. Útil dentro de una página de categoría,
   * donde repetirlo en cada card no aporta nada.
   */
  hideCategory?: boolean;
}

/** Pin sobre la foto. Lleva su propio fondo translúcido porque va sobre imagen. */
function Pin({ children, solid = false }: { children: React.ReactNode; solid?: boolean }) {
  return (
    <span
      className={
        solid
          ? "rounded-full bg-primary px-2.5 py-1 text-[10.5px] font-bold uppercase leading-caption tracking-caption text-primary-foreground shadow-sm"
          : "rounded-full border border-brand-light/25 bg-brand-black/55 px-2.5 py-1 text-[10.5px] font-bold uppercase leading-caption tracking-caption text-brand-light backdrop-blur-sm"
      }
    >
      {children}
    </span>
  );
}

/** Grilla de notas compartida por /noticias, las páginas de categoría y las de etiqueta. */
export function ArticleGrid({ articles, hideCategory }: ArticleGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => {
        const slug = categorySlug(article.category);
        const tags = article.tags ?? [];

        return (
          <Link
            key={article.id}
            to={`/noticias/${article.slug}`}
            style={{ "--card-reveal-delay": `${Math.min(index, 9) * 45}ms` } as CSSProperties}
            className="card-reveal group flex touch-manipulation flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40 active:border-primary/45"
          >
            {/*
              El titular va sobre la foto, así que la foto deja de ser
              decoración y pasa a ser el fondo del título: necesita más alto
              que el 16/9 anterior y un degradé que garantice contraste sin
              depender de cómo sea la imagen.
            */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
              {article.image_url ? (
                <img
                  src={article.image_url}
                  alt=""
                  style={getArticleImageStyle(article)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-105"
                />
              ) : (
                <div className="h-full w-full bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_14px,hsl(var(--card))_14px_28px)]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

              {(tags.length > 0 || (!hideCategory && slug)) && (
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pr-3">
                  {!hideCategory && slug && <Pin solid>{categoryLabel(article.category)}</Pin>}
                  {tags.slice(0, 2).map((tag) => (
                    <Pin key={tag.slug ?? tag.name}>{tag.name}</Pin>
                  ))}
                </div>
              )}

              {/*
                El posicionamiento va en el contenedor y el recorte en el h3,
                separados a propósito: `position: absolute` blockifica el
                `display: -webkit-box` del que depende `line-clamp`, así que un
                h3 absoluto con line-clamp no recorta nada y el titular se
                desborda de la foto. Con el h3 en flujo normal, funciona.
              */}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="line-clamp-3 font-display text-[22px] font-bold uppercase leading-h1 tracking-h1 text-brand-light lg:text-[25px]">
                  {article.headline}
                </h3>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              {article.summary && (
                <p className="line-clamp-2 text-[13px] leading-none text-muted-foreground">{article.summary}</p>
              )}

              <div className="mt-auto flex items-center justify-between gap-3">
                <time className="text-[11.5px] leading-caption text-muted-foreground">
                  {format(parseDateValue(article.published_at || article.created_at), "d MMM yyyy", {
                    locale: es,
                  })}
                </time>

                {/*
                  Va como <span> y no como <Link>: la card entera ya es un
                  enlace, y un enlace dentro de otro es HTML inválido — el
                  navegador rompe el anidado y la card deja de ser clickeable
                  entera. Visualmente es un botón; funcionalmente es la card.
                */}
                <span className="inline-flex shrink-0 items-center gap-1 text-[9.5px] font-semibold uppercase leading-caption tracking-caption text-muted-foreground transition-colors group-hover:text-primary">
                  Leé la nota completa
                  <ArrowRight className="h-2.5 w-2.5" />
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
