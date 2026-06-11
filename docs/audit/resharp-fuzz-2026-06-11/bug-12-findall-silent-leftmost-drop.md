# bug-12: find_all silently drops the leftmost match (no panic, debug and release)

Severity: soundness (silent, both debug and release). Found by the Lean
position-level differential (seed-1001 run, case R2280, trust0, anchor-free,
translator-faithful). Confirmed on the unmodified v0.6.12 stock crate and against
the Lean ground truth. Closely related to bug-11 (same `find_all`
reverse/forward null subsystem) but a distinct manifestation: bug-11 panics in
debug builds; this returns a wrong answer with NO assertion, even under
`debug-assertions`, so a consumer's test suite sees no crash.

## Minimal reproducer

```rust
// stock resharp v0.6.12, default config
use resharp::{Regex, RegexOptions};

let re = Regex::with_options(r"((?!b)|ba)&(aa)?", RegexOptions::default()).unwrap();
re.find_all(b"ab");   // -> [(2,2)]   WRONG: drops the leftmost match (0,0)
re.find_all(b"abab"); // -> [(4,4)]   WRONG: drops (0,0) and (2,2)
re.find_all(b"aba");  // -> [(3,3)]   WRONG: drops (0,0) and (2,2)
```

Identical in debug-assertions and release builds (no panic in either).
`is_match` is unaffected (`true`), since some match still exists.

## Ground truth (Lean `llmatch`, leftmost-longest first span)

```txt
hay     Lean first span   rust find_all     rust first span
"ab"    0:0               [(2,2)]           2:2   (wrong)
"abab"  0:0               [(4,4)]           4:4   (wrong)
"aba"   0:0               [(3,3)]           3:3   (wrong)
```

The pattern is `((?!b) | ba) & (aa)?`. `(?!b)` is a zero-width assertion that
holds wherever the next byte is not `b` (or at end), so the empty span `[s,s]`
matches `((?!b)|ba)` whenever `text[s] != 'b'`; intersecting with `(aa)?` (which
contains the empty string) keeps every such empty span. On `"ab"` the leftmost
match is the empty span `0:0` (byte 0 is `a`). The engine instead returns only
the last match (`2:2`), dropping `0:0` entirely.

## Root cause and relationship to bug-11

`find_all` (`find_all_dfa`) collects candidate match-START positions in a reverse
pass and confirms each with a forward scan in `scan_fwd_all` (`ldfa.rs`). bug-11
is the case where the reverse pass OVER-proposes a null start that the forward
pass then rejects, tripping `debug_assert_ne!(NO_MATCH, l_max_end)` at
`ldfa.rs:833/878/906` (panic in debug, drop in release).

bug-12 is the opposite direction: for `(nullable-alternation) & (nullable
right-operand)` the reverse pass UNDER-collects, never proposing the leftmost
null starts (offsets 0 and 2 here), so `scan_fwd_all` is never asked about them,
no assert fires, and `find_all` silently omits them. The two are the same
subsystem (reverse null-collection vs forward confirmation for nullable
intersections) failing in opposite directions, and the trigger sits right next to
bug-11's: keeping the alternation and swapping the right operand toggles between
them on the same haystack `"abab"`:

```txt
((?!b)|ba)&(aa)?   -> [(4,4)]                       bug-12 (silent drop)
((?!b)|ba)&(aa)*   -> panic at ldfa.rs:833          bug-11 (over-proposal)
((?!a)|b)&(~((c))) -> panic at ldfa.rs:833/906      bug-11 (over-proposal)
```

They are filed separately because the observable failure, the severity profile,
and the likely fix differ: bug-11 is a loud crash in any debug/test build (and a
release drop); bug-12 is a silent wrong `find_all` in EVERY build, which no panic
ever surfaces. A fix that only repairs the forward/reverse assert (bug-11) would
leave bug-12's under-collection untouched. If the maintainer determines a single
reverse-null-collection fix covers both, they should be merged; this file records
the distinct silent-soundness manifestation so it is not lost.

## Provenance

Lean lane, seed-1001 run: R2280
(`((((((?!b))){2,2}|(ba))|(((_){0,}|\w)&((\Da)&b)))&((~((~((aa)))))){0,1})` on
`"abab"`, lean `0:0` vs rust `4:4`). Minimized to `((?!b)|ba)&(aa)?` (the
`_*`/`\w`/`\D`/empty-intersection scaffolding was incidental; the empty span
`(aa)?` right-operand and the zero-width alternation branch are the essentials).
The internal oracles miss it for the same reason as bug-11's release half: the
result is internally self-consistent (find_all sorted, non-overlapping,
non-empty, agreeing with is_match), just positionally wrong, so only an external
position reference exposes it.
