# Keep mise, do not build our own toolchain or monorepo manager

Audit date: 2026-06-02.
Verdict: keep mise. There is no broader maintainer disinvestment; the gap we hit
is isolated to mise's rust backend, which the maintainer does not personally use.
Solve that gap at our boundary, not by forking or rebuilding.

## Trigger

The rust backend does not reconcile declared `components`/`targets` onto an
already-installed toolchain (see [../troubleshooting/mise-rust-components.md][rust]),
and the maintainer declined the fix on a near-identical PR
([jdx/mise#9839][pr9839], closed) as "too hacky" and "not a bug I really care
that much to resolve", adding "I'm half-tempted to just deprecate rust since I
don't use it". That prompted the question: should we build our own toolchain and
monorepo manager instead of depending on mise?

## What building our own would cost

mise is large and we lean on it everywhere.

- Size: about 103k lines of Rust and 980 crate dependencies (measured against the
  `310e325` clone with `tokei` and the `Cargo.lock` package count).
- Our reliance: the `config_roots = ["packages/*/*"]` layout, every package's
  `mise.toml` task definitions, tool provisioning, lockfiles, and shims.

Replacing mise means reimplementing version resolution, per-language backends, the
task runner, env and shim management, and lockfiles, then carrying sole
maintainership of all of it. That is disproportionate to a single backend gap that
has a one-line workaround and a known fix shape.

## Maintainer-health audit (2026-06-02)

Method note: the GitHub core API (commits, releases, contributors, issues) is
reliable and was used for the activity numbers. `gh search` auto-paginates and
trips a secondary rate limit, and date-qualified search returned zero on queries
that should match (under investigation; see
[../troubleshooting/gh-search-rate-limit.md][ghsearch]), so date-filtered search
counts are not relied on here.

Activity signals point to active maintenance, not disinvestment.

- Pushed the same day; twelve commits across 2026-06-01 and 2026-06-02 from six
  distinct contributors (jdx, roele, risu729, JamBalaya56562, vmaleze, joekrill).
  jdx committed that day, including a "docs: add sponsor footer" change.
- Eight releases in fifteen days (`v2026.5.11` through `v2026.5.18`), roughly one
  every one to three days.
- 28.9k stars, 26 open issues, 37 open PRs, 1544 closed issues all-time.
- A real contributor base beyond jdx: jdx 4077 commits, risu729 468, roele 209,
  scop 69, hverlin 45, acesyde 21, plus the release, renovate, and dependabot bots.
- The 763 search hits for "deprecate" are routine per-setting deprecation hygiene
  (`shorthands_file`, `env_file`, the `b` shorthand), not abandonment language.

The one real caveat is the issue tracker, which jdx tends lightly.

- jdx authored none of the last 60 issue comments; he engages through commits and
  PR review rather than issue threads.
- The 50 newest created items on the issues endpoint are all pull requests, and
  open issues are not being updated recently.
- This matches his blunt decline on [#9839][pr9839] and explains the rust gap
  without implying project decline.

## Why the rust gap is isolated, not a symptom

"Deprecate rust" refers to the rust backend that manages rustup toolchains for
users, not Rust the language mise is written in. mise's own repo does not even
dogfood that backend: its `mise.toml` `[tools]` manages cargo-based helpers
(`cargo-binstall`, `cargo:cargo-edit`, `cargo-insta`, `cargo-release`,
`cargo:toml-cli`) but pins no rust toolchain, and its CI installs the toolchain via
rustup directly (`rustup default nightly`, `rustup target add`) and the
`dtolnay/rust-toolchain` action. The maintainer provisions Rust with rustup, so the
rust backend is a feature he ships for others but does not exercise, which is a
plausible blind spot rather than a sign the project is winding down.

## Decision

- Keep mise.
- Solve the rust-component reconcile gap at our boundary with a small reconcile
  task: a `mise.<action>.ts` that diffs declared `components` against
  `rustup component list --installed` and runs `rustup component add` for the
  missing ones. This is the prototype's logic in TypeScript we control, no fork.
- Do not file upstream: it duplicates the declined [#9839][pr9839]
  (see [../troubleshooting/mise-rust-components.md][rust]).

## When to revisit

Re-open the build-versus-buy question, through the `choosing-technology` process
and recorded under `docs/decisions/`, only on broad signals, never a single
feature.

- jdx and the wider contributor base slowing across many backends, not just rust.
- Release cadence collapsing from its current near-daily pace.
- A stated project-wide disinvestment, maintainer handoff, or archival.
- Several backends we depend on developing the same kind of unaddressed gap.

A single non-dogfooded backend, as here, is not such a signal.

## References

- [../troubleshooting/mise-rust-components.md][rust]: the gap, the verified
  prototype, and the declined upstream PR.
- [../troubleshooting/gh-search-rate-limit.md][ghsearch]: search-method caveats
  behind the method note (in progress).
- [jdx/mise#9839][pr9839]: closed, author-withdrawn after the maintainer declined
  the approach.
- [jdx/mise#9988](https://github.com/jdx/mise/pull/9988): merged, records
  `profile`/`components`/`targets` in lock identity (not reconcile-on-install).
- [jdx/mise#10178](https://github.com/jdx/mise/pull/10178): open, stores toolchain
  options on idiomatic requests.

[rust]: ../troubleshooting/mise-rust-components.md
[ghsearch]: ../troubleshooting/gh-search-rate-limit.md
[pr9839]: https://github.com/jdx/mise/pull/9839
