import type { VercelRequest, VercelResponse } from "@vercel/node";
import { absoluteUrl, escapeXml, toIsoDate, xmlResponse } from "./_seo";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const now = toIsoDate(new Date().toISOString());
  const sitemapPaths = [
    "/sitemaps/pages.xml",
    "/sitemaps/articles.xml",
    "/sitemaps/events.xml",
    "/sitemaps/salas.xml",
    "/news-sitemap.xml",
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapPaths.map((path) =>
      [
        "<sitemap>",
        `<loc>${escapeXml(absoluteUrl(path))}</loc>`,
        now ? `<lastmod>${escapeXml(now)}</lastmod>` : "",
        "</sitemap>",
      ]
        .filter(Boolean)
        .join(""),
    ),
    "</sitemapindex>",
  ].join("");

  return xmlResponse(res, body, 900);
}
