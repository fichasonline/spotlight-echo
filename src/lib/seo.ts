const SITE_NAME = "Fichas Online";
const SITE_URL = "https://www.fichasonline.uy";
const DEFAULT_DESCRIPTION = "Noticias, calendario de eventos y comunidad de Fichas Online.";
const DEFAULT_SHARE_IMAGE_PATH = "/og-cover-1200x630.png?v=2";
const DEFAULT_SHARE_IMAGE_ALT = "Fichas Online";
const DEFAULT_SHARE_IMAGE_TYPE = "image/png";
const DEFAULT_SHARE_IMAGE_WIDTH = "1200";
const DEFAULT_SHARE_IMAGE_HEIGHT = "630";
const INDEX = "index, follow, max-image-preview:large";
const NOINDEX = "noindex, nofollow";

type StructuredDataNode = Record<string, unknown>;

export type SeoConfig = {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  imagePath?: string | null;
  imageAlt?: string;
  ogType?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  structuredData?: StructuredDataNode | StructuredDataNode[];
};

function sanitizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getSiteUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return sanitizeBaseUrl(window.location.origin);
  }
  return SITE_URL;
}

export function buildAbsoluteUrl(path: string, baseUrl = getSiteUrl()) {
  return new URL(path, `${sanitizeBaseUrl(baseUrl)}/`).toString();
}

export function resolveImageUrl(imagePath?: string | null, baseUrl = getSiteUrl()) {
  return buildAbsoluteUrl(imagePath || DEFAULT_SHARE_IMAGE_PATH, baseUrl);
}

function removeNode(selector: string) {
  const node = document.head.querySelector(selector);
  if (node) {
    node.remove();
  }
}

function upsertMetaByName(name: string, content?: string | null) {
  const selector = `meta[name="${name}"]`;
  if (!content) {
    removeNode(selector);
    return;
  }

  let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content?: string | null) {
  const selector = `meta[property="${property}"]`;
  if (!content) {
    removeNode(selector);
    return;
  }

  let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertCanonical(url: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function upsertAlternateFeed(siteUrl: string) {
  let link = document.head.querySelector('link[rel="alternate"][type="application/rss+xml"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "alternate");
    link.setAttribute("type", "application/rss+xml");
    document.head.appendChild(link);
  }
  link.setAttribute("title", `${SITE_NAME} RSS`);
  link.setAttribute("href", buildAbsoluteUrl("/rss.xml", siteUrl));
}

function upsertStructuredData(id: string, payload?: StructuredDataNode | StructuredDataNode[]) {
  const selector = `script#${id}`;
  if (!payload) {
    removeNode(selector);
    return;
  }

  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function buildGlobalStructuredData(siteUrl: string) {
  return {
    website: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: SITE_NAME,
      url: siteUrl,
      description: DEFAULT_DESCRIPTION,
      inLanguage: "es",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    organization: {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: SITE_NAME,
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: buildAbsoluteUrl("/logo_fichas.png", siteUrl),
      },
    },
  };
}

function buildDefaultPageStructuredData(title: string, description: string, canonicalUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: "es",
    isPartOf: { "@id": `${getSiteUrl()}/#website` },
  };
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

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function applySeo(config: SeoConfig) {
  const siteUrl = getSiteUrl();
  const path = config.path || (typeof window !== "undefined" ? window.location.pathname : "/");
  const canonicalUrl = buildAbsoluteUrl(path, siteUrl);
  const imageUrl = resolveImageUrl(config.imagePath, siteUrl);
  const globalStructuredData = buildGlobalStructuredData(siteUrl);

  document.documentElement.setAttribute("lang", "es");
  document.title = config.title;

  upsertMetaByName("description", config.description);
  upsertMetaByName("robots", config.robots ?? INDEX);
  upsertMetaByName("googlebot", config.robots ?? INDEX);
  upsertMetaByName("author", SITE_NAME);
  upsertMetaByName("twitter:card", "summary_large_image");
  upsertMetaByName("twitter:title", config.title);
  upsertMetaByName("twitter:description", config.description);
  upsertMetaByName("twitter:image", imageUrl);
  upsertMetaByName("twitter:image:alt", config.imageAlt ?? DEFAULT_SHARE_IMAGE_ALT);

  upsertMetaByProperty("og:type", config.ogType ?? "website");
  upsertMetaByProperty("og:site_name", SITE_NAME);
  upsertMetaByProperty("og:locale", "es_UY");
  upsertMetaByProperty("og:title", config.title);
  upsertMetaByProperty("og:description", config.description);
  upsertMetaByProperty("og:url", canonicalUrl);
  upsertMetaByProperty("og:image", imageUrl);
  upsertMetaByProperty("og:image:alt", config.imageAlt ?? DEFAULT_SHARE_IMAGE_ALT);
  upsertMetaByProperty("og:image:type", DEFAULT_SHARE_IMAGE_TYPE);
  upsertMetaByProperty("og:image:width", DEFAULT_SHARE_IMAGE_WIDTH);
  upsertMetaByProperty("og:image:height", DEFAULT_SHARE_IMAGE_HEIGHT);
  upsertMetaByProperty("article:published_time", config.publishedTime ?? undefined);
  upsertMetaByProperty("article:modified_time", config.modifiedTime ?? undefined);

  upsertCanonical(canonicalUrl);
  upsertAlternateFeed(siteUrl);
  upsertStructuredData("website-structured-data", globalStructuredData.website);
  upsertStructuredData("organization-structured-data", globalStructuredData.organization);
  upsertStructuredData(
    "page-structured-data",
    config.structuredData ?? buildDefaultPageStructuredData(config.title, config.description, canonicalUrl),
  );
}

export function getDefaultSeoConfig(pathname: string): SeoConfig {
  if (pathname === "/") {
    return {
      title: `${SITE_NAME} | Noticias, calendario y comunidad`,
      description: DEFAULT_DESCRIPTION,
      path: pathname,
      robots: INDEX,
    };
  }

  if (pathname === "/calendario") {
    return {
      title: `Calendario de Eventos | ${SITE_NAME}`,
      description:
        "Explora el calendario de eventos de Fichas Online con fechas, ciudades y venues actualizados.",
      path: pathname,
      robots: INDEX,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Calendario de Eventos | ${SITE_NAME}`,
        description:
          "Calendario editorial de eventos, torneos y fechas importantes publicadas en Fichas Online.",
        url: buildAbsoluteUrl(pathname, SITE_URL),
        inLanguage: "es",
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
    };
  }

  if (pathname === "/noticias") {
    return {
      title: `Noticias | ${SITE_NAME}`,
      description:
        "Lee noticias, novedades y coberturas publicadas por Fichas Online para seguir la actualidad del sector.",
      path: pathname,
      robots: INDEX,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Noticias | ${SITE_NAME}`,
        description:
          "Archivo de noticias y artículos publicados por Fichas Online.",
        url: buildAbsoluteUrl(pathname, SITE_URL),
        inLanguage: "es",
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
    };
  }

  if (pathname.startsWith("/noticias/")) {
    return {
      title: `Artículo | ${SITE_NAME}`,
      description: "Lee este artículo publicado en Fichas Online.",
      path: pathname,
      robots: INDEX,
      ogType: "article",
    };
  }

  if (pathname.startsWith("/eventos/")) {
    return {
      title: `Evento | ${SITE_NAME}`,
      description: "Consulta la ficha y los detalles de este evento publicado en Fichas Online.",
      path: pathname,
      robots: INDEX,
    };
  }

  if (pathname === "/feed") {
    return {
      title: `Comunidad | ${SITE_NAME}`,
      description: "Participa en el feed de comunidad de Fichas Online.",
      path: pathname,
      robots: NOINDEX,
    };
  }

  if (pathname === "/auth" || pathname.startsWith("/admin")) {
    return {
      title: `${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      path: pathname,
      robots: NOINDEX,
    };
  }

  return {
    title: `Página no encontrada | ${SITE_NAME}`,
    description: "La página que buscas no existe o fue movida.",
    path: pathname,
    robots: NOINDEX,
  };
}

export {
  DEFAULT_DESCRIPTION,
  DEFAULT_SHARE_IMAGE_ALT,
  INDEX,
  NOINDEX,
  SITE_NAME,
  SITE_URL,
};
