# bug-14: find_all drops matches whose `^` context bytes were consumed

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Status:
 ADJUDICATED (resharp-dotnet,
 2026-06-11).
 In-subset soundness finding.
Both rust engines agree with each other,
 so internal oracles cannot see it;
the dotnet reference disagrees with both.

## Reproducers (rust v0.6.12 main, identical default and hardened)

Minimal,
 `^\n` over `"\n\n\n"`:

- rust (default and hardened):
   `[(0,1), (2,3)]`
- resharp-dotnet (net10.0,
   main):
   `[(0,1), (1,2), (2,3)]`

rust drops `(1,2)`:
 the `^` at offset 1 is anchored by the `\n` at offset 0,
which the previous match `(0,1)` consumed.

Same shape with a consuming body,
 `^a\n` over `"a\na\n"`:

- rust:
   `[(0,2)]`
- dotnet:
   `[(0,2), (2,4)]`

and `^.\n` over `"a\nb\n"`:
 rust `[(0,2)]`,
 dotnet `[(0,2), (2,4)]`.

Control (anchor byte NOT consumed),
 `^a` over `"a\na"`:
 both sides agree on
`[(0,1), (2,3)]`,
 which also validates that multiline defaults align across
the two engines.

## Root behavior

When `find_all` resumes after a match,
 every rust path resumes the scan at the
previous match's end without granting begin-context from bytes inside that
match:
 the lb-prefix driver resumes the candidate search at `max_end` (the
candidate frame for "next anchor byte" starts at `max_end - lb_len`,
 so any
anchor byte the previous match consumed is skipped),
 and the hardened and slow
paths independently produce the same drop,
 so this is shared enumeration
semantics,
 not one driver's off-by-one.
 The reference semantics (dotnet,
 and
standard multiline engines) evaluate `^` against the haystack itself when
continuing from a previous match's end.

This is exactly the suspicion raised by the `fwd.rs:123` vs `fwd.rs:147`
frame inconsistency during the PR #20 review sweep;
 the lb-prefix driver's
behavior turned out to match the other drivers,
 making it an engine-wide bug
rather than a driver divergence.
 A fix only in `fwd_lb_prefix_impl` would
CREATE a default-vs-hardened divergence;
 the fix belongs in the shared
resume-context semantics.

## Why round 2 missed it

- Internal oracles (SIMD on/off,
   default-vs-hardened,
   cross-API) only catch
  rust disagreeing with itself;
   all rust paths agree here.
- The Lean differential compares `llmatch` (leftmost-longest FIRST match),
  which is identical on both sides;
   the drop is in subsequent-match
  enumeration.
- The dotnet adjudicator was only consulted for already-flagged patterns.

A find_all-level (not first-match) external differential over anchor patterns
is the oracle class that catches this family.

## Side observation: resharp-dotnet duplicate zero-width match

During adjudication,
 dotnet `^$` over `"\n\n"` returned
`[(0,0), (1,1), (1,1), (2,2)]`,
 duplicating `(1,1)`.
 That is a
resharp-DOTNET bug (same duplicate-null family as the rust-side fix in
upstream PR #14).
 Working assumption (user directive,
 2026-06-11):
 the
dotnet repo is abandoned,
 so this is not filed anywhere;
 it is recorded here
because it means the dotnet reference must be used with per-probe controls
(as done above) rather than trusted blindly,
 and its own bugs will not be
fixed under us.
 It does not affect the bug-14 verdict:
 the dropped-match
question is about which positions appear at all,
 and the controls agree
exactly.

## Adjudication environment

podman `mcr.microsoft.com/dotnet/sdk:10.0`,
 resharp-dotnet main (shallow clone
2026-06-11),
 `dotnet build src/Resharp --configuration Release --framework
net10.0`,
 probes via `dotnet fsi` (scripts under `/tmp/agent/cand14/`).
Rust side:
 stock v0.6.12 `3d4ddde`,
 witness crate `/tmp/agent/fwd123-witness`.
