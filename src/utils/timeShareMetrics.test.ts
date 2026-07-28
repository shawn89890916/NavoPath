import { describe, expect, it, vi } from "vitest";
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

  it("filters actual and planned minutes by rolling range", () => {
    const olderTask: Task = {
      ...task,
      id: "task-old",
      title: "Old work",
      timelineRecords: [{ id: "record-old", taskId: "task-old", scheduledDate: "2026-05-01", scheduledStart: "09:00", scheduledEndDate: "2026-05-01", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }],
    };
    const source: PlannerData = {
      ...data,
      tasks: [task, olderTask],
      timeEntries: [
        ...data.timeEntries!,
        { id: "time-old", taskId: "task-old", projectId: "project-1", startAt: "2026-05-01T09:00:00.000Z", endAt: "2026-05-01T10:00:00.000Z", durationMinutes: 60, source: "timer", createdAt: "now", updatedAt: "now" },
      ],
    };

    expect(buildTimeShareMetrics(source, { mode: "actual", dimension: "project", range: "30" }, "2026-07-02").totalMinutes).toBe(60);
    expect(buildTimeShareMetrics(source, { mode: "planned", dimension: "project", range: "30" }, "2026-07-02").totalMinutes).toBe(90);
    expect(buildTimeShareMetrics(source, { mode: "actual", dimension: "project", range: "all" }, "2026-07-02").totalMinutes).toBe(120);
  });

  it("keeps a rolling range boundary on local calendar dates", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";
    try {
      const source: PlannerData = {
        ...data,
        timeEntries: [
          { ...data.timeEntries![0], id: "outside", startAt: "2026-06-02T09:00:00+08:00" },
          { ...data.timeEntries![0], id: "inside", startAt: "2026-06-03T09:00:00+08:00" },
        ],
      };

      expect(buildTimeShareMetrics(
        source,
        { mode: "actual", dimension: "project", range: "30" },
        "2026-07-02",
      ).totalMinutes).toBe(60);
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });

  it("counts calendar-day duration across a daylight-saving transition", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const overnightTask: Task = {
        ...task,
        timelineRecords: [{
          id: "dst-record",
          taskId: task.id,
          scheduledDate: "2026-03-08",
          scheduledStart: "23:00",
          scheduledEndDate: "2026-03-09",
          scheduledEnd: "01:00",
          executionStatus: "scheduled",
          createdAt: "now",
        }],
      };

      expect(buildTimeShareMetrics(
        { ...data, tasks: [overnightTask] },
        { mode: "planned", dimension: "project", range: "all" },
        "2026-03-09",
      ).totalMinutes).toBe(120);
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });

  it("uses the local calendar date as the default range endpoint", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-28T16:30:00.000Z"));
      const source: PlannerData = {
        ...data,
        timeEntries: [{
          ...data.timeEntries![0],
          startAt: "2026-07-29T00:15:00+08:00",
        }],
      };

      expect(buildTimeShareMetrics(
        source,
        { mode: "actual", dimension: "project", range: "7" },
      ).totalMinutes).toBe(60);
    } finally {
      vi.useRealTimers();
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });

  it("filters timestamped entries by their local calendar date", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";
    try {
      const source: PlannerData = {
        ...data,
        timeEntries: [{
          ...data.timeEntries![0],
          startAt: "2026-07-22T16:30:00.000Z",
        }],
      };

      expect(buildTimeShareMetrics(
        source,
        { mode: "actual", dimension: "project", range: "7" },
        "2026-07-29",
      ).totalMinutes).toBe(60);
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });
});
