import assert from "node:assert/strict";
import test from "node:test";
import { runCloudDecision, validateCloudDecisionEnvelope } from "./cloudDecision.ts";

const strictTool = {
  type: "function",
  function: {
    name: "batch_update_tasks",
    strict: true,
    parameters: { type: "object", additionalProperties: false, required: ["operations"], properties: { operations: { type: "array" } } },
  },
};

test("accepts only the bounded strict cloud decision tool", () => {
  assert.deepEqual(validateCloudDecisionEnvelope({ context: { trigger: "morning" }, tool: strictTool }).tool, strictTool);
  assert.throws(() => validateCloudDecisionEnvelope({ context: {}, tool: { ...strictTool, function: { ...strictTool.function, strict: false } } }), /Invalid cloud decision tool/);
  assert.throws(() => validateCloudDecisionEnvelope({ context: {}, tool: { ...strictTool, function: { ...strictTool.function, name: "delete_task" } } }), /Invalid cloud decision tool/);
});

test("rejects oversized model context before provider submission", () => {
  assert.throws(() => validateCloudDecisionEnvelope({ context: { excerpt: "x".repeat(310_000) }, tool: strictTool }), /context is too large/);
});

test("forces one strict batch tool call through the provider request", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any = null;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({ model: "deepseek-ai/DeepSeek-V4-Flash", choices: [{ message: { tool_calls: [{ function: { name: "batch_update_tasks", arguments: "{\"summary\":\"ok\",\"reason\":\"none\",\"operations\":[],\"notification\":null}" } }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await runCloudDecision("secret", "https://provider.example/v1", "deepseek-ai/DeepSeek-V4-Flash", { context: { trigger: "morning" }, tool: strictTool });
    assert.equal(response.toolCall.name, "batch_update_tasks");
    assert.equal(requestBody.tools[0].function.strict, true);
    assert.deepEqual(requestBody.tool_choice, { type: "function", function: { name: "batch_update_tasks" } });
    assert.equal(requestBody.parallel_tool_calls, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
