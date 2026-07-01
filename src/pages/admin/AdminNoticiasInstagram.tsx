import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Link2,
  ListOrdered,
  RotateCcw,
  X,
} from "lucide-react";
import { parseDateValue } from "@/lib/date";
import {
  clampStoryImagePosition,
  clampStoryImageZoom,
  createArticleStoryPngBlob,
  extractArticleConcepts,
  getArticleStoryCaption,
  getArticleStoryDateLabel,
  getArticleStorySummary,
  getArticleStoryUrl,
} from "@/lib/article-story";

interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  body_markdown: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
  image_url: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
  instagram_image_position_x: number | null;
  instagram_image_position_y: number | null;
  instagram_image_zoom: number | null;
  instagram_selected: boolean;
  instagram_published: boolean;
  instagram_order: number | null;
}

interface StoryDraft {
  headline: string;
  summary: string;
  conceptsText: string;
}

interface GeneratedStory {
  url: string;
  fileName: string;
  usedArticleImage: boolean;
}

interface StoryImageAdjustment {
  x: number;
  y: number;
  zoom: number;
}

type GeneratedStories = Record<string, GeneratedStory>;
type GeneratingStoryIds = Record<string, boolean>;
type StoryImageAdjustments = Record<string, StoryImageAdjustment>;

function sortInstagramArticles(articles: Article[]) {
  return [...articles].sort((left, right) => {
    const leftOrder = left.instagram_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.instagram_order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    const leftTime = parseDateValue(left.published_at || left.created_at).getTime();
    const rightTime = parseDateValue(right.published_at || right.created_at).getTime();
    return rightTime - leftTime;
  });
}

function getDefaultStoryDraft(article: Article): StoryDraft {
  return {
    headline: article.headline,
    summary: getArticleStorySummary(article),
    conceptsText: extractArticleConcepts(article).join(", "),
  };
}

function parseStoryConcepts(conceptsText: string) {
  return Array.from(
    new Set(
      conceptsText
        .split(/[,;\n]/)
        .map((concept) => concept.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

function getStoryDraftSignature(article: Article, draft: StoryDraft) {
  return JSON.stringify([
    draft.headline.trim() || article.headline,
    draft.summary.trim(),
    draft.conceptsText.trim(),
  ]);
}

function getDefaultStoryImageAdjustment(article: Article): StoryImageAdjustment {
  return {
    x: clampStoryImagePosition(article.instagram_image_position_x ?? article.image_position_x),
    y: clampStoryImagePosition(article.instagram_image_position_y ?? article.image_position_y),
    zoom: clampStoryImageZoom(article.instagram_image_zoom),
  };
}

function getStoryImageAdjustmentSignature(adjustment: StoryImageAdjustment) {
  return JSON.stringify([
    clampStoryImagePosition(adjustment.x),
    clampStoryImagePosition(adjustment.y),
    clampStoryImageZoom(adjustment.zoom),
  ]);
}

function getDraftCaption(article: Article, draft: StoryDraft) {
  const concepts = parseStoryConcepts(draft.conceptsText);

  return getArticleStoryCaption(
    {
      ...article,
      headline: draft.headline.trim() || article.headline,
      summary: draft.summary,
    },
    concepts.length > 0 ? concepts : extractArticleConcepts(article),
  );
}

async function copyToClipboard(text: string) {
  if (!text) return;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export default function AdminNoticiasInstagram() {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [storyDrafts, setStoryDrafts] = useState<Record<string, StoryDraft>>({});
  const [storyImageAdjustments, setStoryImageAdjustments] = useState<StoryImageAdjustments>({});
  const [generatedStories, setGeneratedStories] = useState<GeneratedStories>({});
  const [generatingStoryIds, setGeneratingStoryIds] = useState<GeneratingStoryIds>({});
  const generatedStoriesRef = useRef<GeneratedStories>({});
  const autoGeneratedArticleIdsRef = useRef<Set<string>>(new Set());
  const lastGeneratedDraftSignaturesRef = useRef<Record<string, string>>({});
  const lastGeneratedImageAdjustmentSignaturesRef = useRef<Record<string, string>>({});
  const queuedStoryUpdateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queuedImageAdjustmentSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchArticles = useCallback(async () => {
    const { data, error } = await supabase
      .from("articles")
      .select("id, slug, headline, summary, body_markdown, status, created_at, published_at, image_url, image_position_x, image_position_y, instagram_image_position_x, instagram_image_position_y, instagram_image_zoom, instagram_selected, instagram_published, instagram_order")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      toast({
        title: "No se pudo cargar Instagram",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setArticles((data ?? []) as Article[]);
  }, [toast]);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    generatedStoriesRef.current = generatedStories;
  }, [generatedStories]);

  useEffect(() => {
    const queuedTimers = queuedStoryUpdateTimersRef.current;
    const queuedImageAdjustmentSaveTimers = queuedImageAdjustmentSaveTimersRef.current;

    return () => {
      Object.values(generatedStoriesRef.current).forEach((story) => URL.revokeObjectURL(story.url));
      Object.values(queuedTimers).forEach((timer) => clearTimeout(timer));
      Object.values(queuedImageAdjustmentSaveTimers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const instagramPendingArticles = useMemo(
    () => sortInstagramArticles(articles.filter((article) => article.instagram_selected && !article.instagram_published)),
    [articles],
  );

  const instagramPublishedArticles = useMemo(
    () => sortInstagramArticles(articles.filter((article) => article.instagram_selected && article.instagram_published)),
    [articles],
  );

  useEffect(() => {
    const pendingIds = new Set(instagramPendingArticles.map((article) => article.id));
    autoGeneratedArticleIdsRef.current = new Set(
      [...autoGeneratedArticleIdsRef.current].filter((articleId) => pendingIds.has(articleId)),
    );
    lastGeneratedDraftSignaturesRef.current = Object.fromEntries(
      Object.entries(lastGeneratedDraftSignaturesRef.current).filter(([articleId]) => pendingIds.has(articleId)),
    );
    lastGeneratedImageAdjustmentSignaturesRef.current = Object.fromEntries(
      Object.entries(lastGeneratedImageAdjustmentSignaturesRef.current).filter(([articleId]) => pendingIds.has(articleId)),
    );

    for (const [articleId, timer] of Object.entries(queuedStoryUpdateTimersRef.current)) {
      if (pendingIds.has(articleId)) continue;

      clearTimeout(timer);
      delete queuedStoryUpdateTimersRef.current[articleId];
    }

    for (const [articleId, timer] of Object.entries(queuedImageAdjustmentSaveTimersRef.current)) {
      if (pendingIds.has(articleId)) continue;

      clearTimeout(timer);
      delete queuedImageAdjustmentSaveTimersRef.current[articleId];
    }

    setStoryDrafts((previousDrafts) => {
      let changed = false;
      const nextDrafts: Record<string, StoryDraft> = {};

      for (const article of instagramPendingArticles) {
        const draft = previousDrafts[article.id];
        nextDrafts[article.id] = draft ?? getDefaultStoryDraft(article);
        if (!draft) changed = true;
      }

      if (Object.keys(previousDrafts).some((articleId) => !pendingIds.has(articleId))) {
        changed = true;
      }

      return changed ? nextDrafts : previousDrafts;
    });

    setStoryImageAdjustments((previousAdjustments) => {
      let changed = false;
      const nextAdjustments: StoryImageAdjustments = {};

      for (const article of instagramPendingArticles) {
        const adjustment = previousAdjustments[article.id];
        nextAdjustments[article.id] = adjustment ?? getDefaultStoryImageAdjustment(article);
        if (!adjustment) changed = true;
      }

      if (Object.keys(previousAdjustments).some((articleId) => !pendingIds.has(articleId))) {
        changed = true;
      }

      return changed ? nextAdjustments : previousAdjustments;
    });

    setGeneratedStories((previousStories) => {
      let changed = false;
      const nextStories: GeneratedStories = {};

      for (const [articleId, story] of Object.entries(previousStories)) {
        if (pendingIds.has(articleId)) {
          nextStories[articleId] = story;
          continue;
        }

        URL.revokeObjectURL(story.url);
        changed = true;
      }

      return changed ? nextStories : previousStories;
    });

    setGeneratingStoryIds((previousIds) => {
      let changed = false;
      const nextIds: GeneratingStoryIds = {};

      for (const [articleId, isGenerating] of Object.entries(previousIds)) {
        if (pendingIds.has(articleId)) {
          nextIds[articleId] = isGenerating;
          continue;
        }

        changed = true;
      }

      return changed ? nextIds : previousIds;
    });
  }, [instagramPendingArticles]);

  const generateStoryImage = useCallback(
    async (
      article: Article,
      draft: StoryDraft,
      imageAdjustment: StoryImageAdjustment,
      options?: {
        silent?: boolean;
      },
    ) => {
      const concepts = parseStoryConcepts(draft.conceptsText);
      const nextHeadline = draft.headline.trim() || article.headline;
      const nextSummary = draft.summary.trim();

      setGeneratingStoryIds((previousIds) => ({
        ...previousIds,
        [article.id]: true,
      }));

      try {
        const { blob, usedArticleImage } = await createArticleStoryPngBlob({
          headline: nextHeadline,
          summary: nextSummary,
          concepts: concepts.length > 0 ? concepts : extractArticleConcepts(article),
          dateLabel: getArticleStoryDateLabel(article),
          url: getArticleStoryUrl(article.slug),
          imageUrl: article.image_url,
          imagePosition: {
            x: imageAdjustment.x,
            y: imageAdjustment.y,
            zoom: imageAdjustment.zoom,
          },
        });

        const objectUrl = URL.createObjectURL(blob);
        lastGeneratedDraftSignaturesRef.current[article.id] = getStoryDraftSignature(article, draft);
        lastGeneratedImageAdjustmentSignaturesRef.current[article.id] = getStoryImageAdjustmentSignature(imageAdjustment);
        setGeneratedStories((previousStories) => {
          const previousStory = previousStories[article.id];
          if (previousStory?.url && previousStory.url !== objectUrl) {
            URL.revokeObjectURL(previousStory.url);
          }

          return {
            ...previousStories,
            [article.id]: {
              url: objectUrl,
              fileName: `${article.slug}-story-instagram.png`,
              usedArticleImage,
            },
          };
        });

        if (!options?.silent) {
          toast({
            title: "Imagen lista",
            description: usedArticleImage
              ? "La story quedó actualizada para descargar."
              : "La story quedó con fondo editorial porque la imagen externa no permitió exportarla.",
          });
        }
      } catch (error) {
        toast({
          title: "No se pudo crear la imagen",
          description: error instanceof Error ? error.message : "Intenta nuevamente.",
          variant: "destructive",
        });
      } finally {
        setGeneratingStoryIds((previousIds) => ({
          ...previousIds,
          [article.id]: false,
        }));
      }
    },
    [toast],
  );

  useEffect(() => {
    for (const article of instagramPendingArticles) {
      if (
        generatedStories[article.id]
        || generatingStoryIds[article.id]
        || autoGeneratedArticleIdsRef.current.has(article.id)
      ) {
        continue;
      }

      const draft = storyDrafts[article.id] ?? getDefaultStoryDraft(article);
      const imageAdjustment = storyImageAdjustments[article.id] ?? getDefaultStoryImageAdjustment(article);
      autoGeneratedArticleIdsRef.current.add(article.id);
      void generateStoryImage(article, draft, imageAdjustment, { silent: true });
    }
  }, [generateStoryImage, generatedStories, generatingStoryIds, instagramPendingArticles, storyDrafts, storyImageAdjustments]);

  useEffect(() => {
    const scheduledArticleIds: string[] = [];
    const queuedTimers = queuedStoryUpdateTimersRef.current;

    for (const article of instagramPendingArticles) {
      const draft = storyDrafts[article.id];
      const imageAdjustment = storyImageAdjustments[article.id] ?? getDefaultStoryImageAdjustment(article);
      if (!draft || !generatedStories[article.id] || generatingStoryIds[article.id]) continue;

      const draftSignature = getStoryDraftSignature(article, draft);
      const imageAdjustmentSignature = getStoryImageAdjustmentSignature(imageAdjustment);
      if (
        lastGeneratedDraftSignaturesRef.current[article.id] === draftSignature
        && lastGeneratedImageAdjustmentSignaturesRef.current[article.id] === imageAdjustmentSignature
      ) {
        continue;
      }

      const existingTimer = queuedTimers[article.id];
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        delete queuedTimers[article.id];
        void generateStoryImage(article, draft, imageAdjustment, { silent: true });
      }, 650);

      queuedTimers[article.id] = timer;
      scheduledArticleIds.push(article.id);
    }

    return () => {
      for (const articleId of scheduledArticleIds) {
        const timer = queuedTimers[articleId];
        if (!timer) continue;

        clearTimeout(timer);
        delete queuedTimers[articleId];
      }
    };
  }, [generateStoryImage, generatedStories, generatingStoryIds, instagramPendingArticles, storyDrafts, storyImageAdjustments]);

  const handleStoryDraftChange = useCallback((article: Article, field: keyof StoryDraft, value: string) => {
    setStoryDrafts((previousDrafts) => ({
      ...previousDrafts,
      [article.id]: {
        ...(previousDrafts[article.id] ?? getDefaultStoryDraft(article)),
        [field]: value,
      },
    }));
  }, []);

  const persistStoryImageAdjustment = useCallback(
    async (article: Article, adjustment: StoryImageAdjustment) => {
      const { error } = await supabase
        .from("articles")
        .update({
          instagram_image_position_x: clampStoryImagePosition(adjustment.x),
          instagram_image_position_y: clampStoryImagePosition(adjustment.y),
          instagram_image_zoom: clampStoryImageZoom(adjustment.zoom),
        })
        .eq("id", article.id);

      if (error) {
        toast({
          title: "No se pudo guardar el encuadre IG",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const queueStoryImageAdjustmentSave = useCallback(
    (article: Article, adjustment: StoryImageAdjustment) => {
      const existingTimer = queuedImageAdjustmentSaveTimersRef.current[article.id];
      if (existingTimer) clearTimeout(existingTimer);

      queuedImageAdjustmentSaveTimersRef.current[article.id] = setTimeout(() => {
        delete queuedImageAdjustmentSaveTimersRef.current[article.id];
        void persistStoryImageAdjustment(article, adjustment);
      }, 700);
    },
    [persistStoryImageAdjustment],
  );

  const handleStoryImageAdjustmentChange = useCallback(
    (article: Article, field: keyof StoryImageAdjustment, value: number) => {
      setStoryImageAdjustments((previousAdjustments) => {
        const currentAdjustment = previousAdjustments[article.id] ?? getDefaultStoryImageAdjustment(article);
        const nextAdjustment = {
          ...currentAdjustment,
          [field]: field === "zoom" ? clampStoryImageZoom(value) : clampStoryImagePosition(value),
        };

        queueStoryImageAdjustmentSave(article, nextAdjustment);

        return {
          ...previousAdjustments,
          [article.id]: nextAdjustment,
        };
      });
    },
    [queueStoryImageAdjustmentSave],
  );

  const resetStoryImageAdjustment = useCallback(
    (article: Article) => {
      const nextAdjustment = {
        x: 50,
        y: 50,
        zoom: 100,
      };

      setStoryImageAdjustments((previousAdjustments) => ({
        ...previousAdjustments,
        [article.id]: nextAdjustment,
      }));
      queueStoryImageAdjustmentSave(article, nextAdjustment);
    },
    [queueStoryImageAdjustmentSave],
  );

  const resequenceInstagramOrders = async (queue: Article[]) => {
    if (queue.length === 0) return true;

    const results = await Promise.all(
      queue.map((article, index) =>
        supabase
          .from("articles")
          .update({ instagram_order: index + 1 })
          .eq("id", article.id),
      ),
    );

    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) {
      toast({
        title: "No se pudo reordenar Instagram",
        description: failedResult.error.message,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleToggleInstagramSelection = async (article: Article) => {
    const sourceQueue = sortInstagramArticles(
      (article.instagram_published ? instagramPublishedArticles : instagramPendingArticles).filter(
        (entry) => entry.id !== article.id,
      ),
    );

    const [updateResult, resequenceOk] = await Promise.all([
      supabase
        .from("articles")
        .update({
          instagram_selected: false,
          instagram_published: false,
          instagram_order: null,
        })
        .eq("id", article.id),
      resequenceInstagramOrders(sourceQueue),
    ]);

    if (updateResult.error) {
      toast({
        title: "No se pudo quitar de Instagram",
        description: updateResult.error.message,
        variant: "destructive",
      });
      return;
    }

    if (!resequenceOk) return;

    toast({
      title: "Quitada de Instagram",
      description: "La noticia salió de la cola de publicaciones.",
    });
    void fetchArticles();
  };

  const handleSetInstagramPublished = async (article: Article, nextPublished: boolean) => {
    const sourceQueue = sortInstagramArticles(
      (article.instagram_published ? instagramPublishedArticles : instagramPendingArticles).filter(
        (entry) => entry.id !== article.id,
      ),
    );
    const destinationQueue = nextPublished ? instagramPublishedArticles : instagramPendingArticles;
    const nextOrder = destinationQueue.length + 1;

    const [updateResult, resequenceOk] = await Promise.all([
      supabase
        .from("articles")
        .update({
          instagram_selected: true,
          instagram_published: nextPublished,
          instagram_order: nextOrder,
        })
        .eq("id", article.id),
      resequenceInstagramOrders(sourceQueue),
    ]);

    if (updateResult.error) {
      toast({
        title: "No se pudo mover la noticia",
        description: updateResult.error.message,
        variant: "destructive",
      });
      return;
    }

    if (!resequenceOk) return;

    toast({
      title: nextPublished ? "Marcada como publicada" : "Marcada como pendiente",
      description: nextPublished
        ? "La noticia pasó al historial de Instagram."
        : "La noticia volvió a las stories listas para descargar.",
    });
    void fetchArticles();
  };

  const handleMoveInstagramArticle = async (article: Article, direction: -1 | 1) => {
    const queue = article.instagram_published ? instagramPublishedArticles : instagramPendingArticles;
    const currentIndex = queue.findIndex((entry) => entry.id === article.id);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= queue.length) return;

    const nextQueue = [...queue];
    const [movedArticle] = nextQueue.splice(currentIndex, 1);
    nextQueue.splice(nextIndex, 0, movedArticle);

    const resequenceOk = await resequenceInstagramOrders(nextQueue);
    if (!resequenceOk) return;

    void fetchArticles();
  };

  const resetStoryDraft = (article: Article) => {
    const nextDraft = getDefaultStoryDraft(article);
    const imageAdjustment = storyImageAdjustments[article.id] ?? getDefaultStoryImageAdjustment(article);
    setStoryDrafts((previousDrafts) => ({
      ...previousDrafts,
      [article.id]: nextDraft,
    }));
    void generateStoryImage(article, nextDraft, imageAdjustment, { silent: true });
  };

  const handleCopyStoryLink = async (article: Article) => {
    try {
      await copyToClipboard(getArticleStoryUrl(article.slug));
      toast({ title: "Link copiado", description: "El link público de la noticia quedó listo para pegar." });
    } catch (error) {
      toast({
        title: "No se pudo copiar el link",
        description: error instanceof Error ? error.message : "Intenta de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  };

  const handleCopyStoryCaption = async (article: Article, draft: StoryDraft) => {
    try {
      await copyToClipboard(getDraftCaption(article, draft));
      toast({ title: "Caption copiado", description: "Copié un texto base con hashtags y link." });
    } catch (error) {
      toast({
        title: "No se pudo copiar el caption",
        description: error instanceof Error ? error.message : "Intenta de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadStory = (story: GeneratedStory | undefined) => {
    if (!story) return;

    const link = document.createElement("a");
    link.href = story.url;
    link.download = story.fileName;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/admin/noticias" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Volver a noticias
            </Link>
            <h1 className="text-3xl font-display font-bold">Instagram de noticias</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Descargá las stories pendientes y marcalas como publicadas desde un solo lugar.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
            Listas: {instagramPendingArticles.length}
          </Badge>
        </div>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <ListOrdered className="h-3.5 w-3.5" />
              Stories
            </div>
            <Badge variant="outline">{instagramPendingArticles.length}</Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {instagramPendingArticles.map((article, index) => {
              const draft = storyDrafts[article.id] ?? getDefaultStoryDraft(article);
              const imageAdjustment = storyImageAdjustments[article.id] ?? getDefaultStoryImageAdjustment(article);
              const story = generatedStories[article.id];
              const isGenerating = Boolean(generatingStoryIds[article.id]);
              const storyLink = getArticleStoryUrl(article.slug);

              return (
                <article
                  key={article.id}
                  className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline">Orden {index + 1}</Badge>
                      <Badge
                        variant="outline"
                        className={
                          story
                            ? story.usedArticleImage
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-muted-foreground/20 bg-muted/50"
                            : "border-muted-foreground/20 bg-muted/50"
                        }
                      >
                        {isGenerating ? "Actualizando" : story ? (story.usedArticleImage ? "Original" : "Editorial") : "Generando"}
                      </Badge>
                      {article.published_at && (
                        <span>{format(parseDateValue(article.published_at), "d MMM yyyy", { locale: es })}</span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => void handleMoveInstagramArticle(article, -1)}
                        disabled={index === 0}
                        title="Subir"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => void handleMoveInstagramArticle(article, 1)}
                        disabled={index === instagramPendingArticles.length - 1}
                        title="Bajar"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => void handleToggleInstagramSelection(article)}
                        title="Quitar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mx-auto w-full max-w-[250px] sm:max-w-[270px]">
                      <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-[#09070d] shadow-[0_16px_36px_rgba(0,0,0,0.24)]">
                        {story ? (
                          <img
                            src={story.url}
                            alt={`Story generada de ${article.headline}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-5 text-center text-sm text-white/70">
                            {isGenerating ? "Creando imagen..." : "Preparando preview..."}
                          </div>
                        )}
                      </div>
                    </div>

                    {article.image_url && (
                      <div className="mt-3 rounded-xl border border-border/80 bg-background/65 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Encuadre IG</p>
                            <p className="text-xs text-muted-foreground">Ajusta la portada solo para esta story.</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => resetStoryImageAdjustment(article)}
                          >
                            Centrar
                          </Button>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Horizontal</span>
                              <span>{clampStoryImagePosition(imageAdjustment.x)}%</span>
                            </div>
                            <Slider
                              value={[clampStoryImagePosition(imageAdjustment.x)]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([value]) => handleStoryImageAdjustmentChange(article, "x", value)}
                              aria-label="Encuadre horizontal de la story"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Vertical</span>
                              <span>{clampStoryImagePosition(imageAdjustment.y)}%</span>
                            </div>
                            <Slider
                              value={[clampStoryImagePosition(imageAdjustment.y)]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([value]) => handleStoryImageAdjustmentChange(article, "y", value)}
                              aria-label="Encuadre vertical de la story"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Zoom</span>
                              <span>{clampStoryImageZoom(imageAdjustment.zoom)}%</span>
                            </div>
                            <Slider
                              value={[clampStoryImageZoom(imageAdjustment.zoom)]}
                              min={100}
                              max={180}
                              step={1}
                              onValueChange={([value]) => handleStoryImageAdjustmentChange(article, "zoom", value)}
                              aria-label="Zoom de portada en la story"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      <Label className="sr-only">Título de la story</Label>
                      <Textarea
                        className="min-h-[72px] resize-none rounded-xl border-border/80 bg-background/80 text-sm font-medium leading-snug shadow-sm focus-visible:ring-primary/35"
                        rows={3}
                        value={draft.headline}
                        onChange={(event) => handleStoryDraftChange(article, "headline", event.target.value)}
                        placeholder="Título de la story"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => handleDownloadStory(story)}
                        disabled={!story || isGenerating}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Descargar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => void handleSetInstagramPublished(article, true)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Publicada
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => void handleCopyStoryCaption(article, draft)}
                        title="Copiar caption"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => void handleCopyStoryLink(article)}
                        title="Copiar link"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => resetStoryDraft(article)}
                        title="Restaurar"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Ver noticia">
                        <a href={storyLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}

            {instagramPendingArticles.length === 0 && (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground lg:col-span-2 2xl:col-span-3">
                No hay noticias pendientes para Instagram.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
