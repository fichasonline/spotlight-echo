import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { AutoHeight } from "@/components/animate-ui/primitives/effects/auto-height";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Flag,
  Flame,
  Hash,
  Heart,
  Home,
  MessageSquare,
  MoreHorizontal,
  Newspaper,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";

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

interface FeedPostRow {
  id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  author_id: string;
  post_likes: { user_id: string }[];
  comments: {
    id: string;
    content: string;
    created_at: string;
    is_deleted: boolean;
    author_id: string;
  }[];
}

interface FeedProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface TrendingTopic {
  tag: string;
  mentions: number;
  posts: number;
  lastSeenAt: number;
}

type FeedSort = "recent" | "most-liked";
type FetchPostsOptions = { showLoading?: boolean; showErrorToast?: boolean };

const FEED_SELECT = `
  id, content, created_at, is_deleted, author_id,
  post_likes(user_id),
  comments(id, content, created_at, is_deleted, author_id)
`;
const HASHTAG_SPLIT_REGEX = /(#[\p{L}\p{N}_]{2,40})/gu;
const HASHTAG_ONLY_REGEX = /^#[\p{L}\p{N}_]{2,40}$/u;

function displayHandle(name: string | null | undefined) {
  if (!name?.trim()) return "usuario";
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

function getInitial(name: string | null | undefined) {
  const cleanName = name?.trim();
  if (!cleanName) return "U";
  return cleanName[0]?.toUpperCase() ?? "U";
}

function timeAgo(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

function extractHashtags(content: string) {
  return Array.from(content.matchAll(/#([\p{L}\p{N}_]{2,40})/gu), (match) =>
    match[1].toLowerCase()
  );
}

function normalizeTag(rawTag: string) {
  return rawTag.replace(/^#/, "").trim().toLowerCase();
}

function appendHashtag(content: string, rawTag: string) {
  const tag = normalizeTag(rawTag);
  if (!tag) return content;
  const nextTag = `#${tag}`;
  if (content.toLowerCase().includes(nextTag.toLowerCase())) return content;
  const needsSpace = content.length > 0 && !content.endsWith(" ");
  return `${content}${needsSpace ? " " : ""}${nextTag} `;
}

function isMissingHiddenColumnError(error: { message: string; code?: string | null }) {
  return error.code === "42703" || error.message.toLowerCase().includes("is_hidden");
}

function isMissingProfileError(error: { message: string; details?: string | null; code?: string | null }) {
  const haystack = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return error.code === "23503" && haystack.includes("posts_author_id_fkey");
}

function normalizeFeedRows(rows: unknown[]): FeedPostRow[] {
  return (rows as FeedPostRow[]).map((post) => ({
    ...post,
    post_likes: Array.isArray(post.post_likes) ? post.post_likes : [],
    comments: Array.isArray(post.comments) ? post.comments : [],
  }));
}

async function runFeedQuery(withHiddenFilter: boolean) {
  const query = supabase
    .from("posts")
    .select(FEED_SELECT)
    .order("created_at", { ascending: false })
    .limit(80);

  return withHiddenFilter ? query.eq("is_hidden", false) : query;
}

async function attachProfiles(rows: FeedPostRow[]): Promise<PostWithDetails[]> {
  const userIds = Array.from(
    new Set(
      rows.flatMap((post) => [post.author_id, ...post.comments.map((comment) => comment.author_id)])
    )
  );

  if (userIds.length === 0) {
    return rows.map((post) => ({
      ...post,
      profiles: null,
      comments: post.comments.map((comment) => ({ ...comment, profiles: null })),
    }));
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  if (error) {
    return rows.map((post) => ({
      ...post,
      profiles: null,
      comments: post.comments.map((comment) => ({ ...comment, profiles: null })),
    }));
  }

  const profileMap = new Map((data ?? []).map((profile) => [profile.id, profile as FeedProfileRow]));

  return rows.map((post) => {
    const postProfile = profileMap.get(post.author_id) ?? null;
    return {
      ...post,
      profiles: postProfile
        ? {
            display_name: postProfile.display_name,
            avatar_url: postProfile.avatar_url,
          }
        : null,
      comments: post.comments.map((comment) => {
        const commentProfile = profileMap.get(comment.author_id) ?? null;
        return {
          ...comment,
          profiles: commentProfile
            ? {
                display_name: commentProfile.display_name,
              }
            : null,
        };
      }),
    };
  });
}

export default function FeedPage() {
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<FeedSort>("recent");
  const lastPostTime = useRef<number>(0);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<{ type: string; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPosts = useCallback(async ({ showLoading = false, showErrorToast = true }: FetchPostsOptions = {}) => {
    if (showLoading) {
      setLoadingPosts(true);
      setFeedError(null);
    }

    let result = await runFeedQuery(true);
    if (result.error && isMissingHiddenColumnError(result.error)) {
      result = await runFeedQuery(false);
    }

    if (result.error) {
      const message = `No se pudo cargar el feed: ${result.error.message}`;
      if (showLoading) {
        setFeedError(message);
        setPosts([]);
      }
      if (showErrorToast) {
        toast({
          title: "Error al cargar el feed",
          description: result.error.message,
          variant: "destructive",
        });
      }
      if (showLoading) setLoadingPosts(false);
      return;
    }

    const normalizedRows = normalizeFeedRows((result.data ?? []) as unknown[]);
    const postsWithProfiles = await attachProfiles(normalizedRows);
    setPosts(postsWithProfiles);
    setFeedError(null);
    if (showLoading) setLoadingPosts(false);
  }, [toast]);

  useEffect(() => {
    void fetchPosts({ showLoading: true });
  }, [fetchPosts]);

  useEffect(() => {
    const scheduleSilentRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        void fetchPosts({ showErrorToast: false });
      }, 120);
    };

    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleSilentRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, scheduleSilentRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, scheduleSilentRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    const now = Date.now();
    if (now - lastPostTime.current < 30000) {
      toast({
        title: "Espera un momento",
        description: "Puedes publicar 1 post cada 30 segundos.",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);
    const { error } = await supabase
      .from("posts")
      .insert({ author_id: user.id, content: newPost.trim().slice(0, 500) });
    setPosting(false);

    if (error) {
      if (isMissingProfileError(error)) {
        toast({
          title: "No se pudo publicar",
          description:
            "Tu usuario no tiene perfil en la base de datos. Cierra sesion y vuelve a entrar; si persiste, aplica la migracion 20260219101500.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    lastPostTime.current = now;
    setNewPost("");
    void fetchPosts({ showErrorToast: false });
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;

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

    const { error } = liked
      ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
      : await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });

    if (error) {
      toast({
        title: "No se pudo actualizar el like",
        description: error.message,
        variant: "destructive",
      });
      void fetchPosts({ showErrorToast: false });
    }
  };

  const handleComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text || !user) return;

    const { error } = await supabase
      .from("comments")
      .insert({ post_id: postId, author_id: user.id, content: text.slice(0, 280) });

    if (error) {
      toast({
        title: "No se pudo publicar el comentario",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
    void fetchPosts({ showErrorToast: false });
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").update({ is_deleted: true }).eq("id", postId);
    if (error) {
      toast({
        title: "No se pudo eliminar el post",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, is_deleted: true } : post))
    );
    void fetchPosts({ showErrorToast: false });
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").update({ is_deleted: true }).eq("id", commentId);
    if (error) {
      toast({
        title: "No se pudo eliminar el comentario",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setPosts((prev) =>
      prev.map((post) => ({
        ...post,
        comments: post.comments.map((comment) =>
          comment.id === commentId ? { ...comment, is_deleted: true } : comment
        ),
      }))
    );
    void fetchPosts({ showErrorToast: false });
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason.trim() || !user) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: reportTarget.type,
      target_id: reportTarget.id,
      reason: reportReason.trim(),
    });

    if (error) {
      toast({
        title: "No se pudo enviar el reporte",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Reporte enviado",
      description: "Gracias por colaborar con la moderación.",
    });
    setReportTarget(null);
    setReportReason("");
  };

  const visiblePosts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      if (!normalizedSearch) return true;
      const authorName = post.profiles?.display_name?.toLowerCase() ?? "";
      const postTags = extractHashtags(post.content);

      if (normalizedSearch.startsWith("#")) {
        const normalizedTag = normalizeTag(normalizedSearch);
        return postTags.some((tag) => tag.startsWith(normalizedTag));
      }

      return (
        post.content.toLowerCase().includes(normalizedSearch) ||
        authorName.includes(normalizedSearch) ||
        displayHandle(post.profiles?.display_name).includes(normalizedSearch) ||
        postTags.some((tag) => tag.includes(normalizedSearch))
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === "most-liked") {
        const likesDelta = b.post_likes.length - a.post_likes.length;
        if (likesDelta !== 0) return likesDelta;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [posts, searchText, sortBy]);

  const timelineStats = useMemo(() => {
    const likes = visiblePosts.reduce((acc, p) => acc + p.post_likes.length, 0);
    const comments = visiblePosts.reduce((acc, p) => acc + p.comments.length, 0);
    return { posts: visiblePosts.length, likes, comments };
  }, [visiblePosts]);

  const trendingTopics = useMemo<TrendingTopic[]>(() => {
    const topicMap = new Map<string, { mentions: number; posts: number; lastSeenAt: number }>();

    posts.forEach((post) => {
      if (post.is_deleted && !isAdmin) return;
      const postTags = extractHashtags(post.content);
      if (postTags.length === 0) return;

      const seenInPost = new Set<string>();
      const postTimestamp = new Date(post.created_at).getTime();

      postTags.forEach((tag) => {
        const current = topicMap.get(tag) ?? { mentions: 0, posts: 0, lastSeenAt: 0 };
        current.mentions += 1;
        current.lastSeenAt = Math.max(current.lastSeenAt, postTimestamp);
        topicMap.set(tag, current);
        seenInPost.add(tag);
      });

      seenInPost.forEach((tag) => {
        const topic = topicMap.get(tag);
        if (topic) {
          topic.posts += 1;
          topicMap.set(tag, topic);
        }
      });
    });

    return Array.from(topicMap.entries())
      .map(([tag, stats]) => ({
        tag,
        mentions: stats.mentions,
        posts: stats.posts,
        lastSeenAt: stats.lastSeenAt,
      }))
      .sort((a, b) => {
        if (b.mentions !== a.mentions) return b.mentions - a.mentions;
        if (b.posts !== a.posts) return b.posts - a.posts;
        return b.lastSeenAt - a.lastSeenAt;
      })
      .slice(0, 6);
  }, [isAdmin, posts]);

  const activeHashtagFilter = useMemo(() => {
    const match = searchText.trim().toLowerCase().match(/^#([\p{L}\p{N}_]{2,40})$/u);
    return match?.[1] ?? null;
  }, [searchText]);

  const suggestedComposerTags = useMemo(() => trendingTopics.slice(0, 4), [trendingTopics]);

  const applyTagFilter = useCallback((rawTag: string) => {
    const normalizedTag = normalizeTag(rawTag);
    if (!normalizedTag) return;
    setSearchText(`#${normalizedTag}`);
  }, []);

  const renderContentWithHashtags = useCallback(
    (content: string) =>
      content.split(HASHTAG_SPLIT_REGEX).map((chunk, index) => {
        if (!HASHTAG_ONLY_REGEX.test(chunk)) {
          return <span key={`${chunk}-${index}`}>{chunk}</span>;
        }

        const tag = normalizeTag(chunk);
        const isActive = activeHashtagFilter === tag;
        return (
          <button
            key={`${chunk}-${index}`}
            type="button"
            onClick={() => applyTagFilter(tag)}
            className={`inline rounded px-0.5 font-semibold transition-colors ${
              isActive
                ? "bg-primary/20 text-primary"
                : "text-primary/90 hover:bg-primary/15 hover:text-primary"
            }`}
          >
            {chunk}
          </button>
        );
      }),
    [activeHashtagFilter, applyTagFilter]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto w-full max-w-[1260px] md:px-4 md:pt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <Card className="rounded-2xl border-border bg-card/70">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-lg">Explorar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pt-0">
                  <Link
                    to="/"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Home className="h-4 w-4" /> Inicio
                  </Link>
                  <Link
                    to="/noticias"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Newspaper className="h-4 w-4" /> Noticias
                  </Link>
                  <Link
                    to="/calendario"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <CalendarDays className="h-4 w-4" /> Calendario
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border bg-card/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Actividad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Posts</span>
                    <Badge variant="secondary">{timelineStats.posts}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Comentarios</span>
                    <Badge variant="secondary">{timelineStats.comments}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Likes</span>
                    <Badge variant="secondary">{timelineStats.likes}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>

          <main className="min-w-0 border-x border-border/60 bg-background">
            <div className="sticky top-14 z-20 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-xl font-bold text-foreground">Feed</h1>
                  <p className="text-xs text-muted-foreground">
                    {timelineStats.posts} publicaciones visibles
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as FeedSort)}
                  >
                    <SelectTrigger className="h-8 w-[160px] rounded-full">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Mas recientes</SelectItem>
                      <SelectItem value="most-liked">Mas likes</SelectItem>
                    </SelectContent>
                  </Select>
                  {activeHashtagFilter ? (
                    <button
                      type="button"
                      onClick={() => setSearchText("")}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      <Hash className="h-3.5 w-3.5" />
                      {activeHashtagFilter}
                      <X className="h-3 w-3" />
                    </button>
                  ) : (
                    <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Para ti
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 lg:hidden">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Buscar en el feed"
                    className="rounded-full pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="border-b border-border/60 px-4 py-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{getInitial(profile?.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder="¿Que esta pasando?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value.slice(0, 500))}
                    rows={3}
                    className="resize-none border-none bg-transparent px-0 text-base placeholder:text-muted-foreground/80 focus-visible:ring-0"
                  />
                  {suggestedComposerTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Temas en tendencia:</span>
                      {suggestedComposerTags.map((topic) => (
                        <button
                          key={topic.tag}
                          type="button"
                          onClick={() =>
                            setNewPost((prev) => appendHashtag(prev, topic.tag).slice(0, 500))
                          }
                          className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          #{topic.tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <span
                      className={`text-xs ${
                        newPost.length >= 480 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {newPost.length}/500
                    </span>
                    <Button
                      onClick={handlePost}
                      disabled={posting || !newPost.trim()}
                      className="rounded-full px-5 font-semibold"
                    >
                      <Send className="mr-1 h-4 w-4" />
                      Publicar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {trendingTopics.length > 0 && (
              <div className="border-b border-border/60 px-4 py-3 lg:hidden">
                <p className="text-xs font-medium text-muted-foreground">Tendencias</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {trendingTopics.map((topic) => (
                    <button
                      key={topic.tag}
                      type="button"
                      onClick={() => applyTagFilter(topic.tag)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        activeHashtagFilter === topic.tag
                          ? "bg-primary/20 text-primary"
                          : "bg-muted/45 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      }`}
                    >
                      #{topic.tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              {loadingPosts && (
                <div className="space-y-4 px-4 py-5">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="space-y-3 rounded-xl border border-border/50 p-4">
                      <div className="flex gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-4/5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingPosts && feedError && (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm text-destructive">{feedError}</p>
                  <Button
                    variant="outline"
                    className="mt-4 rounded-full"
                    onClick={() => void fetchPosts({ showLoading: true })}
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              {!loadingPosts && !feedError && (
                <AnimatePresence initial={false} mode="popLayout">
                  {visiblePosts.map((post) => {
                    const liked = post.post_likes.some((l) => l.user_id === user?.id);
                    const isOwner = post.author_id === user?.id;
                    const canDeletePost = isOwner || isAdmin;
                    const showComments = expandedComments.has(post.id);
                    const comments = post.comments.filter((comment) => !comment.is_deleted || isAdmin);

                    if (post.is_deleted && !isAdmin) return null;

                    if (post.is_deleted) {
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          key={post.id}
                          className="border-b border-border/60 px-4 py-5 text-sm italic text-muted-foreground"
                        >
                          Contenido eliminado
                        </motion.div>
                      );
                    }

                    return (
                      <motion.article
                        layout
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        whileHover={{ backgroundColor: "hsl(var(--muted) / 0.22)" }}
                        key={post.id}
                        className="border-b border-border/60 px-4 py-4"
                      >
                        <div className="flex gap-3">
                          <Avatar className="mt-0.5 h-10 w-10">
                            <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback>{getInitial(post.profiles?.display_name)}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-foreground">
                                {post.profiles?.display_name ?? "Usuario"}
                              </span>
                              <span className="text-muted-foreground">
                                @{displayHandle(post.profiles?.display_name)}
                              </span>
                              <span className="text-muted-foreground">· {timeAgo(post.created_at)}</span>
                            </div>

                            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/95">
                              {renderContentWithHashtags(post.content)}
                            </p>

                            <div className="mt-3 flex items-center gap-1 text-muted-foreground">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedComments((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(post.id)) next.delete(post.id);
                                    else next.add(post.id);
                                    return next;
                                  })
                                }
                                className="h-8 rounded-full px-3 text-muted-foreground hover:bg-sky-500/15 hover:text-sky-500"
                              >
                                <MessageSquare className="mr-1 h-4 w-4" />
                                {comments.length}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void toggleLike(post.id, liked)}
                                className={`h-8 rounded-full px-3 ${
                                  liked
                                    ? "text-rose-500 hover:bg-rose-500/15 hover:text-rose-500"
                                    : "text-muted-foreground hover:bg-rose-500/15 hover:text-rose-500"
                                }`}
                              >
                                <Heart
                                  className={`mr-1 h-4 w-4 ${
                                    liked ? "fill-rose-500 text-rose-500" : ""
                                  }`}
                                />
                                {post.post_likes.length}
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto h-8 w-8 rounded-full text-muted-foreground"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setReportTarget({ type: "post", id: post.id })}>
                                    <Flag className="mr-2 h-4 w-4" />
                                    Reportar
                                  </DropdownMenuItem>
                                  {canDeletePost && (
                                    <DropdownMenuItem
                                      onClick={() => void handleDeletePost(post.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <AutoHeight
                              deps={[showComments, comments.length, commentTexts[post.id] ?? ""]}
                              transition={{ type: "spring", stiffness: 320, damping: 30, bounce: 0 }}
                            >
                              {showComments ? (
                                <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
                                  {comments.map((c) => {
                                    const canDeleteComment = c.author_id === user?.id || isAdmin;
                                    return (
                                      <div
                                        key={c.id}
                                        className="rounded-xl border border-border/60 bg-card/50 p-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-xs text-muted-foreground">
                                              <span className="font-semibold text-foreground">
                                                {c.profiles?.display_name ?? "Usuario"}
                                              </span>{" "}
                                              · {timeAgo(c.created_at)}
                                            </div>
                                            {c.is_deleted ? (
                                              <p className="mt-1 text-sm italic text-muted-foreground">
                                                Contenido eliminado
                                              </p>
                                            ) : (
                                              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">
                                                {renderContentWithHashtags(c.content)}
                                              </p>
                                            )}
                                          </div>

                                          {!c.is_deleted && (
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 rounded-full text-muted-foreground"
                                                >
                                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    setReportTarget({ type: "comment", id: c.id })
                                                  }
                                                >
                                                  <Flag className="mr-2 h-4 w-4" />
                                                  Reportar
                                                </DropdownMenuItem>
                                                {canDeleteComment && (
                                                  <DropdownMenuItem
                                                    onClick={() => void handleDeleteComment(c.id)}
                                                    className="text-destructive focus:text-destructive"
                                                  >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Eliminar
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  <div className="flex gap-2">
                                    <Input
                                      type="text"
                                      placeholder="Publica tu respuesta"
                                      value={commentTexts[post.id] ?? ""}
                                      onChange={(e) =>
                                        setCommentTexts((prev) => ({
                                          ...prev,
                                          [post.id]: e.target.value.slice(0, 280),
                                        }))
                                      }
                                      onKeyDown={(e) => e.key === "Enter" && void handleComment(post.id)}
                                      className="h-9 rounded-full bg-muted/40 focus-visible:border-primary/70 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => void handleComment(post.id)}
                                      className="rounded-full px-4"
                                      disabled={!commentTexts[post.id]?.trim()}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </AutoHeight>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              )}

              {!loadingPosts && !feedError && visiblePosts.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <p className="text-muted-foreground">
                    {searchText.trim()
                      ? "No encontramos publicaciones con ese criterio."
                      : "No hay publicaciones todavia. Se el primero en abrir conversacion."}
                  </p>
                </div>
              )}
            </div>
          </main>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <Card className="rounded-2xl border-border bg-card/70">
                <CardContent className="pt-6">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Buscar en el feed"
                      className="rounded-full pl-9"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <p className="line-clamp-1">Tip: filtra por hashtag, por ejemplo `#eventos`.</p>
                    {searchText.trim() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchText("")}
                        className="h-7 rounded-full px-2 text-xs"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Limpiar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border bg-card/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 font-display text-lg">
                    Que esta pasando
                    <Badge variant="secondary" className="rounded-full">
                      {trendingTopics.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {trendingTopics.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 p-3 text-sm text-muted-foreground">
                      Aun no hay hashtags en publicaciones. Usa `#` en tus posts para arrancar
                      tendencias.
                    </div>
                  )}

                  {trendingTopics.map((topic, index) => {
                    const isActive = activeHashtagFilter === topic.tag;
                    return (
                      <motion.button
                        key={topic.tag}
                        type="button"
                        onClick={() => applyTagFilter(topic.tag)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.2 }}
                        whileHover={{ y: -2 }}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          isActive
                            ? "border-primary/40 bg-primary/10"
                            : "border-transparent bg-muted/35 hover:border-primary/25 hover:bg-muted/55"
                        }`}
                      >
                        <p className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Flame className="h-3.5 w-3.5 text-orange-400" />
                            Tendencia #{index + 1}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Hash className="h-3.5 w-3.5 text-primary" />
                          {topic.tag}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{topic.mentions} menciones</span>
                          <span>{topic.posts} posts</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatDistanceToNow(topic.lastSeenAt, { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar contenido</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Contanos el motivo del reporte..."
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
