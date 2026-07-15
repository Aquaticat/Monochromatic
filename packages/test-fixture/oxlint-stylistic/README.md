# test-fixture-oxlint-stylistic

Test fixture for validating the `@monochromatic-dev/oxlint-plugin-stylistic` rule set.

The fixture has valid and invalid TypeScript source trees.

- `src/valid/`:
   correctly formatted TypeScript covering already-per-line layouts,
   empty constructs,
   single-item collections,
   semicolon-terminated statements,
   block-body layouts,
   trailing commas,
   chain layouts,
   invocation-depth layouts,
   and conforming operator grouping
- `src/invalid/`:
   intentionally broken formatting with focused files for per-line rules,
   block-body-newline,
   one-var-declaration-per-line,
   max-statements-per-line,
   semi,
   comma-dangle,
   no-mixed-operators,
   chain-per-line,
   invocation-depth-per-line,
   and autofix convergence cases
