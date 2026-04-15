import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { openSupportChat } from "@/lib/supportChat";

interface PartnerRoom {
  logo: string;
  alt?: string;
  scale?: number;
  logoClassName?: string;
  href?: string;
}

interface PartnerMarqueeProps {
  rooms: PartnerRoom[];
}

const MARQUEE_SPEED_PX_PER_SECOND = 72;
const REDUCED_MOTION_SPEED_FACTOR = 0.45;
const MIN_MARQUEE_DURATION_SECONDS = 16;

export function PartnerMarquee({ rooms }: PartnerMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(28);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const canHover = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  useEffect(() => {
    const updateMetrics = () => {
      const sequenceWidth = sequenceRef.current?.getBoundingClientRect().width ?? 0;
      if (sequenceWidth <= 0) return;

      const speed = prefersReducedMotion
        ? MARQUEE_SPEED_PX_PER_SECOND * REDUCED_MOTION_SPEED_FACTOR
        : MARQUEE_SPEED_PX_PER_SECOND;
      const nextDuration = Math.max(MIN_MARQUEE_DURATION_SECONDS, sequenceWidth / speed);

      setDurationSeconds((current) => (Math.abs(current - nextDuration) > 0.05 ? nextDuration : current));
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateMetrics) : null;
    if (observer) {
      if (containerRef.current) observer.observe(containerRef.current);
      if (sequenceRef.current) observer.observe(sequenceRef.current);
    } else {
      window.addEventListener("resize", updateMetrics);
    }

    const images = sequenceRef.current?.querySelectorAll("img") ?? [];
    const imageListeners: Array<{ img: HTMLImageElement; handler: () => void }> = [];
    images.forEach((img) => {
      const htmlImg = img as HTMLImageElement;
      if (!htmlImg.complete) {
        const handler = () => updateMetrics();
        htmlImg.addEventListener("load", handler, { once: true });
        htmlImg.addEventListener("error", handler, { once: true });
        imageListeners.push({ img: htmlImg, handler });
      }
    });

    updateMetrics();

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", updateMetrics);
      }

      imageListeners.forEach(({ img, handler }) => {
        img.removeEventListener("load", handler);
        img.removeEventListener("error", handler);
      });
    };
  }, [prefersReducedMotion]);

  const trackStyle = useMemo(
    () =>
      ({
        animationPlayState: isPaused ? "paused" : "running",
        "--partner-marquee-duration": `${durationSeconds}s`,
      }) as CSSProperties,
    [durationSeconds, isPaused]
  );

  const handleMouseEnter = () => {
    if (canHover) setIsPaused(true);
  };

  const handleMouseLeave = () => {
    if (canHover) setIsPaused(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-clip"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background via-background/88 to-transparent sm:w-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background via-background/88 to-transparent sm:w-16" />

      <div className="overflow-hidden py-2">
        <div style={trackStyle} className="partner-marquee-track flex w-max gap-3 pr-3 will-change-transform">
          <div ref={sequenceRef} className="flex w-max gap-3 pr-3">
            {rooms.map((room, i) => (
              <LogoCard key={`${room.logo}-a-${i}`} room={room} />
            ))}
          </div>
          <div className="flex w-max gap-3 pr-3" aria-hidden="true">
            {rooms.map((room, i) => (
              <LogoCard key={`${room.logo}-b-${i}`} room={room} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoCard({ room }: { room: PartnerRoom }) {
  const cardClassName =
    "group relative flex h-[86px] w-[210px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-[#140f1b] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.2)] transition-[border-color,box-shadow] duration-300 ease-out hover:border-accent/45 hover:shadow-[0_18px_40px_rgba(143,60,249,0.25)]";

  const content = (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(172,102,255,0.20),transparent_70%)] opacity-60" />
      <div className="relative flex h-full items-center justify-center overflow-hidden">
        <img
          src={room.logo}
          alt={room.alt || "Logo de sala"}
          loading="lazy"
          decoding="async"
          className={`h-[34px] w-[140px] transform-gpu object-contain brightness-95 transition-[filter] duration-300 group-hover:brightness-110 ${room.logoClassName ?? ""}`}
          style={{ transform: `scale(${room.scale ?? 1.95})` }}
        />
      </div>
    </>
  );

  if (room.href) {
    return (
      <a
        href={room.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={room.alt ? `Abrir oferta de ${room.alt}` : "Abrir oferta de sala"}
        className={`${cardClassName} cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={openSupportChat}
      aria-label={room.alt ? `Abrir chat para ${room.alt}` : "Abrir chat para conseguir un deal"}
      className={`${cardClassName} cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      {content}
    </button>
  );
}
