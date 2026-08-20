// Frontend wrapper for the server-managed NavoPath AI gateway.
// Provider credentials never enter the renderer process.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localIsoDate } from "./utils/localDate";
import { filterAiModels } from "./utils/aiModels";
import type { AgentRunState } from "./types";

export type AiMode = "health" | "agent" | "agent_confirm" | "agent_reject" | "agent_undo" | "chat" | "suggest_subtasks" | "parse_task" | "plan_day" | "plan_schedule" | "enrich_task" | "import_schedule" | "summarize_memory";
export type AiStep = { label: string; status: "pending" | "running" | "done" | "error" };
export type AiChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type AiMemoryPatch = { content: string; tags?: string[] };

export type AiAction =
  | { type: "create_subtasks"; taskId?: string; projectId?: string; subtasks?: { title: string; estimateMinutes?: number }[]; reason?: string }
  | { type: "create_task"; title?: string; projectId?: string; date?: string; start?: string; end?: string; durationMinutes?: number; reason?: string }
  | { type: "schedule_task"; taskId?: string; date?: string; start?: string; end?: string; reason?: string }
  | { type: "create_scheduled_task"; title?: string; projectId?: string; projectName?: string; date?: string; start?: string; end?: string; durationMinutes?: number; reason?: string }
  | { type: "plan_day"; reason?: string }
  | { type: "none"; reason?: string }
  | {
      type: "import_schedule_item";
      kind?: "task" | "event";
      title?: string;
      date?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
      category?: string;
      priority?: string;
      projectId?: string;
      projectName?: string;
      notes?: string;
      recurrence?: {
        mode?: "flexible" | "scheduled";
        frequency?: "none" | "daily" | "weekdays" | "weekends" | "weekly" | "biweekly" | "monthly" | "quarterly";
        startDate?: string;
        startTime?: string;
        durationMinutes?: number;
        endDate?: string;
        count?: number;
      };
      warning?: string;
    };

export type AiPlanBlock = { taskId?: string; title: string; start: string; end: string; durationMinutes?: number; reason?: string };
export type AiServiceError = {
  code: "AI_NOT_CONFIGURED" | "AI_AUTH" | "AI_RATE_LIMIT" | "AI_TIMEOUT" | "AI_CANCELLED" | "AI_PROVIDER" | "AI_NETWORK" | "AI_BAD_RESPONSE" | "AI_PLAN_EXPIRED";
  retryable: boolean;
  requestId?: string;
  message: string;
};

type AiAssistantPayload = {
  reply: string;
  actions: AiAction[];
  steps?: AiStep[];
  memories?: AiMemoryPatch[];
  intent?: string;
  plan?: AiPlanBlock[];
  format?: "text" | "markdown";
  enrichment?: { durationMinutes?: number; projectId?: string; confidence?: number };
  agent?: AgentRunState;
};

export type AiAssistantResponse =
  | (AiAssistantPayload & { ok: true; error?: never })
  | (AiAssistantPayload & { ok: false; error: AiServiceError });

export type AiHealthResponse = { ok: boolean; status: "ready" | "degraded" | "unavailable"; version?: string; configuredProviders?: string[] };

const AI_REQUEST_TIMEOUT_MS = 25_000;

function failure(error: AiServiceError): AiAssistantResponse {
  return { ok: false, reply: error.message, actions: [], steps: [{ label: error.message, status: "error" }], error };
}

function unwrapNestedResponse(result: AiAssistantResponse): AiAssistantResponse {
  let reply = result.reply;
  for (let i = 0; i < 8; i += 1) {
    const trimmed = reply.trim();
    if (!trimmed.startsWith("{")) break;
    try {
      const nested = JSON.parse(trimmed) as Partial<AiAssistantPayload>;
      if (typeof nested.reply === "string" && nested.reply !== trimmed) {
        reply = nested.reply;
        continue;
      }
    } catch {
      // Plain text is already safe to render.
    }
    break;
  }
  return { ...result, reply };
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

let cachedClient: SupabaseClient | null = null;

export function aiGatewayUrl(inputUrl: string, pageUrl: string, supabaseUrl: string): string {
  const requestUrl = new URL(inputUrl);
  const page = new URL(pageUrl);
  const useSameOriginProxy = page.protocol === "https:"
    && (page.hostname === "navopath.com" || page.hostname.endsWith(".navopath-xiaoyang.pages.dev"));
  if (!useSameOriginProxy || requestUrl.origin !== new URL(supabaseUrl).origin) return requestUrl.href;
  requestUrl.protocol = page.protocol;
  requestUrl.host = page.host;
  requestUrl.pathname = `/api/supabase${requestUrl.pathname}`;
  return requestUrl.href;
}

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  cachedClient = createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const inputUrl = input instanceof Request ? input.url : input.toString();
        const rewritten = aiGatewayUrl(inputUrl, window.location.href, url);
        const request = input instanceof Request ? new Request(rewritten, input) : rewritten;
        return nativeFetch(request, init);
      },
    },
  });
  return cachedClient;
}

async function readFunctionError(error: unknown): Promise<AiServiceError> {
  const candidate = error as { message?: string; context?: Response; payload?: any };
  let payload: any = candidate.payload || null;
  try {
    payload = payload || (candidate.context ? await candidate.context.clone().json() : null);
  } catch {
    payload = null;
  }
  if (payload?.error?.code) {
    return {
      code: payload.error.code,
      retryable: Boolean(payload.error.retryable),
      requestId: payload.error.requestId,
      message: payload.error.message || "AI 服务暂时不可用。",
    };
  }
  const message = candidate.message || "";
  if (/not found|not deployed/i.test(message)) return { code: "AI_NOT_CONFIGURED", retryable: false, message: "AI 服务尚未部署。" };
  return { code: "AI_PROVIDER", retryable: true, message: "AI 服务暂时不可用，请稍后重试。" };
}

export async function invokeAiAssistant(client: SupabaseClient, params: {
  mode: AiMode;
  message?: string;
  model?: string;
  reasoningMode?: "instant" | "high" | "xhigh";
  context?: unknown;
  history?: AiChatMessage[];
  memories?: AiMemoryPatch[];
  conversationId?: string;
  trigger?: "manual" | "start_brief" | "end_review";
  attachmentText?: string;
  attachmentName?: string;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<AiAssistantResponse> {
  const timeoutMs = params.timeoutMs || (params.mode.startsWith("agent") ? 65_000 : AI_REQUEST_TIMEOUT_MS);
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abort = () => controller.abort();
  if (params.signal?.aborted) controller.abort();
  else params.signal?.addEventListener("abort", abort, { once: true });

  try {
    const currentDate = localIsoDate();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const context = { ...((params.context as Record<string, unknown>) || {}), currentDate, timezone };
    const { data, error } = await client.functions.invoke("ai-assistant", {
      body: { ...params, context, signal: undefined, timeoutMs: undefined },
      signal: controller.signal,
      timeout: timeoutMs,
    });
    if (error) return failure(await readFunctionError(error));
    if (!data) return failure({ code: "AI_BAD_RESPONSE", retryable: true, message: "AI 返回格式异常，请重试。" });
    if (typeof data === "string") return { ok: true, reply: data, actions: [], steps: [{ label: "AI 回复", status: "done" }] };
    if (data.ok === false && data.error) return failure({
      code: data.error.code || "AI_PROVIDER",
      retryable: Boolean(data.error.retryable),
      requestId: data.error.requestId,
      message: data.error.message || "AI 服务暂时不可用。",
    });
    return unwrapNestedResponse({
      ok: true,
      reply: data.reply || "完成",
      actions: Array.isArray(data.actions) ? data.actions : [],
      steps: Array.isArray(data.steps) ? data.steps : [],
      memories: Array.isArray(data.memories) ? data.memories : [],
      intent: typeof data.intent === "string" ? data.intent : undefined,
      plan: Array.isArray(data.plan) ? data.plan : undefined,
      format: data.format === "markdown" ? "markdown" : "text",
      enrichment: data.enrichment && typeof data.enrichment === "object" ? data.enrichment : undefined,
      agent: data.agent && typeof data.agent === "object" ? data.agent as AgentRunState : undefined,
    });
  } catch (error) {
    console.error("AI Assistant network error:", error);
    if (controller.signal.aborted) {
      return failure({ code: timedOut ? "AI_TIMEOUT" : "AI_CANCELLED", retryable: true, message: timedOut ? "AI 响应超时，请重试。" : "请求已取消。" });
    }
    return failure({ code: "AI_NETWORK", retryable: true, message: "网络异常，请检查连接后重试。" });
  } finally {
    window.clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", abort);
  }
}

export async function callAiAssistant(params: Parameters<typeof invokeAiAssistant>[1]): Promise<AiAssistantResponse> {
  const sharedInvoker = window.plannerApi?.invokeEdgeFunction;
  if (sharedInvoker) {
    const adapter = {
      functions: {
        invoke: async (_name: string, options: { body: unknown; signal?: AbortSignal }) => {
          try {
            return { data: await sharedInvoker("ai-assistant", options.body, options.signal), error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      },
    } as unknown as SupabaseClient;
    return invokeAiAssistant(adapter, params);
  }
  const client = getClient();
  if (!client) return failure({ code: "AI_NOT_CONFIGURED", retryable: false, message: "AI 服务未配置，请在设置中连接 Supabase。" });
  return invokeAiAssistant(client, params);
}

export function decideAgentRun(mode: "agent_confirm" | "agent_reject" | "agent_undo", runId: string, signal?: AbortSignal) {
  return callAiAssistant({ mode, runId, signal, timeoutMs: 30_000 });
}

export async function getAiHealth(): Promise<AiHealthResponse> {
  const client = getClient();
  if (!client) return { ok: false, status: "unavailable" };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const { data, error } = await client.functions.invoke("ai-assistant", { body: { mode: "health" }, signal: controller.signal, timeout: 5_000 });
    if (error || !data) return { ok: false, status: "unavailable" };
    return data as AiHealthResponse;
  } catch {
    return { ok: false, status: "unavailable" };
  } finally {
    window.clearTimeout(timer);
  }
}

export const FALLBACK_AI_MODELS = [
  "deepseek-ai/DeepSeek-V4-Flash",
  "deepseek-ai/DeepSeek-V4-Pro",
  "Qwen/Qwen3.6-35B-A3B",
  "Qwen/Qwen3.6-27B",
  "zai-org/GLM-5.2",
  "moonshotai/Kimi-K2.7-Code",
  "meituan-longcat/LongCat-2.0",
  "nex-agi/Nex-N2-Pro",
  "MiniMaxAI/MiniMax-M2.5",
] as const;

export async function listAiModels(): Promise<string[]> {
  return filterAiModels([...FALLBACK_AI_MODELS]);
}

export { uid };
