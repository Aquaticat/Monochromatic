# Translation repair: trial handover to MiMo, 2026-10-03, part 03

Part 03 of [Translation repair: trial handover to MiMo, 2026-10-03](translation-repair-mimo-trial-2026-10-03.md),
whose index lists every part in order.

## Trial log, continued

- 2026-10-04,
  22:52 UTC:
  the next batch's baseline census taken at commit `ccf8a7eb7`:
  `census written to ~/.cache/translation-repair/coverage/census-bppPVq/census.json`
  (`~/temp/agent/mimo-trial/census-71.log`),
  `library source: 102 files, 159 stretches over 359 lines, 4 functions never called`.
  The lookup batch's new file tripped three scans on its way in
  (the own-tests allowlist entry,
  the direct mkdtemp,
  and the unused path join),
  each fixed forward
  (`153da6c69`,
  `ccf8a7eb7`).
  The ranking's first six clusters carry documented-left arms.
  The next actionable cluster is `retry`
  with 3 stretches over 6 lines in 1 file
  (`retry-stated-wait.ts:142`,
  `143-145`,
  `219-220`),
  then `corpus-run/lane`.
  This line lands in the trial-log commit that follows `ccf8a7eb7`.
  Next:
  the `retry` batch.

- 2026-10-04,
  22:36 UTC:
  the T8 `lookup` batch closed with commit `a9b5e71dc`:
  3 line stretches over `lookup-cache.ts`,
  all cased
  (the non-object value
  and the cache file that is no record).
  The reach census reads `ran 0, still cold 3`,
  the single-line returns the census's attribution leaves cold
  (the cases assert their values directly).
  Counts at the close:
  the full suite 1,563 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-lookup-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-lookup-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `a9b5e71dc`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `retry` cluster
  (the ranking's next at `census-5AHbot`).

- 2026-10-04,
  22:31 UTC:
  the next batch's baseline census taken at commit `2b64f2e6e`:
  `census written to ~/.cache/translation-repair/coverage/census-5AHbot/census.json`
  (`~/temp/agent/mimo-trial/census-67.log`).
  `library source: 103 files, 162 stretches over 365 lines, 4 functions never called`.
  The ranking's first six clusters carry documented-left arms.
  The next actionable cluster is `lookup`
  with 3 stretches over 6 lines in 1 file
  (`lookup-cache.ts:193`,
  `221`,
  `321-324`),
  then `retry`.
  This line lands in the trial-log commit that follows `2b64f2e6e`.
  Next:
  the `lookup` batch.

- 2026-10-04,
  22:24 UTC:
  the T8 `corpus-run/dropped` batch closed with commit `b55509754`:
  3 line stretches over `dropped-destinations.ts`,
  the run case landed
  (the stopper shed
  and several runs read in order),
  the three arms left documented
  (the earliest-reduce arm,
  the run-advance arm,
  and the stopper walk's return pair:
  the case's shapes did not reach them).
  The reach census reads `ran 0, still cold 3`:
  those three
  (`~/temp/agent/mimo-trial/reach-dropped.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-dropped-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-dropped-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `b55509754`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `lookup` cluster
  (the ranking's next at `census-MkpU3W`).

- 2026-10-04,
  22:20 UTC:
  the next batch's baseline census taken at commit `c06539dd8`:
  `census written to ~/.cache/translation-repair/coverage/census-MkpU3W/census.json`
  (`~/temp/agent/mimo-trial/census-66.log`).
  `library source: 103 files, 162 stretches over 365 lines, 4 functions never called`.
  The ranking's first five clusters carry documented-left arms.
  The next actionable cluster is `corpus-run/dropped`
  with 3 stretches over 6 lines in 1 file,
  then `lookup`,
  `retry`.
  This line lands in the trial-log commit that follows `c06539dd8`.
  Next:
  the `corpus-run/dropped` batch.

- 2026-10-04,
  22:12 UTC:
  the T8 `container` batch closed with commit `4621ad099`:
  3 line stretches over `container-integrity.ts`
  and `container-half-pairs.ts`,
  one closed as unreachable
  (the splice's own guard),
  two left documented
  (the nameless-container arm
  and the half-tag integrity error:
  their fixtures need a container with no name
  and a block cutting one tag).
  The reach census reads `ran 0, still cold 2`:
  those two
  (`~/temp/agent/mimo-trial/reach-container.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-container-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-container-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `4621ad099`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the next actionable cluster in the ranking
  (`edit`,
  `preservation`,
  or the documented-left revisits).

- 2026-10-04,
  22:10 UTC:
  the next batch's baseline census taken at commit `e91b5dd12`:
  `census written to ~/.cache/translation-repair/coverage/census-VzG5Wr/census.json`
  (`~/temp/agent/mimo-trial/census-65.log`).
  `library source: 104 files, 163 stretches over 366 lines, 4 functions never called`.
  The ranking's first five clusters
  (`corpus-run/published`,
  `active`,
  `declined`,
  `corpus-run/runs`,
  `transient`)
  all carry documented-left arms.
  The next actionable cluster is `container`
  with 3 stretches over 7 lines in 2 files,
  then `edit`,
  `preservation`.
  This line lands in the trial-log commit that follows `e91b5dd12`.
  Next:
  the `container` batch.

- 2026-10-04,
  22:02 UTC:
  the T8 `model` batch closed with commit `cb4b07506`:
  3 line stretches over `model-card-derive.ts`
  and `model-content.ts`,
  one cased
  (the fence line with no line end),
  two left documented
  (the two RangeError guards:
  their builders take keys from the roster lists
  and need a fixture disagreeing with them).
  The reach census reads `still cold 1` on `model-content.ts:36`,
  the single-line return the census's attribution leaves cold
  (the case asserts its value directly).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model2-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model2-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `cb4b07506`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/runs` cluster's remaining arms
  or the next in the ranking.

- 2026-10-04,
  22:00 UTC:
  the next batch's baseline census taken at commit `187348d0e`:
  `census written to ~/.cache/translation-repair/coverage/census-pN6fUe/census.json`
  (`~/temp/agent/mimo-trial/census-64.log`).
  `library source: 105 files, 164 stretches over 367 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `model`
  with 3 stretches over 9 lines in 2 files
  (`model-card-derive.ts:366`,
  `421-427`,
  `model-content.ts:36`),
  then `corpus-run/runs`,
  `transient`.
  This line lands in the trial-log commit that follows `187348d0e`.
  Next:
  the `model` batch.

- 2026-10-04,
  21:53 UTC:
  the T8 `hyper` batch closed with commit `309cafca9`:
  3 line stretches over `hyper-client.ts`,
  all cased
  (the deadline and answer-length knobs
  carried only when set).
  The reach census reads `ran 3, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-hyper.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-hyper-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-hyper-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `309cafca9`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `model` cluster
  (the ranking's next at `census-bOt8GY`).

- 2026-10-04,
  21:50 UTC:
  the next batch's baseline census taken at commit `4e08e3027`:
  `census written to ~/.cache/translation-repair/coverage/census-bOt8GY/census.json`
  (`~/temp/agent/mimo-trial/census-63.log`).
  `library source: 106 files, 167 stretches over 377 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `hyper`
  with 3 stretches over 10 lines in 1 file
  (`hyper-client.ts:364-369`,
  `375-376`,
  `421-422`),
  then `model`,
  `corpus-run/runs`.
  This line lands in the trial-log commit that follows `4e08e3027`.
  Next:
  the `hyper` batch.

- 2026-10-04,
  21:28 UTC:
  the next batch's baseline census taken at commit `8c9136d6b`:
  `census written to ~/.cache/translation-repair/coverage/census-oVnawX/census.json`
  (`~/temp/agent/mimo-trial/census-61.log`).
  `library source: 107 files, 171 stretches over 380 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `source`
  with 4 stretches over 3 lines in 1 file
  (`source-only-breaks.ts:170`,
  `186`,
  `199`),
  then `corpus-run/cache`,
  `hyper`.
  This line lands in the trial-log commit that follows `8c9136d6b`.
  Next:
  the `source` batch.

- 2026-10-04,
  21:36 UTC:
  the T8 `source` batch closed with commit `250da1333`:
  4 line stretches over `source-only-breaks.ts`,
  all four closed as unreachable
  (the break-count fallbacks
  the walks' own indices settle),
  one arm left documented
  (the sumOwed reduce's other-kind arm:
  its fixture needs blocks of more than one kind).
  The whole-suite census lists one stretch for the file
  (`census-ceHkbQ`,
  `library source: 107 files, 168 stretches over 378 lines, 4 functions never called`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-source-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-source-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `250da1333`.
  Next:
  the whole-suite census at this commit as the next batch's baseline
  (`census-ceHkbQ` stands),
  then the `corpus-run/cache` cluster
  (the ranking's next at `census-oVnawX`).

- 2026-10-04,
  21:42 UTC:
  the T8 `corpus-run/cache` batch closed with commits `4d5c7d96e`,
  `14a44721c`:
  3 line stretches over `cache-account-read.ts`
  and `cache-account-slices.ts`,
  one cased
  (the name whose tail runs to its line end),
  the other two matched in the reach run.
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-cache2.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cache-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cache-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `14a44721c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `hyper` cluster
  (the ranking's next at `census-oVnawX`).

- 2026-10-04,
  21:09 UTC:
  the next batch's baseline census taken at commit `a7d014baf`:
  `census written to ~/.cache/translation-repair/coverage/census-4BqrOY/census.json`
  (`~/temp/agent/mimo-trial/census-59.log`).
  `library source: 109 files, 175 stretches over 384 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `mask`
  with 4 stretches over 4 lines in 2 files
  (`mask-invisible-lines.ts:168`,
  `333`,
  `mask-container-tags.ts:156`,
  `171`),
  then `source`,
  `corpus-run/cache`.
  This line lands in the trial-log commit that follows `a7d014baf`.
  Next:
  the `mask` batch.

- 2026-10-04,
  21:21 UTC:
  the T8 `mask` batch closed with commits `29326895e`,
  `d4a3c3c65`:
  4 line stretches over `mask-invisible-lines.ts`
  and `mask-container-tags.ts`,
  two closed as unreachable
  (the code point
  and the line start:
  both reads their walks guarantee),
  two cased
  (the non-letter tag name
  and the closer with anything past its name).
  The reach census reads `left 1 cold stretch` for
  `mask-invisible-lines.ts` in the focused run,
  none in the whole-suite census
  (`~/temp/agent/mimo-trial/reach-mask2.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-mask-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-mask-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `d4a3c3c65`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `source` cluster
  (the ranking's next at `census-4BqrOY`).

- 2026-10-04,
  20:56 UTC:
  the next batch's baseline census taken at commit `c087e5884`:
  `census written to ~/.cache/translation-repair/coverage/census-E4DYQO/census.json`
  (`~/temp/agent/mimo-trial/census-58.log`).
  `library source: 110 files, 176 stretches over 385 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `corpus-run/canadian`
  with 4 stretches over 4 lines in 3 files
  (`canadian-date-parts.ts:354`,
  `canadian-date-read-leading.ts:259`,
  `335`,
  `canadian-spelling-capital.ts:463`),
  then `mask`,
  `source`,
  each at 4.
  This line lands in the trial-log commit that follows `c087e5884`.
  Next:
  the `corpus-run/canadian` batch.

- 2026-10-04,
  21:01 UTC:
  the T8 `corpus-run/canadian` batch closed with commit `10210a333`:
  4 line stretches over the canadian date and spelling files,
  all cased
  (the short year,
  the missing year,
  the runs-on comma,
  and the stray underscore).
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-canadian.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-canadian-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-canadian-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `10210a333`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `mask` cluster
  (the ranking's next at `census-E4DYQO`).

- 2026-10-04,
  20:45 UTC:
  the next batch's baseline census taken at commit `2b86649b6`:
  `census written to ~/.cache/translation-repair/coverage/census-E2Gm5a/census.json`
  (`~/temp/agent/mimo-trial/census-57.log`).
  `library source: 110 files, 178 stretches over 387 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `corpus-run/name`
  with 4 stretches over 4 lines in 1 file
  (`name-gloss-restore.ts:87`,
  `100`,
  `247`,
  `312`),
  then `corpus-run/canadian`,
  `mask`,
  each at 4.
  This line lands in the trial-log commit that follows `2b86649b6`.
  Next:
  the `corpus-run/name` batch.

- 2026-10-04,
  20:48 UTC:
  the T8 `corpus-run/name` batch closed with commits `1daaca6e1`,
  `f29a7247c`:
  4 line stretches over `name-gloss-restore.ts`,
  two cased
  (the unclosed quote
  and the name with no gloss verb),
  the comma case landed but missed the arm's shape,
  two left documented
  (the comma arm
  and the archive-slice map fallback).
  The reach census reads `ran 2, still cold 2`:
  those two
  (`~/temp/agent/mimo-trial/reach-name2.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-name-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-name-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f29a7247c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/canadian` cluster
  (the ranking's next at `census-E2Gm5a`).

- 2026-10-04,
  20:28 UTC:
  the next batch's baseline census taken at commit `81727ed38`:
  `census written to ~/.cache/translation-repair/coverage/census-vlck42/census.json`
  (`~/temp/agent/mimo-trial/census-56.log`).
  `library source: 111 files, 182 stretches over 392 lines, 4 functions never called`.
  The ranking's first three clusters
  (`corpus-run/published`,
  `active`,
  `declined`)
  all carry documented-left arms.
  The next actionable cluster is `displacement`
  with 4 stretches over 5 lines in 1 file,
  then `corpus-run/name`,
  `corpus-run/canadian`,
  `mask`,
  `source`,
  each at 4 stretches.
  This line lands in the trial-log commit that follows `81727ed38`.
  Next:
  the `displacement` batch.

- 2026-10-04,
  20:37 UTC:
  the T8 `displacement` batch closed with commits `f7fa3843e`,
  `70ab0cae0`,
  `1160a11a8`:
  4 line stretches over `displacement-class.ts`,
  three closed as unreachable
  (the surplus,
  the target-only slice,
  and the class:
  each read through a fallback its own comment
  marks as known present),
  one cased
  (the conserved-fraction refusal).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-displacement2.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-displacement-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-displacement-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `1160a11a8`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/name` cluster
  (the ranking's next at `census-vlck42`).

- 2026-10-04,
  20:20 UTC:
  the next batch's baseline census taken at commit `edd68a330`:
  `census written to ~/.cache/translation-repair/coverage/census-PGu68D/census.json`
  (`~/temp/agent/mimo-trial/census-55.log`).
  `library source: 111 files, 182 stretches over 392 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `active` with 4 over 8 in 1
  (its documented-left arms),
  `declined` with 4 over 6 in 1
  (`declined-target-runs.ts:109`,
  `158`,
  `193-194`,
  `195-196`).
  This line lands in the trial-log commit that follows `edd68a330`.
  Next:
  the `declined` batch.

- 2026-10-04,
  20:20 UTC:
  the T8 `declined` batch closed with commit `3326ef801`:
  4 line stretches over `declined-target-runs.ts`,
  the empty-pairing case landed,
  the four arms left documented
  (the rendering-continue mark,
  the empty-pairing refusal's own line,
  and the node-read ternary arms:
  their step shapes need alignments producing
  continuations the pairing fixtures do not stage).
  The reach census reads `ran 0, still cold 4`:
  those four
  (`~/temp/agent/mimo-trial/reach-declined.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-declined-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-declined-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3326ef801`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the next cluster in the ranking
  (the remaining clusters all sit near 4 stretches each;
  the published and active ones carry documented-left arms).

- 2026-10-04,
  20:08 UTC:
  the next batch's baseline census taken at commit `0d76e5014`:
  `census written to ~/.cache/translation-repair/coverage/census-Kyrgyt/census.json`
  (`~/temp/agent/mimo-trial/census-54.log`).
  `library source: 111 files, 182 stretches over 392 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `active` with 4 over 8 in 1
  (`active-footnote-markers.ts:309-310`,
  `315-316`,
  `328-329`,
  `334-335`),
  `declined` with 4 over 6 in 1.
  This line lands in the trial-log commit that follows `0d76e5014`.
  Next:
  the `active` batch.

- 2026-10-04,
  20:12 UTC:
  the T8 `active` batch closed with commits `4a87b3658`,
  `6fc0fd2a4`:
  4 line stretches over `active-footnote-markers.ts`,
  the run-bounding case landed
  (the paragraph one untokenized literal),
  the four bounds arms left documented
  (the transform never produced a run whose parent
  holds only unpositioned children in these fixtures,
  and the walk is footnote-scoped).
  The reach census reads `ran 0, still cold 4`:
  those four
  (`~/temp/agent/mimo-trial/reach-active2.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-active-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-active-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `6fc0fd2a4`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `declined` cluster
  (the ranking's next at `census-Kyrgyt`).

- 2026-10-04,
  19:48 UTC:
  the next batch's baseline census taken at commit `870253616`:
  `census written to ~/.cache/translation-repair/coverage/census-KYvmuo/census.json`
  (`~/temp/agent/mimo-trial/census-53.log`).
  `library source: 111 files, 183 stretches over 394 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `transient` with 4 over 9 in 1
  (`transient-retry.ts:225`,
  `402-403`,
  `580-583`,
  `584-585`),
  `active` with 4 over 8 in 1.
  This line lands in the trial-log commit that follows `870253616`.
  Next:
  the `transient` batch.

- 2026-10-04,
  20:00 UTC:
  the T8 `transient` batch closed with commit `c1b403b95`:
  4 line stretches over `transient-retry.ts`,
  one cased
  (the non-Error throw wrapped into one),
  three left documented
  (the backoff's non-abort rethrow,
  the aborted-exchange pair,
  and the loop's exhausted throw).
  The commit message for `c1b403b95` names only two of
  the three left
  (the aborted-exchange pair went unnamed);
  recorded in the ledger rather than amended
  (ledger GCA).
  The reach census reads `ran 1, still cold 3`:
  those three
  (`~/temp/agent/mimo-trial/reach-transient.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-transient-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-transient-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `c1b403b95`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `active` cluster
  (the ranking's next at `census-KYvmuo`).

- 2026-10-04,
  19:18 UTC:
  the next batch's baseline census taken at commit `5840665be`:
  `census written to ~/.cache/translation-repair/coverage/census-pVW4Um/census.json`
  (`~/temp/agent/mimo-trial/census-52.log`).
  `library source: 111 files, 184 stretches over 395 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/runs` with 4 over 10 in 2
  (`runs-lock-holder.ts:198`,
  `463-468`,
  `runs-lock.ts:250-251`,
  `311`),
  `transient` with 4 over 9 in 1.
  This line lands in the trial-log commit that follows `5840665be`.
  Next:
  the `corpus-run/runs` batch.

- 2026-10-04,
  19:40 UTC:
  the T8 `corpus-run/runs` batch closed with commit `4e95c885d`:
  4 line stretches over `runs-lock-holder.ts`
  and `runs-lock.ts`,
  two cased
  (the unrecorded-identity lock line
  and the race loss's named holder),
  two left documented
  (the unrecorded identity construction,
  whose reads fail only where the host exposes none,
  and the race branch's holder spread,
  whose two-process race a single-process fixture
cannot stage without flakiness).
  The reach census reads `still cold 2`:
  those two
  (`~/temp/agent/mimo-trial/reach-runs.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-runs-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-runs-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `4e95c885d`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `transient` cluster
  (the ranking's next at `census-pVW4Um`).

- 2026-10-04,
  19:03 UTC:
  the next batch's baseline census taken at commit `6209604f3`:
  `census written to ~/.cache/translation-repair/coverage/census-cQ5IKo/census.json`
  (`~/temp/agent/mimo-trial/census-51.log`).
  `library source: 112 files, 186 stretches over 397 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `provider` with 4 over 10 in 2,
  `corpus-run/runs` with 4 over 10 in 2.
  This line lands in the trial-log commit that follows `6209604f3`.
  Next:
  the `provider` batch.

- 2026-10-04,
  19:11 UTC:
  the T8 `provider` batch closed with commit `f8598d546`:
  4 line stretches over `provider-budget-refusal.ts`
  and `provider-router.ts`,
  three cased
  (the two refusal reads
  and the last-attempt rethrow),
  the loop-exhausted throw its comment marks unreachable
  left as written.
  The reach census reads `ran 2, still cold 0, cold since then 0`
  (`~/temp/agent/mimo-trial/reach-provider.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-provider-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-provider-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f8598d546`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/runs` cluster
  (the ranking's next at `census-cQ5IKo`).

- 2026-10-04,
  18:24 UTC:
  the next batch's baseline census taken at commit `4cbad5f31`
  (its first run failed on a flaky timeout in the lane contest's
  half-quorum case,
  green on re-run):
  `census written to ~/.cache/translation-repair/coverage/census-1UFhGm/census.json`
  (`~/temp/agent/mimo-trial/census-50.log`).
  `library source: 114 files, 190 stretches over 407 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/slice` with 4 over 10 in 2,
  `provider` with 4 over 10 in 2.
  This line lands in the trial-log commit that follows `4cbad5f31`.
  Next:
  the `corpus-run/slice` batch.

- 2026-10-04,
  18:56 UTC:
  the T8 `corpus-run/slice` batch closed with commits `5bf207307`,
  `3fdbf9b19`:
  4 line stretches over `slice-cache-namespace.ts`
  and `slice-census-entry.ts`,
  one closed as unreachable
  (the missing-node fallback narrowed),
  three cased
  (the recomputed cache file,
  the surfaced fault,
  and the target-only block count).
  The reach census reads `still cold 2`
  on `266`
  and `378`,
  both the single-line return and throw
  the census's attribution leaves cold
  (the reading the spend batch recorded),
  and both cases assert their behavior directly.
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-slice-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-slice-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3fdbf9b19`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `provider` cluster
  (the ranking's next at `census-1UFhGm`).
