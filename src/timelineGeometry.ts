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
  const snapped = Math.round(minutesFromStart / snap) * snap;
  const minutes = clamp(
    m.startHour * 60 + snapped,
    m.startHour * 60,
    (input.endHour ?? TIMELINE_END) * 60 - snap,
  );

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
  const top = ((startMin - startHour * 60) / 60) * hourHeight;
  const width = columnWidth - gutter * 2;
  const height = Math.max((duration / 60) * hourHeight, SLOT_HEIGHT);

  return { left, top, width, height, dayIndex };
}

// ── 5. Utility — compute top/height for a time block inside a column ──

export function timeBlockTop(startTime: string, startHour = TIMELINE_START, hourHeight = HOUR_HEIGHT): number {
  return ((timeToMinutes(startTime) - startHour * 60) / 60) * hourHeight;
}

export function timeBlockHeight(startTime: string, endTime: string, startHour = TIMELINE_START, hourHeight = HOUR_HEIGHT): number {
  const dur = Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), SLOT_MINUTES);
  return Math.max((dur / 60) * hourHeight, SLOT_HEIGHT);
}
