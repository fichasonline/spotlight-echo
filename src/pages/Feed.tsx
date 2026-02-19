import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Heart, MessageSquare, Flag, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PostWithDetails {
  id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  author_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  post_likes: { user_id: string }[];
  comments: {
    id: string;
    content: string;
    created_at: string;
    is_deleted: boolean;
    author_id: string;
    profiles: { display_name: string | null } | null;
  }[];
}

export default function FeedPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const lastPostTime = useRef<number>(0);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<{ type: string; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select(`
        id, content, created_at, is_deleted, author_id,
        profiles(display_name, avatar_url),
        post_likes(user_id),
        comments(id, content, created_at, is_deleted, author_id, profiles(display_name))
      `)
      .eq("is_hidden", false)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setPosts(data as any);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    const now = Date.now();
    if (now - lastPostTime.current < 30000) {
      toast({ title: "Esperá", description: "Podés publicar cada 30 segundos.", variant: "destructive" });
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("posts").insert({ author_id: user.id, content: newPost.trim().slice(0, 500) });
    setPosting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      lastPostTime.current = now;
      setNewPost("");
      fetchPosts();
    }
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
    // Optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              post_likes: liked
                ? p.post_likes.filter((l) => l.user_id !== user.id)
                : [...p.post_likes, { user_id: user.id }],
            }
          : p
      )
    );
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
  };

  const handleComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text || !user) return;
    await supabase.from("comments").insert({ post_id: postId, author_id: user.id, content: text });
    setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
    fetchPosts();
  };

  const handleDeletePost = async (postId: string) => {
    await supabase.from("posts").update({ is_deleted: true }).eq("id", postId);
    fetchPosts();
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason.trim() || !user) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: reportTarget.type,
      target_id: reportTarget.id,
      reason: reportReason.trim(),
    });
    toast({ title: "Reporte enviado", description: "Gracias por reportar." });
    setReportTarget(null);
    setReportReason("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-display font-bold mb-6">Feed</h1>

        {/* New post */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <Textarea
            placeholder="¿Qué estás pensando? (máx. 500 caracteres)"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value.slice(0, 500))}
            rows={3}
            className="mb-3 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{newPost.length}/500</span>
            <Button size="sm" onClick={handlePost} disabled={posting || !newPost.trim()}>
              <Send className="h-4 w-4 mr-1" /> Publicar
            </Button>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {posts.map((post) => {
            const liked = post.post_likes.some((l) => l.user_id === user?.id);
            const isOwner = post.author_id === user?.id;
            const showComments = expandedComments.has(post.id);
            const activeComments = post.comments.filter((c) => !c.is_deleted);

            if (post.is_deleted) {
              return (
                <div key={post.id} className="bg-card border border-border rounded-lg p-4 text-muted-foreground italic text-sm">
                  Contenido eliminado
                </div>
              );
            }

            return (
              <div key={post.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                    {(post.profiles?.display_name ?? "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">{post.profiles?.display_name ?? "Usuario"}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(post.created_at), "d MMM HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-foreground/90 mb-3 whitespace-pre-wrap">{post.content}</p>

                <div className="flex items-center gap-4">
                  <button onClick={() => toggleLike(post.id, liked)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Heart className={`h-4 w-4 ${liked ? "fill-primary text-primary" : ""}`} />
                    {post.post_likes.length}
                  </button>
                  <button
                    onClick={() => setExpandedComments((prev) => {
                      const next = new Set(prev);
                      next.has(post.id) ? next.delete(post.id) : next.add(post.id);
                      return next;
                    })}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {activeComments.length}
                  </button>
                  <button
                    onClick={() => setReportTarget({ type: "post", id: post.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-auto"
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                  {isOwner && (
                    <button onClick={() => handleDeletePost(post.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Comments */}
                {showComments && (
                  <div className="mt-4 pt-3 border-t border-border space-y-3">
                    {activeComments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0 mt-0.5">
                          {(c.profiles?.display_name ?? "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-foreground">{c.profiles?.display_name ?? "Usuario"}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(new Date(c.created_at), "d MMM HH:mm", { locale: es })}
                          </span>
                          <p className="text-sm text-foreground/80">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Escribí un comentario..."
                        value={commentTexts[post.id] ?? ""}
                        onChange={(e) => setCommentTexts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleComment(post.id)}
                        className="flex-1 bg-muted text-foreground text-sm rounded-md px-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleComment(post.id)}>
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {posts.length === 0 && (
            <p className="text-muted-foreground text-center py-12">No hay publicaciones aún. ¡Sé el primero!</p>
          )}
        </div>
      </div>

      {/* Report dialog */}
      <Dialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar contenido</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo del reporte..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={3}
          />
          <Button onClick={handleReport} disabled={!reportReason.trim()}>
            Enviar reporte
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
