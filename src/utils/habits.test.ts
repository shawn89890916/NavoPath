import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { normalizeHabits, scheduleHabitRecord, toggleHabitCompletion, unscheduleHabitRecord, buildHabitMetrics, isHabitDueOnDate, updateHabit, archiveHabit, weekdayLabels } from "./habits";

const baseData: PlannerData = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [],
  tasks: [],
  timeEntries: [],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
  pluginConfigs: { "habit-tracker": { habits: "Read\nStretch" } },
};

describe("habits", () => {
  it("migrates plugin habit lines into first-class habits", () => {
    const result = normalizeHabits(baseData, "2026-07-01T00:00:00.000Z");
    expect(result.habits?.map((habit) => habit.title)).toEqual(["Read", "Stretch"]);
    expect(result.habits?.[0].activeWeekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it("records daily completion without removing the habit", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const next = toggleHabitCompletion(data, data.habits![0].id, "2026-07-01", true, "2026-07-01T08:00:00.000Z");
    expect(next.habits?.[0].title).toBe("Read");
    expect(next.habitDailyStates?.[0].completed).toBe(true);
  });

  it("schedules one habit as a timeline record and keeps habit in the card", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const result = scheduleHabitRecord(data, data.habits![0].id, "2026-07-01", "09:00", "2026-07-01T08:00:00.000Z");
    expect(result.data.habits?.[0].title).toBe("Read");
    expect(result.data.habitDailyStates?.[0].timelineRecordId).toBe(result.recordId);
    expect(result.data.tasks.some((task) => task.id === `habit-task-${data.habits![0].id}-2026-07-01`)).toBe(true);
  });

  it("rescheduling a habit on the same day replaces its previous timeline record", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const habitId = data.habits![0].id;
    const first = scheduleHabitRecord(data, habitId, "2026-07-01", "09:00", "2026-07-01T08:00:00.000Z");
    const second = scheduleHabitRecord(first.data, habitId, "2026-07-01", "10:00", "2026-07-01T09:00:00.000Z");
    const habitTask = second.data.tasks.find((task) => task.id === `habit-task-${habitId}-2026-07-01`);

    expect(second.data.habitDailyStates?.find((state) => state.habitId === habitId)?.timelineRecordId).toBe(second.recordId);
    expect(habitTask?.timelineRecords?.map((record) => record.scheduledStart)).toEqual(["10:00"]);
  });

  it("unscheduleHabitRecord clears only the planned marker and scheduled record", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const habitId = data.habits![0].id;
    const scheduled = scheduleHabitRecord(data, habitId, "2026-07-01", "09:00", "2026-07-01T08:00:00.000Z");
    const unscheduled = unscheduleHabitRecord(scheduled.data, habitId, "2026-07-01", "2026-07-01T09:00:00.000Z");

    expect(unscheduled.habitDailyStates?.find((s) => s.habitId === habitId)?.timelineRecordId).toBeUndefined();
    const habitTask = unscheduled.tasks.find((t) => t.id === `habit-task-${habitId}-2026-07-01`);
    const scheduledRecords = habitTask?.timelineRecords?.filter((r) => r.executionStatus === "scheduled") || [];
    expect(scheduledRecords).toHaveLength(0);
    expect(habitTask?.plannedForDate).toBeUndefined();
    expect(habitTask?.executionLane).toBeUndefined();
  });

  it("unscheduleHabitRecord preserves the habit completion state", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const habitId = data.habits![0].id;
    const completed = toggleHabitCompletion(data, habitId, "2026-07-01", true, "2026-07-01T08:00:00.000Z");
    const scheduled = scheduleHabitRecord(completed, habitId, "2026-07-01", "09:00", "2026-07-01T08:30:00.000Z");
    const unscheduled = unscheduleHabitRecord(scheduled.data, habitId, "2026-07-01", "2026-07-01T09:30:00.000Z");

    expect(unscheduled.habitDailyStates?.find((s) => s.habitId === habitId)?.completed).toBe(true);
    expect(unscheduled.habits?.find((h) => h.id === habitId)?.title).toBe("Read");
  });

  it("isHabitDueOnDate respects frequency rules", () => {
    const dailyHabit = { id: "h1", title: "Read", defaultDurationMinutes: 20, createdAt: "", updatedAt: "", frequencyRule: "daily" as const };
    const weeklyHabit = { id: "h2", title: "Review", defaultDurationMinutes: 30, createdAt: "", updatedAt: "", frequencyRule: "weekly" as const, weeklyTarget: 3 };
    // 2026-07-01 is a Wednesday (day 3)
    const customHabit = { id: "h3", title: "Weekly", defaultDurationMinutes: 40, createdAt: "", updatedAt: "", frequencyRule: "custom" as const, activeWeekdays: [1, 3, 5] };
    const archivedHabit = { id: "h4", title: "Old", defaultDurationMinutes: 10, createdAt: "", updatedAt: "", archived: true };

    expect(isHabitDueOnDate(dailyHabit, "2026-07-01")).toBe(true);
    expect(isHabitDueOnDate(weeklyHabit, "2026-07-01")).toBe(true);
    expect(isHabitDueOnDate(customHabit, "2026-07-01")).toBe(true); // Wednesday = day 3
    expect(isHabitDueOnDate(customHabit, "2026-07-02")).toBe(false); // Thursday = day 4
    expect(isHabitDueOnDate(archivedHabit, "2026-07-01")).toBe(false);
  });

  it("returns readable localized weekday labels", () => {
    expect(weekdayLabels("zh")).toEqual(["日", "一", "二", "三", "四", "五", "六"]);
    expect(weekdayLabels("en")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("buildHabitMetrics computes completion rates and planned minutes", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const habitId = data.habits![0].id;
    // Complete the habit and schedule it
    const completed = toggleHabitCompletion(data, habitId, "2026-07-01", true, "2026-07-01T08:00:00.000Z");
    const scheduled = scheduleHabitRecord(completed, habitId, "2026-07-01", "09:00", "2026-07-01T08:30:00.000Z");
    const metrics = buildHabitMetrics(scheduled.data, "2026-07-01");

    expect(metrics.total).toBe(2);
    expect(metrics.active).toBe(2);
    expect(metrics.todayCompleted).toBe(1);
    expect(metrics.todayPlanned).toBe(1);
    expect(metrics.plannedMinutes).toBe(20); // default 20 min
    expect(metrics.completionRate7d).toBeGreaterThan(0);
    const habitMetric = metrics.perHabit.find((m) => m.habit.id === habitId);
    expect(habitMetric?.completedToday).toBe(true);
    expect(habitMetric?.plannedToday).toBe(true);
    expect(habitMetric?.plannedCount).toBeGreaterThanOrEqual(1);
  });

  it("updateHabit patches fields and updates timestamp", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const habitId = data.habits![0].id;
    const updated = updateHabit(data, habitId, { notes: "New notes", frequencyRule: "weekly", activeWeekdays: [1, 2, 3, 4, 5], targetCount: 2 }, "2026-07-01T10:00:00.000Z");
    const habit = updated.habits?.find((h) => h.id === habitId);
    expect(habit?.notes).toBe("New notes");
    expect(habit?.frequencyRule).toBe("weekly");
    expect(habit?.activeWeekdays).toEqual([1, 2, 3, 4, 5]);
    expect(habit?.targetCount).toBe(2);
    expect(habit?.updatedAt).toBe("2026-07-01T10:00:00.000Z");
  });

  it("archiveHabit sets archived flag", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const habitId = data.habits![0].id;
    const archived = archiveHabit(data, habitId, true, "2026-07-01T10:00:00.000Z");
    expect(archived.habits?.find((h) => h.id === habitId)?.archived).toBe(true);
    const metrics = buildHabitMetrics(archived, "2026-07-01");
    expect(metrics.active).toBe(1);
    expect(metrics.archived).toBe(1);
  });
});
