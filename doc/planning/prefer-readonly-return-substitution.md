# Caller-side substitution for returned parameter state

Proposal,
 not an accepted decision.
Scope:
 `package/oxlint-plugin/prefer-readonly-parameter-type`.
Opened from task #38,
 which asked whether a member read should face escape analysis an index read does not.

The answer for the asymmetry itself is that on the array path neither route is wrong about soundness,
 and the difference there is a precision inconsistency the rule carries in two places.
Every offer the array probe produced was checked by applying it and type-checking,
 and every one of them holds.
An earlier revision of this document claimed an unsound offer on that path.
That claim was inferred rather than measured,
 the measurement refuted it,
 and the correction is recorded in "What the caller-side gap costs".

The array path is not the whole rule.
On the structural path the same alias hop does produce a false offer,
 measured end to end against the shipped rule with nothing mutated,
 and it is set out in "A false offer on the structural path".
That finding is what the ranking now rests on.

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

This removes the soundness argument for doing caller-side substitution first,
 without removing the finding.
What orders the work instead is a dependency between the two escape-test defects,
 set out in "Recommendation".

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

On the array path this looks like a consistency failure rather than a false offer:
`readonly Row[]` on `aliasedEscapeThroughMember` type-checks,
 measured in the same run.
Two functions with identical semantics get opposite verdicts,
 and the discharge rests on a claim the code does not honor.

That reading was too narrow,
 and "A false offer on the structural path" corrects it.
The same alias hop over a structural parameter produces an annotation the rule writes,
 that compiles,
 and that the callable violates at runtime.
The array projection was hiding the consequence,
 not bounding it.

## A third defect: a branch that cannot execute

`useEscapes` carries a branch for assignment,
 and nothing can reach it.
Proven from source rather than probed,
 because the proof is three facts and no fixture is needed:

-    `useEscapes` has exactly two call sites,
      at `effect-result-escape.ts:394` and `:423` as of `91b261348`,
      and both pass `valueConsumer({ node, },)` rather than the node.
     The fix moved those lines,
      so read them at that commit rather than at the tip.
-    `RIGHT_OPERAND_PASSES` contains `SyntaxKind.EqualsToken`.
-    `passesValueOutward` returns true when the parent is a binary expression
      whose operator is in that set and whose `right` is the node.

So `valueConsumer` always ascends past an assignment before `useEscapes` is called,
 and the branch testing `parent.right === node` on an assignment can never match.
For `sink.value = selected` the classifier receives the assignment expression,
 whose parent is an `ExpressionStatement`,
 and returns false at the discard branch.

Property and element stores are therefore not covered by the escape test at all,
 and `doc/decision/prefer-readonly-result-provenance.md` names them among the sinks
 requiring coverage before discharge.
The code does not implement the constraint its own accepted decision states.

Whether that yields a false offer is unmeasured and is not assumed here.

Fixed in `a57bb6f56`,
 with the classification moved into the ascent,
 which is the only position where both the store and the assignment's own consumer are visible.
Measured by rebuilding at the prior commit for the before:
 storing a member result into a property or an element was offered `readonly` and now reports,
 while assigning to a plain local and reading in place stay offered.

The sweep cannot see it.
Diagnostics are byte-identical before and after across 128 packages,
 1937 from this rule on both sides as sorted message-plus-location sets,
 so this shape does not occur anywhere in the repository
 and the fix rests entirely on a fixture and two mutation measurements.
That is worth stating plainly rather than filing as a win:
 the change is correct on constructed input and inert on real input,
 and only the second half was ever going to be evidence about the workspace.

## A false offer on the structural path

The array probes could not have found this,
 for a reason that is structural rather than incidental.
`ReadonlyArray<Row>` constrains structure and not elements,
 so an element write can never falsify it.
A structural parameter is projected with `ReadonlyDeep` instead,
 which does constrain elements,
 and `readonlyDeepSuggestions` in `readonly-suggestions.ts` rejects array and tuple parameter types outright.
The two projections therefore never apply to the same parameter,
 and every probe up to this point had chosen the one that cannot be falsified this way.

Probe over `type Config = { rows: Row[] }` with `type Row = { label: string }`,
 the file importing `ReadonlyDeep` from `type-fest` so a concrete suggestion is attached:

```ts
// package/test-fixture/oxlint-no-restricted-syntax/src/, disposable probe directory
export function pickDeep(config: Config,): Row | undefined {
  return config.rows
    .at(0,);
}

export function driveDeep(config: Config,): void {
  const first = pickDeep(config,);
  if (first !== undefined)
    first.label = 'written by driveDeep';
}

export function pickAliasedDeep(config: Config,): Row | undefined {
  const selected = config.rows
    .at(0,);
  const alias = selected;
  return alias;
}

export function driveAliasedDeep(config: Config,): void {
  const first = pickAliasedDeep(config,);
  if (first !== undefined)
    first.label = 'written by driveAliasedDeep';
}
```

Read at the user boundary with `oxlint --format json`,
 attributed by diagnostic line rather than by message order:

-    `pickDeep` reports receiver opacity,
      naming `config.rows.at`.
-    `driveDeep` reports receiver opacity as well,
      inherited across the resolved call edge.
-    `pickAliasedDeep` is offered `readonly`.
-    `driveAliasedDeep` is offered `readonly`.

One alias hop is the entire difference between the withheld pair and the offered pair.
It also answers a question the excerpts could not:
 a nested receiver reaches the discharge path,
 so `config.rows.at` is classified exactly as `rows.at` is.

The offer was then applied by the rule itself rather than by hand.
`oxlint --fix-suggestions` rewrites both offered parameters to `ReadonlyDeep<Config>`,
 which is the suggestion text the JSON formatter does not carry.
The rewritten file type-checks clean under TypeScript 7.0.2,
 exit zero,
 and calling `driveAliasedDeep` on a caller-owned `{ rows: [{ label: 'original', },], }`
 leaves the caller reading `written by driveAliasedDeep`.

So a parameter the rule annotated deeply readonly has its reachable state rewritten
 by the very callable carrying the annotation.
That is a false offer in the strict sense used in "What the caller-side gap costs",
 it is live in the shipped rule,
 and no part of the rule was mutated to produce it.

Three facts about `ReadonlyDeep` explain why the laundering compiles,
 each measured against TypeScript 7.0.2 rather than reasoned from how the projection ought to behave:

-    Writing through the projected result is rejected,
      `TS2540`,
      so the callee cannot perform the write directly.
-    Returning the projected result as the authored element type is rejected
      when the element carries its own array,
      `TS2322` on `readonly string[]` against `string[]`.
-    Returning it is accepted when the element holds only primitives,
      because property `readonly` modifiers do not affect assignability.

The third fact is what the laundering needs,
 and it is why the probe element is `{ label: string }`.
A helper returning `Row | undefined` erases the projection at its own boundary,
 and the caller then writes through a value the checker no longer knows was projected.

Either pending fix closes it,
 from opposite directions.
Closing the holder set,
 #41,
 keeps `pickAliasedDeep` opaque so the caller inherits opacity and is withheld,
 which is the fail-closed route.
Caller-side substitution,
 #40,
 maps the returned index back through the argument so the write attributes to `config`,
 which is the precise route.
Neither is redundant:
 the first restores the invariant the accepted decision states,
 the second recovers the offers the first will suppress.

A type error on an applied suggestion would not have been enough to claim this.
A suggestion that fails to compile is self-limiting,
 and reporting one as unsoundness is the same inference shape retracted earlier in this document.
The bar used here is the one set in "What this proposal does not establish":
 the applied annotation compiles clean,
 and the caller observes a mutation the annotation denies.

## Recommendation

Ranking:
 make the assignment branch reachable first,
 then close the holder set,
 then build the consumer,
 and decide the alignment question last.

Two revisions of this ranking were wrong,
 so the reasoning is given rather than just the order.
The first claimed the consumer had to land first or a false offer would spread;
 the compile check refuted that on the array path.
The second called the holder-set fix the smallest and independent item;
 external review refuted that too,
 because closing the holder set without fixing reference-position classification
 makes every assignment-created alias and every destructured binding report.

What actually orders these is that #42 is a precondition for #41:
 assignment-established aliases cannot be classified correctly
 while the branch that classifies assignment cannot run.
#42 landed in `a57bb6f56`,
 so the ordering constraint is discharged and #41 is next.

The order survives "A false offer on the structural path" and the reason for it changes.
#41 is no longer a consistency fix that happens to be safe.
It is the direct cause of a measured false offer,
 and closing it is the fail-closed half of the remedy.
#40 remains the precise half rather than an alternative to it.

1.   Make the assignment branch in `useEscapes` reachable,
      #42.
     Assignment needs edge-aware handling,
      because one terminal consumer node cannot represent both an assignment's store
      and the assignment expression's own later consumer.
     Establish target locality from the target symbol's declaration,
      not from `isIdentifier(parent.left,)`,
      since an identifier can name an outer or module binding.
2.   Close the holder set in `resultHolderSymbolIds`,
      #41.
     Call-specific least fixed point over transfer sites,
      never derived from `bindingOriginBySymbolId`,
      since two calls on the same receiver share an origin and must not share a verdict.
     Recurse into binding patterns for destructuring,
      adding a leaf only when its type can carry mutable state.
     Skip declaration and assignment-target occurrences before classifying a reference,
      or every alias and every destructured binding reports.
3.   Build caller-side substitution for `returnedParameterIndexes`,
      #40.
     At a resolved call,
      map each callee returned parameter index through that argument's origins,
     feed the result into `expressionValueOrigins`,
      and propagate transitively when a caller returns the result.
     Keep unsupported return paths opaque.
     This is the prerequisite the accepted decision names for discharging receiver opacity.
4.   Only then decide whether a verified direct return may discharge receiver opacity.
     Deferred rather than recommended:
      the compile check removed the reason to hurry it,
      and #35 refuted a closely related refinement after it looked obviously safe.

## Sweep baseline for the follow-up work

Single-threaded `OXLINT_THREADS=1 mise run lint:oxlint` from the repository root at `91b261348`,
 captured because every item in "Recommendation" moves findings and none of them can be judged without a before.

Workspace totals:
 3902 warnings and 3299 errors,
 7201 diagnostics.
That reproduces the figure `doc/planning/prefer-readonly-foreign-proof-cost.md` recorded for the deferral work,
 across a context boundary and several commits since,
 which is the only reproducibility evidence this baseline carries.

This rule contributes 1937,
 in five categories that sum exactly to that total:

-    1196 `used by these calls`,
      argument opacity.
-    666 `used as the object for these method calls`,
      receiver opacity,
      the category all three follow-ups move.
-    37 `claims readonly semantics dishonestly`.
-    32 `should be readonly`,
      the offers.
-    6 `has stale @mutates contract`.

`Mutation contracts disagree` is now zero,
 where `doc/decision/prefer-readonly-result-provenance.md` recorded four instances in `package/module/pipe`.
That category cleared at some point since,
 and this document does not establish when or why.

Counting note,
 recorded because it cost a wrong number once here.
Matching `Parameter "[^"]*" should be readonly` returns 26 rather than 32:
 six parameters are destructuring patterns whose printed names contain braces and quotes,
 so the quoted-name pattern silently drops them.
Count these categories by their distinctive phrase and check the parts sum to the whole.

## Sweep pre-registration for the holder closure

Written before the sweep finished,
 because the closure reports more by construction.
Any delta at all is consistent with the fix working,
 and equally consistent with it over-reporting exactly as the review warned,
 so a number on its own decides nothing.

Compared against `sweep-after-42.pairs` rather than the `91b261348` baseline.
The two are byte-identical,
 and the after-42 capture is the closest known state,
 so it isolates this change from the commits since.
The new fixture contributes nothing either way:
 root `oxlint.config.ts` ignores `**/test-fixture/**`,
 so a small delta does not mean the fixture failed to register.

What each direction has to survive:

-    Offers falling below 32.
     Sample the lost ones and confirm each parameter really does have an aliased escaping
      member result.
     A lost offer in a callable with no alias hop means the closure adds holders through a
      path that was not intended.
-    Receiver opacity rising above 666.
     Sample the new ones against the two occurrences the filter skips,
      a destructured binding name and an assignment target.
     Either appearing means `occurrenceEstablishesBinding` has a gap the fixture did not reach.
-    Anything moving in a category the change cannot touch,
      argument opacity or dishonest-readonly,
      is a signal to stop and explain it rather than to reconcile it.

The number that would narrow the change rather than ship it:
 more than about a fifth of the 666 receiver-opacity findings appearing as new,
 or any sampled new finding tracing to a binding occurrence rather than a value use.
Either says the closure is catching aliasing in general instead of aliasing of a tracked result.

## Consequence carried meanwhile

`package/cli/markdown-lint/src/rule/semantic-line-breaks.ts` carries a scoped `unicorn/prefer-at` disable
whose justification cites this asymmetry.
Its description of the behaviour is accurate and its framing is defensible:
 the index path is the one whose offers were shown honest,
 so treating it as the reference is fair.
The comment stays as written,
 and the suppression is still required either way.

## What this proposal does not establish

The probes use two element shapes and one collection.
`Map` and iterator members are not covered,
 and `doc/decision/prefer-readonly-result-provenance.md`
already records iterator members as separately unproven.
The compile checks cover the offers these probes produced,
 not every offer the rule can produce.

Nothing here measures how often the structural false offer occurs in this workspace.
The probe was constructed,
 and no sweep has looked for the shape in the 128 packages.
The 32 offers in the baseline are unexamined for it.
`readonlyDeepSuggestions` also returns nothing when the source file lacks a named `ReadonlyDeep`
 import from `type-fest`,
 while the report still fires with no suggestion attached.
Whether that bare report is itself a deep claim is a separate question,
 and it is left open rather than answered by inference,
 since inferring what a report promises is what produced the retraction recorded here.

One shape is half-measured and matters,
 because it is the one route by which the missing consumer could produce a genuinely false offer.
Element writes cannot make a `ReadonlyArray` offer false.
A structural write can,
 and a resolved callee can launder one through a cast:

```ts
function self(rows: readonly Row[],): Row[] {
  return rows as Row[];
}

export function structuralThroughLaunderedReturn(rows: readonly Row[],): void {
  self(rows,)
    .push({ label: 'appended', },);
}
```

Measured,
 with the offer already applied:
 this type-checks clean under TypeScript 7.0.2,
 and executing it grows the caller's own array from one element to two.
So `readonly Row[]` here is a false annotation in the strict sense,
 not merely an imprecise one:
 the callable structurally mutates exactly what the annotation says it will not.

What is still unmeasured is the half that decides whether this is a live defect:
 whether the rule actually offers `readonly` for that callable.
It should,
 by the same reasoning that made `writeThroughReturnedIndex` clean,
 since nothing maps `self`'s returned parameter back through the argument.
Confirm it before treating this as established.
If confirmed,
 #40 recovers a soundness justification that the element-write case does not give it,
 and the ranking in "Recommendation" should be revisited.

Whether any of these shapes occurs in the workspace today is unmeasured,
 and no sweep has looked.
