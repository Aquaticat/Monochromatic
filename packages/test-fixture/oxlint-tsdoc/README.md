# test-fixture-oxlint-tsdoc

Test fixture for validating the `@monochromatic-dev/config-oxlint-tsdoc` rule set.

Contains two directories:

- `src/valid/`:
   correctly documented TypeScript (complete TSDoc,
   documented declarations,
  ignored file extensions) that should produce zero violations
- `src/invalid/`:
   intentionally broken TSDoc (missing documentation,
   param issues,
  returns issues,
   structural problems,
   tag validation failures,
   yields issues)
  that should each trigger specific rule violations
