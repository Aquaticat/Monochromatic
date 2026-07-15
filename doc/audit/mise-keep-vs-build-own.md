# Keep mise, do not build our own toolchain or monorepo manager

Audit date:
 2026-06-02.
Verdict:
 keep mise.
 There is no broader maintainer disinvestment;
 the gap we hit
is isolated to mise's rust backend,
 which the maintainer does not personally use.
Solve that gap at our boundary,
 not by forking or rebuilding.

## Trigger

The rust backend does not reconcile declared `components`/`targets` onto an
already-installed toolchain (see [../troubleshooting/mise-rust-components.md][rust]),
and the maintainer declined the fix on a near-identical PR
([jdx/mise#9839][pr9839],
 closed) as "too hacky" and "not a bug I really care
that much to resolve",
 adding "I'm half-tempted to just deprecate rust since I
don't use it".
 That prompted the question:
 should we build our own toolchain and
monorepo manager instead of depending on mise?

## What building our own would cost

mise is large and we lean on it everywhere.

- Size:
   about 103k lines of Rust and 980 crate dependencies (measured against the
  `310e325` clone with `tokei` and the `Cargo.lock` package count).
- Our reliance:
   the `config_roots = ["package/*/*"]` layout,
   every package's
  `mise.toml` task definitions,
   tool provisioning,
   lockfiles,
   and shims.

Replacing mise means reimplementing version resolution,
 per-language backends,
 the
task runner,
 env and shim management,
 and lockfiles,
 then carrying sole
maintainership of all of it.
 That is disproportionate to a single backend gap that
has a one-line workaround and a known fix shape.

## Maintainer-health audit (2026-06-02)

Method note:
 the GitHub core API (commits,
 releases,
 contributors,
 pull
requests) is reliable and was used for the activity numbers.
 The issue tracker
is not a usable signal here:
 `gh api repos/jdx/mise` reports `has_issues: false`,
so Issues are disabled and any issue-derived count is a frozen historical
artifact (see "The issue tracker is disabled" below).
 `gh search` auto-paginates
and exhausts the primary search rate limit (403);
 date-qualified issue searches
returned zero not because date filtering is broken but because the disabled
tracker serves frozen ghost counts the search index cannot hydrate into items
(both traced to the same cause in
[../troubleshooting/gh-search-rate-limit.md][ghsearch]),
 so date-filtered issue
counts are not relied on here.

Activity signals point to active maintenance,
 not disinvestment.

- Pushed the same day;
   twelve commits across 2026-06-01 and 2026-06-02 from six
  distinct contributors (jdx,
   roele,
   risu729,
   JamBalaya56562,
   vmaleze,
   joekrill).
  jdx committed that day,
   including a "docs:
   add sponsor footer" change.
- Eight releases in fifteen days (`v2026.5.11` through `v2026.5.18`),
   roughly one
  every one to three days.
- 28.9k stars;
   5324 PRs merged all-time,
   5974 closed,
   37 currently open.
   PR
  throughput,
   not the disabled issue tracker,
   is the reliable activity signal.
- A real contributor base beyond jdx:
   jdx 4077 commits,
   risu729 468,
   roele 209,
  scop 69,
   hverlin 45,
   acesyde 21,
   plus the release,
   renovate,
   and dependabot bots.
- The 763 search hits for "deprecate" are routine per-setting deprecation hygiene
  (`shorthands_file`,
   `env_file`,
   the `b` shorthand),
   not abandonment language.

The issue tracker is disabled,
 not neglected.
 An earlier draft of this audit
called it "lightly tended";
 that reading was wrong and is corrected here.
`gh api repos/jdx/mise` reports `has_issues: false` with `has_discussions: true`:
mise turned GitHub Issues off and routes bug and support intake to Discussions.

- The 26 open and 1544 closed issue counts are frozen from when the tab was open.
  The search index still reports the totals but returns zero items,
   the issues
  list endpoint returns only pull requests (every item carries `pull_request`),
  and `repos/jdx/mise/issues/1` now answers HTTP 410 Gone.
   The "all PRs on the
  issues endpoint" observation is a symptom of the disabled tab,
   not of an
  ignored backlog.
- Disabling Issues in favour of Discussions is a routine load-management choice
  for a high-traffic project (28.9k stars),
   not a disinvestment signal.
   Intake is
  structured elsewhere,
   not absent.
- It reframes the [#9839][pr9839] decline:
   jdx engages through PR review and
  commits,
   with discussion-shaped traffic funnelled to Discussions,
   so a blunt
  PR decline is his ordinary triage,
   not evidence the rust backend or the project
  is winding down.

## Why the rust gap is isolated, not a symptom

"Deprecate rust" refers to the rust backend that manages rustup toolchains for
users,
 not Rust the language mise is written in.
 mise's own repo does not even
dogfood that backend:
 its `mise.toml` `[tools]` manages cargo-based helpers
(`cargo-binstall`,
 `cargo:cargo-edit`,
 `cargo-insta`,
 `cargo-release`,
`cargo:toml-cli`) but pins no rust toolchain,
 and its CI installs the toolchain via
rustup directly (`rustup default nightly`,
 `rustup target add`) and the
`dtolnay/rust-toolchain` action.
 The maintainer provisions Rust with rustup,
 so the
rust backend is a feature he ships for others but does not exercise,
 which is a
plausible blind spot rather than a sign the project is winding down.

## Decision

- Keep mise.
- Solve the rust-component reconcile gap at our boundary with a small reconcile
  task:
   a `mise.<action>.ts` that diffs declared `components` against
  `rustup component list --installed` and runs `rustup component add` for the
  missing ones.
   This is the prototype's logic in TypeScript we control,
   no fork.
- Do not file upstream:
   it duplicates the declined [#9839][pr9839]
  (see [../troubleshooting/mise-rust-components.md][rust]).
   Issues are disabled
  anyway,
   so any future contribution would be a PR or a Discussion,
   not an issue.

## When to revisit

Re-open the build-versus-buy question,
 through the `choosing-technology` process
and recorded under `doc/decision/`,
 only on broad signals,
 never a single
feature.

- jdx and the wider contributor base slowing across many backends,
   not just rust.
- Release cadence collapsing from its current near-daily pace.
- A stated project-wide disinvestment,
   maintainer handoff,
   or archival.
- Several backends we depend on developing the same kind of unaddressed gap.

A single non-dogfooded backend,
 as here,
 is not such a signal.

## References

- [../troubleshooting/mise-rust-components.md][rust]:
   the gap,
   the verified
  prototype,
   and the declined upstream PR.
- [../troubleshooting/gh-search-rate-limit.md][ghsearch]:
   search-method caveats
  behind the method note (in progress).
- [jdx/mise#9839][pr9839]:
   closed,
   author-withdrawn after the maintainer declined
  the approach.
- [jdx/mise#9988](https://github.com/jdx/mise/pull/9988):
   merged,
   records
  `profile`/`components`/`targets` in lock identity (not reconcile-on-install).
- [jdx/mise#10178](https://github.com/jdx/mise/pull/10178):
   open,
   stores toolchain
  options on idiomatic requests.

[rust]: ../troubleshooting/mise-rust-components.md
[ghsearch]: ../troubleshooting/gh-search-rate-limit.md
[pr9839]: https://github.com/jdx/mise/pull/9839
