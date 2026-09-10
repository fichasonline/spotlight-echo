import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { getArticleImageStyle } from "@/lib/article-image";
import { cn } from "@/lib/utils";

export interface TrendingArticle {
  id: string;
  slug: string;
  headline: string;
  image_url: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
}

/**
 * Carrusel de notas destacadas (las más leídas de la semana).
 *
 * El desplazamiento es scroll nativo con `scroll-snap`, no un carrusel con
 * `transform` e índice: así funciona el arrastre con el dedo y la rueda del
 * mouse sin escribir nada, y el teclado llega a cada tarjeta porque siguen
 * siendo enlaces en el flujo normal.
 */
export function TrendingCarousel({ articles }: { articles: TrendingArticle[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  const scrollByCard = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    const card = track.querySelector("a");
    const step = card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.6;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;

    // Al llegar al final vuelve al principio: el ciclo no se corta solo.
    if (direction === 1 && atEnd) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    track.scrollBy({ left: step * direction, behavior: "smooth" });
  }, []);

  /*
   * Rotación automática. Se frena mientras el cursor está encima o el foco
   * está adentro: que la fila se mueva sola justo cuando alguien intenta
   * hacer clic o está leyendo con el teclado es la forma más rápida de
   * arruinar un carrusel.
   *
   * También respeta `prefers-reduced-motion` — ahí no rota nunca y quedan las
   * flechas y el arrastre.
   */
  useEffect(() => {
    if (paused || articles.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => scrollByCard(1), 4500);
    return () => window.clearInterval(timer);
  }, [paused, articles.length, scrollByCard]);

  if (articles.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/noticias/${article.slug}`}
            className="group relative flex h-[230px] w-[85%] shrink-0 snap-start overflow-hidden rounded-xl sm:w-[48%] lg:h-[260px] lg:w-[32%]"
          >
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">
              {article.image_url ? (
                <img
                  src={article.image_url}
                  alt=""
                  style={getArticleImageStyle(article)}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_14px,hsl(var(--card))_14px_28px)]" />
              )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-brand-violet-deep/95 via-brand-violet-deep/35 to-transparent" />

            <div className="relative mt-auto flex flex-col gap-2 p-5">
              <h3 className="m-0 line-clamp-3 max-w-[20ch] font-display text-[19px] font-bold uppercase leading-h1 tracking-h1 text-brand-light drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                {article.headline}
              </h3>
              <span className="inline-flex items-center gap-1.5 self-start text-[10.5px] font-semibold uppercase leading-caption tracking-caption text-brand-light/70 transition-colors group-hover:text-brand-light">
                Leé la nota completa
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {articles.length > 1 && (
        <>
          <CarouselArrow side="left" onClick={() => scrollByCard(-1)} />
          <CarouselArrow side="right" onClick={() => scrollByCard(1)} />
        </>
      )}
    </div>
  );
}

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Notas anteriores" : "Notas siguientes"}
      className={cn(
        // Sólo desde `sm`: en mobile se arrastra con el dedo y las flechas
        // taparían parte de la tarjeta.
        "absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-light/25 bg-brand-black/60 text-brand-light backdrop-blur-sm transition-colors hover:bg-brand-black/85 sm:flex",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
