# Widget Lifecycle and Phase Icons Design

The approved change keeps the widget as one horizontal task strip. The time and controls share one natural vertical center through grid/flex alignment; no `top`, negative margin, or absolute positioning is used to force the timer into place.

The More popover utility row contains Reset, Pin/Unpin, and Close. Reset uses Lucide `RotateCcw` and resets the current timer without changing opacity, pin state, or window position. Timer-mode descriptions no longer occupy a permanent bottom row. Hovering a mode shows a quiet paper tooltip near the pointer; leaving removes it without changing the selected mode.

Only a running Pomodoro replaces the standard pause glyph: focus uses a tomato-like Lucide `Cherry` icon and break uses `Sprout`. The accessible label and pointer tooltip state the current phase and that clicking pauses. Stopwatch and countdown retain the standard Play/Pause icons.

The close crash is a BrowserWindow lifecycle race: during the popover `closed` callback, the widget BrowserWindow can still report not destroyed while its `webContents` is already destroyed. All outbound broadcasts therefore validate both objects before sending.
