import { Instagram } from "lucide-react";

const INSTAGRAM_CHANNEL_URL = "https://www.instagram.com/channel/AbaXNeXdChPyP7US/";

export function BottomInstagramBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/35 bg-card/95 backdrop-blur-md">
      <div className="container mx-auto flex flex-nowrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
        <p className="min-w-0 flex-1 truncate text-left text-xs font-medium text-foreground sm:text-sm">
          Unite a nuestra comunidad de Instagram
        </p>
        <a
          href={INSTAGRAM_CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        >
          <Instagram className="h-4 w-4" />
          <span className="sm:hidden">Unirme</span>
          <span className="hidden sm:inline">Unirme al canal</span>
        </a>
      </div>
    </div>
  );
}
