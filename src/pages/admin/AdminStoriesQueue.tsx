import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SocialAsset = {
  id: string;
  post_id: string;
  url: string;
  asset_type: string;
  order_index: number;
};

type SocialStoryPost = {
  id: string;
  headline: string | null;
  caption: string;
  status: "draft" | "needs_approval";
  created_at: string;
  metadata?: Record<string, unknown> | null;
  social_assets?: SocialAsset[];
};

const socialPostsTable = (supabase as any).from("social_posts");
const socialAssetsTable = (supabase as any).from("social_assets");
const socialPublishJobsTable = (supabase as any).from("social_publish_jobs");

function getStoryText(post: SocialStoryPost) {
  const metadataText = post.metadata?.text;
  const metadataCaption = post.metadata?.caption;

  if (typeof metadataText === "string" && metadataText.trim()) return metadataText.trim();
  if (typeof metadataCaption === "string" && metadataCaption.trim()) return metadataCaption.trim();

  return post.caption;
}

function getPreviewAsset(post: SocialStoryPost) {
  return [...(post.social_assets ?? [])].sort((left, right) => left.order_index - right.order_index)[0] ?? null;
}

export default function AdminStoriesQueue() {
  const { toast } = useToast();
  const [stories, setStories] = useState<SocialStoryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<SocialStoryPost | null>(null);

  const fetchStories = async () => {
    setLoading(true);
    const postsResult = await socialPostsTable
      .select("id, headline, caption, status, created_at")
      .eq("format", "story")
      .in("status", ["needs_approval", "draft"])
      .order("created_at", { ascending: false });

    if (postsResult.error) {
      toast({
        title: "No se pudieron cargar las stories",
        description: postsResult.error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const posts = (postsResult.data ?? []) as SocialStoryPost[];
    const postIds = posts.map((post) => post.id);

    if (postIds.length === 0) {
      setStories([]);
      setLoading(false);
      return;
    }

    const assetsResult = await socialAssetsTable
      .select("id, post_id, url, asset_type, order_index")
      .in("post_id", postIds)
      .order("order_index", { ascending: true });

    if (assetsResult.error) {
      toast({
        title: "No se pudieron cargar los assets",
        description: assetsResult.error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const assetsByPostId = ((assetsResult.data ?? []) as SocialAsset[]).reduce<Record<string, SocialAsset[]>>(
      (groupedAssets, asset) => {
        groupedAssets[asset.post_id] = [...(groupedAssets[asset.post_id] ?? []), asset];
        return groupedAssets;
      },
      {},
    );

    setStories(posts.map((post) => ({ ...post, social_assets: assetsByPostId[post.id] ?? [] })));
    setLoading(false);
  };

  const selectedAsset = selectedStory ? getPreviewAsset(selectedStory) : null;
  const selectedStoryText = selectedStory ? getStoryText(selectedStory) : "";

  useEffect(() => {
    void fetchStories();
  }, []);

  const handlePublish = async (post: SocialStoryPost) => {
    setPublishingId(post.id);

    const updateResult = await socialPostsTable.update({ status: "queued" }).eq("id", post.id);
    if (updateResult.error) {
      setPublishingId(null);
      toast({
        title: "No se pudo encolar la story",
        description: updateResult.error.message,
        variant: "destructive",
      });
      return;
    }

    const jobResult = await socialPublishJobsTable.insert({ post_id: post.id, status: "queued" });
    setPublishingId(null);

    if (jobResult.error) {
      toast({
        title: "La story cambió de estado, pero no se creó el job",
        description: jobResult.error.message,
        variant: "destructive",
      });
      void fetchStories();
      return;
    }

    toast({
      title: "Story encolada",
      description: "El publisher externo ya puede levantar el job.",
    });
    void fetchStories();
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
            <h1 className="text-3xl font-display font-bold">Stories en cola</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Revisión final de stories generadas antes de pasarlas al publisher.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              Pendientes: {stories.length}
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchStories()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center rounded-xl border border-border bg-card/90 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando stories...
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-14 text-center text-sm text-muted-foreground">
            No hay stories pendientes de aprobación.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {stories.map((post) => {
              const previewAsset = getPreviewAsset(post);
              const storyText = getStoryText(post);
              const isPublishing = publishingId === post.id;

              return (
                <article key={post.id} className="overflow-hidden rounded-xl border border-border bg-card/90 shadow-[var(--shadow-card)]">
                  <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="bg-muted">
                      {previewAsset ? (
                        <button type="button" onClick={() => setSelectedStory(post)} className="group block w-full">
                          <img
                            src={previewAsset.url}
                            alt={post.headline ?? "Preview de story"}
                            className="aspect-[9/16] h-full min-h-[260px] w-full object-cover transition-opacity group-hover:opacity-90"
                          />
                        </button>
                      ) : (
                        <div className="flex aspect-[9/16] min-h-[260px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                          Sin imagen asociada
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant={post.status === "draft" ? "outline" : "default"}>
                          {post.status === "draft" ? "Borrador" : "Needs approval"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Creada hace {formatDistanceToNow(new Date(post.created_at), { locale: es })}
                        </span>
                      </div>

                      {post.headline && (
                        <h2 className="mb-2 line-clamp-2 text-lg font-display font-bold text-foreground">{post.headline}</h2>
                      )}

                      <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground line-clamp-[10]">
                        {storyText}
                      </p>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                        {previewAsset ? (
                          <button
                            type="button"
                            onClick={() => setSelectedStory(post)}
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Ver preview
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4" />
                            Esperando asset
                          </span>
                        )}
                        <Button onClick={() => void handlePublish(post)} disabled={isPublishing}>
                          {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          Publicar
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <Dialog open={Boolean(selectedStory)} onOpenChange={(open) => !open && setSelectedStory(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
          <div className="grid max-h-[92vh] min-h-0 md:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
            <div className="flex min-h-0 items-center justify-center bg-black p-3 md:p-5">
              {selectedAsset ? (
                <img
                  src={selectedAsset.url}
                  alt={selectedStory?.headline ?? "Preview de story"}
                  className="max-h-[82vh] w-auto max-w-full rounded-md object-contain shadow-2xl"
                />
              ) : (
                <div className="flex aspect-[9/16] w-full max-w-[320px] items-center justify-center rounded-md border border-white/10 text-sm text-white/70">
                  Sin imagen asociada
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col p-5">
              <DialogHeader className="pr-8">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {selectedStory && (
                    <Badge variant={selectedStory.status === "draft" ? "outline" : "default"}>
                      {selectedStory.status === "draft" ? "Borrador" : "Needs approval"}
                    </Badge>
                  )}
                  {selectedAsset && <Badge variant="outline">{selectedAsset.asset_type}</Badge>}
                </div>
                <DialogTitle className="text-xl font-display">
                  {selectedStory?.headline || "Preview de story"}
                </DialogTitle>
                <DialogDescription>
                  {selectedStory
                    ? `Creada hace ${formatDistanceToNow(new Date(selectedStory.created_at), { locale: es })}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{selectedStoryText}</p>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {selectedAsset && (
                  <Button variant="outline" asChild>
                    <a href={selectedAsset.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir original
                    </a>
                  </Button>
                )}
                {selectedStory && (
                  <Button
                    onClick={() => {
                      void handlePublish(selectedStory);
                      setSelectedStory(null);
                    }}
                    disabled={publishingId === selectedStory.id}
                  >
                    {publishingId === selectedStory.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Publicar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
