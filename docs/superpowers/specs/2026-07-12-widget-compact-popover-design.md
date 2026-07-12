# Desktop Widget Compact Popover Design

**Date:** 2026-07-12

## Goal

Make the desktop widget More panel match the compact reference: a small tool
panel attached to the widget instead of a large settings sheet.

## Native window geometry

- The More popover uses a compact default size of approximately `250 × 220`
  logical pixels, so high-DPI displays do not produce an oversized settings
  window.
- It opens immediately above or below the widget with the existing six-pixel
  gap and remains clamped to the active display work area.
- Timer-detail content stays inside the same popover. It replaces the resting
  controls rather than opening another window or expanding to a full-page
  layout.

## Resting More panel

- Remove the visible “More” heading.
- The top utility row places Pin/PinOff and Close at the upper-right.
- Background opacity is one compact row: label, range control, and percentage
  output share the same horizontal line.
- The timer-mode label is quiet secondary text.
- Stopwatch, Pomodoro, and Countdown appear as three equal-width text tabs.
- Selection uses ink text and a one-pixel underline. It does not use purple,
  a filled capsule, or a thick outline.

## Timer details

- Selecting a timer mode reveals that mode’s detail controls directly below
  the three tabs, within the same compact panel.
- Stopwatch shows its no-duration state without extra whitespace.
- Pomodoro and Countdown fields use compact rows and remain keyboard and touch
  accessible. If content exceeds the compact height, only the detail region
  scrolls.
- Save, cancel, reset, and countdown scheduling behavior continue to use the
  existing timer action flow.

## Visual language

- Use the active widget paper, ink, border, muted, and wash variables.
- Do not introduce purple or a drop shadow.
- Use Lucide line icons already installed in the project.
- Use fine rules, restrained spacing, 150–180ms state transitions, and no
  hover lift or scale.

## Verification

- Native-window tests cover the compact logical size and placement above and
  below the widget.
- React rendering tests cover the missing More heading, one-row opacity
  control, upper-right utility icons, three text tabs, and inline details.
- CSS contract tests cover compact spacing, underline selection, theme tokens,
  and absence of purple/shadow treatments.
- Visual verification checks light and dark themes at 100%, 125%, and 200%
  Windows display scaling where available.
