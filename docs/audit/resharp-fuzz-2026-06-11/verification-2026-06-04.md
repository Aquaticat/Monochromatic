# Verification of the 2026-06-04 findings against v0.6.12

Every 2026-06-04 reproducer was rerun against v0.6.12 (`3d4ddde`) with the
`repro` harness (release, debug-assertions and overflow-checks on, matching the
cargo-fuzz profile). Nothing is assumed fixed; each verdict cites the actual
v0.6.12 output. The developer's "all fixed, and some more" claim holds for most,
but four families are still live on new triggers (see the LIVE entries, written
up as bug-02 / bug-04 / bug-07 / bug-08 and arm-bug-01).

## Fixed (verified correct on v0.6.12)

- BUG-2 (`correctness issue found` assert): `.\W*b+` on `"ba"` and `\S+b` on
  `b'_` now compile and match with no panic. Fixed.
- BUG-3 (is_match vs find_all): `(\z|(?=a)\w)` on `"a"` is now self-consistent
  (`im=true`, `fa=0:1,1:1`); `\BU` on `"Uii\"` is `im=false`, `fa=[]`. The
  is_match/find_all contradiction is gone on these triggers. (A different
  contradiction survives on a new trigger: see bug-08; and `\BU` now exposes
  bug-02 in `find_anchored`.)
- BUG-7 (negated perl class nullable): `\D`, `\S`, `\W` in ascii no longer match
  the empty string (`is_match("") = false`). Fixed.
- BUG-9 (stream drops matches): `\A\z?` on `"a"` now streams `0:0` (non-empty).
  Fixed for this trigger. (Stream zero-width correctness is still broken on
  leading assertions: bug-03.)
- BUG-12 (neg-lookahead nullable): `(?!\w)0+` on `""` is `is_match=false`. Fixed.
- BUG-13 (lookahead width leak): `(?=(?=c)c{1,3})` on `"c"` is `fa=[0:0]`. Fixed.
  (The stream side of this pattern is wrong: bug-03.)
- BUG-15 (stream DFA construction panic): `a&b` `stream(b"aaa")` no longer panics
  (`im=false`, `stream=[]`). Fixed.
- BUG-18 (find_all nullable complement quadratic): `~(a+)` `find_all` on 98304
  bytes is 0.003s (was 10.5s). Fixed.
- BUG-21 (lazy DFA cache contamination): `\Bb` `is_match("ba")` repeated is
  `false`, `false`; no `usize::MAX` leak. Fixed.
- BUG-22 (fwd-prefix rescan quadratic): `(a+)+b` `is_match` on 65536 bytes is
  0.0002s (was 4.4s). Fixed.
- BUG-26 (end-then-begin anchor empty language): `\z\A` on `""` is `im=true`,
  `fa=[0:0]`. Fixed.
- BUG-27 (word boundary nullability under composition): `\ba{0}\b` on `""` is
  `im=false`; `\Ba{0}\z` on `""` is `im=true`. Fixed.
- REG-1 (duplicate zero-width find_all spans): `(?!\A)` on `"ab"` is
  `fa=[1:1, 2:2]` (no duplicate `1:1`). Fixed. (The stream side is wrong: bug-03.)

## Still live (reproduced on v0.6.12 with new triggers)

- BUG-1 (re-entrancy guard panic): LIVE. The exact 06-04 minimal `.*(.+)*.+` now
  compiles, but `(.*.+)*.+` and ~165 other nested-quantifier patterns still panic
  at `resharp-algebra/src/lib.rs:2724`. Written up as bug-04.
- BUG-20 (find_anchored ignores a leading assertion): LIVE. The `\B0` instance is
  fixed, but leading lookbehind `(?<=a)` and `\B`-before-word-char (`\BU`) still
  return a phantom `find_anchored` match while `is_match=false`. 122 triggers.
  Written up as bug-02.
- BUG-8 / BUG-10 (default vs hardened find_all): LIVE. The 06-04 triggers are
  consistent now, but `~(\A|\n+){2}` on `"\n\n"` gives default `[1:1,2:2]` vs
  hardened `[2:2]`. Written up as bug-07.
- BUG-3 (is_match vs find_all), second face: LIVE on a new trigger.
  `[0-9]{2}~(\z{1,3}|^{2}\W{0})+` in the flags config on `"00"` gives
  `is_match=false` but `find_all=[0:2]`. Written up as bug-08.

## Avoided by parser rejection (behaviour change, not an engine fix)

These 06-04 patterns no longer compile; v0.6.12 rejects them rather than fixing
the engine path. The defect is avoided for the exact pattern but the capability
is lost, and the underlying path may still be reachable by patterns that do
compile.

- BUG-4 (`~(_*$)`): now `Algebra(UnsupportedPattern)`. The sentinel leak is
  avoided by refusing lookaround / `\b` / `^` / `$` inside a complement.
- BUG-14 (`(|(?<=[a-z])b)`): now `Algebra(UnsupportedPattern)`.
- BUG-16 (`(?<=$)`): now `Parse(UnsupportedResharpRegex)`. The superlinear match
  is avoided by rejecting lookbehind-of-anchor.

## Performance re-measurement

- BUG-11 / BUG-17 (bracketed perl-class repeat blowup): FIXED.
  `[\w]{3,5}[\w]([^a]&a+)` compiles in 0.010s (was ~4s); `([\w]{3,5}){3,3}` in
  0.014s (was 15.3s).
- BUG-19 (full-mode anchor + word class match cost): much improved. `$?\w`
  `is_match` over cyc(16384) in full mode is 0.38s (was ~3s). Below the 1s bar on
  this size; not filed.
- BUG-23 (full-unicode word class bounded repeat): the super-linear blowup is
  FIXED, but a linear ~0.14s-per-repeat compile cost remains and still crosses
  the 1s limits-enabled bar (`\w{8}` = 1.1s, `\w{24}` = 3.3s in full mode).
  Written up as bug-06.
