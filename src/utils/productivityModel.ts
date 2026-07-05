import type { NullablePriority, Priority, Task, TaskLevel, WorkflowStatus } from "../types";

export type NullableLevel = Priority | null | undefined;
export type StateFilterValue = "all" | "empty" | Priority;
export type UiWorkflowStatus = "backlog" | "doing" | "done";

export type NormalizedTaskState = {
  priority: NullablePriority;
  importance: NullablePriority;
  urgency: Priority;
  workflow: UiWorkflowStatus;
};

const LEVELS: Priority[] = ["high", "medium", "low"];

export function normalizeNullableLevel(value: unknown, fallback: NullableLevel = null): NullablePriority {
  if (value === null || value === undefined || value === "" || value === "unset") return fallback ?? null;
  return LEVELS.includes(value as Priority) ? (value as Priority) : fallback ?? null;
}

export function normalizeUrgency(value: unknown): Priority {
  return normalizeNullableLevel(value, "low") || "low";
}

export function normalizeWorkflowStatus(
  task: Pick<Task, "completed" | "workflowStatus" | "plannedForDate" | "timelineRecords">,
): UiWorkflowStatus {
  if (task.completed || task.workflowStatus === "done") return "done";
  if (task.workflowStatus === "doing") return "doing";
  if ((task.timelineRecords || []).some((record) => record.executionStatus === "scheduled")) return "doing";
  return "backlog";
}

export function normalizeTaskState(
  task: Pick<Task, "priority" | "importance" | "urgency" | "completed" | "workflowStatus" | "plannedForDate" | "timelineRecords">,
): NormalizedTaskState {
  return {
    priority: normalizeNullableLevel(task.priority),
    importance: normalizeNullableLevel(task.importance),
    urgency: normalizeUrgency(task.urgency),
    workflow: normalizeWorkflowStatus(task),
  };
}

export function normalizeTaskCheckTone(task: Pick<Task, "importance" | "urgency">): "attention" | "muted" {
  return task.importance === "high" || task.urgency === "high" ? "attention" : "muted";
}

export function taskMetaPatch(kind: "importance" | "urgency", value: unknown): Pick<Task, "importance"> | Pick<Task, "urgency"> {
  if (kind === "importance") return { importance: normalizeNullableLevel(value) };
  return { urgency: normalizeUrgency(value) };
}

export function matchesLevelFilter(value: NullableLevel, filter: StateFilterValue): boolean {
  if (filter === "all") return true;
  const normalized = normalizeNullableLevel(value);
  if (filter === "empty") return normalized === null;
  return normalized === filter;
}

export function workflowStatusForPatch(status: UiWorkflowStatus): Partial<Task> {
  if (status === "done") return { workflowStatus: "done" as WorkflowStatus, completed: true };
  if (status === "doing") return { workflowStatus: "doing" as WorkflowStatus, completed: false };
  return { workflowStatus: "backlog" as WorkflowStatus, completed: false };
}

export function validateProjectCompletion(projectId: string, tasks: Task[]): { ok: true } | { ok: false; openTasks: Task[] } {
  const openTasks = tasks.filter((task) => String(task.projectId || "") === String(projectId) && !task.completed);
  if (openTasks.length > 0) return { ok: false, openTasks };
  return { ok: true };
}
