import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  ContactRound,
  Dice5,
  Flag,
  Image,
  Instagram,
  LayoutDashboard,
  MessageCircle,
  Newspaper,
  Radio,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Sólo para /admin, que si no queda activo en todas las rutas hijas. */
  end?: boolean;
  /** true = alcanza con ser moderador. Por defecto, sólo admin. */
  staff?: boolean;
}

interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/**
 * Las 14 pantallas del panel agrupadas por para qué se entra, en vez de la
 * grilla plana que había antes. El orden dentro de cada grupo va de uso
 * diario a uso ocasional.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Contenido",
    items: [
      { to: "/admin", label: "Resumen", icon: LayoutDashboard, end: true },
      { to: "/admin/noticias", label: "Noticias", icon: Newspaper },
      { to: "/admin/eventos", label: "Calendario", icon: Calendar },
      { to: "/admin/campeones", label: "Campeones", icon: Trophy },
    ],
  },
  {
    title: "Distribución",
    items: [
      { to: "/admin/noticias/instagram", label: "Instagram", icon: Instagram },
      { to: "/admin/stories", label: "Stories", icon: Sparkles },
      { to: "/admin/liveblogs", label: "Liveblogs", icon: Radio },
      { to: "/admin/sorteos", label: "Sorteos", icon: Dice5 },
      { to: "/admin/banners", label: "Banners", icon: Image },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { to: "/admin/moderacion", label: "Moderación", icon: Flag, staff: true },
      { to: "/admin/chat-leads", label: "Chat", icon: MessageCircle },
      { to: "/admin/leads", label: "Leads", icon: ContactRound },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/admin/usuarios", label: "Usuarios y roles", icon: Users },
      { to: "/admin/insights", label: "Insights", icon: BarChart3 },
    ],
  },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function AdminLayout() {
  const { isAdmin } = useAuth();

  // Un moderador entra al panel pero sólo puede abrir Moderación: mostrarle el
  // resto sería ofrecerle links que rebotan contra la guarda de la ruta.
  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => isAdmin || item.staff),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-6 lg:flex lg:gap-8">
        {/* Escritorio: sidebar fijo. Mobile: tira horizontal scrolleable. */}
        <aside className="lg:w-56 lg:shrink-0">
          <nav
            aria-label="Secciones del panel"
            className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 lg:mx-0 lg:sticky lg:top-6 lg:flex-col lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {groups.map((group) => (
              <div key={group.title} className="contents lg:block">
                <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 lg:block">
                  {group.title}
                </p>
                <div className="contents lg:mt-1 lg:block lg:space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={navLinkClass}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
