import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  BellOff,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Unlock,
  User,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
}

interface SupportThread {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: "open" | "closed";
  created_at: string;
  last_message_at: string;
}

interface SupportMessage {
  id: string;
  thread_id: string;
  sender_type: "visitor" | "staff";
  sender_name: string | null;
  body: string;
  created_at: string;
}

interface RealtimeSupportMessageRow {
  id: string;
  thread_id: string;
  sender_type: "visitor" | "staff";
  sender_name: string | null;
  body: string;
  created_at: string;
}

function isMissingRpcError(error: { message?: string; code?: string } | null, functionName: string) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "PGRST202" || (message.includes("could not find the function") && message.includes(functionName.toLowerCase()));
}

function formatDateTime(value: string) {
  return format(new Date(value), "d MMM yyyy HH:mm", { locale: es });
}

function playIncomingChatTone() {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;

  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, context.currentTime);

    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.24);

    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // Ignora bloqueos de autoplay o errores de audio del navegador.
  }
}

export default function AdminModeracion() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [threadScope, setThreadScope] = useState<"open" | "all">("open");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const previousThreadMessageAtRef = useRef<Record<string, string>>({});
  const hasThreadsBaselineRef = useRef(false);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const notifyIncomingVisitorMessage = useCallback(
    (message: Pick<SupportMessage, "id" | "sender_type" | "sender_name" | "body">) => {
      if (message.sender_type !== "visitor") return;
      if (notifiedMessageIdsRef.current.has(message.id)) return;
      notifiedMessageIdsRef.current.add(message.id);

      const senderName = message.sender_name?.trim() || "Visitante";
      const preview = message.body.replace(/\s+/g, " ").trim().slice(0, 90);

      toast({
        title: "Nuevo mensaje de chat",
        description: preview ? `${senderName}: ${preview}` : `${senderName} envio un mensaje`,
      });

      if (soundEnabled) {
        playIncomingChatTone();
      }
    },
    [soundEnabled, toast],
  );

  const checkLatestThreadMessageForNotification = useCallback(
    async (threadId: string) => {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("id, sender_type, sender_name, body")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      notifyIncomingVisitorMessage(data as Pick<SupportMessage, "id" | "sender_type" | "sender_name" | "body">);
    },
    [notifyIncomingVisitorMessage],
  );

  const fetchReports = async () => {
    setReportsError(null);

    const { data, error } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, status, created_at, profiles:reporter_id(display_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setReports([]);
      setReportsError(error.message);
      return;
    }

    setReports((data as Report[]) ?? []);
  };

  const fetchThreads = useCallback(async () => {
    setThreadsError(null);

    const rpcResult = await (supabase as any).rpc("list_support_threads_for_staff", {
      p_status: threadScope === "all" ? "all" : "open",
      p_limit: 100,
    });

    let rows: SupportThread[] = [];

    if (!rpcResult.error) {
      rows = (rpcResult.data ?? []) as SupportThread[];
    } else if (isMissingRpcError(rpcResult.error, "list_support_threads_for_staff")) {
      let query = (supabase as any)
        .from("support_threads")
        .select("id, visitor_name, visitor_email, visitor_phone, status, created_at, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(100);

      if (threadScope === "open") {
        query = query.eq("status", "open");
      }

      const { data, error } = await query;
      if (error) {
        setThreads([]);
        setThreadsError(error.message);
        return;
      }

      rows = (data ?? []) as SupportThread[];
    } else {
      setThreads([]);
      setThreadsError(rpcResult.error.message);
      return;
    }
    setThreads(rows);

    if (hasThreadsBaselineRef.current) {
      const changedThreadIds = rows
        .filter((thread) => previousThreadMessageAtRef.current[thread.id] !== thread.last_message_at)
        .map((thread) => thread.id);

      if (changedThreadIds.length > 0) {
        void Promise.all(changedThreadIds.slice(0, 20).map((threadId) => checkLatestThreadMessageForNotification(threadId)));
      }
    }

    previousThreadMessageAtRef.current = rows.reduce<Record<string, string>>((acc, thread) => {
      acc[thread.id] = thread.last_message_at;
      return acc;
    }, {});
    hasThreadsBaselineRef.current = true;

    if (!selectedThreadId && rows.length > 0) {
      setSelectedThreadId(rows[0].id);
      return;
    }

    if (selectedThreadId && !rows.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(rows[0]?.id ?? null);
    }
  }, [checkLatestThreadMessageForNotification, selectedThreadId, threadScope]);

  const fetchMessages = useCallback(async (threadId: string) => {
    setLoadingMessages(true);

    const rpcResult = await (supabase as any).rpc("list_support_messages_for_staff", {
      p_thread_id: threadId,
    });
    let rows: SupportMessage[] = [];

    if (!rpcResult.error) {
      rows = (rpcResult.data ?? []) as SupportMessage[];
    } else if (isMissingRpcError(rpcResult.error, "list_support_messages_for_staff")) {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("id, thread_id, sender_type, sender_name, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        setLoadingMessages(false);
        toast({ title: "No pudimos cargar los mensajes", description: error.message, variant: "destructive" });
        return;
      }

      rows = (data ?? []) as SupportMessage[];
    } else {
      setLoadingMessages(false);
      toast({ title: "No pudimos cargar los mensajes", description: rpcResult.error.message, variant: "destructive" });
      return;
    }

    setMessages(rows);
    setLoadingMessages(false);
  }, [toast]);

  useEffect(() => {
    void fetchReports();
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchThreads();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchThreads]);

  useEffect(() => {
    previousThreadMessageAtRef.current = {};
    hasThreadsBaselineRef.current = false;
  }, [threadScope]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`support-messages-staff-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
        },
        (payload) => {
          const incoming = payload.new as Partial<RealtimeSupportMessageRow>;
          if (!incoming.id || !incoming.thread_id || !incoming.sender_type || typeof incoming.body !== "string") return;

          notifyIncomingVisitorMessage({
            id: incoming.id,
            sender_type: incoming.sender_type,
            sender_name: incoming.sender_name ?? null,
            body: incoming.body,
          });

          void fetchThreads();

          if (selectedThreadId === incoming.thread_id) {
            void fetchMessages(incoming.thread_id);
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[AdminModeracion] Realtime channel error on support_messages");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchMessages, fetchThreads, notifyIncomingVisitorMessage, selectedThreadId, user]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    void fetchMessages(selectedThreadId);

    const intervalId = window.setInterval(() => {
      void fetchMessages(selectedThreadId);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchMessages, selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handleSendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedThread || !replyText.trim() || !user) return;

    if (selectedThread.status === "closed") {
      toast({
        title: "Conversacion cerrada",
        description: "Reabre el chat para responder.",
        variant: "destructive",
      });
      return;
    }

    setSendingReply(true);
    const rpcResult = await (supabase as any).rpc("send_support_message_from_staff", {
      p_thread_id: selectedThread.id,
      p_message: replyText.trim(),
      p_sender_name: null,
    });
    let error = rpcResult.error;

    if (error && isMissingRpcError(error, "send_support_message_from_staff")) {
      const fallback = await (supabase as any)
        .from("support_messages")
        .insert({
          thread_id: selectedThread.id,
          sender_type: "staff",
          sender_user_id: user.id,
          sender_name: null,
          body: replyText.trim(),
        });
      error = fallback.error;
    }
    setSendingReply(false);

    if (error) {
      toast({ title: "No pudimos enviar la respuesta", description: error.message, variant: "destructive" });
      return;
    }

    setReplyText("");
    await Promise.all([fetchThreads(), fetchMessages(selectedThread.id)]);
  };

  const handleSetThreadStatus = async (threadId: string, nextStatus: "open" | "closed") => {
    const rpcResult = await (supabase as any).rpc("set_support_thread_status_for_staff", {
      p_thread_id: threadId,
      p_status: nextStatus,
    });
    let error = rpcResult.error;

    if (error && isMissingRpcError(error, "set_support_thread_status_for_staff")) {
      const fallback = await (supabase as any)
        .from("support_threads")
        .update({ status: nextStatus })
        .eq("id", threadId);
      error = fallback.error;
    }

    if (error) {
      toast({
        title: "No pudimos actualizar el estado",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: nextStatus === "closed" ? "Chat cerrado" : "Chat reabierto" });
    await Promise.all([fetchThreads(), fetchMessages(threadId)]);
  };

  const handleHide = async (report: Report) => {
    if (report.target_type === "post") {
      await supabase.from("posts").update({ is_hidden: true }).eq("id", report.target_id);
    } else if (report.target_type === "comment") {
      await supabase.from("comments").update({ is_deleted: true }).eq("id", report.target_id);
    }
    await supabase.from("reports").update({ status: "resolved" }).eq("id", report.id);
    toast({ title: "Contenido oculto" });
    void fetchReports();
  };

  const handleDismiss = async (id: string) => {
    await supabase.from("reports").update({ status: "dismissed" }).eq("id", id);
    void fetchReports();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto space-y-10 px-4 py-8">
        <section>
          <div className="mb-6 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold">Soporte y moderacion</h1>
          </div>

          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display text-lg font-semibold">Chats</h2>
                <p className="text-xs text-muted-foreground">Conversaciones con visitantes</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={threadScope === "open" ? "default" : "outline"}
                    onClick={() => setThreadScope("open")}
                    className="h-7 px-2 text-xs"
                  >
                    Abiertos
                  </Button>
                  <Button
                    size="sm"
                    variant={threadScope === "all" ? "default" : "outline"}
                    onClick={() => setThreadScope("all")}
                    className="h-7 px-2 text-xs"
                  >
                    Todos
                  </Button>
                  <Button
                    size="sm"
                    variant={soundEnabled ? "secondary" : "outline"}
                    onClick={() => setSoundEnabled((current) => !current)}
                    className="h-7 px-2 text-xs"
                    title={soundEnabled ? "Desactivar sonido de aviso" : "Activar sonido de aviso"}
                  >
                    {soundEnabled ? <Bell className="mr-1 h-3.5 w-3.5" /> : <BellOff className="mr-1 h-3.5 w-3.5" />}
                    {soundEnabled ? "Sonido on" : "Sonido off"}
                  </Button>
                </div>
              </div>

              <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
                {threads.map((thread) => {
                  const isActive = thread.id === selectedThreadId;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{thread.visitor_name || "Visitante"}</p>
                          <p className="truncate text-xs text-muted-foreground">{thread.visitor_email || "Sin email"}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            thread.status === "open"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {thread.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Ultimo mensaje: {formatDateTime(thread.last_message_at)}
                      </p>
                    </button>
                  );
                })}

                {!threadsError && threads.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No hay chats activos.</p>
                )}

                {threadsError && (
                  <p className="py-6 text-sm text-destructive">Error al cargar chats: {threadsError}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              {!selectedThread ? (
                <div className="p-8 text-center text-muted-foreground">
                  Selecciona una conversacion para ver los mensajes.
                </div>
              ) : (
                <div className="flex h-[620px] min-h-0 flex-col">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-display text-lg font-semibold text-foreground">{selectedThread.visitor_name || "Visitante"}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" /> {selectedThread.visitor_email || "Sin email"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {selectedThread.visitor_phone || "Sin telefono"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            Desde {formatDateTime(selectedThread.created_at)}
                          </span>
                        </div>
                      </div>

                      {selectedThread.status === "open" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSetThreadStatus(selectedThread.id, "closed")}
                        >
                          <Lock className="mr-1 h-4 w-4" /> Cerrar chat
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSetThreadStatus(selectedThread.id, "open")}
                        >
                          <Unlock className="mr-1 h-4 w-4" /> Reabrir chat
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {loadingMessages && messages.length === 0 && (
                      <p className="text-sm text-muted-foreground">Cargando mensajes...</p>
                    )}

                    {messages.map((message) => {
                      const isVisitor = message.sender_type === "visitor";
                      return (
                        <div
                          key={message.id}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            isVisitor
                              ? "mr-auto border border-border bg-background text-foreground"
                              : "ml-auto bg-primary text-primary-foreground"
                          }`}
                        >
                          {isVisitor ? (
                            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                              {message.sender_name || "Visitante"}
                            </p>
                          ) : (
                            <p className="mb-1 text-[11px] font-semibold text-primary-foreground/80">
                              {message.sender_name || "Staff"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isVisitor ? "text-muted-foreground" : "text-primary-foreground/75"
                            }`}
                          >
                            {formatDateTime(message.created_at)}
                          </p>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendReply} className="border-t border-border p-3">
                    {selectedThread.status === "closed" && (
                      <p className="mb-2 text-xs text-amber-300">Este chat esta cerrado. Reabre para responder.</p>
                    )}
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value.slice(0, 1500))}
                        placeholder={selectedThread.status === "open" ? "Escribe una respuesta" : "Chat cerrado"}
                        rows={2}
                        className="min-h-[44px] resize-none"
                        disabled={selectedThread.status === "closed" || sendingReply}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={selectedThread.status === "closed" || sendingReply || !replyText.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-display font-bold">Reportes pendientes</h2>

          {reportsError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              No se pudieron cargar los reportes: {reportsError}
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{report.profiles?.display_name ?? "Anonimo"}</span> reporto un{" "}
                        <span className="font-semibold text-accent">{report.target_type}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">"{report.reason}"</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(report.created_at)}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void handleHide(report)} title="Ocultar contenido">
                        <EyeOff className="mr-1 h-4 w-4" /> Ocultar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDismiss(report.id)} title="Descartar">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {reports.length === 0 && (
                <p className="py-10 text-center text-muted-foreground">No hay reportes pendientes.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
