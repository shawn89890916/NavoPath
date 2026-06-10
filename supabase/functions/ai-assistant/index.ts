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
    const { mode, message, context } = body as {
      mode?: string;
      message?: string;
      context?: unknown;
    };

    // Validate required fields
    if (!mode || !message) {
      return new Response(
        JSON.stringify({ error: "Missing mode or message" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const validModes = ["chat", "suggest_subtasks", "parse_task", "plan_day"];
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

    // Build system prompt
    const systemPrompt = `You are the AI assistant inside NavoPath, a planning and execution app.

You help users:
* break projects into tasks and subtasks
* turn natural language into task data
* plan a day
* improve task clarity

You must return valid json only.

Return exactly this JSON shape:
{
  "reply": "short Chinese explanation for the user",
  "actions": [
    {
      "type": "create_subtasks" | "create_task" | "schedule_task" | "plan_day" | "none",
      "taskId": "optional string",
      "projectId": "optional string",
      "title": "optional string",
      "subtasks": [
        {
          "title": "short actionable Chinese task title",
          "estimateMinutes": 30
        }
      ],
      "date": "optional YYYY-MM-DD",
      "start": "optional HH:mm",
      "end": "optional HH:mm",
      "reason": "optional Chinese reason"
    }
  ]
}

Rules:
* Output json only.
* Do not output markdown.
* Do not output explanation outside json.
* Do not invent projectId or taskId.
* If taskId is provided in context, use it.
* If projectId is provided in context, use it.
* Keep titles short, concrete, and actionable.
* Use Chinese by default.
* If unsure, ask a clarification in reply and return actions: [].
* Never claim that data has already been modified.
* Never directly modify user data.
* Subtask titles must be specific and actionable, not vague phrases.`;

    // Call DeepSeek API
    const dsResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ mode, message, context }) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1600,
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

    // Try to parse the content as JSON
    try {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify(parsed), { headers: corsHeaders });
    } catch {
      // If AI response is not valid JSON, return as plain reply
      return new Response(
        JSON.stringify({
          reply: content,
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
