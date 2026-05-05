import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SupportChatWidgetComponent = typeof import("@/components/SupportChatWidget").SupportChatWidget;

interface LazySupportChatWidgetProps {
  triggerVariant?: "floating" | "header" | "hero";
}

export function LazySupportChatWidget({ triggerVariant = "floating" }: LazySupportChatWidgetProps) {
  const [Widget, setWidget] = useState<SupportChatWidgetComponent | null>(null);
  const [initialOpen, setInitialOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadWidget = useCallback(async () => {
    if (Widget || loading) return;
    setLoading(true);
    const mod = await import("@/components/SupportChatWidget");
    setWidget(() => mod.SupportChatWidget);
    setLoading(false);
  }, [Widget, loading]);

  const handleOpen = () => {
    setInitialOpen(true);
    void loadWidget();
  };

  useEffect(() => {
    if (Widget && initialOpen) {
      setInitialOpen(false);
    }
  }, [Widget, initialOpen]);

  if (Widget) {
    return <Widget triggerVariant={triggerVariant} initialOpen={initialOpen} />;
  }

  if (triggerVariant === "hero") {
    return (
      <div className="mx-auto mt-7 w-full max-w-[420px]">
        <button
          type="button"
          onClick={handleOpen}
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
    );
  }

  const isHeaderTrigger = triggerVariant === "header";

  return (
    <Button
      type="button"
      onClick={handleOpen}
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
  );
}
