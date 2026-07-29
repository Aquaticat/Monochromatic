# Caller-side substitution for returned parameter state

Proposal,
 not an accepted decision.
Scope:
 `package/oxlint-plugin/prefer-readonly-parameter-type`.
Opened from task #38,
 which asked whether a member read should face escape analysis an index read does not.

The question was posed backwards.
Measurement says the member path is not over-reporting.
The index path is under-protecting,
 and that under-protection is a live unsound offer.

## What was measured

A probe fixture placed nine,
 then fourteen,
 functions over `rows: Row[]` with `type Row = { label: string }`,
read both through `buildEffectSummaryIndex` summaries directly and through `oxlint` at the user boundary.
Both agree on every function.
The fixture and the reading script are disposable and were run in a `git worktree` fork,
 not the main worktree.

The two paths agree everywhere except one construct.

-    Writing through an element,
      by index or by `at`:
      both record `mutated=[0]`,
      both correctly silent,
      no offer.
-    Handing an element to an unresolved sink (`JSON.stringify`),
      by index or by `at`:
     both record `opaque=[0]` naming the sink,
      neither names the read.
-    Reading a primitive through `at`:
      clean,
      offered.

That settles the case task #38 named as the one that had to be decided first.
The unresolved-sink case is already symmetric,
because `useEscapes` in `effect-result-escape.ts` classifies a call argument as attributed by design,
on the stated grounds that the argument analysis reports opacity against the origins at the sink instead.

The single asymmetry is the return statement.

-    `return rows[0]` records `returned=[0]`,
      `opaque=[]`,
      and is offered `readonly Row[]`.
-    `return rows.at(0,)` records `returned=[0]`,
      `opaque=[0]`,
      and reports the `rows.at` call.

Both record the identical `returnedParameterIndexes`.
The member path additionally keeps the receiver-opacity report,
because `resultEscapesCallable` counts a return as an escape and `receiverClaimAnswerable` therefore refuses to discharge.

## Why aligning the member path down would be wrong

Two functions decide this,
 and neither was in the original probe.

```ts
// headThroughIndex returns rows[0]; headThroughMember returns rows.at(0,).
export function writeThroughReturnedIndex(rows: Row[],): void {
  headThroughIndex(rows,).label = 'changed';
}

export function writeThroughReturnedMember(rows: Row[],): void {
  headThroughMember(rows,).label = 'changed';
}
```

Measured:
 `writeThroughReturnedIndex` records `mutated=[] returned=[] opaque=[]` and is offered `readonly Row[]`.
`writeThroughReturnedMember` records `opaque=[0]` and reports.

Both write `rows[0].label` through a resolved same-file callee.
The rule's own standard treats that write as disqualifying:
`writeThroughIndex`,
 performing the identical write directly,
 records `mutated=[0]` and is correctly withheld.
So the offer on `writeThroughReturnedIndex` is unsound by the definition this package works to,
a `readonly` offer for a parameter whose reachable state the callable writes.

The member path's report is currently the only thing blocking the same unsound offer on the member side.
Aligning the member path down to the index path would not remove a false report.
It would widen a live defect from one path to both.

## The actual defect

`returnedParameterIndexes` has no caller-side consumer.
Grepped across the workspace:
 the projection in `effect-public-summary.ts`,
the type in `effect-summary-index.ts`,
and one test reading it.
Nothing substitutes.

`doc/decision/prefer-readonly-result-provenance.md` predicted exactly this and pre-registered the constraint:
returns are named among the sinks needing coverage before discharge,
and the closing section states that `directReturned` and `returnedParameterIndexes` have no consumer,
so nothing rests on them.
That record is current.
What is new is the measurement that the missing consumer is not merely inert:
it produces an unsound offer on the index path today.

## A second defect, in the escape test itself

`resultEscapesCallable` is defeated by one alias hop.

```ts
export function aliasedEscapeThroughMember(rows: Row[],): Row | undefined {
  const selected = rows.at(0,);
  const alias = selected;
  return alias;
}
```

Measured:
 `opaque=[]`,
 and offered `readonly Row[]`,
where the same function without the alias hop records `opaque=[0]` and reports.

`resultHolderSymbolIds` collects only the identifier a call directly initializes.
`selected` is the only holder,
 its use as `alias`'s initializer is an attributed position because the parent is a
`VariableDeclaration`,
 and `alias` never joins the holder set.
The module doc claims to collect holders "directly or by alias",
 which overstates what the code does.
Assignment-established aliases and destructuring have the same gap.

This does not change the recommendation,
 because the member path's protection is the conservative side.
It does mean that protection is not reliable where it exists.

## Recommendation

Ranking:
 build the consumer first,
 then relax the escape test,
 and do not align the paths before either.

1.   Build caller-side substitution for `returnedParameterIndexes`.
     At a resolved call,
      map each callee returned parameter index through that argument's origins,
     feed the result into `expressionValueOrigins`,
      and propagate transitively when a caller returns the result.
     Keep unsupported return paths opaque.
     This closes the unsound offer on the index path and is the prerequisite the accepted decision already names.
2.   Fix `resultHolderSymbolIds` to follow alias hops,
      assignments and destructuring,
     or narrow the module doc to what it actually proves.
     Independent of the first item and smaller.
3.   Only after the consumer exists,
      let a verified direct return discharge receiver opacity.
     The paths then align because the return became attributed,
      not because the test was dropped.

Doing the third alone is the tempting move and the wrong one,
 for the reason measured above.

## Consequence carried meanwhile

`package/cli/markdown-lint/src/rule/semantic-line-breaks.ts` carries a scoped `unicorn/prefer-at` disable
whose justification cites this asymmetry.
Its description of the behaviour is accurate and stays.
Its framing is not:
 it reads as though the index path were the correct reference,
 and the index path is the
defective one.
Update that comment when the first recommendation lands,
 not before,
 since the suppression is still required.

## What this proposal does not establish

The probe uses one element shape and one collection.
`Map` and iterator members are not covered,
 and `doc/decision/prefer-readonly-result-provenance.md`
already records iterator members as separately unproven.
Whether the unsound index offer appears anywhere in the workspace today is unmeasured:
it needs a resolved callee that returns caller-owned element state and a caller that writes through the result,
and no sweep has looked for that shape.
