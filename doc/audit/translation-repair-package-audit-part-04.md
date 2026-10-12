# Translation-repair package audit, part 04

Part 04 of [Translation-repair package audit](translation-repair-package-audit.md),
whose index lists every part in order.

## Findings register, continued

### artifact-3 to artifact-6, MINOR, verified where cited

`artifact-two-lane-project.ts:68-70` stringifies a `never` member carrying text fields
(unreachable while the unions stay exhaustive);
the consolidation reader (`artifact-two-lane-read-consolidate.ts:368-375`) refuses only a duplicate index,
never a missing or extra slice,
unlike the contest and index-set readers;
`artifact-placement.ts:243-247,288-291` echo a malformed `id` or digest whole to stdout;
`resolveCommit`,
`tipContains` (shallow-clone and unknown-commit throws),
`keepEligible`,
`parseRegionTally`,
and the three placement stdout lines have no test.
The reviewer also answered `#238`'s question:
the owned artifact shape carries no per-stage heard or configured count and no `stage-quorum-unmet` marker;
those strings travel only inside the tolerant raw lane result.

FIXED 2026-08-26 in `12b2af6c1`.
artifact-3:
`refuseUnknownMember` names the member by its `kind` and sorted field names,
never by value;
a member
that is not a record is named by its `typeof`.
Guard:
`JSON.stringify` of the member appended fails `NAMES THE FIELDS of an unknown member and none of their values`;
restored,
passes.
artifact-4:
`parseConsolidation` takes the artifact's `laneSelection` and holds a settled stage to exactly the
contest's slices in its order (`assertConsolidationCoversContest`,
mirroring `assertContestCoversEligible`);
the
whole-artifact reader hoists the selection and passes it.
Measured first:
all 28 artifacts on this machine carrying
the field (schema versions 2,
3 and 4,
under `~/temp/agent`) name exactly their contest's slices in its order,
one of
them naming none,
so the refusal rejects nothing on disk.
Five cases:
the empty settled stage beside an empty contest,
a missing slice,
an extra slice,
out-of-order records,
and records beside a pending selection.
Guard:
the coverage call removed fails the four refusal cases;
restored,
passes.
artifact-5:
`shapeOf` names a recorded value by type and,
for a string,
length;
the three `POOL` lines print that in
place of the value.
Four cases capture the lines through a chained `console.log` wrapper (the suite's cases run
concurrently,
so a wrapper that restored the real reporter outright cut its siblings out mid-case) and pin both the
shape and the absence of the value.
Guard:
`JSON.stringify` restored on the id line and the unreadable-digest line fails `NAMES A MISMATCHED ID BY SHAPE
ALONE`,
`NAMES AN ABSENT ID` and `NAMES AN UNREADABLE DIGEST BY LENGTH ALONE`;
restored,
passes.
artifact-6:
`resolveCommit`,
`tipContains` and `isShallowRepository` take a `repository` seam defaulting to the
package's own worktree;
`artifact-generation-git.unit.test.ts` builds a three-commit history and a `--depth 2` clone
in `mkdtemp` directories (identity passed per call,
never the pinned corpus clone) and drives the abbreviation,
the
unknown name,
the ancestor,
the same commit,
the clean negative,
the shallow refusal and the unknown-commit refusal;
the exit codes were probed on the same fixture before the cases were written (negative 1,
unknown 128,
shallow flag
true).
`artifact-pool-keep-eligible.unit.test.ts` and `artifact-probe-tally.unit.test.ts` cover `keepEligible` (five
cases) and `parseRegionTally` (seven,
including the attribution-only projection and the tolerant `preExisting`).
`resolveCommit` and `keepEligible` are exported through the generation barrel as `@internal`.
Guards:
the shallow check disabled fails `REFUSES TO ANSWER THE SAME NEGATIVE IN A SHALLOW CLONE`;
`malformedIds`
dropped from the filter fails `CARRIES A MALFORMED ARTIFACT THROUGH` and `KEEPS AND DROPS IN ONE LISTING`;
the
count-versus-claims throw disabled fails `REFUSES A COUNT THAT DISAGREES WITH THE CLAIM LIST` and `HOLDS A DECLARED
preExisting COUNT TO THE CLAIMS TOO`.
The six mutations were applied together on one build;
each suite failed only
its own cases and the whole-artifact and eligibility suites stayed green as controls;
all restored,
all pass.
Whole-suite `buildAndTest` after `12b2af6c1`:
804 PASS,
0 FAIL,
exit 0.
The reviewer's `#238` answer (no per-stage heard or configured count in the owned shape) is acknowledged as recorded;
it asked for no change.

### rendering-1, MAJOR, verified: the provenance verdict is wrong on every roster-paired artifact

`rendering-audit-settled-input.ts:288` re-prepares with `prepareDocumentPair({ sourceText, targetText })`,
no `blockPairings` and no `sectionPairing`,
while production carves through `prepareDocumentPairWithRoster`;
the identity check hashes every slice's placement and refuses on any difference,
so every artifact whose roster pairing moved a slice reads `verification=refused`.
The audited text is taken from the artifact itself,
so every measurement column is right;
only the guard is void,
in the one case it exists for.
Tracked as `#255`.

FIXED 2026-08-26 in `d2c580995` (on the recorded section pairing from `26f346de8`):
`readArtifactSubjects`
re-prepares through `rebuildPreparation`,
so a roster-paired artifact rebuilds to its own identity and reads
`verified`;
the verdict gains `unverifiable`,
carrying the recipe halves the file lacks,
for a mismatch beside a
gap,
while a mismatch under a complete recipe stays `refused`;
the driver prints the missing halves beside the
objection.
Guards:
an artifact built over a crossed section pairing reads `verified` with the bare carve as positive control;
an old-style file over a different pair reads `unverifiable` naming both halves;
the moved-slicing case now carries a
complete recipe and still reads `refused`.
Removing the section half,
the block half,
or the gap rule fails 2 cases each.

### rendering-2, MAJOR by contract, verified: one stdout line prints an arbitrary caught message

Folded into `#237`:
`rendering-audit-settled.ts:292` prints `REFUSED: ${verification.detail}`,
which `rendering-audit-settled-input.ts:204` fills with `caughtValueText(error)` and no marker check;
bounded today to hashes and counts,
but the verifier's `translating()` wrapper launders inner messages
into the marked `ArtifactParseError`,
the `#244` shape.

FIXED 2026-08-26 in `c19d203c6`:
`verifySettled` records `refusalText` as the detail.
No guard of its own:
the path is one call,
and an unmarked inner throw cannot be injected through the public reader.

### rendering-3, MAJOR, verified: `--run` and `--against` written last are read as absent

`rendering-audit-settled-report.ts:190-197` returns `''` for both an absent flag and a valueless one,
so `--run` written last reports the newest run and `--against` written last prints no across-run band;
the sibling args module records the same collapse as a fixed defect for `--cap` and `--only`,
and the report module has no test.
Tracked as `#256`.

FIXED 2026-08-26 in `68062ccf7`:
the report reads both flags through `readReportArguments` in the args module,
which shares `valueAfter` and its refusal with `--cap` and `--only`;
a flag at the end of the line or followed by
another flag is a stated refusal naming the flag (`--run needs a value written after it`,
exit 6,
no frames,
verified
at the CLI boundary).
Guards in the args test:
nothing named gives two empty lists,
both named are read in any order,
`--run` at the end
refuses,
`--against` followed by `--run` refuses;
a lenient reader fails 3 cases.

### rendering-4 to rendering-12, MINOR, verified where cited

`asked=` counts answered rows (`settled-read.ts:420`),
so per-model voice loss is unreadable from the report;
relocation candidates are counted per claim pair,
not per slice pair (`settled-relocation.ts:161-183`);
`auditOne` builds a client per subject (`settled.ts:122`,
the calibrate-5 shape);
four operator refusals thrown as bare `Error`
(`settled.ts:428`,
`settled-input.ts:391-392`,
`settled-report.ts:96,161`);
the row and digest notes say a run file carries no text while `report` persists document spans
(`settled-row.ts:127-150`),
which the `#219` sanitization must treat as corpus-bearing;
a negative `--cap` audits the whole archive (`settled.ts:216`);
model-supplied category and verdict words are stored verbatim in `dropped` (`rendering-audit-screen.ts:288,393`);
`settled.ts` and `settled-report.ts` have no test;
invariant throws are bare `Error`.

FIXED 2026-08-26 in `744890056` (rendering-4,
5,
6,
7,
8,
9,
10, 12) and `50ffffc07` (rendering-11,
and the
regression `744890056` shipped).
rendering-4:
`rateByVoice({ rows, roster })` seats the run's recorded roster first,
so `asked` is the subject count
for every member and `answered` is what arrived;
`VoiceRate` gains `answered`,
the report reads `roster` off the run
file (empty for a run written before it was kept) and `printVoices` prints `asked= answered= lost=`.
Guard:
`asked` collapsed onto `answered` fails `COUNTS A LOST VOICE AGAINST THE ROSTER`;
restored,
passes.
rendering-5:
`distinctSlicePairs` counts (run set,
entry,
omission slice,
addition slice) tuples and the heading
reads `claim pairs=N slice pairs=M`;
the read suite carries the three-by-two case (six claim pairs,
one slice pair).
Guard:
the slice-pair count made to add the claim count fails `COUNTS the candidates in its heading` and `PRINTS
FEWER SLICE PAIRS THAN CLAIM PAIRS`;
restored,
passes.
rendering-6:
`main` builds one client per run,
only once something is bought,
and `auditOne` takes it.
Guard:
the roster emptied at the audit call fails `BUILDS ONE ROW` and `SHOWS THE ROSTER A DECLARED IDENTITY`,
since the scripted client records who was asked;
restored,
passes.
rendering-7:
the four refusals are `StatedRefusalError`.
Guards:
the mixed-layout site reverted fails `REFUSES A DIRECTORY CARRYING BOTH LAYOUTS` (the class is asserted);
the no-rows site reverted fails `REFUSES A FILE CARRYING NO ROWS ARRAY`,
and the built report then exits 5 on a
rowless run where it exits 6 restored;
the newest-run site reverted fails `REFUSES A PROBE THAT HAS NEVER RUN`;
the empty-archive site reverted fails `REFUSES AN EMPTY ARCHIVE` at the built command;
all restored,
pass.
rendering-8:
the row module says `report` carries document spans and model prose,
so a persisted run of this
probe is corpus-bearing and `textIdentity` is the one field built to carry none;
the digest module's note is
scoped to the identity field;
the handover's `#219` section names the run files.
Notes;
no guard.
rendering-9:
`readCap` refuses a cap below zero with the operator's word repeated;
`NO_CAP` stays internal.
Guard:
the refusal loosened fails `REFUSES a cap below zero`;
restored,
passes.
rendering-10:
`boundedWord` keeps the first token of a model-supplied category or verdict,
at most 32 characters,
in both drop reasons.
Guard:
the word repeated whole fails `BOUNDS THE WORD IT REPEATS`,
`BOUNDS A LONG SINGLE TOKEN` and `BOUNDS AN
UNKNOWN VERDICT`;
restored,
passes.
rendering-11:
`rendering-audit-settled.unit.test.ts` covers `capped`,
`eligibleSubjects`,
`printPopulation` and
`auditOne` (scripted client,
identity threading);
`rendering-audit-settled-report.unit.test.ts` covers
`readRunRows`,
`newestRun` and `printAcross` on throwaway runs and runs both built commands at the boundary;
the
corroborate case that looped over a possibly empty result now pins two groups of two,
measured first.
Both `main`s
are exercised only through the built commands.
Guards:
`capped` widened by one fails `BUYS NOTHING at zero` and `BUYS THE PREFIX`;
the roster never read fails
`READS the rows, the archive the run named and the roster it asked`;
the REFUSED line dropped fails `SAYS WHAT A
REFUSED VERIFICATION OBJECTED TO`;
the identity withheld fails `SHOWS THE ROSTER A DECLARED IDENTITY`;
all
restored,
pass.
rendering-12:
`RenderingAuditInvariantError` (`rendering-audit-invariant.ts`) at the six sites,
unmarked and
recorded in the inventory's withheld list.
Guard:
the class name dropped fails `NAMES ITSELF`;
restored,
passes.
THE REGRESSION `744890056` SHIPPED:
exporting the two CLI entry modules through the audit barrel made the bundler
fold each into a shared chunk,
and the built `rendering-audit-settled.mjs` and `rendering-audit-settled-report.mjs`
became re-exports whose `import.meta.main` read false,
so both commands printed nothing and exited 0 for that one
commit.
`50ffffc07` moves the testable halves to `rendering-audit-settled-buy.ts` and
`rendering-audit-settled-runs.ts`,
with the probe name shared from the row module,
and keeps the entries as entries.
Guard:
a marker export from each entry re-added to the barrel fails `REPORTS A NAMED RUN and exits 0` and `REFUSES A
FILE THAT IS NOT A RUN`,
with both built files carrying no `import.meta.main`;
restored,
passes.
Rule for the
package:
nothing an entry module declares may be exported through a barrel.
Method note:
a failing `describe` rejects and stops its suite,
so the guards were proved one describe per suite
file per round;
the first round's two mutations masked six others until they were re-run singly.

## Slice reports

Each entry records the reviewer's coverage claim,
then what the main session verified.

- `provider`:
  reviewer read 76 of 76 files (20733 lines),
  none unread;
  reported 1 BLOCKER,
  5 MAJOR,
  8 MINOR;
  all fourteen re-verified at the cited lines and recorded;
  it named the `#235` fallback,
  the missing
  catalog check,
  and the `RunConfigError` gap unprompted.
- `translate`:
  reviewer read 66 of 66 files (16700 lines),
  none unread;
  reported 2 MAJOR,
  4 MINOR,
  all six re-verified and recorded.
  Answered calibrate's question:
  `producer-calibrate.ts:120` also builds
  a client per slice.
- `repair`:
  reviewer read 65 of 65 files (17544 lines),
  none unread;
  reported 3 MAJOR,
  6 MINOR;
  eight re-verified as reported,
  one (repair-2) downgraded after the abort path was traced through
  `stage-round.ts`,
  `stage-call.ts`,
  and `stream-drain.ts`.
- `probes`:
  reviewer read 63 of 63 files (20031 lines),
  none unread;
  reported 1 BLOCKER,
  4 MAJOR,
  8 MINOR;
  the BLOCKER and every MAJOR re-verified at the cited lines;
  MINORs spot-verified.
- `calibrate`:
  reviewer read 33 of 33 files (10042 lines),
  none unread;
  reported 2 MAJOR and 9 MINOR,
  all eleven re-verified at the cited lines and recorded;
  the reviewer named the `#235` fallback and the `RunConfigError` gap unprompted
  and corrected the silence premise,
  which is the opposite of a skim.
  Its open questions,
  handed to other slices:
  whether `candidate-select.ts:347` `judgesAvailable` counts seated or reachable judges (`consolidate`),
  whether `producer-calibrate.ts` also builds a client per slice (`translate`),
  and whether any consumer prints the `reason` field `pass-schema-census.ts` stores from a `SyntaxError`.
- `consolidate`:
  reviewer read 28 of 28 files (7408 lines),
  none unread;
  reported 1 MAJOR,
  9 MINOR;
  the MAJOR re-verified;
  it answered calibrate's `judgesAvailable` question (seated roster).
- `document`:
  reviewer read 77 of 77 files (19246 lines),
  none unread;
  reported 3 MAJOR,
  9 MINOR;
  the three MAJORs re-verified at the cited lines,
  the population note in `markdown-blocks.ts` included;
  MINORs spot-verified.
  Its open questions go to the fix queue:
  whether `screenNonTranslationVotes` findings joined into `l.warn` can quote text (`#237`),
  whether `reindexSlicePair` restamps both sides of an insertion pair,
  whether `#232`'s reachability measure counted test-only reach for `group-source-first.ts` and `reflow-orphans.ts`,
  and whether the reading cache's generation marker is the pipeline digest (`#253`).
- `artifact`:
  reviewer read 47 of 47 files,
  none unread;
  reported 3 MAJOR and 4 MINOR
  (artifact-1 filed MAJOR by the reviewer's own call,
  BLOCKER by the brief's letter);
  all three MAJORs re-verified at the cited lines;
  it answered both extra questions:
  no per-stage quorum evidence in the owned artifact shape,
  and the round-three draw is legacy artifacts the two-lane parser refuses.
- `slices`:
  reviewer read 58 of 58 files,
  none unread;
  reported 3 MAJOR,
  6 MINOR;
  all three MAJORs re-verified at the cited lines;
  none needed a new task,
  they fold into `#238`,
  `#246`,
  `#249`.
  Its open questions:
  whether `PreparationIdentity` is a branded primitive
  (`lane-comparison.ts:403` compares with identity),
  whether a full-pass ledger reaches the open-file limit
  under one `Promise.all`,
  and whether an entry id may appear in a boundary refusal at all.
- `rendering`:
  reviewer read 32 of 32 files (19 source,
  13 tests),
  none unread;
  reported 3 MAJOR,
  9 MINOR;
  all three MAJORs re-verified at the cited lines.
  Its open questions:
  the population share of `verification=refused` (a kind-field count,
  `#255`),
  and whether the writer-side mismatch errors that `translating()` wraps can quote slice text (`#237`).

## What this audit does not cover

- Live behaviour against the providers.
  No model call is made by the audit;
  the `#235` fix will be verified live at the user boundary as its own step.
- The corpus itself,
  and the quality of shipped translations.
  Those are measured by the instruments in the `probes` and `rendering` slices,
  whose honesty is what the audit checks.
