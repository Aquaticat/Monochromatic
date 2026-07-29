# Caller-side substitution for returned parameter state

Proposal,
 not an accepted decision.
Scope:
 `package/oxlint-plugin/prefer-readonly-parameter-type`.
Opened from task #38,
 which asked whether a member read should face escape analysis an index read does not.

The answer is that neither path is wrong about soundness,
 and the asymmetry is a precision inconsistency the rule carries in two places.
Every offer measured here was checked by applying it and type-checking,
 and every one of them holds.
An earlier revision of this document claimed an unsound offer.
That claim was inferred rather than measured,
 the measurement refuted it,
 and the correction is recorded in "What the caller-side gap costs".

## What was measured

A probe fixture placed nine,
 then fourteen,
 functions over `rows: Row[]` with `type Row = { label: string }`,
read both through `buildEffectSummaryIndex` summaries directly and through `oxlint` at the user boundary.
The two readings agree on every function,
 though for the silent ones that is agreement by absence rather than a matching verdict.
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

## What the caller-side gap costs

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
`writeThroughIndex`,
 performing the identical write directly,
 records `mutated=[0]` and is withheld.

An earlier revision of this document called the offer on `writeThroughReturnedIndex` unsound.
That was wrong,
 and the correction matters more than the original claim.
The wrongness was an inference:
 that because the rule withholds from `writeThroughIndex`,
 an element write must violate what the rule offers.
Applying the offer settles it instead of inferring it.

Measured against TypeScript 7.0.2,
 the way #18 established its genuinely unsound offer:
annotating `rows` as `readonly Row[]` on `writeThroughReturnedIndex`,
 on `aliasedEscapeThroughMember`,
 and on `writeThroughIndex` itself type-checks clean,
 exit zero.
The control in the same file,
 `rows.push({ label: 'added', },)`,
 does fail,
 so the annotation does bite where `ReadonlyArray` bites.

`ReadonlyArray<Row>` constrains structure,
 not elements.
`rows[0].label = 'x'` is legal under it.
So none of these offers is false,
 and the rule's effect model tracks writes that the only projection it can offer does not constrain.

The finding is therefore a precision inconsistency,
 not unsoundness:
the same write receives opposite verdicts depending on whether it is routed through a resolved callee,
and `writeThroughIndex` is withheld an offer that would have been honest.
Withholding is always safe,
 so that half costs nothing but noise.

This weakens the ordering in "Recommendation" rather than removing the finding.
Caller-side substitution is not a soundness prerequisite,
 so the items can be sequenced freely.

## The unconsumed return fact

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
That record is current,
 including its claim that nothing rests on the unconsumed fact.
What is new is only that the gap is observable from outside:
it makes the same write receive opposite verdicts,
 and it withholds honest offers.
No false offer was produced by it in anything measured here.

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

Like the first defect,
 this one is a consistency failure rather than a false offer:
`readonly Row[]` on `aliasedEscapeThroughMember` type-checks,
 measured in the same run.
Two functions with identical semantics get opposite verdicts,
 and the discharge rests on a claim the code does not honor.

## Recommendation

Ranking:
 fix the escape test first,
 then build the consumer,
 and decide the alignment question separately once both are done.

The ordering argument that an earlier revision made,
 that the consumer must land first or a false offer spreads,
 does not survive the compile check.
Nothing measured here produces a false offer,
 so neither item gates the other and the smaller one goes first.

1.   Fix `resultHolderSymbolIds` to follow alias hops,
      assignments and destructuring,
     or narrow the module doc to what it actually proves.
     Fixing is preferred,
      since the claim is what the discharge rests on.
     Smallest of the items,
      independent of the others,
      and it makes the rule report more,
      which is the safe direction.
2.   Build caller-side substitution for `returnedParameterIndexes`.
     At a resolved call,
      map each callee returned parameter index through that argument's origins,
     feed the result into `expressionValueOrigins`,
      and propagate transitively when a caller returns the result.
     Keep unsupported return paths opaque.
     This is the prerequisite the accepted decision names for discharging receiver opacity.
3.   Only then decide whether a verified direct return may discharge receiver opacity.
     Deferred rather than recommended:
      the compile check removed the reason to hurry it,
      and #35 refuted a closely related refinement after it looked obviously safe.

## Consequence carried meanwhile

`package/cli/markdown-lint/src/rule/semantic-line-breaks.ts` carries a scoped `unicorn/prefer-at` disable
whose justification cites this asymmetry.
Its description of the behaviour is accurate and its framing is defensible:
 the index path is the one whose offers were shown honest,
 so treating it as the reference is fair.
The comment stays as written,
 and the suppression is still required either way.

## What this proposal does not establish

The probe uses one element shape and one collection.
`Map` and iterator members are not covered,
 and `doc/decision/prefer-readonly-result-provenance.md`
already records iterator members as separately unproven.
The compile check covers the offers this probe produced,
 not every offer the rule can produce.
One shape stays open and is the one worth probing next:
 a resolved callee that launders a `readonly` parameter back to a mutable array through a cast,
 letting a caller structurally mutate what it was offered `readonly` for.
Casts are an acknowledged escape hatch,
 so that may well be out of scope,
 but it is the only route measured here by which the missing consumer could produce a false offer.

Whether any of these shapes occurs in the workspace today is unmeasured,
 and no sweep has looked.
