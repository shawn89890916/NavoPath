import type { Habit, HabitDailyState, PlannerData, Task, TimelineRecord } from "../types";

function uid(prefix: string, seed: string) {
  return `${prefix}-${seed.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")}`;
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function normalizeHabits(data: PlannerData, now = new Date().toISOString()): Pick<PlannerData, "habits" | "habitDailyStates"> {
  if (Array.isArray(data.habits) && data.habits.length > 0) {
    return { habits: data.habits, habitDailyStates: data.habitDailyStates || [] };
  }
  const raw = String(data.pluginConfigs?.["habit-tracker"]?.habits || "");
  const titles = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const habits: Habit[] = titles.map((title, index) => ({
    id: uid("habit", title),
    title,
    defaultDurationMinutes: 20,
    archived: false,
    order: index,
    createdAt: now,
    updatedAt: now,
  }));
  return { habits, habitDailyStates: data.habitDailyStates || [] };
}

export function habitStateForDate(data: PlannerData, habitId: string, date: string): HabitDailyState | null {
  return (data.habitDailyStates || []).find((state) => state.habitId === habitId && state.date === date) || null;
}

export function toggleHabitCompletion(data: PlannerData, habitId: string, date: string, completed: boolean, now = new Date().toISOString()): PlannerData {
  const states = data.habitDailyStates || [];
  const existing = states.find((state) => state.habitId === habitId && state.date === date);
  const nextState: HabitDailyState = {
    id: existing?.id || `habit-state-${habitId}-${date}`,
    habitId,
    date,
    completed,
    completedAt: completed ? now : undefined,
    timelineRecordId: existing?.timelineRecordId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return { ...data, habitDailyStates: [...states.filter((state) => state.id !== nextState.id), nextState] };
}

export function scheduleHabitRecord(data: PlannerData, habitId: string, date: string, start: string, now = new Date().toISOString()): { data: PlannerData; recordId: string } {
  const habit = (data.habits || []).find((item) => item.id === habitId);
  if (!habit) throw new Error(`Habit not found: ${habitId}`);
  const taskId = `habit-task-${habit.id}-${date}`;
  const recordId = `habit-record-${habit.id}-${date}-${start.replace(":", "")}`;
  const duration = Math.max(5, habit.defaultDurationMinutes || 20);
  const task: Task = {
    id: taskId,
    title: habit.title,
    dueDate: date,
    category: "personal",
    priority: null,
    notes: "",
    goalId: "",
    completed: false,
    workflowStatus: "doing",
    estimatedHours: duration / 60,
    plannedForDate: date,
    createdAt: now,
    updatedAt: now,
  };
  const record: TimelineRecord = {
    id: recordId,
    taskId,
    scheduledDate: date,
    scheduledStart: start,
    scheduledEndDate: date,
    scheduledEnd: addMinutes(start, duration),
    executionStatus: "scheduled",
    createdAt: now,
  };
  const stateData = toggleHabitCompletion(data, habitId, date, habitStateForDate(data, habitId, date)?.completed || false, now);
  const states = (stateData.habitDailyStates || []).map((state) => state.habitId === habitId && state.date === date ? { ...state, timelineRecordId: recordId, updatedAt: now } : state);
  const tasks = data.tasks.some((item) => item.id === taskId)
    ? data.tasks.map((item) => item.id === taskId ? { ...item, timelineRecords: [...(item.timelineRecords || []).filter((itemRecord) => itemRecord.id !== recordId), record], updatedAt: now } : item)
    : [...data.tasks, { ...task, timelineRecords: [record] }];
  return { data: { ...stateData, tasks, habitDailyStates: states }, recordId };
}
