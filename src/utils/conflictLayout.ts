import type { Task } from "../types";

export type ConflictLayout = Map<string, { index: number; count: number }>;

type ScheduledInterval = {
  taskId: string;
  startMinutes: number;
  endMinutes: number;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function scheduledInterval(task: Task): ScheduledInterval | null {
  if (!task.scheduledStart || !task.scheduledEnd) return null;
  const startMinutes = timeToMinutes(task.scheduledStart);
  let endMinutes = timeToMinutes(task.scheduledEnd);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return { taskId: task.id, startMinutes, endMinutes };
}

/**
 * Assigns overlapping tasks on one schedule date to side-by-side columns.
 * End times at or before their start are treated as crossing midnight.
 */
export function computeConflictLayout(tasks: Task[], maxColumns = Infinity): ConflictLayout {
  if (tasks.length <= 1) return new Map();

  const intervals = tasks
    .map(scheduledInterval)
    .filter((interval): interval is ScheduledInterval => interval !== null)
    .sort((a, b) =>
      a.startMinutes - b.startMinutes ||
      (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
    );

  if (intervals.length <= 1) return new Map();

  const groups: ScheduledInterval[][] = [];
  let currentGroup: ScheduledInterval[] = [];
  let groupEnd = -Infinity;

  for (const interval of intervals) {
    if (interval.startMinutes < groupEnd) {
      currentGroup.push(interval);
      groupEnd = Math.max(groupEnd, interval.endMinutes);
      continue;
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    currentGroup = [interval];
    groupEnd = interval.endMinutes;
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result: ConflictLayout = new Map();
  for (const group of groups) {
    if (group.length <= 1) continue;

    const columnEndTimes: number[] = [];
    const assignments: Array<{ taskId: string; column: number }> = [];

    for (const interval of group) {
      let column = columnEndTimes.findIndex((endMinutes) => endMinutes <= interval.startMinutes);
      if (column === -1) {
        column = columnEndTimes.length;
        columnEndTimes.push(interval.endMinutes);
      } else {
        columnEndTimes[column] = interval.endMinutes;
      }
      assignments.push({ taskId: interval.taskId, column });
    }

    const columnCount = Math.max(1, Math.min(columnEndTimes.length, maxColumns));
    for (const assignment of assignments) {
      result.set(assignment.taskId, {
        index: Math.min(assignment.column, columnCount - 1),
        count: columnCount,
      });
    }
  }

  return result;
}

export function computeConflictStyle(
  taskId: string,
  layout: ConflictLayout,
  innerWidth: number,
  baseLeft: number,
  gap: number,
  viewMode = "daily",
): { left: number; width: number; isNarrow: boolean } | null {
  const conflict = layout.get(taskId);
  if (!conflict || conflict.count <= 1) return null;

  const effectiveGap = Math.min(gap, innerWidth / Math.max(conflict.count * 2, 1));
  const slotWidth = Math.max(0, (innerWidth - effectiveGap * (conflict.count - 1)) / conflict.count);
  return {
    left: baseLeft + conflict.index * (slotWidth + effectiveGap),
    width: slotWidth,
    isNarrow: viewMode !== "daily" && slotWidth < 80,
  };
}
