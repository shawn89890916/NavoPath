/**
 * NavoPath — Unified Timeline Geometry System
 *
 * ALL timeline views (daily / 3day / weekly) MUST use this module for:
 *  1. visible day calculation
 *  2. pointer → date + time (drag-and-drop target)
 *  3. event → pixel rect (time block rendering)
 *
 * No view should compute its own coordinate logic.
 */

// ── Constants ──
export const SLOT_MINUTES = 15;
export const SLOT_HEIGHT = 20; // px per 15‑min slot
export const TIMELINE_START = 0; // hour
export const TIMELINE_END = 24; // hour

/** hourHeight = SLOT_HEIGHT × (60 / SLOT_MINUTES) = 80 px */
export const HOUR_HEIGHT = SLOT_HEIGHT * (60 / SLOT_MINUTES);

// ── Helpers ──

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localIso(d);
}

export function startOfWeekIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return localIso(d);
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function minutesToTime(minutes: number): string {
  const n = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

/**
 * Duration in minutes between two HH:MM time strings, treating the end as
 * strictly later than the start. When `end` is numerically ≤ `start` the end
 * is assumed to fall on the following day (cross-midnight), so a 23:30→00:30
 * span yields 60 minutes instead of -1380.
 *
 * Use this anywhere a duration is derived from `scheduledStart`/`scheduledEnd`
 * so cross-midnight timeline blocks render and resize correctly.
 */
export function durationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/**
 * Absolute minutes of a `{date, time}` point relative to `anchorDate`'s start
 * of day. Used to convert scheduled date+time into the continuous vertical
 * coordinate used by infinite cross-day scrolling.
 */
export function dateTimeToAbsoluteMinutes(date: string, time: string, anchorDate: string): number {
  const dayIndex = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${anchorDate}T00:00:00`).getTime()) / 86400000,
  );
  return dayIndex * 24 * 60 + timeToMinutes(time);
}

/**
 * Inverse of `dateTimeToAbsoluteMinutes`: turn continuous absolute minutes
 * (relative to `anchorDate`) back into a `{date, time}` pair. Handles values
 * that fall on later days (band index > 0) by advancing the date.
 */
export function absoluteMinutesToDateTime(
  absoluteMinutes: number,
  anchorDate: string,
): { date: string; time: string } {
  const safeMinutes = ((absoluteMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const dayOffset = Math.floor(absoluteMinutes / (24 * 60));
  return { date: addDays(anchorDate, dayOffset), time: minutesToTime(safeMinutes) };
}

/** Snap an absolute-minutes value to the timeline grid. */
export function snapMinutes(minutes: number, snap = SLOT_MINUTES): number {
  return Math.round(minutes / snap) * snap;
}

// ── 1. Visible Days ──

export type TimelineViewMode = "daily" | "3day" | "weekly";

export function getVisibleDays(viewMode: TimelineViewMode, currentDate: string): string[] {
  if (viewMode === "daily") return [currentDate];
  const rangeStart = viewMode === "weekly" ? startOfWeekIso(currentDate) : currentDate;
  const rangeLength = viewMode === "weekly" ? 7 : 3;
  return Array.from({ length: rangeLength }, (_, i) => addDays(rangeStart, i));
}

// ── 2. Timeline Metrics ──

export interface TimelineMetricsInput {
  gridElement: HTMLElement;
  scrollElement: HTMLElement;
  visibleDays: string[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
}

export interface TimelineMetrics {
  gridRect: DOMRect;
  scrollRect: DOMRect;
  scrollTop: number;
  columnWidth: number;
  pxPerMinute: number;
  totalMinutes: number;
  visibleDays: string[];
  startHour: number;
}

export function getTimelineMetrics(input: TimelineMetricsInput): TimelineMetrics {
  const startHour = input.startHour ?? TIMELINE_START;
  const endHour = input.endHour ?? TIMELINE_END;
  const hourHeight = input.hourHeight ?? HOUR_HEIGHT;

  const gridRect = input.gridElement.getBoundingClientRect();
  const scrollRect = input.scrollElement.getBoundingClientRect();
  const scrollTop = input.scrollElement.scrollTop;
  const columnWidth = gridRect.width / input.visibleDays.length;
  const pxPerMinute = hourHeight / 60;
  const totalMinutes = (endHour - startHour) * 60;

  return {
    gridRect,
    scrollRect,
    scrollTop,
    columnWidth,
    pxPerMinute,
    totalMinutes,
    visibleDays: input.visibleDays,
    startHour,
  };
}

// ── 3. Pointer → Date + Time ──

export interface PointerToDateTimeInput {
  clientX: number;
  clientY: number;
  gridElement: HTMLElement;
  scrollElement: HTMLElement;
  visibleDays: string[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  snapMinutes?: number;
  debugLabel?: string;
}

export interface PointerDateTimeResult {
  date: string;
  dayIndex: number;
  minutes: number;
  startTime: string;
  endTime: string;
}

export function pointerToDateTime(input: PointerToDateTimeInput): PointerDateTimeResult {
  const m = getTimelineMetrics(input);

  // x → column / day
  const x = input.clientX - m.gridRect.left;
  const dayIndex = clamp(Math.floor(x / m.columnWidth), 0, m.visibleDays.length - 1);
  const date = m.visibleDays[dayIndex];

  // y → time
  // gridRect.top is the viewport position of the grid element.
  // It already reflects both header offset (day label, all‑day row) AND scroll position.
  // clientY - gridRect.top gives the Y coordinate within the grid element itself.
  const y = input.clientY - m.gridRect.top;
  const minutesFromStart = y / m.pxPerMinute;
  const snap = input.snapMinutes ?? SLOT_MINUTES;
  const snapped = clamp(Math.round(minutesFromStart / snap) * snap, 0, 24 * 60 - snap);
  let minutes = m.startHour * 60 + snapped;
  minutes = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);

  const startTime = minutesToTime(minutes);
  const endTime = addMinutes(startTime, snap);

  if (input.debugLabel) {
    console.table({
      label: input.debugLabel,
      viewDays: m.visibleDays.length,
      clientX: input.clientX,
      clientY: input.clientY,
      gridLeft: Math.round(m.gridRect.left),
      scrollTop: Math.round(m.scrollRect.top),
      contentScroll: m.scrollTop,
      x: Math.round(x),
      y: Math.round(y),
      columnWidth: Math.round(m.columnWidth),
      dayIndex,
      targetDate: date,
      targetTime: startTime,
    });
  }

  return { date, dayIndex, minutes, startTime, endTime };
}

// ── 4. Event → Pixel Rect ──

export interface EventToRectInput {
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  visibleDays: string[];
  columnWidth: number;
  startHour?: number;
  hourHeight?: number;
  /** Horizontal gutter inside each column (px) */
  gutter?: number;
}

export interface EventRect {
  left: number;
  top: number;
  width: number;
  height: number;
  dayIndex: number;
}

export function eventToRect(input: EventToRectInput): EventRect {
  const startHour = input.startHour ?? TIMELINE_START;
  const hourHeight = input.hourHeight ?? HOUR_HEIGHT;
  const gutter = input.gutter ?? 8;
  const { visibleDays, columnWidth, scheduledDate, scheduledStart, scheduledEnd } = input;

  const dayIndex = visibleDays.indexOf(scheduledDate);
  if (dayIndex === -1) {
    // Off‑screen day — return a zero rect
    return { left: 0, top: 0, width: 0, height: 0, dayIndex: -1 };
  }

  const startMin = timeToMinutes(scheduledStart);
  const endMin = timeToMinutes(scheduledEnd);
  const duration = Math.max(endMin - startMin, SLOT_MINUTES);

  const left = dayIndex * columnWidth + gutter;
  let diff = startMin - startHour * 60;
  if (diff < 0) diff += 24 * 60;
  const top = (diff / 60) * hourHeight;
  const width = columnWidth - gutter * 2;
  const height = Math.max((duration / 60) * hourHeight, SLOT_HEIGHT);

  return { left, top, width, height, dayIndex };
}

// ── 5. Utility — compute top/height for a time block inside a column ──

export function timeBlockTop(startTime: string, startHour = TIMELINE_START, hourHeight = HOUR_HEIGHT): number {
  let diff = timeToMinutes(startTime) - startHour * 60;
  if (diff < 0) diff += 24 * 60;
  return (diff / 60) * hourHeight;
}

export function timeBlockHeight(startTime: string, endTime: string, startHour = TIMELINE_START, hourHeight = HOUR_HEIGHT): number {
  // Cross-midnight spans (e.g. 23:30→00:30) must keep their full 60m height
  // instead of collapsing to the SLOT_MINUTES fallback.
  const dur = Math.max(durationMinutes(startTime, endTime), SLOT_MINUTES);
  return Math.max((dur / 60) * hourHeight, SLOT_HEIGHT);
}
