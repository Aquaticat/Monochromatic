# Coverage and limits

What this campaign covered,
 and the honest gaps.
 A mostly-clean result at this
depth raises confidence in 0.6.13;
 it does not prove soundness,
 and the limits
below bound exactly what the confidence covers.

## Covered

- Two architectures:
   x86_64 (AVX2) and Apple M1 (AArch64,
   NEON).
   Both findings
  reproduce byte-identically on both,
   so they are arch-independent;
   the SIMD
  fast-vs-slow `simd_diff` target is clean on both.
- find_all correctness on the conservative fragment plus the no-lookaround slice
  of the accepted superset (intersection,
   complement,
   zero-width):
   217,754,018
  pattern-input pairs (denotational oracle),
   0 disagreements,
   release and debug.
- find_all correctness on the lookaround superset (positive/negative lookahead and
  lookbehind,
   intersection,
   complement):
   2310 comparable cases against the
  formally-verified Lean `llmatch`,
   0 disagreements.
- Engine-internal contracts (is_match,
   find_anchored,
   default==hardened,
   stream)
  across all four unicode modes and hardened/default,
   over the full anchor and
  lookaround superset:
   6,899,984 pairs.
   Found the first two reported bugs;
   C4 clean.
- Anchor-extended denotational oracle (`tools/anchor_denot.rs`),
   added after the
  "have we exhausted findings?
  " review to close the primary oracle's anchor blind
  spot (no anchor nodes,
   alphabet `abc`).
   Independent membership ground truth for
  `\A \z ^ $` (multiline) over alphabet `ab\n`,
   validated against the `regex` crate
  `(?m)`,
   positive-control proven to re-find the two known bugs.
   Gave the FIRST
  independent check of anchored `find_all` (self-consistency is circular for
  find_all;
   Lean was partial) and found the third bug.
   The anchor family is clean
  against the model except that third bug and the anchor-inside-intersection
  definitional zone (resharp self-consistent there;
   textbook vs positional anchor
  semantics,
   not adjudicated as a bug).
- The four in-tree libFuzzer targets on both arches,
   millions of executions,
   0
  crashes (only compile-cost slow-units).
- Compile-cost curve for the one acknowledged perf residual;
   full re-verification
  of all 13 prior-campaign findings.

## Gaps

- SIMD on/off at the `has_simd()` granularity was NOT re-vendored this campaign.
  06-11 patched a copy of the engine with an atomic `has_simd()` override to run a
  true scalar-vs-SIMD differential.
   Here,
   coverage rests on the in-tree `simd_diff`
  target (prefilter-accelerated vs unaccelerated `find_all`,
   clean on both arches)
  plus the arm-bug-01 reverification via the stock NEON path.
   The maintainer's
  position is that the scalar fallback "was never meant to be used;
   the DFA
  algorithm is the scalar fallback",
   so the in-tree differential is the meaningful
  check;
   still,
   a from-scratch has_simd on/off sweep was deprioritized and not run.
- Small alphabets.
   The denotational lane used `a b c`;
   the self-consistency and
  Lean lanes used `a b \n`.
   Full multi-byte UTF-8 matching (the `unicode=Full` `\w`
  world) is exercised by the in-tree fuzzers and the compile-cost lane,
   but NOT by
  the denotational position differential (which used ASCII so substring membership
  is closed).
   Multi-byte position correctness is therefore less independently
  adjudicated than ASCII.
- Bounded input lengths (exhaustive to 5-6 bytes).
   All three findings are small,
  but a bug requiring a long haystack would be missed.
- Positional correctness of the unfaithful (trust1) zone is now PARTIALLY
  adjudicated.
   The anchor-extended oracle added independent ground truth for
  `\A \z ^ $` over `ab\n` and found the third bug there;
   but two corners remain
  unadjudicated:
   (a) anchors inside complement (kept out of the primary generator;
  the model's complement-of-zero-width semantics is a definitional guess and
  resharp rejects much of it),
   and (b) the anchor-inside-INTERSECTION definitional
  zone,
   where resharp is self-consistent across all APIs but diverges from the
  textbook zero-width-language model (positional vs language semantics).
   Which is
  the intended semantics is a question for the maintainer / POPL'25 definitions,
  not resolved here.
   Lookbehind-of-lookaround and the dotnet tie-breaker (retired)
  remain as 06-11 flagged.
- Lean coverage is partial:
   of 6000 generated lookaround-superset cases,
   2892 were
  evaluated by the harvest point (the Lean leftmost-longest matcher has exponential
  complexity and is slow on complement-heavy cases).
   0 disagreements over the 2310
  comparable,
   but the full batch was not exhausted.
- Unknown bugs.
   This is a known-class plus coverage-guided search.
   The bug-02/08/10
  families were narrowed across campaigns (27 root causes,
   then 13,
   then 3 this
  round),
   but each campaign keeps finding tail triggers,
   so the frontier is open;
  "no known bug fires" is not "sound".
   The third finding here is direct evidence:
  it was invisible to every lane until new (anchor) oracle machinery was built.

## Stopping condition

Two stops,
 honestly distinct.
 The FIRST stop (the original two-finding writeup) was
premature on the completeness question:
 it rested on lanes that could not see a
coordinated `find_all`/`is_match` false negative (the denotational oracle had no
anchors;
 self-consistency is circular for find_all).
 The "have we exhausted
findings?
" review reopened it,
 the anchor-extended oracle was built,
 and it found
the third bug on the first bounded pass.
 The SECOND (current) stop:
 the anchor
oracle's `find_all`-vs-model check is clean except the third bug and the
definitional anchor-in-intersection zone;
 the routing prototype for the third bug
was tried and shown insufficient (the fix is algebra-deep,
 issue #22),
 so further
same-shape iteration converges rather than finds.
 Remaining risk lives in the gaps
above (multi-byte,
 anchor-in-complement,
 the intersection-anchor definitional
question,
 long inputs,
 unknowns),
 which need new oracle machinery or maintainer
semantics input,
 not more of the same.
