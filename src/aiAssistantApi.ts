// aiAssistantApi.ts — Frontend wrapper for NavoPath AI Assistant
// Calls the Supabase Edge Function that proxies the configured AI provider.
// NEVER exposes SILICONFLOW_API_KEY to the browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localIsoDate } from "./utils/localDate";
import { filterAiModels } from "./utils/aiModels";

export type AiMode = "chat" | "suggest_subtasks" | "parse_task" | "plan_day" | "import_schedule" | "summarize_memory";

export type AiStep = {
  label: string;
  status: "pending" | "running" | "done" | "error";
};

export type AiChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AiMemoryPatch = {
  content: string;
  tags?: string[];
};

export type AiAction =
  | {
      type: "create_subtasks";
      taskId?: string;
      projectId?: string;
      subtasks?: { title: string; estimateMinutes?: number }[];
      reason?: string;
    }
  | {
      type: "create_task";
      title?: string;
      projectId?: string;
      date?: string;
      start?: string;
      end?: string;
      reason?: string;
    }
  | {
      type: "schedule_task";
      taskId?: string;
      date?: string;
      start?: string;
      end?: string;
      reason?: string;
    }
  | {
      type: "create_scheduled_task";
      title?: string;
      projectId?: string;
      projectName?: string;
      date?: string;
      start?: string;
      end?: string;
      durationMinutes?: number;
      reason?: string;
    }
  | {
      type: "plan_day";
      reason?: string;
    }
  | {
      type: "none";
      reason?: string;
    }
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

export type AiPlanBlock = {
  taskId?: string;
  title: string;
  start: string;
  end: string;
  durationMinutes?: number;
  reason?: string;
};

export type AiAssistantResponse = {
  reply: string;
  actions: AiAction[];
  steps?: AiStep[];
  memories?: AiMemoryPatch[];
  intent?: string;
  plan?: AiPlanBlock[];
  format?: "text" | "markdown";
};

/**
 * Strip any number of nested JSON layers from the `reply` field. Mirrors the
 * server-side `unwrapReplyLayers` in supabase/functions/ai-assistant/index.ts
 * so the UI is protected even if the edge function is on an older revision.
 */
function unwrapNestedResponse(result: AiAssistantResponse): AiAssistantResponse {
  let reply = result.reply;
  for (let i = 0; i < 8; i += 1) {
    const trimmed = reply.trim();
    if (!trimmed.startsWith("{")) break;
    try {
      const nested = JSON.parse(trimmed) as Partial<AiAssistantResponse>;
      if (typeof nested.reply === "string" && nested.reply !== trimmed) {
        reply = nested.reply;
        continue;
      }
    } catch {
      // not parseable -> done
    }
    break;
  }
  return {
    reply,
    actions: result.actions,
    steps: result.steps,
    memories: result.memories,
    intent: result.intent,
    plan: result.plan,
    format: result.format,
  };
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

let _cache: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_cache) return _cache;
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _cache = createClient(url, key);
  return _cache;
}

/**
 * Call the AI Assistant via Supabase Edge Function.
 * NEVER exposes SILICONFLOW_API_KEY to the browser.
 */
export async function callAiAssistant(params: {
  mode: AiMode;
  message: string;
  model?: string;
  reasoningMode?: "instant" | "high" | "xhigh";
  context?: unknown;
  history?: AiChatMessage[];
  memories?: AiMemoryPatch[];
  signal?: AbortSignal;
}): Promise<AiAssistantResponse> {
  const client = getClient();
  if (!client) {
    return {
      reply: "AI 服务未配置，请在设置中连接 Supabase。",
      actions: [],
      steps: [{ label: "连接 AI 服务", status: "error" }],
    };
  }

  // Always include current date context for date parsing
  const currentDate = localIsoDate();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const enrichedContext = {
    ...(params.context as Record<string, unknown> || {}),
    currentDate,
    timezone,
  };

  try {
    if (params.signal?.aborted) {
      return { reply: "请求已取消。", actions: [], steps: [{ label: "请求已取消", status: "error" }] };
    }
    const { data, error } = await client.functions.invoke("ai-assistant", {
      body: { ...params, context: enrichedContext, signal: undefined },
    });

    if (error) {
      console.error("AI Assistant edge function error:", error);
      const msg = error.message || "";
      if (msg.includes("Missing SILICONFLOW_API_KEY")) {
        return { reply: "AI 服务未配置 API Key，请联系管理员。", actions: [], steps: [{ label: "验证 API Key", status: "error" }] };
      }
      if (msg.includes("function not found") || msg.includes("not deployed")) {
        return { reply: "AI 服务未部署，请在 Supabase 部署 ai-assistant 函数。", actions: [], steps: [{ label: "连接 AI 服务", status: "error" }] };
      }
      return { reply: "AI 请求失败，请稍后重试。", actions: [], steps: [{ label: "请求 AI 服务", status: "error" }] };
    }

    if (!data) {
      return {
        reply: "AI 返回格式异常，请重试。",
        actions: [],
        steps: [{ label: "解析 AI 响应", status: "error" }],
      };
    }

    if (typeof data === "string") {
      return { reply: data, actions: [], steps: [{ label: "AI 回复", status: "done" }] };
    }

    const result = data as AiAssistantResponse & { steps?: AiStep[] };
    return unwrapNestedResponse({
      reply: result.reply || "完成",
      actions: Array.isArray(result.actions) ? result.actions : [],
      steps: Array.isArray(result.steps) ? result.steps : [],
      memories: Array.isArray(result.memories) ? result.memories : [],
      intent: typeof result.intent === "string" ? result.intent : undefined,
      plan: Array.isArray(result.plan) ? result.plan : undefined,
      format: result.format === "markdown" ? "markdown" : "text",
    });
  } catch (err) {
    console.error("AI Assistant network error:", err);
    return {
      reply: "网络异常，请检查连接后重试。",
      actions: [],
      steps: [{ label: "网络连接", status: "error" }],
    };
  }
}

export const FALLBACK_AI_MODELS = [
  "deepseek-ai/DeepSeek-V4-Flash",
  "deepseek-ai/DeepSeek-V4-Pro",
  "deepseek-ai/DeepSeek-V3.2",
  "Qwen/Qwen3.6-35B-A3B",
  "Qwen/Qwen3.5-397B-A17B",
  "zai-org/GLM-5.2",
  "moonshotai/Kimi-K2.7-Code",
  "MiniMaxAI/MiniMax-M2.5",
  "stepfun-ai/Step-3.5-Flash",
] as const;

export async function listAiModels(): Promise<string[]> {
  const client = getClient();
  if (!client) return [...FALLBACK_AI_MODELS];
  try {
    const { data, error } = await client.functions.invoke("ai-assistant", {
      body: { mode: "list_models" },
    });
    if (error) throw error;
    const models = Array.isArray(data?.models)
      ? data.models.filter((model: unknown): model is string => typeof model === "string" && model.length > 0)
      : [];
    const filtered = filterAiModels(models);
    return filtered.length > 0 ? filtered : [...FALLBACK_AI_MODELS];
  } catch (error) {
    console.warn("Unable to load AI models; using fallback list:", error);
    return [...FALLBACK_AI_MODELS];
  }
}

export { uid };
