import type { PlannerData, Task } from "../types";
import { localIsoDate } from "./localDate";
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
    const startDay = Date.parse(`${normalized.scheduledDate}T00:00:00.000Z`);
    const endDay = Date.parse(`${normalized.scheduledEndDate}T00:00:00.000Z`);
    const daySpan = Number.isFinite(startDay) && Number.isFinite(endDay)
      ? Math.max(0, endDay - startDay) / 86400000
      : 0;
    return sum + Math.max(0, Math.round(daySpan * 1440 + end - start));
  }, 0);
}

function isoDate(value: string | undefined) {
  return String(value || "").slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function inRange(date: string | undefined, range: TimeShareRange, todayIso: string) {
  const iso = isoDate(date);
  if (!iso) return false;
  if (range === "all") return true;
  return iso >= addDays(todayIso, -Number(range) + 1) && iso <= todayIso;
}

export function buildTimeShareMetrics(data: PlannerData, options: TimeShareOptions, todayIso = localIsoDate()): TimeShareResult {
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
      if (!inRange(entry.startAt, options.range, todayIso)) continue;
      const task = taskById.get(entry.taskId);
      if (task) add(task, Math.max(0, Math.round(entry.durationMinutes || 0)));
    }
  } else {
    for (const task of data.tasks || []) {
      const records = (task.timelineRecords || []).filter((record) => inRange(record.scheduledDate, options.range, todayIso) || inRange(record.scheduledEndDate, options.range, todayIso));
      add({ ...task, timelineRecords: records }, plannedMinutes({ ...task, timelineRecords: records }));
    }
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
