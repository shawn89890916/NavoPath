export type Json = Record<string, any>;

export interface CloudAssistantEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ASSISTANT_QUEUE: Queue<AssistantMessage>;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

export type AssistantMessage = {
  userId: string;
  trigger: "morning" | "evening" | "workspace_event";
  scheduledDate?: string;
};

export type TaskOperation =
  | { type: "create_task"; title: string; projectId?: string; dueDate?: string; startTime?: string; durationMinutes?: number; notes?: string; reason?: string }
  | { type: "update_task"; taskId: string; patch: Json; reason?: string }
  | { type: "split_task"; taskId: string; subtasks: Array<{ title: string; estimateMinutes?: number }>; reason?: string }
  | { type: "reschedule_task"; taskId: string; date: string; startTime: string; durationMinutes: number; reason?: string }
  | { type: "upsert_schedule_block"; taskId: string; blockId?: string; date: string; startTime: string; durationMinutes: number; reason?: string };

type Profile = { data: Json; settings: Json; revision: number };
type Change = { entity: "task" | "schedule_block"; taskId: string; before: unknown; after: unknown; reason: string };
type InverseOperation =
  | { type: "delete_task"; taskId: string }
  | { type: "restore_task"; taskId: string; task: Json }
  | { type: "delete_schedule_block"; taskId: string; blockId: string }
  | { type: "restore_schedule_block"; taskId: string; block: Json };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,200}$/;
const EVENT_SETTLE_SECONDS = 30;

export async function serviceDb(env: CloudAssistantEnv, path: string, init?: RequestInit) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function dbJson<T>(env: CloudAssistantEnv, path: string, init?: RequestInit): Promise<T> {
  const response = await serviceDb(env, path, init);
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `Database request failed (${response.status})`);
  return payload as T;
}

function isoNow() {
  return new Date().toISOString();
}

function generatedId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyWebhookSignature(timestamp: string, signatureHeader: string, rawBody: string, token: string, currentTime = Date.now()) {
  const signature = signatureHeader.replace(/^sha256=/i, "");
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(currentTime - seconds * 1000) > 5 * 60 * 1000 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let mismatch = expected.length ^ signature.length;
  for (let index = 0; index < Math.min(expected.length, signature.length); index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return mismatch === 0;
}

function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function shanghaiClockMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMinutes(date: string, start: string, durationMinutes: number) {
  const minute = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + durationMinutes;
  const days = Math.floor(minute / 1440);
  const clock = ((minute % 1440) + 1440) % 1440;
  return {
    scheduledEndDate: addDays(date, days),
    scheduledEnd: `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function redactSensitiveText(value: unknown, max: number) {
  return cleanText(value, max)
    .replace(/\bnvp_[a-f0-9]{20,}\b/gi, "[REDACTED_NAVOPATH_TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [REDACTED]");
}

function taskLocked(task: Json) {
  return task.agentLocked === true || task.manualLocked === true || task.scheduleLocked === true;
}

function hardDeadline(task: Json) {
  return task.hardDeadline === true || task.deadlineType === "hard" || task.dueDateLocked === true;
}

function minutesFrom(date: string, time: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 60_000) + Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

function scheduleConflict(data: Json, taskId: string, blockId: string | undefined, date: string, startTime: string, durationMinutes: number) {
  const requestedStart = minutesFrom(date, startTime);
  const requestedEnd = requestedStart + durationMinutes;
  for (const task of data.tasks || []) {
    for (const record of task.timelineRecords || []) {
      if (task.id === taskId && (!blockId || record.id === blockId)) continue;
      if (record.executionStatus && record.executionStatus !== "scheduled") continue;
      if (!ISO_DATE.test(record.scheduledDate || "") || !CLOCK.test(record.scheduledStart || "") || !CLOCK.test(record.scheduledEnd || "")) continue;
      const otherStart = minutesFrom(record.scheduledDate, record.scheduledStart);
      let otherEnd = minutesFrom(record.scheduledEndDate || record.scheduledDate, record.scheduledEnd);
      if (otherEnd <= otherStart) otherEnd += 1440;
      if (requestedStart < otherEnd && requestedEnd > otherStart) return { taskId: task.id, blockId: record.id };
    }
  }
  return null;
}

export function normalizeTaskOperations(value: unknown): TaskOperation[] {
  if (!Array.isArray(value)) return [];
  const operations: TaskOperation[] = [];
  for (const raw of value.slice(0, 30)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Json;
    const reason = cleanText(item.reason, 500) || undefined;
    if (item.type === "create_task") {
      const title = cleanText(item.title, 300);
      if (!title) continue;
      const startTime = CLOCK.test(item.startTime || "") ? item.startTime : undefined;
      const dueDate = ISO_DATE.test(item.dueDate || "") ? item.dueDate : undefined;
      operations.push({ type: "create_task", title, projectId: SAFE_ID.test(item.projectId || "") ? item.projectId : undefined, dueDate, startTime, durationMinutes: Math.max(15, Math.min(1440, Math.round(Number(item.durationMinutes) || 30))), notes: cleanText(item.notes, 4000), reason });
      continue;
    }
    const taskId = cleanText(item.taskId, 200);
    if (!SAFE_ID.test(taskId)) continue;
    if (item.type === "update_task" && item.patch && typeof item.patch === "object" && !Array.isArray(item.patch)) {
      const patch: Json = {};
      if (typeof item.patch.title === "string" && cleanText(item.patch.title, 300)) patch.title = cleanText(item.patch.title, 300);
      if (typeof item.patch.notes === "string") patch.notes = cleanText(item.patch.notes, 4000);
      if (typeof item.patch.completed === "boolean") patch.completed = item.patch.completed;
      if (typeof item.patch.projectId === "string" && SAFE_ID.test(item.patch.projectId)) patch.projectId = item.patch.projectId;
      if (item.patch.projectId === null) patch.projectId = null;
      if (ISO_DATE.test(item.patch.dueDate || "")) patch.dueDate = item.patch.dueDate;
      if (Number.isFinite(item.patch.estimatedHours)) patch.estimatedHours = Math.max(0.25, Math.min(24, Number(item.patch.estimatedHours)));
      if (Object.keys(patch).length) operations.push({ type: "update_task", taskId, patch, reason });
      continue;
    }
    if (item.type === "split_task" && Array.isArray(item.subtasks)) {
      const subtasks = item.subtasks.slice(0, 12).map((subtask: Json) => ({ title: cleanText(subtask?.title, 240), estimateMinutes: Math.max(15, Math.min(720, Math.round(Number(subtask?.estimateMinutes) || 30))) })).filter((subtask: Json) => subtask.title);
      if (subtasks.length) operations.push({ type: "split_task", taskId, subtasks, reason });
      continue;
    }
    if (item.type === "reschedule_task" || item.type === "upsert_schedule_block") {
      const date = cleanText(item.date, 10);
      const startTime = cleanText(item.startTime, 5);
      const durationMinutes = Math.max(15, Math.min(1440, Math.round(Number(item.durationMinutes) || 0)));
      if (!ISO_DATE.test(date) || !CLOCK.test(startTime) || !durationMinutes) continue;
      if (item.type === "reschedule_task") operations.push({ type: item.type, taskId, date, startTime, durationMinutes, reason });
      else operations.push({ type: item.type, taskId, blockId: SAFE_ID.test(item.blockId || "") ? item.blockId : undefined, date, startTime, durationMinutes, reason });
    }
  }
  return operations;
}

export function previewTaskOperations(data: Json, input: unknown, options: { allowProtected?: boolean } = {}) {
  const operations = normalizeTaskOperations(input);
  const next = clone(data);
  const changes: Change[] = [];
  const inverseOperations: InverseOperation[] = [];
  const confirmationRequired: Array<{ operation: TaskOperation; reason: string }> = [];
  const tasks: Json[] = Array.isArray(next.tasks) ? next.tasks : [];
  next.tasks = tasks;

  for (const operation of operations) {
    if (operation.type === "create_task") {
      const timestamp = isoNow();
      const id = generatedId("task");
      const task: Json = { id, title: operation.title, dueDate: operation.dueDate || shanghaiDate(), category: "personal", priority: "medium", notes: operation.notes || "", goalId: "", projectId: operation.projectId, completed: false, estimatedHours: (operation.durationMinutes || 30) / 60, order: Date.now(), subtasks: [], createdAt: timestamp, updatedAt: timestamp };
      if (operation.startTime) {
        const conflict = scheduleConflict(next, id, undefined, task.dueDate, operation.startTime, operation.durationMinutes || 30);
        if (conflict) throw new Error(`SCHEDULE_CONFLICT:${conflict.taskId}:${conflict.blockId}`);
        const end = addMinutes(task.dueDate, operation.startTime, operation.durationMinutes || 30);
        task.timelineRecords = [{ id: generatedId("record"), taskId: id, scheduledDate: task.dueDate, scheduledStart: operation.startTime, ...end, executionStatus: "scheduled", createdAt: timestamp }];
      }
      tasks.push(task);
      changes.push({ entity: "task", taskId: id, before: null, after: task, reason: operation.reason || "Created by the cloud assistant" });
      inverseOperations.unshift({ type: "delete_task", taskId: id });
      continue;
    }

    const index = tasks.findIndex((task) => task.id === operation.taskId);
    if (index < 0) throw new Error(`Task not found: ${operation.taskId}`);
    const task = tasks[index];
    if (operation.type === "update_task") {
      if (!options.allowProtected && hardDeadline(task) && operation.patch.dueDate && operation.patch.dueDate !== task.dueDate) {
        confirmationRequired.push({ operation, reason: "Moving a hard deadline requires confirmation." });
        continue;
      }
      const before = clone(task);
      const patch = { ...operation.patch };
      const clearProject = patch.projectId === null;
      if (clearProject) delete patch.projectId;
      const updated: Json = { ...task, ...patch, updatedAt: isoNow() };
      if (clearProject) delete updated.projectId;
      tasks[index] = updated;
      changes.push({ entity: "task", taskId: task.id, before, after: updated, reason: operation.reason || "Updated by the cloud assistant" });
      inverseOperations.unshift({ type: "restore_task", taskId: task.id, task: before });
      continue;
    }
    if (operation.type === "split_task") {
      const before = clone(task);
      const existing = Array.isArray(task.subtasks) ? task.subtasks : [];
      const timestamp = isoNow();
      const added = operation.subtasks.map((subtask, offset) => ({ id: generatedId("subtask"), title: subtask.title, completed: false, order: existing.length + offset, estimateMinutes: subtask.estimateMinutes, createdAt: timestamp }));
      const updated = { ...task, subtasks: [...existing, ...added], updatedAt: timestamp };
      tasks[index] = updated;
      changes.push({ entity: "task", taskId: task.id, before, after: updated, reason: operation.reason || "Split into actionable subtasks" });
      inverseOperations.unshift({ type: "restore_task", taskId: task.id, task: before });
      continue;
    }

    if (!options.allowProtected && taskLocked(task)) {
      confirmationRequired.push({ operation, reason: "The user manually locked this task's schedule." });
      continue;
    }
    const records: Json[] = Array.isArray(task.timelineRecords) ? [...task.timelineRecords] : [];
    const selectedIndex = operation.type === "upsert_schedule_block" && operation.blockId
      ? records.findIndex((record) => record.id === operation.blockId)
      : records.findIndex((record) => !record.executionStatus || record.executionStatus === "scheduled");
    const existing = selectedIndex >= 0 ? records[selectedIndex] : null;
    const conflict = scheduleConflict(next, task.id, existing?.id, operation.date, operation.startTime, operation.durationMinutes);
    if (conflict) throw new Error(`SCHEDULE_CONFLICT:${conflict.taskId}:${conflict.blockId}`);
    const end = addMinutes(operation.date, operation.startTime, operation.durationMinutes);
    const requestedBlockId = operation.type === "upsert_schedule_block" ? operation.blockId : undefined;
    const block = { ...(existing || {}), id: existing?.id || requestedBlockId || generatedId("record"), taskId: task.id, scheduledDate: operation.date, scheduledStart: operation.startTime, ...end, executionStatus: "scheduled", createdAt: existing?.createdAt || isoNow() };
    if (selectedIndex >= 0) records[selectedIndex] = block;
    else records.push(block);
    tasks[index] = { ...task, timelineRecords: records, estimatedHours: operation.durationMinutes / 60, updatedAt: isoNow() };
    changes.push({ entity: "schedule_block", taskId: task.id, before: existing, after: block, reason: operation.reason || "Rescheduled by the cloud assistant" });
    inverseOperations.unshift(existing ? { type: "restore_schedule_block", taskId: task.id, block: existing } : { type: "delete_schedule_block", taskId: task.id, blockId: block.id });
  }
  return { data: next, operations, changes, inverseOperations, confirmationRequired };
}

function applyInverseOperations(data: Json, input: unknown) {
  const next = clone(data);
  const tasks: Json[] = Array.isArray(next.tasks) ? next.tasks : [];
  next.tasks = tasks;
  if (!Array.isArray(input)) throw new Error("Invalid inverse operations");
  for (const raw of input) {
    const operation = raw as InverseOperation;
    if (operation.type === "delete_task") next.tasks = next.tasks.filter((task: Json) => task.id !== operation.taskId);
    else if (operation.type === "restore_task") {
      const index = next.tasks.findIndex((task: Json) => task.id === operation.taskId);
      if (index >= 0) next.tasks[index] = clone(operation.task);
      else next.tasks.push(clone(operation.task));
    } else {
      const taskIndex = next.tasks.findIndex((task: Json) => task.id === operation.taskId);
      if (taskIndex < 0) throw new Error("Undo target task not found");
      const records = [...(next.tasks[taskIndex].timelineRecords || [])];
      if (operation.type === "delete_schedule_block") next.tasks[taskIndex] = { ...next.tasks[taskIndex], timelineRecords: records.filter((record: Json) => record.id !== operation.blockId), updatedAt: isoNow() };
      if (operation.type === "restore_schedule_block") {
        const blockIndex = records.findIndex((record: Json) => record.id === operation.block.id);
        if (blockIndex >= 0) records[blockIndex] = clone(operation.block);
        else records.push(clone(operation.block));
        next.tasks[taskIndex] = { ...next.tasks[taskIndex], timelineRecords: records, updatedAt: isoNow() };
      }
    }
  }
  return next;
}

export async function getCloudProfile(env: CloudAssistantEnv, userId: string): Promise<Profile> {
  const rows = await dbJson<Profile[]>(env, `dayflow_profiles?select=data,settings,revision&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (!rows[0]) throw new Error("Workspace not found");
  return rows[0];
}

export async function batchUpdateTasks(env: CloudAssistantEnv, userId: string, params: { operations: unknown; dryRun: boolean; commit: boolean; idempotencyKey: string; source?: "cloud_assistant" | "mcp" | "workspace_event" | "manual"; summary?: string; reason?: string }) {
  if (!params.dryRun && !params.commit) throw new Error("Set dry_run=true to preview or commit=true to apply");
  if (!/^[A-Za-z0-9._:-]{8,240}$/.test(params.idempotencyKey)) throw new Error("Invalid idempotency_key");
  const profile = await getCloudProfile(env, userId);
  const preview = previewTaskOperations(profile.data, params.operations);
  const publicPreview = { operations: preview.operations, changes: preview.changes, confirmationRequired: preview.confirmationRequired };
  if (params.dryRun || !params.commit) return { dryRun: true, revision: profile.revision, ...publicPreview };
  if (preview.confirmationRequired.length) {
    const rows = await dbJson<Json[]>(env, "rpc/record_navopath_pending_change_set", { method: "POST", body: JSON.stringify({ target_user_id: userId, expected_revision: profile.revision, next_idempotency_key: params.idempotencyKey, next_source: params.source || "mcp", next_summary: params.summary || "Confirmation required", next_reason: params.reason || "Protected schedule or deadline", next_changes: preview.confirmationRequired }) });
    return { applied: false, confirmationRequired: preview.confirmationRequired, changeSet: rows[0] };
  }
  if (!preview.changes.length) return { applied: false, revision: profile.revision, changes: [] };
  const rows = await dbJson<Json[]>(env, "rpc/apply_navopath_cloud_change_set", { method: "POST", body: JSON.stringify({ target_user_id: userId, expected_revision: profile.revision, next_data: preview.data, next_idempotency_key: params.idempotencyKey, next_source: params.source || "mcp", next_summary: params.summary || `${preview.changes.length} task change(s)`, next_reason: params.reason || "Validated NavoPath tool call", next_changes: preview.changes, next_inverse_operations: preview.inverseOperations, next_undo_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }) });
  return { applied: true, changeSet: rows[0], changes: preview.changes };
}

export async function getChangesSince(env: CloudAssistantEnv, userId: string, cursor: number) {
  const safeCursor = Math.max(0, Math.floor(cursor || 0));
  const rows = await dbJson<Json[]>(env, `navopath_cloud_change_sets?select=id,change_cursor,source,status,summary,reason,changes,base_revision,applied_revision,undo_expires_at,undone_at,created_at&user_id=eq.${encodeURIComponent(userId)}&change_cursor=gt.${safeCursor}&order=change_cursor.asc&limit=100`);
  return { cursor: rows.length ? rows[rows.length - 1].change_cursor : safeCursor, changes: rows };
}

export async function getActivityHistory(env: CloudAssistantEnv, userId: string, limit = 30) {
  return dbJson<Json[]>(env, `navopath_cloud_change_sets?select=id,change_cursor,source,status,summary,reason,changes,base_revision,applied_revision,undo_expires_at,undone_at,created_at&user_id=eq.${encodeURIComponent(userId)}&order=change_cursor.desc&limit=${Math.max(1, Math.min(100, Math.floor(limit)))}`);
}

export async function undoChange(env: CloudAssistantEnv, userId: string, changeSetId: string) {
  const profile = await getCloudProfile(env, userId);
  const rows = await dbJson<Json[]>(env, `navopath_cloud_change_sets?select=id,status,applied_revision,undo_expires_at,inverse_operations&user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(changeSetId)}&limit=1`);
  const change = rows[0];
  if (!change) throw new Error("Change set not found");
  if (change.status !== "applied" || change.applied_revision !== profile.revision) throw new Error("Later workspace changes prevent undo");
  if (!change.undo_expires_at || Date.parse(change.undo_expires_at) < Date.now()) throw new Error("Undo window expired");
  const nextData = applyInverseOperations(profile.data, change.inverse_operations);
  const result = await dbJson<Json[]>(env, "rpc/undo_navopath_cloud_change_set", { method: "POST", body: JSON.stringify({ target_user_id: userId, target_change_set_id: changeSetId, expected_revision: profile.revision, next_data: nextData }) });
  return result[0];
}

export async function confirmChange(env: CloudAssistantEnv, userId: string, changeSetId: string) {
  const profile = await getCloudProfile(env, userId);
  const rows = await dbJson<Json[]>(env, `navopath_cloud_change_sets?select=id,status,base_revision,changes&user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(changeSetId)}&limit=1`);
  const change = rows[0];
  if (!change || change.status !== "pending_confirmation") throw new Error("Pending change set not found");
  if (change.base_revision !== profile.revision) throw new Error("Workspace changed after confirmation was requested");
  const operations = Array.isArray(change.changes) ? change.changes.map((item: Json) => item.operation) : [];
  const preview = previewTaskOperations(profile.data, operations, { allowProtected: true });
  if (!preview.changes.length) throw new Error("Pending change set has no valid operations");
  const result = await dbJson<Json[]>(env, "rpc/confirm_navopath_cloud_change_set", { method: "POST", body: JSON.stringify({ target_user_id: userId, target_change_set_id: changeSetId, expected_revision: profile.revision, next_data: preview.data, next_changes: preview.changes, next_inverse_operations: preview.inverseOperations, next_undo_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }) });
  return result[0];
}

export async function ingestWorkspaceEvent(env: CloudAssistantEnv, userId: string, payload: Json) {
  const dedupeKey = cleanText(payload.dedupe_key, 200);
  const summary = redactSensitiveText(payload.summary, 4000);
  const scheduleImpact = redactSensitiveText(payload.schedule_impact, 2000);
  const timestamp = cleanText(payload.timestamp, 64);
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(dedupeKey)) throw new Error("Invalid dedupe_key");
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) throw new Error("Invalid timestamp");
  const changedFiles = Array.isArray(payload.changed_files) ? payload.changed_files.slice(0, 100).map((entry: unknown) => typeof entry === "string" ? cleanText(entry, 500) : { path: cleanText((entry as Json)?.path, 500), change_type: cleanText((entry as Json)?.change_type, 32), content_hash: cleanText((entry as Json)?.content_hash, 128) }).filter((entry: unknown) => typeof entry === "string" ? entry : (entry as Json).path) : [];
  const fragments = Array.isArray(payload.fragments) ? payload.fragments.slice(0, 20).map((entry: Json) => ({ path: cleanText(entry?.path, 500), excerpt: redactSensitiveText(entry?.excerpt, 4000), content_hash: cleanText(entry?.content_hash, 128) })).filter((entry: Json) => entry.path && entry.excerpt) : [];
  const fragmentBytes = new TextEncoder().encode(JSON.stringify(fragments)).byteLength;
  if (fragmentBytes > 24_000) throw new Error("Workspace fragments exceed 24 KB");
  const existing = await dbJson<Json[]>(env, `navopath_workspace_events?select=id,event_cursor,status&user_id=eq.${encodeURIComponent(userId)}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&limit=1`);
  if (existing[0]) return { accepted: true, duplicate: true, event: existing[0] };
  try {
    const created = await dbJson<Json[]>(env, "navopath_workspace_events", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId, dedupe_key: dedupeKey, changed_files: changedFiles, fragments, summary, schedule_impact: scheduleImpact, source_timestamp: new Date(timestamp).toISOString() }) });
    await env.ASSISTANT_QUEUE.send({ userId, trigger: "workspace_event" }, { delaySeconds: 45 });
    return { accepted: true, duplicate: false, event: created[0] };
  } catch (error) {
    const raced = await dbJson<Json[]>(env, `navopath_workspace_events?select=id,event_cursor,status&user_id=eq.${encodeURIComponent(userId)}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&limit=1`);
    if (raced[0]) return { accepted: true, duplicate: true, event: raced[0] };
    throw error;
  }
}

export async function configureCloudAssistant(env: CloudAssistantEnv, userId: string, enabled: boolean, emailEnabled: boolean) {
  const rows = await dbJson<Json[]>(env, "navopath_cloud_assistant_settings?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, enabled, email_enabled: emailEnabled, timezone: "Asia/Shanghai", morning_time: "08:30", evening_time: "20:30", quiet_after: "19:00", quiet_until: "08:30", updated_at: isoNow() }) });
  return rows[0];
}

function nextMorning() {
  const date = shanghaiDate();
  const target = new Date(`${shanghaiClockMinutes() >= 8 * 60 + 30 ? addDays(date, 1) : date}T00:30:00Z`);
  return target.toISOString();
}

export async function sendNotification(env: CloudAssistantEnv, userId: string, input: Json) {
  const kind = ["summary", "material_change", "deadline_risk", "weather", "needs_input"].includes(input.kind) ? input.kind : "summary";
  const urgency = input.urgency === "urgent" ? "urgent" : "normal";
  const title = cleanText(input.title, 160);
  const body = cleanText(input.body, 2000);
  const idempotencyKey = cleanText(input.idempotency_key, 240);
  if (!title || !body || !/^[A-Za-z0-9._:-]{8,240}$/.test(idempotencyKey)) throw new Error("Invalid notification");
  const currentMinutes = shanghaiClockMinutes();
  const quiet = currentMinutes >= 19 * 60 || currentMinutes < 8 * 60 + 30;
  const interruptible = urgency === "urgent" && kind === "deadline_risk";
  const deliverAfter = quiet && !interruptible ? nextMorning() : isoNow();
  const settings = await dbJson<Json[]>(env, `navopath_cloud_assistant_settings?select=email_enabled&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  const channels = ["in_app", ...(settings[0]?.email_enabled ? ["email"] : [])];
  const rows = await dbJson<Json[]>(env, "navopath_notifications?on_conflict=user_id,idempotency_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, idempotency_key: idempotencyKey, kind, title, body, urgency, channels, status: quiet && !interruptible ? "deferred" : "sent", deliver_after: deliverAfter, sent_at: quiet && !interruptible ? null : isoNow(), metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {} }) });
  if (rows[0] && channels.includes("email") && (!quiet || interruptible)) await sendEmail(env, userId, title, body);
  return rows[0] || { duplicate: true };
}

async function sendEmail(env: CloudAssistantEnv, userId: string, subject: string, body: string) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) return;
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!userResponse.ok) return;
  const email = (await userResponse.json() as Json).email;
  if (typeof email !== "string" || !email.includes("@")) return;
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject, text: body }) });
}

async function deliverDueNotifications(env: CloudAssistantEnv, userId: string) {
  const due = await dbJson<Json[]>(env, `navopath_notifications?select=id,title,body,channels&user_id=eq.${encodeURIComponent(userId)}&status=eq.deferred&deliver_after=lte.${encodeURIComponent(isoNow())}&order=created_at.asc&limit=20`);
  for (const notification of due) {
    if (Array.isArray(notification.channels) && notification.channels.includes("email")) await sendEmail(env, userId, notification.title, notification.body);
    await serviceDb(env, `navopath_notifications?id=eq.${encodeURIComponent(notification.id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ status: "sent", sent_at: isoNow() }) });
  }
}

async function fetchWenzhouWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=27.9938&longitude=120.6994&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation_probability,temperature_2m,weather_code&forecast_days=2&timezone=Asia%2FShanghai";
  const response = await fetch(url, { headers: { "user-agent": "NavoPath-Cloud-Assistant/1.0" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const data = await response.json() as Json;
  return { current: data.current || {}, next24Hours: (data.hourly?.time || []).slice(0, 24).map((time: string, index: number) => ({ time, precipitationProbability: data.hourly?.precipitation_probability?.[index], temperature: data.hourly?.temperature_2m?.[index], weatherCode: data.hourly?.weather_code?.[index] })) };
}

function compactWorkspace(profile: Profile, date: string) {
  const tomorrow = addDays(date, 1);
  const tasks = (profile.data.tasks || []).filter((task: Json) => !task.completed).slice(0, 160).map((task: Json) => ({ id: task.id, title: cleanText(task.title, 300), projectId: task.projectId || null, dueDate: task.dueDate || null, priority: task.priority || null, importance: task.importance || null, urgency: task.urgency || null, estimatedMinutes: Math.round((Number(task.estimatedHours) || 0.5) * 60), agentLocked: taskLocked(task), hardDeadline: hardDeadline(task), subtasks: (task.subtasks || []).slice(0, 12).map((subtask: Json) => ({ id: subtask.id, title: cleanText(subtask.title, 240), completed: Boolean(subtask.completed || subtask.done) })), schedule: (task.timelineRecords || []).filter((record: Json) => [date, tomorrow].includes(record.scheduledDate) && (!record.executionStatus || record.executionStatus === "scheduled")).map((record: Json) => ({ id: record.id, date: record.scheduledDate, start: record.scheduledStart, endDate: record.scheduledEndDate || record.scheduledDate, end: record.scheduledEnd })) }));
  const habits = (profile.data.habits || []).filter((habit: Json) => habit.archived !== true).slice(0, 40).map((habit: Json) => ({ id: habit.id, title: cleanText(habit.title, 240), defaultDurationMinutes: Math.max(5, Math.min(720, Number(habit.defaultDurationMinutes) || 30)), frequencyRule: habit.frequencyRule || "daily", activeWeekdays: Array.isArray(habit.activeWeekdays) ? habit.activeWeekdays.slice(0, 7) : [], reminder: habit.reminder?.enabled ? { enabled: true, time: cleanText(habit.reminder.time, 5) } : { enabled: false } }));
  const habitHistory = (profile.data.habitDailyStates || []).filter((state: Json) => state.date >= addDays(date, -30) && state.date <= date).slice(-500).map((state: Json) => ({ habitId: state.habitId, date: state.date, completed: state.completed === true }));
  return { revision: profile.revision, date, tomorrow, tasks, habits, habitHistory };
}

function mergeFileSnapshot(previous: unknown, events: Json[]) {
  const previousFiles = previous && typeof previous === "object" && Array.isArray((previous as Json).files) ? (previous as Json).files : [];
  const files = new Map<string, Json>();
  for (const item of previousFiles.slice(-100)) {
    const path = cleanText(item?.path, 500);
    if (path) files.set(path, { path, change_type: cleanText(item.change_type, 32), content_hash: cleanText(item.content_hash, 128), excerpt: cleanText(item.excerpt, 2000), timestamp: cleanText(item.timestamp, 64) });
  }
  for (const event of events) {
    for (const raw of event.changed_files || []) {
      const item = typeof raw === "string" ? { path: raw } : raw;
      const path = cleanText(item?.path, 500);
      if (!path) continue;
      if (item.change_type === "deleted") files.delete(path);
      else files.set(path, { ...(files.get(path) || {}), path, change_type: cleanText(item.change_type, 32), content_hash: cleanText(item.content_hash, 128), timestamp: event.source_timestamp });
    }
    for (const fragment of event.fragments || []) {
      const path = cleanText(fragment?.path, 500);
      if (!path) continue;
      files.set(path, { ...(files.get(path) || {}), path, content_hash: cleanText(fragment.content_hash, 128), excerpt: cleanText(fragment.excerpt, 2000), timestamp: event.source_timestamp });
    }
  }
  return [...files.values()].sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || ""))).slice(-100);
}

const resultTool = {
  type: "function",
  function: {
    name: "batch_update_tasks",
    description: "Propose a validated NavoPath task batch and an optional notification. The backend decides whether to apply it.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "reason", "operations", "notification"],
      properties: {
        summary: { type: "string", maxLength: 1200 },
        reason: { type: "string", maxLength: 1200 },
        operations: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["type", "taskId", "title", "projectId", "dueDate", "startTime", "durationMinutes", "notes", "blockId", "patch", "subtasks", "reason"], properties: { type: { type: "string", enum: ["create_task", "update_task", "split_task", "reschedule_task", "upsert_schedule_block"] }, taskId: { type: ["string", "null"] }, title: { type: ["string", "null"] }, projectId: { type: ["string", "null"] }, dueDate: { type: ["string", "null"] }, startTime: { type: ["string", "null"] }, durationMinutes: { type: ["integer", "null"] }, notes: { type: ["string", "null"] }, blockId: { type: ["string", "null"] }, patch: { type: ["object", "null"], additionalProperties: false, required: ["title", "notes", "projectId", "completed", "dueDate", "estimatedHours"], properties: { title: { type: ["string", "null"] }, notes: { type: ["string", "null"] }, projectId: { type: ["string", "null"] }, completed: { type: ["boolean", "null"] }, dueDate: { type: ["string", "null"] }, estimatedHours: { type: ["number", "null"] } } }, subtasks: { type: ["array", "null"], maxItems: 12, items: { type: "object", additionalProperties: false, required: ["title", "estimateMinutes"], properties: { title: { type: "string" }, estimateMinutes: { type: "integer" } } } }, reason: { type: "string" } } } },
        notification: { type: ["object", "null"], additionalProperties: false, required: ["kind", "title", "body", "urgency"], properties: { kind: { type: "string", enum: ["summary", "material_change", "deadline_risk", "weather", "needs_input"] }, title: { type: "string" }, body: { type: "string" }, urgency: { type: "string", enum: ["normal", "urgent"] } } },
      },
    },
  },
};

async function callDecisionModel(env: CloudAssistantEnv, context: Json) {
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/ai-assistant`, { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ mode: "cloud_decision", cloudContext: context, cloudTool: resultTool }), signal: AbortSignal.timeout(55_000) });
  if (!response.ok) throw new Error(`Decision model failed (${response.status})`);
  const payload = await response.json() as Json;
  const call = payload?.toolCall;
  if (call?.name !== "batch_update_tasks" || typeof call.arguments !== "string") throw new Error("Decision model did not return the required tool call");
  const parsed = JSON.parse(call.arguments);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.operations)) throw new Error("Decision model returned invalid arguments");
  return { summary: cleanText(parsed.summary, 1200), reason: cleanText(parsed.reason, 1200), operations: normalizeTaskOperations(parsed.operations), notification: parsed.notification && typeof parsed.notification === "object" ? parsed.notification : null, model: payload.model || "deepseek-ai/DeepSeek-V4-Flash" };
}

async function claimJob(env: CloudAssistantEnv, message: AssistantMessage, eventIds: string[], key: string) {
  const rows = await dbJson<Json[]>(env, "rpc/claim_navopath_assistant_job", { method: "POST", body: JSON.stringify({ target_user_id: message.userId, next_idempotency_key: key, next_trigger: message.trigger, next_event_ids: eventIds }) });
  return rows[0];
}

async function updateJob(env: CloudAssistantEnv, jobId: string, patch: Json) {
  await serviceDb(env, `navopath_assistant_jobs?id=eq.${encodeURIComponent(jobId)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function processAssistantMessage(env: CloudAssistantEnv, message: AssistantMessage) {
  const date = message.scheduledDate || shanghaiDate();
  let events: Json[] = [];
  if (message.trigger === "workspace_event") {
    const readyBefore = new Date(Date.now() - EVENT_SETTLE_SECONDS * 1000).toISOString();
    events = await dbJson<Json[]>(env, "rpc/claim_navopath_workspace_events", { method: "POST", body: JSON.stringify({ target_user_id: message.userId, ready_before: readyBefore, max_events: 50 }) });
    if (!events.length) return { skipped: "no_new_events" };
  }
  const eventIds = events.map((event) => event.id).sort();
  const key = message.trigger === "workspace_event" ? `event:${await sha256(eventIds.join(":"))}` : `schedule:${message.trigger}:${date}`;
  const job = await claimJob(env, message, eventIds, key);
  if (!job?.claimed) return { skipped: "duplicate_job" };
  try {
    await deliverDueNotifications(env, message.userId);
    const [profile, settingsRows, stateRows, activityRows] = await Promise.all([
      getCloudProfile(env, message.userId),
      dbJson<Json[]>(env, `navopath_cloud_assistant_settings?select=*&user_id=eq.${encodeURIComponent(message.userId)}&limit=1`),
      dbJson<Json[]>(env, `navopath_cloud_assistant_state?select=*&user_id=eq.${encodeURIComponent(message.userId)}&limit=1`),
      dbJson<Json[]>(env, `navopath_cloud_change_sets?select=source,status,summary,reason,created_at&user_id=eq.${encodeURIComponent(message.userId)}&order=change_cursor.desc&limit=20`),
    ]);
    if (message.trigger !== "workspace_event" && settingsRows[0]?.enabled !== true) {
      await updateJob(env, job.job_id, { status: "completed", result: { skipped: "disabled" }, finished_at: isoNow() });
      return { skipped: "disabled" };
    }
    const weather = message.trigger === "morning" ? await fetchWenzhouWeather().catch(() => null) : null;
    const eventContext = events.map((event) => ({ changed_files: event.changed_files, fragments: event.fragments, summary: event.summary, schedule_impact: event.schedule_impact, timestamp: event.source_timestamp }));
    const plannerSnapshot = compactWorkspace(profile, date);
    const fileSnapshot = mergeFileSnapshot(stateRows[0]?.last_snapshot, events);
    const context = { trigger: message.trigger, timezone: "Asia/Shanghai", workspace: plannerSnapshot, weather, events: eventContext, workspaceSnapshot: fileSnapshot.slice(-40).map((file) => ({ ...file, excerpt: cleanText(file.excerpt, 800) })), persistentState: { preferences: settingsRows[0]?.preferences || {}, lastScanSummary: stateRows[0]?.last_scan_summary || "", eventCursor: stateRows[0]?.event_cursor || 0, recentActivity: activityRows } };
    await updateJob(env, job.job_id, { model_called: true });
    const decision = await callDecisionModel(env, context);
    const applied = await batchUpdateTasks(env, message.userId, { operations: decision.operations, dryRun: false, commit: true, idempotencyKey: key, source: message.trigger === "workspace_event" ? "workspace_event" : "cloud_assistant", summary: decision.summary, reason: decision.reason });
    const notification = decision.notification && (applied.applied || applied.confirmationRequired?.length || decision.notification.kind === "material_change" || decision.notification.kind === "deadline_risk" || decision.notification.kind === "weather" || decision.notification.kind === "needs_input")
      ? await sendNotification(env, message.userId, { ...decision.notification, idempotency_key: `${key}:notification`.slice(0, 240), metadata: { changeSetId: applied.changeSet?.change_set_id || null } })
      : null;
    const maxCursor = events.reduce((max, event) => Math.max(max, Number(event.event_cursor) || 0), Number(stateRows[0]?.event_cursor) || 0);
    await serviceDb(env, "navopath_cloud_assistant_state?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: message.userId, event_cursor: maxCursor, last_snapshot: { planner: plannerSnapshot, files: fileSnapshot }, last_scan_summary: decision.summary, last_model_call_at: isoNow(), ...(message.trigger === "morning" ? { last_morning_run_date: date } : {}), ...(message.trigger === "evening" ? { last_evening_run_date: date } : {}), updated_at: isoNow() }) });
    if (events.length) await serviceDb(env, `navopath_workspace_events?id=in.(${events.map((event) => event.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ status: "processed", processed_at: isoNow() }) });
    const result = { model: decision.model, summary: decision.summary, applied, notification };
    await updateJob(env, job.job_id, { status: "completed", result, finished_at: isoNow() });
    return result;
  } catch (error) {
    const messageText = error instanceof Error ? error.message.slice(0, 1000) : "Assistant job failed";
    await updateJob(env, job.job_id, { status: "failed", failure_reason: messageText, finished_at: isoNow() });
    if (events.length) await serviceDb(env, `navopath_workspace_events?id=in.(${events.map((event) => event.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ status: "pending", failure_reason: messageText }) });
    throw error;
  }
}

export async function scheduleCloudRuns(env: CloudAssistantEnv, trigger: "morning" | "evening", date = shanghaiDate()) {
  const rows = await dbJson<Array<{ user_id: string }>>(env, "navopath_cloud_assistant_settings?select=user_id&enabled=eq.true");
  await Promise.all(rows.map((row) => env.ASSISTANT_QUEUE.send({ userId: row.user_id, trigger, scheduledDate: date })));
  return rows.length;
}
