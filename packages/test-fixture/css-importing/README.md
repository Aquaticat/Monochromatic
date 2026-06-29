# test-fixture-css-importing

Test fixture that imports CSS from `test-fixture-css-imported` using
`package.json` subpath exports (`index.css`,
 `mixin.css`).

Exercises `@import` and `@apply` resolution across workspace package boundaries
to verify that the build toolchain correctly resolves export-mapped CSS paths.
