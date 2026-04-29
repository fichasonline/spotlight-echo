import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Star, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SALA_TYPE_LABEL, type Sala } from "@/lib/salas";
import {
  SITE_NAME,
  SITE_URL,
  applySeo,
  buildAbsoluteUrl,
  getDefaultSeoConfig,
  truncateText,
  stripMarkdown,
} from "@/lib/seo";

const DEFAULT_OG = "/og-cover-1200x630.png?v=2";

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left py-4 flex items-center justify-between gap-3 font-medium hover:text-primary transition-colors"
      >
        {q}
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  );
}

export default function SalaDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [sala, setSala] = useState<Sala | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("salas")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        setSala(data as Sala | null);
        setIsLoaded(true);
      });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    if (!sala && isLoaded) {
      applySeo({
        ...getDefaultSeoConfig(`/salas/${slug}`),
        title: `Sala no encontrada | ${SITE_NAME}`,
        description: "La sala que buscás no está disponible.",
        robots: "noindex, nofollow",
      });
      return;
    }

    if (!sala) return;

    const canonicalPath = `/salas/${sala.slug}`;
    const canonicalUrl = buildAbsoluteUrl(canonicalPath, SITE_URL);
    const title = sala.seo_title || `${sala.name} Uruguay — Review, deals y bonos | ${SITE_NAME}`;
    const description = truncateText(
      sala.seo_description ||
        sala.short_description ||
        stripMarkdown(sala.body_markdown) ||
        `Todo sobre ${sala.name} para jugadores uruguayos: bonos, rakeback, torneos y más.`,
      160,
    );
    const imageUrl = sala.featured_image_url || DEFAULT_OG;

    const faqStructuredData =
      sala.faq?.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: sala.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }
        : undefined;

    applySeo({
      title,
      description,
      path: canonicalPath,
      imagePath: imageUrl,
      imageAlt: sala.name,
      modifiedTime: sala.updated_at,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "Review",
          name: title,
          description,
          url: canonicalUrl,
          inLanguage: "es",
          itemReviewed: {
            "@type": "SoftwareApplication",
            name: sala.name,
            applicationCategory: "GameApplication",
            url: sala.website_url || undefined,
          },
          reviewRating: sala.rating_overall
            ? {
                "@type": "Rating",
                ratingValue: sala.rating_overall,
                bestRating: 10,
                worstRating: 0,
              }
            : undefined,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        },
        ...(faqStructuredData ? [faqStructuredData] : []),
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: buildAbsoluteUrl("/", SITE_URL) },
            { "@type": "ListItem", position: 2, name: "Salas", item: buildAbsoluteUrl("/salas", SITE_URL) },
            { "@type": "ListItem", position: 3, name: sala.name, item: canonicalUrl },
          ],
        },
      ],
    });
  }, [sala, isLoaded, slug]);

  if (!isLoaded) return <div className="min-h-screen bg-background"><Navbar /></div>;

  if (!sala) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Sala no encontrada.</p>
          <Link to="/salas" className="text-primary underline mt-4 inline-block">Ver todas las salas</Link>
        </div>
      </div>
    );
  }

  const ctaUrl = sala.affiliate_url || sala.website_url;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">

        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
          <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
          <span>/</span>
          <Link to="/salas" className="hover:text-foreground transition-colors">Salas</Link>
          <span>/</span>
          <span className="text-foreground">{sala.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          {sala.logo_url && (
            <img src={sala.logo_url} alt={sala.name} className="h-16 w-16 object-contain rounded-lg border border-border" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-display font-bold">{sala.name}</h1>
              <span className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5">{SALA_TYPE_LABEL[sala.type]}</span>
            </div>
            <p className="text-muted-foreground mt-1">{sala.short_description}</p>
          </div>
        </div>

        {/* Deal banner */}
        {sala.deal_headline && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-0.5">Deal actual</p>
              <p className="font-bold text-lg">{sala.deal_headline}</p>
            </div>
            {ctaUrl && (
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer sponsored">
                <Button size="sm" className="gap-1.5 shrink-0">
                  Obtener deal <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        )}

        {/* Ratings */}
        {sala.rating_overall != null && (
          <div className="bg-card border border-border rounded-lg p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1 text-2xl font-bold text-yellow-500">
                <Star className="h-5 w-5 fill-yellow-500" />
                {sala.rating_overall.toFixed(1)}
              </div>
              <span className="text-sm text-muted-foreground">/ 10 — Puntuación general</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <RatingBar label="Software" value={sala.rating_software} />
              <RatingBar label="Tráfico" value={sala.rating_traffic} />
              <RatingBar label="Bonos" value={sala.rating_bonuses} />
            </div>
          </div>
        )}

        {/* Body content */}
        {sala.body_markdown && (
          <div className="prose prose-invert prose-sm max-w-none mb-8">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{sala.body_markdown}</ReactMarkdown>
          </div>
        )}

        {/* FAQ */}
        {sala.faq?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-display font-bold mb-4">Preguntas frecuentes</h2>
            <div className="bg-card border border-border rounded-lg px-5">
              {sala.faq.map((item, i) => (
                <FaqItem key={i} q={item.question} a={item.answer} />
              ))}
            </div>
          </div>
        )}

        {/* CTA footer */}
        {ctaUrl && (
          <div className="text-center py-6 border-t border-border">
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer sponsored">
              <Button size="lg" className="gap-2">
                Ir a {sala.name} <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
