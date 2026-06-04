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

## Root-cause bug index

- [BUG-1](bug-01-reentrant-rewrite-panic.md): re-entrancy guard panic in the
  union and intersection derivative rewrites. Compile time. `.*(.+)*.+`.
- [BUG-2](bug-02-correctness-issue-assert.md): `correctness issue found`
  assertion when the forward scan returns the `NO_MATCH` sentinel where the
  reverse pass expected an end. Match time. `\S+b`.
- [BUG-3](bug-03-ismatch-findall-disagree.md): `is_match` disagrees with
  `find_all`. `(\z|(?=a)\w)`, `((?=0)\S|\z)`, `\BU`, `\z\A(?:a){0,1}`.
- [BUG-4](bug-04-nomatch-sentinel-leak.md): `find_all` emits a match with
  `end = usize::MAX`. `~(_*$)`, `\Bb+`, `(?<=[^a])b+`.
- [BUG-7](bug-07-negated-perl-class-nullable.md): the negated perl classes
  `\D`, `\S`, `\W` match the empty string. `\D`.
- [BUG-8](bug-08-default-vs-hardened-findall.md): hardened `find_all` differs
  from default; hardened is the wrong side. `~(_a+)`, `~(\D+)`.
- [BUG-9](bug-09-stream-drops-matches.md): the `stream` path under-reports
  matches that `is_match` and `find_all` see. `\A\z?`, `(^|b)`, `(?<!b)`.
- [BUG-10](bug-10-default-findall-drops-trailing-zerowidth.md): default
  `find_all` drops a trailing zero-width match that hardened and dotnet report.
  `(?<=^)~(0+)`.
- [BUG-11](bug-11-compile-time-blowup.md): super-linear compile time on small
  intersection plus class-repeat patterns. `[\w]{3,5}[\w]([^a]&a+)`.
- [BUG-12](bug-12-neg-lookahead-nullable.md): a negative lookahead of a class
  makes a non-nullable pattern wrongly nullable, so is_match and find_all both
  report a spurious empty match. `(?!\w)0+`. Found only by the Lean ground truth.

BUG-5 and BUG-6 from the working notes are folded in: BUG-5 (`\S+b`) is the
shared trigger for BUG-2 and a real ascii `DIVERGE`; BUG-6 (`\BU`) is a second
trigger for BUG-3.

## Numbered findings (20 distinct minimal reproducers)

Each line is a distinct, verified, minimal reproducer on the pristine engine,
grouped by the root cause above. Self-consistency findings (a single engine
contradicting itself) need no external oracle; the rest are adjudicated against
the dotnet reference and plain semantic reasoning.

```text
 1. .*(.+)*.+                 compile panic, reentrant union rewrite        BUG-1
 2. (?:(?:(?:(?:1)+){1,2})+){2,2}  compile panic, same site, nested quant   BUG-1
 3. \S+b on "b'_"             match-time assert engine.rs:960               BUG-2
 4. (\d|_)b(?:a)* full mode   match-time assert engine.rs:960               BUG-2
 5. (\z|(?=a)\w)              is_match false, find_all one match            BUG-3
 6. ((?=0)\S|\z) on "a"       is_match false, find_all one match            BUG-3
 7. \BU on "Uii\"             is_match true, find_all empty                 BUG-3
 8. \z\A(?:a){0,1} on ""      is_match false, empty match exists            BUG-3
 9. ~(_*$) flags mode         find_all end = usize::MAX                     BUG-4
10. \Bb+ on "ba"             find_all end = usize::MAX, default mode        BUG-4
11. (?<=[^a])b+ on "ba"      find_all end = usize::MAX, default mode        BUG-4
12. \D on ""                 negated perl class nullable (ascii)            BUG-7
13. \S on ""                 negated perl class nullable (ascii)            BUG-7
14. ~(_a+) on "aaa"          hardened find_all wrong                        BUG-8
15. ~(\D+)                   default vs hardened find_all differ            BUG-8
16. \A\z? on "a"             stream returns empty, match exists             BUG-9
17. (?<!b) on "b"            stream returns empty, match exists             BUG-9
18. (^|b) on "a"             stream returns empty, is_match true            BUG-9
19. (?<=^)~(0+) on "\n"      default find_all drops trailing (1,1)          BUG-10
20. [\w]{3,5}[\w]([^a]&a+)   compile takes about 4 seconds                  BUG-11
21. (?!\w)0+ on ""           spurious empty match (Lean ground truth)       BUG-12
22. (?!\D)\D{2,2} on ""      spurious empty match (Lean ground truth)       BUG-12
```

The campaign covers ten distinct root causes (BUG-1 through BUG-12, numbers 5
and 6 folded). The Lean ground truth added BUG-12, a class of bug that is
self-consistent and so invisible to every internal oracle.

## Distinct-trigger counts

The oracles cluster into the root causes above, but each has many distinct
triggering patterns (counts from the 159k-pattern directed sweep):

- `STREAMINCONSIST`: 707 distinct patterns (BUG-9).
- `HARDDIFF_FA`: 196 distinct patterns (BUG-8 and BUG-10).
- `BOUNDS`: 10 distinct patterns (BUG-4).
- `INCONSIST`: 9 distinct patterns (BUG-3).
- `DIVERGE` on pure-ascii haystacks: about 108 distinct patterns, almost all
  BUG-7.
- `RUST_TIMEOUT` in the dotnet differential: dozens of distinct slow-compile
  patterns (BUG-11).

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

## The dotnet reference has its own bugs

The dotnet differential is a candidate generator, not an oracle. The dotnet
engine is older and was the basis for the rust rewrite, but it has systematic
defects of its own, so its `is_match` / `find_all` disagreements with rust are
often the dotnet side being wrong. Confirmed dotnet defects found while
adjudicating:

- lookahead followed by an empty-matching star: `(?=1)[a-c]*` on `1` and
  `(?=[a-c])1*` on `a` both match (the lookahead holds and the star matches
  empty), but dotnet reports no match. rust is correct here.
- anchor intersection: `(\A&$)` on `a` and `(a&\A\S)` on `ba` have no match
  (a single span cannot satisfy both anchor constraints at the required
  position), but dotnet reports a match. rust is correct here.

Because of this, the `IM_DIFF`, `FA_DIFF`, and `LE_DIFF` differential classes are
heavily contaminated with dotnet bugs and were not used to file rust bugs except
where the regex crate or plain semantic reasoning independently confirms rust is
wrong (for example BUG-3's `\z\A(?:a){0,1}`, confirmed by the regex crate). The
20 findings rest on the self-consistency oracles (a single engine contradicting
itself, which is unambiguous) plus the two confirmed differential classes
`RUST_PANIC` (BUG-2) and `RUST_TIMEOUT` (BUG-11).

## Lean ground-truth oracle

The Lean formalization in `~/Downloads/extended-regexes` (Zhuchko, Veanes,
Ebner, the verified ERE semantics) is now built and wired up as a bulk oracle.
A Python translator (`/tmp/agent/re2lean.py`) turns a non-anchor RE# pattern
into a Lean `RE (BA Char)` term; `/tmp/agent/gen_lean.py` emits one
`#eval (llmatch term input).isSome` per (pattern, input) pair; the results are
diffed against rust default-mode is_match by `/tmp/agent/diff_lean.py`. The
formalization has no anchor primitives, so this covers the non-anchor space
(literals, classes, `.`/`_`, `&`, `~`, `|`, quantifiers, lookarounds).

Result: over 6185 non-anchor pairs, rust disagreed with the ground truth on
exactly one class, BUG-12 (11 distinct triggers). This both found a new bug and
gave positive evidence that rust's non-anchor is_match is otherwise correct on
the sampled space. The oracle is the right next tool to extend (more patterns,
longer haystacks, and match-position comparison, not just existence).

## Status

Campaign in progress. This index and the per-bug files are updated as new
distinct root causes are confirmed.
