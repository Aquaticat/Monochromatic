# Accumulate every parameter origin per binding in `prefer-readonly-parameter-types`

Accepted and landed on 2026-07-27, after the user authorized the widening.
Scope: `package/oxlint-plugin/prefer-readonly-parameter-type`.
Raised while scoping result provenance for collection member calls,
then found to be a live unsound suggestion rather than a modelling enhancement.

## Problem

`bindingOriginBySymbolId` mapped one binding symbol to one parameter index.
A local alias reassigned from a second parameter therefore discarded the first origin,
and every effect recorded through that alias landed on whichever origin was written last.

The consequence was not an under-report.
The rule offered a `readonly` annotation for a parameter the body mutates,
and applying that annotation failed to compile.

### Evidence

Fixture, now `package/test-fixture/oxlint-no-restricted-syntax/src/readonly-binding-origin-invalid.ts`:

```ts
export function reassignedAliasEffect(
  first: Labelled[],
  second: Labelled[],
  flag: boolean,
): void {
  let cursor = second;
  if (flag)
    cursor = first;
  cursor.push({ label: 'appended', },);
}
```

Before the fix the rule emitted one diagnostic, naming the wrong parameter:

```text
Parameter "second" should be readonly: mutable Array has ReadonlyArray projection.
```

`first` was correctly withheld, because `cursor = first` was the last write to `cursor`'s
origin entry, so `cursor.push` recorded origin `0`.
`second` was offered because its own origin had been overwritten and never recorded.

Applying that suggestion, checked against TypeScript 7.0.2:

```text
applied-suggestion.ts(11,10): error TS2339: Property 'push' does not exist on type 'readonly Labelled[]'.
```

The same file with `second: Labelled[]` type-checks clean,
so the error was introduced by the rule's advice and not pre-existing.

## Decision

The map value became a set of origins, accumulating rather than replacing.

- `ParameterOrigins` (`ReadonlySet<number>`) and `NO_PARAMETER_ORIGIN` in
  `effect-summary-model.ts` replace the `number | PARAMETER_INDEX_UNAVAILABLE` shape on
  every origin-resolving path.
  Emptiness carries absence, so the sentinel is not joined into a union with a set that
  already distinguishes "no origin" from "some origin".
- `PARAMETER_INDEX_UNAVAILABLE` stays for the propagation paths that genuinely carry one
  callee index at a time, which is why `addEffectIndex` and `addEffectIndexes` are separate.
- `expressionOrigin` became `expressionOrigins`, and `parameterIndex` became
  `rootParameterOrigins`.
  Both names had become misleading once they returned a set.
- `expressionHasParameterOrigin` exists for the callers that only ask whether a root is
  parameter-derived, which keeps the existence test from reading as a chained member access.

### Why convergence improves

`registerBindingOrigin` reports progress as "did the set grow".
Under overwrite it reported `prior !== parameterIndex`,
so the fixture's alias flipped between origins `1` and `0` on every pass and reported
progress each time.
`changed` never settled, and `discoverAliasOrigins` terminated only when `pass` exceeded
its candidate-alias bound.
Monotone growth makes the fixed point settle on its own merit,
and the bound is a backstop again.

### Accepted cost, measured

Accumulation is flow-insensitive, and `flowInsensitiveAliasEffect` in the fixture pins what
that costs:

```ts
let cursor = shadowed;
cursor = reached;
cursor.push({ label: 'appended', },);
```

Only `reached` can be what the alias holds when the mutation runs,
yet both parameters are credited and `shadowed` loses a read-only offer it deserves.
Measured: neither parameter is offered.
Overwrite happened to get this shape right, by keeping only the last write,
and got the branching shape wrong.

That trade is deliberate and asymmetric.
Withholding an offer costs a suggestion the author could have taken.
Making one for a mutated parameter emits an annotation that does not compile,
which is the defect this decision repairs.

## Sites that changed

Fifteen files mention `bindingOriginBySymbolId`;
most thread it through as a parameter and needed only the widened type.

- `effect-binding-origins.ts`, the accumulation itself, the progress signal, and
  `registerBindingOrigins`, which snapshots before registering so a self-assignment
  cannot have one call iterating the set another call is inserting into.
- `effect-call-resolution.ts`, the root lookup and the object-shorthand lookup.
- `effect-opaque-boundary.ts`, one opaque record per receiver origin.
- `effect-call-analysis.ts`, one `directInvoked` entry and one callback relation per origin.
- `effect-readonly-view-application.ts`, one derivation per origin, accumulated before
  anything is recorded so a disagreement leaves the whole call to the opaque boundary
  rather than recording a partial answer.
- `effect-collection-member-effect.ts`, the mutated-receiver record.
- `effect-summary-cache.ts`, now a deep clone, matching `opaqueProvenanceByParameter`.
  A shallow copy would have shared each origin set with the cached summary, which is
  what cloning exists to prevent.

## The persistent cache is unaffected

`effect-summary-serialization.ts:220` rebuilds the field as `new Map()` when a summary is
deserialized, because symbol ids are process-local.
Origins never round-trip, so widening the value type is not a schema change and
`EFFECT_CACHE_SCHEMA` did not move.

## Enforcement

`credits a reassigned alias with every parameter it can hold` in
`prefer-readonly-parameter-type.unit.test.ts` pins the whole expected message set.

The mutation test: reverting the accumulator lookup in `registerBindingOrigin` to a fresh
set, so origins overwrite again, must fail that assertion.
Measured, with overwrite restored and the package rebuilt, against the fixture as it stood
with only the two alias cases in it:
the rule emitted exactly
`Parameter "second" should be readonly: mutable Array has ReadonlyArray projection.`

`readAliasEffect` is that control.
Every other claim in the case is that some parameter is *not* offered,
which a fixture nothing linted would satisfy equally well,
so one parameter that must be offered is what proves the file reached the rule.
This was not hypothetical: the first version of the assertions passed against a fixture
emitting nothing at all.

## Relationship to result provenance

Modelling result provenance for collection member calls propagates through the same core
and is now unblocked.
The two stayed separable on purpose: this was a bug fix in one map's value type,
so its measurement is attributable on its own.
