import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SITE_NAME, SITE_URL, absoluteUrl, createSupabaseServerClient, excerpt, escapeXml } from "./_seo";

const BOT_UA_RE =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|googlebot|bingbot|applebot|discordbot|vkshare|pinterest|tumblr|redditbot|embedly|quora|outbrain|w3c_validator|skypeuripreview|nuzzel/i;

function isBot(req: VercelRequest) {
  const ua = req.headers["user-agent"] || "";
  return BOT_UA_RE.test(ua);
}

function htmlShell(opts: {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  imageAlt: string;
  ogType: string;
  publishedTime?: string;
  structuredData?: object;
}) {
  const esc = escapeXml;
  const sd = opts.structuredData ? JSON.stringify(opts.structuredData) : null;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}" />
<link rel="canonical" href="${esc(opts.canonicalUrl)}" />
<meta property="og:type" content="${esc(opts.ogType)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:locale" content="es_UY" />
<meta property="og:title" content="${esc(opts.title)}" />
<meta property="og:description" content="${esc(opts.description)}" />
<meta property="og:url" content="${esc(opts.canonicalUrl)}" />
<meta property="og:image" content="${esc(opts.imageUrl)}" />
<meta property="og:image:alt" content="${esc(opts.imageAlt)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
${opts.publishedTime ? `<meta property="article:published_time" content="${esc(opts.publishedTime)}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(opts.title)}" />
<meta name="twitter:description" content="${esc(opts.description)}" />
<meta name="twitter:image" content="${esc(opts.imageUrl)}" />
<meta name="twitter:image:alt" content="${esc(opts.imageAlt)}" />
${sd ? `<script type="application/ld+json">${sd}</script>` : ""}
<meta http-equiv="refresh" content="0;url=${esc(opts.canonicalUrl)}" />
</head>
<body>
<h1>${esc(opts.title)}</h1>
<p>${esc(opts.description)}</p>
<a href="${esc(opts.canonicalUrl)}">Ver en ${esc(SITE_NAME)}</a>
</body>
</html>`;
}

async function renderArticle(slug: string, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("articles")
    .select("headline, summary, body_markdown, published_at, created_at, image_url, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return res.status(404).send("Not found");
  }

  const canonicalUrl = absoluteUrl(`/noticias/${data.slug}`);
  const description = excerpt(data.summary || data.body_markdown, 160) || `Lee esta noticia en ${SITE_NAME}.`;
  const imageUrl = data.image_url || absoluteUrl("/og-cover-1200x630.png?v=2");
  const publishedTime = data.published_at || data.created_at;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: data.headline,
    description,
    url: canonicalUrl,
    datePublished: publishedTime,
    dateModified: publishedTime,
    image: data.image_url ? [data.image_url] : undefined,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  const html = htmlShell({
    title: `${data.headline} | ${SITE_NAME}`,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: data.headline,
    ogType: "article",
    publishedTime,
    structuredData,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(html);
}

async function renderEvento(id: string, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, description, details, start_date, end_date, city, country, venue, hero_image_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return res.status(404).send("Not found");
  }

  const canonicalUrl = absoluteUrl(`/eventos/${data.id}`);
  const locationParts = [data.city, data.country].filter(Boolean).join(", ");
  const description =
    excerpt(data.description || data.details, 160) ||
    `${data.name}${locationParts ? ` en ${locationParts}` : ""}.`;
  const imageUrl = data.hero_image_url || absoluteUrl("/og-cover-1200x630.png?v=2");
  const locationName = [data.venue, data.city, data.country].filter(Boolean).join(", ");

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: data.name,
    description,
    url: canonicalUrl,
    startDate: data.start_date,
    endDate: data.end_date || data.start_date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: data.hero_image_url ? [data.hero_image_url] : undefined,
    organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    location: locationName
      ? {
          "@type": "Place",
          name: data.venue || locationName,
          address: {
            "@type": "PostalAddress",
            addressLocality: data.city || undefined,
            addressCountry: data.country || undefined,
          },
        }
      : undefined,
  };

  const html = htmlShell({
    title: `${data.name} | ${SITE_NAME}`,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: data.name,
    ogType: "article",
    publishedTime: data.start_date,
    structuredData,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(html);
}

async function renderSala(slug: string, res: VercelResponse) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salas")
    .select("slug, name, short_description, body_markdown, featured_image_url, seo_title, seo_description, rating_overall, website_url, updated_at, faq")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!data) return res.status(404).send("Not found");

  const canonicalUrl = absoluteUrl(`/salas/${data.slug}`);
  const title = data.seo_title || `${data.name} Uruguay — Review, deals y bonos | ${SITE_NAME}`;
  const description = excerpt(data.seo_description || data.short_description || data.body_markdown, 160) ||
    `Todo sobre ${data.name} para jugadores uruguayos: bonos, rakeback, torneos y más.`;
  const imageUrl = data.featured_image_url || absoluteUrl("/og-cover-1200x630.png?v=2");

  const faq = Array.isArray(data.faq) ? data.faq as { question: string; answer: string }[] : [];
  const faqStructuredData = faq.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : undefined;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Review",
      name: title,
      description,
      url: canonicalUrl,
      itemReviewed: {
        "@type": "SoftwareApplication",
        name: data.name,
        applicationCategory: "GameApplication",
        url: data.website_url || undefined,
      },
      reviewRating: data.rating_overall
        ? { "@type": "Rating", ratingValue: data.rating_overall, bestRating: 10, worstRating: 0 }
        : undefined,
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    },
    ...(faqStructuredData ? [faqStructuredData] : []),
  ];

  const html = htmlShell({
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: data.name,
    ogType: "article",
    publishedTime: data.updated_at,
    structuredData,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return res.status(200).send(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isBot(req)) {
    res.setHeader("Location", "/");
    return res.status(302).send("");
  }

  const url = req.url || "/";
  const articleMatch = url.match(/^\/noticias\/([^/?#]+)/);
  const eventoMatch = url.match(/^\/eventos\/([^/?#]+)/);
  const salaMatch = url.match(/^\/salas\/([^/?#]+)/);

  try {
    if (articleMatch) return await renderArticle(articleMatch[1], res);
    if (eventoMatch) return await renderEvento(eventoMatch[1], res);
    if (salaMatch) return await renderSala(salaMatch[1], res);
    return res.status(400).send("Unknown route");
  } catch (err) {
    console.error("[og-render] error:", err);
    return res.status(500).send("Internal error");
  }
}
