# test-fixture-oxlint-tsdoc

Test fixture for validating the `@monochromatic-dev/oxlint-plugin-tsdoc` rule set.

The fixture has valid and invalid TypeScript source trees.

- `src/valid/`:
   correctly documented TypeScript covering complete TSDoc,
   documented declarations,
   documented locals,
   `@example` coverage,
   and ignored file extensions
- `src/invalid/`:
   intentionally broken TSDoc covering missing documentation,
   missing local documentation,
   missing `@example` tags,
   parameter issues,
   return issues,
   structural problems,
   tag validation failures,
   yields issues,
   and single-line TSDoc autofix cases
