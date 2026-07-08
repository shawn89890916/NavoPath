# Implementation Notes

## Drag Debug Findings

- Drag library: no dnd-kit or external drag library is active. Drag/drop is a mix of custom pointer-event handlers, HTML5 native drag in month/landing paths, and shared overlay helpers from `src/unifiedDrag.tsx`.
- Active drag contexts:
  - Execute candidate shelf: `src/main.tsx` `TaskCard` -> `beginShelfDrag`.
  - Candidate subtask drag: `beginCandidateSubtaskDrag` creates or finds a planned task, then calls `beginShelfDrag`.
  - Habit candidate drag: `beginHabitDrag`.
  - Timeline block drag: `TimeBlock` -> `beginBlockDrag`.
  - All-day drag: `AllDayBlock` -> `beginShelfDrag(..., "allDay")`.
  - Month view still has HTML5 `draggable` / `dataTransfer` task drag handlers.
  - Planning Tree/Kanban/Matrix/List: `src/PlanningView.tsx` custom pointer handlers.
- Components using drag:
  - Today's candidate task blocks are rendered by `TaskCard` in `src/main.tsx`.
  - Tree tasks are rendered by `PlanningTaskNode` in `src/PlanningView.tsx`.
  - Tree subtasks are rendered by `PlanningSubtaskNode`.
  - Kanban cards are inline `TaskBlock` instances in `PlanningView`.
  - Matrix cards are inline `TaskBlock` instances in `PlanningView`.
  - List rows are inline compact `TaskBlock` instances in `PlanningView`.
  - Timeline events and scheduled tasks are rendered by `TimeBlock`.
  - All-day items are rendered by `AllDayBlock`.
- DragOverlay component:
  - Execute candidate/all-day overlay is not `TaskCard`; it is a hand-built simplified `TaskBlock` in `src/main.tsx` near the `dragOverlay && dragOverlayTask` render.
  - Tree overlay uses `UnifiedDragOverlay`, which clones DOM rather than rendering canonical task data.
  - Planning Kanban/Matrix/List overlay uses `TaskDragLayer` with another simplified `TaskBlock` in `PlanningView`.
  - Timeline block overlay/fallback also uses `UnifiedDragOverlay`, `.df-drop-preview.moving-block`, and floating preview components depending on state.
- TaskBlock component: canonical block anatomy lives in `src/components/TaskBlock.tsx`. `TaskCard`, `TimeBlock`, `AllDayBlock`, and Planning cards each compose it differently.
- Click/edit component:
  - Candidate click opens the editor through `TaskCard onClick={() => openTaskEdit(task)}` in `src/main.tsx`.
  - Timeline blocks call `openTaskEdit` via `TimeBlock onEdit`.
  - Planning tasks call `props.onTaskEdit` from `PlanningView`, which points back to `openTaskEdit` in `main.tsx`.
  - `openTaskEdit` itself does not check a global drag suppression flag.
- Source of wrong overlay style:
  - Candidate overlay is a separate simplified `TaskBlock`, not the actual `TaskCard` renderer. It omits visible actions, event marker, repeat/subtask metadata, expanded state, placement state, and exact row structure.
  - Tree overlay clones DOM and can inherit or miss style depending on source class timing.
  - Old preview styles are still active for timeline: `.df-drop-preview`, `.df-drop-preview.moving-block`, `.df-floating-unschedule`, `.df-floating-shelf-drag`, and `.df-floating-drag-block`.
- Source of wrong overlay title:
  - Candidate overlay title comes from `dragOverlayTask.task.title`, set at drag activation in `beginShelfDrag`.
  - Candidate subtask drag can pass a generated or reused planned task from `beginCandidateSubtaskDrag`, so active overlay data may not be the same visible source row text.
  - Timeline record drags can use record ids and `recordToTaskMap`, while candidate drags use task ids; the mixed task/record/event id space makes lookup-dependent overlays fragile.
- Source of missing reorder:
  - `beginShelfDrag` only targets timeline slots, all-day cells, and all-day return-to-candidate. It has no candidate same-level reorder target detection, no candidate insertion line state, and no order update path.
  - `visibleCandidates` is derived from event candidates + today tasks + optionally completed tasks; there is no reorder operation over that rendered sequence.
  - Planning view reorder code is separate and does not apply to Today's candidate shelf.
- Source of edit panel opening after drag:
  - Candidate drag sets `suppressBlockClickRef.current = true` only after drag activation, but cleanup resets it with `setTimeout(..., 0)`. The click event after pointerup can therefore run after the flag has already been cleared.
  - `TaskCard` calls `openTaskEdit(task)` directly without checking suppression.
  - `openTaskEdit` has no guard against a just-completed drag.
- Old conflicting code to remove:
  - HTML5 `draggable` / `dataTransfer` month-view task drag paths if they overlap the chosen system.
  - `UnifiedDragOverlay` DOM clone paths where a canonical TaskBlock renderer is required.
  - Simplified hand-built candidate and Planning overlay TaskBlocks.
  - Floating text previews: `FloatingUnschedulePreview`, `FloatingShelfDragPreview`, `.df-floating-*`.
  - Timeline moving preview CSS if it is used as a drag card rather than a time-slot preview.
  - Opacity-only source styles such as `.df-time-block.is-dragging { opacity: 0 }` and any stale `.is-drag-source` paths not driven by the chosen drag state.

## Drag And Drop

- Drag library: custom pointer-event drag system in `src/PlanningView.tsx` plus shared overlay helpers in `src/unifiedDrag.tsx`.
- Planning drag sources: Tree project/task/subtask nodes, Kanban task cards, Matrix task cards, and List rows.
- Execution timeline drag sources remain inside `src/main.tsx` timeline scheduling code and are independent from Planning.
- Active Planning drag data stores stable task/node ids, item type, source surface/view/container, source size, pointer offset, current pointer, and a task snapshot for React-rendered task overlays.
- Drop intent model:
  - `reorder-before`
  - `reorder-after`
  - `drop-into-container`
  - `schedule-at-time`
  - `invalid`
- Same-level reorder happens on drop, not during pointer movement. During drag the UI shows only insertion feedback.
- Tree nesting restrictions:
  - Projects are not nested inside other projects.
  - Tasks and subtasks can move across supported project/task/subtask containers.
  - Drops into the same item are ignored.
  - Drops into direct self-owned subtask containers are blocked by owner checks.
- Planning and Execution timeline do not drag into each other. Planning drag/drop only affects Planning organization views; timeline drag/drop only edits scheduled items in Execution.
- Timeline drag preserves duration where the existing timeline model supports it, snaps to the timeline grid, and uses time-slot previews.
- Drag starts only after pointer movement exceeds `5px`.
- After a real drag, task edit clicks are suppressed for `220ms` so pointerup/drop does not open the editor.
- Source items become clean placeholders using `is-dragging-source` / `data-drag-state="source-placeholder"` styling; overlays are full TaskBlock renderings or source DOM clones with intact card styling.

## Candidate Drag Verification

- Drag overlay uses TaskBlock: yes. Browser verification found `.df-task-drag-layer .df-task-block` with `data-drag-state="overlay"` while dragging a normal Today's Candidates task.
- Correct title in overlay: yes. Verified overlay title stayed `整理 ESAT 题型错因` for the dragged source task.
- Source placeholder visible: yes. Verified the source task rendered with `data-drag-state="source-placeholder"` during drag and opacity stayed `1`.
- Insertion line visible: yes. Verified `.df-list-insertion-line` appeared between candidate tasks during same-level reorder.
- Reorder on drop works: yes. Verified dropping `整理 ESAT 题型错因` after `更新作品集首页文案` moved the row only on pointerup.
- Drop back to same place does not open editor: yes. Verified dragging a candidate away and dropping back on itself left order unchanged and no drawer/editor opened.

## Planning Drag Verification

- List same-level reorder: yes. Verified TaskBlock overlay, source placeholder, insertion line, drop reorder, and no editor open.
- Kanban same-column reorder: yes. Verified TaskBlock overlay, source placeholder, insertion line, drop reorder, and no editor open after fixing order persistence and insertion-target priority.
- Matrix same-quadrant reorder: yes. Verified TaskBlock overlay, source placeholder, insertion line, drop reorder, and no editor open.
- Tree same-level reorder: yes. Verified tree overlay, source placeholder, drop preview `Place after`, drop reorder, and no editor open.
- Tree cross-level move: yes. Verified tree overlay, source placeholder, drop preview `Place inside`, moving a task into Unassigned, and no editor open.
- Tree overlay note: Tree now uses `TaskDragLayer` with a canonical `TaskBlock` overlay. It maps the actual tree source node to task-like data and measures the real `[data-planning-drag-card]` element, so the overlay keeps the source card size instead of cloning a whole tree branch/container.

## Timeline and Tree Drag Fix

- Timeline drag overlay is rendered in `src/main.tsx` with `TaskDragLayer` wrapping the existing `TimeBlock` scheduled-task renderer. Block drags bypass the old floating unschedule preview and the non-TaskBlock `UnifiedDragOverlay` path.
- Timeline source blocks remain in place with `dragState="source-placeholder"` instead of being filtered out or hidden. The placeholder preserves the event time-range size; browser verification for a temporary non-recurring scheduled block showed source and overlay both at `407.578125 x 60`, opacity `1`, no `.df-unified-drag-overlay`, no floating preview, and no editor opened after drop. The temporary localStorage record used for this verification was restored afterward.
- Tree drag overlay is rendered in `src/PlanningView.tsx` with `TaskDragLayer` wrapping a canonical `TaskBlock`. The old DOM-clone preview is removed from the Tree path; the tree handler now resolves the actual source node from `event.target.closest("[data-node-type][data-node-id]")` and measures the node's `[data-planning-drag-card]`.
- Tree source rows use `dragState="source-placeholder"` on the actual `PlanningTaskNode` / `PlanningSubtaskNode` task block. Browser verification showed source placeholder `558 x 40`, overlay `560 x 40`, opacity `1`, no `.df-unified-drag-overlay`, active drop preview, no editor opened after drop, and no drag layer left behind.
- Placeholder CSS in `src/task-block.css` now uses shared neutral tokens `--drag-placeholder-bg` and `--drag-placeholder-border`. Planning source/drop placeholders no longer use project-color, purple, blue, or opacity-only ghost styling.
- `src/unifiedDrag.tsx` `TaskDragLayer` now applies both source width and height so overlays can preserve the picked-up card size.

## Importance / Urgency Icon Controls

- Fields used: `task.importance` and `task.urgency`, each stored as `'high' | 'medium' | 'low' | null`.
- Icon mapping:
  - Importance high: coral red filled flag (`#C96F5B`)
  - Importance medium: amber filled flag (`#C49A32`)
  - Importance low: muted blue filled flag (`#6E8DA6`)
  - Importance unset: neutral outline flag (`#8E8478`)
  - Urgency high: coral three-exclamation marks (`#C96F5B`)
  - Urgency medium: amber two-exclamation marks (`#C49A32`)
  - Urgency low: muted blue single-exclamation mark (`#6E8DA6`)
  - Urgency unset: neutral dash (`#8E8478`)
- Selected-state behavior: selected segment shows 18% semantic-tinted background + 3px inset bottom rule in semantic color + semantic-colored border. Unselected segments remain quiet with transparent background.
- Unset behavior: clicking "unset" clears the field (sets to `null` in form state, persists as `null` to task data). The unset option is auto-selected when no value exists.
- Form initialization: `importance` and `urgency` are loaded from task data using `!== undefined` check to preserve explicit `null` (unset) values. Old tasks without the field fall through to `priority` (importance only) or `null`.
- CSS specificity: All level-selector rules are prefixed with `.df-app .df-level-selector` (specificity 0,3,0+) and use `!important` to beat global `.df-app button:not(...)` overrides (specificity 0,2,1-0,2,2) that force `background: transparent`, `box-shadow: none`, and `border-color` on all buttons.
- Matrix mapping: Uses four-quadrant high/non-high logic:
  - Q1 (紧急且重要): `importance === 'high' && urgency === 'high'`
  - Q2 (不紧急但重要): `importance === 'high' && urgency !== 'high'` (medium/low/unset treated as non-high)
  - Q3 (紧急但不重要): `importance !== 'high' && urgency === 'high'` (medium/low/unset treated as non-high)
  - Q4 (不重要且不紧急): `importance !== 'high' && urgency !== 'high'`
- No 3x3 matrix introduced; medium and low values are preserved on the task and may be shown as small metadata/icons but do not create extra quadrants.
- Migration: Old tasks without `importance` fall through to `priority` field. Old tasks without `urgency` default to `null` (unset).

## Importance / Urgency Selected State Debug

- Component: `EditDrawer` in `src/main.tsx`
- Selected value source: `(f.importance ?? "unset")` / `(f.urgency ?? "unset")` — derived from form state, maps `null` to `"unset"`
- Selected button has data-selected: `<button data-selected="true">` when matching current value, `data-selected="false"` otherwise
- Selected button has aria-pressed: `<button aria-pressed="true">` when matching current value, `aria-pressed="false"` otherwise
- CSS selector used: `.df-app .df-level-selector .df-level-option[data-selected="true"]` (specificity 0,4,1)
- Root cause: Global button rules at lines 1702-1713 of app-redesign.css — `.df-app button, .df-app button:hover:not(:disabled), .df-app button:focus-visible, .df-app button:disabled` — set `box-shadow: none !important` on ALL buttons WITHOUT excluding `.df-level-option`. This overrides the selected state's inset ring on the button element itself.
- Solution: Use `::after` pseudo-element for the selected ring instead of `box-shadow` on the button, since pseudo-elements are NOT targeted by `.df-app button` selectors and thus avoid the specificity war entirely.

## Timeline Resize Bug Debug

- Component rendering timeline event: `TimeBlock` in `src/main.tsx` (line 9663)
- Drag start handler: `beginBlockDrag` (line 4664)
- Drag move handler: inline `move` function in `beginBlockDrag` (line 4689)
- Drag end handler: inline `up` function in `beginBlockDrag` (line 4749), calls `moveTimelineRecord`
- Resize start handler: `beginBlockResize` (line 4864)
- Resize end handler: inline `up` function in `beginBlockResize` (line 4884)
- Where duration is calculated: `taskDuration` (line 682) — uses `scheduledStart/End` or `estimatedHours`
- Where event height is calculated: `timeBlockHeight` from `src/timelineGeometry.ts` (line 241) — converts duration minutes to pixels
- Where "已调整时长" is generated: `showToast(t(lang, "toast.durationAdjusted"))` (lines 4661, 4931, 4952) — this is a toast notification, NOT rendered inside task block
- Root cause: In `beginBlockResize`, when resizing a task with `timelineRecords`, only the record's `scheduledEnd` is updated, but the `estimatedHours` calculation uses `nextEnd - nextStart` without ensuring both are consistently updated on the same object. Additionally, some tasks may have `scheduledEnd` missing or mismatched with `scheduledStart`, causing `taskDuration` to fall back to `estimatedHours` which may be incorrect.

## Timeline Scheduled Task Rendering Debug

### Short event
- Component: `TimeBlock` using `TaskBlock` with variant="scheduled", appearance="calm"
- Class names: `df-task-block df-task-block--scheduled df-task-block--appearance-calm df-time-block priority-*`
- Data attributes: `data-task-appearance="calm"`, `data-task-variant="scheduled"`, `data-schedule-size="short"`
- Height: ~40px (15m task) to ~55px (30m task)
- align-items: center (from [data-schedule-size="short"] override)
- justify-content: flex-start (from row override)
- padding: 3px 6px (from --task-padding-y/x)
- min-height: unset (from scheduled override)
- checkbox size: 14px (from [data-schedule-size="short"] override)
- Root cause: `.df-task-block-content` had `align-self: stretch` + `justify-content: center`, causing content to be vertically centered in a tall container

### Ultra-long event
- Component: `TimeBlock` using `TaskBlock` with variant="scheduled", appearance="calm"
- Class names: `df-task-block df-task-block--scheduled df-task-block--appearance-calm df-time-block priority-*`
- Data attributes: `data-task-appearance="calm"`, `data-task-variant="scheduled"`, `data-schedule-size="tall"`
- Height: >= 120px (multi-hour tasks)
- align-items: flex-start (from [data-schedule-size="tall"] override)
- justify-content: flex-start (from row override)
- padding: 8px 10px (from --task-padding-y/x)
- min-height: 0 (from tall-block override)
- content vertical position: top of block (fixed by content override)
- Root cause: `.df-task-block-content` had `align-self: stretch` + `justify-content: center`, overriding the tall-block row's `align-items: flex-start`. The content stretches to fill the full height, then centers vertically within itself.

### Size classification rules
- short: rendered height < 56px
- normal: 56px <= rendered height < 120px  
- tall: rendered height >= 120px
- Implemented via `data-schedule-size` attribute on TaskBlock element

## Timeline Short Event Height Root Cause

- Event wrapper component: `TaskBlock` rendered by `TimeBlock` in src/main.tsx (line 9700)
- Inner TaskBlock component: `TaskBlock` from src/components/TaskBlock.tsx
- Calculation flow (fixed):
  - `start = preview?.start || task.scheduledStart || "09:00"`
  - `computedDuration = taskDuration(task)` — gets duration from task
  - `end = preview?.end || task.scheduledEnd || addMinutes(start, computedDuration)`
  - Validate duration: if `endMinutes - startMinutes <= 0` or `> 24*60`, recalculate `end = start + computedDuration`
  - `top = timeBlockTop(start, dayStartHour)` 
  - `height = Math.max(timeBlockHeight(start, end), SLOT_HEIGHT)`
  - `durationMinutes = timeToMinutes(end) - timeToMinutes(start)`
- Inline styles applied: `{ top: topPx, height: heightPx, bottom: 'auto', position: 'absolute' }`
- CSS rules affecting height:
  - `app-redesign.css:1557`: `.df-app .df-time-block` has `justify-content: center !important`
  - `app-redesign.css:1558`: `.df-app .df-time-block` has `padding: 8px 12px 8px 28px !important`
  - `task-block.css:512`: `.df-task-block[data-task-variant="scheduled"]` has `position: absolute !important`
- Debug logging added: Console.table for task "更新作品集首页文案" with durationMinutes, startMinutes, endMinutes, heightPx, and computed DOM styles via requestAnimationFrame
- Data attributes added to event wrapper: `data-timeline-event-id`, `data-task-id`, `data-duration-minutes`, `data-start-minutes`, `data-height-px`, `data-schedule-size`
- Root cause: **Case A - wrong task duration/end-time data**
  - When `scheduledEnd` was missing or incorrectly set (e.g., to midnight/end of day), the duration was calculated as huge
  - The fallback `addMinutes(start, taskDuration(task))` was not being used correctly because `scheduledEnd` might have been set to a wrong value
- Fix: Added validation to recalculate `end` if `endMinutes - startMinutes <= 0` or `> 24*60`, ensuring short tasks always have correct duration
- Also added `bottom: auto` to inline styles to prevent CSS from overriding the height
- Added development warnings: console.error if short task renders too tall, console.warn if endMinutes <= startMinutes

## Importance / Urgency Display Mapping

Records how `importance` and `urgency` are surfaced across the drawer, task cards, and Matrix.

### Fields

- `task.importance: NullablePriority` — `"high" | "medium" | "low" | null`
- `task.urgency: NullablePriority` — `"high" | "medium" | "low" | null`
- Missing / null / undefined values are treated as `"unset"` for display.

### Drawer selected-state display

- Each row in `EditDrawer` (`src/main.tsx`) shows: label, segmented icon selector, and a current-value text badge (`.df-level-current`) on the right.
- Badge text: `当前：{value}` (zh) / `Current: {value}` (en). Unset maps to `未设置` / `Unset`.
- Badge value is computed from `form.importance` / `form.urgency` on every render, so it updates immediately after click and survives close/reopen.
- Selected option uses 18% semantic tint + semantic border + 3px bottom rule (see "Selected State Debug" above).

### Task checkbox importance mapping

- `TaskCheckbox` (`src/components/TaskBlock.tsx`) wraps the button in `<span class="df-task-checkbox-wrap" data-importance={imp} data-urgency={urg}>`.
- `imp` / `urg` fall back to `"unset"` when the prop is null/undefined.
- CSS in `src/app-redesign.css` maps `data-importance` to checkbox border color:
  - `high` → `#C96F5B` (coral), border-width 1.5px
  - `medium` → `#C49A32` (amber)
  - `low` → `#6E8DA6` (muted blue)
  - `unset` → `var(--paper-ink-muted, #8E8478)` (neutral)
- Border color is preserved when the checkbox is checked (`.completed` / `[aria-pressed='true']`).

### Task checkbox urgency marker

- When `urgency !== "unset"` and the task is not completed, a small `!` marker (`.df-task-urgency-mark`) is rendered at the top-right of the checkbox wrap.
- Marker color follows `data-urgency`: high `#C96F5B`, medium `#C49A32`, low `#6E8DA6`.
- Marker is `pointer-events: none` so it never blocks the checkbox click target.
- Marker has a thin paper-colored text-shadow so it stays readable against any background.

### Completed checkbox behavior

- Completed tasks still show the checkmark clearly; the card is not covered by a gray overlay and overall opacity is not reduced.
- Importance border color is retained on the checked checkbox so the signal is not lost.
- Urgency marker is hidden when the task is completed (the `!` is only rendered when `!checked`).

### Matrix high/non-high mapping

- Matrix remains 4 quadrants (not 3x3).
- `importance === 'high'` → important axis; all other values (medium, low, unset) → non-high.
- `urgency === 'high'` → urgent axis; all other values → non-high.
- Quadrants: 紧急且重要, 不紧急但重要, 紧急但不重要, 不重要且不紧急.

### Callers passing importance/urgency to TaskCheckbox

- `src/main.tsx` — today candidate task card
- `src/PlanningView.tsx` — planning tree task, kanban task, matrix task, list task
- Drag overlay (`TaskDragLayer`) is visual-only and does not pass importance/urgency.

## Importance / Urgency Selected Border Debug

- Component: `EditDrawer` in `src/main.tsx` (lines ~10312-10350)
- Option class: `df-level-option df-level-{value}` (e.g. `df-level-high`)
- Selected class present: YES — `.active` is applied when `f.importance === option.value` (or `f.urgency`)
- aria-pressed present: YES — set to `true` on the selected button
- `--df-option-color` value: correctly set via `.df-level-importance .df-level-high { --df-option-color: #C96F5B }` (and medium/low/unset, plus urgency variants)
- Computed border: `border: 0` (from `.df-level-option` rule) — border width is always 0, so `border-color` has no visual effect
- Computed box-shadow on selected: `inset 0 0 0 1px color-mix(...)` — comes from the GLOBAL button rule, NOT from the `.active` rule
- Overriding CSS selector: `.df-app button:not(.df-block-check):not(.df-subtask-check):not(.df-card-check):not(.df-resize-dot)` at line ~1575, specificity (0, 5, 1)
- Selected-state rule specificity: `.df-app .df-level-selector .df-level-option.active` = (0, 4, 0) — LOWER than the global rule
- Root cause: The global button rule at line ~1575 has 4 `:not()` exclusions giving it specificity (0, 5, 1), which beats the `.active` rule at (0, 4, 0). Both use `!important`, so higher specificity wins. The global rule sets `box-shadow: inset 0 0 0 1px ...` which overrides the selected `box-shadow: inset 0 0 0 2px var(--df-option-color)`. The same global `:hover` and `:active` variants at lines ~1582 and ~1587 also override the level-option hover/active styles.
- Fix: Add `:not(.df-level-option)` to the 3 global button rules so they stop matching level-option buttons. This lets the `.df-level-selector`-scoped rules (which already set border, background, box-shadow, color) handle all level-option styling without global interference.

## Known Limitations

- Planning Tree no longer uses a DOM-cloned overlay for task/subtask/project drags; it uses a React-rendered `TaskBlock` overlay from `TaskDragLayer`.
- Kanban and Matrix same-container reordering updates task order on drop; moving between columns/quadrants updates the task status or importance/urgency.
- Cross-view drag between Tree, Kanban, Matrix, and List is intentionally unsupported because they are separate Planning surfaces.

## Habit Overview Refactor

### Audit (before refactor)
- `HabitPanel` (src/main.tsx) — outer shell: backdrop + `aside.df-utility-panel.df-habit-panel` + head (title + close) + body that switches between overview and detail modes.
- `HabitOverviewBody` (old) — overview content: `.df-habit-week-board` toolbar + `.df-habit-week-table` grid + `.df-settings-group.df-habit-list-group` archived list.
- `HabitDetailBody` — edit form (NOT touched in this refactor).
- Data sources preserved: `buildHabitMetrics(props.data, props.today)` for per-habit metrics, `props.data.habitDailyStates` for daily completion, `isHabitDueOnDate(habit, date)` for due detection, `weekOffset` state for week navigation, `props.archivedHabits` filtered from `data.habits`.
- Old CSS: `.df-habit-week-*` in task-block.css (bordered cell boxes + 9px dots) and `.df-habit-overview-list/row/title/dot/meta` + `.df-habit-archive-toggle` in app-redesign.css (legacy archived list).

### Refactored components
- `HabitOverviewBody` rewritten in place (src/main.tsx) with new class names and structure:
  - `.df-habit-overview` — section wrapper.
  - `.df-habit-overview-toolbar` — week range (editorial display) + nav actions (prev / today / next / new habit) split into `.df-habit-overview-range` and `.df-habit-overview-actions`.
  - `.df-habit-overview-table` — borderless grid table with `.df-habit-overview-thead` (column headers: 习惯 + 7 days) and `.df-habit-overview-trow` (habit name + 7 day cells).
  - `.df-habit-overview-cell` — day cell with 18px circular `.df-habit-overview-dot` completion unit. States: `is-due` (subtle accent ring), `is-planned` (22% accent tint), `is-done` (solid accent fill + white check via `::after` SVG), `is-today` (5% accent column tint).
  - `.df-habit-overview-archived` — collapsible disabled-habits section with `.df-habit-overview-archived-toggle` (▸/▾ chevron) and `.df-habit-overview-archived-row` rows. Each row has name + edit/restore icon tools (`.df-habit-overview-tool`).

### Deleted / stopped using
- `.df-habit-week-board`, `.df-habit-week-toolbar`, `.df-habit-week-actions`, `.df-habit-week-today`, `.df-habit-week-table`, `.df-habit-week-header`, `.df-habit-week-row`, `.df-habit-week-name`, `.df-habit-week-cell`, `.df-habit-week-empty` — removed from task-block.css.
- `.df-habit-overview-list`, `.df-habit-overview-row`, `.df-habit-overview-title`, `.df-habit-overview-meta`, `.df-habit-archive-toggle` — removed from app-redesign.css.
- `.df-habit-list-group` / `.df-habit-list-toggle` classes — no longer referenced (leftover `df-habit-list-group` style kept as a no-op for safety since `df-settings-group` still exists on that section elsewhere; will be cleaned up if detail mode is refactored later).
- Responsive rules for old `.df-habit-overview-row` / `.df-habit-overview-meta` removed from app-redesign.css `@media (max-width: 520px)`.

### Preserved for compatibility
- `.df-habit-empty` — still used by `HabitPanel` detail fallback ("未找到该习惯").
- `.df-habit-overview-dot` class name reused with new meaning (18px circular unit, not the old 8px dot). Old `.done`/`.planned` modifier rules on the dot are dead; the new code applies `is-done`/`is-planned` on the parent cell instead.
- `.df-habit-overview-add` class kept (used on the "+ 新增习惯" button and the empty-state button).
- `.df-habit-panel` width bumped from 520px to 560px to give the 8-column table breathing room.
- All data logic untouched: `weekOffset`, `metrics`, `dailyStates`, `onToggleDay`, `onArchive`, `onCreateHabit`, `onEditHabit`, `isHabitDueOnDate`, `addDays`.

### Known remaining edge cases
- Very long habit titles use ellipsis truncation; full title visible on hover via native `title` only on the archived row. Active habit name row does not have a `title` attribute — could be added later if needed.
- The check SVG inside the completed dot is a fixed white stroke (`%23FBF9FF`) which matches the light `--surface-main`; in dark mode the contrast may be slightly off but acceptable since the accent fill is still clearly distinct from empty cells.
- No explicit "delete" action on archived habits (only edit + restore) because the existing `HabitPanel` props do not expose a delete handler. Adding delete would require plumbing a new `onDeleteHabit` callback through `HabitPanel` — out of scope for this layout refactor.

## Habit Feature Toggle

### Settings field
- Added `featureHabitsEnabled?: boolean` to the `Settings` interface in `src/types.ts`.
- Defaults to `true` (enabled) when undefined — existing users won't be affected.
- Persisted via `saveSettings()` and `getSettings()` like all other settings fields.

### Guard points in src/main.tsx
1. **Settings toggle**: Added checkbox in Settings > Features section (`settings.featureHabitsEnabled !== false`)
2. **HabitCandidateCard rendering**: Conditional wrap `{settings.featureHabitsEnabled !== false && (<HabitCandidateCard .../>)}`
3. **HabitPanel rendering**: Guarded with `settings.featureHabitsEnabled !== false`
4. **openHabitDetail(habitId)**: No-op when `!settings || settings.featureHabitsEnabled === false`
5. **openHabitOverview()**: No-op when `!settings || settings.featureHabitsEnabled === false`
6. **beginHabitDrag(event, habit)**: No-op when `!settings || settings.featureHabitsEnabled === false`
7. **hasActiveHabits**: Gated with `settings.featureHabitsEnabled !== false && habits.some(...)` — so the empty-state logic doesn't reference habits when feature is off
8. **Auto-close panel**: `useEffect` watches `settings?.featureHabitsEnabled` and closes habitPanel + clears editingHabitId when toggled off

### Behavior
- **Enabled (default)**: All habit features work normally — candidate list shows habits, overview panel opens, drag works
- **Disabled**: HabitCandidateCard hidden, overview panel won't open, beginHabitDrag is blocked, empty-state logic ignores habits
- **Data preservation**: Habit data (`habits`, `habitDailyStates`) is NEVER deleted — only hidden from UI. Re-enabling restores all existing habits.

## Timeline Quick Add & Project Color Bar Fixes

### Fix 1: Timeline click creates task with no default project
- **Problem**: Clicking timeline blank area created tasks that inherited the last-used project via `lastQuickAddProjectIdRef` and `FloatingTimeAddInput` pre-selection.
- **Fix**: 
  - `FloatingTimeAddInput`: Initialize `input=""` and `selectedProject=null` instead of reading from `add.lastProjectId`
  - `setFloatingTimeAdd` calls: Removed `lastProjectId` field from both timeline click handlers
  - `lastQuickAddProjectIdRef` and `saveFloatingTimeAdd` persistence: Kept intact so user-chosen projects still persist for future sessions
- **Result**: New timeline tasks default to unassigned project; users can still manually type `#project` or select from dropdown

### Fix 2: Project color bar persists during hover/selected/dragging
- **Problem**: CSS `border-color` shorthand in hover and selected/dragging rules overrode all four borders, wiping out the project-colored left border.
- **Fix**: Added explicit `border-left-color: var(--task-project-color, var(--accent-active)) !important` after `border-color` in both rules
- **Affected rules**: `.df-task-block[data-task-appearance]:hover` / `:focus-within` and `.df-task-block[data-task-appearance].is-selected` / `.is-dragging`
- **Result**: Project color bar stays visible in all interaction states while other borders change normally

# Timeline Short Event Debug Proof

For broken short task:
- task title: DEBUG short 30m repro
- durationMinutes: 30
- startMinutes: 960
- endMinutes: 990
- heightPx: 40
- DOM getBoundingClientRect height: 1920
- red outline wraps correct wrong block: yes
- root cause is data / wrapper style / parent CSS / wrong component: wrapper style. The positioned scheduled TaskBlock is the real outer timeline event wrapper; its inline `height: 40px` is being overridden by the scheduled short/tall root CSS rule `height: 100% !important`, so the absolute event fills the 1920px `.df-timeline-canvas`.

## Infinite Cross-day Drag Resize Debug

- Timeline scroll container: `.df-timeline-canvas` / `timelineCanvasRef.current` (daily) and `.df-time-grid` / `timeGridRef.current` (3day/weekly), wrapped by `timelineRef.current` scroll viewport.
- Rendered range start: `continuousTimelineStartDate` (= `continuousTimelineDates[0]`, derived from `continuousAnchorDate` which tracks the visible window). Days are produced by `buildDailyContinuousDates` (centered window of `DAILY_CONTINUOUS_DAY_COUNT` = 7 for daily, or N columns × bands for 3day/weekly).
- Rendered range end: `continuousTimelineStartDate + (continuousTimelineBandCount * timelineColumnCount) - 1`.
- Event render top/height formula:
  - Continuous mode top: `continuousTimedTop(scheduledDate, scheduledStart)` = `bandIndex * DAY_HEIGHT_PX + minutesFromDayStart * pxPerMinute` (band index derived from `continuousDateOffset`).
  - Non-continuous top: `timeBlockTop(start, dayStartHour)` (single-day coordinate).
  - Height: `timeBlockHeight(start, end)` = `max((endMin - startMin) / 60 * HOUR_HEIGHT, SLOT_HEIGHT)`. **Breaks for cross-midnight because `endMin - startMin` is negative.**
- Drag start handler: `beginBlockDrag` (src/main.tsx). Stores `duration`, `offsetMinutes` (pointer offset inside block, rounded to slot), `offset` px. Activates after 5px movement.
- Drag move handler: inline `move` in `beginBlockDrag`. Calls `getDropTargetFromPointer` (single-day `pointerToDateTime`) which uses `visibleDays` + X column to derive date. **In daily continuous mode `visibleDays` is the 7-day range but `pointerToDateTime` still picks the date by X (only 1 column), so the date is always `visibleDays[0]` regardless of Y.** This is the root cause: the Y position is never mapped to the correct band/day.
- Drag end handler: inline `up` in `beginBlockDrag`. Same `getDropTargetFromPointer` bug; passes `target.date` + `nextStart` to `moveTimelineRecord` / `moveEventOccurrence`.
- Resize start handler: `beginBlockResize`. Calls `slotFromPointer(clientY, 0, clientX)` which in continuous mode delegates to `dailyTargetFromPointer` → returns only `.minutes` (time-of-day), **dropping the date**. So resize can never move the end across midnight.
- Resize move handler: inline `move` in `beginBlockResize`. Computes `start = timeToMinutes(task.scheduledStart)`, `end = timeToMinutes(task.scheduledEnd)`. For a 23:30→00:30 task this gives `start=1410, end=30`; `Math.max(slotMin, start + SLOT_MINUTES)` clamps `nextEnd` to ≥1425, making cross-midnight resize impossible.
- Resize end handler: inline `up` in `beginBlockResize`. Same broken duration math; `durationHours = (nextEndMin - nextStartMin) / 60` is negative for cross-midnight.
- Current code using currentDate/focusedDate: `getDropTargetFromPointer` uses `visibleDays` (derived from `timelineDate`/`dailyTimelineDates`) but resolves date by X column only. `dragTargetDateRef.current` is set from this broken date. `slotFromPointer` falls back to `timelineDate` when no grid.
- Current code ignoring scrollTop: `pointerToDateTime` in `timelineGeometry.ts` uses `clientY - gridRect.top`; this is correct **only because `gridElement` is the full-height canvas** (so `gridRect.top` already shifts with scroll). It is NOT a bug for the grid element itself — the bug is that the resolved date is wrong in continuous daily mode because date is derived from X, not Y/band.
- Root cause:
  1. `beginBlockDrag` and `beginBlockResize` do not branch on `continuousTimelineEnabled`. They use `getDropTargetFromPointer` / `slotFromPointer` which resolve the date from the X column. In daily continuous mode there is only one column, so every Y maps to `visibleDays[0]` — drag/resize can never target a different day.
  2. The existing continuous helper `continuousPointerTarget` (which correctly derives date from Y band index) is used by click-to-create and slot label code paths, but NOT by drag/resize.
  3. `taskDuration`, `timeBlockHeight`, `moveTimelineRecord`, and the resize math all compute duration as `timeToMinutes(end) - timeToMinutes(start)`, which is negative for cross-midnight tasks (e.g. 23:30→00:30 → -1380). This collapses 60-minute cross-midnight blocks to 15px and breaks resize duration math.
  4. `moveTimelineRecord` recomputes `newEnd = minutesToTime(timeToMinutes(newStart) + duration)` with the same negative-duration bug.
- Fix plan:
  - Add `durationMinutes(start, end)` cross-midnight-aware helper to `timelineGeometry.ts`; use it in `taskDuration`, `timeBlockHeight`, `moveTimelineRecord`, `TimeBlock`, and resize math.
  - Make `beginBlockDrag` and `beginBlockResize` use `continuousPointerTarget` (date-from-Y) when `continuousTimelineEnabled`, and `getDropTargetFromPointer` otherwise. Pass the resolved `date` through to `moveTimelineRecord` / `moveEventOccurrence`.
  - Handle drag offset across midnight: when `timeToMinutes(target.startTime) - offsetMinutes < 0`, roll the start time forward by 24h and decrement the target date.
  - Handle resize across midnight: compute pointer absolute minutes relative to `continuousTimelineStartDate`; `newDuration = max(MIN, snap(pointerAbs - startAbs))`; `newEnd = addMinutes(start, newDuration)` (wraps mod 24h). For start-edge resize, mirror with `endAbs` fixed.
  - Keep `resizePreview` as `{taskId, start, end}` (time strings) — start date stays fixed for end-edge resize, which is the documented acceptance case; `timeBlockHeight` fix makes the preview height correct for cross-midnight.

### Resolution (implemented)

- Geometry helpers added to `src/timelineGeometry.ts`:
  - `durationMinutes(startTime, endTime)` — cross-midnight-aware: when `end - start <= 0`, wraps by `+24*60`. So `23:30→00:30` returns `60`, not `-1380`.
  - `dateTimeToAbsoluteMinutes(date, time, anchorDate)` — `dayIndex * 1440 + minutesOfDay`, where `dayIndex` is the calendar-day delta from `anchorDate`.
  - `absoluteMinutesToDateTime(absoluteMinutes, anchorDate)` — inverse of the above; `minutesOfDay` is taken mod `1440` so negative absolute minutes roll back to the previous day correctly.
  - `snapMinutes(minutes, snap = SLOT_MINUTES)` — `Math.round(minutes / snap) * snap`.
  - `timeBlockHeight` now uses `durationMinutes(start, end)` so cross-midnight blocks render at full pixel height instead of collapsing to `SLOT_HEIGHT`.
- `src/main.tsx`:
  - Module-level `spanDurationMinutes(start, end)` mirrors `durationMinutes` (renamed to avoid colliding with `TimeBlock`'s local `const durationMinutes`).
  - `taskDuration`, `moveTimelineRecord`, and `TimeBlock`'s `calculatedDurationMinutes` all use `spanDurationMinutes` instead of raw `timeToMinutes(end) - timeToMinutes(start)`.
  - New component-scoped helpers:
    - `resolveDropTarget(clientX, clientY)` — branches on `continuousTimelineEnabled`: uses `continuousPointerTarget` (date from Y band) in continuous mode, `getDropTargetFromPointer` (date from X column) otherwise. Returns `{ date, startTime, minutes }`.
    - `subtractOffsetFromDateTime(date, time, offsetMinutes)` — subtracts the drag pointer offset in absolute time and rolls the date backwards when the subtraction crosses midnight.
    - `dateTimeToContinuousAbs(date, time)` — `continuousDateOffset(date) * 1440 + timeToMinutes(time)`, the continuous absolute minutes used by resize.
  - `beginBlockDrag` `move` and `up` handlers now use `resolveDropTarget` + `subtractOffsetFromDateTime` to derive both the drop date and the drop time, so dragging a 23:30 task down past midnight moves it to the next day with the same duration. `moveTimelineRecord` / `moveEventOccurrence` receive the resolved `adjusted.date`.
  - `beginBlockResize` rewritten around a `computeResize(clientX, clientY)` closure that works in continuous absolute minutes: `startAbs = dateTimeToContinuousAbs(taskAnchorDate, origStart)`, `endAbs = startAbs + origDuration`. End-edge: `newEndAbs = max(pointerAbs, startAbs + SLOT_MINUTES)`, `newDuration = newEndAbs - startAbs`, `nextEnd = addMinutes(origStart, newDuration)` (wraps mod 24h). Start-edge: `newStartAbs = min(pointerAbs, endAbs - SLOT_MINUTES)`, day-shift computed so `scheduledDate` moves back when the start crosses midnight backwards. This makes the acceptance case 4 (23:30/30m → next day 00:30 = 60m) work instead of breaking.
  - `TimeBlock` `calculatedDurationMinutes` uses `spanDurationMinutes(start, end)` and only falls back to `> 24*60` clamping for genuinely bad data, so short 15m/30m tasks still render as short blocks.

### Auto-scroll / day-prepend during drag (acceptance cases 5 & 6)

- The current timeline architecture does NOT auto-scroll during a drag and does NOT prepend days while dragging. The rendered range is fixed for the lifetime of a drag:
  - `continuousAnchorDate` is a `useMemo` derived purely from `selectedDate` (== `timelineDate`) and `timelineView`. It only changes when the user navigates dates (prev/next/today buttons, calendar picker), not when scrolling.
  - `continuousTimelineStartDate` = `continuousTimelineDates[0]`, derived from `continuousAnchorDate`. It is stable during a drag.
  - The only `onScroll` handler (line ~4085) toggles a CSS `.is-scrolling` class for scrollbar visibility; it does not call `setSelectedDate` or extend the date range.
  - `setSelectedDate` is invoked only by explicit date-navigation actions (prev/next day, today button, month cell click, pending focus from other views), never by a scroll listener.
- Therefore the premises of acceptance cases 5 ("drag while auto-scroll happens") and 6 ("prepend days while dragging upward") do not arise in this codebase. The directive's sections 5–7 are conditional ("If … triggers auto-scroll") and do not require changes here.
- Even so, the drag/resize handlers do not cache `scrollTop` or the grid `getBoundingClientRect()` at drag start: `resolveDropTarget` → `continuousPointerTarget` re-reads `gridElement.getBoundingClientRect()` on every `pointermove`, so if the user manually scrolls the timeline while dragging, `clientY - rect.top` still yields the correct content Y and the drop target keeps following the pointer.
- If a future change introduces true infinite scroll (extending the rendered range near viewport edges), the fix is to read `continuousTimelineStartDate` through a ref updated on each render (e.g. `continuousTimelineStartDateRef.current`) inside `resolveDropTarget` / `dateTimeToContinuousAbs`, and compensate `scrollTop` when the anchor shifts so existing event tops stay visually stable. The current closure-stable anchor is correct for the current fixed-range architecture.

### Verification

- `npm run test`: 16 files, 93 tests, all passing. Includes new `src/timelineGeometry.test.ts` (14 cases covering `durationMinutes` cross-midnight, `dateTimeToAbsoluteMinutes` / `absoluteMinutesToDateTime` round-trips, `snapMinutes`, `timeBlockHeight` cross-midnight, and acceptance scenarios for cases 2 and 4).
- `npm run build`: succeeds (`built in 3.95s`).

## Candidate to Timeline Drag Jump Debug

- Candidate drag start handler: `TaskCard onPointerDown` -> `onPointerDragStart` -> `beginShelfDrag(event, task, "candidate")` at `src/main.tsx` line 5760. Pure pointer-event drag (NOT HTML5 drag). Candidate `TaskCard` does NOT pass `draggable` / `onDragStart` to `TaskBlock`, so the timeline's HTML5 `onDragOver` / `onDrop` handlers do NOT fire for candidate drags.
- Timeline drag enter handler: none for candidate drag (HTML5 `onDragEnter` only fires for native draggables, which candidate rows are not).
- Timeline drag over handler: none for candidate drag (HTML5 `onDragOver` on `.df-timeline-scroll` at line 7650 only fires for native draggables). The effective "drag over" for candidate -> timeline is the pointer `move` handler inside `beginShelfDrag`, which calls `updateTarget(pointerEvent)` at line 5899.
- Timeline drop handler: the effective "drop" for candidate -> timeline is the pointer `up` handler inside `beginShelfDrag` at line 5901. It re-checks the element under the pointer (candidate row / all-day cell / candidate panel) and falls back to `scheduleTask(task.id, dropTime)` at line 5931, using `dropTime` and `dragTargetDateRef.current` captured by the last `updateTarget` call. It does NOT recompute the target from the final pointer position.
- Timeline scroll container: `.df-timeline-scroll` -> `timelineRef.current` (the scroll viewport). The inner canvas is `.df-timeline-canvas` -> `timelineCanvasRef.current` for daily view, or `.df-time-grid` -> `timeGridRef.current` for 3day/weekly.
- Current scrollTop before drag enter: not captured by `beginShelfDrag`. There is no `scrollIntoView` / `goToDate` / `jumpToDay` call inside `beginShelfDrag`.
- Current scrollTop after drag enter: `beginShelfDrag.updateTarget` (lines 5847-5848) auto-scrolls the timeline when the pointer is within 48px of the top/bottom edge of `.df-timeline-scroll`: `if (pointerEvent.clientY < rect.top + 48) scrollEl.scrollTop -= 18; else if (pointerEvent.clientY > rect.bottom - 48) scrollEl.scrollTop += 18;`. This runs on EVERY `pointermove` while the pointer is over the timeline, so the timeline drifts vertically by ~18px per move event as soon as the pointer enters the timeline region near an edge. This is the "timeline shifts vertically" / "timeline content moves unexpectedly" symptom.
- Does dragover call setCurrentDate/focusedDate: NO. `beginShelfDrag.updateTarget` does not call `setCurrentDate` / `setFocusedDate` / `goToDate` / `jumpToDay` / `setSelectedDate`. `continuousAnchorDate` / `continuousTimelineStartDate` / `continuousTimelineDates` are derived from `timelineDate` (= `selectedDate`) via `useMemo` and do NOT change during a drag.
- Does dragover call scrollIntoView: NO.
- Does dragover reset scrollTop: NO reset, but the auto-scroll at 5847-5848 continuously mutates `scrollTop` while the pointer is near the viewport edge. This is the forbidden pattern (the directive says "do NOT do `scrollTop = ...`" during candidate dragover).
- Does drop preview insertion change scroll height: NO. The preview block (`PreviewBlock` at line 7789) is absolutely positioned inside `.df-timeline-canvas` (which has a fixed `dailyTimelineCanvasHeight`), so adding/removing the preview does not change `scrollHeight`. The candidate overlay is portalled to `.df-app` and is `position: fixed`, so it does not affect timeline layout either.
- Does renderedRangeStartDate change during external drag: NO. `continuousTimelineStartDate` is a `useMemo` derived from `selectedDate` + `timelineView`, neither of which changes during a candidate drag. The only `onScroll` listener that could update `visibleTimelineDate` (line 2486) updates the all-day-row anchor, not the continuous range start, and `resolveDropTarget` re-reads `gridEl.getBoundingClientRect()` on every move so it stays correct even if the user manually scrolls.
- Root cause: TWO independent bugs in `beginShelfDrag.updateTarget` (lines 5842-5852):
  1. **Wrong coordinate resolver.** `updateTarget` calls `getDropTargetFromPointer` (line 5849), which delegates to `pointerToDateTime` in `src/timelineGeometry.ts`. `pointerToDateTime` resolves the date by X column (`date = visibleDays[dayIndex]`) and clamps the time to a single 24h day (`snapped = clamp(..., 0, 24*60 - snap)`). In continuous cross-day daily mode the canvas is 7 days tall but `pointerToDateTime` ignores Y-band, so the resolved date is wrong (picked by X within one visible column -> effectively `visibleDays[0]`-ish) and the resolved time is clamped to day 0 of the canvas. This wrong `target.date` is stored in `dragTargetDateRef.current` and the wrong `target.startTime` in `dropTime` / `hoverSlot`, so the preview block renders at `continuousTimedTop(wrongDate, wrongTime)` (a wildly off-canvas position) and `scheduleTask` on drop schedules the task on the wrong date/time. Compare with the working `beginBlockDrag` (timeline event drag) at line 4959, which correctly uses `resolveDropTarget` (date-from-Y in continuous mode).
  2. **Forbidden auto-scroll.** `updateTarget` mutates `scrollEl.scrollTop` while the pointer is near the timeline edges (lines 5847-5848). This violates the directive ("do NOT do `scrollTop = ...`" during candidate dragover) and is the direct cause of the vertical jump. `beginBlockDrag` (the working timeline event drag) does NOT auto-scroll and works fine, so removing the auto-scroll from candidate drag does not regress timeline event drag/resize.
- Fix:
  - Replace `getDropTargetFromPointer` in `beginShelfDrag.updateTarget` with `resolveDropTarget(clientX, clientY)`, which branches on `continuousTimelineEnabled` (date-from-Y band via `continuousPointerTarget` in continuous mode, date-from-X column via `getDropTargetFromPointer` otherwise). This is the same resolver `beginBlockDrag` already uses.
  - Remove the `scrollTop` auto-scroll lines (5847-5848) from `beginShelfDrag.updateTarget`. The continuous canvas already spans 7 days of vertical space, and `resolveDropTarget` re-reads `gridEl.getBoundingClientRect()` on every move, so manual wheel-scroll during a drag still yields correct targets.
  - The HTML5 `onDragOver` / `onDrop` on `.df-timeline-scroll` (lines 7650-7688) already correctly use `dailyTargetFromPointer` for continuous mode and are NOT reached by candidate drag (candidate rows are not native `draggable`), so they need no change. Leaving them untouched preserves month-view HTML5 drag.
## Time Allocation Metrics Plan

* Existing planning view architecture: `src/PlanningView.tsx` owns the Planning shell, sidebar view switcher, Linear-style filter popover, Tree/Kanban/Matrix/List surfaces, and Planning-only drag handlers. It is lazy-loaded from `src/main.tsx`.
* Where to add new Metrics view: add a `metrics` Planning view mode beside Tree/Kanban/Matrix/List in the existing sidebar switcher, rendered in the same `.df-tree-wrap` content shell rather than a modal or Execution timeline surface.
* Existing task duration fields: canonical planned duration comes from `Task.timelineRecords[]`; deprecated `scheduledDate` / `scheduledStart` / `scheduledEnd` can be read defensively as a fallback. `estimatedHours` is task effort metadata and should not drive scheduled allocation unless no schedule duration exists.
* Existing scheduled fields: `TimelineRecord.scheduledDate`, `scheduledStart`, `scheduledEndDate`, `scheduledEnd`, and `executionStatus`. Only `executionStatus === "scheduled"` records count for V1.
* Existing project color source: `Project.color`, falling back to the Planning active accent for real projects and neutral gray for unassigned or missing projects.
* Existing habit marker/source: scheduled habits are normalized into task records by `src/utils/habits.ts` with `habit-task-*` task ids and `habit-record-*` timeline record ids; `habitDailyStates[].timelineRecordId` and completion state can identify habit entries.
* Existing settings/preferences store: `Settings` is loaded/saved through `saveSettings` in `src/main.tsx` and persisted by `window.plannerApi.saveSettings`; add metrics preference fields there instead of localStorage-only state.
* Existing filter components: Planning already has a category/list filter popover and removable chips in `PlanningView.tsx`; the Metrics view should reuse that interaction language with a compact local filter panel.
* Existing date/day-start setting: `Settings.dayStartTime` defaults to `00:00` and is used by the Execution timeline. Metrics should parse it into minutes and use adjusted metric-day boundaries for ranges and heatmap buckets.
* Planned files/components: add reusable aggregation helpers under `src/metrics/` with tests, add Metrics view UI inside `PlanningView.tsx`, add quiet paper styles to `src/task-block.css`, pass metrics settings through `src/main.tsx`, and update `CHANGELOG.md`.

## Metrics Aggregation Debug

- Metrics view component: `src/PlanningView.tsx`, `viewMode === "metrics"`, calls `buildTimeAllocationMetrics()` from `src/metrics/timeAllocation.ts`.
- Task source/store: `props.data.tasks` / `props.tasks` from `src/main.tsx` after bootstrap normalization and local/cloud saves.
- Project source/store: `props.data.projects` / `props.projects`, using `Project.color` for tiny chart/list marks and neutral gray for unassigned or missing project records.
- Habit source/store: scheduled habit tasks are task records with `habit-task-*` / `habit-record-*` ids, plus `data.habitDailyStates[].timelineRecordId` for completion recognition.
- Date range calculation: `getMetricRange()` in `src/metrics/timeAllocation.ts`, using selected preset/custom dates and the current anchor date.
- Day-start setting source: `settings.dayStartTime` is passed from `src/main.tsx` into `PlanningView`, parsed by `parseDayStartMinutes()`, and applied to metric-day range and split buckets.
- Duration fields checked: timeline record `scheduledEnd - scheduledStart` first; legacy `scheduledStart` / `scheduledEnd` fallback when no `timelineRecords` exist; recurrence `durationMinutes` for generated scheduled occurrences.
- Scheduled fields checked: `Task.timelineRecords[]`, legacy task scheduled fields, and scheduled recurrence rules (`recurrence.mode === "scheduled"`, `startDate`, `startTime`, `durationMinutes`).
- Current filters applied: range, groupBy, habit mode, completion filter, and explicit project filter. The helper now logs dev-only `console.table` rows for each candidate record with `included` and `excludeReason`.
- Reason tasks are missing: Metrics previously counted only `timelineRecords` whose `executionStatus` was exactly `"scheduled"` and did not expand recurrence-only scheduled occurrences. The Execution timeline renders all non-cancelled timeline records plus scheduled recurrence occurrences blocked only by exception dates, so completed/returned timeline blocks and recurrence-generated blocks could be visible on the timeline but missing from Metrics.
- Fix: include all non-cancelled timeline records, expand scheduled recurrence occurrences for dates in the selected metric range, respect cancellation/exception records as blockers, keep timer records unused, and preserve cross-day overlap splitting after range clamping.

## Desktop Widget Environment

- Current runtime: **Electron 37** desktop app. `package.json` declares `"main": "electron/main.cjs"`; main process is `electron/main.cjs` (1247 lines), preload is `electron/preload.cjs` (25 lines). Renderer is Vite 7 + React 19 loaded from `index.html` → `src/main.tsx`. The same renderer bundle can also run as a pure web app (dev server `127.0.0.1:5173` / fallback `navopath-xiaoyang.pages.dev`), but the shipping product is the Electron build (`electron-builder` win nsis + portable).
- Is real OS-level always-on-top supported: **Yes** — Electron `BrowserWindow({ alwaysOnTop: true })` is available. No existing widget/always-on-top code in `electron/main.cjs` or `electron/preload.cjs` prior to this feature. A design spec existed at `docs/superpowers/plans/2026-07-01-productivity-upgrade.md` Task 13 but was unimplemented.
- If Electron exists: widget is a **real separate `BrowserWindow`** with `alwaysOnTop: true`, `frame: true`, `resizable: true`, default 320×220, loaded from the same `index.html` with `?widget=1` query param. The renderer detects `?widget=1` and mounts `WidgetApp` instead of the full `App`, so the widget window never boots Supabase auth / full data load — it is a pure IPC client.
- State sync architecture: the widget window is a **separate renderer process** and cannot share React state with the main window. Sync is via an **IPC relay through the main process**:
  - Widget → main process → main window: action requests (`widget:action` channel) — quickAdd / timerStart / timerPause / timerResume / timerStop / complete / requestSnapshot.
  - Main window → main process → widget: snapshot pushes (`widget:push-snapshot` → `widget:snapshot`). The main window builds a `WidgetSnapshot` from its live React state (`timerTask`, `timerRunning`, `timerElapsed`, `headerTask`) and pushes it whenever relevant state changes and on every action. The widget ticks elapsed locally each second for smooth display and reconciles on each incoming snapshot.
  - The widget holds NO independent task data — it never reads `PlannerData` directly. All truth stays in the main window's React store (`saveData`/`saveSettings` double-write localStorage + Supabase is untouched).
- If web-only fallback: when `window.desktopApi` is absent (pure browser), the widget entry button is hidden and no widget window is created. The IPC surface is simply never called. A future in-app floating widget for the web build is possible but out of scope for this version.
- Window position memory: the widget reads/writes `localStorage["navopath-widget-position"]` (x, y, width, height). Because the widget loads from the same origin as the main window, both share the same localStorage; the widget restores position on mount and saves on `moved`/`resized` debounce. A "reset position" action clears the key and re-centers.
- Impact on existing code: changes are additive — new `BrowserWindow` factory + IPC handlers in `electron/main.cjs`, new `widget` surface in `electron/preload.cjs`, new `WidgetApp` component + `?widget=1` route guard in `src/main.tsx`, new types in `src/types.ts`, new entry button in the candidate panel header (guarded by `Boolean(window.desktopApi)`), new settings toggles in the Features section, and new CSS in `src/task-block.css`. No existing timer/quickAdd/complete logic is rewritten — the main window's action listener calls the existing `quickAddTask`/`startTimer`/`pauseTimer`/`resumeTimer`/`stopAndSaveTimer`/`toggleTaskDone` functions by reading refs to current state.
- Rollback: revert the commit; the feature is fully behind `Boolean(window.desktopApi)` and `?widget=1`, so removing it restores prior behavior with no migration.

## Timeline Infinite Upward Scroll & Now-Line Debug

Two independent timeline bugs reported:
1. With continuous cross-day scroll **enabled**, scrolling **up** does not infinitely load previous days (only the fixed centered window is reachable; the top edge is a hard stop).
2. With continuous cross-day scroll **disabled**, the now-line does not display / is mispositioned in day / 3-day / week views.

### Root cause — Bug 1 (no infinite upward scroll)

- `src/utils/continuousTimeline.ts` `buildDailyContinuousDates(anchorDate, enabled, dayCount)` builds a **fixed centered window**: for daily it returns 7 days (3 before + anchor + 3 after); for 3-day 21 days; for weekly 49 days. The window size is constant and never grows.
- `continuousAnchorDate` (main.tsx :3271) derives from `timelineDate` (= `selectedDate`): daily → `timelineDate`; weekly → start-of-week of `timelineDate`.
- `continuousTimelineDates` (main.tsx :3275) = `buildDailyContinuousDates(continuousAnchorDate, true, 7 * timelineColumnCount)`. So the window is centered on `selectedDate` and only moves when `selectedDate` moves.
- The scroll listener (main.tsx :2664-2687) only calls `setVisibleTimelineDate(nextDate)` to update the **header label**. It never shifts `selectedDate` and never prepends/appends bands. Reaching the top of the 7-band canvas is a hard stop.
- Only **month view** (main.tsx :7822-7836) has real prepend/append: when `scrollTop < 160` it shifts `selectedDate` back 140 days and captures an anchor offset; a `useLayoutEffect` (:1808-1822) restores `scrollTop` by the anchor delta after re-render. Day / 3-day / week continuous views have no equivalent.

### Fix — Bug 1 (port month-view prepend/append pattern)

- Add `continuousScrollRestoreRef` (records `oldScrollTop` + `shiftBands` before the window shift) and `continuousPrependLockRef` (prevents re-entry while a shift is in flight).
- In the existing scroll listener, after the header-date update, detect edge proximity:
  - Near top (`scrollTop < dayHeight`): prepend by shifting `selectedDate` back by `bufferBands * columnCount` days. For a centered window this inserts `bufferBands` new bands at the top and drops `bufferBands` bands at the bottom; `scrollHeight` is unchanged. To keep the viewport stable, `newScrollTop = oldScrollTop + bufferBands * dayHeight`.
  - Near bottom (`scrollTop + clientHeight > scrollHeight - dayHeight`): append by shifting `selectedDate` forward by `bufferBands * columnCount` days. This inserts bands at the bottom and drops bands at the top; `scrollHeight` unchanged. `newScrollTop = oldScrollTop - bufferBands * dayHeight`.
  - `bufferBands = max(1, floor(bandCount / 4))` so after each shift the viewport sits comfortably mid-window and does not immediately re-trigger.
- A `useLayoutEffect` keyed on `[selectedDate, timelineView]` consumes `continuousScrollRestoreRef`, applies the compensated `scrollTop`, and releases the prepend lock. Runs only for day/3-day/week continuous mode (guarded by `continuousTimelineEnabled` and `timelineView !== "month"`).
- All-day tasks, candidate drop, drag/resize, and `continuousTimedTop` are unaffected — they derive from `continuousTimelineDates` / `continuousTimelineStartDate`, which already recompute when `selectedDate` changes.

### Root cause — Bug 2 (now-line missing when infinite scroll OFF)

- `NowLine` (main.tsx :10495-10505) computes the correct `top` via `timeBlockTop(nowTime, dayStartHour)` and merges styles as `style={{ top, ...extraStyle }}`.
- Both render sites pass `extraStyle.top = continuousTimelineEnabled ? continuousTimedTop(today, now) : undefined`. In non-continuous mode `extraStyle.top === undefined`.
- JS object spread `{ top, ...extraStyle }` lets `extraStyle.top === undefined` **overwrite** the computed `top` with `undefined`. React then omits the inline `top` entirely, so the absolutely-positioned `.df-now-line` falls back to static-flow position (top:auto), rendering at the canvas top or not visibly at the current time.
- `dayStartHour` is already passed at both render sites (daily :8132, 3-day/week :7742), so the computed `top` is correct when not clobbered. The only defect is the merge.

### Fix — Bug 2 (don't let undefined clobber computed top)

- In `NowLine`, build the merged style explicitly: `const merged = { ...extraStyle }; if (merged.top === undefined) merged.top = top;` then `style={merged}`. When continuous mode supplies a `top` it wins; when non-continuous mode omits it, the internally computed `top` (day-start aware) is used.
- No change needed at the render sites — they already pass `dayStartHour` and the guard `continuousTimelineDates.includes(today)` ensures the now-line only renders when today is in the visible range.

### Acceptance criteria mapping

- [1] Infinite cross-day scroll enabled: scrolling up past the first band prepends earlier dates and the viewport does not jump. → prepend branch + `useLayoutEffect` scrollTop compensation.
- [2] Scrolling down past the last band appends later dates and the viewport does not jump. → append branch.
- [3] `continuousTimelineDates` / `continuousTimelineStartDate` recompute after each shift (existing useMemo, no change).
- [4] Drag / resize / candidate drop still use `continuousTimedTop` and `continuousPointerTarget` against the recomputed start date (no change).
- [5] Now-line visible in day view with infinite scroll OFF when viewing today. → NowLine merge fix.
- [6] Now-line visible in 3-day / week view with infinite scroll OFF when today is in the window. → same merge fix.
- [7] Now-line respects `dayStartHour` (already passed; merge fix stops the clobber).
- [8] Now-line position uses `continuousTimedTop` in continuous mode (extraStyle.top supplied by render site).
- [9] Back-to-now re-centers today and current time (`goToNow` sets `selectedDate` + `pendingTimelineFocus`; unaffected).
- [10] Task card visuals, candidate shelf, planning page unchanged (no edits to those code paths).
- [11] Month view unaffected (prepend/append guard excludes `timelineView === "month"`).
- [12] No new CSS; `.df-now-line` absolute positioning unchanged.

### Manual test plan

- Daily view, infinite scroll ON: scroll up repeatedly — header date follows, no hard stop at top; scroll down repeatedly — same at bottom; now-line stays at current time when today is in window.
- Daily view, infinite scroll OFF: view today — now-line visible at current time respecting day-start; switch day — now-line hidden (today not in [timelineDate]).
- 3-day view, infinite scroll OFF: today in window — now-line in today's column at correct time; infinite scroll ON — now-line tracks continuous coordinate.
- Week view: same as 3-day.
- Drag a task across the prepend boundary — lands on correct date/time.
- Resize a task across the append boundary — duration correct.
- Back-to-now after scrolling away — recenters.
- Month view — scroll still prepends/appends weeks as before.

## Template Entry Debug

Real entry path traced (root cause of "UI did not change"):

- 今日候选顶栏组件：`src/main.tsx` `df-panel-title` header inside the candidate panel (`<div className="df-panel-title"><h2>...`), around line 7152. The toolbar row holds the candidate-panel collapse / show-completed / group-by-project / **template** / widget / AI buttons.
- "模板/模版"按钮位置：`src/main.tsx:7160` `<button className="df-icon-action df-icon-template" data-tip="日程模版" onClick={() => setScheduleTemplateOpen(true)}>`. It is the calendar-grid SVG icon button, the ONLY template entry in the execute page.
- 点击后调用的 handler：`setScheduleTemplateOpen(true)` — flips the `scheduleTemplateOpen` state declared at `src/main.tsx:1852`.
- 打开的 modal/component：`src/main.tsx:8327-8336` `{scheduleTemplateOpen && data && (<ScheduleTemplateModal ... onApply={applyTemplateToDate} onClose={() => setScheduleTemplateOpen(false)} />)}`. Rendered via `createPortal` into `#df-portal-target`.
- 当前旧表格 UI component：`ScheduleTemplateModal` function defined at `src/main.tsx:8448-8831`. It renders the old table-style editor: a tab row of built-in + custom templates, a name input + "恢复当前模板" / "新增 Period" / "保存为模板" / "删除模板" toolbar, a custom-template manager list, and a `df-template-slots` list where each row has a "加入当天" checkbox, label input, start/end time inputs, "当天目标（可选）" input, and a remove button. Footer has "取消" + "应用到当天".
- Previously edited component, if different: none in this repo's working history — the old `ScheduleTemplateModal` is the only template modal wired to the candidate toolbar. Any prior "template mode" work that did not touch this exact function/body would not affect what the user sees from this entry.
- Root cause why UI did not change：the old `ScheduleTemplateModal` (8448-8831) was never replaced. To change what the user sees, this exact component must be rewritten in place (same function name, same props contract) OR the render site at 8327 must point at a new component. The data contract (`ScheduleTemplate` / `ScheduleTemplateSlot` in `src/types.ts:247-260`, `applyTemplateToDate` at 3916, `ScheduleTemplateApplySlot` at 347) must be preserved so existing saved templates and the apply-to-day flow keep working.

### Redesign plan (replaces the old table UI in place)

- Rewrite `ScheduleTemplateModal` body to a two-pane layout: left narrow template list (built-in 默认 1 / 默认 2 + custom templates + "+ 新建模板"), right template timeline editor that visually mirrors the execution timeline (same slot grid, same hour height, click-blank-to-create, drag-to-move, resize-to-change-duration, click-to-rename, delete).
- Keep the props signature unchanged: `lang, date, tasks, customTemplates, onSaveCustomTemplates, onApply, onClose`.
- Keep `applyTemplateToDate` and `ScheduleTemplateApplySlot` unchanged — the new modal still calls `onApply(applySlots, conflictCount)` with `{title, start, end}[]`.
- Keep `ScheduleTemplate` / `ScheduleTemplateSlot` types unchanged — saved templates continue to store `{id, label, start, end}[]`.
- Internal draft state changes from `ScheduleTemplateDraftSlot` (checkbox + label + start + end + title) to a lighter `TemplatePeriod` draft `{id, title, startMinutes, durationMinutes}`. Convert to `{label, start, end}` only when saving, and to `{title, start, end}` only when applying.
- Conflict detection reuses the existing `existingIntervals` memo (intervals from `tasks.timelineRecords` + `task.scheduledDate` on `date`) and the same `start < item.end && end > item.start` overlap test. Default behavior on Apply: skip conflicting periods, surface a confirmation notice.
- Remove the old table UI: no "加入当天" checkbox column, no "当天目标" column, no "新增 Period" toolbar button, no "恢复当前模板" toolbar button, no spreadsheet slot rows. The new modal is the only thing rendered from `scheduleTemplateOpen`.
- CSS: reuse `df-template-modal-backdrop`, `df-template-modal`, `df-template-modal-head`, `df-template-close` shell classes (already defined). Add new classes only for the two-pane body (`df-template-split`, `df-template-list`, `df-template-timeline`) inside `src/app-redesign.css`, scoped under `.df-app`.
- Regression guard: no edits to `applyTemplateToDate`, `createScheduledRecord`, `makeTask`, `defaultForm`, the candidate shelf, execution timeline, drag/resize, infinite scroll, now-line, or metrics.

## Template Redesign Scope (v2 — unify to candidate + timeline language)

- actual template entry component: `ScheduleTemplateModal` at `src/main.tsx:8450`, opened via `setScheduleTemplateOpen(true)` from the candidate top-bar 模板 button at line 7162. Render site: lines 8327-8336 via `createPortal`.
- left panel reused components/classes: candidate panel top-bar language (`div.df-panel-title` + `<h2>` + `button.df-icon-action` group at line 7154), candidate list scroll container (`div.df-candidate-list` at line 7236), candidate row rhythm (`df-candidate-task-row`), `df-empty` placeholder. NOT reusing `TaskCard`/`TaskBlock` for template rows because a template is not a Task; instead template rows reuse the same row rhythm + fine separators + paper styling as candidate rows via shared classes (`df-candidate-task-row`, `df-candidate-task-title`, `df-candidate-task-meta`). "新建" entry is a list row matching candidate-card language (not a bottom form).
- right timeline reused components/classes: execution single-day timeline structure — `df-timeline-daily` (line 7979), `df-date-title` (line 7980, repurposed to show template name instead of a date), `df-timeline-scroll` (line 8033), `df-timeline-canvas` (line 8072), `df-slot.hour/quarter/major` hour grid (line 8164-8170), `df-time-block`-style period blocks. TimeBlock/TaskBlock components are NOT reused directly because a period is not a Task (no checkbox, no project, no done state); the period block reuses `df-time-block` className + `TaskBlock as="div" variant="scheduled" appearance="calm"` so it reads as the same annotated-time-region language but with period-only content (title + time range). Drag/resize/move/create interactions stay pointer-based, mirroring `beginBlockDrag`/`beginBlockResize` behavior but operating on TemplatePeriod draft state instead of real tasks. No NowLine (templates are date-less).
- old template UI pieces removed: `df-template-modal-head` big title/description block, `df-template-tabs` tab row, `df-template-note` bottom input stack, `df-template-manager*` list, `df-template-slots`/`df-template-slot*`/`df-template-check` spreadsheet rows, `df-template-slot-meta`, `df-template-goal`, `df-template-list*` v2 list classes (replaced by candidate-row classes), `df-template-timeline-toolbar` hint text, `df-template-timeline-hint` instruction line, `df-template-period*` v1 classes (replaced by df-time-block language). Kept: `df-template-modal-backdrop`, `df-template-modal` shell, `df-template-close`, `df-template-modal-actions` footer (取消/应用到今天). All `df-template-list*`, `df-template-timeline*`, `df-template-period*` v1/v2 CSS rules deleted.
- new apply flow: unchanged contract — `onApply(applySlots: ScheduleTemplateApplySlot[], conflictCount: number)`. Conflicts detected against existing scheduled intervals on `date` (timelineRecords + tasks with scheduledDate===date); conflicting periods skipped by default, conflict count surfaced in footer notice. `applyTemplateToDate` at line 3916 is untouched.
- unresolved risks: (1) template rows mimic candidate rows but are not real TaskBlocks — selection/active state uses `data-active` attribute instead of TaskBlock's `selected` prop to avoid implying task semantics. (2) period blocks use `df-time-block` className for visual consistency but omit project/done/checkbox chrome; if global `.df-time-block` CSS expects child checkboxes it may render empty space — verified CSS only styles border/fill/typography, not mandatory children. (3) no drag-reorder of template list in v2 (would need a separate DnD system); template order follows insertion order in `customTemplates` array.

## Template Direct Reuse Audit

### Execution layout
- execution page root: inline JSX `<main className="df-execute">` at `src/main.tsx:7102`. The grid shell is the CSS class `.df-execute` (`src/styles.css:16135`: `display:grid; grid-template-columns: minmax(320px,410px) minmax(0,1fr); gap:20px; height:calc(100vh - 64px)`). NOT a standalone component — the whole execution page is inline JSX in `App`.
- left candidate panel component: inline JSX `<section className="df-candidate-panel">` at `src/main.tsx:7130`. Children: collapsed strip (7143), `df-panel-title` header (7154), active task chip (7188), `df-candidate-list` (7236) with `TaskCard` items, `HabitCandidateCard` (7289), `df-quick-add` form (7303). Panel styling comes from `.df-candidate-panel` CSS (border, radius, surface, padding).
- right timeline component: inline JSX `<section className="df-timeline-panel">` at `src/main.tsx:7328`. Two branches: multi-day (7416) + single-day daily (7979). Single-day branch renders `df-timeline-scroll` (8033) + `df-timeline-canvas` (8072) + `df-slot.hour` grid (8164) + `TimeBlock` event blocks.
- shared timeline canvas: the `df-timeline-scroll` (scroll container, ref=timelineRef) + `df-timeline-canvas` (positioned canvas, ref=timelineCanvasRef, style height) + `df-slot.hour` (hour labels at `top: hour*4*SLOT_HEIGHT`) structure. Repeated in BOTH execution daily branch (8033-8072) and template modal (8972-8974). This is the structure to extract as `TimelineCanvasShell`.
- task block component: `TaskBlock` at `src/components/TaskBlock.tsx` (shared). `TaskCard` (9893) composes `<TaskBlock variant="candidate">`; `TimeBlock` (10464) composes `<TaskBlock variant="scheduled">`.
- timeline event block component: `TimeBlock` function component at `src/main.tsx:10464` — composes `<TaskBlock as="div" variant="scheduled" appearance="calm">`.
- timeline drag/resize module: inline closures `beginBlockDrag` (5253) + `beginBlockResize` (5441) in `App`, deeply coupled to App state. NOT extractable without high regression risk.
- current layout wrapper: `.df-execute` CSS grid (the 2-column shell). This is the single source of truth for execution-page column widths, gap, padding, height.

### Current template modal
- component opened by 今日候选顶栏"模板": `setScheduleTemplateOpen(true)` from candidate top-bar 模板 button at `src/main.tsx:7162` → renders `<ScheduleTemplateModal>` via `createPortal` at 8330.
- current left panel component: inline JSX `<aside className="df-template-candidate">` at `src/main.tsx:8887`. Uses reused `df-panel-title` + `df-candidate-list` + `df-candidate-task-row` classes BUT wrapped in a CUSTOM `df-template-candidate` aside (not the real `df-candidate-panel` section).
- current timeline component: inline JSX `<div className="df-template-timeline-panel">` at `src/main.tsx:8949`. Wraps `df-timeline-daily` + `df-date-title` (big title) + `df-timeline-allday` (template name input) + `df-timeline-scroll` + `df-timeline-canvas` + `df-slot.hour` + period blocks. NOT the real `df-timeline-panel` section.
- custom duplicated layout: (1) `df-template-split` at 8885 — a CUSTOM 2-col grid (`grid-template-columns: 260px minmax(0,1fr)`, CSS line 4514) that imitates but does NOT match `.df-execute` (`minmax(320px,410px) minmax(0,1fr)`). (2) `df-template-candidate` aside (8887) — CUSTOM left panel, not `.df-candidate-panel`. (3) `df-template-timeline-panel` div (8949) — CUSTOM right panel, not `.df-timeline-panel`. (4) `df-template-modal-v2` (8877) — CUSTOM modal chrome with `grid-template-rows: minmax(0,1fr) auto auto` (CSS 4509). (5) big `df-date-title` + `df-timeline-allday` title region (8951-8970).
- custom duplicated CSS: `df-template-modal-v2` (4509), `df-template-split` (4514), `df-template-candidate` (4523-4540), `df-template-timeline-panel` (4634-4704), plus `df-template-modal` (4427) / `df-template-modal-head` (4443) / `df-template-modal h2` (4462) legacy title CSS.

### Reuse plan (v5 — direct layout shell reuse, not CSS imitation)
- which execution layout component will be reused:
  1. `ExecutionLayoutShell` — NEW thin component rendering `<main className="df-execute">` (the real execution grid). Execution page wraps its existing content in `<ExecutionLayoutShell>`. Template modal replaces `df-template-split` with `<ExecutionLayoutShell>`. Guarantees identical column widths, gap, padding, height.
  2. `df-candidate-panel` section class — template modal replaces `<aside className="df-template-candidate">` with `<section className="df-candidate-panel">`. Real panel border/radius/surface/padding from the same CSS rule (app-redesign.css:115-121).
  3. `df-timeline-panel` section class — template modal replaces `<div className="df-template-timeline-panel">` with `<section className="df-timeline-panel">`. Real panel styling.
  4. `TimelineCanvasShell` — NEW component rendering `df-timeline-scroll` + `df-timeline-canvas` + `df-slot.hour` grid. Both execution daily branch and template modal use it. Execution passes its complex drag/drop handlers as props; template passes its pointer handlers.
  5. `TaskBlock variant="scheduled"` — already reused for period blocks (v4). Kept.
- which props/mode will be added: `ExecutionLayoutShell` takes `children` + `className` (NOT `left`/`right` — using `children` lets the execution page keep its compact-controls/tabs between the panels with zero DOM change; the template modal just passes its two sections as children). `TimelineCanvasShell` takes `scrollRef`, `canvasRef`, `height`, `canvasClassName`, scroll/canvas pointer + drag handlers, and `children`. No `mode` prop needed — the shell is mode-agnostic; differences live in the children and handlers passed by each caller. NOTE: the execution daily branch's inline `df-timeline-scroll`/`df-timeline-canvas` (8033-8072) was LEFT INLINE because it has a 90+ line `onMouseDown` drag-create handler too risky to refactor — it still renders the same CSS classes so the container primitive is shared even though the JSX isn't; only the template modal uses `<TimelineCanvasShell>` directly.
- which features will be hidden in template mode: (1) no `df-date-title` big title — template name moves into the candidate-panel header subtitle or a compact in-panel label. (2) no `df-timeline-allday` template-name row — name editing moves into the candidate panel (selected row) or a small header inside `df-timeline-panel`. (3) no NowLine, no infinite cross-day scroll, no all-day row, no date header — template is date-less. (4) candidate panel hides: active task chip, AI planner, habit section, quick-add form — only the header + template list + new-template row remain.
- CSS deletion targets: `df-template-modal-v2` (4509-4512), `df-template-split` (4514-4520), `df-template-candidate` (4523-4540), `df-template-timeline-panel` (4634-4704), `df-template-modal`/`df-template-modal-head`/`df-template-modal h2` legacy title CSS (4427-4471). Keep: `df-template-modal-backdrop`, `df-template-close`, `df-template-modal-actions` footer, `df-template-period-block` period-specific rules (resize dots, title input, delete btn), `df-candidate-task-row` shared rules.

## Template Code Reuse Proof

### Actual template entry
- User clicks: 执行页 → 今日候选顶栏 → 模板
- The actual handler is: `setScheduleTemplateOpen(true)` at `src/main.tsx:7162` (onClick of the `df-icon-template` button in the candidate panel header)
- The actual component opened is: `<ScheduleTemplateModal>` rendered via `createPortal` at `src/main.tsx:8330`
- The old template component file is: `ScheduleTemplateModal` function at `src/main.tsx:8450` (single file, no separate component file)

### Execution page actual components
- Execution page root: `<ExecutionLayoutShell>` (shared component, `src/main.tsx:12824`) wrapping `<main className="df-execute">` grid. Children passed inline.
- Left candidate panel component: INLINE JSX `<section className="df-candidate-panel">` at `src/main.tsx:7130`. NOT a standalone component — rendered inline in `App`.
- Candidate panel shell/container: the `df-candidate-panel` CSS class (border/radius/surface/padding from `app-redesign.css:115-121`). No `CandidatePanelShell` component exists.
- Candidate panel header: INLINE JSX `<div className="df-panel-title"><h2>...</h2><div>{buttons}</div></div>` at `src/main.tsx:7154`. No `CandidatePanelHeader` component exists.
- Candidate card/block component: `TaskCard` function component at `src/main.tsx:9926`. Composes `<TaskBlock variant="candidate">` (shared component from `src/components/TaskBlock.tsx`).
- Timeline root component: INLINE JSX `<section className="df-timeline-panel">` at `src/main.tsx:7328`. NOT a standalone component.
- Timeline scroll container: INLINE JSX `<div className="df-timeline-scroll" ref={timelineRef}>` at `src/main.tsx:8033` (daily branch). NOT wrapped in `TimelineCanvasShell` — the shell component exists at line 12847 but the execution daily branch does NOT use it.
- Timeline grid/hour lines: INLINE JSX `df-slot.hour` divs rendered as children of `df-timeline-canvas` at `src/main.tsx:8164`.
- Timeline event block: `TimeBlock` function component at `src/main.tsx:10497`. Composes `<TaskBlock as="div" variant="scheduled" appearance="calm">`.
- Timeline drag/resize logic: INLINE closures `beginBlockDrag` (5253) + `beginBlockResize` (5441) in `App`, deeply coupled to App state (drag, resizePreview, timelineRef, settings, dayStartHour, etc.).

### Current template components
- Template modal root: `<ScheduleTemplateModal>` at `src/main.tsx:8450`. Uses `<ExecutionLayoutShell className="df-template-shell">` (shared).
- Template left panel: INLINE JSX `<section className="df-candidate-panel">` at `src/main.tsx:8884`. Same CSS class as execution but NOT a shared component — inline JSX.
- Template list item: INLINE JSX `<div className="df-candidate-task-row">` at `src/main.tsx:8896`. NOT `TaskCard`, NOT `TaskBlock`, NOT `CandidateBlock` — a custom `df-candidate-task-row` flex row with its own CSS.
- Template timeline: INLINE JSX `<section className="df-timeline-panel">` at `src/main.tsx:8946` + `<TimelineCanvasShell>` at `src/main.tsx:8965` (shared container component). Hour grid + period blocks passed as children.
- Template period block: INLINE JSX wrapping `<TaskBlock as="div" variant="scheduled" className="df-template-period-block">` at `src/main.tsx:8985`. Uses shared `TaskBlock` but with custom JSX for resize dots / body / delete button. NOT `TimeBlock`, NOT `TimelineEventBlock`.
- Template drag/resize logic: INLINE closure `beginPeriodDrag` inside `ScheduleTemplateModal`. NOT shared with execution's `beginBlockDrag`/`beginBlockResize`.

### Reuse status (pre-refactor, commit 1f9a942)
- Template uses execution layout shell: **YES** — `<ExecutionLayoutShell>` wraps both execution page and template modal.
- Template left panel uses candidate panel shell: **NO** — both use the same `df-candidate-panel` CSS class, but there is no `CandidatePanelShell` component; both render inline `<section>` JSX independently.
- Template template item uses candidate card/block visual primitive: **NO** — template uses `df-candidate-task-row` (custom flex row); execution uses `TaskCard` (composes `TaskBlock variant="candidate"`). Different DOM, different CSS, different visual language.
- Template timeline uses execution timeline root/shared canvas: **NO** — `TimelineCanvasShell` component exists and template uses it, but execution daily branch has inline `df-timeline-scroll`/`df-timeline-canvas` JSX and does NOT use the shell component. The container JSX is NOT shared.
- Template period block uses execution scheduled block: **PARTIAL** — template uses `TaskBlock variant="scheduled"` (shared component) but wraps it in custom JSX (resize dots, body, delete button). Execution uses `TimeBlock` which composes the same `TaskBlock`. The primitive is shared but the block composition is NOT.
- Template drag/resize uses shared timeline interaction logic: **NO** — template has its own `beginPeriodDrag` closure; execution has `beginBlockDrag`/`beginBlockResize`. Separate code.

### Reuse plan (v6 — real shared components, not CSS imitation)
1. Extract `CandidatePanelShell` component — renders `<section className="df-candidate-panel">`. Both execution and template wrap their panel content in it.
2. Extract `CandidatePanelHeader` component — renders `<div className="df-panel-title"><h2>{title}</h2><div>{actions}</div></div>`. Both use it.
3. Extract `CandidateBlock` component — renders a list-row through `TaskBlock variant="candidate"`. Template items use `<CandidateBlock mode="template">`. Execution's `TaskCard` already composes `TaskBlock variant="candidate"` — same primitive.
4. Rename `TimelineCanvasShell` → `TimelineCanvas` and make execution daily branch use it too (wrap inline `df-timeline-scroll`/`df-timeline-canvas` in the component, passing existing inline handlers as props).
5. Extract `TimelineEventBlock` component — renders a scheduled block through `TaskBlock variant="scheduled"` with resize dots + body + optional delete. Template period blocks use `<TimelineEventBlock mode="template">`. Execution's `TimeBlock` already composes the same `TaskBlock` — same primitive.
6. Template modal uses `CandidatePanelShell` + `CandidatePanelHeader` + `CandidateBlock` + `TimelineCanvas` + `TimelineEventBlock`.
7. Execution page uses `CandidatePanelShell` + `CandidatePanelHeader` + `TimelineCanvas` (low-risk mechanical extraction).
8. Drag/resize: template keeps its own `beginPeriodDrag` (documented as NOT shared — template drag operates on draft periods, not real tasks; sharing execution's task-coupled `beginBlockDrag` would pollute the data boundary). The `TimelineAdapter<T>` interface is the shared contract; both adapters implement it.

### Reuse status (post-refactor v6 — real shared components)
- Template uses execution layout shell: **YES** — `<ExecutionLayoutShell>` wraps both execution page and template modal.
- Template left panel uses candidate panel shell: **YES** — `<CandidatePanelShell>` renders `<section className="df-candidate-panel">` for both execution page (`src/main.tsx:7130`) and template modal (`src/main.tsx:8884`). Same component.
- Template template item uses candidate card/block visual primitive: **YES** — template items use `<CandidateBlock mode="template">` / `<CandidateBlock mode="template-new">`, which render through `<TaskBlock variant="candidate">` — the same primitive `TaskCard` composes on the execution page. The old `df-candidate-task-row` custom rows are gone.
- Template timeline uses execution timeline root/shared canvas: **YES** — `<TimelineCanvas>` (renamed from `TimelineCanvasShell`) is now used by BOTH the execution daily branch (`src/main.tsx:8038`) and the template modal (`src/main.tsx:8968`). The inline `df-timeline-scroll`/`df-timeline-canvas` JSX in the execution daily branch is gone; the container component is shared. Added `onCanvasClick` prop to the component contract so the execution daily branch's blank-click → floating-time-add handler passes through unchanged.
- Template period block uses execution scheduled block: **YES** — template period blocks use `<TimelineEventBlock mode="template">`, which renders through `<TaskBlock variant="scheduled">` with resize dots + body + optional delete. Execution's `TimeBlock` composes the same `TaskBlock`. The primitive AND the block composition (resize dots / body / delete) are now shared via `TimelineEventBlock`.
- Template drag/resize uses shared timeline interaction logic: **PARTIAL (by design)** — template keeps its own `beginPeriodDrag` closure because it operates on draft periods, not real tasks; sharing execution's task-coupled `beginBlockDrag`/`beginBlockResize` would pollute the data boundary. The `TimelineAdapter<T>` interface is the shared contract; `templatePeriodAdapter` and the execution scheduled-task adapter both implement it. This is an intentional data-isolation boundary, not a missed reuse.

## Template Reuse Acceptance
- Clicking 今日候选顶栏"模板" opens new component: **yes** — `setScheduleTemplateOpen(true)` opens `<ScheduleTemplateModal>` which renders `<ExecutionLayoutShell>` + `<CandidatePanelShell>` + `<CandidateBlock>` + `<TimelineCanvas>` + `<TimelineEventBlock>`.
- Left shell component is CandidatePanelShell: **yes** — template modal left panel is `<CandidatePanelShell>`, same component as execution page.
- Left width equals 今日候选: **yes** — both render `<section className="df-candidate-panel">` via the same component; width comes from the shared CSS rule.
- Left header equals 今日候选 header: **yes** — both use `<CandidatePanelHeader title={...} actions={...}>`.
- Template items use CandidateBlock: **yes** — template list items are `<CandidateBlock mode="template">` / `<CandidateBlock mode="template-new">`; the old `df-candidate-task-row` is removed.
- Timeline component is shared TimelineCanvas: **yes** — both execution daily (`src/main.tsx:8038`) and template modal (`src/main.tsx:8968`) use `<TimelineCanvas>`.
- Timeline grid equals execution timeline: **yes** — both pass hour/slot grid as children of the same `<TimelineCanvas>` container; grid CSS is shared.
- Period block uses TimelineEventBlock: **yes** — template period blocks are `<TimelineEventBlock mode="template">`; the inline `TaskBlock` wrapper JSX is removed.
- Old template UI texts are gone: **yes** — `模板模式`, `选择固定时间节点`, `新增 Period`, `恢复当前模板`, `保存为模板`, `加入当天`, `当天目标` no longer appear in the UI.
- Template editing does not write real task store: **yes** — template edits operate on draft `TemplatePeriod[]` state via `templatePeriodAdapter`; the real task store is untouched until "应用到今天".
- Applying template creates real scheduled tasks: **yes** — "应用到今天" calls `applyTemplateToDate` which writes real scheduled records for the selected date.

## Template Actual Reuse Proof

This section proves reuse via real ES-module `import` statements, not by being in the same file scope. The shared components live in their own module file and are imported by the file that renders BOTH the execution page and the template modal.

### Actual entry
- User clicks: 今日候选顶栏 → 模板
- Handler: `setScheduleTemplateOpen(true)` (onClick of the `df-icon-template` button in the candidate panel header in `src/main.tsx`)
- Component opened: `<ScheduleTemplateModal>` rendered via `createPortal` inside `App` in `src/main.tsx`
- File path: `src/main.tsx` (single file contains both `App` and `ScheduleTemplateModal`; both import from the shared module)

### Execution page actual components (exact file paths + exported names)
- Execution page root: `App` in `src/main.tsx` — renders `<ExecutionSplitLayout>` (imported)
- Execution split layout / page shell: `ExecutionSplitLayout` exported from `src/components/ExecutionSharedLayout.tsx`
- Today candidate panel: `CandidatePanelShell` exported from `src/components/ExecutionSharedLayout.tsx` (used inline in `App`)
- Candidate panel header: `CandidatePanelHeader` exported from `src/components/ExecutionSharedLayout.tsx`
- Candidate list scroll area: children of `CandidatePanelShell` in `App` (the panel's own scroll)
- Candidate task block: `TaskCard` in `src/main.tsx` (composes `TaskBlock variant="candidate"` from `src/components/TaskBlock.tsx`); template items use the shared `CandidateBlock` primitive which composes the same `TaskBlock variant="candidate"`
- Execution timeline: inline `<section className="df-timeline-panel">` in `App`, whose scroll container is `<TimelineCanvas>` (imported)
- Timeline scroll container: `TimelineCanvas` exported from `src/components/ExecutionSharedLayout.tsx`
- Timeline hour grid: children of `TimelineCanvas` in `App` (`df-slot` divs)
- Timeline event block: `TimeBlock` in `src/main.tsx` (composes `TaskBlock variant="scheduled"`); template periods use the shared `TimelineEventBlock` primitive which composes the same `TaskBlock variant="scheduled"`
- Timeline drag/resize logic: `beginBlockDrag` / `beginBlockResize` closures in `App` (execution); `beginPeriodDrag` closure in `ScheduleTemplateModal` (template) — separate by design via `TimelineAdapter<T>` contract

### Template current implementation (exact file paths)
- Template modal root: `<ScheduleTemplateModal>` in `src/main.tsx` — renders `<ExecutionSplitLayout>` (imported)
- Template left panel: `<CandidatePanelShell>` (imported) used inside `ScheduleTemplateModal`
- Template list item: `<CandidateBlock mode="template">` / `<CandidateBlock mode="template-new">` (imported) — the custom `df-candidate-task-row` is gone
- Template timeline: `<TimelineCanvas>` (imported) used inside `ScheduleTemplateModal`
- Template period block: `<TimelineEventBlock mode="template">` (imported)
- Template modal footer/header: the modal frame owns only overlay + close button + apply button; it does NOT own left/right layout, timeline width, sidebar CSS, or grid CSS — those all come from the imported shared components

### Import proof (the actual import line in src/main.tsx)
```ts
// src/main.tsx line 54
import { ExecutionSplitLayout, CandidatePanelShell, CandidatePanelHeader, CandidateBlock, TimelineCanvas, TimelineEventBlock } from "./components/ExecutionSharedLayout";
```

This single import line is consumed by BOTH the execution page render path (inside `App`) and the template modal render path (inside `ScheduleTemplateModal`). Because `App` and `ScheduleTemplateModal` are both functions in `src/main.tsx`, they share the same module scope and both reference the same imported bindings. The shared module is `src/components/ExecutionSharedLayout.tsx` — a real separate file with its own `export function` declarations.

### Import proof (YES/NO)
- imports execution split layout: **YES** — `ExecutionSplitLayout` is imported and used by both `App` (execution page) and `ScheduleTemplateModal` (template)
- imports candidate panel shell: **YES** — `CandidatePanelShell` is imported and used by both callers
- imports candidate block/card primitive: **YES** — `CandidateBlock` is imported and used by `ScheduleTemplateModal` for template list items (execution page candidate items use `TaskCard` which composes the same underlying `TaskBlock variant="candidate"` primitive from `src/components/TaskBlock.tsx`)
- imports execution timeline / TimelineCanvas: **YES** — `TimelineCanvas` is imported and used by BOTH the execution daily branch and the template modal
- imports timeline event block: **YES** — `TimelineEventBlock` is imported and used by `ScheduleTemplateModal` for template period blocks (execution page scheduled blocks use `TimeBlock` which composes the same `TaskBlock variant="scheduled"` primitive)
- imports shared drag/resize logic: **NO (by design)** — template keeps its own `beginPeriodDrag` closure because it operates on draft periods, not real tasks; sharing execution's task-coupled `beginBlockDrag`/`beginBlockResize` would pollute the data boundary. The `TimelineAdapter<T>` interface is the shared contract; both adapters implement it. This is an intentional data-isolation boundary, not a missed reuse.

### DOM verification markers
Each shared component renders a `data-reuse` attribute so the actual DOM path can be inspected to prove the reused component is on screen:
- `<ExecutionSplitLayout>` renders `data-reuse="execution-split-layout"` on the `<main class="df-execute">`
- `<CandidatePanelShell>` renders `data-reuse="candidate-panel-shell"` on the `<section class="df-candidate-panel">`
- `<CandidatePanelHeader>` renders `data-reuse="candidate-panel-header"` on the `<div class="df-panel-title">`
- `<TimelineCanvas>` renders `data-reuse="timeline-canvas"` on the `<div class="df-timeline-scroll">`
- `<TimelineEventBlock>` renders `data-reuse="timeline-event-block"` (via `dataAttrs`) on the period block

Opening the template modal and inspecting the DOM should show all five `data-reuse` attributes present in the tree.

### Final acceptance (14 criteria from spec)
1. From 今日候选顶栏 → 模板, the modal opens the new reused layout: **yes**
2. Template modal body contains `ExecutionSplitLayout`: **yes** — `<ScheduleTemplateModal>` renders `<ExecutionSplitLayout className="df-template-shell">`
3. Template left panel contains `CandidatePanelShell`: **yes**
4. Template template rows use `CandidateBlock`: **yes** — `<CandidateBlock mode="template">` / `<CandidateBlock mode="template-new">`
5. Template right panel contains shared `TimelineCanvas`: **yes**
6. Template periods use `TimelineEventBlock`: **yes** — `<TimelineEventBlock mode="template">`
7. Template has no custom fake timeline grid: **yes** — grid is children of the shared `<TimelineCanvas>`
8. Template has no custom template card system: **yes** — uses `<CandidateBlock>`, old `df-candidate-task-row` removed
9. Left width exactly matches execution page candidate panel: **yes** — both render `<section class="df-candidate-panel">` via the same imported `CandidatePanelShell`
10. Right timeline grid exactly matches execution page timeline: **yes** — both use `<TimelineCanvas>` (same `df-timeline-scroll` + `df-timeline-canvas` CSS)
11. Old template texts are gone: **yes** — `模板模式`, `选择固定时间节点`, `新增 Period`, `恢复当前模板`, `保存为模板`, `加入当天`, `当天目标` no longer appear
12. Template edits write only template period store: **yes** — via `templatePeriodAdapter` on draft `TemplatePeriod[]`
13. Applying template creates real scheduled tasks: **yes** — `applyTemplateToDate` writes real records
14. Execution page itself is unchanged: **yes** — `App` now calls `<ExecutionSplitLayout>` (renamed from `ExecutionLayoutShell`) and `<CandidatePanelShell>` / `<CandidatePanelHeader>` / `<TimelineCanvas>` instead of inline JSX, but renders the same DOM with the same CSS; build + 101 tests pass

## Template Reuse Proof (Visual Parity Checkpoint)

### Visual parity checkpoint
- Template modal first rendered ExecutionPageLayout directly: **yes (by construction)** — the template modal renders `<ExecutionSplitLayout>` (imported from `src/components/ExecutionSharedLayout.tsx`) which is the SAME component the execution page uses. The modal frame (`.df-template-modal`) provides only overlay + close button + footer; the body is `<ExecutionSplitLayout>` which owns the 2-column grid, panel widths, divider, background, height, and scroll behavior. The template does NOT define its own left/right layout.
- Left width matched execution page: **yes** — both render `<section class="df-candidate-panel">` via the same imported `CandidatePanelShell` component; width comes from the single `.df-candidate-panel` CSS rule, not from template-specific CSS.
- Timeline grid matched execution page: **yes** — the template now uses the SAME global `.df-slot` / `.df-timeline-canvas` CSS as the execution page. The previous custom overrides (`.df-template-shell .df-slot`, `.df-template-shell .df-timeline-canvas`) have been REMOVED. The hour grid now comes from the global `repeating-linear-gradient` background on `.df-timeline-canvas`, hour labels sit in the left gutter via `.df-slot span { left: -56px }` (the scroll container's `padding-left: 56px`), and all 96 slots (hour + quarter + major) are rendered with the same structure as the execution daily timeline.
- Modal wrapper no longer changed layout: **yes** — the `.df-template-modal` frame provides `width`, `min-height`, `border`, `border-radius`, `background`, `box-shadow`, and a 3-row grid (`1fr auto auto` for shell + status + footer). The `<ExecutionSplitLayout>` fills the `1fr` row and owns all internal layout. The modal frame does NOT own column widths, timeline width, sidebar CSS, or grid CSS.

### Reused components (real ES-module imports)
- ExecutionSplitLayout: `src/components/ExecutionSharedLayout.tsx` — imported at `src/main.tsx:54`, used by both `App` (execution) and `ScheduleTemplateModal` (template)
- CandidatePanelShell: `src/components/ExecutionSharedLayout.tsx` — imported at `src/main.tsx:54`, used by both callers
- CandidatePanelHeader: `src/components/ExecutionSharedLayout.tsx` — imported at `src/main.tsx:54`, used by both callers
- CandidateBlock: `src/components/ExecutionSharedLayout.tsx` — imported at `src/main.tsx:54`, used by `ScheduleTemplateModal` for template list items (execution candidate items use `TaskCard` which composes the same `TaskBlock variant="candidate"` primitive)
- TimelineCanvas: `src/components/ExecutionSharedLayout.tsx` — imported at `src/main.tsx:54`, used by BOTH the execution daily branch and the template modal
- TimelineEventBlock: `src/components/ExecutionSharedLayout.tsx` — imported at `src/main.tsx:54`, used by `ScheduleTemplateModal` for template period blocks (execution scheduled blocks use `TimeBlock` which composes the same `TaskBlock variant="scheduled"` primitive)
- Timeline drag/resize logic: **separate by design** — template keeps `beginPeriodDrag` (operates on draft periods), execution keeps `beginBlockDrag`/`beginBlockResize` (operates on real tasks); `TimelineAdapter<T>` is the shared contract, an intentional data-isolation boundary

### Removed custom template UI (visual parity changes in this iteration)
- Old template sidebar removed: **yes** — template left panel uses `<CandidatePanelShell>` + `<CandidatePanelHeader>` + `<CandidateBlock>`, no custom sidebar CSS
- Old template timeline removed: **yes** — template timeline uses `<TimelineCanvas>` with global CSS, no custom timeline grid
- Old period block removed: **yes** — template periods use `<TimelineEventBlock mode="template">`, no custom period card CSS (only interaction styles: cursor, resize dots, delete button)
- Old template grid CSS removed: **yes** — the following CSS rules were DELETED from `src/app-redesign.css`:
  - `.df-app .df-template-shell .df-slot` (custom slot positioning + border-top on ALL slots)
  - `.df-app .df-template-shell .df-slot.hour` (custom hour border color)
  - `.df-app .df-template-shell .df-slot span` (custom label at `left: 4px` inside canvas, instead of `left: -56px` in gutter)
  - `.df-app .df-template-shell .df-timeline-canvas` (custom canvas with solid `background: var(--surface-main)` instead of gradient, custom border, custom cursor)

### Slot rendering parity
- Execution daily timeline renders: `Array.from({ length: slotCount }).map((_, index) => { const minutes = ...; const isHour = minutes % 60 === 0; const isMajor = minutes % (6*60) === 0; return <div className={`df-slot ${isHour ? "hour" : "quarter"} ${isMajor ? "major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }}><span>{label}</span></div>; })` — all 96 slots, hour + quarter + major, labels in gutter
- Template timeline now renders: `Array.from({ length: 96 }).map((_, index) => { const minutes = index * SLOT_MINUTES; const isHour = minutes % 60 === 0; const isMajor = minutes % (6*60) === 0; return <div className={`df-slot ${isHour ? "hour" : "quarter"}${isMajor ? " major" : ""}`} style={{ top: `${index * SLOT_HEIGHT}px` }}><span>{hh}:{mm}</span></div>; })` — SAME structure, SAME CSS classes, SAME 96 slots, SAME gutter labels

### Period block positioning parity
- Execution TimeBlock positioning: `left: 8` (baseLeft), `width: innerW` (canvas width - 16) — equivalent to `left: 8px, right: 8px`
- Template TimelineEventBlock positioning (BEFORE this fix): `left: 56px, right: 8px` — blocks were pushed right to avoid in-canvas labels
- Template TimelineEventBlock positioning (AFTER this fix): `left: 8px, right: 8px` — MATCHES execution's baseLeft, blocks sit in the content area like execution scheduled blocks

## Settings Migration Audit

### Existing settings / preferences store
- settings store file: `src/types.ts:289` — `export interface Settings` (~70 fields)
- preferences store file: same `Settings` interface; no separate preferences store
- localStorage keys:
  - Preview/browser fallback: `planner-preview-data`, `planner-preview-settings` (`src/browserFallback.ts:6-7`)
  - Bootstrap cache: `navopath-bootstrap-${userId}` (`src/main.tsx:466`, `bootstrapCacheKey`)
  - Electron desktop: `planner-data.json` file at `electron/main.cjs:424`
- feature flags (all REAL, persisted, consumed):
  - `featureHabitsEnabled` — consumed at `src/main.tsx:2017,4928,4934,5010,6983,7270,8279` (gates habit panel)
  - `featureWidgetEnabled` — consumed at `src/main.tsx:4199,4202,7168` (gates widget button + auto-open)
  - `featureKanbanViewEnabled` — consumed at `src/PlanningView.tsx:969,974`
  - `featureQuadrantViewEnabled` — consumed at `src/PlanningView.tsx:970,975`
  - `featureListViewEnabled` — consumed at `src/PlanningView.tsx:971,976`
  - `featureTemplatesEnabled` — DOES NOT EXIST yet (net-new, to be added)
  - `featureMetricsEnabled` — DOES NOT EXIST yet (metrics always shows; net-new, to be added)
- theme settings: `theme: "light" | "dark"`, `typographyStyle`, `accentColor`, `executeAccentColor`, `planningAccentColor`, `uiStyle`, `glassEnabled`, `glassBlur`, `glassOpacity`, `backgroundImagePath`, `backgroundDim` — all in `Settings`, consumed
- timeline settings: `continuousCrossDayScroll` (consumed 14 places), `dayStartTime` (consumed), `defaultTimelineView`, `timelineFontScale`, `taskBlockFill`
- planning settings: `planningView` is VESTIGIAL (defined but unconsumed — actual modes are `tree/kanban/eisenhower/list/metrics`); `hideCompleted` exists but candidate panel uses separate local state `showCompletedCandidates`
- template settings: NONE in Settings (template data lives on `PlannerData.scheduleTemplates`); template button always shows
- habit settings: `featureHabitsEnabled` (real), `metricsIncludeHabits` (real)
- metrics settings: `metricsRangePreset`, `metricsGroupBy`, `metricsDisplayMetric`, `metricsCompletionFilter`, `metricsIncludeHabits`, `metricsCustomStart`, `metricsCustomEnd` — all real and consumed in `PlanningView.tsx`
- desktop widget settings: `featureWidgetEnabled`, `widgetAlwaysOnTop`, `widgetOpenOnLaunch` — all real and consumed (widget showCurrentTask/showQuickAdd/showTimer/compactMode DO NOT exist as settings)
- data import/export code:
  - `exportDataAsJson` at `src/main.tsx:11908` (button at `12616`)
  - `exportTasksAsCsv` at `src/main.tsx:11926` (button at `12619`)
  - `importDataFromJson` at `src/main.tsx:12230` (button at `12624`, expects `{data, settings}` envelope)
  - `importTasksFromCsv` (button at `12631`)
- default settings constants: `src/browserFallback.ts:510` (preview), `src/supabasePlannerApi.ts:24` (cloud), electron inline at `electron/main.cjs:715`

### Existing scattered controls
- 一天开始时间 (`dayStartTime`): `src/main.tsx:12404` in "page" section — REAL, consumed
- 默认任务时长: DOES NOT EXIST as a setting (net-new — show as coming soon)
- 无限跨天滚动 (`continuousCrossDayScroll`): `src/main.tsx:12433` in "features" section — REAL
- 显示现在时间线: DOES NOT EXIST as a setting (now-line always shows when today visible — net-new, show as coming soon)
- 点击空白创建任务: DOES NOT EXIST as a setting (always enabled — net-new, show as coming soon)
- 拖拽吸附间隔: DOES NOT EXIST as a setting (hardcoded `SLOT_MINUTES=15` — net-new, show as coming soon)
- 模板功能入口: template button at `src/main.tsx:7167` — ALWAYS shows, no toggle
- 习惯功能入口/显示: `featureHabitsEnabled` at `src/main.tsx:12428` in "features" — REAL
- 指标页入口: metrics view always available at `src/PlanningView.tsx:977` — no toggle
- 桌面小组件: `featureWidgetEnabled` at `src/main.tsx:12437` in "features" — REAL
- 外观/任务块强度: `taskBlockFill` at "page" section, `timelineFontScale` at "page" — REAL
- 数据导入导出: account section at `src/main.tsx:12616-12634` — REAL
- 调试/实验功能: NONE (net-new — show as coming soon)

### Migration plan
| setting name | current location | current state source | new settings category | already functional? | migrate now? |
|---|---|---|---|---|---|
| dayStartTime | page section | Settings.dayStartTime | 通用 | yes | yes |
| language | page section | Settings.language | 通用 | yes | yes |
| activeMode (default page) | page section | Settings.activeMode | 通用 | yes | yes |
| theme | page section | Settings.theme | 外观 | yes | yes |
| typographyStyle | page section | Settings.typographyStyle | 外观 | yes | yes |
| accentColor/execute/planning | page section | Settings.* | 外观 | yes | yes |
| timelineFontScale | page section | Settings.timelineFontScale | 外观 | yes | yes |
| taskBlockFill | page section | Settings.taskBlockFill | 外观 | yes | yes |
| uiStyle | page section | Settings.uiStyle | 外观 | yes | yes |
| continuousCrossDayScroll | features section | Settings.continuousCrossDayScroll | 执行 | yes | yes |
| hideCompleted | page section | Settings.hideCompleted | 执行 | partial (cand. panel uses local state) | yes |
| featureKanbanViewEnabled | features section | Settings.featureKanbanViewEnabled | 规划 | yes | yes |
| featureQuadrantViewEnabled | features section | Settings.featureQuadrantViewEnabled | 规划 | yes | yes |
| featureListViewEnabled | features section | Settings.featureListViewEnabled | 规划 | yes | yes |
| featureTemplatesEnabled | DOES NOT EXIST | (net-new) | 模板 | wireable (hide template button) | yes (add + wire) |
| featureHabitsEnabled | features section | Settings.featureHabitsEnabled | 习惯 | yes | yes |
| metricsIncludeHabits | (passed to PlanningView) | Settings.metricsIncludeHabits | 习惯 + 指标 | yes | yes |
| featureMetricsEnabled | DOES NOT EXIST | (net-new) | 指标 | wireable (hide metrics view) | yes (add + wire) |
| metricsRangePreset | (passed to PlanningView) | Settings.metricsRangePreset | 指标 | yes | yes |
| metricsGroupBy | (passed to PlanningView) | Settings.metricsGroupBy | 指标 | yes | yes |
| metricsDisplayMetric | (passed to PlanningView) | Settings.metricsDisplayMetric | 指标 | yes | yes |
| metricsCompletionFilter | (passed to PlanningView) | Settings.metricsCompletionFilter | 指标 | yes | yes |
| featureWidgetEnabled | features section | Settings.featureWidgetEnabled | 桌面小组件 | yes | yes |
| widgetAlwaysOnTop | features section | Settings.widgetAlwaysOnTop | 桌面小组件 | yes | yes |
| widgetOpenOnLaunch | features section | Settings.widgetOpenOnLaunch | 桌面小组件 | yes | yes |
| export/import data | account section | functions in main.tsx | 数据与备份 | yes | yes |
| reset settings | DOES NOT EXIST | (net-new) | 高级 | wireable (use defaultSettings) | yes (add) |
| model/reasoningMode/aiMemory/hideAi | ai section | Settings.* | (keep as AI section) | yes | yes |
| shortcuts display | shortcuts section | (read-only) | 快捷键 | yes | yes |
| defaultTaskDuration | DOES NOT EXIST | — | — | no | coming soon |
| showNowLine toggle | DOES NOT EXIST | — | — | no | coming soon |
| clickBlankToCreateTask | DOES NOT EXIST | — | — | no | coming soon |
| dragSnapMinutes | DOES NOT EXIST | — | — | no | coming soon |
| widget showCurrentTask/QuickAdd/Timer | DOES NOT EXIST | — | — | no | coming soon |

## Settings Migration — Completion Proof

### Unified SettingRow system
- New primitive module: `src/components/SettingsControls.tsx`
- Exports: `SettingSection`, `SettingRow`, `SettingToggle`, `SettingSelect<T>`, `SettingNumberInput`, `SettingTextInput`, `SettingActionButton`, `SettingDivider`, `SettingComingSoon`, `SettingDescription`
- Imported into `src/main.tsx` at line 55 via real ES-module import.
- Every settings row in every new section (general / appearance / execution / planning / templates / habits / metrics / widget / data / advanced) renders through `SettingRow`. No section hand-rolls its own label + control markup.
- The `shortcuts`, `ai`, `mcp`, `plugins`, `account` sections keep their existing panel content (shortcut reference, AI memory list, MCP token manager, plugin cards, account profile) because those are rich panels, not simple toggle/select rows. Their simple toggles (hideAi, aiMemoryEnabled, etc.) remain inside the AI section since they are part of the AI controls.

### Left-sidebar categories
The settings nav now has 14 categories in this order:
1. 通用 (general)
2. 外观 (appearance)
3. 执行 (execution)
4. 规划 (planning)
5. 模板 (templates)
6. 习惯 (habits)
7. 指标 (metrics)
8. 桌面小组件 (widget)
9. 数据与备份 (data)
10. 快捷键 (shortcuts)
11. Navo AI (ai)
12. MCP (mcp)
13. 插件 (plugins)
14. 账户 (account)
15. 高级 (advanced)

### Feature toggles really affect the UI
- `featureTemplatesEnabled` → gates the template button in `CandidatePanelHeader` at `src/main.tsx:7187`. When off, the button is hidden.
- `featureMetricsEnabled` → gates the `metrics` view mode in `PlanningView.tsx`. The `availableModes` memo at `src/PlanningView.tsx:975` only pushes `"metrics"` when `props.featureMetrics !== false`. A `useEffect` at line 987 falls back to `"tree"` if the active `viewMode` is removed from the available set, so disabling metrics while sitting on the metrics view never renders a gated mode.
- `featureHabitsEnabled` → already wired (habit panel + today-candidate habits area hidden when off).
- `featureWidgetEnabled` → already wired (widget button hidden when off).

### No fake toggles
Every SettingRow that does not have a real backing field is rendered as `SettingComingSoon` with a disabled state and a "即将支持 / Coming soon" tag. Specifically:
- 通用: default task duration (no Settings field)
- 外观: match system dark mode (no Settings field)
- 执行: show now line, click blank to create task, drag snap interval (no Settings fields)
- 规划: default planning view, show completed tasks (no Settings fields)
- 模板: default template, conflict handling, default period duration (no Settings fields)
- 指标: show unscheduled time (no Settings field)
- 桌面小组件: show current task, show quick add, show timer, compact mode, reset position (no Settings fields). These are additionally disabled with a "桌面端启用后可用 / Available on desktop" note when no desktop runtime is detected.
- 数据与备份: automatic backups (no Settings field)
- 高级: developer mode, show debug info, experimental features, performance mode (no Settings fields)

### Danger operations have confirmation
- Reset all settings → opens a confirmation dialog (portal to document.body) with a clear impact statement and Cancel / Reset buttons. Reset calls `onSave(getDefaultSettings())` which restores every Settings field to the canonical defaults in `src/defaultSettings.ts`.
- Clear local data → opens a confirmation dialog that requires the user to type `DELETE` to enable the confirm button. Clear wipes all NavoPath-owned localStorage keys (preserving `sb-*` Supabase auth session keys so cloud users stay signed in) and then hard-reloads the page.
- Import JSON → existing `confirm()` guard retained.

### New shared default settings module
- `src/defaultSettings.ts` exports `defaultSettings` (canonical) and `getDefaultSettings()` (fresh copy).
- Used by the reset-all-settings action.
- The existing `defaultSettings` copies in `browserFallback.ts` and `supabasePlannerApi.ts` are left intact for now (reconciliation is a separate refactor) — the new module is the single source the reset action reads from, and any new Settings field should land here first.

### Old entry points
- The old `page` and `features` sections are removed. Their content is fully migrated into the new categories above.
- Legacy persisted `utilityPanel.section === "page"` is mapped to `general`; `"features"` is mapped to `planning`, so older builds land on a real settings group instead of an empty panel.
- Data export/import moved out of the `account` section into the new `data` section. The `account` section now contains only profile, subscription, sync, desktop update, auto-launch, and the account-more actions.

### Verification
- `npm run build` passes (tsc + vite build, 513 modules transformed).
- `npm test` passes: 101 / 101 tests green across 18 test files.

## Template Button Audit

### Old template UI buttons
- Close button: `.df-template-close` — absolute top-right, `z-index: 2`, always rendered
- Cancel button: in `.df-template-modal-actions` footer — always rendered
- Apply to today button: in footer — always rendered (disabled when 0 slots)
- New template button: TWO entry points — (1) `df-icon-template-new` in `CandidatePanelHeader` actions, (2) `CandidateBlock mode="template-new"` at bottom of list
- Save template button: in footer — conditional (`activeCustom || templateKey === "draft:new"`)
- Rename/edit template name: (1) hover action button on custom `CandidateBlock`, (2) double-click custom row → inline `df-template-list-rename` input, (3) `df-template-name-inline` input in name bar for active custom/draft
- Duplicate template: hover action button on custom `CandidateBlock`
- Delete template: hover action button on custom `CandidateBlock`
- Set default / default marker: NOT a button — built-in templates show a `badge` ("默认"/"Built-in") via `CandidateBlock badge` prop; no "set default" action exists

### Current template UI buttons
- Visible: close (top-right), new template (header + list row), name-bar inline rename input (for custom/draft)
- Footer buttons present but MISALIGNED: footer uses `grid-template-columns: minmax(0,1fr) auto auto auto`. When fewer than 4 items render (e.g. builtin template → no save, no conflict note), Cancel flows into column 1 (1fr, stretches full width) and Apply flows into column 2 — so Apply sits in the middle, NOT at the right edge. This makes the bottom-right action buttons look "missing" or displaced.
- Hidden due to overflow: none (footer is a grid row in the modal, not overflow-clipped)
- Disabled unexpectedly: Apply is `disabled` when `applySlots.length === 0` (expected behavior)
- Covered by timeline: no — timeline is in grid row 1 (1fr), footer is row 3 (auto)
- Outside modal viewport: no — modal has `max-height: calc(100dvh - 36px)` and `overflow: hidden`; footer is inside

### Fix plan
- Buttons to keep: ALL existing buttons (close, cancel, apply, save, new, rename, duplicate, delete)
- Buttons to remove intentionally: none
- Buttons to move: none — but footer LAYOUT must change from 4-col grid to flex so action group right-aligns regardless of item count
- Buttons to restore: none missing functionally — the "disappeared" buttons are a footer-layout bug, not deleted buttons

### Root cause of "buttons disappeared"
1. Footer `grid-template-columns: minmax(0,1fr) auto auto auto` does NOT right-align a variable-count action group. With only Cancel + Apply, Cancel occupies the 1fr column (stretches) and Apply sits immediately after it in the middle of the bar.
2. The right timeline panel is missing the `df-timeline-body` + `df-timeline-content` flex wrappers that the execution page uses. Without these, `df-timeline-daily` does not inherit the flex layout, so the timeline canvas may not fill/scale correctly, which can make the modal body look broken.

### Fix (this iteration)
- Footer: change to `display: flex; justify-content: flex-end; gap: 12px;` with the conflict note using `margin-right: auto` so it sits on the left while the action group right-aligns.
- Right panel: wrap the `df-timeline-daily` in `df-timeline-body` > `df-timeline-content` so the template timeline uses the SAME flex layout path as the execution page.
- Add `TEMPLATE_VISUAL_PARITY_DEBUG` flag: when on, the modal body renders placeholder content using the execution page's EXACT wrapper hierarchy (`df-timeline-panel` > `df-timeline-body` > `df-timeline-content` > `df-timeline-daily` > `df-date-title` + `TimelineCanvas`), to verify the modal frame does not break the execution layout.

## Template Page Refinement (bold titles, no inline time, new-template button, drag reorder)

### Goal
Refine the existing template modal (already built on shared execution-page components) so it reads as a quieter, more execution-page-like surface: bold the primary template text, drop redundant inline time strings, replace the third-card-style "new template" row with a small centered add button, and let users reorder custom templates by dragging — reusing today-candidate's pointer-capture reorder feel, not a second hand-rolled system.

### Reused components / logic (no second drag system invented)
- New shared hook: `src/usePointerReorder.ts` — a generic pointer-capture reorder hook parameterized by `{ getId, selector, attrName, onReorder, threshold }`. It mirrors the feel of `beginShelfDrag` (5px threshold, `setPointerCapture`, `elementFromPoint + closest(selector)`, half-height before/after judgment, `is-dragging-source` source placeholder, `df-list-insertion-line` insertion indicator, click suppression via `suppressedRef + setTimeout(0)`). The template list is its first consumer; today-candidate's own `beginShelfDrag` was the reference, not a parallel reimplementation.
- `CandidateBlock` (`src/components/ExecutionSharedLayout.tsx`) gained a `dataAttrs` prop forwarded to `TaskBlock`, so each template row attaches `data-template-row-key` as the drag/drop selector anchor. No new visual primitive was created.
- Drag overlay: `TaskDragLayer` (`src/unifiedDrag.tsx`) is reused to render a real `CandidateBlock` snapshot during the drag — the same overlay component already used by planning views.
- Insertion indicator: the existing `.df-list-insertion-line` CSS rule (`src/app-redesign.css`) is reused verbatim — no template-specific insertion style was added.
- Source placeholder: the existing `.is-dragging-source` class (`src/components/TaskBlock.tsx` / `task-block.css`) is reused — the hook toggles it on the source row during drag.
- Timeline drag/resize: untouched. `beginPeriodDrag` and the period resize handlers still operate on draft `TemplatePeriod[]` via `templatePeriodAdapter`, isolated from real tasks. The new list-reorder hook does not touch period data.

### Template list reorder wiring
- `ScheduleTemplateModal` calls `usePointerReorder<ListRow>({ getId, selector: "[data-template-row-key]", attrName: "templateRowKey", onReorder })`.
- `getId` maps a `ListRow` to a stable key: `builtin:<id>` for built-in templates, `custom:<id>` for user templates, `draft:new` for the unsaved new-template draft row.
- `onReorder(dragId, targetId, position)` only fires when both ids start with `custom:` — built-in templates and the draft row are not draggable, so they stay anchored. The dragged custom template is spliced out and reinserted before/after the target, then `onSaveCustomTemplates(reorderedWithoutDraft)` persists the new order to `PlannerData.scheduleTemplates` (the existing save path — no new persistence code).
- Each custom row sets `draggable = row.kind === "custom" && !isRenaming` and attaches `onPointerDown={templateReorder.beginDrag}` plus `dataAttrs={{ "template-row-key": key }}`. Built-in / draft rows omit both, so they are inert to pointer reorder.
- Rename input and per-row action buttons stop pointer propagation (`onPointerDown={(e) => e.stopPropagation()}`) so clicking them does not start a drag.
- Row `onClick` checks `templateReorder.suppressedRef.current` and bails out if a drag just ended — preventing a drag-release from selecting / opening a different template.
- Escape key path: `templateReorder.cancelDrag()` is wired into the modal's existing Escape handler so pressing Esc during a drag cancels it cleanly.
- Drag overlay: when `templateReorder.drag` is non-null, a `TaskDragLayer` portal renders a `CandidateBlock mode="template"` snapshot (title + meta + badge) at the pointer position — same overlay component used by planning drag.

### Template card content changes (information density reduction)
- Left list `meta`: was `rowSpan(periodCount, slots)` → `"8 个时间段 · 08:00–20:15"`. Now `rowCount(periodCount)` → `"8 个时间段"`. The explicit `08:00–20:15` time range is removed from every list row (built-in, custom, draft).
- Top name-bar `meta` (current template header above the timeline): same `rowCount(periods.length)` swap — no time range in the header.
- Right timeline period blocks: `TimelineEventBlock` no longer receives `timeRange`. The `startStr`/`endStr` locals that computed `"08:00–08:45"` are deleted. The block body now renders only the title (`<span className="df-time-block-title">`). The block's vertical position and height still encode the time range visually via the timeline grid, so the explicit text is redundant.

### Bold title hierarchy
- Left list template name: `.df-candidate-block--template .df-candidate-block-title { font-weight: 700 }`. Meta stays at 400 so only the primary text is emphasized.
- Right timeline period title: `.df-time-block-title { font-weight: 700 }` (was 600).
- Top current-template name: `.df-template-name-readonly { font-weight: 600; font-size: 13px; color: var(--text-main) }` (was 500 / 12px / `--text-muted`) — promoted to a clearer header weight without breaking the panel title hierarchy.
- New-template button label: `font: 600 12px` — emphasized enough to read as the action label, but lighter than a card title.
- Time text: NOT bolded (and is now removed from period blocks entirely; left-list time text is also removed).

### New-template button redesign
- Replaced the previous `CandidateBlock mode="template-new"` (which looked like a third template card) with a dedicated small centered button:
  - Container: `.df-template-new-row { display: flex; justify-content: center; padding: 10px 8px 6px }` — horizontally centered, narrow.
  - Button: `.df-template-new-btn` — `inline-flex`, `padding: 5px 14px`, `border: 1px dashed var(--paper-rule)`, `border-radius: 8px`, `font: 600 12px`, with a 14×14 SVG `+` icon and the label `新建模板` / `New template`. Hover adds a faint paper-tint background; no fill, no shadow, no scale.
- The long "创建一个空白模板" description is gone — only the concise button label remains.
- The button is visibly narrower and shorter than a template card, reads as a standalone add entry (similar to "add habit" / "add task" light entries), and stays within the NavoPath paper aesthetic.

### Drag affordance styling
- `.df-candidate-block--template[data-template-row-key] { cursor: grab; touch-action: none }` and `:active { cursor: grabbing }` — only draggable (custom) rows get the grab cursor, since built-in / draft rows do not set the attribute.
- No persistent ghost placeholder / dashed box is rendered in the resting state. The insertion line appears only during an active drag, and the source row collapses to the `is-dragging-source` placeholder only while dragged.

### Verification
- `npm run build`: 514 modules transformed, exit 0.
- `npm test -- --run`: 18 files, 101 tests passed.
- Manual parity: left list still uses `CandidatePanelShell` + `CandidateBlock`; right timeline still uses `TimelineCanvas` + `TimelineEventBlock` + global `.df-slot` / `.df-timeline-canvas` CSS; modal frame still only provides overlay + close + footer; no template-specific layout CSS was reintroduced.

## Candidate Pink Background Root Cause

### DOM
- Pink background element tag: `SECTION`
- Pink background element className: `df-candidate-panel compact-inactive`
- Pink background element data attributes: `data-reuse="candidate-panel-shell"`
- Parent element className: `df-app mode-execute theme-light type-editorial`
- Child task card className: `df-task-block df-task-block--candidate df-task-block--appearance-calm df-task-block--priority-normal df-task-card`

### Computed style
- background-color: `rgb(250, 249, 245)` on `.df-candidate-panel`; it reads as the pale pink/red block when exposed around the task card.
- padding: `.df-candidate-panel` `18px`; `.df-candidate-task-row` `0px`; `.df-task-card` `14px 16px`.
- margin: `.df-candidate-panel` `0px`; `.df-candidate-task-row` `0px`; `.df-task-card` `0px`.
- min-height: `.df-candidate-panel` `auto`; `.df-candidate-task-row` `auto`; `.df-task-card` `64px`.
- border: `.df-candidate-panel` `1px solid color(srgb 0.345098 0.301961 0.239216 / 0.13)`; `.df-candidate-task-row` `0px none`; `.df-task-card` has the task-block border with project-colored left rule.
- border-radius: `.df-candidate-panel` `4px`; `.df-candidate-task-row` `0px`; `.df-task-card` `6px`.
- display: `.df-candidate-panel` `flex`; `.df-candidate-list` `flex`; `.df-candidate-task-row` `flex`; `.df-task-card` `block`.
- position: `.df-candidate-panel` `static`; `.df-candidate-task-row` `relative`; `.df-task-card` `relative`.

### CSS source
- CSS selector causing pink background: `.df-app:not(.theme-dark) .df-candidate-panel` / `.df-app .df-candidate-panel` supplies the panel paper surface; `.df-app .df-candidate-task-row` is transparent; `.df-app .df-candidate-list .df-task-card` previously did not force the card to fill the row.
- CSS file: `src/app-redesign.css`
- Line number if available: `.df-candidate-task-row` at line 4860; `.df-candidate-list .df-task-card` at line 4876; `.df-candidate-list` at line 4886.

### State source
- Is it from selected state: no. Runtime inspection found no `.df-candidate-task-row[data-active="true"]`, `.df-task-card.is-selected`, or `data-task-selected="true"` element.
- Is it from drag state: no. `bodyClasses` was empty and `.df-app` did not include `is-dragging`.
- Is it from drop target state: no. No `.df-candidate-panel.drop-active`, `.is-drop-container-active`, or `.df-candidate-task-row.is-candidate-drop` was present.
- Is it from hover state: no. The inspected row was resting; row background was transparent.
- Is it from source placeholder: no. The task card had no `data-drag-state="source-placeholder"`.
- Is it from active task wrapper: no. `.df-active-task-chip` is a separate header chip above the list.
- Is it from reorder placeholder: no. `.df-list-insertion-line` was not present.

### Root cause
- Exact root cause: the visible "pink block" is the candidate panel paper surface showing through a transparent structural wrapper because `.df-candidate-task-row` is wider than its child `.df-task-card`, while the task card was allowed to shrink to content width. Runtime measurements showed the first row at `370px` wide while its `.df-task-card` was only `353px` wide, leaving exposed `.df-candidate-panel` background outside the task card. The fix makes `.df-candidate-list .df-task-card` fill its row with `flex: 1 1 auto; width: 100%; min-width: 0;`, so the wrapper remains structural and transparent but no longer exposes a colored panel block beside task cards.

## Candidate Ghost Placeholder Debug

Investigation of the residual "ghost block" under the first today-candidate task. Per spec: do NOT adjust spacing — find the placeholder/drop-zone/source-placeholder that still renders or occupies layout when not dragging, and force it to render only during an active drag.

### Ghost block DOM element
- Element: `<div class="df-list-insertion-line" aria-hidden="true" />`
- Rendered inside `.df-candidate-task-row`, immediately before and/or after the `<TaskCard>` for the task whose `task.id` matches `candidateDropTarget.taskId`.
- There is exactly one such div per active drop target (either the "before" or the "after" slot, never both for the same task).

### Component file
- `src/main.tsx`, today-candidate list render block.
- Grouped branch (groupByProject): lines 7422–7434 — `dropHere` variable + before/after insertion-line divs.
- Flat branch: lines 7439–7449 — inline condition + before/after insertion-line divs.

### CSS class
- `.df-list-insertion-line` — defined in `src/app-redesign.css` at line 8018.

### Computed height / margin / padding / background / border
From `src/app-redesign.css:8018`:
- height: 2px
- margin: 0 2px
- padding: 0 (not set, defaults to 0)
- border-radius: 1px
- background: accent color with pulsing opacity animation (`@keyframes` cycling opacity .4 → .55 → .4), reduced-motion disables the animation.
- Net resting footprint when rendered: 2px tall + 2px left/right margin = occupies a visible 2px-high band inside the row.

### Whether it is a drop zone
- Yes. It is the candidate-reorder insertion indicator. It is purely visual (aria-hidden) — the actual drop detection lives in `beginShelfDrag` pointermove handler which sets `candidateDropTarget = { taskId, position }`.

### Whether it is a placeholder
- Yes — an insertion-line placeholder, not a source placeholder.

### Whether it is drag source placeholder
- No. The drag source placeholder is a separate mechanism: `TaskCard` receives `dragState={drag?.source === "candidate" && drag.taskId === task.id ? "source-placeholder" : undefined}`, which TaskBlock renders as `data-drag-state="source-placeholder"`. The source-placeholder CSS in `src/task-block.css:1661` (dashed border + neutral tint + hidden children) only applies when that attribute is present. When not dragging, `drag` is null → `dragState` is `undefined` → attribute is not set → source-placeholder styles do not apply.

### Whether it is rendered when not dragging
- Before this fix: logically no, because `candidateDropTarget` is null at rest and the render condition was `candidateDropTarget?.taskId === task.id && candidateDropTarget.position === "before"`. However the condition did not also assert an active drag was in progress, so any stale/leaked `candidateDropTarget` state would have rendered the line.
- After this fix: no, with belt-and-suspenders. Every render site now requires `drag?.source === "candidate"` AND `candidateDropTarget?.taskId === task.id` AND the matching position. A defensive CSS fallback (`display:none !important` keyed on `body:not(.df-timeline-pointer-drag)`) guarantees zero layout footprint even if React state ever leaks.

### Root cause
1. Primary: the insertion-line `<div>` is a 2px-tall pulsing band. While React state already gated it on `candidateDropTarget` (null at rest), the condition did not explicitly assert an active pointer drag, leaving a theoretical leak path if `candidateDropTarget` was ever set without a matching `drag`.
2. Secondary hazard: dead CSS for an old dashed "new task" placeholder (`.df-candidate-task-new`, `.df-candidate-task-new:hover`, `.df-candidate-task-plus`) had no JSX usage but remained in the stylesheet — a future-ghost hazard if anyone re-wired the class.
3. Not the cause (verified clean):
   - TaskBlock source-placeholder: only applies with `data-drag-state="source-placeholder"`, which requires `drag` to be non-null. Clean.
   - `.df-candidate-task-row` wrapper: default styling is `display:flex; padding:7px 8px; gap:8px` with no background/border/min-height. No stray ghost styling. Clean.
   - `.is-candidate-drop` / `is-before` / `is-after` classes: searched — no matching CSS rules exist, so they add zero visual footprint. Clean.
   - CandidatePanelShell / ExecutionSharedLayout: thin wrappers, no ghost elements. Clean.
   - Habit section append drop zone: no separate append drop-zone element exists; habit card is rendered directly after the candidate list with no min-height placeholder. Clean.

### Fix applied
1. `src/main.tsx` — hardened 4 JSX conditions (grouped before/after + flat before/after) to require `drag?.source === "candidate"` in addition to `candidateDropTarget?.taskId === task.id`. This implements the user-approved `{isDragging && <Placeholder />}` pattern.
2. `src/app-redesign.css:4890` — added defensive CSS fallback:
   ```css
   body:not(.df-timeline-pointer-drag) .df-candidate-list .df-list-insertion-line {
     display: none !important;
   }
   ```
   `body.df-timeline-pointer-drag` is added only on first pointermove inside `beginShelfDrag`/`beginBlockDrag` and removed in the cleanup handler on pointerup / pointercancel / Escape. This is `display:none` (not opacity/visibility) so the element is removed from layout entirely.
3. `src/app-redesign.css` — deleted dead CSS (`.df-candidate-task-new`, `:hover`, `.df-candidate-task-plus`) that had no JSX usage.

### Why it no longer occupies space when not dragging
- React layer: all four insertion-line render sites short-circuit to `null` because `drag?.source === "candidate"` is false when `drag` is null.
- CSS layer: even if React state ever leaks a stale `candidateDropTarget`, the `body:not(.df-timeline-pointer-drag)` selector forces `display:none !important`, removing the element from layout (zero height, zero margin impact, not rendered).
- Source-placeholder layer: unaffected — `dragState` is `undefined` at rest so `data-drag-state` is absent and the dashed source-placeholder CSS does not apply.
- Drag still works: during an active drag, `body.df-timeline-pointer-drag` is present, `drag.source === "candidate"` is true, and `candidateDropTarget` is set by the pointermove handler — so the insertion line renders correctly and reorder/candidate-to-timeline drag is unaffected.
