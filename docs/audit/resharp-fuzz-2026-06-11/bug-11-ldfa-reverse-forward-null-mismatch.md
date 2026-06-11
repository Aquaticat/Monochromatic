# bug-11: find_all reverse pass proposes a null start the forward pass rejects

Severity: crash (debug builds) / soundness (release builds). Found by the Lean
position-level differential (the lane the internal oracles cannot reach), case
R1612, trust0 (anchor-free, translator-faithful). Confirmed on the unmodified
v0.6.12 stock crate. This is a THIRD distinct crash site, separate from bug-04
(`resharp-algebra/src/lib.rs:2724`) and bug-05
(`resharp-engine/src/lib.rs:1824`).

## Minimal reproducer

```rust
// stock resharp v0.6.12, default config
use resharp::{Regex, RegexOptions};

let re = Regex::with_options(r"((?!a)|b)&(~((c)))", RegexOptions::default()).unwrap();
let _ = re.find_all(b"abca");
//        ^ debug-assertions build: panics at resharp-engine/src/ldfa.rs:906
//          release build: returns [(1,2),(4,4)], silently dropping (2,2)
let _ = re.find_all(b"ca");
//        ^ debug-assertions build: panics at resharp-engine/src/ldfa.rs:833
//          release build: returns [(2,2)], dropping the LEFTMOST match (0,0)
```

The pattern is `((?!a) | b) & ~(c)`: an alternation whose left branch `(?!a)` is
zero-width (nullable), intersected with the complement `~(c)`. All three
ingredients are required: replacing `(?!a)` with `()` or `(?=a)` removes the
fault, and dropping the `|b` alternation removes it (`(?!a)&(~((c)))` is fine).

## Panic

```txt
thread 'main' panicked at resharp-engine/src/ldfa.rs:906:17:
assertion `left != right` failed: find_all: forward scan found no end for reverse-proposed start
  left: 18446744073709551615
 right: 18446744073709551615
   4: <resharp::ldfa::LDFA>::scan_fwd_all
   5: <resharp::Regex>::find_all_dfa
   6: <resharp::Regex>::find_all
```

`18446744073709551615` is `usize::MAX` = `NO_MATCH`.

## Root cause

`find_all` (`find_all_dfa`) is a two-pass driver. A reverse scan
(`collect_rev_inner` / `scan_rev_from`) collects candidate match-START positions
into `nulls: &[usize]`; `scan_fwd_all` (`ldfa.rs:774`) then runs a forward scan
from each proposed start to find the match end. Three sites assert the coupling
invariant "a reverse-proposed start must have a forward end":

- `ldfa.rs:833` (the `nulls.last() == 0` start-at-0 path),
- `ldfa.rs:878` (the in-loop cache-miss path),
- `ldfa.rs:906` (the in-loop non-cache-miss path),

each `debug_assert_ne!(NO_MATCH, l_max_end, "find_all: forward scan found no end
for reverse-proposed start")`, guarded by `if l_max_end != NO_MATCH { push }`.

For `(nullable-alternation) & (complement)` the reverse and forward nullability
determinations diverge: the reverse pass marks a position as a null match start,
but the forward derivative of the same intersection is non-nullable there, so
`fwd_update` returns `NO_MATCH`. The invariant is violated:

- Debug-assertions builds (cargo-fuzz, any `debug_assertions` consumer, `cargo
  test`, dev builds): the `debug_assert_ne!` fires, a hard panic. Any caller of
  `find_all` on such a pattern crashes the process (DoS).
- Release builds (default `debug-assertions = false`): the assert is compiled
  out and the `if l_max_end != NO_MATCH` guard drops the unconfirmed start, so
  `find_all` silently omits a real match.

## Soundness (release), against the Lean ground truth

`llmatch` (leftmost-longest first match) over the same pattern:

```txt
hay     Lean llmatch (truth)   rust release find_all     verdict
"ca"    0:0                    [(2,2)]                   drops leftmost 0:0
"c"     0:0                    [(1,1)]                   drops leftmost 0:0
"abca"  1:2                    [(1,2),(4,4)]             first ok, drops (2,2)
""      0:0                    [(0,0)]                   ok
```

On `"ca"` and `"c"` the engine drops the leftmost match entirely, so even
`find_all().first()` is wrong, not merely a trailing zero-width omission.

## Provenance and distinctness

Surfaced by the reconstructed Lean position-level lane: the AST corpus case
R1612 (`((((?!a))|b)&(~((.&[cd]))))` on `"abca"`) was the only trust0
disagreement in a 1954-case run (the other two disagreements were nested
lookbehind-of-`\A`, the documented-unfaithful translator shape). The internal
self-consistency / SIMD oracles cannot reach this: it is a `find_all`-only path
(`is_match` uses a different driver and does not panic), and in release the
result is internally self-consistent, just incomplete, so only an external
position reference exposes it.

Distinct from:

- bug-04 (`resharp-algebra/src/lib.rs:2724`, reentrant union rewrite) -- compile
  path, different file.
- bug-05 (`resharp-engine/src/lib.rs:1824`, `rev_trivial` find_all dead branch)
  -- different file/line, different trigger (`_*$`).
- arm-bug-01 (`fwd.rs:123`, SIMD prefilter zero-width drop) -- different driver
  (prefilter vs lazy-DFA `scan_fwd_all`), not SIMD-gated (fires with SIMD on).

## Suggested fix direction

The reverse null-collection and the forward derivative must agree on nullability
for `Intersection`/`Negation` nodes. Either the reverse pass over-proposes null
starts for intersections-with-complement (it should not propose a start the
forward automaton cannot accept), or the forward `fwd_update` under-reports a
null end for the same node. The assert message ("this should be eliminated"-style
invariant) shows the author already expected exact agreement; the
intersection-with-complement nullability path is where it breaks.
