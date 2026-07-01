import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateValue } from "@/lib/date";
import { buildAbsoluteUrl, SITE_URL, stripMarkdown, truncateText } from "@/lib/seo";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_BRAND_LOGO_URL = "/Group%20789.svg";
const STORY_VECTOR_URL = "/Vector.png";
const STORY_STOP_WORDS = new Set([
  "actualidad",
  "ademas",
  "ahora",
  "ante",
  "asi",
  "aun",
  "cada",
  "como",
  "con",
  "contra",
  "cuando",
  "cual",
  "desde",
  "donde",
  "durante",
  "ellos",
  "entre",
  "esta",
  "estas",
  "este",
  "estos",
  "fichas",
  "fichasonline",
  "fichasonlineuy",
  "hacia",
  "hasta",
  "instagram",
  "la",
  "las",
  "link",
  "los",
  "mas",
  "mientras",
  "misma",
  "mismo",
  "mismos",
  "mucha",
  "muchas",
  "mucho",
  "muchos",
  "news",
  "nota",
  "noticia",
  "noticias",
  "online",
  "otra",
  "otras",
  "otro",
  "otros",
  "para",
  "pero",
  "porque",
  "primera",
  "primer",
  "puede",
  "pueden",
  "que",
  "quien",
  "sobre",
  "solo",
  "story",
  "sus",
  "toda",
  "todo",
  "tras",
  "una",
  "unas",
  "uno",
  "unos",
]);

export type StoryArticleRecord = {
  slug: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  published_at: string | null;
  created_at: string;
  image_url?: string | null;
};

export type ArticleStoryDownloadInput = {
  headline: string;
  summary: string;
  concepts: string[];
  dateLabel: string;
  url: string;
  imageUrl?: string | null;
  imagePosition?: ArticleStoryImagePosition;
};

export type ArticleStoryImagePosition = {
  x?: number | null;
  y?: number | null;
  zoom?: number | null;
};

export function getArticleStoryExportImageUrl(imageUrl: string | null | undefined, currentOrigin?: string) {
  const rawUrl = imageUrl?.trim();
  if (!rawUrl) return null;

  if (rawUrl.startsWith("/")) return rawUrl;

  const origin = currentOrigin ?? (typeof window !== "undefined" ? window.location.origin : SITE_URL);

  try {
    const absoluteUrl = new URL(rawUrl, origin);
    const originUrl = new URL(origin);

    if (!["http:", "https:"].includes(absoluteUrl.protocol)) return null;
    if (absoluteUrl.origin === originUrl.origin) return absoluteUrl.toString();

    return `/api/image-proxy?url=${encodeURIComponent(absoluteUrl.toString())}`;
  } catch {
    return null;
  }
}

function normalizeToken(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatConceptLabel(value: string) {
  if (/^[A-Z0-9-]{3,}$/.test(value)) return value;
  if (/\d/.test(value)) return value.toUpperCase();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function collectConceptTokens(store: Map<string, { score: number; label: string }>, text: string | null | undefined, weight: number) {
  if (!text) return;

  const matches = text.match(/[A-Za-zÀ-ÿ0-9-]+/g) ?? [];

  for (const rawToken of matches) {
    const token = rawToken.trim();
    const normalized = normalizeToken(token);
    const isShortAcronym = /^[A-Z0-9-]{3,}$/.test(token);

    if (!normalized || /^\d+$/.test(normalized)) continue;
    if (!isShortAcronym && normalized.length < 4) continue;
    if (STORY_STOP_WORDS.has(normalized)) continue;

    const previous = store.get(normalized);
    store.set(normalized, {
      score: (previous?.score ?? 0) + weight + (isShortAcronym ? 2 : 0),
      label: previous?.label ?? formatConceptLabel(token),
    });
  }
}

function buildTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (words.length > 0 && lines.length === maxLines) {
    const renderedWords = lines.join(" ").split(/\s+/).length;
    if (renderedWords < words.length) {
      let lastLine = lines[maxLines - 1];
      while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
        const nextLine = lastLine.includes(" ")
          ? lastLine.slice(0, lastLine.lastIndexOf(" "))
          : lastLine.slice(0, -1);
        if (!nextLine || nextLine === lastLine) break;
        lastLine = nextLine.trim();
      }
      lines[maxLines - 1] = `${lastLine || lines[maxLines - 1]}…`;
    }
  }

  return lines;
}

function fillCenteredTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
) {
  let cursorY = startY;

  for (const line of lines) {
    const width = ctx.measureText(line).width;
    ctx.fillText(line, centerX - width / 2, cursorY);
    cursorY += lineHeight;
  }

  return cursorY;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

export function clampStoryImagePosition(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function clampStoryImageZoom(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 100;
  return Math.min(180, Math.max(100, Math.round(value)));
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  position: ArticleStoryImagePosition = {},
) {
  const positionX = clampStoryImagePosition(position.x);
  const positionY = clampStoryImagePosition(position.y);
  const zoom = clampStoryImageZoom(position.zoom) / 100;
  const scale = Math.max(width / image.width, height / image.height) * zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + ((width - drawWidth) * positionX) / 100;
  const drawY = y + ((height - drawHeight) * positionY) / 100;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawBrandBadge(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number) {
  const width = 296;
  const height = 94;
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "rgba(12, 8, 18, 0.92)");
  gradient.addColorStop(1, "rgba(55, 28, 84, 0.84)");

  ctx.save();
  ctx.shadowColor = "rgba(63, 21, 96, 0.35)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  roundedRectPath(ctx, x, y, width, height, 24);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.16;
  roundedRectPath(ctx, x, y, width, height, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  if (logo) {
    ctx.save();
    drawContainedImage(ctx, logo, x + 18, y + 15, width - 36, height - 30);
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px Blauer, Inter, sans-serif";
  const fallbackLabel = "FICHAS ONLINE";
  const fallbackWidth = ctx.measureText(fallbackLabel).width;
  ctx.fillText(fallbackLabel, x + width / 2 - fallbackWidth / 2, y + 34);
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  vectorImage: HTMLImageElement | null,
  panelX: number,
  panelY: number,
  panelWidth: number,
  panelHeight: number,
) {
  ctx.save();
  roundedRectPath(ctx, panelX, panelY, panelWidth, panelHeight, 38);
  ctx.clip();

  if (vectorImage) {
    const watermarkWidth = panelWidth - 236;
    const watermarkScale = watermarkWidth / vectorImage.width;
    const watermarkHeight = vectorImage.height * watermarkScale;
    const watermarkX = panelX + (panelWidth - watermarkWidth) / 2;
    const watermarkY = panelY + panelHeight - watermarkHeight + 18;

    ctx.globalAlpha = 0.18;
    ctx.drawImage(vectorImage, watermarkX, watermarkY, watermarkWidth, watermarkHeight);
    ctx.restore();
    return;
  }

  const centerX = panelX + panelWidth / 2;
  const centerY = panelY + panelHeight - 110;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 154, 0.15 * Math.PI, 1.95 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("No se pudo generar el PNG."));
    }, "image/png");
  });
}

async function loadExportableImage(url: string | null | undefined) {
  const exportableUrl = getArticleStoryExportImageUrl(url);
  if (!exportableUrl) return null;

  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = exportableUrl;
  });
}

export function extractArticleConcepts(article: StoryArticleRecord, limit = 6) {
  const scoreMap = new Map<string, { score: number; label: string }>();

  collectConceptTokens(scoreMap, article.headline, 6);
  collectConceptTokens(scoreMap, article.summary, 3);
  collectConceptTokens(scoreMap, stripMarkdown(article.body_markdown), 1);

  return [...scoreMap.values()]
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "es"))
    .slice(0, limit)
    .map((entry) => entry.label);
}

export function getArticleStorySummary(article: Pick<StoryArticleRecord, "summary" | "body_markdown">, maxLength = 220) {
  if (typeof article.summary === "string") {
    const normalizedSummary = article.summary.replace(/\s+/g, " ").trim();
    return normalizedSummary ? truncateText(normalizedSummary, maxLength) : "";
  }

  const bodyText = stripMarkdown(article.body_markdown).replace(/\s+/g, " ").trim();
  return bodyText ? truncateText(bodyText, maxLength) : "";
}

export function getArticleStoryUrl(slug: string, baseUrl = SITE_URL) {
  return buildAbsoluteUrl(`/noticias/${slug}`, baseUrl);
}

export function getArticleStoryDateLabel(article: Pick<StoryArticleRecord, "published_at" | "created_at">) {
  const rawDate = article.published_at || article.created_at;
  return format(parseDateValue(rawDate), "d MMM yyyy", { locale: es });
}

function conceptToHashtag(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();

  if (!normalized) return "";

  return `#${normalized
    .split(/\s+/)
    .map((segment) => (
      /^[A-Z0-9]+$/.test(segment)
        ? segment
        : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    ))
    .join("")}`;
}

export function getArticleStoryCaption(article: StoryArticleRecord, concepts: string[], baseUrl = SITE_URL) {
  const summary = getArticleStorySummary(article, 260);
  const hashtags = concepts.map(conceptToHashtag).filter(Boolean);
  const url = getArticleStoryUrl(article.slug, baseUrl);

  return [
    article.headline.trim(),
    summary ? `\n${summary}` : "",
    hashtags.length > 0 ? `\n${hashtags.join(" ")}` : "",
    `\nLee la noticia completa:\n${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createArticleStoryPngBlob(input: ArticleStoryDownloadInput) {
  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo iniciar el lienzo de exportación.");

  ctx.fillStyle = "#f5f2f7";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const backgroundGradient = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
  backgroundGradient.addColorStop(0, "#f8f6f9");
  backgroundGradient.addColorStop(0.55, "#f2eef5");
  backgroundGradient.addColorStop(1, "#ebe6f0");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const glowLeft = ctx.createRadialGradient(140, 140, 20, 140, 140, 480);
  glowLeft.addColorStop(0, "rgba(167, 60, 239, 0.18)");
  glowLeft.addColorStop(1, "rgba(167, 60, 239, 0)");
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const glowRight = ctx.createRadialGradient(930, 1650, 60, 930, 1650, 520);
  glowRight.addColorStop(0, "rgba(98, 35, 154, 0.14)");
  glowRight.addColorStop(1, "rgba(98, 35, 154, 0)");
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const heroX = 86;
  const heroY = 186;
  const heroWidth = 908;
  const heroHeight = 676;
  const cardRadius = 36;

  let usedArticleImage = false;
  const [articleImage, brandLogo, vectorImage] = await Promise.all([
    loadExportableImage(input.imageUrl),
    loadExportableImage(STORY_BRAND_LOGO_URL),
    loadExportableImage(STORY_VECTOR_URL),
  ]);

  ctx.save();
  ctx.shadowColor = "rgba(24, 12, 33, 0.16)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 16;
  roundedRectPath(ctx, heroX, heroY, heroWidth, heroHeight, cardRadius);
  ctx.fillStyle = "#d7d2de";
  ctx.fill();
  ctx.restore();

  if (articleImage) {
    ctx.save();
    roundedRectPath(ctx, heroX, heroY, heroWidth, heroHeight, cardRadius);
    ctx.clip();
    drawCoverImage(ctx, articleImage, heroX, heroY, heroWidth, heroHeight, input.imagePosition);
    ctx.restore();
    usedArticleImage = true;
  } else {
    const fallbackHeroGradient = ctx.createLinearGradient(heroX, heroY, heroX + heroWidth, heroY + heroHeight);
    fallbackHeroGradient.addColorStop(0, "#120d16");
    fallbackHeroGradient.addColorStop(1, "#291336");
    roundedRectPath(ctx, heroX, heroY, heroWidth, heroHeight, cardRadius);
    ctx.fillStyle = fallbackHeroGradient;
    ctx.fill();

    const fallbackGlow = ctx.createRadialGradient(heroX + heroWidth * 0.72, heroY + heroHeight * 0.24, 20, heroX + heroWidth * 0.72, heroY + heroHeight * 0.24, 320);
    fallbackGlow.addColorStop(0, "rgba(243, 123, 52, 0.42)");
    fallbackGlow.addColorStop(1, "rgba(243, 123, 52, 0)");
    ctx.fillStyle = fallbackGlow;
    roundedRectPath(ctx, heroX, heroY, heroWidth, heroHeight, cardRadius);
    ctx.fill();

    if (brandLogo) {
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.shadowColor = "rgba(5, 3, 8, 0.34)";
      ctx.shadowBlur = 20;
      drawContainedImage(ctx, brandLogo, heroX + 144, heroY + 248, heroWidth - 288, 168);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.font = "700 34px Blauer, Inter, sans-serif";
      const fallbackLabel = "FICHAS ONLINE";
      const fallbackWidth = ctx.measureText(fallbackLabel).width;
      ctx.fillText(fallbackLabel, heroX + heroWidth / 2 - fallbackWidth / 2, heroY + heroHeight / 2 - 16);
    }
  }

  const heroOverlay = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroHeight);
  heroOverlay.addColorStop(0, "rgba(24, 12, 33, 0.04)");
  heroOverlay.addColorStop(0.58, "rgba(24, 12, 33, 0.12)");
  heroOverlay.addColorStop(1, "rgba(24, 12, 33, 0.28)");
  roundedRectPath(ctx, heroX, heroY, heroWidth, heroHeight, cardRadius);
  ctx.fillStyle = heroOverlay;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  roundedRectPath(ctx, heroX, heroY, heroWidth, heroHeight, cardRadius);
  ctx.stroke();

  drawBrandBadge(ctx, brandLogo, heroX + 26, heroY + 26);

  const panelX = 86;
  const panelY = 880;
  const panelWidth = 908;
  const panelHeight = 930;

  ctx.save();
  ctx.shadowColor = "rgba(88, 30, 133, 0.24)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  roundedRectPath(ctx, panelX, panelY, panelWidth, panelHeight, 38);
  ctx.fillStyle = "#5b1f8e";
  ctx.fill();
  ctx.restore();

  const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  panelGradient.addColorStop(0, "#5d1f8c");
  panelGradient.addColorStop(0.45, "#7527aa");
  panelGradient.addColorStop(1, "#a640ef");
  roundedRectPath(ctx, panelX, panelY, panelWidth, panelHeight, 38);
  ctx.fillStyle = panelGradient;
  ctx.fill();

  const panelShine = ctx.createRadialGradient(panelX + panelWidth / 2, panelY + panelHeight, 30, panelX + panelWidth / 2, panelY + panelHeight, 430);
  panelShine.addColorStop(0, "rgba(232, 179, 255, 0.26)");
  panelShine.addColorStop(1, "rgba(232, 179, 255, 0)");
  roundedRectPath(ctx, panelX, panelY, panelWidth, panelHeight, 38);
  ctx.fillStyle = panelShine;
  ctx.fill();

  drawWatermark(ctx, vectorImage, panelX, panelY, panelWidth, panelHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.font = "700 58px Blauer, Inter, sans-serif";
  const headlineLines = buildTextLines(ctx, input.headline.toUpperCase(), 660, 5);
  fillCenteredTextLines(ctx, headlineLines, panelX + panelWidth / 2, panelY + 118, 62);

  const ctaLabelY = panelY + 520;
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.font = "700 28px Inter, sans-serif";
  const ctaLabel = "LEE LA NOTA:";
  const ctaLabelWidth = ctx.measureText(ctaLabel).width;
  ctx.fillText(ctaLabel, panelX + panelWidth / 2 - ctaLabelWidth / 2, ctaLabelY);

  const blob = await canvasToBlob(canvas);
  return { blob, usedArticleImage };
}

export async function downloadArticleStoryPng(input: ArticleStoryDownloadInput, fileName: string) {
  const { blob, usedArticleImage } = await createArticleStoryPngBlob(input);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
  return { usedArticleImage };
}
