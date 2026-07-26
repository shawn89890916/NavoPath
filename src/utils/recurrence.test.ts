import { describe, expect, it } from "vitest";
import type { Task, TaskRecurrence, TimelineRecord } from "../types";
import {
  addDays,
  addMonths,
  buildRecurrenceOccurrenceId,
  enumerateRecurrenceDates,
  hasRecurrenceOccurrenceOnDate,
  isRecurringScheduledTask,
  matchesOccurrence,
  parseRecurrenceOccurrenceId,
  startOfWeekIso,
} from "./recurrence";

function scheduledRecurringTask(recurrence: TaskRecurrence): Task {
  return {
    id: "task",
    title: "Recurring task",
    dueDate: recurrence.startDate || "",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    estimatedHours: 1,
    subtasks: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
    recurrence,
  };
}

describe("recurrence date helpers", () => {
  it("moves across year and month boundaries in local calendar time", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(startOfWeekIso("2026-07-29")).toBe("2026-07-26");
  });

  it("counts weekday occurrences before filtering to visible dates", () => {
    const recurrence: TaskRecurrence = {
      mode: "flexible",
      frequency: "weekdays",
      startDate: "2026-07-24",
      count: 3,
    };
    const visibleDates = new Set(["2026-07-27", "2026-07-28", "2026-07-29"]);

    expect(enumerateRecurrenceDates(recurrence, visibleDates)).toEqual([
      "2026-07-27",
      "2026-07-28",
    ]);
  });

  it("stops recurring dates at the configured end date", () => {
    const recurrence: TaskRecurrence = {
      mode: "flexible",
      frequency: "daily",
      startDate: "2026-07-24",
      endDate: "2026-07-26",
    };
    const visibleDates = new Set(["2026-07-25", "2026-07-26", "2026-07-27"]);

    expect(enumerateRecurrenceDates(recurrence, visibleDates)).toEqual([
      "2026-07-25",
      "2026-07-26",
    ]);
  });
});

describe("recurring task identity", () => {
  it("round-trips a generated occurrence id", () => {
    const id = buildRecurrenceOccurrenceId("task_123", "2026-07-26", "09:30");

    expect(parseRecurrenceOccurrenceId(id)).toEqual({
      taskId: "task_123",
      scheduledDate: "2026-07-26",
      scheduledStart: "09:30",
    });
    expect(parseRecurrenceOccurrenceId("task_123")).toBeNull();
  });

  it("recognizes only complete scheduled recurrence rules", () => {
    const scheduled = scheduledRecurringTask({
      mode: "scheduled",
      frequency: "weekly",
      startDate: "2026-07-26",
      startTime: "09:30",
      durationMinutes: 60,
    });
    const flexible = { ...scheduled, recurrence: { ...scheduled.recurrence!, mode: "flexible" as const } };

    expect(isRecurringScheduledTask(scheduled)).toBe(true);
    expect(isRecurringScheduledTask(flexible)).toBe(false);
    expect(hasRecurrenceOccurrenceOnDate(scheduled, "2026-08-02")).toBe(true);
  });

  it("matches timeline records by date and optional start time", () => {
    const record = {
      id: "record",
      scheduledDate: "2026-07-26",
      scheduledStart: "09:30",
    } as TimelineRecord;

    expect(matchesOccurrence(record, "2026-07-26")).toBe(true);
    expect(matchesOccurrence(record, "2026-07-26", "09:30")).toBe(true);
    expect(matchesOccurrence(record, "2026-07-26", "10:00")).toBe(false);
  });
});
