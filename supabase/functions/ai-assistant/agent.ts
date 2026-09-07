export type AgentEntity = "task" | "project" | "habit" | "note" | "memory" | "template" | "settings" | "integration" | "app" | "timer";

export type AgentOperation =
  | "create"
  | "update"
  | "schedule"
  | "unschedule"
  | "complete"
  | "checkin"
  | "append_subtasks"
  | "archive"
  | "delete"
  | "update_settings"
  | "navigate"
  | "start"
  | "pause"
  | "restore_entity";

export type AgentRisk = "auto" | "confirm" | "forbidden";
export type AgentSafetyLevel = "ask" | "approve" | "full";

export interface AgentCommand {
  id: string;
  entity: AgentEntity;
  operation: AgentOperation;
  targetId?: string;
  values?: Record<string, unknown>;
  reason?: string;
}

export interface AgentCommandDecision {
  command: AgentCommand;
  risk: AgentRisk;
  reason: string;
}

export interface AgentExecutionResult {
  data: Record<string, any>;
  settings: Record<string, any>;
  applied: Array<{ commandId: string; entity: AgentEntity; operation: AgentOperation; targetId?: string; title: string }>;
  inverseCommands: AgentCommand[];
  clientActions: AgentCommand[];
  integrationCommands: AgentCommand[];
}

type BusyOccurrence = { start_at?: string; end_at?: string; start_date?: string; end_date?: string; all_day?: boolean; status?: string };

const DATA_COLLECTIONS: Partial<Record<AgentEntity, string>> = {
  task: "tasks",
  project: "projects",
  habit: "habits",
  note: "notes",
  memory: "aiMemories",
  template: "scheduleTemplates",
};

const ALLOWED_OPERATIONS: Record<AgentEntity, Set<AgentOperation>> = {
  task: new Set(["create", "update", "schedule", "unschedule", "complete", "append_subtasks", "archive", "delete"]),
  project: new Set(["create", "update", "complete", "archive", "delete"]),
  habit: new Set(["create", "update", "checkin", "archive", "delete"]),
  note: new Set(["create", "update", "delete"]),
  memory: new Set(["create", "update", "archive", "delete"]),
  template: new Set(["create", "update", "delete"]),
  settings: new Set(["update_settings"]),
  integration: new Set(["update"]),
  app: new Set(["navigate"]),
  timer: new Set(["start", "pause"]),
};

const SENSITIVE_SETTING_RE = /(password|secret|token|api.?key|auth|account|identity|mcp|calendar.?url|ics.?url|baseurl)/i;
const RECURRENCE_RE = /recurrence/i;
const ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const MAX_COMMANDS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value: unknown, max: number, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function now() {
  return new Date().toISOString();
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function localDateTime(value: string, timeZone: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

function absoluteLocalMinute(date: string, time: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 60_000) + clockMinutes(time);
}

function scheduleWouldConflict(data: Record<string, any>, targetId: string, date: string, start: string, end: string, busy: BusyOccurrence[], timeZone: string) {
  const requestStart = absoluteLocalMinute(date, start);
  let requestEnd = absoluteLocalMinute(date, end);
  if (requestEnd <= requestStart) requestEnd += 24 * 60;
  const overlaps = (otherStart: number, otherEnd: number) => requestStart < otherEnd && requestEnd > otherStart;
  for (const task of data.tasks || []) {
    for (const record of task.timelineRecords || []) {
      if (record.executionStatus && record.executionStatus !== "scheduled") continue;
      if (!record.scheduledDate || !record.scheduledStart || !record.scheduledEnd) continue;
      const otherStart = absoluteLocalMinute(record.scheduledDate, record.scheduledStart);
      let otherEnd = absoluteLocalMinute(record.scheduledEndDate || record.scheduledDate, record.scheduledEnd);
      if (otherEnd <= otherStart) otherEnd += 24 * 60;
      if (overlaps(otherStart, otherEnd)) return true;
    }
    if (task.id !== targetId && task.scheduledDate && task.scheduledStart && task.scheduledEnd) {
      const otherStart = absoluteLocalMinute(task.scheduledDate, task.scheduledStart);
      let otherEnd = absoluteLocalMinute(task.scheduledDate, task.scheduledEnd);
      if (otherEnd <= otherStart) otherEnd += 24 * 60;
      if (overlaps(otherStart, otherEnd)) return true;
    }
  }
  for (const occurrence of busy) {
    if (occurrence.status === "cancelled") continue;
    if (occurrence.all_day) {
      const startDate = occurrence.start_date || "";
      const endDate = occurrence.end_date || startDate;
      if (date <= endDate && new Date(requestEnd * 60_000).toISOString().slice(0, 10) >= startDate) return true;
      continue;
    }
    if (!occurrence.start_at || !occurrence.end_at) continue;
    const occurrenceStart = localDateTime(occurrence.start_at, timeZone);
    const occurrenceEnd = localDateTime(occurrence.end_at, timeZone);
    const otherStart = absoluteLocalMinute(occurrenceStart.date, occurrenceStart.time);
    let otherEnd = absoluteLocalMinute(occurrenceEnd.date, occurrenceEnd.time);
    if (otherEnd <= otherStart) otherEnd += 24 * 60;
    if (overlaps(otherStart, otherEnd)) return true;
  }
  return false;
}

function generatedId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function normalizeAgentCommands(value: unknown, options: { allowInternalRestore?: boolean } = {}): AgentCommand[] {
  if (!Array.isArray(value)) return [];
  const commands: AgentCommand[] = [];
  for (const raw of value.slice(0, MAX_COMMANDS)) {
    if (!isRecord(raw)) continue;
    const id = boundedText(raw.id, 200);
    const entity = boundedText(raw.entity, 30) as AgentEntity;
    const operation = boundedText(raw.operation, 40) as AgentOperation;
    if (!ID_RE.test(id) || !Object.prototype.hasOwnProperty.call(ALLOWED_OPERATIONS, entity)) continue;
    if (operation === "restore_entity" && options.allowInternalRestore) {
      commands.push({ id, entity, operation, targetId: boundedText(raw.targetId, 200) || undefined, values: isRecord(raw.values) ? clone(raw.values) : undefined });
      continue;
    }
    if (!ALLOWED_OPERATIONS[entity].has(operation)) continue;
    const targetId = boundedText(raw.targetId, 200) || undefined;
    if (!["create", "update_settings", "navigate", "start", "pause"].includes(operation) && !targetId) continue;
    commands.push({
      id,
      entity,
      operation,
      targetId,
      values: isRecord(raw.values) ? clone(raw.values) : {},
      reason: boundedText(raw.reason, 500) || undefined,
    });
  }
  return commands;
}

export function classifyAgentCommands(input: AgentCommand[]): AgentCommandDecision[] {
  const commands = normalizeAgentCommands(input);
  const createCount = commands.filter((command) => command.operation === "create").length;
  const memoryCreateCount = commands.filter((command) => command.entity === "memory" && command.operation === "create").length;
  const existingMutationCount = commands.filter((command) => !["create", "navigate", "start", "pause"].includes(command.operation)).length;
  const forceBatchConfirmation = createCount > 5 || existingMutationCount >= 2 || memoryCreateCount > 4;

  return commands.map((command) => {
    const valueKeys = Object.keys(command.values || {});
    if (command.entity === "settings" && valueKeys.some((key) => SENSITIVE_SETTING_RE.test(key))) {
      return { command, risk: "forbidden", reason: "Sensitive account and credential settings are never available to AI." };
    }
    if (command.entity === "integration") {
      const validToggle = command.operation === "update" && typeof command.values?.enabled === "boolean" && valueKeys.every((key) => key === "enabled");
      return validToggle
        ? { command, risk: "confirm", reason: "External calendar changes require confirmation." }
        : { command, risk: "forbidden", reason: "AI may only enable or disable an existing external calendar; URLs and connection credentials stay manual." };
    }
    if (valueKeys.some((key) => /(?:password|secret|token|api.?key|authorization)/i.test(key))) {
      return { command, risk: "forbidden", reason: "Commands may not contain credentials or authorization material." };
    }
    if (["delete", "archive", "update_settings"].includes(command.operation)) {
      return { command, risk: "confirm", reason: "Destructive, archival, and settings changes require confirmation." };
    }
    if (valueKeys.some((key) => RECURRENCE_RE.test(key))) {
      return { command, risk: "confirm", reason: "Recurrence changes require confirmation." };
    }
    if (forceBatchConfirmation && !["navigate", "start", "pause"].includes(command.operation)) {
      return { command, risk: "confirm", reason: "Bulk changes require confirmation." };
    }
    return { command, risk: "auto", reason: "This is a reversible, low-risk NavoPath action." };
  });
}

export function applyAgentSafetyLevel(decisions: AgentCommandDecision[], level: unknown): AgentCommandDecision[] {
  const safetyLevel: AgentSafetyLevel = level === "ask" || level === "full" ? level : "approve";
  if (safetyLevel === "full") return decisions.map((decision) => decision.risk === "forbidden" ? decision : { ...decision, risk: "auto" });
  return decisions.map((decision) => {
    if (decision.risk === "forbidden" || decision.command.entity === "app") return decision;
    if (safetyLevel === "ask" && decision.risk === "auto") {
      return { ...decision, risk: "confirm", reason: "Approval is required for workspace changes." };
    }
    return decision;
  });
}

function titleFor(item: Record<string, any> | undefined, fallback: string) {
  return boundedText(item?.title ?? item?.content, 120, fallback);
}

function defaultEntity(entity: AgentEntity, values: Record<string, unknown>, timestamp: string): Record<string, any> {
  const title = boundedText(values.title, 300);
  switch (entity) {
    case "task": {
      if (!title) throw new Error("Task title is required");
      return {
        id: generatedId("task"), title, dueDate: boundedText(values.dueDate ?? values.date, 10, timestamp.slice(0, 10)),
        category: boundedText(values.category, 20, "personal"), priority: values.priority ?? "medium", notes: boundedText(values.notes, 10_000),
        goalId: "", completed: false, projectId: boundedText(values.projectId, 200) || undefined,
        estimatedHours: Math.max(Number(values.estimatedHours) || (Number(values.durationMinutes) || 30) / 60, 0.25),
        subtasks: [], order: Date.now(), createdAt: timestamp, updatedAt: timestamp,
      };
    }
    case "project":
      if (!title) throw new Error("Project title is required");
      return { id: generatedId("project"), title, category: boundedText(values.category, 20, "project"), notes: boundedText(values.notes, 10_000), completed: false, order: Date.now(), createdAt: timestamp, updatedAt: timestamp };
    case "habit":
      if (!title) throw new Error("Habit title is required");
      return { id: generatedId("habit"), title, defaultDurationMinutes: Math.max(5, Math.min(1440, Number(values.defaultDurationMinutes) || 30)), notes: boundedText(values.notes, 10_000), frequencyRule: values.frequencyRule || "daily", activeWeekdays: Array.isArray(values.activeWeekdays) ? values.activeWeekdays : [1, 2, 3, 4, 5], archived: false, order: Date.now(), createdAt: timestamp, updatedAt: timestamp };
    case "note": {
      const content = boundedText(values.content, 20_000);
      if (!content) throw new Error("Note content is required");
      return { id: generatedId("note"), content, tags: Array.isArray(values.tags) ? values.tags.slice(0, 20).map((tag) => boundedText(tag, 80)).filter(Boolean) : [], createdAt: timestamp };
    }
    case "memory": {
      const content = boundedText(values.content, 2_000);
      if (!content) throw new Error("Memory content is required");
      return { id: generatedId("memory"), content, tags: Array.isArray(values.tags) ? values.tags.slice(0, 20).map((tag) => boundedText(tag, 80)).filter(Boolean) : [], source: "auto", pinned: false, archived: false, createdAt: timestamp, updatedAt: timestamp };
    }
    case "template":
      if (!title) throw new Error("Template title is required");
      return { id: generatedId("template"), title, slots: Array.isArray(values.slots) ? values.slots.slice(0, 48) : [], createdAt: timestamp, updatedAt: timestamp };
    default:
      throw new Error(`Cannot create ${entity}`);
  }
}

function collectionFor(data: Record<string, any>, entity: AgentEntity) {
  const key = DATA_COLLECTIONS[entity];
  if (!key) throw new Error(`No collection for ${entity}`);
  if (!Array.isArray(data[key])) data[key] = [];
  return { key, collection: data[key] as Array<Record<string, any>> };
}

function syncDeletion(data: Record<string, any>, collectionKey: string, targetId: string, timestamp: string, deleted: boolean) {
  if (!isRecord(data.sync)) data.sync = {};
  if (!isRecord(data.sync.deleted)) data.sync.deleted = {};
  const key = `${collectionKey}:${targetId}`;
  if (deleted) data.sync.deleted[key] = timestamp;
  else delete data.sync.deleted[key];
}

function restoreCommand(command: AgentCommand, snapshot: Record<string, any> | null, collectionKey?: string): AgentCommand {
  return {
    id: `undo_${command.id}`,
    entity: command.entity,
    operation: "restore_entity",
    targetId: command.targetId || snapshot?.id,
    values: { snapshot: snapshot ? clone(snapshot) : null, collectionKey },
  };
}

export function executeAgentCommands(
  originalData: Record<string, any>,
  originalSettings: Record<string, any>,
  input: AgentCommand[],
  options: { allowInternalRestore?: boolean; timestamp?: string; busyOccurrences?: BusyOccurrence[]; timezone?: string; integrations?: Array<Record<string, any>> } = {},
): AgentExecutionResult {
  const commands = normalizeAgentCommands(input, { allowInternalRestore: options.allowInternalRestore });
  const data = clone(originalData);
  const settings = clone(originalSettings);
  const applied: AgentExecutionResult["applied"] = [];
  const inverseCommands: AgentCommand[] = [];
  const clientActions: AgentCommand[] = [];
  const integrationCommands: AgentCommand[] = [];
  const timestamp = options.timestamp || now();

  for (const command of commands) {
    if (command.operation === "navigate" || command.entity === "timer") {
      clientActions.push(command);
      applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, targetId: command.targetId, title: command.reason || command.operation });
      continue;
    }
    if (command.entity === "integration") {
      const source = (options.integrations || []).find((item) => item.id === command.targetId);
      if (!source) throw new Error(`integration not found: ${command.targetId}`);
      if (typeof command.values?.enabled !== "boolean") throw new Error("Integration enabled state is required");
      integrationCommands.push(command);
      inverseCommands.unshift({ id: `undo_${command.id}`, entity: "integration", operation: "update", targetId: command.targetId, values: { enabled: Boolean(source.enabled) } });
      applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, targetId: command.targetId, title: boundedText(source.name, 120, "External calendar") });
      continue;
    }
    if (command.operation === "update_settings") {
      const patch = command.values || {};
      const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, settings[key]]));
      Object.assign(settings, patch);
      inverseCommands.unshift({ id: `undo_${command.id}`, entity: "settings", operation: "restore_entity", values: { snapshot: previous } });
      applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, title: "Settings" });
      continue;
    }
    if (command.operation === "restore_entity") {
      if (!options.allowInternalRestore) continue;
      if (command.entity === "settings") {
        Object.assign(settings, isRecord(command.values?.snapshot) ? command.values?.snapshot : {});
        applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, title: "Settings" });
        continue;
      }
      const collectionKey = boundedText(command.values?.collectionKey, 80) || DATA_COLLECTIONS[command.entity];
      if (!collectionKey) continue;
      if (!Array.isArray(data[collectionKey])) data[collectionKey] = [];
      const snapshot = isRecord(command.values?.snapshot) ? clone(command.values?.snapshot as Record<string, any>) : null;
      const targetId = command.targetId || boundedText(snapshot?.id, 200);
      const index = data[collectionKey].findIndex((item: Record<string, any>) => item.id === targetId);
      if (snapshot) {
        if (index === -1) data[collectionKey].push(snapshot);
        else data[collectionKey][index] = snapshot;
        syncDeletion(data, collectionKey, targetId, timestamp, false);
      } else if (index !== -1) data[collectionKey].splice(index, 1);
      if (!snapshot && targetId) syncDeletion(data, collectionKey, targetId, timestamp, true);
      applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, targetId, title: titleFor(snapshot || undefined, targetId || command.entity) });
      continue;
    }

    if (command.operation === "checkin" && command.entity === "habit") {
      const states = Array.isArray(data.habitDailyStates) ? data.habitDailyStates as Array<Record<string, any>> : (data.habitDailyStates = []);
      const date = boundedText(command.values?.date, 10, timestamp.slice(0, 10));
      const existingIndex = states.findIndex((state) => state.habitId === command.targetId && state.date === date);
      const previous = existingIndex === -1 ? null : clone(states[existingIndex]);
      const next = { ...(previous || {}), id: previous?.id || generatedId("habit_state"), habitId: command.targetId, date, completed: command.values?.completed !== false, completedAt: command.values?.completed === false ? undefined : timestamp, createdAt: previous?.createdAt || timestamp, updatedAt: timestamp };
      if (existingIndex === -1) states.push(next); else states[existingIndex] = next;
      inverseCommands.unshift(restoreCommand({ ...command, targetId: next.id, entity: "habit" }, previous, "habitDailyStates"));
      applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, targetId: command.targetId, title: date });
      continue;
    }

    const { key, collection } = collectionFor(data, command.entity);
    if (command.operation === "create") {
      const item = defaultEntity(command.entity, command.values || {}, timestamp);
      collection.push(item);
      syncDeletion(data, key, item.id, timestamp, false);
      inverseCommands.unshift(restoreCommand({ ...command, targetId: item.id }, null, key));
      applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, targetId: item.id, title: titleFor(item, command.entity) });
      continue;
    }

    const index = collection.findIndex((item) => item.id === command.targetId);
    if (index === -1) throw new Error(`${command.entity} not found: ${command.targetId}`);
    const previous = clone(collection[index]);
    const item = collection[index];

    if (command.operation === "delete") {
      collection.splice(index, 1);
      syncDeletion(data, key, command.targetId!, timestamp, true);
    }
    else if (command.operation === "archive") collection[index] = { ...item, archived: true, completed: command.entity === "project" ? true : item.completed, updatedAt: timestamp };
    else if (command.operation === "complete") collection[index] = { ...item, completed: command.values?.completed !== false, completedAt: command.values?.completed === false ? undefined : timestamp, updatedAt: timestamp };
    else if (command.operation === "append_subtasks" && command.entity === "task") {
      const subtasks = Array.isArray(command.values?.subtasks) ? command.values?.subtasks as Array<Record<string, unknown>> : [];
      collection[index] = { ...item, subtasks: [...(item.subtasks || []), ...subtasks.slice(0, 20).map((subtask, order) => ({ id: generatedId("subtask"), title: boundedText(subtask.title, 300), completed: false, done: false, order: (item.subtasks || []).length + order, createdAt: timestamp })).filter((subtask) => subtask.title)], updatedAt: timestamp };
    } else if (command.operation === "schedule" && command.entity === "task") {
      const date = boundedText(command.values?.date, 10, item.dueDate || timestamp.slice(0, 10));
      const start = boundedText(command.values?.start, 5, "09:00");
      const duration = Math.max(15, Math.min(1440, Number(command.values?.durationMinutes) || 30));
      const [hour, minute] = start.split(":").map(Number);
      const endMinutes = hour * 60 + minute + duration;
      const end = boundedText(command.values?.end, 5, `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`);
      if (scheduleWouldConflict(data, item.id, date, start, end, options.busyOccurrences || [], options.timezone || "UTC")) throw new Error("SCHEDULE_CONFLICT");
      collection[index] = { ...item, dueDate: item.dueDate || date, timelineRecords: [...(item.timelineRecords || []), { id: generatedId("record"), taskId: item.id, scheduledDate: date, scheduledStart: start, scheduledEnd: end, executionStatus: "scheduled", createdAt: timestamp }], updatedAt: timestamp };
    } else if (command.operation === "unschedule" && command.entity === "task") {
      const recordId = boundedText(command.values?.recordId, 200);
      collection[index] = { ...item, timelineRecords: (item.timelineRecords || []).filter((record: Record<string, any>) => record.executionStatus !== "scheduled" || (recordId && record.id !== recordId)), scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, updatedAt: timestamp };
    } else if (command.operation === "update") collection[index] = { ...item, ...(command.values || {}), id: item.id, updatedAt: "updatedAt" in item ? timestamp : item.updatedAt };
    else throw new Error(`Unsupported operation: ${command.operation}`);

    inverseCommands.unshift(restoreCommand(command, previous, key));
    applied.push({ commandId: command.id, entity: command.entity, operation: command.operation, targetId: command.targetId, title: titleFor(previous, command.entity) });
  }

  return { data, settings, applied, inverseCommands, clientActions, integrationCommands };
}

export type AgentReadToolName =
  | "workspace_overview"
  | "search_workspace"
  | "list_tasks"
  | "list_projects"
  | "list_habits"
  | "list_notes"
  | "list_templates"
  | "list_memories"
  | "get_settings"
  | "list_calendar"
  | "get_metrics"
  | "get_timer_status"
  | "list_integrations";

export interface AgentToolCall {
  id: string;
  name: AgentReadToolName;
  arguments: Record<string, unknown>;
}

export function normalizeToolCalls(value: unknown): AgentToolCall[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<AgentReadToolName>(["workspace_overview", "search_workspace", "list_tasks", "list_projects", "list_habits", "list_notes", "list_templates", "list_memories", "get_settings", "list_calendar", "get_metrics", "get_timer_status", "list_integrations"]);
  return value.slice(0, 20).flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = boundedText(raw.id, 200);
    const name = boundedText(raw.name, 80) as AgentReadToolName;
    if (!ID_RE.test(id) || !allowed.has(name)) return [];
    return [{ id, name, arguments: isRecord(raw.arguments) ? clone(raw.arguments) : {} }];
  });
}

function matchesText(item: Record<string, any>, query: string) {
  if (!query) return true;
  const haystack = [item.title, item.content, item.notes, item.details, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function filtered(items: Array<Record<string, any>>, args: Record<string, unknown>) {
  const query = boundedText(args.query, 300).toLowerCase();
  const projectId = boundedText(args.projectId, 200);
  const from = boundedText(args.from, 10);
  const to = boundedText(args.to, 10);
  const completed = typeof args.completed === "boolean" ? args.completed : undefined;
  return items.filter((item) => matchesText(item, query)
    && (!projectId || item.projectId === projectId)
    && (completed === undefined || Boolean(item.completed) === completed)
    && (!from || (item.dueDate || item.date || item.createdAt || "") >= from)
    && (!to || (item.dueDate || item.date || item.createdAt || "") <= to));
}

function readRecord(item: Record<string, any>) {
  // Keep tool results compact so an ordinary delete/update request does not
  // force the model to re-read a large workspace snapshot.
  const record: Record<string, unknown> = { id: item.id, title: item.title, content: item.content };
  for (const key of ["projectId", "completed", "archived", "dueDate", "date", "scheduledDate", "scheduledStart", "scheduledEnd", "plannedForDate", "workflowStatus", "executionLane", "category", "priority", "order"]) {
    if (item[key] !== undefined) record[key] = item[key];
  }
  if (Array.isArray(item.timelineRecords)) {
    record.timelineRecords = item.timelineRecords.slice(-20).map((entry: Record<string, any>) => ({ id: entry.id, scheduledDate: entry.scheduledDate, scheduledStart: entry.scheduledStart, scheduledEnd: entry.scheduledEnd, executionStatus: entry.executionStatus }));
  }
  if (typeof item.notes === "string") record.notes = item.notes.slice(0, 800);
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

export function executeReadTool(
  call: AgentToolCall,
  data: Record<string, any>,
  settings: Record<string, any>,
  externalOccurrences: Array<Record<string, any>> = [],
  runtime: { timerStatus?: Record<string, unknown>; integrations?: Array<Record<string, any>> } = {},
) {
  const limit = Math.max(1, Math.min(200, Number(call.arguments.limit) || 100));
  if (call.name === "workspace_overview") return {
    projects: (data.projects || []).length,
    tasks: (data.tasks || []).length,
    openTasks: (data.tasks || []).filter((task: Record<string, any>) => !task.completed).length,
    habits: (data.habits || []).filter((habit: Record<string, any>) => !habit.archived).length,
    notes: (data.notes || []).length,
    memories: (data.aiMemories || []).filter((memory: Record<string, any>) => !memory.archived).length,
    templates: (data.scheduleTemplates || []).length,
    externalCalendarOccurrences: externalOccurrences.length,
    externalCalendars: (runtime.integrations || []).length,
  };
  if (call.name === "search_workspace") {
    const types = Array.isArray(call.arguments.types) ? call.arguments.types.map(String) : ["tasks", "projects", "habits", "notes", "memories", "templates"];
    const map: Record<string, Array<Record<string, any>>> = { tasks: data.tasks || [], projects: data.projects || [], habits: data.habits || [], notes: data.notes || [], memories: data.aiMemories || [], templates: data.scheduleTemplates || [] };
    return types.flatMap((type) => filtered(map[type] || [], call.arguments).map((item) => ({ type, ...readRecord(item) }))).slice(0, limit);
  }
  if (call.name === "list_tasks") return filtered(data.tasks || [], call.arguments).slice(0, limit).map(readRecord);
  if (call.name === "list_projects") return filtered(data.projects || [], call.arguments).slice(0, limit).map(readRecord);
  if (call.name === "list_habits") return filtered(data.habits || [], call.arguments).slice(0, limit).map(readRecord);
  if (call.name === "list_notes") return filtered(data.notes || [], call.arguments).slice(0, limit).map(readRecord);
  if (call.name === "list_templates") return filtered(data.scheduleTemplates || [], call.arguments).slice(0, limit).map(readRecord);
  if (call.name === "list_memories") return filtered(data.aiMemories || [], call.arguments).filter((memory) => !memory.archived).slice(0, limit).map(readRecord);
  if (call.name === "get_settings") {
    const safeKeys = Object.keys(settings).filter((key) => !SENSITIVE_SETTING_RE.test(key));
    return Object.fromEntries(safeKeys.map((key) => [key, settings[key]]));
  }
  if (call.name === "list_calendar") {
    const taskBlocks = (data.tasks || [])
      .flatMap((task: Record<string, any>) => (task.timelineRecords || []).map((record: Record<string, any>) => ({ source: "navopath", taskId: task.id, title: task.title, ...record })))
      .filter((record: Record<string, any>) => (!call.arguments.from || record.scheduledDate >= call.arguments.from) && (!call.arguments.to || record.scheduledDate <= call.arguments.to));
    const external = externalOccurrences.filter((item) => (!call.arguments.from || item.start_date >= call.arguments.from) && (!call.arguments.to || item.start_date <= call.arguments.to));
    return [...taskBlocks, ...external].slice(0, limit);
  }
  if (call.name === "get_metrics") {
    const tasks = filtered(data.tasks || [], call.arguments);
    return { totalTasks: tasks.length, completedTasks: tasks.filter((task) => task.completed).length, plannedMinutes: tasks.reduce((sum, task) => sum + (task.timelineRecords || []).reduce((inner: number, record: Record<string, any>) => inner + Math.max(0, ((Number(record.scheduledEnd?.slice(0, 2)) * 60 + Number(record.scheduledEnd?.slice(3))) || 0) - ((Number(record.scheduledStart?.slice(0, 2)) * 60 + Number(record.scheduledStart?.slice(3))) || 0)), 0), 0) };
  }
  if (call.name === "get_timer_status") {
    const status = runtime.timerStatus || {};
    const taskId = boundedText(status.taskId, 200);
    const task = (data.tasks || []).find((item: Record<string, any>) => item.id === taskId);
    return { running: status.running === true, elapsedSeconds: Math.max(0, Math.floor(Number(status.elapsedSeconds) || 0)), taskId: task?.id || null, taskTitle: task?.title || null };
  }
  if (call.name === "list_integrations") {
    return (runtime.integrations || []).slice(0, limit).map((source) => ({ id: source.id, name: source.name, displayUrl: source.display_url, enabled: source.enabled, syncStatus: source.sync_status, lastSyncedAt: source.last_synced_at || null }));
  }
  throw new Error(`Unknown read tool: ${call.name}`);
}
