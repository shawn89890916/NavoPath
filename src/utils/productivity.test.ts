import { describe, expect, it, vi } from "vitest";
import type { PlannerData, Task, TimeEntry } from "../types";
import { applyIdlePolicy, buildProjectMetrics, heatmapBuckets, inferWorkflowStatus, kanbanGroups } from "./productivity";

const baseTask: Task = {
  id: "task-1",
  title: "Draft essay",
  dueDate: "2026-06-30",
  category: "essay",
  priority: "high",
  notes: "",
  goalId: "",
  completed: false,
  estimatedHours: 2,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

function data(tasks: Task[], timeEntries: TimeEntry[] = []): PlannerData {
  return {
    version: 2,
    importedSeedVersion: "test",
    generatedAt: "2026-06-01T00:00:00.000Z",
    goals: [],
    projects: [{ id: "project-1", title: "Applications", category: "project", notes: "", completed: false, createdAt: "now", updatedAt: "now" }],
    tasks,
    timeEntries,
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
  };
}

it("infers workflow status from completion and planning state", () => {
  expect(inferWorkflowStatus({ ...baseTask, completed: true })).toBe("done");
  expect(inferWorkflowStatus({ ...baseTask, timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-06-30", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }] })).toBe("doing");
  expect(inferWorkflowStatus({ ...baseTask, plannedForDate: "2026-06-30" })).toBe("next");
  expect(inferWorkflowStatus(baseTask)).toBe("backlog");
});

it("groups tasks for kanban by normalized workflow status", () => {
  const groups = kanbanGroups([
    baseTask,
    { ...baseTask, id: "task-2", workflowStatus: "waiting" },
    { ...baseTask, id: "task-3", completed: true },
  ]);
  expect(groups.backlog).toHaveLength(1);
  expect(groups.waiting).toHaveLength(1);
  expect(groups.done).toHaveLength(1);
});

it("builds project metrics from matching time entries", () => {
  const source = data([{ ...baseTask, projectId: "project-1", completed: true, completedAt: "2026-06-30T10:00:00.000Z" }], [
    { id: "entry-1", taskId: "task-1", projectId: "project-1", startAt: "2026-06-30T08:00:00.000Z", endAt: "2026-06-30T09:30:00.000Z", durationMinutes: 90, source: "timer", createdAt: "now", updatedAt: "now" },
  ]);
  const metrics = buildProjectMetrics(source, source.projects[0], { projectId: "project-1", category: "all", priority: "all", workflowStatus: "all", completion: "all", timeRange: "all", timed: "all", scheduled: "all", keyword: "" });
  expect(metrics.completedCount).toBe(1);
  expect(metrics.actualMinutes).toBe(90);
  expect(metrics.estimateDeltaMinutes).toBe(-30);
});

it("generates heatmap buckets with levels", () => {
  const buckets = heatmapBuckets([
    { id: "entry-1", taskId: "task-1", startAt: "2026-06-29T08:00:00.000Z", endAt: "2026-06-29T10:00:00.000Z", durationMinutes: 120, source: "timer", createdAt: "now", updatedAt: "now" },
  ], 2, new Date("2026-06-30T12:00:00.000Z"));
  expect(buckets.map((bucket) => bucket.date)).toEqual(["2026-06-29", "2026-06-30"]);
  expect(buckets[0].level).toBe(3);
});

it("attributes timestamped entries to their local heatmap day and streak", () => {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-07-28T16:30:00.000Z"));
    const entries: TimeEntry[] = [
      { id: "today", taskId: "task-1", startAt: "2026-07-28T16:30:00.000Z", endAt: "2026-07-28T17:30:00.000Z", durationMinutes: 60, source: "timer", createdAt: "now", updatedAt: "now" },
      { id: "yesterday", taskId: "task-1", startAt: "2026-07-27T16:30:00.000Z", endAt: "2026-07-27T17:30:00.000Z", durationMinutes: 60, source: "timer", createdAt: "now", updatedAt: "now" },
    ];

    expect(heatmapBuckets(entries, 1, new Date())).toEqual([{
      date: "2026-07-29",
      minutes: 60,
      level: 2,
    }]);
    expect(buildProjectMetrics(
      data([{ ...baseTask, projectId: "project-1" }], entries),
      null,
      { projectId: "all", category: "all", priority: "all", workflowStatus: "all", completion: "all", timeRange: "all", timed: "all", scheduled: "all", keyword: "" },
    ).activeStreak).toBe(2);
  } finally {
    vi.useRealTimers();
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

it("applies idle policies without producing negative durations", () => {
  expect(applyIdlePolicy("2026-06-30T08:00:00.000Z", "2026-06-30T09:00:00.000Z", "2026-06-30T08:40:00.000Z", "keep")).toEqual({ durationMinutes: 60, idleMinutes: 0 });
  expect(applyIdlePolicy("2026-06-30T08:00:00.000Z", "2026-06-30T09:00:00.000Z", "2026-06-30T08:40:00.000Z", "discard")).toEqual({ durationMinutes: 40, idleMinutes: 20 });
});
