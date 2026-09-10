import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CalendarDays, MapPin, ImageIcon } from "lucide-react";
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
  status: string | null;
  buy_in: string | null;
  guaranteed: string | null;
  source_url: string | null;
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
  status: string;
  buy_in: string;
  guaranteed: string;
  source_url: string;
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
  status: "draft",
  buy_in: "",
  guaranteed: "",
  source_url: "",
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

/**
 * Motivo por el que una línea no se puede guardar.
 *
 * Distinguir "le falta la URL" de "la URL está mal escrita" importa: son dos
 * arreglos distintos, y el segundo mensaje no ayuda cuando el problema es el
 * primero — que es el caso de las líneas sueltas tipo "Te puede interesar" que
 * quedan al pegar contenido copiado de otra página.
 */
type InvalidLine = { line: string; motivo: string };

/**
 * Líneas que son texto y no intentos de URL: títulos que se cuelan al pegar
 * contenido de otra página ("Te puede interesar", "Compartir en Facebook").
 *
 * Se descartan al guardar en vez de bloquear. Bloquear por esto obligaba a
 * cazar la línea a mano para poder guardar el resto del evento, cuando la
 * intención es evidente: eso no es un link. Se avisa cuáles se ignoraron, así
 * que no es una pérdida silenciosa.
 */
function esTextoSuelto(value: string): boolean {
  return !/^https?:\/\//i.test(value) && !value.includes("/") && !/\.[a-z]{2,}/i.test(value);
}

/** Una URL escrita a medias (`https://` sin host) se avisa distinto que un texto suelto. */
function motivoDeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? "la URL está mal escrita" : "no empieza con http:// o https://";
}

function parseLinksFromText(text: string): { links: EventLink[]; invalid: InvalidLine[]; ignored: string[] } {
  const links: EventLink[] = [];
  const invalid: InvalidLine[] = [];
  const ignored: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const [possibleLabel, ...rest] = line.split("|");
    const hasLabel = rest.length > 0;
    const label = hasLabel ? possibleLabel.trim() : "";
    const url = (hasLabel ? rest.join("|") : possibleLabel).trim();

    if (!url) {
      invalid.push({ line, motivo: "le falta la URL" });
      continue;
    }

    if (!isHttpUrl(url)) {
      /*
       * Una línea sin `|` y que no se parece a una dirección es texto suelto,
       * no una URL rota: pasa al pegar contenido de otra página, donde se
       * cuelan títulos como "Te puede interesar". Decirle "no empieza con
       * http://" a eso confunde — lo que hay que hacer es borrar la línea.
       */
      if (!hasLabel && esTextoSuelto(url)) {
        ignored.push(line);
        continue;
      }
      invalid.push({ line, motivo: motivoDeUrl(url) });
      continue;
    }

    links.push(label ? { label, url } : { url });
  }

  return { links, invalid, ignored };
}

function parseGalleryFromText(text: string): { images: string[]; invalid: InvalidLine[] } {
  const images: string[] = [];
  const invalid: InvalidLine[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!isHttpUrl(line)) {
      invalid.push({ line, motivo: motivoDeUrl(line) });
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
  const [searchParams, setSearchParams] = useSearchParams();
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

    /*
     * El mensaje nombra la línea que falla y en qué campo está.
     *
     * Antes decía "revisá links e imágenes" sin más: con dos textareas de
     * varias líneas cada una, eso obliga a revisar todo a ojo para encontrar
     * un carácter de más. El error tiene que decir qué arreglar.
     */
    const invalidEntries = [
      ...parsedLinks.invalid.map((entry) => ({ campo: "Links", ...entry })),
      ...parsedGallery.invalid.map((entry) => ({ campo: "Galería", ...entry })),
    ];

    /*
     * Las líneas de texto suelto no frenan el guardado: se descartan y se
     * avisa cuáles. Las URLs mal escritas sí frenan, porque ahí probablemente
     * había un link real con un error de tipeo y descartarlo lo perdería.
     */
    if (parsedLinks.ignored.length > 0) {
      toast({
        title: `Se ignoraron ${parsedLinks.ignored.length} línea${parsedLinks.ignored.length > 1 ? "s" : ""} de Links`,
        description: `No son direcciones web:\n${parsedLinks.ignored
          .slice(0, 3)
          .map((l) => `· ${l.length > 45 ? `${l.slice(0, 45)}…` : l}`)
          .join("\n")}`,
      });
    }

    if (invalidEntries.length > 0) {
      const detalle = invalidEntries
        .slice(0, 3)
        .map(
          ({ campo, line, motivo }) =>
            `· ${campo} — "${line.length > 45 ? `${line.slice(0, 45)}…` : line}": ${motivo}.`,
        )
        .join("\n");
      const resto = invalidEntries.length > 3 ? `\n…y ${invalidEntries.length - 3} más.` : "";
      const plural = invalidEntries.length > 1;

      toast({
        title: `Hay ${invalidEntries.length} línea${plural ? "s" : ""} que no se puede${plural ? "n" : ""} guardar`,
        description: `${detalle}${resto}\nBorrá esa línea o completala con su URL.`,
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
      links: parsedLinks.links as any,
      gallery: parsedGallery.images as any,
      status: form.status,
      buy_in: form.buy_in.trim() || null,
      guaranteed: form.guaranteed.trim() || null,
      source_url: form.source_url.trim() || null,
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
      status: e.status ?? "draft",
      buy_in: e.buy_in ?? "",
      guaranteed: e.guaranteed ?? "",
      source_url: e.source_url ?? "",
    });
    setEditId(e.id);
    setOpen(true);
  };

  /* Entrada desde el portal: /admin/eventos?edit=<id> abre ese evento. */
  const openedFromUrl = useRef<string | null>(null);
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || openedFromUrl.current === editId) return;

    const target = events.find((e) => e.id === editId);
    if (!target) return;

    openedFromUrl.current = editId;
    handleEdit(target);

    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, events]);

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
      <div className="container mx-auto px-4 py-8">
        <AdminPageHeader
          title="Gestión de eventos"
          actions={
            <Sheet
              open={open}
              onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) {
                  setForm(emptyForm);
                  setEditId(null);
                }
              }}
            >
              <SheetTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo evento
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                onPointerDownOutside={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
                className="inset-0 h-full w-full max-w-none overflow-hidden rounded-none border-0 bg-background p-0 sm:max-w-none"
              >
                <div className="flex h-full flex-col overflow-hidden">
                  <SheetHeader className="border-b border-border bg-background/95 px-5 py-4 pr-14 text-left backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <SheetTitle className="font-display text-2xl leading-h3">
                          {editId ? "Editar evento" : "Nuevo evento"}
                        </SheetTitle>
                        <SheetDescription>
                          La ficha como se va a ver: portada, nombre, bajada e información, con los ajustes al costado.
                        </SheetDescription>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                          Cerrar
                        </Button>
                        <Button onClick={() => void handleSave()}>
                          {editId ? "Guardar cambios" : "Crear evento"}
                        </Button>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto bg-gradient-to-b from-background via-background to-muted/20">
                    <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                      {/* ── Hoja: lo que el lector va a ver ──────────────── */}
                      <article className="mx-auto w-full max-w-3xl pb-10">
                        <div className="aspect-[21/9] w-full overflow-hidden rounded-lg border border-border bg-card md:aspect-[21/8]">
                          {form.hero_image_url.trim() ? (
                            <img
                              src={form.hero_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/50 px-6 text-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8" />
                              <span className="text-sm leading-ui">Agregá una portada en el panel derecho.</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <Input
                            aria-label="Nombre del evento"
                            placeholder="Nombre del evento"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="h-auto border-0 bg-transparent px-0 font-display text-3xl font-bold leading-h2 tracking-h2 shadow-none focus-visible:ring-0 md:text-4xl"
                          />
                        </div>

                        {/*
                          Fechas y lugar se muestran, no se editan acá: se cargan
                          en el panel derecho. Repetir los campos en los dos lados
                          sería dos fuentes para el mismo dato.
                        */}
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm leading-ui text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {form.start_date
                              ? format(parseDateValue(form.start_date), "d MMM yyyy", { locale: es })
                              : "Sin fecha"}
                            {form.end_date &&
                              ` — ${format(parseDateValue(form.end_date), "d MMM yyyy", { locale: es })}`}
                          </span>
                          {[form.venue, form.city, form.country].some(Boolean) && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" />
                              {[form.venue, form.city, form.country].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {form.buy_in && <Badge variant="outline">Buy-in: {form.buy_in}</Badge>}
                          {form.guaranteed && <Badge variant="outline">GTD: {form.guaranteed}</Badge>}
                        </div>

                        <div className="mt-8 border-l-2 border-primary pl-4">
                          <Textarea
                            aria-label="Descripción corta"
                            placeholder="Bajada del evento"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={3}
                            className="resize-none border-0 bg-transparent px-0 text-lg italic leading-body text-foreground/80 shadow-none focus-visible:ring-0"
                          />
                        </div>

                        <section className="mt-8">
                          <Label className="text-xs uppercase leading-caption tracking-caption text-muted-foreground">
                            Información completa
                          </Label>
                          {/*
                            Sigue siendo Markdown en un textarea y no el editor
                            rico de noticias: la ficha pública renderiza este
                            campo con ReactMarkdown, así que guardar HTML acá
                            lo mostraría como texto plano.
                          */}
                          <Textarea
                            value={form.details}
                            onChange={(e) => setForm({ ...form, details: e.target.value })}
                            rows={16}
                            placeholder="Agenda, estructura, premios… (Markdown)"
                            className="mt-2 leading-ui"
                          />
                          <p className="mt-1 text-xs leading-caption text-muted-foreground">
                            Admite Markdown: `**negrita**`, listas, links.
                          </p>
                        </section>
                      </article>

                      {/* ── Ajustes ───────────────────────────────────────── */}
                      <aside className="h-fit rounded-xl border border-border bg-card/70 p-4 shadow-sm lg:sticky lg:top-5">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <h3 className="font-display text-lg font-bold leading-h3">Ajustes</h3>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="ev-start">Fecha inicio</Label>
                              <Input
                                id="ev-start"
                                type="date"
                                value={form.start_date}
                                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ev-end">Fecha fin</Label>
                              <Input
                                id="ev-end"
                                type="date"
                                value={form.end_date}
                                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ev-venue">Venue</Label>
                            <Input
                              id="ev-venue"
                              value={form.venue}
                              onChange={(e) => setForm({ ...form, venue: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="ev-city">Ciudad</Label>
                              <Input
                                id="ev-city"
                                value={form.city}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ev-country">País</Label>
                              <Input
                                id="ev-country"
                                value={form.country}
                                onChange={(e) => setForm({ ...form, country: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="ev-buyin">Buy In</Label>
                              <Input
                                id="ev-buyin"
                                value={form.buy_in}
                                onChange={(e) => setForm({ ...form, buy_in: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ev-gtd">Garantizado</Label>
                              <Input
                                id="ev-gtd"
                                value={form.guaranteed}
                                onChange={(e) => setForm({ ...form, guaranteed: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ev-status">Estado</Label>
                            <select
                              id="ev-status"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-ui ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              value={form.status}
                              onChange={(e) => setForm({ ...form, status: e.target.value })}
                            >
                              <option value="draft">Borrador (Draft)</option>
                              <option value="needs_review">Pendiente de Revisión</option>
                              <option value="published">Publicado</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ev-hero">Imagen principal</Label>
                            <Input
                              id="ev-hero"
                              placeholder="https://… (o subir desde PC)"
                              value={form.hero_image_url}
                              onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => heroFileInputRef.current?.click()}
                              disabled={uploadingHero}
                            >
                              {uploadingHero ? "Subiendo..." : "Subir desde PC"}
                            </Button>
                            <input
                              ref={heroFileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => void handleHeroImageUpload(event)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ev-source">URL Fuente</Label>
                            <Input
                              id="ev-source"
                              value={form.source_url}
                              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ev-links">Links</Label>
                            <Textarea
                              id="ev-links"
                              value={form.links_text}
                              onChange={(e) => setForm({ ...form, links_text: e.target.value })}
                              rows={4}
                              className="text-xs leading-ui"
                              placeholder={"Sitio oficial | https://…\nInscripciones | https://…"}
                            />
                            <p className="text-xs leading-caption text-muted-foreground">
                              Uno por línea. Formato: `Etiqueta | URL` o sólo `URL`.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ev-gallery">Galería</Label>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full"
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
                            <Textarea
                              id="ev-gallery"
                              value={form.gallery_text}
                              onChange={(e) => setForm({ ...form, gallery_text: e.target.value })}
                              rows={4}
                              className="text-xs leading-ui"
                              placeholder={"https://.../imagen-1.jpg\nhttps://.../imagen-2.jpg"}
                            />
                            <p className="text-xs leading-caption text-muted-foreground">Una URL por línea.</p>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          }
        />

        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{e.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {format(parseDateValue(e.start_date), "d MMM yyyy", { locale: es })}
                  {e.end_date && ` — ${format(parseDateValue(e.end_date), "d MMM yyyy", { locale: es })}`}
                  {e.city && ` · ${e.city}`}
                  {e.status && ` · [${e.status}]`}
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
        </div>
      </div>
    </div>
  );
}
