import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { ADMIN_NAV } from "@/components/admin/nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ícono de la sección según la ruta activa.
 *
 * Se deriva de ADMIN_NAV en lugar de pedírselo a cada pantalla: el sidebar ya
 * define un ícono por ruta, así que repetirlo en el header sería dos fuentes
 * para el mismo dato, listas para quedar distintas.
 *
 * Gana la ruta más larga que matchea, para que /admin/noticias/instagram tome
 * su propio ícono y no el de /admin/noticias. `/admin` sólo matchea exacto —
 * si no, sería prefijo de todas las demás.
 */
function useSectionIcon(): LucideIcon | undefined {
  const { pathname } = useLocation();

  const items = ADMIN_NAV.flatMap((group) => group.items);
  let best: { to: string; icon: LucideIcon } | undefined;

  for (const item of items) {
    const matches = item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`);

    if (matches && (!best || item.to.length > best.to.length)) {
      best = { to: item.to, icon: item.icon };
    }
  }

  return best?.icon;
}

/**
 * Encabezado de sección del panel.
 *
 * Antes cada una de las 16 pantallas se armaba el suyo a mano (`text-3xl` +
 * bajada), así que cambiar el criterio significaba tocar 16 archivos y que
 * quedaran distintos entre sí — de hecho ya lo estaban: unas en `text-3xl`,
 * otras en `text-2xl`, con y sin `font-display`.
 *
 * El tamaño es `text-xl` con `leading-h3`: el rol H3 del manual (20-22px,
 * 1.25), que es lo que corresponde a un título de pantalla de interfaz. El
 * panel es una herramienta de trabajo, no una portada.
 *
 * A propósito no acepta descripción: la bajada explicativa se sacó de todo el
 * panel porque repetía lo que la pantalla ya muestra.
 */
export function AdminPageHeader({
  title,
  actions,
  backTo,
  className,
}: {
  title: ReactNode;
  /** Botones o badges alineados a la derecha, en la misma línea del título. */
  actions?: ReactNode;
  /** Ruta de vuelta: dibuja una flecha a la izquierda del título. */
  backTo?: string;
  className?: string;
}) {
  const Icon = useSectionIcon();

  return (
    <div
      className={cn(
        /*
          `-mt-4` se come parte del `py-8` del contenedor de cada pantalla: el
          título quedaba flotando lejos del navbar. La línea de abajo cierra la
          banda, así el encabezado se lee como barra de sección y no como un
          texto suelto arriba del contenido.
        */
        "-mt-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {backTo && (
          <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8 shrink-0" asChild>
            <Link to={backTo} aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {Icon && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h1 className="truncate font-display text-xl font-bold leading-h3 text-foreground">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
