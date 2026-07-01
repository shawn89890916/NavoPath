import type { Category, PlannerData, Priority, Project, Task, TimeEntry, WorkflowStatus } from "../types";

export const WORKFLOW_STATUSES: WorkflowStatus[] = ["backlog", "next", "doing", "waiting", "done"];

export const WORKFLOW_LABELS: Record<WorkflowStatus, { en: string; zh: string }> = {
  backlog: { en: "To do", zh: "代办" },
  next: { en: "To do", zh: "代办" },
  doing: { en: "Doing", zh: "进行中" },
  waiting: { en: "To do", zh: "代办" },
  done: { en: "Done", zh: "完成" },
};

export type AnalysisFilters = {
  projectId: string;
  category: Category | "all";
  priority: Priority | "all";
  workflowStatus: WorkflowStatus | "all";
  completion: "all" | "completed" | "open";
  timeRange: "7" | "30" | "90" | "180" | "all";
  timed: "all" | "timed" | "untimed";
  scheduled: "all" | "scheduled" | "unscheduled";
  keyword: string;
};

export function inferWorkflowStatus(task: Pick<Task, "completed" | "workflowStatus" | "plannedForDate" | "timelineRecords">): WorkflowStatus {
  if (task.completed) return "done";
  if (task.workflowStatus && WORKFLOW_STATUSES.includes(task.workflowStatus)) return task.workflowStatus;
  if ((task.timelineRecords || []).some((record) => record.executionStatus === "scheduled")) return "doing";
  if (task.plannedForDate) return "next";
  return "backlog";
}

export function completionDate(task: Task): string {
  return task.completedAt || task.updatedAt || task.dueDate || task.createdAt;
}

export function minutesBetween(startAt: string, endAt: string): number {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

export function normalizeTimeEntry(entry: TimeEntry, tasks: Task[] = []): TimeEntry | null {
  if (!entry?.id || !entry.taskId) return null;
  const task = tasks.find((item) => item.id === entry.taskId);
  const durationMinutes = Number.isFinite(entry.durationMinutes) && entry.durationMinutes > 0
    ? Math.round(entry.durationMinutes)
    : minutesBetween(entry.startAt, entry.endAt);
  if (durationMinutes <= 0) return null;
  const now = new Date().toISOString();
  return {
    ...entry,
    projectId: entry.projectId || task?.projectId,
    durationMinutes,
    source: entry.source || "timer",
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now,
  };
}

export function entriesForTask(timeEntries: TimeEntry[] | undefined, taskId: string): TimeEntry[] {
  return (timeEntries || []).filter((entry) => entry.taskId === taskId);
}

export function totalMinutes(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, Math.round(entry.durationMinutes || 0)), 0);
}

export function filterTasksForAnalysis(data: PlannerData, filters: AnalysisFilters): Task[] {
  const entries = data.timeEntries || [];
  const entryTaskIds = new Set(entries.map((entry) => entry.taskId));
  const keyword = filters.keyword.trim().toLowerCase();
  const cutoff = cutoffDate(filters.timeRange);
  return (data.tasks || []).filter((task) => {
    if (filters.projectId !== "all" && String(task.projectId || "") !== filters.projectId) return false;
    if (filters.category !== "all" && task.category !== filters.category) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.workflowStatus !== "all" && inferWorkflowStatus(task) !== filters.workflowStatus) return false;
    if (filters.completion === "completed" && !task.completed) return false;
    if (filters.completion === "open" && task.completed) return false;
    if (filters.timed === "timed" && !entryTaskIds.has(task.id)) return false;
    if (filters.timed === "untimed" && entryTaskIds.has(task.id)) return false;
    const scheduled = Boolean(task.scheduledDate || (task.timelineRecords || []).length || task.recurrence?.frequency);
    if (filters.scheduled === "scheduled" && !scheduled) return false;
    if (filters.scheduled === "unscheduled" && scheduled) return false;
    if (cutoff && Date.parse(completionDate(task)) < cutoff.getTime()) return false;
    if (keyword) {
      const haystack = `${task.title} ${task.notes || ""}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

export function filterEntriesForTasks(data: PlannerData, tasks: Task[], filters?: Pick<AnalysisFilters, "timeRange">): TimeEntry[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const cutoff = filters ? cutoffDate(filters.timeRange) : null;
  return (data.timeEntries || []).filter((entry) => {
    if (!taskIds.has(entry.taskId)) return false;
    if (cutoff && Date.parse(entry.startAt) < cutoff.getTime()) return false;
    return true;
  });
}

export function buildProjectMetrics(data: PlannerData, project: Project | null, filters: AnalysisFilters) {
  const tasks = filterTasksForAnalysis(data, { ...filters, projectId: project?.id || filters.projectId });
  const entries = filterEntriesForTasks(data, tasks, filters);
  const completed = tasks.filter((task) => task.completed);
  const estimatedMinutes = tasks.reduce((sum, task) => sum + Math.round((task.estimatedHours || 0) * 60), 0);
  const actualMinutes = totalMinutes(entries);
  const activeDays = new Set(entries.map((entry) => entry.startAt.slice(0, 10)));
  return {
    tasks,
    entries,
    completedCount: completed.length,
    actualMinutes,
    estimatedMinutes,
    estimateDeltaMinutes: actualMinutes - estimatedMinutes,
    activeStreak: activeStreak(activeDays),
  };
}

export function heatmapBuckets(entries: TimeEntry[], days = 90, anchor = new Date()) {
  const end = new Date(anchor);
  end.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    buckets.set(toIsoDate(date), 0);
  }
  for (const entry of entries) {
    const key = entry.startAt.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + Math.max(0, entry.durationMinutes || 0));
  }
  return Array.from(buckets.entries()).map(([date, minutes]) => ({ date, minutes, level: heatLevel(minutes) }));
}

export function kanbanGroups(tasks: Task[]) {
  const groups: Record<WorkflowStatus, Task[]> = { backlog: [], next: [], doing: [], waiting: [], done: [] };
  for (const task of tasks) groups[inferWorkflowStatus(task)].push(task);
  return groups;
}

export function applyIdlePolicy(startAt: string, endAt: string, idleStartedAt: string, policy: "keep" | "discard" | "split") {
  const full = minutesBetween(startAt, endAt);
  const active = Math.max(0, minutesBetween(startAt, idleStartedAt));
  if (policy === "keep") return { durationMinutes: full, idleMinutes: 0 };
  const idleMinutes = Math.max(0, full - active);
  return { durationMinutes: active, idleMinutes };
}

function cutoffDate(range: AnalysisFilters["timeRange"]): Date | null {
  if (range === "all") return null;
  const days = Number(range);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return date;
}

function activeStreak(activeDays: Set<string>) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(toIsoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function heatLevel(minutes: number) {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 90) return 2;
  if (minutes < 180) return 3;
  return 4;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
