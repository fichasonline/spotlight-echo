import { Instagram } from "lucide-react";

const INSTAGRAM_CHANNEL_URL = "https://www.instagram.com/channel/AbaXNeXdChPyP7US/";

export function BottomInstagramBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/35 bg-card/95 backdrop-blur-md">
      <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-3 sm:flex-row">
        <p className="text-center text-sm font-medium text-foreground sm:text-left">
          Unite a nuestra comunidad de Instagram
        </p>
        <a
          href={INSTAGRAM_CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Instagram className="h-4 w-4" />
          Unirme al canal
        </a>
      </div>
    </div>
  );
}
