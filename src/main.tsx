import React, { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import type { CalendarEvent, Category, PlannerApi, PlannerData, Priority, Project, Settings, Task } from "./types";
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
import "./styles.css";
import "./landing.css";

installBrowserFallback();

const todayIso = () => localIso(new Date());
const TIMELINE_START = 0;
const TIMELINE_END = 24;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 20;
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);
const PROJECT_COLOR_PRESETS = ["#8B5CF6", "#A78BFA", "#C69CF9", "#EC4899", "#38BDF8", "#22C55E", "#F59E0B", "#EF4444"];
const COMMON_COLOR_PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#1F2937", "#F9FAFB", "#6B7280"];
const EXECUTE_THEME_PRESETS = ["#C69CF9", "#8B5CF6", "#7C3AED", "#A78BFA", "#EC4899", "#38BDF8"];
const PLANNING_THEME_PRESETS = ["#CAFF72", "#8B5CF6", "#7C3AED", "#A78BFA", "#38BDF8", "#F59E0B"];
const RELEASE_NOTES = [
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
const priorityLabel: Record<Priority, string> = { high: "高", medium: "中", low: "低" };
const categoryOrder: Category[] = ["exam", "project", "essay", "materials", "uk", "us", "personal"];

type Mode = "execute" | "planning";
type AddType = "task" | "project" | "event";
type TimelineView = "daily" | "3day" | "weekly" | "month";
type AiPlanPrefs = { source: "today" | "all"; scope: "day" | "3day"; strategy: "simple" | "priority" | "deadline" };
type DragState = { taskId: string; kind: "candidate" | "block"; duration: number; offsetMinutes?: number; pointer?: { x: number; y: number }; outsideTimeline?: boolean } | null;

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
  const execute = normalizeHexColor(settings.executeAccentColor || "#C69CF9", "#C69CF9");
  const planning = normalizeHexColor(settings.planningAccentColor || "#CAFF72", "#CAFF72");
  const executeLight = isLightColor(execute);
  const planningLight = isLightColor(planning);
  const activeAccent = mode === "execute" ? execute : planning;
  const activeLight = mode === "execute" ? executeLight : planningLight;
  const { r, g, b } = hexToRgb(activeAccent);
  const isDark = settings.theme === "dark";
  const hl = settings.themeGradientEnabled !== false;
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
      "--surface-card": "#20242D",
      "--text-main": "#F5F7FA",
      "--text-muted": "#AAB0BD",
      "--text-faint": "#737A88",
      "--border-soft": "rgba(255,255,255,0.12)",
      "--border-subtle": "rgba(255,255,255,0.08)",
      "--shadow-soft": "0 8px 24px rgba(0,0,0,0.40)",
      "--shadow-hl": hl ? `0 0 18px rgba(${r},${g},${b},0.12)` : "none",
      "--header-bg": "rgba(15,17,23,0.86)",
      "--header-border": "rgba(255,255,255,0.08)",
      "--header-fg": "#F5F7FA",
      "--header-fg-muted": "#AAB0BD",
      "--input-bg": "#1A1D25",
      "--input-border": "rgba(255,255,255,0.14)",
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
    "--bg-app": "#F8FAFC",
    "--bg-app-soft": "#FBF7FF",
    "--surface-main": "#FFFFFF",
    "--surface-raised": "#FFFFFF",
    "--surface-card": "#F9FAFB",
    "--text-main": "#111827",
    "--text-muted": "#6B7280",
    "--text-faint": "#9CA3AF",
    "--border-soft": "#E5E7EB",
    "--border-subtle": "#EEF0F4",
    "--shadow-soft": "0 10px 30px rgba(17,24,39,0.06)",
    "--shadow-hl": hl ? `0 0 24px rgba(${r},${g},${b},0.14)` : "none",
    "--header-bg": "rgba(255,255,255,0.86)",
    "--header-border": "rgba(229,231,235,0.72)",
    "--header-fg": "#111827",
    "--header-fg-muted": "#6B7280",
    "--input-bg": "#FFFFFF",
    "--input-border": "#E5E7EB",
  } as CSSProperties;
}
type ResizePreview = { taskId: string; start: string; end: string } | null;
type ScheduleSuggestion = { id: string; taskId: string; startTime: string; endTime: string; reason: string; nextAction?: string; ignored?: boolean };
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

function monthTitle(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function displayDateTitle(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const weekday = ["周日","周一","周二","周三","周四","周五","周六"][date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
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
function computeConflictLayout(tasks: Task[]): Map<string, { index: number; count: number }> {
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

    // Now store results with the FINAL column count
    const finalCount = columns.length;
    for (const a of assignments) {
      result.set(a.taskId, { index: a.col, count: finalCount });
    }
  }

  return result;
}

/**
 * Compute CSS left/width for a conflict‑laid‑out time block.
 * Supports two modes:
 * 1. Strict columns — when slotWidth >= MIN_READABLE (90px)
 * 2. Overlap‑offset — when slotWidth < MIN_READABLE (narrow weekly columns)
 */
function computeConflictStyle(
  taskId: string,
  layout: Map<string, { index: number; count: number }>,
  innerWidth: number,
  baseLeft: number,
  gap: number,
): { left: number; width: number; isNarrow: boolean } | null {
  const cl = layout.get(taskId);
  if (!cl || cl.count <= 1) return null;

  const slotW = (innerWidth - gap * (cl.count - 1)) / cl.count;
  const MIN_READABLE = 90;

  if (slotW >= MIN_READABLE) {
    // Strict side‑by‑side columns
    return {
      left: baseLeft + cl.index * (slotW + gap),
      width: slotW,
      isNarrow: false,
    };
  } else {
    // Overlap‑offset layout for narrow columns
    const overlapW = Math.max(80, innerWidth * 0.78);
    const offsetPx = cl.index * 14;
    return {
      left: baseLeft + offsetPx,
      width: Math.min(overlapW, innerWidth - offsetPx),
      isNarrow: true,
    };
  }
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
    details: ""
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
    createdAt: new Date().toISOString()
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

function App() {
  const [data, setData] = useState<PlannerData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState<AuthNotice>(null);
  const [mode, setModeState] = useState<Mode>("execute");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [drag, setDrag] = useState<DragState>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview>(null);
  const [hoverSlot, setHoverSlot] = useState<string>("");
  const [hoveredBlock, setHoveredBlock] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addType, setAddType] = useState<AddType>("task");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>(defaultForm());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [referencedTaskId, setReferencedTaskId] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiPlanMenuOpen, setAiPlanMenuOpen] = useState(false);
  const [aiPlanPrefs, setAiPlanPrefs] = useState<AiPlanPrefs>({ source: "today", scope: "day", strategy: "simple" });
  const [timelineView, setTimelineView] = useState<TimelineView>("daily");
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
  const [showCompletedCandidates, setShowCompletedCandidates] = useState(false);
  const [groupByProject, setGroupByProject] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectTitle, setQuickProjectTitle] = useState("");
  const [quickProjectColor, setQuickProjectColor] = useState(PROJECT_COLOR_PRESETS[0]);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const suppressBlockClickRef = useRef(false);
  const dragTargetDateRef = useRef<string>("");
  const lastTimelineAutoScrollKeyRef = useRef("");
  const dataRef = useRef<PlannerData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
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

  async function loadInitial() {
    const api = await waitForPlannerApi();
    const auth = (await api.getAuthState?.()) || { mode: "local" as const, user: null, configured: false };
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
    writeBootstrapCache(nextData, nextSettings, auth.user?.id);
    dataRef.current = nextData;
    settingsRef.current = nextSettings;
    setData(nextData);
    setSettings(nextSettings);
    setModeState((nextSettings.activeMode as Mode) || "execute");
    setAdvancedOpen(Boolean(nextSettings.addAdvancedOpen));
    if (nextSettings.defaultTimelineView) setTimelineView(nextSettings.defaultTimelineView);
  }

  useEffect(() => {
    void loadInitial().catch((error) => {
      setAuthError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  async function handleAuthSubmit(email: string, password: string, displayName: string, intent: "signin" | "signup") {
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
      await loadInitial();
      if (displayName) {
        const current = settingsRef.current;
        if (current && current.displayName !== displayName) {
          void saveSettings({ displayName });
        }
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
    setAuthError("");
    setAuthNotice(null);
    await loadInitial();
    const api = await waitForPlannerApi();
    const latest = await api.getAuthState?.();
    if (!latest?.user) {
      setAuthNotice({ type: "confirm-email", email });
      setAuthError("邮箱确认完成后，请直接登录。");
    }
  }

  async function handleSignOut() {
    await flushPendingSave();
    const api = await waitForPlannerApi();
    await api.signOut?.();
    setData(null);
    setSettings(null);
    await loadInitial();
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
  }, [mode, data, selectedDate, timelineView]);

  // Forward wheel events from the full timeline panel area to the scroll container
  useEffect(() => {
    const panel = document.getElementById("df-execute-timeline");
    if (!panel) return;
    const handler = (e: WheelEvent) => {
      const scroller = panel.querySelector(".df-timeline-scroll, .df-timeline-3day-scroll") as HTMLElement | null;
      if (!scroller) return;
      e.preventDefault();
      scroller.scrollTop += e.deltaY;
    };
    panel.addEventListener("wheel", handler, { passive: false });
    return () => panel.removeEventListener("wheel", handler);
  }, []);

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
    if (dataRef.current) writeBootstrapCache(dataRef.current, saved, authState?.user?.id);
    if (patch.activeMode) setModeState(patch.activeMode as Mode);
  }

  const today = todayIso();
  const timelineDate = selectedDate;
  const isViewingToday = timelineDate === today;
  const projects = data?.projects || [];
  const tasks = data?.tasks || [];
  const scheduledTasks = useMemo(
    () => tasks.filter((task) => task.scheduledDate === timelineDate && task.scheduledStart).sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)),
    [tasks, timelineDate]
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
      if (task.completed || task.scheduledDate) return false;
      return task.plannedForDate === today || Boolean(task.plannedForDate && task.plannedForDate < today);
    }).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [tasks, today]
  );
  const completedCandidates = useMemo(
    () => tasks.filter((task) => task.completed && task.plannedForDate === today && !task.scheduledDate).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [tasks, today]
  );
  // Conflict layout: maps taskId → { index, count } for overlapping tasks
  const conflictLayout = useMemo(() => {
    const map = new Map<string, { index: number; count: number }>();
    if (timelineView === "daily") {
      computeConflictLayout(scheduledTasks).forEach((v, k) => map.set(k, v));
    } else {
      const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
      const dayTasks = tasks.filter((t) => threeDates.includes(t.scheduledDate || "") && t.scheduledStart)
        .sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
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
  }, [tasks, timelineDate, timelineView, scheduledTasks]);

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

  const visibleCandidates = showCompletedCandidates ? [...todayCandidates, ...completedCandidates] : todayCandidates;
  const executeStats = useMemo(() => {
    const planned = tasks.filter((task) => !task.completed && task.plannedForDate === today);
    const scheduled = planned.filter((task) => task.scheduledDate === today && task.scheduledStart);
    const scheduledHours = scheduled.reduce((sum, task) => sum + taskDuration(task) / 60, 0);
    const totalHours = planned.reduce((sum, task) => sum + (task.estimatedHours || 0.5), 0);
    return { planned, scheduled, scheduledHours, totalHours };
  }, [tasks, today]);

  function projectName(task: Task) {
    return projects.find((project) => String(project.id) === String(task.projectId || ""))?.title || "未归属";
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

  function updateProject(projectId: string, patch: Partial<Project>) {
    if (!data) return;
    void saveData({
      ...data,
      projects: data.projects.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project)
    });
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? "" : current), 2600);
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
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (!ids.includes(task.id)) return task;
        const picked = planningPicks[task.id];
        return {
          ...task,
          priority: picked === "must" ? "high" : picked === "could" ? "low" : task.priority,
          plannedForDate: scope === "today" ? today : undefined,
          scheduledDate: undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          updatedAt: new Date().toISOString()
        };
      })
    });
    setPlanningPicks({});
    if (scope === "today") void saveSettings({ activeMode: "execute" });
    showToast(scope === "today" ? "已加入今日执行" : "已加入本周计划");
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
    showToast("已加入今日候选");
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
    showToast(snapshot.created ? "已创建项目" : "已选择已有项目");
    return snapshot.projectId;
  }

  function createProjectForTask(taskId: string, title: string) {
    if (!data || !title.trim()) return "";
    const snapshot = projectSnapshot(data.projects, title);
    void saveData({
      ...data,
      projects: snapshot.projects,
      tasks: data.tasks.map((task) => task.id === taskId ? { ...task, projectId: snapshot.projectId, updatedAt: new Date().toISOString() } : task)
    });
    showToast(snapshot.created ? "已创建并归属项目" : "已归属到已有项目");
    return snapshot.projectId;
  }

  function createTaskInProject(projectId: string) {
    if (!data) return;
    const title = window.prompt("新任务名称");
    if (!title?.trim()) return;
    const task = makeTask({
      ...defaultForm("task"),
      title: title.trim(),
      projectId,
      dueDate: today
    });
    void saveData({ ...data, tasks: [...data.tasks, task] });
    showToast("已添加到项目");
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
          plannedForDate: today,
          scheduledDate: timelineDate,
          scheduledStart: undefined,
          scheduledEnd: undefined
        }]
      });
      setQuickSchedule(null);
      showToast("已添加到全天任务");
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
    void saveData({
      ...data,
      projects: nextProjects,
      tasks: [...data.tasks, {
        ...task,
        plannedForDate: timelineDate,
        scheduledDate: timelineDate,
        scheduledStart: quickSchedule.startTime,
        scheduledEnd: endTime
      }]
    });
    setQuickSchedule(null);
    showToast("已添加到时间轴");
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
      tasks: [...data.tasks, { ...task, plannedForDate: targetDate, scheduledDate: targetDate, scheduledStart: undefined, scheduledEnd: undefined }]
    });
    setAllDayQuickAdd(null);
    showToast("已添加全天任务");
  }

  function makeAllDay(taskId: string, targetDate: string) {
    updateTask(taskId, { plannedForDate: targetDate, scheduledDate: targetDate, scheduledStart: undefined, scheduledEnd: undefined });
    showToast("已设为全天任务");
    setDrag(null);
  }

  function saveFloatingTimeAdd(title: string, projectId: string | null) {
    if (!data || !floatingTimeAdd) return;
    const { date, startTime, endTime } = floatingTimeAdd;
    const task = makeTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: date, estimatedHours: 0.5 });
    void saveData({
      ...data,
      tasks: [...data.tasks, { ...task, plannedForDate: date, scheduledDate: date, scheduledStart: startTime, scheduledEnd: endTime }]
    });
    setFloatingTimeAdd(null);
    showToast("已添加到时间轴");
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

  function scheduleTask(taskId: string, startTime: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const duration = taskDuration(task);
    const endTime = addMinutes(startTime, duration);
    const targetDate = dragTargetDateRef.current || timelineDate;
    updateTask(taskId, {
      plannedForDate: today,
      scheduledDate: targetDate,
      scheduledStart: startTime,
      scheduledEnd: endTime
    });
    showToast("已安排到时间轴");
    setHoverSlot("");
    setDrag(null);
    dragTargetDateRef.current = "";
  }

  function unscheduleTask(taskId: string) {
    updateTask(taskId, {
      plannedForDate: today,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined
    });
    showToast("已移回今日候选");
    setDrag(null);
    setHoverSlot("");
  }

  function returnToPlanning(taskId: string) {
    updateTask(taskId, {
      plannedForDate: undefined,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined
    });
    showToast("已放回规划");
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

  function beginBlockDrag(event: React.MouseEvent, task: Task) {
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    event.preventDefault();
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
        active = true;
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
            makeAllDay(task.id, targetDate);
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            window.setTimeout(() => { suppressBlockClickRef.current = false; }, 0);
            return;
          }
        }
        const leftPanel = document.querySelector(".df-candidate-panel")?.getBoundingClientRect();
        if ((leftPanel && upEvent.clientX >= leftPanel.left && upEvent.clientX <= leftPanel.right && upEvent.clientY >= leftPanel.top && upEvent.clientY <= leftPanel.bottom) || pointerOutsideTimeline(upEvent.clientX, upEvent.clientY)) {
          unscheduleTask(task.id);
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
            scheduleTask(task.id, minutesToTime(clampSlot(timeToMinutes(target.startTime) - offsetMinutes)));
          } else {
            scheduleTask(task.id, slotFromPointer(upEvent.clientY, offsetMinutes));
          }
        }
      }
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
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
      const slot = slotFromPointer(upEvent.clientY);
      const slotMin = timeToMinutes(slot);
      const start = timeToMinutes(task.scheduledStart);
      const end = timeToMinutes(task.scheduledEnd);
      if (edge === "start") {
        const nextStart = minutesToTime(Math.min(slotMin, end - SLOT_MINUTES));
        const nextEnd = task.scheduledEnd || minutesToTime(end);
        updateTask(task.id, {
          scheduledStart: nextStart,
          estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60
        });
        showToast("已调整时长");
      } else {
        const nextStart = task.scheduledStart || minutesToTime(start);
        const nextEnd = minutesToTime(Math.max(slotMin, start + SLOT_MINUTES));
        updateTask(task.id, {
          scheduledEnd: nextEnd,
          estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60
        });
        showToast("已调整时长");
      }
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
    setForm(defaultForm(type));
    setDrawerOpen(true);
  }

  function openTaskEdit(task: Task) {
    setAddType("task");
    setEditingId(task.id);
    setForm({
      title: task.title,
      projectId: task.projectId || "",
      projectColor: "#C69CF9",
      dueDate: task.dueDate || today,
      dueTime: "",
      endDate: task.dueDate || today,
      endTime: "",
      category: task.category,
      priority: task.priority,
      importance: task.importance || task.priority,
      urgency: task.urgency || "low",
      estimatedHours: task.estimatedHours || 0.5,
      details: task.notes || ""
    });
    setDrawerOpen(true);
  }

  function openProjectEdit(project: Project) {
    setAddType("project");
    setEditingId(project.id);
    setForm({ ...defaultForm("project"), title: project.title, category: project.category, projectColor: project.color || categories[project.category].color, details: project.notes, importance: project.importance || "high", urgency: project.urgency || "low" });
    setDrawerOpen(true);
  }

  function openEventEdit(event: CalendarEvent) {
    setAddType("event");
    setEditingId(event.id);
    setForm({ ...defaultForm("event"), title: event.title, dueDate: event.startDate || event.date, endDate: event.endDate || event.date, dueTime: event.startTime || "", endTime: event.endTime || "", category: event.category, details: event.details });
    setDrawerOpen(true);
  }

  function saveForm() {
    if (!data || !form.title.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      if (addType === "task") {
        void saveData({
          ...data,
          tasks: data.tasks.map((task) => task.id === editingId ? {
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
            updatedAt: now
          } : task)
        });
      } else if (addType === "project") {
        void saveData({ ...data, projects: data.projects.map((project) => project.id === editingId ? { ...project, title: form.title.trim(), category: form.category, color: form.projectColor || categories[form.category].color, notes: form.details, importance: form.importance, urgency: form.urgency, updatedAt: now } : project) });
      } else {
        void saveData({ ...data, events: data.events.map((event) => event.id === editingId ? { ...event, title: form.title.trim(), date: form.dueDate, startDate: form.dueDate, endDate: form.endDate || form.dueDate, startTime: form.dueTime, endTime: form.endTime, category: form.category, details: form.details } : event) });
      }
    } else if (addType === "task") {
      void saveData({ ...data, tasks: [...data.tasks, makeTask(form)] });
    } else if (addType === "project") {
      void saveData({ ...data, projects: [...data.projects, makeProject(form)] });
    } else {
      void saveData({ ...data, events: [...data.events, makeEvent(form)] });
    }
    setEditingId("");
    setForm(defaultForm("task"));
    setAddType("task");
    setDrawerOpen(false);
  }

  function deleteEditingItem() {
    if (!data || !editingId) return;
    if (addType === "task") void saveData({ ...data, tasks: data.tasks.filter((task) => task.id !== editingId) });
    if (addType === "project") void saveData({ ...data, projects: data.projects.filter((project) => project.id !== editingId) });
    if (addType === "event") void saveData({ ...data, events: data.events.filter((event) => event.id !== editingId) });
    setDrawerOpen(false);
    setEditingId("");
  }

  function copyEditingTask() {
    if (!data || !editingId) return;
    const task = data.tasks.find((item) => item.id === editingId);
    if (!task) return;
    const now = new Date().toISOString();
    void saveData({
      ...data,
      tasks: [...data.tasks, {
        ...task,
        id: uid("task"),
        title: `${task.title} 副本`,
        completed: false,
        scheduledDate: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        createdAt: now,
        updatedAt: now
      }]
    });
    showToast("已复制任务");
  }

  function askAi(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setReferencedTaskId(task.id);
    setAiInput(`请帮我明确「${task.title}」的下一步行动。`);
    setAiOpen(true);
  }

  async function sendAi() {
    if (!settings || !aiInput.trim()) return;
    const task = tasks.find((item) => item.id === referencedTaskId);
    setAiBusy(true);
    try {
      const response = await window.plannerApi.chat({
        messages: [
          { role: "system", content: "你是 NavoPath 的升学任务教练。只给具体下一步，不自动修改用户数据。" },
          { role: "user", content: JSON.stringify({ question: aiInput, task }) }
        ]
      });
      setAiReply(response.reply);
    } catch (error) {
      setAiReply(error instanceof Error ? error.message : "AI 请求失败");
    } finally {
      setAiBusy(false);
    }
  }

  async function generateNextAction() {
    const task = editingId ? tasks.find((item) => item.id === editingId) : null;
    if (!settings?.hasApiKey) {
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, `先打开相关材料，完成「${current.title}」的最小可检查版本。`) }));
      return;
    }
    const response = await window.plannerApi.chat({
      messages: [
        { role: "system", content: "返回 JSON：{\"nextAction\":\"...\"}。下一步必须具体、可执行。" },
        { role: "user", content: JSON.stringify({ title: form.title, project: projects.find((project) => project.id === form.projectId)?.title, date: form.dueDate, estimatedHours: form.estimatedHours, notes: form.details, subtasks: task?.subtasks || [] }) }
      ]
    });
    const match = response.reply.match(/\{[\s\S]*\}/);
    const nextAction = match ? JSON.parse(match[0]).nextAction : response.reply.trim();
    setForm((current) => ({ ...current, details: replaceNextAction(current.details, nextAction) }));
  }

  async function planMyDay() {
    if (!settings || todayCandidates.length === 0) {
      alert("今天还没有候选任务。请先从规划中选择任务，或快速添加一个任务。");
      return;
    }
    setAiPlanning(true);
    setSelectedDate(today);
    const todayScheduled = tasks.filter((task) => task.scheduledDate === today && task.scheduledStart);
    const localFallback = () => {
      let cursor = Math.max(9 * 60, clampSlot(new Date().getHours() * 60 + new Date().getMinutes()));
      return todayCandidates.slice(0, 5).map((task) => {
        const duration = taskDuration(task);
        const startTime = minutesToTime(cursor);
        const endTime = minutesToTime(cursor + duration);
        cursor += duration + 15;
        return { id: uid("suggestion"), taskId: task.id, startTime, endTime, reason: "基于今日候选和预计用时生成。", nextAction: extractNextAction(task.notes) || `先完成「${task.title}」的最小可交付版本。` };
      });
    };
    if (!settings.hasApiKey) {
      setSuggestions(localFallback());
      setAiPlanning(false);
      return;
    }
    try {
      const response = await window.plannerApi.chat({
        messages: [
          { role: "system", content: "只返回 JSON：{\"suggestions\":[{\"taskId\":\"xxx\",\"startTime\":\"15:30\",\"endTime\":\"16:30\",\"reason\":\"...\",\"nextAction\":\"...\"}]}。不要覆盖已有时间块，使用 15 分钟粒度。" },
          { role: "user", content: JSON.stringify({ today, candidates: todayCandidates, scheduled: todayScheduled, projects, preferences: aiPlanPrefs }) }
        ]
      });
      const json = JSON.parse((response.reply.match(/\{[\s\S]*\}/)?.[0]) || "{}");
      setSuggestions((json.suggestions || []).map((item: any) => ({ id: uid("suggestion"), ...item })));
    } catch {
      setSuggestions(localFallback());
    } finally {
      setAiPlanning(false);
    }
  }

  function suggestionConflict(suggestion: ScheduleSuggestion) {
    const start = timeToMinutes(suggestion.startTime);
    const end = timeToMinutes(suggestion.endTime);
    return scheduledTasks.some((task) => {
      const a = timeToMinutes(task.scheduledStart);
      const b = timeToMinutes(task.scheduledEnd);
      return start < b && end > a;
    });
  }

  function applySuggestion(id: string) {
    const suggestion = suggestions.find((item) => item.id === id);
    const task = tasks.find((item) => item.id === suggestion?.taskId);
    if (!suggestion || !task || suggestionConflict(suggestion)) return;
    updateTask(task.id, {
      plannedForDate: today,
      scheduledDate: today,
      scheduledStart: suggestion.startTime,
      scheduledEnd: suggestion.endTime,
      notes: suggestion.nextAction ? replaceNextAction(task.notes || "", suggestion.nextAction) : task.notes
    });
    setSuggestions((current) => current.filter((item) => item.id !== id));
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
    return <Suspense fallback={<div className="df-loading"><ProductIcon />NavoPath 加载中...</div>}>
      <LandingPageLazy busy={authBusy} error={authError} notice={authNotice} onLogin={handleAuthSubmit} onResend={resendConfirmation} onContinueAfterConfirm={continueAfterConfirm} />
    </Suspense>;
  }

  if (!data || !settings) return <div className="df-loading"><ProductIcon />NavoPath 加载中...</div>;

  return (
    <div className={`df-app mode-${mode} theme-${settings.theme}${settings.themeGradientEnabled === false ? " no-highlight" : ""}`} style={themeVars(settings, mode)}>
      <header className="df-header">
        <div className="df-header-inner">
          <div className="df-brand"><ProductIcon compact /><div><strong>NavoPath</strong></div></div>
          <div className="df-header-right">
          <nav className="df-tabs df-tabs-right">
            <button className={mode === "execute" ? "active" : ""} onClick={() => void saveSettings({ activeMode: "execute" })}>执行</button>
            <button className={mode === "planning" ? "active" : ""} onClick={() => void saveSettings({ activeMode: "planning" })}>规划</button>
          </nav>
          <button className="df-user-avatar" onClick={() => setUtilityPanel("settings")} aria-label="设置">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10.91 3H11a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
        </div>
      </header>
      <div className="df-header-fade" />
      <div id="df-portal-target" />

      {mode === "execute" ? (
        <main className="df-execute">
          <section className="df-candidate-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            const taskId = drag?.taskId || event.dataTransfer.getData("taskId");
            if (taskId) unscheduleTask(taskId);
          }}>
            <div className="df-panel-title">
              <h2>今日候选</h2>
              <div>
                <button className={`df-icon-action i-check ${showCompletedCandidates ? "active" : ""}`} data-tip={showCompletedCandidates ? "隐藏已完成" : "显示已完成"} aria-label={showCompletedCandidates ? "隐藏已完成" : "显示已完成"} onClick={() => setShowCompletedCandidates((value) => !value)} />
                <button className={`df-icon-action i-layers ${groupByProject ? "active" : ""}`} data-tip={groupByProject ? "取消分组" : "按项目分组"} aria-label={groupByProject ? "取消分组" : "按项目分组"} onClick={() => setGroupByProject((v) => !v)} />
                <button className="df-icon-action i-branch" data-tip="从规划选择" aria-label="从规划选择" onClick={openPlanningPicker} />
              </div>
            </div>
            <div className="df-candidate-list">
              {visibleCandidates.length === 0 ? (
                <div className="df-empty"><div className="blob-accent" /><strong>今天还没有任务</strong><span>从规划页选择任务，或直接添加一个。</span><button className="df-empty-pick-btn" onClick={openPlanningPicker}>从规划选择</button></div>
              ) : groupByProject ? (
                Array.from(
                  visibleCandidates.reduce((map, task) => {
                    const gid = task.projectId || "__unassigned__";
                    if (!map.has(gid)) map.set(gid, []);
                    map.get(gid)!.push(task);
                    return map;
                  }, new Map<string, Task[]>())
                )
                  .sort(([a], [b]) => a === "__unassigned__" ? 1 : b === "__unassigned__" ? -1 : 0)
                  .map(([gid, tasks]) => {
                    const project = gid === "__unassigned__" ? null : projects.find(p => String(p.id) === String(gid));
                    const projectColor = project?.color || "var(--accent-active)";
                    const projectTitle = project?.title || "未归属";
                    return (
                      <div key={gid} className="df-project-group">
                        <div className="df-project-group-header">
                          <span className="df-project-group-dot" style={{ background: projectColor }} />
                          <span className="df-project-group-name">{projectTitle}</span>
                          <span className="df-project-group-count">{tasks.length}</span>
                        </div>
                        {tasks.map((task) => (
                          <TaskCard key={task.id} task={task} projects={projects} focusDate={today} projectName={projectName(task)} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onReturnPlanning={() => returnToPlanning(task.id)} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => {
                            void saveData({ ...data, tasks: data.tasks.filter((item) => item.id !== task.id) });
                            showToast("已删除任务");
                          }} onClick={() => openTaskEdit(task)} onDragStart={(event) => {
                            event.dataTransfer.setData("taskId", task.id);
                            setDragCreate(null);
                            setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                          }} onDragEnd={() => setDrag(null)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} />
                        ))}
                      </div>
                    );
                  })
              ) : visibleCandidates.map((task) => (
                <TaskCard key={task.id} task={task} projects={projects} focusDate={today} projectName={projectName(task)} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onReturnPlanning={() => returnToPlanning(task.id)} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => {
                  void saveData({ ...data, tasks: data.tasks.filter((item) => item.id !== task.id) });
                  showToast("已删除任务");
                }} onClick={() => openTaskEdit(task)} onDragStart={(event) => {
                  event.dataTransfer.setData("taskId", task.id);
                  setDragCreate(null);
                  setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                }} onDragEnd={() => setDrag(null)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} />
              ))}
            </div>
            <form className="df-quick-add" onSubmit={(event) => {
              event.preventDefault();
              quickAddTask();
            }}>
              <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="添加任务 #项目" />
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
              />
              <button className="df-quick-add-submit" type="submit" disabled={!quickTitle.trim()}>添加</button>
            </form>
          </section>

          <section className="df-timeline-panel" id="df-execute-timeline">
            <button className="df-date-arrow left" aria-label="前一段" onClick={() => shiftTimeline(-1)}>‹</button>
            <button className="df-date-arrow right" aria-label="后一段" onClick={() => shiftTimeline(1)}>›</button>
            <div className="df-execute-top">
              {!settings.hideAi && <div className="df-ai-planner">
                    <button className={`df-ai-plan ${aiPlanning ? "thinking" : ""}`} data-tip={drawerOpen ? "请先关闭侧边栏" : "规划建议"} aria-label="AI 规划今天" disabled={aiPlanning || drawerOpen} onClick={() => void planMyDay()}>{aiPlanning ? <><i />分析中...</> : "规划建议"}</button>
                <button className={`df-ai-plan-toggle ${aiPlanMenuOpen ? "active" : ""}`} aria-label="AI 规划设置" onClick={(event) => {
                  event.stopPropagation();
                  setAiPlanMenuOpen((open) => !open);
                }}>⌄</button>
                {aiPlanMenuOpen && <span className="df-ai-plan-menu open" onClick={(event) => event.stopPropagation()}>
                  <label>任务来源<select value={aiPlanPrefs.source} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, source: event.target.value as AiPlanPrefs["source"] }))}><option value="today">今日候选</option><option value="all">全部未完成</option></select></label>
                  <label>安排范围<select value={aiPlanPrefs.scope} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, scope: event.target.value as AiPlanPrefs["scope"] }))}><option value="day">天</option><option value="3day">3天</option></select></label>
                  <label>规划策略<select value={aiPlanPrefs.strategy} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, strategy: event.target.value as AiPlanPrefs["strategy"] }))}><option value="simple">顺序安排</option><option value="priority">优先级优先</option><option value="deadline">截止日优先</option></select></label>
                </span>}
              </div>}
              <div className="df-timeline-actions">
              </div>
            </div>
            <div className="df-timeline-body">
              <div className="df-timeline-content">
                {timelineDate !== today && (
                  <button className="df-back-today" onClick={() => setSelectedDate(today)} title="回到今天">↵</button>
                )}
                {(timelineView === "3day" || timelineView === "weekly") ? (() => {
                  const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
                  const weekdayShort = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
                  const canvasHeight = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * SLOT_HEIGHT;
                  const slotCount = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1;
                  const multiDayScheduledTasks = tasks.filter((task) => threeDates.includes(task.scheduledDate || "") && task.scheduledStart).sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
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
                          <span className="df-timeline-3day-allday-label">全天</span>
                        </div>
                        <div className="df-timeline-3day-dates">
                          {threeDates.map((colDate, ci) => {
                            const adTasks = tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === colDate);
                            return (
                              <div key={colDate} className="df-timeline-3day-allday-cell"
                                onClick={(event) => {
                                  if (drawerOpen || drag || resizePreview || aiPlanning) return;
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
                                  <AllDayBlock key={task.id} task={task} projectName={projectName(task)} projects={projects} onEdit={() => openTaskEdit(task)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onDragStart={(event) => {
                                    event.dataTransfer.setData("taskId", task.id);
                                    setDragCreate(null);
                                    setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                                  }} onDragEnd={() => setDrag(null)} />
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
                                  const endTime = addMinutes(target.startTime, drag?.duration || 60);
                                  updateTask(taskId, { plannedForDate: today, scheduledDate: target.date, scheduledStart: target.startTime, scheduledEnd: endTime });
                                  showToast("已安排到时间轴");
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
                                if (drag || resizePreview || aiPlanning) return;
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
                                if (drag || resizePreview || aiPlanning) return;
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
                                  const cs = computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap);
                                  let left = baseLeft;
                                  let width = innerW;
                                  let overflow: CSSProperties["overflow"] = undefined;
                                  if (cs) {
                                    left = cs.left;
                                    width = cs.width;
                                    if (cs.isNarrow) overflow = "hidden";
                                  }
                                  return (
                                    <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} onHover={setHoveredBlock} onEdit={() => {
                                      if (!suppressBlockClickRef.current) openTaskEdit(task);
                                    }} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                                      createProjectForTask(task.id, title);
                                    }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)}
                                      extraStyle={{ position: "absolute", left, width, pointerEvents: "auto", overflow }}
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
                                    <PreviewBlock task={tasks.find((task) => task.id === drag.taskId)} startTime={hoverSlot} duration={drag.duration} draggingBlock={drag.kind === "block"} conflict={hasScheduleConflict(hoverSlot, addMinutes(hoverSlot, drag.duration), drag.taskId)}
                                      extraStyle={{ position: "absolute", left: dayIndex * multiColWidth + gutter, width: multiColWidth - gutter * 2 }}
                                    />
                                  );
                                })()}
                                {/* Now line — only in today's column in multi-day view */}
                                {(() => {
                                  const todayIdx = threeDates.indexOf(today);
                                  if (todayIdx === -1 || multiColWidth <= 0) return null;
                                  return <NowLine extraStyle={{ left: todayIdx * multiColWidth, width: multiColWidth }} />;
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
                                        void saveData({
                                          ...data,
                                          tasks: [...data.tasks, { ...task, plannedForDate: date, scheduledDate: date, scheduledStart: startTime, scheduledEnd: endTime }]
                                        });
                                        setDragCreate(null);
                                        showToast("已添加到时间轴");
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
                  const activeMonth = new Date(`${timelineDate}T00:00:00`).getMonth();
                  // Group into 6 weeks
                  const weeks: string[][] = [];
                  for (let w = 0; w < 6; w++) weeks.push(allMonthDays.slice(w * 7, w * 7 + 7));
                  function getDayTasks(day: string) {
                    return tasks.filter((task) => task.scheduledDate === day || task.plannedForDate === day || task.dueDate === day);
                  }
                  const baseDayH = 88, taskH = 28, taskGap = 6, weekPad = 18;
                  return (
                    <div className="df-month-view">
                      <div className="df-month-header">
                        <div className="df-month-title">{monthTitle(timelineDate)}</div>
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
                                          const aD = a.completed ? 1 : 0, bD = b.completed ? 1 : 0;
                                          if (aD !== bD) return aD - bD;
                                          const aT = a.scheduledStart || "", bT = b.scheduledStart || "";
                                          if (aT && bT) return aT.localeCompare(bT);
                                          if (aT) return -1; if (bT) return 1; return 0;
                                        }).map((task) => (
                                          <button key={task.id} className={`df-month-task${task.completed ? " completed" : ""}`}
                                            draggable
                                            style={{ "--cat": projects.find((p) => String(p.id) === String(task.projectId || ""))?.color || categories[task.category].color } as CSSProperties}
                                            onClick={(e) => { e.stopPropagation(); openTaskEdit(task); }}
                                            onDragStart={(e) => {
                                              e.dataTransfer.setData("taskId", task.id);
                                              e.dataTransfer.effectAllowed = "move";
                                              setDragCreate(null);
                                              setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                                            }}
                                            onDragEnd={() => setDrag(null)}
                                          ><span />{task.scheduledStart ? <time>{task.scheduledStart}</time> : null}{task.title}</button>
                                        ))}
                                        {monthQuickAdd && !drag && monthQuickAdd.date === day && (
                                          <AllDayQuickAddPopover absolute add={monthQuickAdd} projects={projects}
                                            onSave={(title, projectId) => {
                                              if (!data || !title.trim()) return;
                                              const t = makeTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: day, estimatedHours: 0.5 });
                                              void saveData({ ...data, tasks: [...data.tasks, { ...t, plannedForDate: day, scheduledDate: day, order: Date.now() }] });
                                              setMonthQuickAdd(null);
                                              showToast("已添加任务");
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
                      {displayDateTitle(timelineDate)}
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
                      <span className="df-timeline-allday-label">全天</span>
                      <div className="df-timeline-allday-content"
                        onClick={(event) => {
                          if (drawerOpen || drag || resizePreview || aiPlanning) return;
                          if ((event.target as HTMLElement).closest(".df-all-day-block,.df-all-day-quick")) return;
                          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                          const gutter = 6;
                          setAllDayQuickAdd({ date: timelineDate, left: rect.left + gutter, top: rect.top + 4, width: rect.width - gutter * 2, dayIndex: 0 });
                        }}
                      >
                        {allDayQuickAdd && !drag && (
                          <AllDayQuickAddPopover add={allDayQuickAdd} projects={projects} onSave={(title) => createAllDayTask(title, allDayQuickAdd.date, null)} onCancel={() => setAllDayQuickAdd(null)} />
                        )}
                        {tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === timelineDate).map((task) => (
                          <AllDayBlock key={task.id} task={task} projectName={projectName(task)} projects={projects} onEdit={() => openTaskEdit(task)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onDragStart={(event) => {
                            event.dataTransfer.setData("taskId", task.id);
                            setDragCreate(null);
                            setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                          }} onDragEnd={() => setDrag(null)} />
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
                          if (drag || resizePreview || aiPlanning) return;
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
                        {isViewingToday && <NowLine />}
                        {scheduledTasks.length === 0 && suggestions.length === 0 && !drag && <div className="df-timeline-empty"><div className="blob-accent" />拖任务到这里安排时间</div>}
                        {hoverSlot && drag && !drag.outsideTimeline && <PreviewBlock task={tasks.find((task) => task.id === drag.taskId)} startTime={hoverSlot} duration={drag.duration} draggingBlock={drag.kind === "block"} conflict={hasScheduleConflict(hoverSlot, addMinutes(hoverSlot, drag.duration), drag.taskId)} />}
                        {suggestions.filter((item) => !item.ignored).map((suggestion) => <SuggestionBlock key={suggestion.id} suggestion={suggestion} task={tasks.find((task) => task.id === suggestion.taskId)} conflict={suggestionConflict(suggestion)} onApply={() => applySuggestion(suggestion.id)} onIgnore={() => setSuggestions((current) => current.map((item) => item.id === suggestion.id ? { ...item, ignored: true } : item))} />)}
                        {scheduledTasks.filter((task) => !(drag?.kind === "block" && drag.taskId === task.id)).map((task) => {
                          // Use dailyCanvasWidth from ResizeObserver if available,
                          // otherwise fall back to synchronously reading the DOM ref.
                          const liveEl = timelineCanvasRef.current;
                          const liveW = liveEl ? liveEl.getBoundingClientRect().width : 0;
                          const avail = dailyCanvasWidth > 0 ? dailyCanvasWidth : liveW;
                          const innerW = avail > 0 ? avail - 16 : 0;
                          const baseLeft = 8;
                          const gap = 4;
                          const cs = innerW > 0 ? computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap) : null;
                          const left = cs ? cs.left : baseLeft;
                          const width = cs ? cs.width : innerW;
                          const extraStyle: CSSProperties | undefined = innerW > 0 ? { left, width } : undefined;

                          return (
                            <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} onHover={setHoveredBlock} onEdit={() => {
                              if (!suppressBlockClickRef.current) openTaskEdit(task);
                            }} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                              createProjectForTask(task.id, title);
                            }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} extraStyle={extraStyle} />
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
                                  void saveData({
                                    ...data,
                                    tasks: [...data.tasks, { ...task, plannedForDate: date, scheduledDate: date, scheduledStart: startTime, scheduledEnd: endTime }]
                                  });
                                  setDragCreate(null);
                                  showToast("已添加到时间轴");
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
              <div className="df-view-switch-vertical" aria-label="切换时间视图">
                {([
                  ["daily", "日"],
                  ["3day", "3天"],
                  ["weekly", "周"],
                  ["month", "月"]
                ] as Array<[TimelineView, string]>).map(([view, label]) => <button key={view} className={timelineView === view ? "active" : ""} onClick={() => { setTimelineView(view); setDragCreate(null); }}>{label}</button>)}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <Suspense fallback={<div className="df-loading-inline">规划加载中...</div>}>
          <PlanningViewLazy data={data} projects={projects} tasks={tasks} collapsed={collapsedBranches} setCollapsed={setCollapsedBranches} pickMode={planningPickMode} picks={planningPicks} onExitPickMode={() => setPlanningPickMode(false)} onAddPick={addPlanningPick} onUpdatePick={updatePlanningPick} onRemovePick={removePlanningPick} onClearPicks={clearPlanningPicks} onApplyPicks={applyPlanningPicks} onProjectEdit={openProjectEdit} onTaskEdit={openTaskEdit} onTaskUpdate={updateTask} onTaskCreate={createTaskInProject} onProjectTasksClick={(projectId, rect) => { setSourceAnchorRect(rect); setSourceFilterProjectId(projectId); setSourceOpen(true); }} onTaskDelete={(taskId) => {
            void saveData({ ...data, tasks: data.tasks.filter((task) => task.id !== taskId) });
          }} />
        </Suspense>
      )}

      <button className="df-add-fab df-icon-action i-plus" data-tip="添加" aria-label="添加" onClick={() => openAdd("task")} />
      {!settings.hideAi && <button className="df-ai-fab df-icon-action i-ai" data-tip="问Navo" aria-label="问Navo" onClick={() => setAiOpen((open) => !open)} />}

      {drawerOpen && <div className="df-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)} />}
      {drawerOpen && <EditDrawer type={addType} setType={(type) => { setAddType(type); if (!editingId) setForm(defaultForm(type)); }} form={form} setForm={setForm} projects={projects} editing={Boolean(editingId)} task={tasks.find((task) => task.id === editingId)} today={today} advancedOpen={advancedOpen} setAdvancedOpen={(open) => { setAdvancedOpen(open); void saveSettings({ addAdvancedOpen: open }); }} onClose={() => setDrawerOpen(false)} onSave={saveForm} onDelete={deleteEditingItem} onCopy={copyEditingTask} onTaskUpdate={updateTask} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onToggleDone={() => updateTask(editingId, { completed: !tasks.find((task) => task.id === editingId)?.completed })} onNextAction={() => void generateNextAction()} onCreateProject={quickCreateProject} />}
      {aiOpen && <AiPanel input={aiInput} setInput={setAiInput} reply={aiReply} busy={aiBusy} onSend={() => void sendAi()} onClose={() => setAiOpen(false)} />}
      {utilityPanel && settings && <UtilityPanel kind={utilityPanel} settings={settings} authEmail={authState?.user?.email || ""} onClose={() => setUtilityPanel(null)} onSave={(patch) => void saveSettings(patch)} onShowAbout={() => setUtilityPanel("about")} onSignOut={authState?.mode === "cloud" ? (() => void handleSignOut()) : undefined} />}
      {drag?.kind === "block" && drag.outsideTimeline && drag.pointer && <FloatingUnschedulePreview task={tasks.find((task) => task.id === drag.taskId)} pointer={drag.pointer} />}
      {floatingTimeAdd && <FloatingTimeAddInput add={floatingTimeAdd} projects={projects} onSave={saveFloatingTimeAdd} onCancel={() => setFloatingTimeAdd(null)} />}
      {toast && <div className="df-toast">{toast}</div>}
      {sourceOpen && <SourceModal tasks={tasks} projects={projects} today={today} anchorRect={sourceAnchorRect} defaultFilter={sourceFilterProjectId || undefined} onClose={() => { setSourceOpen(false); setSourceFilterProjectId(null); setSourceAnchorRect(null); }} onJoin={(taskIds) => { taskIds.forEach((id) => addPlanningPick(id)); showToast(`已添加 ${taskIds.length} 个任务到候选`); setSourceOpen(false); setSourceFilterProjectId(null); setSourceAnchorRect(null); }} />}
    </div>
  );
}

function FloatingUnschedulePreview({ task, pointer }: { task?: Task; pointer: { x: number; y: number } }) {
  if (!task) return null;
  return <div className="df-floating-unschedule" style={{ left: pointer.x + 14, top: pointer.y + 14 }}><strong>{task.title}</strong><span>松开放回今日候选</span></div>;
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

function TaskCard({ task, projects, focusDate, projectName, onQuickDuration, onProjectChange, onReturnPlanning, onSaveNote, onDelete, onToggleDone, onClick, onDragStart, onDragEnd }: { task: Task; projects: Project[]; focusDate: string; projectName: string; onQuickDuration: (minutes: number) => void; onProjectChange: (projectId: string) => void; onReturnPlanning: () => void; onSaveNote: (note: string) => void; onDelete: () => void; onToggleDone: () => void; onClick: () => void; onDragStart: (event: React.DragEvent) => void; onDragEnd: () => void }) {
  const [quickOpen, setQuickOpen] = useState<"duration" | "info" | "note" | "project" | null>(null);
  const [noteDraft, setNoteDraft] = useState(task.notes || "");
  const overdue = task.dueDate < focusDate ? dateDiff(task.dueDate, focusDate) : 0;
  const status = overdue > 0 ? `逾期 ${overdue} 天` : task.plannedForDate === focusDate ? (focusDate === todayIso() ? "今日" : "当日") : "本周";
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  const cardAccentColor = projects.find(p => String(p.id) === String(task.projectId || ""))?.color || "var(--accent-active)";
  return (
    <article className={`df-task-card ${overdue > 0 ? "overdue" : ""} ${task.completed ? "completed" : ""}`} style={{"--cat": cardAccentColor} as React.CSSProperties} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}>
      <div className="candidate-task-accent" style={{ background: cardAccentColor }} />
      <button className={`df-block-check ${task.completed ? "completed" : ""}`} title={task.completed ? "标记未完成" : "标记完成"} onClick={(event) => {
        event.stopPropagation();
        onToggleDone();
      }}>{task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}</button>
      <div className="df-candidate-row">
        <strong className="df-candidate-title" title={task.title}>{task.title}</strong>
        <button className={`df-duration-pill ${quickOpen === "note" || quickOpen === "project" ? "project-mode" : ""}`} title={quickOpen === "note" || quickOpen === "project" ? "移动到项目" : "修改时长"} onClick={(event) => {
          event.stopPropagation();
          if (quickOpen === "note" || quickOpen === "project") {
            setQuickOpen(quickOpen === "project" ? "note" : "project");
          } else {
            setQuickOpen(quickOpen === "duration" ? null : "duration");
          }
        }}>{quickOpen === "note" || quickOpen === "project" ? "#" : formatDuration(task.estimatedHours || 0.5)}</button>
        <button className={`df-icon-button ${quickOpen === "info" ? "icon-collapse" : "icon-info"}`} title={quickOpen === "info" ? "收起" : "更多信息"} onClick={(event) => {
          event.stopPropagation();
          setQuickOpen(quickOpen === "info" ? null : "info");
        }} />
        <button className="df-icon-button icon-note" title="展开备注" onClick={(event) => {
          event.stopPropagation();
          setQuickOpen(quickOpen === "note" ? null : "note");
        }} />
      </div>
      {quickOpen === "duration" && (
        <div className="df-card-popover duration-list" onClick={stop}>
          {DURATION_OPTIONS.map((minutes) => <button key={minutes} className={Math.round((task.estimatedHours || 0.5) * 60) === minutes ? "active" : ""} onClick={() => {
            onQuickDuration(minutes);
            setQuickOpen(null);
          }}>{formatMinutes(minutes)}</button>)}
        </div>
      )}
      {quickOpen === "info" && (
        <div className="df-card-popover info" onClick={stop}>
          <span>{status}</span>
          <span>{projectName}</span>
          <span>优先级 {priorityLabel[task.priority]}</span>
          <span>截止 {shortDate(task.dueDate)}</span>
          <button onClick={() => {
            onReturnPlanning();
            setQuickOpen(null);
          }}>放回规划</button>
        </div>
      )}
      {quickOpen === "project" && (
        <div className="df-card-popover project-list" onClick={stop}>
          <button onClick={() => {
            onProjectChange("");
            setQuickOpen(null);
          }}># 未归属</button>
          {projects.map((project) => <button key={project.id} className={String(project.id) === String(task.projectId || "") ? "active" : ""} onClick={() => {
            onProjectChange(project.id);
            setQuickOpen(null);
          }}># {project.title}</button>)}
        </div>
      )}
      {quickOpen === "note" && (
        <div className="df-card-popover note" onClick={stop}>
          <textarea autoFocus rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="备注" />
          <button onClick={() => {
            onSaveNote(noteDraft);
            setQuickOpen(null);
          }}>保存</button>
        </div>
      )}
    </article>
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

function TimeBlock({ task, preview, projectName, projects, hovered, onHover, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onResizeStart, extraStyle }: { task: Task; preview: ResizePreview; projectName: string; projects: Project[]; hovered: boolean; onHover: (id: string) => void; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.MouseEvent) => void; onResizeStart: (event: React.MouseEvent, edge: "start" | "end") => void; extraStyle?: CSSProperties }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const start = preview?.start || task.scheduledStart || "09:00";
  const end = preview?.end || task.scheduledEnd || addMinutes(start, taskDuration(task));
  const top = timeBlockTop(start);
  const height = Math.max(timeBlockHeight(start, end), SLOT_HEIGHT);
  const next = extractNextAction(task.notes);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered]);
  return (
    <div className={`df-time-block priority-${task.priority} ${task.completed ? "completed" : ""} ${preview ? "resizing" : ""} ${projectOpen ? "project-open" : ""}`} style={{ top, height, "--cat": stripeColor, "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px", ...extraStyle } as CSSProperties} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => {
      onHover("");
    }} onMouseDown={onDragStart} onClick={onEdit} onDoubleClick={onEdit}>
      <button className="df-resize-dot top" aria-label="调整开始时间" onMouseDown={(event) => onResizeStart(event, "start")} />
      <div className="df-category-strip" />
      <button className={`df-block-check ${task.completed ? "completed" : ""}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => {
        event.stopPropagation();
        onToggleDone();
      }} aria-label={task.completed ? "标记未完成" : "标记完成"}>{task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}</button>
      <div className="df-block-title-row">
        <strong title={task.title}>{task.title}</strong>
      </div>
      {hovered && <span className="df-block-project-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => {
          event.stopPropagation();
          setProjectOpen((open) => !open);
        }}># {projectName}</button>
      </span>}
      {next && <span className="df-next">下一步：{next}</span>}
      <button className="df-resize-dot bottom" aria-label="调整结束时间" onMouseDown={(event) => onResizeStart(event, "end")} />
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
            <button style={{ textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', color: 'var(--df-text)' }} onClick={() => { onProjectChange(""); setProjectOpen(false); }}># 未归属</button>
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
  return <div className={`df-drop-preview ${draggingBlock ? "moving-block" : ""} ${conflict ? "conflict" : ""}`} style={{ top, height, ...extraStyle }}><strong>{task.title}</strong>{!draggingBlock && <span>{conflict ? "冲突" : startTime} · {Math.round(duration)}min</span>}</div>;
}

function SuggestionBlock({ suggestion, task, conflict, onApply, onIgnore }: { suggestion: ScheduleSuggestion; task?: Task; conflict: boolean; onApply: () => void; onIgnore: () => void }) {
  if (!task) return null;
  const top = timeBlockTop(suggestion.startTime);
  const height = Math.max(timeBlockHeight(suggestion.startTime, suggestion.endTime), 48);
  return <div className={`df-suggestion ${conflict ? "conflict" : ""}`} style={{ top, height }}>
    <button className="df-suggestion-action apply" disabled={conflict} aria-label="应用建议" onClick={onApply}>▣</button>
    <button className="df-suggestion-action ignore" aria-label="不采用建议" onClick={onIgnore}>⊘</button>
    <span>AI 建议 {conflict && "· 冲突"}</span><strong>{task.title}</strong><small>{suggestion.reason}</small>{suggestion.nextAction && <em>下一步：{suggestion.nextAction}</em>}
  </div>;
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
}) {
  const selected = props.projects.find((project) => String(project.id) === String(props.value));
  const selectedColor = selected?.color || PROJECT_COLOR_PRESETS[0];
  const [newColorOpen, setNewColorOpen] = useState(false);
  return (
    <div className="df-quick-project-picker" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="df-quick-project-trigger" onClick={() => props.onOpenChange(!props.open)}>
        <span className="df-project-color-dot" style={{ "--project-color": selectedColor } as CSSProperties} />
        <span>{selected ? `# ${selected.title}` : "#"}</span>
      </button>
      {props.open && <div className="df-project-popover df-quick-project-popover up">
        <button type="button" onClick={() => { props.onChange(""); props.onOpenChange(false); }}># 未归属</button>
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

function AllDayBlock({ task, projectName, projects, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onDragEnd }: { task: Task; projectName: string; projects: Project[]; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.DragEvent) => void; onDragEnd: () => void }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isShortName = task.title.length <= 6;
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered]);
  return (
    <article className={`df-all-day-block ${task.completed ? "completed" : ""} ${projectOpen ? "project-open" : ""} ${isShortName ? "short-name" : ""}`} draggable style={{ "--cat": stripeColor, "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px" } as CSSProperties} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onEdit} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setProjectOpen(false); setHovered(false); }}>
      <div className="df-category-strip" />
      <button className={`df-block-check ${task.completed ? "completed" : ""}`} onClick={(event) => {
        event.stopPropagation();
        onToggleDone();
      }}>{task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}</button>
      <strong title={task.title}>{task.title}</strong>
      {hovered && <span className="df-block-project-wrap" onClick={(event) => event.stopPropagation()}>
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
              <button style={{ textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', color: 'var(--df-text)' }} onClick={() => { onProjectChange(""); setProjectOpen(false); }}># 未归属</button>
              {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
              <div className="df-project-create-line"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); } }} /><button onClick={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }}>✓</button></div>
            </div>
          </div>,
          document.querySelector('.df-app') || document.body
        )}
      </span>}
    </article>
  );
}

function NowLine({ extraStyle }: { extraStyle?: CSSProperties }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < TIMELINE_START * 60 || minutes > TIMELINE_END * 60) return null;
  const top = timeBlockTop(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  return <div className="df-now-line" style={{ top, ...extraStyle }}><span>现在</span></div>;
}

function EditDrawer(props: {
  type: AddType; setType: (type: AddType) => void; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; projects: Project[]; editing: boolean; task?: Task; today: string; advancedOpen: boolean; setAdvancedOpen: (open: boolean) => void; onClose: () => void; onSave: () => void; onDelete: () => void; onCopy: () => void; onTaskUpdate: (taskId: string, patch: Partial<Task>) => void; onProjectColorChange: (projectId: string, color: string) => void; onToggleDone: () => void; onNextAction: () => void; onCreateProject: (title: string) => string;
}) {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const f = props.form;
  const set = (key: keyof FormState, value: FormState[keyof FormState]) => props.setForm((current) => ({ ...current, [key]: value }));
  const selectedProjectTitle = props.projects.find((project) => String(project.id) === String(f.projectId))?.title || "未归属";
  const priorityText = f.priority === "high" ? "必须做" : f.priority === "low" ? "有空做" : "应该做";
  function createAndSelectProject() {
    const id = props.onCreateProject(newProjectTitle);
    if (!id) return;
    set("projectId", id);
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
    if (task.scheduledDate && task.scheduledStart && task.scheduledEnd) return `${task.scheduledDate} ${task.scheduledStart} - ${task.scheduledEnd} · ${formatDuration(taskDuration(task) / 60)}`;
    if (task.plannedForDate === props.today) return "今天 · 未安排具体时间";
    if (task.dueDate) return `${task.dueDate} · ${formatDuration(f.estimatedHours || 0.5)}`;
    return "未安排";
  }
  if (props.editing && props.type === "task" && props.task) {
    const isCandidate = props.task.plannedForDate === props.today && !props.task.scheduledDate;
    const isScheduled = props.task.scheduledDate === props.today || Boolean(props.task.scheduledDate && props.task.scheduledStart);
    return (
      <aside className="df-drawer df-task-detail">
        <div className="df-drawer-head"><h2>任务详情</h2><div className="df-detail-head-actions"><button className="df-icon-action i-more" data-tip="更多" aria-label="更多" onClick={() => setMoreOpen((open) => !open)} />{moreOpen && <div className="df-detail-more"><button onClick={() => { props.onCopy(); setMoreOpen(false); }}>复制任务</button><button onClick={() => setProjectPickerOpen(true)}>移动到项目</button><button className="danger" onClick={props.onDelete}>删除任务</button></div>}<button className="df-icon-action i-close" data-tip="关闭" aria-label="关闭" onClick={props.onClose} /></div></div>
        <section className="df-detail-title">
          <input type="checkbox" checked={props.task.completed} onChange={props.onToggleDone} />
          <div>
            <input value={f.title} onChange={(event) => set("title", event.target.value)} />
            <span>{props.task.completed ? "已完成" : "未完成"} · {isScheduled ? "今日执行" : isCandidate ? "今天" : "未安排"} · {priorityText}</span>
          </div>
        </section>
        <section className="df-detail-context">
          {!isCandidate && !isScheduled && <><span>这个任务还没有安排</span><button onClick={() => props.onTaskUpdate(props.task!.id, { plannedForDate: props.today, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined })}>加入候选</button></>}
          {isCandidate && <><span>已加入候选任务</span><select value={f.priority} onChange={(event) => { set("priority", event.target.value as Priority); props.onTaskUpdate(props.task!.id, { priority: event.target.value as Priority }); }}><option value="high">必须做</option><option value="medium">应该做</option><option value="low">有空做</option></select><button onClick={() => props.onTaskUpdate(props.task!.id, { plannedForDate: undefined })}>移出候选</button></>}
          {isScheduled && <span>已加入今日执行 · {scheduleText(props.task)}</span>}
        </section>
        <section className="df-detail-section">
          <h3>安排</h3>
          <div className="df-detail-grid"><label>日期<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>时间<input type="time" value={props.task.scheduledStart || ""} onChange={(event) => props.onTaskUpdate(props.task!.id, { scheduledDate: f.dueDate || props.today, scheduledStart: event.target.value, scheduledEnd: event.target.value ? addMinutes(event.target.value, Math.round(Math.max(f.estimatedHours || 0.25, 0.25) * 60)) : undefined })} /></label><label>时长<select value={Math.max(Math.round((f.estimatedHours || 0.25) * 60), SLOT_MINUTES)} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label><label>重复<select><option>不重复</option></select></label></div>
          <div className="df-detail-chips"><button onClick={() => set("dueDate", props.today)}>今天</button><button onClick={() => set("dueDate", addDays(props.today, 1))}>明天</button><button onClick={() => props.onTaskUpdate(props.task!.id, { plannedForDate: props.today, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined })}>本周</button><button onClick={() => props.onTaskUpdate(props.task!.id, { scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined })}>清除时间</button></div>
        </section>
        <section className="df-detail-section">
          <h3>归属</h3>
          <div className="df-detail-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}># {selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}># 未归属</button>{props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div>
          <div className="df-detail-meta"><span>来源：规划树 / {selectedProjectTitle}</span><label>优先级<select value={f.priority} onChange={(event) => set("priority", event.target.value as Priority)}><option value="high">必须做</option><option value="medium">应该做</option><option value="low">有空做</option></select></label><label>标签<input value={categories[f.category].label} readOnly /></label></div>
        </section>
        <section className="df-detail-section">
          <h3>子任务</h3>
          <div className="df-subtask-list">{(props.task.subtasks || []).map((subtask) => <div className="df-subtask-row" key={subtask.id}><input type="checkbox" checked={Boolean(subtask.completed || subtask.done)} onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })} /><input value={subtask.title} onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })} /></div>)}</div>
          <div className="df-detail-chips"><button onClick={addSubtask}>+ 添加子任务</button><button onClick={props.onNextAction}>AI 拆成小步骤</button></div>
        </section>
        <section className="df-detail-section">
          <h3>备注</h3>
          <textarea rows={6} value={f.details} placeholder="添加说明、链接或想法…" onChange={(event) => set("details", event.target.value)} />
        </section>
        <div className="df-drawer-actions quiet"><button onClick={props.onSave}>保存修改</button></div>
      </aside>
    );
  }
  return (
    <aside className="df-drawer">
      <div className="df-drawer-head"><h2>{props.editing ? "编辑" : "添加"}</h2><button className="df-icon-action i-close" data-tip="关闭" aria-label="关闭" onClick={props.onClose} /></div>
      <div className="df-segment">{(["task", "project", "event"] as AddType[]).map((type) => <button key={type} className={props.type === type ? "active" : ""} onClick={() => props.setType(type)}>{type === "task" ? "任务" : type === "project" ? "项目" : "事件"}</button>)}</div>
      {props.editing && props.type === "task" && <label className="df-check"><input type="checkbox" checked={Boolean(props.task?.completed)} onChange={props.onToggleDone} />已完成</label>}
      <label>名称<input value={f.title} onChange={(event) => set("title", event.target.value)} /></label>
      {props.type === "task" && <><label>项目<div className="df-drawer-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}># {selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}># 未归属</button>{props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div></label><label>日期<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></>}
      {props.type === "project" && <><label>项目说明<textarea rows={3} value={f.details} onChange={(event) => set("details", event.target.value)} /></label><label>颜色</label><ProjectColorPicker value={f.projectColor} onChange={(color) => set("projectColor", color)} presets={COMMON_COLOR_PRESETS} /></>}
      {props.type === "event" && <div className="df-grid2"><label>开始日期<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>开始时间<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label><label>结束日期<input type="date" value={f.endDate} onChange={(event) => set("endDate", event.target.value)} /></label><label>结束时间<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label></div>}
      <button className="df-link" onClick={() => props.setAdvancedOpen(!props.advancedOpen)}>{props.advancedOpen ? "收起高级" : "展开高级"}</button>
      {props.advancedOpen && <div className="df-advanced">{props.type === "task" && <label>预计用时<select value={Math.max(Math.round((f.estimatedHours || 0.25) * 60), SLOT_MINUTES)} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label>}<label>备注<textarea rows={6} value={f.details} onChange={(event) => set("details", event.target.value)} /></label></div>}
      <div className="df-drawer-actions">{props.editing && <button className="df-icon-action i-trash danger-lite" data-tip="删除" aria-label="删除" onClick={props.onDelete} />}{props.type === "task" && <button className="df-icon-action i-next" data-tip="明确下一步" aria-label="明确下一步" onClick={props.onNextAction} />}<button className="primary" onClick={props.onSave}>{props.editing ? "保存修改" : "添加"}</button></div>
    </aside>
  );
}

function AiPanel({ input, setInput, reply, busy, onSend, onClose }: { input: string; setInput: (v: string) => void; reply: string; busy: boolean; onSend: () => void; onClose: () => void }) {
  return <aside className="df-ai-panel"><div><strong>NavoPath AI</strong><button className="df-icon-action i-close" data-tip="关闭" aria-label="关闭" onClick={onClose} /></div><textarea value={input} onChange={(event) => setInput(event.target.value)} /><button className="df-icon-action i-send" data-tip={busy ? "思考中" : "发送"} aria-label={busy ? "思考中" : "发送"} onClick={onSend} disabled={busy || !input.trim()} />{reply && <pre>{reply}</pre>}</aside>;
}

function UtilityPanel({ kind, settings, authEmail, onClose, onSave, onShowAbout, onSignOut }: { kind: "settings" | "about"; settings: Settings; authEmail: string; onClose: () => void; onSave: (patch: Partial<Settings>) => void; onShowAbout: () => void; onSignOut?: () => void }) {
  const userName = settings.displayName?.trim() || authEmail || "NavoPath User";
  return (
    <>
      <div className="df-utility-backdrop" onMouseDown={onClose} />
      <aside className="df-utility-panel">
        <div className="df-utility-head">
          <h2>{kind === "settings" ? "设置" : "关于 NavoPath"}</h2>
          <button className="df-icon-action i-close" aria-label="关闭" onClick={onClose} />
        </div>
        {kind === "settings" ? (
          <div className="df-utility-body">
            <section className="df-settings-profile">
              <div className="df-settings-avatar">N</div>
              <div>
                <input
                  className="df-settings-name-input"
                  value={settings.displayName || ""}
                  placeholder="用户名"
                  onChange={(e) => onSave({ displayName: e.target.value })}
                />
                <small>免费版</small>
              </div>
            </section>
            <label className="df-utility-select">
              界面模式
              <select value={settings.theme} onChange={(event) => onSave({ theme: event.target.value as Settings["theme"] })}>
                <option value="dark">深色</option>
                <option value="light">浅色</option>
                <option value="calm">浅色·柔和</option>
                <option value="focus">浅色·专注</option>
              </select>
            </label>
            <ThemeColorSetting label="执行页主色" presets={EXECUTE_THEME_PRESETS} value={settings.executeAccentColor || "#C69CF9"} onChange={(color) => onSave({ executeAccentColor: color })} />
            <ThemeColorSetting label="规划页主色" presets={PLANNING_THEME_PRESETS} value={settings.planningAccentColor || "#CAFF72"} onChange={(color) => onSave({ planningAccentColor: color })} />
            <label className="df-utility-select">默认视图<select value={settings.defaultTimelineView || "daily"} onChange={(event) => onSave({ defaultTimelineView: event.target.value as Settings["defaultTimelineView"] })}><option value="daily">天</option><option value="3day">3天</option><option value="weekly">周</option><option value="month">月</option></select></label>
            <label className="df-utility-check"><input type="checkbox" checked={settings.themeGradientEnabled !== false} onChange={(event) => onSave({ themeGradientEnabled: event.target.checked })} />突出显示</label>
            <label className="df-utility-check"><input type="checkbox" checked={Boolean(settings.hideCompleted)} onChange={(event) => onSave({ hideCompleted: event.target.checked })} />隐藏已完成任务</label>
            <label className="df-utility-check"><input type="checkbox" checked={Boolean(settings.aiMemoryEnabled)} onChange={(event) => onSave({ aiMemoryEnabled: event.target.checked })} />允许 AI 使用任务上下文</label>
            <label className="df-utility-check"><input type="checkbox" checked={Boolean(settings.hideAi)} onChange={(event) => onSave({ hideAi: event.target.checked })} />隐藏所有 AI 功能</label>
            {authEmail && <p>当前账号：{authEmail}</p>}
            <div className="df-settings-footer">
              <button className="df-settings-about" onClick={onShowAbout}>
                <span className="df-settings-about-icon">i</span>
                <span>关于NavoPath</span>
              </button>
              {onSignOut && <button className="df-settings-logout" onClick={onSignOut}>退出登录</button>}
            </div>
          </div>
        ) : (
          <div className="df-utility-body">
            <strong>NavoPath v0.4.1</strong>
            <p>从长期项目里选出今天要推进的事，排进时间轴，并明确下一步怎么做。</p>
            <small>最新版本时间：2026-06-05</small>
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

function SourceModal({ tasks, projects, today, onClose, onJoin, defaultFilter, anchorRect }: { tasks: Task[]; projects: Project[]; today: string; onClose: () => void; onJoin: (taskIds: string[]) => void; defaultFilter?: string; anchorRect: DOMRect | null }) {
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
    if (!showAdded && task.plannedForDate === today) return false;
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
          <h2>选择今天要推进的任务</h2>
          <button className="df-icon-action i-close" data-tip="关闭" aria-label="关闭" onClick={onClose} />
        </div>
        <div className="task-list-popover-toolbar">
          <button className="light" onClick={() => setShowAdded((value) => !value)}>{showAdded ? "隐藏已添加" : "显示已添加"}</button>
          <button className="primary" disabled={selectedIds.length === 0} onClick={addSelected}>添加选中项 {selectedIds.length || ""}</button>
        </div>
        <div className="task-list-popover-filters">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部项目</button>
          <button className={filter === "unassigned" ? "active" : ""} onClick={() => setFilter("unassigned")}>未归属</button>
          {projects.map((project) => <button key={project.id} className={filter === project.id ? "active" : ""} onClick={() => setFilter(project.id)}>{project.title}</button>)}
        </div>
        <div className="task-list-popover-body">
          {openTasks.filter((task) => task.dueDate < today).length > 0 && <section className="df-source-section"><h3>逾期任务</h3>
            {openTasks.filter((task) => task.dueDate < today).slice(0, 8).map((task) => <SourceRow key={task.id} task={task} today={today} projectName={projects.find((project) => project.id === task.projectId)?.title || "未归属"} selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}
          </section>}
          {openTasks.filter((task) => task.dueDate >= today).length > 0 && <section className="df-source-section"><h3>本周任务</h3>
            {openTasks.filter((task) => task.dueDate >= today).slice(0, 8).map((task) => <SourceRow key={task.id} task={task} today={today} projectName={projects.find((project) => project.id === task.projectId)?.title || "未归属"} selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}
          </section>}
          {filteredProjects.some((project) => openTasks.some((task) => task.projectId === project.id)) && <section className="df-source-section"><h3>按项目浏览</h3>
        {filteredProjects.map((project) => {
          const projectTasks = openTasks.filter((task) => task.projectId === project.id).slice(0, 8);
          if (projectTasks.length === 0) return null;
          return <section key={project.id}><strong>{project.title}</strong>{projectTasks.map((task) => <SourceRow key={task.id} task={task} today={today} projectName={project.title} selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}</section>;
        })}
          </section>}
          {filter === "unassigned" && openTasks.length > 0 && <section><strong>未归属</strong>{openTasks.map((task) => <SourceRow key={task.id} task={task} today={today} projectName="未归属" selected={Boolean(selected[task.id])} expanded={expanded === task.id} onSelect={() => toggleSelected(task.id)} onExpand={() => setExpanded((id) => id === task.id ? "" : task.id)} />)}</section>}
          {openTasks.length === 0 && <div className="df-source-empty">这个项目下还没有未完成的任务</div>}
        </div>
      </div>
    </>,
    document.querySelector('.df-app') || document.body
  );
}

function SourceRow({ task, today, projectName, selected, expanded, onSelect, onExpand }: { task: Task; today: string; projectName: string; selected: boolean; expanded: boolean; onSelect: () => void; onExpand: () => void }) {
  const joined = task.plannedForDate === today;
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