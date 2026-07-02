import type { Habit, HabitDailyState, HabitFrequency, PlannerData, Task, TimelineRecord } from "../types";

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
    ? data.tasks.map((item) => item.id === taskId ? { ...item, timelineRecords: [record], updatedAt: now } : item)
    : [...data.tasks, { ...task, timelineRecords: [record] }];
  return { data: { ...stateData, tasks, habitDailyStates: states }, recordId };
}

const WEEKDAY_LABELS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabels(lang: "zh" | "en"): string[] {
  return lang === "zh" ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN;
}

export function isHabitDueOnDate(habit: Habit, date: string): boolean {
  if (habit.archived) return false;
  const rule: HabitFrequency = habit.frequencyRule || "daily";
  if (rule === "daily") return true;
  if (rule === "weekly") {
    if (!habit.weeklyTarget || habit.weeklyTarget <= 0) return true;
    return true;
  }
  if (rule === "custom") {
    const weekdays = habit.activeWeekdays || [];
    if (weekdays.length === 0) return true;
    const [y, m, d] = date.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return weekdays.includes(day);
  }
  return true;
}

export function updateHabit(data: PlannerData, habitId: string, patch: Partial<Habit>, now = new Date().toISOString()): PlannerData {
  const habits = (data.habits || []).map((habit) =>
    habit.id === habitId ? { ...habit, ...patch, updatedAt: now } : habit
  );
  return { ...data, habits };
}

export function archiveHabit(data: PlannerData, habitId: string, archived: boolean, now = new Date().toISOString()): PlannerData {
  return updateHabit(data, habitId, { archived }, now);
}

export function unscheduleHabitRecord(data: PlannerData, habitId: string, date: string, now = new Date().toISOString()): PlannerData {
  const states = (data.habitDailyStates || []).map((state) =>
    state.habitId === habitId && state.date === date
      ? { ...state, timelineRecordId: undefined, updatedAt: now }
      : state
  );
  const taskId = `habit-task-${habitId}-${date}`;
  const tasks = data.tasks
    .map((task) =>
      task.id === taskId
        ? {
            ...task,
            timelineRecords: (task.timelineRecords || []).filter((record) => record.executionStatus !== "scheduled"),
            plannedForDate: date,
            executionLane: "candidate" as const,
            updatedAt: now,
          }
        : task
    )
    .filter((task) => !(task.id === taskId && (task.timelineRecords || []).length === 0 && !task.notes && task.title === (data.habits || []).find((h) => h.id === habitId)?.title));
  return { ...data, tasks, habitDailyStates: states };
}

export interface HabitMetrics {
  total: number;
  active: number;
  archived: number;
  todayCompleted: number;
  todayPlanned: number;
  todayDue: number;
  plannedMinutes: number;
  completionRate7d: number;
  completionRate30d: number;
  perHabit: Array<{
    habit: Habit;
    completedToday: boolean;
    plannedToday: boolean;
    completed7d: number;
    completed30d: number;
    due7d: number;
    plannedCount: number;
    plannedMinutes: number;
  }>;
}

function dateRange(endDate: string, days: number): string[] {
  // Parse date parts directly to avoid timezone shifting the day
  const [y, m, d] = endDate.split("-").map(Number);
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1, d - i));
    result.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`);
  }
  return result;
}

export function buildHabitMetrics(data: PlannerData, today: string): HabitMetrics {
  const habits = data.habits || [];
  const states = data.habitDailyStates || [];
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  const todayStates = states.filter((s) => s.date === today);
  const todayCompleted = todayStates.filter((s) => s.completed).length;
  const todayPlanned = todayStates.filter((s) => s.timelineRecordId).length;
  const todayDue = active.filter((h) => isHabitDueOnDate(h, today)).length;

  const plannedMinutes = todayStates.reduce((sum, s) => {
    if (!s.timelineRecordId) return sum;
    const habit = habits.find((h) => h.id === s.habitId);
    return sum + (habit?.defaultDurationMinutes || 20);
  }, 0);

  const days7 = dateRange(today, 7);
  const days30 = dateRange(today, 30);

  const completedIn = (days: string[]) => days.filter((date) =>
    states.some((s) => s.date === date && s.completed && active.some((h) => h.id === s.habitId))
  ).length;
  const dueIn = (days: string[]) => days.filter((date) =>
    active.some((h) => isHabitDueOnDate(h, date))
  ).length;

  const completionRate7d = days7.length > 0 ? completedIn(days7) / Math.max(1, dueIn(days7)) : 0;
  const completionRate30d = days30.length > 0 ? completedIn(days30) / Math.max(1, dueIn(days30)) : 0;

  const perHabit = active.map((habit) => {
    const todayState = states.find((s) => s.habitId === habit.id && s.date === today);
    const completed7 = days7.filter((date) => states.some((s) => s.habitId === habit.id && s.date === date && s.completed)).length;
    const completed30 = days30.filter((date) => states.some((s) => s.habitId === habit.id && s.date === date && s.completed)).length;
    const due7 = days7.filter((date) => isHabitDueOnDate(habit, date)).length;
    const plannedCount = days7.filter((date) => states.some((s) => s.habitId === habit.id && s.date === date && s.timelineRecordId)).length;
    const habitPlannedMinutes = plannedCount * (habit.defaultDurationMinutes || 20);
    return {
      habit,
      completedToday: Boolean(todayState?.completed),
      plannedToday: Boolean(todayState?.timelineRecordId),
      completed7d: completed7,
      completed30d: completed30,
      due7d: due7,
      plannedCount,
      plannedMinutes: habitPlannedMinutes,
    };
  });

  return {
    total: habits.length,
    active: active.length,
    archived: archived.length,
    todayCompleted,
    todayPlanned,
    todayDue,
    plannedMinutes,
    completionRate7d,
    completionRate30d,
    perHabit,
  };
}
