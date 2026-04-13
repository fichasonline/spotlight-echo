const VIDEO_BANNER_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)(?:$|[?#])/i;

export function isVideoBannerUrl(src?: string | null) {
  return Boolean(src && VIDEO_BANNER_RE.test(src));
}

interface BannerMediaProps {
  src: string;
  alt?: string | null;
  className?: string;
  loading?: "eager" | "lazy";
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
}

export function BannerMedia({
  src,
  alt,
  className,
  loading = "lazy",
  controls = false,
  autoPlay = false,
  loop = false,
  muted = true,
  playsInline = true,
}: BannerMediaProps) {
  if (isVideoBannerUrl(src)) {
    return (
      <video
        src={src}
        className={className}
        aria-label={alt ?? "Anuncio"}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={controls ? "metadata" : "auto"}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? "Anuncio"}
      className={className}
      loading={loading}
    />
  );
}
