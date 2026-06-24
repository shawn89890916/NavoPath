# Day Start Time Timeline Fix Spec

## Why
The "Day start time" (一天开始时间) setting currently has no real effect on the timeline grid. It only scrolls the viewport to the chosen hour within a fixed 0:00–24:00 grid, and even that scroll only fires when the value *changes* (not on reload). Users expect that setting the day start time to 1:00 makes the timeline actually begin at 1:00 — i.e. the hour grid, labels, canvas, now-line, pointer-to-time mapping, and auto-scheduler should all treat that hour as the start of the day. The `timelineGeometry.ts` module was already architected to accept a dynamic `startHour`, but no caller ever wires `settings.dayStartTime` into it.

## What Changes
- Derive the timeline's effective start hour from `settings.dayStartTime` instead of the hardcoded `TIMELINE_START = 0`.
- Render the hour grid with wrap-around labels so a day starting at 1:00 shows `1:00, 2:00, … 23:00, 0:00` (the day still spans 24 hours; only the origin shifts).
- Pass the effective start hour into all geometry helpers (`getTimelineMetrics`, `pointerToDateTime`, `timeBlockTop`, `timeBlockHeight`, `getDropTargetFromPointer`) and the `NowLine` so block positions, drag-drop, and the current-time line stay correct under the shifted grid.
- Replace the scroll-only effect with a scroll that uses the effective start hour as the y-origin, and also fire on initial mount (not only on change) so reloads honor the setting.
- Wire `settings.dayStartTime` into the auto-scheduler (`autoScheduleTasks` calls) as the `dayStart` field so "Plan my day" / candidate placement respects the user's day window.
- Keep `TIMELINE_START`/`TIMELINE_END` as the absolute 0–24 bounds used for validation/guards; introduce an effective `dayStartHour` (0–23) derived from `dayStartTime` that drives rendering origin.

## Impact
- Affected specs: Timeline rendering, drag-and-drop scheduling, auto-scheduler, current-time indicator.
- Affected code:
  - `src/main.tsx` — local `TIMELINE_START`/`TIMELINE_END` shadow constants, `hourLabel`, `TIME_OPTIONS`, daily & 3-day/weekly hour-grid loops, `canvasHeight`/`slotCount`, daily canvas height, scroll-to-day-start effect, auto-scroll-to-current-time effect, `NowLine`, `getDropTargetFromPointer`, `autoScheduleTasks` call sites.
  - `src/timelineGeometry.ts` — `getTimelineMetrics`, `pointerToDateTime`, `timeBlockTop`, `timeBlockHeight` (already accept `startHour`; callers need updating).
  - `src/autoSchedule.ts` — `AutoScheduleSettings.dayStart` field (already exists); call sites need to pass `settings.dayStartTime`.

## ADDED Requirements

### Requirement: Day-start-aware timeline grid
The system SHALL render the timeline hour grid starting from the user's configured `dayStartTime` (interpreted as an hour 0–23), wrapping past midnight so the full 24-hour day remains visible. The first hour label on the grid SHALL equal `dayStartTime`'s hour.

#### Scenario: Day start at 1:00
- **WHEN** `settings.dayStartTime` is `"01:00"`
- **THEN** the timeline grid's first visible hour label is `1:00` and the sequence continues `2:00, 3:00, … 23:00, 0:00`

#### Scenario: Day start at 0:00 (default)
- **WHEN** `settings.dayStartTime` is `"00:00"` or unset
- **THEN** the grid renders unchanged (`0:00, 1:00, … 23:00`) — no visual regression

### Requirement: Geometry helpers honor effective start hour
The system SHALL pass the effective `dayStartHour` (derived from `dayStartTime`) into `getTimelineMetrics`, `pointerToDateTime`, `timeBlockTop`, `timeBlockHeight`, and `getDropTargetFromPointer` so that time-block vertical positions, drag-drop hit-testing, and the now-line remain correct under the shifted grid.

#### Scenario: Drag a block to 2:00 with day start 1:00
- **WHEN** the user drags a time block to the slot whose label reads `2:00` while `dayStartTime` is `"01:00"`
- **THEN** the block's saved start time is `02:00` (not `01:00` or an off-by-one value)

### Requirement: Auto-scheduler respects day start time
The system SHALL pass `settings.dayStartTime` as the `dayStart` field to `autoScheduleTasks` at both call sites (`findCandidatePlacement` and `planMyDay`), so auto-scheduled blocks begin no earlier than the user's configured day start.

#### Scenario: Plan my day with day start 1:00
- **WHEN** the user triggers "Plan my day" and `dayStartTime` is `"01:00"`
- **THEN** no proposed block is scheduled before `01:00`

## MODIFIED Requirements

### Requirement: Scroll to day start time
**Before**: A `useEffect` scrolls the timeline to `dayStartTime` only when the value changes (guarded by a ref), using `TIMELINE_START * 60` as the y-origin.
**After**: The scroll effect uses the effective `dayStartHour * 60` as the y-origin AND fires on initial mount (when `prevDayStartRef.current` is empty) in addition to on change, so reloads also position the timeline at the day start.

### Requirement: Now-line position
**Before**: `NowLine` calls `timeBlockTop` with the default `startHour = 0` and guards visibility with the fixed `TIMELINE_START`/`TIMELINE_END` range.
**After**: `NowLine` passes the effective `dayStartHour` to `timeBlockTop` and guards visibility against the absolute 0–24 bounds (so the current time is always positioned correctly regardless of grid origin).

### Requirement: Auto-scroll to current time
**Before**: The auto-scroll-to-current-time effect uses `TIMELINE_START * 60` as the reference and a hardcoded `9 * 60` fallback.
**After**: It uses the effective `dayStartHour * 60` as the reference origin; the current time is still positioned correctly under the shifted grid.
