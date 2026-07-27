# Widen `bindingOriginBySymbolId` so a reassigned alias keeps every origin

Proposal, not an accepted decision.
Scope: `package/oxlint-plugin/prefer-readonly-parameter-type`.
Raised while scoping result provenance for collection member calls,
then found to be a live unsound suggestion rather than a modelling enhancement.

## The finding

`bindingOriginBySymbolId` maps one binding symbol to one parameter index.
A local alias reassigned from a second parameter therefore discards the first origin,
and every effect recorded through that alias lands on whichever origin was written last.

The consequence is not an under-report.
The rule offers a `readonly` annotation for a parameter the body mutates,
and applying that annotation fails to compile.

## Reproduction

Fixture, placed in a package the rule already lints:

```ts
// probe-origins.ts
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

The rule emits one diagnostic, naming the wrong parameter:

```text
Parameter "second" should be readonly: mutable Array has ReadonlyArray projection.
```

`first` is correctly withheld, because the assignment `cursor = first` is the last write to
`cursor`'s origin entry, so `cursor.push` records origin `0`.
`second` is offered `readonly` because its own origin was overwritten and never recorded.

Applying the suggestion, checked against TypeScript 7.0.2:

```text
applied-suggestion.ts(11,10): error TS2339: Property 'push' does not exist on type 'readonly Labelled[]'.
```

The same file with `second: Labelled[]` type-checks clean,
so the error is introduced by the rule's advice and not pre-existing.

## Why overwriting also weakens convergence

`registerBindingOrigin` reports progress as `prior !== parameterIndex`
(`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-binding-origins.ts:73`).
Under overwrite, the fixture's alias oscillates:
`discoverAliasOrigins` writes origin `1` from the declaration each pass,
then origin `0` from the assignment each pass,
and both writes report a change.
So `changed` never settles,
and the loop terminates only because `pass` exceeds the candidate-alias bound at
`effect-binding-origins.ts:179-181`.

Accumulating origins makes the map grow monotonically,
so `changed` becomes "did the set grow" and the fixed point converges on its own merit.
The existing bound still dominates the longest alias chain,
so it stays as the backstop it was meant to be.

## Sites that touch the map

Fifteen files mention `bindingOriginBySymbolId`;
all but these thread it through as a parameter.

- `effect-binding-origins.ts:68-73`, the unconditional `set` and the progress signal.
- `effect-binding-origins.ts:132`, the alias lookup inside `expressionOrigin`.
- `effect-call-resolution.ts:80`, the argument-root lookup.
- `effect-call-resolution.ts:172`, the shorthand-property lookup.

Each read resolves to a single index today and would resolve to a set of indexes,
with consumers adding all of them to `directMutated`, `directOpaque` and `directInvoked`.

## The persistent cache is not affected

`effect-summary-serialization.ts:220` rebuilds the field as `new Map()` when a summary is
deserialized, so origins never round-trip through the cache.
Symbol ids are process-local, which is why.
Widening the value type is therefore not a schema change,
and `EFFECT_CACHE_SCHEMA` does not need to move.

## Expected measurement movement

Counts will rise, in fixtures and across the workspace.
Every consumer goes from recording one origin to recording all of them,
so parameters currently offered `readonly` by accident of overwrite start being withheld.
That is the soundness fix landing.
Recording the direction in advance so a later reading does not misfile it as a regression.

## Mutation test to add with the fix

Reverting accumulation to overwrite must fail a named fixture assertion.
`reassignedAliasEffect` above is that fixture:
under overwrite it produces the `second` diagnostic quoted here,
and under accumulation it must produce no `readonly` offer for either parameter.

## Relationship to result provenance

Task `#11` (result provenance for collection member calls) propagates through the same core.
The two are separable:
this fix is a bug fix in one map's value type,
and result provenance adds a new summary fact.
Landing this one alone keeps its measurement attributable,
and unblocks `#11` as a consequence rather than as a justification.

## Open question for the user

Authorization to widen.
The alternatives considered and rejected:
invalidating a binding on conflicting origin is sound but discards information the
analysis already has,
and dropping reassigned aliases entirely under-reports for the same reason overwrite does.
