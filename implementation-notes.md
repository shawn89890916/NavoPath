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
