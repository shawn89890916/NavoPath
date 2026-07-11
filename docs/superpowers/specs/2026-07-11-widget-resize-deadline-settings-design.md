# Desktop widget resize, deadline countdown, and compact settings

## Goal

Make the desktop widget reliably resizable on Windows while keeping its
frameless paper-like appearance. Simplify the More popover so that ordinary
controls stay small and timer configuration is an explicit edit-and-save flow.

## Resize and default geometry

- Keep the widget frameless, transparent, and freely resizable.
- Add eight renderer-owned edge handles: top, right, bottom, left, and four
  corners. They are transparent, use the corresponding Windows resize cursor,
  and are always `no-drag`.
- Pointer dragging a handle reads the native bounds once, applies the matching
  edge deltas through the existing bounds IPC, and clamps through the Electron
  window service. The centre paper area remains the only move region.
- Preserve the existing 128 by 56 minimum for the time-only state.
- Change the first-open and reset geometry from 500 by 88 to 400 by 80. Window
  size remains persisted by the native window service; the renderer no longer
  restores a competing localStorage geometry source.

## Countdown behavior

- Stopwatch remains a normal elapsed task timer.
- Countdown defaults to the active task's associated project deadline.
- A deadline target is the project deadline at the end of its local day unless
  the project stores a more precise deadline time.
- If the current task has no project deadline, the timer settings show the
  actionable empty state: "Please schedule it on the timeline first" /
  "请先安排到时间轴才能计时".
- The empty-state action "Schedule for now" / "安排到现在" opens a short
  duration editor. The user enters the duration; saving creates a timeline
  record starting at the current moment and uses its end time as the countdown
  target. No implicit 30-minute duration is chosen.
- Countdown uses an absolute target timestamp, so it remains accurate through
  sleep, background throttling, and app restart. Existing zero-to-overrun
  behavior remains unchanged.

## More popover

- The resting popover contains only: Background opacity, Always on top,
  Shadow, and a compact "Timer settings" action.
- Always on top and Shadow are independent compact toggle buttons. Each has a
  text label, selected state, keyboard focus, and visible response; neither is
  rendered as a full-width check-row with a trailing large check mark.
- Choosing Timer settings replaces the resting controls with an edit view:
  mode, mode-specific time fields, countdown deadline/scheduling state, Reset
  timer, Cancel, and Save.
- Mode changes and field edits are draft-only. Save validates and commits one
  coherent timer preference/runtime change; Cancel discards the draft.
- Reset timer is scoped to this edit view and restores the current mode's timer
  to its initial paused state. It does not reset widget placement or appearance.
- The neutral X in the popover header closes More. While More is open, the main
  widget's three-dot action becomes the restrained red close-widget action.

## Data and window contracts

- Extend timer preferences/runtime with a normalized optional absolute
  `countdownTargetAt` timestamp. Retain `countdownSeconds` only as the duration
  chosen for user-entered timeline scheduling and fallback migration.
- Calculate the displayed countdown against `countdownTargetAt` when present.
  Existing saved countdown preferences migrate to a paused duration-based
  countdown without silently creating a deadline target.
- Add widget actions for draft-safe timer save/reset and for requesting a
  timeline schedule. The main application remains the sole owner of timeline,
  task, and timer persistence.
- Electron continues to own the native size and position. Its defaults and
  reset bounds change to 400 by 80, with existing multi-display clamping.

## Accessibility and visual rules

- Every resize handle is pointer-only, but all timer/configuration actions are
  keyboard reachable and retain visible focus.
- Compact toggles and action buttons meet the 44px target when space permits.
- Use active theme variables, paper/ink surfaces, fine rules, and restrained
  annotation color. Do not introduce filled capsule mode tabs, hard-coded
  purple/lime, gradients, or colored shadows.

## Tests and acceptance

- Electron service tests cover new 400 by 80 defaults/reset and edge-resize
  bounds clamping.
- Component tests cover each resize cursor/edge direction, draft Save/Cancel,
  compact toggles, Reset timer, and More/close semantics.
- Timer tests cover absolute deadline display, passed deadline overrun, no
  deadline empty state, and migration of duration-only preferences.
- Main orchestration tests cover user-configured "Schedule for now" timeline
  record creation and countdown target wiring.
- Verify Windows edge cursor and all eight directions at 100%, 125%, and 150%
  scaling; verify a task without a deadline requires explicit scheduling.
