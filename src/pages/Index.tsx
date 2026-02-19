import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { motion } from "framer-motion";
import { Calendar, Newspaper, MessageSquare, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  published_at: string | null;
}

interface Event {
  id: string;
  name: string;
  start_date: string;
  city: string | null;
  country: string | null;
  venue: string | null;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [artRes, evtRes, postRes] = await Promise.all([
        supabase
          .from("articles")
          .select("id, slug, headline, summary, published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(6),
        supabase
          .from("events")
          .select("id, name, start_date, city, country, venue")
          .gte("start_date", new Date().toISOString().split("T")[0])
          .order("start_date")
          .limit(5),
        supabase
          .from("posts")
          .select("id, content, created_at, profiles(display_name, avatar_url)")
          .eq("is_hidden", false)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (artRes.data) setArticles(artRes.data);
      if (evtRes.data) setEvents(evtRes.data);
      if (postRes.data) setPosts(postRes.data as any);
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">
              Tu portal de <span className="text-gradient-primary">noticias</span> y{" "}
              <span className="text-gradient-accent">eventos</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Mantente al día con las últimas novedades, calendario de eventos y la comunidad.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16 space-y-16">
        {/* Latest articles */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Newspaper className="h-6 w-6 text-primary" /> Últimas noticias
            </h2>
            <Link to="/noticias" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/noticias/${a.slug}`}
                  className="block bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors group"
                >
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    {a.headline}
                  </h3>
                  {a.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{a.summary}</p>
                  )}
                  {a.published_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(a.published_at), "d MMM yyyy", { locale: es })}
                    </span>
                  )}
                </Link>
              </motion.div>
            ))}
            {articles.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">No hay noticias publicadas aún.</p>
            )}
          </div>
        </section>

        {/* Upcoming events */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-accent" /> Próximos eventos
            </h2>
            <Link to="/calendario" className="text-sm text-accent hover:underline flex items-center gap-1">
              Ver calendario <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {events.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/eventos/${e.id}`}
                  className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 hover:border-accent/40 transition-colors"
                >
                  <div className="flex-shrink-0 w-14 h-14 bg-accent/10 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-xs text-accent font-semibold uppercase">
                      {format(new Date(e.start_date), "MMM", { locale: es })}
                    </span>
                    <span className="text-lg font-bold text-accent">
                      {format(new Date(e.start_date), "d")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{e.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[e.venue, e.city, e.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
            {events.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No hay eventos próximos.</p>
            )}
          </div>
        </section>

        {/* Recent posts */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" /> Comunidad
            </h2>
            <Link to="/feed" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ir al feed <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                    {(p.profiles?.display_name ?? "U")[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{p.profiles?.display_name ?? "Usuario"}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "d MMM HH:mm", { locale: es })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 line-clamp-3">{p.content}</p>
              </div>
            ))}
            {posts.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No hay publicaciones aún.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
