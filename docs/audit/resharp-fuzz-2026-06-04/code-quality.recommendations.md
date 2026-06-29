# Code-quality recommendations in resharp (rust): below the definitely-rewrite bar

Observations worth raising that do NOT clear the "any reasonable Rust author rewrites
this immediately" bar,
 because a maintainer could reasonably keep the current shape.
The definite-rewrite items,
 including the ones a young high-churn crate should harden
now (invariant-protected `unsafe`,
 narrowing casts,
 unproven-reachable aborts) and
the perf tradeoff shown to be sour (the in-band sentinel),
 are in `code-quality.md`.
This file is intentionally short:
 under the bar above,
 almost everything found is
either a filed bug or a definite rewrite.
 Locations are in the pristine clone
`/tmp/agent/resharp-fuzz-20260604`.

## Two `find_all` implementations to converge

`find_all` has a default nullable path (`find_all_nullable_slow`,
 `engine/src/lib.rs
:1794`) and a hardened DFA path (`find_all_dfa`,
 `:1713`).
 They diverge on results
for some complement patterns (BUG-8) and on complexity (BUG-18,
 the nullable path is
O(n^2)).

Why it stays below the bar:
 a fast path plus a fallback is a deliberate,
 common
optimization,
 and the immediate defects are filed separately (BUG-8 for the
divergence,
 BUG-18 for the complexity).
 A maintainer can reasonably keep two paths
as long as they are made to agree.
 The recommendation is to converge them onto one
definition of `find_all`'s semantics so the two cannot drift apart again as the crate
changes,
 but that is a refactor to schedule,
 not a line to rewrite on sight.

## Note

The remaining design-level item surfaced by the campaign,
 the lookbehind derivative
that never reaches a fixpoint on a failing inner lookahead,
 is the root cause of
BUG-16 and is documented there with its recommended fix (extend the `is_nullable`
collapse at `algebra/src/lib.rs:1403` to the failing-lookahead case).
 It is a bug
fix rather than a code-quality rewrite,
 so it is not duplicated here.
