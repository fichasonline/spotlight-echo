import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Star } from "lucide-react";
import { SALA_TYPE_LABEL, type SalaCard } from "@/lib/salas";

export default function SalasPage() {
  const [salas, setSalas] = useState<SalaCard[]>([]);

  useEffect(() => {
    supabase
      .from("salas")
      .select("id, slug, name, type, short_description, logo_url, deal_headline, rating_overall")
      .eq("status", "published")
      .order("rating_overall", { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (data) setSalas(data as SalaCard[]);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-3">
          Salas de Poker en Uruguay
        </h1>
        <p className="text-muted-foreground max-w-2xl mb-8">
          Comparativa de las mejores salas de poker online y casinos en vivo para jugadores uruguayos.
          Encontrá deals exclusivos, bonos de bienvenida, rakeback y toda la información sobre
          GG Poker, ACR, PokerStars, Enjoy y más.
        </p>

        {salas.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Próximamente.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {salas.map((sala, index) => (
            <Link
              key={sala.id}
              to={`/salas/${sala.slug}`}
              style={{ "--card-reveal-delay": `${Math.min(index, 9) * 45}ms` } as CSSProperties}
              className="card-reveal touch-manipulation bg-card border border-border rounded-lg p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {sala.logo_url ? (
                  <img src={sala.logo_url} alt={sala.name} className="h-10 w-10 object-contain rounded" />
                ) : (
                  <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {sala.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold group-hover:text-primary transition-colors truncate">
                    {sala.name}
                  </h3>
                  <span className="text-xs text-muted-foreground">{SALA_TYPE_LABEL[sala.type]}</span>
                </div>
                {sala.rating_overall != null && (
                  <div className="flex items-center gap-1 text-sm font-bold text-yellow-500 shrink-0">
                    <Star className="h-3.5 w-3.5 fill-yellow-500" />
                    {sala.rating_overall.toFixed(1)}
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">{sala.short_description}</p>

              {sala.deal_headline && (
                <div className="text-xs font-semibold text-primary bg-primary/10 rounded px-2 py-1 w-fit">
                  {sala.deal_headline}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
