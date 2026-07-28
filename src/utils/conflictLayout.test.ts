import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { computeConflictLayout, computeConflictStyle, scheduledDateTimesOverlap, scheduledTaskIntervalsOnDate } from "./conflictLayout";

function scheduledTask(id: string, start: string, end: string): Task {
  return {
    id,
    title: id,
    dueDate: "2026-07-26",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    estimatedHours: 1,
    scheduledDate: "2026-07-26",
    scheduledStart: start,
    scheduledEnd: end,
    subtasks: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
  };
}

describe("computeConflictLayout", () => {
  it("keeps non-overlapping tasks at full width", () => {
    const layout = computeConflictLayout([
      scheduledTask("first", "09:00", "10:00"),
      scheduledTask("second", "10:00", "11:00"),
    ]);

    expect(layout.size).toBe(0);
  });

  it("uses the maximum overlap depth for a chained conflict group", () => {
    const layout = computeConflictLayout([
      scheduledTask("first", "09:00", "10:30"),
      scheduledTask("second", "10:00", "11:00"),
      scheduledTask("third", "10:30", "11:30"),
    ]);

    expect(layout.get("first")).toEqual({ index: 0, count: 2 });
    expect(layout.get("second")).toEqual({ index: 1, count: 2 });
    expect(layout.get("third")).toEqual({ index: 0, count: 2 });
  });

  it("detects overlap between tasks that both cross midnight", () => {
    const layout = computeConflictLayout([
      scheduledTask("late", "23:30", "00:30"),
      scheduledTask("later", "23:45", "00:15"),
    ]);

    expect(layout.get("late")).toEqual({ index: 0, count: 2 });
    expect(layout.get("later")).toEqual({ index: 1, count: 2 });
  });
});

describe("computeConflictStyle", () => {
  it("turns a conflict column into a stable side-by-side position", () => {
    const layout = new Map([["second", { index: 1, count: 2 }]]);

    expect(computeConflictStyle("second", layout, 200, 10, 8, "weekly")).toEqual({
      left: 114,
      width: 96,
      isNarrow: false,
    });
  });
});

describe("scheduledDateTimesOverlap", () => {
  it("detects overlap between clock ranges that both cross midnight", () => {
    expect(scheduledDateTimesOverlap("2026-07-26", "23:30", "00:30", "2026-07-26", "23:45", "00:15")).toBe(true);
  });

  it("detects a next-day conflict at the end of a cross-midnight range", () => {
    expect(scheduledDateTimesOverlap("2026-07-26", "23:30", "00:30", "2026-07-27", "00:15", "00:45")).toBe(true);
  });

  it("does not confuse matching clock times on different dates", () => {
    expect(scheduledDateTimesOverlap("2026-07-26", "09:00", "10:00", "2026-07-27", "09:00", "10:00")).toBe(false);
  });

  it("allows adjacent ranges", () => {
    expect(scheduledDateTimesOverlap("2026-07-26", "09:00", "10:00", "2026-07-26", "10:00", "11:00")).toBe(false);
  });
});

describe("scheduledTaskIntervalsOnDate", () => {
  it("includes the ending-day continuation of a cross-midnight record", () => {
    const task = scheduledTask("overnight", "23:30", "00:30");
    task.timelineRecords = [{
      id: "record-1",
      taskId: task.id,
      scheduledDate: "2026-07-26",
      scheduledStart: "23:30",
      scheduledEndDate: "2026-07-27",
      scheduledEnd: "00:30",
      executionStatus: "scheduled",
      createdAt: "",
    }];
    task.scheduledDate = undefined;
    task.scheduledStart = undefined;
    task.scheduledEnd = undefined;

    expect(scheduledTaskIntervalsOnDate([task], "2026-07-27")).toEqual([{ start: 0, end: 30 }]);
  });

  it("infers the ending-day continuation of a legacy direct schedule", () => {
    const task = scheduledTask("legacy", "23:30", "00:30");

    expect(scheduledTaskIntervalsOnDate([task], "2026-07-27")).toEqual([{ start: 0, end: 30 }]);
  });
});
