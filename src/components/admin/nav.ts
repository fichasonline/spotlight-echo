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
  Tags,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Sólo para /admin, que si no queda activo en todas las rutas hijas. */
  end?: boolean;
  /** true = alcanza con ser moderador. Por defecto, sólo admin. */
  staff?: boolean;
}

export interface AdminNavGroup {
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
      { to: "/admin/taxonomia", label: "Categorías y etiquetas", icon: Tags },
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
