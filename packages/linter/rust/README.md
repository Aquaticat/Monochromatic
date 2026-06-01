# monochromatic-rust-linter

A pluggable Rust linter, written in Rust, for enforcing this repository's
conventions on `.rs` files. Its first and currently only rule is `max-lines`,
a per-file code-line budget that mirrors oxlint's `eslint/max-lines` rule for
TypeScript.

## Why this exists

Oxlint enforces a 300 line budget on every `.ts` file (blanks and comments
excluded). Rust had no equivalent: `clippy` only offers per-function
`too_many_lines`, and no off-the-shelf tool gates per-file Rust line counts.
This linter fills that gap and provides a small framework so more
Rust-specific rules can be added later.

It is written in Rust (not TypeScript) because a linter's core job is
understanding its target language, and Rust has a first-class, lossless,
comment-aware parser available on stable: rust-analyzer's `ra_ap_syntax`.
Parsing Rust from TypeScript would require a foreign tree-sitter CST over WASM
with no semantic information.

## The max-lines rule

A file fails when its code-line count exceeds the budget (default 300).
Code lines are total lines minus blank lines minus comment-only lines, computed
with the real Rust lexer. Because the lexer is used, a `//` or `/* */` that
appears inside a string literal is never mistaken for a comment, and a
multi-line string counts every line it spans as code. This matches oxlint's
`skipBlankLines` plus `skipComments`, and the counts agree exactly with `tokei`.

### Exemptions

Mirroring oxlint's overrides for test, fixture, and config files, the rule skips:

- any file under a `tests/` directory (integration tests)
- any file whose name ends in `_tests.rs` (the repo's unit-test module convention)
- any file under a `fuzz/` directory (fuzz harnesses)
- `build.rs` (the cargo build script)

Build output under `target/` never reaches the linter because file discovery is
gitignore-aware.

There is no inline suppression. As in the TypeScript policy, the remedy for an
over-budget file is to split it, not to disable the rule.

## Usage

As a CLI, pass one or more paths (files or directories) and an optional budget:

```sh
# lint the current directory at the default budget of 300
rust-linter .

# lint a package with a custom budget
rust-linter --max 200 path/to/package
```

Directories are walked recursively for `.rs` files, honouring `.gitignore`.
The process exits 1 when any violation is found, 0 when clean, and 2 on a fatal
error. Each finding prints as:

```text
path/to/file.rs:LINE: error[max-lines]: file has N code lines, limit is 300 (blank and comment lines excluded)
```

### Mise tasks

```sh
mise run //packages/linter/rust:build         # cargo build --release
mise run //packages/linter/rust:lint:clippy   # cargo clippy --release -- -D warnings
mise run //packages/linter/rust:test          # cargo test --release
mise run //packages/linter/rust:lint:max-lines # dogfood: run the rule over this crate's src
mise run //packages/linter/rust:run -- --max 200 some/path
```

## Module layout

- `src/main.rs`: thin binary wrapper that maps the library result to an exit code.
- `src/lib.rs`: `run_cli_from_env`, argument parsing, file discovery, the run loop.
- `src/context.rs`: `LintContext` and the code-line classifier (the only place
  that touches `ra_ap_syntax`).
- `src/rule.rs`: the `Rule` trait and the rule registry.
- `src/config.rs`: settings and the exemption predicate.
- `src/diagnostic.rs`: `Severity`, `Diagnostic`, and its renderer.
- `src/rules/max_lines.rs`: the `max-lines` rule.

## Adding a rule

Implement the `Rule` trait (id plus a `check` that reads a `LintContext` and
pushes `Diagnostic`s), then register the new rule in `all_rules` in `src/rule.rs`.
Rules receive the parsed file context, so AST-based rules can build on the same
parser without re-reading the file.

## Source comments

Source files carry verbose, TypeScript-mapped comments per the repository's
`dum-dum-non-ts` convention: the audience is a TypeScript reader. Because the
`max-lines` rule counts only code lines, this commenting style does not consume
the budget.
