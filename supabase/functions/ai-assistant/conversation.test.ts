import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationContinuation } from "./conversation.ts";

test("merges a time-only clarification with the prior task", () => {
  const result = buildConversationContinuation([
    { role: "user", content: "写个更新日志" },
    { role: "assistant", content: "请问你想把“写个更新日志”安排在什么时间？比如今天晚上8点？" },
  ], "今早8:00");

  assert.match(result || "", /原始请求：写个更新日志/);
  assert.match(result || "", /用户本轮补充：今早8:00/);
});

test("does not rewrite a complete new request", () => {
  const result = buildConversationContinuation([
    { role: "user", content: "写个更新日志" },
    { role: "assistant", content: "你希望安排在几点？" },
  ], "帮我规划明天的全部数学复习任务，并避开下午的课程");

  assert.equal(result, null);
});

test("walks past an earlier short clarification to find the subject", () => {
  const result = buildConversationContinuation([
    { role: "user", content: "完成机械臂算法" },
    { role: "assistant", content: "安排在哪天？" },
    { role: "user", content: "明天" },
    { role: "assistant", content: "几点开始？" },
  ], "20:00");

  assert.match(result || "", /原始请求：完成机械臂算法/);
});
