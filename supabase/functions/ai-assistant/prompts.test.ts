import test from "node:test";
import assert from "node:assert/strict";
import { chatPrompt, globalAgentPrompt, type PromptContext } from "./prompts.ts";

const context: PromptContext = {
  language: "zh",
  currentDate: "2026-08-28",
  timezone: "Asia/Shanghai",
  tomorrow: "2026-08-29",
  dayAfterTomorrow: "2026-08-30",
  projectsInfo: "",
  scheduledTodayInfo: "",
  activeTasksInfo: "",
  eventsInfo: "",
  notesInfo: "",
  focusTaskInfo: "",
  memoryInfo: "Long-term user memory: none supplied.",
};

test("global agent describes the deployed cloud automation instead of legacy brief settings", () => {
  const prompt = globalAgentPrompt(context);
  assert.match(prompt, /always-online cloud worker/);
  assert.match(prompt, /08:30 and 20:30 Asia\/Shanghai/);
  assert.match(prompt, /activeMode and aiBriefsEnabled/);
  assert.match(prompt, /Never claim NavoPath lacks scheduled triggers/);
});

test("regular chat receives the same authoritative automation capability inventory", () => {
  const prompt = chatPrompt(context);
  assert.match(prompt, /Signed incremental workspace events/);
  assert.match(prompt, /audited, idempotent, and undoable/);
  assert.match(prompt, /Do not claim that the current account is enabled/);
});

test("global agent final responses declare Markdown format", () => {
  const prompt = globalAgentPrompt(context);
  assert.match(prompt, /"format":"markdown"/);
  assert.match(prompt, /Never include raw HTML/);
});
