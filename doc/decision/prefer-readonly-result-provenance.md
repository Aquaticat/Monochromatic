# Model result provenance for collection member calls in `prefer-readonly-parameter-types`

In progress,
 accepted in direction on 2026-07-27.
Scope:
 `package/oxlint-plugin/prefer-readonly-parameter-type`.
This document records the design and the increments that landed against it.
The opening previously said the resolver and the escape reporting were not built yet,
 which the
"What landed" section already contradicted;
 both are built,
 and the sequencing constraint in
"The sequencing constraint" is why they had to land together.
Caller-side substitution is built now,
and the sentence here previously said it was not.
`effect-fixed-point-propagation.ts` calls `seedReturnedSlots` and `propagateResultApplications`,
and `effect-result-substitution.ts` substitutes a callee's returned slots into its callers.
`doc/planning/prefer-readonly-return-substitution.md` records how it was built,
what it cost,
and the false offers it closed.

## Problem

Nothing records that a call result is reachable from the receiver.
A mutation through a result is therefore attributed to no parameter,
and the call falls to the opaque boundary.

Measured,
 by linting the three modules of this package that import no semantic API with
`readonlyEffectSelfHostingOverride` removed:
 four findings,
whose causes include `summaries.get`,
 `target.get` and
`opaqueProvenanceByParameter.get`.
The rule cannot narrow its own exemption because of this gap.
The shape is its own code:

```ts
const callerFacts = target.get(parameterIndex,) ?? new Set<string>();
callerFacts.add(provenance,);
```

`Map.get` reaches no user code and hands back a value carrying state,
and the body mutates exactly that value.

`package/test-fixture/oxlint-no-restricted-syntax/src/readonly-result-provenance-invalid.ts`
pins seven forms of this.
All seven currently report opacity at the lookup,
including a function that only reads its receiver,
and no diagnostic names the `JSON.stringify` that one of them lets state escape into.

## Two obligations, not one

The call and its result are separate questions,
and an earlier sketch of this work conflated them.

- The structure claim and the verified member channel answer what happens *during* the call.
- Result provenance answers what *later* expressions can reach.
- Arguments stay independent,
   as `effect-opaque-boundary.ts` already documents.

A result-provenance derivation therefore yields `COLLECTION_CALL_RECEIVER_DERIVED`,
never `COLLECTION_CALL_DERIVED`.

## The sequencing constraint

Discharging the receiver's opacity is sound only if every place a tracked result can go is
either attributed or reported.
The opacity report exists precisely because the alias was untracked;
removing it while a result can still reach an unmodelled sink trades a noisy report for a
silent miss.

So the escape reporting is not a later refinement.
It is what licenses the discharge,
 and the discharge must not land without it.
Until then,
 tracking may improve attribution while every existing opacity report stays.

Sinks needing coverage before discharge:
returns (`return facts.get(k)`),
property and element stores (`holder.item = facts.get(k)`),
container insertions (`holder.add(facts.get(k))`),
and results captured by another callable.

## Why identity matching cannot come from the existing predicates

Neither existing predicate can be reused,
 and both fail on the flagship members.

`resultExposesMutableState` in `effect-primitive-origin.ts` asks whether a result carries
state at all,
 which is the opposite question.
`resultAliasesReceiverState` in `effect-readonly-view-application.ts` matches `Type`
identity against instantiated element types,
 but guards `isTypeReference()` first,
 and
`Array.prototype.at` returns `T | undefined` while `Map.prototype.get` returns
`V | undefined`.
A union is not a type reference,
 so neither predicate reaches the constituent that would
match.

It also descends into result type arguments,
 which answers "does this result contain
receiver-like values" rather than "is this result itself receiver state".
Reusing it would produce fresh-shell conflation:
 `values.slice()` has matching type
arguments and a distinct container,
 so crediting it to `values` would attribute
`copy.push(x)` to an array the caller never shared.

Type identity should validate an authority entry,
 never create one.

## Landed increment: the result-provenance authority

`effect-result-provenance-authority.ts` records where a member's result came from,
separately from which channels it runs.
The two are independent:
 `Array.prototype.join` reaches the indexed channel and returns
nothing of the receiver,
 while `Array.prototype.at` reaches the same channel and returns
the receiver's own element.
Neither table may be read as evidence for the other.

One relation is represented,
 `RESULT_RELATION_RECEIVER_VALUE`,
 meaning the result is
identically a value the receiver held.
Six entries:
 `Array.at`,
 `Array.pop`,
 `Array.shift`,
 `ReadonlyArray.at`,
 `Map.get`,
`ReadonlyMap.get`.
Each carries the receiver type-argument position its result comes from,
 `0` for array
elements and `1` for map values,
 because a bare relation would let a
`Map<Labelled, string>` lookup claim its `string` result aliases the `Labelled` key.

Container-returning members are named as excluded rather than merely omitted,
 in
`FRESH_CONTAINER_MEMBER_NAMES`,
 because "returns receiver elements" reads as "returns
receiver state" to anyone extending the table.

### Enforcement

`effect-result-provenance.unit.test.ts` places a sentinel object in a real receiver and
compares result identity,
 so a member returning a structurally equal copy fails.
Shape comparison would have passed for `structuredClone`.

Mutation tests,
 both measured:

- Adding `Array.slice` to the table fails the identity assertion with
  `expected [ 'Array.slice' ] to deeply equal []`,
   and independently fails the
  fresh-container exclusion.
- Adding a seventh entry *and* editing `VERIFIED_RESULT_RELATION_COUNT` to match still
  fails the architecture guard with `expected 7 to equal 6`,
   because the registry in
  `catalog-free-architecture.unit.test.ts` holds the count as a literal.

That second guard needed fixing as part of this increment.
Registering an `entryCount` without comparing it to anything is the inert pin the guard
already carried once for the member-channel authority:
 the registry entry looked like
enforcement and enforced nothing.
Both comparisons now exist for both authorities.

## Landed increment: the expression resolver

`effect-expression-provenance.ts` is the single resolver both origin extractors now
delegate to.
 Before it,
 `expressionOrigins` and `rootParameterOrigins` each stripped
property and element access to an identifier and stopped,
 so they agreed by coincidence
and both stopped at a call.

`effect-member-result-relation.ts` validates an authority entry by `Type` identity
against the recorded receiver position,
 traversing union constituents.
That traversal is what reaches the entries at all,
 for the reason recorded above.

### Workspace effect, measured

1,405 findings to 1,424,
 the first movement in this task.
Offers unchanged at 35;
 `is used by these calls` 499 to 512;
 `is used as the object`
588 to 583.

Diffing sorted diagnostic sets:
 22 lines removed,
 41 added,
 and 41 minus 22 equals the
19-finding delta exactly,
 so 22 existing findings gained causes and 19 are new.

The new findings are true positives,
 and the largest class is not about member results at
all.
 `??` was the gap:

```ts
// package/module/kv-store/src/create-sync-store.ts:111
const policies = config.eviction ?? [];
const lruPolicy = policies.find(function isLru(p,) { /* ... */ },);
```

`policies` can hold `config.eviction`,
 so `config` reaches that call.
`expressionRoot` strips property access but not a `BinaryExpression`,
 so before this
change the whole initializer resolved to nothing and `policies` carried no origin.
Every alias established through `??` was invisible,
 which is why handling
value-selecting operators was not an incidental detail of following call results.

### What the diagnostic tests could not see

A parameter mutated through a call result also still carries that call's receiver
opacity,
 and opacity dominates the message,
 so the fixture emits the same seven
diagnostics whether attribution works or not.
`attributes a mutation reached through a verified member result to its receiver` in
`effect-summaries.unit.test.ts` asserts `mutatedParameterIndexes` directly for the bound,
chained and element-write forms,
 with the read-only lookup as the control.

Measured mutation:
 dropping the call branch from `provenanceSuccessors` fails that
assertion with `expected [] to deeply equal [ +0 ]` while the fixture diagnostic count
stays at seven.
The message-level suite passed identically with the resolver disabled,
 which is why the
summary assertion exists.

## Corrections from a source-bearing review, all measured

An external review with every module pasted in found four defects.
 Three were in the
landed resolver and are fixed;
 one predates this work entirely.

### `&&` over-attributed, fixed

`input && new Set()` credited `input` for a `Set` that is always freshly built.
`&&` yields its left operand only when that operand is falsy,
 and no falsy value is a
mutable object,
 so any object the expression produces came from the right operand.
Following the left could only invent mutations,
 and a false mutation record withholds a
read-only offer the parameter deserves.
`&&` is now right-operand-only,
 alongside assignment and the comma operator;
`??` and `||` keep both operands.

### Runtime-transparent forms were missing, fixed

`facts.get(key) as Set<string>` lost attribution entirely.
`as`,
 angle-bracket assertions and `satisfies` erase at runtime,
 so the value is the
operand's own.
`await` stays out:
 thenable assimilation means an awaited value need not be the
operand's,
 so admitting it would assert an identity nothing here proves.

### Identity validation had a false negative, fixed

`Map<string, A | B>.get` returns `A | B | undefined`,
 whose constituents are the two
object types plus absence,
 while the receiver's held position is the union as one type
object.
 Comparing flattened result constituents against the unflattened held type found
nothing,
 because a union never appears among its own constituents.

Both sides are now normalized and the test is a subset rather than an existential one,
which is also stricter:
 a member returning `Labelled | string` would previously validate
on the `Labelled` constituent alone,
 crediting the receiver for a result that may be a
fresh primitive.

### Computed member calls were invisible, fixed, and this one was unsound

Pre-existing and unrelated to result provenance.
 The collection handling,
 the opaque
boundary and the result relation each tested for a property-access callee,
 so
`values['push']('appended')` fell through all three at once,
 nothing recorded the
mutation,
 and the parameter was offered `readonly`.

Applying that offer,
 checked against TypeScript 7.0.2:

```text
computed-applied.ts(2,10): error TS7015: Element implicitly has an 'any' type because index expression is not of type 'number'.
```

The map-receiver form was quieter and worse:
 summary measured `mutated=[] opaque=[]`,
so the rule saw nothing at all.

`effect-member-call-receiver.ts` is now the one definition,
 accepting property and
element access alike and unwrapping runtime-transparent callee wrappers,
 since which
form the author wrote has no bearing on what receives the call.
Measured after:
 `computedStructureEffect` `mutated=[0] opaque=[]`,
 and
`computedLookupMutationEffect` `mutated=[0] opaque=[0]`.
Reverting element-access acceptance restores the offer.

### One review claim that did not survive measurement

The review suggested `boundLookupMutationEffect` is masked,
 because it also calls
`facts.set`,
 which would prove receiver mutation independently.
Measured by disabling the call branch:
 all three assertions fail,
 so none is masked.
That measurement also showed `facts.set(key, stored)` alone does not record `facts` as
mutated,
 which is unexplained and recorded here rather than assumed benign.

## Workspace effect across the increments

Offers held at 35 in every sweep,
 so nothing in this task has added or removed a
`readonly` suggestion in real code.
 Only opacity attribution moved.

- 1,405 before result provenance.
- 1,424 after the resolver,
   19 new findings,
   the largest class being aliases through
  `??` that previously carried no origin at all.
- 1,451 after the transparent forms,
   27 more.

Four of that last group are a different diagnostic class and are not yet understood:
`Mutation contracts disagree across callable signatures` at `pipe.ts:147`,
`piped.ts:156`,
 `pipe-async.ts:147` and `piped-async.ts:156`.
Bisected to the transparent-form handling,
 4 with it and 0 without,
 traced to
`package/module/pipe/src/run.ts:51`,
 `const callableArgs = args as RunCallableArgs`.
That attribution is correct,
 so the finding is not a reason to revert it.
Whether the disagreement is a real contract gap in that package or a rule-side defect
comparing bodyless overloads against an implementation is open.

## What landed

All four steps of the plan below are built.
The resolver is `effect-expression-provenance.ts`,
 both extractors delegate to it,
`effect-result-escape.ts` enumerates the attributed positions so an unfamiliar construct
counts as an escape,
 and `receiverClaimAnswerable` discharges a state-carrying result only
when its relation is verified and no use of it leaves the callable.

Measured on the self-hosting probe:
`opaqueProvenanceByParameter.get` is discharged from all four of its findings and
`summaries.get` from three of them.
The four findings remain,
 blocked now by closure capture,
by an argument claim about storing a caller-owned value,
and by the deferred iterator member `summaries.values`.

The discharge also exposed a defect it did not create.
Its escape classifier treats a value sitting in an object literal handed to a call as
attributed,
 on the grounds that the argument analysis walks such literals,
and two things made that false:
 the walk filtered literal properties by the callee's
authored contract names,
 and it could not read a value packaged behind an accessor.
Both are recorded in `doc/decision/prefer-readonly-contract-name-narrowing.md`,
together with a third defect in the same family that predates every provenance change.

`directReturned` and `returnedParameterIndexes` had no consumer when this was written,
and they have one now.
Substitution reads them,
which is exactly the condition this document set for a return counting as benign,
so the fact is load-bearing rather than merely recorded.

What that condition does not cover is a returned callable.
`expressionOrigins` has no provenance successors for a function expression,
so `return (): Row => config.row` records no returned origin at all
and no caller can substitute through it.
The precondition fails there rather than the policy applying,
which makes it a false offer rather than a permitted return;
falsified,
 and tracked as its own task.

Task #38 tested that last clause and it holds.
A caller that writes through the returned value recovers no origin and records no mutation,
so the same write receives opposite verdicts depending on whether it is routed through a resolved callee.
That is visible from outside,
 but it is not a false offer:
applying the offered `readonly Row[]` to such a caller type-checks under TypeScript 7.0.2,
because `ReadonlyArray` constrains structure and the write lands on an element.
So the gap costs precision and consistency,
 not soundness.
`doc/planning/prefer-readonly-return-substitution.md` records the measurement,
and the correction of an earlier revision that called it unsound.

## Remaining work

Iterator members remain separately unproven,
 but not in the way this section first recorded and not for the
reason it gave.
 The `effect-fixed-point-propagation.ts:37` finding it named no longer exists,
 because the
channel authority now claims iterator creation and drainage together.
 What is unproven is the returned
iterator's contents rather than the call's channel.

Measured 2026-08-06:
 of 1689 findings across the workspace,
 62 named a collection iterator member among their
causes and 16 named nothing else.
 Of those 16,
 14 were `entries` and 2 were `values`,
 and all 14 were the
same idiom,
 `for (const [index, item,] of items.entries())`.

### Closed the same day,
 with the residue at zero

`values`,
 `entries` and `keys` all carry result relations now,
 and iterator-only findings stand at 0 from
16.
 The rule reports 1682 across the workspace,
 from 1689,
 with read-only offers unchanged at 33 through
every increment,
 which is the number that matters:
 a false offer is the failure mode and no parameter
became offerable.

What the increments were,
 in the order they landed and each with its own matched pair:

- `values` under the existing element relation,
   whose identity probe had to learn to drain a non-array
  result,
   since an iterator carries its elements the same way and exposes none of them to
  `Array.isArray`.
- A defect that increment exposed:
   `callResultElementReceiver` compared the result's type argument at
  the *receiver's* position,
   so `Map.values` was inert on arrival because `MapIterator` has no position 1.
  The element relation now carries its own `resultTypeArgumentIndex`.
- `RESULT_RELATION_RECEIVER_ELEMENTS_PAIRED` for `entries`,
   whose yielded pairs are allocated by the
  member and so are never identical to a receiver element.
   Its recorded position proves the claim rather
  than bounding it,
   which is what keeps a write through a `Map` key attributed.
- Admitting the iterated and spread element steps in the escape walk,
   scoped by an
  `elementStepsAttributed` flag so the argument-side path in `effect-call-analysis.ts` is untouched.
   This
  is the only one that moved verdicts.
- `keys` for `Map` and `ReadonlyMap`,
   which supplies the attribution and the discharge together.

Two decisions recorded against this arc were overturned by measurement rather than by argument,
 and both
retractions are kept in `doc/planning/prefer-readonly-iterator-member-provenance.md` beside what replaced
them.
 The failure was the same each time and is now `AGENTS.md` rule `QAB`:
 a reading of the state before a
change is not evidence about the state after it.

### Reclassified after the channel and iterator work, 2026-08-07

The count is 1628 now,
 from 1689 when this session started,
 with read-only offers at 33 throughout
and semantic failures at 0.
 Grouping by findings whose every named cause is one member:

- 94 `JSON.stringify`,
   40 `Error.isError`,
   16 `json`:
   host calls that can reach a getter,
   a proxy
  trap or a `toJSON`.
- 51 `push`,
   24 `set`:
   an argument stored into a caller-owned container, which really does leave.
- 47 `report`,
   33 `getScope`,
   15 `getLastToken`:
   the linter's own plugin API, outside analyzable
  source.
- 35 `map`,
   34 `reduce`,
   30 `filter`,
   15 `find`:
   observer-bearing members whose *result* is unaccounted.
  Not, as this list first said, members whose observer cannot be resolved.
   Checked by reading three
  of them:
   `groupRuns` in `package/module/logger/src/sink/console.ts`,
   the rebuild fold in
  `package/module/css-edit/src/transform.ts`,
   and `readCandidate` in
  `package/agent-harness-shared/session-discovery/src/newest.ts` all pass an inline named function,
  which is owned source sitting at the call.
   `reduce` carries no result relation at all,
   so the
  aliasing fallback refuses it however its observer resolves,
   and the `map` case hands its result
  straight to `Promise.all`,
   so the result leaves.
   Two different limits wearing one name.
- 20 `entries`,
   16 `get`:
   collection members carrying a relation whose result escapes the callable.

### `reduce` can carry the observer-return relation, but not unconditionally

Attempted and reverted 2026-08-07,
 with a specification fact that decides it.

The reasoning is attractive:
 `reduce` hands back the accumulator,
 the accumulator is what the observer
returned,
 so `RESULT_RELATION_OBSERVER_RETURN` describes it exactly as it describes `map`.
 The identity
probe passes,
 once taught that a member returning one observer result satisfies the relation by identity
where a member returning a container satisfies it by membership.

It is false for the form without an initial value.
 `Array.prototype.reduce` called with only a callback
takes the receiver's first element as the accumulator and never calls the callback for it,
 so over a
one-element receiver the result *is* a receiver element that never passed through the observer.
 An entry
claiming observer-derived provenance for that is claiming something the specification contradicts.

The probe did not catch this,
 and the reason is worth more than the entry.
 The seed argument was added
because a fold over a single-element receiver otherwise returns that element without calling the
observer,
 and the probe then compared the sentinel against the marker and failed.
 Supplying a seed made
the probe pass by removing the case that falsifies the claim.
 A probe whose arguments are chosen to make
its assertion true measures the arguments rather than the member.

So the honest form is conditional on an initial value being supplied,
 which is an argument-count fact
about the call rather than a fact about the member.
 That was then built,
 measured,
 and reverted,
 which is
the useful part.

`seededOnly` on the entry,
 checked in `callResultComesFromObserver` by counting the call's arguments,
 with
the probe extended two ways:
 a member returning one observer result satisfies the relation by identity
where a member returning a container satisfies it by membership,
 and a `seededOnly` entry must *fail* its
own relation unseeded or the condition is decoration.
 The unseeded fold hands the sentinel straight back,
so the condition is load-bearing and now provably so.

It changes nothing.
 Finding sets byte-identical across the workspace,
 no cause text moved,
 1628 either
side.
 Reverted on the same ground as the spread ascent earlier in this work:
 an increment that cannot be
shown to do anything is one more thing to maintain and one more thing to disbelieve.

Why it changes nothing is the part to keep,
 and it corrects this document's own earlier claim.
 The
`reduce` findings do not survive because the member lacks a relation.
 `groupRuns` in
`package/module/logger/src/sink/console.ts` seeds its fold with `[]`,
 so the relation applies,
 and it
still reports because the observer hands the accumulator back holding the receiver's own records,
 which
then leave through the return.
 The relation explains that finding rather than discharging it,
 which is
the relation working.
 A fold whose accumulator never holds a receiver element is already silent.

### The largest remaining group is not about escaping, measured

Recorded 2026-08-07 after instrumenting `viewResultUnaccounted`, because the obvious reading is wrong
and cost part of a session.

The reading was that `map`,
 `reduce`,
 `filter` and `find` report because a result carrying receiver
state leaves through a call.
 Two sampled cases supported it.
 Instrumenting the gate on three files
refutes it:
 seven of nine refusals are the no-relation branch and two are the container escape.

Two things follow.
 First,
 the escape walk already treats a call argument as non-escaping,
 documented
in `effect-result-escape.ts`:
 the obligation moves to that sink rather than disappearing.
 So "escapes
into a call" was never the mechanism for an argument position at all,
 only for a return.

Second,
 and this is the useful part:
 the no-relation branch fires for `filter`,
 which *has* a relation.
So that branch does not mean "no table entry".
 It means neither relation was *verified at this call
site*,
 and the verification is the type-identity comparison in `callResultElementReceiver` and the
observer derivation beside it.
 The entries are present and the checks reject them.

### The identity comparison was too strict for a type-guard filter, fixed

Instrumenting `callResultElementReceiver` named it in one run:
 `identity-mismatch` on
`updates.filter(function hasContent(update,): update is PushUpdate & { readonly localOid: string })`
in `package/git-policy/cli/src/policy-engine/manual-push-candidates.ts`.

A predicate that is a type guard selects `filter`'s narrowing overload,
 so the result holds `S` where
`S extends T`.
 `S` is a different type object from the receiver's `T` while the values are the very
same objects at runtime,
 and comparing by identity refused a relation that plainly holds.

`heldTypeSurvives` accepts identity or `checker.isTypeAssignableTo(resultHeldType, heldType)`,
 in that
direction only.
 A narrowing of the receiver's element type can only have come from the receiver,
 which
is what the entry claims;
 the reverse would admit a widening,
 where a result could hold values the
receiver never did.

Measured:
 2966 errors to 2959,
 1628 rule findings to 1621,
 semantic failures and read-only offers
unchanged at 0 and 33.
 Ten findings removed and three added,
 and every one of the three is at a location
that also appears among the removed,
 so no parameter became opaque that was not opaque before.

### Where the refusals actually are, and which gate to instrument

Measured across six files on 2026-08-07,
 at `receiverClaimAnswerable`,
 which is the decision that
produces a finding:

- 32 the channel is not verified narrow
- 7 the result escapes
- 6 neither relation answers

Instrumenting `viewResultUnaccounted` instead gives a different and misleading picture,
 7 no-relation
against 2 escapes,
 because that gate refusing does not by itself produce a finding:
 a member carrying
the direct-value relation is answered later by `callResultReceiver`.
 Instrument the reporting decision,
not the gate that feeds it.

The 32 need reading carefully rather than acting on.
 An observer-bearing member is refused there *by
design*,
 since its observer obligation belongs to `recordReadonlyViewApplications`;
 reaching that branch
at all means the observer analysis already declined. So the number counts consequences, and the cause
sits upstream in `readonlyViewElementApplications`,
 which has several exits:
 the result gate, no
observers, an observer that is not owned source, and undescribed observer positions.
 Which of those
fires has not been measured,
 and it is the next thing to measure rather than to reason about.

Measured too,
 across the same files,
 by instrumenting all nine exits of
`readonlyViewElementApplications`:

- 14 no observers
- 9 the result is unaccounted
- 1 the observer is not owned source

Only one of those is a limit worth attacking.
 The 14 are members carrying no callable argument at all,
`slice`,
 `entries`,
 `at`;
 there is nothing to derive and `receiverClaimAnswerable` answers them
separately,
 so the exit is correct.
 The single unowned observer is the analysis honestly declining.
 The
9 are the result gate,
 which is where the type-guard narrowing fixed above was found and is the same
place a further increment would land.

The seeded-fold open end survives this.
 The relation should carry `groupRuns` past the result gate,
 its
observer is owned and its positions are described,
 so the derivation should have succeeded and the sweep
still showed nothing.
 Distribution sampling cannot say why:
 that needs a trace of one call rather than
counts across many,
 which is a different technique and the honest next step.

Superseded next step,
 kept because the instrumentation that replaced it is the method worth copying:
 starting with `records.reduce<Run[]>` in
`package/module/logger/src/sink/console.ts` and the `filter` in
`package/git-policy/cli/src/policy-engine/manual-push-candidates.ts`,
 both of which appear in the
instrumented output and neither of which is exotic.

That also explains the seeded-fold result above.
 The relation was added and changed nothing because a
relation the verification rejects is not consulted:
 adding entries cannot help while the gate ahead of
them refuses.

No provably inert group remains,
 checked rather than assumed:
 `includes`,
 `indexOf`,
 `lastIndexOf` and
`at` are already listed,
 and they were the last candidates for the treatment `join` received, since they
compare with `===` and coerce nothing.
 What `join` had and these groups do not is a specification-defined
operation that provably runs no user code on a stated condition about the receiver.

### What the 1682 findings were before that, measured

Taken from the same sweep,
 so nobody reads the number as a backlog.
 Classified by the sentence the
diagnostic leads with:

- 1172 argument-side,
   "used by these calls".
- 370 receiver findings on members that are not collections.
- 83 receiver findings on collection members.
- 33 read-only offers,
   which are the rule succeeding rather than failing.
- 24 everything else.

The argument side is seventy percent of the total and is dominated by causes no provenance work can
answer.
 Counting cause mentions rather than findings,
 since one finding names several:
 193 are a bodyless
callable,
 an implementation the rule cannot read at all;
 129 `JSON.stringify`,
 68 `toISOString` and 58
`Error.isError`,
 host calls that can reach a getter,
 a proxy trap or a `toJSON`;
 and 100 a callback the
rule cannot name.
 147 `push`,
 69 `set` and 78 `with` are arguments stored into a caller-owned container,
which is a correct report about a value that really does leave.

Reaching zero was never the goal and would mean the guarantee had been abandoned.

The largest cause invites one wrong conclusion,
 so it is worth stating what it is not.
 "Bodyless
callable" sounds like an implementation the analyzed scope is missing,
 and 189 of the 193 point at
workspace source rather than `node_modules`,
 which makes a `tsconfig.json` fix sound plausible.
 Resolving
the offsets says otherwise.
 The largest single group,
 50 in `package/module/i18n-compose`,
 points at
declarations like `(phrase: NounPhrase<S, N>,) => string`:
 function *types* on parameters,
 not functions
missing bodies.

So the call goes through a value the caller supplied,
 and which implementation runs is a fact about the
caller rather than about the callee's file.
 Bringing more source into scope cannot answer it.
 Nor is this an unmeasured subset waiting to be counted.
 `recordBodylessEffects` in
`direct-bodyless-summary.ts` gives a bodyless callable one summary:
 every parameter that can carry mutable
state takes opacity,
 because no body proves what the implementation does with it,
 and an authored contract
adds known effects on top without removing that opacity.
 A function type has no body by construction,
 so
that summary is the designed answer rather than a failure to look harder.

Moving these would take a technique the rule does not currently apply to general calls:
 substituting the
callable an argument actually holds at each call site,
 which it does do for observers through
`callableDeclaration` and for ownership through `proveForeignBorrowed`,
 the latter documented as the single
largest cost the rule carries.
 Whether that generalizes is a design question about the backwards call-graph
walk,
 not a configuration change and not a measurement gap.

## Adopted for issue #414: the collection result gate moves from type shape to provenance

Accepted on 2026-08-06 by the repository owner,
 over two alternatives:
 admitting the `Symbol.species`
channel into the accepted baseline,
 and leaving the semantics alone while rewriting the diagnostic.

The gate this replaces is the one installed by `f7c35802a` and recorded in
`doc/decision/prefer-readonly-effect-model-split.md`:
 `readonlyViewElementApplications` reads the call's
instantiated result type and refuses to derive anything when `resultExposesMutableState` says that type
could carry state.
 That predicate reads type shape.
 The claim it is standing in for is about provenance,
and the two disagree in both directions.

### What the gate does today, measured

Summaries were built through `openSemanticFile` and `buildEffectSummaryIndex` from
`package/oxlint-plugin/prefer-readonly-parameter-type/dist/final/node/index.mjs`,
 whose source tree last
changed at `b16ec0048` against a build written the same day.
 The probe supplied its own source text over
an existing fixture path,
 so nothing was written into the tree.

For a parameter typed `readonly Slice[]` whose element type is deeply readonly,
 the parameter is recorded
opaque for `filter`,
 `slice`,
 `entries`,
 `find`,
 and a `map` whose callback returns an object.
It is recorded clean for `for...of`,
 array spread,
 an indexed read,
 array destructuring,
 a counter loop,
`reduce` to a number,
 `map` to a number,
 `forEach`,
 `every`,
 and `filter` on `readonly string[]`.

### The case that decided it

`slices.map(function toRow(slice) { return { chars: slice.targetChars }; })` is recorded opaque.
Every object in that result is freshly allocated inside an owned callback and holds one number,
 so no
caller-owned identity can reach the species channel through it.
 The rationale the gate was built on,
 what
the result could carry,
 is satisfied;
 the type test still refuses,
 because `Row` is not primitive.
No rewrite fixes that finding,
 which is the defect issue #414 reports,
 arrived at from the diagnostic
rather than from the gate.

### What the provenance model has to keep

- `find` and `findLast`:
   the result is the receiver's own element,
   which is genuine alias provenance.
  Report on a later mutation or escape,
   as `found.label = 'x'` already measures,
   not on the call.
- `filter`,
   `slice`,
   `concat` and `flat`:
   a fresh container whose elements carry receiver origins.
- `map`:
   origins taken from the callback's return,
   which is what clears the fresh-object case above.
- `entries`:
   a fresh tuple carrying an element origin,
   still subject to the iterator question in
  "Remaining work".
- `reduce`:
   origins from the seed and from the callback's return,
   which is the accumulator gap
  `doc/decision/prefer-readonly-effect-model-split.md` left open at `applyCargoPlan`.

Reporting stays where `effect-result-escape.ts` already puts it:
 a use that mutates an origin or hands it
across an opaque boundary.

### What this does not decide, decided separately on 2026-08-06

The question below was left open here and answered in
`doc/decision/prefer-readonly-member-channel-authority.md`,
 "The stated trust baseline",
 which resolves
issue #415:
 standard dispatch,
 indexed data properties,
 the standard iterator and default `Symbol.species`
are trusted for a value typed as a collection view.
 So the container cases are no longer gated on the
channel,
 and both increments below proceed together.
 The rest of this section records why the question
existed and the measurement that settled it.

Whether a collection-returning member discharges at all depends on a question this decision leaves open,
tracked separately:
 whether the rule trusts standard collection dispatch,
 default `Symbol.species` and the
standard iterator on a value typed as a read-only view.
 The current answer is inconsistent.
 `filter` is
refused because `ArraySpeciesCreate` reads `constructor[Symbol.species]` and calls it,
 while `for...of` and
spread are accepted although they read `slices[Symbol.iterator]` and call it.
 Both hooks are installable on
a plain array as own data properties,
 so neither needs the accessor exotica that
`doc/decision/prefer-readonly-member-channel-authority.md` assumes away.

Measured,
 run with `node`:

```js
// doc/decision/prefer-readonly-result-provenance.md, both channels on a plain array
const element = { secret: 'caller-owned', };

const iterated = [element,];
let iteratorSaw = null;
iterated[Symbol.iterator] = function* hostileIterator() {
  iteratorSaw = this[0];
  this.push({ injected: true, },);
  yield* Array.prototype[Symbol.iterator].call(this,);
};
let forOfCount = 0;
for (const seen of iterated) forOfCount += 1;
console.log(`for...of saw the element = ${iteratorSaw === element}, iterations = ${forOfCount}`,);

const filtered = [element,];
let speciesSaw = null;
filtered.constructor = {
  [Symbol.species]: function Hostile(length,) {
    return new Proxy(new Array(length,), {
      defineProperty(target, key, descriptor,) {
        if (descriptor && ('value' in descriptor)) speciesSaw = descriptor.value;
        return Reflect.defineProperty(target, key, descriptor,);
      },
    },);
  },
};
filtered.filter(() => true,);
console.log(`filter saw the element = ${speciesSaw === element}`,);
```

Both print `true`,
 and the hostile iterator turns a one-element array into three elements observed by
spread,
 which breaks the receiver-structure claim rather than only the reachable-user-code one.

So the increments split by whether they depend on that answer.
 Callback-return origins for `map` clear the
fresh-object case whichever way it goes.
 The container cases,
 `filter` and `slice`,
 clear only if the
species channel is trusted,
 because provenance says the container holds receiver origins and the gate then
asks who builds the container.

## Consequences of the provenance replacement, measured

Matched pair on identical source,
 measured 2026-08-06.
`git diff --stat main -- package/git-policy/cli/src` is empty,
 so the whole delta belongs to the rule.

`//package/git-policy/cli:lint:oxlint`:

- before,
   from `main`:
   302 errors,
   206 of them this rule.
   These are the numbers issue #414 recorded,
  reproduced exactly.
- after,
   from the merge on `main`:
   231 errors,
   135 of them this rule.

Both runs come from the same built worktree,
 which matters more than it first appeared.
 The same lint from the feature worktree reported 232 errors and 12 warnings,
 and that worktree is missing `tsgolint` and several built dependencies,
 so a whole-workspace run there logged `semantic rule failed` for many files and measured nothing.
 Neither `git-policy/cli` run logged one,
 checked rather than assumed,
 so the pair above was sound before it was repeated;
 it is repeated because a measurement taken in an environment that can silently skip the rule
 is not one to rest a decision on.

The 12 warnings the second run also reports are a fresh-worktree artifact rather than a change:
`src/api.unit.test.ts` imports `../dist/final/node/index.mjs`,
 which is unbuilt there,
 so TypeScript
resolves it as an error type and `no-unsafe-call` and `no-unsafe-assignment` speak.
 The same lint from a
built worktree reports none.

What the 135 survivors are:

- 103 argument-side findings,
   `used by these calls`,
   which `String`,
   `Object.entries` and
  `JSON.stringify` earn by being able to run a getter,
   a proxy trap or a `toJSON`.
   Untouched by this
  work and correct,
   exactly as the effect-model split recorded.
- 15 receiver findings on members that are not collections.
- 15 receiver findings on collection members,
   which now carry the message naming what would resolve
  them.

Reaching zero was never the goal and would mean the guarantee had been abandoned.
What matters is that every finding which went away went away for a stated reason:
 a container write became
an attribution,
 or a member's result gained a relation that accounts for it.

## The receiver question was the value question, and it should have been the element question

Issue #417,
 measured and fixed 2026-08-06.

`recordReadonlyViewApplications` resolved its receiver with `rootParameterOrigins`,
 which asks which
caller parameter owns the value the receiver holds.
 For a fold whose receiver is a container another
member built,
 `rows.filter(keep).reduce(fold, 0)` in either its chained or its bound spelling,
 no
parameter owns that value:
 `filter` built it.
 The origins came back empty,
 the function returned on
`receiverOrigins.size === 0` before deriving anything,
 and the call fell through to the receiver claim,
which cannot answer for a member carrying an observer.
 The parameter stayed opaque for a fold that reads
a length and returns a number.

The observer derivation never needed the value question.
 An observer receives elements,
 never the
container,
 so what it needs is where the receiver's elements came from,
 which is what
`expressionElementOrigins` answers and what the element facet was added for.
 The change is that one call.

It widens and never narrows,
 and that holds by construction rather than by observation.
`rootParameterOrigins` is a pass-through to `expressionValueOrigins` with the same arguments,
 and
`expressionElementOrigins` calls the same function and then returns one of three things:
 the value origins
unchanged when the expression is not a verified container,
 the value origins unchanged when the container's
receiver resolves to nothing,
 or the union of the two.
 Every branch is a superset of what the old call
answered,
 so no expression shape can yield fewer origins and no report can be lost by resolving fewer.
 The
observation agrees:
 all six container fixtures read byte-identical across the change and the unit suite is
unaffected.

What the superset argument does not cover,
 stated so it is not mistaken for proven:
 a receiver that
resolves to origins where it previously resolved to none now runs the observer derivation instead of
falling to the opaque boundary,
 which is the intended change.
 That discharge rests on the same derivation
already used for a receiver that is a parameter,
 unchanged here,
 and on the result gate,
 which is what
still catches `observerAccumulatorEscapeEffect`.

### What the earlier attempts got wrong

Two attempts were recorded against this and both were reverted on a regression that does not exist.
`iteratedContainerWriteEffect` and `spreadContainerWriteEffect` were blamed for gaining a `rows.slice`
report;
 both already carried one on merged `main`,
 checked by probing the summaries before touching
anything.
 The issue title was wrong in the same way:
 the bound form is not clean,
 it reports `kept.reduce`
where the chained form reports the whole chain,
 so binding changes the spelling of the cause and nothing
else.
 The reasoning that should have caught this was written down at the time,
 that element and value
origins agree for a parameter receiver,
 and it was used to predict a no-op and then not checked against
what the fixtures actually said.

### Consequences, measured

Matched pair in one worktree,
 same source but for the one-line change,
 `mise run lint:oxlint` across
the workspace:

- before:
   3378 errors,
   9789 warnings,
   1722 from this rule.
- after:
   3345 errors,
   9789 warnings,
   1689 from this rule.

The warning count is identical and every one of the 33 fewer errors is a finding of this rule,
 so nothing
outside it moved.
 Both runs logged the same 4 files where the semantic rule could not run,
 checked rather
than assumed,
 so neither run bought its number by silently skipping work.

Comparing findings by parameter name and source location rather than by message,
 no parameter became
opaque that was not opaque before.
 Two findings survived while naming one fewer parameter:
 `overwriteTomlKey`
in `package/dev-script/file-enforcer/src/io/write-toml.ts` and its counterpart in `src/pipeline/toml.ts`
each named `path` and `value` before and name only `value` now.
 `path.reduce` is the fold this change
resolves;
 `value` keeps its own opacity,
 which is argument-side and comes from `Object.getPrototypeOf` and
`toISOString`,
 and is untouched.

The soundness control is `observerAccumulatorEscapeEffect` in `readonly-member-channel-invalid.ts`,
 where
the fold returns the accumulator itself and the receiver's element therefore escapes.
 It still reports
under the change,
 because what catches it is the result gate on the reduce result type rather than the
receiver resolution.
 The two spellings are pinned clean in `effect-summaries.unit.test.ts` against that
control and against `hookedArrayDefaultSortOpaqueEffect`;
 reverting the one-line change fails the pin with
`expected [ 0 ] to deeply equal []`.
