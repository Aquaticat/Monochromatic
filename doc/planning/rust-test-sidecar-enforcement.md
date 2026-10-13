# Enforcing Rust test sidecars

Status: proposal, not accepted.
Nothing in this document is implemented, and no existing file was changed for it.

## Purpose

Rust unit tests in this repository should always live in a sidecar file,
declared from the source file with `#[cfg(test)] #[path = "<name>_tests.rs"] mod tests;`.
The layout is a recorded pattern in `doc/philosophy/agents.md`, not an enforced rule.
This proposal decides how to enforce it and what the rule must allow.

## Evidence

Measured on 2026-10-13 with `git grep` over tracked `*.rs` files.

- 540 files contain `#[cfg(test)]`.
- 526 files contain a `#[path = ...]` attribute.
  Not every one is necessarily a test sidecar; the count is an upper bound on the sidecar convention.
- Four files (455 lines in total, tests and source together) hold an inline `mod tests { ... }` block:
  `package/cli/nested-wayland-session/src/notification_mode.rs`,
  `package/desktop-app/file-manager-qt/src/cxxqt_object.rs`,
  `package/desktop-app/ide/src/selection_paint.rs`
  and `package/linter/monochromatic-lint/src/markdown_block_start.rs`.
- Five files outside any `cfg(test)` module carry `#[test]` functions:
  the `package/linter/monochromatic-lint.fuzz/src` files `explicit_types.rs`, `lib.rs`, `markdown.rs`,
  `orchestration.rs` and `rust_style.rs`,
  plus the probe `doc/troubleshooting/slint-listview-random-seek-probe.rs`.
- 101 tracked files sit under a `tests/` directory (integration test targets),
  75 of them in `package/desktop-app/ide`.

## What native Clippy can do

Clippy 0.1.101 (`clippy-driver -W help`, probed on a scratch crate at `~/temp/agent/clippy-probe-20261013`).

- `clippy::inline_modules` (restriction, off by default) flagged a plain inline module,
  an inline `mod tests` without `cfg(test)`, and a feature-gated inline module.
  It did not flag an inline `#[cfg(test)]` module, with or without `#[test]` functions inside it.
  The exemption is documented in the lint's source, `clippy_lints/src/module_style.rs`:
  inline test modules and modules nested in them are not linted.
  So the lint cannot enforce this proposal.
- `clippy::tests_outside_test_module` requires tests to sit in a `#[cfg(test)]` module.
  A sidecar passes it, so it neither helps nor conflicts.
- The `disallowed_*` family covers methods, macros, types, names and fields, not items or attributes,
  and `clippy.toml` has no setting for module layout.

Conclusion: native Clippy cannot enforce the sidecar rule.

## Options

### A. A `rust/tests-in-sidecars` rule in `monochromatic-lint`

The linter already ships `rust/max-lines`, `rust/require-rustdoc`, `rust/no-anonymous-functions`
and `rust/require-explicit-types`, with access to the parsed source.
The rule reports two shapes:

- a `mod` item with an inline body that carries `#[cfg(test)]` (including `cfg(all(test, ...))`);
- a `#[test]` function (any `...::test` attribute) in a file that no `#[cfg(test)] mod name;` declaration loads.

Pros: exact semantics, runs at commit time through the wrapper, independent of Clippy.
Cons: a new rule to maintain, with its own tests, mutation run and linter release.

### B. Clippy lints only

Not viable, see the section on native Clippy.

### C. A Clippy fork or an upstream option

Pros: native.
Cons: the maintainers exempted `cfg(test)` on purpose, and nothing is available today.

### D. A written rule in `AGENTS.md` only

Pros: cheap, immediate.
Cons: nothing enforces it.

### E. A `ripgrep` check in a mise task

Pros: fast to write.
Cons: textual matching cannot tell an inline `mod x {` from a declaration reliably.

Ranking: A > E > D > C > B.
A beats E because it works on the parse tree, which the linter already has.
E beats D because a check can fail a commit and a written rule cannot.
D beats C because it exists today while C needs upstream agreement.
C beats B because B cannot detect the case at all.

## Decisions the rule needs before it is built

These are the questions to settle; each has a proposed answer.

- Doctests live in doc comments and are not sidecars.
  Proposed: out of scope for the rule.
- Integration tests under `tests/` are separate targets, not unit tests.
  Proposed: allowed, because they cannot reach private items and the rule is about unit tests.
- Sidecar crates named `<pkg>.fuzz`, `<pkg>.bench` and `<pkg>.conformance`
  (the sidecar naming of the repository) hold smoke tests in `src`.
  Proposed: exempt them by crate name, since the whole crate is the sidecar.
- The probe under `doc/troubleshooting` is a recorded reproduction, not package source.
  Proposed: out of scope by path.
- Generated code and macro-expanded tests, such as the `cxx-qt` bindings in `file-manager-qt`.
  Open: whether `cxxqt_object.rs` can move its tests to a sidecar without the bridge macro hiding the module path.
  Measure by moving it before accepting the rule.
- The rule's severity at introduction.
  Proposed: `error`, after the four inline modules are migrated, so the rule never lands red.

## Migration

Move the four inline modules to `<name>_tests.rs` sidecars with the `#[path]` declaration,
one commit each, verifying each package's tests still pass.
No other file needs to change under the proposed carve-outs.

## Risks

- The rule must not flag a sidecar file itself (its `#[test]` functions sit at the top level of the loaded file).
  It needs the declaration lookup across files, which the linter's per-file model may not provide.
  Measure this first; if per-file analysis cannot see the declaring file,
  the rule would have to infer sidecars from the `_tests.rs` file name,
  which is a weaker but simpler contract.
- A new rule changes lint output for every package, so it needs the linter's normal gates:
  container tests, scoped mutation and a short fuzz smoke run.

## Open questions for the user

- Is the `_tests.rs` file name acceptable as the sidecar contract, or must the rule follow the `mod` declaration?
- Should the `<pkg>.fuzz` exemption be by crate name, as proposed, or by an allow-list in the configuration?
