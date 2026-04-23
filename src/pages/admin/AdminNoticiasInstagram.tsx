import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Instagram,
  Link2,
  ListOrdered,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { parseDateValue } from "@/lib/date";
import {
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
  instagram_selected: boolean;
  instagram_published: boolean;
  instagram_order: number | null;
}

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
  const [articleToAddId, setArticleToAddId] = useState("");
  const [storyArticleId, setStoryArticleId] = useState("");
  const [storyHeadline, setStoryHeadline] = useState("");
  const [storySummary, setStorySummary] = useState("");
  const [storyConceptsText, setStoryConceptsText] = useState("");
  const [generatingStory, setGeneratingStory] = useState(false);
  const [generatedStoryUrl, setGeneratedStoryUrl] = useState("");
  const [generatedStoryFileName, setGeneratedStoryFileName] = useState("story-instagram.png");
  const [generatedStoryUsedArticleImage, setGeneratedStoryUsedArticleImage] = useState<boolean | null>(null);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from("articles")
      .select("id, slug, headline, summary, body_markdown, status, created_at, published_at, image_url, instagram_selected, instagram_published, instagram_order")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      toast({
        title: "No se pudo cargar la cola de Instagram",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setArticles((data ?? []) as Article[]);
  };

  useEffect(() => {
    void fetchArticles();
  }, []);

  const availableArticles = [...articles]
    .filter((article) => !article.instagram_selected)
    .sort((left, right) => {
      const leftTime = parseDateValue(left.published_at || left.created_at).getTime();
      const rightTime = parseDateValue(right.published_at || right.created_at).getTime();
      return rightTime - leftTime;
    });
  const instagramPendingArticles = sortInstagramArticles(
    articles.filter((article) => article.instagram_selected && !article.instagram_published),
  );
  const instagramPublishedArticles = sortInstagramArticles(
    articles.filter((article) => article.instagram_selected && article.instagram_published),
  );
  const instagramStoryArticles = [...instagramPendingArticles, ...instagramPublishedArticles];
  const selectedStoryArticle = instagramStoryArticles.find((article) => article.id === storyArticleId) ?? null;
  const storyConcepts = Array.from(
    new Set(
      storyConceptsText
        .split(/[,;\n]/)
        .map((concept) => concept.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
  const activeStoryHeadline = storyHeadline.trim() || selectedStoryArticle?.headline || "";
  const activeStorySummary = storySummary.trim();
  const storyLink = selectedStoryArticle ? getArticleStoryUrl(selectedStoryArticle.slug) : "";
  const storyCaption = selectedStoryArticle
    ? getArticleStoryCaption(
        {
          ...selectedStoryArticle,
          headline: activeStoryHeadline,
          summary: storySummary,
        },
        storyConcepts,
      )
    : "";

  useEffect(() => {
    const nextArticleToAddId = availableArticles.find((article) => article.id === articleToAddId)?.id
      ?? availableArticles[0]?.id
      ?? "";
    if (nextArticleToAddId !== articleToAddId) {
      setArticleToAddId(nextArticleToAddId);
    }
  }, [availableArticles, articleToAddId]);

  useEffect(() => {
    return () => {
      if (generatedStoryUrl) {
        URL.revokeObjectURL(generatedStoryUrl);
      }
    };
  }, [generatedStoryUrl]);

  const generateStoryImage = async (
    article: Article,
    options?: {
      headline?: string;
      summary?: string;
      conceptsText?: string;
      silent?: boolean;
    },
  ) => {
    const nextHeadline = options?.headline?.trim() || article.headline;
    const nextSummary = options?.summary?.trim() ?? getArticleStorySummary(article);
    const nextConcepts = Array.from(
      new Set(
        (options?.conceptsText ?? extractArticleConcepts(article).join(", "))
          .split(/[,;\n]/)
          .map((concept) => concept.trim())
          .filter(Boolean),
      ),
    ).slice(0, 8);

    setGeneratingStory(true);

    try {
      const { blob, usedArticleImage } = await createArticleStoryPngBlob({
        headline: nextHeadline,
        summary: nextSummary,
        concepts: nextConcepts,
        dateLabel: getArticleStoryDateLabel(article),
        url: getArticleStoryUrl(article.slug),
        imageUrl: article.image_url,
      });

      const objectUrl = URL.createObjectURL(blob);
      setGeneratedStoryUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return objectUrl;
      });
      setGeneratedStoryFileName(`${article.slug}-story-instagram.png`);
      setGeneratedStoryUsedArticleImage(usedArticleImage);

      if (!options?.silent) {
        toast({
          title: "Imagen creada",
          description: usedArticleImage
            ? "La story quedó generada y lista para descargar."
            : "La story quedó generada con fondo editorial porque la imagen externa no permitió exportarla.",
        });
      }
    } catch (error) {
      toast({
        title: "No se pudo crear la imagen",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setGeneratingStory(false);
    }
  };

  useEffect(() => {
    if (instagramStoryArticles.length === 0) {
      if (storyArticleId || storyHeadline || storySummary || storyConceptsText) {
        setStoryArticleId("");
        setStoryHeadline("");
        setStorySummary("");
        setStoryConceptsText("");
      }
      setGeneratedStoryUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return "";
      });
      setGeneratedStoryUsedArticleImage(null);
      return;
    }

    const existingSelection = instagramStoryArticles.find((article) => article.id === storyArticleId);
    if (existingSelection) return;

    const firstArticle = instagramStoryArticles[0];
    const firstHeadline = firstArticle.headline;
    const firstSummary = getArticleStorySummary(firstArticle);
    const firstConceptsText = extractArticleConcepts(firstArticle).join(", ");
    setStoryArticleId(firstArticle.id);
    setStoryHeadline(firstHeadline);
    setStorySummary(firstSummary);
    setStoryConceptsText(firstConceptsText);
    void generateStoryImage(firstArticle, {
      headline: firstHeadline,
      summary: firstSummary,
      conceptsText: firstConceptsText,
      silent: true,
    });
  }, [instagramStoryArticles, storyArticleId, storyHeadline, storySummary, storyConceptsText]);

  const handleStoryArticleSelect = (articleId: string) => {
    const article = instagramStoryArticles.find((entry) => entry.id === articleId);
    if (!article) return;

    const nextHeadline = article.headline;
    const nextSummary = getArticleStorySummary(article);
    const nextConceptsText = extractArticleConcepts(article).join(", ");

    setStoryArticleId(article.id);
    setStoryHeadline(nextHeadline);
    setStorySummary(nextSummary);
    setStoryConceptsText(nextConceptsText);
    void generateStoryImage(article, {
      headline: nextHeadline,
      summary: nextSummary,
      conceptsText: nextConceptsText,
      silent: true,
    });
  };

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

  const handleAddToInstagram = async () => {
    const article = availableArticles.find((entry) => entry.id === articleToAddId);
    if (!article) return;

    const nextOrder = instagramPendingArticles.length + 1;
    const { error } = await supabase
      .from("articles")
      .update({
        instagram_selected: true,
        instagram_published: false,
        instagram_order: nextOrder,
      })
      .eq("id", article.id);

    if (error) {
      toast({
        title: "No se pudo agregar a Instagram",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Agregada a Instagram",
      description: "La noticia quedó en la cola pendiente de Instagram.",
    });
    void fetchArticles();
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
        ? "La noticia pasó a Instagram publicadas."
        : "La noticia volvió a Instagram pendientes.",
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

  const resetStoryDraft = () => {
    if (!selectedStoryArticle) return;

    const nextHeadline = selectedStoryArticle.headline;
    const nextSummary = getArticleStorySummary(selectedStoryArticle);
    const nextConceptsText = extractArticleConcepts(selectedStoryArticle).join(", ");

    setStoryHeadline(nextHeadline);
    setStorySummary(nextSummary);
    setStoryConceptsText(nextConceptsText);
    void generateStoryImage(selectedStoryArticle, {
      headline: nextHeadline,
      summary: nextSummary,
      conceptsText: nextConceptsText,
      silent: true,
    });
  };

  const handleCopyStoryLink = async () => {
    if (!storyLink) return;

    try {
      await copyToClipboard(storyLink);
      toast({ title: "Link copiado", description: "El link público de la noticia quedó listo para pegar." });
    } catch (error) {
      toast({
        title: "No se pudo copiar el link",
        description: error instanceof Error ? error.message : "Intenta de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  };

  const handleCopyStoryCaption = async () => {
    if (!storyCaption) return;

    try {
      await copyToClipboard(storyCaption);
      toast({ title: "Caption copiado", description: "Copié un texto base con hashtags y link." });
    } catch (error) {
      toast({
        title: "No se pudo copiar el caption",
        description: error instanceof Error ? error.message : "Intenta de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadStory = () => {
    if (!generatedStoryUrl) return;

    const link = document.createElement("a");
    link.href = generatedStoryUrl;
    link.download = generatedStoryFileName;
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
              Aquí elegís qué noticias van a Instagram, las ordenás en cola y generás la story solo para esas piezas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              Pendientes: {instagramPendingArticles.length}
            </Badge>
            <Badge variant="outline" className="border-muted-foreground/20 bg-muted/50 text-muted-foreground">
              Publicadas: {instagramPublishedArticles.length}
            </Badge>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Plus className="h-3.5 w-3.5" />
                Agregar noticias
              </div>
              <h2 className="mt-3 text-xl font-display font-bold">Seleccionar para Instagram</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo las noticias publicadas y agregadas acá entran a la cola editorial.
              </p>
            </div>
            <Badge variant="outline">{availableArticles.length} disponibles</Badge>
          </div>

          {availableArticles.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <Label>Noticia publicada disponible</Label>
                <Select value={articleToAddId} onValueChange={setArticleToAddId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecciona una noticia" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableArticles.map((article) => (
                      <SelectItem key={article.id} value={article.id}>
                        {article.headline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void handleAddToInstagram()} disabled={!articleToAddId}>
                <Instagram className="mr-2 h-4 w-4" />
                Agregar a pendientes
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No hay más noticias publicadas disponibles para agregar a Instagram.
            </div>
          )}
        </section>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <ListOrdered className="h-3.5 w-3.5" />
                  Cola pendiente
                </div>
                <h2 className="mt-3 text-xl font-display font-bold">Pendientes de publicar</h2>
                <p className="mt-1 text-sm text-muted-foreground">Estas son las que salen primero en el generador.</p>
              </div>
              <Badge variant="outline">{instagramPendingArticles.length}</Badge>
            </div>

            <div className="space-y-3">
              {instagramPendingArticles.map((article, index) => (
                <div key={article.id} className="rounded-lg border border-border bg-background/50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground line-clamp-2">{article.headline}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Orden {index + 1}</Badge>
                        {article.published_at && (
                          <span>{format(parseDateValue(article.published_at), "d MMM yyyy", { locale: es })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleMoveInstagramArticle(article, -1)}
                        disabled={index === 0}
                        title="Subir"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleMoveInstagramArticle(article, 1)}
                        disabled={index === instagramPendingArticles.length - 1}
                        title="Bajar"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleStoryArticleSelect(article.id)}>
                      <Instagram className="mr-2 h-4 w-4" />
                      Abrir en generador
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleSetInstagramPublished(article, true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Marcar publicada
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void handleToggleInstagramSelection(article)}>
                      <X className="mr-2 h-4 w-4" />
                      Quitar
                    </Button>
                  </div>
                </div>
              ))}

              {instagramPendingArticles.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay noticias pendientes para Instagram.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-muted-foreground/20 bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Historial
                </div>
                <h2 className="mt-3 text-xl font-display font-bold">Ya publicadas en Instagram</h2>
                <p className="mt-1 text-sm text-muted-foreground">Quedan separadas para no mezclarse con las pendientes.</p>
              </div>
              <Badge variant="outline">{instagramPublishedArticles.length}</Badge>
            </div>

            <div className="space-y-3">
              {instagramPublishedArticles.map((article, index) => (
                <div key={article.id} className="rounded-lg border border-border bg-background/50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground line-clamp-2">{article.headline}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Orden {index + 1}</Badge>
                        {article.published_at && (
                          <span>{format(parseDateValue(article.published_at), "d MMM yyyy", { locale: es })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleMoveInstagramArticle(article, -1)}
                        disabled={index === 0}
                        title="Subir"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleMoveInstagramArticle(article, 1)}
                        disabled={index === instagramPublishedArticles.length - 1}
                        title="Bajar"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleStoryArticleSelect(article.id)}>
                      <Instagram className="mr-2 h-4 w-4" />
                      Abrir en generador
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleSetInstagramPublished(article, false)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Volver a pendientes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void handleToggleInstagramSelection(article)}>
                      <X className="mr-2 h-4 w-4" />
                      Quitar
                    </Button>
                  </div>
                </div>
              ))}

              {instagramPublishedArticles.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Todavía no marcaste noticias como publicadas en Instagram.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
          <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <Instagram className="h-3.5 w-3.5" />
                  Historia Instagram
                </div>
                <h2 className="mt-3 text-2xl font-display font-bold">Generador desde la cola editorial</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Seleccionás una noticia de la cola, se crea la imagen y queda lista para descargar como story
                  vertical con resumen, conceptos y link.
                </p>
              </div>
              <Badge variant="outline" className="border-accent/25 bg-accent/10 text-accent">
                1080 x 1920
              </Badge>
            </div>

            {instagramStoryArticles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-muted-foreground">
                Agrega al menos una noticia a Instagram para habilitar el generador.
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <Label>Noticia en cola de Instagram</Label>
                    <Select value={storyArticleId} onValueChange={handleStoryArticleSelect}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Selecciona una noticia" />
                      </SelectTrigger>
                      <SelectContent>
                        {instagramStoryArticles.map((article) => (
                          <SelectItem key={article.id} value={article.id}>
                            {article.headline}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Link público</Label>
                    <div className="mt-2 flex gap-2">
                      <Input value={storyLink} readOnly />
                      <Button variant="outline" onClick={() => void handleCopyStoryLink()} disabled={!storyLink}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Titular visible</Label>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={storyHeadline}
                    onChange={(event) => setStoryHeadline(event.target.value)}
                    placeholder="Titular para la story"
                  />
                </div>

                <div>
                  <Label>Resumen para la story</Label>
                  <Textarea
                    className="mt-2"
                    rows={4}
                    value={storySummary}
                    onChange={(event) => setStorySummary(event.target.value)}
                    placeholder="Resumen breve que aparecerá en la imagen"
                  />
                </div>

                <div>
                  <Label>Conceptos clave</Label>
                  <Textarea
                    className="mt-2"
                    rows={2}
                    value={storyConceptsText}
                    onChange={(event) => setStoryConceptsText(event.target.value)}
                    placeholder="Ej: WSOP, Montevideo, Main Event"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Se cargan automáticamente desde la noticia. Si los editás, recreá la imagen para actualizarla.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => selectedStoryArticle && void generateStoryImage(selectedStoryArticle, {
                      headline: activeStoryHeadline,
                      summary: activeStorySummary,
                      conceptsText: storyConceptsText,
                    })}
                    disabled={generatingStory || !selectedStoryArticle}
                  >
                    <Instagram className="mr-2 h-4 w-4" />
                    {generatingStory ? "Creando imagen..." : "Crear imagen"}
                  </Button>
                  <Button onClick={handleDownloadStory} disabled={!generatedStoryUrl || generatingStory}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PNG
                  </Button>
                  <Button variant="outline" onClick={() => void handleCopyStoryCaption()} disabled={!storyCaption}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar caption
                  </Button>
                  <Button variant="outline" onClick={() => resetStoryDraft()} disabled={!selectedStoryArticle}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restaurar
                  </Button>
                  {storyLink && (
                    <Button variant="ghost" asChild>
                      <a href={storyLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver noticia
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-display font-bold">Preview</h2>
                <p className="text-sm text-muted-foreground">Así se verá la story antes de descargarla.</p>
              </div>
              {selectedStoryArticle && (
                <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                  {generatedStoryUsedArticleImage === false ? "Fondo editorial" : "Imagen original"}
                </Badge>
              )}
            </div>

            {selectedStoryArticle ? (
              <div className="mx-auto max-w-[320px]">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] border border-white/10 bg-[#09070d] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                  {generatedStoryUrl ? (
                    <img
                      src={generatedStoryUrl}
                      alt={`Story generada de ${selectedStoryArticle.headline}`}
                      className="h-full w-full object-cover"
                    />
                  ) : generatingStory ? (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
                      Creando la story de esta noticia...
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
                      Seleccioná una noticia para generar la imagen.
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {generatedStoryUrl
                    ? `Imagen lista: ${generatedStoryFileName}`
                    : "Todavía no hay una imagen generada para descargar."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-muted-foreground">
                Cuando agregues noticias a la cola, acá vas a ver la preview de la story.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
