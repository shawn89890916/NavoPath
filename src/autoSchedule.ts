// autoSchedule.ts — Deterministic time-blocking scheduler for NavoPath.
// Fixed events remain anchors. Tasks are movable work blocks and may be split
// only when the caller explicitly enables an auditable split preview.

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
  strategy?: "random" | "byProject" | "alternativeProject" | "longShort";
  preferredStartHourByProject?: Record<string, number>;
  allowTaskSplitting?: boolean;
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
  segmentIndex?: number;
  segmentCount?: number;
}

export interface UnscheduledTask {
  taskId: string;
  title: string;
  reason: string;
  code?: "missing_duration" | "insufficient_capacity" | "deadline_conflict" | "no_continuous_slot";
  actions?: Array<"shorten" | "split" | "move_next_day">;
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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function orderTasks<T extends ScheduleTask & { estimatedMinutes: number }>(tasks: T[], strategy: AutoScheduleSettings["strategy"]): T[] {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const base = [...tasks].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]
    || (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31")
    || b.estimatedMinutes - a.estimatedMinutes);
  if (strategy === "random") return base.sort((a, b) => stableHash(a.id) - stableHash(b.id));
  if (strategy === "byProject") return base.sort((a, b) => (a.projectId || "~").localeCompare(b.projectId || "~") || priorityRank[a.priority] - priorityRank[b.priority]);
  if (strategy === "longShort") {
    const durationSorted = [...base].sort((a, b) => b.estimatedMinutes - a.estimatedMinutes);
    const result: T[] = [];
    let left = 0;
    let right = durationSorted.length - 1;
    while (left <= right) {
      result.push(durationSorted[left++]);
      if (left <= right) result.push(durationSorted[right--]);
    }
    return result;
  }
  if (strategy === "alternativeProject") {
    const groups = new Map<string, T[]>();
    for (const task of base) {
      const key = task.projectId || "__none__";
      groups.set(key, [...(groups.get(key) || []), task]);
    }
    const keys = [...groups.keys()];
    const result: T[] = [];
    while (result.length < base.length) {
      for (const key of keys) {
        const task = groups.get(key)?.shift();
        if (task) result.push(task);
      }
    }
    return result;
  }
  return base;
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
  const buffer = settings.bufferMinutes ?? 5;
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
    strategy: "longShort", preferredStartHourByProject: {}, allowTaskSplitting: true,
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

  const orderedTasks = orderTasks(withDuration as Array<typeof withDuration[number] & { estimatedMinutes: number }>, s.strategy);

  let freeSlots = getFreeSlots({ dateRange, scheduledEvents: params.scheduledEvents, settings: s });
  const buf = s.bufferMinutes;

  const consumeSlot = (slotToUse: FreeSlot, duration: number, startMinutes = slotToUse.startMinutes) => {
    const next: FreeSlot[] = [];
    for (const slot of freeSlots) {
      if (slot !== slotToUse) { next.push(slot); continue; }
      const before = { date: slot.date, startMinutes: slot.startMinutes, endMinutes: startMinutes - buf };
      const after = { date: slot.date, startMinutes: startMinutes + duration + buf, endMinutes: slot.endMinutes };
      if (before.endMinutes - before.startMinutes >= 15) next.push(before);
      if (after.endMinutes - after.startMinutes >= 15) next.push(after);
    }
    freeSlots = next;
  };

  for (const task of orderedTasks) {
    const dur = task.estimatedMinutes || 30;

    // Find the smallest slot that fits the entire task (best fit first)
    let best: FreeSlot | null = null;
    let bestStartMinutes = 0;
    let bestScore = -Infinity;
    for (const slot of freeSlots) {
      const fit = slot.endMinutes - slot.startMinutes;
      if (fit < dur) continue;
      const preferredHour = task.projectId ? s.preferredStartHourByProject[task.projectId] : undefined;
      const preferredMinutes = preferredHour === undefined
        ? undefined
        : Math.round((preferredHour * 60) / s.snapMinutes) * s.snapMinutes;
      const latestStart = Math.max(
        slot.startMinutes,
        Math.floor((slot.endMinutes - dur) / s.snapMinutes) * s.snapMinutes,
      );
      const startMinutes = preferredMinutes === undefined
        ? slot.startMinutes
        : Math.min(latestStart, Math.max(slot.startMinutes, preferredMinutes));
      const preferredPenalty = preferredMinutes === undefined ? 0 : Math.abs(startMinutes - preferredMinutes) * 2;
      const deadlineBonus = task.dueDate === slot.date ? 400 : task.dueDate && task.dueDate < slot.date ? -800 : 0;
      const score = 1000 - (fit - dur) - preferredPenalty + deadlineBonus;
      if (score > bestScore) {
        bestScore = score;
        best = slot;
        bestStartMinutes = startMinutes;
      }
    }

    if (best) {
      const st = minutesToTime(bestStartMinutes);
      const et = minutesToTime(bestStartMinutes + dur);
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

      consumeSlot(best, dur, bestStartMinutes);
    } else if (s.allowTaskSplitting && dur >= 60) {
      const available = freeSlots
        .filter((slot) => slot.endMinutes - slot.startMinutes >= 30)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
      const parts: Array<{ slot: FreeSlot; duration: number }> = [];
      let remaining = dur;
      for (const slot of available) {
        if (remaining <= 0) break;
        const capacity = Math.floor((slot.endMinutes - slot.startMinutes) / s.snapMinutes) * s.snapMinutes;
        const partDuration = Math.min(remaining, capacity);
        if (partDuration < 30 && remaining > partDuration) continue;
        parts.push({ slot, duration: partDuration });
        remaining -= partDuration;
      }
      if (remaining <= 0 && parts.length > 1) {
        parts.forEach((part, index) => {
          proposed.push({
            id: uid("preview"), taskId: task.id, clonedTaskId: uid("scheduledTask"),
            title: task.title, projectId: task.projectId, scheduledDate: part.slot.date,
            scheduledStart: minutesToTime(part.slot.startMinutes), scheduledEnd: minutesToTime(part.slot.startMinutes + part.duration),
            durationMinutes: part.duration, isPreview: true, reason: `分段建议 ${index + 1}/${parts.length}`,
            priority: task.priority, segmentIndex: index + 1, segmentCount: parts.length,
          });
          consumeSlot(part.slot, part.duration);
        });
      } else {
        unscheduled.push({ taskId: task.id, title: task.title, reason: `总可用时间不足 ${Math.round(dur)} 分钟`, code: "insufficient_capacity", actions: ["shorten", "split", "move_next_day"] });
      }
    } else {
      unscheduled.push({
        taskId: task.id,
        title: task.title,
        reason: `没有 ${Math.round(dur)} 分钟连续空档`,
        code: "no_continuous_slot",
        actions: ["shorten", "split", "move_next_day"],
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
