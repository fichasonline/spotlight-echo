import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applySeo, getDefaultSeoConfig } from "@/lib/seo";

import { ARTICLE_CATEGORIES } from "@/lib/taxonomy";

const SELF_MANAGED_ROUTES = [
  /^\/noticias\/.+/,
  /^\/eventos\/.+/,
  /^\/salas\/.+/,
  /^\/tag\/.+/,
  // Cada página de categoría llama a applySeo con su propio título y descripción.
  ...ARTICLE_CATEGORIES.map((category) => new RegExp(`^/${category.slug}/?$`)),
];

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (SELF_MANAGED_ROUTES.some((re) => re.test(pathname))) return;
    applySeo(getDefaultSeoConfig(pathname));
  }, [pathname]);

  return null;
}
