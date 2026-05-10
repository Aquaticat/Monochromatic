# Resharp: `\b`, `\B`, `^`, `$` inside complement bodies fail with `Algebra(UnsupportedPattern)`

## Symptom

A rule passed to [`resharp`][resharp] 0.5 (via the consumer crate
`forbidden-strings` 0.1.0 in this workspace, but the bug is upstream)
fails at compile time when its complement body contains a word-boundary
or text-anchor assertion:

```
forbidden-strings: rule on line N (resharp): Algebra(UnsupportedPattern)
```

Resharp renders the variant as "unsupported lookaround pattern"
(`resharp-algebra/src/lib.rs:35`).

User-facing patterns that trigger the failure:

```
/em-dash&~(.*\bnpm\b.*)/
/em-dash&~(.*\B.*)/
/em-dash&~(^foo$)/
/(?<=[a-z]) -- (?=[a-z])&_*&~(.*\b(npm|git)\b.*)/
/^.*[a-z] -- [a-z].*$&~(.*[`].*)&~(.*npm.*)&~(.*\bgh\b.*)/
```

An earlier reading suggested an "algebra ceiling" tied to alternation
count or chained-complement count.
That reading is wrong:
500 alternatives inside a single complement and 500 chained complements
both compile cleanly,
provided the bodies use literal characters or character classes.
The trigger is the presence of `\b`, `\B`, `^`, or `$` inside `~(...)`,
regardless of size.

## Root cause

Three rewriting steps in resharp turn user-visible "anchors" into
internal lookarounds,
then the symbolic-derivative reverse pass refuses to reverse a complement
whose body contains a lookaround.

### Step 1: `^` and `$` become lookarounds in default multiline mode

`resharp-parser/src/lib.rs:64` defaults `multiline` to `true`:

```rust
multiline: true,
```

In multiline mode, `^` and `$` map to `StartLine` / `EndLine`,
and the AST-to-NodeId translator rewrites them to lookarounds
(`resharp-parser/src/lib.rs:1425-1441`):

```rust
ast::AssertionKind::StartLine => {
    if !self.multiline.get() {
        return Ok(NodeId::BEGIN);
    }
    let left = NodeId::BEGIN;
    let right = tb.mk_u8(b'\n');
    let union = tb.mk_union(left, right);
    Ok(tb.mk_lookbehind(union, NodeId::MISSING))
}
ast::AssertionKind::EndLine => {
    if !self.multiline.get() {
        return Ok(NodeId::END);
    }
    let left = NodeId::END;
    let right = tb.mk_u8(b'\n');
    let union = tb.mk_union(left, right);
    Ok(tb.mk_lookahead(union, NodeId::MISSING, 0))
}
```

So `^foo$` parsed under default flags becomes
`Lookbehind(begin|nl) · foo · Lookahead(end|nl)` in the NodeId tree.

`\A` and `\z` map to `StartText` / `EndText`
(`resharp-parser/src/lib.rs:1417-1418`),
which return `NodeId::BEGIN` / `NodeId::END` directly,
bypassing the lookaround rewrite:

```rust
ast::AssertionKind::StartText => Ok(NodeId::BEGIN),
ast::AssertionKind::EndText => Ok(NodeId::END),
```

### Step 2: `\b` and `\B` become lookarounds via context rewriting

`resharp-parser/src/lib.rs:1305-1346` pre-processes `\b`/`\B`
in concatenation contexts.
It inspects the atoms to the left and right of the boundary,
classifies each as `Word`, `NonWord`, or `Unknown`,
then rewrites the boundary as a lookaround whose body asserts the opposite class
(`resharp-parser/src/lib.rs:1329-1345`):

```rust
match (left, right) {
    (NonWord, Word) | (Word, NonWord) => Ok((NodeId::EPS, idx + 1)),
    (Word, _) => {
        let neg = tb.mk_neg_lookahead(word_id, 0);
        Ok((neg, idx + 1))
    }
    (NonWord, _) => {
        let tail = tb.mk_concat(word_id, NodeId::TS);
        self.merge_boundary_with_following_lookaheads(asts, idx, tail, translator, tb)
    }
    (_, Word) => Ok((tb.mk_neg_lookbehind(word_id), idx + 1)),
    (_, NonWord) => Ok((tb.mk_lookbehind(word_id, NodeId::MISSING), idx + 1)),
    _ => Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex)),
}
```

A bare `\b` that survives this helper
(for example, `\b` between two unknowns)
falls through to the generic assertion handler at
`resharp-parser/src/lib.rs:1419-1424`,
which surfaces a different error at parse time:

```rust
ast::AssertionKind::WordBoundary => {
    Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex))
}
ast::AssertionKind::NotWordBoundary => {
    Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex))
}
```

In the em-dash rules,
the `\b` always has a known word neighbour
(`\bnpm\b` has Word on both sides via the literal letters),
so it passes parsing and reaches the algebra layer as a lookaround pair.

### Step 3: `reverse` refuses complement-of-lookaround

DFA construction walks the NodeId tree in both directions.
The reverse pass at `resharp-algebra/src/lib.rs:2203-2281` rewrites each node.
The complement case at lines 2233-2239 is the failure site:

```rust
Kind::Compl => {
    if self.contains_look(node_id.left(self)) {
        return Err(ResharpError::UnsupportedPattern);
    }
    let body = self.reverse(node_id.left(self))?;
    self.mk_compl(body)
}
```

`contains_look` (`resharp-algebra/src/lib.rs:978-981`) is a cheap meta-flag check:

```rust
pub fn contains_look(&mut self, node_id: NodeId) -> bool {
    self.get_meta_flags(node_id)
        .has(MetaFlags::CONTAINS_LOOKBEHIND.or(MetaFlags::CONTAINS_LOOKAHEAD))
}
```

The error variant is declared at `resharp-algebra/src/lib.rs:25`
and rendered at `:35`:

```rust
UnsupportedPattern,
// ...
ResharpError::UnsupportedPattern => write!(f, "unsupported lookaround pattern"),
```

So the call chain for `em&~(.*\bnpm\b.*)` is:
parser rewrites `\b` to lookarounds (step 2),
the complement body now `contains_look`,
DFA setup calls `reverse` on the complement,
reverse hits line 2234 and returns `Err(UnsupportedPattern)`.
The render is intentionally generic ("unsupported lookaround pattern"),
which masks the surface trigger.

### Why this restriction exists

Resharp implements Brzozowski-style symbolic derivatives over a structured
node tree,
and the matching engine derives both forward and reverse derivatives during
DFA construction
(the reverse pass is invoked from `ts_rev_start` at
`resharp-algebra/src/lib.rs:2196-2201`).
Reversing a complemented language with zero-width positional constraints
is not algebraically straightforward:
De Morgan-style pushdown of the complement past a lookaround does not
preserve the lookaround's position-sensitive semantics,
because the reverse operation flips which direction "before" and "after" point.
Rather than implement a per-case reverse for each lookaround kind nested
under complement,
the codebase bails.
The same node tree without the enclosing complement reverses cleanly:
the `Kind::Lookahead` arm at lines 2251-2273 returns `Ok` for `rel == 0`
lookaheads without anomalous tails.

## Verification

Verified 2026-05-10 against `resharp 0.5` via the forbidden-strings 0.1.0
release binary
(`packages/dev-script/forbidden-strings/target/release/forbidden-strings`).

Test harness:

```bash
cd /tmp
touch probe-input.txt
FS=/var/home/user/Monochromatic/packages/dev-script/forbidden-strings/target/release/forbidden-strings
echo '<rule>' > probe-rule.txt
$FS --rules probe-rule.txt probe-input.txt
echo "EXIT=$?"   # 0: compile + scan OK; 2: rule error
```

### Rules that compile cleanly

- `/em&~(.*foo.*)/` (simple literal in complement body)
- `/em&~((?i)foo)/`, `/em&~([a-z]+)/`, `/em&~(.*[^a-z].*)/` (other features in complement body)
- `/em&~(\Afoo\z)/` (`\A`/`\z` text anchors inside complement; no lookaround rewrite)
- `/em\b/`, `/\bem\b&_*/`, `/\bem\b&_*&~(.*foo.*)/` (`\b` outside complement body)
- `/(?=\bem\b).*/` (`\b` inside a lookaround body, not inside a complement)
- 500 alternatives in a single `~(.*(w0|w1|...|w499).*)` with simple bodies
- 500 chained `&~(.*w0.*)&~(.*w1.*)&...&~(.*w499.*)`

### Rules that fail with `Algebra(UnsupportedPattern)`

- `/em&~(.*\bnpm\b.*)/`, `/em&~(.*\bnpm.*)/`, `/em&~(.*npm\b.*)/` (`\b` in complement body)
- `/em&~(.*\B.*)/` (`\B` in complement body)
- `/em&~(^foo$)/`, `/em&~(\Afoo$)/`, `/em&~(^foo\z)/` (line anchors in complement)
- `/(?=^foo)bar/` (`^` at start of lookahead body, default multiline rewrite chain)
- `/(?<=\b)foo/` (`\b` in lookbehind body without a neighbouring word-class atom)

The earlier "alternation count" / "seven chained complements" framing was a misdiagnosis:
every observed failing case contained `\b`,
and the count axis had no measured ceiling within practical bounds.

## Verified workarounds

### Replace `\b` with literal whitespace inside complement bodies

```
# fails
/^.*[a-z] -- [a-z].*$&~(.*(\bnpm\b|\bgit\b).*)/

# compiles
/^.*[a-z] -- [a-z].*$&~(.* (npm|git) .*)/
```

Tradeoff: tokens at line start or line end are not bracketed by literal spaces
and slip through the exclusion.
For prose scans where the excluded tokens are toolchain names appearing
mid-line, this is acceptable.

### Replace `\b` with `\W` character class inside complement bodies

```
# fails
/em&~(.*\bnpm\b.*)/

# compiles
/em&~(.*\Wnpm\W.*)/
```

Tradeoff: `\W` consumes a character on each side,
so the complement matches strings whose `npm` is bracketed by non-word characters
rather than just bordered by a word boundary.
Tokens at the absolute start or end of the scanned content
(no character before or after) still slip through.

### Use `\A`/`\z` instead of `^`/`$` inside complement bodies

```
# fails
/em&~(^foo$)/

# compiles
/em&~(\Afoo\z)/
```

Semantics shift from "any line whose entirety is `foo`"
to "the entire scanned content is exactly `foo`".
Useful only when the rule already scans whole-file content rather than per-line.

### Move the boundary check outside the complement

If the rule's intent allows asserting the boundary at the match site rather
than inside the excluded set,
lift `\bword\b` out of `~(...)` and place it in the main concatenation:

```
# fails
/em&~(.*\bword\b.*)/

# compiles (different semantics: asserts em adjacent to word, not "exclude lines containing word")
/em.*\bword\b/
```

## What does not work

- **Splitting one complement across multiple rules.**
  Forbidden-strings combines rules via union,
  so any rule firing flags the line.
  Splitting makes detection more permissive, not less.
- **Inline `(?-m)` flag to disable multiline.**
  `/(?-m)em&~(^foo$)/` and variants still fail.
  The flag does not propagate into the complement body's parse context
  in the configurations tested, and the rewrite at
  `resharp-parser/src/lib.rs:1425-1441` runs against the surrounding
  flag state, not a locally-scoped override that reaches the assertion.
  Use `\A`/`\z` instead.
- **Wrapping the complement body in a non-capturing group with flag modifiers.**
  `/em&~((?-m:^foo$))/` fails identically;
  the `^`/`$` rewrite happens at AST translation, before the group's flag
  scope is applied to its children's positional semantics.

## Draft upstream issue

Title: `Algebra(UnsupportedPattern)` for `\b`, `\B`, `^`, `$` inside
complement bodies; error string ("unsupported lookaround pattern") does
not mention the surface trigger

Labels: `bug`, `parser`, `documentation`

```md
## Description

Patterns of the form `A&~(B)` where `B` contains `\b`, `\B`, `^`, or `$`
fail at compile time with `ResharpError::UnsupportedPattern`, rendered as
"unsupported lookaround pattern". The error message does not mention
word boundaries or text anchors, which are the actual surface triggers.

The root cause chain:

1. The parser rewrites `^`/`$` to lookbehind/lookahead in default
   multiline mode (`resharp-parser/src/lib.rs:1425-1441`).
2. The parser rewrites `\b`/`\B` to negative-lookahead /
   negative-lookbehind based on adjacent-atom classification
   (`resharp-parser/src/lib.rs:1305-1346`).
3. The reverse pass refuses to reverse a complement whose body contains
   a lookaround (`resharp-algebra/src/lib.rs:2233-2236`).

The legibility issue: a user writing `em&~(.*\bnpm\b.*)` has not
written a lookaround anywhere in the surface syntax, so the error
"unsupported lookaround pattern" is not actionable. The user must read
the algebra source to discover that `\b` becomes a lookaround
internally.

## Reproduction

Against `resharp 0.5`:

```rust
use resharp::Regex;

// All four fail with Err(Algebra(UnsupportedPattern))
let _ = Regex::new(r"em&~(.*\bword\b.*)");
let _ = Regex::new(r"em&~(.*\B.*)");
let _ = Regex::new(r"em&~(^foo$)");
let _ = Regex::new(r"em&~(\Afoo$)");
```

```rust
// These compile fine, demonstrating the trigger is positional, not size:
let _ = Regex::new(r"em&~(.*foo.*)").unwrap();
let _ = Regex::new(r"em&~(\Afoo\z)").unwrap();
let _ = Regex::new(r"em\b&_*&~(.*foo.*)").unwrap();
// 500 alternatives in a single complement compile cleanly
// 500 chained `&~(...)` complements compile cleanly
```

## Why this matters

Resharp's set algebra is the feature that makes complement-style
exclusion rules tractable; the rule shape `A&~(B)` is the primary use
case for choosing resharp over the standard `regex` crate. The natural
way to write "match A but not when bordered by token X" is
`A&~(.*\bX\b.*)`, and that fails opaquely. Users without algebra-layer
familiarity reach for alternation count or chain count as the suspected
trigger and report the wrong limit upstream.

## Suggested fix

Either of:

1. Lift the "no lookaround inside complement" restriction by handling
   the four lookaround reverse cases (`Kind::Lookahead` / `Kind::Lookbehind`,
   positive / negative) inline at the `Kind::Compl` arm of `reverse`
   (`resharp-algebra/src/lib.rs:2233`). Positive lookarounds can be
   pushed through De Morgan with body inversion; negative lookarounds
   require ensuring the complement structure of position-sensitive
   match-set semantics is preserved.

2. At minimum, improve the error message to name the surface trigger.
   `UnsupportedPattern` should distinguish "complement contains
   lookaround (introduced by `\b`/`\B`/`^`/`$` rewrite)" from
   "complement contains unhandled counted repetition" so users can map
   the error to a workaround without reading the algebra source.

## Workaround

Replace `\b` with literal whitespace or `\W` inside complement bodies;
use `\A`/`\z` in place of `^`/`$` when whole-content semantics are
acceptable. Move boundary assertions to the match site outside the
complement when the rule's intent permits.
```

[resharp]: https://github.com/ieviev/resharp
