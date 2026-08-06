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

Iterator members remain separately unproven.
`summaries.values` is a cause of the `effect-fixed-point-propagation.ts:37` finding,
 so
that one cannot clear on result provenance alone.

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
