import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildUrlEntry, createSupabaseServerClient, toIsoDate, xmlResponse } from "./_seo";

type ArticleSitemapRow = {
  slug: string;
  created_at: string;
  published_at: string | null;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug, created_at, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(0, 49999);

  if (error) {
    return res.status(500).json({ error: "Failed to build article sitemap", details: error.message });
  }

  const rows = (data ?? []) as ArticleSitemapRow[];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows.map((article) =>
      buildUrlEntry(`/noticias/${article.slug}`, {
        lastmod: toIsoDate(article.published_at || article.created_at),
        changefreq: "daily",
        priority: "0.8",
      }),
    ),
    "</urlset>",
  ].join("");

  return xmlResponse(res, body, 900);
}
