# @monochromatic-dev/translation-repair-consistency

The page-level consistency pass:
when the same wording appears at several places on a page,
a bench is asked which rendering the page should follow,
the votes are counted deterministically,
ties are run off,
and the chosen words are carried to the other places by code or by a choice among texts.
It is its own package because the pass is a unit of its own,
with its sheets,
counts and mark rules,
and only `artifact` and `corpus-pass` use it.

## What it provides

`src/index.ts` re-exports each public name from the module that declares it.
The groups below name the main ones.

- Ballot sheets and wire:
  the sheet a judge reads,
  the response format it must answer in,
  and the checks that make a ballot usable.
  Names:
  `buildConsistencyMessages`,
  `consistencyResponseFormat`,
  `isConsistencyBallotWire`,
  `usableConsistencyBallotFor`,
  `canonicalBallotOf`,
  `consistencyLabels`.
  Declared in `consistency-sheet.ts` and `consistency-wire.ts`.
- Counting ballots:
  count the ballots of a repeated wording deterministically,
  from usable ballots only,
  and name the winner.
  Names:
  `countConsistency`,
  `winnerOf`,
  `foldedWordsOf`,
  `locateWords`,
  `majorityChoiceOf`,
  `occurrencesOf`.
  Declared in `consistency-count.ts`,
  `consistency-fold.ts`,
  `consistency-majority.ts`,
  and `consistency-occurrences.ts`.
- Choice among renderings:
  the second question put to the bench,
  which rendering the page should follow,
  and its tally.
  Names:
  `canonicalChoiceOf`,
  `choiceTallyOf`,
  `consistencyChoiceResponseFormat`,
  `usableChoicesOf`,
  `tiedChoicesOf`.
  Declared in `consistency-choice.ts`.
- Run-off:
  ask the bench once more when the choices tie for first.
  Names:
  `buildConsistencyRunOffMessages`,
  `runOffWinnerOf`.
  Declared in `consistency-run-off.ts`.
- Carrying to a receiving place:
  offer the current text,
  the spliced text and each writer's rewrite of a paragraph,
  and read the bench's choice.
  Names:
  `buildCarryChoiceMessages`,
  `buildCarryWriterMessages`,
  `carryChoiceOf`,
  `carryOffersOf`,
  `carryRunOffFinalistsOf`,
  `blockStandingOf`.
  Declared in `consistency-carry-choice-sheet.ts`,
  `consistency-carry-writer-sheet.ts`,
  `consistency-carry.ts`,
  and `consistency-carry-standing.ts`.
- Splicing by code:
  move the chosen words over another place's words by code,
  without a model writing new text.
  Names:
  `planConsistencyEdit`,
  `applyConsistencyEdits`,
  `ConsistencyPlan`,
  `ConsistencyEdit`,
  `cutsWord`,
  `wholeSpanOf`.
  Declared in `consistency-splice.ts`,
  `consistency-word-joints.ts`,
  and `consistency-whole-end.ts`.
- Page layout and marks:
  the page as slices,
  its prose view,
  and the proofs that apostrophes and quote marks are what the page shows.
  Names:
  `pageOfSlices`,
  `pageReadingOf`,
  `proseViewOf`,
  `markReadingsOf`,
  `provenApostrophesOf`,
  `CONSISTENCY_CACHE_VERSION`,
  `ConsistencyInvariantError`.
  Declared in `consistency-page-english.ts`,
  `consistency-prose-text.ts`,
  `consistency-proven-apostrophes.ts`,
  `consistency-cache-version.ts`,
  and `consistency-invariant-error.ts`.

## Family dependencies

Short names are directory names under `package/translation-repair`;
a package is named `@monochromatic-dev/translation-repair-<short name>`.

### Depends on

Production dependencies (`dependencies` in `package.json`):

- `adjudication`
- `assembly`
- `document-structure`
- `house-rule`
- `markup`
- `page-pass`
- `provider`
- `shared-contract`
- `slice-reading`
- `stage`
- `translate-floor`
- `translate-stage`
- `typography`

Development dependencies other than `test-fixture` (`devDependencies`,
used by tests):

- `provider-stream`

### Used by

Packages that list it in `dependencies`:

- `artifact`
- `corpus-pass`

## Tests

Tests sit beside the sources as `*.unit.test.ts` and import built output:
this package through its own build,
`../dist/final/node/index.mjs`,
and the siblings they need through their package names,
which resolve to each sibling's built entry.

Build before testing:
`mise run //package/translation-repair/consistency:build` builds this package,
and the library build keeps family siblings external,
so this package's built entry imports the siblings' built entries.
Its `build:js:node` task therefore declares `depends` on the `build:js:node` of every sibling listed in
`package.json`,
and the siblings build first.

Run the tests with `mise run //package/translation-repair/consistency:test:unit`,
or build and test together with `mise run //package/translation-repair/consistency:buildAndTest`.
Pass test file paths to run only those files.

Its `./ts/*` export also serves test fixtures that sibling tests import,
for example `consistency-renderings.test-fixture.ts`.

Test helpers used across the family,
such as scratch directories and capturing loggers,
come from `test-fixture`,
imported as `@monochromatic-dev/translation-repair-test-fixture/ts/<file>`.

## Family docs

- [Pipeline overview](../../module/translation-repair/README.md):
  the overview of the pipeline,
  from before the split.
- [Package split plan](../../../doc/planning/translation-repair-package-split.md):
  the split plan,
  with the package map and the rules the move keeps.
