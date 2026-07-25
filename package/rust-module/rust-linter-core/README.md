# monochromatic-rust-linter-core

The shared foundation for `monochromatic-rust-linter` and every rule package
that plugs into it.
It holds what a rule needs in order to be a rule,
 and nothing about how rules are discovered,
 configured from disk,
 or printed.

## Why this crate exists separately

A rule should be authorable without depending on the linter binary that runs it.
Before this split there was no way to write one:
 the `Rule` trait lived inside the CLI crate,
 so a rule package would have had to depend on `clap`,
 the file walker,
 and the process exit logic in order to see the trait it implements.

Splitting the foundation out means a rule package depends on this crate alone.
The CLI depends on both,
 and composes rules at build time.
There is no dynamic loading:
 see `doc/planning/rust-linter-oxlint-parity.md`,
 decision D4,
 for why dylint,
 JavaScript plugins,
 and WebAssembly were each rejected.

## What is in here

- `rule`:
   the `Rule` trait every rule implements.
- `context`:
   `LintContext`,
   the per-file bundle holding the parsed syntax tree,
   the code-line classification,
   and the line table.
   This is the only place that touches `ra_ap_syntax`.
- `diagnostic`:
   `Severity` and `Diagnostic`,
   the finding record.
- `span`:
   `Span` and `Label`,
   the source positions a finding points at.
- `fix`:
   `Fix`,
   `Edit`,
   and `FixKind`,
   the repairs a rule proposes.
- `config`:
   `Config`,
   the settings record rules read.

## The Rule trait

```rust
pub trait Rule {
    fn id(&self) -> &'static str;
    fn plugin(&self) -> &'static str { "builtin" }
    fn allows_suppression(&self) -> bool;
    fn check(&self, context: &LintContext, config: &Config, out: &mut Vec<Diagnostic>);
}
```

`plugin` has a default because rules compiled into the linter itself all report
the same one.
`allows_suppression` deliberately has no default.
Whether a rule may be silenced by an inline directive is a policy decision,
 and a default would let a rule author inherit one without noticing.
`AGENTS.md` MXL,
 MXR and RDC forbid silencing `max-lines` and `require-rustdoc` at all,
 and that guarantee is only worth anything if every new rule states its own answer.

## The diagnostic model

The field set is oxlint's JSON diagnostic shape rather than an invention:
 `plugin` and `rule_id` are the two halves of oxlint's `plugin(rule)` code,
 and `labels` carries spans with `offset`,
 `length`,
 `line` and `column`.
Matching that shape field for field is what lets the repository's existing
oxlint tooling,
 `package/dev-script/task-util/src/oxlint-wrapper.ts` and its siblings,
 read this linter's output without changes.

## Configuration

The linter reads `rust-linter.toml`.
TOML was chosen so the binary stays standalone,
 with no Node,
 no JVM and no external evaluator;
 issue #400 tracks revisiting that.

```toml
extends = ["../shared/rust-linter.toml"]
ignore-patterns = ["**/generated/**"]

[options]
deny-warnings = true
max-warnings = 0

[categories]
pedantic = "warn"

[rules]
"builtin/require-rustdoc" = "error"

[rules."builtin/max-lines"]
severity = "error"
max = 300

[[overrides]]
files = ["**/*_tests.rs"]
exclude-files = ["**/keep_checking_me_tests.rs"]

[overrides.rules]
"builtin/max-lines" = "off"
```

A rule is written either as a bare severity or as a table carrying its options
beside `severity`.
Severities are `off`,
 `warn` and `error`;
 oxlint's `allow` and `deny` are accepted as aliases of the first and last.
A rule may be named with or without its plugin prefix,
 and the qualified spelling wins when both appear.

### Resolution order

For each file and each rule,
 in order,
 with the last one to speak winning:

1.  the rule's category default,
    which is `error` for `correctness` and `off` for everything else,
    matching oxlint
2.  an explicit `[categories]` entry
3.  an explicit `[rules]` entry
4.  every matching `[[overrides]]` entry, in declaration order

### Two places this deliberately differs from oxlint

`extends` here is a full merge.
oxlint's merges rules only,
 dropping `categories`,
 `env`,
 `ignorePatterns`,
 `overrides` and `plugins`,
 which is why this repository's own `oxlint.config.ts` spreads its base rather
 than extending it.
Reproducing that would be copying a bug.

Nested configuration layers rather than replaces.
A package-level `rust-linter.toml` is merged on top of the ones above it,
 so a package restates only what it changes.
Since `lint:rust` fans out per package,
 the alternative would silently drop repository-wide policy for any package that
 carried a config at all.

### Built-in defaults

`default.toml` is compiled into the binary by `include_str!` and sits beneath
every discovered file.
It carries the exemptions that used to be hardcoded Rust predicates:
 `tests/`,
 `*_tests.rs`,
 `fuzz/`,
 `build.rs`,
 and the `fixture/`,
 `test-fixture/` and `invalid/` sample directories.
Both shipped rules are exempted in all of them.

## Fix kinds

`FixKind` mirrors oxlint's three trust levels:
 `Safe` is applied by `--fix`,
 `Suggestion` by `--fix-suggestions`,
 and `Dangerous` by `--fix-dangerously`.
A `Fix` is atomic:
 either all of its edits apply or none do.

## Mise tasks

```sh
mise run //package/rust-module/rust-linter-core:build
mise run //package/rust-module/rust-linter-core:test
mise run //package/rust-module/rust-linter-core:lint:clippy
mise run //package/rust-module/rust-linter-core:lint:rust
```

## Version pinning

`ra_ap_syntax` is pinned to an exact version here and to the identical exact
version in `package/linter/rust/Cargo.toml`.
The two crates pass `SyntaxNode` values across the boundary between them,
 so a version skew would make those two unrelated types that do not unify.
Re-pin both together,
 never one alone.
