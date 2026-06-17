// timeBlocking.ts — TrevorAI-style time-blocking scheduler for NavoPath.
// Lightweight, dependency-free, deterministic. Given a set of tasks and the
// user's existing schedule, return a list of conflict-free time blocks.

import type { Priority, Task } from "../types";

export type TimeBlockPrefs = {
  /** Earliest start time in HH:mm (24h) */
  startOfDay?: string;
  /** Latest end time in HH:mm (24h) */
  endOfDay?: string;
  /** Default length when task has no estimatedHours */
  defaultMinutes?: number;
  /** Optional pomodoro break inserted between blocks (minutes) */
  breakMinutes?: number;
  /** Date string (YYYY-MM-DD) these blocks belong to */
  date: string;
};

export type TimeBlock = {
  taskId: string;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  reason?: string;
};

export type ExistingSlot = { start: string; end: string; title?: string };

export type TimeBlockResult = {
  blocks: TimeBlock[];
  conflicts: Array<{ taskId: string; reason: string }>;
  unscheduled: Array<{ taskId: string; reason: string }>;
};

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Build time blocks for a single day.
 *
 * Strategy (TrevorAI-flavored, no LLM needed):
 * 1. Sort tasks by (priority, urgency, dueDate, estimatedHours desc).
 * 2. Mark busy slots from existingSchedule.
 * 3. Greedy pack: walk minutes from startOfDay to endOfDay, skip busy slots,
 *    place the next task's estimatedHours, insert breaks between blocks.
 */
export function buildTimeBlocks(
  tasks: Task[],
  existingSchedule: ExistingSlot[],
  prefs: TimeBlockPrefs,
): TimeBlockResult {
  const start = prefs.startOfDay || "08:00";
  const end = prefs.endOfDay || "22:00";
  const defaultMinutes = prefs.defaultMinutes || 45;
  const breakMinutes = prefs.breakMinutes || 5;

  const candidates = tasks
    .filter((t) => !t.completed)
    .map((t) => ({
      task: t,
      minutes: pickDurationMinutes(t, defaultMinutes),
    }))
    .sort(sortByPriority);

  const busy: Array<{ start: number; end: number }> = existingSchedule
    .map((s) => ({ start: timeToMinutes(s.start), end: timeToMinutes(s.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

  const blocks: TimeBlock[] = [];
  const conflicts: TimeBlockResult["conflicts"] = [];
  const unscheduled: TimeBlockResult["unscheduled"] = [];

  const dayStart = timeToMinutes(start);
  const dayEnd = timeToMinutes(end);
  let cursor = dayStart;

  for (const { task, minutes } of candidates) {
    if (cursor + minutes > dayEnd) {
      unscheduled.push({ taskId: task.id, reason: "今日时间窗口已满" });
      continue;
    }
    const slot = findSlot(cursor, dayEnd, minutes, busy);
    if (!slot) {
      // Try a fresh start from dayStart (a later gap may be open).
      const later = findSlot(dayStart, dayEnd, minutes, busy, cursor);
      if (!later) {
        unscheduled.push({ taskId: task.id, reason: "找不到空闲时段" });
        continue;
      }
      placeBlock(blocks, busy, task, minutes, later.start, later.end, prefs);
      cursor = later.end + breakMinutes;
    } else {
      placeBlock(blocks, busy, task, minutes, slot.start, slot.end, prefs);
      cursor = slot.end + breakMinutes;
    }
  }

  if (blocks.length === 0 && candidates.length > 0) {
    conflicts.push({ taskId: candidates[0].task.id, reason: "现有日程占满整天" });
  }

  return { blocks, conflicts, unscheduled };
}

function placeBlock(
  blocks: TimeBlock[],
  busy: Array<{ start: number; end: number }>,
  task: Task,
  minutes: number,
  startMin: number,
  endMin: number,
  prefs: TimeBlockPrefs,
) {
  const actualMinutes = endMin - startMin;
  blocks.push({
    taskId: task.id,
    title: task.title,
    start: minutesToTime(startMin),
    end: minutesToTime(endMin),
    durationMinutes: actualMinutes || minutes,
    reason: prefs.date,
  });
  busy.push({ start: startMin, end: endMin });
}

function findSlot(
  fromMin: number,
  toMin: number,
  minutes: number,
  busy: Array<{ start: number; end: number }>,
  afterMin: number = -1,
): { start: number; end: number } | null {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  let cursor = Math.max(fromMin, afterMin + 1);
  for (const b of sorted) {
    if (b.start >= toMin) break;
    if (b.end <= cursor) continue;
    if (b.start - cursor >= minutes) {
      return { start: cursor, end: cursor + minutes };
    }
    cursor = Math.max(cursor, b.end);
  }
  if (toMin - cursor >= minutes) {
    return { start: cursor, end: cursor + minutes };
  }
  return null;
}

function sortByPriority(
  a: { task: Task; minutes: number },
  b: { task: Task; minutes: number },
) {
  const pa = PRIORITY_WEIGHT[a.task.priority] ?? 2;
  const pb = PRIORITY_WEIGHT[b.task.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  // Earlier due date first
  const da = a.task.dueDate || "9999-12-31";
  const db = b.task.dueDate || "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  return b.minutes - a.minutes;
}

function pickDurationMinutes(task: Task, fallback: number) {
  if (task.estimatedHours && task.estimatedHours > 0) {
    return Math.max(15, Math.round(task.estimatedHours * 60));
  }
  return fallback;
}

function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
