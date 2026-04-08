import { createClient } from "@supabase/supabase-js";
import type { VercelResponse } from "@vercel/node";

export const SITE_NAME = "Fichas Online";
export const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://www.fichasonline.uy").replace(/\/+$/, "");

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials for SEO endpoints.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function absoluteUrl(pathname: string) {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

export function toIsoDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function toRssDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toUTCString();
}

export function escapeXml(value?: string | null) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function stripMarkdown(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(value?: string | null, maxLength = 220) {
  const normalized = stripMarkdown(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function xmlResponse(res: VercelResponse, body: string, maxAgeSeconds = 900) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`);
  return res.status(200).send(body);
}

export const BASE_PAGES = [
  {
    path: "/",
    changefreq: "hourly",
    priority: "1.0",
  },
  {
    path: "/noticias",
    changefreq: "hourly",
    priority: "0.9",
  },
  {
    path: "/calendario",
    changefreq: "hourly",
    priority: "0.9",
  },
];

export function buildUrlEntry(
  path: string,
  options: { lastmod?: string; changefreq?: string; priority?: string } = {},
) {
  return [
    "<url>",
    `<loc>${escapeXml(absoluteUrl(path))}</loc>`,
    options.lastmod ? `<lastmod>${escapeXml(options.lastmod)}</lastmod>` : "",
    options.changefreq ? `<changefreq>${escapeXml(options.changefreq)}</changefreq>` : "",
    options.priority ? `<priority>${escapeXml(options.priority)}</priority>` : "",
    "</url>",
  ]
    .filter(Boolean)
    .join("");
}
