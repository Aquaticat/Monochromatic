# Model result provenance for collection member calls in `prefer-readonly-parameter-types`

In progress, accepted in direction on 2026-07-27.
Scope: `package/oxlint-plugin/prefer-readonly-parameter-type`.
This document records the design and the first landed increment.
It is not a record of completed work: the resolver and the escape reporting that make the
receiver discharge sound are not built yet, and the sequencing constraint below is why.

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

## Remaining work

1. An iterative expression provenance resolver, work-stack rather than recursive per
   `ITR`, covering property and element access, verified direct-value calls, parentheses
   and assertions, and value-selecting expressions.
   `??` matters specifically: `target.get(k) ?? new Set()` is a `BinaryExpression`, so a
   resolver handling only calls would miss this package's own blocking shape.
2. Delegating `expressionOrigins`, `rootParameterOrigins`, direct-write attribution and
   call-argument extraction to that resolver, so extractors cannot disagree.
3. Escape reporting at every sink listed under the sequencing constraint.
4. Only then, changing `receiverClaimAnswerable` so a state-carrying result is answerable
   when its relation is verified and the resolver represents it.

Iterator members remain separately unproven.
`summaries.values` is a cause of the `effect-fixed-point-propagation.ts:37` finding, so
that one cannot clear on result provenance alone.
