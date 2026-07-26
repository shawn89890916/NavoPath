import type { AiAction, PlannerApi, PlannerData, Settings, Subtask, Task, TaskRecurrence } from "./types";
import { normalizeSettings } from "./defaultSettings";
import { normalizeTreeOrder } from "./utils/treeOrder";
import { inferWorkflowStatus, normalizeTimeEntry } from "./utils/productivity";
import { normalizePlannerDataForClient } from "./utils/dataNormalization";

const PREVIEW_STORAGE_KEY = "planner-preview-data";
const PREVIEW_SETTINGS_KEY = "planner-preview-settings";
const PREVIEW_MODE_KEY = "navopath-force-local-preview";
const PREVIEW_SEED_VERSION = "browser-preview-v3";

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

function normalizeSubtasks(value: unknown): Subtask[] {
  return recordItems<Subtask>(value).map((subtask, index) => ({
    ...subtask,
    id: subtask.id || uid("sub"),
    title: subtask.title || "",
    completed: typeof subtask.completed === "boolean" ? subtask.completed : Boolean(subtask.done),
    done: typeof subtask.done === "boolean" ? subtask.done : Boolean(subtask.completed),
    order: typeof subtask.order === "number" ? subtask.order : index,
    createdAt: subtask.createdAt || now(),
    subtasks: subtask.subtasks ? normalizeSubtasks(subtask.subtasks) : undefined,
  }));
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
    const startDate = event.startDate || event.date || localIso(new Date());
    const endDate = event.endDate || startDate;
    if (event.startTime || event.recurrence) {
      const task = makeTask(event, startDate, "primary");
      if (!existing.has(task.id)) migrated.push(task);
      continue;
    }
    for (let date = startDate, index = 0; date <= endDate && index < 366; date = addDays(date, 1), index += 1) {
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
    goals: recordItems(data.goals),
    projects: recordItems(data.projects).filter((project) => typeof project.id === "string" && typeof project.title === "string"),
    tasks: recordItems(data.tasks).filter((task) => typeof task.id === "string" && typeof task.title === "string"),
    habits: recordItems(data.habits),
    habitDailyStates: recordItems(data.habitDailyStates),
    timeEntries: recordItems(data.timeEntries),
    longTasks: recordItems(data.longTasks),
    events: recordItems(data.events).filter((event) => typeof event.id === "string" && typeof event.title === "string"),
    notes: recordItems(data.notes),
    drafts: recordItems(data.drafts),
    chat: recordItems(data.chat),
    aiConversations: recordItems(data.aiConversations),
    aiMemories: recordItems(data.aiMemories),
    scheduleTemplates: recordItems(data.scheduleTemplates),
    aiProfile: isRecord(data.aiProfile) ? data.aiProfile : undefined,
    taskLayouts: isRecord(data.taskLayouts) ? data.taskLayouts as PlannerData["taskLayouts"] : {},
  };
  const migratedTasks = migrateEventsToTasks(safeData);
  const chat = safeData.chat.map((message) => ({
    ...message,
    id: message.id || uid("chat"),
    saved: Boolean(message.saved),
  }));
  const aiConversations = (safeData.aiConversations && safeData.aiConversations.length > 0)
    ? safeData.aiConversations.map((conversation) => ({
      ...conversation,
      id: conversation.id || uid("conversation"),
      title: conversation.title || "AI 对话",
      messages: recordItems<PlannerData["chat"][number]>(conversation.messages).map((message) => ({
        ...message,
        id: message.id || uid("chat"),
        saved: Boolean(message.saved),
      })),
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
  return normalizePlannerDataForClient(normalizeTreeOrder({
    ...safeData,
    projects: safeData.projects.map((project) => ({
      ...project,
      color: project.color || "#584D3D",
      importance: project.importance || "high",
      urgency: project.urgency || "low",
    })),
    longTasks: safeData.longTasks,
    chat,
    aiConversations,
    activeAiConversationId: safeData.activeAiConversationId || aiConversations[0]?.id,
    aiMemories: safeData.aiMemories.map((memory) => ({
      ...memory,
      id: memory.id || uid("memory"),
      tags: Array.isArray(memory.tags) ? memory.tags.filter((tag): tag is string => typeof tag === "string") : [],
      source: memory.source || "auto",
      sourceMessages: recordItems<PlannerData["chat"][number]>(memory.sourceMessages).map((message) => ({
        ...message,
        id: message.id || uid("chat"),
        saved: true,
      })),
      pinned: Boolean(memory.pinned),
      archived: Boolean(memory.archived),
    })),
    scheduleTemplates: (safeData.scheduleTemplates || []).map((template) => ({
      ...template,
      id: template.id || uid("template"),
      title: template.title || "Template",
      slots: recordItems<NonNullable<PlannerData["scheduleTemplates"]>[number]["slots"][number]>(template.slots).map((slot) => ({
        ...slot,
        id: slot.id || uid("slot"),
        label: slot.label || "Period",
      })),
      createdAt: template.createdAt || now(),
      updatedAt: template.updatedAt || template.createdAt || now(),
    })),
    timeEntries: (safeData.timeEntries || [])
      .map((entry) => normalizeTimeEntry(entry, safeData.tasks))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    drafts: safeData.drafts.filter((draft) => draft.title).slice(-10),
    version: Math.max(safeData.version || 1, 2),
    events: [],
    tasks: [...safeData.tasks, ...migratedTasks].map((task) => ({
      ...task,
      completedAt: task.completed ? task.completedAt || task.updatedAt || task.dueDate || task.createdAt : undefined,
      workflowStatus: inferWorkflowStatus(task),
      timelineRecords: recordItems(task.timelineRecords),
      subtasks: normalizeSubtasks(task.subtasks),
      notes: task.notes || "",
    })),
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
