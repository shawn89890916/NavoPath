import type { PlannerData, Task } from "../types";
import { normalizeTaskState } from "./productivityModel";
import { minutesOfDay, normalizeTimelineRecord } from "./timelineRecords";

export type TimeShareDimension = "project" | "category" | "importance" | "urgency" | "status";
export type TimeShareMode = "actual" | "planned";
export type TimeShareRange = "7" | "30" | "90" | "all";

export type TimeShareOptions = {
  mode: TimeShareMode;
  dimension: TimeShareDimension;
  range: TimeShareRange;
};

export type TimeShareSegment = {
  key: string;
  label: string;
  minutes: number;
  ratio: number;
  taskIds: string[];
};

export type TimeShareResult = {
  mode: TimeShareMode;
  dimension: TimeShareDimension;
  totalMinutes: number;
  segments: TimeShareSegment[];
};

function levelLabel(key: string) {
  if (key === "empty") return "Empty";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function keyForTask(_data: PlannerData, task: Task, dimension: TimeShareDimension) {
  const state = normalizeTaskState(task);
  if (dimension === "project") return task.projectId || "__unassigned__";
  if (dimension === "category") return task.category || "personal";
  if (dimension === "importance") return state.importance || "empty";
  if (dimension === "urgency") return state.urgency || "empty";
  return state.workflow;
}

function labelForKey(data: PlannerData, dimension: TimeShareDimension, key: string) {
  if (dimension === "project") return data.projects.find((project) => project.id === key)?.title || "Unassigned";
  return levelLabel(key);
}

function plannedMinutes(task: Task) {
  return (task.timelineRecords || []).reduce((sum, record) => {
    const normalized = normalizeTimelineRecord(record);
    if (normalized.executionStatus !== "scheduled") return sum;
    const start = minutesOfDay(normalized.scheduledStart || "00:00");
    const end = minutesOfDay(normalized.scheduledEnd || normalized.scheduledStart || "00:00");
    const daySpan = Math.max(0, new Date(`${normalized.scheduledEndDate}T00:00:00`).getTime() - new Date(`${normalized.scheduledDate}T00:00:00`).getTime()) / 86400000;
    return sum + Math.max(0, Math.round(daySpan * 1440 + end - start));
  }, 0);
}

export function buildTimeShareMetrics(data: PlannerData, options: TimeShareOptions): TimeShareResult {
  const taskById = new Map((data.tasks || []).map((task) => [task.id, task]));
  const buckets = new Map<string, { minutes: number; taskIds: Set<string> }>();
  const add = (task: Task, minutes: number) => {
    if (minutes <= 0) return;
    const key = keyForTask(data, task, options.dimension);
    const bucket = buckets.get(key) || { minutes: 0, taskIds: new Set<string>() };
    bucket.minutes += minutes;
    bucket.taskIds.add(task.id);
    buckets.set(key, bucket);
  };

  if (options.mode === "actual") {
    for (const entry of data.timeEntries || []) {
      const task = taskById.get(entry.taskId);
      if (task) add(task, Math.max(0, Math.round(entry.durationMinutes || 0)));
    }
  } else {
    for (const task of data.tasks || []) add(task, plannedMinutes(task));
  }

  const totalMinutes = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.minutes, 0);
  const segments = Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      label: labelForKey(data, options.dimension, key),
      minutes: bucket.minutes,
      ratio: totalMinutes > 0 ? bucket.minutes / totalMinutes : 0,
      taskIds: Array.from(bucket.taskIds),
    }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
  return { mode: options.mode, dimension: options.dimension, totalMinutes, segments };
}
