import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { LazySupportChatWidget } from "@/components/LazySupportChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";

const LOGO_URL = "/Group%20789.svg";

function getInitial(name: string | null | undefined) {
  const cleanName = name?.trim();
  if (!cleanName) return "U";
  return cleanName[0]?.toUpperCase() ?? "U";
}

export function Navbar() {
  const { user, profile, isAnonymous, isAdmin, isStaff, signOut } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const staffLink = isAdmin
    ? { to: "/admin", label: "Admin" }
    : isStaff
      ? { to: "/admin/moderacion", label: "Moderación" }
      : null;

  const links = [
    { to: "/", label: "Inicio" },
    { to: "/calendario", label: "Calendario" },
    { to: "/noticias", label: "Noticias" },
    ...(user && !isAnonymous ? [{ to: "/feed", label: "Feed" }] : []),
    ...(staffLink ? [staffLink] : []),
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b border-primary/25 bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="group flex items-center">
          <span className={cn(
            "flex items-center transition-all duration-300",
            theme === "light" && "rounded-lg bg-[#1a0f2e] px-2 py-1"
          )}>
            <img
              src={LOGO_URL}
              alt="Fichas Online"
              className="h-8 w-auto object-contain drop-shadow-[0_0_14px_hsl(273_66%_66%_/_0.35)] transition-transform duration-300 group-hover:scale-[1.02] md:h-9"
            />
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-muted/40 p-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                location.pathname === l.to ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {location.pathname === l.to && (
                <span className="absolute inset-0 -z-10 rounded-full border border-primary/45 bg-primary/20 transition-all duration-200" />
              )}
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LazySupportChatWidget triggerVariant="header" />

          <div className="hidden md:flex items-center gap-3">
            {user && !isAnonymous ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {getInitial(profile?.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">
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
              <Button
                size="sm"
                onClick={() => navigate("/auth")}
                className="bg-primary text-primary-foreground font-semibold shadow-[0_0_16px_hsl(273_66%_56%_/_0.32)] hover:bg-primary/90"
              >
                Iniciar sesión
              </Button>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          className="mobile-nav-menu overflow-hidden border-b border-primary/20 bg-card md:hidden"
        >
          <div className="px-4 pb-4 pt-2 space-y-1">
            {links.map((l) => (
              <div key={l.to} className="mobile-nav-item">
                <Link
                  to={l.to}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                    location.pathname === l.to
                      ? "bg-primary/10 text-foreground border border-primary/30"
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
                className="mt-2 block w-full rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                Cerrar sesión
              </button>
            ) : (
              <Link
                to="/auth"
                className="mt-2 block rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
