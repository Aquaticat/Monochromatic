# @monochromatic-dev/translation-repair-page-check

Published-page checks and the page-assembly passes:
Canadian spelling and dates,
the text a reader would see at each slice ("would ship"),
page assembly guards,
destination checks,
archive casing and the publication of the settled tree.
It is its own package because `corpus-pass`,
`probe`,
`run` and `slice-cache` all assemble and check pages the same way,
and it sits above the lane packages.

## What it provides

`src/index.ts` re-exports each public name from the module that declares it.
The groups below name the main ones.

- Canadian forms and small corrections:
  put dates,
  spellings,
  quote style and pinyin tones into the house form on slices no lane rewrote.
  Names:
  `canadianizePage`,
  `canadianizeText`,
  `unifyQuoteStyle`,
  `unwrapBlockquoteQuotes`,
  `correctPinyinPage`.
  Declared in `corpus-run/canadian-forms.ts`,
  `corpus-run/quote-style-unify.ts`,
  `corpus-run/blockquote-quote-unify.ts`,
  and `corpus-run/pinyin-tone.ts`.
- Would-ship text:
  derive what a reader would see at one slice from the decisions of the stages above the lanes.
  Names:
  `wouldShipTextFor`,
  `wouldShipTextPerSlice`,
  `UnansweredContestSliceError`,
  `WouldShipReading`.
  Declared in `corpus-run/would-ship-text.ts`.
- Page assembly guards:
  run the composed page through the guards each lane runs,
  and refuse a page that does not parse or breaks its footnotes.
  Names:
  `guardPageAssembly`,
  `assertPageParses`,
  `UnparseablePageError`,
  `assertPageFootnotesIntact`,
  `assertFrontMatterComplete`.
  Declared in `corpus-run/page-assembly-guard.ts`,
  `corpus-run/page-grammar.ts`,
  `corpus-run/page-footnote-integrity.ts`,
  and `corpus-run/front-matter-completeness.ts`.
- Destinations:
  find link destinations a page dropped or rendered twice,
  and restore the archive's.
  Names:
  `assertDestinationsComplete`,
  `DroppedDestinationError`,
  `droppedDestinations`,
  `judgeDestinationRenderings`,
  `restoreArchiveDestinations`.
  Declared in `corpus-run/destination-completeness.ts`,
  `corpus-run/dropped-destinations.ts`,
  `corpus-run/destination-renderings.ts`,
  and `corpus-run/archive-destination-restore.ts`.
- Archive casing and restores:
  restore casing,
  italic titles,
  JSX attributes,
  list spread and name glosses the archive had.
  Names:
  `restoreArchiveCasing`,
  `restoreArchiveNameCasing`,
  `restoreArchiveItalicTitles`,
  `restoreJsxAttributes`,
  `restoreListSpread`,
  `restoreNameGlossLines`.
  Declared in `corpus-run/archive-casing-restore.ts`,
  `corpus-run/archive-name-casing.ts`,
  `corpus-run/archive-italic-title-restore.ts`,
  `corpus-run/jsx-attribute-restore.ts`,
  `corpus-run/list-spread-restore.ts`,
  and `corpus-run/name-gloss-restore.ts`.
- Publishing and verification:
  write the settled pages,
  list defects,
  and check a published page against its artifact.
  Names:
  `publishFixedPage`,
  `publishDefects`,
  `republishSettledPages`,
  `pageCarriesEveryWording`,
  `refusePageThatDisagrees`,
  `PublishedPageDisagreesError`,
  `whatThereIsToVerify`.
  Declared in `corpus-run/publish-fixed.ts`,
  `corpus-run/publish-defects.ts`,
  `corpus-run/page-republish.ts`,
  `corpus-run/published-page-check.ts`,
  `corpus-run/published-page-disagreement.ts`,
  and `corpus-run/published-tree-listing.ts`.

## Family dependencies

Short names are directory names under `package/translation-repair`;
a package is named `@monochromatic-dev/translation-repair-<short name>`.

### Depends on

Production dependencies (`dependencies` in `package.json`):

- `adjudication`
- `archive`
- `artifact`
- `artifact-pool`
- `assembly`
- `corpus-source`
- `document-structure`
- `glossary`
- `lane-contest`
- `markup`
- `page-pass`
- `provider`
- `reference`
- `rendering-audit`
- `shared-contract`
- `slice-reading`
- `stage`
- `translate-floor`
- `translate-lane`
- `translate-stage`
- `typography`

Development dependencies other than `test-fixture` (`devDependencies`,
used by tests):

- `consolidate`

### Used by

Packages that list it in `dependencies`:

- `corpus-pass`
- `probe`
- `run`
- `slice-cache`

## Tests

Tests sit beside the sources as `*.unit.test.ts` and import built output:
this package through its own build,
`../dist/final/node/index.mjs`,
and the siblings they need through their package names,
which resolve to each sibling's built entry.

Build before testing:
`mise run //package/translation-repair/page-check:build` builds this package,
and the library build keeps family siblings external,
so this package's built entry imports the siblings' built entries.
Its `build:js:node` task therefore declares `depends` on the `build:js:node` of every sibling
listed in `package.json`,
and the siblings build first.

Run the tests with `mise run //package/translation-repair/page-check:test:unit`,
or build and test together with `mise run //package/translation-repair/page-check:buildAndTest`.
Pass test file paths to run only those files.

Its `./ts/*` export also serves test fixtures that sibling tests import,
for example `corpus-run/published-run.test-fixture.ts`.

Test helpers used across the family,
such as scratch directories and capturing loggers,
come from `test-fixture`,
imported as `@monochromatic-dev/translation-repair-test-fixture/ts/<file>`.

## Family docs

- `../../module/translation-repair/README.md`:
  the overview of the pipeline,
  from before the split.
- `../../../doc/planning/translation-repair-package-split.md`:
  the split plan,
  with the package map and the rules the move keeps.
