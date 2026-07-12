# Widget Compact Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop widget a compact, theme-aware timer control with stable resizing, an accessible More panel, and no shadow configuration.

**Architecture:** The widget renderer owns responsive layout and icon controls; the existing widget action bridge remains the single route to the main-window timer and Electron APIs. The preferences model is simplified to remove shadow state, while the native Electron window continues to own geometry and always-on-top state.

**Tech Stack:** React 19, TypeScript, Electron IPC, Vitest, Lucide React.

## Global Constraints

- Match `NavoPathStyle.md`: active theme variables, line icons, no purple, no glow, no colored shadows, and 150-180ms non-scaling interactions.
- Use Lucide React `Play`, `Pause`, `MoreHorizontal`, `Pin`, `PinOff`, and `X`; do not draw substitute SVG icons or use emoji.
- Main row right side contains only Play/Pause and More; Pin/PinOff and X live in More.
- Full layout keeps the task title at widths >= 280px; compact layout is timer plus More at 200-279px; timer-only layout is below 200px.
- Remove `shadowEnabled` and `setWidgetShadow` from persisted preferences, actions, controls, and rendering. Legacy persisted shadow data must be ignored.
- Every user-visible behavior change updates the mirrored Chinese and English `CHANGELOG.md` entry for 2026-07-12.

---

### Task 1: Simplify widget appearance persistence and density policy

**Files:**
- Modify: `src/types.ts:326-334,608-628`
- Modify: `src/widget/widgetPreferences.ts:1-88,135-139`
- Modify: `src/widget/widgetPreferences.test.ts:1-122`

**Interfaces:**
- Produces: `WidgetAppearance` without `shadowEnabled`; `getWidgetDensity(width)` returning `"full" | "timerControls" | "timerOnly"` using 280px and 200px thresholds.
- Consumes: Existing persisted `WidgetAppearance` values, which may still include an ignored `shadowEnabled` key.

- [ ] **Step 1: Write the failing preferences tests**

```ts
it("drops legacy shadow state and uses the narrower task-title threshold", () => {
  expect(normalizeWidgetAppearance({ shadowEnabled: true } as never)).toEqual({
    ...DEFAULT_WIDGET_APPEARANCE,
    version: WIDGET_APPEARANCE_VERSION,
  });
  expect(getWidgetDensity(280)).toBe("full");
  expect(getWidgetDensity(279)).toBe("timerControls");
  expect(getWidgetDensity(200)).toBe("timerControls");
  expect(getWidgetDensity(199)).toBe("timerOnly");
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run src/widget/widgetPreferences.test.ts`

Expected: FAIL because `shadowEnabled` remains in the normalized appearance and `279` remains `"timerControls"` only under the old 360px boundary.

- [ ] **Step 3: Remove shadow state and adjust density thresholds**

```ts
export interface WidgetAppearance {
  light: WidgetThemeColors;
  dark: WidgetThemeColors;
  opacity: number;
  fontFamily: string;
  fontScale: number;
  version: number;
}

export function getWidgetDensity(width: number): WidgetDensity {
  if (width >= 280) return "full";
  if (width >= 200) return "timerControls";
  return "timerOnly";
}
```

Delete `shadowEnabled` from `DEFAULT_WIDGET_APPEARANCE`, `normalizeWidgetAppearance`, and the `setWidgetShadow` member of `WidgetAction`.

- [ ] **Step 4: Run the preferences tests**

Run: `npx vitest run src/widget/widgetPreferences.test.ts`

Expected: PASS with all widget preference and geometry assertions green.

- [ ] **Step 5: Commit the persistence task**

```bash
git add src/types.ts src/widget/widgetPreferences.ts src/widget/widgetPreferences.test.ts
git commit -m "refactor: remove widget shadow preference"
```

### Task 2: Replace the widget primary and More controls

**Files:**
- Modify: `package.json:dependencies`
- Modify: `src/widget/WidgetApp.tsx:1-110,143-184,229-327`
- Modify: `src/widget/widget.css:1-110`
- Modify: `src/widget/WidgetApp.test.tsx:1-184`
- Modify: `src/main.tsx:4140-4160,12945-12965`

**Interfaces:**
- Consumes: `WidgetAction` actions `toggleWidgetTimer` and `setAlwaysOnTop`; Electron `desktopApi.widget.close()`.
- Produces: `WidgetView` with main-row Play/Pause and More actions, and `WidgetPopoverView` with Pin/PinOff and X actions.

- [ ] **Step 1: Add failing rendering and state tests**

```tsx
it("renders Play/Pause and More on the main row, while compact mode keeps only More", () => {
  const full = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="full" {...viewCallbacks} />);
  const compact = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="timerControls" {...viewCallbacks} />);
  expect(full).toContain('aria-label="Pause timer"');
  expect(full).toContain('aria-label="More"');
  expect(compact).not.toContain('aria-label="Pause timer"');
  expect(compact).toContain('aria-label="More"');
});

it("puts Pin/PinOff and close-widget actions in More without a shadow control", () => {
  const pinned = render(snapshot);
  const unpinned = render({ ...snapshot, alwaysOnTop: false });
  expect(pinned).toContain('aria-label="Unpin widget"');
  expect(unpinned).toContain('aria-label="Pin widget"');
  expect(pinned).toContain('aria-label="Close widget"');
  expect(pinned).not.toContain("Shadow");
});
```

- [ ] **Step 2: Run the failing component tests**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: FAIL because the main row lacks the icon controls and More still contains the text Shadow button.

- [ ] **Step 3: Add Lucide React and implement the controls**

Add `lucide-react` to `dependencies` in `package.json` and refresh the lockfile with `npm install --package-lock-only`.

```tsx
import { MoreHorizontal, Pause, Pin, PinOff, Play, X } from "lucide-react";

<button className="df-widget-icon-btn" aria-label={snapshot.timerRunning ? "Pause timer" : "Start timer"} onClick={onToggleTimer}>
  {snapshot.timerRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
</button>
<button className="df-widget-icon-btn" aria-label={zh ? "更多" : "More"} onClick={onTogglePopover}>
  <MoreHorizontal aria-hidden="true" />
</button>
```

In `WidgetPopoverView`, replace the toggle grid with Pin/PinOff and X icon buttons. Add an `onCloseWidget` callback that calls `getWidgetApi()?.close()` from `WidgetPopoverApp`. Remove the `onToggleShadow` prop, its action dispatch, the `setWidgetShadow` case in `handleWidgetAction`, and the Settings row labelled “Show shadow”. Set `--widget-shadow` to `none` and remove all shadow styles.

- [ ] **Step 4: Apply layout and interaction CSS**

```css
.df-widget-root[data-density="full"] .df-widget-task-title { flex: 1 1 auto; }
.df-widget-root[data-density="timerControls"] .df-widget-task-title,
.df-widget-root[data-density="timerControls"] .df-widget-timer-toggle { display: none; }
.df-widget-icon-btn { color: var(--widget-muted); }
.df-widget-icon-btn:hover { border-color: var(--widget-border); background: var(--widget-wash); color: var(--widget-ink); }
```

Ensure all icons are 18px line icons, controls retain a 44px target, and `:active` only applies `translateY(1px)`.

- [ ] **Step 5: Run the component tests**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: PASS with primary controls, More actions, and no-shadow assertions green.

- [ ] **Step 6: Commit the controls task**

```bash
git add package.json package-lock.json src/main.tsx src/widget/WidgetApp.tsx src/widget/widget.css src/widget/WidgetApp.test.tsx
git commit -m "feat: streamline widget controls"
```

### Task 3: Preserve fixed opposite edges during resize

**Files:**
- Modify: `src/widget/WidgetApp.tsx:38-60`
- Modify: `src/widget/WidgetApp.test.tsx:25-45`

**Interfaces:**
- Consumes: `resizeWidgetBounds(initial, direction, delta, workArea)`.
- Produces: Bounds whose un-dragged opposite edge remains unchanged after a left/right/top/bottom or corner resize.

- [ ] **Step 1: Write the failing anchored-resize tests**

```ts
it("keeps the opposite edges fixed for every resize direction", () => {
  const initial = { x: 100, y: 100, width: 400, height: 80 };
  const left = resizeWidgetBounds(initial, "w", { x: 40, y: 0 }, workArea);
  const right = resizeWidgetBounds(initial, "e", { x: 40, y: 0 }, workArea);
  const top = resizeWidgetBounds(initial, "n", { x: 0, y: 20 }, workArea);
  expect(left.x + left.width).toBe(initial.x + initial.width);
  expect(right.x).toBe(initial.x);
  expect(top.y + top.height).toBe(initial.y + initial.height);
});
```

- [ ] **Step 2: Run the failing resize test**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: FAIL when clamping the dragged edge changes the opposite edge.

- [ ] **Step 3: Recompute bounds from explicit fixed edges**

```ts
const fixedRight = initial.x + initial.width;
const fixedBottom = initial.y + initial.height;
if (direction.includes("w")) {
  left = clamp(initial.x + delta.x, Math.max(workArea.x, fixedRight - maxWidth), fixedRight - WIDGET_MIN_WIDTH);
  nextRight = fixedRight;
}
if (direction.includes("n")) {
  top = clamp(initial.y + delta.y, Math.max(workArea.y, fixedBottom - maxHeight), fixedBottom - WIDGET_MIN_HEIGHT);
  nextBottom = fixedBottom;
}
```

Apply the same fixed-edge calculation to east and south resizing, then compute width and height only after both dragged and fixed edges are final.

- [ ] **Step 4: Run the widget component tests**

Run: `npx vitest run src/widget/WidgetApp.test.tsx`

Expected: PASS, including fixed-opposite-edge assertions and existing resize-handle coverage.

- [ ] **Step 5: Commit the resize task**

```bash
git add src/widget/WidgetApp.tsx src/widget/WidgetApp.test.tsx
git commit -m "fix: anchor widget resize edges"
```

### Task 4: Record the user-visible update and verify the complete app

**Files:**
- Modify: `CHANGELOG.md:1-15`

**Interfaces:**
- Consumes: Completed widget controls, preference cleanup, and resize behavior.
- Produces: Mirrored Chinese and English changelog entries for 2026-07-12.

- [ ] **Step 1: Add the mirrored changelog entry**

```md
### 改进
- 小组件现将播放/暂停和更多直接放在主界面；更多面板提供置顶和关闭图标，并移除阴影选项。任务标题会在更窄宽度后才隐藏，缩放时固定对边。

### Improved
- The widget now puts Play/Pause and More on its primary surface; More provides icon controls for pinning and closing, with the shadow option removed. Task titles stay visible to narrower widths, and resizing keeps the opposite edge fixed.
```

- [ ] **Step 2: Maintain the changelog**

Run: `node scripts/changelog-maintain.mjs && node scripts/changelog-maintain.mjs --check`

Expected: exit code 0.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: exit code 0 with all Node and Vitest tests passing.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code 0 after TypeScript and Vite production build complete.

- [ ] **Step 5: Perform visual desktop verification**

Run: `npm run dev`

Check: Open the desktop widget in light and dark themes; verify full width shows task/title/timer/Play-or-Pause/More, 200-279px shows timer and More, below 200px shows timer only, More toggles Pin/PinOff and closes the widget, and left/right edge drags keep their opposite edge stationary.

- [ ] **Step 6: Commit and publish**

```bash
git add CHANGELOG.md
git commit -m "docs: record widget control improvements"
git push
```
