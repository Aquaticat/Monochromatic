# monochromatic-rust-linter

A configurable Rust linter,
 written in Rust,
 for enforcing this repository's conventions on `.rs` files.

## Why this exists

Oxlint enforces this repository's conventions on TypeScript.
Rust had no equivalent:
 `clippy` runs a fixed set of lints and offers only a per-function
 `too_many_lines`,
 and no off-the-shelf tool gates per-file Rust line counts or requires rustdoc
 on private items.

It is written in Rust rather than TypeScript because a linter's core job is
understanding its target language,
 and Rust has a first-class,
 lossless,
 comment-aware parser available on stable:
 rust-analyzer's `ra_ap_syntax`.
Parsing Rust from TypeScript would mean a foreign tree-sitter CST over WASM with
no semantic information.

## Packages

The linter is four packages,
 not one:

- `package/rust-module/rust-linter-core`:
   the `Rule` trait, the lint context, the configuration layer, the diagnostic
   and fix model, and the directive engine.
   A rule package depends on this and nothing else.
- `package/rust-module/rust-linter-pattern`:
   structural pattern matching over Rust syntax trees.
- `package/rust-linter-plugin/builtin`:
   the rules that ship, plus the driver for declarative pattern rules.
- `package/linter/rust`:
   this package, the CLI and the language server.

The split exists so a rule can be written without depending on the binary that
runs it.
That is not a claim about intent:
 the shipped rules live in a rule package and reach the trait exactly the way a
 third-party package would.

## Rules

- `max-lines`:
   a per-file code-line budget, default 300, blanks and comment-only lines
   excluded, computed with the real Rust lexer.
   A `//` or `/* */` inside a string literal is never mistaken for a comment,
   and a multi-line string counts every line it spans.
   The counts agree exactly with `tokei`.
   Category `pedantic`, which is where oxlint files its own `eslint/max-lines`.
- `require-rustdoc`:
   a rustdoc comment on every documentable item, public and private, including
   methods inside a trait impl.
   `///`,
   `//!`,
   `/** */` and `/*! */` count;
   a plain `//` does not,
   so the repository's `// What:` / `// Why:` blocks never satisfy it on their
   own.
   Detection uses rust-analyzer's own doc-comment scanner,
   so the answer agrees with how `rustdoc` itself attaches comments.
   Category `pedantic`.

Both declare themselves **non-suppressible**.
A directive aimed at either is refused and reported,
 which is what keeps `AGENTS.md` MXL, MXR and RDC literally true.

## Configuration

`rust-linter.toml`,
 discovered by walking up from the working directory and merged outermost first,
 so a package restates only what it changes.
`--config` replaces discovery;
 `--disable-nested-config` turns it off.
Run `rust-linter --init` for a starter file,
 and `--print-config` to see what is actually in effect.

The full shape is documented in
`package/rust-module/rust-linter-core/README.md`.
In brief:
 `rules`,
 `categories`,
 `options`,
 `ignore-patterns`,
 `plugins`,
 `settings`,
 `extends`,
 glob `overrides`,
 and `[[pattern]]` tables.

### Declarative rules

A rule can be added without writing Rust or rebuilding anything:

```toml
[[pattern]]
id      = "no-unwrap"
match   = "META_X.unwrap()"
fix     = 'META_X.expect("explain the invariant")'
message = "unwrap() panics; name the invariant instead"
```

The pattern is Rust,
 and `META_` names a hole.
Matching is structural,
 so it matches `thing.unwrap()` and `map.get(&k).unwrap()` alike,
 and does not match the same characters inside a string or a comment.
See `package/rust-module/rust-linter-pattern/README.md`.

### Exemptions

The built-in defaults exempt both shipped rules from:
 `tests/`,
 `*_tests.rs`,
 `fuzz/`,
 `build.rs`,
 and the `fixture/`,
 `test-fixture/` and `invalid/` sample directories.

These were once hardcoded Rust predicates.
They are glob `overrides` now,
 in `package/rust-module/rust-linter-core/default.toml`,
 which is compiled into the binary so a checkout with no configuration behaves
 the same way.

## Suppression

```rust
// rust-linter-disable-next-line no-unwrap -- the caller checked this
```

`disable`,
 `enable`,
 `disable-line` and `disable-next-line`,
 each naming rules by either spelling or naming none to mean all.

A justification after `--` is **mandatory**:
 a directive without one does not suppress and is itself reported.
`AGENTS.md` LN5 already requires one, so this makes the requirement enforceable
rather than advisory.
It is a superset of oxlint's behaviour, not parity with it.

Directives are comments rather than attributes because they have to be:
 `#[allow(monochromatic::max_lines)]` fails on stable with
 `error[E0710]: unknown tool name`,
 and the fix rustc suggests,
 `#![register_tool(monochromatic)]`,
 is nightly-only.

`--report-unused-disable-directives` reports directives that silenced nothing.

## Output

JSONL:
 one JSON object per line, one line per finding.
Each record carries oxlint's diagnostic field set
 (`message`,
 `code`,
 `severity`,
 `causes`,
 `filename`,
 `labels[].span`,
 `related`,
 optional `url` and `help`),
 so a consumer reads one line exactly as it reads one element of oxlint's
 `diagnostics` array.
A clean run prints nothing,
 which makes the output safe to pipe straight into `jq`.

There is no `--format` flag.
oxlint ships ten formats and none of them is JSONL;
 that divergence is recorded in
 `doc/planning/rust-linter-oxlint-parity.md`.

## Usage

```sh
rust-linter .                          # lint the current directory
rust-linter --max 200 path/to/package  # override the budget
rust-linter --fix-suggestions .        # apply pattern rewrites
rust-linter -A all -D max-lines .      # one rule only
rust-linter --rules .                  # list every registered rule
rust-linter --lsp                      # start the language server
```

Exit codes:
 0 clean,
 1 findings that fail the run,
 2 a setup error such as a malformed configuration.

Severity flags accumulate left to right,
 so `-A all -D max-lines` and `-D all -A max-lines` mean opposite things.

### Mise tasks

```sh
mise run //package/linter/rust:build
mise run //package/linter/rust:test
mise run //package/linter/rust:lint:clippy
mise run //package/linter/rust:lint:rust      # dogfood: lint this crate
mise run //package/linter/rust:run -- --max 200 some/path
```

## Source comments

Source files carry verbose,
 TypeScript-mapped comments per the repository's `dum-dum-non-ts` convention:
 the audience is a TypeScript reader.
Since `max-lines` counts only code lines,
 this commenting style does not consume the budget.
