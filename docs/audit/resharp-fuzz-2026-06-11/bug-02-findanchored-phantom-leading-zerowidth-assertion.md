# BUG-2 find_anchored returns a phantom match for a leading zero-width assertion false at offset 0

- Type: correctness, soundness. `find_anchored` returns `Some(match)` for inputs
  that do not match at all.
- Phase: match time, the `find_anchored` path.
- Severity: soundness. `find_anchored` contradicts `is_match` and `find_all` on
  the same engine and input: `find_anchored = Some` implies a match exists, so
  `is_match` must be true, but it is false.
- Affected: all six limits-enabled configs (config-independent).
- Discovery: the FANINCONSIST oracle (`find_anchored = Some` while
  `is_match = false`) over the 40k adversarial corpus: 122 distinct triggers.

## Reproducer

```rust
use resharp::{Regex, Match};

// leading lookbehind that fails at offset 0 (nothing precedes the start):
let re = Regex::new(r"(?<=a)").unwrap();
assert_eq!(re.is_match(b"b").unwrap(), false);          // no match anywhere
assert_eq!(re.find_all(b"b").unwrap(), vec![]);         // none
assert_eq!(re.find_anchored(b"b").unwrap(), None);      // FAILS: returns Some(0:0)

// leading non-word-boundary that fails at a word char at start of input:
let re = Regex::new(r"\BU").unwrap();
assert_eq!(re.is_match(b"U").unwrap(), false);          // \B is false before 'U' at start
assert_eq!(re.find_anchored(b"U").unwrap(), None);      // FAILS: returns Some(0:1)
```

Harness:

```sh
# 283f3c3d6129 = "(?<=a)", 62 = "b"
repro --show 283f3c3d6129 62 0
# compile=ok|im=Ok(false)|fa=|fan=Ok(Some((0, 0)))|stream=
```

## Observed versus expected

`find_anchored(hay)` is the longest match anchored at offset 0. If the pattern's
leading assertion is false at offset 0 (a lookbehind at the start of input, `\B`
before a word char at the start, etc.), there is no anchored match and the result
must be `None`. resharp returns `Some(0:_)`, which both `is_match` and `find_all`
contradict (both report no match). The body of the pattern is evaluated but the
leading zero-width assertion's begin-context is not, so `find_anchored` accepts a
position the assertion forbids.

## Scope

122 distinct triggering patterns in the corpus. 93 are a leading lookbehind
`(?<=...)...`; the rest are `\b` / `\B` led. The minimal forms are
`(?<=a)` (returns `Some(0:0)`), `(?<=a)b` on `"b"` (returns `Some(0:1)`), and
`\BU` on `"U"` (returns `Some(0:1)`). Each fires `find_anchored = Some` while
`is_match = false`.

## Relationship to 2026-06-04 BUG-20

This is BUG-20 ("find_anchored ignores a leading assertion that fails at the start
of input"), reported fixed. It is only partially fixed: the specific `\B0` on
`"00"` case is now correct (`find_anchored = None`), but the general case (leading
lookbehind, and `\B` before any other word char) is still live. Treating the
narrow patch as a full fix is the documentation gap the user flagged.

## Source pointer

`find_anchored` is `resharp-engine/src/lib.rs:1891`. The 06-04 root cause was that
`find_anchored` calls the forward scan from offset 0 without seeding the
begin-of-input / leading-assertion context that `find_all` keys on; the v0.6.12
patch covered one assertion shape but not lookbehind or `\B`-before-word-char.
