import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface PartnerRoom {
  logo: string;
  alt?: string;
  scale?: number;
  logoClassName?: string;
}

interface PartnerMarqueeProps {
  rooms: PartnerRoom[];
}

export function PartnerMarquee({ rooms }: PartnerMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef     = useRef<HTMLDivElement>(null);
  const tweenRef     = useRef<gsap.core.Tween | null>(null);

  // Duplicate for seamless loop
  const doubled = [...rooms, ...rooms];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          motion:       "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { reduceMotion } = ctx.conditions!;

          if (reduceMotion) return;

          tweenRef.current = gsap.to(trackRef.current, {
            xPercent: -50,
            duration: 28,
            ease: "none",
            repeat: -1,
          });
        }
      );

      return () => mm.revert();
    },
    { scope: containerRef }
  );

  const handleMouseEnter = () => tweenRef.current?.pause();
  const handleMouseLeave = () => tweenRef.current?.resume();

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Edge fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

      <div className="py-2">
        <div ref={trackRef} className="flex w-max gap-3 pr-3">
          {doubled.map((room, i) => (
            <LogoCard key={`${room.logo}-${i}`} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LogoCard({ room }: { room: PartnerRoom }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    gsap.to(cardRef.current, {
      scale: 1.06,
      y: -4,
      borderColor: "rgba(143,60,249,0.45)",
      boxShadow: "0 18px 40px rgba(143,60,249,0.25)",
      duration: 0.3,
      ease: "power2.out",
    });
  };

  const handleLeave = () => {
    gsap.to(cardRef.current, {
      scale: 1,
      y: 0,
      borderColor: "rgba(255,255,255,0.12)",
      boxShadow: "0 14px 32px rgba(0,0,0,0.2)",
      duration: 0.4,
      ease: "power2.inOut",
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="group relative h-[86px] w-[210px] shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-[#140f1b] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.2)] cursor-default"
      style={{ willChange: "transform" }}
    >
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
    </div>
  );
}
