// autoSchedule.ts — Deterministic time-blocking scheduler for NavoPath.
// One task = one time block. Long tasks are NOT split. If there is no
// continuous free slot that fits the entire task, the task stays in the
// "unscheduled" list.

export interface ScheduleTask {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes?: number;
  dueDate?: string;
  projectId?: string;
  completed?: boolean;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface ScheduledEvent {
  id: string;
  taskId?: string;
  title: string;
  scheduledDate?: string;
  date?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
}

export interface AutoScheduleSettings {
  dayStart?: string;
  dayEnd?: string;
  snapMinutes?: number;
  defaultTaskDuration?: number;
  bufferMinutes?: number;
}

/**
 * A single preview event. `taskId` is the SOURCE task id. `clonedTaskId` is
 * the id of the new Task that will be appended to the planner data on commit.
 */
export interface ProposedEvent {
  id: string;                  // preview id
  taskId: string;              // source task id
  clonedTaskId: string;        // new task id
  title: string;
  projectId?: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  isPreview: true;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface UnscheduledTask {
  taskId: string;
  title: string;
  reason: string;
}

export interface AutoScheduleResult {
  proposedEvents: ProposedEvent[];
  unscheduledTasks: UnscheduledTask[];
  warnings: string[];
  summary: { scheduledCount: number; unscheduledCount: number; totalMinutes: number };
}

export interface FreeSlot {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

// ── Utilities ──

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function uid(p: string) { return `${p}_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(36).slice(-4)}`; }

function eventDate(e: ScheduledEvent) { return e.scheduledDate || e.date || ""; }
function eventStart(e: ScheduledEvent) { return e.scheduledStart || e.start || e.startTime || ""; }
function eventEnd(e: ScheduledEvent) { return e.scheduledEnd || e.end || e.endTime || ""; }

function guessDuration(title: string): number {
  if (/复习|作业|编程|写|做题|准备|申请|论文|文书|调试|实验/.test(title)) return 45;
  if (/整理|查看|回复|检查|阅读|浏览|确认/.test(title)) return 20;
  return 30;
}

function overlaps(a: { startMinutes: number; endMinutes: number }, b: { startMinutes: number; endMinutes: number }): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

// ── getFreeSlots ──

export function getFreeSlots(params: {
  dateRange: string[];
  scheduledEvents: ScheduledEvent[];
  settings: AutoScheduleSettings;
}): FreeSlot[] {
  const { dateRange, scheduledEvents, settings } = params;
  const snap = settings.snapMinutes || 15;
  const dayStart = settings.dayStart ? timeToMinutes(settings.dayStart) : 480;
  const dayEnd = settings.dayEnd ? timeToMinutes(settings.dayEnd) : 1320;
  const buffer = settings.bufferMinutes || 5;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const tIso = todayIso();

  const slots: FreeSlot[] = [];
  for (const date of dateRange) {
    const effectiveStart = date === tIso ? Math.max(dayStart, Math.ceil(now / snap) * snap + 5) : dayStart;
    let freeSegments: { start: number; end: number }[] = [{ start: effectiveStart, end: dayEnd }];

    for (const ev of scheduledEvents) {
      if (eventDate(ev) !== date) continue;
      const s = eventStart(ev), e = eventEnd(ev);
      if (!s || !e) continue;
      const bs = Math.max(dayStart, timeToMinutes(s) - buffer);
      const be = Math.min(dayEnd, timeToMinutes(e) + buffer);
      const next: typeof freeSegments = [];
      for (const seg of freeSegments) {
        if (be <= seg.start || bs >= seg.end) { next.push(seg); }
        else {
          if (seg.start < bs) next.push({ start: seg.start, end: bs });
          if (be < seg.end) next.push({ start: be, end: seg.end });
        }
      }
      freeSegments = next;
    }

    for (const seg of freeSegments) {
      const ss = Math.ceil(seg.start / snap) * snap;
      const se = Math.floor(seg.end / snap) * snap;
      if (se - ss >= 15) slots.push({ date, startMinutes: ss, endMinutes: se });
    }
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
}

// ── Pure commit helper ──

/**
 * Pure function that returns a list of NEW Task-shaped objects ready to be
 * appended to the planner data. Each preview event becomes a real Task with
 * a unique `clonedTaskId`. The original source task is NOT modified.
 */
export function previewEventsToTaskSpecs(
  previews: ProposedEvent[],
  sourceTasks: Map<string, {
    id: string;
    title: string;
    priority: "high" | "medium" | "low";
    projectId?: string;
    dueDate?: string;
    notes?: string;
    category?: string;
    goalId?: string;
    estimatedHours?: number;
  }>,
  nowIso: string,
): Array<{
  id: string;
  title: string;
  dueDate: string;
  category: string;
  priority: "high" | "medium" | "low";
  notes: string;
  goalId: string;
  completed: boolean;
  projectId?: string;
  parentTaskId: string;
  importance: "high" | "medium" | "low";
  urgency: "high" | "medium" | "low";
  estimatedHours?: number;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  plannedForDate: string;
  createdAt: string;
  updatedAt: string;
}> {
  return previews.map((p) => {
    const source = sourceTasks.get(p.taskId);
    return {
      id: p.clonedTaskId,
      title: source?.title || p.title,
      dueDate: source?.dueDate || "",
      category: (source?.category as any) || "personal",
      priority: p.priority,
      notes: source?.notes || "",
      goalId: source?.goalId || "",
      completed: false,
      projectId: source?.projectId,
      parentTaskId: p.taskId,
      importance: p.priority,
      urgency: p.priority,
      estimatedHours: p.durationMinutes / 60,
      scheduledDate: p.scheduledDate,
      scheduledStart: p.scheduledStart,
      scheduledEnd: p.scheduledEnd,
      plannedForDate: p.scheduledDate,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

// ── Main scheduler ──
//
// One task = one block. NO splitting. If a 4h task has no 4h continuous slot,
// the task goes to `unscheduledTasks` with reason "no continuous slot".
export function autoScheduleTasks(params: {
  tasks: ScheduleTask[];
  scheduledEvents: ScheduledEvent[];
  dateRange?: string[];
  settings?: AutoScheduleSettings;
}): AutoScheduleResult {
  const today = todayIso();
  const dateRange = params.dateRange || [today];
  const s: Required<AutoScheduleSettings> = {
    dayStart: "08:00", dayEnd: "22:00", snapMinutes: 15,
    defaultTaskDuration: 30, bufferMinutes: 5,
    ...params.settings,
  };
  const warnings: string[] = [];
  const proposed: ProposedEvent[] = [];
  const unscheduled: UnscheduledTask[] = [];

  // Filter — only uncompleted, unscheduled source tasks
  const candidates = params.tasks.filter(t => !t.completed && !t.scheduledStart);

  let missing = 0;
  const withDuration = candidates.map(t => {
    const mins = t.estimatedMinutes && t.estimatedMinutes > 0
      ? t.estimatedMinutes
      : (s.defaultTaskDuration || guessDuration(t.title));
    if (!t.estimatedMinutes || t.estimatedMinutes <= 0) missing++;
    return { ...t, estimatedMinutes: mins };
  });
  if (missing) warnings.push(`有 ${missing} 个任务缺少时长，已用默认值`);

  // Sort: longest first so big tasks get slots before they fragment
  withDuration.sort((a, b) => (b.estimatedMinutes || 30) - (a.estimatedMinutes || 30));

  let freeSlots = getFreeSlots({ dateRange, scheduledEvents: params.scheduledEvents, settings: s });
  const buf = s.bufferMinutes;

  for (const task of withDuration) {
    const dur = task.estimatedMinutes || 30;
    const need = dur + buf;

    // Find the smallest slot that fits the entire task (best fit first)
    let best: FreeSlot | null = null;
    let bestScore = -Infinity;
    for (const slot of freeSlots) {
      const fit = slot.endMinutes - slot.startMinutes;
      if (fit < need) continue;
      // Prefer the tightest fit
      const score = 1000 - (fit - need);
      if (score > bestScore) { bestScore = score; best = slot; }
    }

    if (best) {
      const st = minutesToTime(best.startMinutes);
      const et = minutesToTime(best.startMinutes + dur);
      const clonedTaskId = uid("scheduledTask");
      proposed.push({
        id: uid("preview"),
        taskId: task.id,
        clonedTaskId,
        title: task.title,
        projectId: task.projectId,
        scheduledDate: best.date,
        scheduledStart: st,
        scheduledEnd: et,
        durationMinutes: dur,
        isPreview: true,
        reason: task.priority === "high" ? "优先安排" : (task.dueDate === today ? "今日截止" : "自动安排"),
        priority: task.priority,
      });

      // Cut the used portion from freeSlots
      const next: FreeSlot[] = [];
      for (const slot of freeSlots) {
        if (slot !== best) { next.push(slot); continue; }
        const before = { date: slot.date, startMinutes: slot.startMinutes, endMinutes: best.startMinutes };
        const after = { date: slot.date, startMinutes: best.startMinutes + need, endMinutes: slot.endMinutes };
        if (before.endMinutes - before.startMinutes >= 15) next.push(before);
        if (after.endMinutes - after.startMinutes >= 15) next.push(after);
      }
      freeSlots = next;
    } else {
      // No continuous slot fits the entire task — do NOT split
      unscheduled.push({
        taskId: task.id,
        title: task.title,
        reason: `没有 ${Math.round(dur)} 分钟连续空档`,
      });
    }
  }

  // Repair overlaps (defensive — getFreeSlots + the loop should already prevent them)
  proposed.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
  for (let i = 0; i < proposed.length - 1; i++) {
    const a = proposed[i], b = proposed[i + 1];
    if (a.scheduledDate === b.scheduledDate && timeToMinutes(b.scheduledStart) < timeToMinutes(a.scheduledEnd)) {
      b.scheduledStart = minutesToTime(timeToMinutes(a.scheduledEnd));
      b.scheduledEnd = minutesToTime(timeToMinutes(a.scheduledEnd) + b.durationMinutes);
    }
  }

  return {
    proposedEvents: proposed,
    unscheduledTasks: unscheduled,
    warnings,
    summary: {
      scheduledCount: proposed.length,
      unscheduledCount: unscheduled.length,
      totalMinutes: proposed.reduce((m, e) => m + e.durationMinutes, 0),
    },
  };
}
