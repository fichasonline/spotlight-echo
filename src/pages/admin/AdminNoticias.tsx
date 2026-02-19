import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X } from "lucide-react";

interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  status: string;
  created_at: string;
  source_name: string | null;
}

const emptyForm = { slug: "", headline: "", summary: "", body_markdown: "", source_name: "", source_url: "" };

export default function AdminNoticias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState("needs_review");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState(emptyForm);

  const fetchArticles = async () => {
    const { data } = await supabase.from("articles").select("id, slug, headline, summary, status, created_at, source_name").order("created_at", { ascending: false });
    if (data) setArticles(data);
  };

  useEffect(() => { fetchArticles(); }, []);

  const filtered = articles.filter((a) => a.status === tab);

  const handleCreate = async () => {
    const slug = form.slug || form.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("articles").insert({
      ...form,
      slug,
      summary: form.summary || null,
      body_markdown: form.body_markdown || null,
      source_name: form.source_name || null,
      source_url: form.source_url || null,
      created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setOpen(false); setForm(emptyForm); fetchArticles(); }
  };

  const handleDraftSave = async () => {
    const slug = draftForm.slug || draftForm.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("articles").insert({
      ...draftForm,
      slug,
      status: "needs_review",
      summary: draftForm.summary || null,
      body_markdown: draftForm.body_markdown || null,
      source_name: draftForm.source_name || null,
      source_url: draftForm.source_url || null,
      created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setDraftOpen(false); setDraftForm(emptyForm); fetchArticles(); }
  };

  const handleApprove = async (id: string) => {
    await supabase.from("articles").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id);
    fetchArticles();
  };

  const handleReject = async (id: string) => {
    await supabase.from("articles").update({ status: "rejected" }).eq("id", id);
    fetchArticles();
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-display font-bold">Gestión de noticias</h1>
          <div className="flex gap-2">
            <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Importar borrador IA</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Importar borrador IA</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titular</Label><Input value={draftForm.headline} onChange={(e) => setDraftForm({ ...draftForm, headline: e.target.value })} /></div>
                  <div><Label>Slug (opcional)</Label><Input value={draftForm.slug} onChange={(e) => setDraftForm({ ...draftForm, slug: e.target.value })} placeholder="auto-generado" /></div>
                  <div><Label>Resumen</Label><Textarea value={draftForm.summary} onChange={(e) => setDraftForm({ ...draftForm, summary: e.target.value })} rows={2} /></div>
                  <div><Label>Cuerpo (Markdown)</Label><Textarea value={draftForm.body_markdown} onChange={(e) => setDraftForm({ ...draftForm, body_markdown: e.target.value })} rows={6} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Fuente</Label><Input value={draftForm.source_name} onChange={(e) => setDraftForm({ ...draftForm, source_name: e.target.value })} /></div>
                    <div><Label>URL fuente</Label><Input value={draftForm.source_url} onChange={(e) => setDraftForm({ ...draftForm, source_url: e.target.value })} /></div>
                  </div>
                  <Button onClick={handleDraftSave} className="w-full">Guardar borrador</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(emptyForm); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Nuevo artículo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nuevo artículo</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titular</Label><Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></div>
                  <div><Label>Slug (opcional)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generado" /></div>
                  <div><Label>Resumen</Label><Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={2} /></div>
                  <div><Label>Cuerpo (Markdown)</Label><Textarea value={form.body_markdown} onChange={(e) => setForm({ ...form, body_markdown: e.target.value })} rows={6} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Fuente</Label><Input value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} /></div>
                    <div><Label>URL fuente</Label><Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></div>
                  </div>
                  <Button onClick={handleCreate} className="w-full">Crear artículo</Button>
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
              {filtered.map((a) => (
                <div key={a.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{a.headline}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={statusColors[a.status]}>{a.status}</Badge>
                      {a.source_name && <span className="text-xs text-muted-foreground">{a.source_name}</span>}
                    </div>
                  </div>
                  {a.status === "needs_review" && (
                    <div className="flex gap-2 ml-3">
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(a.id)} title="Aprobar">
                        <Check className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReject(a.id)} title="Rechazar">
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">No hay artículos en esta categoría.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
