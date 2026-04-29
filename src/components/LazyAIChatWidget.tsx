import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type AIChatWidgetComponent = typeof import("@/components/AIChatWidget").AIChatWidget;

interface LazyAIChatWidgetProps {
  autoOpen?: boolean;
}

export function LazyAIChatWidget({ autoOpen = false }: LazyAIChatWidgetProps) {
  const [Widget, setWidget] = useState<AIChatWidgetComponent | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWidget = useCallback(async () => {
    if (Widget || loading) return;
    setLoading(true);
    const mod = await import("@/components/AIChatWidget");
    setWidget(() => mod.AIChatWidget);
    setLoading(false);
  }, [Widget, loading]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWidget(), autoOpen ? 800 : 2500);
    return () => window.clearTimeout(timeout);
  }, [autoOpen, loadWidget]);

  if (Widget) return <Widget autoOpen={autoOpen} />;

  return (
    <button
      type="button"
      onClick={() => void loadWidget()}
      aria-label="Abrir chat con IA"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
        "bg-gradient-to-br from-primary to-accent",
        "shadow-[0_8px_32px_hsl(273_66%_56%_/_0.55)] ring-2 ring-primary/40",
        "transition-all hover:scale-105 hover:shadow-[0_12px_40px_hsl(273_66%_56%_/_0.7)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50",
      )}
    >
      <MessageCircle className="h-6 w-6 text-primary-foreground" />
    </button>
  );
}
