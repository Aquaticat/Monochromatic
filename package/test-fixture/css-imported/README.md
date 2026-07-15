# test-fixture-css-imported

Test fixture package that exports CSS via `package.json` `exports` field.

Provides a minimal CSS custom property (`--primary`) and three mixins (`--flex-center`,
`--bold-text`,
 `--card`) consumed by `test-fixture-css-importing` to verify
cross-package CSS `@import` resolution through workspace package exports.
