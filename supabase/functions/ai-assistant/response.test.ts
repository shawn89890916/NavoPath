import test from "node:test";
import assert from "node:assert/strict";
import { unwrapReplyLayers } from "./response.ts";

test("preserves ordinary Markdown code fences", () => {
  const markdown = "下面是示例：\n\n```ts\nconst answer = 42;\n```";
  assert.equal(unwrapReplyLayers(markdown), markdown);
});

test("preserves a standalone non-JSON Markdown code fence", () => {
  const markdown = "```python\nprint('hello')\n```";
  assert.equal(unwrapReplyLayers(markdown), markdown);
});

test("unwraps complete nested structured replies", () => {
  const nested = JSON.stringify({ reply: JSON.stringify({ reply: "## 结果\n\n- 第一项" }) });
  assert.equal(unwrapReplyLayers(nested), "## 结果\n\n- 第一项");
});

test("unwraps a complete fenced JSON response", () => {
  assert.equal(unwrapReplyLayers("```json\n{\"reply\":\"**完成**\"}\n```"), "**完成**");
});

test("keeps malformed or unrelated JSON unchanged", () => {
  assert.equal(unwrapReplyLayers("{not-json}"), "{not-json}");
  assert.equal(unwrapReplyLayers('{"value":1}'), '{"value":1}');
});
