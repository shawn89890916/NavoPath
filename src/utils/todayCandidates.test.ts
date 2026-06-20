import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { promoteSubtaskToToday, toggleTodayCandidate } from "./todayCandidates";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Draft essay",
    dueDate: "",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

function data(tasks: Task[]): PlannerData {
  return {
    version: 2,
    importedSeedVersion: "test",
    generatedAt: "2026-06-20T00:00:00.000Z",
    goals: [], projects: [], tasks, longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [],
  };
}

describe("today candidate transformations", () => {
  it("adds a task to today and clears scheduling", () => {
    const source = data([task({ scheduledDate: "2026-06-21", scheduledStart: "09:00", scheduledEnd: "10:00", timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-06-21", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }] })]);
    const result = toggleTodayCandidate(source, "task-1", "2026-06-20", "now");
    expect(result.action).toBe("added");
    expect(result.data.tasks[0]).toMatchObject({ plannedForDate: "2026-06-20", executionLane: "candidate", timelineRecords: [] });
    expect(result.data.tasks[0].scheduledStart).toBeUndefined();
  });

  it("removes an existing today candidate without duplicating it", () => {
    const source = data([task({ plannedForDate: "2026-06-20", executionLane: "candidate" })]);
    const result = toggleTodayCandidate(source, "task-1", "2026-06-20", "now");
    expect(result.action).toBe("removed");
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasks[0].plannedForDate).toBeUndefined();
  });

  it("promotes a nested subtask once", () => {
    const source = data([task({ subtasks: [{ id: "sub-1", title: "Collect sources", completed: false, createdAt: "now" }] })]);
    const first = promoteSubtaskToToday(source, "task-1", "sub-1", "2026-06-20", () => "promoted-1", "now");
    const second = promoteSubtaskToToday(first.data, "task-1", "sub-1", "2026-06-20", () => "promoted-2", "now");
    expect(first.action).toBe("added");
    expect(first.data.tasks[1]).toMatchObject({ id: "promoted-1", parentTaskId: "task-1", title: "Collect sources", executionLane: "candidate" });
    expect(second.action).toBe("existing");
    expect(second.data.tasks).toHaveLength(2);
  });
});
