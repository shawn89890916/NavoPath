// aiAssistantApi.ts — Frontend wrapper for NavoPath AI Assistant
// Calls Supabase Edge Function: ai-assistant (DeepSeek proxy)
// NEVER exposes DEEPSEEK_API_KEY to the browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AiMode = "chat" | "suggest_subtasks" | "parse_task" | "plan_day";

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
      type: "plan_day";
      reason?: string;
    }
  | {
      type: "none";
      reason?: string;
    };

export type AiAssistantResponse = {
  reply: string;
  actions: AiAction[];
};

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
 * NEVER exposes DEEPSEEK_API_KEY to the browser.
 */
export async function callAiAssistant(params: {
  mode: AiMode;
  message: string;
  context?: unknown;
}): Promise<AiAssistantResponse> {
  const client = getClient();
  if (!client) {
    return {
      reply: "AI 服务未部署",
      actions: [],
    };
  }

  try {
    const { data, error } = await client.functions.invoke("ai-assistant", {
      body: params,
    });

    if (error) {
      console.error("AI Assistant edge function error:", error);
      const msg = error.message || "";
      if (msg.includes("Missing DEEPSEEK_API_KEY")) {
        return { reply: "AI 服务未配置 API Key", actions: [] };
      }
      if (msg.includes("function not found") || msg.includes("not deployed")) {
        return { reply: "AI 服务未部署", actions: [] };
      }
      return { reply: "AI 请求失败，请稍后重试", actions: [] };
    }

    if (!data) {
      return { reply: "AI 未返回有效内容", actions: [] };
    }

    if (typeof data === "string") {
      return { reply: data, actions: [] };
    }

    const result = data as AiAssistantResponse;
    return {
      reply: result.reply || "完成",
      actions: Array.isArray(result.actions) ? result.actions : [],
    };
  } catch (err) {
    console.error("AI Assistant network error:", err);
    return {
      reply: "网络异常，请重试",
      actions: [],
    };
  }
}

export { uid };
