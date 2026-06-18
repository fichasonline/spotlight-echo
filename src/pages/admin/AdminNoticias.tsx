import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Instagram, Pencil, Plus, Trash2, X } from "lucide-react";
import { parseDateValue } from "@/lib/date";

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

const emptyForm = { slug: "", headline: "", summary: "", body_markdown: "", image_url: "" };

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

export default function AdminNoticias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState("needs_review");
  const [form, setForm] = useState(emptyForm);
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

  const handleSaveArticle = async () => {
    if (!form.headline.trim()) {
      toast({ title: "Falta el titular", description: "Debes completar el titular.", variant: "destructive" });
      return;
    }

    const slug = form.slug || buildSlug(form.headline);
    const payload = {
      slug,
      summary: form.summary || null,
      body_markdown: form.body_markdown || null,
      source_name: null,
      source_url: null,
      image_url: form.image_url || null,
      headline: form.headline,
    };

    const { error } = editId
      ? await supabase.from("articles").update(payload).eq("id", editId)
      : await supabase.from("articles").insert({ ...payload, created_by: user?.id });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setOpen(false);
    setForm(emptyForm);
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

            <Dialog
              open={open}
              onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                  setForm(emptyForm);
                  setEditId(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo artículo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editId ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Titular</Label>
                    <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
                  </div>
                  <div>
                    <Label>Slug (opcional)</Label>
                    <Input
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="auto-generado"
                    />
                  </div>
                  <div>
                    <Label>Resumen</Label>
                    <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={2} />
                  </div>
                  <div>
                    <Label>Cuerpo (Markdown)</Label>
                    <Textarea
                      value={form.body_markdown}
                      onChange={(e) => setForm({ ...form, body_markdown: e.target.value })}
                      rows={6}
                    />
                  </div>
                  <div>
                    <Label>URL imagen (portada)</Label>
                    <Input
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <Button onClick={handleSaveArticle} className="w-full">
                    {editId ? "Guardar cambios" : "Crear artículo"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
