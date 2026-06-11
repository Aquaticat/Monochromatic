# Resharp fuzz campaign 2026-06-11 (ARM64 NEON, plus full re-audit)

Findings from a fresh fuzz campaign against `ieviev/resharp` v0.6.12 (`3d4ddde`,
tag `v0.6.12`) run on an Apple M1 (AArch64, NEON SIMD) host and a x86_64 (AVX2)
host. The campaign was motivated by the SIMD divergence angle (resharp has
distinct NEON and AVX2 code), but it also re-verified every 2026-06-04 finding
and ran the coverage-guided and oracle lanes broadly. The developer stated that
all 27 bugs from the 2026-06-04 campaign, "and some more," were fixed in
v0.6.12; this campaign treats that claim as unverified and checks it.

The weaker concurrent agent's output is quarantined under
`docs/audit/bad-glm-resharp-fuzz-2026-06-10/` and should not be trusted (see its
banner). Nothing here depends on it.

## Headline

Eleven distinct root causes were found and reproduced on v0.6.12, seven of them
soundness bugs and three of them crashes (`find_all` reverse/forward null
mismatch at `ldfa.rs:833/878/906` = bug-11, the algebra reentrant-union panic =
bug-04, the `rev_trivial` dead branch = bug-05). bug-11 was found by the
reconstructed Lean position-level lane and is the one finding the internal
oracles structurally cannot reach: `find_all` and `is_match` both crash in
debug-assertions builds, and in release `find_all` silently drops the leftmost
match (an internally-consistent-but-wrong result the position reference exposes). The
five oracle-only soundness bugs (bug-02/03/07/08/10) were
re-confirmed byte-identical on the *unmodified* stock crate (not just the
instrumented harness), and shown to survive the arm-bug-01 driver fix, so the
ten-distinct count is defensible; see `pristine-confirmation.md`. The "all
fixed" claim does not hold: the 2026-06-04 re-entrancy
compile panic (BUG-1) and the `find_anchored` leading-assertion bug (BUG-20) are
both still live, only narrowed; the default-vs-hardened `find_all` disagreement
(BUG-8) and the `is_match`-vs-`find_all` inconsistency (BUG-3) still occur on new
triggers. The full 06-04 fixed-versus-live verdict is in
`verification-2026-06-04.md` (most are genuinely fixed; the live ones are flagged
with reproducers).

## Root causes (this campaign)

- `arm-bug-01` (soundness, SIMD path): the prefilter-accelerated `find_all`
  driver `fwd_lb_prefix_impl` drops the match at offset 1 immediately after a
  leading zero-width match. `^$` on `"\n\n"` returns `[0:0, 2:2]` with SIMD on
  and `[0:0, 1:1, 2:2]` with SIMD off. Root cause `resharp-engine/src/fwd.rs:123`
  (`search_start = if max_end == 0 { 1 }` overshoots the lookbehind candidate at
  byte 0). Found by the same-machine NEON-on-vs-off differential AND the
  `simd_diff` libFuzzer target; identical on AVX2, so the defect is in the
  arch-independent driver, not the intrinsics. One-line fix verified.
- `bug-02` (soundness): `find_anchored` returns a phantom match at offset 0 for a
  leading zero-width assertion that is false there. `(?<=a)` on `"b"` and `\BU`
  on `"U"` both return `find_anchored = Some(0:_)` while `is_match = false` and
  `find_all = []`. 122 distinct triggers (93 leading lookbehind, plus `\b`/`\B`).
  This is the 06-04 BUG-20, only partially fixed (the `\B0` instance).
- `bug-03` (soundness): `stream` reports phantom zero-width matches at the wrong
  positions and misses the real ones. `(?=c)` on `"c"` streams `1:1` (should be
  `0:0`); `\b` on `"ab"` streams `1:1,2:2` (should be `0:0,2:2`); `(?!\A)` on
  `"ab"` streams `0:0,2:2` (should be `1:1,2:2`).
- `bug-04` (crash / compile DoS): the re-entrancy guard panic at
  `resharp-algebra/src/lib.rs:2724` ("reentrant union rewrite ... this is a bug,
  please file an issue") is still reachable from user patterns. Minimal
  `(.*.+)*.+`. ~165 distinct fuzzer triggers. This is the 06-04 BUG-1, narrowed
  (the exact `.*(.+)*.+` now compiles) but not eliminated.
- `bug-05` (crash / reachable invariant): `find_all` on a `rev_trivial` pattern
  in a non-hardened config hits `debug_assert!(false, "found bug: this path
  should be eliminated")` at `resharp-engine/src/lib.rs:1824`. Trigger `_*$`. A
  panic in any debug-assertions build; a dead branch the engine fell through in
  release.
- `bug-06` (performance / compile DoS): full-unicode `\w` (and `\b\w`) bounded
  repeat costs ~0.14s per repeat at compile time (`\w{8}` = 1.1s, `\w{24}` = 3.3s
  under `unicode(Full)`, limits enabled). Default and ascii are instant. The
  06-04 BUG-23 super-linear blowup is gone, but the linear-with-large-constant
  cost still crosses the 1s "limits-enabled" bar and scales to a 10s+ DoS within
  the `{0,500}` repeat cap. The `compile` libFuzzer target's timeouts are
  dominated by this family.
- `bug-07` (soundness): default and hardened `find_all` disagree. `~(\A|\n+){2}`
  on `"\n\n"` is `[1:1, 2:2]` by default and `[2:2]` hardened (hardened drops the
  `1:1` match). Hardening only swaps the scan algorithm, not the language, so one
  side is wrong. The 06-04 BUG-8 family, still live.
- `bug-08` (soundness): `is_match` disagrees with `find_all`.
  `[0-9]{2}~(\z{1,3}|^{2}\W{0})+` in the flags config on `"00"` returns
  `is_match = false` while `find_all = [0:2]`. The 06-04 BUG-3 family, still live.
- `bug-09` (performance / compile DoS): a dot-and-literal concatenation hangs
  compile 40s+ (71s for the fuzzer's full unit) under full and javascript mode,
  instant under default/ascii/hardened. `.n.................  n.` is a 23-char
  trigger with no unbounded quantifier. A threshold blowup of the wide
  full/javascript `.` minterm in the derivative construction, distinct from
  bug-06's `\w`-repeat cost.
- `bug-10` (soundness): `find_anchored` returns a strictly shorter span than
  `find_all`'s longest match at offset 0. `~(.{1,3}\z){2,4}` on `"ab"` gives
  `find_all = [0:2, 2:2]` but `find_anchored = Some(0:1)`. The 06-04 BUG-13/14
  span-disagreement family, still live on complement-with-end-anchor patterns (30
  triggers). Distinct from bug-02 (existence) -- here a match exists, the start
  agrees, only the length disagrees.
- `bug-11` (crash / soundness): `find_all`'s reverse pass proposes a null match
  start the forward pass then rejects, violating the coupling invariant asserted
  at `resharp-engine/src/ldfa.rs:833/878/906`. `((?!a)|b)&(~((c)))` on `"abca"`
  panics in any debug-assertions build (`assert_ne!(NO_MATCH, l_max_end)`); in
  release the guard drops the unconfirmed start, so `find_all` silently omits a
  real match (`"ca"` -> `[(2,2)]`, dropping the leftmost `(0,0)`; Lean ground
  truth `0:0`). Needs a zero-width-nullable alternation intersected with a
  complement. Found by the Lean position lane (case R1612); the third distinct
  crash site. See `bug-11-ldfa-reverse-forward-null-mismatch.md`.

## Method

Four lanes, all on v0.6.12.

### The SIMD differential (the headline oracle)

`has_simd()` (`resharp-engine/src/simd/mod.rs:7`) is hardcoded `true` on aarch64,
so the scalar fallback is never taken on the M1 in a stock build. There are
exactly four `has_simd()` consult sites, and at each the SIMD branch is an
acceleration whose scalar fallback is "no acceleration" (no reimplementation):
forward literal/rare-byte prefilter (`prefix.rs:430`), reverse Teddy/anchored
prefix (`prefix.rs:796`), lazy-DFA skip table (`ldfa.rs:458`), bounded-DFA prefix
(`bdfa.rs:80`). So for the same (pattern, haystack, config), `is_match`,
`find_all`, `find_anchored` must be byte-identical with `has_simd()` true vs
false on the same machine; any divergence is an unambiguous accelerated-path bug,
needing no external reference.

The instrumented engine (`tools/resharp-instr`) exposes an atomic override
(`instr_set_override`) and per-subsystem "prefilter actually built" counters
(`instr_counters`) so a null result is reported as "tested N prefilter-active
cases", never the vacuous "0 divergences over cases that built no prefilter". On
the directed corpus, 99.2% of cases were prefilter-active, so the SIMD nulls are
meaningful. The single SIMD root cause (`arm-bug-01`) was confirmed identical on
NEON and AVX2, proving it lives in the arch-independent `find_all` driver, not in
`neon.rs`/the AVX2 intrinsics.

### Self-consistency and stream/anchored oracles

For each pattern and a haystack battery, across all seven configs: BOUNDS,
OVERLAP, INCONSIST, ANCHOR, plus FANINCONSIST (`find_anchored = Some` while
`is_match = false`), FANDIFF, STREAMPHANTOM (`find_all` empty but `stream`
non-empty), STREAMINCONSIST, and HARDDIFF (default vs hardened). These need no
external reference. Over a 40k-pattern randomized adversarial corpus they
produced bug-02, bug-03, bug-07, and bug-08.

### Coverage-guided libFuzzer

The three in-tree targets (`compile`, `match_invariants`, `diff_regex`) plus a
new `simd_diff` differential target (`tools/resharp-instr/fuzz`), with
AddressSanitizer. `diff_regex` produced ~120 inputs all hitting bug-04;
`match_invariants` produced bug-05; `compile` produced the bug-06 timeouts;
`simd_diff` produced arm-bug-01 on the M1.

### Lean position-level differential (the external-reference lane)

The internal oracles above cannot catch a result that is self-consistent but
positionally wrong. The 2026-06-04 Lean ground-truth pipeline (re2lean / gen_lean
/ diff_lean) was reconstructed AST-first: `tools/lean/gen_lean_ast.py` builds
random RE ASTs and serializes each to BOTH a fully-parenthesized RE# string
(rust) and a Lean `RE (BA Char)` term (Lean), removing parser-precedence risk by
construction. `llmatch` (leftmost-longest first match) is compared against rust
default-config `find_all(w)[0]`. Cases are tagged trust0 (anchor-free, translator
faithful) or trust1 (`^`/`$`/`\b`/lookbehind-of-anchor, the documented-unfaithful
shapes, which need the dotnet adjudicator). On a 1954-case run (1392 agree, 559
rust-rejected) the only trust0 disagreement was bug-11; the two trust1
disagreements were nested lookbehind-of-`\A`, i.e. translator artifacts, not rust
bugs. The Lean toolchain runs on the M1 (elan + cached mathlib oleans); tooling
under `tools/lean/` (`gen_lean_ast.py`, `diff_lean.py`, `leanrust`, `relprobe`).

### 2026-06-04 re-verification

Every 06-04 reproducer was rerun against v0.6.12 and classified fixed / live /
rejected / perf. See `verification-2026-06-04.md`.

## Reproducer tooling

All under `/tmp/agent` on the x86 host and mirrored to
`/Volumes/MacData/resharp-fuzz-v0.6.12-arm64-20260610/tools` on the M1:

- `resharp-instr`: v0.6.12 engine with the `has_simd()` atomic override and
  prefilter counters (the only change; semantics otherwise identical).
- `repro-simd`: the differential / oracle / verification binary. Modes:
  `--pair`, `--probe`, `--show`, `--reuse`, `--compile`, `--benchrep`,
  `--benchcyc`, `--patbatch`, `--oraclebatch`, `--batch`.
- `resharp-instr/fuzz`: the `simd_diff` libFuzzer target.
- `verify_0604.py`, `gen_simd_corpus.py`, `gen_adversarial.py`, `gen_big.py`:
  the verification driver and corpus generators.

The Lean formalization (`~/Downloads/extended-regexes`) is the position-level
ground-truth reference; the dotnet engine is a secondary cross-check only. Ten of
the eleven bugs rest on a same-engine internal inconsistency (SIMD on vs off,
is_match vs find_all vs find_anchored vs stream, default vs hardened) or a panic,
so they need no external oracle. bug-11 is the exception by design: its crash is
engine-internal (a `debug_assert_ne!` the engine trips on itself), and only its
release-mode soundness severity (which match it drops) is read off the Lean
ground truth, on a trust0 anchor-free pattern where the translation is faithful.
