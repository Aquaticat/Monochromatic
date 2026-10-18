# @monochromatic-dev/translation-repair-probe

Probes and their reports:
the rendering-audit probes,
the introduced-defect probe and its relabel and verification runs,
the recall benchmark,
damage sampling,
the judge-fidelity probe,
and the score reports that read graded sheets and artifacts.
It is its own package because the probes measure the pipeline from outside it,
and only `bench` and `coverage-census` depend on it.

## What it provides

`src/index.ts` re-exports each public name from the module that declares it.
The groups below name the main ones.

- Introduced-defect probe runs:
  probe the sensitivity of the defect probe,
  re-probe regions a human read as damaged,
  and verify flagged edits.
  Names:
  `runSensitivity`,
  `runProbeRelabel`,
  `runProbeVerify`,
  `singleRegionTally`,
  `reportProbeTelemetry`,
  `persistProbeRun`.
  Declared in `corpus-run/probe-sensitivity-run.ts`,
  `corpus-run/probe-relabel-run.ts`,
  `corpus-run/probe-verify-run.ts`,
  `corpus-run/probe-single-tally.ts`,
  `corpus-run/probe-telemetry-report.ts`,
  and `corpus-run/probe-store.ts`.
- Rendering-audit probes:
  run the rendering audit over settled artifacts and over planted defects.
  Names:
  `runAuditSensitivity`,
  `runSettledAudit`,
  `runSettledReport`,
  `auditRepeatsAcross`,
  `auditRelocationPairs`.
  Declared in `corpus-run/audit-sensitivity-run.ts`,
  `corpus-run/rendering-audit-settled-drive.ts`,
  `corpus-run/rendering-audit-settled-report-run.ts`,
  `corpus-run/rendering-audit-settled-repeat.ts`,
  and `corpus-run/rendering-audit-settled-relocation.ts`.
- Recall benchmark:
  plant known omissions into clean translations and grade whether the repair loop restores them.
  Names:
  `runRecallBenchmark`,
  `chooseRecallEntries`,
  `seedRecallEntry`,
  `persistRecallScorecard`,
  `recallScorecardLines`.
  Declared in `corpus-run/recall-benchmark-run.ts`,
  `corpus-run/recall-benchmark-choose.ts`,
  `corpus-run/recall-benchmark-entry.ts`,
  `corpus-run/recall-scorecard-store.ts`,
  and `corpus-run/recall-benchmark-report.ts`.
- Damage sampling and grading draws:
  draw shipped regions or a stratified sample for human grading.
  Names:
  `sampleDamage`,
  `collectTwoLaneShippedRegions`,
  `drawRegions`,
  `drawGradingSample`,
  `collectShippedRegions`.
  Declared in `corpus-run/damage-sample-run.ts`,
  `corpus-run/damage-region-v2.ts`,
  `corpus-run/damage-sample-draw.ts`,
  `corpus-run/draw-sample-run.ts`,
  and `corpus-run/damage-sample-pool.ts`.
- Score reports:
  print precision,
  agreement,
  attribution,
  crosscheck and verification reports from graded sheets and artifacts.
  Names:
  `printGradeReport`,
  `printAttribution`,
  `printCrosscheck`,
  `printProbeScore`,
  `printVerifyScore`,
  `buildAttributionReport`,
  `buildCrosscheckCensus`.
  Declared in `corpus-run/score-agreement-run.ts`,
  `corpus-run/score-attribution-run.ts`,
  `corpus-run/score-crosscheck-run.ts`,
  `corpus-run/score-probe-run.ts`,
  `corpus-run/score-verify-run.ts`,
  `corpus-run/attribution-report.ts`,
  and `corpus-run/judge-crosscheck.ts`.
- Judge-fidelity probe:
  judge fixed source-reviewed references against hash-verified damage.
  Names:
  `runFidelityProbe`,
  `fidelityPlan`,
  `boundFidelityMatrix`,
  `REVIEWED_FIDELITY_REFERENCES`,
  `readReviewedFidelityReferences`,
  `buildReviewedFidelityReference`,
  `seatJudges`.
  Declared in `corpus-run/judge-fidelity-probe-run.ts`,
  `corpus-run/judge-fidelity-probe-plan.ts`,
  `fidelity-reference-manifest.ts`,
  `fidelity-reference-read.ts`,
  `fidelity-reference-build.ts`,
  and `corpus-run/judge-independence.ts`.

## Runners

`src/build-entries.ts` lists the library index and each runner as a build entry,
and each runner is built to `dist/final/node/<runner>.mjs`.
Every runner has a task of the same name in `mise.toml` that builds first.
Start one with `mise run //package/translation-repair/probe:<task>`,
passing arguments after `--`.
A built command refuses to run in a process that holds provider keys unless
`TRANSLATION_REPAIR_STARTED_BY` names that command,
and each task sets it to its own name.

- `draw-sample`:
  draws the stratified precision sample from settled artifacts into a grading sheet outside the
  repository.
  Append `-- --final` for the gate sheet.
- `score-attribution`:
  reports per-critic calibration from a run's settled artifacts:
  what each critic was asked,
  what it raised,
  and how often an accepted issue rested on it alone.
- `score-agreement`:
  reports precision off a graded sheet,
  plus agreement against blind pre-grades when they exist.
  Override with `-- --sheet PATH --manifest PATH --pre-grades PATH`.
- `score-crosscheck`:
  reports the population a judge crosscheck would run over,
  per author and per arm.
- `score-probe`:
  reports what the shadow-mode introduced-defect probe found across a run's settled artifacts,
  over distinct shipped regions.
  Pass `--repair-sheet PATH --manifest PATH` after `--` to score it against the human grades;
  both or neither.
- `recall-benchmark`:
  measures recall:
  plants known omissions into clean translations,
  runs the repair loop,
  and grades restoration against the deletions.
  Append `-- --plan` for a zero-quota setup check.
- `probe-sensitivity`:
  asks whether the introduced-defect probe can detect damage at all,
  each region under three prior-issue lists;
  cat-themed fixtures only.
  Spends quota.
- `audit-sensitivity`:
  asks whether the rendering audit can detect a planted defect at all,
  and whether it invents one:
  one flipped rendering and one faithful;
  cat-themed fixtures only.
  Spends quota.
- `rendering-audit-settled`:
  runs the rendering audit over every decided slice of every settled version 2 artifact in an archive,
  reading retained and replaced slices apart.
  Telemetry only:
  nothing it says gates what ships.
  Pass `--archive dir`,
  `--clone dir`,
  `--only ids` and `--cap n` after `--`.
  Spends quota unless `--cap 0`.
- `rendering-audit-settled-report`:
  reads a persisted settled-audit run:
  the archive and fresh halves apart,
  what each auditor thought worth a claim,
  and the relocation candidates.
  Pass `--run path` after `--` to read a run other than the newest,
  and `--against path` to print the across-run band against an earlier run.
  Spends no quota.
- `judge-fidelity-probe`:
  judges fixed source-reviewed references against hash-verified damage.
  Options after `--` are `--only` with reviewed entry ids,
  `--cap n`,
  `--damage deletion|insertion|alteration`,
  `--candidates` with seatable ids,
  `--candidates-alone` and `--context`;
  `--cap 0` is a metadata-only preflight.
  Spends quota.
- `damage-sample`:
  draws shipped regions at random and asks a human the same source-anchored damage question the probe
  asks,
  with the probe's verdict kept in the manifest.
- `probe-verify`:
  probes damaged and unread regions with the accepted issues withheld,
  and writes one blind sheet asking whether each flagged edit really damaged the text.
- `score-verify`:
  joins the graded blind verification sheet to its manifest and reports what the unlabelled probe's
  flags are worth on regions nobody had read.
- `probe-relabel`:
  re-probes the regions a human read as damaged under three arms (the production disclosure,
  the other prompt,
  no list at all),
  to separate a suppressing prompt from a dismissing screen from a hard judgement.
  Spends quota.

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
- `corpus-pass`
- `corpus-source`
- `document-structure`
- `glossary`
- `house-rule`
- `insertion`
- `lane-contest`
- `markup`
- `page-check`
- `provider`
- `provider-stream`
- `reference`
- `rendering-audit`
- `repair`
- `run`
- `shared-contract`
- `slice-reading`
- `stage`
- `typography`

Development dependencies other than `test-fixture` (`devDependencies`,
used by tests):

- `translate-floor`
- `translate-lane`

### Used by

Packages that list it in `dependencies`:

- `bench`
- `coverage-census`

## Tests

Tests sit beside the sources as `*.unit.test.ts` and import built output:
this package through its own build,
`../dist/final/node/index.mjs`,
and the siblings they need through their package names,
which resolve to each sibling's built entry.

Build before testing:
`mise run //package/translation-repair/probe:build` builds this package,
and the library build keeps family siblings external,
so this package's built entry imports the siblings' built entries.
Its `build:js:node` task therefore declares `depends` on the `build:js:node` of every sibling
listed in `package.json`,
and the siblings build first.

Run the tests with `mise run //package/translation-repair/probe:test:unit`,
or build and test together with `mise run //package/translation-repair/probe:buildAndTest`.
Pass test file paths to run only those files.

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
