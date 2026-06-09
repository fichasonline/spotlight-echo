import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  BASE_PAGES,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildUrlEntry,
  createSupabaseServerClient,
  escapeXml,
  excerpt,
  toIsoDate,
  toRssDate,
  xmlResponse,
} from "./_seo";

type SeoFeed =
  | "sitemap"
  | "pages"
  | "articles"
  | "events"
  | "salas"
  | "news"
  | "rss";

type ArticleSitemapRow = {
  slug: string;
  created_at: string;
  published_at: string | null;
};

type EventSitemapRow = {
  id: string;
  created_at: string;
  start_date: string;
  end_date: string | null;
};

type NewsSitemapRow = {
  slug: string;
  headline: string;
  published_at: string | null;
};

type RssArticleRow = {
  slug: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  created_at: string;
  published_at: string | null;
};

function getSingleQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getFeed(req: VercelRequest): SeoFeed | null {
  const feed = getSingleQueryValue(req.query.feed);
  if (
    feed === "sitemap" ||
    feed === "pages" ||
    feed === "articles" ||
    feed === "events" ||
    feed === "salas" ||
    feed === "news" ||
    feed === "rss"
  ) {
    return feed;
  }
  return null;
}

function sitemapIndex(res: VercelResponse) {
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

function pagesSitemap(res: VercelResponse) {
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

async function articlesSitemap(res: VercelResponse) {
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

async function eventsSitemap(res: VercelResponse) {
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

async function salasSitemap(res: VercelResponse) {
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

async function newsSitemap(res: VercelResponse) {
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

async function rssFeed(res: VercelResponse) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const feed = getFeed(req);

  switch (feed) {
    case "sitemap":
      return sitemapIndex(res);
    case "pages":
      return pagesSitemap(res);
    case "articles":
      return articlesSitemap(res);
    case "events":
      return eventsSitemap(res);
    case "salas":
      return salasSitemap(res);
    case "news":
      return newsSitemap(res);
    case "rss":
      return rssFeed(res);
    default:
      return res.status(404).json({ error: "Unknown SEO feed" });
  }
}
