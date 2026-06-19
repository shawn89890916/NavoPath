import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

interface Env {
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

    this.server.registerTool("update_task", { description: "Update safe task fields.", inputSchema: { taskId: z.string(), patch: z.object({ title: z.string().trim().min(1).max(300).optional(), projectId: z.string().nullable().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes: z.string().max(10000).optional(), completed: z.boolean().optional() }) } }, async ({ taskId, patch }) => {
      const profile = await getProfile(this.env, this.userId());
      const tasks = profile.data.tasks || [];
      const index = tasks.findIndex((task: Json) => task.id === taskId);
      if (index < 0) throw new Error("Task not found");
      const next = { ...tasks[index], ...patch, projectId: patch.projectId === null ? undefined : patch.projectId ?? tasks[index].projectId, updatedAt: now() };
      await saveProfile(this.env, this.userId(), profile, { data: { ...profile.data, tasks: tasks.map((task: Json, i: number) => i === index ? next : task), events: [] } });
      return result(next);
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
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    const userId = await authenticate(request, env);
    if (!userId) return new Response(JSON.stringify({ error: "Invalid or revoked bearer token" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": "Bearer" } });
    (ctx as ExecutionContext & { props?: AgentProps }).props = { userId };
    return mcpHandler.fetch(request, env, ctx);
  },
};
