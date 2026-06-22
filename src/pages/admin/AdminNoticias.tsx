import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  FileText,
  Image as ImageIcon,
  Instagram,
  Link as LinkIcon,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { parseDateValue } from "@/lib/date";
import { ArticleMarkdown } from "@/components/ArticleMarkdown";

interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
  image_url: string | null;
  instagram_selected: boolean;
  instagram_published: boolean;
  instagram_order: number | null;
}

const createEmptyForm = () => ({ slug: "", headline: "", summary: "", body_markdown: "", image_url: "" });

type ArticleForm = ReturnType<typeof createEmptyForm>;

function sortInstagramArticles(articles: Article[]) {
  return [...articles].sort((left, right) => {
    const leftOrder = left.instagram_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.instagram_order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    const leftTime = parseDateValue(left.published_at || left.created_at).getTime();
    const rightTime = parseDateValue(right.published_at || right.created_at).getTime();
    return rightTime - leftTime;
  });
}

type ArticleTextareaProps = {
  ariaLabel: string;
  className?: string;
  minRows?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

function ArticleTextarea({ ariaLabel, className, minRows = 1, onChange, placeholder, value }: ArticleTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={[
        "w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-foreground outline-none",
        "placeholder:text-muted-foreground/45 focus-visible:ring-0",
        className,
      ].join(" ")}
    />
  );
}

export default function AdminNoticias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState("needs_review");
  const [form, setForm] = useState<ArticleForm>(() => createEmptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchArticles = async () => {
    const { data } = await supabase
      .from("articles")
      .select("id, slug, headline, summary, body_markdown, status, created_at, published_at, image_url, instagram_selected, instagram_published, instagram_order")
      .order("created_at", { ascending: false });
    if (data) setArticles(data);
  };

  useEffect(() => {
    void fetchArticles();
  }, []);

  const filtered = articles.filter((article) => article.status === tab);
  const publishedArticles = articles.filter((article) => article.status === "published");
  const instagramPendingArticles = sortInstagramArticles(
    publishedArticles.filter((article) => article.instagram_selected && !article.instagram_published),
  );
  const instagramPublishedArticles = sortInstagramArticles(
    publishedArticles.filter((article) => article.instagram_selected && article.instagram_published),
  );
  const buildSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const editingArticle = editId ? articles.find((article) => article.id === editId) ?? null : null;
  const previewSlug = form.slug.trim() || buildSlug(form.headline) || "slug-de-la-noticia";
  const previewDate = editingArticle?.published_at || editingArticle?.created_at || new Date().toISOString();
  const previewStatus = editingArticle?.status || "needs_review";
  const updateForm = (field: keyof ArticleForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveArticle = async () => {
    if (!form.headline.trim()) {
      toast({ title: "Falta el titular", description: "Debes completar el titular.", variant: "destructive" });
      return;
    }

    const slug = form.slug.trim() || buildSlug(form.headline);
    const payload = {
      slug,
      summary: form.summary.trim() || null,
      body_markdown: form.body_markdown.trim() || null,
      source_name: null,
      source_url: null,
      image_url: form.image_url.trim() || null,
      headline: form.headline.trim(),
    };

    const { error } = editId
      ? await supabase.from("articles").update(payload).eq("id", editId)
      : await supabase.from("articles").insert({ ...payload, created_by: user?.id });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setOpen(false);
    setForm(createEmptyForm());
    setEditId(null);
    void fetchArticles();
  };

  const handleEdit = (article: Article) => {
    setForm({
      slug: article.slug,
      headline: article.headline,
      summary: article.summary ?? "",
      body_markdown: article.body_markdown ?? "",
      image_url: article.image_url ?? "",
    });
    setEditId(article.id);
    setOpen(true);
  };

  const handleApprove = async (id: string) => {
    await supabase.from("articles").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id);
    void fetchArticles();
  };

  const handleReject = async (id: string) => {
    await supabase.from("articles").update({ status: "rejected" }).eq("id", id);
    void fetchArticles();
  };

  const handleDelete = async (article: Article) => {
    setDeletingId(article.id);

    const { error } = await supabase.from("articles").delete().eq("id", article.id);

    if (error) {
      toast({
        title: "No se pudo eliminar el artículo",
        description: error.message,
        variant: "destructive",
      });
      setDeletingId(null);
      return;
    }

    setDeleteTarget(null);
    setDeletingId(null);
    toast({
      title: "Artículo eliminado",
      description: "El artículo publicado fue eliminado correctamente.",
    });
    void fetchArticles();
  };

  const resequenceInstagramOrders = async (queue: Article[]) => {
    if (queue.length === 0) return true;

    const results = await Promise.all(
      queue.map((article, index) =>
        supabase
          .from("articles")
          .update({ instagram_order: index + 1 })
          .eq("id", article.id),
      ),
    );

    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) {
      toast({
        title: "No se pudo reordenar Instagram",
        description: failedResult.error.message,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleToggleInstagramSelection = async (article: Article) => {
    if (!article.instagram_selected) {
      const nextOrder = instagramPendingArticles.length + 1;
      const { error } = await supabase
        .from("articles")
        .update({
          instagram_selected: true,
          instagram_published: false,
          instagram_order: nextOrder,
        })
        .eq("id", article.id);

      if (error) {
        toast({
          title: "No se pudo agregar a Instagram",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Agregada a Instagram",
        description: "La noticia quedó seleccionada para publicar en Instagram.",
      });
      void fetchArticles();
      return;
    }

    const sourceQueue = sortInstagramArticles(
      (article.instagram_published ? instagramPublishedArticles : instagramPendingArticles).filter(
        (entry) => entry.id !== article.id,
      ),
    );

    const [updateResult, resequenceOk] = await Promise.all([
      supabase
        .from("articles")
        .update({
          instagram_selected: false,
          instagram_published: false,
          instagram_order: null,
        })
        .eq("id", article.id),
      resequenceInstagramOrders(sourceQueue),
    ]);

    if (updateResult.error) {
      toast({
        title: "No se pudo quitar de Instagram",
        description: updateResult.error.message,
        variant: "destructive",
      });
      return;
    }

    if (!resequenceOk) return;

    toast({
      title: "Quitada de Instagram",
      description: "La noticia dejó de estar seleccionada para Instagram.",
    });
    void fetchArticles();
  };

  const statusColors: Record<string, string> = {
    needs_review: "bg-accent/20 text-accent",
    published: "bg-primary/20 text-primary",
    rejected: "bg-destructive/20 text-destructive",
  };
  const statusLabels: Record<string, string> = {
    needs_review: "Por revisar",
    published: "Publicado",
    rejected: "Rechazado",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold">Gestión de noticias</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aquí gestionás artículos y marcás cuáles van a Instagram. El generador vive en una vista separada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/noticias/instagram">
                <Instagram className="mr-2 h-4 w-4" />
                Instagram noticias
              </Link>
            </Button>

            <Sheet
              open={open}
              onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                  setForm(createEmptyForm());
                  setEditId(null);
                }
              }}
            >
              <SheetTrigger asChild>
                <Button
                  onClick={() => {
                    setForm(createEmptyForm());
                    setEditId(null);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo artículo
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="inset-x-auto left-1/2 right-auto top-auto h-[calc(100vh-1.5rem)] max-h-[920px] w-[min(1180px,calc(100vw-1rem))] max-w-none -translate-x-1/2 overflow-hidden rounded-t-2xl border border-border bg-background p-0 shadow-2xl sm:max-w-none"
              >
                <div className="flex h-full flex-col overflow-hidden">
                  <SheetHeader className="border-b border-border bg-background/95 px-5 py-4 pr-14 text-left backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <SheetTitle className="font-display text-2xl">
                          {editId ? "Editar noticia" : "Nueva noticia"}
                        </SheetTitle>
                        <SheetDescription>
                          Editá sobre una hoja editorial: portada, titular, bajada y cuerpo con vista publicada.
                        </SheetDescription>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                          Cerrar
                        </Button>
                        <Button onClick={handleSaveArticle}>
                          <Save className="h-4 w-4" />
                          {editId ? "Guardar cambios" : "Crear artículo"}
                        </Button>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto bg-gradient-to-b from-background via-background to-muted/20">
                    <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <article className="mx-auto w-full max-w-3xl pb-10">
                        <div className="aspect-[21/9] w-full overflow-hidden rounded-lg border border-border bg-card md:aspect-[21/8]">
                          {form.image_url.trim() ? (
                            <img
                              src={form.image_url}
                              alt={form.headline || "Portada de la noticia"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/50 px-6 text-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8" />
                              <span className="text-sm">Agregá una URL de portada en el panel derecho.</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <ArticleTextarea
                            ariaLabel="Titular"
                            value={form.headline}
                            onChange={(value) => updateForm("headline", value)}
                            placeholder="Titular de la noticia"
                            className="font-display text-3xl font-bold leading-tight tracking-[0.01em] md:text-4xl"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {format(parseDateValue(previewDate), "d MMMM yyyy", { locale: es })}
                          </span>
                          <Badge className={statusColors[previewStatus]}>{statusLabels[previewStatus] ?? previewStatus}</Badge>
                        </div>

                        <div className="mt-8 border-l-2 border-primary pl-4">
                          <ArticleTextarea
                            ariaLabel="Resumen"
                            value={form.summary}
                            onChange={(value) => updateForm("summary", value)}
                            placeholder="Bajada o resumen de la noticia"
                            minRows={2}
                            className="text-lg italic leading-8 text-foreground/80"
                          />
                        </div>

                        <section className="mt-8">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <FileText className="h-4 w-4" />
                              Cuerpo del artículo
                            </span>
                            <Badge variant="outline">Markdown</Badge>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-card/35 p-4">
                            <ArticleTextarea
                              ariaLabel="Cuerpo en Markdown"
                              value={form.body_markdown}
                              onChange={(value) => updateForm("body_markdown", value)}
                              placeholder="Escribí el cuerpo de la noticia..."
                              minRows={10}
                              className="min-h-[280px] text-base leading-7 text-foreground/90"
                            />
                          </div>
                        </section>

                        {form.body_markdown.trim() && (
                          <section className="mt-8 border-t border-border pt-8">
                            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Vista publicada
                            </p>
                            <ArticleMarkdown imageUrlToOmit={form.image_url}>{form.body_markdown}</ArticleMarkdown>
                          </section>
                        )}
                      </article>

                      <aside className="h-fit rounded-xl border border-border bg-card/70 p-4 shadow-sm lg:sticky lg:top-5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <h3 className="font-display text-lg font-bold">Ajustes</h3>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="article-slug">Slug</Label>
                            <div className="relative">
                              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="article-slug"
                                value={form.slug}
                                onChange={(event) => updateForm("slug", event.target.value)}
                                placeholder={buildSlug(form.headline) || "auto-generado"}
                                className="pl-9"
                              />
                            </div>
                            <p className="break-all text-xs text-muted-foreground">/noticias/{previewSlug}</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="article-image">URL imagen de portada</Label>
                            <div className="relative">
                              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="article-image"
                                value={form.image_url}
                                onChange={(event) => updateForm("image_url", event.target.value)}
                                placeholder="https://..."
                                className="pl-9"
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-background/60 p-3">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Fecha visible</p>
                            <p className="mt-1 font-medium">
                              {format(parseDateValue(previewDate), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>

                          <div className="rounded-lg border border-border bg-background/60 p-3">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Estado</p>
                            <Badge className={`mt-2 ${statusColors[previewStatus]}`}>
                              {statusLabels[previewStatus] ?? previewStatus}
                            </Badge>
                          </div>

                          {editingArticle?.status === "published" && (
                            <Button variant="outline" className="w-full" asChild>
                              <Link to={`/noticias/${editingArticle.slug}`}>
                                <LinkIcon className="h-4 w-4" />
                                Ver publicada
                              </Link>
                            </Button>
                          )}

                          <Button onClick={handleSaveArticle} className="w-full">
                            <Save className="h-4 w-4" />
                            {editId ? "Guardar cambios" : "Crear artículo"}
                          </Button>
                        </div>
                      </aside>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="needs_review">Por revisar</TabsTrigger>
            <TabsTrigger value="published">Publicados</TabsTrigger>
            <TabsTrigger value="rejected">Rechazados</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <div className="space-y-3">
              {filtered.map((article) => (
                <div key={article.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">{article.headline}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={statusColors[article.status]}>{article.status}</Badge>
                      {article.status === "published" && article.instagram_selected && (
                        <Badge
                          variant="outline"
                          className={
                            article.instagram_published
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-primary/25 bg-primary/10 text-primary"
                          }
                        >
                          {article.instagram_published ? "IG publicada" : "IG pendiente"}
                        </Badge>
                      )}
                      {article.status === "published" && article.instagram_selected && article.instagram_order !== null && (
                        <Badge variant="outline">IG #{article.instagram_order}</Badge>
                      )}
                      {article.published_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(parseDateValue(article.published_at), "d MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex gap-2">
                    {article.status === "published" && (
                      <Button
                        size="sm"
                        variant={article.instagram_selected ? "secondary" : "outline"}
                        onClick={() => void handleToggleInstagramSelection(article)}
                      >
                        <Instagram className="mr-2 h-4 w-4" />
                        {article.instagram_selected ? "Seleccionada IG" : "Seleccionar IG"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(article)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {article.status === "needs_review" && (
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(article.id)} title="Aprobar">
                        <Check className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    {article.status === "needs_review" && (
                      <Button size="sm" variant="ghost" onClick={() => handleReject(article.id)} title="Rechazar">
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {article.status === "published" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(article)}
                        title="Eliminar"
                        disabled={deletingId === article.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No hay artículos en esta categoría.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen && !deletingId) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar artículo publicado</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `Vas a eliminar "${deleteTarget.headline}" de Fichas Online. Esta acción no se puede deshacer.`
                  : "Esta acción no se puede deshacer."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingId)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTarget) void handleDelete(deleteTarget);
                }}
                disabled={Boolean(deletingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingId ? "Eliminando..." : "Eliminar artículo"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
