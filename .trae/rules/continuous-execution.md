\# Skill: Continuous Auto-Execution Loop (Ralph Pattern)



\## Description

This rule forces the Trae Agent to operate in a continuous self-correcting loop. Do not halt or ask for user confirmation until the technical criteria or tests are fully verified.



\## Execution Core Directives

1\. \*\*Never Give Up on Error\*\*: If a command, script, build, or test fails, do NOT report the failure immediately to the user. Treat it as a technical issue that you must debug and resolve autonomously.

2\. \*\*The 3-Phase Loop\*\*:

&#x20;  - \*\*Phase 1 (Act)\*\*: Modify the code or execute the plan.

&#x20;  - \*\*Phase 2 (Verify)\*\*: Run validation scripts (e.g., `npm run test`, `pytest`, or build commands).

&#x20;  - \*\*Phase 3 (Analyze \& Re-loop)\*\*: If errors are found, read the stack trace completely, diagnose the root cause, modify the code again, and repeat from Phase 1.

3\. \*\*Completion Promise\*\*: You are only allowed to stop and announce completion when ALL tests pass, or when the final product is verified operational via terminal logs.

4\. \*\*Self-Healing Hook\*\*: If you get stuck in an identical error loop more than 3 times, change your architectural approach rather than applying the same fix.



\## Termination Flag

When the task is perfectly completed, end your final message with: `<promise>COMPLETE</promise>`



