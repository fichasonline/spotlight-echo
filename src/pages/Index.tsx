import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { CryptoTicker } from "@/components/CryptoTicker";
import { BannerMedia } from "@/components/BannerMedia";
import { motion } from "framer-motion";
import { Calendar, Newspaper, MessageSquare, ArrowRight, Send, Instagram } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getLocalDateISO, parseDateValue } from "@/lib/date";

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
  position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  image_url: string | null;
  link_url: string | null;
  alt_text: string | null;
  is_active: boolean;
}

/* ─── Banner slot ─────────────────────────────────────────────── */
function BannerSlot({
  banner,
  className = "",
  imageClassName = "h-full w-full object-cover",
}: {
  banner: HomeBanner | undefined;
  className?: string;
  imageClassName?: string;
}) {
  const hasImage = !!(banner?.image_url && banner.is_active);

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
}: {
  banner: HomeBanner | undefined;
  className?: string;
}) {
  const hasImage = !!(banner?.image_url && banner.is_active);

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
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents]     = useState<Event[]>([]);
  const [banners, setBanners]   = useState<Record<string, HomeBanner>>({});
  const today                   = getLocalDateISO();
  const articlesScrollerRef     = useRef<HTMLDivElement | null>(null);
  const newsAutoScrollPausedRef = useRef(false);

  const instagramUrl = import.meta.env.VITE_INSTAGRAM_URL?.trim() || "https://instagram.com/fichasonlineuy";
  const telegramUrl  = import.meta.env.VITE_TELEGRAM_URL?.trim()  || "https://t.me/+59891856965";
  const whatsappUrl  = import.meta.env.VITE_WHATSAPP_URL?.trim()  || "https://wa.me";

  const socialLinks = [
    { label: "Instagram", href: instagramUrl, description: "Fotos, clips y anuncios",        icon: Instagram },
    { label: "Telegram",  href: telegramUrl,  description: "Canal de novedades",              icon: Send },
    { label: "WhatsApp",  href: whatsappUrl,  description: "Contacto directo (proximamente)", icon: MessageSquare, disabled: true },
  ];

  useEffect(() => {
    (async () => {
      const today = getLocalDateISO();
      const [artRes, evtRes, bannerRes] = await Promise.all([
        supabase
          .from("articles")
          .select("id, slug, headline, summary, image_url, published_at")
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
          .from("home_banners")
          .select("position, image_url, link_url, alt_text, is_active"),
      ]);

      if (artRes.data) setArticles(artRes.data);
      if (evtRes.data) setEvents(evtRes.data);
      if (bannerRes.data) {
        const map: Record<string, HomeBanner> = {};
        for (const b of bannerRes.data as HomeBanner[]) map[b.position] = b;
        setBanners(map);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const container = articlesScrollerRef.current;
    if (!container || articles.length <= 3) return;

    const desktopMq = window.matchMedia("(min-width: 1024px)");
    if (!desktopMq.matches) return;

    const intervalId = window.setInterval(() => {
      if (newsAutoScrollPausedRef.current || document.hidden) return;

      const firstCard = container.querySelector<HTMLElement>("[data-news-card='true']");
      const computedStyle = window.getComputedStyle(container);
      const gapValue = computedStyle.columnGap !== "normal" ? computedStyle.columnGap : computedStyle.gap;
      const gap = Number.parseFloat(gapValue || "0") || 0;
      const step = firstCard ? firstCard.getBoundingClientRect().width + gap : container.clientWidth;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;

      if (maxScrollLeft <= 0) return;

      if (container.scrollLeft >= maxScrollLeft - step * 0.45) {
        container.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      container.scrollBy({ left: step, behavior: "smooth" });
    }, 4200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [articles.length]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ══════════════════════════════════════════════════════════════
          HERO — fills the full remaining viewport height
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden flex flex-col"
        style={{
          minHeight: "calc(100vh - 64px)",
          background:
            "radial-gradient(circle at 50% 38%, rgba(86,49,116,0.34), rgba(14,9,19,0.96) 54%, #09060f 100%)",
        }}
      >
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
              <PortraitBannerSlot banner={banners["top_left"]} className="hidden lg:flex" />

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="flex w-full max-w-[720px] flex-1 flex-col items-center justify-center px-2 py-5 text-center sm:py-8 lg:min-h-[443px] lg:px-4 lg:py-4"
              >
                <h1
                  className="font-display font-black uppercase leading-[0.9] tracking-[-0.05em] text-balance select-none"
                  style={{ fontSize: "clamp(2.65rem, 5.2vw, 4.0625rem)" }}
                >
                  <span className="block text-[#8f3cf9] lg:whitespace-nowrap">NOTICIAS, EVENTOS</span>
                  <span className="block lg:whitespace-nowrap">
                    <span className="text-[#8f3cf9]">Y COMUNIDAD</span>{" "}
                    <span className="text-white">EN UN</span>
                  </span>
                  <span className="block text-white lg:whitespace-nowrap">SOLO LUGAR</span>
                </h1>

                <p className="mt-6 max-w-[560px] text-sm font-semibold uppercase tracking-[0.03em] text-white/42 md:text-[15px]">
                  Todo el ecosistema de Fichas Online en un solo lugar
                </p>

                <SupportChatWidget triggerVariant="hero" />
              </motion.div>

              <PortraitBannerSlot banner={banners["top_right"]} className="hidden lg:flex" />
            </div>

            <div className="mt-3 hidden grid-cols-2 gap-3 sm:grid lg:hidden">
              <BannerSlot
                banner={banners["top_left"]}
                className="aspect-[231/411] rounded-[24px]"
              />
              <BannerSlot
                banner={banners["top_right"]}
                className="aspect-[231/411] rounded-[24px]"
              />
            </div>
          </div>

          <div className="mt-5 hidden items-center justify-center gap-6 lg:flex">
            <BannerSlot
              banner={banners["bottom_left"]}
              className="h-[182px] w-[572px] shrink-0 rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
            />
            <BannerSlot
              banner={banners["bottom_right"]}
              className="h-[182px] w-[572px] shrink-0 rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
            <BannerSlot
              banner={banners["bottom_left"]}
              className="aspect-[572/182] rounded-[24px]"
            />
            <BannerSlot
              banner={banners["bottom_right"]}
              className="aspect-[572/182] rounded-[24px]"
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
            <div className="mb-3 flex items-center justify-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/40 lg:justify-end">
              <span>Se mueve solo</span>
              <motion.span
                aria-hidden="true"
                className="inline-flex items-center"
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
              <span>También podés arrastrar</span>
            </div>
          )}
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-white">
              Ultimas noticias
            </p>
            <Link
              to="/noticias"
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-white transition-colors hover:border-primary/50 hover:bg-primary/30"
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
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onMouseEnter={() => {
                newsAutoScrollPausedRef.current = true;
              }}
              onMouseLeave={() => {
                newsAutoScrollPausedRef.current = false;
              }}
              onTouchStart={() => {
                newsAutoScrollPausedRef.current = true;
              }}
              onTouchEnd={() => {
                newsAutoScrollPausedRef.current = false;
              }}
              onFocus={() => {
                newsAutoScrollPausedRef.current = true;
              }}
              onBlur={() => {
                newsAutoScrollPausedRef.current = false;
              }}
            >
            {articles.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                data-news-card="true"
                className="min-w-0 shrink-0 snap-start basis-[84%] sm:basis-[68%] lg:basis-[371px]"
              >
                <Link
                  to={`/noticias/${a.slug}`}
                  className="group flex h-full overflow-hidden rounded-[30px] border border-white/20 bg-[#E7E7E7] p-[14px] shadow-[0_22px_45px_rgba(0,0,0,0.22)] transition-transform duration-300 hover:-translate-y-1 lg:h-[490px]"
                >
                  <div className="flex h-full w-full flex-col">
                  <div className="shrink-0 overflow-hidden rounded-[24px] bg-[#d8d8de] lg:h-[308px]">
                    {a.image_url ? (
                      <BannerMedia
                        src={a.image_url}
                        alt={a.headline}
                        className="aspect-[0.92] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] lg:aspect-auto"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-[0.92] h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(157,78,221,0.45),_rgba(28,19,38,0.96)_72%)] p-6 text-center lg:aspect-auto">
                        <div>
                          <p className="font-display text-3xl font-black uppercase leading-[0.88] tracking-[-0.05em] text-white">
                            Fichas
                            <br />
                            Online
                          </p>
                          <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/55">
                            Ultimas noticias
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4 pt-5 text-center">
                    <h3 className="font-display line-clamp-4 text-[1.5rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-[#5f5f66]">
                      {a.summary || a.headline}
                    </h3>
                  </div>

                  {a.published_at && (
                    <p className="px-4 pb-4 text-center text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#8a8a93]">
                      {format(parseDateValue(a.published_at), "d MMM yyyy", { locale: es })}
                    </p>
                  )}
                  </div>
                </Link>
              </motion.div>
            ))}
            {articles.length === 0 && (
              <div className="w-full rounded-[30px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
                  No hay noticias publicadas aun.
                </p>
              </div>
            )}
            </div>
          </div>

          {articles.length > 0 && (
            <div className="mt-6 flex justify-center xl:hidden">
              <Link
                to="/noticias"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-primary/35 hover:bg-primary/10"
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
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-white">
              Calendario
            </p>
            <Link
              to="/calendario"
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-white transition-colors hover:border-accent/45 hover:bg-accent/15"
            >
              <Calendar className="h-4 w-4" />
              Ver calendario
            </Link>
          </div>

          {events.length > 1 && (
            <div className="mb-4 flex items-center justify-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/40 lg:justify-end">
              <span>Deslizá para ver más eventos</span>
              <motion.span
                aria-hidden="true"
                className="inline-flex items-center"
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            </div>
          )}

          <div className="relative">
            {events.length > 1 && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-background via-background/80 to-transparent lg:block" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-background via-background/84 to-transparent lg:block" />
              </>
            )}

            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {events.map((e, i) => {
              const eventEndDate = e.end_date ?? e.start_date;
              const isLive = e.start_date <= today && eventEndDate >= today;
              const location = [e.venue, e.city, e.country].filter(Boolean).join(" · ");
              const monthLabel = format(parseDateValue(e.start_date), "MMM", { locale: es }).toUpperCase();
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="min-w-0 shrink-0 snap-start basis-[88%] sm:basis-[72%] lg:basis-[500px]"
                >
                  <Link
                    to={`/eventos/${e.id}`}
                    className="group flex min-h-[136px] items-center gap-4 rounded-[18px] border border-white/12 bg-[#130e18] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-colors hover:border-accent/35"
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
                        <h3 className="font-display line-clamp-2 text-[1.05rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-white lg:text-[1.15rem]">
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

                      <p className="line-clamp-2 text-[0.9rem] font-medium uppercase leading-[1.02] tracking-[0.01em] text-white/32 lg:text-[1rem]">
                        {location || "Evento destacado en fichas online"}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            {events.length === 0 && (
              <div className="w-full rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
                  No hay eventos en curso ni proximos.
                </p>
              </div>
            )}
            </div>
          </div>
        </section>

        {/* Social links */}
        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-white">
              Seguinos en redes
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
                  onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
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
                </motion.a>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
