import type { PlannerData, Task } from "../types";
import { normalizeHabits } from "./habits";
import { normalizeNullableLevel, normalizeUrgency } from "./productivityModel";
import { normalizeTimelineRecord } from "./timelineRecords";

export function normalizeTaskForClient(task: Task): Task {
  return {
    ...task,
    priority: normalizeNullableLevel(task.priority),
    importance: normalizeNullableLevel(task.importance),
    urgency: normalizeUrgency(task.urgency),
    timelineRecords: (task.timelineRecords || []).map(normalizeTimelineRecord),
  };
}

export function normalizePlannerDataForClient(data: PlannerData): PlannerData {
  const habitPatch = normalizeHabits(data);
  return {
    ...data,
    tasks: (data.tasks || []).map(normalizeTaskForClient),
    projects: (data.projects || []).map((project) => ({
      ...project,
      importance: normalizeNullableLevel(project.importance),
      urgency: normalizeNullableLevel(project.urgency),
    })),
    timeEntries: data.timeEntries || [],
    scheduleTemplates: data.scheduleTemplates || [],
    habits: habitPatch.habits || [],
    habitDailyStates: habitPatch.habitDailyStates || [],
  };
}
