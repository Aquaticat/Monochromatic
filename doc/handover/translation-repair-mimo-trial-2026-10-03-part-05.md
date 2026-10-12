# Translation repair: trial handover to MiMo, 2026-10-03, part 05

Part 05 of [Translation repair: trial handover to MiMo, 2026-10-03](translation-repair-mimo-trial-2026-10-03.md),
whose index lists every part in order.

## Trial log, continued

- 2026-10-04,
  11:29 UTC:
  the T8 `corpus-run/consolidate` batch closed with commit `445e5b718`:
  6 line stretches over `consolidate-cache-store.ts`,
  all cased through the store's own round trip
  (the record and choice refusals,
  the absent gate beside the unreadable one,
  both shippings,
  and the non-record settlement).
  The reach census reads `ran 6, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-consolidate.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-consolidate-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-consolidate-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `445e5b718`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/list` cluster
  (the ranking's next at `census-xreqy1`).

- 2026-10-04,
  11:27 UTC:
  the next batch's baseline census taken at commit `c56975df4`:
  `census written to ~/.cache/translation-repair/coverage/census-xreqy1/census.json`
  (`~/temp/agent/mimo-trial/census-27.log`).
  `library source: 141 files, 268 stretches over 566 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/consolidate` leads with 6 stretches over 8 lines in 1 file,
  `corpus-run/list` with 6 over 6 in 1,
  `preservation` with 6 over 6 in 2.
  This line lands in the trial-log commit that follows `c56975df4`.
  Next:
  the `corpus-run/consolidate` batch.

- 2026-10-04,
  11:18 UTC:
  the T8 `corpus-run/directory` batch closed with commits `6ce30575c`
  and `f2a9a055b`:
  6 line stretches over `directory-id-name.ts`,
  all cased
  (the record and string refusals of the metadata reads,
  the alias shapes,
  the empty-letters id,
  and the id-namer).
  The reach census reads `ran 6, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-directory2.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-directory-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-directory-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f2a9a055b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/consolidate` cluster
  (the ranking's next at `census-eIzZ5P`).

- 2026-10-04,
  11:11 UTC:
  the next batch's baseline census taken at commit `b7e216487`:
  `census written to ~/.cache/translation-repair/coverage/census-eIzZ5P/census.json`
  (`~/temp/agent/mimo-trial/census-26.log`).
  `library source: 142 files, 274 stretches over 577 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/directory` leads with 6 stretches over 11 lines in 1 file,
  `corpus-run/consolidate` with 6 over 8 in 1,
  `corpus-run/list` with 6 over 6 in 1.
  This line lands in the trial-log commit that follows `b7e216487`.
  Next:
  the `corpus-run/directory` batch.

- 2026-10-04,
  11:02 UTC:
  the T8 `line` batch closed with commits `fe1f48671`,
  `76f87ac7b` and `5202dedc5`:
  6 line stretches over two files.
  Three carry cases
  (the pair in both language orders,
  the no-letter neighbour,
  and the page bound),
  and three read strictly behind their guarantees
  (the five-block floor,
  the loop bound),
  `nonNullishOrThrow` throughout.
  The reach census reads `ran 0, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-line2.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-line-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-line-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5202dedc5`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/directory` cluster
  (the ranking's next at `census-8QcZ0L`).

- 2026-10-04,
  10:52 UTC:
  the next batch's baseline census taken at commit `41dd5bd89`:
  `census written to ~/.cache/translation-repair/coverage/census-8QcZ0L/census.json`
  (`~/temp/agent/mimo-trial/census-25.log`).
  `library source: 144 files, 280 stretches over 591 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `line` leads with 6 stretches over 14 lines in 2 files,
  `corpus-run/directory` with 6 over 11 in 1,
  `corpus-run/consolidate` with 6 over 8 in 1.
  This line lands in the trial-log commit that follows `41dd5bd89`.
  Next:
  the `line` batch.

- 2026-10-04,
  10:43 UTC:
  the T8 `sample` batch closed with commits `a23270119`,
  `c3c0ac7c2`,
  `1ecdd31b7` and `5dbdff239`:
  6 line stretches over three files.
  Four carry cases
  (the round-robin quota fill,
  the entry-shuffle tiebreak pinned in both arrival orders,
  the byte-count refusal and the no-claim placeholders,
  the repair context,
  and the unrecorded generation),
  and two settled behind their own contracts
  (the quota loop's stopgap break became a pass ceiling;
  the issue-key tiebreak was dead twice over,
  the entry-shuffle compare alone remaining).
  A new `sample-draw.unit.test.ts` leaves the own-unit-tests allowlist.
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-sample6.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-sample-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-sample-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5dbdff239`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `line` cluster
  (the ranking's next at `census-u4yVLi`).

- 2026-10-04,
  09:52 UTC:
  the next batch's baseline census taken at commit `d85e24703`:
  `census written to ~/.cache/translation-repair/coverage/census-u4yVLi/census.json`
  (`~/temp/agent/mimo-trial/census-24.log`).
  `library source: 147 files, 286 stretches over 614 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `sample` leads with 6 stretches over 23 lines in 3 files,
  `line` with 6 over 14 in 2,
  `corpus-run/directory` with 6 over 11 in 1.
  This line lands in the trial-log commit that follows `d85e24703`.
  Next:
  the `sample` batch.

- 2026-10-04,
  09:43 UTC:
  the T8 `corpus-run/rendering` batch closed with commits `bce653c57`,
  `b01ca171a` and `be9beb63c`:
  6 line stretches over four files.
  Four carry cases
  (the empty identity declaration,
  the missing-comparison-row invariant,
  the verify refusal over a tampered `sourceChars`,
  and the slot phrase in both its numbers),
  two settled behind their own contracts
  (the decided filter carries the narrowing as a type predicate;
  the cited-pages map is total over the subjects,
  its miss guard now `nonNullishOrThrow`).
  The reach census reads `ran 2, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-rendering2.log`).
  Counts at the close:
  the full suite 1,554 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-rendering-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-rendering-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `be9beb63c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `sample` cluster
  (the ranking's next at `census-Vv2d8g`).

- 2026-10-04,
  09:12 UTC:
  the next batch's baseline census taken at commit `6c6d7203d`:
  `census written to ~/.cache/translation-repair/coverage/census-Vv2d8g/census.json`
  (`~/temp/agent/mimo-trial/census-23.log`).
  `library source: 151 files, 292 stretches over 639 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/rendering` leads with 6 stretches over 25 lines in 4 files,
  `sample` with 6 over 23 in 3,
  `line` with 6 over 14 in 2.
  This line lands in the trial-log commit that follows `6c6d7203d`.
  Next:
  the `corpus-run/rendering` batch.

- 2026-10-04,
  09:02 UTC:
  the T8 `corpus-run/coverage` batch closed with commits `c2c9c9689`
  and `db979e5b3`:
  6 stretches over `coverage-control.ts`,
  all cased in its vote-change driver file
  (the not-carried and evidence-not-locatable refusals,
  the no-room decoy riding its row,
  and the held pair through a quote-following client
  whose `none` answers carry the empty quote the wire requires).
  The reach census reads `ran 6, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-coveragecontrol.log`).
  Counts at the close:
  the full suite 1,554 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coveragecontrol-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coveragecontrol-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `db979e5b3`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/rendering` cluster
  (the ranking's next at `census-14CEcx`).

- 2026-10-04,
  08:45 UTC:
  the next batch's baseline census taken at commit `40afaf9b5`:
  `census written to ~/.cache/translation-repair/coverage/census-14CEcx/census.json`
  (`~/temp/agent/mimo-trial/census-22b.log`,
  its first attempt at `census-22.log` failing after the run finished
  with no census written and no suite fault,
  retry clean).
  `library source: 152 files, 298 stretches over 682 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/coverage` leads with 6 stretches over 43 lines in 1 file,
  `corpus-run/rendering` with 6 over 25 in 4,
  `sample` with 6 over 23 in 3.
  This line lands in the trial-log commit that follows `40afaf9b5`.
  Next:
  the `corpus-run/coverage` batch.

- 2026-10-04,
  08:32 UTC:
  the T8 `image` batch closed with commits `167332775`,
  `feada2f6e` and `480561e23`:
  6 stretches over three files.
  Five carry cases
  (the dotless name's empty extension,
  both decoder successes and the whole OCR path on tool-made fixtures,
  the deterministic count read both ways,
  and the reader-failure catch with its missing-binary half
  through the reader name now being a defaulted parameter).
  One roster guard came out behind the capability gate,
  the roster read now `nonNullishOrThrow`'s.
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-image3.log`).
  Counts at the close:
  the full suite 1,554 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-image-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-image-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `480561e23`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/coverage` cluster
  (the ranking's next at `census-mgeQC0`).

- 2026-10-04,
  07:56 UTC:
  the next batch's baseline census taken at commit `67694f69d`:
  `census written to ~/.cache/translation-repair/coverage/census-mgeQC0/census.json`
  (`~/temp/agent/mimo-trial/census-21.log`).
  `library source: 155 files, 304 stretches over 772 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `image` leads with 6 stretches over 90 lines in 3 files,
  `corpus-run/coverage` with 6 over 43 in 1,
  `corpus-run/rendering` with 6 over 25 in 4.
  This line lands in the trial-log commit that follows `67694f69d`.
  Next:
  the `image` batch.

- 2026-10-04,
  07:46 UTC:
  the T8 `introduced` batch closed with commits `3af7885a8`,
  `74490e7dc` and `3094cc053`:
  7 stretches over two files,
  all cased and none unreachable.
  The wire guards' non-record and non-number refusals,
  the two neighbour fallbacks,
  the empty-quote dismissal
  (the case drives it through the damage gate,
  the only way an empty quote reaches the restates check),
  and the identity-context thread
  (its rules ride the system half,
  gated on a `DECLARED NAMES` entry).
  The reach census reads `ran 7, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-introduced3.log`).
  Counts at the close:
  the full suite 1,553 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-introduced-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-introduced-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3094cc053`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `image` cluster
  (the ranking's next at `census-HKw9t2`).

- 2026-10-04,
  07:27 UTC:
  the next batch's baseline census taken at commit `b1f893810`:
  `census written to ~/.cache/translation-repair/coverage/census-HKw9t2/census.json`
  (`~/temp/agent/mimo-trial/census-20.log`).
  `library source: 157 files, 311 stretches over 779 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `introduced` leads with 7 stretches over 7 lines in 2 files,
  `image` with 6 over 90 in 3,
  `corpus-run/coverage` with 6 over 43 in 1.
  This line lands in the trial-log commit that follows `b1f893810`.
  Next:
  the `introduced` batch.

- 2026-10-04,
  07:16 UTC:
  the T8 `corpus-run/contributor` batch closed with commits `b2a0f5395`,
  `539a98d16` and `bcdd232b2`:
  7 stretches over two files.
  Five carry cases
  (the page-rendering fallback in a new authorities test file that leaves
  the own-unit-tests allowlist,
  the outright name match,
  and the heading whose original names no contributor),
  two identical-line unchanged arms came out unreachable behind
  `carriesRendering`,
  and the skip for an unwritten slice carries its case.
  The reach runs corrected three fixtures along the way
  (the authority derives from the signature;
  the archive rendering returns before the page read).
  A correction on `bcdd232b2`'s body:
  shell substitution ate the backticked phrase naming the two
  identical-line checks,
  leaving "The  arms sat unreachable";
  the phrase is `after === line` and the commit stands as written.
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-contributor5.log`).
  Counts at the close:
  the full suite 1,553 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-contributor-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-contributor-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `bcdd232b2`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `introduced` cluster
  (the ranking's next at `census-D1SlGz`).

- 2026-10-04,
  06:40 UTC:
  the next batch's baseline census taken at commit `d5e942e39`:
  `census written to ~/.cache/translation-repair/coverage/census-D1SlGz/census.json`
  (`~/temp/agent/mimo-trial/census-19.log`).
  `library source: 159 files, 318 stretches over 786 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/contributor` leads with 7 stretches over 7 lines in 2 files,
  `introduced` with 7 over 7 in 2,
  `image` with 6 over 90 in 3.
  This line lands in the trial-log commit that follows `d5e942e39`.
  Next:
  the `corpus-run/contributor` batch.

- 2026-10-04,
  06:30 UTC:
  the T8 `corpus-run/window` batch closed with commits `349a41a08`
  and `5997cef44`:
  7 line stretches over three files,
  the probe's three named ones the never-called functions the census
  books apart.
  Three carry cases
  (the draw-and-preparation disagreement,
  both incumbent-kind arms through a rendered slice beside an insertion
  one,
  a ledger line that parses as JSON but is no row),
  and the shipped sum's three index fallbacks came out unreachable behind
  its fixed arm list,
  now read through a named function.
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-window.log`).
  Counts at the close:
  the full suite 1,552 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-window-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-window-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5997cef44`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/contributor` cluster
  (the ranking's next at `census-koUGtg`).

- 2026-10-04,
  06:05 UTC:
  the next batch's baseline census taken at commit `75d19f5c3`:
  `census written to ~/.cache/translation-repair/coverage/census-koUGtg/census.json`
  (`~/temp/agent/mimo-trial/census-18.log`).
  `library source: 162 files, 325 stretches over 794 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/window` leads with 7 stretches over 8 lines in 3 files,
  `corpus-run/contributor` with 7 over 7 in 2,
  `introduced` with 7 over 7 in 2.
  This line lands in the trial-log commit that follows `75d19f5c3`.
  Next:
  the `corpus-run/window` batch.

- 2026-10-04,
  05:55 UTC:
  the T8 `refine` batch closed with commits `d8aea82b3`,
  `0ddd86249`,
  `7710497e2`,
  `45f0eae68` and `2e827df9c`:
  7 stretches over four files.
  Five carry cases
  (the eligibility boundary's non-body zone through its document
  parameter,
  a rewrite entry that is no record,
  a rewrite naming no envelope and one writing the base back,
  the neighbour and context spreads read off the asked sheets of a fully
  scripted flow,
  and the checker tally with its worse-verdict control).
  Two came out behind their callers' own contracts
  (the resolver binds operations only to envelopes it found;
  the checker stage builds a tally per issue it asked),
  both now `nonNullishOrThrow`.
  The reach census reads `ran 2, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-refine4.log`).
  Counts at the close:
  the full suite 1,552 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-refine-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-refine-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `2e827df9c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/window` cluster
  (the ranking's next at `census-UCyK9F`).

- 2026-10-04,
  05:10 UTC:
  the next batch's baseline census taken at commit `f0d26bb64`:
  `census written to ~/.cache/translation-repair/coverage/census-UCyK9F/census.json`
  (`~/temp/agent/mimo-trial/census-17.log`).
  `library source: 166 files, 333 stretches over 806 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `refine` leads with 7 stretches over 11 lines in 4 files,
  `corpus-run/window` with 7 over 8 in 3,
  `corpus-run/contributor` with 7 over 7 in 2.
  This line lands in the trial-log commit that follows `f0d26bb64`.
  Next:
  the `refine` batch.

- 2026-10-04,
  05:00 UTC:
  the T8 `markup` batch closed with commits `1136d5be0`,
  `2fe92afcd` and `27a8745bb`:
  7 stretches over `markup-atom-scan.ts` and `markup-atom-preservation.ts`.
  Four scanner refusals carry cases
  (the escaped close inside a matched region,
  the link destination unclosed at the newline,
  the unterminated comment,
  the unclosed attribute expression),
  two `?? ''` fallbacks and one `?.unexcused ?? []` came out dead behind
  their own callers' guarantees,
  and the preservation module's new test file
  (it sat on the own-unit-tests allowlist)
  grew to eight cases across the reach runs.
  The reach census reads `ran 0, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-markup3.log`).
  Counts at the close:
  the full suite 1,552 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-markup-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-markup-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `27a8745bb`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `refine` cluster
  (the ranking's next at `census-uyG0kG`).

- 2026-10-04,
  04:38 UTC:
  the next batch's baseline census taken at commit `411e705a1`:
  `census written to ~/.cache/translation-repair/coverage/census-uyG0kG/census.json`
  (`~/temp/agent/mimo-trial/census-16.log`).
  `library source: 168 files, 340 stretches over 817 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `markup` leads with 7 stretches over 11 lines in 2 files,
  `refine` with 7 over 11 in 4,
  `corpus-run/window` with 7 over 8 in 3.
  This line lands in the trial-log commit that follows `411e705a1`.
  Next:
  the `markup` batch.

- 2026-10-04,
  04:28 UTC:
  the T8 `coverage` batch closed with commits `c9b1940fe`
  and `0f65e1f55`:
  8 stretches over four files.
  Two `unreachable:` index guards came out for `nonNullishOrThrow`,
  the wire's four refusals read through one case,
  the stage's three conditional spreads each carry its case and control
  (the follow-up evidence's JSON on the asked sheet,
  the identity context where handed,
  the misattributed quote named in the verdict),
  and `targetSize`'s insertion guard came out dead behind `isPaired`'s
  own filter.
  The reach census's `cold since then` reading named the identity and
  foreign-region spreads along the way,
  cased with `0f65e1f55`.
  The reach census reads `ran 5, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-coverage3.log`).
  Counts at the close:
  the full suite 1,549 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coverage-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coverage-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `0f65e1f55`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `markup` cluster
  (the ranking's next at `census-MBzNhP`).

- 2026-10-04,
  04:12 UTC:
  the next batch's baseline census taken at commit `c651bea68`:
  `census written to ~/.cache/translation-repair/coverage/census-MBzNhP/census.json`
  (`~/temp/agent/mimo-trial/census-15.log`).
  `library source: 172 files, 348 stretches over 826 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `coverage` leads with 8 stretches over 9 lines in 4 files,
  `markup` with 7 over 11 in 2,
  `refine` with 7 over 11 in 4.
  This line lands in the trial-log commit that follows `c651bea68`.
  Next:
  the `coverage` batch.

- 2026-10-04,
  03:58 UTC:
  the T8 `corpus` batch closed with commits `33fc7a459`,
  `6046af7be` and `0c0b80bd9`:
  8 stretches over `corpus-source.ts` and `corpus-name-index.ts`.
  Five are cased through the public surface
  (the failure classifier's cause shapes,
  the stderr reader's string and unreadable arms,
  the name index's no-renderings skip and length gate,
  and its catch rethrow through the injected reader).
  One was the `gitOutput` catch rethrow,
  dead behind nano-spawn's error wrapping:
  the catch now wraps every throwable
  as the sibling `readCorpusBytes` catch already did,
  and the tradeoff is recorded under "Decisions for the owner to review"
  for the owner to veto.
  The reach census's whole-file reading named the byte reader's body and
  its failure wrap along the way,
  both cased (`6046af7be`,
  `0c0b80bd9`).
  The reach census reads `ran 3, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-corpus3.log`).
  Counts at the close:
  the full suite 1,549 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-corpus-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-corpus-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `0c0b80bd9`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `coverage` cluster
  (the ranking's next at `census-6x3Blt`).

- 2026-10-04,
  03:32 UTC:
  the next batch's baseline census taken at commit `5fe00bd6e`:
  `census written to ~/.cache/translation-repair/coverage/census-6x3Blt/census.json`
  (`~/temp/agent/mimo-trial/census-14.log`).
  `library source: 174 files, 356 stretches over 840 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus` leads with 8 stretches over 14 lines in 2 files,
  `coverage` with 8 over 9 in 4,
  `markup` with 7 over 11 in 2.
  This line lands in the trial-log commit that follows `5fe00bd6e`.
  Next:
  the `corpus` batch.

- 2026-10-04,
  03:22 UTC:
  the T8 `corpus-run/tag` batch closed with commits `a0d13daf7`
  and `71c58938b`:
  8 stretches over `corpus-run/tag-attributes.ts`,
  cased in six in a new test file beside the module
  (it sat on the own-unit-tests allowlist and now leaves it,
  `readTags` exported through `corpus-barrel`).
  The refusals read as:
  a name cut off at the text's end,
  a bare attribute with no equals staying out of the reading,
  an attribute starting where no name may,
  an unquoted value,
  an unterminated quote,
  and a bracket that opens no letter,
  every refusal case keeping the readable tag before it as its control.
  The first reach census named one `cold since then` stretch
  (the first-letter refusal),
  closed with `71c58938b`.
  The reach census reads `ran 8, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-tag2.log`).
  Counts at the close:
  the full suite 1,549 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-tag-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-tag-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `71c58938b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus` cluster
  (the ranking's next at `census-E0TzdR`).

- 2026-10-04,
  03:12 UTC:
  the next batch's baseline census taken at commit `63c8f25b0`:
  `census written to ~/.cache/translation-repair/coverage/census-E0TzdR/census.json`
  (`~/temp/agent/mimo-trial/census-13.log`).
  `library source: 175 files, 364 stretches over 856 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/tag` leads with 8 stretches over 16 lines in 1 file,
  `corpus` with 8 over 14 in 2,
  `coverage` with 8 over 9 in 4.
  This line lands in the trial-log commit that follows `63c8f25b0`.
  Next:
  the `corpus-run/tag` batch.

- 2026-10-04,
  03:03 UTC:
  the T8 `inspect` batch closed with commit `f8cf67026`:
  8 stretches over `inspect-paragraph.ts`.
  Three `atomsOfNode` arms are cased
  (an image with a resolved reference,
  formatting spans passing the walk through to their numbers),
  three refusals are cased
  (the strict-grammar catch and its `unparseable` rejection beside an
  unclosed JSX tag,
  the definitions-parse rejection beside broken definitions),
  and `gateParagraphRewrite`'s base rejection is cased beside its
  candidate twin.
  The second `not-one-paragraph` check sat dead behind the first one's
  kind half:
  a probe over five one-paragraph texts and twenty-one definition shapes
  never fired it,
  so the first check proves only the one-block shape
  and the leading-block check keeps the kind live,
  pinned with a single heading.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-inspect.log`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-inspect-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-inspect-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f8cf67026`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/tag` cluster
  (the ranking's next at `census-8aKVkN`).

- 2026-10-04,
  02:52 UTC:
  the next batch's baseline census taken at commit `7cde68089`:
  `census written to ~/.cache/translation-repair/coverage/census-8aKVkN/census.json`
  (`~/temp/agent/mimo-trial/census-12.log`).
  `library source: 176 files, 372 stretches over 889 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `inspect` leads with 8 stretches over 33 lines in 1 file,
  `corpus-run/tag` with 8 over 16 in 1,
  `corpus` with 8 over 14 in 2.
  This line lands in the trial-log commit that follows `7cde68089`.
  Next:
  the `inspect` batch.

- 2026-10-04,
  02:42 UTC:
  the T8 `synthetic` batch closed with commit `eca4d6e9f`:
  9 stretches over `synthetic-quota.ts` and `synthetic-transport.ts`,
  all cased and none unreachable.
  Seven quota field refusals read through four cases
  (the array-instead-of-object body,
  the string weekly block,
  each mistyped five-hour field,
  each mistyped weekly field),
  every refusal naming its own field.
  Two transport pass-throughs read through one overrun case
  and one wire-format case with its control half
  (the anthropic body unnamed completes past the same bound,
  its frames holding no `choices` key).
  The reach census reads `ran 9, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-synthetic.log`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-synthetic-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-synthetic-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `eca4d6e9f`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `inspect` cluster
  (the ranking's next at `census-xB1R6c`).

- 2026-10-04,
  02:26 UTC:
  `B123` closed with commits `23137d784` (red),
  `539cd11b8` (the design recorded mid-batch)
  and `9d7bbbec2` (the fix):
  the marker walk now reads the raw behind each unpositioned run,
  bounded between its positioned neighbours,
  so a page holding a footnote and an autolink literal relabels
  instead of being refused whole.
  The design reads the installed tokenizer's `defined.includes` gate:
  an undefined reference stays in its text,
  rides in the run,
  and the recovery places it exactly,
  while escaped openings and malformed ones stay byte-identical
  (three contract cases beside the red one).
  No cache version moves:
  279 pinned `.md` and `.mdx` files scanned,
  68 with marker text,
  0 of those parsing into unpositioned nodes
  (`~/temp/agent/mimo-trial/b123-corpus-scan.mjs`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/b123-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/b123-scans.log`).
  The ledger's B123 entry update lands in this line's commit.
  This line lands in the trial-log commit that follows `9d7bbbec2`.
  Next:
  the `synthetic` T8 cluster
  (9 stretches over 9 lines in 2 files at `census-xB1R6c`).
