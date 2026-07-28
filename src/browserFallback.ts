import type { AiAction, AiPersonalizationProfile, ChatMessage, HabitDailyState, PlannerApi, PlannerData, Settings, Subtask, Task, TaskAiInference, TaskRecurrence, TimelineRecord } from "./types";
import { normalizeSettings } from "./defaultSettings";
import { normalizeTreeOrder } from "./utils/treeOrder";
import { inferWorkflowStatus, normalizeTimeEntry } from "./utils/productivity";
import { normalizePlannerDataForClient } from "./utils/dataNormalization";

const PREVIEW_STORAGE_KEY = "planner-preview-data";
const PREVIEW_SETTINGS_KEY = "planner-preview-settings";
const PREVIEW_MODE_KEY = "navopath-force-local-preview";
const PREVIEW_SEED_VERSION = "browser-preview-v3";
const MAX_PERSISTED_SUBTASK_DEPTH = 64;
const MAX_PERSISTED_ID_LENGTH = 200;
const MAX_PERSISTED_TITLE_LENGTH = 10_000;
const MAX_PERSISTED_TEXT_LENGTH = 60_000;
const MAX_PERSISTED_TAGS = 100;
const MAX_PERSISTED_TAG_SCAN = 1_000;
const MAX_PERSISTED_TAG_LENGTH = 200;
const MAX_PERSISTED_TEMPLATE_SLOTS = 500;
const MAX_LEGACY_EVENT_ID_LENGTH = 160;
const MAX_MIGRATED_EVENT_TASKS = 5_000;
const MAX_HABIT_DURATION_MINUTES = 480;
const MAX_HABIT_TARGET = 1_000;
const MAX_HABIT_DAILY_STATES = 50_000;
const MAX_PERSISTED_TIMELINE_RECORDS = 1_000;
const MAX_PERSISTED_TIMELINE_RECORD_SCAN = 10_000;
const MAX_RECURRENCE_DURATION_MINUTES = 24 * 60;
const MAX_RECURRENCE_COUNT = 10_000;
const MAX_AI_CONVERSATIONS = 500;
const MAX_AI_MESSAGES = 500;
const MAX_AI_MEMORIES = 5_000;
const MAX_AI_STEPS = 100;
const MAX_AI_ACTIONS = 200;
const MAX_AI_ACTION_SCAN = 1_000;
const MAX_AI_PLAN_BLOCKS = 200;
const MAX_AI_INTENT_LENGTH = 1_000;
const MAX_AI_JSON_DEPTH = 6;
const MAX_AI_JSON_NODES = 5_000;
const MAX_AI_JSON_KEYS = 100;
const MAX_AI_JSON_STRING_LENGTH = 10_000;
const MAX_AI_PROFILE_PROJECTS = 1_000;
const MAX_AI_PROFILE_PROJECT_SCAN = 5_000;
const MAX_AI_PROFILE_TOKENS = 1_000;
const MAX_AI_PROFILE_TOKEN_SCAN = 5_000;
const MAX_AI_PROFILE_COUNTER = 1_000_000;
const MAX_AI_INFERENCE_DURATION_MINUTES = 24 * 60;
const MAX_TASK_ESTIMATED_HOURS = 24;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createResilientStorage(storage: StorageLike) {
  const sessionOverrides = new Map<string, string | null>();
  return {
    getItem(key: string) {
      if (sessionOverrides.has(key)) return sessionOverrides.get(key) ?? null;
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string) {
      sessionOverrides.set(key, value);
      try {
        storage.setItem(key, value);
      } catch {
        // Keep the latest value in memory when browser storage is unavailable.
      }
    },
    removeItem(key: string) {
      sessionOverrides.set(key, null);
      try {
        storage.removeItem(key);
      } catch {
        // The in-memory tombstone still hides an inaccessible stale value.
      }
    },
  };
}

const previewStorage = createResilientStorage({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
});

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordItems<T>(value: T[] | null | undefined): T[];
function recordItems<T = Record<string, unknown>>(value: unknown): T[];
function recordItems<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter(isRecord) as T[] : [];
}

function uniqueRecordItems<T>(value: T[] | null | undefined): T[];
function uniqueRecordItems<T = Record<string, unknown>>(value: unknown): T[];
function uniqueRecordItems<T>(value: unknown): T[] {
  const seenIds = new Set<string>();
  return recordItems<T>(value).filter((item) => {
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string" || !id) return true;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

function persistedId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_PERSISTED_ID_LENGTH
    ? value
    : undefined;
}

function boundedPersistedString(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function persistedTime(value: unknown, fallback: string) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

function persistedDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function persistedCategory(value: unknown): Task["category"] {
  return ["exam", "uk", "us", "essay", "materials", "project", "personal"].includes(String(value))
    ? value as Task["category"]
    : "personal";
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function persistedTimestampRank(value: unknown) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function persistedTimestamp(value: unknown, fallback?: string) {
  return typeof value === "string"
    && value.length <= MAX_PERSISTED_ID_LENGTH
    && Number.isFinite(Date.parse(value))
    ? value
    : fallback;
}

function safeRecordKey(value: unknown) {
  const key = persistedId(value);
  return key && key !== "__proto__" && key !== "constructor" && key !== "prototype"
    ? key
    : undefined;
}

function normalizeAiProfile(
  value: unknown,
  projectIds: Set<string>,
): AiPersonalizationProfile | undefined {
  if (!isRecord(value)) return undefined;
  const allowedProjectIds = new Set([...projectIds, "__unassigned__"]);
  const durationByProject: AiPersonalizationProfile["durationByProject"] = {};
  let durationProjectCount = 0;
  if (isRecord(value.durationByProject)) {
    for (const [rawProjectId, rawStat] of Object.entries(value.durationByProject)
      .slice(0, MAX_AI_PROFILE_PROJECT_SCAN)) {
      if (durationProjectCount >= MAX_AI_PROFILE_PROJECTS) break;
      const projectId = safeRecordKey(rawProjectId);
      if (!projectId || !allowedProjectIds.has(projectId) || !isRecord(rawStat)) continue;
      durationByProject[projectId] = {
        minutes: boundedInteger(rawStat.minutes, 15, 240, 45),
        sampleCount: boundedInteger(rawStat.sampleCount, 0, MAX_AI_PROFILE_COUNTER, 0),
      };
      durationProjectCount += 1;
    }
  }

  const projectTokenWeights: AiPersonalizationProfile["projectTokenWeights"] = {};
  let tokenProjectCount = 0;
  if (isRecord(value.projectTokenWeights)) {
    for (const [rawProjectId, rawWeights] of Object.entries(value.projectTokenWeights)
      .slice(0, MAX_AI_PROFILE_PROJECT_SCAN)) {
      if (tokenProjectCount >= MAX_AI_PROFILE_PROJECTS) break;
      const projectId = safeRecordKey(rawProjectId);
      if (!projectId || !projectIds.has(projectId) || !isRecord(rawWeights)) continue;
      const weights: Record<string, number> = {};
      let weightCount = 0;
      for (const [rawToken, rawWeight] of Object.entries(rawWeights)
        .slice(0, MAX_AI_PROFILE_TOKEN_SCAN)) {
        if (weightCount >= MAX_AI_PROFILE_TOKENS) break;
        const token = safeRecordKey(rawToken);
        if (!token || typeof rawWeight !== "number" || !Number.isFinite(rawWeight) || rawWeight <= 0) continue;
        weights[token] = boundedInteger(rawWeight, 1, MAX_AI_PROFILE_COUNTER, 1);
        weightCount += 1;
      }
      projectTokenWeights[projectId] = weights;
      tokenProjectCount += 1;
    }
  }

  const preferredStartHourByProject: AiPersonalizationProfile["preferredStartHourByProject"] = {};
  let preferredHourProjectCount = 0;
  if (isRecord(value.preferredStartHourByProject)) {
    for (const [rawProjectId, rawHour] of Object.entries(value.preferredStartHourByProject)
      .slice(0, MAX_AI_PROFILE_PROJECT_SCAN)) {
      if (preferredHourProjectCount >= MAX_AI_PROFILE_PROJECTS) break;
      const projectId = safeRecordKey(rawProjectId);
      if (!projectId || !projectIds.has(projectId)) continue;
      preferredStartHourByProject[projectId] = boundedInteger(rawHour, 0, 23, 9);
      preferredHourProjectCount += 1;
    }
  }

  const feedback = isRecord(value.feedback) ? value.feedback : {};
  const counter = (key: keyof AiPersonalizationProfile["feedback"]) =>
    boundedInteger(feedback[key], 0, MAX_AI_PROFILE_COUNTER, 0);
  return {
    version: 1,
    updatedAt: persistedTimestamp(value.updatedAt) || now(),
    historySince: persistedTimestamp(value.historySince),
    durationByProject,
    projectTokenWeights,
    preferredStartHourByProject,
    feedback: {
      durationCorrections: counter("durationCorrections"),
      projectCorrections: counter("projectCorrections"),
      assignmentUndos: counter("assignmentUndos"),
      scheduleAccepts: counter("scheduleAccepts"),
      scheduleRejects: counter("scheduleRejects"),
    },
  };
}

function normalizeAiInference(
  value: unknown,
  projectIds: Set<string>,
  fallbackTimestamp: string,
): TaskAiInference | undefined {
  if (!isRecord(value)) return undefined;
  const sources = ["default", "history", "ai", "user"] as const;
  const normalizeField = (field: Record<string, unknown>) => ({
    confidence: typeof field.confidence === "number" && Number.isFinite(field.confidence)
      ? Math.min(1, Math.max(0, field.confidence))
      : 0,
    source: sources.includes(field.source as typeof sources[number])
      ? field.source as typeof sources[number]
      : "default" as const,
    inferredAt: persistedTimestamp(field.inferredAt, fallbackTimestamp) || now(),
    modelVersion: boundedPersistedString(
      field.modelVersion,
      MAX_PERSISTED_ID_LENGTH,
      "local-profile-v1",
    ),
    ...(field.userOverridden === undefined
      ? {}
      : { userOverridden: Boolean(field.userOverridden) }),
  });
  const duration = isRecord(value.duration)
    ? {
        ...normalizeField(value.duration),
        minutes: boundedInteger(
          value.duration.minutes,
          15,
          MAX_AI_INFERENCE_DURATION_MINUTES,
          45,
        ),
      }
    : undefined;
  const projectId = isRecord(value.project) ? safeRecordKey(value.project.projectId) : undefined;
  const project = isRecord(value.project) && projectId && projectIds.has(projectId)
    ? { ...normalizeField(value.project), projectId }
    : undefined;
  return duration || project ? { duration, project } : undefined;
}

function normalizeTaskRecurrence(value: unknown): TaskRecurrence | undefined {
  if (!isRecord(value)) return undefined;
  const frequencies: TaskRecurrence["frequency"][] = [
    "daily", "weekdays", "weekends", "weekly", "biweekly", "monthly", "quarterly",
  ];
  if (!frequencies.includes(value.frequency as TaskRecurrence["frequency"])) return undefined;
  const startDate = persistedDate(value.startDate);
  if (!startDate) return undefined;
  const startTime = persistedTime(value.startTime, "");
  const mode = value.mode === "scheduled" && startTime ? "scheduled" : "flexible";
  const endDate = persistedDate(value.endDate);
  const count = typeof value.count === "number" && Number.isFinite(value.count) && value.count > 0
    ? boundedInteger(value.count, 1, MAX_RECURRENCE_COUNT, 1)
    : undefined;
  return {
    mode,
    frequency: value.frequency as TaskRecurrence["frequency"],
    startDate,
    startTime: mode === "scheduled" ? startTime : undefined,
    durationMinutes: mode === "scheduled"
      ? boundedInteger(value.durationMinutes, 5, MAX_RECURRENCE_DURATION_MINUTES, 60)
      : undefined,
    endDate: endDate && endDate >= startDate ? endDate : undefined,
    count,
  };
}

function normalizePersistedJson(
  value: unknown,
  depth: number,
  budget: { remaining: number },
): unknown {
  if (budget.remaining <= 0) return undefined;
  budget.remaining -= 1;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, MAX_AI_JSON_STRING_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (depth >= MAX_AI_JSON_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_AI_ACTIONS)
      .map((item) => normalizePersistedJson(item, depth + 1, budget))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return undefined;
  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_AI_JSON_KEYS)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const child = normalizePersistedJson(item, depth + 1, budget);
    if (child !== undefined) normalized[key.slice(0, MAX_PERSISTED_ID_LENGTH)] = child;
  }
  return normalized;
}

function isValidPersistedAiAction(action: Record<string, unknown>) {
  switch (action.type) {
    case "create_subtasks":
      return Boolean(persistedId(action.taskId)) && Array.isArray(action.subtasks);
    case "create_task":
    case "create_scheduled_task":
      return typeof action.title === "string" && action.title.trim().length > 0;
    case "schedule_task":
      return Boolean(persistedId(action.taskId)) && Boolean(persistedDate(action.date));
    case "import_schedule_item":
      return action.kind === "task"
        && typeof action.title === "string"
        && action.title.trim().length > 0
        && Boolean(persistedDate(action.date))
        && (!action.startTime || Boolean(persistedTime(action.startTime, "")))
        && (!action.endTime || Boolean(persistedTime(action.endTime, "")));
    case "plan_day":
    case "none":
      return true;
    default:
      return false;
  }
}

function normalizePersistedTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, MAX_PERSISTED_TAG_SCAN)) {
    if (typeof item !== "string") continue;
    const tag = item.trim().slice(0, MAX_PERSISTED_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_PERSISTED_TAGS) break;
  }
  return tags;
}

function normalizeChatMessages(value: unknown, forceSaved = false): ChatMessage[] {
  return uniqueRecordItems<ChatMessage>(value).slice(-MAX_AI_MESSAGES).map((message) => {
    const role = message.role === "assistant" ? "assistant" : "user";
    const steps = role === "assistant"
      ? recordItems<NonNullable<ChatMessage["steps"]>[number]>(message.steps)
        .filter((step) => typeof step.label === "string")
        .slice(0, MAX_AI_STEPS)
        .map((step) => ({
          label: boundedPersistedString(step.label, MAX_PERSISTED_TITLE_LENGTH),
          status: ["pending", "running", "done", "error"].includes(String(step.status))
            ? step.status
            : "pending",
        }))
      : [];
    const actionEntries: Array<{ action: Record<string, unknown>; originalIndex: number }> = [];
    const actionBudget = { remaining: MAX_AI_JSON_NODES };
    if (role === "assistant") {
      for (const [originalIndex, action] of recordItems<Record<string, unknown>>(message.actions)
        .slice(0, MAX_AI_ACTION_SCAN).entries()) {
        if (actionEntries.length >= MAX_AI_ACTIONS) break;
        if (!isValidPersistedAiAction(action)) continue;
        const normalized = normalizePersistedJson(action, 0, actionBudget);
        if (isRecord(normalized)) actionEntries.push({ action: normalized, originalIndex });
      }
    }
    const actions = actionEntries.map((entry) => entry.action);
    const selectedActions: Record<number, boolean> = {};
    if (role === "assistant" && isRecord(message.selectedActions)) {
      actionEntries.forEach((entry, index) => {
        const selected = message.selectedActions?.[entry.originalIndex];
        if (typeof selected === "boolean") selectedActions[index] = selected;
      });
    }
    const plan = role === "assistant"
      ? recordItems<NonNullable<ChatMessage["plan"]>[number]>(message.plan)
        .filter((block) => (
          typeof block.title === "string"
          && Boolean(persistedTime(block.start, ""))
          && Boolean(persistedTime(block.end, ""))
        ))
        .slice(0, MAX_AI_PLAN_BLOCKS)
        .map((block) => ({
          taskId: persistedId(block.taskId),
          title: boundedPersistedString(block.title, MAX_PERSISTED_TITLE_LENGTH),
          start: persistedTime(block.start, ""),
          end: persistedTime(block.end, ""),
          durationMinutes: block.durationMinutes === undefined
            ? undefined
            : boundedInteger(block.durationMinutes, 1, MAX_RECURRENCE_DURATION_MINUTES, 1),
          reason: boundedPersistedString(block.reason, MAX_PERSISTED_TITLE_LENGTH) || undefined,
        }))
      : [];
    return {
      id: persistedId(message.id) || uid("chat"),
      role,
      content: boundedPersistedString(message.content, MAX_PERSISTED_TEXT_LENGTH),
      createdAt: typeof message.createdAt === "string" && message.createdAt ? message.createdAt : now(),
      saved: forceSaved || Boolean(message.saved),
      status: ["thinking", "done", "error"].includes(String(message.status)) ? message.status : "done",
      steps: steps.length > 0 ? steps : undefined,
      actions: actions.length > 0 ? actions : undefined,
      selectedActions: Object.keys(selectedActions).length > 0 ? selectedActions : undefined,
      actionState: ["pending", "adopted", "rejected", "undone"].includes(String(message.actionState))
        ? message.actionState
        : undefined,
      intent: boundedPersistedString(message.intent, MAX_AI_INTENT_LENGTH) || undefined,
      plan: plan.length > 0 ? plan : undefined,
      format: message.format === "markdown" ? "markdown" : "text",
    };
  });
}

function normalizeTimelineRecords(value: unknown, taskId: string): TimelineRecord[] {
  const records: TimelineRecord[] = [];
  const seenIds = new Set<string>();
  for (const record of recordItems<TimelineRecord>(value).slice(0, MAX_PERSISTED_TIMELINE_RECORD_SCAN)) {
    if (records.length >= MAX_PERSISTED_TIMELINE_RECORDS) break;
    const scheduledDate = persistedDate(record.scheduledDate);
    const scheduledStart = persistedTime(record.scheduledStart, "");
    const scheduledEnd = persistedTime(record.scheduledEnd, "");
    if (!scheduledDate || !scheduledStart || !scheduledEnd) continue;
    const id = persistedId(record.id) || uid("timeline");
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const candidateEndDate = persistedDate(record.scheduledEndDate) || scheduledDate;
    records.push({
      ...record,
      id,
      taskId,
      scheduledDate,
      scheduledStart,
      scheduledEndDate: candidateEndDate < scheduledDate ? scheduledDate : candidateEndDate,
      scheduledEnd,
      executionStatus: ["scheduled", "completed", "returned_unfinished", "cancelled"].includes(String(record.executionStatus))
        ? record.executionStatus
        : "scheduled",
      createdAt: typeof record.createdAt === "string" && record.createdAt ? record.createdAt : now(),
    });
  }
  return records;
}

function normalizeSubtasks(
  value: unknown,
  depth = 0,
  seenIds = new Set<string>(),
  taskIds?: Set<string>,
): Subtask[] {
  if (depth >= MAX_PERSISTED_SUBTASK_DEPTH) return [];
  const result: Subtask[] = [];
  for (const [index, subtask] of recordItems<Subtask>(value).entries()) {
    const id = persistedId(subtask.id) || uid("sub");
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const plannedTaskId = persistedId(subtask.plannedTaskId);
    result.push({
      ...subtask,
      id,
      title: boundedPersistedString(subtask.title, MAX_PERSISTED_TITLE_LENGTH),
      plannedTaskId: plannedTaskId && (!taskIds || taskIds.has(plannedTaskId))
        ? plannedTaskId
        : undefined,
      completed: typeof subtask.completed === "boolean" ? subtask.completed : Boolean(subtask.done),
      done: typeof subtask.done === "boolean" ? subtask.done : Boolean(subtask.completed),
      order: typeof subtask.order === "number" ? subtask.order : index,
      createdAt: subtask.createdAt || now(),
      subtasks: subtask.subtasks
        ? normalizeSubtasks(subtask.subtasks, depth + 1, seenIds, taskIds)
        : undefined,
    });
  }
  return result;
}

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

function migrateEventsToTasks(data: PlannerData): Task[] {
  const existing = new Set((data.tasks || []).map((task) => task.id));
  const migrated: Task[] = [];
  let migrationCandidates = 0;
  const makeTask = (event: PlannerData["events"][number], date: string, suffix: string): Task => {
    const id = `migrated_event_${event.id}_${suffix}`;
    const start = event.startTime || undefined;
    const duration = start && event.endTime
      ? Math.max((Number(event.endTime.slice(0, 2)) * 60 + Number(event.endTime.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))), 15)
      : 30;
    const task: Task = {
      id,
      title: event.title,
      dueDate: date,
      category: event.category || "personal",
      priority: "medium",
      notes: event.details || "",
      goalId: "",
      completed: false,
      workflowStatus: "next",
      estimatedHours: duration / 60,
      plannedForDate: date,
      recurrence: event.recurrence,
      subtasks: [],
      createdAt: event.createdAt || now(),
      updatedAt: event.createdAt || now(),
    };
    if (start && !event.recurrence) task.timelineRecords = [{ id: `${id}_schedule`, taskId: id, scheduledDate: date, scheduledStart: start, scheduledEnd: event.endTime || `${String(Math.min(Number(start.slice(0, 2)) + 1, 23)).padStart(2, "0")}:${start.slice(3)}`, executionStatus: "scheduled", createdAt: event.createdAt || now() }];
    return task;
  };
  for (const event of data.events || []) {
    if (migrationCandidates >= MAX_MIGRATED_EVENT_TASKS) break;
    const startDate = event.startDate || event.date || localIso(new Date());
    const endDate = event.endDate || startDate;
    if (event.startTime || event.recurrence) {
      migrationCandidates += 1;
      const task = makeTask(event, startDate, "primary");
      if (!existing.has(task.id)) migrated.push(task);
      continue;
    }
    for (
      let date = startDate, index = 0;
      date <= endDate && index < 366 && migrationCandidates < MAX_MIGRATED_EVENT_TASKS;
      date = addDays(date, 1), index += 1
    ) {
      migrationCandidates += 1;
      const task = makeTask(event, date, date);
      if (!existing.has(task.id)) migrated.push(task);
    }
  }
  return migrated;
}

export function shouldUseLocalPreviewByDefault(hostname: string, pathname: string, preview: string | null) {
  if (preview) return false;
  const localHost = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  return localHost && (pathname === "/app" || pathname.startsWith("/app/"));
}

function configurePreviewMode() {
  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview");
  const useLocalPreviewByDefault = shouldUseLocalPreviewByDefault(window.location.hostname, window.location.pathname, preview);
  const storedSettings = previewStorage.getItem(PREVIEW_SETTINGS_KEY);
  if (storedSettings) {
    previewStorage.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(parseLocalPreviewSettings(storedSettings)));
  }
  if (preview === "local") previewStorage.setItem(PREVIEW_MODE_KEY, "1");
  if (preview === "cloud" || preview === "off") previewStorage.removeItem(PREVIEW_MODE_KEY);
  // Migration: earlier builds persisted the runtime fallback to localStorage, which
  // trapped users in preview mode forever. If the URL does not explicitly request
  // local preview this cold start, drop the stale flag so the cloud backend is retried.
  if (preview !== "local" && previewStorage.getItem(PREVIEW_MODE_KEY) === "1") {
    previewStorage.removeItem(PREVIEW_MODE_KEY);
  }
  return preview === "local" || useLocalPreviewByDefault || previewStorage.getItem(PREVIEW_MODE_KEY) === "1";
}

export function parseLocalPreviewSettings(raw: string | null): Settings {
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      stored = parsed as Record<string, unknown>;
    }
  } catch {
    // A damaged local settings snapshot should not prevent preview mode loading.
  }

  delete stored._apiKey;
  delete stored.apiKey;
  delete stored.clearApiKey;
  return normalizeSettings({
    displayName: "NavoPath Preview",
    panelWidths: { left: 310, right: 360 },
    ...stored,
    hasApiKey: false,
    apiKeyPreview: "",
  });
}

function makeRecurrence(overrides: Partial<TaskRecurrence>): TaskRecurrence {
  return {
    mode: "scheduled",
    frequency: "weekly",
    startDate: overrides.startDate,
    startTime: overrides.startTime || "09:00",
    durationMinutes: overrides.durationMinutes || 60,
    endDate: overrides.endDate,
    count: overrides.count,
    ...overrides,
  };
}

export function normalizeData(data: PlannerData): PlannerData {
  const safeData: PlannerData = {
    ...data,
    goals: uniqueRecordItems(data.goals),
    projects: uniqueRecordItems(recordItems<PlannerData["projects"][number]>(data.projects)
      .filter((project) => Boolean(persistedId(project.id)) && typeof project.title === "string")),
    tasks: uniqueRecordItems(recordItems<PlannerData["tasks"][number]>(data.tasks)
      .filter((task) => Boolean(persistedId(task.id)) && typeof task.title === "string")),
    habits: uniqueRecordItems(recordItems<NonNullable<PlannerData["habits"]>[number]>(data.habits)
      .filter((habit) => typeof habit.title === "string")),
    habitDailyStates: uniqueRecordItems(data.habitDailyStates),
    timeEntries: uniqueRecordItems(data.timeEntries),
    longTasks: uniqueRecordItems(data.longTasks),
    events: uniqueRecordItems(recordItems<PlannerData["events"][number]>(data.events)
      .slice(0, MAX_MIGRATED_EVENT_TASKS)
      .filter((event) => (
        typeof event.id === "string"
        && event.id.length > 0
        && event.id.length <= MAX_LEGACY_EVENT_ID_LENGTH
        && typeof event.title === "string"
      ))),
    notes: uniqueRecordItems(data.notes),
    drafts: uniqueRecordItems(data.drafts),
    chat: uniqueRecordItems(data.chat),
    aiConversations: uniqueRecordItems(data.aiConversations).slice(0, MAX_AI_CONVERSATIONS),
    aiMemories: uniqueRecordItems(data.aiMemories).slice(-MAX_AI_MEMORIES),
    scheduleTemplates: uniqueRecordItems(data.scheduleTemplates),
    aiProfile: isRecord(data.aiProfile) ? data.aiProfile : undefined,
    taskLayouts: isRecord(data.taskLayouts) ? data.taskLayouts as PlannerData["taskLayouts"] : {},
  };
  const migratedTasks = migrateEventsToTasks(safeData);
  const projectIds = new Set(safeData.projects.map((project) => project.id));
  const goalIds = new Set(safeData.goals.map((goal) => persistedId(goal.id)).filter(Boolean));
  const tasks = [...safeData.tasks, ...migratedTasks];
  const taskIds = new Set(tasks.map((task) => task.id));
  const notes = safeData.notes.map((note) => ({
    ...note,
    id: persistedId(note.id) || uid("note"),
    content: boundedPersistedString(note.content, MAX_PERSISTED_TEXT_LENGTH),
    tags: normalizePersistedTags(note.tags),
    createdAt: note.createdAt || now(),
  }));
  const chat = normalizeChatMessages(safeData.chat);
  const aiConversations = (safeData.aiConversations && safeData.aiConversations.length > 0)
    ? safeData.aiConversations.map((conversation) => ({
      ...conversation,
      id: persistedId(conversation.id) || uid("conversation"),
      title: boundedPersistedString(conversation.title, MAX_PERSISTED_TITLE_LENGTH) || "AI 对话",
      messages: normalizeChatMessages(conversation.messages),
      createdAt: conversation.createdAt || now(),
      updatedAt: conversation.updatedAt || conversation.createdAt || now(),
    }))
    : (chat.length > 0 ? [{
      id: uid("conversation"),
      title: "历史对话",
      messages: chat,
      createdAt: chat[0]?.createdAt || now(),
      updatedAt: chat[chat.length - 1]?.createdAt || now(),
    }] : []);
  const activeAiConversationId = persistedId(safeData.activeAiConversationId);
  const habits = (safeData.habits || []).map((habit, index) => {
    const reminderTime = isRecord(habit.reminder) ? persistedTime(habit.reminder.time, "") : "";
    return {
      ...habit,
      id: persistedId(habit.id) || uid("habit"),
      title: boundedPersistedString(habit.title, MAX_PERSISTED_TITLE_LENGTH),
      notes: boundedPersistedString(habit.notes, MAX_PERSISTED_TEXT_LENGTH) || undefined,
      defaultDurationMinutes: boundedInteger(
        habit.defaultDurationMinutes,
        5,
        MAX_HABIT_DURATION_MINUTES,
        20,
      ),
      frequencyRule: ["daily", "weekly", "custom"].includes(String(habit.frequencyRule))
        ? habit.frequencyRule
        : "daily",
      weeklyTarget: habit.weeklyTarget === undefined
        ? undefined
        : boundedInteger(habit.weeklyTarget, 0, MAX_HABIT_TARGET, 0),
      targetCount: habit.targetCount === undefined
        ? undefined
        : boundedInteger(habit.targetCount, 0, MAX_HABIT_TARGET, 0),
      activeWeekdays: Array.from(new Set(
        (Array.isArray(habit.activeWeekdays) ? habit.activeWeekdays : [])
          .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6),
      )),
      reminder: isRecord(habit.reminder)
        ? { enabled: Boolean(habit.reminder.enabled), ...(reminderTime ? { time: reminderTime } : {}) }
        : undefined,
      archived: Boolean(habit.archived),
      order: boundedInteger(habit.order, 0, Number.MAX_SAFE_INTEGER, index),
      createdAt: habit.createdAt || now(),
      updatedAt: habit.updatedAt || habit.createdAt || now(),
    };
  });
  const habitIds = new Set(habits.map((habit) => habit.id));
  const habitStateByDate = new Map<string, HabitDailyState>();
  for (const state of safeData.habitDailyStates || []) {
    const habitId = String(state.habitId);
    const date = persistedDate(state.date);
    if (!habitIds.has(habitId) || !date) continue;
    const normalizedState: HabitDailyState = {
      ...state,
      id: persistedId(state.id) || uid("habit-state"),
      habitId,
      date,
      completed: Boolean(state.completed),
      timelineRecordId: persistedId(state.timelineRecordId),
      createdAt: state.createdAt || now(),
      updatedAt: state.updatedAt || state.createdAt || now(),
    };
    const key = `${habitId}\u0000${date}`;
    const current = habitStateByDate.get(key);
    const normalizedRank = Math.max(
      persistedTimestampRank(normalizedState.updatedAt),
      persistedTimestampRank(normalizedState.createdAt),
    );
    const currentRank = current
      ? Math.max(persistedTimestampRank(current.updatedAt), persistedTimestampRank(current.createdAt))
      : -1;
    if (!current || normalizedRank >= currentRank) habitStateByDate.set(key, normalizedState);
  }
  const habitDailyStates = Array.from(habitStateByDate.values())
    .sort((left, right) => (
      left.date.localeCompare(right.date)
      || persistedTimestampRank(left.updatedAt) - persistedTimestampRank(right.updatedAt)
    ))
    .slice(-MAX_HABIT_DAILY_STATES);
  const seenSubtaskIds = new Set<string>();
  const normalizedTasks = tasks.map((task) => {
    const timelineRecords = normalizeTimelineRecords(task.timelineRecords, task.id);
    const createdAt = persistedTimestamp(task.createdAt) || now();
    const updatedAt = persistedTimestamp(task.updatedAt) || createdAt;
    const completed = task.completed === true;
    const projectId = persistedId(task.projectId);
    const goalId = persistedId(task.goalId);
    const parentTaskId = persistedId(task.parentTaskId);
    const plannedForDate = persistedDate(task.plannedForDate);
    const scheduledDate = persistedDate(task.scheduledDate);
    const scheduledStart = persistedTime(task.scheduledStart, "");
    const hasLegacySchedule = Boolean(scheduledDate && scheduledStart);
    const estimatedHours = typeof task.estimatedHours === "number"
      && Number.isFinite(task.estimatedHours)
      && task.estimatedHours > 0
      ? Math.min(MAX_TASK_ESTIMATED_HOURS, Math.max(0.25, task.estimatedHours))
      : undefined;
    return {
      ...task,
      title: boundedPersistedString(task.title, MAX_PERSISTED_TITLE_LENGTH),
      category: persistedCategory(task.category),
      dueDate: persistedDate(task.dueDate) || "",
      completed,
      estimatedHours,
      projectId: projectId && projectIds.has(projectId) ? projectId : undefined,
      goalId: goalId && goalIds.has(goalId) ? goalId : "",
      parentTaskId: parentTaskId && parentTaskId !== task.id && taskIds.has(parentTaskId)
        ? parentTaskId
        : undefined,
      completedAt: completed
        ? persistedTimestamp(task.completedAt, updatedAt)
        : undefined,
      plannedForDate,
      executionLane: task.executionLane === "candidate" || task.executionLane === "queued"
        ? task.executionLane
        : undefined,
      scheduledDate: hasLegacySchedule ? scheduledDate : undefined,
      scheduledStart: hasLegacySchedule ? scheduledStart : undefined,
      scheduledEnd: hasLegacySchedule
        ? persistedTime(task.scheduledEnd, "") || undefined
        : undefined,
      executionStatus: hasLegacySchedule
        && ["scheduled", "completed", "returned_unfinished", "cancelled"].includes(String(task.executionStatus))
        ? task.executionStatus
        : hasLegacySchedule ? "scheduled" : undefined,
      workflowStatus: inferWorkflowStatus({
        completed,
        workflowStatus: task.workflowStatus,
        plannedForDate,
        timelineRecords,
      }),
      timelineRecords,
      recurrence: normalizeTaskRecurrence(task.recurrence),
      aiInference: normalizeAiInference(
        task.aiInference,
        projectIds,
        persistedTimestamp(task.updatedAt) || now(),
      ),
      subtasks: normalizeSubtasks(task.subtasks, 0, seenSubtaskIds, taskIds),
      notes: boundedPersistedString(task.notes, MAX_PERSISTED_TEXT_LENGTH),
      createdAt,
      updatedAt,
    };
  });
  return normalizePlannerDataForClient(normalizeTreeOrder({
    ...safeData,
    goals: safeData.goals.map((goal) => ({
      ...goal,
      id: persistedId(goal.id) || uid("goal"),
      title: boundedPersistedString(goal.title, MAX_PERSISTED_TITLE_LENGTH),
      description: boundedPersistedString(goal.description, MAX_PERSISTED_TEXT_LENGTH),
    })),
    projects: safeData.projects.map((project) => ({
      ...project,
      title: boundedPersistedString(project.title, MAX_PERSISTED_TITLE_LENGTH),
      notes: boundedPersistedString(project.notes, MAX_PERSISTED_TEXT_LENGTH),
      color: project.color || "#584D3D",
      importance: project.importance || "high",
      urgency: project.urgency || "low",
    })),
    habits,
    habitDailyStates,
    longTasks: safeData.longTasks.map((task) => ({
      ...task,
      id: persistedId(task.id) || uid("long"),
      title: boundedPersistedString(task.title, MAX_PERSISTED_TITLE_LENGTH),
      notes: boundedPersistedString(task.notes, MAX_PERSISTED_TEXT_LENGTH),
    })),
    notes,
    chat,
    aiConversations,
    activeAiConversationId: aiConversations.some((conversation) => conversation.id === activeAiConversationId)
      ? activeAiConversationId
      : aiConversations[0]?.id,
    aiMemories: safeData.aiMemories.map((memory) => ({
      ...memory,
      id: persistedId(memory.id) || uid("memory"),
      content: boundedPersistedString(memory.content, MAX_PERSISTED_TEXT_LENGTH),
      tags: normalizePersistedTags(memory.tags),
      source: ["auto", "manual", "conversation"].includes(String(memory.source))
        ? memory.source
        : "auto",
      sourceMessages: normalizeChatMessages(memory.sourceMessages, true),
      pinned: Boolean(memory.pinned),
      archived: Boolean(memory.archived),
      createdAt: persistedTimestamp(memory.createdAt) || now(),
      updatedAt: persistedTimestamp(memory.updatedAt)
        || persistedTimestamp(memory.createdAt)
        || now(),
    })),
    aiProfile: normalizeAiProfile(safeData.aiProfile, projectIds),
    scheduleTemplates: (safeData.scheduleTemplates || []).map((template) => ({
      ...template,
      id: persistedId(template.id) || uid("template"),
      title: boundedPersistedString(template.title, MAX_PERSISTED_TITLE_LENGTH) || "Template",
      slots: uniqueRecordItems<NonNullable<PlannerData["scheduleTemplates"]>[number]["slots"][number]>(
        recordItems(template.slots).slice(0, MAX_PERSISTED_TEMPLATE_SLOTS),
      ).map((slot) => ({
        ...slot,
        id: persistedId(slot.id) || uid("slot"),
        label: boundedPersistedString(slot.label, MAX_PERSISTED_TITLE_LENGTH) || "Period",
        start: persistedTime(slot.start, "09:00"),
        end: persistedTime(slot.end, "10:00"),
      })),
      createdAt: template.createdAt || now(),
      updatedAt: template.updatedAt || template.createdAt || now(),
    })),
    timeEntries: (safeData.timeEntries || [])
      .map((entry) => normalizeTimeEntry(entry, normalizedTasks, projectIds))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    drafts: safeData.drafts
      .filter((draft) => typeof draft.title === "string" && draft.title)
      .slice(-10)
      .map((draft) => ({
        ...draft,
        id: persistedId(draft.id) || uid("draft"),
        title: boundedPersistedString(draft.title, MAX_PERSISTED_TITLE_LENGTH),
        projectId: persistedId(draft.projectId) || "",
        details: boundedPersistedString(draft.details, MAX_PERSISTED_TEXT_LENGTH),
    })),
    version: Math.max(safeData.version || 1, 2),
    events: [],
    tasks: normalizedTasks,
  }));
}

export function fallbackData(): PlannerData {
  const today = localIso(new Date());
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  const reviewProjectId = uid("project");
  const launchProjectId = uid("project");
  const recurringTaskId = uid("task");
  const normalTaskId = uid("task");
  const returnedTaskId = uid("task");

  return normalizeData({
    version: 1,
    importedSeedVersion: PREVIEW_SEED_VERSION,
    generatedAt: now(),
    goals: [
      {
        id: "goal_admission",
        title: "2027 Entry Admissions",
        description: "Local preview seed for execute-page interaction validation.",
        targetDate: "2027-05-01",
        status: "active",
      },
    ],
    projects: [
      {
        id: reviewProjectId,
        title: "申请材料冲刺",
        category: "materials",
        notes: "本地预览项目，用于验证 recurring block 和候选卡配色。",
        completed: false,
        color: "#4F8EF7",
        importance: "high",
        urgency: "medium",
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: launchProjectId,
        title: "网站上线推进",
        category: "project",
        notes: "本地预览项目，用于验证普通 scheduled task。",
        completed: false,
        color: "#50C3B4",
        importance: "medium",
        urgency: "medium",
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    tasks: [
      {
        id: uid("task"),
        title: "整理 ESAT 题型错因",
        dueDate: tomorrow,
        category: "exam",
        priority: "high",
        notes: "候选任务示例。点击安排只应展开时间面板，不应自动创建时间轴记录。",
        goalId: "goal_admission",
        completed: false,
        projectId: reviewProjectId,
        plannedForDate: today,
        executionLane: "candidate",
        estimatedHours: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uid("task"),
        title: "更新作品集首页文案",
        dueDate: nextWeek,
        category: "essay",
        priority: "medium",
        notes: "",
        goalId: "goal_admission",
        completed: false,
        projectId: launchProjectId,
        plannedForDate: today,
        executionLane: "candidate",
        estimatedHours: 0.5,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uid("task"),
        title: "给导师确认推荐信节奏",
        dueDate: today,
        category: "materials",
        priority: "medium",
        notes: "候选卡 more-open 应只保留备注输出区，不直接铺开表单。",
        goalId: "goal_admission",
        completed: false,
        plannedForDate: today,
        executionLane: "candidate",
        estimatedHours: 0.5,
        recurrence: makeRecurrence({
          mode: "flexible",
          frequency: "daily",
          startDate: today,
          startTime: "10:00",
          durationMinutes: 30,
        }),
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: recurringTaskId,
        title: "每周申请复盘",
        dueDate: today,
        category: "project",
        priority: "medium",
        notes: "这是 recurring timed block，用来验证日 / 3天 / 周视图的整块填充样式。",
        goalId: "goal_admission",
        completed: false,
        projectId: reviewProjectId,
        plannedForDate: today,
        estimatedHours: 1,
        recurrence: makeRecurrence({
          mode: "scheduled",
          frequency: "daily",
          startDate: today,
          startTime: "11:30",
          durationMinutes: 60,
        }),
        timelineRecords: [
          {
            id: `${recurringTaskId}_rec_1`,
            taskId: recurringTaskId,
            scheduledDate: today,
            scheduledStart: "11:30",
            scheduledEnd: "12:30",
            executionStatus: "scheduled",
            createdAt: now(),
          },
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: normalTaskId,
        title: "产品演示彩排",
        dueDate: today,
        category: "project",
        priority: "high",
        notes: "普通 scheduled task，应保持现有非 recurring 样式。",
        goalId: "goal_admission",
        completed: false,
        projectId: launchProjectId,
        plannedForDate: today,
        estimatedHours: 1.5,
        timelineRecords: [
          {
            id: `${normalTaskId}_rec_1`,
            taskId: normalTaskId,
            scheduledDate: today,
            scheduledStart: "14:00",
            scheduledEnd: "15:30",
            executionStatus: "scheduled",
            createdAt: now(),
          },
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: returnedTaskId,
        title: "昨晚未完成的阅读任务",
        dueDate: today,
        category: "personal",
        priority: "low",
        notes: "returned_unfinished 不应命中 recurring block 视觉。",
        goalId: "goal_admission",
        completed: false,
        plannedForDate: today,
        executionLane: "candidate",
        estimatedHours: 0.75,
        executionStatus: "returned_unfinished",
        timelineRecords: [
          {
            id: `${returnedTaskId}_rec_1`,
            taskId: returnedTaskId,
            scheduledDate: today,
            scheduledStart: "18:00",
            scheduledEnd: "18:45",
            executionStatus: "returned_unfinished",
            createdAt: now(),
          },
        ],
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    habits: [
      {
        id: "habit-morning-reading",
        title: "晨读",
        defaultDurationMinutes: 20,
        archived: false,
        order: 0,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "habit-exercise",
        title: "运动",
        defaultDurationMinutes: 30,
        archived: false,
        order: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "habit-review",
        title: "复盘",
        defaultDurationMinutes: 15,
        archived: false,
        order: 2,
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    habitDailyStates: [],
    longTasks: [],
    events: [
      {
        id: uid("event"),
        title: "Mock Interview",
        date: addDays(today, 2),
        category: "project",
        details: "Local preview calendar event.",
        imported: true,
        createdAt: now(),
      },
    ],
    notes: [
      {
        id: uid("note"),
        content: "预览模式已启用。用 ?preview=local 强制走本地 seed 数据。",
        createdAt: now(),
        tags: ["preview"],
      },
    ],
    drafts: [],
    chat: [],
    aiMemories: [],
    taskLayouts: {},
  });
}

export function parseLocalPreviewData(raw: string | null): PlannerData | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Partial<PlannerData>;
    if (!Array.isArray(candidate.tasks) || !Array.isArray(candidate.projects)) return null;
    return normalizeData(candidate as PlannerData);
  } catch {
    return null;
  }
}

function read(): PlannerData {
  const parsed = parseLocalPreviewData(previewStorage.getItem(PREVIEW_STORAGE_KEY));
  if (!parsed || parsed.importedSeedVersion !== PREVIEW_SEED_VERSION) {
    const data = fallbackData();
    previewStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  return parsed;
}

function write(data: PlannerData): PlannerData {
  const saved = { ...data, savedAt: now() };
  previewStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

// Session-level fallback flag (NOT persisted to localStorage).
// Set only by forceLocalPreviewMode() so a single runtime failure does not trap
// the user in preview mode across restarts.
let sessionLocalFallback = false;

export function forceLocalPreviewMode() {
  // Clear any stale persisted preview flag from earlier builds so the next cold
  // start retries the cloud backend instead of being trapped in preview mode.
  previewStorage.removeItem(PREVIEW_MODE_KEY);
  sessionLocalFallback = true;
  window.plannerApi = undefined as any;
  installBrowserFallback();
}

export function installBrowserFallback() {
  if (window.plannerApi) return;

  const forceLocalPreview = sessionLocalFallback || configurePreviewMode();
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  if (!forceLocalPreview && supabaseUrl && supabaseAnonKey) {
    void import("./supabasePlannerApi")
      .then(({ createSupabasePlannerApi }) => {
        try {
          window.plannerApi = createSupabasePlannerApi(supabaseUrl, supabaseAnonKey);
        } catch (err) {
          console.error("Failed to create Supabase planner API, falling back to local preview:", err);
          installLocalPreview();
        }
      })
      .catch((err) => {
        console.error("Failed to load Supabase planner API, falling back to local preview:", err);
        installLocalPreview();
      });
    return;
  }

  function installLocalPreview() {
  const readSettings = () => {
    return parseLocalPreviewSettings(previewStorage.getItem(PREVIEW_SETTINGS_KEY));
  };

  const writeSettings = (settings: Partial<Settings>) => {
    const prev = readSettings();
    const next = normalizeSettings({ ...prev, ...settings, hasApiKey: false, apiKeyPreview: "" });
    previewStorage.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(next));
    return next;
  };

  const api: PlannerApi = {
    getAuthState: async () => ({ mode: "local", user: null, configured: false }),
    getBootstrap: async () => ({
      auth: { mode: "local", user: null, configured: false },
      data: read(),
      settings: readSettings(),
    }),
    getData: async () => read(),
    saveData: async (data) => write(data),
    applyActions: async (actions: AiAction[]) => {
      const data = read();
      const applied: Array<{ type: string; id: string; title: string }> = [];
      for (const action of actions) {
        if (action.type === "add_task" && action.title && action.dueDate) {
          const task: any = {
            id: uid("task"),
            title: action.title,
            dueDate: action.dueDate,
            category: action.category || "personal",
            priority: action.priority || "medium",
            notes: action.notes || "",
            goalId: action.goalId || "goal_admission",
            completed: false,
            createdAt: now(),
            updatedAt: now(),
          };
          if (Array.isArray(action.subtasks) && action.subtasks.length > 0) {
            task.subtasks = action.subtasks.map((subtask: any) => ({
              id: uid("sub"),
              title: String(subtask.title || subtask),
              completed: false,
              createdAt: now(),
            }));
          }
          data.tasks.push(task);
          applied.push({ type: "add_task", id: task.id, title: task.title });
        }
        if (action.type === "add_note" && action.content) {
          const note = { id: uid("note"), content: action.content, createdAt: now(), tags: action.tags || [] };
          data.notes.push(note);
          applied.push({ type: "add_note", id: note.id, title: note.content.slice(0, 30) });
        }
        if (action.type === "add_memory" && action.content) {
          const memory = { id: uid("memory"), content: action.content, createdAt: now(), updatedAt: now(), tags: action.tags || [], source: "auto" as const };
          data.aiMemories = data.aiMemories || [];
          data.aiMemories.push(memory);
          applied.push({ type: "add_memory", id: memory.id, title: memory.content.slice(0, 30) });
        }
      }
      return { data: write(data), applied };
    },
    resetSeed: async () => {
      previewStorage.setItem(`planner-preview-backup-${new Date().toISOString()}`, JSON.stringify(read()));
      return write(fallbackData());
    },
    getSettings: async () => readSettings(),
    saveSettings: async (settings) => writeSettings(settings),
    selectBackgroundImage: async () => ({ path: "" }),
  };

  window.plannerApi = api;
  }

  installLocalPreview();
}
