// Supabase Edge Function: AI Assistant proxy for DeepSeek
// Deploy: supabase functions deploy ai-assistant
// Set secret: supabase secrets set DEEPSEEK_API_KEY=sk-xxx

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

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

function normalizeAssistantPayload(value: unknown) {
  const parsed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "已完成。",
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    memories: Array.isArray(parsed.memories) ? parsed.memories : [],
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
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

    if (!mode || !message) {
      return new Response(JSON.stringify({ error: "Missing mode or message" }), { status: 400, headers: corsHeaders });
    }

    const validModes = ["chat", "suggest_subtasks", "parse_task", "plan_day", "import_schedule", "summarize_memory"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `Invalid mode. Must be one of: ${validModes.join(", ")}` }),
        { status: 400, headers: corsHeaders },
      );
    }

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }), { status: 500, headers: corsHeaders });
    }

    const currentDate = (context?.currentDate as string) || new Date().toISOString().slice(0, 10);
    const timezone = (context?.timezone as string) || "Asia/Shanghai";
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

    const summarizeMemoryPrompt = `You compress selected NavoPath conversation turns into one durable AI memory.
Today's date is ${currentDate}. Timezone is ${timezone}.
Return JSON only: {"reply":"one concise Chinese memory, max 120 Chinese characters","actions":[],"memories":[]}.
Capture stable user preferences, constraints, facts, plans, or decisions. Do not summarize temporary chatter. If there is no durable memory, reply with the most useful factual context from the selected turns.`;

    const importSchedulePrompt = `You import schedules from extracted document text into NavoPath.
Today's date is ${currentDate}. Timezone is ${timezone}.
Classify fixed commitments, classes, meetings, exams, and appointments as events. Classify actionable work as tasks.
Return JSON only: {"reply":"中文摘要","steps":[{"label":"解析文件","status":"done"}],"actions":[...]}.
Every action must have:
{"type":"import_schedule_item","kind":"task|event","title":"short title","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD optional","startTime":"HH:mm optional","endTime":"HH:mm optional","durationMinutes":60,"category":"exam|uk|us|essay|materials|project|personal","priority":"high|medium|low","projectId":"existing id or empty","projectName":"existing name or null","notes":"source detail","recurrence":{"mode":"scheduled","frequency":"daily|weekdays|weekends|weekly|biweekly|monthly|quarterly","startDate":"YYYY-MM-DD","startTime":"HH:mm","durationMinutes":60,"endDate":"YYYY-MM-DD optional","count":10 optional},"warning":"optional uncertainty"}.
Use recurrence only when explicitly stated, or when a date range plus strong context such as a class timetable supports a reliable inference. Otherwise keep the item single.
Never invent project IDs. Omit invalid or content-free items. Use Chinese text. ${projectsInfo}`;

    const chatPrompt = `You are the AI scheduling assistant inside NavoPath, a time-blocking execution app.
Your job: turn the user's natural language into structured scheduled task actions like TrevorAI, using concise Chinese text.

IMPORTANT CONTEXT:
* Today's date is ${currentDate}. Calculate all relative dates from this.
* Timezone: ${timezone}. The user is in China.
* Use 24-hour time format (HH:mm).
${projectsInfo ? `\n${projectsInfo}\n` : ""}
${scheduledTodayInfo ? `\n${scheduledTodayInfo}\n` : ""}

Return valid JSON only. Do not use markdown, code fences, comments, or prose outside JSON.
Use this exact top-level shape:
{
  "reply": "已经帮你把「设计火箭模型」安排在今晚20:45，时长60分钟。",
  "steps": [
    { "label": "解析用户请求", "status": "done" },
    { "label": "生成计划", "status": "done" }
  ],
  "actions": [
    {
      "type": "create_scheduled_task",
      "title": "the task title",
      "projectId": "matching project id from context, or empty",
      "projectName": "matching project name, e.g. 准备ESAT&TARA, or null",
      "date": "YYYY-MM-DD",
      "start": "HH:mm",
      "end": "HH:mm",
      "durationMinutes": 60,
      "reason": "brief note, e.g. 用户说今天晚上设计火箭模型"
    }
  ],
  "memories": []
}

ACTION RULES:
* If there is nothing to schedule, return {"reply":"需要更多信息才能安排。","steps":[...],"actions":[],"memories":[]}.
* For flexible work the user wants to do, use "create_scheduled_task".
* For fixed commitments, classes, meetings, exams, appointments, deadlines with exact external time, or anything the user would not freely move, use:
{"type":"import_schedule_item","kind":"event","title":"short title","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","durationMinutes":60,"projectId":"matching project id or empty","projectName":"matching project name or null","notes":"brief source note"}.
* Never put raw JSON inside reply. The reply must be a normal sentence for the user.
* Never claim the app has already saved data. Say what you prepared or arranged for confirmation.

TIME PARSING RULES:
* "今天晚上" -> if before 18:00, schedule at 20:00; if 18:00-21:00, schedule at the next available time; if after 21:00, schedule tomorrow at 20:00.
* "下午三点" -> 15:00.
* "晚上八点" -> 20:00.
* "上午九点" -> 09:00.
* "明天" -> ${getTomorrow(currentDate)}.
* "后天" -> ${getDayAfterTomorrow(currentDate)}.
* "半小时" -> 30 minutes.
* "一个半小时" -> 90 minutes.
* If no end time is specified, default to 60 minutes.
* Never guess project IDs; use only IDs provided in context.

PROJECT MATCHING:
* If the user mentions a project name directly, e.g. "准备ESAT&TARA" or "数学", match it to available projects.
* If the user uses #projectname syntax, match that.
* If no match is found, leave projectName as null and projectId empty.
* Never invent new projects.`;

    const systemPrompt = mode === "summarize_memory"
      ? summarizeMemoryPrompt
      : mode === "import_schedule"
        ? importSchedulePrompt
        : chatPrompt;

    const contextPrompt = `

ADDITIONAL NAVOPATH CONTEXT:
${activeTasksInfo ? `${activeTasksInfo}\n` : ""}
${eventsInfo ? `${eventsInfo}\n` : ""}
${notesInfo ? `${notesInfo}\n` : ""}
${focusTaskInfo ? `${focusTaskInfo}\n` : ""}
${memoryInfo}

CONVERSATION AND MEMORY RULES:
* Use recent conversation to resolve pronouns like "it", "that one", "continue", "刚才那个", "它", and "继续".
* Treat long-term memory as preference context. The latest user message always wins.
* You may include a top-level "memories" array: [{"content":"stable preference in Chinese","tags":["preference"]}].
* Only return memories for explicit "remember this" requests, stable preferences, recurring constraints, or durable planning habits.
* Do not put memory writes in "actions"; use the top-level "memories" field.`;
    const finalSystemPrompt = `${systemPrompt}${contextPrompt}`;

    let userContent = message;
    if (context?.taskId && context?.taskTitle) userContent = `[focus task: "${context.taskTitle}"]\n${message}`;
    if (context?.scheduledToday) {
      const scheduled = context.scheduledToday as Array<{ title: string; start: string; end: string }>;
      if (scheduled.length > 0) {
        userContent += `\n\nExisting schedule on current view date ${String(context?.currentViewDate || currentDate)} (avoid conflicts when planning that date):\n${scheduled.map((item) => `${item.start}-${item.end}: ${item.title}`).join("\n")}`;
      }
    }

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
      return new Response(JSON.stringify({ reply: "AI 请求失败，请稍后重试。", actions: [], steps: [] }), { status: 502, headers: corsHeaders });
    }

    const dsData = await dsResponse.json();
    const content = dsData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ reply: "AI 未返回有效内容。", actions: [], steps: [] }), { headers: corsHeaders });
    }

    try {
      return new Response(JSON.stringify(normalizeAssistantPayload(extractJsonObject(content))), { headers: corsHeaders });
    } catch {
      if (typeof content === "string" && content.trim()) {
        return new Response(JSON.stringify({ reply: content.trim(), actions: [], steps: [], memories: [] }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ reply: "AI 返回格式异常，请重试。", actions: [], steps: [] }), { headers: corsHeaders });
    }
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ reply: "AI 服务异常，请稍后重试。", actions: [], steps: [] }), { status: 500, headers: corsHeaders });
  }
});
