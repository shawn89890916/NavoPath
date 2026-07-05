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
  - Importance high: red filled flag (`#D7816A`)
  - Importance medium: amber/yellow filled flag (`#c4a038`)
  - Importance low: sage green filled flag (`#7EA172`)
  - Importance unset: neutral outline flag (`--text-faint`)
  - Urgency high: red three-exclamation icons (`#D7816A`)
  - Urgency medium: amber two-exclamation icons (`#c4a038`)
  - Urgency low: muted blue/gray single-exclamation icon (`--text-muted`)
  - Urgency unset: neutral dash (`--text-faint`)
- Selected-state behavior: selected tile shows stronger border matching icon color + subtle paper tint background (`color-mix(in srgb, var(--text-main) 4%, transparent)`) + small bottom rule matching icon color. Unselected tiles remain quiet with faint icon color and thin paper border.
- Unset behavior: clicking "unset" clears the field (sets to `null`). The unset option is auto-selected when no value exists.
- Matrix mapping: Uses four-quadrant high/non-high logic:
  - Q1 (紧急且重要): `importance === 'high' && urgency === 'high'`
  - Q2 (不紧急但重要): `importance === 'high' && urgency !== 'high'` (medium/low/unset treated as non-high)
  - Q3 (紧急但不重要): `importance !== 'high' && urgency === 'high'` (medium/low/unset treated as non-high)
  - Q4 (不重要且不紧急): `importance !== 'high' && urgency !== 'high'`
- No 3x3 matrix introduced; medium and low values are preserved on the task and may be shown as small metadata/icons but do not create extra quadrants.
- Migration: No migration from old fields needed; existing `importance` and `urgency` fields are used directly.

## Known Limitations

- Planning Tree no longer uses a DOM-cloned overlay for task/subtask/project drags; it uses a React-rendered `TaskBlock` overlay from `TaskDragLayer`.
- Kanban and Matrix same-container reordering updates task order on drop; moving between columns/quadrants updates the task status or importance/urgency.
- Cross-view drag between Tree, Kanban, Matrix, and List is intentionally unsupported because they are separate Planning surfaces.
