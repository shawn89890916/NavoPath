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

export function calendarDateTimeSpanMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): number {
  const startDay = Date.parse(`${startDate}T00:00:00.000Z`);
  const endDay = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.max(0, Math.round((endDay - startDay) / 86_400_000) * 1_440
    + minutesOfDay(endTime)
    - minutesOfDay(startTime));
}

export function timelineRecordDurationMinutes(record: TimelineRecord): number {
  const normalized = normalizeTimelineRecord(record);
  let duration = calendarDateTimeSpanMinutes(
    normalized.scheduledDate,
    normalized.scheduledStart,
    normalized.scheduledEndDate || normalized.scheduledDate,
    normalized.scheduledEnd,
  );
  if (!record.scheduledEndDate && duration <= 0) duration += 1_440;
  return duration;
}

export function rescheduleTimelineRecord(
  record: TimelineRecord,
  scheduledDate: string,
  scheduledStart: string,
  durationMinutes = timelineRecordDurationMinutes(record),
): TimelineRecord {
  return {
    ...record,
    scheduledDate,
    scheduledStart,
    ...calculateTimelineRecordEnd(scheduledDate, scheduledStart, durationMinutes),
  };
}

export function normalizeTimelineRecord(record: TimelineRecord): TimelineRecord {
  if (record.scheduledEndDate) return record;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(record.scheduledStart)
    || !validTime.test(record.scheduledEnd)
    || !Number.isFinite(Date.parse(`${record.scheduledDate}T00:00:00.000Z`))) {
    return { ...record, scheduledEndDate: record.scheduledDate };
  }
  const startMinutes = minutesOfDay(record.scheduledStart);
  const endMinutes = minutesOfDay(record.scheduledEnd);
  const durationMinutes = endMinutes > startMinutes
    ? endMinutes - startMinutes
    : endMinutes - startMinutes + 1_440;
  return {
    ...record,
    scheduledEndDate: calculateTimelineRecordEnd(
      record.scheduledDate,
      record.scheduledStart,
      durationMinutes,
    ).scheduledEndDate,
  };
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

export function clockTimeSpanMinutes(startTime: string, endTime: string): number {
  let duration = minutesOfDay(endTime) - minutesOfDay(startTime);
  if (duration <= 0) duration += 1_440;
  return duration;
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
    const endsAtNextMidnight = endMinutes === 0
      && Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${date}T00:00:00.000Z`) === 86_400_000;
    return [{
      recordId: normalized.id,
      taskId: normalized.taskId,
      date,
      startMinutes: sliceStart,
      endMinutes: sliceEnd,
      continuesBefore: !isStart,
      continuesAfter: !isEnd && !endsAtNextMidnight,
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
