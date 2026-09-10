import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Send, MessageCircle } from "lucide-react";
import ShinyText from "./ShinyText";
import { ARTICLE_CATEGORIES } from "@/lib/taxonomy";
import { SOCIAL_URLS } from "@/lib/social";
import { openSupportChat } from "@/lib/supportChat";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";

const PORTAL_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/noticias", label: "Todas las noticias" },
  { to: "/calendario", label: "Calendario" },
  { to: "/salas", label: "Salas" },
];

const SOCIALS = [
  { href: SOCIAL_URLS.instagram, label: "Instagram", icon: Instagram },
  { href: SOCIAL_URLS.telegram, label: "Telegram", icon: Send },
];

const Footer: React.FC = () => {
  return (
    <footer className="mt-14 border-t border-border bg-muted/50">
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-11 lg:px-10">
        <div className="grid gap-10 border-b border-border pb-9 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3.5">
            <img src={BRAND_LOGO_URL} alt={BRAND_NAME} className="h-12 w-auto self-start object-contain" />
            <p className="max-w-[300px] text-xs leading-body text-muted-foreground">
              El portal de noticias del póker en Hispanoamérica: torneos en vivo, resultados,
              entrevistas y la agenda regional en un solo lugar.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase leading-caption tracking-caption text-muted-foreground">
              Secciones
            </span>
            {ARTICLE_CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to={`/${c.slug}`}
                className="text-xs text-foreground transition-colors hover:text-primary"
              >
                {c.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase leading-caption tracking-caption text-muted-foreground">
              Portal
            </span>
            {PORTAL_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs text-foreground transition-colors hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase leading-caption tracking-caption text-muted-foreground">
              Seguinos
            </span>
            <div className="flex gap-2.5">
              {SOCIALS.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-primary transition-colors hover:border-primary/50"
                >
                  <Icon className="h-[15px] w-[15px]" />
                </a>
              ))}
              <button
                type="button"
                onClick={openSupportChat}
                aria-label="Abrir chat de contacto"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-primary transition-colors hover:border-primary/50"
              >
                <MessageCircle className="h-[15px] w-[15px]" />
              </button>
            </div>
            <button
              type="button"
              onClick={openSupportChat}
              className="self-start text-xs text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
            >
              Contacto
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 py-4 sm:flex-row">
          <span className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Fichas News. Todos los derechos reservados.
          </span>
          <a
            href="https://grupodte.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            <ShinyText
              text="Built by DTE"
              speed={2}
              delay={0}
              color="#b5b5b5"
              shineColor="#C5C5C5"
              spread={120}
              direction="left"
              yoyo={false}
              pauseOnHover={false}
              disabled={false}
              fontSize={11}
            />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
