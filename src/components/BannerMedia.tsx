import type { CSSProperties } from "react";

const VIDEO_BANNER_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)(?:$|[?#])/i;

export function isVideoBannerUrl(src?: string | null) {
  return Boolean(src && VIDEO_BANNER_RE.test(src));
}

interface BannerMediaProps {
  src: string;
  alt?: string | null;
  className?: string;
  style?: CSSProperties;
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
  style,
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
        style={style}
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
      style={style}
      loading={loading}
    />
  );
}
