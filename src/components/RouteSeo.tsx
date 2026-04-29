import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applySeo, getDefaultSeoConfig } from "@/lib/seo";

const SELF_MANAGED_ROUTES = [/^\/noticias\/.+/, /^\/eventos\/.+/, /^\/salas\/.+/];

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (SELF_MANAGED_ROUTES.some((re) => re.test(pathname))) return;
    applySeo(getDefaultSeoConfig(pathname));
  }, [pathname]);

  return null;
}
