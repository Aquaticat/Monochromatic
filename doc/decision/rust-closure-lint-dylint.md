# Rust closure rule as a Dylint lint

## Accepted decision

On 2026-10-18 the user chose, from three options, a rustc-driver lint through Dylint plus comment directives.
The alternatives were a callee allow-list in `monochromatic-lint` and a type criterion inside `monochromatic-lint`
with a build-generated load.
The evidence is in [the proposal][proposal], sections "Spike results", "Research results" and "Round two results".

The Rust closure rule becomes a Dylint library lint.
It reports a closure unless two things hold:
the closure captures state, and it is a direct argument whose callee parameter requires `'static`
(so the callee keeps the state past the call and no named function, loop, or `match` can replace the closure).
rustc answers both questions: captures from `tcx.upvars_mentioned`, the bound from the callee's `TypeOutlives` clauses.

## Suppression

The Dylint lint is suppressed with rustc's own attributes:
`#[cfg_attr(dylint_lib = "<library>", expect(<lint>, reason = "..."))]` on the closure argument or an enclosing item.
rustc then reports an expectation that suppresses nothing (`unfulfilled_lint_expectations`).
The comment directives of `doc/planning/rust-linter-oxlint-parity.md` (decision D2) remain decided for
`monochromatic-lint`'s own rules; they are a separate piece of work and the Dylint lint does not use them.
If the owner meant the comment form for the Dylint lint too, that reading was not asked and is open to veto.

## What the user approved with the choice

- Using the Dylint crates (`dylint_linting`, `dylint_testing`, `cargo-dylint`, `dylint-link`).
- The `rustc-dev` toolchain component for the package that builds the lint.

Not approved: any change to the root toolchain declaration (`mise.no-env.toml`, `mise.lock`), which every
session's builds share; the implementation must keep the toolchain package-local, with a comment saying why
it is pinned, or ask first.

## Staging

1. A new package for the lint with tests that include positive controls and adversarial cases,
   a README, and tasks in its `mise.toml`.
   No change to the IDE package.
2. Run it over the IDE, record the verdicts for the 67 closures, and propose the attribute placement and the
   `check-cfg` entry the IDE needs (package `Cargo.toml` files are managed by file-enforcer).
3. After review: the IDE integration, the five known reports, and the fate of the syntax-only
   `rust/no-anonymous-functions` rule in `monochromatic-lint`.

## Known limits to carry into the lint's README

- Wrappers are not recognised (`Arc::new(closure)`, `Some(closure)`, struct fields, `Option<F>`, a callee that is
  a value of fn-trait type); the spike counted none in the final IDE, and 8 `Arc::new(closure)` plus 37
  `Box::new(closure)` elsewhere in the repository.
- Only code that compiles is linted: features, `cfg`, and `--all-targets` decide coverage.
- Dylint builds the target with the toolchain that built the library.
- The generated Slint window type is unverified under rustc; the IDE build needs its runtime prepared first
  (`mise run //package/desktop-app/ide:runtime`).

[proposal]: ../planning/linter-selective-anonymous-functions.md
