# chain-per-line rewrite spec

Status: approved for implementation, 2026-05-25.
Audience: the session that rewrites `chain-per-line` from scratch.
Scope: one oxlint rule covering binary, logical, member, and call chains.
The current implementation lives in `packages/config/oxlint-stylistic/src/rules/chain-per-line.ts`
with helpers in `packages/config/oxlint-stylistic/src/utility/chain.ts`,
`packages/config/oxlint-stylistic/src/utility/has-parens.ts`,
`packages/config/oxlint-stylistic/src/utility/indent.ts`, and
`packages/config/oxlint-stylistic/src/utility/line-at.ts`.

This is a full rewrite, not a patch.
The new behavior intentionally differs from the current behavior; see "Behavior changes from today".

## Why rewrite

The current rule derives positions and structure by scanning the raw source string
(`String.indexOf`, full-prefix slicing, newline counting from offset zero, neighbor-character peeking)
instead of using the byte spans and token information oxlint attaches to every AST node.
That single choice produces most of the defects below, and the layout policy on top of it is internally inconsistent.

## Defects the rewrite must eliminate

These are acceptance criteria.
The rewrite passes only if none of these survive.

1.  Boundary tokens are located with `sourceText.indexOf(token, from)`
    (`utility/chain.ts` `findBoundaryOffset`, called from `rules/chain-per-line.ts` `binaryBoundaries` and
    `memberOrCallBoundaries`).
    A token character inside a comment, string, or type-argument region after the scan start is matched
    before the real boundary, which corrupts line attribution and can suppress or misplace reports.
    Replacement: use AST node spans and oxlint token accessors.

2.  `hasParens` slices the entire file prefix on every call
    (`utility/has-parens.ts`: `sourceText.slice(0, child.start).trimEnd()`),
    once per inner chain node, giving O(file-size squared) behavior on chain-dense files.
    `lineAt` counts newlines from offset zero on every boundary (`utility/line-at.ts`).
    Replacement: precomputed line and column information, no full-prefix slicing.

3.  `context.sourceCode.getText()` is recomputed on every visitor invocation, including the many nodes that
    immediately bail as non-roots (`rules/chain-per-line.ts` `checkBinary` and `checkMemberOrCall`).
    `createOnce` caches nothing.
    Replacement: cache the source text once per file.

4.  The autofix only inserts `\n + indent` before each boundary and never normalizes existing whitespace
    (`rules/chain-per-line.ts` `buildChainFix`).
    It leaves trailing spaces after the left operand and produces whitespace-only lines when a boundary already
    sits at the start of a line.
    Replacement: a single canonical-render replacement (see "Reporting and autofix").

5.  The layout policy is internally inconsistent.
    Two non-configurable thresholds (`MIN_CALLS_FOR_METHOD_CHAIN`, `MIN_MEMBERS_FOR_DEEP_ACCESS`) gate reporting,
    then a third gate (`sameLineCount(memberBoundaries) < 2`) overrides them, so a two-call chain such as
    `foo().bar()` never reports despite meeting the stated "two or more calls" threshold.
    Replacement: one uniform layout rule with no named thresholds (see "Behavior specification").

6.  Chain membership for operators is keyed on identical operator text
    (`utility/chain.ts` `collectBinaryChainOperands`), so `a + b - c` is never treated as one chain while
    `a + b + c` is.
    Chain membership for member and call chains terminates at any node that is not `MemberExpression` or
    `CallExpression` (`utility/chain.ts` `collectMemberOrCallChainFrames`), so a non-null assertion fragments
    the chain and `a.b!.c.d` is silently never split.
    Replacement: flatten transparently across same-precedence operators and across transparent wrappers
    (see "Atom classification").

7.  `hasParens` reports a false positive for any node that sits alone between `(` and `)`, including a call
    argument `f(a + b)` and an `if (...)` test (`utility/has-parens.ts`).
    Replacement: rely on the parser's parenthesized-expression node rather than character peeking, or scope the
    paren check to grouping parens only.

8.  Tests are too weak to catch broken output.
    The invalid test asserts only that the rule code appears somewhere
    (`oxlint-stylistic.unit.test.ts`), and the autofix tests assert "no diagnostics", never exact fixed text.
    Replacement: assert exact fixed text and per-case report counts (see "Required tests").

9.  Documentation drift.
    `packages/config/oxlint-stylistic/README.md` describes a different message string than the rule emits,
    lists `obj.foo.bar` and `context.sourceCode.getText()` as staying on one line (the new spec breaks them),
    and claims computed access is "covered" while the rule excludes it.
    Replacement: rewrite the README section to match the new behavior.

## Vocabulary

A chain is the outermost expression formed by one unbroken run of member access, call, and same-precedence
operator application over a head value.

A segment is a single chain element: the leaf, one member step (`.name` or `?.name`), one computed step
(`[expr]` or `?.[expr]`), one call step (`(args)` or `?.(args)`), or one operand of a binary or logical
operator.

A break point is a segment that may legally start a new line: a member-name step (`.name`, `?.name`) or a
binary or logical operator's right operand.
When an operator break point starts a new line, the operator token renders leading on that line, for example
`+ c`.

An attached segment is any segment that is not a break point: a call step, a computed step (`[expr]`,
`?.[expr]`), and the head leaf.
An attached segment always rides on the line of the segment before it.

## Atom classification

Flattening walks the AST and emits the segment stream.
Three classes of node govern the walk:

1.  Transparent wrappers: TypeScript non-null assertion (`!`), `as` assertions, and `satisfies`.
    The walk passes through them and keeps building the chain.
    This is what makes `a.b!.c.d` flatten to `a`, `.b`, `!`, `.c`, `.d` and split correctly.
    The `!` and the assertion text render as attached content on their segment's line.

2.  Opaque atoms: a parenthesized expression, a `new` expression, and a tagged template.
    Each is one leaf-or-attached atom; the walk does not descend into it.
    A parenthesized subexpression isolates its contents exactly as `no-mixed-operators` expects, so
    `(a + b).c.d` has leaf `(a + b)` followed by `.c` and `.d`.

3.  Continuation nodes: member access, call, and binary or logical operators of the same precedence.
    The walk descends and emits their segments in source order.
    `no-mixed-operators` has already parenthesized any mixed-precedence operands, so a single unparenthesized
    operator run is always one precedence level; flatten across it transparently.

Computed access (`[expr]`, `?.[expr]`) is always an attached segment, never a break point, even when optional.
This keeps `arr[0][1]` and `arr[0][1][2]` on one line.

## Behavior specification

Fire once on the outermost chain root.
A node is the outermost root when its parent is not a continuation node for it, or when the node is
paren-isolated from its parent.
Do not fire on inner nodes; the single outermost pass lays out the entire flattened chain, including chains
nested as operands of an operator chain.

Lay the flattened segment stream out as follows:

1.  The head line accumulates segments left to right starting from the leaf.
2.  Find the first break point that has two or more segments before it on the head line.
    That break point begins the first continuation line.
3.  Every break point after that one also begins its own continuation line.
4.  Attached segments ride on the current line, head or continuation.
5.  Every continuation line is indented one level (two spaces) deeper than the head line's own indentation.

If no break point has two or more segments before it, the chain stays on one line and the rule does not report.

The two-or-more-segments test applies only to locating the first break on the head line.
After the first break, every break point breaks unconditionally.
Counting segments per continuation line instead would clump `a.b.c.d` into `a.b` then `.c.d`, which is wrong.

### Worked examples

Each block shows the input on the first commented line and the canonical layout below it.

```text
// obj.method()
obj.method()

// arr[0][1]
arr[0][1]

// a + b
a + b
```

These do not report: the only break point either has one segment before it (`.method`) or does not exist
(computed access is never a break point).

```text
// obj.foo.bar
obj.foo
  .bar

// context.sc.getText()
context.sc
  .getText()

// a.b.c.d
a.b
  .c
  .d
```

`a.b.c.d` puts one member per line after the head, not `a.b` then `.c.d`.

```text
// foo().bar()[0]
foo()
  .bar()[0]

// arr.map(f).filter(g).filter(h)
arr.map(f)
  .filter(g)
  .filter(h)

// a + b + c + d
a + b
  + c
  + d
```

`foo().bar()[0]` breaks because the head already holds two segments (`foo`, `()`) when `.bar` arrives;
the `[0]` is computed, so it attaches.

The nested case, an operator chain whose operands are member chains, lays out flat at one indent level with no
recursion:

```text
// a.b().c() + d.e().f()
a.b()
  .c()
  + d
  .e()
  .f()
```

Trace: head takes `a`, `.b` (one segment before it, attaches), `()` (attached).
`.c` is the first break point with two or more segments before it, so it begins the continuation.
From there every break point breaks: `.c()`, then `+ d` (operator leading, operand `d` attached),
then `.e()`, then `.f()`.

## Reporting and autofix

Report when the chain region's current source text differs from its canonical render.
The diagnostic points at the chain root node.
Keep one message string and update the README to match it verbatim.

The autofix is a single text replacement over the chain region that emits the canonical render.
A single replacement collapses incorrect breaks and adds missing ones in one operation, leaves no trailing
whitespace, and is idempotent: running it on already-canonical source produces identical bytes.

Build the canonical render from the segments' own source spans and the computed line breaks, so comments and
exact operand text survive.
If any gap between adjacent segments contains a comment or other non-whitespace content that the render cannot
place safely, suppress the autofix and report without a fix, matching the current conservative stance toward
writer intent.

Source all positions from AST spans and oxlint token accessors.
Do not scan the raw source string for tokens.

## Behavior changes from today

The new spec is more aggressive than the current rule, so existing code reformats.
Call this out in the commit and expect fixture and README rewrites.

-   `obj.foo.bar` and `context.sourceCode.getText()` now break; today they stay on one line.
-   `foo().bar()` now breaks; today the override gate leaves it on one line.
-   Binary and logical chains now keep the first two operands on the head line (`a + b` then `+ c` then `+ d`);
    today every operand sits on its own line.
-   `a + b - c` and other same-precedence mixed-operator runs now break as one chain.
-   `a.b!.c.d` and other chains broken by a non-null assertion or an `as` or `satisfies` wrapper now split.

## Required tests

1.  Per-case report assertions: a fixture whose expected report count is exact, not "the code appears
    somewhere". Cover each example in "Worked examples", both the reporting and the non-reporting cases.
2.  Exact fixed-text assertions: copy each invalid fixture to a temp file, run the autofix, and compare the
    result byte-for-byte against the expected canonical layout. The current "no diagnostics after fix" check is
    necessary but not sufficient.
3.  Idempotence: running the autofix twice yields identical bytes after the first pass.
4.  Comment preservation: a chain with a comment between segments reports without a fix and the comment is
    untouched.
5.  Trailing-whitespace and blank-line regression: assert the fixed text contains no trailing spaces and no
    whitespace-only lines, the specific corruption the old insert-only fix produced.

## Out of scope this session

Single-pass convergence with `no-mixed-operators` is out of scope.
A single wide replacement still overlaps a `no-mixed-operators` wrap on the same region, so the combined fixture
still needs two `oxlint --fix` passes.
That is an upstream oxlint limitation documented in
[oxlint-multi-fix-convergence.md][convergence-doc];
do not fold the two rules together to dodge it here.

## Implementation notes

-   No named threshold constants. The layout rule has no configurable numbers; the literal two falls inside the
    magic-number exemption and needs no name.
-   Do not reintroduce the two near-duplicate visitors. One flatten-and-lay-out path serves all four node kinds.
-   Reuse the shared `isWhitespaceChar` from `utility/indent.ts` rather than re-inlining the whitespace set.
-   Delete the now-unused exported `Boundary` type from `utility/chain.ts` if no other consumer remains.

## References

-   Current rule: `packages/config/oxlint-stylistic/src/rules/chain-per-line.ts`.
-   Current helpers: `packages/config/oxlint-stylistic/src/utility/chain.ts`,
    `packages/config/oxlint-stylistic/src/utility/has-parens.ts`,
    `packages/config/oxlint-stylistic/src/utility/indent.ts`,
    `packages/config/oxlint-stylistic/src/utility/line-at.ts`.
-   Tests: `packages/config/oxlint-stylistic/src/oxlint-stylistic.unit.test.ts`.
-   Fixtures: `packages/test-fixture/oxlint-stylistic/src/invalid/chain-per-line.ts`,
    `packages/test-fixture/oxlint-stylistic/src/valid/chain-per-line.ts`.
-   Sibling rule that shares the region: `packages/config/oxlint-stylistic/src/rules/no-mixed-operators.ts`.
-   Two-pass limitation: [oxlint-multi-fix-convergence.md][convergence-doc].

[convergence-doc]: ../../../../../docs/troubleshooting/oxlint-multi-fix-convergence.md
