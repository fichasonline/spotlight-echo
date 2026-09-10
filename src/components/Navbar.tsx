import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut, Shield, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LazySupportChatWidget } from "@/components/LazySupportChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ARTICLE_CATEGORIES } from "@/lib/taxonomy";
import { getLocalDateISO } from "@/lib/date";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SHOW_FEED } from "@/lib/feature-flags";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";

/*
 * El masthead vive siempre sobre violeta profundo (el manual lo trata como
 * pieza de marca, no como superficie del tema), así que los controles que
 * heredan color del tema — ThemeToggle y el disparador del chat — se fuerzan
 * al gris claro desde acá en vez de duplicar esos componentes.
 */
const ON_VIOLET_ICON_BUTTON =
  "[&_button]:h-9 [&_button]:w-9 [&_button]:text-brand-light/80 [&_button:hover]:bg-brand-light/10 [&_button:hover]:text-brand-light";

function getInitial(name: string | null | undefined) {
  const cleanName = name?.trim();
  if (!cleanName) return "U";
  return cleanName[0]?.toUpperCase() ?? "U";
}

/** Evento en curso hoy, para la franja "EN VIVO" de la barra utilitaria. */
function useLiveEvent() {
  const [liveEvent, setLiveEvent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = getLocalDateISO();

    void (async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, start_date, end_date")
        .eq("status", "published")
        .lte("start_date", today)
        .or(`end_date.gte.${today},end_date.is.null`)
        .order("start_date", { ascending: false })
        .limit(1);

      if (!cancelled && data?.[0]) setLiveEvent({ id: data[0].id, name: data[0].name });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return liveEvent;
}

export function Navbar() {
  const { user, profile, isAnonymous, isAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const liveEvent = useLiveEvent();

  const staffLink = isAdmin
    ? { to: "/admin", label: "Admin" }
    : isStaff
      ? { to: "/admin/moderacion", label: "Moderación" }
      : null;

  /*
   * Nav editorial: las 5 categorías del manual + calendario + el archivo.
   * Va en su propia fila y siempre visible — antes estaba dentro del masthead
   * en `xl:flex`, así que abajo de 1280px las categorías desaparecían y sólo
   * se llegaba a ellas por el menú hamburguesa.
   */
  const sectionLinks = [
    ...ARTICLE_CATEGORIES.map((c) => ({ to: `/${c.slug}`, label: c.label })),
    { to: "/calendario", label: "Calendario" },
    { to: "/noticias", label: "Todas" },
    ...(SHOW_FEED && user && !isAnonymous ? [{ to: "/feed", label: "Feed" }] : []),
  ];

  /*
   * El menú desplegable queda sólo para mobile (abajo de `md`), que es donde
   * la búsqueda y el login no entran en la barra. De `md` para arriba esos dos
   * ya están en el masthead y las secciones en su propia fila, así que el
   * botón de hamburguesa no tendría nada que ofrecer.
   */
  const mobileLinks = [
    { to: "/", label: "Inicio" },
    ...sectionLinks,
    ...(staffLink ? [staffLink] : []),
  ];

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    navigate(`/noticias?q=${encodeURIComponent(term)}`);
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50">
      {/* ── Barra utilitaria ─────────────────────────────────────────── */}
      <div className="hidden h-[34px] items-center justify-between bg-[hsl(273_100%_13%)] px-4 md:flex lg:px-10">
        {liveEvent ? (
          <Link
            to={`/eventos/${liveEvent.id}`}
            className="flex items-center gap-1.5 text-[11px] font-semibold leading-ui tracking-[0.05em] text-brand-light hover:underline"
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-red-500" />
            EN VIVO: {liveEvent.name}
          </Link>
        ) : (
          <span className="text-[11px] font-semibold leading-ui tracking-[0.05em] text-brand-light/70">
            El portal del póker en Hispanoamérica
          </span>
        )}

        <div className="flex items-center gap-4 text-[11px] font-medium text-brand-light/60">
          <span className="first-letter:uppercase">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </span>
          <span className="opacity-50">|</span>
          <span>Edición Hispanoamérica</span>
        </div>
      </div>

      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <div className="border-b border-brand-violet/40 bg-brand-violet-deep">
        <div className="flex h-[68px] items-center justify-between gap-4 px-4 lg:h-[78px] lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-3 xl:gap-5">
            <Link to="/" className="logo-pop flex shrink-0 items-center gap-2.5" aria-label="Fichas News — ir al inicio">
              {/*
                El lockup nuevo apila "FICHAS / NEWS" en dos líneas (relación
                ~2.2:1 contra ~4:1 del anterior), así que necesita más alto
                para que la tipografía quede al mismo tamaño óptico que antes.
              */}
              <img
                src={BRAND_LOGO_URL}
                alt={BRAND_NAME}
                className="h-11 w-auto object-contain xl:h-16"
              />
            </Link>

            {/*
              En escritorio las secciones van en la misma línea que el logo.
              La fila se encoge (`flex-1 min-w-0`) y scrollea cuando no entra,
              en vez de desbordar sobre los controles de la derecha. Medir un
              ancho mínimo y elegir breakpoint era frágil: dependía de cuántas
              secciones haya y de si el usuario tiene sesión (el nombre al lado
              del avatar ocupa más que el botón "Iniciar sesión"). Así entra en
              cualquier ancho. Abajo de `md` sigue la fila propia de más abajo.
            */}
            <nav
              aria-label="Secciones"
              className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {sectionLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  aria-current={location.pathname === l.to ? "page" : undefined}
                  className={cn(
                    "nav-pill shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12.5px] font-medium leading-ui transition-colors xl:px-3 xl:text-[13px]",
                    location.pathname === l.to
                      ? "bg-brand-light text-brand-violet-deep"
                      : "text-brand-light/75 hover:bg-brand-light/10 hover:text-brand-light",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            {searchOpen ? (
              <form onSubmit={submitSearch} className="hidden items-center md:flex">
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => !query && setSearchOpen(false)}
                  placeholder="Buscar noticias…"
                  aria-label="Buscar noticias"
                  className="h-9 w-[220px] rounded-md border border-brand-light/25 bg-brand-light/10 px-3 text-[13px] text-brand-light placeholder:text-brand-light/50 focus:outline-none focus:ring-2 focus:ring-brand-violet-bright"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar"
                className="hidden h-9 w-9 items-center justify-center rounded-full text-brand-light/80 transition-colors hover:bg-brand-light/10 hover:text-brand-light md:flex"
              >
                <Search className="h-[18px] w-[18px]" />
              </button>
            )}

            <span className={ON_VIOLET_ICON_BUTTON}>
              <ThemeToggle />
            </span>
            <span className={ON_VIOLET_ICON_BUTTON}>
              <LazySupportChatWidget triggerVariant="header" />
            </span>

            <div className="hidden items-center gap-3 md:flex">
              {user && !isAnonymous ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 transition-opacity hover:opacity-80">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-brand-violet text-xs text-brand-light">
                          {getInitial(profile?.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[140px] truncate text-sm font-medium text-brand-light xl:inline">
                        {profile?.display_name ?? "Usuario"}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <Shield className="mr-2 h-4 w-4" /> Admin
                      </DropdownMenuItem>
                    )}
                    {isStaff && (
                      <DropdownMenuItem onClick={() => navigate("/admin/moderacion")}>
                        <Shield className="mr-2 h-4 w-4" /> Moderación
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="h-9 rounded-md bg-brand-violet px-5 text-[13px] font-bold leading-ui text-brand-light transition-colors hover:bg-brand-violet-bright"
                >
                  Iniciar sesión
                </button>
              )}
            </div>

            <button
              className="text-brand-light md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Fila de secciones ────────────────────────────────────────── */}
      <div className="border-b border-brand-violet/40 bg-brand-violet-deep md:hidden">
        {/*
          Scroll horizontal en vez de menú desplegable: en mobile las siete
          pastillas no entran, pero arrastrando se llegan a todas sin abrir
          nada. La barra de scroll se oculta porque el corte de la última
          pastilla ya avisa que hay más.
        */}
        <nav
          aria-label="Secciones"
          className="flex gap-1 overflow-x-auto px-4 pb-2 lg:px-10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sectionLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              aria-current={location.pathname === l.to ? "page" : undefined}
              className={cn(
                "nav-pill shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium leading-ui transition-colors",
                location.pathname === l.to
                  ? "bg-brand-light text-brand-violet-deep"
                  : "text-brand-light/75 hover:bg-brand-light/10 hover:text-brand-light",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Menú mobile ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          className="mobile-nav-menu overflow-hidden border-b border-border bg-card md:hidden"
        >
          <div className="space-y-1 px-4 pb-4 pt-3">
            <form onSubmit={submitSearch} className="mb-3 flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar noticias…"
                aria-label="Buscar noticias"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>

            {mobileLinks.map((l) => (
              <div key={l.to} className="mobile-nav-item">
                <Link
                  to={l.to}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    location.pathname === l.to
                      ? "border border-primary/30 bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              </div>
            ))}

            {user && !isAnonymous ? (
              <button
                onClick={signOut}
                className="mt-2 block w-full rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                Cerrar sesión
              </button>
            ) : (
              <Link
                to="/auth"
                className="mt-2 block rounded-md px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
