# BUG-7 negated perl classes match the empty string

## Classification

- Type: correctness, wrong nullability.
- Phase: compile time nullability computation, surfaced at match time.
- Severity: soundness, and the single largest cluster in this campaign. Any
  pattern containing `\D`, `\S`, or `\W` can match where it should not.

## Minimal reproducer

```rust
use resharp::{Regex, RegexOptions, UnicodeMode};
let re = Regex::with_options(r"\D", RegexOptions::default().unicode(UnicodeMode::Ascii)).unwrap();
assert_eq!(re.is_match(b"").unwrap(), false); // FAILS: resharp returns true
```

Command line:

```sh
repro '\D' --sweep | grep DIVERGE
# DIVERGE|ascii|rs=true|rx=false|hay=|pat="\\D"
```

`\S` and `\W` behave identically. The positive classes `\d`, `\s`, `\w`, the
dot `.`, and negated character classes `[^0]`, `[^a]` are all correct.

## Observed behaviour

`\D`, `\S`, `\W` each report `is_match("") == true`. On the empty input
`is_match` returns the pattern's `empty_nullable` flag, so resharp has computed
these single-byte negated classes as nullable. Downstream, any pattern that
suffixes one of them inherits the wrong nullability:

```sh
repro 'a*\D' --sweep | grep DIVERGE
# rs=true rx=false on hay="" and hay="0" and hay="1"
```

`a*\D` should require at least one non-digit byte, so it must not match `""` or
`"0"`. resharp matches both.

## Expected behaviour

`\D`, `\S`, `\W` each consume exactly one byte and are not nullable, matching the
`regex` crate with `.unicode(false)` byte-for-byte on pure-ascii input.

## Root cause

The negation is being lowered as a language complement rather than a byte-class
negation, so the empty string (which is not a single `\w`, `\s`, or `\d`
character) falls inside the negated language and makes the node nullable.

The correct byte-negation lowering exists at
`resharp-parser/src/lib.rs:205` (`ascii_perl_set_item`), which wraps the
positive ascii class in a negated bracketed class, but that path is only taken
when `ascii_perl_classes` is set, and `with_options`
(`resharp-engine/src/lib.rs:921`) only sets that flag for
`UnicodeMode::Javascript`. Ascii mode (`unicode = false`,
`ascii_perl_classes = false`) reaches a different lowering that produces the
nullable result. The exact node-construction line for that path is not yet
pinned.

## Impact on the campaign

This single defect explains roughly all 108 distinct `DIVERGE` patterns found in
the first 80k-pattern sweep after filtering to pure-ascii haystacks and removing
anchors and resharp-only operators. Any generated pattern containing `\D`, `\S`,
or `\W` diverged from the `regex` crate for this reason.

## Notes

- Confirmed in ascii mode via the cross-engine oracle. The nullability is
  computed before mode-specific width, so other modes are likely affected too,
  but ascii is where it was differentially observable.
- The in-tree `diff_regex` target deliberately excludes the perl classes, which
  is why coverage-guided fuzzing alone did not surface this; the directed oracle
  that includes them did.
