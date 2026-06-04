import type { AiAction, PlannerApi, PlannerData, Settings } from "./types";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export function normalizeData(data: PlannerData): PlannerData {
  const isDefaultSeedTask = (task: any) => {
    const title = String(task?.title || "");
    return (
      task?.goalId === "goal_admission" &&
      !task?.projectId &&
      !task?.notes &&
      (
        title.includes("ESAT/TARA") ||
        title.includes("启动 ESAT") ||
        title.includes("训练计划") ||
        title.includes("英国 PS") ||
        title.includes("PS 第一版")
      )
    );
  };
  return {
    ...data,
    projects: (data.projects || []).map((project) => ({
      ...project,
      color: project.color || "#C69CF9",
      importance: project.importance || "high",
      urgency: project.urgency || "low"
    })),
    longTasks: data.longTasks || [],
    aiMemories: data.aiMemories || [],
    drafts: (data.drafts || [])
      .filter((draft) => draft.title && !draft.details?.startsWith("[预设]"))
      .slice(-10),
    events: (data.events || []).map((event) => ({
      ...event,
      date: event.date || event.startDate || new Date().toISOString().slice(0, 10),
      startDate: event.startDate || event.date || new Date().toISOString().slice(0, 10),
      endDate: event.endDate || event.startDate || event.date || new Date().toISOString().slice(0, 10),
      startTime: event.startTime || "",
      endTime: event.endTime || ""
    })),
    taskLayouts: data.taskLayouts || {},
    tasks: data.tasks
      .filter((task) => !isDefaultSeedTask(task))
      .map((task) => ({
        ...task,
        subtasks: (task.subtasks || []).map((subtask: any, index: number) => ({
          ...subtask,
          id: subtask.id || uid("sub"),
          title: subtask.title || "",
          completed: typeof subtask.completed === "boolean" ? subtask.completed : Boolean(subtask.done),
          done: typeof subtask.done === "boolean" ? subtask.done : Boolean(subtask.completed),
          order: typeof subtask.order === "number" ? subtask.order : index,
          createdAt: subtask.createdAt || now()
        })),
        notes: task.notes || ""
      }))
  };
}

export function fallbackData(): PlannerData {
  return normalizeData({
    version: 1,
    importedSeedVersion: "browser-preview",
    generatedAt: now(),
    goals: [
      {
        id: "goal_admission",
        title: "2027 Entry 英美工程方向申请",
        description: "工程、机器人、航空航天、软硬件结合申请规划。",
        targetDate: "2027-05-01",
        status: "active"
      }
    ],
    projects: [],
    tasks: [],
    longTasks: [],
    events: [
      { id: uid("event"), title: "ESAT", date: "2026-10-12", category: "exam", details: "中国/港澳 October sitting: 10 月 12-13 日。", imported: true, createdAt: now() },
      { id: uid("event"), title: "TARA", date: "2026-10-14", category: "exam", details: "UCL Robotics and AI 2027 cycle 要求。", imported: true, createdAt: now() },
      { id: uid("event"), title: "剑桥 UCAS 截止", date: "2026-10-15", category: "uk", details: "2027 Entry 常规本科申请截止。", imported: true, createdAt: now() },
      { id: uid("event"), title: "UCAS 常规截止", date: "2027-01-13", category: "uk", details: "2027 Entry equal consideration deadline。", imported: true, createdAt: now() }
    ],
    notes: [
      { id: uid("note"), content: "浏览器预览模式：正式 exe 会使用本机应用数据目录保存。", createdAt: now(), tags: ["预览"] }
    ],
    drafts: [],
    chat: [],
    aiMemories: [],
    taskLayouts: {}
  });
}

function read(): PlannerData {
  const raw = localStorage.getItem("planner-preview-data");
  if (!raw) {
    const data = fallbackData();
    localStorage.setItem("planner-preview-data", JSON.stringify(data));
    return data;
  }
  return normalizeData(JSON.parse(raw));
}

function write(data: PlannerData): PlannerData {
  const saved = { ...data, savedAt: now() };
  localStorage.setItem("planner-preview-data", JSON.stringify(saved));
  return saved;
}

export function installBrowserFallback() {
  if (window.plannerApi) return;
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    void import("./supabasePlannerApi").then(({ createSupabasePlannerApi }) => {
      window.plannerApi = createSupabasePlannerApi(supabaseUrl, supabaseAnonKey);
    });
    return;
  }
  const defaultSettings: Settings = {
    activeMode: "execute",
    planningView: "tree",
    aiDockOpen: false,
    appTitle: "NavoPath",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/chat/completions",
    hasApiKey: false,
    apiKeyPreview: "",
    displayName: "陈潇杨",
    dailyFocusTime: "20:00",
    weekStartsOn: 0 as 0 | 1,
    theme: "light" as const,
    accentColor: "#175cd3",
    executeAccentColor: "#C69CF9",
    planningAccentColor: "#CAFF72",
    themeGradientEnabled: true,
    aiTone: "direct" as const,
    hideCompleted: false,
    reminderLeadDays: 7,
    taskNoteDisplay: "summary" as const,
    glassEnabled: false,
    backgroundImagePath: "",
    glassBlur: 18,
    glassOpacity: 88,
    backgroundDim: 12,
    collapsedPanels: [] as string[],
    collapsedSections: [] as string[],
    panelWidths: { left: 310, right: 360 },
    chatMessageMaxHeight: 220,
    aiMemoryEnabled: true,
    addAdvancedOpen: false
  };
  const readSettings = () => {
    const stored: any = JSON.parse(localStorage.getItem("planner-preview-settings") || "{}");
    const merged: any = { ...defaultSettings, ...stored };
    // Restore hasApiKey/apiKeyPreview from stored _apiKey
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
      hasApiKey: Boolean(apiKey)
    };
    localStorage.setItem("planner-preview-settings", JSON.stringify(next));
    // Strip raw key before returning to renderer
    const safe: any = { ...next };
    delete safe._apiKey;
    return safe;
  };
  const api: PlannerApi = {
    getAuthState: async () => ({ mode: "local", user: null, configured: false }),
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
            updatedAt: now()
          };
          if (Array.isArray(action.subtasks) && action.subtasks.length > 0) {
            task.subtasks = action.subtasks.map((st: any) => ({
              id: uid("sub"),
              title: String(st.title || st),
              completed: false,
              createdAt: now()
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
      const stored: any = JSON.parse(localStorage.getItem("planner-preview-settings") || "{}");
      const apiKey: string = stored._apiKey || "";
      if (!apiKey) {
        return { reply: "请先在设置中配置 DeepSeek API Key。", actions: [] };
      }
      const hasSystemMessage = payload.messages.length > 0 && payload.messages[0].role === "system";
      const messages: Array<{ role: string; content: string }> = [
        ...(hasSystemMessage
          ? []
          : [{ role: "system", content: "你是留学升学顾问助手。如需创建任务/事件/笔记/记忆，只返回纯JSON（不要用```代码块，不要加前缀文字）：{\"reply\":\"...\",\"actions\":[{\"type\":\"add_task\",\"title\":\"...\",\"dueDate\":\"YYYY-MM-DD\",\"category\":\"exam|uk|us|essay|materials|project|personal\",\"priority\":\"high|medium|low\",\"notes\":\"目标：...\\n衡量：...\\n行动：...\\n资料：...\\n完成标准：...\",\"subtasks\":[{\"title\":\"子任务\"}]}]}。纯聊天直接返回文字。任务notes必须SMART五段。子任务标题15字以内。action有add_task/reschedule_task/add_event/add_note/add_memory。除add_memory外不要说已执行。" }]
        ),
        ...payload.messages.slice(-10),
        ...(payload.draftText ? [{ role: "user", content: payload.draftText }] : [])
      ];
      try {
        const res = await fetch(settings.baseUrl || "https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: settings.model || "deepseek-chat", messages, temperature: 0.7, max_tokens: 4096 })
        });
        if (!res.ok) {
          const errorText = await res.text();
          return { reply: `API 请求失败 (${res.status})：${errorText.slice(0, 200)}`, actions: [] };
        }
        const json = await res.json();
        const replyText = json.choices?.[0]?.message?.content || "";
        // Extract JSON block (may be in ```json fence or raw {})
        const fenced = replyText.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const jsonSource = fenced ? fenced[1] : replyText;
        const firstBrace = jsonSource.indexOf("{");
        const lastBrace = jsonSource.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const parsed = JSON.parse(jsonSource.slice(firstBrace, lastBrace + 1));
            const cleanReply = (parsed.reply || replyText.replace(/```[\s\S]*?```/g, "").trim() || replyText);
            return { reply: cleanReply, actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
          } catch { /* fall through */ }
        }
        return { reply: replyText, actions: [] };
      } catch (err) {
        return { reply: `网络错误：${err instanceof Error ? err.message : String(err)}`, actions: [] };
      }
    }
  };
  window.plannerApi = api;
}
