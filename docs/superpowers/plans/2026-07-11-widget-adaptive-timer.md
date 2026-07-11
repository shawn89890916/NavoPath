# Desktop Widget Adaptive Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship NavoPath 1.2.37 with a freely resizable, theme-following desktop widget that supports stopwatch, automatic Pomodoro, countdown-to-overrun, compact More controls, and screen-edge-safe popover placement.

**Architecture:** Add a pure wall-clock widget timer engine and normalized version-2 widget preferences, then connect them to the existing main React timer as the single source of task work-time truth. Keep the primary widget and More popover as IPC clients. Electron continues to own window creation, native resizing, display-aware clamping, popover placement, and popover-open state broadcasting.

**Tech Stack:** React 19, TypeScript, scoped CSS/container queries, Electron 37 CommonJS main/preload, Node test runner, Vitest, electron-builder, GitHub Actions.

## Global Constraints

- Default widget bounds stay exactly 500 by 88 pixels; minimum bounds become exactly 128 by 56 pixels.
- The primary widget remains a single horizontal row at every size.
- Width controls visibility: full at 360+, timer plus More at 220–359, timer only below 220; height controls typography/control scaling.
- Timer pointer movement beyond 5 pixels is a drag and must suppress start/pause on release.
- More is a separate window and must never change widget bounds or leave the active display work area.
- More contains only mode settings, background opacity, always-on-top, shadow visibility, and Close More. Full appearance/reset controls stay in Settings > Desktop Widget.
- Timer modes are `stopwatch | pomodoro | countdown`; Pomodoro has focus, break, and rounds only—no long break.
- Countdown reaches zero, notifies, then runs a red flashing overrun stopwatch; Pomodoro notifies and automatically advances every phase.
- Widget theme always follows main Settings theme, with separate persisted light/dark color groups.
- Shared controls use active theme variables and no hard-coded purple/lime.
- Chinese and English changelog entries are semantically mirrored.
- Release version is 1.2.37 and tag is `v1.2.37`; release assets must include `latest.yml`, setup exe, blockmap, and portable exe.

---

### Task 1: Timer engine and version-2 preference contracts

**Files:**
- Create: `src/widget/widgetTimer.ts`
- Create: `src/widget/widgetTimer.test.ts`
- Modify: `src/types.ts`
- Modify: `src/widget/widgetPreferences.ts`
- Modify: `src/widget/widgetPreferences.test.ts`
- Modify: `src/defaultSettings.ts`
- Modify: `src/browserFallback.ts`
- Modify: `src/supabasePlannerApi.ts`

**Interfaces:**
- Produces `WidgetTimerMode`, `WidgetTimerPhase`, `WidgetTimerPreferences`, `WidgetTimerRuntime`, and `WidgetThemeColors` in `src/types.ts`.
- Produces `DEFAULT_WIDGET_TIMER_PREFERENCES`, `DEFAULT_WIDGET_RUNTIME`, `normalizeWidgetTimerPreferences`, `createWidgetTimerRuntime`, and `advanceWidgetTimer` in `widgetTimer.ts`.
- Produces version-2 `WidgetAppearance` with `light`, `dark`, `opacity`, `fontFamily`, `fontScale`, `shadowEnabled`, and `version`.

- [ ] **Step 1: Write failing timer-engine tests**

Create tests for exact behaviors:

```ts
expect(advanceWidgetTimer(
  createWidgetTimerRuntime("countdown", 0, { ...prefs, countdownSeconds: 60 }),
  prefs,
  61_000,
)).toMatchObject({ phase: "overrun", displaySeconds: 1, transitions: ["countdownComplete"] });

expect(advanceWidgetTimer(
  createWidgetTimerRuntime("pomodoro", 0, prefs),
  prefs,
  25 * 60_000,
)).toMatchObject({ phase: "break", round: 1, transitions: ["focusComplete"] });

expect(advanceWidgetTimer(focusRuntime, prefs, 30 * 60_000)).toMatchObject({
  phase: "focus",
  round: 2,
  transitions: ["focusComplete", "breakComplete"],
});
```

Also cover pause/resume timestamp adjustment, multi-phase sleep catch-up, invalid duration fallback, and no long-break phase.

- [ ] **Step 2: Run timer tests and verify RED**

Run: `npx vitest run src/widget/widgetTimer.test.ts`

Expected: FAIL because the module and contracts do not exist.

- [ ] **Step 3: Implement the pure wall-clock engine**

Use these exact public shapes:

```ts
export interface WidgetTimerPreferences {
  mode: "stopwatch" | "pomodoro" | "countdown";
  focusMinutes: number;
  breakMinutes: number;
  rounds: number;
  countdownSeconds: number;
}

export interface WidgetTimerRuntime {
  mode: WidgetTimerMode;
  phase: "stopwatch" | "focus" | "break" | "countdown" | "overrun";
  running: boolean;
  round: number;
  phaseStartedAt: number;
  phaseEndsAt?: number;
  pausedAt?: number;
}

export interface WidgetTimerTick {
  runtime: WidgetTimerRuntime;
  displaySeconds: number;
  transitions: Array<"focusComplete" | "breakComplete" | "countdownComplete">;
  countsAsWork: boolean;
}
```

Advance using timestamps in a bounded loop (maximum 64 phase transitions) so background sleep catches up without interval drift.

- [ ] **Step 4: Run timer tests and verify GREEN**

Run: `npx vitest run src/widget/widgetTimer.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing appearance migration tests**

Assert version-1 appearance migrates current colors into `light`, receives charcoal/warm-ivory dark defaults, keeps opacity, and normalizes timer values/ranges. Assert invalid colors and values fall back safely.

- [ ] **Step 6: Implement normalized preferences and defaults**

Use version 2 and exact theme structure:

```ts
interface WidgetThemeColors {
  backgroundColor: string;
  fontColor: string;
  timerColor: string;
  overrunColor: string;
}
```

Light defaults: `#FBF9FF`, `#27231E`, `#5D9B63`, `#B34F47`. Dark defaults: `#27231E`, `#EEE9DF`, `#70D978`, `#E27C68`. Preserve `opacity: 0.96`, system sans font, scale `1`, and shadow enabled.

Add matching defaults/merge behavior to all three Settings backends without changing unrelated defaults.

- [ ] **Step 7: Verify preference suites and commit**

Run: `npx vitest run src/widget/widgetTimer.test.ts src/widget/widgetPreferences.test.ts src/browserFallback.test.ts src/supabasePlannerApi.test.ts`

Expected: PASS.

Commit: `feat: add widget timer and theme contracts`

---

### Task 2: Main application timer orchestration and IPC actions

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/types.ts`
- Modify: `src/widget/widgetTimer.test.ts`

**Interfaces:**
- Extends `WidgetSnapshot` with `theme`, `timerPreferences`, `timerRuntime`, `timerDisplaySeconds`, `timerPhase`, and `popoverOpen`.
- Extends `WidgetAction` with `setTimerMode`, `updateTimerPreferences`, `toggleWidgetTimer`, `updateWidgetAppearance`, and `setWidgetShadow`.
- Consumes Task 1 engine functions.

- [ ] **Step 1: Write failing orchestration tests around pure transition helpers**

Extend `widgetTimer.test.ts` to assert `countsAsWork` is true for stopwatch/focus/countdown/overrun and false for break, and that emitted transitions map to localized notification descriptors.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/widget/widgetTimer.test.ts`

Expected: FAIL for missing work/notification helpers.

- [ ] **Step 3: Implement main-store orchestration**

In `main.tsx`:

- initialize normalized timer preferences/runtime from Settings/localStorage;
- advance runtime from `Date.now()` once per second while running;
- call the existing task `pauseTimer()` on focus→break and `resumeTimer()` on break→focus;
- keep task time running for countdown and overrun;
- create a desktop `Notification` at every phase transition when permission allows;
- persist runtime timestamps so reopen/sleep restores the correct phase;
- include theme and normalized timer state in `buildWidgetSnapshot()`;
- handle the new actions through `saveSettings` and existing timer callbacks.

Do not duplicate task time records or create a second task timer store.

- [ ] **Step 4: Push live snapshot updates**

Add timer preferences/runtime/theme/popover state to the existing snapshot effect dependencies. Existing snapshot relay remains the only renderer update path.

- [ ] **Step 5: Run focused tests/build and commit**

Run: `npx vitest run src/widget/widgetTimer.test.ts src/widget/WidgetApp.test.tsx`

Run: `npm run build`

Expected: all exit 0.

Commit: `feat: orchestrate widget timer modes`

---

### Task 3: Adaptive primary widget and compact More UI

**Files:**
- Modify: `src/widget/WidgetApp.tsx`
- Modify: `src/widget/WidgetApp.test.tsx`
- Modify: `src/widget/widget.css`
- Modify: `src/widget/widgetPreferences.ts`
- Modify: `src/widget/widgetPreferences.test.ts`

**Interfaces:**
- Produces `getWidgetDensity(width)` returning `full | timerControls | timerOnly` at exact 360/220 thresholds.
- Produces click-versus-drag helper using an exact 5-pixel movement threshold.
- Consumes Task 2 snapshot/actions.

- [ ] **Step 1: Write failing responsive/markup tests**

Assert:

```ts
expect(getWidgetDensity(500)).toBe("full");
expect(getWidgetDensity(359)).toBe("timerControls");
expect(getWidgetDensity(219)).toBe("timerOnly");
```

Render full and time-only views and assert no status/play/project footer; full contains task, timer, and More; time-only contains only the timer. Assert `data-phase="overrun"`, theme attribute, and More-open red close-widget button.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetPreferences.test.ts`

Expected: FAIL on missing adaptive layout and mode controls.

- [ ] **Step 3: Implement primary widget interaction**

- replace play button with clickable timer;
- use pointer capture, initial screen coordinates, and the 5-pixel threshold;
- when threshold is crossed, move the window via existing bounds IPC and suppress toggle;
- render task name only at full density;
- render More at full/timerControls densities;
- render only timer below 220 pixels;
- change More to restrained red Close widget while `popoverOpen` is true.

- [ ] **Step 4: Implement compact More controls**

- flat three-part radio group with normal background/separators;
- selected middle uses rectangular outline; selected first/last only inherit the relevant outside radius;
- neutral top-row X sends Close More;
- Stopwatch shows no-duration copy;
- Pomodoro shows focus, break, rounds only;
- Countdown shows 15/25/45/60 presets plus custom seconds;
- retain opacity, always-on-top, and shadow only.

- [ ] **Step 5: Implement CSS/container behavior**

Use container width for visibility and container height for `clamp()` font/button/padding/radius scaling. Add restrained overrun animation with a reduced-motion override. Bind light/dark variables from the snapshot's active theme color group.

- [ ] **Step 6: Verify UI suites/build and commit**

Run: `npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetPreferences.test.ts src/widget/widgetTimer.test.ts`

Run: `npm run build`

Expected: all exit 0.

Commit: `feat: build adaptive widget timer UI`

---

### Task 4: Electron sizing, popover state, and edge-safe placement

**Files:**
- Modify: `electron/widget-window.cjs`
- Modify: `electron/widget-window.test.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types.ts`

**Interfaces:**
- Changes native minimum size to 128 by 56.
- Produces `positionPopover(widgetBounds, requestedSize, workArea)` returning `x`, `y`, `width`, `height`, `openAbove`, and `scrollRequired`.
- Adds renderer event `widget:popover-state` and preload `onPopoverState(listener)`.

- [ ] **Step 1: Write failing geometry/lifecycle tests**

Cover below/right placement, flip above, right/left clamping, negative display coordinates, work area shorter than the requested popover, 125% equivalent fractional bounds rounding, move/resize dismissal, and state broadcasts `true` on show / `false` on close.

Example:

```js
assert.deepEqual(positionPopover(
  { x: 1800, y: 950, width: 128, height: 56 },
  { width: 332, height: 360 },
  { x: 1280, y: 0, width: 1920, height: 1080 },
), { x: 1596, y: 584, width: 332, height: 360, openAbove: true, scrollRequired: false });
```

- [ ] **Step 2: Verify RED**

Run: `node --test electron/widget-window.test.cjs`

Expected: FAIL for old minimums/placement/state APIs.

- [ ] **Step 3: Implement adaptive Electron placement**

- set minWidth 128 and minHeight 56 in constants/window options/clamping;
- size popover to content target 332 wide and up to 420 high;
- clamp within the matching display work area with `WINDOW_MARGIN`;
- flip above when below lacks room;
- when neither direction fits, use available height and let renderer scroll;
- recompute or close on widget/display metrics changes;
- broadcast popover open state to the primary widget renderer;
- keep stale-window event guards and saved multi-display bounds behavior.

- [ ] **Step 4: Wire preload/types and verify**

Expose `onPopoverState`, update TypeScript declarations, and keep context isolation.

Run: `node --test electron/widget-window.test.cjs`

Run: `npm run build`

Expected: PASS.

Commit: `feat: keep widget popover inside the work area`

---

### Task 5: Detailed settings, changelog, and 1.2.37 release preparation

**Files:**
- Modify: `src/main.tsx`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Settings > Desktop Widget edits the same version-2 appearance/timer preferences used by More.
- Produces package version 1.2.37.

- [ ] **Step 1: Add detailed settings controls**

Keep theme following main Settings. Add font family, font scale, separate light/dark background/text/timer/overrun colors, timer mode/durations, opacity, always-on-top, shadow, reset 500x88 position/size, and restore version-2 appearance. Remove obsolete version-1 assumptions.

- [ ] **Step 2: Update mirrored changelog**

Add one concise 2026-07-11 Chinese entry and one semantically mirrored English entry describing adaptive resizing/time-only minimum, three timer modes and phase behavior, theme following, compact settings, and screen-edge-safe More placement.

Run: `node scripts/changelog-maintain.mjs`

Run: `node scripts/changelog-maintain.mjs --check`

- [ ] **Step 3: Bump version with apply_patch**

Set `package.json`, `package-lock.json` root, and `package-lock.json packages[""]` to exactly `1.2.37` without changing dependencies.

- [ ] **Step 4: Verify and commit**

Run: `npm test`

Run: `npm run build`

Run: `node scripts/changelog-maintain.mjs --check`

Run: `node -e "const p=require('./package.json'),l=require('./package-lock.json'); if(p.version!=='1.2.37'||l.version!=='1.2.37'||l.packages[''].version!=='1.2.37')process.exit(1)"`

Expected: all exit 0.

Commit: `release: prepare adaptive widget timer 1.2.37`

---

### Task 6: Final review, merge, publish, and latest verification

**Files:**
- No product changes unless review or verification finds a defect.

- [ ] **Step 1: Run final branch review and fix all Critical/Important findings**

Review the complete diff from the branch base through HEAD against the design spec and this plan.

- [ ] **Step 2: Run complete fresh verification**

Run: `npm test`

Run: `npm run build`

Run: `node scripts/changelog-maintain.mjs --check`

Run: `git diff --check $(git merge-base main HEAD)..HEAD` (or the PowerShell equivalent using `$base = git merge-base main HEAD`).

- [ ] **Step 3: Merge and verify main**

Fast-forward the isolated branch into `main`, remove the worktree, rerun `npm test` and `npm run build`, inspect status/diff, and push `main` without force.

- [ ] **Step 4: Tag and monitor release**

Create annotated tag `v1.2.37`, push it, and monitor `.github/workflows/desktop-release.yml` to success.

- [ ] **Step 5: Verify published updater assets**

Confirm latest release tag is `v1.2.37`, release is neither draft nor prerelease, required assets are uploaded under the real tag, and downloaded `latest.yml` contains `version: 1.2.37`, non-empty sha512, and installer size.
