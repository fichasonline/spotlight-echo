import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle,
  ArrowLeft,
  Copy,
  Dice5,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Trophy,
  Users,
} from "lucide-react";

type GiveawayParticipant = {
  username: string;
  normalizedUsername: string;
  commentId: string;
  text: string;
  timestamp: string | null;
  likeCount: number | null;
  entries: number;
};

type GiveawayMedia = {
  id: string;
  postUrl: string | null;
  caption: string | null;
  commentsCount: number | null;
  mediaType: string | null;
  timestamp: string | null;
  username: string | null;
};

type GiveawayStats = {
  commentsFetched: number;
  uniqueParticipants: number;
  duplicateComments: number;
  excludedComments: number;
  maxCommentPagesReached: boolean;
};

type GiveawayResponse = {
  success: boolean;
  action?: "load" | "draw";
  media?: GiveawayMedia;
  stats?: GiveawayStats;
  participants?: GiveawayParticipant[];
  winner?: GiveawayParticipant & { drawnAt: string };
  error?: string;
};

function parseExcludedUsernames(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim().replace(/^@+/, ""))
    .filter(Boolean);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-UY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateComment(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized || "-";
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AdminSorteos() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [postUrl, setPostUrl] = useState("");
  const [excludedRaw, setExcludedRaw] = useState("");
  const [loadingAction, setLoadingAction] = useState<"load" | "draw" | null>(null);
  const [result, setResult] = useState<GiveawayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const participants = result?.participants ?? [];
  const stats = result?.stats;
  const excludedUsernames = useMemo(() => parseExcludedUsernames(excludedRaw), [excludedRaw]);
  const canDraw = participants.length > 0 && loadingAction === null;

  const requestGiveaway = async (action: "load" | "draw") => {
    if (!session?.access_token) {
      setError("Sesion no disponible. Vuelve a iniciar sesion.");
      return;
    }

    if (!postUrl.trim()) {
      setError("Pega una URL de Instagram o media ID.");
      return;
    }

    setLoadingAction(action);
    setError(null);

    try {
      const response = await fetch("/api/instagram-giveaway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action,
          postUrl: postUrl.trim(),
          excludedUsernames,
        }),
      });

      const payload = (await response.json()) as GiveawayResponse;

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "No se pudo ejecutar el sorteo.");
      }

      setResult(payload);
      toast({
        title: action === "draw" ? "Ganador elegido" : "Comentarios cargados",
        description:
          action === "draw"
            ? `@${payload.winner?.username ?? "ganador"} fue elegido al azar.`
            : `${payload.stats?.uniqueParticipants ?? 0} participantes unicos encontrados.`,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Error inesperado.";
      setError(message);
      toast({
        title: "No se pudo completar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const copyWinner = async () => {
    if (!result?.winner) return;
    const lines = [
      `Ganador: @${result.winner.username}`,
      `Comentario: ${result.winner.text || "-"}`,
      result.media?.postUrl ? `Post: ${result.media.postUrl}` : "",
    ].filter(Boolean);

    await navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Resultado copiado" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Sorteos</h1>
            <p className="text-sm text-muted-foreground">Instagram comments giveaway</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Nuevo sorteo</CardTitle>
                <CardDescription>Una chance por username de Instagram.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-url">Post de Instagram</Label>
                  <Input
                    id="post-url"
                    value={postUrl}
                    onChange={(event) => setPostUrl(event.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excluded-users">Usuarios excluidos</Label>
                  <Input
                    id="excluded-users"
                    value={excludedRaw}
                    onChange={(event) => setExcludedRaw(event.target.value)}
                    placeholder="usuario1, usuario2"
                    autoComplete="off"
                  />
                </div>

                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requestGiveaway("load")}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "load" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : result ? (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    {result ? "Recargar comentarios" : "Cargar comentarios"}
                  </Button>
                  <Button type="button" onClick={() => requestGiveaway("draw")} disabled={!canDraw}>
                    {loadingAction === "draw" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Dice5 className="mr-2 h-4 w-4" />
                    )}
                    Elegir ganador
                  </Button>
                </div>
              </CardContent>
            </Card>

            {stats ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatBox label="Comentarios" value={stats.commentsFetched} />
                <StatBox label="Participantes" value={stats.uniqueParticipants} />
                <StatBox label="Duplicados" value={stats.duplicateComments} />
                <StatBox label="Excluidos" value={stats.excludedComments} />
              </div>
            ) : null}

            {stats?.maxCommentPagesReached ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Limite alcanzado</AlertTitle>
                <AlertDescription>
                  Se cargo el maximo configurado de paginas de comentarios. Sube META_GIVEAWAY_MAX_COMMENT_PAGES si
                  necesitás cubrir mas comentarios.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Participantes</h2>
                  <p className="text-sm text-muted-foreground">
                    {participants.length > 0 ? `${participants.length} usernames unicos` : "Sin comentarios cargados"}
                  </p>
                </div>
                <Badge variant="outline">
                  <Users className="mr-1 h-3 w-3" />
                  Follow manual
                </Badge>
              </div>

              {participants.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Carga un post para ver participantes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px] table-fixed text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Usuario</TableHead>
                        <TableHead>Comentario</TableHead>
                        <TableHead className="w-[90px] text-right">Entradas</TableHead>
                        <TableHead className="w-[170px]">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((participant) => (
                        <TableRow key={participant.normalizedUsername}>
                          <TableCell className="truncate font-medium">@{participant.username}</TableCell>
                          <TableCell className="text-muted-foreground">{truncateComment(participant.text)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{participant.entries}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDate(participant.timestamp)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Trophy className="h-5 w-5 text-accent" />
                  Ganador
                </CardTitle>
                <CardDescription>Resultado del ultimo sorteo.</CardDescription>
              </CardHeader>
              <CardContent>
                {result?.winner ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
                      <p className="text-xs uppercase text-muted-foreground">Username</p>
                      <p className="mt-1 break-words text-2xl font-display font-bold text-foreground">
                        @{result.winner.username}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Comentario</p>
                      <p className="mt-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                        {result.winner.text || "-"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button type="button" onClick={copyWinner}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar resultado
                      </Button>
                      {result.media?.postUrl ? (
                        <Button asChild type="button" variant="outline">
                          <a href={result.media.postUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Abrir post
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    El ganador aparece aca despues de sortear.
                  </div>
                )}
              </CardContent>
            </Card>

            {result?.media ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Post</CardTitle>
                  <CardDescription>{result.media.username ? `@${result.media.username}` : result.media.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Media ID</span>
                    <span className="truncate font-mono text-xs">{result.media.id}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Tipo</span>
                    <span>{result.media.mediaType || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Fecha</span>
                    <span>{formatDate(result.media.timestamp)}</span>
                  </div>
                  {result.media.postUrl ? (
                    <Button asChild variant="outline" className="w-full">
                      <a href={result.media.postUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir en Instagram
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
