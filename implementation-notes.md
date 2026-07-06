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
