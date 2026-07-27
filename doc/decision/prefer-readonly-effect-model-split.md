# Split receiver-structure from reachable-user-code in the readonly effect model

Status: accepted, implementation pending.

Decided: 2026-07-27.

Amends: `doc/audit/tech-prefer-readonly-native-effect-analysis-vet-2026-07-22.md`.

Evidence: `doc/troubleshooting/oxlint-prefer-readonly-intrinsic-regression.md`.

## Problem

`prefer-readonly-parameter-type/prefer-readonly-parameter-types` reports 1,661 findings across the workspace,
almost all on ordinary ECMAScript intrinsics. `package/module/caught-value` is 38 lines whose only calls are
`Error.isError` and `String`, and it reports two.

The audit requires that an unresolved effect be derived, contained by a verified isolation boundary,
or reported as opaque. Intrinsics can be neither derived nor isolated, so they are reported as opaque.
The commit that recognised this, `32a06a75b`, exempted only the rule's own directory,
though its stated reason applies to every package.

A recognizer that reads TypeScript's read-only collection views was built and reverted.
It is not that the recognizer was wrong; it is that the summary has nowhere to put its conclusion.

## Root cause in the model

`MutableEffectSummary` carries three dimensions per parameter: `mutated`, `invoked`, `opaque`.
A single `opaque` bit answers two different questions at once:

- Does the callee mutate the structure passed in?
- Can the callee cause user code to run with access to what the parameter reaches?

For `blocks.filter(predicate)` where `blocks: readonly Block[]` the honest answers differ.
The first is no, provably. The second is yes, and the interesting part is exactly what that user code does.
Collapsing both into one bit forces the analyzer to report the parameter as wholly unusable,
which is why idiomatic code that the rule itself pushes toward, `readonly T[]` plus `filter`,
produces findings no code change can satisfy.

## Decision

Split the question into two claims. A receiver is clean only when both are discharged.

### Claim A, receiver structure

Does the member mutate the collection or object identity passed as the receiver?

Discharged by membership of a default-library `Readonly*` interface, proved through the semantic project
with `isSourceFileDefaultLibrary`. TypeScript declares a read-only view beside each mutable collection and
places on it exactly the operations that remain available once the holder may not mutate the value.
Membership is therefore upstream's own assertion, read off the resolved declaration.

Verified against TypeScript 7.0.2: `ReadonlyArray`, `ReadonlyMap`, `ReadonlySet` and `ReadonlySetLike` are the
whole matching set, and none declares a mutator. The prefix is upstream's convention, so no member list is
authored here and a view added later is covered without an edit.

### Claim B, reachable user code

What user code can this call run, and what does it do to values reachable from the receiver?

Discharged only by analysis, never by assumption:

- When the caller supplies the observing function, that function is owned source with its own summary.
  Its effects propagate to the receiver through a relation derived from the member's own generic signature.

  Do not assume a parameter position. Resolve the receiver's element type from the `Readonly*` instantiation,
  then take every callback parameter whose type is that element type. Position varies by member:
  `forEach(callbackfn: (value: T, index: number, array: readonly T[]) => void)` carries the element at
  parameter 0, while
  `reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, ...) => U, initialValue: U)`
  carries the accumulator at 0 and the element at 1. A comparator passed to `toSorted` carries it at both 0
  and 1. Matching by type rather than index handles all of them, and misreading `reduce` as element-at-0
  would map element flow onto the accumulator and silently discharge a real effect.

  Match against the receiver type as well as its element type. `forEach`'s third callback parameter is
  `array: readonly T[]`, the receiver itself, so a callback declaring it can reach receiver state without
  ever touching an element parameter. Matching elements alone would miss that entirely.

  The relation is read from the declaration's types, not asserted. Measured in TypeScript 7.0.2, the
  instantiated callback parameter types are reference-identical to the receiver's type argument, so identity
  comparison suffices and a failed match is a missed discharge rather than a false one.
- When the member observes elements with no caller-supplied function, nothing is discharged.
  `join` coerces elements through `String`, `toSorted()` without a comparator runs the default comparator,
  and `toLocaleString` likewise. These stay opaque.
- Deep readonly-ness of the element type discharges nothing on its own. That is the static plain-data
  exemption the catalog-free architecture removed, and it stays removed.

### Mechanism for claim B

The existing propagation machinery cannot carry this relation, so the split adds one.

`propagateEffects` skips any edge whose callee has no summary
(`effect-fixed-point-propagation.ts`, the `calleeSummary === undefined` guard), and a default-library member
never has one. `CallbackRelation` is also the wrong shape: it maps a callee's own parameter to a callback
that callee invokes, which `propagateCallbackRelations` then resolves in the caller. The relation needed here
runs from the receiver's *elements* to a callback the caller passes directly, with no owned callee anywhere.

So the caller's summary gains `elementApplications`, recorded when a call satisfies claim A:

```ts
export type ElementApplication = {
  readonly receiverParameterIndex: number;
  readonly callbackKey: string;
  readonly callbackParameterIndexes: readonly number[];
};
```

Its propagation step runs per summary rather than per call edge, resolves `callbackKey` against `summaries`,
and writes into the existing dimensions: a callback mutating any element parameter marks the receiver
`mutated`, and one leaving any element parameter opaque marks the receiver `opaque` and carries the
provenance. This mirrors `propagateCallbackRelations` exactly, which is the precedent for element mutation
surfacing as `mutated` rather than `opaque`.

Because it writes only to dimensions that already exist, `EFFECT_DIMENSION_COUNT` stays at three and the
fixed-point bit budget remains a correct termination bound. The field is JSON-safe, so serialization is
mechanical; a cache written before this change lacks the field, fails structural validation, and is
recomputed, which is the fail-closed outcome.

## What this does not change

The four removals recorded in `doc/planning/replace-prefer-readonly-parameter-types.md` all stand:
handwritten catalogs, `@mutates` as a discharge mechanism, static plain-data exemptions,
and bodyless host authorities. Nothing here trusts a member list or a hand-authored effect.

Fail-closed remains the default. The split adds one derivable discharge path and one derivable propagation
path; every case that cannot use them reports exactly as it does now.

## Consequences, predicted

These are predictions to be checked against measurement, not results.

- Receiver-side findings on callback-taking members should clear: `map` (164), `filter` (70), `some` (25),
  `flatMap` (25), `every` (25), `forEach` (23), `reduce` (15), `find` (14) across the workspace.
- Receiver-side findings on implicit-coercion members should remain: `join` (44), `toSorted` (11).
- Members with no caller-supplied function and no coercion, `get` (35), `has` (27), `slice` (46), `at` (15),
  should remain, because claim B has no evidence to work from. This is a known conservative gap.
- Argument-side findings, 763 of the 1,661, are untouched. `String`, `Object.entries`, `JSON.stringify` and
  `Error.isError` can each invoke getters, proxy traps or `toJSON`, so those findings are the rule being
  correct and will survive.

Reaching zero is not the goal and would indicate the guarantee had been abandoned.

## Acceptance

The audited fixtures decide correctness, and all must keep their current expectations:

- `arrayCallbackSemanticEffect` keeps reporting an effect on parameter 0, but the dimension changes from
  `opaque: [0]` to `mutated: [0]`. Its callback assigns `state.value`, which is a proven mutation rather
  than an unresolved call, and `propagateCallbackRelations` already routes exactly this shape to `mutated`.
  The sibling fixture `aliasedCallbackSemanticEffect` is the same mutation reached through an owned callee
  and expects `mutated: [0]` today, so the split makes the two agree instead of splitting them by
  coincidence of routing. Its `@mutates states` contract holds either way.

  This corrects an error in the first draft of this decision, which asserted the fixture would stay
  `opaque: [0]`. Under the split, keeping it opaque would mean the analyzer had failed to resolve a callback
  it demonstrably resolved.
- `objectArraySortCallbackEffect` stays `opaque: [0]`. Its comparator calls `localeCompare`, itself
  unresolved, so opacity propagates from the callback.
- `readonly-static-plain-data-invalid.ts` keeps four diagnostics. `join` and `toSorted()` supply no observer.
- `readonly-catalog-free-invalid.ts` keeps 21.

`applyCargoPlan` in `workspace-source-effect.unit.test.ts` is expected to change from `opaque: [0]` to
`opaque: []`. Its only relevant calls are `plan.blocks.filter(...)` and `plan.enforcements.reduce(...)`,
whose callbacks reach only owned functions already proven effect-free. That expectation is a snapshot of the
coarse model rather than a policy, and updating it is part of this change.

Performance must not regress. The 10-second cold-run figure in
`doc/troubleshooting/oxlint-prefer-readonly-incremental-cache.md` is that incident's open acceptance target,
not a gate this change inherits: the same document measures the cold run at 62.9 seconds and the warm run at
1.0 seconds. Measured here before any edit, `//package/config/oxlint:lint:oxlint` runs warm in 923
milliseconds over 14 files with no findings, and `//package/module/caught-value:lint:oxlint` reports two
errors in 1.2 seconds. Those are the numbers this change is held to; closing the cold-path gap remains the
other incident's work.
