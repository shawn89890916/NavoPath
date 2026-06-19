// Supabase Edge Function: NavoPath AI Agent (lightweight 3-stage pipeline)
// Stages: Router (intent) -> Planner (structured plan) -> Actor (final actions)
// Each stage is independently observable and can degrade gracefully.
// Deploy: supabase functions deploy ai-assistant
// Set secret: supabase secrets set SILICONFLOW_API_KEY=sk-xxx

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { chatPrompt, importSchedulePrompt, routerPrompt, summarizeMemoryPrompt, type PromptContext } from "./prompts.ts";

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

// Flagship reasoning models can take more than 12 seconds for structured JSON.
// Keep a hard ceiling, but allow enough time for the planner stage to finish.
const STAGE_TIMEOUT_MS = 30_000;

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
    format: parsed.format === "markdown" ? "markdown" : "text",
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider call with timeout.
// ---------------------------------------------------------------------------
async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  reasoningMode: "instant" | "high" | "xhigh" = "instant",
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS);
  // Forward caller abort.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const dsResponse = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        stream: false,
        ...(reasoningMode === "instant" ? {} : { reasoning_effort: reasoningMode }),
      }),
      signal: controller.signal,
    });
    if (!dsResponse.ok) {
      const errorText = await dsResponse.text();
      throw new Error(`AI service ${dsResponse.status}: ${errorText.slice(0, 200)}`);
    }
    const dsData = await dsResponse.json();
    const content = dsData.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI service returned no content");
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Router stage: classify intent with a short, separate call.
// Degrades silently if it fails (Planner still runs with full context).
// ---------------------------------------------------------------------------
async function routeStage(
  apiKey: string,
  model: string,
  ctx: PromptContext,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ intent?: string; requiresPlanning?: boolean; requiresActions?: boolean } | null> {
  try {
    const messages = [
      { role: "system", content: routerPrompt(ctx) },
      ...history.slice(-6),
      { role: "user", content: message.slice(0, 1000) },
    ];
    const content = await callDeepSeek(apiKey, model, messages, 200);
    const parsed = extractJsonObject(content) as Record<string, unknown>;
    return {
      intent: typeof parsed.intent === "string" ? parsed.intent : undefined,
      requiresPlanning: parsed.requiresPlanning === true,
      requiresActions: parsed.requiresActions === true,
    };
  } catch (err) {
    console.warn("Router stage degraded:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Planner stage: produces the canonical reply/steps/actions payload.
// Falls back to a raw-text echo if everything fails.
// ---------------------------------------------------------------------------
async function plannerStage(
  apiKey: string,
  model: string,
  mode: string,
  ctx: PromptContext,
  userContent: string,
  historyMessages: Array<{ role: "user" | "assistant"; content: string }>,
  reasoningMode: "instant" | "high" | "xhigh" = "instant",
) {
  const systemPrompt = mode === "summarize_memory"
    ? summarizeMemoryPrompt(ctx)
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
    console.warn("Planner payload validation failed; requesting one repair:", firstError);
    const repaired = await callDeepSeek(apiKey, model, [
      {
        role: "system",
        content: "Repair the candidate into one valid JSON object. Required fields: reply (plain user-facing sentence), steps (array), actions (array), memories (array). Never place JSON, markdown, or code inside reply. Return JSON only.",
      },
      { role: "user", content: content.slice(0, 12_000) },
    ], maxTokens, reasoningMode);
    return normalizeAssistantPayload(extractJsonObject(repaired));
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
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing SILICONFLOW_API_KEY" }), { status: 500, headers: corsHeaders });
    }

    if (mode === "list_models") {
      const response = await fetch("https://api.siliconflow.cn/v1/models?type=text&sub_type=chat", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        return new Response(JSON.stringify({ error: `AI model service ${response.status}` }), { status: 502, headers: corsHeaders });
      }
      const payload = await response.json();
      const models = Array.isArray(payload?.data)
        ? payload.data.map((item: { id?: unknown }) => item?.id).filter((id: unknown): id is string => typeof id === "string").sort()
        : [];
      return new Response(JSON.stringify({ models }), { headers: corsHeaders });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing mode or message" }), { status: 400, headers: corsHeaders });
    }

    const validModes = ["chat", "suggest_subtasks", "parse_task", "plan_day", "import_schedule", "summarize_memory"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `Invalid mode. Must be one of: ${validModes.join(", ")}` }),
        { status: 400, headers: corsHeaders },
      );
    }

    const selectedModel = typeof model === "string" && /^[A-Za-z0-9._/-]{2,160}$/.test(model)
      ? model
      : Deno.env.get("SILICONFLOW_MODEL") || "deepseek-ai/DeepSeek-V4-Flash";
    const supportedReasoning = /DeepSeek-V4-Pro|Qwen3\.5-(?:122B|397B)|GLM-5\.2|Kimi-K2\.7|MiniMax-M3/i.test(selectedModel);
    const selectedReasoning = supportedReasoning && (reasoningMode === "high" || reasoningMode === "xhigh") ? reasoningMode : "instant";

    const timezone = (context?.timezone as string) || "Asia/Shanghai";
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

    // Stage 1: Router (best-effort)
    const route = await routeStage(apiKey, selectedModel, promptCtx, userContent, historyMessages);

    // Stage 2: Planner (required)
    let plannerValue: unknown;
    try {
      plannerValue = await plannerStage(apiKey, selectedModel, mode, promptCtx, userContent, historyMessages, selectedReasoning);
    } catch (err) {
      console.error("Planner stage failed:", err);
      const fallback = {
        reply: "AI 请求失败，请稍后重试。",
        steps: [{ label: "AI 服务", status: "error" }],
        actions: [],
        memories: [],
        ...(route?.intent ? { intent: route.intent } : {}),
      };
      return new Response(JSON.stringify(fallback), { status: 502, headers: corsHeaders });
    }

    // Stage 3: Actor — merge Router intent into the normalized payload.
    const normalized = normalizeAssistantPayload(plannerValue);
    if (route?.intent && !normalized.intent) {
      normalized.intent = route.intent;
    }

    return new Response(JSON.stringify(normalized), { headers: corsHeaders });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ reply: "AI 服务异常，请稍后重试。", actions: [], steps: [] }), { status: 500, headers: corsHeaders });
  }
});
