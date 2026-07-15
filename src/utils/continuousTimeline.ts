import { addDays, HOUR_HEIGHT, SLOT_MINUTES, minutesToTime, timeToMinutes } from "../timelineGeometry";

export const DAILY_CONTINUOUS_DAY_COUNT = 7;

const MINUTES_PER_DAY = 24 * 60;

function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function dayOffset(date: string, anchorDate: string) {
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${anchorDate}T00:00:00`).getTime()) / 86400000);
}

export function buildDailyContinuousDates(anchorDate: string, enabled: boolean, dayCount = DAILY_CONTINUOUS_DAY_COUNT): string[] {
  const count = enabled ? dayCount : 1;
  const before = enabled ? Math.floor(count / 2) : 0;
  return Array.from({ length: count }, (_, index) => addDays(anchorDate, index - before));
}

export function dailyContinuousCanvasHeight(dayCount: number, slotHeight: number): number {
  return dayCount * (MINUTES_PER_DAY / SLOT_MINUTES) * slotHeight;
}

export function dailyContinuousSlotCount(dayCount: number): number {
  return dayCount * (MINUTES_PER_DAY / SLOT_MINUTES) + 1;
}

export function dailyContinuousBlockTop(
  date: string,
  startTime: string,
  anchorDate: string,
  dayStartHour: number,
  hourHeight = HOUR_HEIGHT,
): number {
  const offset = dayOffset(date, anchorDate);
  let minutesFromDayStart = timeToMinutes(startTime) - dayStartHour * 60;
  if (minutesFromDayStart < 0) minutesFromDayStart += MINUTES_PER_DAY;
  return offset * MINUTES_PER_DAY / 60 * hourHeight + minutesFromDayStart / 60 * hourHeight;
}

export function dailyContinuousSlotLabel({
  index,
  anchorDate,
  dayStartHour,
  dateStep = 1,
}: {
  index: number;
  anchorDate: string;
  dayStartHour: number;
  dateStep?: number;
}): string {
  const absoluteMinutes = dayStartHour * 60 + index * SLOT_MINUTES;
  const minuteOfDay = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (minuteOfDay % 60 !== 0) return "";
  const date = addDays(anchorDate, Math.floor(absoluteMinutes / MINUTES_PER_DAY) * Math.max(1, dateStep));
  if (index > 0 && minuteOfDay === 0) return `${shortDate(date)} 0:00`;
  return `${Math.floor(minuteOfDay / 60)}:00`;
}

export function getContinuousTimelineDateForOffset(anchorDate: string, offset: number, columnCount: number): string {
  return addDays(anchorDate, offset * Math.max(1, columnCount));
}

export function dailyContinuousTargetFromContentY({
  contentY,
  anchorDate,
  dayStartHour,
  dayCount,
  hourHeight = HOUR_HEIGHT,
  snapMinutes = SLOT_MINUTES,
}: {
  contentY: number;
  anchorDate: string;
  dayStartHour: number;
  dayCount: number;
  hourHeight?: number;
  snapMinutes?: number;
}) {
  const pxPerMinute = hourHeight / 60;
  const maxMinutes = dayCount * MINUTES_PER_DAY - snapMinutes;
  const snappedFromStart = Math.min(
    maxMinutes,
    Math.max(0, Math.round((contentY / pxPerMinute) / snapMinutes) * snapMinutes),
  );
  const absoluteMinutes = dayStartHour * 60 + snappedFromStart;
  const dateOffset = Math.floor(absoluteMinutes / MINUTES_PER_DAY);
  const minutes = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const startTime = minutesToTime(minutes);
  return {
    date: addDays(anchorDate, dateOffset),
    startTime,
    endTime: minutesToTime(minutes + snapMinutes),
    dayIndex: dateOffset,
    minutes,
  };
}
