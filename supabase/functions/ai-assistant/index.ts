// Supabase Edge Function: NavoPath AI Agent (lightweight 3-stage pipeline)
// Stages: Planner (structured plan) -> Actor (final actions)
// Deploy: supabase functions deploy ai-assistant
// Set secret: supabase secrets set SILICONFLOW_API_KEY=sk-xxx

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { chatPrompt, importSchedulePrompt, suggestSubtasksPrompt, summarizeMemoryPrompt, type PromptContext } from "./prompts.ts";
import { AiGatewayError, callAiGateway, type AiProviderConfig } from "./gateway.ts";

function localDateForTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return localDateForTimeZone("Asia/Shanghai");
  }
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
import { buildConversationContinuation } from "./conversation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const STABLE_MODEL = "deepseek-ai/DeepSeek-V4-Flash";
const AI_GATEWAY_VERSION = "2026-08-13.1";
const FALLBACK_MODELS = [
  STABLE_MODEL,
  "deepseek-ai/DeepSeek-V4-Pro",
  "Qwen/Qwen3.6-35B-A3B",
  "Qwen/Qwen3.6-27B",
  "zai-org/GLM-5.2",
  "moonshotai/Kimi-K2.7-Code",
  "meituan-longcat/LongCat-2.0",
  "nex-agi/Nex-N2-Pro",
  "MiniMaxAI/MiniMax-M2.5",
];

function resolveModel(model: string): string {
  return FALLBACK_MODELS.includes(model) ? model : STABLE_MODEL;
}

function getTomorrow(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getDayAfterTomorrow(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

function extractJsonObject(text: string): unknown {
  const withoutFence = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Fall through to balanced-brace extraction.
  }

  const first = withoutFence.indexOf("{");
  if (first === -1) throw new Error("No JSON object found");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = first; i < withoutFence.length; i += 1) {
    const char = withoutFence[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return JSON.parse(withoutFence.slice(first, i + 1));
  }

  throw new Error("No complete JSON object found");
}

function looksLikeCodeOrJson(value: string): boolean {
  const text = value.trim();
  return text.startsWith("{") || text.startsWith("[") || text.startsWith("```") || /\"(?:reply|actions|steps)\"\s*:/.test(text);
}

/**
 * Strip any number of nested JSON layers from the `reply` field. This is the
 * canonical fix for the bug where AI replies show raw JSON in the UI: models
 * occasionally wrap their `reply` in another full JSON object, sometimes
 * multiple layers deep. We always return the deepest plain-text `reply` while
 * preserving the top-level `steps / actions / memories`.
 */
function unwrapReplyLayers(reply: string): string {
  let current = reply;
  // Hard cap to avoid pathological loops.
  for (let i = 0; i < 8; i += 1) {
    const trimmed = current.trim();
    if (!looksLikeCodeOrJson(trimmed)) return current;
    try {
      const parsed = extractJsonObject(trimmed) as Record<string, unknown>;
      if (typeof parsed.reply === "string" && parsed.reply !== trimmed) {
        current = parsed.reply;
        continue;
      }
    } catch {
      // not parseable -> done
    }
    return "已生成结果，请查看下方可执行操作。";
  }
  return looksLikeCodeOrJson(current) ? "已生成结果，请查看下方可执行操作。" : current;
}

function normalizeAssistantPayload(value: unknown) {
  const parsed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (typeof parsed.reply !== "string") throw new Error("Assistant payload is missing reply");
  if (!Array.isArray(parsed.actions)) throw new Error("Assistant payload is missing actions");
  const rawReply = parsed.reply;
  return {
    reply: unwrapReplyLayers(rawReply),
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    memories: Array.isArray(parsed.memories) ? parsed.memories : [],
    intent: typeof parsed.intent === "string" ? parsed.intent : undefined,
    plan: Array.isArray(parsed.plan) ? parsed.plan : undefined,
    enrichment: parsed.enrichment && typeof parsed.enrichment === "object" ? parsed.enrichment : undefined,
    format: parsed.format === "markdown" ? "markdown" : "text",
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider call with timeout.
// ---------------------------------------------------------------------------
async function callDeepSeek(
  apiKey: string | undefined,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  reasoningMode: "instant" | "high" | "xhigh" = "instant",
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  const providers: AiProviderConfig[] = [];
  if (apiKey) {
    providers.push({
      name: "siliconflow",
      baseUrl: Deno.env.get("SILICONFLOW_BASE_URL") || "https://api.siliconflow.cn/v1",
      apiKey,
      model: resolveModel(model),
      supportsReasoning: true,
    });
  }
  const deepSeekKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (deepSeekKey) {
    providers.push({
      name: "deepseek",
      baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1",
      apiKey: deepSeekKey,
      model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat",
    });
  }
  const result = await callAiGateway({
    providers,
    messages,
    maxTokens,
    reasoningMode,
    perProviderTimeoutMs: 10_000,
    totalTimeoutMs: 24_000,
    onAttempt: (attempt) => console.log("AI gateway attempt", attempt),
  });
  return result.content;
}

// ---------------------------------------------------------------------------
// Planner stage: produces the canonical reply/steps/actions payload.
// Falls back to a raw-text echo if everything fails.
// ---------------------------------------------------------------------------
async function plannerStage(
  apiKey: string | undefined,
  model: string,
  mode: string,
  ctx: PromptContext,
  userContent: string,
  historyMessages: Array<{ role: "user" | "assistant"; content: string }>,
  reasoningMode: "instant" | "high" | "xhigh" = "instant",
) {
  const systemPrompt = mode === "enrich_task"
    ? `You estimate task duration and choose an existing project. Return JSON only: {"reply":"","steps":[],"actions":[],"memories":[],"enrichment":{"durationMinutes":15-240,"projectId":"existing id or empty","confidence":0-1}}. Never invent a project. ${ctx.projectsInfo}`
    : mode === "summarize_memory"
    ? summarizeMemoryPrompt(ctx)
    : mode === "suggest_subtasks"
      ? suggestSubtasksPrompt(ctx)
    : mode === "import_schedule"
      ? importSchedulePrompt(ctx)
      : chatPrompt(ctx);

  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userContent },
  ];
  const maxTokens = mode === "import_schedule" ? 6000 : mode === "summarize_memory" ? 600 : 1600;
  const content = await callDeepSeek(apiKey, model, messages, maxTokens, reasoningMode);
  try {
    return normalizeAssistantPayload(extractJsonObject(content));
  } catch (firstError) {
    console.warn("Planner returned plain text; preserving it without another provider call", firstError);
    return normalizeAssistantPayload({ reply: content, steps: [], actions: [], memories: [] });
  }
}

// ---------------------------------------------------------------------------
// serve() — main entrypoint. Composes the three stages.
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, message, model, reasoningMode, context, history, memories } = body as {
      mode?: string;
      message?: string;
      model?: string;
      reasoningMode?: "instant" | "high" | "xhigh";
      context?: Record<string, unknown>;
      history?: Array<{ role?: string; content?: string }>;
      memories?: Array<{ content?: string; tags?: string[] }>;
    };

    if (!mode) {
      return new Response(JSON.stringify({ error: "Missing mode" }), { status: 400, headers: corsHeaders });
    }

    const apiKey = Deno.env.get("SILICONFLOW_API_KEY");
    const deepSeekKey = Deno.env.get("DEEPSEEK_API_KEY");
    const configuredProviders = [apiKey ? "siliconflow" : "", deepSeekKey ? "deepseek" : ""].filter(Boolean);

    if (mode === "health") {
      return new Response(JSON.stringify({
        ok: configuredProviders.length > 0,
        status: configuredProviders.length > 1 ? "ready" : configuredProviders.length === 1 ? "degraded" : "unavailable",
        version: AI_GATEWAY_VERSION,
        configuredProviders,
      }), { status: configuredProviders.length > 0 ? 200 : 503, headers: corsHeaders });
    }

    if (mode === "list_models") {
      return new Response(JSON.stringify({ models: FALLBACK_MODELS, version: AI_GATEWAY_VERSION }), { headers: corsHeaders });
    }

    if (configuredProviders.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: { code: "AI_NOT_CONFIGURED", retryable: false, requestId: crypto.randomUUID(), message: "AI 服务尚未配置。" },
      }), { status: 503, headers: corsHeaders });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing mode or message" }), { status: 400, headers: corsHeaders });
    }

    const validModes = ["chat", "suggest_subtasks", "parse_task", "plan_day", "plan_schedule", "enrich_task", "import_schedule", "summarize_memory"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `Invalid mode. Must be one of: ${validModes.join(", ")}` }),
        { status: 400, headers: corsHeaders },
      );
    }

    const selectedModel = typeof model === "string" && /^[A-Za-z0-9._/-]{2,160}$/.test(model)
      ? model
      : Deno.env.get("SILICONFLOW_MODEL") || STABLE_MODEL;
    const supportedReasoning = /DeepSeek-V4-(?:Flash|Pro)|Qwen3\.6|GLM-5\.2|Kimi-K2\.7-Code|LongCat-2\.0|Nex-N2-Pro|MiniMax-M2\.5/i.test(selectedModel);
    const selectedReasoning = supportedReasoning && (reasoningMode === "high" || reasoningMode === "xhigh") ? reasoningMode : "instant";

    const timezone = (context?.timezone as string) || "Asia/Shanghai";
    const language = context?.language === "zh" ? "zh" : "en";
    const currentDate = validIsoDate(context?.currentDate) ? context.currentDate : localDateForTimeZone(timezone);
    const projectsInfo = context?.projects ? `Available projects: ${JSON.stringify(context.projects)}` : "";
    const scheduledTodayInfo = context?.scheduledToday
      ? `Already scheduled on current view date (${String(context?.currentViewDate || currentDate)}): ${JSON.stringify(context.scheduledToday)}`
      : "";
    const activeTasksInfo = context?.activeTasks ? `Active task snapshot: ${JSON.stringify(context.activeTasks).slice(0, 8000)}` : "";
    const eventsInfo = context?.upcomingEvents ? `Upcoming events snapshot: ${JSON.stringify(context.upcomingEvents).slice(0, 5000)}` : "";
    const notesInfo = context?.recentNotes ? `Recent notes: ${JSON.stringify(context.recentNotes).slice(0, 3000)}` : "";
    const focusTaskInfo = context?.focusTask ? `Focused task: ${JSON.stringify(context.focusTask).slice(0, 2000)}` : "";
    const memoryInfo = Array.isArray(memories) && memories.length > 0
      ? `Long-term user memory and preferences: ${JSON.stringify(memories.slice(-20)).slice(0, 5000)}`
      : "Long-term user memory: none supplied.";

    const historyMessages = Array.isArray(history)
      ? history
        .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
        .slice(-12)
        .map((item) => ({ role: item.role as "user" | "assistant", content: item.content!.slice(0, 2000) }))
      : [];

    const promptCtx: PromptContext = {
      language,
      currentDate,
      timezone,
      tomorrow: getTomorrow(currentDate),
      dayAfterTomorrow: getDayAfterTomorrow(currentDate),
      projectsInfo,
      scheduledTodayInfo,
      activeTasksInfo,
      eventsInfo,
      notesInfo,
      focusTaskInfo,
      memoryInfo,
    };

    let userContent = message;
    const continuation = buildConversationContinuation(historyMessages, message);
    if (continuation) userContent = continuation;
    if (context?.taskId && context?.taskTitle) userContent = `[focus task: "${context.taskTitle}"]\n${message}`;
    if (context?.scheduledToday) {
      const scheduled = context.scheduledToday as Array<{ title: string; start: string; end: string }>;
      if (scheduled.length > 0) {
        userContent += `\n\nExisting schedule on current view date ${String(context?.currentViewDate || currentDate)} (avoid conflicts when planning that date):\n${scheduled.map((item) => `${item.start}-${item.end}: ${item.title}`).join("\n")}`;
      }
    }

    // Stage 1: Planner. Intent is already part of its structured response, so
    // a separate model call would only add latency and another failure point.
    let plannerValue: unknown;
    try {
      plannerValue = await plannerStage(apiKey, selectedModel, mode, promptCtx, userContent, historyMessages, selectedReasoning);
    } catch (err) {
      const fallback = {
        reply: "AI 请求失败，请稍后重试。",
        steps: [{ label: "AI 服务", status: "error" }],
        actions: [],
        memories: [],
      };
      const requestId = crypto.randomUUID();
      const gatewayError = err instanceof AiGatewayError ? err : null;
      console.error("AI request failed", { requestId, code: gatewayError?.code || "AI_PROVIDER", attempts: gatewayError?.attempts || [] });
      return new Response(JSON.stringify({
        ok: false,
        ...fallback,
        error: {
          code: gatewayError?.code || "AI_PROVIDER",
          retryable: gatewayError?.retryable ?? true,
          requestId,
          message: gatewayError?.code === "AI_AUTH" ? "AI 服务凭据无效，已尝试备用服务。" : "AI 服务暂时不可用，请稍后重试。",
        },
      }), { status: 503, headers: corsHeaders });
    }

    // Stage 2: Actor — normalize the planner payload.
    const normalized = normalizeAssistantPayload(plannerValue);

    return new Response(JSON.stringify({ ok: true, ...normalized, version: AI_GATEWAY_VERSION }), { headers: corsHeaders });
  } catch (err) {
    const requestId = crypto.randomUUID();
    console.error("AI edge error", { requestId, code: "AI_BAD_RESPONSE", name: err instanceof Error ? err.name : "unknown" });
    return new Response(JSON.stringify({
      ok: false,
      reply: "AI 服务异常，请稍后重试。",
      actions: [],
      steps: [{ label: "AI 服务", status: "error" }],
      error: { code: "AI_BAD_RESPONSE", retryable: true, requestId, message: "AI 服务异常，请稍后重试。" },
    }), { status: 500, headers: corsHeaders });
  }
});
