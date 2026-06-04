# BUG-3 is_match returns false while find_all returns a match

## Classification

- Type: correctness, two public entry points disagree on the same input.
- Phase: match time.
- Severity: soundness. A caller using `is_match` as a gate before `find_all`
  (or vice versa) gets contradictory answers.

## Minimal reproducer

```rust
use resharp::Regex;
let re = Regex::new(r"(\z|(?=a)\w)").unwrap();
let hay = b"0";
assert_eq!(re.is_match(hay).unwrap(), false);          // resharp says no match
assert_eq!(re.find_all(hay).unwrap().len(), 1);        // but find_all returns one
```

Command line:

```sh
repro '(\z|(?=a)\w)' --sweep | grep INCONSIST
```

Second independent trigger (found by the `match_invariants` target), opposite
direction is also possible; this one is `is_match` true, `find_all` empty:

```sh
repro '\BU' 5569695c --hex   # haystack "Uii\" ; INCONSIST in default, full, hardened
```

## Observed behaviour

For `(\z|(?=a)\w)`: `is_match` is false but `find_all` returns one match. It
reproduces in the default, full, flags, and hardened modes (not ascii), on many
haystacks including `0`, a single space, a tab, a newline, and `HELLO`.

For `\BU` on `Uii\`: `is_match` is true but `find_all` returns zero matches, in
the default, full, and hardened modes.

## Expected behaviour

`is_match(h)` must equal `!find_all(h).is_empty()` for every pattern and
haystack. This is one of the invariants the in-tree `match_invariants` fuzz
target asserts.

## Root cause

Not fully traced. `is_match` (`resharp-engine/src/lib.rs:1861`) has several
fast-path early returns keyed on `fwd_begin_anchored`, `rev_end_anchored`,
`has_bounded`, and the selected prefix, while `find_all` dispatches through a
different set of paths (`compute_find_all`). Both triggers involve a zero-width
or anchor-adjacent branch in an alternation (`\z` end anchor with a lookahead,
or `\B` non-word-boundary), which is exactly where the two entry points choose
different specialised scans. The minimal forms point at the anchor-or-lookahead
branch of the `is_match` fast path returning the wrong answer.

## Notes

- `(\z|a)`, `(\z|\w)`, and `((?i:\z)|\w)` do not trigger; the lookahead plus the
  perl class is required: `(\z|(?=a)\w)`.
- Distinct triggers in the sweeps cluster tightly, but the two directions
  (false-but-present and true-but-absent) and the two distinct minimal shapes
  suggest more than one underlying fast-path defect.
