import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { isChatLead, isLandingLead } from "@/lib/support-leads";
import { Newspaper, Calendar, Flag, Users, MessageCircle, ContactRound, Image, Instagram, Radio, Sparkles, Dice5 } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    articles: 0,
    events: 0,
    reports: 0,
    users: 0,
    chats: 0,
    leads: 0,
    chatLeads: 0,
    instagramPending: 0,
    liveblogs: 0,
    storiesPending: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const [a, e, r, u, openThreads, allLeads, instagramPending, liveblogs, storiesPending] = await Promise.all([
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        (supabase as any)
          .from("support_threads")
          .select("id, lead_id")
          .eq("status", "open"),
        (supabase as any)
          .from("support_leads")
          .select("id, source"),
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .eq("instagram_selected", true)
          .eq("instagram_published", false),
        (supabase as any)
          .from("social_sources")
          .select("id", { count: "exact", head: true }),
        (supabase as any)
          .from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("format", "story")
          .in("status", ["needs_approval", "draft"]),
      ]);

      const openLeadIds = new Set(
        ((openThreads.data ?? []) as { lead_id: string | null }[])
          .map((thread) => thread.lead_id)
          .filter((leadId): leadId is string => Boolean(leadId)),
      );

      setStats({
        articles: a.count ?? 0,
        events: e.count ?? 0,
        reports: r.count ?? 0,
        users: u.count ?? 0,
        chats: openThreads.count ?? openThreads.data?.length ?? 0,
        chatLeads: ((allLeads.data ?? []) as { id: string; source: string | null }[])
          .filter((lead) => isChatLead(lead))
          .length,
        leads: ((allLeads.data ?? []) as { id: string; source: string | null }[])
          .filter((lead) => isLandingLead(lead) && !openLeadIds.has(lead.id))
          .length,
        instagramPending: instagramPending.count ?? 0,
        liveblogs: liveblogs.count ?? 0,
        storiesPending: storiesPending.count ?? 0,
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "Artículos", value: stats.articles, icon: Newspaper, to: "/admin/noticias", color: "text-primary" },
    { label: "Eventos", value: stats.events, icon: Calendar, to: "/admin/eventos", color: "text-accent" },
    { label: "Reportes pendientes", value: stats.reports, icon: Flag, to: "/admin/moderacion", color: "text-destructive" },
    { label: "Chats abiertos", value: stats.chats, icon: MessageCircle, to: "/admin/moderacion", color: "text-primary" },
    { label: "Usuarios", value: stats.users, icon: Users, to: "/admin/usuarios", color: "text-muted-foreground" },
    { label: "Leads landing", value: stats.leads, icon: ContactRound, to: "/admin/leads", color: "text-primary" },
    { label: "Leads chat", value: stats.chatLeads, icon: ContactRound, to: "/admin/chat-leads", color: "text-accent" },
    { label: "IG noticias", value: stats.instagramPending, icon: Instagram, to: "/admin/noticias/instagram", color: "text-primary" },
    { label: "Liveblogs", value: stats.liveblogs, icon: Radio, to: "/admin/liveblogs", color: "text-accent" },
    { label: "Stories en cola", value: stats.storiesPending, icon: Sparkles, to: "/admin/stories", color: "text-primary" },
    { label: "Sorteos IG", value: "IG", icon: Dice5, to: "/admin/sorteos", color: "text-accent" },
    { label: "Banners home", value: 4, icon: Image, to: "/admin/banners", color: "text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-8">Panel de administración</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/30 transition-colors"
            >
              <c.icon className={`h-8 w-8 ${c.color} mb-3`} />
              <p className="text-3xl font-display font-bold text-foreground">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
