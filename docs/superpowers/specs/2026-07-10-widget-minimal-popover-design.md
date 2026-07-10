# Desktop Widget Minimal Popover Design

## Goal

Refine the desktop widget into a smaller, quieter task strip whose primary surface shows only the active task, elapsed time, play/pause, and the More trigger. Secondary controls live in a separate popover window so opening them never changes the widget window size.

## Main Widget

- Use a default window size of 500 by 88 pixels. New windows and Reset position use this size; a user's deliberate resized bounds continue to persist.
- Keep a compact single-row layout whenever the window is short. A two-row layout is allowed only when the user has made the window tall enough to display it without clipping.
- Render the status label as small muted supporting text. For an active Chinese task it reads `正在做`.
- Give the task title and timer stronger visual priority with larger type. Long Chinese and English titles truncate with an ellipsis before they can displace the timer or controls.
- Show only task copy, timer, play/pause, and More on the primary surface. Keep always-on-top, opacity, reset, and close inside More.
- Remove the bottom project-color rule. Project color must not define the widget container or its border.

## More Popover

- Implement More as a separate frameless Electron `BrowserWindow`, not content inside the widget window.
- Size the popover to its contents and anchor it to the More button side of the widget. Prefer opening below the widget and flip above when the display work area has insufficient space.
- Opening or closing the popover must not change the widget bounds.
- Close the popover when it loses focus, when the user clicks elsewhere, presses Escape, moves or resizes the widget, closes the widget, or opens the same trigger again.
- Keep the popover visually minimal: Always on top, background opacity, Reset position, and Close widget. Controls retain keyboard focus states and touch-sized hit targets.
- The popover follows the widget's active language and appearance snapshot, and stays above the widget while open.

## Background Opacity

- Define the existing appearance `opacity` value as background-paper opacity only.
- Accept and persist the full normalized range from 0 to 1. The slider displays and adjusts 0% through 100%.
- Apply opacity only to the card background. Task text, timer, icons, focus indicators, and popover remain fully visible.
- At 0%, remove the visible paper fill while retaining readable content. Borders and shadows should fade with the paper so the result does not leave an opaque frame around a transparent center.

## Moving and Resizing

- Keep the Electron widget window frameless, transparent, `resizable`, and backed by the Windows thick frame so all four edges and corners behave like a normal resizable application window.
- Reserve a narrow perimeter for the native resize hit area. Do not mark the perimeter, buttons, text controls, slider, or popover as draggable.
- Allow window movement from unused paper space inside the perimeter. Interactive controls remain explicitly `no-drag`.
- Preserve minimum and maximum bounds, display work-area clamping, saved user bounds, multi-display removal handling, and DPI-change handling.

## Responsive Behavior

- The compact strip is the default at 500 by 88 pixels.
- Short windows remain a strip even when narrowed; task text yields first through ellipsis.
- When height provides enough space, the widget can switch to a two-row layout for narrow or portrait proportions.
- The status label stays visually subordinate in both layouts. The title, timer, and controls must never be clipped at supported minimum bounds.

## Architecture and Data Flow

- `electron/widget-window.cjs` owns both the widget window and its transient popover, including creation, positioning, focus/blur dismissal, bounds events, and cleanup.
- The widget renderer sends an IPC request containing the More trigger anchor. Electron opens or closes the popover without altering main widget bounds.
- The popover renderer receives the current snapshot and sends the same typed widget actions used by the main widget. Snapshot updates are broadcast to both renderer windows.
- `WidgetApp.tsx` renders the compact task strip. A dedicated popover view handles secondary controls so panel state no longer changes widget geometry.
- `widgetPreferences.ts` continues to normalize appearance and geometry, with opacity normalization updated to allow zero and old menu-expansion geometry removed.

## Testing

- Preference tests cover opacity values at 0, within range, above range, and invalid input.
- React tests verify the compact primary controls, muted status hierarchy hooks, absence of the project-color bar, and a 0-to-100 background-opacity slider in the popover view.
- Electron service tests verify the 500 by 88 default, resizable thick-frame options, separate popover creation, work-area-aware placement, no widget-bound changes on open, dismissal on blur/move/resize, window reuse, and cleanup.
- Build and full test commands must pass. The changelog receives mirrored Chinese and English user-visible entries before delivery.

## Out of Scope

- Adding new task data, task switching, quick add, project color controls, or additional menu commands.
- Applying opacity to text or the entire Electron window.
- Creating a desktop release tag as part of the UI change unless separately requested.
