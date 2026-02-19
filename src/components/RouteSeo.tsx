import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "Fichas Online";
const DEFAULT_DESCRIPTION = "Noticias, calendario y comunidad de Fichas Online.";
const SHARE_IMAGE_PATH = "/og-cover-1200x630.png?v=2";
const SHARE_IMAGE_ALT = "Fichas Online";
const SHARE_IMAGE_TYPE = "image/png";
const SHARE_IMAGE_WIDTH = "1200";
const SHARE_IMAGE_HEIGHT = "630";
const NOINDEX = "noindex, nofollow";
const INDEX = "index, follow";

type SeoConfig = {
  title: string;
  description: string;
  robots?: string;
};

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname === "/") {
    return {
      title: `${SITE_NAME} | Noticias, calendario y comunidad`,
      description: DEFAULT_DESCRIPTION,
      robots: INDEX,
    };
  }

  if (pathname === "/calendario") {
    return {
      title: `Calendario de Eventos | ${SITE_NAME}`,
      description: "Descubre próximos eventos, fechas y ubicaciones en el calendario de Fichas Online.",
      robots: INDEX,
    };
  }

  if (pathname === "/noticias") {
    return {
      title: `Noticias | ${SITE_NAME}`,
      description: "Lee las últimas noticias y novedades publicadas en Fichas Online.",
      robots: INDEX,
    };
  }

  if (pathname.startsWith("/noticias/")) {
    return {
      title: `Artículo | ${SITE_NAME}`,
      description: "Lee este artículo en Fichas Online.",
      robots: INDEX,
    };
  }

  if (pathname.startsWith("/eventos/")) {
    return {
      title: `Evento | ${SITE_NAME}`,
      description: "Consulta la información y detalles de este evento en Fichas Online.",
      robots: INDEX,
    };
  }

  if (pathname === "/feed") {
    return {
      title: `Comunidad | ${SITE_NAME}`,
      description: "Participa en el feed de comunidad de Fichas Online.",
      robots: NOINDEX,
    };
  }

  if (pathname === "/auth" || pathname.startsWith("/admin")) {
    return {
      title: `${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      robots: NOINDEX,
    };
  }

  return {
    title: `Página no encontrada | ${SITE_NAME}`,
    description: "La página que buscas no existe o fue movida.",
    robots: NOINDEX,
  };
}

function upsertMetaByName(name: string, content: string) {
  let meta = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let meta = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
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

function upsertWebSiteSchema(siteUrl: string) {
  const scriptId = "website-structured-data";
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "es",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo_fichas.png`,
      },
    },
  });
}

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const siteUrl = window.location.origin;
    const canonicalUrl = new URL(pathname || "/", siteUrl).toString();
    const imageUrl = new URL(SHARE_IMAGE_PATH, siteUrl).toString();
    const seo = getSeoConfig(pathname);

    document.documentElement.setAttribute("lang", "es");
    document.title = seo.title;

    upsertMetaByName("description", seo.description);
    upsertMetaByName("robots", seo.robots ?? INDEX);
    upsertMetaByName("twitter:title", seo.title);
    upsertMetaByName("twitter:description", seo.description);
    upsertMetaByName("twitter:image", imageUrl);
    upsertMetaByName("twitter:image:alt", SHARE_IMAGE_ALT);

    upsertMetaByProperty("og:title", seo.title);
    upsertMetaByProperty("og:description", seo.description);
    upsertMetaByProperty("og:url", canonicalUrl);
    upsertMetaByProperty("og:image", imageUrl);
    upsertMetaByProperty("og:image:alt", SHARE_IMAGE_ALT);
    upsertMetaByProperty("og:image:type", SHARE_IMAGE_TYPE);
    upsertMetaByProperty("og:image:width", SHARE_IMAGE_WIDTH);
    upsertMetaByProperty("og:image:height", SHARE_IMAGE_HEIGHT);

    upsertCanonical(canonicalUrl);
    upsertWebSiteSchema(siteUrl);
  }, [pathname]);

  return null;
}
