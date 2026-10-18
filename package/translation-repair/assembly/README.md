# @monochromatic-dev/translation-repair-assembly

Assembly integrity and repetition checks,
and the repair records assembly reads:
it guards the footnotes and structure of an assembled repair,
finds repetition and lost content a repair introduced,
and holds the repair contract,
record and round shapes.
It is its own package because the repair,
consistency,
lane-contest and page layers all assemble through the same guards,
and it sits above the text and `adjudication` packages.

## What it provides

`src/index.ts` re-exports each public name from the module that declares it.
The groups below name the main ones.

- Assembly integrity:
  check that replacements change something,
  order the change sets,
  and guard footnote assembly.
  Names:
  `guardFootnoteAssembly`,
  `assertReplacementsChange`,
  `checkedChangeSets`,
  `orderedChangeSets`,
  `AssemblyContractError`,
  `withholdLoneContainerHalves`,
  `trimOrphanDefinitions`.
  Declared in `assembly-integrity.ts`,
  `assembly-invariant.ts`,
  `assembly-container-halves.ts`,
  and `assembly-orphan-trim.ts`.
- Repetition checks:
  find phrases and spans a repair repeated,
  including across neighbouring slices.
  Names:
  `findIntroducedRepetitions`,
  `repetitionFindings`,
  `adjacentRepetitionFindings`,
  `countPhrases`,
  `grownSpans`.
  Declared in `assembly-repetition.ts`,
  `assembly-adjacent-repetition.ts`,
  and `assembly-repetition-span.ts`.
- Content survival and structure:
  measure how much distinctive content survives an edit and report structural regressions.
  Names:
  `measureContentSurvival`,
  `contentSurvivalFindings`,
  `introducedStructuralRegressions`,
  `introducedFootnoteFindings`,
  `singleStructuralWithdrawal`.
  Declared in `assembly-content-survival.ts`,
  `assembly-regressions.ts`,
  and `assembly-structural-withdrawal.ts`.
- Repair records:
  assemble a repair,
  record each issue's disposition,
  and describe each round.
  Names:
  `assembleRepair`,
  `buildIssueRecords`,
  `REPAIR_DISPOSITIONS`,
  `repairReplacements`,
  `describeAdoptedRound`,
  `RepairTranslationResult`.
  Declared in `repair-assemble.ts`,
  `repair-record.ts`,
  `repair-replacements.ts`,
  `repair-round-record.ts`,
  and `repair-result.ts`.
- Repair contract:
  check that checker and producer rosters can judge a repair,
  and the shapes of its models and seating.
  Names:
  `assertCheckerIndependence`,
  `assertCheckerQuorumReachable`,
  `assertJudgeableEditorRoster`,
  `CheckerIndependenceError`,
  `ProducerRosterError`,
  `RepairModels`.
  Declared in `repair-contract.ts`.
- Unheard voices:
  refuse to keep an archive text that no voice spoke about.
  Names:
  `assertUnheardKeptArchive`,
  `heardNobodyAbout`,
  `RepairUnheardError`.
  Declared in `repair-unheard.ts`.

## Family dependencies

Short names are directory names under `package/translation-repair`;
a package is named `@monochromatic-dev/translation-repair-<short name>`.

### Depends on

Production dependencies (`dependencies` in `package.json`):

- `adjudication`
- `document-structure`
- `house-rule`
- `markup`
- `page-pass`
- `shared-contract`
- `slice-reading`
- `translate-floor`
- `typography`

### Used by

Packages that list it in `dependencies`:

- `archive`
- `artifact`
- `artifact-pool`
- `bench`
- `consistency`
- `consolidate`
- `corpus-pass`
- `lane-contest`
- `page-check`
- `probe`
- `repair`
- `run`
- `slice-cache`
- `translate-lane`
- `translate-stage`

## Tests

Tests sit beside the sources as `*.unit.test.ts` and import built output:
this package through its own build,
`../dist/final/node/index.mjs`,
and the siblings they need through their package names,
which resolve to each sibling's built entry.

Build before testing:
`mise run //package/translation-repair/assembly:build` builds this package,
and the library build keeps family siblings external,
so this package's built entry imports the siblings' built entries.
Its `build:js:node` task therefore declares `depends` on the `build:js:node` of every sibling listed in
`package.json`,
and the siblings build first.

Run the tests with `mise run //package/translation-repair/assembly:test:unit`,
or build and test together with `mise run //package/translation-repair/assembly:buildAndTest`.
Pass test file paths to run only those files.

Its `./ts/*` export also serves test fixtures that sibling tests import,
for example `sunbathing-recheck.test-fixture.ts` and `issue-author-fixtures.test-fixture.ts`.

Test helpers used across the family,
such as scratch directories and capturing loggers,
come from `test-fixture`,
imported as `@monochromatic-dev/translation-repair-test-fixture/ts/<file>`.

## Family docs

- [Family README](../README.md):
  the design,
  the package list and where the shared docs live.
- [Package split plan](../../../doc/planning/translation-repair-package-split.md):
  the split plan,
  with the package map and the rules the move keeps.
