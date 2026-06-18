import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const RECENT_HISTORY_LIMIT = 12;
const MAX_MESSAGE_CHARS = 2000;
const N8N_TIMEOUT_MS = 25_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SupportChatRequestPayload {
  threadId?: unknown;
  visitorToken?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  pageUrl?: unknown;
  timestamp?: unknown;
}

interface SupportThreadRow {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: "open" | "closed";
}

interface SupportMessageRow {
  sender_type: "visitor" | "staff";
  sender_name: string | null;
  body: string;
  created_at: string;
}

function parseJsonBody(body: unknown): SupportChatRequestPayload {
  if (typeof body === "string") {
    if (!body.trim()) return {};
    const parsed = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null ? (parsed as SupportChatRequestPayload) : {};
  }

  if (typeof body === "object" && body !== null) {
    return body as SupportChatRequestPayload;
  }

  return {};
}

function getCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const clean = getCleanString(value);
  return clean || null;
}

function isUuid(value: string) {
  return UUID_RE.test(value);
}

function getWebhookUrl() {
  return process.env.N8N_SUPPORT_CHAT_WEBHOOK_URL?.trim() || "";
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeHistory(rows: SupportMessageRow[] | null) {
  return (rows ?? [])
    .slice()
    .reverse()
    .map((message) => ({
      role: message.sender_type === "visitor" ? "customer" : "support",
      name: message.sender_name,
      message: message.body,
      createdAt: message.created_at,
    }));
}

function extractReply(payload: unknown): string | null {
  if (typeof payload === "string") {
    const clean = payload.trim();
    return clean || null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const reply = extractReply(item);
      if (reply) return reply;
    }
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;

  const record = payload as Record<string, unknown>;
  const directKeys = ["reply", "message", "text", "response", "answer", "output"];

  for (const key of directKeys) {
    const reply = extractReply(record[key]);
    if (reply) return reply;
  }

  for (const key of ["body", "data", "result"]) {
    const reply = extractReply(record[key]);
    if (reply) return reply;
  }

  return null;
}

async function callN8n(webhookUrl: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "Content-Type": "application/json",
        "User-Agent": "FichasOnlineSupportChat/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    const contentType = response.headers.get("content-type") || "";
    let responsePayload: unknown = rawText;

    if (contentType.toLowerCase().includes("application/json") && rawText.trim()) {
      try {
        responsePayload = JSON.parse(rawText);
      } catch {
        responsePayload = rawText;
      }
    }

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: extractReply(responsePayload) || `n8n responded with ${response.status}`,
      };
    }

    return {
      ok: true as const,
      reply: extractReply(responsePayload),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return res.status(503).json({ error: "N8N_SUPPORT_CHAT_WEBHOOK_URL is not configured" });
  }

  let body: SupportChatRequestPayload;
  try {
    body = parseJsonBody(req.body);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const threadId = getCleanString(body.threadId);
  const visitorToken = getCleanString(body.visitorToken);
  const message = getCleanString(body.message).slice(0, MAX_MESSAGE_CHARS);

  if (!isUuid(threadId) || !isUuid(visitorToken)) {
    return res.status(400).json({ error: "Invalid chat session" });
  }

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    return res.status(503).json({
      error: error instanceof Error ? error.message : "Supabase is not configured",
    });
  }

  const { data: thread, error: threadError } = await supabase
    .from("support_threads")
    .select("id, visitor_name, visitor_email, visitor_phone, status")
    .eq("id", threadId)
    .eq("visitor_token", visitorToken)
    .maybeSingle<SupportThreadRow>();

  if (threadError) {
    return res.status(500).json({ error: "Failed to verify chat session", details: threadError.message });
  }

  if (!thread) {
    return res.status(404).json({ error: "Chat session not found" });
  }

  if (thread.status !== "open") {
    return res.status(409).json({ error: "Chat session is closed" });
  }

  const { data: recentMessages } = await supabase
    .from("support_messages")
    .select("sender_type, sender_name, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(RECENT_HISTORY_LIMIT)
    .returns<SupportMessageRow[]>();

  let n8nResult: Awaited<ReturnType<typeof callN8n>>;
  try {
    n8nResult = await callN8n(webhookUrl, {
      source: "fichasonline_home_chat",
      threadId,
      contact: {
        name: getOptionalString(body.name) || thread.visitor_name,
        email: getOptionalString(body.email) || thread.visitor_email,
        phone: getOptionalString(body.phone) || thread.visitor_phone,
      },
      message,
      pageUrl: getOptionalString(body.pageUrl),
      timestamp: getOptionalString(body.timestamp) || new Date().toISOString(),
      history: normalizeHistory(recentMessages ?? null),
    });
  } catch (error) {
    return res.status(502).json({
      error: "n8n failed to process support chat message",
      details: error instanceof Error ? error.message : "Unexpected n8n request failure",
    });
  }

  if (!n8nResult.ok) {
    return res.status(502).json({
      error: "n8n failed to process support chat message",
      status: n8nResult.status,
      details: n8nResult.error,
    });
  }

  const reply = n8nResult.reply?.trim();
  if (!reply) {
    return res.status(502).json({ error: "n8n did not return a reply" });
  }

  const { data: insertedMessage, error: insertError } = await supabase
    .from("support_messages")
    .insert({
      thread_id: threadId,
      sender_type: "staff",
      sender_user_id: null,
      sender_name: "Fichas Online",
      body: reply.slice(0, MAX_MESSAGE_CHARS),
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    return res.status(500).json({
      error: "n8n replied, but we could not save the support message",
      details: insertError.message,
    });
  }

  return res.status(200).json({
    reply,
    messageId: insertedMessage?.id ?? null,
    createdAt: insertedMessage?.created_at ?? null,
  });
}
