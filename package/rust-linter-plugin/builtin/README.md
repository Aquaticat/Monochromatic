# monochromatic-rust-linter-plugin-builtin

The rules `monochromatic-rust-linter` ships with.

This package exists to prove a claim the architecture makes:
 a rule can be written without depending on the binary that runs it.
It depends on `monochromatic-rust-linter-core` and on the pattern matcher,
 and on nothing else from the linter.
Anyone writing their own rule package depends on exactly the same thing.

## What is here

- `max-lines`:
   a per-file code-line budget,
   blanks and comments excluded,
   mirroring oxlint's `eslint/max-lines`.
   Filed under `pedantic`,
   which is the category oxlint files its own under.
- `require-rustdoc`:
   rustdoc on every documentable item,
   public and private,
   mirroring the `require-tsdoc` rule used for TypeScript.
- `pattern_rule`:
   the driver that turns each `[[pattern]]` table in `rust-linter.toml` into a
   running rule.

Both `max-lines` and `require-rustdoc` declare themselves **non-suppressible**.
A `rust-linter-disable` directive aimed at either is refused and reported,
 which is what keeps `AGENTS.md` MXL,
 MXR and RDC literally true.
Pattern rules are suppressible,
 because they are written by whoever configured them.

## The plugin name

Findings from this package report as `builtin(max-lines)` and
`builtin(require-rustdoc)`,
 following oxlint's `plugin(rule)` code shape.
A configuration can turn the whole package off:

```toml
plugins = ["pattern"]
```

An absent `plugins` key enables every compiled-in plugin.
A present one is the complete set,
 so `plugins = []` turns every rule off.

## Mise tasks

```sh
mise run //package/rust-linter-plugin/builtin:build
mise run //package/rust-linter-plugin/builtin:test
mise run //package/rust-linter-plugin/builtin:lint:clippy
mise run //package/rust-linter-plugin/builtin:lint:rust
```
