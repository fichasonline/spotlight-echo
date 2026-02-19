import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EyeOff, XCircle } from "lucide-react";

interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
}

export default function AdminModeracion() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, status, created_at, profiles:reporter_id(display_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setReports(data as any);
  };

  useEffect(() => { fetchReports(); }, []);

  const handleHide = async (report: Report) => {
    if (report.target_type === "post") {
      await supabase.from("posts").update({ is_hidden: true }).eq("id", report.target_id);
    } else if (report.target_type === "comment") {
      await supabase.from("comments").update({ is_deleted: true }).eq("id", report.target_id);
    }
    await supabase.from("reports").update({ status: "resolved" }).eq("id", report.id);
    toast({ title: "Contenido oculto" });
    fetchReports();
  };

  const handleDismiss = async (id: string) => {
    await supabase.from("reports").update({ status: "dismissed" }).eq("id", id);
    fetchReports();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold mb-6">Moderación</h1>

        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{r.profiles?.display_name ?? "Anónimo"}</span> reportó un{" "}
                    <span className="text-accent font-semibold">{r.target_type}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">"{r.reason}"</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: es })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleHide(r)} title="Ocultar contenido">
                    <EyeOff className="h-4 w-4 mr-1" /> Ocultar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(r.id)} title="Descartar">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="text-muted-foreground text-center py-12">No hay reportes pendientes. 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
}
