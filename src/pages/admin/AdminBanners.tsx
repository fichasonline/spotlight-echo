import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BannerMedia } from "@/components/BannerMedia";
import { Loader2, Upload, X, ExternalLink } from "lucide-react";

type Position = "top_left" | "top_right" | "bottom_left" | "bottom_right" | "content_vertical";

interface Banner {
  position: Position;
  image_url: string | null;
  link_url: string | null;
  affiliate_code: string | null;
  alt_text: string | null;
  is_active: boolean;
}

const POSITION_LABELS: Record<Position, string> = {
  top_left:     "Superior izquierdo",
  top_right:    "Superior derecho",
  bottom_left:  "Inferior izquierdo",
  bottom_right: "Inferior derecho",
  content_vertical: "Contenido vertical (anuncio 5)",
};

const POSITIONS: Position[] = ["top_left", "top_right", "bottom_left", "bottom_right", "content_vertical"];

function getBannerUploadContentType(file: File) {
  if (file.type) return file.type;

  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

function BannerCard({ banner, onSave }: { banner: Banner; onSave: (updated: Banner) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Banner>(banner);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Keep in sync if parent refreshes
  useEffect(() => { setForm(banner); }, [banner]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const contentType = getBannerUploadContentType(file);
    const path = `${form.position}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("home-banners")
      .upload(path, file, {
        upsert: true,
        contentType,
      });

    if (upErr) {
      const description = /mime type/i.test(upErr.message)
        ? `${upErr.message}. El bucket remoto todavia no tiene habilitado este formato.`
        : upErr.message;

      toast({ title: "Error al subir media", description, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("home-banners").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast({ title: "Media subida correctamente" });
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("home_banners")
      .update({
        image_url: form.image_url || null,
        link_url:  form.link_url  || null,
        affiliate_code: form.affiliate_code || null,
        alt_text:  form.alt_text  || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("position", form.position);

    setSaving(false);
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Banner guardado" });
    onSave(form);
  };

  const clearMedia = () => setForm((f) => ({ ...f, image_url: null }));

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground">
          {POSITION_LABELS[form.position]}
        </h3>
        <div className="flex items-center gap-2">
          <Label htmlFor={`active-${form.position}`} className="text-sm text-muted-foreground">
            Activo
          </Label>
          <Switch
            id={`active-${form.position}`}
            checked={form.is_active}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
        </div>
      </div>

      {/* Media preview */}
      <div className="relative rounded-lg overflow-hidden bg-muted/30 border border-dashed border-border h-40 flex items-center justify-center">
        {form.image_url ? (
          <>
            <BannerMedia
              src={form.image_url}
              alt={form.alt_text ?? "Banner"}
              className="w-full h-full object-cover"
              controls
              loop
              muted
              playsInline
            />
            <button
              type="button"
              onClick={clearMedia}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
              title="Quitar media"
            >
              <X className="h-4 w-4" />
            </button>
            {form.link_url && (
              <a
                href={form.link_url}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                title="Abrir enlace"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/50 text-sm">Sin media</span>
        )}
      </div>

      {/* Upload button */}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Subiendo…" : "Subir media"}
        </Button>
      </div>

      {/* Media URL (manual) */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">URL de media directa</Label>
        <Input
          placeholder="https://..."
          value={form.image_url ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value || null }))}
        />
        <p className="text-[11px] text-muted-foreground">
          Acepta JPG, PNG, WEBP, GIF, MP4, WEBM y MOV.
        </p>
      </div>

      {/* Link URL */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Enlace al hacer clic (opcional)</Label>
        <Input
          placeholder="https://..."
          value={form.link_url ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value || null }))}
        />
      </div>

      {/* Affiliate code */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Código de afiliado (opcional)</Label>
        <Input
          placeholder="FICHAS123"
          value={form.affiliate_code ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, affiliate_code: e.target.value || null }))}
        />
        <p className="text-[11px] text-muted-foreground">
          Si hay código, al hacer clic se abre un modal con opciones para copiar y compartir.
        </p>
      </div>

      {/* Alt text */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Texto alternativo</Label>
        <Input
          placeholder="Descripción del anuncio"
          value={form.alt_text ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, alt_text: e.target.value || null }))}
        />
      </div>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {saving ? "Guardando…" : "Guardar banner"}
      </Button>
    </div>
  );
}

export default function AdminBanners() {
  const [banners, setBanners] = useState<Record<Position, Banner> | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from("home_banners")
      .select("position, image_url, link_url, affiliate_code, alt_text, is_active");

    if (error) {
      toast({ title: "Error al cargar banners", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const map: Record<string, Banner> = {};
    for (const b of (data ?? []) as Banner[]) map[b.position] = b;

    // Ensure all positions exist in the map
    for (const pos of POSITIONS) {
      if (!map[pos]) {
        map[pos] = { position: pos, image_url: null, link_url: null, affiliate_code: null, alt_text: null, is_active: true };
      }
    }

    setBanners(map as Record<Position, Banner>);
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const handleSave = (updated: Banner) => {
    setBanners((prev) => prev ? { ...prev, [updated.position]: updated } : prev);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-1">Banners de la home</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná los 5 anuncios (hero + contenido vertical). Cada slot acepta imágenes, GIFs y videos cortos.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : banners ? (
          <>
            {/* Visual layout hint */}
            <div className="hidden md:grid grid-cols-[1fr_2fr_1fr] gap-2 mb-3 p-3 rounded-lg border border-dashed border-primary/20 bg-primary/5 text-xs text-muted-foreground text-center">
              <div className="space-y-2">
                <div className="bg-primary/10 rounded py-2">Superior izq.</div>
                <div className="bg-primary/10 rounded py-2">Inferior izq.</div>
              </div>
              <div className="flex items-center justify-center text-center font-display text-primary/50 font-bold">
                HERO
              </div>
              <div className="space-y-2">
                <div className="bg-primary/10 rounded py-2">Superior der.</div>
                <div className="bg-primary/10 rounded py-2">Inferior der.</div>
              </div>
            </div>
            <div className="mb-6 hidden rounded-lg border border-dashed border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-muted-foreground md:block">
              Anuncio 5: bloque vertical en contenido (entre noticias y calendario).
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
              {POSITIONS.map((pos) => (
                <BannerCard key={pos} banner={banners[pos]} onSave={handleSave} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
