# Iterator members in the collection channel authority

Working notes for task #15,
"Separate iterator-member creation from consumption in the channel authority".
Predictions are written before the measurement that tests them,
so a prediction that survives contact is evidence and one that does not is a correction.

## What the task inherited

`keys`,
`values` and `entries` sit in the set now called `ITERATOR_MEMBER_NAMES` in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-member-channel-authority.ts`,
which at the time of these notes was named for a deferral rather than for the members it holds.
The stated reason:
creating an iterator reaches nothing,
advancing it reads the receiver,
and nothing in the authority separates the two operations,
so an inert-creation claim would be read as an inert-consumption claim.

Consequence:
every `values()` call is an opaque boundary,
which is one named cause of the unresolved-effect finding at
`effect-fixed-point-propagation.ts:37`.

## Baseline, measured before any change

Probe:
`oxlint --config oxlint.selfhost-probe.config.ts --type-aware --threads 1` over the three modules
that import no semantic API.
The probe config is the root config with the self-hosting override filtered out.

Four findings,
matching what `package/config/oxlint/src/overrides.ts` records.
The `:37` finding on `summaries` names six causes:

-   `(provenanceBySlot.get(slot,) ?? []).forEach` at `effect-slot-projection.ts:182`
-   `summaries.get` at `effect-fixed-point-propagation.ts:90`
-   `summaries.values` at `effect-fixed-point-propagation.ts:49`
-   `summary.opaqueProvenanceBySlot.set` at `effect-call-resolution.ts:419`
-   `target.get` at `effect-uncertainty-provenance.ts:47`
-   `target.set` at `effect-uncertainty-provenance.ts:55`

The rationale comment in `overrides.ts` is already stale independently of this task:
it names `opaqueProvenanceByParameter.get`,
which the slot work renamed,
and it does not name the `forEach` cause at all.

## The correction that reordered the work

My first reading was that channel entries alone would be inert,
because `receiverClaimAnswerable` also needs the result to expose no mutable state or to be verified
receiver state,
and `MapIterator<V>` is neither.
That is wrong as a general claim,
and the counterexample decides the shape of the work.

`Array.prototype.keys()` returns `ArrayIterator<number>`.
`resultExposesMutableState` sees a type reference,
reads its type arguments,
finds `number`,
and answers no.
`receiverClaimAnswerable` therefore returns true at its third check without ever consulting
`callResultReceiver`.
Coverage becomes `COLLECTION_CALL_RECEIVER_DERIVED`,
`recordOpaqueBoundary` runs with `receiverDerived: true`,
and the receiver opacity disappears.

So the channel entry is independently valuable exactly when the iterator yields primitives.
Verified against the declarations actually in use,
`lib.es2015.iterable.d.ts` at TypeScript 7.0.2:
`Array.keys(): ArrayIterator<number>`,
`Map.keys(): MapIterator<K>`,
`Set.values(): SetIterator<T>`.

## Stage one: the channel entries

Claim the union of creation and drainage rather than separating them.
Both operations land inside a channel the authority already admits:
own-index for arrays,
internal-slot for `Map` and `Set`.
Nothing could consume a creation-only fact anyway,
because for-of and spread produce no `CallExpression`,
so `inspectEffectCall` never sees a consumption site.
The separation the task names stays visible in the probe,
which measures creation and drainage as distinct steps,
and collapses only in the recorded entry.

Eighteen entries:
`keys`,
`values`,
`entries` on `Array`,
`ReadonlyArray`,
`Map`,
`ReadonlyMap`,
`Set`,
`ReadonlySet`.
All six interfaces declare all three,
confirmed in the lib.

`Symbol.iterator` stays out and cannot be reached:
`collectionMemberUserCodeChannel` is looked up by `declaration.name.text`,
and a computed symbol name is not an `Identifier`.

### Predictions

-    P1.
     A call to `keys` on any array,
     or on a `Map` with a primitive key,
     stops contributing receiver opacity.
     The mechanism is the primitive type argument,
     not the channel entry on its own.

-    P2.
     `values` and `entries` on a collection holding mutable values keep reporting receiver opacity,
     because `resultExposesMutableState` answers yes and no result relation covers an iterator.

-    P3.
     The `:37` finding does not clear.
     Its cause list keeps `summaries.values`,
     because `summaries` holds `MutableEffectSummary`.
     Stage one is therefore not sufficient for this task's third completion criterion on its own.

-    P4.
     Repo-wide,
     findings fall and offers rise.
     Every new offer is a candidate unsoundness and gets read individually.
     An offer appearing on a parameter that something writes through is the failure signal,
     and reverts stage one.

### Results

P1 holds,
and it is the whole of what stage one buys.
Measured on four shapes added to `readonly-member-channel-invalid.ts`:
`ReadonlyMap<string, SealedLabel>.keys()` and `readonly SealedLabel[].keys()` report nothing at all,
where before each reported an opaque boundary.

P2 holds.
`entries.values()` over the same map keeps reporting,
because `MapIterator<SealedLabel>` has an object type argument.
`entries.entries()` over `ReadonlyMap<string, string>` keeps reporting too,
which is the sharper limit:
both positions of that pair are primitive and the boundary stays anyway,
because a tuple is an object whatever it holds.

P3 holds exactly.
The self-host probe output after stage one is byte-identical to the baseline apart from elapsed time,
so `:37` is unchanged and `summaries.values` is still a named cause.

The fixture assertions were falsified rather than trusted.
Removing the `keys` entries from the authority and rebuilding takes that fixture from seven diagnostics
to nine,
which is exactly the two functions asserted silent.

P4 is answered narrowly rather than by its totals,
and the totals are worth distrusting.
The sweep ran as one root invocation at one thread,
where the 1932 figure it would be compared against came from the sequential per-package procedure,
so the two are different measurements.

I first wrote that the fixture additions accounted for two of the difference.
They account for none.
The readonly fixture sources are excluded from the root lint,
measured by pointing `oxlint` at one directly and being told there were no files to lint,
and confirmed in the sweep output,
which names no `readonly-member-channel-invalid.ts` or `readonly-overload-invalid.ts` location at all.
So the whole of the difference between 1932 and 1941 is procedural,
which is a cleaner statement than the one it replaces:
the two numbers were never comparable,
 and nothing of mine is mixed into the gap.
What the sweep does answer:
offers stand at 32,
the same count as before the change,
and none of the fifteen files containing those offers holds a `keys`,
`values` or `entries` call at
all.
Since the discharge fires only at an iterator call site,
no offer in this repository could have come from it.

The measured control for what stage two would be worth:
`[...records,].reduce(owned, 0)` over a parameter array reports nothing,
because `recordReadonlyViewApplications` answers it before the channel check is reached.
So the cause at `:49` would be removed rather than moved,
had the discharge been able to fire at all.

### Why the discharge cannot hide a write

An argument,
not a measurement,
and it is worth more than the sweep because it covers shapes no repository happens to contain.

A new offer can appear only where an opacity report was the sole thing withholding one.
The mutation analysis is independent:
a body that writes through the parameter records that write and is refused an offer whether or not
anything is opaque.
So the discharge is unsound only if it stops reporting a write that nothing else records,
and the only writes it could hide are writes through what the iterator yields.

The discharge fires only when `resultExposesMutableState` answers no,
which for an iterator means every yielded value is primitive.
A primitive cannot be written through.
So there is no write to hide.

The remaining question is whether the iterator itself,
which is an object holding a live reference to the receiver,
gives an escaping consumer a way to write the collection.
It does not:
an iterator exposes advancement and nothing else,
and the reference it holds lives in an internal slot no source construct can reach.
Advancing reads.

This is what makes iterators the one container the channel entries can admit without the container
relation.
It is also exactly why the entries buy so little:
the same primitive-yield condition that makes them safe is what stops them applying to `values()`
over anything worth iterating.

### Probe obligations

The existing authority probe installs an own `size` accessor on a `Map` or `Set` and indexed
accessors on an array,
then invokes the member once.
For an iterator member it must also drain,
because drainage is where the reads happen.

The sibling trap probe drives a fully trapped array through a `Proxy` and admits exactly the
operations plain indexed access opens.
Drainage of an array iterator reads `length` and then each index,
both of which surface as the `get` trap,
so the trap probe measures drainage where the accessor probe cannot:
`length` on a real array is a non-configurable own data property and cannot be given a getter.
That limit is why the array half needs the `Proxy` and gets it.

`Map` and `Set` cannot be proxied at all,
since their members reject a receiver without the internal slot.
Their drainage claim rests on the specification,
guarded by the `size` accessor tripwire,
which is the same footing every existing `Map` and `Set` entry already stands on.

## Stage two: a container result relation, not yet decided

`FRESH_CONTAINER_MEMBER_NAMES` records that representing "a fresh container holding receiver
elements" needs a relation and a resolver that keeps container identity and element identity apart.
An iterator is the safest possible first case,
because the over-attribution such a relation risks,
crediting the receiver for writes to the container itself,
is unreachable:
nothing writes properties onto an iterator.

Two obstacles found by reading,
both of which must be settled before any of this is written:

-    `resultEscapesCallable` enumerates attributed positions and treats everything else as an escape.
     A `ForOfStatement` parent matches nothing in that enumeration,
     so a for-of iterated expression is an escape today and no discharge could fire.
     A `SpreadElement` parent matches nothing either,
     which is exactly the shape at `effect-fixed-point-propagation.ts:49`.

-    Crediting the receiver for the iterator makes `[...summaries.values(),]` carry the receiver's
     origin,
     which changes what the `.reduce(...)` call on that array literal does.
     I first read that as the cause moving from `values` to `reduce`,
     and that was wrong:
     `recordReadonlyViewApplications` runs before the channel check and can answer the call outright.
     For this shape it should,
     because the result is a `number`,
     the extra argument is `0`,
     and the callback is a local function expression the analysis owns,
     which is every condition `readonlyViewElementApplications` requires.
     So a cause can also be removed rather than moved,
     and neither outcome is predictable without reading which of the two paths answers first.
     Any stage-two measurement has to compare cause lists,
     not finding counts.

## Acceptable outcomes at `:37`

Written down before measuring,
because two very different results both count as progress and only one counts as success.

-    Success:
     the uncertainty finding is replaced by a recorded mutation.
     `propagateEffects` genuinely writes through the map's values,
     so the sound end state is the rule saying "this is written",
     not the rule saying nothing.

-    Also acceptable:
     the finding stays and its remaining cause is named precisely,
     which is the task's own alternative completion criterion.

-    Failure:
     a silent read-only offer for `summaries`.
     That parameter's values are written on every propagation pass,
     so an offer means the analysis lost an effect it used to see.

## Settled

The second outcome holds:
the finding stays,
and its remaining cause is now named exactly.

`summaries.values` still reports,
and no longer for the reason the exemption recorded.
The channel is verified;
what is missing is a relation describing a container whose elements are receiver state,
which is the same thing missing for every `.get` cause in the same finding.
So the finding has one blocker rather than two,
and iterator members are no longer among them.

Closing that blocker is larger than a table entry,
and this is the part worth carrying forward:

-    A container relation alone changes nothing,
     because `useEscapes` treats a `SpreadElement` parent and a `ForOfStatement` parent as
     unrecognised and therefore escaping.
     Every direct drainage shape hits one of those two.

-    Making them attributed is a global widening,
     not a change scoped to iterators.
     `ReadonlyMap.get` is channel-verified with a direct receiver-value relation,
     so admitting for-of would let `for (const value of groups.get('selected',)!)` discharge while
     iteration runs arbitrary user code through `[Symbol.iterator]`,
     `next`,
      and `return` on abrupt
     completion.
     Nothing in alias discovery or `parameterIndexes` accounts for those.

-    Even a complete stage two would leave the `:37` finding standing,
     because its five other causes are untouched by it.

A ticket for the tuple case is worth opening separately and is not part of this:
`resultExposesMutableState` calls a tuple state-carrying without looking inside it,
which is why `entries()` over `ReadonlyMap<string, string>` stays opaque when both positions are
primitive.
Recursing into tuple type arguments would be sound and local.
The current behaviour is now pinned by a fixture assertion,
so changing it is a deliberate act rather than a silent one.
