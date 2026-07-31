# AUDIT: chain-flatten reintroduced O(n^2) recursion under the AST exception

Post-mortem of commit `797d71ae` (`feat(oxlint-stylistic): rewrite
chain-per-line on AST spans and tokens`).
 The rewrite introduced
`package/oxlint-plugin/stylistic/src/utility/chain-flatten.ts`,
 whose
recursive spread-based flatteners are O(n^2) in time and O(n) in stack
depth on long chains.
 A Codex security finding flagged it as a lint-time
DoS (low severity:
 developer/build tooling,
 private package,
 no PR CI
running oxlint).
 The bug is real and validated;
 this doc records why it
slipped past two existing guards that both already covered it.

## What the code does

`chain-per-line.ts:120` calls `flattenChain` on every outer chain root
before any size or depth guard.
 The flatteners build their result with
recursive array spreads:

- Member/call chains:
   `chainSegmentsWithLeaf` descends the receiver via
  `descentChild` (`.object`/`.callee`) and returns
  `[...receiver, ...trailingStep(...)]` (`chain-flatten.ts:223`).
   The
  `receiver` array grows by one each level,
   so the spread copies
  1 + 2 + ... + n elements:
   O(n^2) time,
   O(n) stack.
- Operator chains:
   `collectStream` returns
  `[...collectStream(left), operator, ...collectStream(right)]`
  (`chain-flatten.ts:300`),
   and `operatorSegments` spreads the collected
  streams again (`chain-flatten.ts:403`).
   Same shape.

Validated crashes:
 member `a.b.c...` and binary `a + b + c...` both throw
`RangeError: Maximum call stack size exceeded`;
 with the stack enlarged,
timings grow superlinearly (member n=12000 at 1187ms,
 binary n=8000 at
2341ms).

## Root cause: the AST example was the bait

The "Simplification progression" rule in `AGENTS.md` bans recursion over
flat input and `[...acc, x]` accumulator recursion,
 but carves out an
exception:
 recursion is allowed for "bounded structural walks (AST,
 tree,
grid,
 filesystem) whose depth tracks the data's nesting,
 not its length.
"

`chain-flatten.ts` is an AST walk,
 and "AST" is the first allowed example.
So the recursion looked licensed.
 The trap is the qualifier that follows
the example and was not checked:
 "depth tracks the data's nesting,
 not its
length.
"

A member chain is not a bushy tree.
 `a.b.c.d` parses as a left-nested
spine of `MemberExpression` nodes,
 and `descentChild` walks down `.object`,
so recursion depth equals the number of member steps,
 which equals chain
length.
 A left-associative operator chain `a + b + c + d` is the same:
a left-leaning `BinaryExpression` spine whose depth equals operand count.
For both,
 AST depth equals source length,
 which is exactly the case the
exception excludes.
 The chain is linear input wearing a tree's clothes.

The spread accumulation (`[...receiver, ...]`,
`[...collectStream(left), ...]`) is the `[...acc, x]` antipattern the same
rule bans outright,
 layering O(n^2) copying on top of the O(n) stack depth.

The irony:
 the commit message lists "removes ... the O(n squared) paren
slicing" of the prior string-scanning implementation as a benefit.
 The
rewrite traded one O(n^2) (string indexing) for another (recursive AST
spreads) plus a new stack-overflow crash,
 while believing it had removed
the quadratic.

## Nuance: not every operator AST overflows

The skewed-spine analysis holds unconditionally for member and call chains
(always left-nested via `.object`/`.callee`) and for left-associative
operator runs.
 A perfectly balanced operator tree would have depth log(n),
so it would not overflow.
 Real source skews toward left-leaning operator
chains,
 and an attacker controls the shape,
 so the worst case is a spine.
The bug is real but its stack-overflow leg is conditional on skew,
 not
universal across operator ASTs.
 The quadratic-time leg from the spreads is
present whenever the chain is long,
 regardless of balance.

## Same trap, twice

This is the second time this exact pattern landed.
 `regex-replacement-perf.md`
is the prior audit of the no-regex sweep,
 which produced O(n^2)/stack-
overflow recursive walkers across the repo.
 That audit's "leave alone"
criterion (lines 58 to 63) lists "AST" as exempt,
 qualified by "where
recursion depth is bounded by structure depth,
 not input length.
" Same
correct qualifier,
 same "AST" bait.
 That audit even lists
`oxlint-plugin/stylistic` (`chain.ts`,
 `indent.ts`) as fix targets,
 but
`chain-flatten.ts` did not exist yet,
 so the rewrite created a fresh
instance after the audit had already mapped the class.

Both the `AGENTS.md` rule and the prior audit were correct in text.
 The
failure was application:
 "AST" pattern-matched to the allowed example,
 and
the "not its length" qualifier (the entire point of the carve-out) was not
tested against the fact that chains are linear-depth trees.

## Fix (landed)

Folded into the decoupled-axes rework of `chain-per-line` (the same change
that stopped single operators with member operands from splitting).
 Both
walks are now iterative O(n) with one linear pass plus an explicit
work-stack,
 no recursion and no spread accumulation:

- Member/call spine:
   `chainSegments` descends with a `for`-cursor collecting
  the step-contributing nodes outermost-first,
   then reverses once to source
  order.
   No recursion,
   one array build.
- Operator chain:
   `collectOperatorChain` walks with an explicit work-stack,
  gathering operand nodes and operator offsets without interleaving (the
  decoupled axes are merged and sorted downstream,
   so order is recovered by
  the sort rather than by recursion).

No size cap or depth guard is needed;
 the linear rewrite removes both the
crash and the quadratic.
 The regression test exercises `chainBreakOffsets`
directly on synthetic 50000-deep member and operator spines with a mock
context,
 asserting the expected break counts.
 It bypasses a real lint run
because oxlint's own deep-AST handling fails first end-to-end (it silently
drops `chain-per-line` near n=4000,
 then crashes around n=15000),
 so a
reintroduced recursion is only catchable by calling the flatten directly.

## Follow-up (done)

`regex-replacement-perf.md`'s "leave alone" criterion now carries the caveat
that a member/call or left-associative operator chain is a degenerate spine
whose depth tracks length,
 so it is not the exempt structural-recursion
case.
 `AGENTS.md`'s "Simplification progression" rule already carries the same
sharpening,
 so the class is mapped in all three places.
