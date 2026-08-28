import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { buildCalendarFeed } from "./calendarFeed";
import {
  batchUpdateTasks,
  confirmChange,
  configureCloudAssistant,
  getActivityHistory,
  getChangesSince,
  ingestWorkspaceEvent,
  processAssistantMessage,
  scheduleCloudRuns,
  sendNotification,
  undoChange,
  verifyWebhookSignature,
  type AssistantMessage,
  type CloudAssistantEnv,
} from "./cloudAssistant";

interface Env extends CloudAssistantEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MCP_SERVER_NAME: string;
  MCP_OBJECT: DurableObjectNamespace<NavoPathMCP>;
}

type Json = Record<string, any>;
type Profile = { data: Json; settings: Json; revision: number };
type AgentProps = { userId: string };

const allowedSettings = ["language", "defaultTimelineView", "planningView", "theme", "typographyStyle", "executeAccentColor", "planningAccentColor", "hideCompleted", "taskNoteDisplay", "aiTone", "aiMemoryEnabled", "hideAi", "model", "reasoningMode"];
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());

async function db(env: Env, path: string, init?: RequestInit) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(init?.headers || {}) },
  });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticate(request: Request, env: Env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("nvp_")) return null;
  const query = await db(env, `navopath_mcp_tokens?select=id,user_id&token_hash=eq.${await sha256(token)}&revoked_at=is.null&limit=1`);
  if (!query.ok) return null;
  const match = (await query.json() as Array<{ id: string; user_id: string }>)[0];
  if (!match) return null;
  void db(env, `navopath_mcp_tokens?id=eq.${match.id}`, { method: "PATCH", body: JSON.stringify({ last_used_at: now() }) });
  return { userId: match.user_id, token };
}

async function authenticateCalendarToken(token: string, env: Env, ctx: ExecutionContext) {
  if (!/^nvc_[a-f0-9]{64}$/.test(token)) return null;
  const query = await db(env, `navopath_calendar_tokens?select=id,user_id&token_hash=eq.${await sha256(token)}&revoked_at=is.null&limit=1`);
  if (!query.ok) return null;
  const match = (await query.json() as Array<{ id: string; user_id: string }>)[0];
  if (!match) return null;
  ctx.waitUntil(db(env, `navopath_calendar_tokens?id=eq.${match.id}`, { method: "PATCH", body: JSON.stringify({ last_used_at: now() }) }));
  return match.user_id;
}

async function getProfile(env: Env, userId: string): Promise<Profile> {
  const response = await db(env, `dayflow_profiles?select=data,settings,revision&user_id=eq.${userId}&limit=1`);
  const rows = await response.json() as Profile[];
  if (!response.ok || !rows[0]) throw new Error("Workspace not found");
  return rows[0];
}

async function saveProfile(env: Env, userId: string, profile: Profile, patch: Partial<Profile>) {
  const response = await db(env, "rpc/save_dayflow_profile_as_service", {
    method: "POST",
    body: JSON.stringify({ target_user_id: userId, expected_revision: profile.revision, next_data: patch.data || profile.data, next_settings: patch.settings || profile.settings }),
  });
  const rows = await response.json() as Profile[] | { message?: string };
  if (!response.ok || !Array.isArray(rows) || !rows[0]) throw new Error(!Array.isArray(rows) && rows.message ? rows.message : "Workspace changed concurrently; retry");
  return rows[0];
}

export class NavoPathMCP extends McpAgent<Env, unknown, AgentProps> {
  server = new McpServer({ name: "NavoPath", version: "2.0.0" });

  private userId() {
    if (!this.props?.userId) throw new Error("Authentication context missing");
    return this.props.userId;
  }

  async init() {
    this.server.registerTool("get_workspace_summary", { description: "Return project and task counts.", inputSchema: {} }, async () => {
      const { data } = await getProfile(this.env, this.userId());
      const tasks = data.tasks || [];
      return result({ projects: (data.projects || []).length, openTasks: tasks.filter((task: Json) => !task.completed).length, completedTasks: tasks.filter((task: Json) => task.completed).length });
    });

    this.server.registerTool("list_projects", { description: "List projects in display order.", inputSchema: {} }, async () => {
      const { data } = await getProfile(this.env, this.userId());
      return result([...(data.projects || [])].sort((a: Json, b: Json) => Number(a.order || 0) - Number(b.order || 0)));
    });

    this.server.registerTool("list_tasks", { description: "List tasks with optional project and completion filters.", inputSchema: { projectId: z.string().optional(), completed: z.boolean().optional() } }, async ({ projectId, completed }) => {
      const { data } = await getProfile(this.env, this.userId());
      return result((data.tasks || []).filter((task: Json) => (!projectId || task.projectId === projectId) && (completed === undefined || Boolean(task.completed) === completed)));
    });

    this.server.registerTool("list_calendar", { description: "List scheduled task blocks in an inclusive date range.", inputSchema: { from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) } }, async ({ from, to }) => {
      const { data } = await getProfile(this.env, this.userId());
      const blocks = (data.tasks || []).flatMap((task: Json) =>
        (task.timelineRecords || [])
          .filter((record: Json) => record.scheduledDate >= from && record.scheduledDate <= to)
          .map((record: Json) => ({ taskId: task.id, title: task.title, projectId: task.projectId, ...record })),
      );
      return result(blocks);
    });

    this.server.registerTool("get_settings", { description: "Read safe display, AI, and planning settings.", inputSchema: {} }, async () => {
      const { settings } = await getProfile(this.env, this.userId());
      return result(Object.fromEntries(allowedSettings.map((key) => [key, settings[key]])));
    });

    this.server.registerTool("update_settings", { description: "Update allowlisted settings.", inputSchema: { patch: z.record(z.string(), z.unknown()) } }, async ({ patch }) => {
      const profile = await getProfile(this.env, this.userId());
      const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => allowedSettings.includes(key)));
      const saved = await saveProfile(this.env, this.userId(), profile, { settings: { ...profile.settings, ...safePatch } });
      return result(Object.fromEntries(allowedSettings.map((key) => [key, saved.settings[key]])));
    });

    this.server.registerTool("create_project", { description: "Create a project.", inputSchema: { title: z.string().trim().min(1).max(200), notes: z.string().max(5000).optional() } }, async ({ title, notes }) => {
      const profile = await getProfile(this.env, this.userId());
      const projects = profile.data.projects || [];
      const item = { id: uid("project"), title, category: "project", notes: notes || "", completed: false, order: projects.length, createdAt: now(), updatedAt: now() };
      await saveProfile(this.env, this.userId(), profile, { data: { ...profile.data, projects: [...projects, item], events: [] } });
      return result(item);
    });

    this.server.registerTool("create_task", { description: "Create a task and optionally schedule it.", inputSchema: { title: z.string().trim().min(1).max(300), projectId: z.string().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), durationMinutes: z.number().int().min(15).max(1440).default(30), notes: z.string().max(10000).optional() } }, async ({ title, projectId, dueDate, startTime, durationMinutes, notes }) => {
      const profile = await getProfile(this.env, this.userId());
      const date = dueDate || today();
      const id = uid("task");
      const endMinutes = startTime ? Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)) + durationMinutes : 0;
      const endTime = startTime ? `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}` : undefined;
      const item: Json = { id, title, projectId, dueDate: date, category: "personal", priority: "medium", notes: notes || "", goalId: "", completed: false, estimatedHours: durationMinutes / 60, order: Date.now(), createdAt: now(), updatedAt: now(), subtasks: [] };
      if (startTime && endTime) item.timelineRecords = [{ id: uid("record"), taskId: id, scheduledDate: date, scheduledStart: startTime, scheduledEnd: endTime, executionStatus: "scheduled", createdAt: now() }];
      await saveProfile(this.env, this.userId(), profile, { data: { ...profile.data, tasks: [...(profile.data.tasks || []), item], events: [] } });
      return result(item);
    });

    this.server.registerTool("update_task", { description: "Update safe task fields, including user-controlled cloud schedule and hard-deadline locks.", inputSchema: { taskId: z.string(), patch: z.object({ title: z.string().trim().min(1).max(300).optional(), projectId: z.string().nullable().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes: z.string().max(10000).optional(), completed: z.boolean().optional(), scheduleLocked: z.boolean().optional(), hardDeadline: z.boolean().optional() }) } }, async ({ taskId, patch }) => {
      const profile = await getProfile(this.env, this.userId());
      const tasks = profile.data.tasks || [];
      const index = tasks.findIndex((task: Json) => task.id === taskId);
      if (index < 0) throw new Error("Task not found");
      const next = { ...tasks[index], ...patch, projectId: patch.projectId === null ? undefined : patch.projectId ?? tasks[index].projectId, updatedAt: now() };
      await saveProfile(this.env, this.userId(), profile, { data: { ...profile.data, tasks: tasks.map((task: Json, i: number) => i === index ? next : task), events: [] } });
      return result(next);
    });

    this.server.registerTool("get_changes_since", { description: "Return audited NavoPath changes after a monotonic cursor.", inputSchema: { cursor: z.number().int().nonnegative().default(0) } }, async ({ cursor }) => {
      return result(await getChangesSince(this.env, this.userId(), cursor));
    });

    this.server.registerTool("reschedule_task", { description: "Move or create the active schedule block for a task with conflict checks, audit, idempotency, and undo.", inputSchema: { taskId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), durationMinutes: z.number().int().min(15).max(1440), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), idempotency_key: z.string().min(8).max(240), reason: z.string().max(500).optional() } }, async ({ taskId, startTime, durationMinutes, date, idempotency_key, reason }) => {
      return result(await batchUpdateTasks(this.env, this.userId(), { operations: [{ type: "reschedule_task", taskId, startTime, durationMinutes, date, reason }], dryRun: false, commit: true, idempotencyKey: idempotency_key, source: "mcp", summary: "Rescheduled task", reason }));
    });

    this.server.registerTool("upsert_schedule_block", { description: "Create or update one schedule block with conflict checks, audit, idempotency, and undo.", inputSchema: { taskId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/), blockId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/).optional(), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), durationMinutes: z.number().int().min(15).max(1440), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), idempotency_key: z.string().min(8).max(240), reason: z.string().max(500).optional() } }, async ({ taskId, blockId, startTime, durationMinutes, date, idempotency_key, reason }) => {
      return result(await batchUpdateTasks(this.env, this.userId(), { operations: [{ type: "upsert_schedule_block", taskId, blockId, startTime, durationMinutes, date, reason }], dryRun: false, commit: true, idempotencyKey: idempotency_key, source: "mcp", summary: "Upserted schedule block", reason }));
    });

    const batchOperation = z.object({
      type: z.enum(["create_task", "update_task", "split_task", "reschedule_task", "upsert_schedule_block"]),
      taskId: z.string().optional(), blockId: z.string().optional(), title: z.string().optional(), projectId: z.string().nullable().optional(), dueDate: z.string().optional(), startTime: z.string().optional(), durationMinutes: z.number().optional(), notes: z.string().optional(), patch: z.record(z.string(), z.unknown()).optional(), subtasks: z.array(z.object({ title: z.string(), estimateMinutes: z.number().optional() })).optional(), reason: z.string().optional(),
    });
    this.server.registerTool("batch_update_tasks", { description: "Preview or atomically commit a validated batch of task changes. Every committed batch is idempotent, audited, and undoable.", inputSchema: { operations: z.array(batchOperation).min(1).max(30), dry_run: z.boolean(), commit: z.boolean(), idempotency_key: z.string().min(8).max(240), summary: z.string().max(1200).optional(), reason: z.string().max(1200).optional() } }, async ({ operations, dry_run, commit, idempotency_key, summary, reason }) => {
      return result(await batchUpdateTasks(this.env, this.userId(), { operations, dryRun: dry_run, commit, idempotencyKey: idempotency_key, source: "mcp", summary, reason }));
    });

    this.server.registerTool("get_activity_history", { description: "Return recent audited cloud and MCP change sets.", inputSchema: { limit: z.number().int().min(1).max(100).default(30) } }, async ({ limit }) => {
      return result(await getActivityHistory(this.env, this.userId(), limit));
    });

    this.server.registerTool("undo_change", { description: "Undo an eligible change set if no later workspace revision has superseded it.", inputSchema: { changeSetId: z.string().uuid() } }, async ({ changeSetId }) => {
      return result(await undoChange(this.env, this.userId(), changeSetId));
    });

    this.server.registerTool("confirm_change", { description: "Explicitly approve one pending protected schedule or hard-deadline change. Confirmation fails if the workspace changed after the proposal.", inputSchema: { changeSetId: z.string().uuid() } }, async ({ changeSetId }) => {
      return result(await confirmChange(this.env, this.userId(), changeSetId));
    });

    this.server.registerTool("ingest_workspace_event", { description: "Ingest an incremental workspace change event. Duplicate dedupe_key values are ignored and only bounded excerpts are accepted.", inputSchema: { changed_files: z.array(z.union([z.string().max(500), z.object({ path: z.string().max(500), change_type: z.string().max(32).optional(), content_hash: z.string().max(128).optional() })])).max(100), fragments: z.array(z.object({ path: z.string().max(500), excerpt: z.string().max(4000), content_hash: z.string().max(128).optional() })).max(20).optional(), summary: z.string().max(4000), schedule_impact: z.string().max(2000), timestamp: z.string().max(64), dedupe_key: z.string().min(8).max(200) } }, async (payload) => {
      return result(await ingestWorkspaceEvent(this.env, this.userId(), payload));
    });

    this.server.registerTool("send_notification", { description: "Queue an in-app notification and optional email, respecting quiet hours except urgent deadline risk.", inputSchema: { kind: z.enum(["summary", "material_change", "deadline_risk", "weather", "needs_input"]), title: z.string().min(1).max(160), body: z.string().min(1).max(2000), urgency: z.enum(["normal", "urgent"]).default("normal"), idempotency_key: z.string().min(8).max(240) } }, async (payload) => {
      return result(await sendNotification(this.env, this.userId(), payload));
    });

    this.server.registerTool("configure_cloud_assistant", { description: "Opt the current account into or out of the 08:30/20:30 Asia/Shanghai cloud assistant and optional email delivery.", inputSchema: { enabled: z.boolean(), email_enabled: z.boolean().default(false) } }, async ({ enabled, email_enabled }) => {
      return result(await configureCloudAssistant(this.env, this.userId(), enabled, email_enabled));
    });

    this.server.registerTool("delete_task", { description: "Delete a task.", inputSchema: { taskId: z.string() } }, async ({ taskId }) => {
      const profile = await getProfile(this.env, this.userId());
      const tasks = profile.data.tasks || [];
      if (!tasks.some((task: Json) => task.id === taskId)) throw new Error("Task not found");
      const deleted = { ...(profile.data.sync?.deleted || {}), [`tasks:${taskId}`]: now() };
      await saveProfile(this.env, this.userId(), profile, { data: { ...profile.data, tasks: tasks.filter((task: Json) => task.id !== taskId), events: [], sync: { deleted } } });
      return result({ deleted: taskId });
    });
  }
}

const mcpHandler = NavoPathMCP.serve("/mcp", { binding: "MCP_OBJECT", transport: "streamable-http" });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response(JSON.stringify({ name: env.MCP_SERVER_NAME, endpoint: "/mcp", transport: "streamable-http", version: "2.0.0" }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    const calendarMatch = url.pathname.match(/^\/calendar\/(nvc_[a-f0-9]{64})\.ics$/);
    if (calendarMatch) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      const userId = await authenticateCalendarToken(calendarMatch[1], env, ctx);
      if (!userId) return new Response("Calendar subscription not found", { status: 404, headers: { "cache-control": "no-store" } });
      const profile = await getProfile(env, userId);
      const etag = `W/\"navopath-calendar-${profile.revision}\"`;
      const headers = {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": "inline; filename=navopath.ics",
        "cache-control": "private, max-age=300, no-transform",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        etag,
      };
      if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
      return new Response(request.method === "HEAD" ? null : buildCalendarFeed(profile.data), { headers });
    }
    if (url.pathname === "/api/workspace-events") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > 64_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { "content-type": "application/json" } });
      const auth = await authenticate(request, env);
      if (!auth) return new Response(JSON.stringify({ error: "Invalid or revoked bearer token" }), { status: 401, headers: { "content-type": "application/json" } });
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 64_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { "content-type": "application/json" } });
      if (!await verifyWebhookSignature(request.headers.get("x-navopath-timestamp") || "", request.headers.get("x-navopath-signature") || "", rawBody, auth.token)) return new Response(JSON.stringify({ error: "Invalid or stale webhook signature" }), { status: 401, headers: { "content-type": "application/json" } });
      try {
        return new Response(JSON.stringify(await ingestWorkspaceEvent(env, auth.userId, JSON.parse(rawBody))), { status: 202, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid workspace event" }), { status: 400, headers: { "content-type": "application/json" } });
      }
    }
    if (url.pathname === "/api/notifications") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
      const auth = await authenticate(request, env);
      if (!auth) return new Response(JSON.stringify({ error: "Invalid or revoked bearer token" }), { status: 401, headers: { "content-type": "application/json" } });
      const response = await db(env, `navopath_notifications?select=id,kind,title,body,urgency,status,deliver_after,sent_at,read_at,metadata,created_at&user_id=eq.${auth.userId}&deliver_after=lte.${encodeURIComponent(now())}&order=created_at.desc&limit=50`);
      return new Response(await response.text(), { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    const auth = await authenticate(request, env);
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or revoked bearer token" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": "Bearer" } });
    (ctx as ExecutionContext & { props?: AgentProps }).props = { userId: auth.userId };
    return mcpHandler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const trigger = controller.cron === "30 0 * * *" ? "morning" : controller.cron === "30 12 * * *" ? "evening" : null;
    if (!trigger) return;
    ctx.waitUntil(scheduleCloudRuns(env, trigger).then((count) => console.log("Scheduled NavoPath cloud assistants", { trigger, count })));
  },
  async queue(batch: MessageBatch<AssistantMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        await processAssistantMessage(env, message.body);
        message.ack();
      } catch (error) {
        console.error("Cloud assistant job failed", { trigger: message.body.trigger, error: error instanceof Error ? error.message : "unknown" });
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
