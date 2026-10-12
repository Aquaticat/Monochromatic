# Translation repair: trial handover to MiMo, 2026-10-03, part 04

Part 04 of [Translation repair: trial handover to MiMo, 2026-10-03](translation-repair-mimo-trial-2026-10-03.md),
whose index lists every part in order.

## Trial log, continued

- 2026-10-04,
  18:08 UTC:
  the next batch's baseline census taken at commit `aba6f1b61`:
  `census written to ~/.cache/translation-repair/coverage/census-c2UUBT/census.json`
  (`~/temp/agent/mimo-trial/census-48.log`).
  `library source: 116 files, 194 stretches over 419 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/handle` with 4 over 12 in 2,
  `corpus-run/slice` with 4 over 10 in 2.
  This line lands in the trial-log commit that follows `aba6f1b61`.
  Next:
  the `corpus-run/handle` batch.

- 2026-10-04,
  18:14 UTC:
  the T8 `corpus-run/handle` batch closed with commits `216e4986d`,
  `2db4930ee`:
  4 line stretches over `handle-gloss-place.ts`
  and `handle-reading.ts`,
  one closed as unreachable
  (the slice-text fallback narrowed),
  three cased
  (the unclosed and multiline parenthesis,
  the embedded handle,
  and the name-shaped rendering).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-handle2.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-handle-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-handle-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `2db4930ee`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/slice` cluster
  (the ranking's next at `census-c2UUBT`).

- 2026-10-04,
  17:48 UTC:
  the next batch's baseline census taken at commit `3a433ae2e`:
  `census written to ~/.cache/translation-repair/coverage/census-IjEvWX/census.json`
  (`~/temp/agent/mimo-trial/census-47.log`).
  `library source: 117 files, 198 stretches over 432 lines, 4 functions never called`
  (the count crossed below 200).
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/roster` with 4 over 13 in 1,
  `corpus-run/handle` with 4 over 12 in 2.
  This line lands in the trial-log commit that follows `3a433ae2e`.
  Next:
  the `corpus-run/roster` batch.

- 2026-10-04,
  18:00 UTC:
  the T8 `corpus-run/roster` batch closed with commit `e1ee49e95`:
  4 line stretches over `roster-card-render.ts`,
  all cased
  (the body as the row array,
  the non-array modalities,
  the vision flag both ways,
  and the bedrock listing).
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-roster.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-roster-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-roster-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e1ee49e95`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/handle` cluster
  (the ranking's next at `census-IjEvWX`).

- 2026-10-04,
  16:31 UTC:
  the T8 `corpus-run/editor` batch is in progress:
  part 1 landed with commit `26b7b7909`
  (the standing reader names a missing run directory
  rather than reading an empty standing).
  Uncommitted work:
  none.
  The reach census reads `ran 1, still cold 12`
  on `editor-standing-read.ts`
  (`~/temp/agent/mimo-trial/reach-editor2.log`),
  the twelve being the artifact error paths
  and the reporter bodies still to case.
  Reasoning so far:
  the reader runs as a CLI over fixture run directories
  (`standingOver` spawns the built entry),
  so the error paths need artifact files carrying
  an off-roster model or no recorded rounds.
  Next:
  part 2,
  those two error paths.

- 2026-10-04,
  16:45 UTC:
  the `corpus-run/editor` batch part 2 preparation:
  the artifact schema walked field by field
  (`~/temp/agent/mimo-trial/artifact-schema-walk.mjs`
  iterates the CLI's refusals until parse),
  leaving the fixture spec:
  top keys `artifactSchemaVersion`,
  `id`,
  `tip`,
  `pipelineDigest`,
  `corpusSha`,
  `callConfig`,
  `durationMs`,
  `timestamp`,
  `preparation`,
  `lanes`,
  `comparison`,
  `laneSelection`,
  `consolidation`,
  `pageAssembly`;
  `preparation` carries `alignmentPairCount`,
  `identity`
  (`sha256-preparation-v2:`
  plus 64 hex),
  `sliceCount`,
  `sourceChars`,
  `targetChars`,
  `sourceBytes`,
  `alignmentFindings`;
  each lane is `{ result, delivery }`
  with `result.status` one of `repaired`,
  `unchanged`,
  `blocked-non-translation`
  and `delivery` one row per prepared slice
  (`chunkIndex`,
  `sourceText`,
  `incumbentKind`,
  `incumbentText`,
  `outcome`,
  `shippedText`,
  `delivery`).
  Uncommitted work:
  none.
  Next:
  write the off-roster and earlier-schema artifacts
  from that spec
  and case the two error paths.

- 2026-10-04,
  17:41 UTC:
  the T8 `corpus-run/editor` batch closed with commits `26b7b7909`,
  `df9436878`,
  `41726bb37`,
  `637c54309`,
  `5b0bf4d57`:
  the standing reader's 13 line stretches all cased
  (the missing run directory,
  the earlier-schema artifact,
  the off-roster artifact,
  the seated one read and reported,
  and the runs variable),
  plus the contest's none seat
  and the width report's neither-shipped row.
  The reach census reads `ran 13, still cold 0, cold since then 0`
  for the standing reader
  (`~/temp/agent/mimo-trial/reach-editor4.log`).
  Left documented:
  the width input's envelope and ready returns
  (`editor-width-input.ts:221-254`),
  whose claims pass the screen's own claim schema first.
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-editor-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-editor-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5b0bf4d57`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/roster` cluster
  (the ranking's next at `census-fUfTA1`).

- 2026-10-04,
  16:26 UTC:
  the next batch's baseline census taken at commit `19f402d54`:
  `census written to ~/.cache/translation-repair/coverage/census-fUfTA1/census.json`
  (`~/temp/agent/mimo-trial/census-46.log`).
  `library source: 119 files, 201 stretches over 436 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/editor` with 4 over 38 in 3,
  `corpus-run/roster` with 4 over 13 in 1.
  This line lands in the trial-log commit that follows `19f402d54`.
  Next:
  the `corpus-run/editor` batch.

- 2026-10-04,
  16:20 UTC:
  the T8 `corpus-run/spend` batch closed with commit `07d5f9647`:
  5 line stretches over `spend-read.ts`,
  all cased
  (the not-a-record and unreadable refusals
  read off logged SPEND lines).
  The reach census reads `ran 3, still cold 2`
  on `238`
  and `345`,
  but a direct probe shows each arm's own value returning
  (`~/temp/agent/mimo-trial/spend-arm-probe.log`),
  so those two are the census's line attribution
  rather than unrun code.
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-spend-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-spend-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `07d5f9647`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/editor` cluster
  (the ranking's next at `census-1iMkkv`).

- 2026-10-04,
  16:10 UTC:
  the T8 `edit` batch closed with commit `527789637`:
  5 line stretches over `edit-prompt.ts`
  and `edit-wire.ts`,
  one closed as unreachable
  (the last-name fallback narrowed),
  three cased
  (the neighbouring block with either half alone,
  and the two wire refusals),
  one left documented
  (the single-name join:
  its names shrink below two only for an issue
  touching one identifier kind,
  whose fixtures are the deeper suite's).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-edit-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-edit-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `527789637`.
  Next:
  the whole-suite census at this commit as the next batch's baseline:
  `census written to ~/.cache/translation-repair/coverage/census-1iMkkv/census.json`
  (`~/temp/agent/mimo-trial/census-45.log`),
  `library source: 119 files, 204 stretches over 439 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/spend` with 5 over 5 in 1,
  `corpus-run/editor` with 4 over 38 in 3.
  Next:
  the `corpus-run/spend` batch.

- 2026-10-04,
  16:02 UTC:
  the next batch's baseline census taken at commit `222e844fc`:
  `census written to ~/.cache/translation-repair/coverage/census-i9Duoq/census.json`
  (`~/temp/agent/mimo-trial/census-44.log`).
  `library source: 120 files, 208 stretches over 443 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its five are the batch's documented-left arms,
  so the pass moves past it),
  `edit` with 5 over 6 in 2,
  `corpus-run/spend` with 5 over 5 in 1.
  This line lands in the trial-log commit that follows `222e844fc`.
  Next:
  the `edit` batch.

- 2026-10-04,
  15:55 UTC:
  the T8 `corpus-run/published` batch closed with commits `13a1780c9`,
  `2b3d73ec6`,
  `39b9c1be1`:
  5 line stretches over `published-page-disagreement.ts`
  and `published-page-check.ts`,
  the disagreement path and the weigh and wording checks driven
  over a slice-count mismatch and an anchor slice,
  four left documented
  (the three incumbent-map fallbacks
  and the unweighable return:
  the map is built from the artifact's own comparison rows,
  so a key miss needs a divergence the fixture builders
  do not expose).
  The reach census reads `still cold 4`:
  those four
  (`~/temp/agent/mimo-trial/reach-published3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-published-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-published-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `39b9c1be1`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `edit` cluster
  (the ranking's next at `census-HQOwnq`).

- 2026-10-04,
  15:41 UTC:
  the next batch's baseline census taken at commit `5bd1c9712`:
  `census written to ~/.cache/translation-repair/coverage/census-HQOwnq/census.json`
  (`~/temp/agent/mimo-trial/census-43.log`).
  `library source: 120 files, 208 stretches over 443 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files,
  `edit` with 5 over 6 in 2,
  `corpus-run/spend` with 5 over 5 in 1.
  This line lands in the trial-log commit that follows `5bd1c9712`.
  Next:
  the `corpus-run/published` batch.

- 2026-10-04,
  15:34 UTC:
  the T8 `corpus-run/cap` batch closed with commits `a5a9c4ab3`,
  `9b1240f9a`,
  `3af9376a5`:
  5 line stretches over the cap census and override files,
  three closed as unreachable
  (the stamp split,
  the paired content,
  and the P99 zero:
  all `nonNullishOrThrow`),
  two cased
  (the malformed stamp and unit word,
  and the environment read).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-cap3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cap-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cap-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3af9376a5`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/published` cluster
  (the ranking's next at `census-4VTupe`).

- 2026-10-04,
  15:02 UTC:
  the T8 `han` batch closed with commit `3948763a2`:
  5 line stretches over `han-only-text.ts`
  and `han-title-read.ts`,
  all cased
  (the empty character,
  the letter walk both ways,
  the linked and linkless title reads,
  and the skipped titles).
  The reach census reads `still cold 0` on the five
  (`~/temp/agent/mimo-trial/reach-han3.log`),
  with one pre-existing line cold since then in the focused run
  and none in the whole-suite census.
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-han-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-han-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3948763a2`.
  Next:
  the whole-suite census at this commit as the next batch's baseline:
  `census written to ~/.cache/translation-repair/coverage/census-4VTupe/census.json`
  (`~/temp/agent/mimo-trial/census-40.log`),
  `library source: 123 files, 213 stretches over 449 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/cap` leads with 5 stretches over 6 lines in 3 files,
  `corpus-run/published` with 5 over 6 in 2,
  `edit` with 5 over 6 in 2.
  Next:
  the `corpus-run/cap` batch.

- 2026-10-04,
  14:52 UTC:
  the next batch's baseline census taken at commit `91df90bfe`:
  `census written to ~/.cache/translation-repair/coverage/census-AwkhvA/census.json`
  (`~/temp/agent/mimo-trial/census-39.log`).
  `library source: 125 files, 218 stretches over 456 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `han` leads with 5 stretches over 7 lines in 2 files,
  `corpus-run/cap` with 5 over 6 in 3,
  `corpus-run/published` with 5 over 6 in 2.
  This line lands in the trial-log commit that follows `91df90bfe`.
  Next:
  the `han` batch.

- 2026-10-04,
  14:44 UTC:
  the T8 `restoration` batch closed with commit `e16e16184`:
  5 line stretches over `restoration-judge-wire.ts`
  and `restoration-judge.ts`,
  all cased
  (the wire guards,
  the duplicate judgment,
  and the ballot naming one seed only).
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-restoration.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-restoration-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-restoration-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e16e16184`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `han` cluster
  (the ranking's next at `census-RD9far`).

- 2026-10-04,
  14:42 UTC:
  the next batch's baseline census taken at commit `8c66817c7`:
  `census written to ~/.cache/translation-repair/coverage/census-RD9far/census.json`
  (`~/temp/agent/mimo-trial/census-38.log`).
  `library source: 127 files, 223 stretches over 464 lines, 4 functions never called`
  (the never-called count moved again,
  5 to 4).
  Largest clusters by stretches then lines:
  `restoration` leads with 5 stretches over 8 lines in 2 files,
  `han` with 5 over 7 in 2,
  `corpus-run/cap` with 5 over 6 in 3.
  This line lands in the trial-log commit that follows `8c66817c7`.
  Next:
  the `restoration` batch.

- 2026-10-04,
  14:34 UTC:
  the T8 `grade` batch closed with commits `894ef4d0c`,
  `dd52f9ced`,
  `df2c9a7f4`:
  5 line stretches over `grade-agreement.ts`
  and `grade-sheet-read.ts`,
  one closed as unreachable
  (the no-marker arm:
  the item filter settles it),
  four cased
  (the unbounded answer,
  the duplicate word,
  the non-string verdict refusal,
  and the duplicate indices).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-grade3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-grade-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-grade-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `df2c9a7f4`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `restoration` cluster
  (the ranking's next at `census-G4ZkGi`).

- 2026-10-04,
  14:19 UTC:
  the T8 `corpus-run/bench` batch closed with commit `2810a9104`:
  5 line stretches over `bench-report.ts`,
  two closed as unreachable
  (the middle-width fallback narrowed,
  the empty-rows note removed),
  two cased
  (the middle width repeat,
  the token sums).
  The reach census reads `left 1 cold stretch` in the focused run
  and none in the whole-suite census
  (`~/temp/agent/mimo-trial/reach-bench.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model-suite.log` was the last full count;
  this batch's tests ran green at `~/temp/agent/mimo-trial/t8-bench-named7.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `2810a9104`.
  Next:
  the whole-suite census at this commit as the next batch's baseline:
  `census written to ~/.cache/translation-repair/coverage/census-G4ZkGi/census.json`
  (`~/temp/agent/mimo-trial/census-37.log`),
  `library source: 129 files, 228 stretches over 475 lines, 5 functions never called`
  (the never-called count moved again,
  8 to 5).
  Largest clusters by stretches then lines:
  `grade` leads with 5 stretches over 11 lines in 2 files,
  `restoration` with 5 over 8 in 2,
  `han` with 5 over 7 in 2.
  Next:
  the `grade` batch.

- 2026-10-04,
  14:00 UTC:
  the next batch's baseline census taken at commit `3970d3c0d`:
  `census written to ~/.cache/translation-repair/coverage/census-WGrBjo/census.json`
  (`~/temp/agent/mimo-trial/census-36.log`).
  `library source: 130 files, 233 stretches over 486 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/bench` leads with 5 stretches over 11 lines in 1 file,
  `grade` with 5 over 11 in 2,
  `restoration` with 5 over 8 in 2.
  This line lands in the trial-log commit that follows `3970d3c0d`.
  Next:
  the `corpus-run/bench` batch.

- 2026-10-04,
  13:52 UTC:
  the T8 `corpus-run/model` batch closed with commits `013e5d3ff`,
  `581363446`:
  5 line stretches over `model-catalog-compare.ts`,
  all cased
  (the two parse refusals,
  the claimed-underlying read under either spelling,
  and the report's blocklist,
  missing,
  alias
  and plain lines).
  The reach census reads `ran 5, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-model2.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `581363446`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/bench` cluster
  (the ranking's next at `census-WleNhT`).

- 2026-10-04,
  13:48 UTC:
  the next batch's baseline census taken at commit `64c05616e`:
  `census written to ~/.cache/translation-repair/coverage/census-WleNhT/census.json`
  (`~/temp/agent/mimo-trial/census-35.log`).
  `library source: 131 files, 238 stretches over 499 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/model` leads with 5 stretches over 13 lines in 1 file,
  `corpus-run/bench` with 5 over 11 in 1,
  `grade` with 5 over 11 in 2.
  This line lands in the trial-log commit that follows `64c05616e`.
  Next:
  the `corpus-run/model` batch.

- 2026-10-04,
  13:40 UTC:
  the T8 `stage` batch closed with commits `6d45ab0a1`,
  `4095f47e3`,
  `e4f718feb`:
  5 line stretches over the stage window,
  roster,
  fanout
  and decision files.
  Four cased
  (the voice-pair read,
  the decision guard and abort,
  and both optional-knob spreads),
  one removed as type-dead
  (the fanout content ternary's structured arm:
  `ChatMessage.content` is string-only).
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-stage3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-stage-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-stage-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e4f718feb`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/model` cluster
  (the ranking's next at `census-1VGtcy`).

- 2026-10-04,
  13:26 UTC:
  the next batch's baseline census taken at commit `682015402`:
  `census written to ~/.cache/translation-repair/coverage/census-1VGtcy/census.json`
  (`~/temp/agent/mimo-trial/census-34.log`).
  `library source: 134 files, 242 stretches over 514 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `stage` leads with 5 stretches over 16 lines in 4 files,
  `corpus-run/model` with 5 over 13 in 1,
  `corpus-run/bench` with 5 over 11 in 1.
  This line lands in the trial-log commit that follows `682015402`.
  Next:
  the `stage` batch.

- 2026-10-04,
  13:18 UTC:
  the T8 `corpus-run/probe` batch closed with commits `b37a5851f`,
  `0176fa22d`,
  `db84dbfa3`,
  `5d817c448`:
  5 line stretches over the probe telemetry and relabel files,
  all cased
  (the two telemetry notes,
  the manifest item no candidate carries,
  and the control's taken and holder refusals).
  The fixtures are a throwaway corpus clone,
  scratch-run entry artifacts,
  and a manifest through `buildSampleManifest`.
  Four source scans named the patterns the new cases must keep:
  `concurrency: 1` for process-global writes,
  the global-writer body groups (B111,
  no shared fixture),
  `scratchDir` for temp directories (B108),
  and the own-tests allowlist (B102).
  The reach census reads `ran 2, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-probe2.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-probe-suite5.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-probe-scans5.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5d817c448`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `stage` cluster
  (the ranking's next at `census-7LEx8b`).

- 2026-10-04,
  12:31 UTC:
  the next batch's baseline census taken at commit `e9a2f06b1`:
  `census written to ~/.cache/translation-repair/coverage/census-7LEx8b/census.json`
  (`~/temp/agent/mimo-trial/census-33.log`).
  `library source: 137 files, 247 stretches over 531 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/probe` leads with 5 stretches over 17 lines in 3 files,
  `stage` with 5 over 16 in 4,
  `corpus-run/model` with 5 over 13 in 1.
  This line lands in the trial-log commit that follows `e9a2f06b1`.
  Next:
  the `corpus-run/probe` batch.

- 2026-10-04,
  12:23 UTC:
  the T8 `corpus-run/prose` batch closed with commits `55621aa6e`,
  `1c59e999d`,
  `943323375`,
  `794cd7764`:
  5 line stretches over `prose-ranges.ts`,
  all cased
  (the comment end reads,
  the quoting marks,
  the code fence,
  the lone backtick pair,
  the unterminated marker,
  and the bare autolink).
  The reach census over the corpus-run tests reads
  `ran 5, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-prose8.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-prose-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-prose-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `794cd7764`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/probe` cluster
  (the ranking's next at `census-OjpKcL`).

- 2026-10-04,
  12:12 UTC:
  the next batch's baseline census taken at commit `43c129ff2`:
  `census written to ~/.cache/translation-repair/coverage/census-OjpKcL/census.json`
  (`~/temp/agent/mimo-trial/census-32.log`).
  `library source: 138 files, 252 stretches over 548 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/prose` leads with 5 stretches over 17 lines in 1 file,
  `corpus-run/probe` with 5 over 17 in 3,
  `stage` with 5 over 16 in 4.
  This line lands in the trial-log commit that follows `43c129ff2`.
  Next:
  the `corpus-run/prose` batch.

- 2026-10-04,
  12:04 UTC:
  the T8 `preservation` batch closed with commit `05a02beab`:
  6 line stretches over `preservation-tokens.ts`
  and `preservation-check.ts`,
  the name scanner's five dead empty-string fallbacks narrowed away,
  one cased
  (the empty licensed quote that blanks nothing).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-preservation.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-preservation-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-preservation-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `05a02beab`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/prose` cluster
  (the ranking's next at `census-g87Ji1`).

- 2026-10-04,
  12:02 UTC:
  the next batch's baseline census taken at commit `71e8d814d`
  (which followed a fix-forward `316f1afc7` corrected:
  that docs paragraph carried a position reference,
  caught by the census's own suite run):
  `census written to ~/.cache/translation-repair/coverage/census-g87Ji1/census.json`
  (`~/temp/agent/mimo-trial/census-31.log`).
  `library source: 140 files, 258 stretches over 554 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `preservation` leads with 6 stretches over 6 lines in 2 files,
  `corpus-run/prose` with 5 over 17 in 1,
  `corpus-run/probe` with 5 over 17 in 3.
  This line lands in the trial-log commit that follows `71e8d814d`.
  Next:
  the `preservation` batch.

- 2026-10-04,
  11:52 UTC:
  the T8 `corpus-run/list` batch closed with commits `45e3356bc`,
  `99058e60a`:
  6 line stretches over `list-spread-restore.ts`,
  two closed as the impossible-index fallbacks they are
  (both `nonNullishOrThrow`),
  two cased
  (the single-item list and the count mismatch
  on the sides the walk actually compares),
  two left documented
  (the missing-position refusals,
  reached only where a parsed item carries no offsets).
  The reach census reads `left 2 cold stretches`,
  those two
  (`~/temp/agent/mimo-trial/reach-list2.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-list-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-list-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `99058e60a`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `preservation` cluster
  (the ranking's next at `census-RRFnX2`).

- 2026-10-04,
  11:38 UTC:
  the next batch's baseline census taken at commit `d5d3b32a7`:
  `census written to ~/.cache/translation-repair/coverage/census-RRFnX2/census.json`
  (`~/temp/agent/mimo-trial/census-28.log`).
  `library source: 140 files, 262 stretches over 558 lines, 8 functions never called`
  (the never-called count moved for the first time this trial,
  9 to 8,
  the consolidate batch's cases reaching one).
  Largest clusters by stretches then lines:
  `corpus-run/list` leads with 6 stretches over 6 lines in 1 file,
  `preservation` with 6 over 6 in 2,
  `corpus-run/prose` with 5 over 17 in 1.
  This line lands in the trial-log commit that follows `d5d3b32a7`.
  Next:
  the `corpus-run/list` batch.
