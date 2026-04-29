import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildUrlEntry, createSupabaseServerClient, toIsoDate, xmlResponse } from "./_seo";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data: salas } = await supabase
    .from("salas")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  const entries = (salas || []).map((s) =>
    buildUrlEntry(`/salas/${s.slug}`, {
      lastmod: toIsoDate(s.updated_at),
      changefreq: "weekly",
      priority: "0.8",
    }),
  );

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("");

  return xmlResponse(res, body, 3600);
}
