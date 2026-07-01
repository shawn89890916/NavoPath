# NavoPath Productivity Upgrade Design

Date: 2026-07-01
Branch: dev

## Summary

Build the requested productivity upgrade as one large version using a "productivity core layer plus UI integration" architecture. The release adds habits, a true always-on-top desktop widget, global search, time share metrics, continuous cross-day scrolling, better templates, constrained project completion, fixed keyboard shortcuts, and nullable priority/importance/urgency states.

The implementation must preserve NavoPath's visual source of truth in `NavoPathStyle.md`: quiet paper surfaces, precise rules, restrained annotation color, theme variables, and no generic SaaS styling.

## Confirmed Product Decisions

- Release scope: one large version, not staged as separate feature releases.
- Desktop widget: true Electron `BrowserWindow` with `alwaysOnTop`, opened from the main app more menu.
- Habits: first-class built-in feature, not only plugin config.
- Habit placement: one habit card under Today's Candidates; each habit behaves like a draggable subtask.
- Habit scheduling: each habit item can be dragged independently. After scheduling, the habit remains in the card and shows scheduled state.
- Search: global command palette opened by shortcut; covers tasks, projects, events, notes, habits, and settings.
- Search jump: scheduled task or habit results jump to the corresponding timeline date and block.
- Shortcuts: fixed first version with settings documentation and future custom-key structure.
- Nullable states: keep existing fields but allow empty priority, empty importance, and empty urgency.
- Project completion: project can be marked complete only when all child tasks are complete. If open tasks remain, block the action and explain why.
- Metrics: compare actual tracked time against planned scheduled time.
- Templates: unified template panel with duration, fixed-time, category, and advanced state fields.
- Continuous scrolling: all timeline views support true cross-day scrolling. Header date follows the viewport anchor and "Back to now" appears when far from now.
- Cross-day blocks: a single schedule record can span dates, such as 23:30 to 07:30, and the UI slices it for display.
- Widget "now doing" priority: running timer, then current scheduled block, then first Today's Candidate.
- Shortcuts style: mixed command/calendar style.
- Verification bar: build, existing tests, new core unit tests, and Playwright checks.

## Data Model

Extend existing types without a platform rewrite.

- Priority-like fields remain on `Task` and `Project`: `priority`, `importance`, `urgency`.
- These fields accept `high`, `medium`, `low`, or empty/null where applicable.
- New tasks default to:
  - `priority: null`
  - `importance: null`
  - `urgency: "low"`
  - `workflowStatus: "backlog"`
- Display semantics:
  - Urgency: red/yellow/gray exclamation mark for high/medium/low.
  - Importance: red/yellow/gray flag for high/medium/low.
  - Status: gray/yellow/green dot for not started / doing / done.
  - Empty states are first-class filter options, similar to Unassigned project.

Add first-class habits:

- `PlannerData.habits`: ordered habit definitions with title, default duration, archived flag, created/updated timestamps.
- Daily habit state records completion and scheduled state by date.
- Existing habit plugin config should migrate into main data but remain untouched as fallback data.

Upgrade timeline records:

- Support true cross-day schedule records by adding an end date or migrating to start/end datetime semantics.
- Old records normalize with end date equal to scheduled date.
- Rendering slices a single record across visible days, but editing and metrics treat it as one record.

Keep actual and planned time separate:

- Actual time comes from `TimeEntry`.
- Planned time comes from schedule records.
- Metrics must never treat planned schedule time as actual tracked time.

## UI And Interaction

Execute mode:

- Place a habit card below Today's Candidates.
- Habit card shows title, completion count, each habit checkbox, default duration, and scheduled marker.
- Each habit item can be dragged to the timeline independently.
- Scheduled habit items remain in the card and clicking the scheduled marker jumps to the timeline block.
- Completed habits remain visible for daily review.

Timeline:

- All timeline views support continuous cross-day navigation.
- Header date follows the current viewport anchor.
- "Back to now" appears when the viewport is far from current time/today.
- Cross-day blocks render as day slices; clicking any slice opens the same underlying record.
- Search, habit scheduled markers, and scheduled task results reuse one focus/jump mechanism.

Desktop widget:

- Open from the top more menu.
- True Electron always-on-top window.
- Shows now doing, quick add, and timer controls.
- Now doing resolution order: running timer, current scheduled block, first Today's Candidate.
- Widget reads/writes through a narrow IPC bridge and does not duplicate main UI state logic.

Global search:

- `Ctrl/Cmd+K` opens command palette.
- Index tasks, projects, events, notes, habits, and settings.
- Results support opening details, jumping to scheduled block, marking complete, starting timer, adding to today, and scheduling near current time.

Planning mode:

- Filters include empty priority/importance/urgency states.
- Kanban/list/matrix use the same icon semantics for status, importance, and urgency.
- Completed projects are hidden from active pickers by default but available through search/filter.
- Project complete action blocks if open tasks remain.

Metrics:

- Upgrade the existing project analysis area into time share metrics.
- Compare actual tracked time with planned scheduled time.
- Dimensions: project, category, importance, urgency, status.
- Ranges: 7, 30, 90, all.
- Clicking a segment drills into matching task/habit details.

Templates:

- Replace the narrow fixed-period template UX with a unified template panel.
- Group by duration, fixed time, category, and advanced fields.
- Template fields: title, default duration, start/end time, category, priority, importance, urgency, status.
- Apply template by creating tasks, adding to today, or scheduling onto the timeline.
- Existing schedule templates migrate to fixed-time templates.

Settings:

- Add a Shortcuts section.
- First version shows fixed shortcuts only; no custom key editing.
- Reserve a future customization data structure.
- Document conflict behavior: shortcuts do not fire in inputs, textareas, contenteditable elements, or modal typing contexts.
- Productivity settings include continuous cross-day scrolling, widget controls, habit defaults, and default metrics range.

## Implementation Architecture

Add focused utility modules:

- `src/utils/productivityModel.ts`: nullable state normalization, labels, icon semantics, filter matching, project completion validation.
- `src/utils/timelineRecords.ts`: migration, cross-day record calculations, visible-day slicing, timeline focus targets.
- `src/utils/habits.ts`: habit definitions, daily completion, daily scheduled state, schedule-record creation for habit items.
- `src/utils/commandSearch.ts`: command palette index and result actions.
- `src/utils/timeShareMetrics.ts`: actual versus planned metrics by dimension.
- `src/utils/shortcuts.ts`: fixed shortcut registry, display data, and input-context guard.

Wire existing UI to these modules instead of expanding logic inline in `main.tsx`.

Electron changes:

- `electron/main.cjs`: manage widget window and widget IPC.
- `electron/preload.cjs`: expose a narrow `desktopApi.widget` surface.
- Frontend renders a lightweight widget view through query param or route, sharing core utilities where possible.

Normalization/migration surfaces:

- Local Electron data normalize.
- Supabase/browser fallback normalize.
- Seed data and AI actions.
- Import/export paths that read or write priority-like fields and schedule records.

## Shortcuts

Use a mixed command/calendar style:

- `Ctrl/Cmd+K`: global search.
- `?`: shortcuts help.
- `N`: new task.
- `J/K`: previous/next date or scroll anchor.
- `T`: today/back to now.
- `D`: day view.
- `3`: three-day view.
- `W`: week view.
- `M`: month view.
- `P`: Planning.
- `E`: Execute.
- `Space`: start/pause timer for current focus task when not typing.

The shortcut registry must include labels, platform variants, scope, disabled conditions, and setting-section display metadata.

## Risks And Constraints

- Do not rewrite NavoPath into a plugin platform in this release.
- Do not make the timeline, candidates, habits, or templates plugin-hosted yet.
- Do not add shortcut customization in v1.
- Do not replace the NavoPath visual language with Super Productivity, Linear, TickTick, or Trevor AI styling.
- Existing worktree changes must be treated as user/current development work. Do not revert or overwrite unrelated changes.
- Cross-day timeline records are the highest risk area and need core tests before UI integration.
- The current `main.tsx` is large; new core logic should go into utilities and smaller components where practical.

## Test Plan

Required commands:

- `npm run build`
- `npm test`

New unit coverage:

- Nullable priority/importance/urgency normalization and filters.
- Project completion blocking when open tasks remain.
- Habit completion and scheduled-state behavior.
- Cross-day schedule record slicing.
- Search result generation and scheduled jump targets.
- Actual versus planned time share metrics.
- Shortcut registry and input-context guard.

Playwright checks:

- Main app loads.
- Global search opens and jumps to a scheduled item.
- Habit card renders; a habit item can be scheduled and remains marked scheduled.
- Time share metrics switch between actual and planned dimensions.
- Template panel creates/adds/schedules from templates.
- Continuous cross-day scrolling updates header date and shows Back to now.
- Desktop widget opens and displays now doing, quick add, and timer controls.

## Acceptance Criteria

- All requested features are present in dev.
- Existing data loads without losing old tasks, projects, templates, time entries, or plugin habit config.
- New habits appear under Today's Candidates and can be individually scheduled.
- Scheduled task/habit search results jump to the correct timeline block.
- Project completion is blocked until all project tasks are complete.
- Time share metrics clearly distinguish actual tracked time from planned scheduled time.
- Continuous cross-day scrolling works across day, three-day, week, and month views.
- The Electron widget is always-on-top and can quick-add and control timer state.
- Settings include a complete fixed-shortcut reference.
- Visual implementation follows `NavoPathStyle.md`.
