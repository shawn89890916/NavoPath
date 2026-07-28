import type { Task, TaskRecurrence, TimelineRecord } from "../types";

const RECURRENCE_OCCURRENCE_MARKER = "__occ__";

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

export function addMonths(iso: string, months: number) {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return localIso(date);
}

function isWeekdayIso(iso: string) {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return day >= 1 && day <= 5;
}

function isWeekendIso(iso: string) {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function enumerateRecurrenceDates(recurrence: TaskRecurrence, visibleDates: Set<string>) {
  if (!recurrence.startDate || visibleDates.size === 0) return [];
  const startDate = recurrence.startDate;
  const sortedVisibleDates = [...visibleDates].sort();
  const minDate = sortedVisibleDates[0];
  const maxDate = sortedVisibleDates[sortedVisibleDates.length - 1];
  const results: string[] = [];
  let cursor = startDate;
  let occurrenceCount = 0;
  let monthOffset = 0;

  const advanceCursor = (date: string) => {
    switch (recurrence.frequency) {
      case "weekly":
        return addDays(date, 7);
      case "biweekly":
        return addDays(date, 14);
      case "monthly":
        monthOffset += 1;
        return addMonths(startDate, monthOffset);
      case "quarterly":
        monthOffset += 3;
        return addMonths(startDate, monthOffset);
      default:
        return addDays(date, 1);
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
      if ((!recurrence.count || occurrenceCount <= recurrence.count) &&
          cursor >= minDate && visibleDates.has(cursor)) {
        results.push(cursor);
      }
      if (recurrence.count && occurrenceCount >= recurrence.count) break;
    }
    cursor = advanceCursor(cursor);
  }

  return results;
}

export function startOfWeekIso(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return localIso(date);
}

export function hasRecurringRule(task: Task) {
  return Boolean(task.recurrence && task.recurrence.frequency !== "none");
}

export function isRecurringScheduledTask(task: Task) {
  return Boolean(
    task.recurrence &&
    task.recurrence.frequency !== "none" &&
    task.recurrence.mode === "scheduled" &&
    task.recurrence.startDate &&
    task.recurrence.startTime &&
    task.recurrence.durationMinutes
  );
}

export function buildRecurrenceOccurrenceId(taskId: string, date: string, startTime: string) {
  return `${taskId}${RECURRENCE_OCCURRENCE_MARKER}${date}${RECURRENCE_OCCURRENCE_MARKER}${startTime}`;
}

export function parseRecurrenceOccurrenceId(occurrenceId: string) {
  const timeSeparator = occurrenceId.lastIndexOf(RECURRENCE_OCCURRENCE_MARKER);
  const dateSeparator = occurrenceId.lastIndexOf(
    RECURRENCE_OCCURRENCE_MARKER,
    timeSeparator - 1,
  );
  if (dateSeparator <= 0 || timeSeparator <= dateSeparator) return null;
  const taskId = occurrenceId.slice(0, dateSeparator);
  const scheduledDate = occurrenceId.slice(
    dateSeparator + RECURRENCE_OCCURRENCE_MARKER.length,
    timeSeparator,
  );
  const scheduledStart = occurrenceId.slice(
    timeSeparator + RECURRENCE_OCCURRENCE_MARKER.length,
  );
  const parsedDate = new Date(`${scheduledDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== scheduledDate ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduledStart)
  ) {
    return null;
  }
  return {
    taskId,
    scheduledDate,
    scheduledStart,
  };
}

export function hasRecurrenceOccurrenceOnDate(task: Task, date: string) {
  if (!isRecurringScheduledTask(task) || !task.recurrence) return false;
  return enumerateRecurrenceDates(task.recurrence, new Set([date])).includes(date);
}

export function matchesOccurrence(record: TimelineRecord, scheduledDate: string, scheduledStart?: string) {
  if (record.scheduledDate !== scheduledDate) return false;
  if (!scheduledStart) return true;
  return record.scheduledStart === scheduledStart;
}
