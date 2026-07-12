# Task 3 Report: Preserve opposite resize edges

## Causal path and root cause

The renderer already calculated resize geometry from the opposite edge:

1. `WidgetResizeHandles` passes the dragged direction and pointer delta to `WidgetApp.resize`.
2. `resizeWidgetBounds` derives `right` and `bottom` from the native bounds, then adjusts only the dragged side. For west/north drags this already preserves the right/bottom coordinates.
3. The preload forwards `widget:set-bounds` unchanged to Electron.
4. Electron merged the requested rectangle and called `clampBounds`.
5. `clampBounds` first clamped `width` and `height`, but retained the requested `x` and `y`. If native maximum-size clamping reduced a west/north resize, the fixed right/bottom edge moved inward by the amount removed.

The defect was therefore at the Electron IPC/native clamping boundary, not in renderer-side geometry. The renderer had no way to state which opposite edges had to remain fixed, and the native clamping code had no anchor information.

## Fix

- Added a typed `fixedEdges` IPC field to the widget bounds update contract.
- The renderer maps each resize direction to its opposite fixed edge and includes that metadata with the calculated bounds.
- Native `clampBounds` now derives `x` from the requested right edge and `y` from the requested bottom edge when those edges are fixed, before applying work-area containment. Existing left/top anchoring remains the default.
- Work-area containment still wins when preserving the requested edge is geometrically impossible.

## TDD evidence

### RED

1. Added the Electron IPC regression test for a `{ x: 100, y: 100, width: 1000, height: 600 }` request anchored at the right and bottom.
2. Ran `node --test electron/widget-window.test.cjs`.
3. The new test failed as expected: actual bounds were `{ x: 100, y: 100, width: 860, height: 504 }`, while preserving the requested right/bottom edges requires `{ x: 240, y: 196, width: 860, height: 504 }`.
4. Added the renderer direction-to-fixed-edge unit test and ran `npx vitest run src/widget/WidgetApp.test.tsx`; it failed as expected because `getWidgetResizeFixedEdges` did not exist.

### GREEN

- Implemented the explicit fixed-edge contract and native anchored clamp.
- `node --test electron/widget-window.test.cjs`: 16 passed.
- `npx vitest run src/widget/WidgetApp.test.tsx`: 23 passed.

## Files changed

- `src/widget/WidgetApp.tsx`
- `src/widget/WidgetApp.test.tsx`
- `src/types.ts`
- `electron/widget-window.cjs`
- `electron/widget-window.test.cjs`

## Full verification

- `npm test`: passed (19 Node tests and 133 Vitest tests).
- `npm run build`: passed (`tsc` and Vite production build).
- `git diff --check`: passed.

The build emitted the repository's existing large-chunk advisory; it did not fail the build and is unrelated to this resize fix.

## Self-review

- Confirmed the renderer computation was not redundantly rewritten; it remains the source of requested geometry.
- Confirmed preload needs no change because it already forwards the IPC payload verbatim.
- Confirmed reset and move paths omit `fixedEdges`, retaining their existing left/top position clamping behavior.
- Confirmed both horizontal and vertical anchor behavior are covered in the native regression test, and representative corner and single-axis direction mappings are covered at the renderer boundary.
