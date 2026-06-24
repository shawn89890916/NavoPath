# Fix Short Task Drag, Title Display, and Candidate Drop Alignment Spec

## Why
Three bugs affect the timeline experience: (1) 15-minute task titles are cut off or unclear, (2) 15-minute tasks cannot be dragged on the timeline, and (3) dropping candidates from the "Today Candidates" panel onto the timeline produces misaligned positions when the day start time is changed from 0:00.

## What Changes
- Fix the `offsetMinutes` calculation in `beginBlockDrag` to handle 15-minute tasks correctly (allow 0 offset for minimum-duration tasks).
- Ensure short-block CSS allows proper drag activation by adjusting pointer hit area and title visibility.
- Add `startHour: dayStartHour` parameter to the `getDropTargetFromPointer` call in `beginShelfDrag` so candidate drops respect the configured day start time.

## Impact
- Affected code: `src/main.tsx` (drag logic, candidate drop, short-block CSS), `src/styles.css` (short-block styling)

## ADDED Requirements

### Requirement: Short task drag support
The system SHALL allow dragging tasks with 15-minute duration on the timeline.

#### Scenario: Drag 15-minute task
- **WHEN** user clicks and drags a 15-minute task block
- **THEN** the block enters drag mode and can be moved to a new position

### Requirement: Short task title visibility
The system SHALL display task titles clearly for 15-minute tasks.

#### Scenario: View 15-minute task
- **WHEN** a 15-minute task appears on the timeline
- **THEN** its title is visible and readable

### Requirement: Candidate drop alignment with custom day start
The system SHALL place dropped candidate tasks at the correct position when the day start time is not 0:00.

#### Scenario: Drop candidate with day start at 8:00
- **WHEN** user drags a candidate to a visible slot at 9:00 while day start is 8:00
- **THEN** the task is scheduled at 9:00, not at an offset position

## MODIFIED Requirements

### Requirement: Drag offset calculation
**Before**: `offsetMinutes = Math.min(..., Math.max(duration - SLOT_MINUTES, 0))` returns 0 for 15min tasks, which causes issues in later calculations.
**After**: The calculation should allow 0 offset and the drag logic should handle minimum-duration tasks without breaking.

### Requirement: Candidate drop target calculation
**Before**: `beginShelfDrag` calls `getDropTargetFromPointer` without `startHour`, defaulting to `TIMELINE_START (0)`.
**After**: `beginShelfDrag` passes `startHour: dayStartHour` so drop positions are correctly calculated for the shifted grid.
