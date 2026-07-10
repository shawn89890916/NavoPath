# Desktop Widget Minimal Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a smaller desktop widget with stronger task/time hierarchy, background-only 0–100% opacity, native edge resizing, no project-color footer, and a separate More popover that never resizes the widget.

**Architecture:** Keep `WidgetApp` as the compact task-strip renderer and add a dedicated `WidgetPopoverApp` route. Electron's widget window service owns the transient popover `BrowserWindow`, positions it against the widget bounds, closes it on blur/move/resize, and broadcasts snapshots to both renderers. Existing typed actions remain the only path back to the main React store.

**Tech Stack:** Electron 37 CommonJS main/preload code, React 19 + TypeScript, scoped CSS, Node test runner, Vitest, GitHub Actions/electron-builder.

## Global Constraints

- Default widget bounds are exactly 500 by 88 pixels; Reset position restores `{ x: 80, y: 80, width: 500, height: 88 }`.
- Appearance opacity accepts 0 through 1 and affects only the widget paper/background shell, never text, timer, icons, focus rings, or the More popover.
- More is a separate frameless Electron window and must never change widget bounds.
- The More popover contains only Always on top, Background opacity, Reset position, and Close widget.
- The project-color bottom rule is removed; shared controls use widget appearance/theme variables and no hard-coded purple or lime.
- The main widget remains frameless, transparent, resizable, and `thickFrame: true`; a 6-pixel outer client perimeter remains `no-drag` for native edge/corner resizing.
- All user-visible Chinese and English changelog entries must be semantically mirrored.
- Release version is 1.2.36 and tag is `v1.2.36`; required assets are `latest.yml`, `NavoPath-Setup.exe`, `NavoPath-Setup.exe.blockmap`, and `NavoPath-Portable.exe`.

---

### Task 1: Appearance and geometry contracts

**Files:**
- Modify: `src/widget/widgetPreferences.test.ts`
- Modify: `src/widget/widgetPreferences.ts`
- Modify: `electron/widget-window.test.cjs`
- Modify: `electron/widget-window.cjs`

**Interfaces:**
- Produces: `WIDGET_DEFAULT_BOUNDS = { width: 500, height: 88 }` in renderer preferences.
- Produces: `DEFAULT_WIDGET_WIDTH = 500`, `DEFAULT_WIDGET_HEIGHT = 88`, and exported `positionPopover(widgetBounds, popoverSize, workArea)` in the Electron service.
- Removes: `WIDGET_MENU_MIN_HEIGHT`, `getWidgetMaxHeight`, and `getExpandedWidgetBounds` because the widget no longer expands for More.

- [ ] **Step 1: Write failing normalization and layout tests**

Update `src/widget/widgetPreferences.test.ts` so it asserts:

```ts
expect(normalizeWidgetAppearance({ opacity: -2 })).toEqual({
  ...DEFAULT_WIDGET_APPEARANCE,
  opacity: 0,
});
expect(normalizeWidgetAppearance({ opacity: 0 })).toEqual({
  ...DEFAULT_WIDGET_APPEARANCE,
  opacity: 0,
});
expect(clampWidgetBounds({ x: NaN, y: NaN, width: NaN, height: NaN }, workArea)).toEqual({
  x: 0, y: 0, width: 500, height: 88,
});
expect(getWidgetLayout(480, 100)).toBe("strip");
expect(getWidgetLayout(480, 132)).toBe("stacked");
```

Delete the old menu auto-expansion test and imports.

- [ ] **Step 2: Run the preference test and verify RED**

Run: `npx vitest run src/widget/widgetPreferences.test.ts`

Expected: FAIL because opacity still clamps to 0.35, invalid bounds still fall back to 620 by 100, and a short narrow widget still stacks.

- [ ] **Step 3: Implement the minimal preference changes**

In `widgetPreferences.ts`, add:

```ts
export const WIDGET_DEFAULT_BOUNDS = { width: 500, height: 88 } as const;
```

Clamp opacity with `Math.min(1, Math.max(0, parsed))`; use the default bounds for invalid geometry; remove menu-height helpers; and implement:

```ts
export function getWidgetLayout(_width: number, height: number): "strip" | "stacked" {
  return height >= 132 ? "stacked" : "strip";
}
```

- [ ] **Step 4: Run the preference test and verify GREEN**

Run: `npx vitest run src/widget/widgetPreferences.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing Electron geometry tests**

Update `electron/widget-window.test.cjs` to expect the main window defaults to 500 by 88 and add deterministic placement cases:

```js
assert.deepEqual(
  positionPopover(
    { x: 80, y: 80, width: 500, height: 88 },
    { width: 280, height: 252 },
    { x: 0, y: 0, width: 1280, height: 720 },
  ),
  { x: 300, y: 174 },
);
assert.deepEqual(
  positionPopover(
    { x: 900, y: 620, width: 360, height: 88 },
    { width: 280, height: 252 },
    { x: 0, y: 0, width: 1280, height: 720 },
  ),
  { x: 980, y: 362 },
);
```

- [ ] **Step 6: Run the Electron test and verify RED**

Run: `node --test electron/widget-window.test.cjs`

Expected: FAIL because defaults are 620 by 100 and `positionPopover` is not exported.

- [ ] **Step 7: Implement Electron geometry constants and placement**

In `electron/widget-window.cjs`, use default width 500 and height 88 throughout fallback geometry and `BrowserWindow` options. Add:

```js
const POPOVER_GAP = 6;

function positionPopover(widgetBounds, popoverSize, workArea) {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - popoverSize.width;
  const x = Math.min(maxX, Math.max(minX, widgetBounds.x + widgetBounds.width - popoverSize.width));
  const below = widgetBounds.y + widgetBounds.height + POPOVER_GAP;
  const y = below + popoverSize.height <= workArea.y + workArea.height
    ? below
    : Math.max(workArea.y, widgetBounds.y - popoverSize.height - POPOVER_GAP);
  return { x: Math.round(x), y: Math.round(y) };
}
```

Export it with the service.

- [ ] **Step 8: Run both geometry suites and commit**

Run: `npx vitest run src/widget/widgetPreferences.test.ts && node --test electron/widget-window.test.cjs`

Expected: PASS.

Commit: `test: define compact widget geometry contracts`

---

### Task 2: Compact React surface and background-only opacity

**Files:**
- Modify: `src/widget/WidgetApp.test.tsx`
- Modify: `src/widget/WidgetApp.tsx`
- Modify: `src/widget/widget.css`

**Interfaces:**
- Produces: `WidgetView` with no embedded panel state or accent footer.
- Produces: `WidgetPopoverView` and `WidgetPopoverApp` for the separate renderer route.
- Consumes: `window.desktopApi.widget.togglePopover()` and `closePopover()` added in Task 3.

- [ ] **Step 1: Write failing React markup and CSS tests**

Replace the embedded-panel test with separate main and popover assertions:

```tsx
const mainHtml = renderToStaticMarkup(<WidgetView {...mainProps} />);
expect(mainHtml).toContain("Working");
expect(mainHtml).toContain('aria-haspopup="dialog"');
expect(mainHtml).not.toContain("Always on top");
expect(mainHtml).not.toContain("df-widget-accent-line");

const popoverHtml = renderToStaticMarkup(<WidgetPopoverView {...popoverProps} />);
expect(popoverHtml).toContain("Always on top");
expect(popoverHtml).toContain("Background opacity");
expect(popoverHtml).toContain('min="0"');
expect(popoverHtml).toContain('max="1"');
```

Add CSS assertions for a `6px` no-drag root perimeter, a `::before` paper shell whose opacity is `var(--widget-opacity)`, muted status text, larger title/timer text, and absence of `.df-widget-accent-line`.

- [ ] **Step 2: Run the React test and verify RED**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: FAIL because the panel is embedded, opacity starts at 0.35, and the accent footer exists.

- [ ] **Step 3: Split main and popover renderers**

Change `WidgetView` to accept only snapshot, elapsed time, layout, timer toggle, and More toggle. The More button uses `aria-haspopup="dialog"` and calls the Electron toggle API.

Create `WidgetPopoverView` with exactly four controls:

```tsx
<button onClick={onToggleAlwaysOnTop}>...</button>
<label className="df-widget-opacity-row">
  <span>{zh ? "背景透明度" : "Background opacity"}</span>
  <output>{Math.round(appearance.opacity * 100)}%</output>
  <input type="range" min="0" max="1" step="0.01" value={appearance.opacity} onChange={...} />
</label>
<button onClick={onResetPosition}>...</button>
<button className="is-danger" onClick={onCloseWidget}>...</button>
```

Create `WidgetPopoverApp` that subscribes to snapshots, requests one on mount, closes on Escape, sends typed actions, and calls `closePopover()` after reset or widget close. Remove all menu expansion state, geometry calls, overlay, and outside-click logic from `WidgetApp`.

- [ ] **Step 4: Implement the compact visual hierarchy**

In `widget.css`:

- keep `.df-widget-root` at `padding: 6px` and set it to `-webkit-app-region: no-drag`;
- keep `.df-widget-card` draggable but move paper background/border/shadow into `.df-widget-card::before` with `opacity: var(--widget-opacity)`;
- place card children above the pseudo-element;
- style status as muted 11–12px supporting copy;
- style task title and timer at 18–22px responsive sizes;
- remove all accent-footer rules;
- scope popover root/surface separately with an opaque, readable paper background and 12px radius;
- keep buttons, slider, and popover `no-drag`, 44px targets, focus-visible, active, touch, and reduced-motion states.

- [ ] **Step 5: Run the React suite and commit**

Run: `npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetPreferences.test.ts`

Expected: PASS.

Commit: `feat: simplify desktop widget surface`

---

### Task 3: Separate Electron More popover

**Files:**
- Modify: `electron/widget-window.test.cjs`
- Modify: `electron/widget-window.cjs`
- Modify: `electron/preload.cjs`
- Modify: `electron/main.cjs`
- Modify: `src/types.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces IPC handlers: `widget:toggle-popover` and `widget:close-popover`.
- Produces service methods: `togglePopover()`, `closePopover()`, `broadcastSnapshot(snapshot)`, and `ownsWindow(window)`.
- Produces preload methods: `togglePopover(): Promise<boolean>` and `closePopover(): Promise<boolean>`.
- Consumes route query `widgetPopover=1` to render `WidgetPopoverApp`.

- [ ] **Step 1: Write failing popover lifecycle tests**

Extend the fake window with `setPosition`, `getSize`, `setAlwaysOnTop`, and event emission. Assert:

```js
await handlers.get("widget:toggle-popover")();
assert.equal(windows.length, 2);
assert.equal(windows[1].options.width, 280);
assert.equal(windows[1].options.height, 252);
assert.equal(windows[1].options.resizable, false);
assert.deepEqual(windows[0].getBounds(), { x: 80, y: 80, width: 500, height: 88 });
assert.deepEqual(windows[1].loaded.options.query, { widgetPopover: "1" });
```

Also assert toggle closes an existing popover, blur closes it, widget move/resize closes it, closing the widget cleans it up, and `broadcastSnapshot` sends to both live renderer windows.

- [ ] **Step 2: Run Electron tests and verify RED**

Run: `node --test electron/widget-window.test.cjs`

Expected: FAIL because popover handlers and service methods do not exist.

- [ ] **Step 3: Implement popover ownership in the Electron service**

Add `popoverWindow` state. Create a frameless 280 by 252 window with `transparent: true`, `resizable: false`, `skipTaskbar: true`, the same preload, and the widget as parent. Load `index.html` with `{ query: { widgetPopover: "1" } }` or the development URL with `?widgetPopover=1`. Position it with `positionPopover`, focus it after showing, and close it on blur. Close it when the widget emits `move`, `resize`, or `closed`.

Register the two IPC handlers and expose:

```js
function broadcastSnapshot(snapshot) {
  for (const win of [widgetWindow, popoverWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send("widget:snapshot", snapshot);
  }
}

function ownsWindow(win) {
  return win === widgetWindow || win === popoverWindow;
}
```

- [ ] **Step 4: Wire preload, types, routing, relays, and reset size**

Add `togglePopover` and `closePopover` to preload and `Window.desktopApi` types. Import `WidgetPopoverApp` in `main.tsx` and render it when `widgetPopover=1`, before the normal app route.

Change the reset action to:

```ts
void window.desktopApi?.widget?.setBounds({ x: 80, y: 80, width: 500, height: 88 });
```

In `electron/main.cjs`, exclude `widgetWindowService.ownsWindow(w)` when locating the main application window and replace the single-window snapshot send with `widgetWindowService.broadcastSnapshot(snapshot)`.

- [ ] **Step 5: Run Electron and React tests, then build**

Run: `node --test electron/widget-window.test.cjs`

Run: `npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetPreferences.test.ts`

Run: `npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Commit: `feat: open widget controls in a separate popover`

---

### Task 4: Changelog and version 1.2.36

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces package version `1.2.36` for updater metadata.
- Produces mirrored 2026-07-10 Chinese and English changelog bullets.

- [ ] **Step 1: Update the changelog**

Refine the existing 2026-07-10 widget entry in both languages to state that the default strip is smaller, status is muted, title/time are larger, More opens as a separate dismissible popover without resizing the widget, opacity controls only the background from 0% to 100%, native edge resizing works, and the project-color footer is removed.

- [ ] **Step 2: Normalize and check the changelog**

Run: `node scripts/changelog-maintain.mjs`

Run: `node scripts/changelog-maintain.mjs --check`

Expected: both commands exit 0.

- [ ] **Step 3: Bump both package files**

Use `apply_patch` to replace version `1.2.35` with `1.2.36` in the root package record of `package.json` and both root package version fields in `package-lock.json`. Do not change dependency versions.

- [ ] **Step 4: Verify version consistency and commit**

Run:

```powershell
node -e "const p=require('./package.json'); const l=require('./package-lock.json'); if(p.version!=='1.2.36'||l.version!=='1.2.36'||l.packages[''].version!=='1.2.36') process.exit(1)"
```

Expected: exit 0.

Commit: `release: prepare desktop widget update 1.2.36`

---

### Task 5: Full verification, merge, release, and latest.yml validation

**Files:**
- No additional product files unless verification finds a defect.

**Interfaces:**
- Consumes release workflow `.github/workflows/desktop-release.yml`.
- Produces GitHub release `v1.2.36` and updater assets.

- [ ] **Step 1: Run complete local verification**

Run: `npm test`

Run: `npm run build`

Run: `node scripts/changelog-maintain.mjs --check`

Run: `git diff --check main...HEAD`

Expected: all commands exit 0 with zero failing tests.

- [ ] **Step 2: Review the complete branch diff**

Inspect `git status --short`, `git log --oneline main..HEAD`, and `git diff --stat main...HEAD`. Confirm only the widget implementation, tests, docs, changelog, and version files are included.

- [ ] **Step 3: Merge to main and push**

Fast-forward or merge the isolated feature branch into local `main`, rerun `npm test` and `npm run build` on the merged result, then `git push origin main`.

Expected: push succeeds without force.

- [ ] **Step 4: Create and push the release tag**

Create annotated tag `v1.2.36` at the verified main commit and push it:

```powershell
git tag -a v1.2.36 -m "NavoPath 1.2.36"
git push origin v1.2.36
```

Expected: the tag-triggered Desktop Release workflow starts.

- [ ] **Step 5: Monitor release workflow to completion**

Use `gh run list --workflow desktop-release.yml --limit 5` to locate the tag run, then `gh run watch <run-id> --exit-status`.

Expected: workflow concludes `success`.

- [ ] **Step 6: Verify release assets and latest.yml**

Run: `node scripts/verify-release.mjs v1.2.36`

Expected: release is published, is not a prerelease, all four required assets are uploaded under the real tag, `latest.yml` reports `version: 1.2.36`, and its sha512 and size fields are present.
