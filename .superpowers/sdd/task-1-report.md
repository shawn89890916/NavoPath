# Task 1 report: Compact native popover geometry

## Files

- `electron/widget-window.test.cjs`
- `electron/widget-window.cjs`
- `.superpowers/sdd/task-1-report.md`

## RED evidence

Command:

```text
node --test --test-name-pattern="toggles a separate fixed-size popover" electron/widget-window.test.cjs
```

Result: exit 1. The regression failed for the intended missing behavior: native popover width was `332`, expected `250` (`332 !== 250`).

## GREEN evidence

Focused command:

```text
node --test --test-name-pattern="toggles a separate fixed-size popover" electron/widget-window.test.cjs
```

Result: exit 0; 1 test passed, 0 failed.

Full verification commands:

```text
node --test electron/widget-window.test.cjs
npm test
```

Result: focused Electron file passed 16/16. Full suite passed 19/19 Node tests and 133/133 Vitest tests across 21 test files.

## Implementation

Changed only `POPOVER_WIDTH` from 332 to 250 and `POPOVER_HEIGHT` from 420 to 220. Updated geometry expectations for the new shared height cap and the native window regression. The six-pixel gap, above/below choice, work-area clamping, and `scrollRequired` behavior remain covered by passing tests.

## Self-review

- Native More popover options and bounds assert exactly 250 x 220 logical pixels.
- Production change is limited to the two requested constants.
- Existing placement, clamping, scaling, and scrolling regression coverage passes.
- `git diff --check` passed.

## Concerns

- `npm test` emits the pre-existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning for `conversation.test.ts`; it does not fail the suite.
