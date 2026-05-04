import type { VercelRequest, VercelResponse } from "@vercel/node";

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
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.7",
        "User-Agent": "Mozilla/5.0 (compatible; FichasImageProxy/1.0)",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Failed to fetch upstream image",
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return res.status(415).json({
        error: "Upstream resource is not an image",
        contentType,
      });
    }

    const contentLength = Number(upstream.headers.get("content-length") || "0");
    if (contentLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image is too large" });
    }

    const data = Buffer.from(await upstream.arrayBuffer());
    if (data.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image is too large" });
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).send(data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to proxy image",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
