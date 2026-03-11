import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, XCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
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

type ThreadStatus = "open" | "closed";

interface SupportMessage {
  id: string;
  sender_type: "visitor" | "staff";
  sender_name: string | null;
  body: string;
  created_at: string;
  thread_status: ThreadStatus;
}

interface PersistedSupportSession {
  threadId: string;
  visitorToken: string;
  name: string;
  email: string;
  phone: string;
}

const SUPPORT_SESSION_KEY = "support_chat_session_v3";

interface SupportChatWidgetProps {
  triggerVariant?: "floating" | "header" | "hero";
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

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportChatWidget({ triggerVariant = "floating" }: SupportChatWidgetProps) {
  const isMobile = useIsMobile();
  const { isStaff } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

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

  const fetchMessages = useCallback(async () => {
    if (!threadId || !visitorToken) return;

    setLoadingMessages(true);
    const { data, error } = await (supabase as any).rpc("get_support_thread_messages", {
      p_thread_id: threadId,
      p_visitor_token: visitorToken,
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
  }, [messages, open]);

  const hasContactData = useMemo(
    () => Boolean(name.trim() && email.trim() && phone.trim()),
    [name, email, phone],
  );

  const canCreateThread = hasContactData && Boolean(firstMessage.trim());

  const handleCreateThread = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreateThread) return;

    setSending(true);
    const { data, error } = await (supabase as any).rpc("create_support_thread_and_message", {
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_message: firstMessage.trim(),
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
      description: "Tu contacto se guardo como lead y un moderador/admin te respondera en breve.",
    });

    await fetchMessages();
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!threadId || !visitorToken || !messageText.trim() || threadStatus === "closed") return;

    setSending(true);
    const { error } = await (supabase as any).rpc("send_support_message_from_visitor", {
      p_thread_id: threadId,
      p_visitor_token: visitorToken,
      p_message: messageText.trim(),
      p_sender_name: name.trim(),
    });
    setSending(false);

    if (error) {
      toast({ title: "No pudimos enviar el mensaje", description: error.message, variant: "destructive" });
      return;
    }

    setMessageText("");
    await fetchMessages();
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
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className={`mt-1 text-[10px] ${isVisitor ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            );
          })}
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
              placeholder={threadStatus === "open" ? "Escribe un mensaje" : "Chat cerrado"}
              rows={2}
              disabled={threadStatus === "closed" || sending}
              className="min-h-[44px] resize-none"
            />
            <Button type="submit" size="icon" disabled={threadStatus === "closed" || sending || !messageText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    );
  };

  if (isStaff) return null;

  const isHeaderTrigger = triggerVariant === "header";
  const isHeroTrigger = triggerVariant === "hero";

  return (
    <>
      {isHeroTrigger ? (
        <div className="mt-8 mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir chat de soporte"
            className="group w-full rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-5 text-left transition-all hover:border-primary/60 hover:from-primary/15 hover:via-accent/15 hover:to-primary/15 hover:shadow-[0_8px_32px_hsl(273_66%_56%_/_0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_4px_16px_hsl(273_66%_56%_/_0.45)]">
                  <MessageCircle className="h-5 w-5 text-primary-foreground" />
                </span>
                <div>
                  <p className="font-display font-semibold text-foreground">¿Tenés alguna consulta?</p>
                  <p className="text-sm text-muted-foreground">Chateá en tiempo real con el equipo</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-accent/60 bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_hsl(273_66%_56%_/_0.4)] transition-transform group-hover:scale-105">
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
