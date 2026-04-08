import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_NAME,
  absoluteUrl,
  createSupabaseServerClient,
  escapeXml,
  toIsoDate,
  xmlResponse,
} from "./_seo";

type NewsSitemapRow = {
  slug: string;
  headline: string;
  published_at: string | null;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug, headline, published_at")
    .eq("status", "published")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .range(0, 999);

  if (error) {
    return res.status(500).json({ error: "Failed to build news sitemap", details: error.message });
  }

  const rows = (data ?? []) as NewsSitemapRow[];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...rows.map((article) => {
      const publicationDate = toIsoDate(article.published_at);
      if (!publicationDate) return "";

      return [
        "<url>",
        `<loc>${escapeXml(absoluteUrl(`/noticias/${article.slug}`))}</loc>`,
        "<news:news>",
        "<news:publication>",
        `<news:name>${escapeXml(SITE_NAME)}</news:name>`,
        "<news:language>es</news:language>",
        "</news:publication>",
        `<news:publication_date>${escapeXml(publicationDate)}</news:publication_date>`,
        `<news:title>${escapeXml(article.headline)}</news:title>`,
        "</news:news>",
        "</url>",
      ].join("");
    }),
    "</urlset>",
  ].join("");

  return xmlResponse(res, body, 900);
}
