import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isChatLead, isLandingLead } from "@/lib/support-leads";
import {
  Calendar,
  ContactRound,
  Flag,
  Image,
  Inbox,
  Instagram,
  MessageCircle,
  Newspaper,
  Radio,
  Sparkles,
  Tags,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

interface Stats {
  needsReview: number;
  uncategorized: number;
  reports: number;
  openChats: number;
  publishedToday: number;
  upcomingEvents: number;
  instagramPending: number;
  storiesPending: number;
  liveblogs: number;
  activeBanners: number;
  champions: number;
  users: number;
  leads: number;
  chatLeads: number;
}

const EMPTY_STATS: Stats = {
  needsReview: 0,
  uncategorized: 0,
  reports: 0,
  openChats: 0,
  publishedToday: 0,
  upcomingEvents: 0,
  instagramPending: 0,
  storiesPending: 0,
  liveblogs: 0,
  activeBanners: 0,
  champions: 0,
  users: 0,
  leads: 0,
  chatLeads: 0,
};

/** Inicio del día de hoy en ISO, para contar lo publicado en la jornada. */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = startOfToday();
      const db = supabase as any;
      const count = (query: any) => query.select("id", { count: "exact", head: true });

      const [
        needsReview,
        uncategorized,
        reports,
        openThreads,
        publishedToday,
        upcomingEvents,
        instagramPending,
        storiesPending,
        liveblogs,
        activeBanners,
        champions,
        users,
        allLeads,
      ] = await Promise.all([
        count(db.from("articles")).neq("status", "published"),
        count(db.from("articles")).is("category", null),
        count(db.from("reports")).eq("status", "pending"),
        db.from("support_threads").select("id, lead_id").eq("status", "open"),
        count(db.from("articles")).eq("status", "published").gte("published_at", today),
        count(db.from("events")).gte("start_date", today.slice(0, 10)),
        count(db.from("articles"))
          .eq("status", "published")
          .eq("instagram_selected", true)
          .eq("instagram_published", false),
        count(db.from("social_posts")).eq("format", "story").in("status", ["needs_approval", "draft"]),
        count(db.from("social_sources")),
        count(db.from("home_banners")).eq("is_active", true),
        count(db.from("champions")),
        count(db.from("profiles")),
        db.from("support_leads").select("id, source"),
      ]);

      const openLeadIds = new Set(
        ((openThreads.data ?? []) as { lead_id: string | null }[])
          .map((thread) => thread.lead_id)
          .filter((leadId): leadId is string => Boolean(leadId)),
      );
      const leadRows = (allLeads.data ?? []) as { id: string; source: string | null }[];

      setStats({
        needsReview: needsReview.count ?? 0,
        uncategorized: uncategorized.count ?? 0,
        reports: reports.count ?? 0,
        openChats: openThreads.data?.length ?? 0,
        publishedToday: publishedToday.count ?? 0,
        upcomingEvents: upcomingEvents.count ?? 0,
        instagramPending: instagramPending.count ?? 0,
        storiesPending: storiesPending.count ?? 0,
        liveblogs: liveblogs.count ?? 0,
        activeBanners: activeBanners.count ?? 0,
        champions: champions.count ?? 0,
        users: users.count ?? 0,
        leads: leadRows.filter((lead) => isLandingLead(lead) && !openLeadIds.has(lead.id)).length,
        chatLeads: leadRows.filter((lead) => isChatLead(lead)).length,
      });
      setLoading(false);
    };

    void load();
  }, []);

  /** Lo que pide acción hoy. Si está en cero, deja de gritar. */
  const pending: { label: string; value: number; hint: string; icon: LucideIcon; to: string }[] = [
    {
      label: "Notas por revisar",
      value: stats.needsReview,
      hint: "Borradores esperando aprobación",
      icon: Inbox,
      to: "/admin/noticias",
    },
    {
      label: "Sin categoría",
      value: stats.uncategorized,
      hint: "No aparecen en las páginas de sección",
      icon: Tags,
      to: "/admin/noticias",
    },
    {
      label: "Reportes",
      value: stats.reports,
      hint: "Contenido reportado sin resolver",
      icon: Flag,
      to: "/admin/moderacion",
    },
    {
      label: "Chats abiertos",
      value: stats.openChats,
      hint: "Conversaciones sin cerrar",
      icon: MessageCircle,
      to: "/admin/chat-leads",
    },
  ];

  const secondary: { label: string; value: number; icon: LucideIcon; to: string }[] = [
    { label: "Publicadas hoy", value: stats.publishedToday, icon: Newspaper, to: "/admin/noticias" },
    { label: "Próximos torneos", value: stats.upcomingEvents, icon: Calendar, to: "/admin/eventos" },
    { label: "IG pendientes", value: stats.instagramPending, icon: Instagram, to: "/admin/noticias/instagram" },
    { label: "Stories en cola", value: stats.storiesPending, icon: Sparkles, to: "/admin/stories" },
    { label: "Liveblogs", value: stats.liveblogs, icon: Radio, to: "/admin/liveblogs" },
    { label: "Banners activos", value: stats.activeBanners, icon: Image, to: "/admin/banners" },
    { label: "Campeones", value: stats.champions, icon: Trophy, to: "/admin/campeones" },
    { label: "Leads landing", value: stats.leads, icon: ContactRound, to: "/admin/leads" },
    { label: "Leads chat", value: stats.chatLeads, icon: ContactRound, to: "/admin/chat-leads" },
    { label: "Usuarios", value: stats.users, icon: Users, to: "/admin/usuarios" },
  ];

  return (
    <>
      <AdminPageHeader title="Resumen" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pending.map((card) => {
          const needsAttention = card.value > 0;
          return (
            <Link
              key={card.label}
              to={card.to}
              className={
                needsAttention
                  ? "rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:border-primary/50"
                  : "rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              }
            >
              <card.icon
                className={`mb-3 h-6 w-6 ${needsAttention ? "text-primary" : "text-muted-foreground"}`}
              />
              <p
                className={`font-display text-4xl font-bold ${
                  needsAttention ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {card.value}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{card.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{card.hint}</p>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        El resto del panel
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {secondary.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30"
          >
            <card.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-none text-foreground">{card.value}</p>
              <p className="truncate text-xs text-muted-foreground">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
