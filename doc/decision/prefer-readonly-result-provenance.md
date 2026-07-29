# Model result provenance for collection member calls in `prefer-readonly-parameter-types`

In progress, accepted in direction on 2026-07-27.
Scope: `package/oxlint-plugin/prefer-readonly-parameter-type`.
This document records the design and the increments that landed against it.
The opening previously said the resolver and the escape reporting were not built yet, which the
"What landed" section already contradicted; both are built, and the sequencing constraint in
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

Measured, by linting the three modules of this package that import no semantic API with
`readonlyEffectSelfHostingOverride` removed: four findings,
whose causes include `summaries.get`, `target.get` and
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
- Arguments stay independent, as `effect-opaque-boundary.ts` already documents.

A result-provenance derivation therefore yields `COLLECTION_CALL_RECEIVER_DERIVED`,
never `COLLECTION_CALL_DERIVED`.

## The sequencing constraint

Discharging the receiver's opacity is sound only if every place a tracked result can go is
either attributed or reported.
The opacity report exists precisely because the alias was untracked;
removing it while a result can still reach an unmodelled sink trades a noisy report for a
silent miss.

So the escape reporting is not a later refinement.
It is what licenses the discharge, and the discharge must not land without it.
Until then, tracking may improve attribution while every existing opacity report stays.

Sinks needing coverage before discharge:
returns (`return facts.get(k)`),
property and element stores (`holder.item = facts.get(k)`),
container insertions (`holder.add(facts.get(k))`),
and results captured by another callable.

## Why identity matching cannot come from the existing predicates

Neither existing predicate can be reused, and both fail on the flagship members.

`resultExposesMutableState` in `effect-primitive-origin.ts` asks whether a result carries
state at all, which is the opposite question.
`resultAliasesReceiverState` in `effect-readonly-view-application.ts` matches `Type`
identity against instantiated element types, but guards `isTypeReference()` first, and
`Array.prototype.at` returns `T | undefined` while `Map.prototype.get` returns
`V | undefined`.
A union is not a type reference, so neither predicate reaches the constituent that would
match.

It also descends into result type arguments, which answers "does this result contain
receiver-like values" rather than "is this result itself receiver state".
Reusing it would produce fresh-shell conflation: `values.slice()` has matching type
arguments and a distinct container, so crediting it to `values` would attribute
`copy.push(x)` to an array the caller never shared.

Type identity should validate an authority entry, never create one.

## Landed increment: the result-provenance authority

`effect-result-provenance-authority.ts` records where a member's result came from,
separately from which channels it runs.
The two are independent: `Array.prototype.join` reaches the indexed channel and returns
nothing of the receiver, while `Array.prototype.at` reaches the same channel and returns
the receiver's own element.
Neither table may be read as evidence for the other.

One relation is represented, `RESULT_RELATION_RECEIVER_VALUE`, meaning the result is
identically a value the receiver held.
Six entries: `Array.at`, `Array.pop`, `Array.shift`, `ReadonlyArray.at`, `Map.get`,
`ReadonlyMap.get`.
Each carries the receiver type-argument position its result comes from, `0` for array
elements and `1` for map values, because a bare relation would let a
`Map<Labelled, string>` lookup claim its `string` result aliases the `Labelled` key.

Container-returning members are named as excluded rather than merely omitted, in
`FRESH_CONTAINER_MEMBER_NAMES`, because "returns receiver elements" reads as "returns
receiver state" to anyone extending the table.

### Enforcement

`effect-result-provenance.unit.test.ts` places a sentinel object in a real receiver and
compares result identity, so a member returning a structurally equal copy fails.
Shape comparison would have passed for `structuredClone`.

Mutation tests, both measured:

- Adding `Array.slice` to the table fails the identity assertion with
  `expected [ 'Array.slice' ] to deeply equal []`, and independently fails the
  fresh-container exclusion.
- Adding a seventh entry *and* editing `VERIFIED_RESULT_RELATION_COUNT` to match still
  fails the architecture guard with `expected 7 to equal 6`, because the registry in
  `catalog-free-architecture.unit.test.ts` holds the count as a literal.

That second guard needed fixing as part of this increment.
Registering an `entryCount` without comparing it to anything is the inert pin the guard
already carried once for the member-channel authority: the registry entry looked like
enforcement and enforced nothing.
Both comparisons now exist for both authorities.

## Landed increment: the expression resolver

`effect-expression-provenance.ts` is the single resolver both origin extractors now
delegate to. Before it, `expressionOrigins` and `rootParameterOrigins` each stripped
property and element access to an identifier and stopped, so they agreed by coincidence
and both stopped at a call.

`effect-member-result-relation.ts` validates an authority entry by `Type` identity
against the recorded receiver position, traversing union constituents.
That traversal is what reaches the entries at all, for the reason recorded above.

### Workspace effect, measured

1,405 findings to 1,424, the first movement in this task.
Offers unchanged at 35; `is used by these calls` 499 to 512; `is used as the object`
588 to 583.

Diffing sorted diagnostic sets: 22 lines removed, 41 added, and 41 minus 22 equals the
19-finding delta exactly, so 22 existing findings gained causes and 19 are new.

The new findings are true positives, and the largest class is not about member results at
all. `??` was the gap:

```ts
// package/module/kv-store/src/create-sync-store.ts:111
const policies = config.eviction ?? [];
const lruPolicy = policies.find(function isLru(p,) { /* ... */ },);
```

`policies` can hold `config.eviction`, so `config` reaches that call.
`expressionRoot` strips property access but not a `BinaryExpression`, so before this
change the whole initializer resolved to nothing and `policies` carried no origin.
Every alias established through `??` was invisible, which is why handling
value-selecting operators was not an incidental detail of following call results.

### What the diagnostic tests could not see

A parameter mutated through a call result also still carries that call's receiver
opacity, and opacity dominates the message, so the fixture emits the same seven
diagnostics whether attribution works or not.
`attributes a mutation reached through a verified member result to its receiver` in
`effect-summaries.unit.test.ts` asserts `mutatedParameterIndexes` directly for the bound,
chained and element-write forms, with the read-only lookup as the control.

Measured mutation: dropping the call branch from `provenanceSuccessors` fails that
assertion with `expected [] to deeply equal [ +0 ]` while the fixture diagnostic count
stays at seven.
The message-level suite passed identically with the resolver disabled, which is why the
summary assertion exists.

## Corrections from a source-bearing review, all measured

An external review with every module pasted in found four defects. Three were in the
landed resolver and are fixed; one predates this work entirely.

### `&&` over-attributed, fixed

`input && new Set()` credited `input` for a `Set` that is always freshly built.
`&&` yields its left operand only when that operand is falsy, and no falsy value is a
mutable object, so any object the expression produces came from the right operand.
Following the left could only invent mutations, and a false mutation record withholds a
read-only offer the parameter deserves.
`&&` is now right-operand-only, alongside assignment and the comma operator;
`??` and `||` keep both operands.

### Runtime-transparent forms were missing, fixed

`facts.get(key) as Set<string>` lost attribution entirely.
`as`, angle-bracket assertions and `satisfies` erase at runtime, so the value is the
operand's own.
`await` stays out: thenable assimilation means an awaited value need not be the
operand's, so admitting it would assert an identity nothing here proves.

### Identity validation had a false negative, fixed

`Map<string, A | B>.get` returns `A | B | undefined`, whose constituents are the two
object types plus absence, while the receiver's held position is the union as one type
object. Comparing flattened result constituents against the unflattened held type found
nothing, because a union never appears among its own constituents.

Both sides are now normalized and the test is a subset rather than an existential one,
which is also stricter: a member returning `Labelled | string` would previously validate
on the `Labelled` constituent alone, crediting the receiver for a result that may be a
fresh primitive.

### Computed member calls were invisible, fixed, and this one was unsound

Pre-existing and unrelated to result provenance. The collection handling, the opaque
boundary and the result relation each tested for a property-access callee, so
`values['push']('appended')` fell through all three at once, nothing recorded the
mutation, and the parameter was offered `readonly`.

Applying that offer, checked against TypeScript 7.0.2:

```text
computed-applied.ts(2,10): error TS7015: Element implicitly has an 'any' type because index expression is not of type 'number'.
```

The map-receiver form was quieter and worse: summary measured `mutated=[] opaque=[]`,
so the rule saw nothing at all.

`effect-member-call-receiver.ts` is now the one definition, accepting property and
element access alike and unwrapping runtime-transparent callee wrappers, since which
form the author wrote has no bearing on what receives the call.
Measured after: `computedStructureEffect` `mutated=[0] opaque=[]`, and
`computedLookupMutationEffect` `mutated=[0] opaque=[0]`.
Reverting element-access acceptance restores the offer.

### One review claim that did not survive measurement

The review suggested `boundLookupMutationEffect` is masked, because it also calls
`facts.set`, which would prove receiver mutation independently.
Measured by disabling the call branch: all three assertions fail, so none is masked.
That measurement also showed `facts.set(key, stored)` alone does not record `facts` as
mutated, which is unexplained and recorded here rather than assumed benign.

## Workspace effect across the increments

Offers held at 35 in every sweep, so nothing in this task has added or removed a
`readonly` suggestion in real code. Only opacity attribution moved.

- 1,405 before result provenance.
- 1,424 after the resolver, 19 new findings, the largest class being aliases through
  `??` that previously carried no origin at all.
- 1,451 after the transparent forms, 27 more.

Four of that last group are a different diagnostic class and are not yet understood:
`Mutation contracts disagree across callable signatures` at `pipe.ts:147`,
`piped.ts:156`, `pipe-async.ts:147` and `piped-async.ts:156`.
Bisected to the transparent-form handling, 4 with it and 0 without, traced to
`package/module/pipe/src/run.ts:51`, `const callableArgs = args as RunCallableArgs`.
That attribution is correct, so the finding is not a reason to revert it.
Whether the disagreement is a real contract gap in that package or a rule-side defect
comparing bodyless overloads against an implementation is open.

## What landed

All four steps of the plan below are built.
The resolver is `effect-expression-provenance.ts`, both extractors delegate to it,
`effect-result-escape.ts` enumerates the attributed positions so an unfamiliar construct
counts as an escape, and `receiverClaimAnswerable` discharges a state-carrying result only
when its relation is verified and no use of it leaves the callable.

Measured on the self-hosting probe:
`opaqueProvenanceByParameter.get` is discharged from all four of its findings and
`summaries.get` from three of them.
The four findings remain, blocked now by closure capture,
by an argument claim about storing a caller-owned value,
and by the deferred iterator member `summaries.values`.

The discharge also exposed a defect it did not create.
Its escape classifier treats a value sitting in an object literal handed to a call as
attributed, on the grounds that the argument analysis walks such literals,
and two things made that false: the walk filtered literal properties by the callee's
authored contract names, and it could not read a value packaged behind an accessor.
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
falsified, and tracked as its own task.

Task #38 tested that last clause and it holds.
A caller that writes through the returned value recovers no origin and records no mutation,
so the same write receives opposite verdicts depending on whether it is routed through a resolved callee.
That is visible from outside, but it is not a false offer:
applying the offered `readonly Row[]` to such a caller type-checks under TypeScript 7.0.2,
because `ReadonlyArray` constrains structure and the write lands on an element.
So the gap costs precision and consistency, not soundness.
`doc/planning/prefer-readonly-return-substitution.md` records the measurement,
and the correction of an earlier revision that called it unsound.

## Remaining work

Iterator members remain separately unproven.
`summaries.values` is a cause of the `effect-fixed-point-propagation.ts:37` finding, so
that one cannot clear on result provenance alone.
