# test-fixture-css-imported-no-exports

Test fixture package that exposes CSS without an `exports` field in `package.json`.

Identical content to `test-fixture-css-imported`,
 but consumers must resolve files
through direct `src/` paths instead of named exports.
 Paired with
`test-fixture-css-importing-filepath` to verify that CSS `@import` resolution works
when the dependency relies on `main` rather than subpath exports.
