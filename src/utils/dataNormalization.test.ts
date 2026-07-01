import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { normalizePlannerDataForClient } from "./dataNormalization";

describe("data normalization", () => {
  it("keeps legacy plugin habits and backfills cross-day fields", () => {
    const legacy = {
      version: 1,
      importedSeedVersion: "",
      generatedAt: "now",
      goals: [],
      projects: [],
      tasks: [{
        id: "task-1",
        title: "Legacy",
        dueDate: "2026-07-01",
        category: "personal",
        priority: "medium",
        notes: "",
        goalId: "",
        completed: false,
        timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }],
        createdAt: "now",
        updatedAt: "now",
      }],
      longTasks: [],
      events: [],
      notes: [],
      drafts: [],
      chat: [],
      aiMemories: [],
      pluginConfigs: { "habit-tracker": { habits: "Read" } },
    } as PlannerData;
    const normalized = normalizePlannerDataForClient(legacy);
    expect(normalized.tasks[0].timelineRecords?.[0].scheduledEndDate).toBe("2026-07-01");
    expect(normalized.habits?.[0].title).toBe("Read");
    expect(normalized.pluginConfigs?.["habit-tracker"]?.habits).toBe("Read");
  });
});
