# Desktop Widget Deadline Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind all desktop-widget timers to the active timeline task and provide deadline-aligned Pomodoro planning in the existing popover.

**Architecture:** Extend the existing widget snapshot/runtime instead of creating another store. Keep scheduling math and record synchronization as pure helpers, while `main.tsx` owns persistence and `WidgetApp.tsx` owns draft/hover UI state.

**Tech Stack:** React 19, TypeScript, Vitest, Electron IPC, lucide-react.

---

### Task 1: Deadline and schedule domain helpers
- [ ] Add failing tests for active-record deadline resolution, countdown fallback, overtime extension, pause protection, and preserving later records.
- [ ] Run the focused tests and confirm they fail for missing APIs.
- [ ] Implement pure record-bound and schedule-extension helpers in `src/widget/widgetSchedule.ts`.
- [ ] Run the focused tests until green.

### Task 2: Deadline-aligned Pomodoro planner
- [ ] Add failing tests for all fifteen required planner invariants and deadline changes.
- [ ] Run the planner test and confirm the missing function failure.
- [ ] Implement `generateDeadlineAlignedPomodoroPlan` in `src/widget/pomodoroPlan.ts` with balanced work phases and break degradation.
- [ ] Run the planner tests until green.

### Task 3: Shared runtime and snapshot integration
- [ ] Add failing runtime tests for plan phases, work-only accumulation, restart catch-up, countdown target, and overtime.
- [ ] Extend widget types/preferences/runtime and snapshot deadline fields.
- [ ] Integrate the planner and active record metadata into `src/main.tsx` and `src/widget/widgetTimer.ts`.
- [ ] Add throttled/final schedule synchronization through the shared helper.
- [ ] Run widget timer and schedule tests until green.

### Task 4: Single-popover interaction
- [ ] Add failing mounted tests proving hover changes only description and click changes draft selection.
- [ ] Replace the nested settings-page transition with inline mode configuration and a fixed explanation region.
- [ ] Add countdown deadline controls and compact Pomodoro preview/summary.
- [ ] Update `src/widget/widget.css` using paper/ink theme variables and one-pixel selected rules.
- [ ] Run widget component tests until green.

### Task 5: Product verification and release
- [ ] Update mirrored changelog sections and bump the patch version.
- [ ] Run changelog check, full tests, and production build.
- [ ] Inspect the complete diff and requirement checklist.
- [ ] Commit and push main plus the new semver tag.
- [ ] Build all four desktop release assets, publish the GitHub Release as Latest, and verify its asset list.
