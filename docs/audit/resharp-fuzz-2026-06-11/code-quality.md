# Code-quality observations (v0.6.12)

Structural observations from reading the v0.6.12 engine while reproducing the
findings.
 These are the conditions that let the bugs exist,
 not the bugs
themselves.

## Driver proliferation is the root structural issue

"Find all matches" is implemented several times over,
 with no shared correctness
core,
 and the copies disagree:

- the default prefix-accelerated driver `fwd_prefix_impl` (`fwd.rs:4`),
- the leading-lookbehind prefix driver `fwd_lb_prefix_impl` (`fwd.rs:97`),
- the hardened driver `find_all_dfa`,
- the unaccelerated `scan_fwd_slow` fallback (taken when no prefix is built),
- the `stream` leftmost-shortest scan (`stream.rs`),
   a fifth path.

Three separate findings are the same conceptual mistake (a zero-width / assertion
match near a boundary) rediscovered in three of these drivers:
 arm-bug-01 in
`fwd_lb_prefix_impl`,
 bug-07 in the hardened driver,
 bug-03 in the stream scan.
Each driver re-derives the zero-width and begin-context handling,
 so each gets a
chance to get it wrong independently.
 A single match-enumeration core that the
accelerated paths only feed candidate positions into (rather than re-deriving the
match logic) would collapse this class.
 The `find_anchored` path (bug-02) and the
`is_match` fast path (bug-08) are two more independent re-derivations of the same
semantics.

The driver-disagreement defect is rust-internal and holds regardless of the
reference:
 two of rust's own drivers return different answers for the same input,
so one is wrong by construction.
 That said,
 the patterns split by subset (see
`dotnet-adjudication.md`):
 arm-bug-01,
 bug-02,
 bug-03 fire on patterns the dotnet
reference accepts,
 while bug-07,
 bug-08,
 bug-10 fire on patterns the reference
rejects at compile (anchor-in-complement,
 lookaround-in-union).
 For the
out-of-subset group,
 collapsing the drivers and rejecting the pattern at compile
are both valid remedies;
 for the in-subset group,
 only the unification fix
applies.

## Panics on user input in shipped code

- `resharp-algebra/src/lib.rs:2724`:
   `panic!("reentrant union rewrite ... this is
  a bug, please file an issue with the pattern")` is reachable from ordinary user
  patterns (bug-04).
   A library should never panic on input it accepts into
  `Regex::new`;
   this should be a typed `Err` (or the rewrite should be completed).
  The "please file an issue" text confirms it is a known-incomplete path that was
  shipped rather than gated.
- `resharp-engine/src/lib.rs:1824`:
   `debug_assert!(false, "found bug: this path
  should be eliminated")` is reachable (bug-05).
   A `debug_assert!(false)` used as
  a "this can't happen" marker is reached,
   so either the invariant is wrong or the
  branch was never eliminated.
   In release the assertion vanishes and control
  falls through an untested path.

## The scalar fallback is dead code on aarch64

`has_simd()` (`simd/mod.rs:7`) returns a hardcoded `true` on aarch64,
 so the
scalar branch at all four dispatch sites (`prefix.rs:430`,
 `prefix.rs:796`,
`ldfa.rs:458`,
 `bdfa.rs:80`) is never taken in a production ARM build.
 The scalar
path is therefore both the only correct path for several inputs (it lacks
arm-bug-01) and never exercised on ARM in production.
 Two consequences:
 a
prefilter-path-only bug like arm-bug-01 can never be masked or caught by the
scalar path in the field,
 and the scalar fallback itself rots untested on ARM.
 A
runtime override (an env var or build flag) feeding a SIMD-on-vs-off differential
test would keep both paths honest;
 this campaign had to add that override to find
arm-bug-01.

## Off-by-one in `search_start` arithmetic

`fwd_lb_prefix_impl` conflates two different coordinate systems in one
`search_start` variable:
 the byte offset to resume scanning,
 and the lookbehind
candidate position (which is `lb_len` bytes before the body match).
 `fwd.rs:123`
advances `search_start` by 1 after a zero-width begin match,
 which is correct in
the body-position frame but wrong in the candidate frame,
 skipping the candidate
at byte 0.
 The variable would benefit from being named and documented per frame,
or split into `next_body_pos` and `next_candidate_pos`.

## Suggested direction

- Funnel every "enumerate matches" path through one core that takes a candidate
  position and decides match / no-match / longest-end,
   so the prefilter,
   hardened
  scan,
   and stream only differ in how they propose candidates,
   not in the match
  semantics.
   This directly addresses arm-bug-01 and bug-03 (in-subset);
   it would
  also fix the internal disagreement behind bug-07,
   bug-08,
   bug-10,
   though for
  those out-of-subset patterns rejecting at compile (as the dotnet reference does)
  is the alternative the engine already has machinery for.
- Replace the two reachable panics with typed errors or completed logic.
- Add the SIMD-on-vs-off differential and the find_all / find_anchored / stream /
  is_match cross-consistency checks (this campaign's oracles) to the test suite.
