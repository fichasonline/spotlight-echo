import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Calendar, ExternalLink, ArrowLeft } from "lucide-react";

interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  description: string | null;
  links: any;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
}

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase.from("events").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setEvent(data);
    });
    supabase
      .from("posts")
      .select("id, content, created_at, profiles(display_name)")
      .eq("event_id", id)
      .eq("is_hidden", false)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPosts(data as any);
      });
  }, [id]);

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  const links = Array.isArray(event.links) ? event.links : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/calendario" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver al calendario
        </Link>

        <h1 className="text-3xl font-display font-bold mb-4">{event.name}</h1>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-accent" />
            {format(new Date(event.start_date), "d MMMM yyyy", { locale: es })}
            {event.end_date && ` — ${format(new Date(event.end_date), "d MMMM yyyy", { locale: es })}`}
          </span>
          {(event.venue || event.city) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-accent" />
              {[event.venue, event.city, event.country].filter(Boolean).join(", ")}
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-foreground/90 mb-6 whitespace-pre-wrap">{event.description}</p>
        )}

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {links.map((link: any, i: number) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label || link.url}
              </a>
            ))}
          </div>
        )}

        <h2 className="text-xl font-display font-bold mb-4">Posts del evento</h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay posts para este evento.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-foreground">{p.profiles?.display_name ?? "Usuario"}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "d MMM HH:mm", { locale: es })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{p.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
