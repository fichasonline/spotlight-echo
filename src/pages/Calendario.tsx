import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar as CalIcon } from "lucide-react";
import { parseDateValue } from "@/lib/date";

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
        <h1 className="text-3xl font-display font-bold mb-6">Calendario de eventos</h1>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <Link
              key={e.id}
              to={`/eventos/${e.id}`}
              className="bg-card border border-border rounded-lg p-5 hover:border-accent/40 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-accent/10 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-[10px] text-accent font-semibold uppercase">
                    {format(parseDateValue(e.start_date), "MMM", { locale: es })}
                  </span>
                  <span className="text-base font-bold text-accent">
                    {format(parseDateValue(e.start_date), "d")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                    {e.name}
                  </h3>
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
          ))}
          {events.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-12">No hay eventos para los filtros seleccionados.</p>
          )}
        </div>
      </div>
    </div>
  );
}
