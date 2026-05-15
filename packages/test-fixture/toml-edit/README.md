# test-fixture-toml-edit

Reusable TOML fixture data for `@monochromatic-dev/module-toml-edit` tests.

The `src/valid/` directory contains TOML inputs expected to parse and round-trip
byte-for-byte in splice mode with the current `toml-edit` parser stack. The
`src/invalid/` directory contains TOML inputs expected to throw `TomlEditError`
during parse.
