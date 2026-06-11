import type { AiAction, PlannerApi, PlannerData, Settings, TaskRecurrence } from "./types";

const PREVIEW_STORAGE_KEY = "planner-preview-data";
const PREVIEW_SETTINGS_KEY = "planner-preview-settings";
const PREVIEW_MODE_KEY = "navopath-force-local-preview";
const PREVIEW_SEED_VERSION = "browser-preview-v2";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
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

function configurePreviewMode() {
  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview");
  if (preview === "local") localStorage.setItem(PREVIEW_MODE_KEY, "1");
  if (preview === "cloud" || preview === "off") localStorage.removeItem(PREVIEW_MODE_KEY);
  return preview === "local" || localStorage.getItem(PREVIEW_MODE_KEY) === "1";
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
  return {
    ...data,
    projects: (data.projects || []).map((project) => ({
      ...project,
      color: project.color || "#C69CF9",
      importance: project.importance || "high",
      urgency: project.urgency || "low",
    })),
    longTasks: data.longTasks || [],
    aiMemories: data.aiMemories || [],
    drafts: (data.drafts || []).filter((draft) => draft.title).slice(-10),
    events: (data.events || []).map((event) => ({
      ...event,
      date: event.date || event.startDate || localIso(new Date()),
      startDate: event.startDate || event.date || localIso(new Date()),
      endDate: event.endDate || event.startDate || event.date || localIso(new Date()),
      startTime: event.startTime || "",
      endTime: event.endTime || "",
    })),
    taskLayouts: data.taskLayouts || {},
    tasks: (data.tasks || []).map((task) => ({
      ...task,
      subtasks: (task.subtasks || []).map((subtask, index) => ({
        ...subtask,
        id: subtask.id || uid("sub"),
        title: subtask.title || "",
        completed: typeof subtask.completed === "boolean" ? subtask.completed : Boolean(subtask.done),
        done: typeof subtask.done === "boolean" ? subtask.done : Boolean(subtask.completed),
        order: typeof subtask.order === "number" ? subtask.order : index,
        createdAt: subtask.createdAt || now(),
      })),
      notes: task.notes || "",
    })),
  };
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

function read(): PlannerData {
  const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
  if (!raw) {
    const data = fallbackData();
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  const parsed = normalizeData(JSON.parse(raw));
  if (parsed.importedSeedVersion !== PREVIEW_SEED_VERSION) {
    const data = fallbackData();
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  return parsed;
}

function write(data: PlannerData): PlannerData {
  const saved = { ...data, savedAt: now() };
  localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

export function installBrowserFallback() {
  if (window.plannerApi) return;

  const forceLocalPreview = configurePreviewMode();
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  if (!forceLocalPreview && supabaseUrl && supabaseAnonKey) {
    void import("./supabasePlannerApi").then(({ createSupabasePlannerApi }) => {
      window.plannerApi = createSupabasePlannerApi(supabaseUrl, supabaseAnonKey);
    });
    return;
  }

  const defaultSettings: Settings = {
    activeMode: "execute",
    defaultTimelineView: "daily",
    planningView: "tree",
    aiDockOpen: false,
    appTitle: "NavoPath",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/chat/completions",
    hasApiKey: false,
    apiKeyPreview: "",
    displayName: "NavoPath Preview",
    dailyFocusTime: "20:00",
    weekStartsOn: 0,
    theme: "dark",
    accentColor: "#175cd3",
    executeAccentColor: "#C69CF9",
    planningAccentColor: "#CAFF72",
    aiTone: "direct",
    hideCompleted: false,
    reminderLeadDays: 7,
    taskNoteDisplay: "summary",
    glassEnabled: false,
    backgroundImagePath: "",
    glassBlur: 18,
    glassOpacity: 88,
    backgroundDim: 12,
    collapsedPanels: [],
    collapsedSections: [],
    panelWidths: { left: 310, right: 360 },
    chatMessageMaxHeight: 220,
    aiMemoryEnabled: true,
    hideAi: false,
    addAdvancedOpen: false,
    uiStyle: "gradient",
  };

  const readSettings = () => {
    const stored: any = JSON.parse(localStorage.getItem(PREVIEW_SETTINGS_KEY) || "{}");
    const merged: any = { ...defaultSettings, ...stored };
    if (merged._apiKey && !merged.hasApiKey) {
      merged.hasApiKey = true;
      merged.apiKeyPreview = merged.apiKeyPreview || `${merged._apiKey.slice(0, 6)}...${merged._apiKey.slice(-4)}`;
    }
    return merged;
  };

  const writeSettings = (settings: any) => {
    const prev = readSettings();
    let apiKey: string = prev._apiKey || "";
    let apiKeyPreview = prev.apiKeyPreview || "";
    if (settings.apiKey) {
      apiKey = settings.apiKey;
      apiKeyPreview = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
    }
    const next = {
      ...prev,
      ...settings,
      _apiKey: apiKey,
      apiKeyPreview,
      hasApiKey: Boolean(apiKey),
    };
    localStorage.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(next));
    const safe: any = { ...next };
    delete safe._apiKey;
    return safe;
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
          const memory = { id: uid("memory"), content: action.content, createdAt: now(), updatedAt: now(), tags: action.tags || [] };
          data.aiMemories = data.aiMemories || [];
          data.aiMemories.push(memory);
          applied.push({ type: "add_memory", id: memory.id, title: memory.content.slice(0, 30) });
        }
      }
      return { data: write(data), applied };
    },
    resetSeed: async () => {
      localStorage.setItem(`planner-preview-backup-${new Date().toISOString()}`, JSON.stringify(read()));
      return write(fallbackData());
    },
    getSettings: async () => readSettings(),
    saveSettings: async (settings) => writeSettings(settings),
    selectBackgroundImage: async () => ({ path: "" }),
    chat: async (payload: { messages: Array<{ role: string; content: string }>; draftText?: string }) => {
      const settings = readSettings();
      const stored: any = JSON.parse(localStorage.getItem(PREVIEW_SETTINGS_KEY) || "{}");
      const apiKey: string = stored._apiKey || "";
      if (!apiKey) {
        return { reply: "请先在本地预览设置里配置 DeepSeek API Key。", actions: [] };
      }

      const hasSystemMessage = payload.messages.length > 0 && payload.messages[0].role === "system";
      const messages: Array<{ role: string; content: string }> = [
        ...(hasSystemMessage
          ? []
          : [{
            role: "system",
            content: "你是 NavoPath 助手。需要创建任务/备注/记忆时，只返回 JSON：{\"reply\":\"...\",\"actions\":[...]}。",
          }]),
        ...payload.messages.slice(-10),
        ...(payload.draftText ? [{ role: "user", content: payload.draftText }] : []),
      ];

      try {
        const res = await fetch(settings.baseUrl || "https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model || "deepseek-chat",
            messages,
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          return { reply: `API 请求失败 (${res.status})：${errorText.slice(0, 200)}`, actions: [] };
        }

        const json = await res.json();
        const replyText = json.choices?.[0]?.message?.content || "";
        const fenced = replyText.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const jsonSource = fenced ? fenced[1] : replyText;
        const firstBrace = jsonSource.indexOf("{");
        const lastBrace = jsonSource.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const parsed = JSON.parse(jsonSource.slice(firstBrace, lastBrace + 1));
            const cleanReply = parsed.reply || replyText.replace(/```[\s\S]*?```/g, "").trim() || replyText;
            return { reply: cleanReply, actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
          } catch {
            // fall through to plain reply
          }
        }

        return { reply: replyText, actions: [] };
      } catch (err) {
        return { reply: `网络错误：${err instanceof Error ? err.message : String(err)}`, actions: [] };
      }
    },
  };

  window.plannerApi = api;
}
