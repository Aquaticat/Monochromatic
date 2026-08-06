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
  is pinned at 8 messages in `prefer-readonly-parameter-type.unit.test.ts`,
   with the offer list enumerated in
  full.

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

### Next

Increment 2,
 the largest remaining piece and the one every later step consumes:
 give `expressionOrigins` a
discriminated answer,
 proven-with-origins against unproven,
 and prune leaves that provably cannot carry
mutable identity.

Two measurements bound it.
 `row => ({ count: row.count })` currently reports the callback parameter as an
origin,
 because the object-literal branch queues `row.count` and `expressionRoot` strips the property access
back to `row`;
 that is the false positive the fresh-object `map` case turns on.
 And `NO_SLOT_ORIGIN` today
means both "proven to carry nothing" and "could not be resolved",
 so discharging on an empty set would
repeat the defect the effect-model split already caught once,
 where an empty match silently dropped a real
mutation.
 `rows.map(row => unknownClone(row))` is the case that must stay unproven.

After that,
 increment 4,
 the element-reachability facet,
 then 5 and 6,
 which are the first verdict changes.
