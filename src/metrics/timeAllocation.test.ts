import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import {
  buildTimeAllocationMetrics,
  getMetricRange,
  parseDayStartMinutes,
} from "./timeAllocation";

const baseTask: Task = {
  id: "task-1",
  title: "Study",
  dueDate: "2026-07-06",
  category: "exam",
  priority: null,
  importance: "high",
  urgency: "low",
  notes: "",
  goalId: "",
  completed: false,
  projectId: "project-1",
  createdAt: "now",
  updatedAt: "now",
};

const baseData: PlannerData = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [
    { id: "project-1", title: "Applications", category: "project", notes: "", completed: false, color: "#D7816A", createdAt: "now", updatedAt: "now" },
    { id: "project-2", title: "ESAT", category: "project", notes: "", completed: false, color: "#7EA172", createdAt: "now", updatedAt: "now" },
  ],
  tasks: [],
  habits: [],
  habitDailyStates: [],
  timeEntries: [],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
};

function localStamp(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

describe("time allocation metrics", () => {
  it("builds day-start aware today and week ranges", () => {
    expect(parseDayStartMinutes("04:30")).toBe(270);

    const today = getMetricRange({ preset: "today", anchorDate: "2026-07-06", dayStartMinutes: 240 });
    expect(localStamp(today.start)).toBe("2026-07-06 04:00");
    expect(localStamp(today.end)).toBe("2026-07-07 04:00");

    const week = getMetricRange({ preset: "thisWeek", anchorDate: "2026-07-08", dayStartMinutes: 240 });
    expect(localStamp(week.start)).toBe("2026-07-06 04:00");
    expect(localStamp(week.end)).toBe("2026-07-13 04:00");
  });

  it("splits cross-day records by metric-day overlap", () => {
    const task: Task = {
      ...baseTask,
      timelineRecords: [
        { id: "record-1", taskId: "task-1", scheduledDate: "2026-07-06", scheduledStart: "23:00", scheduledEndDate: "2026-07-07", scheduledEnd: "01:00", executionStatus: "scheduled", createdAt: "now" },
      ],
    };

    const result = buildTimeAllocationMetrics({
      data: { ...baseData, tasks: [task] },
      range: { preset: "thisWeek", anchorDate: "2026-07-06" },
      dayStartMinutes: 0,
    });

    expect(result.summary.plannedMinutes).toBe(120);
    expect(result.heatmapBuckets.map((bucket) => [bucket.date, bucket.minutes])).toEqual([
      ["2026-07-06", 60],
      ["2026-07-07", 60],
    ]);
  });

  it("groups by project, keeps unassigned tasks, and ignores actual timer records", () => {
    const scheduled: Task = {
      ...baseTask,
      timelineRecords: [
        { id: "record-1", taskId: "task-1", scheduledDate: "2026-07-06", scheduledStart: "09:00", scheduledEndDate: "2026-07-06", scheduledEnd: "10:30", executionStatus: "scheduled", createdAt: "now" },
      ],
    };
    const unassigned: Task = {
      ...baseTask,
      id: "task-2",
      title: "Essay",
      projectId: undefined,
      completed: true,
      timelineRecords: [
        { id: "record-2", taskId: "task-2", scheduledDate: "2026-07-06", scheduledStart: "11:00", scheduledEndDate: "2026-07-06", scheduledEnd: "12:00", executionStatus: "scheduled", createdAt: "now" },
      ],
    };

    const result = buildTimeAllocationMetrics({
      data: {
        ...baseData,
        tasks: [scheduled, unassigned],
        timeEntries: [{ id: "time-1", taskId: "task-1", projectId: "project-1", startAt: "2026-07-06T09:00:00.000Z", endAt: "2026-07-06T13:00:00.000Z", durationMinutes: 240, source: "timer", createdAt: "now", updatedAt: "now" }],
      },
      range: { preset: "today", anchorDate: "2026-07-06" },
      dayStartMinutes: 0,
    });

    expect(result.summary.plannedMinutes).toBe(150);
    expect(result.groups.map((group) => [group.id, group.label, group.durationMinutes, Math.round(group.percentage)])).toEqual([
      ["project-1", "Applications", 90, 60],
      ["__unassigned__", "未归属", 60, 40],
    ]);
    expect(result.summary.completedTaskCount).toBe(1);
  });

  it("counts explicit timeline records across dates when range is all", () => {
    const task: Task = {
      ...baseTask,
      timelineRecords: [
        { id: "record-early", taskId: "task-1", scheduledDate: "2026-05-01", scheduledStart: "09:00", scheduledEndDate: "2026-05-01", scheduledEnd: "10:00", executionStatus: "completed", createdAt: "now" },
        { id: "record-late", taskId: "task-1", scheduledDate: "2026-07-06", scheduledStart: "14:00", scheduledEndDate: "2026-07-06", scheduledEnd: "15:30", executionStatus: "scheduled", createdAt: "now" },
      ],
    };

    const result = buildTimeAllocationMetrics({
      data: { ...baseData, tasks: [task] },
      range: { preset: "all", anchorDate: "2026-07-06" },
      dayStartMinutes: 0,
    });

    expect(result.range.label).toBe("全部");
    expect(result.summary.plannedMinutes).toBe(150);
    expect(result.summary.unplannedMinutes).toBe(0);
    expect(result.heatmapBuckets.map((bucket) => bucket.date)).toEqual(["2026-05-01", "2026-07-06"]);
  });

  it("includes habits by default and can filter them out", () => {
    const habitTask: Task = {
      ...baseTask,
      id: "habit-task-h1-2026-07-06",
      title: "Reading",
      projectId: "project-2",
      completed: false,
      timelineRecords: [
        { id: "habit-record-h1-2026-07-06-0800", taskId: "habit-task-h1-2026-07-06", scheduledDate: "2026-07-06", scheduledStart: "08:00", scheduledEndDate: "2026-07-06", scheduledEnd: "08:20", executionStatus: "scheduled", createdAt: "now" },
      ],
    };
    const data: PlannerData = {
      ...baseData,
      tasks: [habitTask],
      habits: [{ id: "h1", title: "Reading", defaultDurationMinutes: 20, createdAt: "now", updatedAt: "now" }],
      habitDailyStates: [{ id: "hs1", habitId: "h1", date: "2026-07-06", completed: true, timelineRecordId: "habit-record-h1-2026-07-06-0800", createdAt: "now", updatedAt: "now" }],
    };

    expect(buildTimeAllocationMetrics({ data, range: { preset: "today", anchorDate: "2026-07-06" }, dayStartMinutes: 0 }).summary.plannedMinutes).toBe(20);
    expect(buildTimeAllocationMetrics({ data, range: { preset: "today", anchorDate: "2026-07-06" }, dayStartMinutes: 0, habitMode: "exclude" }).summary.plannedMinutes).toBe(0);
    expect(buildTimeAllocationMetrics({ data, range: { preset: "today", anchorDate: "2026-07-06" }, dayStartMinutes: 0 }).summary.completedTaskCount).toBe(1);
  });

  it("counts visible non-cancelled timeline records including completed and returned blocks", () => {
    const completed: Task = {
      ...baseTask,
      id: "task-completed",
      title: "Completed schedule",
      completed: true,
      timelineRecords: [
        { id: "record-completed", taskId: "task-completed", scheduledDate: "2026-07-06", scheduledStart: "13:00", scheduledEndDate: "2026-07-06", scheduledEnd: "14:00", executionStatus: "completed", createdAt: "now" },
      ],
    };
    const returned: Task = {
      ...baseTask,
      id: "task-returned",
      title: "Returned schedule",
      completed: false,
      timelineRecords: [
        { id: "record-returned", taskId: "task-returned", scheduledDate: "2026-07-06", scheduledStart: "18:00", scheduledEndDate: "2026-07-06", scheduledEnd: "18:45", executionStatus: "returned_unfinished", createdAt: "now" },
      ],
    };
    const cancelled: Task = {
      ...baseTask,
      id: "task-cancelled",
      title: "Cancelled schedule",
      timelineRecords: [
        { id: "record-cancelled", taskId: "task-cancelled", scheduledDate: "2026-07-06", scheduledStart: "20:00", scheduledEndDate: "2026-07-06", scheduledEnd: "21:00", executionStatus: "cancelled", createdAt: "now" },
      ],
    };

    const result = buildTimeAllocationMetrics({
      data: { ...baseData, tasks: [completed, returned, cancelled] },
      range: { preset: "today", anchorDate: "2026-07-06" },
      dayStartMinutes: 0,
    });

    expect(result.summary.plannedMinutes).toBe(105);
    expect(result.summary.taskCount).toBe(2);
    expect(result.summary.completedTaskCount).toBe(1);
  });

  it("expands scheduled recurrence occurrences and respects cancellation exceptions", () => {
    const recurring: Task = {
      ...baseTask,
      id: "task-recurring",
      title: "Daily review",
      recurrence: {
        mode: "scheduled",
        frequency: "daily",
        startDate: "2026-07-01",
        startTime: "11:30",
        durationMinutes: 60,
      },
      timelineRecords: [
        { id: "record-cancelled", taskId: "task-recurring", scheduledDate: "2026-07-07", scheduledStart: "11:30", scheduledEndDate: "2026-07-07", scheduledEnd: "12:30", executionStatus: "cancelled", createdAt: "now" },
      ],
    };

    const todayResult = buildTimeAllocationMetrics({
      data: { ...baseData, tasks: [recurring] },
      range: { preset: "today", anchorDate: "2026-07-06" },
      dayStartMinutes: 0,
    });
    const cancelledResult = buildTimeAllocationMetrics({
      data: { ...baseData, tasks: [recurring] },
      range: { preset: "today", anchorDate: "2026-07-07" },
      dayStartMinutes: 0,
    });

    expect(todayResult.summary.plannedMinutes).toBe(60);
    expect(todayResult.taskEntries[0]).toMatchObject({
      taskId: "task-recurring",
      title: "Daily review",
      durationMinutes: 60,
    });
    expect(cancelledResult.summary.plannedMinutes).toBe(0);
  });
});
