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
null starts, so `scan_fwd_all` is never asked about them, no assert fires, and
`find_all` silently omits them.

This was verified, not inferred, by printing the `nulls` slice that
`scan_fwd_all` receives (a one-line instrument in the engine copy), on `"abab"`:

```txt
((?!b)|ba)&(aa)?   nulls = [4]        <- reverse never proposes 0 or 2 (UNDER-collect) -> silent drop
((?!b)|ba)&(aa)*   nulls = [4, 2, 0]  <- reverse DOES propose 0; forward rejects -> panic (bug-11)
((?!a)|b)&(~((c))) nulls = [4, 2, 1]  <- reverse proposes 1; forward rejects -> panic (bug-11)
```

So the same `((?!b)|ba)&X` skeleton produces genuinely different reverse output:
`X = (aa)?` yields `nulls = [4]` (the leftmost starts are absent), while `X =
(aa)*` yields `nulls = [4,2,0]` (0 is present but the forward pass refuses it).
Under-collection and over-proposal are different defects in the reverse
null-collection, not one defect seen twice; a fix that teaches the forward pass to
accept bug-11's proposed starts would leave bug-12's missing-from-`nulls` starts
missing. The two are siblings in one subsystem, toggled by `?` vs `*`:

```txt
((?!b)|ba)&(aa)?   -> [(4,4)]                       bug-12 (silent drop)
((?!b)|ba)&(aa)*   -> panic at ldfa.rs:833          bug-11 (over-proposal)
((?!a)|b)&(~((c))) -> panic at ldfa.rs:833/906      bug-11 (over-proposal)
```

They are counted as distinct because the `nulls` evidence above shows two
different reverse-pass faults (under-collection vs over-proposal), not one fault
seen twice, and the observable failure and severity differ: bug-11 is a loud
crash in any debug/test build (plus a release drop); bug-12 is a silent wrong
`find_all` in EVERY build, which no panic ever surfaces. Both live in the reverse
null-collection / forward-confirmation subsystem, so a single rewrite of that
subsystem could plausibly fix both at once; if the maintainer confirms one fix
covers both, treat them as one. The split is deliberately conservative about the
shared subsystem while preserving the distinct silent-soundness fault, which is
materially worse for consumers than a crash they would notice.

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
