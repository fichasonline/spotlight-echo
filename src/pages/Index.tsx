import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { motion } from "framer-motion";
import { Calendar, Newspaper, MessageSquare, ArrowRight, Instagram, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getLocalDateISO, parseDateValue } from "@/lib/date";

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
  end_date: string | null;
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

interface PostRow {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
}

async function attachPostProfiles(rows: PostRow[]): Promise<Post[]> {
  const authorIds = Array.from(new Set(rows.map((post) => post.author_id)));
  if (authorIds.length === 0) {
    return rows.map(({ author_id: _authorId, ...rest }) => ({ ...rest, profiles: null }));
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", authorIds);

  const profileMap = new Map((data ?? []).map((profile) => [profile.id, profile]));

  return rows.map(({ author_id, ...rest }) => {
    const profile = profileMap.get(author_id);
    return {
      ...rest,
      profiles: profile
        ? {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : null,
    };
  });
}

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const today = getLocalDateISO();
  const instagramUrl = import.meta.env.VITE_INSTAGRAM_URL?.trim() || "https://instagram.com/fichasonlineuy";
  const telegramUrl = import.meta.env.VITE_TELEGRAM_URL?.trim() || "https://t.me/+59891856965";
  const whatsappUrl = import.meta.env.VITE_WHATSAPP_URL?.trim() || "https://wa.me";
  const socialLinks = [
    {
      label: "Instagram",
      href: instagramUrl,
      description: "Fotos, clips y anuncios",
      icon: Instagram,
    },
    {
      label: "Telegram",
      href: telegramUrl,
      description: "Canal de novedades",
      icon: Send,
    },
    {
      label: "WhatsApp",
      href: whatsappUrl,
      description: "Contacto directo (proximamente)",
      icon: MessageSquare,
      disabled: true,
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const today = getLocalDateISO();
      const [artRes, evtRes, postRes] = await Promise.all([
        supabase
          .from("articles")
          .select("id, slug, headline, summary, published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(6),
        supabase
          .from("events")
          .select("id, name, start_date, end_date, city, country, venue")
          .eq("status", "published")
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .order("start_date")
          .limit(5),
        supabase
          .from("posts")
          .select("id, content, created_at, author_id")
          .eq("is_hidden", false)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (artRes.error) console.error("[Index] articles load error:", artRes.error);
      if (evtRes.error) console.error("[Index] events load error:", evtRes.error);
      if (postRes.error) console.error("[Index] posts load error:", postRes.error);
      if (artRes.data) setArticles(artRes.data);
      if (evtRes.data) setEvents(evtRes.data);
      if (postRes.data) setPosts(await attachPostProfiles(postRes.data as PostRow[]));
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative ">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <img
              src="/logo_fichas.png"
              alt="Fichas Online"
              className="mx-auto mb-6 h-14 w-auto object-contain  drop-shadow-[0_0_24px_hsl(273_66%_66%_/_0.35)] md:h-16"
            />
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-4 ">
              Noticias, <span className="text-gradient-primary">eventos</span> y comunidad en un solo lugar
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Todo el ecosistema de Fichas Online en un solo lugar
            </p>
            <SupportChatWidget triggerVariant="hero" />
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
                      {format(parseDateValue(a.published_at), "d MMM yyyy", { locale: es })}
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
              <Calendar className="h-6 w-6 text-accent" /> Eventos en curso y próximos
            </h2>
            <Link to="/calendario" className="text-sm text-accent hover:underline flex items-center gap-1">
              Ver calendario <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {events.map((e, i) => {
              const eventEndDate = e.end_date ?? e.start_date;
              const isLive = e.start_date <= today && eventEndDate >= today;

              return (
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
                        {format(parseDateValue(e.start_date), "MMM", { locale: es })}
                      </span>
                      <span className="text-lg font-bold text-accent">
                        {format(parseDateValue(e.start_date), "d")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{e.name}</h3>
                        {isLive && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                            </span>
                            En vivo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[e.venue, e.city, e.country].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            {events.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No hay eventos en curso ni próximos.</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold">Seguinos en redes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enterate de novedades y eventos en Instagram, Telegram y WhatsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {socialLinks.map((social, i) => {
              const Icon = social.icon;
              const isDisabled = Boolean(social.disabled);
              return (
                <motion.a
                  key={social.label}
                  href={isDisabled ? undefined : social.href}
                  target={isDisabled ? undefined : "_blank"}
                  rel={isDisabled ? undefined : "noreferrer"}
                  aria-label={isDisabled ? `${social.label} deshabilitado` : `Abrir ${social.label}`}
                  aria-disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : undefined}
                  onClick={isDisabled ? (event) => event.preventDefault() : undefined}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={`group flex items-center justify-between bg-card px-4 py-4 transition-colors ${
                    isDisabled ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isDisabled ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{social.label}</p>
                      <p className="text-xs text-muted-foreground">{social.description}</p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 text-muted-foreground ${
                      isDisabled ? "" : "transition-transform group-hover:translate-x-1 group-hover:text-primary"
                    }`}
                  />
                </motion.a>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
