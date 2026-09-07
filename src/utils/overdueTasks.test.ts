import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { reconcileOverdueTasks } from "./overdueTasks";

const baseTask = (patch: Partial<Task> = {}): Task => ({
  id: "task-1", title: "Read", dueDate: "", category: "exam", priority: "medium", notes: "", goalId: "", completed: false,
  createdAt: "now", updatedAt: "now", ...patch,
});
const data = (task: Task): PlannerData => ({
  version: 1, importedSeedVersion: "test", generatedAt: "now", goals: [], projects: [], tasks: [task],
  longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [],
});

describe("reconcileOverdueTasks", () => {
  it("leaves an unscheduled Planning task without a manual due date alone", () => {
    const result = reconcileOverdueTasks(data(baseTask({ dueDate: "2026-09-01", dueDateSource: "automatic" })), "2026-09-07", "now");
    expect(result.changed).toBe(false);
    expect(result.data.tasks[0].plannedForDate).toBeUndefined();
  });

  it("returns a manually overdue task to today", () => {
    const result = reconcileOverdueTasks(data(baseTask({ dueDate: "2026-09-01", dueDateSource: "manual" })), "2026-09-07", "now");
    expect(result.data.tasks[0]).toMatchObject({ plannedForDate: "2026-09-07", executionLane: "candidate" });
    expect(result.overdueReturnedCount).toBe(1);
  });

  it("keeps yesterday's block and marks it unfinished while returning its task to candidates", () => {
    const task = baseTask({ timelineRecords: [{ id: "record-1", taskId: "task-1", scheduledDate: "2026-09-06", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }] });
    const result = reconcileOverdueTasks(data(task), "2026-09-07", "now");
    expect(result.data.tasks[0]).toMatchObject({ plannedForDate: "2026-09-07", executionLane: "candidate" });
    expect(result.data.tasks[0].timelineRecords?.[0].executionStatus).toBe("returned_unfinished");
  });
});
