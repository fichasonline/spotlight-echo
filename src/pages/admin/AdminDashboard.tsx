import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { isChatLead, isLandingLead } from "@/lib/support-leads";
import { Newspaper, Calendar, Flag, Users, MessageCircle, ContactRound } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ articles: 0, events: 0, reports: 0, users: 0, chats: 0, leads: 0, chatLeads: 0 });

  useEffect(() => {
    const fetch = async () => {
      const [a, e, r, u, openThreads, allLeads] = await Promise.all([
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
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "Artículos", value: stats.articles, icon: Newspaper, to: "/admin/noticias", color: "text-primary" },
    { label: "Eventos", value: stats.events, icon: Calendar, to: "/admin/eventos", color: "text-accent" },
    { label: "Reportes pendientes", value: stats.reports, icon: Flag, to: "/admin/moderacion", color: "text-destructive" },
    { label: "Chats abiertos", value: stats.chats, icon: MessageCircle, to: "/admin/moderacion", color: "text-primary" },
    { label: "Usuarios", value: stats.users, icon: Users, to: "#", color: "text-muted-foreground" },
    { label: "Leads landing", value: stats.leads, icon: ContactRound, to: "/admin/leads", color: "text-primary" },
    { label: "Leads chat", value: stats.chatLeads, icon: ContactRound, to: "/admin/chat-leads", color: "text-accent" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-8">Panel de administración</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
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
