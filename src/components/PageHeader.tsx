import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Encabezado de las páginas de listado del portal (noticias, categoría,
 * etiqueta, calendario, salas).
 *
 * Antes cada una repetía un `text-3xl` con un párrafo debajo, ocupando media
 * pantalla antes de que se viera la primera nota. Acá es una barra de una sola
 * línea: título en el rol H3 del manual (20-22px, 1.25) y la bajada al lado,
 * en caption, separada por un punto.
 *
 * La bajada NO se borra aunque no se vea en pantallas angostas: es el texto que
 * describe la sección para buscadores. Por eso se oculta con `hidden`/`md:` y
 * no con una condición de JS — sigue en el HTML.
 *
 * No sirve para títulos de contenido (el titular de una nota, el nombre de un
 * evento o de una sala): esos son la pieza principal de la página y van
 * grandes.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  /** Bajada de la sección. Se muestra al lado del título desde `md`. */
  description?: ReactNode;
  /** Volanta opcional, arriba del título (por ejemplo el tipo de etiqueta). */
  eyebrow?: ReactNode;
  /** Controles alineados a la derecha. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 border-b border-border pb-3", className)}>
      {eyebrow && (
        <p className="mb-1 text-[11px] font-semibold uppercase leading-caption tracking-caption text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="shrink-0 font-display text-xl font-bold leading-h3 text-foreground">{title}</h1>
          {description && (
            <p className="hidden min-w-0 flex-1 truncate text-[12.5px] leading-caption text-muted-foreground md:block">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
