# Test-coverage gaps (v0.6.12)

Gaps that let this campaign's findings ship.
 Each maps to a specific finding and
a concrete test that would have caught it.

## No SIMD-on-vs-SIMD-off differential

`simd/neon.rs` has an extensive unit suite (`neon_movemask`,
 chunk-boundary,
size-sweep,
 Teddy 1/2/3,
 "finds first / finds last" tests).
 It tests the
intrinsics that locate candidate bytes in isolation,
 and they are correct.
 It
does not test the `find_all` driver's use of those candidates,
 which is where
arm-bug-01 lives (`fwd_lb_prefix_impl`).
 The single test that would have caught it
is a differential:
 for a corpus of (pattern,
 haystack),
 assert
`find_all` is identical with the prefilter enabled and disabled.
 There is no hook
to disable the prefilter (this campaign added an atomic override),
 and no such
test,
 so a prefilter-driver soundness bug is invisible to the suite.

Concrete missing case:
 `Regex::new("^$").find_all(b"\n\n")` must be
`[0:0, 1:1, 2:2]`.
 The accelerated path returns `[0:0, 2:2]`.

## No cross-API consistency on zero-width / anchor patterns

`find_all`,
 `find_anchored`,
 `stream`,
 and `is_match` must agree on existence and
(for purely zero-width patterns) on positions.
 There is no test sweeping
anchor / boundary / lookaround patterns over newline-and-boundary haystacks and
cross-checking the four APIs.
 Such a sweep is exactly what surfaced bug-02
(`find_anchored` vs `is_match`),
 bug-03 (`stream` vs `find_all`),
 and bug-08
(`is_match` vs `find_all`).
 The invariants are cheap to assert
(`find_anchored = Some` implies `is_match`;
 `find_all` empty implies `stream`
empty;
 `is_match` equals `!find_all.is_empty()`).

## Regression tests for 06-04 fixes were too narrow

- BUG-20 (find_anchored leading assertion):
   the v0.6.12 fix makes `\B0` on `"00"`
  correct but leaves `(?<=a)` on `"b"` and `\BU` on `"U"` broken (bug-02).
   A
  regression test pinned to the one reported instance,
   not the assertion class.
- BUG-1 (re-entrancy panic):
   `.*(.+)*.+` is fixed but `(.*.+)*.+` and ~165 other
  nested-quantifier shapes still panic (bug-04).
   The fix did not add a fuzz seed
  corpus or a property test over the trigger family.
- BUG-8 / BUG-3 (default-vs-hardened,
   is_match-vs-find_all):
   fixed for the
  reported triggers,
   live on new ones (bug-07,
   bug-08).
   No property test that
  these invariants hold over a generated corpus.

The pattern:
 each 06-04 fix added a point regression test for the exact
reproducer rather than a property test over the family,
 so the engine re-breaks
the same invariant on a neighbouring input.

## The `rev_trivial` non-hardened find_all path is untested

`debug_assert!(false, "found bug: this path should be eliminated")` at
`lib.rs:1824` is reached by `_*$` (bug-05),
 so no test exercises `find_all` on a
`rev_trivial` pattern in a non-hardened config;
 if one did,
 it would have fired
the assertion in CI (cargo-fuzz and tests run with debug-assertions on).

## Full-mode compile-cost has no upper-bound test

`\w{n}` under `unicode(Full)` costs ~0.14s per repeat (bug-06),
 so `\w{8}` is
already 1.1s,
 above the engine's own "limits enabled => under 1s" invariant.
 A
compile-time budget assertion over the class set under each unicode mode (the
`--time1` style oracle) would catch this and similar per-repeat-cost regressions.

## Recommended additions

- A SIMD differential test (prefilter on vs off) over a shared corpus.
- A four-API cross-consistency property test over an anchor / boundary /
  lookaround / newline corpus.
- Property tests (not point tests) for the BUG-1,
   BUG-3,
   BUG-8,
   BUG-20 families,
  seeded from the reproducer shapes.
- A compile-time budget assertion per unicode mode for bounded repeats of the
  large classes (`\w`,
   `\W`,
   `\D`,
   `\S`).
