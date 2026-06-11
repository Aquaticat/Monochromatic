# Handover: resharp ARM64 / NEON SIMD fuzz campaign (2026-06-11)

Living handover for the ARM64 (Apple M1, NEON SIMD) fuzz campaign against
`ieviev/resharp` v0.6.12. Context compacts; this file is the single source of
truth for resuming with zero rediscovery. Per-bug writeups go under
`docs/audit/resharp-fuzz-2026-06-11/`. Update this file as state changes.

The prior x86 campaign's handover is `docs/handover/resharp-fuzz.md`
(2026-06-04, 23 root causes). Read it for the engine semantics, the Lean oracle
pipeline, and the `repro` mode list; this file only adds the ARM64/SIMD layer
and the footguns specific to it.

## Mission and goal

Fuzz `ieviev/resharp` v0.6.12 (`3d4ddde`, tag `v0.6.12`) on an ARM Mac (M1)
because resharp has different SIMD code for ARM (NEON) vs x86 (AVX2). Match or
exceed the depth of the 2026-06-04 campaign (27+ bugs), maximal yield. Hard
goal: 10 distinct root causes. The user wants maximum yield ("honeycomb").

## CRITICAL: do not trust the dumb agent (bad-glm-...)

A weaker agent ("glm") is running this same task in a podman container on the
Mac. Its output landed at `docs/audit/resharp-fuzz-2026-06-10/`, now renamed to
`docs/audit/bad-glm-resharp-fuzz-2026-06-10/` with a warning banner in its
README. The user explicitly said: do not trust anything that agent wrote.
Verified-by-reading defects in it:

- It blames compile-time blowups (`\P{L}`, `\p{L}`) on "the NEON SIMD path."
  SIMD in resharp is ONLY in the match/scan prefilter (`simd/neon.rs`), never
  in derivative/minterm construction. A compile-time cost cannot be
  NEON-specific. Category error.
- It compares "7.25s on ARM64 vs 162ms on x86_64" and credits NEON, but those
  are two different physical machines, not two code paths on one machine.
- It conflates fuzzer harness option-bytes (`0x7b % 6 = 5`) with pattern
  content, and files "bugs" it admits "may be a parse artifact."

Use it only as a (very weak) lead generator. Every finding in MY campaign must
rest on a reproduction I ran myself: a same-machine NEON-on vs NEON-off
divergence, a self-consistency violation, Lean, or the `regex` crate. The user
is letting glm run for completeness; ignore its conclusions.

## Environment

- Host: `ssh m1` (key auth works, BatchMode ok). Apple M1 (`arm64`, T8103),
  macOS 26.5.1 (build 25F80), 8 cores, 16 GiB RAM.
- MacData partition: `/Volumes/MacData` (477 GiB, ~340 GiB free). This is where
  the campaign must run (user directive).
- Campaign scaffold (already created, mostly empty):
  `/Volumes/MacData/resharp-fuzz-v0.6.12-arm64-20260610/` with `src/`
  (`resharp-pristine`, `resharp-nosimd` both at `3d4ddde`), `artifacts/`,
  `corpus/`, `logs/`, `oracles/`, `scripts/`, `tools/`, `build-context/`
  (`Containerfile`). The glm agent uses the podman container built from that
  Containerfile.
- Local pristine clone for fast reading (no `.git`):
  `/tmp/agent/resharp-v0612` (rsynced from the Mac scaffold). Use `rg`/Read here
  rather than ssh round-trips.
- Reference materials in `~/Downloads`: Lean formalization
  (`extended-regexes/`, the ground-truth oracle), papers
  (`3704837.pdf`, `lean formalization ...pdf`), dotnet impl
  (`resharp-dotnet/`, secondary only, NOT an arbiter), plus
  `ereq-derivatives`, `finiteness-derivatives`, `RLTL-derivatives`,
  `re-sharp-smt`.

## TOOLCHAIN FOOTGUN (open issue)

The M1 HOST has NO rust toolchain in PATH: `cargo`, `rustc`, `rustup`,
`cargo-fuzz` are all "command not found" over `ssh m1` (login shell is zsh).
Only the podman container (glm's) has nightly + cargo-fuzz. To run anything on
the host I must either install rustup on the host, or run my differential
inside a container/VM I control. Decide and record the choice here.
`sysctl hw.ncpu = 8`, `hw.memsize = 16 GiB`.

## The SIMD differential oracle (the headline method)

`has_simd()` (`resharp-engine/src/simd/mod.rs:7`) is hardcoded `true` on
aarch64 (x86 checks `is_x86_feature_detected!("avx2")`, wasm checks simd128).
So on the M1, the scalar fallback inside every dispatch site is NEVER taken in
a stock build. There are exactly FOUR `has_simd()` consult sites in the engine,
and at each one the SIMD branch is an ACCELERATION whose scalar fallback is "no
acceleration" (it does not reimplement the search, it just declines to build a
prefilter / skip table):

- `resharp-engine/src/prefix.rs:430` `build_fwd_prefix`: `!has_simd()` returns
  `Ok(None)` (no forward literal/rare-byte prefilter).
- `resharp-engine/src/prefix.rs:796` `select_prefix`: `!has_simd()` returns
  `Ok((None, None))` (no reverse Teddy / anchored prefix).
- `resharp-engine/src/ldfa.rs:458`: `if has_simd()` then
  `try_build_skip_simd` (a lazy-DFA skip/acceleration table). Built LAZILY
  during matching, so `has_simd()` must stay constant for a regex's whole
  lifetime (build AND match).
- `resharp-engine/src/bdfa.rs:80` `build_prefix`: `!has_simd()` returns
  `Ok(())` (bounded DFA gets no prefix).

Consequence: for the same (pattern, haystack, config), `is_match`, `find_all`,
and `find_anchored` MUST be byte-identical between `has_simd() == true` (NEON)
and `has_simd() == false` (scalar) on the same M1. Any divergence is an
unambiguous correctness bug in the accelerated NEON path (it skipped past a
real match start, landed on a wrong position, or mis-handled a chunk
boundary/tail). This is the gold oracle, and it needs no external reference.

SIMD prefilter bugs classically hide at NEON 16-byte chunk boundaries and tail
handling. Construct haystacks that place candidate/rare bytes at offsets 15,16,
17, 31,32,33, 63,64,65, at the very end, and at lengths that are not multiples
of 16. The NEON hotspots to read first: `neon_movemask` (`simd/neon.rs:6`,
the sign-bit gather), `find_fwd_neon`, `find_rev_neon`, `search_neon`, the
Teddy masks, and `read_partial_u64` (the sub-8-byte tail read in `simd/mod.rs`).

### Planned harness (in-process differential)

Patch the engine's `has_simd()` (in a path-dependency copy used only by the
repro crate) to consult a process-global `AtomicBool` (default: real
detection), so ONE binary can build a regex with SIMD off, fully run it, then
build the same regex with SIMD on and run it, and compare in-process. Sequential
runs keep `has_simd()` constant across each regex's build+match lifetime (needed
for the lazy `ldfa` skip). Emit `SIMDDIFF|op|cfg|pat|hay|simdoff=..|simdon=..`
on mismatch. Also build a libFuzzer `simd_diff` cargo-fuzz target with the same
assertion so coverage guidance hunts divergences on the host natively.

Keep the 06-04 self-consistency oracles too (BOUNDS, OVERLAP, INCONSIST,
find_anchored-vs-find_all, STREAM*), and the `regex`-crate ascii differential,
since v0.6.12 may still carry non-SIMD bugs. The nosimd src tree in the MacData
scaffold is currently IDENTICAL to pristine (`diff -rq` empty); it has NOT been
patched yet, so do not assume it disables SIMD.

## Reference is Lean, not dotnet (carried from 06-04)

The Lean formalization (`~/Downloads/extended-regexes`) is THE verified ground
truth. The dotnet engine is immature and is a secondary "another implementation
to look at," never an arbiter. Every filed bug must rest on Lean plus a
rust-internal inconsistency or the `regex` crate, never on dotnet alone. See the
06-04 handover for the full Lean pipeline (`re2lean.py`, chunked `lake env lean`
recipe, `adj_full.py`, the lookbehind-of-anchor unfaithfulness caveat).

## v0.6.12 vs the 06-04 baseline

v0.6.12 is heavily refactored from the 06-04 baseline. The engine is no longer a
single `engine.rs`; it is split into `scan.rs`, `fwd.rs`, `ldfa.rs`, `bdfa.rs`,
`fas.rs`, `accel.rs`, `minterms.rs`, `prefix.rs`, `dump.rs`, `stream.rs`, plus
`simd/{mod,neon,wasm,byte_freq}.rs`. Old `engine.rs:NNN` line references from
the 06-04 docs do NOT map; re-locate every site. Several 06-04 bugs were
addressed by making the PARSER reject the pattern (e.g. lookaround/`\b`/`^`/`$`
inside a complement now "unsupported pattern"), which avoids the defect rather
than fixing the engine; note that distinction when re-testing.

## Conventions and process

- Repo prose rules: no em-dashes/en-dashes as em-dashes, sentence-case ATX
  headings (max 4 levels), fenced code with language tags, lines under 120, no
  tables, no emojis, `-` bullets. Each bug file is self-contained: reproducer
  (rust snippet plus exact command), observed vs expected, affected configs,
  source location, relationship to other bugs.
- Commit eagerly, `docs(resharp-fuzz): ...`, EXPLICIT scoped pathspecs. The
  working tree carries concurrent external "unbash" changes in `packages/` and
  `AGENTS.md`; never stage those. `cli-git` rejects `-A`/`.`/pathspec-less
  commits by design.
- Scratch lives under `/tmp/agent` (`mkdir -p /tmp/agent; chmod 700` if
  missing). The user cleans up; do not delete audit artifacts.

## Toolchain resolved (2026-06-11)

The M1 host now has a working PATH: `~/.zshenv` was created (it is sourced by
non-interactive ssh; `~/.zprofile` is not) prepending `~/.cargo/bin`, the
`nightly-aarch64-apple-darwin` toolchain bin, `/opt/homebrew/bin`, and the mise
shims. `cargo`, `rustc`, and `cargo-fuzz` (installed via `cargo install`) are
reachable over `ssh m1`. macOS has no GNU `timeout` (use chunking, not a timeout
wrapper). The x86 box (where this repo lives) is `x86_64` (AVX2) with its own
nightly + cargo-fuzz + cargo-miri; the SIMD differential reproduces on AVX2 too,
so x86 is a valid second SIMD lane and runs the correctness/fuzz lanes.

## Findings (2026-06-11 01:30) -- 8 root causes, committed

All in `docs/audit/resharp-fuzz-2026-06-11/` (README + one file per bug +
`verification-2026-06-04.md` + `code-quality.md` + `test-coverage.md`). The
developer's "all 27 fixed, plus more" claim is FALSE in part: BUG-1, BUG-20,
BUG-8, BUG-3 are all still live on new triggers.

- arm-bug-01 (SIMD soundness, fix-verified): `fwd_lb_prefix_impl` `fwd.rs:123`
  drops the offset-1 match after a leading zero-width match. `^$` on `"\n\n"` =>
  `[0:0,2:2]` SIMD-on, `[0:0,1:1,2:2]` SIMD-off. Identical NEON and AVX2 (defect
  is in the arch-independent driver). Found by `simd_diff` fuzzer + the on/off
  differential. Fix `{1}`->`{0}` verified.
- bug-02 (soundness): `find_anchored` phantom on leading zero-width assertion
  (`(?<=a)` on `"b"`, `\BU` on `"U"`): `fan=Some` while `im=false`. 122 triggers.
  BUG-20 partial-fix-still-live.
- bug-03 (soundness): `stream` phantom/mislocated zero-width (`(?=c)`->1:1,
  `\b`->shifted, `(?!\A)`->0:0).
- bug-04 (crash): reentrant union rewrite panic `algebra/lib.rs:2724` LIVE,
  minimal `(.*.+)*.+`, ~165 fuzzer triggers. BUG-1 narrowed not killed.
- bug-05 (crash): reachable `debug_assert!(false,"this path should be
  eliminated")` `engine/lib.rs:1824`, pattern `_*$` (`rev_trivial`).
- bug-06 (perf): full-mode `\w{n}` compile ~0.14s/repeat (`\w{24}`=3.3s).
- bug-07 (soundness): default vs hardened `find_all` differ, `~(\A|\n+){2}` on
  `"\n\n"`. BUG-8 family live.
- bug-08 (soundness): `is_match` vs `find_all`, `[0-9]{2}~(\z{1,3}|^{2}\W{0})+`
  flags cfg on `"00"` (`im=false`, `fa=[0:2]`). BUG-3 family live.

The single SIMD root cause is arm-bug-01; the rest are arch-independent. The
SIMD differential harness is solid (99.2% prefilter-active coverage, zero false
positives over 58k cases). Most 06-04 bugs ARE genuinely fixed (see verification
doc); do not re-file those.

## Harness (rebuilt, both machines)

- `tools/resharp-instr`: v0.6.12 engine + `has_simd()` atomic override
  (`instr_set_override` 0/1/2) + prefilter-built counters (`instr_counters`).
  ONLY change vs stock. `simd` stays `pub(crate)`; hooks re-exported at crate
  root (avoids `deny(missing_docs)`).
- `tools/repro-simd` (binary `repro`): modes `--pair`/`--probe`/`--show`/
  `--reuse`/`--compile`/`--benchrep`/`--benchcyc`/`--patbatch`/`--oraclebatch`/
  `--batch`. The verification + differential + oracle workhorse.
- `tools/resharp-instr/fuzz`: `simd_diff` libFuzzer target (on/off differential
  with `catch_unwind`, `panic=unwind`). Build with `--target` default on mac.
- Local x86 mirror: `/tmp/agent/{resharp-instr,repro-simd,resharp-v0612}`.
  `resharp-fixtest` is the engine copy with the arm-bug-01 fix applied (for the
  fix verification). Generators: `gen_simd_corpus.py`, `gen_adversarial.py`,
  `gen_big.py`; `verify_0604.py`.
- KNOWN HARNESS GAP: `repro --oraclebatch` swallows MATCH-TIME panics into
  `fa=Err` (only build-time panics print `PANIC|`). So bug-05-style match panics
  do not show as `PANIC` in oracle output; the libFuzzer `match_invariants` target
  is the one that surfaced it.

## Running jobs (overnight, both machines)

- x86: `compile`, `match_invariants`, `diff_regex` in-tree fuzzers, `-fork=3
  -ignore_crashes=1 -max_total_time=14400` (logs `/tmp/agent/fz2_*.log`,
  artifacts under `resharp-v0612/fuzz/artifacts/<tgt>/`). diff_regex crashes are
  dominated by bug-04 (BUG-1); look for NON-`lib.rs:2724` crashes for new bugs.
- M1: `simd_diff` `-fork=3 -ignore_crashes=1` (logs `tools/simd_diff_fuzz2.log`,
  artifacts `tools/resharp-instr/fuzz/artifacts/simd_diff/`). All crashes so far
  are arm-bug-01; a non-`^`-prefixed divergence would be a new SIMD root cause.

## Campaign log (newest first; update >= every 10 min while running)

- 02:30 -- 9 root causes committed (bug-09 added: full/js dot-literal concat
  compile blowup, >40s, fragile/non-monotonic, distinct from bug-06). Verified
  bug-05 is debug-build-only: `_*$` in a release (no-debug-assertions) build
  returns the CORRECT `find_all` (`[0:6,6:6]`), so it is a debug/test/fuzz crash
  not a release soundness bug (writeup already says so). DIVERGE null reconfirmed.
  Lean position-level lane: ABANDONED this box -- `curl|sh` elan install denied
  by the auto-mode classifier (external code exec; install authz was Mac-only),
  too heavy to reroute. Mining instead with a fresh differently-structured
  corpus (`gen_big2.py`, seed 7777, heavier nested lookarounds / counted repeats
  / deep complement+intersection / case-shifting classes): 16-way `--oraclebatch`
  running on big2 to surface violation types not yet filed (a non-zero-width
  HARDDIFF, a distinct OVERLAP/BOUNDS, etc.). Overnight fuzzers still running on
  both machines.

- 02:05 -- DIVERGE lane (is_match resharp-ascii vs regex-crate over 20k
  shared-subset patterns x22 haystacks, panic-tolerant in `repro --divergebatch`)
  is a CLEAN NULL: resharp's basic is_match agrees with the regex crate, so the
  core is correct and the bugs live in the advanced features. M1 simd_diff (7
  crashes) are ALL arm-bug-01 (leading-`^` zero-width: `^$`,`^\0?`,`^\n`,
  `^\u{1}?`); one SIMD root cause, well-confirmed. NEW candidate root cause
  (bug-09, perf): a long `.`-and-literal concatenation blows up COMPILE in
  javascript/full mode -- the fuzzer's `compile` timeout
  `.n.................  n...  n` (hexpat 2e6e...20206e) takes ~71s. Bisection by
  prefix length is NON-MONOTONIC (len 22 = 16.8s, len 23 = >30s, len 24+ =
  0.001s), so it is a specific minterm/derivative product blowup, distinct from
  bug-06's `\w` repeat cost. Characterizing modes/minimal now. Two crash sites
  total across all in-tree artifacts: `algebra:2724` (bug-04, x230) and
  `engine:1824` (bug-05, x1). diff_regex2 catch_unwind is defeated by
  libfuzzer-sys's abort-at-panic hook (use repro for the is_match diff, done).

- 01:45 -- 8 root causes committed (README, 8 bug files, verification, code-quality,
  test-coverage, handover). Overnight fuzzers relaunched on both machines (4h).
  Tried a BUG-1-tolerant `diff_regex2` libFuzzer target to unmask is_match
  divergences, but libfuzzer-sys's panic hook `abort()`s at the panic point so
  `catch_unwind` can't catch the bug-04 panic; pivoting the is_match-vs-regex
  differential into `repro` (where catch_unwind works) over a shared-subset
  corpus. simd_diff (M1) still only finds arm-bug-01 variants. No new crash site
  beyond `algebra:2724` (bug-04) and `engine:1824` (bug-05) so far.

## Next avenues for more yield

- A BUG-1-tolerant `diff_regex` (wrap resharp compile in `catch_unwind`, compare
  `is_match` only when both compile) to find resharp-vs-`regex`-crate is_match
  divergences currently masked by the bug-04 panic.
- Lean position-level correctness lane (the 06-04 pipeline; `~/Downloads/
  extended-regexes`, elan needed; not yet set up this campaign) for correctness
  bugs the self-consistency oracles miss.
- Per-mode oracle rounds (flags config produced bug-08; ascii/full may differ).
- Harvest the running fuzzers; minimize any new distinct crash site.
