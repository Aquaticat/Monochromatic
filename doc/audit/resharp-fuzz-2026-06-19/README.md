# Resharp fuzz campaign 2026-06-19 (vs shipped 0.6.13, two arches, formal oracle)

Fresh comprehensive campaign against `ieviev/resharp` at the version this workspace
ships:
 published `resharp 0.6.13` (commit `d89964b`),
 fuzzed at repo HEAD
`f0ce60a` which differs from `d89964b` only in test files (verified
`git diff --stat d89964b..f0ce60a` touches `resharp-engine/tests/*` only),
 so
fuzzing HEAD is behaviorally 0.6.13 with stronger in-tree assertions.

Run on two hosts:
 x86_64 (AVX2) and Apple M1 (AArch64,
 NEON SIMD).
 Motivated by
the standing question "is resharp bulletproof now";
 this campaign is the
empirical,
 multi-oracle answer for 0.6.13,
 at the depth of
`doc/audit/resharp-fuzz-2026-06-11/` (which targeted 0.6.12).

## Headline

The known-bug classes from the 2026-06-04 and 2026-06-11 campaigns are fixed in
0.6.13,
 confirmed by an independent formally-grounded oracle.
 THREE new live
correctness bugs were found (two in the first round,
 a third after extending the
denotational oracle to anchors),
 one acknowledged perf residual persists,
 and the
experimental `stream` feature remains phantom-prone by design.
 Net:
 0.6.13 is
substantially sound but NOT clean on the accepted-superset end-anchor zone:
 a
`find_anchored` phantom,
 an `is_match` false positive,
 and,
 most seriously,
 a
`find_all` FALSE NEGATIVE on intersection-with-end-anchor patterns.
 All three are
arch-independent and trace to anchors being dropped by forward simplification.

Update note:
 an earlier version of this README said "two" findings and called
`find_all` sound.
 The third finding (`find_all` false negative) was found later by
the anchor-extended oracle and supersedes the "find_all sound" claim for the
intersection-with-anchor zone.

Findings,
 by tier (adjudication rules in `method-and-oracles.md`):

- `bug-find-all-false-negative-inter-end-anchor-alternation` (NEW,
   live soundness,
  MOST SEVERE):
   `find_all` returns `[]` for `.&a(?:$|b)` on `"a\n"` although both
  operands (`.` and `a(?:$|b)`) individually match `(0,1)` per resharp's own
  `find_all`,
   and the subset `.&a$` returns `[(0,1)]`.
   A dropped match (fail-open
  direction) in the production API.
   Self-evident from resharp's own outputs
  (membership + monotonicity);
   no model needed.
   AVX2 and NEON identical,
   all four
  unicode modes.
   Root:
   `simplify_fwd_initial` drops the `$`-branch from the forward
  node;
   both Dfa and FwdPrefix paths then miss the end (the Dfa path has a
  debug-only tripwire at `ldfa.rs:844`;
   release silently returns `[]`).
   Not fixed
  by the routing prototype;
   needs an algebra-core fix (issue #22).
   It does NOT
  affect `forbidden-strings` (no intersection-with-anchor rules).
   See
  `bug-find-all-false-negative-inter-end-anchor-alternation.md`.

- `bug-find-anchored-end-anchor-union` (NEW,
   live soundness):
   `find_anchored`
  returns a phantom or missing span for the shape `(\z|$)$` (a union of end
  anchors concatenated with an end anchor).
   `find_all` and `is_match` are correct
  on the same pattern,
   so the defect is isolated to the `find_anchored` driver.
  Self-evident from internal inconsistency;
   no external oracle needed.
   Identical
  on AVX2 and NEON.
   This is the 06-11 bug-02 / bug-10 family,
   narrowed but not
  eliminated.
   See `bug-find-anchored-end-anchor-union.md`.
- `bug-is-match-false-positive-inter-optional-end-anchor` (NEW,
   live soundness):
  `is_match` returns true where `find_all` is empty and the language has no match,
  on `_&(?:[ab]|$)?` over inputs with `\n`.
   `find_all` is correct;
   `is_match` uses
  a separate forward path that over-accepts.
   Internal C1-contract violation;
   no
  external oracle needed.
   Identical on AVX2 and NEON.
   The 06-11 bug-08 family,
  narrowed but not eliminated.
   See
  `bug-is-match-false-positive-inter-optional-end-anchor.md`.
- `compile-cost-recheck` (KNOWN,
   acknowledged by maintainer,
   not fixed):
  full-Unicode `\w{N}` bounded-repeat compile time.
   Measured curve peaks at
  ~4.7s near N=24 then cliffs to ~0.4s at N>=32 (a strategy switch),
   while
  `\w{0,N}` stays ~0.1s.
   Bounded,
   not the open-ended DoS the 06-11 note implied.
  Surfaced as the single libFuzzer artifact (a compile slow-unit,
   not a crash).
  See `compile-cost-recheck.md`.
- `stream-experimental` (KNOWN,
   by design):
   the off-by-default `stream` feature
  reports phantom zero-width matches;
   upstream gates it "do not enable in
  production".
   Confirmed,
   catalogued,
   not counted as a new defect.
   See
  `stream-experimental.md`.

Everything else came back clean across a very large search (coverage in
`coverage-and-limits.md`).

## What was run

Six lanes,
 on both arches,
 against 0.6.13/HEAD.
 The sixth (anchor-extended
denotational oracle) was added after the "have we exhausted findings?
" review and
found the third bug.

- In-tree libFuzzer targets (`compile`,
   `diff_regex`,
   `match_invariants`,
  `simd_diff`) on AVX2 and NEON.
   Result:
   0 crashes;
   the only artifact is one
  `compile` slow-unit (the `\w` compile-cost family).
   The `simd_diff` target ran
  clean on both arches.
- Independent denotational oracle (the headline external check).
   An AST-first
  differential where membership of `s[i..j]` is computed by structural recursion
  (concat splits,
   `&`=and,
   `~`=not,
   `|`=or,
   `*`=fixpoint),
   memoized,
   then
  leftmost-longest `find_all[0]` / `is_match` / `find_anchored` derived on top and
  differentiated against resharp.
   Built denotationally on purpose:
   resharp IS
  Brzozowski derivatives,
   so a derivative oracle would share its blind spots.
  Validated against the `regex` crate (existence) before any disagreement was
  trusted.
   Result:
   ~200 million pattern-input pairs over 60 seeds,
   0
  disagreements (llmatch,
   is_match,
   find_anchored) and 0 crashes in the fragment
  plus the no-lookaround slice of the accepted superset (intersection,
  complement,
   zero-width).
   See `method-and-oracles.md`.
- Anchor-extended denotational oracle (`tools/anchor_denot.rs`),
   added to close the
  above oracle's anchor blind spot (it had no anchor nodes and alphabet `abc`).
  Adds `\A \z ^ $` (multiline default) to the membership model over alphabet
  `ab\n`,
   validated against the `regex` crate `(?m)` on the plain-anchor subset,
  with a positive control proving it re-finds the two known bugs.
   Result:
   ~7M
  pairs/run,
   found the third bug (`find_all` false negative),
   independently
  corroborated the other two,
   and otherwise confirmed `find_all` matches the model
  except in the anchor-inside-intersection definitional zone (where resharp is
  self-consistent across all APIs;
   a textbook-vs-positional anchor-semantics
  difference,
   not a bug).
   See `bug-find-all-false-negative-inter-end-anchor-alternation.md`.
- Engine-internal self-consistency lane over the anchor and lookaround superset
  the denotational oracle cannot reach:
   checks resharp's own asserted contracts
  against itself across all four unicode modes and hardened/default.
   Result:
   C1
  (is_match iff find_all non-empty) surfaced the new is_match bug;
   C2/C3
  (find_anchored vs find_all) surfaced the new find_anchored bug;
   C4
  (default == hardened) held with 0 violations;
   C5 is the experimental `stream`
  issue.
   Note:
   C1 could NOT catch the third (find_all) bug,
   because there is_match
  and find_all agree on the wrong answer;
   that needed the anchor-extended oracle.
  See `self-consistency.md`.
- Lean formal position differential.
   The 2026-06-11 Lean formalization
  (`extended-regexes`,
   the `Regex.MatchingAlgorithm` `llmatch`) was recovered and
  rebuilt on the M1 (mathlib cache),
   giving a formally-grounded ground truth for
  leftmost-longest first match.
   A fresh AST-first paired generator emits matched
  resharp strings and Lean terms for the lookaround superset (faithful zone).
   See
  `lean-differential.md`.
- Compile-cost characterization and a full re-verification of every 06-11
  finding against 0.6.13.
   See `compile-cost-recheck.md` and
  `verification-vs-2026-06-11.md`.

## Oracle strategy note: dotnet RE# is being retired

The 06-11 campaign leaned on `ieviev/resharp-dotnet` (the F# RE#) as an
adjudication oracle.
 The maintainer is retiring it (and has stated the long-term
plan is to make the Rust crate primary and have the dotnet engine call into it).
So this campaign does not build ground truth on the dotnet engine.
 Adjudication
rests instead on:
 the independent denotational oracle,
 the recovered Lean
formally-verified oracle,
 the `regex` crate (existence,
 on the plain subset),
engine self-consistency,
 and the documented supported subset
(`syntax.md`/`features.md`/`api.md`).
 The dotnet engine was used only as an
opportunistic secondary sanity check where convenient.

## Verdict

For 0.6.13 specifically:
 the crash,
 panic,
 and silent-mismatch classes from the
prior campaigns are all fixed,
 and `find_all` matches an independent oracle across
an extremely large search EXCEPT on the accepted-superset end-anchor zone,
 where
three live soundness defects remain:
 a `find_all` false negative on
intersection-with-end-anchor (`.&a(?:$|b)`,
 the most severe,
 fail-open in the
production API),
 a `find_anchored` phantom/missing span (`(\z|$)$`),
 and an
`is_match` false positive (`_&(?:[ab]|$)?`);
 plus one acknowledged bounded
compile-cost case and the experimental `stream` feature.
 All three new defects
trace to anchors dropped by forward simplification;
 the first is algebra-deep
(issue #22),
 the latter two are fixed by the committed prototype.
 This raises
confidence in 0.6.13 for anchor-free and simple-anchor patterns,
 but the
intersection-with-anchor corner is demonstrably not yet sound.
 It does not make
resharp "bulletproof":
 a young 0.
x engine with `unsafe` SIMD,
 no internal panic
boundary,
 an always-incomplete unknown-bug frontier,
 and now a known live
`find_all` soundness gap.
 Our consumer `forbidden-strings` is unaffected (no
intersection-with-anchor rules).
 See `../resharp-robustness-2026-06-19.md` for the
cross-cutting robustness assessment this campaign updates.
