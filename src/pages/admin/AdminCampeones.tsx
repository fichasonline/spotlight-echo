import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Pencil, Upload, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Champion {
  id: string;
  name: string;
  tournament: string;
  amount: number;
  currency: "UYU" | "USD";
  image_url: string | null;
  week_number: number;
  year_week: string;
  created_at: string;
  created_by: string | null;
}

interface ChampionForm {
  name: string;
  tournament: string;
  amount: string;
  currency: "UYU" | "USD";
  image_url: string;
}

const emptyForm: ChampionForm = {
  name: "",
  tournament: "",
  amount: "",
  currency: "UYU",
  image_url: "",
};

function getWeekInfo() {
  const now = new Date();
  const weekNumber = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
  const year = now.getFullYear();
  return { weekNumber, year, yearWeek: `${year}-W${weekNumber.toString().padStart(2, '0')}` };
}

export default function AdminCampeones() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [champions, setChampions] = useState<Champion[]>([]);
  const [forms, setForms] = useState<ChampionForm[]>([JSON.parse(JSON.stringify(emptyForm))]);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Champion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChampions = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("champions")
      .select("id, name, tournament, amount, currency, image_url, week_number, year_week, created_at, created_by")
      .order("year_week", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setChampions(data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchChampions();
  }, []);

  const handleImageUpload = async (file: File, formIndex: number) => {
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploadingImage(filePath);

    const { error: uploadError } = await supabase.storage
      .from("champions")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      toast({ title: "Error", description: uploadError.message, variant: "destructive" });
      setUploadingImage(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("champions").getPublicUrl(filePath);

    const newForms = [...forms];
    newForms[formIndex].image_url = publicUrlData.publicUrl;
    setForms(newForms);
    setUploadingImage(null);

    toast({ title: "Éxito", description: "Imagen subida correctamente" });
  };

  const handleAddForm = () => {
    setForms([...forms, JSON.parse(JSON.stringify(emptyForm))]);
  };

  const handleRemoveForm = (index: number) => {
    const newForms = forms.filter((_, i) => i !== index);
    setForms(newForms.length > 0 ? newForms : [emptyForm]);
  };

  const handleFormChange = (index: number, field: keyof ChampionForm, value: string) => {
    const newForms = [...forms];
    newForms[index][field] = value;
    setForms(newForms);
  };

  const handleSaveChampions = async () => {
    const validForms = forms.filter((f) => f.name.trim() && f.tournament.trim() && f.amount.trim());

    if (validForms.length === 0) {
      toast({ title: "Falta información", description: "Completa al menos un campeón con nombre, torneo y monto.", variant: "destructive" });
      return;
    }

    if (editId) {
      // Edit mode
      const form = forms[0];
      const { error } = await supabase
        .from("champions")
        .update({
          name: form.name,
          tournament: form.tournament,
          amount: parseFloat(form.amount),
          currency: form.currency,
          image_url: form.image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editId);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      // Insert mode
      const toInsert = validForms.map((f) => ({
        name: f.name,
        tournament: f.tournament,
        amount: parseFloat(f.amount),
        currency: f.currency,
        image_url: f.image_url || null,
        created_by: user?.id,
      }));

      const { error } = await (supabase as any).from("champions").insert(toInsert);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    setOpen(false);
    setForms([emptyForm]);
    setEditId(null);
    void fetchChampions();
    toast({ title: "Éxito", description: editId ? "Campeón actualizado" : "Campeones agregados" });
  };

  const handleEdit = (champion: Champion) => {
    setForms([
      {
        name: champion.name,
        tournament: champion.tournament,
        amount: champion.amount.toString(),
        currency: champion.currency,
        image_url: champion.image_url || "",
      },
    ]);
    setEditId(champion.id);
    setOpen(true);
  };

  const handleDelete = async (champion: Champion) => {
    setDeletingId(champion.id);

    const { error } = await supabase.from("champions").delete().eq("id", champion.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      void fetchChampions();
    }

    setDeleteTarget(null);
    setDeletingId(null);
  };

  const handlePaste = async (e: React.ClipboardEvent, formIndex: number) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleImageUpload(file, formIndex);
        }
        break;
      }
    }
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setForms([JSON.parse(JSON.stringify(emptyForm))]);
      setEditId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Gestionar Campeones</h1>
          <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setForms([emptyForm]);
                setEditId(null);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Campeón
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Campeón" : "Agregar Campeones"}</DialogTitle>
                {!editId && (
                  <p className="text-sm text-gray-500 mt-2">
                    Semana actual: <span className="font-semibold">{getWeekInfo().yearWeek}</span>
                  </p>
                )}
              </DialogHeader>

              <div className="space-y-6" onPaste={(e) => handlePaste(e, forms.length > 1 ? 0 : 0)}>
                {forms.map((form, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4 relative" onPaste={(e) => handlePaste(e, index)}>
                    {forms.length > 1 && (
                      <button
                        onClick={() => handleRemoveForm(index)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    <div>
                      <Label htmlFor={`name-${index}`}>Nombre del Campeón *</Label>
                      <Input
                        id={`name-${index}`}
                        placeholder="ej: Diego López"
                        value={form.name}
                        onChange={(e) => handleFormChange(index, "name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`tournament-${index}`}>Torneo *</Label>
                      <Input
                        id={`tournament-${index}`}
                        placeholder="ej: Campeonato Sudamericano 2026"
                        value={form.tournament}
                        onChange={(e) => handleFormChange(index, "tournament", e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor={`amount-${index}`}>Monto Ganado *</Label>
                        <Input
                          id={`amount-${index}`}
                          type="number"
                          placeholder="1000.00"
                          step="0.01"
                          value={form.amount}
                          onChange={(e) => handleFormChange(index, "amount", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`currency-${index}`}>Moneda *</Label>
                        <Select value={form.currency} onValueChange={(value) => handleFormChange(index, "currency", value)}>
                          <SelectTrigger id={`currency-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UYU">Pesos (UYU)</SelectItem>
                            <SelectItem value="USD">Dólares (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`image-${index}`}>Imagen</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`image-${index}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleImageUpload(file, index);
                            }
                          }}
                          disabled={uploadingImage === `image-${index}`}
                        />
                        {uploadingImage === `image-${index}` && (
                          <div className="flex items-center text-sm text-gray-500">Subiendo...</div>
                        )}
                      </div>
                      {form.image_url && (
                        <div className="mt-2 flex gap-2 items-start">
                          <img src={form.image_url} alt="Preview" className="w-20 h-20 object-cover rounded" />
                          <div className="text-sm text-green-600">Imagen subida ✓</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {!editId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddForm}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Otro Campeón
                  </Button>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveChampions}>
                    {editId ? "Actualizar" : "Guardar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6">
          {Object.entries(
            champions.reduce((acc, champ) => {
              const week = champ.year_week || "Sin semana";
              if (!acc[week]) acc[week] = [];
              acc[week].push(champ);
              return acc;
            }, {} as Record<string, Champion[]>)
          ).map(([week, weekChampions]) => (
            <div key={week} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Semana {week}</h3>
                <p className="text-sm text-gray-600">{weekChampions.length} campeón{weekChampions.length !== 1 ? "es" : ""}</p>
              </div>
              <table className="w-full">
                <tbody className="divide-y">
                  {weekChampions.map((champion) => (
                    <tr key={champion.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {champion.image_url && (
                            <img src={champion.image_url} alt={champion.name} className="w-10 h-10 rounded object-cover" />
                          )}
                          <div>
                            <div className="font-medium">{champion.name}</div>
                            <div className="text-sm text-gray-500">{champion.tournament}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold">
                        {champion.currency === "USD" ? "$" : "$"} {champion.amount.toLocaleString("es-UY")}
                        <span className="ml-2 text-gray-500 text-xs">{champion.currency}</span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(champion)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(champion)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {champions.length === 0 && (
            <div className="bg-white rounded-lg shadow px-6 py-8 text-center text-gray-500">
              No hay campeones registrados aún
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar campeón</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar a {deleteTarget?.name}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={deletingId === deleteTarget?.id}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId === deleteTarget?.id ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
