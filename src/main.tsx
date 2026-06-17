import React, { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import type { CalendarEvent, Category, ExecutionLane, Language, PlannerApi, PlannerData, Priority, Project, RecurrenceFrequency, Settings, Task, TaskRecurrence, TimelineRecord } from "./types";
import type { AiAction, AiStep } from "./aiAssistantApi";
import type { ParsedAttachment } from "./fileParser";
import { autoScheduleTasks } from "./autoSchedule";
import { installBrowserFallback } from "./browserFallback";
import {
  getVisibleDays,
  getTimelineMetrics,
  pointerToDateTime,
  eventToRect,
  timeBlockTop,
  timeBlockHeight,
  todayIso as geometryTodayIso,
  addDays as geometryAddDays,
  startOfWeekIso as geometryStartOfWeekIso,
  minutesToTime as geometryMinutesToTime,
  timeToMinutes as geometryTimeToMinutes,
  addMinutes as geometryAddMinutes,
  SLOT_MINUTES as GEOMETRY_SLOT_MINUTES,
  SLOT_HEIGHT as GEOMETRY_SLOT_HEIGHT,
  TIMELINE_START as GEOMETRY_TIMELINE_START,
  TIMELINE_END as GEOMETRY_TIMELINE_END,
  HOUR_HEIGHT,
} from "./timelineGeometry";
import { t, detectSystemLanguage, catLabels, priLabels, viewLabel, releaseNote, formatDateTitle, monthTitle, weekdayName } from "./i18n";
import "./styles.css";
import "./app-redesign.css";
import "./landing.css";
import "./navopath-buttons.css";

installBrowserFallback();

const todayIso = () => localIso(new Date());
const TIMELINE_START = 0;
const TIMELINE_END = 24;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 20;
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);
const ATTACHMENT_ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";
const DEFAULT_PROJECT_COLOR = "#8B6F47";
const PROJECT_COLOR_PRESETS = [DEFAULT_PROJECT_COLOR, "#8B5CF6", "#A78BFA", "#C69CF9", "#EC4899", "#38BDF8", "#22C55E", "#F59E0B", "#EF4444"];
const COMMON_COLOR_PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#1F2937", "#F9FAFB", "#6B7280"];
const RECURRENCE_OCCURRENCE_MARKER = "__occ__";
const EXECUTE_THEME_PRESETS_LIGHT = ["#27231E", "#C69CF9", "#7C3AED", "#BE185D", "#D97706", "#059669", "#2563EB"];
const EXECUTE_THEME_PRESETS_DARK  = ["#EEE9DF", "#C69CF9", "#A78BFA", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];
const PLANNING_THEME_PRESETS_LIGHT = ["#27231E", "#CAFF72", "#7C3AED", "#BE185D", "#D97706", "#059669", "#2563EB"];
const PLANNING_THEME_PRESETS_DARK  = ["#EEE9DF", "#CAFF72", "#A78BFA", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];
const RELEASE_NOTES = [
  { date: "2026-06-10", summary: "优化了规划栏的交互和结果展示" },
  { date: "2026-06-09", summary: "优化了时间轴的快速添加栏" },
  { date: "2026-06-08", summary: "优化了部分深色模式UI不适配的问题" },
  { date: "2026-06-08", summary: "优化了 3天 / 周 / 月视图和'全天'栏的体验，并支持任务堆叠" },
  { date: "2026-06-07", summary: "在一定程度上优化了深色模式的体验" },
  { date: "2026-06-06", summary: "优化了网站主页面，并且加入了深色模式(beta)" },
  { date: "2026-06-05", summary: "加入 3天 / 周 / 月视图。UI支持自定义颜色" },
  { date: "2026-06-04", summary: "规划树支持候选挑选模式，任务可从长期项目流入今日执行。" },
  { date: "2026-06-03", summary: "网页版上线" },
] as const;
const TIME_OPTIONS = Array.from({ length: ((TIMELINE_END - TIMELINE_START) * 60) / SLOT_MINUTES }, (_, index) => {
  return minutesToTime(TIMELINE_START * 60 + index * SLOT_MINUTES);
});
const categories: Record<Category, { label: string; color: string }> = {
  exam: { label: "考试", color: "#7C3AED" },
  uk: { label: "英国申请", color: "#8B5CF6" },
  us: { label: "美国申请", color: "#A78BFA" },
  essay: { label: "文书", color: "#EC4899" },
  materials: { label: "材料", color: "#22C55E" },
  project: { label: "项目", color: "#38BDF8" },
  personal: { label: "个人", color: "#64748B" }
};
const categoryOrder: Category[] = ["exam", "project", "essay", "materials", "uk", "us", "personal"];

type Mode = "execute" | "planning";
type AddType = "task" | "project" | "event";
type TimelineView = "daily" | "3day" | "weekly" | "month";
type AiPlanPrefs = { source: "today" | "all"; scope: "day" | "3day"; strategy: "random" | "byProject" | "alternativeProject" | "longShort" };

/**
 * SchedulePreview — single source of truth for a preview block.
 * One preview = one real task (no splitting). On accept, a new cloned task
 * with `clonedTaskId` is appended to `data.tasks`. The source task stays in
 * 今日候选 until then.
 */
type SchedulePreview = {
  id: string;
  sourceTaskId: string;
  clonedTaskId: string;
  title: string;
  projectId?: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  priority: Priority;
  reason: string;
};

/** Auto-schedule state machine. */
type AutoScheduleState = "idle" | "generating" | "preview" | "committing" | "error";
type TimelineFocusSource = "schedule" | "autoschedule" | "recurrence" | "placement";
type TimelineFocusTarget = { date: string; startTime?: string; taskId?: string; source: TimelineFocusSource };
type PlacementPreview = {
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  source: "candidate-calendar";
} | null;
type EditingOccurrence = {
  taskId: string;
  scheduledDate: string;
  scheduledStart: string;
} | null;

type DragState = {
  taskId: string;
  kind: "candidate" | "block";
  duration: number;
  offsetMinutes?: number;
  pointer?: { x: number; y: number };
  outsideTimeline?: boolean;
} | null;

function isEventDisplayTask(taskOrId: Task | string) {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  return id.startsWith("event_occ_");
}

function normalizeHexColor(value: string, fallback: string) {
  const input = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input;
  if (/^#[0-9a-f]{3}$/i.test(input)) return `#${input.slice(1).split("").map((ch) => ch + ch).join("")}`;
  return fallback;
}

function hexToRgb(value: string) {
  const hex = normalizeHexColor(value, "#8B5CF6").slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function mixHex(a: string, b: string, amount: number) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x * (1 - amount) + y * amount).toString(16).padStart(2, "0");
  return `#${mix(c1.r, c2.r)}${mix(c1.g, c2.g)}${mix(c1.b, c2.b)}`;
}

function isLightColor(value: string) {
  const { r, g, b } = hexToRgb(value);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 174;
}

function themeVars(settings: Settings, mode: Mode) {
  const themeDefaultAccent = settings.theme === "dark" ? "#EEE9DF" : "#27231E";
  const execute = normalizeHexColor(settings.executeAccentColor || themeDefaultAccent, themeDefaultAccent);
  const planning = normalizeHexColor(settings.planningAccentColor || themeDefaultAccent, themeDefaultAccent);
  const executeLight = isLightColor(execute);
  const planningLight = isLightColor(planning);
  const activeAccent = mode === "execute" ? execute : planning;
  const activeLight = mode === "execute" ? executeLight : planningLight;
  const { r, g, b } = hexToRgb(activeAccent);
  const isDark = settings.theme === "dark";
  if (isDark) {
    return {
      "--execute-primary": execute,
      "--execute-on-primary": executeLight ? "#111827" : "#FFFFFF",
      "--planning-primary": planning,
      "--planning-on-primary": planningLight ? "#111827" : "#FFFFFF",
      "--accent-active": activeAccent,
      "--accent-rgb": `${r}, ${g}, ${b}`,
      "--accent-on": activeLight ? "#111827" : "#FFFFFF",
      "--bg-app": "#0F1117",
      "--bg-app-soft": "#14161C",
      "--surface-main": "#181B22",
      "--surface-raised": "#1E2129",
      "--surface-card": "#1C1F28",
      "--text-main": "#F0F2F5",
      "--text-muted": "#A0A7B5",
      "--text-faint": "#737A88",
      "--border-soft": "rgba(255,255,255,0.10)",
      "--border-subtle": "rgba(255,255,255,0.06)",
      "--shadow-soft": "0 12px 28px rgba(0,0,0,0.24)",
      "--shadow-hl": "none",
      "--header-bg": "rgba(15,17,23,0.92)",
      "--header-border": "rgba(255,255,255,0.06)",
      "--header-fg": "#F0F2F5",
      "--header-fg-muted": "#A0A7B5",
      "--input-bg": "#181B22",
      "--input-border": "rgba(255,255,255,0.12)",
    } as CSSProperties;
  }
  return {
    "--execute-primary": execute,
    "--execute-on-primary": executeLight ? "#111827" : "#FFFFFF",
    "--planning-primary": planning,
    "--planning-on-primary": planningLight ? "#111827" : "#FFFFFF",
    "--accent-active": activeAccent,
    "--accent-rgb": `${r}, ${g}, ${b}`,
    "--accent-on": activeLight ? "#111827" : "#FFFFFF",
    "--bg-app": "#F3F4F7",
    "--bg-app-soft": "#EEF0F4",
    "--surface-main": "#F7F8FA",
    "--surface-raised": "#FFFFFF",
    "--surface-card": "#FFFFFF",
    "--text-main": "#181C25",
    "--text-muted": "#6B7280",
    "--text-faint": "#9CA3AF",
    "--border-soft": "#E2E5EC",
    "--border-subtle": "#EAEDF2",
    "--shadow-soft": "0 12px 28px rgba(17,24,39,0.08)",
    "--shadow-hl": "none",
    "--header-bg": "rgba(243,244,247,0.88)",
    "--header-border": "rgba(226,229,236,0.72)",
    "--header-fg": "#181C25",
    "--header-fg-muted": "#6B7280",
    "--input-bg": "#FFFFFF",
    "--input-border": "#E2E5EC",
  } as CSSProperties;
}
type ResizePreview = { taskId: string; start: string; end: string } | null;
type ScheduleSuggestion = SchedulePreview; // legacy alias kept for compatibility; replaced by SchedulePreview
type QuickSchedule = { startTime: string; title: string; projectId: string; isAllDay?: boolean } | null;
/** Floating popup for time‑slot quick‑add on timeline (used by day / 3‑day / week views) */
type FloatingTimeAdd = { date: string; startTime: string; endTime: string; top: number; left: number; width: number } | null;
/** Floating popup for all‑day bar quick‑add */
type AllDayQuickAdd = { date: string; left: number; top: number; width: number; dayIndex: number } | null;
/** Drag‑create state for timeline area (day / 3‑day / week views) */
type DragCreateState = {
  date: string;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
  left: number;
  width: number;
  committed: boolean;
} | null;
type PlanPickPriority = "must" | "should" | "could";
type AuthState = { mode: "local" | "cloud"; user: { id: string; email?: string } | null; configured: boolean };
type AuthNotice = { type: "confirm-email"; email: string } | null;
type AiAttachmentSnapshot = {
  name: string;
  size: number;
  pageCount?: number;
  truncated?: boolean;
  status: "ready" | "error";
  statusText: string;
  summary: string;
};
type AiSessionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "thinking" | "done" | "error";
  attachment?: AiAttachmentSnapshot;
  steps?: AiStep[];
  actions?: AiAction[];
  selectedActions?: Record<number, boolean>;
  actionState?: "pending" | "adopted" | "rejected" | "undone";
  importCommit?: {
    focus?: TimelineFocusTarget;
    addedCount: number;
    addedTaskIds: string[];
    addedEventIds: string[];
    previousTasks: Task[];
  };
};
type FormState = {
  title: string;
  projectId: string;
  projectColor: string;
  dueDate: string;
  dueTime: string;
  endDate: string;
  endTime: string;
  category: Category;
  priority: Priority;
  importance: Priority;
  urgency: Priority;
  estimatedHours: number;
  details: string;
  recurrence?: TaskRecurrence;
};

const PlanningViewLazy = lazy(() => import("./PlanningView"));
const LandingPageLazy = lazy(() => import("./LandingPage"));
const LOCAL_BOOTSTRAP_PREFIX = "navopath-bootstrap";

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function addMonths(iso: string, months: number) {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
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

function enumerateRecurrenceDates(recurrence: TaskRecurrence, visibleDates: Set<string>) {
  if (!recurrence.startDate || visibleDates.size === 0) return [];
  const sortedVisibleDates = [...visibleDates].sort();
  const minDate = sortedVisibleDates[0];
  const maxDate = sortedVisibleDates[sortedVisibleDates.length - 1];
  const results: string[] = [];
  let cursor = recurrence.startDate;
  let occurrenceCount = 0;
  const isVisibleMatch = (date: string) => date >= minDate && date <= maxDate && visibleDates.has(date);
  const advanceCursor = (date: string) => {
    switch (recurrence.frequency) {
      case "weekly":
        return addDays(date, 7);
      case "biweekly":
        return addDays(date, 14);
      case "monthly":
        return addMonths(date, 1);
      case "quarterly":
        return addMonths(date, 3);
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
      if (!recurrence.count || occurrenceCount <= recurrence.count) {
        if (isVisibleMatch(cursor)) results.push(cursor);
      }
      if (recurrence.count && occurrenceCount >= recurrence.count) break;
    }
    cursor = advanceCursor(cursor);
  }

  return results;
}

function startOfWeekIso(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return localIso(date);
}

function startOfMonthGridIso(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(1);
  date.setDate(date.getDate() - date.getDay());
  return localIso(date);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function getExecutionLane(task: Task): ExecutionLane | undefined {
  if (task.executionLane) return task.executionLane;
  const hasScheduledRecord = (task.timelineRecords || []).some((record) => record.executionStatus === "scheduled");
  if (!task.plannedForDate || hasScheduledRecord || Boolean(task.scheduledDate) || Boolean(task.scheduledStart) || isRecurringScheduledTask(task)) return undefined;
  return "candidate";
}

function hasRecurringRule(task: Task) {
  return Boolean(task.recurrence && task.recurrence.frequency !== "none");
}

function validCategory(value: unknown): Category {
  return ["exam", "uk", "us", "essay", "materials", "project", "personal"].includes(String(value))
    ? value as Category
    : "personal";
}

function validPriority(value: unknown): Priority {
  return ["high", "medium", "low"].includes(String(value)) ? value as Priority : "medium";
}

function validIsoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function validTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeAiRecurrence(value: unknown, date: string, startTime?: string, durationMinutes?: number): TaskRecurrence | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const frequencies: RecurrenceFrequency[] = ["daily", "weekdays", "weekends", "weekly", "biweekly", "monthly", "quarterly"];
  if (!frequencies.includes(raw.frequency as RecurrenceFrequency)) return undefined;
  const normalizedStart = validIsoDate(raw.startDate) ? String(raw.startDate) : date;
  const normalizedTime = validTime(raw.startTime) ? String(raw.startTime) : validTime(startTime) ? startTime : "";
  return {
    mode: normalizedTime ? "scheduled" : "flexible",
    frequency: raw.frequency as RecurrenceFrequency,
    startDate: normalizedStart,
    startTime: normalizedTime || undefined,
    durationMinutes: normalizedTime ? Math.max(Number(raw.durationMinutes) || durationMinutes || 60, 15) : undefined,
    endDate: validIsoDate(raw.endDate) ? String(raw.endDate) : undefined,
    count: Number.isFinite(Number(raw.count)) && Number(raw.count) > 0 ? Number(raw.count) : undefined,
  };
}

function isValidAiAction(action: AiAction) {
  if (action.type !== "import_schedule_item") return true;
  const raw = action as Record<string, unknown>;
  return (raw.kind === "task" || raw.kind === "event") &&
    typeof raw.title === "string" && raw.title.trim().length > 0 &&
    validIsoDate(raw.date) &&
    (!raw.startTime || validTime(raw.startTime)) &&
    (!raw.endTime || validTime(raw.endTime));
}

function isRecurringScheduledTask(task: Task) {
  return Boolean(
    task.recurrence &&
    task.recurrence.frequency !== "none" &&
    task.recurrence.mode === "scheduled" &&
    task.recurrence.startDate &&
    task.recurrence.startTime &&
    task.recurrence.durationMinutes
  );
}

function buildRecurrenceOccurrenceId(taskId: string, date: string, startTime: string) {
  return `${taskId}${RECURRENCE_OCCURRENCE_MARKER}${date}${RECURRENCE_OCCURRENCE_MARKER}${startTime}`;
}

function parseRecurrenceOccurrenceId(taskId: string) {
  const parts = taskId.split(RECURRENCE_OCCURRENCE_MARKER);
  if (parts.length !== 3) return null;
  return {
    taskId: parts[0],
    scheduledDate: parts[1],
    scheduledStart: parts[2],
  };
}

function minutesToTime(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hourLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  if (h === 24) return "";
  return `${h}:00`;
}

function timeToMinutes(time = "09:00") {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function clampSlot(minutes: number) {
  const min = TIMELINE_START * 60;
  const max = TIMELINE_END * 60 - SLOT_MINUTES;
  const clamped = Math.min(Math.max(minutes, min), max);
  return Math.round(clamped / SLOT_MINUTES) * SLOT_MINUTES;
}

function addMinutes(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function shortDate(date: string) {
  if (!date) return "未定";
  const [, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function dateDiff(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
}

function taskDuration(task: Task) {
  if (task.scheduledStart && task.scheduledEnd) {
    return Math.max(timeToMinutes(task.scheduledEnd) - timeToMinutes(task.scheduledStart), SLOT_MINUTES);
  }
  return Math.max(Math.round((task.estimatedHours || 0.5) * 60), SLOT_MINUTES);
}

function hasRecurrenceOccurrenceOnDate(task: Task, date: string) {
  if (!isRecurringScheduledTask(task) || !task.recurrence) return false;
  return enumerateRecurrenceDates(task.recurrence, new Set([date])).includes(date);
}

function matchesOccurrence(record: TimelineRecord, scheduledDate: string, scheduledStart?: string) {
  if (record.scheduledDate !== scheduledDate) return false;
  if (!scheduledStart) return true;
  return record.scheduledStart === scheduledStart;
}

function isAllDayTask(task: Task): boolean {
  return !!task.scheduledDate && !task.scheduledStart && !task.scheduledEnd;
}

function extractNextAction(notes = "") {
  const match = notes.match(/下一步[:：]\s*(.+?)(?:\n|$)/);
  return match?.[1]?.trim() || "";
}

function replaceNextAction(notes: string, nextAction: string) {
  const line = `下一步：${nextAction.trim()}`;
  if (/下一步[:：]/.test(notes)) return notes.replace(/下一步[:：].*(?:\n|$)/, `${line}\n`).trim();
  return [line, notes].filter(Boolean).join("\n");
}

/**
 * Computes conflict layout for a set of tasks on the same day.
 * Returns a Map<taskId, { index: number; count: number }> where:
 * - `index` is the column offset (0-based) within the conflict group
 * - `count` is the total number of columns needed (max overlap depth)
 * Non-conflicting tasks are not included in the map (they use default layout).
 */
/**
 * Compute conflict layout for a set of tasks scheduled on the SAME day.
 *
 * Algorithm (interval graph column layout):
 * 1. Sort by startMinutes (longer duration first if tie)
 * 2. Partition into conflict groups (handles chain conflicts: A overlaps B, B overlaps C)
 * 3. For each group with 2+ intervals, use greedy column packing:
 *    - For each interval, find the first column whose last interval ended ≤ current start
 *    - If none, create a new column
 * 4. Returns a Map<taskId, { index: number; count: number }>
 *    - index: column offset (0-based)
 *    - count: total columns in the group (= max overlap depth)
 *    - Non-conflicting tasks are NOT included (use default full-width layout)
 */
/** Preserve the existing daily-view column limit; multi-day views never stack. */
const MAX_DAILY_COLLISION_COLUMNS = 4;

function computeConflictLayout(tasks: Task[], maxColumns = Infinity): Map<string, { index: number; count: number }> {
  if (tasks.length <= 1) return new Map();

  // Build intervals
  const intervals = tasks
    .filter((t): t is Task & { scheduledStart: string; scheduledEnd: string } =>
      !!t.scheduledStart && !!t.scheduledEnd)
    .map((t, i) => ({
      taskId: t.id,
      startMinutes: timeToMinutes(t.scheduledStart),
      endMinutes: timeToMinutes(t.scheduledEnd),
      originalIndex: i,
    }))
    .sort((a, b) =>
      a.startMinutes - b.startMinutes ||
      (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
    );

  if (intervals.length <= 1) return new Map();

  // Step 1: Partition into conflict groups (handles chain conflicts)
  const groups: Array<{ intervals: typeof intervals; columnCount: number }> = [];
  let currentBatch: typeof intervals = [];
  let groupEnd = -Infinity;

  for (const iv of intervals) {
    if (iv.startMinutes < groupEnd) {
      // Overlaps current group → add to it
      currentBatch.push(iv);
      groupEnd = Math.max(groupEnd, iv.endMinutes);
    } else {
      // No overlap → close current group, start new one
      if (currentBatch.length > 0) groups.push({ intervals: currentBatch, columnCount: 0 });
      currentBatch = [iv];
      groupEnd = iv.endMinutes;
    }
  }
  if (currentBatch.length > 0) groups.push({ intervals: currentBatch, columnCount: 0 });

  // Only groups with 2+ tasks need conflict layout
  const multiGroups = groups.filter((g) => g.intervals.length > 1);
  if (multiGroups.length === 0) return new Map();

  // Step 2: Greedy column packing per group
  const result = new Map<string, { index: number; count: number }>();

  for (const group of multiGroups) {
    // Track active columns by their end time
    const columns: Array<{ end: number }> = [];
    // Temporary storage for assignment decisions
    const assignments: Array<{ taskId: string; col: number }> = [];

    for (const iv of group.intervals) {
      // Find first column whose last interval ended ≤ current start
      let assignedCol = -1;
      for (let ci = 0; ci < columns.length; ci++) {
        if (columns[ci].end <= iv.startMinutes) {
          assignedCol = ci;
          columns[ci].end = iv.endMinutes;
          break;
        }
      }
      // If no column available, create a new one
      if (assignedCol === -1) {
        assignedCol = columns.length;
        columns.push({ end: iv.endMinutes });
      }

      assignments.push({ taskId: iv.taskId, col: assignedCol });
    }

    // Now store results with the FINAL column count (clamped by maxColumns)
    const finalCount = Math.min(columns.length, maxColumns);
    for (const a of assignments) {
      result.set(a.taskId, { index: Math.min(a.col, finalCount - 1), count: finalCount });
    }
  }

  return result;
}

/**
 * Compute CSS left/width for a conflict‑laid‑out time block.
 * Always uses strict side-by-side columns so overlapping tasks never cover
 * each other, including in narrow multi-day and fullscreen layouts.
 */
function computeConflictStyle(
  taskId: string,
  layout: Map<string, { index: number; count: number }>,
  innerWidth: number,
  baseLeft: number,
  gap: number,
  viewMode = "daily",
): { left: number; width: number; isNarrow: boolean } | null {
  const cl = layout.get(taskId);
  if (!cl || cl.count <= 1) return null;

  const effectiveGap = Math.min(gap, innerWidth / Math.max(cl.count * 2, 1));
  const slotW = Math.max(0, (innerWidth - effectiveGap * (cl.count - 1)) / cl.count);
  return {
    left: baseLeft + cl.index * (slotW + effectiveGap),
    width: slotW,
    isNarrow: viewMode !== "daily" && slotW < 80,
  };
}

function getDropTargetFromPointer({
  clientX, clientY,
  gridElement,
  scrollElement,
  visibleDays,
  hourHeight = HOUR_HEIGHT,
  startHour = TIMELINE_START,
  snapMinutes = SLOT_MINUTES,
  debugLabel,
}: {
  clientX: number;
  clientY: number;
  gridElement: HTMLElement;
  scrollElement: HTMLElement;
  visibleDays: string[];
  hourHeight?: number;
  startHour?: number;
  snapMinutes?: number;
  debugLabel?: string;
}): { date: string; startTime: string; endTime: string; dayIndex: number; minutes: number } {
  return pointerToDateTime({
    clientX, clientY, gridElement, scrollElement, visibleDays,
    hourHeight, startHour, snapMinutes, debugLabel,
  });
}

function waitForPlannerApi() {
  return new Promise<PlannerApi>((resolve) => {
    if (window.plannerApi) {
      resolve(window.plannerApi);
      return;
    }
    const timer = window.setInterval(() => {
      if (window.plannerApi) {
        window.clearInterval(timer);
        resolve(window.plannerApi);
      }
    }, 20);
  });
}

function bootstrapCacheKey(userId?: string) {
  return `${LOCAL_BOOTSTRAP_PREFIX}:${userId || "local"}`;
}

function readBootstrapCache(userId?: string) {
  try {
    const raw = localStorage.getItem(bootstrapCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as { data: PlannerData; settings: Settings };
  } catch {
    return null;
  }
}

function writeBootstrapCache(data: PlannerData, settings: Settings, userId?: string) {
  try {
    localStorage.setItem(bootstrapCacheKey(userId), JSON.stringify({ data, settings, savedAt: new Date().toISOString() }));
  } catch {
    // Ignore cache write failures in private mode or quota pressure.
  }
}

function defaultForm(type: AddType = "task"): FormState {
  const today = todayIso();
  return {
    title: "",
    projectId: "",
    projectColor: "#C69CF9",
    dueDate: today,
    dueTime: "",
    endDate: today,
    endTime: "",
    category: type === "project" ? "project" : "personal",
    priority: "medium",
    importance: "high",
    urgency: "low",
    estimatedHours: 0.5,
    details: "",
    recurrence: undefined,
  };
}

function makeTask(form: FormState): Task {
  const now = new Date().toISOString();
  return {
    id: uid("task"),
    title: form.title.trim(),
    dueDate: form.dueDate || todayIso(),
    category: form.category,
    priority: form.priority,
    notes: form.details,
    goalId: "goal_admission",
    completed: false,
    projectId: form.projectId || undefined,
    importance: form.importance,
    urgency: form.urgency,
    estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
    plannedForDate: form.dueDate === todayIso() ? todayIso() : undefined,
    executionLane: form.dueDate === todayIso() ? "candidate" : undefined,
    order: Date.now(),
    subtasks: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeProject(form: FormState): Project {
  const now = new Date().toISOString();
  return {
    id: uid("project"),
    title: form.title.trim(),
    category: form.category,
    notes: form.details,
    completed: false,
    color: form.projectColor || categories[form.category].color,
    importance: form.importance,
    urgency: form.urgency,
    createdAt: now,
    updatedAt: now
  };
}

function makeEvent(form: FormState): CalendarEvent {
  return {
    id: uid("event"),
    title: form.title.trim(),
    date: form.dueDate || todayIso(),
    startDate: form.dueDate || todayIso(),
    endDate: form.endDate || form.dueDate || todayIso(),
    startTime: form.dueTime,
    endTime: form.endTime,
    category: form.category,
    details: form.details,
    recurrence: form.recurrence,
    createdAt: new Date().toISOString()
  };
}

function buildEventFromTask(task: Task, activeRecord?: TimelineRecord): CalendarEvent {
  const scheduledDate = activeRecord?.scheduledDate || task.scheduledDate || task.plannedForDate || task.dueDate || todayIso();
  const scheduledStart = activeRecord?.scheduledStart || task.scheduledStart || task.recurrence?.startTime || "";
  const scheduledEnd = activeRecord?.scheduledEnd || task.scheduledEnd || (scheduledStart ? addMinutes(scheduledStart, taskDuration(task)) : "");
  return {
    id: uid("event"),
    title: task.title,
    date: scheduledDate,
    startDate: scheduledDate,
    endDate: scheduledDate,
    startTime: scheduledStart || undefined,
    endTime: scheduledEnd || undefined,
    category: task.category,
    details: task.notes || "",
    recurrence: task.recurrence,
    createdAt: new Date().toISOString()
  };
}

function buildTaskFromEvent(event: CalendarEvent): Task {
  const now = new Date().toISOString();
  const date = event.startDate || event.date || todayIso();
  const start = event.startTime || undefined;
  const end = start ? (event.endTime || addMinutes(start, event.recurrence?.durationMinutes || 60)) : undefined;
  const durationMinutes = start && end ? Math.max(timeToMinutes(end) - timeToMinutes(start), SLOT_MINUTES) : 30;
  return {
    id: uid("task"),
    title: event.title,
    dueDate: date,
    category: event.category,
    priority: "medium",
    notes: event.details || "",
    goalId: "goal_admission",
    completed: false,
    estimatedHours: durationMinutes / 60,
    plannedForDate: start ? undefined : date,
    executionLane: start ? undefined : "candidate",
    scheduledDate: date,
    scheduledStart: start,
    scheduledEnd: end,
    recurrence: event.recurrence,
    order: Date.now(),
    subtasks: [],
    createdAt: now,
    updatedAt: now
  };
}

export function ProductIcon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dayflow-icon ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src="/navopath-icon.png" alt="" />
    </div>
  );
}

function AuthGate(props: {
  busy: boolean;
  error: string;
  notice: AuthNotice;
  onSubmit: (email: string, password: string, displayName: string, intent: "signin" | "signup") => Promise<void>;
  onResend: (email: string) => Promise<void>;
  onContinueAfterConfirm: (email: string) => Promise<void>;
}) {
  const [intent, setIntent] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const mismatch = intent === "signup" && password && confirmPassword && password !== confirmPassword;
  return (
    <main className="df-auth-shell">
      <section className="df-auth-card">
        <div className="df-auth-brand">
          <ProductIcon />
          <div>
            <strong>NavoPath</strong>
            <span>从长期规划里选出今天要推进的事。</span>
          </div>
        </div>
        <div className="df-auth-tabs">
          <button className={intent === "signin" ? "active" : ""} onClick={() => setIntent("signin")}>登录</button>
          <button className={intent === "signup" ? "active" : ""} onClick={() => setIntent("signup")}>注册</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (mismatch) return;
          void props.onSubmit(email.trim(), password, displayName.trim(), intent);
        }}>
          {intent === "signup" && <label>用户名<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" maxLength={64} /></label>}
          <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>密码<input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={intent === "signin" ? "current-password" : "new-password"} minLength={6} required /></label>
          {intent === "signup" && <label>确认密码<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>}
          <label className="df-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />显示密码</label>
          {mismatch && <p className="df-auth-error">两次输入的密码不一致。</p>}
          {props.error && <p className="df-auth-error">{props.error}</p>}
          {props.notice?.type === "confirm-email" && <div className="df-auth-notice"><strong>请先确认邮箱</strong><span>确认邮件已发送到 {props.notice.email}。完成确认后再登录。</span><div className="df-auth-notice-actions"><button type="button" onClick={() => void props.onResend(props.notice!.email)}>重发邮件</button><button type="button" onClick={() => void props.onContinueAfterConfirm(props.notice!.email)}>我已确认，去登录</button></div></div>}
          <button className="df-auth-submit" type="submit" disabled={props.busy || !email.trim() || password.length < 6 || Boolean(mismatch)}>
            {props.busy ? "处理中..." : intent === "signin" ? "进入 NavoPath" : "创建账号"}
          </button>
        </form>
        <p className="df-auth-note">每个账号的数据独立保存。已注册过请直接登录；连续注册会触发邮件安全限流。公开网页版不会保存个人 AI API Key。</p>
      </section>
    </main>
  );
}

function ResetPasswordForm({ lang, busy, error, onReset }: { lang: Language; busy: boolean; error: string; onReset: (newPassword: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const isValid = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const mismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  let pwHint = "";
  if (password.length > 0) {
    if (password.length < 8) pwHint = `✕ ${t(lang, "auth.passwordStrength")}`;
    else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) pwHint = `✕ ${t(lang, "auth.passwordStrength")}`;
    else pwHint = "✓ OK";
  }

  return (
    <div className="landing" lang={lang}>
      <div className="landing-auth-overlay" style={{ position: "fixed", display: "flex" }}>
        <section className="landing-auth-card" style={{ maxWidth: 400 }}>
          <ProductIcon /><span className="landing-auth-label">NavoPath</span>
          <h2>{t(lang, "auth.setNewPassword")}</h2>
          <p style={{ fontSize: 13, color: "var(--l-muted)", marginBottom: 12 }}>{t(lang, "auth.setNewPasswordDesc")}</p>
          <form onSubmit={async (event) => { event.preventDefault(); if (isValid && !mismatch) await onReset(password); }}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t(lang, "auth.newPassword")} minLength={8} required autoFocus />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t(lang, "auth.confirmPassword")} minLength={8} required />
            {password.length > 0 && <p style={{ fontSize: 11, margin: "-4px 0 4px", color: isValid ? "#22c55e" : "var(--l-muted)" }}>{pwHint}</p>}
            {mismatch && <p className="landing-auth-error">{t(lang, "auth.passwordMismatch")}</p>}
            {error && <p className="landing-auth-error">{error}</p>}
            <button className="landing-button primary full" disabled={busy || !isValid || mismatch}>
              {busy ? t(lang, "auth.processing") : t(lang, "auth.setNewPassword")}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

type OnboardingStep = NonNullable<Settings["onboardingStep"]>;

function OnboardingGuide(props: {
  lang: Language;
  step: OnboardingStep;
  mode: Mode;
  onOpenPlanning: () => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const zh = props.lang === "zh";
  const content = props.step === "add"
    ? {
        index: "01",
        title: zh ? "先添加一个今日任务" : "Add a task for today",
        body: zh ? "在左下角输入任务名称并按 Add，它会进入今日候选。" : "Name a task in the lower-left field and press Add. It will enter Today's Candidates.",
      }
    : props.step === "drag"
      ? {
          index: "02",
          title: zh ? "把任务拖到时间轴" : "Drag it onto the timeline",
          body: zh ? "从今日候选拖动刚添加的任务，在右侧时间轴选择开始时间。" : "Drag the task from Today's Candidates and choose its start time on the timeline.",
        }
      : {
          index: "03",
          title: zh ? "在 Planning 规划长期任务" : "Plan long-term work in Planning",
          body: zh ? "Planning 用于按项目拆解长期任务，再挑选需要推进的内容加入今日执行。" : "Use Planning to break long-term work into projects, then choose what moves into today's execution.",
        };

  return (
    <aside className={`df-onboarding-guide step-${props.step}`} aria-live="polite">
      <span className="df-onboarding-index">{content.index} / 03</span>
      <strong>{content.title}</strong>
      <p>{content.body}</p>
      <div>
        {props.step === "planning" && props.mode !== "planning" && (
          <button type="button" onClick={props.onOpenPlanning}>{zh ? "打开 Planning" : "Open Planning"}</button>
        )}
        {props.step === "planning" && props.mode === "planning" && (
          <button type="button" onClick={props.onFinish}>{zh ? "完成引导" : "Finish guide"}</button>
        )}
        <button type="button" className="quiet" onClick={props.onSkip}>{zh ? "跳过" : "Skip"}</button>
      </div>
    </aside>
  );
}

function App() {
  const [data, setData] = useState<PlannerData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lang, setLang] = useState<Language>(detectSystemLanguage());
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState<AuthNotice>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [mode, setModeState] = useState<Mode>("execute");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [drag, setDrag] = useState<DragState>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview>(null);
  const [hoverSlot, setHoverSlot] = useState<string>("");
  const [hoveredBlock, setHoveredBlock] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addType, setAddType] = useState<AddType>("task");
  const [editingId, setEditingId] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [referencedTaskId, setReferencedTaskId] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiSessionMessage[]>([]);
  const [aiAttachment, setAiAttachment] = useState<ParsedAttachment | null>(null);
  const [aiAttachmentStatus, setAiAttachmentStatus] = useState("");
  // ── Auto-schedule: single source of truth ──
  const [schedulePreviews, setSchedulePreviews] = useState<SchedulePreview[]>([]);
  const [autoScheduleState, setAutoScheduleState] = useState<AutoScheduleState>("idle");
  const [aiPlanMenuOpen, setAiPlanMenuOpen] = useState(false);
  const [aiPlanPrefs, setAiPlanPrefs] = useState<AiPlanPrefs>({ source: "today", scope: "day", strategy: "longShort" });
  const [timelineView, setTimelineView] = useState<TimelineView>("daily");
  const [pendingTimelineFocus, setPendingTimelineFocus] = useState<TimelineFocusTarget | null>(null);
  const [placementPreview, setPlacementPreview] = useState<PlacementPreview>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<EditingOccurrence>(null);
  const [quickSchedule, setQuickSchedule] = useState<QuickSchedule>(null);
  const [allDayQuickAdd, setAllDayQuickAdd] = useState<AllDayQuickAdd>(null);
  const [monthQuickAdd, setMonthQuickAdd] = useState<AllDayQuickAdd>(null);
  const [allDayDragOver, setAllDayDragOver] = useState(false);
  const [floatingTimeAdd, setFloatingTimeAdd] = useState<FloatingTimeAdd>(null);
  const [dragCreate, setDragCreate] = useState<DragCreateState>(null);
  const dragCreateSuppressClickRef = useRef(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceFilterProjectId, setSourceFilterProjectId] = useState<string | null>(null);
  const [sourceAnchorRect, setSourceAnchorRect] = useState<DOMRect | null>(null);
  const [utilityPanel, setUtilityPanel] = useState<"settings" | "about" | null>(null);
  const [planningPickMode, setPlanningPickMode] = useState(false);
  const [planningPicks, setPlanningPicks] = useState<Record<string, PlanPickPriority>>({});
  const [toast, setToast] = useState("");
  // Enhanced toast with optional undo action (5-second window)
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const undoSnapshotRef = useRef<{ committedTaskIds: string[]; clearedSourceTaskIds: string[]; removedFromCandidate: Set<string> } | null>(null);
  const [showCompletedCandidates, setShowCompletedCandidates] = useState(false);
  const [groupByProject, setGroupByProject] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectTitle, setQuickProjectTitle] = useState("");
  const [quickProjectColor, setQuickProjectColor] = useState(PROJECT_COLOR_PRESETS[0]);
  const [candidatePanelCollapsed, setCandidatePanelCollapsed] = useState(false);
  const [simpleView, setSimpleView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const suppressBlockClickRef = useRef(false);
  const dragTargetDateRef = useRef<string>("");
  const lastTimelineAutoScrollKeyRef = useRef("");
  const dataRef = useRef<PlannerData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const loadedWorkspaceKeyRef = useRef("");
  const pendingSaveRef = useRef<PlannerData | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const queuedSaveIdRef = useRef(0);
  const colsContainerRef = useRef<HTMLDivElement | null>(null);
  const timeGridRef = useRef<HTMLDivElement | null>(null);
  const [multiColWidth, setMultiColWidth] = useState(0);
  const [dailyCanvasWidth, setDailyCanvasWidth] = useState(0);

  // Keep column width updated for multi-day overlay positioning
  useEffect(() => {
    const el = timeGridRef.current;
    if (!el || (timelineView !== "3day" && timelineView !== "weekly")) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const visDays = getVisibleDays(timelineView, selectedDate);
        if (visDays.length > 0) {
          const cw = w / visDays.length;
          setMultiColWidth(cw);
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineView, selectedDate]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Daily view resets range-only panel controls.
  useEffect(() => {
    const supportsRangeControls = timelineView === "3day" || timelineView === "weekly" || timelineView === "month";
    if (!supportsRangeControls) {
      setCandidatePanelCollapsed(false);
      setFullscreen(false);
    }
  }, [timelineView]);

  // simpleView is only controlled by the user toggle button; do not auto-set.

  useEffect(() => {
    if (mode !== "execute") {
      setSimpleView(false);
      setFullscreen(false);
    }
  }, [mode]);

  function resetWorkspaceUi() {
    pendingSaveRef.current = null;
    queuedSaveIdRef.current += 1;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    setModeState("execute");
    setSelectedDate(todayIso());
    setTimelineView("daily");
    setDrag(null);
    setResizePreview(null);
    setHoverSlot("");
    setHoveredBlock("");
    setDrawerOpen(false);
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setForm(defaultForm());
    setAdvancedOpen(false);
    setAiOpen(false);
    setAiMessages([]);
    setAiAttachment(null);
    setAiAttachmentStatus("");
    setSchedulePreviews([]);
    setAutoScheduleState("idle");
    setPlanningPickMode(false);
    setPlanningPicks({});
    setQuickTitle("");
    setQuickProjectId("");
    setQuickProjectOpen(false);
    setSourceOpen(false);
    setUtilityPanel(null);
    setCandidatePanelCollapsed(false);
    setFullscreen(false);
    setSimpleView(false);
    setShowCompletedCandidates(false);
    setGroupByProject(false);
    setToast("");
    setToastAction(null);
  }

  async function loadInitial() {
    const api = await waitForPlannerApi();
    const auth = (await api.getAuthState?.()) || { mode: "local" as const, user: null, configured: false };
    const workspaceKey = auth.mode === "cloud" ? `cloud:${auth.user?.id || "signed-out"}` : "local";
    if (loadedWorkspaceKeyRef.current && loadedWorkspaceKeyRef.current !== workspaceKey) resetWorkspaceUi();
    loadedWorkspaceKeyRef.current = workspaceKey;
    setAuthState(auth);
    if (auth.mode === "cloud" && !auth.user) {
      setData(null);
      setSettings(null);
      return;
    }
    const cached = readBootstrapCache(auth.user?.id);
    if (cached?.data && cached?.settings) {
      dataRef.current = cached.data;
      settingsRef.current = cached.settings;
      setData(cached.data);
      setSettings(cached.settings);
      if (cached.settings.language) setLang(cached.settings.language);
      setModeState((cached.settings.activeMode as Mode) || "execute");
      setAdvancedOpen(Boolean(cached.settings.addAdvancedOpen));
      if (cached.settings.defaultTimelineView) setTimelineView(cached.settings.defaultTimelineView);
    }
    const bootstrap = api.getBootstrap
      ? await api.getBootstrap()
      : {
        auth,
        data: await api.getData(),
        settings: await api.getSettings()
      };
    const nextData = bootstrap.data || cached?.data;
    const nextSettings = bootstrap.settings || cached?.settings;
    if (!nextData || !nextSettings) return;
    // Migrate legacy task scheduling fields into timelineRecords
    if (nextData.tasks) {
      nextData.tasks = nextData.tasks.map((task) => {
        if (task.timelineRecords && task.timelineRecords.length > 0) return task;
        if (!task.scheduledDate || !task.scheduledStart) return task;
        const record: TimelineRecord = {
          id: task.id + "_rec_0",
          taskId: task.id,
          scheduledDate: task.scheduledDate,
          scheduledStart: task.scheduledStart,
          scheduledEnd: task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task)),
          executionStatus: task.executionStatus || "scheduled",
          createdAt: task.updatedAt || new Date().toISOString(),
        };
        return { ...task, timelineRecords: [record], scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, executionStatus: undefined };
      });
    }
    writeBootstrapCache(nextData, nextSettings, auth.user?.id);
    dataRef.current = nextData;
    settingsRef.current = nextSettings;
    setData(nextData);
    setSettings(nextSettings);
    if (nextSettings.language) setLang(nextSettings.language);
    setModeState((nextSettings.activeMode as Mode) || "execute");
    setAdvancedOpen(Boolean(nextSettings.addAdvancedOpen));
    if (nextSettings.defaultTimelineView) setTimelineView(nextSettings.defaultTimelineView);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const hasConfirmationCallback = url.searchParams.has("auth_callback")
      || url.searchParams.has("code")
      || url.searchParams.has("token_hash")
      || /access_token|error_description|type=signup/i.test(url.hash);
    const isRecovery = /type=recovery/i.test(url.hash);
    if (isRecovery) {
      setIsRecoveryMode(true);
      // Recovery flow: Supabase client auto-processes the recovery hash and sets the session.
      // Do NOT call completeEmailConfirmation() -- that's for sign-up email verification.
      // Just load initial state; authState.user will be set from the recovery session,
      // and isRecoveryMode will trigger ResetPasswordForm.
      (async () => {
        await loadInitial();
        // Clean up the URL hash (access token, recovery params) for security / clean URL
        try {
          const api = await waitForPlannerApi();
          await api.clearAuthCallbackUrl?.();
        } catch { /* non-critical */ }
      })().catch((error) => {
        setAuthBusy(false);
        setIsRecoveryMode(false);
        setAuthError(error instanceof Error ? error.message : String(error));
      });
      return;
    }
    const initialize = async () => {
      if (hasConfirmationCallback) {
        setAuthBusy(true);
        try {
          const api = await waitForPlannerApi();
          const result = await api.completeEmailConfirmation?.();
          if (result?.confirmed) resetWorkspaceUi();
          if (result?.message) setAuthError(result.message);
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : String(error));
        } finally {
          setAuthBusy(false);
        }
      }
      await loadInitial();
    };
    void initialize().catch((error) => {
      setAuthBusy(false);
      setAuthError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  async function handleAuthSubmit(email: string, password: string, displayName: string, intent: "signin" | "signup", preferredTheme: Settings["theme"]) {
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice(null);
    try {
      const api = await waitForPlannerApi();
      let feedbackMessage = "";
      if (intent === "signup") {
        const response = await api.signUp?.(email, password);
        if (response?.requiresEmailConfirmation) {
          setAuthNotice({ type: "confirm-email", email: response.email || email });
          return;
        }
        feedbackMessage = response?.message || "";
      } else {
        await api.signIn?.(email, password);
      }
      resetWorkspaceUi();
      await loadInitial();
      const current = settingsRef.current;
      if (current) {
        const patch: Partial<Settings> = {};
        if (displayName && current.displayName !== displayName) patch.displayName = displayName;
        if (current.theme !== preferredTheme) patch.theme = preferredTheme;
        if (Object.keys(patch).length > 0) await saveSettings(patch);
      }
      if (feedbackMessage) setAuthError(feedbackMessage);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendConfirmation(email: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      const response = await api.resendConfirmation?.(email);
      if (response?.message) setAuthError(response.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function continueAfterConfirm(email: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      const confirmation = await api.completeEmailConfirmation?.();
      if (confirmation?.confirmed) {
        setAuthNotice(null);
        resetWorkspaceUi();
        await loadInitial();
        return;
      }
      setAuthNotice({ type: "confirm-email", email });
      setAuthError(confirmation?.message || "尚未检测到邮箱确认。请打开最新确认邮件中的链接，或确认后直接使用邮箱和密码登录。");
    } catch (error) {
      setAuthNotice({ type: "confirm-email", email });
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(email: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      await api.sendPasswordResetEmail?.(email);
      // Success: LandingPage transitions to forgotSent UI
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setAuthError(msg);
      throw error; // re-throw so LandingPage can stay in forgot view
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword(newPassword: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      const response = await api.resetPassword?.(newPassword);
      if (response?.success) {
        setIsRecoveryMode(false);
        showToast(response?.message || "密码已成功更改，请用新密码登录。");
        await handleSignOut();
      } else {
        setAuthError(response?.message || "重置链接已过期或无效，请重新发起密码重置。");
        setIsRecoveryMode(false);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      try {
        await flushPendingSave();
      } catch {
        // A stale or expired session must not prevent the user from signing out.
        pendingSaveRef.current = null;
      }
      const api = await waitForPlannerApi();
      await api.signOut?.();
      resetWorkspaceUi();
      loadedWorkspaceKeyRef.current = "cloud:signed-out";
      dataRef.current = null;
      settingsRef.current = null;
      setUtilityPanel(null);
      setData(null);
      setSettings(null);
      setAuthState({ mode: "cloud", user: null, configured: true });
      await loadInitial();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(lang === "zh"
      ? "确定永久删除账户和全部 NavoPath 数据吗？此操作无法撤销。"
      : "Permanently delete your account and all NavoPath data? This cannot be undone.");
    if (!confirmed) return;
    try {
      await flushPendingSave();
      const api = await waitForPlannerApi();
      await api.deleteAccount?.();
      resetWorkspaceUi();
      setUtilityPanel(null);
      setData(null);
      setSettings(null);
      await loadInitial();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  function requestTimelineFocus(target: TimelineFocusTarget) {
    setPendingTimelineFocus(target);
  }

  function resolveVisibleAnchorForDate(date: string) {
    return timelineView === "weekly" ? startOfWeekIso(date) : date;
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flushPendingSave();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleVisibilityChange);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (pendingTimelineFocus) return;
    if (mode !== "execute" || !data || !timelineRef.current) return;
    const autoScrollKey = `${timelineView}:${selectedDate}`;
    if (lastTimelineAutoScrollKeyRef.current === autoScrollKey) return;
    lastTimelineAutoScrollKeyRef.current = autoScrollKey;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const fallbackMinutes = 9 * 60;
    const targetMinutes = selectedDate === todayIso() && currentMinutes >= TIMELINE_START * 60 && currentMinutes <= TIMELINE_END * 60
      ? currentMinutes
      : fallbackMinutes;
    const targetTop = ((targetMinutes - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
    const container = timelineRef.current;
    container.scrollTop = Math.max(0, targetTop - container.clientHeight * 0.42);
  }, [mode, data, selectedDate, timelineView, pendingTimelineFocus]);

  useEffect(() => {
    if (mode !== "execute" || !pendingTimelineFocus) return;
    const anchorDate = resolveVisibleAnchorForDate(pendingTimelineFocus.date);
    if (selectedDate !== anchorDate) {
      setSelectedDate(anchorDate);
      return;
    }
    const container = timelineRef.current;
    if (!container) return;
    const targetMinutes = pendingTimelineFocus.startTime
      ? timeToMinutes(pendingTimelineFocus.startTime)
      : Math.max(TIMELINE_START * 60, 9 * 60);
    const targetTop = ((targetMinutes - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
    container.scrollTo({
      top: Math.max(0, targetTop - container.clientHeight * 0.32),
      behavior: "smooth",
    });
    setPendingTimelineFocus(null);
  }, [mode, pendingTimelineFocus, selectedDate, timelineView]);

  useEffect(() => {
    if (!placementPreview) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-placement-card="${placementPreview.taskId}"]`)) return;
      setPlacementPreview(null);
      setPendingTimelineFocus(null);
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handlePointerDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [placementPreview]);

  useEffect(() => {
    if (!placementPreview) return;
    setPlacementPreview(null);
    setPendingTimelineFocus(null);
  }, [timelineView, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (editingId && addType === "task") {
        closeTaskDrawer({ autoSave: true });
        return;
      }
      closeTaskDrawer();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, editingId, addType, data, form]);

  // Forward wheel events from the full timeline panel area to the scroll container
  useEffect(() => {
    if (mode !== "execute") return;
    const handler = (e: WheelEvent) => {
      const panel = document.getElementById("df-execute-timeline");
      if (!panel || !panel.contains(e.target as Node)) return;
      const scroller = panel.querySelector(".df-timeline-scroll, .df-timeline-3day-scroll") as HTMLElement | null;
      if (!scroller) return;
      e.preventDefault();
      scroller.scrollTop += e.deltaY;
    };
    document.addEventListener("wheel", handler, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", handler, { capture: true });
  }, [mode]);

  useEffect(() => {
    if (!quickSchedule) return;
    const cancelQuickSchedule = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".df-quick-schedule") || target.closest(".df-timeline-canvas") || target.closest(".df-all-day-quick")) return;
      setQuickSchedule(null);
    };
    document.addEventListener("mousedown", cancelQuickSchedule);
    return () => document.removeEventListener("mousedown", cancelQuickSchedule);
  }, [quickSchedule]);

  // Dismiss floating time-add when view changes, drag starts, or drawer opens
  useEffect(() => {
    if (floatingTimeAdd) setFloatingTimeAdd(null);
  }, [timelineView, drag, drawerOpen]);

  async function flushPendingSave() {
    if (!pendingSaveRef.current) return;
    const payload = pendingSaveRef.current;
    const saveId = queuedSaveIdRef.current;
    pendingSaveRef.current = null;
    saveTimerRef.current = null;
    const saved = await window.plannerApi.saveData(payload);
    if (queuedSaveIdRef.current !== saveId) return;
    dataRef.current = saved;
    setData(saved);
    if (settingsRef.current) writeBootstrapCache(saved, settingsRef.current, authState?.user?.id);
  }

  async function saveData(next: PlannerData) {
    queuedSaveIdRef.current += 1;
    pendingSaveRef.current = next;
    dataRef.current = next;
    setData(next);
    if (settingsRef.current) writeBootstrapCache(next, settingsRef.current, authState?.user?.id);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, 1000);
  }

  async function saveSettings(patch: Partial<Settings>) {
    const saved = await window.plannerApi.saveSettings(patch);
    settingsRef.current = saved;
    setSettings(saved);
    if (saved.language) setLang(saved.language);
    if (dataRef.current) writeBootstrapCache(dataRef.current, saved, authState?.user?.id);
    if (patch.activeMode) setModeState(patch.activeMode as Mode);
  }

  const today = todayIso();
  const timelineDate = selectedDate;
  const isViewingToday = timelineDate === today;
  const projects = data?.projects || [];
  const tasks = data?.tasks || [];
  const events = data?.events || [];

  /**
   * Build "virtual" Task objects for each active preview block. These are
   * rendered alongside real `scheduledTasks` so the timeline shows previews
   * using the same `TimeBlock` component and `computeConflictLayout` as real
   * events. The source task is NEVER modified.
   *
   * IMPORTANT: The virtual task uses the SAME `clonedTaskId` that will be
   * committed as a real task. So on accept, the block visually does NOT
   * change — only the `data-preview` attribute is removed. After accept,
   * the same id appears in `data.tasks` and edit/drag/resize work normally.
   */
  const previewTasks = useMemo<Task[]>(() => {
    if (schedulePreviews.length === 0) return [];
    return schedulePreviews.map((p) => {
      const source = tasks.find((t) => t.id === p.sourceTaskId);
      return {
        id: p.clonedTaskId,
        title: source?.title || p.title,
        dueDate: p.scheduledDate,
        category: source?.category || "personal",
        priority: p.priority,
        importance: p.priority,
        urgency: p.priority,
        notes: source?.notes || "",
        goalId: source?.goalId || "",
        completed: false,
        projectId: source?.projectId || p.projectId,
        parentTaskId: p.sourceTaskId,
        estimatedHours: p.durationMinutes / 60,
        scheduledDate: p.scheduledDate,
        scheduledStart: p.scheduledStart,
        scheduledEnd: p.scheduledEnd,
        plannedForDate: p.scheduledDate,
        subtasks: source?.subtasks || [],
        order: Date.now(),
        createdAt: p.id,
        updatedAt: p.id,
      } as Task;
    });
  }, [schedulePreviews, tasks]);

  // Map of clonedTaskId → previewId, used by TimeBlock to know which blocks
  // are previews (and thus should show accept/cancel buttons, dashed border).
  // A clonedTaskId is a preview ONLY if it is NOT yet in data.tasks.
  const previewIdByClonedId = useMemo(() => {
    const realTaskIds = new Set(tasks.map((t) => t.id));
    const m = new Map<string, string>();
    for (const p of schedulePreviews) {
      if (!realTaskIds.has(p.clonedTaskId)) m.set(p.clonedTaskId, p.id);
    }
    return m;
  }, [schedulePreviews, tasks]);

  const visibleTimelineDates = useMemo(() => {
    if (timelineView === "daily") return new Set([timelineDate]);
    if (timelineView === "3day" || timelineView === "weekly") {
      return new Set(getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate));
    }
    return new Set<string>();
  }, [timelineDate, timelineView]);

  function getTimelineRangeFor(view: TimelineView, anchorDate: string) {
    if (view === "daily") return [anchorDate];
    if (view === "3day") return getVisibleDays("3day", anchorDate);
    if (view === "weekly") return getVisibleDays("weekly", anchorDate);
    return [anchorDate];
  }

  // Helper: expand timelineRecords into virtual Task objects for a list of dates.
  // Returns Task objects where id = record.id (record-level identity).
  function expandTimelineRecords(dates: Set<string>): Task[] {
    const result: Task[] = [];
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        if (!dates.has(record.scheduledDate)) continue;
        if (record.executionStatus === "cancelled") continue;
        result.push({
          ...task,
          id: record.id,
          scheduledDate: record.scheduledDate,
          scheduledStart: record.scheduledStart,
          scheduledEnd: record.scheduledEnd,
          executionStatus: record.executionStatus,
        } as Task);
      }
      if ((!task.timelineRecords || task.timelineRecords.length === 0) && task.scheduledDate && task.scheduledStart && dates.has(task.scheduledDate)) {
        result.push({
          ...task,
          scheduledDate: task.scheduledDate,
          scheduledStart: task.scheduledStart,
          scheduledEnd: task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task)),
          executionStatus: task.executionStatus || "scheduled",
        } as Task);
      }
    }
    return result.sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
  }

  function expandRecurrenceOccurrences(dates: Set<string>) {
    const ownerMap = new Map<string, Task>();
    const expanded: Task[] = [];
    if (dates.size === 0) return { tasks: expanded, ownerMap };
    for (const task of tasks) {
      if (!isRecurringScheduledTask(task) || !task.recurrence?.startTime) continue;
      const blockedDates = new Set(
        (task.timelineRecords || [])
          .filter((record) =>
            dates.has(record.scheduledDate) &&
            (record.executionStatus === "scheduled" ||
              record.executionStatus === "completed" ||
              record.executionStatus === "returned_unfinished" ||
              record.executionStatus === "cancelled")
          )
          .map((record) => record.scheduledDate)
      );
      if (task.scheduledDate && task.scheduledStart && dates.has(task.scheduledDate)) {
        blockedDates.add(task.scheduledDate);
      }
      for (const date of enumerateRecurrenceDates(task.recurrence, dates)) {
        if (blockedDates.has(date)) continue;
        const occurrenceId = buildRecurrenceOccurrenceId(task.id, date, task.recurrence.startTime);
        expanded.push({
          ...task,
          id: occurrenceId,
          scheduledDate: date,
          scheduledStart: task.recurrence.startTime,
          scheduledEnd: addMinutes(task.recurrence.startTime, task.recurrence.durationMinutes || taskDuration(task)),
          executionStatus: "scheduled",
        } as Task);
        ownerMap.set(occurrenceId, task);
      }
    }
    expanded.sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
    return { tasks: expanded, ownerMap };
  }

  function expandEventOccurrences(dates: Set<string>) {
    const ownerMap = new Map<string, CalendarEvent>();
    const expanded: Task[] = [];
    for (const event of events) {
      const occurrenceDates = event.recurrence
        ? enumerateRecurrenceDates(event.recurrence, dates)
        : [...dates].filter((date) => date >= (event.startDate || event.date) && date <= (event.endDate || event.startDate || event.date));
      for (const date of occurrenceDates) {
        const id = `event_occ_${event.id}_${date}_${event.startTime || "all"}`;
        const start = event.startTime || undefined;
        const duration = start
          ? Math.max(event.recurrence?.durationMinutes || (event.endTime ? timeToMinutes(event.endTime) - timeToMinutes(start) : 60), 15)
          : 30;
        expanded.push({
          id, title: event.title, dueDate: date, category: event.category, priority: "medium",
          notes: event.details, goalId: "", completed: false, estimatedHours: duration / 60,
          scheduledDate: date, scheduledStart: start, scheduledEnd: start ? addMinutes(start, duration) : undefined,
          recurrence: event.recurrence, createdAt: event.createdAt, updatedAt: event.createdAt,
        });
        ownerMap.set(id, event);
      }
    }
    return { tasks: expanded, ownerMap };
  }

  const explicitVisibleTimelineTasks = useMemo(
    () => expandTimelineRecords(visibleTimelineDates),
    [tasks, visibleTimelineDates],
  );

  const recurrenceVisibleTimeline = useMemo(() => {
    return expandRecurrenceOccurrences(visibleTimelineDates);
  }, [tasks, visibleTimelineDates]);

  const eventVisibleTimeline = useMemo(() => expandEventOccurrences(visibleTimelineDates), [events, visibleTimelineDates]);

  const expandedVisibleTimelineTasks = useMemo(
    () => [...explicitVisibleTimelineTasks, ...recurrenceVisibleTimeline.tasks, ...eventVisibleTimeline.tasks.filter((item) => item.scheduledStart)].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)),
    [explicitVisibleTimelineTasks, recurrenceVisibleTimeline.tasks, eventVisibleTimeline.tasks],
  );

  // Record ID → real task resolution map (for operations like project change, note save)
  const recordToTaskMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        map.set(record.id, task);
      }
    }
    return map;
  }, [tasks]);

  // Record ID → record data map (for operations like uncomplete, toggleDone)
  const recordByIdMap = useMemo(() => {
    const map = new Map<string, TimelineRecord>();
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        map.set(record.id, record);
      }
    }
    return map;
  }, [tasks]);

  const occurrenceToTaskMap = recurrenceVisibleTimeline.ownerMap;
  const occurrenceToEventMap = eventVisibleTimeline.ownerMap;

  function resolveOwningTask(taskOrId: Task | string) {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    return occurrenceToTaskMap.get(id) || recordToTaskMap.get(id);
  }

  function resolveOwningEvent(taskOrId: Task | string) {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    return occurrenceToEventMap.get(id) || events.find((event) => id.startsWith(`event_occ_${event.id}_`));
  }

  const placementPreviewTask = useMemo(
    () => placementPreview ? tasks.find((task) => task.id === placementPreview.taskId) : undefined,
    [placementPreview, tasks],
  );

  // Real scheduled tasks for current timeline date, expanded from timelineRecords.
  // Each timeline record becomes a virtual Task with id = record.id.
  // Previews are appended but not in data.tasks yet.
  const scheduledTasks = useMemo(
    () => {
      const expanded = expandedVisibleTimelineTasks.filter((task) => task.scheduledDate === timelineDate);
      const virtual = previewTasks.filter((task) => task.scheduledDate === timelineDate);
      return [...expanded, ...virtual].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
    },
    [expandedVisibleTimelineTasks, timelineDate, previewTasks],
  );
  // Measure daily canvas width for conflict layout.
  // Must be placed AFTER scheduledTasks declaration (above) so it can
  // safely reference scheduledTasks in its dependency array.
  useEffect(() => {
    const el = timelineCanvasRef.current;
    if (!el || timelineView !== "daily") return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setDailyCanvasWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineView, selectedDate, scheduledTasks]);

  const todayCandidates = useMemo(
    () => tasks.filter((task) => {
      if (task.completed) return false;
      const lane = getExecutionLane(task);
      if (lane === "queued") return false;
      const hasActiveSchedule = (task.timelineRecords || []).some((r) => r.executionStatus === "scheduled") || Boolean(task.scheduledDate);
      if (hasActiveSchedule) return false;
      if (hasRecurrenceOccurrenceOnDate(task, today)) return false;
      return task.plannedForDate === today || Boolean(task.plannedForDate && task.plannedForDate < today);
    }).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [tasks, today]
  );
  const completedCandidates = useMemo(
    () => tasks.filter((task) => task.completed && getExecutionLane(task) !== "queued" && task.plannedForDate === today && !(task.timelineRecords || []).some((r) => r.executionStatus === "scheduled") && !task.scheduledDate && !hasRecurrenceOccurrenceOnDate(task, today)).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [tasks, today]
  );
  const todayEventCandidates = useMemo(
    () => expandEventOccurrences(new Set([today])).tasks
      .filter((task) => !task.scheduledStart && task.scheduledDate === today)
      .sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    [events, today],
  );
  // Conflict layout: maps taskId → { index, count } for overlapping tasks
  const conflictLayout = useMemo(() => {
    const map = new Map<string, { index: number; count: number }>();
    if (timelineView === "daily") {
      computeConflictLayout(scheduledTasks, MAX_DAILY_COLLISION_COLUMNS).forEach((v, k) => map.set(k, v));
    } else {
      const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
      const dayTasks: Task[] = expandedVisibleTimelineTasks.filter((task) => threeDates.includes(task.scheduledDate || ""));
      dayTasks.sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
      const byDate = new Map<string, Task[]>();
      for (const t of dayTasks) {
        const d = t.scheduledDate || "";
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(t);
      }
      for (const [, group] of byDate) {
        computeConflictLayout(group).forEach((v, k) => map.set(k, v));
      }
    }
    return map;
  }, [expandedVisibleTimelineTasks, timelineDate, timelineView, scheduledTasks]);

  // Debug: conflict layout info
  useEffect(() => {
    if (conflictLayout.size === 0) return;
    const viewedDates = timelineView === "daily" ? [timelineDate] : getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
    const info = tasks
      .filter((t) => conflictLayout.has(t.id))
      .map((t) => {
        const cl = conflictLayout.get(t.id)!;
        const top = timeBlockTop(t.scheduledStart || "09:00");
        const height = Math.max(timeBlockHeight(t.scheduledStart || "09:00", t.scheduledEnd || addMinutes(t.scheduledStart || "09:00", 30)), SLOT_HEIGHT);
        return {
          title: t.title,
          viewMode: timelineView,
          visibleDays: viewedDates.length,
          start: t.scheduledStart,
          end: t.scheduledEnd,
          group: `g-${cl.index}-${cl.count}`,
          column: cl.index,
          columns: cl.count,
          top: Math.round(top),
          height: Math.round(height),
          zIndex: 2 + cl.index,
        };
      });
    console.table(info);
  }, [conflictLayout, tasks, timelineView, timelineDate]);

  const visibleCandidates = showCompletedCandidates ? [...todayEventCandidates, ...todayCandidates, ...completedCandidates] : [...todayEventCandidates, ...todayCandidates];
  const executeStats = useMemo(() => {
    const planned = tasks.filter((task) => !task.completed && task.plannedForDate === today);
    const scheduled = planned.filter((task) =>
      (task.timelineRecords || []).some((r) => r.scheduledDate === today && r.executionStatus === "scheduled") ||
      Boolean(task.scheduledDate === today && task.scheduledStart) ||
      hasRecurrenceOccurrenceOnDate(task, today)
    );
    const scheduledHours = scheduled.reduce((sum, task) => {
      const active = (task.timelineRecords || []).find((r) => r.scheduledDate === today && r.executionStatus === "scheduled");
      if (active) return sum + (timeToMinutes(active.scheduledEnd) - timeToMinutes(active.scheduledStart)) / 60;
      if (task.scheduledDate === today && task.scheduledStart) {
        return sum + (timeToMinutes(task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task))) - timeToMinutes(task.scheduledStart)) / 60;
      }
      if (isRecurringScheduledTask(task) && task.recurrence?.startTime && task.recurrence.durationMinutes && hasRecurrenceOccurrenceOnDate(task, today)) {
        return sum + task.recurrence.durationMinutes / 60;
      }
      return sum;
    }, 0);
    const totalHours = planned.reduce((sum, task) => sum + (task.estimatedHours || 0.5), 0);
    return { planned, scheduled, scheduledHours, totalHours };
  }, [tasks, today]);

  function projectName(task: Task) {
    const realTask = resolveOwningTask(task) || task;
    return projects.find((project) => String(project.id) === String(realTask.projectId || ""))?.title || "未归属";
  }

  function projectSnapshot(list: Project[], title: string, color = PROJECT_COLOR_PRESETS[0]) {
    const cleanTitle = title.trim();
    const existing = list.find((project) => project.title.toLowerCase() === cleanTitle.toLowerCase());
    if (existing) return { projectId: existing.id, projects: list, created: false };
    const project = makeProject({ ...defaultForm("project"), title: cleanTitle, projectColor: color });
    return { projectId: project.id, projects: [...list, project], created: true };
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    if (!data) return;
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task)
    });
  }

  /** Update a specific TimelineRecord by recordId. Finds the owning task. */
  function updateTimelineRecord(recordId: string, patch: Partial<TimelineRecord>) {
    if (!data) return;
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const records = task.timelineRecords;
        if (!records) return task;
        const idx = records.findIndex((r) => r.id === recordId);
        if (idx === -1) return task;
        const updated = [...records];
        updated[idx] = { ...updated[idx], ...patch };
        return { ...task, timelineRecords: updated, updatedAt: new Date().toISOString() };
      }),
    });
  }

  /** Delete a TimelineRecord by recordId. */
  function deleteTimelineRecord(recordId: string) {
    if (!data) return;
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const records = task.timelineRecords;
        if ((!records || records.length === 0) && task.id === recordId && task.scheduledDate) {
          return {
            ...task,
            scheduledDate: undefined,
            scheduledStart: undefined,
            scheduledEnd: undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        if (!records) return task;
        const filtered = records.filter((r) => r.id !== recordId);
        if (filtered.length === records.length) return task;
        return { ...task, timelineRecords: filtered, updatedAt: new Date().toISOString() };
      }),
    });
  }

  function toggleTaskDone(taskId: string) {
    if (!data) return;
    const occurrenceMeta = parseRecurrenceOccurrenceId(taskId);
    if (occurrenceMeta) {
      const realTask = occurrenceToTaskMap.get(taskId);
      if (!realTask) return;
      const recurrence = realTask.recurrence;
      if (!recurrence?.startTime) return;
      const duration = recurrence.durationMinutes || taskDuration(realTask);
      const completedRecord: TimelineRecord = {
        id: `${realTask.id}_rec_done_${occurrenceMeta.scheduledDate}_${occurrenceMeta.scheduledStart}`.replace(/[^a-zA-Z0-9_:-]/g, "_"),
        taskId: realTask.id,
        scheduledDate: occurrenceMeta.scheduledDate,
        scheduledStart: occurrenceMeta.scheduledStart,
        scheduledEnd: addMinutes(occurrenceMeta.scheduledStart, duration),
        executionStatus: "completed",
        createdAt: new Date().toISOString(),
      };
      updateTask(realTask.id, {
        timelineRecords: [...(realTask.timelineRecords || []), completedRecord],
      });
      return;
    }
    const realTask = recordToTaskMap.get(taskId);
    if (realTask) {
      // This is a record ID → update the record's executionStatus
      const record = recordByIdMap.get(taskId);
      if (record) {
        const nextStatus = record.executionStatus === "completed" ? "scheduled" : "completed";
        updateTimelineRecord(record.id, { executionStatus: nextStatus });
      }
      // Also update the real task's completed flag
      const nextCompleted = !realTask.completed;
      updateTask(realTask.id, { completed: nextCompleted });
      return;
    }
    // Legacy: direct task ID
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.completed;
    const patch: Partial<Task> = { completed: nextCompleted };
    if (task.executionStatus === "returned_unfinished" && nextCompleted) {
      patch.executionStatus = "completed";
    } else if (!nextCompleted && task.executionStatus === "completed") {
      patch.executionStatus = "scheduled";
    }
    updateTask(taskId, patch);
  }

  function batchUpdateTasks(updates: { taskId: string; patch: Partial<Task> }[]) {
    if (!data || updates.length === 0) return;
    const map = new Map(updates.map((u) => [u.taskId, u.patch]));
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const p = map.get(task.id);
        return p ? { ...task, ...p, updatedAt: new Date().toISOString() } : task;
      }),
    });
  }

  function updateProject(projectId: string, patch: Partial<Project>) {
    if (!data) return;
    void saveData({
      ...data,
      projects: data.projects.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project)
    });
  }

  function showToast(message: string) {
    setToast(message);
    setToastAction(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => current === message ? "" : current);
      setToastAction(null);
    }, 2600);
  }

  /**
   * Show a toast with an undo action. The action button is clickable for 5
   * seconds. If clicked, the onClick callback fires and the toast is dismissed.
   * If ignored, the toast disappears automatically.
   */
  function showUndoToast(message: string, actionLabel: string, onUndo: () => void) {
    setToast(message);
    setToastAction({ label: actionLabel, onClick: () => { onUndo(); dismissToast(); } });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      setToastAction(null);
      undoSnapshotRef.current = null;
    }, 5000);
  }

  function dismissToast() {
    setToast("");
    setToastAction(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }

  function openPlanningPicker() {
    setPlanningPickMode(true);
    void saveSettings({ activeMode: "planning" });
  }

  function addPlanningPick(taskId: string) {
    setPlanningPicks((current) => current[taskId] ? current : { ...current, [taskId]: "should" });
  }

  function updatePlanningPick(taskId: string, priority: PlanPickPriority) {
    setPlanningPicks((current) => ({ ...current, [taskId]: priority }));
  }

  function removePlanningPick(taskId: string) {
    setPlanningPicks((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  function clearPlanningPicks() {
    setPlanningPicks({});
  }

  function applyPlanningPicks(scope: "today" | "week") {
    if (!data) return;
    const ids = Object.keys(planningPicks);
    if (ids.length === 0) return;
    const taskIds = new Set(data.tasks.map((task) => task.id));
    const now = new Date().toISOString();
    const promotedSubtasks = ids.flatMap((id) => {
      if (taskIds.has(id)) return [];
      const parentTask = data.tasks.find((task) => (task.subtasks || []).some((subtask) => subtask.id === id));
      const subtask = parentTask?.subtasks?.find((candidate) => candidate.id === id);
      if (!parentTask || !subtask) return [];
      const picked = planningPicks[id];
      return [{
        ...parentTask,
        id: uid("task"),
        title: subtask.title,
        priority: picked === "must" ? "high" : picked === "could" ? "low" : parentTask.priority,
        completed: false,
        parentTaskId: parentTask.id,
        plannedForDate: scope === "today" ? today : undefined,
        executionLane: scope === "today" ? "candidate" as const : undefined,
        scheduledDate: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        executionStatus: undefined,
        timelineRecords: [],
        recurrence: undefined,
        subtasks: [],
        order: Date.now(),
        createdAt: now,
        updatedAt: now,
      } satisfies Task];
    });
    void saveData({
      ...data,
      tasks: [...data.tasks.map((task) => {
        if (!ids.includes(task.id)) return task;
        const picked = planningPicks[task.id];
        return {
          ...task,
          priority: picked === "must" ? "high" : picked === "could" ? "low" : task.priority,
          plannedForDate: scope === "today" ? today : undefined,
          executionLane: scope === "today" ? "candidate" as const : undefined,
          scheduledDate: undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          updatedAt: new Date().toISOString()
        };
      }), ...promotedSubtasks]
    });
    setPlanningPicks({});
    if (scope === "today") void saveSettings({ activeMode: "execute" });
    showToast(scope === "today" ? t(lang, "toast.addedToToday") : t(lang, "toast.addedToWeek"));
  }

  function quickAddTask() {
    if (!data || !quickTitle.trim()) return;
    const task = makeTask({
      ...defaultForm("task"),
      title: quickTitle,
      projectId: quickProjectId,
      dueDate: today
    });
    void saveData({ ...data, tasks: [...data.tasks, { ...task, plannedForDate: today, order: Date.now() }] });
    setQuickTitle("");
    if (settings?.onboardingVersion === 0 && settings.onboardingStep === "add") {
      void saveSettings({ onboardingStep: "drag" });
    }
    showToast(t(lang, "toast.addedToCandidates"));
  }

  function createQuickProject() {
    if (!data || !quickProjectTitle.trim()) return;
    const snapshot = projectSnapshot(data.projects, quickProjectTitle, quickProjectColor);
    if (snapshot.created) void saveData({ ...data, projects: snapshot.projects });
    setQuickProjectId(snapshot.projectId);
    setQuickProjectTitle("");
    setQuickProjectOpen(false);
  }

  function quickCreateProject(title: string) {
    if (!data || !title.trim()) return "";
    const snapshot = projectSnapshot(data.projects, title);
    if (snapshot.created) void saveData({ ...data, projects: snapshot.projects });
    setForm((current) => ({ ...current, projectId: snapshot.projectId }));
    showToast(snapshot.created ? t(lang, "toast.projectCreated") : t(lang, "toast.projectSelected"));
    return snapshot.projectId;
  }

  function createProjectForTask(taskId: string, title: string) {
    if (!data || !title.trim()) return "";
    const realTaskId = resolveOwningTask(taskId)?.id || taskId;
    const snapshot = projectSnapshot(data.projects, title);
    void saveData({
      ...data,
      projects: snapshot.projects,
      tasks: data.tasks.map((task) => task.id === realTaskId ? { ...task, projectId: snapshot.projectId, updatedAt: new Date().toISOString() } : task)
    });
    showToast(snapshot.created ? t(lang, "toast.createdAndAssigned") : t(lang, "toast.assignedToProject"));
    return snapshot.projectId;
  }

  function createTaskInProject(projectId: string) {
    if (!data) return;
    const title = window.prompt(t(lang, "toast.newTaskName"));
    if (!title?.trim()) return;
    const task = {
      ...makeTask({
      ...defaultForm("task"),
      title: title.trim(),
      projectId,
      dueDate: today
      }),
      plannedForDate: undefined,
      executionLane: undefined,
    };
    void saveData({ ...data, tasks: [...data.tasks, task] });
    showToast(t(lang, "toast.addedToProject"));
  }

  function saveQuickSchedule() {
    if (!data || !quickSchedule?.title.trim()) return;
    if (quickSchedule.isAllDay) {
      const hashProjectTitle = quickSchedule.title.match(/#([^\s#]+)\s*$/)?.[1]?.trim() || "";
      let projectId = quickSchedule.projectId;
      let nextProjects = data.projects;
      if (hashProjectTitle && hashProjectTitle.toLowerCase() !== "inbox") {
        const projectExists = projectId && nextProjects.some((project) => String(project.id) === String(projectId));
        if (!projectExists) {
          const snapshot = projectSnapshot(nextProjects, hashProjectTitle);
          projectId = snapshot.projectId;
          nextProjects = snapshot.projects;
        }
      }
      const cleanTitle = quickSchedule.title.replace(/#[^\s#]+/g, "").trim() || quickSchedule.title.trim();
      const task = makeTask({
        ...defaultForm("task"),
        title: cleanTitle,
        projectId,
        dueDate: timelineDate,
        estimatedHours: 1
      });
      void saveData({
        ...data,
        projects: nextProjects,
        tasks: [...data.tasks, {
          ...task,
          plannedForDate: timelineDate,
          executionLane: undefined,
          scheduledDate: timelineDate,
          scheduledStart: undefined,
          scheduledEnd: undefined
        }]
      });
      setQuickSchedule(null);
      showToast(t(lang, "toast.addedToAllDay"));
      return;
    }
    const endTime = addMinutes(quickSchedule.startTime, 60);
    const hashProjectTitle = quickSchedule.title.match(/#([^\s#]+)\s*$/)?.[1]?.trim() || "";
    let projectId = quickSchedule.projectId;
    let nextProjects = data.projects;
    if (hashProjectTitle && hashProjectTitle.toLowerCase() !== "inbox") {
      const projectExists = projectId && nextProjects.some((project) => String(project.id) === String(projectId));
      if (!projectExists) {
        const snapshot = projectSnapshot(nextProjects, hashProjectTitle);
        projectId = snapshot.projectId;
        nextProjects = snapshot.projects;
      }
    }
    const cleanTitle = quickSchedule.title.replace(/#[^\s#]+/g, "").trim() || quickSchedule.title.trim();
    const task = makeTask({
      ...defaultForm("task"),
      title: cleanTitle,
      projectId,
      dueDate: timelineDate,
      estimatedHours: 1
    });
    const scheduledRecord = createScheduledRecord(task, timelineDate, quickSchedule.startTime, 60);
    void saveData({
      ...data,
      projects: nextProjects,
      tasks: [...data.tasks, {
        ...task,
        plannedForDate: timelineDate,
        executionLane: undefined,
        timelineRecords: [scheduledRecord],
      }]
    });
    requestTimelineFocus({ date: timelineDate, startTime: quickSchedule.startTime, taskId: scheduledRecord.id, source: "schedule" });
    setQuickSchedule(null);
    showToast(t(lang, "toast.addedToTimeline"));
  }

  function createAllDayTask(title: string, targetDate: string, projectId: string | null) {
    if (!data || !title.trim()) return;
    let nextProjects = data.projects;
    let pid = projectId || "";
    if (!pid) {
      // Check for #project in title (already stripped, but handle projectId)
    }
    const cleanTitle = title.trim();
    const task = makeTask({ ...defaultForm("task"), title: cleanTitle, projectId: pid, dueDate: targetDate, estimatedHours: 0.5 });
    void saveData({
      ...data,
      projects: nextProjects,
      tasks: [...data.tasks, { ...task, plannedForDate: targetDate, executionLane: undefined, scheduledDate: targetDate, scheduledStart: undefined, scheduledEnd: undefined }]
    });
    setAllDayQuickAdd(null);
    showToast(t(lang, "toast.allDayTaskAdded"));
  }

  function makeAllDay(taskId: string, targetDate: string) {
    // If taskId is a record ID (from expanded timeline), convert the record to all-day
    const realTask = recordToTaskMap.get(taskId);
    if (realTask && data) {
      // Update the record: remove start/end times (mark as all-day)
      void saveData({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === realTask.id
            ? {
                ...t,
                plannedForDate: targetDate,
                executionLane: undefined,
                timelineRecords: (t.timelineRecords || []).map((r) =>
                  r.id === taskId
                    ? { ...r, scheduledDate: targetDate, scheduledStart: "", scheduledEnd: "" }
                    : r
                ),
                updatedAt: new Date().toISOString(),
              }
            : t
        ),
      });
    } else {
      // Legacy: direct task ID
      updateTask(taskId, { plannedForDate: targetDate, executionLane: undefined, scheduledDate: targetDate, scheduledStart: undefined, scheduledEnd: undefined });
    }
    showToast(t(lang, "toast.setToAllDay"));
    setDrag(null);
  }

  function makeEventCandidate(occurrenceId: string, targetDate: string = today) {
    if (!data) return;
    const event = resolveOwningEvent(occurrenceId);
    if (!event) return;
    void saveData({
      ...data,
      events: data.events.map((item) => item.id === event.id ? {
        ...item,
        date: targetDate,
        startDate: targetDate,
        endDate: targetDate,
        startTime: undefined,
        endTime: undefined,
        recurrence: item.recurrence ? {
          ...item.recurrence,
          mode: "flexible",
          startDate: targetDate,
          startTime: undefined,
          durationMinutes: undefined,
        } : item.recurrence,
      } : item),
    });
    showToast(t(lang, "toast.movedBackToCandidates"));
    setDrag(null);
    setHoverSlot("");
    dragTargetDateRef.current = "";
  }

  function saveFloatingTimeAdd(title: string, projectId: string | null) {
    if (!data || !floatingTimeAdd) return;
    const { date, startTime, endTime } = floatingTimeAdd;
    const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
    const task = makeTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: date, estimatedHours: durationMinutes / 60 });
    const scheduledRecord = createScheduledRecord(task, date, startTime, durationMinutes);
    void saveData({
      ...data,
      tasks: [...data.tasks, { ...task, plannedForDate: date, executionLane: undefined, timelineRecords: [scheduledRecord] }]
    });
    requestTimelineFocus({ date, startTime, taskId: scheduledRecord.id, source: "schedule" });
    setFloatingTimeAdd(null);
    showToast(t(lang, "toast.addedToTimeline"));
  }

  function hasScheduleConflict(startTime: string, endTime: string, ignoreTaskId?: string) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return scheduledTasks.some((task) => {
      if (task.id === ignoreTaskId || !task.scheduledStart || !task.scheduledEnd) return false;
      const otherStart = timeToMinutes(task.scheduledStart);
      const otherEnd = timeToMinutes(task.scheduledEnd);
      return start < otherEnd && end > otherStart;
    });
  }

  function findNextFreeSlot(duration: number) {
    const now = new Date();
    const earliest = clampSlot(Math.max(now.getHours() * 60 + now.getMinutes(), TIMELINE_START * 60));
    const latestStart = TIMELINE_END * 60 - duration;
    for (let cursor = earliest; cursor <= latestStart; cursor += SLOT_MINUTES) {
      const start = minutesToTime(cursor);
      const end = minutesToTime(cursor + duration);
      if (!hasScheduleConflict(start, end)) return start;
    }
    return minutesToTime(Math.max(TIMELINE_START * 60, latestStart));
  }

  // Show scrollbar only when actually scrolling
  useEffect(() => {
    const timers = new WeakMap<HTMLElement, number>();
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!(target instanceof HTMLElement)) return;
      target.classList.add("is-scrolling");
      clearTimeout(timers.get(target)!);
      timers.set(target, window.setTimeout(() => {
        target.classList.remove("is-scrolling");
      }, 500));
    };
    document.addEventListener("scroll", onScroll, { capture: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  function slotFromPointer(clientY: number, offsetMinutes = 0) {
    const { gridEl, scrollEl, visDays } = getDropGridAndDays();
    if (!gridEl || !scrollEl) return "09:00";
    // Pass a dummy clientX (0) — dayIndex doesn't matter for time‑only queries
    const target = pointerToDateTime({
      clientX: 0, clientY,
      gridElement: gridEl,
      scrollElement: scrollEl,
      visibleDays: visDays,
    });
    return minutesToTime(clampSlot(target.minutes - offsetMinutes));
  }

  function pointerOutsideTimeline(clientX: number, clientY: number) {
    const rect = (timelineView === "3day" || timelineView === "weekly")
      ? timelineRef.current?.getBoundingClientRect()
      : timelineCanvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return clientX < rect.left - 80 || clientX > rect.right + 80 || clientY < rect.top - 40 || clientY > rect.bottom + 40;
  }

  function getScheduledEventsForRange(dateRange: string[]) {
    const visibleSet = new Set(dateRange);
    const explicit = expandTimelineRecords(visibleSet).map((task) => ({
      id: task.id,
      taskId: resolveOwningTask(task.id)?.id || task.id,
      title: task.title,
      scheduledDate: task.scheduledDate,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    }));
    const recurrence = expandRecurrenceOccurrences(visibleSet).tasks.map((task) => ({
      id: task.id,
      taskId: resolveOwningTask(task.id)?.id || task.id,
      title: task.title,
      scheduledDate: task.scheduledDate,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    }));
    return [...explicit, ...recurrence];
  }

  function findCandidatePlacement(task: Task) {
    const visibleRange = getTimelineRangeFor(timelineView, timelineDate);
    const fallbackRange = Array.from({ length: 14 }, (_, index) => addDays(visibleRange[0] || today, index));
    const tryRange = (dateRange: string[]) => autoScheduleTasks({
      tasks: [{
        id: task.id,
        title: task.title,
        priority: (task.priority || "medium") as "high" | "medium" | "low",
        estimatedMinutes: taskDuration(task),
        dueDate: task.dueDate,
        projectId: task.projectId,
        completed: task.completed,
      }],
      scheduledEvents: getScheduledEventsForRange(dateRange),
      dateRange,
    }).proposedEvents[0];
    return tryRange(visibleRange) || tryRange(fallbackRange);
  }

  function cancelPlacementPreview() {
    setPlacementPreview(null);
    setPendingTimelineFocus(null);
  }

  function startPlacementPreview(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (placementPreview?.taskId === taskId) {
      cancelPlacementPreview();
      return;
    }
    const proposed = findCandidatePlacement(task);
    if (!proposed) {
      showToast(t(lang, "toast.noSlotFound"));
      return;
    }
    setPlacementPreview({
      taskId,
      date: proposed.scheduledDate,
      startTime: proposed.scheduledStart,
      endTime: proposed.scheduledEnd,
      durationMinutes: proposed.durationMinutes,
      source: "candidate-calendar",
    });
    setPendingTimelineFocus({
      date: proposed.scheduledDate,
      startTime: proposed.scheduledStart,
      taskId,
      source: "placement",
    });
  }

  function confirmPlacementPreview(taskId: string) {
    if (!placementPreview || placementPreview.taskId !== taskId) return;
    applyCandidateTimeSettings(taskId, {
      date: placementPreview.date,
      startTime: placementPreview.startTime,
      durationMinutes: placementPreview.durationMinutes,
      allDay: false,
    });
    setPlacementPreview(null);
  }

  function saveTaskRecurrence(taskId: string, recurrence?: TaskRecurrence) {
    updateTask(taskId, {
      recurrence,
      ...(recurrence?.mode === "scheduled"
        ? { plannedForDate: recurrence.startDate || today, executionLane: undefined }
        : {}),
    });
    if (recurrence?.mode === "scheduled" && recurrence.startDate && recurrence.startTime) {
      requestTimelineFocus({
        date: recurrence.startDate,
        startTime: recurrence.startTime,
        taskId,
        source: "recurrence",
      });
    }
  }

  function createScheduledRecord(task: Task, scheduledDate: string, scheduledStart: string, durationMinutes: number): TimelineRecord {
    const now = new Date().toISOString();
    return {
      id: `${task.id}_rec_${Date.now().toString(36)}`,
      taskId: task.id,
      scheduledDate,
      scheduledStart,
      scheduledEnd: addMinutes(scheduledStart, durationMinutes),
      executionStatus: "scheduled",
      createdAt: now,
    };
  }

  function createOccurrenceExceptionRecord(task: Task, scheduledDate: string, scheduledStart: string, executionStatus: TimelineRecord["executionStatus"]) {
    return {
      id: `${task.id}_occ_${executionStatus}_${Date.now().toString(36)}`,
      taskId: task.id,
      scheduledDate,
      scheduledStart,
      scheduledEnd: addMinutes(scheduledStart, task.recurrence?.durationMinutes || taskDuration(task)),
      executionStatus,
      createdAt: new Date().toISOString(),
    } as TimelineRecord;
  }

  function cancelRecurringOccurrence(taskId: string, occurrence: EditingOccurrence) {
    if (!data || !occurrence) return;
    const now = new Date().toISOString();
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const records = task.timelineRecords || [];
        const hasExisting = records.some((record) => matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart));
        return {
          ...task,
          timelineRecords: hasExisting
            ? records.map((record) =>
                matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart)
                  ? { ...record, executionStatus: "cancelled" as const }
                  : record
              )
            : [...records, createOccurrenceExceptionRecord(task, occurrence.scheduledDate, occurrence.scheduledStart, "cancelled")],
          updatedAt: now,
        };
      }),
    });
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    showToast(t(lang, "toast.cancelledPlan"));
  }

  function replanRecurringOccurrence(taskId: string, occurrence: EditingOccurrence) {
    if (!data || !occurrence) return;
    const sourceTask = data.tasks.find((task) => task.id === taskId);
    if (!sourceTask) return;
    const now = new Date().toISOString();
    const candidateTask: Task = {
      ...sourceTask,
      id: uid("task"),
      recurrence: undefined,
      completed: false,
      plannedForDate: today,
      executionLane: "candidate",
      dueDate: occurrence.scheduledDate,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      executionStatus: undefined,
      timelineRecords: [],
      parentTaskId: sourceTask.id,
      createdAt: now,
      updatedAt: now,
    };
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const records = task.timelineRecords || [];
        const hasExisting = records.some((record) => matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart));
        return {
          ...task,
          timelineRecords: hasExisting
            ? records.map((record) =>
                matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart)
                  ? { ...record, executionStatus: "cancelled" as const }
                  : record
              )
            : [...records, createOccurrenceExceptionRecord(task, occurrence.scheduledDate, occurrence.scheduledStart, "cancelled")],
          updatedAt: now,
        };
      }).concat(candidateTask),
    });
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    showToast(t(lang, "toast.oneTimeCandidateCreated"));
  }

  function cancelAllRecurringFuture(taskId: string, cutoffDate: string) {
    if (!data) return;
    const now = new Date().toISOString();
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          recurrence: undefined,
          scheduledDate: task.scheduledDate && task.scheduledDate >= cutoffDate ? undefined : task.scheduledDate,
          scheduledStart: task.scheduledDate && task.scheduledDate >= cutoffDate ? undefined : task.scheduledStart,
          scheduledEnd: task.scheduledDate && task.scheduledDate >= cutoffDate ? undefined : task.scheduledEnd,
          timelineRecords: (task.timelineRecords || []).filter((record) =>
            record.executionStatus === "completed" || record.scheduledDate < cutoffDate
          ),
          updatedAt: now,
        };
      }),
    });
    showToast(t(lang, "toast.futureRecurringCleared"));
  }

  function applyCandidateTimeSettings(taskId: string, settings: CandidateTimeSettings) {
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task || !data) return;
    const now = new Date().toISOString();
    const filteredRecords = (task.timelineRecords || []).filter((record) => record.executionStatus !== "scheduled");
    const updatedTask: Task = settings.clearSchedule || settings.allDay
      ? {
          ...task,
          plannedForDate: settings.date,
          executionLane: settings.clearSchedule ? "candidate" : undefined,
          timelineRecords: filteredRecords,
          updatedAt: now,
        }
      : {
          ...task,
          plannedForDate: settings.date,
          executionLane: undefined,
          timelineRecords: [
            ...filteredRecords,
            createScheduledRecord(task, settings.date, settings.startTime, settings.durationMinutes),
          ],
          updatedAt: now,
        };
    void saveData({
      ...data,
      tasks: data.tasks.map((item) => item.id === taskId ? updatedTask : item),
    });
    if (!settings.clearSchedule && !settings.allDay) {
      requestTimelineFocus({
        date: settings.date,
        startTime: settings.startTime,
        taskId,
        source: "schedule",
      });
    }
    showToast(settings.clearSchedule ? t(lang, "toast.clearedSchedule") : settings.allDay ? t(lang, "toast.setToAllDay") : t(lang, "drawer.scheduledOnTimeline"));
  }

  function scheduleTask(taskId: string, startTime: string) {
    const targetDate = dragTargetDateRef.current || timelineDate;
    if (isEventDisplayTask(taskId)) {
      moveEventOccurrence(taskId, startTime, targetDate);
      setHoverSlot("");
      setDrag(null);
      dragTargetDateRef.current = "";
      return;
    }
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task) return;
    applyCandidateTimeSettings(taskId, {
      date: targetDate,
      startTime,
      durationMinutes: taskDuration(task),
      allDay: false,
    });
    if (settings?.onboardingVersion === 0 && settings.onboardingStep === "drag") {
      void saveSettings({ onboardingStep: "planning" });
    }
    setHoverSlot("");
    setDrag(null);
    dragTargetDateRef.current = "";
  }

  function unscheduleTask(taskId: string) {
    if (!data) return;
    void saveData({
      ...data,
      tasks: data.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              plannedForDate: today,
              executionLane: "candidate",
              timelineRecords: (t.timelineRecords || []).filter(
                (r) => r.executionStatus !== "scheduled"
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
    showToast(t(lang, "toast.movedBackToCandidates"));
    setDrag(null);
    setHoverSlot("");
  }

  function returnToPlanning(taskId: string) {
    updateTask(taskId, {
      plannedForDate: undefined,
      executionLane: undefined,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined
    });
    showToast(t(lang, "toast.putBackToPlanning"));
  }

  function getDropGridAndDays(): { gridEl: HTMLElement | null; scrollEl: HTMLElement | null; visDays: string[] } {
    const visDays = getVisibleDays(timelineView === "weekly" ? "weekly" : timelineView === "3day" ? "3day" : "daily", timelineDate);
    if (timelineView === "3day" || timelineView === "weekly") {
      const gridEl = timeGridRef.current || document.querySelector('.df-time-grid');
      const scrollEl = timelineRef.current;
      return { gridEl: gridEl as HTMLElement | null, scrollEl, visDays };
    }
    return { gridEl: timelineCanvasRef.current, scrollEl: timelineRef.current, visDays };
  }

  /** Move a TimelineRecord to a new start time, preserving duration. */
  function moveTimelineRecord(recordId: string, newStart: string, newDate?: string) {
    if (!data) return;
    const now = new Date().toISOString();
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const records = task.timelineRecords;
        if ((!records || records.length === 0) && task.id === recordId && task.scheduledStart) {
          const duration = timeToMinutes(task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task))) - timeToMinutes(task.scheduledStart);
          return {
            ...task,
            scheduledDate: newDate || task.scheduledDate,
            scheduledStart: newStart,
            scheduledEnd: addMinutes(newStart, duration),
            updatedAt: now,
          };
        }
        if (!records) return task;
        const idx = records.findIndex((r) => r.id === recordId);
        if (idx === -1) return task;
        const updated = [...records];
        const oldEnd = updated[idx].scheduledEnd;
        const oldStart = updated[idx].scheduledStart;
        const duration = timeToMinutes(oldEnd) - timeToMinutes(oldStart);
        const newEnd = minutesToTime(timeToMinutes(newStart) + duration);
        updated[idx] = {
          ...updated[idx],
          scheduledStart: newStart,
          scheduledEnd: newEnd,
          scheduledDate: newDate || updated[idx].scheduledDate,
        };
        return { ...task, timelineRecords: updated, updatedAt: now };
      }),
    });
  }

  function moveEventOccurrence(occurrenceId: string, newStart: string, newDate?: string) {
    if (!data) return;
    const event = resolveOwningEvent(occurrenceId);
    if (!event) return;
    const sourceStart = event.startTime || "09:00";
    const sourceEnd = event.endTime || addMinutes(sourceStart, event.recurrence?.durationMinutes || 60);
    const duration = Math.max(timeToMinutes(sourceEnd) - timeToMinutes(sourceStart), SLOT_MINUTES);
    const date = newDate || event.startDate || event.date;
    const nextEnd = addMinutes(newStart, duration);
    void saveData({
      ...data,
      events: data.events.map((item) => item.id === event.id ? {
        ...item,
        date,
        startDate: date,
        endDate: date,
        startTime: newStart,
        endTime: nextEnd,
        recurrence: item.recurrence ? {
          ...item.recurrence,
          mode: "scheduled",
          startDate: date,
          startTime: newStart,
          durationMinutes: duration,
        } : item.recurrence,
      } : item),
    });
  }

  function makeEventAllDay(occurrenceId: string, targetDate: string) {
    if (!data) return;
    const event = resolveOwningEvent(occurrenceId);
    if (!event) return;
    void saveData({
      ...data,
      events: data.events.map((item) => item.id === event.id ? {
        ...item,
        date: targetDate,
        startDate: targetDate,
        endDate: targetDate,
        startTime: undefined,
        endTime: undefined,
        recurrence: item.recurrence ? {
          ...item.recurrence,
          mode: "flexible",
          startDate: targetDate,
          startTime: undefined,
          durationMinutes: undefined,
        } : item.recurrence,
      } : item),
    });
  }

  function resizeEventOccurrence(occurrenceId: string, nextStart: string, nextEnd: string) {
    if (!data) return;
    const event = resolveOwningEvent(occurrenceId);
    if (!event) return;
    const duration = Math.max(timeToMinutes(nextEnd) - timeToMinutes(nextStart), SLOT_MINUTES);
    void saveData({
      ...data,
      events: data.events.map((item) => item.id === event.id ? {
        ...item,
        startTime: nextStart,
        endTime: nextEnd,
        recurrence: item.recurrence ? {
          ...item.recurrence,
          mode: "scheduled",
          startTime: nextStart,
          durationMinutes: duration,
        } : item.recurrence,
      } : item),
    });
    showToast(t(lang, "toast.durationAdjusted"));
  }

  function beginBlockDrag(event: React.MouseEvent, task: Task) {
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    const isEvent = isEventDisplayTask(task);
    if (!isEvent && hasRecurringRule(resolveOwningTask(task) || task)) return;
    const target = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const duration = taskDuration(task);
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetPx = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const offsetMinutes = Math.min(Math.max(Math.round((offsetPx / SLOT_HEIGHT) * SLOT_MINUTES), 0), Math.max(duration - SLOT_MINUTES, 0));
    let active = false;
    suppressBlockClickRef.current = false;
    const move = (moveEvent: MouseEvent) => {
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!active && distance < 5) return;
      if (!active) {
        moveEvent.preventDefault();
        active = true;
        target.classList.add("is-dragging");
        suppressBlockClickRef.current = true;
        setDragCreate(null);
        setDrag({ taskId: task.id, kind: "block", duration, offsetMinutes, pointer: { x: moveEvent.clientX, y: moveEvent.clientY }, outsideTimeline: pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY) });
      }
      const outsideTimeline = pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY);
      setDrag((current) => current && current.taskId === task.id ? { ...current, pointer: { x: moveEvent.clientX, y: moveEvent.clientY }, outsideTimeline } : current);
      if (!outsideTimeline) {
        const { gridEl, scrollEl, visDays } = getDropGridAndDays();
        if (gridEl && scrollEl) {
          const target = getDropTargetFromPointer({
            clientX: moveEvent.clientX,
            clientY: moveEvent.clientY,
            gridElement: gridEl,
            scrollElement: scrollEl,
            visibleDays: visDays,
            debugLabel: `block-move-${timelineView}`,
          });
          const adjustedTime = minutesToTime(clampSlot(timeToMinutes(target.startTime) - offsetMinutes));
          dragTargetDateRef.current = target.date;
          setHoverSlot(adjustedTime);
        }
      } else {
        setHoverSlot("");
        dragTargetDateRef.current = "";
      }
    };
    const up = (upEvent: MouseEvent) => {
      if (active) {
        // Check if dropped on all-day bar first
        const alldayEl = document.querySelector<HTMLElement>(".df-timeline-allday, .df-timeline-3day-allday");
        if (alldayEl) {
          const alldayRect = alldayEl.getBoundingClientRect();
          const pad = 6;
          if (upEvent.clientX >= alldayRect.left - pad && upEvent.clientX <= alldayRect.right + pad && upEvent.clientY >= alldayRect.top - pad && upEvent.clientY <= alldayRect.bottom + pad) {
            let targetDate = timelineDate;
            if (timelineView === "3day" || timelineView === "weekly") {
              const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
              const datesEl = alldayEl.querySelector(".df-timeline-3day-dates");
              if (datesEl) {
                const datesRect = datesEl.getBoundingClientRect();
                const x = upEvent.clientX - datesRect.left;
                const colW = datesRect.width / threeDates.length;
                const di = Math.min(Math.max(Math.floor(x / colW), 0), threeDates.length - 1);
                targetDate = threeDates[di];
              }
            }
            if (isEvent) {
              makeEventAllDay(task.id, targetDate);
            } else {
              makeAllDay(task.id, targetDate);
            }
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            setDrag(null);
            setHoverSlot("");
            dragTargetDateRef.current = "";
            target.classList.remove("is-dragging");
            window.setTimeout(() => { suppressBlockClickRef.current = false; }, 0);
            return;
          }
        }
        const leftPanel = document.querySelector(".df-candidate-panel")?.getBoundingClientRect();
        const droppedOnCandidatePanel = Boolean(leftPanel && upEvent.clientX >= leftPanel.left && upEvent.clientX <= leftPanel.right && upEvent.clientY >= leftPanel.top && upEvent.clientY <= leftPanel.bottom);
        const droppedOutsideTimeline = pointerOutsideTimeline(upEvent.clientX, upEvent.clientY);
        if (isEvent && droppedOnCandidatePanel) {
          makeEventCandidate(task.id, today);
        } else if (!isEvent && (droppedOnCandidatePanel || droppedOutsideTimeline)) {
          deleteTimelineRecord(task.id);
        } else if (isEvent && droppedOutsideTimeline) {
          // Outside the timeline but not over the candidate shelf: cancel the move.
        } else {
          const { gridEl, scrollEl, visDays } = getDropGridAndDays();
          if (gridEl && scrollEl) {
            const target = getDropTargetFromPointer({
              clientX: upEvent.clientX,
              clientY: upEvent.clientY,
              gridElement: gridEl,
              scrollElement: scrollEl,
              visibleDays: visDays,
              debugLabel: `block-up-${timelineView}`,
            });
            dragTargetDateRef.current = target.date;
            const nextStart = minutesToTime(clampSlot(timeToMinutes(target.startTime) - offsetMinutes));
            if (isEvent) moveEventOccurrence(task.id, nextStart, target.date);
            else moveTimelineRecord(task.id, nextStart, target.date);
          } else {
            const nextStart = slotFromPointer(upEvent.clientY, offsetMinutes);
            if (isEvent) moveEventOccurrence(task.id, nextStart);
            else moveTimelineRecord(task.id, nextStart);
          }
        }
      }
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setDrag(null);
      setHoverSlot("");
      dragTargetDateRef.current = "";
      target.classList.remove("is-dragging");
      window.setTimeout(() => {
        suppressBlockClickRef.current = false;
      }, 0);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function beginBlockResize(event: React.MouseEvent, task: Task, edge: "start" | "end") {
    event.preventDefault();
    event.stopPropagation();
    suppressBlockClickRef.current = true;
    setDragCreate(null);
    document.body.classList.add("df-resizing");
    setResizePreview({ taskId: task.id, start: task.scheduledStart || "09:00", end: task.scheduledEnd || addMinutes(task.scheduledStart || "09:00", taskDuration(task)) });
    const move = (moveEvent: MouseEvent) => {
      const slot = slotFromPointer(moveEvent.clientY);
      const slotMin = timeToMinutes(slot);
      const start = timeToMinutes(task.scheduledStart);
      const end = timeToMinutes(task.scheduledEnd);
      if (edge === "start") {
        const nextStart = Math.min(slotMin, end - SLOT_MINUTES);
        setResizePreview({ taskId: task.id, start: minutesToTime(nextStart), end: task.scheduledEnd || minutesToTime(end) });
      } else {
        const nextEnd = Math.max(slotMin, start + SLOT_MINUTES);
        setResizePreview({ taskId: task.id, start: task.scheduledStart || minutesToTime(start), end: minutesToTime(nextEnd) });
      }
    };
    const up = (upEvent: MouseEvent) => {
      if (!data) return;
      const slot = slotFromPointer(upEvent.clientY);
      const slotMin = timeToMinutes(slot);
      const start = timeToMinutes(task.scheduledStart);
      const end = timeToMinutes(task.scheduledEnd);
      const now = new Date().toISOString();
      let nextData = data;
      if (isEventDisplayTask(task)) {
        if (edge === "start") {
          const nextStart = minutesToTime(Math.min(slotMin, end - SLOT_MINUTES));
          const nextEnd = task.scheduledEnd || minutesToTime(end);
          resizeEventOccurrence(task.id, nextStart, nextEnd);
        } else {
          const nextStart = task.scheduledStart || minutesToTime(start);
          const nextEnd = minutesToTime(Math.max(slotMin, start + SLOT_MINUTES));
          resizeEventOccurrence(task.id, nextStart, nextEnd);
        }
        setResizePreview(null);
        document.body.classList.remove("df-resizing");
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        window.setTimeout(() => {
          suppressBlockClickRef.current = false;
        }, 0);
        return;
      }
      if (edge === "start") {
        const nextStart = minutesToTime(Math.min(slotMin, end - SLOT_MINUTES));
        const nextEnd = task.scheduledEnd || minutesToTime(end);
        nextData = {
          ...data,
          tasks: data.tasks.map((t) => {
            const records = t.timelineRecords;
            if ((!records || records.length === 0) && t.id === task.id) {
              return { ...t, scheduledStart: nextStart, estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60, updatedAt: now };
            }
            if (!records) return t;
            const idx = records.findIndex((r) => r.id === task.id);
            if (idx === -1) return t;
            const updated = [...records];
            updated[idx] = { ...updated[idx], scheduledStart: nextStart };
            return { ...t, timelineRecords: updated, updatedAt: now };
          }),
        };
        const realTask = recordToTaskMap.get(task.id);
        if (realTask) nextData = { ...nextData, tasks: nextData.tasks.map((t) => t.id === realTask.id ? { ...t, estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60 } : t) };
        showToast(t(lang, "toast.durationAdjusted"));
      } else {
        const nextStart = task.scheduledStart || minutesToTime(start);
        const nextEnd = minutesToTime(Math.max(slotMin, start + SLOT_MINUTES));
        nextData = {
          ...data,
          tasks: data.tasks.map((t) => {
            const records = t.timelineRecords;
            if ((!records || records.length === 0) && t.id === task.id) {
              return { ...t, scheduledEnd: nextEnd, estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60, updatedAt: now };
            }
            if (!records) return t;
            const idx = records.findIndex((r) => r.id === task.id);
            if (idx === -1) return t;
            const updated = [...records];
            updated[idx] = { ...updated[idx], scheduledEnd: nextEnd };
            return { ...t, timelineRecords: updated, updatedAt: now };
          }),
        };
        const realTask2 = recordToTaskMap.get(task.id);
        if (realTask2) nextData = { ...nextData, tasks: nextData.tasks.map((t) => t.id === realTask2.id ? { ...t, estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60 } : t) };
        showToast(t(lang, "toast.durationAdjusted"));
      }
      // Direct setData for immediate visual update, saveData for persistence
      dataRef.current = nextData;
      setData(nextData);
      saveData(nextData);
      setResizePreview(null);
      document.body.classList.remove("df-resizing");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.setTimeout(() => {
        suppressBlockClickRef.current = false;
      }, 0);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function openAdd(type: AddType = "task") {
    setAddType(type);
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setForm(defaultForm(type));
    setDrawerOpen(true);
  }

  function openTaskEdit(task: Task) {
    const event = occurrenceToEventMap.get(task.id) || events.find((item) => task.id.startsWith(`event_occ_${item.id}_`));
    if (event) {
      openEventEdit(event);
      return;
    }
    const realTask = resolveOwningTask(task) || task;
    const recordId = recordByIdMap.has(task.id) ? task.id : undefined;
    const occurrence = parseRecurrenceOccurrenceId(task.id);
    setAddType("task");
    setEditingId(realTask.id);
    setEditingRecordId(recordId);
    setEditingOccurrence(occurrence ? {
      taskId: occurrence.taskId,
      scheduledDate: occurrence.scheduledDate,
      scheduledStart: occurrence.scheduledStart,
    } : null);
    setForm({
      title: realTask.title,
      projectId: realTask.projectId || "",
      projectColor: "#C69CF9",
      dueDate: task.scheduledDate || realTask.dueDate || today,
      dueTime: task.scheduledStart || "",
      endDate: task.scheduledDate || realTask.dueDate || today,
      endTime: task.scheduledEnd || "",
      category: realTask.category,
      priority: realTask.priority,
      importance: realTask.importance || realTask.priority,
      urgency: realTask.urgency || "low",
      estimatedHours: realTask.estimatedHours || 0.5,
      details: realTask.notes || ""
    });
    setDrawerOpen(true);
  }

  function openProjectEdit(project: Project) {
    setAddType("project");
    setEditingId(project.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setForm({ ...defaultForm("project"), title: project.title, category: project.category, projectColor: project.color || categories[project.category].color, details: project.notes, importance: project.importance || "high", urgency: project.urgency || "low" });
    setDrawerOpen(true);
  }

  function openEventEdit(event: CalendarEvent) {
    setAddType("event");
    setEditingId(event.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setForm({ ...defaultForm("event"), title: event.title, dueDate: event.startDate || event.date, endDate: event.endDate || event.date, dueTime: event.startTime || "", endTime: event.endTime || "", category: event.category, details: event.details, recurrence: event.recurrence });
    setDrawerOpen(true);
  }

  function saveForm() {
    if (!data || !form.title.trim()) return;
    const now = new Date().toISOString();
    const buildUpdatedTask = (task: Task) => ({
      ...task,
      title: form.title.trim(),
      dueDate: form.dueDate,
      category: form.category,
      priority: form.priority,
      projectId: form.projectId || undefined,
      estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
      importance: form.importance,
      urgency: form.urgency,
      notes: form.details,
      updatedAt: now,
    });
    if (editingId) {
      if (addType === "task") {
        void saveData({
          ...data,
          tasks: data.tasks.map((task) => task.id === editingId ? buildUpdatedTask(task) : task)
        });
      } else if (addType === "project") {
        void saveData({ ...data, projects: data.projects.map((project) => project.id === editingId ? { ...project, title: form.title.trim(), category: form.category, color: form.projectColor || categories[form.category].color, notes: form.details, importance: form.importance, urgency: form.urgency, updatedAt: now } : project) });
      } else {
        void saveData({ ...data, events: data.events.map((event) => event.id === editingId ? { ...event, title: form.title.trim(), date: form.dueDate, startDate: form.dueDate, endDate: form.endDate || form.dueDate, startTime: form.dueTime, endTime: form.endTime, category: form.category, details: form.details, recurrence: form.recurrence } : event) });
      }
    } else if (addType === "task") {
      const task = makeTask(form);
      const durationMinutes = form.dueTime
        ? Math.max(
            form.endTime ? timeToMinutes(form.endTime) - timeToMinutes(form.dueTime) : Math.round((form.estimatedHours || 0.5) * 60),
            SLOT_MINUTES,
          )
        : 0;
      const createdTask = mode === "planning"
        ? { ...task, plannedForDate: undefined, executionLane: undefined }
        : form.dueTime
          ? { ...task, plannedForDate: form.dueDate, executionLane: undefined, timelineRecords: [createScheduledRecord(task, form.dueDate || today, form.dueTime, durationMinutes)] }
          : task;
      void saveData({ ...data, tasks: [...data.tasks, createdTask] });
    } else if (addType === "project") {
      void saveData({ ...data, projects: [...data.projects, makeProject(form)] });
    } else {
      void saveData({ ...data, events: [...data.events, makeEvent(form)] });
    }
    setEditingId("");
    setEditingRecordId(undefined);
    setForm(defaultForm("task"));
    setAddType("task");
    setDrawerOpen(false);
  }

  function closeTaskDrawer(options?: { autoSave?: boolean }) {
    const autoSave = options?.autoSave ?? false;
    if (autoSave && data && editingId && addType === "task") {
      const now = new Date().toISOString();
      const currentTask = data.tasks.find((task) => task.id === editingId);
      if (currentTask) {
        const safeTitle = form.title.trim() || currentTask.title;
        void saveData({
          ...data,
          tasks: data.tasks.map((task) => task.id === editingId ? {
            ...task,
            title: safeTitle,
            dueDate: form.dueDate,
            category: form.category,
            priority: form.priority,
            projectId: form.projectId || undefined,
            estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
            importance: form.importance,
            urgency: form.urgency,
            notes: form.details,
            updatedAt: now,
          } : task),
        });
      }
    }
    setDrawerOpen(false);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setEditingId("");
    setForm(defaultForm("task"));
    setAddType("task");
  }

  function deleteEditingItem() {
    if (!data || !editingId) return;
    if (addType === "task") void saveData({ ...data, tasks: data.tasks.filter((task) => task.id !== editingId) });
    if (addType === "project") void saveData({ ...data, projects: data.projects.filter((project) => project.id !== editingId) });
    if (addType === "event") void saveData({ ...data, events: data.events.filter((event) => event.id !== editingId) });
    closeTaskDrawer();
  }

  function copyEditingTask() {
    if (!data || !editingId) return;
    const task = data.tasks.find((item) => item.id === editingId);
    if (!task) return;
    const now = new Date().toISOString();
    const title = form.title.trim() || task.title;
    void saveData({
      ...data,
      tasks: [...data.tasks, {
        ...task,
        id: uid("task"),
        title,
        completed: false,
        recurrence: undefined,
        timelineRecords: [],
        executionStatus: undefined,
        plannedForDate: today,
        executionLane: "candidate",
        scheduledDate: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        dueDate: today,
        projectId: form.projectId || undefined,
        category: form.category,
        priority: form.priority,
        importance: form.importance,
        urgency: form.urgency,
        estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
        notes: form.details,
        createdAt: now,
        updatedAt: now
      }]
    });
    showToast(t(lang, "toast.taskDuplicated"));
  }

  function convertTaskToEvent(taskId: string) {
    if (!data) return;
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (!window.confirm(t(lang, "confirm.convertTaskToEvent"))) return;
    const now = new Date().toISOString();
    const activeRecord = editingRecordId
      ? (task.timelineRecords || []).find((record) => record.id === editingRecordId)
      : undefined;
    const sourceTask: Task = editingId === task.id
      ? {
          ...task,
          title: form.title.trim() || task.title,
          dueDate: form.dueDate || task.dueDate,
          category: form.category,
          priority: form.priority,
          notes: form.details,
          recurrence: form.recurrence || task.recurrence,
          estimatedHours: Math.max(form.estimatedHours || task.estimatedHours || 0.25, 0.25),
          updatedAt: now,
        }
      : task;
    const event = buildEventFromTask(sourceTask, activeRecord);
    void saveData({
      ...data,
      tasks: data.tasks.filter((item) => item.id !== task.id),
      events: [...data.events, event],
    });
    setEditingId(event.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setAddType("event");
    setForm({ ...defaultForm("event"), title: event.title, dueDate: event.startDate || event.date, endDate: event.endDate || event.date, dueTime: event.startTime || "", endTime: event.endTime || "", category: event.category, details: event.details, recurrence: event.recurrence });
    showToast(t(lang, "toast.convertedToEvent"));
  }

  function convertEventToTask(eventId: string) {
    if (!data) return;
    const event = data.events.find((item) => item.id === eventId);
    if (!event) return;
    if (!window.confirm(t(lang, "confirm.convertEventToTask"))) return;
    const sourceEvent: CalendarEvent = editingId === event.id
      ? {
          ...event,
          title: form.title.trim() || event.title,
          date: form.dueDate || event.date,
          startDate: form.dueDate || event.startDate || event.date,
          endDate: form.endDate || form.dueDate || event.endDate || event.date,
          startTime: form.dueTime || undefined,
          endTime: form.endTime || undefined,
          category: form.category,
          details: form.details,
          recurrence: form.recurrence,
        }
      : event;
    const task = buildTaskFromEvent(sourceEvent);
    void saveData({
      ...data,
      events: data.events.filter((item) => item.id !== event.id),
      tasks: [...data.tasks, task],
    });
    setEditingId(task.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setAddType("task");
    setForm({
      title: task.title,
      projectId: "",
      projectColor: "#C69CF9",
      dueDate: task.dueDate,
      dueTime: task.scheduledStart || "",
      endDate: task.dueDate,
      endTime: task.scheduledEnd || "",
      category: task.category,
      priority: task.priority,
      importance: task.importance || task.priority,
      urgency: task.urgency || "low",
      estimatedHours: task.estimatedHours || 0.5,
      details: task.notes || "",
      recurrence: task.recurrence,
    });
    showToast(t(lang, "toast.convertedToTask"));
  }

  function askAi(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setReferencedTaskId(task.id);
    setAiInput(`请帮我明确「${task.title}」的下一步行动。`);
    setAiOpen(true);
  }

  async function sendAi() {
    if (!aiInput.trim() && !aiAttachment) return;
    const task = tasks.find((item) => item.id === referencedTaskId);
    const msg = aiInput.trim() || "解析附件中的任务和事件";
    const attachmentSnapshot: AiAttachmentSnapshot | undefined = aiAttachment ? {
      name: aiAttachment.name,
      size: aiAttachment.size,
      pageCount: aiAttachment.pageCount,
      truncated: aiAttachment.truncated,
      status: "ready",
      statusText: aiAttachmentStatus,
      summary: aiAttachment.text.slice(0, 180).replace(/\s+/g, " ").trim(),
    } : undefined;
    const userMessage: AiSessionMessage = { id: uid("ai_user"), role: "user", content: msg, attachment: attachmentSnapshot, createdAt: new Date().toISOString() };
    const assistantId = uid("ai_assistant");
    const assistantMessage: AiSessionMessage = {
      id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString(), status: "thinking",
      steps: [{ label: aiAttachment ? "正在读取引用文件..." : "正在分析你的请求...", status: "running" }],
    };
    setAiMessages((current) => [...current, userMessage, assistantMessage]);
    setAiInput("");
    setAiBusy(true);
    clearAiAttachment();

    // Build rich context for the AI
    const scheduledToday = tasks.filter((t) => t.scheduledDate === today && t.scheduledStart);
    const context: Record<string, unknown> = {
      currentViewDate: today,
      page: "execute",
      projects: projects.map((p) => ({ id: p.id, title: p.title, color: p.color })),
      scheduledToday: scheduledToday.map((t) => ({ title: t.title, start: t.scheduledStart, end: t.scheduledEnd, projectId: t.projectId })),
    };
    if (task) {
      context.taskId = task.id;
      context.taskTitle = task.title;
    }

    try {
      const { callAiAssistant } = await import("./aiAssistantApi");
      const result = await callAiAssistant({
        mode: attachmentSnapshot ? "import_schedule" : "chat",
        message: aiAttachment ? `${msg}\n\n附件：${aiAttachment.name}\n\n${aiAttachment.text}` : msg,
        context,
      });
      const validActions = (result.actions || []).filter(isValidAiAction);
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        status: "done",
        content: result.reply,
        steps: result.steps && result.steps.length > 0 ? result.steps : [{ label: "已生成安排", status: "done" }],
        actions: validActions,
        selectedActions: Object.fromEntries(validActions.map((_, index) => [index, true])),
        actionState: validActions.length ? "pending" : undefined,
      } : message));
    } catch (error) {
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        status: "error",
        content: error instanceof Error ? error.message : "网络异常，请稍后重试。",
        steps: [{ label: "请求失败", status: "error" }],
      } : message));
    } finally {
      setAiBusy(false);
    }
  }

  async function handleAiAttachment(file: File) {
    setAiAttachmentStatus("正在本地解析文件...");
    try {
      const { parseAttachment } = await import("./fileParser");
      const parsed = await parseAttachment(file);
      setAiAttachment(parsed);
      setAiAttachmentStatus(parsed.truncated ? "文本已提取，超过 60,000 字符的部分已截断" : "文本已提取，仅文本会发送给 AI");
    } catch (error) {
      setAiAttachmentStatus(error instanceof Error ? error.message : "文件解析失败");
    }
  }

  function clearAiAttachment() {
    setAiAttachment(null);
    setAiAttachmentStatus("");
  }

  async function adoptSelectedAiActions(messageId: string) {
    if (!data) return;
    const message = aiMessages.find((item) => item.id === messageId);
    const selected = (message?.actions || []).filter((_, index) => message?.selectedActions?.[index] !== false);
    if (selected.length === 0) return;
    const now = new Date().toISOString();
    const nextTasks = [...data.tasks];
    const nextEvents = [...data.events];
    const addedTaskIds: string[] = [];
    const addedEventIds: string[] = [];
    const previousTasks: Task[] = [];
    let focus: TimelineFocusTarget | undefined;
    for (const action of selected) {
      if (action.type === "import_schedule_item" && action.title && action.date) {
        const a = action as Record<string, any>;
        if (a.kind === "event") {
          const eventId = uid("event");
          nextEvents.push({
            id: eventId, title: action.title, date: a.date, startDate: a.date, endDate: a.endDate || a.date,
            startTime: a.startTime || "", endTime: a.endTime || "", category: validCategory(a.category),
            details: a.notes || "", recurrence: normalizeAiRecurrence(a.recurrence, a.date, a.startTime, a.durationMinutes),
            imported: true, createdAt: now,
          });
          addedEventIds.push(eventId);
          focus ||= { date: a.date, startTime: a.startTime || "09:00", source: "schedule" };
        } else {
          const recurrence = normalizeAiRecurrence(a.recurrence, a.date, a.startTime, a.durationMinutes);
          const duration = Number(a.durationMinutes) || (a.startTime && a.endTime ? timeToMinutes(a.endTime) - timeToMinutes(a.startTime) : 60);
          const task: Task = {
            id: uid("task"), title: action.title, dueDate: a.date, category: validCategory(a.category),
            priority: validPriority(a.priority), notes: a.notes || "", goalId: "goal_admission", completed: false,
            projectId: projects.some((project) => project.id === a.projectId) ? a.projectId : undefined,
            estimatedHours: Math.max(duration, 15) / 60, recurrence, subtasks: [], createdAt: now, updatedAt: now,
          };
          if (!recurrence && a.startTime) task.timelineRecords = [createScheduledRecord(task, a.date, a.startTime, Math.max(duration, 15))];
          nextTasks.push(task);
          addedTaskIds.push(task.id);
          if (a.startTime || recurrence?.startTime) focus ||= { date: a.date, startTime: a.startTime || recurrence?.startTime, taskId: task.id, source: "schedule" };
        }
        continue;
      }
      if ((action.type === "create_scheduled_task" || action.type === "create_task") && action.title) {
        const a = action as Record<string, any>;
        const duration = Math.max(Number(a.durationMinutes) || 60, 15);
        const startTime = a.start || "09:00";
        const date = a.date || today;
        const task: Task = {
          id: uid("ai"), title: action.title, dueDate: date, category: "personal", priority: "medium",
          importance: "medium", urgency: "medium", notes: a.reason || "", goalId: "", completed: false,
          projectId: projects.some((project) => project.id === a.projectId) ? a.projectId : undefined,
          estimatedHours: duration / 60, scheduledDate: date, scheduledStart: startTime,
          scheduledEnd: a.end || addMinutes(startTime, duration), subtasks: [], order: Date.now(),
          createdAt: now, updatedAt: now,
        };
        nextTasks.push(task);
        addedTaskIds.push(task.id);
        focus ||= { date, startTime, taskId: task.id, source: "schedule" };
        continue;
      }
      if (action.type === "schedule_task" && action.taskId && action.date) {
        const a = action as Record<string, any>;
        const index = nextTasks.findIndex((task) => task.id === action.taskId);
        if (index !== -1) {
          if (!previousTasks.some((task) => task.id === nextTasks[index].id)) previousTasks.push(nextTasks[index]);
          nextTasks[index] = { ...nextTasks[index], scheduledDate: action.date, scheduledStart: a.start || nextTasks[index].scheduledStart, scheduledEnd: a.end || nextTasks[index].scheduledEnd };
          focus ||= { date: action.date, startTime: a.start || nextTasks[index].scheduledStart, taskId: action.taskId, source: "schedule" };
        }
      }
    }
    await saveData({ ...data, tasks: nextTasks, events: nextEvents });
    setAiMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionState: "adopted", actions: [], importCommit: { focus, addedCount: selected.length, addedTaskIds, addedEventIds, previousTasks } } : item));
  }

  function rejectSelectedAiActions(messageId: string) {
    setAiMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionState: "rejected", actions: [] } : item));
  }

  function viewAiImport(messageId: string) {
    const commit = aiMessages.find((message) => message.id === messageId)?.importCommit;
    if (!commit?.focus) return;
    setModeState("execute");
    setTimelineView("daily");
    requestTimelineFocus(commit.focus);
    setAiOpen(false);
  }

  async function undoAiImport(messageId: string) {
    const commit = aiMessages.find((message) => message.id === messageId)?.importCommit;
    const currentData = dataRef.current;
    if (!commit || !currentData) return;
    const previousById = new Map(commit.previousTasks.map((task) => [task.id, task]));
    await saveData({
      ...currentData,
      tasks: currentData.tasks.filter((task) => !commit.addedTaskIds.includes(task.id)).map((task) => previousById.get(task.id) || task),
      events: currentData.events.filter((event) => !commit.addedEventIds.includes(event.id)),
    });
    setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, actionState: "undone", importCommit: undefined } : message));
  }

  async function confirmAiAction(action: AiAction, messageId?: string) {
    if (!data) return;
    if (action.type === "import_schedule_item" && action.title && action.date) {
      const a = action as Record<string, any>;
      const now = new Date().toISOString();
      if (a.kind === "event") {
        const event: CalendarEvent = {
          id: uid("event"),
          title: action.title,
          date: a.date,
          startDate: a.date,
          endDate: a.endDate || a.date,
          startTime: a.startTime || "",
          endTime: a.endTime || "",
          category: validCategory(a.category),
          details: a.notes || "",
          recurrence: normalizeAiRecurrence(a.recurrence, a.date, a.startTime, a.durationMinutes),
          imported: true,
          createdAt: now,
        };
        await saveData({ ...data, events: [...data.events, event] });
      } else {
        const recurrence = normalizeAiRecurrence(a.recurrence, a.date, a.startTime, a.durationMinutes);
        const duration = Number(a.durationMinutes) || (a.startTime && a.endTime ? timeToMinutes(a.endTime) - timeToMinutes(a.startTime) : 60);
        const task: Task = {
          id: uid("task"), title: action.title, dueDate: a.date, category: validCategory(a.category),
          priority: validPriority(a.priority), notes: a.notes || "", goalId: "goal_admission", completed: false,
          projectId: projects.some((project) => project.id === a.projectId) ? a.projectId : undefined,
          estimatedHours: Math.max(duration, 15) / 60, recurrence, subtasks: [], createdAt: now, updatedAt: now,
        };
        if (!recurrence && a.startTime) task.timelineRecords = [createScheduledRecord(task, a.date, a.startTime, Math.max(duration, 15))];
        await saveData({ ...data, tasks: [...data.tasks, task] });
      }
      if (messageId) removeAiMessageAction(messageId, action);
      return;
    }
    // Handle create_scheduled_task (TrevorAI-style) and create_task as the same flow
    if ((action.type === "create_scheduled_task" || action.type === "create_task") && action.title) {
      const a = action as Record<string, unknown>;
      const dur = (a.durationMinutes as number) || 60;
      const startTime = (a.start as string) || "09:00";
      const endTime = (a.end as string) || addMinutes(startTime, dur);
      const newTask: Task = {
        id: `ai_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
        title: action.title,
        category: "personal",
        priority: "medium",
        importance: "medium",
        urgency: "medium",
        notes: (a.reason as string) || "",
        goalId: "",
        completed: false,
        projectId: (a.projectId as string) || undefined,
        dueDate: (a.date as string) || today,
        estimatedHours: dur / 60,
        scheduledDate: (a.date as string) || today,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        subtasks: [],
        order: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Task;
      const updatedTasks = [...tasks, newTask];
      await saveData({ ...data, version: data.version || 1, tasks: updatedTasks });
      showUndoToast(`${t(lang, "toast.created").replace("%TITLE%", action.title)}`, t(lang, "toast.undo"), () => {
        void saveData({ ...data, version: data.version || 1, tasks });
      });
      // Mark action as accepted
      if (messageId) removeAiMessageAction(messageId, action);
      return;
    }
    if (action.type === "schedule_task" && action.taskId && action.date) {
      const a = action as Record<string, unknown>;
      const updatedTasks = tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, scheduledDate: action.date, scheduledStart: (a.start as string) || t.scheduledStart, scheduledEnd: (a.end as string) || t.scheduledEnd }
          : t
      );
      await saveData({ ...data, version: data.version || 1, tasks: updatedTasks });
      showUndoToast(`${t(lang, "toast.scheduledToDate").replace("%DATE%", action.date)}`, t(lang, "toast.undo"), () => {
        void saveData({ ...data, version: data.version || 1, tasks });
      });
    }
    // Dismiss the action card
    if (messageId) removeAiMessageAction(messageId, action);
  }

  function removeAiMessageAction(messageId: string, action: AiAction) {
    setAiMessages((current) => current.map((message) => message.id === messageId
      ? { ...message, actions: (message.actions || []).filter((item) => item !== action) }
      : message));
  }

  function dismissAiAction(action: AiAction, messageId: string) {
    removeAiMessageAction(messageId, action);
  }

  async function generateNextAction() {
    const task = editingId ? tasks.find((item) => item.id === editingId) : null;
    try {
      const { callAiAssistant } = await import("./aiAssistantApi");
      const result = await callAiAssistant({
        mode: "parse_task",
        message: t(lang, "toast.clarifyPrompt"),
        context: { title: form.title, project: projects.find((project) => project.id === form.projectId)?.title, date: form.dueDate, estimatedHours: form.estimatedHours, notes: form.details, subtasks: task?.subtasks || [] },
      });
      const nextAction = result.reply || t(lang, "toast.clarifyHintGeneric");
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, nextAction) }));
    } catch {
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, `${t(lang, "toast.clarifyHint").replace("%TITLE%", current.title)}`) }));
    }
  }

  async function planMyDay() {
    if (autoScheduleState === "generating" || autoScheduleState === "committing") return;

    const sourceTasks = aiPlanPrefs.source === "all"
      ? tasks.filter((t) => !t.completed && getExecutionLane(t) !== "queued" && !(t.timelineRecords || []).some((r) => r.executionStatus === "scheduled") && !t.scheduledDate && !hasRecurrenceOccurrenceOnDate(t, today))
      : todayCandidates;
    if (sourceTasks.length === 0) {
      alert(aiPlanPrefs.source === "all" ? t(lang, "toast.noTaskToSchedule") : t(lang, "toast.noCandidateYet"));
      return;
    }
    setSchedulePreviews([]);
    setAutoScheduleState("generating");
    setSelectedDate(today);

    const dateRange = aiPlanPrefs.scope === "3day"
      ? [today, addDays(today, 1), addDays(today, 2)]
      : [today];

    const existingEvents = getScheduledEventsForRange(dateRange);

    const tasksForSchedule = sourceTasks.map((t) => ({
      id: t.id, title: t.title,
      priority: (t.priority || "medium") as "high" | "medium" | "low",
      estimatedMinutes: t.estimatedHours ? Math.round(t.estimatedHours * 60) : undefined,
      dueDate: t.dueDate, projectId: t.projectId, completed: t.completed,
      scheduledDate: t.scheduledDate, scheduledStart: t.scheduledStart, scheduledEnd: t.scheduledEnd,
    }));

    tasksForSchedule.sort((a, b) => (b.estimatedMinutes || 30) - (a.estimatedMinutes || 30));
    if (aiPlanPrefs.strategy === "random") {
      for (let i = tasksForSchedule.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tasksForSchedule[i], tasksForSchedule[j]] = [tasksForSchedule[j], tasksForSchedule[i]];
      }
    } else if (aiPlanPrefs.strategy === "byProject") {
      tasksForSchedule.sort((a, b) => (a.projectId || "").localeCompare(b.projectId || ""));
    } else if (aiPlanPrefs.strategy === "longShort") {
      const sorted = [...tasksForSchedule].sort((a, b) => (b.estimatedMinutes || 30) - (a.estimatedMinutes || 30));
      const result: typeof tasksForSchedule = [];
      let l = 0, r = sorted.length - 1;
      while (l <= r) {
        if (l <= r) result.push(sorted[l++]);
        if (l <= r) result.push(sorted[r--]);
      }
      tasksForSchedule.length = 0;
      tasksForSchedule.push(...result);
    } else if (aiPlanPrefs.strategy === "alternativeProject") {
      const byProject = new Map<string, typeof tasksForSchedule>();
      tasksForSchedule.forEach((t) => {
        const key = t.projectId || "__none__";
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key)!.push(t);
      });
      tasksForSchedule.length = 0;
      const keys = [...byProject.keys()];
      let idx = 0;
      while (tasksForSchedule.length < sourceTasks.length) {
        const key = keys[idx % keys.length];
        const group = byProject.get(key);
        if (group && group.length > 0) tasksForSchedule.push(group.shift()!);
        idx++;
      }
    }

    const result = autoScheduleTasks({
      tasks: tasksForSchedule,
      scheduledEvents: existingEvents,
      dateRange,
    });

    // One task = one preview block. NO splitting.
    const previews: SchedulePreview[] = result.proposedEvents.map((ev) => {
      const source = tasks.find((t) => t.id === ev.taskId);
      return {
        id: ev.id,
        sourceTaskId: ev.taskId,
        clonedTaskId: ev.clonedTaskId,
        title: source?.title || ev.title,
        projectId: ev.projectId,
        scheduledDate: ev.scheduledDate,
        scheduledStart: ev.scheduledStart,
        scheduledEnd: ev.scheduledEnd,
        durationMinutes: ev.durationMinutes,
        priority: ev.priority,
        reason: ev.reason,
      };
    });

    setSchedulePreviews(previews);
    setAutoScheduleState(previews.length > 0 ? "preview" : "idle");
    if (previews.length === 0 && result.unscheduledTasks.length > 0) {
      showToast(`${t(lang, "toast.noContinuousSlot").replace("%COUNT%", String(result.unscheduledTasks.length))}`);
    }
  }

  /**
   * Cancel all auto-schedule previews. Does NOT touch real data.
   */
  function cancelAutoSchedule() {
    setSchedulePreviews([]);
    setAutoScheduleState("idle");
    dismissToast();
  }

  /**
   * Cancel a single preview by id. Does NOT touch real data.
   * If the cancelled preview is the last one, return to idle.
   */
  function cancelOnePreview(previewId: string) {
    setSchedulePreviews((current) => {
      const next = current.filter((p) => p.id !== previewId);
      if (next.length === 0) setAutoScheduleState("idle");
      return next;
    });
  }

  /**
   * Pure helper used by both per-preview accept and accept-all. Builds a
   * fully-formed real Task instance — the SAME shape that manual drag-to-timeline
   * produces (it is a NEW task with the source as parentTaskId, NOT a mutation
   * of the source task).
   *
   * Returns: the new task, ready to be appended to data.tasks.
   */
  function buildCommittedTask(p: SchedulePreview, source: Task | undefined, nowIso: string): Task {
    return {
      id: p.clonedTaskId,
      title: source?.title || p.title,
      dueDate: source?.dueDate || p.scheduledDate,
      category: source?.category || "personal",
      priority: p.priority,
      importance: p.priority,
      urgency: p.priority,
      notes: source?.notes || "",
      goalId: source?.goalId || "",
      completed: false,
      projectId: source?.projectId || p.projectId,
      parentTaskId: p.sourceTaskId,
      estimatedHours: p.durationMinutes / 60,
      scheduledDate: p.scheduledDate,
      scheduledStart: p.scheduledStart,
      scheduledEnd: p.scheduledEnd,
      plannedForDate: p.scheduledDate,
      executionLane: undefined,
      order: Date.now(),
      subtasks: source?.subtasks || [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Accept a single preview. Identical to manual-drag behavior:
   * 1. Build a real Task instance (clone of source) with same id as preview
   *    `clonedTaskId`.
   * 2. Append to `tasks`.
   * 3. Remove the source task from 今日候选 (clear plannedForDate).
   * 4. Remove this preview from previews.
   * 5. Show 5-second undo toast.
   */
  function acceptOnePreview(previewId: string) {
    if (!data) return;
    const preview = schedulePreviews.find((p) => p.id === previewId);
    if (!preview) return;
    const source = data.tasks.find((t) => t.id === preview.sourceTaskId);
    const now = new Date().toISOString();

    // If the clonedTaskId already exists (very rare), don't duplicate
    if (data.tasks.some((t) => t.id === preview.clonedTaskId)) {
      setSchedulePreviews((current) => current.filter((p) => p.id !== previewId));
      showToast(t(lang, "toast.adoptedOne"));
      return;
    }

    const newTask = buildCommittedTask(preview, source, now);
    const tasksAfter = data.tasks.map((t) => {
      if (t.id === preview.sourceTaskId && t.plannedForDate) {
        return { ...t, plannedForDate: undefined, executionLane: undefined, updatedAt: now };
      }
      return t;
    });
    tasksAfter.push(newTask);

    undoSnapshotRef.current = {
      committedTaskIds: [preview.clonedTaskId],
      clearedSourceTaskIds: [preview.sourceTaskId],
      removedFromCandidate: new Set([preview.sourceTaskId]),
    };

    void saveData({ ...data, tasks: tasksAfter });
    setSchedulePreviews((current) => {
      const next = current.filter((p) => p.id !== previewId);
      if (next.length === 0) setAutoScheduleState("idle");
      return next;
    });
    requestTimelineFocus({
      date: preview.scheduledDate,
      startTime: preview.scheduledStart,
      taskId: preview.clonedTaskId,
      source: "autoschedule",
    });
    showUndoToast(t(lang, "toast.adoptedOne"), t(lang, "toast.undo"), () => undoLastCommit([preview.clonedTaskId], [preview.sourceTaskId]));
  }

  /**
   * Accept ALL previews. Same per-preview logic but batched:
   * 1. Build all N real task instances in one pass.
   * 2. Append to `tasks` atomically.
   * 3. Remove all source tasks from 今日候选.
   * 4. Clear all previews.
   * 5. Show 5-second undo toast.
   */
  function acceptAllPreviews() {
    if (!data || autoScheduleState === "committing") return;
    const active = schedulePreviews;
    if (active.length === 0) return;
    setAutoScheduleState("committing");

    const now = new Date().toISOString();
    const existingIds = new Set(data.tasks.map((t) => t.id));
    const toAdd: Task[] = [];
    const sourceIdsToClear: string[] = [];
    for (const p of active) {
      if (existingIds.has(p.clonedTaskId)) continue;
      const source = data.tasks.find((t) => t.id === p.sourceTaskId);
      toAdd.push(buildCommittedTask(p, source, now));
      sourceIdsToClear.push(p.sourceTaskId);
    }

    const tasksAfter = data.tasks.map((t) => {
      if (sourceIdsToClear.includes(t.id) && t.plannedForDate) {
        return { ...t, plannedForDate: undefined, executionLane: undefined, updatedAt: now };
      }
      return t;
    });
    tasksAfter.push(...toAdd);

    undoSnapshotRef.current = {
      committedTaskIds: toAdd.map((t) => t.id),
      clearedSourceTaskIds: [...sourceIdsToClear],
      removedFromCandidate: new Set(sourceIdsToClear),
    };

    // DEV invariant check
    if (import.meta.env.DEV) {
      const expectedAdd = toAdd.length;
      const actualAdd = tasksAfter.length - data.tasks.length;
      // eslint-disable-next-line no-console
      console.assert(expectedAdd === actualAdd, `[autoSchedule] commit invariant violated: expected +${expectedAdd}, got +${actualAdd}`);
      // eslint-disable-next-line no-console
      console.log("[autoSchedule] commit-all", {
        committedCount: toAdd.length,
        tasksBefore: data.tasks.length,
        tasksAfter: tasksAfter.length,
        committedIds: toAdd.map((t) => t.id),
        clearedSourceTaskIds: sourceIdsToClear,
      });
    }

    void saveData({ ...data, tasks: tasksAfter });
    setSchedulePreviews([]);
    setAutoScheduleState("idle");
    if (toAdd[0]?.scheduledDate) {
      requestTimelineFocus({
        date: toAdd[0].scheduledDate,
        startTime: toAdd[0].scheduledStart,
        taskId: toAdd[0].id,
        source: "autoschedule",
      });
    }
    showUndoToast(
      `${t(lang, "toast.adoptedMany").replace("%COUNT%", String(toAdd.length))}`,
      t(lang, "toast.undo"),
      () => undoLastCommit(toAdd.map((t) => t.id), sourceIdsToClear),
    );
  }

  /**
   * Undo the most recent auto-schedule commit. Removes committed tasks from
   * `tasks` and restores the source tasks' `plannedForDate` so they reappear
   * in 今日候选. Does NOT touch any tasks the user manually created after
   * the commit (those have a different id, not in committedTaskIds).
   */
  function undoLastCommit(committedTaskIds: string[], clearedSourceTaskIds: string[]) {
    if (!data) return;
    const idsToRemove = new Set(committedTaskIds);
    const tasksAfter = data.tasks
      .filter((t) => !idsToRemove.has(t.id))
      .map((t) => {
        if (clearedSourceTaskIds.includes(t.id) && !t.plannedForDate) {
          return { ...t, plannedForDate: today, executionLane: "candidate" as const, updatedAt: new Date().toISOString() };
        }
        return t;
      });
    void saveData({ ...data, tasks: tasksAfter });
    undoSnapshotRef.current = null;
    showToast(t(lang, "toast.undone"));
  }

  function previewConflict(preview: SchedulePreview) {
    const start = timeToMinutes(preview.scheduledStart);
    const end = timeToMinutes(preview.scheduledEnd);
    return scheduledTasks.some((task) => {
      const a = timeToMinutes(task.scheduledStart);
      const b = timeToMinutes(task.scheduledEnd);
      return start < b && end > a;
    });
  }

  function shiftTimeline(direction: -1 | 1) {
    setSelectedDate((date) => {
      if (timelineView === "3day") return addDays(date, direction * 3);
      if (timelineView === "weekly") return addDays(date, direction * 7);
      if (timelineView === "month") return addMonths(date, direction);
      return addDays(date, direction);
    });
  }

  if (authState?.mode === "cloud" && !authState.user) {
    return <Suspense fallback={<div className="df-loading"><ProductIcon />{t(lang, "toast.loading")}</div>}>
      <LandingPageLazy busy={authBusy} error={authError} notice={authNotice} onLogin={handleAuthSubmit} onResend={resendConfirmation} onContinueAfterConfirm={continueAfterConfirm} onForgotPassword={handleForgotPassword} />
    </Suspense>;
  }

  if (authState?.mode === "cloud" && authState.user && isRecoveryMode) {
    return <ResetPasswordForm lang={lang} busy={authBusy} error={authError} onReset={handleResetPassword} />;
  }

  if (!data || !settings) return <div className="df-loading"><ProductIcon />{t(lang, "toast.loading")}</div>;

  const onboardingActive = settings.onboardingVersion === 0 && settings.onboardingStep !== "done";
  const onboardingStep = (settings.onboardingStep || "add") as OnboardingStep;

  return (
    <div className={`df-app mode-${mode} theme-${settings.theme} type-${settings.typographyStyle || "editorial"}${fullscreen ? " is-timeline-fullscreen" : ""}${onboardingActive ? ` onboarding-active onboarding-step-${onboardingStep}` : ""}`} data-timeline-view={timelineView} style={themeVars(settings, mode)}>
      <header className="df-header">
        <div className="df-header-inner">
          <div className="df-brand"><ProductIcon compact /><div><strong>NavoPath</strong><span>{mode === "execute" ? "Daily execution" : "Project planning"}</span></div></div>
          <div className="df-header-right">
          <nav className="df-tabs df-tabs-right">
            <button className={mode === "execute" ? "active" : ""} onClick={() => void saveSettings({ activeMode: "execute" })}>{t(lang, "header.execute")}</button>
            <button className={mode === "planning" ? "active" : ""} onClick={() => void saveSettings({ activeMode: "planning" })}>{t(lang, "header.planning")}</button>
          </nav>
          <button className="df-user-avatar" onClick={() => setUtilityPanel("settings")} aria-label={t(lang, "header.settings")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10.91 3H11a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
        </div>
      </header>
      <div className="df-header-fade" />
      <div id="df-portal-target" />
      {onboardingActive && (
        <OnboardingGuide
          lang={lang}
          step={onboardingStep}
          mode={mode}
          onOpenPlanning={() => void saveSettings({ activeMode: "planning" })}
          onFinish={() => void saveSettings({ onboardingVersion: 1, onboardingStep: "done" })}
          onSkip={() => void saveSettings({ onboardingVersion: 1, onboardingStep: "done" })}
        />
      )}

      {mode === "execute" ? (
        <main className={`df-execute${candidatePanelCollapsed ? " candidate-collapsed" : ""}${fullscreen ? " fullscreen" : ""}${simpleView ? " simple-view" : ""}`}>
          <section className={`df-candidate-panel${candidatePanelCollapsed ? " collapsed" : ""}${fullscreen ? " hidden" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            const taskId = drag?.taskId || event.dataTransfer.getData("taskId");
            if (taskId) {
              const isDroppedEvent = events.some((e) => taskId.startsWith(`event_occ_${e.id}_`)) || recordToTaskMap.get(taskId) && isEventDisplayTask(recordToTaskMap.get(taskId)!);
              if (isDroppedEvent) {
                makeEventCandidate(taskId, today);
              } else {
                unscheduleTask(taskId);
              }
            }
          }}>
            {candidatePanelCollapsed ? (
              <div className="df-candidate-collapsed-strip">
                <button className="df-candidate-expand-btn" title={t(lang, "candidate.expand")} aria-label={t(lang, "candidate.expand")} onClick={() => {
                  setCandidatePanelCollapsed(false);
                }}>&#9654;</button>
                <span className="df-candidate-collapsed-label">{t(lang, "candidate.title")}</span>
                <div className="df-candidate-collapsed-actions">
                  <button className={`df-candidate-strip-btn${fullscreen ? " active" : ""}`} title={t(lang, "candidate.fullscreen")} aria-label={t(lang, "candidate.fullscreen")} onClick={() => setFullscreen((value) => !value)}>⛶</button>
                </div>
              </div>
            ) : (
              <>
            <div className="df-panel-title">
              <h2>{t(lang, "candidate.title")}</h2>
              <div>
                {(timelineView === "3day" || timelineView === "weekly" || timelineView === "month") && (
                  <button className="df-icon-action" data-tip={t(lang, "candidate.collapse")} aria-label={t(lang, "candidate.collapse")} onClick={() => { setCandidatePanelCollapsed(true); setFullscreen(false); }} style={{ fontSize: "14px", lineHeight: 1, padding: "0 2px" }}>«</button>
                )}
                <button className={`df-icon-action i-check ${showCompletedCandidates ? "active" : ""}`} data-tip={showCompletedCandidates ? t(lang, "candidate.hideCompleted") : t(lang, "candidate.showCompleted")} aria-label={showCompletedCandidates ? t(lang, "candidate.hideCompleted") : t(lang, "candidate.showCompleted")} onClick={() => setShowCompletedCandidates((value) => !value)} />
                <button className={`df-icon-action i-layers ${groupByProject ? "active" : ""}`} data-tip={groupByProject ? t(lang, "candidate.ungroup") : t(lang, "candidate.groupByProject")} aria-label={groupByProject ? t(lang, "candidate.ungroup") : t(lang, "candidate.groupByProject")} onClick={() => setGroupByProject((v) => !v)} />
                <button className="df-icon-action i-branch" data-tip={t(lang, "candidate.pickFromPlanning")} aria-label={t(lang, "candidate.pickFromPlanning")} onClick={openPlanningPicker} />
              </div>
            </div>
            <div className="df-candidate-list">
              {visibleCandidates.length === 0 ? (
                <div className="df-empty"><div className="blob-accent" /><strong>{t(lang, "candidate.emptyTitle")}</strong><span>{t(lang, "candidate.emptyDesc")}</span><button className="df-empty-pick-btn" onClick={openPlanningPicker}>{t(lang, "candidate.pickFromPlanning")}</button></div>
              ) : groupByProject ? (
                Array.from(
                  visibleCandidates.reduce((map, task) => {
                    const gid = isEventDisplayTask(task) ? "__events__" : task.projectId || "__unassigned__";
                    if (!map.has(gid)) map.set(gid, []);
                    map.get(gid)!.push(task);
                    return map;
                  }, new Map<string, Task[]>())
                )
                  .sort(([a], [b]) => a === "__events__" ? -1 : b === "__events__" ? 1 : a === "__unassigned__" ? 1 : b === "__unassigned__" ? -1 : 0)
                  .map(([gid, tasks]) => {
                    const project = gid === "__unassigned__" || gid === "__events__" ? null : projects.find(p => String(p.id) === String(gid));
                    const projectColor = gid === "__events__" ? "var(--accent-active)" : project?.color || "var(--accent-active)";
                    const projectTitle = gid === "__events__" ? "EVENTS" : project?.title || t(lang, "candidate.unassigned");
                    return (
                      <div key={gid} className="df-project-group">
                        <div className="df-project-group-header">
                          <span className="df-project-group-dot" style={{ background: projectColor }} />
                          <span className="df-project-group-name">{projectTitle}</span>
                          <span className="df-project-group-count">{tasks.length}</span>
                        </div>
                        {tasks.map((task) => (
                          <TaskCard key={task.id} task={task} projects={projects} focusDate={today} placementPreview={placementPreview} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => {
                            void saveData({ ...data, tasks: data.tasks.filter((item) => item.id !== task.id) });
                            showToast(t(lang, "candidate.deletedTask"));
                          }} onStartPlacementPreview={() => startPlacementPreview(task.id)} onCancelPlacementPreview={cancelPlacementPreview} onConfirmPlacementPreview={() => confirmPlacementPreview(task.id)} onApplyTimeSettings={(settings) => applyCandidateTimeSettings(task.id, settings)} onSaveDueDate={(date) => updateTask(task.id, { dueDate: date })} onSaveRecurrence={(recurrence) => saveTaskRecurrence(task.id, recurrence)} onClick={() => openTaskEdit(task)} onDragStart={(event) => {
                            event.dataTransfer.setData("taskId", task.id);
                            setDragCreate(null);
                            setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                          }} onDragEnd={() => { setDrag(null); setHoverSlot(""); dragTargetDateRef.current = ""; }} onToggleDone={() => toggleTaskDone(task.id)} lang={lang} />
                        ))}
                      </div>
                    );
                  })
              ) : visibleCandidates.map((task) => (
                <TaskCard key={task.id} task={task} projects={projects} focusDate={today} placementPreview={placementPreview} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => {
                  void saveData({ ...data, tasks: data.tasks.filter((item) => item.id !== task.id) });
                  showToast(t(lang, "candidate.deletedTask"));
                }} onStartPlacementPreview={() => startPlacementPreview(task.id)} onCancelPlacementPreview={cancelPlacementPreview} onConfirmPlacementPreview={() => confirmPlacementPreview(task.id)} onApplyTimeSettings={(settings) => applyCandidateTimeSettings(task.id, settings)} onSaveDueDate={(date) => updateTask(task.id, { dueDate: date })} onSaveRecurrence={(recurrence) => saveTaskRecurrence(task.id, recurrence)} onClick={() => openTaskEdit(task)} onDragStart={(event) => {
                  event.dataTransfer.setData("taskId", task.id);
                  setDragCreate(null);
                  setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                }} onDragEnd={() => { setDrag(null); setHoverSlot(""); dragTargetDateRef.current = ""; }} onToggleDone={() => toggleTaskDone(task.id)} lang={lang} />
              ))}
            </div>
            <form className="df-quick-add" onSubmit={(event) => {
              event.preventDefault();
              quickAddTask();
            }}>
              <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder={t(lang, "candidate.addPlaceholder")} />
              <QuickProjectPicker
                projects={projects}
                value={quickProjectId}
                open={quickProjectOpen}
                newTitle={quickProjectTitle}
                newColor={quickProjectColor}
                onOpenChange={setQuickProjectOpen}
                onChange={setQuickProjectId}
                onTitleChange={setQuickProjectTitle}
                onColorChange={setQuickProjectColor}
                onProjectColorChange={(projectId, color) => updateProject(projectId, { color })}
                onCreate={createQuickProject}
                lang={lang}
              />
              <button className="df-quick-add-submit" type="submit" disabled={!quickTitle.trim()}>{t(lang, "candidate.add")}</button>
            </form>
              </>
            )}
          </section>

          <section className="df-timeline-panel" id="df-execute-timeline">
            <button className="df-date-arrow left" aria-label={t(lang, "timeline.prevSegment")} onClick={() => shiftTimeline(-1)}>‹</button>
            <button className="df-date-arrow right" aria-label={t(lang, "timeline.nextSegment")} onClick={() => shiftTimeline(1)}>›</button>
            <div className="df-execute-top">
              {!settings.hideAi && <div className="df-ai-planner">
                <button className={`df-ai-plan ${autoScheduleState === "generating" ? "thinking" : ""} ${autoScheduleState === "committing" ? "committing" : ""}`} data-tip={drawerOpen ? t(lang, "timeline.aiPlanToday") : t(lang, "timeline.planningSuggestion")} aria-label={t(lang, "timeline.aiPlanToday")} disabled={autoScheduleState === "generating" || autoScheduleState === "committing" || drawerOpen} onClick={() => void planMyDay()}>
                  {autoScheduleState === "generating" ? <><i />{t(lang, "timeline.analyzing")}</>
                    : autoScheduleState === "committing" ? <><i />{t(lang, "timeline.adopting")}</>
                    : autoScheduleState === "preview" ? t(lang, "timeline.regenerate")
                    : t(lang, "timeline.planningSuggestion")}
                </button>
                <button className={`df-ai-plan-toggle ${aiPlanMenuOpen ? "active" : ""}`} aria-label={t(lang, "timeline.aiPlanningSettings")} onClick={(event) => {
                  event.stopPropagation();
                  setAiPlanMenuOpen((open) => !open);
                }}><span className="df-ai-plan-chevron" aria-hidden="true" /></button>
                {schedulePreviews.length > 0 && autoScheduleState === "preview" && <>
                  <button className="df-ai-plan-confirm" onClick={() => acceptAllPreviews()} title={t(lang, "timeline.adoptAll")}>✓</button>
                  <button className="df-ai-plan-cancel" onClick={() => cancelAutoSchedule()} title={t(lang, "timeline.cancelPreview")}>✕</button>
                </>}
                {aiPlanMenuOpen && <span className="df-ai-plan-menu open" onClick={(event) => event.stopPropagation()}>
                  <label>{t(lang, "timeline.source")}<select value={aiPlanPrefs.source} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, source: event.target.value as AiPlanPrefs["source"] }))}><option value="today">{t(lang, "timeline.fromCandidates")}</option><option value="all">{t(lang, "timeline.allUnfinished")}</option></select></label>
                  <label>{t(lang, "timeline.scope")}<select value={aiPlanPrefs.scope} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, scope: event.target.value as AiPlanPrefs["scope"] }))}><option value="day">{viewLabel(lang, "daily")}</option><option value="3day">{viewLabel(lang, "3day")}</option></select></label>
                  <label>{t(lang, "timeline.strategy")}<select value={aiPlanPrefs.strategy} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, strategy: event.target.value as AiPlanPrefs["strategy"] }))}><option value="alternativeProject">{t(lang, "timeline.alternateByProject")}</option><option value="byProject">{t(lang, "timeline.scheduleByProject")}</option><option value="longShort">{t(lang, "timeline.alternateLongShort")}</option><option value="random">{t(lang, "timeline.random")}</option></select></label>
                </span>}
              </div>}
              <div className="df-timeline-actions">
                {autoScheduleState === "preview" && schedulePreviews.length > 0 && (
                  <span className="df-ai-plan-summary">{`${t(lang, "timeline.previewPlan").replace("X", String(schedulePreviews.length))}`}</span>
                )}
              </div>
            </div>
            <div className="df-timeline-body">
              <div className="df-timeline-content">
                {fullscreen && (
                  <button
                    className="df-exit-fullscreen-btn"
                    type="button"
                    aria-label={lang === "zh" ? "退出全屏" : "Exit Fullscreen"}
                    title={lang === "zh" ? "退出全屏" : "Exit Fullscreen"}
                    onClick={() => setFullscreen(false)}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
                    </svg>
                  </button>
                )}
                {timelineDate !== today && (
                  <button className="df-back-today" onClick={() => setSelectedDate(today)} title={t(lang, "timeline.backToToday")}>↵</button>
                )}
                {(timelineView === "3day" || timelineView === "weekly") ? (() => {
                  const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
                  const weekdayShort = lang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const canvasHeight = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * SLOT_HEIGHT;
                  const slotCount = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1;
                  const multiDayScheduledTasks = [...expandedVisibleTimelineTasks.filter((task) => threeDates.includes(task.scheduledDate || "")), ...previewTasks.filter((task) => threeDates.includes(task.scheduledDate || ""))].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
                  return (
                    <div className={`df-timeline-3day ${timelineView === "weekly" ? "df-week-view" : ""}`} style={{ "--df-day-columns": String(threeDates.length) } as CSSProperties}>
                      <div className="df-timeline-3day-top">
                        <div className="df-timeline-3day-ruler-spacer" />
                        <div className="df-timeline-3day-dates">
                          {threeDates.map((colDate) => {
                            const isToday = colDate === today;
                            const dateObj = new Date(`${colDate}T00:00:00`);
                            return (
                              <div key={colDate} className={`df-timeline-3day-date${isToday ? " today" : ""}`}>
                                <span className="df-timeline-3day-date-num">{dateObj.getDate()}</span>
                                <span className="df-timeline-3day-date-wd">{weekdayShort[dateObj.getDay()]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className={`df-timeline-3day-allday${allDayDragOver && drag ? " drag-over" : ""}`}
                        onDragEnter={(e) => { e.preventDefault(); setAllDayDragOver(true); }}
                        onDragOver={(e) => { e.preventDefault(); if (!allDayDragOver) setAllDayDragOver(true); }}
                        onDragLeave={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                            setAllDayDragOver(false);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setAllDayDragOver(false);
                          const taskId = e.dataTransfer.getData("taskId") || drag?.taskId;
                          if (taskId) {
                            // Determine which column by x coordinate
                            const rect = e.currentTarget.getBoundingClientRect();
                            const datesEl = e.currentTarget.querySelector(".df-timeline-3day-dates");
                            if (datesEl) {
                              const datesRect = datesEl.getBoundingClientRect();
                              const x = e.clientX - datesRect.left;
                              const colW = datesRect.width / threeDates.length;
                              const di = Math.min(Math.max(Math.floor(x / colW), 0), threeDates.length - 1);
                              makeAllDay(taskId, threeDates[di]);
                            } else {
                              makeAllDay(taskId, threeDates[0]);
                            }
                          }
                        }}
                      >
                        <div className="df-timeline-3day-ruler-spacer">
                          <span className="df-timeline-3day-allday-label">{t(lang, "timeline.allDay")}</span>
                        </div>
                        <div className="df-timeline-3day-dates">
                          {threeDates.map((colDate, ci) => {
                            const adTasks = [
                              ...tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === colDate),
                              ...eventVisibleTimeline.tasks.filter((task) => !task.scheduledStart && task.scheduledDate === colDate),
                            ];
                            return (
                              <div key={colDate} className="df-timeline-3day-allday-cell"
                                onClick={(event) => {
                                  if (drawerOpen || drag || resizePreview || autoScheduleState === "generating") return;
                                  if ((event.target as HTMLElement).closest("button,.df-all-day-block,.df-all-day-quick")) return;
                                  const cellRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                                  const parentGrid = (event.currentTarget as HTMLElement).closest(".df-timeline-3day-dates");
                                  const colGrid = parentGrid ? parentGrid.getBoundingClientRect() : cellRect;
                                  const colCount = threeDates.length;
                                  const colW = colGrid.width / colCount;
                                  const gutter = 6;
                                  const popL = colGrid.left + ci * colW + gutter;
                                  setAllDayQuickAdd({ date: colDate, left: popL, top: cellRect.top + 4, width: colW - gutter * 2, dayIndex: ci });
                                }}
                              >
                                {allDayQuickAdd && !drag && allDayQuickAdd.date === colDate && (
                                  <AllDayQuickAddPopover add={allDayQuickAdd} projects={projects} onSave={(title) => createAllDayTask(title, colDate, null)} onCancel={() => setAllDayQuickAdd(null)} />
                                )}
                                {adTasks.map((task) => (
                                  <AllDayBlock key={task.id} task={task} projectName={projectName(task)} projects={projects} onEdit={() => openTaskEdit(task)} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onDragStart={(event) => {
                                    event.dataTransfer.setData("taskId", task.id);
                                    setDragCreate(null);
                                    setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                                  }} onDragEnd={() => { setDrag(null); setHoverSlot(""); dragTargetDateRef.current = ""; }} lang={lang} />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="df-timeline-3day-scroll" ref={timelineRef}>
                        <div className="df-timeline-3day-grid">
                          <div className="df-timeline-3day-ruler">
                            <div className="df-timeline-canvas" style={{ height: `${canvasHeight}px`, width: "52px", margin: 0, borderLeft: "none", background: "transparent" }}>
                              {Array.from({ length: slotCount }).map((_, index) => {
                                const minutes = TIMELINE_START * 60 + index * SLOT_MINUTES;
                                const isHour = minutes % 60 === 0;
                                const isMajor = minutes % (6 * 60) === 0 && minutes < TIMELINE_END * 60;
                                return (
                                  <div className={`df-slot-ruler ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }} key={minutes}>
                                    {isHour ? <span>{hourLabel(minutes)}</span> : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="df-timeline-3day-cols" ref={colsContainerRef}
                            onDragOver={(event) => {
                              event.preventDefault();
                              const gridEl = colsContainerRef.current;
                              const scrollEl = timelineRef.current;
                              if (gridEl && scrollEl) {
                                const target = getDropTargetFromPointer({
                                  clientX: event.clientX, clientY: event.clientY,
                                  gridElement: gridEl,
                                  scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  debugLabel: `drag-${timelineView}`,
                                });
                                dragTargetDateRef.current = target.date;
                                setHoverSlot(target.startTime);
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                              if (taskId) {
                                const gridEl = colsContainerRef.current;
                                const scrollEl = timelineRef.current;
                                if (gridEl && scrollEl) {
                                  const target = getDropTargetFromPointer({
                                    clientX: event.clientX, clientY: event.clientY,
                                    gridElement: gridEl,
                                    scrollElement: scrollEl,
                                    visibleDays: threeDates,
                                  });
                                  dragTargetDateRef.current = target.date;
                                  if (drag?.kind === "block" && recordByIdMap.has(taskId)) {
                                    moveTimelineRecord(taskId, target.startTime, target.date);
                                    requestTimelineFocus({ date: target.date, startTime: target.startTime, taskId, source: "schedule" });
                                    showToast(t(lang, "timeline.timeAdjusted"));
                                  } else {
                                    const sourceTask = tasks.find((item) => item.id === taskId);
                                    applyCandidateTimeSettings(taskId, {
                                      date: target.date,
                                      startTime: target.startTime,
                                      durationMinutes: drag?.duration || (sourceTask ? taskDuration(sourceTask) : 60),
                                      allDay: false,
                                    });
                                  }
                                  setHoverSlot("");
                                  setDrag(null);
                                }
                              }
                            }}
                            onDragLeave={() => { setHoverSlot(""); dragTargetDateRef.current = ""; }}
                          >
                            {/* Single time-grid: coordinate origin for ALL day columns */}
                            <div className="df-time-grid" ref={timeGridRef} style={{ position: "relative", height: `${canvasHeight}px`, width: "100%" }}
                              onMouseDown={(event) => {
                                if (drag || resizePreview || autoScheduleState === "generating") return;
                                if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule,.df-all-day-block,.df-month-task")) return;
                                if ((event.target as HTMLElement).closest(".drag-create-preview,.drag-create-quick-add")) return;
                                const gridEl = timeGridRef.current;
                                const scrollEl = timelineRef.current;
                                if (!gridEl || !scrollEl) return;
                                const startTarget = pointerToDateTime({
                                  clientX: event.clientX, clientY: event.clientY,
                                  gridElement: gridEl, scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                });
                                const startMinutes = startTarget.minutes;
                                const startDayIndex = startTarget.dayIndex;
                                let hasMoved = false;
                                const moveHandler = (moveEvent: MouseEvent) => {
                                  if (Math.abs(moveEvent.clientY - event.clientY) < 6) return;
                                  hasMoved = true;
                                  const currentTarget = pointerToDateTime({
                                    clientX: moveEvent.clientX, clientY: moveEvent.clientY,
                                    gridElement: gridEl, scrollElement: scrollEl,
                                    visibleDays: threeDates,
                                  });
                                  let s = startMinutes, e = currentTarget.minutes;
                                  if (s > e) { const t = s; s = e; e = t; }
                                  s = Math.max(s, TIMELINE_START * 60);
                                  e = Math.min(e, TIMELINE_END * 60 - SLOT_MINUTES);
                                  if (e - s < SLOT_MINUTES * 2) e = s + SLOT_MINUTES * 2;
                                  const gridRect = gridEl.getBoundingClientRect();
                                  const cw = gridRect.width / threeDates.length;
                                  const gut = timelineView === "weekly" ? 5 : 8;
                                  const startPx = ((s - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
                                  const endPx = ((e - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
                                  setDragCreate({
                                    date: startTarget.date, dayIndex: startDayIndex,
                                    startMinutes: s, endMinutes: e,
                                    top: startPx, height: endPx - startPx,
                                    left: startDayIndex * cw + gut, width: cw - gut * 2,
                                    committed: false,
                                  });
                                };
                                const keyHandler = (keyEvent: KeyboardEvent) => {
                                  if (keyEvent.key === "Escape") {
                                    window.removeEventListener("mousemove", moveHandler);
                                    window.removeEventListener("mouseup", upHandler);
                                    window.removeEventListener("keydown", keyHandler);
                                    setDragCreate(null);
                                  }
                                };
                                const upHandler = () => {
                                  window.removeEventListener("mousemove", moveHandler);
                                  window.removeEventListener("mouseup", upHandler);
                                  window.removeEventListener("keydown", keyHandler);
                                  if (hasMoved) {
                                    dragCreateSuppressClickRef.current = true;
                                    setFloatingTimeAdd(null);
                                    setDragCreate((prev) => prev ? { ...prev, committed: true } : prev);
                                  }
                                };
                                window.addEventListener("mousemove", moveHandler);
                                window.addEventListener("mouseup", upHandler);
                                window.addEventListener("keydown", keyHandler);
                              }}
                              onClick={(event) => {
                                if (dragCreateSuppressClickRef.current) { dragCreateSuppressClickRef.current = false; return; }
                                if (drag || resizePreview || autoScheduleState === "generating") return;
                                if (suppressBlockClickRef.current) return;
                                if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule,.df-all-day-block,.df-month-task")) return;
                                if (floatingTimeAdd) { setFloatingTimeAdd(null); return; }
                                const gridEl = timeGridRef.current;
                                const scrollEl = timelineRef.current;
                                if (!gridEl || !scrollEl) return;
                                const target = pointerToDateTime({
                                  clientX: event.clientX,
                                  clientY: event.clientY,
                                  gridElement: gridEl,
                                  scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                });
                                const endTime = addMinutes(target.startTime, 30);
                                const maxEnd = minutesToTime(TIMELINE_END * 60);
                                const clampedEnd = timeToMinutes(endTime) > TIMELINE_END * 60 ? maxEnd : endTime;
                                // Compute column-aligned popover position
                                const gridRect = timeGridRef.current?.getBoundingClientRect();
                                let popLeft = event.clientX;
                                let popWidth = 300;
                                if (gridRect) {
                                  const x = event.clientX - gridRect.left;
                                  const cw = gridRect.width / threeDates.length;
                                  const di = Math.min(Math.floor(x / cw), threeDates.length - 1);
                                  const gut = timelineView === "weekly" ? 5 : 8;
                                  popLeft = gridRect.left + di * cw + gut;
                                  popWidth = cw - gut * 2;
                                }
                                setFloatingTimeAdd({
                                  date: target.date,
                                  startTime: target.startTime,
                                  endTime: clampedEnd,
                                  top: event.clientY,
                                  left: popLeft,
                                  width: popWidth,
                                });
                              }}
                            >
                              {/* Layer 1: Shared hour lines across all columns */}
                              <div className="df-hour-lines-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
                                {Array.from({ length: slotCount }).map((_, index) => {
                                  const minutes = TIMELINE_START * 60 + index * SLOT_MINUTES;
                                  const isHour = minutes % 60 === 0;
                                  const isMajor = minutes % (6 * 60) === 0 && minutes < TIMELINE_END * 60;
                                  return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }} key={minutes} />;
                                })}
                              </div>
                              {/* Layer 2: Day column backgrounds and separators */}
                              <div className="df-day-columns-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
                                {threeDates.map((colDate, ci) => {
                                  const colPct = 100 / threeDates.length;
                                  return (
                                    <div key={colDate} className={`df-day-col-bg${colDate === today ? " is-today" : ""}${allDayQuickAdd?.date === colDate ? " is-quick-add-target" : ""}`}
                                      style={{
                                        position: "absolute",
                                        left: `${ci * colPct}%`,
                                        width: `${colPct}%`,
                                        top: 0, bottom: 0,
                                        borderRight: ci < threeDates.length - 1 ? "1px solid rgba(148,163,184,.08)" : "none",
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              {/* Layer 3: Event blocks — absolutely positioned on the time-grid */}
                              <div className="df-event-blocks-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
                                {multiColWidth > 0 && multiDayScheduledTasks.filter((task) => !(drag?.kind === "block" && drag.taskId === task.id)).map((task) => {
                                  const dayIndex = threeDates.indexOf(task.scheduledDate || "");
                                  if (dayIndex === -1) return null;
                                  const gutter = timelineView === "weekly" ? 5 : 8;
                                  const gap = timelineView === "weekly" ? 3 : 4;
                                  const baseLeft = dayIndex * multiColWidth + gutter;
                                  const innerW = multiColWidth - gutter * 2;
                                  const cs = computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap, timelineView);
                                  let left = baseLeft;
                                  let width = innerW;
                                  let overflow: CSSProperties["overflow"] = undefined;
                                  if (cs) {
                                    left = cs.left;
                                    width = cs.width;
                                    if (cs.isNarrow) overflow = "hidden";
                                  }
                                  const isPreview = previewIdByClonedId.has(task.id);
                                  return (
                                    <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} onHover={setHoveredBlock} onEdit={() => {
                                      if (!suppressBlockClickRef.current) openTaskEdit(task);
                                    }} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                                      createProjectForTask(task.id, title);
                                    }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)}
                                      extraStyle={{ position: "absolute", left, width, pointerEvents: "auto", overflow, ...(isPreview ? { ["--df-preview" as any]: "1" } as CSSProperties : {}) }}
                                      onAcceptPreview={isPreview ? () => acceptOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                                      onCancelPreview={isPreview ? () => cancelOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                                      viewMode={timelineView}
                                      lang={lang}
                                    />
                                  );
                                })}
                                {/* Preview block during drag */}
                                {multiColWidth > 0 && hoverSlot && drag && !drag.outsideTimeline && (() => {
                                  const tgtDate = dragTargetDateRef.current || threeDates[0];
                                  const dayIndex = threeDates.indexOf(tgtDate);
                                  if (dayIndex === -1) return null;
                                  const gutter = timelineView === "weekly" ? 5 : 8;
                                  return (
                                    <PreviewBlock task={(() => { const t = tasks.find((task) => task.id === drag.taskId); if (t) return t; const r = recordToTaskMap.get(drag.taskId); if (r) return r; return eventVisibleTimeline.tasks.find((task) => task.id === drag.taskId); })()} startTime={hoverSlot} duration={drag.duration} draggingBlock={drag.kind === "block"} conflict={hasScheduleConflict(hoverSlot, addMinutes(hoverSlot, drag.duration), drag.taskId)}
                                      extraStyle={{ position: "absolute", left: dayIndex * multiColWidth + gutter, width: multiColWidth - gutter * 2 }}
                                    />
                                  );
                                })()}
                                {multiColWidth > 0 && placementPreviewTask && placementPreview && (() => {
                                  const dayIndex = threeDates.indexOf(placementPreview.date);
                                  if (dayIndex === -1) return null;
                                  const gutter = timelineView === "weekly" ? 5 : 8;
                                  return (
                                    <PreviewBlock
                                      task={placementPreviewTask}
                                      startTime={placementPreview.startTime}
                                      duration={placementPreview.durationMinutes}
                                      extraStyle={{
                                        position: "absolute",
                                        left: dayIndex * multiColWidth + gutter,
                                        width: multiColWidth - gutter * 2,
                                        ["--df-preview" as any]: "1",
                                      } as CSSProperties}
                                    />
                                  );
                                })()}
                                {/* Now line — only in today's column in multi-day view */}
                                {(() => {
                                  const todayIdx = threeDates.indexOf(today);
                                  if (todayIdx === -1 || multiColWidth <= 0) return null;
                                  return <NowLine extraStyle={{ left: todayIdx * multiColWidth, width: multiColWidth }} lang={lang} />;
                                })()}
                                {/* Empty state */}
                                {multiDayScheduledTasks.length === 0 && !drag && <div className="df-timeline-empty small"><div className="blob-accent" />--</div>}
                              </div>
                              {dragCreate && (
                                <div className="drag-create-preview" style={{
                                  position: "absolute", zIndex: 99998, borderRadius: "12px",
                                  overflow: "visible",
                                  top: `${dragCreate.top}px`, left: `${dragCreate.left}px`,
                                  width: `${dragCreate.width}px`, height: `${dragCreate.height}px`,
                                }}>
                                  {dragCreate.committed ? (
                                    <DragCreateQuickAdd state={dragCreate} projects={projects}
                                      onSave={(title, projectId) => {
                                        if (!data) return;
                                        const { date, startMinutes, endMinutes } = dragCreate;
                                        const startTime = minutesToTime(startMinutes);
                                        const endTime = minutesToTime(endMinutes);
                                        const estimatedH = (endMinutes - startMinutes) / 60;
                                        const task = makeTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: date, estimatedHours: estimatedH });
                                        const scheduledRecord = createScheduledRecord(task, date, startTime, endMinutes - startMinutes);
                                        void saveData({
                                          ...data,
                                          tasks: [...data.tasks, { ...task, plannedForDate: date, executionLane: undefined, timelineRecords: [scheduledRecord] }]
                                        });
                                        requestTimelineFocus({ date, startTime, taskId: scheduledRecord.id, source: "schedule" });
                                        setDragCreate(null);
                                        showToast(t(lang, "timeline.addedToTimeline"));
                                      }}
                                      onCancel={() => setDragCreate(null)}
                                    />
                                  ) : (
                                    null
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })() : timelineView === "month" ? (() => {
                  const monthStart = startOfMonthGridIso(timelineDate);
                  const allMonthDays = Array.from({ length: 42 }, (_, index) => addDays(monthStart, index));
                  const visibleMonthDays = new Set(allMonthDays);
                  const monthEvents = expandEventOccurrences(visibleMonthDays).tasks;
                  const activeMonth = new Date(`${timelineDate}T00:00:00`).getMonth();
                  // Group into 6 weeks
                  const weeks: string[][] = [];
                  for (let w = 0; w < 6; w++) weeks.push(allMonthDays.slice(w * 7, w * 7 + 7));
                  function getPrimaryMonthDate(task: Task) {
                    const recordDate = [...(task.timelineRecords || [])]
                      .map((record) => record.scheduledDate)
                      .filter((date): date is string => Boolean(date) && visibleMonthDays.has(date))
                      .sort()[0];
                    if (recordDate) return recordDate;
                    if (task.scheduledDate && visibleMonthDays.has(task.scheduledDate)) return task.scheduledDate;
                    if (task.plannedForDate && visibleMonthDays.has(task.plannedForDate)) return task.plannedForDate;
                    if (task.dueDate && visibleMonthDays.has(task.dueDate)) return task.dueDate;
                    return "";
                  }
                  const monthTaskBuckets = [...tasks, ...monthEvents].reduce((map, task) => {
                    const primaryDate = getPrimaryMonthDate(task);
                    if (!primaryDate) return map;
                    const bucket = map.get(primaryDate);
                    if (bucket) bucket.push(task);
                    else map.set(primaryDate, [task]);
                    return map;
                  }, new Map<string, Task[]>());
                  function getDayTasks(day: string) {
                    return monthTaskBuckets.get(day) || [];
                  }
                  const baseDayH = 88, taskH = 28, taskGap = 6, weekPad = 18;
                  return (
                    <div className="df-month-view">
                      <div className="df-month-header">
                        <div className="df-month-title">{(() => { const d = new Date(`${timelineDate}T00:00:00`); return monthTitle(lang, d.getFullYear(), d.getMonth() + 1); })()}</div>
                      </div>
                      <div className="df-month-body">
                        <div className="df-month-weekdays">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => <span key={day}>{day}</span>)}</div>
                        <div className="df-month-scroll">
                          {weeks.map((weekDays, wi) => {
                            const weekTaskCounts = weekDays.map((d) => getDayTasks(d).length);
                            const maxTasks = Math.max(...weekTaskCounts, 1);
                            const weekH = baseDayH + maxTasks * (taskH + taskGap) + weekPad;
                            return (
                              <div key={wi} className="df-month-week-row" style={{ height: weekH }}>
                                {weekDays.map((day) => {
                                  const dateObj = new Date(`${day}T00:00:00`);
                                  const isCurrentMonth = dateObj.getMonth() === activeMonth;
                                  const dayTasks = getDayTasks(day);
                                  return (
                                    <div key={day} className={`df-month-cell${isCurrentMonth ? "" : " muted"}${day === today ? " today" : ""}${drag ? " drag-active" : ""}`}
                                      onClick={(event) => {
                                        if (drawerOpen || drag) return;
                                        if ((event.target as HTMLElement).closest(".df-month-task,.df-month-task *")) return;
                                        if ((event.target as HTMLElement).closest(".df-month-cell-strong")) {
                                          setSelectedDate(day);
                                          setTimelineView("daily");
                                          return;
                                        }
                                        setMonthQuickAdd({ date: day, left: 0, top: 30, width: 0, dayIndex: 0 });
                                      }}
                                      onDragOver={(event) => {
                                        event.preventDefault();
                                        event.currentTarget.classList.add("drag-hover");
                                      }}
                                      onDragLeave={(event) => {
                                        event.currentTarget.classList.remove("drag-hover");
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault();
                                        event.currentTarget.classList.remove("drag-hover");
                                        const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                                        if (taskId) {
                                          const t = tasks.find((x) => x.id === taskId);
                                          if (t) {
                                            const patch: Partial<Task> = { plannedForDate: day };
                                            if (t.scheduledDate) patch.scheduledDate = day;
                                            updateTask(taskId, patch);
                                          }
                                        }
                                        setDrag(null);
                                      }}
                                    >
                                      <strong className="df-month-cell-strong">{dateObj.getDate()}</strong>
                                      <div className="df-month-cell-tasks">
                                        {[...dayTasks].sort((a, b) => {
                                          const aD = !isEventDisplayTask(a) && a.completed ? 1 : 0, bD = !isEventDisplayTask(b) && b.completed ? 1 : 0;
                                          if (aD !== bD) return aD - bD;
                                          const aT = a.scheduledStart || "", bT = b.scheduledStart || "";
                                          if (aT && bT) return aT.localeCompare(bT);
                                          if (aT) return -1; if (bT) return 1; return 0;
                                        }).map((task) => (
                                          <button key={task.id} className={`df-month-task${!isEventDisplayTask(task) && task.completed ? " completed" : ""}${isEventDisplayTask(task) ? " is-event" : ""}`}
                                            data-kind={isEventDisplayTask(task) ? "event" : "task"}
                                            draggable={!isEventDisplayTask(task) && !hasRecurringRule(task)}
                                            style={{ "--cat": projects.find((p) => String(p.id) === String(task.projectId || ""))?.color || categories[task.category].color } as CSSProperties}
                                            onClick={(e) => { e.stopPropagation(); openTaskEdit(task); }}
                                            onDragStart={(e) => {
                                              if (isEventDisplayTask(task) || hasRecurringRule(task)) return;
                                              e.dataTransfer.setData("taskId", task.id);
                                              e.dataTransfer.effectAllowed = "move";
                                              setDragCreate(null);
                                              setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                                            }}
                                            onDragEnd={() => { setDrag(null); setHoverSlot(""); dragTargetDateRef.current = ""; }}
                                          ><span />{task.scheduledStart ? <time>{task.scheduledStart}</time> : null}{isEventDisplayTask(task) ? <small>{t(lang, "form.event")}</small> : null}{task.title}</button>
                                        ))}
                                        {monthQuickAdd && !drag && monthQuickAdd.date === day && (
                                          <AllDayQuickAddPopover absolute add={monthQuickAdd} projects={projects}
                                            onSave={(title, projectId) => {
                                              if (!data || !title.trim()) return;
                                              const newTask = makeTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: day, estimatedHours: 0.5 });
                                              void saveData({ ...data, tasks: [...data.tasks, { ...newTask, plannedForDate: day, scheduledDate: day, order: Date.now() }] });
                                              setMonthQuickAdd(null);
                                              showToast(t(lang, "timeline.taskAdded"));
                                            }}
                                            onCancel={() => setMonthQuickAdd(null)}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="df-timeline-daily">
                    <div className={`df-date-title${timelineDate === today ? " today" : ""}`}>
                      {(() => { const d = new Date(`${timelineDate}T00:00:00`); return formatDateTitle(lang, d.getFullYear(), d.getMonth() + 1, d.getDate()); })()}
                    </div>
                    <div
                      className={`df-timeline-allday${allDayDragOver && drag ? " drag-over" : ""}`}
                      onDragEnter={(e) => { e.preventDefault(); setAllDayDragOver(true); }}
                      onDragOver={(e) => { e.preventDefault(); if (!allDayDragOver) setAllDayDragOver(true); }}
                      onDragLeave={(e) => {
                        // Only set false if truly leaving the all-day bar (not entering a child)
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                          setAllDayDragOver(false);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setAllDayDragOver(false);
                        const taskId = e.dataTransfer.getData("taskId") || drag?.taskId;
                        if (taskId) makeAllDay(taskId, timelineDate);
                      }}
                    >
                      <span className="df-timeline-allday-label">{t(lang, "timeline.allDay")}</span>
                      <div className="df-timeline-allday-content"
                        onClick={(event) => {
                          if (drawerOpen || drag || resizePreview || autoScheduleState === "generating") return;
                          if ((event.target as HTMLElement).closest(".df-all-day-block,.df-all-day-quick")) return;
                          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                          const gutter = 6;
                          setAllDayQuickAdd({ date: timelineDate, left: rect.left + gutter, top: rect.top + 4, width: rect.width - gutter * 2, dayIndex: 0 });
                        }}
                      >
                        {allDayQuickAdd && !drag && (
                          <AllDayQuickAddPopover add={allDayQuickAdd} projects={projects} onSave={(title) => createAllDayTask(title, allDayQuickAdd.date, null)} onCancel={() => setAllDayQuickAdd(null)} />
                        )}
                        {[...tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === timelineDate), ...eventVisibleTimeline.tasks.filter((task) => !task.scheduledStart && task.scheduledDate === timelineDate)].map((task) => (
                          <AllDayBlock key={task.id} task={task} projectName={projectName(task)} projects={projects} onEdit={() => openTaskEdit(task)} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onDragStart={(event) => {
                            event.dataTransfer.setData("taskId", task.id);
                            setDragCreate(null);
                            setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                          }} onDragEnd={() => { setDrag(null); setHoverSlot(""); dragTargetDateRef.current = ""; }} lang={lang} />
                        ))}
                      </div>
                    </div>
                    <div className="df-timeline-scroll" ref={timelineRef} onDragOver={(event) => {
                      event.preventDefault();
                      const gridEl = timelineCanvasRef.current;
                      const scrollEl = timelineRef.current;
                      if (gridEl && scrollEl) {
                        const target = getDropTargetFromPointer({
                          clientX: event.clientX, clientY: event.clientY,
                          gridElement: gridEl,
                          scrollElement: scrollEl,
                          visibleDays: [timelineDate],
                          debugLabel: "drag-daily",
                        });
                        dragTargetDateRef.current = target.date;
                        setHoverSlot(target.startTime);
                      }
                    }} onDrop={(event) => {
                      event.preventDefault();
                      const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                      if (taskId) {
                        const gridEl = timelineCanvasRef.current;
                        const scrollEl = timelineRef.current;
                        if (gridEl && scrollEl) {
                          const target = getDropTargetFromPointer({
                            clientX: event.clientX, clientY: event.clientY,
                            gridElement: gridEl,
                            scrollElement: scrollEl,
                            visibleDays: [timelineDate],
                          });
                          dragTargetDateRef.current = target.date;
                          scheduleTask(taskId, target.startTime);
                        } else {
                          scheduleTask(taskId, hoverSlot || slotFromPointer(event.clientY));
                        }
                      }
                    }} onDragLeave={() => { setHoverSlot(""); dragTargetDateRef.current = ""; }}>
                      <div ref={timelineCanvasRef} className="df-timeline-canvas" style={{ height: `${((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * SLOT_HEIGHT}px` }}
                        onMouseDown={(event) => {
                          if (drag || resizePreview || autoScheduleState === "generating") return;
                          if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule")) return;
                          if ((event.target as HTMLElement).closest(".df-all-day-block,.df-all-day-quick")) return;
                          const gridEl = timelineCanvasRef.current;
                          const scrollEl = timelineRef.current;
                          if (!gridEl || !scrollEl) return;
                          const startTarget = getDropTargetFromPointer({
                            clientX: event.clientX, clientY: event.clientY,
                            gridElement: gridEl, scrollElement: scrollEl,
                            visibleDays: [timelineDate],
                          });
                          const startMinutes = startTarget.minutes;
                          const snap = SLOT_MINUTES;
                          let hasMoved = false;
                          const moveHandler = (moveEvent: MouseEvent) => {
                            if (Math.abs(moveEvent.clientY - event.clientY) < 6) return;
                            hasMoved = true;
                            const currentTarget = getDropTargetFromPointer({
                              clientX: moveEvent.clientX, clientY: moveEvent.clientY,
                              gridElement: gridEl, scrollElement: scrollEl,
                              visibleDays: [timelineDate],
                            });
                            let s = startMinutes, e = currentTarget.minutes;
                            if (s > e) { const t = s; s = e; e = t; }
                            s = Math.max(s, TIMELINE_START * 60);
                            e = Math.min(e, TIMELINE_END * 60 - SLOT_MINUTES);
                            if (e - s < SLOT_MINUTES * 2) e = s + SLOT_MINUTES * 2;
                            const gridRect = gridEl.getBoundingClientRect();
                            const startPx = ((s - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
                            const endPx = ((e - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
                            const gut = 8;
                            setDragCreate({
                              date: timelineDate, dayIndex: 0,
                              startMinutes: s, endMinutes: e,
                              top: startPx, height: endPx - startPx,
                              left: gut, width: gridRect.width - gut * 2,
                              committed: false,
                            });
                          };
                          const keyHandler = (keyEvent: KeyboardEvent) => {
                            if (keyEvent.key === "Escape") {
                              window.removeEventListener("mousemove", moveHandler);
                              window.removeEventListener("mouseup", upHandler);
                              window.removeEventListener("keydown", keyHandler);
                              setDragCreate(null);
                            }
                          };
                          const upHandler = () => {
                            window.removeEventListener("mousemove", moveHandler);
                            window.removeEventListener("mouseup", upHandler);
                            window.removeEventListener("keydown", keyHandler);
                            if (hasMoved) {
                              dragCreateSuppressClickRef.current = true;
                              setFloatingTimeAdd(null);
                              setDragCreate((prev) => prev ? { ...prev, committed: true } : prev);
                            }
                          };
                          window.addEventListener("mousemove", moveHandler);
                          window.addEventListener("mouseup", upHandler);
                          window.addEventListener("keydown", keyHandler);
                        }}
                        onClick={(event) => {
                          if (dragCreateSuppressClickRef.current) { dragCreateSuppressClickRef.current = false; return; }
                          if (suppressBlockClickRef.current) return;
                          if (drag || resizePreview) return;
                          if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule")) return;
                          if (floatingTimeAdd) { setFloatingTimeAdd(null); return; }
                          const startTime = slotFromPointer(event.clientY);
                          const endTime = addMinutes(startTime, 30);
                          const maxEnd = minutesToTime(TIMELINE_END * 60);
                          const clampedEnd = timeToMinutes(endTime) > TIMELINE_END * 60 ? maxEnd : endTime;
                          const canvasRect = timelineCanvasRef.current?.getBoundingClientRect();
                          const colLeft = canvasRect ? canvasRect.left + 8 : event.clientX;
                          const colWidth = canvasRect ? canvasRect.width - 16 : 300;
                          setFloatingTimeAdd({
                            date: timelineDate,
                            startTime,
                            endTime: clampedEnd,
                            top: event.clientY,
                            left: colLeft,
                            width: colWidth,
                          });
                        }}>
                        {Array.from({ length: ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1 }).map((_, index) => {
                          const minutes = TIMELINE_START * 60 + index * SLOT_MINUTES;
                          const isHour = minutes % 60 === 0;
                          const isMajor = minutes % (6 * 60) === 0 && minutes < TIMELINE_END * 60;
                          return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }} key={minutes}><span>{isHour ? hourLabel(minutes) : ""}</span></div>;
                        })}
                        {isViewingToday && <NowLine lang={lang} />}
                        {scheduledTasks.length === 0 && schedulePreviews.length === 0 && !drag && <div className="df-timeline-empty"><div className="blob-accent" />{t(lang, "timeline.dragHere")}</div>}
                        {hoverSlot && drag && !drag.outsideTimeline && <PreviewBlock task={(() => { const t = tasks.find((task) => task.id === drag.taskId); if (t) return t; const r = recordToTaskMap.get(drag.taskId); if (r) return r; return eventVisibleTimeline.tasks.find((task) => task.id === drag.taskId); })()} startTime={hoverSlot} duration={drag.duration} draggingBlock={drag.kind === "block"} conflict={hasScheduleConflict(hoverSlot, addMinutes(hoverSlot, drag.duration), drag.taskId)} />}
                        {placementPreviewTask && placementPreview && placementPreview.date === timelineDate && (
                          <PreviewBlock
                            task={placementPreviewTask}
                            startTime={placementPreview.startTime}
                            duration={placementPreview.durationMinutes}
                            extraStyle={{ ["--df-preview" as any]: "1" } as CSSProperties}
                          />
                        )}
                        {scheduledTasks.filter((task) => !(drag?.kind === "block" && drag.taskId === task.id)).map((task) => {
                          // Use dailyCanvasWidth from ResizeObserver if available,
                          // otherwise fall back to synchronously reading the DOM ref.
                          const liveEl = timelineCanvasRef.current;
                          const liveW = liveEl ? liveEl.getBoundingClientRect().width : 0;
                          const avail = dailyCanvasWidth > 0 ? dailyCanvasWidth : liveW;
                          const innerW = avail > 0 ? avail - 16 : 0;
                          const baseLeft = 8;
                          const gap = 4;
                          const cs = innerW > 0 ? computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap, "daily") : null;
                          const left = cs ? cs.left : baseLeft;
                          const width = cs ? cs.width : innerW;
                          const extraStyle: CSSProperties | undefined = innerW > 0 ? { left, width } : undefined;

                          const isPreview = previewIdByClonedId.has(task.id);
                          return (
                            <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} onHover={setHoveredBlock} onEdit={() => {
                              if (!suppressBlockClickRef.current) openTaskEdit(task);
                            }} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                              createProjectForTask(task.id, title);
                            }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} extraStyle={{ ...extraStyle, ...(isPreview ? { ["--df-preview" as any]: "1" } as CSSProperties : {}) }}
                              onAcceptPreview={isPreview ? () => acceptOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                              onCancelPreview={isPreview ? () => cancelOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                              viewMode="daily"
                              lang={lang}
                            />
                          );
                        })}
                        {dragCreate && (
                          <div className="drag-create-preview" style={{
                            position: "absolute", zIndex: 99998, borderRadius: "12px",
                            overflow: "visible",
                            top: `${dragCreate.top}px`, left: `${dragCreate.left}px`,
                            width: `${dragCreate.width}px`, height: `${dragCreate.height}px`,
                          }}>
                            {dragCreate.committed ? (
                              <DragCreateQuickAdd state={dragCreate} projects={projects}
                                onSave={(title, projectId) => {
                                  if (!data) return;
                                  const { date, startMinutes, endMinutes } = dragCreate;
                                  const startTime = minutesToTime(startMinutes);
                                  const endTime = minutesToTime(endMinutes);
                                  const estimatedH = (endMinutes - startMinutes) / 60;
                                  const task = makeTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: date, estimatedHours: estimatedH });
                                  const scheduledRecord = createScheduledRecord(task, date, startTime, endMinutes - startMinutes);
                                  void saveData({
                                    ...data,
                                    tasks: [...data.tasks, { ...task, plannedForDate: date, executionLane: undefined, timelineRecords: [scheduledRecord] }]
                                  });
                                  requestTimelineFocus({ date, startTime, taskId: scheduledRecord.id, source: "schedule" });
                                  setDragCreate(null);
                                  showToast(t(lang, "timeline.addedToTimeline"));
                                }}
                                onCancel={() => setDragCreate(null)}
                              />
                            ) : (
                              null
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="df-view-switch-vertical" aria-label={t(lang, "timeline.switchView")}>
                {([
                  ["daily", viewLabel(lang, "daily")],
                  ["3day", viewLabel(lang, "3day")],
                  ["weekly", viewLabel(lang, "weekly")],
                  ["month", viewLabel(lang, "month")]
                ] as Array<[TimelineView, string]>).map(([view, label]) => <button key={view} className={timelineView === view ? "active" : ""} onClick={() => { setTimelineView(view); setDragCreate(null); }}>{label}</button>)}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <Suspense fallback={<div className="df-loading-inline">规划加载中...</div>}>
          <PlanningViewLazy lang={lang} data={data} projects={projects} tasks={tasks} collapsed={collapsedBranches} setCollapsed={setCollapsedBranches} pickMode={planningPickMode} picks={planningPicks} onExitPickMode={() => setPlanningPickMode(false)} onAddPick={addPlanningPick} onUpdatePick={updatePlanningPick} onRemovePick={removePlanningPick} onClearPicks={clearPlanningPicks} onApplyPicks={applyPlanningPicks} onProjectEdit={openProjectEdit} onTaskEdit={openTaskEdit} onTaskUpdate={updateTask} onTaskCreate={createTaskInProject} onTaskDelete={(taskId) => {
            void saveData({ ...data, tasks: data.tasks.filter((task) => task.id !== taskId) });
          }} />
        </Suspense>
      )}

      <button className="df-add-fab df-icon-action i-plus" data-tip={t(lang, "fab.add")} aria-label={t(lang, "fab.add")} onClick={() => openAdd("task")} />
      {!settings.hideAi && <button className="df-ai-fab df-icon-action i-ai" data-tip={t(lang, "fab.askNavo")} aria-label={t(lang, "fab.askNavo")} onClick={() => setAiOpen((open) => !open)} />}

      {drawerOpen && <div className="df-drawer-backdrop" onMouseDown={() => editingId && addType === "task" ? closeTaskDrawer({ autoSave: true }) : closeTaskDrawer()} />}
      {drawerOpen && <EditDrawer type={addType} setType={(type) => { setAddType(type); if (!editingId) setForm(defaultForm(type)); }} form={form} setForm={setForm} projects={projects} editing={Boolean(editingId)} task={tasks.find((task) => task.id === editingId)} event={events.find((event) => event.id === editingId)} today={today} advancedOpen={advancedOpen} setAdvancedOpen={(open) => { setAdvancedOpen(open); void saveSettings({ addAdvancedOpen: open }); }} onClose={() => closeTaskDrawer(editingId && addType === "task" ? { autoSave: true } : undefined)} onSave={saveForm} onDelete={deleteEditingItem} onCopy={copyEditingTask} onConvertToEvent={() => convertTaskToEvent(editingId)} onConvertToTask={() => convertEventToTask(editingId)} onTaskUpdate={updateTask} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onToggleDone={() => updateTask(editingId, { completed: !tasks.find((task) => task.id === editingId)?.completed })} onNextAction={() => void generateNextAction()} onCreateProject={quickCreateProject} editingRecordId={editingRecordId} setEditingRecordId={setEditingRecordId} editingOccurrence={editingOccurrence} data={data} saveData={saveData} onSaveRecurrence={saveTaskRecurrence} onCancelOccurrence={cancelRecurringOccurrence} onReplanOccurrence={replanRecurringOccurrence} onCancelAllRecurrence={cancelAllRecurringFuture} lang={lang} />}
      {aiOpen && <AiPanel input={aiInput} setInput={setAiInput} busy={aiBusy} onSend={() => void sendAi()} onClose={() => { setAiOpen(false); setAiMessages([]); clearAiAttachment(); }} messages={aiMessages} onConfirmAction={(messageId, action) => void confirmAiAction(action, messageId)} onDismissAction={(messageId, action) => dismissAiAction(action, messageId)} onToggleAction={(messageId, index) => setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, selectedActions: { ...message.selectedActions, [index]: message.selectedActions?.[index] === false } } : message))} onSetAllActions={(messageId, checked) => setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, selectedActions: Object.fromEntries((message.actions || []).map((_, index) => [index, checked])) } : message))} onAdoptSelected={(messageId) => void adoptSelectedAiActions(messageId)} onRejectSelected={rejectSelectedAiActions} onViewImport={viewAiImport} onUndoImport={(messageId) => void undoAiImport(messageId)} projectList={projects.map((p) => ({ id: p.id, title: p.title, color: p.color }))} lang={lang} attachment={aiAttachment} attachmentStatus={aiAttachmentStatus} onAttachment={(file) => void handleAiAttachment(file)} onClearAttachment={clearAiAttachment} />}
      {utilityPanel && settings && <UtilityPanel kind={utilityPanel} settings={settings} authEmail={authState?.user?.email || ""} onClose={() => setUtilityPanel(null)} onSave={(patch) => void saveSettings(patch)} onShowAbout={() => setUtilityPanel("about")} onSignOut={authState?.mode === "cloud" && authState.user ? (() => void handleSignOut()) : undefined} onDeleteAccount={authState?.mode === "cloud" && authState.user ? (() => void handleDeleteAccount()) : undefined} lang={lang} />}
      {drag?.kind === "block" && drag.outsideTimeline && drag.pointer && <FloatingUnschedulePreview task={(() => { const t = tasks.find((task) => task.id === drag.taskId); if (t) return t; const r = recordToTaskMap.get(drag.taskId); return r || undefined; })()} pointer={drag.pointer} lang={lang} />}
      {floatingTimeAdd && <FloatingTimeAddInput add={floatingTimeAdd} projects={projects} onSave={saveFloatingTimeAdd} onCancel={() => setFloatingTimeAdd(null)} />}
      {toast && (
        <div className={toastAction ? "df-toast df-toast-undo" : "df-toast"}>
          <span className="df-toast-message">{toast}</span>
          {toastAction && (
            <button className="df-toast-undo-btn" onClick={toastAction.onClick}>{toastAction.label}</button>
          )}
        </div>
      )}
      {sourceOpen && <SourceModal tasks={tasks} projects={projects} today={today} anchorRect={sourceAnchorRect} defaultFilter={sourceFilterProjectId || undefined} onClose={() => { setSourceOpen(false); setSourceFilterProjectId(null); setSourceAnchorRect(null); }} onJoin={(taskIds) => { taskIds.forEach((id) => addPlanningPick(id)); showToast(`已添加 ${taskIds.length} 个任务到候选`); setSourceOpen(false); setSourceFilterProjectId(null); setSourceAnchorRect(null); }} lang={lang} />}
    </div>
  );
}

function FloatingUnschedulePreview({ task, pointer, lang }: { task?: Task; pointer: { x: number; y: number }; lang: Language }) {
  if (!task) return null;
  return <div className="df-floating-unschedule" style={{ left: pointer.x + 14, top: pointer.y + 14 }}><strong>{task.title}</strong><span>{t(lang, "toast.draggedBackToCandidates")}</span></div>;
}

/** Floating quick-add popup for time-slot clicks on day / 3-day / week views. */
function FloatingTimeAddInput({ add, projects, onSave, onCancel }: { add: NonNullable<FloatingTimeAdd>; projects: Project[]; onSave: (title: string, projectId: string | null) => void; onCancel: () => void }) {
  const [input, setInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Dismiss on click outside BOTH input box and project menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputBoxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onCancel();
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onCancel]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleInputChange(value: string) {
    setInput(value);
    const hm = value.match(/#([^\s#]*)$/);
    setProjectQuery(hm ? hm[1] || "" : "");
  }

  function selectProject(project: Project) {
    setSelectedProject(project);
    const base = input.replace(/#[^\s#]*$/, "").trimEnd();
    setInput(`${base}${base ? " " : ""}#${project.title}`);
    setProjectQuery("");
    inputRef.current?.focus();
  }

  function handleSave() {
    const cleanTitle = input.replace(/#[^\s#]+/g, "").trim();
    if (!cleanTitle) return;
    onSave(cleanTitle, selectedProject?.id || null);
  }

  const showProjectMenu = input.includes("#") && !input.endsWith(" ");
  const filtered = showProjectMenu
    ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
    : [];

  // Compact mode for narrow columns
  const compact = typeof add.width === "number" && add.width < 110;
  const placeholder = compact ? "任务名" : "输入任务名，#选择项目";

  // Clamp popup position to viewport; use column-aligned width
  const INPUT_H = 36;
  const GAP = 8;
  const popW = Math.min(add.width || 300, window.innerWidth - GAP * 2);
  let left = Math.min(add.left, window.innerWidth - popW - GAP);
  left = Math.max(left, GAP);
  let top = Math.min(add.top, window.innerHeight - INPUT_H - 60);
  top = Math.max(top, GAP);

  // Project menu position (sibling, below input box)
  const MENU_LEFT = left;
  const menuTop = top + INPUT_H + 6;
  const menuWidth = Math.max(220, popW);
  let menuLeft = MENU_LEFT;
  if (menuLeft + menuWidth > window.innerWidth - 8) {
    menuLeft = window.innerWidth - menuWidth - 8;
  }

  return (
    <>
      {/* Input box — independent floating layer */}
      <div ref={inputBoxRef} className="df-quick-add-input-box"
        style={{
          position: "fixed", top, left, width: popW, height: INPUT_H, zIndex: 999999,
        }}
      >
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } if (e.key === "Escape") onCancel(); }}
          placeholder={placeholder} />
        <button onClick={handleSave}
          disabled={!input.replace(/#[^\s#]+/g, "").trim()}
          className="df-quick-add-confirm">✓</button>
      </div>
      {/* Project menu — independent floating layer (sibling, not child) */}
      {showProjectMenu && filtered.length > 0 && (
        <div ref={menuRef} className="df-quick-add-project-menu"
          style={{
            position: "fixed", top: menuTop, left: menuLeft, width: menuWidth, zIndex: 1000000,
          }}
        >
          {filtered.map((p) => (
            <button key={p.id} onMouseDown={(e) => { e.preventDefault(); selectProject(p); }}
            >#{p.title}</button>
          ))}
        </div>
      )}
    </>
  );
}

/** Quick-add popover for all-day bar clicks. */
function AllDayQuickAddPopover({ add, projects, onSave, onCancel, absolute }: { add: NonNullable<AllDayQuickAdd>; projects: Project[]; onSave: (title: string, projectId: string | null) => void; onCancel: () => void; absolute?: boolean }) {
  const [input, setInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputBoxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onCancel();
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onCancel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleInputChange(value: string) {
    setInput(value);
    const hm = value.match(/#([^\s#]*)$/);
    setProjectQuery(hm ? hm[1] || "" : "");
  }

  function selectProject(project: Project) {
    setSelectedProject(project);
    const base = input.replace(/#[^\s#]*$/, "").trimEnd();
    setInput(`${base}${base ? " " : ""}#${project.title}`);
    setProjectQuery("");
    inputRef.current?.focus();
  }

  function handleSave() {
    if (!input.trim()) return;
    const cleanTitle = input.replace(/#[^\s#]+/g, "").trim();
    if (!cleanTitle) return;
    onSave(cleanTitle, selectedProject?.id || null);
  }

  const showProjectMenu = input.includes("#") && !input.endsWith(" ");
  const filtered = showProjectMenu
    ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
    : [];

  // Align popover with the column
  const INPUT_H = 36;
  let pos: "absolute" | "fixed" | "relative" = "fixed";
  let top: number | undefined;
  let left: number | string | undefined;
  let width: number | string = "100%";
  if (absolute) {
    pos = "relative";
    top = undefined;
    left = undefined;
    width = "100%";
  } else {
    pos = "fixed";
    top = add.top;
    left = add.left;
    width = add.width;
    if (top! + INPUT_H + 60 > window.innerHeight) {
      top = add.top - INPUT_H - 8;
    }
    top = Math.max(top!, 8);
  }

  // Compact mode
  const compact = !absolute && typeof width === "number" && width < 110;
  const placeholder = compact ? "任务名" : "输入任务名，#选择项目";

  // Menu position (independent sibling layer)
  const menuTop = typeof top === "number" ? top + INPUT_H + 6 : 0;
  const menuWidth = typeof width === "number" ? Math.max(220, width) : 220;
  let menuLeft = typeof left === "number" ? left : 8;
  if (menuLeft + menuWidth > window.innerWidth - 8) {
    menuLeft = window.innerWidth - menuWidth - 8;
  }

  const popup = (
    <>
      <div ref={inputBoxRef} className="df-quick-add-input-box"
        style={{ position: pos, top, left, width, height: INPUT_H, zIndex: 999999 } as React.CSSProperties}
      >
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } if (e.key === "Escape") onCancel(); }}
          placeholder={placeholder} />
        <button onClick={handleSave}
          disabled={!input.trim()}
          className="df-quick-add-confirm">✓</button>
      </div>
      {showProjectMenu && filtered.length > 0 && (
        <div ref={menuRef} className="df-quick-add-project-menu"
          style={{
            position: "fixed", top: menuTop, left: menuLeft, width: menuWidth, zIndex: 1000000,
          }}
        >
          {filtered.map((p) => (
            <button key={p.id} onMouseDown={(e) => { e.preventDefault(); selectProject(p); }}
            >#{p.title}</button>
          ))}
        </div>
      )}
    </>
  );

  if (absolute) return popup;
  return createPortal(popup, document.getElementById("df-portal-target") || document.body);
}

const RECURRENCE_OPTIONS: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: "weekly", label: "每周" },
  { value: "biweekly", label: "每 2 周" },
  { value: "monthly", label: "每月" },
  { value: "quarterly", label: "每 3 个月" },
  { value: "weekdays", label: "工作日" },
  { value: "weekends", label: "周末" },
  { value: "daily", label: "每天" },
  { value: "none", label: "无" },
];

type CandidateTimeSettings = {
  date: string;
  startTime: string;
  durationMinutes: number;
  allDay: boolean;
  clearSchedule?: boolean;
};

function recurrenceLabel(recurrence?: TaskRecurrence) {
  if (!recurrence || recurrence.frequency === "none") return "";
  return RECURRENCE_OPTIONS.find((item) => item.value === recurrence.frequency)?.label || "重复";
}

function TaskCard({
  task,
  projects,
  focusDate,
  placementPreview,
  onQuickDuration,
  onProjectChange,
  onSaveNote,
  onDelete,
  onToggleDone,
  onClick,
  onDragStart,
  onDragEnd,
  onStartPlacementPreview,
  onCancelPlacementPreview,
  onConfirmPlacementPreview,
  onApplyTimeSettings,
  onSaveDueDate,
  onSaveRecurrence,
  lang,
}: {
  task: Task;
  projects: Project[];
  focusDate: string;
  placementPreview: PlacementPreview;
  onQuickDuration: (minutes: number) => void;
  onProjectChange: (projectId: string) => void;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onClick: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onStartPlacementPreview: () => void;
  onCancelPlacementPreview: () => void;
  onConfirmPlacementPreview: () => void;
  onApplyTimeSettings: (settings: CandidateTimeSettings) => void;
  onSaveDueDate: (date: string) => void;
  onSaveRecurrence: (recurrence?: TaskRecurrence) => void;
  lang: Language;
}) {
  const [openPanel, setOpenPanel] = useState<"more" | null>(null);
  const [popoverOpen, setPopoverOpen] = useState<"duration" | "deadline" | null>(null);
  const [morePopover, setMorePopover] = useState<"project" | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate || focusDate);
  const [noteDraft, setNoteDraft] = useState(task.notes || "");
  const [noteEditing, setNoteEditing] = useState(false);
  const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrence>(() => ({
    mode: task.recurrence?.mode || "flexible",
    frequency: task.recurrence?.frequency || "weekly",
    startDate: task.recurrence?.startDate || task.dueDate || focusDate,
    startTime: task.recurrence?.startTime || "09:00",
    durationMinutes: task.recurrence?.durationMinutes || Math.max(Math.round((task.estimatedHours || 0.5) * 60), 30),
    endDate: task.recurrence?.endDate,
    count: task.recurrence?.count,
  }));
  const overdue = task.dueDate < focusDate ? dateDiff(task.dueDate, focusDate) : 0;
  const isEvent = isEventDisplayTask(task);
  const cardAccentColor = isEvent
    ? categories[task.category]?.color || "var(--accent-active)"
    : projects.find((p) => String(p.id) === String(task.projectId || ""))?.color || "var(--accent-active)";
  const recurringLocked = hasRecurringRule(task);
  const isPlacementArmed = placementPreview?.taskId === task.id;

  useEffect(() => {
    setDraftDueDate(task.dueDate || focusDate);
    setNoteDraft(task.notes || "");
    setNoteEditing(false);
    setMorePopover(null);
    setRecurrenceDraft({
      mode: task.recurrence?.mode || "flexible",
      frequency: task.recurrence?.frequency || "weekly",
      startDate: task.recurrence?.startDate || task.dueDate || focusDate,
      startTime: task.recurrence?.startTime || "09:00",
      durationMinutes: task.recurrence?.durationMinutes || Math.max(Math.round((task.estimatedHours || 0.5) * 60), 30),
      endDate: task.recurrence?.endDate,
      count: task.recurrence?.count,
    });
  }, [focusDate, task]);

  const stop = (event: React.MouseEvent) => event.stopPropagation();
  const repeatText = recurrenceLabel(task.recurrence);
  const isMoreOpen = openPanel === "more";

  return (
    <>
      <article
        className={`df-task-card ${overdue > 0 && !isEvent ? "overdue" : ""} ${task.completed && !isEvent ? "completed" : ""} ${openPanel ? "expanded" : ""} ${isMoreOpen ? "more-open" : ""} ${isPlacementArmed ? "placement-armed" : ""} ${recurringLocked && !isEvent ? "recurring-locked" : ""} ${isEvent ? "is-event" : ""}`}
        style={{ "--cat": cardAccentColor } as React.CSSProperties}
        data-placement-card={task.id}
        data-kind={isEvent ? "event" : "task"}
        draggable={isEvent || !recurringLocked}
        onDragStart={!isEvent && recurringLocked ? undefined : onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        title={!isEvent && recurringLocked ? t(lang, "taskCard.recurringHint") : t(lang, "taskCard.dragHint")}
      >
        {!isEvent && <button
          className={`df-block-check ${task.completed ? "completed" : ""}`}
          title={task.completed ? t(lang, "taskCard.markIncomplete") : t(lang, "taskCard.markComplete")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }}
        >
          {task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
        </button>}
        {!isMoreOpen && <div className="df-candidate-row">
          <div className="df-candidate-main">
            {isEvent ? <span className="df-candidate-kind">EVENT</span> : null}
            <strong className="df-candidate-title" title={task.title}>{task.title}</strong>
            {repeatText ? <span className="df-candidate-repeat-badge" title={`${t(lang, "taskCard.recurring")}：${repeatText}`}>↻ {repeatText}</span> : null}
          </div>
          {!isEvent && <button
            className="df-duration-pill"
            title={t(lang, "taskCard.adjustDuration")}
            onClick={(event) => {
              event.stopPropagation();
              setPopoverOpen((current) => current === "duration" ? null : "duration");
            }}
          >
            {formatDuration(task.estimatedHours || 0.5)}
          </button>}
          {!isEvent && <button
            className="df-icon-button icon-schedule"
            title={t(lang, "taskCard.openScheduling")}
            onClick={(event) => {
              event.stopPropagation();
              setPopoverOpen(null);
              onStartPlacementPreview();
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="13" height="11.5" rx="2" />
              <path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13" />
            </svg>
          </button>}
          {!isEvent && <button
            className={`df-icon-button ${isMoreOpen ? "icon-collapse" : "icon-expand"}`}
            title={isMoreOpen ? t(lang, "taskCard.collapseMore") : t(lang, "taskCard.expandMore")}
            onClick={(event) => {
              event.stopPropagation();
              setPopoverOpen(null);
              setOpenPanel((current) => current === "more" ? null : "more");
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isMoreOpen ? <path d="M5 12l5-5 5 5" /> : <path d="M5 8l5 5 5-5" />}
            </svg>
          </button>}
        </div>}

        {isPlacementArmed && placementPreview && (
          <div className="df-candidate-placement-bar" onClick={stop}>
            <div className="df-candidate-placement-summary">
              <strong>{t(lang, "taskCard.expectedAt")} {shortDate(placementPreview.date)} {placementPreview.startTime}</strong>
              <span>{formatMinutes(placementPreview.durationMinutes)} · {t(lang, "taskCard.autoFocused")}</span>
            </div>
            <div className="df-candidate-placement-actions">
              <button className="df-inline-action primary" onClick={onConfirmPlacementPreview}>{t(lang, "taskCard.addToQueue")}</button>
              <button className="df-inline-action" onClick={onCancelPlacementPreview}>{t(lang, "taskCard.cancel")}</button>
            </div>
          </div>
        )}

        {popoverOpen === "duration" && (
          <div className="df-card-popover duration-list" onClick={stop}>
            {DURATION_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                className={Math.round((task.estimatedHours || 0.5) * 60) === minutes ? "active" : ""}
                onClick={() => {
                  onQuickDuration(minutes);
                  setPopoverOpen(null);
                }}
              >
                {formatMinutes(minutes)}
              </button>
            ))}
          </div>
        )}

        {isMoreOpen && (
          <div className="df-task-card-more" onClick={stop}>
            <div className="df-task-card-more-head">
              <div className="df-candidate-main">
                <strong className="df-candidate-title" title={task.title}>{task.title}</strong>
                {repeatText ? <span className="df-candidate-repeat-badge" title={`${t(lang, "taskCard.recurring")}：${repeatText}`}>↻ {repeatText}</span> : null}
              </div>
              <div className="df-task-card-more-actions">
                <button
                  className={`df-icon-button ${repeatOpen ? "is-active" : ""}`}
                  title={t(lang, "taskCard.duplicate")}
                  onClick={() => setRepeatOpen(true)}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 6h3V3" />
                    <path d="M17 6a6.5 6.5 0 0 0-11-1.8" />
                    <path d="M6 14H3v3" />
                    <path d="M3 14a6.5 6.5 0 0 0 11 1.8" />
                  </svg>
                </button>
                <button
                  className={`df-icon-button ${morePopover === "project" ? "is-active" : ""}`}
                  title={t(lang, "taskCard.project")}
                  onClick={() => {
                    setPopoverOpen(null);
                    setMorePopover((current) => current === "project" ? null : "project");
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 6h12" />
                    <path d="M4 10h9" />
                    <path d="M4 14h6" />
                    <path d="M15 10l2.5 2.5L20 10" transform="translate(-3 0)" />
                  </svg>
                </button>
                <button className="df-icon-button danger-lite" title={t(lang, "taskCard.delete")} onClick={onDelete}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4.5 6h11" />
                    <path d="M7.5 6V4.5h5V6" />
                    <path d="M6.5 6l.6 9h5.8l.6-9" />
                  </svg>
                </button>
                <button className="df-icon-button icon-close accent-close" title={t(lang, "taskCard.collapseMore")} onClick={() => setOpenPanel(null)}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 6l8 8M14 6l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {morePopover === "project" && (
              <div className="df-card-popover project-list" onClick={stop}>
                <button className={!task.projectId ? "active" : ""} onClick={() => {
                  onProjectChange("");
                  setMorePopover(null);
                }}>{t(lang, "taskCard.unassigned")}</button>
                {projects.map((project) => (
                  <button key={project.id} className={String(project.id) === String(task.projectId || "") ? "active" : ""} onClick={() => {
                    onProjectChange(project.id);
                    setMorePopover(null);
                  }}>
                    # {project.title}
                  </button>
                ))}
              </div>
            )}

            <div className={`df-card-popover note-output ${noteEditing ? "editing" : ""}`}>
              <div className="df-note-output-head">
                <span>{t(lang, "taskCard.notes")}</span>
                <button className="df-icon-button" title={noteEditing ? t(lang, "taskCard.cancelEdit") : t(lang, "taskCard.editNotes")} onClick={() => setNoteEditing((current) => !current)}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 14.5V16h1.5l8-8-1.5-1.5-8 8Z" />
                    <path d="M11.5 6.5l1.5 1.5" />
                  </svg>
                </button>
              </div>
              {!noteEditing ? (
                <div className={`df-note-output-body ${task.notes ? "" : "placeholder"}`}>{task.notes || t(lang, "taskCard.noNotes")}</div>
              ) : (
                <>
                  <textarea rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={t(lang, "taskCard.addNotePlaceholder")} />
                  <div className="df-inline-form-actions">
                    <button className="active" onClick={() => {
                      onSaveNote(noteDraft);
                      setNoteEditing(false);
                    }}>{t(lang, "taskCard.saveNote")}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </article>

      {repeatOpen && createPortal(
        <div className="df-modal-backdrop" onClick={() => setRepeatOpen(false)}>
          <div className="df-repeat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="df-repeat-modal-head">
              <h3>设置重复规则</h3>
              <button className="df-icon-button icon-close" title="关闭" onClick={() => setRepeatOpen(false)}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l8 8M14 6l-8 8" />
                </svg>
              </button>
            </div>
            <div className="df-repeat-modal-body">
              <label className={`df-repeat-option ${recurrenceDraft.mode === "flexible" ? "selected" : ""}`}>
                <input type="radio" name={`recurrence-mode-${task.id}`} checked={recurrenceDraft.mode === "flexible"} onChange={() => setRecurrenceDraft((current) => ({ ...current, mode: "flexible" }))} />
                <div>
                  <strong>灵活重复</strong>
                  <span>不会自动固定到时间轴。每次重复任务会回到安排队列，等待你单独安排。</span>
                </div>
              </label>
              <label className={`df-repeat-option ${recurrenceDraft.mode === "scheduled" ? "selected" : ""}`}>
                <input type="radio" name={`recurrence-mode-${task.id}`} checked={recurrenceDraft.mode === "scheduled"} onChange={() => setRecurrenceDraft((current) => ({ ...current, mode: "scheduled" }))} />
                <div>
                  <strong>固定重复</strong>
                  <span>每次重复都按固定日期和时间显示在时间轴中，适合课程、会议和习惯任务。</span>
                </div>
              </label>

              {recurrenceDraft.mode === "flexible" ? (
                <div className="df-repeat-form">
                  <label>
                    <span>开始重复于</span>
                    <input type="date" value={recurrenceDraft.startDate || focusDate} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, startDate: event.target.value }))} />
                  </label>
                  <label>
                    <span>重复频率</span>
                    <select value={recurrenceDraft.frequency} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, frequency: event.target.value as RecurrenceFrequency }))}>
                      {RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="df-repeat-form">
                  <label>
                    <span>开始日期</span>
                    <input type="date" value={recurrenceDraft.startDate || focusDate} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, startDate: event.target.value }))} />
                  </label>
                  <label>
                    <span>开始时间</span>
                    <input type="time" value={recurrenceDraft.startTime || "09:00"} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, startTime: event.target.value }))} />
                  </label>
                  <label>
                    <span>时长</span>
                    <select value={recurrenceDraft.durationMinutes || 30} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}>
                      {DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>重复频率</span>
                    <select value={recurrenceDraft.frequency} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, frequency: event.target.value as RecurrenceFrequency }))}>
                      {RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
            <div className="df-repeat-modal-actions">
              <button
                className="primary"
                onClick={() => {
                  onSaveRecurrence(recurrenceDraft.frequency === "none" ? undefined : recurrenceDraft);
                  setRepeatOpen(false);
                }}
              >
                保存重复规则
              </button>
              <button onClick={() => setRepeatOpen(false)}>关闭</button>
            </div>
          </div>
        </div>,
        document.getElementById("df-portal-target") || document.body
      )}
    </>
  );
}

function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours}h${rest}m` : `${hours}h`;
}

function formatDuration(hours: number) {
  return formatMinutes(Math.round(hours * 60));
}

/** Quick‑add input shown on top of a drag‑created preview block. */
function DragCreateQuickAdd({ state, projects, onSave, onCancel }: {
  state: NonNullable<DragCreateState>;
  projects: Project[];
  onSave: (title: string, projectId: string | null) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onCancel();
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onCancel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleInputChange(value: string) {
    setInput(value);
    const hm = value.match(/#([^\s#]*)$/);
    setProjectQuery(hm ? hm[1] || "" : "");
  }

  function handleSave() {
    const cleanTitle = input.replace(/#[^\s#]+/g, "").trim();
    if (!cleanTitle) return;
    onSave(cleanTitle, selectedProject?.id || null);
  }

  const showProjectMenu = input.includes("#") && !input.endsWith(" ");
  const filtered = showProjectMenu
    ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
    : [];

  const durationH = ((state.endMinutes - state.startMinutes) / 60).toFixed(1);
  const compact = state.width < 110;

  return (
    <div ref={containerRef} className="drag-create-quick-add"
      style={{
        position: "absolute", zIndex: 99999,
        top: 0, left: 0, width: "100%", height: 36,
        display: "flex", alignItems: "center",
        boxSizing: "border-box", padding: "4px 6px",
        borderRadius: "12px 12px 0 0",
      }}>
      <div style={{
        display: "flex", alignItems: "center", gap: compact ? "3px" : "6px",
        flex: 1, minWidth: 0,
      }}>
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } if (e.key === "Escape") onCancel(); }}
          placeholder={compact ? "任务名" : "输入任务名，#选择项目"}
          style={{
            flex: 1, minWidth: 0, border: "none",
            background: "transparent", color: "inherit",
            fontSize: compact ? "11px" : "13px", padding: 0, outline: "none",
          }} />
        <button onClick={handleSave}
          disabled={!input.replace(/#[^\s#]+/g, "").trim()}
          className="df-quick-add-confirm">✓</button>
      </div>
      {showProjectMenu && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100000,
          background: "var(--surface-card, #fff)",
          border: "1px solid var(--border-subtle, #cbd5e1)",
          borderRadius: "8px", padding: "4px", marginTop: "4px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
          maxHeight: "200px", overflowY: "auto",
        }}>
          {filtered.map((p) => (
            <button key={p.id} onMouseDown={(e) => { e.preventDefault();
              setSelectedProject(p);
              const base = input.replace(/#[^\s#]*$/, "").trimEnd();
              setInput(`${base}${base ? " " : ""}#${p.title}`);
              setProjectQuery("");
              inputRef.current?.focus();
            }} style={{
              display: "block", width: "100%", textAlign: "left",
              border: "none", background: "transparent", padding: "6px 8px",
              borderRadius: "6px", color: "var(--text-main)", cursor: "pointer",
            }}># {p.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Icon for tasks that were returned to planning but still show on timeline.
 *  Three horizontal bars + a checkmark in the bottom-right.
 *  Uses the project color for fill/stroke via currentColor. */
function ReturnedToPlanIcon({ color }: { color?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" style={color ? { color } : undefined}>
      {/* Soft background circle using project color at low opacity */}
      <circle cx="11.5" cy="11.5" r="3.5" fill="currentColor" opacity="0.14" />
      {/* Three horizontal bars — thick, solid */}
      <rect x="1.5" y="2.5" width="9" height="2.2" rx="1.1" fill="currentColor" opacity="0.95" />
      <rect x="1.5" y="6.2" width="7" height="2.2" rx="1.1" fill="currentColor" opacity="0.72" />
      <rect x="1.5" y="9.9" width="5" height="2.2" rx="1.1" fill="currentColor" opacity="0.50" />
      {/* Checkmark in bottom-right */}
      <path d="M10.2 11.5L11.2 12.5L13 10.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function TimeBlock({ task, preview, projectName, projects, hovered, onHover, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onResizeStart, extraStyle, onAcceptPreview, onCancelPreview, viewMode, lang }: { task: Task; preview: ResizePreview; projectName: string; projects: Project[]; hovered: boolean; onHover: (id: string) => void; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.MouseEvent) => void; onResizeStart: (event: React.MouseEvent, edge: "start" | "end") => void; extraStyle?: CSSProperties; onAcceptPreview?: () => void; onCancelPreview?: () => void; viewMode?: "daily" | "3day" | "weekly"; lang: Language }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const isWeekView = viewMode === "weekly";
  const start = preview?.start || task.scheduledStart || "09:00";
  const end = preview?.end || task.scheduledEnd || addMinutes(start, taskDuration(task));
  const top = timeBlockTop(start);
  const height = Math.max(timeBlockHeight(start, end), SLOT_HEIGHT);
  const next = extractNextAction(task.notes);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isEvent = isEventDisplayTask(task);
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered]);
  const isPreview = Boolean(extraStyle && (extraStyle as Record<string, unknown>)["--df-preview" as string]);
  const currentRecordStatus =
    task.executionStatus ||
    ((task.timelineRecords || []).some((record) => record.executionStatus === "scheduled")
      ? "scheduled"
      : undefined);
  const isReturnedUnfinished = currentRecordStatus === "returned_unfinished";
  const isRecurring = Boolean(
    task.recurrence &&
    task.recurrence.frequency !== "none" &&
    currentRecordStatus === "scheduled" &&
    !isReturnedUnfinished &&
    !isPreview
  );
  const recurringLocked = hasRecurringRule(task);
  const recurringTextColor = isLightColor(stripeColor) ? "#10212F" : "#F8FBFF";
  return (
    <div className={`df-time-block priority-${task.priority} ${!isEvent && task.completed ? "completed" : ""} ${isEvent ? "is-event" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""} ${preview ? "resizing" : ""} ${projectOpen ? "project-open" : ""} ${isPreview ? "df-time-block-preview" : ""} ${isWeekView ? "df-time-block-week" : ""} ${height < 38 ? "short-block" : ""} ${isRecurring ? "recurring" : ""}`} data-kind={isEvent ? "event" : "task"} data-preview={isPreview ? "true" : undefined} data-view-mode={viewMode} style={{ top, height, "--cat": stripeColor, "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px", "--recurring-text": recurringTextColor, ...extraStyle } as CSSProperties} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => {
      onHover("");
    }} onMouseDown={isReturnedUnfinished || (!isEvent && recurringLocked) ? undefined : onDragStart} onClick={onEdit} onDoubleClick={onEdit} title={isReturnedUnfinished ? t(lang, "timeBlock.returnedHint") : !isEvent && recurringLocked ? t(lang, "timeBlock.recurringHint") : undefined}>
      {isPreview && <span className="df-preview-badge">{t(lang, "timeBlock.pending")}</span>}
      {!isReturnedUnfinished && (isEvent || !recurringLocked) && <button className="df-resize-dot top" aria-label={t(lang, "timeBlock.adjustStart")} onMouseDown={(event) => onResizeStart(event, "start")} />}
      {isEvent ? (
        <span className="df-event-indicator" title={t(lang, "timeBlock.eventTooltip")} aria-label={t(lang, "timeBlock.eventTooltip")} />
      ) : (
        <button className={`df-block-check ${task.completed ? "completed" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => {
          event.stopPropagation();
          onToggleDone();
        }} aria-label={task.completed ? t(lang, "timeBlock.markIncomplete") : t(lang, "timeBlock.markComplete")}>
          {task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : isReturnedUnfinished ? <ReturnedToPlanIcon /> : ""}
        </button>
      )}
      <div className="df-block-title-row">
        {isEvent ? <span className="df-event-kind-label">{t(lang, "form.event")}</span> : null}
        <strong title={task.title} style={isWeekView && !isRecurring ? { color: stripeColor } : undefined}>{task.title}</strong>
      </div>
      {isPreview && (
        <span className="df-preview-actions">
          <button className="df-preview-action accept" onClick={(e) => { e.stopPropagation(); onAcceptPreview?.(); }} aria-label={t(lang, "timeBlock.adopt")} title={t(lang, "timeBlock.adopt")}>✓</button>
          <button className="df-preview-action cancel" onClick={(e) => { e.stopPropagation(); onCancelPreview?.(); }} aria-label={t(lang, "timeBlock.cancel")} title={t(lang, "timeBlock.cancel")}>✕</button>
        </span>
      )}
      {!isEvent && hovered && <span className="df-block-project-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => {
          event.stopPropagation();
          setProjectOpen((open) => !open);
        }}># {projectName}</button>
      </span>}
      {next && <span className="df-next">{t(lang, "timeBlock.nextStep")}：{next}</span>}
      {!isReturnedUnfinished && (isEvent || !recurringLocked) && <button className="df-resize-dot bottom" aria-label={t(lang, "timeBlock.adjustEnd")} onMouseDown={(event) => onResizeStart(event, "end")} />}
      {projectOpen && projectBtnRef.current && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setProjectOpen(false)}>
          <div className="df-project-popover-portal" onClick={(event) => event.stopPropagation()} style={{
            position: 'fixed',
            top: projectBtnRef.current.getBoundingClientRect().bottom + 8,
            left: Math.max(8, projectBtnRef.current.getBoundingClientRect().right - 220),
            zIndex: 99999,
            width: 220,
            maxHeight: 260,
            overflow: 'auto',
            display: 'grid',
            gap: '4px',
            padding: '10px',
            border: '1px solid color-mix(in srgb, var(--accent-active) 26%, var(--border-soft))',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-soft)',
          } as CSSProperties}>
            <button style={{ textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', color: 'var(--df-text)' }} onClick={() => { onProjectChange(""); setProjectOpen(false); }}>{t(lang, "timeBlock.unassigned")}</button>
            {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
            <div className="df-project-create-line"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); } }} /><button onClick={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }}>✓</button></div>
          </div>
        </div>,
        document.querySelector('.df-app') || document.body
      )}
    </div>
  );
}

function PreviewBlock({ task, startTime, duration, draggingBlock, conflict, extraStyle }: { task?: Task; startTime: string; duration: number; draggingBlock?: boolean; conflict?: boolean; extraStyle?: CSSProperties }) {
  if (!task) return null;
  const top = timeBlockTop(startTime);
  const endTime = addMinutes(startTime, duration);
  const height = Math.max(timeBlockHeight(startTime, endTime), SLOT_HEIGHT);
  const color = categories[task.category]?.color || "#888";
  const isPlacementPreview = Boolean(extraStyle && (extraStyle as Record<string, unknown>)["--df-preview" as string]);
  const isEvent = isEventDisplayTask(task);
  return <div className={`df-drop-preview ${draggingBlock ? "moving-block" : ""} ${isPlacementPreview ? "placement-preview" : ""} ${isEvent ? "is-event" : ""}`} data-kind={isEvent ? "event" : "task"} style={{ top, height, "--cat": color, ...extraStyle } as CSSProperties}><strong>{task.title}</strong>{!draggingBlock && <span>{startTime} · {Math.round(duration)}min</span>}</div>;
}

function ProjectColorPicker({ value, onChange, compact = false, presets = PROJECT_COLOR_PRESETS }: { value: string; onChange: (color: string) => void; compact?: boolean; presets?: string[] }) {
  return (
    <div className={`df-project-color-picker ${compact ? "compact" : ""}`}>
      {presets.map((color) => <button key={color} type="button" className={value === color ? "active" : ""} style={{ "--project-color": color } as CSSProperties} aria-label={color} onClick={() => onChange(color)} />)}
      <label className="df-project-color-custom" style={{ "--project-color": value } as CSSProperties}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <span />
      </label>
    </div>
  );
}

function ProjectChoice({ project, onChoose, onColorChange }: { project: Project; onChoose: () => void; onColorChange: (color: string) => void }) {
  const [colorOpen, setColorOpen] = useState(false);
  const color = project.color || categories[project.category].color;
  return (
    <div className="df-project-choice">
      <button type="button" onClick={onChoose}># {project.title}</button>
      <span className="df-project-color-menu" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="df-project-color-dot-button" aria-label={`${project.title} color`} onClick={() => setColorOpen((open) => !open)}><span className="df-project-color-dot" style={{ "--project-color": color } as CSSProperties} /></button>
        {colorOpen && <ProjectColorPicker value={color} onChange={(nextColor) => { onColorChange(nextColor); setColorOpen(false); }} compact />}
      </span>
    </div>
  );
}

function QuickProjectPicker(props: {
  projects: Project[];
  value: string;
  open: boolean;
  newTitle: string;
  newColor: string;
  onOpenChange: (open: boolean) => void;
  onChange: (projectId: string) => void;
  onTitleChange: (title: string) => void;
  onColorChange: (color: string) => void;
  onProjectColorChange: (projectId: string, color: string) => void;
  onCreate: () => void;
  lang: Language;
}) {
  const selected = props.projects.find((project) => String(project.id) === String(props.value));
  const selectedColor = selected?.color || PROJECT_COLOR_PRESETS[0];
  const [newColorOpen, setNewColorOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        props.onOpenChange(false);
        setNewColorOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [props.open, props.onOpenChange]);

  return (
    <div ref={pickerRef} className="df-quick-project-picker" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="df-quick-project-trigger" onClick={() => props.onOpenChange(!props.open)}>
        <span className="df-project-color-dot" style={{ "--project-color": selectedColor } as CSSProperties} />
        <span>{selected ? `# ${selected.title}` : "#"}</span>
      </button>
      {props.open && <div className="df-project-popover df-quick-project-popover up">
        <button type="button" onClick={() => { props.onChange(""); props.onOpenChange(false); }}>{t(props.lang, "timeBlock.unassigned")}</button>
        {props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { props.onChange(project.id); props.onOpenChange(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}
        <div className="df-project-create-line">
          <input value={props.newTitle} placeholder="新项目名" onChange={(event) => props.onTitleChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); props.onCreate(); } }} />
          <span className="df-create-color-wrap" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="df-project-color-dot-button" aria-label="新项目颜色" onClick={() => setNewColorOpen((v) => !v)}>
              <span className="df-project-color-dot" style={{ "--project-color": props.newColor } as CSSProperties} />
            </button>
            {newColorOpen && <ProjectColorPicker value={props.newColor} onChange={(c) => { props.onColorChange(c); setNewColorOpen(false); }} compact />}
          </span>
          <button type="button" onClick={props.onCreate}>✓</button>
        </div>
      </div>}
    </div>
  );
}

function AllDayBlock({ task, projectName, projects, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onDragEnd, lang }: { task: Task; projectName: string; projects: Project[]; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.DragEvent) => void; onDragEnd: () => void; lang: Language }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isEvent = isEventDisplayTask(task);
  const isShortName = task.title.length <= 6;
  const isReturnedUnfinished = task.executionStatus === "returned_unfinished";
  const recurringLocked = hasRecurringRule(task);
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered]);
  return (
    <article className={`df-all-day-block ${!isEvent && task.completed ? "completed" : ""} ${isEvent ? "is-event" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""} ${projectOpen ? "project-open" : ""} ${isShortName ? "short-name" : ""}`} data-kind={isEvent ? "event" : "task"} draggable={!isEvent && !isReturnedUnfinished && !recurringLocked} style={{ "--cat": stripeColor, "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px" } as CSSProperties} onDragStart={isEvent || isReturnedUnfinished || recurringLocked ? undefined : onDragStart} onDragEnd={onDragEnd} onClick={onEdit} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setProjectOpen(false); setHovered(false); }} title={isReturnedUnfinished ? "已回到规划，可重新安排" : undefined}>
      {!isReturnedUnfinished && <div className="df-category-strip" />}
      {!isEvent && <button className={`df-block-check ${task.completed ? "completed" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""}`} onClick={(event) => {
        event.stopPropagation();
        onToggleDone();
      }}>{task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : isReturnedUnfinished ? <ReturnedToPlanIcon /> : ""}</button>}
      <strong title={task.title}>{isEvent ? <span className="df-event-kind-label">{t(lang, "form.event")}</span> : null}{task.title}</strong>
      {!isEvent && hovered && <span className="df-block-project-wrap" onClick={(event) => event.stopPropagation()}>
        <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => { event.stopPropagation(); setProjectOpen((open) => !open); }}># {projectName}</button>
        {projectOpen && projectBtnRef.current && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setProjectOpen(false)}>
            <div className="df-project-popover-portal" onClick={(event) => event.stopPropagation()} style={{
              position: 'fixed',
              top: projectBtnRef.current.getBoundingClientRect().bottom + 8,
              left: Math.max(8, projectBtnRef.current.getBoundingClientRect().right - 220),
              zIndex: 99999,
              width: 220,
              maxHeight: 260,
              overflow: 'auto',
              display: 'grid',
              gap: '4px',
              padding: '10px',
              border: '1px solid color-mix(in srgb, var(--accent-active) 26%, var(--border-soft))',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-soft)',
            } as CSSProperties}>
              <button style={{ textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', color: 'var(--df-text)' }} onClick={() => { onProjectChange(""); setProjectOpen(false); }}>{t(lang, "timeBlock.unassigned")}</button>
              {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
              <div className="df-project-create-line"><input value={newProjectTitle} placeholder={t(lang, "timeBlock.newProjectPlaceholder")} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); } }} /><button onClick={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }}>✓</button></div>
            </div>
          </div>,
          document.querySelector('.df-app') || document.body
        )}
      </span>}
    </article>
  );
}

function NowLine({ extraStyle }: { extraStyle?: CSSProperties; lang?: Language }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < TIMELINE_START * 60 || minutes > TIMELINE_END * 60) return null;
  const top = timeBlockTop(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  return <div className="df-now-line" style={{ top, ...extraStyle }} />;
}

function EditDrawer(props: {
  type: AddType; setType: (type: AddType) => void; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; projects: Project[]; editing: boolean; task?: Task; event?: CalendarEvent; today: string; advancedOpen: boolean; setAdvancedOpen: (open: boolean) => void; onClose: () => void; onSave: () => void; onDelete: () => void; onCopy: () => void; onConvertToEvent: () => void; onConvertToTask: () => void; onTaskUpdate: (taskId: string, patch: Partial<Task>) => void; onProjectColorChange: (projectId: string, color: string) => void; onToggleDone: () => void; onNextAction: () => void; onCreateProject: (title: string) => string;
  editingRecordId?: string; setEditingRecordId?: (id: string | undefined) => void; editingOccurrence?: EditingOccurrence; data?: PlannerData | null; saveData?: (next: PlannerData) => Promise<void>; onSaveRecurrence: (taskId: string, recurrence?: TaskRecurrence) => void; onCancelOccurrence: (taskId: string, occurrence: EditingOccurrence) => void; onReplanOccurrence: (taskId: string, occurrence: EditingOccurrence) => void; onCancelAllRecurrence: (taskId: string, cutoffDate: string) => void; lang: Language;
}) {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [detailPopoverPosition, setDetailPopoverPosition] = useState({ top: 0, left: 0, width: 280 });
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const durationTriggerRef = useRef<HTMLButtonElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [cancelAllConfirm, setCancelAllConfirm] = useState(false);
  const f = props.form;
  const set = (key: keyof FormState, value: FormState[keyof FormState]) => props.setForm((current) => ({ ...current, [key]: value }));
  const selectedProjectTitle = props.projects.find((project) => String(project.id) === String(f.projectId))?.title || "未归属";
  useEffect(() => {
    setNoteDraft(props.task?.notes || "");
    setNotesOpen(true);
    setNotesEditing(false);
    setCancelAllConfirm(false);
  }, [props.task?.id, props.task?.notes, props.editingOccurrence?.scheduledDate, props.editingRecordId]);
  function positionDetailPopover(trigger: HTMLButtonElement | null, width: number) {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    setDetailPopoverPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 360),
      left: Math.min(Math.max(rect.left, gutter), window.innerWidth - width - gutter),
      width,
    });
  }
  function toggleProjectPicker() {
    const next = !projectPickerOpen;
    setDurationPickerOpen(false);
    setProjectPickerOpen(next);
    if (next) positionDetailPopover(projectTriggerRef.current, 300);
  }
  function toggleDurationPicker() {
    const next = !durationPickerOpen;
    setProjectPickerOpen(false);
    setDurationPickerOpen(next);
    if (next) positionDetailPopover(durationTriggerRef.current, 260);
  }
  useLayoutEffect(() => {
    if (!projectPickerOpen && !durationPickerOpen) return;
    const update = () => positionDetailPopover(
      projectPickerOpen ? projectTriggerRef.current : durationTriggerRef.current,
      projectPickerOpen ? 300 : 260,
    );
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [projectPickerOpen, durationPickerOpen]);
  function createAndSelectProject() {
    const id = props.onCreateProject(newProjectTitle);
    if (!id) return;
    set("projectId", id);
    if (props.editing && props.type === "task" && props.task) {
      props.onTaskUpdate(props.task.id, { projectId: id });
    }
    setNewProjectTitle("");
    setProjectPickerOpen(false);
  }
  function setDurationMinutes(minutes: number) {
    const safeMinutes = Math.max(minutes, SLOT_MINUTES);
    set("estimatedHours", safeMinutes / 60);
    if (!props.editing || props.type !== "task" || !props.task) return;
    const patch: Partial<Task> = { estimatedHours: safeMinutes / 60 };
    if (props.task.scheduledStart) patch.scheduledEnd = addMinutes(props.task.scheduledStart, safeMinutes);
    props.onTaskUpdate(props.task.id, patch);
  }
  function addSubtask() {
    if (!props.task) return;
    const title = window.prompt("子任务名称");
    if (!title?.trim()) return;
    props.onTaskUpdate(props.task.id, {
      subtasks: [...(props.task.subtasks || []), { id: uid("subtask"), title: title.trim(), completed: false, done: false, order: Date.now(), createdAt: new Date().toISOString() }]
    });
  }
  function updateSubtask(subtaskId: string, patch: { title?: string; completed?: boolean }) {
    if (!props.task) return;
    props.onTaskUpdate(props.task.id, {
      subtasks: (props.task.subtasks || []).map((subtask) => subtask.id === subtaskId ? { ...subtask, ...patch, done: patch.completed ?? subtask.done } : subtask)
    });
  }
  function scheduleText(task: Task) {
    const activeRecord = props.editingRecordId
      ? (task.timelineRecords || []).find((r) => r.id === props.editingRecordId)
      : null;
    const occurrence = props.editingOccurrence;
    const sd = activeRecord?.scheduledDate || task.scheduledDate;
    const ss = activeRecord?.scheduledStart || occurrence?.scheduledStart || task.scheduledStart;
    const se = activeRecord?.scheduledEnd || task.scheduledEnd;
    if (sd && ss && se) {
      const dur = (timeToMinutes(se) - timeToMinutes(ss)) / 60;
      return `${sd} ${ss} - ${se} · ${formatDuration(dur)}`;
    }
    if (occurrence?.scheduledDate && occurrence.scheduledStart && task.recurrence) {
      return `${occurrence.scheduledDate} ${occurrence.scheduledStart} · ${formatMinutes(task.recurrence.durationMinutes || taskDuration(task))}`;
    }
    if (isRecurringScheduledTask(task) && task.recurrence?.startDate && task.recurrence.startTime) {
      return `${task.recurrence.startDate} ${task.recurrence.startTime} · ${recurrenceLabel(task.recurrence)} · ${formatMinutes(task.recurrence.durationMinutes || taskDuration(task))}`;
    }
    if (task.plannedForDate === props.today) return t(props.lang, "drawer.todayUnscheduled");
    if (task.dueDate) return `${task.dueDate} · ${formatDuration(f.estimatedHours || 0.5)}`;
    return t(props.lang, "drawer.unscheduled");
  }
  const eventDurationMinutes = f.dueTime
    ? Math.max(timeToMinutes(f.endTime || addMinutes(f.dueTime, f.recurrence?.durationMinutes || 60)) - timeToMinutes(f.dueTime), SLOT_MINUTES)
    : 0;
  const eventRecurrence = f.recurrence || {
    mode: f.dueTime ? "scheduled" as const : "flexible" as const,
    frequency: "weekly" as RecurrenceFrequency,
    startDate: f.dueDate || props.today,
    startTime: f.dueTime || undefined,
    durationMinutes: f.dueTime ? eventDurationMinutes || 60 : undefined,
    endDate: f.endDate || undefined,
  };
  if (props.editing && props.type === "event" && props.event) {
    const eventSchedule = f.dueTime
      ? `${f.dueDate} ${f.dueTime} - ${f.endTime || addMinutes(f.dueTime, eventDurationMinutes || 60)}`
      : `${f.dueDate}${f.endDate && f.endDate !== f.dueDate ? ` - ${f.endDate}` : ""} · ${t(props.lang, "drawer.allDayEvent")}`;
    const recurrenceText = recurrenceLabel(f.recurrence);
    return (
      <aside className="df-drawer df-task-detail df-event-detail" onMouseDown={(event) => event.stopPropagation()}>
        <section className="df-detail-hero-trevor">
          <textarea className="df-detail-title-trevor" value={f.title} onChange={(event) => set("title", event.target.value)} rows={1} placeholder={t(props.lang, "drawer.eventTitlePlaceholder")} spellCheck={false} />
        </section>

        <section className="df-detail-tag-row">
          <span className="df-detail-pill-trevor event-kind">{t(props.lang, "form.event")}</span>
          <span className="df-detail-pill-trevor">{eventSchedule}</span>
          {f.dueTime ? <span className="df-detail-pill-trevor">{formatMinutes(eventDurationMinutes || 60)}</span> : null}
          {recurrenceText ? <span className="df-detail-pill-trevor">↻ {recurrenceText}</span> : null}
        </section>

        <section className="df-detail-status-row">
          <button className="df-detail-pill-trevor action" onClick={props.onConvertToTask}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h6M6 3l3 3-3 3"/></svg>
            <span>{t(props.lang, "drawer.convertToTask")}</span>
          </button>
          <button className="df-detail-pill-trevor action danger" onClick={props.onDelete}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h8M4 3V2h4v1M3 3v6.5a1 1 0 001 1h4a1 1 0 001-1V3"/></svg>
            <span>{t(props.lang, "drawer.remove")}</span>
          </button>
        </section>

        <section className="df-event-detail-grid">
          <label>{t(props.lang, "drawer.startDate")}<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label>
          <label>{t(props.lang, "drawer.startTime")}<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label>
          <label>{t(props.lang, "drawer.endDate")}<input type="date" value={f.endDate} onChange={(event) => set("endDate", event.target.value)} /></label>
          <label>{t(props.lang, "drawer.endTime")}<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label>
        </section>

        <section className="df-detail-schedule-row">
          <button className={`df-detail-pill-trevor action ${recurrenceOpen ? "active" : ""}`} onClick={() => setRecurrenceOpen((open) => !open)}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="8" height="7" rx="1"/><path d="M2 5h8"/></svg>
            <span>{t(props.lang, "drawer.setRepeat")}</span>
          </button>
          <button className="df-detail-pill-trevor action" onClick={props.onSave}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7l2.5 2.5L10 3"/></svg>
            <span>{t(props.lang, "drawer.save")}</span>
          </button>
        </section>

        {recurrenceOpen && (
          <section className="df-detail-project-pick">
            <div className="df-repeat-form">
              <label><span>{t(props.lang, "drawer.frequency")}</span><select value={f.recurrence?.frequency || "none"} onChange={(event) => {
                const frequency = event.target.value as RecurrenceFrequency;
                set("recurrence", frequency === "none" ? undefined : { ...eventRecurrence, frequency, startDate: f.dueDate, startTime: f.dueTime || undefined, durationMinutes: f.dueTime ? eventDurationMinutes || 60 : undefined, endDate: f.endDate || undefined });
              }}>{RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span>{t(props.lang, "drawer.startDate")}</span><input type="date" value={eventRecurrence.startDate || f.dueDate || props.today} onChange={(event) => set("recurrence", { ...eventRecurrence, startDate: event.target.value })} /></label>
              <label><span>{t(props.lang, "drawer.startTime")}</span><input type="time" value={eventRecurrence.startTime || f.dueTime || ""} onChange={(event) => set("recurrence", { ...eventRecurrence, mode: event.target.value ? "scheduled" : "flexible", startTime: event.target.value || undefined })} /></label>
            </div>
          </section>
        )}

        <section className="df-detail-notes-new">
          <div className="df-detail-section-head">
            <h3>{t(props.lang, "drawer.notes")}</h3>
            <button className="df-detail-add-btn" onClick={() => setNotesEditing((open) => !open)}>
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2l2 2-6 6H2V8l6-6z"/></svg>
              <span>{notesEditing ? t(props.lang, "drawer.cancel") : t(props.lang, "drawer.edit")}</span>
            </button>
          </div>
          {notesEditing ? (
            <div className="df-notes-editor">
              <textarea rows={4} value={f.details} onChange={(event) => { set("details", event.target.value); setNoteDraft(event.target.value); }} placeholder={t(props.lang, "drawer.addNotePlaceholder")} />
              <div className="df-notes-editor-actions">
                <button className="df-detail-pill-trevor action" onClick={() => { setNoteDraft(f.details); setNotesEditing(false); }}>{t(props.lang, "drawer.save")}</button>
              </div>
            </div>
          ) : (
            <div className="df-notes-preview" onClick={() => setNotesEditing(true)}>
              {f.details ? <p>{f.details}</p> : <p className="placeholder">{t(props.lang, "drawer.noNotes")}</p>}
            </div>
          )}
        </section>
      </aside>
    );
  }
  if (props.editing && props.type === "task" && props.task) {
    const activeRecord = props.editingRecordId
      ? (props.task.timelineRecords || []).find((r) => r.id === props.editingRecordId)
      : null;
    const activeOccurrence = props.editingOccurrence || (activeRecord ? {
      taskId: props.task.id,
      scheduledDate: activeRecord.scheduledDate,
      scheduledStart: activeRecord.scheduledStart,
    } : null);
    const isCandidate = props.task.plannedForDate === props.today && getExecutionLane(props.task) === "candidate" && !activeRecord && !(props.task.timelineRecords || []).some((r) => r.executionStatus === "scheduled");
    const isScheduled = activeRecord
      ? (activeRecord.scheduledDate === props.today || Boolean(activeRecord.scheduledDate && activeRecord.scheduledStart))
      : Boolean((props.task.scheduledDate && props.task.scheduledStart) || activeOccurrence || isRecurringScheduledTask(props.task));
    const recordStatus = activeRecord?.executionStatus;
    const recurrenceText = recurrenceLabel(props.task.recurrence);
    const showUncomplete = (
      props.task.completed ||
      (isScheduled && recordStatus !== "returned_unfinished")
    );
    function handleUncomplete() {
      if (!props.task || !props.data || !props.saveData) return;
      if (props.editingRecordId) {
        // Update the specific timeline record, not the task
        const now = new Date().toISOString();
        void props.saveData({
          ...props.data,
          tasks: props.data.tasks.map((t) =>
            t.id === props.task!.id
              ? {
                  ...t,
                  completed: false,
                  plannedForDate: props.task!.plannedForDate || props.today,
                  executionLane: "candidate",
                  timelineRecords: (t.timelineRecords || []).map((r) =>
                    r.id === props.editingRecordId ? { ...r, executionStatus: "returned_unfinished" as const } : r
                  ),
                  updatedAt: now,
                }
              : t
          ),
        });
      } else {
        // Legacy: no specific record, update the task directly
        props.onTaskUpdate(props.task.id, {
          completed: false,
          plannedForDate: props.task.plannedForDate || props.today,
          executionLane: "candidate",
        });
      }
      if (props.setEditingRecordId) props.setEditingRecordId(undefined);
    }
    const statusText = props.task.completed
      ? t(props.lang, "drawer.completed")
      : recordStatus === "returned_unfinished"
        ? t(props.lang, "drawer.unfinishedReturned")
        : isScheduled
          ? t(props.lang, "drawer.scheduledOnTimeline")
          : isCandidate
            ? t(props.lang, "drawer.candidateStatus")
            : t(props.lang, "drawer.unscheduled");
    const fixedRecurrence = props.task.recurrence || {
      mode: "scheduled" as const,
      frequency: "weekly" as RecurrenceFrequency,
      startDate: activeOccurrence?.scheduledDate || props.task.dueDate || props.today,
      startTime: activeOccurrence?.scheduledStart || props.task.scheduledStart || "09:00",
      durationMinutes: Math.max(Math.round((f.estimatedHours || 0.5) * 60), 30),
    };
    return (
      <aside className="df-drawer df-task-detail" onMouseDown={(event) => event.stopPropagation()}>
        {/* ── Hero title area ── */}
        <section className="df-detail-hero-trevor">
          <textarea className="df-detail-title-trevor" value={f.title} onChange={(event) => set("title", event.target.value)} rows={1} placeholder={t(props.lang, "drawer.titlePlaceholder")} spellCheck={false} />
        </section>

        {/* ── Project tag + action row ── */}
        <section className="df-detail-tag-row">
          <button ref={projectTriggerRef} className={`df-detail-pill-trevor ${projectPickerOpen ? "active" : ""}`} onClick={toggleProjectPicker}>
            <span className="df-detail-project-dot" style={{ background: props.projects.find((p) => String(p.id) === String(f.projectId))?.color || "#888" }} />
            <span># {selectedProjectTitle}</span>
            <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 3 3-3" /></svg>
          </button>
          <button ref={durationTriggerRef} className={`df-detail-pill-trevor ${durationPickerOpen ? "active" : ""}`} onClick={toggleDurationPicker}>
            <span>◷ {formatDuration(f.estimatedHours || 0.5)}</span>
            <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 3 3-3" /></svg>
          </button>
          {recurrenceText ? <span className="df-detail-pill-trevor">↻ {recurrenceText}</span> : null}
        </section>

        {/* ── Status: COMPLETE / UNFINISHED / REMOVE ── */}
        <section className="df-detail-status-row">
          <button className={`df-detail-pill-trevor action ${props.task.completed ? "green" : ""}`} onClick={props.onToggleDone}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-6"/></svg>
            <span>{t(props.lang, "drawer.complete")}</span>
          </button>
          {showUncomplete && <button className="df-detail-pill-trevor action" onClick={handleUncomplete}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3l-6 6M3 3l6 6"/></svg>
            <span>{t(props.lang, "drawer.unfinished")}</span>
          </button>}
          <button className="df-detail-pill-trevor action danger" onClick={props.onDelete}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h8M4 3V2h4v1M3 3v6.5a1 1 0 001 1h4a1 1 0 001-1V3"/></svg>
            <span>{t(props.lang, "drawer.remove")}</span>
          </button>
        </section>

        {/* ── Scheduling: Reschedule / Unschedule ── */}
        <section className="df-detail-schedule-row">
          <button className="df-detail-pill-trevor action" onClick={() => props.onTaskUpdate(props.task!.id, { plannedForDate: props.today, executionLane: "candidate", scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, timelineRecords: (props.task!.timelineRecords || []).filter((record) => record.executionStatus !== "scheduled") })}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v4l2 2"/><circle cx="6" cy="6" r="5"/></svg>
            <span>{t(props.lang, "drawer.quickReschedule")}</span>
          </button>
          <button className="df-detail-pill-trevor action" onClick={() => props.onTaskUpdate(props.task!.id, { scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, timelineRecords: (props.task!.timelineRecords || []).filter((record) => record.executionStatus !== "scheduled") })}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3l-6 6M3 3l6 6"/></svg>
            <span>{t(props.lang, "drawer.cancelSchedule")}</span>
          </button>
        </section>

        {/* ── Recurrence + Copy ── */}
        <section className="df-detail-schedule-row">
          <button className={`df-detail-pill-trevor action ${recurrenceOpen ? "active" : ""}`} onClick={() => setRecurrenceOpen((open) => !open)}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="8" height="7" rx="1"/><path d="M2 5h8"/></svg>
            <span>{t(props.lang, "drawer.setRepeat")}</span>
          </button>
          <button className="df-detail-pill-trevor action" onClick={props.onCopy}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2" width="7" height="9" rx="1"/><path d="M2 5v7a1 1 0 001 1h6"/></svg>
            <span>{t(props.lang, "drawer.duplicate")}</span>
          </button>
          <button className="df-detail-pill-trevor action" onClick={props.onConvertToEvent}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 6H3M6 3L3 6l3 3"/></svg>
            <span>{t(props.lang, "drawer.convertToEvent")}</span>
          </button>
        </section>

        {projectPickerOpen && createPortal(
          <div className="df-detail-popover-layer" onMouseDown={() => setProjectPickerOpen(false)}>
            <section className="df-detail-floating-popover project" style={detailPopoverPosition} onMouseDown={(event) => event.stopPropagation()}>
              <header><strong>{t(props.lang, "drawer.assignProject")}</strong><span>{selectedProjectTitle}</span></header>
              <div className="df-drawer-project-list">
                <button onClick={() => { set("projectId", ""); props.onTaskUpdate(props.task!.id, { projectId: undefined }); setProjectPickerOpen(false); }}>{t(props.lang, "drawer.unassigned")}</button>
                {props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); props.onTaskUpdate(props.task!.id, { projectId: project.id }); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}
                <div className="df-project-create-line compact"><input value={newProjectTitle} placeholder={t(props.lang, "drawer.newProjectPlaceholder")} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div>
              </div>
            </section>
          </div>,
          document.getElementById("df-portal-target") || document.body,
        )}

        {durationPickerOpen && createPortal(
          <div className="df-detail-popover-layer" onMouseDown={() => setDurationPickerOpen(false)}>
            <section className="df-detail-floating-popover duration" style={detailPopoverPosition} onMouseDown={(event) => event.stopPropagation()}>
              <header><strong>{t(props.lang, "drawer.duration")}</strong><span>{formatDuration(f.estimatedHours || 0.5)}</span></header>
              <div className="df-detail-duration-options">
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    className={Math.round((f.estimatedHours || 0.5) * 60) === minutes ? "active" : ""}
                    onClick={() => {
                      setDurationMinutes(minutes);
                      setDurationPickerOpen(false);
                    }}
                  >
                    {formatMinutes(minutes)}
                  </button>
                ))}
              </div>
            </section>
          </div>,
          document.getElementById("df-portal-target") || document.body,
        )}

        {/* ── Dropdown: Recurrence Form ── */}
        {recurrenceOpen && (
          <section className="df-detail-project-pick">
            <div className="df-repeat-form">
              <label><span>{t(props.lang, "drawer.startDate")}</span><input type="date" value={fixedRecurrence.startDate || props.today} onChange={(event) => props.onSaveRecurrence(props.task!.id, { ...fixedRecurrence, mode: "scheduled", startDate: event.target.value })} /></label>
              <label><span>{t(props.lang, "drawer.startTime")}</span><input type="time" value={fixedRecurrence.startTime || "09:00"} onChange={(event) => props.onSaveRecurrence(props.task!.id, { ...fixedRecurrence, mode: "scheduled", startTime: event.target.value })} /></label>
              <label><span>{t(props.lang, "drawer.frequency")}</span><select value={fixedRecurrence.frequency} onChange={(event) => props.onSaveRecurrence(props.task!.id, { ...fixedRecurrence, mode: "scheduled", frequency: event.target.value as RecurrenceFrequency })}>{RECURRENCE_OPTIONS.filter((option) => option.value !== "none").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span>时长</span><select value={fixedRecurrence.durationMinutes || Math.max(Math.round((f.estimatedHours || 0.5) * 60), 30)} onChange={(event) => props.onSaveRecurrence(props.task!.id, { ...fixedRecurrence, mode: "scheduled", durationMinutes: Number(event.target.value) })}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label>
            </div>
          </section>
        )}

        {/* ── Sub-tasks ── */}
        <section className="df-detail-subtasks-new">
          <div className="df-detail-section-head">
            <h3>{t(props.lang, "drawer.subtasks")}</h3>
            <button className="df-detail-add-btn" onClick={addSubtask}>
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8"/></svg>
              <span>{t(props.lang, "drawer.addSubtask")}</span>
            </button>
          </div>
          <div className="df-subtask-list-new">
            {(props.task.subtasks || []).length === 0 ? (
              <div className="df-subtask-empty">{t(props.lang, "drawer.noSubtasks")}</div>
            ) : (props.task.subtasks || []).map((subtask) => (
              <label key={subtask.id} className={`df-subtask-row-new ${subtask.completed || subtask.done ? "completed" : ""}`}>
                <input type="checkbox" checked={Boolean(subtask.completed || subtask.done)} onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })} />
                <input className="df-subtask-title-input" value={subtask.title} onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })} />
              </label>
            ))}
          </div>
        </section>

        {/* ── Notes ── */}
        <section className="df-detail-notes-new">
          <div className="df-detail-section-head">
            <h3>{t(props.lang, "drawer.notes")}</h3>
            <button className="df-detail-add-btn" onClick={() => setNotesEditing((open) => !open)}>
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2l2 2-6 6H2V8l6-6z"/></svg>
              <span>{notesEditing ? t(props.lang, "drawer.cancel") : t(props.lang, "drawer.edit")}</span>
            </button>
          </div>
          {notesEditing ? (
            <div className="df-notes-editor">
              <textarea rows={4} value={noteDraft} onChange={(event) => { setNoteDraft(event.target.value); set("details", event.target.value); }} placeholder={t(props.lang, "drawer.addNotePlaceholder")} />
              <div className="df-notes-editor-actions">
                <button className="df-detail-pill-trevor action" onClick={() => { set("details", noteDraft); props.onTaskUpdate(props.task!.id, { notes: noteDraft }); setNotesEditing(false); }}>{t(props.lang, "drawer.save")}</button>
              </div>
            </div>
          ) : (
            <div className="df-notes-preview" onClick={() => setNotesEditing(true)}>
              {noteDraft ? <p>{noteDraft}</p> : <p className="placeholder">{t(props.lang, "drawer.noNotes")}</p>}
            </div>
          )}
        </section>
      </aside>
    );
  }
  return (
    <aside className="df-drawer">
      <div className="df-drawer-head"><h2>{props.editing ? t(props.lang, "form.edit") : t(props.lang, "form.add")}</h2><button className="df-icon-action i-close" data-tip={t(props.lang, "form.close")} aria-label={t(props.lang, "form.close")} onClick={props.onClose} /></div>
      <div className="df-segment">{(["task", "project", "event"] as AddType[]).map((type) => <button key={type} className={props.type === type ? "active" : ""} onClick={() => props.setType(type)}>{type === "task" ? t(props.lang, "form.task") : type === "project" ? t(props.lang, "form.project") : t(props.lang, "form.event")}</button>)}</div>
      {props.editing && props.type === "task" && <label className="df-check"><input type="checkbox" checked={Boolean(props.task?.completed)} onChange={props.onToggleDone} />{t(props.lang, "form.completed")}</label>}
      <label>{t(props.lang, "form.name")}<input value={f.title} onChange={(event) => set("title", event.target.value)} /></label>
      {props.type === "task" && <><label>{t(props.lang, "form.projectLabel")}<div className="df-drawer-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}># {selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}>{t(props.lang, "form.unassigned")}</button>{props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder={t(props.lang, "form.newProjectPlaceholder")} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div></label><div className="df-grid2"><label>{t(props.lang, "form.date")}<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>{t(props.lang, "form.startTime")}<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label><label>{t(props.lang, "form.endTime")}<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label></div></>}
      {props.type === "project" && <><label>{t(props.lang, "form.projectNotes")}<textarea rows={3} value={f.details} onChange={(event) => set("details", event.target.value)} /></label><label>{t(props.lang, "form.color")}</label><ProjectColorPicker value={f.projectColor} onChange={(color) => set("projectColor", color)} presets={COMMON_COLOR_PRESETS} /></>}
      {props.type === "event" && <div className="df-grid2"><label>{t(props.lang, "form.startDate")}<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>{t(props.lang, "form.startTime")}<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label><label>{t(props.lang, "form.endDate")}<input type="date" value={f.endDate} onChange={(event) => set("endDate", event.target.value)} /></label><label>{t(props.lang, "form.endTime")}<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label><label>重复<select value={f.recurrence?.frequency || "none"} onChange={(event) => {
        const frequency = event.target.value as RecurrenceFrequency;
        set("recurrence", frequency === "none" ? undefined : { mode: f.dueTime ? "scheduled" : "flexible", frequency, startDate: f.dueDate, startTime: f.dueTime || undefined, durationMinutes: f.dueTime ? Math.max((timeToMinutes(f.endTime || addMinutes(f.dueTime, 60)) - timeToMinutes(f.dueTime)), 15) : undefined, endDate: f.endDate || undefined });
      }}>{RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>}
      <button className="df-link" onClick={() => props.setAdvancedOpen(!props.advancedOpen)}>{props.advancedOpen ? t(props.lang, "form.collapseAdvanced") : t(props.lang, "form.expandAdvanced")}</button>
      {props.advancedOpen && <div className="df-advanced">{props.type === "task" && <label>{t(props.lang, "form.estimatedTime")}<select value={Math.max(Math.round((f.estimatedHours || 0.25) * 60), SLOT_MINUTES)} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label>}<label>{t(props.lang, "form.notes")}<textarea rows={6} value={f.details} onChange={(event) => set("details", event.target.value)} /></label></div>}
      <div className="df-drawer-actions">{props.editing && <button className="df-icon-action i-trash danger-lite" data-tip={t(props.lang, "form.delete")} aria-label={t(props.lang, "form.delete")} onClick={props.onDelete} />}{props.type === "task" && <button className="df-icon-action i-next" data-tip={t(props.lang, "form.clarifyNext")} aria-label={t(props.lang, "form.clarifyNext")} onClick={props.onNextAction} />}<button className="primary" onClick={props.onSave}>{props.editing ? t(props.lang, "form.saveChanges") : t(props.lang, "form.add")}</button></div>
    </aside>
  );
}

function AiPanel({ input, setInput, busy, onSend, onClose, messages, onConfirmAction, onDismissAction, onToggleAction, onSetAllActions, onAdoptSelected, onRejectSelected, onViewImport, onUndoImport, projectList, lang, attachment, attachmentStatus, onAttachment, onClearAttachment }: { input: string; setInput: (v: string) => void; busy: boolean; onSend: () => void; onClose: () => void; messages: AiSessionMessage[]; onConfirmAction: (messageId: string, action: AiAction) => void; onDismissAction: (messageId: string, action: AiAction) => void; onToggleAction: (messageId: string, index: number) => void; onSetAllActions: (messageId: string, checked: boolean) => void; onAdoptSelected: (messageId: string) => void; onRejectSelected: (messageId: string) => void; onViewImport: (messageId: string) => void; onUndoImport: (messageId: string) => void; projectList?: { id: string; title: string; color?: string }[]; lang: Language; attachment?: ParsedAttachment | null; attachmentStatus?: string; onAttachment: (file: File) => void; onClearAttachment: () => void }) {
  const projects = projectList || [];
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, attachmentStatus]);
  return <aside className="df-ai-panel">
    <div className="df-ai-panel-head">
      <div className="df-ai-title"><span className={`df-ai-presence ${busy ? "thinking" : ""}`} /><div><strong>NavoPath AI</strong><small>{busy ? "正在思考" : "在线助手"}</small></div></div>
      <button className="df-icon-action i-close" data-tip={t(lang, "aiPanel.close")} aria-label={t(lang, "aiPanel.close")} onClick={onClose} />
    </div>
    <div className="df-ai-panel-body" ref={bodyRef}>
      {messages.length === 0 && <div className="df-ai-empty"><span>N</span><strong>让计划变得清晰</strong><p>描述任务、询问安排，或上传文件提取任务与事件。</p></div>}
      {messages.map((message) => <section key={message.id} className={`df-ai-turn ${message.role}`}>
        {message.role === "user" ? <>
          <div className="df-ai-msg-bubble user"><span>{message.content}</span></div>
          {message.attachment && <AttachmentCard attachment={message.attachment} referenced />}
        </> : <>
          <div className="df-ai-assistant-label"><span>N</span><small>NavoPath AI</small></div>
          {message.steps && message.steps.length > 0 && <div className="df-ai-steps">
            {message.steps.map((step, index) => <div key={index} className={`df-ai-step ${step.status}`}><span className="df-ai-step-icon">{step.status === "done" ? "✓" : step.status === "error" ? "✕" : step.status === "running" ? "●" : "○"}</span><span>{step.label}</span></div>)}
          </div>}
          {message.content && <div className={`df-ai-reply ${message.status === "error" ? "error" : ""}`}>{message.content}</div>}
          {message.actions && message.actions.length > 0 && <div className="df-ai-actions">
            <div className="df-ai-action-header"><span>解析结果</span><div><button onClick={() => onSetAllActions(message.id, true)}>全选</button><button onClick={() => onSetAllActions(message.id, false)}>全不选</button><small>{message.actions.length} 项</small></div></div>
            {message.actions.map((action, i) => {
            const a = action as Record<string, unknown>;
            const title = a.title as string || a.type as string;
            const date = a.date as string | undefined;
            const start = (a.start || a.startTime) as string | undefined;
            const end = (a.end || a.endTime) as string | undefined;
            const dur = a.durationMinutes as number | undefined;
            const projectName = (a.projectName as string) || undefined;
            const projectId = (a.projectId as string) || undefined;
            const reason = typeof a.reason === 'string' ? a.reason : undefined;
            const isAccepted = action.type === "none";
            const proj = projectId ? projects.find((p: any) => String(p.id) === String(projectId)) : null;
            const finalProjectName = projectName || proj?.title || (lang === "zh" ? "未归属" : "Unassigned");
            const projColor = proj?.color;
            return (
            <div key={i} className={`df-ai-task-card ${isAccepted ? "accepted" : ""}`}>
              {action.type === "import_schedule_item" && <input className="df-ai-import-check" type="checkbox" checked={message.selectedActions?.[i] !== false} onChange={() => onToggleAction(message.id, i)} />}
              {projColor && <span className="df-ai-task-strip" style={{ background: projColor }} />}
              <div className="df-ai-task-body">
                <div className="df-ai-task-row-top">
                  <strong>{title}</strong>
                  {start && end && <time>{start} - {end}</time>}
                </div>
                <div className="df-ai-task-row-mid">
                  <span className="df-ai-task-project">{a.kind === "event" ? "事件" : "任务"} · # {finalProjectName}{a.recurrence ? ` · ↻ ${(a.recurrence as any).frequency}` : ""}</span>
                </div>
                <div className="df-ai-task-row-bot">
                  {dur && <span className="df-ai-task-dur">{dur} min</span>}
                  {date && <span className="df-ai-task-dur">{date}</span>}
                  {reason && <small>{reason}</small>}
                  {typeof a.warning === "string" && <small>{a.warning}</small>}
                </div>
              </div>
              {!isAccepted && (
                <div className="df-ai-task-actions">
                  <button className="df-ai-task-accept" onClick={() => onConfirmAction(message.id, action)} title={t(lang, "aiPanel.adopt")}>✓</button>
                  <button className="df-ai-task-cancel" onClick={() => onDismissAction(message.id, action)} title={t(lang, "aiPanel.cancel")}>✕</button>
                </div>
              )}
              {isAccepted && <span className="df-ai-task-done">{t(lang, "aiPanel.adopted")}</span>}
            </div>
          );})}
          {message.actions.length > 0 && <div className="df-ai-import-bulk">
            <button onClick={() => onRejectSelected(message.id)}>取消本轮</button>
            <button className="primary" disabled={!message.actions.some((_, index) => message.selectedActions?.[index] !== false)} onClick={() => onAdoptSelected(message.id)}>一键添加选中项</button>
          </div>}
        </div>}
        {message.actionState && message.actionState !== "pending" && <div className={`df-ai-action-outcome ${message.actionState}`}>
          <span>{message.actionState === "adopted" ? `已添加 ${message.importCommit?.addedCount || 0} 项` : message.actionState === "undone" ? "已撤回本次添加" : "已否决本轮建议"}</span>
          {message.actionState === "adopted" && <div>
            {message.importCommit?.focus && <button onClick={() => onViewImport(message.id)}>查看时间轴</button>}
            <button onClick={() => onUndoImport(message.id)}>撤回本次操作</button>
          </div>}
        </div>}
        </>}
      </section>)}
    </div>
    <div className="df-ai-panel-foot">
      {(attachment || attachmentStatus) && <AttachmentCard attachment={attachment ? { name: attachment.name, size: attachment.size, pageCount: attachment.pageCount, truncated: attachment.truncated, status: "ready", statusText: attachmentStatus || "文本已提取", summary: attachment.text.slice(0, 120).replace(/\s+/g, " ") } : { name: "正在解析附件", size: 0, status: "error", statusText: attachmentStatus || "正在解析", summary: "" }} onRemove={onClearAttachment} />}
      <div className="df-ai-composer-row">
        <label className="df-ai-attach-btn" title="上传文件">＋<input type="file" accept={ATTACHMENT_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) onAttachment(file); event.currentTarget.value = ""; }} /></label>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={t(lang, "aiPanel.thinkPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
        <button className="df-ai-send-btn" onClick={onSend} disabled={busy || (!input.trim() && !attachment)} title={busy ? t(lang, "aiPanel.thinking") : t(lang, "aiPanel.send")}>{busy ? "●" : "↑"}</button>
      </div>
    </div>
  </aside>;
}

function AttachmentCard({ attachment, referenced = false, onRemove }: { attachment: AiAttachmentSnapshot; referenced?: boolean; onRemove?: () => void }) {
  const ext = attachment.name.split(".").pop()?.toUpperCase() || "FILE";
  const size = attachment.size ? `${Math.max(attachment.size / 1024, 1).toFixed(0)} KB` : "";
  return <div className={`df-ai-attachment-card ${referenced ? "referenced" : ""} ${attachment.status}`}>
    <span className="df-ai-file-icon">{ext.slice(0, 4)}</span>
    <div><strong>{attachment.name}</strong><small>{referenced ? "引用附件" : attachment.statusText}{attachment.pageCount ? ` · ${attachment.pageCount} 页` : ""}{size ? ` · ${size}` : ""}</small>{referenced && attachment.summary ? <p>{attachment.summary}</p> : null}</div>
    {onRemove && <button onClick={onRemove} aria-label="移除附件">×</button>}
  </div>;
}

function UtilityPanel({ kind, settings, authEmail, onClose, onSave, onShowAbout, onSignOut, onDeleteAccount, lang }: { kind: "settings" | "about"; settings: Settings; authEmail: string; onClose: () => void; onSave: (patch: Partial<Settings>) => void; onShowAbout: () => void; onSignOut?: () => void; onDeleteAccount?: () => void; lang: Language }) {
  const userName = settings.displayName?.trim() || authEmail || "NavoPath User";
  const defaultAccent = settings.theme === "dark" ? "#EEE9DF" : "#27231E";
  const uploadAvatar = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        onSave({ avatarDataUrl: canvas.toDataURL("image/jpeg", .82) });
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  };
  return (
    <>
      <div className="df-utility-backdrop" onMouseDown={onClose} />
      <aside className="df-utility-panel">
        <div className="df-utility-head">
          <h2>{kind === "settings" ? t(lang, "settings.settings") : t(lang, "settings.aboutNavo")}</h2>
          <button className="df-icon-action i-close" aria-label={t(lang, "settings.close")} onClick={onClose} />
        </div>
        {kind === "settings" ? (
          <div className="df-utility-body">
            <section className="df-settings-profile">
              <label className="df-settings-avatar" title={lang === "zh" ? "上传头像" : "Upload avatar"}>
                {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" /> : <span>N</span>}
                <input type="file" accept="image/*" onChange={(event) => { uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              <div>
                <input
                  className="df-settings-name-input"
                  value={settings.displayName || ""}
                  placeholder={t(lang, "settings.usernamePlaceholder")}
                  onChange={(e) => onSave({ displayName: e.target.value })}
                />
                <small>{t(lang, "settings.freePlan")}</small>
              </div>
            </section>
            <label className="df-utility-select">
              {t(lang, "settings.uiMode")}
              <select value={settings.theme} onChange={(event) => onSave({ theme: event.target.value as Settings["theme"] })}>
                <option value="dark">{t(lang, "settings.dark")}</option>
                <option value="light">{t(lang, "settings.light")}</option>
              </select>
            </label>
            <label className="df-utility-select">
              {t(lang, "settings.language")}
              <select value={settings.language || lang} onChange={(event) => onSave({ language: event.target.value as Language })}>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="df-utility-select">
              {lang === "zh" ? "字体风格" : "Typography"}
              <select value={settings.typographyStyle || "editorial"} onChange={(event) => onSave({ typographyStyle: event.target.value as Settings["typographyStyle"] })}>
                <option value="editorial">{lang === "zh" ? "编辑衬线" : "Editorial Serif"}</option>
                <option value="balanced">{lang === "zh" ? "平衡混排" : "Balanced"}</option>
                <option value="sans">{lang === "zh" ? "现代无衬线" : "Modern Sans"}</option>
              </select>
            </label>
            <label className="df-utility-select">{t(lang, "settings.defaultView")}<select value={settings.defaultTimelineView || "daily"} onChange={(event) => onSave({ defaultTimelineView: event.target.value as Settings["defaultTimelineView"] })}><option value="daily">{viewLabel(lang, "daily")}</option><option value="3day">{viewLabel(lang, "3day")}</option><option value="weekly">{viewLabel(lang, "weekly")}</option><option value="month">{viewLabel(lang, "month")}</option></select></label>
            <label className="df-utility-check"><input type="checkbox" checked={Boolean(settings.hideCompleted)} onChange={(event) => onSave({ hideCompleted: event.target.checked })} />{t(lang, "settings.hideCompleted")}</label>
            <label className="df-utility-check"><input type="checkbox" checked={Boolean(settings.aiMemoryEnabled)} onChange={(event) => onSave({ aiMemoryEnabled: event.target.checked })} />{t(lang, "settings.allowAiContext")}</label>
            <details className="df-settings-advanced">
              <summary>{lang === "zh" ? "高级设置" : "Advanced settings"}</summary>
              <div className="df-settings-advanced-body">
                <ThemeColorSetting label={t(lang, "settings.executeAccent")} presets={settings.theme === "dark" ? EXECUTE_THEME_PRESETS_DARK : EXECUTE_THEME_PRESETS_LIGHT} value={settings.executeAccentColor || defaultAccent} onChange={(color) => onSave({ executeAccentColor: color })} />
                <ThemeColorSetting label={t(lang, "settings.planningAccent")} presets={settings.theme === "dark" ? PLANNING_THEME_PRESETS_DARK : PLANNING_THEME_PRESETS_LIGHT} value={settings.planningAccentColor || defaultAccent} onChange={(color) => onSave({ planningAccentColor: color })} />
                <button className="df-settings-reset-accent" onClick={() => onSave({ executeAccentColor: "", planningAccentColor: "" })}>{lang === "zh" ? "恢复主题默认强调色" : "Restore theme default accents"}</button>
                <label className="df-utility-check"><input type="checkbox" checked={Boolean(settings.hideAi)} onChange={(event) => onSave({ hideAi: event.target.checked })} />{t(lang, "settings.hideAllAi")}</label>
                {onDeleteAccount && <button className="df-settings-delete-account" onClick={onDeleteAccount}>{lang === "zh" ? "删除账户与全部数据" : "Delete account and all data"}</button>}
              </div>
            </details>
            {authEmail && <p>{t(lang, "settings.account")}：{authEmail}</p>}
            <div className="df-settings-footer">
              <button className="df-settings-about" onClick={onShowAbout}>
                <span className="df-settings-about-icon">i</span>
                <span>{t(lang, "settings.about")}</span>
              </button>
              {onSignOut && <button className="df-settings-logout" onClick={onSignOut}>{t(lang, "settings.logout")}</button>}
            </div>
          </div>
        ) : (
          <div className="df-utility-body">
            <strong>{t(lang, "settings.version")}</strong>
            <p>{t(lang, "settings.aboutDesc")}</p>
            <small>{t(lang, "settings.lastUpdated")}</small>
            <div className="df-release-list">
              {RELEASE_NOTES.map((item) => (
                <article key={`${item.date}-${item.summary}`} className="df-release-item">
                  <strong>{item.date}</strong>
                  <span>{item.summary}</span>
                </article>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function ThemeColorSetting({ label, presets, value, onChange }: { label: string; presets: string[]; value: string; onChange: (color: string) => void }) {
  return (
    <section className="df-theme-setting">
      <div>
        <strong>{label}</strong>
        <span style={{ "--project-color": value } as CSSProperties} />
      </div>
      <ProjectColorPicker presets={presets} value={value} onChange={onChange} />
    </section>
  );
}

function SourceModal({ tasks, projects, today, onClose, onJoin, defaultFilter, anchorRect, lang }: { tasks: Task[]; projects: Project[]; today: string; onClose: () => void; onJoin: (taskIds: string[]) => void; defaultFilter?: string; anchorRect: DOMRect | null; lang: Language }) {
  const [filter, setFilter] = useState<string>(defaultFilter || "all");
  const [showAdded, setShowAdded] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState("");

  // Sync filter when defaultFilter changes (e.g. different project clicked)
  useEffect(() => {
    setFilter(defaultFilter || "all");
    setSelected({});
  }, [defaultFilter]);

  // Compute popover position directly from anchorRect on every render (no rAF needed)
  const popoverStyle = useMemo<CSSProperties>(() => {
    if (!anchorRect) return {};
    const POPOVER_WIDTH = 340;
    const POPOVER_MAX_HEIGHT = 420;
    let top = anchorRect.bottom + 8;
    let left = Math.max(8, anchorRect.left);
    // Flip up if near bottom
    if (top + POPOVER_MAX_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, anchorRect.top - POPOVER_MAX_HEIGHT - 8);
    }
    // Shift left if near right edge
    if (left + POPOVER_WIDTH > window.innerWidth - 12) {
      left = Math.max(8, window.innerWidth - POPOVER_WIDTH - 12);
    }
    return { top, left, opacity: 1 };
  }, [anchorRect]);

  const openTasks = tasks.filter((task) => {
    if (task.completed) return false;
    const joined = task.plannedForDate === today && Boolean(getExecutionLane(task));
    if (!showAdded && joined) return false;
    if (filter === "all") return true;
    if (filter === "unassigned") return !task.projectId;
    return task.projectId === filter;
  });
  const filteredProjects = projects.filter((project) => filter === "all" || filter === project.id);
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const toggleSelected = (taskId: string) => setSelected((current) => ({ ...current, [taskId]: !current[taskId] }));
  const addSelected = () => {
    onJoin(selectedIds);
    setSelected({});
    onClose();
  };

  return createPortal(
    <>
      <div className="df-popover-backdrop" onClick={onClose} />
      <div className="task-list-popover" style={popoverStyle} onClick={(event) => event.stopPropagation()}>
        <div className="task-list-popover-header">
          <h2>{t(lang, "sourceModal.selectTodayTasks")}</h2>
          <button className="df-icon-action i-close" data-tip={t(lang, "sourceModal.close")} aria-label={t(lang, "sourceModal.close")} onClick={onClose} />
        </div>
        <div className="task-list-popover-toolbar">
          <button className="light" onClick={() => setShowAdded((value) => !value)}>{showAdded ? t(lang, "sourceModal.hideAdded") : t(lang, "sourceModal.showAdded")}</button>
          <button className="primary" disabled={selectedIds.length === 0} onClick={addSelected}>{t(lang, "sourceModal.addSelected")} {selectedIds.length || ""}</button>
        </div>
        <div className="task-list-popover-filters">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t(lang, "sourceModal.allProjects")}</button>
          <button className={filter === "unassigned" ? "active" : ""} onClick={() => setFilter("unassigned")}>{t(lang, "sourceModal.unassigned")}</button>
          {projects.map((project) => <button key={project.id} className={filter === project.id ? "active" : ""} onClick={() => setFilter(project.id)}>{project.title}</button>)}
        </div>
        <div className="task-list-popover-body">
          {openTasks.filter((task) => task.dueDate < today).length > 0 && <section className="df-source-section"><h3>{t(lang, "sourceModal.overdue")}</h3>
            {openTasks.filter((task) => task.dueDate < today).slice(0, 8).map((task) => <SourceRow key={task.id} task={task} today={today} projectName={projects.find((project) => project.id === task.projectId)?.title || "未归属"} selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}
          </section>}
          {openTasks.filter((task) => task.dueDate >= today).length > 0 && <section className="df-source-section"><h3>{t(lang, "sourceModal.thisWeek")}</h3>
            {openTasks.filter((task) => task.dueDate >= today).slice(0, 8).map((task) => <SourceRow key={task.id} task={task} today={today} projectName={projects.find((project) => project.id === task.projectId)?.title || "未归属"} selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}
          </section>}
          {filteredProjects.some((project) => openTasks.some((task) => task.projectId === project.id)) && <section className="df-source-section"><h3>{t(lang, "sourceModal.browseByProject")}</h3>
        {filteredProjects.map((project) => {
          const projectTasks = openTasks.filter((task) => task.projectId === project.id).slice(0, 8);
          if (projectTasks.length === 0) return null;
          return <section key={project.id}><strong>{project.title}</strong>{projectTasks.map((task) => <SourceRow key={task.id} task={task} today={today} projectName={project.title} selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}</section>;
        })}
          </section>}
          {filter === "unassigned" && openTasks.length > 0 && <section><strong>未归属</strong>{openTasks.map((task) => <SourceRow key={task.id} task={task} today={today} projectName="未归属" selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}</section>}
          {openTasks.length === 0 && <div className="df-source-empty">{t(lang, "sourceModal.noUnfinished")}</div>}
        </div>
      </div>
    </>,
    document.querySelector('.df-app') || document.body
  );
}

function SourceRow({ task, today, projectName, selected, expanded, onSelect, onExpand }: { task: Task; today: string; projectName: string; selected: boolean; expanded: boolean; onSelect: () => void; onExpand: () => void }) {
  const joined = task.plannedForDate === today && Boolean(getExecutionLane(task));
  return (
    <div className={`df-source-row ${selected ? "selected" : ""} ${joined ? "joined" : ""}`}>
      <button className="df-source-select" onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}>{selected ? "✓" : "›"}</button>
      <div className="df-source-main" onClick={onExpand}>
        <span>{task.title}</span>
        <small>{joined ? "已添加" : `${projectName} · ${formatDuration(task.estimatedHours || 0.5)} · 截止 ${shortDate(task.dueDate)}`}</small>
        {expanded && <p>{task.notes || "暂无备注"}</p>}
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root")!;
const rootKey = "__plannerRoot";
const rootWindow = window as typeof window & { [rootKey]?: ReturnType<typeof createRoot> };
const root = rootWindow[rootKey] ?? createRoot(rootElement);
rootWindow[rootKey] = root;
root.render(<App />);
