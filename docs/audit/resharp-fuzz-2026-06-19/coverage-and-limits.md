# Coverage and limits

What this campaign covered, and the honest gaps. A mostly-clean result at this
depth raises confidence in 0.6.13; it does not prove soundness, and the limits
below bound exactly what the confidence covers.

## Covered

- Two architectures: x86_64 (AVX2) and Apple M1 (AArch64, NEON). Both findings
  reproduce byte-identically on both, so they are arch-independent; the SIMD
  fast-vs-slow `simd_diff` target is clean on both.
- find_all correctness on the conservative fragment plus the no-lookaround slice
  of the accepted superset (intersection, complement, zero-width): 217,754,018
  pattern-input pairs (denotational oracle), 0 disagreements, release and debug.
- find_all correctness on the lookaround superset (positive/negative lookahead and
  lookbehind, intersection, complement): 2310 comparable cases against the
  formally-verified Lean `llmatch`, 0 disagreements.
- Engine-internal contracts (is_match, find_anchored, default==hardened, stream)
  across all four unicode modes and hardened/default, over the full anchor and
  lookaround superset: 6,899,984 pairs. Found the two reported bugs; C4 clean.
- The four in-tree libFuzzer targets on both arches, millions of executions, 0
  crashes (only compile-cost slow-units).
- Compile-cost curve for the one acknowledged perf residual; full re-verification
  of all 13 prior-campaign findings.

## Gaps

- SIMD on/off at the `has_simd()` granularity was NOT re-vendored this campaign.
  06-11 patched a copy of the engine with an atomic `has_simd()` override to run a
  true scalar-vs-SIMD differential. Here, coverage rests on the in-tree `simd_diff`
  target (prefilter-accelerated vs unaccelerated `find_all`, clean on both arches)
  plus the arm-bug-01 reverification via the stock NEON path. The maintainer's
  position is that the scalar fallback "was never meant to be used; the DFA
  algorithm is the scalar fallback", so the in-tree differential is the meaningful
  check; still, a from-scratch has_simd on/off sweep was deprioritized and not run.
- Small alphabets. The denotational lane used `a b c`; the self-consistency and
  Lean lanes used `a b \n`. Full multi-byte UTF-8 matching (the `unicode=Full` `\w`
  world) is exercised by the in-tree fuzzers and the compile-cost lane, but NOT by
  the denotational position differential (which used ASCII so substring membership
  is closed). Multi-byte position correctness is therefore less independently
  adjudicated than ASCII.
- Bounded input lengths (exhaustive to 5-6 bytes). Both findings are small, but a
  bug requiring a long haystack would be missed.
- Positional correctness of the unfaithful (trust1) zone is NOT independently
  adjudicated: anchors inside complement, lookbehind-of-lookaround, and similar are
  where the Lean translation faithfulness is unestablished and the dotnet
  adjudicator (now being retired) was 06-11's tie-breaker. This campaign checked
  that zone only for crashes and internal contradictions (self-consistency lane),
  not for positional correctness. This is the same open frontier 06-11 flagged.
- Lean coverage is partial: of 6000 generated lookaround-superset cases, 2892 were
  evaluated by the harvest point (the Lean leftmost-longest matcher has exponential
  complexity and is slow on complement-heavy cases). 0 disagreements over the 2310
  comparable, but the full batch was not exhausted.
- Unknown bugs. This is a known-class plus coverage-guided search. The bug-02/08/10
  families were narrowed across three campaigns (27 root causes, then 13, then 2),
  but each campaign keeps finding tail triggers, so the frontier is open; "no known
  bug fires" is not "sound".

## Stopping condition

The denotational oracle exhausted the fragment with 0 new disagreements over 200M+
pairs; the self-consistency families converged on two minimized triggers; the Lean
lane reached 0 disagreements over thousands of comparable cases; the in-tree
fuzzers produced only compile-cost slow-units across millions of executions. At
that point additional same-shape fuzzing has diminishing returns; the remaining
risk lives in the gaps above (multi-byte, trust1 positional, long inputs,
unknowns), which would need new oracle machinery rather than more of the same.
