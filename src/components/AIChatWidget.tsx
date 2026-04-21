import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const AI_SESSION_KEY = "ai_chat_session_v1";

interface AISession {
  threadId: string;
  visitorToken: string;
}

interface AIMessage {
  id: string;
  sender_type: "visitor" | "staff";
  body: string;
  created_at: string;
}

const WELCOME_MESSAGE: AIMessage = {
  id: "welcome",
  sender_type: "staff",
  body: "Hola, soy Junior, el asistente de Fichas.uy 👋 ¿En qué puedo ayudarte?",
  created_at: new Date().toISOString(),
};

function parseSession(raw: string | null): AISession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AISession;
    if (!parsed?.threadId || !parsed?.visitorToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const URL_RE = /https?:\/\/[^\s<>)"]+/g;

function renderMessageBody(raw: string) {
  const text = raw.replace(/\\n/g, "\n");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const url = match[0];
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
        {url}
      </a>,
    );
    lastIndex = URL_RE.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

interface AIChatWidgetProps {
  autoOpen?: boolean;
}

export function AIChatWidget({ autoOpen = false }: AIChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([WELCOME_MESSAGE]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load existing session from localStorage
  useEffect(() => {
    const stored = parseSession(localStorage.getItem(AI_SESSION_KEY));
    if (stored) {
      setThreadId(stored.threadId);
      setVisitorToken(stored.visitorToken);
    }
  }, []);

  // Auto-open once after delay (only if no prior session)
  useEffect(() => {
    if (!autoOpen) return;
    const stored = parseSession(localStorage.getItem(AI_SESSION_KEY));
    if (stored) return;
    const timeout = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(timeout);
  }, [autoOpen]);

  // Scroll to bottom when messages or typing indicator change and panel is open
  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending]);

  const fetchMessages = useCallback(async (tId: string, vToken: string) => {
    const { data } = await (supabase as any).rpc("get_support_thread_messages", {
      p_thread_id: tId,
      p_visitor_token: vToken,
    });
    if (!Array.isArray(data)) return;
    setMessages([WELCOME_MESSAGE, ...(data as AIMessage[])]);
  }, []);

  // Poll for new messages while panel is open and thread exists
  useEffect(() => {
    if (!open || !threadId || !visitorToken) return;
    void fetchMessages(threadId, visitorToken);
    const interval = window.setInterval(() => void fetchMessages(threadId, visitorToken), 4500);
    return () => window.clearInterval(interval);
  }, [open, threadId, visitorToken, fetchMessages]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = messageText.trim();
      if (!text || sending) return;

      setSending(true);
      setMessageText("");

      // Optimistic message
      setMessages((prev) => [
        ...prev,
        { id: `opt-${Date.now()}`, sender_type: "visitor", body: text, created_at: new Date().toISOString() },
      ]);

      if (!threadId || !visitorToken) {
        const { data, error } = await (supabase as any).rpc("create_ai_chat_thread", {
          p_message: text,
        });

        if (!error && data) {
          const row = (Array.isArray(data) ? data[0] : data) as { thread_id: string; visitor_token: string };
          setThreadId(row.thread_id);
          setVisitorToken(row.visitor_token);
          localStorage.setItem(
            AI_SESSION_KEY,
            JSON.stringify({ threadId: row.thread_id, visitorToken: row.visitor_token }),
          );
          await fetchMessages(row.thread_id, row.visitor_token);
        }
      } else {
        await (supabase as any).rpc("send_support_message_from_visitor", {
          p_thread_id: threadId,
          p_visitor_token: visitorToken,
          p_message: text,
          p_sender_name: "Visitante",
        });
        await fetchMessages(threadId, visitorToken);
      }

      setSending(false);
    },
    [fetchMessages, messageText, sending, threadId, visitorToken],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(e as unknown as React.FormEvent);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Cerrar chat con IA" : "Abrir chat con IA"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-accent",
          "shadow-[0_8px_32px_hsl(273_66%_56%_/_0.55)] ring-2 ring-primary/40",
          "transition-all hover:scale-105 hover:shadow-[0_12px_40px_hsl(273_66%_56%_/_0.7)]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50",
        )}
      >
        {open ? (
          <X className="h-6 w-6 text-primary-foreground" />
        ) : (
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden rounded-2xl",
            "border border-border bg-background shadow-2xl",
            "bottom-24 right-6",
            "w-[calc(100vw-48px)] max-w-[380px]",
            "h-[500px] max-h-[calc(100dvh-120px)]",
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-md">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </span>
            <div>
              <p className="font-semibold leading-none text-foreground">Junior</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Responde en segundos</p>
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg) => {
              const isVisitor = msg.sender_type === "visitor";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    isVisitor
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto border border-border bg-card text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{renderMessageBody(msg.body)}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      isVisitor ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              );
            })}
            {sending && (
              <div
                role="status"
                aria-live="polite"
                className="mr-auto flex max-w-[85%] items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
              >
                <span>Junior esta escribiendo...</span>
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 140, 280].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/80 animate-bounce"
                      style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
                    />
                  ))}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value.slice(0, 800))}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu consulta…"
                rows={2}
                disabled={sending}
                className="min-h-[44px] resize-none"
              />
              <Button type="submit" size="icon" disabled={sending || !messageText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Impulsado por IA · puede cometer errores
            </p>
          </form>
        </div>
      )}
    </>
  );
}
