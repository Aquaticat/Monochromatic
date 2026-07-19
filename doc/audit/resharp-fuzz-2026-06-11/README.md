# Resharp fuzz campaign 2026-06-11 (ARM64 NEON, plus full re-audit)

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Findings from a fresh fuzz campaign against `ieviev/resharp` v0.6.12 (`3d4ddde`,
tag `v0.6.12`) run on an Apple M1 (AArch64,
 NEON SIMD) host and a x86_64 (AVX2)
host.
 The campaign was motivated by the SIMD divergence angle (resharp has
distinct NEON and AVX2 code),
 but it also re-verified every 2026-06-04 finding
and ran the coverage-guided and oracle lanes broadly.
 The developer stated that
all 27 bugs from the 2026-06-04 campaign,
 "and some more,
" were fixed in
v0.6.12;
 this campaign treats that claim as unverified and checks it.

The weaker concurrent agent's output is quarantined under
`doc/audit/bad-glm-resharp-fuzz-2026-06-10/` and should not be trusted (see its
banner).
 Nothing here depends on it.

## Headline

Thirteen findings on v0.6.12,
 but they are not all the same weight,
 and the
honest split (established by cross-checking every minimal against the dotnet
`resharp` reference,
 which is ieviev's other implementation of RE#) is the main
result.
 See `dotnet-adjudication.md` for the full table.

### The load-bearing core (within the reference's supported subset)

These hold without any external ground truth;
 the reference accepts the same
pattern and either crashes-where-rust-crashes-not or agrees with rust's own
contradicting query:

- `bug-04` (crash):
   `(.*.+)*.+` panics in rust (`resharp-algebra:2724`);
   the
  dotnet reference matches it cleanly (`[(0,3)]`).
   Reachable from ~165 fuzzer
  inputs.
   A compile-accepted pattern must never panic.
- `bug-05` (crash):
   `_*(?!_)` / `_*$` panics in rust (`resharp-engine:1824`);
   the
  reference matches it cleanly (`[(0,2),(2,2)]`).
- `bug-02` (soundness):
   `(?<=a)` on `"b"` -- rust `find_anchored=Some(0:0)` while
  rust `is_match=false`/`find_all=[]`,
   AND the reference agrees there is no match
  (`im=false`).
   A phantom anchored match,
   confirmed by both the engine's own
  contradiction and the reference.
- `bug-03` (soundness):
   `(?=c)` on `"c"` -- rust `find_all=[(0,0)]` (the reference
  agrees) but rust `stream` reports `1:1`.
   A clean internal `stream`-vs-`find_all`
  inconsistency.
- `bug-06`,
   `bug-09` (perf):
   compile-time blowups the reference does not share.
- `arm-bug-01` (SIMD soundness):
   a rust-internal NEON-on-vs-off `find_all`
  divergence on `^$`;
   independent of any reference.

### The secondary class (rust accepts patterns the reference rejects, then mishandles)

The dotnet reference REJECTS these construct classes at compile
(lookaround-in-union,
 nested lookarounds,
 anchor-in-complement,
 `\b`/`\B` away
from word boundaries).
 rust is deliberately more permissive:
 its own
`ensure_supported_rec` / `Compatibility::LookaroundUnion` guard
(`resharp-engine/src/lib.rs:762,772`) accepts them,
 then the engine fails:

- `bug-11` (crash):
   a lookaround-in-union pattern rust's guard accepts,
   then
  panics at `ldfa.rs:833/887/906`.
   A crash is a defect regardless of subset;
   rust
  should reject (as the reference does) or not crash.
- `bug-12`,
   `bug-13`,
   `bug-07`,
   `bug-08`,
   `bug-10` (soundness):
   rust accepts and
  returns a wrong span / drops a match / leaks width for patterns the reference
  rejects.
   These are implementation divergences (the Lean value corroborates that
  rust's result is wrong,
   but the reference's rejection means the right fix is
  most likely to reject the pattern,
   not to bless a particular span).

The `nulls`-slice analysis still cleanly separates bug-11 (forward-pass fault:
reverse proposes a start the forward scan then refuses) from bug-12 (reverse-pass
fault:
 the leftmost start is never proposed);
 that distinction is real,
 it just
sits inside the secondary class.

The 06-04 re-verification stands on its own (`verification-2026-06-04.md`):
 the
"all fixed" claim does not hold -- the re-entrancy compile panic (BUG-1 -> bug-04)
and the `find_anchored` leading-assertion bug (BUG-20 -> bug-02) are still live,
only narrowed.
 bug-02/03 (oracle-found) were also re-confirmed byte-identical on
the unmodified stock crate (`pristine-confirmation.md`).

## Root causes (this campaign)

This is the detailed catalog;
 read it with the tier split in the Headline and in
`dotnet-adjudication.md`.
 Load-bearing (within the dotnet reference's supported
subset):
 arm-bug-01,
 bug-02,
 bug-03,
 bug-04,
 bug-05,
 bug-06,
 bug-09.
 Secondary
(the reference rejects the pattern at compile;
 rust accepts and crashes or
miscomputes):
 bug-07,
 bug-08,
 bug-10,
 bug-11,
 bug-12,
 bug-13.

- `arm-bug-01` (soundness,
   SIMD path):
   the prefilter-accelerated `find_all`
  driver `fwd_lb_prefix_impl` drops the match at offset 1 immediately after a
  leading zero-width match.
   `^$` on `"\n\n"` returns `[0:0, 2:2]` with SIMD on
  and `[0:0, 1:1, 2:2]` with SIMD off.
   Root cause `resharp-engine/src/fwd.rs:123`
  (`search_start = if max_end == 0 { 1 }` overshoots the lookbehind candidate at
  byte 0).
   Found by the same-machine NEON-on-vs-off differential AND the
  `simd_diff` libFuzzer target;
   identical on AVX2,
   so the defect is in the
  arch-independent driver,
   not the intrinsics.
   One-line fix verified.
- `bug-02` (soundness):
   `find_anchored` returns a phantom match at offset 0 for a
  leading zero-width assertion that is false there.
   `(?<=a)` on `"b"` and `\BU`
  on `"U"` both return `find_anchored = Some(0:_)` while `is_match = false` and
  `find_all = []`.
   122 distinct triggers (93 leading lookbehind,
   plus `\b`/`\B`).
  This is the 06-04 BUG-20,
   only partially fixed (the `\B0` instance).
- `bug-03` (soundness):
   `stream` reports phantom zero-width matches at the wrong
  positions and misses the real ones.
   `(?=c)` on `"c"` streams `1:1` (should be
  `0:0`);
   `\b` on `"ab"` streams `1:1,2:2` (should be `0:0,2:2`);
   `(?!\A)` on
  `"ab"` streams `0:0,2:2` (should be `1:1,2:2`).
- `bug-04` (crash / compile DoS):
   the re-entrancy guard panic at
  `resharp-algebra/src/lib.rs:2724` ("reentrant union rewrite ... this is a bug,
  please file an issue") is still reachable from user patterns.
   Minimal
  `(.*.+)*.+`.
   ~165 distinct fuzzer triggers.
   This is the 06-04 BUG-1,
   narrowed
  (the exact `.*(.+)*.+` now compiles) but not eliminated.
- `bug-05` (crash / reachable invariant):
   `find_all` on a `rev_trivial` pattern
  in a non-hardened config hits `debug_assert!(false, "found bug: this path
  should be eliminated")` at `resharp-engine/src/lib.rs:1824`.
   Trigger `_*$`.
   A
  panic in any debug-assertions build;
   a dead branch the engine fell through in
  release.
- `bug-06` (performance / compile DoS):
   full-unicode `\w` (and `\b\w`) bounded
  repeat costs ~0.14s per repeat at compile time (`\w{8}` = 1.1s,
   `\w{24}` = 3.3s
  under `unicode(Full)`,
   limits enabled).
   Default and ascii are instant.
   The
  06-04 BUG-23 super-linear blowup is gone,
   but the linear-with-large-constant
  cost still crosses the 1s "limits-enabled" bar and scales to a 10s+ DoS within
  the `{0,500}` repeat cap.
   The `compile` libFuzzer target's timeouts are
  dominated by this family.
- `bug-07` (soundness):
   default and hardened `find_all` disagree.
   `~(\A|\n+){2}`
  on `"\n\n"` is `[1:1, 2:2]` by default and `[2:2]` hardened (hardened drops the
  `1:1` match).
   Hardening only swaps the scan algorithm,
   not the language,
   so one
  side is wrong.
   The 06-04 BUG-8 family,
   still live.
- `bug-08` (soundness):
   `is_match` disagrees with `find_all`.
  `[0-9]{2}~(\z{1,3}|^{2}\W{0})+` in the flags config on `"00"` returns
  `is_match = false` while `find_all = [0:2]`.
   The 06-04 BUG-3 family,
   still live.
- `bug-09` (performance / compile DoS):
   a dot-and-literal concatenation hangs
  compile 40s+ (71s for the fuzzer's full unit) under full and javascript mode,
  instant under default/ascii/hardened.
   `.n.................  n.` is a 23-char
  trigger with no unbounded quantifier.
   A threshold blowup of the wide
  full/javascript `.` minterm in the derivative construction,
   distinct from
  bug-06's `\w`-repeat cost.
- `bug-10` (soundness):
   `find_anchored` returns a strictly shorter span than
  `find_all`'s longest match at offset 0.
   `~(.{1,3}\z){2,4}` on `"ab"` gives
  `find_all = [0:2, 2:2]` but `find_anchored = Some(0:1)`.
   The 06-04 BUG-13/14
  span-disagreement family,
   still live on complement-with-end-anchor patterns (30
  triggers).
   Distinct from bug-02 (existence) -- here a match exists,
   the start
  agrees,
   only the length disagrees.
- `bug-11` (crash / soundness):
   `find_all`'s reverse pass proposes a null match
  start the forward pass then rejects,
   violating the coupling invariant asserted
  at `resharp-engine/src/ldfa.rs:833/887/906`.
   `((?!a)|b)&(~((c)))` on `"abca"`
  panics in any debug-assertions build (`debug_assert_ne!(NO_MATCH, l_max_end)`);
   in
  release the guard drops the unconfirmed start,
   so `find_all` silently omits a
  real match (`"ca"` -> `[(2,2)]`,
   dropping the leftmost `(0,0)`;
   Lean ground
  truth `0:0`).
   Needs a zero-width-nullable alternation intersected with a
  complement.
   Found by the Lean position lane (case R1612);
   the third distinct
  crash site.
   See `bug-11-ldfa-reverse-forward-null-mismatch.md`.
- `bug-12` (soundness,
   silent):
   `find_all` silently drops the leftmost match,
  with NO panic in any build (debug or release),
   the worse-for-consumers sibling
  of bug-11.
   `((?!b)|ba)&(aa)?` on `"abab"` returns `[(4,4)]` but the Lean
  ground-truth leftmost is `0:0`;
   on `"ab"` it returns `[(2,2)]`,
   dropping
  `(0,0)`.
   Verified cause (reverse-pass fault):
   the reverse pass under-collects,
  handing `scan_fwd_all` `nulls=[4]` (offsets 0 and 2,
   both real matches per Lean,
  never proposed),
   so no forward check and no assert.
   Toggling `(aa)?` to `(aa)*`
  flips it to bug-11's forward-pass fault (`nulls=[4,2,0]`:
   0 is proposed and is a
  real match,
   but the forward scan returns `NO_MATCH` for it and panics).
   Found by
  the Lean position lane (seed-1001 R2280).
   See
  `bug-12-findall-silent-leftmost-drop.md`.
- `bug-13` (soundness,
   silent):
   intersection with an optional lookahead leaks the
  consuming width,
   so `find_all` and `find_anchored` return a span too LONG (the
  opposite direction from bug-11/12).
   `a?&(?=a)?` on `"ab"` returns
  `[(0,1),(1,1),(2,2)]` and `find_anchored=Some((0,1))`,
   but the language is
  zero-width-only (`a?`'s width-1 cannot equal the lookahead's zero-width span),
  so the leftmost is `0:0` (Lean).
   General fault:
   in `X & Y`,
   a satisfied
  zero-width lookahead on one side paired with a consumed char on the other leaks
  the width;
   two confirmed forms,
   `a?&(?=a)?` (nullable consuming) and
  `(\W|(?!c))&a` (lookahead as an alternation branch,
   consuming side not
  nullable).
   Unsatisfied lookahead is correct (`a?&(?=c)?`).
   Same
  lookahead-width-leak theme as 2026-06-04 BUG-13 but a distinct,
   live
  intersection trigger.
   Found by the Lean position lane (seed-4004 R48,
   seed-5005
  R292).
   See `bug-13-intersection-optional-lookahead-width-leak.md`.

## Method

Four lanes,
 all on v0.6.12.

### The SIMD differential (the headline oracle)

`has_simd()` (`resharp-engine/src/simd/mod.rs:7`) is hardcoded `true` on aarch64,
so the scalar fallback is never taken on the M1 in a stock build.
 There are
exactly four `has_simd()` consult sites,
 and at each the SIMD branch is an
acceleration whose scalar fallback is "no acceleration" (no reimplementation):
forward literal/rare-byte prefilter (`prefix.rs:430`),
 reverse Teddy/anchored
prefix (`prefix.rs:796`),
 lazy-DFA skip table (`ldfa.rs:458`),
 bounded-DFA prefix
(`bdfa.rs:80`).
 So for the same (pattern,
 haystack,
 config),
 `is_match`,
`find_all`,
 `find_anchored` must be byte-identical with `has_simd()` true vs
false on the same machine;
 any divergence is an unambiguous accelerated-path bug,
needing no external reference.

The instrumented engine (`tools/resharp-instr`) exposes an atomic override
(`instr_set_override`) and per-subsystem "prefilter actually built" counters
(`instr_counters`) so a null result is reported as "tested N prefilter-active
cases",
 never the vacuous "0 divergences over cases that built no prefilter".
 On
the directed corpus,
 99.2% of cases were prefilter-active,
 so the SIMD nulls are
meaningful.
 The single SIMD root cause (`arm-bug-01`) was confirmed identical on
NEON and AVX2,
 proving it lives in the arch-independent `find_all` driver,
 not in
`neon.rs`/the AVX2 intrinsics.

### Self-consistency and stream/anchored oracles

For each pattern and a haystack battery,
 across all seven configs:
 BOUNDS,
OVERLAP,
 INCONSIST,
 ANCHOR,
 plus FANINCONSIST (`find_anchored = Some` while
`is_match = false`),
 FANDIFF,
 STREAMPHANTOM (`find_all` empty but `stream`
non-empty),
 STREAMINCONSIST,
 and HARDDIFF (default vs hardened).
 These need no
external reference.
 Over a 40k-pattern randomized adversarial corpus they
produced bug-02,
 bug-03,
 bug-07,
 and bug-08.

### Coverage-guided libFuzzer

The three in-tree targets (`compile`,
 `match_invariants`,
 `diff_regex`) plus a
new `simd_diff` differential target (`tools/resharp-instr/fuzz`),
 with
AddressSanitizer.
 `diff_regex` produced ~120 inputs all hitting bug-04;
`match_invariants` produced bug-05;
 `compile` produced the bug-06 timeouts;
`simd_diff` produced arm-bug-01 on the M1.

### Lean position-level differential (the external-reference lane)

The internal oracles above cannot catch a result that is self-consistent but
positionally wrong.
 The 2026-06-04 Lean ground-truth pipeline (re2lean / gen_lean
/ diff_lean) was reconstructed AST-first:
 `tools/lean/gen_lean_ast.py` builds
random RE ASTs and serializes each to BOTH a fully-parenthesized RE# string
(rust) and a Lean `RE (BA Char)` term (Lean),
 removing parser-precedence risk by
construction.
 `llmatch` (leftmost-longest first match) is compared against rust
default-config `find_all(w)[0]`.
 Cases are tagged trust0 (faithful) or trust1
(needs the dotnet adjudicator).
 `trust()` is context-aware:
 trust1 is assigned
for `^`/`$`/`\b`/`\B` anywhere,
 for `\A`/`\z` that appear INSIDE a complement or
lookbehind (anchor-in-negative-context / lookbehind-of-anchor),
 and for any
lookbehind whose body contains a lookaround.
 `\A`/`\z` as bare positive
assertions are faithful (`(?<!T)` / `(?!T)`) and stay trust0.
 This context rule
matters:
 an earlier flat "all anchors are trust1" missed
`((?<!(~(((?<!\d)))))))` (lookbehind-of-lookaround) as trust0,
 and a too-eager
"all `\A`/`\z` are trust0" mis-promoted `a(~(\z))` (complement-of-anchor).

Across the runs (first 1954-case run,
 then seeds 1001/2002/3003/4004 at depth<=5,
then a focused intersection/lookaround round),
 EVERY trust0 disagreement reduces
to a known root cause:
 bug-11 (R1612),
 bug-12 (R2280),
 bug-13 (R48,
 R292,
 R2739),
or bug-05 panics on new `_*(?!_)` / `((_)*)+(?!b)` / `\z`-in-complement triggers.
The faithful region is exhausted in that sense;
 the systemic finding is that
intersection with a zero-width operand (bug-13) is broad,
 recurring under many
surface forms.
 The focused round (3199 cases,
 the generation pass most biased
toward a 14th root cause) closed with `RUST_PANIC=0`,
 one trust0 phantom (R292,
bug-13 form B),
 and nothing new.
 Full method,
 trust-class definition,
 and the
focus-round table are in `lean-differential.md`.

Open frontier (NOT adjudicated):
 the trust1 complement-of-anchor cases
(`a(~(\z))` -> rust `[(0,1)]`,
 `b(~((c|\z)))` -> rust `1:2`) look like over-matches
of the 2026-06-04 BUG-4 family (complement-of-end-anchor),
 but complement-of-anchor
is exactly where the Lean translation faithfulness is unestablished,
 so they need
the dotnet engine as a tie-breaker before being claimed as bugs;
 recorded here as
suspects,
 not findings.
 The Lean toolchain runs on the M1 (elan + cached mathlib
oleans);
 tooling under `tools/lean/` (`gen_lean_ast.py`,
 `diff_lean.py`,
`leanrust`,
 `relprobe`,
 `nullsprobe`).

### ARM / x86 parity

The Lean lane ran the rust side on x86,
 but every Lean-found bug lives in
arch-independent code.
 bug-11/bug-12/bug-13 were rebuilt from pristine source on
the Apple M1 (aarch64) and reproduce byte-identically:
 bug-11 panics at
`ldfa.rs:906`,
 bug-12 returns `[(2,2)]` for `((?!b)|ba)&(aa)?` on `"ab"`,
 bug-13
returns `[(0,1),(1,1),(2,2)]` for `a?&(?=a)?` on `"ab"` -- the same as x86.
 This
is expected:
 they are in the lazy-DFA `ldfa.rs` driver,
 not the SIMD intrinsics.
arm-bug-01 remains the ONLY arch-specific finding (a SIMD-prefilter bug,
 and even
it is identical on NEON and AVX2,
 so the defect is in the arch-independent driver
that gates the prefilter).
 Net:
 the engine's correctness bugs are shared across
arches;
 the NEON vs AVX2 split surfaced one accelerator-gating bug,
 not a family.

### 2026-06-04 re-verification

Every 06-04 reproducer was rerun against v0.6.12 and classified fixed / live /
rejected / perf.
 See `verification-2026-06-04.md`.

## Reproducer tooling

All under `/tmp/agent` on the x86 host and mirrored to
`/Volumes/MacData/resharp-fuzz-v0.6.12-arm64-20260610/tools` on the M1:

- `resharp-instr`:
   v0.6.12 engine with the `has_simd()` atomic override and
  prefilter counters (the only change;
   semantics otherwise identical).
- `repro-simd`:
   the differential / oracle / verification binary.
   Modes:
  `--pair`,
   `--probe`,
   `--show`,
   `--reuse`,
   `--compile`,
   `--benchrep`,
  `--benchcyc`,
   `--patbatch`,
   `--oraclebatch`,
   `--batch`.
- `resharp-instr/fuzz`:
   the `simd_diff` libFuzzer target.
- `verify_0604.py`,
   `gen_simd_corpus.py`,
   `gen_adversarial.py`,
   `gen_big.py`:
  the verification driver and corpus generators.

The Lean formalization (`~/Downloads/extended-regexes`) is the position-level
ground-truth reference;
 the dotnet engine is a secondary cross-check only.
 Ten of
the thirteen bugs rest on a same-engine internal inconsistency (SIMD on vs off,
is_match vs find_all vs find_anchored vs stream,
 default vs hardened) or a panic,
so they need no external oracle.
 bug-11,
 bug-12,
 and bug-13 are the exceptions by
design:
 bug-11's crash is engine-internal (a `debug_assert_ne!` the engine trips
on itself) with only its release-mode soundness read off Lean;
 bug-12 and bug-13
have no crash at all,
 so their silent `find_all` soundness (a dropped match and a
too-long match respectively) is established purely against the Lean ground truth,
on trust0 anchor-free patterns where the translation is faithful.
 bug-11 and
bug-12 were additionally confirmed with the `nulls`-slice instrument,
 which is
engine-internal evidence of which pass (forward vs reverse) is at fault.
