import { Link } from "react-router-dom";

export interface BreakingItem {
  slug: string;
  headline: string;
}

/**
 * Franja "Última hora": los titulares más recientes en una sola línea que
 * corre. Es la banda que el diseño pone entre el masthead y el contenido.
 * Con menos de dos titulares no se anima (no habría nada que recorrer).
 */
export function BreakingTicker({ items }: { items: BreakingItem[] }) {
  if (items.length === 0) return null;

  const shouldScroll = items.length > 1;
  const track = shouldScroll ? [...items, ...items] : items;

  return (
    <div className="flex items-center gap-3 overflow-hidden border-b border-border bg-muted/60 px-4 py-2.5 lg:gap-4 lg:px-10">
      <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-bold uppercase leading-caption tracking-caption text-primary">
        Última hora
      </span>

      <div className="group relative min-w-0 flex-1 overflow-hidden">
        <div
          className={
            shouldScroll
              ? "flex w-max items-center gap-8 whitespace-nowrap animate-ticker group-hover:[animation-play-state:paused] motion-reduce:animate-none"
              : "flex items-center gap-8 whitespace-nowrap"
          }
        >
          {track.map((item, i) => (
            <span key={`${item.slug}-${i}`} className="flex items-center gap-8">
              <Link
                to={`/noticias/${item.slug}`}
                className="text-sm font-medium leading-ui text-foreground transition-colors hover:text-primary"
              >
                {item.headline}
              </Link>
              <span aria-hidden="true" className="text-muted-foreground/50">
                •
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
