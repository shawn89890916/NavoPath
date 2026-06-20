# Repository agent instructions

## Product changelog

Every agent turn that changes user-visible behavior must update `CHANGELOG.md` before delivery.

- Add or refine the entry for the current local date.
- Keep Chinese and English sections semantically mirrored.
- Record only important user-visible additions, improvements, and fixes.
- Merge overlapping bullets from the same day instead of appending implementation details.
- Do not mention exploration, commands, filenames, internal refactors, or intermediate failures.
- Run `node scripts/changelog-maintain.mjs` after editing and `node scripts/changelog-maintain.mjs --check` before delivery.

Visual and interaction work must follow `NavoPathStyle.md`.

## End-of-turn GitHub publish

After every conversation that changes files in this repository, finish the turn by publishing the completed work to GitHub:

1. Run `npm run build` and stop the publish flow if it fails.
2. Run `git status` and inspect the diff so the commit scope is understood.
3. Stage the completed work with `git add .` only after confirming all current changes belong to the conversation.
4. Commit with a concise, descriptive message derived from the completed work; never use a placeholder such as `xxx`.
5. Push the current branch with `git push` (or `git push -u origin <branch>` when it has no upstream).

Do not create empty commits when the worktree is clean. Never hide build, commit, or push failures; report them before delivery. Do not stage unrelated user changes silently.
