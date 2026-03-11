import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  BellOff,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Unlock,
  User,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [threadScope, setThreadScope] = useState<"open" | "all">("open");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [needsReplyIds, setNeedsReplyIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
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

  const fetchLastSenders = useCallback(async (threadIds: string[]) => {
    if (threadIds.length === 0) {
      setNeedsReplyIds(new Set());
      return;
    }
    const { data } = await (supabase as any)
      .from("support_messages")
      .select("thread_id, sender_type")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(50, threadIds.length * 4));

    const seen = new Set<string>();
    const needsReply = new Set<string>();
    for (const msg of (data ?? []) as { thread_id: string; sender_type: string }[]) {
      if (!seen.has(msg.thread_id)) {
        seen.add(msg.thread_id);
        if (msg.sender_type === "visitor") needsReply.add(msg.thread_id);
      }
    }
    setNeedsReplyIds(needsReply);
  }, []);

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
    void fetchLastSenders(rows.map((t) => t.id));

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
  }, [checkLatestThreadMessageForNotification, fetchLastSenders, selectedThreadId, threadScope]);

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
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
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
    setNeedsReplyIds((prev) => { const next = new Set(prev); next.delete(selectedThread.id); return next; });
    await Promise.all([fetchThreads(), fetchMessages(selectedThread.id)]);
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileView("thread");
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
            <div className={`rounded-lg border border-border bg-card ${mobileView === "thread" ? "hidden lg:block" : "block"}`}>
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
                  const needsReply = needsReplyIds.has(thread.id);
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => handleSelectThread(thread.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-primary/50 bg-primary/10"
                          : needsReply
                          ? "border-primary/30 bg-primary/5 hover:border-primary/50"
                          : "border-border hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          {needsReply && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{thread.visitor_name || "Visitante"}</p>
                            <p className="truncate text-xs text-muted-foreground">{thread.visitor_email || "Sin email"}</p>
                          </div>
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

            <div className={`rounded-lg border border-border bg-card ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
              {!selectedThread ? (
                <div className="p-8 text-center text-muted-foreground">
                  Selecciona una conversacion para ver los mensajes.
                </div>
              ) : (
                <div className="flex h-[620px] min-h-0 flex-col">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMobileView("list")}
                            className="lg:hidden text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            ← Volver
                          </button>
                          <p className="font-display text-lg font-semibold text-foreground">{selectedThread.visitor_name || "Visitante"}</p>
                        </div>
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

                  <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
      </div>
    </div>
  );
}
