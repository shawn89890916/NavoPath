import type { PlannerData, Project, Task, TaskRecurrence, TimelineRecord } from "../types";
import { normalizeWorkflowStatus } from "../utils/productivityModel";
import { normalizeTimelineRecord, recordEndDateTime, recordStartDateTime } from "../utils/timelineRecords";

export type MetricRangePreset = "all" | "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "custom";
export type MetricGroupBy = "project" | "customCategory" | "tag" | "importance" | "urgency" | "completion" | "taskType";
export type MetricHabitMode = "include" | "exclude" | "only";
export type MetricCompletionFilter = "all" | "completed" | "incomplete";
export type MetricDisplayMetric = "percentage" | "duration" | "taskCount" | "completionRate";

export type MetricRangeInput = {
  preset: MetricRangePreset;
  anchorDate?: string;
  customStart?: string;
  customEnd?: string;
};

export type MetricDateRange = {
  preset: MetricRangePreset;
  start: Date;
  end: Date;
  label: string;
};

export type MetricTaskEntry = {
  taskId: string;
  recordId: string;
  title: string;
  projectId?: string | null;
  projectLabel: string;
  projectColor: string;
  durationMinutes: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  completed: boolean;
  isHabit?: boolean;
};

export type TimeAllocationGroup = {
  id: string;
  label: string;
  color: string;
  durationMinutes: number;
  percentage: number;
  taskCount: number;
  completedTaskCount: number;
  completionRate: number;
  tasks: MetricTaskEntry[];
};

export type TimeAllocationHeatmapBucket = {
  key: string;
  date: string;
  label: string;
  minutes: number;
  taskCount: number;
  topProject?: string;
};

export type TimeAllocationMetrics = {
  range: MetricDateRange;
  groups: TimeAllocationGroup[];
  taskEntries: MetricTaskEntry[];
  heatmapBuckets: TimeAllocationHeatmapBucket[];
  summary: {
    plannedMinutes: number;
    unplannedMinutes: number;
    taskCount: number;
    completedTaskCount: number;
    completionRate: number;
    topGroup?: TimeAllocationGroup;
  };
};

type MetricDebugRow = {
  id: string;
  title: string;
  projectId?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  completed: boolean;
  isHabit: boolean;
  included: boolean;
  excludeReason: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECURRENCE_RECORD_PREFIX = "metric-recurring";
export const UNASSIGNED_GROUP_ID = "__unassigned__";
export const UNASSIGNED_LABEL = "未归属";
export const UNASSIGNED_COLOR = "#8D877D";

function localDateTime(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addIsoDays(iso: string, days: number) {
  return isoDate(addDays(localDateTime(iso, 0), days));
}

function addIsoMonths(iso: string, months: number) {
  const date = localDateTime(iso, 0);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return isoDate(date);
}

function isWeekdayIso(iso: string) {
  const day = localDateTime(iso, 0).getDay();
  return day >= 1 && day <= 5;
}

function isWeekendIso(iso: string) {
  const day = localDateTime(iso, 0).getDay();
  return day === 0 || day === 6;
}

function timeToMinutes(value = "00:00") {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function minutesToTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function startOfMonth(anchor: Date, dayStartMinutes: number) {
  return localDateTime(`${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-01`, dayStartMinutes);
}

function startOfMetricWeek(anchor: Date, dayStartMinutes: number) {
  const date = localDateTime(isoDate(anchor), dayStartMinutes);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(date, mondayOffset);
}

function enumerateRecurrenceDates(recurrence: TaskRecurrence, visibleDates: Set<string>) {
  if (!recurrence.startDate || visibleDates.size === 0) return [];
  const sortedVisibleDates = [...visibleDates].sort();
  const minDate = sortedVisibleDates[0];
  const maxDate = sortedVisibleDates[sortedVisibleDates.length - 1];
  const results: string[] = [];
  let cursor = recurrence.startDate;
  let occurrenceCount = 0;
  const isVisibleMatch = (date: string) => date >= minDate && date <= maxDate && visibleDates.has(date);
  const advanceCursor = (date: string) => {
    switch (recurrence.frequency) {
      case "weekly":
        return addIsoDays(date, 7);
      case "biweekly":
        return addIsoDays(date, 14);
      case "monthly":
        return addIsoMonths(date, 1);
      case "quarterly":
        return addIsoMonths(date, 3);
      default:
        return addIsoDays(date, 1);
    }
  };
  const matchesCursor = (date: string) => {
    switch (recurrence.frequency) {
      case "weekdays":
        return isWeekdayIso(date);
      case "weekends":
        return isWeekendIso(date);
      default:
        return true;
    }
  };

  while (cursor <= maxDate) {
    if (recurrence.endDate && cursor > recurrence.endDate) break;
    if (matchesCursor(cursor)) {
      occurrenceCount += 1;
      if (!recurrence.count || occurrenceCount <= recurrence.count) {
        if (isVisibleMatch(cursor)) results.push(cursor);
      }
      if (recurrence.count && occurrenceCount >= recurrence.count) break;
    }
    cursor = advanceCursor(cursor);
  }
  return results;
}

export function parseDayStartMinutes(value: string | undefined): number {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

export function getMetricRange(input: MetricRangeInput & { dayStartMinutes?: number }): MetricDateRange {
  const dayStartMinutes = input.dayStartMinutes || 0;
  const anchor = input.anchorDate ? localDateTime(input.anchorDate, dayStartMinutes) : new Date();
  const todayStart = localDateTime(isoDate(anchor), dayStartMinutes);
  if (anchor < todayStart) todayStart.setDate(todayStart.getDate() - 1);

  if (input.preset === "all") {
    return {
      preset: input.preset,
      start: localDateTime("2000-01-01", dayStartMinutes),
      end: localDateTime("2100-01-01", dayStartMinutes),
      label: "全部",
    };
  }
  if (input.preset === "yesterday") {
    const start = addDays(todayStart, -1);
    return { preset: input.preset, start, end: todayStart, label: "昨天" };
  }
  if (input.preset === "thisWeek") {
    const start = startOfMetricWeek(anchor, dayStartMinutes);
    return { preset: input.preset, start, end: addDays(start, 7), label: "本周" };
  }
  if (input.preset === "lastWeek") {
    const thisWeekStart = startOfMetricWeek(anchor, dayStartMinutes);
    const start = addDays(thisWeekStart, -7);
    return { preset: input.preset, start, end: thisWeekStart, label: "上周" };
  }
  if (input.preset === "thisMonth") {
    const start = startOfMonth(anchor, dayStartMinutes);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { preset: input.preset, start, end, label: "本月" };
  }
  if (input.preset === "custom" && input.customStart && input.customEnd) {
    const start = localDateTime(input.customStart, dayStartMinutes);
    const end = addDays(localDateTime(input.customEnd, dayStartMinutes), 1);
    return { preset: input.preset, start, end, label: `${input.customStart} - ${input.customEnd}` };
  }
  return { preset: input.preset, start: todayStart, end: addDays(todayStart, 1), label: "今天" };
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function metricDatesInRange(range: MetricDateRange) {
  const dates = new Set<string>();
  let cursor = new Date(range.start);
  while (cursor < range.end) {
    dates.add(isoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function clampInterval(start: Date, end: Date, range: MetricDateRange) {
  const clampedStart = new Date(Math.max(start.getTime(), range.start.getTime()));
  const clampedEnd = new Date(Math.min(end.getTime(), range.end.getTime()));
  return clampedEnd > clampedStart ? { start: clampedStart, end: clampedEnd } : null;
}

function projectForTask(projects: Project[], task: Task) {
  return projects.find((project) => project.id === task.projectId) || null;
}

function isHabitEntry(data: PlannerData, task: Task, record: TimelineRecord) {
  if (task.id.startsWith("habit-task-") || record.id.startsWith("habit-record-")) return true;
  return (data.habitDailyStates || []).some((state) => state.timelineRecordId === record.id);
}

function isCompletedEntry(data: PlannerData, task: Task, record: TimelineRecord, habit: boolean) {
  if (habit) {
    const state = (data.habitDailyStates || []).find((item) => item.timelineRecordId === record.id);
    if (state) return Boolean(state.completed);
  }
  return Boolean(record.executionStatus === "completed" || task.completed || normalizeWorkflowStatus(task) === "done");
}

function isRecurringScheduledTask(task: Task) {
  return Boolean(
    task.recurrence &&
    task.recurrence.frequency !== "none" &&
    task.recurrence.mode === "scheduled" &&
    task.recurrence.startDate &&
    task.recurrence.startTime &&
    task.recurrence.durationMinutes
  );
}

function endForStartAndDuration(date: string, startTime: string, durationMinutes: number) {
  const start = localDateTime(date, timeToMinutes(startTime));
  const end = new Date(start.getTime() + Math.max(1, durationMinutes) * 60000);
  return { endDate: isoDate(end), endTime: minutesToTime(timeToMinutes(startTime) + durationMinutes) };
}

function allDayDurationMinutes(task: Task) {
  return Math.max(1, Math.round((task.estimatedHours || 0.5) * 60));
}

function timedMetricRecord(task: Task, record: TimelineRecord, dayStartMinutes: number): TimelineRecord {
  if (record.scheduledStart) return record;
  const startTime = minutesToTime(dayStartMinutes);
  const { endDate, endTime } = endForStartAndDuration(record.scheduledDate, startTime, allDayDurationMinutes(task));
  return {
    ...record,
    scheduledStart: startTime,
    scheduledEndDate: endDate,
    scheduledEnd: endTime,
  };
}

function taskRecords(task: Task, range: MetricDateRange, dayStartMinutes: number): TimelineRecord[] {
  const records = (task.timelineRecords || [])
    .filter((record) => record.executionStatus !== "cancelled")
    .map((record) => timedMetricRecord(task, record, dayStartMinutes));
  const allRecords = [...records];
  if (task.scheduledDate && task.scheduledStart && task.scheduledEnd) {
    allRecords.push({
      id: `legacy-${task.id}`,
      taskId: task.id,
      scheduledDate: task.scheduledDate,
      scheduledStart: task.scheduledStart,
      scheduledEndDate: task.scheduledDate,
      scheduledEnd: task.scheduledEnd,
      executionStatus: "scheduled",
      createdAt: task.createdAt,
    });
  } else if (task.scheduledDate && !task.scheduledStart) {
    const startTime = minutesToTime(dayStartMinutes);
    const { endDate, endTime } = endForStartAndDuration(task.scheduledDate, startTime, allDayDurationMinutes(task));
    allRecords.push({
      id: `metric-all-day-${task.id}-${task.scheduledDate}`,
      taskId: task.id,
      scheduledDate: task.scheduledDate,
      scheduledStart: startTime,
      scheduledEndDate: endDate,
      scheduledEnd: endTime,
      executionStatus: task.completed ? "completed" : "scheduled",
      createdAt: task.createdAt,
    });
  }
  if (isRecurringScheduledTask(task) && task.recurrence?.startTime && task.recurrence.durationMinutes) {
    if (range.preset === "all" && !task.recurrence.endDate && !task.recurrence.count) return allRecords;
    const metricDates = metricDatesInRange(range);
    const blockedDates = new Set(
      (task.timelineRecords || [])
        .filter((record) => metricDates.has(record.scheduledDate))
        .map((record) => record.scheduledDate)
    );
    if (task.scheduledDate && metricDates.has(task.scheduledDate)) blockedDates.add(task.scheduledDate);
    for (const date of enumerateRecurrenceDates(task.recurrence, metricDates)) {
      if (blockedDates.has(date)) continue;
      const { endDate, endTime } = endForStartAndDuration(date, task.recurrence.startTime, task.recurrence.durationMinutes);
      allRecords.push({
        id: `${RECURRENCE_RECORD_PREFIX}-${task.id}-${date}-${task.recurrence.startTime.replace(":", "")}`,
        taskId: task.id,
        scheduledDate: date,
        scheduledStart: task.recurrence.startTime,
        scheduledEndDate: endDate,
        scheduledEnd: endTime,
        executionStatus: "scheduled",
        createdAt: task.createdAt,
      });
    }
  }
  return allRecords;
}

function splitByMetricDay(entry: MetricTaskEntry, dayStartMinutes: number): MetricTaskEntry[] {
  const pieces: MetricTaskEntry[] = [];
  let cursor = new Date(entry.scheduledStart);
  while (cursor < entry.scheduledEnd) {
    const bucketStart = getMetricRange({ preset: "today", anchorDate: isoDate(cursor), dayStartMinutes }).start;
    const bucketEnd = addDays(bucketStart, 1);
    const end = new Date(Math.min(bucketEnd.getTime(), entry.scheduledEnd.getTime()));
    const durationMinutes = minutesBetween(cursor, end);
    if (durationMinutes > 0) pieces.push({ ...entry, scheduledStart: cursor, scheduledEnd: end, durationMinutes });
    cursor = end;
  }
  return pieces;
}

function mergeScheduledIntervals(entries: MetricTaskEntry[]) {
  const intervals = entries
    .map((entry) => ({ start: entry.scheduledStart.getTime(), end: entry.scheduledEnd.getTime() }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged.reduce((sum, item) => sum + Math.round((item.end - item.start) / 60000), 0);
}

function groupKey(task: Task, project: Project | null, groupBy: MetricGroupBy) {
  if (groupBy === "project") return project?.id || UNASSIGNED_GROUP_ID;
  if (groupBy === "importance") return task.importance || "unset";
  if (groupBy === "urgency") return task.urgency || "unset";
  if (groupBy === "completion") return task.completed || normalizeWorkflowStatus(task) === "done" ? "completed" : "incomplete";
  if (groupBy === "taskType") return task.id.startsWith("habit-task-") ? "habit" : "task";
  return UNASSIGNED_GROUP_ID;
}

function groupLabel(key: string, project: Project | null, groupBy: MetricGroupBy) {
  if (groupBy === "project") return project?.title || UNASSIGNED_LABEL;
  if (key === "unset") return "未设置";
  if (key === "completed") return "已完成";
  if (key === "incomplete") return "未完成";
  if (key === "habit") return "习惯";
  if (key === "task") return "任务";
  return key;
}

function groupColor(key: string, project: Project | null) {
  if (key === UNASSIGNED_GROUP_ID) return UNASSIGNED_COLOR;
  return project?.color || "var(--accent-active, #7EA172)";
}

export function buildTimeAllocationMetrics(options: {
  data: PlannerData;
  range: MetricRangeInput;
  dayStartMinutes?: number;
  groupBy?: MetricGroupBy;
  habitMode?: MetricHabitMode;
  completion?: MetricCompletionFilter;
  projectIds?: string[];
}): TimeAllocationMetrics {
  const dayStartMinutes = options.dayStartMinutes || 0;
  const groupBy = options.groupBy || "project";
  const habitMode = options.habitMode || "include";
  const completion = options.completion || "all";
  const range = getMetricRange({ ...options.range, dayStartMinutes });
  const projects = options.data.projects || [];
  const projectFilter = new Set(options.projectIds || []);
  const splitEntries: MetricTaskEntry[] = [];
  const debugRows: MetricDebugRow[] = [];

  for (const task of options.data.tasks || []) {
    const project = projectForTask(projects, task);
    const projectBlocked = projectFilter.size > 0 && !projectFilter.has(task.projectId || UNASSIGNED_GROUP_ID);
    for (const rawRecord of taskRecords(task, range, dayStartMinutes)) {
      const record = normalizeTimelineRecord(rawRecord);
      const start = recordStartDateTime(record);
      const end = recordEndDateTime(record);
      const clamped = clampInterval(start, end, range);
      const habit = isHabitEntry(options.data, task, record);
      const completed = isCompletedEntry(options.data, task, record, habit);
      let excludeReason = "";
      if (projectBlocked) excludeReason = "project-filter";
      else if (!clamped) excludeReason = "outside-range";
      else if (habitMode === "exclude" && habit) excludeReason = "habit-excluded";
      else if (habitMode === "only" && !habit) excludeReason = "not-habit";
      else if (completion === "completed" && !completed) excludeReason = "not-completed";
      else if (completion === "incomplete" && completed) excludeReason = "completed";
      const durationMinutes = clamped ? minutesBetween(clamped.start, clamped.end) : 0;
      if (!excludeReason && durationMinutes <= 0) excludeReason = "invalid-duration";
      debugRows.push({
        id: record.id,
        title: task.title,
        projectId: task.projectId || null,
        scheduledStart: clamped ? clamped.start.toISOString() : start.toISOString(),
        scheduledEnd: clamped ? clamped.end.toISOString() : end.toISOString(),
        durationMinutes,
        completed,
        isHabit: habit,
        included: !excludeReason,
        excludeReason,
      });
      if (excludeReason || !clamped) continue;
      const entry: MetricTaskEntry = {
        taskId: task.id,
        recordId: record.id,
        title: task.title,
        projectId: task.projectId || null,
        projectLabel: project?.title || UNASSIGNED_LABEL,
        projectColor: project?.color || UNASSIGNED_COLOR,
        durationMinutes,
        scheduledStart: clamped.start,
        scheduledEnd: clamped.end,
        completed,
        isHabit: habit,
      };
      splitEntries.push(...splitByMetricDay(entry, dayStartMinutes));
    }
  }

  if (import.meta.env.DEV && debugRows.length > 0) {
    console.table(debugRows);
  }

  const plannedMinutes = splitEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const buckets = new Map<string, Omit<TimeAllocationGroup, "percentage" | "completionRate"> & { project: Project | null }>();
  for (const entry of splitEntries) {
    const task = options.data.tasks.find((item) => item.id === entry.taskId);
    if (!task) continue;
    const project = projectForTask(projects, task);
    const key = groupKey(task, project, groupBy);
    const current = buckets.get(key) || {
      id: key,
      label: groupLabel(key, project, groupBy),
      color: groupColor(key, project),
      durationMinutes: 0,
      taskCount: 0,
      completedTaskCount: 0,
      tasks: [],
      project,
    };
    current.durationMinutes += entry.durationMinutes;
    current.tasks.push(entry);
    buckets.set(key, current);
  }

  const groups = Array.from(buckets.values())
    .map((bucket) => {
      const taskIds = new Set(bucket.tasks.map((entry) => entry.taskId));
      const completedIds = new Set(bucket.tasks.filter((entry) => entry.completed).map((entry) => entry.taskId));
      return {
        id: bucket.id,
        label: bucket.label,
        color: bucket.color,
        durationMinutes: bucket.durationMinutes,
        percentage: plannedMinutes > 0 ? (bucket.durationMinutes / plannedMinutes) * 100 : 0,
        taskCount: taskIds.size,
        completedTaskCount: completedIds.size,
        completionRate: taskIds.size > 0 ? completedIds.size / taskIds.size : 0,
        tasks: bucket.tasks.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime()),
      };
    })
    .sort((a, b) => b.durationMinutes - a.durationMinutes || a.label.localeCompare(b.label));

  const heatmap = new Map<string, TimeAllocationHeatmapBucket & { projectMinutes: Map<string, number> }>();
  for (const entry of splitEntries) {
    const date = isoDate(getMetricRange({ preset: "today", anchorDate: isoDate(entry.scheduledStart), dayStartMinutes }).start);
    const bucket = heatmap.get(date) || { key: date, date, label: date.slice(5), minutes: 0, taskCount: 0, projectMinutes: new Map<string, number>() };
    bucket.minutes += entry.durationMinutes;
    bucket.taskCount += 1;
    bucket.projectMinutes.set(entry.projectLabel, (bucket.projectMinutes.get(entry.projectLabel) || 0) + entry.durationMinutes);
    heatmap.set(date, bucket);
  }

  const heatmapBuckets = Array.from(heatmap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((bucket) => {
      const topProject = Array.from(bucket.projectMinutes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { key: bucket.key, date: bucket.date, label: bucket.label, minutes: bucket.minutes, taskCount: bucket.taskCount, topProject };
    });
  const uniqueTaskIds = new Set(splitEntries.map((entry) => entry.taskId));
  const completedTaskIds = new Set(splitEntries.filter((entry) => entry.completed).map((entry) => entry.taskId));
  const rangeMinutes = range.preset === "all" ? 0 : minutesBetween(range.start, range.end);
  const occupiedMinutes = mergeScheduledIntervals(splitEntries);

  return {
    range,
    groups,
    taskEntries: splitEntries.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime()),
    heatmapBuckets,
    summary: {
      plannedMinutes,
      unplannedMinutes: Math.max(0, rangeMinutes - occupiedMinutes),
      taskCount: uniqueTaskIds.size,
      completedTaskCount: completedTaskIds.size,
      completionRate: uniqueTaskIds.size > 0 ? completedTaskIds.size / uniqueTaskIds.size : 0,
      topGroup: groups[0],
    },
  };
}
