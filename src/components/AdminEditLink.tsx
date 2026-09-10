import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Atajo para editar la pieza que se está viendo, desde el portal público.
 *
 * Sólo se pinta para admins. Ojo con qué significa eso: es una comodidad de
 * interfaz, NO un control de acceso. Quien conozca la URL del panel puede
 * escribirla igual — lo que realmente protege son las guardas de ruta y las
 * políticas RLS de la base. Esconder el botón no defiende nada, sólo evita
 * mostrarle al lector común un enlace que no puede usar.
 */
export function AdminEditLink({
  to,
  label = "Editar",
  className,
}: {
  /** Ruta del panel que abre el editor de esta pieza. */
  to: string;
  label?: string;
  className?: string;
}) {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  return (
    <Link
      to={to}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-[11.5px] font-bold uppercase leading-caption tracking-caption text-primary transition-colors hover:bg-primary hover:text-primary-foreground",
        className,
      )}
    >
      <Pencil className="h-3 w-3" />
      {label}
    </Link>
  );
}
