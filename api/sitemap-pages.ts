import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BASE_PAGES, buildUrlEntry, toIsoDate, xmlResponse } from "./_seo";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const now = toIsoDate(new Date().toISOString());

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...BASE_PAGES.map((page) =>
      buildUrlEntry(page.path, {
        lastmod: now,
        changefreq: page.changefreq,
        priority: page.priority,
      }),
    ),
    "</urlset>",
  ].join("");

  return xmlResponse(res, body, 3600);
}
