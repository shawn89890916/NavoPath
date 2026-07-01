import { describe, expect, it } from "vitest";
import type { PlannerData, Settings } from "../types";
import { buildCommandSearchIndex, searchCommands } from "./commandSearch";

const data = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [],
  tasks: [{ id: "task-1", title: "Read ESAT notes", dueDate: "2026-07-01", category: "exam", priority: null, notes: "", goalId: "", completed: false, timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEndDate: "2026-07-01", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }], createdAt: "now", updatedAt: "now" }],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
  habits: [{ id: "habit-1", title: "Stretch", defaultDurationMinutes: 15, createdAt: "now", updatedAt: "now" }],
  habitDailyStates: [{ id: "state-1", habitId: "habit-1", date: "2026-07-01", completed: false, timelineRecordId: "r1", createdAt: "now", updatedAt: "now" }],
} as PlannerData;

describe("command search", () => {
  it("finds scheduled tasks and exposes focus target", () => {
    const result = searchCommands(buildCommandSearchIndex(data, {} as Settings), "esat")[0];
    expect(result.title).toBe("Read ESAT notes");
    expect(result.focusTarget).toEqual({ date: "2026-07-01", recordId: "r1", taskId: "task-1", time: "09:00" });
  });

  it("indexes habits and settings", () => {
    const titles = searchCommands(buildCommandSearchIndex(data, {} as Settings), "stretch").map((item) => item.title);
    expect(titles).toContain("Stretch");
    expect(searchCommands(buildCommandSearchIndex(data, {} as Settings), "shortcuts")[0].kind).toBe("setting");
  });
});
