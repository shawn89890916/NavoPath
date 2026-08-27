import React, { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import type { AgentAuditEntry, AgentRunState, AiConversation, AiMemory, CalendarEvent, CalendarFeedTokenMetadata, Category, DesktopExternalPlugin, DesktopUpdateState, ExecutionLane, ExternalCalendarOccurrence, ExternalCalendarSource, Habit, HabitDailyState, Language, McpTokenMetadata, NullablePriority, PlannerApi, PlannerData, Priority, Project, RecurrenceFrequency, ScheduleTemplate, Settings, Subtask, Task, TaskLevel, TaskRecurrence, TimelineRecord, WidgetAction, WidgetSnapshot, WidgetTimerMode, WidgetTimerRuntime } from "./types";
import { callAiAssistant, decideAgentRun, FALLBACK_AI_MODELS, listAgentAuditRuns, type AiAction, type AiStep } from "./aiAssistantApi";
import {
  buildAiContext,
  compactText,
  extractLocalMemories,
  mergeAiMemories,
  pickMemoriesForContext,
  toAiHistory,
} from "./aiContext";
import { exportDataAsJson, exportTasksAsCsv, isImportFileSizeAllowed, parsePlannerBackupJson, parseTasksCsv } from "./dataExport";
import type { ParsedAttachment } from "./fileParser";
import { reasoningModesForModel } from "./utils/aiModels";
import { autoScheduleTasks, type UnscheduledTask } from "./autoSchedule";
import { AI_INFERENCE_MODEL_VERSION, buildAiProfile, learnedTaskDurationMinutes, predictTaskIntelligence } from "./aiPersonalization";
import { TaskDragLayer, UnifiedDragOverlay, type UnifiedDragSnapshot } from "./unifiedDrag";
import { installBrowserFallback, forceLocalPreviewMode } from "./browserFallback";
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
  resizedBlockTop,
  type TimelineViewMode,
} from "./timelineGeometry";
import { t, detectSystemLanguage, catLabels, priLabels, viewLabel, monthTitle, weekdayName } from "./i18n";
import { migrateLegacyHabitTracker, scheduleHabitRecord, toggleHabitCompletion, unscheduleHabitRecord, updateHabit, archiveHabit, buildHabitMetrics, isHabitDueOnDate, weekdayLabels, type HabitMetrics } from "./utils/habits";
import { shouldShowHabitCandidates } from "./utils/habitCandidateVisibility";
import { localIsoDate } from "./utils/localDate";
import { buildWeekWindow } from "./utils/monthWindow";
import { buildCommandSearchIndex, searchCommands, type CommandSearchResult } from "./utils/commandSearch";
import {
  buildDailyContinuousDates,
  dailyContinuousBlockTop,
  dailyContinuousCanvasHeight,
  dailyContinuousSlotCount,
  dailyContinuousSlotLabel,
  dailyContinuousTargetFromContentY,
  getContinuousTimelineDateForOffset,
} from "./utils/continuousTimeline";
import { normalizeTaskCheckTone, normalizeTaskState, taskMetaPatch, validateProjectCompletion, workflowStatusForPatch } from "./utils/productivityModel";
import { SHORTCUTS, groupShortcutsByScope, matchShortcut, type ShortcutScope } from "./utils/shortcuts";
import { buildTaskMetaBadges } from "./utils/taskMetaBadges";
import { computeConflictLayout, computeConflictStyle, scheduledDateTimesOverlap, scheduledTaskIntervalsOnDate } from "./utils/conflictLayout";
import { expandTaskAllDayRecords, expandTaskTimelineSlices } from "./utils/taskTimelineSlices";
import {
  addDays,
  addMonths,
  buildRecurrenceOccurrenceId,
  enumerateRecurrenceDates,
  hasRecurrenceOccurrenceOnDate,
  hasRecurringRule,
  isRecurringScheduledTask,
  matchesOccurrence,
  parseRecurrenceOccurrenceId,
  startOfWeekIso,
} from "./utils/recurrence";
import { appendAiSubtasks } from "./utils/aiSubtasks";
import { countSubtasks, countDoneSubtasks, addSubtaskToTree, findSubtaskInTree, removeSubtaskFromTree, toggleSubtaskInTree } from "./utils/treeOrder";
import { promoteSubtaskToToday, returnScheduledTaskToToday, toggleTodayCandidate } from "./utils/todayCandidates";
import { useInAppDialog } from "./InAppDialog";
import { TaskActions, TaskBlock, TaskBlockAccent, TaskBlockContent, TaskBlockDuration, TaskBlockPriority, TaskBlockRow, TaskCheckbox, TaskGroup, type TaskBlockDragState } from "./components/TaskBlock";
import { ExecutionSplitLayout, CandidatePanelShell, CandidatePanelHeader, CandidateBlock, TimelineCanvas, TimelineEventBlock } from "./components/ExecutionSharedLayout";
import { SettingSection, SettingRow, SettingToggle, SettingSelect, SettingNumberInput, SettingTextInput, SettingColorInput, SettingActionButton, SettingDivider, SettingDescription } from "./components/SettingsControls";
import { SETTINGS_CATEGORIES, normalizeSettingsTarget, searchSettings, settingsDetailLabel, settingsSearchPath, settingsTargetForSearchId, type SettingsCategory, type SettingsTarget, type SettingsTargetInput } from "./settingsNavigation";
import { getDefaultSettings } from "./defaultSettings";
import { nextDueAiBrief } from "./aiBriefs";
import { usePointerReorder } from "./usePointerReorder";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_RELEASES_URL } from "./downloads";
import { readAutoLaunchState, toggleAutoLaunchState } from "./desktopAutoLaunch";
import { canAcknowledgeBootstrapSave, parseBootstrapCache, recoverAccountSettings, resolveBootstrap, type BootstrapCache } from "./syncBootstrap";
import { preparePlannerDataRestore, withDeletionTombstones } from "./syncMerge";
import { SyncScheduler, formatLastSyncedAt, isCurrentWorkspaceLoad, presetForMinutes, readSyncInterval, shouldApplyWorkspaceRevision, shouldReconcileRemoteRevision, shouldRequeueFailedSave, SYNC_INTERVAL_PRESETS } from "./sync";
import { MAX_PLUGIN_CONFIG_STRING_LENGTH, listPlugins as listRegisteredPlugins, activate as activatePlugin, deactivate as deactivatePlugin, isActive as isPluginActive, register as registerPlugin, resolveConfig as resolvePluginConfig, pluginText, type NavoPlugin, type PluginHost } from "./plugins/registry";
import { registerBuiltinPlugins } from "./plugins/builtin";
import { DEFAULT_WIDGET_APPEARANCE, normalizeWidgetAppearance } from "./widget/widgetPreferences";
import {
  DEFAULT_WIDGET_RUNTIME,
  DEFAULT_WIDGET_TIMER_PREFERENCES,
  accumulateWidgetWorkTime,
  advanceTaskElapsedSeconds,
  advanceWidgetTimer,
  countsWidgetTimerPhaseAsWork,
  createWidgetTimerModeTransition,
  createDeadlineAlignedPomodoroRuntime,
  createWidgetTimerRuntime,
  getWidgetTimerNotificationDescriptor,
  getStopwatchTaskTimerAction,
  getWidgetTimerModeChangeTaskAction,
  getWidgetTimerSnapshotDisplaySeconds,
  normalizeStoredTaskTimer,
  normalizeWidgetTimerPreferences,
  normalizeWidgetTimerRuntime,
  resolveWidgetCountdownTarget,
  scheduleWidgetCountdown,
} from "./widget/widgetTimer";
import { extendActiveTimelineRecord, nextOverrunExtensionEnd, resolveWidgetTimelineSelection, timelineRecordBounds } from "./widget/widgetSchedule";
import { calculateTimelineRecordEnd, calendarDateTimeSpanMinutes, clockTimeSpanMinutes, rescheduleTimelineRecord, timelineRecordDurationMinutes } from "./utils/timelineRecords";
import { anchoredTimelineScrollTop, timelineZoomFromPinch } from "./utils/timelineZoom";
import { calendarEventDurationMinutes, expandTimedCalendarEvent } from "./utils/calendarEventSlices";
import { MOTION, runMotionTransition, scheduleMotionCommit } from "./motion";
import "./styles.css";
import "./app-redesign.css";
import "./navopath-buttons.css";
import "./mobile.css";
import "./task-block.css";
import type { MobileShortSheetKind } from "./MobileTaskSummary";

installBrowserFallback();

const ChangelogPage = lazy(() => import("./ChangelogPage"));
const MobileTaskSummary = lazy(() => import("./MobileTaskSummary"));
const MobileQuickAddSheet = lazy(() => import("./MobileTaskSummary").then((module) => ({ default: module.MobileQuickAddSheet })));
const MobileTimelineDraftSheet = lazy(() => import("./MobileTaskSummary").then((module) => ({ default: module.MobileTimelineDraftSheet })));
const WidgetAppLazy = lazy(() => import("./widget/WidgetApp").then((module) => ({ default: module.WidgetApp })));
const WidgetPopoverAppLazy = lazy(() => import("./widget/WidgetApp").then((module) => ({ default: module.WidgetPopoverApp })));

const todayIso = () => localIsoDate();
const TIMELINE_START = 0;
const TIMELINE_END = 24;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 20;
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);
const ATTACHMENT_ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";
const DEFAULT_PROJECT_COLOR = "#584D3D";
const PROJECT_COLOR_PRESETS = [DEFAULT_PROJECT_COLOR, "#7EA172", "#D7816A", "#0F0326", "#584D3D", "#8B5CF6", "#38BDF8", "#F59E0B", "#EF4444"];
const COMMON_COLOR_PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#1F2937", "#F9FAFB", "#6B7280"];
const EXECUTE_THEME_PRESETS_LIGHT = ["#D7816A", "#584D3D", "#7EA172", "#0F0326", "#BE185D", "#D97706", "#2563EB"];
const EXECUTE_THEME_PRESETS_DARK  = ["#D7816A", "#FBF9FF", "#7EA172", "#584D3D", "#EC4899", "#F59E0B", "#3B82F6"];
const PLANNING_THEME_PRESETS_LIGHT = ["#7EA172", "#584D3D", "#D7816A", "#0F0326", "#BE185D", "#D97706", "#2563EB"];
const PLANNING_THEME_PRESETS_DARK  = ["#7EA172", "#FBF9FF", "#D7816A", "#584D3D", "#EC4899", "#F59E0B", "#3B82F6"];
const SAVE_DEBOUNCE_MS = 250;
const REMOTE_REVISION_POLL_MS = 5_000;
const SYNC_RETRY_DELAYS = [1000, 3000, 8000, 20000, 30000];
const SYNC_FAILURE_NOTICE_AFTER = 3;

/** Map a task's importance/urgency to the shared TaskBlock priority vocabulary. */
function taskBlockPriorityFor(importance: NullablePriority | undefined, urgency: NullablePriority | undefined): TaskBlockPriority {
  if (urgency === "high") return "urgent";
  if (importance === "high") return "high";
  if (importance === "low" && (urgency === "low" || urgency == null)) return "low";
  return "normal";
}

function externalManifestToPlugin(plugin: DesktopExternalPlugin): NavoPlugin {
  return {
    id: plugin.id,
    source: "external",
    name: plugin.name,
    nameI18n: plugin.nameI18n,
    description: plugin.description,
    descriptionI18n: plugin.descriptionI18n,
    enabledSummaryI18n: plugin.enabledSummaryI18n,
    version: plugin.version,
    author: plugin.author,
    icon: plugin.icon,
    permissions: plugin.permissions,
    configFields: plugin.configFields,
  };
}
const MCP_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath-mcp.shawn89890916.workers.dev/mcp";
function calendarFeedUrl(token: string) {
  const endpoint = new URL(MCP_ENDPOINT);
  endpoint.pathname = `${endpoint.pathname.replace(/\/mcp\/?$/, "").replace(/\/$/, "")}/calendar/${token}.ics`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}
const DONATION_URL = "https://afdian.com/a/233cxy/plan";
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
const WIDGET_TIMER_RUNTIME_KEY = "navopath-widget-timer-runtime";
const WIDGET_TIMER_ADVANCED_AT_KEY = "navopath-widget-timer-advanced-at";
const WIDGET_TIMER_REMAINDER_KEY = "navopath-widget-timer-remainder-ms";

function loadWidgetTimerRuntime(): WidgetTimerRuntime {
  try {
    const parsed = JSON.parse(localStorage.getItem(WIDGET_TIMER_RUNTIME_KEY) || "null") as Partial<WidgetTimerRuntime> | null;
    return normalizeWidgetTimerRuntime(parsed, { ...DEFAULT_WIDGET_TIMER_PREFERENCES, mode: parsed?.mode }, Date.now());
  } catch { /* Ignore malformed or unavailable local storage. */ }
  const now = Date.now();
  return { ...DEFAULT_WIDGET_RUNTIME, phaseStartedAt: now, pausedAt: now };
}
type AddType = "task" | "project" | "event";
type CompactExecuteView = "tasks" | "schedule";
type TimelineView = "daily" | "3day" | "weekly" | "month";
type AiPlanPrefs = { source: "today" | "all"; scope: "day" | "3day" | "week"; strategy: "random" | "byProject" | "alternativeProject" | "longShort" };
type SettingsPatch = Partial<Settings>;
type QueuedDataSave = { payload: PlannerData; version: number; pendingSavedAt: string };
type QueuedSettingsSave = { payload: SettingsPatch; version: number; pendingSavedAt: string };

/**
 * SchedulePreview — single source of truth for a preview block.
 * One preview = one real task block. Split suggestions share a source task and
 * expose segment metadata so the user can review each part before accepting.
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
  segmentIndex?: number;
  segmentCount?: number;
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
  source?: "candidate" | "allDay" | "timeline";
  duration: number;
  offsetMinutes?: number;
  pointer?: { x: number; y: number };
  sourceRect?: { width: number; height: number };
  offset?: { x: number; y: number };
  outsideTimeline?: boolean;
} | null;

type DragSource = "candidate" | "tree" | "kanban" | "matrix" | "list" | "timeline";
type DropIntent =
  | "reorder-before"
  | "reorder-after"
  | "drop-into-container"
  | "schedule-at-time"
  | "invalid";
type ActiveDragItem = {
  dragId: string;
  taskId: string;
  source: DragSource;
  sourceContainerId: string;
  sourceIndex: number;
  sourceVariant: "candidate" | "allDay" | "scheduled";
  taskSnapshot: Task;
};
type CandidateDropTarget = {
  taskId: string;
  position: "before" | "after";
  intent: Extract<DropIntent, "reorder-before" | "reorder-after">;
} | null;
type CandidateDragOptions = {
  allowCandidateReorder?: boolean;
  onSchedule?: (date: string, startTime: string) => void;
};

const DRAG_START_THRESHOLD_PX = 5;
const CANDIDATE_TOUCH_HOLD_MS = 360;
const TOUCH_SCROLL_CANCEL_DISTANCE_PX = 8;
const SUPPRESS_CLICK_AFTER_DRAG_MS = 220;

function isEventDisplayTask(taskOrId: Task | string) {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  return id.startsWith("event_occ_");
}

function isExternalCalendarDisplayTask(taskOrId: Task | string) {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  return id.startsWith("event_occ_external_");
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
  const executeDefault = "#584D3D";
  const planningDefault = "#584D3D";
  const execute = normalizeHexColor(settings.executeAccentColor || executeDefault, executeDefault);
  const planning = normalizeHexColor(settings.planningAccentColor || planningDefault, planningDefault);
  const executeLight = isLightColor(execute);
  const planningLight = isLightColor(planning);
  const activeAccent = mode === "execute" ? execute : planning;
  const activeLight = mode === "execute" ? executeLight : planningLight;
  const { r, g, b } = hexToRgb(activeAccent);
  const isDark = settings.theme === "dark";
  // Timeline font scale: clamp to safe range, default 1
  const fontScale = Math.max(0.85, Math.min(1.3, settings.timelineFontScale ?? 1));
  if (isDark) {
    const darkAccent = settings.executeAccentColor || settings.planningAccentColor ? activeAccent : "#EEE9DF";
    const darkAccentRgb = hexToRgb(darkAccent);
    return {
      "--execute-primary": execute,
      "--execute-on-primary": executeLight ? "#111827" : "#FFFFFF",
      "--planning-primary": planning,
      "--planning-on-primary": planningLight ? "#111827" : "#FFFFFF",
      "--accent-active": darkAccent,
      "--accent-rgb": `${darkAccentRgb.r}, ${darkAccentRgb.g}, ${darkAccentRgb.b}`,
      "--accent-on": isLightColor(darkAccent) ? "#27231E" : "#EEE9DF",
      "--bg-app": "#1A1A1A",
      "--bg-app-soft": "#1E1E1E",
      "--surface-main": "#252525",
      "--surface-raised": "#2A2A2A",
      "--surface-card": "#222222",
      "--text-main": "#E8E8E8",
      "--text-muted": "#999999",
      "--text-faint": "#666666",
      "--border-soft": "rgba(255,255,255,0.08)",
      "--border-subtle": "rgba(255,255,255,0.04)",
      "--shadow-soft": "0 12px 28px rgba(0,0,0,0.28)",
      "--shadow-hl": "none",
      "--header-bg": "rgba(26,26,26,0.94)",
      "--header-border": "rgba(255,255,255,0.06)",
      "--header-fg": "#F0F0F0",
      "--header-fg-muted": "#999999",
      "--input-bg": "#252525",
      "--input-border": "rgba(255,255,255,0.10)",
      "--timeline-font-scale": String(fontScale),
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
    "--bg-app": "#FBF9FF",
    "--bg-app-soft": "#F5F1EA",
    "--surface-main": "#FBF9FF",
    "--surface-raised": "#FFFFFF",
    "--surface-card": "#FFFFFF",
    "--text-main": "#27231E",
    "--text-muted": "#7B7062",
    "--text-faint": "#A69D92",
    "--border-soft": "#DED8D8",
    "--border-subtle": "#EBE6E8",
    "--shadow-soft": "0 12px 28px rgba(88,77,61,0.10)",
    "--shadow-hl": "none",
    "--header-bg": "rgba(251,249,255,0.90)",
    "--header-border": "rgba(88,77,61,0.14)",
    "--header-fg": "#584D3D",
    "--header-fg-muted": "#7B7062",
    "--input-bg": "#FFFFFF",
    "--input-border": "#DED8D8",
    "--timeline-font-scale": String(fontScale),
  } as CSSProperties;
}
type ResizePreview = { taskId: string; start: string; end: string; startDate: string } | null;
type ScheduleSuggestion = SchedulePreview; // legacy alias kept for compatibility; replaced by SchedulePreview
type QuickSchedule = { startTime: string; title: string; projectId: string; isAllDay?: boolean } | null;
type BuiltInScheduleTemplateId = "school" | "study";
type BuiltInScheduleTemplateSlot = {
  id: string;
  labelZh: string;
  labelEn: string;
  start: string;
  end: string;
  titleZh: string;
  titleEn: string;
};
type ScheduleTemplateApplySlot = {
  title: string;
  start: string;
  end: string;
};
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

const SCHEDULE_TEMPLATES: Record<BuiltInScheduleTemplateId, {
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  slots: BuiltInScheduleTemplateSlot[];
}> = {
  school: {
    labelZh: "\u9ed8\u8ba4 1",
    labelEn: "Default 1",
    descriptionZh: "按上课节奏预留固定时间段，当天再填写每节要推进的目标。",
    descriptionEn: "Reserve fixed class-style blocks, then fill in the goal for each block.",
    slots: [
      { id: "morning-1", labelZh: "第一节", labelEn: "Period 1", start: "08:00", end: "08:45", titleZh: "第一节目标", titleEn: "Period 1 goal" },
      { id: "morning-2", labelZh: "第二节", labelEn: "Period 2", start: "08:55", end: "09:40", titleZh: "第二节目标", titleEn: "Period 2 goal" },
      { id: "morning-3", labelZh: "第三节", labelEn: "Period 3", start: "10:00", end: "10:45", titleZh: "第三节目标", titleEn: "Period 3 goal" },
      { id: "morning-4", labelZh: "第四节", labelEn: "Period 4", start: "10:55", end: "11:40", titleZh: "第四节目标", titleEn: "Period 4 goal" },
      { id: "afternoon-1", labelZh: "下午一", labelEn: "Afternoon 1", start: "13:30", end: "14:15", titleZh: "下午第一段目标", titleEn: "First afternoon goal" },
      { id: "afternoon-2", labelZh: "下午二", labelEn: "Afternoon 2", start: "14:25", end: "15:10", titleZh: "下午第二段目标", titleEn: "Second afternoon goal" },
      { id: "afternoon-3", labelZh: "下午三", labelEn: "Afternoon 3", start: "15:30", end: "16:15", titleZh: "下午第三段目标", titleEn: "Third afternoon goal" },
      { id: "evening-review", labelZh: "晚间整理", labelEn: "Evening review", start: "19:30", end: "20:15", titleZh: "复盘与整理", titleEn: "Review and organize" },
    ],
  },
  study: {
    labelZh: "\u9ed8\u8ba4 2",
    labelEn: "Default 2",
    descriptionZh: "用较长专注块划分一天，适合假期、周末或备考日。",
    descriptionEn: "Use longer focus blocks for weekends, holidays, or exam-prep days.",
    slots: [
      { id: "deep-1", labelZh: "上午深度", labelEn: "Morning focus", start: "09:00", end: "10:30", titleZh: "上午重点任务", titleEn: "Morning priority" },
      { id: "deep-2", labelZh: "上午巩固", labelEn: "Morning review", start: "10:45", end: "12:00", titleZh: "巩固练习", titleEn: "Practice and review" },
      { id: "deep-3", labelZh: "下午推进", labelEn: "Afternoon progress", start: "14:00", end: "15:30", titleZh: "下午重点任务", titleEn: "Afternoon priority" },
      { id: "deep-4", labelZh: "输出整理", labelEn: "Output block", start: "15:45", end: "17:00", titleZh: "整理输出", titleEn: "Organize output" },
      { id: "deep-5", labelZh: "晚间收束", labelEn: "Evening close", start: "19:30", end: "20:30", titleZh: "收尾与复盘", titleEn: "Wrap-up and review" },
    ],
  },
};
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
  saved?: boolean;
  status?: "thinking" | "done" | "error";
  attachment?: AiAttachmentSnapshot;
  steps?: AiStep[];
  actions?: AiAction[];
  selectedActions?: Record<number, boolean>;
  actionState?: "pending" | "adopted" | "rejected" | "undone";
  intent?: string;
  plan?: Array<{ taskId?: string; title: string; start: string; end: string; durationMinutes?: number; reason?: string }>;
  format?: "text" | "markdown";
  agent?: AgentRunState;
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
  importance: NullablePriority;
  urgency: NullablePriority;
  estimatedHours: number;
  details: string;
  recurrence?: TaskRecurrence;
};

const PlanningViewLazy = lazy(() => import("./PlanningView"));
const LandingPageLazy = lazy(() => import("./LandingPage"));
const LOCAL_BOOTSTRAP_PREFIX = "navopath-bootstrap";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function getExecutionLane(task: Task): ExecutionLane | undefined {
  if (task.executionLane) return task.executionLane;
  const hasScheduledRecord = (task.timelineRecords || []).some((record) => record.executionStatus === "scheduled");
  if (!task.plannedForDate || hasScheduledRecord || Boolean(task.scheduledDate) || Boolean(task.scheduledStart) || isRecurringScheduledTask(task)) return undefined;
  return "candidate";
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
  return raw.kind === "task" &&
    typeof raw.title === "string" && raw.title.trim().length > 0 &&
    validIsoDate(raw.date) &&
    (!raw.startTime || validTime(raw.startTime)) &&
    (!raw.endTime || validTime(raw.endTime));
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

function continuousTimelineDayCount(columnCount: number) {
  return columnCount === 1 ? 7 : columnCount * 6;
}

function dateDiff(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
}

/** Returns the stored or estimated duration for a task. */
function taskDuration(task: Task) {
  if (task.scheduledStart && task.scheduledEnd) {
    return Math.max(clockTimeSpanMinutes(task.scheduledStart, task.scheduledEnd), SLOT_MINUTES);
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
  return new Promise<PlannerApi>((resolve, reject) => {
    if (window.plannerApi) {
      resolve(window.plannerApi);
      return;
    }
    const startTime = Date.now();
    const timeoutMs = 10000; // 10 second timeout
    const timer = window.setInterval(() => {
      if (window.plannerApi) {
        window.clearInterval(timer);
        resolve(window.plannerApi);
      } else if (Date.now() - startTime > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("Timed out waiting for planner API. Please refresh the page."));
      }
    }, 20);
  });
}

function bootstrapCacheKey(userId?: string) {
  return `${LOCAL_BOOTSTRAP_PREFIX}:${userId || "local"}`;
}

function readBootstrapCache(userId?: string) {
  try {
    return parseBootstrapCache(localStorage.getItem(bootstrapCacheKey(userId)));
  } catch {
    return null;
  }
}

function writeBootstrapCache(
  data: PlannerData,
  settings: Settings,
  userId?: string,
  sync: Partial<Pick<BootstrapCache, "dataDirty" | "settingsDirty" | "remoteRevision">> & {
    dataPendingSavedAt?: string | null;
    settingsPendingSavedAt?: string | null;
  } = {},
) {
  try {
    const current = readBootstrapCache(userId);
    localStorage.setItem(bootstrapCacheKey(userId), JSON.stringify({
      data,
      settings,
      savedAt: new Date().toISOString(),
      dataDirty: sync.dataDirty ?? current?.dataDirty ?? false,
      settingsDirty: sync.settingsDirty ?? current?.settingsDirty ?? false,
      dataPendingSavedAt: sync.dataPendingSavedAt === null
        ? undefined
        : sync.dataPendingSavedAt ?? current?.dataPendingSavedAt,
      settingsPendingSavedAt: sync.settingsPendingSavedAt === null
        ? undefined
        : sync.settingsPendingSavedAt ?? current?.settingsPendingSavedAt,
      remoteRevision: sync.remoteRevision ?? current?.remoteRevision,
    } satisfies BootstrapCache));
  } catch {
    // Ignore cache write failures in private mode or quota pressure.
  }
}

function defaultForm(type: AddType = "task"): FormState {
  const today = todayIso();
  return {
    title: "",
    projectId: "",
    projectColor: DEFAULT_PROJECT_COLOR,
    dueDate: today,
    dueTime: "",
    endDate: today,
    endTime: "",
    category: type === "project" ? "project" : "personal",
    priority: "medium",
    importance: null,
    urgency: null,
    estimatedHours: 0.5,
    details: "",
    recurrence: undefined,
  };
}

function makeTask(form: FormState, intelligence?: { data: PlannerData; projects: Project[]; settings: Settings }): Task {
  const now = new Date().toISOString();
  const prediction = intelligence
    ? predictTaskIntelligence({ title: form.title, projectId: form.projectId || undefined, data: intelligence.data, projects: intelligence.projects })
    : undefined;
  const inferDuration = Boolean(
    prediction && intelligence?.settings.autoEstimateTaskDuration !== false && Math.abs((form.estimatedHours || 0.5) - 0.5) < 0.001,
  );
  const inferredProject = !form.projectId && intelligence?.settings.autoAssignTaskProject !== false ? prediction?.project : undefined;
  const autoProjectId = inferredProject && inferredProject.confidence >= 0.78 ? inferredProject.projectId : undefined;
  const estimatedMinutes = inferDuration ? prediction!.duration.minutes : Math.round(Math.max(form.estimatedHours || 0.25, 0.25) * 60);
  return {
    id: uid("task"),
    title: form.title.trim(),
    dueDate: form.dueDate || todayIso(),
    category: form.category,
    priority: form.priority,
    notes: form.details,
    goalId: "goal_admission",
    completed: false,
    projectId: form.projectId || autoProjectId,
    importance: form.importance,
    urgency: form.urgency,
    estimatedHours: Math.max(estimatedMinutes / 60, 0.25),
    aiInference: prediction ? {
      ...(inferDuration ? { duration: { minutes: prediction.duration.minutes, confidence: prediction.duration.confidence, source: prediction.duration.source, inferredAt: now, modelVersion: AI_INFERENCE_MODEL_VERSION } } : {}),
      ...(inferredProject ? { project: { projectId: inferredProject.projectId, confidence: inferredProject.confidence, source: inferredProject.source, inferredAt: now, modelVersion: AI_INFERENCE_MODEL_VERSION } } : {}),
    } : undefined,
    plannedForDate: form.dueDate === todayIso() ? todayIso() : undefined,
    executionLane: form.dueDate === todayIso() ? "candidate" : undefined,
    order: Date.now(),
    subtasks: [],
    createdAt: now,
    updatedAt: now
  };
}

function profileWithFeedback(data: PlannerData, key: keyof NonNullable<PlannerData["aiProfile"]>["feedback"], amount = 1) {
  const profile = data.aiProfile || buildAiProfile(data);
  return { ...profile, feedback: { ...profile.feedback, [key]: profile.feedback[key] + amount } };
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

function chatToSessionMessages(chat: PlannerData["chat"] = []): AiSessionMessage[] {
  return chat.map((message) => ({
    id: message.id || uid(`ai_${message.role}`),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    saved: Boolean(message.saved),
    status: message.status || "done",
    steps: message.steps,
    actions: (message.actions || []).map((action) => (action as AiAction).type === "import_schedule_item" ? { ...(action as AiAction), kind: "task" as const } : action) as AiAction[],
    selectedActions: message.selectedActions,
    actionState: message.actionState,
    agent: message.agent,
    intent: message.intent,
    plan: message.plan,
    format: message.format,
  }));
}

function aiConversationTitle(message: string) {
  const text = compactText(message, 18);
  return text || "新对话";
}

function makeAiConversation(title = "新对话"): AiConversation {
  const now = new Date().toISOString();
  return { id: uid("conversation"), title, messages: [], createdAt: now, updatedAt: now };
}

function buildEventFromTask(task: Task, activeRecord?: TimelineRecord): CalendarEvent {
  const scheduledDate = activeRecord?.scheduledDate || task.scheduledDate || task.plannedForDate || task.dueDate || todayIso();
  const scheduledStart = activeRecord?.scheduledStart || task.scheduledStart || task.recurrence?.startTime || "";
  const activeSchedule = activeRecord
    ? rescheduleTimelineRecord(activeRecord, activeRecord.scheduledDate, activeRecord.scheduledStart)
    : undefined;
  const fallbackEnd = scheduledStart
    ? calculateTimelineRecordEnd(scheduledDate, scheduledStart, taskDuration(task))
    : undefined;
  const scheduledEnd = activeSchedule?.scheduledEnd || task.scheduledEnd || fallbackEnd?.scheduledEnd || "";
  const scheduledEndDate = activeSchedule?.scheduledEndDate || fallbackEnd?.scheduledEndDate || scheduledDate;
  return {
    id: uid("event"),
    title: task.title,
    date: scheduledDate,
    startDate: scheduledDate,
    endDate: scheduledEndDate,
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
  const id = uid("task");
  const date = event.startDate || event.date || todayIso();
  const start = event.startTime || undefined;
  let end = start ? event.endTime : undefined;
  let endDate = event.endDate || date;
  if (start && !end) {
    const calculated = calculateTimelineRecordEnd(date, start, event.recurrence?.durationMinutes || 60);
    end = calculated.scheduledEnd;
    endDate = calculated.scheduledEndDate || date;
  } else if (start && end && endDate === date && timeToMinutes(end) <= timeToMinutes(start)) {
    endDate = calculateTimelineRecordEnd(date, start, clockTimeSpanMinutes(start, end)).scheduledEndDate || date;
  }
  const durationMinutes = start && end
    ? Math.max(calendarDateTimeSpanMinutes(date, start, endDate, end), SLOT_MINUTES)
    : 30;
  const timelineRecords: TimelineRecord[] = start && end ? [{
    id: `${id}_rec_0`,
    taskId: id,
    scheduledDate: date,
    scheduledStart: start,
    scheduledEndDate: endDate,
    scheduledEnd: end,
    executionStatus: "scheduled",
    createdAt: now,
  }] : [];
  return {
    id,
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
    timelineRecords,
    recurrence: event.recurrence,
    order: Date.now(),
    subtasks: [],
    createdAt: now,
    updatedAt: now
  };
}

const PRODUCT_ICON_SRC = `${import.meta.env.BASE_URL}navopath-icon.png`;

export function ProductIcon({ compact = false }: { compact?: boolean }) {
  const size = compact ? 32 : 36;
  return (
    <div className={`dayflow-icon ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src={PRODUCT_ICON_SRC} alt="" width={size} height={size} />
    </div>
  );
}

function ExecuteSkeleton() {
  return <div className="df-app df-execute-skeleton" aria-label="正在加载工作区" aria-busy="true">
    <header className="df-skeleton-header">
      <ProductIcon compact />
      <span className="df-skeleton-brand" />
      <span className="df-skeleton-tab" />
      <span className="df-skeleton-avatar" />
    </header>
    <main className="df-skeleton-workbench">
      <section className="df-skeleton-candidates">
        <span className="df-skeleton-title" />
        {Array.from({ length: 7 }, (_, index) => <div className="df-skeleton-task" key={index}><i /><span /><small /></div>)}
        <div className="df-skeleton-add" />
      </section>
      <section className="df-skeleton-timeline">
        <div className="df-skeleton-timeline-head"><span /><span /><span /></div>
        <div className="df-skeleton-grid">
          {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          <b className="block-one" /><b className="block-two" /><b className="block-three" />
        </div>
      </section>
    </main>
  </div>;
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

function CloudWorkspaceError(props: {
  lang: Language;
  message: string;
  busy: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const zh = props.lang === "zh";
  return (
    <main className="df-auth-shell">
      <section className="df-auth-card df-cloud-error-card" role="alert">
        <div className="df-auth-brand"><ProductIcon compact /><div><strong>NavoPath</strong><span>{zh ? "账户数据仍安全保存在云端" : "Your account data is still safe in the cloud"}</span></div></div>
        <h1>{zh ? "暂时无法载入工作区" : "Workspace temporarily unavailable"}</h1>
        <p>{zh ? "网络连接中断时，NavoPath 不会再打开空白账户或启动新手教程，也不会用空数据覆盖原有内容。请恢复网络后重试。" : "When the connection drops, NavoPath will no longer open a blank account or start onboarding, and it will never replace existing content with empty data. Reconnect and try again."}</p>
        {props.message && <p className="df-auth-error">{props.message}</p>}
        <div className="df-cloud-error-actions">
          <button type="button" disabled={props.busy} onClick={props.onRetry}>{props.busy ? (zh ? "正在重试…" : "Retrying…") : (zh ? "重新载入" : "Reload workspace")}</button>
          <button type="button" className="quiet" disabled={props.busy} onClick={props.onSignOut}>{zh ? "退出登录" : "Sign out"}</button>
        </div>
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
  onOpenAi: () => void;
  onChange: (step: OnboardingStep) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const zh = props.lang === "zh";
  const normalizedStep = props.step === "drag" ? "schedule" : props.step;
  const steps: Array<Exclude<OnboardingStep, "drag" | "done">> = ["add", "candidates", "schedule", "calendar", "planning", "ai"];
  const copy = {
    add: [zh ? "添加第一个任务" : "Add your first task", zh ? "直接在工作区键入，或使用候选区下方的快速添加栏。" : "Type anywhere in the workspace, or use the quick-add field below Candidates."],
    candidates: [zh ? "管理今日候选" : "Manage Today's Candidates", zh ? "在这里完成、恢复、调整时长，或把任务移回 Planning。" : "Complete, restore, resize, or move tasks back to Planning here."],
    schedule: [zh ? "拖到时间轴排程" : "Schedule on the timeline", zh ? "把候选任务拖到时间轴，选择开始时间；任务块可继续拖动和调整。" : "Drag a candidate to a start time, then move or resize its timeline block."],
    calendar: [zh ? "切换日历视图" : "Switch calendar views", zh ? "使用日、三日、周和连续月视图，并可随时回到今天。" : "Use Day, 3-Day, Week, and continuous Month views, then jump back to today."],
    planning: [zh ? "拆解长期目标" : "Break down long-term work", zh ? "整块拖动项目、任务与子任务；预览会显示即将放置的位置和层级。" : "Drag whole projects, tasks, and subtasks; the preview shows the resulting position and level."],
    ai: [zh ? "使用 AI 助手" : "Use the AI assistant", zh ? "AI 以你的本地日期和时区理解今天、明天等相对日期。" : "AI uses your local date and timezone for today, tomorrow, and other relative dates."],
  } as const;
  const index = Math.max(0, steps.indexOf(normalizedStep as typeof steps[number]));
  const content = copy[steps[index]];

  return (
    <aside className={`df-onboarding-guide step-${props.step}`} aria-live="polite">
      <span className="df-onboarding-index">{String(index + 1).padStart(2, "0")} / 06</span>
      <strong>{content[0]}</strong>
      <p>{content[1]}</p>
      <div>
        {index > 0 && <button type="button" className="quiet" onClick={() => props.onChange(steps[index - 1])}>{zh ? "上一步" : "Back"}</button>}
        {steps[index] === "planning" && props.mode !== "planning" && (
          <button type="button" onClick={props.onOpenPlanning}>{zh ? "打开 Planning" : "Open Planning"}</button>
        )}
        {steps[index] === "ai" && <button type="button" onClick={props.onOpenAi}>{zh ? "打开 AI" : "Open AI"}</button>}
        {index < steps.length - 1
          ? <button type="button" onClick={() => props.onChange(steps[index + 1])}>{zh ? "下一步" : "Next"}</button>
          : <button type="button" onClick={props.onFinish}>{zh ? "完成引导" : "Finish guide"}</button>}
        <button type="button" className="quiet" onClick={props.onSkip}>{zh ? "跳过" : "Skip"}</button>
      </div>
    </aside>
  );
}

function YearCalendarOverview({
  year,
  selectedDate,
  today,
  lang,
  tasks,
  events,
  onYearChange,
  onSelectDate,
  onToday,
}: {
  year: number;
  selectedDate: string;
  today: string;
  lang: Language;
  tasks: Task[];
  events: CalendarEvent[];
  onYearChange: (year: number) => void;
  onSelectDate: (date: string) => void;
  onToday: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const initialMonth = new Date(`${selectedDate}T00:00:00`).getMonth();
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { month: "long" }).format(new Date(year, month, 1))),
    [lang, year],
  );
  const weekdays = lang === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const occupiedDates = useMemo(() => {
    const dates = new Set<string>();
    tasks.forEach((task) => {
      const date = task.scheduledDate || task.plannedForDate || task.dueDate;
      if (date) dates.add(date);
    });
    events.forEach((event) => dates.add(event.startDate || event.date));
    return dates;
  }, [events, tasks]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const month = scroller?.querySelector<HTMLElement>(`[data-overview-month="${initialMonth}"]`);
    if (scroller && month) scroller.scrollTop = Math.max(0, month.offsetTop - 12);
  }, [initialMonth, year]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    let previousWidth = scroller.clientWidth;
    const observer = new ResizeObserver(() => {
      if (scroller.clientWidth === previousWidth) return;
      previousWidth = scroller.clientWidth;
      const month = scroller.querySelector<HTMLElement>(`[data-overview-month="${initialMonth}"]`);
      if (month) window.requestAnimationFrame(() => { scroller.scrollTop = Math.max(0, month.offsetTop - 12); });
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [initialMonth, year]);

  return (
    <section className="df-year-overview" aria-label={lang === "zh" ? `${year} 年日历` : `${year} calendar`}>
      <div className="df-year-overview-toolbar">
        <button type="button" onClick={() => onYearChange(year - 1)}>{lang === "zh" ? "上一年" : "Previous year"}</button>
        <button className="df-year-overview-today" type="button" onClick={onToday}>{lang === "zh" ? "回到今天" : "Go to today"}</button>
      </div>
      <div className="df-year-months" ref={scrollerRef}>
        {monthNames.map((monthName, month) => {
          const firstWeekday = new Date(year, month, 1).getDay();
          const dayCount = new Date(year, month + 1, 0).getDate();
          return (
            <article className="df-year-month" data-overview-month={month} key={`${year}-${month}`}>
              <button className="df-year-month-title" type="button" onClick={() => onSelectDate(`${year}-${String(month + 1).padStart(2, "0")}-01`)}>
                {monthName}
              </button>
              <div className="df-year-weekdays" aria-hidden="true">
                {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="df-year-days">
                {Array.from({ length: firstWeekday }, (_, index) => <span className="df-year-day-empty" key={`empty-${index}`} />)}
                {Array.from({ length: dayCount }, (_, index) => {
                  const day = index + 1;
                  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  return (
                    <button
                      type="button"
                      key={iso}
                      className={`df-year-day${iso === today ? " today" : ""}${iso === selectedDate ? " selected" : ""}${occupiedDates.has(iso) ? " occupied" : ""}`}
                      aria-label={new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "full" }).format(new Date(`${iso}T00:00:00`))}
                      aria-current={iso === today ? "date" : undefined}
                      onClick={() => onSelectDate(iso)}
                    >
                      <span>{day}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      <div className="df-year-overview-toolbar df-year-overview-toolbar-bottom">
        <button type="button" onClick={() => onYearChange(year + 1)}>{lang === "zh" ? "下一年" : "Next year"}</button>
      </div>
    </section>
  );
}
function App() {
  const isWorkspaceRoute = window.location.pathname === "/app" || window.location.pathname.startsWith("/app/") || Boolean(window.desktopApi);
  const [data, setData] = useState<PlannerData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lang, setLang] = useState<Language>(detectSystemLanguage());
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState<AuthNotice>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [mode, setModeState] = useState<Mode>("execute");
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia("(max-width: 899.98px) and (orientation: portrait)").matches);
  const [compactExecuteView, setCompactExecuteView] = useState<CompactExecuteView>("schedule");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDetailOpen, setQuickAddDetailOpen] = useState(false);
  const [mobileQuickAddKind, setMobileQuickAddKind] = useState<MobileShortSheetKind>("task");
  const [mobileQuickHabitMinutes, setMobileQuickHabitMinutes] = useState(20);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [visibleTimelineDate, setVisibleTimelineDate] = useState(todayIso());
  const [mobileDatePickerOpen, setMobileDatePickerOpen] = useState(false);
  const [mobileDatePickerMonth, setMobileDatePickerMonth] = useState(() => todayIso().slice(0, 7));
  const [timelineZoom, setTimelineZoom] = useState(1);
  const timelineSlotHeight = SLOT_HEIGHT * timelineZoom;
  const timelineHourHeight = timelineSlotHeight * (60 / SLOT_MINUTES);
  const [drag, setDrag] = useState<DragState>(null);
  const [dragOverlay, setDragOverlay] = useState<UnifiedDragSnapshot | null>(null);
  const [dragOverlayTask, setDragOverlayTask] = useState<{ task: Task; variant: "candidate" | "allDay" | "scheduled" } | null>(null);
  const [dragOverlayPointer, setDragOverlayPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview>(null);
  const [hoverSlot, setHoverSlot] = useState<string>("");
  const [hoveredBlock, setHoveredBlock] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTaskSummary, setMobileTaskSummary] = useState(false);
  const [addType, setAddType] = useState<AddType>("task");
  const [editingId, setEditingId] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [referencedTaskId, setReferencedTaskId] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [aiMessages, setAiMessages] = useState<AiSessionMessage[]>([]);
  const [activeAiConversationId, setActiveAiConversationId] = useState("");
  const [aiConversationListOpen, setAiConversationListOpen] = useState(false);
  const [aiAuditOpen, setAiAuditOpen] = useState(false);
  const [aiAuditRuns, setAiAuditRuns] = useState<AgentAuditEntry[]>([]);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiAuditError, setAiAuditError] = useState("");
  const [aiMemoryNotice, setAiMemoryNotice] = useState("");
  const [aiActionPatches, setAiActionPatches] = useState<Record<string, Record<number, Record<string, unknown>>>>({});
  const [aiAttachment, setAiAttachment] = useState<ParsedAttachment | null>(null);
  const [aiAttachmentStatus, setAiAttachmentStatus] = useState("");
  const briefAutomationBusyRef = useRef(false);
  const briefAttemptedRef = useRef(new Set<string>());
  const [externalCalendarSources, setExternalCalendarSources] = useState<ExternalCalendarSource[]>([]);
  const [externalCalendarOccurrences, setExternalCalendarOccurrences] = useState<ExternalCalendarOccurrence[]>([]);
  const externalCalendarSyncRef = useRef<Promise<void> | null>(null);
  // ── Auto-schedule: single source of truth ──
  const [schedulePreviews, setSchedulePreviews] = useState<SchedulePreview[]>([]);
  const [scheduleUnscheduled, setScheduleUnscheduled] = useState<UnscheduledTask[]>([]);
  const [autoScheduleState, setAutoScheduleState] = useState<AutoScheduleState>("idle");
  const [aiPlanMenuOpen, setAiPlanMenuOpen] = useState(false);
  const [aiPlanPrefs, setAiPlanPrefs] = useState<AiPlanPrefs>({ source: "today", scope: "day", strategy: "longShort" });
  const [timelineView, setTimelineView] = useState<TimelineView>("daily");
  const monthScrollRef = useRef<HTMLDivElement>(null);
  const monthAnchorOffsetRef = useRef<number | null>(null);
  const [monthFocus, setMonthFocus] = useState("");
  // Continuous-timeline infinite scroll: records the pre-shift scrollTop and the
  // number of bands shifted so a useLayoutEffect can restore the viewport after
  // the centered date window recomputes. `continuousPrependLockRef` prevents the
  // scroll listener from re-triggering a shift while one is already in flight.
  const continuousScrollRestoreRef = useRef<{ oldScrollTop: number; shiftBands: number } | null>(null);
  const continuousPrependLockRef = useRef(false);

  useLayoutEffect(() => {
    const container = monthScrollRef.current;
    const previousOffset = monthAnchorOffsetRef.current;
    if (!container || timelineView !== "month") return;
    if (previousOffset !== null) {
      monthAnchorOffsetRef.current = null;
      const anchor = container.querySelector<HTMLElement>("[data-week-anchor]");
      if (anchor) container.scrollTop += anchor.offsetTop - previousOffset;
      return;
    }
    const selectedCell = container.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`);
    const selectedWeek = selectedCell?.closest<HTMLElement>("[data-week-anchor]");
    if (selectedWeek) container.scrollTop = Math.max(0, selectedWeek.offsetTop - container.clientHeight * 0.32);
    setMonthFocus(selectedDate.slice(0, 7));
  }, [selectedDate, timelineView]);

  // Continuous-timeline infinite scroll: after the centered date window shifts
  // (prepend/append), restore the viewport so the user does not perceive a jump.
  // The centered window keeps a constant band count, so scrollHeight is unchanged;
  // we only translate scrollTop by the shifted band count × day height.
  useLayoutEffect(() => {
    const restore = continuousScrollRestoreRef.current;
    if (!restore) return;
    const container = timelineRef.current;
    if (!container) return;
    continuousScrollRestoreRef.current = null;
    const dayHeight = (24 * 60 / SLOT_MINUTES) * timelineSlotHeight;
    const next = restore.oldScrollTop + restore.shiftBands * dayHeight;
    container.scrollTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, next));
    // Release the lock on the next frame so the scroll event triggered by this
    // scrollTop assignment does not re-enter the prepend/append branch.
    const frame = window.requestAnimationFrame(() => { continuousPrependLockRef.current = false; });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDate, timelineView, timelineSlotHeight]);
  const [pendingTimelineFocus, setPendingTimelineFocus] = useState<TimelineFocusTarget | null>(null);
  const [placementPreview, setPlacementPreview] = useState<PlacementPreview>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<EditingOccurrence>(null);
  const [quickSchedule, setQuickSchedule] = useState<QuickSchedule>(null);
  const [scheduleTemplateOpen, setScheduleTemplateOpen] = useState(false);
  const [allDayQuickAdd, setAllDayQuickAdd] = useState<AllDayQuickAdd>(null);
  const [monthQuickAdd, setMonthQuickAdd] = useState<AllDayQuickAdd>(null);
  const [allDayDragOver, setAllDayDragOver] = useState(false);
  const [allDayDragDate, setAllDayDragDate] = useState("");
  const [candidateDropActive, setCandidateDropActive] = useState(false);
  const [candidatePlanningReturnActive, setCandidatePlanningReturnActive] = useState(false);
  const [candidateDropTarget, setCandidateDropTarget] = useState<CandidateDropTarget>(null);
  const [dragCreate, setDragCreate] = useState<DragCreateState>(null);
  const dragCreateSuppressClickRef = useRef(false);
  const timelineZoomRef = useRef(1);
  const timelinePinchActiveRef = useRef(false);
  const timelinePinchRef = useRef<{ distance: number; startZoom: number; anchorBaseY: number; anchorViewportY: number } | null>(null);
  const timelinePinchFrameRef = useRef<number | null>(null);
  const timelinePinchPendingZoomRef = useRef<number | null>(null);
  const [resizeHintTaskId, setResizeHintTaskId] = useState("");
  const [utilityPanel, setUtilityPanel] = useState<"settings" | "about" | null>(null);
  const layerExitHandlesRef = useRef(new Map<string, ReturnType<typeof scheduleMotionCommit> | null>());
  const layerTriggerRef = useRef(new Map<string, HTMLElement>());
  const [habitPanel, setHabitPanel] = useState<"overview" | "detail" | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [settingsSectionTarget, setSettingsSectionTarget] = useState<SettingsTarget>({ category: "general" });
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [toast, setToast] = useState("");
  // Enhanced toast with optional undo action (5-second window)
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const undoSnapshotRef = useRef<{ committedTaskIds: string[]; clearedSourceTaskIds: string[]; removedFromCandidate: Set<string> } | null>(null);
  const [showCompletedCandidates, setShowCompletedCandidates] = useState(false);
  const [candidateProjectFilters, setCandidateProjectFilters] = useState<string[]>([]);
  const [candidateFilterOpen, setCandidateFilterOpen] = useState(false);
  const [candidateFilterCategory, setCandidateFilterCategory] = useState<"project" | "completed">("project");
  const [scheduleGuideOpen, setScheduleGuideOpen] = useState(true);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(() => new Set());
  const completionHandlesRef = useRef(new Map<string, ReturnType<typeof scheduleMotionCommit> | null>());
  const [groupByProject, setGroupByProject] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectTitle, setQuickProjectTitle] = useState("");
  const [quickProjectColor, setQuickProjectColor] = useState(PROJECT_COLOR_PRESETS[0]);
  const compactQuickInputRef = useRef<HTMLInputElement>(null);
  const [candidatePanelCollapsed, setCandidatePanelCollapsed] = useState(false);
  const [simpleView, setSimpleView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [subtaskAiBusyId, setSubtaskAiBusyId] = useState("");
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [yearOverviewOpen, setYearOverviewOpen] = useState(false);
  const [overviewYear, setOverviewYear] = useState(() => new Date(`${todayIso()}T00:00:00`).getFullYear());

  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [focusOverlayMode, setFocusOverlayMode] = useState<null | "stopwatch" | "pomodoro" | "flowtime">(null);
  const timerIntervalRef = useRef<number | null>(null);
  const timerTaskRef = useRef<string | null>(null);
  const timerElapsedRef = useRef(0);
  const timerElapsedBaseRef = useRef(0);
  const timerStartedAtRef = useRef<number | null>(null);
  const widgetManagesTaskTimerRef = useRef(false);
  timerElapsedRef.current = timerElapsed;

  useEffect(() => () => {
    layerExitHandlesRef.current.forEach((handle) => handle?.cancel());
    completionHandlesRef.current.forEach((handle) => handle?.cancel());
    layerExitHandlesRef.current.clear();
    completionHandlesRef.current.clear();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("navopath-active-timer");
      if (saved) {
        const restored = normalizeStoredTaskTimer(JSON.parse(saved) as unknown);
        if (restored) {
          setTimerTaskId(restored.taskId);
          setTimerElapsed(restored.elapsedSeconds);
          timerElapsedBaseRef.current = restored.elapsedSeconds;
          setTimerRunning(false);
          timerTaskRef.current = restored.taskId;
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!timerRunning || timerStartedAt === null) {
      if (timerIntervalRef.current) { window.clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      return;
    }
    timerIntervalRef.current = window.setInterval(() => {
      if (widgetManagesTaskTimerRef.current) return;
      setTimerElapsed(advanceTaskElapsedSeconds(timerElapsedBaseRef.current, timerStartedAt, Date.now()));
    }, 1000);
    return () => { if (timerIntervalRef.current) { window.clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
  }, [timerRunning, timerStartedAt]);

  useEffect(() => {
    if (timerTaskId) {
      timerTaskRef.current = timerTaskId;
      try { localStorage.setItem("navopath-active-timer", JSON.stringify({ taskId: timerTaskId, elapsed: timerElapsed, running: timerRunning })); } catch { /* ignore */ }
    } else {
      timerTaskRef.current = null;
      try { localStorage.removeItem("navopath-active-timer"); } catch { /* ignore */ }
    }
  }, [timerTaskId, timerElapsed, timerRunning]);

  const startTimer = useCallback((taskId: string) => {
    const baseElapsed = timerTaskRef.current === taskId ? timerElapsedRef.current : 0;
    const now = Date.now();
    timerElapsedBaseRef.current = baseElapsed;
    timerStartedAtRef.current = now;
    timerTaskRef.current = taskId;
    setTimerElapsed(baseElapsed);
    setTimerTaskId(taskId);
    setTimerRunning(true);
    setTimerStartedAt(now);
  }, []);

  const pauseTimerAt = useCallback((now: number) => {
    if (timerStartedAtRef.current !== null) {
      const elapsed = advanceTaskElapsedSeconds(timerElapsedBaseRef.current, timerStartedAtRef.current, now);
      timerElapsedRef.current = elapsed;
      timerElapsedBaseRef.current = elapsed;
      setTimerElapsed(elapsed);
    }
    timerStartedAtRef.current = null;
    setTimerRunning(false);
    setTimerStartedAt(null);
  }, []);

  const pauseTimer = useCallback(() => pauseTimerAt(Date.now()), [pauseTimerAt]);

  const resumeTimer = useCallback(() => {
    const now = Date.now();
    timerElapsedBaseRef.current = timerElapsedRef.current;
    timerStartedAtRef.current = now;
    setTimerRunning(true);
    setTimerStartedAt(now);
  }, []);

  const discardTimer = useCallback(() => {
    timerElapsedRef.current = 0; timerElapsedBaseRef.current = 0; timerStartedAtRef.current = null;
    setTimerTaskId(null); setTimerRunning(false); setTimerElapsed(0); setTimerStartedAt(null);
  }, []);

  const formatTimerDisplay = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }, []);

  const widgetTimerPreferences = useMemo(
    () => normalizeWidgetTimerPreferences(settings?.widgetTimerPreferences),
    [settings?.widgetTimerPreferences],
  );
  const [widgetTimerRuntime, setWidgetTimerRuntime] = useState<WidgetTimerRuntime>(loadWidgetTimerRuntime);
  const widgetTimerRuntimeRef = useRef(widgetTimerRuntime);
  widgetTimerRuntimeRef.current = widgetTimerRuntime;
  const widgetTimerAdvancedAtRef = useRef<number>((() => {
    try {
      const stored = Number(localStorage.getItem(WIDGET_TIMER_ADVANCED_AT_KEY));
      return Number.isFinite(stored) && stored >= 0 ? stored : Date.now();
    } catch { return Date.now(); }
  })());
  const widgetTimerRemainderMsRef = useRef<number>((() => {
    try {
      const stored = Number(localStorage.getItem(WIDGET_TIMER_REMAINDER_KEY));
      return Number.isFinite(stored) && stored >= 0 && stored < 1_000 ? stored : 0;
    } catch { return 0; }
  })());
  const [widgetPopoverOpen] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const now = Date.now();
    const normalized = normalizeWidgetTimerRuntime(widgetTimerRuntime, widgetTimerPreferences, now);
    if (JSON.stringify(normalized) !== JSON.stringify(widgetTimerRuntime)) {
      widgetTimerRuntimeRef.current = normalized;
      setWidgetTimerRuntime(normalized);
    }
  }, [settings, widgetTimerPreferences, widgetTimerRuntime]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_TIMER_RUNTIME_KEY, JSON.stringify(widgetTimerRuntime));
      localStorage.setItem(WIDGET_TIMER_ADVANCED_AT_KEY, String(widgetTimerAdvancedAtRef.current));
      localStorage.setItem(WIDGET_TIMER_REMAINDER_KEY, String(widgetTimerRemainderMsRef.current));
    } catch { /* Ignore unavailable storage. */ }
  }, [widgetTimerRuntime]);

  const advanceWidgetTimerNow = useCallback(() => {
    const now = Date.now();
    const current = widgetTimerRuntimeRef.current;
    const from = Math.min(now, Math.max(current.phaseStartedAt, widgetTimerAdvancedAtRef.current));
    const work = accumulateWidgetWorkTime(
      current,
      widgetTimerPreferences,
      from,
      now,
      widgetTimerRemainderMsRef.current,
    );
    widgetTimerRemainderMsRef.current = work.remainderMs;
    const tick = advanceWidgetTimer(current, widgetTimerPreferences, now);
    widgetTimerAdvancedAtRef.current = now;
    widgetTimerRuntimeRef.current = tick.runtime;
    setWidgetTimerRuntime(tick.runtime);
    if (current.mode !== "stopwatch" && timerTaskRef.current) {
      if (work.wholeSeconds > 0) {
        const elapsed = timerElapsedRef.current + work.wholeSeconds;
        timerElapsedRef.current = elapsed;
        timerElapsedBaseRef.current = elapsed;
        setTimerElapsed(elapsed);
      }
      widgetManagesTaskTimerRef.current = true;
      timerStartedAtRef.current = tick.countsAsWork ? now : null;
      setTimerStartedAt(tick.countsAsWork ? now : null);
      setTimerRunning(tick.countsAsWork);
    }
    for (const transition of tick.transitions) {
      const descriptor = getWidgetTimerNotificationDescriptor(transition, lang);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(descriptor.title, { body: descriptor.body }); } catch { /* Ignore unsupported notification shells. */ }
      }
    }
  }, [lang, widgetTimerPreferences]);

  useEffect(() => {
    if (!widgetTimerRuntime.running) return;
    advanceWidgetTimerNow();
    const interval = window.setInterval(advanceWidgetTimerNow, 1_000);
    return () => window.clearInterval(interval);
  }, [advanceWidgetTimerNow, widgetTimerRuntime.running]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899.98px) and (orientation: portrait)");
    const sync = () => setCompactLayout(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (quickAddOpen && !compactLayout) compactQuickInputRef.current?.focus();
  }, [quickAddOpen]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const closeCompactLayer = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setQuickAddOpen(false);
    };
    document.addEventListener("keydown", closeCompactLayer);
    return () => document.removeEventListener("keydown", closeCompactLayer);
  }, [quickAddOpen]);

  useEffect(() => {
    if (settings?.featureHabitsEnabled === false && habitPanel) {
      setHabitPanel(null);
      setEditingHabitId(null);
    }
  }, [settings?.featureHabitsEnabled]);

  const dialog = useInAppDialog(lang);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const [nowInTimelineViewport, setNowInTimelineViewport] = useState(true);
  const suppressBlockClickRef = useRef(false);
  const suppressBlockClickTimerRef = useRef<number | null>(null);
  const suppressClickAfterDrag = useCallback(() => {
    suppressBlockClickRef.current = true;
    if (suppressBlockClickTimerRef.current !== null) {
      window.clearTimeout(suppressBlockClickTimerRef.current);
    }
    suppressBlockClickTimerRef.current = window.setTimeout(() => {
      suppressBlockClickRef.current = false;
      suppressBlockClickTimerRef.current = null;
    }, SUPPRESS_CLICK_AFTER_DRAG_MS);
  }, []);
  useEffect(() => {
    const scrollElement = timelineRef.current;
    if (!allDayDragDate || !scrollElement) return;
    const lockedScrollTop = scrollElement.scrollTop;
    const keepTimelineStill = () => {
      if (scrollElement.scrollTop !== lockedScrollTop) scrollElement.scrollTop = lockedScrollTop;
    };
    scrollElement.addEventListener("scroll", keepTimelineStill, { passive: true });
    return () => scrollElement.removeEventListener("scroll", keepTimelineStill);
  }, [allDayDragDate, timelineView]);
  const dragTargetDateRef = useRef<string>("");
  const lastTimelineAutoScrollKeyRef = useRef("");
  const dataRef = useRef<PlannerData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const authStateRef = useRef<AuthState | null>(authState);
  authStateRef.current = authState;
  const loadedWorkspaceKeyRef = useRef("");
  const workspaceLoadVersionRef = useRef(0);
  const localFallbackAppliedRef = useRef(false);
  const pendingDataSaveRef = useRef<QueuedDataSave | null>(null);
  const dataSaveTimerRef = useRef<number | null>(null);
  const dataSaveRetryTimerRef = useRef<number | null>(null);
  const dataSaveInFlightRef = useRef(false);
  const dataSaveWaitersRef = useRef<Array<() => void>>([]);
  const dataSaveVersionRef = useRef(0);
  const dataSaveRetryCountRef = useRef(0);
  const dataSaveNoticeShownRef = useRef(false);
  const pendingSettingsSaveRef = useRef<QueuedSettingsSave | null>(null);
  const settingsSaveTimerRef = useRef<number | null>(null);
  const settingsSaveRetryTimerRef = useRef<number | null>(null);
  const settingsSaveInFlightRef = useRef(false);
  const settingsSaveWaitersRef = useRef<Array<() => void>>([]);
  const settingsSaveVersionRef = useRef(0);
  const settingsSaveRetryCountRef = useRef(0);
  const settingsSaveNoticeShownRef = useRef(false);
  const queuedRemoteRefreshRef = useRef(false);
  const remoteRevisionRef = useRef(0);
  const remoteRevisionPollInFlightRef = useRef(false);
  const syncSchedulerRef = useRef<SyncScheduler | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const pluginHostRef = useRef<PluginHost | null>(null);
  const externalPluginsLoadedRef = useRef(false);
  const [externalPluginsRevision, setExternalPluginsRevision] = useState(0);
  const colsContainerRef = useRef<HTMLDivElement | null>(null);
  const timeGridRef = useRef<HTMLDivElement | null>(null);
  const [multiColWidth, setMultiColWidth] = useState(0);
  const [dailyCanvasWidth, setDailyCanvasWidth] = useState(0);
  timelineZoomRef.current = timelineZoom;

  const refreshExternalCalendarLayer = useCallback(async (refreshMode: "none" | "due" | "force" = "none") => {
    const api = window.plannerApi;
    const listExternalCalendars = api.listExternalCalendars;
    if (!authStateRef.current?.user || !listExternalCalendars) {
      if (!authStateRef.current?.user) {
        setExternalCalendarSources([]);
        setExternalCalendarOccurrences([]);
      }
      return;
    }
    if (externalCalendarSyncRef.current) {
      await externalCalendarSyncRef.current;
      if (refreshMode !== "force") return;
    }
    const sync = (async () => {
    try {
      let layer = await listExternalCalendars({ from: addDays(todayIso(), -30), to: addDays(todayIso(), 365) });
      if (refreshMode !== "none" && api.refreshExternalCalendar) {
        const now = Date.now();
        const due = layer.sources.filter((source) => source.enabled && (refreshMode === "force" || !source.nextSyncAt || Date.parse(source.nextSyncAt) <= now));
        if (due.length) {
          await Promise.allSettled(due.map((source) => api.refreshExternalCalendar!(source.id, refreshMode === "force")));
          layer = await listExternalCalendars({ from: addDays(todayIso(), -30), to: addDays(todayIso(), 365) });
        }
      }
      setExternalCalendarSources(layer.sources);
      setExternalCalendarOccurrences(layer.occurrences);
    } catch (error) {
      console.warn("External calendar refresh failed", error);
    }
    })();
    externalCalendarSyncRef.current = sync;
    try { await sync; }
    finally { if (externalCalendarSyncRef.current === sync) externalCalendarSyncRef.current = null; }
  }, []);

  useEffect(() => {
    if (!authState?.user) {
      setExternalCalendarSources([]);
      setExternalCalendarOccurrences([]);
      return;
    }
    void refreshExternalCalendarLayer("force");
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshExternalCalendarLayer("due");
    }, 15 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshExternalCalendarLayer("due");
    };
    const onCalendarChanged = () => void refreshExternalCalendarLayer("none");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("navopath:external-calendar-changed", onCalendarChanged);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("navopath:external-calendar-changed", onCalendarChanged);
    };
  }, [authState?.user?.id, refreshExternalCalendarLayer]);

  useLayoutEffect(() => {
    const pinch = timelinePinchRef.current;
    const scrollElement = timelineRef.current;
    if (!pinch || !scrollElement || !timelinePinchActiveRef.current) return;
    scrollElement.scrollTop = anchoredTimelineScrollTop(pinch.anchorBaseY, timelineZoom, pinch.anchorViewportY);
  }, [timelineZoom]);

  useEffect(() => {
    const scrollElement = timelineRef.current;
    if (!scrollElement || !compactLayout || mode !== "execute" || timelineView === "month") return;

    const verticalDistance = (touches: TouchList) => Math.abs(touches[0].clientY - touches[1].clientY);
    const verticalCentre = (touches: TouchList) => (touches[0].clientY + touches[1].clientY) / 2;
    const beginPinch = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const rect = scrollElement.getBoundingClientRect();
      const anchorViewportY = verticalCentre(event.touches) - rect.top;
      const startZoom = timelineZoomRef.current;
      timelinePinchActiveRef.current = true;
      scrollElement.classList.add("is-pinching");
      dragCreateSuppressClickRef.current = true;
      setDragCreate(null);
      timelinePinchRef.current = {
        distance: Math.max(1, verticalDistance(event.touches)),
        startZoom,
        anchorBaseY: (scrollElement.scrollTop + anchorViewportY) / startZoom,
        anchorViewportY,
      };
      event.preventDefault();
    };
    const movePinch = (event: TouchEvent) => {
      const pinch = timelinePinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      const nextZoom = timelineZoomFromPinch(pinch.startZoom, pinch.distance, verticalDistance(event.touches));
      timelinePinchPendingZoomRef.current = nextZoom;
      if (timelinePinchFrameRef.current === null) {
        timelinePinchFrameRef.current = window.requestAnimationFrame(() => {
          timelinePinchFrameRef.current = null;
          const pendingZoom = timelinePinchPendingZoomRef.current;
          if (pendingZoom === null) return;
          timelinePinchPendingZoomRef.current = null;
          if (Math.abs(pendingZoom - timelineZoomRef.current) < 0.002) return;
          timelineZoomRef.current = pendingZoom;
          setTimelineZoom(pendingZoom);
        });
      }
      event.preventDefault();
    };
    const endPinch = (event: TouchEvent) => {
      if (!timelinePinchRef.current || event.touches.length >= 2) return;
      const pendingZoom = timelinePinchPendingZoomRef.current;
      if (timelinePinchFrameRef.current !== null) {
        window.cancelAnimationFrame(timelinePinchFrameRef.current);
        timelinePinchFrameRef.current = null;
      }
      timelinePinchPendingZoomRef.current = null;
      if (pendingZoom !== null && Math.abs(pendingZoom - timelineZoomRef.current) >= 0.002) {
        timelineZoomRef.current = pendingZoom;
        setTimelineZoom(pendingZoom);
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        timelinePinchRef.current = null;
        timelinePinchActiveRef.current = false;
        scrollElement.classList.remove("is-pinching");
        window.setTimeout(() => { dragCreateSuppressClickRef.current = false; }, 80);
      }));
    };

    scrollElement.addEventListener("touchstart", beginPinch, { passive: false });
    scrollElement.addEventListener("touchmove", movePinch, { passive: false });
    scrollElement.addEventListener("touchend", endPinch, { passive: true });
    scrollElement.addEventListener("touchcancel", endPinch, { passive: true });
    return () => {
      if (timelinePinchFrameRef.current !== null) window.cancelAnimationFrame(timelinePinchFrameRef.current);
      timelinePinchFrameRef.current = null;
      timelinePinchPendingZoomRef.current = null;
      timelinePinchRef.current = null;
      timelinePinchActiveRef.current = false;
      scrollElement.classList.remove("is-pinching");
      scrollElement.removeEventListener("touchstart", beginPinch);
      scrollElement.removeEventListener("touchmove", movePinch);
      scrollElement.removeEventListener("touchend", endPinch);
      scrollElement.removeEventListener("touchcancel", endPinch);
    };
  }, [compactLayout, mode, timelineView, data]);

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

  useEffect(() => {
    if (!authState?.user || !window.plannerApi.subscribeToRemoteChanges) return;
    const userId = authState.user.id;
    const workspaceKey = `cloud:${userId}`;
    return window.plannerApi.subscribeToRemoteChanges((remote) => {
      const incomingRevision = Number(remote.revision || 0);
      const cached = readBootstrapCache(userId);
      const hasDirtyLocal = Boolean(cached?.dataDirty || cached?.settingsDirty);
      if (workspaceKey !== loadedWorkspaceKeyRef.current) return;
      if (!hasDirtyLocal && !shouldApplyWorkspaceRevision(workspaceKey, loadedWorkspaceKeyRef.current, remoteRevisionRef.current, incomingRevision)) return;
      if (pendingDataSaveRef.current || pendingSettingsSaveRef.current || dataSaveInFlightRef.current || settingsSaveInFlightRef.current) {
        queuedRemoteRefreshRef.current = true;
        return;
      }
      const resolved = resolveBootstrap(cached, remote.data, remote.settings);
      if (!resolved.data || !resolved.settings) return;
      const migratedData = migrateLegacyHabitTracker(resolved.data, resolved.settings.pluginConfigs);
      remoteRevisionRef.current = Math.max(remoteRevisionRef.current, incomingRevision);
      dataRef.current = migratedData;
      settingsRef.current = resolved.settings;
      setData(migratedData);
      setSettings(resolved.settings);
      setLang(resolved.settings.language || lang);
      writeBootstrapCache(migratedData, resolved.settings, userId, {
        dataDirty: resolved.replayData,
        settingsDirty: resolved.replaySettings,
        remoteRevision: remote.revision,
      });
      if (resolved.replayData || migratedData !== resolved.data) void saveData(migratedData);
      if (resolved.replaySettings) void saveSettings(resolved.settings);
    });
  }, [authState?.user?.id]);

  // Supabase Realtime uses a direct WebSocket that can be delayed or blocked on
  // some mobile networks. A tiny foreground-only revision check keeps devices
  // converged without repeatedly downloading the full workspace.
  useEffect(() => {
    if (!authState?.user || !window.plannerApi.getRemoteRevision) return;
    const userId = authState.user.id;
    let disposed = false;
    const reconcileIfNeeded = async () => {
      if (disposed
        || document.visibilityState !== "visible"
        || (typeof navigator !== "undefined" && navigator.onLine === false)
        || remoteRevisionPollInFlightRef.current) return;
      remoteRevisionPollInFlightRef.current = true;
      try {
        const incomingRevision = Number(await window.plannerApi.getRemoteRevision?.() || 0);
        if (disposed || authStateRef.current?.user?.id !== userId) return;
        const cached = readBootstrapCache(authStateRef.current?.user?.id);
        if (shouldReconcileRemoteRevision(
          remoteRevisionRef.current,
          incomingRevision,
          Boolean(cached?.dataDirty || cached?.settingsDirty),
        )) {
          queuedRemoteRefreshRef.current = true;
          await refreshQueuedRemote();
        }
      } catch {
        // Realtime and the next foreground poll remain available after a transient failure.
      } finally {
        remoteRevisionPollInFlightRef.current = false;
      }
    };
    const onForeground = () => {
      if (document.visibilityState === "visible") void reconcileIfNeeded();
    };
    void reconcileIfNeeded();
    const interval = window.setInterval(() => void reconcileIfNeeded(), REMOTE_REVISION_POLL_MS);
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
    };
  }, [authState?.user?.id]);

  useEffect(() => {
    if (!data || aiMessages.length > 0) return;
    const conversations = data.aiConversations || [];
    const active = conversations.find((conversation) => conversation.id === (data.activeAiConversationId || activeAiConversationId)) || conversations[0];
    if (active) {
      setActiveAiConversationId(active.id);
      setAiMessages(chatToSessionMessages(active.messages || []));
    } else {
      const restored = chatToSessionMessages(data.chat || []);
      if (restored.length > 0) setAiMessages(restored);
    }
  }, [data?.generatedAt]);

  // Daily view resets range-only panel controls.
  useEffect(() => {
    const supportsRangeControls = timelineView === "3day" || timelineView === "weekly" || timelineView === "month";
    if (!supportsRangeControls) {
      setCandidatePanelCollapsed(false);
      setFullscreen(false);
    }
  }, [timelineView]);

  // Range views become the compact reading mode when the candidate shelf is
  // collapsed. Keep this derived here so every collapse/expand entry point is
  // consistent, including the week-view fullscreen control.
  useEffect(() => {
    const supportsCompactRange = timelineView === "3day" || timelineView === "weekly" || timelineView === "month";
    setSimpleView((candidatePanelCollapsed || fullscreen) && supportsCompactRange);
  }, [candidatePanelCollapsed, fullscreen, timelineView]);

  useEffect(() => {
    if (mode !== "execute") {
      setSimpleView(false);
      setFullscreen(false);
    }
  }, [mode]);

  function resetWorkspaceUi() {
    workspaceLoadVersionRef.current += 1;
    pendingDataSaveRef.current = null;
    pendingSettingsSaveRef.current = null;
    dataSaveVersionRef.current += 1;
    settingsSaveVersionRef.current += 1;
    dataSaveRetryCountRef.current = 0;
    settingsSaveRetryCountRef.current = 0;
    dataSaveNoticeShownRef.current = false;
    settingsSaveNoticeShownRef.current = false;
    if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    dataSaveTimerRef.current = null;
    dataSaveRetryTimerRef.current = null;
    settingsSaveTimerRef.current = null;
    settingsSaveRetryTimerRef.current = null;
    queuedRemoteRefreshRef.current = false;
    remoteRevisionRef.current = 0;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = null;
    setModeState("execute");
    setCompactExecuteView("schedule");
    setQuickAddOpen(false);
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
    setActiveAiConversationId("");
    setAiConversationListOpen(false);
    setAiMemoryNotice("");
    setAiActionPatches({});
    setAiAttachment(null);
    setAiAttachmentStatus("");
    setSchedulePreviews([]);
    setAutoScheduleState("idle");
    setQuickTitle("");
    setQuickProjectId("");
    setQuickProjectOpen(false);
    setUtilityPanel(null);
    setCandidatePanelCollapsed(false);
    setFullscreen(false);
    setSimpleView(false);
    setShowCompletedCandidates(false);
    setCandidateProjectFilters([]);
    setCandidateFilterOpen(false);
    setGroupByProject(false);
    setToast("");
    setToastAction(null);
  }

  function scheduleSnapshotWrite() {
    if (typeof window === "undefined" || isCompactWindowRoute || !window.desktopApi?.writeSnapshot) return;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = window.setTimeout(() => {
      snapshotTimerRef.current = null;
      try {
        void window.desktopApi?.writeSnapshot?.({
          data: dataRef.current,
          settings: settingsRef.current,
          authUser: authStateRef.current?.user ?? null,
        });
      } catch (err) {
        console.warn("[snapshot] write failed:", err);
      }
    }, 1500);
  }

  async function loadInitial() {
    let loadVersion = workspaceLoadVersionRef.current + 1;
    workspaceLoadVersionRef.current = loadVersion;
    let attemptedCloudUser = false;
    try {
    const api = await waitForPlannerApi();
    const auth = (await api.getAuthState?.()) || { mode: "local" as const, user: null, configured: false };
    if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)) return;
    attemptedCloudUser = auth.mode === "cloud" && Boolean(auth.user);
    const workspaceKey = auth.mode === "cloud" ? `cloud:${auth.user?.id || "signed-out"}` : "local";
    if (loadedWorkspaceKeyRef.current && loadedWorkspaceKeyRef.current !== workspaceKey) {
      resetWorkspaceUi();
      loadVersion = workspaceLoadVersionRef.current + 1;
      workspaceLoadVersionRef.current = loadVersion;
    }
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
      ? await api.getBootstrap({ force: true })
      : {
        auth,
        data: await api.getData(),
        settings: await api.getSettings()
      };
    if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)
      || loadedWorkspaceKeyRef.current !== workspaceKey) return;
    setAuthError("");
    const resolved = resolveBootstrap(cached, bootstrap.data, bootstrap.settings);
    let nextData = resolved.data;
    let nextSettings = resolved.settings;
    const shouldPushCachedData = resolved.replayData;
    let shouldPushCachedSettings = resolved.replaySettings;
    if (!nextData || !nextSettings) return;
    if (auth.user && window.desktopApi?.readLatestSnapshot) {
      try {
        const recovery = await window.desktopApi.readLatestSnapshot();
        if (recovery.ok && recovery.payload?.settings) {
          const accountRecovery = recoverAccountSettings(
            nextSettings,
            recovery.payload.settings,
            auth.user.id,
            recovery.payload.authUser?.id,
          );
          nextSettings = accountRecovery.settings;
          shouldPushCachedSettings ||= accountRecovery.recovered;
        }
      } catch (snapshotErr) {
        console.warn("[loadInitial] account recovery snapshot read failed:", snapshotErr);
      }
    }
    const migratedHabitData = migrateLegacyHabitTracker(nextData, nextSettings.pluginConfigs);
    const shouldPersistHabitMigration = migratedHabitData !== nextData;
    nextData = migratedHabitData;
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
          ...calculateTimelineRecordEnd(task.scheduledDate, task.scheduledStart, taskDuration(task)),
          executionStatus: task.executionStatus || "scheduled",
          createdAt: task.updatedAt || new Date().toISOString(),
        };
        return { ...task, timelineRecords: [record], scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, executionStatus: undefined };
      });
    }
    remoteRevisionRef.current = bootstrap.revision || cached?.remoteRevision || 0;
    writeBootstrapCache(nextData, nextSettings, auth.user?.id, {
      dataDirty: shouldPushCachedData,
      settingsDirty: shouldPushCachedSettings,
      remoteRevision: bootstrap.revision,
    });
    dataRef.current = nextData;
    settingsRef.current = nextSettings;
    setData(nextData);
    setSettings(nextSettings);
    if (nextSettings.language) setLang(nextSettings.language);
    setModeState((nextSettings.activeMode as Mode) || "execute");
    setAdvancedOpen(Boolean(nextSettings.addAdvancedOpen));
    if (nextSettings.defaultTimelineView) setTimelineView(nextSettings.defaultTimelineView);
    if ((shouldPushCachedData || shouldPersistHabitMigration) && nextData) void saveData(nextData);
    if (shouldPushCachedSettings) void saveSettings(nextSettings);
    // Persist a local JSON snapshot so users always have an offline backup.
    if (!isCompactWindowRoute) {
      try {
        void window.desktopApi?.writeSnapshot?.({
          data: nextData,
          settings: nextSettings,
          authUser: auth.user ?? null,
        });
      } catch (snapshotErr) {
        console.warn("[loadInitial] snapshot write failed:", snapshotErr);
      }
    }
    } catch (err) {
      if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)) return;
      console.error("Failed to load initial data:", err);
      if (attemptedCloudUser) {
        const message = err instanceof Error ? err.message : String(err);
        if (dataRef.current && settingsRef.current) {
          showToast(lang === "zh" ? "云端数据暂时无法加载，已保留本机缓存。" : "Cloud data could not load. Keeping this device's cache.");
        } else {
          setAuthError(message || (lang === "zh" ? "云端数据暂时无法加载，请稍后重试。" : "Cloud data could not load. Please try again later."));
        }
        return;
      }
      if (!localFallbackAppliedRef.current) {
        localFallbackAppliedRef.current = true;
        forceLocalPreviewMode();
        void loadInitial();
      }
    }
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
      if (!isWorkspaceRoute) window.location.assign("/app");
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
        await flushPendingSave({ urgent: true });
        await flushPendingSettings({ urgent: true });
      } catch {
        // A stale or expired session must not prevent the user from signing out.
        pendingDataSaveRef.current = null;
        pendingSettingsSaveRef.current = null;
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
    const confirmed = await dialog.confirm(lang === "zh"
      ? "确定永久删除账户和全部 NavoPath 数据吗？此操作无法撤销。"
      : "Permanently delete your account and all NavoPath data? This cannot be undone.");
    if (!confirmed) return;
    try {
      await flushPendingSave({ urgent: true });
      await flushPendingSettings({ urgent: true });
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
    const flushForLifecycle = () => {
      void flushPendingSave({ urgent: true });
      void flushPendingSettings({ urgent: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushForLifecycle();
    };
    const handleOnline = () => {
      void flushPendingSave();
      void flushPendingSettings();
      const cached = readBootstrapCache(authStateRef.current?.user?.id);
      if (cached?.dataDirty || cached?.settingsDirty) {
        queuedRemoteRefreshRef.current = true;
        void refreshQueuedRemote();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushForLifecycle);
    window.addEventListener("beforeunload", flushForLifecycle);
    window.addEventListener("online", handleOnline);
    return () => {
      workspaceLoadVersionRef.current += 1;
      if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
      if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
      if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
      if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
      if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushForLifecycle);
      window.removeEventListener("beforeunload", flushForLifecycle);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const dayStartHour = useMemo(() => {
    const ds = settings?.dayStartTime;
    if (!ds) return 0;
    const parts = ds.split(":").map(Number);
    const h = parts[0];
    const m = parts[1] || 0;
    if (!Number.isFinite(h) || h < 0 || h > 23) return 0;
    if (!Number.isFinite(m) || m < 0 || m >= 60) return h;
    // Return float hours so dayStartHour * 60 yields correct minutes
    // (e.g. "09:30" → 9.5 → 570 minutes). All downstream math uses
    // startHour * 60, so a float works transparently.
    return h + m / 60;
  }, [settings?.dayStartTime]);

  useEffect(() => {
    if (pendingTimelineFocus) return;
    if (mode !== "execute" || !data || !timelineRef.current) return;
    const autoScrollKey = `${timelineView}:${selectedDate}`;
    if (lastTimelineAutoScrollKeyRef.current === autoScrollKey) return;
    lastTimelineAutoScrollKeyRef.current = autoScrollKey;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const fallbackMinutes = 9 * 60;
    const targetMinutes = selectedDate === todayIso() && currentMinutes >= 0 && currentMinutes <= 24 * 60
      ? currentMinutes
      : fallbackMinutes;
    const container = timelineRef.current;
    const effectColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
    const effectEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
    const effectAnchorDate = timelineView === "weekly" ? getVisibleDays("weekly", selectedDate)[0] : selectedDate;
    const effectStartDate = buildDailyContinuousDates(effectAnchorDate, effectEnabled, continuousTimelineDayCount(effectColumnCount))[0] || selectedDate;
    const effectTop = (date: string, time: string) => {
      const offset = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${effectStartDate}T00:00:00`).getTime()) / 86400000);
      const bandIndex = Math.floor(offset / effectColumnCount);
      let minutesFromDayStart = timeToMinutes(time) - dayStartHour * 60;
      if (minutesFromDayStart < 0) minutesFromDayStart += 24 * 60;
      return bandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
    };
    const targetTop = effectEnabled
      ? effectTop(selectedDate, minutesToTime(targetMinutes))
      : (() => {
          let diff = targetMinutes - dayStartHour * 60;
          if (diff < 0) diff += 24 * 60;
          return (diff / SLOT_MINUTES) * timelineSlotHeight;
        })();
    container.scrollTop = Math.max(0, targetTop - container.clientHeight * 0.5);
  }, [mode, data, selectedDate, timelineView, pendingTimelineFocus, dayStartHour, settings?.continuousCrossDayScroll, timelineSlotHeight]);

  // Scroll timeline to day start time when the setting changes
  const prevDayStartRef = useRef<string>("");
  useEffect(() => {
    if (mode !== "execute") return;
    const dayStart = settings?.dayStartTime || "00:00";
    const isInitial = !prevDayStartRef.current;
    if (!isInitial && prevDayStartRef.current !== dayStart) {
      const [h, m] = dayStart.split(":").map(Number);
      const startMinutes = (h || 0) * 60 + (m || 0);
      if (timelineRef.current) {
        const targetTop = ((startMinutes - dayStartHour * 60) / SLOT_MINUTES) * timelineSlotHeight;
        timelineRef.current.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
      showToast(lang === "zh" ? `一天开始时间已设为 ${dayStart}` : `Day start time set to ${dayStart}`);
    }
    prevDayStartRef.current = dayStart;
  }, [settings?.dayStartTime, mode, lang, dayStartHour, timelineSlotHeight]);

  useLayoutEffect(() => {
    if (mode !== "execute" || !pendingTimelineFocus) return;
    const targetDate = pendingTimelineFocus.date;
    const visibleDays = getVisibleDays(timelineView === "weekly" ? "weekly" : (timelineView === "3day" ? "3day" : "daily"), selectedDate);
    if (!visibleDays.includes(targetDate)) {
      const anchorDate = resolveVisibleAnchorForDate(targetDate);
      setSelectedDate(anchorDate);
      return;
    }
    const container = timelineRef.current;
    if (!container) return;
    const targetMinutes = pendingTimelineFocus.startTime
      ? timeToMinutes(pendingTimelineFocus.startTime)
      : Math.max(TIMELINE_START * 60, 9 * 60);
    const effectColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
    const effectEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
    const effectAnchorDate = timelineView === "weekly" ? getVisibleDays("weekly", selectedDate)[0] : selectedDate;
    const effectStartDate = buildDailyContinuousDates(effectAnchorDate, effectEnabled, continuousTimelineDayCount(effectColumnCount))[0] || selectedDate;
    const effectTop = (date: string, time: string) => {
      const offset = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${effectStartDate}T00:00:00`).getTime()) / 86400000);
      const bandIndex = Math.floor(offset / effectColumnCount);
      let minutesFromDayStart = timeToMinutes(time) - dayStartHour * 60;
      if (minutesFromDayStart < 0) minutesFromDayStart += 24 * 60;
      return bandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
    };
    const targetTop = effectEnabled
      ? effectTop(targetDate, minutesToTime(targetMinutes))
      : ((targetMinutes - TIMELINE_START * 60) / SLOT_MINUTES) * timelineSlotHeight;
    const nextScrollTop = Math.max(0, targetTop - container.clientHeight * 0.5);
    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = nextScrollTop;
      setPendingTimelineFocus(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, pendingTimelineFocus, selectedDate, timelineView, dayStartHour, settings?.continuousCrossDayScroll, timelineSlotHeight]);

  useEffect(() => {
    const effectColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
    const effectEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
    if (mode !== "execute" || !effectEnabled) {
      setVisibleTimelineDate(selectedDate);
      return;
    }
    const scrollElement = timelineRef.current;
    if (!scrollElement) return;
    const effectAnchorDate = timelineView === "weekly" ? getVisibleDays("weekly", selectedDate)[0] : selectedDate;
    const effectDates = buildDailyContinuousDates(effectAnchorDate, true, continuousTimelineDayCount(effectColumnCount));
    const effectStartDate = effectDates[0] || selectedDate;
    const effectBandCount = Math.max(1, Math.ceil(effectDates.length / effectColumnCount));
    const dayHeight = (24 * 60 / SLOT_MINUTES) * timelineSlotHeight;
    const bufferBands = Math.max(1, Math.floor(effectBandCount / 4));
    // Label-only update: safe to call on init (no state shift, no loop risk).
    const updateVisibleLabel = () => {
      const centerY = scrollElement.scrollTop + scrollElement.clientHeight / 2;
      const bandIndex = Math.max(0, Math.min(effectBandCount - 1, Math.floor(centerY / dayHeight)));
      const nextDate = getContinuousTimelineDateForOffset(effectStartDate, bandIndex, effectColumnCount);
      setVisibleTimelineDate((current) => current === nextDate ? current : nextDate);
    };
    // Full scroll handler: label + infinite-scroll prepend/append. Only invoked
    // on real scroll events, never on effect init, so mount-time scrollTop=0
    // cannot trigger a setSelectedDate feedback loop.
    const handleTimelineScroll = () => {
      updateVisibleLabel();
      if (continuousPrependLockRef.current || timelinePinchActiveRef.current) return;
      // Guard: if the container isn't scrollable (not laid out yet or content
      // fits), skip prepend/append entirely to avoid a compensation clamp loop.
      if (scrollElement.scrollHeight <= scrollElement.clientHeight) return;
      const distanceFromBottom = scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop;
      if (scrollElement.scrollTop < dayHeight && effectBandCount > 1) {
        // Near top — prepend earlier bands.
        continuousPrependLockRef.current = true;
        continuousScrollRestoreRef.current = { oldScrollTop: scrollElement.scrollTop, shiftBands: bufferBands };
        setSelectedDate(addDays(selectedDate, -bufferBands * effectColumnCount));
      } else if (distanceFromBottom < dayHeight && effectBandCount > 1) {
        // Near bottom — append later bands.
        continuousPrependLockRef.current = true;
        continuousScrollRestoreRef.current = { oldScrollTop: scrollElement.scrollTop, shiftBands: -bufferBands };
        setSelectedDate(addDays(selectedDate, bufferBands * effectColumnCount));
      }
    };
    updateVisibleLabel();
    scrollElement.addEventListener("scroll", handleTimelineScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleTimelineScroll);
  }, [mode, settings?.continuousCrossDayScroll, timelineView, selectedDate, timelineSlotHeight]);

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

  useEffect(() => {
    if (!compactLayout || !resizeHintTaskId) return;
    const clearSelectedTimelineTask = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".df-time-block, .df-mobile-task-summary")) return;
      setResizeHintTaskId("");
      if (drawerOpen && mobileTaskSummary) closeTaskDrawer({ autoSave: true });
    };
    document.addEventListener("pointerdown", clearSelectedTimelineTask);
    return () => document.removeEventListener("pointerdown", clearSelectedTimelineTask);
  }, [compactLayout, resizeHintTaskId, drawerOpen, mobileTaskSummary]);

  // Dismiss timeline quick-add when its coordinate system changes.
  useEffect(() => {
    setDragCreate(null);
  }, [timelineView, drag, drawerOpen]);

  function revealResizeHandles(taskId: string) {
    setResizeHintTaskId(taskId);
  }

  function syncFailureMessage() {
    return lang === "zh" ? "同步稍后自动重试" : "Sync will retry automatically";
  }

  function maybeShowSyncFailureNotice(kind: "data" | "settings") {
    const retryCount = kind === "data" ? dataSaveRetryCountRef.current : settingsSaveRetryCountRef.current;
    const shown = kind === "data" ? dataSaveNoticeShownRef.current : settingsSaveNoticeShownRef.current;
    if (retryCount < SYNC_FAILURE_NOTICE_AFTER || shown) return;
    if (kind === "data") dataSaveNoticeShownRef.current = true;
    else settingsSaveNoticeShownRef.current = true;
    showToast(syncFailureMessage());
  }

  function scheduleDataFlush(delay = SAVE_DEBOUNCE_MS) {
    if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    dataSaveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, delay);
  }

  function scheduleSettingsFlush(delay = SAVE_DEBOUNCE_MS) {
    if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    settingsSaveTimerRef.current = window.setTimeout(() => {
      void flushPendingSettings();
    }, delay);
  }

  function scheduleDataRetry() {
    const delay = SYNC_RETRY_DELAYS[Math.min(dataSaveRetryCountRef.current - 1, SYNC_RETRY_DELAYS.length - 1)];
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    dataSaveRetryTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, delay);
  }

  function scheduleSettingsRetry() {
    const delay = SYNC_RETRY_DELAYS[Math.min(settingsSaveRetryCountRef.current - 1, SYNC_RETRY_DELAYS.length - 1)];
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    settingsSaveRetryTimerRef.current = window.setTimeout(() => {
      void flushPendingSettings();
    }, delay);
  }

  async function flushPendingSave(options: { urgent?: boolean } = {}): Promise<void> {
    if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    dataSaveTimerRef.current = null;
    dataSaveRetryTimerRef.current = null;
    if (dataSaveInFlightRef.current) {
      await new Promise<void>((resolve) => dataSaveWaitersRef.current.push(resolve));
      return flushPendingSave(options);
    }
    dataSaveInFlightRef.current = true;
    try {
      while (pendingDataSaveRef.current) {
        const job = pendingDataSaveRef.current;
        pendingDataSaveRef.current = null;
        try {
          const saved = await window.plannerApi.saveData(job.payload);
          const acknowledgedRevision = Number(window.plannerApi.getKnownRemoteRevision?.() || 0);
          if (acknowledgedRevision > 0) remoteRevisionRef.current = Math.max(remoteRevisionRef.current, acknowledgedRevision);
          dataSaveRetryCountRef.current = 0;
          dataSaveNoticeShownRef.current = false;
          if (job.version === dataSaveVersionRef.current && !pendingDataSaveRef.current) {
            dataRef.current = saved;
            setData(saved);
            const userId = authStateRef.current?.user?.id;
            const cached = readBootstrapCache(userId);
            if (settingsRef.current && canAcknowledgeBootstrapSave(cached, "data", job.pendingSavedAt)) {
              writeBootstrapCache(saved, settingsRef.current, userId, {
                dataDirty: false,
                dataPendingSavedAt: null,
                remoteRevision: remoteRevisionRef.current,
              });
            }
            scheduleSnapshotWrite();
          }
        } catch {
          const latestPending = pendingDataSaveRef.current as QueuedDataSave | null;
          const shouldRetry = shouldRequeueFailedSave(job.version, dataSaveVersionRef.current, latestPending?.version);
          if (shouldRetry) {
            pendingDataSaveRef.current = job;
            dataSaveRetryCountRef.current += 1;
            maybeShowSyncFailureNotice("data");
            scheduleDataRetry();
          }
          break;
        }
      }
    } finally {
      dataSaveInFlightRef.current = false;
      const waiters = dataSaveWaitersRef.current.splice(0);
      waiters.forEach((resolve) => resolve());
      if (pendingDataSaveRef.current && !dataSaveRetryTimerRef.current && !options.urgent) scheduleDataFlush(0);
      else void refreshQueuedRemote();
    }
  }

  async function flushPendingSettings(options: { urgent?: boolean } = {}): Promise<void> {
    if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    settingsSaveTimerRef.current = null;
    settingsSaveRetryTimerRef.current = null;
    if (settingsSaveInFlightRef.current) {
      await new Promise<void>((resolve) => settingsSaveWaitersRef.current.push(resolve));
      return flushPendingSettings(options);
    }
    settingsSaveInFlightRef.current = true;
    try {
      while (pendingSettingsSaveRef.current) {
        const job = pendingSettingsSaveRef.current;
        pendingSettingsSaveRef.current = null;
        try {
          const saved = await window.plannerApi.saveSettings(job.payload);
          const acknowledgedRevision = Number(window.plannerApi.getKnownRemoteRevision?.() || 0);
          if (acknowledgedRevision > 0) remoteRevisionRef.current = Math.max(remoteRevisionRef.current, acknowledgedRevision);
          settingsSaveRetryCountRef.current = 0;
          settingsSaveNoticeShownRef.current = false;
          if (job.version === settingsSaveVersionRef.current && !pendingSettingsSaveRef.current) {
            settingsRef.current = saved;
            setSettings(saved);
            if (saved.language) setLang(saved.language);
            const userId = authStateRef.current?.user?.id;
            const cached = readBootstrapCache(userId);
            if (dataRef.current && canAcknowledgeBootstrapSave(cached, "settings", job.pendingSavedAt)) {
              writeBootstrapCache(dataRef.current, saved, userId, {
                settingsDirty: false,
                settingsPendingSavedAt: null,
                remoteRevision: remoteRevisionRef.current,
              });
            }
            if (saved.activeMode) setModeState(saved.activeMode as Mode);
            scheduleSnapshotWrite();
          }
        } catch {
          const latestPending = pendingSettingsSaveRef.current as QueuedSettingsSave | null;
          const shouldRetry = shouldRequeueFailedSave(job.version, settingsSaveVersionRef.current, latestPending?.version);
          if (shouldRetry) {
            pendingSettingsSaveRef.current = job;
            settingsSaveRetryCountRef.current += 1;
            maybeShowSyncFailureNotice("settings");
            scheduleSettingsRetry();
          }
          break;
        }
      }
    } finally {
      settingsSaveInFlightRef.current = false;
      const waiters = settingsSaveWaitersRef.current.splice(0);
      waiters.forEach((resolve) => resolve());
      if (pendingSettingsSaveRef.current && !settingsSaveRetryTimerRef.current && !options.urgent) scheduleSettingsFlush(0);
      else void refreshQueuedRemote();
    }
  }

  async function saveData(next: PlannerData) {
    const savedAt = new Date().toISOString();
    const tracked = withDeletionTombstones(dataRef.current, next, savedAt);
    const optimistic = { ...tracked, aiProfile: buildAiProfile(tracked), savedAt };
    const version = dataSaveVersionRef.current + 1;
    dataSaveVersionRef.current = version;
    pendingDataSaveRef.current = { payload: optimistic, version, pendingSavedAt: savedAt };
    dataRef.current = optimistic;
    setData(optimistic);
    if (settingsRef.current) writeBootstrapCache(optimistic, settingsRef.current, authStateRef.current?.user?.id, {
      dataDirty: true,
      dataPendingSavedAt: savedAt,
      remoteRevision: remoteRevisionRef.current,
    });
    scheduleDataFlush();
  }

  function makeSmartTask(nextForm: FormState) {
    const current = dataRef.current;
    const currentSettings = settingsRef.current;
    return makeTask(nextForm, current && currentSettings ? { data: current, projects: current.projects, settings: currentSettings } : undefined);
  }

  async function enrichTaskInBackground(task: Task) {
    const durationConfidence = task.aiInference?.duration?.confidence ?? 1;
    const projectConfidence = task.aiInference?.project?.confidence ?? 0;
    if (durationConfidence >= 0.6 && (task.projectId || projectConfidence >= 0.6)) return;
    const snapshot = dataRef.current;
    if (!snapshot) return;
    const result = await callAiAssistant({
      mode: "enrich_task",
      message: task.title,
      context: {
        task: { id: task.id, title: task.title, estimatedMinutes: Math.round((task.estimatedHours || 0.5) * 60), projectId: task.projectId },
        projects: snapshot.projects.map((project) => ({ id: project.id, title: project.title })),
        preferences: snapshot.aiProfile ? {
          durationByProject: snapshot.aiProfile.durationByProject,
          feedback: snapshot.aiProfile.feedback,
        } : undefined,
      },
    });
    if (!result.ok || !result.enrichment) return;
    const latest = dataRef.current;
    const currentTask = latest?.tasks.find((item) => item.id === task.id);
    if (!latest || !currentTask) return;
    const confidence = Math.max(0, Math.min(1, Number(result.enrichment.confidence) || 0));
    if (confidence < 0.72) return;
    const canApplyDuration = !currentTask.aiInference?.duration?.userOverridden
      && currentTask.estimatedHours === task.estimatedHours
      && Number.isFinite(result.enrichment.durationMinutes);
    const projectId = result.enrichment.projectId;
    const canApplyProject = !currentTask.projectId
      && !currentTask.aiInference?.project?.userOverridden
      && typeof projectId === "string"
      && latest.projects.some((project) => project.id === projectId);
    if (!canApplyDuration && !canApplyProject) return;
    const inferredAt = new Date().toISOString();
    await saveData({
      ...latest,
      tasks: latest.tasks.map((item) => item.id === task.id ? {
        ...item,
        ...(canApplyDuration ? { estimatedHours: Math.max(15, Number(result.enrichment!.durationMinutes)) / 60 } : {}),
        ...(canApplyProject ? { projectId } : {}),
        aiInference: {
          ...item.aiInference,
          ...(canApplyDuration ? { duration: { minutes: Math.max(15, Number(result.enrichment!.durationMinutes)), confidence, source: "ai" as const, inferredAt, modelVersion: "gateway-enrich-v1" } } : {}),
          ...(canApplyProject ? { project: { projectId: projectId!, confidence, source: "ai" as const, inferredAt, modelVersion: "gateway-enrich-v1" } } : {}),
        },
        updatedAt: inferredAt,
      } : item),
    });
  }

  async function saveSettings(patch: SettingsPatch) {
    const current = settingsRef.current || settings;
    if (!current) return;
    const optimistic = { ...current, ...patch };
    const pendingSavedAt = new Date().toISOString();
    const version = settingsSaveVersionRef.current + 1;
    settingsSaveVersionRef.current = version;
    pendingSettingsSaveRef.current = { payload: optimistic, version, pendingSavedAt };
    settingsRef.current = optimistic;
    setSettings(optimistic);
    if (optimistic.language) setLang(optimistic.language);
    if (dataRef.current) writeBootstrapCache(dataRef.current, optimistic, authStateRef.current?.user?.id, {
      settingsDirty: true,
      settingsPendingSavedAt: pendingSavedAt,
      remoteRevision: remoteRevisionRef.current,
    });
    if (patch.activeMode) setModeState(patch.activeMode as Mode);
    scheduleSettingsFlush();
  }

  /**
   * Manual sync: push any pending local changes, pull the latest remote baseline,
   * then persist lastSyncedAt. Called by the Account → "Sync now" button and by
   * the auto-sync scheduler itself. Concurrent invocations share a single
   * in-flight run via the SyncScheduler.
   */
  async function handleSyncNow({ silent = false, direction = "both" }: { silent?: boolean; direction?: "push" | "pull" | "both" } = {}): Promise<boolean> {
    if (authState?.mode !== "cloud" || !authState.user) {
      if (!silent) showToast(lang === "zh" ? "登录后即可同步。" : "Sign in to sync.");
      return false;
    }
    const scheduler = syncSchedulerRef.current;
    if (!scheduler) {
      if (!silent) showToast(lang === "zh" ? "同步功能初始化中，请稍后再试。" : "Sync is initializing, please try again later.");
      return false;
    }
    if (!silent) {
      setIsManualSyncing(true);
      showToast(t(lang, "sync.syncing"));
    }
    try {
      if (direction === "push" || direction === "both") {
        await flushPendingSave({ urgent: true });
        await flushPendingSettings({ urgent: true });
      } else if (direction === "pull") {
        // Pull is intentionally non-destructive: acknowledge local work first,
        // then reconcile the cloud baseline. Import/restore remains the explicit
        // workflow for replacing local data.
        await Promise.all([
          flushPendingSave({ urgent: true }),
          flushPendingSettings({ urgent: true }),
        ]);
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      }
      const result = direction === "push"
        ? await scheduler.runPushOnly()
        : direction === "pull"
          ? await scheduler.runPullOnly()
          : await scheduler.runNow();
      if (!silent) {
        if (!result.ok) {
          showToast(t(lang, "sync.failure"));
        } else if (direction === "push") {
          showToast(result.pushedLocal
            ? (lang === "zh" ? "已推送本地数据到云端。" : "Pushed local data to cloud.")
            : (lang === "zh" ? "没有待推送的本地改动。" : "No local changes to push."));
        } else if (direction === "pull") {
          showToast(result.pulledRemote
            ? (lang === "zh" ? "已从云端拉取最新数据。" : "Pulled latest data from cloud.")
            : (lang === "zh" ? "云端无新数据。" : "No new data from cloud."));
        } else if (result.pushedLocal || result.pulledRemote) {
          showToast(lang === "zh" ? "同步完成。" : "Sync complete.");
        } else {
          showToast(lang === "zh" ? "已是最新数据。" : "Already up to date.");
        }
      }
      return result.ok;
    } catch (error) {
      if (!silent) showToast(t(lang, "sync.failure"));
      console.warn("Manual sync failed", error);
      return false;
    } finally {
      if (!silent) setIsManualSyncing(false);
    }
  }

  function persistSyncTimestamp(syncedAt: string) {
    const current = settingsRef.current;
    if (!current) return;
    if (current.lastSyncedAt === syncedAt) return;
    // Avoid triggering the scheduler to re-arm during its own writeback.
    void saveSettings({ lastSyncedAt: syncedAt });
  }

  useEffect(() => {
    const scheduler = new SyncScheduler({
      isBusy: () =>
        Boolean(
          pendingDataSaveRef.current ||
            pendingSettingsSaveRef.current ||
            dataSaveInFlightRef.current ||
            settingsSaveInFlightRef.current,
        ),
      isPaused: () => (typeof document === "undefined" ? false : document.visibilityState !== "visible"),
      pushLocal: async () => {
        if (pendingDataSaveRef.current) await flushPendingSave({ urgent: true });
        if (pendingSettingsSaveRef.current) await flushPendingSettings({ urgent: true });
      },
      pullRemote: async () => {
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      },
      onTick: (result) => {
        if (!result.ok) return;
        if (result.pushedLocal || result.pulledRemote) persistSyncTimestamp(result.syncedAt);
      },
    });
    syncSchedulerRef.current = scheduler;
    return () => {
      scheduler.stop();
      if (syncSchedulerRef.current === scheduler) syncSchedulerRef.current = null;
    };
  }, []);

  // Re-arm the scheduler whenever the user changes the sync interval.
  useEffect(() => {
    const scheduler = syncSchedulerRef.current;
    if (!scheduler) return;
    scheduler.setIntervalMinutes(readSyncInterval(settings));
  }, [settings?.syncIntervalMinutes, authState?.user?.id]);

  // Built-in plugins may use lifecycle hooks. External plugins contribute only
  // validated manifest metadata and configuration; disk scripts are never run.
  useEffect(() => {
    registerBuiltinPlugins();
    if (!externalPluginsLoadedRef.current) {
      externalPluginsLoadedRef.current = true;
      void window.desktopApi?.listExternalPlugins?.()
        .then((result) => {
          const existingIds = new Set(listRegisteredPlugins().map((plugin) => plugin.id));
          let added = 0;
          for (const plugin of result?.plugins ?? []) {
            if (existingIds.has(plugin.id)) continue;
            registerPlugin(externalManifestToPlugin(plugin));
            existingIds.add(plugin.id);
            added += 1;
          }
          if (added > 0) setExternalPluginsRevision((revision) => revision + 1);
        })
        .catch((error) => {
          console.warn("[plugins] failed to load external plugins:", error);
        });
    }
    if (!pluginHostRef.current) {
      pluginHostRef.current = {
        getData: () => dataRef.current,
        saveData: (next) => {
          if (!next || typeof next !== "object") return;
          void saveData(next as PlannerData);
        },
        savePluginConfig: (pluginId, patch) => {
          const current = settingsRef.current;
          if (!current) return;
          const existing = current.pluginConfigs?.[pluginId] ?? {};
          const merged = { ...existing, ...patch };
          const nextConfigs = { ...(current.pluginConfigs ?? {}), [pluginId]: merged };
          void saveSettings({ pluginConfigs: nextConfigs });
        },
        emit: (event, payload) => {
          // Lightweight local event bus — listeners registered via window events.
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("navopath:plugin", { detail: { event, payload } }));
          }
        },
        toast: (message) => showToast(message),
      };
    }
    // Activate every plugin id listed in settings.enabledPlugins that is not
    // already active. We also deactivate any plugin that has been removed.
    const enabled = new Set(settings?.enabledPlugins ?? []);
    const host = pluginHostRef.current;
    for (const plugin of listRegisteredPlugins()) {
      const should = enabled.has(plugin.id);
      const active = isPluginActive(plugin.id);
      if (should && !active) {
        activatePlugin(plugin.id, host, resolvePluginConfig(plugin, settings?.pluginConfigs?.[plugin.id]));
      } else if (!should && active) {
        deactivatePlugin(plugin.id, host);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.enabledPlugins, settings?.pluginConfigs, externalPluginsRevision]);

  const today = todayIso();
  const timelineDate = selectedDate;
  const continuousTimelineEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
  const timelineColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
  const timelineWindowAnchorDate = continuousTimelineEnabled ? visibleTimelineDate : timelineDate;
  const isViewingToday = timelineWindowAnchorDate === today;
  const projects = data?.projects || [];
  const tasks = data?.tasks || [];
  const events = data?.events || [];
  const commandIndex = useMemo(() => data && settings ? buildCommandSearchIndex(data, settings) : [], [data, settings]);
  const commandResults = useMemo(() => searchCommands(commandIndex, commandQuery), [commandIndex, commandQuery]);

  const timerTask = useMemo(() => tasks.find((task) => task.id === timerTaskId) || null, [tasks, timerTaskId]);
  const timerProject = useMemo(() => timerTask?.projectId ? projects.find((p) => p.id === timerTask.projectId) || null : null, [timerTask, projects]);

  const stopAndSaveTimer = useCallback(() => {
    const elapsed = timerRunning && timerStartedAtRef.current !== null
      ? advanceTaskElapsedSeconds(timerElapsedBaseRef.current, timerStartedAtRef.current, Date.now())
      : timerElapsedRef.current;
    if (!timerTaskId || elapsed < 1) {
      timerElapsedRef.current = 0; timerElapsedBaseRef.current = 0; timerStartedAtRef.current = null;
      setTimerTaskId(null); setTimerRunning(false); setTimerElapsed(0); setTimerStartedAt(null); return;
    }
    const now = new Date().toISOString();
    const start = new Date(Date.now() - elapsed * 1000).toISOString();
    const entry = {
      id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: timerTaskId,
      projectId: timerTask?.projectId,
      startAt: start,
      endAt: now,
      durationMinutes: Math.max(1, Math.round(elapsed / 60)),
      source: "timer" as const,
      createdAt: now,
      updatedAt: now,
    };
    if (data) {
      const nextData = { ...data, timeEntries: [...(data.timeEntries || []), entry] };
      void saveData(nextData);
    }
    timerElapsedRef.current = 0; timerElapsedBaseRef.current = 0; timerStartedAtRef.current = null;
    setTimerTaskId(null); setTimerRunning(false); setTimerElapsed(0); setTimerStartedAt(null);
  }, [timerRunning, timerTaskId, timerTask, data, saveData]);

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

  const continuousAnchorDate = useMemo(() => {
    if (timelineView === "weekly") return getVisibleDays("weekly", timelineDate)[0];
    return timelineDate;
  }, [timelineDate, timelineView]);
  const continuousTimelineDates = useMemo(() => {
    if (!continuousTimelineEnabled) {
      if (timelineView === "daily") return [timelineDate];
      if (timelineView === "3day" || timelineView === "weekly") return getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
      return [];
    }
    return buildDailyContinuousDates(continuousAnchorDate, true, continuousTimelineDayCount(timelineColumnCount));
  }, [continuousAnchorDate, continuousTimelineEnabled, timelineColumnCount, timelineDate, timelineView]);
  const continuousTimelineStartDate = continuousTimelineDates[0] || timelineDate;
  const continuousTimelineBandCount = Math.max(1, Math.ceil(continuousTimelineDates.length / timelineColumnCount));
  const visibleTimelineDates = useMemo(() => new Set(continuousTimelineDates), [continuousTimelineDates]);
  const dailyTimelineDates = continuousTimelineDates;
  const dailyTimelineCanvasHeight = dailyContinuousCanvasHeight(continuousTimelineBandCount, timelineSlotHeight);
  const dailyTimelineSlotCount = dailyContinuousSlotCount(continuousTimelineBandCount);

  useEffect(() => {
    if (mode !== "execute") {
      setNowInTimelineViewport(true);
      return;
    }
    if (timelineView === "month") {
      setNowInTimelineViewport(timelineWindowAnchorDate.slice(0, 7) === today.slice(0, 7));
      return;
    }
    const scrollElement = timelineRef.current;
    if (!scrollElement) return;

    const updateNowVisibility = () => {
      const now = new Date();
      const nowDate = todayIso();
      if (!continuousTimelineDates.includes(nowDate) || scrollElement.clientHeight <= 0) {
        setNowInTimelineViewport(false);
        return;
      }
      const dateOffset = Math.round((new Date(`${nowDate}T00:00:00`).getTime() - new Date(`${continuousTimelineStartDate}T00:00:00`).getTime()) / 86400000);
      const bandIndex = continuousTimelineEnabled ? Math.floor(dateOffset / timelineColumnCount) : 0;
      let minutesFromDayStart = now.getHours() * 60 + now.getMinutes() - dayStartHour * 60;
      if (minutesFromDayStart < 0) minutesFromDayStart += 24 * 60;
      const nowTop = bandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
      const viewportTop = scrollElement.scrollTop;
      const viewportBottom = viewportTop + scrollElement.clientHeight;
      const visible = nowTop >= viewportTop + 2 && nowTop <= viewportBottom - 2;
      setNowInTimelineViewport((current) => current === visible ? current : visible);
    };

    const frame = window.requestAnimationFrame(updateNowVisibility);
    const interval = window.setInterval(updateNowVisibility, 60_000);
    const resizeObserver = new ResizeObserver(updateNowVisibility);
    resizeObserver.observe(scrollElement);
    scrollElement.addEventListener("scroll", updateNowVisibility, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      resizeObserver.disconnect();
      scrollElement.removeEventListener("scroll", updateNowVisibility);
    };
  }, [compactExecuteView, continuousTimelineDates, continuousTimelineEnabled, continuousTimelineStartDate, dayStartHour, mode, timelineColumnCount, timelineSlotHeight, timelineView, timelineWindowAnchorDate, today]);

  const showBackToNow = !nowInTimelineViewport;

  function getTimelineRangeFor(view: TimelineView, anchorDate: string) {
    if (view === "daily") return [anchorDate];
    if (view === "3day") return getVisibleDays("3day", anchorDate);
    if (view === "weekly") return getVisibleDays("weekly", anchorDate);
    return [anchorDate];
  }

  // Expand modern timeline records into per-day display tasks while retaining
  // deprecated direct schedules until their migration is complete.
  function expandTimelineRecords(dates: Set<string>) {
    const expansion = expandTaskTimelineSlices(tasks, [...dates]);
    const result = [...expansion.tasks];
    for (const task of tasks) {
      if ((!task.timelineRecords || task.timelineRecords.length === 0) && task.scheduledDate && task.scheduledStart && dates.has(task.scheduledDate)) {
        let { scheduledStart, scheduledEnd } = task;
        const durationMinutes = taskDuration(task);
        if (!scheduledEnd || timeToMinutes(scheduledEnd) <= timeToMinutes(scheduledStart)) {
          scheduledEnd = addMinutes(scheduledStart, durationMinutes);
        }
        const computedEndMinutes = timeToMinutes(scheduledEnd);
        const computedStartMinutes = timeToMinutes(scheduledStart);
        const actualDuration = computedEndMinutes - computedStartMinutes;
        if (durationMinutes > 0 && actualDuration > durationMinutes * 3) {
          console.warn("[timeline] short task rendered too tall", {
            taskId: task.id,
            title: task.title,
            durationMinutes,
            actualDuration,
            scheduledStart,
            scheduledEnd,
          });
          scheduledEnd = addMinutes(scheduledStart, durationMinutes);
        }
        result.push({
          ...task,
          scheduledDate: task.scheduledDate,
          scheduledStart,
          scheduledEnd,
          executionStatus: task.executionStatus || "scheduled",
        } as Task);
      }
    }
    return {
      ...expansion,
      tasks: result.sort((a, b) =>
        (a.scheduledDate || "").localeCompare(b.scheduledDate || "")
        || timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)
      ),
    };
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
    const resizeEdges = new Map<string, { start: boolean; end: boolean }>();
    const expanded: Task[] = [];
    for (const event of events) {
      if (event.startTime) {
        for (const slice of expandTimedCalendarEvent(event, [...dates])) {
          expanded.push({
            id: slice.id,
            title: event.title,
            dueDate: slice.date,
            category: event.category,
            priority: "medium",
            notes: event.details,
            goalId: "",
            completed: false,
            estimatedHours: slice.durationMinutes / 60,
            scheduledDate: slice.date,
            scheduledStart: slice.startTime,
            scheduledEnd: slice.endTime,
            recurrence: event.recurrence,
            createdAt: event.createdAt,
            updatedAt: event.createdAt,
          });
          ownerMap.set(slice.id, event);
          resizeEdges.set(slice.id, {
            start: !slice.continuesBefore,
            end: !slice.continuesAfter,
          });
        }
        continue;
      }
      const occurrenceDates = event.recurrence
        ? enumerateRecurrenceDates(event.recurrence, dates)
        : [...dates].filter((date) => date >= (event.startDate || event.date) && date <= (event.endDate || event.startDate || event.date));
      for (const date of occurrenceDates) {
        const id = `event_occ_${event.id}_${date}_all`;
        expanded.push({
          id, title: event.title, dueDate: date, category: event.category, priority: "medium",
          notes: event.details, goalId: "", completed: false, estimatedHours: 0.5,
          scheduledDate: date,
          recurrence: event.recurrence, createdAt: event.createdAt, updatedAt: event.createdAt,
        });
        ownerMap.set(id, event);
      }
    }
    return { tasks: expanded, ownerMap, resizeEdges };
  }

  function expandExternalCalendarOccurrences(dates: Set<string>) {
    const resizeEdges = new Map<string, { start: boolean; end: boolean }>();
    const expanded: Task[] = [];
    const enabledSources = new Set(externalCalendarSources.filter((source) => source.enabled).map((source) => source.id));
    for (const occurrence of externalCalendarOccurrences) {
      if (!enabledSources.has(occurrence.source_id) || occurrence.status === "cancelled") continue;
      const createdAt = occurrence.start_at || new Date().toISOString();
      if (occurrence.all_day) {
        for (const date of dates) {
          if (date < occurrence.start_date || date > occurrence.end_date) continue;
          const id = `event_occ_external_${occurrence.id}_${date}_all`;
          expanded.push({
            id, title: occurrence.title, dueDate: date, category: "personal", priority: "medium",
            notes: [occurrence.location, occurrence.description].filter(Boolean).join(" · "), goalId: "", completed: false,
            estimatedHours: 0.5, scheduledDate: date, createdAt, updatedAt: createdAt,
          });
          resizeEdges.set(id, { start: false, end: false });
        }
        continue;
      }
      const start = new Date(occurrence.start_at);
      const end = new Date(occurrence.end_at);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) continue;
      const startDate = localIsoDate(start);
      const endDate = localIsoDate(end);
      const time = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
      const event: CalendarEvent = {
        id: `external_${occurrence.id}`,
        title: occurrence.title,
        date: startDate,
        startDate,
        endDate,
        startTime: time(start),
        endTime: time(end),
        category: "personal",
        details: [occurrence.location, occurrence.description].filter(Boolean).join(" · "),
        createdAt,
      };
      for (const slice of expandTimedCalendarEvent(event, [...dates])) {
        const id = `event_occ_external_${occurrence.id}_${slice.date}_${slice.startTime.replace(":", "")}`;
        expanded.push({
          id, title: occurrence.title, dueDate: slice.date, category: "personal", priority: "medium",
          notes: event.details, goalId: "", completed: false, estimatedHours: slice.durationMinutes / 60,
          scheduledDate: slice.date, scheduledStart: slice.startTime, scheduledEnd: slice.endTime,
          createdAt, updatedAt: createdAt,
        });
        resizeEdges.set(id, { start: false, end: false });
      }
    }
    return { tasks: expanded, resizeEdges };
  }

  const explicitVisibleTimeline = useMemo(
    () => expandTimelineRecords(visibleTimelineDates),
    [tasks, visibleTimelineDates],
  );

  const allDayTimelineTasks = useMemo(
    () => expandTaskAllDayRecords(tasks, [...visibleTimelineDates]),
    [tasks, visibleTimelineDates],
  );

  const recurrenceVisibleTimeline = useMemo(() => {
    return expandRecurrenceOccurrences(visibleTimelineDates);
  }, [tasks, visibleTimelineDates]);

  const eventVisibleTimeline = useMemo(() => {
    const internal = expandEventOccurrences(visibleTimelineDates);
    const external = expandExternalCalendarOccurrences(visibleTimelineDates);
    external.resizeEdges.forEach((edges, id) => internal.resizeEdges.set(id, edges));
    return { ...internal, tasks: [...internal.tasks, ...external.tasks] };
  }, [events, externalCalendarOccurrences, externalCalendarSources, visibleTimelineDates]);

  const conflictTimelineDates = useMemo(() => {
    const dates = new Set<string>();
    for (const date of visibleTimelineDates) {
      dates.add(addDays(date, -1));
      dates.add(date);
      dates.add(addDays(date, 1));
    }
    return dates;
  }, [visibleTimelineDates]);

  const conflictTimelineTasks = useMemo(
    () => [
      ...expandTimelineRecords(conflictTimelineDates).tasks,
      ...expandRecurrenceOccurrences(conflictTimelineDates).tasks,
      ...expandEventOccurrences(conflictTimelineDates).tasks.filter((task) => task.scheduledStart),
      ...expandExternalCalendarOccurrences(conflictTimelineDates).tasks.filter((task) => task.scheduledStart),
      ...previewTasks.filter((task) => conflictTimelineDates.has(task.scheduledDate || "")),
    ],
    [tasks, events, externalCalendarOccurrences, externalCalendarSources, conflictTimelineDates, previewTasks],
  );

  const expandedVisibleTimelineTasks = useMemo(
    () => [...explicitVisibleTimeline.tasks, ...recurrenceVisibleTimeline.tasks, ...eventVisibleTimeline.tasks.filter((item) => item.scheduledStart)].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)),
    [explicitVisibleTimeline.tasks, recurrenceVisibleTimeline.tasks, eventVisibleTimeline.tasks],
  );

  // Record ID → real task resolution map (for operations like project change, note save)
  const recordToTaskMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        map.set(record.id, task);
      }
    }
    explicitVisibleTimeline.ownerByDisplayId.forEach((task, id) => map.set(id, task));
    return map;
  }, [tasks, explicitVisibleTimeline.ownerByDisplayId]);

  // Record ID → record data map (for operations like uncomplete, toggleDone)
  const recordByIdMap = useMemo(() => {
    const map = new Map<string, TimelineRecord>();
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        map.set(record.id, record);
      }
    }
    explicitVisibleTimeline.recordByDisplayId.forEach((record, id) => map.set(id, record));
    return map;
  }, [tasks, explicitVisibleTimeline.recordByDisplayId]);

  const occurrenceToTaskMap = recurrenceVisibleTimeline.ownerMap;
  const occurrenceToEventMap = eventVisibleTimeline.ownerMap;

  function resolveOwningTask(taskOrId: Task | string) {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    return occurrenceToTaskMap.get(id) || recordToTaskMap.get(id);
  }

  function resolveTimelineRecordId(displayId: string) {
    return explicitVisibleTimeline.sourceIdByDisplayId.get(displayId) || displayId;
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
      const expanded = expandedVisibleTimelineTasks.filter((task) => dailyTimelineDates.includes(task.scheduledDate || ""));
      const virtual = previewTasks.filter((task) => dailyTimelineDates.includes(task.scheduledDate || ""));
      return [...expanded, ...virtual].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
    },
    [expandedVisibleTimelineTasks, dailyTimelineDates, previewTasks],
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
  const dailyCapacityRisk = useMemo(() => {
    const start = timeToMinutes(settings?.scheduleDayStartTime || "08:00");
    const end = timeToMinutes(settings?.dayEndTime || "22:00");
    const scheduledMinutes = scheduledTasks
      .filter((task) => task.scheduledDate === today && !task.id.startsWith("preview_"))
      .reduce((total, task) => total + taskDuration(task), 0);
    const availableMinutes = Math.max(end - start - scheduledMinutes, 0);
    const demandMinutes = todayCandidates.reduce((total, task) => total + taskDuration(task), 0);
    const ratio = availableMinutes > 0 ? demandMinutes / availableMinutes : demandMinutes > 0 ? 2 : 0;
    return {
      availableMinutes,
      demandMinutes,
      level: ratio > 1 ? "high" as const : ratio >= 0.8 ? "medium" as const : "comfortable" as const,
    };
  }, [settings?.scheduleDayStartTime, settings?.dayEndTime, scheduledTasks, todayCandidates, today]);
  const completedCandidates = useMemo(
    () => tasks.filter((task) => task.completed && getExecutionLane(task) !== "queued" && Boolean(task.plannedForDate && task.plannedForDate <= today) && !(task.timelineRecords || []).some((r) => r.executionStatus === "scheduled") && !task.scheduledDate && !hasRecurrenceOccurrenceOnDate(task, today)).sort((a, b) => (a.order || 0) - (b.order || 0)),
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
    if (timelineView !== "month") {
      const byDate = new Map<string, Task[]>();
      for (const task of scheduledTasks) {
        const date = task.scheduledDate || "";
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(task);
      }
      if (dragCreate?.committed) {
        const draftTask = { id: "__timeline_draft__", scheduledDate: dragCreate.date, scheduledStart: minutesToTime(dragCreate.startMinutes), scheduledEnd: minutesToTime(dragCreate.endMinutes) } as Task;
        const group = byDate.get(dragCreate.date) || [];
        byDate.set(dragCreate.date, [...group, draftTask]);
      }
      for (const [, group] of byDate) computeConflictLayout(group).forEach((v, k) => map.set(k, v));
    }
    return map;
  }, [timelineView, scheduledTasks, dragCreate]);
  const draftConflictStyle = (state: NonNullable<DragCreateState>, view: TimelineView) => {
    const style = computeConflictStyle("__timeline_draft__", conflictLayout, state.width, state.left, view === "weekly" ? 3 : 4, view);
    return style ? { left: style.left, width: style.width } : { left: state.left, width: state.width };
  };

  // Debug: conflict layout info
  useEffect(() => {
    if (conflictLayout.size === 0) return;
    const viewedDates = timelineView === "daily" ? [timelineDate] : getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
    const info = tasks
      .filter((t) => conflictLayout.has(t.id))
      .map((t) => {
        const cl = conflictLayout.get(t.id)!;
        const top = timeBlockTop(t.scheduledStart || "09:00", dayStartHour);
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

  const visibleCandidates = (showCompletedCandidates ? [...todayEventCandidates, ...todayCandidates, ...completedCandidates] : [...todayEventCandidates, ...todayCandidates])
    .filter((task) => candidateProjectFilters.length === 0 || candidateProjectFilters.includes(String(task.projectId || "")));
  const candidateFilterActiveCount = candidateProjectFilters.length + (showCompletedCandidates ? 1 : 0);
  const toggleCandidateProjectFilter = (projectId: string) => {
    setCandidateProjectFilters((current) => current.includes(projectId)
      ? current.filter((id) => id !== projectId)
      : [...current, projectId]);
  };
  const headerTask = useMemo(
    () => timerTask || todayCandidates.find((task) => task.workflowStatus === "doing") || todayCandidates[0] || null,
    [timerTask, todayCandidates],
  );
  const headerProject = useMemo(
    () => headerTask?.projectId ? projects.find((project) => String(project.id) === String(headerTask.projectId)) || null : null,
    [headerTask, projects],
  );
  const executeStats = useMemo(() => {
    const planned = tasks.filter((task) => !task.completed && task.plannedForDate === today);
    const scheduled = planned.filter((task) =>
      (task.timelineRecords || []).some((r) => r.scheduledDate === today && r.executionStatus === "scheduled") ||
      Boolean(task.scheduledDate === today && task.scheduledStart) ||
      hasRecurrenceOccurrenceOnDate(task, today)
    );
    const scheduledHours = scheduled.reduce((sum, task) => {
      const active = (task.timelineRecords || []).find((r) => r.scheduledDate === today && r.executionStatus === "scheduled");
      if (active) return sum + clockTimeSpanMinutes(active.scheduledStart, active.scheduledEnd) / 60;
      if (task.scheduledDate === today && task.scheduledStart) {
        return sum + clockTimeSpanMinutes(task.scheduledStart, task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task))) / 60;
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
    const current = dataRef.current;
    if (!current) return;
    const existing = current.tasks.find((task) => task.id === taskId);
    const durationChanged = existing && patch.estimatedHours !== undefined && patch.estimatedHours !== existing.estimatedHours;
    const projectChanged = existing && Object.prototype.hasOwnProperty.call(patch, "projectId") && patch.projectId !== existing.projectId;
    const nextProfile = current.aiProfile || buildAiProfile(current);
    void saveData({
      ...current,
      aiProfile: {
        ...nextProfile,
        feedback: {
          ...nextProfile.feedback,
          durationCorrections: nextProfile.feedback.durationCorrections + (durationChanged ? 1 : 0),
          projectCorrections: nextProfile.feedback.projectCorrections + (projectChanged ? 1 : 0),
          assignmentUndos: nextProfile.feedback.assignmentUndos + (projectChanged && existing?.aiInference?.project && !patch.projectId ? 1 : 0),
        },
      },
      tasks: current.tasks.map((task) => task.id === taskId ? {
        ...task,
        ...patch,
        aiInference: task.aiInference ? {
          ...task.aiInference,
          ...(durationChanged && task.aiInference.duration ? { duration: { ...task.aiInference.duration, userOverridden: true } } : {}),
          ...(projectChanged && task.aiInference.project ? { project: { ...task.aiInference.project, userOverridden: true } } : {}),
        } : undefined,
        updatedAt: new Date().toISOString(),
      } : task)
    });
  }

  /** Delete a subtask by ID — uses dataRef.current to avoid stale-closure races. */
  function markSubtaskPlanned(subtasks: Subtask[] | undefined, subtaskId: string, plannedTaskId: string): Subtask[] {
    return (subtasks || []).map((subtask) => {
      const nested = subtask.subtasks ? markSubtaskPlanned(subtask.subtasks, subtaskId, plannedTaskId) : subtask.subtasks;
      if (subtask.id === subtaskId) return { ...subtask, plannedTaskId, subtasks: nested };
      return nested === subtask.subtasks ? subtask : { ...subtask, subtasks: nested };
    });
  }

  function beginCandidateSubtaskDrag(event: React.PointerEvent, parentTask: Task, subtaskId: string) {
    event.stopPropagation();
    const current = dataRef.current;
    const subtask = findSubtaskInTree(parentTask.subtasks || [], subtaskId);
    if (!current || !subtask) return;
    const existing = subtask.plannedTaskId
      ? current.tasks.find((item) => item.id === subtask.plannedTaskId)
      : current.tasks.find((item) => item.parentTaskId === parentTask.id && item.title === subtask.title && !item.completed);
    if (existing) {
      beginShelfDrag(event, existing, "candidate");
      return;
    }
    const now = new Date().toISOString();
    const plannedTask: Task = {
      ...parentTask,
      id: uid("task"),
      title: subtask.title,
      parentTaskId: parentTask.id,
      plannedForDate: today,
      executionLane: "candidate",
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      executionStatus: undefined,
      timelineRecords: [],
      recurrence: undefined,
      subtasks: [],
      completed: false,
      completedAt: undefined,
      order: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    const nextTasks = current.tasks.map((task) => (
      task.id === parentTask.id
        ? { ...task, subtasks: markSubtaskPlanned(task.subtasks, subtaskId, plannedTask.id), updatedAt: now }
        : task
    ));
    void saveData({ ...current, tasks: [...nextTasks, plannedTask] });
    beginShelfDrag(event, plannedTask, "candidate");
  }

  function reorderTodayCandidate(dragId: string, targetId: string, position: "before" | "after") {
    if (!dragId || !targetId || dragId === targetId) return;
    const current = dataRef.current;
    if (!current) return;
    const rendered = visibleCandidates.filter((task) => !isEventDisplayTask(task));
    const dragged = rendered.find((task) => task.id === dragId);
    if (!dragged) return;
    const without = rendered.filter((task) => task.id !== dragId);
    const targetIndex = without.findIndex((task) => task.id === targetId);
    if (targetIndex < 0) return;
    without.splice(position === "before" ? targetIndex : targetIndex + 1, 0, dragged);
    const nextOrder = new Map(without.map((task, index) => [task.id, index * 10]));
    const now = new Date().toISOString();
    void saveData({
      ...current,
      tasks: current.tasks.map((task) => (
        nextOrder.has(task.id)
          ? { ...task, order: nextOrder.get(task.id), updatedAt: now }
          : task
      )),
    });
  }

  function deleteSubtaskById(subtaskId: string) {
    const current = dataRef.current;
    if (!current) return;
    let found = false;
    const nextTasks = current.tasks.map((task) => {
      if (!findSubtaskInTree(task.subtasks || [], subtaskId)) return task;
      found = true;
      return { ...task, subtasks: removeSubtaskFromTree(task.subtasks || [], subtaskId), updatedAt: new Date().toISOString() };
    });
    if (!found) return;
    void saveData({ ...current, tasks: nextTasks });
  }

  /** Update a specific TimelineRecord by recordId. Finds the owning task. */
  function updateTimelineRecord(recordId: string, patch: Partial<TimelineRecord>) {
    if (!data) return;
    const sourceRecordId = resolveTimelineRecordId(recordId);
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const records = task.timelineRecords;
        if (!records) return task;
        const idx = records.findIndex((r) => r.id === sourceRecordId);
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
    const sourceRecordId = resolveTimelineRecordId(recordId);
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const records = task.timelineRecords;
        if ((!records || records.length === 0) && task.id === sourceRecordId && task.scheduledDate) {
          return {
            ...task,
            scheduledDate: undefined,
            scheduledStart: undefined,
            scheduledEnd: undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        if (!records) return task;
        const filtered = records.filter((r) => r.id !== sourceRecordId);
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
        ...calculateTimelineRecordEnd(occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart, duration),
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

  function toggleCandidateTaskDone(task: Task) {
    if (task.completed || isEventDisplayTask(task)) {
      toggleTaskDone(task.id);
      return;
    }
    if (completionHandlesRef.current.has(task.id)) return;

    setCompletingTaskIds((current) => new Set(current).add(task.id));
    completionHandlesRef.current.set(task.id, null);
    const handle = scheduleMotionCommit(() => {
      completionHandlesRef.current.delete(task.id);
      toggleTaskDone(task.id);
      setCompletingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }, MOTION.base);
    if (completionHandlesRef.current.has(task.id)) completionHandlesRef.current.set(task.id, handle);
  }

  function deleteTaskById(taskId: string) {
    if (!data) return;
    // Check if this is a recurrence occurrence
    const occurrenceMeta = parseRecurrenceOccurrenceId(taskId);
    if (occurrenceMeta) {
      const realTask = occurrenceToTaskMap.get(taskId);
      if (!realTask) return;
      // Cancel this occurrence instead of deleting the whole task
      const now = new Date().toISOString();
      void saveData({
        ...data,
        tasks: data.tasks.map((task) => {
          if (task.id !== realTask.id) return task;
          const records = task.timelineRecords || [];
          const hasExisting = records.some((record) => matchesOccurrence(record, occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart));
          return {
            ...task,
            timelineRecords: hasExisting
              ? records.map((record) =>
                  matchesOccurrence(record, occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart)
                    ? { ...record, executionStatus: "cancelled" as const }
                    : record
                )
              : [...records, createOccurrenceExceptionRecord(task, occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart, "cancelled")],
            updatedAt: now,
          };
        }),
      });
      showToast(t(lang, "toast.cancelledPlan"));
      return;
    }
    // Check if this is a timeline record
    const realTask = recordToTaskMap.get(taskId);
    if (realTask) {
      const sourceRecordId = resolveTimelineRecordId(taskId);
      // Delete the record and also check if we should delete the whole task
      deleteTimelineRecord(sourceRecordId);
      // If the task has no other records and is not a recurring task, delete the whole task
      const remainingRecords = (realTask.timelineRecords || []).filter((r) => r.id !== sourceRecordId);
      if (remainingRecords.length === 0 && !hasRecurringRule(realTask) && !realTask.plannedForDate) {
        void saveData({
          ...dataRef.current!,
          tasks: dataRef.current!.tasks.filter((t) => t.id !== realTask.id),
        });
      }
      showToast(t(lang, "candidate.deletedTask"));
      return;
    }
    // Regular task deletion
    void saveData({ ...data, tasks: data.tasks.filter((task) => task.id !== taskId) });
    showToast(t(lang, "candidate.deletedTask"));
  }

  function moveCandidateToPlanning(taskId: string) {
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      plannedForDate: undefined,
      executionLane: undefined,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      executionStatus: undefined,
      timelineRecords: [],
    });
    showToast(lang === "zh" ? "已移回 Planning" : "Moved back to Planning");
  }

  function applyTemplateToDate(slots: ScheduleTemplateApplySlot[], conflictCount: number) {
    const snapshot = dataRef.current;
    if (!snapshot || slots.length === 0) return;

    const createdTasks: Task[] = slots.map((slot) => {
      const durationMinutes = Math.max(clockTimeSpanMinutes(slot.start, slot.end), SLOT_MINUTES);
      const task = makeSmartTask({
        ...defaultForm("task"),
        title: slot.title,
        dueDate: timelineDate,
        estimatedHours: durationMinutes / 60,
      });

      return {
        ...task,
        plannedForDate: timelineDate,
        executionLane: undefined,
        timelineRecords: [createScheduledRecord(task, timelineDate, slot.start, durationMinutes)],
      };
    });

    void saveData({ ...snapshot, tasks: [...snapshot.tasks, ...createdTasks] });
    setScheduleTemplateOpen(false);

    if (createdTasks[0]?.timelineRecords?.[0]) {
      requestTimelineFocus({
        date: timelineDate,
        startTime: createdTasks[0].timelineRecords[0].scheduledStart,
        taskId: createdTasks[0].timelineRecords[0].id,
        source: "schedule",
      });
    }

    showToast(conflictCount > 0
      ? (lang === "zh" ? `已添加 ${createdTasks.length} 个时间块，含 ${conflictCount} 个重叠` : `Added ${createdTasks.length} blocks with ${conflictCount} overlaps`)
      : (lang === "zh" ? `已添加 ${createdTasks.length} 个模板时间块` : `Added ${createdTasks.length} template blocks`));
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

  function completeProject(projectId: string) {
    if (!data) return;
    const result = validateProjectCompletion(projectId, data.tasks);
    if (!result.ok) {
      showToast(lang === "zh" ? "请先完成项目下所有任务" : "Complete every task in this project first");
      return;
    }
    updateProject(projectId, { completed: true });
    showToast(lang === "zh" ? "项目已完成" : "Project completed");
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

  function togglePlanningTodayCandidate(taskId: string) {
    if (!data) return;
    const previous = data;
    const result = toggleTodayCandidate(data, taskId, today);
    if (result.action === "existing") return;
    void saveData(result.data);
    const notice = result.action === "added"
        ? (lang === "zh" ? "已加入今日候选" : "Added to today's candidates")
        : (lang === "zh" ? "已移回 Planning" : "Returned to Planning");
    window.setTimeout(() => showUndoToast(
      notice,
      lang === "zh" ? "撤销" : "Undo",
      () => void saveData(previous),
    ), 0);
  }

  function promotePlanningSubtask(parentTaskId: string, subtaskId: string) {
    if (!data) return;
    const previous = data;
    const result = promoteSubtaskToToday(data, parentTaskId, subtaskId, today, () => uid("task"));
    if (result.action === "existing") {
      showToast(lang === "zh" ? "该子任务已在今日候选中" : "This subtask is already in today's candidates");
      return;
    }
    void saveData(result.data);
    window.setTimeout(() => showUndoToast(
      lang === "zh" ? "子任务已加入今日候选" : "Subtask added to today's candidates",
      lang === "zh" ? "撤销" : "Undo",
      () => void saveData(previous),
    ), 0);
  }

  function quickAddTask() {
    if (!data || !quickTitle.trim()) return;
    let title = quickTitle;
    let targetDate = today;
    const yearMatch = quickTitle.match(/^\/(\d{4})\s+/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 2000 && year <= 2100) {
        title = quickTitle.replace(yearMatch[0], "").trim();
        const currentDateObj = new Date(`${selectedDate}T00:00:00`);
        const month = currentDateObj.getMonth();
        const day = Math.min(currentDateObj.getDate(), daysInMonth(year, month));
        targetDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        setSelectedDate(targetDate);
      }
    }
    if (!title.trim()) return;
    const task = makeSmartTask({
      ...defaultForm("task"),
      title,
      projectId: quickProjectId,
      dueDate: targetDate,
    });
    void saveData({ ...data, tasks: [...data.tasks, { ...task, plannedForDate: targetDate, executionLane: "candidate", order: Date.now() }] });
    void enrichTaskInBackground(task);
    setQuickTitle("");
    setQuickAddOpen(false);
    if ((settings?.onboardingVersion ?? 0) < 2 && settings?.onboardingStep === "add") {
      void saveSettings({ onboardingStep: "candidates" });
    }
    const inferredProject = !quickProjectId && task.projectId ? projects.find((project) => project.id === task.projectId) : undefined;
    if (inferredProject) {
      window.setTimeout(() => showUndoToast(
        lang === "zh" ? `已估时 ${Math.round((task.estimatedHours || 0.5) * 60)} 分钟，并归入「${inferredProject.title}」` : `Estimated ${Math.round((task.estimatedHours || 0.5) * 60)} min and assigned to “${inferredProject.title}”`,
        lang === "zh" ? "撤销归属" : "Undo assignment",
        () => updateTask(task.id, { projectId: undefined }),
      ), 0);
    } else {
      showToast(lang === "zh" ? `已加入今日候选 · 预计 ${Math.round((task.estimatedHours || 0.5) * 60)} 分钟` : `Added to today's candidates · ${Math.round((task.estimatedHours || 0.5) * 60)} min`);
    }
  }

  function finishMobileQuickAdd(more = false) {
    if (!data || !quickTitle.trim()) return;
    const title = quickTitle.trim();
    if (!more && mobileQuickAddKind === "task") {
      quickAddTask();
      return;
    }
    setQuickTitle("");
    setQuickAddOpen(false);
    if (more && mobileQuickAddKind !== "habit") {
      openAdd(mobileQuickAddKind === "project" ? "project" : "task", { quickAddDetail: mobileQuickAddKind === "task" });
      setForm((current) => ({ ...current, title, ...(mobileQuickAddKind === "project" ? { projectColor: quickProjectColor } : { projectId: quickProjectId }) }));
    } else if (mobileQuickAddKind === "project") {
      const project = makeProject({ ...defaultForm("project"), title, projectColor: quickProjectColor });
      void saveData({ ...data, projects: [...data.projects, project] });
      showToast(lang === "zh" ? "项目已创建" : "Project created");
    } else if (mobileQuickAddKind === "habit") {
      const now = new Date().toISOString();
      const habit: Habit = { id: uid("habit"), title, defaultDurationMinutes: mobileQuickHabitMinutes, frequencyRule: "daily", activeWeekdays: [1, 2, 3, 4, 5], order: Date.now(), createdAt: now, updatedAt: now };
      void saveData({ ...data, habits: [...(data.habits || []), habit] });
      if (more) {
        setEditingHabitId(habit.id);
        setHabitPanel("detail");
      } else showToast(lang === "zh" ? "习惯已创建" : "Habit created");
    }
  }

  /** Quick-add entry point used by the desktop widget (title comes from IPC). */
  function widgetQuickAdd(title: string) {
    if (!data || !title.trim()) return;
    const targetDate = today;
    const task = makeSmartTask({
      ...defaultForm("task"),
      title,
      projectId: "",
      dueDate: targetDate,
    });
    void saveData({ ...data, tasks: [...data.tasks, { ...task, plannedForDate: targetDate, executionLane: "candidate", order: Date.now() }] });
    void enrichTaskInBackground(task);
    showToast(t(lang, "toast.addedToCandidates"));
  }

  /** Build a WidgetSnapshot from the current live React state. */
  function buildWidgetSnapshot(): WidgetSnapshot {
    const snapshotNow = Date.now();
    const snapshotTasks = dataRef.current?.tasks || tasks;
    let selection = resolveWidgetTimelineSelection(snapshotTasks, snapshotNow);
    if (widgetTimerRuntime.mode === "countdown" && widgetTimerRuntime.running && widgetTimerRuntime.countdownTaskId && widgetTimerRuntime.countdownTargetAt && snapshotNow >= widgetTimerRuntime.countdownTargetAt) {
      const overrunTask = snapshotTasks.find((item) => item.id === widgetTimerRuntime.countdownTaskId);
      const overrunBounds = timelineRecordBounds(overrunTask, widgetTimerRuntime.countdownRecordId, widgetTimerRuntime.countdownTargetAt - 1);
      if (overrunTask && overrunBounds) selection = { task: overrunTask, ...overrunBounds, state: "active" };
    }
    const task = selection?.task;
    const project = task?.projectId ? projects.find((p) => String(p.id) === String(task.projectId)) || null : null;
    const widgetTimerTick = advanceWidgetTimer(widgetTimerRuntime, widgetTimerPreferences, snapshotNow);
    const taskTimerMatches = Boolean(task && timerTaskId === task.id);
    let timerDisplaySeconds = getWidgetTimerSnapshotDisplaySeconds(
      widgetTimerPreferences.mode,
      widgetTimerTick.displaySeconds,
      taskTimerMatches ? timerElapsedBaseRef.current : 0,
      taskTimerMatches && timerRunning,
      taskTimerMatches ? timerStartedAtRef.current : null,
      snapshotNow,
    );
    let timerPhase = widgetTimerTick.runtime.phase;
    if (selection?.state === "upcoming") {
      timerDisplaySeconds = Math.max(0, Math.ceil((selection.startAt - snapshotNow) / 1_000));
      timerPhase = "countdown";
    } else if (selection?.state === "active" && widgetTimerPreferences.mode === "countdown") {
      const sameCountdown = widgetTimerRuntime.countdownTaskId === task?.id
        && (!widgetTimerRuntime.countdownRecordId || widgetTimerRuntime.countdownRecordId === selection.recordId);
      const targetAt = sameCountdown && widgetTimerRuntime.countdownTargetAt
        ? widgetTimerRuntime.countdownTargetAt
        : selection.endAt;
      timerDisplaySeconds = Math.max(0, Math.ceil(Math.abs(targetAt - snapshotNow) / 1_000));
      timerPhase = snapshotNow >= targetAt ? "overrun" : "countdown";
    } else if (!selection) {
      timerDisplaySeconds = 0;
    }
    return {
      taskId: task?.id,
      taskTitle: task?.title || "",
      taskDueDate: task?.dueDate,
      taskScheduleRecordId: selection?.recordId,
      taskScheduleStartAt: selection?.startAt,
      taskScheduleEndAt: selection?.endAt,
      timelineState: selection?.state || "empty",
      taskProjectColor: project?.color,
      elapsedSeconds: timerElapsed,
      timerRunning: taskTimerMatches && timerRunning,
      candidateCount: todayCandidates.length,
      lang,
      alwaysOnTop: settings?.widgetAlwaysOnTop !== false,
      appearance: normalizeWidgetAppearance(settings?.widgetAppearance),
      appearanceConfigured: settings?.widgetAppearanceMigrated === true,
      theme: settings?.theme === "dark" ? "dark" : "light",
      timerPreferences: widgetTimerPreferences,
      timerRuntime: widgetTimerTick.runtime,
      timerDisplaySeconds,
      timerPhase,
      popoverOpen: widgetPopoverOpen,
    };
  }

  function syncActiveTaskScheduleFromTimer(actualEnd: number) {
    const currentData = dataRef.current;
    const runtime = widgetTimerRuntimeRef.current;
    if (!currentData || runtime.mode !== "countdown" || runtime.phase !== "overrun" || !runtime.countdownTaskId || !runtime.countdownTargetAt) return;
    const task = currentData.tasks.find((item) => item.id === runtime.countdownTaskId);
    const bounds = timelineRecordBounds(task, runtime.countdownRecordId, runtime.countdownTargetAt - 1);
    if (!task || !bounds) return;
    const extendedEnd = nextOverrunExtensionEnd(bounds.endAt, actualEnd);
    if (!extendedEnd) return;
    const updatedTask = extendActiveTimelineRecord(task, bounds.recordId, extendedEnd);
    if (updatedTask === task) return;
    void saveData({ ...currentData, tasks: currentData.tasks.map((item) => item.id === task.id ? updatedTask : item) });
  }

  /**
   * Process an action request relayed from the desktop widget. Reads the
   * latest state via refs so the handler stays correct even though the
   * IPC listener is registered once.
   */
  function handleWidgetAction(action: WidgetAction) {
    switch (action.type) {
      case "requestSnapshot":
        window.desktopApi?.widget?.pushSnapshot(buildWidgetSnapshot());
        break;
      case "quickAdd":
        widgetQuickAdd(action.title);
        break;
      case "timerStart":
        if (action.taskId) startTimer(action.taskId);
        else {
          const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], Date.now());
          if (selection?.state === "active") startTimer(selection.task.id);
        }
        break;
      case "timerPause":
        syncActiveTaskScheduleFromTimer(Date.now());
        pauseTimer();
        break;
      case "timerResume":
        resumeTimer();
        break;
      case "timerStop":
        syncActiveTaskScheduleFromTimer(Date.now());
        stopAndSaveTimer();
        break;
      case "complete":
        if (action.taskId) toggleTaskDone(action.taskId);
        else {
          const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], Date.now());
          if (selection?.state === "active") toggleTaskDone(selection.task.id);
        }
        break;
      case "setAlwaysOnTop":
        void window.desktopApi?.widget?.setAlwaysOnTop(action.enabled);
        void saveSettings({ widgetAlwaysOnTop: action.enabled });
        break;
      case "updateAppearance":
      case "updateWidgetAppearance":
        void saveSettings({
          widgetAppearance: normalizeWidgetAppearance({ ...settings?.widgetAppearance, ...action.patch }),
          widgetAppearanceMigrated: true,
        });
        break;
      case "setTimerMode": {
        const now = Date.now();
        const taskAction = getWidgetTimerModeChangeTaskAction(
          widgetTimerPreferences.mode,
          timerTaskRef.current,
          timerElapsedBaseRef.current,
          timerStartedAtRef.current,
          now,
        );
        if (taskAction?.type === "pause") pauseTimerAt(now);
        else if (widgetTimerRuntime.running && widgetTimerRuntime.mode !== "stopwatch") advanceWidgetTimerNow();
        widgetManagesTaskTimerRef.current = false;
        timerStartedAtRef.current = null;
        setTimerRunning(false);
        setTimerStartedAt(null);
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        const activeTask = selection?.task;
        const countdownTargetAt = action.mode === "countdown" ? selection?.endAt : undefined;
        const { preferences, runtime: transitionedRuntime } = createWidgetTimerModeTransition(
          action.mode,
          widgetTimerPreferences,
          now,
          countdownTargetAt,
        );
        let runtime: WidgetTimerRuntime = action.mode === "countdown" && activeTask && selection
          ? { ...transitionedRuntime, countdownTaskId: activeTask.id, countdownRecordId: selection.recordId }
          : transitionedRuntime;
        const scheduleEnd = selection?.endAt;
        if (action.mode === "pomodoro" && scheduleEnd && scheduleEnd > now) runtime = createDeadlineAlignedPomodoroRuntime(now, scheduleEnd, preferences);
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        widgetTimerRuntimeRef.current = runtime;
        setWidgetTimerRuntime(runtime);
        void saveSettings({ widgetTimerPreferences: preferences });
        break;
      }
      case "updateTimerPreferences": {
        const preferences = normalizeWidgetTimerPreferences({ ...widgetTimerPreferences, ...action.patch });
        void saveSettings({ widgetTimerPreferences: preferences });
        break;
      }
      case "saveTimerSettings": {
        const now = Date.now();
        const preferences = normalizeWidgetTimerPreferences(action.draft);
        if (preferences.mode !== widgetTimerRuntimeRef.current.mode && widgetTimerRuntimeRef.current.running) {
          syncActiveTaskScheduleFromTimer(now);
          if (widgetTimerRuntimeRef.current.mode === "stopwatch") pauseTimerAt(now);
          else advanceWidgetTimerNow();
          widgetManagesTaskTimerRef.current = false;
          timerStartedAtRef.current = null;
          setTimerRunning(false);
          setTimerStartedAt(null);
        }
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        const activeTask = selection?.task;
        const target = preferences.mode === "countdown"
          ? resolveWidgetCountdownTarget(activeTask?.dueDate, activeTask?.id, widgetTimerRuntimeRef.current, selection?.endAt)
          : undefined;
        let runtime: WidgetTimerRuntime = createWidgetTimerModeTransition(preferences.mode, preferences, now, target).runtime;
        const scheduleEnd = selection?.endAt;
        if (preferences.mode === "pomodoro" && scheduleEnd && scheduleEnd > now) runtime = createDeadlineAlignedPomodoroRuntime(now, scheduleEnd, preferences);
        if (preferences.mode === "countdown" && activeTask && selection) {
          runtime.countdownTaskId = activeTask.id;
          runtime.countdownRecordId = selection.recordId;
        }
        widgetTimerRuntimeRef.current = runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        setWidgetTimerRuntime(runtime);
        void saveSettings({ widgetTimerPreferences: preferences });
        break;
      }
      case "resetWidgetTimer": {
        const now = Date.now();
        const preferences = normalizeWidgetTimerPreferences(action.draft);
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        const activeTask = selection?.task;
        const target = preferences.mode === "countdown"
          ? resolveWidgetCountdownTarget(activeTask?.dueDate, activeTask?.id, widgetTimerRuntimeRef.current, selection?.endAt)
          : undefined;
        let runtime: WidgetTimerRuntime = createWidgetTimerModeTransition(preferences.mode, preferences, now, target).runtime;
        const scheduleEnd = selection?.endAt;
        if (preferences.mode === "pomodoro" && scheduleEnd && scheduleEnd > now) runtime = createDeadlineAlignedPomodoroRuntime(now, scheduleEnd, preferences);
        if (preferences.mode === "countdown" && activeTask && selection) {
          runtime.countdownTaskId = activeTask.id;
          runtime.countdownRecordId = selection.recordId;
        }
        widgetTimerRuntimeRef.current = runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        setWidgetTimerRuntime(runtime);
        break;
      }
      case "scheduleWidgetCountdown": {
        const duration = Math.round(action.durationMinutes);
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], Date.now());
        const activeTask = selection?.task;
        const currentData = dataRef.current;
        if (!activeTask || !currentData || !Number.isInteger(duration) || duration < 1 || duration > 1_440) break;
        const now = Date.now();
        const scheduled = scheduleWidgetCountdown(activeTask, new Date(now), duration);
        const record = createScheduledRecord(activeTask, scheduled.record.scheduledDate, scheduled.record.scheduledStart, duration);
        void saveData({ ...currentData, tasks: currentData.tasks.map((task) => task.id === activeTask.id ? { ...task, timelineRecords: [...(task.timelineRecords || []), record] } : task) });
        const runtime = { ...createWidgetTimerRuntime("countdown", now, { ...widgetTimerPreferences, mode: "countdown" }, scheduled.countdownTargetAt), running: false, pausedAt: now, countdownTaskId: activeTask.id, countdownRecordId: record.id };
        widgetTimerRuntimeRef.current = runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        setWidgetTimerRuntime(runtime);
        break;
      }
      case "toggleWidgetTimer": {
        const now = Date.now();
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        if (selection?.state !== "active") break;
        let current = widgetTimerRuntimeRef.current;
        if (current.mode === "stopwatch") {
          if (timerTaskRef.current && timerTaskRef.current !== selection.task.id) stopAndSaveTimer();
          const taskAction = getStopwatchTaskTimerAction(
            timerTaskRef.current === selection.task.id ? timerTaskRef.current : null,
            timerElapsedBaseRef.current,
            timerStartedAtRef.current,
            now,
          );
          if (taskAction.type === "pause") { syncActiveTaskScheduleFromTimer(now); pauseTimerAt(now); }
          else if (taskAction.type === "resume") resumeTimer();
          else startTimer(selection.task.id);
          const running = taskAction.type !== "pause";
          const runtime = { ...current, running, ...(running ? {} : { pausedAt: now }) };
          if (running) delete runtime.pausedAt;
          widgetManagesTaskTimerRef.current = false;
          widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime;
          setWidgetTimerRuntime(runtime);
          break;
        }
        if (current.mode === "countdown" && (current.countdownTaskId !== selection.task.id || current.countdownRecordId !== selection.recordId)) {
          current = {
            ...createWidgetTimerRuntime("countdown", now, widgetTimerPreferences, selection.endAt),
            running: false,
            pausedAt: now,
            countdownTaskId: selection.task.id,
            countdownRecordId: selection.recordId,
          };
        }
        if (current.running) {
          syncActiveTaskScheduleFromTimer(now);
          advanceWidgetTimerNow();
          const advanced = widgetTimerRuntimeRef.current;
          const runtime = { ...advanced, running: false, pausedAt: now };
          widgetManagesTaskTimerRef.current = false;
          timerStartedAtRef.current = null;
          setTimerRunning(false);
          setTimerStartedAt(null);
          widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime;
          setWidgetTimerRuntime(runtime);
        } else {
          if (current.mode === "countdown" && current.countdownTargetAt === undefined) break;
          const scheduleEnd = selection.endAt;
          const prepared = current.mode === "pomodoro" && scheduleEnd && scheduleEnd > now
            ? createDeadlineAlignedPomodoroRuntime(now, scheduleEnd, widgetTimerPreferences)
            : current;
          const runtime = { ...prepared, running: true };
          delete runtime.pausedAt;
          widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime;
          setWidgetTimerRuntime(runtime);
          widgetManagesTaskTimerRef.current = true;
          if (timerTaskRef.current !== selection.task.id) startTimer(selection.task.id);
          const countsAsWork = countsWidgetTimerPhaseAsWork(current.phase);
          timerElapsedBaseRef.current = timerElapsedRef.current;
          timerStartedAtRef.current = countsAsWork ? now : null;
          setTimerRunning(Boolean(timerTaskRef.current) && countsAsWork);
          setTimerStartedAt(Boolean(timerTaskRef.current) && countsAsWork ? now : null);
        }
        break;
      }
      case "resetPosition":
        void window.desktopApi?.widget?.setBounds({ x: 80, y: 80, width: 400, height: 80 });
        break;
    }
  }

  // Keep a ref to the latest action handler so the IPC listener (registered
  // once) always calls the current closure with up-to-date state.
  const widgetActionHandlerRef = useRef(handleWidgetAction);
  widgetActionHandlerRef.current = handleWidgetAction;
  const widgetSnapshotBuilderRef = useRef(buildWidgetSnapshot);
  widgetSnapshotBuilderRef.current = buildWidgetSnapshot;

  // Register the widget action listener once. Desktop-only.
  useEffect(() => {
    if (!window.desktopApi?.widget) return;
    const unsubscribe = window.desktopApi.widget.onAction((action) => {
      widgetActionHandlerRef.current(action);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!window.desktopApi?.widget) return;
    const interval = window.setInterval(() => window.desktopApi?.widget?.pushSnapshot(widgetSnapshotBuilderRef.current()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  // Push a fresh snapshot to the widget whenever relevant state changes so
  // the widget stays in sync without polling (timer ticks, task complete,
  // quick add, candidate changes). Throttled to avoid flooding on rapid
  // timer ticks (every second).
  useEffect(() => {
    if (!window.desktopApi?.widget) return;
    window.desktopApi.widget.pushSnapshot(buildWidgetSnapshot());
  }, [timerElapsed, timerRunning, timerTaskId, data, settings?.widgetAlwaysOnTop, settings?.widgetAppearance, settings?.widgetAppearanceMigrated, settings?.theme, widgetTimerPreferences, widgetTimerRuntime, widgetPopoverOpen, lang]);

  useEffect(() => {
    const running = widgetTimerPreferences.mode === "stopwatch" ? timerRunning : widgetTimerRuntime.running;
    if (running) syncActiveTaskScheduleFromTimer(Date.now());
  }, [timerElapsed, timerRunning, widgetTimerRuntime, widgetTimerPreferences.mode]);

  // Auto-open the widget on launch if the user opted in. Runs once.
  const widgetAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (widgetAutoOpenedRef.current) return;
    if (!window.desktopApi?.widget) return;
    if (settings?.widgetOpenOnLaunch !== true) return;
    if (settings?.featureWidgetEnabled === false) return;
    widgetAutoOpenedRef.current = true;
    void window.desktopApi.widget.open();
  }, [settings?.widgetOpenOnLaunch, settings?.featureWidgetEnabled]);

  // Apply always-on-top setting to an existing widget window when it changes.
  useEffect(() => {
    if (!window.desktopApi?.widget) return;
    if (settings?.widgetAlwaysOnTop === undefined) return;
    void window.desktopApi.widget.setAlwaysOnTop(settings.widgetAlwaysOnTop !== false);
  }, [settings?.widgetAlwaysOnTop]);

  useEffect(() => {
    if (!window.desktopApi?.compactWindow) return;
    if (settings?.compactWindowAlwaysOnTop === undefined) return;
    void window.desktopApi.compactWindow.setAlwaysOnTop(settings.compactWindowAlwaysOnTop !== false);
  }, [settings?.compactWindowAlwaysOnTop]);

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
    rememberLayerTrigger("drawer");
    setAddType("task");
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setForm({ ...defaultForm("task"), projectId, dueDate: today });
    setAdvancedOpen(false);
    setDrawerOpen(true);
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
      const durationMinutes = learnedTaskDurationMinutes(cleanTitle, data.tasks, projectId);
      const task = makeSmartTask({
        ...defaultForm("task"),
        title: cleanTitle,
        projectId,
        dueDate: timelineDate,
        estimatedHours: durationMinutes / 60
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
    const durationMinutes = learnedTaskDurationMinutes(cleanTitle, data.tasks, projectId);
    const endTime = addMinutes(quickSchedule.startTime, durationMinutes);
    const task = makeSmartTask({
      ...defaultForm("task"),
      title: cleanTitle,
      projectId,
      dueDate: timelineDate,
      estimatedHours: durationMinutes / 60
    });
    const scheduledRecord = createScheduledRecord(task, timelineDate, quickSchedule.startTime, durationMinutes);
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
    const estimatedMinutes = learnedTaskDurationMinutes(cleanTitle, data.tasks, pid || undefined);
    const task = makeSmartTask({ ...defaultForm("task"), title: cleanTitle, projectId: pid, dueDate: targetDate, estimatedHours: estimatedMinutes / 60 });
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
      const sourceRecordId = resolveTimelineRecordId(taskId);
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
                  r.id === sourceRecordId
                    ? { ...r, scheduledDate: targetDate, scheduledStart: "", scheduledEndDate: undefined, scheduledEnd: "" }
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

  function hasScheduleConflict(date: string, startTime: string, endTime: string, ignoreTaskId?: string) {
    const ignoredRecordId = ignoreTaskId ? recordByIdMap.get(ignoreTaskId)?.id : undefined;
    const ignoredEvent = ignoreTaskId ? resolveOwningEvent(ignoreTaskId) : undefined;
    return conflictTimelineTasks.some((task) => {
      const sameRecord = ignoredRecordId
        && (task.id === ignoredRecordId || task.id.startsWith(`${ignoredRecordId}__day__`));
      const sameEvent = ignoredEvent && task.id.startsWith(`event_occ_${ignoredEvent.id}_`);
      if (task.id === ignoreTaskId || sameRecord || sameEvent || !task.scheduledDate || !task.scheduledStart || !task.scheduledEnd) return false;
      return scheduledDateTimesOverlap(date, startTime, endTime, task.scheduledDate, task.scheduledStart, task.scheduledEnd);
    });
  }

  function findNextFreeSlot(duration: number) {
    const now = new Date();
    const earliest = clampSlot(Math.max(now.getHours() * 60 + now.getMinutes(), TIMELINE_START * 60));
    const latestStart = TIMELINE_END * 60 - duration;
    for (let cursor = earliest; cursor <= latestStart; cursor += SLOT_MINUTES) {
      const start = minutesToTime(cursor);
      const end = minutesToTime(cursor + duration);
      if (!hasScheduleConflict(today, start, end)) return start;
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

  function dailyTargetFromPointer(clientY: number) {
    const gridEl = timelineCanvasRef.current;
    if (!gridEl) return { date: timelineDate, startTime: "09:00", endTime: "09:15", dayIndex: 0, minutes: 9 * 60 };
    return dailyContinuousTargetFromContentY({
      contentY: clientY - gridEl.getBoundingClientRect().top,
      anchorDate: continuousTimelineStartDate,
      dayStartHour,
      dayCount: continuousTimelineBandCount,
      hourHeight: timelineHourHeight,
    });
  }

  function continuousDateOffset(date: string) {
    return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${continuousTimelineStartDate}T00:00:00`).getTime()) / 86400000);
  }

  function continuousTimedTop(date: string, startTime: string) {
    const offset = continuousDateOffset(date);
    const bandIndex = Math.floor(offset / timelineColumnCount);
    let minutesFromDayStart = timeToMinutes(startTime) - dayStartHour * 60;
    if (minutesFromDayStart < 0) minutesFromDayStart += 24 * 60;
    return bandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
  }

  function continuousPointerTarget(clientX: number, clientY: number, gridElement: HTMLElement) {
    const rect = gridElement.getBoundingClientRect();
    const columnWidth = rect.width / timelineColumnCount;
    const columnIndex = Math.min(Math.max(Math.floor((clientX - rect.left) / columnWidth), 0), timelineColumnCount - 1);
    const pxPerMinute = timelineSlotHeight / SLOT_MINUTES;
    const snappedFromTop = Math.min(
      continuousTimelineBandCount * 24 * 60 - SLOT_MINUTES,
      Math.max(0, Math.round(((clientY - rect.top) / pxPerMinute) / SLOT_MINUTES) * SLOT_MINUTES),
    );
    const bandIndex = Math.floor(snappedFromTop / (24 * 60));
    const minutesFromDayStart = snappedFromTop % (24 * 60);
    const minutes = (dayStartHour * 60 + minutesFromDayStart) % (24 * 60);
    const startTime = minutesToTime(minutes);
    return {
      date: addDays(continuousTimelineStartDate, bandIndex * timelineColumnCount + columnIndex),
      startTime,
      endTime: addMinutes(startTime, SLOT_MINUTES),
      dayIndex: columnIndex,
      minutes,
    };
  }

  function slotFromPointer(clientY: number, offsetMinutes = 0, clientX?: number) {
    const { gridEl, scrollEl, visDays } = getDropGridAndDays();
    if (!gridEl || !scrollEl) return "09:00";
    if (timelineView === "daily" && settings?.continuousCrossDayScroll !== false) {
      return minutesToTime(clampSlot(dailyTargetFromPointer(clientY).minutes - offsetMinutes));
    }
    const rect = gridEl.getBoundingClientRect();
    const target = pointerToDateTime({
      clientX: clientX ?? rect.left + rect.width / 2,
      clientY,
      gridElement: gridEl,
      scrollElement: scrollEl,
      visibleDays: visDays,
      startHour: dayStartHour,
      hourHeight: timelineHourHeight,
    });
    return minutesToTime(clampSlot(target.minutes - offsetMinutes));
  }

  /**
   * Unified pointer → {date, startTime} resolver for timeline drag/drop/resize.
   *
   * In continuous cross-day mode the date MUST come from the Y band index
   * (via `continuousPointerTarget`), never from `currentDate`/`timelineDate`.
   * In non-continuous mode the date comes from the X column via
   * `getDropTargetFromPointer`. Both paths return the snapped slot time.
   */
  function resolveDropTarget(clientX: number, clientY: number): { date: string; startTime: string; minutes: number } | null {
    const { gridEl, scrollEl, visDays } = getDropGridAndDays();
    if (!gridEl) return null;
    if (continuousTimelineEnabled) {
      const target = continuousPointerTarget(clientX, clientY, gridEl);
      return { date: target.date, startTime: target.startTime, minutes: target.minutes };
    }
    if (!scrollEl) return null;
    const target = getDropTargetFromPointer({
      clientX,
      clientY,
      gridElement: gridEl,
      scrollElement: scrollEl,
      visibleDays: visDays,
      startHour: dayStartHour,
      hourHeight: timelineHourHeight,
    });
    return { date: target.date, startTime: target.startTime, minutes: target.minutes };
  }

  /**
   * Subtract a pointer offset (in minutes) from a {date, time} pair, rolling
   * the date backwards when the subtraction crosses midnight. Used by drag to
   * keep the grabbed point under the cursor when the pointer sits near 00:00.
   */
  function subtractOffsetFromDateTime(date: string, time: string, offsetMinutes: number): { date: string; startTime: string } {
    let total = timeToMinutes(time) - offsetMinutes;
    let dayShift = 0;
    while (total < 0) {
      total += 24 * 60;
      dayShift -= 1;
    }
    const snapped = clampSlot(total);
    return { date: addDays(date, dayShift), startTime: minutesToTime(snapped) };
  }

  /**
   * Continuous absolute minutes (from `continuousTimelineStartDate`) for a
   * `{date, time}` point. Used by resize to compute durations across midnight
   * without the `end - start` negative-wrap bug.
   */
  function dateTimeToContinuousAbs(date: string, time: string): number {
    const offset = continuousDateOffset(date);
    return offset * 24 * 60 + timeToMinutes(time);
  }

  function pointerOutsideTimeline(clientX: number, clientY: number) {
    const rect = (timelineView === "3day" || timelineView === "weekly")
      ? timelineRef.current?.getBoundingClientRect()
      : timelineCanvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const scrollRect = timelineRef.current?.getBoundingClientRect();
    const compactLeftReturn = Boolean(compactLayout
      && scrollRect
      && clientX >= 0
      && clientX < rect.left
      && clientY >= scrollRect.top
      && clientY <= scrollRect.bottom);
    if (compactLeftReturn) return true;
    return clientX < rect.left - 80 || clientX > rect.right + 80 || clientY < rect.top - 40 || clientY > rect.bottom + 40;
  }

  function getScheduledEventsForRange(dateRange: string[]) {
    const visibleSet = new Set(dateRange);
    const explicitExpansion = expandTimelineRecords(visibleSet);
    const explicit = explicitExpansion.tasks.map((task) => ({
      id: task.id,
      taskId: explicitExpansion.ownerByDisplayId.get(task.id)?.id || task.id,
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
    const fixedEvents = events
      .filter((event) => dateRange.includes(event.startDate || event.date) && event.startTime && event.endTime)
      .map((event) => ({
        id: event.id,
        title: event.title,
        scheduledDate: event.startDate || event.date,
        scheduledStart: event.startTime,
        scheduledEnd: event.endTime,
      }));
    const externalEvents = expandExternalCalendarOccurrences(visibleSet).tasks
      .map((task) => ({
        id: task.id,
        title: task.title,
        scheduledDate: task.scheduledDate,
        scheduledStart: task.scheduledStart || "00:00",
        scheduledEnd: task.scheduledEnd || "23:59",
      }));
    return [...explicit, ...recurrence, ...fixedEvents, ...externalEvents];
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
      settings: {
        dayStart: settings?.scheduleDayStartTime || "08:00",
        dayEnd: settings?.dayEndTime || "22:00",
        bufferMinutes: settings?.scheduleBufferMinutes ?? 5,
        preferredStartHourByProject: data?.aiProfile?.preferredStartHourByProject || {},
        allowTaskSplitting: false,
      },
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
      ...calculateTimelineRecordEnd(scheduledDate, scheduledStart, durationMinutes),
      executionStatus: "scheduled",
      createdAt: now,
    };
  }

  function commitDragCreatedTask(state: NonNullable<DragCreateState>, title: string, projectId: string | null, subtasks: Subtask[] = [], openDetails = false) {
    const current = dataRef.current;
    if (!current) return;
    const { date, startMinutes, endMinutes } = state;
    const startTime = minutesToTime(startMinutes);
    const durationMinutes = endMinutes - startMinutes;
    const task = makeSmartTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: date, estimatedHours: durationMinutes / 60 });
    const scheduledRecord = createScheduledRecord(task, date, startTime, durationMinutes);
    void saveData({ ...current, tasks: [...current.tasks, { ...task, subtasks, plannedForDate: date, executionLane: undefined, timelineRecords: [scheduledRecord] }] });
    requestTimelineFocus({ date, startTime, taskId: scheduledRecord.id, source: "schedule" });
    revealResizeHandles(scheduledRecord.id);
    setDragCreate(null);
    if (openDetails) {
      setAddType("task");
      setEditingId(task.id);
      setEditingRecordId(scheduledRecord.id);
      setEditingOccurrence(null);
      setMobileTaskSummary(false);
      setForm({
        ...defaultForm("task"),
        title: task.title,
        projectId: task.projectId || "",
        dueDate: date,
        dueTime: startTime,
        endDate: date,
        endTime: scheduledRecord.scheduledEnd,
        category: task.category,
        priority: task.priority ?? "medium",
        importance: task.importance ?? null,
        urgency: task.urgency ?? null,
        estimatedHours: durationMinutes / 60,
      });
      setDrawerOpen(true);
    }
    showToast(t(lang, "timeline.addedToTimeline"));
  }

  function updateDragCreateRange(edge: "start" | "end", minutes: number) {
    setDragCreate((current) => {
      if (!current) return current;
      const snapped = Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
      let startMinutes = current.startMinutes;
      let endMinutes = current.endMinutes;
      if (edge === "start") startMinutes = Math.min(Math.max(snapped, TIMELINE_START * 60), endMinutes - SLOT_MINUTES);
      else endMinutes = Math.max(Math.min(snapped, TIMELINE_END * 60), startMinutes + SLOT_MINUTES);
      return {
        ...current,
        startMinutes,
        endMinutes,
        top: current.top + ((startMinutes - current.startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
        height: ((endMinutes - startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
      };
    });
  }

  function beginDragCreateResize(event: React.PointerEvent, edge: "start" | "end") {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const initial = dragCreate;
    if (!initial) return;
    const captureTarget = event.currentTarget;
    try { captureTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may already be captured. */ }
    dragCreateSuppressClickRef.current = true;
    const nativeEvent = event.nativeEvent;
    void import("./MobileTaskSummary").then(({ beginVerticalResize }) => beginVerticalResize(
      nativeEvent,
      timelineSlotHeight,
      (steps) => updateDragCreateRange(edge, (edge === "start" ? initial.startMinutes : initial.endMinutes) + steps * SLOT_MINUTES),
      () => window.setTimeout(() => { dragCreateSuppressClickRef.current = false; }, 80),
      captureTarget,
    ));
  }

  function createOccurrenceExceptionRecord(task: Task, scheduledDate: string, scheduledStart: string, executionStatus: TimelineRecord["executionStatus"]) {
    const end = calculateTimelineRecordEnd(
      scheduledDate,
      scheduledStart,
      task.recurrence?.durationMinutes || taskDuration(task),
    );
    return {
      id: `${task.id}_occ_${executionStatus}_${Date.now().toString(36)}`,
      taskId: task.id,
      scheduledDate,
      scheduledStart,
      ...end,
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
          scheduledDate: settings.allDay ? settings.date : undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          executionStatus: undefined,
          timelineRecords: filteredRecords,
          updatedAt: now,
        }
      : {
          ...task,
          plannedForDate: settings.date,
          executionLane: undefined,
          scheduledDate: undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          executionStatus: undefined,
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
    if (taskId.startsWith("habit:")) {
      scheduleHabitAt(taskId.slice("habit:".length), targetDate, startTime);
      setHoverSlot("");
      setDrag(null);
      dragTargetDateRef.current = "";
      return;
    }
    if (isEventDisplayTask(taskId)) {
      moveEventOccurrence(taskId, startTime, targetDate);
      setHoverSlot("");
      setDrag(null);
      dragTargetDateRef.current = "";
      return;
    }
    const allDayRecord = recordByIdMap.get(taskId);
    const allDayOwner = recordToTaskMap.get(taskId);
    if (allDayRecord && allDayOwner && !allDayRecord.scheduledStart && !allDayRecord.scheduledEnd) {
      moveTimelineRecord(taskId, startTime, targetDate, taskDuration(allDayOwner));
      requestTimelineFocus({ date: targetDate, startTime, taskId, source: "schedule" });
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
    if ((settings?.onboardingVersion ?? 0) < 2 && (settings?.onboardingStep === "drag" || settings?.onboardingStep === "schedule")) {
      void saveSettings({ onboardingStep: "calendar" });
    }
    setHoverSlot("");
    setDrag(null);
    dragTargetDateRef.current = "";
  }

  function toggleHabitDaily(habitId: string, completed: boolean) {
    const current = dataRef.current;
    if (!current) return;
    void saveData(toggleHabitCompletion(current, habitId, today, completed));
  }

  function toggleHabitForDate(habitId: string, date: string, completed: boolean) {
    const current = dataRef.current;
    if (!current) return;
    void saveData(toggleHabitCompletion(current, habitId, date, completed));
  }

  function scheduleHabitAt(habitId: string, date: string, startTime: string) {
    const current = dataRef.current;
    if (!current) return;
    const result = scheduleHabitRecord(current, habitId, date, startTime);
    void saveData(result.data);
    requestTimelineFocus({ date, startTime, taskId: result.recordId, source: "schedule" });
    showToast(lang === "zh" ? "习惯已安排" : "Habit scheduled");
  }

  function focusHabitSchedule(recordId: string) {
    const current = dataRef.current;
    if (!current) return;
    const owner = current.tasks.find((item) => (item.timelineRecords || []).some((record) => record.id === recordId));
    const record = owner?.timelineRecords?.find((item) => item.id === recordId);
    if (!owner || !record) return;
    setSelectedDate(record.scheduledDate);
    setTimelineView("daily");
    requestTimelineFocus({ date: record.scheduledDate, startTime: record.scheduledStart, taskId: record.id, source: "schedule" });
  }

  function openHabitDetail(habitId: string) {
    if (!settings || settings.featureHabitsEnabled === false) return;
    setEditingHabitId(habitId);
    setHabitPanel("detail");
  }

  function openHabitOverview() {
    if (!settings || settings.featureHabitsEnabled === false) return;
    setEditingHabitId(null);
    setHabitPanel("overview");
  }

  function createHabit() {
    if (!data) return;
    const now = new Date().toISOString();
    const habit: Habit = {
      id: uid("habit"),
      title: lang === "zh" ? "新习惯" : "New habit",
      defaultDurationMinutes: 20,
      frequencyRule: "daily",
      activeWeekdays: [1, 2, 3, 4, 5],
      order: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    void saveData({ ...data, habits: [...(data.habits || []), habit] });
    setEditingHabitId(habit.id);
    setHabitPanel("detail");
  }

  function saveHabitEdit(habitId: string, patch: Partial<Habit>) {
    if (!data) return;
    const next = updateHabit(data, habitId, patch);
    void saveData(next);
  }

  function toggleHabitArchive(habitId: string, archived: boolean) {
    if (!data) return;
    const next = archiveHabit(data, habitId, archived);
    void saveData(next);
    showToast(archived ? (lang === "zh" ? "习惯已归档" : "Habit archived") : (lang === "zh" ? "习惯已恢复" : "Habit restored"));
  }

  function unscheduleHabit(habitId: string, date: string) {
    if (!data) return;
    const next = unscheduleHabitRecord(data, habitId, date);
    void saveData(next);
    showToast(lang === "zh" ? "习惯已移回候选区" : "Habit moved back to candidates");
    setDrag(null);
    setHoverSlot("");
  }

  function habitScheduleFromTimelineTask(taskId: string): { habitId: string; date: string } | null {
    const current = dataRef.current;
    if (!current) return null;
    const sourceRecordId = resolveTimelineRecordId(taskId);
    const owner = current.tasks.find((task) =>
      task.id === sourceRecordId || (task.timelineRecords || []).some((record) => record.id === sourceRecordId)
    );
    if (!owner?.id.startsWith("habit-task-")) return null;
    const habit = (current.habits || []).find((item) => owner.id.startsWith(`habit-task-${item.id}-`));
    const date = owner.plannedForDate
      || owner.scheduledDate
      || owner.timelineRecords?.find((record) => record.id === sourceRecordId)?.scheduledDate
      || owner.timelineRecords?.[0]?.scheduledDate
      || today;
    return habit ? { habitId: habit.id, date } : null;
  }

  function returnTimelineTaskToCandidates(taskId: string, date = today) {
    const habitSchedule = habitScheduleFromTimelineTask(taskId);
    if (habitSchedule) {
      unscheduleHabit(habitSchedule.habitId, habitSchedule.date);
      return;
    }
    const current = dataRef.current;
    if (!current) return;
    void saveData(returnScheduledTaskToToday(current, resolveTimelineRecordId(taskId), date).data);
    showToast(t(lang, "toast.draggedBackToCandidates"));
    setDrag(null);
    setHoverSlot("");
  }

  function beginHabitDrag(event: React.PointerEvent, habit: Habit) {
    if (!settings || settings.featureHabitsEnabled === false) return;
    beginShelfDrag(event, habitDragTask(habit, timelineDate), "candidate", {
      allowCandidateReorder: false,
      onSchedule: (date, startTime) => scheduleHabitAt(habit.id, date, startTime),
    });
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
    const visDays = timelineView === "daily"
      ? dailyTimelineDates
      : getVisibleDays(timelineView === "weekly" ? "weekly" : timelineView === "3day" ? "3day" : "daily", timelineDate);
    if (timelineView === "3day" || timelineView === "weekly") {
      const gridEl = timeGridRef.current || document.querySelector('.df-time-grid');
      const scrollEl = timelineRef.current;
      return { gridEl: gridEl as HTMLElement | null, scrollEl, visDays };
    }
    return { gridEl: timelineCanvasRef.current, scrollEl: timelineRef.current, visDays };
  }

  /** Move a TimelineRecord to a new start time, preserving duration. */
  function moveTimelineRecord(recordId: string, newStart: string, newDate?: string, durationMinutes?: number) {
    if (!data) return;
    const sourceRecordId = resolveTimelineRecordId(recordId);
    const now = new Date().toISOString();
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const records = task.timelineRecords;
        if ((!records || records.length === 0) && task.id === sourceRecordId && task.scheduledStart) {
          // Cross-midnight spans (e.g. 23:30→00:30) must keep their 60m duration
          // instead of collapsing to a negative / wrap-broken value.
          const duration = clockTimeSpanMinutes(task.scheduledStart, task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task)));
          return {
            ...task,
            scheduledDate: newDate || task.scheduledDate,
            scheduledStart: newStart,
            scheduledEnd: addMinutes(newStart, duration),
            updatedAt: now,
          };
        }
        if (!records) return task;
        const idx = records.findIndex((r) => r.id === sourceRecordId);
        if (idx === -1) return task;
        const updated = [...records];
        updated[idx] = rescheduleTimelineRecord(
          updated[idx],
          newDate || updated[idx].scheduledDate,
          newStart,
          durationMinutes,
        );
        return { ...task, timelineRecords: updated, updatedAt: now };
      }),
    });
  }

  function moveEventOccurrence(occurrenceId: string, newStart: string, newDate?: string) {
    if (!data) return;
    const event = resolveOwningEvent(occurrenceId);
    if (!event) return;
    const duration = Math.max(calendarEventDurationMinutes(event), SLOT_MINUTES);
    const date = newDate || event.startDate || event.date;
    const nextEnd = calculateTimelineRecordEnd(date, newStart, duration);
    void saveData({
      ...data,
      events: data.events.map((item) => item.id === event.id ? {
        ...item,
        date,
        startDate: date,
        endDate: nextEnd.scheduledEndDate,
        startTime: newStart,
        endTime: nextEnd.scheduledEnd,
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

  function resizeEventOccurrence(occurrenceId: string, nextStartDate: string, nextStart: string, durationMinutes: number) {
    if (!data) return;
    const event = resolveOwningEvent(occurrenceId);
    if (!event) return;
    const duration = Math.max(durationMinutes, SLOT_MINUTES);
    const end = calculateTimelineRecordEnd(nextStartDate, nextStart, duration);
    void saveData({
      ...data,
      events: data.events.map((item) => item.id === event.id ? {
        ...item,
        date: nextStartDate,
        startDate: nextStartDate,
        startTime: nextStart,
        endDate: end.scheduledEndDate,
        endTime: end.scheduledEnd,
        recurrence: item.recurrence ? {
          ...item.recurrence,
          mode: "scheduled",
          startDate: nextStartDate,
          startTime: nextStart,
          durationMinutes: duration,
        } : item.recurrence,
      } : item),
    });
    showToast(t(lang, "toast.durationAdjusted"));
  }

  function beginBlockDrag(event: React.PointerEvent, task: Task) {
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读" : "External calendar events are read-only");
      return;
    }
    const isEvent = isEventDisplayTask(task);
    if (!isEvent && hasRecurringRule(resolveOwningTask(task) || task)) return;
    const target = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const owningRecord = recordByIdMap.get(task.id);
    const duration = owningRecord ? timelineRecordDurationMinutes(owningRecord) : taskDuration(task);
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetPx = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const offsetMinutes = Math.max(Math.round((offsetPx / timelineSlotHeight) * SLOT_MINUTES), 0);
    let active = false;
    let holdCancelled = false;
    let holdReady = !compactLayout || event.pointerType !== "touch";
    const holdTimer = holdReady ? undefined : window.setTimeout(() => {
      holdReady = true;
      target.classList.add("is-drag-armed");
      window.navigator.vibrate?.(8);
    }, 320);
    const clearHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      target.classList.remove("is-drag-armed");
    };
    const jumpDate = (tap: PointerEvent) => {
      if (!active || tap.pointerId === pointerId) return;
      const control = document.elementFromPoint(tap.clientX, tap.clientY)?.closest<HTMLElement>("[data-date],.df-compact-date-picker-trigger");
      const date = control?.dataset.date;
      if (date) {
        setSelectedDate(date);
        dragTargetDateRef.current = date;
        window.navigator.vibrate?.(6);
      } else if (control?.classList.contains("df-compact-date-picker-trigger")) setMobileDatePickerOpen(true);
    };
    suppressBlockClickRef.current = false;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= 8) {
          holdCancelled = true;
          clearHold();
        }
        return;
      }
      if (holdCancelled) return;
      if (!active && distance < 5) return;
      if (!active) {
        moveEvent.preventDefault();
        active = true;
        clearHold();
        target.classList.add("is-dragging");
        target.classList.add("is-dragging-source");
        document.body.classList.add("df-timeline-pointer-drag");
        suppressBlockClickRef.current = true;
        setDragCreate(null);
        const blockRect = rect;
        const offX = Math.min(Math.max(event.clientX - blockRect.left, 0), blockRect.width);
        const offY = Math.min(Math.max(event.clientY - blockRect.top, 0), blockRect.height);
        setDrag({
          taskId: task.id,
          kind: "block",
          source: "timeline",
          duration,
          offsetMinutes,
          pointer: { x: moveEvent.clientX, y: moveEvent.clientY },
          sourceRect: { width: blockRect.width, height: blockRect.height },
          offset: { x: offX, y: offY },
          outsideTimeline: pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY),
        });
      }
      setDragOverlayPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
      const outsideTimeline = pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY);
      setDrag((current) => current && current.taskId === task.id ? { ...current, pointer: { x: moveEvent.clientX, y: moveEvent.clientY }, outsideTimeline } : current);
      if (!outsideTimeline) {
        // Continuous cross-day mode MUST derive the date from the Y band index
        // (continuousPointerTarget), not from currentDate/X column. The offset
        // is subtracted in absolute time so dragging across midnight keeps the
        // grabbed point under the cursor instead of snapping back to day 0.
        const pointerTarget = resolveDropTarget(moveEvent.clientX, moveEvent.clientY);
        if (pointerTarget) {
          const adjusted = subtractOffsetFromDateTime(pointerTarget.date, pointerTarget.startTime, offsetMinutes);
          dragTargetDateRef.current = adjusted.date;
          setHoverSlot(adjusted.startTime);
        }
      } else {
        setHoverSlot("");
        dragTargetDateRef.current = "";
      }
    };
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
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
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
            window.removeEventListener("keydown", keydown);
            setDrag(null);
            setDragOverlay(null);
            setHoverSlot("");
            dragTargetDateRef.current = "";
            clearHold();
            target.classList.remove("is-dragging");
            target.classList.remove("is-dragging-source");
            document.body.classList.remove("df-timeline-pointer-drag");
            suppressClickAfterDrag();
            return;
          }
        }
        const leftPanel = document.querySelector(".df-candidate-panel")?.getBoundingClientRect();
        const droppedOnCandidatePanel = Boolean(leftPanel && upEvent.clientX >= leftPanel.left && upEvent.clientX <= leftPanel.right && upEvent.clientY >= leftPanel.top && upEvent.clientY <= leftPanel.bottom);
        const droppedOutsideTimeline = pointerOutsideTimeline(upEvent.clientX, upEvent.clientY);
        if (isEvent && droppedOnCandidatePanel) {
          makeEventCandidate(task.id, today);
        } else if (!isEvent && (droppedOnCandidatePanel || droppedOutsideTimeline)) {
          returnTimelineTaskToCandidates(task.id, today);
        } else if (isEvent && droppedOutsideTimeline) {
          // Outside the timeline but not over the candidate shelf: cancel the move.
        } else {
          // Same continuous-aware resolution as the move handler: date comes
          // from Y band in cross-day mode, offset subtracted in absolute time.
          const pointerTarget = resolveDropTarget(upEvent.clientX, upEvent.clientY);
          if (pointerTarget) {
            const adjusted = subtractOffsetFromDateTime(pointerTarget.date, pointerTarget.startTime, offsetMinutes);
            dragTargetDateRef.current = adjusted.date;
            if (isEvent) moveEventOccurrence(task.id, adjusted.startTime, adjusted.date);
            else moveTimelineRecord(task.id, adjusted.startTime, adjusted.date);
          } else {
            const nextStart = slotFromPointer(upEvent.clientY, offsetMinutes, upEvent.clientX);
            if (isEvent) moveEventOccurrence(task.id, nextStart);
            else moveTimelineRecord(task.id, nextStart);
          }
        }
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", jumpDate);
      setDrag(null);
      setDragOverlay(null);
      setDragOverlayTask(null);
      setHoverSlot("");
      dragTargetDateRef.current = "";
      clearHold();
      target.classList.remove("is-dragging");
      target.classList.remove("is-dragging-source");
      document.body.classList.remove("df-timeline-pointer-drag");
      if (active) suppressClickAfterDrag();
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", jumpDate);
      target.classList.remove("is-dragging");
      target.classList.remove("is-dragging-source");
      document.body.classList.remove("df-timeline-pointer-drag");
      setDrag(null);
      setDragOverlay(null);
      setDragOverlayTask(null);
      setHoverSlot("");
      dragTargetDateRef.current = "";
      clearHold();
      suppressBlockClickRef.current = false;
    };
    const keydown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") cancel(new PointerEvent("pointercancel", { pointerId }));
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("pointerdown", jumpDate);
  }

  function beginBlockResize(event: React.PointerEvent, task: Task, edge: "start" | "end") {
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读" : "External calendar events are read-only");
      return;
    }
    if (resizeHintTaskId !== resolveTimelineRecordId(task.id) && hoveredBlock !== task.id) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const pointerId = event.pointerId;
    suppressBlockClickRef.current = true;
    setDragCreate(null);
    document.body.classList.add("df-resizing");
    const owningEvent = isEventDisplayTask(task) ? resolveOwningEvent(task) : undefined;
    const owningRecord = recordByIdMap.get(task.id);
    const taskAnchorDate = owningEvent?.startDate || owningEvent?.date || owningRecord?.scheduledDate || task.scheduledDate || timelineWindowAnchorDate;
    const origStart = owningEvent?.startTime || owningRecord?.scheduledStart || task.scheduledStart || "09:00";
    const origDuration = owningEvent
      ? Math.max(calendarEventDurationMinutes(owningEvent), SLOT_MINUTES)
      : owningRecord
        ? Math.max(timelineRecordDurationMinutes(owningRecord), SLOT_MINUTES)
        : taskDuration(task);
    const initialEnd = calculateTimelineRecordEnd(taskAnchorDate, origStart, origDuration);
    setResizePreview({
      taskId: task.id,
      start: origStart,
      end: initialEnd.scheduledEnd,
      startDate: taskAnchorDate,
    });

    // Resize works in continuous absolute minutes (relative to
    // `continuousTimelineStartDate`) so that dragging the bottom handle past
    // midnight yields a 60m duration instead of clamping to the end of day.
    // The same math also works in non-continuous mode because the absolute
    // coordinate reduces to within-day minutes when the anchor == visible date.
    const startAbs = dateTimeToContinuousAbs(taskAnchorDate, origStart);
    const endAbs = startAbs + origDuration;

    const computeResize = (clientX: number, clientY: number): { nextStart: string; nextEnd: string; nextDuration: number; nextStartDate: string } => {
      const pointerTarget = resolveDropTarget(clientX, clientY);
      const fallbackSlot = slotFromPointer(clientY, 0, clientX);
      const pointerAbs = pointerTarget
        ? dateTimeToContinuousAbs(pointerTarget.date, pointerTarget.startTime)
        : startAbs + timeToMinutes(fallbackSlot) - timeToMinutes(origStart);
      if (edge === "start") {
        const newStartAbs = Math.min(pointerAbs, endAbs - SLOT_MINUTES);
        const newDuration = Math.max(SLOT_MINUTES, endAbs - newStartAbs);
        // addMinutes wraps mod 24h; if start moved backwards across midnight,
        // roll the scheduled date back by the number of crossed days.
        const dayShift = Math.floor((timeToMinutes(origStart) + (newStartAbs - startAbs)) / (24 * 60));
        const nextStart = addMinutes(origStart, newStartAbs - startAbs);
        const nextEnd = addMinutes(nextStart, newDuration);
        return { nextStart, nextEnd, nextDuration: newDuration, nextStartDate: addDays(taskAnchorDate, dayShift) };
      }
      const newEndAbs = Math.max(pointerAbs, startAbs + SLOT_MINUTES);
      const newDuration = Math.max(SLOT_MINUTES, newEndAbs - startAbs);
      const nextEnd = addMinutes(origStart, newDuration);
      return { nextStart: origStart, nextEnd, nextDuration: newDuration, nextStartDate: taskAnchorDate };
    };

    const cleanup = () => {
      document.body.classList.remove("df-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.setTimeout(() => {
        suppressBlockClickRef.current = false;
      }, 0);
    };
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const { nextStart, nextEnd, nextStartDate } = computeResize(moveEvent.clientX, moveEvent.clientY);
      setResizePreview({ taskId: task.id, start: nextStart, end: nextEnd, startDate: nextStartDate });
    };
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      if (!data) { cleanup(); return; }
      const { nextStart, nextEnd, nextDuration, nextStartDate } = computeResize(upEvent.clientX, upEvent.clientY);
      const durationHours = nextDuration / 60;
      const now = new Date().toISOString();
      if (isEventDisplayTask(task)) {
        resizeEventOccurrence(task.id, nextStartDate, nextStart, nextDuration);
        setResizePreview(null);
        cleanup();
        return;
      }
      // Start-edge resize may shift the scheduled date when the new start
      // crosses midnight backwards; end-edge resize keeps the start (and
      // therefore the date) fixed.
      const moveStartDate = edge === "start";
      const sourceRecordId = resolveTimelineRecordId(task.id);
      const nextData = {
        ...data,
        tasks: data.tasks.map((t) => {
          const records = t.timelineRecords;
          if ((!records || records.length === 0) && t.id === task.id) {
            return {
              ...t,
              scheduledStart: nextStart,
              scheduledEnd: nextEnd,
              scheduledDate: moveStartDate ? nextStartDate : t.scheduledDate,
              estimatedHours: durationHours,
              updatedAt: now,
            };
          }
          if (!records) return t;
          const idx = records.findIndex((r) => r.id === sourceRecordId);
          if (idx === -1) return t;
          const updated = [...records];
          updated[idx] = rescheduleTimelineRecord(
            updated[idx],
            moveStartDate ? nextStartDate : updated[idx].scheduledDate,
            nextStart,
            nextDuration,
          );
          return { ...t, timelineRecords: updated, estimatedHours: durationHours, updatedAt: now };
        }),
      };
      showToast(t(lang, "toast.durationAdjusted"));
      // Direct setData for immediate visual update, saveData for persistence
      dataRef.current = nextData;
      setData(nextData);
      saveData(nextData);
      setResizePreview(null);
      cleanup();
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      setResizePreview(null);
      cleanup();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  function rememberLayerTrigger(key: string) {
    const active = document.activeElement;
    if (active instanceof HTMLElement) layerTriggerRef.current.set(key, active);
  }

  function requestLayerClose(key: string, selectors: string, commit: () => void) {
    if (layerExitHandlesRef.current.has(key)) return;
    document.querySelectorAll<HTMLElement>(selectors).forEach((element) => element.classList.add("is-closing"));
    layerExitHandlesRef.current.set(key, null);
    const handle = scheduleMotionCommit(() => {
      layerExitHandlesRef.current.delete(key);
      commit();
      const trigger = layerTriggerRef.current.get(key);
      layerTriggerRef.current.delete(key);
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
    }, MOTION.fade);
    if (layerExitHandlesRef.current.has(key)) layerExitHandlesRef.current.set(key, handle);
  }

  function openAdd(type: AddType = "task", options?: { quickAddDetail?: boolean }) {
    rememberLayerTrigger("drawer");
    setAddType(type);
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setMobileTaskSummary(false);
    setQuickAddDetailOpen(Boolean(options?.quickAddDetail && type === "task"));
    setForm(defaultForm(type));
    setDrawerOpen(true);
  }

  function openTaskEdit(task: Task) {
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读；请在来源日历中修改" : "External calendar events are read-only; edit them in the source calendar");
      return;
    }
    if (suppressBlockClickRef.current) return;
    rememberLayerTrigger("drawer");
    const event = occurrenceToEventMap.get(task.id) || events.find((item) => task.id.startsWith(`event_occ_${item.id}_`));
    if (event) {
      revealResizeHandles(resolveTimelineRecordId(task.id));
      openEventEdit(event);
      return;
    }
    const realTask = resolveOwningTask(task) || task;
    const recordId = recordByIdMap.get(task.id)?.id;
    if (recordId) revealResizeHandles(resolveTimelineRecordId(task.id));
    const occurrence = parseRecurrenceOccurrenceId(task.id);
    setAddType("task");
    setEditingId(realTask.id);
    setEditingRecordId(recordId);
    setEditingOccurrence(occurrence ? {
      taskId: occurrence.taskId,
      scheduledDate: occurrence.scheduledDate,
      scheduledStart: occurrence.scheduledStart,
    } : null);
    setMobileTaskSummary(compactLayout);
    setForm({
      title: realTask.title,
      projectId: realTask.projectId || "",
      projectColor: DEFAULT_PROJECT_COLOR,
      dueDate: task.scheduledDate || realTask.dueDate || today,
      dueTime: task.scheduledStart || "",
      endDate: task.scheduledDate || realTask.dueDate || today,
      endTime: task.scheduledEnd || "",
      category: realTask.category,
      priority: realTask.priority ?? "medium",
      importance: realTask.importance ?? null,
      urgency: realTask.urgency !== undefined ? realTask.urgency : null,
      estimatedHours: realTask.estimatedHours || 0.5,
      details: realTask.notes || ""
    });
    setDrawerOpen(true);
  }

  function clearTimelineSelection() {
    if (!resizeHintTaskId && !drawerOpen) return false;
    setResizeHintTaskId("");
    if (drawerOpen && mobileTaskSummary) closeTaskDrawer({ autoSave: true });
    return true;
  }

  function selectTimelineTask(task: Task) {
    if (suppressBlockClickRef.current) return;
    if (!compactLayout) {
      openTaskEdit(task);
      return;
    }
    const taskId = resolveTimelineRecordId(task.id);
    if (resizeHintTaskId === taskId) {
      openTaskEdit(task);
      return;
    }
    revealResizeHandles(taskId);
  }

  function openProjectEdit(project: Project) {
    rememberLayerTrigger("drawer");
    setAddType("project");
    setEditingId(project.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setMobileTaskSummary(false);
    setForm({ ...defaultForm("project"), title: project.title, category: project.category, projectColor: project.color || categories[project.category].color, details: project.notes, importance: project.importance !== undefined ? project.importance : null, urgency: project.urgency !== undefined ? project.urgency : null });
    setDrawerOpen(true);
  }

  function openEventEdit(event: CalendarEvent) {
    rememberLayerTrigger("drawer");
    setAddType("event");
    setEditingId(event.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setMobileTaskSummary(false);
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
      const task = makeSmartTask(form);
      const durationMinutes = form.dueTime
        ? Math.max(
            form.endTime ? clockTimeSpanMinutes(form.dueTime, form.endTime) : Math.round((form.estimatedHours || 0.5) * 60),
            SLOT_MINUTES,
          )
        : 0;
      const createdTask = mode === "planning"
        ? { ...task, plannedForDate: undefined, executionLane: undefined }
        : form.dueTime
          ? { ...task, plannedForDate: form.dueDate, executionLane: undefined, timelineRecords: [createScheduledRecord(task, form.dueDate || today, form.dueTime, durationMinutes)] }
          : task;
      void saveData({ ...data, tasks: [...data.tasks, createdTask] });
      void enrichTaskInBackground(createdTask);
    } else if (addType === "project") {
      void saveData({ ...data, projects: [...data.projects, makeProject(form)] });
    } else {
      void saveData({ ...data, events: [...data.events, makeEvent(form)] });
    }
    requestLayerClose("drawer", ".df-drawer-backdrop, .df-drawer", () => {
      setEditingId("");
      setEditingRecordId(undefined);
      setEditingOccurrence(null);
      setForm(defaultForm("task"));
      setAddType("task");
      setMobileTaskSummary(false);
      setQuickAddDetailOpen(false);
      setDrawerOpen(false);
    });
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
    requestLayerClose("drawer", ".df-drawer-backdrop, .df-drawer", () => {
      setResizeHintTaskId("");
      setDrawerOpen(false);
      setEditingRecordId(undefined);
      setEditingOccurrence(null);
      setEditingId("");
      setForm(defaultForm("task"));
      setAddType("task");
      setMobileTaskSummary(false);
      setQuickAddDetailOpen(false);
    });
  }

  function deleteEditingItem() {
    if (!dataRef.current || !editingId) return;
    const current = dataRef.current;
    if (addType === "task") void saveData({ ...current, tasks: current.tasks.filter((task) => task.id !== editingId) });
    if (addType === "project") void saveData({ ...current, projects: current.projects.filter((project) => project.id !== editingId) });
    if (addType === "event") void saveData({ ...current, events: current.events.filter((event) => event.id !== editingId) });
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

  async function convertTaskToEvent(taskId: string) {
    if (!data) return;
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (!await dialog.confirm(t(lang, "confirm.convertTaskToEvent"))) return;
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
      ...dataRef.current!,
      tasks: dataRef.current!.tasks.filter((item) => item.id !== task.id),
      events: [...dataRef.current!.events, event],
    });
    setEditingId(event.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setAddType("event");
    setForm({ ...defaultForm("event"), title: event.title, dueDate: event.startDate || event.date, endDate: event.endDate || event.date, dueTime: event.startTime || "", endTime: event.endTime || "", category: event.category, details: event.details, recurrence: event.recurrence });
    showToast(t(lang, "toast.convertedToEvent"));
  }

  async function convertEventToTask(eventId: string) {
    if (!data) return;
    const event = data.events.find((item) => item.id === eventId);
    if (!event) return;
    if (!await dialog.confirm(t(lang, "confirm.convertEventToTask"))) return;
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
    const convertedRecord = task.timelineRecords?.[0];
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
      projectColor: DEFAULT_PROJECT_COLOR,
      dueDate: task.dueDate,
      dueTime: convertedRecord?.scheduledStart || "",
      endDate: convertedRecord?.scheduledEndDate || task.dueDate,
      endTime: convertedRecord?.scheduledEnd || "",
      category: task.category,
      priority: task.priority ?? "medium",
      importance: task.importance ?? null,
      urgency: task.urgency !== undefined ? task.urgency : null,
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

  function applyAgentClientActions(agent?: AgentRunState) {
    for (const command of agent?.clientActions || []) {
      if (command.entity === "timer") {
        if (command.operation === "pause") pauseTimer();
        else if (command.operation === "start" && command.targetId && dataRef.current?.tasks.some((item) => item.id === command.targetId)) startTimer(command.targetId);
        continue;
      }
      if (command.entity !== "app" || command.operation !== "navigate") continue;
      const values = command.values || {};
      if (values.mode === "execute" || values.mode === "planning") setModeState(values.mode);
      if (values.view === "daily" || values.view === "3day" || values.view === "weekly" || values.view === "month") setTimelineView(values.view);
      if (typeof values.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(values.date)) setSelectedDate(values.date);
      if (command.targetId && dataRef.current?.tasks.some((item) => item.id === command.targetId)) {
        const target = dataRef.current.tasks.find((item) => item.id === command.targetId)!;
        setSelectedDate(target.scheduledDate || target.dueDate || todayIso());
        setModeState("execute");
      }
    }
  }

  async function sendAi(messageOverride?: string, trigger: "manual" | "start_brief" | "end_review" = "manual") {
    if (!(messageOverride ?? aiInput).trim() && !aiAttachment) return false;
    if (!data) return false;
    if (!authStateRef.current?.user || authStateRef.current.mode !== "cloud") {
      showToast(lang === "zh" ? "全局 AI 需要先登录云端账号" : "Sign in to use the global AI agent");
      return false;
    }
    const msg = (messageOverride ?? aiInput).trim() || "解析附件中的任务和事件";
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
      steps: [
        { label: aiAttachment ? (lang === "zh" ? "读取引用文件" : "Reading attachment") : (lang === "zh" ? "理解请求" : "Understanding request"), status: "running" },
        { label: lang === "zh" ? "核对当前计划" : "Checking current plan", status: "pending" },
        { label: lang === "zh" ? "整理任务安排" : "Preparing task schedule", status: "pending" },
      ],
    };
    setAiMessages((current) => [...current, userMessage, assistantMessage]);
    setAiInput("");
    setAiBusy(true);
    setAiMemoryNotice("");
    clearAiAttachment();

    const dataForHistory = dataRef.current || data;
    const conversationsBefore = dataForHistory.aiConversations || [];
    const conversationId = activeAiConversationId || dataForHistory.activeAiConversationId || conversationsBefore[0]?.id || uid("conversation");
    if (!activeAiConversationId) setActiveAiConversationId(conversationId);

    let thinkingStage = 0;
    const requestController = new AbortController();
    aiAbortRef.current?.abort();
    aiAbortRef.current = requestController;
    const thinkingTimer = window.setInterval(() => {
      thinkingStage = Math.min(thinkingStage + 1, 2);
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        steps: (message.steps || []).map((step, index) => ({ ...step, status: index < thinkingStage ? "done" : index === thinkingStage ? "running" : "pending" })),
      } : message));
    }, 1800);
    try {
      await flushPendingSave({ urgent: true });
      await flushPendingSettings({ urgent: true });
      if (trigger !== "manual") await refreshExternalCalendarLayer("force");
      const result = await callAiAssistant({
        mode: "agent",
        model: settings?.model,
        reasoningMode: settings?.reasoningMode || "instant",
        message: msg,
        attachmentText: aiAttachment?.text,
        attachmentName: aiAttachment?.name,
        context: {
          currentViewDate: selectedDate || today,
          page: mode,
          language: settings?.language || lang,
          timerStatus: { taskId: timerTaskId || "", running: timerRunning, elapsedSeconds: timerElapsed },
        },
        conversationId,
        trigger,
        signal: requestController.signal,
      });
      if (!result.ok) {
        setAiInput((current) => current || msg);
        setAiMessages((current) => current.map((message) => message.id === assistantId ? {
          ...message,
          status: "error",
          content: result.error.message,
          steps: [{ label: result.error.message, status: "error" }],
        } : message));
        return false;
      }
      const validActions = (result.actions || [])
        .map((action) => action.type === "import_schedule_item" ? { ...action, kind: "task" as const } : action)
        .filter(isValidAiAction);
      const agent = result.agent ? {
        ...result.agent,
        decisionState: result.agent.pending.length ? "pending" as const : result.agent.decisionState,
      } : undefined;
      if ((agent?.applied.length || 0) > 0) {
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      }
      applyAgentClientActions(agent);
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        status: "done",
        content: result.reply,
        steps: result.steps && result.steps.length > 0 ? result.steps : [{ label: "已生成安排", status: "done" }],
        actions: validActions,
        selectedActions: Object.fromEntries(validActions.map((_, index) => [index, true])),
        actionState: validActions.length ? "pending" : undefined,
        intent: result.intent,
        plan: result.plan,
        format: result.format || "text",
        agent,
      } : message));
      const currentData = dataRef.current;
      if (currentData) {
        const assistantChat = {
          id: assistantId,
          role: "assistant" as const,
          content: result.reply,
          createdAt: new Date().toISOString(),
          saved: true,
          status: "done" as const,
          steps: result.steps && result.steps.length > 0 ? result.steps : [{ label: lang === "zh" ? "安排已生成" : "Schedule prepared", status: "done" as const }],
          actions: validActions,
          selectedActions: Object.fromEntries(validActions.map((_, index) => [index, true])),
          actionState: validActions.length ? "pending" as const : undefined,
          intent: result.intent,
          plan: result.plan,
          format: result.format || "text" as const,
          agent,
        };
        const userChat = { id: userMessage.id, role: "user" as const, content: msg, createdAt: userMessage.createdAt, saved: true };
        const conversations = currentData.aiConversations || [];
        let nextConversations = conversations;
        nextConversations = nextConversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const nextMessages = [...(conversation.messages || []), userChat, assistantChat].slice(-80);
          return {
            ...conversation,
            title: conversation.messages.length === 0 || conversation.title === "新对话" ? aiConversationTitle(msg) : conversation.title,
            messages: nextMessages,
            updatedAt: assistantChat.createdAt,
          };
        });
        if (!nextConversations.some((conversation) => conversation.id === conversationId)) {
          nextConversations = [{ ...makeAiConversation(aiConversationTitle(msg)), id: conversationId, messages: [userChat, assistantChat], updatedAt: assistantChat.createdAt }, ...nextConversations];
        }
        const activeConversation = nextConversations.find((conversation) => conversation.id === conversationId);
        const nextChat = (activeConversation?.messages || []).slice(-40);
        const memoryPatches = [...extractLocalMemories(msg), ...(result.memories || [])];
        const nextMemories = settingsRef.current?.aiMemoryEnabled === false
          ? currentData.aiMemories || []
          : mergeAiMemories(currentData, memoryPatches, "auto");
        if (memoryPatches.length > 0 && settingsRef.current?.aiMemoryEnabled !== false) {
          const savedCount = Math.min(memoryPatches.length, 4);
          setAiMemoryNotice(lang === "zh" ? `已记住 ${savedCount} 条偏好` : `Saved ${savedCount} memory item${savedCount === 1 ? "" : "s"}`);
        }
        await saveData({ ...currentData, chat: nextChat, aiConversations: nextConversations, activeAiConversationId: conversationId, aiMemories: nextMemories });
        if (agent?.pending.length) showToast(lang === "zh" ? `有 ${agent.pending.length} 项操作等待确认` : `${agent.pending.length} action(s) need confirmation`);
        else if (agent?.applied.length) showToast(lang === "zh" ? `AI 已执行 ${agent.applied.length} 项操作，可在 24 小时内撤销` : `AI applied ${agent.applied.length} action(s); undo is available for 24 hours`);
      }
      return true;
    } catch (error) {
      setAiInput((current) => current || msg);
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        status: "error",
        content: error instanceof Error ? error.message : "网络异常，请稍后重试。",
        steps: [{ label: "请求失败", status: "error" }],
      } : message));
      return false;
    } finally {
      window.clearInterval(thinkingTimer);
      if (aiAbortRef.current === requestController) aiAbortRef.current = null;
      setAiBusy(false);
    }
  }

  useEffect(() => {
    if (!settings?.aiBriefsEnabled || !authState?.user) return;
    const check = async () => {
      if (briefAutomationBusyRef.current || aiBusy) return;
      const now = new Date();
      const date = localIsoDate(now);
      const minutes = now.getHours() * 60 + now.getMinutes();
      const kind = nextDueAiBrief({ date, minutes, startTime: settings.aiStartBriefTime, endTime: settings.aiEndBriefTime, lastStartDate: settings.aiLastStartBriefDate, lastEndDate: settings.aiLastEndReviewDate });
      if (!kind) return;
      const attemptKey = `${kind}:${date}`;
      if (briefAttemptedRef.current.has(attemptKey)) return;
      briefAttemptedRef.current.add(attemptKey);
      briefAutomationBusyRef.current = true;
      try {
        setAiOpen(true);
        const prompt = kind === "start"
          ? (lang === "zh" ? "请生成今天的开工简报：结合完整工作区、截止日期、已排程内容和外部日历忙碌时间，总结三项重点、首个行动和一项风险。简报只读，不执行任何操作。" : "Generate today's start brief using the full workspace, deadlines, schedule, and external calendar busy time. Give three priorities, the first action, and one risk. This brief is read-only; execute no actions.")
          : (lang === "zh" ? "请生成今天的收工复盘：结合完整工作区、完成情况、计时记录和排程偏差，总结进展并给出明天的一项调整建议。复盘只读，不执行任何操作。" : "Generate today's end-of-day review using the full workspace, completion state, timer records, and schedule variance. Summarize progress and suggest one adjustment for tomorrow. This review is read-only; execute no actions.");
        const success = await sendAi(prompt, kind === "start" ? "start_brief" : "end_review");
        if (success) await saveSettings(kind === "start" ? { aiLastStartBriefDate: date } : { aiLastEndReviewDate: date });
        else showToast(lang === "zh" ? "简报生成失败，可在 AI 抽屉中重试" : "Brief generation failed; retry from the AI drawer");
      } finally {
        briefAutomationBusyRef.current = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(interval);
  }, [authState?.user?.id, aiBusy, lang, settings?.aiBriefsEnabled, settings?.aiStartBriefTime, settings?.aiEndBriefTime, settings?.aiLastStartBriefDate, settings?.aiLastEndReviewDate]);

  function openDailyAiPrompt(kind: "start" | "review") {
    setAiInput(kind === "start"
      ? (lang === "zh" ? "请结合今日容量、截止日期和我的常用执行时段，给我一份简短的开工简报：三项重点、首个行动和一项风险。" : "Give me a short start-of-day brief using today's capacity, deadlines, and my preferred work hours: three priorities, the first action, and one risk.")
      : (lang === "zh" ? "请结合今天的计划、完成情况和计时记录做收工复盘：总结进展、识别偏差，并给出明天的一个调整建议。" : "Review my day using the plan, completions, and timer history: summarize progress, identify variance, and suggest one adjustment for tomorrow."));
    setAiOpen(true);
  }

  function cancelAi() {
    aiAbortRef.current?.abort();
  }

  async function toggleAiAuditHistory() {
    if (aiAuditOpen) {
      setAiAuditOpen(false);
      return;
    }
    setAiConversationListOpen(false);
    setAiAuditOpen(true);
    setAiAuditLoading(true);
    setAiAuditError("");
    try {
      setAiAuditRuns(await listAgentAuditRuns());
    } catch (error) {
      setAiAuditError(error instanceof Error ? error.message : (lang === "zh" ? "暂时无法读取审计记录" : "Could not load audit history"));
    } finally {
      setAiAuditLoading(false);
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

  async function startNewAiConversation() {
    if (!data) return;
    const conversation = makeAiConversation();
    const nextConversations = [conversation, ...(data.aiConversations || [])];
    setActiveAiConversationId(conversation.id);
    setAiMessages([]);
    setAiConversationListOpen(false);
    setAiMemoryNotice("");
    setAiActionPatches({});
    await saveData({ ...data, aiConversations: nextConversations, activeAiConversationId: conversation.id, chat: [] });
  }

  function selectAiConversation(conversationId: string) {
    if (!data) return;
    const conversation = (data.aiConversations || []).find((item) => item.id === conversationId);
    if (!conversation) return;
    setActiveAiConversationId(conversation.id);
    setAiMessages(chatToSessionMessages(conversation.messages || []));
    setAiConversationListOpen(false);
    setAiMemoryNotice("");
    setAiActionPatches({});
    void saveData({ ...data, activeAiConversationId: conversation.id, chat: (conversation.messages || []).slice(-40) });
  }

  async function adoptSelectedAiActions(messageId: string) {
    const currentData = dataRef.current;
    if (!currentData) return;
    const message = aiMessages.find((item) => item.id === messageId);
    const patches = aiActionPatches[messageId] || {};
    const selected = (message?.actions || [])
      .map((action, index) => ({ ...action, ...(patches[index] || {}) } as AiAction))
      .filter((_, index) => message?.selectedActions?.[index] !== false);
    if (selected.length === 0) return;
    const now = new Date().toISOString();
    const nextTasks = [...currentData.tasks];
    const nextEvents = [...currentData.events];
    const addedTaskIds: string[] = [];
    const addedEventIds: string[] = [];
    const previousTasks: Task[] = [];
    let focus: TimelineFocusTarget | undefined;
    for (const action of selected) {
      if (action.type === "create_subtasks" && action.taskId && action.subtasks?.length) {
        const index = nextTasks.findIndex((task) => task.id === action.taskId);
        if (index !== -1) {
          if (!previousTasks.some((task) => task.id === nextTasks[index].id)) previousTasks.push(nextTasks[index]);
          nextTasks[index] = {
            ...nextTasks[index],
            subtasks: appendAiSubtasks(nextTasks[index].subtasks, action.subtasks, () => uid("subtask"), now),
            updatedAt: now,
          };
        }
        continue;
      }
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
          const projectId = projects.some((project) => project.id === a.projectId) ? a.projectId : undefined;
          const learnedDuration = learnedTaskDurationMinutes(action.title, nextTasks, projectId);
          const recurrence = normalizeAiRecurrence(a.recurrence, a.date, a.startTime, a.durationMinutes);
          const duration = Number(a.durationMinutes) || (a.startTime && a.endTime ? clockTimeSpanMinutes(a.startTime, a.endTime) : learnedDuration);
          const task: Task = {
            ...makeSmartTask({ ...defaultForm("task"), title: action.title, projectId: projectId || "", dueDate: a.date, estimatedHours: Math.max(duration, 15) / 60 }),
            category: validCategory(a.category), priority: validPriority(a.priority), notes: a.notes || "",
            recurrence, createdAt: now, updatedAt: now,
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
        const projectId = projects.some((project) => project.id === a.projectId) ? a.projectId : undefined;
        const duration = Math.max(Number(a.durationMinutes) || learnedTaskDurationMinutes(action.title, nextTasks, projectId), 15);
        const startTime = a.start || "09:00";
        const date = a.date || today;
        const task: Task = {
          ...makeSmartTask({ ...defaultForm("task"), title: action.title, projectId: projectId || "", dueDate: date, estimatedHours: duration / 60 }),
          importance: "medium", urgency: "medium", notes: a.reason || "", goalId: "",
          scheduledDate: date, scheduledStart: startTime,
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
    await saveData({ ...currentData, tasks: nextTasks, events: nextEvents });
    setAiMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionState: "adopted", actions: [], importCommit: { focus, addedCount: selected.length, addedTaskIds, addedEventIds, previousTasks } } : item));
    persistAiMessage(messageId, { actionState: "adopted", actions: [] });
    setAiActionPatches((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  }

  function rejectSelectedAiActions(messageId: string) {
    setAiMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionState: "rejected", actions: [] } : item));
    persistAiMessage(messageId, { actionState: "rejected", actions: [] });
  }

  function handleTimelinePanelWheel(event: React.WheelEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true],.df-drawer,.df-utility-panel,.df-project-popover-portal")) return;
    const scrollElement = timelineView === "month" ? monthScrollRef.current : timelineRef.current;
    if (!scrollElement) return;
    const insideScroll = scrollElement.contains(target);

    if (insideScroll) return;

    const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    if (maxScroll <= 0) return;
    scrollElement.scrollTop = Math.min(maxScroll, Math.max(0, scrollElement.scrollTop + event.deltaY));
  }

  function beginShelfDrag(event: React.PointerEvent, task: Task, source: "candidate" | "allDay", options: CandidateDragOptions = {}) {
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读" : "External calendar events are read-only");
      return;
    }
    const target = event.target as HTMLElement;
    const interactiveTarget = target.closest("button,input,textarea,select,a");
    if (event.button !== 0 || (interactiveTarget && !target.closest(".icon-schedule"))) return;
    if (isEventDisplayTask(task) || hasRecurringRule(resolveOwningTask(task) || task)) return;
    const pointerId = event.pointerId;
    const dragElement = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const duration = taskDuration(task);
    let active = false;
    let holdCancelled = false;
    // Candidate rows live inside a scroll container on every touch layout.
    // Require a hold before dragging so an ordinary vertical swipe remains a
    // native list scroll in both portrait and landscape orientations.
    let holdReady = !(source === "candidate" && event.pointerType === "touch");
    const holdTimer = holdReady ? undefined : window.setTimeout(() => {
      holdReady = true;
      dragElement.classList.add("is-drag-armed");
      window.navigator.vibrate?.(8);
    }, CANDIDATE_TOUCH_HOLD_MS);
    const clearHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      dragElement.classList.remove("is-drag-armed");
    };
    let dropTime = "";
    let candidateTarget: CandidateDropTarget = null;
    const jumpDate = (tap: PointerEvent) => {
      if (!active || tap.pointerId === pointerId) return;
      const control = document.elementFromPoint(tap.clientX, tap.clientY)?.closest<HTMLElement>("[data-date],.df-compact-date-picker-trigger");
      const date = control?.dataset.date;
      if (date) { setSelectedDate(date); dragTargetDateRef.current = date; window.navigator.vibrate?.(6); }
      else if (control?.classList.contains("df-compact-date-picker-trigger")) setMobileDatePickerOpen(true);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", jumpDate);
      document.body.classList.remove("df-timeline-pointer-drag");
      dragElement.classList.remove("is-dragging-source");
      setDrag(null);
      setDragOverlay(null);
      setDragOverlayTask(null);
      setActiveDragItem(null);
      setHoverSlot("");
      setAllDayDragOver(false);
      setAllDayDragDate("");
      setCandidateDropActive(false);
      setCandidatePlanningReturnActive(false);
      setCandidateDropTarget(null);
      dragTargetDateRef.current = "";
      clearHold();
      if (dragElement.hasPointerCapture(pointerId)) dragElement.releasePointerCapture(pointerId);
      if (active) suppressClickAfterDrag();
    };
    const updateTarget = (pointerEvent: PointerEvent) => {
      const returnToPlanning = compactLayout && source === "candidate" && pointerEvent.clientX <= 58;
      setCandidatePlanningReturnActive(returnToPlanning);
      if (returnToPlanning) {
        candidateTarget = null;
        setCandidateDropTarget(null);
        setCandidateDropActive(false);
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = "";
        return;
      }
      const pointedElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const candidateRow = source === "candidate" && options.allowCandidateReorder !== false ? pointedElement?.closest<HTMLElement>("[data-candidate-task-id]") : null;
      if (candidateRow) {
        const targetTaskId = candidateRow.dataset.candidateTaskId || "";
        if (targetTaskId && targetTaskId !== task.id) {
          const rect = candidateRow.getBoundingClientRect();
          const position = (pointerEvent.clientY - rect.top) < rect.height / 2 ? "before" : "after";
          candidateTarget = {
            taskId: targetTaskId,
            position,
            intent: position === "before" ? "reorder-before" : "reorder-after",
          };
          setCandidateDropTarget(candidateTarget);
        } else {
          candidateTarget = null;
          setCandidateDropTarget(null);
        }
        setCandidateDropActive(false);
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = "";
        return;
      }
      candidateTarget = null;
      setCandidateDropTarget(null);
      const candidatePanel = source === "allDay" ? pointedElement?.closest<HTMLElement>(".df-candidate-panel") : null;
      setCandidateDropActive(Boolean(candidatePanel));
      if (candidatePanel) {
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = "";
        return;
      }
      const allDayCell = pointedElement?.closest<HTMLElement>("[data-all-day-date]");
      setAllDayDragOver(Boolean(allDayCell));
      if (allDayCell) {
        const targetDate = allDayCell.dataset.allDayDate || timelineDate;
        setAllDayDragDate(targetDate);
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = targetDate;
        return;
      }
      setAllDayDragDate("");
      // Candidate -> timeline drag must NOT mutate timeline scroll position or
      // change the current date. The continuous cross-day canvas spans 7 days
      // of vertical space already; `resolveDropTarget` re-reads the grid rect
      // on every move so manual wheel-scroll during a drag still maps correctly.
      // Use the continuous-aware resolver (date-from-Y band) instead of the
      // single-day `getDropTargetFromPointer`, matching `beginBlockDrag`.
      const scrollEl = timelineRef.current;
      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect();
        const inside = pointerEvent.clientX >= rect.left && pointerEvent.clientX <= rect.right && pointerEvent.clientY >= rect.top && pointerEvent.clientY <= rect.bottom;
        if (!inside) { dropTime = ""; setHoverSlot(""); dragTargetDateRef.current = ""; return; }
      }
      const target = resolveDropTarget(pointerEvent.clientX, pointerEvent.clientY);
      if (!target) { dropTime = ""; setHoverSlot(""); dragTargetDateRef.current = ""; return; }
      dragTargetDateRef.current = target.date;
      dropTime = target.startTime;
      setHoverSlot(target.startTime);
    };
    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= TOUCH_SCROLL_CANCEL_DISTANCE_PX) {
          holdCancelled = true;
          clearHold();
        }
        return;
      }
      if (holdCancelled || (!active && distance < DRAG_START_THRESHOLD_PX)) return;
      if (!active) {
        active = true;
        clearHold();
        dragElement.setPointerCapture(pointerId);
        document.body.classList.add("df-timeline-pointer-drag");
        dragElement.classList.add("is-dragging-source");
        suppressBlockClickRef.current = true;
        setDragCreate(null);
        const rect = dragElement.getBoundingClientRect();
        const offX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const offY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
        setDragOverlay({ taskId: task.id, sourceElement: dragElement, sourceRect: rect, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY }, offset: { x: offX, y: offY }, data: { kind: "candidate", source } });
        setDragOverlayTask({ task, variant: source === "candidate" ? "candidate" : "allDay" });
        setActiveDragItem({
          dragId: `${source}:${task.id}`,
          taskId: task.id,
          source: source === "candidate" ? "candidate" : "timeline",
          sourceContainerId: source,
          sourceIndex: visibleCandidates.findIndex((item) => item.id === task.id),
          sourceVariant: source === "candidate" ? "candidate" : "allDay",
          taskSnapshot: task,
        });
        if (compactLayout && source === "candidate") {
          setCompactExecuteView("schedule");
          if (timelineView === "month") setTimelineView("daily");
          window.requestAnimationFrame(() => updateTarget(pointerEvent));
        }
      }
      pointerEvent.preventDefault();
      setDragOverlayPointer({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      const currentRect = dragElement.getBoundingClientRect();
      setDrag({
        taskId: task.id,
        kind: "candidate",
        source,
        duration,
        pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY },
        sourceRect: { width: currentRect.width, height: currentRect.height },
        offset: {
          x: Math.min(Math.max(startX - currentRect.left, 0), currentRect.width),
          y: Math.min(Math.max(startY - currentRect.top, 0), currentRect.height),
        },
      });
      updateTarget(pointerEvent);
    };
    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (active) {
        if (source === "candidate" && compactLayout && pointerEvent.clientX <= 58) {
          moveCandidateToPlanning(task.id);
          cleanup();
          return;
        }
        const pointedElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
        const candidateRow = source === "candidate" && options.allowCandidateReorder !== false ? pointedElement?.closest<HTMLElement>("[data-candidate-task-id]") : null;
        if (candidateRow || candidateTarget) {
          const targetTaskId = candidateRow?.dataset.candidateTaskId || candidateTarget?.taskId || "";
          if (targetTaskId && targetTaskId !== task.id) {
            const rect = candidateRow?.getBoundingClientRect();
            const position = rect
              ? ((pointerEvent.clientY - rect.top) < rect.height / 2 ? "before" : "after")
              : candidateTarget?.position || "after";
            reorderTodayCandidate(task.id, targetTaskId, position);
          }
          cleanup();
          return;
        }
        const candidatePanel = source === "allDay" ? pointedElement?.closest<HTMLElement>(".df-candidate-panel") : null;
        const allDayCell = pointedElement?.closest<HTMLElement>("[data-all-day-date]");
        if (candidatePanel) {
          applyCandidateTimeSettings(task.id, {
            date: today,
            startTime: "",
            durationMinutes: duration,
            allDay: false,
            clearSchedule: true,
          });
        } else if (allDayCell && !options.onSchedule) {
          makeAllDay(task.id, allDayCell.dataset.allDayDate || timelineDate);
        } else if (dropTime && dragTargetDateRef.current) {
          if (options.onSchedule) options.onSchedule(dragTargetDateRef.current, dropTime);
          else scheduleTask(task.id, dropTime);
        }
      }
      cleanup();
    };
    const cancel = (pointerEvent: PointerEvent) => { if (pointerEvent.pointerId === pointerId) cleanup(); };
    const keydown = (keyboardEvent: KeyboardEvent) => { if (keyboardEvent.key === "Escape") cleanup(); };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("pointerdown", jumpDate);
  }

  async function refreshQueuedRemote() {
    if (!queuedRemoteRefreshRef.current
      || pendingDataSaveRef.current
      || pendingSettingsSaveRef.current
      || dataSaveInFlightRef.current
      || settingsSaveInFlightRef.current) return;
    queuedRemoteRefreshRef.current = false;
    const workspaceKey = loadedWorkspaceKeyRef.current;
    const bootstrap = await window.plannerApi.getBootstrap?.({ force: true });
    if (!bootstrap?.data || !bootstrap.settings) return;
    const incomingRevision = Number(bootstrap.revision || 0);
    const cached = readBootstrapCache(authStateRef.current?.user?.id);
    const hasDirtyLocal = Boolean(cached?.dataDirty || cached?.settingsDirty);
    if (workspaceKey !== loadedWorkspaceKeyRef.current) return;
    if (!hasDirtyLocal && !shouldApplyWorkspaceRevision(workspaceKey, loadedWorkspaceKeyRef.current, remoteRevisionRef.current, incomingRevision)) return;
    const resolved = resolveBootstrap(cached, bootstrap.data, bootstrap.settings);
    if (!resolved.data || !resolved.settings) return;
    remoteRevisionRef.current = Math.max(remoteRevisionRef.current, incomingRevision);
    dataRef.current = resolved.data;
    settingsRef.current = resolved.settings;
    setData(resolved.data);
    setSettings(resolved.settings);
    if (resolved.settings.language) setLang(resolved.settings.language);
    writeBootstrapCache(resolved.data, resolved.settings, authStateRef.current?.user?.id, {
      dataDirty: resolved.replayData,
      settingsDirty: resolved.replaySettings,
      remoteRevision: bootstrap.revision,
    });
    if (resolved.replayData) {
      await saveData(resolved.data);
      await flushPendingSave({ urgent: true });
    }
    if (resolved.replaySettings) {
      await saveSettings(resolved.settings);
      await flushPendingSettings({ urgent: true });
    }
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
    persistAiMessage(messageId, { actionState: "undone" });
  }

  function persistAiMessage(messageId: string, patch: Partial<AiSessionMessage>) {
    const current = dataRef.current;
    if (!current) return;
    const update = (message: PlannerData["chat"][number]) => message.id === messageId ? { ...message, ...patch } : message;
    void saveData({
      ...current,
      chat: (current.chat || []).map(update),
      aiConversations: (current.aiConversations || []).map((conversation) => ({ ...conversation, messages: (conversation.messages || []).map(update), updatedAt: new Date().toISOString() })),
    });
  }

  async function handleAgentDecision(messageId: string, decision: "approve" | "reject" | "undo") {
    const existing = aiMessages.find((message) => message.id === messageId)?.agent;
    if (!existing?.runId || aiBusy) return;
    setAiBusy(true);
    try {
      const mode = decision === "approve" ? "agent_confirm" : decision === "reject" ? "agent_reject" : "agent_undo";
      const result = await decideAgentRun(mode, existing.runId);
      if (!result.ok) {
        showToast(result.error.message);
        return;
      }
      if (decision !== "reject") {
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      }
      if (result.agent?.applied.some((action) => action.entity === "integration")) await refreshExternalCalendarLayer("none");
      applyAgentClientActions(result.agent);
      const nextAgent: AgentRunState = {
        ...(result.agent || existing),
        trace: existing.trace,
        applied: decision === "undo" ? [] : [...existing.applied, ...(result.agent?.applied || [])],
        pending: [],
        forbidden: existing.forbidden,
        decisionState: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "undone",
      };
      setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, agent: nextAgent } : message));
      persistAiMessage(messageId, { agent: nextAgent });
      if (aiAuditOpen) void listAgentAuditRuns().then(setAiAuditRuns).catch(() => undefined);
      showToast(result.reply);
    } finally {
      setAiBusy(false);
    }
  }

  async function confirmAiAction(action: AiAction, messageId?: string, actionIndex?: number) {
    const currentData = dataRef.current;
    if (!currentData) return;
    if (action.type === "create_subtasks" && action.taskId && action.subtasks?.length) {
      const target = currentData.tasks.find((task) => task.id === action.taskId);
      if (!target) {
        showToast(lang === "zh" ? "未找到要拆解的任务" : "The task to break down was not found");
        return;
      }
      const now = new Date().toISOString();
      const subtasks = appendAiSubtasks(target.subtasks, action.subtasks, () => uid("subtask"), now);
      await saveData({
        ...currentData,
        tasks: currentData.tasks.map((task) => task.id === target.id ? { ...task, subtasks, updatedAt: now } : task),
      });
      if (messageId) removeAiMessageAction(messageId, action, actionIndex);
      showToast(lang === "zh" ? `已添加 ${subtasks.length - (target.subtasks || []).length} 个子任务` : `Added ${subtasks.length - (target.subtasks || []).length} subtasks`);
      return;
    }
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
        await saveData({ ...currentData, events: [...currentData.events, event] });
      } else {
        const projectId = projects.some((project) => project.id === a.projectId) ? a.projectId : undefined;
        const recurrence = normalizeAiRecurrence(a.recurrence, a.date, a.startTime, a.durationMinutes);
        const duration = Number(a.durationMinutes) || (a.startTime && a.endTime ? clockTimeSpanMinutes(a.startTime, a.endTime) : learnedTaskDurationMinutes(action.title, currentData.tasks, projectId));
        const task: Task = {
          ...makeSmartTask({ ...defaultForm("task"), title: action.title, projectId: projectId || "", dueDate: a.date, estimatedHours: Math.max(duration, 15) / 60 }),
          category: validCategory(a.category), priority: validPriority(a.priority), notes: a.notes || "",
          recurrence, createdAt: now, updatedAt: now,
        };
        if (!recurrence && a.startTime) task.timelineRecords = [createScheduledRecord(task, a.date, a.startTime, Math.max(duration, 15))];
        await saveData({ ...currentData, tasks: [...currentData.tasks, task] });
      }
      if (messageId) removeAiMessageAction(messageId, action, actionIndex);
      return;
    }
    // Handle create_scheduled_task (TrevorAI-style) and create_task as the same flow
    if ((action.type === "create_scheduled_task" || action.type === "create_task") && action.title) {
      const a = action as Record<string, unknown>;
      const projectId = projects.some((project) => project.id === a.projectId) ? a.projectId as string : undefined;
      const dur = (a.durationMinutes as number) || learnedTaskDurationMinutes(action.title, currentData.tasks, projectId);
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
        projectId,
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
      const updatedTasks = [...currentData.tasks, newTask];
      await saveData({ ...currentData, version: currentData.version || 1, tasks: updatedTasks });
      showUndoToast(`${t(lang, "toast.created").replace("%TITLE%", action.title)}`, t(lang, "toast.undo"), () => {
        void saveData({ ...currentData, version: currentData.version || 1, tasks: currentData.tasks });
      });
      // Mark action as accepted
      if (messageId) removeAiMessageAction(messageId, action, actionIndex);
      return;
    }
    if (action.type === "schedule_task" && action.taskId && action.date) {
      const a = action as Record<string, unknown>;
      const updatedTasks = currentData.tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, scheduledDate: action.date, scheduledStart: (a.start as string) || t.scheduledStart, scheduledEnd: (a.end as string) || t.scheduledEnd }
          : t
      );
      await saveData({ ...currentData, version: currentData.version || 1, tasks: updatedTasks });
      showUndoToast(`${t(lang, "toast.scheduledToDate").replace("%DATE%", action.date)}`, t(lang, "toast.undo"), () => {
        void saveData({ ...currentData, version: currentData.version || 1, tasks: currentData.tasks });
      });
    }
    // Dismiss the action card
    if (messageId) removeAiMessageAction(messageId, action, actionIndex);
  }

  function removeAiMessageAction(messageId: string, action: AiAction, actionIndex?: number) {
    setAiMessages((current) => current.map((message) => message.id === messageId
      ? { ...message, actions: (message.actions || []).filter((item, index) => actionIndex === undefined ? item !== action : index !== actionIndex) }
      : message));
    if (actionIndex !== undefined) {
      setAiActionPatches((current) => {
        const messagePatches = { ...(current[messageId] || {}) };
        delete messagePatches[actionIndex];
        return { ...current, [messageId]: messagePatches };
      });
    }
    const current = aiMessages.find((message) => message.id === messageId);
    if (current) persistAiMessage(messageId, { actions: (current.actions || []).filter((item, index) => actionIndex === undefined ? item !== action : index !== actionIndex) });
  }

  function dismissAiAction(action: AiAction, messageId: string, actionIndex?: number) {
    removeAiMessageAction(messageId, action, actionIndex);
  }

  async function generateNextAction() {
    const task = editingId ? tasks.find((item) => item.id === editingId) : null;
    setClarifyLoading(true);
    try {
      const result = await callAiAssistant({
        mode: "parse_task",
        model: settings?.model,
        message: t(lang, "toast.clarifyPrompt"),
        context: { title: form.title, project: projects.find((project) => project.id === form.projectId)?.title, date: form.dueDate, estimatedHours: form.estimatedHours, notes: form.details, subtasks: task?.subtasks || [] },
      });
      if (!result.ok) throw new Error(result.error.message);
      const nextAction = result.reply || t(lang, "toast.clarifyHintGeneric");
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, nextAction) }));
      showToast(lang === "zh" ? "已生成下一步建议" : "Next action generated");
    } catch {
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, `${t(lang, "toast.clarifyHint").replace("%TITLE%", current.title)}`) }));
      showToast(lang === "zh" ? "生成失败，已使用默认提示" : "Generation failed, using default hint");
    } finally {
      setClarifyLoading(false);
    }
  }

  async function planMyDay(overrides?: Partial<AiPlanPrefs>) {
    if (autoScheduleState === "generating" || autoScheduleState === "committing") return;

    const planPrefs = { ...aiPlanPrefs, ...overrides };
    if (overrides) setAiPlanPrefs(planPrefs);
    const sourceTasks = planPrefs.source === "all"
      ? tasks.filter((t) => !t.completed && getExecutionLane(t) !== "queued" && !(t.timelineRecords || []).some((r) => r.executionStatus === "scheduled") && !t.scheduledDate && !hasRecurrenceOccurrenceOnDate(t, today))
      : todayCandidates;
    if (sourceTasks.length === 0) {
      void dialog.alert(planPrefs.source === "all" ? t(lang, "toast.noTaskToSchedule") : t(lang, "toast.noCandidateYet"));
      return;
    }
    setSchedulePreviews([]);
    setAutoScheduleState("generating");
    setSelectedDate(today);

    const dateRange = planPrefs.scope === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(today, index))
      : planPrefs.scope === "3day"
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

    const result = autoScheduleTasks({
      tasks: tasksForSchedule,
      scheduledEvents: existingEvents,
      dateRange,
      settings: {
        dayStart: settings?.scheduleDayStartTime || "08:00",
        dayEnd: settings?.dayEndTime || "22:00",
        bufferMinutes: settings?.scheduleBufferMinutes ?? 5,
        strategy: planPrefs.strategy,
        preferredStartHourByProject: data?.aiProfile?.preferredStartHourByProject || {},
        allowTaskSplitting: true,
      },
    });

    // Each proposed block remains a reviewable preview; split segments retain
    // their shared source id and segment metadata until the user adopts them.
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
        segmentIndex: ev.segmentIndex,
        segmentCount: ev.segmentCount,
      };
    });

    setSchedulePreviews(previews);
    setScheduleUnscheduled(result.unscheduledTasks);
    setAutoScheduleState(previews.length > 0 ? "preview" : "idle");
    if (previews.length === 0 && result.unscheduledTasks.length > 0) {
      showToast(`${t(lang, "toast.noContinuousSlot").replace("%COUNT%", String(result.unscheduledTasks.length))}`);
    }
  }

  async function generateTaskSubtasks(taskId: string) {
    const snapshot = dataRef.current;
    const task = snapshot?.tasks.find((item) => item.id === taskId);
    if (!snapshot || !task || subtaskAiBusyId) return;
    setSubtaskAiBusyId(taskId);
    try {
      if (!authStateRef.current?.user) throw new Error(lang === "zh" ? "全局 AI 需要先登录云端账号" : "Sign in to use the global AI agent");
      await flushPendingSave({ urgent: true });
      const result = await callAiAssistant({
        mode: "agent",
        model: settings?.model,
        reasoningMode: settings?.reasoningMode || "instant",
        message: lang === "zh" ? `请把现有任务“${task.title}”（ID: ${task.id}）拆解为 3–8 个可执行子任务，并直接追加到这个任务。` : `Break the existing task “${task.title}” (ID: ${task.id}) into 3–8 actionable subtasks and append them to that task.`,
        context: { language: lang, currentViewDate: selectedDate, page: mode },
      });
      if (!result.ok) throw new Error(result.error.message);
      if (result.agent?.pending.length) throw new Error(lang === "zh" ? "拆解计划需要在 AI 对话中确认" : "Confirm the breakdown in the AI conversation");
      queuedRemoteRefreshRef.current = true;
      await refreshQueuedRemote();
      const addedCount = Math.max(0, (dataRef.current?.tasks.find((item) => item.id === taskId)?.subtasks || []).length - (task.subtasks || []).length);
      if (!addedCount) throw new Error(result.reply || "AI did not add subtasks");
      showToast(addedCount > 0
        ? (lang === "zh" ? `AI 已添加 ${addedCount} 个子任务` : `AI added ${addedCount} subtasks`)
        : (lang === "zh" ? "没有新的子任务可添加" : "No new subtasks to add"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : (lang === "zh" ? "AI 拆解失败，请重试" : "AI breakdown failed. Please retry."));
    } finally {
      setSubtaskAiBusyId("");
    }
  }

  function handleUnscheduledAction(item: UnscheduledTask, action: NonNullable<UnscheduledTask["actions"]>[number]) {
    if (action === "shorten") {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (task) openTaskEdit(task);
      return;
    }
    setAiPlanMenuOpen(false);
    void planMyDay({ scope: action === "split" ? "week" : "3day" });
  }

  /**
   * Cancel all auto-schedule previews. Does NOT touch real data.
   */
  function cancelAutoSchedule() {
    const current = dataRef.current;
    if (current && schedulePreviews.length > 0) void saveData({ ...current, aiProfile: profileWithFeedback(current, "scheduleRejects", schedulePreviews.length) });
    setSchedulePreviews([]);
    setScheduleUnscheduled([]);
    setAutoScheduleState("idle");
    dismissToast();
  }

  /**
   * Cancel a single preview by id. Does NOT touch real data.
   * If the cancelled preview is the last one, return to idle.
   */
  function cancelOnePreview(previewId: string) {
    const currentData = dataRef.current;
    if (currentData) void saveData({ ...currentData, aiProfile: profileWithFeedback(currentData, "scheduleRejects") });
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

    void saveData({ ...data, tasks: tasksAfter, aiProfile: profileWithFeedback(data, "scheduleAccepts") });
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

    void saveData({ ...data, tasks: tasksAfter, aiProfile: profileWithFeedback(data, "scheduleAccepts", toAdd.length) });
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
    void runMotionTransition(() => {
      setSelectedDate((date) => {
        if (timelineView === "3day") return addDays(date, direction * 3);
        if (timelineView === "weekly") return addDays(date, direction * 7);
        if (timelineView === "month") return addMonths(date, direction);
        return addDays(date, direction);
      });
    }, { direction: direction < 0 ? "backward" : "forward", scope: "timeline" });
  }

  function changeMode(nextMode: Mode) {
    if (nextMode === mode) return;
    setYearOverviewOpen(false);
    void runMotionTransition(() => {
      void saveSettings({ activeMode: nextMode });
    }, { direction: nextMode === "planning" ? "forward" : "backward", scope: "workspace" });
  }

  function changeTimelineView(nextView: TimelineView) {
    if (nextView === timelineView) return;
    const order: TimelineView[] = ["daily", "3day", "weekly", "month"];
    const direction = order.indexOf(nextView) < order.indexOf(timelineView) ? "backward" : "forward";
    void runMotionTransition(() => {
      setTimelineView(nextView);
      setDragCreate(null);
    }, { direction, scope: "timeline" });
  }

  function goToNow() {
    const now = new Date();
    const nowDate = todayIso();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setSelectedDate(nowDate);
    setVisibleTimelineDate(nowDate);
    setCompactExecuteView("schedule");
    setMobileDatePickerOpen(false);
    setTimelineView("daily");
    lastTimelineAutoScrollKeyRef.current = "";
    setPendingTimelineFocus({ date: nowDate, startTime: nowTime, source: "schedule" });
  }

  function openSettingsSection(section: SettingsTargetInput) {
    rememberLayerTrigger("utility");
    setSettingsSectionTarget(normalizeSettingsTarget(section));
    setUtilityPanel("settings");
  }

  function closeUtilityPanel(afterClose?: () => void) {
    requestLayerClose("utility", ".df-utility-backdrop, .df-utility-panel", () => {
      setUtilityPanel(null);
      afterClose?.();
    });
  }

  function toggleTimerShortcut() {
    if (timerTaskId) {
      if (timerRunning) pauseTimer();
      else resumeTimer();
      return;
    }
    if (headerTask) {
      startTimer(headerTask.id);
      return;
    }
    showToast(lang === "zh" ? "没有可计时的任务" : "No task is ready to track");
  }

  function chooseCommand(result: CommandSearchResult) {
    setCommandOpen(false);
    setCommandQuery("");
    if (result.focusTarget) {
      void saveSettings({ activeMode: "execute" });
      setSelectedDate(result.focusTarget.date);
      setTimelineView("daily");
      requestTimelineFocus({
        date: result.focusTarget.date,
        startTime: result.focusTarget.time,
        taskId: result.focusTarget.recordId || result.focusTarget.taskId,
        source: "schedule",
      });
      return;
    }
    if (result.kind === "setting") {
      openSettingsSection(settingsTargetForSearchId(result.id.replace(/^setting:/, "")) || "general");
      return;
    }
    if (result.kind === "task") {
      const taskId = result.id.replace("task:", "");
      const task = tasks.find((item) => item.id === taskId);
      if (task) openTaskEdit(task);
      return;
    }
    if (result.kind === "project") {
      const projectId = result.id.replace("project:", "");
      const project = projects.find((item) => item.id === projectId);
      if (project) openProjectEdit(project);
      return;
    }
    if (result.kind === "habit") {
      const habitId = result.id.replace("habit:", "");
      const scheduled = (dataRef.current?.habitDailyStates || []).find((item) => item.habitId === habitId && item.date === today && item.timelineRecordId);
      if (scheduled?.timelineRecordId) {
        focusHabitSchedule(scheduled.timelineRecordId);
        return;
      }
      const now = new Date();
      const rounded = Math.floor((now.getHours() * 60 + now.getMinutes()) / SLOT_MINUTES) * SLOT_MINUTES;
      scheduleHabitAt(habitId, today, minutesToTime(rounded));
    }
  }

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;
      if ((drawerOpen || aiOpen || utilityPanel || habitPanel) && shortcut.id !== "command-search" && shortcut.id !== "help") return;
      event.preventDefault();
      switch (shortcut.id) {
        case "command-search":
          setCommandOpen(true);
          setCommandQuery("");
          break;
        case "help":
          openSettingsSection("shortcuts");
          break;
        case "new-task":
          openAdd("task");
          break;
        case "today":
          goToNow();
          break;
        case "previous-date":
          shiftTimeline(-1);
          break;
        case "next-date":
          shiftTimeline(1);
          break;
        case "execute":
          setYearOverviewOpen(false);
          void saveSettings({ activeMode: "execute" });
          break;
        case "planning":
          setYearOverviewOpen(false);
          void saveSettings({ activeMode: "planning" });
          break;
        case "day-view":
          setTimelineView("daily");
          break;
        case "three-day-view":
          setTimelineView("3day");
          break;
        case "week-view":
          setTimelineView("weekly");
          break;
        case "month-view":
          setTimelineView("month");
          break;
        case "timer-toggle":
          toggleTimerShortcut();
          break;
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [drawerOpen, aiOpen, utilityPanel, habitPanel, timelineView, timerTaskId, timerRunning, headerTask, lang, today]);

  function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  if (!isWorkspaceRoute || (authState?.mode === "cloud" && !authState.user)) {
    if (isWorkspaceRoute && window.desktopApi) {
      return <AuthGate
        busy={authBusy}
        error={authError}
        notice={authNotice}
        onSubmit={(email, password, displayName, intent) => (
          handleAuthSubmit(email, password, displayName, intent, "dark")
        )}
        onResend={resendConfirmation}
        onContinueAfterConfirm={continueAfterConfirm}
      />;
    }
    return <Suspense fallback={<ExecuteSkeleton />}>
      <LandingPageLazy busy={authBusy} error={authError} notice={authNotice} onLogin={handleAuthSubmit} onResend={resendConfirmation} onContinueAfterConfirm={continueAfterConfirm} onForgotPassword={handleForgotPassword} />
    </Suspense>;
  }

  if (authState?.mode === "cloud" && authState.user && isRecoveryMode) {
    return <ResetPasswordForm lang={lang} busy={authBusy} error={authError} onReset={handleResetPassword} />;
  }

  const unusableCloudCache = !data || !settings
    || ((settings.onboardingVersion ?? 0) < 2 && settings.onboardingStep !== "done");
  if (authState?.mode === "cloud" && authState.user && authError && unusableCloudCache) {
    return <CloudWorkspaceError
      lang={lang}
      message={authError}
      busy={authBusy}
      onRetry={() => {
        setAuthBusy(true);
        setAuthError("");
        void loadInitial().finally(() => setAuthBusy(false));
      }}
      onSignOut={() => void handleSignOut()}
    />;
  }

  if (!data || !settings) return <ExecuteSkeleton />;

  const onboardingActive = (settings.onboardingVersion ?? 0) < 2 && settings.onboardingStep !== "done";
  const onboardingStep = (settings.onboardingStep || "add") as OnboardingStep;
  const habits = data.habits || [];
  const habitDailyStates = data.habitDailyStates || [];
  const hasActiveHabits = settings.featureHabitsEnabled !== false && habits.some((habit) => !habit.archived);
  const draggedTask = drag
    ? tasks.find((task) => task.id === drag.taskId)
      || explicitVisibleTimeline.tasks.find((task) => task.id === drag.taskId)
      || recordToTaskMap.get(drag.taskId)
      || eventVisibleTimeline.tasks.find((task) => task.id === drag.taskId)
      || (drag.taskId.startsWith("habit:")
        ? (() => {
            const habit = habits.find((item) => habitDragTaskId(item.id) === drag.taskId);
            return habit ? habitDragTask(habit, timelineDate) : undefined;
          })()
        : undefined)
    : undefined;
  const timelineSnapActive = Boolean(draggedTask && hoverSlot && !drag?.outsideTimeline);
  const focusTask = timerTask || headerTask;
  const focusProject = timerProject || headerProject;
  const focusElapsed = timerTask ? timerElapsed : 0;
  const pomodoroSeconds = 25 * 60;
  const pomodoroRemaining = Math.max(0, pomodoroSeconds - (focusElapsed % pomodoroSeconds));
  const focusClockDisplay = focusOverlayMode === "pomodoro" ? formatTimerDisplay(pomodoroRemaining) : formatTimerDisplay(focusElapsed);
  const flowBreakMinutes = Math.max(5, Math.round(Math.max(focusElapsed / 60, 25) / 5));
  const focusModeNote = focusOverlayMode === "pomodoro"
    ? (lang === "zh" ? "25 分钟专注倒计时" : "25-minute focus countdown")
    : focusOverlayMode === "flowtime"
      ? (lang === "zh" ? `已专注 ${Math.floor(focusElapsed / 60)} 分钟，建议休息 ${flowBreakMinutes} 分钟` : `Focused ${Math.floor(focusElapsed / 60)}m, suggested break ${flowBreakMinutes}m`)
      : (lang === "zh" ? "正计时" : "Stopwatch");

  return (
    <div className={`df-app mode-${mode} theme-${settings.theme} type-${settings.typographyStyle || "editorial"}${fullscreen ? " is-timeline-fullscreen" : ""}${yearOverviewOpen ? " is-year-overview" : ""}${drag ? " is-dragging" : ""}${onboardingActive ? ` onboarding-active onboarding-step-${onboardingStep}` : ""}${settings.taskBlockFill ? " task-block-fill" : ""}${aiOpen || utilityPanel ? " is-mobile-sheet-open" : ""}${quickAddOpen ? " is-compact-quick-add-open" : ""}`} data-timeline-view={timelineView} data-task-block-fill={settings.taskBlockFill ? "true" : undefined} style={{ ...themeVars(settings, mode), "--timeline-slot-height": `${timelineSlotHeight}px`, "--timeline-hour-height": `${timelineHourHeight}px` } as CSSProperties}>
      <header className="df-header">
        <div className="df-header-inner">
          <div className="df-brand">
            <button className="df-brand-ai-button" type="button" onClick={() => { if (compactLayout && !settings.hideAi) setAiOpen(true); }} aria-label={compactLayout ? (lang === "zh" ? "打开 Navo AI" : "Open Navo AI") : undefined} disabled={!compactLayout || settings.hideAi}>
              <ProductIcon compact />
            </button>
            <div><strong>NavoPath</strong></div>
          </div>
          <div className="df-month-year-selector">
            <button className="df-month-year-btn" aria-expanded={yearOverviewOpen} onClick={() => {
              const nextOpen = !yearOverviewOpen;
              setYearOverviewOpen(nextOpen);
              if (nextOpen) {
                setOverviewYear(new Date(`${timelineDate}T00:00:00`).getFullYear());
                setCompactExecuteView("schedule");
                if (mode !== "execute") void saveSettings({ activeMode: "execute" });
              }
            }}>
              {yearOverviewOpen
                ? overviewYear
                : (() => { const d = new Date(`${timelineDate}T00:00:00`); return `${d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "long" })} ${d.getFullYear()}`; })()}
              <span className="df-month-year-chevron" />
            </button>
          </div>
          <nav className="df-tabs df-tabs-center">
            <button className={mode === "execute" ? "active" : ""} onClick={() => changeMode("execute")}>{t(lang, "header.execute")}</button>
            <button className={mode === "planning" ? "active" : ""} onClick={() => changeMode("planning")}>{t(lang, "header.planning")}</button>
          </nav>
          <div className="df-header-right">
          <button
            className={`df-user-avatar df-header-sync${isManualSyncing ? " is-syncing" : ""}`}
            type="button"
            disabled={isManualSyncing}
            onClick={() => void handleSyncNow()}
            aria-label={lang === "zh" ? "立即同步" : "Sync now"}
            title={lang === "zh" ? "立即同步" : "Sync now"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7h-5V2" />
              <path d="M20 7a8 8 0 0 0-13.7-2.7L4 7" />
              <path d="M4 17h5v5" />
              <path d="M4 17a8 8 0 0 0 13.7 2.7L20 17" />
            </svg>
          </button>
          <button
            className="df-user-avatar"
            type="button"
            onClick={() => { setCommandOpen(true); setCommandQuery(""); }}
            aria-label={lang === "zh" ? "搜索" : "Search"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </button>
          <button className="df-user-avatar" onClick={() => { rememberLayerTrigger("utility"); setUtilityPanel("settings"); }} aria-label={t(lang, "header.settings")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10.91 3H11a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
        </div>
      </header>
      <div className="df-header-fade" />
      {compactLayout && quickAddOpen && <div className="df-drawer-backdrop" onMouseDown={() => quickTitle.trim() ? finishMobileQuickAdd() : setQuickAddOpen(false)} />}
      {compactLayout && quickAddOpen && (
        <Suspense fallback={null}><MobileQuickAddSheet
          lang={lang}
          kind={mobileQuickAddKind}
          kinds={settings.featureHabitsEnabled === false ? ["task", "project"] : ["task", "project", "habit"]}
          title={quickTitle}
          projects={projects}
          projectId={quickProjectId}
          projectColor={quickProjectColor}
          habitMinutes={mobileQuickHabitMinutes}
          onTitleChange={setQuickTitle}
          onKindChange={(kind) => { setMobileQuickAddKind(kind); setQuickProjectOpen(false); }}
          onProjectChange={setQuickProjectId}
          onProjectColorChange={setQuickProjectColor}
          onHabitMinutesChange={setMobileQuickHabitMinutes}
          onClose={() => { setQuickAddOpen(false); setQuickTitle(""); }}
          onMore={() => finishMobileQuickAdd(true)}
          onSubmit={() => finishMobileQuickAdd()}
        /></Suspense>
      )}
      <div id="df-portal-target" />
      {dialog.host}
      {onboardingActive && (
        <OnboardingGuide
          lang={lang}
          step={onboardingStep}
          mode={mode}
          onOpenPlanning={() => void saveSettings({ activeMode: "planning" })}
          onOpenAi={() => setAiOpen(true)}
          onChange={(step) => void saveSettings({ onboardingStep: step })}
          onFinish={() => void saveSettings({ onboardingVersion: 2, onboardingStep: "done" })}
          onSkip={() => void saveSettings({ onboardingVersion: 2, onboardingStep: "done" })}
        />
      )}

      {mode === "execute" ? (
        <ExecutionSplitLayout className={`${candidatePanelCollapsed ? "candidate-collapsed" : ""}${fullscreen ? " fullscreen" : ""}${simpleView ? " simple-view" : ""}`}>
          <div className="df-compact-execute-controls">
            <nav className="df-compact-execute-tabs" aria-label={lang === "zh" ? "执行视图" : "Execute view"}>
              <button
                className={`active ${compactExecuteView === "schedule" ? "schedule-state" : "tasks-state"}`}
                aria-label={compactExecuteView === "tasks" ? (lang === "zh" ? "任务" : "Tasks") : (lang === "zh" ? "日程" : "Schedule")}
                aria-pressed={compactExecuteView === "schedule"}
                onClick={() => setCompactExecuteView((view) => view === "tasks" ? "schedule" : "tasks")}
              >
                <span className="df-compact-mode-label tasks-label" aria-hidden="true">{lang === "zh" ? "任务" : "Tasks"}</span>
                <span className="df-compact-mode-label schedule-label" aria-hidden="true">{lang === "zh" ? "日程" : "Schedule"}</span>
                <span className="df-compact-mode-logo" aria-hidden="true"><ProductIcon compact /></span>
              </button>
            </nav>
            {(() => {
                const date = new Date(`${timelineWindowAnchorDate}T00:00:00`);
                const dateContents = timelineView === "month" ? (
                  <strong>{monthTitle(lang, date.getFullYear(), date.getMonth() + 1)}</strong>
                ) : (
                  <><strong>{date.getDate()}</strong><span>{weekdayName(lang, date.getDay()).replace(/^周/, "")}</span></>
                );
                if (compactExecuteView === "tasks") {
                  return <div className="df-compact-date-display is-readonly" aria-label={lang === "zh" ? "当前日期" : "Current date"}>{dateContents}</div>;
                }
                return <button
                  type="button"
                  className="df-compact-date-display df-compact-date-picker-trigger"
                  aria-expanded={mobileDatePickerOpen}
                  aria-label={lang === "zh" ? "打开日期快选" : "Open quick date picker"}
                  onClick={() => {
                    setMobileDatePickerMonth(timelineWindowAnchorDate.slice(0, 7));
                    setMobileDatePickerOpen((open) => !open);
                  }}
                >
                {dateContents}
                <span className={`df-date-title-chevron${mobileDatePickerOpen ? " open" : ""}`} aria-hidden="true">⌄</span>
              </button>;
              })()}
            {compactExecuteView === "schedule" && (
              <>
              <nav className="df-compact-calendar-tabs" aria-label={t(lang, "timeline.switchView")}>
                <button className="df-compact-date-arrow" aria-label={t(lang, "timeline.prevSegment")} onClick={() => shiftTimeline(-1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 3-5 5 5 5" /></svg></button>
                <button className="df-compact-date-arrow" aria-label={t(lang, "timeline.nextSegment")} onClick={() => shiftTimeline(1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6.5 3 5 5-5 5" /></svg></button>
                <label className="active df-compact-view-trigger df-ios-native-select">
                  <span>{viewLabel(lang, timelineView)}</span>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                  <select
                    aria-label={t(lang, "timeline.switchView")}
                    value={timelineView}
                    onChange={(event) => changeTimelineView(event.target.value as TimelineView)}
                  >
                    {(["daily", "3day", "weekly", "month"] as TimelineView[]).map((view) => (
                      <option key={view} value={view}>{viewLabel(lang, view)}</option>
                    ))}
                  </select>
                </label>
              </nav>
              </>
            )}
          </div>
          {compactExecuteView === "schedule" && mobileDatePickerOpen && (
            <MobileDateQuickPicker
              month={mobileDatePickerMonth}
              selectedDate={timelineWindowAnchorDate}
              today={today}
              weekStartsOn={settings.weekStartsOn}
              lang={lang}
              onMonthChange={setMobileDatePickerMonth}
              onSelect={(date) => {
                setSelectedDate(date);
                setVisibleTimelineDate(date);
                setMobileDatePickerOpen(false);
                setDragCreate(null);
                lastTimelineAutoScrollKeyRef.current = "";
              }}
            />
          )}
          <CandidatePanelShell
            className={`${compactExecuteView === "tasks" ? "compact-active" : "compact-inactive"}${candidatePanelCollapsed ? " collapsed" : ""}${fullscreen ? " hidden" : ""}${candidateDropActive ? " drop-active" : ""}`}
            ariaHidden={compactLayout && compactExecuteView !== "tasks"}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
            event.preventDefault();
            const taskId = drag?.taskId || event.dataTransfer.getData("taskId");
            if (taskId) {
              const isDroppedEvent = events.some((e) => taskId.startsWith(`event_occ_${e.id}_`)) || recordToTaskMap.get(taskId) && isEventDisplayTask(recordToTaskMap.get(taskId)!);
              if (isDroppedEvent) {
                makeEventCandidate(taskId, today);
              } else {
                returnTimelineTaskToCandidates(taskId, today);
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
            <CandidatePanelHeader
              title={t(lang, "candidate.title")}
              actions={<>
                {(timelineView === "3day" || timelineView === "weekly" || timelineView === "month") && (
                  <button className="df-icon-action df-candidate-collapse" data-tip={t(lang, "candidate.collapse")} aria-label={t(lang, "candidate.collapse")} onClick={() => { setCandidatePanelCollapsed(true); setFullscreen(false); }} style={{ fontSize: "14px", lineHeight: 1, padding: "0 2px" }}>«</button>
                )}
                <div className="df-candidate-filter-anchor">
                  <button
                    type="button"
                    className={`df-filter-trigger${candidateFilterOpen ? " active" : ""}${candidateFilterActiveCount > 0 ? " has-active" : ""}`}
                    aria-expanded={candidateFilterOpen}
                    aria-label={lang === "zh" ? "筛选候选任务" : "Filter candidates"}
                    title={lang === "zh" ? "筛选" : "Filter"}
                    onClick={() => setCandidateFilterOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 4h12M5 9h8M7 14h4" /></svg>
                    {candidateFilterActiveCount > 0 && <b>{candidateFilterActiveCount}</b>}
                  </button>
                  {candidateFilterOpen && <div className="df-candidate-filter-menu" onClick={(event) => event.stopPropagation()}>
                    <div className="df-filter-categories">
                      <button type="button" className={`df-filter-cat-row${candidateFilterCategory === "project" ? " active" : ""}${candidateProjectFilters.length > 0 ? " has-active" : ""}`} onMouseEnter={() => setCandidateFilterCategory("project")} onFocus={() => setCandidateFilterCategory("project")}>
                        <span className="df-filter-cat-icon" aria-hidden="true"><svg viewBox="0 0 14 14"><path d="M2 4v7h10V5H7L5.5 3.5H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg></span>
                        <span className="df-filter-cat-label">{lang === "zh" ? "项目" : "Project"}</span>
                        {candidateProjectFilters.length > 0 && <span className="df-filter-cat-count">{candidateProjectFilters.length}</span>}
                      </button>
                      <button type="button" className={`df-filter-cat-row${candidateFilterCategory === "completed" ? " active" : ""}${showCompletedCandidates ? " has-active" : ""}`} onMouseEnter={() => setCandidateFilterCategory("completed")} onFocus={() => setCandidateFilterCategory("completed")}>
                        <span className="df-filter-cat-icon" aria-hidden="true"><svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M4.5 7l1.8 1.8L9.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                        <span className="df-filter-cat-label">{lang === "zh" ? "已完成" : "Completed"}</span>
                        {showCompletedCandidates && <span className="df-filter-cat-count">1</span>}
                      </button>
                    </div>
                    <div className="df-filter-options-view">
                      <div className="df-filter-options-title">{candidateFilterCategory === "project" ? (lang === "zh" ? "项目" : "Project") : (lang === "zh" ? "已完成" : "Completed")}</div>
                      {candidateFilterCategory === "project"
                        ? projects.filter((project) => candidateProjectFilters.includes(String(project.id)) || [...todayCandidates, ...completedCandidates].some((task) => String(task.projectId || "") === String(project.id))).map((project) => <label key={project.id} className={`df-filter-option${candidateProjectFilters.includes(String(project.id)) ? " checked" : ""}`}><input type="checkbox" checked={candidateProjectFilters.includes(String(project.id))} onChange={() => toggleCandidateProjectFilter(String(project.id))} /><span className="df-filter-option-dot" style={{ background: project.color || "var(--accent-active)" }} /><span>{project.title}</span></label>)
                        : <label className={`df-filter-option${showCompletedCandidates ? " checked" : ""}`}><input type="checkbox" checked={showCompletedCandidates} onChange={() => setShowCompletedCandidates((value) => !value)} /><span>{lang === "zh" ? "显示已完成" : "Show completed"}</span></label>}
                    </div>
                    {candidateFilterActiveCount > 0 && <button type="button" className="df-filter-reset" onClick={() => { setCandidateProjectFilters([]); setShowCompletedCandidates(false); }}>{lang === "zh" ? "清除全部" : "Clear all"}</button>}
                  </div>}
                </div>
                {compactLayout && <button
                  type="button"
                  className={`df-candidate-completed-toggle${showCompletedCandidates ? " active" : ""}`}
                  aria-pressed={showCompletedCandidates}
                  aria-label={lang === "zh" ? "显示今日已完成任务" : "Show today's completed tasks"}
                  title={lang === "zh" ? "显示今日已完成" : "Show completed"}
                  onClick={() => setShowCompletedCandidates((value) => !value)}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 12.5l3 3 7-7"/><circle cx="12" cy="12" r="9"/></svg>
                  <span>{lang === "zh" ? "已完成" : "Done"}</span>
                </button>}
                <button
                  className="df-icon-action df-icon-focus"
                  data-tip={lang === "zh" ? "专注" : "Focus"}
                  aria-label={lang === "zh" ? "专注" : "Focus"}
                  disabled={!focusTask}
                  onClick={() => { if (!focusTask) return; if (!timerTask) startTimer(focusTask.id); setFocusOverlayMode(settings.focusModeDefault || "flowtime"); }}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                </button>
                {settings.featureTemplatesEnabled !== false && (
                <button className="df-icon-action df-icon-template" data-tip={lang === "zh" ? "日程模版" : "Schedule Template"} aria-label={lang === "zh" ? "日程模版" : "Schedule Template"} onClick={() => setScheduleTemplateOpen(true)}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 4V2M16 4V2M8 13h3M8 17h6"/></svg></button>
                )}
                {Boolean(window.desktopApi?.widget) && settings.featureWidgetEnabled !== false && (
                  <button
                    className="df-icon-action df-icon-widget"
                    data-tip={lang === "zh" ? "桌面小组件" : "Desktop widget"}
                    aria-label={lang === "zh" ? "桌面小组件" : "Desktop widget"}
                    onClick={() => void window.desktopApi?.widget?.open()}
                  ><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="1.5"/></svg></button>
                )}
                {!settings.hideAi && (
                  <span className="df-ai-plan-title-tools">
                    <button
                      className={`df-icon-action df-ai-plan-title-icon ${autoScheduleState === "generating" || autoScheduleState === "committing" ? "thinking" : ""}`}
                      data-tip={drawerOpen ? t(lang, "timeline.aiPlanToday") : t(lang, "timeline.planningSuggestion")}
                      aria-label={t(lang, "timeline.aiPlanToday")}
                      disabled={autoScheduleState === "generating" || autoScheduleState === "committing" || drawerOpen}
                      onClick={() => { setAiPlanMenuOpen(false); void planMyDay(); }}
                    >
                      <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 2.5l1.1 3.2 3.4 1.1-3.4 1.1L10 11.1 8.9 7.9 5.5 6.8l3.4-1.1L10 2.5z" />
                        <path d="M4.8 11.5l.7 2 2.1.7-2.1.7-.7 2-.7-2-2.1-.7 2.1-.7.7-2z" />
                        <path d="M15.6 12.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4z" />
                      </svg>
                    </button>
                    <button className={`df-icon-action df-ai-plan-options ${aiPlanMenuOpen ? "active" : ""}`} aria-label={t(lang, "timeline.aiPlanningSettings")} aria-expanded={aiPlanMenuOpen} onClick={(event) => { event.stopPropagation(); setAiPlanMenuOpen((open) => !open); }}><span className="df-ai-plan-chevron" aria-hidden="true" /></button>
                    {schedulePreviews.length > 0 && autoScheduleState === "preview" && <>
                      <button className="df-icon-action df-ai-plan-confirm" onClick={() => acceptAllPreviews()} title={t(lang, "timeline.adoptAll")} aria-label={t(lang, "timeline.adoptAll")}>✓</button>
                      <button className="df-icon-action df-ai-plan-cancel" onClick={() => cancelAutoSchedule()} title={t(lang, "timeline.cancelPreview")} aria-label={t(lang, "timeline.cancelPreview")}>✕</button>
                    </>}
                    {aiPlanMenuOpen && <span className="df-ai-plan-menu df-ai-plan-menu-visible open" onClick={(event) => event.stopPropagation()}>
                      <span className={`df-ai-capacity-risk ${dailyCapacityRisk.level}`}>
                        <strong>{lang === "zh" ? "今日容量" : "Today's capacity"}</strong>
                        <small>{lang === "zh" ? `待安排 ${formatMinutes(dailyCapacityRisk.demandMinutes)} / 可用 ${formatMinutes(dailyCapacityRisk.availableMinutes)}` : `${formatMinutes(dailyCapacityRisk.demandMinutes)} to place / ${formatMinutes(dailyCapacityRisk.availableMinutes)} free`}</small>
                      </span>
                      <label>{t(lang, "timeline.source")}<select value={aiPlanPrefs.source} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, source: event.target.value as AiPlanPrefs["source"] }))}><option value="today">{t(lang, "timeline.fromCandidates")}</option><option value="all">{t(lang, "timeline.allUnfinished")}</option></select></label>
                      <label>{t(lang, "timeline.scope")}<select value={aiPlanPrefs.scope} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, scope: event.target.value as AiPlanPrefs["scope"] }))}><option value="day">{viewLabel(lang, "daily")}</option><option value="3day">{viewLabel(lang, "3day")}</option><option value="week">{lang === "zh" ? "本周" : "This week"}</option></select></label>
                      <label>{t(lang, "timeline.strategy")}<select value={aiPlanPrefs.strategy} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, strategy: event.target.value as AiPlanPrefs["strategy"] }))}><option value="alternativeProject">{t(lang, "timeline.alternateByProject")}</option><option value="byProject">{t(lang, "timeline.scheduleByProject")}</option><option value="longShort">{t(lang, "timeline.alternateLongShort")}</option><option value="random">{t(lang, "timeline.random")}</option></select></label>
                      <span className="df-ai-daily-tools"><button type="button" onClick={() => { setAiPlanMenuOpen(false); openDailyAiPrompt("start"); }}>{lang === "zh" ? "开工简报" : "Start brief"}</button><button type="button" onClick={() => { setAiPlanMenuOpen(false); openDailyAiPrompt("review"); }}>{lang === "zh" ? "收工复盘" : "Day review"}</button></span>
                    </span>}
                  </span>
                )}
              </>
            }
            />
            {candidateDropActive && (
              <div className="df-candidate-return-hint" role="status">
                {lang === "zh" ? "松手后移回今日候选" : "Release to return to Today's Candidates"}
              </div>
            )}
            {candidatePlanningReturnActive && (
              <div className="df-candidate-planning-return-hint" role="status">
                {lang === "zh" ? "松手移回规划" : "Release to return to Planning"}
              </div>
            )}
            {compactLayout && compactExecuteView === "tasks" && scheduleGuideOpen && visibleCandidates.length > 0 && (
              <aside className="df-schedule-drop-guide" aria-label={lang === "zh" ? "将任务拖入时间轴的提示" : "Drag tasks into the timeline hint"}>
                <div className="df-schedule-drop-guide-source" aria-hidden="true">
                  <span className="df-schedule-drop-guide-check" />
                  <strong>{lang === "zh" ? "探索 NavoPath" : "Explore NavoPath"}</strong>
                  <small>{lang === "zh" ? "15 分钟" : "15 min"}</small>
                </div>
                <svg viewBox="0 0 90 52" aria-hidden="true">
                  <path d="M3 17C24 7 37 8 50 22s20 18 34 13" />
                  <path d="m78 31 6 4-7 2" />
                  <circle cx="50" cy="22" r="2.5" />
                </svg>
                <div className="df-schedule-drop-guide-target" aria-hidden="true">
                  <span>09:30</span><i /><i /><i />
                </div>
                <span className="df-schedule-drop-guide-copy">{lang === "zh" ? "拖到日程" : "Drag to Schedule"}</span>
                <button type="button" aria-label={lang === "zh" ? "关闭提示" : "Dismiss hint"} onClick={() => setScheduleGuideOpen(false)}>×</button>
              </aside>
            )}
            {(dailyCapacityRisk.level !== "comfortable" || schedulePreviews.length > 0 || scheduleUnscheduled.length > 0) && (
              <div className="df-ai-plan-feedback" role="status">
                {dailyCapacityRisk.level !== "comfortable" && <span className={`df-ai-capacity-inline ${dailyCapacityRisk.level}`}>{lang === "zh" ? `容量${dailyCapacityRisk.level === "high" ? "超载" : "偏紧"}：待安排 ${formatMinutes(dailyCapacityRisk.demandMinutes)}，剩余 ${formatMinutes(dailyCapacityRisk.availableMinutes)}` : `Capacity ${dailyCapacityRisk.level === "high" ? "overloaded" : "tight"}: ${formatMinutes(dailyCapacityRisk.demandMinutes)} to place, ${formatMinutes(dailyCapacityRisk.availableMinutes)} free`}</span>}
                {schedulePreviews.length > 0 && <><span className="df-ai-plan-summary">{t(lang, "timeline.previewPlan").replace("X", String(schedulePreviews.length))}</span>{compactLayout && <div className="df-ai-plan-mobile-preview">{schedulePreviews.slice(0, 4).map((preview) => <button key={preview.id} type="button" onClick={() => { setCompactExecuteView("schedule"); setPendingTimelineFocus({ date: preview.scheduledDate, startTime: preview.scheduledStart, source: "autoschedule" }); }}><strong>{preview.title}</strong><small>{preview.scheduledDate} · {preview.scheduledStart}–{preview.scheduledEnd}</small></button>)}</div>}</>}
                {scheduleUnscheduled.length > 0 && <details className="df-ai-plan-unscheduled">
                  <summary>{lang === "zh" ? `${scheduleUnscheduled.length} 项暂未安排` : `${scheduleUnscheduled.length} not scheduled`}</summary>
                  {scheduleUnscheduled.map((item) => <div key={item.taskId} className="df-ai-plan-unscheduled-item">
                    <span><strong>{item.title}</strong><small>{item.reason}</small></span>
                    <span className="df-ai-plan-unscheduled-actions">{(item.actions || []).map((action) => <button key={action} type="button" onClick={() => handleUnscheduledAction(item, action)}>{action === "shorten" ? (lang === "zh" ? "缩短" : "Shorten") : action === "split" ? (lang === "zh" ? "拆分" : "Split") : (lang === "zh" ? "移至下一天" : "Next day")}</button>)}</span>
                  </div>)}
                </details>}
              </div>
            )}
            <div className="df-candidate-list">
              {visibleCandidates.length === 0 && !hasActiveHabits ? (
                <div className="df-empty"><div className="blob-accent" /><strong>{t(lang, "candidate.emptyTitle")}</strong><span>{t(lang, "candidate.emptyDesc")}</span>{compactLayout && <img className="df-empty-add-guidance" src="/empty-add-guidance-v2.png" alt="" aria-hidden="true" />}</div>
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
                        {tasks.map((task) => {
                          const dropHere = drag?.source === "candidate" && candidateDropTarget?.taskId === task.id;
                          return (
                            <div
                              key={task.id}
                              className={`df-candidate-task-row${completingTaskIds.has(task.id) ? " is-completing" : ""}${dropHere ? ` is-candidate-drop is-${candidateDropTarget.position}` : ""}`}
                              data-candidate-task-id={isEventDisplayTask(task) ? undefined : task.id}
                              onClickCapture={(event) => {
                                if (!(event.target as HTMLElement).closest(".df-block-check")) return;
                                event.stopPropagation();
                                toggleCandidateTaskDone(task);
                              }}
                            >
                              {dropHere && candidateDropTarget.position === "before" && <div className="df-list-insertion-line" aria-hidden="true" />}
                              <TaskCard task={task} projects={projects} focusDate={today} placementPreview={placementPreview} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => deleteTaskById(task.id)} onStartPlacementPreview={() => startPlacementPreview(task.id)} onCancelPlacementPreview={cancelPlacementPreview} onConfirmPlacementPreview={() => confirmPlacementPreview(task.id)} onApplyTimeSettings={(settings) => applyCandidateTimeSettings(task.id, settings)} onSaveDueDate={(date) => updateTask(task.id, { dueDate: date })} onSaveRecurrence={(recurrence) => saveTaskRecurrence(task.id, recurrence)} onClick={() => openTaskEdit(task)} onPointerDragStart={(event) => beginShelfDrag(event, task, "candidate")} onToggleDone={() => toggleTaskDone(task.id)} onToggleSubtask={(subtaskId) => updateTask(task.id, { subtasks: toggleSubtaskInTree(task.subtasks || [], subtaskId) })} onSubtaskDragStart={(event, subtaskId) => beginCandidateSubtaskDrag(event, task, subtaskId)} onMoveToPlanning={isEventDisplayTask(task) ? undefined : () => moveCandidateToPlanning(task.id)} onMetaUpdate={(patch) => updateTask(task.id, patch)} dragState={drag?.source === "candidate" && drag.taskId === task.id ? "source-placeholder" : undefined} lang={lang} />
                              {dropHere && candidateDropTarget.position === "after" && <div className="df-list-insertion-line" aria-hidden="true" />}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
              ) : visibleCandidates.map((task) => (
                <div
                  key={task.id}
                  className={`df-candidate-task-row${completingTaskIds.has(task.id) ? " is-completing" : ""}${drag?.source === "candidate" && candidateDropTarget?.taskId === task.id ? ` is-candidate-drop is-${candidateDropTarget.position}` : ""}`}
                  data-candidate-task-id={isEventDisplayTask(task) ? undefined : task.id}
                  onClickCapture={(event) => {
                    if (!(event.target as HTMLElement).closest(".df-block-check")) return;
                    event.stopPropagation();
                    toggleCandidateTaskDone(task);
                  }}
                >
                  {drag?.source === "candidate" && candidateDropTarget?.taskId === task.id && candidateDropTarget.position === "before" && <div className="df-list-insertion-line" aria-hidden="true" />}
                  <TaskCard task={task} projects={projects} focusDate={today} placementPreview={placementPreview} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => deleteTaskById(task.id)} onStartPlacementPreview={() => startPlacementPreview(task.id)} onCancelPlacementPreview={cancelPlacementPreview} onConfirmPlacementPreview={() => confirmPlacementPreview(task.id)} onApplyTimeSettings={(settings) => applyCandidateTimeSettings(task.id, settings)} onSaveDueDate={(date) => updateTask(task.id, { dueDate: date })} onSaveRecurrence={(recurrence) => saveTaskRecurrence(task.id, recurrence)} onClick={() => openTaskEdit(task)} onPointerDragStart={(event) => beginShelfDrag(event, task, "candidate")} onToggleDone={() => toggleTaskDone(task.id)} onToggleSubtask={(subtaskId) => updateTask(task.id, { subtasks: toggleSubtaskInTree(task.subtasks || [], subtaskId) })} onSubtaskDragStart={(event, subtaskId) => beginCandidateSubtaskDrag(event, task, subtaskId)} onMoveToPlanning={isEventDisplayTask(task) ? undefined : () => moveCandidateToPlanning(task.id)} onMetaUpdate={(patch) => updateTask(task.id, patch)} dragState={drag?.source === "candidate" && drag.taskId === task.id ? "source-placeholder" : undefined} lang={lang} />
                  {drag?.source === "candidate" && candidateDropTarget?.taskId === task.id && candidateDropTarget.position === "after" && <div className="df-list-insertion-line" aria-hidden="true" />}
                </div>
              ))}
              {shouldShowHabitCandidates(settings) && (
                <HabitCandidateCard
                  habits={habits}
                  habitDailyStates={habitDailyStates}
                  today={today}
                  lang={lang}
                  onToggle={toggleHabitDaily}
                  onPointerDragStart={beginHabitDrag}
                  onFocusScheduled={focusHabitSchedule}
                  onEditHabit={openHabitDetail}
                  onOpenOverview={openHabitOverview}
                  isClickSuppressed={() => suppressBlockClickRef.current}
                  draggedHabitId={drag?.source === "candidate" ? drag.taskId : null}
                />
              )}
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
          </CandidatePanelShell>

          <section
            className={`df-timeline-panel${compactExecuteView === "schedule" ? " compact-active" : " compact-inactive"}`}
            aria-hidden={compactLayout && compactExecuteView !== "schedule"}
            id="df-execute-timeline"
            data-cross-day-scroll={settings.continuousCrossDayScroll !== false ? "true" : "false"}
            onWheelCapture={handleTimelinePanelWheel}
          >
            {yearOverviewOpen ? (
              <YearCalendarOverview
                year={overviewYear}
                selectedDate={selectedDate}
                today={today}
                lang={lang}
                tasks={tasks}
                events={events}
                onYearChange={setOverviewYear}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  setTimelineView("daily");
                  setYearOverviewOpen(false);
                }}
                onToday={() => {
                  setSelectedDate(today);
                  setOverviewYear(new Date(`${today}T00:00:00`).getFullYear());
                  setTimelineView("daily");
                  setYearOverviewOpen(false);
                }}
              />
            ) : <>
            <div className="df-execute-top-legacy" style={{ display: "none" }} aria-hidden="true">
              {!settings.hideAi && <div className="df-ai-planner" aria-hidden={compactLayout}>
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
                  <label>{t(lang, "timeline.scope")}<select value={aiPlanPrefs.scope} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, scope: event.target.value as AiPlanPrefs["scope"] }))}><option value="day">{viewLabel(lang, "daily")}</option><option value="3day">{viewLabel(lang, "3day")}</option><option value="week">{lang === "zh" ? "本周" : "This week"}</option></select></label>
                  <label>{t(lang, "timeline.strategy")}<select value={aiPlanPrefs.strategy} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, strategy: event.target.value as AiPlanPrefs["strategy"] }))}><option value="alternativeProject">{t(lang, "timeline.alternateByProject")}</option><option value="byProject">{t(lang, "timeline.scheduleByProject")}</option><option value="longShort">{t(lang, "timeline.alternateLongShort")}</option><option value="random">{t(lang, "timeline.random")}</option></select></label>
                </span>}
              </div>}
              <div className="df-timeline-actions">
                {autoScheduleState === "preview" && schedulePreviews.length > 0 && (
                  <span className="df-ai-plan-summary">{`${t(lang, "timeline.previewPlan").replace("X", String(schedulePreviews.length))}`}</span>
                )}
                {scheduleUnscheduled.length > 0 && <details className="df-ai-plan-unscheduled"><summary>{lang === "zh" ? `${scheduleUnscheduled.length} 项暂未安排` : `${scheduleUnscheduled.length} not scheduled`}</summary>{scheduleUnscheduled.map((item) => <div key={item.taskId}><strong>{item.title}</strong><small>{item.reason}</small></div>)}</details>}
              </div>
            </div>
            <div className="df-timeline-body">
              {!compactLayout && <>
                <button className="df-date-arrow left" aria-label={t(lang, "timeline.prevSegment")} onClick={() => shiftTimeline(-1)}>‹</button>
                <button className="df-date-arrow right" aria-label={t(lang, "timeline.nextSegment")} onClick={() => shiftTimeline(1)}>›</button>
              </>}
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
                {showBackToNow && (
                  <button className="df-back-to-now" type="button" onClick={goToNow} title={lang === "zh" ? "回到现在" : "Back to now"} aria-label={lang === "zh" ? "回到现在" : "Back to now"}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
                    <span>{lang === "zh" ? "现在" : "Now"}</span>
                  </button>
                )}
                {(timelineView === "3day" || timelineView === "weekly") ? (() => {
                  const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineWindowAnchorDate);
                  const weekdayShort = lang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const canvasHeight = continuousTimelineEnabled ? dailyTimelineCanvasHeight : ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * timelineSlotHeight;
                  const slotCount = continuousTimelineEnabled ? dailyTimelineSlotCount : ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1;
                  const multiDayScheduledTasks = [...expandedVisibleTimelineTasks.filter((task) => continuousTimelineDates.includes(task.scheduledDate || "")), ...previewTasks.filter((task) => continuousTimelineDates.includes(task.scheduledDate || ""))].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
                  return (
                    <div className={`df-timeline-3day ${timelineView === "weekly" ? "df-week-view" : ""}`} style={{ "--df-day-columns": String(threeDates.length) } as CSSProperties}>
                      <div className="df-timeline-3day-top">
                        <div className="df-timeline-3day-ruler-spacer" />
                        <div className="df-timeline-3day-dates">
                          {threeDates.map((colDate) => {
                            const isToday = colDate === today;
                            const dateObj = new Date(`${colDate}T00:00:00`);
                            return (
                              <div key={colDate} data-date={colDate} className={`df-timeline-3day-date${isToday ? " today" : ""}`}>
                                <span className="df-timeline-3day-date-num">{dateObj.getDate()}</span>
                                <span className="df-timeline-3day-date-sep"></span>
                                <span className="df-timeline-3day-date-wd">{weekdayShort[dateObj.getDay()]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className={`df-timeline-3day-allday${allDayDragDate && drag ? " drag-over" : ""}`}
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
                          setAllDayDragDate("");
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
                              ...allDayTimelineTasks.filter((task) => task.scheduledDate === colDate),
                              ...eventVisibleTimeline.tasks.filter((task) => !task.scheduledStart && task.scheduledDate === colDate),
                            ];
                            return (
                              <div key={colDate} className="df-timeline-3day-allday-cell" data-date={colDate} data-all-day-date={colDate}
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
                                {allDayDragDate === colDate && drag && draggedTask && <AllDayDropPreview task={draggedTask} />}
                                {adTasks.map((task) => (
                                  <AllDayBlock key={task.id} task={task} dragging={drag?.source === "allDay" && drag.taskId === task.id} projectName={projectName(task)} projects={projects} onEdit={() => { if (!suppressBlockClickRef.current) openTaskEdit(task); }} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onPointerDragStart={(event) => beginShelfDrag(event, task, "allDay")} lang={lang} />
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
                                const minutes = ((dayStartHour * 60 + index * SLOT_MINUTES) % (24 * 60));
                                const isHour = minutes % 60 === 0;
                                const isMajor = minutes % (6 * 60) === 0;
                                const label = continuousTimelineEnabled ? dailyContinuousSlotLabel({ index, anchorDate: continuousTimelineStartDate, dayStartHour, dateStep: timelineColumnCount }) : hourLabel(minutes);
                                const boundarySeparator = label.indexOf(" ");
                                const boundaryDate = boundarySeparator > 0 ? label.slice(0, boundarySeparator) : "";
                                const timeLabel = boundarySeparator > 0 ? label.slice(boundarySeparator + 1) : label;
                                return (
                                  <div className={`df-slot-ruler ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * timelineSlotHeight}px` }} key={index}>
                                    {isHour ? <span className={`df-timeline-ruler-label${boundaryDate ? " day-boundary" : ""}`}>{boundaryDate && <small>{boundaryDate}</small>}<b>{timeLabel}</b></span> : null}
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
                                const target = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : getDropTargetFromPointer({
                                  clientX: event.clientX, clientY: event.clientY,
                                  gridElement: gridEl,
                                  scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  startHour: dayStartHour,
                                  hourHeight: timelineHourHeight,
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
                                  const target = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : getDropTargetFromPointer({
                                    clientX: event.clientX, clientY: event.clientY,
                                    gridElement: gridEl,
                                    scrollElement: scrollEl,
                                    visibleDays: threeDates,
                                    startHour: dayStartHour,
                                    hourHeight: timelineHourHeight,
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
                                const startTarget = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : pointerToDateTime({
                                  clientX: event.clientX, clientY: event.clientY,
                                  gridElement: gridEl, scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  startHour: dayStartHour,
                                  hourHeight: timelineHourHeight,
                                });
                                const startMinutes = startTarget.minutes;
                                const startDayIndex = startTarget.dayIndex;
                                let hasMoved = false;
                                const moveHandler = (moveEvent: MouseEvent) => {
                                  if (Math.abs(moveEvent.clientY - event.clientY) < 6) return;
                                  hasMoved = true;
                                  const currentTarget = continuousTimelineEnabled ? continuousPointerTarget(moveEvent.clientX, moveEvent.clientY, gridEl) : pointerToDateTime({
                                    clientX: moveEvent.clientX, clientY: moveEvent.clientY,
                                    gridElement: gridEl, scrollElement: scrollEl,
                                    visibleDays: threeDates,
                                    hourHeight: timelineHourHeight,
                                  });
                                  if (currentTarget.date !== startTarget.date) return;
                                  let s = startMinutes, e = currentTarget.minutes;
                                  if (s > e) { const t = s; s = e; e = t; }
                                  s = Math.max(s, TIMELINE_START * 60);
                                  e = Math.min(e, TIMELINE_END * 60 - SLOT_MINUTES);
                                  if (e - s < SLOT_MINUTES * 2) e = s + SLOT_MINUTES * 2;
                                  const gridRect = gridEl.getBoundingClientRect();
                                  const cw = gridRect.width / threeDates.length;
                                  const gut = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  const startPx = continuousTimelineEnabled ? continuousTimedTop(startTarget.date, minutesToTime(s)) : ((s - TIMELINE_START * 60) / SLOT_MINUTES) * timelineSlotHeight;
                                  const endPx = startPx + ((e - s) / SLOT_MINUTES) * timelineSlotHeight;
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
                                if (clearTimelineSelection()) return;
                                const gridEl = timeGridRef.current;
                                const scrollEl = timelineRef.current;
                                if (!gridEl || !scrollEl) return;
                                const target = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : pointerToDateTime({
                                  clientX: event.clientX,
                                  clientY: event.clientY,
                                  gridElement: gridEl,
                                  scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  startHour: dayStartHour,
                                  hourHeight: timelineHourHeight,
                                });
                                const startMinutes = timeToMinutes(target.startTime);
                                const endMinutes = Math.min(startMinutes + 30, TIMELINE_END * 60);
                                const gridRect = gridEl.getBoundingClientRect();
                                const columnWidth = gridRect.width / threeDates.length;
                                const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                const top = continuousTimelineEnabled
                                  ? continuousTimedTop(target.date, target.startTime)
                                  : ((startMinutes - TIMELINE_START * 60) / SLOT_MINUTES) * timelineSlotHeight;
                                setDragCreate({
                                  date: target.date,
                                  dayIndex: target.dayIndex,
                                  startMinutes,
                                  endMinutes,
                                  top,
                                  height: ((endMinutes - startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
                                  left: target.dayIndex * columnWidth + gutter,
                                  width: columnWidth - gutter * 2,
                                  committed: true,
                                });
                              }}
                            >
                              {/* Layer 1: Shared hour lines across all columns */}
                              <div className="df-hour-lines-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
                                {Array.from({ length: slotCount }).map((_, index) => {
                                  const minutes = ((dayStartHour * 60 + index * SLOT_MINUTES) % (24 * 60));
                                  const isHour = minutes % 60 === 0;
                                  const isMajor = minutes % (6 * 60) === 0;
                                  return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * timelineSlotHeight}px` }} key={index} />;
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
                                {multiColWidth > 0 && multiDayScheduledTasks.map((task) => {
                                  const dayOffset = continuousDateOffset(task.scheduledDate || "");
                                  const dayIndex = continuousTimelineEnabled ? ((dayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(task.scheduledDate || "");
                                  if (dayIndex === -1) return null;
                                  const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
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
                                    <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} showResizeHint={resizeHintTaskId === resolveTimelineRecordId(task.id)} projectInteractive={!compactLayout} onHover={setHoveredBlock} onSelect={() => selectTimelineTask(task)} onEdit={() => {
                                      if (!suppressBlockClickRef.current) openTaskEdit(task);
                                    }} onToggleDone={() => toggleTaskDone(task.id)} onTaskUpdate={(patch) => updateTask(resolveOwningTask(task.id)?.id || task.id, patch)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                                      createProjectForTask(task.id, title);
                                    }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} resizeEdges={explicitVisibleTimeline.resizeEdges.get(task.id) || eventVisibleTimeline.resizeEdges.get(task.id)}
                                      extraStyle={{ position: "absolute", left, width, top: continuousTimelineEnabled ? continuousTimedTop(task.scheduledDate || timelineDate, task.scheduledStart || "09:00") : undefined, pointerEvents: "auto", overflow, ...(isPreview ? { ["--df-preview" as any]: "1" } as CSSProperties : {}) }}
                                      onAcceptPreview={isPreview ? () => acceptOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                                      onCancelPreview={isPreview ? () => cancelOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                                      viewMode={timelineView}
                                      lang={lang}
                                      dayStartHour={dayStartHour}
                                      hourHeight={timelineHourHeight}
                                      dragState={drag?.kind === "block" && drag.taskId === task.id ? "source-placeholder" : undefined}
                                    />
                                  );
                                })}
                                {/* Preview block during drag */}
                                {multiColWidth > 0 && hoverSlot && drag && !drag.outsideTimeline && (() => {
                                  const tgtDate = dragTargetDateRef.current || threeDates[0];
                                  const dayOffset = continuousDateOffset(tgtDate);
                                  const dayIndex = continuousTimelineEnabled ? ((dayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(tgtDate);
                                  if (dayIndex === -1) return null;
                                  const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  return (
                                    <SnappedTimelineDragBlock task={draggedTask} startTime={hoverSlot} duration={drag.duration} projectName={draggedTask ? projectName(draggedTask) : ""} projects={projects} viewMode={timelineView} lang={lang}
                                      extraStyle={{ position: "absolute", left: dayIndex * multiColWidth + gutter, width: multiColWidth - gutter * 2, top: continuousTimelineEnabled ? continuousTimedTop(tgtDate, hoverSlot) : undefined }}
                                      dayStartHour={dayStartHour}
                                      hourHeight={timelineHourHeight}
                                    />
                                  );
                                })()}
                                {multiColWidth > 0 && placementPreviewTask && placementPreview && (() => {
                                  const dayOffset = continuousDateOffset(placementPreview.date);
                                  const dayIndex = continuousTimelineEnabled ? ((dayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(placementPreview.date);
                                  if (dayIndex === -1) return null;
                                  const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  return (
                                    <PreviewBlock
                                      task={placementPreviewTask}
                                      startTime={placementPreview.startTime}
                                      duration={placementPreview.durationMinutes}
                                      extraStyle={{
                                        position: "absolute",
                                        left: dayIndex * multiColWidth + gutter,
                                        width: multiColWidth - gutter * 2,
                                        top: continuousTimelineEnabled ? continuousTimedTop(placementPreview.date, placementPreview.startTime) : undefined,
                                        ["--df-preview" as any]: "1",
                                      } as CSSProperties}
                                      dayStartHour={dayStartHour}
                                      hourHeight={timelineHourHeight}
                                    />
                                  );
                                })()}
                                {/* Now line — only in today's column in multi-day view */}
                                {(() => {
                                  // Render the now-line whenever today is inside the visible
                                  // date range, regardless of whether infinite cross-day
                                  // scrolling is enabled. In continuous mode the range is the
                                  // 7-day vertical canvas; in non-continuous mode it is the
                                  // 3-day/week window derived from `threeDates`.
                                  if (!continuousTimelineDates.includes(today) || multiColWidth <= 0) return null;
                                  const todayOffset = continuousDateOffset(today);
                                  const todayIdx = continuousTimelineEnabled ? ((todayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(today);
                                  if (todayIdx === -1) return null;
                                  const now = new Date();
                                  return <NowLine extraStyle={{ left: todayIdx * multiColWidth, width: multiColWidth, top: continuousTimelineEnabled ? continuousTimedTop(today, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`) : undefined }} lang={lang} dayStartHour={dayStartHour} hourHeight={timelineHourHeight} />;
                                })()}
                                {/* Empty state */}
                                {multiDayScheduledTasks.length === 0 && !drag && <div className="df-timeline-empty small"><div className="blob-accent" />--</div>}
                              </div>
                              {dragCreate && (
                                <div className="drag-create-preview df-task-block df-task-block--scheduled df-time-block-quick-add" style={{
                                  position: "absolute", zIndex: 99998, borderRadius: "12px",
                                  overflow: "visible",
                                  top: `${dragCreate.top}px`, height: `${dragCreate.height}px`,
                                  ...draftConflictStyle(dragCreate, timelineView),
                                }}>
                                  <span className="df-timeline-draft-time">{minutesToTime(dragCreate.startMinutes)} – {minutesToTime(dragCreate.endMinutes)}</span>
                                  <button type="button" className="df-timeline-draft-handle start" aria-label={lang === "zh" ? "拖动调整开始时间" : "Drag to adjust start"} onPointerDown={(event) => beginDragCreateResize(event, "start")} />
                                  <button type="button" className="df-timeline-draft-handle end" aria-label={lang === "zh" ? "拖动调整结束时间" : "Drag to adjust end"} onPointerDown={(event) => beginDragCreateResize(event, "end")} />
                                  {dragCreate.committed && !compactLayout ? (
                                    <DragCreateQuickAdd state={dragCreate} projects={projects}
                                      onSave={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks)}
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
                  const weeks = buildWeekWindow(timelineDate, 20, 30, settings.weekStartsOn);
                  const allMonthDays = weeks.flat();
                  const visibleMonthDays = new Set(allMonthDays);
                  const monthEvents = expandEventOccurrences(visibleMonthDays).tasks;
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
                        <div className="df-month-title">
                          <span className="df-month-name">{(() => { const d = new Date(`${monthFocus || timelineDate.slice(0, 7)}-01T00:00:00`); return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" }); })()}</span>
                        </div>
                      </div>
                      <div className="df-month-body">
                        <div className="df-month-weekdays">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => <span key={day}>{day}</span>)}</div>
                        <div className="df-month-scroll" ref={monthScrollRef} onScroll={(event) => {
                          const element = event.currentTarget;
                          const probeY = element.getBoundingClientRect().top + Math.min(180, element.clientHeight * 0.35);
                          const focused = Array.from(element.querySelectorAll<HTMLElement>(".df-month-cell[data-date]")).find((cell) => { const rect = cell.getBoundingClientRect(); return rect.top <= probeY && rect.bottom >= probeY; });
                          if (focused?.dataset.date) setMonthFocus(focused.dataset.date.slice(0, 7));
                          if (element.scrollTop < 160) {
                            const anchor = element.querySelector<HTMLElement>("[data-week-anchor]");
                            monthAnchorOffsetRef.current = anchor?.offsetTop ?? element.scrollTop;
                            setSelectedDate(addDays(timelineDate, -140));
                          } else if (element.scrollTop + element.clientHeight > element.scrollHeight - 160) {
                            const anchor = element.querySelector<HTMLElement>("[data-week-anchor]");
                            monthAnchorOffsetRef.current = anchor?.offsetTop ?? element.scrollTop;
                            setSelectedDate(addDays(timelineDate, 140));
                          }
                        }}>
                          {weeks.map((weekDays, wi) => {
                            const weekTaskCounts = weekDays.map((d) => getDayTasks(d).length);
                            const maxTasks = Math.max(...weekTaskCounts, 1);
                            const weekH = baseDayH + maxTasks * (taskH + taskGap) + weekPad;
                            return (
                              <div key={weekDays[0]} data-week-anchor={weekDays[0]} className="df-month-week-row" style={{ height: weekH }}>
                                {weekDays.map((day) => {
                                  const dateObj = new Date(`${day}T00:00:00`);
                                  const dayTasks = getDayTasks(day);
                                  return (
                                    <div key={day} data-date={day} className={`df-month-cell${day.slice(0, 7) === (monthFocus || timelineDate.slice(0, 7)) ? " focus-month" : " muted"}${day === today ? " today" : ""}${drag ? " drag-active" : ""}`}
                                      onClick={(event) => {
                                        if (drawerOpen || drag) return;
                                        if ((event.target as HTMLElement).closest(".df-month-task,.df-month-task *")) return;
                                        if (compactLayout) {
                                          setSelectedDate(day);
                                          setTimelineView("daily");
                                          return;
                                        }
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
                                              const estimatedMinutes = learnedTaskDurationMinutes(title, data.tasks, projectId || undefined);
                                              const newTask = makeSmartTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: day, estimatedHours: estimatedMinutes / 60 });
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
                    <button
                      type="button"
                      className={`df-date-title df-date-title-compact df-date-title-button${timelineWindowAnchorDate === today ? " today" : ""}`}
                      aria-expanded={mobileDatePickerOpen}
                      aria-label={lang === "zh" ? "打开日期快选" : "Open quick date picker"}
                      onClick={() => {
                        if (compactLayout) return;
                        setMobileDatePickerMonth(timelineWindowAnchorDate.slice(0, 7));
                        setMobileDatePickerOpen((open) => !open);
                      }}
                    >
                      <span className="df-date-num">{(() => { const d = new Date(`${timelineWindowAnchorDate}T00:00:00`); return d.getDate(); })()}</span>
                      <span className="df-date-sep"></span>
                      <span className="df-date-wd">
                        {(() => {
                          const weekdayShort = lang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          const d = new Date(`${timelineWindowAnchorDate}T00:00:00`);
                          return weekdayShort[d.getDay()];
                        })()}
                      </span>
                      <span className={`df-date-title-chevron${mobileDatePickerOpen ? " open" : ""}`} aria-hidden="true">⌄</span>
                    </button>
                    {!compactLayout && mobileDatePickerOpen && (
                      <MobileDateQuickPicker
                        month={mobileDatePickerMonth}
                        selectedDate={timelineWindowAnchorDate}
                        today={today}
                        weekStartsOn={settings.weekStartsOn}
                        lang={lang}
                        onMonthChange={setMobileDatePickerMonth}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setVisibleTimelineDate(date);
                          setMobileDatePickerOpen(false);
                          setDragCreate(null);
                          lastTimelineAutoScrollKeyRef.current = "";
                        }}
                      />
                    )}
                    <div
                      className={`df-timeline-allday${allDayDragDate === timelineWindowAnchorDate && drag ? " drag-over" : ""}`}
                      data-all-day-date={timelineWindowAnchorDate}
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
                        setAllDayDragDate("");
                        const taskId = e.dataTransfer.getData("taskId") || drag?.taskId;
                        if (taskId) makeAllDay(taskId, timelineWindowAnchorDate);
                      }}
                    >
                      <span className="df-timeline-allday-label">{t(lang, "timeline.allDay")}</span>
                      <div className="df-timeline-allday-content"
                        onClick={(event) => {
                          if (drawerOpen || drag || resizePreview || autoScheduleState === "generating") return;
                          if ((event.target as HTMLElement).closest(".df-all-day-block,.df-all-day-quick")) return;
                          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                          const gutter = 6;
                          setAllDayQuickAdd({ date: timelineWindowAnchorDate, left: rect.left + gutter, top: rect.top + 4, width: rect.width - gutter * 2, dayIndex: 0 });
                        }}
                      >
                        {allDayQuickAdd && !drag && (
                          <AllDayQuickAddPopover add={allDayQuickAdd} projects={projects} onSave={(title) => createAllDayTask(title, allDayQuickAdd.date, null)} onCancel={() => setAllDayQuickAdd(null)} />
                        )}
                        {allDayDragDate === timelineWindowAnchorDate && drag && draggedTask && <AllDayDropPreview task={draggedTask} />}
                        {[
                          ...tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === timelineWindowAnchorDate),
                          ...allDayTimelineTasks.filter((task) => task.scheduledDate === timelineWindowAnchorDate),
                          ...eventVisibleTimeline.tasks.filter((task) => !task.scheduledStart && task.scheduledDate === timelineWindowAnchorDate),
                        ].map((task) => (
                          <AllDayBlock key={task.id} task={task} dragging={drag?.source === "allDay" && drag.taskId === task.id} projectName={projectName(task)} projects={projects} onEdit={() => { if (!suppressBlockClickRef.current) openTaskEdit(task); }} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onPointerDragStart={(event) => beginShelfDrag(event, task, "allDay")} lang={lang} />
                        ))}
                      </div>
                    </div>
                    <TimelineCanvas
                      scrollRef={timelineRef}
                      canvasRef={timelineCanvasRef}
                      height={dailyTimelineCanvasHeight}
                      onScrollDragOver={(event) => {
                      event.preventDefault();
                      const gridEl = timelineCanvasRef.current;
                      const scrollEl = timelineRef.current;
                      if (gridEl && scrollEl) {
                        const target = getDropTargetFromPointer({
                          clientX: event.clientX, clientY: event.clientY,
                          gridElement: gridEl,
                          scrollElement: scrollEl,
                          visibleDays: [timelineDate],
                          startHour: dayStartHour,
                          hourHeight: timelineHourHeight,
                          debugLabel: "drag-daily",
                        });
                        const dailyTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : target;
                        dragTargetDateRef.current = dailyTarget.date;
                        setHoverSlot(dailyTarget.startTime);
                      }
                    }} onScrollDrop={(event) => {
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
                            startHour: dayStartHour,
                            hourHeight: timelineHourHeight,
                          });
                          const dailyTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : target;
                          dragTargetDateRef.current = dailyTarget.date;
                          scheduleTask(taskId, dailyTarget.startTime);
                        } else {
                          scheduleTask(taskId, hoverSlot || slotFromPointer(event.clientY, 0, event.clientX));
                        }
                      }
                    }} onScrollDragLeave={() => { setHoverSlot(""); dragTargetDateRef.current = ""; }}
                      onCanvasMouseDown={(event) => {
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
                            startHour: dayStartHour,
                            hourHeight: timelineHourHeight,
                          });
                          const dailyStartTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : startTarget;
                          const startMinutes = dailyStartTarget.minutes;
                          const startDate = dailyStartTarget.date;
                          const snap = SLOT_MINUTES;
                          let hasMoved = false;
                          const moveHandler = (moveEvent: MouseEvent) => {
                            if (Math.abs(moveEvent.clientY - event.clientY) < 6) return;
                            hasMoved = true;
                            const currentTarget = getDropTargetFromPointer({
                              clientX: moveEvent.clientX, clientY: moveEvent.clientY,
                              gridElement: gridEl, scrollElement: scrollEl,
                              visibleDays: [timelineDate],
                              startHour: dayStartHour,
                              hourHeight: timelineHourHeight,
                            });
                            const dailyCurrentTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(moveEvent.clientY) : currentTarget;
                            if (dailyCurrentTarget.date !== startDate) return;
                            let s = startMinutes, e = dailyCurrentTarget.minutes;
                            if (s > e) { const t = s; s = e; e = t; }
                            s = Math.max(s, TIMELINE_START * 60);
                            e = Math.min(e, TIMELINE_END * 60 - SLOT_MINUTES);
                            if (e - s < SLOT_MINUTES * 2) e = s + SLOT_MINUTES * 2;
                            const gridRect = gridEl.getBoundingClientRect();
                            const startPx = continuousTimedTop(startDate, minutesToTime(s));
                            const endPx = startPx + ((e - s) / SLOT_MINUTES) * timelineSlotHeight;
                            const gut = compactLayout ? 0 : 8;
                            setDragCreate({
                              date: startDate, dayIndex: 0,
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
                              setDragCreate((prev) => prev ? { ...prev, committed: true } : prev);
                            }
                          };
                          window.addEventListener("mousemove", moveHandler);
                          window.addEventListener("mouseup", upHandler);
                          window.addEventListener("keydown", keyHandler);
                        }}
                        onCanvasClick={(event) => {
                          if (dragCreateSuppressClickRef.current) { dragCreateSuppressClickRef.current = false; return; }
                          if (suppressBlockClickRef.current) return;
                          if (drag || resizePreview) return;
                          if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule")) return;
                          if (clearTimelineSelection()) return;
                          const startTime = slotFromPointer(event.clientY, 0, event.clientX);
                          const target = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : { date: timelineDate };
                          const startMinutes = timeToMinutes(startTime);
                          const endMinutes = Math.min(startMinutes + 30, TIMELINE_END * 60);
                          const canvasWidth = timelineCanvasRef.current?.getBoundingClientRect().width || 300;
                          setDragCreate({
                            date: target.date,
                            dayIndex: 0,
                            startMinutes,
                            endMinutes,
                            top: settings.continuousCrossDayScroll !== false
                              ? continuousTimedTop(target.date, startTime)
                              : timeBlockTop(startTime, dayStartHour),
                            height: ((endMinutes - startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
                            left: compactLayout ? 0 : 8,
                            width: canvasWidth - (compactLayout ? 0 : 16),
                            committed: true,
                          });
                        }}
                    >
                        {Array.from({ length: dailyTimelineSlotCount }).map((_, index) => {
                          const minutes = ((dayStartHour * 60 + index * SLOT_MINUTES) % (24 * 60));
                          const isHour = minutes % 60 === 0;
                          const isMajor = minutes % (6 * 60) === 0;
                          const label = dailyContinuousSlotLabel({ index, anchorDate: continuousTimelineStartDate, dayStartHour });
                          return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * timelineSlotHeight}px` }} key={index}><span>{label}</span></div>;
                        })}
                        {/* Now line — renders whenever today is inside the visible date range.
                            In non-continuous daily mode the range is [timelineDate], so this
                            evaluates to true only when viewing today. In continuous mode the
                            range is the 7-day vertical canvas. Position uses `dayStartHour`
                            in non-continuous mode (via NowLine's internal timeBlockTop) and
                            the continuous absolute coordinate in continuous mode. */}
                        {continuousTimelineDates.includes(today) && (() => { const now = new Date(); return <NowLine lang={lang} dayStartHour={dayStartHour} hourHeight={timelineHourHeight} extraStyle={{ top: continuousTimelineEnabled ? continuousTimedTop(today, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`) : undefined }} />; })()}
                        {hoverSlot && drag && !drag.outsideTimeline && <SnappedTimelineDragBlock task={draggedTask} startTime={hoverSlot} duration={drag.duration} projectName={draggedTask ? projectName(draggedTask) : ""} projects={projects} viewMode="daily" lang={lang} dayStartHour={dayStartHour} hourHeight={timelineHourHeight} extraStyle={continuousTimelineEnabled ? { top: continuousTimedTop(dragTargetDateRef.current || timelineWindowAnchorDate, hoverSlot) } : undefined} />}
                        {placementPreviewTask && placementPreview && continuousTimelineDates.includes(placementPreview.date) && (
                          <PreviewBlock
                            task={placementPreviewTask}
                            startTime={placementPreview.startTime}
                            duration={placementPreview.durationMinutes}
                            extraStyle={{ top: continuousTimelineEnabled ? continuousTimedTop(placementPreview.date, placementPreview.startTime) : undefined, ["--df-preview" as any]: "1" } as CSSProperties}
                            dayStartHour={dayStartHour}
                            hourHeight={timelineHourHeight}
                          />
                        )}
                        {scheduledTasks.map((task) => {
                          // Use dailyCanvasWidth from ResizeObserver if available,
                          // otherwise fall back to synchronously reading the DOM ref.
                          const liveEl = timelineCanvasRef.current;
                          const liveW = liveEl ? liveEl.getBoundingClientRect().width : 0;
                          const avail = dailyCanvasWidth > 0 ? dailyCanvasWidth : liveW;
                          const gutter = compactLayout ? 0 : 8;
                          const innerW = avail > 0 ? avail - gutter * 2 : 0;
                          const baseLeft = gutter;
                          const gap = compactLayout ? 2 : 4;
                          const cs = innerW > 0 ? computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap, "daily") : null;
                          const left = cs ? cs.left : baseLeft;
                          const width = cs ? cs.width : innerW;
                          const top = continuousTimedTop(task.scheduledDate || timelineDate, task.scheduledStart || "09:00");
                          const extraStyle: CSSProperties | undefined = innerW > 0 ? { left, width, top } : { top };

                          const isPreview = previewIdByClonedId.has(task.id);
                          return (
                            <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} showResizeHint={resizeHintTaskId === resolveTimelineRecordId(task.id)} projectInteractive={!compactLayout} onHover={setHoveredBlock} onSelect={() => selectTimelineTask(task)} onEdit={() => {
                              if (!suppressBlockClickRef.current) openTaskEdit(task);
                            }} onToggleDone={() => toggleTaskDone(task.id)} onTaskUpdate={(patch) => updateTask(resolveOwningTask(task.id)?.id || task.id, patch)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                              createProjectForTask(task.id, title);
                            }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} resizeEdges={explicitVisibleTimeline.resizeEdges.get(task.id) || eventVisibleTimeline.resizeEdges.get(task.id)} extraStyle={{ ...extraStyle, ...(isPreview ? { ["--df-preview" as any]: "1" } as CSSProperties : {}) }}
                              onAcceptPreview={isPreview ? () => acceptOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                              onCancelPreview={isPreview ? () => cancelOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                              viewMode="daily"
                              lang={lang}
                              dayStartHour={dayStartHour}
                              hourHeight={timelineHourHeight}
                              dragState={drag?.kind === "block" && drag.taskId === task.id ? "source-placeholder" : undefined}
                            />
                          );
                        })}
                        {dragCreate && (
                          <div className="drag-create-preview df-task-block df-task-block--scheduled df-time-block-quick-add" style={{
                            position: "absolute", zIndex: 99998, borderRadius: "12px",
                            overflow: "visible",
                            top: `${dragCreate.top}px`, height: `${dragCreate.height}px`,
                            ...draftConflictStyle(dragCreate, "daily"),
                          }}>
                            <span className="df-timeline-draft-time">{minutesToTime(dragCreate.startMinutes)} – {minutesToTime(dragCreate.endMinutes)}</span>
                            <button type="button" className="df-timeline-draft-handle start" aria-label={lang === "zh" ? "拖动调整开始时间" : "Drag to adjust start"} onPointerDown={(event) => beginDragCreateResize(event, "start")} />
                            <button type="button" className="df-timeline-draft-handle end" aria-label={lang === "zh" ? "拖动调整结束时间" : "Drag to adjust end"} onPointerDown={(event) => beginDragCreateResize(event, "end")} />
                            {dragCreate.committed && !compactLayout ? (
                              <DragCreateQuickAdd state={dragCreate} projects={projects}
                                onSave={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks)}
                                onCancel={() => setDragCreate(null)}
                              />
                            ) : (
                              null
                            )}
                          </div>
                        )}
                    </TimelineCanvas>
                  </div>
                )}
              </div>
              <div className="df-view-switch-vertical" aria-label={t(lang, "timeline.switchView")}>
                {([
                  ["daily", viewLabel(lang, "daily")],
                  ["3day", viewLabel(lang, "3day")],
                  ["weekly", viewLabel(lang, "weekly")],
                  ["month", viewLabel(lang, "month")]
                ] as Array<[TimelineView, string]>).map(([view, label]) => <button key={view} className={timelineView === view ? "active" : ""} onClick={() => changeTimelineView(view)}>{label}</button>)}
              </div>
            </div>
            </>}
          </section>
        </ExecutionSplitLayout>
      ) : (
        <Suspense fallback={<div className="df-loading-inline">规划加载中...</div>}>
          <PlanningViewLazy lang={lang} data={data} projects={projects} tasks={tasks} compact={compactLayout} collapsed={collapsedBranches} setCollapsed={setCollapsedBranches} onToggleTodayCandidate={togglePlanningTodayCandidate} onPromoteSubtaskToToday={promotePlanningSubtask} onProjectEdit={openProjectEdit} onProjectComplete={completeProject} onTaskEdit={openTaskEdit} onTaskUpdate={updateTask} onTaskCreate={createTaskInProject} onDataChange={(nextData) => void saveData(nextData)} onDeleteSubtask={deleteSubtaskById} onTaskDelete={(taskId) => deleteTaskById(taskId)} featureKanban={settings.featureKanbanViewEnabled !== false} featureQuadrant={settings.featureQuadrantViewEnabled !== false} featureList={settings.featureListViewEnabled !== false} featureMetrics={settings.featureMetricsEnabled !== false} dayStartTime={settings.dayStartTime} metricsRangePreset={settings.metricsRangePreset} metricsGroupBy={settings.metricsGroupBy} metricsDisplayMetric={settings.metricsDisplayMetric} metricsIncludeHabits={settings.metricsIncludeHabits} metricsCompletionFilter={settings.metricsCompletionFilter} metricsCustomStart={settings.metricsCustomStart} metricsCustomEnd={settings.metricsCustomEnd} onMetricsSettingsChange={(patch) => void saveSettings(patch)} />
        </Suspense>
      )}

      {compactLayout && dragCreate?.committed && mode === "execute" && (
        <DragCreateQuickAdd
          sheet
          lang={lang}
          state={dragCreate}
          projects={projects}
          onSave={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks)}
          onMore={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks, true)}
          onCancel={() => setDragCreate(null)}
          onRangeChange={updateDragCreateRange}
        />
      )}

      {compactLayout && !drawerOpen && (
        <nav className="df-mobile-dock" aria-label={lang === "zh" ? "工作区导航" : "Workspace navigation"}>
          {!settings.hideAi ? <button className="df-mobile-dock-action df-mobile-ai" onClick={() => { setQuickAddOpen(false); setAiOpen(true); }} aria-label={t(lang, "fab.askNavo")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13Z"/><path d="M9 10.5h6"/></svg>
          </button> : <span className="df-mobile-dock-spacer" aria-hidden="true" />}
          <div className="df-mobile-mode-switch">
            <button className={mode === "execute" ? "active" : ""} onClick={() => changeMode("execute")}>{t(lang, "header.execute")}</button>
            <button className={mode === "planning" ? "active" : ""} onClick={() => changeMode("planning")}>{t(lang, "header.planning")}</button>
          </div>
          <button className="df-mobile-dock-action df-mobile-settings" onClick={() => { rememberLayerTrigger("utility"); setUtilityPanel("settings"); }} aria-label={t(lang, "header.settings")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10.91 3H11a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </nav>
      )}

      {!compactLayout && <button className="df-add-fab df-icon-action i-plus" data-tip={t(lang, "fab.add")} aria-label={t(lang, "fab.add")} onClick={() => openAdd("task")} />}
      {!compactLayout && !settings.hideAi && <button className="df-ai-fab df-icon-action i-ai" data-tip={t(lang, "fab.askNavo")} aria-label={t(lang, "fab.askNavo")} onClick={() => setAiOpen((open) => !open)} />}
      {compactLayout && !drawerOpen && <button
        type="button"
        className="df-mobile-quick-add-fab"
        aria-label={lang === "zh" ? "快速添加任务" : "Quick add task"}
        title={lang === "zh" ? "快速添加任务" : "Quick add task"}
        onClick={() => { if (mode !== "execute") changeMode("execute"); setMobileQuickAddKind("task"); setQuickAddOpen(true); }}
      ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}

      {drawerOpen && !(compactLayout && mobileTaskSummary) && <div className="df-drawer-backdrop" onMouseDown={() => editingId && addType === "task" ? closeTaskDrawer({ autoSave: true }) : closeTaskDrawer()} />}
      {drawerOpen && <EditDrawer type={addType} setType={(type) => { setAddType(type); setQuickAddDetailOpen(false); if (!editingId) setForm(defaultForm(type)); }} form={form} setForm={setForm} projects={projects} editing={Boolean(editingId)} task={tasks.find((task) => task.id === editingId)} event={events.find((event) => event.id === editingId)} today={today} advancedOpen={advancedOpen} setAdvancedOpen={(open) => { setAdvancedOpen(open); void saveSettings({ addAdvancedOpen: open }); }} onClose={() => closeTaskDrawer(editingId && addType === "task" ? { autoSave: true } : undefined)} onSave={saveForm} onDelete={deleteEditingItem} onCopy={copyEditingTask} onConvertToEvent={() => convertTaskToEvent(editingId)} onConvertToTask={() => convertEventToTask(editingId)} onTaskUpdate={updateTask} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onToggleDone={() => updateTask(editingId, { completed: !tasks.find((task) => task.id === editingId)?.completed })} onNextAction={() => void generateNextAction()} clarifyLoading={clarifyLoading} onCreateProject={quickCreateProject} editingRecordId={editingRecordId} setEditingRecordId={setEditingRecordId} editingOccurrence={editingOccurrence} data={data} saveData={saveData} onSaveRecurrence={saveTaskRecurrence} onCancelOccurrence={cancelRecurringOccurrence} onReplanOccurrence={replanRecurringOccurrence} onCancelAllRecurrence={cancelAllRecurringFuture} aiEnabled={!settings.hideAi} subtaskAiLoading={subtaskAiBusyId === editingId} onGenerateSubtasks={(taskId) => void generateTaskSubtasks(taskId)} lang={lang} compactSummary={compactLayout && mobileTaskSummary} onShowMore={() => setMobileTaskSummary(false)} quickAddDetail={quickAddDetailOpen} />}
      {aiOpen && <><button className="df-ai-backdrop" type="button" aria-label={lang === "zh" ? "关闭 AI 对话" : "Close AI dialog"} onClick={() => { cancelAi(); setAiOpen(false); clearAiAttachment(); }} /><AiPanel model={settings.model} models={FALLBACK_AI_MODELS} onModelChange={(model) => void saveSettings({ model, reasoningMode: "instant" })} safetyLevel={settings.aiSafetyLevel || "standard"} onSafetyLevelChange={(aiSafetyLevel) => void saveSettings({ aiSafetyLevel })} input={aiInput} setInput={setAiInput} busy={aiBusy} onSend={() => void sendAi()} onCancel={cancelAi} onPlanToday={() => void planMyDay()} planState={autoScheduleState} onClose={() => { cancelAi(); setAiOpen(false); clearAiAttachment(); }} messages={aiMessages} conversations={data.aiConversations || []} activeConversationId={activeAiConversationId || data.activeAiConversationId || ""} conversationListOpen={aiConversationListOpen} onToggleConversationList={() => { setAiAuditOpen(false); setAiConversationListOpen((open) => !open); }} auditOpen={aiAuditOpen} auditRuns={aiAuditRuns} auditLoading={aiAuditLoading} auditError={aiAuditError} onToggleAudit={() => void toggleAiAuditHistory()} onNewConversation={() => void startNewAiConversation()} onSelectConversation={selectAiConversation} memoryNotice={aiMemoryNotice} onOpenMemorySettings={() => openSettingsSection({ category: "advanced", detail: "ai", anchor: "ai-memory" })} actionPatches={aiActionPatches} onPatchAction={(messageId, index, patch) => setAiActionPatches((current) => ({ ...current, [messageId]: { ...(current[messageId] || {}), [index]: { ...(current[messageId]?.[index] || {}), ...patch } } }))} onConfirmAction={(messageId, action, index) => void confirmAiAction(action, messageId, index)} onDismissAction={(messageId, action, index) => dismissAiAction(action, messageId, index)} onToggleAction={(messageId, index) => setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, selectedActions: { ...message.selectedActions, [index]: message.selectedActions?.[index] === false } } : message))} onSetAllActions={(messageId, checked) => setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, selectedActions: Object.fromEntries((message.actions || []).map((_, index) => [index, checked])) } : message))} onAdoptSelected={(messageId) => void adoptSelectedAiActions(messageId)} onRejectSelected={rejectSelectedAiActions} onViewImport={viewAiImport} onUndoImport={(messageId) => void undoAiImport(messageId)} onApproveAgent={(messageId) => void handleAgentDecision(messageId, "approve")} onRejectAgent={(messageId) => void handleAgentDecision(messageId, "reject")} onUndoAgent={(messageId) => void handleAgentDecision(messageId, "undo")} globalAgentAvailable={authState?.mode === "cloud" && Boolean(authState.user)} projectList={projects.map((p) => ({ id: p.id, title: p.title, color: p.color }))} taskList={tasks.map((task) => ({ id: task.id, title: task.title }))} lang={lang} attachment={aiAttachment} attachmentStatus={aiAttachmentStatus} onAttachment={(file) => void handleAiAttachment(file)} onClearAttachment={clearAiAttachment} /></>}
      <CommandPalette open={commandOpen} query={commandQuery} results={commandResults} lang={lang} onQuery={setCommandQuery} onClose={() => setCommandOpen(false)} onChoose={chooseCommand} />
      {utilityPanel && settings && <UtilityPanel kind={utilityPanel} settings={settings} initialSection={settingsSectionTarget} data={data} authEmail={authState?.user?.email || ""} onClose={() => closeUtilityPanel()} onSave={(patch) => void saveSettings(patch)} onWidgetAction={handleWidgetAction} onSaveData={(next) => void saveData(next)} onClearChatHistory={() => { void saveData({ ...data, chat: [], aiConversations: [], activeAiConversationId: undefined }); setAiMessages([]); setActiveAiConversationId(""); setAiConversationListOpen(false); setAiMemoryNotice(""); }} onShowAbout={() => window.open(`https://navopath.com/changelog?lang=${lang}`, "_blank", "noopener,noreferrer")} onSignOut={authState?.mode === "cloud" && authState.user ? (() => void handleSignOut()) : undefined} onDeleteAccount={authState?.mode === "cloud" && authState.user ? (() => void handleDeleteAccount()) : undefined} onSyncNow={(direction) => handleSyncNow({ direction })} isManualSyncing={isManualSyncing} cloudReady={authState?.mode === "cloud" && Boolean(authState?.user)} lang={lang} onOpenScheduleTemplates={() => closeUtilityPanel(() => setScheduleTemplateOpen(true))} />}
      {habitPanel && data && settings.featureHabitsEnabled !== false && <HabitPanel mode={habitPanel} habitId={editingHabitId} data={data} today={today} lang={lang} onClose={() => { setHabitPanel(null); setEditingHabitId(null); }} onEditHabit={openHabitDetail} onBack={openHabitOverview} onSave={saveHabitEdit} onArchive={toggleHabitArchive} onToggleDay={toggleHabitForDate} onCreateHabit={createHabit} />}
      {focusOverlayMode && (
        <div className="df-focus-overlay" style={focusProject?.color ? { ["--focus-accent" as string]: focusProject.color } as React.CSSProperties : undefined}>
          <div className="df-focus-topbar">
            <div className="df-focus-mode-switch">
              {(["stopwatch", "pomodoro", "flowtime"] as const).map((m) => (
                <button key={m} className={`df-focus-mode-btn${focusOverlayMode === m ? " active" : ""}`} onClick={() => setFocusOverlayMode(m)}>
                  {m === "stopwatch" ? (lang === "zh" ? "秒表" : "Stopwatch") : m === "pomodoro" ? "Pomodoro" : "Flowtime"}
                </button>
              ))}
            </div>
            <button className="df-focus-close" onClick={() => setFocusOverlayMode(null)} aria-label={lang === "zh" ? "关闭" : "Close"}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="df-focus-main">
            <div className="df-focus-timer-display">{focusClockDisplay}</div>
            <div className="df-focus-mode-note">{focusModeNote}</div>
            <div className="df-focus-task-wrap">
              <span className="df-focus-task-prefix">{lang === "zh" ? "正在做" : "Working"}</span>
              <span className="df-focus-task-name">{focusTask?.title || (lang === "zh" ? "未选择任务" : "No task selected")}</span>
            </div>
            {focusProject && <div className="df-focus-project-name">{focusProject.title}</div>}
          </div>
          <div className="df-focus-controls">
            {!timerRunning ? (
              <button className="df-focus-play" onClick={() => timerTaskId ? resumeTimer() : focusTask ? startTimer(focusTask.id) : undefined} disabled={!focusTask}>{timerTaskId ? (lang === "zh" ? "继续" : "Resume") : (lang === "zh" ? "开始" : "Start")}</button>
            ) : (
              <button className="df-focus-pause" onClick={pauseTimer}>{lang === "zh" ? "暂停" : "Pause"}</button>
            )}
            <button className="df-focus-save" onClick={stopAndSaveTimer} disabled={!timerTaskId}>{lang === "zh" ? "保存" : "Save"}</button>
            <button className="df-focus-discard" onClick={discardTimer}>{lang === "zh" ? "重置" : "Reset"}</button>
          </div>
        </div>
      )}
      {scheduleTemplateOpen && data && (
        <ScheduleTemplateModal
          lang={lang}
          date={timelineDate}
          tasks={[...tasks, ...expandExternalCalendarOccurrences(new Set([timelineDate])).tasks.map((task) => task.scheduledStart ? task : { ...task, scheduledStart: "00:00", scheduledEnd: "23:59" })]}
          customTemplates={data.scheduleTemplates || []}
          onSaveCustomTemplates={(templates) => void saveData({ ...dataRef.current!, scheduleTemplates: templates })}
          onApply={applyTemplateToDate}
          onClose={() => setScheduleTemplateOpen(false)}
        />
      )}
      {drag?.kind === "block" && drag.pointer && draggedTask && !timelineSnapActive && (
        <TaskDragLayer
          pointer={drag.pointer}
          sourceRect={{ width: Math.max(drag.sourceRect?.width || 220, drag.outsideTimeline ? 220 : 0), height: drag.sourceRect?.height || Math.max(timeBlockHeight(draggedTask.scheduledStart || "09:00", draggedTask.scheduledEnd || addMinutes(draggedTask.scheduledStart || "09:00", drag.duration)), SLOT_HEIGHT) }}
          offset={drag.offset || { x: 24, y: Math.min((drag.sourceRect?.height || SLOT_HEIGHT) / 2, 32) }}
        >
          <TimeBlock
            task={draggedTask}
            preview={null}
            projectName={projectName(draggedTask)}
            projects={projects}
            hovered={false}
            onHover={() => {}}
            onSelect={() => {}}
            onEdit={() => {}}
            onToggleDone={() => {}}
            onTaskUpdate={() => {}}
            onProjectChange={() => {}}
            onProjectColorChange={() => {}}
            onCreateProject={() => {}}
            onDragStart={() => {}}
            onResizeStart={() => {}}
            extraStyle={{ position: "relative", top: 0, left: 0, width: "100%", height: "100%" }}
            viewMode={timelineView === "month" ? "daily" : timelineView}
            lang={lang}
            dayStartHour={dayStartHour}
            dragState="overlay"
          />
        </TaskDragLayer>
      )}
      {drag?.source === "allDay" && drag.pointer && !hoverSlot && !allDayDragDate && !dragOverlay && <FloatingShelfDragPreview task={draggedTask} pointer={drag.pointer} candidateTarget={candidateDropActive} lang={lang} />}
      {drag?.source === "candidate" && drag.pointer && draggedTask && !timelineSnapActive && (
        <TaskDragLayer pointer={drag.pointer} sourceRect={drag.sourceRect || { width: 360, height: 44 }} offset={drag.offset || { x: 24, y: 22 }}>
          <TaskCard
            task={draggedTask}
            projects={projects}
            focusDate={today}
            placementPreview={null}
            onQuickDuration={() => {}}
            onProjectChange={() => {}}
            onSaveNote={() => {}}
            onDelete={() => {}}
            onStartPlacementPreview={() => {}}
            onCancelPlacementPreview={() => {}}
            onConfirmPlacementPreview={() => {}}
            onApplyTimeSettings={() => {}}
            onSaveDueDate={() => {}}
            onSaveRecurrence={() => {}}
            onClick={() => {}}
            onPointerDragStart={() => {}}
            onToggleDone={() => {}}
            onToggleSubtask={() => {}}
            onSubtaskDragStart={() => {}}
            onMoveToPlanning={() => {}}
            onMetaUpdate={() => {}}
            dragState="overlay"
            lang={lang}
          />
        </TaskDragLayer>
      )}
      {dragOverlay && dragOverlayTask && drag?.source !== "candidate" && !timelineSnapActive && (
        <TaskDragLayer pointer={dragOverlayPointer} sourceRect={{ width: dragOverlay.sourceRect.width, height: dragOverlay.sourceRect.height }} offset={dragOverlay.offset}>
          <TaskCard
            task={activeDragItem?.taskSnapshot || dragOverlayTask.task}
            projects={projects}
            focusDate={today}
            placementPreview={null}
            onQuickDuration={() => {}}
            onProjectChange={() => {}}
            onSaveNote={() => {}}
            onDelete={() => {}}
            onStartPlacementPreview={() => {}}
            onCancelPlacementPreview={() => {}}
            onConfirmPlacementPreview={() => {}}
            onApplyTimeSettings={() => {}}
            onSaveDueDate={() => {}}
            onSaveRecurrence={() => {}}
            onClick={() => {}}
            onPointerDragStart={() => {}}
            onToggleDone={() => {}}
            onToggleSubtask={() => {}}
            onSubtaskDragStart={() => {}}
            onMoveToPlanning={() => {}}
            onMetaUpdate={() => {}}
            dragState="overlay"
            lang={lang}
          />
        </TaskDragLayer>
      )}
      {dragOverlay && !dragOverlayTask && drag?.kind !== "block" && <UnifiedDragOverlay snapshot={dragOverlay} pointer={dragOverlayPointer} />}
      {toast && (
        <div className={toastAction ? "df-toast df-toast-undo" : "df-toast"}>
          <span className="df-toast-message">{toast}</span>
          {toastAction && (
            <button className="df-toast-undo-btn" onClick={toastAction.onClick}>{toastAction.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

function FloatingShelfDragPreview({ task, pointer, candidateTarget, lang }: { task?: Task; pointer: { x: number; y: number }; candidateTarget: boolean; lang: Language }) {
  if (!task) return null;
  const hint = candidateTarget
    ? (lang === "zh" ? "放回今日候选" : "Return to Today's Candidates")
    : (lang === "zh" ? "拖到时间轴安排" : "Drag to timeline to schedule");
  return <div className={`df-floating-unschedule df-floating-shelf-drag${candidateTarget ? " candidate-target" : ""}`} style={{ left: pointer.x + 14, top: pointer.y + 14 }}><strong>{task.title}</strong><span>{hint}</span></div>;
}

// Visual parity debug switch. When true, the template modal body renders
// placeholder content using the execution page's EXACT wrapper hierarchy
// (df-timeline-panel > df-timeline-body > df-timeline-content > df-timeline-daily
// > df-date-title + TimelineCanvas). If the debug layout still differs from the
// execution page, the problem is the modal frame, not the template data.
const TEMPLATE_VISUAL_PARITY_DEBUG = false;

function ScheduleTemplateModal({
  lang,
  date,
  tasks,
  customTemplates,
  onSaveCustomTemplates,
  onApply,
  onClose,
}: {
  lang: Language;
  date: string;
  tasks: Task[];
  customTemplates: ScheduleTemplate[];
  onSaveCustomTemplates: (templates: ScheduleTemplate[]) => void;
  onApply: (slots: ScheduleTemplateApplySlot[], conflictCount: number) => void;
  onClose: () => void;
}) {
  // Template mode = execution-page interaction model applied to date-less
  // template periods. Left list visually corresponds to 今日候选; right
  // timeline editor visually corresponds to the execution timeline. Periods
  // store only { title, startMinutes, durationMinutes } and never pollute the
  // real task store until Apply.
  type TemplateKey = `builtin:${BuiltInScheduleTemplateId}` | `custom:${string}` | "draft:new";
  type TemplatePeriod = { id: string; title: string; startMinutes: number; durationMinutes: number };
  // Adapter isolates template-period data from the real task store. The
  // template timeline operates purely on TemplatePeriod drafts via this
  // interface; real scheduled tasks are only created on Apply.
  type TimelineAdapter<T> = {
    getId: (item: T) => string;
    getTitle: (item: T) => string;
    getStartMinutes: (item: T) => number;
    getDurationMinutes: (item: T) => number;
    createAt: (startMinutes: number) => void;
    updateTime: (id: string, startMinutes: number, durationMinutes: number) => void;
    updateTitle: (id: string, title: string) => void;
    delete: (id: string) => void;
  };
  // NOTE: `zh` must be declared before any useState that calls helpers (e.g.
  // makeBuiltInPeriods → slotToPeriod) which reference `zh`. Declaring it
  // after the useState lines triggers a Temporal Dead Zone ReferenceError
  // because the useState initializer runs during mount, before `zh` is
  // initialized.
  const zh = lang === "zh";
  const [templateKey, setTemplateKey] = useState<TemplateKey>("builtin:school");
  const [templateName, setTemplateName] = useState("");
  const [periods, setPeriods] = useState<TemplatePeriod[]>(() => makeBuiltInPeriods("school"));
  const [templateNotice, setTemplateNotice] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [dragState, setDragState] = useState<{ periodId: string; mode: "move" | "resize-top" | "resize-bottom"; originY: number; originStart: number; originDuration: number } | null>(null);
  const [creatingState, setCreatingState] = useState<{ startMinutes: number; currentMinutes: number } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Template list drag-to-reorder ──
  // Reuses the shared usePointerReorder hook, which mirrors Today's Candidate
  // drag feel (pointer capture, 5px threshold, half-height before/after,
  // is-dragging-source placeholder, .df-list-insertion-line indicator).
  // Only custom templates are draggable; built-ins are read-only/fixed and the
  // "+ new template" affordance is a separate button. Custom order persists
  // via onSaveCustomTemplates (the prop drives display order, so no local
  // order state is needed).
  const templateReorder = usePointerReorder<ListRow>({
    getId: (row) => row.kind === "builtin" ? `builtin:${row.id}` : row.kind === "custom" ? `custom:${row.id}` : "draft:new",
    selector: "[data-template-row-key]",
    attrName: "templateRowKey",
    onReorder: (dragKey, targetKey, position) => {
      if (!dragKey.startsWith("custom:") || !targetKey.startsWith("custom:")) return;
      const dragId = dragKey.replace("custom:", "");
      const targetId = targetKey.replace("custom:", "");
      const dragged = customTemplates.find((t) => t.id === dragId);
      if (!dragged) return;
      const without = customTemplates.filter((t) => t.id !== dragId);
      const idx = without.findIndex((t) => t.id === targetId);
      if (idx < 0) return;
      without.splice(position === "before" ? idx : idx + 1, 0, dragged);
      onSaveCustomTemplates(without);
    },
  });

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (dragState || creatingState || renamingId || editingPeriodId) {
          setDragState(null);
          setCreatingState(null);
          setRenamingId(null);
          setEditingPeriodId(null);
        } else if (templateReorder.drag) {
          templateReorder.cancelDrag();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, dragState, creatingState, renamingId, editingPeriodId, templateReorder.drag, templateReorder.cancelDrag]);

  // ── Period factory helpers ──
  function slotToPeriod(slot: BuiltInScheduleTemplateSlot): TemplatePeriod {
    const startMinutes = timeToMinutes(slot.start);
    const endMinutes = timeToMinutes(slot.end);
    return {
      id: slot.id || uid("period"),
      title: zh ? slot.labelZh : slot.labelEn,
      startMinutes,
      durationMinutes: Math.max(SLOT_MINUTES, endMinutes - startMinutes),
    };
  }

  function makeBuiltInPeriods(id: BuiltInScheduleTemplateId): TemplatePeriod[] {
    return SCHEDULE_TEMPLATES[id].slots.map(slotToPeriod);
  }

  function makeCustomPeriods(template: ScheduleTemplate): TemplatePeriod[] {
    return template.slots.map((slot, index) => ({
      id: slot.id || uid("period"),
      title: slot.label || (zh ? `第 ${index + 1} 段` : `Period ${index + 1}`),
      startMinutes: timeToMinutes(slot.start || "09:00"),
      durationMinutes: Math.max(SLOT_MINUTES, clockTimeSpanMinutes(slot.start || "09:00", slot.end || "10:00")),
    }));
  }

  function makeBlankPeriods(): TemplatePeriod[] {
    return [
      { id: uid("period"), title: zh ? "第一段" : "Period 1", startMinutes: 9 * 60, durationMinutes: 60 },
      { id: uid("period"), title: zh ? "第二段" : "Period 2", startMinutes: 10 * 60 + 15, durationMinutes: 60 },
    ];
  }

  function changeTemplate(key: TemplateKey) {
    setTemplateKey(key);
    setTemplateNotice("");
    setRenamingId(null);
    setEditingPeriodId(null);
    if (key.startsWith("builtin:")) {
      const id = key.replace("builtin:", "") as BuiltInScheduleTemplateId;
      setTemplateName("");
      setPeriods(makeBuiltInPeriods(id));
      return;
    }
    if (key === "draft:new") {
      setTemplateName("");
      setPeriods(makeBlankPeriods());
      return;
    }
    const id = key.replace("custom:", "");
    const template = customTemplates.find((item) => item.id === id);
    if (!template) return;
    setTemplateName(template.title);
    setPeriods(makeCustomPeriods(template));
  }

  // ── Period editing ──
  function updatePeriod(periodId: string, patch: Partial<TemplatePeriod>) {
    setPeriods((current) => current.map((p) => p.id === periodId ? { ...p, ...patch } : p));
    setTemplateNotice("");
  }

  function removePeriod(periodId: string) {
    setPeriods((current) => current.filter((p) => p.id !== periodId));
    setEditingPeriodId(null);
    setTemplateNotice("");
  }

  // ── Timeline pointer interactions ──
  const TIMELINE_TOTAL_MINUTES = 24 * 60;
  const TIMELINE_TOTAL_SLOTS = TIMELINE_TOTAL_MINUTES / SLOT_MINUTES;
  const TIMELINE_HEIGHT = TIMELINE_TOTAL_SLOTS * SLOT_HEIGHT;

  function pointerToMinutes(clientY: number): number {
    const el = timelineRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const raw = ((clientY - rect.top) / rect.height) * TIMELINE_TOTAL_MINUTES;
    const snapped = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.max(0, Math.min(TIMELINE_TOTAL_MINUTES - SLOT_MINUTES, snapped));
  }

  // Adapter over TemplatePeriod drafts — isolates template data from the real
  // task store. The template timeline operates purely through this interface;
  // real scheduled tasks are only created on Apply.
  const templatePeriodAdapter: TimelineAdapter<TemplatePeriod> = {
    getId: (p) => p.id,
    getTitle: (p) => p.title,
    getStartMinutes: (p) => p.startMinutes,
    getDurationMinutes: (p) => p.durationMinutes,
    createAt: (startMinutes) => {
      const id = uid("period");
      setPeriods((prev) => [...prev, { id, title: "", startMinutes, durationMinutes: SLOT_MINUTES * 2 }]);
      setEditingPeriodId(id);
      setEditingTitle("");
    },
    updateTime: (id, startMinutes, durationMinutes) => {
      setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, startMinutes, durationMinutes } : p)));
    },
    updateTitle: (id, title) => {
      setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    },
    delete: (id) => removePeriod(id),
  };

  function handleTimelinePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-template-period]")) return;
    const startMinutes = pointerToMinutes(event.clientY);
    setCreatingState({ startMinutes, currentMinutes: startMinutes + SLOT_MINUTES });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handleTimelinePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (creatingState) {
      const current = pointerToMinutes(event.clientY);
      setCreatingState((prev) => prev ? { ...prev, currentMinutes: Math.max(current, prev.startMinutes + SLOT_MINUTES) } : prev);
      return;
    }
    if (!dragState) return;
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deltaMinutes = Math.round(((event.clientY - dragState.originY) / rect.height) * TIMELINE_TOTAL_MINUTES / SLOT_MINUTES) * SLOT_MINUTES;
    if (dragState.mode === "move") {
      const nextStart = Math.max(0, Math.min(TIMELINE_TOTAL_MINUTES - dragState.originDuration, dragState.originStart + deltaMinutes));
      updatePeriod(dragState.periodId, { startMinutes: nextStart });
    } else if (dragState.mode === "resize-top") {
      const maxStart = dragState.originStart + dragState.originDuration - SLOT_MINUTES;
      const nextStart = Math.max(0, Math.min(maxStart, dragState.originStart + deltaMinutes));
      const nextDuration = dragState.originDuration - (nextStart - dragState.originStart);
      updatePeriod(dragState.periodId, { startMinutes: nextStart, durationMinutes: nextDuration });
    } else if (dragState.mode === "resize-bottom") {
      const nextDuration = Math.max(SLOT_MINUTES, dragState.originDuration + deltaMinutes);
      const cappedDuration = Math.min(nextDuration, TIMELINE_TOTAL_MINUTES - dragState.originStart);
      updatePeriod(dragState.periodId, { durationMinutes: cappedDuration });
    }
  }

  function handleTimelinePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (creatingState) {
      const start = creatingState.startMinutes;
      const end = creatingState.currentMinutes;
      if (end > start) {
        const newPeriod: TemplatePeriod = {
          id: uid("period"),
          title: zh ? "新时间段" : "New period",
          startMinutes: start,
          durationMinutes: end - start,
        };
        setPeriods((current) => [...current, newPeriod]);
        setEditingPeriodId(newPeriod.id);
        setEditingTitle(newPeriod.title);
      }
      setCreatingState(null);
    }
    if (dragState) setDragState(null);
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  }

  function beginPeriodDrag(event: React.PointerEvent<HTMLElement>, period: TemplatePeriod, mode: "move" | "resize-top" | "resize-bottom") {
    event.stopPropagation();
    setDragState({ periodId: period.id, mode, originY: event.clientY, originStart: period.startMinutes, originDuration: period.durationMinutes });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  // ── Save / delete / duplicate / rename ──
  function currentTemplateTitle() {
    return templateName.trim();
  }

  function templateSlotsForSave() {
    return periods
      .filter((p) => p.durationMinutes >= SLOT_MINUTES && p.startMinutes + p.durationMinutes <= TIMELINE_TOTAL_MINUTES)
      .map((p, index) => ({
        id: p.id,
        label: p.title.trim() || (zh ? `第 ${index + 1} 段` : `Period ${index + 1}`),
        start: minutesToTime(p.startMinutes),
        end: minutesToTime(p.startMinutes + p.durationMinutes),
      }));
  }

  function saveCurrentTemplate() {
    const savedSlots = templateSlotsForSave();
    const nextTitle = currentTemplateTitle();
    if (!nextTitle) {
      setTemplateNotice(zh ? "请先填写模板名称。" : "Name the template before saving.");
      return;
    }
    if (savedSlots.length === 0) {
      setTemplateNotice(zh ? "至少需要一个有效时间段。" : "Add at least one valid time block.");
      return;
    }
    const nowIso = new Date().toISOString();
    if (templateKey.startsWith("custom:")) {
      const id = templateKey.replace("custom:", "");
      const next = customTemplates.map((template) => template.id === id
        ? { ...template, title: nextTitle, slots: savedSlots, updatedAt: nowIso }
        : template);
      onSaveCustomTemplates(next);
      setTemplateNotice(zh ? "模板已保存。" : "Template saved.");
      return;
    }
    const created: ScheduleTemplate = {
      id: uid("template"),
      title: nextTitle,
      slots: savedSlots,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    onSaveCustomTemplates([...customTemplates, created]);
    setTemplateKey(`custom:${created.id}`);
    setTemplateName(created.title);
    setTemplateNotice(zh ? "已保存为模板，可在自定义模板中复用。" : "Saved as a reusable template.");
  }

  function createCustomTemplate() {
    setTemplateKey("draft:new");
    setTemplateName("");
    setPeriods(makeBlankPeriods());
    setTemplateNotice(zh ? "正在编辑新模板：先填写模板名称，再保存到自定义模板列表。" : "Editing a new template: name it before saving to Custom templates.");
  }

  function duplicateCustomTemplate(id: string) {
    const template = customTemplates.find((item) => item.id === id);
    if (!template) return;
    const nowIso = new Date().toISOString();
    const created: ScheduleTemplate = {
      id: uid("template"),
      title: template.title + (zh ? " 副本" : " copy"),
      slots: template.slots.map((slot) => ({ ...slot, id: uid("slot") })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    onSaveCustomTemplates([...customTemplates, created]);
    setTemplateKey(`custom:${created.id}`);
    setTemplateName(created.title);
    setPeriods(makeCustomPeriods(created));
    setTemplateNotice(zh ? "已复制模板。" : "Template duplicated.");
  }

  function deleteCustomTemplateById(id: string) {
    const template = customTemplates.find((item) => item.id === id);
    if (!template) return;
    const ok = window.confirm(zh ? `删除“${template.title}”？已生成的任务不会受影响。` : `Delete "${template.title}"? Existing tasks will not be changed.`);
    if (!ok) return;
    onSaveCustomTemplates(customTemplates.filter((t) => t.id !== id));
    if (templateKey === `custom:${id}`) {
      setTemplateKey("builtin:school");
      setTemplateName("");
      setPeriods(makeBuiltInPeriods("school"));
    }
    setTemplateNotice(zh ? "模板已删除。" : "Template deleted.");
  }

  function startRename(template: ScheduleTemplate) {
    setRenamingId(template.id);
    setRenameDraft(template.title);
  }

  function commitRename() {
    if (!renamingId) return;
    const nextTitle = renameDraft.trim();
    if (!nextTitle) { setRenamingId(null); return; }
    const nowIso = new Date().toISOString();
    onSaveCustomTemplates(customTemplates.map((t) => t.id === renamingId ? { ...t, title: nextTitle, updatedAt: nowIso } : t));
    if (templateKey === `custom:${renamingId}`) setTemplateName(nextTitle);
    setRenamingId(null);
  }

  function commitPeriodTitle(periodId: string) {
    const trimmed = editingTitle.trim();
    if (trimmed) updatePeriod(periodId, { title: trimmed });
    setEditingPeriodId(null);
  }

  // ── Conflict detection (existing schedule on `date`) ──
  const existingIntervals = useMemo(() => {
    return scheduledTaskIntervalsOnDate(tasks, date);
  }, [date, tasks]);

  const validPeriods = periods.filter((p) => p.durationMinutes >= SLOT_MINUTES && p.startMinutes + p.durationMinutes <= TIMELINE_TOTAL_MINUTES);
  const conflictCount = validPeriods.filter((p) => {
    const start = p.startMinutes;
    const end = p.startMinutes + p.durationMinutes;
    return existingIntervals.some((item) => start < item.end && end > item.start);
  }).length;
  const applySlots: ScheduleTemplateApplySlot[] = validPeriods
    .filter((p) => !existingIntervals.some((item) => p.startMinutes < item.end && p.startMinutes + p.durationMinutes > item.start))
    .map((p) => ({
      title: p.title.trim() || (zh ? "模板时间段" : "Template block"),
      start: minutesToTime(p.startMinutes),
      end: minutesToTime(p.startMinutes + p.durationMinutes),
    }));

  const activeBuiltInId = templateKey.startsWith("builtin:") ? templateKey.replace("builtin:", "") as BuiltInScheduleTemplateId : null;
  const activeCustom = templateKey.startsWith("custom:") ? customTemplates.find((item) => item.id === templateKey.replace("custom:", "")) : null;

  // ── Template list rows (built-in + custom + new) ──
  type ListRow =
    | { kind: "builtin"; id: BuiltInScheduleTemplateId; title: string; periodCount: number; span: string }
    | { kind: "custom"; id: string; title: string; periodCount: number; span: string }
    | { kind: "draft"; title: string; periodCount: number; span: string };

  // Template list metadata: period count only — no start/end time range,
  // per spec ("去掉具体起止时间, 保留时间段数量").
  function rowCount(periodCount: number): string {
    if (periodCount === 0) return zh ? "无时间段" : "No periods";
    return `${periodCount} ${zh ? "个时间段" : "blocks"}`;
  }

  const listRows: ListRow[] = [
    ...(Object.keys(SCHEDULE_TEMPLATES) as BuiltInScheduleTemplateId[]).map((id) => ({
      kind: "builtin" as const,
      id,
      title: zh ? SCHEDULE_TEMPLATES[id].labelZh : SCHEDULE_TEMPLATES[id].labelEn,
      periodCount: SCHEDULE_TEMPLATES[id].slots.length,
      span: rowCount(SCHEDULE_TEMPLATES[id].slots.length),
    })),
    ...customTemplates.map((t) => ({
      kind: "custom" as const,
      id: t.id,
      title: t.title,
      periodCount: t.slots.length,
      span: rowCount(t.slots.length),
    })),
    ...(templateKey === "draft:new" ? [{
      kind: "draft" as const,
      title: zh ? "新模板草稿" : "New draft",
      periodCount: periods.length,
      span: rowCount(periods.length),
    }] : []),
  ];

  const portalTarget = document.getElementById("df-portal-target") || document.body;

  return createPortal(
    <div className="df-modal-backdrop df-template-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="df-template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="df-template-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="df-template-close" onClick={onClose} aria-label={zh ? "关闭模板模式" : "Close template mode"}>×</button>

        {TEMPLATE_VISUAL_PARITY_DEBUG ? (
          <ExecutionSplitLayout className="df-template-shell">
            {/* Debug left: real CandidatePanelShell with placeholder candidate rows */}
            <CandidatePanelShell ariaLabel={zh ? "今日候选（debug）" : "Today's candidates (debug)"}>
              <CandidatePanelHeader title={<span>{zh ? "今日候选" : "Today"}</span>} />
              <div className="df-candidate-list">
                <CandidateBlock mode="template" title={zh ? "示例任务 A" : "Sample task A"} meta="09:00–10:00" />
                <CandidateBlock mode="template" title={zh ? "示例任务 B" : "Sample task B"} meta="30m" />
                <CandidateBlock mode="template" title={zh ? "示例任务 C" : "Sample task C"} meta="2h" />
              </div>
            </CandidatePanelShell>
            {/* Debug right: EXACT execution-page wrapper hierarchy
                df-timeline-panel > df-timeline-body > df-timeline-content >
                df-timeline-daily > df-date-title + TimelineCanvas.
                If this looks wrong inside the modal, the modal frame is the problem. */}
            <section className="df-timeline-panel" id="df-template-timeline-debug">
              <div className="df-timeline-body">
                <div className="df-timeline-content">
                  <div className="df-timeline-daily">
                    <div className="df-date-title df-date-title-compact today">
                      <span className="df-date-num">{new Date().getDate()}</span>
                      <span className="df-date-sep" />
                      <span className="df-date-wd">{zh ? "今天" : "Today"}</span>
                    </div>
                    <TimelineCanvas height={TIMELINE_HEIGHT} scrollRef={timelineRef}>
                      {Array.from({ length: 96 }).map((_, index) => {
                        const minutes = index * SLOT_MINUTES;
                        const isHour = minutes % 60 === 0;
                        const isMajor = minutes % (6 * 60) === 0;
                        const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
                        const mm = String(minutes % 60).padStart(2, "0");
                        return (
                          <div key={index} className={`df-slot ${isHour ? "hour" : "quarter"}${isMajor ? " major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }}>
                            <span>{hh}:{mm}</span>
                          </div>
                        );
                      })}
                    </TimelineCanvas>
                  </div>
                </div>
              </div>
            </section>
          </ExecutionSplitLayout>
        ) : (
        <ExecutionSplitLayout className="df-template-shell">
          {/* ── Left: shared CandidatePanelShell (same component as execution page) ── */}
          <CandidatePanelShell ariaLabel={zh ? "模板列表" : "Template list"}>
            <CandidatePanelHeader
              title={<span id="df-template-modal-title" ref={titleRef} tabIndex={-1}>{zh ? "模板" : "Templates"}</span>}
              actions={
                <button type="button" className="df-icon-action df-icon-template-new" data-tip={zh ? "新建模板" : "New template"} aria-label={zh ? "新建模板" : "New template"} onClick={createCustomTemplate}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>
              }
            />
            <div className="df-candidate-list">
              {listRows.map((row) => {
                const key = row.kind === "builtin" ? `builtin:${row.id}` : row.kind === "custom" ? `custom:${row.id}` : "draft:new";
                const isActive = templateKey === key;
                const isRenaming = row.kind === "custom" && renamingId === row.id;
                // Only custom templates are reorder-draggable; built-ins are read-only and the
                // draft row is a transient selection state (not a persistable list item).
                const draggable = row.kind === "custom" && !isRenaming;
                const insertion = templateReorder.insertion;
                const showInsertionBefore = draggable && insertion && insertion.id === key && insertion.position === "before";
                const showInsertionAfter = draggable && insertion && insertion.id === key && insertion.position === "after";
                return (
                  <React.Fragment key={key}>
                    {showInsertionBefore ? <div className="df-list-insertion-line" aria-hidden="true" /> : null}
                  <CandidateBlock
                    mode="template"
                    selected={isActive}
                    title={isRenaming ? undefined : row.title}
                    meta={row.span}
                    badge={row.kind === "builtin" ? (zh ? "默认" : "Built-in") : undefined}
                    dataAttrs={draggable ? { "template-row-key": key } : undefined}
                    onPointerDown={draggable ? (e) => templateReorder.beginDrag(e, row) : undefined}
                    onClick={() => { if (templateReorder.suppressedRef.current) return; changeTemplate(key as TemplateKey); }}
                    onDoubleClick={(e) => { if (row.kind === "custom") { e.stopPropagation(); startRename(customTemplates.find((t) => t.id === row.id)!); } }}
                  >
                    {isRenaming ? (
                      <input
                        className="df-template-list-rename"
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                    ) : null}
                    {row.kind === "custom" && !isRenaming ? (
                      <span className="df-candidate-block-actions" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        <button type="button" className="df-icon-action" data-tip={zh ? "重命名" : "Rename"} aria-label={zh ? "重命名" : "Rename"} onClick={() => startRename(customTemplates.find((t) => t.id === row.id)!)}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
                        <button type="button" className="df-icon-action" data-tip={zh ? "复制" : "Duplicate"} aria-label={zh ? "复制" : "Duplicate"} onClick={() => duplicateCustomTemplate(row.id)}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                        <button type="button" className="df-icon-action" data-tip={zh ? "删除" : "Delete"} aria-label={zh ? "删除" : "Delete"} onClick={() => deleteCustomTemplateById(row.id)}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
                      </span>
                    ) : null}
                  </CandidateBlock>
                    {showInsertionAfter ? <div className="df-list-insertion-line" aria-hidden="true" /> : null}
                  </React.Fragment>
                );
              })}
              {/* New-template entry — small, narrow, centered button (not a full card). */}
              <div className="df-template-new-row">
                <button type="button" className="df-template-new-btn" onClick={createCustomTemplate}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  <span>{zh ? "新建模板" : "New template"}</span>
                </button>
              </div>
            </div>
          </CandidatePanelShell>

          {/* ── Right: real df-timeline-panel shell (same class as execution page) ──
              Uses the SAME df-timeline-body > df-timeline-content > df-timeline-daily
              wrapper hierarchy as the execution page so the flex layout path is
              identical and the TimelineCanvas fills/scales correctly. */}
          <section className="df-timeline-panel" id="df-template-timeline">
            <div className="df-timeline-body">
              <div className="df-timeline-content">
            <div className="df-timeline-daily">
              {/* Compact template-name bar — replaces the old big date-title + allday region.
                  Keeps the shell layout intact: no giant title, no separate title row. */}
              <div className="df-template-name-bar">
                {(activeCustom || templateKey === "draft:new") ? (
                  <input
                    className="df-template-name-inline"
                    value={templateName}
                    onChange={(event) => { setTemplateName(event.target.value); setTemplateNotice(""); }}
                    aria-label={zh ? "模板名称" : "Template name"}
                    placeholder={zh ? "模板名称…" : "Template name…"}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : activeBuiltInId ? (
                  <span className="df-template-name-readonly">{zh ? "默认模板（不可重命名）" : "Built-in template (read-only)"}</span>
                ) : null}
                <span className="df-template-name-meta">{rowCount(periods.length)}</span>
              </div>
              <TimelineCanvas
                scrollRef={timelineRef}
                height={TIMELINE_HEIGHT}
                onCanvasPointerDown={handleTimelinePointerDown}
                onCanvasPointerMove={handleTimelinePointerMove}
                onCanvasPointerUp={handleTimelinePointerUp}
                onCanvasPointerCancel={handleTimelinePointerUp}
              >
                  {Array.from({ length: 96 }).map((_, index) => {
                    const minutes = index * SLOT_MINUTES;
                    const isHour = minutes % 60 === 0;
                    const isMajor = minutes % (6 * 60) === 0;
                    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
                    const mm = String(minutes % 60).padStart(2, "0");
                    return (
                      <div
                        key={index}
                        className={`df-slot ${isHour ? "hour" : "quarter"}${isMajor ? " major" : ""}`}
                        style={{ top: `${index * SLOT_HEIGHT}px` }}
                      >
                        <span>{hh}:{mm}</span>
                      </div>
                    );
                  })}
                  {periods.map((period) => {
                    const top = (period.startMinutes / SLOT_MINUTES) * SLOT_HEIGHT;
                    const height = Math.max(SLOT_HEIGHT, (period.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT);
                    const isEditing = editingPeriodId === period.id;
                    return (
                      <TimelineEventBlock
                        key={period.id}
                        mode="template"
                        title={period.title}
                        className="df-template-period-block"
                        style={{ position: "absolute", left: "8px", right: "8px", top: `${top}px`, height: `${height}px` }}
                        dataAttrs={{ "template-period": "true" }}
                        onPointerDown={(e) => beginPeriodDrag(e, period, "move")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!dragState && !templateReorder.suppressedRef.current) {
                            setEditingPeriodId(period.id);
                            setEditingTitle(period.title);
                          }
                        }}
                        onResizeStart={(edge) => (e) => beginPeriodDrag(e, period, edge === "top" ? "resize-top" : "resize-bottom")}
                        onDelete={() => removePeriod(period.id)}
                        editing={isEditing}
                        editingTitle={editingTitle}
                        onTitleChange={setEditingTitle}
                        onTitleCommit={() => commitPeriodTitle(period.id)}
                        onTitleCancel={() => setEditingPeriodId(null)}
                        lang={lang}
                      />
                    );
                  })}
                  {creatingState && (
                    <div
                      className="df-time-block df-template-period-creating"
                      style={{
                        position: "absolute",
                        left: "8px",
                        right: "8px",
                        top: `${(creatingState.startMinutes / SLOT_MINUTES) * SLOT_HEIGHT}px`,
                        height: `${Math.max(SLOT_HEIGHT, ((creatingState.currentMinutes - creatingState.startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT)}px`,
                      }}
                    />
                  )}
              </TimelineCanvas>
            </div>
              </div>
            </div>
          </section>
        </ExecutionSplitLayout>
        )}

        {templateNotice && <div className="df-template-status" role="status">{templateNotice}</div>}

        {/* Template-list drag overlay — reuses TaskDragLayer (same component as
            Today's Candidate drag overlay) with a real CandidateBlock clone so
            the dragged row keeps its exact card styling. */}
        {templateReorder.drag && (
          <TaskDragLayer
            pointer={templateReorder.drag.pointer}
            sourceRect={templateReorder.drag.sourceRect}
            offset={templateReorder.drag.offset}
          >
            <CandidateBlock
              mode="template"
              title={templateReorder.drag.item.title}
              meta={templateReorder.drag.item.span}
              badge={templateReorder.drag.item.kind === "builtin" ? (zh ? "默认" : "Built-in") : undefined}
            />
          </TaskDragLayer>
        )}

        <footer className="df-template-modal-actions">
          {conflictCount > 0 && (
            <span className="df-template-conflict-note">
              {zh ? `${conflictCount} 个时间段与现有安排重叠，将跳过。` : `${conflictCount} blocks overlap existing schedule and will be skipped.`}
            </span>
          )}
          {activeCustom || templateKey === "draft:new" ? (
            <button type="button" className="secondary" onClick={saveCurrentTemplate}>{zh ? "保存" : "Save"}</button>
          ) : null}
          <button type="button" className="secondary" onClick={onClose}>{zh ? "取消" : "Cancel"}</button>
          <button
            type="button"
            className="primary"
            disabled={applySlots.length === 0}
            onClick={() => onApply(applySlots, conflictCount)}
          >{zh ? `应用到今天${applySlots.length > 0 ? ` (${applySlots.length})` : ""}` : `Apply to today${applySlots.length > 0 ? ` (${applySlots.length})` : ""}`}</button>
        </footer>
      </section>
    </div>,
    portalTarget,
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        style={{ position: pos, top, left, width, height: INPUT_H, zIndex: 999999 } as React.CSSProperties}
      >
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          enterKeyHint="done"
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

function habitDragTaskId(habitId: string) {
  return `habit:${habitId}`;
}

function habitDragTask(habit: Habit, dueDate: string): Task {
  const duration = Math.max(habit.defaultDurationMinutes || 20, 5);
  return {
    id: habitDragTaskId(habit.id),
    title: habit.title,
    dueDate,
    category: "personal",
    priority: null,
    notes: "",
    goalId: "",
    completed: false,
    estimatedHours: duration / 60,
    createdAt: "",
    updatedAt: "",
  };
}

function CommandPalette(props: {
  open: boolean;
  query: string;
  results: CommandSearchResult[];
  lang: Language;
  onQuery: (value: string) => void;
  onClose: () => void;
  onChoose: (result: CommandSearchResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [props.open]);
  if (!props.open) return null;
  const kindLabel = (kind: CommandSearchResult["kind"]) => {
    if (props.lang === "zh") {
      if (kind === "task") return "任务";
      if (kind === "project") return "项目";
      if (kind === "habit") return "习惯";
      if (kind === "setting") return "设置";
      if (kind === "event") return "事件";
      return "备注";
    }
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  };
  return (
    <>
      <button className="df-command-backdrop" type="button" aria-label={props.lang === "zh" ? "关闭搜索" : "Close search"} onClick={props.onClose} />
      <section className="df-command-palette" role="dialog" aria-modal="true" aria-label={props.lang === "zh" ? "搜索" : "Search"}>
        <div className="df-command-input-row">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                props.onClose();
              }
              if (event.key === "Enter" && props.results[0]) {
                event.preventDefault();
                props.onChoose(props.results[0]);
              }
            }}
            placeholder={props.lang === "zh" ? "搜索任务、项目、习惯、设置" : "Search tasks, projects, habits, settings"}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="df-command-results">
          {props.results.map((result) => (
            <button key={result.id} type="button" onClick={() => props.onChoose(result)}>
              <span className="df-command-kind">{kindLabel(result.kind)}</span>
              <span className="df-command-main">
                <strong>{result.title}</strong>
                <small>{result.subtitle}</small>
              </span>
              {result.focusTarget && <span className="df-command-jump">{props.lang === "zh" ? "跳转" : "Jump"}</span>}
            </button>
          ))}
          {props.results.length === 0 && <p className="df-command-empty">{props.lang === "zh" ? "没有匹配结果" : "No matching results"}</p>}
        </div>
      </section>
    </>
  );
}

function HabitCandidateCard(props: {
  habits: Habit[];
  habitDailyStates: HabitDailyState[];
  today: string;
  lang: Language;
  onToggle: (habitId: string, completed: boolean) => void;
  onPointerDragStart: (event: React.PointerEvent, habit: Habit) => void;
  onFocusScheduled: (recordId: string) => void;
  onEditHabit: (habitId: string) => void;
  onOpenOverview: () => void;
  isClickSuppressed?: () => boolean;
  draggedHabitId: string | null;
}) {
  const active = props.habits
    .filter((habit) => !habit.archived)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const completed = active.filter((habit) => props.habitDailyStates.some((state) => state.habitId === habit.id && state.date === props.today && state.completed)).length;
  if (active.length === 0) return null;

  return (
    <TaskGroup
      className="df-habit-candidate-card"
      title={(
        <span className="df-habit-card-title">
          <strong>{props.lang === "zh" ? "习惯" : "Habits"}</strong>
        </span>
      )}
      count={`${completed}/${active.length}`}
      onClick={() => { if (!props.isClickSuppressed?.()) props.onOpenOverview(); }}
      aria-label={props.lang === "zh" ? "习惯" : "Habits"}
    >
      {active.map((habit) => {
        const state = props.habitDailyStates.find((item) => item.habitId === habit.id && item.date === props.today);
        const isDone = Boolean(state?.completed);
        return (
          <TaskBlock
            as="article"
            variant="habit-child"
            appearance="calm"
            checked={isDone}
            selected={Boolean(state?.timelineRecordId)}
            projectColor="var(--accent-active)"
            key={habit.id}
            className={`df-habit-candidate-row${isDone ? " completed" : ""}${state?.timelineRecordId ? " scheduled" : ""}`}
            dragState={props.draggedHabitId === habitDragTaskId(habit.id) ? "source-placeholder" : undefined}
            onPointerDown={(event) => props.onPointerDragStart(event, habit)}
            onClick={(event) => { event.stopPropagation(); if (!props.isClickSuppressed?.()) props.onEditHabit(habit.id); }}
            title={props.lang === "zh" ? "点击编辑，拖动安排到时间轴" : "Click to edit, drag to schedule"}
          >
            <TaskBlockRow>
              <TaskCheckbox
                checked={isDone}
                tone="muted"
                title={isDone ? (props.lang === "zh" ? "取消完成" : "Mark incomplete") : (props.lang === "zh" ? "完成习惯" : "Complete habit")}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); props.onToggle(habit.id, !isDone); }}
              >
                {isDone ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
              </TaskCheckbox>
              <TaskBlockContent title={habit.title} />
              <TaskBlockDuration>
                {state?.timelineRecordId ? (
                  <button
                    type="button"
                    className="df-habit-scheduled"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); props.onFocusScheduled(state.timelineRecordId!); }}
                    aria-label={props.lang === "zh" ? "跳转到已规划的习惯安排" : "Jump to planned habit schedule"}
                  >
                    {props.lang === "zh" ? "已规划" : "Planned"}
                  </button>
                ) : (`${habit.defaultDurationMinutes || 20}m`)}
              </TaskBlockDuration>
            </TaskBlockRow>
          </TaskBlock>
        );
      })}
    </TaskGroup>
  );
}

function HabitPanel(props: {
  mode: "overview" | "detail";
  habitId: string | null;
  data: PlannerData;
  today: string;
  lang: Language;
  onClose: () => void;
  onEditHabit: (habitId: string) => void;
  onBack: () => void;
  onSave: (habitId: string, patch: Partial<Habit>) => void;
  onArchive: (habitId: string, archived: boolean) => void;
  onToggleDay: (habitId: string, date: string, completed: boolean) => void;
  onCreateHabit: () => void;
}) {
  const metrics = buildHabitMetrics(props.data, props.today);
  const zh = props.lang === "zh";
  const weekdays = weekdayLabels(props.lang);
  const archivedHabits = (props.data.habits || [])
    .filter((habit) => habit.archived)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const detailHabit = props.mode === "detail" && props.habitId
    ? (props.data.habits || []).find((h) => h.id === props.habitId) || null
    : null;

  return (
    <>
      <div className="df-utility-backdrop" onMouseDown={props.onClose} />
      <aside className="df-utility-panel df-habit-panel">
        <div className="df-utility-head">
          <h2>{props.mode === "detail" && detailHabit ? (zh ? "编辑习惯" : "Edit Habit") : (zh ? "习惯总览" : "Habits Overview")}</h2>
          <button className="df-icon-action i-close" aria-label={zh ? "关闭" : "Close"} onClick={props.onClose} />
        </div>
        <div className="df-utility-body">
          {props.mode === "overview" ? (
            <HabitOverviewBody metrics={metrics} archivedHabits={archivedHabits} dailyStates={props.data.habitDailyStates || []} zh={zh} today={props.today} onEditHabit={props.onEditHabit} onArchive={props.onArchive} onToggleDay={props.onToggleDay} onCreateHabit={props.onCreateHabit} />
          ) : detailHabit ? (
            <HabitDetailBody habit={detailHabit} zh={zh} weekdays={weekdays} onSave={(patch) => props.onSave(detailHabit.id, patch)} onArchive={(archived) => props.onArchive(detailHabit.id, archived)} onBack={props.onBack} />
          ) : (
            <p className="df-habit-empty">{zh ? "未找到该习惯。" : "Habit not found."}</p>
          )}
        </div>
      </aside>
    </>
  );
}

function HabitOverviewBody(props: {
  metrics: HabitMetrics;
  archivedHabits: Habit[];
  dailyStates: HabitDailyState[];
  zh: boolean;
  today: string;
  onEditHabit: (habitId: string) => void;
  onArchive: (habitId: string, archived: boolean) => void;
  onToggleDay: (habitId: string, date: string, completed: boolean) => void;
  onCreateHabit: () => void;
}) {
  const { metrics, zh } = props;
  const [weekOffset, setWeekOffset] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const baseDay = addDays(props.today, weekOffset * 7);
  const baseDate = new Date(`${baseDay}T00:00:00`);
  const mondayOffset = (baseDate.getDay() + 6) % 7;
  const weekStart = addDays(baseDay, -mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const fmt = (iso: string) => iso.slice(5).replace("-", "/");
  const weekRange = `${fmt(weekDays[0])} - ${fmt(weekDays[6])}`;
  const weekdayShort = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return zh
      ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]
      : d.toLocaleDateString("en-US", { weekday: "short" });
  };
  const dayNum = (iso: string) => iso.slice(8);
  return (
    <>
      <section className="df-habit-overview" aria-label={zh ? "习惯周视图" : "Habit week view"}>
        <header className="df-habit-overview-toolbar">
          <div className="df-habit-overview-range">
            <strong>{weekRange}</strong>
            <span>{zh ? `${metrics.todayCompleted}/${metrics.active} 今日完成` : `${metrics.todayCompleted}/${metrics.active} complete today`}</span>
          </div>
          <div className="df-habit-overview-actions">
            <button type="button" className="df-habit-nav" aria-label={zh ? "上一周" : "Previous week"} onClick={() => setWeekOffset((value) => value - 1)}>‹</button>
            <button type="button" className="df-habit-nav" onClick={() => setWeekOffset(0)}>{zh ? "今天" : "Today"}</button>
            <button type="button" className="df-habit-nav" aria-label={zh ? "下一周" : "Next week"} onClick={() => setWeekOffset((value) => value + 1)}>›</button>
            <button type="button" className="df-habit-overview-add" onClick={props.onCreateHabit}>{zh ? "+ 新增习惯" : "+ New habit"}</button>
          </div>
        </header>

        <div className="df-habit-overview-table" role="grid">
          <div className="df-habit-overview-thead" role="row">
            <span className="df-habit-overview-th-label" role="columnheader">{zh ? "习惯" : "Habit"}</span>
            {weekDays.map((day) => (
              <span
                key={day}
                className={`df-habit-overview-th-day${day === props.today ? " is-today" : ""}`}
                role="columnheader"
              >
                <b>{weekdayShort(day)}</b>
                <small>{dayNum(day)}</small>
              </span>
            ))}
          </div>

          {metrics.perHabit.length === 0 ? (
            <div className="df-habit-overview-empty">
              <span>{zh ? "还没有启用习惯。" : "No active habits yet."}</span>
              <button type="button" className="df-habit-overview-add" onClick={props.onCreateHabit}>{zh ? "新增习惯" : "New habit"}</button>
            </div>
          ) : metrics.perHabit.map((item) => (
            <div key={item.habit.id} className="df-habit-overview-trow" role="row">
              <button type="button" className="df-habit-overview-name" onClick={() => props.onEditHabit(item.habit.id)}>
                <span className="df-habit-overview-name-text">{item.habit.title}</span>
                <small className="df-habit-overview-duration">{item.habit.defaultDurationMinutes || 20}m</small>
              </button>
              {weekDays.map((day) => {
                const state = props.dailyStates.find((entry) => entry.habitId === item.habit.id && entry.date === day);
                const completed = Boolean(state?.completed);
                const planned = Boolean(state?.timelineRecordId);
                const due = isHabitDueOnDate(item.habit, day);
                return (
                  <button
                    type="button"
                    key={`${item.habit.id}-${day}`}
                    className={`df-habit-overview-cell${day === props.today ? " is-today" : ""}${completed ? " is-done" : ""}${planned ? " is-planned" : ""}${due ? " is-due" : ""}`}
                    aria-pressed={completed}
                    aria-label={`${completed ? (zh ? "取消完成" : "Mark incomplete") : (zh ? "完成" : "Mark complete")} ${item.habit.title} ${day}`}
                    onClick={() => props.onToggleDay(item.habit.id, day, !completed)}
                  >
                    <span className="df-habit-overview-dot" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="df-habit-overview-archived">
        <button type="button" className="df-habit-overview-archived-toggle" aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
          <span>{zh ? "已禁用的习惯" : "Disabled Habits"}</span>
          <small>{props.archivedHabits.length}</small>
          <i aria-hidden="true" className="df-habit-overview-chevron">{listOpen ? "▾" : "▸"}</i>
        </button>
        {listOpen && (
          props.archivedHabits.length === 0 ? (
            <p className="df-habit-overview-archived-empty">{zh ? "暂无已禁用习惯。" : "No disabled habits."}</p>
          ) : (
            <ul className="df-habit-overview-archived-list">
              {props.archivedHabits.map((habit) => (
                <li key={habit.id} className="df-habit-overview-archived-row">
                  <button type="button" className="df-habit-overview-archived-name" onClick={() => props.onEditHabit(habit.id)} title={zh ? "查看 / 编辑" : "View / Edit"}>
                    <span className="df-habit-overview-archived-title">{habit.title}</span>
                    <small>{habit.defaultDurationMinutes || 20}m</small>
                  </button>
                  <div className="df-habit-overview-archived-tools">
                    <button
                      type="button"
                      className="df-habit-overview-tool"
                      onClick={() => props.onEditHabit(habit.id)}
                      title={zh ? "编辑" : "Edit"}
                      aria-label={zh ? "编辑" : "Edit"}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z"/><path d="M9.5 4l2.5 2.5"/></svg>
                    </button>
                    <button
                      type="button"
                      className="df-habit-overview-tool"
                      onClick={() => props.onArchive(habit.id, false)}
                      title={zh ? "恢复启用" : "Restore"}
                      aria-label={zh ? "恢复启用" : "Restore"}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 1 1 1.5 3.5"/><path d="M3 4v4h4"/></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </>
  );
}

function HabitDetailBody(props: {
  habit: Habit;
  zh: boolean;
  weekdays: string[];
  onSave: (patch: Partial<Habit>) => void;
  onArchive: (archived: boolean) => void;
  onBack: () => void;
}) {
  const { habit, zh, weekdays } = props;
  const [title, setTitle] = useState(habit.title);
  const [notes, setNotes] = useState(habit.notes || "");
  const [duration, setDuration] = useState(String(habit.defaultDurationMinutes || 20));
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
  const [targetCount, setTargetCount] = useState(String(habit.targetCount || ""));

  // Sync local state when habit prop changes (e.g. after save)
  useEffect(() => {
    setTitle(habit.title);
    setNotes(habit.notes || "");
    setDuration(String(habit.defaultDurationMinutes || 20));
    setActiveWeekdays(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
    setTargetCount(String(habit.targetCount || ""));
  }, [habit.id, habit.updatedAt]);

  function commit(patch: Partial<Habit>) {
    props.onSave(patch);
  }

  function toggleWeekday(day: number) {
    const next = activeWeekdays.includes(day) ? activeWeekdays.filter((d) => d !== day) : [...activeWeekdays, day].sort();
    setActiveWeekdays(next);
    commit({ activeWeekdays: next });
  }
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <section className="df-habit-settings-form">
        <label className="df-habit-setting-field df-habit-setting-field-title">
          <span>{zh ? "标题" : "Title"}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== habit.title && commit({ title })} />
        </label>
        <label className="df-habit-setting-field df-habit-setting-toggle">
          <input
            type="checkbox"
            checked={!habit.archived}
            onChange={(e) => props.onArchive(!e.target.checked)}
          />
          <strong>{zh ? "启用" : "Enabled"}</strong>
        </label>
        <div className="df-habit-setting-field df-habit-static-field">
          <span>{zh ? "类型" : "Type"}</span>
          <strong>{zh ? "点击计数器" : "Click Counter"}</strong>
        </div>
        <label className="df-habit-setting-field">
          <span>{zh ? "预设时长（分钟）" : "Default Duration (min)"}</span>
          <input type="number" min={1} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} onBlur={() => { const n = Number(duration); if (n > 0 && n !== habit.defaultDurationMinutes) commit({ defaultDurationMinutes: n }); }} />
        </label>
        <div className="df-habit-setting-field df-habit-weekday-field">
          <span>{zh ? "检查连续的星期几 *" : "Weekdays to check *"}</span>
          <div className="df-habit-weekday-checks">
            {weekdayOrder.map((day) => (
              <button
                key={day}
                type="button"
                className={`df-habit-weekday-check${activeWeekdays.includes(day) ? " active" : ""}`}
                onClick={() => toggleWeekday(day)}
                aria-pressed={activeWeekdays.includes(day)}
              >
                <i aria-hidden="true" />
                <strong>{zh ? `星期${weekdays[day]}` : weekdays[day]}</strong>
              </button>
            ))}
          </div>
        </div>
        <label className="df-habit-setting-field">
          <span>{zh ? "目标次数（总）" : "Target Count (total)"}</span>
          <input type="number" min={0} value={targetCount} onChange={(e) => setTargetCount(e.target.value)} onBlur={() => { const n = Number(targetCount); if (n >= 0) commit({ targetCount: n }); }} />
        </label>
        <label className="df-habit-setting-field">
          <span>{zh ? "备注" : "Notes"}</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (habit.notes || "") && commit({ notes })} />
        </label>
      </section>

      <section className="df-settings-group df-habit-detail-actions">
        <button type="button" className="df-habit-back-btn" onClick={props.onBack}>{zh ? "返回总览" : "Back to overview"}</button>
        <button
          type="button"
          className="df-habit-archive-btn"
          onClick={() => props.onArchive(!habit.archived)}
        >{habit.archived ? (zh ? "恢复习惯" : "Restore Habit") : (zh ? "归档习惯" : "Archive Habit")}</button>
      </section>
    </>
  );
}

function recurrenceLabel(recurrence?: TaskRecurrence) {
  if (!recurrence || recurrence.frequency === "none") return "";
  return RECURRENCE_OPTIONS.find((item) => item.value === recurrence.frequency)?.label || "重复";
}

function TaskMetaIconBar({ task, lang, onUpdate }: { task: Task; lang: Language; onUpdate?: (patch: Partial<Task>) => void }) {
  const [open, setOpen] = useState<"status" | "importance" | "urgency" | null>(null);
  const state = normalizeTaskState(task);
  const labels = buildTaskMetaBadges(task, lang).reduce((map, badge) => ({ ...map, [badge.key]: badge.label }), {} as Record<"status" | "importance" | "urgency", string>);
  const zh = lang === "zh";
  const close = () => setOpen(null);
  const chooseStatus = (status: "backlog" | "doing" | "done") => {
    onUpdate?.(workflowStatusForPatch(status));
    close();
  };
  const chooseImportance = (importance: NullablePriority) => {
    onUpdate?.({ importance });
    close();
  };
  const chooseUrgency = (urgency: NullablePriority) => {
    onUpdate?.({ urgency });
    close();
  };
  return (
    <span className="df-task-meta-icons" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <span className="df-meta-icon-wrap">
        <button type="button" className={`df-meta-icon status-${state.workflow}`} title={labels.status} aria-label={labels.status} onClick={() => setOpen(open === "status" ? null : "status")}>
          <span className="df-meta-symbol status" aria-hidden="true" />
        </button>
        {open === "status" && (
          <span className="df-meta-menu">
            <button className={state.workflow === "backlog" ? "active" : ""} onClick={() => chooseStatus("backlog")}>{zh ? "待办" : "Todo"}</button>
            <button className={state.workflow === "doing" ? "active" : ""} onClick={() => chooseStatus("doing")}>{zh ? "进行中" : "Doing"}</button>
            <button className={state.workflow === "done" ? "active" : ""} onClick={() => chooseStatus("done")}>{zh ? "完成" : "Done"}</button>
          </span>
        )}
      </span>
      <span className="df-meta-icon-wrap">
        <button type="button" className={`df-meta-icon importance-${state.importance || "empty"}`} title={labels.importance} aria-label={labels.importance} onClick={() => setOpen(open === "importance" ? null : "importance")}>
          <span className="df-meta-symbol importance" aria-hidden="true" />
        </button>
        {open === "importance" && (
          <span className="df-meta-menu">
            <button className={!state.importance ? "active" : ""} onClick={() => chooseImportance(null)}>{zh ? "无" : "None"}</button>
            <button className={state.importance === "high" ? "active" : ""} onClick={() => chooseImportance("high")}>{zh ? "重要" : "Important"}</button>
            <button className={state.importance === "medium" ? "active" : ""} onClick={() => chooseImportance("medium")}>{zh ? "一般" : "Normal"}</button>
            <button className={state.importance === "low" ? "active" : ""} onClick={() => chooseImportance("low")}>{zh ? "不重要" : "Low"}</button>
          </span>
        )}
      </span>
      <span className="df-meta-icon-wrap">
        <button type="button" className={`df-meta-icon urgency-${state.urgency}`} title={labels.urgency} aria-label={labels.urgency} onClick={() => setOpen(open === "urgency" ? null : "urgency")}>
          <span className="df-meta-symbol urgency" aria-hidden="true" />
        </button>
        {open === "urgency" && (
          <span className="df-meta-menu">
            <button className={state.urgency === "high" ? "active" : ""} onClick={() => chooseUrgency("high")}>{zh ? "紧急" : "Urgent"}</button>
            <button className={state.urgency === "medium" ? "active" : ""} onClick={() => chooseUrgency("medium")}>{zh ? "一般" : "Normal"}</button>
            <button className={state.urgency === "low" ? "active" : ""} onClick={() => chooseUrgency("low")}>{zh ? "不紧急" : "Low"}</button>
          </span>
        )}
      </span>
    </span>
  );
}

function CandidateSubtaskItem({
  subtask,
  depth = 0,
  lang,
  onToggleSubtask,
  onSubtaskDragStart,
}: {
  subtask: Subtask;
  depth?: number;
  lang: Language;
  onToggleSubtask: (subtaskId: string) => void;
  onSubtaskDragStart?: (event: React.PointerEvent, subtaskId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const children = subtask.subtasks || [];
  const hasChildren = children.length > 0;
  const done = Boolean(subtask.completed || subtask.done);
  const planned = Boolean(subtask.plannedTaskId);
  const displayTitle = subtask.title.trimStart();

  return (
    <div
      className="df-candidate-subtask-item"
      data-depth={depth}
      style={{ "--candidate-subtask-depth": String(depth) } as CSSProperties}
    >
      <TaskBlock
        as="div"
        variant="habit-child"
        appearance="calm"
        checked={done}
        selected={planned}
        projectColor="var(--accent-active)"
        className={`df-candidate-subtask-row${done ? " done" : ""}${planned ? " planned" : ""}`}
        dataAttrs={{ "candidate-subtask": subtask.id }}
        title={displayTitle}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSubtaskDragStart?.(event, subtask.id);
        }}
      >
        <TaskBlockRow className="df-candidate-subtask-row-inner">
          <TaskCheckbox
            checked={done}
            tone={done ? "done" : "muted"}
            title={done ? (lang === "zh" ? "Mark incomplete" : "Mark incomplete") : (lang === "zh" ? "Mark complete" : "Mark complete")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSubtask(subtask.id);
            }}
          >
            {done ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
          </TaskCheckbox>
          <TaskBlockContent className="df-candidate-subtask-main" title={displayTitle} />
          <TaskBlockDuration>{planned ? (lang === "zh" ? "Planned" : "Planned") : null}</TaskBlockDuration>
          <TaskActions>
            {hasChildren ? (
              <button
                type="button"
                className="df-candidate-subtask-toggle"
                aria-label={open ? "Collapse subtasks" : "Expand subtasks"}
                aria-expanded={open}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((value) => !value);
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d={open ? "M4 9.5 8 5.5l4 4" : "M5.5 4 9.5 8l-4 4"} /></svg>
              </button>
            ) : null}
          </TaskActions>
        </TaskBlockRow>
      </TaskBlock>
      {hasChildren && open ? (
        <div className="df-candidate-subtask-nest">
          {children.map((child) => (
            <CandidateSubtaskItem
              key={child.id}
              subtask={child}
              depth={depth + 1}
              lang={lang}
              onToggleSubtask={onToggleSubtask}
              onSubtaskDragStart={onSubtaskDragStart}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
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
  onPointerDragStart,
  onStartPlacementPreview,
  onCancelPlacementPreview,
  onConfirmPlacementPreview,
  onApplyTimeSettings,
  onSaveDueDate,
  onSaveRecurrence,
  onMetaUpdate,
  onMoveToPlanning,
  onToggleSubtask,
  onSubtaskDragStart,
  dragState,
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
  onPointerDragStart: (event: React.PointerEvent) => void;
  onStartPlacementPreview: () => void;
  onCancelPlacementPreview: () => void;
  onConfirmPlacementPreview: () => void;
  onApplyTimeSettings: (settings: CandidateTimeSettings) => void;
  onSaveDueDate: (date: string) => void;
  onSaveRecurrence: (recurrence?: TaskRecurrence) => void;
  onMetaUpdate?: (patch: Partial<Task>) => void;
  onMoveToPlanning?: () => void;
  onToggleSubtask?: (subtaskId: string) => void;
  onSubtaskDragStart?: (event: React.PointerEvent, subtaskId: string) => void;
  dragState?: TaskBlockDragState;
  lang: Language;
}) {
  const compact = window.matchMedia("(max-width: 899.98px) and (orientation: portrait)").matches;
  const [openPanel, setOpenPanel] = useState<"more" | null>(null);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
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
  const hasSubtasks = (task.subtasks || []).length > 0;
  const displayTitle = task.title.trimStart();
  const suggestedProject = !task.projectId && !task.aiInference?.project?.userOverridden && (task.aiInference?.project?.confidence || 0) >= 0.45
    ? projects.find((project) => project.id === task.aiInference?.project?.projectId)
    : undefined;

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
      <TaskBlock
        as="article"
        variant="candidate"
        appearance="calm"
        priority={taskBlockPriorityFor(task.importance, task.urgency)}
        checked={task.completed && !isEvent}
        selected={Boolean(openPanel || isPlacementArmed)}
        dragState={dragState}
        disabled={!isEvent && recurringLocked}
        projectColor={cardAccentColor}
        className={`df-task-card ${overdue > 0 && !isEvent ? "overdue" : ""} ${task.completed && !isEvent ? "completed" : ""} ${openPanel ? "expanded" : ""} ${isMoreOpen ? "more-open" : ""} ${isPlacementArmed ? "placement-armed" : ""} ${recurringLocked && !isEvent ? "recurring-locked" : ""} ${isEvent ? "is-event" : ""}`}
        dataAttrs={{ "placement-card": task.id, kind: isEvent ? "event" : "task" }}
        onPointerDown={!isEvent && recurringLocked ? undefined : onPointerDragStart}
        onClick={onClick}
        title={!isEvent && recurringLocked
          ? t(lang, "taskCard.recurringHint")
          : compact
            ? (lang === "zh" ? "长按后拖到时间轴排程" : "Long press, then drag to schedule")
            : t(lang, "taskCard.dragHint")}
      >
        {!isMoreOpen && <TaskBlockRow className="df-candidate-row">
          {!isEvent && <TaskCheckbox
            checked={task.completed}
            tone={normalizeTaskCheckTone(task)}
            importance={task.importance}
            urgency={task.urgency}
            title={task.completed ? t(lang, "taskCard.markIncomplete") : t(lang, "taskCard.markComplete")}
            onClick={(event) => {
              event.stopPropagation();
              onToggleDone();
            }}
          >
            {task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
          </TaskCheckbox>}
          {isEvent ? <span className="df-task-block-check df-candidate-kind" aria-hidden="true" /> : null}
          <TaskBlockContent
            className="df-candidate-main"
            title={displayTitle}
          >
            {isEvent ? <span className="df-candidate-kind">EVENT</span> : null}
            {repeatText ? <span className="df-candidate-repeat-badge" title={`${t(lang, "taskCard.recurring")}：${repeatText}`}>↻ {repeatText}</span> : null}
            {!isEvent && (task.subtasks || []).length > 0 && <span className="df-candidate-subtask-count" title={lang === "zh" ? "子任务进度" : "Subtask progress"}>{countDoneSubtasks(task.subtasks)}/{countSubtasks(task.subtasks)}</span>}
          </TaskBlockContent>
          {suggestedProject && <button
            type="button"
            className="df-ai-project-suggestion"
            title={lang === "zh" ? `建议归入「${suggestedProject.title}」` : `Suggested project: ${suggestedProject.title}`}
            onClick={(event) => { event.stopPropagation(); onProjectChange(suggestedProject.id); }}
          >↗ {suggestedProject.title}</button>}
          {!isEvent && <TaskBlockDuration>
            {compact ? (
              <label className="df-duration-pill df-ios-native-select df-ios-duration-trigger" title={t(lang, "taskCard.adjustDuration")}>
                <span>{formatDuration(task.estimatedHours || 0.5)}</span>
                <select
                  value={Math.round((task.estimatedHours || 0.5) * 60)}
                  onChange={(event) => onQuickDuration(Number(event.target.value))}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t(lang, "taskCard.adjustDuration")}
                >
                  {DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <button
                className="df-duration-pill"
                title={t(lang, "taskCard.adjustDuration")}
                onClick={(event) => {
                  event.stopPropagation();
                  setPopoverOpen((current) => current === "duration" ? null : "duration");
                }}
              >
                {formatDuration(task.estimatedHours || 0.5)}
              </button>
            )}
          </TaskBlockDuration>}
          {!isEvent && <TaskActions>
            {hasSubtasks && onToggleSubtask ? (
              <button
                type="button"
                className="df-candidate-subtask-toggle"
                aria-label={subtasksOpen ? "Collapse subtasks" : "Expand subtasks"}
                aria-expanded={subtasksOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setSubtasksOpen((value) => !value);
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d={subtasksOpen ? "M4 9.5 8 5.5l4 4" : "M5.5 4 9.5 8l-4 4"} /></svg>
              </button>
            ) : null}
            <button
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
            </button>
            <button
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
            </button>
          </TaskActions>}
        </TaskBlockRow>}

        {!isMoreOpen && !isEvent && onToggleSubtask && hasSubtasks && subtasksOpen && (
          <div className="df-candidate-subtasks">
            <div className="df-candidate-subtask-list-head">
              <span>Subtasks</span>
              <small>{countDoneSubtasks(task.subtasks)}/{countSubtasks(task.subtasks)}</small>
            </div>
            {(task.subtasks || []).map((subtask) => (
              <CandidateSubtaskItem
                key={subtask.id}
                subtask={subtask}
                lang={lang}
                onToggleSubtask={onToggleSubtask}
                onSubtaskDragStart={onSubtaskDragStart}
              />
            ))}
          </div>
        )}

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
                <strong className="df-candidate-title" title={displayTitle}>{displayTitle}</strong>
                {repeatText ? <span className="df-candidate-repeat-badge" title={`${t(lang, "taskCard.recurring")}：${repeatText}`}>↻ {repeatText}</span> : null}
              </div>
              <div className="df-task-card-more-actions">
                {onMoveToPlanning && (
                  <button
                    className="df-icon-button"
                    title={lang === "zh" ? "移回 Planning" : "Move back to Planning"}
                    aria-label={lang === "zh" ? "移回 Planning" : "Move back to Planning"}
                    onClick={() => {
                      onMoveToPlanning();
                      setOpenPanel(null);
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 5h7a4 4 0 0 1 4 4v6" />
                      <path d="m8 2-4 3 4 3" />
                      <path d="M11 15h6" />
                    </svg>
                  </button>
                )}
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
      </TaskBlock>

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

function MobileDateQuickPicker({ month, selectedDate, today, weekStartsOn, lang, onMonthChange, onSelect }: {
  month: string;
  selectedDate: string;
  today: string;
  weekStartsOn: 0 | 1;
  lang: Language;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthNumber - 1, index - offset + 1);
    return localIsoDate(date);
  });
  const weekdayLabels = lang === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const orderedWeekdays = Array.from({ length: 7 }, (_, index) => weekdayLabels[(index + weekStartsOn) % 7]);
  const moveMonth = (delta: number) => {
    const date = new Date(year, monthNumber - 1 + delta, 1);
    onMonthChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <section className="df-mobile-date-picker" aria-label={lang === "zh" ? "快速选择日期" : "Quick date picker"}>
      <header>
        <button type="button" onClick={() => moveMonth(-1)} aria-label={lang === "zh" ? "上个月" : "Previous month"}>‹</button>
        <strong>{monthTitle(lang, year, monthNumber)}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label={lang === "zh" ? "下个月" : "Next month"}>›</button>
      </header>
      <div className="df-mobile-date-weekdays" aria-hidden="true">
        {orderedWeekdays.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="df-mobile-date-grid">
        {days.map((date) => {
          const currentMonth = date.slice(0, 7) === month;
          const selected = date === selectedDate;
          const isToday = date === today;
          return <button
            key={date}
            data-date={date}
            type="button"
            className={`${currentMonth ? "" : "outside"}${selected ? " selected" : ""}${isToday ? " today" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelect(date)}
          >{Number(date.slice(8, 10))}</button>;
        })}
      </div>
    </section>
  );
}

/** Quick‑add input shown on top of a drag‑created preview block. */
function DragCreateQuickAdd({ state, projects, onSave, onMore, onCancel, onRangeChange, sheet = false, lang = "zh" }: {
  state: NonNullable<DragCreateState>;
  projects: Project[];
  onSave: (title: string, projectId: string | null, subtasks: Subtask[]) => void;
  onMore?: (title: string, projectId: string | null, subtasks: Subtask[]) => void;
  onCancel: () => void;
  onRangeChange?: (edge: "start" | "end", minutes: number) => void;
  sheet?: boolean;
  lang?: Language;
}) {
  const [input, setInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedProjectRef = useRef<Project | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = sheet ? sheetRef.current : containerRef.current;
      if (!container || container.contains(e.target as Node)) return;
      if (inputRef.current?.value.replace(/#[^\s#]+/g, "").trim()) handleSave();
      else onCancel();
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onCancel, sheet]);

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

  function cleanTitle() {
    return (inputRef.current?.value || input).replace(/#[^\s#]+/g, "").trim();
  }

  function handleSave(openDetails = false) {
    const title = cleanTitle();
    if (!title || savingRef.current) return;
    savingRef.current = true;
    (openDetails && onMore ? onMore : onSave)(title, selectedProjectRef.current?.id || null, subtasks);
  }

  function addSubtask() {
    const title = subtaskTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    setSubtasks((current) => [...current, {
      id: `subtask_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      title,
      completed: false,
      createdAt: now,
      order: Date.now(),
      subtasks: [],
    }]);
    setSubtaskTitle("");
    setAddingSubtask(false);
  }

  function selectProject(project: Project) {
    selectedProjectRef.current = project;
    setSelectedProject(project);
    const base = input.replace(/#[^\s#]*$/, "").trimEnd();
    setInput(`${base}${base ? " " : ""}#${project.title}`);
    setProjectQuery("");
    inputRef.current?.focus({ preventScroll: true });
  }

  const showProjectMenu = input.includes("#") && !input.endsWith(" ");
  const filtered = showProjectMenu
    ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
    : [];

  const compact = state.width < 110;
  if (sheet) return (
    <div ref={sheetRef} className="df-timeline-draft-sheet-host"><Suspense fallback={null}><MobileTimelineDraftSheet
      lang={lang}
      title={input}
      onTitleChange={handleInputChange}
      onClose={onCancel}
      onSwipeDown={() => cleanTitle() ? handleSave() : onCancel()}
      onMore={() => handleSave(true)}
      onSubmit={() => handleSave()}
      projects={projects}
      projectId={selectedProject?.id || ""}
      onProjectChange={(id) => { const project = projects.find((item) => String(item.id) === id) || null; selectedProjectRef.current = project; setSelectedProject(project); }}
      startMinutes={state.startMinutes}
      endMinutes={state.endMinutes}
      onRangeChange={(edge, minutes) => onRangeChange?.(edge, minutes)}
      date={state.date}
      subtasks={subtasks}
      addingSubtask={addingSubtask}
      subtaskTitle={subtaskTitle}
      onStartSubtask={() => setAddingSubtask(true)}
      onSubtaskTitleChange={setSubtaskTitle}
      onAddSubtask={addSubtask}
      onCancelSubtask={() => { setAddingSubtask(false); setSubtaskTitle(""); }}
    /></Suspense></div>
  );

  return (
    <form ref={containerRef} className={`drag-create-quick-add${sheet ? " df-timeline-draft-sheet" : ""}`}
      onSubmit={(event) => { event.preventDefault(); handleSave(); }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{ "--cat": selectedProject?.color || "var(--accent-active)" } as CSSProperties}>
      <div className="drag-create-quick-add-row">
        <span className="drag-create-quick-add-check" aria-hidden="true" />
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          enterKeyHint="done"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
            if (event.key === "Escape") onCancel();
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (containerRef.current?.contains(document.activeElement)) return;
              if (inputRef.current?.value.replace(/#[^\s#]+/g, "").trim()) handleSave();
            }, 0);
          }}
          placeholder={sheet ? (lang === "zh" ? "任务名称" : "Task title") : compact ? "任务名" : "输入任务名，#选择项目"}
        />
        <button type="submit"
          disabled={!input.replace(/#[^\s#]+/g, "").trim()}
          className="df-quick-add-confirm" aria-label="添加任务">✓</button>
      </div>
      {showProjectMenu && filtered.length > 0 && (
        <div className="df-quick-add-project-menu drag-create-project-menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}>
          {filtered.map((p) => (
            <button type="button" key={p.id} onClick={() => selectProject(p)}># {p.title}</button>
          ))}
        </div>
      )}
    </form>
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

function TimeBlock({ task, preview, projectName, projects, hovered, showResizeHint = false, projectInteractive = true, onHover, onSelect, onEdit, onToggleDone, onTaskUpdate, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onResizeStart, resizeEdges, extraStyle, onAcceptPreview, onCancelPreview, viewMode, lang, dayStartHour = 0, hourHeight = HOUR_HEIGHT, dragState }: { task: Task; preview: ResizePreview; projectName: string; projects: Project[]; hovered: boolean; showResizeHint?: boolean; projectInteractive?: boolean; onHover: (id: string) => void; onSelect: () => void; onEdit: () => void; onToggleDone: () => void; onTaskUpdate?: (patch: Partial<Task>) => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.PointerEvent) => void; onResizeStart: (event: React.PointerEvent, edge: "start" | "end") => void; resizeEdges?: { start: boolean; end: boolean }; extraStyle?: CSSProperties; onAcceptPreview?: () => void; onCancelPreview?: () => void; viewMode?: "daily" | "3day" | "weekly"; lang: Language; dayStartHour?: number; hourHeight?: number; dragState?: TaskBlockDragState }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const isWeekView = viewMode === "weekly";
  const start = preview?.start || task.scheduledStart || "09:00";
  const computedDuration = taskDuration(task);
  let end = preview?.end || task.scheduledEnd || addMinutes(start, computedDuration);

  const endMinutesValue = timeToMinutes(end);
  const startMinutesValue = timeToMinutes(start);
  // Cross-midnight spans (e.g. 23:30→00:30) must read as 60m, not -1380.
  // `clockTimeSpanMinutes` treats end ≤ start as next-day; we only fall back to the
  // task's estimated duration when the stored end is missing or >24h (bad data).
  let calculatedDurationMinutes = clockTimeSpanMinutes(start, end);

  if (calculatedDurationMinutes > 24 * 60) {
    end = addMinutes(start, computedDuration);
    calculatedDurationMinutes = computedDuration;
  }

  const top = timeBlockTop(start, dayStartHour, hourHeight);
  const minSlotHeight = hourHeight * SLOT_MINUTES / 60;
  const height = Math.max(timeBlockHeight(start, end, dayStartHour, hourHeight), minSlotHeight);
  const durationMinutes = calculatedDurationMinutes;
  const startMinutes = startMinutesValue;
  const endMinutes = timeToMinutes(end);
  const next = extractNextAction(task.notes);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isEvent = isEventDisplayTask(task);
  const isExternalEvent = isExternalCalendarDisplayTask(task);
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectInteractive && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered, projectInteractive]);
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
  const canResize = !isExternalEvent && (isEvent || !recurringLocked);
  const eventId = task.id;
  const sizeClass = height < 56 ? "short" : height >= 120 ? "tall" : "normal";
  const originalStart = task.scheduledStart || "09:00";
  const originalDate = task.scheduledDate || preview?.startDate || "1970-01-01";
  const suppliedTop = typeof extraStyle?.top === "number" ? extraStyle.top : null;
  const resolvedTop = preview && suppliedTop !== null
    ? resizedBlockTop(suppliedTop, originalDate, originalStart, preview.startDate || originalDate, start, hourHeight)
    : suppliedTop ?? top;

  return (
    <TaskBlock as="div" variant="scheduled" appearance="calm" priority={taskBlockPriorityFor(task.importance, task.urgency)} density={height < 56 ? "compact" : "normal"} checked={!isEvent && task.completed} selected={Boolean(showResizeHint || projectOpen || preview)} dragState={dragState} projectColor={stripeColor} className={`df-time-block priority-${task.priority} ${!isEvent && task.completed ? "completed" : ""} ${isEvent ? "is-event" : ""} ${isExternalEvent ? "is-external-calendar" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""} ${preview ? "resizing" : ""} ${showResizeHint ? "show-resize-hint" : ""} ${projectOpen ? "project-open" : ""} ${isPreview ? "df-time-block-preview" : ""} ${isWeekView ? "df-time-block-week" : ""} ${isRecurring ? "recurring" : ""}`} dataAttrs={{ kind: isEvent ? "event" : "task", preview: isPreview ? "true" : undefined, "view-mode": viewMode, "schedule-size": sizeClass, "timeline-event-id": eventId, "task-id": task.id, readonly: isExternalEvent ? "true" : undefined }} style={{ ...extraStyle, top: resolvedTop, height, bottom: "auto", "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px", "--recurring-text": recurringTextColor } as CSSProperties} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => {
      onHover("");
    }} onPointerDown={isExternalEvent || isReturnedUnfinished || (!isEvent && recurringLocked) ? undefined : onDragStart} onClick={(event) => { event.stopPropagation(); onSelect(); }} onDoubleClick={(event) => { event.stopPropagation(); onEdit(); }} title={isExternalEvent ? (lang === "zh" ? "外部日历（只读）" : "External calendar (read-only)") : isReturnedUnfinished ? t(lang, "timeBlock.returnedHint") : !isEvent && recurringLocked ? t(lang, "timeBlock.recurringHint") : undefined}>
      {isPreview && <span className="df-preview-badge">{t(lang, "timeBlock.pending")}</span>}
      {canResize && (hovered || showResizeHint || preview) && resizeEdges?.start !== false && <button type="button" className="df-resize-dot top" aria-label={t(lang, "timeBlock.adjustStart")} onPointerDown={(event) => onResizeStart(event, "start")} onClick={(event) => event.stopPropagation()} />}
      <div className="df-time-card-shell">
      <TaskBlockRow className="df-time-card-row" align="start">
        {isEvent ? (
          <span className="df-task-block-check df-time-card-event-mark" title={t(lang, "timeBlock.eventTooltip")} aria-label={t(lang, "timeBlock.eventTooltip")} />
        ) : (
          <TaskCheckbox checked={task.completed} tone={normalizeTaskCheckTone(task)} returned={isReturnedUnfinished} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }} ariaLabel={task.completed ? t(lang, "timeBlock.markIncomplete") : t(lang, "timeBlock.markComplete")}>
            {task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : isReturnedUnfinished ? <ReturnedToPlanIcon /> : ""}
          </TaskCheckbox>
        )}
        <TaskBlockContent className="df-time-card-main" title={task.title}>
          {isEvent ? <span className="df-event-kind-label">{isExternalEvent ? (lang === "zh" ? "外部日历" : "External") : t(lang, "form.event")}</span> : null}
          {next && <span className="df-next df-time-card-next">{t(lang, "timeBlock.nextStep")}：{next}</span>}
        </TaskBlockContent>
      </TaskBlockRow>
      </div>
      {isPreview && (
        <span className="df-preview-actions">
          <button className="df-preview-action accept" onClick={(e) => { e.stopPropagation(); onAcceptPreview?.(); }} aria-label={t(lang, "timeBlock.adopt")} title={t(lang, "timeBlock.adopt")}>✓</button>
          <button className="df-preview-action cancel" onClick={(e) => { e.stopPropagation(); onCancelPreview?.(); }} aria-label={t(lang, "timeBlock.cancel")} title={t(lang, "timeBlock.cancel")}>✕</button>
        </span>
      )}
      {!isEvent && (hovered || showResizeHint) && <span className="df-block-project-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        {projectInteractive ? <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => {
          event.stopPropagation();
          setProjectOpen((open) => !open);
        }}># {projectName}</button> : <span className="df-block-project" title={projectName}># {projectName}</span>}
      </span>}
      {canResize && (hovered || showResizeHint || preview) && resizeEdges?.end !== false && <button type="button" className="df-resize-dot bottom" aria-label={t(lang, "timeBlock.adjustEnd")} onPointerDown={(event) => onResizeStart(event, "end")} onClick={(event) => event.stopPropagation()} />}
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
    </TaskBlock>
  );
}

function SnappedTimelineDragBlock({ task, startTime, duration, projectName, projects, viewMode, lang, extraStyle, dayStartHour = 0, hourHeight = HOUR_HEIGHT }: { task?: Task; startTime: string; duration: number; projectName: string; projects: Project[]; viewMode: "daily" | "3day" | "weekly"; lang: Language; extraStyle?: CSSProperties; dayStartHour?: number; hourHeight?: number }) {
  if (!task) return null;
  const snappedTask = { ...task, scheduledStart: startTime, scheduledEnd: addMinutes(startTime, duration) };
  return (
    <TimeBlock
      task={snappedTask}
      preview={null}
      projectName={projectName}
      projects={projects}
      hovered={false}
      projectInteractive={false}
      onHover={() => {}}
      onSelect={() => {}}
      onEdit={() => {}}
      onToggleDone={() => {}}
      onTaskUpdate={() => {}}
      onProjectChange={() => {}}
      onProjectColorChange={() => {}}
      onCreateProject={() => {}}
      onDragStart={() => {}}
      onResizeStart={() => {}}
      extraStyle={{ ...extraStyle, position: "absolute", zIndex: 6, pointerEvents: "none", transition: "top var(--motion-instant) var(--motion-ease), left var(--motion-instant) var(--motion-ease)" }}
      viewMode={viewMode}
      lang={lang}
      dayStartHour={dayStartHour}
      hourHeight={hourHeight}
      dragState="overlay"
    />
  );
}

function PreviewBlock({ task, startTime, duration, extraStyle, dayStartHour = 0, hourHeight = HOUR_HEIGHT }: { task?: Task; startTime: string; duration: number; extraStyle?: CSSProperties; dayStartHour?: number; hourHeight?: number }) {
  if (!task) return null;
  const top = timeBlockTop(startTime, dayStartHour, hourHeight);
  const endTime = addMinutes(startTime, duration);
  const height = Math.max(timeBlockHeight(startTime, endTime, dayStartHour, hourHeight), hourHeight * SLOT_MINUTES / 60);
  const color = categories[task.category]?.color || "#888";
  const isPlacementPreview = Boolean(extraStyle && (extraStyle as Record<string, unknown>)["--df-preview" as string]);
  const isEvent = isEventDisplayTask(task);
  return <div className={`df-drop-preview ${isPlacementPreview ? "placement-preview" : ""} ${isEvent ? "is-event" : ""}`} data-kind={isEvent ? "event" : "task"} style={{ top, height, "--cat": color, ...extraStyle } as CSSProperties}><strong>{task.title}</strong><span>{startTime} · {Math.round(duration)}min</span></div>;
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
        {colorOpen && <ProjectColorPicker value={color} onChange={(nextColor) => { onColorChange(nextColor); }} compact />}
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
            {newColorOpen && <ProjectColorPicker value={props.newColor} onChange={(c) => { props.onColorChange(c); }} compact />}
          </span>
          <button type="button" onClick={props.onCreate}>✓</button>
        </div>
      </div>}
    </div>
  );
}

function AllDayDropPreview({ task }: { task: Task }) {
  const color = categories[task.category]?.color || "#888";
  return <div className="df-all-day-drop-preview" style={{ "--cat": color } as CSSProperties}><strong>{task.title}</strong></div>;
}

function AllDayBlock({ task, dragging, projectName, projects, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onPointerDragStart, lang }: { task: Task; dragging?: boolean; projectName: string; projects: Project[]; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onPointerDragStart: (event: React.PointerEvent) => void; lang: Language }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isEvent = isEventDisplayTask(task);
  const isExternalEvent = isExternalCalendarDisplayTask(task);
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
    <TaskBlock as="article" variant="allDay" appearance="calm" priority={taskBlockPriorityFor(task.importance, task.urgency)} checked={!isEvent && task.completed} selected={projectOpen} dragging={dragging} projectColor={stripeColor} className={`df-all-day-block ${!isEvent && task.completed ? "completed" : ""} ${isEvent ? "is-event" : ""} ${isExternalEvent ? "is-external-calendar" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""} ${projectOpen ? "project-open" : ""} ${isShortName ? "short-name" : ""}${dragging ? " is-dragging" : ""}`} dataAttrs={{ kind: isEvent ? "event" : "task", readonly: isExternalEvent ? "true" : undefined }} style={{ "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px" } as CSSProperties} onPointerDown={isEvent || isReturnedUnfinished || recurringLocked ? undefined : onPointerDragStart} onClick={onEdit} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setProjectOpen(false); setHovered(false); }} title={isExternalEvent ? (lang === "zh" ? "外部日历（只读）" : "External calendar (read-only)") : isReturnedUnfinished ? "已回到规划，可重新安排" : undefined}>
      <TaskBlockRow className="df-all-day-row">
        {!isEvent && <TaskCheckbox checked={task.completed} tone={normalizeTaskCheckTone(task)} returned={isReturnedUnfinished} onClick={(event) => {
          event.stopPropagation();
          onToggleDone();
        }}>{task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : isReturnedUnfinished ? <ReturnedToPlanIcon /> : ""}</TaskCheckbox>}
        <TaskBlockContent className="df-all-day-main" title={task.title}>
          {isEvent ? <span className="df-event-kind-label">{isExternalEvent ? (lang === "zh" ? "外部日历" : "External") : t(lang, "form.event")}</span> : null}
        </TaskBlockContent>
        {!isEvent && hovered && <TaskActions className="df-all-day-actions" onClick={(event) => event.stopPropagation()}>
          <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => { event.stopPropagation(); setProjectOpen((open) => !open); }}># {projectName}</button>
        </TaskActions>}
      </TaskBlockRow>
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
    </TaskBlock>
  );
}

function NowLine({ extraStyle, dayStartHour = 0, hourHeight = HOUR_HEIGHT }: { extraStyle?: CSSProperties; lang?: Language; dayStartHour?: number; hourHeight?: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 0 || minutes > 24 * 60) return null;
  const top = timeBlockTop(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, dayStartHour, hourHeight);
  // Merge so an `undefined` top from extraStyle (non-continuous mode) does NOT
  // clobber the computed, day-start-aware top. Continuous mode supplies a real
  // top via extraStyle and wins; non-continuous mode omits it and the computed
  // top is used.
  const mergedStyle: CSSProperties = { ...extraStyle };
  if (mergedStyle.top === undefined) mergedStyle.top = top;
  return <div className="df-now-line" style={mergedStyle} />;
}

function EditDrawer(props: {
  type: AddType; setType: (type: AddType) => void; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; projects: Project[]; editing: boolean; task?: Task; event?: CalendarEvent; today: string; advancedOpen: boolean; setAdvancedOpen: (open: boolean) => void; onClose: () => void; onSave: () => void; onDelete: () => void; onCopy: () => void; onConvertToEvent: () => void; onConvertToTask: () => void; onTaskUpdate: (taskId: string, patch: Partial<Task>) => void; onProjectColorChange: (projectId: string, color: string) => void; onToggleDone: () => void; onNextAction: () => void; clarifyLoading?: boolean; onCreateProject: (title: string) => string;
  editingRecordId?: string; setEditingRecordId?: (id: string | undefined) => void; editingOccurrence?: EditingOccurrence; data?: PlannerData | null; saveData?: (next: PlannerData) => Promise<void>; onSaveRecurrence: (taskId: string, recurrence?: TaskRecurrence) => void; onCancelOccurrence: (taskId: string, occurrence: EditingOccurrence) => void; onReplanOccurrence: (taskId: string, occurrence: EditingOccurrence) => void; onCancelAllRecurrence: (taskId: string, cutoffDate: string) => void; aiEnabled: boolean; subtaskAiLoading: boolean; onGenerateSubtasks: (taskId: string) => void; lang: Language; compactSummary?: boolean; onShowMore?: () => void; quickAddDetail?: boolean;
}) {
  const dialog = useInAppDialog(props.lang);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [detailPopoverPosition, setDetailPopoverPosition] = useState({ top: 0, left: 0, width: 280 });
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const durationTriggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [cancelAllConfirm, setCancelAllConfirm] = useState(false);
  const f = props.form;
  const set = (key: keyof FormState, value: FormState[keyof FormState]) => props.setForm((current) => ({ ...current, [key]: value }));
  const selectedProjectTitle = props.projects.find((project) => String(project.id) === String(f.projectId))?.title || "未归属";
  const addTypeHints: Record<AddType, string> = {
    task: props.lang === "zh" ? "Task：需要完成的行动，可以安排到时间轴并标记完成。" : "Task: an action to complete, schedulable on the timeline and markable as done.",
    project: props.lang === "zh" ? "Project：一组任务的长期目标，用颜色和重要度组织计划。" : "Project: a longer-term goal that groups tasks with color and priority context.",
    event: props.lang === "zh" ? "Event：固定发生的日程，不作为可完成任务处理。" : "Event: a fixed calendar item, not treated as a completable task.",
  };
  useEffect(() => {
    setNoteDraft(props.task?.notes || "");
    setNotesOpen(true);
    setNotesEditing(false);
    setCancelAllConfirm(false);
  }, [props.task?.id, props.task?.notes, props.editingOccurrence?.scheduledDate, props.editingRecordId]);
  useLayoutEffect(() => {
    const textarea = titleRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [f.title, props.task?.id]);
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
    props.setForm((current) => ({
      ...current,
      estimatedHours: safeMinutes / 60,
      ...(props.quickAddDetail && current.dueTime ? { endTime: addMinutes(current.dueTime, safeMinutes) } : {}),
    }));
    if (!props.editing || props.type !== "task" || !props.task) return;
    const patch: Partial<Task> = { estimatedHours: safeMinutes / 60 };
    if (props.editingRecordId && props.task.timelineRecords?.length) {
      patch.timelineRecords = props.task.timelineRecords.map((record) =>
        record.id === props.editingRecordId
          ? rescheduleTimelineRecord(record, record.scheduledDate, record.scheduledStart, safeMinutes)
          : record,
      );
    }
    if (props.task.scheduledStart) patch.scheduledEnd = addMinutes(props.task.scheduledStart, safeMinutes);
    props.onTaskUpdate(props.task.id, patch);
  }
  async function addSubtask(parentId?: string) {
    if (!props.task) return;
    const title = await dialog.prompt(props.lang === "zh" ? "子任务名称" : "Subtask name");
    if (!title?.trim()) return;
    const nextSubtask: Subtask = {
      id: uid("subtask"),
      title: title.trim(),
      completed: false,
      done: false,
      order: Date.now(),
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    props.onTaskUpdate(props.task.id, {
      subtasks: addSubtaskToTree(props.task.subtasks || [], nextSubtask, parentId),
    });
  }
  function updateSubtask(subtaskId: string, patch: { title?: string; completed?: boolean }) {
    if (!props.task) return;
    const recurse = (st: Subtask[]): Subtask[] =>
      st.map((sub) =>
        sub.id === subtaskId
          ? { ...sub, ...patch, done: patch.completed ?? sub.done }
          : { ...sub, subtasks: sub.subtasks ? recurse(sub.subtasks) : sub.subtasks }
      );
    props.onTaskUpdate(props.task.id, { subtasks: recurse(props.task.subtasks || []) });
  }
  function renderSubtaskRows(subtasks: Subtask[], depth = 0): React.ReactNode {
    return subtasks.map((subtask) => (
      <div className={`df-subtask-tree-item${depth > 0 ? " nested" : ""}`} key={subtask.id} style={{ "--subtask-depth": depth } as CSSProperties}>
        <label className={`df-subtask-row-new ${subtask.completed || subtask.done ? "completed" : ""}`}>
          <input type="checkbox" checked={Boolean(subtask.completed || subtask.done)} onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })} />
          <input className="df-subtask-title-input" value={subtask.title} onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })} />
          <button
            type="button"
            className="df-subtask-add-child"
            title={props.lang === "zh" ? "添加下一级子任务" : "Add nested subtask"}
            aria-label={props.lang === "zh" ? `在 ${subtask.title} 下添加子任务` : `Add a subtask under ${subtask.title}`}
            onClick={(event) => { event.preventDefault(); void addSubtask(subtask.id); }}
          >
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 2v8M2 6h8" /></svg>
          </button>
        </label>
        {(subtask.subtasks || []).length > 0 && <div className="df-subtask-tree-children">{renderSubtaskRows(subtask.subtasks || [], depth + 1)}</div>}
      </div>
    ));
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
      const dur = clockTimeSpanMinutes(ss, se) / 60;
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
  const importanceOptions: Array<{ value: TaskLevel; zh: string; en: string }> = [
    { value: "high", zh: "高", en: "High" },
    { value: "medium", zh: "中", en: "Medium" },
    { value: "low", zh: "低", en: "Low" },
    { value: "unset", zh: "未设置", en: "Unset" },
  ];
  const urgencyOptions: Array<{ value: TaskLevel; zh: string; en: string }> = [
    { value: "high", zh: "高", en: "High" },
    { value: "medium", zh: "中", en: "Medium" },
    { value: "low", zh: "低", en: "Low" },
    { value: "unset", zh: "未设置", en: "Unset" },
  ];
  const levelColors: Record<TaskLevel, string> = {
    high: "#C96F5B",
    medium: "#C49A32",
    low: "#6E8DA6",
    unset: "#8E8478",
  };
  function commitTaskMeta(kind: "importance" | "urgency", value: TaskLevel) {
    set(kind, value === "unset" ? null : value);
    if (!props.editing || props.type !== "task" || !props.task) return;
    props.onTaskUpdate(props.task.id, taskMetaPatch(kind, value));
  }
  function taskLevelSelector(kind: "importance" | "urgency", options: Array<{ value: TaskLevel; zh: string; en: string }>) {
    const selectedValue = (f[kind] ?? "unset") as TaskLevel;
    return <div className={`df-level-selector df-level-${kind}`} role="group" aria-label={kind === "importance" ? (props.lang === "zh" ? "重要程度" : "Importance") : (props.lang === "zh" ? "紧急程度" : "Urgency")}>
      {options.map((option) => <button
        key={`${kind}-${option.value}`}
        type="button"
        className={`df-level-option df-level-${option.value}`}
        data-selected={selectedValue === option.value ? "true" : "false"}
        aria-pressed={selectedValue === option.value}
        onClick={() => commitTaskMeta(kind, option.value)}
        title={props.lang === "zh" ? option.zh : option.en}
        style={{ "--option-color": levelColors[option.value] } as React.CSSProperties}
      >
        {kind === "importance"
          ? option.value === "unset"
            ? <svg viewBox="0 0 24 24" className="df-level-icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            : <svg viewBox="0 0 24 24" className="df-level-icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          : <span className={`df-urgency-mark${option.value === "unset" ? " df-urgency-dash" : ""}`}>{option.value === "high" ? "!!!" : option.value === "medium" ? "!!" : option.value === "low" ? "!" : "—"}</span>}
      </button>)}
    </div>;
  }
  const eventDurationMinutes = f.dueTime
    ? Math.max(clockTimeSpanMinutes(f.dueTime, f.endTime || addMinutes(f.dueTime, f.recurrence?.durationMinutes || 60)), SLOT_MINUTES)
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
        <button className="df-detail-close df-icon-action i-close" type="button" aria-label={t(props.lang, "form.close")} onClick={props.onClose} />
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
            <button className="df-detail-add-btn df-detail-icon-tool" title={notesEditing ? t(props.lang, "drawer.cancel") : t(props.lang, "drawer.edit")} aria-label={notesEditing ? t(props.lang, "drawer.cancel") : t(props.lang, "drawer.edit")} onClick={() => setNotesEditing((open) => !open)}>
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2l2 2-6 6H2V8l6-6z"/></svg>
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
  if (props.quickAddDetail && !props.editing && props.type === "task") {
    const selectedProject = props.projects.find((project) => String(project.id) === String(f.projectId));
    const quickAddDuration = f.dueTime && f.endTime ? Math.max(clockTimeSpanMinutes(f.dueTime, f.endTime), SLOT_MINUTES) : Math.max(Math.round((f.estimatedHours || 0.5) * 60), SLOT_MINUTES);
    const setQuickAddStart = (startTime: string) => props.setForm((current) => ({
      ...current,
      dueTime: startTime,
      endTime: startTime ? addMinutes(startTime, Math.max(Math.round((current.estimatedHours || 0.5) * 60), SLOT_MINUTES)) : "",
    }));
    const setQuickAddEnd = (endTime: string) => props.setForm((current) => ({
      ...current,
      endTime,
      estimatedHours: current.dueTime && endTime ? Math.max(clockTimeSpanMinutes(current.dueTime, endTime), SLOT_MINUTES) / 60 : current.estimatedHours,
    }));
    return (
      <>
        <aside className="df-drawer df-task-detail df-quick-add-detail" onMouseDown={(event) => event.stopPropagation()}>
          <button className="df-detail-close df-icon-action i-close" type="button" aria-label={t(props.lang, "form.close")} onClick={props.onClose} />
          <section className="df-detail-hero-trevor">
            <textarea ref={titleRef} className="df-detail-title-trevor" autoFocus value={f.title} onChange={(event) => set("title", event.target.value)} rows={1} placeholder={t(props.lang, "drawer.titlePlaceholder")} spellCheck={false} />
          </section>

          <section className="df-detail-tag-row">
            <button ref={projectTriggerRef} className={`df-detail-pill-trevor ${projectPickerOpen ? "active" : ""}`} onClick={toggleProjectPicker}>
              <span className="df-detail-project-dot" style={{ background: selectedProject?.color || "#888" }} />
              <span># {selectedProject?.title || t(props.lang, "candidate.unassigned")}</span>
              <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 3 3-3" /></svg>
            </button>
            <button ref={durationTriggerRef} className={`df-detail-pill-trevor ${durationPickerOpen ? "active" : ""}`} onClick={toggleDurationPicker}>
              <span>◷ {formatMinutes(quickAddDuration)}</span>
              <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 3 3-3" /></svg>
            </button>
          </section>

          <section className="df-detail-meta-settings" aria-label={props.lang === "zh" ? "任务程度设置" : "Task level settings"}>
            <div className="df-detail-meta-setting"><span>{props.lang === "zh" ? "重要程度" : "Importance"}</span>{taskLevelSelector("importance", importanceOptions)}</div>
            <div className="df-detail-meta-setting"><span>{props.lang === "zh" ? "紧急程度" : "Urgency"}</span>{taskLevelSelector("urgency", urgencyOptions)}</div>
          </section>

          <section className="df-detail-time-range" aria-label={props.lang === "zh" ? "起止时间" : "Start and end time"}>
            <label><span>{t(props.lang, "drawer.startTime")}</span><input type="time" step={SLOT_MINUTES * 60} value={f.dueTime} onChange={(event) => setQuickAddStart(event.target.value)} /></label>
            <span className="df-detail-time-arrow" aria-hidden="true">→</span>
            <label><span>{t(props.lang, "drawer.endTime")}</span><input type="time" step={SLOT_MINUTES * 60} value={f.endTime} disabled={!f.dueTime} onChange={(event) => setQuickAddEnd(event.target.value)} /></label>
          </section>

          {projectPickerOpen && <section className="df-detail-project-pick df-quick-add-detail-picker">
            <div className="df-drawer-project-list">
              <button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}>{t(props.lang, "drawer.unassigned")}</button>
              {props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}
              <div className="df-project-create-line compact"><input value={newProjectTitle} placeholder={t(props.lang, "drawer.newProjectPlaceholder")} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div>
            </div>
          </section>}

          {durationPickerOpen && <section className="df-detail-project-pick df-quick-add-detail-picker"><div className="df-detail-duration-options">
            {DURATION_OPTIONS.map((minutes) => <button key={minutes} className={quickAddDuration === minutes ? "active" : ""} onClick={() => { setDurationMinutes(minutes); setDurationPickerOpen(false); }}>{formatMinutes(minutes)}</button>)}
          </div></section>}

          <section className="df-detail-notes-new">
            <div className="df-detail-section-head"><h3>{t(props.lang, "drawer.notes")}</h3></div>
            <div className="df-notes-editor"><textarea rows={4} value={f.details} onChange={(event) => set("details", event.target.value)} placeholder={t(props.lang, "drawer.addNotePlaceholder")} /></div>
          </section>

          <div className="df-quick-add-detail-actions"><button className="primary" disabled={!f.title.trim()} onClick={props.onSave}>{t(props.lang, "form.add")}</button></div>
        </aside>
      </>
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
        const restore = recordStatus === "returned_unfinished";
        const now = new Date().toISOString();
        void props.saveData({
          ...props.data,
          tasks: props.data.tasks.map((t) =>
            t.id === props.task!.id
              ? {
                  ...t,
                  completed: false,
                  plannedForDate: props.task!.plannedForDate || props.today,
                  executionLane: restore ? undefined : "candidate",
                  timelineRecords: (t.timelineRecords || []).map((r) =>
                    r.id === props.editingRecordId ? { ...r, executionStatus: restore ? "scheduled" as const : "returned_unfinished" as const } : r
                  ),
                  updatedAt: now,
                }
              : t
          ),
        });
      } else {
        const restore = props.task.executionStatus === "returned_unfinished";
        props.onTaskUpdate(props.task.id, {
          completed: false,
          plannedForDate: props.task.plannedForDate || props.today,
          executionLane: restore ? undefined : "candidate",
          executionStatus: restore ? "scheduled" : "returned_unfinished",
        });
      }
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
    if (props.compactSummary) {
      return (
        <>
          {dialog.host}
          <Suspense fallback={null}><MobileTaskSummary lang={props.lang} task={props.task} form={f} setForm={props.setForm} projects={props.projects} record={activeRecord} occurrence={activeOccurrence} today={props.today} onClose={props.onClose} onMore={props.onShowMore} onUpdate={props.onTaskUpdate} /></Suspense>
        </>
      );
    }
    return (
      <>
      {dialog.host}
      <aside className="df-drawer df-task-detail" onMouseDown={(event) => event.stopPropagation()}>
        <button className="df-detail-close df-icon-action i-close" type="button" aria-label={t(props.lang, "form.close")} onClick={props.onClose} />
        {/* ── Hero title area ── */}
        <section className="df-detail-hero-trevor">
          <textarea ref={titleRef} className="df-detail-title-trevor" value={f.title} onChange={(event) => set("title", event.target.value)} rows={1} placeholder={t(props.lang, "drawer.titlePlaceholder")} spellCheck={false} />
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
        <section className="df-detail-meta-settings" aria-label={props.lang === "zh" ? "任务程度设置" : "Task level settings"}>
          <div className="df-detail-meta-setting">
            <span>{props.lang === "zh" ? "重要程度" : "Importance"}</span>
            <div className="df-level-selector df-level-importance" role="group" aria-label={props.lang === "zh" ? "重要程度" : "Importance"}>
              {importanceOptions.map((option) => {
                const selectedImportance = (f.importance ?? "unset") as TaskLevel;
                const isSelected = selectedImportance === option.value;
                return (
                  <button
                    key={`importance-${option.value}`}
                    type="button"
                    className={`df-level-option df-level-${option.value}`}
                    data-selected={isSelected ? "true" : "false"}
                    aria-pressed={isSelected}
                    onClick={() => commitTaskMeta("importance", option.value)}
                    title={props.lang === "zh" ? option.zh : option.en}
                    style={{ "--option-color": levelColors[option.value] } as React.CSSProperties}
                  >
                    {option.value === "unset"
                      ? <svg viewBox="0 0 24 24" className="df-level-icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      : <svg viewBox="0 0 24 24" className="df-level-icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="df-detail-meta-setting">
            <span>{props.lang === "zh" ? "紧急程度" : "Urgency"}</span>
            <div className="df-level-selector df-level-urgency" role="group" aria-label={props.lang === "zh" ? "紧急程度" : "Urgency"}>
              {urgencyOptions.map((option) => {
                const selectedUrgency = (f.urgency ?? "unset") as TaskLevel;
                const isSelected = selectedUrgency === option.value;
                return (
                  <button
                    key={`urgency-${option.value}`}
                    type="button"
                    className={`df-level-option df-level-${option.value}`}
                    data-selected={isSelected ? "true" : "false"}
                    aria-pressed={isSelected}
                    onClick={() => commitTaskMeta("urgency", option.value)}
                    title={props.lang === "zh" ? option.zh : option.en}
                    style={{ "--option-color": levelColors[option.value] } as React.CSSProperties}
                  >
                    {option.value === "high" && <span className="df-urgency-mark">!!!</span>}
                    {option.value === "medium" && <span className="df-urgency-mark">!!</span>}
                    {option.value === "low" && <span className="df-urgency-mark">!</span>}
                    {option.value === "unset" && <span className="df-urgency-mark df-urgency-dash">—</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

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
            <div className="df-detail-subtask-tools">
              {props.aiEnabled && <button
                type="button"
                className={`df-detail-add-btn df-detail-icon-tool df-detail-ai-subtasks${props.subtaskAiLoading ? " loading" : ""}`}
                title={props.lang === "zh" ? "AI 自动拆解" : "Break down with AI"}
                aria-label={props.lang === "zh" ? `使用 AI 拆解“${props.task.title}”` : `Break down “${props.task.title}” with AI`}
                disabled={props.subtaskAiLoading}
                onClick={() => props.onGenerateSubtasks(props.task!.id)}
              >
                <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 2.5l1.1 3.2 3.4 1.1-3.4 1.1L10 11.1 8.9 7.9 5.5 6.8l3.4-1.1L10 2.5z" />
                  <path d="M4.8 11.5l.7 2 2.1.7-2.1.7-.7 2-.7-2-2.1-.7 2.1-.7.7-2z" />
                  <path d="M15.6 12.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4z" />
                </svg>
              </button>}
              <button type="button" className="df-detail-add-btn df-detail-icon-tool" title={t(props.lang, "drawer.addSubtask")} aria-label={t(props.lang, "drawer.addSubtask")} onClick={() => void addSubtask()}>
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8"/></svg>
              </button>
            </div>
          </div>
          <div className="df-subtask-list-new">
            {(props.task.subtasks || []).length === 0 ? (
              <div className="df-subtask-empty">{t(props.lang, "drawer.noSubtasks")}</div>
            ) : renderSubtaskRows(props.task.subtasks || [])}
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
      </>
    );
  }
  return (
    <aside className="df-drawer">
      <div className="df-drawer-head"><h2>{props.editing ? t(props.lang, "form.edit") : t(props.lang, "form.add")}</h2><button className="df-icon-action i-close" data-tip={t(props.lang, "form.close")} aria-label={t(props.lang, "form.close")} onClick={props.onClose} /></div>
      <div className="df-segment">{(["task", "project"] as AddType[]).map((type) => <button key={type} className={props.type === type ? "active" : ""} title={addTypeHints[type]} aria-label={addTypeHints[type]} onClick={() => props.setType(type)}>{type === "task" ? t(props.lang, "form.task") : t(props.lang, "form.project")}</button>)}</div>
      {props.editing && props.type === "task" && <label className="df-check"><input type="checkbox" checked={Boolean(props.task?.completed)} onChange={props.onToggleDone} />{t(props.lang, "form.completed")}</label>}
      <label>{t(props.lang, "form.name")}<input autoFocus={!props.editing} value={f.title} onChange={(event) => set("title", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); props.onSave(); } }} /></label>
      {props.type === "task" && <><label>{t(props.lang, "form.projectLabel")}<div className="df-drawer-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}># {selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}>{t(props.lang, "form.unassigned")}</button>{props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder={t(props.lang, "form.newProjectPlaceholder")} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div></label></>}
      {props.type === "project" && <div className="df-form-color-row"><label>{t(props.lang, "form.color")}</label><ProjectColorPicker value={f.projectColor} onChange={(color) => set("projectColor", color)} presets={COMMON_COLOR_PRESETS} /></div>}
      {props.type === "event" && <div className="df-grid2"><label>{t(props.lang, "form.startDate")}<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>{t(props.lang, "form.startTime")}<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label><label>{t(props.lang, "form.endDate")}<input type="date" value={f.endDate} onChange={(event) => set("endDate", event.target.value)} /></label><label>{t(props.lang, "form.endTime")}<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label><label>重复<select value={f.recurrence?.frequency || "none"} onChange={(event) => {
        const frequency = event.target.value as RecurrenceFrequency;
        set("recurrence", frequency === "none" ? undefined : { mode: f.dueTime ? "scheduled" : "flexible", frequency, startDate: f.dueDate, startTime: f.dueTime || undefined, durationMinutes: f.dueTime ? Math.max(clockTimeSpanMinutes(f.dueTime, f.endTime || addMinutes(f.dueTime, 60)), 15) : undefined, endDate: f.endDate || undefined });
      }}>{RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>}
      {props.type === "task" && <button className={`df-clarify-action${props.clarifyLoading ? " loading" : ""}`} onClick={props.onNextAction} disabled={props.clarifyLoading}><span aria-hidden="true" />{props.clarifyLoading ? (props.lang === "zh" ? "生成中…" : "Generating…") : t(props.lang, "form.clarifyNext")}</button>}
      <button className="df-link" onClick={() => props.setAdvancedOpen(!props.advancedOpen)}>{props.advancedOpen ? t(props.lang, "form.collapseAdvanced") : t(props.lang, "form.expandAdvanced")}</button>
      {props.advancedOpen && <div className="df-advanced">{props.type === "task" && <><label>{t(props.lang, "form.date")}<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><div className="df-grid2"><label>{t(props.lang, "form.startTime")}<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label><label>{t(props.lang, "form.endTime")}<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label></div><label>{t(props.lang, "form.estimatedTime")}<select value={Math.max(Math.round((f.estimatedHours || 0.25) * 60), SLOT_MINUTES)} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label></>}<label>{t(props.lang, "form.notes")}<textarea rows={6} value={f.details} onChange={(event) => set("details", event.target.value)} /></label></div>}
      <div className={`df-drawer-actions ${props.type === "task" ? "stacked" : ""}`}>{props.editing && <button className="df-icon-action i-trash danger-lite" data-tip={t(props.lang, "form.delete")} aria-label={t(props.lang, "form.delete")} onClick={props.onDelete} />}<div className="df-drawer-primary-flow"><button className="primary" onClick={props.onSave}>{props.editing ? t(props.lang, "form.saveChanges") : t(props.lang, "form.add")}</button></div></div>
    </aside>
  );
}

function MobileSheetDismissHandle({ onDismiss, onCollapse, onExpand, collapsed = false, lang }: { onDismiss: () => void; onCollapse?: () => void; onExpand?: () => void; collapsed?: boolean; lang: Language }) {
  const gestureRef = useRef<{ pointerId: number; startY: number; startedAt: number; panel: HTMLElement } | null>(null);
  const finishGesture = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const signedDistance = event.clientY - gesture.startY;
    const distance = Math.max(0, signedDistance);
    const velocity = distance / Math.max(1, performance.now() - gesture.startedAt);
    if (!cancelled && collapsed && signedDistance <= -54 && onExpand) {
      gesture.panel.classList.remove("is-sheet-dragging");
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", "0px");
      onExpand();
      return;
    }
    if (!cancelled && (distance >= 88 || velocity >= 0.62) && onCollapse && !collapsed) {
      gesture.panel.classList.remove("is-sheet-dragging");
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", "0px");
      onCollapse();
      return;
    }
    if (!cancelled && (distance >= 88 || velocity >= 0.62)) {
      gesture.panel.classList.remove("is-sheet-dragging");
      gesture.panel.classList.add("is-sheet-dismissing");
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", "100dvh");
      window.setTimeout(onDismiss, 170);
      return;
    }
    gesture.panel.classList.remove("is-sheet-dragging");
    gesture.panel.style.setProperty("--mobile-sheet-drag-y", "0px");
  };
  return <button
    type="button"
    className="df-mobile-sheet-dismiss-handle"
    aria-label={lang === "zh" ? "下滑关闭" : "Swipe down to close"}
    onPointerDown={(event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const panel = event.currentTarget.parentElement;
      if (!panel) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      panel.classList.add("is-sheet-dragging");
      gestureRef.current = { pointerId: event.pointerId, startY: event.clientY, startedAt: performance.now(), panel };
    }}
    onPointerMove={(event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const distance = event.clientY - gesture.startY;
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", `${collapsed ? Math.max(-70, distance) : Math.max(0, distance)}px`);
    }}
    onPointerUp={(event) => finishGesture(event)}
    onPointerCancel={(event) => finishGesture(event, true)}
  />;
}

function AiPanel({ input, setInput, busy, onSend, onCancel, onPlanToday, planState, onClose, messages, conversations, activeConversationId, conversationListOpen, onToggleConversationList, auditOpen, auditRuns, auditLoading, auditError, onToggleAudit, onNewConversation, onSelectConversation, memoryNotice, onOpenMemorySettings, actionPatches, onPatchAction, onConfirmAction, onDismissAction, onToggleAction, onSetAllActions, onAdoptSelected, onRejectSelected, onViewImport, onUndoImport, projectList, taskList, lang, attachment, attachmentStatus, onAttachment, onClearAttachment, model, models, onModelChange, safetyLevel, onSafetyLevelChange, onApproveAgent, onRejectAgent, onUndoAgent, globalAgentAvailable }: { input: string; setInput: (v: string) => void; busy: boolean; onSend: () => void; onCancel: () => void; onPlanToday: () => void; planState: AutoScheduleState; onClose: () => void; messages: AiSessionMessage[]; conversations: AiConversation[]; activeConversationId: string; conversationListOpen: boolean; onToggleConversationList: () => void; auditOpen: boolean; auditRuns: AgentAuditEntry[]; auditLoading: boolean; auditError: string; onToggleAudit: () => void; onNewConversation: () => void; onSelectConversation: (conversationId: string) => void; memoryNotice: string; onOpenMemorySettings: () => void; actionPatches: Record<string, Record<number, Record<string, unknown>>>; onPatchAction: (messageId: string, index: number, patch: Record<string, unknown>) => void; onConfirmAction: (messageId: string, action: AiAction, index: number) => void; onDismissAction: (messageId: string, action: AiAction, index: number) => void; onToggleAction: (messageId: string, index: number) => void; onSetAllActions: (messageId: string, checked: boolean) => void; onAdoptSelected: (messageId: string) => void; onRejectSelected: (messageId: string) => void; onViewImport: (messageId: string) => void; onUndoImport: (messageId: string) => void; projectList?: { id: string; title: string; color?: string }[]; taskList?: { id: string; title: string }[]; lang: Language; attachment?: ParsedAttachment | null; attachmentStatus?: string; onAttachment: (file: File) => void; onClearAttachment: () => void; model: string; models: readonly string[]; onModelChange: (model: string) => void; safetyLevel: Settings["aiSafetyLevel"]; onSafetyLevelChange: (level: Settings["aiSafetyLevel"]) => void; onApproveAgent: (messageId: string) => void; onRejectAgent: (messageId: string) => void; onUndoAgent: (messageId: string) => void; globalAgentAvailable: boolean }) {
  const projects = projectList || [];
  const tasks = taskList || [];
  const bodyRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const composerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [editMenu, setEditMenu] = useState<{ messageId: string; index: number; kind: "time" | "duration" | "project" | "type" } | null>(null);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  useEffect(() => {
    if (!composerMenuOpen) return;
    const closeComposerMenu = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (composerMenuRef.current?.contains(target) || composerMenuButtonRef.current?.contains(target))) return;
      setComposerMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeComposerMenu);
    return () => document.removeEventListener("pointerdown", closeComposerMenu);
  }, [composerMenuOpen]);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !followLatestRef.current) return;
    body.scrollTo({ top: body.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, attachmentStatus]);
  const sortedConversations = [...conversations].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  const promptSuggestions = lang === "zh"
    ? ["把今天最重要的三件事排好", "安排 90 分钟专注学习", "把今天没完成的任务移到明天", "从今日候选里制定计划", "查看我的下一个时间任务", "你能帮我做什么？"]
    : ["Plan my three priorities for today", "Schedule 90 minutes of focused study", "Move unfinished tasks to tomorrow", "Build a plan from today's candidates", "Show my next scheduled task", "What can you help me do?"];
  const text = {
    thinking: lang === "zh" ? "正在思考" : "Thinking",
    chats: lang === "zh" ? "对话" : "Chats",
    newChat: lang === "zh" ? "新对话" : "New",
    noChats: lang === "zh" ? "暂无对话" : "No conversations",
    untitled: lang === "zh" ? "未命名对话" : "Untitled",
    parsed: lang === "zh" ? "解析结果" : "Parsed results",
    selectAll: lang === "zh" ? "全选" : "All",
    selectNone: lang === "zh" ? "全不选" : "None",
    itemUnit: lang === "zh" ? "项" : "items",
    task: lang === "zh" ? "任务" : "Task",
    event: lang === "zh" ? "事件" : "Event",
    unassigned: lang === "zh" ? "未归属" : "Unassigned",
    cancelRound: lang === "zh" ? "取消本轮" : "Reject round",
    addSelected: lang === "zh" ? "一键添加选中项" : "Add selected",
    viewMemory: lang === "zh" ? "查看记忆" : "View memory",
    upload: lang === "zh" ? "上传文件" : "Upload file",
  };
  const timeOptions = ["08:00", "09:00", "10:00", "14:00", "16:00", "18:00", "20:00", "21:00"];
  const durationOptions = [15, 30, 45, 60, 90, 120, 150, 180];
  const menuIs = (messageId: string, index: number, kind: "time" | "duration" | "project" | "type") => editMenu?.messageId === messageId && editMenu.index === index && editMenu.kind === kind;
  const toggleMenu = (messageId: string, index: number, kind: "time" | "duration" | "project" | "type") => {
    setEditMenu((current) => current?.messageId === messageId && current.index === index && current.kind === kind ? null : { messageId, index, kind });
  };
  const patchTime = (messageId: string, index: number, action: Record<string, unknown>, startTime: string) => {
    const minutes = Number(action.durationMinutes) || (typeof action.end === "string" || typeof action.endTime === "string"
      ? Math.max(clockTimeSpanMinutes(startTime, (action.end || action.endTime) as string), SLOT_MINUTES)
      : 60);
    onPatchAction(messageId, index, { start: startTime, startTime, end: addMinutes(startTime, minutes), endTime: addMinutes(startTime, minutes), durationMinutes: minutes });
    setEditMenu(null);
  };
  const patchDuration = (messageId: string, index: number, action: Record<string, unknown>, minutes: number) => {
    const startTime = (action.start || action.startTime) as string | undefined;
    onPatchAction(messageId, index, { durationMinutes: minutes, ...(startTime ? { end: addMinutes(startTime, minutes), endTime: addMinutes(startTime, minutes) } : {}) });
    setEditMenu(null);
  };
  const patchType = (messageId: string, index: number, action: Record<string, unknown>, kind: "task" | "event") => {
    const startTime = (action.start || action.startTime || "09:00") as string;
    const minutes = Number(action.durationMinutes) || 60;
    onPatchAction(messageId, index, {
      kind,
      ...(kind === "event" ? { type: "import_schedule_item", startTime, endTime: (action.end || action.endTime || addMinutes(startTime, minutes)) } : {}),
    });
    setEditMenu(null);
  };
  const acceptAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAttachment(file);
    event.currentTarget.value = "";
    setComposerMenuOpen(false);
  };
  return <aside className={`df-ai-panel df-ai-panel-reference${mobileCollapsed ? " is-mobile-collapsed" : ""}`}>
    <MobileSheetDismissHandle onDismiss={onClose} onCollapse={() => setMobileCollapsed(true)} onExpand={() => setMobileCollapsed(false)} collapsed={mobileCollapsed} lang={lang} />
    <div className="df-ai-panel-head">
      <div className="df-ai-head-actions">
        <button className="df-ai-reference-tool new-chat" onClick={onNewConversation} aria-label={text.newChat} title={text.newChat}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /><path d="m16.5 3.5 4 4L12 16l-4.5 1 1-4.5Z" /></svg></button>
        <button className={`df-ai-reference-tool history ${conversationListOpen ? "active" : ""}`} onClick={onToggleConversationList} aria-label={text.chats} title={text.chats}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3.5 2" /></svg></button>
        <button className={`df-ai-reference-tool audit ${auditOpen ? "active" : ""}`} onClick={onToggleAudit} aria-label={lang === "zh" ? "Agent 审计" : "Agent audit"} title={lang === "zh" ? "Agent 审计" : "Agent audit"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6Z"/><path d="m9 12 2 2 4-5"/></svg></button>
        <button className="df-ai-reference-tool settings" onClick={onOpenMemorySettings} aria-label={lang === "zh" ? "AI 设置" : "AI settings"} title={lang === "zh" ? "AI 设置" : "AI settings"}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2.1-.7a7.2 7.2 0 0 0-.7-1.7l1-2-2.1-2.1-2 1a7.2 7.2 0 0 0-1.7-.7L10.5 2h-3l-.7 2.1a7.2 7.2 0 0 0-1.7.7l-2-1L1 5.9l1 2a7.2 7.2 0 0 0-.7 1.7L0 10.5v3l2.1.7a7.2 7.2 0 0 0 .7 1.7l-1 2L3.9 20l2-1a7.2 7.2 0 0 0 1.7.7l.9 2.3h3l.7-2.1a7.2 7.2 0 0 0 1.7-.7l2 1 2.1-2.1-1-2a7.2 7.2 0 0 0 .7-1.7Z" transform="translate(1.5 0) scale(.875)" /></svg></button>
        <button className="df-ai-reference-tool close" onClick={onClose} aria-label={t(lang, "aiPanel.close")} title={t(lang, "aiPanel.close")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
    </div>
    {conversationListOpen && <div className="df-ai-conversation-list">
      {sortedConversations.length === 0 && <p>{text.noChats}</p>}
      {sortedConversations.map((conversation) => (
        <button key={conversation.id} className={conversation.id === activeConversationId ? "active" : ""} onClick={() => onSelectConversation(conversation.id)}>
          <strong>{conversation.title || text.untitled}</strong>
          <small>{conversation.messages.length} {lang === "zh" ? "条" : "messages"} · {(conversation.updatedAt || conversation.createdAt).slice(0, 10)}</small>
        </button>
      ))}
    </div>}
    {auditOpen && <div className="df-agent-audit-list">
      <header><strong>{lang === "zh" ? "Agent 审计记录" : "Agent audit history"}</strong><small>{lang === "zh" ? "保留最近 30 天，最多显示 50 条" : "Last 30 days, up to 50 runs"}</small></header>
      {auditLoading && <p>{lang === "zh" ? "正在读取…" : "Loading…"}</p>}
      {auditError && <p className="error" role="alert">{auditError}</p>}
      {!auditLoading && !auditError && auditRuns.length === 0 && <p>{lang === "zh" ? "暂无审计记录" : "No audit runs yet"}</p>}
      {auditRuns.map((run) => <article key={run.id}>
        <div><strong>{run.status}</strong><time>{new Date(run.createdAt).toLocaleString()}</time></div>
        <small>{run.trigger} · {run.tools.length} {lang === "zh" ? "次查询" : "queries"} · {run.commands.length} {lang === "zh" ? "个命令" : "commands"}</small>
        <code>{run.id}</code>
      </article>)}
    </div>}
    <div className="df-ai-panel-body" ref={bodyRef} onScroll={(event) => {
      const element = event.currentTarget;
      followLatestRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
    }}>
      {messages.length === 0 && <div className="df-ai-reference-empty">
        <div className={`df-ai-capability-state ${globalAgentAvailable ? "ready" : "locked"}`}>
          <strong>{globalAgentAvailable ? (lang === "zh" ? "全局 Agent 已连接" : "Global Agent connected") : (lang === "zh" ? "登录后启用全局 Agent" : "Sign in to enable the Global Agent")}</strong>
          <span>{globalAgentAvailable ? (lang === "zh" ? "可按需查询完整工作区；高风险操作会先请求确认。" : "Can query the full workspace on demand; high-risk actions require confirmation.") : (lang === "zh" ? "本地估时、分类和规则排程仍可使用。" : "Local estimates, categorization, and rule-based scheduling remain available.")}</span>
        </div>
        <div className="df-ai-reference-prompt">{lang === "zh" ? "需要我帮什么？直接问吧……" : "How can I help? Just ask…"}</div>
        <div className="df-ai-reference-suggestions">
          {promptSuggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}
        </div>
      </div>}
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
          {message.agent && <div className="df-agent-run-card">
            <small>{lang === "zh" ? "审计 ID" : "Audit ID"} · <code>{message.agent.runId}</code>{message.agent.undoExpiresAt ? ` · ${lang === "zh" ? "撤销截止" : "Undo until"} ${new Date(message.agent.undoExpiresAt).toLocaleString()}` : ""}</small>
            {message.agent.trace && message.agent.trace.length > 0 && <details className="df-agent-trace">
              <summary>{lang === "zh" ? `实际查询步骤（${message.agent.trace.length}）` : `Queries performed (${message.agent.trace.length})`}</summary>
              {message.agent.trace.map((step) => <div key={step.id} className={step.status}><span>{step.status === "done" ? "✓" : "✕"}</span><code>{step.name}</code></div>)}
            </details>}
            {message.agent.applied.length > 0 && message.agent.decisionState !== "undone" && <div className="df-agent-applied">
              <strong>{lang === "zh" ? `已自动执行 ${message.agent.applied.length} 项` : `${message.agent.applied.length} action(s) applied`}</strong>
              {message.agent.applied.map((action) => <span key={action.commandId}>{action.title} · {action.operation}</span>)}
              {message.agent.undoExpiresAt && <button type="button" disabled={busy} onClick={() => onUndoAgent(message.id)}>{lang === "zh" ? "撤销本轮操作" : "Undo this run"}</button>}
            </div>}
            {message.agent.pending.length > 0 && message.agent.decisionState === "pending" && <div className="df-agent-confirm-card">
              <header><strong>{lang === "zh" ? "需要确认" : "Confirmation required"}</strong><small>{lang === "zh" ? `将影响 ${message.agent.pending.length} 个操作` : `${message.agent.pending.length} operation(s)`}</small></header>
              {message.agent.pending.map((command) => <article key={command.id}>
                <div><strong>{command.operation} · {command.entity}</strong>{command.targetId && <code>{command.targetId}</code>}</div>
                {command.reason && <p>{command.reason}</p>}
                {command.values && Object.keys(command.values).length > 0 && <dl>{Object.entries(command.values).filter(([key]) => !/(token|secret|password|url)/i.test(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl>}
              </article>)}
              <footer><button type="button" disabled={busy} onClick={() => onRejectAgent(message.id)}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="button" className="primary" disabled={busy} onClick={() => onApproveAgent(message.id)}>{lang === "zh" ? "确认并执行" : "Confirm and apply"}</button></footer>
            </div>}
            {message.agent.forbidden && message.agent.forbidden.length > 0 && <div className="df-agent-forbidden">{lang === "zh" ? `已阻止 ${message.agent.forbidden.length} 项越权操作` : `${message.agent.forbidden.length} unauthorized action(s) blocked`}</div>}
            {message.agent.decisionState === "rejected" && <div className="df-agent-decision-outcome">{lang === "zh" ? "待确认操作已取消" : "Pending actions cancelled"}</div>}
            {message.agent.decisionState === "undone" && <div className="df-agent-decision-outcome">{lang === "zh" ? "本轮 AI 操作已撤销" : "This AI run was undone"}</div>}
          </div>}
          {message.plan && message.plan.length > 0 && <div className="df-ai-plan">
            <div className="df-ai-plan-header"><span>{lang === "zh" ? "今日时间块" : "Today's time blocks"}</span><small>{message.plan.length} {text.itemUnit}</small></div>
            {message.plan.map((block, pi) => <div key={pi} className="df-ai-plan-row">
              <span className="df-ai-plan-time mono">{block.start} - {block.end}</span>
              <span className="df-ai-plan-title">{block.title}</span>
              {block.durationMinutes ? <span className="df-ai-plan-dur">{block.durationMinutes}m</span> : null}
            </div>)}
          </div>}
          {message.actions && message.actions.length > 0 && <div className="df-ai-actions">
            <div className="df-ai-action-header"><span>{text.parsed}</span><div><button onClick={() => onSetAllActions(message.id, true)}>{text.selectAll}</button><button onClick={() => onSetAllActions(message.id, false)}>{text.selectNone}</button><small>{message.actions.length} {text.itemUnit}</small></div></div>
            {message.actions.map((action, i) => {
            const patchedAction = { ...action, ...(actionPatches[message.id]?.[i] || {}) } as AiAction;
            const a = patchedAction as Record<string, unknown>;
            const title = a.title as string || a.type as string;
            const date = a.date as string | undefined;
            const start = (a.start || a.startTime) as string | undefined;
            const end = (a.end || a.endTime) as string | undefined;
            const dur = a.durationMinutes as number | undefined;
            const projectName = (a.projectName as string) || undefined;
            const projectId = (a.projectId as string) || undefined;
            const reason = typeof a.reason === 'string' ? a.reason : undefined;
            const isSubtaskAction = patchedAction.type === "create_subtasks";
            const subtaskSuggestions = isSubtaskAction ? (patchedAction.subtasks || []) : [];
            const targetTaskTitle = isSubtaskAction
              ? tasks.find((task) => task.id === patchedAction.taskId)?.title || (lang === "zh" ? "所选任务" : "Selected task")
              : "";
            const isAccepted = patchedAction.type === "none";
            const proj = projectId ? projects.find((p: any) => String(p.id) === String(projectId)) : null;
            const finalProjectName = projectName || proj?.title || text.unassigned;
            const projColor = proj?.color;
            const kind = a.kind === "event" ? "event" : "task";
            return (
            <div key={i} className={`df-ai-task-card ${isAccepted ? "accepted" : ""}`}>
              {patchedAction.type === "import_schedule_item" && <input className="df-ai-import-check" type="checkbox" checked={message.selectedActions?.[i] !== false} onChange={() => onToggleAction(message.id, i)} />}
              {projColor && <span className="df-ai-task-strip" style={{ background: projColor }} />}
              <div className="df-ai-task-body">
                {isSubtaskAction ? <>
                  <div className="df-ai-task-row-top"><strong>{lang === "zh" ? `拆解「${targetTaskTitle}」` : `Break down “${targetTaskTitle}”`}</strong></div>
                  <ul className="df-ai-subtask-preview">
                    {subtaskSuggestions.map((subtask, subtaskIndex) => <li key={`${subtask.title}-${subtaskIndex}`}><span>{subtaskIndex + 1}</span><strong>{subtask.title}</strong>{subtask.estimateMinutes ? <small>{formatMinutes(subtask.estimateMinutes)}</small> : null}</li>)}
                  </ul>
                  {reason && <div className="df-ai-task-row-bot"><small>{reason}</small></div>}
                </> : <>
                  <div className="df-ai-task-row-top">
                    <strong>{title}</strong>
                    {start && end && <button className="df-ai-chip-button mono" onClick={() => toggleMenu(message.id, i, "time")}>{start} - {end}</button>}
                  </div>
                  <div className="df-ai-task-row-mid">
                    <span className="df-ai-task-project">{text.task}</span>
                    <button className="df-ai-chip-button" onClick={() => toggleMenu(message.id, i, "project")}># {finalProjectName}</button>
                    {a.recurrence ? <span className="df-ai-task-project">↻ {(a.recurrence as any).frequency}</span> : null}
                  </div>
                  <div className="df-ai-task-row-bot">
                    {dur && <button className="df-ai-chip-button" onClick={() => toggleMenu(message.id, i, "duration")}>{formatMinutes(dur)}</button>}
                    {date && <span className="df-ai-task-dur">{date}</span>}
                    {reason && <small>{reason}</small>}
                    {typeof a.warning === "string" && <small>{a.warning}</small>}
                  </div>
                  {menuIs(message.id, i, "time") && <div className="df-ai-action-menu">{timeOptions.map((option) => <button key={option} onClick={() => patchTime(message.id, i, a, option)}>{option}</button>)}</div>}
                  {menuIs(message.id, i, "duration") && <div className="df-ai-action-menu">{durationOptions.map((option) => <button key={option} onClick={() => patchDuration(message.id, i, a, option)}>{formatMinutes(option)}</button>)}</div>}
                  {menuIs(message.id, i, "project") && <div className="df-ai-action-menu"><button onClick={() => { onPatchAction(message.id, i, { projectId: "", projectName: "" }); setEditMenu(null); }}>{text.unassigned}</button>{projects.map((project) => <button key={project.id} onClick={() => { onPatchAction(message.id, i, { projectId: project.id, projectName: project.title }); setEditMenu(null); }}><span className="df-ai-project-dot" style={{ background: project.color || "var(--accent-active)" }} />{project.title}</button>)}</div>}
                </>}
              </div>
              {!isAccepted && (
                <div className="df-ai-task-actions">
                  <button className="df-ai-task-accept" onClick={() => onConfirmAction(message.id, patchedAction, i)} title={t(lang, "aiPanel.adopt")}>✓</button>
                  <button className="df-ai-task-cancel" onClick={() => onDismissAction(message.id, patchedAction, i)} title={t(lang, "aiPanel.cancel")}>✕</button>
                </div>
              )}
              {isAccepted && <span className="df-ai-task-done">{t(lang, "aiPanel.adopted")}</span>}
            </div>
          );})}
          {message.actions.length > 0 && <div className="df-ai-import-bulk">
            <button onClick={() => onRejectSelected(message.id)}>{text.cancelRound}</button>
            <button className="primary" disabled={!message.actions.some((_, index) => message.selectedActions?.[index] !== false)} onClick={() => onAdoptSelected(message.id)}>{text.addSelected}</button>
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
      <button className={`df-ai-panel-plan${planState === "generating" || planState === "committing" ? " thinking" : ""}`} type="button" onClick={onPlanToday} disabled={planState === "generating" || planState === "committing"}>
        <span>{lang === "zh" ? "计划建议" : "Plan Suggestions"}</span>
        <small>{planState === "generating" ? (lang === "zh" ? "分析中" : "Analyzing") : planState === "committing" ? (lang === "zh" ? "采用中" : "Adopting") : planState === "preview" ? (lang === "zh" ? "重新生成" : "Regenerate") : (lang === "zh" ? "为今天生成时间安排" : "Build today's schedule")}</small>
      </button>
      {messages.length === 0 && sortedConversations.length > 0 && <button className="df-ai-continue-chat" onClick={() => onSelectConversation(sortedConversations[0].id)}>↻ <span>{lang === "zh" ? "继续上次对话" : "Continue last conversation"}</span></button>}
      {memoryNotice && <button className="df-ai-memory-notice" onClick={onOpenMemorySettings}>{memoryNotice} · {text.viewMemory}</button>}
      {(attachment || attachmentStatus) && <AttachmentCard attachment={attachment ? { name: attachment.name, size: attachment.size, pageCount: attachment.pageCount, truncated: attachment.truncated, status: "ready", statusText: attachmentStatus || "文本已提取", summary: attachment.text.slice(0, 120).replace(/\s+/g, " ") } : { name: "正在解析附件", size: 0, status: "error", statusText: attachmentStatus || "正在解析", summary: "" }} onRemove={onClearAttachment} />}
      <div className="df-ai-composer-row">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={t(lang, "aiPanel.thinkPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
        <button ref={composerMenuButtonRef} type="button" className={`df-ai-attach-btn${composerMenuOpen ? " active" : ""}`} title={lang === "zh" ? "模型、安全与附件" : "Model, safety, and attachments"} aria-label={lang === "zh" ? "打开更多选项" : "Open more options"} aria-expanded={composerMenuOpen} onClick={() => setComposerMenuOpen((open) => !open)}>＋</button>
        {composerMenuOpen && <div ref={composerMenuRef} className="df-ai-attach-menu df-ai-composer-menu">
          <label className="df-ai-composer-setting"><span>{lang === "zh" ? "模型" : "Model"}</span><select aria-label={lang === "zh" ? "选择模型" : "Choose model"} value={model} onChange={(event) => onModelChange(event.target.value)}>{models.map((option) => <option key={option} value={option}>{option.split("/").pop() || option}</option>)}</select></label>
          <label className="df-ai-composer-setting"><span>{lang === "zh" ? "安全等级" : "Safety level"}</span><select aria-label={lang === "zh" ? "选择安全等级" : "Choose safety level"} value={safetyLevel} onChange={(event) => onSafetyLevelChange(event.target.value as Settings["aiSafetyLevel"])}><option value="standard">{lang === "zh" ? "标准 · 低风险自动执行" : "Standard · Auto low-risk"}</option><option value="strict">{lang === "zh" ? "严格 · 所有写入确认" : "Strict · Confirm all writes"}</option><option value="readonly">{lang === "zh" ? "只读 · 禁止写入" : "Read only · Block writes"}</option></select></label>
          <div className="df-ai-composer-menu-rule" />
          {[
          [lang === "zh" ? "相机" : "Camera", "image/*", "environment"],
          [lang === "zh" ? "照片" : "Photos", "image/*", ""],
          [lang === "zh" ? "文件" : "Files", ATTACHMENT_ACCEPT, ""],
        ].map(([label, accept, capture]) => <label className="df-ai-composer-upload" key={label}>{label}<input type="file" accept={accept} capture={capture === "environment" ? "environment" : undefined} onChange={acceptAttachment} /></label>)}</div>}
        <button className="df-ai-send-btn" onClick={busy ? onCancel : onSend} disabled={!busy && !input.trim() && !attachment} title={busy ? (lang === "zh" ? "取消请求" : "Cancel request") : t(lang, "aiPanel.send")}>{busy ? "■" : "↑"}</button>
      </div>
      <small className="df-ai-reference-disclaimer">{lang === "zh" ? "AI 生成内容可能有误，请核对重要安排。" : "AI can make mistakes. Check important schedule changes."}</small>
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

function McpTokenManager({ lang }: { lang: Language }) {
  const [tokens, setTokens] = useState<McpTokenMetadata[]>([]);
  const [name, setName] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const api = window.plannerApi;
  const supported = Boolean(api.listMcpTokens && api.createMcpToken && api.revokeMcpToken);
  const refresh = useCallback(async () => {
    if (!api.listMcpTokens) { setLoading(false); return; }
    try {
      setError("");
      setTokens(await api.listMcpTokens());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { if (supported) void refresh(); else setLoading(false); }, [refresh, supported]);
  const configToken = rawToken || "nvp_REPLACE_ME";
  const codexConfig = `[mcp_servers.navopath]\nurl = "${MCP_ENDPOINT}"\nhttp_headers = { Authorization = "Bearer ${configToken}" }`;
  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(lang === "zh" ? "已复制" : "Copied");
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setError(lang === "zh" ? "复制失败，请手动选择文本。" : "Copy failed. Select the text manually.");
    }
  };
  return (
    <section className="df-mcp-settings">
      <strong>{lang === "zh" ? "远程 MCP 访问" : "Remote MCP access"}</strong>
      <p>{supported
        ? (lang === "zh" ? "为远程 MCP 客户端创建个人 Bearer Token。原始令牌只显示一次。" : "Create a personal Bearer token for a remote MCP client. The raw token is shown once.")
        : (lang === "zh" ? "登录云端账户后可管理 MCP 令牌。" : "Sign in to a cloud account to manage MCP tokens.")}</p>
      <a className="df-plugin-doc-link" href="/plugin-guide#mcp">
        <span>{lang === "zh" ? "查看 MCP 配置教程" : "View MCP setup guide"}</span>
        <small>{lang === "zh" ? "端点、Token、客户端配置和排错说明" : "Endpoint, token, client config, and troubleshooting notes"}</small>
        <i aria-hidden="true">↗</i>
      </a>
      <div className="df-mcp-docs">
        <div className="df-mcp-doc-head"><span>{lang === "zh" ? "服务地址" : "Server endpoint"}</span><button type="button" onClick={() => void copyText(MCP_ENDPOINT)}>{lang === "zh" ? "复制" : "Copy"}</button></div>
        <code>{MCP_ENDPOINT}</code>
        <div className="df-mcp-doc-head"><span>{lang === "zh" ? "客户端配置" : "Client configuration"}</span><button type="button" onClick={() => void copyText(codexConfig)}>{lang === "zh" ? "复制配置" : "Copy config"}</button></div>
        <pre>{codexConfig}</pre>
        <small>{lang === "zh" ? "连接方式：Streamable HTTP。令牌通过 Authorization: Bearer 请求头发送。" : "Transport: Streamable HTTP. Send the token in the Authorization: Bearer header."}</small>
      </div>
      {supported && <div className="df-mcp-create-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={lang === "zh" ? "令牌名称" : "Token name"} /><button type="button" disabled={busy} onClick={async () => {
        if (!api.createMcpToken) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
          const created = await api.createMcpToken(name.trim() || "MCP client");
          setRawToken(created.token);
          setName("");
          await refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
        } finally { setBusy(false); }
      }}>{busy ? (lang === "zh" ? "生成中…" : "Generating…") : (lang === "zh" ? "生成" : "Generate")}</button></div>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {notice && <p className="df-mcp-status" role="status">{notice}</p>}
      {rawToken && <div className="df-mcp-token"><small>{lang === "zh" ? "请立即保存，关闭设置后无法再次查看" : "Save this now; it cannot be viewed again"}</small><code>{rawToken}</code><button type="button" onClick={() => void copyText(rawToken)}>{lang === "zh" ? "复制令牌" : "Copy token"}</button></div>}
      {loading && <p className="df-mcp-status">{lang === "zh" ? "正在读取令牌…" : "Loading tokens…"}</p>}
      {!loading && supported && tokens.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "还没有有效令牌。" : "No active tokens yet."}</p>}
      {tokens.map((token) => <div className="df-mcp-token-row" key={token.id}><span><strong>{token.name}</strong><small>{token.tokenPrefix}… · {new Date(token.createdAt).toLocaleDateString()}</small></span><button type="button" disabled={busy} onClick={async () => { if (!api.revokeMcpToken) return; setBusy(true); setError(""); try { await api.revokeMcpToken(token.id); await refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(false); } }}>{lang === "zh" ? "撤销" : "Revoke"}</button></div>)}
    </section>
  );
}

function calendarFeedErrorMessage(caught: unknown, lang: Language) {
  const message = caught instanceof Error ? caught.message : String(caught);
  if (/schema cache|connection pool|time(?:d )?out|failed to fetch|503/i.test(message)) {
    return lang === "zh"
      ? "云服务暂时不可用，本地数据不会丢失。请稍后重试。"
      : "The cloud service is temporarily unavailable. Your local data is safe; please try again shortly.";
  }
  return message;
}

function CalendarFeedManager({ lang }: { lang: Language }) {
  const [tokens, setTokens] = useState<CalendarFeedTokenMetadata[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const api = window.plannerApi;
  const supported = Boolean(api.listCalendarFeedTokens && api.createCalendarFeedToken && api.revokeCalendarFeedToken);
  const refresh = useCallback(async () => {
    if (!api.listCalendarFeedTokens) { setLoading(false); return; }
    try {
      setError("");
      setTokens(await api.listCalendarFeedTokens());
    } catch (caught) {
      setError(calendarFeedErrorMessage(caught, lang));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { if (supported) void refresh(); else setLoading(false); }, [refresh, supported]);
  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setNotice(lang === "zh" ? "订阅链接已复制" : "Subscription link copied");
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setError(lang === "zh" ? "复制失败，请手动选择链接。" : "Copy failed. Select the link manually.");
    }
  };
  const createFeed = async () => {
    if (!api.createCalendarFeedToken) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api.createCalendarFeedToken();
      setFeedUrl(calendarFeedUrl(created.token));
      await refresh();
    } catch (caught) {
      setError(calendarFeedErrorMessage(caught, lang));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="df-mcp-settings df-calendar-settings">
      <strong>{lang === "zh" ? "只读日历订阅" : "Read-only calendar subscription"}</strong>
      <p>{supported
        ? (lang === "zh" ? "将时间轴排程、日历事件和未排程任务的截止日订阅到 iPhone、Notion Calendar 或其他日历。链接包含私密令牌，请勿公开分享。" : "Subscribe to timeline blocks, calendar events, and unscheduled task deadlines from iPhone, Notion Calendar, or another calendar. The link contains a private token; do not share it publicly.")
        : (lang === "zh" ? "登录云端账户后可生成日历订阅链接。" : "Sign in to a cloud account to create a calendar subscription link.")}</p>
      {supported && <button className="df-calendar-generate" type="button" disabled={busy} onClick={() => void createFeed()}>{busy
        ? (lang === "zh" ? "正在生成…" : "Generating…")
        : tokens.length > 0
          ? (lang === "zh" ? "更换订阅链接" : "Replace subscription link")
          : (lang === "zh" ? "生成订阅链接" : "Create subscription link")}</button>}
      {feedUrl && <div className="df-mcp-token">
        <small>{lang === "zh" ? "此完整链接只显示一次；更换链接会让旧订阅失效。" : "This complete link is shown once. Replacing it invalidates the old subscription."}</small>
        <code>{feedUrl}</code>
        <div className="df-calendar-actions">
          <button type="button" onClick={() => void copyFeedUrl()}>{lang === "zh" ? "复制链接" : "Copy link"}</button>
          <button type="button" onClick={() => { window.location.href = feedUrl.replace(/^https?:/, "webcal:"); }}>{lang === "zh" ? "在日历中订阅" : "Subscribe in Calendar"}</button>
        </div>
      </div>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {notice && <p className="df-mcp-status" role="status">{notice}</p>}
      {loading && <p className="df-mcp-status">{lang === "zh" ? "正在读取订阅状态…" : "Loading subscription status…"}</p>}
      {!loading && supported && tokens.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "还没有有效订阅。" : "No active subscription yet."}</p>}
      {tokens.map((token) => <div className="df-mcp-token-row" key={token.id}><span><strong>{lang === "zh" ? "NavoPath 日历" : "NavoPath Calendar"}</strong><small>{token.tokenPrefix}… · {new Date(token.createdAt).toLocaleDateString()}</small></span><button type="button" disabled={busy} onClick={async () => {
        if (!api.revokeCalendarFeedToken) return;
        setBusy(true);
        setError("");
        try {
          await api.revokeCalendarFeedToken(token.id);
          setFeedUrl("");
          await refresh();
        } catch (caught) {
          setError(calendarFeedErrorMessage(caught, lang));
        } finally {
          setBusy(false);
        }
      }}>{lang === "zh" ? "撤销" : "Revoke"}</button></div>)}
    </section>
  );
}

function ExternalCalendarManager({ lang }: { lang: Language }) {
  const api = window.plannerApi;
  const supported = Boolean(api.listExternalCalendars && api.connectExternalCalendar && api.refreshExternalCalendar && api.removeExternalCalendar);
  const [sources, setSources] = useState<ExternalCalendarSource[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!api.listExternalCalendars) return;
    try {
      const result = await api.listExternalCalendars();
      setSources(result.sources);
      setError("");
    } catch (caught) {
      setError(calendarFeedErrorMessage(caught, lang));
    }
  }, [api, lang]);
  useEffect(() => { if (supported) void load(); }, [load, supported]);
  const changed = () => window.dispatchEvent(new CustomEvent("navopath:external-calendar-changed"));
  return <section className="df-external-calendar-settings">
    <strong>{lang === "zh" ? "外部 ICS 日历（只读）" : "External ICS calendars (read-only)"}</strong>
    <p>{supported
      ? (lang === "zh" ? "最多连接 10 个 HTTPS ICS 地址。事项只作为忙碌时间参与冲突检测和 AI 规划，不会导入任务，也不会写回来源日历。" : "Connect up to 10 HTTPS ICS URLs. Events are used only as read-only busy time for conflicts and AI planning; they are never imported as tasks or written back.")
      : (lang === "zh" ? "登录云端账号并部署外部日历服务后可用。" : "Available after signing in and deploying the external-calendar service.")}</p>
    {supported && <div className="df-external-calendar-connect">
      <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder={lang === "zh" ? "日历名称" : "Calendar name"} />
      <input value={url} type="url" inputMode="url" onChange={(event) => setUrl(event.target.value)} placeholder="https://…/calendar.ics" />
      <button type="button" disabled={Boolean(busyId) || sources.length >= 10 || !name.trim() || !url.trim()} onClick={async () => {
        if (!api.connectExternalCalendar) return;
        setBusyId("connect"); setError("");
        try {
          await api.connectExternalCalendar({ name: name.trim(), url: url.trim() });
          setName(""); setUrl(""); await load(); changed();
        } catch (caught) { setError(calendarFeedErrorMessage(caught, lang)); }
        finally { setBusyId(""); }
      }}>{busyId === "connect" ? (lang === "zh" ? "连接中…" : "Connecting…") : (lang === "zh" ? "连接" : "Connect")}</button>
    </div>}
    {error && <p className="df-mcp-status error" role="alert">{error}</p>}
    {!supported && <p className="df-mcp-status muted">{lang === "zh" ? "当前环境不可用" : "Unavailable in this environment"}</p>}
    {supported && sources.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "尚未连接外部日历。" : "No external calendars connected."}</p>}
    <div className="df-external-calendar-list">{sources.map((source) => <article key={source.id} className={`df-external-calendar-source ${source.syncStatus}`}>
      <div><strong>{source.name}</strong><code>{source.displayUrl}</code><small>{source.syncStatus === "error" ? source.syncError : source.lastSyncedAt ? `${lang === "zh" ? "上次同步" : "Last synced"} ${new Date(source.lastSyncedAt).toLocaleString()}` : (lang === "zh" ? "等待首次同步" : "Waiting for first sync")}</small></div>
      <div>
        <button type="button" disabled={Boolean(busyId)} onClick={async () => { if (!api.refreshExternalCalendar) return; setBusyId(source.id); setError(""); try { await api.refreshExternalCalendar(source.id, true); await load(); changed(); } catch (caught) { setError(calendarFeedErrorMessage(caught, lang)); } finally { setBusyId(""); } }}>{busyId === source.id ? "…" : (lang === "zh" ? "同步" : "Sync")}</button>
        {confirmRemoveId === source.id ? <><button type="button" onClick={() => setConfirmRemoveId("")}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="button" className="danger-lite" disabled={Boolean(busyId)} onClick={async () => { if (!api.removeExternalCalendar) return; setBusyId(source.id); try { await api.removeExternalCalendar(source.id); setConfirmRemoveId(""); await load(); changed(); } catch (caught) { setError(calendarFeedErrorMessage(caught, lang)); } finally { setBusyId(""); } }}>{lang === "zh" ? "确认移除" : "Confirm removal"}</button></> : <button type="button" onClick={() => setConfirmRemoveId(source.id)}>{lang === "zh" ? "移除" : "Remove"}</button>}
      </div>
    </article>)}</div>
  </section>;
}

function SyncSettingsControl({
  settings,
  lang,
  cloudReady,
  isManualSyncing,
  onChange,
  onSyncNow,
}: {
  settings: Settings;
  lang: Language;
  cloudReady: boolean;
  isManualSyncing: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onSyncNow?: (direction?: "push" | "pull" | "both") => Promise<boolean> | void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const presetKey = presetForMinutes(settings.syncIntervalMinutes);
  const lastSyncedLabel = formatLastSyncedAt(settings.lastSyncedAt, lang, now);
  const lastSyncedAbsolute = settings.lastSyncedAt
    ? new Date(settings.lastSyncedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <section className="df-settings-sync">
      {!cloudReady && <p className="df-settings-sync-note">{t(lang, "sync.requiresAccount")}</p>}
      <label className="df-utility-select" data-disabled={!cloudReady}>
        {t(lang, "sync.frequency")}
        <select
          value={presetKey}
          disabled={!cloudReady}
          onChange={(event) => {
            const next = SYNC_INTERVAL_PRESETS.find((preset) => preset.key === event.target.value);
            if (!next) return;
            onChange({ syncIntervalMinutes: next.minutes });
          }}
        >
          {SYNC_INTERVAL_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.minutes === 0
                ? t(lang, "sync.manual")
                : preset.minutes === 15
                  ? t(lang, "sync.every15m")
                  : preset.minutes === 60
                    ? t(lang, "sync.every1h")
                    : preset.minutes === 360
                      ? t(lang, "sync.every6h")
                      : t(lang, "sync.every24h")}
            </option>
          ))}
        </select>
      </label>
      <div className="df-settings-sync-row">
        <span>
          <strong>{t(lang, "sync.lastSynced")}</strong>
          <small>{lastSyncedLabel}</small>
          {lastSyncedAbsolute && <small className="df-settings-sync-absolute">{lastSyncedAbsolute}</small>}
        </span>
        <button
          type="button"
          className={`df-settings-sync-now${isManualSyncing ? " is-syncing" : ""}`}
          disabled={!cloudReady || isManualSyncing}
          onClick={() => {
            void onSyncNow?.("both");
          }}
        >
          {isManualSyncing ? t(lang, "sync.syncing") : t(lang, "sync.syncNow")}
        </button>
      </div>
      <div className="df-settings-sync-directions">
        <button
          type="button"
          className="df-settings-sync-direction"
          disabled={!cloudReady || isManualSyncing}
          onClick={() => { void onSyncNow?.("push"); }}
          title={t(lang, "sync.pushHint")}
        >
          ↑ {t(lang, "sync.push")}
        </button>
        <button
          type="button"
          className="df-settings-sync-direction"
          disabled={!cloudReady || isManualSyncing}
          onClick={() => { void onSyncNow?.("pull"); }}
          title={t(lang, "sync.pullHint")}
        >
          ↓ {t(lang, "sync.pull")}
        </button>
      </div>
    </section>
  );
}

function DesktopUpdateControl({ lang }: { lang: Language }) {
  const api = window.desktopApi;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const updaterAvailable = Boolean(api);

  useEffect(() => {
    if (!updaterAvailable || !api) return;
    void api.getUpdateState().then(setState);
    return api.onUpdateState(setState);
  }, [api, updaterAvailable]);

  if (!updaterAvailable) {
    return <a className="df-download-link" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{lang === "zh" ? "一键下载最新版 Windows 应用" : "Download the latest Windows app"}<span aria-hidden="true">↓</span></a>;
  }

  const statusText = (() => {
    if (!state) return lang === "zh" ? "正在读取版本…" : "Reading version…";
    if (state.status === "checking") return lang === "zh" ? "正在检查更新…" : "Checking for updates…";
    if (state.status === "available") return lang === "zh" ? `发现 ${state.availableVersion}，点击下载` : `${state.availableVersion} is available. Click to download.`;
    if (state.status === "downloading") return lang === "zh" ? `正在下载 ${state.progress}%` : `Downloading ${state.progress}%`;
    if (state.status === "downloaded") return lang === "zh" ? `${state.availableVersion} 已准备好安装` : `${state.availableVersion} is ready to install`;
    if (state.status === "current") return lang === "zh" ? "当前已是最新版" : "You're up to date";
    if (state.status === "error") return lang === "zh" ? `更新失败：${state.message}` : `Update failed: ${state.message}`;
    return lang === "zh" ? "每 24 小时自动检查更新" : "Updates are checked every 24 hours";
  })();
  const busy = !state || state.status === "checking" || state.status === "downloading";
  const actionLabel = state?.status === "downloaded"
    ? (lang === "zh" ? "重启并安装" : "Restart and install")
    : state?.status === "available"
      ? (lang === "zh" ? "下载更新" : "Download update")
      : (lang === "zh" ? "立即检查更新" : "Check for updates");

  return <section className="df-update-card">
    <div><strong>{lang === "zh" ? "桌面应用更新" : "Desktop app updates"}</strong><small>{statusText}</small>{state?.currentVersion && <small>{lang === "zh" ? "当前版本" : "Current version"} {state.currentVersion}</small>}</div>
    {state?.status === "downloading" && <progress max="100" value={state.progress} />}
    <button type="button" disabled={busy} onClick={() => state?.status === "downloaded" ? void api?.installUpdate() : void api?.checkForUpdates().then(setState)}>{actionLabel}</button>
    <a href={DESKTOP_RELEASES_URL}>{lang === "zh" ? "查看发布说明" : "View release notes"}</a>
  </section>;
}

function AutoLaunchToggle({ lang }: { lang: Language }) {
  const api = window.desktopApi;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api) { setLoading(false); return; }
    let active = true;
    void readAutoLaunchState(api, false).then((next) => {
      if (!active) return;
      setEnabled(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [api]);

  if (!api) return null;

  const toggleAutoLaunch = async () => {
    setLoading(true);
    const next = await toggleAutoLaunchState(api, enabled);
    setEnabled(next);
    setLoading(false);
  };

  return <section className="df-update-card">
    <div>
      <strong>{lang === "zh" ? "开机自启动" : "Launch at startup"}</strong>
      <small>{lang === "zh" ? "登录系统时自动打开 NavoPath" : "Automatically open NavoPath when you sign in"}</small>
    </div>
    <button
      type="button"
      disabled={loading}
      onClick={() => { void toggleAutoLaunch(); }}
      aria-pressed={enabled}
    >
      {loading ? "…" : enabled ? (lang === "zh" ? "已开启" : "On") : (lang === "zh" ? "已关闭" : "Off")}
    </button>
  </section>;
}

function patchPluginConfig(settings: Settings, onSave: (patch: Partial<Settings>) => void, pluginId: string, patch: Record<string, unknown>) {
  const existing = settings.pluginConfigs?.[pluginId] ?? {};
  onSave({ pluginConfigs: { ...(settings.pluginConfigs ?? {}), [pluginId]: { ...existing, ...patch } } });
}

function localizedPluginName(plugin: ReturnType<typeof listRegisteredPlugins>[number], lang: Language) {
  return pluginText(plugin.name, plugin.nameI18n, lang);
}

function localizedPluginDescription(plugin: ReturnType<typeof listRegisteredPlugins>[number], lang: Language) {
  return pluginText(plugin.description, plugin.descriptionI18n, lang);
}

function localizedPluginEnabledSummary(plugin: ReturnType<typeof listRegisteredPlugins>[number], lang: Language) {
  return pluginText(
    lang === "zh" ? "启用后会在下方工具区显示可直接使用的官方工具。" : "After enabling, its official tool appears below.",
    plugin.enabledSummaryI18n,
    lang,
  );
}

function SubscriptionPanel({ lang }: { lang: Language }) {
  const tiers = lang === "zh"
    ? [
      { name: "Free", price: "¥0", note: "当前启用", items: ["本地任务与项目规划", "核心时间轴与日/周/月视图", "基础导入导出", "官方内置插件预览"] },
      { name: "Supporter", price: "爱发电支持", note: "适合支持持续开发", items: ["支持者身份入口", "优先体验实验性插件", "更多 AI / 同步额度预留", "公开路线图优先反馈"] },
      { name: "Pro", price: "即将推出", note: "开发测试期暂时开放核心权益", items: ["多设备云端同步", "Navo AI 对话与记忆", "MCP 远程访问", "高级导入导出与备份"] },
    ]
    : [
      { name: "Free", price: "$0", note: "Active now", items: ["Local tasks and projects", "Core timeline and calendar views", "Basic import and export", "Official built-in plugin preview"] },
      { name: "Supporter", price: "Donation", note: "For supporting ongoing work", items: ["Supporter entry point", "Early experimental plugin access", "Reserved AI / sync quota framing", "Priority feedback on the roadmap"] },
      { name: "Pro", price: "Coming soon", note: "Core benefits are open during dev preview", items: ["Multi-device cloud sync", "Navo AI chat and memory", "Remote MCP access", "Advanced import/export and backups"] },
    ];
  return (
    <section className="df-subscription-panel">
      <div className="df-subscription-head">
        <span>{lang === "zh" ? "方案权限" : "Plan access"}</span>
        <strong>{lang === "zh" ? "Dev Preview" : "Dev Preview"}</strong>
        <small>{lang === "zh" ? "开发测试期会暂时开放部分 Pro 权益；正式权限以后端开通为准。" : "Some Pro-like benefits are open during the dev preview; final access will follow backend entitlement."}</small>
      </div>
      <div className="df-plan-choice-grid detailed" role="list">
        {tiers.map((tier, index) => (
          <article className={`df-plan-choice ${index === 0 ? "active" : ""}`} role="listitem" key={tier.name}>
            <span>{tier.name}</span>
            <strong>{tier.price}</strong>
            <small>{tier.note}</small>
            <ul>
              {tier.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <a className="df-donation-link" href={DONATION_URL} target="_blank" rel="noreferrer">
        <span>{lang === "zh" ? "通过爱发电支持 NavoPath" : "Support NavoPath on Afdian"}</span>
        <small>{lang === "zh" ? "捐赠不会立即改变当前账户权限，但会支持后续服务和插件维护。" : "Donation does not immediately change account access, but supports ongoing service and plugin maintenance."}</small>
      </a>
    </section>
  );
}

function AccountMoreSection({ lang, onShowAbout, onSignOut, onDeleteAccount }: { lang: Language; onShowAbout: () => void; onSignOut?: () => void; onDeleteAccount?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="df-account-more">
      <button type="button" className="df-account-more-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{lang === "zh" ? "更多" : "More"}</span>
        <i aria-hidden="true">{open ? "−" : "+"}</i>
      </button>
      {open && <div className="df-account-more-body">
        <button className="df-settings-about" onClick={onShowAbout}>
          <span className="df-settings-about-icon">i</span>
          <span>{t(lang, "settings.about")}</span>
          <small>{lang === "zh" ? "将打开外部链接" : "Opens external link"}</small>
          <i aria-hidden="true">↗</i>
        </button>
        {onSignOut && <button className="df-settings-logout" onClick={onSignOut}>{t(lang, "settings.logout")}</button>}
        {onDeleteAccount && <button className="df-settings-delete-account" onClick={onDeleteAccount}>{lang === "zh" ? "删除账号和全部数据" : "Delete account and all data"}</button>}
      </div>}
    </section>
  );
}

function PomodoroPluginTool({ settings, onSave, lang }: { settings: Settings; onSave: (patch: Partial<Settings>) => void; lang: Language }) {
  const plugin = listRegisteredPlugins().find((p) => p.id === "pomodoro");
  const config = plugin ? resolvePluginConfig(plugin, settings.pluginConfigs?.pomodoro) : {};
  const focusMinutes = Number(config.focusMinutes) || 25;
  const breakMinutes = Number(config.breakMinutes) || 5;
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(focusMinutes * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value > 1) return value - 1;
        const nextPhase = phase === "focus" ? "break" : "focus";
        setPhase(nextPhase);
        return (nextPhase === "focus" ? focusMinutes : breakMinutes) * 60;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, phase, focusMinutes, breakMinutes]);
  useEffect(() => { if (!running) setSeconds((phase === "focus" ? focusMinutes : breakMinutes) * 60); }, [focusMinutes, breakMinutes, phase, running]);
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return (
    <article className="df-plugin-tool">
      <header><strong>Pomodoro</strong><small>{phase === "focus" ? (lang === "zh" ? "专注" : "Focus") : (lang === "zh" ? "休息" : "Break")}</small></header>
      <div className="df-plugin-timer">{mm}:{ss}</div>
      <div className="df-plugin-tool-actions">
        <button type="button" onClick={() => setRunning((value) => !value)}>{running ? (lang === "zh" ? "暂停" : "Pause") : (lang === "zh" ? "开始" : "Start")}</button>
        <button type="button" onClick={() => { setRunning(false); setPhase("focus"); setSeconds(focusMinutes * 60); }}>{lang === "zh" ? "重置" : "Reset"}</button>
      </div>
      <small>{lang === "zh" ? "时长可在插件配置中调整。" : "Adjust durations in plugin configuration."}</small>
    </article>
  );
}

function HabitPluginTool({ settings, onSave, lang }: { settings: Settings; onSave: (patch: Partial<Settings>) => void; lang: Language }) {
  const plugin = listRegisteredPlugins().find((p) => p.id === "habit-tracker");
  const config = plugin ? resolvePluginConfig(plugin, settings.pluginConfigs?.["habit-tracker"]) : {};
  const today = todayIso();
  const habits = String(config.habits || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const displayHabits = habits.length > 0 ? habits : (lang === "zh" ? ["复盘今天", "整理任务", "查看明日计划"] : ["Review today", "Tidy tasks", "Check tomorrow"]);
  const doneByDate = (config.doneByDate && typeof config.doneByDate === "object" ? config.doneByDate : {}) as Record<string, string[]>;
  const done = new Set(doneByDate[today] || []);
  const toggle = (habit: string) => {
    const next = new Set(done);
    if (next.has(habit)) next.delete(habit);
    else next.add(habit);
    patchPluginConfig(settings, onSave, "habit-tracker", { doneByDate: { ...doneByDate, [today]: Array.from(next) } });
  };
  return (
    <article className="df-plugin-tool">
      <header><strong>{lang === "zh" ? "习惯" : "Habits"}</strong><small>{done.size}/{displayHabits.length}</small></header>
      <div className="df-plugin-habits">
        {displayHabits.map((habit) => <label key={habit}><input type="checkbox" checked={done.has(habit)} onChange={() => toggle(habit)} />{habit}</label>)}
      </div>
    </article>
  );
}

function WeatherPluginTool({ settings, lang }: { settings: Settings; lang: Language }) {
  const plugin = listRegisteredPlugins().find((p) => p.id === "weather");
  const config = plugin ? resolvePluginConfig(plugin, settings.pluginConfigs?.weather) : {};
  const city = String(config.city || "Shanghai");
  const units = config.units === "f" ? "f" : "c";
  const seed = Array.from(city).reduce((sum, char) => sum + char.charCodeAt(0), new Date().getDate());
  const celsius = 16 + (seed % 15);
  const value = units === "f" ? Math.round(celsius * 9 / 5 + 32) : celsius;
  const condition = [lang === "zh" ? "晴朗" : "Clear", lang === "zh" ? "多云" : "Cloudy", lang === "zh" ? "有风" : "Breezy"][seed % 3];
  return (
    <article className="df-plugin-tool">
      <header><strong>{lang === "zh" ? "天气" : "Weather"}</strong><small>{city}</small></header>
      <div className="df-plugin-weather"><strong>{value}°{units.toUpperCase()}</strong><span>{condition}</span></div>
      <small>{lang === "zh" ? "本地预览徽章，不请求外部天气 API。" : "Local preview badge. No external weather API call."}</small>
    </article>
  );
}

function NotesPluginTool({ data, onSaveData, lang }: { data: PlannerData; onSaveData: (next: PlannerData) => void; lang: Language }) {
  const task = data.tasks[0];
  const [taskId, setTaskId] = useState(task?.id || "");
  const selected = data.tasks.find((item) => item.id === taskId) || task;
  if (!selected) {
    return <article className="df-plugin-tool"><header><strong>{lang === "zh" ? "笔记" : "Notes"}</strong></header><small>{lang === "zh" ? "先创建一个任务后即可写笔记。" : "Create a task first to attach notes."}</small></article>;
  }
  const saveNotes = (notes: string) => {
    onSaveData({ ...data, tasks: data.tasks.map((item) => item.id === selected.id ? { ...item, notes, updatedAt: new Date().toISOString() } : item) });
  };
  return (
    <article className="df-plugin-tool wide">
      <header><strong>{lang === "zh" ? "任务笔记" : "Task notes"}</strong><small>{lang === "zh" ? "保存到任务 notes 字段" : "Saved to the task notes field"}</small></header>
      <select value={selected.id} onChange={(event) => setTaskId(event.target.value)}>
        {data.tasks.slice(0, 80).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <textarea rows={4} value={selected.notes || ""} onChange={(event) => saveNotes(event.target.value)} placeholder={lang === "zh" ? "写下任务背景、材料或下一步..." : "Add context, materials, or next steps..."} />
    </article>
  );
}

function PluginRuntimePanel({ settings, data, onSave, onSaveData, lang }: { settings: Settings; data: PlannerData; onSave: (patch: Partial<Settings>) => void; onSaveData: (next: PlannerData) => void; lang: Language }) {
  const enabled = new Set(settings.enabledPlugins ?? []);
  if (enabled.size === 0) {
    return <p className="df-plugin-empty">{lang === "zh" ? "启用上方插件后，这里会出现可直接使用的工具。" : "Enable plugins above and their tools will appear here."}</p>;
  }
  return (
    <section className="df-plugin-runtime" aria-label={lang === "zh" ? "已启用插件工具" : "Enabled plugin tools"}>
      {enabled.has("pomodoro") && <PomodoroPluginTool settings={settings} onSave={onSave} lang={lang} />}
      {enabled.has("habit-tracker") && <HabitPluginTool settings={settings} onSave={onSave} lang={lang} />}
      {enabled.has("weather") && <WeatherPluginTool settings={settings} lang={lang} />}
      {enabled.has("notes") && <NotesPluginTool data={data} onSaveData={onSaveData} lang={lang} />}
    </section>
  );
}

function UtilityPanel({ kind, settings, initialSection, data, authEmail, onClose, onSave, onWidgetAction, onSaveData, onClearChatHistory, onShowAbout, onSignOut, onDeleteAccount, onSyncNow, isManualSyncing, cloudReady, lang, onOpenScheduleTemplates }: { kind: "settings" | "about"; settings: Settings; initialSection?: SettingsTargetInput; data: PlannerData; authEmail: string; onClose: () => void; onSave: (patch: Partial<Settings>) => void; onWidgetAction: (action: WidgetAction) => void; onSaveData: (next: PlannerData) => void; onClearChatHistory: () => void; onShowAbout: () => void; onSignOut?: () => void; onDeleteAccount?: () => void; onSyncNow?: (direction?: "push" | "pull" | "both") => Promise<boolean> | void; isManualSyncing?: boolean; cloudReady?: boolean; lang: Language; onOpenScheduleTemplates?: () => void }) {
  const resolvedInitial = normalizeSettingsTarget(initialSection);
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget>(resolvedInitial);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [accentSettingsOpen, setAccentSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [widgetThemeOpen, setWidgetThemeOpen] = useState<"light" | "dark">("light");
  const [integrationTab, setIntegrationTab] = useState<"calendar" | "external-calendar" | "plugins" | "mcp">("calendar");
  const settingsContentRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsResults = useMemo(() => searchSettings(settingsQuery, lang), [settingsQuery, lang]);
  useEffect(() => {
    if (initialSection) setSettingsTarget(normalizeSettingsTarget(initialSection));
  }, [initialSection]);
  useEffect(() => {
    if (kind !== "settings") return;
    closeButtonRef.current?.focus();
  }, [kind]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  useEffect(() => {
    if (settingsTarget.anchor === "accent-colors") setAccentSettingsOpen(true);
    if (settingsTarget.anchor === "shortcuts") setShortcutsOpen(true);
    if (settingsTarget.anchor?.startsWith("widget-light")) setWidgetThemeOpen("light");
    if (settingsTarget.anchor?.startsWith("widget-dark")) setWidgetThemeOpen("dark");
    if (settingsTarget.anchor === "mcp") setIntegrationTab("mcp");
    if (settingsTarget.anchor === "plugins") setIntegrationTab("plugins");
    if (settingsTarget.anchor === "external-calendar") setIntegrationTab("external-calendar");
  }, [settingsTarget.anchor]);
  useEffect(() => {
    const content = settingsContentRef.current;
    if (!content) return;
    const handle = window.requestAnimationFrame(() => {
      const anchor = settingsTarget.anchor
        ? content.querySelector<HTMLElement>(`[data-settings-anchor="${settingsTarget.anchor}"]`)
        : null;
      if (!anchor) {
        content.scrollTop = 0;
        return;
      }
      content.scrollTop = Math.max(0, anchor.offsetTop - 12);
      anchor.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [settingsTarget]);

  function navigateSettings(target: SettingsTarget) {
    if (target.anchor === "accent-colors") setAccentSettingsOpen(true);
    if (target.anchor === "shortcuts") setShortcutsOpen(true);
    if (target.anchor?.startsWith("widget-light")) setWidgetThemeOpen("light");
    if (target.anchor?.startsWith("widget-dark")) setWidgetThemeOpen("dark");
    if (target.anchor === "mcp") setIntegrationTab("mcp");
    if (target.anchor === "plugins") setIntegrationTab("plugins");
    if (target.anchor === "calendar-feed") setIntegrationTab("calendar");
    if (target.anchor === "external-calendar") setIntegrationTab("external-calendar");
    setSettingsTarget(target);
    setSettingsQuery("");
  }
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [confirmClearLocalData, setConfirmClearLocalData] = useState(false);
  const [clearLocalDataPhrase, setClearLocalDataPhrase] = useState("");
  const [pluginConfigDialogId, setPluginConfigDialogId] = useState<string | null>(null);
  const [pluginConfigDraft, setPluginConfigDraft] = useState<Record<string, unknown>>({});
  const widgetAppearance = normalizeWidgetAppearance(settings.widgetAppearance);
  const widgetTimerSettings = normalizeWidgetTimerPreferences(settings.widgetTimerPreferences);
  const [widgetTimerDraft, setWidgetTimerDraft] = useState(widgetTimerSettings);
  useEffect(() => {
    setWidgetTimerDraft(widgetTimerSettings);
  }, [settings.widgetTimerPreferences]);
  const saveWidgetAppearance = (patch: Parameters<typeof normalizeWidgetAppearance>[0]) => onSave({
    widgetAppearance: normalizeWidgetAppearance({ ...widgetAppearance, ...patch }),
    widgetAppearanceMigrated: true,
  });
  const saveWidgetThemeColor = (theme: "light" | "dark", patch: Partial<typeof widgetAppearance.light>) => saveWidgetAppearance({
    [theme]: { ...widgetAppearance[theme], ...patch },
  });
  const updateWidgetTimerDraft = (patch: Partial<typeof widgetTimerDraft>) => setWidgetTimerDraft(normalizeWidgetTimerPreferences({ ...widgetTimerDraft, ...patch }));
  // Force a re-render of the plugin list when activation state changes (the
  // registry holds state outside React).
  const [, setPluginRefreshTick] = useState(0);

  function togglePlugin(pluginId: string) {
    const list = settings.enabledPlugins ?? [];
    const enabled = list.includes(pluginId);
    const next = enabled ? list.filter((id) => id !== pluginId) : [...list, pluginId];
    onSave({ enabledPlugins: next });
  }

  function openPluginConfig(pluginId: string) {
    const plugin = listRegisteredPlugins().find((p) => p.id === pluginId);
    if (!plugin) return;
    const resolved = resolvePluginConfig(plugin, settings.pluginConfigs?.[pluginId]);
    setPluginConfigDraft(resolved);
    setPluginConfigDialogId(pluginId);
  }

  function savePluginConfigField(key: string, value: unknown) {
    setPluginConfigDraft((prev) => ({ ...prev, [key]: value }));
  }

  function commitPluginConfig() {
    if (!pluginConfigDialogId) return;
    const plugin = listRegisteredPlugins().find((item) => item.id === pluginConfigDialogId);
    if (!plugin) return;
    const existing = settings.pluginConfigs?.[pluginConfigDialogId] ?? {};
    const normalized = resolvePluginConfig(plugin, pluginConfigDraft);
    const merged = plugin.source === "external" ? normalized : { ...existing, ...normalized };
    const nextConfigs = { ...(settings.pluginConfigs ?? {}), [pluginConfigDialogId]: merged };
    onSave({ pluginConfigs: nextConfigs });
    setPluginConfigDialogId(null);
    setPluginConfigDraft({});
    setPluginRefreshTick((n) => n + 1);
  }

  const defaultAccent = settings.theme === "dark" ? "#EEE9DF" : "#27231E";
  const shortcutGroups = groupShortcutsByScope(SHORTCUTS);
  const shortcutScopeLabel = (scope: ShortcutScope) => {
    if (lang === "zh") {
      if (scope === "global") return "全局";
      if (scope === "timeline") return "时间轴";
      if (scope === "mode") return "模式";
      return "计时";
    }
    if (scope === "global") return "Global";
    if (scope === "timeline") return "Timeline";
    if (scope === "mode") return "Mode";
    return "Timer";
  };
  const visibleMemories = (data.aiMemories || [])
    .filter((memory) => !memory.archived)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  const saveMemory = (memoryId: string, patch: Partial<AiMemory>) => {
    const now = new Date().toISOString();
    onSaveData({
      ...data,
      aiMemories: (data.aiMemories || []).map((memory) => memory.id === memoryId ? { ...memory, ...patch, updatedAt: now } : memory),
    });
  };
  const addManualMemory = () => {
    const now = new Date().toISOString();
    onSaveData({
      ...data,
      aiMemories: [
        ...(data.aiMemories || []),
        { id: uid("memory"), content: lang === "zh" ? "新的 AI 记忆" : "New AI memory", tags: ["manual"], source: "manual", createdAt: now, updatedAt: now, pinned: false, archived: false },
      ],
    });
  };

  const importDataFromJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!isImportFileSizeAllowed(file.size, "backup")) {
        alert(lang === "zh" ? "备份文件超过 20 MB 限制。" : "Backup file exceeds the 20 MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const backup = parsePlannerBackupJson(content);
          onSaveData(preparePlannerDataRestore(backup.data, data));
          onSave(backup.settings);
          alert(lang === "zh" ? "数据导入成功！" : "Data imported successfully!");
        } catch {
          alert(lang === "zh" ? "数据导入失败，无法解析文件。" : "Import failed: unable to parse file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const importTasksFromCsv = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!isImportFileSizeAllowed(file.size, "tasks")) {
        alert(lang === "zh" ? "CSV 文件超过 10 MB 限制。" : "CSV file exceeds the 10 MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const tasks = parseTasksCsv(content, data.projects);
          if (tasks.length === 0) {
            alert(lang === "zh" ? "数据导入失败，文件为空或格式不正确。" : "Import failed: file is empty or invalid.");
            return;
          }

          // Merge imported tasks with existing tasks
          const existingIds = new Set(data.tasks.map((t) => t.id));
          const newTasks = tasks.filter((t) => !existingIds.has(t.id));
          onSaveData({
            ...data,
            tasks: [...data.tasks, ...newTasks],
          });
          alert(lang === "zh" ? `成功导入 ${newTasks.length} 个任务！` : `Successfully imported ${newTasks.length} tasks!`);
        } catch {
          alert(lang === "zh" ? "数据导入失败，无法解析文件。" : "Import failed: unable to parse file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const {
        ACCEPTED_RASTER_MIME_TYPES,
        MAX_AVATAR_FILE_BYTES,
        assertSafeRasterDimensions,
      } = await import("./imageSafety");
      if (!ACCEPTED_RASTER_MIME_TYPES.has(file.type) || file.size > MAX_AVATAR_FILE_BYTES) {
        alert(lang === "zh" ? "请选择不超过 5 MB 的 PNG、JPEG 或 WebP 图片。" : "Choose a PNG, JPEG, or WebP image up to 5 MB.");
        return;
      }
      assertSafeRasterDimensions(await file.arrayBuffer());
      const image = await createImageBitmap(file);
      try {
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
      } finally {
        image.close();
      }
    } catch {
      alert(lang === "zh" ? "图片无效或像素尺寸过大。" : "The image is invalid or its pixel dimensions are too large.");
    }
  };
  return (
    <>
      <div className="df-utility-backdrop" onMouseDown={onClose} />
      <aside className="df-utility-panel" role="dialog" aria-modal="true" aria-labelledby="df-utility-title">
        <MobileSheetDismissHandle onDismiss={onClose} lang={lang} />
        <div className="df-utility-head">
          <h2 id="df-utility-title">{kind === "settings" ? t(lang, "settings.settings") : t(lang, "settings.aboutNavo")}</h2>
          <button ref={closeButtonRef} className="df-icon-action i-close" aria-label={t(lang, "settings.close")} onClick={onClose} />
        </div>
        {kind === "settings" ? (
          <div className="df-utility-body df-settings-shell">
            <div className="df-settings-rail">
              <label className="df-settings-search">
                <span className="df-visually-hidden">{lang === "zh" ? "搜索设置" : "Search settings"}</span>
                <input
                  type="search"
                  value={settingsQuery}
                  placeholder={lang === "zh" ? "搜索设置" : "Search settings"}
                  onChange={(event) => setSettingsQuery(event.target.value)}
                  aria-controls="df-settings-search-results"
                  aria-expanded={Boolean(settingsQuery.trim())}
                />
              </label>
              {settingsQuery.trim() && <div id="df-settings-search-results" className="df-settings-search-results" role="listbox">
                {settingsResults.length > 0 ? settingsResults.map((result) => (
                  <button
                    type="button"
                    role="option"
                    key={result.id}
                    onClick={() => navigateSettings(result.target)}
                  >
                    <strong>{lang === "zh" ? result.labelZh : result.labelEn}</strong>
                    <span>{settingsSearchPath(result, lang)}</span>
                  </button>
                )) : <p>{lang === "zh" ? "没有找到相关设置" : "No matching settings"}</p>}
              </div>}
              <label className="df-settings-mobile-category">
                <span className="df-visually-hidden">{lang === "zh" ? "设置分类" : "Settings category"}</span>
                <select value={settingsTarget.category} onChange={(event) => navigateSettings({ category: event.target.value as SettingsCategory })}>
                  {SETTINGS_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{lang === "zh" ? category.labelZh : category.labelEn}</option>)}
                </select>
              </label>
              <nav className="df-settings-nav" aria-label={lang === "zh" ? "设置分区" : "Settings sections"}>
                {SETTINGS_CATEGORIES.map((category) => (
                  <button type="button" key={category.id} className={settingsTarget.category === category.id ? "active" : ""} aria-current={settingsTarget.category === category.id ? "page" : undefined} onClick={() => navigateSettings({ category: category.id })}>{lang === "zh" ? category.labelZh : category.labelEn}</button>
                ))}
              </nav>
            </div>
            <div ref={settingsContentRef} className="df-settings-content">
            {settingsTarget.category === "advanced" && settingsTarget.detail && <div className="df-settings-detail-head">
              <button type="button" onClick={() => navigateSettings({ category: "advanced" })}>← {lang === "zh" ? "高级" : "Advanced"}</button>
              <span>{settingsDetailLabel(settingsTarget.detail, lang)}</span>
            </div>}
            {settingsTarget.category === "general" && <SettingSection anchor="general-basics" title={lang === "zh" ? "基础" : "Basics"} description={lang === "zh" ? "语言、时间边界与启动位置。" : "Language, time boundary, and startup destination."}>
              <SettingRow
                anchor="language"
                title={lang === "zh" ? "语言" : "Language"}
                control={<SettingSelect<Language>
                  value={settings.language || lang}
                  ariaLabel={lang === "zh" ? "语言" : "Language"}
                  onChange={(value) => onSave({ language: value })}
                  options={[
                    { value: "zh", label: "中文" },
                    { value: "en", label: "English" },
                  ]}
                />}
              />
              <SettingRow
                anchor="day-start"
                title={lang === "zh" ? "一天开始时间" : "Day start time"}
                description={lang === "zh" ? "决定时间轴的起始分界，影响跨天滚动与统计范围。" : "Sets the boundary used by the timeline, cross-day scroll, and metric ranges."}
                control={<SettingTextInput type="time" value={settings.dayStartTime || "00:00"} ariaLabel={lang === "zh" ? "一天开始时间" : "Day start time"} onChange={(value) => onSave({ dayStartTime: value })} />}
              />
              <SettingRow
                anchor="default-page"
                title={lang === "zh" ? "默认打开页面" : "Default page"}
                description={lang === "zh" ? "启动时优先进入执行或规划。" : "Choose whether the app opens on Execution or Planning."}
                control={<SettingSelect<Settings["activeMode"]>
                  value={settings.activeMode}
                  ariaLabel={lang === "zh" ? "默认打开页面" : "Default page"}
                  onChange={(value) => onSave({ activeMode: value })}
                  options={[
                    { value: "execute", label: lang === "zh" ? "执行" : "Execution" },
                    { value: "planning", label: lang === "zh" ? "规划" : "Planning" },
                  ]}
                />}
              />
            </SettingSection>}

            {settingsTarget.category === "appearance" && <SettingSection title={lang === "zh" ? "外观" : "Appearance"} description={lang === "zh" ? "纸面风格、字体与克制的点缀色。" : "Paper surface, typography, and restrained accent color."}>
              <SettingRow
                anchor="theme"
                title={t(lang, "settings.uiMode")}
                control={<SettingSelect<Settings["theme"]>
                  value={settings.theme}
                  ariaLabel={t(lang, "settings.uiMode")}
                  onChange={(value) => onSave({ theme: value })}
                  options={[
                    { value: "light", label: t(lang, "settings.light") },
                    { value: "dark", label: t(lang, "settings.dark") },
                  ]}
                />}
              />
              <SettingRow
                anchor="typography"
                title={lang === "zh" ? "字体风格" : "Typography"}
                control={<SettingSelect<Settings["typographyStyle"]>
                  value={settings.typographyStyle || "editorial"}
                  ariaLabel={lang === "zh" ? "字体风格" : "Typography"}
                  onChange={(value) => onSave({ typographyStyle: value })}
                  options={[
                    { value: "editorial", label: lang === "zh" ? "编辑衬线" : "Editorial Serif" },
                    { value: "balanced", label: lang === "zh" ? "平衡混排" : "Balanced" },
                    { value: "sans", label: lang === "zh" ? "现代无衬线" : "Modern Sans" },
                  ]}
                />}
              />
              <SettingRow
                anchor="timeline-font"
                title={lang === "zh" ? "时间轴字体大小" : "Timeline font size"}
                description={lang === "zh" ? "调整时间轴任务标题字号。" : "Scale the timeline task title font size."}
                control={
                  <span className="df-settings-number-wrap">
                    <input
                      type="range"
                      className="df-settings-range"
                      min={0.85}
                      max={1.3}
                      step={0.05}
                      value={settings.timelineFontScale ?? 1}
                      aria-label={lang === "zh" ? "时间轴字体大小" : "Timeline font size"}
                      onChange={(event) => onSave({ timelineFontScale: Number(event.target.value) })}
                    />
                    <span className="df-settings-number-suffix">{Math.round((settings.timelineFontScale ?? 1) * 100)}%</span>
                  </span>
                }
              />
              <SettingRow
                anchor="task-block-fill"
                title={lang === "zh" ? "任务块颜色填充" : "Fill task block with project color"}
                description={lang === "zh" ? "以归属项目色整块填充（开启）或仅描边（关闭）。" : "Fill the whole block with project color (on) or use a thin outline (off)."}
                control={<SettingToggle checked={Boolean(settings.taskBlockFill)} ariaLabel={lang === "zh" ? "任务块颜色填充" : "Fill task block with project color"} onChange={(next) => onSave({ taskBlockFill: next })} />}
              />
              <div className="df-settings-disclosure" data-settings-anchor="accent-colors" tabIndex={-1}>
                <button type="button" className="df-settings-disclosure-toggle" aria-expanded={accentSettingsOpen} onClick={() => setAccentSettingsOpen((open) => !open)}>
                  <span><strong>{lang === "zh" ? "自定义点缀色" : "Customize accent colors"}</strong><small>{lang === "zh" ? "用于细线、勾选与当前时间标记。" : "Used for fine rules, checks, and the current-time marker."}</small></span>
                  <i aria-hidden="true">{accentSettingsOpen ? "−" : "+"}</i>
                </button>
                {accentSettingsOpen && <div className="df-settings-disclosure-body">
                  <SettingDescription>{lang === "zh" ? "点缀色不会作为大面积填充；恢复后使用当前纸面主题的默认墨色。" : "Accent colors never become dominant fills; restore returns to the current paper theme's default ink."}</SettingDescription>
                  <div className="df-settings-accent-row">
                    <ThemeColorSetting label={t(lang, "settings.executeAccent")} presets={settings.theme === "dark" ? EXECUTE_THEME_PRESETS_DARK : EXECUTE_THEME_PRESETS_LIGHT} value={settings.executeAccentColor || defaultAccent} onChange={(color) => onSave({ executeAccentColor: color })} />
                    <ThemeColorSetting label={t(lang, "settings.planningAccent")} presets={settings.theme === "dark" ? PLANNING_THEME_PRESETS_DARK : PLANNING_THEME_PRESETS_LIGHT} value={settings.planningAccentColor || defaultAccent} onChange={(color) => onSave({ planningAccentColor: color })} />
                  </div>
                  <SettingRow
                    title={lang === "zh" ? "恢复默认点缀色" : "Restore default accent colors"}
                    control={<SettingActionButton onClick={() => onSave({ executeAccentColor: "", planningAccentColor: "" })}>{lang === "zh" ? "恢复" : "Restore"}</SettingActionButton>}
                  />
                </div>}
              </div>
            </SettingSection>}

            {settingsTarget.category === "general" && <SettingSection anchor="execution-defaults" title={lang === "zh" ? "执行默认项" : "Execution defaults"} description={lang === "zh" ? "时间轴、专注与完成任务的默认行为。" : "Default timeline, focus, and completed-task behavior."}>
              <SettingRow
                anchor="default-timeline"
                title={lang === "zh" ? "默认时间轴视图" : "Default timeline view"}
                control={<SettingSelect<NonNullable<Settings["defaultTimelineView"]>>
                  value={settings.defaultTimelineView || "daily"}
                  ariaLabel={lang === "zh" ? "默认时间轴视图" : "Default timeline view"}
                  onChange={(value) => onSave({ defaultTimelineView: value })}
                  options={[
                    { value: "daily", label: viewLabel(lang, "daily") },
                    { value: "3day", label: viewLabel(lang, "3day") },
                    { value: "weekly", label: viewLabel(lang, "weekly") },
                    { value: "month", label: viewLabel(lang, "month") },
                  ]}
                />}
              />
              <SettingRow
                anchor="continuous-scroll"
                title={lang === "zh" ? "开启无限跨天滚动" : "Continuous cross-day scroll"}
                description={lang === "zh" ? "时间轴可连续滚动到前后日期。" : "The timeline scrolls continuously across days."}
                control={<SettingToggle checked={settings.continuousCrossDayScroll !== false} ariaLabel={lang === "zh" ? "无限跨天滚动" : "Continuous cross-day scroll"} onChange={(next) => onSave({ continuousCrossDayScroll: next })} />}
              />
              <SettingRow
                anchor="focus-mode"
                title={lang === "zh" ? "默认专注模式" : "Default focus mode"}
                description={lang === "zh" ? "进入专注时默认使用的计时方式。" : "Timer mode used when entering focus."}
                control={<SettingSelect<NonNullable<Settings["focusModeDefault"]>>
                  value={settings.focusModeDefault || "flowtime"}
                  ariaLabel={lang === "zh" ? "默认专注模式" : "Default focus mode"}
                  onChange={(value) => onSave({ focusModeDefault: value })}
                  options={[
                    { value: "stopwatch", label: lang === "zh" ? "秒表" : "Stopwatch" },
                    { value: "pomodoro", label: "Pomodoro" },
                    { value: "flowtime", label: "Flowtime" },
                  ]}
                />}
              />
              <SettingRow
                anchor="idle-threshold"
                title={lang === "zh" ? "空闲阈值" : "Idle threshold"}
                description={lang === "zh" ? "超过该时长未操作视为空闲，0 表示关闭。" : "Idle minutes before the timer auto-pauses; 0 disables."}
                control={<SettingSelect<string>
                  value={String(settings.idleThresholdMinutes ?? 5)}
                  ariaLabel={lang === "zh" ? "空闲阈值" : "Idle threshold"}
                  onChange={(value) => onSave({ idleThresholdMinutes: Number(value) })}
                  options={[
                    { value: "3", label: `3 ${lang === "zh" ? "分钟" : "min"}` },
                    { value: "5", label: `5 ${lang === "zh" ? "分钟" : "min"}` },
                    { value: "10", label: `10 ${lang === "zh" ? "分钟" : "min"}` },
                    { value: "15", label: `15 ${lang === "zh" ? "分钟" : "min"}` },
                    { value: "0", label: lang === "zh" ? "关闭" : "Off" },
                  ]}
                />}
              />
              <SettingRow
                anchor="hide-completed"
                title={t(lang, "settings.hideCompleted")}
                description={lang === "zh" ? "在时间轴上隐藏已完成任务。" : "Hide completed tasks from the timeline."}
                control={<SettingToggle checked={Boolean(settings.hideCompleted)} ariaLabel={t(lang, "settings.hideCompleted")} onChange={(next) => onSave({ hideCompleted: next })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="planning-views" title={lang === "zh" ? "规划视图" : "Planning views"} description={lang === "zh" ? "选择规划页中可用的组织方式。" : "Choose the organization views available on Planning."}>
              <SettingRow
                title={lang === "zh" ? "启用看板视图" : "Enable Kanban view"}
                control={<SettingToggle checked={settings.featureKanbanViewEnabled !== false} ariaLabel={lang === "zh" ? "启用看板视图" : "Enable Kanban view"} onChange={(next) => onSave({ featureKanbanViewEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "启用四象限视图" : "Enable Eisenhower matrix view"}
                control={<SettingToggle checked={settings.featureQuadrantViewEnabled !== false} ariaLabel={lang === "zh" ? "启用四象限视图" : "Enable Eisenhower matrix view"} onChange={(next) => onSave({ featureQuadrantViewEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "启用列表视图" : "Enable list view"}
                control={<SettingToggle checked={settings.featureListViewEnabled !== false} ariaLabel={lang === "zh" ? "启用列表视图" : "Enable list view"} onChange={(next) => onSave({ featureListViewEnabled: next })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="smart-scheduling" title={lang === "zh" ? "智能排程" : "Smart scheduling"} description={lang === "zh" ? "定义自动排程使用的工作时段与任务间隔。" : "Define the working window and task spacing used by automatic scheduling."}>
              <SettingRow
                anchor="schedule-start"
                title={lang === "zh" ? "规划开始" : "Planning starts"}
                control={<SettingTextInput type="time" value={settings.scheduleDayStartTime || "08:00"} ariaLabel={lang === "zh" ? "规划开始" : "Planning starts"} onChange={(value) => onSave({ scheduleDayStartTime: value })} />}
              />
              <SettingRow
                anchor="schedule-end"
                title={lang === "zh" ? "规划结束" : "Planning ends"}
                control={<SettingTextInput type="time" value={settings.dayEndTime || "22:00"} ariaLabel={lang === "zh" ? "规划结束" : "Planning ends"} onChange={(value) => onSave({ dayEndTime: value })} />}
              />
              <SettingRow
                anchor="schedule-buffer"
                title={lang === "zh" ? "任务缓冲" : "Task buffer"}
                description={lang === "zh" ? "自动排程在相邻任务间预留的时间。" : "Time reserved between adjacent automatically scheduled tasks."}
                control={<SettingNumberInput value={settings.scheduleBufferMinutes ?? 5} min={0} max={60} step={5} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "任务缓冲" : "Task buffer"} onChange={(value) => onSave({ scheduleBufferMinutes: Math.max(0, Math.min(60, value)) })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="templates" title={lang === "zh" ? "模板" : "Templates"} description={lang === "zh" ? "把可复用的时间段模板应用到今天。" : "Apply reusable time-block templates to today."}>
              <SettingRow
                title={lang === "zh" ? "启用模板功能" : "Enable templates"}
                description={lang === "zh" ? "关闭后隐藏今日候选顶栏的「模板」入口。" : "When off, the Templates button in the today-candidate header is hidden."}
                control={<SettingToggle checked={settings.featureTemplatesEnabled !== false} ariaLabel={lang === "zh" ? "启用模板功能" : "Enable templates"} onChange={(next) => onSave({ featureTemplatesEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "管理模板" : "Manage templates"}
                description={lang === "zh" ? "打开模板编辑弹窗，新建或编辑时间段模板。" : "Open the template editor to create or edit time-block templates."}
                control={<SettingActionButton onClick={() => onOpenScheduleTemplates?.()} disabled={!onOpenScheduleTemplates}>{lang === "zh" ? "打开模板" : "Open templates"}</SettingActionButton>}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="habits" title={lang === "zh" ? "习惯" : "Habits"} description={lang === "zh" ? "每日 / 每周重复行为的开关与显示。" : "Toggles and visibility for daily / weekly recurring behaviors."}>
              <SettingRow
                title={lang === "zh" ? "启用习惯功能" : "Enable habits"}
                description={lang === "zh" ? "关闭后隐藏今日候选中的习惯区与习惯入口。" : "When off, the habits area in today's candidates and habit entries are hidden."}
                control={<SettingToggle checked={settings.featureHabitsEnabled !== false} ariaLabel={lang === "zh" ? "启用习惯功能" : "Enable habits"} onChange={(next) => onSave({ featureHabitsEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "在今日候选中显示习惯区" : "Show habits in today's candidates"}
                description={lang === "zh" ? "关闭后仅隐藏今日候选中的习惯区，保留习惯功能和数据。" : "When off, only hides the habits area in today's candidates; habit features and data stay available."}
                control={<SettingToggle checked={settings.featureHabitCandidatesEnabled !== false} disabled={settings.featureHabitsEnabled === false} ariaLabel={lang === "zh" ? "在今日候选中显示习惯区" : "Show habits in today's candidates"} onChange={(next) => onSave({ featureHabitCandidatesEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "习惯是否计入指标" : "Include habits in metrics"}
                description={lang === "zh" ? "控制指标页是否统计习惯时间。" : "Control whether metrics include habit time."}
                control={<SettingSelect<NonNullable<Settings["metricsIncludeHabits"]>>
                  value={settings.metricsIncludeHabits || "include"}
                  ariaLabel={lang === "zh" ? "习惯是否计入指标" : "Include habits in metrics"}
                  onChange={(value) => onSave({ metricsIncludeHabits: value })}
                  options={[
                    { value: "include", label: lang === "zh" ? "计入" : "Include" },
                    { value: "exclude", label: lang === "zh" ? "排除" : "Exclude" },
                    { value: "only", label: lang === "zh" ? "仅习惯" : "Habits only" },
                  ]}
                />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="metrics" title={lang === "zh" ? "指标" : "Metrics"} description={lang === "zh" ? "规划页指标视图的默认范围与分组。" : "Default range and grouping for the planning-page metrics view."}>
              <SettingRow
                title={lang === "zh" ? "启用指标视图" : "Enable metrics view"}
                description={lang === "zh" ? "关闭后隐藏规划页的「指标」视图入口。" : "When off, the Metrics entry in the planning view switcher is hidden."}
                control={<SettingToggle checked={settings.featureMetricsEnabled !== false} ariaLabel={lang === "zh" ? "启用指标视图" : "Enable metrics view"} onChange={(next) => onSave({ featureMetricsEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "默认时间范围" : "Default time range"}
                control={<SettingSelect<NonNullable<Settings["metricsRangePreset"]>>
                  value={settings.metricsRangePreset || "today"}
                  ariaLabel={lang === "zh" ? "默认时间范围" : "Default time range"}
                  onChange={(value) => onSave({ metricsRangePreset: value })}
                  options={[
                    { value: "today", label: lang === "zh" ? "今天" : "Today" },
                    { value: "thisWeek", label: lang === "zh" ? "本周" : "This week" },
                    { value: "thisMonth", label: lang === "zh" ? "本月" : "This month" },
                    { value: "all", label: lang === "zh" ? "全部" : "All time" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "默认分组" : "Default grouping"}
                control={<SettingSelect<NonNullable<Settings["metricsGroupBy"]>>
                  value={settings.metricsGroupBy || "project"}
                  ariaLabel={lang === "zh" ? "默认分组" : "Default grouping"}
                  onChange={(value) => onSave({ metricsGroupBy: value })}
                  options={[
                    { value: "project", label: lang === "zh" ? "项目" : "Project" },
                    { value: "customCategory", label: lang === "zh" ? "自定义分类" : "Custom category" },
                    { value: "tag", label: lang === "zh" ? "标签" : "Tag" },
                    { value: "importance", label: lang === "zh" ? "重要程度" : "Importance" },
                    { value: "urgency", label: lang === "zh" ? "紧急程度" : "Urgency" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "默认显示指标" : "Default display metric"}
                control={<SettingSelect<NonNullable<Settings["metricsDisplayMetric"]>>
                  value={settings.metricsDisplayMetric || "percentage"}
                  ariaLabel={lang === "zh" ? "默认显示指标" : "Default display metric"}
                  onChange={(value) => onSave({ metricsDisplayMetric: value })}
                  options={[
                    { value: "percentage", label: lang === "zh" ? "占比" : "Percentage" },
                    { value: "duration", label: lang === "zh" ? "时长" : "Duration" },
                    { value: "taskCount", label: lang === "zh" ? "任务数" : "Task count" },
                    { value: "completionRate", label: lang === "zh" ? "完成率" : "Completion rate" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "习惯是否计入统计" : "Include habits in metrics"}
                control={<SettingSelect<NonNullable<Settings["metricsIncludeHabits"]>>
                  value={settings.metricsIncludeHabits || "include"}
                  ariaLabel={lang === "zh" ? "习惯是否计入统计" : "Include habits in metrics"}
                  onChange={(value) => onSave({ metricsIncludeHabits: value })}
                  options={[
                    { value: "include", label: lang === "zh" ? "计入" : "Include" },
                    { value: "exclude", label: lang === "zh" ? "排除" : "Exclude" },
                    { value: "only", label: lang === "zh" ? "仅习惯" : "Habits only" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "完成状态筛选" : "Completion filter"}
                control={<SettingSelect<NonNullable<Settings["metricsCompletionFilter"]>>
                  value={settings.metricsCompletionFilter || "all"}
                  ariaLabel={lang === "zh" ? "完成状态筛选" : "Completion filter"}
                  onChange={(value) => onSave({ metricsCompletionFilter: value })}
                  options={[
                    { value: "all", label: lang === "zh" ? "全部" : "All" },
                    { value: "completed", label: lang === "zh" ? "仅已完成" : "Completed only" },
                    { value: "incomplete", label: lang === "zh" ? "仅未完成" : "Incomplete only" },
                  ]}
                />}
              />
            </SettingSection>}

            {settingsTarget.category === "advanced" && !settingsTarget.detail && <SettingSection title={lang === "zh" ? "高级" : "Advanced"} description={lang === "zh" ? "仅在需要时进入对应详情；所有项目仍可通过搜索直接找到。" : "Open a detail only when needed; every setting remains directly searchable."}>
              {([
                ["ai", "Navo AI", lang === "zh" ? "模型、自动化行为与记忆" : "Models, automation behavior, and memory"],
                ["widget", lang === "zh" ? "桌面窗口" : "Desktop Windows", lang === "zh" ? "竖屏小窗、桌面小组件与计时" : "Portrait window, desktop widget, and timer"],
                ["integrations", lang === "zh" ? "日历与集成" : "Calendar & Integrations", lang === "zh" ? "日历订阅、扩展、工具与远程连接" : "Calendar subscriptions, extensions, tools, and remote connections"],
                ["recovery", lang === "zh" ? "恢复与重置" : "Recovery & Reset", lang === "zh" ? "恢复默认设置" : "Restore default settings"],
              ] as const).map(([detail, label, description]) => (
                <button key={detail} type="button" className="df-settings-detail-link" data-settings-detail={detail} onClick={() => navigateSettings({ category: "advanced", detail })}>
                  <span><strong>{label}</strong><small>{description}</small></span>
                  <i aria-hidden="true">→</i>
                </button>
              ))}
              <div className="df-settings-mobile-advanced-tail">
                <SettingRow
                  title={lang === "zh" ? "重新开始新手指南" : "Restart onboarding guide"}
                  description={lang === "zh" ? "重新触发首次使用引导流程。" : "Re-trigger the first-run onboarding flow."}
                  control={<SettingActionButton onClick={() => onSave({ onboardingVersion: 1, onboardingStep: "add" })}>{lang === "zh" ? "重新开始" : "Restart"}</SettingActionButton>}
                />
                <SettingRow
                  anchor="reset-settings-mobile"
                  title={lang === "zh" ? "重置所有设置" : "Reset all settings"}
                  description={lang === "zh" ? "恢复默认设置，不会删除任务和项目。" : "Restore defaults without deleting tasks or projects."}
                  control={<SettingActionButton tone="danger" onClick={() => setConfirmResetSettings(true)}>{lang === "zh" ? "重置…" : "Reset…"}</SettingActionButton>}
                />
              </div>
            </SettingSection>}

            {settingsTarget.category === "advanced" && settingsTarget.detail === "widget" && <SettingSection
              anchor="desktop-window-settings"
              title={lang === "zh" ? "桌面窗口" : "Desktop Windows"}
              description={Boolean(window.desktopApi?.widget || window.desktopApi?.compactWindow)
                ? (lang === "zh" ? "管理完整竖屏小窗与「正在做」小组件。" : "Manage the full portrait window and the current-task widget.")
                : (lang === "zh" ? "桌面端启用后可用。当前环境未检测到桌面端。" : "Available on the desktop build. No desktop runtime detected in this environment.")}
            >
              <SettingRow
                anchor="portrait-window"
                title={lang === "zh" ? "竖屏小窗" : "Portrait window"}
                description={lang === "zh" ? "在独立窗口中打开完整应用的竖屏布局，不影响「正在做」小组件。" : "Open the complete app in an independent portrait layout without affecting the current-task widget."}
                control={<><SettingActionButton disabled={!Boolean(window.desktopApi?.compactWindow)} onClick={() => { void window.desktopApi?.compactWindow?.open({ alwaysOnTop: settings.compactWindowAlwaysOnTop !== false }); }}>{lang === "zh" ? "打开" : "Open"}</SettingActionButton><SettingActionButton disabled={!Boolean(window.desktopApi?.compactWindow)} onClick={() => { void window.desktopApi?.compactWindow?.close(); }}>{lang === "zh" ? "关闭" : "Close"}</SettingActionButton></>}
              />
              <SettingRow
                title={lang === "zh" ? "竖屏小窗置顶" : "Portrait window always on top"}
                control={<SettingToggle checked={settings.compactWindowAlwaysOnTop !== false} disabled={!Boolean(window.desktopApi?.compactWindow)} ariaLabel={lang === "zh" ? "竖屏小窗置顶" : "Portrait window always on top"} onChange={(next) => { onSave({ compactWindowAlwaysOnTop: next }); void window.desktopApi?.compactWindow?.setAlwaysOnTop(next); }} />}
              />
              <SettingDivider />
              <SettingRow
                anchor="desktop-widget"
                title={lang === "zh" ? "启用桌面小组件" : "Enable desktop widget"}
                description={lang === "zh" ? "置顶小窗快速查看正在做与计时。" : "Always-on-top mini panel for the current task and timer."}
                control={<SettingToggle checked={settings.featureWidgetEnabled !== false} disabled={!Boolean(window.desktopApi?.widget)} ariaLabel={lang === "zh" ? "启用桌面小组件" : "Enable desktop widget"} onChange={(next) => onSave({ featureWidgetEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "启动时自动打开" : "Open widget on launch"}
                control={<SettingToggle checked={settings.widgetOpenOnLaunch === true} disabled={!Boolean(window.desktopApi?.widget)} ariaLabel={lang === "zh" ? "启动时自动打开" : "Open widget on launch"} onChange={(next) => onSave({ widgetOpenOnLaunch: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "始终置顶" : "Always on top"}
                control={<SettingToggle checked={settings.widgetAlwaysOnTop !== false} disabled={!Boolean(window.desktopApi?.widget)} ariaLabel={lang === "zh" ? "始终置顶" : "Always on top"} onChange={(next) => { onSave({ widgetAlwaysOnTop: next }); void window.desktopApi?.widget?.setAlwaysOnTop(next); }} />}
              />
              <SettingRow
                title={lang === "zh" ? "背景透明度" : "Background opacity"}
                description={lang === "zh" ? "只调整纸面背景，文字和计时始终清晰显示。" : "Adjusts only the paper background; text and timer remain visible."}
                control={<SettingNumberInput value={Math.round(widgetAppearance.opacity * 100)} min={0} max={100} step={1} suffix="%" ariaLabel={lang === "zh" ? "小组件背景透明度" : "Widget background opacity"} onChange={(value) => saveWidgetAppearance({ opacity: value / 100 })} />}
              />
              <SettingDivider />
              <SettingRow
                anchor="widget-font"
                title={lang === "zh" ? "字体" : "Font family"}
                control={<SettingSelect value={widgetAppearance.fontFamily} ariaLabel={lang === "zh" ? "小组件字体" : "Widget font family"} onChange={(fontFamily) => saveWidgetAppearance({ fontFamily })} options={[
                  { value: "system-ui, sans-serif", label: lang === "zh" ? "系统字体" : "System" },
                  { value: "Inter, system-ui, sans-serif", label: "Inter" },
                  { value: "Georgia, serif", label: lang === "zh" ? "衬线字体" : "Serif" },
                  { value: "ui-monospace, monospace", label: lang === "zh" ? "等宽字体" : "Monospace" },
                ]} />}
              />
              <SettingRow
                title={lang === "zh" ? "字号比例" : "Font scale"}
                control={<SettingNumberInput value={widgetAppearance.fontScale} min={0.5} max={2} step={0.05} suffix="×" ariaLabel={lang === "zh" ? "小组件字号比例" : "Widget font scale"} onChange={(fontScale) => saveWidgetAppearance({ fontScale })} />}
              />
              <SettingDivider />
              <div className="df-settings-subtabs" role="tablist" aria-label={lang === "zh" ? "小组件外观主题" : "Widget appearance theme"}>
                {(["light", "dark"] as const).map((theme) => <button key={theme} type="button" role="tab" aria-selected={widgetThemeOpen === theme} className={widgetThemeOpen === theme ? "active" : ""} onClick={() => setWidgetThemeOpen(theme)}>{theme === "light" ? (lang === "zh" ? "浅色" : "Light") : (lang === "zh" ? "深色" : "Dark")}</button>)}
              </div>
              {(() => {
                const theme = widgetThemeOpen;
                const themeName = theme === "light" ? (lang === "zh" ? "浅色" : "Light") : (lang === "zh" ? "深色" : "Dark");
                const colors = widgetAppearance[theme];
                return <div className="df-settings-theme-fields" data-settings-anchor={theme === "light" ? "widget-light" : "widget-dark"} tabIndex={-1}>
                  <SettingRow anchor={`widget-${theme}-background`} title={lang === "zh" ? `${themeName}背景` : `${themeName} background`} control={<SettingColorInput value={colors.backgroundColor} ariaLabel={lang === "zh" ? `${themeName}背景颜色` : `${themeName} background color`} onChange={(backgroundColor) => saveWidgetThemeColor(theme, { backgroundColor })} />} />
                  <SettingRow anchor={`widget-${theme}-text`} title={lang === "zh" ? `${themeName}文字` : `${themeName} text`} control={<SettingColorInput value={colors.fontColor} ariaLabel={lang === "zh" ? `${themeName}文字颜色` : `${themeName} text color`} onChange={(fontColor) => saveWidgetThemeColor(theme, { fontColor })} />} />
                  <SettingRow anchor={`widget-${theme}-timer`} title={lang === "zh" ? `${themeName}计时` : `${themeName} timer`} control={<SettingColorInput value={colors.timerColor} ariaLabel={lang === "zh" ? `${themeName}计时颜色` : `${themeName} timer color`} onChange={(timerColor) => saveWidgetThemeColor(theme, { timerColor })} />} />
                  <SettingRow anchor={`widget-${theme}-overrun`} title={lang === "zh" ? `${themeName}超时` : `${themeName} overrun`} control={<SettingColorInput value={colors.overrunColor} ariaLabel={lang === "zh" ? `${themeName}超时颜色` : `${themeName} overrun color`} onChange={(overrunColor) => saveWidgetThemeColor(theme, { overrunColor })} />} />
                </div>;
              })()}
              <SettingDivider />
              <SettingRow
                anchor="widget-timer"
                title={lang === "zh" ? "计时模式" : "Timer mode"}
                control={<SettingSelect value={widgetTimerDraft.mode} ariaLabel={lang === "zh" ? "小组件计时模式" : "Widget timer mode"} onChange={(mode) => updateWidgetTimerDraft({ mode })} options={[
                  { value: "stopwatch", label: lang === "zh" ? "正计时" : "Stopwatch" },
                  { value: "pomodoro", label: lang === "zh" ? "番茄钟" : "Pomodoro" },
                  { value: "countdown", label: lang === "zh" ? "倒计时" : "Countdown" },
                ]} />}
              />
              {widgetTimerDraft.mode === "pomodoro" && <>
                <SettingRow title={lang === "zh" ? "专注时长" : "Focus duration"} control={<SettingNumberInput value={widgetTimerDraft.focusMinutes} min={1} max={180} step={1} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "番茄钟专注时长" : "Pomodoro focus duration"} onChange={(focusMinutes) => updateWidgetTimerDraft({ focusMinutes })} />} />
                <SettingRow title={lang === "zh" ? "休息时长" : "Break duration"} control={<SettingNumberInput value={widgetTimerDraft.breakMinutes} min={1} max={60} step={1} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "番茄钟休息时长" : "Pomodoro break duration"} onChange={(breakMinutes) => updateWidgetTimerDraft({ breakMinutes })} />} />
                <SettingRow title={lang === "zh" ? "循环轮数" : "Pomodoro rounds"} control={<SettingNumberInput value={widgetTimerDraft.rounds} min={1} max={12} step={1} ariaLabel={lang === "zh" ? "番茄钟循环轮数" : "Pomodoro rounds"} onChange={(rounds) => updateWidgetTimerDraft({ rounds })} />} />
              </>}
              {widgetTimerDraft.mode === "countdown" && <SettingRow title={lang === "zh" ? "倒计时时长" : "Countdown duration"} control={<SettingNumberInput value={Math.round(widgetTimerDraft.countdownSeconds / 60)} min={1} max={1440} step={1} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "倒计时时长" : "Countdown duration"} onChange={(minutes) => updateWidgetTimerDraft({ countdownSeconds: minutes * 60 })} />} />}
              {widgetTimerDraft.mode === "stopwatch" && <SettingDescription>{lang === "zh" ? "正计时无需设置时长。" : "Stopwatch mode has no duration settings."}</SettingDescription>}
              <SettingRow
                title={lang === "zh" ? "计时器操作" : "Timer actions"}
                control={<><SettingActionButton onClick={() => setWidgetTimerDraft(widgetTimerSettings)}>{lang === "zh" ? "取消" : "Cancel"}</SettingActionButton><SettingActionButton onClick={() => onWidgetAction({ type: "resetWidgetTimer", draft: widgetTimerDraft })}>{lang === "zh" ? "重置计时器" : "Reset timer"}</SettingActionButton><SettingActionButton onClick={() => onWidgetAction({ type: "saveTimerSettings", draft: widgetTimerDraft })}>{lang === "zh" ? "保存" : "Save"}</SettingActionButton></>}
              />
              <SettingDivider />
              <SettingRow
                anchor="widget-reset"
                title={lang === "zh" ? "恢复默认外观" : "Restore default appearance"}
                control={<SettingActionButton onClick={() => onSave({ widgetAppearance: structuredClone(DEFAULT_WIDGET_APPEARANCE), widgetAppearanceMigrated: true })}>{lang === "zh" ? "恢复" : "Restore"}</SettingActionButton>}
              />
              <SettingRow
                title={lang === "zh" ? "重置位置与尺寸" : "Reset position and size"}
                description={lang === "zh" ? "恢复为 400 × 80，并放回屏幕内的默认位置。" : "Restore 400 × 80 and return the widget to its default on-screen position."}
                control={<SettingActionButton disabled={!Boolean(window.desktopApi?.widget)} onClick={() => { void window.desktopApi?.widget?.setBounds({ x: 80, y: 80, width: 400, height: 80 }); }}>{lang === "zh" ? "重置" : "Reset"}</SettingActionButton>}
              />
            </SettingSection>}
            {settingsTarget.category === "general" && <SettingSection anchor="general-help" title={lang === "zh" ? "帮助" : "Help"}>
              <SettingRow
                anchor="restart-onboarding"
                title={lang === "zh" ? "重新开始新手指南" : "Restart onboarding guide"}
                description={lang === "zh" ? "重新触发首次使用引导流程。" : "Re-trigger the first-run onboarding flow."}
                control={<SettingActionButton onClick={() => onSave({ onboardingVersion: 1, onboardingStep: "add" })}>{lang === "zh" ? "重新开始" : "Restart"}</SettingActionButton>}
              />
              <div className="df-settings-disclosure" data-settings-anchor="shortcuts" tabIndex={-1}>
                <button
                  type="button"
                  className="df-settings-disclosure-toggle"
                  aria-expanded={shortcutsOpen}
                  onClick={() => setShortcutsOpen((open) => !open)}
                >
                  <span><strong>{lang === "zh" ? "快捷键参考" : "Shortcut reference"}</strong><small>{lang === "zh" ? "查看固定快捷键" : "View fixed shortcuts"}</small></span>
                  <span aria-hidden="true">{shortcutsOpen ? "−" : "+"}</span>
                </button>
                {shortcutsOpen && <div className="df-settings-disclosure-body">
                  <p className="df-settings-desc">{lang === "zh" ? "本版本暂不支持自定义快捷键。" : "Custom shortcuts are not enabled in this version."}</p>
                  <div className="df-shortcut-reference">
                    {shortcutGroups.map((group) => (
                      <section key={group.scope} className="df-shortcut-group">
                        <h4>{shortcutScopeLabel(group.scope)}</h4>
                        <div className="df-shortcut-list">
                          {group.shortcuts.map((shortcut) => (
                            <div key={shortcut.id} className="df-shortcut-row">
                              <span>{lang === "zh" ? shortcut.labelZh : shortcut.labelEn}</span>
                              <kbd>{shortcut.keys.join(" / ")}</kbd>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>}
              </div>
            </SettingSection>}
            {settingsTarget.category === "advanced" && settingsTarget.detail === "ai" && <SettingSection title="Navo AI" description={lang === "zh" ? "模型由服务端网关自动路由；本地估时、分类与排程在 AI 不可用时仍可工作。" : "Models are routed by the server gateway; local estimation, classification, and scheduling still work when AI is unavailable."}>
              <SettingRow anchor="ai-model" title={lang === "zh" ? "高级模型偏好" : "Advanced model preference"} control={<SettingSelect value={settings.model} ariaLabel={lang === "zh" ? "高级模型偏好" : "Advanced model preference"} onChange={(model) => onSave({ model, reasoningMode: "instant" })} options={FALLBACK_AI_MODELS.map((model) => ({ value: model, label: model.split("/").pop() || model }))} />} />
              <SettingRow anchor="ai-reasoning" title={lang === "zh" ? "思考模式" : "Reasoning mode"} control={<SettingSelect value={settings.reasoningMode || "instant"} ariaLabel={lang === "zh" ? "思考模式" : "Reasoning mode"} onChange={(value) => onSave({ reasoningMode: value as Settings["reasoningMode"] })} options={[
                { value: "instant", label: lang === "zh" ? "即时" : "Instant" },
                ...reasoningModesForModel(settings.model).filter((mode) => mode === "high" || mode === "xhigh").map((mode) => ({ value: mode, label: mode === "xhigh" ? "Xhigh" : "High" })),
              ]} />} />
              <SettingRow anchor="ai-estimate" title={lang === "zh" ? "自动估算任务用时" : "Estimate task duration"} control={<SettingToggle checked={settings.autoEstimateTaskDuration !== false} ariaLabel={lang === "zh" ? "自动估算任务用时" : "Estimate task duration"} onChange={(next) => onSave({ autoEstimateTaskDuration: next })} />} />
              <SettingRow anchor="ai-project" title={lang === "zh" ? "自动归入项目" : "Auto-assign project"} description={lang === "zh" ? "仅在判断置信度较高时归入已有项目。" : "Assign to an existing project only at high confidence."} control={<SettingToggle checked={settings.autoAssignTaskProject !== false} ariaLabel={lang === "zh" ? "自动归入项目" : "Auto-assign project"} onChange={(next) => onSave({ autoAssignTaskProject: next })} />} />
              <SettingRow anchor="ai-briefs" title={lang === "zh" ? "每日开工与收工简报" : "Daily start and end briefs"} description={cloudReady ? (lang === "zh" ? "应用运行时跨过时间点生成；当天错过后会在下次打开时补生成一次。简报只读。" : "Generated when the running app crosses each time; a missed brief is generated on the next open that day. Briefs are read-only.") : (lang === "zh" ? "登录云端账号后可启用。" : "Sign in to a cloud account to enable briefs.")} control={<SettingToggle checked={Boolean(settings.aiBriefsEnabled)} disabled={!cloudReady} ariaLabel={lang === "zh" ? "每日 AI 简报" : "Daily AI briefs"} onChange={(next) => onSave({ aiBriefsEnabled: next })} />} />
              <SettingRow title={lang === "zh" ? "开工时间" : "Start brief time"} control={<SettingTextInput type="time" value={settings.aiStartBriefTime || "08:00"} disabled={!settings.aiBriefsEnabled || !cloudReady} ariaLabel={lang === "zh" ? "开工简报时间" : "Start brief time"} onChange={(value) => onSave({ aiStartBriefTime: value })} />} />
              <SettingRow title={lang === "zh" ? "收工时间" : "End review time"} control={<SettingTextInput type="time" value={settings.aiEndBriefTime || "21:30"} disabled={!settings.aiBriefsEnabled || !cloudReady} ariaLabel={lang === "zh" ? "收工复盘时间" : "End review time"} onChange={(value) => onSave({ aiEndBriefTime: value })} />} />
              <SettingRow anchor="ai-memory" title={t(lang, "settings.allowAiContext")} description={lang === "zh" ? "启用后，下方才显示可参与上下文的记忆。" : "When enabled, memories available to context appear below."} control={<SettingToggle checked={Boolean(settings.aiMemoryEnabled)} ariaLabel={t(lang, "settings.allowAiContext")} onChange={(next) => onSave({ aiMemoryEnabled: next })} />} />
              <SettingRow anchor="hide-ai" title={t(lang, "settings.hideAllAi")} control={<SettingToggle checked={Boolean(settings.hideAi)} ariaLabel={t(lang, "settings.hideAllAi")} onChange={(next) => onSave({ hideAi: next })} />} />
              <SettingRow
                anchor="ai-reset"
                title={lang === "zh" ? "AI 数据操作" : "AI data actions"}
                description={lang === "zh" ? "重置个性化不会删除任务；清空对话只移除对话历史。" : "Resetting personalization keeps tasks; clearing conversations removes chat history only."}
                control={<><SettingActionButton onClick={() => { const now = new Date().toISOString(); onSaveData({ ...data, aiProfile: { version: 1, updatedAt: now, historySince: now, durationByProject: {}, projectTokenWeights: {}, preferredStartHourByProject: {}, feedback: { durationCorrections: 0, projectCorrections: 0, assignmentUndos: 0, scheduleAccepts: 0, scheduleRejects: 0 } } }); }}>{lang === "zh" ? "重置个性化" : "Reset personalization"}</SettingActionButton><SettingActionButton disabled={(data.chat || []).length === 0} onClick={onClearChatHistory}>{lang === "zh" ? "清空对话" : "Clear conversations"}</SettingActionButton></>}
              />
              {Boolean(settings.aiMemoryEnabled) && <section className="df-ai-memory-settings" data-settings-anchor="ai-memory-list" tabIndex={-1}>
                <div className="df-ai-memory-settings-head">
                  <div><strong>{lang === "zh" ? "AI 记忆" : "AI memory"}</strong><small>{lang === "zh" ? `${visibleMemories.length} 条会参与上下文` : `${visibleMemories.length} available to context`}</small></div>
                  <button onClick={addManualMemory}>{lang === "zh" ? "新增" : "Add"}</button>
                </div>
                <div className="df-ai-memory-list">
                  {visibleMemories.length === 0 && <p className="df-ai-memory-empty">{lang === "zh" ? "还没有保存的记忆。可在这里新增，或从 AI 对话保存。" : "No saved memories yet. Add one here or save one from an AI conversation."}</p>}
                  {visibleMemories.map((memory) => (
                    <article key={memory.id} className={`df-ai-memory-item ${memory.pinned ? "pinned" : ""}`}>
                      <textarea value={memory.content} onChange={(event) => saveMemory(memory.id, { content: event.target.value })} />
                      <input value={(memory.tags || []).join(", ")} onChange={(event) => saveMemory(memory.id, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder="tags" />
                      {memory.sourceMessages && memory.sourceMessages.length > 0 && <small>{lang === "zh" ? `保存自 ${memory.sourceMessages.length} 条对话原文` : `Saved from ${memory.sourceMessages.length} messages`}</small>}
                      <div className="df-ai-memory-actions">
                        <span>{memory.source || "auto"}</span>
                        <button onClick={() => saveMemory(memory.id, { pinned: !memory.pinned })}>{memory.pinned ? (lang === "zh" ? "取消置顶" : "Unpin") : (lang === "zh" ? "置顶" : "Pin")}</button>
                        <button className="danger-lite" onClick={() => saveMemory(memory.id, { archived: true })}>{lang === "zh" ? "删除" : "Delete"}</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>}
            </SettingSection>}
            {settingsTarget.category === "advanced" && settingsTarget.detail === "integrations" && <div className="df-settings-subtabs df-settings-integration-tabs" role="tablist" aria-label={lang === "zh" ? "日历与集成" : "Calendar and integrations"}>
              <button type="button" role="tab" aria-selected={integrationTab === "calendar"} className={integrationTab === "calendar" ? "active" : ""} onClick={() => { setIntegrationTab("calendar"); setSettingsTarget({ category: "advanced", detail: "integrations", anchor: "calendar-feed" }); }}>{lang === "zh" ? "日历订阅" : "Calendar"}</button>
              <button type="button" role="tab" aria-selected={integrationTab === "external-calendar"} className={integrationTab === "external-calendar" ? "active" : ""} onClick={() => { setIntegrationTab("external-calendar"); setSettingsTarget({ category: "advanced", detail: "integrations", anchor: "external-calendar" }); }}>{lang === "zh" ? "外部日历" : "External"}</button>
              <button type="button" role="tab" aria-selected={integrationTab === "plugins"} className={integrationTab === "plugins" ? "active" : ""} onClick={() => { setIntegrationTab("plugins"); setSettingsTarget({ category: "advanced", detail: "integrations", anchor: "plugins" }); }}>{lang === "zh" ? "插件" : "Plugins"}</button>
              <button type="button" role="tab" aria-selected={integrationTab === "mcp"} className={integrationTab === "mcp" ? "active" : ""} onClick={() => { setIntegrationTab("mcp"); setSettingsTarget({ category: "advanced", detail: "integrations", anchor: "mcp" }); }}>MCP</button>
            </div>}
            {settingsTarget.category === "advanced" && settingsTarget.detail === "integrations" && integrationTab === "calendar" && <section className="df-settings-group" data-settings-anchor="calendar-feed" tabIndex={-1}><h3>{lang === "zh" ? "日历订阅" : "Calendar Subscription"}</h3><CalendarFeedManager lang={lang} /></section>}
            {settingsTarget.category === "advanced" && settingsTarget.detail === "integrations" && integrationTab === "external-calendar" && <section className="df-settings-group" data-settings-anchor="external-calendar" tabIndex={-1}><h3>{lang === "zh" ? "外部日历" : "External Calendars"}</h3><ExternalCalendarManager lang={lang} /></section>}
            {settingsTarget.category === "advanced" && settingsTarget.detail === "integrations" && integrationTab === "mcp" && <section className="df-settings-group" data-settings-anchor="mcp" tabIndex={-1}><h3>MCP</h3><McpTokenManager lang={lang} /></section>}
            {settingsTarget.category === "advanced" && settingsTarget.detail === "integrations" && integrationTab === "plugins" && <section className="df-settings-group" data-settings-anchor="plugins" tabIndex={-1}>
              <h3>{lang === "zh" ? "插件" : "Plugins"}</h3>
              <p className="df-settings-desc">{lang === "zh" ? "这里会显示随应用发布的内置插件，以及桌面端用户插件目录中经过校验的本地 manifest。本地插件可保存配置，但不会加载或执行 index.js 等目录脚本。" : "This list includes built-in plugins shipped with the app and validated local manifests from the desktop plugin directory. Local plugin configuration can be stored, but directory scripts such as index.js are not loaded or executed."}</p>

              <div className="df-settings-divider" />
              <div className="df-settings-subhead">{lang === "zh" ? "可用插件" : "Available plugins"}</div>

              <div className="df-plugin-list">
                {listRegisteredPlugins().map((plugin) => {
                  const enabled = Boolean(settings?.enabledPlugins?.includes(plugin.id));
                  const active = isPluginActive(plugin.id);
                  const externalManifest = plugin.source === "external";
                  return (
                    <div key={plugin.id} className={`df-plugin-card ${enabled ? "installed" : ""}`}>
                      <div className="df-plugin-icon">{plugin.icon}</div>
                      <div className="df-plugin-info">
                        <div className="df-plugin-header">
                          <strong className="df-plugin-name">{localizedPluginName(plugin, lang)}</strong>
                          <span className="df-plugin-version">v{plugin.version}</span>
                        </div>
                        <p className="df-plugin-desc">{localizedPluginDescription(plugin, lang)}</p>
                        <p className="df-plugin-enabled-summary">{localizedPluginEnabledSummary(plugin, lang)}</p>
                        <div className="df-plugin-meta">
                          <span className="df-plugin-author">{plugin.author}</span>
                          <span>{externalManifest ? (lang === "zh" ? "声明权限" : "Declared permissions") : (lang === "zh" ? "权限" : "Permissions")}: {plugin.permissions.join(", ")}</span>
                          {enabled && (
                            <span className="df-plugin-status">
                              {externalManifest
                                ? (lang === "zh" ? "配置已启用" : "Configuration enabled")
                                : active
                                  ? (lang === "zh" ? "运行中" : "Running")
                                  : (lang === "zh" ? "已启用，等待刷新" : "Enabled, refreshing")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="df-plugin-actions">
                        {enabled ? (
                          <>
                            <button
                              type="button"
                              className="df-plugin-config"
                              onClick={() => openPluginConfig(plugin.id)}
                            >
                              {lang === "zh" ? "配置" : "Configure"}
                            </button>
                            <button
                              type="button"
                              className="df-plugin-uninstall"
                              onClick={() => togglePlugin(plugin.id)}
                            >
                              {lang === "zh" ? "停用" : "Disable"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="df-plugin-install"
                            onClick={() => togglePlugin(plugin.id)}
                          >
                            {lang === "zh" ? "启用" : "Enable"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="df-settings-divider" />
              <a className="df-plugin-doc-link" href="/plugin-guide">
                <span>{lang === "zh" ? "打开 Plugins / MCP 使用教程" : "Open Plugins / MCP guide"}</span>
                <small>{lang === "zh" ? "查看内置插件、本地插件、MCP 配置和安全边界" : "Read built-in plugins, local plugins, MCP setup, and security boundaries"}</small>
                <i aria-hidden="true">↗</i>
              </a>
              <div className="df-settings-divider" />
              <div className="df-settings-subhead">{lang === "zh" ? "已启用工具" : "Enabled tools"}</div>
              <PluginRuntimePanel settings={settings} data={data} onSave={onSave} onSaveData={onSaveData} lang={lang} />
            </section>}
            {settingsTarget.category === "account-data" && <SettingSection
              anchor="data-backup"
              title={lang === "zh" ? "数据与备份" : "Data & Backup"}
              description={lang === "zh" ? "导出、导入与本地数据清理。导入会覆盖当前数据，请谨慎操作。" : "Export, import, and local-data cleanup. Importing overwrites current data — proceed with care."}
            >
              <SettingRow
                title={lang === "zh" ? "导出为 JSON" : "Export as JSON"}
                description={lang === "zh" ? "包含任务、项目、习惯、时间记录与设置的完整备份。" : "Full backup including tasks, projects, habits, time entries, and settings."}
                control={<SettingActionButton onClick={() => exportDataAsJson(data, settings)}>{lang === "zh" ? "导出" : "Export"}</SettingActionButton>}
              />
              <SettingRow
                title={lang === "zh" ? "导出任务为 CSV" : "Export tasks as CSV"}
                description={lang === "zh" ? "仅导出任务列表，便于表格工具查看。" : "Export the task list only, for use in spreadsheet tools."}
                control={<SettingActionButton onClick={() => exportTasksAsCsv(data)}>{lang === "zh" ? "导出 CSV" : "Export CSV"}</SettingActionButton>}
              />
              <SettingDivider />
              <SettingRow
                title={lang === "zh" ? "导入 JSON（完整数据）" : "Import JSON (full data)"}
                description={lang === "zh" ? "覆盖当前所有数据与设置。" : "Overwrites all current data and settings."}
                control={<SettingActionButton onClick={() => {
                  if (confirm(lang === "zh" ? "导入 JSON 将覆盖当前所有数据，确定要继续吗？" : "Importing JSON will overwrite all current data. Are you sure you want to continue?")) {
                    importDataFromJson();
                  }
                }}>{lang === "zh" ? "导入" : "Import"}</SettingActionButton>}
              />
              <SettingRow
                title={lang === "zh" ? "导入任务 CSV" : "Import tasks CSV"}
                description={lang === "zh" ? "把 CSV 中的任务合并到当前数据。" : "Merge tasks from a CSV file into the current data."}
                control={<SettingActionButton onClick={() => importTasksFromCsv()}>{lang === "zh" ? "导入 CSV" : "Import CSV"}</SettingActionButton>}
              />
              <SettingSection title={lang === "zh" ? "危险操作" : "Danger zone"} tone="danger">
                <SettingRow
                  anchor="clear-local-data"
                  title={lang === "zh" ? "清空本地数据" : "Clear local data"}
                  description={lang === "zh" ? "删除当前浏览器 / 桌面端的所有本地数据（任务、项目、习惯、时间记录、设置）。云端数据不受影响。" : "Removes all local data on this browser / desktop build (tasks, projects, habits, time entries, settings). Cloud data is unaffected."}
                  control={<SettingActionButton tone="danger" onClick={() => setConfirmClearLocalData(true)}>{lang === "zh" ? "清空…" : "Clear…"}</SettingActionButton>}
                />
              </SettingSection>
            </SettingSection>}

            {settingsTarget.category === "account-data" && <section className="df-settings-group" data-settings-anchor="account" tabIndex={-1}><h3>{lang === "zh" ? "账户" : "Account"}</h3>
              <section className="df-settings-profile">
                <label className="df-settings-avatar" title={lang === "zh" ? "上传头像" : "Upload avatar"}>{settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" /> : <span>N</span>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
                <div><input className="df-settings-name-input" value={settings.displayName || ""} placeholder={t(lang, "settings.usernamePlaceholder")} maxLength={64} onChange={(event) => onSave({ displayName: event.target.value })} /></div>
              </section>
              <SubscriptionPanel lang={lang} />
              {authEmail && <p className="df-settings-account">{authEmail}</p>}
              <div data-settings-anchor="sync" tabIndex={-1}><SyncSettingsControl
                  settings={settings}
                  lang={lang}
                  cloudReady={Boolean(cloudReady)}
                  isManualSyncing={Boolean(isManualSyncing)}
                  onChange={(patch) => onSave(patch)}
                  onSyncNow={onSyncNow}
                /></div>
              <div data-settings-anchor="updates" tabIndex={-1}><DesktopUpdateControl lang={lang} /></div>
              <div data-settings-anchor="auto-launch" tabIndex={-1}><AutoLaunchToggle lang={lang} /></div>
              <div data-settings-anchor="delete-account" tabIndex={-1}><AccountMoreSection lang={lang} onShowAbout={onShowAbout} onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} /></div>
            </section>}

            {settingsTarget.category === "advanced" && settingsTarget.detail === "recovery" && <SettingSection
              title={lang === "zh" ? "高级" : "Advanced"}
              description={lang === "zh" ? "调试、实验与恢复选项。修改前请确认你了解影响范围。" : "Debug, experimental, and recovery options. Only change these if you understand the impact."}
            >
              <SettingSection title={lang === "zh" ? "危险操作" : "Danger zone"} tone="danger">
                <SettingRow
                  anchor="reset-settings"
                  title={lang === "zh" ? "重置所有设置" : "Reset all settings"}
                  description={lang === "zh" ? "把所有设置项恢复为默认值。任务、项目、习惯、时间记录等数据不会删除。" : "Restore every setting to its default. Tasks, projects, habits, and time entries are not affected."}
                  control={<SettingActionButton tone="danger" onClick={() => setConfirmResetSettings(true)}>{lang === "zh" ? "重置…" : "Reset…"}</SettingActionButton>}
                />
              </SettingSection>
            </SettingSection>}
            </div>
          </div>
        ) : (
          <div className="df-utility-body">
            <strong>{t(lang, "settings.version")}</strong>
            <p>{t(lang, "settings.aboutDesc")}</p>
            <small>{t(lang, "settings.lastUpdated")}</small>
            <DesktopUpdateControl lang={lang} />
            <a className="df-settings-row" href="/changelog">
              <strong>{lang === "zh" ? "查看更新日志" : "View changelog"}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </aside>
      {pluginConfigDialogId && (() => {
        const plugin = listRegisteredPlugins().find((p) => p.id === pluginConfigDialogId);
        if (!plugin) return null;
        return createPortal(
          <div className="df-dialog-overlay" role="presentation" onMouseDown={() => { setPluginConfigDialogId(null); }}>
            <section
              className="df-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="df-plugin-config-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form onSubmit={(event) => { event.preventDefault(); commitPluginConfig(); }}>
                <h2 id="df-plugin-config-title">{plugin.icon} {localizedPluginName(plugin, lang)}</h2>
                <p className="df-settings-desc">{localizedPluginDescription(plugin, lang)}</p>
                <div className="df-plugin-config-fields">
                  {plugin.configFields.map((field) => {
                    const value = pluginConfigDraft[field.key];
                    if (field.type === "boolean") {
                      return (
                        <label key={field.key} className="df-utility-check">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(event) => savePluginConfigField(field.key, event.target.checked)}
                          />
                          {pluginText(field.label, field.labelI18n, lang)}
                        </label>
                      );
                    }
                    if (field.type === "select") {
                      return (
                        <label key={field.key} className="df-plugin-config-field">
                          <span>{pluginText(field.label, field.labelI18n, lang)}</span>
                          <select value={String(value ?? "")} onChange={(event) => savePluginConfigField(field.key, event.target.value)}>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{pluginText(opt.label, opt.labelI18n, lang)}</option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    if (field.type === "number") {
                      return (
                        <label key={field.key} className="df-plugin-config-field">
                          <span>{pluginText(field.label, field.labelI18n, lang)}</span>
                          <input
                            type="number"
                            value={Number(value ?? 0)}
                            min={field.min}
                            max={field.max}
                            onChange={(event) => savePluginConfigField(field.key, Number(event.target.value))}
                          />
                        </label>
                      );
                    }
                    return (
                      <label key={field.key} className="df-plugin-config-field">
                        <span>{pluginText(field.label, field.labelI18n, lang)}</span>
                        <textarea
                          rows={3}
                          maxLength={MAX_PLUGIN_CONFIG_STRING_LENGTH}
                          value={String(value ?? "")}
                          onChange={(event) => savePluginConfigField(field.key, event.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="df-dialog-actions">
                  <button type="button" className="df-dialog-secondary" onClick={() => { setPluginConfigDialogId(null); }}>
                    {lang === "zh" ? "取消" : "Cancel"}
                  </button>
                  <button type="submit" className="df-dialog-primary">
                    {lang === "zh" ? "保存" : "Save"}
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        );
      })()}
      {confirmResetSettings && createPortal(
        <div className="df-dialog-overlay" role="presentation" onMouseDown={() => setConfirmResetSettings(false)}>
          <section className="df-dialog" role="dialog" aria-modal="true" aria-labelledby="df-reset-settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="df-reset-settings-title">{lang === "zh" ? "重置所有设置" : "Reset all settings"}</h2>
            <p className="df-settings-desc">{lang === "zh" ? "这将把所有设置项恢复为默认值。任务、项目、习惯、时间记录等数据不会删除。此操作无法撤销。" : "This restores every setting to its default. Tasks, projects, habits, and time entries are not affected. This cannot be undone."}</p>
            <div className="df-dialog-actions">
              <button type="button" className="df-dialog-secondary" onClick={() => setConfirmResetSettings(false)}>{lang === "zh" ? "取消" : "Cancel"}</button>
              <button type="button" className="df-dialog-danger" onClick={() => { onSave(getDefaultSettings()); setConfirmResetSettings(false); }}>{lang === "zh" ? "重置" : "Reset"}</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
      {confirmClearLocalData && createPortal(
        <div className="df-dialog-overlay" role="presentation" onMouseDown={() => setConfirmClearLocalData(false)}>
          <section className="df-dialog" role="dialog" aria-modal="true" aria-labelledby="df-clear-local-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="df-clear-local-title">{lang === "zh" ? "清空本地数据" : "Clear local data"}</h2>
            <p className="df-settings-desc">{lang === "zh" ? "这将删除当前浏览器 / 桌面端的所有本地数据（任务、项目、习惯、时间记录、设置）。云端数据不受影响。此操作无法撤销。" : "This removes all local data on this browser / desktop build (tasks, projects, habits, time entries, settings). Cloud data is unaffected. This cannot be undone."}</p>
            <label className="df-utility-confirm-phrase">
              <span>{lang === "zh" ? "请输入 DELETE 以确认" : "Type DELETE to confirm"}</span>
              <input type="text" value={clearLocalDataPhrase} onChange={(event) => setClearLocalDataPhrase(event.target.value)} placeholder="DELETE" />
            </label>
            <div className="df-dialog-actions">
              <button type="button" className="df-dialog-secondary" onClick={() => { setConfirmClearLocalData(false); setClearLocalDataPhrase(""); }}>{lang === "zh" ? "取消" : "Cancel"}</button>
              <button type="button" className="df-dialog-danger" disabled={clearLocalDataPhrase !== "DELETE"} onClick={() => {
                try {
                  // Wipe only NavoPath-owned local entries; Supabase auth
                  // session keys (sb-*) are preserved so the user stays
                  // signed in and the cloud profile is re-fetched.
                  const preserve: string[] = [];
                  const toRemove: string[] = [];
                  for (let i = 0; i < localStorage.length; i += 1) {
                    const key = localStorage.key(i);
                    if (!key) continue;
                    if (key.startsWith("sb-") || key.startsWith("supabase")) { preserve.push(key); continue; }
                    toRemove.push(key);
                  }
                  for (const key of toRemove) localStorage.removeItem(key);
                } catch (err) {
                  console.error("Failed to clear local data:", err);
                }
                setConfirmClearLocalData(false);
                setClearLocalDataPhrase("");
                // Hard reload so the app re-bootstraps from a clean state.
                window.location.href = window.location.pathname;
              }}>{lang === "zh" ? "清空" : "Clear"}</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
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

function PluginGuidePage() {
  registerBuiltinPlugins();
  const [language, setLanguage] = useState<Language>(detectSystemLanguage());
  const zh = language === "zh";
  const labels = {
    back: zh ? "返回工作区" : "Back to app",
    tag: zh ? "官方插件 / MCP" : "OFFICIAL PLUGINS / MCP",
    title: zh ? "Plugins 和 MCP 使用说明" : "Plugins and MCP guide",
    intro: zh
      ? "随 NavoPath 发布的官方内置插件可提供直接使用的工具；桌面设置也可展示经过校验的本地 manifest 和配置，但不会加载或执行本地目录或远程脚本。"
      : "Official built-in plugins shipped with NavoPath can provide usable tools. Desktop settings may also display validated local manifests and configuration, but local directory scripts and remote scripts are not loaded or executed.",
    mcp: zh ? "MCP 快速配置" : "MCP quickstart",
    plugins: zh ? "官方插件作用" : "Official plugin roles",
    security: zh ? "安全边界" : "Security boundary",
    host: zh ? "宿主能力" : "Host capabilities",
  };
  const config = `[mcp_servers.navopath]\nurl = "${MCP_ENDPOINT}"\nhttp_headers = { Authorization = "Bearer nvp_YOUR_TOKEN" }`;
  return (
    <main className="df-doc-page changelog-like">
      <nav className="df-doc-sidebar" aria-label={zh ? "文档导航" : "Documentation navigation"}>
        <a href="/app">← {labels.back}</a>
        <div className="df-doc-language" aria-label={zh ? "文档语言" : "Guide language"}>
          <button type="button" className={zh ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
          <button type="button" className={!zh ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
        </div>
      </nav>
      <article className="df-doc-content">
        <header className="df-doc-hero">
          <span>{labels.tag}</span>
          <h1>{labels.title}</h1>
          <p>{labels.intro}</p>
        </header>
        <section id="mcp" className="df-doc-section">
          <h2>{labels.mcp}</h2>
          <p>{zh ? "打开 Settings → MCP，生成个人 Bearer Token，然后把下面的 Streamable HTTP 配置写入支持 MCP 的客户端。原始令牌只显示一次。" : "Open Settings → MCP, create a personal Bearer token, then paste the Streamable HTTP configuration below into an MCP-capable client. The raw token is shown once."}</p>
          <pre>{config}</pre>
          <dl>
            <div><dt>{zh ? "服务地址" : "Endpoint"}</dt><dd><code>{MCP_ENDPOINT}</code></dd></div>
            <div><dt>{zh ? "传输方式" : "Transport"}</dt><dd>Streamable HTTP</dd></div>
            <div><dt>{zh ? "认证" : "Authentication"}</dt><dd><code>Authorization: Bearer nvp_...</code></dd></div>
          </dl>
        </section>
        <section id="plugins" className="df-doc-section">
          <h2>{labels.plugins}</h2>
          <div className="df-doc-grid">
            {listRegisteredPlugins().map((plugin) => (
              <article key={plugin.id}>
                <h3>{localizedPluginName(plugin, language)}</h3>
                <p>{localizedPluginDescription(plugin, language)}</p>
                <small>{localizedPluginEnabledSummary(plugin, language)}</small>
              </article>
            ))}
          </div>
        </section>
        <section id="security" className="df-doc-section">
          <h2>{labels.security}</h2>
          <p>{zh ? "内置插件代码随 NavoPath 一起发布。桌面端本地插件只会把经过大小与结构校验的 manifest 元数据和配置登记到界面，不读取或执行目录脚本；网页版同样不会加载任意本地或远程插件代码。" : "Built-in plugin code ships with NavoPath. Desktop local plugins contribute only manifest metadata and configuration that pass size and structure validation; directory scripts are not read or executed, and the web build likewise loads no arbitrary local or remote plugin code."}</p>
        </section>
        <section id="host" className="df-doc-section">
          <h2>{labels.host}</h2>
          <table>
            <tbody>
              <tr><th><code>getData()</code></th><td>{zh ? "读取当前规划快照。" : "Read the current planner snapshot."}</td></tr>
              <tr><th><code>savePluginConfig(id, patch)</code></th><td>{zh ? "保存插件自己的设置。" : "Persist plugin-owned settings."}</td></tr>
              <tr><th><code>emit(event, payload)</code></th><td>{zh ? "广播 NavoPath 插件事件。" : "Broadcast a NavoPath plugin event."}</td></tr>
              <tr><th><code>toast(message)</code></th><td>{zh ? "显示短暂的应用内状态提示。" : "Show a transient in-app status message."}</td></tr>
            </tbody>
          </table>
        </section>
      </article>
    </main>
  );
}


// ── Shared layout shells: imported from ./components/ExecutionSharedLayout ──
// The six shared components (ExecutionSplitLayout, CandidatePanelShell,
// CandidatePanelHeader, CandidateBlock, TimelineCanvas, TimelineEventBlock)
// are imported at the top of this file (line 54). Both the execution page
// and ScheduleTemplateModal render through these imported components, so
// reuse is enforced by the ES-module import graph — not by being in the
// same file scope.


// ── AppErrorBoundary: permanent top-level error boundary ──
// Catches React render errors and displays the error message + stack so the
// user sees a diagnostic screen instead of a blank white window. Without this,
// any uncaught render error in the App tree unmounts the entire root and
// leaves the Electron window blank.
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AppErrorBoundary]", error, info);
  }
  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || this.state.error);
      const stack = String(this.state.error?.stack || "");
      return (
        <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap", color: "#C96F5B", background: "#fff", minHeight: "100vh" }}>
          <h2 style={{ color: "#C96F5B", margin: "0 0 12px" }}>Render Error</h2>
          <pre>{message}</pre>
          {stack && <pre style={{ marginTop: 12, color: "#666" }}>{stack}</pre>}
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "6px 12px", fontSize: 14 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root")!;
const rootKey = "__plannerRoot";
const rootWindow = window as typeof window & { [rootKey]?: ReturnType<typeof createRoot> };
const root = rootWindow[rootKey] ?? createRoot(rootElement);
rootWindow[rootKey] = root;
const routeSearchParams = new URLSearchParams(window.location.search);
const isCompactWindowRoute = routeSearchParams.get("compactWindow") === "1";
const isWidgetPopoverRoute = routeSearchParams.get("widgetPopover") === "1";
const isWidgetRoute = routeSearchParams.get("widget") === "1";
root.render(
  isWidgetPopoverRoute
    ? <Suspense fallback={null}><WidgetPopoverAppLazy /></Suspense>
    : isWidgetRoute
    ? <Suspense fallback={null}><WidgetAppLazy /></Suspense>
    : window.location.pathname === "/changelog"
      ? <Suspense fallback={<div className="df-loading-inline">Loading changelog...</div>}><ChangelogPage /></Suspense>
      : window.location.pathname === "/plugin-guide"
        ? <PluginGuidePage />
      : <AppErrorBoundary><App /></AppErrorBoundary>,
);
