# Task 3 report: timeline scheduling and draft timer settings

## Scope delivered

- Added the `saveTimerSettings`, `resetWidgetTimer`, and `scheduleWidgetCountdown` widget actions.
- Kept the resting More view to background opacity, independent compact topmost/shadow buttons, and a single Timer settings entry point.
- Added a draft-only timer settings view with mode-specific controls, Save, Cancel, Reset timer, and missing-deadline scheduling guidance.
- Validated integer schedule durations from 1 through 1,440 minutes and append a real `TimelineRecord` for the active task before creating a paused countdown target at the record end.
- Removed the obsolete inline More implementation so timer fields cannot render in the resting view.

## RED

The inherited worktree contained the new implementation plus newly added task tests, but three pre-existing assertions still expected the retired inline mode selector in the resting More view. Running:

```text
npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetTimer.test.ts
```

failed with the expected mismatch: the resting view contains `Timer settings` and no `role="radiogroup"`. The assertions were updated to exercise `WidgetTimerSettingsView`, where the selector and mode-specific fields now belong.

## GREEN

```text
npx vitest run src/widget/WidgetApp.test.tsx src/widget/widgetTimer.test.ts
2 files passed, 48 tests passed

npm run build
tsc and vite build passed
```

## Review follow-up

- Saving a no-deadline countdown now retains a matching `Schedule for now` target instead of replacing it with an empty target.
- The mode radio group again supports arrow-key wrapping, roving tabindex, and focus movement.
- Reset carries the current draft into the action, so an unsaved Pomodoro draft resets to its own paused focus runtime rather than the previously saved mode.

Regression coverage adds schedule-then-save target preservation and draft Pomodoro reset construction; the focused suite now contains 50 passing tests.

## Deliberate scope boundary

No Task 4 native popup placement, detailed Settings screen, changelog, or release-version changes were made here.
