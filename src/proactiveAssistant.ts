import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PlannerData, Task, TimeEntry, TimelineRecord } from "./types";

export type ProactiveNotification = {
  id: string;
  kind: "summary" | "material_change" | "deadline_risk" | "weather" | "needs_input" | "gap_check";
  title: string;
  body: string;
  metadata?: { action?: string; date?: string; startTime?: string; endTime?: string };
  read_at?: string | null;
  created_at: string;
};

let client: SupabaseClient | null | undefined;

function cloudClient() {
  if (client !== undefined) return client;
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}

export async function listProactiveNotifications() {
  const api = cloudClient();
  if (!api) return [] as ProactiveNotification[];
  const { data, error } = await api
    .from("navopath_notifications")
    .select("id,kind,title,body,metadata,read_at,created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data || []) as ProactiveNotification[];
}

export async function markProactiveNotificationRead(id: string) {
  const api = cloudClient();
  if (!api) return;
  const { error } = await api.from("navopath_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function readProactiveEmailEnabled() {
  const api = cloudClient();
  if (!api) return false;
  const { data, error } = await api.from("navopath_cloud_assistant_settings").select("email_enabled").maybeSingle();
  if (error) throw error;
  return data?.email_enabled === true;
}

export async function setProactiveEmailEnabled(enabled: boolean) {
  const api = cloudClient();
  if (!api) throw new Error("Cloud assistant settings are unavailable.");
  const { data: auth, error: authError } = await api.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to configure email notifications.");
  const { error } = await api.from("navopath_cloud_assistant_settings").update({ email_enabled: enabled }).eq("user_id", auth.user.id);
  if (error) throw error;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function duration(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const from = startHour * 60 + startMinute;
  let to = endHour * 60 + endMinute;
  if (to <= from) to += 24 * 60;
  return Math.max(15, Math.min(1440, to - from));
}

export function recordGapActivity(data: PlannerData, input: { taskId?: string; newTaskTitle?: string; date: string; startTime: string; endTime: string }) {
  const now = new Date().toISOString();
  const minutes = duration(input.startTime, input.endTime);
  const existing = input.taskId ? data.tasks.find((task) => task.id === input.taskId) : undefined;
  const createdTask: Task | undefined = !existing && input.newTaskTitle?.trim()
    ? {
        id: uid("task"), title: input.newTaskTitle.trim().slice(0, 300), dueDate: input.date,
        category: "personal", priority: "medium", notes: "", goalId: "", completed: true,
        completedAt: now, estimatedHours: minutes / 60, order: Date.now(), subtasks: [], createdAt: now, updatedAt: now,
      }
    : undefined;
  const task = existing || createdTask;
  if (!task) throw new Error("Choose an existing task or enter a new task title.");
  const timelineRecord: TimelineRecord = {
    id: uid("record"), taskId: task.id, scheduledDate: input.date, scheduledStart: input.startTime,
    scheduledEnd: input.endTime, executionStatus: "completed", createdAt: now,
  };
  const entry: TimeEntry = {
    id: uid("time"), taskId: task.id, projectId: task.projectId, timelineRecordId: timelineRecord.id,
    startAt: `${input.date}T${input.startTime}:00+08:00`, endAt: `${input.date}T${input.endTime}:00+08:00`,
    durationMinutes: minutes, source: "manual", createdAt: now, updatedAt: now,
  };
  const updatedTask = { ...task, timelineRecords: [...(task.timelineRecords || []), timelineRecord], updatedAt: now };
  return {
    ...data,
    tasks: existing ? data.tasks.map((item) => item.id === existing.id ? updatedTask : item) : [...data.tasks, updatedTask],
    timeEntries: [...(data.timeEntries || []), entry],
  };
}
