# bug-13: intersection with an optional lookahead leaks the consuming width

Severity: soundness (silent, both debug and release; find_all AND find_anchored).
Found by the Lean position-level differential (seed-4004 run, case R48, trust0,
anchor-free, translator-faithful). Confirmed on the unmodified v0.6.12 stock
crate and against the Lean ground truth. This is a match-END over-extension (a
span returned TOO LONG), the opposite direction from bug-11/bug-12 (which drop
matches), and it lives in the forward match-extension path, not the null-start
collection.

## Minimal reproducer

```rust
// stock resharp v0.6.12, default config
use resharp::{Regex, RegexOptions};

let re = Regex::with_options(r"a?&(?=a)?", RegexOptions::default()).unwrap();
re.find_all(b"ab");        // -> [(0,1),(1,1),(2,2)]   WRONG: first span (0,1)
re.find_anchored(b"ab");   // -> Some((0,1))           WRONG
// correct: [(0,0),(1,1),(2,2)] / Some((0,0))
```

Identical in debug-assertions and release builds (no panic). `is_match` is
`true` (correct: a match exists), so only the span is wrong.

## Why (0,1) cannot be a match

`a?` is the language `{"", "a"}`. `(?=a)?` is `(?=a) | ε`; both alternatives are
zero-width, so its language is `{""}`. The intersection `a? & (?=a)?` requires
the SAME span on both sides, and the only common member is the empty string:

```txt
(a | ε) & ((?=a) | ε)
  = (a & (?=a)) | (a & ε) | (ε & (?=a)) | (ε & ε)
  =   EMPTY     |  EMPTY   | zero-width@next=a | zero-width
  = {""}   (zero-width only)
```

`a & (?=a)` is empty because a width-1 span and a zero-width assertion cannot be
the same span. So every match of `a? & (?=a)?` is zero-width; `(0,1)` (the span
`"a"`) is not in the language. The engine returns it anyway: it lets the
consuming `a` match while the satisfied lookahead `(?=a)` holds, conflating
"the lookahead assertion holds at this position" with "the lookahead is part of
this span", and the consuming width leaks into the result.

## Ground truth (Lean `llmatch`)

```txt
hay   Lean first span   rust find_all              rust find_anchored
"ab"  0:0               [(0,1),(1,1),(2,2)]        Some((0,1))
"a"   0:0               (analogous)                Some((0,1))
"b"   0:0               (analogous)                ...
```

Since the leftmost match is at offset 0, `llmatch`'s `0:0` is also the
longest-anchored-at-0 span that `find_anchored` must return; rust's `Some((0,1))`
is longer than the true match, confirming the leak in `find_anchored` too.

## Trigger shape

Both operands of `&` must be nullable, and the lookahead's assertion must HOLD at
the position:

```txt
a?&(?=a)?   ab -> [(0,1),...]   leak  ((?=a) holds: next is 'a')
a?&(?!b)?   ab -> [(0,1),...]   leak  ((?!b) holds: next is not 'b')
a?&(?=c)?   ab -> [(0,0),...]   ok    ((?=c) false at 0)
a?&(?=b)?   ab -> [(0,0),...]   ok    ((?=b) false at 0)
a&(?=a)?    ab -> []            ok    (consuming side not nullable -> empty, correct)
a&(?=a)     ab -> []            ok
```

Removing the `?` from the consuming side (`a&(?=a)?`) makes the language empty and
the engine correctly returns no match, so the leak needs the nullable consuming
operand `a?`. When the optional lookahead is unsatisfied, the engine correctly
falls back to the zero-width `ε` branch. The fault is specifically: nullable
consuming pattern `&` nullable lookahead whose assertion is satisfied -> the
consuming width survives the intersection.

## Distinctness

- vs bug-11 / bug-12: those are null-START faults that DROP matches (forward
  rejects a proposed start; reverse never proposes one). bug-13 is a match-END
  over-extension that ADDS a too-long span. Opposite direction, different path
  (forward match-extension / intersection nullability vs reverse-null
  collection).
- vs bug-10: bug-10 is `find_anchored` returning a span SHORTER than the true
  longest (complement-with-end-anchor). bug-13 returns one LONGER than the true
  match (intersection-with-optional-lookahead). Opposite direction, different
  trigger.
- vs the 2026-06-04 BUG-13 ("lookahead width leak", `(?=(?=c)c{1,3})`,
  recorded fixed on its trigger): same THEME (a lookahead's width leaking into a
  match) but a distinct, live construct (intersection of two nullables rather
  than a nested lookahead). The width-leak class is not fully closed in v0.6.12;
  it survives through `&`.

## Provenance

Lean lane, seed-4004 run: R48 (`((a)?&(((?=a)))?)` on `"a\nb"`, lean `0:0` vs
rust `0:1`), minimized to `a?&(?=a)?` on `"ab"`. The internal oracles miss it:
the result is internally self-consistent (find_all sorted, non-overlapping,
agreeing with is_match; find_anchored at offset 0), just positionally too long,
so only the external position reference exposes it.
