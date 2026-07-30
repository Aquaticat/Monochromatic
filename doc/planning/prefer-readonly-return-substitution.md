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

Six more shapes joined the queue after the escaping-closure fix landed,
 and they group by cause rather than by syntax.

Three are one cause:
 the store path decides what a stored expression is by looking at its syntax,
 so an alias,
 a conditional and a container held in a local all slip past it.
That is task sixty-six,
 and the design question inside it is whether to keep adding syntax branches or to ask once
 what an expression can evaluate to.

Two are the opposite cause,
 and they are the two halves of one mismatch:
 `packagedCallableOrigins` is a lexical scanner answering a call-graph question.
Task sixty-four is where that over-reports,
 naming a binding a read-only closure merely mentions.
Task sixty-eight is where it under-reports,
 missing a capture that leaves through a call to a sibling local.
Neither can be settled without the other,
 because a body summary fine enough to permit an offer has to be complete enough to see
 every way out.

Sixty-five and sixty-seven stand alone.
Sixty-five is a selection disagreement between two forms of the same local closure,
 self-limiting and cheap.
Sixty-seven is not a hole at all until measured:
 it asks whether a returned closure falls under the accepted decision that permits returning
 parameter-reachable state,
 or breaks that decision's stated precondition.

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

## The first capture in this session that moved

Task forty-six,
 the spread ascent:

```text
1939 findings before and after
argument-opacity 1197, receiver-opacity 667, dishonest 37, offer 32, stale-mutates 6
added 3, all argument-opacity
removed 3, all argument-opacity
```

Three findings changed their text.
None appeared,
 none disappeared,
 and no offer moved.

The three are real workspace locations,
 two of them in the file task forty-six named as its original observation:

```text
package/oxlint-plugin/test-import/src/package-manifest.ts:144
package/oxlint-plugin/test-import/src/package-manifest.ts:270
package/git-policy/cli/src/trust/typescript-syntax-validation.ts:45
```

All three are the same work-stack idiom,
 and the message improved rather than merely changing.
The parameter at `package-manifest.ts:144` named:

```text
before   Object.values, pending.pop
after    pending.push, pending.push
```

The code has two spread pushes,
 `pending.push(...fallbacks,)` and `pending.push(...Object.values(current,),)`,
 and the operand of each is what the ascent now carries into the call-argument position.
Before,
 both operands escaped and the boundaries named the calls that PRODUCED the tracked
 values.
After,
 the argument analysis records against the sink,
 so the boundaries name where the value went.

A reader is told the value entered `pending.push` and can act on that.
Being told it came from `Object.values` and `pending.pop` names two calls that are not
 the obligation.

The opacity is unchanged in every case,
 which is the part that had to hold:
 the obligation moved to the sink rather than disappearing,
 which is exactly what the call-argument branch of `useEscapes` says it does.

## The escaping closure is a false offer, falsified

Same bar as every other in this document.

```ts
const holder: { callback?: () => Row; } = {};

export function storeCapturingClosure(config: Config,): void {
  holder.callback = (): Row => config.row;
}

export function mutateThroughHeld(): void {
  if (holder.callback !== undefined)
    holder.callback()
      .label = 'written';
}
```

The rule offers `ReadonlyDeep<Config>` for `storeCapturingClosure`.
Applying it type-checks clean.
The driver prints:

```text
caller row label is now: written
```

So it belongs to the class this session has been closing,
 and it is the fourth member of it:
 a write through a returned value,
 a store of one,
 a store through a local holding one,
 and now a store of a closure that can hand one back.

The mechanism is the same shape too.
`holder.callback = (): Row => config.row` is a store whose right side has no origins,
 because `effect-expression-provenance.ts` gives a function expression no provenance
 successors,
 so `parameterIndexes` comes back empty and the store records nothing.
Every earlier member of the class had a call where this has a closure.

What has to be recorded is the capture:
 the closure reaches `config.row`,
 the closure escapes,
 so the caller's row escapes.
What the closure DOES inside cannot matter,
 because whoever holds it decides that.
This one only reads,
 and returning a mutable `Row` from a deeply readonly parameter is enough,
 which is the same laundering that makes every falsification here compile.

The control is already measured and must not move:
 a closure assigned to a callable-local binding and invoked is not a store,
 `targetIsCallableLocal` answers that,
 and `invokeLocalClosureWriting` keeps its `mutated=[0]` through the ordinary active-body
 scan.

## What the escaping closure fix records, and two things it corrected on the way

The fix is at the store site.
`recordAssignmentStore` normalizes parentheses and assertions off the stored value,
 asks whether what remains is a callable,
 and hands it to `packagedCallableOrigins`,
 which is the same question the argument path already asks of a method or accessor authored
 inside a call-argument literal.
Handing a callable over by storing it differs from handing it over as an argument in who
 holds it,
 not in what it captured.

Two claims in the section above needed correcting once it was measured.

The first is
 "what the closure DOES inside cannot matter".
What cannot matter is **when** it runs,
 since the holder decides that.
What it does inside matters a great deal:
 a capture grants a write capability only if the body writes through it,
 hands it outward,
 or returns something carrying it.
`packagedCallableOrigins` does not ask,
 and names every binding a packaged body mentions whatever position it appears in,
 so a closure that only reads its capture withholds too.
Measured rather than assumed:
 `storeReadingClosure` stores `(): number => config.row.label.length` and records
 `opaque=[0]`.
That is the withholding direction,
 which costs precision and not soundness,
 and it matches what the argument path has always done.
Task #64 holds the question of whether the body can be summarised finely enough to keep such
 an offer.

The second is the control.
`invokeLocalClosureWriting` does keep `mutated=[0]`,
 and only in its declaration form.
The same closure reached through an assignment to an already-declared local records nothing
 at all:

```ts
export function invokeAssignedLocalClosureWriting(config: Config,): void {
  let local: (() => void) | undefined;
  local = (): void => {
    config.row
      .label = 'written';
  };
  local();
}
```

The store path is not the cause.
`targetIsCallableLocal` answers for both forms,
 so `recordAssignmentStore` returns early either way,
 which is correct:
 a binding the callable owns is not a store.
The difference is in which closures `closure-activity.ts` selects as active.
Self-limiting rather than unsound,
 since `config` is written directly in the same file and the offered annotation stops
 type-checking,
 so no falsification rides on it.
Tracked as task #65,
 and it is the twentieth offer in the fixture.

### What the caller measurement settled

The reading shape falsifies and the writing shape does not,
 so the writing shape's unrecorded write looked like a second hole owed a second fix:
 `storeCapturingClosureWriting` records no `mutated` slot,
 and `mutated` is what feeds callers through the call edge.

It is not a second hole.
`passToCapturingStore` hands its own parameter to `storeCapturingClosure` and writes nothing
 itself,
 so the only thing that can withhold its offer is the callee's slot arriving through the
 edge.
It records `opaque=[0]` carrying the callee's store provenance.
The capture record reaches callers through the retention channel,
 which is the channel a store is supposed to use,
 and the mutation channel is not needed for it.

### The mutation check

Two mutants,
 each killed by a different assertion,
 which is what makes the fixtures separable rather than redundant.

Removing the wrapper normalization fails `storeWrappedCapturingClosure` alone and moves the
 fixture offer count from twenty to twenty-one.
Every bare shape stays `[0]`,
 so the normalization has exactly one witness and that witness tests only it.

Recording nothing in the closure branch fails `storeCapturingClosure` and moves the count
 from twenty to twenty-five,
 restoring precisely the five shapes the fix withholds.

### The sweep criterion, registered before the capture is read

This fix adds attribution,
 so the direction it can move the workspace is offers falling and argument opacity rising.

The baseline is `sweep-after-46-spread.txt`,
 captured at `a7b8675ca`,
 and it is chosen by modification time rather than by the tidiest name.
The obvious candidate,
 `sweep-after-45-reverted`,
 carries the same 1939 findings and is four captures stale:
 task forty-six moved three locations in each direction,
 leaving the total unchanged and the contents not,
 and tasks forty-eight,
 forty-nine,
 fifty and fifty-five all captured after it.
Diffing against the stale one would surface those and invite sampling another change as a
 closure capture.

Store retention is filtered from the reportable set,
 so a capture emits nothing at all.
It does not recategorize a finding;
 it deletes one.
The signature to look for is therefore exact:
 offers down by some count,
 the total down by that same count,
 and every other category unchanged.

Three outcomes are defects rather than findings,
 and each says which mechanism broke.

Argument opacity or receiver opacity moving at all means a retention entry reached the
 boundary list,
 which is the task fifty-five split failing.

Any offer that rose is unsound and immediate,
 since this change only adds attribution.

An offer that fell without a genuine escaping-closure capture behind it,
 meaning a callable that stores a closure past its own body where the closure names a
 parameter,
 is over-withholding that has to be explained before it is accepted.

Zero delta is the expected outcome and is not evidence of anything.
Two separate reasons,
 and only the first is about scale.
Of the 1939 findings in the baseline,
 1864 are already opacity and only 32 are offers,
 so a withholding fix has almost nowhere to act.
The second is about form:
 what this covers is the bare `holder.callback = (): Row => config.row`,
 and real code more often writes the alias,
 `const handler = ...` followed by `target.on = handler`,
 which is task #66 and is not covered.
A zero here is evidence about one syntactic form,
 never about whether escaping closures matter in this repository.

### The capture did not come back zero, and the movement is not about closures

```text
before 1939: argument-opacity=1197 receiver-opacity=667 dishonest=37 offer=32 stale-mutates=6
after  1966: argument-opacity=1227 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   83: argument-opacity=80 receiver-opacity=3
removed 56: argument-opacity=50 receiver-opacity=6
```

By the registered criterion this is a defect signature,
 since argument opacity moved and offers did not.
It is not being read that way yet,
 because the shape of the movement says something the criterion did not anticipate.

Of the eighty added argument-opacity findings,
 none names an external package boundary and seventy-nine name a local one.
Of the fifty removed,
 forty-three name an external package boundary and six name a local one.
The names that arrived are `spawn`,
 `getRouterParam`,
 `nanoSpawn`,
 `defineTool`,
 `serveStatic`,
 `defineConfig`,
 across packages with no stored closure anywhere near them.
The names that left are `nano-spawn@2.1.0 . default`,
 `valibot@1.4.2 . parse`,
 `@msgpack/msgpack@3.1.3 . encode`,
 `h3@2.0.1-rc.26 . serveStatic`.

So a boundary that was reported by package and export is now reported by the name at its
 call site.
That is a reporting-identity change of exactly the kind task forty-seven already
 characterised,
 and a store-provenance record cannot produce it:
 the fix calls `addOpaqueEffect` with retention provenance and nothing else,
 and retention is filtered from the reportable set.

The suspect is cache generation rather than code.
The cache key hashes analyzer implementation bytes,
 so this change minted a fresh identity and the run was cold,
 while the baseline ran against a populated one.
Counted on disk:
 the new identity holds 1184 entries written at the moment this sweep started,
 and the two identities before it hold 27 and 22.

Two runs settle it,
 and neither is an argument.
A warm repeat at the same commit says whether the reading is reproducible at all.
Then the same sweep with the closure branch disabled,
 which is the mutant the mutation check already used,
 says whether any of the movement is attributable to this change.
Only the second answers the question,
 because a reproducible reading can still be a reading of something other than the fix.

### The reading is reproducible, and cache warmth is not what moved it

The warm repeat at the same commit came back identical:
 1966 findings,
 the same per-category tally,
 nothing added and nothing removed.
Wall clock fell from 8m16s to 3m00s,
 which is the only thing the cache changed.

So the cache-generation suspicion is refuted for results and confirmed for cost,
 which is the second time in this session that sweep wall clock has turned out to measure
 something other than the work.
Cold and warm agree on every finding.

That leaves the movement attributable either to this change or to something that differs
 between the baseline capture and now,
 and only the disabled-branch run separates those.

### A gap in the sweep discipline, found while trying to use it

The discipline recorded so far covers what must not happen during a sweep:
 no rebuilds,
 no edits to any file it lints.
It says nothing about what must be recorded alongside one,
 and the attempt to attribute this movement ran straight into that.

The baseline capture has no artifact digest beside it.
Digests exist in the scratch directory for four earlier points,
 the most recent almost three hours before the baseline was taken,
 so what the baseline actually ran is unverifiable after the fact.
Since two artifacts have to be rebuilt in order,
 and a sweep silently uses whichever sidecar is on disk,
 a capture without digests cannot be told apart from a capture taken against a stale one.

So a capture is not a measurement unless it records,
 beside its output:
 the commit,
 the digest of the plugin bundle,
 and the digest of the sidecar oxlint loads.
Wall clock is not on that list,
 having failed twice now as an instrument.

This one records all three,
 which is why the disabled-branch run can be compared to it at all.

### The helper over-approximates further than the fix's own comment says

A stronger model read `effect-packaged-callable-origins.ts` and corrected the description
 recorded beside the fix.
The scan is not over the stored callable's body.
It is over the complete subtree,
 nested callable bodies included,
 so a callable authored inside the stored one contributes even when nothing can ever reach
 it:

```ts
holder.callback = (): number => {
  const unreachable = (): Row => config.row;
  return 0;
};
```

That is still the withholding direction,
 and it is still what the argument path has always done,
 so nothing about the landed fix changes.
It sharpens task sixty-four,
 which now has two distinct over-approximations to answer for rather than one:
 naming a binding a read-only body merely mentions,
 and naming one reachable only through a nested callable nothing invokes.

The same reading also found a defect in activation discovery that has nothing to do with
 stores,
 recorded as task seventy.
`activeCallableBodyNodes` walks every node in the body when looking for activations,
 with nothing restricting the walk to the outer body and to closures already proven active,
 so a call written inside a closure that never runs activates its target anyway.
The shape that shows it is the sibling-call shape from task sixty-eight,
 where the stored arrow is correctly inactive,
 its `read()` is visited anyway,
 and `read`'s own `return config.row` is then processed as though the outer callable had
 returned it.
One node,
 wrong in both directions at once:
 a returned origin the outer callable never wrote,
 beside a capture still missed.

### The movement is not this change, and the baseline is what has to be explained

With the closure branch disabled and nothing else altered,
 the sweep is identical to the enabled one:

```text
before 1966: argument-opacity=1227 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1966: argument-opacity=1227 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

The same disabled run still differs from the baseline by exactly the original 83 added and
 56 removed.
So this change contributes nothing to the workspace,
 which is the outcome the registered criterion expected,
 arrived at by a route the criterion did not anticipate:
 not a zero delta,
 but a delta that survives removing the thing under test.

That reverses which side is under suspicion.
No code changed between the baseline capture and these runs except this fix,
 and this fix demonstrably changes nothing,
 so a capture taken at that commit should have read 1966.
It read 1939.

The standing hypothesis is the two-artifact hazard the discipline already names:
 the plugin bundle and the sidecar oxlint actually loads are separate builds,
 a sweep silently uses whichever sidecar is on disk,
 and the baseline has no digest recorded to rule it out.
That fits the shape of the delta,
 which is boundaries reported by package and export becoming boundaries reported by the name
 at their call site,
 across packages unrelated to any of this work.

Running now:
 the exact pre-fix source restored from `06fc7bce3`,
 both artifacts rebuilt in order,
 digests recorded beside the capture.
If it reads 1966,
 the baseline was stale and 1966 is the standing number,
 which means several earlier captures in this document were compared against a number that
 did not describe the code they claimed to measure.
If it reads 1939,
 something in this commit other than the disabled branch moved the workspace,
 and the only candidates left are the import edits and the early return the mutant kept.

### It read 1966, so the standing baseline was measuring something else

Four runs now agree,
 and they span both code states and both cache states:

```text
this fix, cold cache                    1966   8m16s
this fix, warm cache                    1966   3m00s
closure branch disabled                 1966   8m13s
exact pre-fix source from 06fc7bce3     1966   8m12s
```

The last of those is the one that settles it.
It restores the file byte for byte from the commit before the fix,
 rebuilds the plugin bundle and then the sidecar,
 and records both digests beside the capture.
It reads 1966 and differs from the baseline by the same 83 and 56.

So 1939 is not a reading of the code that commit contained.
It is not reproducible from that source,
 from this source,
 warm or cold,
 and the number the workspace actually produces on either side of this change is 1966.

The delta's own shape says what kind of error it was.
Forty-two files appear in both the added and the removed set,
 which is one finding whose boundary changed name rather than a finding gained beside a
 finding lost.
Boundaries reported by package and export became boundaries reported by the name at their
 call site,
 concentrated in particular packages rather than spread evenly.
That is what a capture blended across two analyzer versions looks like:
 whichever module a worker loaded decided how that worker's files reported,
 and the recorded incident of a sidecar rebuilt three minutes into a running sweep is
 exactly how such a blend gets made.

The honest scope of this.
Every conclusion in this document that rested on comparing against 1939 rested on a number
 that does not describe the code it named,
 and the affected captures are the ones reading 1939:
 the reverted forty-five capture,
 the four stage captures for forty-eight,
 and the spread capture for forty-six.
What survives is the reasoning that never depended on the absolute number,
 which is most of it:
 the fixture measurements,
 the falsifications,
 the mutation checks,
 and the per-finding sampling of what moved.
What does not survive is any claim of the form "the workspace did not move",
 because a comparison against an unreproducible number cannot establish that.

The new baseline is `sweep-51-prefix.txt`,
 which is the pre-fix source with both artifacts rebuilt in order,
 with `sweep-51-prefix.digest` beside it naming the commit and both digests.
That is the first capture in this document that can be checked afterwards rather than
 trusted.

The discipline gains one more line from this,
 beyond recording digests.
A capture disagreeing with expectation is not evidence about the change until the change has
 been removed and the capture repeated,
 because a delta that survives removing the thing under test was never about it.

## Six more false offers of the same class, all falsified at once

The shapes staged after the escaping-closure fix landed were measured before anything was
 built on them,
 which is what the previous section's lesson asks for.
All six record nothing:

```text
storeAliasedClosure          mut=[] ret=[] opq=[]
storeConditionalClosure      mut=[] ret=[] opq=[]
storeAliasedContainer        mut=[] ret=[] opq=[]
storeClosureCallingSibling   mut=[] ret=[] opq=[]
returnCapturingClosure       mut=[] ret=[] opq=[]
handOverCapture              mut=[] ret=[] opq=[]
```

Three shapes were already covered,
 and one of them is the control that makes task sixty-nine precise:

```text
retain                       opq=[0]  stored into holder.produce
retainBox                    opq=[0]  stored into holder.box
handOverPackagedCapture      opq=[0]  stored into holder.box
```

`handOverPackagedCapture` hands the same capture inside an object literal and inherits the
 callee's store provenance through the call edge.
`handOverCapture` hands it as a bare function expression and inherits nothing.
So the hole is not about arguments,
 and not about retaining callees:
 it is about a function expression handed directly,
 which is not a packaged literal and so never reaches the helper that would read it.

At the oxlint boundary all six are offered,
 and the three covered shapes are not,
 so the reading is of the rule rather than of the summaries.

Falsified together,
 with every offer in the file applied,
 type-checked,
 and driven:

```text
alias:       changed-by-alias
conditional: changed-by-conditional
container:   changed-by-container
sibling:     changed-by-sibling
return:      changed-by-return
handover:    changed-by-handover
```

The control in the same file is what makes that meaningful.
`annotationBites` carries a `@ts-expect-error` over `config.row.label = 'written'`,
 and the directive is satisfied,
 so `ReadonlyDeep` resolved and did reject a write in this exact file.
Every other function type-checking clean is therefore a fact about those functions rather
 than about an inert annotation.

One of the six changes what its task is.
Task sixty-seven was filed as a question about an accepted decision,
 on the reading that returning parameter-reachable state is permitted policy.
It is permitted on a stated condition,
 that callers keep tracking the value through recorded returned origins,
 and `returnCapturingClosure` records `ret=[]`.
The condition fails,
 so this is a false offer rather than a policy boundary,
 and it needs a fix rather than a decision.

## The capture channel, and the gate a review talked me out of

Task sixty-nine is fixed by carrying what a handed callable captured across the owned call
 edge.
The captures are recorded per formal at edge build time,
 where the syntax is visible,
 and consumed in the fixed point,
 which is where the callee's summary exists.
They are kept beside the ordinary origins rather than folded into them,
 because the two license different conclusions:
 an ordinary origin says the callee received the caller's value,
 so a write or a return the callee records is a fact about it,
 while a capture says only that running the callable can reach the parameter.

Folding them together also had a measured cost.
`parameterIndexes` feeds the unresolved boundary as well as owned edges,
 so a bare function-like branch there would have withheld on
 `rows.map((row) => config.row.label,)` against any callee this analysis cannot resolve.
On the owned edge that question never arises,
 because an unresolved call builds no edge to defer anything onto.

### The gate is the callee's uncertainty, not its reason

My first design gated admission on retention provenance:
 attribute the captures only where the callee's opacity says `stored into`.
A stronger model rejected it as unsound and was right.

```ts
export function relayCallable(relayed: () => Row,): void {
  queueMicrotask(relayed,);
}
```

`relayCallable` stores nothing,
 so it carries no retention provenance at all;
 measured, it carries `queueMicrotask`.
Whatever it forwarded to may keep the callable and invoke it whenever it likes.
Absent retention provenance means call-caused or unknown,
 never proven non-retaining,
 so the retention gate would have let a caller of this keep its offer.

The gate is therefore membership in the callee's opaque set,
 which is exactly the callee saying it could not account for that formal.
The provenance is then copied unchanged rather than decided again,
 which is what makes one channel produce two messages:
 a capture reaching a callee that stored it arrives with store provenance and stays silent,
 because a reader cannot act on it,
 and one reaching a callee that could not inspect its own callee arrives with that call
 named,
 which is precisely what a reader can act on.

The broader gate also covered a shape the narrow one missed for free.
`storeResult`, which does `sink.push(callback(),)`, carries `sink.push` rather than
 retention,
 and its caller is now withheld too.
That shape had been scoped out as task fifty-two's and turned out to need nothing extra.

### The mutant that survived

Two mutants, and the second is the one worth recording.

Emptying the captures on the edge fails `handCaptureToRetainer` immediately.

Restoring the retention-only gate **passed the entire suite**.
Every fixture written for this change,
 every control,
 both diagnostic-level assertions,
 all green,
 while the analyzer carried a gate a review had already shown to be unsound.
Nothing measured the design decision the whole change rests on.

`relayCallable` and `handCaptureToRelay` exist for that reason,
 and with them the mutant dies on one line and only that line.
This is the same lesson as the four post-landing defects recorded earlier,
 arriving one layer higher:
 a mutation check asks whether the assertions discriminate the mechanism they name,
 and no assertion named this one.

### The sweep criterion, revised before the capture is read

The criterion registered for task fifty-one does not transfer,
 and saying so before running is the point of registering one.
That change could only delete findings,
 so any rise in argument opacity was a defect.
This change can legitimately add them:
 a caller handing a capturing closure to a forwarding callee inherits a call-caused cause and
 speaks,
 exactly as `handCaptureToRelay` does in the fixture.

So, against `sweep-51-prefix.txt` at 1966,
 with digests recorded on both sides:

Offers may fall,
 and every fall must be sampled to a callable handed to an owned callee whose formal that
 callee could not account for.

Argument opacity may rise,
 and only by findings whose parameter also lost an offer,
 naming the boundary the callee named.
A rise on a parameter that never had an offer is a defect,
 since this channel only ever adds opacity to something previously clean.

Receiver opacity must not move at all,
 because nothing here touches receivers.
Dishonest and stale-mutates must not move either.

### The capture, and a criterion I wrote too tightly

```text
before 1966: argument-opacity=1227 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   3: argument-opacity=3
removed 2: argument-opacity=2
```

Both baselines carry digests,
 so this is the first comparison in this document where each side can be checked rather than
 trusted.

Receiver opacity,
 dishonest and stale-mutates all held still,
 as registered.
Offers held still too,
 which the criterion allowed.

Two of the three additions are not additions.
`it.ts:392` on `opts` and `matrix.ts:428` on `combination` were already opaque naming
 `Promise.race`,
 and they now also name `run({ effectiveConcurrency: DEFAULT_CONCURRENCY, },).then`.
Same file,
 same line,
 same parameter,
 one more cause in the list,
 which the comparison necessarily reports as one removed beside one added.
A parameter that was already withheld gained a reason,
 and no offer moved.

The third is real,
 and it is the shape this channel was built for:

```ts
function waitForExit(handle: SpawnedChildHandle,): Promise<ExitResult> {
  return new Promise(function captureExit(resolve,) {
    handle.once('exit', function onExitForPromise(code, signal,) {
      resolve({ code, signal, },);
    },);
  });
}
```

`onExitForPromise` captures `resolve` and is handed to `handle.once`,
 which is a bodyless callable this analysis cannot inspect,
 and an event listener is precisely a callee that keeps what it is given.
So `resolve` escapes,
 the report is true,
 and it names the boundary responsible.

It violates the criterion as I wrote it.
I registered that a rise on a parameter that never had an offer is a defect,
 reasoning that this channel only converts offered into withheld.
That reasoning assumed every capture lands on a parameter that could be offered,
 and `resolve` cannot be:
 it is callable-typed,
 so its classification is an opaque capability and no offer was ever available to lose.
The channel converted it from silent to speaking rather than from offered to withheld,
 which the criterion had no case for.

The criterion was mis-specified,
 and that is a different thing from the finding being wrong.
What the criterion was really guarding is intact and is worth stating in the form it should
 have taken:
 nothing became more permissive.
Offers did not move,
 every change adds opacity rather than removing it,
 and the one genuinely new report is true at its own source.

The cost is one new message in 1967 on a parameter no reader can act on by annotating,
 which is noise rather than a defect,
 and it belongs to a question wider than this change:
 whether opacity should report at all on a parameter whose classification can never carry an
 offer.
That question is not opened here.

### The sweep criterion, in the form it should have had

Two changes in a row have now needed a criterion,
 and the second one showed the first was written around an accident of its own change.
The reusable form drops the coupling between offers and opacity entirely:

Offers must not rise.
That is the soundness statement,
 and it is the only one that matters:
 every fix in this class adds attribution,
 so an offer appearing means attribution was lost.

No category other than argument opacity may move.
Receiver opacity,
 dishonest,
 stale-mutates,
 host-capability and the rest are untouched by any of this work,
 and one of them moving means a change reached further than its author thought.

Offers falling is expected and each fall is sampled to its cause.

Argument opacity rising is expected and is **not** required to accompany an offer loss.
That requirement is what the previous criterion got wrong,
 and it fails whenever a capture lands on a parameter that could never be offered,
 which will keep happening:
 a callable-typed parameter is classified an opaque capability and has no offer to lose.

## The store side of the same resolution

`callbackHolder.produce = producer` is what ordinary source writes where every fixture so far
 wrote the closure inline,
 and it recorded nothing:
 the gate tested syntax and saw an identifier,
 while `parameterIndexes` found nothing either,
 because a local bound to a function expression carries no parameter origin.
Falsified with the annotation applied and type checking clean.

The fix is one substitution.
`recordAssignmentStore` resolves the stored value with `callableDeclaration` rather than
 testing `isFunctionLikeDeclaration`,
 which is the same resolution the call edge already uses for a handed callable,
 follows a local to the function expression it was bound to,
 and detects alias cycles.

Two of task sixty-six's three shapes remain,
 measured empty after the fix:
 the conditional and the container held in a local.
Those need the value-source walk rather than another syntax branch,
 which is the whole point of the task,
 and the two relations it needs are recorded on it.

The risk this change carries is not the alias.
`callableDeclaration` resolves identifiers,
 so a module-level or imported callable stored outward now has its body scanned.
Out of scope symbols are absent from the origin map and contribute nothing,
 which makes that harmless for parameters,
 and the case worth watching is a nested callable stored outward,
 whose resolved body does name symbols the enclosing callable owns.
That is a genuine capture and should attribute,
 but it is the direction where this reaches furthest,
 so the sweep is run on this change alone rather than batched with the next.

It moved the workspace by nothing:
 1967 before and after,
 no category touched,
 offers unchanged.
Which says the aliased store does not occur in this repository in a shape that was still
 offered,
 and says nothing about whether the shape matters,
 exactly as the zero for the escaping closure did.

## A returned callable breaks a precondition rather than falling under a policy

The accepted decision permits returning parameter-reachable state,
 and it names the condition that makes that sound:
 callers keep tracking the value through recorded returned origins.
`return config.row` satisfies it.
`return (): Row => config.row` does not,
 because a function expression has no provenance successors,
 so nothing is recorded and no caller can substitute through it.

That distinction is the whole finding.
Running the shape and watching the caller's row change does not by itself separate it from the
 direct return,
 which the decision treats as benign and which can also expose a mutable row.
What separates them is that one is tracked and one is not.

### Opacity, not a returned origin

The reuse was tempting and is wrong.
A returned origin asserts that a caller can reach these parameters through this result.
What a returned closure carries is the capability to reach them by invoking it,
 which is a different relation,
 and `packagedCallableOrigins` over-approximates by scanning the complete subtree.

An over-approximation is safe on a channel that withholds and unsafe on one that claims.

Checked rather than assumed:
 under today's consumers an over-approximated returned set cannot produce a false offer,
 because every consumer is monotone and `effect-result-substitution.ts` states the invariant
 that nothing discharges on the strength of a returned set being empty.
So the objection is not that the reuse breaks now.
It is that it states the wrong relation,
 and becomes unsound the day a consumer treats presence in `returned` as authority to
 discharge.

### Three fixtures, and the third is the one that matters

`returnCapturingClosure` withholds.
`returnFreshClosure` returns a closure naming nothing the caller owns and keeps its offer,
 so this attributes captures rather than refusing returns.

`returnRowDirectly` returns caller state directly and keeps its offer.
That one is not a control on this change at all;
 it is the accepted policy working,
 and without it the change reads as a rule against returning caller state,
 which is precisely what the decision permits.

### What the mutants proved

Recording nothing fails the new assertion and the broad effects assertion together.

Scanning the returned expression without resolving it first fails widely:
 sixteen diagnostics become nine in one fixture and a local transfer stops discharging,
 because treating every returned expression as a callable body attributes almost everything to
 almost everything.
The resolver is load-bearing rather than decorative.

### One existing expectation moved, and why it is not a regression

`returnedClosureSemanticEffect` in the sync-adapter fixture returns a closure that writes
 through its capture.
It recorded `mutated=[0]` and now records `opaque=[0]` beside it.

Redundant there and load-bearing next door:
 the active-body scan already attributed that write,
 while a returned closure that only hands the capture back records no mutation and nothing
 else would withhold it.

Nothing a reader sees changed.
A mutation withholds silently and a retention withholds silently,
 and that callable emits no diagnostic before or after,
 which was checked at the oxlint boundary rather than reasoned about.

### What this fix does not close

A stronger model read the helper and the store path and named four shapes that carry the same
 capture past the new gate.
None was measured yet,
 so each is filed as a shape to measure and falsify rather than as a known defect,
 and none of them makes the landed fix wrong.
They make it partial,
 which is worth writing down here because a green suite and a killed mutant say nothing about
 syntax no fixture contains.

The callable alias,
 task #66:

```ts
const callback = (): Row => config.row;
holder.callback = callback;
```

The gate asks whether the stored value is syntactically a callable,
 and this stores an identifier.
`parameterIndexes` does not rescue it either,
 because a local bound to a function expression carries no parameter origin,
 for the same reason the bare store needed this fix at all.
A conditional and a container held in a local ride along with it.

The sibling call,
 task #68:

```ts
const read = (): Row => config.row;
holder.callback = (): Row => read();
```

`packagedCallableOrigins` is lexical.
It names every binding the stored body mentions and follows no call out of it,
 so the capture leaves through a callable the scan never enters.
This is the same cause as the over-reporting in task #64,
 pointing the other way:
 a lexical scanner answering a call-graph question is wrong in both directions at once.

The retaining callee,
 task #69,
 where `retain` stores its own parameter and the caller hands it a bare function expression.
The callee half should now record opacity;
 the caller half has to map that formal back through a direct function argument,
 which is not a packaged literal.

The returned closure,
 task #67,
 which is not the same question as the other three.
See also "Where the queue stands",
 whose reading of task forty-eight applies here word for word:
 closing a task is a statement about the shapes it measured,
 never about the class of defect it belongs to.
Returning parameter-reachable state is governed by an accepted decision that permits it on a
 stated condition:
 that callers keep tracking the value through the recorded returned origins.
A returned closure looks like it breaks the condition rather than falling under the policy,
 since a function expression has no provenance successors and so contributes no returned
 origin.
That is a measurement to run before it is an argument,
 and a change there touches a decision rather than a hole.

### The capture, and what three zeros in a row mean

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

Offers did not rise and no category moved,
 which is the criterion in its reusable form,
 satisfied.

Three of the last four sweeps came back at zero:
 the escaping closure,
 the aliased store,
 and now the returned callable.
Only the handed-argument capture moved anything,
 and it moved by one true finding.

That pattern is worth naming rather than repeating,
 and the reading I gave it three times was wrong in a way worth correcting rather than
 quietly dropping.

I wrote that a zero means the shape is absent from this repository in a still-offered form.
That has an untested branch.
Of 1967 findings only 32 are offers,
 so 1935 parameters are already withheld for some other reason,
 and a shape that occurs constantly but always lands on an already-withheld parameter produces
 exactly the same zero as a shape that never occurs at all.
The sweep cannot tell those apart,
 and I drew the absent reading from it three times without checking which one it was.

Counting the syntax rather than the findings settles it,
 and the shapes are common:

```text
25   store of a function expression into a property or element target
37   return of a function expression
356  store of an identifier into a property or element target
```

Those are lower bounds,
 anchored to line starts,
 so multi-line forms are missed.
Sampled to confirm they are real rather than pattern noise:
 `runtime.appendEntry = function appendDisposableEntry(`,
 `editor.onSubmit = function submitRejection(reason,)`,
 `request.onupgradeneeded = function createBatchStore()`,
 and returns like `return function expandApplyNode(node,)`.

So the shapes this work covers occur dozens of times in this workspace.
The zeros say those occurrences capture no parameter,
 or capture parameters that were already withheld,
 which is a statement about the offer population rather than about the syntax.
None of it is evidence that the fixes are unnecessary,
 and none of it is evidence that they are correct.

What carries the correctness in every one of these is the falsification:
 the rule produced the annotation,
 the annotation was applied and type-checked clean beside a control proving it was live,
 and a driver observed the caller's state change.
The sweep only ever answered a different question,
 which is what the change costs everything else.

## A lexical scanner answering a call-graph question, fixed in both directions

The capture walk follows calls now.

```ts
const read = (): Row => config.row;
holder.produce = (): Row => read();
```

The stored arrow names only `read`, and a local bound to a function expression carries no
 parameter origin,
 so the lexical scan came back empty and the parameter was offered.
Falsified: annotation applied, type-checked clean beside a control whose direct write was
 rejected, driver changed the caller's row.

This is the same defect as the over-reporting recorded against task sixty-four,
 pointing the other way.
One scanner was answering a question about a call graph by reading names,
 so it was wrong twice at once:
 naming bindings a read-only body merely mentions,
 and missing captures that leave through a call.

Applied at all three capture sites rather than one,
 because they ask the same question and fixing one would have looked correct while the identical
 shape stayed invisible next door.
Deliberately not applied to `parameterIndexes`,
 which feeds the unresolved boundary,
 where over-approximating withholds on ordinary `map` and `filter` code.

### The second surviving mutant, and a claim of mine that was backwards

Deleting the call-following fails immediately.

Deleting the **source-file bound** survived the entire suite.

The first surviving mutant this session exposed a design decision nothing measured,
 and the answer was a new fixture.
This one is different,
 and the answer is a correction.
The module claimed the bound was "a soundness condition rather than a budget".
That is backwards.

`packagedCallableOrigins` resolves each named binding to a symbol and looks it up in the origin
 map of the callable being summarised.
A cross-file callee's body names its own symbols,
 absent from that map,
 so following it contributes nothing.
It also loses nothing,
 because a callable able to capture those bindings is written inside the callable that owns them
 and therefore shares its file.

So the bound skips work whose answer it cannot change.
No assertion can defend it,
 the mutant was right to survive,
 and the cost it avoids is unmeasured.
Wall clock is the obvious instrument and has already failed twice here,
 so the honest record is that the bound is justified by the mechanism and not by a measurement.

### The control no assertion could otherwise provide

`storeMutuallyRecursiveClosures` pairs two nested callables that call each other,
 with the capture in the second.
It is the termination control,
 and it is unlike every other fixture in this work:
 a walk that failed to terminate would hang rather than answer wrongly,
 so no ordinary assertion could catch it.
What makes the fixture a test is that the suite completes at all.

### The capture

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

Offers did not rise and no category moved.
Read against the corrected reading of a zero:
 the syntax count says stores and returns of callables occur dozens of times here,
 so the sibling-call form of them either does not occur or lands on parameters already
 withheld.

Wall clock came in at 8m03s against 8m13s for the previous capture,
 which is faster while doing strictly more work.
That is the third time wall clock has moved in the wrong direction here and it remains retired.

## Asking what a stored value can be, rather than how it is written

The last two shapes of task sixty-six needed one change, not two.

```ts
holder.produce = condition ? ((): Row => config.row) : fallback;

const box = { produce: (): Row => config.row, };
holder.box = box;
```

The store path tested syntax, so the first looked like a conditional and the second like an
 identifier,
 and neither was examined.
Both falsified.

One walk answers both, and the callers then ask their own questions of each answer:
 whether it is a callable handing captures over,
 or what origins it packages.
It follows transparent wrappers,
 both branches of a conditional,
 both operands of nullish and disjunction,
 the right operand of conjunction and assignment and comma,
 and an identifier to the initializer it was bound to.
It refuses calls,
 conditions,
 assignment targets,
 computed keys,
 discarded operands and nested callable bodies,
 none of which is a value the expression evaluates to.

Additive rather than substitutive:
 every node answers with itself as well as with what it can be followed to,
 so a caller that already handled the written form keeps handling it.

One result was not designed for and is right anyway.
`storeCoalescedClosure` withholds both its parameters,
 because storing a caller-supplied callable outward retains it exactly as storing a closure over
 caller state does.

### Three surviving mutants, three different resolutions

Worth collecting, because they are not the same lesson.

Task sixty-nine's surviving mutant restored a gate a review had already shown unsound,
 and passed everything.
The design was right and nothing measured it.
Resolution: a new fixture, `relayCallable`.

Task sixty-eight's surviving mutant deleted the source-file bound,
 and passed everything.
The code was right and my account of why was backwards:
 a cost bound described as a soundness condition.
Resolution: correct the claim, and record that no assertion can defend it.

Task sixty-six's surviving mutant treated nullish coalescence as right-operand-only,
 and passed everything,
 because the coalescence fixture happened to put its capture on the right.
Resolution: a fixture putting it on the left,
 built so the origin walk cannot reach it either,
 which took a binding bound to a conditional holding an arrow.

The common thread is that a green suite says nothing about a rule no fixture exercises,
 and that a mutation check is the only instrument here that finds those.
The differing thread is what a survivor means:
 sometimes the test is missing,
 and sometimes the explanation is wrong.

### The capture

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

Offers did not rise and no category moved.

## A change that measured as dead code, and was reverted rather than landed

Task sixty-five's cause was known precisely:
 `getResolvedSignature` on `local()` answers with the signature of the declared function type
 rather than with the arrow assigned into the binding,
 so the arrow's key never reaches `activeKeys` and its write is filtered out.

The fix looked obvious once the possible-value walk existed.
Resolve the call target through it,
 activate whatever nested callables it names,
 and leave assignment right sides alone,
 since activating those would treat storing a closure as running it.

Measured, it changes nothing.

Two shapes were written to exercise it,
 a closure bound by a conditional and one reached through an alias,
 and both already recorded `mutated=[0]` before the change and after it.
`getResolvedSignature` answers for any binding with an initializer,
 however that initializer is written.

So the change was dead code and is reverted.
Landing it would have added a path no shape reaches,
 documented as a fix for a defect it does not fix,
 which is worse than leaving the defect recorded.

What remains unreached is exactly the binding filled by assignment after its declaration,
 and reaching it needs a relation this analysis does not have:
 the values assigned to a binding, not merely the one it was declared with.
The possible-value walk refuses that on purpose and says so,
 because what such a binding can be is not written where it is declared.

Left open with both sides recorded.
The shape is self-limiting,
 since the write is on the parameter directly and the offered annotation stops type-checking,
 so no falsification rides on it and the work it would take is not justified yet.

## Hunting shapes instead of working a queue, and what it found immediately

The queue was built from defects as they surfaced.
Walking the escape channels on purpose found three more in one pass,
 and the method is worth recording because it is cheaper than the queue was.

Write one file where **every** parameter genuinely leaks,
 each through a different channel,
 each with a unique name.
Then any offer the file draws is a false offer by construction,
 and oxlint names them without any reasoning about the analyzer at all.
Two controls that must still be offered keep the file honest.

Fourteen channels, and the file drew six offers.
Two were the controls.
Four were candidates:
 a construction,
 a yield,
 an async return,
 and a callback parameter named `row` inside an iteration.

Then the ordinary bar: apply every offer, type-check, drive.

```text
constructor: changed-by-constructor
generator:   changed-by-generator
promise:     changed-by-promise
```

### Two channels answered by nothing at all

`NewExpression` appeared nowhere in this analysis.
Not in the call-edge builder, not in the store path, not in the origin walk.
A construction is not a call edge, not a store and not a return,
 so a row handed to a constructor that keeps it in a private field was invisible.

`YieldExpression` appeared once, in `effect-result-escape.ts`,
 where a result's escape is classified,
 and never where a return records its origins.
A yield hands its value to whoever drives the iterator,
 and that driver outlives the yield by construction.

Both take opacity.
Both are handoffs rather than stores,
 which is why they got a third provenance prefix instead of borrowing the store one;
 `stored into a construction of RowKeeper` reads as a store into the construction.

Constructions are everywhere in this workspace,
 so this is the first change in this work where a large offer fall would be plausible rather
 than surprising.

### The third was not a withholding

`resolveRow` records `returned=[0]`.
It is tracked, which means it is the return the accepted decision permits,
 exactly like `returnRowDirectly`,
 and treating it as a new false offer would have been wrong.

The defect is one layer over, and measuring the caller settled it:

```text
writeThroughSync    mut=[0]
writeThroughAwait   mut=[]
```

Substitution does not follow an await.
So the decision's precondition, that callers keep tracking the value,
 was failing for every async return in the workspace,
 which is the same argument that made the returned closure a false offer.

The fix is therefore a tracking repair rather than a withholding:
 `await` joins the transparent forms in the walk that finds a write's target,
 because what an await yields is whatever the awaited promise resolved to,
 which is what the callee handed back.
That is the only question the walk asks.

`returnRowAsync` keeps its offer, and should.
`writeThroughAwaitedRow` now records `mutated=[0]`, matching its synchronous twin.

### What the mutants proved

Each of the three dies on its own assertion.
Removing the await from the transparent forms moves the fixture offer count from thirty to
 thirty-one,
 which is the async caller getting its offer back,
 and is the cleanest possible statement of what that one line does.

### The capture, and the first offer this work has moved in the workspace

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
added   0:
removed 1: offer=1
```

One offer fell, nothing else moved, nothing rose.
That is the registered signature exactly,
 and it is the first time in this work that an offer has moved at all.

Sampled, as the criterion requires.
`collectIgnoredKeys` in `package/pi-plugin/search-fetch/src/tools.ts`,
 and the cause is `new Set(supportedKeys,)` where `supportedKeys` is `readonly string[]`.

The rule is working as designed.
An array is an object, so the leaf test answers yes for the parameter as a whole even though
 its elements are primitives,
 and a construction then records opacity because retaining its argument is what a constructor
 usually does.

`Set` is not one of those.
It iterates its argument and copies elements,
 retaining the elements rather than the array,
 and here the elements are strings.

So the fall is over-withholding in the safe direction,
 one offer in 1966,
 and it does not block the channel.
Recorded as task seventy-four,
 whose first move is not a catalog of trusted constructor names,
 which the catalog-free architecture forbids,
 but a cheaper question:
 gate the construction rule on whether the argument's elements can carry mutable state rather
 than the argument itself.
That clears `readonly string[]` while `new Set(config.rows,)` keeps withholding,
 because those rows alias.

An error worth recording beside the result.
The first comparison of this capture was run against a partial file:
 the `.time` file was still empty because the sweep was still going,
 and the shell chain read the incomplete output anyway and reported every finding removed.
Nothing was wrong with the sweep.
A capture is not a capture until the run that produces it has ended,
 and a comparison against a file still being written is a reading of nothing.

## One cause behind eight queue tasks

Applying the measure-first pass to the **queue** rather than to new channels resolved most of it
 at once, which is worth recording as method: the tasks had been filed one defect at a time and
 turned out to name one cause eight times.

One file, one shape per task, every parameter leaking for real, three controls.
Six offers came back, and every one falsified:

```text
push:        changed-by-push
retainer:    changed-by-retainer
pattern:     written
default:     written
logical:     written
conditional: written
projection:  changed-by-projection
```

The cause is a call result reaching a use site the deferred relation did not cover.
Every fix is a variation on asking where a value can have **come from** rather than what layer
 sits over it.

- a conditional write target: the normalisation walk strips access layers and wrappers, and a
  conditional is neither
- a property of an authored literal, and an element of one: same reason
- a destructuring pattern: the registration refused every non-identifier name
- a logical assignment: the binding scan collected plain assignment alone
- a parameter default: it collected local declarations and not the callable's own parameters
- a return of any of the above: the return branch asked the expression alone, where every write
  and store site has consulted the binding record since the relation existed
- an argument that is a call result: no origin exists for it during the syntactic pass, so it is
  deferred to the inner call site and resolved in the fixed point

Three separate omissions lived in one record, which is why the queue read as eight tasks.

### The one decision that costs precision

An argument that is a call result is recorded as a **retention** against the inner call site,
 with provenance naming the receiving call.

That over-approximates: the receiving call may only read what it was given.
Retention rather than a mutation claim, because handing a value to a call is a handoff and not a
 write, and retention withholds silently, which is right for something a reader can do nothing
 about.
The leaf gate removes the common half of the imprecision, since an argument that cannot carry
 mutable state records nothing, and `handCountToCollection` pins that.

The alternative is a new application kind resolved against the receiving callee's own summary,
 which is more precise and larger. The sweep decides whether it is needed.

### What was already correct

Four queue tasks needed no fix, and measuring them said so.
A store through a destructuring pattern into a binding outside the callable, an object literal
 property holding caller state, a store from a parameter initializer, and an element property
 write on an array parameter all already recorded what they should.
Their tasks were filed from reading rather than from measuring, which is the cost of filing
 before probing.

### The capture, and an over-approximation that turned out to be free

```text
before 1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
after  1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
added   0:
removed 0:
```

Offers did not rise and no category moved.

The interesting part is what did **not** happen.
Treating every call-result argument as retained was recorded as the decision that costs precision,
 with the receiving call possibly only reading what it was given,
 and the more precise alternative was left as a follow-up if the sweep showed a cost.
It shows none.

Two reasons, and only one of them is comfortable.
The leaf gate removes the common half, since an argument that cannot carry mutable state records
 nothing at all.
The other reason is the same one behind every zero here:
 of 1966 findings only 31 are offers,
 so there is almost nothing left for a withholding change to take.

So the precise alternative is not needed, and the evidence for that is weaker than it looks.
Recorded rather than dressed up.

## Activation gated on ancestry, and the one sweep where a rise was the risk

The scan discovering activations visited every node in the body, so a call written inside a
 closure nothing runs activated its target, and the target's body was then read as though the
 enclosing callable had run it.

```ts
export function storeClosureReachingWriter(neverReached: Config,): number {
  function writeIt(): void {
    neverReached.row.label = 'written';
  }
  callbackHolder.produce = (): Row => {
    writeIt();
    return { label: 'fresh', };
  };
  return neverReached.rows.length;
}
```

Measured before the gate: `mutated=[0]`, for a write this callable never reaches.
And a sibling returning caller state gave `returned=[0]`, an origin it never returns.

The earlier note in this document saying the predicted consequence did not reproduce was true of
 the shape it tested and false of the defect.
A sibling bound to a `const` arrow does not reproduce it, because overload resolution answers
 with the arrow and its key matched nothing the scan had reached.
A sibling written as a function declaration does.
Two forms, and the first probe picked the one that hides it.

Activation is now iterated to a fixed point over sites the callable can actually reach.
It terminates because the active set only grows and is bounded by the fixed set of nested
 callables.

### Assertions in pairs, because the obvious assertion is the wrong one

Each of these shapes asserts twice:
 the false fact is gone,
 **and** the offer is still withheld.

The withholding comes from the capture walk, which is right: the stored closure genuinely
 captures the configuration.
A fix that removed the false mutation and the withholding together would be a regression dressed
 as a correction, and an assertion on emptiness alone would call it a success.

### The capture

```text
before 1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
after  1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
added   0:
removed 0:
```

This is the one sweep in the whole effort where a **rise** was the thing to watch.
Every other change added attribution, so a rising offer count meant lost attribution.
This one removes attribution, so a rising offer count would have meant a false fact had been
 doing real work somewhere, holding back an offer that is now granted.

None appeared.
So nothing in this workspace was withheld on the strength of a write inside a closure that never
 runs, which is the most that measurement can say and is worth stating as exactly that much.

## The one claim that rested on the retired baseline, re-measured and standing

Retiring the 1939 baseline invalidated every claim of the form "the workspace did not move",
 and left one substantive per-finding claim to check:
 that task forty-six's fix moved three locations in each direction,
 with boundaries changing from `Object.values` and `pending.pop` to `pending.push`.

A per-finding claim is checkable even when the totals it sat beside are not,
 which is why this one could be repaired and the others could only be withdrawn.

Re-measured by disabling the spread branch in `passesValueOutward` at current HEAD and sweeping
 against the current baseline:

```text
before 1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
after  1966: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=31 stale-mutates=6
added   3: argument-opacity=3
removed 3: argument-opacity=3
```

Three locations, and the boundary identities are what the claim said:

```text
fix disabled:  used by these calls: Object...
fix enabled:   used by these calls: pending...
```

```text
package/oxlint-plugin/test-import/src/package-manifest.ts:270:40
package/oxlint-plugin/test-import/src/package-manifest.ts:144:31
package/git-policy/cli/src/trust/typescript-syntax-validation.ts:45:45
```

So the claim stands, and it stands on a comparison whose both sides carry digests,
 which the original did not.

Worth noting what this does **not** rescue.
The four captures reading 1939 are still unusable as evidence about totals,
 and nothing was re-run to rescue them,
 because their conclusions were of the form the retirement invalidated.
The fixture measurements, the falsifications, the mutation checks and the per-finding sampling
 never depended on the absolute number and were never in question.

## The construction discharge, and the net across the whole effort

The classifier answers what the leaf test could not. `honest-readonly` means every reachable
 position is readonly, so no write travels through the value whatever a constructor keeps with it,
 while the leaf test answers yes for any array because an array is an object.

The offer came back, and it is the same one:

```text
added   1: offer=1
package/pi-plugin/search-fetch/src/tools.ts:468:3  Parameter "{ input, supportedKeys, }" ...
```

Same file, same line, same parameter, same message as the one the construction channel took.
So the construction channel and its discharge together move the workspace by nothing, while
 constructions now withhold where they retain.

One slip in that change is worth recording, because it was fail-open.
A first draft skipped an argument whose type the checker could not answer for, which would have
 made an unknown type the safest thing to hand a constructor. Absent type now falls through to
 recording. A channel whose purpose is to withhold on what it cannot prove must never treat
 ignorance as proof.

### The net, from the one baseline that can be checked

Measured against `sweep-51-prefix.txt`, the pre-fix source with both artifacts rebuilt and both
 digests recorded:

```text
before 1966: argument-opacity=1227 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   3: argument-opacity=3
removed 2: argument-opacity=2
```

**Offers unchanged.**
Receiver opacity, dishonest and stale-mutates unchanged.
One argument-opacity finding gained, and two that changed their boundary list rather than
 appearing or leaving.

That one finding is the closure capturing a promise `resolve` handed to `handle.once`, which is
 true at its own source.

So across every change in this effort, the escaping closure, the aliased and conditional and
 container stores, the returned callable, the sibling call, the handed capture, the construction,
 the yield, the awaited return, the whole call-result cluster and the activation gate, the
 measured cost to this workspace is one true finding and two enriched boundary lists.

The soundness gain is what the falsifications record and the sweep cannot show, because a
 withheld offer is silent. The sweep's contribution is the negative claim, and it is worth having
 for exactly that: nothing was lost.

## Hunt pass two, and one falsification of mine that did not count

Four candidates, and only three were defects.

Two are fixed. A tagged template is a call and the analysis never saw it as one, because a
 `TaggedTemplateExpression` is not a `CallExpression`, so the call branch skipped it and every
 interpolated value reached the tag unrecorded. And the returned-callable capture resolved the
 returned expression itself, so a closure held inside a returned object literal went unrecorded,
 which the aggregate descent already written for the result-site walk answers.

One is open as task #76, a method on a local literal whose result is stored outward, filed with
 the instruction to measure which of its two halves fails before designing anything.

### The one that was not a defect

```ts
export function retainOptionally(
  optional: Config,
  keep: ((row: Row,) => void) | undefined,
): void {
  keep?.(optional.row,);
}
```

Two corrections, and the second matters more.

It is not about optional chaining. The plain call measures identically, so the task's title was
 wrong and its own instruction to diagnose first is what caught that.

And the empty opacity is the callback relation working, not a hole. The callee cannot know what a
 caller-supplied callback does, so the relation defers the decision to the caller, and the caller
 resolves it:

```text
supplyRetainingCallback   opq=[0]
supplyWritingCallback     mut=[0]
supplyReadingCallback     clean
```

Responsibility sits where the knowledge is.
The callee keeping its offer is correct policy of the kind `returnRowDirectly` already pins:
 handing a value to a callback the caller wrote is handing it back to the caller, who already had
 it.

### Why my falsification did not count, and the rule that follows

The bar requires a caller to observe a mutation the annotation denies.
My driver was the caller **and supplied the storing callback itself**.
It did it to itself, and no annotation on the callee's parameter ever denied what a callback the
 caller wrote would do.

The same driver would equally "falsify" `returnRowDirectly`, which this document keeps offered on
 purpose as the policy control.

So the bar needs one more clause, implicit until this caught me out:
 **the escape must come from something the annotated callable does, not from something the caller
 hands it.**
A driver that supplies the escaping behaviour proves nothing about the callable it is driving.

Three of the four pass-two candidates were real. Recording the fourth as not-a-defect is the more
 useful of the two outcomes, because it is the one that would have led to a wrong fix.

### The pass-two capture

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

Offers unchanged, nothing moved.

Which is now the expected result and says less each time it happens.
A tagged template, a callable inside a returned literal and a store of what a nested callable
 hands back are all real escapes, all falsified, and none of them occurs in this workspace on a
 parameter that still had an offer to lose.

## Hunt pass three

Fourteen more channels, five offers drawn, one of them the intended control.
Two were real and are fixed. Two were not defects, and saying why is the useful part.

### A throw was modelled nowhere

```ts
export function throwRowOutward(thrownOut: Config,): void {
  throw thrownOut.row;
}
```

A throw hands its value to a handler that outlives it by construction, so it is a handoff in
 exactly the sense a yield is.

This closes a gap that was already recorded elsewhere as a blocker. Task sixty-four declined a
 precision improvement precisely because a throw is modelled nowhere, which meant no body summary
 could be complete enough to grant an offer on. That reason is now weaker, though not gone: a throw
 is recorded here as an escape, which is what task sixty-four needed, and the rest of what it asked
 for is still missing.

The reasoning that makes it a defect rather than a permitted handoff is the same one that decided
 the returned callable. A return of caller state is permitted on the condition that callers track
 it through recorded returned origins. A throw has no such record and no channel to put one in, so
 the condition cannot hold.

### A destructuring default names its parameter where nothing looked

```ts
const { row = defaultReached.row, } = {} as { row?: Row; };
held = row;
```

The declaration scan read the declaration's own initializer, and that initializer names nothing.
The parameter is named inside a binding element, so the binding carried no origin and a later
 store of it attributed nothing.

Binding element defaults are now scanned at any depth, registered against the name each element
 binds.

### The two that were not defects

A setter parameter, `set kept(row) { this.#kept = row; }`, keeps its offer. That is task
 fifty-four's shape with `this` as the target rather than a parameter: the instance belongs to
 whoever called the setter, so storing into it grants that caller nothing it lacked, and deciding
 otherwise needs the caller-side reachability relation task fifty-four specifies. Not a new
 finding.

An explicit `this` formal returning `this.row` keeps its offer, which is the permitted return.

### What three passes have established, and what they have not

Passes one, two and three drew forty-two channels and found eight real defects: a construction, a
 yield, an awaited return, a tagged template, a callable inside a returned literal, a store of what
 a nested callable hands back, a throw, and a destructuring default.

Two candidates turned out to be correct behaviour, and both were instructive: the callback relation
 deferring to the caller, and a setter storing into its own instance.

What this does not establish is that the shape space is closed. Each pass has found something, so
 the honest reading is that passes are still productive rather than that they are converging. The
 channels covered are listed on task seventy-three so a later reader knows what was actually
 swept.

### The pass-three capture

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

Offers unchanged, nothing moved, with digests on both sides.

## Hunt pass four found nothing, and what that is worth

Twelve channels, one offer drawn, and it was the intended control.

Every leaking shape was already withheld:
 a `super` argument reaching a base constructor that keeps the row,
 a sort comparator capturing it,
 a `Proxy` whose handler hands it back,
 a `WeakRef` holding it,
 a write through a computed key,
 a `delete` of a parameter property,
 a `yield*` delegating the caller's rows,
 and a `for await` draining them into a collection.

None of those channels was fixed directly. They are covered by fixes made for other shapes:
 the construction channel answers for `super`, `Proxy` and `WeakRef`,
 the capture walk answers for the comparator,
 the yield handoff answers for delegation,
 and the iteration store answers for the awaited drain.

That is the most encouraging thing in this document, and it is still weak evidence.
It says the fixes generalise past the shapes that motivated them, which is what a fix built around
 a mechanism rather than a syntax should do.
It does not say the shape space is closed.
Four passes is four samples of a space nobody has enumerated, and the previous three each found
 something, so the prior on a fifth finding nothing is not high.

What the record can support is the list of channels, which is on task seventy-three.
Forty-four channels drawn across four passes, eight real defects, two candidates that turned out
 to be correct behaviour.

The conclusion worth writing down is the one about method rather than about coverage:
 hunting channels on purpose found eight defects that a queue built from incident reports had not,
 and it found them in four sittings.

## The last known false offer, and a mutant of mine that proved nothing

Three sibling shapes hid it by passing.

```text
methodClosesDirectly     opq=[0]   method names the parameter directly
arrowWithProperty        opq=[0]   arrow property names it
propertyOnly             opq=[0]   plain property read
methodReadsThroughThis   opq=[]    the only failure
```

A method reading `this.row` names no binding at all, because `this` is a keyword, so scanning the
 method body answers empty while the state it reaches sits in the literal the method was written in.

And the reason the first attempt at this missed it: resolving the callee **succeeds** for such a
 method, so returning early on that success scanned exactly the body that cannot see the capture.
The receiver is asked as well as the callee now, never instead of it.
Unioning rather than choosing is the whole fix.

Writing four shapes side by side is what found it. Reading the code had produced a plausible and
 wrong account twice.

### The fifth mutant story, and it is a new kind

The first mutant written for this fix **survived**, and the earlier three surviving mutants had all
 meant something: a missing fixture, a backwards claim, a half-exercised rule.

This one meant nothing. It was built wrong.

It restored the early return only when origins had already been found, and for this shape none have
 been, so the guard never fired and the mutant behaved exactly like the fixed code. It was not
 testing the thing its name said.

Rebuilt to return on a resolved callee unconditionally, which is precisely what the fix removed, it
 dies immediately.

So a surviving mutant has one more reading than this document had recorded:
 the test may be missing,
 the explanation may be backwards,
 the rule may be half-exercised,
 **or the mutant may not implement the defect it claims to.**
Check the last of those first, because it is the cheapest to rule out and the easiest to mistake for
 the others.

### The capture

```text
before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   0:
removed 0:
```

Offers unchanged, nothing moved, digests on both sides, and the built artifact verified against the
 digest the sweep ran with.

With this, every false offer this work found and falsified is closed.

## Closing #63, and the false offer its closure uncovered

### The declination was a claim about one mechanism

#63 had been declined here twice, and both declinations rested on the same sentence: gating a
 callable packaged in a parameter default requires its invocation site to activate it, and
 `callback()` where `callback` is a parameter typed `() => void` resolves to the type's signature
 rather than to the arrow written as the default.

That sentence is true. It is also not about the question. Overload resolution is one way to learn
 what a call reaches, and `possibleValueNodes` is another: it follows an identifier to its
 declaration and reports the initializer, and a parameter's default is an initializer. No signature
 resolution is involved.

Worth keeping as a general reading of declinations. A declination that names a mechanism as
 impossible has ruled out that mechanism, not the goal, and the wording here made the narrower claim
 look like the wider one for long enough to be recorded as settled twice.

### What the fix is

Parameter initializer nodes join the node universe the closure selection gates, instead of being
 added to the selected set outright. One consequence has to come with it: the ancestry walk ascends
 to the **declaration** rather than to the body, because an initializer node's parents reach its
 parameter and never the body, so a walk bounded by the body would climb past the callable being
 summarised and treat it as an inactive closure. That is exactly what the first attempt did, and it
 filtered out both controls.

Three shapes, all measured:

```text
closureDefaultNeverInvoked     mut=[]      the subject, offered
closureDefaultInvoked          mut=[0,1]   the control for reaching
initializerExpressionWrites    mut=[0]     the control for the initializer itself
```

### The offer it raises is self-limiting, and that is worth saying

This is the first change in this work that **adds** an offer rather than removing one, so the
 direction of risk is reversed and the arrival deserves a closer look than a removal would.

`unreachedDefault` is offered because nothing invokes and nothing keeps the closure that writes. It
 is also not a suggestion anyone can take: the write sits inside the default and reaches the
 parameter directly, so applying `ReadonlyDeep<Config>` stops the file type-checking. It belongs
 with `invokeAssignedLocalClosureWriting`, which this file already records as self-limiting rather
 than false. What the shape measures is attribution, not advice.

The escape shapes beside it are therefore written as readers rather than writers, because a reading
 closure is the form a falsification can use: `readonly` property modifiers are ignored in
 assignability, so handing the row out compiles and lets the receiver do the writing.

### The escape the over-attribution had been covering

Removing an over-attribution removes whatever it was accidentally covering, and here it was covering
 a real false offer:

```ts
function handDefaultClosureToRetainer(
  handedDefault: Config,
  handedCallback: () => Row = (): Row => handedDefault.row,
): void {
  retainCallable(handedCallback,);
}
```

`callableDeclaration` follows a local variable's initializer and stops at a parameter, so the
 capture channel named no callable and recorded nothing. Measured `opaque=[1]` with slot zero
 offered. Falsified: annotation applied, clean type-check beside a control whose direct write is
 rejected by `@ts-expect-error`, driver invoked the retained closure and wrote through the row it
 handed back.

The fix asks the possible-value walk as well as the resolver, and **only** in the capture channel. A
 capture adds opacity and can therefore only withhold more, while the callback identity beside it
 names the callable a callee invokes, and naming a default there would claim the default's effects
 for a call where the caller supplied something else. That is a claim that can be wrong in the
 offering direction, which is the direction that matters.

### Both mutants died, one per half

```text
capture widening removed      40 offers, expected 39   the false offer returns
initializer gate removed      38 offers, expected 39   the over-attribution returns
```

Each isolates one half, which is what makes the pair worth running rather than one mutant over the
 whole change.

## The three things a callee can do with a callable a caller handed it

Two reviewers reading the same source found the same next defect independently, and following it
 produced the most useful framing this work has reached. A callee handed a callable can:

-    **keep it**. Answered from the callee's `opaque` set since #69.
-    **hand back what invoking it produced**. Answered by nothing.
-    **write through what invoking it produced**. Answered by nothing.

Stating it that way makes the omission obvious in a way that reading either code path did not. The
 capture channel was not missing a syntactic form; it was answering one third of a relation.

### Handing back, and why the caller keeping its offer is correct

```ts
function invokeSupplied(supplied: () => Row,): Row {
  return supplied();
}

function handInvokedResultBack(invokedThrough: Config,): Row {
  return invokeSuppliedRow((): Row => invokedThrough.row,);
}
```

The first falsification attempt for this was **invalid**, in the same way the callback-parameter one
 earlier in this document was invalid. Applying the annotation to `invokedThrough`, type-checking
 clean and writing through the returned row does change the caller's row, and that is not a
 falsification: a return of caller state is permitted by the accepted decision on the condition that
 callers substitute through a recorded returned origin, and `returnRowDirectly` has exactly the same
 standing and keeps its offer.

The condition is what had failed. `invokeSupplied` records `returned=[0]`, so the edge already said
 its result carries what the formal carries, and the substitution walk read only
 `originsByCalleeSlot` and never the per-formal captures. So the valid subject is a caller of the
 caller:

```text
storeInvokedResult   before: nothing recorded, offered
storeDirectResult    before: opaque=[0], withheld
storeInvokedResult   after:  opaque=[0], withheld
```

A store is not a permitted return, so that pair is decisive where the return itself was not.

Two readings of a returned callable formal both lead here, which is why one relation answers for
 both. `returned=[0]` can mean the result is the callable, and then the caller holds something that
 captures the origin; or it can mean the result is what invoking the callable produced, and then the
 caller holds the origin. Either way the caller's result carries it.

### Writing through, which speaks as a mutation

```ts
function writeThroughSupplied(written: () => Row,): void {
  written()
    .label = 'written';
}

function handWrittenResultOut(writtenThrough: Config,): void {
  writeThroughSupplied((): Row => writtenThrough.row,);
}
```

`writeThroughSupplied` records `mutated=[0]`, so the callee had already said what it does.
 `handWrittenResultOut` recorded **nothing at all** and was offered. Falsified with no ambiguity
 about policy: the closure only reads, so the annotation applies cleanly, the callee's write is on
 the declared `Row`, and the driver saw the caller's row change.

Reported as a mutation rather than as opacity. A reader is told the parameter is written instead of
 being told an implementation could not be inspected, which is the same direction #55 settled for
 stores.

### The precision control that makes all three safe to land

`readThroughCallable` invokes its formal and keeps only a primitive off the result, so its formal is
 neither opaque nor returned nor written, and its caller `handCaptureToReader` keeps its offer. Every
 one of these three channels is gated on a fact the callee stated about its own formal, so a callee
 that states none propagates none. The offer count over the whole invalid fixture moved by exactly
 one across both fixes, and that one is the permitted return.

### Mutants

```text
returned-capture contribution removed    41 offers, expected 40
write-through pass removed               41 offers, expected 40
```

## What the reviewers found that the hunt passes had not

Four hunt passes drew 44 channels by writing shapes. The three defects found after the fourth pass
 came from reading the source instead, and they share a property the hunt could not have surfaced:
 none of them is a missing syntactic form. Each is a relation answered for one of its cases.

That suggests where the remaining ones are. Not in the syntax any single channel scans, but between
 channels: in a set one propagation reads and another does not, in a gate that names one of three
 possibilities, in an index two modules disagree about.

## The sweep for #77, #65, #63, #78 and the write-through channel

```text
commit c44ea07ea
06016e74673c7f2d47a5a0453926780230e72b2790359781b4a488344408f359  plugin index.mjs
4bb8b08afcd5e7850fecdc2af7dd32da95c25a8ea84c5e061141c95fc16f8617  oxlint sidecar

before 1967: argument-opacity=1228 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1968: argument-opacity=1229 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
added   1: argument-opacity=1
removed 0:
```

Run ended before the capture was read, `real 9m23`, and both artifacts re-hashed identical to the
 digests recorded before the run started.

Against the reusable criterion: offers unchanged, so the soundness statement holds; no category but
 argument-opacity moved; argument-opacity rose by one, which the criterion expects and does not
 require an accompanying offer loss.

Worth noting what did **not** happen. #63 raises offers by construction, and none rose here, so the
 shape it releases (a parameter default packaging a callable that nothing invokes and nothing keeps)
 does not occur anywhere in this workspace. That is a fact about the workspace rather than about the
 fix, and it means the sweep gives the fix no support beyond the absence of harm.

### The one added finding

`installKeyboard` in `package/desktop-app/file-manager-electron/src/renderer-keys.ts:272`, whose
 `session` parameter had no diagnostic at all in the baseline and now reports argument opacity
 naming a bodyless callable in `render-dom.ts` and `column.append`.

The claim is true. `installKeyboard` builds a record of closures that each pass `session` to
 `moveSelection`, `moveColumnFocus`, `closeActivePane` or `openSelectedEntry`, and those callees
 already reported opacity naming exactly those boundaries in the baseline. So invoking one of the
 packaged closures does reach a call this rule could not inspect, with `session` as its argument.

What is **not** established is which of the four changes produced it. The baseline predates all four,
 and attributing one finding would need a capture per change, which is four more nine-minute runs to
 name a cause that changes no decision. Recorded as unattributed rather than guessed at.

The direction is worth stating plainly: a parameter that was silently withheld now says why, and
 names a boundary a reader can inspect. That is the intended behaviour of the capture channel, and
 it is also the shape of that channel's known failure mode, a store's cause arriving dressed as a
 call. Here it is not that, because the cause really is a call.

## The unresolved boundary, and the premise a gate this narrow rests on

### The reach was the surprise

Captures were recorded on owned call edges only. The scoping was deliberate and documented, on the
 grounds that folding captures into ordinary origins would withhold on
 `rows.map((row) => config.row.label,)` against every unresolvable callee. It was right about the
 cost and wrong about the risk.

What made it urgent is not library calls. A possibly-overridden method is treated as unresolved on
 purpose, because an override can write what the base only reads, so **every instance method that
 keeps a callback** was losing the capture. Measured as a three-way comparison rather than argued:

```text
retainer written as an instance method    nothing recorded for the captured parameter
retainer written as a static             opaque=[0]
retainer written as a plain function     opaque=[0]
```

Falsified through the instance-method form, with a registry storing into a module holder no caller
 can reach, and separately through a promise continuation whose awaited result a caller stores.

### What the gate asks, and the premise underneath it

It asks one question: can invoking the packaged callable hand back something writable. Nothing else.

That is only enough if everything **else** a closure can do with the origin is already charged
 somewhere. The claim was first written down after measuring one channel, writes, which is a third of
 what it needed. Measured in full afterwards, each a void-completing closure handed to `setTimeout`
 or to an emitter method, so the new gate deliberately declines to fire on any of them:

```text
holder.row = storedVoid.row                       opaque=[0]
JSON.stringify(handedVoid.row,)                   opaque=[0]
new RowKeeper(builtVoid.row,)                     opaque=[0]
throw thrownVoid.row                              opaque=[0]
sink.push(filledVoid.row,) into a callee container opaque=[0]
```

The last is the interesting one, because its escape flows through neither the closure's completion
 nor a write: the container belongs to the uninspectable callee. It is charged all the same.

And the reason all five are charged is worth stating, because it is what makes the gate's narrowness
 legitimate rather than lucky. A closure handed as an argument is activated, and an activated
 closure's body is scanned **inline as part of the enclosing callable**, so every channel the
 enclosing callable has applies to the closure's body too. The single channel that cannot apply is
 what invoking the closure hands back, because that value is received by the uninspectable callee
 rather than by the enclosing callable. The gate covers exactly the gap and nothing else.

### The prediction, written before the capture is read

Recorded first so the sweep can refute it rather than be read after the fact.

The gate conjoins two facts that are not the same fact: the closure reaches the origin, and the
 closure's completion can carry mutable state. It does not check that the completion **carries** the
 origin. So the dominant offer loss should be closures that name a parameter and hand back a freshly
 built aggregate that does not contain it:

```ts
mapped.rows
  .map(function labelled(row,): Labelled {
    return { label: `${config.prefix}${row.label}`, };
  },);
```

`config` is named, the completion is an object, and nothing of `config` is inside it. Withheld
 anyway. The precise alternative computes which origins a completion exposes, which needs returned
 callables, getters, aggregates, async results and every value branch, and the conservative
 conjunction is what lands here instead.

The delta should also arrive largely as add-and-remove **pairs** rather than pure additions, because
 the new opacity shares its provenance string with the call's ordinary argument origins, so an
 existing boundary list grows and the message text changes. Under the comparison keying that reads as
 one removed plus one added per affected parameter, and it is not churn.

### The accepted loss, and its wider reach than one fixture shape

`setTimeout` discards what it invokes, so withholding there is a precision loss rather than a
 soundness need, and `handRowToDiscardingCallee` pins it. The loss is wider than that shape: a
 concise arrow's body **is** its completion, so any `() => someCall()` argument whose callee returns
 an object now withholds too. Recovering either needs a per-callee effect contract naming the
 discard, since no local property of the call expression establishes what an uninspectable
 implementation does with a value.

### Mutants

```text
capture pass removed        44 offers, expected 42   both falsified subjects return
result-shape test removed   41 offers, expected 42   one precision control lost, plus a summary test
```

## A default callback is nobody's to defer to

Found while looking for a falsifiable variant of the four activation forms that cannot reach a
 parameter default. The search found something better and elsewhere: the **control** was a false
 offer too.

```ts
function writeThroughDirectDefault(
  directTarget: Config,
  directWriter: (row: Row) => void = (row: Row): void => {
    row.label = 'written';
  },
): void {
  directWriter(directTarget.row,);
}
```

Records `mutated=[1]` and leaves `directTarget` offered. Falsified: applying `ReadonlyDeep<Config>`
 type-checks, because a `ReadonlyDeep<Row>` is accepted where `Row` is expected and the write is on
 the declared `Row`, and a driver that omits the argument reads `row: written` afterwards. Clause
 five holds, since the caller supplied no callback and the write comes from the annotated callable's
 own default.

This is the exact edge of what #75 settled. #75 established that the callback relation **correctly**
 defers to the caller, on the ground that the caller supplies the callback and knows what it does. A
 default is supplied by the callee. There is nobody to defer to, so deferring loses the write.

Measured across all five forms, and only two of the four the activation task named are actually
 exposed:

```text
writeThroughDirectDefault    mutated=[1]     direct call, the subject
writeThroughPatternDefault   mutated=[1]     destructuring default
writeThroughAliasedDefault   mutated=[1]     assignment alias
writeThroughBoxedDefault     opaque=[0]      withheld by another channel
writeThroughAdaptedDefault   opaque=[1,0]    withheld by the member-call boundary
```

So the defect is the relation and not the activation, and the activation task shrinks to the two
 forms that are still self-limiting.

### The shape a fix has to take, and the trap in it

The obvious fix is to let `callableDeclaration` follow a parameter to its default, so the invocation
 builds an ordinary owned edge to the default. That is the thing this work deliberately declined to
 do when closing #63, for a reason that still holds at a **callee's** edge: naming a default as the
 callable a callee invokes claims the default's effects for a call where the caller supplied
 something else.

At the enclosing callable's own invocation the reason does not hold, because the effects can only be
 added. Claiming the default's write when the caller supplied a different callback withholds an offer
 that might have stood, and withholding is always safe. The trap is elsewhere: the invocation
 currently produces an invoked-capability fact, and replacing that with an owned edge could remove
 it. The union is what to build, not the substitution.

### The capture, and the prediction it confirms

```text
commit 6da571326
90fd87f2161a1ddcc2d8c3548adfddd888b31132d35a268b1a205fb849dcd168  plugin index.mjs
65f82458808ed5abdc3dec40813316af8c76a4642026c5440709c70744e65b28  oxlint sidecar

before 1968: argument-opacity=1229 receiver-opacity=664 dishonest=37 offer=32 stale-mutates=6
after  1999: argument-opacity=1277 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
added   133: argument-opacity=129 receiver-opacity=4
removed 102: argument-opacity=81  receiver-opacity=20 offer=1
```

Run ended before the capture was read, `real 8m42`, both artifacts re-hashed identical to the
 digests recorded before it started.

Offers fell by one, which is the direction the soundness statement permits. The lost offer is the
 predicted shape, and it is worth quoting because the prediction named it before the capture was
 read:

```ts
function findRegressions({ map, baseline, }: { readonly map: CoverageMap; baseline: Record<string, number>; },): readonly Regression[] {
  return Object.keys(baseline,)
    .toSorted()
    .flatMap(function check(file,) {
      return [{ file, baseline: baselineCovered, current: currentCovered, },];
    },);
}
```

The closure names `baseline` and hands back an object built of a string and two numbers. Nothing of
 `baseline` is inside it. The gate conjoins "the closure reaches the origin" with "the completion can
 carry mutable state" and does not ask whether the completion **carries** the origin, so it withholds.
 Recovering it needs the exposure analysis that walks returned callables, getters, aggregates, async
 results and every value branch, which is a larger change than soundness requires.

### The criterion needs a clause, and this is why

The reusable criterion said no category but argument-opacity may move. Receiver opacity fell by
 sixteen, so either the criterion is wrong or the change is. Checked rather than assumed: **all
 twenty** removed receiver-opacity findings are the same parameter at the same anchor now reporting
 argument opacity instead.

That is a message-form consequence with a known cause. The receiver-specific message requires every
 boundary in a parameter's list to be a member call on that parameter, an `every` over the list, and
 a capture boundary joining the list breaks it. The parameter was withheld before and is withheld
 now; only the words changed.

So the clause to add: **receiver-opacity may lose a finding to argument-opacity for the same
 parameter at the same anchor, and a sweep must pair them before reading the movement as a
 regression.** Net counts cannot show this, which is why the comparison has to be read per finding.

The four added receiver-opacity findings are parameters that spoke nothing before and now do, each
 with a boundary list made only of member calls on itself. Sampled the first, and the claim is true:

```ts
return {
  localRef,
  localOid,
  remoteLocation: capture.remoteLocation,
  remoteName: capture.remoteName,
  advertisedRemoteOid,
  remoteRef,
};
```

The closure handed to `.map` does name `capture`, so the diagnostic is honest. The conservative part
 is the same one the lost offer shows: what the closure hands back holds only strings read off
 `capture`, not `capture` itself.

A closure naming nothing of the parameter attributes nothing, which was measured separately rather
 than assumed: the same shape with closures naming only their own parameters records clean, and
 naming the parameter records `opaque=[0]`.

## Four more holes in the same relation, three of them found by reading

A reviewer read the landed gate and named nine candidate holes. Measuring them separated the two
 kinds cleanly, which is the useful part of the exercise: **three were already covered** and the
 reviewer could not have known, because the measurements that cover them were taken after its prompt
 was assembled.

Covered, each recording `opaque=[0]` already:

```text
async closure rejecting with the caller row          throw handoff charged it
closure storing the row into its own receiver        store charged it
closure storing the row into a callee parameter      store charged it
```

Real, each leaving the parameter offered:

```text
() => erased()  where erased: () => void holds a row-returning callable   erasedThrough offered
() => assertedThrough.row as unknown as string                           assertedThrough offered
() => gotten.row  where gotten is a literal with a getter over the row    gottenThrough offered
((): Row => boundOut.row).bind(undefined,)                               boundOut offered
```

### A declared type can lie, in two ways

The gate asked whether a completion can carry mutable state and trusted the completion's static
 type. The first two shapes are that trust being abused: an annotation that hides a row behind
 `void`, and an assertion that renames one to `string`.

Fixed by judging what a completion **is** rather than what it claims. An assertion is stripped, using
 the same normalisation the substitution walk uses, which removes `await` too. A call completion is
 followed to its callable and judged by that callable's own completions, bounded by a visited set.

Following stops at an external callee, and that boundary is a decision rather than an omission. An
 external declaration's return type is what this rule trusts everywhere else, and distrusting it here
 would withhold on every closure that hands back a primitive through a library call. Both sides have
 a control: `(): number => countOfRows(rows,)` follows to an owned body that says number and keeps its
 offer, and `(): string => String(label,)` trusts the declaration and keeps its offer.

### A read is not a call

The reach walk follows calls, so a closure reading a getter over caller state answered empty: the
 closure names a local, resolving the local finds no parameter origin, and there is no call to follow.

Fixed by collecting every callable an authored literal or class expression declares whenever a body
 reads a property off one. Accessors and methods alike, because a property read can hand a method
 onward as a value just as it can run a getter, and without tracking which property was read, the same
 decision the aggregate descent already makes about keys. Its control is a literal whose getter
 allocates its own row, which keeps its offer.

### A capture reaches an implementation through three positions, not one

The inspection took `call.arguments` alone. A capturing closure can also be the **receiver**, which is
 what `.bind`, `.call`, `.apply` and any retaining method look like, or the **callee** itself, which is
 what an unresolved invocation of a dynamically selected closure looks like. All three are inspected
 now.

### And one at the edge of what #75 settled

Recorded above under its own heading, since it is a different relation: a callback relation defers to
 the caller because the caller supplies the callback, and a parameter default is supplied by the
 callee, so deferring loses whatever the default does.

### Mutants, one per channel

```text
default-callback edge removed        51 offers, expected 49
assertion stripping removed          50 offers, expected 49
call following removed               50 offers, expected 49
accessor reach removed               50 offers, expected 49
receiver and callee inspection removed  50 offers, expected 49
```

### What this says about where the remaining holes are

Every one of the last seven defects is a **relation answered for some of its cases**, not a syntactic
 form nobody wrote a fixture for. Four hunt passes writing shapes found none of them. Two reviewers
 reading the source found six.

So the method that is working is: state the relation in full, enumerate its cases, and check each. The
 three-way statement about what a callee does with a handed callable is the clearest instance, and the
 three-position statement about where a callable reaches an implementation is the second.

## The sweep for the four capture-channel fixes

Run at `04679bb03`, single-threaded, with both artifact digests recorded in `sweep-86.digest` before
 the run and re-verified after it. The two doc-only commits that landed while it ran moved `HEAD` to
 `e88ccac01` without touching either artifact, which the identical digests on both sides establish.
Runtime 7m58, against 8m42 for the previous sweep.

```text
before 1999: argument-opacity=1277 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
after  2004: argument-opacity=1282 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
added   6: argument-opacity=6
removed 1: argument-opacity=1
```

This is the cleanest of the three sweeps against the reusable criterion. Offers did not move, which is
 the only soundness statement the criterion makes. No category but argument-opacity moved at all, so
 neither the receiver-opacity pairing clause nor the offer-loss sampling clause had anything to apply
 to.

Two predictions written before the capture was read did not come true, and both are worth recording as
 not-yet-exercised rather than as refuted. The first was that #84 could raise offers soundly, by
 following a completion into an owned body whose declared type is wider than what it returns, so that
 `function widen(): unknown { return 1; }` becomes a leaf answer where the declared type withheld one.
Nothing in the workspace is written that way. The second was that #85 and #86 would give more
 parameters a capture boundary and so break the `every`-over-boundaries test that selects the
 receiver-specific message. Receiver-opacity did not move by one finding, so no boundary list changed
 membership anywhere.

### The six added findings are one shape

All six are `fragment.parts.map`, in three locales times two layers: the renderer factory that owns
 the parameter, and the `index.ts` that hands its own parameter in. The finding is true. The mapped
 callback calls `renderPart`, `renderPart` reads the destructured members of `deps`, and those members
 come from `deps`, so `deps` does reach a call this rule cannot inspect.

### The one removed finding is a derivation replacing a fallback

`package/pi-plugin/spawn/src/state.ts:531` stopped reporting `env` at `entries.map`, and the anchor is
 now silent rather than speaking through some other channel, which is the case that has to be
 explained rather than sampled.

It is #84 answering where a fallback used to. The mapped callback `readCandidate` returns
 `Promise<string | typeof SKIPPED_CHILD>`, so invoking it can hand back nothing but a string: a callee
 that keeps it cannot get caller state out through its result. What `readCandidate` does with `env` in
 its body is a separate obligation, and it is discharged rather than dropped, because the body of an
 activated closure is scanned inline: `env` goes to `consumeMatchingChild`, which is owned, and from
 there to `spawnStatePath`, which is owned and returns a string. Nothing escapes, so silence is earned
 rather than lost.

That the loss is precision-only is settled independently of the reading: the offer total did not move,
 and a compare that reports no added and no removed offer anywhere cannot be hiding one that traded
 places.

## A default that is invoked and whose result is stored

Two relations were each answered alone and their cross was not. A store of an invoked result withholds
 when the callable was handed in, which is #78. A defaulted callable is selected when it is stored or
 handed onward, which is #83. Neither covered a default that is invoked and whose result is then
 stored.

Measured before the fix, in the fixture project:

```text
storeDefaultProducerResult:     {"mutated":[1],"opaque":[1],   "returned":[]}
storeAllocatingProducerResult:  {"mutated":[1],"opaque":[1],   "returned":[]}
countDefaultProducerResult:     {"mutated":[1],"opaque":[],    "returned":[]}
storeDefaultClosure:            {"mutated":[], "opaque":[1,0], "returned":[]}
storeInvokedResult:             {"mutated":[], "opaque":[0],   "returned":[]}
```

The subject was indistinguishable from both of its controls, while the two established siblings both
 charged slot zero. The store site was seen, which is what charging the producer parameter proves, and
 the default closure was selected. What reached nothing was the capture the default hands back.

Falsified at the five-clause bar. The rule offered `producedDefault`, the annotation was applied, `tsc`
 exited zero, the control carrying `@ts-expect-error` over a direct write drew no TS2578, and the
 driver printed `before: original` then `after: written`. The escape comes from what the annotated
 callable does: the caller hands it a configuration and no callable at all, since the producer is
 written inside the annotated callable's own parameter list.

### The cause was one resolver stopping where another does not

`calledCallableOrigins` resolved a callee with `callableDeclaration`, which follows a local's
 initializer and stops at a parameter. So invoking a parameter that carries a callable default reached
 nothing. It now also asks the value walk for every callable the callee expression can hold, alongside
 the resolver rather than instead of it, on the grounds the capture channel already uses: an origin a
 result can carry only ever withholds.

`packagedActualCallables` moved to `effect-possible-values.ts`, beside the walk it is one filter over.
 The reach walk cannot import it from `effect-captured-argument-origins.ts`, because that module
 imports the reach walk.

After the fix the subject charges slot zero and both controls are untouched:

```text
storeDefaultProducerResult:    {"mutated":[1],"opaque":[1,0],"returned":[]}
storeAllocatingProducerResult: {"mutated":[1],"opaque":[1],  "returned":[]}
countDefaultProducerResult:    {"mutated":[1],"opaque":[],   "returned":[]}
```

Offers moved 52 to 51 in the unit suite. The mutant that deletes the candidate fold restores 52, so
 the fold is what removes that offer and nothing else does.

### What the two-edge question turned out to be masked by

The advisor raised that `addOwnedCallEdge` now pushes one edge per callable the value walk finds, so a
 conditional default produces two edges carrying one `callSiteKey`, and `propagateResultApplications`
 builds a `Map` from entries, which keeps the last pair. That is #89.

A conditional-default probe cannot settle it, because both source orderings answer identically and
 both answer through the reach walk rather than through the edge. Branches written inline are nested
 callables, and the reach walk folds in every candidate's reach without consulting any edge.

Trying to reach the edge path instead uncovered a separate defect, recorded as #97. Over one store,
 `keyHeld.row = pass(cfg.row,)`, with `handRowBack` recording `returned=[0]`:

```text
storeDirectPassResult:    {"opaque":[0]}  callee named directly, charged
storeAliasPassResult:     {"opaque":[0]}  callee held by a local alias, charged
storeSinglePassDefault:   {"opaque":[1]}  callee a parameter defaulting to it, slot zero offered
storeInlinePassDefault:   {"opaque":[1]}  default written inline, slot zero offered
```

So the substitution walk answers for a direct and an aliased callee and fails for a defaulted one,
 with one edge rather than two, which is why #89 stays unsettled rather than answered.

The two defaulted forms fail for what look like two different reasons, and the inline-versus-named
 reading that would have explained one of them is refuted by the pair above. For the named form, the
 value walk hands back an identifier and `packagedActualCallables` keeps only values that are
 themselves callable declarations, so no edge is built at all. For the inline form an edge is built,
 and `propagateResultApplications` then needs `summaries.get(edge.calleeKey)`, which a callable written
 inside the one being summarised does not have. Both readings are inferred from source and neither is
 measured yet.

## The returned fact a concise arrow body carries

The direct scan recorded a returned effect under `isReturnStatement` alone. A concise arrow body is the
 callable's own body expression with no return statement anywhere, so such a callable recorded an empty
 returned set, and every caller that stored its result was offered.

This was found while chasing what looked like a defaulted-callee defect, and the measurement that
 reframed it took the default out entirely:

```text
storeThroughTopLevelConcise: {"opaque":[]}     concise identity at top level, slot 0 OFFERED
storeThroughTopLevelBlock:   {"opaque":[0]}    same identity with a block body, charged
storeThroughBlockDefault:    {"opaque":[1,0]}  block-bodied default, charged
```

So the default machinery was never the problem and the body form was. Three earlier probes read as
 default failures, `storeIdentityPassDefault` and `storeInlinePassDefault` among them, were concise
 defaults.

Falsified at the five-clause bar with no default in sight: annotation applied, `tsc` exit zero, control
 carrying `@ts-expect-error` over a direct write drawing no TS2578, driver printing `before: original`
 then `after: written`.

The nested case needs no gate here, unlike the statement branch it mirrors. `body` is the callable's
 own body, so a nested concise arrow inside it is never what this reads, and a nested return stays the
 nested callable's own exactly as #77 established.

### It also settles a claim two reviewers reasoned from

`effect-callable-capture-closure.ts` states that a callable written inside the one being summarised has
 no summary of its own. After this fix, `storeIdentityPassDefault` and `storeInlinePassDefault` both
 charge through `propagateResultApplications`, which reads `summaries.get(edge.calleeKey)` and skips
 when it is absent. It is not absent.

Sol's fourth review reasoned from that same false claim and concluded the inline default failed for
 want of a summary. The measurement says the concise body was the entire cause for the inline forms.
The claim is #96 and is now falsified twice, the other measurement being `invokeWritingDefault`
 recording `mutated=[0,1]`.

Instrumentation is what settled it rather than reading: printing inside `propagateResultApplications`
 showed one application and one edge with matching keys, the callee summary present, and
 `originsByCalleeSlot [[0]]` correct, with `returned []` the single wrong value.

## A capture handed to a callback parameter

A callback relation names which caller-owned value reached which callback argument position, and the
 caller can reconstruct that because the caller chose the value. A closure written inside the callee is
 not the caller's choice, and what it captures is visible only there, so `parameterIndexes` answered
 empty and the relation held nothing at all.

```text
handCaptureToCallbackParameter: {"mutated":[1],"opaque":[],  "returned":[]}  slot 0 OFFERED
handFreshToCallbackParameter:   {"mutated":[1],"opaque":[],  "returned":[]}  control, correctly offered
handCaptureToMemberCall:        {"mutated":[], "opaque":[0], "returned":[]}  same closure, charged
```

Two paths, one relation, disagreeing, which is the argument for routing this branch to the gate that
 already answers rather than building a second mechanism. That makes the fix a consistency repair
 rather than a policy change: the deferral #75 settled is incomplete rather than wrong.

Falsified with a driver whose supplied callee kept the producer, invoked it, and wrote through the row
 it handed back.

The capture gate alone runs here, not the whole boundary, because the boundary would also mark ordinary
 direct arguments opaque and that is exactly what the relation exists to defer. The control that
 decides whether this is safe to land is a parameter-derived non-callable, `rowCallee(cfg.row,)`, and it
 keeps its relation and gains no opacity before and after. A second subject was added in the same run,
 a closure reaching its capture only through a sibling, which the reach walk answers through the new
 path.

### Neither fix moved a fixture offer until fixtures were written for it

Both suites passed unchanged across both fixes: nothing in the fixture stored a concise arrow's result,
 and nothing handed a capture to a callback parameter. An unpinned fix is an unprotected one, so each
 gained a group with its controls, moving the count 51 to 55 to 57. Both mutants died with exact
 deltas, 57 to 58 restoring the concise subject and 57 to 59 restoring both callback subjects.

### Prediction for the sweep, written before the capture is read

Offers must not rise, which is the only soundness statement.

Offers should fall, and by more than any previous sweep, because #98 is general rather than shaped: a
 concise arrow body is ordinary style throughout this workspace, and every caller that stores such a
 result now withholds. #91 should lower them further wherever a capture is handed to a callback
 parameter.

Argument-opacity should rise, because the capture gate names the call it could not inspect, and that is
 the message a reader can act on. Receiver-opacity may move, and the existing clause applies: pair any
 movement per finding before reading it as a regression.

A returned fact alone must not cost an offer, since returning caller state is permitted on the
 condition that callers substitute. So an offer that disappears with no store and no capture anywhere
 near it would be the shape to investigate.

## The sweep for those three fixes found nothing, and the prediction was wrong

```text
before 2004: argument-opacity=1282 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
after  2004: argument-opacity=1282 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
added   0:
removed 0:
```

Byte-for-byte the same finding set. The prediction written before the capture said offers should fall by
 more than any previous sweep and argument-opacity should rise. Neither happened, and not one finding
 moved in any category.

### The sweep did run the new code

Worth settling first, because "no change" and "the fix is not in the artifact" look identical. Both
 digests differ from the previous sweep's, which is what a rebuild from changed source produces:

```text
index.mjs                                  764b1eed -> 8bf6f23d
plugin-prefer-readonly-parameter-type.mjs  4fd4f4bb -> fc907479
```

Runtime was 8m44 against 8m42 and 7m58 for the two before it, so nothing was skipped wholesale, and the
 previous sweep showed six additions in files nobody had edited, so analyzer changes do reach unedited
 sources through this pipeline.

### Why nothing moved, and what that says about the instrument

A store-caused withholding is silent by design. The decision recorded for the opacity channel is that a
 store is not a cause a reader can act on, so a parameter withheld because of a store emits no message
 at all. So the only way #98 or #91 can show up in a sweep is an offer disappearing, and an offer can
 only disappear if that parameter was not already withheld for some other reason.

The ratio settles it. There are 1282 argument-opacity findings and 31 offers, so nearly every parameter
 in the workspace is already charged through some channel. A new charge against an already-charged
 parameter changes no output. For an offer to move, all three of these have to hold at once: a callable
 with a concise body handing back parameter-reachable state, a caller storing that result beyond itself,
 and that caller's parameter otherwise clean. None of the 31 is that shape.

So the honest reading is narrow. The sweep confirms the soundness statement, that no offer rose, and it
 cannot confirm these fixes fire anywhere in the workspace, because their effect is silent wherever it
 does fire. That is a limit of the instrument rather than a fact about the fixes, which were each
 falsified against a driver and each pinned by a mutant that died with an exact delta.

It also justifies after the fact the decision to add fixture groups for both. Neither fix moved a single
 fixture offer before its group existed, and the sweep cannot see them either, so the fixture is the
 only standing guard on all three.

### The criterion gains a clause

A sweep is evidence about offers and about the message channels. It is not evidence about any channel
 that withholds silently. When a fix's whole effect is silent withholding, a sweep can only fail it, by
 raising an offer, and can never confirm it, so the fixture group and the mutation check carry the whole
 weight and must be written before the fix is called done.

## One shared resolver, and the order-dependent answer it exposed

`packagedActualCallables` kept only values already written as callable declarations. `possibleValueNodes`
 follows a parameter to the identifier its default names and stops there, and an identifier is not a
 callable declaration, so a default naming an ordinary function resolved to no callable at all while one
 written inline resolved fine.

The measurement that located this held the store constant and varied only how the callee was reached:

```text
storeDirectPassResult:   {"opaque":[0]}  named directly, charged
storeAliasPassResult:    {"opaque":[0]}  held by a local alias, charged
storeSinglePassDefault:  {"opaque":[1]}  reached as a default, slot 0 OFFERED
```

`handRowBack` is block-bodied and its own `returned=[0]` is correct, so this is resolution rather than
 substitution. Two reviews had placed it in substitution, one of them reasoning from the nested-summary
 claim that #96 has now corrected.

Every candidate value is now resolved through `callableDeclaration` rather than tested, keyed by source
 span so one declaration reached by several values answers once. The callback branch's edge builder asks
 the shared resolver instead of filtering the walk itself, which is where the named default was actually
 being dropped: changing the resolver alone left `storeSinglePassDefault` offered, because that branch
 carried its own copy of the filter.

### It made #89 demonstrable, in the sharpest possible form

The two-edge collision had resisted two attempts to reach it. With named defaults resolving, a
 conditional default finally produces two edges at one call site whose facts differ, and the answer
 flipped with source order:

```text
storePassFirstDefault:   {"opaque":[2,0]}  returning branch written first, charged
storeAllocFirstDefault:  {"opaque":[2]}    allocating branch written first, slot 0 OFFERED
```

Same two callables, same store, opposite answers. `propagateResultApplications` built its lookup with
 `new Map(entries)`, which keeps the last pair, so whichever branch the value walk emitted last decided
 the answer for both. The effect and capability passes iterate the call list directly and saw every
 edge, which is why three earlier effect probes looked clean and why the collision was invisible until a
 result use depended on it.

The consumer now unions every edge at a call site. Not merged into one edge: different callees have
 different slot layouts, summaries, captures and formal-to-actual mappings, so a merged edge would state
 a relation neither callee has. After the fix both halves agree at `opaque=[2,0]`.

The pair is now a fixture asserted for agreement rather than for a count, since neither half offers
 anything, so a regression shows up as the two halves disagreeing rather than as a number moving.

### What the three fixes cost in fixture offers

51 to 55 to 57 to 60 across the concise body, the callback capture, the named default and the order pair,
 every arrival a control or a helper's own parameter and never a subject. Four mutants, four exact
 deltas: 57 to 58, 57 to 59, 60 to 61 for the resolver, and 60 to 61 for the edge union, that last one
 restoring exactly one half of the order pair.

### The third site, found by checking rather than assuming

#93 was marked done after the argument path and the edge builder were converted. Measuring the shape the
 remaining site owns showed it still offered:

```text
handSingleCalleeOut:       {"opaque":[1,0]}  closure invoking one named callee, charged
handConditionalCalleeOut:  {"opaque":[2]}    closure invoking a conditional callee, slot 0 OFFERED
```

`calledCallables` in the reach walk still used the narrow resolver alone. The handed closure names
 neither the configuration nor the body reading it, so the reach walk is the only channel that can
 answer, and a conditional callee has no single declaration for that resolver to return. Converted, and
 both shapes now agree.

Worth keeping as a method note: the task was closed on the strength of having changed the sites the
 investigation had named, not on having measured the relation again. One more measurement reopened it.

### #97 closed without a change of its own

Every form it collected now charges, which is what its reduced description predicted:

```text
storeSinglePassDefault   {"opaque":[1,0]}    named default, closed by the shared resolver
storeIdentityPassDefault {"opaque":[1,0]}    concise default, closed by the concise-body fix
storeInlinePassDefault   {"opaque":[1,0]}    concise default, same
storePassFirstDefault    {"opaque":[2,0]}    conditional default, closed by the edge union
storeAllocFirstDefault   {"opaque":[2,0]}    conditional default, same
storeDirectPassResult    {"opaque":[0]}      unchanged
storeAliasPassResult     {"opaque":[0]}      unchanged
```

So the symptom that opened #97, a defaulted callee's returned fact never reaching a store of its result,
 was three separate defects wearing one appearance: an empty returned set for concise bodies, a resolver
 that could not name a callable through an identifier, and a lookup that kept one edge per call site.
None of them lived in the substitution walk, where two reviews and my own first two readings placed it.

## A call result handed to a callback parameter

The same early return, a different channel. #91 was a capture packaged as a closure; this is a call
 result handed as an ordinary argument.

```text
handResultToCallbackParameter:      {"mutated":[1],"opaque":[],  "returned":[]}  slot 0 OFFERED
handFreshResultToCallbackParameter: {"mutated":[1],"opaque":[],  "returned":[]}  control, correctly offered
handResultToMemberCall:             {"mutated":[], "opaque":[0], "returned":[]}  same result, charged
```

A relation cannot see through an inner call result, because a callee's summary does not exist while its
 callers are walked, so the relation records no source slot and the retention every argument carries was
 never reached. Falsified with a driver whose supplied callee retained the row and wrote through it.

The retention loop moved to `effect-argument-retention.ts` rather than being duplicated, since two paths
 need it. The deferral #75 settled is untouched, verified on the same control that guarded #91: a
 parameter-derived row forwarded to a callback keeps its relation and gains no opacity before and after.

### The pattern is now named, and one instance is left

Three defects have shared one shape: a branch classifies a call, answers its own question, and returns
 before something every call needs.

-    the callback branch, missing the capture gate, closed as #91
-    the callback branch, missing argument retention, closed here
-    the external-effect branch, missing any capture channel, open as #100

#100 is confirmed reachable rather than theoretical: `applyExternalEffect` does handle callback
 relations, and it maps them only through `argumentIndexes`, which is empty for a closure argument for
 exactly the reason #91 existed.

Worth stating as a rule for the next one: an early return in this function is a claim that everything
 after it is irrelevant to this kind of call, and that claim has now been wrong three times out of three.

## Every way source spells a property read

The accessor walk recognised plain property access only, and three other spellings run a getter just as
 surely. Measured, each offering the configuration its getter hands out while the plain form charged it:

```text
handPlainAccessOut:            {"opaque":[1,0]}  recognised, charged
handElementAccessOut:          {"opaque":[1]}    slot 0 OFFERED
handDestructuredAccessOut:     {"opaque":[1]}    slot 0 OFFERED
handClassDeclarationAccessOut: {"opaque":[1]}    slot 0 OFFERED
```

The class form needed two hops rather than one, which the first attempt got wrong: widening the
 recognised aggregates to include a class declaration left it offered, because the receiver resolves to
 `new Holder()` and a construction is not an aggregate. Following the construction to the class it names
 closed it.

Both spread kinds join, though a first draft of this paragraph gave them one shared reason that only one
 of them has. Measured directly rather than reasoned about: `{ ...holder }` logged `getter`, and
 `[...holder]` logged `iterator` and never touched the getter. An object spread runs every getter the
 source declares; an array or argument spread runs `Symbol.iterator` instead. What they share is the
 relation this walk asks about, reaching a callable the aggregate declares without writing a call.

Which property was read stays untracked, exactly as the aggregate descent declines to track keys, so a
 computed key needs no separate handling.

No fixture charges the array-spread clause, and the honest reason is that the reachable shape needs a
 receiver declaring `Symbol.iterator`, which raises a separate untested question about whether a yield
 carries a returned fact. The clause can only add an origin, so an unreachable one withholds nothing.

Mutant removing element access and the construction hop restored exactly those two offers, 63 to 65,
 leaving the destructuring hop's subject charged.

## Where the queue stood after the capture-channel stretch

Landed in this stretch, each falsified at the five-clause bar, each pinned by a fixture group with
 controls, each with a mutant that died at an exact delta: #88, #98, #91, #93, #89, #99, #94, plus the
 #96 documentation correction. Fixture offers moved 49 to 63 across them, every arrival a control or a
 helper's own parameter and never a subject.

Open, with what is known about each:

-    **#90** and **#92** share the `completionCanCarryState` fallback. Both located by reading, neither
     measured. A fix to either changes what the other sees, so measure both before changing either.
-    **#95**, tagged templates as invocations. Located by reading.
-    **#100**, a capture channel for external effect application. Confirmed reachable rather than
     theoretical, and the last instance of the early-return pattern.
-    **#81**, **#82**, **#87**, precision or cost rather than soundness.
-    **#54**, declined with the reason recorded.

The instrument note from the null sweep applies to everything above: each of these fixes withholds
 silently, so a sweep can only fail them and never confirm them, and the fixture group plus the mutation
 check carry the whole weight.

## Sweep five, pre-registered before the capture

Written before the run, so the capture can contradict it.

Four of the landed fixes widen walks rather than adding a branch to one. `calledCallables` went from one
 resolution per call to a `possibleValueNodes` walk plus a resolve per candidate, and `accessedCallables`
 now triggers a reach walk for element accesses, destructuring declarations and both spread kinds, plus a
 symbol resolution per construction. Both of those run per item of a worklist.

So this sweep has two jobs rather than one, and the second is free.

### Job one, the offer-loss sampling rule

Every prior sweep in this document made the same negative claim, that offers did not move, and the last
 one moved nothing at all. That makes the clause about falling offers untested rather than satisfied.

This is the first sweep where a drop is likely. #93 makes a named callable resolvable through defaults,
 conditionals and aliases at every site that resolves one, and #94 makes every destructuring declaration
 a getter-read site. The workspace stood at thirty-one offers, so a large proportional drop is available.

The rule, fixed now: for each offer that leaves, name which landed fix explains it, and confirm the
 escape it now withholds for is real by the same five-clause bar a fixture subject faces. An offer that
 leaves with no fix explaining it is over-withholding, and over-withholding at scale is a decision to
 surface rather than a line in a log.

Predicted: offers fall, and every loss is explained by #93 or #94.

### Job two, the cost measurement #87 was waiting for

#87 has been open as insurance with an explicit gate, that it must be justified by measurement before
 anything is memoised. The measurement is available here at no extra cost, because a sweep is a full
 workspace run and its runtime is a number.

The comparable runs, all full workspace sweeps at the same thread count:

```text
sweep-86   7m58s
sweep-91   8m44s
```

Predicted: this run lands near those rather than doubling, because the widened walks are bounded by the
 same file filter the narrow ones were. If it lands near them, #87 closes as declined with a measured
 reason instead of staying open as a hunch. If it doubles, #87 becomes a measured problem, and the memo
 keys are already named by the walks that grew: `callableResultCanCarryState`,
 `transitiveCallableOrigins`, and now `packagedActualCallables`.

Runtime is recorded beside the finding deltas from here on, not as an aside. A correctness sweep that
 also answers a cost question is the cheapest measurement available, and treating runtime as incidental
 is how #87 stayed a hunch for as long as it did.

## The audit that should have replaced six separate discoveries

Six defects in this work have been the same defect. #69, #79, #86, #91, #100 and #95 were each found
 separately, filed separately, and reasoned about separately, and every one of them is this:

**A channel maps ordinary parameter origins and has no capture channel.**

Captures are kept beside ordinary origins and never folded into them, which is a decision recorded in
 the handover with its reasons and which remains right. An ordinary origin says the callee received the
 caller's value. A capture says only that invoking a callable can reach the parameter. Folding them
 would reach the unresolved boundary and withhold on ordinary `map` and `filter` code.

The systematic consequence went unstated until now: every channel written against ordinary origins has
 a capture hole until someone adds one, and nothing in the code says which channels have.

So the audit is one grep against another. Every site calling `parameterIndexes`, which is the
 ordinary-origin mapper, against every site with a capture channel.

Channels that map ordinary origins **and have** a capture channel:

-    the owned call edge, through `capturedOriginsByFormal` (#69)
-    the foreign-borrowed edge, through the same field
-    the unresolved boundary, through `recordUnresolvedCaptureOpacity` (#79, #86)
-    the callback call branch, through the same (#91)
-    the assignment and iteration stores, through `transitiveCallableOrigins` (#51)
-    the returned callable, through the same

Channels that map ordinary origins **and do not**:

-    external effect application (#100)
-    the construction handoff (#102)
-    the yield handoff (#103)
-    the tagged-template handoff (#95)
-    the throw handoff (#103)

The split is not scattered. Four of the five are every function in `effect-outward-handoff.ts`, and that
 module is the one module among these that does not import from `effect-callable-capture-closure.ts` at
 all. The fifth, external application, is its own module and does not import it either. So the boundary
 of the hole is exactly a module import boundary, and it was visible without reading a single function
 body.

Two things follow, and the second is the one worth keeping.

The queue gains three items that no hunt pass produced, #102 and #103, filed with their shapes rather
 than as suspicions.

And the method gains a check that would have produced all six at once. When a design deliberately keeps
 two kinds of fact apart, enumerate every consumer of the first kind and ask which consume the second.
 The answer is a grep, it is available the moment the second kind exists, and it does not depend on
 imagining the shapes that reach each site. Four escape-channel hunt passes drew 44 channels and found
 none of these five, because a hunt pass samples shapes while this samples the code.

The honest limit on it: the audit says which channels lack the capture channel, not which of those
 channels a real escape can reach. #100's shape is confirmed reachable, #95's is argued, and #102's and
 #103's are unmeasured. Each still needs its own falsification at the five-clause bar before anything is
 built, and a shape that turns out unreachable is worth recording as unreachable rather than quietly
 fixing.

## Sweep five, against its own pre-registration

Commit `5e7cdfd83`, both artifacts rebuilt in order, both digests recorded before the run and re-verified
 identical after it. The two doc commits that landed while it ran left both unchanged.

```text
before 2004: argument-opacity=1282 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
after  2005: argument-opacity=1283 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
added   3: argument-opacity=3
removed 2: argument-opacity=2
runtime 8m54s
```

### Job two answered, and #87 closes on it

Predicted near the prior runs rather than doubled. Measured:

```text
sweep-86   7m58s
sweep-91   8m44s
sweep-94   8m54s
```

Three full sweeps, each after a rebuild, so each cold. Four walk-widening fixes landed between the first
 and the last, and the total movement is under a minute across the series, well inside what machine load
 accounts for. No cost class changed.

So **#87 closes as declined with a measured reason** rather than staying open as insurance. The gate it
 carried was that memoisation must be justified by measurement, and the measurement says there is nothing
 to justify. Should a later change move this series materially, the memo keys are already named:
 `callableResultCanCarryState`, `transitiveCallableOrigins`, `packagedActualCallables`.

### Job one, where the pre-registration was wrong

Predicted: offers fall, and every loss is explained by #93 or #94.

**Offers held at 31 and not one fell.** The prediction was wrong, and the sampling rule it existed to
 govern went untested for a second consecutive sweep.

The criterion itself is satisfied on every clause that matters. Offers did not rise, which is the only
 soundness statement available. No category other than argument opacity moved: receiver opacity held at
 648, dishonest at 37, stale-mutates at 6.

### The five that moved, each attributed

Two of the three additions are two of the removals with an enriched call list, not findings appearing
 beside findings leaving:

-    `watch-supervisor.ts:237` on `signal` gained `signal.addEventListener [watch-dir.ts:243]` beside the
     `wait` call it already named.
-    `watch.ts:190` on `controller` gained a signal call beside the ones it already named.

The one genuine addition is `browserslist-targets.ts:905` on `generatedFileUrl`, naming
 `fileURLToPath [generated-file-exists.ts:18]`.

All three trace to one cause, and it is the same cause:

```ts
export async function browserslistTargets({
  generatedFileUrl = GENERATED_BROWSERSLIST_URL,
  exists = generatedFileExists,
  ...

export async function watchDirectoryWithRestarts({
  signal,
  watchDirectoryImpl = watchDirectory,
  ...
```

A **defaulted callable parameter**, resolved to the callable its default names, followed into another
 file, and the caller's value found reaching an unresolved call inside it. `generatedFileExists` calls
 `fileURLToPath(fileUrl,)`; `watchDirectory` calls `signal.addEventListener` at `watch-dir.ts:243`. Both
 run whenever a caller omits the argument, so all three findings are true at their own source, and the
 rule's text is literally correct: it cannot inspect `fileURLToPath`.

That is #93, the one shared callable-value resolver, which is exactly a fix the prediction named. So the
 attribution half of the sampling rule worked. The direction was what the prediction got wrong.

### Why the direction was wrong, stated so it does not have to be learned again

The prediction reasoned that a fix which resolves more callables withholds more, and withholding more
 costs offers. The first half is right and the second does not follow.

Offers are 31 findings out of 2005, and they are not a random 31. They are the parameters that have
 already survived every other channel this rule has. A new withholding reason lands on the population it
 finds, and that population is 1974 parameters already withheld for some other reason. Seeing more calls
 therefore enriches existing reports and adds reports on already-withheld parameters, which is precisely
 what all five movers are.

This is the null sweep's explanation confirmed a second time, and now with a nonzero delta rather than
 with zero, which is the stronger form of the same evidence. The instrument note stands and gains a
 direction: **a sweep measures what a fix does to the already-withheld majority, and says almost nothing
 about the offered minority either way.**

The honest consequence for the criterion. The clause "offers falling is expected, and each fall is
 sampled to its cause" has now gone untested three sweeps running. It should be rewritten to say what is
 actually true: an offer falling would be surprising, worth sampling hard when it happens, and its
 absence is not evidence that a fix withheld nothing.

## The shared completion fallback, measured before anything was designed

Both suspected defects reproduce, one of my two probe shapes measured a different defect than I
 attributed it to, and one of sol's four extra findings does not reproduce at all. All four of those
 outcomes came from the same probe run, which is the argument for running it before writing the fix.

### The void completion reproduces, and its basis is verified against the compiler

```text
forwardVoidProducer     mut=[0] opq=[1]
candidateVoidProducer   mut=[]  opq=[1]
forwardVoidReport       mut=[]  opq=[1]
```

`candidateVoidProducer` hands `(): Row => config.row` to a formal annotated `() => void`, and records
 nothing at all about `config`, so `config` is offered. The forwarder keeps the closure in a registry.

The basis is not return-type bivariance, which is what an earlier note in this document called it.
 Ordinary return types are covariant. What applies is TypeScript's specific rule permitting a
 value-returning function where a `void`-returning one is expected. Verified rather than recalled, with
 a file whose control carries `@ts-expect-error`:

```ts
export const acceptedAsVoid: () => void = produceRow;
// @ts-expect-error a row-returning callable is not assignable where a string-returning one is wanted
export const acceptedAsString: () => string = produceRow;
```

It compiles clean, which says both halves at once: the void assignment is permitted, and the
 `@ts-expect-error` was consumed rather than unused, so the string assignment is an error. Had the
 directive been unused, TS2578 would have said so.

So a `void` return annotation on a callable *type* constrains nothing about what the callable returns,
 while a `string` one does. That asymmetry is the whole basis, and it is now measured.

`forwardVoidReport` is the control and it is clean, which matters because its completion is
 `reportLabel(config.row.label,)` and `reportLabel` returns `void`. Distrusting `void` naively would
 withhold here.

### The exhaustiveness defect reproduces, and the cleanest statement of it is a diff of two forwarders

Two forwarders differing in exactly one token sequence:

```ts
export function forwardBareProducer(registry: FormRegistry, producer: () => Row | string,): void {
  registry.keep((): Row | string => producer(),);
}

export function forwardDefaultedProducer(
  registry: FormRegistry,
  producer: () => Row | string = (): string => 'leaf',
): void {
  registry.keep((): Row | string => producer(),);
}
```

```text
forwardBareProducer         mut=[1] opq=[0,1]
candidateBareProducer       mut=[]  opq=[1,0]

forwardDefaultedProducer    mut=[1] opq=[0]
candidateDefaultedProducer  mut=[]  opq=[1]
```

**Writing a default removes a withholding that the same code without the default has.** With no default
 the candidate list is empty, the static classification decides, `Row | string` carries state, formal one
 is opaque and the caller's `config` is charged. With the default the list holds one callable, that
 callable hands back a string literal, `some` answers false, formal one is not opaque and the caller's
 `config` is offered.

No void is involved and no assignment is involved, so this isolates the exhaustiveness assumption by
 elimination rather than by argument. The control `candidateFreshProducer`, handing `allocateRow` to the
 same formal, is clean as it should be.

### One of my two probe shapes measured a different defect than I filed it under

I filed a binding filled by assignment as the exhaustiveness shape. Discriminators say otherwise:

```text
storeDirectClosure          opq=[1,0]   charged
storeInitializedSelector    opq=[1,0]   charged
storeAssignedSelector       opq=[1]     clean
storeFreshSelector          opq=[1]     clean, correctly
```

`storeInitializedSelector` charges, so the walk does follow a call to a local callable and judge what it
 hands back. `storeAssignedSelector` differs from it only in filling the binding by assignment rather
 than by initializer, and it goes clean. So the gap there is the **value walk not following an
 assignment**, which is #82's subject, and the completion gate is not what decides it. A fix to the
 completion gate would have appeared to do nothing on that shape, and I would have had a passing fix and
 a live defect.

### Sol's throw finding does not reproduce, and why is worth keeping

```text
storeThrowingClosure    opq=[1,0]   charged
```

`completionExpressions` really does collect returns and yields and not throws, so the reading was right
 about the code. The shape is charged anyway, because an activated closure's body is scanned inline as
 part of the enclosing callable, and `recordThrowHandoff` fires there. A second channel already covers
 it.

This is the third time a reviewer reading these files has been right about the code and wrong about the
 consequence, always in the same direction: the activation premise makes the enclosing callable's
 channels apply inside an activated closure, and it is not visible from the file the gate lives in. Worth
 stating in the module rather than rediscovering.

### The design that follows, with its deferral named

Sol's completeness-aware join, ranked above an unconditional disjunct because only it distinguishes
 evidence from a guess:

```text
if any known candidate carries state        -> true
if the candidate list is exhaustive         -> false
otherwise                                   -> fallback classification
```

That unifies the two defects rather than stacking them: the empty list and the non-exhaustive list both
 route to one fallback, and the fallback is where `void` stops being trusted. It also answers the
 combined shape neither fix alone handles, a formal defaulting to `(): void => {}`, which has a known
 leaf candidate, an unknown supplied alternative and a statically void result.

The fallback's scope, decided rather than left open. `void` is distrusted when the callee resolves only
 to a **value slot** of callable type, a parameter, a mutable local, a property. It stays trusted when
 the callee resolves to a callable declaration, which keeps `String(...)`, `console.log(...)` and
 `reportLabel(...)` offered and is what the `forwardVoidReport` control demands.

Two things are deliberately not in scope, both filed rather than dismissed:

-    A method **signature** returning `void` is a value slot wearing a declaration's clothes, since a
     structural implementation may legally return a value. Trusting it is unsound and distrusting it costs
     `console.log`, which is declared as a member of the `Console` interface. Filed.
-    A non-void primitive return on a non-exhaustive slot can conceal state through
     `as unknown as () => string`. Reachable only with a deliberate double cast, where the void case is
     reachable in well-typed assertion-free source, which is the difference that justifies treating them
     differently for now. Filed.

## Sweep six, pre-registered

Two fixes land in it, and unlike every sweep before this one the workspace is known to contain the shape
they target. Sweep five's own deltas named `exists = generatedFileExists` and
`watchDirectoryImpl = watchDirectory`, both defaulted callable formals, which is exactly what the
candidate-list join now refuses to treat as a closed set.

So the sampling rule that has gone untested three sweeps running should finally fire.

Predicted, and stated so the capture can contradict it:

-    **Offers fall.** This is the first sweep where that is the expectation rather than a hedge.
-    Every loss is explained by one of two named causes: a formal whose default no longer answers for
     every value it can hold, or a completion whose `void` came from a slot rather than from a
     declaration.
-    The second cause has a known precision cost measured before the sweep: a closure completing with
     `console.log` now withholds, because that name resolves to a member signature on a variable's type.
     If lost offers are dominated by logging closures rather than by retained producers, that is the
     signal to recover precision by trusting an ambient declaration file's slot, and it is a decision to
     surface rather than a line in a log.
-    Argument opacity rises.
-    Nothing else moves.

Runtime recorded beside the deltas as a matter of course now. The join adds one call per completion on a
 path that already resolved candidates, so no cost class change is expected.

### Withdrawing sweep six's premise, before the capture was read

The pre-registration above rests on a claim that is wrong, and it is being withdrawn here rather than
 quietly dropped after the numbers arrive.

The claim was that the workspace demonstrably contains the candidate-list fix's target shape, because
 sweep five's deltas named `exists = generatedFileExists` and `watchDirectoryImpl = watchDirectory`.

Those deltas are the **ordinary origin** path, not the capture path. `generatedFileUrl` was charged
 because it flowed into `generatedFileExists` as an argument through a defaulted callee edge, and that
 callee calls `fileURLToPath`. A direct call, not a closure.

The candidate-list fix only bites when a defaulted callable is invoked **inside a closure handed to an
 uninspectable callee**. Neither delta shows that combination occurs here. A defaulted callable formal
 existing in the workspace is not evidence that one is invoked inside a retained closure.

So the prediction stands as a prediction and its stated reason does not. Two consequences for reading the
 capture:

If offers hold, the already-withheld-majority explanation must not be reached for again. The first
 question is whether the shape occurs at all, which is a syntax count rather than a finding count.

And the more likely mover is the **void fix's precision cost**, not the candidate-list fix's soundness
 gain. A retained closure completing in a void method call on an interface-typed value is the shape, and
 `.then(() => logger.info(x,),)` is exactly it. This repository mandates extensive logging, so that shape
 is common here in a way the other is not.

The remedy this document pre-registered for that cost also misses. Trusting a slot declared in an ambient
 file covers `console`, and covers neither an interface declared in analysed source nor anything else a
 logger reaches through. A repository-owned logger whose method is a `MethodDeclaration` already resolves
 and already stays trusted, so it was never the problem. If losses are logging-shaped the remedy needs
 deriving from what the losses actually name.

### The attribution invariant, which makes the sampling mechanical

For these two fixes a lost offer cannot be silent, and that is a checkable property rather than a hope.
 Both withhold through the capture channel, which records with `addOpaqueEffect` and carries provenance
 naming the retaining call. So the parameter that loses its offer reappears as an argument-opacity finding
 naming that same parameter.

The invariant: **every lost offer has a matching added finding naming the same parameter.** The added
 finding's callee text then says which fix did it, and reading the completion at that site separates them.
 A void call through a slot is the void fix. A call through a defaulted or otherwise slot-held callable
 with a non-void result is the candidate-list fix.

An offer that vanishes with no added finding naming it is not noise. It means something withheld through
 a channel that does not speak, which is not what either fix does, and it needs chasing rather than
 tallying.

This replaces per-loss manual reasoning with a rule that can fail, which is the point.

## Sweep six, read against a prediction whose premise was already withdrawn

Commit `d1586f194`, both artifacts rebuilt in order, both digests recorded before the run and re-verified
 byte-identical after it.

```text
before 2005: argument-opacity=1283 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
after  2006: argument-opacity=1284 receiver-opacity=648 dishonest=37 offer=31 stale-mutates=6
added   1: argument-opacity=1
removed 0:
runtime 8m48s
```

Runtime lands in the series at 7m58s, 8m44s, 8m54s, 8m48s. No cost class changed, which is what #87's
 closure already concluded and this confirms across two more landed fixes.

**Offers held at 31 and the prediction that they would fall was wrong again.** Its premise had already been
 withdrawn in the section above, before the capture was read, so this is a prediction failing on a reason
 already recorded rather than a new surprise.

The attribution invariant is vacuously satisfied: no offer was lost, so there is no loss needing a matching
 finding. It remains the right instrument and has still never been exercised.

### The one added finding, and the cause is sharper than the prediction expected

```ts
async function checkCompletedChildren(
  { parentSessionId, consume, env = process.env, }: { /* ... */ },
): Promise<string | typeof NOTHING_TO_REPORT> {
  const entries = await readSpawnsDir(env,);
  const candidates = await Promise.all(entries.map(
    function readCandidate(filename,): Promise<string | typeof SKIPPED_CHILD> {
      return consumeMatchingChild({ filename, parentSessionId, consume, env, },);
    },
  ),);
```

`env` is captured by a closure handed to `entries.map`, and the finding names that call.

It is the candidate-list join that produced it, and not through the shape the join was built for. The
 completion is `consumeMatchingChild(...)`, an owned call whose body returns strings, so the candidate
 answer is false exactly as before. The declared answer now joins it, and the declared type is
 `Promise<string | typeof SKIPPED_CHILD>`. A promise is an object by the leaf test, so the declared answer
 is true, so the capture is charged.

**Every async function's declared return type is an object even when what it resolves to is a leaf.** That
 is the precision cost the review predicted for an unconditional join, and it arrives through the most
 ordinary idiom in this workspace rather than through an exotic one: a mapping closure that returns a
 promise.

The finding is conservative rather than true. `Array.prototype.map` does not retain its callback, and the
 promises it collects come back to this caller. Withholding on it is safe and imprecise.

### What it actually cost, measured rather than feared

Nothing that a reader can act on and nothing a consumer can observe:

-    No offer moved, so `env` was already withheld for other reasons and remains so.
-    One diagnostic gained one more call in its list.
-    The load-bearing precision claim survives unchanged, because
     `rows.map((row) => config.row.label,)` completes with a string and is untouched.

So the cost is one sentence in one existing diagnostic, workspace-wide. Filed rather than fixed, because
 the fix is a narrow one worth doing on its own evidence rather than bundled here, and because the safe
 direction is the one it currently takes.

### The correction this makes to how the join was justified

The commit that landed the join said its cost is "precision only where a declaration is looser than its
 body". That is true and it undersold the frequency, because it read as an unusual case. An `async`
 function's declaration is looser than its body by construction, for every async function ever written, so
 the affected population is not unusual at all. What keeps the measured cost at one finding is not that the
 shape is rare but that the parameters it reaches are already withheld.

That is worth separating, because the two would come apart in a codebase with more offers.

## The capture-channel audit, reviewed before implementing any of it

The audit named five channels lacking a capture channel and I planned the external one first. Review
 corrected the plan on a soundness point, which is worth recording as the reason to review a plan and not
 only a diff.

### My split of the external summary was unsound

The plan charged captures at positions the external summary marks opaque or as a callback-relation source,
 and charged nothing at `invokedParameterIndexes`, reasoning that invoked-but-not-retained is the mapping
 case that must keep its offer.

`invokedParameterIndexes` proves the callback is **invoked**. It does not prove its result is **discarded**:

```ts
export function reveal(producer: () => Row,): Row {
  return producer();
}

export function retainResult(producer: () => Row,): void {
  retainedRow = producer();
}
```

Neither retains `producer` and both expose what invoking it hands back. The summary can say only that
 `producer` was invoked, because that result has no ordinary parameter origin. `map` and `filter` differ the
 same way: `filter` consumes results as predicates while `map` keeps them in the array it returns.

So the corrected mapping charges exposed captures at invoked positions too, and the load-bearing precision
 case survives for a different reason than the plan assumed. `rows.map((row) => config.row.label,)` keeps
 its offer not because `map` was skipped but because the **result-sensitive gate** answers that a closure
 completing with a string exposes nothing. The gate has to be the existing one from
 `effect-unresolved-capture.ts`, never raw lexical captures.

Three options were ranked, and the ranking is worth keeping because the top one is deferred rather than
 rejected:

-    **An explicit result-disposition fact**, positively certifying that an implementation discards every
     invocation result, with absence meaning unknown and therefore charging. Distinguishes `filter` from
     `map` and preserves offers where the implementation proves discard. Costs agreement between summary
     production, transport and application.
-    **Charging exposed captures at every invoked position.** Sound against the summary that exists today,
     and primitive-returning callbacks keep their offers. Withholds for a mutable-returning callback whose
     result is demonstrably discarded.
-    **Skipping every invoked position**, which was my plan. Maximum precision and unsound for a returned,
     stored, forwarded or mutated callback result.

Disposition beats conservative charging on proven precision; conservative charging beats skipping because it
 is sound at all. So the second lands now and the first is filed.

Captures must travel beside ordinary origins rather than appended to them, which is the same separation the
 whole design rests on.

### Activation does not cover the construction handoff, and the argument is precise

I had asked whether the activation premise covers `new Keeper((): Row => config.row,)`, having already been
 caught once by that premise covering a throw I thought was a hole.

It does not, and the distinction is exact. Activation covers effects the closure body **performs**, which is
 why a direct write or a `throw config.row` inside an activated closure is charged. Returning `config.row`
 is neither a mutation nor an outward handoff from the enclosing callable, and the constructor's later use
 of that returned value has no call edge to carry it.

The proof that this is the right reading is already in the repository: the measured
 `registry.register((): Row => registered.row,)` case is the same semantic shape, that closure was
 activated, and it still required the capture channel. So the two cases agree.

One implementation constraint follows. The `honest-readonly` early return in `recordConstructionHandoff`
 does not prove safety for a capture, because it describes writes reaching **through** the handed value and
 not values obtainable by **invoking** a callable that value carries. Capture processing has to happen before
 that early return, or independently of it.

### Yield and throw are reachable, and the capture query must descend through aggregates

```ts
function* expose(config: Config,): Generator<() => Row> {
  yield (): Row => config.row;
}

function exposeByThrow(config: Config,): never {
  throw { produce: (): Row => config.row, };
}
```

The distinction that matters, because it is the one that made the earlier throw finding a non-defect:
 `throw config.row` is covered by ordinary origins, and `throw config.row` inside an activated closure is
 covered by the throw handoff scan. Throwing a **closure**, or an object **carrying** one, is neither: the
 thrown expression has no ordinary origin and the closure only returns the captured value.

So the capture query cannot be the direct-callable helper alone. It must descend through aggregates, and the
 same requirement applies to arrays, yielded aggregates and constructor argument objects. Exporting the
 direct helper and testing only the bare-closure form would leave the object form open while looking done.

### The grouping this settles

The four outward handoffs are **one change**: construction arguments, yielded values, tagged-template
 interpolations and thrown values all hand a value to an uncontrolled consumer, and they differ in syntax
 only. External invocation-result disposition is a **separate semantic change**, because an inspected
 implementation can prove more than an opaque handoff can.

Order: characterise external callback result escape and discard first, since that decides the summary
 contract; extract one reusable query returning result-exposing captured origins with ordinary origins kept
 separate; apply it to external application; then update all four handoffs together.

### Four more findings from the same review

The tagged template misses the **tag itself**, not only its interpolations. `tag\`\`` has no template spans,
 so the recorder adds nothing at all, and `config.mutatingTag\`\`` can affect its receiver with no
 interpolation either. Adding capture handling to interpolations alone does not close it, which changes #95
 from one fix into two.

The construction handoff misses invocation of the **constructor expression** itself. A local class or
 constructable function can close over the configuration and run that closure during `new C()` with no
 arguments at all.

The external positional mapping rests on an unproven precondition. `applyExternalEffect` indexes an
 actual-position array with formal parameter indexes, and its own comment says that holds only for a plain
 positional call. Whether `externalEffectResolver` rejects spread and rest mappings is unverified; if it does
 not, `external(...tuple,)` is an existing ordinary-origin hole and a new capture array would inherit it.

And `effect-outward-handoff.ts`'s module header still says two syntax sites while the module handles four.

## The outward handoffs, measured, fixed and mutation-checked as one change

Before, with a control beside every subject:

```text
handClosureToConstruction        opq=[]   handFreshClosureToConstruction  opq=[]
yieldClosureOut                  opq=[]   yieldFreshClosureOut            opq=[]
throwClosureOut                  opq=[]   throwFreshClosureOut            opq=[]
handClosureToExternalMapper      opq=[]
```

Subject and control identical at every site, which is the signature of a channel that does not run rather
 than one that answers wrongly.

After:

```text
handClosureToConstruction        opq=[0]  handFreshClosureToConstruction  opq=[]
yieldClosureOut                  opq=[0]  yieldFreshClosureOut            opq=[]
throwClosureOut                  opq=[0]  throwFreshClosureOut            opq=[]
handClosureToExternalMapper      opq=[]
```

Fixture offers 65 to 68, exactly the three controls. The mutant emptying the shared recorder restored all
 three, 68 to 71. Construction and yield were falsified at the bar with a driver observing the caller's own
 state change.

### Two shapes the review expected to be open and were not, or were

The aggregate-descent worry was that a thrown object carrying a closure has no ordinary origin, so the
 capture query would need to descend through aggregates or the object form would stay open while the bare
 form looked done. Measured:

```text
throwAggregateClosureOut     opq=[0]   already charged
handAggregateToConstruction  opq=[]    still clean
```

`throw { produce: (): Row => config.row, }` was **already charged** before this fix, through the
 object-literal descent the ordinary origin channel gained in #57. So the descent exists and this change
 needed nothing for it.

What stayed clean is `new ProducerKeeper({ produce: ... }.produce,)`, a **property read** off the literal
 rather than the literal itself. That is the value walk's gap, not the handoff channel's, and it is
 #106. Recording which of the two forms is open matters, because "aggregates" named both and only one is.

### The external channel is not the shape I probed

`handClosureToExternalRetainer`, handing a capturing closure to `setTimeout`, measured `opq=[0]` **before**
 any of this. A host global has no shipped implementation to resolve, so that call never reaches
 `applyExternalEffect` at all; it goes to the unresolved boundary, which has had a capture channel since
 #79.

So #100 needs a callee with a resolvable shipped implementation, a workspace or package export, and the
 probe written for it measured a different channel entirely. Worth recording because a green-looking probe
 there would have "confirmed" a fix that never ran.

## The external positional mapping is fail-open, and it predates all of this

Review flagged that `applyExternalEffect` indexes an actual-position array with formal parameter indexes and
 that its own comment admits the two coincide only for a plain positional call. The question was whether
 `externalEffectResolver` rejects spread and rest, making the precondition moot.

**It does not.** Every rejection path in `external-callable-effect.ts` was read: installed-package identity,
 authored import identity, version locking, and shipped implementation resolution. None inspects the call's
 argument shape.

And the asymmetry that made this suspect is confirmed. The owned path builds `formalActualPositions`, whose
 own comment says it covers `this`, rest and spread, which is #23's work. The external path has no
 equivalent and maps straight through `call.arguments.map(...)`.

Both failure directions drop facts rather than invent them, which is the unsafe direction for a channel whose
 job is to withhold:

-    `external(...tuple,)` produces one entry, for the spread element. A proven mutation of external formal
     one reads index one, finds nothing, and the optional chain records nothing. **A proven mutation is
     silently dropped.**
-    A rest formal proven mutated reads index zero and charges the first actual only, missing every later
     one.

So an offer can stand where the external analyzer proved a mutation. This is pre-existing and has nothing to
 do with captures.

The ordering consequence matters more than the finding. **#111 lands before #100**, because #100 adds a
 capture array indexed the same way, and stacking a second fact on a broken index would inherit the same
 fail-open twice over. Filed unmeasured and honestly so: it needs an installed package whose shipped
 implementation provably mutates a formal, invoked with a spread, and the reading is confident rather than
 verified.

### The external mapping fix was built, proved unpinnable, and reverted

The fix was written: move the mapping inside `applyExternalEffect` so no caller can hand it the wrong index
 space, build a formal-indexed array from `formalActualPositions` when the resolved declaration has readable
 formals, and fall back to the union of every argument's origins both when no formal list can be read and
 when the summary names a formal past the end of that list. Over-approximating is the safe direction, since
 charging an unaffected argument costs an offer while failing to charge an affected one keeps a false offer.

It type-checked, linted clean, and left the whole suite green. Then the mutation check answered the question
 that matters:

```text
mutant: formal mapping removed, actual-position indexing restored
result: entire suite green
```

**The mutant survived.** So no shape in the fixture corpus reaches this path through a diagnostic, and the
 reason is structural rather than an oversight: reaching it needs an installed package with a locked version
 whose shipped implementation provably mutates a formal, invoked with a spread. The corpus contains no such
 call and cannot contain one without a new fixture dependency.

So the fix was reverted. This document already records the standard: landing a path no test reaches,
 documented as a fix, is worse than leaving the defect recorded. Having just demonstrated it is unreached,
 landing it anyway would be the same error with the evidence in hand.

What it needs is a test that fails without it, and there are two routes. A fixture package whose shipped
 implementation mutates a formal, which is the honest end-to-end version. Or exporting the mapping helper and
 testing it directly against overlay nodes, which is permitted for exactly this and is cheap, because
 `formalActualPositions` does not care whether the callee is external, so an owned declaration plus a spread
 call exercises the real logic.

One process failure is worth recording with it, because it cost the implementation. The revert after the
 mutation check deleted the fix rather than the mutant, since the fix had never been committed. The handover
 states this precisely and I skipped it: `git checkout --` restores to HEAD, so an uncommitted fix is what it
 removes. **Commit before mutating, without exception.** The lesson is cheap to state and was not cheap to
 relearn.

### The external mapping, landed on the second attempt with the test that decides it

The first attempt was reverted because its mutant survived the whole suite. The difficulty was never the
 fix; it was that nothing in the fixture corpus reaches this path through a diagnostic, and nothing can
 without adding a fixture dependency that is an installed package whose shipped implementation provably
 mutates a formal.

So the mapping is exported and exercised on its own, which the package already has a pattern for. The design
 that makes it a real test rather than a restatement: one distinct origin slot per argument position, so a
 mapping that reads the wrong position gives a visibly wrong answer instead of a coincidentally right one.

```text
mutant: formal mapping removed, actual-position indexing restored

plain positional      PASS   correctly, since this case must be unchanged
spread in the tail    FAIL   [[10],[20],[30]] where [[10],[20],[20]] is right
whole-list spread     FAIL   [[10],[20],[30]] where [[10],[10],[10]] is right
rest formal           FAIL   [[10],[20],[30]] where [[10],[20,30]] is right
unreadable formals    FAIL   [[10],[20],[30]] where [] is right
```

Four of five, and the one survivor is the case whose behaviour the fix deliberately does not change. That is
 the kill pattern a correct mutation check produces: indistinguishable exactly where the two implementations
 agree by design.

Three corrections came from the package's own lint and type check rather than from the test passing, and the
 third improved the test rather than merely satisfying a rule. Synchronous test bodies where the harness
 types a returned promise. A helper typed by what the node walk returns rather than by what the mapping
 requires, so a node was being handed where a call expression is wanted. And `try...finally` per case, which
 this repository bans; removing it collapsed five sessions into one at module scope, since all five read the
 same overlay, matching the existing workspace-source test instead of inventing a second pattern.

The general point, since this is the second time an unpinnable path has come up. **When a fix's mutant
 survives, the question is not whether the fix is right but whether anything reaches it.** If the corpus
 structurally cannot, exporting the unit under test is not a workaround; it is the only honest way to hold it
 to the same standard as everything else here.

## The external channel has no coverage at all, which is the finding here

Measured while preparing the external capture channel, and it matters more than that fix does.

**Zero findings in the sweep-six capture carry package-version provenance.** That string is the only
 provenance the external path emits, built at `external-callable-effect.ts:268` as
 `name@version exportKey ...`. Grepped across the full 2006-finding capture: no match.

So `applyExternalEffect` never fires anywhere in this workspace. The entire external channel, with its
 documented contract, its version-locking guard, its four position kinds and its callback-relation mapping,
 is exercised by nothing.

That explains two things retrospectively. It is why the formal-mapping fix had to be pinned by exporting the
 unit rather than through a diagnostic. And it is why the capture wiring could not be pinned at all.

### The capture wiring was written and reverted, and both routes were closed

The design is settled and recorded on the task: captures computed per argument with the extracted gate,
 mapped through the same formal positions the ordinary origins now use, and charged as opacity at the opaque,
 callback-source and invoked positions, but not at the referent-mutated position.

Neither route that worked before is available:

-    **End to end** is impossible, since nothing resolves an external effect.
-    **Exporting the unit** does not help either. Proving a capture is charged needs a real
     `bindingOriginBySymbolId` for the enclosing callable, and the analyzer does not expose one. Passing an
     empty map makes the query answer empty, so the test would assert nothing.

So it was reverted, for the same reason the mapping's first attempt was: a fix whose mutant survives is not
 finished, and this one could not even be given a mutant that means anything.

### What did land, and it is pinned hard

`exposedCaptureOrigins`, split out of `recordUnresolvedCaptureOpacity` so a channel deciding **per position**
 can ask the same question the recorder asks. One gate rather than two, which is the point: a channel asking
 about raw lexical captures instead would withhold on every mapping closure, and keeping the
 result-sensitive gate as the single answer stops that being reinvented per channel.

The existing capture fixtures cover it thoroughly. Mutant emptying the query restored **17 offers**, 68 to
 85.

### The prerequisite this creates

Making one external effect resolve is now its own task, and it is worth more than the fix waiting on it. It
 needs a dependency satisfying all four resolver requirements, installed-package identity, an import or
 declaration-owner identity, a **locked** version, and a shipped implementation resolvable through package
 exports, whose implementation provably mutates or retains a formal.

It unlocks the capture wiring, gives the formal mapping an end-to-end test beside its direct one, and gives
 the external channel its first coverage of any kind. The last of those is the real reason to do it.

### Correcting the claim I just made about the external channel

I wrote that `applyExternalEffect` never fires anywhere in this workspace. That is stronger than what was
 measured and it is wrong as stated.

What was measured: zero findings carry package-version provenance. What that proves: the external channel
 never **charges** anything in this workspace. What it does not prove: that the resolver never **succeeds**.

The two come apart because a resolved external summary whose effect sets are all empty records nothing at
 all. `applyExternalEffect` iterates `referentMutatedParameterIndexes`, `invokedParameterIndexes`,
 `callbackRelations` and `opaqueParameterIndexes`, so a package function proven to do none of those produces
 no provenance and no finding. A clean external callee is indistinguishable in the capture from one that never
 resolved.

So the honest version of the finding, and it is still the finding:

-    The external channel charges nothing anywhere in this workspace, measured.
-    Whether it resolves anything is **unmeasured**, and the distinction matters because the two failure modes
     need different work. If it resolves and finds clean callees, the channel works and only its charging
     paths are untested. If it resolves nothing, the resolver's four requirements are not met by any call
     here and the untested surface is far larger.

Settling it needs either instrumentation on the resolver's success path or an installed dependency whose
 shipped implementation provably mutates a formal. The second is #113 and answers both questions at once,
 which is the reason to prefer it.

What does not change: the capture wiring stays reverted, because neither pinning route was available either
 way, and `exposedCaptureOrigins` stays landed and pinned.

The general lesson, which is the same one this document has recorded twice already in other forms. **An
 absence in a capture is evidence about what the rule said, never about what the rule did.** A silent channel
 and an absent channel produce identical output, which is precisely the instrument limit already recorded for
 store-caused withholding, arriving here from the opposite direction.

### Settled by instrumentation: the resolver succeeds nowhere here

The previous section left the question open and named the two ways to settle it. Instrumentation was the
 cheap one, so it was done: a temporary line on the resolver's success path, printing the provenance and the
 three effect sets it proved, then reverted.

```text
package/config/rolldown            no resolution
package/dev-script/file-enforcer   no resolution
package/module/pipe                no resolution
package/webapp-productivity/wc     no resolution
package/pi-plugin/spawn            no resolution
package/dev-script/watch-restart   no resolution   (an @optique/core consumer)
package/pi-shared/model-selection  no resolution   (a valibot consumer)
```

Seven packages chosen for third-party usage rather than at random, including consumers of the two most-used
 runtime dependencies in this workspace after `type-fest`, which is types-only and so cannot resolve by
 construction. **Zero successful resolutions.**

So the stronger claim holds after all, and now it is measured rather than inferred from an absence: the
 external resolver succeeds nowhere in this workspace, which means the branch it guards, the four position
 kinds, the version-locking gate and the callback-relation mapping have never run on real input here.

The narrower claim recorded in the previous section stands as the reasoning that got here, and both are kept
 deliberately. An absence in a capture could not distinguish a clean external callee from an absent one; only
 instrumentation could, and the difference decided how large the untested surface is. It is the larger one.

That makes #113 a coverage prerequisite rather than a convenience. A dependency satisfying all four resolver
 requirements, whose shipped implementation provably mutates or retains a formal, is the first test this
 channel would ever have.

## Two walks, two questions, one syntax

The value walk did not follow a destructuring source or a property read, and both were real. Measured
 first, with a control beside each subject:

```text
handDirectClosure             opq=[1,0]   baseline charges
handDestructuredClosure       opq=[1]     clean
handPropertyReadClosure       opq=[1]     clean
handFreshPropertyReadClosure  opq=[1]     clean, correctly
```

Both subjects now charge, the control is untouched, fixture offers moved 68 to 69 by exactly that control,
 and the mutant removing both paths restored both subjects at 69 to 71. Both falsified with a driver.

### The part worth carrying forward

#94 widened the **accessor reach** walk, which already handled a property read. It could not answer this.

Reach asks what a body can **get to**. The value walk asks what a given expression **holds**. The same
 syntax, `holder.producer`, appears in both questions and needs a separate answer in each. Nothing in either
 module said so, and reading one would have suggested the other was covered.

That is the third distinct instance of one shape in this effort: two relations that look like duplicates and
 are not. The others were captures against ordinary origins, and reach against the value walk in #93. The
 tell is the same each time: the same syntax appears in both, so a fix to one leaves the other silent, and
 only measuring the shape separates them.

### What it settles beside itself

The `exposingCallables` fail-open, folded into this task rather than tracked separately. Empty reads as
 "exposes nothing" there, and the only actual reaching it past the ordinary-origin channel is a
 non-parameter one, since a parameter handed straight to an unresolved call is already charged.
 `holder.producer` was exactly that non-parameter actual, and it is now followed. The fail-open has no
 remaining shape named for it, and the note stands should one appear.

### Method note on the fix itself

Both paths resolve through a **symbol** rather than by walking structure to the receiver. That is why an
 aliased holder, a conditionally chosen one and a parameter default all answer without their own branches:
 the checker has already decided which declaration a name refers to. Walking the receiver instead would have
 needed a case per way a receiver can be written, which is the shape of bug this effort has fixed repeatedly
 by asking where a value can have come from rather than what layer sits over it.

## The tagged template, whose defect was not where the task said

Filed as tagged templates going unrecorded. Measured, the recording was never the problem.

```text
storeThroughBareTag    opq=[]    nothing recorded
storeThroughBareCall   opq=[0]   recorded correctly
handClosureToTag       opq=[0]   already charged before any change
```

The same closure, written two ways:

```ts
const storingTag = (_strings: TemplateStringsArray,): void => { holder.kept = gotten.row; };
storingTag``;
storingCall();
```

The **activation walk** matched `CallExpression` and nothing else. So the tag was never activated, its body
 was never scanned, and the store inside it was attributed to nobody. Nothing about what a tag receives was
 involved.

That is a sharper defect than the one filed, and a more general one: **an unseen invocation is an unscanned
 body.** Every channel that depends on a closure's body being read depends on the invocation being seen
 first, and the activation gate is the single place that decides it.

Fixed by writing the branch against what a node **invokes** rather than against one syntax that invokes.
 `invokedParts` names callee and actuals once, and overload resolution, assigned values, declared values and
 actual activation all read those. The next invoking syntax needs one clause rather than four edits.

After the fix both spellings read `opaque=[0]`, fixture offers moved 69 to 70 by exactly the control, and the
 mutant restoring the old gate restored exactly the subject's offer.

### Two things this closes without changing code

The capture half of the same item, since a closure interpolated into a retaining tag was already charged. The
 reading of `recordTaggedTemplateHandoff` was correct, it does map ordinary origins only, and another channel
 covers the shape regardless.

And the eight `isCallExpression` gates that item counted as suspect. They are not all suspect, and the reason
 is worth keeping: the gate that mattered was **activation**, because activation decides whether a body is
 read at all. The gates in the completion walk and the reach walk ask what a callable hands back, and a tag
 whose result is used reaches those through its result rather than through its invocation form.

### The tally that is now a pattern rather than a coincidence

Four times in this effort a hole predicted by reading one module turned out closed by another: the throw
 completion, the external channel probe, the aggregate descent, and now the tag's capture half. Every one was
 a correct reading of the module in front of the reader and a wrong conclusion about the system.

Against that, the defects that were real were found by **measuring a shape**, not by reading a gate. The
 discipline that follows is already written here as probe before filing, and this is the strongest evidence
 for it so far: reading produces true statements about code and unreliable statements about behaviour.

## The type-reference shortcut, closed by bounding its callers rather than by probing

Flagged by review reading the function: `resultExposesMutableState` classifies a type reference by its type
 arguments alone, so `Box<string>` carrying a `readonly row: Row` answers that it exposes nothing while a
 write reaches through `box.row.label`. Correct about the function.

Three steps, in the order the task pre-registered, and the third is what settled it.

**The callers.** Both are collection-member sites, one behind `memberChannelIsVerifiedNarrow` and one in the
 readonly-view discharge. The only question the function is ever asked is what a verified collection member's
 result exposes.

**The probe.** `reduce` handing back a caller-owned `Box<string>` accumulator, chosen because an accumulator
 is not the receiver and so cannot be separated by the identity check the view site already uses:

```text
writeThroughBoxedAccumulator   opq=[0]   charged
writeThroughFreshAccumulator   opq=[0]   charged
```

No offer, so no unsoundness. The control is charged too, which is imprecision in the safe direction.

**The bound, which is the actual answer.** `FRESH_CONTAINER_MEMBER_NAMES` is `slice`, `concat`, `filter`,
 `toReversed`, `toSpliced`, `with`, `flat`, plus `ReadonlyMap`'s `get`, `keys`, `values` and `entries`. Every
 one returns a container instantiated with the **receiver's own element type**, and `reduce` is not among
 them. So a user generic whose own members carry state cannot be one of these results. Where the element type
 itself is such a generic, that generic *is* the type argument and `typeCanCarryMutableState` answers true.

The shortcut is therefore sound within the bound its callers impose, and what misleads is the **name**: it
 reads as a general predicate and is only ever asked a narrow question. Left as a note rather than renamed,
 since a rename touches two call sites for no behavioural gain and the bound is now written down.

### What this adds to the reading-versus-measuring tally

Fifth instance, and the first where the probe alone was not enough. The probe said "charged", which could
 have been a coincidence of this shape rather than a property of the design. Enumerating the callers and
 bounding what they can ask is what turned a passing probe into a reason.

So the discipline gains a clause. **When a predicate looks unsound in isolation, enumerate its callers before
 probing and before fixing.** If every caller asks a narrower question than the predicate answers, the
 predicate is sound where it is used and the finding is about its name. That is cheaper than a probe and it
 generalises, where a probe only ever covers the shape written.

## A construction is an invocation too, and the second syntax paid for the first fix's shape

Filed as a characterisation task, on the grounds that this work had twice built a fix for a shape another
 channel already covered. Characterising it found a defect instead.

```text
storeFromConstructorBody       opq=[]    subject, nothing recorded
storeFreshFromConstructorBody  opq=[]    control, also nothing
storeFromFieldInitializer      opq=[0]   charged already
```

Subject and control identical is a channel that does not run. And the third line is what made the diagnosis
 exact rather than a guess: a **field initializer** in the same position is charged, so the gap is the
 **constructor body**, not the class and not the construction handoff. That handoff answers for arguments and
 this shape hands over none.

The cause is the one the tagged template had. The activation walk matched `CallExpression`, so the constructor
 was never activated and the store inside it was attributed to nobody.

### The fix was one clause, which is the return on how the previous one was written

The tagged-template fix could have been a second `if` in the activation branch. Instead it named what a node
 invokes, and every step downstream, overload resolution, assigned values, declared values, actual activation,
 read that. So this defect cost one clause and no edits anywhere else.

Two syntaxes needing the same repair is the point at which a shared question earns its own module, so
 `invokedParts` moved to `effect-invoked-parts.ts` with both measurements recorded beside it. The move was
 also forced by `max-lines` at 301, and splitting is what that limit asks for rather than raising it, so one
 change satisfied both requirements.

Offers moved 70 to 71 by exactly the control, falsified with a driver, and the mutant removing the clause
 restored exactly the subject's offer.

### What this says about the remaining shape space

Three invoking syntaxes existed and one was recognised. That is not a story about tags or constructors; it is
 that **an unseen invocation is an unscanned body**, and the recognition point is a single gate. Any syntax
 that invokes and is not in `invokedParts` has the same defect waiting, and the list is now short and
 enumerable rather than a matter of inspecting call sites: a call, a tagged template, a construction, and
 whatever the language adds.

Decorators are the obvious candidate not yet measured, since a decorator invokes its expression against the
 decorated declaration. Filed rather than assumed, because four of the last five holes predicted by reading
 turned out already closed, and this one deserves a probe before a clause.

## The three remaining invoking syntaxes, measured

Named by the construction fix and filed as a probe rather than a clause, because four of the five holes
 predicted by reading had turned out already closed. Two of three are closed here too, and the third is open
 in a way one clause does not fix.

```text
storeThroughSuper           opq=[0]   charged        control clean
storeThroughOptionalCall    opq=[0]   charged
storeThroughDecorator       opq=[]    subject        control identical
```

A `super()` call reaches the base constructor correctly once the construction clause activates the derived
 one, so #112 closed it without naming it. An optional call is a `CallExpression`, so the original clause
 always answered it.

### The decorator is open, and the obvious fix is a no-op

A bare `@storingDecorator` on a method, where the decorator stores the caller's row as it is applied, records
 nothing, and its control records nothing either.

A clause was added, `isDecorator(node,)` answering with the decorator's expression as callee and no actuals,
 and it changed **neither** reading. So it was reverted. Landing a path no shape reaches, documented as a fix,
 is already recorded here as worse than leaving the defect recorded, and this is the third time that rule has
 been applied rather than quoted.

What the no-op narrows. `collectAstNodes` walks with `forEachChild`, which does visit decorators, so the node
 reaches the gate. **The blocker is downstream of recognition**, which leaves three candidates, each with a
 different fix:

-    the ancestry gate from #70, since a decorator sits inside a class inside the callable and that nesting may
     fall outside what the gate counts as active
-    `nestedKeys` membership, which should hold and is unverified
-    the body scan of activated callables, since marking a callable active is not the same as reading it

The order to settle it is fixed: whether the key lands in `nestedKeys`, then whether the gate marks it active,
 then whether the scan reaches it.

### The general point this run makes about the invocation gate

The gate turned out to be the right abstraction and an incomplete explanation. Recognising a syntax is
 necessary and not sufficient: `super()` needed no clause because recognising its enclosing construction was
 enough, and the decorator has its clause available and still records nothing.

So "an unseen invocation is an unscanned body" is true and one-directional. **A seen invocation is not
 necessarily a scanned body**, because recognition, activation, ancestry and the body scan are four steps and
 the gate is only the first.

### And the decorator hole is unreachable in this workspace

Counted before investing further, since a shape nothing here writes is worth less than the queue's measured
 items. Every `@` at the start of an indented line across `package/**/src/**/*.ts` is a **CSS at-rule inside a
 template literal**: `@apply` fifty times, then `@mixin`, `@media`, `@keyframes`. **Zero TypeScript
 decorators.**

So the hole is real and cannot be reached by any code in this workspace. Two consequences, and they point
 opposite ways:

Its priority here is low, below every item with a measured workspace shape.

Its priority for the **published** rule is not, because a consumer using decorators reaches it and the rule
 would offer `readonly` for a parameter a decorator stores outward. That is the same asymmetry the external
 channel has: unreachable here, reachable by consumers, and this rule ships.

Recorded as the reason #114 stays open rather than being closed as theoretical. A defect that only consumers
 can reach is still a false offer, and the goal in force is no false offers rather than no false offers in
 this repository.

### The decorator, closed by two changes that were each a no-op alone

Recorded above as open with three candidate causes and a fixed order for settling them. The answer was the
 first candidate **and** the recognition clause together, and neither alone moved a single reading:

```text
recognition clause alone      subject opq=[]    no change
ancestry repair alone         subject opq=[]    no change
both                          subject opq=[0]   control opq=[]
```

The cause. A decorator is lexically inside the declaration it decorates and **does not run inside it**. It
 runs when the class is defined, whether or not the decorated member is ever called. So #70's ancestry gate
 ascended from the decorator, reached the undecorated method, found it inactive and stopped. Past that gate,
 the decorator still had to be recognised as invoking its own expression, which the bare form writes no call
 for.

The ascent now skips exactly one declaration after leaving a decorator and keeps gating on everything above
 it, so a decorator written inside a genuinely inactive closure is still excluded.

Offers moved 71 to 72 by exactly the control, and **both halves were mutated independently and both died at
 72 to 73**, which is the correct pattern when each part is necessary rather than sufficient.

### Why the first attempt's revert was right and its lesson needs qualifying

That no-op clause was reverted on the recorded rule: do not land a path no shape reaches. Correct, and the
 reason it read as unreachable was that a **second** defect was masking it. Two necessary changes each look
 like a no-op when measured alone.

So the rule survives with a qualification worth carrying. A no-op is evidence that the change alone is
 insufficient, **not** that the path is unreachable. The distinction is what to do next: reverting was right,
 and concluding "unreachable" would have been wrong, and this document did in fact record the weaker
 "downstream of recognition" rather than the stronger claim, which is what made resuming cheap.

### The rule about invocations, corrected

Stated two sections ago: an unseen invocation is an unscanned body. True and one-directional.

**A seen invocation is not necessarily a scanned body.** Recognition, activation, ancestry and the body scan
 are four steps and the gate is only the first. `super()` needed no clause at all because recognising its
 enclosing construction sufficed, and the decorator needed a clause plus an ancestry repair. Both ends of that
 came from the same probe run.

### Reachability, counted before deciding to land it

Zero TypeScript decorators in this workspace: every `@` beginning an indented line in package sources is a CSS
 at-rule inside a template literal. So this is a fix for consumers of the published rule and for nothing here,
 which is exactly why it was landed rather than closed as theoretical. The goal in force is no false offers,
 not no false offers in this repository.

## The overridable base, closed by the void-slot fix and by covariance

Filed from review reading the completion walk: a base implementation handing nothing back cannot prove the
 runtime override hands nothing back, since a subclass need not exist in this project. Correct about the code.

```text
forwardOverridableProducer   opq=[1,0]   the overridable formal is charged
forwardRowProducer           opq=[1,0]   charged, as expected
```

Charged, so no offer. And the reason is a fix landed for a different item.

A method reached through a value does not resolve to an owned callable, so the candidate list is empty and the
 declared-type fallback decides. That fallback is **#90's void-slot rule**: `void` is trusted only when the
 callee names callable declarations only, and a method reached through a value is a **slot**. So the base's
 `void` is distrusted and the capture is charged.

**The void case was the only hole there was.** Override return types are covariant, so `override produce(): Row`
 is an error where the base declares `string`. The one return type permitting an override to hand back anything
 is `void`, by the same specific assignability rule #90 was built on and verified against the compiler. For
 every other base return type the base genuinely bounds the override, so the base answering for it is correct
 rather than a hole.

### Sixth instance, and the first where my own fix was the coverage

Five previous holes predicted by reading turned out closed by another channel. This is the sixth, and it
 differs: the covering fix was landed in this same effort, for a different item, and neither the filing nor the
 fix noticed the overlap.

That is worth stating as a positive rather than as another near-miss. The void-slot rule was scoped by asking
 what a declared type is a claim **about**, a body or a slot, rather than by enumerating the shapes that could
 abuse it. A rule scoped by the right question covers shapes nobody listed, which is why it closed an item
 filed independently and why the overridable-method concept the filing named was not needed here at all.

The negative reading of the same fact: the queue held an item that had been fixed, and only measuring it said
 so. Nothing in the code or the queue could have.

## The promise unwrap, designed and not landed

The one finding sweep six produced traces to the declared-answer fallback treating `Promise<string>` as an
 object, which it is. Every `async` function's declared return type is an object even when what it resolves to
 is a leaf.

An attempt was made and reverted, for a mechanical reason rather than a design one: a slice-based edit removed
 two existing functions from the file. Recorded because the design survived the revert and is worth not
 re-deriving.

### The design, settled rather than open

The checker here has **no `getAwaitedType`**, so the promise has to be identified. #107's lesson says to bound
 the question instead of generalising the predicate, so the helper answers what the **ambient** promise
 resolves to and nothing else:

-    not a type reference, or not named `Promise`, or any declaration outside a `.d.ts`: answer empty
-    otherwise answer its type arguments

Empty falls through to the existing leaf test, so nothing changes for anything that is not the language's own
 promise.

Soundness. An ambient promise's own members are `then`, `catch` and `finally`, none of which reaches caller
 state except through the resolved value, so judging the resolved type is judging what a caller can get. A
 `Promise` declared in analysed source is a different type sharing a name, its members are whatever someone
 wrote, and it answers empty and keeps withholding, which costs precision only.

That is the same shape as the `void` rule: ask what the type is a claim **about**, rather than trusting or
 distrusting a name.

### Two mechanical constraints, since both cost a cycle

A **type predicate cannot** be used. TS1230 rejects a predicate referencing an element of a binding pattern,
 and the destructured object parameter is required by the repository's own rule, so the helper returns the
 resolutions instead of narrowing its subject.

And `symbol.declarations` holds handles rather than nodes, so `.resolve(project,)` comes before
 `getSourceFile()`, exactly as the callee-declaration helper in the same file already does. Reading the
 neighbour first would have saved the cycle.

### Method note

The revert follows the same rule as the two before it, and the reason differs: those were reverted because
 nothing exercised them, this because the edit damaged the file. Worth distinguishing, since only the first
 kind says anything about the fix.

### And it landed, with the first inverse mutation signature in this effort

Second attempt, using anchored replacements rather than index slicing, which is the only thing that had gone
 wrong the first time.

```text
keepAsyncLabel   opq=[1]     offered, precision recovered
keepAsyncRow     opq=[1,0]   still withheld, control holds
```

Fixture offers 72 to 75, receiver opacity 24 to 26, and the mutation check reads **75 to 74**.

That delta is worth pausing on. Every other fix in this effort kills its mutant by **raising** the offer count,
 because removing a withholding restores a false offer. This one kills by **lowering** it, because removing a
 precision recovery re-withholds an honest one. Both are correct kills and they point in opposite directions,
 so a mutation check read only as "the number moved" would have been satisfied by either. Reading which way it
 moved is what confirms the fix does what it claims.

The same asymmetry appears in the fixture pair. Every other pair in that file wants its subject withheld and
 its control offered; this pair wants the reverse. A fix that looked through the **question** rather than
 through the wrapper would offer to both, which is exactly what the pair is there to catch.

## Why no external effect resolves: one gate rejects nearly everything

The prerequisite item was filed as "make one external effect resolve", with a pre-registered first step:
 instrument which of the four resolver requirements rejects, **before** adding a fixture dependency, because a
 gate that over-rejects is a defect and a fixture would paper over it.

That step ran, and it changed what the item is.

All four rejection paths instrumented, both artifacts rebuilt, `package/pi-shared/model-selection` linted, a
 `valibot` consumer. Cold-run counts, instrumentation then reverted:

```text
EXT-REJECT call-identity     161
EXT-REJECT implementation      3
EXT-REJECT installed-package    0
EXT-REJECT version-lock         0
```

The resolver reaches installed-package identity and version locking **without a single rejection**, and is then
 stopped at `packageCallIdentity` and its `packageDeclarationCallIdentity` fallback for 161 of 164 calls.

So the reason zero findings carry package-version provenance, and the reason the whole external channel has
 never run on real input, is one gate. Not a missing dependency, not the corpus, not the four-requirement
 conjunction being hard to satisfy.

### What the pre-registered step bought

Adding a fixture dependency would have produced one more call that also fails at call identity. It would have
 taught nothing and looked like coverage: the fixture would sit there, the channel would still never run, and
 the item would have been closed.

This is the clearest return so far on pre-registering a diagnostic step rather than a fix. The step was written
 into the task because five earlier holes had turned out already closed, so the habit was to establish the
 mechanism before building. Here the mechanism turned out to be somewhere else entirely.

### The reproduction note, which cost a cycle

The persistent cache makes this a **cold-run-only** measurement. A second lint of the same package emitted
 nothing at all, because summaries were reused and the resolver never re-ran. First reading looked like the
 instrumentation had failed. Bust the cache or pick a package not yet linted in the session.

### What it becomes

A defect rather than a coverage chore, and one gating a whole channel. Next step is to read the two identity
 functions and find what they require that an ordinary `import { safeParse } from 'valibot'` call does not
 satisfy. Both the authored-import path and the declaration-owner fallback are failing, so the cause is likely
 shared rather than a gap in one of them.

### One hypothesis about that gate, tested invalidly, and the trap is one this document already names

`importBinding` resolves the call-site symbol with `checker.getSymbolAtLocation(node,)`. This codebase's own
 convention elsewhere, in `constructedClassMembers` and in `calleeNamesCallableDeclaration`, is
 `isIdentifier(x) ? getResolvedSymbol(x) : getSymbolAtLocation(x)`, because an identifier in expression position
 needs the resolved-symbol accessor. So the hypothesis was that the gate fails at its first line.

Changed it, rebuilt both artifacts, linted a package, found no version-provenance findings, and reverted.

**That test was invalid**, by the exact trap recorded earlier in this document. Looking for version provenance
 cannot distinguish "resolution still fails" from "resolution now succeeds and the callee happens to be clean",
 because a resolved external summary with empty effect sets records nothing. The hypothesis is **untested**
 rather than refuted, and the revert was right for a different reason than the one I acted on: the change was
 unmeasured, not shown wrong.

The correct measurement is stated on the task: re-apply the change **with the four rejection paths still
 instrumented** and compare the `call-identity` count against 161. Nothing about findings answers this.

Worth recording as a failure of my own discipline rather than as a neutral step. This document contains the
 sentence "an absence in a capture is evidence about what the rule said, never about what the rule did", written
 two sections earlier after reaching the same conclusion from the opposite direction, and I then looked at an
 absence in a capture. Writing a rule down is not the same as having it available at the moment it applies, and
 the cheap defence is mechanical: **when a gate is under test, instrument the gate.**

### The hypothesis, measured properly and refuted

Re-applied the `getResolvedSymbol` change **with the gates still instrumented**, which is the measurement the
 previous section said was the only valid one:

```text
EXT-REJECT call-identity     161
EXT-REJECT implementation      3
EXT-RESOLVED                   0
```

Identical to the counts without the change. **Symbol resolution was never the blocker**, so the hypothesis is
 refuted rather than untested, and this time the measurement can say so.

Worth noting the cost of getting there: the same change was applied twice, once tested invalidly and once
 validly, and the second run took one command. The invalid test cost more than the valid one, which is the usual
 shape of this mistake.

### The next lead, which the count itself names

161 of 164 is not a subtle failure rate. It is nearly every external call, and most external calls in TypeScript
 are **member** calls: `console.log(...)`, `signal.addEventListener(...)`, `rows.map(...)`. For all of those
 `call.expression` is a `PropertyAccessExpression`, so the identifier branch of `packageCallIdentity` does not
 apply at all and never could.

That reframes the question from "why does identity fail" to "what does identity do for a member call", which is
 a different piece of code to read: the member path from line 218 onward, and the `packageDeclarationCallIdentity`
 fallback both paths land on.

And the **three** `implementation` rejections are the more informative number. Those three obtained an identity
 and failed later, so they are the shape that works. Printing their identity names the difference between three
 and 161 directly, which is cheaper than reading two functions and guessing.

That is the same move that worked on the value walk and on the type-reference shortcut: find the case that
 already succeeds and ask what it has.

### The diagnosis completes: a member call gets no package identity

The count said member calls were the likely shape. Printing the callee's syntax kind at the rejection says it
 outright, across two packages:

```text
kind=212 PropertyAccessExpression   156   and   133
kind=79  Identifier                   4   and    17
kind=107 SuperKeyword                 1
```

And the later gate proves identity **does** work for an imported identifier, because it names real identities on
 its way to failing for a legitimate reason:

```text
EXT-IMPL-FAIL ignore Ignore
EXT-IMPL-FAIL node:path join
EXT-IMPL-FAIL node:fs/promises readFile
EXT-IMPL-FAIL node:child_process spawn
```

A `node:` builtin has no shipped implementation to resolve, so failing there is correct behaviour rather than a
 defect. Those four lines are the shape that works.

**So the whole external channel is dark because a member call gets no package identity, and member calls are
 about ninety-five percent of external calls.** `console.log(...)`, `signal.addEventListener(...)`,
 `v.safeParse(...)` after a namespace import: none of them can reach the channel.

That is a far more specific and more tractable statement than "no external effect resolves", which is where this
 started three measurements ago.

### How the narrowing went, since the method is the transferable part

Three cold runs, each one question:

1.   Which of the four gates rejects? One of them, overwhelmingly.
2.   Does the obvious cause of that gate failing explain it? No, and measuring it properly is what said so.
3.   What do the rejected calls have in common, and what do the survivors have? A syntax kind, and an import
     form.

Each step cost one instrumented build and answered exactly one thing. The step that cost the most was the one
 that skipped instrumentation and read findings instead, which answered nothing.

The third question is the one worth generalising. **Ask what the cases that already succeed have in common.**
 Four surviving identities named their module and export directly, which located the working path faster than
 reading either identity function would have. The same move worked on the value walk and on the type-reference
 shortcut.

### Reading the member path flips the conclusion: probably not a defect

Three measurements said a member call gets no package identity, and the natural next move was to call that a
 defect and fix it. Reading the code first says otherwise.

`packageCallIdentity` **does** handle a property-access callee. It requires the receiver to be an identifier,
 resolves it through `importBinding`, and answers for a namespace import and for an import specifier. So
 `import * as v from 'valibot'; v.safeParse(...)` is covered by design.

Which means the 156 rejections are member calls whose receiver is **not an import**:

-    `console.log(...)`, whose receiver is a global
-    `signal.addEventListener(...)` and `rows.map(...)`, whose receiver is a parameter
-    `this.#kept.push(...)`, whose receiver is not an identifier at all

**Every one is correctly rejected.** The channel resolves *package export* calls. A method on an arbitrary value
 is not one, and the value's type coming from a package does not make it one. The module's own words are "exact
 package export identity", and that is what it implements.

So the honest statement is that the channel is narrower than "external calls". It is "calls to package exports
 with a shipped implementation", and this workspace makes very few of those. The `node:` builtins that do reach
 identity fail at implementation resolution, correctly, because a builtin has none.

### The correction this forces to my own earlier claim

Two sections above, this document says the external channel "has never run on real input" and treats that as a
 gap with a fixture-shaped fix. That needs qualifying. It has never run because **this workspace almost never
 calls a package export directly**, which is a fact about the workspace rather than a bug in the channel.

The pattern is now familiar and this is its seventh instance: a measurement was right, the number was right, and
 the conclusion drawn from it was wrong until the code that produces the number was read. Instrumenting told me
 *which* gate and *which* syntax; only reading told me whether rejecting them is correct.

So the discipline gains its mirror image. Earlier this document recorded that reading produces true statements
 about code and unreliable statements about behaviour. The converse is equally true: **measuring produces true
 numbers and unreliable interpretations.** Neither is sufficient, and the order that worked here was measure to
 localise, then read to interpret.

### What is left, stated precisely

One confirming measurement: instrument the property-access branch to print the receiver's resolved symbol kind
 for the 156, and confirm none is an import binding. Any that is, is a real defect; none, and this closes as a
 documentation correction.

And a sharper requirement for the two items waiting on this. Their end-to-end coverage needs a fixture calling a
 **package export** whose shipped implementation mutates a formal, not merely any external call.

### Confirmed, and closed as a documentation fix

The confirming measurement ran. Why each member call fails identity:

```text
MEMBER receiver-not-import        104
MEMBER receiver-not-identifier     52
MEMBER not-property-access          1
```

And the receivers that are not imports, sampled:

```text
self 15, filters 9, process 8, Promise 7, re 6, child 5, path 3, ig 3
```

Globals and locals. **Not one is a package import binding.** So every rejection is correct, and the channel
 resolves a call to a package export exactly as its own words say.

Closed as a documentation fix rather than a code fix. The README now states the boundary, shows the two spellings
 that reach the channel and three that do not, and gives the measured consequence rather than implying it.

### The whole arc, because the shape of it is the lesson

Four instrumented cold runs and one reading, each answering one question:

1.   Which of the four gates rejects? One, overwhelmingly.
2.   Does the obvious cause explain it? No, and only a properly instrumented test said so.
3.   What do the rejected calls share? A syntax kind.
4.   Why does that syntax fail? A receiver that is a global or a local.

Then reading the gate turned four correct measurements into the opposite conclusion from the one they suggested.

Every number was right at every step. The interpretation was wrong until the last one, and it was wrong in the
 direction that would have produced work: a fixture dependency, then a fix to a gate that was already correct,
 then a test pinning behaviour that should not change.

**What stopped that was pre-registering the diagnostic step on the task rather than the fix.** The item was filed
 as "make one external effect resolve" with an explicit instruction to instrument the gates first, because a gate
 that over-rejects is a defect and a fixture would paper over it. That instruction was written before any of these
 measurements existed, and it is the only reason none of the wasted work happened.

## A binding filled by assignment: fix built, reverted, blocker renamed

The shape, measured twice:

```text
storeAssignedSelector      opq=[1]     nothing recorded
storeInitializedSelector   opq=[1,0]   charged
storeFreshSelector         opq=[1]     control, correctly clean
```

Identical bodies except one fills its binding by assignment after a leaf-returning initializer and the other by
 initializer.

**The fix works on the shape.** Following assignments within the declaring scope made the subject read
 `opq=[1,0]` while both controls stayed clean.

And it corrected the blocker this task had carried. The recorded reason was that the fix needs the enclosing node
 universe `closure-activity.ts` has and the value walk does not. **That was wrong.** The enclosing body is
 obtainable by ascending from the declaration, so no universe needs threading; `assignedValues` there takes
 `allNodes` because it already has it, not because the question requires it. The whole addition was two functions
 in a new sibling module, forced by `max-lines` at 305.

### Why it was reverted, and the real blocker

```text
SemanticBridgeError: Owned effect edge lacks callee summary:
  package/module/toml-edit/src/document-materialize.ts:4707:6006:263
```

Widening the value walk widens the **owned-edge graph**, and the index build requires a newly reachable callee to
 have a summary by the time `assertReachedCallSummaries` runs. It surfaced in `workspace-source-effect.unit.test.ts`,
 not in the fixture corpus, which is worth noting on its own: the corpus would have let this through.

So the blocker is not the node universe and never was. It is that **the value walk feeds the call graph**, and
 widening what a value can be widens what must already be summarised. The next step is to read
 `assertReachedCallSummaries` and `includeActiveSource` and decide whether a newly reachable callee can be
 admitted, or whether assignment following must be confined to where captures are collected and kept out of edge
 construction.

### The general point, which is the third time this shape has appeared

Two walks that look independent are coupled through a third thing. Captures against ordinary origins were coupled
 through `bindingOriginBySymbolId`. Reach against value was coupled through nothing and had to be told apart. And
 the value walk turns out coupled to the **call graph**, so a widening that is locally sound and locally correct
 breaks an invariant two modules away.

The defence is the one that caught it: a test outside the fixture corpus, exercising real workspace source. The
 corpus is where shapes are pinned; it is not where invariants are.

### Placement two, also reverted, and it names the third site

The regression said the widening must not feed call edges. So the same question was asked in `heldCallables`
 instead, which builds none.

Lint clean, and the **full suite green including the workspace-source test that caught the regression**. So the
 confinement argument was correct: widening a query that records opacity rather than building edges cannot break
 the completeness invariant.

And it changed nothing. `storeAssignedSelector` still read `opq=[1]`, so it was reverted as a no-op.

**Why, and this is the useful part.** `heldCallables` decides whether a **completion** can carry state. Charging
 the subject also needs the origin to be **reachable**, and that is `transitiveCallableOrigins`: the closure names
 `select`, and reaching `config` means following `select` to the assigned arrow. Two walks, two questions, for the
 third time in this effort.

So the fix is assignment following in the **reach** walk, kept out of the value walk. Both halves are load-bearing:
 the reach walk records opacity and builds no edges, which is the same argument that made this placement safe, and
 the value walk feeds edges, which is why the first placement broke.

### The tally this item has produced, which is worth more than the fix

Three times now, two walks that looked independent were coupled through a third thing:

-    captures and ordinary origins, coupled through `bindingOriginBySymbolId`
-    the reach walk and the value walk, coupled through nothing, each needing its own answer for one syntax
-    the value walk and the **call graph**, so a locally sound widening broke an invariant two modules away

And two placements of one three-line question produced: one invariant break, one no-op, and one correct site
 identified only by elimination. The question was never the hard part. **Where a question is asked decides what it
 can break and what it can fix**, and neither is visible from the question itself.

### Placement three works, and the three placements together are the finding

```text
keepAssignedSelector     opq=[1,0]   charged
keepUnassignedSelector   opq=[1]     control clean
```

Offers 75 to 76 by exactly the control, receiver opacity 26 to 28, mutant killed at 76 to 77, and the whole suite
 green including the test that caught placement one's regression.

The reach walk is safe for the same reason placement two was safe and placement one was not: **it records opacity
 and builds no edges.** Widening a query that only withholds cannot break a completeness invariant. Widening one
 that feeds the call graph can.

So one three-line question, asked in three places, produced:

-    an invariant break two modules away, caught only outside the fixture corpus
-    a no-op, because the gate it landed in answers a different question
-    a fix

**Where a question is asked decides what it can break and what it can fix, and neither is visible from the
 question itself.** That is the whole content of this item, and it cost three attempts to state.

The three coupling instances this effort has now produced, worth keeping together:

-    captures and ordinary origins, coupled through `bindingOriginBySymbolId`
-    the reach walk and the value walk, coupled through nothing, each needing its own answer for one syntax
-    the value walk and the call graph, so a locally sound widening broke an invariant elsewhere

And one corollary about tests: the fixture corpus pins **shapes**, and the workspace-source test pins
 **invariants**. Placement one passed every fixture. Anything that widens a walk needs the second kind of test to
 have any meaning.

## The parameter-default gap in the ownership scan, established as costing nothing here

`foreignBorrowedDirectSummary` passes `parameterInitializerNodes: []`, so an owned call written only in a parameter
 default is invisible to it. The premise was never in dispute and the comment denying it was corrected long ago.
 What was unmeasured is the consequence.

**Counting the shape failed as a method**, and that is worth recording because it looked like the obvious approach.
 A broad regex for an assignment containing a call returned 6815 hits, which counts ordinary assignments; a targeted
 one found none. Regex cannot tell a parameter default from any other assignment, because the distinguishing context
 is the enclosing parameter list.

**Instrumenting the scan answered it in one run.** Printing every parameter carrying an initializer at the point the
 exclusion is made, across four packages:

```text
package/module/css-edit          0
package/dev-script/file-enforcer 0
package/config/rolldown          0
package/pi-plugin/spawn          0
```

`config/rolldown` is the decisive line. It contains `browserslistTargets({ generatedFileUrl = ..., exists =
 generatedFileExists, ... })`, whose parameters carry defaults and one of which names an owned function. The shape
 is there and the scan never sees that callable at all.

**So the gap sits behind a graph entry condition.** This is the *foreign-ownership* summary, reached only for
 declarations inside the ownership graph, which is entered from a `ForeignBorrowed` marker. Ordinary callables never
 reach it. The exclusion can cost something only for a callable that is both inside that graph and has an owned call
 written only in a default.

That is a closure by **mechanism** rather than by count, which matters: four packages is a sample, and a sample of
 zero would have been weak evidence on its own. What makes it an answer is that the number and the reason agree.

### The method rule, on its third confirmation

Instrument the code that makes the decision; do not count shapes that might reach it.

-    #113: instrumenting four resolver gates found one rejecting nearly everything, and reading it then showed the
     rejection was correct. Counting external calls would have found nothing.
-    #114: counting decorators worked, and only because the answer was zero. Had it been nonzero the count would
     have said nothing about whether the gate admitted them.
-    #81: counting failed outright, and instrumenting answered in one run.

The pattern is that a count measures the population and a decision measures the behaviour, and every question worth
 asking here has been about behaviour.
