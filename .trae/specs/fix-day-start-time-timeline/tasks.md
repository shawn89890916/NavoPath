# Tasks

- [ ] Task 1: Introduce effective `dayStartHour` derivation in `src/main.tsx`
  - [ ] SubTask 1.1: Add a helper/memo that parses `settings.dayStartTime` ("HH:MM") into a `dayStartHour` number (0–23), defaulting to 0 when unset/invalid.
  - [ ] SubTask 1.2: Replace usages of the local `TIMELINE_START` constant that drive rendering origin with `dayStartHour` (keep `TIMELINE_START`/`TIMELINE_END` for absolute 0–24 bounds/guards).

- [ ] Task 2: Render wrap-around hour grid & labels
  - [ ] SubTask 2.1: Update `hourLabel(minutes, dayStartHour)` (or the loop) so labels start at `dayStartHour` and wrap past midnight (e.g. 1:00…23:00, 0:00).
  - [ ] SubTask 2.2: Update the daily hour-grid loop (`src/main.tsx:6242-6247`) to iterate from `dayStartHour` over 24 hours with wrap-around.
  - [ ] SubTask 2.3: Update the 3-day/weekly ruler loop (`src/main.tsx:5622-5633`) and hour-lines loop (`src/main.tsx:5794-5798`) with the same wrap-around.
  - [ ] SubTask 2.4: Verify `canvasHeight`/`slotCount` (`src/main.tsx:5532-5533`) and daily canvas height (`src/main.tsx:6157`) remain correct (24h span unchanged).

- [ ] Task 3: Wire `dayStartHour` into geometry helpers
  - [ ] SubTask 3.1: Pass `dayStartHour` as `startHour` to `getTimelineMetrics` / `pointerToDateTime` / `timeBlockTop` / `timeBlockHeight` at all call sites in `src/main.tsx`.
  - [ ] SubTask 3.2: Update `getDropTargetFromPointer` (`src/main.tsx:711-735`) to use `dayStartHour` as the origin.
  - [ ] SubTask 3.3: Update `NowLine` (`src/main.tsx:7406-7416`) to pass `dayStartHour` to `timeBlockTop` and guard visibility against absolute 0–24 bounds.

- [ ] Task 4: Fix scroll-to-day-start effect
  - [ ] SubTask 4.1: Update the scroll effect (`src/main.tsx:2067-2082`) to use `dayStartHour * 60` as the y-origin.
  - [ ] SubTask 4.2: Make the effect fire on initial mount too (not only on change) so reloads honor the setting.
  - [ ] SubTask 4.3: Update the auto-scroll-to-current-time effect (`src/main.tsx:2037-2065`) to use `dayStartHour * 60` as the reference origin.

- [ ] Task 5: Wire `dayStartTime` into the auto-scheduler
  - [ ] SubTask 5.1: Pass `settings: { dayStart: settings.dayStartTime, dayEnd: ... }` to `autoScheduleTasks` at the `findCandidatePlacement` call site (`src/main.tsx:3322-3334`).
  - [ ] SubTask 5.2: Pass the same `settings` at the `planMyDay` call site (`src/main.tsx:4958-4962`).

- [ ] Task 6: Build & verify
  - [ ] SubTask 6.1: Run `npm run build` and resolve any TypeScript/lint errors.
  - [ ] SubTask 6.2: Manually verify (via build success + code review) that day start at 0:00 produces no visual regression and day start at 1:00 shifts the grid.

# Task Dependencies
- Task 2, 3, 4, 5 depend on Task 1 (effective `dayStartHour` derivation).
- Task 6 depends on all prior tasks.
