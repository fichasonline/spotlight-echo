import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  createSupabaseServerClient,
  escapeXml,
  excerpt,
  toRssDate,
} from "./_seo";

type RssArticleRow = {
  slug: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  created_at: string;
  published_at: string | null;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug, headline, summary, body_markdown, created_at, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(0, 99);

  if (error) {
    return res.status(500).json({ error: "Failed to build RSS feed", details: error.message });
  }

  const rows = (data ?? []) as RssArticleRow[];
  const lastBuildDate = toRssDate(rows[0]?.published_at || rows[0]?.created_at || new Date().toISOString());

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `<title>${escapeXml(SITE_NAME)}</title>`,
    `<link>${escapeXml(SITE_URL)}</link>`,
    "<language>es</language>",
    "<generator>Fichas Online</generator>",
    `<description>${escapeXml("Noticias, calendario de eventos y comunidad de Fichas Online.")}</description>`,
    lastBuildDate ? `<lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>` : "",
    ...rows.map((article) => {
      const url = absoluteUrl(`/noticias/${article.slug}`);
      const description = article.summary || excerpt(article.body_markdown, 280);
      const publishedAt = toRssDate(article.published_at || article.created_at);

      return [
        "<item>",
        `<title>${escapeXml(article.headline)}</title>`,
        `<link>${escapeXml(url)}</link>`,
        `<guid>${escapeXml(url)}</guid>`,
        description ? `<description>${escapeXml(description)}</description>` : "",
        publishedAt ? `<pubDate>${escapeXml(publishedAt)}</pubDate>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    }),
    "</channel>",
    "</rss>",
  ].join("");

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return res.status(200).send(body);
}
