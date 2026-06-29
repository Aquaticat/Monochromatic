# Re-verification of the 2026-06-11 findings against 0.6.13

Every finding from `../resharp-fuzz-2026-06-11/` re-checked against 0.6.13,
 using
this campaign's lanes plus the focused probes in
`../resharp-fuzz-2026-06-11/verification-0.6.13.md` (last session).
 Summary first:
all crash and silent-soundness findings are fixed;
 the find_anchored and is_match
FAMILIES are narrowed but each has a still-live trigger this campaign isolated;
 the
compile-cost finding and the experimental stream finding persist as documented.

## Crash class: all fixed

- bug-04 reentrant union rewrite panic (`(.*.+)*.+`):
   fixed.
   No panic,
   debug or
  release;
   compiles and matches.
   The lookahead-in-union distribution landed in
  `eba778c`;
   the maintainer keeps the re-entrancy guard as an intentional
  debug-assert/release safety-net (issue #22),
   so it is not a removable defect.
- bug-05 rev_trivial debug_assert (`_*(?!_)`,
   `_*$`):
   fixed.
   The `rev_trivial`
  field and its `debug_assert!(false, ...)` were deleted in `fb82174`.
- bug-11 ldfa reverse/forward null-mismatch (`((?!a)|b)&(~((c)))`):
   fixed.
   No panic
  on either arch;
   the Lean lane confirms the positional class is sound.
- Older panic-fix-handover shapes (`(?:(?=a)&(?<=_))`,
   `(?:\w|$)(?:(?![1g]\_X)& a)`):
  fail closed at compile / saturate;
   no panic.

No crash of any kind was reproduced in this campaign:
 the in-tree fuzzers across
both arches produced only compile-cost slow-units,
 and the denotational and
self-consistency lanes hit 0 panics in debug across hundreds of millions of pairs.

## Silent-soundness class: fixed, formally confirmed

- bug-12 silent leftmost drop,
   bug-13 lookahead width leak:
   fixed.
   find_all returns
  the leftmost (0,0) matching the Lean ground truth;
   the Lean differential here
  reproduces 0 disagreements over 2310 lookaround-superset cases
  (`lean-differential.md`),
   and the denotational oracle reproduces 0 over 217M
  fragment pairs (`method-and-oracles.md`).
- bug-07 default-vs-hardened divergence:
   fixed.
   C4 in the self-consistency lane is
  0 violations over 6.9M pairs.
- bug-02 find_anchored phantom,
   bug-10 find_anchored non-maximal span:
   FAMILY
  narrowed but NOT eliminated.
   0.6.13 fixed the specific 06-11 minimals (the
  `(?<=a)`/`\BU` phantoms now fail closed;
   the `~(.{1,3}\z){2,4}` span now agrees),
  but this campaign found a still-live trigger in the same family:
   `(\z|$)$` gives a
  phantom or missing find_anchored span.
   See
  `bug-find-anchored-end-anchor-union.md`.
- bug-08 is_match-vs-find_all inconsistency:
   FAMILY narrowed but NOT eliminated.
   The
  06-11 minimal no longer reproduces,
   but `_&(?:[ab]|$)?` is a still-live is_match
  false positive.
   See `bug-is-match-false-positive-inter-optional-end-anchor.md`.

## Perf class

- bug-09 dot-literal concat compile blowup:
   fixed (40s+ -> 0.29s).
   See
  `compile-cost-recheck.md`.
- bug-06 full-Unicode `\w{N}` compile cost:
   still live,
   bounded (peak ~4.7s near
  N=24,
   cliffs to ~0.4s at N>=32),
   maintainer-acknowledged and deferred.
   Same doc.

## SIMD class

- arm-bug-01 SIMD find_all offset-1 zero-width drop (`^$` on `"\n\n"`):
   fixed.
   The
  stock NEON path returns the full correct `[(0,0),(1,1),(2,2)]`;
   the in-tree
  `simd_diff` (fast-vs-slow) target is clean on both NEON and AVX2 across ~670k
  executions.
   See `coverage-and-limits.md` for the SIMD-coverage caveat (the
  has_simd on/off re-vendor was not redone;
   deprioritized).

## Stream class

- bug-03 stream phantom zero-width:
   still present,
   by design.
   The `stream` feature
  is gated experimental and off by default;
   see `stream-experimental.md`.

## Net

The 0.6.13 fixes hold:
 every crash and silent-find_all-soundness finding from the
two prior campaigns is gone,
 two of them formally confirmed by the Lean oracle.
 The
residue is the bug-02/08/10 long tail surfacing on new end-anchor compositions in
`find_anchored` and `is_match` (the two findings here),
 plus the acknowledged
compile cost and the experimental stream feature.
