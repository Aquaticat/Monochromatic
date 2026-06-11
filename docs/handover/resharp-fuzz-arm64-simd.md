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

## Current status (2026-06-11 00:05)

Orientation done. Found and read the four `has_simd()` dispatch sites and
confirmed the differential-oracle design. Read `neon_movemask`. Toolchain on the
host is missing (open footgun above). Renamed glm's dir to `bad-glm-...` and
flagged it. NEXT: stand up a rust toolchain reachable from the M1 host (or a
controlled container), build the in-process SIMD-differential repro against a
`has_simd()`-overridable engine copy, seed boundary-targeted haystacks, and
start mining `SIMDDIFF`. No bugs filed yet.
