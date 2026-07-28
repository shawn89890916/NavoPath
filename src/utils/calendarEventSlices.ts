import type { CalendarEvent, TimelineRecord } from "../types";
import { addDays, enumerateRecurrenceDates } from "./recurrence";
import {
  calculateTimelineRecordEnd,
  calendarDateTimeSpanMinutes,
  minutesOfDay,
  sliceTimelineRecord,
} from "./timelineRecords";

export type CalendarEventSlice = {
  id: string;
  occurrenceDate: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

function clockTime(minutes: number) {
  const normalized = minutes % 1_440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function calendarEventDurationMinutes(event: CalendarEvent) {
  if (event.recurrence?.durationMinutes) return event.recurrence.durationMinutes;
  if (!event.startTime || !event.endTime) return 60;
  if (!event.recurrence) {
    const startDate = event.startDate || event.date;
    const endDate = event.endDate && event.endDate >= startDate ? event.endDate : startDate;
    const calendarDuration = calendarDateTimeSpanMinutes(
      startDate,
      event.startTime,
      endDate,
      event.endTime,
    );
    if (calendarDuration > 0) return calendarDuration;
  }
  let duration = minutesOfDay(event.endTime) - minutesOfDay(event.startTime);
  if (duration <= 0) duration += 1_440;
  return duration;
}

function occurrenceRecord(event: CalendarEvent, occurrenceDate: string): TimelineRecord {
  const startTime = event.startTime || "00:00";
  if (event.recurrence) {
    return {
      id: `event_occ_${event.id}_${occurrenceDate}_${startTime}`,
      taskId: event.id,
      scheduledDate: occurrenceDate,
      scheduledStart: startTime,
      ...calculateTimelineRecordEnd(occurrenceDate, startTime, calendarEventDurationMinutes(event)),
      executionStatus: "scheduled",
      createdAt: event.createdAt,
    };
  }

  const endTime = event.endTime || calculateTimelineRecordEnd(occurrenceDate, startTime, 60).scheduledEnd;
  let endDate = event.endDate && event.endDate >= occurrenceDate ? event.endDate : occurrenceDate;
  if (endDate === occurrenceDate && minutesOfDay(endTime) <= minutesOfDay(startTime)) {
    endDate = calculateTimelineRecordEnd(
      occurrenceDate,
      startTime,
      calendarEventDurationMinutes(event),
    ).scheduledEndDate || occurrenceDate;
  }
  return {
    id: `event_occ_${event.id}_${occurrenceDate}_${startTime}`,
    taskId: event.id,
    scheduledDate: occurrenceDate,
    scheduledStart: startTime,
    scheduledEndDate: endDate,
    scheduledEnd: endTime,
    executionStatus: "scheduled",
    createdAt: event.createdAt,
  };
}

export function expandTimedCalendarEvent(
  event: CalendarEvent,
  visibleDates: string[],
): CalendarEventSlice[] {
  if (!event.startTime || visibleDates.length === 0) return [];
  const occurrenceDates = event.recurrence
    ? enumerateRecurrenceDates(
        event.recurrence,
        new Set(visibleDates.flatMap((date) => [addDays(date, -1), date])),
      )
    : [event.startDate || event.date];

  return occurrenceDates
    .flatMap((occurrenceDate) => {
      const record = occurrenceRecord(event, occurrenceDate);
      return sliceTimelineRecord(record, visibleDates).map((slice) => ({
        id: `${record.id}_${slice.date}`,
        occurrenceDate,
        date: slice.date,
        startTime: clockTime(slice.startMinutes),
        endTime: clockTime(slice.endMinutes),
        durationMinutes: slice.endMinutes - slice.startMinutes,
        continuesBefore: slice.continuesBefore,
        continuesAfter: slice.continuesAfter,
      }));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}
