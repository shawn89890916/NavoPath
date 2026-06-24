# Checklist

- [ ] `dayStartHour` is derived from `settings.dayStartTime` (0–23, default 0) and used as the rendering origin.
- [ ] Daily hour-grid loop renders wrap-around labels starting at `dayStartHour` (e.g. 1:00…23:00, 0:00).
- [ ] 3-day/weekly ruler and hour-lines loops render the same wrap-around grid.
- [ ] `canvasHeight`/`slotCount` still represent a 24-hour span (no height regression).
- [ ] `getTimelineMetrics`, `pointerToDateTime`, `timeBlockTop`, `timeBlockHeight` receive `dayStartHour` as `startHour` at all call sites.
- [ ] `getDropTargetFromPointer` uses `dayStartHour` as the y-origin so drag-drop maps to the correct time.
- [ ] `NowLine` positions the current-time line correctly under the shifted grid and guards visibility against absolute 0–24 bounds.
- [ ] Scroll-to-day-start effect uses `dayStartHour * 60` as origin and fires on initial mount, not only on change.
- [ ] Auto-scroll-to-current-time effect uses `dayStartHour * 60` as the reference origin.
- [ ] `autoScheduleTasks` receives `settings.dayStartTime` as `dayStart` at both `findCandidatePlacement` and `planMyDay` call sites.
- [ ] Default `dayStartTime` of `"00:00"` produces no visual regression (grid renders 0:00…23:00 as before).
- [ ] `npm run build` passes with no TypeScript or lint errors.
