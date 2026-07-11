# Desktop Widget Adaptive Timer Design

## Goal

Rebuild the desktop widget as a Super Productivity-inspired, freely resizable task timer while preserving NavoPath's quiet paper-planner language. The primary surface stays minimal, follows the main application's light/dark theme, adapts content horizontally, scales typography vertically, and can shrink to a time-only state. More opens a compact timer/control popover that always remains inside the active display work area.

## Primary Widget Surface

- Keep the default window at 500 by 88 pixels.
- At full width, render only the current task name on the left, the timer on the right, and a three-dot More button.
- Do not render a separate status label, project-color footer, play/pause icon, mode badge, or decorative brand label.
- Clicking the timer toggles start/pause.
- The timer area also supports moving the window. Pointer movement beyond a 5-pixel threshold becomes a window drag and suppresses the click action when released, so finishing a drag never starts or pauses timing.
- Empty paper space remains draggable. Buttons and form controls remain non-draggable.
- While the More popover is open, the primary three-dot button becomes a restrained red X. This X closes the entire desktop widget.
- Closing the popover restores the primary button to three dots.

## Responsive Sizing

- Lower native minimum bounds to 128 by 56 pixels.
- Width controls which elements remain visible:
  - 360 pixels and wider: task name, timer, and More/close-widget button.
  - 220 to 359 pixels: hide the task name; show timer and More/close-widget button.
  - Below 220 pixels: show only the centered timer.
- Height controls scale. Task text, timer text, More/close button, padding, and corner radius grow smoothly with available height while the widget remains a single horizontal row.
- Diagonal resizing combines both rules: visibility follows width while typography/control size follows height.
- Long Chinese and English task names truncate with an ellipsis before displacing the timer.
- The smallest state shows only the timer, which remains clickable and draggable with the same 5-pixel click-versus-drag threshold.

## Native Edge Resizing

- Keep the Electron window frameless, transparent, `resizable`, and `thickFrame: true`.
- Keep a non-draggable perimeter for Windows native resize hit testing. Hovering any edge or corner must show the operating system's normal directional resize cursor.
- Do not implement fake CSS resize handles over the native frame.
- Preserve saved bounds, multi-display restoration, DPI/display-change clamping, and user-resized geometry.

## More Popover

- More remains a separate transient Electron window, so it never changes the widget bounds.
- The popover top row contains a compact, flat three-segment selector: `正计时 / 番茄钟 / 倒计时` (`Stopwatch / Pomodoro / Countdown`).
- The segmented group uses the normal paper background and one-pixel separators. It has no gray track, filled selected capsule, glass effect, gradient, or shadow.
- The selected item uses a complete theme-variable outline. A selected middle item uses a rectangular outline; selected first/last items may inherit only the corresponding outer group corner radius.
- A neutral X shares the top row to the right of the segmented selector. It closes only the More popover.
- The primary widget button and popover X have distinct labels and behavior:
  - Primary red X: Close widget.
  - Popover neutral X: Close More.
- Under the selector, render only the current timer mode's compact settings:
  - Stopwatch: state that no duration is required.
  - Pomodoro: editable focus minutes, break minutes, and round count. There is no long break.
  - Countdown: 15, 25, 45, and 60 minute presets plus a custom duration.
- Below mode settings, keep only background opacity, always-on-top, and shadow visibility.
- Do not place font, font scale, color controls, reset position/size, or reset appearance in More.

## Popover Work-Area Placement

- Position the popover against the widget on the display containing the widget.
- Prefer opening below and right-aligned to the widget's More button.
- If the bottom edge lacks room, flip above the widget.
- Clamp horizontally inside the display work area; when right alignment would overflow, shift left. Handle displays with negative coordinates.
- If neither above nor below fully fits, constrain popover height to the available work area and allow internal scrolling.
- Recompute placement when the widget moves, resizes, changes display, or when display metrics/DPI change.
- The popover must never be obscured beyond the desktop work area at 100%, 125%, or 150% Windows scaling.
- Clicking elsewhere, pressing Escape, or clicking the popover X closes only More. Moving/resizing the widget closes More before the movement continues.

## Timer Modes and Runtime

### Stopwatch

- Display elapsed task time and use the existing task timer record.
- Timer click starts or pauses the current task timer.

### Pomodoro

- Persist focus duration, break duration, and round count in the shared desktop-widget settings.
- Default to 25 minutes focus, 5 minutes break, and 4 rounds.
- Cycle automatically: focus → break → next focus. Remove long-break behavior entirely.
- Notify at every phase transition and automatically start the next phase.
- Count only focus phases toward task work time. Break phases continue visibly in the widget but pause task work-time accumulation; the next focus phase resumes it automatically.
- Use wall-clock timestamps rather than interval counts so background throttling, sleep, and focus changes do not cause drift.

### Countdown

- Persist the selected/custom countdown duration.
- While counting down, continue recording task work time.
- At zero, show a desktop notification and automatically enter an overrun stopwatch beginning at `00:00`.
- Overrun time uses the configured overrun color and a restrained flashing treatment that respects `prefers-reduced-motion`. It continues counting task work time until paused.

## Theme and Detailed Settings

- The widget always follows the main application's `light` or `dark` theme; there is no independent theme selector in More.
- Store separate light and dark appearance groups so custom choices survive theme switching:
  - background color
  - text color
  - timer color
  - overrun color
- Detailed settings under `Settings > Desktop Widget` contain:
  - font family
  - font scale
  - light-theme colors
  - dark-theme colors
  - reset position and size
  - restore default appearance
  - the same timer durations and mode preference
- More and detailed settings write to the same Settings source and update each other immediately.
- Keep background opacity, always-on-top, and shadow visibility available both in More and detailed settings.
- Migrate the existing version-1 widget appearance once: current background/font/accent values become light-theme values; dark-theme values receive NavoPath charcoal/warm-ivory defaults.

## Data Contracts

- Extend `WidgetSnapshot` with the active application theme and normalized widget timer state.
- Add a shared `WidgetTimerPreferences` contract containing:
  - mode: `stopwatch | pomodoro | countdown`
  - focus minutes
  - break minutes
  - rounds
  - countdown minutes/custom seconds
- Add a runtime contract containing current phase, phase start/end timestamps, round index, remaining/overrun seconds, and running state.
- Extend `WidgetAction` with mode selection, timer-preference updates, phase-aware toggle, close-popover state, and detailed appearance updates.
- The main application remains the single source of task/timer truth. The widget and popover remain IPC clients.
- Broadcast popover open/closed state to the primary renderer so the three-dot button reliably changes to the close-widget X.

## Accessibility and Interaction

- All visible controls provide at least 44-pixel touch targets when space permits; the time-only minimum remains readable and operable.
- Provide distinct accessible names for Close widget and Close More.
- The segmented mode selector uses radio-group semantics and arrow-key navigation.
- Popover opening focuses the active timer mode or first applicable control; focus remains visible.
- Escape closes More and returns focus to the primary More button when possible.
- Timer and mode state are never communicated by color alone; labels and time direction also identify the state.
- Respect reduced motion for the overrun flash and all transitions.

## Testing and Acceptance

- Pure logic tests cover timer transitions, wall-clock catch-up, countdown overrun, preference validation/migration, and horizontal/vertical layout decisions.
- React tests cover all three modes, dynamic mode settings, mode-selector keyboard behavior, timer click versus drag suppression, minimum time-only rendering, theme switching, red/neutral close actions, and reduced motion hooks.
- Electron service tests cover native resize options, 128 by 56 minimum bounds, saved multi-display bounds, popover flipping/clamping/negative display coordinates, constrained-height scrolling, DPI changes, and no widget-bound mutation on popover open.
- Acceptance includes Windows mouse and touch at 100%, 125%, and 150% scaling; smallest, default, tall, wide, and diagonal sizes; light/dark/custom colors; every edge/corner resize cursor; and popover placement at all four screen edges.
- Run focused tests, complete `npm test`, production build, mirrored changelog checks, packaged Electron smoke testing, branch review, and release verification.

## Release

- Update mirrored Chinese and English changelog entries for the current date.
- Bump the desktop version from 1.2.36 to 1.2.37.
- After all verification succeeds, push `main`, create the real semver tag `v1.2.37`, wait for the Desktop Release workflow, and verify `latest.yml`, installer, blockmap, and portable assets under that tag.
