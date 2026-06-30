import type { CSSProperties } from "react";

export const DEFAULT_ARTICLE_IMAGE_POSITION = 50;

export type ArticleImagePosition = {
  image_position_x?: number | null;
  image_position_y?: number | null;
};

export function clampArticleImagePosition(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_ARTICLE_IMAGE_POSITION;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getArticleImageObjectPosition(position: ArticleImagePosition) {
  const x = clampArticleImagePosition(position.image_position_x);
  const y = clampArticleImagePosition(position.image_position_y);
  return `${x}% ${y}%`;
}

export function getArticleImageStyle(position: ArticleImagePosition): CSSProperties {
  return {
    objectPosition: getArticleImageObjectPosition(position),
  };
}
