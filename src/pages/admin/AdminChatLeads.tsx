import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { isChatLead } from "@/lib/support-leads";
import { ArrowLeft, Eye, Pencil, MessageCircle, Check, X } from "lucide-react";

type LeadStatus = "nuevo" | "contactado" | "en_seguimiento" | "cerrado";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  created_at: string;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "en_seguimiento", label: "En seguimiento" },
  { value: "cerrado", label: "Cerrado" },
];

const STATUS_STYLES: Record<LeadStatus, string> = {
  nuevo: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  contactado: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  en_seguimiento: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  cerrado: "bg-green-500/15 text-green-400 border-green-500/30",
};

function formatPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function whatsappUrl(phone: string, name: string): string {
  const digits = formatPhone(phone);
  let e164 = digits;
  if (digits.length === 9 && digits.startsWith("0")) {
    e164 = "598" + digits.slice(1);
  } else if (digits.length === 8) {
    e164 = "598" + digits;
  } else if (!digits.startsWith("598") && !digits.startsWith("+")) {
    e164 = "598" + digits;
  }
  const msg = encodeURIComponent(
    `Hola! 👋\nSoy [Nombre] del equipo de Fichas Online.\n\nVi tu mensaje en el chat de soporte.\n\nTe escribo para continuar la conversación y ayudarte con lo que necesites.`
  );
  return `https://wa.me/${e164}?text=${msg}`;
}

function isLikelyWhatsApp(phone: string): boolean {
  const digits = formatPhone(phone);
  return digits.length >= 8;
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_STYLES[status] ?? ""}`}>
      {label}
    </Badge>
  );
}

export default function AdminChatLeads() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Lead>>({});
  const [viewLead, setViewLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("support_leads")
      .select("id, full_name, email, phone, source, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error al cargar leads", description: error.message, variant: "destructive" });
    } else {
      setLeads(
        ((data ?? []) as any[])
          .map((lead) => ({ ...lead, status: lead.status ?? "nuevo" }))
          .filter((lead) => isChatLead(lead)),
      );
    }

    setLoading(false);
  }

  function startEdit(lead: Lead) {
    setEditId(lead.id);
    setEditDraft({ full_name: lead.full_name, email: lead.email, phone: lead.phone, source: lead.source, status: lead.status });
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft({});
  }

  async function saveEdit(id: string) {
    const { error } = await (supabase as any)
      .from("support_leads")
      .update(editDraft)
      .eq("id", id);
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead actualizado" });
      setLeads((prev) =>
        prev
          .map((lead) => (lead.id === id ? ({ ...lead, ...editDraft } as Lead) : lead))
          .filter((lead) => isChatLead(lead)),
      );
      cancelEdit();
    }
  }

  async function updateStatus(id: string, status: LeadStatus) {
    const { error } = await (supabase as any)
      .from("support_leads")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast({ title: "Error al actualizar estado", description: error.message, variant: "destructive" });
    } else {
      setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
    }
  }

  const filtered = leads.filter((lead) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (lead.full_name?.toLowerCase() ?? "").includes(q) ||
      (lead.email?.toLowerCase() ?? "").includes(q) ||
      (lead.phone ?? "").includes(q) ||
      (lead.source?.toLowerCase() ?? "").includes(q);
    const matchesStatus = filterStatus === "all" || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold">Leads de chat</h1>
            <p className="text-sm text-muted-foreground">{leads.length} contactos originados en el chat</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nombre, email, teléfono o fuente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as LeadStatus | "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No hay leads de chat{search ? " que coincidan con la búsqueda" : ""}.
            </p>
          ) : (
            filtered.map((lead) => {
              const isEditing = editId === lead.id;
              const hasWA = isLikelyWhatsApp(lead.phone ?? "");
              return (
                <div key={lead.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {isEditing ? (
                        <Input
                          value={editDraft.full_name ?? ""}
                          onChange={(e) => setEditDraft((draft) => ({ ...draft, full_name: e.target.value }))}
                          className="h-7"
                          placeholder="Nombre"
                        />
                      ) : (
                        <p className="truncate font-semibold">{lead.full_name ?? "—"}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString("es-UY", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Select
                      value={isEditing ? (editDraft.status ?? lead.status) : lead.status}
                      onValueChange={(value) =>
                        isEditing
                          ? setEditDraft((draft) => ({ ...draft, status: value as LeadStatus }))
                          : updateStatus(lead.id, value as LeadStatus)
                      }
                    >
                      <SelectTrigger className="h-auto w-auto shrink-0 border-0 bg-transparent p-0 hover:bg-muted/50 focus:ring-0 [&>svg]:hidden">
                        <StatusBadge status={(isEditing ? editDraft.status : lead.status) ?? lead.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-0.5 text-xs text-muted-foreground">Email</p>
                    {isEditing ? (
                      <Input
                        value={editDraft.email ?? ""}
                        onChange={(e) => setEditDraft((draft) => ({ ...draft, email: e.target.value }))}
                        className="h-7"
                        placeholder="Email"
                      />
                    ) : (
                      <a href={`mailto:${lead.email}`} className="break-all text-sm text-primary hover:underline">
                        {lead.email ?? "—"}
                      </a>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs text-muted-foreground">Teléfono</p>
                      {isEditing ? (
                        <Input
                          value={editDraft.phone ?? ""}
                          onChange={(e) => setEditDraft((draft) => ({ ...draft, phone: e.target.value }))}
                          className="h-7"
                          placeholder="Teléfono"
                        />
                      ) : (
                        <p className="text-sm">{lead.phone ?? "—"}</p>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs text-muted-foreground">Fuente</p>
                      {isEditing ? (
                        <Input
                          value={editDraft.source ?? ""}
                          onChange={(e) => setEditDraft((draft) => ({ ...draft, source: e.target.value }))}
                          className="h-7"
                          placeholder="Fuente"
                        />
                      ) : (
                        <Badge variant="outline" className="text-xs">{lead.source ?? "—"}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 border-t border-border pt-1">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-green-500" onClick={() => saveEdit(lead.id)}>
                          <Check className="h-3.5 w-3.5" /> Guardar
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewLead(lead)} title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(lead)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {hasWA && (
                          <a href={whatsappUrl(lead.phone ?? "", lead.full_name ?? "")} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Contactar por WhatsApp">
                              <MessageCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden rounded-lg border border-border md:block">
          <Table className="table-fixed w-full text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[22%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No hay leads de chat{search ? " que coincidan con la búsqueda" : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => {
                  const isEditing = editId === lead.id;
                  const hasWA = isLikelyWhatsApp(lead.phone ?? "");
                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="truncate">
                        {isEditing ? (
                          <Input
                            value={editDraft.full_name ?? ""}
                            onChange={(e) => setEditDraft((draft) => ({ ...draft, full_name: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <span className="block truncate font-medium" title={lead.full_name}>{lead.full_name}</span>
                        )}
                      </TableCell>
                      <TableCell className="truncate">
                        {isEditing ? (
                          <Input
                            value={editDraft.email ?? ""}
                            onChange={(e) => setEditDraft((draft) => ({ ...draft, email: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <a href={`mailto:${lead.email}`} className="block truncate text-primary hover:underline" title={lead.email}>
                            {lead.email}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editDraft.phone ?? ""}
                            onChange={(e) => setEditDraft((draft) => ({ ...draft, phone: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <span className="block truncate">{lead.phone}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={isEditing ? (editDraft.status ?? lead.status) : lead.status}
                          onValueChange={(value) =>
                            isEditing
                              ? setEditDraft((draft) => ({ ...draft, status: value as LeadStatus }))
                              : updateStatus(lead.id, value as LeadStatus)
                          }
                        >
                          <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0 hover:bg-muted/50 focus:ring-0 [&>svg]:hidden">
                            <StatusBadge status={(isEditing ? editDraft.status : lead.status) ?? lead.status} />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editDraft.source ?? ""}
                            onChange={(e) => setEditDraft((draft) => ({ ...draft, source: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <Badge variant="outline" className="max-w-full truncate text-xs">
                            {lead.source}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString("es-UY", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {isEditing ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(lead.id)} title="Guardar">
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} title="Cancelar">
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewLead(lead)} title="Ver detalle">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(lead)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {hasWA && (
                                <a href={whatsappUrl(lead.phone ?? "", lead.full_name ?? "")} target="_blank" rel="noopener noreferrer">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Contactar por WhatsApp">
                                    <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                                  </Button>
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!viewLead} onOpenChange={(open) => !open && setViewLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del lead de chat</DialogTitle>
          </DialogHeader>
          {viewLead && (
            <div className="space-y-4 pt-2">
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Nombre</p>
                <p className="font-medium">{viewLead.full_name}</p>
              </div>
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${viewLead.email}`} className="text-primary hover:underline">
                  {viewLead.email}
                </a>
              </div>
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Teléfono</p>
                <div className="flex items-center gap-2">
                  <span>{viewLead.phone}</span>
                  {isLikelyWhatsApp(viewLead.phone) && (
                    <a href={whatsappUrl(viewLead.phone, viewLead.full_name)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 border-green-500/30 text-green-500 hover:bg-green-500/10">
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Estado</p>
                <StatusBadge status={viewLead.status} />
              </div>
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Fuente</p>
                <Badge variant="outline">{viewLead.source}</Badge>
              </div>
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Registrado</p>
                <p className="text-sm">
                  {new Date(viewLead.created_at).toLocaleString("es-UY", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
