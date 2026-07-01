import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { normalizeHabits, scheduleHabitRecord, toggleHabitCompletion } from "./habits";

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
});
