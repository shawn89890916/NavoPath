// deadlineReminder.ts — Bucket tasks by deadline urgency for the top-bar badge.
// Lightweight, no external deps. Returns the same shape that the UI badge hook
// in main.tsx consumes.

import type { Task } from "../types";

export type DeadlineBuckets = {
  overdue: Task[];
  dueToday: Task[];
  upcoming24h: Task[];
  upcomingWeek: Task[];
  total: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluate every non-completed task against the current time. Tasks without a
 * due date are ignored. Tasks whose `plannedForDate` is today (and not
 * completed) are considered "due today" so the user gets a gentle nudge.
 */
export function evaluateDeadlines(tasks: Task[], now: Date = new Date()): DeadlineBuckets {
  const nowIso = toIsoDate(now);
  const tomorrow = toIsoDate(new Date(now.getTime() + ONE_DAY_MS));
  const weekFromNow = toIsoDate(new Date(now.getTime() + 7 * ONE_DAY_MS));

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const upcoming24h: Task[] = [];
  const upcomingWeek: Task[] = [];

  for (const task of tasks) {
    if (task.completed) continue;
    const due = task.dueDate;
    const planned = task.plannedForDate;
    if (!due && !planned) continue;

    if (due && due < nowIso) {
      overdue.push(task);
      continue;
    }
    if (due && due === nowIso) {
      dueToday.push(task);
      continue;
    }
    if (planned === nowIso) {
      dueToday.push(task);
      continue;
    }
    if (due && due === tomorrow) {
      upcoming24h.push(task);
      continue;
    }
    if (due && due > nowIso && due <= weekFromNow) {
      upcomingWeek.push(task);
    }
  }

  // Stable order: highest priority first, then earliest due date.
  const sorter = (a: Task, b: Task) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    const pa = order[a.priority ?? "low"] ?? 2;
    const pb = order[b.priority ?? "low"] ?? 2;
    if (pa !== pb) return pa - pb;
    return (a.dueDate || "").localeCompare(b.dueDate || "");
  };
  overdue.sort(sorter);
  dueToday.sort(sorter);
  upcoming24h.sort(sorter);
  upcomingWeek.sort(sorter);

  return {
    overdue,
    dueToday,
    upcoming24h,
    upcomingWeek,
    total: overdue.length + dueToday.length + upcoming24h.length + upcomingWeek.length,
  };
}

/**
 * Convenience hook: returns the count used to drive the small badge on the
 * top bar. The full `evaluateDeadlines` payload can be opened in a popover.
 */
export function deadlineBadgeCount(tasks: Task[], now: Date = new Date()): number {
  const b = evaluateDeadlines(tasks, now);
  return b.overdue.length + b.dueToday.length + b.upcoming24h.length;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
