import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseIcsOccurrences } from "./ics.ts";
import { assertPublicCalendarHost, validateCalendarUrl } from "./security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const MAX_SOURCES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function safeCalendarError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/exceeds 5 MB/i.test(message)) return "Calendar feed exceeds 5 MB";
  if (/redirect limit/i.test(message)) return "Calendar redirect limit exceeded";
  if (/request failed \(\d{3}\)/i.test(message)) return message.match(/Calendar request failed \(\d{3}\)/i)?.[0] || "Calendar request failed";
  if (/encryption is not configured/i.test(message)) return "ICS encryption is not configured";
  if (/authentication required/i.test(message)) return "Authentication required";
  if (/malformed|invalid calendar|invalid ics|parse/i.test(message)) return "Calendar feed is invalid";
  if (/abort|timed? out|timeout/i.test(message)) return "Calendar request timed out";
  if (/https|port 443|private|loopback|link-local|public address|dns resolution/i.test(message)) return "Calendar address is not permitted";
  return "Calendar sync failed";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value: string) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function encryptionKey() {
  const secret = Deno.env.get("ICS_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) throw new Error("ICS encryption is not configured");
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptUrl(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptUrl(ciphertext: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(ciphertext));
  return new TextDecoder().decode(decrypted);
}

async function fetchCalendar(rawUrl: string, conditional: { etag?: string; lastModified?: string } = {}) {
  let url = validateCalendarUrl(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicCalendarHost(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const result = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/calendar,text/plain;q=0.8",
          ...(conditional.etag ? { "if-none-match": conditional.etag } : {}),
          ...(conditional.lastModified ? { "if-modified-since": conditional.lastModified } : {}),
        },
      });
      if (result.status === 304) return { notModified: true as const, etag: conditional.etag, lastModified: conditional.lastModified };
      if (result.status >= 300 && result.status < 400) {
        const location = result.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) throw new Error("Calendar redirect limit exceeded");
        url = validateCalendarUrl(new URL(location, url).toString());
        continue;
      }
      if (!result.ok || !result.body) throw new Error(`Calendar request failed (${result.status})`);
      const declared = Number(result.headers.get("content-length"));
      if (declared > MAX_BYTES) throw new Error("Calendar feed exceeds 5 MB");
      const reader = result.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error("Calendar feed exceeds 5 MB");
        }
        chunks.push(value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      return { notModified: false as const, text: new TextDecoder().decode(body), etag: result.headers.get("etag") || undefined, lastModified: result.headers.get("last-modified") || undefined };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Calendar redirect limit exceeded");
}

function syncWindow() {
  const after = new Date();
  after.setUTCDate(after.getUTCDate() - 30);
  after.setUTCHours(0, 0, 0, 0);
  const before = new Date();
  before.setUTCDate(before.getUTCDate() + 365);
  before.setUTCHours(23, 59, 59, 999);
  return { after, before };
}

function publicSource(row: Record<string, any>) {
  return { id: row.id, name: row.name, displayUrl: row.display_url, color: row.color || undefined, enabled: row.enabled, syncStatus: row.sync_status, syncError: row.sync_error || undefined, lastSyncedAt: row.last_synced_at || undefined, nextSyncAt: row.next_sync_at || undefined };
}

async function replaceOccurrences(admin: ReturnType<typeof createClient>, userId: string, sourceId: string, occurrences: Awaited<ReturnType<typeof parseIcsOccurrences>>) {
  const { error: deleteError } = await admin.from("navopath_calendar_occurrences").delete().eq("source_id", sourceId).eq("user_id", userId);
  if (deleteError) throw deleteError;
  for (let offset = 0; offset < occurrences.length; offset += 500) {
    const batch = occurrences.slice(offset, offset + 500).map((occurrence) => ({ ...occurrence, user_id: userId, source_id: sourceId }));
    const { error } = await admin.from("navopath_calendar_occurrences").insert(batch);
    if (error) throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("authorization") || "";
    const envJsonKey = (name: string, key = "default") => {
      try { const value = Deno.env.get(name); return value ? JSON.parse(value)?.[key] || "" : ""; } catch { return ""; }
    };
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || envJsonKey("SUPABASE_PUBLISHABLE_KEYS");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || envJsonKey("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !anonKey || !serviceKey) return response({ error: "Calendar service is not configured" }, 503);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return response({ error: "Authentication required" }, 401);
    const userId = authData.user.id;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json() as Record<string, any>;
    const op = typeof body.op === "string" ? body.op : "list";

    if (op === "list") {
      const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from || "") ? body.from : new Date().toISOString().slice(0, 10);
      const fallbackTo = new Date(`${from}T00:00:00Z`); fallbackTo.setUTCDate(fallbackTo.getUTCDate() + 31);
      const to = /^\d{4}-\d{2}-\d{2}$/.test(body.to || "") ? body.to : fallbackTo.toISOString().slice(0, 10);
      const [{ data: sourceRows, error: sourceError }, { data: occurrenceRows, error: occurrenceError }] = await Promise.all([
        admin.from("navopath_calendar_sources").select("id,name,display_url,color,enabled,sync_status,sync_error,last_synced_at,next_sync_at").eq("user_id", userId).order("created_at"),
        admin.from("navopath_calendar_occurrences").select("id,source_id,external_uid,title,description,location,start_at,end_at,start_date,end_date,all_day,status").eq("user_id", userId).lte("start_date", to).gte("end_date", from).order("start_at").limit(5000),
      ]);
      if (sourceError) throw sourceError;
      if (occurrenceError) throw occurrenceError;
      return response({ ok: true, sources: (sourceRows || []).map(publicSource), occurrences: occurrenceRows || [] });
    }

    if (op === "connect") {
      const name = String(body.name || "").trim().slice(0, 120);
      const rawUrl = validateCalendarUrl(String(body.url || "")).toString();
      if (!name) return response({ error: "Calendar name is required" }, 400);
      const { count } = await admin.from("navopath_calendar_sources").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if ((count || 0) >= MAX_SOURCES) return response({ error: "Up to 10 external calendars are supported" }, 400);
      const fetched = await fetchCalendar(rawUrl);
      if (fetched.notModified) throw new Error("Calendar returned no content");
      const { after, before } = syncWindow();
      const occurrences = await parseIcsOccurrences(fetched.text, after, before);
      const encrypted = await encryptUrl(rawUrl);
      const host = new URL(rawUrl).hostname;
      const { data: source, error } = await admin.from("navopath_calendar_sources").insert({ user_id: userId, name, url_ciphertext: encrypted.ciphertext, url_iv: encrypted.iv, url_hash: await digest(rawUrl), display_url: `https://${host}/…`, color: typeof body.color === "string" ? body.color.slice(0, 64) : null, etag: fetched.etag, last_modified: fetched.lastModified, sync_status: "ready", sync_error: null, last_synced_at: new Date().toISOString(), next_sync_at: new Date(Date.now() + 15 * 60_000).toISOString() }).select().single();
      if (error) throw error;
      await replaceOccurrences(admin, userId, source.id, occurrences);
      return response({ ok: true, source: publicSource(source), occurrenceCount: occurrences.length });
    }

    if (op === "remove") {
      const { error } = await admin.from("navopath_calendar_sources").delete().eq("id", String(body.sourceId || "")).eq("user_id", userId);
      if (error) throw error;
      return response({ ok: true });
    }

    if (op === "refresh") {
      const { data: source, error } = await admin.from("navopath_calendar_sources").select("*").eq("id", String(body.sourceId || "")).eq("user_id", userId).single();
      if (error || !source) return response({ error: "Calendar source not found" }, 404);
      if (!body.force && source.next_sync_at && source.next_sync_at > new Date().toISOString()) return response({ ok: true, source: publicSource(source), skipped: true });
      try {
        const rawUrl = await decryptUrl(source.url_ciphertext, source.url_iv);
        const fetched = await fetchCalendar(rawUrl, { etag: source.etag, lastModified: source.last_modified });
        if (!fetched.notModified) {
          const { after, before } = syncWindow();
          await replaceOccurrences(admin, userId, source.id, await parseIcsOccurrences(fetched.text, after, before));
        }
        const { data: updated, error: updateError } = await admin.from("navopath_calendar_sources").update({ etag: fetched.etag, last_modified: fetched.lastModified, sync_status: "ready", sync_error: null, last_synced_at: new Date().toISOString(), next_sync_at: new Date(Date.now() + 15 * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", source.id).eq("user_id", userId).select().single();
        if (updateError) throw updateError;
        return response({ ok: true, source: publicSource(updated), notModified: fetched.notModified });
      } catch (error) {
        await admin.from("navopath_calendar_sources").update({ sync_status: "error", sync_error: safeCalendarError(error), next_sync_at: new Date(Date.now() + 15 * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", source.id).eq("user_id", userId);
        throw error;
      }
    }

    return response({ error: "Unknown operation" }, 400);
  } catch (error) {
    const publicMessage = safeCalendarError(error);
    console.error("External calendar error", { code: publicMessage, name: error instanceof Error ? error.name : "unknown" });
    return response({ error: publicMessage }, publicMessage === "Calendar address is not permitted" ? 400 : 500);
  }
});
