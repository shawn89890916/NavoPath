// contextManager.ts — Compress chat history and track the user's current intent.
// Designed to integrate with `callAiAssistant` in main.tsx and the edge function
// `ai-assistant` Agent. Lightweight: no external dependencies.

import type { AiChatMessage } from "../aiAssistantApi";

const HISTORY_COMPRESS_THRESHOLD = 12; // turns
const KEEP_RECENT_TURNS = 4; // always preserve the latest N turns verbatim

export type IntentSnapshot = {
  /** Last referenced task id (from "刚才那个" / "继续" / "it") */
  focusTaskId?: string;
  /** Last referenced project id */
  focusProjectId?: string;
  /** Last intent classification (chat / schedule_task / plan_day / ...) */
  intent?: string;
  /** Timestamp (ms) of the most recent focus reference */
  focusedAt?: number;
  /** Human-readable subject */
  focusSubject?: string;
};

const PRONOUN_PATTERN = /(刚才那个|刚才的|这个|这个任务|那个任务|继续|它|那一个|that one|continue|resume|it\b)/i;
const FIVE_MIN = 5 * 60 * 1000;

/**
 * Inspect the most recent assistant message and infer the user's likely
 * intent. Cheap heuristic: a single function is enough for the lightweight
 * TrevorAI-style UX we want.
 */
export function trackIntent(
  recentMessages: AiChatMessage[],
  currentMessage: string,
  previous?: IntentSnapshot,
): IntentSnapshot {
  const now = Date.now();
  const snapshot: IntentSnapshot = { ...(previous || {}) };

  if (PRONOUN_PATTERN.test(currentMessage) && previous?.focusTaskId && previous.focusedAt && (now - previous.focusedAt) < FIVE_MIN) {
    // Continue: keep the focus from the previous turn.
    snapshot.focusedAt = now;
    return snapshot;
  }

  // Otherwise, scan backwards through the recent assistant messages for a
  // structural mention of a task id or intent.
  for (let i = recentMessages.length - 1; i >= 0; i -= 1) {
    const m = recentMessages[i];
    if (m.role !== "assistant") continue;
    const idMatch = m.content.match(/(task_[A-Za-z0-9_-]{4,})/);
    if (idMatch && !snapshot.focusTaskId) {
      snapshot.focusTaskId = idMatch[1];
      snapshot.focusedAt = now;
    }
    if (!snapshot.focusSubject) {
      const subject = m.content.split(/[。\n!]/)[0]?.trim().slice(0, 30);
      if (subject) snapshot.focusSubject = subject;
    }
    if (snapshot.focusTaskId) break;
  }

  // Lightweight intent guess (the Router stage also does this, but doing a
  // first pass here lets us avoid extra latency for obvious cases).
  if (/规划今天|排今天|今天怎么安排|plan today/i.test(currentMessage)) {
    snapshot.intent = "plan_day";
  } else if (/改时间|改到|调整|reschedule|move|shift/i.test(currentMessage)) {
    snapshot.intent = "reschedule_task";
  } else if (/安排|排程|添加|新建|schedule|plan\b|add\b/i.test(currentMessage)) {
    snapshot.intent = "schedule_task";
  } else if (/记住|remember this|别忘了/i.test(currentMessage)) {
    snapshot.intent = "remember";
  } else if (/导入|import|附件|附件里|排课表/i.test(currentMessage)) {
    snapshot.intent = "import_schedule";
  } else {
    snapshot.intent = snapshot.intent || "chat";
  }

  return snapshot;
}

/**
 * If the conversation has grown past the threshold, collapse the older
 * messages into a single summary placeholder. The summary itself is built
 * client-side; a separate `summarize_memory` call is optional.
 */
export function compressHistory(messages: AiChatMessage[]): {
  messages: AiChatMessage[];
  compressed: boolean;
  summary: string;
} {
  if (messages.length <= HISTORY_COMPRESS_THRESHOLD) {
    return { messages, compressed: false, summary: "" };
  }
  const recent = messages.slice(-KEEP_RECENT_TURNS);
  const older = messages.slice(0, -KEEP_RECENT_TURNS);
  const summary = buildLocalSummary(older);
  const summaryMessage: AiChatMessage = {
    role: "system",
    content: `[Earlier conversation summary: ${summary}]`,
  };
  return {
    messages: [summaryMessage, ...recent],
    compressed: true,
    summary,
  };
}

function buildLocalSummary(older: AiChatMessage[]): string {
  // Extract a few stable signals: number of turns, last mentioned task id,
  // common keywords. Cheap, deterministic, runs without a network call.
  const turns = older.length;
  const lastTask = [...older].reverse().map((m) => m.content.match(/(task_[A-Za-z0-9_-]{4,})/)).find(Boolean)?.[1];
  const keywords: string[] = [];
  for (const m of older) {
    const words = m.content.match(/[\u4e00-\u9fa5A-Za-z]{4,}/g) || [];
    for (const w of words) {
      if (!keywords.includes(w) && keywords.length < 8) keywords.push(w);
    }
  }
  return `${turns} earlier turns; last task ${lastTask || "n/a"}; topics: ${keywords.join(", ")}`;
}

/**
 * Build the minimum-necessary context payload that the Agent should see.
 * Includes current focus, intent, and a hint that the user is the sole
 * operator. Call this right before invoking `callAiAssistant`.
 */
export function buildAgentContext(args: {
  baseContext: Record<string, unknown>;
  intent: IntentSnapshot;
  currentDate: string;
  timezone: string;
  historyTurns: number;
  compressed: boolean;
}) {
  return {
    ...args.baseContext,
    currentDate: args.currentDate,
    timezone: args.timezone,
    intent: args.intent,
    historyTurns: args.historyTurns,
    historyCompressed: args.compressed,
  };
}
