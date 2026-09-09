/** Redes del portal — mismas URLs en la home y en el footer. */
export const SOCIAL_URLS = {
  instagram: import.meta.env.VITE_INSTAGRAM_URL?.trim() || "https://instagram.com/fichasonlineuy",
  telegram: import.meta.env.VITE_TELEGRAM_URL?.trim() || "https://t.me/+59891856965",
  whatsapp: import.meta.env.VITE_WHATSAPP_URL?.trim() || "https://wa.me",
} as const;
