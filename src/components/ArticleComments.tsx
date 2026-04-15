import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, LogIn, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CommentProfile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: CommentProfile | null;
}

const MAX_CHARS = 1000;

function getInitial(profile: CommentProfile | null): string {
  const name =
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    "?";
  return name[0].toUpperCase();
}

function getDisplayName(profile: CommentProfile | null): string {
  return (
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    "Usuario"
  );
}

export function ArticleComments({ articleId }: { articleId: string }) {
  const { user, profile: authProfile, isAnonymous, loading: authLoading } = useAuth();
  const isLoggedIn = !!user && !isAnonymous;
  const { toast } = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch inicial
  useEffect(() => {
    if (!articleId) return;
    setLoadingComments(true);

    supabase
      .from("article_comments")
      .select("id, content, created_at, user_id, profiles(display_name, username, avatar_url)")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setComments(data as unknown as Comment[]);
        }
        setLoadingComments(false);
      });
  }, [articleId]);

  // Suscripción realtime
  useEffect(() => {
    if (!articleId) return;

    const channel = supabase
      .channel(`article_comments:${articleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "article_comments",
          filter: `article_id=eq.${articleId}`,
        },
        async (payload) => {
          // Fetch del comentario completo con perfil
          const { data } = await supabase
            .from("article_comments")
            .select("id, content, created_at, user_id, profiles(display_name, username, avatar_url)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setComments((prev) => {
              // Evitar duplicados (puede venir del optimistic update propio)
              if (prev.some((c) => c.id === data.id)) return prev;
              return [...prev, data as unknown as Comment];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "article_comments",
          filter: `article_id=eq.${articleId}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || !user || submitting) return;

    setSubmitting(true);

    // Optimistic insert
    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      user_id: user.id,
      profiles: authProfile
        ? {
            display_name: authProfile.display_name,
            username: authProfile.username,
            avatar_url: authProfile.avatar_url,
          }
        : null,
    };
    setComments((prev) => [...prev, optimistic]);
    setNewComment("");

    const { data, error } = await supabase
      .from("article_comments")
      .insert({ article_id: articleId, user_id: user.id, content: trimmed })
      .select("id, content, created_at, user_id, profiles(display_name, username, avatar_url)")
      .single();

    if (error) {
      // Revertir optimistic
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setNewComment(trimmed);
      toast({
        title: "No se pudo publicar",
        description: "Intentá de nuevo en un momento.",
        variant: "destructive",
      });
    } else if (data) {
      // Reemplazar optimistic con el real
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? (data as unknown as Comment) : c))
      );
    }

    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);

    // Optimistic remove
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    const { error } = await supabase
      .from("article_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      // Esto normalmente no falla, pero si falla re-fetch
      toast({
        title: "No se pudo eliminar",
        description: "Intentá de nuevo.",
        variant: "destructive",
      });
      // Re-fetch para restaurar estado
      const { data } = await supabase
        .from("article_comments")
        .select("id, content, created_at, user_id, profiles(display_name, username, avatar_url)")
        .eq("article_id", articleId)
        .order("created_at", { ascending: true });
      if (data) setComments(data as unknown as Comment[]);
    }

    setDeletingId(null);
  };

  return (
    <section className="mt-12 border-t border-border pt-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-bold uppercase tracking-wide text-foreground">
          Comentarios
        </h2>
        {!loadingComments && (
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
            {comments.length}
          </span>
        )}
      </div>

      {/* Formulario o CTA según estado de auth */}
      {!authLoading && (
        <div className="mb-8">
          {isLoggedIn ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-3">
                {/* Avatar del usuario actual */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {authProfile?.avatar_url ? (
                    <img
                      src={authProfile.avatar_url}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    getInitial(authProfile ? {
                      display_name: authProfile.display_name,
                      username: authProfile.username,
                      avatar_url: authProfile.avatar_url,
                    } : null)
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value.slice(0, MAX_CHARS))}
                    placeholder="Escribí tu comentario..."
                    rows={3}
                    className="resize-none bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
                    disabled={submitting}
                  />
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${newComment.length > MAX_CHARS * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
                      {newComment.length}/{MAX_CHARS}
                    </span>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!newComment.trim() || submitting}
                      className="gap-2"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {submitting ? "Publicando..." : "Comentar"}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted">
                  <LogIn className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Iniciá sesión para dejar tu comentario
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50">
                <Link to="/auth">Iniciar sesión</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lista de comentarios */}
      {loadingComments ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aún no hay comentarios. {isLoggedIn ? "¡Sé el primero!" : "Iniciá sesión para comentar."}
        </p>
      ) : (
        <ol className="space-y-6">
          {comments.map((comment) => {
            const isOwn = user?.id === comment.user_id;
            const displayName = getDisplayName(comment.profiles);
            const initial = getInitial(comment.profiles);

            return (
              <li key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {comment.profiles?.avatar_url ? (
                    <img
                      src={comment.profiles.avatar_url}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {displayName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(comment.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                      </span>
                    </div>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        aria-label="Eliminar comentario"
                        className="shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
