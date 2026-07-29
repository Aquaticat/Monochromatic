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
 and no part of the rule was mutated to produce it.
It was live when measured,
 at `768638274`,
 and closed by the holder closure in `7a50e47d9`:
 all four probe functions report receiver opacity now and none is offered.

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
 the second attributes the write instead of merely refusing to discharge.
An earlier revision of this passage said the second recovers offers the first suppresses.
The sweep measured zero offers suppressed workspace-wide,
 so that prediction is withdrawn rather than restated.

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

## A second false offer, on the array path

The half-measurement recorded in "What this proposal does not establish" is now complete,
 and it came back the way that section predicted rather than the way the earlier
 retraction went.
Both halves were re-measured here rather than carried forward,
 because the claim they support is that the shipped rule writes a false annotation.

The rule offers `readonly Row[]` for the laundering caller:

```ts
// disposable probe directory under the fixture source root
function launderMutable(rows: Row[],): Row[] {
  return rows as Row[];
}

export function structuralThroughLaunderedReturn(rows: Row[],): void {
  launderMutable(rows,)
    .push({ label: 'appended', },);
}
```

Read at the user boundary and attributed by diagnostic line:
 both `launderMutable` and `structuralThroughLaunderedReturn` are offered,
 with the reason `mutable Array has ReadonlyArray projection`.
The control in the same file,
 `structuralDirect`,
 which performs the identical `push` with no laundering hop,
 draws no diagnostic at all,
 because the direct write is recorded as a mutation.
So the hop is the whole difference,
 exactly as the alias hop was on the structural path.

Applying that offer to both parameters type-checks clean under TypeScript 7.0.2,
 exit zero,
 and executing it grows the caller's own array from one element to two.
The annotation says the callable will not change the array's structure,
 and the callable changes the array's structure.

This one is not closed by the holder closure,
 and testing it after `7a50e47d9` is how that was established rather than assumed.
`structuralThroughLaunderedReturn` contains no member call,
 so no receiver opacity exists to keep.
The write travels through a resolved callee's return value,
 and only caller-side substitution through `returnedParameterIndexes` can attribute it.

A related gap surfaced in the same probe and is not the same claim.
`structuralUnderReadonlyClaim`,
 written with `rows: readonly Row[]` already,
 performs the same laundered `push` and draws no `dishonestReadonly` report,
 only a request for a deeper projection.
So the rule does not catch a false readonly claim by this route either,
 in the direction where the claim is already written down.
Whether `dishonestReadonly` is meant to cover that is not established here.

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

## What the holder-closure sweep measured

Single-threaded,
 `9b65b74f8` behaviour,
 8 minutes 34 seconds wall,
 inside the 8 minutes 31 seconds to 9 minutes 43 seconds range of the four earlier sweeps.
That is the answer to the cost question the closure raises:
 it re-walks each transfer site's source on every pass and collects body nodes once per
 tracked call,
 which is superlinear in an alias chain,
 and no part of it is visible in the wall time across 128 packages.

Workspace totals moved from 7201 to 7202.
This rule moved from 1937 to 1938.
Against the pre-registered criteria:

-    Offers stayed at 32.
     The closure revoked no offer anywhere in the workspace,
      which is the outcome the pre-registration would have read as a warning sign had it
      been paired with a large opacity rise.
-    Receiver opacity rose by one,
      666 to 667,
      against a threshold of roughly a fifth of 666.
-    Argument opacity,
      dishonest-readonly and stale-mutates counts are unchanged.

The single new report is `getOnlyHandler` in
`package/pi-plugin/agent-settled-notification/src/mise.verify-extension.ts`,
 and it is the intended shape rather than a lookalike:

```ts
const handlers = handlersByEvent.get(event,);
const [handler,] = handlers;
return handler;
```

`handlers` holds the member result,
 array destructuring puts `handler` in the holder set,
 and returning it escapes.
The pre-registration asked whether any new finding traces to a binding occurrence rather
 than a value use.
This one traces to the return.
The binding occurrence `[handler,]` is skipped by `occurrenceEstablishesBinding`,
 which is what the fixture's `destructureReadInPlace` control pins.

Three argument-opacity findings kept their anchor,
 category and parameter,
 while changing the boundaries they name.
Two in `package/oxlint-plugin/test-import/src/package-manifest.ts` gained `pending.pop`,
 which follows from the same closure:
 `pending.pop()` feeds `current`,
 an assertion aliases it to `fallbacks`,
 and `pending.push(...fallbacks,)` spreads it into a call,
 so the member call no longer discharges and joins the boundary list.
One in `package/webapp-productivity/done/src/server.ts` renamed its boundary from
 `h3@2.0.1-rc.26 . serveStatic` to `serveStatic` with a local location.

Both were checked rather than assumed.
Two runs of each package at the current commit agree with each other,
 so neither is run-to-run variation,
 and rebuilding the rule at `a57bb6f56` reproduces the `h3` spelling,
 so the closure is what changed it.
Why a discharge decision changes which identity a boundary is reported under is not
 explained here,
 and it is worth knowing before the next change to this path.

That spread case also names the next precision question.
`useEscapes` counts a direct call argument as attributed and a spread element as escaping,
 while `parameterIndexes` and `provenanceSuccessors` both walk spreads,
 so the escape test disagrees with the argument analysis about identical state.

## Sweep pre-registration for caller-side substitution

Written before the sweep ran.
This change attributes writes the rule previously recorded against nothing,
 so it moves findings in a direction the holder closure did not:
 offers should fall,
 and the category that grows is mutation rather than opacity.

Compared against the `sweep-after-41` capture with `sweep-compare.mjs`,
 which reproduces the recorded category counts exactly on a known-zero pair.

What each direction has to survive:

-    Offers falling below 32.
     Sample the lost ones.
     Each must be a parameter whose callable really does write through a value returned
      by a resolved callee.
     A lost offer with no such write means substitution is attributing through a result
      the callee allocated,
      which the `growFresh` control says it must not.
-    Mutation findings rising.
     There is no separate mutation category in the diagnostic taxonomy,
      because a proven write withholds the offer rather than reporting,
      so this shows up only as offers falling and as silence.
     That asymmetry is worth stating:
      the change's main effect is invisible except as absence.
-    Receiver opacity or argument opacity moving at all.
     Neither should.
     Substitution adds to `mutated`,
      and nothing in it touches a discharge decision.
     Movement there means the deferred relation is reaching a path it was not meant to.

The number that would narrow the change rather than ship it:
 any sampled lost offer whose callable writes only through a freshly allocated result,
 or any movement in the two opacity categories that cannot be traced to a mutation that
 also appeared.

One measurement this cannot make.
Whether either false offer occurred in this workspace before today is unmeasured,
 and a sweep after the fix cannot answer it,
 since the evidence would be an offer that is now absent for the right reason rather than
 a finding that moved.
Sampling the lost offers is the closest available answer.

## What the substitution sweep measured

Single-threaded,
 9 minutes 46 seconds wall,
 three seconds above the top of the range of the five earlier sweeps and inside their spread.
No `EffectPropagationError` anywhere,
 which was checked first rather than inferred from the counts:
 the loop bound rose to four dimensions with this change,
 and the loop throws at its bound rather than returning a partial answer.

Workspace totals stayed at 7202.
This rule stayed at 1938.
Every category is unchanged,
 and the finding sets are identical as anchored message multisets,
 so nothing moved at all.

Against the pre-registered criteria:
 offers did not fall,
 and the two categories that had to stay still did.
The prediction that offers would fall was wrong,
 and the reason is the same one that made the assignment-store fix inert:
 the shape does not occur here.

So this repeats the pattern of the store fix rather than that of the holder closure.
Correct on constructed input,
 inert on real input,
 and the evidence rests entirely on the fixture and the three mutations.
Stating that plainly is worth more than filing it as a win,
 because the sweep was the only thing that could have spoken about the workspace and it
 said nothing.

One thing the sweep could not have measured,
 recorded before it ran and worth repeating after:
 whether either false offer occurred here before today.
The evidence for that would be an offer now absent for the right reason,
 which is indistinguishable in a diff from an offer that was never there.

## What stage one does not reach

Measured after the sweep,
 prompted by review rather than found by the sweep,
 and pinned by an assertion in `effect-summaries.unit.test.ts`.

The deferred recording sits in `effect-collection-member-effect.ts`,
 so it fires when the mutating operation is a default-library collection member call on
 the returned result.
A property write travels a different path:

```ts
export function writePropertyThroughReturn(rows: Row[],): void {
  const first = handBack(rows,)[0];
  if (first !== undefined)
    first.label = 'changed';
}
```

Measured:
 `mutated=[]`.
`inspectDirectWrite` resolves the write's origins through a walk that reaches the call and
 returns nothing,
 and no deferred relation is recorded there.

So the honest description of what landed is
 "collection-member mutations on a returned result,
 and returns of one",
 not "writes through a returned parameter".
The wider phrasing was in an earlier draft of this document and is withdrawn.

This is a boundary rather than a demonstrated false offer.
Under `readonly Row[]` an element property write is legal,
 which is the retraction recorded in "What the caller-side gap costs",
 so the shallow offer here is honest.
The structural projection is where the same gap would bite,
 and that is unmeasured.

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

One shape was half-measured here and is now measured in full,
 so it has moved to "A second false offer,
 on the array path".
It is the route by which the missing consumer produces a genuinely false offer.
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

Whether any of these shapes occurs in the workspace today is unmeasured,
 and no sweep has looked.

## Sweep pre-registration for the root parent walk

Written before the sweep ran,
 and unlike the two before it this one starts from a measurement rather than a prediction.

The three sweep captures already on disk carry the answer in their warning stream,
 which no earlier reading of them used.
Counting the demand index's omission warning by cause:

```text
sweep-after-42   5 typescript-go tuple panic   0 parent read
sweep-after-41   5 typescript-go tuple panic   3 parent read
sweep-after-40   5 typescript-go tuple panic   3 parent read
```

The captures run in that chronological order,
 so the reading is unambiguous:
 the holder closure introduced the crash.
`effect-result-holders.ts` calls `targetIsCallableLocal`,
 that call reaches `nodeWithin`,
 and before the fix `nodeWithin` walked onto an absent parent for any target declared
 outside the callable body.
Every previous statement that the holder closure moved one finding was made from the
 diagnostic lines alone,
 with the warning stream in the same file unread.
Three callables were being deleted from the effect index by a change I had already called
 measured.

The three are all dependency code,
 not workspace code:

-    `@earendil-works/pi-coding-agent` `dist/core/tools/file-mutation-queue.js`
-    `h3@2.0.1-rc.26` `dist/h3.mjs`
-    `yaml@3.0.0-1` `dist/directives-CiM56lHW.js`

That placement decides which direction findings can move.
A deleted callee is absent rather than empty,
 and `propagateEffects` gives a caller of an absent callee opacity on every slot,
 so the workspace callers of these three were taking opacity for a reason that no longer
 holds.
The expected direction is therefore opacity falling,
 which is the exact movement the substitution pre-registration named as its stop signal.
That criterion does not carry over,
 and saying so here is the point of writing this before the numbers arrive.

What each direction has to survive:

-    Omission warnings.
     The parent-read count must reach zero.
     The panic count must stay at 5,
      since nothing in this change touches the upstream checker crash.
     A parent read surviving means a third root walk exists that neither fix found.
-    Opacity falling.
     Each lost finding must name a call into one of the three packages above.
     This has to be checked against the authored call text,
      because the internal provenance string `callable without an effect summary` does not
      reach the rendered message:
      measured at zero occurrences across the whole 5.5 MB capture.
     A lost opacity finding whose calls all resolve inside the workspace is unexplained by
      this change and is the stop signal.
-    Offers rising.
     Admissible,
      and only where a recovered callee turns out to write nothing.
     Each new offer must be sampled against the recovered summary rather than assumed,
      since a recovered callee that does write should withhold the offer instead.
-    Anything moving in a file with no path to those three packages.
     Not admissible.
     The fix changes one predicate on a walk that previously threw,
      so a callable that never threw should be unaffected.

The number that would narrow the change rather than ship it:
 a surviving parent read,
 or a new offer on a parameter whose recovered callee mutates it.

One thing this sweep cannot establish,
 stated so a clean result is not overread.
It measures what the fix recovered.
It does not measure what remains deleted for other causes,
 and the five panics are proof that the effect index still drops callables silently.

## What the root-walk sweep measured

Single-threaded,
 against `sweep-after-40` with `sweep-compare.mjs`.
Every pre-registered direction held.

Omission warnings by cause:

```text
before   5 typescript-go tuple panic   3 parent read
after    5 typescript-go tuple panic   0 parent read
```

No `EffectPropagationError` anywhere.
Category totals identical on both sides:
 argument opacity 1196,
 receiver opacity 667,
 dishonest contract 37,
 offer 32,
 stale `@mutates` 6.

Exactly one finding moved,
 and it moved in place rather than appearing or disappearing.
`package/webapp-productivity/done/src/server.ts:224` reports the same parameter for the
 same reason,
 with a different name for the boundary:

```text
before   serveStatic [/var/home/user/Monochromatic/package/webapp-productivity/done/src/server.ts:225]
after    h3@2.0.1-rc.26 . serveStatic
```

That is the whole delta,
 and it names a call into one of the three recovered packages,
 which is the discriminator this was pre-registered against.

The offer count did not move,
 which is the honest reading of a recovery that reached only dependency code.
Restoring three deleted callees changed what the rule can say about one boundary.
It did not change what the rule offers anywhere,
 because every affected caller was already reported for a reason that survives.

## A third false offer, on a store into a module binding

The root-walk fix closed the member form of this shape and left three others open.
Measured after that fix landed,
 over a structural parameter,
 with a disposable fixture and probe removed afterward.

```ts
type Config = { rows: Row[]; row: Row; };

let escaped: Row | undefined;

export function storeElementFromStructure(config: Config,): void {
  escaped = config.rows[0];
}

export function storeMemberFromStructure(config: Config,): void {
  escaped = config.rows.at(0,);
}

export function storePropertyFromStructure(config: Config,): void {
  escaped = config.row;
}

export function storeAliasedFromStructure(config: Config,): void {
  const held = config.row;
  escaped = held;
}
```

Summaries read directly from the effect index.

```text
storeElementFromStructure    mutated=[] opaque=[]  offered
storeMemberFromStructure     mutated=[] opaque=[0] reported
storePropertyFromStructure   mutated=[] opaque=[]  offered
storeAliasedFromStructure    mutated=[] opaque=[]  offered
```

Only the member form is caught.
The reason is the asymmetry that
 `doc/troubleshooting/prefer-readonly-root-parent-walk.md` already records.
A verified member call has receiver opacity to discharge
 and so reaches the escape test at all.
An index read,
 a property read and an alias hop never arrive there.

All three legs of the falsification bar are met,
 by the rule's own fixer rather than by hand.
`oxlint --fix-suggestions --fix` writes `ReadonlyDeep<Config>` onto all three.
That file type-checks clean under TypeScript 7.0.2,
 exit zero.
Driving it observes the caller's own data change through the escaped reference:

```text
element: changed-by-element
property: changed-by-property
alias: changed-by-alias
```

Each line reads a property `ReadonlyDeep<Config>` declares readonly,
 after a call the annotation says cannot change it.
The rule's own diagnostic text names this exact hazard,
 "or arrange for one of those changes to happen later",
 so this is the rule failing its stated contract rather than a gap in what the contract
 covers.

Why the array path hid it,
 again.
`readonly Row[]` constrains structure and not elements,
 so `escaped = rows[0]` followed by a later `escaped.label = 'x'` violates nothing the
 shallow projection promised.
`ReadonlyDeep<Config>` does constrain elements,
 and `readonlyDeepSuggestions` rejects array and tuple parameter types outright,
 so the two projections never meet on one parameter.
Any conclusion drawn from an array-shaped probe about this shape is unsupported.

## The fixer deletes the import the fix needs

Found while applying the annotation above,
 and separate from any soundness question.

`readonlyDeepSuggestions` returns nothing unless the file already imports `ReadonlyDeep`
 from `type-fest`,
 because it reads the local name from the existing import to preserve an authored alias.
Adding that import to make the suggestion available makes it unused,
 and one `--fix` pass removes it while writing the projection that needs it.
The diff of one run over its own input:

```text
-import type { ReadonlyDeep, } from 'type-fest';
-export function storeElementFromStructure(config: Config,): void {
+export function storeElementFromStructure(config: ReadonlyDeep<Config>,): void {
```

Four signatures gained the projection and the import was deleted in the same pass,
 leaving a file that does not compile.
Reproduced twice on separate copies,
 with only this rule enabled in the fixture config.

## Sweep pre-registration for the two holder-closure narrowings

Written before the sweep ran.
Unlike the three changes before it,
 this one moves in the direction that costs soundness if it is wrong,
 so the reading is stricter and the controls matter more than the totals.

Both narrowings make the analysis discharge more.
Counting a callable's own parameter as local removes a store classification.
Treating an object rest of primitives as holding nothing removes a holder.
Fewer stores and fewer holders mean fewer escapes,
 fewer escapes mean more discharges,
 and every discharge is an offer the rule did not previously make.

What each direction has to survive:

-    Receiver opacity falling.
     Expected,
      and the only expected movement.
     Each lost report must be a callable that either rebinds one of its own parameters or
      destructures an object rest whose every member is primitive.
     A lost report matching neither shape is the stop signal,
      because it means one of the two predicates is answering about something else.
-    Offers rising by the same callables.
     Each new offer must be sampled and the parameter checked by hand for a write.
     An offer on a parameter the callable writes through is unsound and reverts the change.
-    Argument opacity moving.
     Not expected.
     Neither predicate runs on an argument position.
-    Anything at all in the mutation categories.
     Not expected,
      and not possible by inspection:
      neither change touches `directMutated`.
     Movement there would mean the discharge is reaching a write attribution.

The controls that decide whether this narrowed or simply disabled,
 all measured before the sweep:

```text
storeIntoParameter            [0] -> []   own parameter, must discharge
storeRestOverPrimitiveState   [0] -> []   fresh rest of primitives, must discharge
storeRestOverCarriedState     [0] -> [0]  rest copying a reference, must not
storeIntoModuleBinding        [0] -> [0]  outer binding, must not
assignToLocal                 []  -> []   body-local target, unchanged
readInPlace                   []  -> []   no binding at all, unchanged
```

The number that would revert rather than ship:
 any sampled new offer on a parameter the callable writes through,
 or `storeRestOverCarriedState` discharging.

What this cannot establish.
The rest narrowing reads declared types,
 so a source whose declared shape is narrower than its runtime shape can defeat it.
That is true of the whole analysis and is not new here,
 and stating it is not a defence:
 it means a workspace clean result is evidence about this workspace's declarations rather
 than about the predicate.

## What the store classification has to look like

Written after a stronger-model review of the first sketch,
 which was to record opacity whenever a binary `=` assignment's left side is an identifier
 that is not callable-local and whose right side can carry mutable state.
Six things are wrong with that sketch,
 and each names a fixture case rather than a preference.

Opacity is the right carrier,
 not a new dimension.
An escaped reference is exactly a value the analysis cannot prove stays unwritten,
 which is what an opaque slot already means.
It propagates through owned calls,
 withholds the offer,
 and carries provenance,
 and it leaves `EFFECT_DIMENSION_COUNT` at four.
A dedicated escape bit would give the same verdict until a sink-lifetime analysis exists
 to read it,
 so it buys machinery rather than precision.
Provenance should still say what happened,
 naming the store rather than borrowing the vocabulary of an unresolved call.

What the sketch gets wrong:

-    Restricting the target to an identifier.
     `assignmentStoreEscapes` already encodes the policy,
      and it deliberately covers property,
      element and destructuring targets too.
     `sink.value = config.row` and `[held] = config.rows` are stores the sketch misses.
-    Trusting the containment test about parameters.
     Fixed first,
      as its own change,
      because leaving it would have made every callable that rebinds a parameter report
      and given the sweep two causes with no way to attribute either.
-    Gating on whether the whole right side can carry state.
     `held = { label: config.row.label, }` allocates a mutable object and the origin walk
      reaches `config` through the property read that fills it,
      so the gate says yes and no caller-owned object was retained.
     The gate has to ask what the stored value can carry,
      not whether its expression is a reference.
-    Handling only `=`.
     `||=`,
      `&&=` and `??=` all store the right operand's reference.
     Arithmetic compound assignment does not:
      `total += config.rows.length` coerces,
      and treating the operator set as one class would report it.
-    Expecting `expressionOrigins` to see through an owned call.
     `held = firstRow(config,)` has no origins during direct scanning,
      because a callee's summary does not exist while its callers are scanned.
     That one needs the deferred result relation,
      and it is the reason this cannot be finished at the assignment site alone.
-    Reusing `addOpaqueEffect` without widening its contract.
     Its documentation says it records an unresolved external call.
     Either the vocabulary widens to cover a store or a store-specific wrapper owns the
      provenance.

One disagreement resolved rather than split,
 and resolved the wrong way.
A nested callable storing into a local of an enclosing callable was proposed as a case to
 leave out of a first stage,
 on the grounds that the enclosing local is owned.
The answer recorded here was that the local is not owned by the nested body,
 that sibling closures and later invocations can observe what was stored there,
 and that `storeIntoEnclosingLocal` is therefore a store this must report.
Measurement refuted every clause of that.
The correction is in "What a nested store actually measures".

## The rest narrowing shipped unsound, and how that was caught

Recorded before the fix,
 because the shape of the mistake matters more than the patch.

`membersCanCarryMutableState` answered by asking a type for its index signatures and then
 its properties,
 and returned whatever `.some()` returned over those lists.
Over a type it cannot enumerate both lists are empty,
 `.some()` over an empty list is `false`,
 and `false` means the rest holds nothing,
 which discharges.
So the predicate could not tell "enumerated every member and each is primitive" from
 "enumerated nothing",
 and the second reading is the one that costs soundness.

Both of its siblings in the same file get this right and were not consulted closely
 enough.
`typeCanCarryMutableState` resolves a type parameter's constraint and answers yes when
 there is none.
`receiverElementsArePrimitive` requires `indexes.length > 0` before it will call a
 receiver primitive,
 which is positive evidence before a permissive answer.
The new predicate had neither.

Measured rather than argued,
 with two cases added to `readonly-assignment-store-invalid.ts`:

```text
storeRestOverGenericState        opaque=[]   T extends Row
storeRestOverUnconstrainedState  opaque=[]   bare T
storeRestOverCarriedState        opaque=[0]  control still reporting
```

Both generic cases discharge,
 and both are wrong.
A rest over `T extends Row` is `Omit<T, 'label'>`,
 a mapped type over an unresolved `keyof T` that enumerates to nothing,
 while the actual `T` may carry any number of object-typed properties the constraint does
 not mention.
The control still reporting is what shows the escape test runs on these at all,
 so the discharge is the predicate's answer rather than an untaken path.

Requiring a non-empty property list is not the fix by itself.
The rest of `Row = { label: string; }` is genuinely `{}`,
 which enumerates to nothing and genuinely holds nothing,
 so emptiness alone cannot separate the two readings.
What separates them is whether the shape was resolvable,
 which needs a type-parameter branch as well as a positive-evidence requirement,
 and failing closed on both.

## What the narrowing sweep measured, and what it could not

Two things have to be separated before the numbers mean anything.

The first is that this sweep ran against a build carrying the unenumerable-shape defect,
 so it measures the over-permissive predicate rather than the shipped one.
That still bounds the corrected version:
 the fail-closed predicate discharges a strict subset of what the measured one did,
 so whatever this moved is an upper bound on what the fix moves.

The second is that the six control verdicts pre-registered here are not checked by any
 sweep.
Root oxlint ignores test-fixture paths,
 measured at zero fixture findings in every capture,
 so the controls live in `effect-summaries.unit.test.ts` and nowhere else.
The pre-registration's phrasing invited the wrong reading and this is the correction:
 a clean sweep is evidence about workspace shapes,
 and the controls are evidence about the predicates.

Against `sweep-after-43`:

```text
before 1938: argument-opacity=1196 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
after  1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
```

Omission warnings unchanged at five upstream panics and no parent reads.
No `EffectPropagationError`.

One pre-registered stop signal fired.
Argument opacity moved,
 which this recorded as not expected and not possible,
 since neither predicate runs on an argument position.
It is discharged by attribution rather than waived,
 and the attribution is measured:

-    The new argument-opacity finding names `providerOrName` in
      `package/pi-plugin/search-fetch/src/mise.verify-extension.ts`.
     Commit `032e5ac04`,
      timestamped between the two captures,
      adds that identifier twice to that exact file.
-    The offer pair is one finding at two line numbers,
      `tools.ts:461` and `tools.ts:468`,
      with identical parameter and message.
     Commit `d98a44f7c` edited that file between the captures.

So the workspace delta from both narrowings is zero,
 and the repository moved underneath the measurement instead.
Concurrent commits from another session are ordinary here and are not an obstacle;
 what they cost is the ability to read a delta without attributing every record,
 which is worth knowing before the next sweep is pre-registered as a bare count.

## A sweep hazard worth naming: the test task builds

The confirming sweep for the fail-closed predicate was compromised by its own operator,
 and the mechanism is worth writing down because nothing about it is visible while it
 happens.

`mise run //package/oxlint-plugin/prefer-readonly-parameter-type:test:unit` carries
 `depends = ["build"]`.
Running it to check an assertion therefore rebuilds the plugin,
 and running it during a sweep rebuilds the plugin the sweep is running.
Measured rather than assumed:
 the sweep started at 08:55:09 and `dist/final/node/index.mjs` was rewritten at 08:59:42.

Whether that changed the sweep's answer is unknown and was not established.
The analyzer sources had not changed since the run began,
 so a deterministic build would have written the same bytes,
 but no digest was taken before the rewrite and determinism was not measured either.
The honest position is that the capture has no authority,
 not that it is probably fine.

Two smaller hazards travel with it.
The plugin lints its own sources,
 so editing anything under its `src/` mid-run changes what the sweep reads for those
 files.
And the persistent cache digests analyzer sources once per process,
 which is why editing them mid-run does not corrupt a running capture,
 measured in `effect-summary-cache-identity.ts` where the comment says the digest is
 computed once per process.

What follows for the method.
A sweep is a quiet-tree measurement.
Before launching one,
 finish every edit,
 build once,
 and then run nothing that builds until the capture lands.
The tasks that build are not only `build`:
 `test:unit` depends on it,
 and any task that does is a rebuild in disguise.

## Why the rest narrowing was reverted rather than repaired

The fail-closed version was still wrong,
 and the reason is about TypeScript rather than about the predicate.

An object type states which members a value must have.
It never states which members it may have besides.
A value assignable to `{ label: string; count: number; }` can carry an `inner` reference
 the annotation never mentions,
 and object rest copies own enumerable properties at runtime rather than declared ones,
 so that reference lands in the rest.
No reading of declared members can establish what a rest copied,
 which means no amount of extra type-flag checking rescues the approach.
The generic cases were a symptom of this and not the disease:
 the same openness applies to an ordinary structural type.

Measured,
 with the fail-closed predicate in place:

```text
mutateExcessRestMember            mutated=[1,0] withheld
mutateThroughParameterInitializer mutated=[1,0,2] withheld
leakExcessRestMember              mutated=[] opaque=[] OFFERED
```

The first two were offered as counter-examples and are not.
Both write through the excess member inside the callable,
 and the direct-write attribution reaches the parameter through the destructured alias
 independently of any holder reasoning,
 so both are withheld already.
Reporting them as the defect would have been wrong,
 and checking before believing them is why the third case exists.

The third has no write at all.
It destructures,
 stores the rest into a module binding,
 and returns a string.
Nothing about it triggers write attribution,
 so the reading of the rest's declared members was the only thing between it and an offer,
 and it was offered.
A caller passing a row that carries an `inner` reference has that reference mutated by a
 later call the annotation says cannot reach it.

So the narrowing is reverted.
Every object rest keeps its opacity again,
 which costs the offers the narrowing was written to recover,
 and withholding is the affordable direction.

The fixtures stay.
Nine rest shapes and their controls are the record of exactly what a type-member reading
 can and cannot establish,
 and they now all agree because the reading was the mistake rather than any branch of it.
A future discharge would need provenance proving the source shape is exact,
 which is a different argument from anything the type system offers,
 and these cases are what it would have to satisfy.

The parameter half stands.
`storeIntoParameter` still discharges,
 no case constructed against it produced a false offer,
 and the one hole named against it,
 a closure written in a parameter initializer,
 is invisible to the holder scan because parameter initializers are siblings of the body.
That is recorded as its own task rather than folded in here.

## The omission count is cache-dependent, not a floor

An earlier section here called the omission-warning count a floor for what the effect
 index drops,
 on the grounds that one of the two drop channels logs only at debug level.
That reasoning was right and the conclusion was still too strong,
 because it missed a third reason the count can read low.

Measured across four captures of the same workspace:

```text
sweep-after-43     omitting=5
sweep-after-45     omitting=5
sweep-after-45fix  omitting=5
sweep-quiet        omitting=0
```

The quiet run reports none,
 and the upstream panic string is absent from it entirely.
Nothing was fixed between the third and fourth captures.
What changed is that the persistent cache served the callables that panic,
 so the checker path that panics was never re-entered and nothing was omitted to warn
 about.

The cache identity is a digest of the loaded analyzer,
 and the sweep loads a bundle,
 so editing analyzer sources between runs does not invalidate it while the bundle stands.
That is why the cache stayed warm across two runs whose sources differed.

Confirmed by reconciling the diagnostics rather than trusting the counts.
Findings naming `package/webapp-productivity/rss` number 43 in both captures,
 and the apparent difference of two was the two omission warnings naming that same file.
So the analysis produced identical verdicts;
 only the record of what it failed on differed.

What follows for anyone sizing the problem from that number.
It counts what a run recomputed and failed on,
 not what the index is missing.
A warm cache reports zero while the same callables remain unanalysed,
 and a cold run on an unchanged tree is the only reading worth quoting.

## What the reverted build measured

Quiet tree,
 dist digest verified identical before and after the run.

Against the capture taken with the rest narrowing in place:

```text
before 1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
after  1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
added   0
removed 0
```

Zero delta.
So the narrowing recovered no offer anywhere in this workspace,
 and everything it did here was the latent false offer it also introduced.
That is the cleanest possible argument for having reverted it rather than repaired it:
 there was nothing on the other side of the trade.

Against `sweep-after-43`,
 the net of every change since,
 the delta is the same two added and one removed already attributed to another session's
 commits in `package/pi-plugin/search-fetch`.
So both halves of this work moved zero workspace findings in total.

One prediction confirmed along the way.
The previous section explained a zero omission count as a warm cache serving the
 callables that panic.
This run reports five again.
Nothing about those callables changed;
 what changed is that reverting the narrowing changed the analyzer bundle,
 which is what the cache identity digests,
 so the panicking path was recomputed and warned again.
The explanation predicted the number before the run rather than after it.

## What the store classification changed

Implemented as `recordAssignmentStore` in `effect-assignment-store.ts`,
 called from the body scan beside the write attribution that already ran there.
The two ask different questions about one assignment,
 which is why the write attribution returns early for an identifier target and this does
 its work there.

Measured over `readonly-structural-store-invalid.ts`,
 every shape before and after:

```text
storeElementIntoModuleBinding    []  -> [0]
storePropertyIntoModuleBinding   []  -> [0]
storeAliasedIntoModuleBinding    []  -> [0]
storeThroughLogicalAssignment    []  -> [0]
storeThroughNullishAssignment    []  -> [0]
storeThroughAndAssignment        []  -> [0]
storeIterationBinding            []  -> [0]
storeMemberIntoModuleBinding     [0] -> [0]
leakExcessRestMember             []  -> [0, 1]
storeFreshAggregate              []  -> []
assignIntoParameter              []  -> []
assignIntoOwnLocal               []  -> []
countIntoModuleBinding           []  -> []
readStructureInPlace             []  -> []
iterateStructureRows             []  -> []
storeIntoEnclosingLocal          []  -> []
storeThroughOwnedCall            []  -> []
```

`parameterIndexes` rather than `expressionOrigins` is the whole precision of this.
The origin resolver descends an object literal and answers with the parameter reached
 through the property read that filled it,
 so `held = { label: config.row.label, }` would have attributed a store of a string to
 `config`.
`parameterIndexes` gates each leaf on whether that leaf can carry mutable state,
 and `storeFreshAggregate` keeps its offer.

`leakExcessRestMember` is now reported for a better reason than the one that was reverted.
The classification sees a value leaving the callable and never asks what the rest copied,
 which is the difference between asking where a value went and asking what a type claims
 to hold.

One hole stays open and named.
`storeThroughOwnedCall` has no origins on its right side at all,
 because a callee's summary does not exist while its callers are scanned.
`storeIntoEnclosingLocal` was recorded here as a second hole,
 with an explanation that measurement later refuted;
 see "What a nested store actually measures".

One offer was lost that deserves to exist,
 and one unsound offer was closed that had been documented as unsound.
Both are in `readonly-call-edge-invalid.ts`.
`store` assigns `value` into `slot.value`,
 and both belong to the caller,
 which already held each of them,
 so rearranging a graph the caller can already reach grants nothing and `value` deserves
 its offer.
`setterPairEffect` calls `store` and is withheld now for a reason that never mentions
 setters:
 the value left the callable,
 and where it went settles the question without resolving what happens there.
The precision half is tracked as its own task rather than accepted quietly.

## Sweep pre-registration for the store classification

Written before the sweep ran.
This is the first change in this sequence with a reason to move workspace findings in
 volume,
 because it adds a report source rather than correcting one.

Expected direction:
 argument opacity rising,
 offers falling,
 and the two connected case by case.

What each direction has to survive:

-    Offers falling.
     Each lost offer must name a parameter its callable assigns into something the
      callable does not own.
     A lost offer whose callable contains no such assignment means the target policy is
      answering about the wrong thing.
-    New opacity naming a store.
     The provenance says `stored into <target>`,
      which is a string no other path emits,
      so every new record is attributable by reading it rather than by investigating.
     A new opacity record without that provenance did not come from here.
-    Receiver opacity moving.
     Possible and expected only where a callable both makes a member call and stores its
      result,
      since the store now reports what the discharge used to decide alone.
     Movement on a callable with no store is the stop signal.
-    Mutation categories moving.
     Not expected.
     Nothing here touches `directMutated`,
      and the write attribution it sits beside was moved to a sibling module unchanged.

The number that would narrow the change rather than ship it:
 any sampled lost offer whose callable stores only into its own locals or its own
 parameters,
 which is the precision case already tracked and would mean it is wider than measured.

Confounders recorded before launching,
 after the last sweep taught that lesson.
Every commit since the previous capture is this work,
 and the tree is otherwise quiet apart from an untracked PNG at the repository root left
 by a concurrent session,
 which oxlint does not read.

## What a nested store actually measures

The record above said `storeIntoEnclosingLocal` reports nothing because the origins
 belong to the enclosing callable and the classification never sees them together.
That was written from reasoning rather than measurement,
 and a reviewer named the competing mechanism:
 `activeCallableBodyNodes` returns descendants of the outer body filtered by
 `insideOnlyActiveClosures`,
 so a node inside an invoked nested closure is in the scanned set with `body` still the
 outer body,
 and `targetIsCallableLocal` therefore answers yes because `captured` is declared inside
 that outer body.

Two explanations, one experiment.
Hold the nesting and the invocation fixed and move only the target.

```text
storeIntoEnclosingLocal            opaque=[]
storeFromNestedIntoModuleBinding   opaque=[0]
storeFromInertNested               opaque=[]
storeDirectly                      opaque=[0]
storeIntoEnclosingLocalThenLeak    opaque=[0]
storeIntoEnclosingLocalThenWrite   mutated=[0]
returnStoringClosure               mutated=[0]
```

`storeFromNestedIntoModuleBinding` settles it.
Same nesting,
 same invocation,
 target outside the enclosing body,
 and it reports.
The scan does see a nested body's origins and its enclosing container together,
 so the committed explanation was wrong about the mechanism.

It was also wrong about the verdict.
`captured` is a per-invocation local of the very callable that owns the parameter.
It dies when the call returns,
 and nothing outside can reach `config.row` through it afterwards,
 so withholding nothing is correct rather than a gap.
The three rows below the fold confirm the ways it could stop being correct are already
 covered:
 leaking the local afterwards reports,
 because `discoverAliasOrigins` registered `captured` as carrying the parameter's slot;
 writing through it reports as a mutation;
 and handing a closure over it to the caller reports as a mutation too,
 which means the escaping-closure case is not the danger its task description assumed.

`storeFromInertNested` is the control for the other half.
A nested callable nothing invokes and nothing hands outward contributes no effect,
 so escaping syntax alone must not report,
 and it does not.

Both new shapes are in `readonly-structural-store-invalid.ts` so the pair stays checkable.
The lesson is the one that keeps recurring here:
 an explanation that fits the observed output is not thereby the mechanism producing it,
 and the cost of guessing is that the next reader acts on the guess.

## Sweep result for the store classification

Captured on a quiet tree against `sweep-after-45-reverted`,
 with `dist/final/node/index.mjs` verified at digest
 `ee25c6a85b7e2b24a6b170f414b64e5f6f70f7a455c28ac920a695c8f7296518` before and after,
 so no mid-run rebuild.

```text
before 1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32
after  1971: argument-opacity=1232 receiver-opacity=664 dishonest=37 offer=32
added   42: argument-opacity=42
removed 10: argument-opacity=7 receiver-opacity=3
```

Every added finding names `stored into` somewhere in its call list,
 which was the pre-registered attribution test,
 and it passes.
Every removed finding has a counterpart at the same file,
 line and column in the added set,
 so nothing went silent:
 the removals are re-wordings.
Three of them were first recorded here as the channel flip explained in
 `doc/troubleshooting/prefer-readonly-root-parent-walk.md`,
 which was a guess of the same kind as the nested-store one and is wrong for the same
 reason.
Reading the pair settles it:

```text
before  receiver-opacity  "region" is used as the object for these method calls: region.join
after   argument-opacity  "region" is used by these calls: region.join, stored into this.region
```

`everyBoundaryIsInputMethod` is an `every` over the provenance facts,
 and `stored into this.region` does not begin with `region.`,
 so one store joining the list flips the predicate and swaps `opaqueMethodEffect` for
 `opaqueEffect`.
Nothing about a parent walk is involved,
 and the prediction that follows from the real mechanism is testable:
 keeping stores out of that list restores all three by itself.
`EffectPropagationError` stays absent and the panic and omission counts are identical
 across the pair.

The pre-registered stop signal did not fire.
No offer was lost anywhere,
 which is the first result worth pausing on rather than filing.

Offers did not move at all,
 in either direction.
The pre-registration expected them to fall,
 on the reasoning that a store closes an unsound offer.
It closes them in the fixtures,
 where the call-edge ledger went from four offers to two,
 and it closed none in this repository.
Sampling four of the new sites in the baseline capture found no finding of any kind at
 those locations:
 they were already silently withheld,
 and the classification did not change what the rule concludes about them.

What it changed is that they now speak.

```text
The function input named "task" is used by these calls: stored into this.#task.

This rule cannot inspect enough of those calls to know what they might change.

Resolve the call by one of these proof-preserving changes:
1. Include the exact repository-owned implementation in the nearest tsconfig.json ...
```

Every sentence of that is wrong for a store.
A store is not a call,
 so "used by these calls" misnames it and "cannot inspect enough of those calls" claims a
 limit the rule did not hit:
 it read the assignment completely and knows exactly what happened.
All four remediations address an unresolved implementation,
 and none of them is what a reader who retains a constructor argument should do.

The cause is the design note in `effect-assignment-store.ts`,
 which chose opacity over a dimension of its own on the grounds that an escaped reference
 is precisely a value this analysis cannot prove stays unwritten.
That is right about the decision and wrong about the channel.
Opacity carries a message,
 and that message is a request for help the reader cannot act on,
 because nothing about their tsconfig will make a retained argument unretained.
A withheld offer should be silent the way a mutation is silent.

Thirty-two locations in this repository now carry a diagnostic worded for a different
 situation,
 which is a regression at the user boundary introduced by this change,
 and it is tracked as its own task rather than left in the ledger.

## Sweep pre-registration for the retention channel

Written before the sweep ran.

The prediction here is stronger than a direction,
 which is what makes it worth capturing.
The store classification added forty-two findings and removed ten,
 and every one of those movements was caused by a store reaching a message.
If a store no longer reaches a message,
 the capture should equal `sweep-after-45-reverted` exactly:
 the thirty-two silent ones go quiet again,
 and the ten mixed ones return to their baseline text and category.

Not "forty-two fewer than the last capture".
Equality with the pre-classification baseline is the test,
 because a residual line names precisely what leaked rather than leaving a count to
 interpret.

What each possible residue would mean.

-    A finding whose message names a store.
     The split failed and the provenance crossed the boundary it must not cross.
-    A finding present in the baseline and absent now.
     The silent return swallowed a report that had a call cause,
      which would mean `reportableOpacity` is reading the wrong half.
-    `offer` above thirty-two.
     A retained parameter was offered readonly,
      which is the unsound direction and the one number that would revert this.
-    `offer` below thirty-two.
     Something unrelated to this change moved,
      since nothing here can withhold an offer that opacity was not already withholding.

Confounders.
The tree carries the two commits of this work and nothing else,
 apart from the untracked PNG at the repository root left by a concurrent session,
 which oxlint does not read.
Both the plugin bundle and the `config-oxlint` sidecar are rebuilt before launching,
 because the sidecar is what oxlint actually loads and a stale one measured the old
 behaviour once already today.

### A fifth residue, predicted before the capture landed

Measured while the sweep ran,
 on a probe rather than the fixture tree,
 so the running capture stays a measurement of what was committed.

```ts
export function configure({ task, api, }: Input,): void {
  held = task;
  JSON.stringify(api,);
}
```

```text
The function inputs named "task" and "api" are used by these calls: JSON.stringify
```

`task` is not used by `JSON.stringify`.
It was stored,
 and the split fixed the boundary list without fixing the subject that introduces it.
`opaqueBindingsByParameter` is derived from every opaque slot without asking what made the
 slot opaque,
 so a destructured parameter whose bindings have different causes names them all against
 whichever cause survived filtering.

This is the same regression one layer down,
 and it is imprecision rather than unsoundness:
 the message over-names a binding, and no offer moves.
Before the store classification the stored binding's slot was not opaque at all,
 so the subject was right by construction and this is new.

The consequence for the running capture is worth stating in advance.
If the repository contains a destructured parameter with one stored binding and one called
 binding,
 the capture will differ from the baseline at exactly that site,
 the difference will be an extra name in a subject,
 and it will be this and not a failure of the cause split.

## Sweep result for the retention channel

```text
before 1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
after  1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
added   0
removed 0
```

Equality with `sweep-after-45-reverted`,
 which was the pre-registered test rather than a count to interpret.
Both digests were identical before and after the run,
 the plugin bundle and the `config-oxlint` sidecar,
 so nothing rebuilt underneath it.

Every named residue is absent.
No message names a store.
No baseline finding was swallowed by the silent return,
 so `reportableOpacity` is reading the half it was meant to read.
`offer` holds at thirty-two,
 which was the one number that would have reverted the change.

The thirty-two locations the classification made speak are silent again,
 and the ten it re-worded carry their baseline text and category again,
 including the three whose message identity flipped through an `every` over a boundary
 list.
That flip was predicted to fix itself once stores stopped joining the list,
 and it did.

The fifth residue predicted while the sweep ran is also absent,
 and its absence is informative rather than reassuring.
It would have appeared only at a destructured parameter with one stored binding and one
 called binding,
 and this repository contains none:
 equality proves it,
 because such a site would have gained a name when the store cause was added and would
 therefore differ from the baseline now.
The defect is real and reachable,
 which `reportMixedBindingCauses` demonstrates in the fixture tree,
 and it is latent here.

That also settles what a confirming sweep after the subject fix can show.
No repository finding had its name set widened by a store,
 so filtering stores out of that set cannot narrow one,
 and the capture has to stay at equality.

## The silent return was wider than the thing it was silencing

Measured after the equality capture,
 which is exactly why equality is necessary and not sufficient.

```ts
export function declareOnly(encoder: Readonly<TextEncoder>,): void {
  void encoder;
}

export function declareAndStore(encoder: Readonly<TextEncoder>,): void {
  heldEncoder = encoder;
}
```

`declareOnly` reports that the parameter claims readonly semantics dishonestly,
 because `Readonly<TextEncoder>` keeps `encodeInto` and that writes a supplied destination.
`declareAndStore` reports nothing.
Adding a store silenced a verdict about the declared type,
 which the store has nothing to do with.

The cause is placement.
The silent return sits ahead of every branch,
 so a retention-only parameter skips the mutation report through a declared readonly type,
 the independently dishonest declared type,
 the stale `@mutates` report and the redundant marker report,
 none of which the change was about.

The repository cannot show this.
`dishonest` held at thirty-seven and `stale-mutates` at six across all three captures,
 which proves those shapes do not coincide with retention here,
 not that the branches are unreachable.
A sweep can only refute a claim about the code it contains.

The invariant to hold instead,
 stated so the next capture can be read against it:
 a retention-only parameter behaves exactly as it did before the store classification
 existed,
 except that it is not offered readonly.

That is not what gating two report branches achieves either.
`acceptedHostOpacity` is computed from opacity,
 and it feeds `affected`,
 which gates the stale contract report,
 and `mutated`,
 which gates the dishonest report.
A retention-only parameter carrying a host marker and a contract would take both of those
 away from their baseline while its two opacity reports stayed correctly quiet.

The shape that satisfies the invariant is to fold the cause test into the fact every
 verdict already reads,
 and to gate the offer separately.
Opacity that no report can ask about is invisible to every verdict,
 which is what it was before the classification existed,
 and retention withholds the offer on its own.
The analysis-level opaque set is untouched throughout,
 because propagation and discharge must keep treating a store as full opacity.

## Whether an opaque slot can exist with nothing recorded against it

Raised twice as the one hole in the cause split,
 and worth settling rather than defending against.
If a slot can be opaque with no provenance,
 then a parameter owning that slot beside a store-only slot merges to a list with one
 retention fact and no call fact,
 reads as store-only,
 and goes silent while carrying a genuine unknown.

Every writer of the opaque set attaches provenance in the same statement.

-    `addOpaqueEffect` records the fact and the provenance together,
      and is the only writer of `directOpaque`.
-    The unresolved-callee branch of the fixed point pairs the slot with
      `callable without an effect summary`.
-    Both callback-relation paths pair theirs with
      `callback supplied to ... that this rule cannot name`.
-    Element application pairs its slot with the observer's own provenance.
-    The bodyless summary seeds from `directOpaque`,
      so it inherits the pairing rather than adding one.
-    Propagation across a call edge runs `propagateCalleeIndexes` and
      `propagateUncertaintyProvenance` over the same `calleeSummary.opaque`,
      through the same `calleeSlotOrigins` mapping,
      in the same pass.

The sentinel cannot separate them either:
 `addEffectSlot` and `addOpaqueEffect` both return early on `EFFECT_SLOT_UNAVAILABLE`,
 so a slot that one skips the other skips too.

By induction over the fixed point every opaque slot carries at least one fact,
 the merged-list rule and a per-slot union rule coincide,
 and the silence described above is unreachable.

Measurement agrees.
The wording a provenance-free parameter would produce,
 "a call whose name this rule could not determine",
 appears zero times in all three full captures,
 including the one taken before stores existed,
 where any such parameter would have reported it.

The clause that treats absent provenance as reportable stays.
It is unreachable today and it errs toward speaking,
 which is the direction a fail-safe should point,
 and the induction above is exactly the kind of argument that stops holding after an
 unrelated change.

## Sweep result after folding

```text
before 1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
after  1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
added   0
removed 0
```

Equality with `sweep-after-45-reverted` again,
 with `dishonest` at thirty-seven,
 which was the addition to the criterion after the suppressed verdict was found.
Both digests were identical before and after the run.

The equality is worth reading carefully rather than as a third pass,
 because it is the one number this capture could not have moved.
`dishonest` held at thirty-seven through the broken shape too.
What establishes the fix is `storeDishonestProjection`,
 which reports now and did not before,
 and which is a unit test rather than a sweep line.

Wall clock 8m31s,
 inside the range earlier captures ran in,
 so restoring the foreign-ownership proof for retention-only parameters cost nothing
 measurable.
That comparison is weaker than the others here:
 this is the only capture that was timed,
 and the range it is being compared against was recorded from earlier runs rather than
 measured beside it.

What the three equalities together establish,
 and what they do not.
The store classification changes no verdict anywhere in this repository,
 and the two channel fixes return every message to what it said before the classification
 existed.
None of that is evidence about the shapes this repository lacks,
 which is why `readonly-structural-store-invalid.ts` now carries `reportMixedBindingCauses`
 and the dishonest pair:
 a fixture is the only instrument that reaches them.

## Sweep pre-registration for the iteration store

Written before the sweep ran.

This is the first change in the sequence that can move offers,
 and the equality criterion the last three used does not apply.
`for (held of config.rows)` was offered and is now withheld,
 so any repository callable retaining an element through an iteration target loses its
 offer.

Expected direction:
 offers falling from thirty-two,
 argument opacity rising by the same shapes,
 and no message naming a store,
 since the channel work landed before this.

What each result would mean.

-    Offers falling with a matching opacity rise.
     The change reaching real code,
      and each lost offer should show a callable assigning an element to a binding it does
      not declare.
-    Offers unchanged.
     The shape does not occur here,
      which the fixture already covers and which would make this capture uninformative
      rather than wrong.
-    Offers falling further than the opacity rise explains.
     Something else moved and the change is wider than the loop it names.
-    Any message naming a store.
     A regression in the channel work,
      which three captures at equality say is closed.
-    `dishonest` away from thirty-seven,
      or `stale-mutates` away from six.
     The iteration classification reaching verdicts that are not about it,
      which is the mistake the previous shape of the channel work made.

The stop signal:
 a sampled lost offer whose callable iterates into a binding it declares,
 or into a binding holding only primitives.
Both are controls in the fixture,
 and either appearing here would mean the fixture passes for a reason the sweep refutes.

## Sweep result for the iteration store

```text
before 1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
after  1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
added   0
removed 0
```

Offers unchanged,
 which the pre-registration named as the uninformative outcome rather than a failure,
 and which needs corroborating instead of assuming.

Searching the workspace for a `for...of` head whose target is not a declaration returns two
 matches,
 and both are comments in this package describing the shape.
No repository callable iterates into a binding it does not declare,
 so there was no offer here for this to take.

`dishonest` and `stale-mutates` held,
 which is the check that the classification stayed inside the verdict it is about.
Wall clock 8m33s against 8m31s for the previous capture.

The shape is reached only by `storeIterationTarget`,
 and its two controls are reached only by
 `storeIterationPrimitiveTarget` and `declareIterationBinding`.
That is the second time in this sequence that a fixture is the only instrument for a
 change,
 and it is worth naming as a pattern rather than a coincidence:
 a monorepo written to pass this rule stops containing the shapes the rule newly catches,
 so the sweep increasingly measures the absence of regressions rather than the presence of
 the fix.

## The suggestion depended on a statement it could not keep alive

Reproduced at the boundary rather than argued from the code.

```text
before                                    tsc exits 0
oxlint --threads 1 --fix --fix-suggestions
after   TS2552: Cannot find name 'ReadonlyDeep'. Did you mean 'Readonly'?
```

The structural suggestion fired only for a file already importing `ReadonlyDeep` and
 emitted that local name.
Until the suggestion is applied that import is unused,
 so the unused-import fix removes it in the same pass,
 and the removal wins.
The pipeline emitted a file oxlint calls clean and TypeScript rejects.

The two halves are not separable.
Keeping the gate and fixing only the emitted text leaves the import removed on the first
 pass,
 so the offer disappears on the next run instead of breaking the file.
An inline import type has no statement to remove,
 which dissolves the conflict rather than sequencing it.

Both halves verified with `tsc` on the emitted file.
The reproduction above now exits zero,
 and so does a file that imports nothing at all,
 which is the case the gate refused outright.

What removing the gate widens,
 stated because no sweep can show it.
A suggestion is attached to a report,
 and the report is emitted either way,
 so the offer count cannot move.
Measured across the workspace:
 thirty-two offers in ten files,
 of which one file imported the helper.
Nine files carried an offer the rule could not help with,
 for a reason that was mechanical rather than about correctness.

Every guard that is about correctness stays.
Array and tuple parameter types are still rejected outright,
 and the classification must still be mutable through a property or an index signature.

The cost is recorded rather than hidden.
An aliased import used to be preserved,
 and a test pinned it.
An alias exists to name an import statement,
 and the inline form has none,
 so the alias has nothing left to name.

### Removing the gate traded one broken emission for another

Caught by review rather than by the sweep,
 and then measured.

```text
package/module/logger, which does not declare type-fest
error TS2307: Cannot find module 'type-fest' or its corresponding type declarations.
```

The import gate was the wrong test for the right reason.
A file that imports a package can certainly resolve it,
 so requiring the import guaranteed the emitted name would compile.
Dropping it made the suggestion available everywhere,
 including the hundred and thirty-two workspace packages that do not depend on `type-fest`,
 where the inline form produces `TS2307` in place of the `TS2552` it was meant to fix.

Eighteen of a hundred and fifty packages declare the dependency.
The unreachable case is the common one.

The replacement asks the question directly,
 by walking ancestors for an installed package the way Node resolves one.
A manifest states intent and the walk states fact,
 and what decides whether the emitted type compiles is fact.

Both directions verified after the guard.
A fixture-package source still receives the projection and the emitted file exits zero
 under `tsc`.
A source in a package without the dependency is left alone.
The negative case pinned in the test is this package itself,
 which emits the projection and cannot resolve it,
 so it can never suggest it for its own sources.

Worth naming as a pattern,
 because it is the third time in this sequence.
A guard removed for a good reason took an unrelated guarantee with it,
 exactly as the silent return removed for a good reason took four unrelated verdicts,
 and as the store classification added for a good reason took the message with it.
Each was caught by asking what else the removed thing was doing,
 and none of the three was visible in a workspace capture.

## A false offer that meets the bar, through a returned projection

Found while investigating what looked like a precision task.
This is the first finding in the sequence to satisfy every clause of the falsification bar
 at once,
 and the shape is ordinary code rather than a corner.

```ts
export function firstRow(config: Config,): Row {
  return config.row;
}

export function writeThroughOwnedCall(config: Config,): void {
  firstRow(config,).label = 'written';
}
```

The rule offers `ReadonlyDeep` for both parameters.
Applying both annotations type-checks clean.
At runtime the caller's `config.row.label` changes from `original` to `written`.

Rule produces the annotation,
 annotation compiles,
 caller observes a mutation the annotation denies.

The reason it compiles is the part worth carrying forward.
TypeScript does not consider `readonly` property modifiers when deciding assignability,
 so `ReadonlyDeep<Row>` is assignable to `Row`,
 and a callee whose declared return type is `Row` launders a deeply readonly value back
 into a mutable one without a diagnostic.
The projection the rule offers is therefore not self-protecting across a call boundary,
 which is what an earlier reading of this assumed.

I reasoned my way to the opposite conclusion first,
 that annotating the caller alone fails to compile and the offer is therefore
 self-limiting.
That is true and irrelevant:
 the rule offers both parameters,
 a reader applying its suggestions applies both,
 and the pair compiles.
Checking one annotation at a time is the wrong experiment for a rule that reports per
 parameter and is applied per file.

What the analysis records for every shape of this:

```text
firstRow                    returned=[0]
storeThroughOwnedCall       everything empty
writeThroughOwnedCall       everything empty
writeThroughHeldResult      everything empty
writeThroughAliasedResult   everything empty
storeHeldResult             everything empty
```

`firstRow` knows its result carries parameter zero,
 and the machinery to substitute that caller-side exists and is used,
 but only from two places:
 a return statement and a collection member effect.
No write path records a deferred result use,
 so the fact `firstRow` publishes is never consulted by the callable that writes through
 the result.

The task tracking this was written as precision work about aliases.
It is a soundness defect,
 and its first stage is one call at the write site.

## Sweep wall clock does not measure what I was using it for

The resolvability guard added one memoized ancestor walk per offer,
 at most thirty-two of them repo-wide,
 and the capture that followed it ran nine minutes three seconds against a cluster of
 eight thirty-one,
 eight thirty-three,
 eight thirty-two.
Thirty-one seconds is far more than thirty-two directory walks can cost,
 so I re-ran rather than attributing.

The repeat finished in two minutes fifty.

Three times faster than the run it was repeating,
 on the same commit,
 with `sweep-compare.mjs` reporting the two captures identical:
 one thousand nine hundred thirty-nine findings both times,
 nothing added,
 nothing removed,
 offer thirty-two,
 dishonest thirty-seven.
The two files are not the same file:
 their hashes differ and sixteen thousand two hundred eighty-nine lines differ between
 them,
 all of it other rules' output and block ordering.

So the conclusion about the guard is the one I wanted,
 reached by a route that invalidates the instrument.
Wall clock on this sweep has ranged from one hundred sixty-nine seconds to five hundred
 forty-three seconds for identical findings,
 a factor of three,
 which means the eight thirty-one to eight thirty-three cluster I had been treating as a
 stable baseline was three consecutive samples of a noisy quantity and not a baseline at
 all.
Nothing about a change may be inferred from these numbers again without controlling
 whatever varies,
 and I have not identified what that is.

The honest statement of what the guard costs is that it is below the noise floor of the
 only instrument that has measured it.

## Stage one, and the boundary check that nearly did not happen in a linted place

`inspectDirectWrite` now defers the use against the call its target lands on.
The descent is `expressionRoot`,
 which strips the access layers,
 and `deferrableResultSite` unwraps the identity-keeping wrappers itself,
 so the two compose without either learning about the other.
One call covers all three write forms that function already served:
 assignment,
 `delete`,
 and the update operators.

Summaries after,
 from the built artifact:

```text
firstRow                     mutated=[] returned=[0]
freshRow                     mutated=[] returned=[]
writeThroughOwnedCall        mutated=[0]
deleteThroughOwnedCall       mutated=[0]
writeThroughFreshCall        mutated=[]
growThroughReturn            mutated=[0]
measureThroughReturn         mutated=[]
```

Removing the one call turns `writeThroughOwnedCall` and `deleteThroughOwnedCall` into
 empty and moves nothing else.
`growThroughReturn` keeps reporting because that write travels the collection-member
 path,
 which is a different producer of the same deferred record.

The control was wrong before the fix was.
Its first draft was `return { label: config.row.label, }`,
 a freshly allocated object holding a copied string,
 and it reported.
That reads as the fix over-reaching,
 and it is not.
An isolation probe:

```text
literalOfPrimitive   returned=[0]   return { label: config.row.label, };
literalOfReference   returned=[0]   return { held: config.row, };
literalOfConstant    returned=[]    return cond ? { label: 'a', } : { label: 'b', };
```

A fresh literal whose only property is a copied primitive is recorded as returning
 parameter state,
 indistinguishably from one that genuinely aliases.
The return branch does gate on `expressionCanCarryMutableState`,
 but it asks the question of the whole returned expression,
 an object literal answers yes,
 and the descent inside never re-asks per property.
Over-approximation in the safe direction,
 tracked separately rather than absorbed into a control.

### The boundary check ran in the one package where the rule is off

First attempt put the probe under
 `package/oxlint-plugin/prefer-readonly-parameter-type/src/`,
 and oxlint reported nothing at all,
 including for a function that reads and does nothing else.
`readonlyEffectSelfHostingOverride` in `package/config/oxlint/src/overrides.ts` turns
 the rule off for `**/oxlint-plugin/prefer-readonly-parameter-type/**`.

A clean report is what a working fix and a disabled rule both look like.
The control that caught it was a parameter that must still be offered,
 in the same file,
 and it is the only reason the empty result was read as a configuration fact rather than
 as success.

Re-run under `package/module/jsonc-edit/src/`,
 which is linted and installs `type-fest`:

```text
firstRow    offered: Parameter "config" should be readonly: property row is writable.
measure     offered: Parameter "config" should be readonly: property row is writable.
writeThroughOwnedCall  no report
```

Three parameters,
 two offers,
 and the withheld one is the caller that writes.
The falsification pair can no longer be built,
 because the rule no longer offers the annotation to both halves of it.

`firstRow` keeping its offer is deliberate.
It writes nothing,
 and handing back a value the caller already reaches grants no capability the caller
 lacked,
 which is the policy `doc/decision/prefer-readonly-result-provenance.md` records.

## Stage two, a store the analysis could not see

`held = config.row` recorded opacity.
`held = firstRow(config,)` recorded nothing,
 for the same reason the write path recorded nothing:
 `parameterIndexes` walks to the root of the stored expression,
 finds a call,
 and comes back empty.

Falsified the same way stage one was,
 and to the same standard:

```text
firstRow               offered ReadonlyDeep
storeOwnedResult       offered ReadonlyDeep
both applied           type-checks clean
driver output          caller row label is now: written
```

The write that observes it happens in a third callable taking no parameters at all,
 so nothing about the mutation is visible at the annotated call.
That is what makes the store class worth its own stage:
 the effect and its cause sit in different functions,
 and only the retention record connects them.

The deferred retention carries provenance,
 which the two existing kinds do not.
Store-caused opacity and call-caused opacity are different things to a reader,
 and the vocabulary that separates them is `effect-retention-provenance.ts`.
A retained application arriving without provenance would land as an unexplained opaque
 slot,
 which the diagnostic reads as a genuine unknown and reports as an unresolved effect
 addressed to an unresolved implementation,
 which is exactly the confusion that vocabulary was built to end.
The propagation throws rather than defaulting,
 since the only way to hold one is a payload written by something other than this code.

Substitution writes `summary.opaque` and not `summary.directOpaque`,
 which is the whole difference between this and `addOpaqueEffect`.
The direct set is seeded into the propagated one once,
 at the end of the syntactic pass,
 and this runs afterwards:
 an addition to the direct set here would land in the provenance map and never reach the
 set the verifier reads.
That would have been a silent half-fix,
 recording the cause while leaving the offer standing.

At the boundary,
 on four parameters:

```text
firstRow                    offered
freshRow                    offered
storeFreshThroughOwnedCall  offered
storeOwnedResult            withheld, and silent
```

Silent matters as much as withheld.
The retention provenance routes this to the offer gate rather than to the opacity
 report,
 so no reader is told about an unresolved effect that does not exist.

### The control was the hard part again

`storeFreshThroughOwnedCall` stores a call result too,
 and must keep its offer,
 or the fix is a rule against storing any call result rather than an attribution.
It needed `freshRow` written in the local-and-conditional shape,
 because the obvious spelling,
 `return { label: config.row.label, }`,
 carries a parameter origin for a copied string,
 which was measured while building the stage one control.

Two shapes,
 two controls,
 and both controls were nearly written in the one way that would have made them agree
 with the defect.

## The stage one sweep says the shape is not here

Zero delta against `sweep-after-45-reverted`,
 offers steady at thirty-two.
The criterion was registered before the run:
 offers should FALL if a write landing directly on an owned call's result occurs
 anywhere in this repository.
They did not,
 so it does not,
 and the fixture is the only thing proving stage one.
Third instance of that pattern in this work.

The capture has a defect of its own worth recording rather than hiding.
I rebuilt the plugin and the sidecar for stage two roughly three minutes into its lint
 phase,
 overwriting the file oxlint had loaded.
Whether that reached the running process depends on load timing I did not verify.
The result is zero delta,
 which contamination could only have hidden rather than manufactured,
 but the run is not clean and is not cited as though it were.
The stage two capture was launched with no concurrent build,
 and it covers both stages.

## Two things stage two got wrong that being green did not reveal

### The cache validator never checked the field

`isEffectSummary` validates `relations`,
 `elementApplications`,
 and `calls`,
 each bounded and each element type-checked.
It did not mention `resultApplications` at all.

That was harmless by accident rather than by design.
An unrecognised entry contributed a call-site key matching no edge,
 and `propagateResultApplications` skipped it.
The retaining kind ends that,
 because it carries provenance the propagation requires,
 and a payload naming that kind without provenance now reaches a throw.
An unvalidated field turned a corrupt-payload case from a skip into a crash inside the
 fixed point,
 while `rejects corrupt nested persistent payloads` says the intended behaviour for
 corrupt input is rejection.

The validator now checks kind against a set it states itself,
 requires provenance for exactly the retaining kind,
 and requires its absence for the other two.
Requiring absence is the part that would catch a payload written by a model that does not
 match this one,
 which is the only way a mismatched kind could arrive.

The digest already covers the ordinary version-skew case:
 the cache key hashes the analyzer's implementation bytes,
 so a cache written before this change is never read rather than being read and
 misinterpreted.
The validator is for the case the digest does not cover,
 which is a file that was edited rather than superseded.

### The cross-process cache test proved nothing about any of it

`reuses persistent summaries across independent Node processes` analysed one function:

```ts
export function inspect(value: { text: string; },): string { return value.text; }
```

That produces no deferred result use of any kind.
The test asserted that the counters move,
 which they do whatever happens to a field the fixture never populates.
It would have stayed green while serialization dropped the provenance,
 while the validator rejected the payload,
 and while the restored application reached the propagation throw,
 because none of those paths were entered.

The fixture now stores a returned piece of its own parameter,
 and the probe prints the verdict beside the counters.
The cold process computes the retention from syntax,
 the warm one restores it from disk,
 and both must say the same thing.
Asserting the exact value rather than equality of the two,
 because two processes that both lost it would agree and pass.

A cache test whose fixture exercises none of the cached shapes measures the counters and
 calls it reuse.

## What the stronger model found in stage two that I did not

Three things, one of them a defect I wrote.

### Progress has to count the provenance

`substituteRetainedOrigins` decided whether it had changed anything by asking whether the
 opaque slot set grew,
 while adding the provenance fact unconditionally.
A slot already opaque from some other cause therefore gained a new retention fact and the
 pass reported no change.

That is not merely conservative.
`propagateUncertaintyProvenance` reads a callee's `opaqueProvenanceBySlot` DURING the
 fixed point,
 and summaries are walked in map order,
 so a caller walked before its callee gained the fact is never revisited and the cause
 never crosses the call edge.

The consequence is the safe direction but it is the exact confusion the retention
 vocabulary was built to end.
Traced through the verifier rather than guessed:
 a caller missing the fact still has the slot opaque through ordinary edge propagation,
 `boundariesAreReportable` answers true for an empty fact list because absence of
 provenance is a genuine unknown,
 and `verifier.ts` returns early at the opacity branch with an unresolved-effect report.
So the parameter that should be withheld quietly is instead handed a report naming
 remedies for a call that does not exist.
Not a false offer.
I first reasoned it was one,
 by remembering the offer gate as the only test of opacity,
 and reading `verifier.ts` corrected that:
 the opacity branch sits ahead of the offer and returns.

Fixed by comparing the fact count across the insertion.
Recorded as reasoned rather than reproduced:
 triggering it needs a specific summary map order,
 and a test that depended on that order would pin the order rather than the invariant.
The invariant is the one the module already states,
 which is that a propagation step reports every change it makes.

### The optional field made the guard the only defence

`ResultApplication` had `kind` widened to include `retained` and `provenance` added as
 optional,
 with a runtime throw covering the impossible combination.
The combination was not impossible.
`{ callSiteKey, kind: 'retained' }` type-checked,
 so any well-typed literal could reach the throw,
 and the throw was inside the fixed point.

Rewriting the type as a union,
 with `provenance?: never` on the non-retaining arm,
 moved the invariant into the type.
TypeScript then narrowed the guard's subject to `never` and rejected the line,
 which is how the guard was shown to be dead rather than argued to be.

### Three more fields rehydration reads and validation did not check

`returned` was serialized,
 restored through `restoredSlots`,
 and absent from the slot arrays `isEffectSummary` checks.
A payload missing it passed validation and crashed inside rehydration,
 which is the one outcome `rejects corrupt nested persistent payloads` says must not
 happen.

`isCallEdge` validated `calleeKey` and `calleeFileName` and not `callSiteKey`,
 which is the key a deferred result use finds its edge by and the only one.
An edge accepted with a malformed key matches no application,
 so the use is skipped,
 and a skipped use is a missing effect rather than a loud failure.
That one can produce a false offer.

Opaque provenance permitted a repeated slot,
 which `new Map(...)` resolves by keeping the last entry and discarding the facts recorded
 against the others.
The serializer writes from a `Map` and cannot produce a repeat,
 so a repeat is proof the payload was written by something else.

Every one of these was reachable only through a payload edited rather than superseded,
 since the cache digest covers version skew.
That is a narrow door and it was standing open.

### The progress fix, checked at the boundary on the shape it is about

A parameter retained twice,
 through two different calls into two different targets,
 which is where the second retention finds the slot already opaque:

```ts
export function storeTwice(config: Config,): void {
  holder.held = firstRow(config,);
  second.held = alsoFirstRow(config,);
}
```

`alsoFirstRow` returns `firstRow(config,)`,
 so its own returned set arrives through the return-branch deferral and the retention of
 its result substitutes through that,
 which makes this a transitivity check as well.

Two findings on the file,
 both offers,
 both for the callables that hand back what the caller already holds.
`storeTwice` is withheld and silent.

## Stage three, measured before it is built

Every shape a local puts between the call and the use,
 from the built artifact carrying stages one and two:

```text
writeThroughHeldResult       everything empty
writeThroughAliasedResult    everything empty
storeHeldResult              everything empty
writeThroughHeldElement      everything empty
writeThroughHeldFresh        everything empty
readHeldResult               everything empty
```

The last two are the controls and must stay empty:
 a local holding a freshly allocated row,
 and a local that is only read.
The first four are the hole,
 and they are the hole in both directions,
 write and store,
 through a direct local,
 through an alias of one,
 and through an element of a returned container.

`discoverAliasOrigins` cannot close this by growing.
It iterates to a fixed point over `bindingOriginBySymbolId` using `expressionOrigins`,
 which stops at a call,
 and filling those origins later does not help:
 the write is attributed during the syntactic pass,
 before any callee summary exists.

The design that fits is a second map keyed the same way,
 symbol identity to call-site keys,
 seeded by a declaration whose initializer descends to a call and propagated through
 identifier initializers and alias assignments by the convergence loop already there.
Alias hops then come for free,
 which is what `writeThroughAliasedResult` is in the list to prove.

## Stage three, and one question it turned out not to be

A second map beside `bindingOriginBySymbolId`,
 keyed the same way,
 recording which call filled each binding rather than which parameter slots it can reach.
It converges in the same loop shape,
 so an alias of an alias costs a pass and nothing else,
 and `writeThroughAliasedResult` is in the fixture to prove that hop rather than to assume
 it:
 a fix reading only declarations directly initialized by a call passes the plain shape and
 fails that one.

The question a write site asks became one question instead of two.
`targetResultSites` strips the access layers,
 names the call when one sits underneath,
 and otherwise follows the identifier through the binding map.
So the direct case stage one added is subsumed rather than sitting beside this,
 and the store site asks the identical question about what it stores.

Every assertion passed on the first build,
 including both controls.
The controls need no special case:
 a local fed by an allocating callee still records which call filled it,
 that callee's returned set is empty,
 and substitution hands over nothing.

At the boundary:

```text
firstRow                   offered
freshRow                   offered
writeThroughHeldFresh      offered
writeThroughAliasedResult  withheld
```

### The pin that flipped, and why that was not the regression it looked like

`writePropertyThroughReturn` was pinned empty with prose saying the withheld offer would
 be a precision loss:
 the parameter is `rows: Row[]`,
 the offer implies `readonly Row[]`,
 and that annotation permits `rows[0].label = 'x'` because the element type stays mutable.
By that reading,
 flipping the pin makes the rule withhold an offer that was honest.

The reading is about what the annotation permits.
The question is what this analysis already does,
 and it is measurable:

```text
writeElementPropertyDirectly     mutated=[0]   const first = rows[0]; first.label = 'x';
writeElementPropertyInline       mutated=[0]   rows[0].label = 'x';
writeElementPropertyThroughCall  mutated=[0]   const first = handBack(rows,)[0]; ...
pushDirectly                     mutated=[0]   rows.push({ label: 'appended', },);
```

The direct element property write already attributed to the parameter,
 with no call anywhere in it,
 and stage three cannot have changed that because it only touches paths through a call.
So the offer was already withheld for the direct form,
 and following the result through the local made this case agree with its own direct
 equivalent instead of disagreeing with it.

The prose was stale,
 not the behaviour.

What survives the correction is a real question aimed at a different place:
 an array parameter is withheld for a write `readonly T[]` permits,
 which is true of the direct form first and has nothing to do with result substitution.
A structural parameter is a different matter,
 because `ReadonlyDeep<Config>` does forbid the nested write,
 so the same attribution is correct there and necessary.
The effect model records that a parameter was written through and lets one gate serve both
 annotation shapes.
Filed rather than folded into work about soundness.

## A sweep discipline, learned twice

Two captures in this session were contaminated by my own work while they ran.

The first:
 I rebuilt the plugin and the sidecar three minutes into the stage one lint phase,
 overwriting the bundle oxlint had loaded.

The second:
 I edited `direct-effect-summary.ts` while the stage three capture was running,
 to split it under the line budget.
Oxlint reads source at lint time,
 so that file was one thing when the run started and another by the time the run reached
 it,
 and a `max-lines` finding for it may or may not be in the output depending on when the
 file was visited.

Both were avoidable and neither was noticed until afterwards.
The rule for the rest of this work:
 while a sweep is running,
 no rebuilds and no edits to any file the sweep lints.
Documentation is fine.
Reading is fine.
Probing the built artifact is fine,
 since that reads what the sweep already loaded.

Everything else waits,
 and a capture taken under either violation is reported as contaminated rather than cited.

## What three soundness fixes changed in this repository

Nothing.

Four captures,
 each compared on all five counters:

```text
after stage one       1939  argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32
after stage two       1939  argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32
after the progress fix 1939 argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32
after stage three     1939  argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32
```

Stage three was the one I expected to move,
 because a write through a local holding a call result is an ordinary shape.
It did not,
 and the reason is visible in the counters themselves.
Of one thousand nine hundred thirty-nine findings,
 one thousand eight hundred sixty-four are already opacity of one kind or the other,
 and thirty-two are offers.
A fix that withholds offers has thirty-two places it could possibly act,
 and every one of them survived.

The other half of the reason is what these fixes need to fire:
 a callee whose `returned` set is non-empty,
 which means a callee that hands back a piece of its own parameter rather than something
 it built.
This codebase mostly returns fresh values.

So the fixtures are the entire evidence for all three stages,
 which is the fourth,
 fifth and sixth instance of that pattern in this work.
The falsifications are what establish the defects were real;
 the sweeps establish only that the repository did not contain them.

### The capture I contaminated still earned its cost

Editing `direct-effect-summary.ts` mid-run left two extra `max-lines` findings in the
 stage three output,
 one for that file at 423 lines and one for `effect-summary-cache-validation.ts` at 576.

The first was mine and already fixed by the time the capture landed.
The second was mine and I had not noticed it at all:
 the cache validation work took that file from under the limit to three hundred
 twenty-five code lines,
 and nothing in the package test suite checks line budgets.

A contaminated capture reported a regression I would otherwise have pushed.
That does not make the contamination acceptable,
 and it does not make the capture citable for the rule's own numbers,
 but it is worth recording that the sweep is the only check in this workflow that reads
 the whole repository's lint state,
 and the package suite is not a substitute for it.

## Two defects in stage three that the review found and the tests did not

Both measured before touching anything,
 and both in code I had just written and just mutation-checked.

### An alias inside a wrapper lost its write entirely

```text
writeThroughPlainAlias      mutated=[0]   const alias = local;
writeThroughAssertedAlias   mutated=[]    const alias = local as Row;
writeThroughParenAlias      mutated=[]    const alias = (local);
```

`expressionResultSites` removed access layers,
 then asked `deferrableResultSite` about the result,
 then tested the ORIGINAL root for being an identifier.
An alias carrying no access layer therefore left its wrapper in place:
 the call test looked inside the assertion,
 correctly found no call,
 and the identifier test then ran against the assertion rather than against `local`.

One loop over both removals fixes it.
The two also interleave,
 as in `firstRow(config,).row as Row`,
 so neither order alone would have been enough.

The mutation check did not catch this because it asks whether the assertions discriminate
 the mechanism,
 and they do.
It cannot ask about a shape no assertion names.

### The retention path never learned what the store path already knew

```text
storePrimitiveProjection   opaque=[0]  stored into heldLabel   heldLabel = firstRow(config,).label;
```

A `string`,
 recorded as retained caller state.
`parameterIndexes` gates every leaf on whether it can carry mutable state,
 which is exactly why the object-literal control beside it stays silent,
 and the deferred retention does not travel through that resolver at all.

`storeHeldFresh` could not catch it.
That control stays empty because its callee returns nothing the caller owns,
 not because anything recognised a primitive,
 so the two controls fail for different reasons and neither substitutes for the other.
Writing a control per mechanism rather than per outcome is the lesson,
 and it is the second time in this session that a control agreed with the defect.

### One comment that said the opposite of what the code does

`expressionResultSites` carried a comment claiming that naming no call site withholds.
It does not.
Both consumers iterate the returned set,
 so an empty one records nothing and the offer stands.
Every shape the walk does not model is a hole rather than a conservative choice,
 and the comment was telling a future reader the reverse.

Corrected in place,
 and the shapes are filed rather than left in prose.

### The new gate is load-bearing in the unsafe direction, so it was probed there

`expressionCanCarryMutableState` decides whether a store records a retention,
 and a false answer produces an offer rather than withholding one:
 no retention recorded means `retained` is false,
 and the parameter reaches the offer gate.
That is the one thing in this change that could create unsoundness rather than lose
 precision.

Measured on every shape where a wrong answer would be dangerous:

```text
storeAny                  opaque=[0]   any
storeUnknown              opaque=[0]   unknown
storeMaybe                opaque=[0]   Row | undefined
storeUnionWithPrimitive   opaque=[0]   Row | string
storeGenericIdentity      opaque=[0]   T instantiated to Row
storeRow                  opaque=[0]   Row
storeLabel                opaque=[]    string
```

Every dangerous shape fails closed.
`typeCanCarryMutableState` answers true for `any` and `unknown` outright,
 true for a union if ANY constituent can carry state,
 and true for an unconstrained type parameter,
 so the only silence is the intended one.

One case looked like a gate failure and was not.
`held = pickVia(config, pick,)`,
 where `pickVia<T>(config, pick,)` returns `pick(config,)`,
 records nothing.
The reason is in the callee:
 `pickVia` has `returned=[1]`,
 naming the CALLBACK parameter rather than `config`,
 so substitution maps it to the caller's own closure argument,
 which carries no caller state.
The gate was never consulted.
Reading the callee's summary rather than the caller's silence is what separated those two.

## Where the queue stands

Task forty-eight is three stages landed,
 four defects of my own found and fixed after landing them,
 and a queue of shapes the same machinery does not reach yet.

The remainder is not a tail.
Fifty-eight wants one multi-site descent for write targets,
 covering conditionals,
 parenthesised whole targets,
 destructuring patterns and iteration targets.
Sixty-one wants the binding record to survive a pattern,
 a default,
 or a logical assignment.
Sixty-two wants the return branch and the call arguments to consult that record at all,
 which is inside forty-eight's own title:
 a return and an argument are use sites.
Fifty-nine and sixty-two overlap on the argument case,
 differing only in whether the site comes from an expression or from the binding record.

So closing forty-eight is a statement about its three stages,
 not about the class of defect.
Anything reading the title as coverage will be wrong,
 and sixty-two is where the rest of the title lives.

The four defects found after landing are worth naming together,
 because they have one shape:
 each was a case the tests could not ask about.
The swallowed verdict,
 the progress that did not count provenance,
 the alias inside a wrapper,
 and the retention that never learned the leaf test.
Every one passed a green suite and a mutation check,
 because a mutation check asks whether the assertions discriminate the mechanism they
 name,
 and none of them named these.

## Stage three, falsified to the same bar as the other two

Stage three had been verified by summaries before and after,
 and by which parameters the rule offers at the boundary.
Neither is the bar this work set.
The bar is:
 the rule produces the annotation,
 the applied annotation type-checks clean,
 and the caller observes a mutation the annotation denies.

Run on a build with `discoverResultBindings` disabled:

```text
firstRow                offered
writeThroughHeldResult  offered
```

Both annotations applied,
 `mise run //package/module/jsonc-edit:lint:types` clean,
 and the driver prints:

```text
caller row label is now: written
```

With the fix restored and both artifacts rebuilt,
 the same file offers `firstRow` alone.
The pair cannot be constructed,
 which is what closes it.

Stage three carried the most new machinery of the three and was the only one resting on
 the inference that it was the same defect class as stage one.
It was,
 and now that is measured rather than reasoned.

## The last capture

Zero delta on all five counters,
 offers steady at thirty-two.

The criterion had inverted for this one and was registered before the run:
 the wrapper fix adds attribution so offers could fall,
 while the retention gate removes records so offers could RISE,
 and a rise is the dangerous outcome because it means a repository parameter withheld for
 a store-through-call is offered again.
Neither happened.

`max-lines` findings are back to one file,
 which is the one that had them before any of this work,
 so both budget regressions this session introduced are gone.

## A mutation check that destroyed the thing it was checking

The idiom used for the stage one, two and three mutation checks was:
 edit the source,
 rebuild,
 measure,
 then `git checkout --` the file to restore it.

That works only because those fixes were already committed.
Running it against the spread ascent,
 which was not,
 restored the file to `HEAD` and discarded the fix along with the mutation.
The test run that followed in the same command then reported the pre-fix behaviour,
 which read as the restore having failed rather than as the fix having been deleted.

The mutation check itself was valid and its result stands:
 reverting the ascent fails the boundary equality and nothing else.
What was wrong was the restore.

Rule for the rest of this work:
 commit before mutation-checking,
 so `git checkout --` restores the fix rather than removing it.
If a fix is not ready to commit,
 restore by re-applying the edit rather than by checkout.

## The next false offer of the same class, measured but not yet falsified

Task fifty-one was written as a capture-tracking gap.
Measuring it found a second silence beside the one it named:

```text
storeCapturingClosure          all empty   escapedCallback = (): Row => config.row;
storeCapturingClosureWriting   all empty   escapedCallback = (): Row => { config.row.label = 'x'; ... };
invokeLocalClosure             all empty   const read = (): Row => config.row; return read().label;
invokeLocalClosureWriting      mutated=[0] const write = (): void => { config.row.label = 'x'; }; write();
```

The last row is the control and it passes,
 so this is not a blanket failure to look inside closures.
A synchronously invoked local closure has its write attributed.
`activeCallableBodyNodes` filters by `insideOnlyActiveClosures`,
 and a closure that is stored rather than invoked is not active,
 which is right for a closure that never runs and wrong here:
 whoever holds it can run it.

The two escaping shapes differ in whether the offer can be acted on,
 and that decides which is urgent.

The writing closure is self-limiting.
Applying `ReadonlyDeep<Config>` puts `config.row.label = 'x'` under a deeply readonly
 type,
 which is a direct write TypeScript rejects,
 so the annotation does not compile.

The reading closure is not.
`config.row` returned as `Row` from a `ReadonlyDeep<Config>` parameter compiles,
 for the same reason every falsification in this document compiles,
 and the holder then writes through the returned row.
That is the stage two shape with a closure in place of the call.

Not falsified yet,
 so it is recorded as a suspicion with a measurement behind it rather than as a defect.
The falsification is the next thing that task needs,
 before any design.
