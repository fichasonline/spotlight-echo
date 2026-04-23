import { describe, expect, it } from "vitest";
import {
  extractArticleConcepts,
  getArticleStoryCaption,
  getArticleStoryDateLabel,
  getArticleStorySummary,
  getArticleStoryUrl,
  getArticleStoryUrlLabel,
} from "@/lib/article-story";

const baseArticle = {
  slug: "wsop-circuit-montevideo",
  headline: "WSOP Circuit llega a Montevideo con un Main Event millonario",
  summary: "La serie confirma fechas, sede y premios para Uruguay.",
  body_markdown:
    "El calendario suma satélites, mesas en vivo y cobertura especial para la comunidad de poker en Montevideo.",
  published_at: "2026-04-23T10:00:00.000Z",
  created_at: "2026-04-22T18:00:00.000Z",
};

describe("article-story helpers", () => {
  it("extracts weighted concepts from the article copy", () => {
    const concepts = extractArticleConcepts(baseArticle, 5);

    expect(concepts).toContain("WSOP");
    expect(concepts).toContain("Circuit");
    expect(concepts).toContain("Montevideo");
  });

  it("prefers explicit summary when available", () => {
    expect(getArticleStorySummary(baseArticle)).toBe("La serie confirma fechas, sede y premios para Uruguay.");
    expect(getArticleStorySummary({ summary: "", body_markdown: "Texto alternativo" })).toBe("");
  });

  it("builds production article urls", () => {
    const url = getArticleStoryUrl(baseArticle.slug);
    expect(url).toBe("https://www.fichasonline.uy/noticias/wsop-circuit-montevideo");
    expect(getArticleStoryUrlLabel(url)).toBe("www.fichasonline.uy/noticias/wsop-circuit-montevideo");
  });

  it("generates a ready-to-copy caption with hashtags", () => {
    const caption = getArticleStoryCaption(baseArticle, ["WSOP", "Montevideo", "Main Event"]);

    expect(caption).toContain(baseArticle.headline);
    expect(caption).toContain("#WSOP");
    expect(caption).toContain("#Montevideo");
    expect(caption).toContain("#MainEvent");
    expect(caption).toContain("https://www.fichasonline.uy/noticias/wsop-circuit-montevideo");
  });

  it("formats the story date label in spanish", () => {
    expect(getArticleStoryDateLabel(baseArticle)).toBe("23 abr 2026");
  });
});
