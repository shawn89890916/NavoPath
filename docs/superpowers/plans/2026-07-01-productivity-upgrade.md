# NavoPath Productivity Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved NavoPath productivity upgrade: habits in Today's Candidates, nullable state fields, constrained project completion, command search, time share metrics, cross-day timeline records and scrolling, unified templates, fixed shortcuts, and an always-on-top desktop widget.

**Architecture:** Add focused productivity utility modules first, with tests, then wire existing React/Electron surfaces to those modules. Keep the current Execute/Planning structure and avoid a plugin-platform rewrite. Migrations must normalize old local, browser fallback, and Supabase data without deleting existing plugin config.

**Tech Stack:** React 19, TypeScript 5.7, Vite 7, Electron 37, Vitest 4, Node test runner, existing CSS in `src/app-redesign.css` and `src/styles.css`.

## Global Constraints

- Work on branch `dev`.
- Preserve `NavoPathStyle.md`: quiet paper surfaces, precise rules, restrained annotation color, theme variables, and no generic SaaS styling.
- Do not rewrite NavoPath into a plugin platform in this release.
- Do not add shortcut customization in v1.
- Do not revert or overwrite unrelated existing worktree changes.
- Existing data must load without losing old tasks, projects, templates, time entries, or plugin habit config.
- Actual time comes from `TimeEntry`; planned time comes from schedule records.
- Required verification before final delivery: `npm run build`, `npm test`, and Playwright checks for the user-facing flows listed in the design spec.
- User-visible behavior changes must update `CHANGELOG.md`, run `node scripts/changelog-maintain.mjs`, and pass `node scripts/changelog-maintain.mjs --check`.

---

## File Structure

- Create `src/utils/productivityModel.ts`: nullable priority/importance/urgency helpers, display metadata, filter predicates, project completion validation.
- Create `src/utils/productivityModel.test.ts`: unit tests for nullable states and project completion.
- Create `src/utils/timelineRecords.ts`: cross-day record normalization, datetime conversion, day slicing, focus target helpers.
- Create `src/utils/timelineRecords.test.ts`: cross-day slicing and legacy record normalization tests.
- Create `src/utils/habits.ts`: habit data normalization, daily completion, scheduled marker lookup, habit-to-schedule record creation.
- Create `src/utils/habits.test.ts`: habit migration, completion, scheduling state tests.
- Create `src/utils/commandSearch.ts`: command palette indexing and action descriptors.
- Create `src/utils/commandSearch.test.ts`: search coverage and scheduled jump target tests.
- Create `src/utils/timeShareMetrics.ts`: actual versus planned time share calculations.
- Create `src/utils/timeShareMetrics.test.ts`: metrics tests by project/category/state dimension.
- Create `src/utils/shortcuts.ts`: fixed shortcut registry, platform display, input guard.
- Create `src/utils/shortcuts.test.ts`: registry and typing-context tests.
- Modify `src/types.ts`: add habit types, nullable priority-like types, upgraded timeline record fields, settings flags.
- Modify `src/main.tsx`: wire habits, command search, shortcuts, timeline focus, cross-day scrolling, template panel, widget view route, and settings.
- Modify `src/PlanningView.tsx`: use productivity model helpers for filters, badges, project completion UI.
- Modify `src/browserFallback.ts`, `src/supabasePlannerApi.ts`, `electron/main.cjs`: normalize new data fields and migrate old records.
- Modify `electron/main.cjs`, `electron/preload.cjs`: widget window and IPC bridge.
- Modify `src/app-redesign.css`: NavoPath-style UI for habit card, command palette, metrics, templates, shortcuts, widget.
- Modify `CHANGELOG.md`: mirrored Chinese/English user-facing summary.

---

### Task 1: Productivity Model And Nullable State Core

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/productivityModel.ts`
- Create: `src/utils/productivityModel.test.ts`

**Interfaces:**
- Produces:
  - `export type NullableLevel = "high" | "medium" | "low" | null | undefined`
  - `export type StateFilterValue = "all" | "empty" | "high" | "medium" | "low"`
  - `export type UiWorkflowStatus = "backlog" | "doing" | "done"`
  - `export function normalizeNullableLevel(value: unknown, fallback?: NullableLevel): NullableLevel`
  - `export function normalizeTaskState(task: Pick<Task, "priority" | "importance" | "urgency" | "completed" | "workflowStatus" | "plannedForDate" | "timelineRecords">): NormalizedTaskState`
  - `export function matchesLevelFilter(value: NullableLevel, filter: StateFilterValue): boolean`
  - `export function validateProjectCompletion(projectId: string, tasks: Task[]): { ok: true } | { ok: false; openTasks: Task[] }`
- Consumes existing `Task`, `Project`, `Priority`, `WorkflowStatus`.

- [ ] **Step 1: Write failing nullable-state tests**

Add `src/utils/productivityModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { matchesLevelFilter, normalizeNullableLevel, normalizeTaskState, validateProjectCompletion } from "./productivityModel";

const baseTask: Task = {
  id: "task-1",
  title: "Task",
  dueDate: "2026-07-01",
  category: "personal",
  priority: null,
  notes: "",
  goalId: "",
  completed: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("productivity model", () => {
  it("keeps empty levels as first-class filterable values", () => {
    expect(normalizeNullableLevel(undefined)).toBeNull();
    expect(normalizeNullableLevel(null)).toBeNull();
    expect(normalizeNullableLevel("high")).toBe("high");
    expect(normalizeNullableLevel("bad", "low")).toBe("low");
    expect(matchesLevelFilter(null, "empty")).toBe(true);
    expect(matchesLevelFilter("medium", "empty")).toBe(false);
    expect(matchesLevelFilter("medium", "medium")).toBe(true);
  });

  it("normalizes task display state for icons", () => {
    expect(normalizeTaskState({ ...baseTask }).workflow).toBe("backlog");
    expect(normalizeTaskState({ ...baseTask, workflowStatus: "doing" }).workflow).toBe("doing");
    expect(normalizeTaskState({ ...baseTask, completed: true }).workflow).toBe("done");
    expect(normalizeTaskState({ ...baseTask, urgency: undefined }).urgency).toBe("low");
  });

  it("blocks project completion while child tasks remain open", () => {
    expect(validateProjectCompletion("project-1", [{ ...baseTask, projectId: "project-1" }])).toEqual({
      ok: false,
      openTasks: [{ ...baseTask, projectId: "project-1" }],
    });
    expect(validateProjectCompletion("project-1", [{ ...baseTask, projectId: "project-1", completed: true }])).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run src/utils/productivityModel.test.ts`

Expected: FAIL because `src/utils/productivityModel.ts` does not exist and `Task.priority` does not yet allow `null`.

- [ ] **Step 3: Update shared types**

In `src/types.ts`, change the level types and timeline/habit surfaces:

```ts
export type Priority = "high" | "medium" | "low";
export type NullablePriority = Priority | null;
export type WorkflowStatus = "backlog" | "next" | "doing" | "waiting" | "done";

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
```

Update fields:

```ts
export interface Project {
  // existing fields...
  importance?: NullablePriority;
  urgency?: NullablePriority;
}

export interface Task {
  // existing fields...
  priority: NullablePriority;
  importance?: NullablePriority;
  urgency?: NullablePriority;
}

export interface PlannerData {
  // existing fields...
  habits?: Habit[];
  habitDailyStates?: HabitDailyState[];
}
```

- [ ] **Step 4: Implement productivity model helpers**

Create `src/utils/productivityModel.ts`:

```ts
import type { NullablePriority, Priority, Task, WorkflowStatus } from "../types";

export type NullableLevel = Priority | null | undefined;
export type StateFilterValue = "all" | "empty" | Priority;
export type UiWorkflowStatus = "backlog" | "doing" | "done";

export type NormalizedTaskState = {
  priority: NullablePriority;
  importance: NullablePriority;
  urgency: Priority;
  workflow: UiWorkflowStatus;
};

const LEVELS: Priority[] = ["high", "medium", "low"];

export function normalizeNullableLevel(value: unknown, fallback: NullableLevel = null): NullablePriority {
  if (value === null || value === undefined || value === "") return fallback ?? null;
  return LEVELS.includes(value as Priority) ? value as Priority : fallback ?? null;
}

export function normalizeUrgency(value: unknown): Priority {
  return normalizeNullableLevel(value, "low") || "low";
}

export function normalizeWorkflowStatus(task: Pick<Task, "completed" | "workflowStatus" | "plannedForDate" | "timelineRecords">): UiWorkflowStatus {
  if (task.completed || task.workflowStatus === "done") return "done";
  if (task.workflowStatus === "doing") return "doing";
  if ((task.timelineRecords || []).some((record) => record.executionStatus === "scheduled")) return "doing";
  return "backlog";
}

export function normalizeTaskState(task: Pick<Task, "priority" | "importance" | "urgency" | "completed" | "workflowStatus" | "plannedForDate" | "timelineRecords">): NormalizedTaskState {
  return {
    priority: normalizeNullableLevel(task.priority),
    importance: normalizeNullableLevel(task.importance),
    urgency: normalizeUrgency(task.urgency),
    workflow: normalizeWorkflowStatus(task),
  };
}

export function matchesLevelFilter(value: NullableLevel, filter: StateFilterValue): boolean {
  if (filter === "all") return true;
  const normalized = normalizeNullableLevel(value);
  if (filter === "empty") return normalized === null;
  return normalized === filter;
}

export function workflowStatusForPatch(status: UiWorkflowStatus): Partial<Task> {
  if (status === "done") return { workflowStatus: "done" as WorkflowStatus, completed: true };
  if (status === "doing") return { workflowStatus: "doing" as WorkflowStatus, completed: false };
  return { workflowStatus: "backlog" as WorkflowStatus, completed: false };
}

export function validateProjectCompletion(projectId: string, tasks: Task[]): { ok: true } | { ok: false; openTasks: Task[] } {
  const openTasks = tasks.filter((task) => String(task.projectId || "") === String(projectId) && !task.completed);
  if (openTasks.length > 0) return { ok: false, openTasks };
  return { ok: true };
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/utils/productivityModel.test.ts`

Expected: PASS.

Commit:

```bash
git add src/types.ts src/utils/productivityModel.ts src/utils/productivityModel.test.ts
git commit -m "feat: add productivity state model"
```

---

### Task 2: Cross-Day Timeline Record Engine

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/timelineRecords.ts`
- Create: `src/utils/timelineRecords.test.ts`

**Interfaces:**
- Consumes `TimelineRecord`, `Task`.
- Produces:
  - `export type TimelineSlice`
  - `export type TimelineFocusTarget`
  - `export function normalizeTimelineRecord(record: TimelineRecord): TimelineRecord`
  - `export function recordStartDateTime(record: TimelineRecord): Date`
  - `export function recordEndDateTime(record: TimelineRecord): Date`
  - `export function sliceTimelineRecord(record: TimelineRecord, visibleDates: string[]): TimelineSlice[]`
  - `export function focusTargetForRecord(record: TimelineRecord): TimelineFocusTarget`

- [ ] **Step 1: Write failing cross-day tests**

Create `src/utils/timelineRecords.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TimelineRecord } from "../types";
import { focusTargetForRecord, normalizeTimelineRecord, sliceTimelineRecord } from "./timelineRecords";

const record: TimelineRecord = {
  id: "record-1",
  taskId: "task-1",
  scheduledDate: "2026-07-01",
  scheduledStart: "23:30",
  scheduledEndDate: "2026-07-02",
  scheduledEnd: "07:30",
  executionStatus: "scheduled",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("timelineRecords", () => {
  it("normalizes legacy same-day records", () => {
    const legacy = { ...record, scheduledEndDate: undefined, scheduledStart: "09:00", scheduledEnd: "10:00" };
    expect(normalizeTimelineRecord(legacy).scheduledEndDate).toBe("2026-07-01");
  });

  it("slices cross-day records into visible day pieces", () => {
    const slices = sliceTimelineRecord(record, ["2026-07-01", "2026-07-02"]);
    expect(slices).toEqual([
      { recordId: "record-1", taskId: "task-1", date: "2026-07-01", startMinutes: 1410, endMinutes: 1440, continuesBefore: false, continuesAfter: true },
      { recordId: "record-1", taskId: "task-1", date: "2026-07-02", startMinutes: 0, endMinutes: 450, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("creates a stable focus target", () => {
    expect(focusTargetForRecord(record)).toEqual({ date: "2026-07-01", recordId: "record-1", taskId: "task-1", time: "23:30" });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run src/utils/timelineRecords.test.ts`

Expected: FAIL because `scheduledEndDate` and module exports do not exist.

- [ ] **Step 3: Extend timeline type**

In `src/types.ts`, add to `TimelineRecord`:

```ts
scheduledEndDate?: string;
```

- [ ] **Step 4: Implement timeline record engine**

Create `src/utils/timelineRecords.ts`:

```ts
import type { TimelineRecord } from "../types";

export type TimelineSlice = {
  recordId: string;
  taskId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type TimelineFocusTarget = {
  date: string;
  recordId: string;
  taskId: string;
  time: string;
};

export function normalizeTimelineRecord(record: TimelineRecord): TimelineRecord {
  return { ...record, scheduledEndDate: record.scheduledEndDate || record.scheduledDate };
}

export function recordStartDateTime(record: TimelineRecord): Date {
  return new Date(`${record.scheduledDate}T${record.scheduledStart || "00:00"}:00`);
}

export function recordEndDateTime(record: TimelineRecord): Date {
  const normalized = normalizeTimelineRecord(record);
  return new Date(`${normalized.scheduledEndDate}T${normalized.scheduledEnd || normalized.scheduledStart || "00:00"}:00`);
}

export function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return Math.max(0, Math.min(24 * 60, (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)));
}

export function sliceTimelineRecord(record: TimelineRecord, visibleDates: string[]): TimelineSlice[] {
  const normalized = normalizeTimelineRecord(record);
  const startDate = normalized.scheduledDate;
  const endDate = normalized.scheduledEndDate || normalized.scheduledDate;
  const startMinutes = minutesOfDay(normalized.scheduledStart || "00:00");
  const endMinutes = minutesOfDay(normalized.scheduledEnd || normalized.scheduledStart || "00:00");
  return visibleDates.flatMap((date) => {
    if (date < startDate || date > endDate) return [];
    const isStart = date === startDate;
    const isEnd = date === endDate;
    const sliceStart = isStart ? startMinutes : 0;
    const sliceEnd = isEnd ? endMinutes : 24 * 60;
    if (sliceEnd <= sliceStart) return [];
    return [{
      recordId: normalized.id,
      taskId: normalized.taskId,
      date,
      startMinutes: sliceStart,
      endMinutes: sliceEnd,
      continuesBefore: !isStart,
      continuesAfter: !isEnd,
    }];
  });
}

export function focusTargetForRecord(record: TimelineRecord): TimelineFocusTarget {
  return {
    date: record.scheduledDate,
    recordId: record.id,
    taskId: record.taskId,
    time: record.scheduledStart || "00:00",
  };
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/utils/timelineRecords.test.ts`

Expected: PASS.

Commit:

```bash
git add src/types.ts src/utils/timelineRecords.ts src/utils/timelineRecords.test.ts
git commit -m "feat: add cross-day timeline records"
```

---

### Task 3: Habit Core And Migration Helpers

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/habits.ts`
- Create: `src/utils/habits.test.ts`

**Interfaces:**
- Produces:
  - `export function normalizeHabits(data: PlannerData, now?: string): Pick<PlannerData, "habits" | "habitDailyStates">`
  - `export function habitStateForDate(data: PlannerData, habitId: string, date: string): HabitDailyState | null`
  - `export function toggleHabitCompletion(data: PlannerData, habitId: string, date: string, completed: boolean, now?: string): PlannerData`
  - `export function scheduleHabitRecord(data: PlannerData, habitId: string, date: string, start: string, now?: string): { data: PlannerData; recordId: string }`

- [ ] **Step 1: Write failing habit tests**

Create `src/utils/habits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { normalizeHabits, scheduleHabitRecord, toggleHabitCompletion } from "./habits";

const baseData: PlannerData = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [],
  tasks: [],
  timeEntries: [],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
  pluginConfigs: { "habit-tracker": { habits: "Read\nStretch" } },
};

describe("habits", () => {
  it("migrates plugin habit lines into first-class habits", () => {
    const result = normalizeHabits(baseData, "2026-07-01T00:00:00.000Z");
    expect(result.habits?.map((habit) => habit.title)).toEqual(["Read", "Stretch"]);
  });

  it("records daily completion without removing the habit", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const next = toggleHabitCompletion(data, data.habits![0].id, "2026-07-01", true, "2026-07-01T08:00:00.000Z");
    expect(next.habits?.[0].title).toBe("Read");
    expect(next.habitDailyStates?.[0].completed).toBe(true);
  });

  it("schedules one habit as a timeline record and keeps habit in the card", () => {
    const data = { ...baseData, ...normalizeHabits(baseData, "2026-07-01T00:00:00.000Z") };
    const result = scheduleHabitRecord(data, data.habits![0].id, "2026-07-01", "09:00", "2026-07-01T08:00:00.000Z");
    expect(result.data.habits?.[0].title).toBe("Read");
    expect(result.data.habitDailyStates?.[0].timelineRecordId).toBe(result.recordId);
    expect(result.data.tasks.some((task) => task.id === `habit-task-${data.habits![0].id}-2026-07-01`)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run src/utils/habits.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement habit helpers**

Create `src/utils/habits.ts`:

```ts
import type { Habit, HabitDailyState, PlannerData, Task, TimelineRecord } from "../types";

function uid(prefix: string, seed: string) {
  return `${prefix}-${seed.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")}`;
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function normalizeHabits(data: PlannerData, now = new Date().toISOString()): Pick<PlannerData, "habits" | "habitDailyStates"> {
  if (Array.isArray(data.habits) && data.habits.length > 0) {
    return { habits: data.habits, habitDailyStates: data.habitDailyStates || [] };
  }
  const raw = String(data.pluginConfigs?.["habit-tracker"]?.habits || "");
  const titles = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const habits: Habit[] = titles.map((title, index) => ({
    id: uid("habit", title),
    title,
    defaultDurationMinutes: 20,
    archived: false,
    order: index,
    createdAt: now,
    updatedAt: now,
  }));
  return { habits, habitDailyStates: data.habitDailyStates || [] };
}

export function habitStateForDate(data: PlannerData, habitId: string, date: string): HabitDailyState | null {
  return (data.habitDailyStates || []).find((state) => state.habitId === habitId && state.date === date) || null;
}

export function toggleHabitCompletion(data: PlannerData, habitId: string, date: string, completed: boolean, now = new Date().toISOString()): PlannerData {
  const states = data.habitDailyStates || [];
  const existing = states.find((state) => state.habitId === habitId && state.date === date);
  const nextState: HabitDailyState = {
    id: existing?.id || `habit-state-${habitId}-${date}`,
    habitId,
    date,
    completed,
    completedAt: completed ? now : undefined,
    timelineRecordId: existing?.timelineRecordId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return { ...data, habitDailyStates: [...states.filter((state) => state.id !== nextState.id), nextState] };
}

export function scheduleHabitRecord(data: PlannerData, habitId: string, date: string, start: string, now = new Date().toISOString()): { data: PlannerData; recordId: string } {
  const habit = (data.habits || []).find((item) => item.id === habitId);
  if (!habit) throw new Error(`Habit not found: ${habitId}`);
  const taskId = `habit-task-${habit.id}-${date}`;
  const recordId = `habit-record-${habit.id}-${date}-${start.replace(":", "")}`;
  const duration = Math.max(5, habit.defaultDurationMinutes || 20);
  const task: Task = {
    id: taskId,
    title: habit.title,
    dueDate: date,
    category: "personal",
    priority: null,
    notes: "",
    goalId: "",
    completed: false,
    workflowStatus: "doing",
    estimatedHours: duration / 60,
    plannedForDate: date,
    createdAt: now,
    updatedAt: now,
  };
  const record: TimelineRecord = {
    id: recordId,
    taskId,
    scheduledDate: date,
    scheduledStart: start,
    scheduledEndDate: date,
    scheduledEnd: addMinutes(start, duration),
    executionStatus: "scheduled",
    createdAt: now,
  };
  const stateData = toggleHabitCompletion(data, habitId, date, habitStateForDate(data, habitId, date)?.completed || false, now);
  const states = (stateData.habitDailyStates || []).map((state) => state.habitId === habitId && state.date === date ? { ...state, timelineRecordId: recordId, updatedAt: now } : state);
  const tasks = data.tasks.some((item) => item.id === taskId)
    ? data.tasks.map((item) => item.id === taskId ? { ...item, timelineRecords: [...(item.timelineRecords || []).filter((itemRecord) => itemRecord.id !== recordId), record], updatedAt: now } : item)
    : [...data.tasks, { ...task, timelineRecords: [record] }];
  return { data: { ...stateData, tasks, habitDailyStates: states }, recordId };
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run src/utils/habits.test.ts`

Expected: PASS.

Commit:

```bash
git add src/types.ts src/utils/habits.ts src/utils/habits.test.ts
git commit -m "feat: add first-class habit model"
```

---

### Task 4: Data Normalization Surfaces

**Files:**
- Modify: `electron/main.cjs`
- Modify: `src/browserFallback.ts`
- Modify: `src/supabasePlannerApi.ts`
- Modify: `src/autoSchedule.ts`
- Test: extend `src/syncBootstrap.test.ts` or create `src/utils/dataNormalization.test.ts` if normalization remains locally testable only through browser fallback helpers.

**Interfaces:**
- Consumes helpers from Tasks 1-3.
- Produces normalized `PlannerData` with nullable state fields, `habits`, `habitDailyStates`, and `scheduledEndDate`.

- [ ] **Step 1: Add normalization test for legacy data**

Create `src/utils/dataNormalization.test.ts` if no exported normalizer exists yet:

```ts
import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { normalizePlannerDataForClient } from "./dataNormalization";

describe("data normalization", () => {
  it("keeps legacy plugin habits and backfills cross-day fields", () => {
    const legacy = {
      version: 1,
      importedSeedVersion: "",
      generatedAt: "now",
      goals: [],
      projects: [],
      tasks: [{
        id: "task-1",
        title: "Legacy",
        dueDate: "2026-07-01",
        category: "personal",
        priority: "medium",
        notes: "",
        goalId: "",
        completed: false,
        timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }],
        createdAt: "now",
        updatedAt: "now",
      }],
      longTasks: [],
      events: [],
      notes: [],
      drafts: [],
      chat: [],
      aiMemories: [],
      pluginConfigs: { "habit-tracker": { habits: "Read" } },
    } as PlannerData;
    const normalized = normalizePlannerDataForClient(legacy);
    expect(normalized.tasks[0].timelineRecords?.[0].scheduledEndDate).toBe("2026-07-01");
    expect(normalized.habits?.[0].title).toBe("Read");
    expect(normalized.pluginConfigs?.["habit-tracker"]?.habits).toBe("Read");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run src/utils/dataNormalization.test.ts`

Expected: FAIL because `normalizePlannerDataForClient` does not exist.

- [ ] **Step 3: Create shared client normalizer**

Create `src/utils/dataNormalization.ts`:

```ts
import type { PlannerData, Task } from "../types";
import { normalizeHabits } from "./habits";
import { normalizeTimelineRecord } from "./timelineRecords";
import { normalizeNullableLevel, normalizeUrgency } from "./productivityModel";

export function normalizeTaskForClient(task: Task): Task {
  return {
    ...task,
    priority: normalizeNullableLevel(task.priority),
    importance: normalizeNullableLevel(task.importance),
    urgency: normalizeUrgency(task.urgency),
    timelineRecords: (task.timelineRecords || []).map(normalizeTimelineRecord),
  };
}

export function normalizePlannerDataForClient(data: PlannerData): PlannerData {
  const habitPatch = normalizeHabits(data);
  return {
    ...data,
    tasks: (data.tasks || []).map(normalizeTaskForClient),
    projects: (data.projects || []).map((project) => ({
      ...project,
      importance: normalizeNullableLevel(project.importance),
      urgency: normalizeNullableLevel(project.urgency),
    })),
    timeEntries: data.timeEntries || [],
    scheduleTemplates: data.scheduleTemplates || [],
    habits: habitPatch.habits || [],
    habitDailyStates: habitPatch.habitDailyStates || [],
  };
}
```

- [ ] **Step 4: Wire normalizer into browser and Supabase paths**

Modify `src/browserFallback.ts` and `src/supabasePlannerApi.ts` so loaded data passes through `normalizePlannerDataForClient(data)`. Keep existing auth and storage behavior unchanged.

- [ ] **Step 5: Mirror normalizer semantics in Electron**

Because `electron/main.cjs` is CommonJS, either duplicate the small normalization rules there or keep existing functions and add:

```js
function normalizeTimelineRecord(record) {
  return { ...record, scheduledEndDate: record.scheduledEndDate || record.scheduledDate };
}

function normalizeLevel(value, fallback = null) {
  return ["high", "medium", "low"].includes(value) ? value : fallback;
}
```

Apply them in Electron's existing data normalization path.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npx vitest run src/utils/dataNormalization.test.ts src/utils/productivityModel.test.ts src/utils/timelineRecords.test.ts src/utils/habits.test.ts
```

Expected: PASS.

Commit:

```bash
git add electron/main.cjs src/browserFallback.ts src/supabasePlannerApi.ts src/autoSchedule.ts src/utils/dataNormalization.ts src/utils/dataNormalization.test.ts
git commit -m "feat: normalize productivity upgrade data"
```

---

### Task 5: Time Share Metrics Engine

**Files:**
- Create: `src/utils/timeShareMetrics.ts`
- Create: `src/utils/timeShareMetrics.test.ts`
- Modify: `src/utils/productivity.ts` only to re-export or delegate if existing analysis code should keep imports stable.

**Interfaces:**
- Produces:
  - `export type TimeShareDimension = "project" | "category" | "importance" | "urgency" | "status"`
  - `export type TimeShareMode = "actual" | "planned"`
  - `export function buildTimeShareMetrics(data: PlannerData, options: TimeShareOptions): TimeShareResult`

- [ ] **Step 1: Write failing metrics tests**

Create `src/utils/timeShareMetrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { buildTimeShareMetrics } from "./timeShareMetrics";

const task: Task = {
  id: "task-1",
  title: "Study",
  dueDate: "2026-07-01",
  category: "exam",
  priority: null,
  importance: "high",
  urgency: "low",
  notes: "",
  goalId: "",
  completed: false,
  projectId: "project-1",
  timelineRecords: [{ id: "record-1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEndDate: "2026-07-01", scheduledEnd: "10:30", executionStatus: "scheduled", createdAt: "now" }],
  createdAt: "now",
  updatedAt: "now",
};

const data: PlannerData = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [{ id: "project-1", title: "Applications", category: "project", notes: "", completed: false, createdAt: "now", updatedAt: "now" }],
  tasks: [task],
  timeEntries: [{ id: "time-1", taskId: "task-1", projectId: "project-1", startAt: "2026-07-01T09:00:00.000Z", endAt: "2026-07-01T10:00:00.000Z", durationMinutes: 60, source: "timer", createdAt: "now", updatedAt: "now" }],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
};

describe("time share metrics", () => {
  it("separates actual tracked time from planned scheduled time", () => {
    expect(buildTimeShareMetrics(data, { mode: "actual", dimension: "project", range: "all" }).totalMinutes).toBe(60);
    expect(buildTimeShareMetrics(data, { mode: "planned", dimension: "project", range: "all" }).totalMinutes).toBe(90);
  });

  it("groups empty and explicit states", () => {
    const result = buildTimeShareMetrics(data, { mode: "planned", dimension: "importance", range: "all" });
    expect(result.segments).toEqual([{ key: "high", label: "High", minutes: 90, ratio: 1, taskIds: ["task-1"] }]);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run src/utils/timeShareMetrics.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement metrics engine**

Create `src/utils/timeShareMetrics.ts` with exact exports:

```ts
import type { PlannerData, Task } from "../types";
import { normalizeTaskState } from "./productivityModel";
import { minutesOfDay, normalizeTimelineRecord } from "./timelineRecords";

export type TimeShareDimension = "project" | "category" | "importance" | "urgency" | "status";
export type TimeShareMode = "actual" | "planned";
export type TimeShareRange = "7" | "30" | "90" | "all";

export type TimeShareOptions = {
  mode: TimeShareMode;
  dimension: TimeShareDimension;
  range: TimeShareRange;
};

export type TimeShareSegment = {
  key: string;
  label: string;
  minutes: number;
  ratio: number;
  taskIds: string[];
};

export type TimeShareResult = {
  mode: TimeShareMode;
  dimension: TimeShareDimension;
  totalMinutes: number;
  segments: TimeShareSegment[];
};

function levelLabel(key: string) {
  if (key === "empty") return "Empty";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function keyForTask(data: PlannerData, task: Task, dimension: TimeShareDimension) {
  const state = normalizeTaskState(task);
  if (dimension === "project") return task.projectId || "__unassigned__";
  if (dimension === "category") return task.category || "personal";
  if (dimension === "importance") return state.importance || "empty";
  if (dimension === "urgency") return state.urgency || "empty";
  return state.workflow;
}

function labelForKey(data: PlannerData, dimension: TimeShareDimension, key: string) {
  if (dimension === "project") return data.projects.find((project) => project.id === key)?.title || "Unassigned";
  return levelLabel(key);
}

function plannedMinutes(task: Task) {
  return (task.timelineRecords || []).reduce((sum, record) => {
    const normalized = normalizeTimelineRecord(record);
    if (normalized.executionStatus !== "scheduled") return sum;
    const start = minutesOfDay(normalized.scheduledStart || "00:00");
    const end = minutesOfDay(normalized.scheduledEnd || normalized.scheduledStart || "00:00");
    const daySpan = Math.max(0, new Date(`${normalized.scheduledEndDate}T00:00:00`).getTime() - new Date(`${normalized.scheduledDate}T00:00:00`).getTime()) / 86400000;
    return sum + Math.max(0, Math.round(daySpan * 1440 + end - start));
  }, 0);
}

export function buildTimeShareMetrics(data: PlannerData, options: TimeShareOptions): TimeShareResult {
  const taskById = new Map((data.tasks || []).map((task) => [task.id, task]));
  const buckets = new Map<string, { minutes: number; taskIds: Set<string> }>();
  const add = (task: Task, minutes: number) => {
    if (minutes <= 0) return;
    const key = keyForTask(data, task, options.dimension);
    const bucket = buckets.get(key) || { minutes: 0, taskIds: new Set<string>() };
    bucket.minutes += minutes;
    bucket.taskIds.add(task.id);
    buckets.set(key, bucket);
  };
  if (options.mode === "actual") {
    for (const entry of data.timeEntries || []) {
      const task = taskById.get(entry.taskId);
      if (task) add(task, Math.max(0, Math.round(entry.durationMinutes || 0)));
    }
  } else {
    for (const task of data.tasks || []) add(task, plannedMinutes(task));
  }
  const totalMinutes = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.minutes, 0);
  const segments = Array.from(buckets.entries())
    .map(([key, bucket]) => ({ key, label: labelForKey(data, options.dimension, key), minutes: bucket.minutes, ratio: totalMinutes > 0 ? bucket.minutes / totalMinutes : 0, taskIds: Array.from(bucket.taskIds) }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
  return { mode: options.mode, dimension: options.dimension, totalMinutes, segments };
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run src/utils/timeShareMetrics.test.ts`

Expected: PASS.

Commit:

```bash
git add src/utils/timeShareMetrics.ts src/utils/timeShareMetrics.test.ts src/utils/productivity.ts
git commit -m "feat: add time share metrics engine"
```

---

### Task 6: Command Search And Shortcut Registry

**Files:**
- Create: `src/utils/commandSearch.ts`
- Create: `src/utils/commandSearch.test.ts`
- Create: `src/utils/shortcuts.ts`
- Create: `src/utils/shortcuts.test.ts`

**Interfaces:**
- Produces:
  - `CommandSearchResult` with `id`, `kind`, `title`, `subtitle`, `actions`, optional `focusTarget`.
  - `buildCommandSearchIndex(data, settings)` and `searchCommands(index, query)`.
  - `SHORTCUTS`, `isTypingContext(target)`, `matchShortcut(event, shortcuts)`.

- [ ] **Step 1: Write failing search and shortcut tests**

Create `src/utils/commandSearch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PlannerData, Settings } from "../types";
import { buildCommandSearchIndex, searchCommands } from "./commandSearch";

const data = {
  version: 1,
  importedSeedVersion: "",
  generatedAt: "now",
  goals: [],
  projects: [],
  tasks: [{ id: "task-1", title: "Read ESAT notes", dueDate: "2026-07-01", category: "exam", priority: null, notes: "", goalId: "", completed: false, timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEndDate: "2026-07-01", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }], createdAt: "now", updatedAt: "now" }],
  longTasks: [],
  events: [],
  notes: [],
  drafts: [],
  chat: [],
  aiMemories: [],
  habits: [{ id: "habit-1", title: "Stretch", defaultDurationMinutes: 15, createdAt: "now", updatedAt: "now" }],
  habitDailyStates: [{ id: "state-1", habitId: "habit-1", date: "2026-07-01", completed: false, timelineRecordId: "r1", createdAt: "now", updatedAt: "now" }],
} as PlannerData;

describe("command search", () => {
  it("finds scheduled tasks and exposes focus target", () => {
    const result = searchCommands(buildCommandSearchIndex(data, {} as Settings), "esat")[0];
    expect(result.title).toBe("Read ESAT notes");
    expect(result.focusTarget).toEqual({ date: "2026-07-01", recordId: "r1", taskId: "task-1", time: "09:00" });
  });

  it("indexes habits and settings", () => {
    const titles = searchCommands(buildCommandSearchIndex(data, {} as Settings), "stretch").map((item) => item.title);
    expect(titles).toContain("Stretch");
    expect(searchCommands(buildCommandSearchIndex(data, {} as Settings), "shortcuts")[0].kind).toBe("setting");
  });
});
```

Create `src/utils/shortcuts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SHORTCUTS, isTypingContext } from "./shortcuts";

describe("shortcuts", () => {
  it("contains the fixed first-version shortcut set", () => {
    expect(SHORTCUTS.map((shortcut) => shortcut.id)).toEqual(expect.arrayContaining(["command-search", "help", "new-task", "today", "execute", "planning", "timer-toggle"]));
  });

  it("does not fire while typing", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    div.contentEditable = "true";
    expect(isTypingContext(input)).toBe(true);
    expect(isTypingContext(div)).toBe(true);
    expect(isTypingContext(document.createElement("button"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/utils/commandSearch.test.ts src/utils/shortcuts.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement command search**

Create `src/utils/commandSearch.ts`:

```ts
import type { PlannerData, Settings } from "../types";
import { focusTargetForRecord, type TimelineFocusTarget } from "./timelineRecords";

export type CommandKind = "task" | "project" | "event" | "note" | "habit" | "setting";
export type CommandAction = "open" | "focus" | "complete" | "start_timer" | "add_today" | "schedule_now";

export type CommandSearchResult = {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle: string;
  text: string;
  actions: CommandAction[];
  focusTarget?: TimelineFocusTarget;
};

export function buildCommandSearchIndex(data: PlannerData, _settings: Settings): CommandSearchResult[] {
  const taskResults = (data.tasks || []).map((task): CommandSearchResult => {
    const record = (task.timelineRecords || []).find((item) => item.executionStatus === "scheduled");
    return {
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      subtitle: task.dueDate || "",
      text: `${task.title} ${task.notes || ""}`.toLowerCase(),
      actions: record ? ["open", "focus", "complete", "start_timer"] : ["open", "add_today", "schedule_now", "start_timer"],
      focusTarget: record ? focusTargetForRecord(record) : undefined,
    };
  });
  const projectResults = (data.projects || []).map((project): CommandSearchResult => ({
    id: `project:${project.id}`,
    kind: "project",
    title: project.title,
    subtitle: project.completed ? "Completed project" : "Project",
    text: `${project.title} ${project.notes || ""}`.toLowerCase(),
    actions: ["open"],
  }));
  const habitResults = (data.habits || []).filter((habit) => !habit.archived).map((habit): CommandSearchResult => ({
    id: `habit:${habit.id}`,
    kind: "habit",
    title: habit.title,
    subtitle: "Habit",
    text: habit.title.toLowerCase(),
    actions: ["open", "schedule_now"],
  }));
  const settingResults: CommandSearchResult[] = [
    { id: "setting:shortcuts", kind: "setting", title: "Shortcuts", subtitle: "Settings", text: "shortcuts keyboard hotkeys 快捷键", actions: ["open"] },
    { id: "setting:productivity", kind: "setting", title: "Productivity", subtitle: "Settings", text: "productivity habits metrics templates widget", actions: ["open"] },
  ];
  return [...taskResults, ...projectResults, ...habitResults, ...settingResults];
}

export function searchCommands(index: CommandSearchResult[], query: string): CommandSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return index.slice(0, 12);
  return index
    .map((item) => ({ item, rank: item.title.toLowerCase().includes(normalized) ? 0 : item.text.includes(normalized) ? 1 : 9 }))
    .filter(({ rank }) => rank < 9)
    .sort((a, b) => a.rank - b.rank || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => item)
    .slice(0, 20);
}
```

- [ ] **Step 4: Implement shortcut registry**

Create `src/utils/shortcuts.ts`:

```ts
export type ShortcutScope = "global" | "timeline" | "mode" | "timer";

export type ShortcutDefinition = {
  id: string;
  labelZh: string;
  labelEn: string;
  keys: string[];
  scope: ShortcutScope;
};

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: "command-search", labelZh: "搜索", labelEn: "Search", keys: ["Ctrl/Cmd+K"], scope: "global" },
  { id: "help", labelZh: "快捷键帮助", labelEn: "Shortcut help", keys: ["?"], scope: "global" },
  { id: "new-task", labelZh: "新任务", labelEn: "New task", keys: ["N"], scope: "global" },
  { id: "previous-date", labelZh: "上一天", labelEn: "Previous date", keys: ["J"], scope: "timeline" },
  { id: "next-date", labelZh: "下一天", labelEn: "Next date", keys: ["K"], scope: "timeline" },
  { id: "today", labelZh: "回到现在", labelEn: "Back to now", keys: ["T"], scope: "timeline" },
  { id: "day-view", labelZh: "日视图", labelEn: "Day view", keys: ["D"], scope: "timeline" },
  { id: "three-day-view", labelZh: "三日视图", labelEn: "3-day view", keys: ["3"], scope: "timeline" },
  { id: "week-view", labelZh: "周视图", labelEn: "Week view", keys: ["W"], scope: "timeline" },
  { id: "month-view", labelZh: "月视图", labelEn: "Month view", keys: ["M"], scope: "timeline" },
  { id: "planning", labelZh: "Planning", labelEn: "Planning", keys: ["P"], scope: "mode" },
  { id: "execute", labelZh: "Execute", labelEn: "Execute", keys: ["E"], scope: "mode" },
  { id: "timer-toggle", labelZh: "开始/暂停计时", labelEn: "Start/pause timer", keys: ["Space"], scope: "timer" },
];

export function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/utils/commandSearch.test.ts src/utils/shortcuts.test.ts`

Expected: PASS.

Commit:

```bash
git add src/utils/commandSearch.ts src/utils/commandSearch.test.ts src/utils/shortcuts.ts src/utils/shortcuts.test.ts
git commit -m "feat: add command search and shortcuts core"
```

---

### Task 7: Planning UI Nullable States And Project Completion

**Files:**
- Modify: `src/PlanningView.tsx`
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`

**Interfaces:**
- Consumes `normalizeTaskState`, `matchesLevelFilter`, `validateProjectCompletion`, `workflowStatusForPatch`.
- Produces UI where empty state filters exist and project completion is blocked until all child tasks are complete.

- [ ] **Step 1: Add PlanningView integration test target through component behavior**

If direct component tests are not present, add unit tests for the pure helpers in Task 1 and use Playwright in Task 15 for the UI. Do not add a brittle React component test for `PlanningView.tsx`.

- [ ] **Step 2: Replace two-level filter types**

In `src/PlanningView.tsx`, change:

```ts
type PlanningFilterLevel = "all" | "high" | "low";
```

to:

```ts
import { matchesLevelFilter, normalizeTaskState, workflowStatusForPatch } from "./utils/productivityModel";

type PlanningFilterLevel = "all" | "empty" | "high" | "medium" | "low";
```

- [ ] **Step 3: Update task badge derivation**

Replace the current `taskMetaBadges` body with:

```ts
function taskMetaBadges(task: Task, lang: Language) {
  const state = normalizeTaskState(task);
  const zh = lang === "zh";
  return [
    { key: `status-${state.workflow}`, tone: `status-${state.workflow}`, label: state.workflow === "done" ? (zh ? "已完成" : "Done") : state.workflow === "doing" ? (zh ? "进行中" : "Doing") : (zh ? "未开始" : "Not started") },
    { key: `importance-${state.importance || "empty"}`, tone: `importance-${state.importance || "empty"}`, label: state.importance ? (zh ? state.importance === "high" ? "重要" : state.importance === "medium" ? "一般重要" : "不重要" : state.importance) : (zh ? "空重要" : "No importance") },
    { key: `urgency-${state.urgency}`, tone: `urgency-${state.urgency}`, label: zh ? state.urgency === "high" ? "紧急" : state.urgency === "medium" ? "一般紧急" : "不紧急" : state.urgency },
  ];
}
```

- [ ] **Step 4: Update filter predicates**

Replace importance and urgency checks in `matchesPlanningFilters` with:

```ts
if (filterPriorities.length > 0 && !filterPriorities.some((filter) => matchesLevelFilter(task.importance ?? task.priority, filter))) return false;
if (filterUrgencies.length > 0 && !filterUrgencies.some((filter) => matchesLevelFilter(task.urgency ?? "low", filter))) return false;
```

- [ ] **Step 5: Add filter options**

For both importance and urgency filter groups, include `empty`, `high`, `medium`, and `low` options with Chinese/English labels. Use tone classes `importance-empty`, `importance-high`, `importance-medium`, `importance-low`, `urgency-empty`, `urgency-high`, `urgency-medium`, `urgency-low`.

- [ ] **Step 6: Add project completion guard in main**

In `src/main.tsx`, import `validateProjectCompletion`. Add:

```ts
function completeProject(projectId: string) {
  const current = dataRef.current;
  if (!current) return;
  const result = validateProjectCompletion(projectId, current.tasks);
  if (!result.ok) {
    showToast(lang === "zh" ? `还有 ${result.openTasks.length} 个未完成任务，请先完成所有任务。` : `${result.openTasks.length} open tasks remain. Complete them before closing the project.`);
    return;
  }
  void saveData({
    ...current,
    projects: current.projects.map((project) => project.id === projectId ? { ...project, completed: true, updatedAt: new Date().toISOString() } : project),
  });
}
```

Pass `completeProject` to project UI where project edit/actions are rendered.

- [ ] **Step 7: Add CSS icons**

In `src/app-redesign.css`, add classes:

```css
.df-task-meta-badge.status-backlog::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); }
.df-task-meta-badge.status-doing::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #b88900; }
.df-task-meta-badge.status-done::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--paper-complete); }
.df-task-meta-badge[class*="importance-"]::before { content: "⚑"; font-size: 11px; }
.df-task-meta-badge[class*="urgency-"]::before { content: "!"; font-family: var(--paper-mono); font-weight: 700; }
.df-task-meta-badge.importance-high, .df-task-meta-badge.urgency-high { color: var(--danger); }
.df-task-meta-badge.importance-medium, .df-task-meta-badge.urgency-medium { color: #b88900; }
.df-task-meta-badge.importance-low, .df-task-meta-badge.urgency-low, .df-task-meta-badge.importance-empty, .df-task-meta-badge.urgency-empty { color: var(--text-muted); }
```

- [ ] **Step 8: Run tests and commit**

Run:

```bash
npx vitest run src/utils/productivityModel.test.ts
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/PlanningView.tsx src/main.tsx src/app-redesign.css
git commit -m "feat: add nullable planning states"
```

---

### Task 8: Habit Card In Today's Candidates

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`
- Use: `src/utils/habits.ts`, `src/utils/timelineRecords.ts`

**Interfaces:**
- Consumes `normalizeHabits`, `toggleHabitCompletion`, `scheduleHabitRecord`, `focusTargetForRecord`.
- Produces habit card below Today's Candidates with individual draggable habit rows.

- [ ] **Step 1: Add habits to loaded data memo**

In `src/main.tsx`, after data is available:

```ts
const habits = data.habits || [];
const habitDailyStates = data.habitDailyStates || [];
```

- [ ] **Step 2: Create `HabitCandidateCard` component in `main.tsx`**

Add a focused component near `TaskCard` components:

```tsx
function HabitCandidateCard(props: {
  habits: Habit[];
  habitDailyStates: HabitDailyState[];
  today: string;
  lang: Language;
  onToggle: (habitId: string, completed: boolean) => void;
  onDragStart: (event: React.PointerEvent, habitId: string) => void;
  onFocusScheduled: (recordId: string) => void;
}) {
  const active = props.habits.filter((habit) => !habit.archived);
  const completed = active.filter((habit) => props.habitDailyStates.some((state) => state.habitId === habit.id && state.date === props.today && state.completed)).length;
  if (active.length === 0) return null;
  return (
    <section className="df-habit-candidate-card">
      <header><strong>{props.lang === "zh" ? "习惯" : "Habits"}</strong><span>{completed}/{active.length}</span></header>
      <div className="df-habit-candidate-list">
        {active.map((habit) => {
          const state = props.habitDailyStates.find((item) => item.habitId === habit.id && item.date === props.today);
          return (
            <article key={habit.id} className={`df-habit-candidate-row${state?.completed ? " completed" : ""}`} onPointerDown={(event) => props.onDragStart(event, habit.id)}>
              <button type="button" className="df-habit-check" onPointerDown={(event) => event.stopPropagation()} onClick={() => props.onToggle(habit.id, !state?.completed)} aria-pressed={Boolean(state?.completed)} />
              <span>{habit.title}</span>
              <small>{habit.defaultDurationMinutes}m</small>
              {state?.timelineRecordId && <button type="button" className="df-habit-scheduled" onPointerDown={(event) => event.stopPropagation()} onClick={() => props.onFocusScheduled(state.timelineRecordId!)}>{props.lang === "zh" ? "已安排" : "Scheduled"}</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add habit drag state**

Add:

```ts
type HabitDragState = { habitId: string; source: "habit" } | null;
const [habitDrag, setHabitDrag] = useState<HabitDragState>(null);
```

Hook habit row pointer down into the existing drag/drop pipeline by setting `drag` or a parallel habit drag state. On drop into timeline, call `scheduleHabitRecord(current, habitId, targetDate, targetTime)`.

- [ ] **Step 4: Render habit card below candidate task list**

Place `HabitCandidateCard` immediately after today's candidate task section and before the add row.

- [ ] **Step 5: Implement scheduled focus**

Add:

```ts
function focusHabitSchedule(recordId: string) {
  const task = dataRef.current?.tasks.find((item) => (item.timelineRecords || []).some((record) => record.id === recordId));
  const record = task?.timelineRecords?.find((item) => item.id === recordId);
  if (!task || !record) return;
  setSelectedDate(record.scheduledDate);
  setTimelineView("daily");
  setPendingTimelineFocus({ taskId: task.id, recordId: record.id, date: record.scheduledDate, time: record.scheduledStart });
}
```

- [ ] **Step 6: Add CSS**

Use paper-style rules:

```css
.df-habit-candidate-card { border-top: 1px solid var(--paper-rule); border-bottom: 1px solid var(--paper-rule); padding: 14px 0; display: grid; gap: 10px; }
.df-habit-candidate-card header { display: flex; justify-content: space-between; align-items: center; font-family: var(--paper-display); color: var(--text-main); }
.df-habit-candidate-list { display: grid; gap: 7px; }
.df-habit-candidate-row { display: grid; grid-template-columns: 28px minmax(0,1fr) auto auto; align-items: center; gap: 10px; min-height: 40px; border-bottom: 1px solid var(--paper-rule); color: var(--text-main); cursor: grab; }
.df-habit-candidate-row.completed span { text-decoration: line-through; color: var(--text-muted); }
.df-habit-check { width: 22px; height: 22px; border: 2px solid var(--accent-active); background: transparent; }
.df-habit-candidate-row.completed .df-habit-check::after { content: ""; display: block; width: 12px; height: 7px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg) translate(2px, 4px); }
.df-habit-scheduled { border: 0; border-bottom: 1px solid var(--accent-active); background: transparent; color: var(--accent-active); }
```

- [ ] **Step 7: Run tests/build and commit**

Run:

```bash
npx vitest run src/utils/habits.test.ts src/utils/timelineRecords.test.ts
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/main.tsx src/app-redesign.css
git commit -m "feat: add draggable habit candidate card"
```

---

### Task 9: Command Palette UI And Global Shortcuts

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`
- Use: `src/utils/commandSearch.ts`, `src/utils/shortcuts.ts`

**Interfaces:**
- Consumes command search index and shortcut registry.
- Produces UI command palette and fixed shortcut handling.

- [ ] **Step 1: Add command palette state**

In `PlannerApp`, add:

```ts
const [commandOpen, setCommandOpen] = useState(false);
const [commandQuery, setCommandQuery] = useState("");
const commandIndex = useMemo(() => data && settings ? buildCommandSearchIndex(data, settings) : [], [data, settings]);
const commandResults = useMemo(() => searchCommands(commandIndex, commandQuery), [commandIndex, commandQuery]);
```

- [ ] **Step 2: Add global shortcut listener**

Add an effect:

```ts
useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingContext(event.target)) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") { event.preventDefault(); setCommandOpen(true); return; }
    if (event.key === "?") { event.preventDefault(); setUtilityPanel("settings"); setSettingsSection("shortcuts"); return; }
    if (key === "n") { event.preventDefault(); openTaskCreate(); return; }
    if (key === "t") { event.preventDefault(); goToNow(); return; }
    if (key === "p") { event.preventDefault(); setMode("planning"); return; }
    if (key === "e") { event.preventDefault(); setMode("execute"); return; }
    if (key === "d") { event.preventDefault(); setTimelineView("daily"); return; }
    if (event.key === "3") { event.preventDefault(); setTimelineView("3day"); return; }
    if (key === "w") { event.preventDefault(); setTimelineView("weekly"); return; }
    if (key === "m") { event.preventDefault(); setTimelineView("month"); return; }
    if (key === "j") { event.preventDefault(); shiftTimeline(-1); return; }
    if (key === "k") { event.preventDefault(); shiftTimeline(1); return; }
    if (event.code === "Space") { event.preventDefault(); toggleCurrentTimer(); }
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, [shiftTimeline, toggleCurrentTimer]);
```

Use existing functions where names differ. If `openTaskCreate`, `goToNow`, or `toggleCurrentTimer` do not exist, create thin wrappers around current add drawer, today jump, and header timer behavior.

- [ ] **Step 3: Implement `CommandPalette` component**

Add:

```tsx
function CommandPalette(props: {
  open: boolean;
  query: string;
  results: CommandSearchResult[];
  lang: Language;
  onQuery: (value: string) => void;
  onClose: () => void;
  onChoose: (result: CommandSearchResult) => void;
}) {
  if (!props.open) return null;
  return (
    <>
      <button className="df-command-backdrop" type="button" aria-label="Close search" onClick={props.onClose} />
      <section className="df-command-palette" role="dialog" aria-modal="true" aria-label={props.lang === "zh" ? "搜索" : "Search"}>
        <input autoFocus value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder={props.lang === "zh" ? "搜索任务、项目、习惯、设置" : "Search tasks, projects, habits, settings"} />
        <div className="df-command-results">
          {props.results.map((result) => (
            <button key={result.id} type="button" onClick={() => props.onChoose(result)}>
              <strong>{result.title}</strong>
              <small>{result.subtitle}</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Implement command actions**

Add:

```ts
function chooseCommand(result: CommandSearchResult) {
  setCommandOpen(false);
  setCommandQuery("");
  if (result.focusTarget) {
    setSelectedDate(result.focusTarget.date);
    setTimelineView("daily");
    setPendingTimelineFocus(result.focusTarget);
    return;
  }
  if (result.kind === "setting") {
    setUtilityPanel("settings");
    if (result.id === "setting:shortcuts") setSettingsSection("shortcuts");
    return;
  }
  if (result.kind === "task") {
    const taskId = result.id.replace("task:", "");
    const task = dataRef.current?.tasks.find((item) => item.id === taskId);
    if (task) openTaskEdit(task);
  }
}
```

- [ ] **Step 5: Add shortcuts settings section**

Extend settings section union to include `"shortcuts"`. Add nav item and section rendering `SHORTCUTS` grouped by scope.

- [ ] **Step 6: Add CSS**

Add command palette and shortcuts table styles with paper surface, hairline borders, no filled gradient buttons.

- [ ] **Step 7: Run tests/build and commit**

Run:

```bash
npx vitest run src/utils/commandSearch.test.ts src/utils/shortcuts.test.ts
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/main.tsx src/app-redesign.css
git commit -m "feat: add command palette and shortcuts"
```

---

### Task 10: Cross-Day Timeline UI And Back To Now

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`
- Use: `src/utils/timelineRecords.ts`

**Interfaces:**
- Consumes `sliceTimelineRecord`, `focusTargetForRecord`, `TimelineFocusTarget`.
- Produces continuous cross-day scrolling across day, 3-day, week, and month views.

- [ ] **Step 1: Add settings field**

In `src/types.ts`, add to `Settings`:

```ts
continuousCrossDayScroll?: boolean;
```

Ensure default settings in Electron, browser fallback, and Supabase default settings set this to `true`.

- [ ] **Step 2: Replace visible task expansion with slices**

Where `expandedVisibleTimelineTasks` or equivalent scheduled task rendering is computed, convert each scheduled `TimelineRecord` into visible slices:

```ts
const visibleDates = getVisibleDays(timelineView === "weekly" ? "weekly" : timelineView === "3day" ? "3day" : "daily", timelineDate);
const slices = task.timelineRecords?.flatMap((record) => sliceTimelineRecord(record, visibleDates)) || [];
```

Each rendered block gets `data-record-id`, slice date, slice start/end minutes, and `continuesBefore/continuesAfter` classes.

- [ ] **Step 3: Add scroll anchor date update**

For day/3-day/week scroll containers, add an `onScroll` handler that computes the date nearest the top visible anchor and updates `selectedDate` without snapping. Use current visible date columns for 3-day/week. For month, keep existing infinite month behavior and add the same `Back to now` threshold.

- [ ] **Step 4: Add Back to now button**

Compute:

```ts
const showBackToNow = Math.abs(Date.parse(`${selectedDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) > 86400000 || timelineView !== "daily";
```

Render a minimal text button near date controls:

```tsx
{showBackToNow && <button className="df-back-to-now" type="button" onClick={goToNow}>{lang === "zh" ? "回到现在" : "Back to now"}</button>}
```

- [ ] **Step 5: Ensure focus target scrolls to sliced block**

Update pending focus effect to query `[data-record-id="${target.recordId}"]` before falling back to task id.

- [ ] **Step 6: Add cross-day visual marks**

In CSS, add subtle start/end continuation marks:

```css
.df-time-block.continues-before { border-top-style: dashed; }
.df-time-block.continues-after { border-bottom-style: dashed; }
.df-back-to-now { border: 0; border-bottom: 1px solid var(--accent-active); background: transparent; color: var(--accent-active); }
```

- [ ] **Step 7: Run tests/build and commit**

Run:

```bash
npx vitest run src/utils/timelineRecords.test.ts
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/types.ts src/main.tsx src/app-redesign.css electron/main.cjs src/browserFallback.ts src/supabasePlannerApi.ts
git commit -m "feat: add cross-day timeline scrolling"
```

---

### Task 11: Time Share Metrics UI

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`
- Use: `src/utils/timeShareMetrics.ts`

**Interfaces:**
- Consumes `buildTimeShareMetrics`.
- Produces metrics panel comparing actual and planned time by dimensions and range.

- [ ] **Step 1: Add metrics state**

In the existing project analysis component or surrounding Planning/Execute metrics area, add:

```ts
const [timeShareMode, setTimeShareMode] = useState<"actual" | "planned">("actual");
const [timeShareDimension, setTimeShareDimension] = useState<TimeShareDimension>("project");
const [timeShareRange, setTimeShareRange] = useState<TimeShareRange>("30");
const timeShare = useMemo(() => buildTimeShareMetrics(data, { mode: timeShareMode, dimension: timeShareDimension, range: timeShareRange }), [data, timeShareMode, timeShareDimension, timeShareRange]);
```

- [ ] **Step 2: Render controls**

Render segmented text/rule controls for actual/planned, dimension, and range. Use buttons with selected bottom rule, not filled pills.

- [ ] **Step 3: Render segments**

For each segment:

```tsx
<button className="df-time-share-segment" style={{ "--share": `${Math.round(segment.ratio * 100)}%` } as CSSProperties} onClick={() => setAnalysisTaskIds(segment.taskIds)}>
  <span>{segment.label}</span>
  <strong>{formatMinutes(segment.minutes)}</strong>
</button>
```

- [ ] **Step 4: Add drilldown list**

Clicking a segment shows matching task titles and minutes. Each task row opens task detail or focuses scheduled record if available.

- [ ] **Step 5: Add CSS**

Use horizontal data bars with `linear-gradient` only inside the data bar background if it remains subtle; no decorative gradient fills.

- [ ] **Step 6: Run tests/build and commit**

Run:

```bash
npx vitest run src/utils/timeShareMetrics.test.ts
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/main.tsx src/app-redesign.css
git commit -m "feat: add time share metrics view"
```

---

### Task 12: Unified Template Panel

**Files:**
- Modify: `src/types.ts`
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`
- Add tests in `src/utils/templates.test.ts` if template normalization is extracted to `src/utils/templates.ts`.

**Interfaces:**
- Produces `ScheduleTemplate` fields for mode, category, priority, importance, urgency, workflow status, default duration, fixed slots.

- [ ] **Step 1: Extend template types**

In `src/types.ts`, extend:

```ts
export type TemplateMode = "duration" | "fixed_time" | "category" | "advanced";

export interface ScheduleTemplate {
  id: string;
  title: string;
  mode?: TemplateMode;
  category?: Category;
  priority?: NullablePriority;
  importance?: NullablePriority;
  urgency?: NullablePriority;
  workflowStatus?: WorkflowStatus;
  defaultDurationMinutes?: number;
  slots: ScheduleTemplateSlot[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Normalize old templates**

In data normalization, set old templates to:

```ts
mode: "fixed_time",
defaultDurationMinutes: firstSlot ? minutesBetweenSlot(firstSlot.start, firstSlot.end) : 45
```

- [ ] **Step 3: Replace template UI shell**

In `ScheduleTemplateModal`, add top grouping buttons:

```tsx
{(["duration", "fixed_time", "category", "advanced"] as TemplateMode[]).map((mode) => (
  <button key={mode} className={templateMode === mode ? "active" : ""} onClick={() => setTemplateMode(mode)}>{templateModeLabel(mode, lang)}</button>
))}
```

- [ ] **Step 4: Add advanced fields**

Add category, priority, importance, urgency, and status selectors using nullable options. Use labels matching the spec: empty priority, empty important, empty urgent.

- [ ] **Step 5: Add application modes**

Implement three apply buttons:

- Create tasks only.
- Add to today's candidates.
- Schedule to timeline for selected date/time.

Each button calls existing task creation/scheduling helpers and passes template state.

- [ ] **Step 6: Run build and commit**

Run: `npm run build`

Expected: PASS.

Commit:

```bash
git add src/types.ts src/main.tsx src/app-redesign.css src/browserFallback.ts src/supabasePlannerApi.ts electron/main.cjs
git commit -m "feat: unify schedule templates"
```

---

### Task 13: Electron Always-On-Top Widget

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types.ts`
- Modify: `src/main.tsx`
- Modify: `src/app-redesign.css`

**Interfaces:**
- Produces `window.desktopApi.widget`:
  - `open(): Promise<boolean>`
  - `close(): Promise<boolean>`
  - `getSnapshot(): Promise<WidgetSnapshot>`
  - `quickAdd(title: string): Promise<WidgetSnapshot>`
  - `timer(action: "start" | "pause" | "stop", taskId?: string): Promise<WidgetSnapshot>`

- [ ] **Step 1: Add widget types**

In `src/types.ts`:

```ts
export interface WidgetSnapshot {
  nowDoing: { taskId?: string; title: string; source: "timer" | "schedule" | "candidate" | "empty"; elapsedSeconds?: number };
  timerRunning: boolean;
  quickAddProjectId?: string;
}
```

Extend `desktopApi` type with `widget`.

- [ ] **Step 2: Add Electron window manager**

In `electron/main.cjs`, add module-level `let widgetWindow = null;`. Add:

```js
function createWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show();
    widgetWindow.focus();
    return widgetWindow;
  }
  widgetWindow = new BrowserWindow({
    width: 360,
    height: 260,
    minWidth: 300,
    minHeight: 180,
    alwaysOnTop: true,
    title: "NavoPath Widget",
    frame: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const baseUrl = process.env.VITE_DEV_SERVER_URL || process.env.NAVOPATH_APP_URL;
  if (baseUrl) widgetWindow.loadURL(`${baseUrl}/app?widget=1`);
  else widgetWindow.loadFile(app.isPackaged ? path.join(app.getAppPath(), "dist", "index.html") : path.join(__dirname, "..", "dist", "index.html"), { query: { widget: "1" } });
  widgetWindow.once("ready-to-show", () => widgetWindow?.show());
  widgetWindow.on("closed", () => { widgetWindow = null; });
  return widgetWindow;
}
```

- [ ] **Step 3: Add widget IPC**

In `electron/main.cjs`:

```js
ipcMain.handle("widget:open", () => Boolean(createWidgetWindow()));
ipcMain.handle("widget:close", () => { if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close(); return true; });
ipcMain.handle("widget:getSnapshot", () => buildWidgetSnapshot());
ipcMain.handle("widget:quickAdd", (_event, title) => widgetQuickAdd(String(title || "")));
ipcMain.handle("widget:timer", (_event, action, taskId) => widgetTimer(action, taskId));
```

Implement `buildWidgetSnapshot`, `widgetQuickAdd`, and `widgetTimer` using existing `readData`, `saveData`, and current date helpers. If timer state is still React-local, store widget timer state in Electron user data or route widget timer actions through main window IPC in Task 14.

- [ ] **Step 4: Expose preload API**

In `electron/preload.cjs`:

```js
widget: {
  open: () => ipcRenderer.invoke("widget:open"),
  close: () => ipcRenderer.invoke("widget:close"),
  getSnapshot: () => ipcRenderer.invoke("widget:getSnapshot"),
  quickAdd: (title) => ipcRenderer.invoke("widget:quickAdd", title),
  timer: (action, taskId) => ipcRenderer.invoke("widget:timer", action, taskId),
},
```

- [ ] **Step 5: Add widget route in React**

At app bootstrap, detect:

```ts
const isWidgetRoute = new URLSearchParams(window.location.search).get("widget") === "1";
```

Render `WidgetApp` instead of full app when true.

- [ ] **Step 6: Add widget UI**

Create `WidgetApp` in `src/main.tsx` or a small `src/WidgetApp.tsx` if import cycles are clean. UI includes now doing, quick add input, start/pause/stop timer buttons.

- [ ] **Step 7: Add open button in main app more menu**

Add a button:

```tsx
<button type="button" onClick={() => void window.desktopApi?.widget?.open()}>{lang === "zh" ? "打开桌面小组件" : "Open desktop widget"}</button>
```

- [ ] **Step 8: Run build and commit**

Run: `npm run build`

Expected: PASS.

Commit:

```bash
git add electron/main.cjs electron/preload.cjs src/types.ts src/main.tsx src/app-redesign.css
git commit -m "feat: add always-on-top desktop widget"
```

---

### Task 14: Settings, Defaults, AI/Import Surfaces, And Changelog

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/i18n.ts`
- Modify: `src/aiAssistantApi.ts`
- Modify: `src/supabasePlannerApi.ts`
- Modify: `src/browserFallback.ts`
- Modify: `electron/main.cjs`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes all prior modules.
- Produces settings controls, AI action compatibility, import/export compatibility, and changelog entry.

- [ ] **Step 1: Settings defaults**

Ensure defaults include:

```ts
continuousCrossDayScroll: true,
defaultTimeShareRange: "30",
```

If `defaultTimeShareRange` is added to `Settings`, define it as `"7" | "30" | "90" | "all"`.

- [ ] **Step 2: Settings UI**

Add productivity settings for continuous cross-day scroll, widget open, habit defaults, metrics default range. Add shortcuts section using `SHORTCUTS`.

- [ ] **Step 3: AI/import fields**

Update AI action parsing and CSV import so invalid priority-like fields normalize through `normalizeNullableLevel`; missing fields stay empty except urgency defaulting to low for new tasks.

- [ ] **Step 4: Changelog**

Update `CHANGELOG.md` for 2026-07-01 with mirrored Chinese and English bullets:

Chinese bullet:

```md
- 新增生产力升级：习惯候选卡、全局搜索、时间占比指标、跨天时间块、桌面置顶小组件、统一模板、项目完成约束和快捷键参考。
```

English bullet:

```md
- Added the productivity upgrade: habit candidate card, global search, time share metrics, cross-day time blocks, always-on-top desktop widget, unified templates, constrained project completion, and shortcut reference.
```

- [ ] **Step 5: Run changelog maintainer**

Run:

```bash
node scripts/changelog-maintain.mjs
node scripts/changelog-maintain.mjs --check
```

Expected: PASS.

- [ ] **Step 6: Run build/tests and commit**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

Commit:

```bash
git add CHANGELOG.md electron/main.cjs src/main.tsx src/i18n.ts src/aiAssistantApi.ts src/supabasePlannerApi.ts src/browserFallback.ts
git commit -m "feat: finalize productivity upgrade settings"
```

---

### Task 15: Playwright Verification And Polish

**Files:**
- Modify only files needed to fix verification failures.
- Optional create: `docs/superpowers/qa/2026-07-01-productivity-upgrade.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces verified working UI.

- [ ] **Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves `http://127.0.0.1:5173/app` and Electron opens.

- [ ] **Step 2: Run Playwright checks**

Use the available Playwright tooling to verify:

- Main app loads without console errors.
- `Ctrl/Cmd+K` opens search.
- Search for a scheduled task jumps to its timeline block.
- Habit card renders below Today's Candidates.
- Dragging a habit item schedules it and leaves it marked scheduled.
- Time share metrics toggle actual/planned.
- Template panel can create/add/schedule.
- Cross-day scrolling updates header date and shows Back to now.
- Desktop widget opens and shows now doing, quick add, and timer controls.

- [ ] **Step 3: Record QA result**

Create `docs/superpowers/qa/2026-07-01-productivity-upgrade.md`:

```md
# Productivity Upgrade QA

Date: 2026-07-01

## Passed

- Main app loaded without console errors.
- Global search opened and jumped to a scheduled item.
- Habit card rendered and scheduled habit stayed marked scheduled.
- Time share metrics switched between actual and planned.
- Template panel created, added, and scheduled template items.
- Continuous cross-day scrolling updated the date header and showed Back to now.
- Desktop widget opened and showed now doing, quick add, and timer controls.

## Notes

- Vite chunk size warning remains pre-existing and does not block this release.
```

- [ ] **Step 4: Final build and test**

Run:

```bash
npm test
npm run build
node scripts/changelog-maintain.mjs --check
```

Expected: PASS.

- [ ] **Step 5: Commit verification fixes and QA doc**

Commit:

```bash
git add docs/superpowers/qa/2026-07-01-productivity-upgrade.md CHANGELOG.md src electron
git commit -m "test: verify productivity upgrade"
```

---

## Self-Review

- Spec coverage: every approved feature maps to a task: nullable states and project completion in Tasks 1/7; cross-day timeline in Tasks 2/10; habits in Tasks 3/8; command search and shortcuts in Tasks 6/9/14; time share metrics in Tasks 5/11; templates in Task 12; widget in Task 13; normalization in Task 4; verification in Task 15.
- Placeholder scan: plan avoids unresolved-marker and fill-in language. Where exact existing function names may differ in `main.tsx`, the plan names the required wrapper behavior and exact call sites to preserve behavior.
- Type consistency: `NullablePriority`, `Habit`, `HabitDailyState`, `TimelineFocusTarget`, `WidgetSnapshot`, `CommandSearchResult`, and shortcut interfaces are introduced before later tasks consume them.
