import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationContinuation } from "./conversation.ts";
import { suggestSubtasksPrompt } from "./prompts.ts";

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

test("subtask mode requires a visible create_subtasks action for the focused task", () => {
  const prompt = suggestSubtasksPrompt({
    language: "zh",
    currentDate: "2026-07-15",
    timezone: "Asia/Shanghai",
    tomorrow: "2026-07-16",
    dayAfterTomorrow: "2026-07-17",
    projectsInfo: "",
    scheduledTodayInfo: "",
    activeTasksInfo: "",
    eventsInfo: "",
    notesInfo: "",
    focusTaskInfo: 'Focused task: {"id":"task-1","title":"准备展示"}',
    memoryInfo: "Long-term user memory: none supplied.",
  });

  assert.match(prompt, /"type":"create_subtasks"/);
  assert.match(prompt, /"taskId":"the supplied task id"/);
  assert.match(prompt, /3-8 non-overlapping subtasks/);
});
