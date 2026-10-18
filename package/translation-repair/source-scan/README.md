# @monochromatic-dev/translation-repair-source-scan

The package-wide source scans of the translation-repair family:
unit tests that read the source,
docs and task files of the family and fail when a new class,
function,
export,
link,
command-line read,
wall-clock read or similar appears without the allowance its rule asks for.
It holds no production code and has no build.
It is its own package because the scans measure the family as one program,
so a function one package exports and another uses still counts as reached.

## What it provides

- The scans:
  each `*.unit.test.ts` file is one scan,
  for example `dead-code.unit.test.ts`,
  `unused-imports.unit.test.ts`,
  `duplicate-bodies.unit.test.ts`,
  `wall-clock-reads.unit.test.ts`,
  `message-names-only.unit.test.ts`,
  `position-references.unit.test.ts`,
  `living-doc-links.unit.test.ts` and `own-unit-tests.unit.test.ts`.
  The plan (section "Readers that find a file by path") has every scan read the `src` of every family
  package.
- Scan fixtures:
  files named `*.test-fixture.ts` that only scans import,
  because they import no production code.
  `source-scan.test-fixture.ts` parses TypeScript with the parser rolldown exposes and walks the
  syntax tree.
  `source-text-scan.test-fixture.ts` holds the text helpers `matchingClose`,
  `topLevelPieces` and `withoutBlockAndLineComments`.
  `prose-texts.test-fixture.ts` reads package and repository texts through `readPackageTexts` and
  `readRepositoryTexts`.
  `living-docs.test-fixture.ts` lists the living repository docs through `readLivingRepositoryDocs`.
  `tsdoc-example-scan.test-fixture.ts` checks `@example` blocks against their declarations through
  `exampleFindingsOf`.
  The `position-references*.test-fixture.ts` files hold the vocabulary,
  text,
  context and exemption lists of the position-reference scan.
- The `source-scans` task:
  runs the listed scans through `test:unit`,
  to be run beside the named tests of every commit that touches the package's source,
  docs,
  README or task file,
  because the clock-time,
  task-list-number,
  living-doc-link and position-reference scans read the docs too.
  Its description says it spends no quota.

## Family dependencies

Short names are directory names under `package/translation-repair`;
a package is named `@monochromatic-dev/translation-repair-<short name>`.

### Depends on

No family package is a production dependency,
because there is no production code.

Development dependencies other than `test-fixture` (`devDependencies`,
the siblings whose built entries the scans import):

- `coverage-census`
- `document-structure`
- `markup`
- `run`
- `typography`

### Used by

No family package lists it in `dependencies` or `devDependencies`.

## Tests

This package has no build and no `dist`:
its tests are the scans,
and `test:unit` runs them.
The scans import the built entries of the siblings named in Family dependencies,
through their package names,
which resolve to each sibling's `dist/final/node/index.mjs`.
Its `mise.toml` declares no `depends` for them,
so build the siblings first with `mise run //package/translation-repair/<sibling>:build`.

Run the scans with `mise run //package/translation-repair/source-scan:test:unit`,
or run the listed set with `mise run //package/translation-repair/source-scan:source-scans`.
The shared helper `scan-findings.test-fixture.ts` comes from `test-fixture`,
imported as `@monochromatic-dev/translation-repair-test-fixture/ts/scan-findings.test-fixture.ts`.

## Family docs

- `../../module/translation-repair/README.md`:
  the overview of the pipeline,
  from before the split.
- `../../../doc/planning/translation-repair-package-split.md`:
  the split plan,
  with the package map and the rules the move keeps.
