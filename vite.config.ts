import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

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

function escapeRegExp(raw: string) {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(raw: string) {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function normalizeMetaText(raw: string | null | undefined) {
  if (!raw) return null;
  const decoded = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  return decoded || null;
}

function extractMetaContentByAttr(html: string, attrName: string, attrValue: string) {
  const escaped = escapeRegExp(attrValue);
  const patterns = [
    new RegExp(
      `<meta[^>]*\\b${attrName}\\s*=\\s*["']${escaped}["'][^>]*\\bcontent\\s*=\\s*["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*\\bcontent\\s*=\\s*["']([^"']+)["'][^>]*\\b${attrName}\\s*=\\s*["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = normalizeMetaText(match?.[1]);
    if (candidate) return candidate;
  }

  return null;
}

function extractTitleFromHtml(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeMetaText(match?.[1]);
}

function absolutizeUrl(candidate: string | null, baseUrl: string) {
  if (!candidate) return null;
  try {
    const absolute = new URL(candidate, baseUrl);
    if (!["http:", "https:"].includes(absolute.protocol)) return null;
    return absolute.toString();
  } catch {
    return null;
  }
}

function buildHtmlPreview(html: string, finalUrl: string) {
  const title =
    extractMetaContentByAttr(html, "property", "og:title") ??
    extractMetaContentByAttr(html, "name", "twitter:title") ??
    extractTitleFromHtml(html);

  const description =
    extractMetaContentByAttr(html, "property", "og:description") ??
    extractMetaContentByAttr(html, "name", "twitter:description") ??
    extractMetaContentByAttr(html, "name", "description");

  const siteName =
    extractMetaContentByAttr(html, "property", "og:site_name") ??
    extractMetaContentByAttr(html, "name", "application-name");

  const imageCandidate =
    extractMetaContentByAttr(html, "property", "og:image") ??
    extractMetaContentByAttr(html, "name", "twitter:image") ??
    extractMetaContentByAttr(html, "itemprop", "image");

  const hostname = new URL(finalUrl).hostname.replace(/^www\./i, "");

  return {
    url: finalUrl,
    finalUrl,
    title: title ?? hostname,
    description,
    image: absolutizeUrl(imageCandidate, finalUrl),
    siteName,
  };
}

function linkPreviewDevPlugin(): Plugin {
  return {
    name: "link-preview-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/link-preview")) return next();

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
              Accept: "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.7",
              "User-Agent": "Mozilla/5.0 (compatible; FichasLinkPreviewDev/1.0)",
            },
          });

          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Failed to fetch URL metadata", status: upstream.status }));
            return;
          }

          const finalUrl = upstream.url || targetUrl.toString();
          const contentType = (upstream.headers.get("content-type") || "").toLowerCase();

          let payload;
          if (contentType.startsWith("image/")) {
            const hostname = new URL(finalUrl).hostname.replace(/^www\./i, "");
            payload = {
              url: finalUrl,
              finalUrl,
              title: hostname,
              description: null,
              image: finalUrl,
              siteName: hostname,
            };
          } else {
            const html = (await upstream.text()).slice(0, 220_000);
            payload = buildHtmlPreview(html, finalUrl);
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=900");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: "Failed to build link preview",
              details: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
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

function imageProxyDevPlugin(): Plugin {
  return {
    name: "image-proxy-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/image-proxy")) return next();

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
              Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.7",
              "User-Agent": "Mozilla/5.0 (compatible; FichasImageProxyDev/1.0)",
            },
          });

          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Failed to fetch upstream image", status: upstream.status }));
            return;
          }

          const contentType = upstream.headers.get("content-type") || "";
          if (!contentType.toLowerCase().startsWith("image/")) {
            res.statusCode = 415;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Upstream resource is not an image", contentType }));
            return;
          }

          const contentLength = Number(upstream.headers.get("content-length") || "0");
          if (contentLength > MAX_IMAGE_BYTES) {
            res.statusCode = 413;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Image is too large" }));
            return;
          }

          const data = Buffer.from(await upstream.arrayBuffer());
          if (data.byteLength > MAX_IMAGE_BYTES) {
            res.statusCode = 413;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Image is too large" }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=900");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(data);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: "Failed to proxy image",
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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    pdfProxyDevPlugin(),
    imageProxyDevPlugin(),
    linkPreviewDevPlugin(),
  ].filter(Boolean),
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
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
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
