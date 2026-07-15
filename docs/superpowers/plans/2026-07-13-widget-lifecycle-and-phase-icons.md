# Widget Lifecycle and Phase Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix widget shutdown races and refine timer alignment, reset, hover guidance, and Pomodoro phase controls.

**Architecture:** Keep native lifecycle validation in `electron/widget-window.cjs` and presentation state in `src/widget/WidgetApp.tsx`. Reuse the existing reset action and timer runtime; do not add another timer store.

**Tech Stack:** Electron BrowserWindow, React 19, TypeScript, Lucide React, Node test runner, Vitest.

---

### Task 1: Closing lifecycle race
- [ ] Extend the fake BrowserWindow so `webContents` can be destroyed independently.
- [ ] Add a test that closes the parent while the popover emits `closed` and confirm the existing broadcaster throws.
- [ ] Guard both BrowserWindow and `webContents` before every send.
- [ ] Run `node --test electron/widget-window.test.cjs` and confirm green.

### Task 2: Utility reset and hover guidance
- [ ] Add component tests for Reset/Pin/Close order and reset callback routing.
- [ ] Add mounted tests proving hover renders a pointer-positioned tooltip and does not change selection.
- [ ] Implement `RotateCcw`, remove the permanent description row, and add the quiet tooltip.
- [ ] Run `npx vitest run src/widget/WidgetApp.test.tsx` and confirm green.

### Task 3: Pomodoro phase controls and vertical alignment
- [ ] Add render tests for Cherry during focus, Sprout during break, and standard Pause outside Pomodoro.
- [ ] Implement phase-specific labels/tooltips while preserving the existing toggle callback.
- [ ] Move the strip to a two-column grid with one right-side flex row and stretch-centered timer content.
- [ ] Run widget tests and TypeScript checks.

### Task 4: Release verification
- [ ] Update mirrored changelog entries and bump the patch version.
- [ ] Run the complete test suite, changelog check, and production build.
- [ ] Commit and push only scoped files, tag the version, build four desktop assets, and publish them as Latest.
