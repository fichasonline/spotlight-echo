import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ExternalLink, Loader2, Plus, Radio, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SocialSource = {
  id: string;
  type: string;
  url: string;
  enabled: boolean;
  poll_interval_minutes: number;
  max_stories_per_hour: number;
  created_at: string;
  updated_at: string;
};

const socialSourcesTable = (supabase as any).from("social_sources");

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

export default function AdminLiveblogs() {
  const { toast } = useToast();
  const [sources, setSources] = useState<SocialSource[]>([]);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [maxStoriesPerHour, setMaxStoriesPerHour] = useState("3");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await socialSourcesTable
      .select("id, type, url, enabled, poll_interval_minutes, max_stories_per_hour, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "No se pudieron cargar los liveblogs",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSources((data ?? []) as SocialSource[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchSources();
  }, []);

  const handleCreateSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUrl = normalizeUrl(url);
    const parsedMaxStories = Number(maxStoriesPerHour);

    if (!normalizedUrl) {
      toast({ title: "Falta la URL", description: "Agregá el link del liveblog para crear la fuente." });
      return;
    }

    if (!Number.isInteger(parsedMaxStories) || parsedMaxStories < 1) {
      toast({
        title: "Máximo inválido",
        description: "Usá un número entero mayor a cero para stories por hora.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await socialSourcesTable.insert({
      url: normalizedUrl,
      enabled,
      max_stories_per_hour: parsedMaxStories,
    });
    setSaving(false);

    if (error) {
      toast({
        title: "No se pudo crear la fuente",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setUrl("");
    setEnabled(false);
    setMaxStoriesPerHour("3");
    toast({ title: "Liveblog creado", description: "La fuente quedó lista para que la ingesta externa la lea." });
    void fetchSources();
  };

  const handleToggleSource = async (source: SocialSource, nextEnabled: boolean) => {
    setSources((current) =>
      current.map((entry) => (entry.id === source.id ? { ...entry, enabled: nextEnabled } : entry)),
    );

    const { error } = await socialSourcesTable.update({ enabled: nextEnabled }).eq("id", source.id);

    if (error) {
      setSources((current) =>
        current.map((entry) => (entry.id === source.id ? { ...entry, enabled: source.enabled } : entry)),
      );
      toast({
        title: "No se pudo actualizar el liveblog",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: nextEnabled ? "Liveblog activado" : "Liveblog pausado",
      description: nextEnabled ? "La fuente queda disponible para polling." : "La ingesta externa debería ignorarla.",
    });
    void fetchSources();
  };

  const activeCount = sources.filter((source) => source.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
            <h1 className="text-3xl font-display font-bold">Liveblogs</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Fuentes configurables para que el servicio externo de ingesta detecte novedades y genere piezas sociales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              Activos: {activeCount}
            </Badge>
            <Badge variant="outline">{sources.length} fuentes</Badge>
          </div>
        </div>

        <section className="mb-5 rounded-xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Plus className="h-3.5 w-3.5" />
                Nueva fuente
              </div>
              <h2 className="mt-3 text-xl font-display font-bold">Crear liveblog</h2>
            </div>
          </div>

          <form onSubmit={handleCreateSource} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto] lg:items-end">
            <div>
              <Label htmlFor="liveblog-url">URL</Label>
              <Input
                id="liveblog-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="max-stories">Stories por hora</Label>
              <Input
                id="max-stories"
                type="number"
                min={1}
                step={1}
                value={maxStoriesPerHour}
                onChange={(event) => setMaxStoriesPerHour(event.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="source-enabled" />
              <Label htmlFor="source-enabled" className="cursor-pointer">Activo</Label>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Radio className="h-3.5 w-3.5" />
                Fuentes
              </div>
              <h2 className="mt-3 text-xl font-display font-bold">Liveblogs configurados</h2>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchSources()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando liveblogs...
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Todavía no hay liveblogs configurados.
            </div>
          ) : (
            <div className="grid gap-3">
              {sources.map((source) => (
                <article key={source.id} className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={source.enabled ? "default" : "outline"}>
                          {source.enabled ? "Activo" : "Pausado"}
                        </Badge>
                        <Badge variant="outline">{source.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Actualizado hace {formatDistanceToNow(new Date(source.updated_at), { locale: es })}
                        </span>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
                      >
                        <span className="truncate">{source.url}</span>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </a>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md border border-border px-2 py-1">
                          Polling cada {source.poll_interval_minutes} min
                        </span>
                        <span className="rounded-md border border-border px-2 py-1">
                          Máx. {source.max_stories_per_hour} stories/h
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                      <Switch
                        checked={source.enabled}
                        onCheckedChange={(nextEnabled) => void handleToggleSource(source, nextEnabled)}
                        id={`source-${source.id}`}
                      />
                      <Label htmlFor={`source-${source.id}`} className="cursor-pointer">
                        {source.enabled ? "Activo" : "Pausado"}
                      </Label>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
