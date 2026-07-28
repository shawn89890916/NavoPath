import type { TimelineRecord } from "../types";

export type TimelineSlice = {
  recordId: string;
  taskId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type TimelineFocusTarget = {
  date: string;
  recordId: string;
  taskId: string;
  time: string;
};

export function calculateTimelineRecordEnd(
  scheduledDate: string,
  scheduledStart: string,
  durationMinutes: number,
): Pick<TimelineRecord, "scheduledEndDate" | "scheduledEnd"> {
  const [year, month, day] = scheduledDate.split("-").map(Number);
  const [hours, minutes] = scheduledStart.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + Math.max(0, Math.round(durationMinutes));
  const endDate = new Date(Date.UTC(year, month - 1, day + Math.floor(totalMinutes / 1_440)));
  return {
    scheduledEndDate: `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`,
    scheduledEnd: `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`,
  };
}

export function normalizeTimelineRecord(record: TimelineRecord): TimelineRecord {
  return { ...record, scheduledEndDate: record.scheduledEndDate || record.scheduledDate };
}

export function recordStartDateTime(record: TimelineRecord): Date {
  return new Date(`${record.scheduledDate}T${record.scheduledStart || "00:00"}:00`);
}

export function recordEndDateTime(record: TimelineRecord): Date {
  const normalized = normalizeTimelineRecord(record);
  return new Date(`${normalized.scheduledEndDate}T${normalized.scheduledEnd || normalized.scheduledStart || "00:00"}:00`);
}

export function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return Math.max(0, Math.min(24 * 60, (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)));
}

export function sliceTimelineRecord(record: TimelineRecord, visibleDates: string[]): TimelineSlice[] {
  const normalized = normalizeTimelineRecord(record);
  const startDate = normalized.scheduledDate;
  const endDate = normalized.scheduledEndDate || normalized.scheduledDate;
  const startMinutes = minutesOfDay(normalized.scheduledStart || "00:00");
  const endMinutes = minutesOfDay(normalized.scheduledEnd || normalized.scheduledStart || "00:00");

  return visibleDates.flatMap((date) => {
    if (date < startDate || date > endDate) return [];
    const isStart = date === startDate;
    const isEnd = date === endDate;
    const sliceStart = isStart ? startMinutes : 0;
    const sliceEnd = isEnd ? endMinutes : 24 * 60;
    if (sliceEnd <= sliceStart) return [];
    return [{
      recordId: normalized.id,
      taskId: normalized.taskId,
      date,
      startMinutes: sliceStart,
      endMinutes: sliceEnd,
      continuesBefore: !isStart,
      continuesAfter: !isEnd,
    }];
  });
}

export function focusTargetForRecord(record: TimelineRecord): TimelineFocusTarget {
  return {
    date: record.scheduledDate,
    recordId: record.id,
    taskId: record.taskId,
    time: record.scheduledStart || "00:00",
  };
}
