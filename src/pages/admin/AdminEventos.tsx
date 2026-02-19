import { useEffect, useState } from "react";
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

interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  country: string | null;
  city: string | null;
  venue: string | null;
  description: string | null;
}

const emptyForm = { name: "", start_date: "", end_date: "", country: "", city: "", venue: "", description: "" };

export default function AdminEventos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("*").order("start_date", { ascending: false });
    if (data) setEvents(data);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleSave = async () => {
    const payload = {
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date || null,
      country: form.country || null,
      city: form.city || null,
      venue: form.venue || null,
      description: form.description || null,
      created_by: user?.id,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("events").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("events").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      fetchEvents();
    }
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
    });
    setEditId(e.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("events").delete().eq("id", id);
    fetchEvents();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display font-bold">Gestión de eventos</h1>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(emptyForm); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nuevo evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar evento" : "Nuevo evento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>Fecha fin</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>País</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                  <div><Label>Ciudad</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
                </div>
                <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <Button onClick={handleSave} className="w-full">{editId ? "Guardar cambios" : "Crear evento"}</Button>
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
                  {format(new Date(e.start_date), "d MMM yyyy", { locale: es })}
                  {e.end_date && ` — ${format(new Date(e.end_date), "d MMM yyyy", { locale: es })}`}
                  {e.city && ` · ${e.city}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(e)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)}>
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
