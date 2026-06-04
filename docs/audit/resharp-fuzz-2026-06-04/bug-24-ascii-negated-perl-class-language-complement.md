# BUG-24 ascii-mode \W \D \S match everything (language complement instead of class negation)

## Classification

- Type: correctness, soundness. In the ascii unicode config the negated perl
  shorthands `\W`, `\D`, `\S` match every position, including word characters,
  digits, whitespace, and the empty string.
- Phase: compile (parser lowering of negated perl classes).
- Severity: high. `\W`, `\D`, `\S` are completely non-functional in the ascii config:
  they accept everything, so any pattern using them in ascii mode is wrong. The
  positive forms `\w`, `\d`, `\s` and bracketed negation `[^a]` are fine.

## Minimal reproducer

```rust
use resharp::{Regex, RegexOptions, UnicodeMode};
let ascii = RegexOptions::default().unicode(UnicodeMode::Ascii);

let re = Regex::with_options(r"\W", ascii).unwrap();
assert_eq!(re.is_match(b"a").unwrap(), false); // FAILS: 'a' is a word char, returns true
assert_eq!(re.is_match(b"").unwrap(),  false); // FAILS: empty string, returns true
```

`\W` must match a single non-word byte; it must not match the word char `a`, and a
single-character class can never match the empty string.

## Observed behaviour

`is_match`, by config (`default`, `ascii`, `full`, `js`):

```text
\W on "a" expect false   -> default=false  ascii=true   full=false  js=false
\W on ""  expect false   -> default=false  ascii=true   full=false  js=false
\D on "1" expect false   -> default=false  ascii=true   full=false  js=false
\S on " " expect false   -> default=false  ascii=true   full=false  js=false
\w on "a" expect true    -> default=true   ascii=true   full=true   js=true   (control)
[^a] on "a" expect false -> default=false  ascii=false  full=false  js=false  (control)
```

Only the ascii config is wrong, and only for the negated shorthands. `find_all` in
ascii confirms the shape: `\W` on `"a"` returns `[(0,0),(1,1)]` (zero-width matches,
like epsilon), and on `""` returns `[(0,0)]`; `\w{2}` is correctly empty. The negated
shorthand is behaving as the regex language complement `~(\w)` (matches the empty
string and any string that is not a single word char), not the character class
`[^\w]`.

Surfaced by the differential oracle `repro --divergebatch` (resharp ascii `is_match`
vs the `regex` crate with `unicode(false)`): thousands of `rs=true|rx=false` rows, all
on `\W`/`\D`/`\S` patterns.

## Expected behaviour

`\W` is the character-class complement of `\w` (a single non-word byte), `\D` of
`\d`, `\S` of `\s`. None is nullable. In ascii mode they must agree with the `regex`
crate's `(?-u)\W` etc. and with resharp's own default/full/js configs, which are all
correct.

## Independent corroboration

- resharp's own default, full, and js configs return the correct `false` for every
  case above, contradicting the ascii config on the same engine.
- The `regex` crate with `unicode(false)` matches `\W` against `"a"` nowhere and does
  not match `\W` on the empty string, agreeing with the expected `false`.
- The class semantics are standard; Lean's `\W` is the negated word class, never
  nullable.

## Root cause

The parser lowers a perl class in `perl_class_node` (`resharp-parser/src/lib.rs:1276`)
through three branches keyed on the unicode flags:

```rust
let translated = if self.global_ascii_perl {            // js: ascii_perl_classes
    // ... builds the positive byte set `pos` ...
    if negated { resharp_algebra::neg_class(tb, pos) } else { pos }   // lib.rs:1309  CORRECT
} else if self.global_unicode {                          // default/full
    // ... returns precomputed self.unicode_classes.non_word / non_digit / non_space
} else {                                                 // ascii: both flags false
    let pos = /* union of [a-z][A-Z][0-9][_] for Word, etc. */;
    if negated {
        tb.mk_compl(pos)                                 // lib.rs:1373  WRONG
    } else {
        pos
    }
};
```

`UnicodeMode::Ascii` maps to `unicode = false` and `ascii_perl_classes = false`
(`resharp-engine/src/lib.rs:919`, `:921`; only `UnicodeMode::Javascript` sets
`ascii_perl_classes`), so `global_unicode` and `global_ascii_perl` are both false
(`resharp-parser/src/lib.rs:589`, `:591`) and lowering falls into the final `else`.

There, a negated shorthand uses `tb.mk_compl(pos)` (`lib.rs:1373`), the regex
language complement operator `~`, instead of `neg_class` (character-class negation).
`~(\w)` is the set of strings that are not a single word char, which includes the
empty string and every non-word substring, so `is_match` is true everywhere and
`find_all` yields zero-width matches. The js branch does the same construction
correctly with `resharp_algebra::neg_class(tb, pos)` (`lib.rs:1309`), and the unicode
branch uses proper negated predicates (`lib.rs:1322`/`:1334`/`:1346`).

The fix is one line: in the ascii `else` branch, negate the class with
`resharp_algebra::neg_class(tb, pos)` rather than `tb.mk_compl(pos)`, matching the js
branch.

## Affected configurations

ascii only (`UnicodeMode::Ascii`). default, full, js are correct. The positive
shorthands `\w`/`\d`/`\s` and bracketed negation `[^...]` are correct in ascii.

## Relationship to other findings

- Independent of the assertion/caching defects (BUG-20, BUG-21) and the complexity
  defects (BUG-18, BUG-22, BUG-23); this is a plain class-lowering substitution of
  the language-complement operator for class negation, isolated to one branch.
- The `mk_compl`-vs-`neg_class` confusion is the same conceptual hazard the codebase
  manages elsewhere (the in-band sentinel and the two find_all paths in
  `code-quality.md`): a language-level operator applied where an element-level one is
  meant.

## Code quality

Three sibling branches compute the same negated-class result three different ways
(`neg_class`, precomputed `non_word`, and `mk_compl`); the third disagrees with the
other two. Converging the negation onto a single `neg_class` helper for all
non-unicode branches removes the divergence and the bug at once.
