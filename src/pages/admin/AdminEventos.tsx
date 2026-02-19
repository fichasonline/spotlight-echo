import { ChangeEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateValue } from "@/lib/date";

interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  country: string | null;
  city: string | null;
  venue: string | null;
  description: string | null;
  details: string | null;
  hero_image_url: string | null;
  links: unknown;
  gallery: unknown;
}

interface EventLink {
  label?: string;
  url: string;
}

interface EventForm {
  name: string;
  start_date: string;
  end_date: string;
  country: string;
  city: string;
  venue: string;
  description: string;
  details: string;
  hero_image_url: string;
  links_text: string;
  gallery_text: string;
}

const EVENT_MEDIA_BUCKET = "event-media";
const MAX_IMAGE_MB = 10;

const emptyForm: EventForm = {
  name: "",
  start_date: "",
  end_date: "",
  country: "",
  city: "",
  venue: "",
  description: "",
  details: "",
  hero_image_url: "",
  links_text: "",
  gallery_text: "",
};

function sanitizeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStoragePath(userId: string | null | undefined, kind: "hero" | "gallery", file: File): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.trim() ?? "" : "";
  const baseName = file.name.replace(/\.[^/.]+$/, "").trim();
  const safeBase = sanitizeFileName(baseName) || "image";
  const safeExt = sanitizeFileName(ext);
  const randomToken =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const suffix = safeExt ? `${safeBase}-${Date.now()}-${randomToken}.${safeExt}` : `${safeBase}-${Date.now()}-${randomToken}`;
  return `${userId ?? "anon"}/${kind}/${suffix}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLinksFromText(text: string): { links: EventLink[]; invalid: string[] } {
  const links: EventLink[] = [];
  const invalid: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const [possibleLabel, ...rest] = line.split("|");
    const hasLabel = rest.length > 0;
    const label = hasLabel ? possibleLabel.trim() : "";
    const url = (hasLabel ? rest.join("|") : possibleLabel).trim();

    if (!isHttpUrl(url)) {
      invalid.push(line);
      continue;
    }

    links.push(label ? { label, url } : { url });
  }

  return { links, invalid };
}

function parseGalleryFromText(text: string): { images: string[]; invalid: string[] } {
  const images: string[] = [];
  const invalid: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!isHttpUrl(line)) {
      invalid.push(line);
      continue;
    }

    images.push(line);
  }

  return { images, invalid };
}

function linksToText(value: unknown): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const maybeItem = item as { label?: unknown; url?: unknown };
      const label = typeof maybeItem.label === "string" ? maybeItem.label.trim() : "";
      const url = typeof maybeItem.url === "string" ? maybeItem.url.trim() : "";
      if (!url) return "";
      return label ? `${label} | ${url}` : url;
    })
    .filter(Boolean)
    .join("\n");
}

function galleryToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

export default function AdminEventos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("*").order("start_date", { ascending: false });
    if (data) setEvents(data);
  };

  useEffect(() => {
    void fetchEvents();
  }, []);

  const uploadImageFile = async (file: File, kind: "hero" | "gallery"): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo inválido",
        description: "Solo se permiten imágenes.",
        variant: "destructive",
      });
      return null;
    }

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast({
        title: "Imagen muy pesada",
        description: `Máximo ${MAX_IMAGE_MB} MB por imagen.`,
        variant: "destructive",
      });
      return null;
    }

    const path = buildStoragePath(user?.id, kind, file);
    const { error: uploadError } = await supabase.storage.from(EVENT_MEDIA_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

    if (uploadError) {
      const maybeBucketHint = uploadError.message.toLowerCase().includes("bucket")
        ? " Verifica que la migración de storage esté aplicada."
        : "";
      toast({
        title: "No se pudo subir la imagen",
        description: `${uploadError.message}.${maybeBucketHint}`,
        variant: "destructive",
      });
      return null;
    }

    const { data } = supabase.storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      toast({
        title: "Error de URL pública",
        description: "Se subió el archivo pero no se pudo obtener la URL.",
        variant: "destructive",
      });
      return null;
    }

    return data.publicUrl;
  };

  const handleHeroImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingHero(true);
    const url = await uploadImageFile(file, "hero");
    setUploadingHero(false);

    if (!url) return;
    setForm((prev) => ({ ...prev, hero_image_url: url }));
    toast({
      title: "Imagen principal subida",
      description: "La URL se cargó automáticamente en el evento.",
    });
  };

  const handleGalleryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploadingGallery(true);
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const url = await uploadImageFile(file, "gallery");
      if (url) uploadedUrls.push(url);
    }

    setUploadingGallery(false);

    if (uploadedUrls.length === 0) return;
    setForm((prev) => {
      const current = prev.gallery_text.trim();
      return {
        ...prev,
        gallery_text: [current, ...uploadedUrls].filter(Boolean).join("\n"),
      };
    });
    toast({
      title: "Galería actualizada",
      description: `Se agregaron ${uploadedUrls.length} imagen(es).`,
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.start_date) {
      toast({
        title: "Faltan datos obligatorios",
        description: "Nombre y fecha de inicio son requeridos.",
        variant: "destructive",
      });
      return;
    }

    const parsedLinks = parseLinksFromText(form.links_text);
    const parsedGallery = parseGalleryFromText(form.gallery_text);
    const invalidEntries = [...parsedLinks.invalid, ...parsedGallery.invalid];

    if (invalidEntries.length > 0) {
      toast({
        title: "Hay URLs inválidas",
        description: "Revisa links e imágenes. Deben comenzar con http:// o https://",
        variant: "destructive",
      });
      return;
    }

    const heroImageValue = form.hero_image_url.trim();
    if (heroImageValue && !isHttpUrl(heroImageValue)) {
      toast({
        title: "URL de imagen principal inválida",
        description: "Debe comenzar con http:// o https://",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      venue: form.venue.trim() || null,
      description: form.description.trim() || null,
      details: form.details.trim() || null,
      hero_image_url: heroImageValue || null,
      links: parsedLinks.links,
      gallery: parsedGallery.images,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("events").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("events").insert({ ...payload, created_by: user?.id }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    await fetchEvents();
    toast({
      title: editId ? "Evento actualizado" : "Evento creado",
      description: "El evento fue guardado con su contenido completo.",
    });
  };

  const handleEdit = (e: Event) => {
    setForm({
      name: e.name,
      start_date: e.start_date,
      end_date: e.end_date ?? "",
      country: e.country ?? "",
      city: e.city ?? "",
      venue: e.venue ?? "",
      description: e.description ?? "",
      details: e.details ?? "",
      hero_image_url: e.hero_image_url ?? "",
      links_text: linksToText(e.links),
      gallery_text: galleryToText(e.gallery),
    });
    setEditId(e.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchEvents();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display font-bold">Gestión de eventos</h1>
          <Dialog
            open={open}
            onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) {
                setForm(emptyForm);
                setEditId(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Nuevo evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar evento" : "Nuevo evento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha inicio</Label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fecha fin</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>País</Label>
                    <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                  <div>
                    <Label>Ciudad</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <Label>Venue</Label>
                    <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label>Descripción corta</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Admite Markdown (ej: `**negrita**`, listas, links).</p>
                </div>

                <div>
                  <Label>Información completa</Label>
                  <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={7} />
                  <p className="text-xs text-muted-foreground mt-1">Admite Markdown.</p>
                </div>

                <div>
                  <Label>Imagen principal</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="https://... (o subir desde PC)"
                      value={form.hero_image_url}
                      onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => heroFileInputRef.current?.click()}
                      disabled={uploadingHero}
                    >
                      {uploadingHero ? "Subiendo..." : "Subir desde PC"}
                    </Button>
                  </div>
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleHeroImageUpload(event)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Puedes pegar URL o subir una imagen local.
                  </p>
                </div>

                <div>
                  <Label>Links (uno por línea)</Label>
                  <Textarea
                    value={form.links_text}
                    onChange={(e) => setForm({ ...form, links_text: e.target.value })}
                    rows={4}
                    placeholder={"Sitio oficial | https://... \nInscripciones | https://..."}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Formato: `Etiqueta | URL` o solo `URL`.</p>
                </div>

                <div>
                  <Label>Galería de imágenes (una URL por línea)</Label>
                  <div className="mb-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => galleryFileInputRef.current?.click()}
                      disabled={uploadingGallery}
                    >
                      {uploadingGallery ? "Subiendo imágenes..." : "Subir imágenes desde PC"}
                    </Button>
                    <input
                      ref={galleryFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => void handleGalleryUpload(event)}
                    />
                  </div>
                  <Textarea
                    value={form.gallery_text}
                    onChange={(e) => setForm({ ...form, gallery_text: e.target.value })}
                    rows={4}
                    placeholder={"https://.../imagen-1.jpg\nhttps://.../imagen-2.jpg"}
                  />
                </div>

                <Button onClick={() => void handleSave()} className="w-full">
                  {editId ? "Guardar cambios" : "Crear evento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{e.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {format(parseDateValue(e.start_date), "d MMM yyyy", { locale: es })}
                  {e.end_date && ` — ${format(parseDateValue(e.end_date), "d MMM yyyy", { locale: es })}`}
                  {e.city && ` · ${e.city}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(e)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleDelete(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-muted-foreground text-center py-8">No hay eventos.</p>}
        </div>
      </div>
    </div>
  );
}
