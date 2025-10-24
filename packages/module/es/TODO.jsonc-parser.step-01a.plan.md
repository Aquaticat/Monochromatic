# JSONC parser – step 01a plan: reduce mutability and magic numbers in scanQuotedString

Date: 2025-10-24

Scope
- Refactor `scanQuotedString` to avoid magic numbers and minimize mutation.

Changes
- Replace `charCodeAt` numeric comparisons with character comparisons (`'"'`, `'\\'`).
- Use a recursive `findTerminatingQuote` with `indexOf` to locate quotes, avoiding a mutable index loop.
- Count preceding backslashes via `/\\+$/` on the left substring; no global scans.

Acceptance criteria
- No magic numeric literals for characters.
- Minimal mutation; logic expressed via recursion and local consts.
- Behaviour identical to step 01.
