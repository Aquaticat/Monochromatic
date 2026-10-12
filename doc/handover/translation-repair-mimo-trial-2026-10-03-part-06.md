# Translation repair: trial handover to MiMo, 2026-10-03, part 06

Part 06 of [Translation repair: trial handover to MiMo, 2026-10-03](translation-repair-mimo-trial-2026-10-03.md),
whose index lists every part in order.

## Trial log, continued

- 2026-10-04,
  01:37 UTC:
  `B123` is in progress.
  The red case through `applyFootnoteRelabel` is committed (`23137d784`):
  one page per measured trigger shape
  (a quoted `www.` literal,
  one after an unbalanced `[`,
  one beside CJK punctuation,
  one after a comma),
  each refusing today with the `position` kind
  (`~/temp/agent/mimo-trial/b123-red.log`).
  A probe of the built package settled the design
  (`~/temp/agent/mimo-trial/b123-probe.mjs`):
  the autolink transform's unpositioned runs hold `[^` text
  in the empty-label,
  spaced-label and unclosed shapes,
  and their decoded values erase escapes
  (`\[^x\]` reads as `[^x]`),
  so no check off node values can tell a marker from an escaped opening.
  The fix will bound each unpositioned run
  between its positioned neighbours
  (the parent's own bounds at either end)
  and scan that raw region with `gfmMarkerSpans`,
  which is escape-aware and reads labels as micromark does:
  no fabricated positions,
  no value checks,
  and the existing graph verification still guards the rewrite.
  This line lands in the trial-log commit that adds it.
  Next:
  the fix and its contract cases,
  then the cache-version call measured on the pinned corpus.

- 2026-10-04,
  01:13 UTC:
  the next batch's baseline census taken at commit `148979b36`:
  `census written to ~/.cache/translation-repair/coverage/census-xB1R6c/census.json`
  (`~/temp/agent/mimo-trial/census-11.log`).
  `library source: 178 files, 378 stretches over 891 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `synthetic` leads with 9 stretches over 9 lines in 2 files,
  `inspect` with 8 over 33 in 1,
  `corpus-run/tag` with 8 over 16 in 1.
  This line lands in the trial-log commit that follows `148979b36`.
  Next:
  `B123`,
  "Fourth" in this file,
  due once the first T8 batch landed and now overdue,
  then the `synthetic` batch.

- 2026-10-04,
  01:10 UTC:
  the T8 `openrouter` batch closed with commits `adcfeb5d4`,
  `b3cfd5637` and `780e4d267`:
  9 stretches over five source files.
  One is cased through the exported `rawCharsPerCompletionTokenOf` seam
  (its `unmeasured` arm reachable by shape,
  no roster card carrying it),
  one case pinning the fallback to the median of the measured card ratios.
  Three are the wire readers' refusals,
  cased in their own files.
  Five are the client's:
  the armed deadline,
  its joined signal and the caller `maxAnswerChars` spread cased together,
  and the cost,
  cached-token and endpoint spreads folded behind the exported
  `reportedSpendFieldsOf`,
  one case pinning the field combinations
  beside a meter pair
  (a bare stream leaves the meter flat,
  a costed one moves it 0.5).
  The first reach census settled three more
  (the chunk record guard behind a `startsWith('{')` gate that came out,
  the endpoint spread's unreported arm,
  the `/credits` non-success refusal),
  and two by-position comments and one statement TSDoc came out
  after the source scans flagged them.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the three edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-openrouter2.log`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-openrouter-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-openrouter-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `780e4d267`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `synthetic` cluster
  (the ranking's next after `openrouter` at `census-XzBVZf`).

- 2026-10-03,
  23:59 UTC:
  the `openrouter` batch is in progress,
  this mid-batch line written after the correction that its state
  lived only in working memory.
  Written but uncommitted in the worktree:
  two cases in `openrouter-client.unit.test.ts`
  (a caller `exchangeTimeoutMs` and `maxAnswerChars` armed on the client
  and read back under both,
  and `costUsd` and `cachedTokens` carried only where the wire sent them,
  both built on `chunkOf` streams),
  one in `openrouter-cached-tokens.unit.test.ts`
  (a non-record `data:` chunk and a fractional `cached_tokens`
  both read as `unreported`),
  one in `openrouter-cost.unit.test.ts`
  (a non-finite `cost` read as `unreported`).
  Decided,
  not yet written:
  `openrouter-abandoned-spend.ts:48`,
  the `rawCharsPerToken === 'unmeasured'` ternary arm,
  is reachable by shape
  (the card side types `rawCharsPerToken` as `number | 'unmeasured'`
  and `corpus-run/roster-card-render.ts` generates that spelling)
  and cold only because no roster card carries it,
  so it gets a narrow exported seam
  (the shape the `fidelity` batch gave `needle` and `anchor`)
  plus a case in `openrouter-abandoned-spend.unit.test.ts`,
  the seam exported through `provider-barrel.ts`.
  Remaining:
  the seam and its case,
  build,
  the named test files,
  lint,
  the code commit and its line here,
  the reach census against `census-XzBVZf`,
  the full suite,
  the source scans,
  the ledger T8 paragraph,
  and a fresh whole-suite census named in the line after.
  This line lands in the trial-log commit that adds it.

- 2026-10-03,
  23:07 UTC:
  the next batch's baseline census taken at commit `51f394046`:
  `census written to ~/.cache/translation-repair/coverage/census-XzBVZf/census.json`
  (`~/temp/agent/mimo-trial/census-9.log`).
  `library source: 183 files, 387 stretches over 909 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `openrouter` leads with 9 stretches over 18 lines in 5 files,
  `synthetic` with 9 over 9 in 2,
  `inspect` with 8 over 33 in 1.
  This line lands in the trial-log commit that follows `51f394046`.
  Next:
  the `openrouter` batch.

- 2026-10-03,
  23:03 UTC:
  the T8 `decision` batch closed with commits `045c0e2f5` and `750ec0708`:
  9 stretches over the reply contract and the over-context gate,
  8 cased (the answer guard,
  the reply reader's refusals and shaped returns,
  the status refusal),
  1 replaced by the house cause shape
  (the parse catch's dead non-Error arm).
  `decision-contract.unit.test.ts` is new
  and the module leaves the own-unit-tests allowlist.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-decision3.log`).
  Counts at the close:
  the full suite 1,546 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-decision-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `750ec0708`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `openrouter` cluster.

- 2026-10-03,
  22:39 UTC:
  the next batch's baseline census taken at commit `d017074e2`:
  `census written to ~/.cache/translation-repair/coverage/census-bR9IAH/census.json`
  (`~/temp/agent/mimo-trial/census-8.log`).
  `library source: 185 files, 396 stretches over 928 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `decision` leads with 9 stretches over 19 lines in 2 files,
  `openrouter` with 9 over 18 in 5,
  `synthetic` with 9 over 9 in 2.
  This line lands in the trial-log commit that follows `d017074e2`.
  Next:
  the `decision` batch.

- 2026-10-03,
  22:35 UTC:
  the T8 `fidelity` batch closed with commit `e9d07984e`:
  9 stretches over the two damage builders,
  2 dropped as unreachable,
  7 cased in `fidelity-alteration-variant.unit.test.ts` and `fidelity-damage.unit.test.ts`
  through an optional `needle` and `anchor` a case can supply.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and both edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-fidelity.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-fidelity-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e9d07984e`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `decision` cluster.

- 2026-10-03,
  22:12 UTC:
  the next batch's baseline census taken at commit `911154fe8`:
  `census written to ~/.cache/translation-repair/coverage/census-Ai2qpF/census.json`
  (`~/temp/agent/mimo-trial/census-7.log`).
  `library source: 187 files, 405 stretches over 952 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `fidelity` leads with 9 stretches over 24 lines in 2 files,
  `decision` with 9 over 19 in 2,
  `openrouter` with 9 over 18 in 5.
  This line lands in the trial-log commit that follows `911154fe8`.
  Next:
  the `fidelity` batch.

- 2026-10-03,
  22:07 UTC:
  the T8 `corpus-run/meter` batch closed with commit `729931a40`:
  10 stretches over the two meter readers,
  3 `??` fallbacks replaced with `nonNullishOrThrow`,
  7 cased through `seriesFor`,
  `longestDrySpan` and `readMeterLine`.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and both edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-meter.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-meter-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `729931a40`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `fidelity` cluster.

- 2026-10-03,
  21:50 UTC:
  the next batch's baseline census taken at commit `dae4b8eea`:
  `census written to ~/.cache/translation-repair/coverage/census-DbGZ25/census.json`
  (`~/temp/agent/mimo-trial/census-6.log`).
  `library source: 189 files, 415 stretches over 967 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/meter` leads with 10 stretches over 15 lines in 2 files,
  `fidelity` with 9 over 24 in 2,
  `decision` with 9 over 19 in 2.
  This line lands in the trial-log commit that follows `dae4b8eea`.
  Next:
  the `corpus-run/meter` batch.

- 2026-10-03,
  21:45 UTC:
  the T8 `corpus-run/final` batch closed with commits `e0bf15a10` and `3da0a9a3b`:
  10 stretches over the two completeness checkers,
  11 cases in `consolidation-polish.unit.test.ts` and its own test file,
  and the polish branch's consolidation narrowing hoisted before the loop
  so both its arms run.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-final2.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3da0a9a3b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/meter` cluster.

- 2026-10-03,
  21:10 UTC:
  the next batch's baseline census taken at commit `8fa092e8b`:
  `census written to ~/.cache/translation-repair/coverage/census-7Aczvk/census.json`
  (`~/temp/agent/mimo-trial/census-5.log`).
  `library source: 191 files, 425 stretches over 984 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/final` leads with 10 stretches over 17 lines in 2 files,
  `corpus-run/meter` with 10 over 15 in 2,
  `fidelity` with 9 over 24 in 2.
  This line lands in the trial-log commit that follows `8fa092e8b`.
  Next:
  the `corpus-run/final` batch.

- 2026-10-03,
  21:05 UTC:
  the T8 `rendering` batch closed with commits `18f0b3a85` and `0bea2bc58`:
  10 baseline stretches and 2 more the per-source reading found,
  3 replaced with `nonNullishOrThrow`,
  9 cased through `corroborate`,
  `corroborateByOverlap`,
  `nearMisses`,
  the exported `quotesRequired`
  and `anchorLocatedSpan`'s new `fold` seam.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and every edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-rendering2.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-rendering-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `0bea2bc58`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/final` cluster.

- 2026-10-03,
  20:18 UTC:
  the next batch's baseline census taken at commit `90b76fe15`:
  `census written to ~/.cache/translation-repair/coverage/census-MgQUMe/census.json`
  (`~/temp/agent/mimo-trial/census-4.log`).
  `library source: 194 files, 435 stretches over 1007 lines, 10 functions never called`.
  Largest clusters by stretches then lines:
  `rendering` leads with 10 stretches over 23 lines in 3 files,
  `corpus-run/final` with 10 over 17 in 2,
  `corpus-run/meter` with 10 over 15 in 2,
  `fidelity` with 9 over 24 in 2.
  This line lands in the trial-log commit that follows `90b76fe15`.
  Next:
  the `rendering` batch.

- 2026-10-03,
  20:13 UTC:
  the T8 `inline` batch closed with commit `eef1e1610`
  (`test(module-translation-repair): T8 inline, case the tag reader's refusals and its quoted spans`):
  all 10 stretches of `src/inline-container-tags.ts` cased through `containerHalfPairs` and `readSliceSkeleton`,
  and the reach census reads `still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-inline.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-inline-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `eef1e1610`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `rendering` cluster.

- 2026-10-03,
  19:35 UTC:
  the next batch's baseline census taken at commit `ae88792c7`:
  `census written to ~/.cache/translation-repair/coverage/census-DXY8l2/census.json`
  (`~/temp/agent/mimo-trial/census-3.log`).
  `library source: 195 files, 447 stretches over 1037 lines, 11 functions never called`,
  one stretch below `census-QFKBeX` with the `group` cluster now empty of them.
  The `inline` cluster holds 10,
  all in `src/inline-container-tags.ts`.
  This line lands in the trial-log commit that follows `ae88792c7`.
  Next:
  the `inline` batch.

- 2026-10-03,
  19:30 UTC:
  the fresh census caught the `unreachable:` throw's own line as a stretch
  and the guard came out with commit `c592bcc0f`
  (`fix(module-translation-repair): T8 group, remove the no-boundary guard instead of throwing from it`):
  `census-QFKBeX` listed `src/group-run-anchor.ts` line 172,
  an unreachable throw is unreachable code too,
  so the dead arm is removed
  and its invariant stands in the comment above `settled`.
  M112 records it
  and the T8 group paragraph's correction names itself.
  Counts:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-group-throw-fix-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL],
  Markdown lint clean in the ledger.
  This line lands in the trial-log commit that follows `c592bcc0f`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `inline` cluster.

- 2026-10-03,
  19:17 UTC:
  the T8 `group` batch closed:
  commit `691e70e3b` landed its last case
  (`test(module-translation-repair): T8 group, case the continuation riding with its seal`),
  written for `src/group-aligned.ts` lines 377 to 383,
  and the reach census reads `still cold 0, cold since then 0, not loaded 0`
  over the three claimed sources and three test files
  (`~/temp/agent/mimo-trial/reach-group.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-group-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `691e70e3b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `inline` cluster
  (10 stretches in one file).

- 2026-10-03,
  19:00 UTC:
  the T8 `group` batch's first case landed with commit `aa5f63aec`
  (`test(module-translation-repair): T8 group, case the run split at the step after a decline`),
  written for `src/group-aligned.ts` lines 195 to 198:
  a pairing placing every original with the middle translation declined,
  asserting the two runs it splits into.
  Counts:
  lint "Found 0 warnings and 0 errors.",
  the named file no [FAIL] and 2 [PASS]
  (`~/temp/agent/mimo-trial/t8-group-case-a2.log`),
  35 source scans and no [FAIL].
  The cluster's state:
  6 of 10 stretches closed as unreachable in `92c912b08`,
  1 cased here,
  and `src/group-aligned.ts` lines 377 to 383 (the sealed cohesive continuation arm)
  resist placement behind `mergeOneSidedRuns`' kind mapping:
  probe that mapping before deciding case or unreachable.
  This line lands in the trial-log commit that follows `aa5f63aec`.
  Next:
  place the two sealed-arm stretches,
  then the batch's reach census against `census-WkdwRV`
  (`--baseline` with one `--source` per file the batch claims),
  the full suite,
  lint,
  the scans,
  the T8 paragraph and this line,
  and a whole-suite census as the next batch's baseline.

- 2026-10-03,
  18:48 UTC:
  the T8 `group` cluster's six unreachable stretches closed with commit `92c912b08`
  (`fix(module-translation-repair): T8 group, drop the unreachable anchor fallbacks`):
  three `?? NO_BOUNDARY` fallbacks,
  one undefined-step arm
  and one dead `? []` arm removed,
  and one no-boundary arm replaced with an `unreachable:` throw
  after four probes on the built package never built the run list it guards.
  Counts:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-group-unreachable-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  This line lands in the trial-log commit that follows `92c912b08`.
  Next:
  the `group` cluster's two reachable stretches in `group-aligned.ts`
  (the position after a decline and the sealed cohesive continuation),
  then the batch's reach census.

- 2026-10-03,
  18:20 UTC:
  "Second:
  the whole-suite census" taken at commit `6d5f13a8b`,
  `census written to ~/.cache/translation-repair/coverage/census-WkdwRV/census.json`
  (`~/temp/agent/mimo-trial/census-base.log`).
  `library source: 198 files, 457 stretches over 1061 lines, 11 functions never called`.
  Largest clusters by stretches then lines:
  `group` leads with 10 stretches over 24 lines in 3 files,
  `inline` with 10 over 23 in 1,
  `rendering` with 10 over 23 in 3,
  `corpus-run/final` with 10 over 17 in 2,
  `corpus-run/meter` with 10 over 15 in 2,
  `fidelity` with 9 over 24 in 2,
  `decision` with 9 over 19 in 2,
  `openrouter` with 9 over 18 in 5.
  No cluster is near the split-by-file size.
  This line lands in the trial-log commit that follows `6d5f13a8b`.
  Next:
  "Third:
  T8 batches,
  one cluster at a time",
  the `group` cluster first.

- 2026-10-03,
  18:14 UTC:
  the flaky fixture finding closed with commit `3a6e3b1fa`
  (`test(module-translation-repair): T5, hold the naturalness grace case's delayed seat at a gate`):
  the owner chose T5's "Recurred in ..." paragraph over a B number,
  the seat's answer is now held at a gate the case releases after the review settled,
  and the recurrence names itself as a correction to T5's
  "the race read into it does not occur" claim.
  A comment naming its check by position turned the first run red and is M111.
  Counts:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t5-fix-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL],
  Markdown lint clean in the two docs.
  This line lands in the trial-log commit that follows `3a6e3b1fa`.
  Next:
  "Second:
  the whole-suite census".

- 2026-10-03,
  17:43 UTC:
  "First:
  fix B126" landed with commit `16ef9ff5d`
  (`fix(module-translation-repair): B126, read no contributor name from a link whose label is empty`):
  `contributorForm` returns the token unchanged only where no `](` exists,
  an empty label slices to the empty string,
  and the ledger's B126 plus one sentence in "Structure read off the parse" record it.
  No cache version moves:
  the pinned corpus search prints six binary matches and no text line
  (inference from that search).
  Checks:
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL],
  Markdown lint clean in the two docs,
  and the full suite 1,545 [PASS] with 2 [FAIL] lines
  (the `reviewAbsoluteNaturalness` "STARTS GRACE AT HALF instead of requiring delayed final seat" case and its suite,
  the wall-clock fixture of the 17:28 entry;
  the fix alone ran green as `~/temp/agent/mimo-trial/b126-suite.log`).
  This line lands in the trial-log commit that follows `16ef9ff5d`.
  Next:
  the flaky fixture as the next finding after B126,
  then "Second:
  the whole-suite census".

- 2026-10-03,
  17:28 UTC:
  "Setup,
  once" closed on trial-log commit `ebe0933d7`;
  no source commit landed in it.
  Suite start (`~/temp/agent/mimo-trial/suite-start.log`):
  1,544 [PASS] and 10 [FAIL] lines,
  triaged to three groups.
  Three lines are the B126 case,
  its suite and the file's root suite.
  Four `sampleBenchSlices` cases and their suite line failed on the fresh checkout only
  because the cli-git wrapper's build was missing there
  (`Cannot find module .../git-policy-cli/dist/final/node/index.mjs` behind a fixture `git init`);
  `mise run //package/git-policy/cli:build` fixed it
  and all four pass (`~/temp/agent/mimo-trial/retry-named.log`).
  `reviewAbsoluteNaturalness` "STARTS GRACE AT HALF instead of requiring delayed final seat"
  failed in that run,
  passed in the merge check and on re-run:
  its fixture rides wall-clock timing,
  so a delayed seat landed inside grace and its rejection counted,
  which "KEEPS REJECTION that arrives inside bounded post-quorum grace" pins as correct.
  That flake is the next finding after B126,
  on the steps of "First:
  fix B126",
  before the census.
  This line lands in the trial-log commit that follows `ebe0933d7`.
  Next:
  "First:
  fix B126".

- 2026-10-03,
  17:18 UTC:
  merge of main (at `ea53b956a`) into `translation-repair-rebased` landed with commit `28303c42a`
  (`chore(*): merge main into translation-repair-rebased`):
  `AGENTS.md` taken as main's version in full by the owner's direction,
  `CLAUDE.md`,
  `mise.toml`
  and `package/config/pnpr/config.yaml` regenerated by file-enforcer,
  `pnpm-lock.yaml` regenerated with `pnpm install --lockfile-only`.
  Counts on the merged tree:
  1,545 [PASS] and 3 [FAIL]
  (the B126 case,
  its suite and the file's root suite;
  log `~/temp/agent/mimo-trial/merge-check.log`).
  The trial branch `translation-repair-mimo-trial` is cut from that commit
  and lives in its own checkout `/var/home/user/worktrees/translation-repair-mimo-trial`
  (`git worktree add --no-track`),
  after cli-git policy `branch-worktree-only` rejected `git switch --create`
  and the owner chose the guard's own worktree form over `--no-enforce-worktree-branch`,
  noting the handover's worktree pin was wrong.
  This line lands in the trial-log commit that follows `28303c42a`.
  Next:
  "Setup,
  once" continues (suite start),
  then "First:
  fix B126".

- 2026-10-03,
  16:20 UTC:
  handover written by Claude Code in a cloud session;
  no trial commit yet.
  Next:
  "Setup,
  once",
  then "First:
  fix B126".

## Decisions for the owner to review

Each entry is a choice already made and acted on,
never an open question:
the options,
the evidence,
the one taken,
why,
and its commit.

- 2026-10-04,
  the `gitOutput` catch's rethrow (`33fc7a459`):
  options were keeping the rethrow,
  with the T8 stretch staying open on it,
  or wrapping every throwable as the sibling `readCorpusBytes` catch
  already does.
  Evidence:
  nano-spawn funnels every throwable through its `getErrorInstance`
  and wraps it as `SubprocessError`
  (`source/result.js`,
  `source/spawn.js`;
  its one raw escape needs `options.input`,
  which the corpus call never sends),
  and a probe on the built package delivered a `CorpusReadError` of kind
  `other` for a NUL-byte `gitPath`,
  an empty one and a missing binary
  (`~/temp/agent/mimo-trial/corpus-rethrow-probe.mjs`).
  Taken:
  the wrap,
  since the `kind` field still distinguishes `missing-object` from
  `other`,
  a catcher reads one failure class either way,
  and T8 has no fourth outcome for a stretch.
  The owner may veto and restore the rethrow,
  which returns the stretch to T8's open count.
