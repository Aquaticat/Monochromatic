# Resharp: upstream bugs and forbidden-strings workarounds

This document tracks the upstream resharp bugs that `forbidden-strings`
defends against, the consumer-side guards that block each, and the
verification path for each finding.

Five bugs are tracked (A through E). All were re-verified on 2026-05-23
against published resharp 0.6.3 and against git HEAD `e0b8aba`
(`https://github.com/ieviev/resharp`, 2 commits past the 0.6.3 release
commit `0b7732c`), using standalone probe crates built in debug
(debug-assertions and overflow-checks both on, matching cargo-fuzz
defaults) and in release (both off). Status as of that re-verification:

- **Bug A** (`\b`/`\B`/`^`/`$` or any lookaround inside a `~(...)` complement
  body fails to compile): unchanged from 0.6.0 through 0.6.3/HEAD.
  Defense: `lookaround_in_complement`. Not fileable (no prototyped fix).
- **Bug B** (intersection `&` with a lookbehind): still reproduces, but the
  defect now surfaces earlier in the pipeline. The panic moved from the
  matching engine (`resharp/src/engine.rs:1020` in 0.6.0) to a
  `debug_assert!` in the new `strip_lb` lookbehind-stripping rewrite
  (`resharp-algebra/src/lib.rs:2007` at HEAD, `:2006` in 0.6.3). In release
  the assertion is compiled out and `find_all` silently returns corrupted
  matches. Defense: `intersection_with_lookbehind`. Not fileable (no
  prototyped fix).
- **Bug C** (intersection `&` with `\w` and `$` end-anchor): still overflows
  in `attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2479` at HEAD,
  `:2478` in 0.6.3; was `:2470` in 0.6.0). Release wraps silently without
  `overflow-checks = true`. Defense: `intersection_with_word_end_alternation`
  plus the `overflow-checks = true` + `panic = "unwind"` profile combo and
  the `catch_unwind` net in `compile_rule_src`. Not fileable (no prototyped
  fix).
- **Bug D** (alternation containing a lookaround plus a sibling lookaround):
  the documented symptom no longer reproduces in 0.6.3/HEAD. `find_all`
  returns clean results in both debug and release; the shape no longer
  reaches the `unexpected end` `debug_assert!`. Do not file (fixed
  upstream). Defense `lookaround_in_alternation_with_sibling` is now
  belt-and-suspenders rather than a live guard.
- **Bug E** (complement `~` + intersection `&` + quantified group): still
  hangs `Regex::new` in `prefix::calc_prefix_sets_inner`. The two-hunk
  prototype patch in this doc was re-validated against HEAD `e0b8aba`: the
  literal diff applies cleanly, the trigger then compiles in milliseconds,
  and the workspace test suite is 231 passed / 0 failed / 19 ignored both
  with and without the patch (purely additive). Ready to file.

Filing summary for the planned upstream issues: file Bug E (constraint 5
met, prototype re-validated against current HEAD). Do not file Bug D (the
symptom is fixed in 0.6.x; filing it reports an already-resolved defect,
which the five-constraint policy treats as a publicity incident). Bugs A,
B, and C stay deferred under that policy because no prototyped fix exists;
the one constraint-light exception is Bug A's error-message-wording
sub-issue (suggested fix 2 in its draft), which can be filed on its own.

Bugs B through E were originally surfaced by `fuzz_extract_gate_soundness`
and companion fuzz and bisect probes. The `intersection_with_*` and other
pre-validators in `packages/cli/forbidden-strings/src/rules/engine.rs` are
the durable consumer-side fix and stay in place regardless of upstream
status; over-rejection is fail-closed-safe.

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

Re-verified 2026-05-23 against published `resharp 0.6.3` and against git
HEAD `e0b8aba`. The complement-of-lookaround reject still fires for every
complement-body shape below; the behaviour is unchanged, only the source
lines drifted. At HEAD the reverse-pass `Kind::Compl` arm that returns
`UnsupportedPattern` is at `resharp-algebra/src/lib.rs:2242-2243`
(was `:2234-2235` in 0.6.0), `contains_look` is at `:979`, and the
`UnsupportedPattern` variant and its render are at `:25` and `:35`. The
parser rewrites drifted substantially: the boundary rewrite is around
`resharp-parser/src/lib.rs:1456-1491`, the generic word-boundary reject
at `:1562-1569`, and the multiline `^`/`$` rewrite at `:1577-1586`
(the `913c9fe accept more patterns`, `d1d560e javascript word boundary`,
and `ec54529 auto-rewrite more unsupported patterns` commits added new
`WordBoundary*` assertion kinds at `:1595-1610`).

Two patterns the earlier write-up listed wrongly were corrected during
this pass after testing them against both 0.6.0 and 0.6.3 (identical in
both, so neither is a 0.6.x change):

- `/(?=^foo)bar/` compiles cleanly (it was listed under parser-layer
  rejects). The `^` inside a lookahead body does not break compilation.
- `/em.*\bword\b/` does NOT compile; it fails with
  `Algebra(UnsupportedPattern)` because the `\b` rewrite produces a
  negative lookbehind / lookahead that the reverse pass then refuses.
  The "move the boundary outside the complement" workaround below is
  therefore not reliable and is annotated accordingly.

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
  the boundary-rewrite helper around `resharp-parser/src/lib.rs:1456-1491`
  falls through to the generic assertion handler at `:1562-1569`, which
  rejects bare `\B` outright)
- `/(?<=\b)foo/`
  (`\b` in a lookbehind body with no neighbouring word-class atom)

`/(?=^foo)bar/` was previously listed here but compiles cleanly in 0.6.0,
0.6.3, and HEAD; it is not a parser-layer reject. See the correction note
in the Verification section above.

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

### Move the boundary check outside the complement (does not reliably work)

Lifting `\bword\b` out of `~(...)` into the main concatenation was once
recorded as a workaround, but it does not compile:

```text
# fails: Algebra(UnsupportedPattern)
/em&~(.*\bword\b.*)/

# also fails: Algebra(UnsupportedPattern) (verified in 0.6.0, 0.6.3, HEAD)
/em.*\bword\b/
```

A `\b` adjacent to a word-class atom still rewrites to a negative
lookbehind / lookahead, and `em.*` ahead of it forces the reverse pass
over a lookaround-bearing subtree, which hits the same
`UnsupportedPattern` reject. Prefer the literal-whitespace or `\W`
substitutions inside the complement body (above), which keep the rewrite
out of a reverse-over-lookaround position.

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
The decision is to not file the behavioural fix upstream.

One part is separable: suggested fix 2 below (improve the error message
to name the surface trigger) is a wording change, not an algebra change,
so the "no prototyped fix" constraint does not really bind it. If any of
these issues is to be filed, that error-message sub-issue is the only
A/B/C item the policy does not block; it can be filed on its own without
the architectural prototype the behavioural fix would need.

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

// These two fail with Err(Parse(UnsupportedResharpRegex))
let _ = Regex::new(r"em&~(.*\B.*)");
let _ = Regex::new(r"(?<=\b)foo");
// NOTE: (?=^foo)bar compiles cleanly in 0.6.0/0.6.3/HEAD; do not include
// it as a failing case (the earlier draft listed it in error).
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

## Bug B: intersection with lookbehind triggers a `debug_assert!` (silent corruption in release)

### Symptom

A rule whose source contains both intersection (`&`) and a lookbehind
assertion (`(?<=...)` or `(?<!...)`) at the same scope (i.e. both outside
character classes, in the same compiled regex) and which is then matched
against an input of about 64 bytes or longer causes one of two
divergent outcomes depending on the build profile.

The trigger shape is unchanged from 0.5.3 through HEAD, but the defect now
surfaces at a different point. In 0.5.3 and 0.6.0 it tripped a
`debug_assert!` in the matching engine (`resharp/src/engine.rs:1020`,
`unexpected end 0 > N`). From 0.6.2 onward a new lookbehind-stripping
rewrite, `strip_lb`, runs during `find_all` and its own internal
`debug_assert!` fires first:

```text
# Debug profile (debug-assertions ON):
thread 'main' panicked at resharp-algebra/src/lib.rs:2007:   # :2006 in 0.6.3
should not contain lookbehind: "(?=a_*){∅}❮(&(?<=_*_))❯"

# Release profile (debug-assertions OFF, our forbidden-strings default):
# (no panic; find_all silently returns wrong/spurious matches)
```

The minimum reproducer captured by the `fuzz_extract_gate_soundness`
fuzz target is the pattern `(?:(?=a)&(?<=_))` driven through `find_all`.
The 2026-05-23 re-verification (probe crates `rsverify` against 0.6.3 and
`rsverify-head` against HEAD `e0b8aba`) reproduced it identically in both:
the debug build panics in `strip_lb`, and the release build returns
corrupted matches (62 spurious matches on a 64-byte input ending in `_`,
and 127 spurious matches on 128 bytes of `a` which contain no `_` at all
for the lookbehind to anchor on). The `engine.rs:1020` `debug_assert!`
still exists at HEAD (drifted to `engine.rs:1000-1002`) but this shape no
longer reaches it; `strip_lb` intercepts first.

### Root cause

In 0.5.3 and 0.6.0 the trigger reached a `debug_assert!` in the matching
engine (`resharp/src/engine.rs:1020`, `unexpected end {} > {}`), which in
release fell through to a `matches.push` recording a `Match` with
`start > end`. From 0.6.2 onward the live site is the `strip_lb`
lookbehind-stripping rewrite in `resharp-algebra/src/lib.rs`
(`:2003-2012` at HEAD, assert at `:2007`):

```rust
pub fn strip_lb(&mut self, node_id: NodeId) -> Result<NodeId, ResharpError> {
    if node_id.is_concat(self) && node_id.left(self) == NodeId::BEGIN {
        return self.strip_lb(node_id.right(self));
    }
    let result = self.strip_lb_inner(true, node_id)?;
    debug_assert!(
        !self.contains_lookbehind(result),
        "should not contain lookbehind: {:?}",
        self.pp(result)
    );
    Ok(result)
}
```

`strip_lb_inner` is meant to remove every lookbehind from the node, and
the `debug_assert!` enforces that postcondition. For the intersection-
with-lookbehind shape `(?:(?=a)&(?<=_))`, the strip fails to remove the
`(?<=_)` operand of the `&` node, so `contains_lookbehind(result)` is
still true and the assertion fires. In release the assertion is compiled
out, the un-stripped node flows into matching, and `find_all` returns
corrupted matches (the same fail-open class as before: 62 spurious
matches on a 64-byte input, 127 on 128 bytes of `a`).

Whether this is the same underlying invariant as the 0.6.0 engine bug
surfaced one stage earlier, or a distinct defect introduced with the
`strip_lb` machinery, is not determined here. What is verified: the same
trigger shape still produces a debug-build panic and release-build
silent corruption, now via `strip_lb`. The bug only fires when a
lookbehind is one of the intersection operands; pure lookahead
intersections do not trigger.

### Defense

The pre-validator `intersection_with_lookbehind` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
byte-by-byte tracking character-class membership and rejects any rule
where `&` and `(?<=` (or `(?<!`) co-occur outside any `[...]`. The
rejection produces an actionable error pointing here.

The pre-validator rejects on the source-text shape, so the relocation of
the assertion from `engine.rs` to `strip_lb` does not affect it: the rule
never reaches resharp either way.

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

A throwaway probe crate constructs `resharp::Regex::new("(?:(?=a)&(?<=_))")`
directly (bypassing `compile_rule_src` and the pre-validator) then calls
`find_all`. A plain `cargo run` (dev profile: debug-assertions and
overflow-checks both on by default) is sufficient; no `RUSTFLAGS` override
is needed. The 2026-05-23 re-verification used two such crates, one with
`resharp = "=0.6.3"` and one with a path dependency on the HEAD `e0b8aba`
checkout:

```text
# debug build (cargo run): panics in strip_lb
thread 'main' panicked at .../resharp-algebra-0.6.3/src/lib.rs:2006:
should not contain lookbehind: "(?=a_*){∅}❮(&(?<=_*_))❯"

# release build (cargo run --release): silent corruption
[B-64_]  FINDALL-OK  "(?:(?=a)&(?<=_))" inlen=64  matches=62
[B-128a] FINDALL-OK  "(?:(?=a)&(?<=_))" inlen=128 matches=127
```

The in-tree regression test
`find_all_catches_runtime_panic_via_catch_unwind` in
`packages/cli/forbidden-strings/src/rules/engine_tests.rs` exercises the
same shape through `CompiledRegex::find_all` and asserts no panic escapes.
Note that the package's `mise run test` task is `cargo test --release`, so
debug-assertions are off and no panic fires; the test passes because
`find_all` returns (corrupted) `Ok` rather than panicking. The actual
release-time protection for this shape is the `intersection_with_lookbehind`
pre-validator, not this test. Run plain `cargo test` (debug-assertions on)
to make the test exercise the panic path.

---

## Bug C: intersection with `\w` and `$` end-anchor overflows in `attempt_rw_concat_2`

### Symptom

A rule whose source contains intersection (`&`), `\w` shorthand, and
the `$` end-anchor at the same scope panics at compile time during
`Regex::new` when the release profile has `overflow-checks = true`:

```text
thread 'main' panicked at resharp-algebra/src/lib.rs:2479:   # :2478 in 0.6.3, :2470 in 0.6.0
attempt to add with overflow
```

When the release profile has `overflow-checks = false` (cargo's
default), the add silently wraps and the constructed regex
silently misbehaves at match time. Either outcome is a soundness
problem for a CI gate. The minimum reproducer is the pattern
`(?:\w|$)(?:(?![1g]\_X)& a)`. The 2026-05-23 re-verification reproduced
it identically against published 0.6.3 and HEAD `e0b8aba`: the debug
build panics with the message above; the release build returns `Ok`
(silent wrap). Only the source line drifted (`:2470` -> `:2478` -> `:2479`).

### Root cause

The overflowing `+` lives inside `attempt_rw_concat_2`
(`resharp-algebra/src/lib.rs`, `fn` at `:2405` at HEAD; the overflowing
add at `:2479` at HEAD, `:2478` in 0.6.3, `:2470` in 0.6.0). It adds
`usize` values derived from a node-tree traversal where one operand can
be near `usize::MAX` for the algebra rewrites triggered by intersection-
of-(word-shorthand-alternation, end-anchor-bearing-expression). The
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

A throwaway probe crate calls
`resharp::Regex::new("(?:\\w|$)(?:(?![1g]\\_X)& a)")` directly. A plain
`cargo run` (dev profile: overflow-checks on) panics with the message
above; `cargo run --release` (overflow-checks off) returns `Ok` but the
constructed regex misbehaves. Confirmed against 0.6.3 and HEAD on
2026-05-23.

The in-tree regression test `compile_rule_src_does_not_panic_on_known_
bad_shapes` exercises the same shape through `compile_rule_src` and
asserts the pre-validator catches it before resharp sees it.

---

## Bug D: alternation containing a lookaround + sibling lookaround (fixed upstream in 0.6.x)

Status: the documented symptom no longer reproduces in 0.6.3 or HEAD
`e0b8aba`. Re-verified 2026-05-23: `find_all` on `(a|(?![_]))(?!a)`
returns clean results in both the debug build (debug-assertions on) and
the release build, with no panic, for inputs of 1, 2, 64, and 128 bytes.
The lookbehind-direction variant `(a|(?<!_))(?<!a)` is now rejected at
compile time (`Algebra(UnsupportedPattern)`) and never reaches `find_all`.
The `unexpected end` `debug_assert!` still exists (drifted to
`engine.rs:1000-1002`), but this shape no longer reaches it. Do not file
this upstream: it reports an already-resolved defect. The historical
analysis below is retained for the record.

### Symptom (historical, no longer reproduces)

In 0.5.3 through 0.6.0, a rule whose source had an alternation containing
a lookaround AND another lookaround somewhere else in the source compiled
cleanly via `Regex::new`, but `find_all` panicked during the forward DFA
pass:

```text
thread 'main' panicked at resharp-0.6.0/src/engine.rs:1020:17:
unexpected end 0 > N
```

The minimum reproducer bisected from the fuzzer's
`crash-8cba104f0805ccb567513aff895398a4f652200c` artifact was:

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

Now that the upstream symptom is fixed, this pre-validator is
belt-and-suspenders rather than a live guard. It stays in place: it is
cheap, the production rule corpus has no rules of this shape, and it
keeps the fuzz target from re-aborting if a regression reintroduces the
panic.

### Verification

In 0.5.3 through 0.6.0, the probe binaries at
`/tmp/probe-slow-unit/src/bin/bisect2.rs` and `bisect3.rs` reproduced the
panic across all confirmed-triggering shapes with
`RUSTFLAGS="-C debug-assertions=on"`. The 2026-05-23 re-verification
(probe crates against 0.6.3 and HEAD `e0b8aba`, plain `cargo run` so
debug-assertions are on) found no panic: `find_all` on `(a|(?![_]))(?!a)`
returns `Ok` for every probed input, and the lookbehind variant is
rejected at compile time. The in-tree tests
`lookaround_in_alternation_with_sibling_fires` and
`compile_rule_src_rejects_alt_lookaround_sibling_shape` in
`packages/cli/forbidden-strings/src/rules/engine_tests.rs` exercise the
pre-validator and the end-to-end compile rejection path; they still pass
because they test the pre-validator, which is independent of resharp's
runtime behaviour.

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
the hang; the wrapping changes how the simplified AST enters the
prefix-selection phase.

Re-verified 2026-05-23: `Regex::new("abc~(\\w)&(?:aaa)*")` still hangs
past a 10s thread timeout in both published 0.6.3 and HEAD `e0b8aba`,
in debug and release builds. The control shapes `abc~(\w)&(?:a)*`
(1-char body) and `~(\w)&(?:aaa)*` (no literal prefix) return in
milliseconds, matching the scaling described above. This is the only one
of the five bugs that is both still live and has a re-validated prototype
fix, so it is the one issue ready to file.

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

0.6.x added a `targets.retain(|(t, _)| !redundant.contains(t))` line
(at `prefix.rs:50` at HEAD) and an "empty targets" clear-and-break just
below it. Neither breaks the cycle: `retain` filters the candidate
targets against `redundant`, but `redundant` is still only the two seed
nodes, so the freshly-visited cycle nodes are never filtered out and the
single-target chain still runs forever. The loop header is unchanged at
`prefix.rs:27`, and the trigger still hangs at HEAD (re-verified
2026-05-23), which is what the prototype below addresses.

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

Re-validated 2026-05-23 against the current HEAD
`e0b8aba96f0c1987f9802498e585b5e88966023b` (9 commits past the original
`6f445d7` prototype base, which itself declared 0.6.0; HEAD declares
0.6.3). On a fresh local clone the literal two-hunk diff below applies
cleanly (`git apply --check` succeeds). With it applied,
`abc~(\w)&(?:aaa)*` compiles in milliseconds and `is_match` returns
`false` for every input in `{"", "abc", "aaa", "abcaaa", "aaaaaa",
"abc!", "abcaaab"}`. `cargo test --workspace --no-fail-fast` reports
`231 passed; 0 failed; 19 ignored` both with and without the patch (the
unpatched baseline on HEAD is also `231/0/19`), so the fix remains purely
additive and regresses nothing on current `main`. The `46 active
prefix.toml cases` figure from the `6f445d7` audit predates later test
additions; the current `231/0/19` workspace run subsumes it.

### Verification

The original hang was located with probe binaries at
`/tmp/probe-slow-unit/src/bin/bisect5.rs` and `bisect6.rs` (a separate
thread with a configurable timeout), plus `hangtrace.rs` and an
instrumented resharp build. The in-tree tests
`complement_intersection_quantified_group_fires` and the end-to-end
pipeline verify the pre-validator skips the trigger.

The 2026-05-23 re-validation repeated the worker-thread-with-timeout
method against fresh clones of HEAD `e0b8aba`. Unpatched: the trigger
hangs past 10s. Patched (literal diff below applied via `git apply`):
the trigger compiles in milliseconds, `is_match` returns `false` on the
seven-input probe set, and `cargo test --workspace --no-fail-fast` is
`231 passed; 0 failed; 19 ignored`, identical to the unpatched baseline.

---

## Why we do not file Bugs B and C upstream (yet)

Bug D was in this deferred set in the earlier write-up but is now fixed
upstream (see Bug D's status note); it is dropped here and must not be
filed. The same five-constraint policy applies (see Bug A's "Why we do
not file this upstream" subsection) to the two that remain. For Bug B
(`strip_lb` debug_assert with release silent-corruption) and Bug C
(algebra arithmetic overflow), the constraints land:

1. **Upstream's fault?** Yes for both. A `debug_assert!` whose absence
   produces silently corrupted output is a defect; an algebra add that
   overflows for a parser-reachable input shape is a defect.
2. **Can upstream fix?** Yes. Bug B is fixing `strip_lb_inner` so it
   actually removes the lookbehind from an intersection operand (or
   promoting the `debug_assert!` to fire in release once the invariant
   holds). Bug C is locating which add overflows in `attempt_rw_concat_2`
   and either widening the type or adding a checked-add path.
3. **Supporting this use case?** Mixed. Intersection (`&`) and
   complement (`~`) are headline features of resharp; combining them
   with lookarounds is the natural way to write the "match A but not
   when X" exclusion pattern. No documented restriction.
4. **Likely to fix?** Unknown. The 0.6.0 to 0.6.3 releases relocated
   Bug B's assertion (into `strip_lb`) but did not resolve it, and did
   not touch Bug C's overflowing add beyond line drift.
5. **Have we prototyped a minimal fix?** No. We have minimum
   reproducers and source-line citations but no candidate patch.

We fail constraint 5 clearly for both. We defer filing until a
minimal-patch prototype exists. Until then the pre-validators and profile
settings are the durable consumer-side fix.

Bug E (the `calc_prefix_sets_inner` non-termination) is the exception:
we have a minimal-patch prototype that satisfies constraint 5.
Prototyped against `https://github.com/ieviev/resharp.git` HEAD
`6f445d71b194161adc0efe968d723312b6856a26` (declared version 0.6.0
in `Cargo.toml`, 2026-05-15) in a fresh `mktemp -d` clone. The
initially-proposed single-line patch regressed 9 of 46 active cases
in `resharp-engine/tests/prefix.toml`; the verified prototype is a
two-hunk additive variant (`visited` set plus fresh-revisit clear)
that passed `cargo test --workspace --no-fail-fast` with 228 passed,
0 failed, 19 ignored on that base. Re-validated 2026-05-23 against the
current HEAD `e0b8aba` (the literal diff applies cleanly and the suite
is 231/0/19 both with and without it). See Bug E's "Suggested upstream
fix" subsection above for the diff, the audit method, and the
language-emptiness check on the Bug E trigger pattern. Draft upstream
issue body is below.

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
`e0b8aba96f0c1987f9802498e585b5e88966023b` (also validated earlier
against `6f445d7`).

```text
cargo test --workspace --no-fail-fast
# 231 passed; 0 failed; 19 ignored  (identical with and without the patch)
```

The two-hunk diff above applies cleanly to `main` via `git apply`; the
trigger `abc~(\w)&(?:aaa)*` then compiles in milliseconds, and `is_match`
returns `false` for `{"", "abc", "aaa", "abcaaa", "aaaaaa", "abc!",
"abcaaab"}`, consistent with the empty language it represents. Prototype
clone, reproducer, and audit harness are available on request.
````

[resharp]: https://github.com/ieviev/resharp
