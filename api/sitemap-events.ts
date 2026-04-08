import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildUrlEntry, createSupabaseServerClient, toIsoDate, xmlResponse } from "./_seo";

type EventSitemapRow = {
  id: string;
  created_at: string;
  start_date: string;
  end_date: string | null;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, created_at, start_date, end_date")
    .eq("status", "published")
    .order("start_date", { ascending: true })
    .range(0, 49999);

  if (error) {
    return res.status(500).json({ error: "Failed to build event sitemap", details: error.message });
  }

  const rows = (data ?? []) as EventSitemapRow[];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows.map((event) =>
      buildUrlEntry(`/eventos/${event.id}`, {
        lastmod: toIsoDate(event.end_date || event.start_date || event.created_at),
        changefreq: "daily",
        priority: "0.7",
      }),
    ),
    "</urlset>",
  ].join("");

  return xmlResponse(res, body, 900);
}
