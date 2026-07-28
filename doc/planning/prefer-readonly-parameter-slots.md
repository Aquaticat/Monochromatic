# Attributing effects to parameter slots instead of parameter indexes

`prefer-readonly-parameter-type` keys every effect fact by parameter index.
A single destructured object parameter gives every binding it introduces the same index,
so a callee taking `{ named, unnamed }` records anything about either against index zero.
`ST9` requires that shape for every function taking more than one input,
which makes the collapse the ordinary case here.
`doc/decision/prefer-readonly-contract-name-narrowing.md` records the three defects it caused
and the precision it costs.

This plan replaces the index with a slot,
and records the design before any of it is built so the staging can be checked against it.

## What a slot is

A slot is a parameter index paired with at most one property name reached through it.
Slots are allocated per callable declaration,
as a pure function of the declaration alone:

- slots below `parameterCount` are the whole parameters,
   numbered exactly as parameter indexes are today,
   so every existing fact keeps its meaning;
- slots from `parameterCount` upward are one per named binding a parameter's destructuring
   pattern introduces.

Depth is deliberately capped at one property.
A nested pattern attributes its inner bindings to the outer property's slot,
which is sound because a write through the inner binding is a write through the outer property,
and more precise than widening to the parameter.

Purity of the allocator is what lets a caller and a callee agree on a numbering without the
caller re-analyzing the callee's body.
`addOwnedCallEdge` holds the callee declaration,
so it computes the same table the callee's own summary computed.
Deriving slots from the body instead would break that agreement,
which is why a write through a plain identifier parameter, as in `function f(o) { o.p.x = 1 }`,
still records the whole parameter.
That is today's behaviour, so it is not a regression.

## Why numbers rather than string keys

A string slot key on the edge would let the caller name a callee property without knowing the
callee's numbering.
It buys nothing here.
The caller already holds the declaration,
`analyzerDigest()` hashes every analyzer source so a change to the allocator invalidates every
persisted summary,
and numbers keep the serialization, the hashing and the propagation loop unchanged in shape.

## The brand is the safety mechanism

Under this change `mutated.has(0)` stops meaning "parameter zero is mutated",
because a write to `named.label` records a property slot instead.
Every surviving `.has(parameterIndex)` becomes a dropped effect,
and a dropped effect is what offers `readonly` for written state.
TypeScript flags none of it,
since both sides stay `number`.

So `EffectSlot` and `ParameterIndex` become distinct brands before anything else moves,
following the repo idiom in `package/module/fs-id/src/types.ts`.
`ReadonlySet<EffectSlot>.has` then rejects a `ParameterIndex`,
and every conversion becomes a compile error that has to be answered rather than a grep that
has to be complete.
Fields whose meaning changes are renamed in the same pass,
so a consumer that never converts still fails to compile.

## The five formal-indexed arrays

`doc/planning/prefer-readonly-call-edge-shapes.md` records that `arguments`,
 `foreignArguments`,
 `directForeignArguments`,
 `callbackKeys` and `callbackFileNames` are read by formal index and must stay aligned.
Slots split them, so each is decided here:

- `arguments` becomes slot-indexed,
   holding caller slots.
   `propagateCalleeIndexes` reads it with a callee slot and needs no change.
- `callbackKeys` and `callbackFileNames` become slot-indexed,
   because `effect-invoked-capability.ts` reads them with an index drawn from
   `calleeSummary.invoked`, which now holds slots.
   Leaving them formal-indexed would misread a property slot as a formal.
- `foreignArguments` stays parameter-indexed and holds caller parameter indexes,
   because `foreign-borrowed-propagation.ts` compares its values against caller candidates that
   are parameter indexes,
   and `ForeignBorrowed` is a marker on a whole parameter rather than on a property.
   The conversion happens where the edge is built, not where it is read.
- `directForeignArguments` stays parameter-indexed, for the same reason.

## The external path needs projection, not slots

`applyExternalEffect` indexes a positional argument map with parameter indexes taken from an
external callable's public summary.
If that summary starts carrying slots, a property slot indexes past the end of the map and the
effect is dropped, which is the unsound direction.
External summaries are therefore projected to parameters before they are applied.

## Staging

Each stage is committed separately and the workspace sweep is compared by offer identity.

1.  Allocator, brands and threading, with the public summary projecting slots back to
    parameters. The sweep must be identical: same findings, same offers. A difference here
    means a `.has` site was missed, which is the cheapest possible signal.
2.  Caller-side property matching in `addOwnedCallEdge`. Numbers move. Every recovered offer
    is verified individually.
3.  Diagnostic naming narrowed to the affected bindings, so a finding stops naming primitives
    that cannot carry state.

## Rules decided in advance

- **Renamed binding** `{ a: b }`. The slot key is the property name `a`, since that is what a
   caller writes; the symbol registered is `b`'s.
- **Rest property** `{ a, ...rest }`. `rest` takes the whole-parameter slot. No caller property
   name matches it, and it can hold any property the literal supplies.
- **Default inside a pattern** `{ a = fallback }`. The binding takes its own property slot;
   the initializer's own origins are registered against that slot.
- **Computed property name**. No slot. The binding takes the whole-parameter slot.
- **Spread in the caller's literal** `{ ...other, named: first }`. Every property slot of that
   formal receives the full union of the literal's origins. Ordering between a spread and a
   later property is not reasoned about.
- **Non-literal actual**. Every property slot of the formal receives the actual's origins,
   which is what happens today.
- **Overloads**. `overload-consistency.ts` compares two different declarations with two
   different slot tables, so both sides project to parameters before comparing.
- **Propagation bound**. `effect-fixed-point-propagation.ts` counts
   `parameterCount * EFFECT_DIMENSION_COUNT`. It becomes slot-count-based, otherwise
   `EffectPropagationError` throws on a program that is converging normally.

## Acceptance

`narrowingPrecisionCostEffect` reads `mutated` projected to parameters as the first parameter
alone, where it reads both today.
Fixture assertions state both levels,
parameter-level for the invariants that must not move and slot-level for the new precision,
so a regression in the projection cannot hide behind a passing parameter-level assertion.
