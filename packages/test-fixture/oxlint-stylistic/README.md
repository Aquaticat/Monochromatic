# test-fixture-oxlint-stylistic

Test fixture for validating the `@monochromatic-dev/config-oxlint-stylistic` rule set.

Contains two directories:

- `src/valid/`: correctly formatted TypeScript (already-per-line layouts, empty
  constructs, single-item collections, conforming operator grouping) that should
  produce zero violations
- `src/invalid/`: intentionally broken formatting with one file per rule
  (per-line layouts for arguments, array elements, destructures, exports, imports,
  object properties, params, tuples, type properties; max-statements-per-line;
  no-mixed-operators; fixable trailing-comma and autofix cases) that should each
  trigger specific rule violations
