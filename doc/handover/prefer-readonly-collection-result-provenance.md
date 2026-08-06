# Handover: collection result provenance in `prefer-readonly-parameter-types`

Live document.
Updated as increments land,
 so the last section is the one to read first when picking this up.

Branch:
 `feat/readonly-collection-result-provenance`.
Worktree:
 `/home/user/worktrees/readonly-result-provenance`.
Issues:
 #414 the defect,
 #415 the trust baseline (closed, decided),
 #416 the shorthand provenance defect (closed, fixed).

## Why this work exists

Issue #414 reported that the rule fires on ordinary array methods over already-readonly parameters and prints
four remediations that fit none of them.
 The finding was intentional under the effect model,
 so the first
investigation recommended a better message.
 One measurement overturned that:
`slices.map(function toRow(slice) { return { chars: slice.targetChars }; })` is opaque although every object in
the result is freshly allocated inside an owned callback and holds one number.
 No rewrite fixes that finding.
The gate reads type shape where the claim is about provenance.

Two decisions followed,
 both accepted by the repository owner:

- `doc/decision/prefer-readonly-result-provenance.md`,
   "Adopted for issue #414":
   result provenance replaces
  the type-shape result gate.
- `doc/decision/prefer-readonly-member-channel-authority.md`,
   "The stated trust baseline":
   standard
  dispatch,
   indexed data properties,
   the standard iterator and default `Symbol.species` are trusted for a
  value typed as a collection view.
   Three of those four were already trusted,
   two of them silently.

## How to reproduce the measurements

Both scripts run against the built entry and write nothing into the tree,
 by supplying their own source text
over an existing fixture path.
 Build first:
 `mise run //package/oxlint-plugin/prefer-readonly-parameter-type:build`.

```js
// summaries for one overlay source, the shape every probe here uses
import {
  buildEffectSummaryIndex,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
} from '<worktree>/package/oxlint-plugin/prefer-readonly-parameter-type/dist/final/node/index.mjs';

const FILE_NAME = '<repo>/package/test-fixture/oxlint-no-restricted-syntax/src/readonly-catalog-free-invalid.ts';
const session = openSemanticFile({ fileName: FILE_NAME, sourceText: SOURCE, hasBOM: false, },);
const index = buildEffectSummaryIndex({ project: session.project, activeSourceFile: session.sourceFile, },);
const summary = index.get(session.nodeAtOffset(SOURCE.indexOf('function name',) + 'function '.length,).parent,);
```

Baseline recorded on 2026-08-06,
 for a parameter typed `readonly Slice[]` whose element type is deeply
readonly:

- opaque:
   `filter`,
   `slice`,
   `entries`,
   `find`,
   and `map` whose callback returns an object.
- clean:
   `for...of`,
   spread,
   indexed read,
   destructuring,
   counter loop,
   `reduce` to a number,
   `map` to a
  number,
   `forEach`,
   `every`,
   and `filter` on `readonly string[]`.

The case that must flip is the fresh-object `map`.
Reaching zero is not the goal and would mean the guarantee had been abandoned.

## Plan

`doc/planning/prefer-readonly-collection-result-provenance.md` carries the eight increments and the six traps
two reviews found in the first draft.
 Read it before changing any gate.
 The short version:
 steps 1 to 4 change
no verdict,
 step 5 is the first verdict change,
 step 7 withdraws the type-shape gate last,
 step 8 is the
diagnostic #414 asked for.

## Working rules for this branch

- Commit through the worktree,
   which needs `git cli-git trust` once and the forbidden-strings binary at
  `package/cli/forbidden-strings/target/release/forbidden-strings`,
   gitignored and copied from the main
  worktree.
- `mise run //package/oxlint-plugin/prefer-readonly-parameter-type:test:unit` builds first,
   so it is the one
  command that covers a change.
   `lint:types` and `lint:oxlint` after every TypeScript edit.
- Every authority entry keeps its probe.
   An entry added without a passing identity probe is a defect by both
  authority documents' own standard.
- The two fixture diagnostic counts move together with the fixtures:
   `readonly-result-provenance-invalid.ts`
  is pinned at 13 messages in `prefer-readonly-parameter-type.unit.test.ts` with its offer list enumerated in
  full,
   and `readonly-catalog-free-invalid.ts` at 16.
   A count that drops is a report traded for something:
  check it was traded for an attribution and not for silence.

## Progress

### Landed

- `44b6cf767`,
   issue #416.
   Shorthand property provenance.
   `effect-expression-provenance.ts` resolved a
  shorthand property name with `getSymbolAtLocation`,
   which answers with the property rather than the local it
  reads,
   so a returned `{ row }` recorded no origin while `{ row: row }` recorded one and a caller writing
  through the returned holder kept its read-only offer.
   Fixture pair `packageRowShorthand` and
  `packageRowExplicit` with their writing callers,
   asserted in `effect-summaries.unit.test.ts`.
- `268a81632`.
   The increment plan and the traps.
- `873d444ea`,
   increment 1.
   The observer obligation is separate from the ambient channel.
   `OBSERVER_BEARING_MEMBER_NAMES` and `memberInvokesObserver` in
  `effect-member-channel-authority.ts`,
   consulted by `memberChannelIsVerifiedNarrow`,
   which now refuses an
  observer-bearing member whatever its ambient channel is.
   A new case in
  `effect-member-channel-authority.unit.test.ts` fails if any table entry ever names one,
   which is the guard
  the first draft of this work lacked.
   Verdicts unchanged,
   confirmed against the baseline above.
- `0ce8ede07`,
   increment 3.
   `find` and `findLast` carry the direct receiver-value relation on `Array` and
  `ReadonlyArray`,
   probed for identity against a sentinel with an accepting predicate,
   so the miss path
  cannot pass the comparison vacuously.
   `VERIFIED_RESULT_RELATION_COUNT` and the architecture guard's registry
  both move to 10.
   Verdicts unchanged,
   because both members invoke an observer and the composition from
  increment 1 still withholds their receiver claim.

- `4307d6fde`,
   increment 2,
   first half.
   The shared resolver prunes a successor that cannot carry mutable
  identity,
   so `{ named: row.label }` records no origin while `{ row }`,
   `{ row: row }` and `[row]`
  still do.
   Measured before and after on the same overlay sources.
   `packageCountFresh` in the
  result-provenance fixture pins it,
   with a deeply readonly parameter so it adds no diagnostic to the
  sibling counts.
   Whole suite unchanged,
   and the baseline above is unchanged.

### Deferred, with its reason

Increment 2,
 second half:
 the discriminated answer,
 proven-with-origins against unproven.
 `NO_SLOT_ORIGIN`
today means both "proven to carry nothing" and "could not be resolved",
 and discharging on an empty set
would repeat the defect the effect-model split already caught once,
 where an empty match silently dropped a
real mutation.
 `rows.map(row => unknownClone(row))` is the case that must stay unproven.

Deliberately deferred to increment 6 rather than done with the pruning:
 its only consumer is the observer-return
relation,
 nothing today discharges on a returned set,
 and changing the resolver's return type across every
extractor without a consumer would be a wide edit that proves nothing.
 The pruning half had a measurable
effect on its own and landed on its own.

- `449d3f945`,
   the container relation,
   which is increment 5's first half.
   `RESULT_RELATION_RECEIVER_ELEMENTS`
  for `filter` and `slice` on `Array` and `ReadonlyArray`,
   resolved by `callResultElementReceiver`
  rather than by `callResultReceiver`,
   which keeps meaning direct identity and now refuses any other
  relation explicitly.
   Probed in both halves,
   since either passes for the wrong value:
   the result is not
  the receiver,
   and an element of it is the sentinel.
   `FRESH_CONTAINER_MEMBER_NAMES` drops to five,
   each
  remaining name held back for a reason recorded beside it.
   Counts move to 14 in both places.
   No discharge
  consults the new query,
   so no verdict moves.
- `12ee85fb8`,
   the pin the facet has to move.
   `containerElementWriteEffect`,
   `filteredElementWriteEffect`
  and `containerGrowthEffect` in the result-provenance fixture,
   all three recording no mutation today,
   with
  the receiver opacity of an undischarged member doing the withholding.
   When the facet lands the two element
  writes must become `[0]` and the push must stay empty;
   a change moving all three,
   or neither,
   is the
  failure this pins.
   The fixture's pinned message count moves to 12,
   its offer list is unchanged at three.

- `f958b750b` and `e78aef28b`,
   increment 4.
   The element step is answered before the access layers are
  stripped,
   and only for a container whose relation is verified,
   so an unproven container still
  contributes nothing.
   `containerElementReceiver` follows local hops through declaration initializers,
   never
  through a later assignment,
   which over-attributes rather than under-attributes.
   All four spellings
  answer:
   element access,
   array pattern,
   `for...of`,
   and spread;
   an object pattern keeps asking the
  value question,
   since a container's properties are its own rather than its elements.
   Measured:
   all
  four writes attribute `[0]` and `containerGrowthEffect` stays empty.
   `expressionElementOrigins` lives in
  its own module so `effect-binding-origins.ts` stays inside the line limit,
   and the fixture's pinned
  message count moves to 15.

Increments 4 and 5 swapped order,
 for the reason that deferred the discriminated answer.
 Enumerated rather
than assumed:
 no binding can hold element-only origins today,
 because `callResultReceiver` answers only for
the direct-value relation and every entry in the result-provenance authority is one.
 So the facet would have
had no consumer and no test that fails without it.

The order is now the container relation first,
 exposed but consulted by no discharge,
 then the facet that
consumes it,
 then the discharge that needs both.
 The first two are landed.

- `43e65ed7b`,
   the container discharge,
   and the first verdict change.
   `slice` joins the channel authority
  under `MEMBER_CHANNEL_RECEIVER_INDEX_AND_SPECIES`,
   and a verified container relation licenses the same
  discharge a direct one does on the same escape condition.
   The escape test is asked once,
   before either
  relation,
   because it follows the call's result to whatever holds it and is relation-agnostic.

  Two consumers had to learn the element question first,
   and measurement found both where an audit had
  not.
   An argument that is a fresh container hands the callee everything it holds,
   and
  `unresolvedSink(rows.slice())` reported nothing at all until `parameterIndexes` asked;
   an unresolved call
  on a container receiver reaches the same values,
   and `tree.children.slice().filter(observer)` lost its
  finding entirely until the opaque boundary asked.
   Both were reports traded for silence,
   which is the one
  outcome the discharge may not produce.

  Measured across six escape shapes:
   a local read discharges,
   an element write becomes an attribution,
  and a return,
   a store,
   an argument and an escaping element all keep reporting.
   The species tripwire's
  control moves from `slice` to `concat`,
   since a control has to name a member the authority still
  excludes.
   `readonly-result-provenance-invalid.ts` moves to 13 messages with the first offer this work
  produced,
   `containerGrowthEffect`,
   which copies its parameter and writes only the copy.
   The
  catalog-free fixture stays at 16.

### Next

`84a29cfd1` landed the fact the observer path was missing:
 an observer that hands its element back puts receiver state into the result,
 which neither the mutation nor the opacity dimension sees,
 and propagation now records it as receiver opacity.
 Verdict-neutral,
 because the type-shape gate still refuses every observer-bearing member.

What that gate cannot simply be deleted for is `toSorted`.
 Measured reasoning rather than a guess:
 `map` and `flatMap` build their results out of observer returns,
 which `84a29cfd1` now accounts for;
 `filter` and `slice` build containers of receiver elements,
 which the container relation accounts for;
 `toSorted` builds a fresh array of receiver elements while its observer only compares,
 so neither mechanism names it,
 and `rows.toSorted(compare)[0].label = x` would discharge with the write attributed to nothing.

So the gate is replaced rather than removed,
 and the replacement needs one more authority fact:
 a result relation naming which members build their result from observer returns.
 With that in place the rule becomes:
 a state-carrying result must have a relation covering it,
 a container relation additionally requires the result not to escape,
 and anything else keeps failing closed.

The escape half is already threaded for the direct path through `receiverClaimAnswerable`;
 the observer path in `readonlyViewElementApplications` has no `body` parameter yet,
 so it cannot ask the escape question until one is passed from `recordCollectionMemberEffect`.
