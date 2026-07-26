import type { AiChatMessage, AiMemoryPatch } from "./aiAssistantApi";
import type { AiMemory, Category, NullablePriority, PlannerData, Task } from "./types";
import { addDays } from "./utils/recurrence";
import { addMinutes, durationMinutes, SLOT_MINUTES } from "./timelineGeometry";

export type AiContextSummary = {
  currentViewDate: string;
  page: "execute" | "planning";
  projects: Array<{ id: string; title: string; category: Category; color?: string; importance?: NullablePriority; urgency?: NullablePriority; notes?: string }>;
  activeTasks: Array<{ id: string; title: string; projectId?: string; dueDate: string; priority: NullablePriority; scheduled?: string[]; subtasks?: string[]; notes?: string }>;
  upcomingEvents: Array<{ id: string; title: string; date: string; startTime?: string; endTime?: string; details?: string }>;
  scheduledToday: Array<{ id: string; title: string; start: string; end: string; projectId?: string }>;
  recentNotes: Array<{ content: string; tags: string[]; createdAt: string }>;
  focusTask?: { id: string; title: string; notes?: string; projectId?: string; subtasks?: string[] };
};

type AiHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  status?: "thinking" | "done" | "error";
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

export function compactText(value: string | undefined, limit = 180) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function taskDuration(task: Task) {
  if (task.scheduledStart && task.scheduledEnd) {
    return Math.max(durationMinutes(task.scheduledStart, task.scheduledEnd), SLOT_MINUTES);
  }
  return Math.max(Math.round((task.estimatedHours || 0.5) * 60), SLOT_MINUTES);
}

function taskScheduleLabels(task: Task) {
  const records = (task.timelineRecords || [])
    .filter((record) => record.executionStatus === "scheduled")
    .map((record) => `${record.scheduledDate} ${record.scheduledStart}-${record.scheduledEnd}`);
  if (task.scheduledDate && task.scheduledStart) {
    records.push(`${task.scheduledDate} ${task.scheduledStart}-${task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task))}`);
  }
  return records.slice(-4);
}

export function buildAiContext(data: PlannerData, params: {
  date: string;
  mode: "execute" | "planning";
  focusTask?: Task | null;
}): AiContextSummary {
  const rangeEnd = addDays(params.date, 14);
  const scheduledToday = data.tasks
    .flatMap((task) => {
      const records = (task.timelineRecords || [])
        .filter((record) => record.executionStatus === "scheduled" && record.scheduledDate === params.date)
        .map((record) => ({ id: record.id, title: task.title, start: record.scheduledStart, end: record.scheduledEnd, projectId: task.projectId }));
      if (task.scheduledDate === params.date && task.scheduledStart) {
        records.push({ id: task.id, title: task.title, start: task.scheduledStart, end: task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task)), projectId: task.projectId });
      }
      return records;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  return {
    currentViewDate: params.date,
    page: params.mode,
    projects: data.projects.slice(0, 24).map((project) => ({
      id: project.id,
      title: project.title,
      category: project.category,
      color: project.color,
      importance: project.importance,
      urgency: project.urgency,
      notes: compactText(project.notes, 120),
    })),
    activeTasks: data.tasks
      .filter((task) => !task.completed)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 30)
      .map((task) => ({
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        dueDate: task.dueDate,
        priority: task.priority,
        scheduled: taskScheduleLabels(task),
        subtasks: (task.subtasks || []).filter((subtask) => !subtask.completed && !subtask.done).slice(0, 6).map((subtask) => subtask.title),
        notes: compactText(task.notes, 160),
      })),
    upcomingEvents: data.events
      .filter((event) => (event.startDate || event.date) >= params.date && (event.startDate || event.date) <= rangeEnd)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date) || (a.startTime || "").localeCompare(b.startTime || ""))
      .slice(0, 24)
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: event.startDate || event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        details: compactText(event.details, 140),
      })),
    scheduledToday,
    recentNotes: (data.notes || []).slice(-8).map((note) => ({
      content: compactText(note.content, 160),
      tags: note.tags || [],
      createdAt: note.createdAt,
    })),
    focusTask: params.focusTask ? {
      id: params.focusTask.id,
      title: params.focusTask.title,
      notes: compactText(params.focusTask.notes, 220),
      projectId: params.focusTask.projectId,
      subtasks: (params.focusTask.subtasks || []).map((subtask) => `${subtask.completed || subtask.done ? "done" : "todo"}: ${subtask.title}`).slice(0, 12),
    } : undefined,
  };
}

export function cleanAiHistoryContent(content: string) {
  const text = content.trim();
  if (!text.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(text) as { reply?: unknown };
    return typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : text;
  } catch {
    return text;
  }
}

export function toAiHistory(
  messages: AiHistoryMessage[],
  fallback: PlannerData["chat"] = [],
  conversation: PlannerData["chat"] = [],
): AiChatMessage[] {
  const local = messages
    .filter((message) => message.status !== "thinking" && message.content.trim())
    .map((message) => ({ role: message.role, content: cleanAiHistoryContent(message.content) }));
  const conversationHistory = (conversation || [])
    .filter((message) => message.content.trim())
    .map((message) => ({ role: message.role, content: cleanAiHistoryContent(message.content) }));
  const fallbackHistory = (fallback || [])
    .filter((message) => message.content.trim())
    .map((message) => ({ role: message.role, content: cleanAiHistoryContent(message.content) }));
  const source = local.length > 0 ? local : conversationHistory.length > 0 ? conversationHistory : fallbackHistory;
  return source.slice(-12);
}

export function extractLocalMemories(message: string): AiMemoryPatch[] {
  const text = compactText(message, 240);
  if (!text) return [];
  const shouldRemember = /(记住|以后|偏好|习惯|我一般|我通常|不要再|别再|优先|尽量)/.test(text);
  return shouldRemember ? [{ content: text, tags: ["user-preference"] }] : [];
}

export function pickMemoriesForContext(memories: AiMemory[]) {
  const active = (memories || []).filter((memory) => !memory.archived && memory.content.trim());
  const pinned = active.filter((memory) => memory.pinned);
  const recent = active
    .filter((memory) => !memory.pinned)
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  return [...pinned, ...recent].slice(0, 24).map((memory) => ({
    content: memory.content,
    tags: memory.tags || [],
    source: memory.source || "auto",
  }));
}

export function mergeAiMemories(data: PlannerData, patches: AiMemoryPatch[], source: AiMemory["source"] = "auto") {
  const existing = data.aiMemories || [];
  const seen = new Set(existing.map((memory) => memory.content.trim().toLowerCase()));
  const now = new Date().toISOString();
  const additions = patches
    .map((patch) => ({ content: compactText(patch.content, 280), tags: patch.tags || ["ai-memory"] }))
    .filter((patch) => patch.content && !seen.has(patch.content.toLowerCase()))
    .slice(0, 4)
    .map((patch) => ({ id: uid("memory"), content: patch.content, tags: patch.tags, createdAt: now, updatedAt: now, source, pinned: false, archived: false }));
  const merged = [...existing, ...additions];
  const active = merged.filter((memory) => !memory.archived);
  const archived = merged.filter((memory) => memory.archived);
  return [...archived, ...active.slice(-60)];
}
