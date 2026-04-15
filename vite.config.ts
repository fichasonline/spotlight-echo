import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function getSingleQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isPrivateOrLocalHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "0.0.0.0" || lower === "::1") return true;
  if (lower.endsWith(".local") || lower.endsWith(".internal")) return true;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    if (/^10\./.test(lower)) return true;
    if (/^127\./.test(lower)) return true;
    if (/^169\.254\./.test(lower)) return true;
    if (/^192\.168\./.test(lower)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  }

  return false;
}

function pdfProxyDevPlugin(): Plugin {
  return {
    name: "pdf-proxy-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/pdf-proxy")) return next();

        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const parsed = new URL(req.url, "http://localhost");
        const rawUrl = getSingleQueryValue(parsed.searchParams.getAll("url"));

        if (!rawUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Missing url query param" }));
          return;
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(rawUrl);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Invalid URL" }));
          return;
        }

        if (!["http:", "https:"].includes(targetUrl.protocol) || isPrivateOrLocalHost(targetUrl.hostname)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "URL host is not allowed" }));
          return;
        }

        try {
          const upstream = await fetch(targetUrl.toString(), {
            redirect: "follow",
            headers: {
              Accept: "application/pdf,*/*;q=0.8",
              "User-Agent": "Mozilla/5.0 (compatible; FichasPDFProxyDev/1.0)",
            },
          });

          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Failed to fetch upstream PDF", status: upstream.status }));
            return;
          }

          const contentType = upstream.headers.get("content-type") || "";
          const isPdfLike =
            contentType.toLowerCase().includes("application/pdf") ||
            contentType.toLowerCase().includes("octet-stream") ||
            /\.pdf(?:$|[?#])/i.test(targetUrl.toString());

          if (!isPdfLike) {
            res.statusCode = 415;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Upstream resource is not a PDF", contentType }));
            return;
          }

          const data = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", "inline");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.end(data);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: "Failed to proxy PDF",
              details: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), pdfProxyDevPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/@supabase")) return "supabase-vendor";
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion")) return "motion-vendor";
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "charts-vendor";
          if (id.includes("node_modules/date-fns")) return "date-vendor";
          return undefined;
        },
      },
    },
  },
}));
