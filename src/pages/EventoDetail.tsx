import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Calendar, ExternalLink, ArrowLeft } from "lucide-react";
import { parseDateValue } from "@/lib/date";
import {
  SITE_NAME,
  SITE_URL,
  applySeo,
  buildAbsoluteUrl,
  getDefaultSeoConfig,
  stripMarkdown,
  truncateText,
} from "@/lib/seo";

interface Event {
  id: string;
  created_at: string;
  name: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  description: string | null;
  details: string | null;
  hero_image_url: string | null;
  links: unknown;
  gallery: unknown;
  status: string | null;
  buy_in: string | null;
  guaranteed: string | null;
  source_url: string | null;
}

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoaded(false);
    supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("[EventoDetail] event load error:", error);
        setEvent(data);
        setIsLoaded(true);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;

    if (!event && isLoaded) {
      applySeo({
        ...getDefaultSeoConfig(`/eventos/${id}`),
        title: `Evento no encontrado | ${SITE_NAME}`,
        description: "El evento que buscas no está disponible o fue removido.",
        path: `/eventos/${id}`,
        robots: "noindex, nofollow",
      });
      return;
    }

    if (!event) return;

    const canonicalPath = `/eventos/${event.id}`;
    const canonicalUrl = buildAbsoluteUrl(canonicalPath, SITE_URL);
    const description = truncateText(
      event.description ||
        stripMarkdown(event.details) ||
        `${event.name} en ${[event.city, event.country].filter(Boolean).join(", ")}`,
      160,
    );
    const locationName = [event.venue, event.city, event.country].filter(Boolean).join(", ");
    const imageUrls = [event.hero_image_url]
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl));

    applySeo({
      title: `${event.name} | ${SITE_NAME}`,
      description,
      path: canonicalPath,
      imagePath: imageUrls[0],
      imageAlt: event.name,
      modifiedTime: event.end_date || event.start_date || event.created_at,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.name,
          description,
          url: canonicalUrl,
          startDate: event.start_date,
          endDate: event.end_date || event.start_date,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          image: imageUrls.length > 0 ? imageUrls : undefined,
          organizer: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
          },
          location: locationName
            ? {
                "@type": "Place",
                name: event.venue || locationName,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: event.city || undefined,
                  addressCountry: event.country || undefined,
                },
              }
            : undefined,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Inicio",
              item: buildAbsoluteUrl("/", SITE_URL),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Calendario",
              item: buildAbsoluteUrl("/calendario", SITE_URL),
            },
            {
              "@type": "ListItem",
              position: 3,
              name: event.name,
              item: canonicalUrl,
            },
          ],
        },
      ],
    });
  }, [event, id, isLoaded]);

  if (!event && !isLoaded) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-3xl px-4 py-12 text-center">
          <h1 className="mb-3 text-2xl font-display font-bold">Evento no encontrado</h1>
          <p className="mb-6 text-muted-foreground">
            Este evento no está disponible o todavía no fue publicado.
          </p>
          <Link to="/calendario" className="text-primary hover:underline">
            Volver al calendario
          </Link>
        </div>
      </div>
    );
  }

  const links = Array.isArray(event.links)
    ? event.links
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const maybeLink = item as { label?: unknown; url?: unknown };
          const url = typeof maybeLink.url === "string" ? maybeLink.url.trim() : "";
          if (!url) return null;
          const label = typeof maybeLink.label === "string" ? maybeLink.label.trim() : "";
          return { label, url };
        })
        .filter((item): item is { label: string; url: string } => item !== null)
    : [];

  const gallery = Array.isArray(event.gallery)
    ? event.gallery
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const markdownClassName = `
    prose prose-invert prose-base max-w-none
    prose-headings:font-display prose-headings:tracking-tight
    prose-p:leading-7 prose-p:text-foreground/90
    prose-li:leading-7
    prose-a:text-primary hover:prose-a:text-accent
    prose-strong:text-foreground
    prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80
    prose-hr:border-border
  `;

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
            {format(parseDateValue(event.start_date), "d MMMM yyyy", { locale: es })}
            {event.end_date && ` — ${format(parseDateValue(event.end_date), "d MMMM yyyy", { locale: es })}`}
          </span>
          {(event.venue || event.city) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-accent" />
              {[event.venue, event.city, event.country].filter(Boolean).join(", ")}
            </span>
          )}
          {event.buy_in && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              Buy-in: {event.buy_in}
            </span>
          )}
          {event.guaranteed && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              GTD: {event.guaranteed}
            </span>
          )}
        </div>

        {event.hero_image_url && (
          <div className="mb-6 overflow-hidden rounded-xl border border-border">
            <img
              src={event.hero_image_url}
              alt={event.name}
              className="block w-full h-auto"
              loading="lazy"
            />
          </div>
        )}

        {event.description && (
          <div className={`mb-4 ${markdownClassName}`}>
            <ReactMarkdown>{event.description}</ReactMarkdown>
          </div>
        )}

        {event.details && (
          <div className="mb-6">
            <h2 className="text-xl font-display font-bold mb-2">Información del evento</h2>
            <div className={markdownClassName}>
              <ReactMarkdown>{event.details}</ReactMarkdown>
            </div>
          </div>
        )}

        {links.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-display font-bold mb-3">Links útiles</h2>
            <div className="flex flex-wrap gap-2">
              {links.map((link, i) => (
                <a
                  key={`${link.url}-${i}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {link.label || link.url}
                </a>
              ))}
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-semibold"
                >
                  <ExternalLink className="h-3 w-3" />
                  Fuente Oficial
                </a>
              )}
            </div>
          </div>
        )}

        {gallery.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-display font-bold mb-3">Galería</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gallery.map((imageUrl, i) => (
                <div key={`${imageUrl}-${i}`} className="overflow-hidden rounded-lg border border-border bg-card">
                  <img
                    src={imageUrl}
                    alt={`${event.name} - imagen ${i + 1}`}
                    className="w-full h-52 object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {!event.description && !event.details && !event.hero_image_url && links.length === 0 && gallery.length === 0 && !event.source_url && (
          <p className="text-muted-foreground text-sm">Este evento todavía no tiene contenido adicional publicado.</p>
        )}

      </div>
    </div>
  );
}
