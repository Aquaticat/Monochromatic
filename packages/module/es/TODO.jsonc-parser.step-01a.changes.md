# JSONC parser – step 01a changes

Date: 2025-10-24

Files changed
- `packages/module/es/src/types/t object/t jsonc/f/t string hasQuotedSyntax jsonc/r s/p n/customParsers.ts`

Summary
- Refactored `scanQuotedString` to remove magic numbers and reduce mutable state.
- Implemented recursive search with `indexOf` and a backslash run count using `/\\+$/`.

Behaviour
- Unchanged semantics: preserves original quoted slice; throws on unterminated strings; no use of `matchAll`.
