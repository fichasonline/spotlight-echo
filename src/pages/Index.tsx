import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { LazySupportChatWidget } from "@/components/LazySupportChatWidget";
import { LazyAIChatWidget } from "@/components/LazyAIChatWidget";
import { CryptoTicker } from "@/components/CryptoTicker";
import { BannerMedia } from "@/components/BannerMedia";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PartnerMarquee } from "@/components/PartnerMarquee";
import { Calendar, Newspaper, MessageSquare, ArrowRight, Send, Instagram, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getLocalDateISO, parseDateValue } from "@/lib/date";

const NEWS_CAROUSEL_LIMIT = 10;

/* ─── Types ────────────────────────────────────────────────────── */
interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  image_url: string | null;
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

function useAutoHorizontalScroll({
  containerRef,
  pauseRef,
  enabled,
  intervalMs = 4200,
}: {
  containerRef: RefObject<HTMLDivElement>;
  pauseRef: MutableRefObject<boolean>;
  enabled: boolean;
  intervalMs?: number;
}) {
  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotionMq.matches) return;

    const intervalId = window.setInterval(() => {
      if (pauseRef.current || document.hidden) return;

      const firstCard = container.querySelector<HTMLElement>("[data-carousel-card='true']");
      const computedStyle = window.getComputedStyle(container);
      const gapValue = computedStyle.columnGap !== "normal" ? computedStyle.columnGap : computedStyle.gap;
      const gap = Number.parseFloat(gapValue || "0") || 0;
      const step = firstCard ? firstCard.getBoundingClientRect().width + gap : container.clientWidth;
      const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);

      if (maxScrollLeft <= 0) return;

      const nextLeft = container.scrollLeft + step;
      if (nextLeft >= maxScrollLeft - 2) {
        container.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      container.scrollTo({ left: nextLeft, behavior: "smooth" });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [containerRef, pauseRef, enabled, intervalMs]);
}

function useVerticalScrollPassthrough(scrollerRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        window.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [scrollerRef]);
}

function useScrollDots(scrollerRef: RefObject<HTMLDivElement>, count: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container || count === 0) return;
    const handleScroll = () => {
      const itemWidth = container.scrollWidth / count;
      const index = Math.round(container.scrollLeft / itemWidth);
      setActiveIndex(Math.max(0, Math.min(index, count - 1)));
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollerRef, count]);
  return activeIndex;
}

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

/* ─── Banner slot ─────────────────────────────────────────────── */
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
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2"
      style={{
        background:
          "linear-gradient(135deg, rgba(88,28,135,0.15) 0%, rgba(15,12,22,0.55) 100%)",
      }}
    >
      <div className="w-9 h-9 rounded-full border border-primary/25 flex items-center justify-center">
        <span className="text-primary/40 text-xl font-light leading-none">+</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/20">
        Espacio publicitario
      </span>
    </div>
  );

  const base = `overflow-hidden rounded-[26px] border border-white/10 bg-black/40 ${className}`;

  if (hasAction && shouldOpenModal && banner) {
    return (
      <button
        type="button"
        onClick={() => onAction?.(banner)}
        className={`block w-full appearance-none border-0 bg-transparent p-0 text-left transition-opacity hover:opacity-90 ${base}`}
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

function PortraitBannerSlot({
  banner,
  className = "",
  onAction,
}: {
  banner: HomeBanner | undefined;
  className?: string;
  onAction?: (banner: HomeBanner) => void;
}) {
  const hasImage = !!(banner?.image_url && banner.is_active);
  const hasAction = hasImage && Boolean(banner?.link_url || banner?.affiliate_code);
  const shouldOpenModal = hasAction && Boolean(banner?.affiliate_code) && Boolean(onAction);

  const content = hasImage ? (
    <div className="h-[411px] w-[231px] overflow-hidden rounded-[24px] bg-[#100b15]">
      <BannerMedia
        src={banner!.image_url!}
        alt={banner?.alt_text}
        className="h-full w-full object-cover"
        loading="lazy"
        autoPlay
        loop
        muted
        playsInline
      />
    </div>
  ) : (
    <div className="flex h-[411px] w-[231px] flex-col items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-[#120d18]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/25">
        <span className="text-xl font-light leading-none text-primary/40">+</span>
      </div>
      <span className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
        Espacio publicitario
      </span>
    </div>
  );

  const base = `flex h-[443px] w-[263px] shrink-0 items-center justify-center rounded-[38px] bg-black/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.48)] ${className}`;

  if (hasAction && shouldOpenModal && banner) {
    return (
      <button
        type="button"
        onClick={() => onAction?.(banner)}
        className={`${base} appearance-none border-0 bg-transparent text-left transition-transform duration-300 hover:-translate-y-1`}
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
        className={`${base} transition-transform duration-300 hover:-translate-y-1`}
      >
        {content}
      </a>
    );
  }

  return <div className={base}>{content}</div>;
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function HomePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [articles, setArticles]           = useState<Article[]>([]);
  const [events, setEvents]               = useState<Event[]>([]);
  const [banners, setBanners]             = useState<Record<string, HomeBanner>>({});
  const [activeBanner, setActiveBanner]   = useState<HomeBanner | null>(null);
  const [hasFetchedBanners, setHasFetchedBanners] = useState(false);
  const today                   = getLocalDateISO();
  const articlesScrollerRef     = useRef<HTMLDivElement | null>(null);
  const eventsScrollerRef       = useRef<HTMLDivElement | null>(null);
  const newsAutoScrollPausedRef = useRef(false);
  const eventsAutoScrollPausedRef = useRef(false);
  const eventBannerInsertAfterIndex = 2;
  const hasEventsBannerCard = events.length > eventBannerInsertAfterIndex;
  const eventsCarouselCount = events.length + (hasEventsBannerCard ? 1 : 0);
  const activeArticleIndex = useScrollDots(articlesScrollerRef, articles.length);
  const activeEventIndex = useScrollDots(eventsScrollerRef, eventsCarouselCount);
  useVerticalScrollPassthrough(articlesScrollerRef);
  useVerticalScrollPassthrough(eventsScrollerRef);

  const { toast } = useToast();

  const instagramUrl = import.meta.env.VITE_INSTAGRAM_URL?.trim() || "https://instagram.com/fichasonlineuy";
  const telegramUrl  = import.meta.env.VITE_TELEGRAM_URL?.trim()  || "https://t.me/+59891856965";
  const whatsappUrl  = import.meta.env.VITE_WHATSAPP_URL?.trim()  || "https://wa.me";

  const socialLinks = [
    { label: "Instagram", href: instagramUrl, description: "Fotos, clips y anuncios",        icon: Instagram },
    { label: "Telegram",  href: telegramUrl,  description: "Canal de novedades",              icon: Send },
    { label: "WhatsApp",  href: whatsappUrl,  description: "Contacto directo (proximamente)", icon: MessageSquare, disabled: true },
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

  const newsScrollerInteractionProps = {
    onMouseEnter: () => { newsAutoScrollPausedRef.current = true; },
    onMouseLeave: () => { newsAutoScrollPausedRef.current = false; },
    onPointerDown: () => { newsAutoScrollPausedRef.current = true; },
    onPointerUp: () => { newsAutoScrollPausedRef.current = false; },
    onPointerCancel: () => { newsAutoScrollPausedRef.current = false; },
  };

  const eventsScrollerInteractionProps = {
    onMouseEnter: () => { eventsAutoScrollPausedRef.current = true; },
    onMouseLeave: () => { eventsAutoScrollPausedRef.current = false; },
    onPointerDown: () => { eventsAutoScrollPausedRef.current = true; },
    onPointerUp: () => { eventsAutoScrollPausedRef.current = false; },
    onPointerCancel: () => { eventsAutoScrollPausedRef.current = false; },
  };

  useEffect(() => {
    let cancelled = false;
    // Safety valve: if fetch takes > 1200ms, reveal banner slots anyway
    // so the layout doesn't sit invisible forever.
    const timeout = setTimeout(() => {
      if (!cancelled) setHasFetchedBanners(true);
    }, 1200);

    (async () => {
      const today = getLocalDateISO();
      const artResPromise = supabase
        .from("articles")
        .select("id, slug, headline, summary, image_url, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(NEWS_CAROUSEL_LIMIT);

      // News carousel should render as soon as this single query resolves.
      void artResPromise.then((artRes) => {
        if (cancelled) return;
        if (artRes.data) setArticles(artRes.data);
      });

      const [evtRes, bannerRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, start_date, end_date, city, country, venue")
          .eq("status", "published")
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .order("start_date")
          .limit(5),
        supabase
          .from("home_banners")
          .select("position, image_url, link_url, affiliate_code, alt_text, is_active"),
      ]);

      if (cancelled) return;
      clearTimeout(timeout);

      if (evtRes.data) setEvents(evtRes.data);
      if (bannerRes.data) {
        const map: Record<string, HomeBanner> = {};
        for (const b of bannerRes.data as HomeBanner[]) map[b.position] = b;
        setBanners(map);
      }
      setHasFetchedBanners(true);
    })();

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  useAutoHorizontalScroll({
    containerRef: articlesScrollerRef,
    pauseRef: newsAutoScrollPausedRef,
    enabled: articles.length > 3,
    intervalMs: 4200,
  });

  useAutoHorizontalScroll({
    containerRef: eventsScrollerRef,
    pauseRef: eventsAutoScrollPausedRef,
    enabled: eventsCarouselCount > 1,
    intervalMs: 4600,
  });

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <Navbar />

      {/* ══════════════════════════════════════════════════════════════
          HERO — fills the full remaining viewport height
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden flex flex-col"
        style={{
          minHeight: "calc(100vh - 64px)",
          backgroundImage: "url('/fondo-1600.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Gradient overlay encima del fondo */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: isDark
              ? "radial-gradient(circle at 50% 38%, rgba(86,49,116,0.45), rgba(14,9,19,0.82) 54%, #09060f 100%)"
              : "rgba(255,255,255,0.78)",
          }}
        />
        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-20 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-purple-900/25 blur-[130px]" />
          <div className="absolute left-[10%] top-[24%] h-[240px] w-[240px] rounded-full bg-fuchsia-950/20 blur-[110px]" />
          <div className="absolute right-[10%] top-[20%] h-[280px] w-[280px] rounded-full bg-violet-950/20 blur-[120px]" />
          <div className="absolute bottom-[18%] left-1/2 h-[220px] w-[680px] -translate-x-1/2 rounded-full bg-white/5 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-4 pb-3 pt-5 lg:px-6">
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-center lg:gap-4 xl:gap-7">
              <div className={hasFetchedBanners ? "banner-reveal is-visible" : "banner-reveal"}>
                <PortraitBannerSlot
                  banner={banners["top_left"]}
                  className="hidden lg:flex"
                  onAction={setActiveBanner}
                />
              </div>

              <div className="flex w-full max-w-[720px] flex-1 flex-col items-center justify-center px-2 py-5 text-center sm:py-8 lg:min-h-[443px] lg:px-4 lg:py-4">
                <h1
                  className="font-display font-black uppercase leading-[0.9] tracking-[-0.05em] text-balance select-none"
                  style={{ fontSize: "clamp(2.65rem, 5.2vw, 4.0625rem)" }}
                >
                  <span className="hero-line block text-[#8f3cf9] lg:whitespace-nowrap">
                    NOTICIAS, EVENTOS
                  </span>
                  <span className="hero-line block lg:whitespace-nowrap">
                    <span className="text-[#8f3cf9]">Y COMUNIDAD</span>{" "}
                    <span className={isDark ? "text-white" : "text-gray-900"}>EN UN</span>
                  </span>
                  <span className={`hero-line block lg:whitespace-nowrap ${isDark ? "text-white" : "text-gray-900"}`}>
                    SOLO LUGAR
                  </span>
                </h1>

                <p className={`hero-sub mt-6 max-w-[560px] text-sm font-semibold uppercase tracking-[0.03em] md:text-[15px] ${isDark ? "text-white/42" : "text-gray-500"}`}>
                  Todo el ecosistema de Fichas Online en un solo lugar
                </p>

                <div className="hero-cta">
                  <LazySupportChatWidget triggerVariant="hero" />
                </div>
              </div>

              <div className={hasFetchedBanners ? "banner-reveal is-visible" : "banner-reveal"}>
                <PortraitBannerSlot
                  banner={banners["top_right"]}
                  className="hidden lg:flex"
                  onAction={setActiveBanner}
                />
              </div>
            </div>

            <div className={`mt-3 hidden grid-cols-2 gap-3 sm:grid lg:hidden ${hasFetchedBanners ? "banner-reveal is-visible" : "banner-reveal"}`}>
              <BannerSlot
                banner={banners["top_left"]}
                className="aspect-[231/411] rounded-[24px]"
                onAction={setActiveBanner}
              />
              <BannerSlot
                banner={banners["top_right"]}
                className="aspect-[231/411] rounded-[24px]"
                onAction={setActiveBanner}
              />
            </div>
          </div>

          <div className={`mt-5 hidden items-center justify-center gap-6 lg:flex ${hasFetchedBanners ? "banner-reveal is-visible" : "banner-reveal"}`}>
            <BannerSlot
              banner={banners["bottom_left"]}
              className="h-[182px] w-[572px] shrink-0 rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              onAction={setActiveBanner}
            />
            <BannerSlot
              banner={banners["bottom_right"]}
              className="h-[182px] w-[572px] shrink-0 rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              onAction={setActiveBanner}
            />
          </div>

          <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden ${hasFetchedBanners ? "banner-reveal is-visible" : "banner-reveal"}`}>
            <BannerSlot
              banner={banners["bottom_left"]}
              className="aspect-[572/182] rounded-[24px]"
              onAction={setActiveBanner}
            />
            <BannerSlot
              banner={banners["bottom_right"]}
              className="aspect-[572/182] rounded-[24px]"
              onAction={setActiveBanner}
            />
          </div>
        </div>

        {/* Ticker — always at the very bottom of the section */}
        <CryptoTicker />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CONTENT — only visible after scrolling past the hero
      ══════════════════════════════════════════════════════════════ */}
      <div className="container mx-auto px-4 pb-10 space-y-10 mt-8 lg:mt-14 lg:space-y-16 lg:pb-16">

        {/* Latest articles */}
        <section>
          {articles.length > 3 && (
            <div className="mb-3 flex items-center justify-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground lg:justify-end">
              <span>Se mueve solo</span>
              <span
                aria-hidden="true"
                className="nudge-x inline-flex items-center"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span>También podés arrastrar</span>
            </div>
          )}
          <div
            className="card-reveal mb-5 flex items-center justify-between gap-4"
          >
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-foreground">
              Ultimas noticias
            </p>
            <Link
              to="/noticias"
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/30"
            >
              <Newspaper className="h-4 w-4" />
              Fichas News
            </Link>
          </div>

          <div className="relative">
            {articles.length > 3 && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-background via-background/78 to-transparent lg:block" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-background via-background/84 to-transparent lg:block" />
              </>
            )}

            <div
              ref={articlesScrollerRef}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain [touch-action:pan-x_pan-y] pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              {...newsScrollerInteractionProps}
            >
            {articles.map((a, i) => (
              <div
                key={a.id}
                style={{ "--card-reveal-delay": `${Math.min(i, 3) * 60}ms` } as CSSProperties}
                data-carousel-card="true"
                className="card-reveal min-w-0 shrink-0 snap-start basis-[84%] sm:basis-[68%] lg:basis-[371px]"
              >
                <Link
                  to={`/noticias/${a.slug}`}
                  className="group relative flex h-full min-h-[420px] overflow-hidden rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.26)] lg:h-[490px]"
                >
                  {/* Full-bleed image */}
                  <div className="absolute inset-0">
                    {a.image_url ? (
                      <BannerMedia
                        src={a.image_url}
                        alt={a.headline}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(157,78,221,0.55),_rgba(18,12,28,0.98)_72%)]" />
                    )}
                  </div>

                  {/* Gradient overlay — texto legible siempre */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Date badge top-right */}
                  {a.published_at && (
                    <span className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
                      {format(parseDateValue(a.published_at), "d MMM yyyy", { locale: es })}
                    </span>
                  )}

                  {/* Text at bottom */}
                  <div className="relative z-10 mt-auto p-5">
                    <h3 className="font-display line-clamp-3 text-[1.25rem] font-black uppercase leading-[0.95] tracking-[-0.03em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] lg:text-[1.35rem]">
                      {a.summary || a.headline}
                    </h3>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/60 transition-colors group-hover:text-white/90">
                      Leer más <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </div>
            ))}
            {articles.length === 0 && (
              <div className="w-full rounded-[30px] border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  No hay noticias publicadas aun.
                </p>
              </div>
            )}
            </div>
          </div>

          {articles.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
              {articles.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === activeArticleIndex ? 20 : 6,
                    opacity: i === activeArticleIndex ? 1 : 0.3,
                    backgroundColor: i === activeArticleIndex ? "rgb(143,60,249)" : "rgb(255,255,255)",
                  }}
                  className="h-1.5 rounded-full transition-all duration-300"
                />
              ))}
            </div>
          )}

          {articles.length > 0 && (
            <div className="mt-6 flex justify-center xl:hidden">
              <Link
                to="/noticias"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/10"
              >
                Ver todas las noticias <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          {articles.length > 0 && (
            <div className="mt-4 hidden justify-end xl:flex">
              <Link
                to="/noticias"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Ver todas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>

        {/* Upcoming events */}
        <section className="relative">
      
          <div
            className="card-reveal mb-3 flex items-center justify-between gap-4"
          >
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-foreground">
              Calendario
            </p>
            <Link
              to="/calendario"
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent/45 hover:bg-accent/15"
            >
              <Calendar className="h-4 w-4" />
              Ver calendario
            </Link>
          </div>

          {eventsCarouselCount > 1 && (
            <div className="mb-4 flex items-center justify-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground lg:justify-end">
              <span className="hidden lg:inline">Se mueve solo</span>
              <span className="hidden lg:inline">•</span>
              <span>Deslizá para ver más eventos</span>
              <span
                aria-hidden="true"
                className="nudge-x inline-flex items-center"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          )}

          <div className="relative">
            {eventsCarouselCount > 1 && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-background via-background/80 to-transparent lg:block" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-background via-background/84 to-transparent lg:block" />
              </>
            )}

            <div
              ref={eventsScrollerRef}
              className="flex items-start snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain [touch-action:pan-x_pan-y] pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              {...eventsScrollerInteractionProps}
            >
            {events.map((e, i) => {
              const eventEndDate = e.end_date ?? e.start_date;
              const isLive = e.start_date <= today && eventEndDate >= today;
              const location = [e.venue, e.city, e.country].filter(Boolean).join(" · ");
              const monthLabel = format(parseDateValue(e.start_date), "MMM", { locale: es }).toUpperCase();
              return (
                <Fragment key={e.id}>
                  <div
                    style={{ "--card-reveal-delay": `${Math.min(i, 3) * 60}ms` } as CSSProperties}
                    data-carousel-card="true"
                    className="card-reveal min-w-0 shrink-0 snap-start basis-[88%] sm:basis-[72%] lg:basis-[500px]"
                  >
                    <Link
                      to={`/eventos/${e.id}`}
                      className="group flex min-h-[136px] items-center gap-4 rounded-[18px] border border-border bg-card p-3 shadow-[0_18px_36px_rgba(0,0,0,0.10)] transition-colors hover:border-accent/35"
                    >
                      <div className="flex h-[98px] w-[114px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#b956ff_0%,#8f3cf9_100%)] text-white shadow-[0_12px_30px_rgba(143,60,249,0.35)]">
                        <span className="text-[3.15rem] font-black leading-none tracking-[-0.08em]">
                          {format(parseDateValue(e.start_date), "dd")}
                        </span>
                        <span className="mt-1 text-[1rem] font-black uppercase leading-none tracking-[-0.04em]">
                          {monthLabel}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 pr-2">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h3 className="font-display line-clamp-2 text-[1.05rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-foreground lg:text-[1.15rem]">
                            {e.name}
                          </h3>
                          {isLive && (
                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/35 bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                              </span>
                              En vivo
                            </span>
                          )}
                        </div>

                        <p className="line-clamp-2 text-[0.9rem] font-medium uppercase leading-[1.02] tracking-[0.01em] text-muted-foreground lg:text-[1rem]">
                          {location || "Evento destacado en fichas online"}
                        </p>
                      </div>
                    </Link>
                  </div>

                  {i === eventBannerInsertAfterIndex && (
                    <div
                      style={{ "--card-reveal-delay": `${i * 70 + 40}ms` } as CSSProperties}
                      data-carousel-card="true"
                      className="card-reveal min-w-0 shrink-0 snap-start basis-[88%] sm:basis-[72%] lg:basis-[500px]"
                    >
                      <div className="h-[136px]">
                        <BannerSlot
                          banner={banners["content_vertical"]}
                          className="h-full w-full rounded-[18px] border border-border bg-card shadow-[0_18px_36px_rgba(0,0,0,0.10)]"
                          onAction={setActiveBanner}
                        />
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
            {events.length === 0 && (
              <div className="w-full rounded-[24px] border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  No hay eventos en curso ni proximos.
                </p>
              </div>
            )}
            </div>
          </div>

          {eventsCarouselCount > 1 && (
            <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
              {Array.from({ length: eventsCarouselCount }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === activeEventIndex ? 20 : 6,
                    opacity: i === activeEventIndex ? 1 : 0.3,
                    backgroundColor: i === activeEventIndex ? "rgb(143,60,249)" : "rgb(255,255,255)",
                  }}
                  className="h-1.5 rounded-full transition-all duration-300"
                />
              ))}
            </div>
          )}
        </section>

        {/* Partner rooms */}
        <section>
          <div
            className="card-reveal mb-5 flex items-center justify-between gap-4"
          >
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-foreground">
              Consegui el mejor deal para tu sala
            </p>
          </div>

          <PartnerMarquee rooms={uniquePartnerRooms} />
        </section>

        {/* Social links */}
        <section>
          <div
            className="card-reveal mb-5 flex items-center justify-between gap-4"
          >
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-foreground">
              Seguinos en redes
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  className={`group flex items-center justify-between bg-card px-4 py-3 rounded-lg border border-border transition-colors sm:py-4 ${
                    isDisabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/40"
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
                      isDisabled
                        ? ""
                        : "transition-transform group-hover:translate-x-1 group-hover:text-primary"
                    }`}
                  />
                </a>
              );
            })}
          </div>
        </section>
      </div>

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

      <LazyAIChatWidget autoOpen />
    </div>
  );
}
