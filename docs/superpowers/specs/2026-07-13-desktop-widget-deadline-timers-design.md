# Desktop Widget Deadline Timers Design

The attached user specification is the approved design source for this change.

The widget remains one horizontal task strip and one attached More popover. The popover keeps opacity, pin, and close controls, then presents three equal-width timer tabs. Hover only changes a fixed-height explanation region; click changes the draft selection and reveals that mode's inline configuration. No second settings window or tooltip is created.

The main application remains authoritative for tasks and elapsed work. `WidgetSnapshot` carries the active scheduled record's start and absolute end. Countdown targets that end by default. Stopwatch, countdown overtime, and final Pomodoro overtime call one schedule-sync helper that extends only the active record, preserves its start, persists at minute boundaries and final pause/stop, and never moves later tasks.

Pomodoro planning is a pure deterministic function separate from React. It searches feasible work-phase counts, assigns short/long breaks, degrades break duration or cycle count when necessary, balances work minutes, always ends with work, and covers the exact interval through the task deadline. The same function powers preview and runtime.

Tests cover the planner invariants, deadline resolution and schedule extension, hover/click separation, live preview recalculation, pause/stop behavior, and preservation of existing widget utilities.
