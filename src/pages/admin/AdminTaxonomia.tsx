import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ARTICLE_CATEGORIES, TAG_TYPES, slugify, type Tag, type TagType } from "@/lib/taxonomy";

interface TagRow extends Tag {
  usage: number;
}

export default function AdminTaxonomia() {
  const { toast } = useToast();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TagType>("circuito");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null);

  const db = supabase as any;

  const load = async () => {
    const [tagRes, linkRes, articleRes] = await Promise.all([
      db.from("tags").select("id, slug, name, type").order("name"),
      db.from("article_tags").select("tag_id"),
      db.from("articles").select("category"),
    ]);

    // Los conteos se agregan acá y no en SQL: PostgREST no expone GROUP BY, y
    // a esta escala (cientos de filas de sólo una columna) el costo es trivial.
    const usage = new Map<string, number>();
    ((linkRes.data ?? []) as { tag_id: string }[]).forEach((row) => {
      usage.set(row.tag_id, (usage.get(row.tag_id) ?? 0) + 1);
    });

    const perCategory: Record<string, number> = {};
    let sinCategoria = 0;
    ((articleRes.data ?? []) as { category: string | null }[]).forEach((row) => {
      if (!row.category) sinCategoria += 1;
      else perCategory[row.category] = (perCategory[row.category] ?? 0) + 1;
    });

    setTags(
      ((tagRes.data ?? []) as Tag[]).map((tag) => ({ ...tag, usage: usage.get(tag.id) ?? 0 })),
    );
    setCategoryCounts(perCategory);
    setUncategorized(sinCategoria);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    const slug = slugify(name);
    if (!slug) {
      toast({ title: "Nombre inválido", description: "No se pudo generar un slug.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await db.from("tags").insert({ name, slug, type: newType });
    setSaving(false);

    if (error) {
      toast({
        title: "No se pudo crear",
        description: error.code === "23505" ? `Ya existe una etiqueta con el slug "${slug}".` : error.message,
        variant: "destructive",
      });
      return;
    }

    setNewName("");
    void load();
  };

  const handleRename = async (tag: TagRow) => {
    const name = editName.trim();
    if (!name || name === tag.name) {
      setEditId(null);
      return;
    }

    // El slug NO se regenera: es parte de la URL pública de la página de
    // etiqueta. Renombrar "WSOP" a "WSOP Circuit" no debería romper /wsop/.
    const { error } = await db.from("tags").update({ name }).eq("id", tag.id);
    if (error) {
      toast({ title: "No se pudo renombrar", description: error.message, variant: "destructive" });
      return;
    }
    setEditId(null);
    void load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await db.from("tags").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" });
      return;
    }
    void load();
  };

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Categorías y etiquetas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada nota lleva una sola categoría. Todo lo demás —circuito, país, sala— va como etiqueta.
      </p>

      {/* ── Categorías ──────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Categorías</h2>
          <span className="text-xs text-muted-foreground">Fijas: definidas en el esquema</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLE_CATEGORIES.map((category) => (
            <div key={category.value} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium text-foreground">{category.label}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">/{category.slug}/</p>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">
                {loading ? "—" : (categoryCounts[category.value] ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">notas</p>
            </div>
          ))}

          <div className="rounded-lg border border-dashed border-border bg-card/50 p-4">
            <p className="font-medium text-muted-foreground">Sin categoría</p>
            <p className="mt-0.5 text-xs text-muted-foreground">No aparecen en ninguna sección</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{loading ? "—" : uncategorized}</p>
            <Link to="/admin/noticias" className="text-xs text-primary hover:underline">
              Ir a clasificarlas →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Etiquetas ───────────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Etiquetas</h2>

        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tag-name">Nueva etiqueta</Label>
            <Input
              id="tag-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate();
              }}
              placeholder="Nombre visible, ej. WSOP Paradise"
            />
            {newName.trim() && (
              <p className="font-mono text-xs text-muted-foreground">/{slugify(newName)}/</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-type">Tipo</Label>
            <Select value={newType} onValueChange={(value) => setNewType(value as TagType)}>
              <SelectTrigger id="tag-type" className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAG_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void handleCreate()} disabled={saving || !newName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Crear
          </Button>
        </div>

        <div className="mt-6 space-y-6">
          {TAG_TYPES.map((type) => {
            const group = tags.filter((tag) => tag.type === type.value);
            return (
              <div key={type.value}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {type.label} ({group.length})
                </h3>

                {group.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Todavía no hay etiquetas de este tipo.</p>
                ) : (
                  <div className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                    {group.map((tag) => (
                      <div key={tag.id} className="flex items-center gap-3 px-4 py-2.5">
                        {editId === tag.id ? (
                          <>
                            <Input
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void handleRename(tag);
                                if (event.key === "Escape") setEditId(null);
                              }}
                              autoFocus
                              className="h-8 flex-1"
                            />
                            <Button size="sm" variant="ghost" onClick={() => void handleRename(tag)}>
                              <Check className="h-4 w-4 text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 truncate font-medium text-foreground">{tag.name}</span>
                            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                              /{tag.slug}/
                            </span>
                            <Badge variant="outline" className={tag.usage === 0 ? "text-muted-foreground" : undefined}>
                              {tag.usage} {tag.usage === 1 ? "nota" : "notas"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditId(tag.id);
                                setEditName(tag.name);
                              }}
                              title="Renombrar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(tag)}
                              title="Borrar"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar “{deleteTarget?.name}”</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.usage > 0
                ? `Está aplicada a ${deleteTarget.usage} ${
                    deleteTarget.usage === 1 ? "nota" : "notas"
                  }. Se va a desasignar de todas y su página pública dejará de existir. Las notas no se borran.`
                : "No está aplicada a ninguna nota, así que no afecta contenido publicado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
