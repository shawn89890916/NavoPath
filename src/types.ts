export type Category = "exam" | "uk" | "us" | "essay" | "materials" | "project" | "personal";
export type Priority = "high" | "medium" | "low";
export type NullablePriority = Priority | null;
export type WorkflowStatus = "backlog" | "next" | "doing" | "waiting" | "done";

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  status: "active" | "done" | "paused";
}

export interface Project {
  id: string;
  title: string;
  category: Category;
  notes: string;
  completed: boolean;
  color?: string;
  importance?: NullablePriority;
  urgency?: NullablePriority;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  done?: boolean;
  order?: number;
  createdAt: string;
  subtasks?: Subtask[];
}

export interface McpTokenMetadata {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

/** 时间轴排程记录 — 支持同一任务多次排程，每条记录独立管理状态 */
export interface TimelineRecord {
  id: string;
  taskId: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEndDate?: string;
  scheduledEnd: string;
  executionStatus: "scheduled" | "completed" | "returned_unfinished" | "cancelled";
  createdAt: string;
}

export type RecurrenceMode = "flexible" | "scheduled";
export type RecurrenceFrequency =
  | "none"
  | "daily"
  | "weekdays"
  | "weekends"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly";

export type ExecutionLane = "candidate" | "queued";

export interface TaskRecurrence {
  mode: RecurrenceMode;
  frequency: RecurrenceFrequency;
  startDate?: string;
  startTime?: string;
  durationMinutes?: number;
  endDate?: string;
  count?: number;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  category: Category;
  priority: NullablePriority;
  notes: string;
  goalId: string;
  completed: boolean;
  completedAt?: string;
  workflowStatus?: WorkflowStatus;
  parentTaskId?: string;
  projectId?: string;
  importance?: NullablePriority;
  urgency?: NullablePriority;
  estimatedHours?: number;
  order?: number;
  subtasks?: Subtask[];
  /** [DEPRECATED] Use timelineRecords instead */
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  /** 计划在今天推进的日期 (ISO) — 区别于 dueDate 和 scheduledDate */
  plannedForDate?: string;
  executionLane?: ExecutionLane;
  /** [DEPRECATED] Use timelineRecords[].executionStatus instead */
  executionStatus?: "scheduled" | "completed" | "returned_unfinished" | "cancelled";
  /** 时间轴排程记录 — 每条记录独立管理，同一任务可同时有 scheduled + returned_unfinished 等多条记录 */
  timelineRecords?: TimelineRecord[];
  recurrence?: TaskRecurrence;
  createdAt: string;
  updatedAt: string;
}

export interface LongTermTask {
  id: string;
  title: string;
  targetDate: string;
  notes: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  category: Category;
  details: string;
  recurrence?: TaskRecurrence;
  imported?: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  tags: string[];
}

export interface AiMemory {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source?: "auto" | "manual" | "conversation";
  sourceMessages?: ChatMessage[];
  pinned?: boolean;
  archived?: boolean;
}

export interface PlannerDraft {
  id: string;
  type: "task" | "event" | "project";
  title: string;
  projectId: string;
  estimatedHours: number;
  dueDate: string;
  dueTime?: string;
  endDate?: string;
  endTime?: string;
  category?: Category;
  importance?: Priority;
  urgency?: Priority;
  details: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  saved?: boolean;
  status?: "thinking" | "done" | "error";
  steps?: Array<{ label: string; status: "pending" | "running" | "done" | "error" }>;
  actions?: unknown[];
  selectedActions?: Record<number, boolean>;
  actionState?: "pending" | "adopted" | "rejected" | "undone";
  intent?: string;
  plan?: Array<{ taskId?: string; title: string; start: string; end: string; durationMinutes?: number; reason?: string }>;
  format?: "text" | "markdown";
}

export interface AiConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  title: string;
  defaultDurationMinutes: number;
  archived?: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitDailyState {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  completedAt?: string;
  timelineRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  projectId?: string;
  timelineRecordId?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  source: "timer" | "manual" | "idle_adjusted";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplateSlot {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface ScheduleTemplate {
  id: string;
  title: string;
  slots: ScheduleTemplateSlot[];
  createdAt: string;
  updatedAt: string;
}

export interface PlannerData {
  version: number;
  importedSeedVersion: string;
  generatedAt: string;
  savedAt?: string;
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  habits?: Habit[];
  habitDailyStates?: HabitDailyState[];
  timeEntries?: TimeEntry[];
  longTasks: LongTermTask[];
  events: CalendarEvent[];
  notes: Note[];
  drafts: PlannerDraft[];
  chat: ChatMessage[];
  aiConversations?: AiConversation[];
  activeAiConversationId?: string;
  aiMemories: AiMemory[];
  scheduleTemplates?: ScheduleTemplate[];
  taskLayouts?: Record<string, { tree?: { x: number; y: number }; matrix?: { x: number; y: number } }>;
  sync?: { deleted: Record<string, string> };
  pluginConfigs?: Record<string, Record<string, unknown>>;
}

export type Language = "en" | "zh";

export interface Settings {
  activeMode: "execute" | "planning";
  defaultTimelineView?: "daily" | "3day" | "weekly" | "month";
  language: Language;
  planningView: "tree" | "matrix" | "split";
  aiDockOpen: boolean;
  appTitle: string;
  model: string;
  reasoningMode: "instant" | "high" | "xhigh";
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyPreview: string;
  displayName: string;
  avatarDataUrl?: string;
  onboardingVersion?: number;
  onboardingStep?: "add" | "drag" | "candidates" | "schedule" | "calendar" | "planning" | "ai" | "done";
  dailyFocusTime: string;
  weekStartsOn: 0 | 1;
  theme: "light" | "dark";
  typographyStyle: "editorial" | "balanced" | "sans";
  accentColor: string;
  executeAccentColor: string;
  planningAccentColor: string;
  aiTone: "direct" | "gentle" | "strict";
  hideCompleted: boolean;
  reminderLeadDays: number;
  taskNoteDisplay: "summary" | "collapsed" | "full";
  glassEnabled: boolean;
  backgroundImagePath: string;
  glassBlur: number;
  glassOpacity: number;
  backgroundDim: number;
  collapsedPanels: string[];
  collapsedSections: string[];
  panelWidths: {
    left: number;
    right: number;
  };
  chatMessageMaxHeight: number;
  aiMemoryEnabled: boolean;
  hideAi: boolean;
  addAdvancedOpen: boolean;
  uiStyle: "gradient" | "neumorphic";
  dayStartTime: string;
  /** 时间轴任务标题字体缩放系数（0.85 ~ 1.3）。1 表示默认大小。 */
  timelineFontScale?: number;
  /** 任务块以归属项目色整块填充（true）或仅描边（false）。 */
  taskBlockFill?: boolean;
  /** 自动同步频率（分钟）。0 或未设置表示仅手动同步。 */
  syncIntervalMinutes?: number;
  idleThresholdMinutes?: number;
  focusModeDefault?: "stopwatch" | "pomodoro" | "flowtime";
  featureKanbanViewEnabled?: boolean;
  featureQuadrantViewEnabled?: boolean;
  featureListViewEnabled?: boolean;
  /** 最近一次成功同步时间（ISO 字符串）。 */
  lastSyncedAt?: string;
  /** 已启用（已安装并激活）的插件 ID 列表。 */
  enabledPlugins?: string[];
  /** 各插件的配置数据，key 为插件 ID。 */
  pluginConfigs?: Record<string, Record<string, unknown>>;
}

export interface AiAction {
  type: "add_task" | "reschedule_task" | "add_event" | "add_note" | "add_memory";
  title?: string;
  dueDate?: string;
  date?: string;
  category?: Category;
  priority?: Priority;
  notes?: string;
  content?: string;
  tags?: string[];
  taskId?: string;
  details?: string;
  goalId?: string;
  subtasks?: { title: string }[];
}

export interface AiImportAction {
  type: "import_schedule_item";
  kind: "task" | "event";
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  category?: Category;
  priority?: Priority;
  projectId?: string;
  projectName?: string;
  notes?: string;
  recurrence?: TaskRecurrence;
  warning?: string;
}

/** Single parsed item from AI plan output — not written until user confirms */
export interface AiPlanItem {
  kind: "project" | "task" | "event";
  title: string;
  checked: boolean;
  category?: Category;
  priority?: Priority;
  dueDate?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  details?: string;
  projectTitle?: string; // task's parent project name (AI-suggested)
  subtaskTitles?: string[];
}

export interface PlannerApi {
  getAuthState?: () => Promise<{ mode: "local" | "cloud"; user: { id: string; email?: string } | null; configured: boolean }>;
  getBootstrap?: (options?: { force?: boolean }) => Promise<{
    auth: { mode: "local" | "cloud"; user: { id: string; email?: string } | null; configured: boolean };
    data: PlannerData | null;
    settings: Settings | null;
    revision?: number;
  }>;
  signUp?: (email: string, password: string) => Promise<{
    user: { id: string; email?: string } | null;
    message?: string;
    requiresEmailConfirmation?: boolean;
    email?: string;
  }>;
  signIn?: (email: string, password: string) => Promise<{ user: { id: string; email?: string } | null }>;
  resendConfirmation?: (email: string) => Promise<{ message?: string }>;
  completeEmailConfirmation?: () => Promise<{
    confirmed: boolean;
    user: { id: string; email?: string } | null;
    message?: string;
  }>;
  signOut?: () => Promise<void>;
  deleteAccount?: () => Promise<void>;
  sendPasswordResetEmail?: (email: string) => Promise<{ message?: string }>;
  resetPassword?: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  clearAuthCallbackUrl?: () => void;
  getData: () => Promise<PlannerData>;
  saveData: (data: PlannerData) => Promise<PlannerData>;
  subscribeToRemoteChanges?: (listener: (payload: { data: PlannerData; settings: Settings; revision?: number }) => void) => () => void;
  applyActions: (actions: AiAction[]) => Promise<{ data: PlannerData; applied: Array<{ type: string; id: string; title: string }> }>;
  resetSeed: () => Promise<PlannerData>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Partial<Settings> & { apiKey?: string; clearApiKey?: boolean }) => Promise<Settings>;
  listMcpTokens?: () => Promise<McpTokenMetadata[]>;
  createMcpToken?: (name: string) => Promise<{ token: string; metadata: McpTokenMetadata }>;
  revokeMcpToken?: (id: string) => Promise<void>;
  selectBackgroundImage: () => Promise<{ path: string }>;
  chat: (payload: { messages: Array<{ role: "user" | "assistant" | "system"; content: string }>; draftText?: string }) => Promise<{ reply: string; actions: AiAction[] }>;
}

export interface DesktopUpdateState {
  status: "idle" | "unsupported" | "checking" | "current" | "available" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  availableVersion: string;
  progress: number;
  message: string;
}

export interface DesktopExternalPlugin {
  id: string;
  name: string;
  nameI18n?: Partial<Record<"zh" | "en", string>>;
  description: string;
  descriptionI18n?: Partial<Record<"zh" | "en", string>>;
  enabledSummaryI18n?: Partial<Record<"zh" | "en", string>>;
  version: string;
  author: string;
  icon: string;
  permissions: Array<"tasks" | "settings" | "ui" | "events" | "calendar">;
  configFields: Array<{
    key: string;
    label: string;
    labelI18n?: Partial<Record<"zh" | "en", string>>;
    type: "boolean" | "number" | "string" | "select";
    options?: { value: string; label: string; labelI18n?: Partial<Record<"zh" | "en", string>> }[];
    min?: number;
    max?: number;
    default: unknown;
  }>;
  source: "external";
  directoryName: string;
  hasEntry: boolean;
}

export interface NavoPathPluginRuntime {
  version: string;
  pluginId: string;
  tasks: {
    getData: () => PlannerData | null;
    list: () => Task[];
    update: (taskId: string, patch: Partial<Task>) => void;
  };
  settings: {
    getConfig: () => Record<string, unknown>;
    saveConfig: (patch: Record<string, unknown>) => void;
  };
  ui: {
    toast: (message: string) => void;
    registerTool: (tool: { id: string; title: string; description?: string }) => () => void;
  };
  events: {
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, listener: (payload?: unknown) => void) => () => void;
  };
  plugins: {
    register: (plugin: { activate?: (api: NavoPathPluginRuntime) => void | (() => void); deactivate?: () => void }) => void;
  };
}

declare global {
  interface Window {
    plannerApi: PlannerApi;
    desktopApi?: {
      authStorage: {
        getItem: (key: string) => Promise<string | null>;
        setItem: (key: string, value: string) => Promise<void>;
        removeItem: (key: string) => Promise<void>;
      };
      getUpdateState: () => Promise<DesktopUpdateState>;
      checkForUpdates: () => Promise<DesktopUpdateState>;
      installUpdate: () => Promise<boolean>;
      onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
      aiChat: (payload: { messages: Array<{ role: "user" | "assistant" | "system"; content: string }>; draftText?: string }) => Promise<{ reply: string; actions: AiAction[] }>;
      getAutoLaunch: () => Promise<boolean>;
      setAutoLaunch: (enabled: boolean) => Promise<boolean>;
      listExternalPlugins?: () => Promise<{ dir: string; plugins: DesktopExternalPlugin[] }>;
      readExternalPluginEntry?: (pluginId: string) => Promise<{ id: string; code: string; path: string; missing: boolean }>;
      writeSnapshot?: (payload: { data?: PlannerData | null; settings?: Partial<Settings> | null; authUser?: { id?: string; email?: string } | null }) => Promise<{ ok: boolean; path?: string; stampedPath?: string; error?: string }>;
      readLatestSnapshot?: () => Promise<{ ok: boolean; payload?: { exportedAt?: string; appVersion?: string; data?: PlannerData | null; settings?: Settings | null; authUser?: { id?: string; email?: string } | null }; reason?: string; error?: string }>;
      isDesktop: () => boolean;
    };
    navopath?: NavoPathPluginRuntime;
  }
}
