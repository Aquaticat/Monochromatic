# find_all false negative on intersection with an end-anchor alternation (0.6.13, live)

THIRD new live soundness bug, and the most severe of the three: `find_all` (the
production API `forbidden-strings` relies on) DROPS a real match. Found by the
anchor-extended denotational oracle (`anchor_denot`, the lane that closes the
06-19 campaign's anchor-coverage gap), adjudicated WITHOUT any external model:
resharp's own outputs contradict each other. Verified on 0.6.13 (== HEAD
`f0ce60a`), byte-identical on x86_64 (AVX2) and Apple M1 (NEON), all four unicode
modes.

## Symptom

Minimal trigger: `.&a(?:$|b)` on `"a\n"`.

```text
/.&a(?:$|b)/  (UnicodeMode::Ascii, Default, Full, Javascript all identical)
  "a\n" : find_all=[]   is_match=false
```

Both expected by the contract to be a match at `(0,1)`:

```text
/./          on "a\n" : find_all=[(0,1)]   (the left operand matches (0,1))
/a(?:$|b)/   on "a\n" : find_all=[(0,1)]   (the right operand matches (0,1))
/.&a$/       on "a\n" : find_all=[(0,1)]   (subset of the trigger; matches (0,1))
```

So both operands of the intersection individually match the span `(0,1)`, per
resharp's OWN `find_all`, yet `.&a(?:$|b)` (their intersection) returns `[]`. An
intersection cannot drop a span that both operands contain. This is a `find_all`
(and `is_match`) FALSE NEGATIVE.

## Why this is a bug, with no external oracle needed

Two independent resharp-internal proofs, neither using the denotational model:

1. **Membership.** `(0,1) in L(.)` and `(0,1) in L(a(?:$|b))` are both witnessed by
   resharp's own `find_all` on each operand. `L(A & B)` is `L(A) cap L(B)` by
   definition, so `(0,1)` must be in `L(.&a(?:$|b))`. resharp returns `[]`.
2. **Monotonicity.** `L(a$) subset of L(a(?:$|b))` (the second adds an alternative
   branch), hence `L(.&a$) subset of L(.&a(?:$|b))`. resharp gives `.&a$` ->
   `[(0,1)]` but the superset `.&a(?:$|b)` -> `[]`: a superset returning fewer
   matches.

The `$` matches at the interior position 1 (multiline default, before the `\n`),
which is the match `.&a$` correctly finds; adding the consuming alternative
`(?:$|b)` makes `find_all` drop it.

## Trigger boundary

```text
.&a(?:$|b)     BUG    [ab]&a(?:$|b)   BUG    .&a(?:b|$)   BUG (alternation order)
.&a(?:$|a)     BUG    [a\n]&a(?:$|b)  BUG    .&a($|bc)    BUG
.&a$           ok ((0,1))            a(?:$|b)        ok ((0,1), no &)
```

Two ingredients: an intersection `L & R` where `L` is width-bearing, and `R` has
the shape `<char>(?:$|<consuming>)` (an end anchor `$` alternated with a consuming
branch). Replacing the alternation with the bare anchor (`.&a$`) is correct;
dropping the intersection (`a(?:$|b)` alone) is correct. The bug is the
combination.

## Root cause

Same root as the `is_match` finding
(`bug-is-match-false-positive-inter-optional-end-anchor.md`), but reaching
`find_all` through the kind classifier. The `FindAll` kind is chosen from
`has_anchors_pre = b.contains_anchors(node_fwd_simpl)`
(`resharp-engine/src/lib.rs:1069-1070`), computed on the forward-simplified node:

```rust
// resharp-engine/src/lib.rs:1035
let node_fwd_simpl = b.simplify_fwd_initial(node);
// resharp-engine/src/lib.rs:1069
let has_anchors_pre = b.contains_anchors(node_fwd_simpl);
let ah = auto_harden(&mut b, fwd_start, has_anchors_pre);
```

`simplify_fwd_initial` prunes the `$` alternative as dead in the forward prefix of
`.&a(?:$|b)`, so `has_anchors_pre` is `false` and the pattern is classified
`FindAll::FwdPrefix` (the SIMD forward-prefix anchored scan), confirmed by the
`diag` build:

```text
/.&a(?:$|b)/  find_all_kind = FwdPrefix   (anchor dropped -> wrong fast path)
/.&a$/        find_all_kind = Dfa         (anchor kept -> correct path)
```

The `FwdPrefix` path does not account for the `$`-branch zero-width match and
returns `[]`. The correct pattern `.&a$` keeps the anchor (`has_anchors` true) and
is routed to `Dfa`, which is correct. So the unified root cause across all three
06-19 findings is: anchor presence for routing decisions is read from
`node_fwd_simpl`, which drops anchors that forward-simplification proves locally
dead, mis-routing `find_all` (kind classifier), `is_match`, and `find_anchored`.

## Adjudication and severity

Real bug, tier "asserted-contract / internal-inconsistency" (self-evident from
resharp's own operand outputs; no model needed). Most severe of the three 06-19
findings: it is in `find_all`, the production API, and the direction is a FALSE
NEGATIVE (a dropped match), i.e. fail-OPEN. A scanner that gates on `find_all`
over an intersection-with-end-anchor pattern could MISS content that actually
matches. The two earlier findings were a `find_anchored` phantom and an `is_match`
false positive (fail-toward-noise); this one fails toward silence.

Note on the committed prototype: the earlier fix
(`docs/troubleshooting/resharp-end-anchor-cross-api.patch`) guards `is_match` and
`find_anchored` only; it does NOT fix this `find_all` defect, because the
`FindAll` kind is chosen before those guards run. The complete fix must compute
the routing anchor flag from the ORIGINAL node for the kind classifier too (not
just the two fast-path guards).

## Reproduce

```bash
# /tmp/agent/resharp-denot-oracle, resharp = "=0.6.13"
cargo run --release --bin anchor_denot          # the lane that found it (RESHARP-INCONSISTENT line)
# minimal, both arches, resharp-internal proof:
#   /./ and /a(?:$|b)/ both match (0,1) on "a\n"; /.&a(?:$|b)/ returns []
```

## Upstream filing

Not yet drafted as an artifact; see the troubleshooting doc update for the
6-constraint check, the (to-be-extended) prototype, and the additive comment on
issue #22. Outward filing is authorization-gated.
