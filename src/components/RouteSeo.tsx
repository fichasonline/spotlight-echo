import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applySeo, getDefaultSeoConfig } from "@/lib/seo";

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    applySeo(getDefaultSeoConfig(pathname));
  }, [pathname]);

  return null;
}
