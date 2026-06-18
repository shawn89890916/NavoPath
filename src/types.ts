export type Category = "exam" | "uk" | "us" | "essay" | "materials" | "project" | "personal";
export type Priority = "high" | "medium" | "low";

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
  importance?: Priority;
  urgency?: Priority;
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
  priority: Priority;
  notes: string;
  goalId: string;
  completed: boolean;
  parentTaskId?: string;
  projectId?: string;
  importance?: Priority;
  urgency?: Priority;
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
}

export interface AiConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
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
  longTasks: LongTermTask[];
  events: CalendarEvent[];
  notes: Note[];
  drafts: PlannerDraft[];
  chat: ChatMessage[];
  aiConversations?: AiConversation[];
  activeAiConversationId?: string;
  aiMemories: AiMemory[];
  taskLayouts?: Record<string, { tree?: { x: number; y: number }; matrix?: { x: number; y: number } }>;
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
  getBootstrap?: () => Promise<{
    auth: { mode: "local" | "cloud"; user: { id: string; email?: string } | null; configured: boolean };
    data: PlannerData | null;
    settings: Settings | null;
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

declare global {
  interface Window {
    plannerApi: PlannerApi;
  }
}
