export interface Sala {
  id: string;
  slug: string;
  name: string;
  type: "online" | "live" | "ambas";
  short_description: string;
  body_markdown: string | null;
  logo_url: string | null;
  featured_image_url: string | null;
  website_url: string | null;
  affiliate_url: string | null;
  app_ios_url: string | null;
  app_android_url: string | null;
  deal_headline: string | null;
  deal_description: string | null;
  deal_updated_at: string | null;
  rating_overall: number | null;
  rating_software: number | null;
  rating_traffic: number | null;
  rating_bonuses: number | null;
  faq: { question: string; answer: string }[];
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface SalaCard {
  id: string;
  slug: string;
  name: string;
  type: "online" | "live" | "ambas";
  short_description: string;
  logo_url: string | null;
  deal_headline: string | null;
  rating_overall: number | null;
}

export const SALA_TYPE_LABEL: Record<Sala["type"], string> = {
  online: "Online",
  live: "Casino / Live",
  ambas: "Online & Live",
};
