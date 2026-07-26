import { describe, expect, it } from "vitest";
import type { AiMemory, ChatMessage, PlannerData, Task } from "./types";
import {
  buildAiContext,
  cleanAiHistoryContent,
  compactText,
  extractLocalMemories,
  mergeAiMemories,
  pickMemoriesForContext,
  toAiHistory,
} from "./aiContext";

function task(id: string, dueDate: string, completed = false): Task {
  return {
    id,
    title: `Task ${id}`,
    dueDate,
    category: "personal",
    priority: "medium",
    notes: "  Notes   with spacing  ",
    goalId: "",
    completed,
    estimatedHours: 1,
    subtasks: [],
    order: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function plannerData(): PlannerData {
  return {
    version: 1,
    importedSeedVersion: "test",
    generatedAt: "2026-07-01T00:00:00.000Z",
    goals: [],
    projects: [],
    tasks: [],
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
  };
}

function chat(id: string, role: "user" | "assistant", content: string): ChatMessage {
  return { id, role, content, createdAt: "2026-07-01T00:00:00.000Z" };
}

function memory(id: string, content: string, updatedAt: string, patch: Partial<AiMemory> = {}): AiMemory {
  return {
    id,
    content,
    tags: [],
    createdAt: updatedAt,
    updatedAt,
    source: "auto",
    ...patch,
  };
}

describe("AI context", () => {
  it("compacts text and summarizes active planner data", () => {
    const data = plannerData();
    const scheduled = task("scheduled", "2026-07-26");
    scheduled.scheduledDate = "2026-07-26";
    scheduled.scheduledStart = "09:00";
    scheduled.estimatedHours = 1;
    data.tasks = [task("later", "2026-07-28"), scheduled, task("done", "2026-07-25", true)];

    const context = buildAiContext(data, { date: "2026-07-26", mode: "execute" });

    expect(compactText("  one   two  ", 20)).toBe("one two");
    expect(context.activeTasks.map((item) => item.id)).toEqual(["scheduled", "later"]);
    expect(context.activeTasks[0].notes).toBe("Notes with spacing");
    expect(context.scheduledToday).toEqual([
      { id: "scheduled", title: "Task scheduled", start: "09:00", end: "10:00", projectId: undefined },
    ]);
  });
});

describe("AI history", () => {
  it("cleans nested reply JSON and prefers completed local messages", () => {
    const local = [
      { role: "user" as const, content: "local", status: "done" as const },
      { role: "assistant" as const, content: "thinking", status: "thinking" as const },
      { role: "assistant" as const, content: '{"reply":" cleaned "}', status: "done" as const },
    ];
    const fallback = [chat("fallback", "user", "fallback")];
    const conversation = [chat("conversation", "user", "conversation")];

    expect(cleanAiHistoryContent('{"reply":"answer"}')).toBe("answer");
    expect(toAiHistory(local, fallback, conversation)).toEqual([
      { role: "user", content: "local" },
      { role: "assistant", content: "cleaned" },
    ]);
  });

  it("uses conversation history before the global fallback", () => {
    expect(toAiHistory([], [chat("fallback", "user", "fallback")], [chat("conversation", "assistant", "conversation")]))
      .toEqual([{ role: "assistant", content: "conversation" }]);
  });
});

describe("AI memories", () => {
  it("extracts explicit preferences and ignores ordinary messages", () => {
    expect(extractLocalMemories("以后尽量把复习安排在上午")).toEqual([
      { content: "以后尽量把复习安排在上午", tags: ["user-preference"] },
    ]);
    expect(extractLocalMemories("帮我安排明天")).toEqual([]);
  });

  it("puts pinned memories first and excludes archived memories", () => {
    const memories = [
      memory("old", "old", "2026-07-01T00:00:00.000Z"),
      memory("new", "new", "2026-07-03T00:00:00.000Z"),
      memory("pinned", "pinned", "2026-07-02T00:00:00.000Z", { pinned: true }),
      memory("archived", "archived", "2026-07-04T00:00:00.000Z", { archived: true }),
    ];

    expect(pickMemoriesForContext(memories).map((item) => item.content)).toEqual(["pinned", "new", "old"]);
  });

  it("deduplicates memory patches case-insensitively", () => {
    const data = plannerData();
    data.aiMemories = [memory("existing", "Morning study", "2026-07-01T00:00:00.000Z")];

    const merged = mergeAiMemories(data, [
      { content: " morning study " },
      { content: "Evening review", tags: ["routine"] },
    ]);

    expect(merged.map((item) => item.content)).toEqual(["Morning study", "Evening review"]);
  });
});
