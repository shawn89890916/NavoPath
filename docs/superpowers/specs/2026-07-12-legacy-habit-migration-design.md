# Legacy Habit Migration Design

## Goal

Make existing desktop profiles that only contain legacy `habit-tracker` plugin data show habits in Today's Candidates after enabling the core habits feature.

## Root cause

The core candidate card only renders active records from `PlannerData.habits`. The affected desktop profile has `featureHabitsEnabled: true`, but does not contain `habits` or `habitDailyStates`. It contains legacy completion data under `settings.pluginConfigs["habit-tracker"].doneByDate`, so the enabled candidate card receives an empty array and renders nothing.

## Chosen approach

Normalize the loaded profile once at the data/settings boundary.

- Only migrate when `data.habits` is absent or empty and the profile has legacy `habit-tracker` configuration.
- Use legacy custom newline-separated names when present; otherwise use the legacy tracker defaults: `复盘今天`, `整理任务`, and `查看明日计划`.
- Create active core habit records in the listed order with a neutral default duration.
- Convert every historical legacy completion name/date into a `HabitDailyState` for its matching migrated habit.
- Record a migration marker in the settings so subsequent loads never add duplicates.
- Leave tasks, projects, plugin configuration, and profiles that already have core habits unchanged.

## Error handling

Malformed legacy configuration is treated as absent. Empty or whitespace-only entries are ignored. Unknown completed names are ignored rather than becoming new habits.

## Verification

Add focused unit coverage for the migration: default legacy habits, custom legacy habits, completion-history conversion, no-op behavior for existing core habits, and idempotence. Then run the focused tests, the full suite, and a production build. Verify the desktop snapshot profile produces a non-empty candidate habit group after normalization.
