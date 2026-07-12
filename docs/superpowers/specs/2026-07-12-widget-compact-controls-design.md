# Desktop Widget Compact Controls Design

**Date:** 2026-07-12

## Goal

Refine the desktop widget into a quieter, more direct timer surface. The
widget must preserve task context until the available width is genuinely too
narrow, put timer control in the primary surface, and keep secondary window
actions in the More panel.

## Primary widget layout

- The main row contains the active task title, the timer display, a Play or
  Pause icon button, and a More icon button.
- The right side contains only Play/Pause and More. Close and always-on-top
  controls are not present in the main row.
- Play starts the timer; while it is running the same button becomes Pause and
  pauses it. The existing timer action flow remains the source of truth.
- The control icons use Lucide's consistent line-icon vocabulary: Play,
  Pause, Pin, PinOff, and X. They inherit the active widget ink colour and do
  not use purple.

## More panel

- More retains background opacity and timer settings.
- More presents two compact icon controls: Pin/PinOff toggles always-on-top;
  X closes the widget through the Electron close IPC.
- The shadow setting is removed from the Settings page, More panel, widget
  appearance model, and rendering. The widget and its popover have no drop
  shadow.

## Responsive behaviour

- Full density shows task title, timer, Play/Pause, and More.
- The task title remains visible until a narrower threshold than the current
  360px full-density breakpoint. Below that threshold the widget presents the
  timer and More, without the title.
- At the narrowest supported size, controls remain reachable and do not
  overlap the resize handles.

## Resize behaviour

- Resizing is edge-anchored. Dragging the left edge or either left corner
  keeps the right edge fixed; dragging the right edge keeps the left edge
  fixed. Top and bottom edges follow the same rule vertically.
- Clamp logic keeps the fixed opposite edge stable at both minimum and maximum
  dimensions and within the active display work area.

## Verification

- Regression tests cover density thresholds, primary control presence,
  Play/Pause state, More-panel Pin/PinOff and close actions, no shadow setting,
  and opposite-edge-stable resizing.
- Full project tests and production build must pass.
- Visual verification covers light and dark themes, wide, compact, and
  timer-only widths, plus left- and right-edge resizing.
