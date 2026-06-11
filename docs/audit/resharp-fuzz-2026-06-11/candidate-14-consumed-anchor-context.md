# candidate-14: `^` context from consumed bytes (UNADJUDICATED)

Status: candidate only. Both resharp engines agree with each other, so this is
not an internal-oracle finding; it needs external adjudication
(`resharp-dotnet`, and ideally the Lean formalization extended past first-match)
before it can be filed. Do not include it in upstream issues until adjudicated.

## Observation (v0.6.12 + PR #20 branch, identical on both)

`Regex::new(r"^a\n").find_all(b"a\na\n")` returns `[(0,2)]` in both the default
and hardened engines (driver `FindAll::FwdLbPrefix` for default, confirmed via
the `diag` feature's `find_all_kind_name`).

The dropped match: `^a\n` at offset 2 (`a` at 2, `\n` at 3, with the `^`
satisfied by the `\n` at index 1). The `\n` at index 1 was consumed by the
previous match `(0,2)`, and neither engine grants `^` context from bytes inside
a previous match. Contrast with `^a` on `b"a\na"`, which returns
`[(0,1), (2,3)]`: there the anchoring `\n` at index 1 sits between matches, not
inside one, and the offset-2 match is found.

Backtracking engines and rust-regex evaluate multiline `^` against the haystack
itself when continuing from a previous match's end, so they would return both
matches; whether RE#'s leftmost-longest non-overlapping enumeration is *defined*
to behave that way is exactly the open question.

## Why round 2 missed it

- The internal oracles (SIMD on/off, default-vs-hardened, four-API
  cross-consistency) only catch resharp disagreeing with itself. Here all paths
  agree.
- The Lean differential compares `llmatch`, the leftmost-longest **first**
  match, which is `(0,2)` on both sides. The drop is in the **subsequent**-match
  enumeration, outside what the Lean lane checks.
- The dotnet adjudicator was only consulted for patterns the internal oracles or
  Lean flagged.

## How it surfaced

Reviewing the redundant-conditional comment on PR #20 (`fwd.rs:123`): the else
branch resumes the candidate search at `max_end` (body frame) while the in-loop
counterpart at `fwd.rs:147` resumes at `max_end - lb_len` (candidate frame). The
suspected off-by-`lb_len` drop is real in the lb-prefix driver, but the hardened
driver independently produces the same answer, so the behavior is engine-wide
semantics rather than a driver divergence, and "fixing" only the lb-prefix
branch would create a default-vs-hardened divergence.

## Adjudication steps

1. Run `resharp-dotnet` on `^a\n` over `"a\na\n"` (and `^a` over `"a\na"` as the
   control). If dotnet returns two matches, this is a soundness finding; if one,
   it is intended RE# enumeration semantics and at most a documentation item.
2. If filing: the fix cannot live in `fwd_lb_prefix_impl` alone; the hardened
   driver and `scan_fwd_slow` resume the same way, so it lands in the shared
   enumeration semantics (or the docs).

Witness tooling: `/tmp/agent/fwd123-witness` (scratch crate, default-vs-hardened
differential with driver-kind printout; recreate from this doc if cleaned).
