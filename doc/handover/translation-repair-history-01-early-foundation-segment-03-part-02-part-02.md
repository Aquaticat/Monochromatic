# Translation repair history: segment 3.2, part 02

Part 02 of [Translation repair history: segment 3.2](translation-repair-history-01-early-foundation-segment-03-part-02.md),
whose index lists every part in order.

## Deliberately open

- Output consumer (wiki PRs,
  files,
  UI):
  deferred until after the pure fn proves itself.
- User possesses the policy files;
  the system must function without them.
- Benchmark focuses on memorial texts first (user decision).
- Unrelated text pairs (user probe:
  zh cat story vs "Meow meow meow"):
  `accuracy/non-translation` is in the taxonomy (commit `d4dabc283`) and
  the critic prompt reports one critical instance for wholly unrelated
  pairs.
  Verified live on the invented pair:
  GLM-5.2,
  gpt-oss-120b,
  and
  Qwen3.6-27B each emitted exactly one accuracy/non-translation/critical
  issue.
  Qwen's failed to ANCHOR (degenerate repetitive gibberish makes
  every short quote ambiguous),
  so the future rollup must treat
  non-translation as a document-level verdict where wire-level ensemble
  agreement suffices and anchoring is best-effort;
  ensemble-agreed
  critical non-translation blocks repair and returns the input unchanged.
- Model-driven input fixing (user:
  parse phase may "optionally" use LLMs to
  fix source and translations before continuing):
  deferred by evidence,
  not
  rejected.
  Deterministic tolerance (comment masking + markdown fallback)
  covers every document in the pinned corpus with zero fallbacks needed;
  `RepairDocument.parseFindings` is the designed trigger seam.
  Build the
  LLM fixer only when a corpus commit produces a document whose findings
  show real damage (an `mdx-downgraded` finding is the signal to watch),
  and gate any fixed text on a strict re-parse plus a content-preservation
  check before it replaces the input.
- Document chunking (zh-to-en aligned sections) LANDED
  (commit `2f9b2c8af`:
  `chunk-document.ts`,
  `alignDocumentSections`
  pairing mirrored structures by index,
  degrading to proportional
  monotone merging with findings,
  never refusing).
  Motivation stands:
  run 4 proved whole large documents exceed the 65_536-token output
  ceiling on thinking models,
  and small units complete in ~30 s.
- Band FILTERING in `corpus-pass.ts` (skip bands already at the ~10 quota so no
  run spends ~75 min settling a band that is already full):
  REJECTED as
  redundant,
  not as wrong in intent.
  `rankWithinBands` already offsets each
  band's rank by `countSettledPerBand`,
  so a band that is ahead is
  automatically deprioritized by exactly its lead.
  Verified against live
  counts at 7 small / 8 medium / 7 large:
  medium's first pending entry ranks 8
  while small's and large's rank 7,
  so medium cannot be started until the other
  two catch up.
  Confirmed in flight rather than only on paper,
  since run 017
  picked MTF_0615 (5229 B,
  LARGE),
  a band that is behind.
  Adding a filter on
  top would be a second mechanism for one invariant and a place for the two to
  disagree.
  The one path that DOES bypass the offset is resume-first,
  which is
  intended:
  finishing a cached large document beats starting a fresh anything.
- Grading sheet CLOBBER HAZARD found and fixed (2026-07-27,
  commit
  `e26d13ff5`),
  before it fired.
  `draw-sample.ts` wrote the gate sheet to a
  fixed `grading-sheet.md`,
  which is the same file the user graded round one in,
  IN PLACE.
  24 of those 50 items carry free-text rationale
  (`rg --count-matches '^### \d+\. grade: [YN]\S'`),
  and `gate-verdict.md`
  preserves only the Y/N tally,
  not the reasoning that drove fixes A-F.
  So
  drawing round two would have destroyed the evidence base for round one's
  conclusions,
  through a routine command,
  with no prompt.
  Round one's graded sheet is archived at
  `node_modules/.monochromatic/translation-repair-runs/grading-sheet-round-one-graded.md`.
  Still OUTSIDE git and still never committable:
  it quotes UNLICENSED corpus.
  The fix is two independent defenses in `corpus-run/sheet-path.ts`,
  because
  either alone still loses data.
  Sheets are named after the draw seed
  (`grading-sheet-<seed>.md`),
  so two rounds cannot target one path;
  and a
  `--final` draw throws `GradedSheetExistsError` when its target exists,
  so a
  repeated draw inside ONE round cannot clobber grading already done.
  Preliminary sheets are deliberately exempt and stay redrawable as the pool
  grows.
  Round two therefore writes
  `grading-sheet-milestone-three-precision-round-two.md` and can never reach
  round one's file.
  Verified at the CLI boundary on a throwaway runs dir,
  not by reading the code:
  first `--final` draw writes,
  second refuses with the sheet intact,
  two
  preliminary draws both succeed.
  GENERAL LESSON,
  worth applying past this one file:
  an output path that is a
  CONSTANT is a hazard whenever a human writes into the artifact,
  because the
  file silently changes owner from the program to the person.
  Look for the same
  shape anywhere else a runner writes a fixed name a human then edits.
- RUNS DIR SITS INSIDE THE `rm -rf` BLAST RADIUS (found 2026-07-27,
  mitigated,
  root cause still open).
  `resolveRunsDir` defaults under
  `node_modules/.monochromatic/translation-repair-runs/`,
  and the repo ships
  `//:fix:reinstall`,
  whose body is literally
  `rmSync('node_modules', { recursive: true, force: true })` followed by
  `pnpm install`.
  One invocation of a task described only as "Clean reinstall to
  work around registry or resolution issues" destroys round one's graded sheet
  and its free-text rationale,
  `gate-verdict.md`,
  every settled artifact,
  the
  attempts map,
  and the slice cache.
  "Outside git" was the actual requirement;
  "inside node_modules" was never implied by it.
  MITIGATION IN PLACE:
  the whole runs dir (12 MB) is copied to
  `${HOME}/.local/share/monochromatic/translation-repair-runs-backup`,
  mode 700,
  outside the repo entirely.
  Refresh it after any batch of entries settles.
  It
  quotes UNLICENSED corpus,
  so it is never committable,
  wherever it lives.
  ROOT CAUSE DELIBERATELY NOT FIXED YET:
  changing the `resolveRunsDir` default
  mid-accumulation would point the next launch at an empty directory,
  which
  reads as zero settled entries and silently re-runs the entire corpus.
  Relocate
  only between runs,
  by moving the directory AND setting
  `TRANSLATION_REPAIR_RUNS_DIR` together,
  never by editing the default alone.
- `--final` IS NOW ONE-SHOT by design,
  so do not fire it early.
  The first
  `--final` draw freezes round two's sheet,
  and a later draw refuses even if
  more entries have settled since.
  Use the preliminary path for every validation
  draw and run `--final` exactly once,
  after accumulation is done.
  When the
  refusal appears,
  the correct response is to rename the existing sheet
  deliberately,
  never to reach for a force-shaped workaround:
  the refusal is the
  feature.
- COHORT-SPLIT PROMISE RETRACTED (2026-07-27,
  `run-config.ts`).
  The stamp's
  docblock claimed precision could be split by call-timing cohort at analysis
  time,
  making the mixed pool "a number rather than an unknown".
  It cannot.
  At
  the coverage bar the pool is about 30 entries split near evenly,
  so 50 graded
  items give roughly 25 per cohort and a standard error near 8 points;
  the
  binding constraint is human grading effort,
  not compute,
  so the several
  hundred per cohort that would resolve a meaningful difference is unavailable.
  Report the mixed pool QUALITATIVELY alongside the panel-coverage sub-rates.
  Note this weakens the stated basis of the user's twice-made "keep the settled
  entries" decision,
  so it is surfaced rather than quietly adjusted;
  it does not
  change what to do,
  since discarding the compute was rejected both times.
- UNGRADED OBSERVATION,
  first quantitative sign fixes A-F changed behavior at
  all:
  accepted issues per entry fell from 99 (round one,
  2871 over 29 entries)
  to 75 (round two,
  1731 over 23),
  a 24 percent drop,
  in the direction the fixes
  intended.
  NOT EVIDENCE OF PRECISION and must not be recorded as such:
  nothing
  here is graded,
  fewer accepted issues is equally consistent with the fixes
  suppressing true positives,
  and the two pools cover different entries.
  It
  earns a mention only because it is measurable now and the graded answer is not.
- HEADLINE PRECISION IS BAND-BALANCED,
  NOT POOL-WEIGHTED (found 2026-07-27,
  before the round-two draw).
  `drawStratifiedSample` splits the 50 slots about
  evenly across bands (round one drew 17 small / 17 medium / 16 large),
  but the
  bands do NOT hold even shares of the accepted-issue pool.
  Measured at 25
  settled entries:
  small 175 accepted (9.2 percent),
  medium 667 (34.9),
  large
  1070 (56.0).
  So a small-band issue is roughly 3.6 times likelier to be sampled
  than its share of the population,
  and the raw sample proportion estimates the
  AVERAGE OF PER-BAND PRECISIONS rather than the precision of the accepted-issue
  population.
  Size of the discrepancy,
  using round one's per-band precisions (small 0.60,
  medium 0.57,
  large 0.73) against round two's pool shares:
  band-balanced 0.635,
  pool-weighted 0.665.
  Round one failed at 0.56 to 0.68 under every reading,
  so
  the distinction could not change that verdict.
  Against a 0.9 bar it can.
  RESOLUTION,
  adopted because it costs nothing and sacrifices nothing:
  report
  BOTH numbers from the SAME 50 grades.
  Band-balanced stays the headline,
  since
  that is what round one reported and comparability with the baseline is the
  whole point of round two.
  Pool-weighted is reported beside it,
  because "accepted-issue
  precision" read plainly means "of the issues the pipeline accepts,
  how many
  are real",
  which is the pool-weighted quantity.
  No extra grading is needed:
  per-band counts plus pool shares give both.
  The only genuine decision is which number faces the bar IF they straddle 0.9,
  and that is the user's call.
  Do not pre-empt it;
  if both clear or both fail,
  it never needs asking.
  Related caution:
  round one's verdict called precision "roughly flat across
  bands" on 0.60 / 0.57 / 0.73.
  At 15 graded items per band the standard error
  is about 0.12,
  so those are not distinguishable,
  but "flat" overstates what
  n=15 per band can show.
  The band comparison is underpowered in the same way
  the timing-cohort split is;
  say "not distinguishable",
  never "flat".
- DETACHED LAUNCH CONFIRMED AS THE FIX for the run kills (2026-07-27).
  Run 017,
  launched with `setsid nohup mise run ... > log 2>&1 < /dev/null & disown`,
  ran
  4.79 hours and exited NORMALLY on its own soft budget
  (`DONE processed=4 of pending=71; artifacts=25/92 elapsed=17247028ms`).
  The two
  runs before it,
  launched as harness background tasks,
  were killed by signal at
  2h38m and about 2 minutes with the signature
  `sh exited with non-zero status: no exit status` and no OOM evidence.
  A run
  that survives 4.79 hours in its own session,
  after two died in the harness
  session at unrelated ages,
  is what the process-group explanation predicts.
  Keep launching this way;
  do NOT chain a launch with a commit in one call,
  which is what made an earlier kill look like a failed commit task.
- NIGHT81473140 (12301 B,
  LARGE,
  the biggest entry attempted so far) hit the
  90 min per-entry hard cap in run 017 with 26 slices cached,
  so it did not
  settle.
  Recoverable exactly as Dethelly and Futajuhuacha were:
  resume-first
  ordering picks it up next run and slice progress is monotone.
  It needs ONE further run,
  not several,
  and that is measured rather than
  inferred from its size.
  Run 017 logged the entry as `10 chunk pairs, 41
  slices`,
  and it finished 26 of those 41 from a COLD start inside the 90 min
  cap,
  so 3.46 min/slice.
  The 15 remaining come to about 52 minutes,
  well inside
  one cap.
  General lesson:
  the pipeline prints its slice count when an entry
  starts,
  so "how many more runs does this need" is a log lookup and a division,
  never a guess from byte size.
  An earlier draft of this note guessed from the
  12 KB figure and got it wrong.
- BAND ORDERING IS COMPUTED ONCE PER RUN,
  so a long run can overshoot a band.
  `rankWithinBands` and `resumableIds` are both evaluated at run START and the
  `pending` array is sorted once;
  nothing re-ranks as entries settle DURING the
  run.
  Observed in run 018,
  which started at 8 small / 9 medium / 8 large and
  settled five entries:
  by the time it picked MocaKawai (medium),
  the live
  counts were 10 / 10 / 9 and a large entry should have led,
  but the frozen
  ordering still had medium ahead.
  Result was 10 / 11 / 9 instead of 10 / 10
  / 10.
  Same cause,
  second symptom:
  an entry that a run leaves partly cached does NOT
  resume later in that SAME run,
  because `resumableIds` predates its cache
  directory.
  Susiethegamer aborted at the hard cap with 12 of 17 slices,
  and run
  018 went on to other entries rather than returning to it.
  NOT WORTH FIXING for this milestone,
  and the reason is not laziness:
  the
  ordering self-corrects on the next launch,
  both symptoms cost at most one
  entry of drift,
  and re-ranking mid-loop would make the processing order depend
  on completion times,
  which is a new nondeterminism in the thing that decides
  what gets measured.
  Prefer the stale-but-deterministic order.
  Revisit only if
  runs get long enough that intra-run drift exceeds one entry per band.
- COVERAGE BAR REACHED 2026-07-27:
  31 settled entries,
  10 small / 11 medium /
  10 large,
  against the stratified ~10/10/10 target.
  Accumulation was then
  STOPPED DELIBERATELY (run 019 killed mid-entry) so the pool is fixed and the
  sheet's provenance is unambiguous rather than drifting under the draw.
  Accepted-issue pool at the draw:
  2257 over 31 entries.
  Per band:
  small 238
  (10.5 percent),
  medium 745 (33.0),
  large 1274 (56.4).
  ROUND-TWO SHEET DRAWN to
  `node_modules/.monochromatic/translation-repair-runs/grading-sheet-milestone-three-precision-round-two.md`,
  50 items,
  17 small / 17 medium / 16 large,
  seed
  `milestone-three-precision-round-two`,
  corpus pin unchanged.
  Validated before handing over:
  the sheet spreads across 30 of the 31 settled
  entries,
  so no single entry dominates it,
  and its 50 (entry,
  claim) pairs have
  ZERO overlap with round one's graded 50.
  That check matters because scoring a
  round on items already used to calibrate it would read better than the
  pipeline is;
  the seed rule alone was not treated as proof.
- SLICE-RATE PROJECTION CORRECTED.
  The rule recorded earlier ("a log lookup and
  a division") is right about WHERE the numbers come from and wrong about how
  far one rate projects.
  Susiethegamer had 5 of 17 slices left at a cold-portion
  rate of 7.5 min/slice,
  so 37 minutes was projected;
  it took 80.9.
  The resume's
  five slice cycles ran 7.2,
  8.7,
  about 28,
  12.9,
  and 14.6 minutes,
  so per-slice
  cost varies roughly fourfold WITHIN one entry.
  NIGHT81473140's projection
  landed (52 projected,
  50.6 actual) only because 15 remaining slices averaged
  that variance out.
  So:
  project from remaining slices only when MANY remain,
  and treat a
  small-remainder estimate as an order of magnitude,
  never a schedule.
  Same
  small-sample lesson as the timing cohorts and the panel-coverage sub-rates,
  arriving for the third time in one session through a different door.
  One unexplained observation left in place rather than explained away:
  between
  the panel stage at 16:12:01Z and the next critic stage at 16:40:20Z there is a
  28 minute gap with no editor or checker line logged,
  though the panel had
  issued 11 issues.
  Cause not established;
  do not assume it is provider latency.
- ROUND-TWO GATE VERDICT:
  FAILED at 0.74 / 0.787 / 0.80 (strict / partials
  excluded / ceiling),
  against round one's 0.56 / 0.64 / 0.68.
  37 clear Y,
  10
  clear N,
  3 ungradable of 50.
  Bar needs 45 of 50.
  Full analysis in
  `node_modules/.monochromatic/translation-repair-runs/gate-verdict-round-two.md`
  (outside git,
  quotes UNLICENSED corpus).
  Fixes A-F did real work (+0.18 strict,
  clear false positives 16 -> 10) and the
  direction is right,
  but the gate is not close.
  The band-balanced (0.788) and pool-weighted (0.794) readings agree to within a
  point,
  so the weighting question flagged before the draw did not need the
  user's decision.
  Record that it was computed,
  not skipped.
- NATURALNESS GAP CONFIRMED,
  both architecturally and empirically.
  The user
  suspected paragraph-level rewriting for English naturalness was not
  implemented;
  it is not.
  Architecturally:
  repairs are ISSUE-DRIVEN.
  `edit-prompt.ts` already tells the
  editor that "Emotional completeness and naturalness outrank word-for-word
  correspondence" and may "recast wording,
  sentence boundaries,
  and clause order
  freely",
  but the editor only ever touches a region an accepted issue already
  covers.
  A paragraph that is accurate,
  complete,
  and grammatical but stilted is
  never visited,
  because nothing generates an issue for it.
  Empirically,
  over all 2257 accepted issues:
  accuracy 77.4 percent (omission
  31.6,
  mistranslation 23.3,
  addition 21.8),
  style 13.6 (emotional-flattening
  8.9,
  awkward-phrasing 4.5,
  register 0.1),
  fluency 4.0,
  terminology 3.0,
  policy 1.4.
  Paragraph-level naturalness work is 4.6 percent of output.
  The grading confirms the harm is active,
  not merely absent:
  3 of the 10 clear
  false positives are literalism FIGHTING fluency (poetry judged literally,
  总是 forced to "always",
  conjunctions counted as additions when they are what
  makes the English read well).
- SYNTHETIC ROSTER CHANGED UNDER US (measured 2026-08-05 against the live
  `GET https://api.synthetic.new/openai/v1/models`,
  not from memory).
  TWO OF THE SEVEN ROSTER MODELS ARE GONE:
  `hf:moonshotai/Kimi-K2.7-Code` and
  `hf:MiniMaxAI/MiniMax-M3` both return HTTP 404
  `"... is no longer supported. Try using a different model, like
  hf:zai-org/GLM-5.2"`.
  Both were live during run 017,
  so this landed in the
  days since.
  404 is NOT in `transient-retry.ts`'s retry set (408,
  429,
  500,
  502,
  503,
  504),
  so each is a non-transient throw:
  the stage loses that voice immediately with
  no retry and the run continues DEGRADED.
  Unchanged,
  every stage would now run
  at 5 of 7 voices,
  permanently and quietly.
  THE ALIAS TRAP,
  which is the part worth reading twice:
  the endpoint lists 10
  ids but only SIX are distinct models.
  `syn:large:text` is GLM-5.2,
  `syn:large:vision` is Kimi-K3,
  `syn:small:text` is GLM-4.7-Flash,
  and
  `syn:small:vision` is Qwen3.6-27B,
  each confirmed by the `hugging_face_id`
  field.
  Restoring a 7-voice panel by adding a `syn:` alias would put the SAME
  model on the panel twice,
  and the voting stages would count one model's
  opinion as two independent confirmations.
  Never select roster members by id
  alone;
  dedupe on `hugging_face_id`.
  Distinct models now available,
  with context lengths:
  GLM-5.2 (524288),
  Kimi-K3 (524288,
  NEW,
  text+image),
  Qwen3.6-27B (262144,
  text+image),
  Nemotron-3-Super-120B (262144),
  GLM-4.7-Flash (196608),
  gpt-oss-120b (131072).
  So the panel can hold at most SIX independent voices,
  down from seven,
  unless
  Kimi-K3 counts as the replacement for Kimi-K2.7-Code and MiniMax-M3 goes
  unreplaced.
  Quorum thresholds and cross-round comparability both depend on
  this;
  decide it explicitly rather than letting the roster silently shrink.
- NEW USER INSTRUCTION (2026-08-05):
  before handing over a grading sheet,
  pre-resolve the unambiguous Y/N items and hand over only genuinely contested
  ones.
  This revives task 31 (judge crosscheck) as the mechanism.
  MUST be calibrated before it is trusted:
  if the agent resolves items,
  the
  reported precision partly reflects the agent's judgement rather than the
  user's,
  which is the measurement the gate exists to protect.
  The user has now
  graded 100 items across two rounds,
  which is exactly the calibration set.
  Measure agreement against those 100 BEFORE pre-resolving anything,
  and report
  the agreement rate alongside the next sheet.
