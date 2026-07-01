import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { buildTimeShareMetrics } from "./timeShareMetrics";

const task: Task = {
  id: "task-1",
  title: "Study",
  dueDate: "2026-07-01",
  category: "exam",
  priority: null,
  importance: "high",
  urgency: "low",
  notes: "",
  goalId: "",
  completed: false,
  projectId: "project-1",
  timelineRecords: [{ id: "record-1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEndDate: "2026-07-01", scheduledEnd: "10:30", executionStatus: "scheduled", createdAt: "now" }],
  createdAt: "now",
  updatedAt: "now",
};

const data: PlannerData = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [{ id: "project-1", title: "Applications", category: "project", notes: "", completed: false, createdAt: "now", updatedAt: "now" }],
  tasks: [task],
  timeEntries: [{ id: "time-1", taskId: "task-1", projectId: "project-1", startAt: "2026-07-01T09:00:00.000Z", endAt: "2026-07-01T10:00:00.000Z", durationMinutes: 60, source: "timer", createdAt: "now", updatedAt: "now" }],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
};

describe("time share metrics", () => {
  it("separates actual tracked time from planned scheduled time", () => {
    expect(buildTimeShareMetrics(data, { mode: "actual", dimension: "project", range: "all" }).totalMinutes).toBe(60);
    expect(buildTimeShareMetrics(data, { mode: "planned", dimension: "project", range: "all" }).totalMinutes).toBe(90);
  });

  it("groups empty and explicit states", () => {
    const result = buildTimeShareMetrics(data, { mode: "planned", dimension: "importance", range: "all" });
    expect(result.segments).toEqual([{ key: "high", label: "High", minutes: 90, ratio: 1, taskIds: ["task-1"] }]);
  });
});
