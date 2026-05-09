import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar as CalIcon } from "lucide-react";
import { parseDateValue, getLocalDateISO } from "@/lib/date";

interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  description: string | null;
}

export default function CalendarioPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [countries, setCountries] = useState<string[]>([]);
  const today = getLocalDateISO();

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from("events").select("*").eq("status", "published").order("start_date");
      if (monthFilter !== "all") {
        const year = new Date().getFullYear();
        const month = parseInt(monthFilter);
        const start = `${year}-${String(month).padStart(2, "0")}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
        query = query.gte("start_date", start).lt("start_date", end);
      }
      if (countryFilter !== "all") {
        query = query.eq("country", countryFilter);
      }
      const { data } = await query;
      if (data) setEvents(data);
    };
    fetch();
  }, [monthFilter, countryFilter]);

  useEffect(() => {
    supabase.from("events").select("country").eq("status", "published").then(({ data }) => {
      if (data) {
        const unique = [...new Set(data.map((e) => e.country).filter(Boolean))] as string[];
        setCountries(unique);
      }
    });
  }, []);

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-3">Calendario de eventos de poker</h1>
        <p className="text-muted-foreground max-w-2xl mb-6">
          Todos los torneos y eventos de poker en Uruguay y la región: fechas, venues, buy-ins y garantizados.
          Encontrá eventos en Enjoy Punta del Este, Conrad, casinos en vivo y series online.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {months.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="País" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(() => {
          const liveEvents = events.filter((e) => {
            const end = e.end_date ?? e.start_date;
            return e.start_date <= today && end >= today;
          });
          const upcomingEvents = events.filter((e) => {
            const end = e.end_date ?? e.start_date;
            return !(e.start_date <= today && end >= today);
          });

          const EventCard = ({ e, index, live }: { e: Event; index: number; live: boolean }) => (
            <Link
              key={e.id}
              to={`/eventos/${e.id}`}
              style={{ "--card-reveal-delay": `${Math.min(index, 9) * 45}ms` } as CSSProperties}
              className={`card-reveal touch-manipulation rounded-lg p-5 transition-all group ${
                live
                  ? "bg-card border border-red-500/40 shadow-[0_0_24px_rgba(239,68,68,0.12)] hover:border-red-500/65 hover:shadow-[0_0_32px_rgba(239,68,68,0.2)]"
                  : "bg-card border border-border hover:border-accent/40 active:border-accent/45"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
                    live ? "bg-red-500/15" : "bg-accent/10"
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase ${live ? "text-red-400" : "text-accent"}`}>
                    {format(parseDateValue(e.start_date), "MMM", { locale: es })}
                  </span>
                  <span className={`text-base font-bold ${live ? "text-red-400" : "text-accent"}`}>
                    {format(parseDateValue(e.start_date), "d")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className={`font-display font-semibold text-foreground transition-colors truncate ${
                      live ? "group-hover:text-red-400" : "group-hover:text-accent group-active:text-accent"
                    }`}>
                      {e.name}
                    </h3>
                    {live && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/35 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        En vivo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    {[e.venue, e.city, e.country].filter(Boolean).join(" · ")}
                  </div>
                  {e.end_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <CalIcon className="h-3 w-3" />
                      Hasta {format(parseDateValue(e.end_date), "d MMM", { locale: es })}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );

          return (
            <>
              {liveEvents.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                    </span>
                    <span className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-red-400">
                      Eventos en vivo ahora
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveEvents.map((e, i) => (
                      <EventCard key={e.id} e={e} index={i} live />
                    ))}
                  </div>
                </div>
              )}

              {upcomingEvents.length > 0 && (
                <div>
                  {liveEvents.length > 0 && (
                    <p className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-muted-foreground mb-4">
                      Próximos eventos
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcomingEvents.map((e, i) => (
                      <EventCard key={e.id} e={e} index={i} live={false} />
                    ))}
                  </div>
                </div>
              )}

              {events.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    No hay eventos publicados.
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
