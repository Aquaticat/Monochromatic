# BUG-15 DFA state construction panics on a reversed-anchor pattern

## Classification

- Type: panic, index out of bounds, crash.
- Phase: match time, lazy DFA state construction.
- Severity: crash. A panic is always a bug regardless of any oracle. It fires in
  every option configuration swept (default, ascii, full, javascript, hardened,
  the dot-all plus multiline-off flags combo, and unbounded_size).
- Found by the anchor Lean round: `\z\A.*` surfaced as a missed match against the
  Lean reference, and exercising it across the haystack set tripped the panic.

## Minimal reproducer

The panic is in the streaming match API, `Regex::stream`. The non-streaming entry
points (`is_match`, `find_all`, `find_anchored`) do not reach it, which is why a
plain single-shot match never crashes.

```rust
use resharp::{Regex, RegexOptions};
let re = Regex::with_options(r"\z\A.*", RegexOptions::default()).unwrap();
// stream over a sequence of haystacks (one Regex, many inputs)
for hay in [b"".as_ref(), b"a", b"b", b"c", b"x", b"0", b"1",
            b" ", b"\t", b"\n", b"ab", b"ba", b"aa", b"aaa"] {
    let _ = re.stream(hay);
}
// panics while streaming "aaa":
//   engine.rs:550 index out of bounds: the len is 2 but the index is 2
```

Command line (deterministic, all seven configs):

```sh
repro '\z\A.*' --sweep
# PANIC|engine.rs:550 index out of bounds: the len is 2 but the index is 2|mode=default|hay=616161|pat="\z\A.*"
# (same PANIC line for ascii, full, js, hardened, flags, unbounded)
```

The crash is specific to the `stream` path: `repro --pair`, which calls
`is_match`, `find_all`, and `find_anchored` but not `stream`, never panics on this
pattern, while `repro --sweep` and `--panicbatch`, which add `re.stream(hay)`, do.

## Observed behaviour

`create_state` (`resharp-engine/src/engine.rs:545`) reads
`self.state_nodes[state_id as usize]` at line 550 with `state_id == 2` when
`state_nodes` has length 2 (valid indices 0 and 1), so the access is out of
bounds and the engine panics. The lazy DFA construction for `\z\A.*` drives a
transition into a state id that was never allocated in `state_nodes`.

## Expected behaviour

No panic. The DFA builder must allocate the state, or never request a state id
beyond `state_nodes`.

## The shared root: reversed anchors `\z\A`

The panic sits on top of a correctness defect in the end-anchor-then-start-anchor
order. With `\A` before `\z` resharp is correct; with `\z` before `\A` it is
wrong:

```text
\A\z    on ""   im=1|fa=0:0    correct (start then end anchor, empty match at 0)
\A\z.*  on ""   im=1|fa=0:0    correct
\z\A    on ""   im=0|fa=        WRONG  (end then start anchor; empty match exists)
\z\A.*  on ""   im=0|fa=        WRONG, then panics on non-empty input
\z\Aa*  on ""   im=0|fa=        WRONG
```

On the empty string `\z` (end of input) and `\A` (start of input) both hold at
offset 0, so `\z\A.*` matches the empty string there. resharp reports no match.
The `regex` crate confirms the match exists: the `DIVERGE` oracle prints
`DIVERGE|ascii|rs=false|rx=true|hay=` for `\z\A.*` on the empty input, so this is
corroborated independently of the Lean reference and the dotnet engine. The Lean
reference also returns `0:0`.

This is the same defect family as BUG-3's `\z\A(?:a){0,1}` (is_match false on the
empty string when both anchors hold). The new contribution here is that the
reversed-anchor handling not only drops the match but, once a consuming factor
like `.*` follows and the DFA is built incrementally, walks into an unallocated
state and crashes.

## Distinct triggers

```text
\z\A.*    panic (and missed empty match)
\z\A.?    missed empty match (im=0 where a match exists)
\z\A.     missed empty match
\z\Aa*    missed empty match
\z\A      missed empty match
```

Larger anchor patterns from the Lean round that hit the same missed-match family
(rust none, Lean 0:0):

```text
[a-z]{0,2}\z\A0{0,2}\d*
\z\A{2,2}~((?:a))
\z((\A{3,5}|[a-c])&(\A{3,5}|[^\w]))
\A{0,1}\z\A+((0)*|(\D{0}&.{0,1}))
```

## Affected configurations

The panic reproduces in every configuration the oracle sweeps, all seven:
`default`, `unicode(Ascii)`, `unicode(Full)`, `unicode(Javascript)`,
`hardened(true)`, `dot_matches_new_line(true)` with `multiline(false)`, and
`unbounded_size(true)`. The reversed-anchor missed match likewise affects all of
them. The full `RegexOptions` config surface is `unicode` (four modes),
`multiline`, `hardened`, `unbounded_size`, plus the translator flags
`dot_matches_new_line`, `case_insensitive`, and `ignore_whitespace`; the panic is
independent of all of them.

## Notes

- The panic site `create_state` at `engine.rs:550` is distinct from the BUG-1
  re-entrancy panic (union and intersection rewrites) and the BUG-2 assert
  (`engine.rs:960`). It is a third independent crash site.
- Because the panic depends on the lazy DFA build order, it can hide behind a
  single-shot match and only appear once a `Regex` is reused, which is the normal
  case for a compiled pattern. That makes it more dangerous in real use than the
  single-haystack reproducers suggest.
