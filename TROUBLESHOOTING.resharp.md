# Resharp: upstream bugs and forbidden-strings workarounds

This document tracks the upstream resharp bugs that `forbidden-strings`
defends against, the consumer-side guards that block each, and the
verification path for each finding. Three bugs are tracked, all
confirmed unchanged from resharp 0.5.3 through 0.6.0:

- **Bug A**: `\b`/`\B`/`^`/`$` inside `~(...)` complement bodies fail with
  `Algebra(UnsupportedPattern)`. Defense: `lookaround_in_complement`.
- **Bug B**: intersection (`&`) involving a lookbehind triggers a
  `debug_assert!` in `scan_fwd_all` (`resharp/src/engine.rs:1020`).
  In release the assertion is compiled out and the path silently returns
  corrupted matches. Defense: `intersection_with_lookbehind` pre-validator.
  `catch_unwind` does NOT help in release because there is no panic to catch.
- **Bug C**: intersection (`&`) co-occurring with `\w` and `$` end-anchor
  overflows in `attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2470`).
  Panics in release ONLY when `overflow-checks = true` is set in the
  release profile; without it the add wraps silently and corrupts the DFA.
  Defense: `intersection_with_word_end_alternation` pre-validator plus
  the `overflow-checks = true` + `panic = "unwind"` profile combo that
  promotes the wrap to a catchable panic + the `catch_unwind` net in
  `compile_rule_src` that converts it to a fail-closed `Err(String)`.

Bugs B and C were discovered by `fuzz_extract_gate_soundness` against
0.5.3 and re-verified panicking unchanged in 0.6.0 by a standalone probe
binary built with the same `RUSTFLAGS='-C overflow-checks=on
-C debug-assertions=on'` that cargo-fuzz uses by default.

We do not file these bugs upstream (yet); see "Why we do not file these
upstream" near the end. The `intersection_with_*` pre-validators in
`packages/cli/forbidden-strings/src/rules/engine.rs` are the durable
consumer-side fix.

---

## Bug A: `\b`, `\B`, `^`, `$` inside complement bodies fail with `Algebra(UnsupportedPattern)`

### Symptom

A rule passed to [`resharp`][resharp] 0.5.x through 0.6.x (via the
consumer crate `forbidden-strings` 0.1.0 in this workspace, but the bug
is upstream) fails at compile time when its complement body contains a
word-boundary or text-anchor assertion. The compile-time error surfaces
with one of two variants depending on which rewrite path the offending
atom takes:

```text
forbidden-strings: rule on line N (resharp): Algebra(UnsupportedPattern)
forbidden-strings: rule on line N (resharp): Parse(ParseError { kind: UnsupportedResharpRegex, ... })
```

Resharp renders `Algebra(UnsupportedPattern)` as "unsupported lookaround
pattern" (`resharp-algebra/src/lib.rs:35`); `UnsupportedResharpRegex` is
emitted by the parser when an unrewritable assertion survives the boundary-
rewriting helper. The "Verification" section below lists which surface
patterns hit which variant.

User-facing patterns that trigger the failure:

```text
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

Verified 2026-05-10 against `resharp 0.5.2` (crates.io checksum
`80f2ed5c008a621ce1ab18946bdca99584ed8a6c943f64dd73f7570a23ca1eb8`,
published 2026-05-09) via a synthetic Rust crate calling
`resharp::Regex::new` directly on each pattern, and against `resharp 0.5.1`
via the forbidden-strings 0.1.0 release binary
(`packages/cli/forbidden-strings/target/release/forbidden-strings`).
The `0.5.1`-to-`0.5.2` upstream delta is streaming/seeking, aarch64+wasm
build targets, and a prefix-engine bugfix; none touch the `Kind::Compl`
arm of `reverse`, which lives at `resharp-algebra/src/lib.rs:2234-2235`
in 0.5.2 (previously quoted as `:2233-2239` against an earlier checkout;
slight line drift only).

Re-verified 2026-05-16 against `resharp 0.6.0` (published 2026-05-15)
via the same probe path. The `Kind::Compl` arm of `reverse` and the
parser rewrites at `resharp-parser/src/lib.rs:1305-1346`,
`:1419-1424`, and `:1425-1441` are all unchanged in 0.6.0.

Test harness (binary route):

```bash
cd /tmp
touch probe-input.txt
FS=/var/home/user/Monochromatic/packages/cli/forbidden-strings/target/release/forbidden-strings
echo '<rule>' > probe-rule.txt
$FS --rules probe-rule.txt probe-input.txt
echo "EXIT=$?"   # 0: compile + scan OK; 2: rule error
```

Test harness (synthetic crate, exact error variant):

```toml
# /tmp/resharp052-repro/Cargo.toml
[package]
name = "resharp052_repro"
version = "0.0.0"
edition = "2021"
[dependencies]
resharp = "=0.5.2"
```

```rust
// /tmp/resharp052-repro/src/main.rs
use resharp::Regex;
fn main() {
    for src in [r"em&~(.*\bword\b.*)", r"em&~(.*\B.*)", r"em&~((?=foo).*)"] {
        match Regex::new(src) {
            Ok(_)  => println!("OK    {}", src),
            Err(e) => println!("ERR   {}\t{:?}", src, e),
        }
    }
}
```

### Rules that compile cleanly

- `/em&~(.*foo.*)/` (simple literal in complement body)
- `/em&~((?i)foo)/`, `/em&~([a-z]+)/`, `/em&~(.*[^a-z].*)/` (other features in complement body)
- `/em&~(\Afoo\z)/` (`\A`/`\z` text anchors inside complement; no lookaround rewrite)
- `/em\b/`, `/\bem\b&_*/`, `/\bem\b&_*&~(.*foo.*)/` (`\b` outside complement body)
- `/(?=\bem\b).*/` (`\b` inside a lookaround body, not inside a complement)
- 500 alternatives in a single `~(.*(w0|w1|...|w499).*)` with simple bodies
- 500 chained `&~(.*w0.*)&~(.*w1.*)&...&~(.*w499.*)`

### Rules that fail with `Algebra(UnsupportedPattern)` (algebra-layer reject)

Patterns whose offending atom is rewritten to a lookaround by the parser
but then refused by `reverse` at the `Kind::Compl` arm:

- `/em&~(.*\bnpm\b.*)/`, `/em&~(.*\bnpm.*)/`, `/em&~(.*npm\b.*)/`
  (`\b` in complement body, with a known word-class neighbour so the
  boundary rewrite succeeds and produces a lookaround pair)
- `/em&~(^foo$)/`, `/em&~(\Afoo$)/`, `/em&~(^foo\z)/`
  (default-multiline `^`/`$` rewritten to `Lookbehind`/`Lookahead`)
- `/em&~((?=foo).*)/`
  (user-explicit lookahead inside complement, no `\b`/`^`/`$` involved;
  proves the restriction is "lookaround in complement" generally, not
  word-boundary syntax specifically)

### Rules that fail with `Parse(UnsupportedResharpRegex)` (parser-layer reject)

Patterns where the parser's boundary-rewriter helper cannot classify the
atom's neighbours or the assertion sits in a lookaround body where the
rewrite chain is wired against the surrounding flag state:

- `/em&~(.*\B.*)/`
  (`\B` between two `.*` atoms; both neighbours classify as Unknown so
  the helper at `resharp-parser/src/lib.rs:1305-1346` falls through to
  the generic assertion handler at `:1419-1424`, which rejects bare
  `\B` outright)
- `/(?=^foo)bar/`
  (`^` at start of a lookahead body; the multiline `^`-to-lookbehind
  rewrite at `:1425-1441` does not compose with the enclosing
  lookahead)
- `/(?<=\b)foo/`
  (`\b` in a lookbehind body with no neighbouring word-class atom)

The earlier "alternation count" / "seven chained complements" framing was a misdiagnosis:
every observed failing case contained a lookaround-introducing assertion in a complement or lookaround body,
and the count axis had no measured ceiling within practical bounds.

## Verified workarounds

### Replace `\b` with literal whitespace inside complement bodies

```text
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

```text
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

```text
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

```text
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

## Draft upstream issue (DO NOT FILE without an architectural prototype)

### Why we do not file this upstream

This repo's policy is to report an issue upstream only when ALL of the
following hold: we are absolutely sure it is the upstream's fault, they
can fix it, they are supporting the use case, they are likely to fix it,
and we have already prototyped a minimal fix compatible with their
architecture. Every reported issue that does not satisfy all five is
treated as a publicity incident.

Walking the five constraints against the resharp complement-of-lookaround
restriction:

1. **Is it really upstream's fault?** Mostly no. The restriction is
   architectural. Brzozowski-style symbolic derivatives do not compose
   naturally with position-sensitive constraints under reversal; this
   doc's "Why this restriction exists" section spells out the algebraic
   reason. The default-multiline `^`/`$` rewrite and the `\b` to
   lookaround rewrite are defensible parser choices that interact badly
   with the architectural restriction; the badness lives in the
   interaction, not in any single decision. The only narrow surface-
   quality grievance is the generic "unsupported lookaround pattern"
   string not naming the trigger, but that is wording, not behaviour.

2. **Can upstream fix it?** Partially. Positive-lookaround reverse cases
   are tractable via De Morgan body inversion; negative-lookaround
   reverse cases require preserving position-sensitive match-set
   semantics through the complement structure, which is non-trivial work
   touching the algebraic core. Not a 1-line change.

3. **Are they supporting this use case?** No documented signal. The
   crate's stated value proposition is "high-performance regex engine
   with intersection and complement operations." Lookarounds-in-
   complement sits at the intersection of two features that compose
   poorly; no upstream doc, example, or test shows the combination as
   expected to work.

4. **Will they likely fix it?** Upstream signal points the other way.
   Commit `e9676b4 2026-04-19 rejecting unsupported patterns, more
   tests` shows the project scoping DOWN what is supported; commit
   `b256ea8 2026-04-24 rewrite negative lookaheads on construction`
   moved lookaround handling in a different direction (construction-
   time rewrites). The 0.5.1 to 0.5.2 delta was orthogonal (streaming/
   seeking, platform builds, prefix-engine bugfix). No movement on
   complement-of-lookaround in the visible history.

5. **Have we prototyped a minimal fix?** No. The "Suggested fix"
   section below is speculative design with no code, no correctness
   argument, no test against any nontrivial rule set.

We fail constraints 1, 4, and 5 clearly; 2 and 3 are equivocal at best.
The decision is to NOT file upstream.

The consumer-side workaround is implemented in `forbidden-strings` as a
parse-time guard (`engine::lookaround_in_complement`) that rejects every
failing shape with a named-trigger error pointing to this doc. That
solves the user-facing problem at our boundary, where it actually
matters for us. The draft below is kept as a reference in case the
underlying situation changes (e.g., upstream announces complement-of-
lookaround as supported, or someone in the project lands a prototype
fix and asks for community testing). Re-evaluating the five constraints
must precede any filing.

### Draft (do not file as-is)

Title: `Algebra(UnsupportedPattern)` for `\b`, `\B`, `^`, `$` inside
complement bodies; error string ("unsupported lookaround pattern") does
not mention the surface trigger

Labels: `bug`, `parser`, `documentation`

````md
## Description

Patterns of the form `A&~(B)` where `B` contains `\b`, `^`, `$`, or any
user-written lookaround fail at compile time with
`ResharpError::UnsupportedPattern`, rendered as "unsupported lookaround
pattern". Patterns where `B` contains `\B` (or where `\b`/`^` sit inside
a lookaround body that the parser cannot rewrite) instead fail with a
parse-layer `UnsupportedResharpRegex`. Neither error message names the
surface trigger.

The root cause chain:

1. The parser rewrites `^`/`$` to lookbehind/lookahead in default
   multiline mode (`resharp-parser/src/lib.rs:1425-1441`).
2. The parser rewrites `\b` to negative-lookahead / negative-lookbehind
   based on adjacent-atom classification
   (`resharp-parser/src/lib.rs:1305-1346`). When the helper cannot
   classify a `\b` or `\B` neighbour, the assertion falls through to
   the generic handler at `:1419-1424`, which rejects it with
   `UnsupportedResharpRegex`.
3. The reverse pass refuses to reverse a complement whose body contains
   any lookaround (`resharp-algebra/src/lib.rs:2234-2235`).

Legibility issue: a user writing `em&~(.*\bnpm\b.*)` has not written a
lookaround anywhere in the surface syntax, so the error "unsupported
lookaround pattern" is not actionable. A user writing
`em&~(.*\B.*)` gets a different error variant for the same conceptual
problem, fragmenting the symptom across two log surfaces.

## Reproduction

Against `resharp 0.5.2`:

```rust
use resharp::Regex;

// These four fail with Err(Algebra(UnsupportedPattern))
let _ = Regex::new(r"em&~(.*\bword\b.*)");
let _ = Regex::new(r"em&~(^foo$)");
let _ = Regex::new(r"em&~(\Afoo$)");
let _ = Regex::new(r"em&~((?=foo).*)");  // user-explicit lookaround in complement

// These three fail with Err(Parse(UnsupportedResharpRegex))
let _ = Regex::new(r"em&~(.*\B.*)");
let _ = Regex::new(r"(?=^foo)bar");
let _ = Regex::new(r"(?<=\b)foo");
```
````

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

---

## Bug B: intersection with lookbehind triggers `debug_assert!` in `scan_fwd_all` (silent corruption in release)

### Symptom

A rule whose source contains both intersection (`&`) and a lookbehind
assertion (`(?<=...)` or `(?<!...)`) at the same scope (i.e. both outside
character classes, in the same compiled regex) and which is then matched
against an input of about 64 bytes or longer causes one of two
divergent outcomes depending on the build profile:

```text
# Test profile (debug-assertions ON):
thread 'main' panicked at resharp/src/engine.rs:1020:
unexpected end 0 > 1

# Release profile (debug-assertions OFF, our forbidden-strings default):
# (no panic; silently returns wrong/spurious matches)
```

The minimum reproducer captured by the `fuzz_extract_gate_soundness`
fuzz target is the pattern `(?:(?=a)&(?<=_))` driven by a 64-byte input
ending in `_`; the standalone probe at `/tmp/probe-resharp-06`
reproduces this against resharp 0.5.3 and 0.6.0 with exactly the same
behaviour (the only difference is the rendered `N` value in the
`unexpected end 0 > N` panic message: 56 in 0.5.3, 1 in 0.6.0).

### Root cause

`resharp/src/engine.rs:1020` (line stable from 0.5.3 through 0.6.0):

```rust
debug_assert!(
    l_max_end >= nulls[i],
    "unexpected end {} > {}",
    l_max_end,
    nulls[i]
);
matches.push(Match {
    start: nulls[i],
    end: l_max_end,
});
```

The DFA's intersection-of-(lookahead, lookbehind) construction produces
a `nulls[i]` value that exceeds `l_max_end` on certain input shapes.
The `debug_assert!` catches this in test/fuzz builds but is compiled
out of release; the path falls through and the `matches.push` records
a `Match { start: nulls[i], end: l_max_end }` with `start > end`.
Downstream consumers (including our `scan.rs`) then see absurd ranges
or stack of spurious matches; in our probe a 64-byte input produced
62 garbage matches.

The intersection-of-(lookahead, lookbehind) and intersection-of-
(lookbehind, lookahead) shapes are algebraically symmetric to resharp
but the bug only fires when a lookbehind is one of the intersection
operands; pure lookahead intersections do not trigger.

### Defense

The pre-validator `intersection_with_lookbehind` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
byte-by-byte tracking character-class membership and rejects any rule
where `&` and `(?<=` (or `(?<!`) co-occur outside any `[...]`. The
rejection produces an actionable error pointing here.

The `catch_unwind` net in `CompiledRegex::find_all` exists primarily
for test/CI runs (debug-assertions on) and as a future-regression hedge;
it does not help in release because `debug_assert!` is compiled out and
no panic fires for the corruption path to catch.

Enabling `debug-assertions = true` in `[profile.release]` is deliberately
NOT done: `regex`, `ignore`, and `rayon` have hot-path debug_asserts and
the perf cost was not measured. The pre-validator covers known shapes;
the fuzz target covers unknown variants. New variants would be caught
by fuzzing (which runs with debug-assertions on by default) before they
reach a release run.

### Verification

```bash
# Run inside the probe project at /tmp/probe-resharp-06/:
RUSTFLAGS='-C overflow-checks=on -C debug-assertions=on' \
  cargo run --release
```

The probe constructs `resharp::Regex::new("(?:(?=a)&(?<=_))")` directly
(bypassing `compile_rule_src` and the pre-validator) then calls
`find_all` on a 64-byte buffer ending in `_`. Output line for shape 2
reads `[shape2-findall ...] PANIC (resharp 0.6 still crashes)` when
debug-assertions are on; reads `[shape2-findall ...] OK (find_all
Ok(62 matches))` when debug-assertions are off.

The in-tree regression test
`find_all_catches_runtime_panic_via_catch_unwind` in
`packages/cli/forbidden-strings/src/rules/engine_tests.rs` exercises
the same shape through `CompiledRegex::find_all` and asserts no panic
escapes; it runs under `cargo test`'s default (debug-assertions on)
so it does catch the panic that release would silently corrupt.

---

## Bug C: intersection with `\w` and `$` end-anchor overflows in `attempt_rw_concat_2`

### Symptom

A rule whose source contains intersection (`&`), `\w` shorthand, and
the `$` end-anchor at the same scope panics at compile time during
`Regex::new` when the release profile has `overflow-checks = true`:

```text
thread 'main' panicked at resharp-algebra/src/lib.rs:2470:
attempt to add with overflow
```

When the release profile has `overflow-checks = false` (cargo's
default), the add silently wraps and the constructed regex
silently misbehaves at match time. Either outcome is a soundness
problem for a CI gate. The minimum reproducer is the pattern
`(?:\w|$)(?:(?![1g]\_X)& a)`; the standalone probe at
`/tmp/probe-resharp-06` reproduces this against resharp 0.5.3 and
0.6.0 with identical panic message and source line.

### Root cause

`resharp-algebra/src/lib.rs:2470` (line stable from 0.5.3 through
0.6.0) inside `attempt_rw_concat_2` does a `+` on `usize` values
derived from a node-tree traversal where one operand can be near
`usize::MAX` for the algebra rewrites triggered by intersection-of-
(word-shorthand-alternation, end-anchor-bearing-expression). The
overflow is a true bug, not a sentinel; the wrap produces a DFA that
fails to match content that should match (fail-open).

### Defense

The pre-validator `intersection_with_word_end_alternation` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
byte-by-byte tracking character-class membership and rejects any rule
where `&`, `\w`, and `$` co-occur outside any `[...]`. The rejection
produces an actionable error pointing here.

The `catch_unwind` net in `compile_rule_src` exists as belt-and-
suspenders: if a new shape evades the pre-validator and `overflow-
checks = true` is set (it is, in our `Cargo.toml`), the resulting
panic gets converted to a fail-closed `Err(String)` instead of
aborting the scanner process or returning wrong results.

The release profile's `panic = "unwind"` and `overflow-checks = true`
settings are both load-bearing: `panic = "abort"` would skip the
unwind barrier and abort the process before `catch_unwind` runs;
`overflow-checks = false` (cargo's default) would let the add wrap
silently, producing the fail-open behaviour with no panic to catch.

### Verification

The probe binary at `/tmp/probe-resharp-06` calls
`resharp::Regex::new("(?:\\w|$)(?:(?![1g]\\_X)& a)")` directly. With
`overflow-checks = true` in the project's release profile (or via
`RUSTFLAGS='-C overflow-checks=on'`), the call panics with the message
above. With `overflow-checks = false` the call returns Ok but the
constructed regex misbehaves.

The in-tree regression test `compile_rule_src_does_not_panic_on_known_
bad_shapes` exercises the same shape through `compile_rule_src` and
asserts the pre-validator catches it before resharp sees it.

---

## Bug D: alternation containing a lookaround + sibling lookaround triggers `debug_assert!` in `scan_fwd_all`

### Symptom

A rule whose source has an alternation containing a lookaround AND
another lookaround somewhere else in the source compiles cleanly via
`Regex::new`, but `find_all` panics during the forward DFA pass:

```text
thread 'main' panicked at resharp-0.6.0/src/engine.rs:1020:17:
unexpected end 0 > N
```

The minimum reproducer bisected from the fuzzer's
`crash-8cba104f0805ccb567513aff895398a4f652200c` artifact is:

```
(a|(?![_]))(?!a)
```

Confirmed-equivalent shapes:

- `(a|(?![X]))(?!Y)` for X in `_`, `0`, `.`, `-`, `|`, `^a`
- `(?:a|(?![_]))(?!a)` (non-capturing first group)
- `((?![_])|a)(?!a)` (lookaround as first alt branch)
- `(a|(?<!_))(?<!a)` (lookbehind direction; same root cause)

Shapes that do NOT trigger:

- `(a|(?!a))(?!a)` -- first lookaround has a bare atom, not a class
- `(a|(?![ab]))(?!a)` -- class has two chars
- `(?!a)(a|(?!a))` -- lookaround BEFORE alternation, not after
- `(?!a)b(?!c)` -- atom between two lookaheads, no alternation

### Root cause

The same line as Bug B (`engine.rs:1020`'s `debug_assert!(...)`) fires
for a different shape: the algebra simplification leaves a node whose
forward DFA construction reaches an "unexpected end" state when one
operand of an alternation is a lookaround whose body is a single-char
class. The `debug_assert!` shape means release builds silently return
wrong matches; under libFuzzer-sys's panic hook (which calls `abort()`
before `catch_unwind`'s unwind barrier intercepts), the fuzz target
aborts on every iteration that hits this shape.

### Defense

The pre-validator `lookaround_in_alternation_with_sibling` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks per-paren
depth `(has_alt, has_la)` flags, tracks total lookaround count, and
fires at end-of-walk when any closed group had alt+la AND total
lookarounds >= 2. The deferred check handles both "sibling appears
before the alt+la group" and "sibling appears after" cases.

The detector is direction-agnostic (covers both lookahead and
lookbehind) and conservative (a few shapes that compile OK at scan
time also fire). The trade-off is intentional: false positives here
cost a skipped iteration; missed positives cost a fuzz-target abort.

### Verification

The probe binary at `/tmp/probe-slow-unit/src/bin/bisect2.rs` and
`bisect3.rs` reproduces the panic across all confirmed-triggering
shapes with `RUSTFLAGS="-C debug-assertions=on"`. The in-tree tests
`lookaround_in_alternation_with_sibling_fires` and
`compile_rule_src_rejects_alt_lookaround_sibling_shape` in
`packages/cli/forbidden-strings/src/rules/engine_tests.rs` exercise
the pre-validator and the end-to-end compile rejection path.

---

## Bug E: complement + intersection + quantified group hangs `prefix::calc_prefix_sets_inner`

### Symptom

A rule whose source contains a complement (`~(...)`), intersection
(`&`), AND a quantified group (`(...)*`/`(...)+`/`(...)?`/`(...){N}`)
hangs during `Regex::new`; the compile call does not return within
libFuzzer's per-input timeout (10s in our fuzz run). The minimum
reproducer bisected from
`timeout-00179d433e26fbcc3bedf2b7b38b6ce1ff9e6438` is:

```
abc~(\w)&(?:aaa)*
```

The hang scales with the surrounding shape: a 1-char prefix and a
1-char-body quantified group compile in milliseconds; 3+ char prefix
with 3+ char quantified group never terminate within minutes. Wrapping
the entire source in a single non-capturing group (`(?:...)`) avoids
the hang -- the wrapping changes how the simplified AST enters the
prefix-selection phase.

### Root cause

Traced via `gdb -p $HUNG_PID -ex 'thread apply all bt'` plus reading
the cloned resharp source. The hot loop is at
`resharp-engine/src/prefix.rs:27` in `calc_prefix_sets_inner`:

```rust
let mut redundant = BTreeSet::new();
redundant.insert(NodeId::BOT);
redundant.insert(start);

loop {
    if !result.is_empty() && redundant.contains(&node) {
        break;
    }
    // ... compute derivative, set node = target ...
}
```

The `redundant` set is initialized with `BOT` and the original `start`
node, then never updated inside the loop. The loop assigns `node =
target` each iteration, but new targets are not added to `redundant`.
For the trigger shape, the derivative chain produces a sequence of
unique single-target nodes that never visits `BOT` or `start`, so the
loop never terminates.

Stack trace at hang point (3s after compile start):

```
#0 resharp_algebra::RegexBuilder::collect_der_targets
#1 resharp_algebra::RegexBuilder::collect_der_targets   (recursion through TRegex ITE)
#2 resharp_algebra::RegexBuilder::collect_der_targets
#3 resharp::prefix::calc_prefix_sets_inner
#4 resharp::prefix::select_prefix
#5 resharp::Regex::from_node_inner
#6 resharp::Regex::with_options
#7 resharp::Regex::new
```

### Defense

`catch_unwind` does not protect against non-termination, and resharp
does not expose a compile timeout we could wrap from outside. The
pre-validator `complement_intersection_quantified_group` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
looking for the three co-occurring features and rejects the rule
before `Regex::new` is called.

The detector is conservative: shapes like `~(\w)&(?:a)*` (no literal
prefix) compile in milliseconds but the detector still flags them.
The trade-off is safe because the production rule corpus contains
zero rules combining `&` and `~(` (the only `&` in the example
betterleaks config is escaped HTML `&amp;` or inside character
classes), so the false-positive risk is theoretical only.

### Suggested upstream fix

The initial proposal was a single line:

```rust
node = target;
redundant.insert(node);   // ADD THIS LINE
```

Prototyped against a fresh clone at
`https://github.com/ieviev/resharp.git` HEAD
`6f445d71b194161adc0efe968d723312b6856a26` (2026-05-15, declared
version 0.6.0 in `Cargo.toml`). The single-line variant DOES make
`abc~(\w)&(?:aaa)*` compile in milliseconds, but it regresses
9 of the 46 active cases in `resharp-engine/tests/prefix.toml`:

```text
unsat/prefix_rev:               expected="",          got="o"
alt-neg-la/prefix_rev:          expected="N;F;D",     got="N"
prefix_twain/prefix_rev:        expected="n;i;a;w;T", got="n"
prefix_la1/prefix_rev:          expected="b;a",       got="b"
prefix_huck/prefix_rev:         expected="k;c;u;H",   got="k"
prefix_hello/prefix_rev:        expected="o;l;l;e;h", got="o"
prefix_lookahead/prefix_rev:    expected="a;a;a",     got="a"
prefix_bounded_repeat/prefix_rev: expected="c;b;b",   got="c"
prefix_dotdot_g/prefix_rev:     expected="g;.;.",     got="g"
```

Root of the regression: pre-patch, `redundant` is a "boundary" set
seeded with `BOT` and `start`; the outer check at line 28
(`!result.is_empty() && redundant.contains(&node)`) fires only when
the derivative chain wraps back to one of those boundary nodes and
KEEPS the accumulated result. Inserting every visited node into the
same set makes that check fire on the iteration after the very first
push, so multi-character anchored prefixes are truncated to their
first character. The proposed single-line patch conflates two
different exit semantics (boundary-wrap-keeps-result vs.
fresh-node-revisit-implies-cycle).

The minimal compatible fix keeps the two semantics separate by
tracking fresh visits in a second set and clearing the result on a
fresh-node revisit, while leaving the original boundary-wrap path
untouched:

```diff
--- a/resharp-engine/src/prefix.rs
+++ b/resharp-engine/src/prefix.rs
@@ -23,12 +23,18 @@ pub(crate) fn calc_prefix_sets_inner(
     let mut redundant = BTreeSet::new();
     redundant.insert(NodeId::BOT);
     redundant.insert(start);
+    let mut visited: BTreeSet<NodeId> = BTreeSet::new();

     loop {
         if !result.is_empty() && redundant.contains(&node) {
             break;
         }

+        if !result.is_empty() && !visited.insert(node) {
+            result.clear();
+            break;
+        }
+
         if b.any_nonbegin_nullable(node) {
             break;
         }
```

`visited.insert(node)` is gated on `!result.is_empty()` so the very
first iteration (where `node == start`) never enters `visited`; this
preserves the wrap-to-start semantics (still caught by the existing
`redundant.contains(&node)` check, which keeps `result`). Any later
re-visit of a node already seen in the same `calc_prefix_sets_inner`
call clears `result` and breaks, mirroring the pre-existing
"self-loop" handling at `target == node`.

Applied against the same upstream HEAD, the additive variant:

- compiles `abc~(\w)&(?:aaa)*` in milliseconds and the resulting
  regex returns `false` from `is_match` on every probe input in
  `{"", "abc", "aaa", "abcaaa", "aaaaaa", "abc!", "abcaaab"}`,
  consistent with the empty language `abc~(\w) & (?:aaa)*`
  represents;
- passes all 46 active prefix.toml cases (audited via a
  catch_unwind-per-case harness, output:
  `prefix audit: 46 active cases all OK (no failures, no hangs)`);
- passes `cargo test --workspace --no-fail-fast` clean:
  228 passed; 0 failed; 19 ignored across all crates
  (`resharp-engine` per-binary totals: 1 + 2 + 1 + 95 + 0 + 72 + 3
  - 1 + 36 + 1 + 5 + 11; `resharp-algebra`, `resharp-parser`,
    `resharp-ffi`: empty/empty/empty).

### Verification

The probe binary at `/tmp/probe-slow-unit/src/bin/bisect5.rs` and
`bisect6.rs` reproduces the hang via a separate thread with a
configurable timeout. The probe at `bisect5.rs` confirms many
variations of the trigger shape; `hangtrace.rs` plus the instrumented
resharp under `/tmp/resharp-src-instrumented/` were used to locate
the exact loop. The in-tree tests
`complement_intersection_quantified_group_fires` and the end-to-end
pipeline verify the pre-validator skips the trigger.

---

## Why we do not file Bugs B-D upstream (yet)

Same five-constraint policy applies (see Bug A's "Why we do not file
this upstream" subsection). For Bug B (debug_assert with release
silent-corruption), Bug C (algebra arithmetic overflow), and Bug D
(alt+lookaround+sibling, same engine.rs:1020 line as Bug B but a
different trigger shape), the constraints land:

1. **Upstream's fault?** Yes for all three. A `debug_assert!` whose
   absence produces silently corrupted output is a defect; an algebra
   add that overflows for a parser-reachable input shape is a defect;
   alt+lookaround+sibling reaching the same defective assertion is a
   defect.
2. **Can upstream fix?** Yes. Bug B and D are one-line bound checks
   that need to fire in release (replace `debug_assert!` with
   `assert!`, or fix the underlying invariant so the assertion never
   trips). Bug C is locating which add overflows in
   `attempt_rw_concat_2` and either widening the type or adding a
   checked-add path.
3. **Supporting this use case?** Mixed. Intersection (`&`) and
   complement (`~`) are headline features of resharp; combining them
   with lookarounds is the natural way to write the "match A but not
   when X" exclusion pattern. No documented restriction.
4. **Likely to fix?** Unknown. The 0.6.0 release did not touch any
   of these lines (verified by diffing the relevant source paths).
5. **Have we prototyped a minimal fix?** No. We have minimum
   reproducers and source-line citations but no candidate patch.

We fail constraint 5 clearly. We defer filing until a minimal-patch
prototype exists. Until then the pre-validators and profile settings
are the durable consumer-side fix.

Bug E (the `calc_prefix_sets_inner` non-termination) is the exception:
we have a minimal-patch prototype that satisfies constraint 5.
Prototyped against `https://github.com/ieviev/resharp.git` HEAD
`6f445d71b194161adc0efe968d723312b6856a26` (declared version 0.6.0
in `Cargo.toml`, 2026-05-15) in a fresh `mktemp -d` clone. The
initially-proposed single-line patch regressed 9 of 46 active cases
in `resharp-engine/tests/prefix.toml`; the verified prototype is a
two-hunk additive variant (`visited` set plus fresh-revisit clear)
that passes `cargo test --workspace --no-fail-fast` with 228 passed,
0 failed, 19 ignored. See Bug E's "Suggested upstream fix" subsection
above for the diff, the audit method, and the language-emptiness
check on the Bug E trigger pattern. Draft upstream issue body is
below.

Re-evaluation of constraints 2 and 4 in light of the obstacle:

- **Constraint 2 (can upstream fix?)** Downgrades from "single
  line" to "two hunks adding four lines (one new `BTreeSet` plus
  one bounded check); additive only, no behaviour change in any
  existing exit path." Still small and contained to one function.
- **Constraint 4 (will they likely fix?)** Unchanged at "plausible."
  The fix sits inside a function the project already maintains
  (the `redundant` set is the prior author's own cycle-detection
  scaffolding), and the patch reuses the same vocabulary. No
  algebraic-core changes.

### Draft upstream issue body for Bug E (ready to file)

````md
**Title:** non-termination in `prefix::calc_prefix_sets_inner` for `~(...)&(...)*` patterns

**Labels:** `bug`, `engine`

## Description

`resharp::Regex::new` does not return for patterns combining a literal
prefix, a complement (`~(...)`), an intersection (`&`), and a
quantified group (`(...)*`, `(...)+`, `(...){N}`, etc.). The hot loop
is at `resharp-engine/src/prefix.rs:27` inside
`calc_prefix_sets_inner`:

```rust
let mut redundant = BTreeSet::new();
redundant.insert(NodeId::BOT);
redundant.insert(start);

loop {
    if !result.is_empty() && redundant.contains(&node) {
        break;
    }
    // ... computes der, picks a single target ...
    node = target;
}
```

`redundant` is seeded with `BOT` and `start` and never updated. For
the trigger shape, the derivative chain produces a sequence of unique
fresh nodes that never wraps back to a seeded boundary node, never
becomes nullable, never self-loops, and never narrows to multiple
targets. The loop therefore runs without termination.

Minimum reproducer (bisected from a libFuzzer timeout artefact):

```rust
use resharp::Regex;
let _ = Regex::new(r"abc~(\w)&(?:aaa)*");  // never returns
```

Easiest way to reproduce as a regression test (worker thread with a
hard timeout, since `Regex::new` does not return on the trigger
pattern and no compile timeout is exposed):

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[test]
fn bug_e_trigger_compiles_within_timeout() {
    const TRIGGER: &str = r"abc~(\w)&(?:aaa)*";
    let (tx, rx) = mpsc::channel();
    thread::Builder::new()
        .name("bug_e_compile".into())
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let _ = resharp::Regex::new(TRIGGER);
            let _ = tx.send(());
        })
        .unwrap();
    assert!(
        rx.recv_timeout(Duration::from_secs(10)).is_ok(),
        "Regex::new({TRIGGER:?}) hung",
    );
}
```

On unmodified `main` the test fails the 10 s timeout; on the
proposed patch it returns in milliseconds. A companion test that
calls `is_match` against `{"", "abc", "aaa", "abcaaa", "aaaaaa",
"abc!", "abcaaab"}` returns `false` for every input, consistent with
the empty language `abc~(\w) & (?:aaa)*` represents.

Stack trace at the hang point (captured 3 s into compile):

```
#0 resharp_algebra::RegexBuilder::collect_der_targets
#1 resharp_algebra::RegexBuilder::collect_der_targets
#2 resharp_algebra::RegexBuilder::collect_der_targets
#3 resharp::prefix::calc_prefix_sets_inner
#4 resharp::prefix::select_prefix
#5 resharp::Regex::from_node_inner
#6 resharp::Regex::with_options
#7 resharp::Regex::new
```

## Suggested fix

The intent of the existing outer check is to detect "the chain wrapped
back to a boundary node," which keeps the accumulated `result`. A
separate "fresh revisit" check is needed to detect "the chain entered
a cycle through previously visited non-boundary nodes," which should
clear `result` (matching the existing `target == node` self-loop
clearing semantics). Keeping these two semantics separate is what
makes the patch additive and non-regressive:

```diff
--- a/resharp-engine/src/prefix.rs
+++ b/resharp-engine/src/prefix.rs
@@ -23,12 +23,18 @@ pub(crate) fn calc_prefix_sets_inner(
     let mut redundant = BTreeSet::new();
     redundant.insert(NodeId::BOT);
     redundant.insert(start);
+    let mut visited: BTreeSet<NodeId> = BTreeSet::new();

     loop {
         if !result.is_empty() && redundant.contains(&node) {
             break;
         }

+        if !result.is_empty() && !visited.insert(node) {
+            result.clear();
+            break;
+        }
+
         if b.any_nonbegin_nullable(node) {
             break;
         }
```

A simpler one-line variant (inserting every `target` into the
existing `redundant` set after `node = target`) was prototyped first
and rejected: it conflates the boundary-wrap and fresh-revisit
semantics, breaks 9 of 46 active cases in
`resharp-engine/tests/prefix.toml` (all anchored multi-character
`prefix_rev` cases collapse to their first character, e.g.
`prefix_twain` `"n;i;a;w;T"` -> `"n"`, and `unsat` flips from `""` to
`"o"`).

## Verification

Tested against `main` at
`6f445d71b194161adc0efe968d723312b6856a26`.

```text
cargo test --workspace --no-fail-fast
# 228 passed; 0 failed; 19 ignored
```

Prototype clone, reproducer, and audit harness are available on
request.
````

[resharp]: https://github.com/ieviev/resharp
