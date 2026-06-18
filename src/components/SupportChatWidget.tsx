import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SUPPORT_CHAT_OPEN_EVENT } from "@/lib/supportChat";

type ThreadStatus = "open" | "closed";

interface SupportMessage {
  id: string;
  sender_type: "visitor" | "staff";
  sender_name: string | null;
  body: string;
  created_at: string;
  thread_status: ThreadStatus;
}

interface SupportChatRpcError {
  message: string;
  code?: string;
}

interface SupportChatRpcResult<T> {
  data: T | null;
  error: SupportChatRpcError | null;
}

interface SupportChatRpcClient {
  rpc<T>(functionName: string, args?: Record<string, unknown>): Promise<SupportChatRpcResult<T>>;
}

interface PersistedSupportSession {
  threadId: string;
  visitorToken: string;
  name: string;
  email: string;
  phone: string;
}

interface AutomatedSupportReplyRequest {
  threadId: string;
  visitorToken: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}

interface AutomatedSupportReplyResponse {
  reply?: string;
  messageId?: string | null;
  error?: string;
  details?: string;
}

const SUPPORT_SESSION_KEY = "support_chat_session_v3";
const supportChatRpcClient = supabase as unknown as SupportChatRpcClient;

interface SupportChatWidgetProps {
  triggerVariant?: "floating" | "header" | "hero";
  initialOpen?: boolean;
}

function parseSession(raw: string | null): PersistedSupportSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedSupportSession;
    if (!parsed?.threadId || !parsed?.visitorToken) return null;
    if (!parsed?.name || !parsed?.email || !parsed?.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

function playVisitorNotificationTone() {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;
  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.3);
    oscillator.onended = () => { void context.close(); };
  } catch { /* ignora bloqueos de autoplay */ }
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const URL_RE = /https?:\/\/[^\s<>)"]+/g;

/** Normalise literal "\n" sequences into real newlines, then split on URLs so they render as <a> tags. */
function renderMessageBody(raw: string) {
  const text = raw.replace(/\\n/g, "\n");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
        {url}
      </a>,
    );
    lastIndex = URL_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

async function requestAutomatedSupportReply(payload: AutomatedSupportReplyRequest) {
  const response = await fetch("/api/support-chat-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      timestamp: new Date().toISOString(),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as AutomatedSupportReplyResponse;

  if (!response.ok) {
    throw new Error(data.details || data.error || "No pudimos procesar la respuesta automatica.");
  }

  return data;
}

export function SupportChatWidget({ triggerVariant = "floating", initialOpen = false }: SupportChatWidgetProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [open, setOpen] = useState(initialOpen);
  const [initializing, setInitializing] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [automatedReplyPending, setAutomatedReplyPending] = useState(false);

  useEffect(() => {
    if (initialOpen) {
      setOpen(true);
    }
  }, [initialOpen]);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [firstMessage, setFirstMessage] = useState("");
  const [messageText, setMessageText] = useState("");

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>("open");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const notifiedStaffMsgIdsRef = useRef<Set<string>>(new Set());

  const hasActiveThread = Boolean(threadId && visitorToken);

  const saveSession = useCallback((session: PersistedSupportSession) => {
    localStorage.setItem(SUPPORT_SESSION_KEY, JSON.stringify(session));
  }, []);

  const resetSession = useCallback(() => {
    localStorage.removeItem(SUPPORT_SESSION_KEY);
    setThreadId(null);
    setVisitorToken(null);
    setMessages([]);
    setThreadStatus("open");
  }, []);

  const fetchMessages = useCallback(async (targetThreadId?: string | null, targetVisitorToken?: string | null) => {
    const activeThreadId = targetThreadId ?? threadId;
    const activeVisitorToken = targetVisitorToken ?? visitorToken;

    if (!activeThreadId || !activeVisitorToken) return;

    setLoadingMessages(true);
    const { data, error } = await supportChatRpcClient.rpc<SupportMessage[]>("get_support_thread_messages", {
      p_thread_id: activeThreadId,
      p_visitor_token: activeVisitorToken,
    });
    setLoadingMessages(false);

    if (error) {
      toast({
        title: "No pudimos actualizar el chat",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const rows = (Array.isArray(data) ? data : []) as SupportMessage[];
    setMessages(rows);

    if (rows.length > 0) {
      const currentStatus = rows[rows.length - 1].thread_status;
      setThreadStatus(currentStatus === "closed" ? "closed" : "open");
    }
  }, [threadId, toast, visitorToken]);

  useEffect(() => {
    const stored = parseSession(localStorage.getItem(SUPPORT_SESSION_KEY));
    if (stored) {
      setThreadId(stored.threadId);
      setVisitorToken(stored.visitorToken);
      setName(stored.name);
      setEmail(stored.email);
      setPhone(stored.phone);
    }
    setInitializing(false);
  }, []);

  useEffect(() => {
    if (triggerVariant !== "header") return;

    const handleOpenChatEvent = () => {
      setOpen(true);
    };

    window.addEventListener(SUPPORT_CHAT_OPEN_EVENT, handleOpenChatEvent);
    return () => {
      window.removeEventListener(SUPPORT_CHAT_OPEN_EVENT, handleOpenChatEvent);
    };
  }, [triggerVariant]);

  useEffect(() => {
    if (!open || !threadId || !visitorToken) return;

    void fetchMessages();

    const intervalId = window.setInterval(() => {
      void fetchMessages();
    }, 4500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchMessages, open, threadId, visitorToken]);

  useEffect(() => {
    if (!open) return;
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [automatedReplyPending, messages, open]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.sender_type === "staff" && !notifiedStaffMsgIdsRef.current.has(msg.id)) {
        notifiedStaffMsgIdsRef.current.add(msg.id);
        if (!open) playVisitorNotificationTone();
      }
    }
  }, [messages, open]);

  const hasContactData = useMemo(
    () => Boolean(name.trim() && email.trim() && phone.trim()),
    [name, email, phone],
  );

  const canCreateThread = hasContactData && Boolean(firstMessage.trim());

  const handleCreateThread = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreateThread) return;

    const trimmedFirstMessage = firstMessage.trim();

    setSending(true);
    const { data, error } = await supportChatRpcClient.rpc<
      { thread_id: string; visitor_token: string } | { thread_id: string; visitor_token: string }[]
    >("create_support_thread_and_message", {
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_message: trimmedFirstMessage,
      p_visitor_token: visitorToken,
    });
    setSending(false);

    if (error) {
      toast({ title: "No pudimos abrir el chat", description: error.message, variant: "destructive" });
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { thread_id: string; visitor_token: string }
      | undefined;

    if (!row?.thread_id || !row?.visitor_token) {
      toast({
        title: "No pudimos abrir el chat",
        description: "Respuesta invalida del servidor.",
        variant: "destructive",
      });
      return;
    }

    setThreadId(row.thread_id);
    setVisitorToken(row.visitor_token);
    setFirstMessage("");
    setThreadStatus("open");

    saveSession({
      threadId: row.thread_id,
      visitorToken: row.visitor_token,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });

    toast({
      title: "Chat iniciado",
      description: "Estamos procesando tu consulta para responderte aca mismo.",
    });

    await fetchMessages(row.thread_id, row.visitor_token);

    setAutomatedReplyPending(true);
    try {
      await requestAutomatedSupportReply({
        threadId: row.thread_id,
        visitorToken: row.visitor_token,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: trimmedFirstMessage,
      });
    } catch (replyError) {
      toast({
        title: "No pudimos generar la respuesta",
        description: replyError instanceof Error ? replyError.message : "El equipo va a poder responder desde moderacion.",
        variant: "destructive",
      });
    } finally {
      setAutomatedReplyPending(false);
      await fetchMessages(row.thread_id, row.visitor_token);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!threadId || !visitorToken || !messageText.trim() || threadStatus === "closed") return;

    const trimmedMessage = messageText.trim();

    setSending(true);
    const { error } = await supportChatRpcClient.rpc<string>("send_support_message_from_visitor", {
      p_thread_id: threadId,
      p_visitor_token: visitorToken,
      p_message: trimmedMessage,
      p_sender_name: name.trim(),
    });
    setSending(false);

    if (error) {
      toast({ title: "No pudimos enviar el mensaje", description: error.message, variant: "destructive" });
      return;
    }

    setMessageText("");
    await fetchMessages();

    setAutomatedReplyPending(true);
    try {
      await requestAutomatedSupportReply({
        threadId,
        visitorToken,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: trimmedMessage,
      });
    } catch (replyError) {
      toast({
        title: "No pudimos generar la respuesta",
        description: replyError instanceof Error ? replyError.message : "El equipo va a poder responder desde moderacion.",
        variant: "destructive",
      });
    } finally {
      setAutomatedReplyPending(false);
      await fetchMessages();
    }
  };

  const renderBody = () => {
    if (initializing) {
      return <div className="p-4 text-sm text-muted-foreground">Cargando chat...</div>;
    }

    if (!hasActiveThread) {
      return (
        <form onSubmit={handleCreateThread} className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-name">Nombre</Label>
              <Input
                id="support-name"
                placeholder="Tu nombre"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-email">Email</Label>
              <Input
                id="support-email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-phone">Telefono</Label>
              <Input
                id="support-phone"
                type="tel"
                placeholder="+56 9 0000 0000"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-first-message">Mensaje</Label>
              <Textarea
                id="support-first-message"
                value={firstMessage}
                onChange={(event) => setFirstMessage(event.target.value.slice(0, 800))}
                placeholder="Cuentanos en que te ayudamos"
                rows={4}
                required
              />
            </div>
          </div>

          <Button type="submit" className="mt-4 w-full shrink-0" disabled={sending || !canCreateThread}>
            {sending ? "Abriendo chat..." : "Iniciar chat"}
          </Button>
        </form>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{email}</span>
          <div className="flex items-center gap-2">
            <span className={threadStatus === "open" ? "text-emerald-400" : "text-amber-400"}>
              {threadStatus === "open" ? "Abierto" : "Cerrado"}
            </span>
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <XCircle className="h-3.5 w-3.5" /> Nuevo chat
            </button>
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
                className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm ${
                  isVisitor
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto border border-border bg-card text-foreground"
                }`}
              >
                {!isVisitor && (
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {message.sender_name || "Soporte"}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{renderMessageBody(message.body)}</p>
                <p className={`mt-1 text-[10px] ${isVisitor ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            );
          })}
          {automatedReplyPending && (
            <div className="mr-auto max-w-[86%] rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fichas Online
              </p>
              <p className="text-muted-foreground">Soporte esta escribiendo...</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-border p-3">
          {threadStatus === "closed" && (
            <p className="mb-2 text-xs text-amber-300">Esta conversacion fue cerrada por el staff.</p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value.slice(0, 800))}
              placeholder={
                threadStatus === "open"
                  ? automatedReplyPending
                    ? "Esperando respuesta"
                    : "Escribe un mensaje"
                  : "Chat cerrado"
              }
              rows={2}
              disabled={threadStatus === "closed" || sending || automatedReplyPending}
              className="min-h-[44px] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={threadStatus === "closed" || sending || automatedReplyPending || !messageText.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    );
  };

  const isHeaderTrigger = triggerVariant === "header";
  const isHeroTrigger = triggerVariant === "hero";

  return (
    <>
      {isHeroTrigger ? (
        <div className="mx-auto mt-7 w-full max-w-[420px]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir chat de soporte"
            className="group w-full rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(41,30,52,0.92),rgba(28,21,36,0.94))] p-[10px] text-left shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition-all hover:border-primary/40 hover:shadow-[0_18px_40px_rgba(87,52,127,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_4px_16px_hsl(273_66%_56%_/_0.45)]">
                  <MessageCircle className="h-4.5 w-4.5 text-primary-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[1.02rem] font-semibold leading-none text-foreground">
                    ¿Tenés alguna consulta?
                  </p>
                  <p className="mt-1 text-sm leading-none text-muted-foreground">
                    Chateá en tiempo real con el equipo
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-accent/60 bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_hsl(273_66%_56%_/_0.4)] transition-transform group-hover:scale-105">
                Chatear
              </span>
            </div>
          </button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          variant={isHeaderTrigger ? "ghost" : "default"}
          size={isHeaderTrigger ? "icon" : "default"}
          aria-label="Abrir chat"
          className={cn(
            isHeaderTrigger
              ? "h-10 w-10 rounded-full text-foreground/90 transition-colors hover:bg-primary/10 hover:text-foreground"
              : "fixed bottom-24 right-4 z-50 h-14 rounded-full border border-accent/70 bg-gradient-to-r from-primary to-accent px-6 text-base font-semibold text-primary-foreground shadow-[0_14px_40px_hsl(273_66%_56%_/_0.55)] ring-2 ring-primary/35 transition-all hover:scale-[1.03] hover:shadow-[0_18px_48px_hsl(273_66%_56%_/_0.68)] focus-visible:ring-4 focus-visible:ring-accent/40 md:bottom-24 md:right-6",
          )}
        >
          <MessageCircle className={cn("h-5 w-5", !isHeaderTrigger && "mr-2")} />
          {!isHeaderTrigger && "Chat"}
        </Button>
      )}

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen} fixed repositionInputs={false}>
          <DrawerContent className="flex h-[90dvh] max-h-[90dvh] flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <DrawerHeader className="shrink-0">
              <DrawerTitle className="font-display">Chat rapido</DrawerTitle>
              <DrawerDescription>Habla con moderadores y administradores</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex h-[78vh] max-h-[760px] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-4 py-3 text-left">
              <DialogTitle className="font-display">Chat rapido</DialogTitle>
              <DialogDescription>Habla con moderadores y administradores</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1">{renderBody()}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
