# Narrowing which callables need a complete foreign-ownership proof

Working notes for task #34, fourth attempt.
Written before implementing,
and the reading below changes what the attempt should even be measured against.

## Two gates checked before writing code

### Unknown inbounds only remove provenance

`unknownInboundSummary` in `foreign-borrowed-complete-graph.ts` builds an edge whose
`directForeignByFormal` is all `false` and whose `foreignOriginsByFormal` is all empty.
In `inboundArgumentIsForeign` that fails the first test,
then fails `callerIndexes.length > 0`,
so the inbound reports not-foreign and the narrowing pass deletes the candidate.

So an unresolved caller, a non-call reference, a top-level call and a caller outside owned source all
subtract.
None can add.

### `closureFor` does answer for a file nothing loaded, with one trap

`edgesFor` falls through to `directModuleDependencies` resolved fresh from the program when a file
has no seeded or memoized edges,
so a forward closure can be taken for a marker-naming file the demand-driven index never touched.

The trap is the failure shape.
When any node's edges are unresolved,
`closureFor` returns `wholeScopeClosure()`,
whose `directDependencies` is empty while its meaning is "every indexed source".
Reading that as a reachable set gives the empty set for the case that means everything,
which is the unsound direction.
Any use of it here has to branch on `resolved` first.

A second limit:
an unloaded file's edges are module references only.
Semantic call edges enter through `includeDirectDependencies`, which runs inside `loadSource`.
Whether module reachability is a superset of semantic call reachability is not established,
and the skip is only sound if it is.

## What the reading turned up instead

`propagateForeignBorrowed` computes a greatest fixed point.
`initializeCandidates` seeds every parameter of any callable that has at least one inbound,
then narrowing deletes a parameter unless it is directly marked or every inbound argument is foreign.

A parameter therefore survives with no marker anywhere in the closure whenever the callable's
inbounds all pass a surviving parameter straight through.
Self-recursion is enough:
for `f(a) { return f(a); }` whose only in-scope usage is its own recursive call,
the single inbound has `foreignOriginsByFormal[0] = [0]`,
`candidates.get(f)` holds `0` from the optimistic seed,
so the test passes and the candidate is never deleted.

The result is a non-empty foreign set for a callable nothing marked.

### Which means the existing whole-scope gate already changes answers

`scopeNamesOwnershipMarker` skips the closure entirely for a scope whose text names no marker,
and its doc comment calls that "an equivalence rather than a trade".
For the case above it is not an equivalence.
A recursive callable in a marker-free scope is skipped and reported with no foreign parameters,
while the same callable in a scope that names a marker anywhere gets a closure that reports its
parameters foreign.

The direction is worth being precise about,
because it decides whether this is a defect or only an inconsistency.
Foreign ownership suppresses the read-only offer.
So the closure withholds an offer the skip emits.
Nothing is marked in either case,
so the parameter is not foreign,
so the offer is the correct answer and the withholding is the spurious one.

The gate is therefore more correct than the thing it skips,
and the inconsistency costs precision rather than soundness.

## What this does to the attempt

The planned per-callable reachability test extends the gate from whole-scope to per-callable.
If the reading above holds,
it will not leave the sweep unchanged:
it removes spurious withholding wherever a recursive callable sits in a marker-bearing scope,
which shows up as new offers.

Task #34's own bar,
"show the sweep unchanged at the current findings and offers rather than argue it",
was written against the three attempts that tried to reuse closure results,
where any diff was evidence of a defect.
It is the wrong bar for this attempt.
The right one:
every finding that changes must be a spurious withholding removed,
identified individually,
and no new offer may appear on a parameter anything writes.

## The attempt is refuted, and was not implemented

Three counterexamples, none of which a workspace-equivalence sweep would necessarily have contained.
That is the point:
the design fails deterministically, and measuring it could have passed.

### A marker need not be named in the file that applies it

This is the one that ends it.
`bindingContainsForeignBorrowed` and `expressionContainsForeignBorrowed` inspect checker types,
not source text.
A consumer can write

```ts
withForeign(function apply(value,) { return root(value,); },);
```

where the arrow's parameter is contextually typed by an API declaring `ForeignBorrowed<T>`,
and the consumer's own text names no marker at all.
The same holds for `root(getForeignValue(),)`,
where `directForeignByFormal` becomes true from the callee's return type.

So the set of files that can seed foreign provenance is not the set of files whose text names a
marker,
and any traversal rooted at marker-naming files starts in the wrong place.
Worse for the proposed direction:
the file declaring the marker is typically an outbound dependency of the caller,
so a forward walk from it never reaches the caller at all.

### Module reachability is not a superset of call reachability

The skip needed forward module closure to cover every call path.
It does not.
Two global script files can hold a caller and a callee with no module dependency between them,
and semantic call edges only enter the resolver through `seedEdges` and `includeDirectDependencies`,
both of which run inside `loadSource`.
A precomputed reachable set never sees edges that later loads add.

### Reflexive reachability

`closureFor(F)` does not put `F` in its own `dependencyDigests`,
so a directly marked root in a marker-naming file would have been missed by construction.

## What survives

The reframing does.
Markerless recursive components producing foreign candidates is confirmed independently,
and it means the shipped whole-scope gate already changes answers rather than being the equivalence
its comment claims.
That is a precision defect worth its own task, not part of this one.

The most promising untried direction is no longer about marker locality at all:
compute the foreign proof only when it can change a report.
Foreign ownership suppresses a read-only offer,
so a parameter already recorded as mutated, or already classified as something other than mutable,
has a verdict the foreign answer cannot move.
`createDemandDrivenEffectIndex.get` runs a closure for every callable asked about and hands the
result to `effectPublicSummary` whether or not any consumer reads it.
Deferring it until a verdict actually depends on it approximates nothing and skips whatever the
answer would not have changed.

Sol also recommends shadow mode for any future gate:
run every closure, assert the gate would have admitted every non-empty result,
and record the prospective skip ratio before trusting it.
That is the right shape for a change whose failure mode is silent.
