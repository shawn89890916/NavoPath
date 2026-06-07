import React, { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import type { CalendarEvent, Category, PlannerApi, PlannerData, Priority, Project, Settings, Task } from "./types";
import { installBrowserFallback } from "./browserFallback";
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
  { date: "2026-06-05", summary: "统一执行页与规划页的主题色联动，补齐项目颜色对时间轴色条的映射。" },
  { date: "2026-06-05", summary: "加入 3天 / 周 / 月视图，并持续修正多日时间轴的拖拽与布局对齐。" },
  { date: "2026-06-04", summary: "规划树支持候选挑选模式，任务可从长期项目流入今日执行。" },
  { date: "2026-06-04", summary: "任务详情侧栏、快速项目归属与 AI 下一步编辑流程完成收口。" }
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
  const [sourceOpen, setSourceOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<"settings" | "about" | null>(null);
  const [planningPickMode, setPlanningPickMode] = useState(false);
  const [planningPicks, setPlanningPicks] = useState<Record<string, PlanPickPriority>>({});
  const [toast, setToast] = useState("");
  const [showCompletedCandidates, setShowCompletedCandidates] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectTitle, setQuickProjectTitle] = useState("");
  const [quickProjectColor, setQuickProjectColor] = useState(PROJECT_COLOR_PRESETS[0]);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const suppressBlockClickRef = useRef(false);
  const lastTimelineAutoScrollKeyRef = useRef("");
  const dataRef = useRef<PlannerData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const pendingSaveRef = useRef<PlannerData | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const queuedSaveIdRef = useRef(0);

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

  function openQuickSchedule(clientY: number) {
    const startTime = slotFromPointer(clientY);
    setQuickSchedule({ startTime, title: "", projectId: "" });
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
                <div className="df-empty"><div className="blob-accent" /><strong>今天还没有任务</strong><span>从规划页选择任务，或直接添加一个。</span><button className="df-empty-pick-btn" onClick={openPlanningPicker}>从规划选择</button></div>
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

          <section className="df-timeline-panel">
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
                <div className="df-view-switch" aria-label="切换时间视图">
                  {([
                    ["daily", "天"],
                    ["3day", "3天"],
                    ["weekly", "周"],
                    ["month", "月"]
                  ] as Array<[TimelineView, string]>).map(([view, label]) => <button key={view} className={timelineView === view ? "active" : ""} onClick={() => setTimelineView(view)}>{label}</button>)}
                </div>
              </div>
            </div>
            {timelineDate !== today && (
              <button className="df-back-today" onClick={() => setSelectedDate(today)} title="回到今天">↵</button>
            )}
            {(timelineView === "3day" || timelineView === "weekly") ? (() => {
              const rangeStart = timelineView === "weekly" ? startOfWeekIso(timelineDate) : timelineDate;
              const rangeLength = timelineView === "weekly" ? 7 : 3;
              const threeDates = Array.from({ length: rangeLength }, (_, index) => addDays(rangeStart, index));
              const weekdayShort = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
              const canvasHeight = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * SLOT_HEIGHT;
              const slotCount = ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1;
              return (
                <div className={`df-timeline-3day ${timelineView === "weekly" ? "df-week-view" : ""}`} style={{ "--df-day-columns": String(rangeLength) } as CSSProperties}>
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
                      <span className="df-timeline-3day-allday-label">全天</span>
                    </div>
                    <div className="df-timeline-3day-dates">
                      {threeDates.map((colDate) => {
                        const adTasks = tasks.filter((task) => task.scheduledDate === colDate && !task.scheduledStart && !task.completed);
                        return (
                          <div key={colDate} className="df-timeline-3day-allday-cell" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                            event.preventDefault();
                            const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                            if (taskId) updateTask(taskId, { plannedForDate: today, scheduledDate: colDate, scheduledStart: undefined, scheduledEnd: undefined });
                            setDrag(null);
                          }}>
                            {adTasks.map((task) => (
                              <AllDayBlock key={task.id} task={task} projectName={projectName(task)} projects={projects} onEdit={() => openTaskEdit(task)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onDragStart={(event) => {
                                event.dataTransfer.setData("taskId", task.id);
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
                                  }} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
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
            })() : timelineView === "month" ? (() => {
              const monthStart = startOfMonthGridIso(timelineDate);
              const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthStart, index));
              const activeMonth = new Date(`${timelineDate}T00:00:00`).getMonth();
              return (
                <div className="df-month-view">
                  <div className="df-month-title">{monthTitle(timelineDate)}</div>
                  <div className="df-month-weekdays">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => <span key={day}>{day}</span>)}</div>
                  <div className="df-month-grid">
                    {monthDays.map((day) => {
                      const dateObj = new Date(`${day}T00:00:00`);
                      const dayTasks = tasks.filter((task) => !task.completed && (task.scheduledDate === day || task.plannedForDate === day || task.dueDate === day)).slice(0, 5);
                      return (
                        <div key={day} className={`df-month-cell ${dateObj.getMonth() !== activeMonth ? "muted" : ""} ${day === today ? "today" : ""}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                            if (taskId) updateTask(taskId, { plannedForDate: day, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined });
                            setDrag(null);
                          }}
                          onDoubleClick={() => {
                            if (drawerOpen) return;
                            setSelectedDate(day);
                            openAdd("task");
                          }}
                        >
                          <strong>{dateObj.getDate()}</strong>
                          {dayTasks.map((task) => (
                            <button key={task.id} className="df-month-task" style={{ "--cat": projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color } as CSSProperties} onClick={() => openTaskEdit(task)}>
                              <span />{task.title}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (
              <div className="df-timeline-daily">
                <div className={`df-date-title${timelineDate === today ? " today" : ""}`}>
                  {displayDateTitle(timelineDate)}
                </div>
                <div className="df-timeline-allday">
                  <span className="df-timeline-allday-label">全天</span>
                  <div className="df-timeline-allday-content" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                    event.preventDefault();
                    const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                    if (taskId) updateTask(taskId, { plannedForDate: today, scheduledDate: timelineDate, scheduledStart: undefined, scheduledEnd: undefined });
                    setDrag(null);
                  }} onDoubleClick={() => {
                    if (drawerOpen || aiPlanning) return;
                    if (quickSchedule) { setQuickSchedule(null); return; }
                    setQuickSchedule({ startTime: "00:00", title: "", projectId: "", isAllDay: true });
                  }}>
                    {tasks.filter((task) => task.scheduledDate === timelineDate && !task.scheduledStart && !task.completed).map((task) => (
                      <AllDayBlock key={task.id} task={task} projectName={projectName(task)} projects={projects} onEdit={() => openTaskEdit(task)} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onDragStart={(event) => {
                        event.dataTransfer.setData("taskId", task.id);
                        setDrag({ taskId: task.id, kind: "candidate", duration: taskDuration(task) });
                      }} onDragEnd={() => setDrag(null)} />
                    ))}
                    {quickSchedule?.isAllDay && (
                      <div className="df-all-day-quick" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={quickSchedule.title}
                          onChange={(e) => setQuickSchedule({ ...quickSchedule, title: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveQuickSchedule(); } }}
                          placeholder="添加全天任务"
                        />
                        <button type="button" onClick={saveQuickSchedule}>✓</button>
                      </div>
                    )}
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
                      }} onToggleDone={() => updateTask(task.id, { completed: !task.completed })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                        createProjectForTask(task.id, title);
                      }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      ) : (
        <Suspense fallback={<div className="df-loading-inline">规划加载中...</div>}>
          <PlanningViewLazy data={data} projects={projects} tasks={tasks} collapsed={collapsedBranches} setCollapsed={setCollapsedBranches} pickMode={planningPickMode} picks={planningPicks} onExitPickMode={() => setPlanningPickMode(false)} onAddPick={addPlanningPick} onUpdatePick={updatePlanningPick} onRemovePick={removePlanningPick} onClearPicks={clearPlanningPicks} onApplyPicks={applyPlanningPicks} onProjectEdit={openProjectEdit} onTaskEdit={openTaskEdit} onTaskUpdate={updateTask} onTaskCreate={createTaskInProject} onTaskDelete={(taskId) => {
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

function TimeBlock({ task, preview, projectName, projects, hovered, onHover, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onResizeStart }: { task: Task; preview: ResizePreview; projectName: string; projects: Project[]; hovered: boolean; onHover: (id: string) => void; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.MouseEvent) => void; onResizeStart: (event: React.MouseEvent, edge: "start" | "end") => void }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const start = preview?.start || task.scheduledStart || "09:00";
  const end = preview?.end || task.scheduledEnd || addMinutes(start, taskDuration(task));
  const top = ((timeToMinutes(start) - TIMELINE_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  const height = Math.max(((timeToMinutes(end) - timeToMinutes(start)) / SLOT_MINUTES) * SLOT_HEIGHT, SLOT_HEIGHT);
  const next = extractNextAction(task.notes);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  return (
    <div className={`df-time-block priority-${task.priority} ${task.completed ? "completed" : ""} ${preview ? "resizing" : ""} ${projectOpen ? "project-open" : ""}`} style={{ top, height, "--cat": stripeColor } as CSSProperties} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => {
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
            {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
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
  const height = Math.max((duration / SLOT_MINUTES) * SLOT_HEIGHT, SLOT_HEIGHT);
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
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  return (
    <article className={`df-all-day-block ${task.completed ? "completed" : ""} ${projectOpen ? "project-open" : ""}`} draggable style={{ "--cat": stripeColor } as CSSProperties} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onEdit} onMouseLeave={() => setProjectOpen(false)}>
      <div className="df-category-strip" />
      <button className="df-block-check" onClick={(event) => {
        event.stopPropagation();
        onToggleDone();
      }}>{task.completed ? "✓" : ""}</button>
      <strong>{task.title}</strong>
      <span className="df-block-project-wrap" onClick={(event) => event.stopPropagation()}>
        <button className="df-block-project" onClick={() => setProjectOpen((open) => !open)}># {projectName}</button>
        {projectOpen && <div className="df-project-popover">
          <button onClick={() => { onProjectChange(""); setProjectOpen(false); }}># 未归属</button>
          {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
          <div className="df-project-create-line"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); } }} /><button onClick={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }}>✓</button></div>
        </div>}
      </span>
    </article>
  );
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
          <div className="df-detail-project-picker"><button type="button" onClick={() => setProjectPickerOpen((open) => !open)}>项目：{selectedProjectTitle}</button>{projectPickerOpen && <div className="df-drawer-project-list"><button onClick={() => { set("projectId", ""); setProjectPickerOpen(false); }}># 未归属</button>{props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { set("projectId", project.id); setProjectPickerOpen(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}<div className="df-project-create-line compact"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createAndSelectProject(); } }} /><button onClick={createAndSelectProject}>✓</button></div></div>}</div>
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

const rootElement = document.getElementById("root")!;
const rootKey = "__plannerRoot";
const rootWindow = window as typeof window & { [rootKey]?: ReturnType<typeof createRoot> };
const root = rootWindow[rootKey] ?? createRoot(rootElement);
rootWindow[rootKey] = root;
root.render(<App />);