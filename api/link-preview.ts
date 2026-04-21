import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_HTML_CHARS = 220_000;

interface LinkPreviewPayload {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

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

function buildHtmlPreview(html: string, finalUrl: string): LinkPreviewPayload {
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

  const image = absolutizeUrl(imageCandidate, finalUrl);
  const fallbackTitle = new URL(finalUrl).hostname.replace(/^www\./i, "");

  return {
    url: finalUrl,
    finalUrl,
    title: title ?? fallbackTitle,
    description,
    image,
    siteName,
  };
}

function buildImagePreview(finalUrl: string): LinkPreviewPayload {
  const hostname = new URL(finalUrl).hostname.replace(/^www\./i, "");
  return {
    url: finalUrl,
    finalUrl,
    title: hostname,
    description: null,
    image: finalUrl,
    siteName: hostname,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawUrl = getSingleQueryValue(req.query.url);
  if (!rawUrl || typeof rawUrl !== "string") {
    return res.status(400).json({ error: "Missing url query param" });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: "Only http/https URLs are allowed" });
  }

  if (isPrivateOrLocalHost(targetUrl.hostname)) {
    return res.status(400).json({ error: "URL host is not allowed" });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.7",
        "User-Agent": "Mozilla/5.0 (compatible; FichasLinkPreview/1.0)",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Failed to fetch URL metadata",
        status: upstream.status,
      });
    }

    const finalUrl = upstream.url || targetUrl.toString();
    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();

    let payload: LinkPreviewPayload;
    if (contentType.startsWith("image/")) {
      payload = buildImagePreview(finalUrl);
    } else {
      const html = (await upstream.text()).slice(0, MAX_HTML_CHARS);
      payload = buildHtmlPreview(html, finalUrl);
    }

    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to build link preview",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
