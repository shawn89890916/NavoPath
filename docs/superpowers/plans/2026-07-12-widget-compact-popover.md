# Widget Compact Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized widget More sheet with a compact `250 × 220` tool panel matching the approved reference.

**Architecture:** Electron owns the compact native popover geometry and placement. React keeps the existing timer action flow but restructures the resting controls and inline timer details; CSS supplies the compact paper-and-ink layout without purple or shadows.

**Tech Stack:** Electron, React 19, TypeScript, Lucide React, Vitest, Node test runner.

## Global Constraints

- Native popover default is `250 × 220` logical pixels with the existing six-pixel widget gap.
- No visible “More” heading; Pin/PinOff and Close occupy a compact upper-right utility row.
- Opacity label, range, and percentage share one row.
- Timer modes are three equal-width text tabs; selection is ink plus a one-pixel underline, never purple, filled capsules, or thick outlines.
- Timer details replace resting content inside the same panel; only the detail region may scroll.
- Use active widget theme variables, Lucide line icons, no shadow, no scale/lift, and 150–180ms transitions.
- Update mirrored Chinese and English `CHANGELOG.md` entries for 2026-07-12.

---

### Task 1: Compact native popover geometry

**Files:**
- Modify: `electron/widget-window.cjs`
- Test: `electron/widget-window.test.cjs`

**Interfaces:**
- Consumes: `positionPopover(widgetBounds, popoverSize, workArea)`.
- Produces: native More window created at `250 × 220`, clamped above/below the widget with the existing gap.

- [ ] **Step 1: Write the failing native geometry test**

```js
test("opens the compact More panel at 250 by 220 logical pixels", async () => {
  await handlers.get("widget:toggle-popover")();
  assert.equal(windows[1].options.width, 250);
  assert.equal(windows[1].options.height, 220);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test electron/widget-window.test.cjs`

Expected: FAIL because the current popover is `332 × 420`.

- [ ] **Step 3: Implement compact constants**

```js
const POPOVER_WIDTH = 250;
const POPOVER_HEIGHT = 220;
```

Keep `POPOVER_GAP = 6` and the existing work-area clamping behavior.

- [ ] **Step 4: Run GREEN and full tests**

Run: `node --test electron/widget-window.test.cjs && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/widget-window.cjs electron/widget-window.test.cjs
git commit -m "fix: compact widget popover window"
```

### Task 2: Compact panel layout, inline details, and changelog

**Files:**
- Modify: `src/widget/WidgetApp.tsx`
- Modify: `src/widget/widget.css`
- Test: `src/widget/WidgetApp.test.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: existing `WidgetPopoverView`, `WidgetTimerSettingsView`, opacity, pin, close, schedule, reset, save, and cancel callbacks.
- Produces: compact resting panel and same-window inline timer detail view.

- [ ] **Step 1: Write failing rendering and CSS-contract tests**

```tsx
it("renders the compact More panel without a heading and with inline controls", () => {
  const html = render(snapshot);
  expect(html).not.toContain(">More<");
  expect(html).toContain("df-widget-popover-utilities");
  expect(html).toContain("df-widget-opacity-row");
  expect(html).toContain('role="radiogroup"');
});
```

Add CSS assertions for a one-row opacity grid, one-pixel selected underline, scoped detail scrolling, and absence of purple/shadow declarations.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: FAIL because the resting panel still has a More heading, large stacked opacity control, and a separate timer-settings button.

- [ ] **Step 3: Implement the compact resting layout**

Render the upper-right utility row first, then the single-row opacity control, quiet timer-mode label, and three text tabs. Remove the separate “Timer settings” button. Selecting a tab reveals the existing mode-specific fields beneath it in the same panel.

- [ ] **Step 4: Implement compact CSS**

Use `grid-template-columns: auto minmax(80px, 1fr) auto` for opacity, `grid-template-columns: repeat(3, 1fr)` for timer tabs, a one-pixel `box-shadow: inset 0 -1px var(--widget-ink)` selection rule, and `overflow: auto` only on the detail region.

- [ ] **Step 5: Update mirrored changelog**

Add Chinese and English 2026-07-12 bullets stating that the widget More panel is now a compact attached tool panel with single-row opacity, inline timer modes, and same-panel details.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/widget/WidgetApp.test.tsx && node scripts/changelog-maintain.mjs && node scripts/changelog-maintain.mjs --check && npm test && npm run build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/widget/WidgetApp.tsx src/widget/widget.css src/widget/WidgetApp.test.tsx CHANGELOG.md
git commit -m "feat: compact widget More panel"
```
