import React, { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CalendarEvent, Category, PlannerApi, PlannerData, Priority, Project, Settings, Task } from "./types";
import { installBrowserFallback } from "./browserFallback";
import "./styles.css";

installBrowserFallback();

const todayIso = () => localIso(new Date());
const TIMELINE_START = 0;
const TIMELINE_END = 24;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 20;
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);
const TIME_OPTIONS = Array.from({ length: ((TIMELINE_END - TIMELINE_START) * 60) / SLOT_MINUTES }, (_, index) => {
  return minutesToTime(TIMELINE_START * 60 + index * SLOT_MINUTES);
});
const categories: Record<Category, { label: string; color: string }> = {
  exam: { label: "考试", color: "#8B5CF6" },
  uk: { label: "英国申请", color: "#C69CF9" },
  us: { label: "美国申请", color: "#7C3AED" },
  essay: { label: "文书", color: "#EC4899" },
  materials: { label: "材料", color: "#22C55E" },
  project: { label: "项目", color: "#CAFF72" },
  personal: { label: "个人", color: "#64748B" }
};
const priorityLabel: Record<Priority, string> = { high: "高", medium: "中", low: "低" };
const categoryOrder: Category[] = ["exam", "project", "essay", "materials", "uk", "us", "personal"];

type Mode = "execute" | "planning";
type AddType = "task" | "project" | "event";
type TimelineView = "daily" | "3day" | "weekly" | "month";
type AiPlanPrefs = { source: "today" | "all"; scope: "day" | "3day"; strategy: "simple" | "priority" | "deadline" };
type DragState = { taskId: string; kind: "candidate" | "block"; duration: number; offsetMinutes?: number; pointer?: { x: number; y: number }; outsideTimeline?: boolean } | null;
type ResizePreview = { taskId: string; start: string; end: string } | null;
type ScheduleSuggestion = { id: string; taskId: string; startTime: string; endTime: string; reason: string; nextAction?: string; ignored?: boolean };
type QuickSchedule = { startTime: string; title: string; projectId: string } | null;
type PlanPickPriority = "must" | "should" | "could";
type AuthState = { mode: "local" | "cloud"; user: { id: string; email?: string } | null; configured: boolean };
type FormState = {
  title: string;
  projectId: string;
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

function displayDateTitle(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  return `${date.getDate()} ${weekday}`;
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
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
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

function extractNextAction(notes = "") {
  const match = notes.match(/下一步[:：]\s*(.+?)(?:\n|$)/);
  return match?.[1]?.trim() || "";
}

function replaceNextAction(notes: string, nextAction: string) {
  const line = `下一步：${nextAction.trim()}`;
  if (/下一步[:：]/.test(notes)) return notes.replace(/下一步[:：].*(?:\n|$)/, `${line}\n`).trim();
  return [line, notes].filter(Boolean).join("\n");
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

function defaultForm(type: AddType = "task"): FormState {
  const today = todayIso();
  return {
    title: "",
    projectId: "",
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
    estimatedHours: form.estimatedHours || undefined,
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

function ProductIcon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dayflow-icon ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src="/dayflow-icon.png" alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
    </div>
  );
}

function AuthGate(props: {
  busy: boolean;
  error: string;
  onSubmit: (email: string, password: string, intent: "signin" | "signup") => Promise<void>;
}) {
  const [intent, setIntent] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          void props.onSubmit(email.trim(), password, intent);
        }}>
          <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={intent === "signin" ? "current-password" : "new-password"} minLength={6} required /></label>
          {props.error && <p className="df-auth-error">{props.error}</p>}
          <button className="df-auth-submit" type="submit" disabled={props.busy || !email.trim() || password.length < 6}>
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
  const [sourceOpen, setSourceOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [planningPickMode, setPlanningPickMode] = useState(false);
  const [planningPicks, setPlanningPicks] = useState<Record<string, PlanPickPriority>>({});
  const [toast, setToast] = useState("");
  const [showCompletedCandidates, setShowCompletedCandidates] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const suppressBlockClickRef = useRef(false);

  async function loadInitial() {
    const api = await waitForPlannerApi();
    const nextAuth = await api.getAuthState?.();
    const resolvedAuth = nextAuth || { mode: "local" as const, user: null, configured: false };
    setAuthState(resolvedAuth);
    if (resolvedAuth.mode === "cloud" && !resolvedAuth.user) {
      setData(null);
      setSettings(null);
      return;
    }
    const [nextData, nextSettings] = await Promise.all([api.getData(), api.getSettings()]);
    setData(nextData);
    setSettings(nextSettings);
    setModeState((nextSettings.activeMode as Mode) || "execute");
    setAdvancedOpen(Boolean(nextSettings.addAdvancedOpen));
  }

  useEffect(() => {
    void loadInitial().catch((error) => {
      setAuthError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  async function handleAuthSubmit(email: string, password: string, intent: "signin" | "signup") {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      const response = intent === "signup"
        ? await api.signUp?.(email, password)
        : await api.signIn?.(email, password);
      await loadInitial();
      if (response && "message" in response && typeof response.message === "string") setAuthError(response.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    const api = await waitForPlannerApi();
    await api.signOut?.();
    setData(null);
    setSettings(null);
    await loadInitial();
  }

  useEffect(() => {
    if (mode !== "execute" || !data || !timelineRef.current) return;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const fallbackMinutes = 9 * 60;
    const targetMinutes = selectedDate === todayIso() && currentMinutes >= TIMELINE_START * 60 && currentMinutes <= TIMELINE_END * 60
      ? currentMinutes
      : fallbackMinutes;
    const targetTop = ((targetMinutes - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
    const container = timelineRef.current;
    container.scrollTop = Math.max(0, targetTop - container.clientHeight * 0.42);
  }, [mode, data, selectedDate]);

  useEffect(() => {
    if (!quickSchedule) return;
    const cancelQuickSchedule = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".df-quick-schedule") || target.closest(".df-timeline-canvas")) return;
      setQuickSchedule(null);
    };
    document.addEventListener("mousedown", cancelQuickSchedule);
    return () => document.removeEventListener("mousedown", cancelQuickSchedule);
  }, [quickSchedule]);

  async function saveData(next: PlannerData) {
    const saved = await window.plannerApi.saveData(next);
    setData(saved);
  }

  async function saveSettings(patch: Partial<Settings>) {
    const saved = await window.plannerApi.saveSettings(patch);
    setSettings(saved);
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

  function projectSnapshot(list: Project[], title: string) {
    const cleanTitle = title.trim();
    const existing = list.find((project) => project.title.toLowerCase() === cleanTitle.toLowerCase());
    if (existing) return { projectId: existing.id, projects: list, created: false };
    const project = makeProject({ ...defaultForm("project"), title: cleanTitle });
    return { projectId: project.id, projects: [...list, project], created: true };
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    if (!data) return;
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task)
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

  function openQuickSchedule(clientY: number) {
    const startTime = slotFromPointer(clientY);
    setQuickSchedule({ startTime, title: "", projectId: "" });
  }

  function saveQuickSchedule() {
    if (!data || !quickSchedule?.title.trim()) return;
    const endTime = addMinutes(quickSchedule.startTime, 60);
    if (hasScheduleConflict(quickSchedule.startTime, endTime)) {
      showToast("这个时间和已有安排冲突");
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
    const rect = timelineCanvasRef.current?.getBoundingClientRect();
    if (!rect) return "09:00";
    const y = clientY - rect.top;
    const raw = TIMELINE_START * 60 + (y / SLOT_HEIGHT) * SLOT_MINUTES - offsetMinutes;
    return minutesToTime(clampSlot(raw));
  }

  function pointerOutsideTimeline(clientX: number, clientY: number) {
    const rect = timelineCanvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return clientX < rect.left - 80 || clientX > rect.right + 80 || clientY < rect.top - 40 || clientY > rect.bottom + 40;
  }

  function scheduleTask(taskId: string, startTime: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const duration = taskDuration(task);
    const endTime = addMinutes(startTime, duration);
    if (hasScheduleConflict(startTime, endTime, taskId)) {
      showToast("这个时间和已有安排冲突");
      setHoverSlot("");
      setDrag(null);
      return;
    }
    updateTask(taskId, {
      plannedForDate: today,
      scheduledDate: timelineDate,
      scheduledStart: startTime,
      scheduledEnd: endTime
    });
    showToast("已安排到时间轴");
    setHoverSlot("");
    setDrag(null);
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
        setDrag({ taskId: task.id, kind: "block", duration, offsetMinutes, pointer: { x: moveEvent.clientX, y: moveEvent.clientY }, outsideTimeline: pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY) });
      }
      const outsideTimeline = pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY);
      setDrag((current) => current && current.taskId === task.id ? { ...current, pointer: { x: moveEvent.clientX, y: moveEvent.clientY }, outsideTimeline } : current);
      setHoverSlot(outsideTimeline ? "" : slotFromPointer(moveEvent.clientY, offsetMinutes));
    };
    const up = (upEvent: MouseEvent) => {
      if (active) {
        const leftPanel = document.querySelector(".df-candidate-panel")?.getBoundingClientRect();
        if ((leftPanel && upEvent.clientX >= leftPanel.left && upEvent.clientX <= leftPanel.right && upEvent.clientY >= leftPanel.top && upEvent.clientY <= leftPanel.bottom) || pointerOutsideTimeline(upEvent.clientX, upEvent.clientY)) {
          unscheduleTask(task.id);
        } else {
          scheduleTask(task.id, slotFromPointer(upEvent.clientY, offsetMinutes));
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
        if (hasScheduleConflict(nextStart, nextEnd, task.id)) {
          showToast("这个时长会和已有安排冲突");
        } else {
          updateTask(task.id, {
            scheduledStart: nextStart,
            estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60
          });
          showToast("已调整时长");
        }
      } else {
        const nextStart = task.scheduledStart || minutesToTime(start);
        const nextEnd = minutesToTime(Math.max(slotMin, start + SLOT_MINUTES));
        if (hasScheduleConflict(nextStart, nextEnd, task.id)) {
          showToast("这个时长会和已有安排冲突");
        } else {
          updateTask(task.id, {
            scheduledEnd: nextEnd,
            estimatedHours: (timeToMinutes(nextEnd) - timeToMinutes(nextStart)) / 60
          });
          showToast("已调整时长");
        }
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
    setForm({ ...defaultForm("project"), title: project.title, category: project.category, details: project.notes, importance: project.importance || "high", urgency: project.urgency || "low" });
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
            estimatedHours: form.estimatedHours || undefined,
            importance: form.importance,
            urgency: form.urgency,
            notes: form.details,
            updatedAt: now
          } : task)
        });
      } else if (addType === "project") {
        void saveData({ ...data, projects: data.projects.map((project) => project.id === editingId ? { ...project, title: form.title.trim(), category: form.category, notes: form.details, importance: form.importance, urgency: form.urgency, updatedAt: now } : project) });
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

  if (authState?.mode === "cloud" && !authState.user) {
    return <AuthGate busy={authBusy} error={authError} onSubmit={handleAuthSubmit} />;
  }

  if (!data || !settings) return <div className="df-loading"><ProductIcon />NavoPath 加载中...</div>;

  return (
    <div className={`df-app mode-${mode}`}>
      <header className="df-header">
        <div className="df-brand"><ProductIcon compact /><div><strong>NavoPath</strong></div></div>
        <nav className="df-tabs">
          <button className={mode === "execute" ? "active" : ""} onClick={() => void saveSettings({ activeMode: "execute" })}>执行</button>
          <button className={mode === "planning" ? "active" : ""} onClick={() => void saveSettings({ activeMode: "planning" })}>规划</button>
        </nav>
        <div className="df-header-right">
          <button className="df-user-avatar" onClick={() => setUserMenuOpen((v) => !v)} aria-label="用户菜单">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
          </button>
          {userMenuOpen && (
            <div className="df-user-menu" onClick={(e) => e.stopPropagation()}>
              <div className="df-user-menu-head">
                <div className="df-user-menu-avatar">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
                </div>
                <div>
                  <div className="df-user-menu-name">{authState?.user?.email || "NavoPath User"}</div>
                  <div className="df-user-menu-plan">Free Plan</div>
                </div>
              </div>
              <div className="df-user-menu-divider" />
              <button className="df-user-menu-item" onClick={() => { setUserMenuOpen(false); /* TODO: open settings */ }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                设置
              </button>
              <button className="df-user-menu-item" onClick={() => { setUserMenuOpen(false); /* TODO: open about */ }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                关于 NavoPath
              </button>
              {authState?.mode === "cloud" && authState.user && (
                <>
                  <div className="df-user-menu-divider" />
                  <button className="df-user-menu-item danger" onClick={() => { void handleSignOut(); setUserMenuOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    退出登录
                  </button>
                </>
              )}
            </div>
          )}
          {(userMenuOpen) && <div className="df-user-menu-backdrop" onClick={() => setUserMenuOpen(false)} />}
        </div>
      </header>

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
                <button className="df-icon-action i-branch" data-tip="从规划选择" aria-label="从规划选择" onClick={openPlanningPicker} />
              </div>
            </div>
            <div className="df-candidate-list">
              {visibleCandidates.length === 0 ? (
                <div className="df-empty"><div className="blob-accent" /><strong>今天还没有选择要推进的任务。</strong><span>从规划中选择任务，或直接添加一个今天要做的事。</span><button onClick={() => openAdd("task")}>快速添加</button></div>
              ) : visibleCandidates.map((task) => (
                <TaskCard key={task.id} task={task} projects={projects} focusDate={today} projectName={projectName(task)} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onReturnPlanning={() => returnToPlanning(task.id)} onSaveNote={(note) => updateTask(task.id, { notes: note })} onDelete={() => {
                  void saveData({ ...data, tasks: data.tasks.filter((item) => item.id !== task.id) });
                  showToast("已删除任务");
                }} onClick={() => openTaskEdit(task)} onDragStart={(event) => {
                  event.dataTransfer.setData("taskId", task.id);
                  setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                }} onDragEnd={() => setDrag(null)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} />
              ))}
            </div>
            <form className="df-quick-add" onSubmit={(event) => {
              event.preventDefault();
              quickAddTask();
            }}>
              <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="New task #project" />
              <select value={quickProjectId} onChange={(event) => setQuickProjectId(event.target.value)} aria-label="选择项目">
                <option value="">#</option>
                {projects.map((project) => <option value={project.id} key={project.id}>#{project.title}</option>)}
              </select>
              <button type="submit" disabled={!quickTitle.trim()}>ADD</button>
            </form>
          </section>

          <section className="df-timeline-panel">
            <button className="df-date-arrow left" aria-label="前一天" onClick={() => setSelectedDate((date) => addDays(date, -1))}>‹</button>
            <button className="df-date-arrow right" aria-label="后一天" onClick={() => setSelectedDate((date) => addDays(date, 1))}>›</button>
            <div className="df-execute-top">
              <div className="df-ai-planner">
                    <button className={`df-ai-plan ${aiPlanning ? "thinking" : ""}`} data-tip="AI 规划今天" aria-label="AI 规划今天" disabled={aiPlanning} onClick={() => void planMyDay()}>{aiPlanning ? <><i />ANALYZING TASKS...</> : "PLAN MY DAY"}</button>
                <button className={`df-ai-plan-toggle ${aiPlanMenuOpen ? "active" : ""}`} aria-label="AI 规划设置" onClick={(event) => {
                  event.stopPropagation();
                  setAiPlanMenuOpen((open) => !open);
                }}>⌄</button>
                {aiPlanMenuOpen && <span className="df-ai-plan-menu open" onClick={(event) => event.stopPropagation()}>
                  <label>Select tasks to schedule<select value={aiPlanPrefs.source} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, source: event.target.value as AiPlanPrefs["source"] }))}><option value="today">今日候选</option><option value="all">全部未完成</option></select></label>
                  <label>Select scheduling scope<select value={aiPlanPrefs.scope} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, scope: event.target.value as AiPlanPrefs["scope"] }))}><option value="day">Day</option><option value="3day">3 Day</option></select></label>
                  <label>Select planning strategy<select value={aiPlanPrefs.strategy} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, strategy: event.target.value as AiPlanPrefs["strategy"] }))}><option value="simple">Simple (Sequential)</option><option value="priority">Priority First</option><option value="deadline">Deadline First</option></select></label>
                </span>}
              </div>
              <div className="df-timeline-actions">
                <div className="df-view-switch" aria-label="切换时间视图">
                  {([
                    ["daily", "Daily"],
                    ["3day", "3Day"],
                    ["weekly", "Weekly"],
                    ["month", "Month"]
                  ] as Array<[TimelineView, string]>).map(([view, label]) => <button key={view} className={timelineView === view ? "active" : ""} onClick={() => setTimelineView(view)}>{label}</button>)}
                </div>
              </div>
            </div>
            {timelineView === "3day" ? (() => {
              const threeDates = [addDays(timelineDate, 0), addDays(timelineDate, 1), addDays(timelineDate, 2)];
              const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const canvasHeight = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * SLOT_HEIGHT;
              const slotCount = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1;
              return (
                <div className="df-timeline-3day">
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
                  <div className="df-timeline-3day-allday">
                    <div className="df-timeline-3day-ruler-spacer">
                      <span className="df-timeline-3day-allday-label">all-day</span>
                    </div>
                    <div className="df-timeline-3day-dates">
                      {threeDates.map((colDate) => {
                        const adTasks = tasks.filter((task) => (task.plannedForDate === colDate || task.scheduledDate === colDate) && !task.scheduledStart && !task.completed);
                        return (
                          <div key={colDate} className="df-timeline-3day-allday-cell">
                            {adTasks.map((task) => (
                              <div key={task.id} className="df-day-all-day-item" onClick={() => openTaskEdit(task)}>
                                <span className="df-day-all-day-dot" />
                                <span className="df-day-all-day-title">{task.title}</span>
                              </div>
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
                      <div className="df-timeline-3day-cols">
                        {threeDates.map((colDate) => {
                          const colTasks = tasks.filter((task) => task.scheduledDate === colDate && task.scheduledStart).sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
                          const isToday = colDate === today;
                          return (
                            <div key={colDate} className={`df-day-col${isToday ? " is-today" : ""}`}
                              onDragOver={(event) => { event.preventDefault(); setHoverSlot(slotFromPointer(event.clientY)); }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                                if (taskId) {
                                  const slot = hoverSlot || slotFromPointer(event.clientY);
                                  updateTask(taskId, { scheduledDate: colDate, scheduledStart: slot, scheduledEnd: addMinutes(slot, drag?.duration || 60) });
                                }
                              }}
                              onDragLeave={() => setHoverSlot("")}
                            >
                              <div className="df-timeline-canvas df-day-col-canvas" style={{ height: `${canvasHeight}px` }}>
                                {Array.from({ length: slotCount }).map((_, index) => {
                                  const minutes = TIMELINE_START * 60 + index * SLOT_MINUTES;
                                  const isHour = minutes % 60 === 0;
                                  const isMajor = minutes % (6 * 60) === 0 && minutes < TIMELINE_END * 60;
                                  return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }} key={minutes} />;
                                })}
                                {isToday && <NowLine />}
                                {colTasks.length === 0 && <div className="df-timeline-empty small"><div className="blob-accent" />--</div>}
                                {colTasks.filter((task) => !(drag?.kind === "block" && drag.taskId === task.id)).map((task) => (
                                  <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} onHover={setHoveredBlock} onEdit={() => {
                                    if (!suppressBlockClickRef.current) openTaskEdit(task);
                                  }} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onCreateProject={(title) => {
                                    createProjectForTask(task.id, title);
                                  }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <>
                <div className="df-date-title">{displayDateTitle(timelineDate)}</div>
                <div className="df-timeline-allday">
                  <span className="df-timeline-allday-label">all-day</span>
                  <div className="df-timeline-allday-content">
                    {tasks.filter((task) => (task.plannedForDate === timelineDate || task.scheduledDate === timelineDate) && !task.scheduledStart && !task.completed).map((task) => (
                      <div key={task.id} className="df-day-all-day-item" onClick={() => openTaskEdit(task)}>
                        <span className="df-day-all-day-dot" />
                        <span className="df-day-all-day-title">{task.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="df-timeline-scroll" ref={timelineRef} onDragOver={(event) => {
                  event.preventDefault();
                  setHoverSlot(slotFromPointer(event.clientY));
                }} onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                  if (taskId) scheduleTask(taskId, hoverSlot || slotFromPointer(event.clientY));
                }} onDragLeave={() => setHoverSlot("")}>
                  <div ref={timelineCanvasRef} className="df-timeline-canvas" style={{ height: `${((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * SLOT_HEIGHT}px` }} onClick={(event) => {
                    if (drag || resizePreview) return;
                    if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule")) return;
                    if (quickSchedule) {
                      setQuickSchedule(null);
                      return;
                    }
                    openQuickSchedule(event.clientY);
                  }}>
                    {Array.from({ length: ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1 }).map((_, index) => {
                      const minutes = TIMELINE_START * 60 + index * SLOT_MINUTES;
                      const isHour = minutes % 60 === 0;
                      const isMajor = minutes % (6 * 60) === 0 && minutes < TIMELINE_END * 60;
                      return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }} key={minutes}><span>{isHour ? hourLabel(minutes) : ""}</span></div>;
                    })}
                    {isViewingToday && <NowLine />}
                    {quickSchedule && <QuickScheduleInput draft={quickSchedule} projects={projects} onChange={setQuickSchedule} onSave={saveQuickSchedule} onCancel={() => setQuickSchedule(null)} onCreateProject={quickCreateProject} />}
                    {scheduledTasks.length === 0 && suggestions.length === 0 && !drag && <div className="df-timeline-empty"><div className="blob-accent" />拖任务到这里安排时间</div>}
                    {hoverSlot && drag && !drag.outsideTimeline && <PreviewBlock task={tasks.find((task) => task.id === drag.taskId)} startTime={hoverSlot} duration={drag.duration} draggingBlock={drag.kind === "block"} conflict={hasScheduleConflict(hoverSlot, addMinutes(hoverSlot, drag.duration), drag.taskId)} />}
                    {suggestions.filter((item) => !item.ignored).map((suggestion) => <SuggestionBlock key={suggestion.id} suggestion={suggestion} task={tasks.find((task) => task.id === suggestion.taskId)} conflict={suggestionConflict(suggestion)} onApply={() => applySuggestion(suggestion.id)} onIgnore={() => setSuggestions((current) => current.map((item) => item.id === suggestion.id ? { ...item, ignored: true } : item))} />)}
                    {scheduledTasks.filter((task) => !(drag?.kind === "block" && drag.taskId === task.id)).map((task) => (
                      <TimeBlock key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} onHover={setHoveredBlock} onEdit={() => {
                        if (!suppressBlockClickRef.current) openTaskEdit(task);
                      }} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onCreateProject={(title) => {
                        createProjectForTask(task.id, title);
                      }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
      ) : (
        <PlanningView data={data} projects={projects} tasks={tasks} collapsed={collapsedBranches} setCollapsed={setCollapsedBranches} pickMode={planningPickMode} picks={planningPicks} onExitPickMode={() => setPlanningPickMode(false)} onAddPick={addPlanningPick} onUpdatePick={updatePlanningPick} onRemovePick={removePlanningPick} onClearPicks={clearPlanningPicks} onApplyPicks={applyPlanningPicks} onProjectEdit={openProjectEdit} onTaskEdit={openTaskEdit} onTaskUpdate={updateTask} onTaskCreate={createTaskInProject} onTaskDelete={(taskId) => {
          void saveData({ ...data, tasks: data.tasks.filter((task) => task.id !== taskId) });
        }} />
      )}

      <button className="df-add-fab df-icon-action i-plus" data-tip="添加" aria-label="添加" onClick={() => openAdd("task")} />
      <button className="df-ai-fab df-icon-action i-ai" data-tip="问 AI" aria-label="问 AI" onClick={() => setAiOpen((open) => !open)} />

      {drawerOpen && <div className="df-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)} />}
      {drawerOpen && <EditDrawer type={addType} setType={(type) => { setAddType(type); if (!editingId) setForm(defaultForm(type)); }} form={form} setForm={setForm} projects={projects} editing={Boolean(editingId)} task={tasks.find((task) => task.id === editingId)} today={today} advancedOpen={advancedOpen} setAdvancedOpen={(open) => { setAdvancedOpen(open); void saveSettings({ addAdvancedOpen: open }); }} onClose={() => setDrawerOpen(false)} onSave={saveForm} onDelete={deleteEditingItem} onCopy={copyEditingTask} onTaskUpdate={updateTask} onToggleDone={() => updateTask(editingId, { completed: !tasks.find((task) => task.id === editingId)?.completed })} onNextAction={() => void generateNextAction()} onCreateProject={quickCreateProject} />}
      {aiOpen && <AiPanel input={aiInput} setInput={setAiInput} reply={aiReply} busy={aiBusy} onSend={() => void sendAi()} onClose={() => setAiOpen(false)} />}
      {drag?.kind === "block" && drag.outsideTimeline && drag.pointer && <FloatingUnschedulePreview task={tasks.find((task) => task.id === drag.taskId)} pointer={drag.pointer} />}
      {toast && <div className="df-toast">{toast}</div>}
    </div>
  );
}

function FloatingUnschedulePreview({ task, pointer }: { task?: Task; pointer: { x: number; y: number } }) {
  if (!task) return null;
  return <div className="df-floating-unschedule" style={{ left: pointer.x + 14, top: pointer.y + 14 }}><strong>{task.title}</strong><span>松开放回今日候选</span></div>;
}

function QuickScheduleInput({ draft, projects, onChange, onSave, onCancel, onCreateProject }: { draft: NonNullable<QuickSchedule>; projects: Project[]; onChange: (draft: NonNullable<QuickSchedule>) => void; onSave: () => void; onCancel: () => void; onCreateProject: (title: string) => string }) {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const showProjects = /#\S*$/.test(draft.title);
  const hashDraft = draft.title.match(/#(\S*)$/)?.[1] || "";
  const top = ((timeToMinutes(draft.startTime) - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  function chooseProject(project: Project | null) {
    const base = draft.title.replace(/#\S*$/, "").trimEnd();
    onChange({ ...draft, title: `${base}${base ? " " : ""}#${project?.title || "Inbox"}`, projectId: project?.id || "" });
  }
  function createProject() {
    const title = (newProjectTitle || hashDraft).trim();
    if (!title) return;
    const id = onCreateProject(title);
    if (!id) return;
    const base = draft.title.replace(/#\S*$/, "").trimEnd();
    onChange({ ...draft, title: `${base}${base ? " " : ""}#${title}`, projectId: id });
    setNewProjectTitle("");
  }
  return (
    <div className="df-quick-schedule" style={{ top }} onClick={(event) => event.stopPropagation()}>
      {showProjects && <div className="df-project-suggest">
        <button onClick={() => chooseProject(null)}>#Inbox</button>
        {projects.map((project) => <button key={project.id} onClick={() => chooseProject(project)}>#{project.title}</button>)}
        <div className="df-project-create-line compact">
          <input value={newProjectTitle} placeholder={hashDraft || "新项目名"} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              createProject();
            }
          }} />
          <button onClick={createProject}>✓</button>
        </div>
      </div>}
      <input autoFocus value={draft.title} placeholder="New scheduled task #list" onChange={(event) => onChange({ ...draft, title: event.target.value })} onKeyDown={(event) => {
        if (event.key === "Enter") onSave();
        if (event.key === "Escape") onCancel();
      }} />
      <button className="df-quick-confirm" onClick={onSave}>✓</button>
    </div>
  );
}

function TaskCard({ task, projects, focusDate, projectName, onQuickDuration, onProjectChange, onReturnPlanning, onSaveNote, onDelete, onToggleDone, onClick, onDragStart, onDragEnd }: { task: Task; projects: Project[]; focusDate: string; projectName: string; onQuickDuration: (minutes: number) => void; onProjectChange: (projectId: string) => void; onReturnPlanning: () => void; onSaveNote: (note: string) => void; onDelete: () => void; onToggleDone: () => void; onClick: () => void; onDragStart: (event: React.DragEvent) => void; onDragEnd: () => void }) {
  const [quickOpen, setQuickOpen] = useState<"duration" | "info" | "note" | "project" | null>(null);
  const [noteDraft, setNoteDraft] = useState(task.notes || "");
  const overdue = task.dueDate < focusDate ? dateDiff(task.dueDate, focusDate) : 0;
  const status = overdue > 0 ? `逾期 ${overdue} 天` : task.plannedForDate === focusDate ? (focusDate === todayIso() ? "今日" : "当日") : "本周";
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <article className={`df-task-card ${overdue > 0 ? "overdue" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}>
      <div className="df-card-strip" style={{ background: categories[task.category].color }} />
      <div className="df-candidate-row">
        <button className="df-candidate-check" title={task.completed ? "标记未完成" : "标记完成"} onClick={(event) => {
          event.stopPropagation();
          onToggleDone();
        }}>{task.completed ? "✓" : ""}</button>
        <strong className="df-candidate-title">{task.title}</strong>
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

function TimeBlock({ task, preview, projectName, projects, hovered, onHover, onEdit, onToggleDone, onProjectChange, onCreateProject, onDragStart, onResizeStart }: { task: Task; preview: ResizePreview; projectName: string; projects: Project[]; hovered: boolean; onHover: (id: string) => void; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.MouseEvent) => void; onResizeStart: (event: React.MouseEvent, edge: "start" | "end") => void }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const start = preview?.start || task.scheduledStart || "09:00";
  const end = preview?.end || task.scheduledEnd || addMinutes(start, taskDuration(task));
  const top = ((timeToMinutes(start) - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  const height = Math.max(((timeToMinutes(end) - timeToMinutes(start)) / SLOT_MINUTES) * SLOT_HEIGHT, 38);
  const next = extractNextAction(task.notes);
  return (
    <div className={`df-time-block priority-${task.priority} ${task.completed ? "completed" : ""} ${preview ? "resizing" : ""} ${projectOpen ? "project-open" : ""}`} style={{ top, height, "--cat": categories[task.category].color } as CSSProperties} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => {
      onHover("");
      setProjectOpen(false);
    }} onMouseDown={onDragStart} onClick={onEdit} onDoubleClick={onEdit}>
      <div className="df-category-strip" />
      {hovered && <button className="df-resize-dot top" aria-label="调整开始时间" onMouseDown={(event) => onResizeStart(event, "start")} />}
      <div className="df-block-title-row">
        <button className="df-block-check" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => {
          event.stopPropagation();
          onToggleDone();
        }} aria-label={task.completed ? "标记未完成" : "标记完成"}>{task.completed ? "✓" : ""}</button>
        <strong>{task.title}</strong>
        {hovered && <span className="df-block-project-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button className="df-block-project" onClick={() => setProjectOpen((open) => !open)}># {projectName}</button>
          {projectOpen && <div className="df-project-popover">
            <button onClick={() => { onProjectChange(""); setProjectOpen(false); }}># 未归属</button>
            {projects.map((project) => <button key={project.id} onClick={() => { onProjectChange(project.id); setProjectOpen(false); }}># {project.title}</button>)}
            <div className="df-project-create-line"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); } }} /><button onClick={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }}>✓</button></div>
          </div>}
        </span>}
      </div>
      {next && <span className="df-next">下一步：{next}</span>}
      {hovered && <button className="df-resize-dot bottom" aria-label="调整结束时间" onMouseDown={(event) => onResizeStart(event, "end")} />}
    </div>
  );
}

function PreviewBlock({ task, startTime, duration, draggingBlock, conflict }: { task?: Task; startTime: string; duration: number; draggingBlock?: boolean; conflict?: boolean }) {
  if (!task) return null;
  const top = ((timeToMinutes(startTime) - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  const height = Math.max((duration / SLOT_MINUTES) * SLOT_HEIGHT, 38);
  return <div className={`df-drop-preview ${draggingBlock ? "moving-block" : ""} ${conflict ? "conflict" : ""}`} style={{ top, height }}><strong>{task.title}</strong>{!draggingBlock && <span>{conflict ? "冲突" : startTime} · {Math.round(duration)}min</span>}</div>;
}

function SuggestionBlock({ suggestion, task, conflict, onApply, onIgnore }: { suggestion: ScheduleSuggestion; task?: Task; conflict: boolean; onApply: () => void; onIgnore: () => void }) {
  if (!task) return null;
  const top = ((timeToMinutes(suggestion.startTime) - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  const height = Math.max(((timeToMinutes(suggestion.endTime) - timeToMinutes(suggestion.startTime)) / SLOT_MINUTES) * SLOT_HEIGHT, 48);
  return <div className={`df-suggestion ${conflict ? "conflict" : ""}`} style={{ top, height }}>
    <button className="df-suggestion-action apply" disabled={conflict} aria-label="应用建议" onClick={onApply}>▣</button>
    <button className="df-suggestion-action ignore" aria-label="不采用建议" onClick={onIgnore}>⊘</button>
    <span>AI 建议 {conflict && "· 冲突"}</span><strong>{task.title}</strong><small>{suggestion.reason}</small>{suggestion.nextAction && <em>下一步：{suggestion.nextAction}</em>}
  </div>;
}

function NowLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < TIMELINE_START * 60 || minutes > TIMELINE_END * 60) return null;
  const top = ((minutes - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  return <div className="df-now-line" style={{ top }}><span>现在</span></div>;
}

function EditDrawer(props: {
  type: AddType; setType: (type: AddType) => void; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; projects: Project[]; editing: boolean; task?: Task; today: string; advancedOpen: boolean; setAdvancedOpen: (open: boolean) => void; onClose: () => void; onSave: () => void; onDelete: () => void; onCopy: () => void; onTaskUpdate: (taskId: string, patch: Partial<Task>) => void; onToggleDone: () => void; onNextAction: () => void; onCreateProject: (title: string) => string;
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
          <div className="df-detail-grid"><label>日期<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>时间<input type="time" value={props.task.scheduledStart || ""} onChange={(event) => props.onTaskUpdate(props.task!.id, { scheduledDate: f.dueDate || props.today, scheduledStart: event.target.value, scheduledEnd: event.target.value ? addMinutes(event.target.value, Math.round((f.estimatedHours || 0.5) * 60)) : undefined })} /></label><label>时长<select value={Math.round((f.estimatedHours || 0.5) * 60)} onChange={(event) => set("estimatedHours", Number(event.target.value) / 60)}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label><label>重复<select><option>不重复</option></select></label></div>
          <div className="df-detail-chips"><button onClick={() => set("dueDate", props.today)}>今天</button><button onClick={() => set("dueDate", addDays(props.today, 1))}>明天</button><button onClick={() => props.onTaskUpdate(props.task!.id, { plannedForDate: props.today, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined })}>本周</button><button onClick={() => props.onTaskUpdate(props.task!.id, { scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined })}>清除时间</button></div>
        </section>
        <section className="df-detail-section">
          <h3>归属</h3>
          <div className="df-detail-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}>项目：{selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}># 未归属</button>{props.projects.map((project) => <button key={project.id} onClick={() => { set("projectId", project.id); setProjectPickerOpen(false); }}># {project.title}</button>)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div>
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
      {props.type === "task" && <><label>项目<div className="df-drawer-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}># {selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}># 未归属</button>{props.projects.map((project) => <button key={project.id} onClick={() => { set("projectId", project.id); setProjectPickerOpen(false); }}># {project.title}</button>)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div></label><label>日期<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></>}
      {props.type === "project" && <label>项目说明<textarea rows={3} value={f.details} onChange={(event) => set("details", event.target.value)} /></label>}
      {props.type === "event" && <div className="df-grid2"><label>开始日期<input type="date" value={f.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label><label>开始时间<input type="time" value={f.dueTime} onChange={(event) => set("dueTime", event.target.value)} /></label><label>结束日期<input type="date" value={f.endDate} onChange={(event) => set("endDate", event.target.value)} /></label><label>结束时间<input type="time" value={f.endTime} onChange={(event) => set("endTime", event.target.value)} /></label></div>}
      <button className="df-link" onClick={() => props.setAdvancedOpen(!props.advancedOpen)}>{props.advancedOpen ? "收起高级" : "展开高级"}</button>
      {props.advancedOpen && <div className="df-advanced">{props.type === "task" && <label>预计用时<select value={Math.round((f.estimatedHours || 0.5) * 60)} onChange={(event) => set("estimatedHours", Number(event.target.value) / 60)}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label>}<label>备注<textarea rows={6} value={f.details} onChange={(event) => set("details", event.target.value)} /></label></div>}
      <div className="df-drawer-actions">{props.editing && <button className="df-icon-action i-trash danger-lite" data-tip="删除" aria-label="删除" onClick={props.onDelete} />}{props.type === "task" && <button className="df-icon-action i-next" data-tip="明确下一步" aria-label="明确下一步" onClick={props.onNextAction} />}<button className="primary" onClick={props.onSave}>{props.editing ? "保存修改" : "添加"}</button></div>
    </aside>
  );
}

function AiPanel({ input, setInput, reply, busy, onSend, onClose }: { input: string; setInput: (v: string) => void; reply: string; busy: boolean; onSend: () => void; onClose: () => void }) {
  return <aside className="df-ai-panel"><div><strong>NavoPath AI</strong><button className="df-icon-action i-close" data-tip="关闭" aria-label="关闭" onClick={onClose} /></div><textarea value={input} onChange={(event) => setInput(event.target.value)} /><button className="df-icon-action i-send" data-tip={busy ? "思考中" : "发送"} aria-label={busy ? "思考中" : "发送"} onClick={onSend} disabled={busy || !input.trim()} />{reply && <pre>{reply}</pre>}</aside>;
}

function SourceModal({ tasks, projects, today, onClose, onJoin }: { tasks: Task[]; projects: Project[]; today: string; onClose: () => void; onJoin: (taskIds: string[]) => void }) {
  const [filter, setFilter] = useState<string>("all");
  const [showAdded, setShowAdded] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState("");
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
  return (
    <div className="df-modal" onClick={onClose}>
      <div className="df-source" onClick={(event) => event.stopPropagation()}>
        <div className="df-source-fixed">
          <div className="df-source-head">
            <h2>选择今天要推进的任务</h2>
            <button className="df-icon-action i-close" data-tip="关闭" aria-label="关闭" onClick={onClose} />
          </div>
          <div className="df-source-toolbar">
            <button className="light" onClick={() => setShowAdded((value) => !value)}>{showAdded ? "隐藏已添加" : "显示已添加"}</button>
            <button className="primary" disabled={selectedIds.length === 0} onClick={addSelected}>添加选中项 {selectedIds.length || ""}</button>
          </div>
          <div className="df-filter-row">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部项目</button>
            <button className={filter === "unassigned" ? "active" : ""} onClick={() => setFilter("unassigned")}>未归属</button>
            {projects.map((project) => <button key={project.id} className={filter === project.id ? "active" : ""} onClick={() => setFilter(project.id)}>{project.title}</button>)}
          </div>
        </div>
        <div className="df-source-body">
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
        </div>
      </div>
    </div>
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

function PlanningView(props: {
  data: PlannerData;
  projects: Project[];
  tasks: Task[];
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pickMode: boolean;
  picks: Record<string, PlanPickPriority>;
  onExitPickMode: () => void;
  onAddPick: (taskId: string) => void;
  onUpdatePick: (taskId: string, priority: PlanPickPriority) => void;
  onRemovePick: (taskId: string) => void;
  onClearPicks: () => void;
  onApplyPicks: (scope: "today" | "week") => void;
  onProjectEdit: (project: Project) => void;
  onTaskEdit: (task: Task) => void;
  onTaskUpdate: (taskId: string, patch: Partial<Task>) => void;
  onTaskCreate: (projectId: string) => void;
  onTaskDelete: (taskId: string) => void;
}) {
  const unassigned = props.tasks.filter((task) => !task.projectId && !task.completed);
  const pickedTasks = Object.keys(props.picks)
    .map((id) => props.tasks.find((task) => task.id === id))
    .filter(Boolean) as Task[];
  const priorityGroups: Array<[PlanPickPriority, string]> = [["must", "必须做"], ["should", "应该做"], ["could", "有空做"]];
  const projectName = (task: Task) => props.projects.find((project) => String(project.id) === String(task.projectId || ""))?.title || "未归属";
  const addSubtask = (task: Task) => {
    const title = window.prompt("子任务名称");
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, {
      subtasks: [...(task.subtasks || []), { id: uid("subtask"), title: title.trim(), completed: false, done: false, order: Date.now(), createdAt: new Date().toISOString() }]
    });
  };
  const setTaskDate = (task: Task) => {
    const date = window.prompt("设置日期 YYYY-MM-DD", task.dueDate || todayIso());
    if (!date?.trim()) return;
    props.onTaskUpdate(task.id, { dueDate: date.trim() });
  };
  const moveTaskProject = (task: Task) => {
    const options = props.projects.map((project, index) => `${index + 1}. ${project.title}`).join("\n");
    const choice = window.prompt(`移动到项目：\n0. 未归属\n${options}`, "0");
    if (choice === null) return;
    const index = Number(choice) - 1;
    props.onTaskUpdate(task.id, { projectId: index >= 0 ? props.projects[index]?.id : undefined });
  };
  const renameTask = (task: Task) => {
    const title = window.prompt("编辑名称", task.title);
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, { title: title.trim() });
  };
  return (
    <main className={`df-planning ${props.pickMode ? "pick-mode" : ""}`}>
      <section className="df-mindmap no-root">
        {props.pickMode && <div className="df-pick-banner"><strong>正在从规划中选择任务</strong><span>点击任务旁的 + 加入候选框，确认后加入执行列表。</span><button onClick={props.onExitPickMode}>退出</button></div>}
        <div className="df-tree">
          {props.projects.map((project) => {
            const projectTasks = props.tasks.filter((task) => String(task.projectId || "") === String(project.id) && !task.completed);
            return (
              <div className="df-category-branch" key={project.id}>
                <button className="df-collapse" onClick={() => props.setCollapsed((current) => ({ ...current, [project.id]: !current[project.id] }))}>{props.collapsed[project.id] ? "+" : "-"}</button>
                <PlanningProjectNode title={project.title} onOpen={() => props.onProjectEdit(project)} onAddTask={() => props.onTaskCreate(project.id)} />
                {!props.collapsed[project.id] && <div className="df-project-list"><div className="df-task-branch">{projectTasks.map((task) => (
                  <PlanningTaskNode key={task.id} task={task} projectName={project.title} picked={Boolean(props.picks[task.id])} onOpen={() => props.onTaskEdit(task)} onAdd={() => props.onAddPick(task.id)} onStar={() => props.onTaskUpdate(task.id, { priority: "high", importance: "high" })} onRename={() => renameTask(task)} onAddSubtask={() => addSubtask(task)} onSetDate={() => setTaskDate(task)} onMoveProject={() => moveTaskProject(task)} onDelete={() => props.onTaskDelete(task.id)} />
                ))}</div></div>}
              </div>
            );
          })}
          {unassigned.length > 0 && (
            <div className="df-category-branch">
              <button className="df-collapse" onClick={() => props.setCollapsed((current) => ({ ...current, unassigned: !current.unassigned }))}>{props.collapsed.unassigned ? "+" : "-"}</button>
              <PlanningProjectNode title="未归属任务" onAddTask={() => props.onTaskCreate("")} />
              {!props.collapsed.unassigned && <div className="df-project-list"><div className="df-task-branch">{unassigned.map((task) => (
                <PlanningTaskNode key={task.id} task={task} projectName="未归属" picked={Boolean(props.picks[task.id])} onOpen={() => props.onTaskEdit(task)} onAdd={() => props.onAddPick(task.id)} onStar={() => props.onTaskUpdate(task.id, { priority: "high", importance: "high" })} onRename={() => renameTask(task)} onAddSubtask={() => addSubtask(task)} onSetDate={() => setTaskDate(task)} onMoveProject={() => moveTaskProject(task)} onDelete={() => props.onTaskDelete(task.id)} />
              ))}</div></div>}
            </div>
          )}
        </div>
      </section>
      <section className="df-pick-panel">
        <div className="df-pick-panel-head"><strong>候选任务</strong><span>{pickedTasks.length} 项</span></div>
        {pickedTasks.length === 0 ? <div className="df-pick-empty">从左侧选择几个今天想做的任务</div> : priorityGroups.map(([priority, label]) => {
          const groupTasks = pickedTasks.filter((task) => props.picks[task.id] === priority);
          return <div className="df-pick-group" key={priority}><h3>{label}</h3>{groupTasks.length === 0 ? <small>暂无</small> : groupTasks.map((task) => (
            <article key={task.id} className="df-pick-card">
              <div><strong>{task.title}</strong><span># {projectName(task)}</span></div>
              <select value={props.picks[task.id]} onChange={(event) => props.onUpdatePick(task.id, event.target.value as PlanPickPriority)}>
                <option value="must">必须做</option>
                <option value="should">应该做</option>
                <option value="could">有空做</option>
              </select>
              <button onClick={() => props.onRemovePick(task.id)}>移除</button>
            </article>
          ))}</div>;
        })}
        <div className="df-pick-actions">
          <button className="primary" disabled={pickedTasks.length === 0} onClick={() => props.onApplyPicks("today")}>加入今日执行</button>
          <button disabled={pickedTasks.length === 0} onClick={() => props.onApplyPicks("week")}>加入本周计划</button>
          <button className="light" disabled={pickedTasks.length === 0} onClick={props.onClearPicks}>清空候选</button>
        </div>
      </section>
    </main>
  );
}

function PlanningTaskNode(props: {
  task: Task;
  projectName: string;
  picked: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onStar: () => void;
  onRename: () => void;
  onAddSubtask: () => void;
  onSetDate: () => void;
  onMoveProject: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`df-plan-task-node ${props.picked ? "picked" : ""}`}>
      <button className="df-task-node" onClick={props.onOpen}>
        <span>{props.task.title}</span>
        {(props.task.subtasks || []).length > 0 && <small>{props.task.subtasks?.filter((sub) => sub.completed || sub.done).length}/{props.task.subtasks?.length}</small>}
        {props.picked && <em>已选</em>}
      </button>
      <div className="df-plan-node-actions">
        <button title="加入候选" onClick={props.onAdd}>+</button>
        <button title="标为重点" onClick={props.onStar}>☆</button>
        <button title="更多" onClick={() => setMenuOpen((open) => !open)}>⋯</button>
      </div>
      {menuOpen && <div className="df-plan-more">
        <button onClick={() => { props.onRename(); setMenuOpen(false); }}>编辑名称</button>
        <button onClick={() => { props.onAddSubtask(); setMenuOpen(false); }}>添加子任务</button>
        <button onClick={() => { props.onSetDate(); setMenuOpen(false); }}>设置日期</button>
        <button onClick={() => { props.onMoveProject(); setMenuOpen(false); }}>移动到项目</button>
        <button className="danger" onClick={() => { props.onDelete(); setMenuOpen(false); }}>删除</button>
      </div>}
    </div>
  );
}

function PlanningProjectNode(props: { title: string; onOpen?: () => void; onAddTask: () => void }) {
  return (
    <div className="df-plan-project-node">
      <button className="df-category-node project-root" onClick={props.onOpen}>{props.title}</button>
      <button className="df-plan-project-add" title="添加任务" onClick={props.onAddTask}>+</button>
    </div>
  );
}

const rootElement = document.getElementById("root")!;
const rootKey = "__plannerRoot";
const rootWindow = window as typeof window & { [rootKey]?: ReturnType<typeof createRoot> };
const root = rootWindow[rootKey] ?? createRoot(rootElement);
rootWindow[rootKey] = root;
root.render(<App />);
