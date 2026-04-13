import { useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface CoinData {
  binanceSymbol: string;
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

const COINS_CONFIG: Omit<CoinData, "price" | "changePercent">[] = [
  { binanceSymbol: "BTCUSDT",  symbol: "BTC",  name: "Bitcoin"  },
  { binanceSymbol: "ETHUSDT",  symbol: "ETH",  name: "Ethereum" },
  { binanceSymbol: "XRPUSDT",  symbol: "XRP",  name: "XRP"      },
  { binanceSymbol: "SOLUSDT",  symbol: "SOL",  name: "Solana"   },
  { binanceSymbol: "TRXUSDT",  symbol: "TRX",  name: "TRON"     },
  { binanceSymbol: "DOGEUSDT", symbol: "DOGE", name: "Dogecoin" },
];

const WS_URL =
  "wss://stream.binance.com:9443/stream?streams=" +
  COINS_CONFIG.map((c) => `${c.binanceSymbol.toLowerCase()}@ticker`).join("/");

function formatPrice(price: number): string {
  if (price >= 1000)
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1)
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// Build initial map with zeros so we render immediately (skeleton-free)
function buildInitialMap(): Map<string, CoinData> {
  const map = new Map<string, CoinData>();
  for (const c of COINS_CONFIG) {
    map.set(c.binanceSymbol, { ...c, price: 0, changePercent: 0 });
  }
  return map;
}

export function CryptoTicker() {
  const [coins, setCoins] = useState<CoinData[]>(() =>
    COINS_CONFIG.map((c) => ({ ...c, price: 0, changePercent: 0 })),
  );
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<Map<string, CoinData>>(buildInitialMap());

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as {
            stream: string;
            data: { s: string; c: string; P: string };
          };
          const { s: sym, c: close, P: changePct } = msg.data;
          const config = COINS_CONFIG.find((c) => c.binanceSymbol === sym);
          if (!config) return;

          mapRef.current.set(sym, {
            ...config,
            price: parseFloat(close),
            changePercent: parseFloat(changePct),
          });

          // Flush current map to state (preserve insertion order from COINS_CONFIG)
          setCoins(COINS_CONFIG.map((c) => mapRef.current.get(c.binanceSymbol)!));
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 3 s
        retryTimeout = setTimeout(connect, 3_000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, []);

  // Duplicate the list for a seamless infinite loop:
  // The track animates translateX(0) → translateX(-50%).
  // At -50% of its own width it looks identical to 0%, so it loops.
  const items = [...coins, ...coins];

  return (
    <div
      className="overflow-hidden bg-black/70 border-t border-primary/20 select-none relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Live indicator */}
      {connected && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 pointer-events-none">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide hidden sm:block">
            Live
          </span>
        </span>
      )}

      {/* Scrolling track */}
      <div
        className="flex w-max animate-ticker pl-10 sm:pl-14"
        style={{ animationPlayState: paused ? "paused" : "running" }}
      >
        {items.map((coin, i) => (
          <div
            key={`${coin.binanceSymbol}-${i}`}
            className="inline-flex items-center gap-2 px-5 py-2 border-r border-white/10 shrink-0"
          >
            <span className="text-xs font-bold text-white/50">
              {coin.name}
              <span className="text-white/30 ml-1">({coin.symbol})</span>
            </span>
            <span className="text-xs font-bold text-white tabular-nums">
              {coin.price > 0 ? `$${formatPrice(coin.price)}` : "—"}
            </span>
            {coin.price > 0 && (
              <span
                className={`text-xs font-semibold flex items-center gap-0.5 tabular-nums ${
                  coin.changePercent >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {coin.changePercent >= 0 ? (
                  <TrendingUp className="h-3 w-3 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 shrink-0" />
                )}
                {Math.abs(coin.changePercent).toFixed(2)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
