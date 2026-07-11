# Widget Resize, Task-Deadline Countdown, and Compact Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows desktop widget visibly resizable, target countdowns at the active task's due date, and replace the crowded More panel with a draft-and-save timer settings flow.

**Architecture:** Electron owns widget geometry. The renderer supplies transparent, no-drag eight-direction resize targets and sends clamped bounds through IPC. The main app owns task, timeline, and timer persistence; it resolves a countdown target from the active task due date or from a user-created timeline record, and saves timer-setting drafts as one action.

**Tech Stack:** Electron BrowserWindow and context-isolated IPC, React/TypeScript, Vitest, Node `node:test`, existing settings persistence and timeline records.

## Global Constraints

- Keep the widget frameless, transparent, and resizable; never restore a Windows title bar.
- Use eight transparent no-drag resize handles with correct edge/corner cursors; the central paper is the move region.
- Minimum geometry is `128 × 56`; first-open and reset geometry is `400 × 80`.
- Countdown defaults to the active task's `dueDate` at the end of its local due-date day.
- A task without a due date cannot start countdown until the user schedules it to the timeline and explicitly enters a duration.
- More resting view contains only background opacity, independent topmost/shadow toggles, and Timer settings.
- Timer edits are draft-only until Save; Cancel discards them; Reset timer resets only the current timer state.
- Follow `NavoPathStyle.md`: theme variables, paper/ink rules, no purple/lime, gradients, glow, or filled selected capsules.
- Update mirrored `CHANGELOG.md`, version, test, build, commit, and push after implementation.

---

### Task 1: Native geometry defaults and renderer resize handles

**Files:**
- Modify: `electron/widget-window.cjs`
- Modify: `electron/widget-window.test.cjs`
- Modify: `src/widget/WidgetApp.tsx`
- Modify: `src/widget/WidgetApp.test.tsx`
- Modify: `src/widget/widget.css`

**Interfaces:**
- Produces `DEFAULT_WIDGET_WIDTH = 400`, `DEFAULT_WIDGET_HEIGHT = 80`, and identical reset bounds.
- Produces `WidgetResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"`.
- Produces `resizeWidgetBounds(initial, direction, delta, workArea): WidgetBounds`.

- [ ] **Step 1: Write failing Electron default-bounds test**

```js
test("opens and resets the widget at the compact 400 by 80 default", async () => {
  const { deps, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();
  assert.equal(win.options.width, 400);
  assert.equal(win.options.height, 80);
  await handlers.get("widget:set-bounds")(null, { width: 128, height: 56 });
  assert.deepEqual(win.getBounds(), { x: 80, y: 80, width: 128, height: 56 });
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test electron/widget-window.test.cjs`

Expected: FAIL because the service still opens at `500 × 88`.

- [ ] **Step 3: Write failing resize-helper/component test**

```ts
it("identifies all eight handles and keeps the opposite edge stable", () => {
  expect(getWidgetResizeDirection({ x: 0, y: 0 }, { x: 0, y: 0, width: 400, height: 80 }, 8)).toBe("nw");
  expect(getWidgetResizeDirection({ x: 399, y: 40 }, { x: 0, y: 0, width: 400, height: 80 }, 8)).toBe("e");
  expect(resizeWidgetBounds({ x: 100, y: 100, width: 400, height: 80 }, "w", { x: 30, y: 0 }, workArea)).toMatchObject({ x: 130, width: 370 });
});
```

- [ ] **Step 4: Verify RED**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: FAIL because the helpers and resize-handle markup do not exist.

- [ ] **Step 5: Implement minimal geometry changes**

```tsx
const DIRECTIONS: WidgetResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function WidgetResizeHandles({ onResize }: { onResize: (direction: WidgetResizeDirection, dx: number, dy: number) => void }) {
  return <div className="df-widget-resize-layer" aria-hidden="true">
    {DIRECTIONS.map((direction) => <div key={direction} className={`df-widget-resize-handle is-${direction}`} onPointerDown={(event) => beginResize(event, direction, onResize)} />)}
  </div>;
}
```

Set native defaults and all reset callers to `{ x: 80, y: 80, width: 400, height: 80 }`. Remove the renderer `navopath-widget-bounds` restore/poll loop so localStorage cannot overwrite Electron's native persistence. Make every handle `-webkit-app-region: no-drag`, with the matching eight cursor values; retain the card as the only move region.

- [ ] **Step 6: Verify GREEN**

Run: `node --test electron/widget-window.test.cjs && npx vitest run src/widget/WidgetApp.test.tsx`

Expected: PASS with compact defaults, edge directions, cursor classes, and clamped resize bounds.

- [ ] **Step 7: Commit**

```bash
git add electron/widget-window.cjs electron/widget-window.test.cjs src/widget/WidgetApp.tsx src/widget/WidgetApp.test.tsx src/widget/widget.css
git commit -m "fix: add visible widget resize handles"
```

### Task 2: Absolute task-deadline countdown contract

**Files:**
- Modify: `src/types.ts`
- Modify: `src/widget/widgetTimer.ts`
- Modify: `src/widget/widgetTimer.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Adds `countdownTargetAt?: number` and `countdownTaskId?: string` to `WidgetTimerRuntime`.
- Produces `taskDueDateTargetAt(dueDate: string | undefined): number | undefined`.
- Extends `createWidgetTimerRuntime(mode, now, preferences, countdownTargetAt?)`.
- Produces `resetWidgetTimerRuntime(runtime, preferences, now): WidgetTimerRuntime`.

- [ ] **Step 1: Write failing timer tests**

```ts
it("uses the end of the local due-date day as countdown target", () => {
  const target = taskDueDateTargetAt("2026-07-11");
  expect(new Date(target!).getHours()).toBe(23);
  expect(new Date(target!).getMinutes()).toBe(59);
});

it("enters overrun after an absolute countdown target", () => {
  const runtime = createWidgetTimerRuntime("countdown", 1_000, { ...prefs, mode: "countdown" }, 2_000);
  expect(advanceWidgetTimer(runtime, prefs, 2_001).runtime.phase).toBe("overrun");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/widget/widgetTimer.test.ts`

Expected: FAIL because the target resolver and absolute-target argument do not exist.

- [ ] **Step 3: Implement normalized target behavior**

```ts
export function taskDueDateTargetAt(dueDate?: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) return undefined;
  const target = new Date(`${dueDate}T23:59:59.999`);
  return Number.isFinite(target.getTime()) ? target.getTime() : undefined;
}
```

For countdown, retain a valid target only when it is finite and positive; assign it to both `countdownTargetAt` and `phaseEndsAt`. When switching to countdown in `main.tsx`, resolve the active task's `dueDate`, save `countdownTaskId`, and create a paused runtime. If no target exists, leave `phaseEndsAt` absent and block starting until Task 3 schedules it.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/widget/widgetTimer.test.ts src/widget/WidgetApp.test.tsx`

Expected: PASS for deadline display, passed target overrun, and missing-target safety.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/widget/widgetTimer.ts src/widget/widgetTimer.test.ts src/main.tsx
git commit -m "feat: target widget countdowns at task deadlines"
```

### Task 3: Timeline scheduling and draft timer-settings view

**Files:**
- Modify: `src/types.ts`
- Modify: `src/main.tsx`
- Modify: `src/widget/WidgetApp.tsx`
- Modify: `src/widget/WidgetApp.test.tsx`
- Modify: `src/widget/widget.css`
- Modify: `src/widget/widgetTimer.test.ts`

**Interfaces:**
- Adds actions:

```ts
| { type: "saveTimerSettings"; draft: WidgetTimerPreferences }
| { type: "resetWidgetTimer" }
| { type: "scheduleWidgetCountdown"; durationMinutes: number }
```

- Produces a `WidgetTimerSettingsView` receiving `onSave(draft)`, `onCancel()`, `onReset()`, and `onSchedule(durationMinutes)`.

- [ ] **Step 1: Write failing More-view tests**

```tsx
it("keeps timer fields hidden until Timer settings opens", () => {
  const html = render(<WidgetPopoverView snapshot={countdownWithoutDeadline} {...handlers} />);
  expect(html).toContain("Timer settings");
  expect(html).not.toContain('role="radiogroup"');
});

it("shows scheduling guidance for a countdown without a task deadline", () => {
  const html = render(<WidgetTimerSettingsView snapshot={countdownWithoutDeadline} {...handlers} />);
  expect(html).toContain("Please schedule it on the timeline first");
  expect(html).toContain("Schedule for now");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: FAIL because More immediately renders the mode selector and lacks a draft settings view.

- [ ] **Step 3: Write failing schedule helper test**

```ts
it("uses the user-entered duration to schedule the active task from now", () => {
  const result = scheduleWidgetCountdown(task, new Date("2026-07-11T10:15:00"), 45);
  expect(result.record).toMatchObject({ scheduledDate: "2026-07-11", scheduledStart: "10:15", scheduledEnd: "11:00", executionStatus: "scheduled" });
  expect(result.countdownTargetAt).toBe(new Date("2026-07-11T11:00:00").getTime());
});
```

- [ ] **Step 4: Verify RED**

Run: `npx vitest run src/widget/widgetTimer.test.ts`

Expected: FAIL because the schedule helper does not exist.

- [ ] **Step 5: Implement draft/save, reset, and scheduling**

```tsx
const [editingTimer, setEditingTimer] = useState(false);
const [draft, setDraft] = useState(snapshot.timerPreferences);

if (!editingTimer) {
  return <button type="button" className="df-widget-timer-settings-action" onClick={() => { setDraft(snapshot.timerPreferences); setEditingTimer(true); }}>Timer settings</button>;
}
```

Resting More renders opacity and two independent compact toggle buttons only. Edit mode renders mode, mode-specific fields, Reset timer, Cancel, and Save. A missing countdown target renders the required empty state; Schedule for now opens a duration input accepting only integer 1–1440 minutes before sending the schedule action.

In `main.tsx`, append one `TimelineRecord` to the active task using existing `createScheduledRecord`, date/time helpers, and user duration. Persist through `saveData`, then create a paused countdown runtime with the record end timestamp. Save commits the complete draft through one action; Cancel sends no action; Reset creates the current mode's initial paused runtime.

- [ ] **Step 6: Verify GREEN**

Run: `npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetTimer.test.ts`

Expected: PASS for empty-state scheduling, draft Save/Cancel, Reset, and independent compact toggles.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/main.tsx src/widget/WidgetApp.tsx src/widget/WidgetApp.test.tsx src/widget/widget.css src/widget/widgetTimer.test.ts
git commit -m "feat: simplify widget timer settings"
```

### Task 4: Detailed-settings parity, changelog, release metadata, and verification

**Files:**
- Modify: `src/main.tsx`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Detailed Settings > Desktop Widget routes timer Save/Reset through the same `WidgetAction` path as More.
- Produces one mirrored Chinese/English release note for resize, deadline countdown, scheduling, and compact controls.

- [ ] **Step 1: Write failing shared-settings action test**

```ts
it("routes settings timer Save through the shared widget action", () => {
  expect(settingsTimerSaveAction({ ...prefs, mode: "countdown" })).toEqual({
    type: "saveTimerSettings", draft: { ...prefs, mode: "countdown" },
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/widget/widgetTimer.test.ts`

Expected: FAIL because detailed settings save individual mode fields directly.

- [ ] **Step 3: Implement settings parity**

Route detailed Settings > Desktop Widget through the same Save/Reset actions as More. Update its reset description and call site to `400 × 80`; remove legacy localStorage geometry deletion. Keep font/color controls only in detailed Settings, not More.

- [ ] **Step 4: Update changelog and patch version**

Add one concise current-date Chinese entry and semantically mirrored English entry for visible resize arrows, task-deadline countdown/scheduling requirement, draft timer settings, and independent topmost/shadow toggles. Run:

```bash
node scripts/changelog-maintain.mjs
node scripts/changelog-maintain.mjs --check
```

Bump the patch version identically in `package.json`, `package-lock.json` root, and `package-lock.json` `packages[""]`, without dependency changes.

- [ ] **Step 5: Verify complete branch**

Run:

```bash
npm test
npm run build
node scripts/changelog-maintain.mjs --check
git diff --check
node -e "const p=require('./package.json'),l=require('./package-lock.json'); if (p.version!==l.version || p.version!==l.packages[''].version) process.exit(1)"
```

Expected: every command exits `0`.

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx CHANGELOG.md package.json package-lock.json
git commit -m "release: prepare widget resize update"
```

## Plan Self-Review

- Spec coverage: Task 1 covers visible Windows resize arrows, native geometry ownership, and compact defaults. Task 2 covers task due-date absolute targets, sleep-safe timing, and overrun. Task 3 covers no-deadline scheduling, duration entry, draft Save/Cancel, Reset, and compact More controls. Task 4 covers detailed-settings parity, changelog, version, and full verification.
- Placeholder scan: no TODO/TBD or unspecified implementation steps remain.
- Type consistency: Task 2 introduces runtime target fields; Task 3 introduces the three widget actions and consumes those fields; Task 4 reuses Task 3 actions.

