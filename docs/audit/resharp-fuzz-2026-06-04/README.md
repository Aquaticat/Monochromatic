# Resharp fuzz campaign 2026-06-04

Findings from a fresh coverage-guided plus directed-differential fuzz campaign
against `ieviev/resharp` at the current `main` (the version with the two
recently merged fuzzing-enablement PRs). This is the "full fuzz re-run" listed
as a recommended next step in `docs/troubleshooting/resharp.md`.

Each bug has its own file in this directory with a self-contained reproducer,
observed versus expected behaviour, the affected option modes, the source
location where known, and the relationship to the other findings.

## Scope and method

Three layers were used, in increasing yield:

- Coverage-guided `cargo-fuzz` (libFuzzer plus AddressSanitizer, nightly,
  debug-assertions and overflow-checks on) over the three in-tree targets:
  `compile`, `match_invariants`, `diff_regex`.
- A "suppressed fork" of the engine that turns the two re-entrancy-guard panics
  (`attempt_rw_union_2`, `attempt_rw_inter_2`) into their release `return None`
  fallback, so the fuzzer digs past the dominant crash (BUG-1) into the rest of
  the surface. The fork equals release semantics for re-entrancy, so any bug it
  surfaces is real for release builds.
- A directed differential oracle (`/tmp/agent/repro`, pristine engine, same
  build profile as cargo-fuzz) that compiles each pattern under every option
  mode and a fixed haystack set, then checks five engine-internal invariants
  plus a cross-engine and a cross-mode differential. This lane produced the most
  distinct triggers because it reaches the resharp-only operators that the
  in-tree `diff_regex` grammar deliberately excludes.

The oracles, in order of signal quality:

- `PANIC`: any panic, assertion, or abort during compile or match.
- `BOUNDS`: a `find_all` match with `start > end` or `end > haystack.len()`.
- `OVERLAP`: `find_all` matches that overlap or are out of order.
- `INCONSIST`: `is_match` disagrees with `find_all` non-emptiness.
- `ANCHOR`: `find_anchored` returns a match whose start is not 0.
- `HARDDIFF`: the default engine and the `hardened(true)` engine return
  different `is_match` or `find_all`. Hardening only swaps the scan algorithm,
  not the language, so any disagreement is a bug in one path.
- `DIVERGE`: resharp in `UnicodeMode::Ascii` disagrees with the `regex` crate
  built with `.unicode(false)`. Only trustworthy on pure-ascii haystacks (high
  bytes carry legitimate unicode-width differences), and only on the shared
  syntax subset (no anchors, no resharp-only operators, no multiline-sensitive
  constructs).

Every bug below was confirmed on the unmodified pristine engine. The fork is a
search accelerator only.

## Verification tooling

- Pristine clone: `/tmp/agent/resharp-fuzz-20260604` (kept unmodified).
- Suppressed fork: `/tmp/agent/resharp-fork-20260604` (two re-entrancy panics
  neutralised, `REPRO=1` self-describe prints added to the three targets).
- Reproducer and oracle: `/tmp/agent/repro` (a small crate depending on the
  pristine engine by path). Usage:
  - `repro '<pattern>' --sweep` runs every mode over the built-in haystack set
    and prints one line per invariant violation.
  - `repro '<pattern>' <haystack>` or `repro '<pattern>' <hex> --hex` runs a
    single explicit haystack.

## Bug index

- [BUG-1](bug-01-reentrant-rewrite-panic.md): re-entrancy guard panic in the
  union and intersection derivative rewrites. Compile time. `.*(.+)*.+`.
- [BUG-2](bug-02-correctness-issue-assert.md): `correctness issue found`
  assertion when the forward scan returns the `NO_MATCH` sentinel where the
  reverse pass expected an end. Match time. `\S+b`.
- [BUG-3](bug-03-ismatch-findall-disagree.md): `is_match` returns false while
  `find_all` returns one match. `(\z|(?=a)\w)`, `\BU`.
- [BUG-4](bug-04-nomatch-sentinel-leak.md): `find_all` emits a match with
  `end = usize::MAX` (the `NO_MATCH` sentinel leaked into a result). `~(_*$)`.
- [BUG-7](bug-07-negated-perl-class-nullable.md): the negated perl classes
  `\D`, `\S`, `\W` match the empty string (wrongly nullable). `\D`.
- [BUG-8](bug-08-default-vs-hardened-findall.md): the default engine and the
  hardened engine return different `find_all` results. `~(_a+)`.

BUG-5 and BUG-6 from the working notes are folded in: BUG-5 (`\S+b`) is the
shared trigger for BUG-2 and a real ascii `DIVERGE`; BUG-6 (`\BU`) is a second
trigger for BUG-3.

## Distinct-trigger counts

The internal oracles cluster into a small number of root causes, but each root
cause has many distinct triggering patterns:

- DIVERGE on pure-ascii haystacks (no anchors, no resharp-only operators): 108
  distinct patterns in the first 80k-pattern sweep alone, almost all explained
  by BUG-7 (`\D`, `\S`, `\W` nullability).
- HARDDIFF: 14 distinct patterns in that sweep, several complement-only or
  anchor-only and therefore distinct from BUG-7.
- INCONSIST, BOUNDS, PANIC: smaller distinct counts, listed per bug file.

## Caveats and relationship to known bugs

- The `reentrant-assert` feature is a default feature and is the project's own
  diagnostic guard. BUG-1 is that guard firing on a union-rewrite re-entrancy,
  a sibling of the already-tracked "intersection over alternation" recursion.
- BUG-8 is the same class as the already-tracked "hardened find_all drops
  zero-width matches", but the triggers here are complement-based and reproduce
  on current `main`, so the prior fix does not cover them.
- BUG-2 and BUG-4 share one underlying defect: the `NO_MATCH` sentinel
  (`usize::MAX`, `engine.rs:12`) reaches a `Match`. One path asserts on it
  (`engine.rs:960`), another pushes it silently (`engine.rs:1009`, `:1022`).

## Status

Campaign in progress. This index and the per-bug files are updated as new
distinct root causes are confirmed.
