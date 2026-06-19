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
