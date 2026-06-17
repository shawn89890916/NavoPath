// Supabase Edge Function: AI Assistant proxy for DeepSeek
// Deploy: supabase functions deploy ai-assistant
// Set secret: supabase secrets set DEEPSEEK_API_KEY=sk-xxx

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

/** Calculate tomorrow's date from a given YYYY-MM-DD date */
function getTomorrow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Calculate day-after-tomorrow's date from a given YYYY-MM-DD date */
function getDayAfterTomorrow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

/**
 * Robustly extract a JSON object from text that may contain markdown fences.
 * Handles:
 *   - Plain JSON: {"reply":"..."}
 *   - Fenced JSON: ```json\n{"reply":"..."}\n```
 *   - Fenced without lang: ```\n{"reply":"..."}\n```
 *   - Text before/after JSON
 */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  // Remove markdown fences
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(withoutFence);
  } catch {
    // ignore
  }

  // Try to find the first JSON object in the text
  const match = withoutFence.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // ignore
    }
  }

  throw new Error("No valid JSON object found in response");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const { mode, message, context, history, memories } = body as {
      mode?: string;
      message?: string;
      context?: Record<string, unknown>;
      history?: Array<{ role?: string; content?: string }>;
      memories?: Array<{ content?: string; tags?: string[] }>;
    };

    // Validate required fields
    if (!mode || !message) {
      return new Response(
        JSON.stringify({ error: "Missing mode or message" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const validModes = ["chat", "suggest_subtasks", "parse_task", "plan_day", "import_schedule", "summarize_memory"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `Invalid mode. Must be one of: ${validModes.join(", ")}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Read API key from environment
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Build date context
    const currentDate = (context?.currentDate as string) || new Date().toISOString().slice(0, 10);
    const timezone = (context?.timezone as string) || "Asia/Shanghai";

    // Build project context for the AI to use
    const projectsInfo = context?.projects
      ? `Available projects: ${JSON.stringify(context.projects)}`
      : "";
    const scheduledTodayInfo = context?.scheduledToday
      ? `Already scheduled on current view date (${String(context?.currentViewDate || currentDate)}): ${JSON.stringify(context.scheduledToday)}`
      : "";
    const activeTasksInfo = context?.activeTasks
      ? `Active task snapshot: ${JSON.stringify(context.activeTasks).slice(0, 8000)}`
      : "";
    const eventsInfo = context?.upcomingEvents
      ? `Upcoming events snapshot: ${JSON.stringify(context.upcomingEvents).slice(0, 5000)}`
      : "";
    const notesInfo = context?.recentNotes
      ? `Recent notes: ${JSON.stringify(context.recentNotes).slice(0, 3000)}`
      : "";
    const focusTaskInfo = context?.focusTask
      ? `Focused task: ${JSON.stringify(context.focusTask).slice(0, 2000)}`
      : "";
    const memoryInfo = Array.isArray(memories) && memories.length > 0
      ? `Long-term user memory and preferences: ${JSON.stringify(memories.slice(-20)).slice(0, 5000)}`
      : "Long-term user memory: none supplied.";
    const historyMessages = Array.isArray(history)
      ? history
        .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
        .slice(-12)
        .map((item) => ({ role: item.role as "user" | "assistant", content: item.content!.slice(0, 2000) }))
      : [];

    // Build system prompt
    const systemPrompt = mode === "summarize_memory" ? `You compress selected NavoPath conversation turns into one durable AI memory.
Today's date is ${currentDate}. Timezone is ${timezone}.
Return JSON only: {"reply":"one concise Chinese memory, max 120 Chinese characters","actions":[],"memories":[]}.
Capture stable user preferences, constraints, facts, plans, or decisions. Do not summarize temporary chatter. If there is no durable memory, reply with the most useful factual context from the selected turns.
` : mode === "import_schedule" ? `You import schedules from extracted document text into NavoPath.
Today's date is ${currentDate}. Timezone is ${timezone}.
Classify fixed commitments, classes, meetings, exams, and appointments as events. Classify actionable work as tasks.
Return JSON only: {"reply":"Chinese summary","steps":[{"label":"解析文件","status":"done"}],"actions":[...]}.
Every action must have:
{"type":"import_schedule_item","kind":"task|event","title":"short title","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD optional","startTime":"HH:mm optional","endTime":"HH:mm optional","durationMinutes":60,"category":"exam|uk|us|essay|materials|project|personal","priority":"high|medium|low","projectId":"existing id or empty","projectName":"existing name or null","notes":"source detail","recurrence":{"mode":"scheduled","frequency":"daily|weekdays|weekends|weekly|biweekly|monthly|quarterly","startDate":"YYYY-MM-DD","startTime":"HH:mm","durationMinutes":60,"endDate":"YYYY-MM-DD optional","count":10 optional},"warning":"optional uncertainty"}.
Use recurrence only when explicitly stated, or when a date range plus strong context such as a class timetable supports a reliable inference. Otherwise keep the item single.
Never invent project IDs. Omit invalid or content-free items. Use Chinese text. ${projectsInfo}
` : `You are the AI scheduling assistant inside NavoPath, a time-blocking execution app.

Your job: turn the user's natural language into structured scheduled task actions — like TrevorAI but in Chinese.

IMPORTANT CONTEXT:
* Today's date is ${currentDate}. Calculate all relative dates from this.
* Timezone: ${timezone}. The user is in China.
* Use 24-hour time format (HH:mm).
${projectsInfo ? `\n${projectsInfo}\n` : ""}
${scheduledTodayInfo ? `\n${scheduledTodayInfo}\n` : ""}

You must return valid JSON only, following this EXACT shape:
{
  "reply": "a natural Chinese summary of what you arranged, like: 已经帮你把"设计火箭模型"安排在今晚20:45，时长60分钟。",
  "steps": [
    { "label": "Read task lists info", "status": "done" },
    { "label": "Create scheduled tasks", "status": "done" }
  ],
  "actions": [
    {
      "type": "create_scheduled_task",
      "title": "the task title",
      "projectId": "matching project id from context, or empty",
      "projectName": "matching project name, e.g. 准备ESAT&TARA, or null",
      "date": "YYYY-MM-DD",
      "start": "HH:mm (24h)",
      "end": "HH:mm (24h, start+duration)",
      "durationMinutes": 60,
      "reason": "brief note about this task, e.g. user said 今天晚上设计火箭模型"
    }
  ]
}
If there is nothing to schedule, use type "none".
For fixed commitments, classes, meetings, exams, appointments, deadlines with exact external time, or anything the user would not freely move, return an action with:
{"type":"import_schedule_item","kind":"event","title":"short title","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","durationMinutes":60,"projectId":"matching project id or empty","projectName":"matching project name or null","notes":"brief source note"}.
For flexible work the user wants to do, keep using "create_scheduled_task".

TIME PARSING RULES:
* "今天晚上" → check current hour. If before 18:00, schedule at 20:00. If between 18:00-21:00, schedule at next available. If after 21:00, schedule tomorrow 20:00.
* "下午三点" → 15:00
* "晚上八点" → 20:00
* "上午九点" → 09:00
* "明天" → ${getTomorrow(currentDate)}
* "后天" → ${getDayAfterTomorrow(currentDate)}
* "半小时" → 30 minutes
* "一小时半" → 90 minutes
* No end time specified → default 60 minutes
* Never guess project IDs — use the ones provided in context.

PROJECT MATCHING:
* If user mentions a project name directly (e.g. "准备ESAT&TARA", "数学"), try to match it to one from the available projects list.
* If user uses #projectname syntax, match that.
* If no match found or no project mentioned, leave projectName as null and projectId empty.
* NEVER invent new projects.

RULES:
* Output JSON ONLY. No markdown, no code fences, no explanation outside JSON.
* Keep titles short and concrete.
* Use Chinese for all text.
* If unsure, ask a clarification in reply and return actions: [].
* Never claim data was already modified.
* Include the "steps" array with at least 2 steps showing progress.`;

    const contextPrompt = `

ADDITIONAL NAVOPATH CONTEXT:
${activeTasksInfo ? `${activeTasksInfo}\n` : ""}
${eventsInfo ? `${eventsInfo}\n` : ""}
${notesInfo ? `${notesInfo}\n` : ""}
${focusTaskInfo ? `${focusTaskInfo}\n` : ""}
${memoryInfo}

CONVERSATION AND MEMORY RULES:
* Use recent conversation to resolve pronouns like "it", "that one", "continue", "刚才那个", "它", and "继续".
* Treat long-term memory as user preference context, but the latest user message wins.
* Return JSON only. You may include a "memories" array in the response: [{"content":"stable preference in Chinese","tags":["preference"]}].
* Only return memories for explicit "remember this" requests, stable preferences, recurring constraints, or durable planning habits.
* Do not put memory writes in "actions"; use the top-level "memories" field.
`;
    const finalSystemPrompt = `${systemPrompt}${contextPrompt}`;

    // Build natural language user message with context
    let userContent = message;
    if (context?.taskId && context?.taskTitle) {
      userContent = `[focus task: "${context.taskTitle}"]\n${message}`;
    }
    if (context?.scheduledToday) {
      const scheduled = context.scheduledToday as Array<{title: string; start: string; end: string}>;
      if (scheduled.length > 0) {
        userContent += `\n\nExisting schedule on current view date ${String(context?.currentViewDate || currentDate)} (avoid conflicts when planning that date):\n${scheduled.map((t: any) => `${t.start}-${t.end}: ${t.title}`).join('\n')}`;
      }
    }

    // Call DeepSeek API
    const messages = [
      { role: "system", content: finalSystemPrompt },
      ...historyMessages,
      { role: "user", content: userContent },
    ];
    const dsResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages,
        response_format: { type: "json_object" },
        max_tokens: mode === "import_schedule" ? 6000 : mode === "summarize_memory" ? 600 : 1600,
        stream: false,
      }),
    });

    if (!dsResponse.ok) {
      const errorText = await dsResponse.text();
      console.error("DeepSeek API error:", dsResponse.status, errorText);
      return new Response(
        JSON.stringify({
          reply: "AI 请求失败，请稍后重试。",
          actions: [],
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const dsData = await dsResponse.json();
    const content = dsData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({
          reply: "AI 未返回有效内容。",
          actions: [],
        }),
        { headers: corsHeaders }
      );
    }

    // Try to parse the content as JSON (with markdown fence handling)
    try {
      const parsed = extractJsonObject(content);
      return new Response(JSON.stringify(parsed), { headers: corsHeaders });
    } catch {
      // If JSON parse fails and content looks like text, return as plain reply
      if (typeof content === "string" && content.trim().length > 0) {
        return new Response(
          JSON.stringify({
            reply: content,
            actions: [],
          }),
          { headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({
          reply: "AI 返回格式异常，请重试。",
          actions: [],
        }),
        { headers: corsHeaders }
      );
    }
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        reply: "AI 服务异常，请稍后重试。",
        actions: [],
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
