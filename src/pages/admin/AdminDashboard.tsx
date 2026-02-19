import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Newspaper, Calendar, Flag, Users } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ articles: 0, events: 0, reports: 0, users: 0 });

  useEffect(() => {
    const fetch = async () => {
      const [a, e, r, u] = await Promise.all([
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        articles: a.count ?? 0,
        events: e.count ?? 0,
        reports: r.count ?? 0,
        users: u.count ?? 0,
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "Artículos", value: stats.articles, icon: Newspaper, to: "/admin/noticias", color: "text-primary" },
    { label: "Eventos", value: stats.events, icon: Calendar, to: "/admin/eventos", color: "text-accent" },
    { label: "Reportes pendientes", value: stats.reports, icon: Flag, to: "/admin/moderacion", color: "text-destructive" },
    { label: "Usuarios", value: stats.users, icon: Users, to: "#", color: "text-muted-foreground" },
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
