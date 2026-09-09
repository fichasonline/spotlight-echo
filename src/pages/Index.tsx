import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { HomeSplashScreen } from "@/components/HomeSplashScreen";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { BreakingTicker } from "@/components/BreakingTicker";
import { CryptoTicker } from "@/components/CryptoTicker";
import { BannerMedia } from "@/components/BannerMedia";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PartnerMarquee } from "@/components/PartnerMarquee";
import {
  ArrowRight,
  Calendar,
  Copy,
  ExternalLink,
  ImageIcon,
  Instagram,
  MessageSquare,
  Send,
  Trophy,
  User,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getLocalDateISO, parseDateValue } from "@/lib/date";
import { getArticleImageStyle } from "@/lib/article-image";
import { categoryLabel } from "@/lib/taxonomy";
import { SOCIAL_URLS } from "@/lib/social";

/*
 * Cuántas notas pide la home. El reparto por bloque está más abajo, en
 * `layout`: 1 hero + 4 en la grilla de últimas + 2 destacados + 3 en "más
 * noticias". Se pide una de más para tener margen si alguna viene sin datos.
 */
const HOME_ARTICLE_LIMIT = 11;

/* ─── Types ────────────────────────────────────────────────────── */
interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  image_url: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
  created_at: string;
  published_at: string | null;
  category: string | null;
}

interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  hero_image_url: string | null;
}

interface Champion {
  id: string;
  name: string;
  tournament: string;
  amount: number;
  currency: "UYU" | "USD";
  image_url: string | null;
}

interface HomeBanner {
  position: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "content_vertical";
  image_url: string | null;
  link_url: string | null;
  affiliate_code: string | null;
  alt_text: string | null;
  is_active: boolean;
}

interface PartnerRoom {
  logo: string;
  alt?: string;
  scale?: number;
  logoClassName?: string;
  href?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────── */
async function copyToClipboard(text: string) {
  if (!text) return;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function buildCleanAdUrl(linkUrl: string | null, affiliateCode: string | null) {
  const rawLink = linkUrl?.trim();
  if (!rawLink) return null;

  try {
    const url = new URL(rawLink);
    const normalizedCode = affiliateCode?.trim().toLowerCase();

    if (normalizedCode) {
      for (const [key, value] of Array.from(url.searchParams.entries())) {
        if (value.trim().toLowerCase() === normalizedCode) {
          url.searchParams.delete(key);
        }
      }
    }

    return url.toString();
  } catch {
    return rawLink;
  }
}

/** "hace 2 horas" — la marca de tiempo que el diseño pone al pie de cada nota. */
function relativeTime(article: Article) {
  return formatDistanceToNow(parseDateValue(article.published_at || article.created_at), {
    locale: es,
    addSuffix: true,
  });
}

/**
 * "Del 04 al 08 de septiembre" cuando el evento no cruza de mes, y
 * "Del 31 de agosto al 12 de septiembre" cuando sí — omitir el mes de
 * arranque en ese caso daba rangos ilegibles ("Del 31 al 12 de septiembre").
 */
function formatEventRange(event: Event) {
  const start = parseDateValue(event.start_date);
  if (!event.end_date) return format(start, "d 'de' MMMM", { locale: es });

  const end = parseDateValue(event.end_date);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth
    ? format(start, "d", { locale: es })
    : format(start, "d 'de' MMMM", { locale: es });

  return `Del ${startLabel} al ${format(end, "d 'de' MMMM", { locale: es })}`;
}

function formatChampionAmount(champion: Champion) {
  const symbol = champion.currency === "USD" ? "US$" : "$";
  return `${symbol}${Math.round(champion.amount).toLocaleString("es-UY")}`;
}

/* ─── Piezas ───────────────────────────────────────────────────── */

/** Marco de imagen con el fallback rayado del diseño cuando no hay foto. */
function StoryImage({
  src,
  alt,
  style,
  className,
}: {
  src: string | null;
  alt: string;
  style?: CSSProperties;
  className?: string;
}) {
  if (src) {
    return (
      <BannerMedia
        src={src}
        alt={alt}
        style={style}
        className={className ?? "h-full w-full object-cover"}
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_14px,hsl(var(--card))_14px_28px)] text-muted-foreground">
      <ImageIcon className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

/** Nota destacada a sangre: foto, degradé, categoría, título y bajada. */
function StoryCard({
  article,
  heightClass,
  titleClass,
  delay = 0,
}: {
  article: Article;
  heightClass: string;
  titleClass: string;
  delay?: number;
}) {
  return (
    <Link
      to={`/noticias/${article.slug}`}
      style={{ "--card-reveal-delay": `${delay}ms` } as CSSProperties}
      className={`card-reveal group relative flex min-w-0 overflow-hidden rounded-xl ${heightClass}`}
    >
      <div className="absolute inset-0">
        <StoryImage
          src={article.image_url}
          alt={article.headline}
          style={getArticleImageStyle(article)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-brand-violet-deep/95 via-brand-violet-deep/35 to-transparent" />

      <div className="relative mt-auto flex flex-col gap-2.5 p-6 lg:p-7">
        {article.category && (
          <span className="self-start rounded-sm bg-brand-light/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-caption tracking-caption text-brand-light backdrop-blur-sm">
            {categoryLabel(article.category)}
          </span>
        )}
        <h3
          className={`m-0 max-w-[22ch] font-bold leading-[1.06] tracking-h1 text-brand-light drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${titleClass}`}
        >
          {article.headline}
        </h3>
        {article.summary && (
          <p className="m-0 line-clamp-2 max-w-[52ch] text-[15px] leading-body text-brand-light/80">
            {article.summary}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * Nota vertical con foto grande: la pieza del bloque "Últimas noticias".
 * La grilla 2×2 tenía sólo miniaturas de 104px y dejaba la mitad de la caja
 * vacía; acá la foto manda (16:9 a todo el ancho) y el titular entra en cuerpo
 * de subtítulo, no de epígrafe.
 */
function StoryTile({ article, delay = 0 }: { article: Article; delay?: number }) {
  return (
    <Link
      to={`/noticias/${article.slug}`}
      style={{ "--card-reveal-delay": `${delay}ms` } as CSSProperties}
      className="card-reveal group flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-primary/45"
    >
      <div className="aspect-[16/9] w-full overflow-hidden">
        <StoryImage
          src={article.image_url}
          alt={article.headline}
          style={getArticleImageStyle(article)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        {article.category && (
          <span className="self-start rounded-sm bg-brand-violet-deep px-2 py-0.5 text-[10px] font-bold uppercase leading-caption tracking-caption text-brand-light">
            {categoryLabel(article.category)}
          </span>
        )}
        <h4 className="m-0 line-clamp-3 text-[19px] font-bold leading-h2 tracking-h2 text-foreground transition-colors group-hover:text-primary">
          {article.headline}
        </h4>
        <span className="mt-auto pt-1 text-[12.5px] leading-caption text-muted-foreground first-letter:uppercase">
          {relativeTime(article)}
        </span>
      </div>
    </Link>
  );
}

/** Nota horizontal: miniatura + categoría + título + tiempo. Bloques secundarios. */
function StoryRow({ article, delay = 0 }: { article: Article; delay?: number }) {
  return (
    <Link
      to={`/noticias/${article.slug}`}
      style={{ "--card-reveal-delay": `${delay}ms` } as CSSProperties}
      className="card-reveal group flex min-w-0 items-start gap-3.5 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/45"
    >
      <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-sm sm:h-[104px] sm:w-[104px]">
        <StoryImage
          src={article.image_url}
          alt={article.headline}
          style={getArticleImageStyle(article)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        {article.category && (
          <span className="self-start rounded-sm bg-brand-violet-deep px-2 py-0.5 text-[10px] font-bold uppercase leading-caption tracking-caption text-brand-light">
            {categoryLabel(article.category)}
          </span>
        )}
        <h4 className="m-0 line-clamp-4 text-[16px] font-bold leading-h2 tracking-h2 text-foreground transition-colors group-hover:text-primary sm:line-clamp-3 sm:text-[17px]">
          {article.headline}
        </h4>
        <span className="text-[12.5px] leading-caption text-muted-foreground first-letter:uppercase">
          {relativeTime(article)}
        </span>
      </div>
    </Link>
  );
}

/** Encabezado de bloque: el rótulo violeta en versalitas del diseño. */
function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`text-[15px] font-bold uppercase leading-ui tracking-caption text-primary ${className}`}
    >
      {children}
    </span>
  );
}

/* ─── Banners ──────────────────────────────────────────────────── */
function BannerSlot({
  banner,
  className = "",
  imageClassName = "h-full w-full object-cover",
  onAction,
}: {
  banner: HomeBanner | undefined;
  className?: string;
  imageClassName?: string;
  onAction?: (banner: HomeBanner) => void;
}) {
  const hasImage = !!(banner?.image_url && banner.is_active);
  const hasAction = hasImage && Boolean(banner?.link_url || banner?.affiliate_code);
  const shouldOpenModal = hasAction && Boolean(banner?.affiliate_code) && Boolean(onAction);

  const content = hasImage ? (
    <BannerMedia
      src={banner!.image_url!}
      alt={banner?.alt_text}
      className={imageClassName}
      loading="lazy"
      autoPlay
      loop
      muted
      playsInline
    />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/50">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/25">
        <span className="text-xl font-light leading-none text-primary/50">+</span>
      </div>
      <span className="text-[10px] font-bold uppercase leading-caption tracking-caption text-muted-foreground">
        Espacio publicitario
      </span>
    </div>
  );

  const base = `overflow-hidden rounded-xl bg-muted/40 ${className}`;

  if (hasAction && shouldOpenModal && banner) {
    return (
      <button
        type="button"
        onClick={() => onAction?.(banner)}
        className={`block w-full appearance-none border-0 p-0 text-left transition-opacity hover:opacity-90 ${base}`}
      >
        {content}
      </button>
    );
  }

  if (hasImage && banner?.link_url) {
    return (
      <a
        href={banner.link_url}
        target="_blank"
        rel="noreferrer noopener"
        className={`block transition-opacity hover:opacity-90 ${base}`}
      >
        {content}
      </a>
    );
  }
  return <div className={base}>{content}</div>;
}

/** Banner vertical (231×411) — los dos que flanquean el bloque promocional. */
function PortraitBannerSlot({
  banner,
  className = "",
  onAction,
}: {
  banner: HomeBanner | undefined;
  className?: string;
  onAction?: (banner: HomeBanner) => void;
}) {
  return (
    <BannerSlot
      banner={banner}
      className={`aspect-[231/411] w-full lg:h-[411px] lg:w-[231px] ${className}`}
      onAction={onAction}
    />
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [banners, setBanners] = useState<Record<string, HomeBanner>>({});
  const [activeBanner, setActiveBanner] = useState<HomeBanner | null>(null);
  const [hasFetchedBanners, setHasFetchedBanners] = useState(false);
  const today = getLocalDateISO();

  const { toast } = useToast();

  const socialLinks = [
    { label: "Instagram", href: SOCIAL_URLS.instagram, description: "Fotos, clips y anuncios", icon: Instagram },
    { label: "Telegram", href: SOCIAL_URLS.telegram, description: "Canal de novedades", icon: Send },
    {
      label: "WhatsApp",
      href: SOCIAL_URLS.whatsapp,
      description: "Contacto directo (proximamente)",
      icon: MessageSquare,
      disabled: true,
    },
  ];

  const partnerRooms = useMemo<PartnerRoom[]>(
    () => [
      { logo: "/logos/1xKgstyNJea5U1XlrZfvuJf6mA.avif", scale: 2.2 },
      { logo: "/logos/2mhHbxpxNIGM4XPkRRS7XAjugzo.avif", scale: 2.2 },
      { logo: "/logos/4QgmNilvdkzkVZ3TGcGFaTLfO4-1.avif", scale: 2.2 },
      { logo: "/logos/B8bBSvDxcwJT02USIWiz5kIIm58.avif", scale: 2.2 },
      { logo: "/logos/Eu0u1iQMQ68wnKhgukzIPAvlUSs.avif", scale: 2.2 },
      { logo: "/logos/X0o6ZZXCjE1hwD5B7eHtEVFWYk.avif", scale: 2.15 },
      { logo: "/logos/czfafuk61agm2d0m8cyZ7GGuwA.avif", scale: 2.2 },
      { logo: "/logos/fKFuVulfMN8Qx5dzzNbwjTg8eQ.avif", scale: 2.25 },
      { logo: "/logos/j4MVzhkvqVebGmoMjRA8T2EpBA.avif", scale: 2.25 },
      { logo: "/logos/t9tFBv9mtBHDSHwp0lEwvouyk4.avif", scale: 1.38 },
      {
        logo: "/logos/kk.svg",
        alt: "KK Poker",
        scale: 1.08,
        logoClassName: "saturate-0 brightness-[2.55] contrast-[1.1]",
      },
      {
        logo: "/logos/blackchup.png",
        alt: "BlackChip Poker",
        scale: 1.12,
        logoClassName: "saturate-0 brightness-[2.2] contrast-[1.08]",
      },
    ],
    []
  );

  const uniquePartnerRooms = useMemo(() => {
    const seen = new Set<string>();
    return partnerRooms.filter((room) => {
      const key = room.logo.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [partnerRooms]);

  /* Reparto de las notas por bloque, en el orden del diseño. */
  const layout = useMemo(() => {
    const hero = articles[0] ?? null;
    return {
      hero,
      latest: articles.slice(1, 5),
      features: articles.slice(5, 7),
      more: articles.slice(7, 10),
      ticker: articles.slice(0, 5).map((a) => ({ slug: a.slug, headline: a.headline })),
    };
  }, [articles]);

  const nextEvent = events[0] ?? null;

  const buildAffiliateMessage = (banner: HomeBanner) => {
    const parts = ["Mirá esta oferta que vi en Fichas.uy"];
    const cleanUrl = buildCleanAdUrl(banner.link_url, banner.affiliate_code);

    if (cleanUrl) parts.push(`Link: ${cleanUrl}`);
    if (banner.affiliate_code) parts.push(`Codigo de afiliado: ${banner.affiliate_code}`);

    return parts.join("\n");
  };

  const handleCopyValue = async (value: string, label: string) => {
    try {
      await copyToClipboard(value);
      toast({
        title: `${label} copiado`,
        description: "Lo dejamos pronto para que lo pegues donde quieras.",
      });
    } catch {
      toast({
        title: "No se pudo copiar",
        description: "Probá copiar manualmente.",
        variant: "destructive",
      });
    }
  };

  const activeBannerOpenUrl = activeBanner
    ? buildCleanAdUrl(activeBanner.link_url, activeBanner.affiliate_code)
    : null;

  useEffect(() => {
    let cancelled = false;
    // Válvula de seguridad: si la carga tarda más de 1200ms mostramos igual,
    // para que el layout no quede invisible esperando.
    const timeout = setTimeout(() => {
      if (!cancelled) setHasFetchedBanners(true);
    }, 1200);

    (async () => {
      const today = getLocalDateISO();
      const artResPromise = (supabase as any)
        .from("articles")
        .select(
          "id, slug, headline, summary, image_url, image_position_x, image_position_y, created_at, published_at, category"
        )
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(HOME_ARTICLE_LIMIT);

      // El bloque editorial se pinta apenas resuelve esta consulta.
      void artResPromise.then((artRes: { data: Article[] | null }) => {
        if (cancelled) return;
        if (artRes.data) setArticles(artRes.data);
      });

      const [evtRes, championRes, bannerRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, start_date, end_date, city, country, venue, hero_image_url")
          .eq("status", "published")
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .order("start_date")
          .limit(5),
        (supabase as any)
          .from("champions")
          .select("id, name, tournament, amount, currency, image_url")
          .order("year_week", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("home_banners")
          .select("position, image_url, link_url, affiliate_code, alt_text, is_active"),
      ]);

      if (cancelled) return;
      clearTimeout(timeout);

      if (evtRes.data) setEvents(evtRes.data as Event[]);
      if (championRes.data) setChampions(championRes.data as Champion[]);
      if (bannerRes.data) {
        const map: Record<string, HomeBanner> = {};
        for (const b of bannerRes.data as HomeBanner[]) map[b.position] = b;
        setBanners(map);
      }
      setHasFetchedBanners(true);
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const bannerReveal = hasFetchedBanners ? "banner-reveal is-visible" : "banner-reveal";

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <HomeSplashScreen visible={!hasFetchedBanners} />
      <Navbar />
      {/*
        Dos franjas finas bajo el masthead: primero la de cripto (oscura, sigue
        la masa violeta del encabezado) y después la de última hora, que ya
        entrega al gris de la página.
      */}
      <CryptoTicker />
      <BreakingTicker items={layout.ticker} />

      <main className="mx-auto w-full max-w-[1440px] px-4 pt-7 lg:px-10 lg:pt-8">
        {/* ── Fila 1: apertura + calendario ─────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]">
          {layout.hero ? (
            <StoryCard
              article={layout.hero}
              heightClass="h-[320px] sm:h-[400px] lg:h-[460px]"
              titleClass="text-[26px] sm:text-[30px] lg:text-[34px]"
            />
          ) : (
            <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 lg:h-[460px]">
              <p className="text-sm font-semibold uppercase tracking-caption text-muted-foreground">
                No hay noticias publicadas aún.
              </p>
            </div>
          )}

          <aside className="card-reveal flex min-w-0 flex-col gap-4 rounded-md border border-border bg-card p-5 lg:h-[460px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-bold uppercase leading-ui tracking-caption text-foreground">
                Calendario
              </span>
              <Link
                to="/calendario"
                className="text-[12px] font-bold uppercase leading-caption tracking-caption text-primary hover:underline"
              >
                Ver calendario completo
              </Link>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden">
              {events.slice(0, 3).map((e, i) => {
                const endDate = e.end_date ?? e.start_date;
                const isLive = e.start_date <= today && endDate >= today;
                const range = formatEventRange(e);

                return (
                  <div key={e.id} className="flex flex-col gap-3.5">
                    {i > 0 && <div className="h-px w-full bg-border" />}
                    <Link to={`/eventos/${e.id}`} className="group flex items-center gap-3">
                      <div className="h-14 w-[78px] shrink-0 overflow-hidden rounded-md">
                        <StoryImage src={e.hero_image_url} alt={e.name} />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-start gap-2 text-[16px] font-bold leading-h2 text-foreground transition-colors group-hover:text-primary">
                          <span className="line-clamp-2">{e.name}</span>
                          {isLive && (
                            <span className="mt-0.5 shrink-0 rounded-full border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-caption text-red-400">
                              En vivo
                            </span>
                          )}
                        </span>
                        <span className="text-[12.5px] leading-caption text-muted-foreground">{range}</span>
                      </div>
                    </Link>
                  </div>
                );
              })}

              {events.length === 0 && (
                <p className="text-[13px] leading-body text-muted-foreground">
                  No hay eventos en curso ni próximos.
                </p>
              )}
            </div>

            <Link
              to="/calendario"
              className="mt-auto inline-flex items-center justify-center gap-2 self-stretch rounded-md border border-primary/40 px-4 py-3 text-[12px] font-bold uppercase leading-caption tracking-caption text-primary transition-colors hover:bg-primary/10"
            >
              <Calendar className="h-3.5 w-3.5" />
              Ver agenda
            </Link>
          </aside>
        </section>

        {/* ── Fila 2: últimas noticias + campeones ──────────────────── */}
        <section className="mt-9 grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <SectionLabel>Últimas noticias</SectionLabel>
              <Link
                to="/noticias"
                className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase leading-caption tracking-caption text-muted-foreground transition-colors hover:text-primary"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {layout.latest.map((a, i) => (
                <StoryTile key={a.id} article={a} delay={i * 60} />
              ))}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="card-reveal flex flex-col gap-4 rounded-md border border-border bg-card p-5">
              <span className="text-[15px] font-bold uppercase leading-ui tracking-caption text-foreground">
                Últimos campeones
              </span>

              <div className="flex flex-col gap-3.5">
                {champions.map((c, i) => (
                  <div key={c.id} className="flex flex-col gap-3.5">
                    {i > 0 && <div className="h-px w-full bg-border" />}
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-bold leading-h3 text-foreground">{c.name}</span>
                        <span className="truncate text-[12.5px] leading-caption text-muted-foreground">
                          {c.tournament}
                        </span>
                      </div>
                      <span className="shrink-0 text-[15px] font-bold text-primary">
                        {formatChampionAmount(c)}
                      </span>
                    </div>
                  </div>
                ))}

                {champions.length === 0 && (
                  <p className="flex items-center gap-2 text-[13px] leading-body text-muted-foreground">
                    <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Todavía no cargamos campeones de esta semana.
                  </p>
                )}
              </div>
            </div>

            <div className={`flex-1 ${bannerReveal}`}>
              <BannerSlot
                banner={banners["content_vertical"]}
                className="h-full min-h-[240px] w-full"
                onAction={setActiveBanner}
              />
            </div>
          </aside>
        </section>

        {/* ── Fila 3: banda de banners ──────────────────────────────── */}
        <section className={`mt-9 grid gap-6 md:grid-cols-2 ${bannerReveal}`}>
          <BannerSlot
            banner={banners["bottom_left"]}
            className="aspect-[572/182] w-full"
            onAction={setActiveBanner}
          />
          <BannerSlot
            banner={banners["bottom_right"]}
            className="aspect-[572/182] w-full"
            onAction={setActiveBanner}
          />
        </section>

        {/* ── Fila 4: dos destacados ────────────────────────────────── */}
        {layout.features.length > 0 && (
          <section className="mt-9 grid gap-6 md:grid-cols-2">
            {layout.features.map((a, i) => (
              <StoryCard
                key={a.id}
                article={a}
                heightClass="h-[300px] lg:h-[340px]"
                titleClass="text-[22px] lg:text-[26px]"
                delay={i * 70}
              />
            ))}
          </section>
        )}

        {/* ── Fila 5: banners verticales + promo del próximo evento ─── */}
        <section className="mt-9 flex flex-col items-center gap-6 lg:flex-row lg:justify-center">
          <div className={`w-full max-w-[280px] lg:w-auto ${bannerReveal}`}>
            <PortraitBannerSlot banner={banners["top_left"]} onAction={setActiveBanner} />
          </div>

          <Link
            to={nextEvent ? `/eventos/${nextEvent.id}` : "/calendario"}
            className="card-reveal relative flex h-[280px] w-full flex-1 items-end justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-violet to-brand-violet-deep lg:h-[411px]"
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(197,197,197,0.08)_0_18px,transparent_18px_36px)]" />
            <div className="relative flex flex-col items-center gap-3 px-6 pb-9 text-center">
              <span className="text-[12px] font-bold uppercase leading-caption tracking-caption text-brand-light/70">
                {nextEvent ? "Próximo evento" : "Agenda del circuito"}
              </span>
              <span className="max-w-[18ch] text-[26px] font-bold uppercase leading-[1.05] tracking-h1 text-brand-light lg:text-[30px]">
                {nextEvent ? nextEvent.name : "Mirá el calendario completo"}
              </span>
              {nextEvent && (
                <span className="text-[15px] leading-body text-brand-light/80">
                  Desde el {format(parseDateValue(nextEvent.start_date), "d 'de' MMMM", { locale: es })}
                  {[nextEvent.city, nextEvent.country].filter(Boolean).length > 0 &&
                    ` · ${[nextEvent.city, nextEvent.country].filter(Boolean).join(", ")}`}
                </span>
              )}
            </div>
          </Link>

          <div className={`w-full max-w-[280px] lg:w-auto ${bannerReveal}`}>
            <PortraitBannerSlot banner={banners["top_right"]} onAction={setActiveBanner} />
          </div>
        </section>

        {/* ── Fila 6: más noticias ──────────────────────────────────── */}
        {layout.more.length > 0 && (
          <section className="mt-9 flex flex-col gap-4">
            <SectionLabel>Más noticias</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {layout.more.map((a, i) => (
                <StoryRow key={a.id} article={a} delay={i * 60} />
              ))}
            </div>
          </section>
        )}

        {/* ── Salas asociadas ───────────────────────────────────────── */}
        <section className="mt-11 flex flex-col gap-4">
          <SectionLabel>Conseguí el mejor deal para tu sala</SectionLabel>
          <PartnerMarquee rooms={uniquePartnerRooms} />
        </section>

        {/* ── Redes ─────────────────────────────────────────────────── */}
        <section className="mt-11 flex flex-col gap-4 pb-12">
          <SectionLabel>Seguinos en redes</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {socialLinks.map((social, i) => {
              const Icon = social.icon;
              const isDisabled = Boolean(social.disabled);
              return (
                <a
                  key={social.label}
                  href={isDisabled ? undefined : social.href}
                  target={isDisabled ? undefined : "_blank"}
                  rel={isDisabled ? undefined : "noreferrer"}
                  aria-label={isDisabled ? `${social.label} deshabilitado` : `Abrir ${social.label}`}
                  aria-disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : undefined}
                  onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                  style={{ "--card-reveal-delay": `${i * 80}ms` } as CSSProperties}
                  className={`card-reveal group flex items-center justify-between rounded-md border border-border bg-card px-4 py-3.5 transition-colors ${
                    isDisabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/45"
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
                      <p className="font-semibold leading-h3 text-foreground">{social.label}</p>
                      <p className="text-xs text-muted-foreground">{social.description}</p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 text-muted-foreground ${
                      isDisabled ? "" : "transition-transform group-hover:translate-x-1 group-hover:text-primary"
                    }`}
                  />
                </a>
              );
            })}
          </div>
        </section>
      </main>

      <Dialog open={!!activeBanner} onOpenChange={(open) => !open && setActiveBanner(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {activeBanner?.alt_text || "Acceso al anuncio"}
            </DialogTitle>
            <DialogDescription>
              {activeBanner?.link_url
                ? "Copiá el código y abrí el enlace cuando quieras."
                : "Copiá el código para compartir este anuncio."}
            </DialogDescription>
          </DialogHeader>

          {activeBanner?.affiliate_code && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Código de afiliado
              </p>
              <p className="font-mono text-lg font-bold text-foreground">{activeBanner.affiliate_code}</p>
            </div>
          )}

          <div className="grid gap-2">
            {activeBanner?.affiliate_code && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCopyValue(activeBanner.affiliate_code ?? "", "Código")}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar código
              </Button>
            )}

            {activeBanner && (activeBanner.link_url || activeBanner.affiliate_code) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopyValue(buildAffiliateMessage(activeBanner), "Mensaje")}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar mensaje completo
              </Button>
            )}

            {activeBannerOpenUrl && (
              <Button asChild>
                <a href={activeBannerOpenUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir anuncio
                </a>
              </Button>
            )}

            {activeBanner && activeBannerOpenUrl && (
              <Button asChild variant="outline">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(buildAffiliateMessage(activeBanner))}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Compartir por WhatsApp
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
