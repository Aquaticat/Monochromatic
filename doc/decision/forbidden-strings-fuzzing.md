# forbidden-strings fuzzing tooling

## Status

Accepted.
 Plan:
 `~/.claude/plans/setup-fuzzing-for-forbidden-strings-merged.md`.

## Context

`package/cli/forbidden-strings` is a deny-list scanner that mixes a custom
regex prefix extractor,
 Aho-Corasick gates,
 a hybrid `regex` + `resharp`
engine dispatcher,
 and rayon-parallel scans.
 The recent regression history
(`e49d8694`,
 `e100659f`,
 `9b41fca0`,
 `1463c59b`,
 `0479371a`,
 `4289cdb3`)
shows that the bug class is "the extractor or dispatcher constructs a
gate that drops legitimate matches" rather than "the fast path is too
slow".
 Random-input testing has missed every one of those bugs;
 what we
need is coverage-guided fuzzing that walks structural branches in the
extractor and engine dispatcher.

## Decision

Use `cargo-fuzz` (libFuzzer backend) as the primary fuzzer for this
package.
 Pin `cargo-fuzz = 0.13.1` and a nightly Rust toolchain via mise.
Express the fuzz surface through a `fuzz_api` module behind a Cargo
`fuzzing` feature;
 do not widen the production `pub` surface.

CI integration is deferred.
 Targets are exercised locally and on demand
only,
 inside a bounded container.

## Rejected alternatives

- `proptest`:
   a property-based testing framework using uniform random
  generation per type.
   It misses adversarial input shapes the way
  coverage-guided fuzzing finds them,
   and the regression class above is
  exactly the kind of branch a uniform sampler will miss.
   We may revisit
  if cargo-fuzz surfaces a fast deterministic invariant worth pulling
  into a normal `cargo test` run;
   until then `proptest` adds a second
  generator surface for no fuzzing gain.
- `afl.rs`:
   AFL bindings for Rust.
   AFL has a different corpus format
  from libFuzzer and weaker integration with the `arbitrary` derive
  macro that the structured generator depends on.
   No measurable
  advantage on a libFuzzer-friendly codebase like this one.
- `honggfuzz-rs`:
   Honggfuzz bindings for Rust.
   Requires the `honggfuzz`
  binary as a separate toolchain,
   with little to no advantage over
  libFuzzer for this code shape.
   Adds an install path without a
  matching capability gain.
- `bolero`:
   a unifying frontend over cargo-fuzz,
   kani,
   and honggfuzz.
  Useful if we eventually want symbolic execution (e.g. `kani` for
  parser proofs) and a second random backend in the same harness,
   but
  today we have one backend (`cargo-fuzz`) and adding the abstraction
  layer just adds a dependency on bolero's API surface.
   Revisit if we
  add a second backend.

## Redaction rule

Fuzz reproducers and panic messages never echo raw bytes from the
content slice or the rule source.
 Every reproducer field is one of:

- pattern source (rule string the fuzzer constructed;
   never derived
  from the local deny-list);
- content length in bytes;
- a SHA-256 hex digest of the content slice;
- a one-line label naming the invariant that failed.

Seeders read test sources only (`package/cli/forbidden-strings/src/rule/extract_tests.rs`
and siblings).
 They never read `forbidden-strings.local.txt` or any
other deny-list file;
 the seeder verifies this at runtime via
`git check-ignore` on each candidate input path before reading it.

## CI integration

Deferred to a later plan.
 The Done criteria for this work do **not**
include CI wiring.
 Reasons:

- libFuzzer + nightly Rust both need extra build steps that change
  cache shape on GitHub Actions;
   doing that in the same PR as the
  scaffold mixes two unrelated concerns.
- The fuzz smoke target uses a bounded container wrapper (Resource-
  exhaustion isolation rule in AGENTS.
  md);
   the wrapper needs an
  image we have not yet pinned for CI.

The follow-up CI plan should pick a Rust + LLVM container image,
decide a fuzz-time budget per target,
 and add a separate workflow file
(do not piggyback onto `.github/workflows/forbidden-strings.yml`,
 which
runs on every push and would balloon the per-push cost).
