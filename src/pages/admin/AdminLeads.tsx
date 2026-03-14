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
  // Uruguayan numbers: 9 digits starting with 09x → strip leading 0, prepend +598
  let e164 = digits;
  if (digits.length === 9 && digits.startsWith("0")) {
    e164 = "598" + digits.slice(1);
  } else if (digits.length === 8) {
    e164 = "598" + digits;
  } else if (!digits.startsWith("598") && !digits.startsWith("+")) {
    e164 = "598" + digits;
  }
  const msg = encodeURIComponent(
    `Hola! 👋\nSoy [Nombre] del equipo de Fichas Online.\n\nVi que te registraste para recibir la información de torneos.\n\nLa idea es pasarte las grillas y los torneos que se están jugando para que tengas todo claro y no se te pase ninguno.\n\nAntes de mandarte la info, te hago una consulta rápida:\n\n¿Sos más de torneos chicos para divertirte o te gustan torneos más grandes?`
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

export default function AdminLeads() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Lead>>({});

  // View modal
  const [viewLead, setViewLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const [leadsResult, openThreadsResult] = await Promise.all([
      (supabase as any)
        .from("support_leads")
        .select("id, full_name, email, phone, source, status, created_at")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("support_threads")
        .select("lead_id")
        .eq("status", "open"),
    ]);

    if (leadsResult.error) {
      toast({ title: "Error al cargar leads", description: leadsResult.error.message, variant: "destructive" });
    } else if (openThreadsResult.error) {
      toast({ title: "Error al cargar chats", description: openThreadsResult.error.message, variant: "destructive" });
    } else {
      const openLeadIds = new Set(
        ((openThreadsResult.data ?? []) as { lead_id: string | null }[])
          .map((thread) => thread.lead_id)
          .filter((leadId): leadId is string => Boolean(leadId)),
      );

      setLeads(
        ((leadsResult.data ?? []) as any[])
          .map((lead) => ({ ...lead, status: lead.status ?? "nuevo" }))
          .filter((lead) => !openLeadIds.has(lead.id)),
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
        prev.map((l) => (l.id === id ? { ...l, ...editDraft } as Lead : l))
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
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    }
  }

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (l.full_name?.toLowerCase() ?? "").includes(q) ||
      (l.email?.toLowerCase() ?? "").includes(q) ||
      (l.phone ?? "").includes(q) ||
      (l.source?.toLowerCase() ?? "").includes(q);
    const matchesStatus = filterStatus === "all" || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold">Leads de soporte</h1>
            <p className="text-sm text-muted-foreground">{leads.length} contactos sin chat abierto</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nombre, email, teléfono o fuente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as LeadStatus | "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {loading ? (
            <p className="text-center text-muted-foreground py-12">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No hay leads{search ? " que coincidan con la búsqueda" : ""}.
            </p>
          ) : (
            filtered.map((lead) => {
              const isEditing = editId === lead.id;
              const hasWA = isLikelyWhatsApp(lead.phone ?? "");
              return (
                <div key={lead.id} className="rounded-lg border border-border p-4 space-y-3 bg-card">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {isEditing ? (
                        <Input
                          value={editDraft.full_name ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, full_name: e.target.value }))}
                          className="h-7"
                          placeholder="Nombre"
                        />
                      ) : (
                        <p className="font-semibold truncate">{lead.full_name ?? "—"}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(lead.created_at).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                    </div>
                    <Select
                      value={isEditing ? (editDraft.status ?? lead.status) : lead.status}
                      onValueChange={(v) =>
                        isEditing
                          ? setEditDraft((d) => ({ ...d, status: v as LeadStatus }))
                          : updateStatus(lead.id, v as LeadStatus)
                      }
                    >
                      <SelectTrigger className="h-auto border-0 bg-transparent p-0 w-auto hover:bg-muted/50 focus:ring-0 [&>svg]:hidden shrink-0">
                        <StatusBadge status={(isEditing ? editDraft.status : lead.status) ?? lead.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Email */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                    {isEditing ? (
                      <Input
                        value={editDraft.email ?? ""}
                        onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                        className="h-7"
                        placeholder="Email"
                      />
                    ) : (
                      <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline break-all">
                        {lead.email ?? "—"}
                      </a>
                    )}
                  </div>

                  {/* Phone + source row */}
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Teléfono</p>
                      {isEditing ? (
                        <Input
                          value={editDraft.phone ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                          className="h-7"
                          placeholder="Teléfono"
                        />
                      ) : (
                        <p className="text-sm">{lead.phone ?? "—"}</p>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Fuente</p>
                      {isEditing ? (
                        <Input
                          value={editDraft.source ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, source: e.target.value }))}
                          className="h-7"
                          placeholder="Fuente"
                        />
                      ) : (
                        <Badge variant="outline" className="text-xs">{lead.source ?? "—"}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
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

        {/* Desktop table */}
        <div className="hidden md:block rounded-lg border border-border">
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No hay leads{search ? " que coincidan con la búsqueda" : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => {
                  const isEditing = editId === lead.id;
                  const hasWA = isLikelyWhatsApp(lead.phone ?? "");
                  return (
                    <TableRow key={lead.id}>
                      {/* Nombre */}
                      <TableCell className="truncate">
                        {isEditing ? (
                          <Input
                            value={editDraft.full_name ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, full_name: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <span className="font-medium truncate block" title={lead.full_name}>{lead.full_name}</span>
                        )}
                      </TableCell>

                      {/* Email */}
                      <TableCell className="truncate">
                        {isEditing ? (
                          <Input
                            value={editDraft.email ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <a href={`mailto:${lead.email}`} className="text-primary hover:underline truncate block" title={lead.email}>
                            {lead.email}
                          </a>
                        )}
                      </TableCell>

                      {/* Teléfono */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editDraft.phone ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <span className="truncate block">{lead.phone}</span>
                        )}
                      </TableCell>

                      {/* Estado */}
                      <TableCell>
                        <Select
                          value={isEditing ? (editDraft.status ?? lead.status) : lead.status}
                          onValueChange={(v) =>
                            isEditing
                              ? setEditDraft((d) => ({ ...d, status: v as LeadStatus }))
                              : updateStatus(lead.id, v as LeadStatus)
                          }
                        >
                          <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0 hover:bg-muted/50 focus:ring-0 [&>svg]:hidden">
                            <StatusBadge status={(isEditing ? editDraft.status : lead.status) ?? lead.status} />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Fuente */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editDraft.source ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, source: e.target.value }))}
                            className="h-7 w-full"
                          />
                        ) : (
                          <Badge variant="outline" className="text-xs truncate max-w-full">
                            {lead.source}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Fecha */}
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString("es-UY", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>

                      {/* Acciones */}
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

      {/* View Dialog */}
      <Dialog open={!!viewLead} onOpenChange={(open) => !open && setViewLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del lead</DialogTitle>
          </DialogHeader>
          {viewLead && (
            <div className="space-y-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
                <p className="font-medium">{viewLead.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <a href={`mailto:${viewLead.email}`} className="text-primary hover:underline">
                  {viewLead.email}
                </a>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Teléfono</p>
                <div className="flex items-center gap-2">
                  <span>{viewLead.phone}</span>
                  {isLikelyWhatsApp(viewLead.phone) && (
                    <a
                      href={whatsappUrl(viewLead.phone, viewLead.full_name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-1.5 text-green-500 border-green-500/30 hover:bg-green-500/10">
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Estado</p>
                <StatusBadge status={viewLead.status} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Fuente</p>
                <Badge variant="outline">{viewLead.source}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Registrado</p>
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
