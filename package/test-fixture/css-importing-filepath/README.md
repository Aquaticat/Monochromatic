# test-fixture-css-importing-filepath

Test fixture that imports CSS from `test-fixture-css-imported-no-exports` using
direct `src/` file paths instead of subpath exports.

Exercises `@import` and `@apply` resolution across workspace package boundaries
when the dependency has no `exports` field,
 verifying fallback path resolution
in the build toolchain.
