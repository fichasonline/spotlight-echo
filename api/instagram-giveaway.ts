import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_GRAPH_VERSION = "v25.0";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

type GiveawayAction = "load" | "draw";

type GiveawayRequestBody = {
  action?: GiveawayAction;
  postUrl?: string;
  mediaId?: string;
  excludedUsernames?: string[];
  streamProgress?: boolean;
};

type MetaPaging = {
  next?: string;
  cursors?: {
    before?: string;
    after?: string;
  };
};

type MetaCollection<T> = {
  data?: T[];
  paging?: MetaPaging;
};

type MetaErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type MetaAccount = {
  name?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
};

type MetaMedia = {
  id: string;
  permalink?: string;
  caption?: string;
  comments_count?: number;
  media_type?: string;
  timestamp?: string;
  username?: string;
};

type MetaComment = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  like_count?: number;
};

type GiveawayParticipant = {
  username: string;
  normalizedUsername: string;
  commentId: string;
  text: string;
  timestamp: string | null;
  likeCount: number | null;
  entryNumber: number;
  type?: "comment" | "mention";
  mentionedBy?: string;
};

type GiveawayProgress = {
  phase: "resolving_media" | "loading_comments" | "finalizing";
  commentsFetched: number;
  pagesRead?: number;
  totalComments?: number | null;
  message?: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAccessToken() {
  return (
    process.env.META_API ||
    process.env.META_ACCESS_TOKEN ||
    process.env.META_SYSTEM_USER_TOKEN ||
    process.env.SYSTEM_USER_TOKEN ||
    ""
  );
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}

function getSupabaseKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function getSingleHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getBearerToken(req: VercelRequest) {
  const raw = getSingleHeaderValue(req.headers.authorization);
  const match = raw?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireAdmin(req: VercelRequest) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();
  const accessToken = getBearerToken(req);

  if (!supabaseUrl || !supabaseKey) {
    throw new HttpError(500, "Faltan credenciales de Supabase en el servidor.");
  }

  if (!accessToken) {
    throw new HttpError(401, "Necesitas iniciar sesion para usar sorteos.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    throw new HttpError(401, "Sesion invalida o vencida.");
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });

  if (roleError) {
    throw new HttpError(500, "No se pudo validar el rol admin.");
  }

  if (isAdmin !== true) {
    throw new HttpError(403, "Solo administradores pueden ejecutar sorteos.");
  }

  return userData.user;
}

function buildMetaUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${GRAPH_BASE_URL}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", getAccessToken());
  return url;
}

function formatMetaError(status: number, body: MetaErrorBody | null) {
  const message = body?.error?.message || "Meta no devolvio un error legible.";
  const code = body?.error?.code ? ` Codigo ${body.error.code}.` : "";
  return `Meta API (${status}): ${message}${code}`;
}

async function readJsonResponse<T>(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text();
    throw new HttpError(response.status || 502, `Meta devolvio una respuesta inesperada: ${text.slice(0, 160)}`);
  }

  const body = (await response.json()) as T & MetaErrorBody;
  if (!response.ok || body.error) {
    throw new HttpError(response.status || 502, formatMetaError(response.status, body));
  }

  return body as T;
}

async function metaGet<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new HttpError(503, "Falta configurar META_API en el servidor local o en Vercel.");
  }

  const response = await fetch(buildMetaUrl(path, params).toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "FichasGiveaway/1.0",
    },
  });

  return readJsonResponse<T>(response);
}

async function metaGetAbsolute<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FichasGiveaway/1.0",
    },
  });

  return readJsonResponse<T>(response);
}

function extractInstagramShortcode(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const parts = url.pathname.split("/").filter(Boolean);
    const shortcodeIndex = parts.findIndex((part) => ["p", "reel", "tv"].includes(part.toLowerCase()));
    if (shortcodeIndex >= 0 && parts[shortcodeIndex + 1]) {
      return parts[shortcodeIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}

function extractShortcodeFromPermalink(value?: string | null) {
  if (!value) return null;
  return extractInstagramShortcode(value);
}

function isLikelyMediaId(value: string) {
  return /^\d{8,}$/.test(value.trim());
}

function normalizeUsername(value?: string | null) {
  return (value || "").trim().replace(/^@+/, "").toLowerCase();
}

function displayUsername(value?: string | null) {
  return (value || "").trim().replace(/^@+/, "");
}

function extractUniqueMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g) || [];
  const uniqueMentions = new Set(
    matches.map(m => normalizeUsername(m.slice(1)))
  );
  return Array.from(uniqueMentions);
}

function getConfiguredIgUser() {
  const id =
    process.env.META_IG_USER_ID ||
    process.env.META_INSTAGRAM_USER_ID ||
    process.env.INSTAGRAM_IG_USER_ID ||
    "";
  const username = process.env.META_IG_USERNAME || process.env.INSTAGRAM_USERNAME || "";

  if (!id) return null;
  return {
    id,
    username: displayUsername(username) || undefined,
  };
}

async function resolveIgUserFromPage() {
  const pageId = process.env.META_PAGE_ID || process.env.FACEBOOK_PAGE_ID || "";
  if (!pageId) return null;

  const page = await metaGet<{ instagram_business_account?: { id: string; username?: string } }>(pageId, {
    fields: "instagram_business_account{id,username}",
  });

  if (!page.instagram_business_account?.id) {
    throw new HttpError(
      400,
      "META_PAGE_ID no tiene una cuenta profesional de Instagram conectada o el token no tiene acceso a esa pagina.",
    );
  }

  return {
    id: page.instagram_business_account.id,
    username: displayUsername(page.instagram_business_account.username) || undefined,
  };
}

async function resolveIgUser() {
  const configured = getConfiguredIgUser();
  if (configured) return configured;

  const fromPage = await resolveIgUserFromPage();
  if (fromPage) return fromPage;

  const expectedUsername = normalizeUsername(process.env.META_IG_USERNAME || process.env.INSTAGRAM_USERNAME);

  const accounts = await metaGet<MetaCollection<MetaAccount>>("me/accounts", {
    fields: "name,instagram_business_account{id,username}",
    limit: 50,
  });

  const igAccounts = (accounts.data || [])
    .map((account) => account.instagram_business_account)
    .filter((account): account is { id: string; username?: string } => Boolean(account?.id));

  if (expectedUsername) {
    const match = igAccounts.find((account) => normalizeUsername(account.username) === expectedUsername);
    if (match) return { id: match.id, username: displayUsername(match.username) };
  }

  if (igAccounts[0]) {
    return {
      id: igAccounts[0].id,
      username: displayUsername(igAccounts[0].username) || undefined,
    };
  }

  throw new HttpError(
    400,
    "No pude detectar la cuenta de Instagram conectada al token. Configura META_IG_USER_ID o META_PAGE_ID para resolver posts por URL.",
  );
}

async function getMediaById(mediaId: string) {
  return metaGet<MetaMedia>(mediaId, {
    fields: "id,permalink,caption,comments_count,media_type,timestamp,username",
  });
}

async function checkUserFollowsAccount(userId: string, businessAccountId: string): Promise<boolean> {
  try {
    const response = await metaGet<MetaCollection<{ id: string; username?: string }>>(
      `${businessAccountId}/followers`,
      {
        fields: "id,username",
        limit: 100,
      },
    );

    return (response.data || []).some(
      (follower) =>
        follower.id === userId ||
        normalizeUsername(follower.username) === normalizeUsername(userId),
    );
  } catch {
    return false;
  }
}

async function findMediaByShortcode(shortcode: string) {
  const igUser = await resolveIgUser();
  let nextUrl: string | undefined;
  let pagesRead = 0;

  do {
    const response = nextUrl
      ? await metaGetAbsolute<MetaCollection<MetaMedia>>(nextUrl)
      : await metaGet<MetaCollection<MetaMedia>>(`${igUser.id}/media`, {
          fields: "id,permalink,caption,comments_count,media_type,timestamp,username",
          limit: 100,
        });

    pagesRead += 1;
    const media = response.data || [];
    const match = media.find((item) => extractShortcodeFromPermalink(item.permalink) === shortcode);
    if (match) return match;

    nextUrl = response.paging?.next;
  } while (nextUrl);

  throw new HttpError(
    404,
    `No encontre ese post entre los ultimos medios de @${igUser.username || igUser.id}.`,
  );
}

async function resolveMedia(input: GiveawayRequestBody) {
  const raw = (input.mediaId || input.postUrl || "").trim();
  if (!raw) {
    throw new HttpError(400, "Pega una URL de Instagram o un media ID.");
  }

  if (isLikelyMediaId(raw)) {
    return getMediaById(raw);
  }

  const shortcode = extractInstagramShortcode(raw);
  if (!shortcode) {
    throw new HttpError(400, "La URL de Instagram no parece ser un post, reel o TV valido.");
  }

  return findMediaByShortcode(shortcode);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadComments(
  mediaId: string,
  onProgress?: (progress: GiveawayProgress) => void,
  onComment?: (comment: MetaComment) => void,
  totalComments?: number | null,
) {
  const comments: MetaComment[] = [];
  let nextUrl: string | undefined;
  let pagesRead = 0;

  do {
    const response = nextUrl
      ? await metaGetAbsolute<MetaCollection<MetaComment>>(nextUrl)
      : await metaGet<MetaCollection<MetaComment>>(`${mediaId}/comments`, {
          fields: "id,text,timestamp,username,like_count",
          limit: 100,
          order: "chronological",
        });

    const pageComments = response.data || [];
    for (const comment of pageComments) {
      comments.push(comment);
      onComment?.(comment);
    }

    pagesRead += 1;
    nextUrl = response.paging?.next;
    onProgress?.({
      phase: "loading_comments",
      commentsFetched: comments.length,
      pagesRead,
      totalComments,
      message: "Cargando comentarios",
    });

    // Pequeño delay para evitar rate limiting de Meta
    if (nextUrl) {
      await sleep(50);
    }
  } while (nextUrl);

  return {
    comments,
    maxPagesReached: false,
  };
}

function buildParticipants(
  comments: MetaComment[],
  media: MetaMedia,
  excludedUsernames: string[] = [],
) {
  const excluded = new Set(
    [media.username, ...excludedUsernames]
      .map((username) => normalizeUsername(username))
      .filter(Boolean),
  );

  let excludedComments = 0;
  const uniqueCommenters = new Set<string>();
  const participants: GiveawayParticipant[] = [];
  let entryNumber = 1;

  for (const comment of comments) {
    const username = displayUsername(comment.username);
    const normalizedUsername = normalizeUsername(username || comment.id);

    if (excluded.has(normalizedUsername)) {
      excludedComments += 1;
      continue;
    }

    uniqueCommenters.add(normalizedUsername);

    // Entrada por el comentario original
    participants.push({
      username: username || `comment-${comment.id}`,
      normalizedUsername,
      commentId: comment.id,
      text: comment.text || "",
      timestamp: comment.timestamp || null,
      likeCount: typeof comment.like_count === "number" ? comment.like_count : null,
      entryNumber: entryNumber++,
      type: "comment",
    });

    // Entradas adicionales por menciones únicas en el comentario
    const mentions = extractUniqueMentions(comment.text || "");
    for (const mentionedUsername of mentions) {
      // No incluir si es el mismo que comentó o si está excluido
      if (mentionedUsername !== normalizedUsername && !excluded.has(mentionedUsername)) {
        participants.push({
          username: mentionedUsername,
          normalizedUsername: mentionedUsername,
          commentId: comment.id,
          text: comment.text || "",
          timestamp: comment.timestamp || null,
          likeCount: null,
          entryNumber: entryNumber++,
          type: "mention",
          mentionedBy: username || `comment-${comment.id}`,
        });
      }
    }
  }

  return {
    participants,
    excludedComments,
    uniqueCommenters: uniqueCommenters.size,
  };
}

function buildPostUrl(media: MetaMedia, fallback?: string) {
  if (media.permalink) return media.permalink;
  if (fallback && /^https?:\/\//i.test(fallback)) return fallback;
  return null;
}

async function drawWinner(
  participants: GiveawayParticipant[],
  businessAccountId?: string,
  maxAttempts = 100,
): Promise<GiveawayParticipant | null> {
  const tried = new Set<string>();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const winner = participants[randomInt(participants.length)];
    const winnerId = `${winner.normalizedUsername}-${winner.commentId}`;

    if (tried.has(winnerId)) continue;
    tried.add(winnerId);

    // Validar followers solo si está disponible el businessAccountId
    if (businessAccountId) {
      const follows = await checkUserFollowsAccount(winner.normalizedUsername, businessAccountId);
      if (follows) {
        return winner;
      }
    } else {
      // Si no hay validación de followers, devolver el primer ganador
      return winner;
    }
  }

  return null;
}

async function buildGiveawayPayload(
  body: GiveawayRequestBody,
  onProgress?: (progress: GiveawayProgress) => void,
  onComment?: (comment: MetaComment) => void,
) {
  onProgress?.({
    phase: "resolving_media",
    commentsFetched: 0,
    message: "Resolviendo post",
  });

  const media = await resolveMedia(body);
  const totalComments = typeof media.comments_count === "number" ? media.comments_count : null;

  onProgress?.({
    phase: "loading_comments",
    commentsFetched: 0,
    pagesRead: 0,
    totalComments,
    message: "Cargando comentarios",
  });

  const { comments, maxPagesReached } = await loadComments(media.id, onProgress, onComment, totalComments);
  onProgress?.({
    phase: "finalizing",
    commentsFetched: comments.length,
    totalComments,
    message: "Preparando sorteo",
  });

  const participantData = buildParticipants(comments, media, body.excludedUsernames || []);

  let igUserId: string | undefined;
  try {
    const igUser = await resolveIgUser();
    igUserId = igUser.id;
  } catch {
    // Si no se puede resolver el user, simplemente continuar sin validación de followers
  }

  return {
    media: {
      id: media.id,
      postUrl: buildPostUrl(media, body.postUrl),
      caption: media.caption || null,
      commentsCount: typeof media.comments_count === "number" ? media.comments_count : null,
      mediaType: media.media_type || null,
      timestamp: media.timestamp || null,
      username: media.username || null,
    },
    stats: {
      commentsFetched: comments.length,
      eligibleComments: participantData.participants.length,
      uniqueCommenters: participantData.uniqueCommenters,
      excludedComments: participantData.excludedComments,
      maxCommentPagesReached: maxPagesReached,
    },
    participants: participantData.participants,
    igUserId,
  };
}

function parseBody(req: VercelRequest): GiveawayRequestBody {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as GiveawayRequestBody;
    } catch {
      throw new HttpError(400, "El cuerpo de la solicitud no es JSON valido.");
    }
  }

  return (req.body || {}) as GiveawayRequestBody;
}

function startProgressStream(res: VercelResponse) {
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Accel-Buffering", "no");
  (res as VercelResponse & { flushHeaders?: () => void }).flushHeaders?.();
}

function writeStreamEvent(res: VercelResponse, event: Record<string, unknown>) {
  res.write(`${JSON.stringify(event)}\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdmin(req);

    const body = parseBody(req);
    const action = body.action || "load";
    if (!["load", "draw"].includes(action)) {
      throw new HttpError(400, "Accion invalida. Usa load o draw.");
    }

    if (body.streamProgress) {
      startProgressStream(res);

      try {
        const payload = await buildGiveawayPayload(
          body,
          (progress) => {
            writeStreamEvent(res, {
              type: "progress",
              ...progress,
            });
          },
          (comment) => {
            writeStreamEvent(res, {
              type: "comment",
              id: comment.id,
              username: displayUsername(comment.username),
              text: comment.text || "",
              timestamp: comment.timestamp || null,
              likeCount: comment.like_count || 0,
            });
          },
        );

        if (action === "draw" && payload.participants.length === 0) {
          throw new HttpError(400, "No hay participantes elegibles para sortear.");
        }

        let winner: GiveawayParticipant | null = null;
        if (action === "draw") {
          winner = await drawWinner(payload.participants, payload.igUserId);
          if (!winner) {
            throw new HttpError(
              400,
              "No se pudo encontrar un ganador que siga el perfil de Instagram. Intenta nuevamente.",
            );
          }
        }

        const result = {
          type: "result" as const,
          success: true,
          action,
          media: payload.media,
          stats: payload.stats,
          participants: payload.participants,
          ...(winner ? { winner: { ...winner, drawnAt: new Date().toISOString() } } : {}),
        };

        writeStreamEvent(res, result);
        return res.end();
      } catch (streamError) {
        const status = streamError instanceof HttpError ? streamError.status : 500;
        const message = streamError instanceof Error ? streamError.message : "Error inesperado.";

        console.error("Stream error:", message, streamError);
        writeStreamEvent(res, {
          type: "error",
          success: false,
          status,
          error: message,
        });
        return res.end();
      }
    }

    const payload = await buildGiveawayPayload(body);

    if (action === "draw") {
      if (payload.participants.length === 0) {
        throw new HttpError(400, "No hay participantes elegibles para sortear.");
      }

      const winner = await drawWinner(payload.participants, payload.igUserId);
      if (!winner) {
        throw new HttpError(
          400,
          "No se pudo encontrar un ganador que siga el perfil de Instagram. Intenta nuevamente.",
        );
      }

      return res.status(200).json({
        success: true,
        action,
        ...payload,
        winner: {
          ...winner,
          drawnAt: new Date().toISOString(),
        },
      });
    }

    return res.status(200).json({
      success: true,
      action,
      ...payload,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error inesperado.";

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
}
