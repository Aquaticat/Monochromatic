# Translation repair history: 2026-08-05 to 2026-08-07

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Session 2026-08-05/06: round two graded, roster repaired, branch rebased

- ROUND TWO FAILED at 0.740 / 0.787 / 0.800 (strict / partials excluded /
  ceiling) against the 0.9 bar:
  37 clear Y,
  10 clear N,
  3 ungradable of 50.
  Round one was 0.56 / 0.64 / 0.68,
  so fixes A-F moved precision a long way and
  halved clear false positives (16 -> 10),
  and the gate still is not close.
  Band-balanced 0.788 and pool-weighted 0.794 agree within a point,
  so the
  weighting question raised before the draw did not need the user's decision.
  Full analysis:
  `node_modules/.monochromatic/translation-repair-runs/gate-verdict-round-two.md`
  (outside git;
  quotes UNLICENSED corpus).
- ROOT CAUSES of the 10 false positives:
  literalism fighting fluency (3:
  poetry judged as prose,
  总是 forced to "always",
  a fluency-serving conjunction
  counted as an addition),
  anchoring/alignment (3),
  context insufficiency at
  judgement (2),
  a doubted domain fact (1),
  token degeneration (1).
- PRECISION CANNOT SEE REPAIR QUALITY,
  which the grading exposed and the metric
  hides:
  4 of the 37 TRUE positives carry notes saying detection was right and
  the repair was poor ("is there a better way?").
  Those score as successes.
  Milestone four needs a repair-quality metric separate from detection
  precision;
  task 47.
- FIX H LANDED:
  the critic prompt carried non-literal translation policy and the
  adjudication prompt carried NONE of it (3 matches versus 0 for
  literal/synonym/poetry/fluency/natural).
  The panel's quoted-evidence check
  cannot catch that class,
  because such claims are accurate about the text and
  wrong about what counts as a defect.
  Directly targets FPs 26,
  37, 42.
- HOUSE POLICY NOW REACHES THE MODELS (`house-policy.ts`,
  spliced into the critic
  and adjudicator prompts).
  The corpus documents its editorial rules in
  `CODE_OF_CONDUCT.md` (编写原则) in the one-among-us/data repo,
  NOT in
  `CONTRIBUTING.md`,
  and no stage had ever been told them.
  The consequential rule:
  when a death was by suicide the method is deliberately
  vague,
  and drug names and dosages are deliberately absent.
  A page obeying that
  rule looks like `accuracy/omission` to an uninformed critic,
  and the editor
  then RESTORES the detail the rule exists to remove,
  so acting on the finding
  makes the shipped translation violate the corpus's reader-protection policy.
  That is worse than a false positive.
  Also carried:
  third person,
  neutral pronouns preserved rather than resolved to
  he/she,
  and a memorial tone rule rejecting both overwrought and clinical
  writing.
  `house-policy.ts` PARAPHRASES rather than copies,
  because the corpus
  repo is unlicensed;
  never paste from it.
  Open interaction:
  the recall benchmark treats every omission as a defect,
  so
  policy-protected omissions and seeded omissions need reconciling.
- SYNTHETIC ROSTER REPAIRED.
  `Kimi-K2.7-Code` and `MiniMax-M3` now answer HTTP
  404 "no longer supported",
  and 404 is not in the transient retry set,
  so every
  stage was about to lose two of seven voices silently with no retry.
  THE ALIAS TRAP:
  the models endpoint lists ten ids but only SIX are distinct.
  `syn:large:text` is GLM-5.2,
  `syn:large:vision` is Kimi-K3,
  `syn:small:text`
  is GLM-4.7-Flash,
  `syn:small:vision` is Qwen3.6-27B,
  each stated by the
  endpoint's own `hugging_face_id`.
  Restoring a seventh voice with an alias
  would seat one model twice on a voting panel and count one opinion as two
  confirmations.
  Dedupe roster edits on `hugging_face_id`,
  never on id.
  Kimi-K3 now EDITS (user:
  much stronger than anything else offered),
  and
  checkers exclude the editor,
  ending the old GLM-5.2 self-check.
- QUORUM is now `voices >= ceil(roster / 2)` (user decision).
  The old "strictly
  more than half" demanded more than a majority on EVEN rosters:
  at six it
  wanted 4,
  so a stage sitting at exactly 3 burned every retry round.
  Odd
  rosters unchanged.
  `minBallotWeight` stays the absolute 3,
  so the share of the
  panel needed for any decision rose from 3-of-7 to 3-of-6;
  user accepted that
  explicitly ("50% is okay here").
- PER-MODEL CONCURRENCY MEASURED,
  and it does not help:
  throughput is flat at
  0.32 to 0.42 req/s across concurrency 1,
  2,
  4,
  and 8,
  while wall time scales
  nearly linearly (3.1 s at n=1 to 19.0 s at n=8,
  against 24.8 s if perfectly
  serial),
  with zero 429s.
  The provider QUEUES per model rather than throttling,
  so `perModelConcurrency: 1` is correct and the available parallelism is across
  models,
  which the pipeline already uses.
- RECALL IS FINALLY MEASURABLE:
  `repair-benchmark.ts` had no entrypoint,
  so
  recall was unmeasurable in practice however complete the library was.
  `corpus-run/recall-benchmark.ts` plus a mise task plants known omissions into
  clean translations and grades restoration against its own deletions,
  giving a
  denominator of defects that certainly exist rather than defects the pipeline
  chose to report.
  Nine entries,
  three per band,
  27 seeds,
  verified at zero
  quota through `--plan`.
- ENSEMBLE WORK STARTED.
  `candidate-select.ts` is the shared propose-and-select
  component,
  needed because free-text candidates cannot be voted on the way
  claims are:
  two editors fixing one defect phrase it differently,
  so there is
  nothing to match.
  Judges compare ANONYMIZED candidates.
  Two invariants live in
  the component rather than in callers:
  a model never judges a set containing
  its own candidate,
  and a tie or an empty judge roster DECLINES to the caller's
  fallback,
  so the conservative outcome is the default whenever the ensemble
  cannot agree.
  `editor-ensemble.ts` judges at BOTH granularities (user decision):
  per
  envelope so the best fix for one issue can win even when its author botched
  the rest,
  and per chunk because coherence across envelopes is only visible
  whole.
  Per-envelope winners are assembled into a COMPOSITE that must then WIN
  at chunk level rather than being adopted by construction,
  since a composite is
  text no model wrote or read as a whole.
  A chunk-level decline falls back to a REPAIRED patch,
  never to the original:
  discarding fixes the panel already ruled real would turn a wording
  disagreement into a recall loss.
- ENSEMBLE WIRED (task 45 COMPLETE,
  commits `7cce752d4`,
  `1527e4929`,
  `688b96122`).
  `RepairModels.editorModelId` is gone;
  the roster now carries
  `editorModelIds` plus an explicit `judgeModelIds`,
  and `runEditorStage` lives
  in `repair-editor-stage.ts` with the bookkeeping split into
  `editor-candidates.ts`.
  `run-config.ts` runs TWO editors,
  Kimi-K3 and GLM-5.2,
  with the whole roster judging and the checker set reduced to the three models
  that never edit.
  Two editors rather than three deliberately:
  every editor is barred from
  judging its own chunk,
  so each added editor costs a judge as well as its own
  calls.
  At two,
  four judges remain;
  at three,
  only three.
  A composite is text no model wrote as a whole,
  so candidates carry a
  `CandidateProducer` union (`model`,
  or `composite` with contributors) rather
  than one model id,
  and collapsing duplicate candidates UNIONS their stakes.
  Without that union a real self-judging leak existed:
  if the composite carried
  model B's operation while model A's whole-chunk text matched it exactly,
  keeping either candidate alone left the other free to judge text it wrote.
- FOUR WAYS ONE MODEL COULD STILL DECIDE,
  all closed in `1527e4929`,
  three of
  them found by sol and missed by both the advisor and me:
  A plurality of ONE used to win.
  With judges lost or abstaining a single ballot
  named the winner,
  which is one model controlling the stage.
  Winners now need
  `MIN_SELECTION_VOTES` (2),
  and `assertJudgeableEditorRoster` refuses a roster
  that cannot seat that many disinterested judges,
  plus repeated or empty editor
  rosters.
  Nothing stopped an editor from also CHECKING.
  The judge roster is filtered at
  runtime so that overlap is caught,
  but `checkerModelIds` was used as given.
  `assertCheckerIndependence` refuses it at chunk entry.
  Per-envelope judges were asked whether a replacement fits its surroundings in
  register and tense while being shown only the replacement and the Chinese
  source.
  Ballots now carry the passage being replaced and a bounded window of
  the translation around it (`ENVELOPE_CONTEXT_CHARS`).
  The candidate fence was a fixed `=====`,
  which ordinary prose contains:
  a
  setext heading underline lets a candidate close its own block and have the
  rest read as instructions (AGENTS.md SYB/STB).
  The fence is now chosen against
  everything it encloses,
  always longer than any run inside.
- DECLINE IS TWO DIFFERENT VERDICTS (`688b96122`),
  a refinement neither reviewer
  proposed.
  `SelectionDisposition` splits `indecision` (tie,
  or leader short of
  the vote minimum:
  judges failed to RANK,
  and nothing was said against any
  candidate) from `rejection` (every judge answered "none of these",
  or no
  disinterested judge could be seated).
  Chunk selection ships the strongest
  repair on indecision and nothing on rejection.
  Sol argued decline should ALWAYS fall back to unchanged.
  Rejected on evidence:
  `selectRepairCandidate` in `repair-chunk.ts` already makes any repair beat the
  untouched text on checker measurements before it ships,
  so the conservative
  gate exists one stage later and implementing it twice only costs recall.
  Sol's
  specific objection,
  that the composite could ship precisely when it failed to
  win,
  was aimed at a plan where the fallback WAS the composite;
  the built
  fallback is the strongest EDITOR patch and the composite is never it.
- TWO SHORTCUTS KEPT over sol's objection,
  with reasons recorded so a future
  session does not "restore" the expensive behavior:
  a sole chunk candidate
  ships unjudged because after dedupe it means every editor AND the composite
  wrote identical text,
  and `pickFallbackPatch` over identical patches returns
  that same text,
  so the ballot cannot change the output.
  A sole per-envelope
  proposal is adopted unjudged because that operation also sits inside its
  author's whole-chunk candidate,
  which IS judged at chunk level.
- HOUSE POLICY AND THE RECALL BENCHMARK CONTRADICT EACH OTHER,
  and the
  contradiction is structural rather than a bug in either (task 49,
  still OPEN
  because it is the user's call).
  `HOUSE_POLICY_BLOCK` tells critics and the panel,
  verbatim:
  "Never report that
  as an omission,
  and never restore the detail,
  even when the ORIGINAL states it
  plainly",
  for suicide method and for drug names and dosages.
  `deriveOmissionSeeds` plants seeds by DELETING the longest sentences from the
  clean English translation,
  and the benchmark scores whether the pipeline
  restored them.
  When a deleted sentence's Chinese counterpart carries protected
  content,
  the policy instructs the pipeline not to restore it and the benchmark
  records a recall MISS.
  Correct behavior scores as failure.
  The ground truths genuinely differ,
  and neither is wrong.
  The benchmark's is
  "this sentence was in the published English,
  so it belongs",
  which is sound
  because the community wrote that English under its own rules.
  The critic
  cannot see that:
  it sees only the mutilated English and the Chinese,
  so
  Chinese-only sensitive detail reads to it as a deliberate omission.
  MAGNITUDE IS UNMEASURED.
  Establishing it means reading corpus content to
  classify 27 seeded sentences,
  which is possible (the clone is readable) but
  has not been done,
  so do not describe the effect as small or large.
  RUN 001 IS UNAFFECTED,
  verified rather than assumed:
  the run's own START line
  records `tip=2cf7fd453bb3a20b889b9c01d5640dd7fe81e858`,
  committed 23:19:51,
  and the process began 23:20:01,
  while `house-policy.ts` and its splice into
  the critic prompt landed in `5daf7b853` at 23:42:53,
  23 minutes later.
  The
  process resolved its module graph at startup and has no runtime dynamic
  imports,
  so run 001 measures a policy-free pipeline.
  That makes run 001 a clean POLICY-FREE RECALL BASELINE,
  and it also means
  round-three recall will not be comparable to it on this axis.
  RESOLVED by user decision 2026-08-06 ("I'll go with your recommendation"):
  ATTRIBUTE rather than exclude,
  shipped in `363d4649e`.
  `gradeSeedDetection` returns a `SeedDetectionVerdict` instead of a boolean:
  `accepted`,
  `declined-protective` (the panel landed `source-defect` at the
  seed's region),
  `declined-other`,
  or `undetected`.
  The scorecard reports
  `policyDeclinedSeeds` and `seedDetectionRateExcludingPolicy` BESIDE the raw
  `seedDetectionRate` rather than replacing it,
  because both numbers are true
  and a verdict has to say which it cites.
  Rejected alternatives,
  with reasons:
  excluding protected sentences from
  seeding needs a classifier over suicide and medication topics whose misfires
  are their own harm;
  running the benchmark with the policy disabled would
  measure a pipeline that is not the one shipping.
  Attribution also costs no
  extra model calls.
- NATURALNESS LANE,
  DETERMINISTIC HALF BUILT (task 46,
  still in progress).
  `refine-eligibility.ts` (`84e8fc380`) decides which paragraphs of a REPAIRED
  slice the lane may touch.
  It is named a FILTER,
  never a verse detector,
  because nothing in the parsed model identifies poetry:
  an mdast `break`,
  a
  soft source wrap inside node text,
  and an HTML or MDX break element are three
  different things and none means verse.
  It admits only single-line prose,
  so
  single-line poetry still passes and wrapped prose is still skipped.
  It reads the repaired slice,
  never the original target:
  accuracy edits shift
  offsets and can change block structure.
  Every block gets a verdict and skips carry their reason,
  so lane yield is
  explainable.
  A degraded parse disqualifies the WHOLE slice,
  since a downgrade
  or a masked region changes how every block was read.
  `protected-atom.ts` plus `inspect-paragraph.ts` (`b87753ce9`) are the
  structural gate.
  Atoms compare as an ORDERED SEQUENCE:
  a multiset would pass
  "3 cats and 5 dogs" becoming "5 cats and 3 dogs",
  two links exchanging
  destinations,
  and two names exchanging positions,
  all of which are now tests.
  TWO DEFECTS FOUND BY RUNNING THE CODE,
  not by reading it,
  both worth keeping
  in mind because both were silent:
  A paragraph parsed in isolation does not resolve references.
  GFM only yields
  a `footnoteReference` when a matching definition is in scope,
  so `[^1]` came
  back as literal text:
  the digit was protected as a number while the marker
  around it was not,
  and a rewrite turning `[^1]` into `1` would have passed.
  Fixed by parsing twice,
  alone for structure and with the document definitions
  for references.
  The first version walked code points correctly but stopped its foreign ranges
  at U+FAFF,
  so a given name in Han Extension B produced NO atom and could be
  deleted silently.
  That is the character most likely to be a person's name.
  Both now have regression tests.
- RECALL RUN 001 LANDED 2026-08-06,
  and its DETECTION number was invalid until
  `6bb299773`.
  Raw scorecard:
  `dispatched=7 coverage=0.778 planted=21 detected=8 detectionRate=0.381`
  `judged=21 restored=19 partial=1 strict=0.905 lenient=0.952`.
  The two halves contradict each other,
  which is what exposed the bug:
  the
  pipeline only edits inside envelopes cut from accepted issues,
  so restoring 19
  seeds requires accepted issues at their regions,
  while detection claimed 8.
  CAUSE:
  `gradeSeedDetection` indexed `alignment.pairs` with
  `record.chunkIndex`,
  which is a global SLICE index from `subdivideChunkPair`,
  not a pair index.
  Past the pair count it read nothing and called every issue
  there absent;
  within it,
  it added a pair start offset to a slice-local span
  offset.
  Detection collapsed toward counting only seeds landing in the first
  slice of a pair,
  the one case where pair and slice share a start offset.
  Every dispatched entry subdivided (1 pair to 12 slices,
  6 to 12,
  1 to 7,
  2 to
  7,
  1 to 4,
  2 to 3),
  so only a 1-pair-1-slice entry was unaffected.
  WHAT SURVIVES:
  `strict=0.905` and `lenient=0.952` over 21 judged seeds are
  SOUND.
  The restoration judge compares the needle's meaning against the
  repaired text with the Chinese as anchor and never touches that mapping.
  This is also the POLICY-FREE recall baseline,
  since the run started 23 minutes
  before the house policy landed.
  WHAT DOES NOT:
  `detected=8` and `detectionRate=0.381` mean nothing.
  Do not
  quote them.
  Detection has to be re-measured on a fresh run.
  MILESTONE TWO IS UNAFFECTED,
  now CHECKED rather than assumed.
  `slice-pair.ts`
  and its wiring into the driver first appear in `88eb42add`,
  AUTHORED
  2026-07-23,
  while milestone two was declared 2026-07-18.
  Those runs had no
  subdivision,
  so pairs and slices were the same list and the mismatch could not
  bite.
  The 166/174 detection figure stands.
  Run 001 is the ONLY affected run:
  it is the only artifact anywhere under the
  runs dir carrying `seedDetection`,
  and every post-slicing pass log
  (`pass4`,
  `pass5`,
  `pass6`) records precision passes that emit no detection
  figure at all.
  DATE TRAP,
  worth remembering:
  the rebase rewrote every committer date on this
  branch to 2026-08-05T23:4x.
  Reading `%cI` says slicing landed AFTER the recall
  run started,
  which is false and would have inverted this conclusion.
  Use `%aI`
  for chronology on this branch,
  or better,
  test the tree directly.
  RUN 001 IS POLICY-FREE,
  verified by tree content rather than by timestamps:
  at the run's own recorded tip `2cf7fd453`,
  `house-policy.ts` is ABSENT and
  `critic-prompt.ts` carries zero references to `HOUSE_POLICY_BLOCK`.
  `candidate-select.ts` and `editor-ensemble.ts` are absent too,
  so it is a
  pre-ensemble baseline as well.
  `slice-pair.ts` IS present,
  which is why the
  detection mismatch applied.
  THREE INDEPENDENT SIGNALS said detection was wrong before the code was read:
  the pipeline only edits inside accepted-issue envelopes,
  so 19 restorations
  need accepted issues;
  `statusCounts` records `repaired: 7`,
  every dispatched
  entry shipping a repair;
  and the retired lexical grader put restoration at
  15/21,
  also far above 8/21.
  Two of nine entries were skipped by the 4h dispatch budget,
  giving coverage
  0.778;
  that is the coverage-per-run effect task 50 is about.
- NATURALNESS LANE COMPLETE (task 46,
  commits `b3aee385a`,
  `acc5022e5`,
  `6d695fe4e`).
  One rewriter call per slice returns paragraph rewrites,
  each
  gated on the ordered atoms,
  applied through the SAME deterministic gate the
  editor uses,
  and judged as whole slices by models that wrote none of them.
  Batched per slice rather than per paragraph for correctness as much as wall
  clock:
  paragraphs rewritten in separate calls are chosen against each other
  by nobody,
  so the slice reads as stitched fragments.
  Same problem whole-chunk
  judging solves for the editor.
  BOTH decline dispositions keep `T1`,
  unlike the editor stage,
  and the
  asymmetry is the point.
  The editor works from panel-accepted issues with
  checkers proving each one gone,
  so shipping on indecision is safe because a
  later gate still tests it.
  Nothing here claimed the text was wrong,
  and on a
  slice with no accepted issues nothing downstream re-examines a refusal.
  The lane is a SECOND per-slice phase in `repairTranslation`,
  not inside
  `repairChunk`,
  and the first phase test is the reason:
  `repairChunk` returns
  early when no claim validates,
  so text with no accuracy defect never reaches
  its bottom,
  and that text is the lane's primary target.
  A failed recheck rolls back the WHOLE slice,
  with the regressed issue named.
  The recheck is skipped when the slice had no confirmed issue,
  which is the
  common case.
  Definitions come from the assembled `T1`,
  since a paragraph may reference a
  footnote defined in another slice and an out-of-scope reference does not parse
  as a reference at all.
  `spliceSlices` was extracted because the driver now
  assembles twice.
  ON for corpus runs:
  `refinerModelIds: ['hf:moonshotai/Kimi-K3']`.
  It also
  edits,
  which nothing forbids (judges exclude producers;
  checkers exclude
  editors AND refiners),
  but a model that just wrote a paragraph judges its own
  awkwardness poorly.
  The only strong-enough model that neither edits nor checks
  is GLM-4.7-Flash,
  the one that most often loses its voice to schema mismatch,
  so strength won.
  Revisit if the `refine-` findings show little change.
  NOT YET MEASURED:
  the lane has never run against the real provider.
  Every test
  is over a scripted client,
  so the prompt's "leave it alone unless the
  improvement is clear" instruction is unvalidated against real model behavior,
  and that instruction is the main guard on a slice with no accepted issues.
- RUN CAPS RAISED ON MEASUREMENT (task 50 COMPLETE,
  commit `96e7c5ec4`).
  Recall run 001's seven entries were timed end to end from its own log:
  per-slice 3.25 min best,
  5.56 median,
  8.56 worst;
  longest entry 74.7 min for
  12 slices;
  252 min total for seven entries.
  That CONFIRMS the ~5.5 min/slice figure `corpus-pass.ts` already claimed,
  and
  shows `HARD_CAP_MINUTES = 90` was ALREADY marginal before this branch:
  at the
  worst observed rate a 12-slice entry needs 103 min and would have been cut.
  `HARD_CAP_MINUTES` 90 -> 180,
  `SOFT_BUDGET_MINUTES` 240 -> 720,
  recall `BUDGET_HOURS` 4 -> 12.
  The measured rate is PRE-ENSEMBLE:
  it predates per-envelope ballots,
  the chunk
  round,
  and the naturalness lane,
  all of which only add.
  180 is therefore a
  bound against runaway,
  not a tuned value;
  it clears 21 slices at the worst
  observed rate and 32 at the median.
  Re-derive once a post-ensemble pass has
  enough slices to project from,
  and remember the Susiethegamer lesson:
  per-slice
  cost varies about 4x WITHIN one entry,
  so do not project from a handful.
- THE ENSEMBLE'S WALL-CLOCK IS UNMEASURED,
  and this is NOT a cost question.
  An earlier version of this note called it cost and treated it as a gate on
  round three.
  Both were wrong,
  and the user corrected the first directly ("I
  don't think the cost matters").
  The plan is flat rate and quota regenerates
  faster than runs spend,
  which is the user's own directive and the reason
  stages retry lost voices freely,
  so tokens are free.
  What is actually at stake is COVERAGE PER RUN.
  `HARD_CAP_MINUTES = 90` in
  `corpus-pass.ts` aborts one entry's exchanges,
  and its own comment records the
  measured ~5.5 min/slice rate that makes 90 minutes clear about 16 slices.
  Per-envelope ballots run sequentially,
  one round per envelope with more than
  one distinct proposal,
  each now carrying source plus envelope base plus 800
  characters of context,
  so per-slice time rises and the slices an entry can
  finish falls.
  Slice-level resumability means a capped entry resumes next run,
  so the harm is entries covered per run rather than lost work.
  That makes this a CONSTANT TO SET,
  not a gate.
  Read the per-slice rate off the
  first slices of the round-three pass and raise `HARD_CAP_MINUTES` and
  `SOFT_BUDGET_MINUTES` to fit,
  rather than holding the pass for a separate
  measurement run (task 50).
  Do NOT project from a handful of slices:
  the Susiethegamer projection missed
  by 2x (projected 37 min,
  actual 80.9) because per-slice cost varies about 4x
  WITHIN one entry.
  The `editor-candidates`,
  `editor-envelope-select`,
  and `editor-chunk-select`
  findings are the instrument for how often judging actually fires.
- BRANCH REBASED onto main (main was 1228 commits ahead;
  276 branch commits
  replayed).
  Conflict surface was five files.
  `pnpm-lock.yaml` was never
  hand-resolved (LFW):
  upstream taken at each conflict and the lockfile
  regenerated afterwards by `//:prepare:pnpm:install`.
  `git-policy/cli/src/index.ts`:
  main restructured it to a barrel;
  resolution
  keeps the barrel PLUS this branch's `resolveGit` export.
  `forbidden-strings.append.txt`:
  main's restructured version kept,
  with this
  branch's unique retired-benchmark-module rename guard re-appended.
  The
  retired name is deliberately not spelled here:
  the guard exists to keep it
  out of the tree,
  and writing it in prose about the guard makes the document
  its own violation.
  `mise.toml` conflicted in the AUTOSTASH,
  not in a commit,
  and the stashed copy
  was STALE generated output that would have deleted PATH entries for packages
  main added.
  Taken from the rebased tree;
  the original is preserved in
  `stash@{0}` if it is ever wanted.
  BUILD BREAKAGE the rebase surfaced:
  main repointed `git-policy-cli/ts` at
  `authoring.ts`,
  which does not export `resolveGit`,
  so the build failed with
  MISSING_EXPORT.
  Per user decision the export was NOT added to `authoring.ts`.
  The first fix,
  importing the bare package specifier,
  was wrong and broke every
  test in the package:
  that specifier resolves to `dist/final/node/index.mjs`,
  which is also the `bin` entry,
  so it is the whole policy CLI.
  Neutral builds
  bundle workspace deps inline by design (`NEUTRAL_ALWAYS_BUNDLE`),
  so the CLI
  trust validator and its `yuku-parser` NATIVE BINDING landed inside the
  translation-repair artifact,
  and all 52 test files died on
  `Cannot find module @yuku-parser/binding-linux-x64-gnu/yuku-parser.node`
  because pnpm only links that binding inside `yuku-parser`'s own store dir.
  It also violated AGENTS.md ST3,
  which requires cross-package imports to
  resolve to TypeScript SOURCE.
  Fixed in `f48fde57c` by giving `git-policy-cli` the `"./ts/*": "./src/*"`
  wildcard that 58 other packages already have,
  and importing
  `@monochromatic-dev/git-policy-cli/ts/resolve-git.ts`.
  `resolve-git.ts` pulls
  in two node builtins and two small workspace modules;
  the artifact dropped
  from 651 kB to 167 kB.
  TRAP FOR NEXT TIME,
  and the first version of this note got it WRONG.
  It said
  `lint:types` does not cover the unit tests.
  It does.
  What actually happened is
  that the tests type-check against `dist`,
  and `dist` was STALE:
  it still
  carried the old `RepairModels` with `editorModelId`,
  so tests referencing the
  removed field checked out clean against the old API.
  The correct rule is
  BUILD FIRST,
  then `lint:types`,
  then `test:unit`;
  a green type-check over a
  stale `dist` proves nothing about either.
- `prefer-readonly-parameter-types` IS BEING IGNORED ON THIS BRANCH by user
  decision,
  and is filed as
  <https://github.com/Aquaticat/Monochromatic/issues/414>.
  It fires on ordinary array methods (`filter`,
  `map`,
  `find`,
  `flatMap`,
  `reduce`) called on parameters that are already deeply `readonly`,
  and its four
  printed remediations name no action that fits a built-in array method.
  107
  findings in this package;
  206 in `git-policy/cli`,
  which predates this branch
  and is what shows it is a rule question rather than a per-package cleanup.
  Do NOT spend branch time conforming to it,
  and do not suppress it either.
- GRADING PROCESS CHANGES for the next round (user instruction):
  pre-resolve the
  unambiguous Y/N items and hand over only genuinely contested ones.
  This CANNOT be honestly calibrated against the existing 100 graded items,
  because the agent has read all of them including the rationale,
  and round one
  came from a pre-fix pipeline.
  Plan:
  pre-grade round three BLIND,
  hand over
  every item with the agent's grade marked,
  let the user correct,
  and derive the
  agreement rate from that round.
  Only filter on the round after.
  Revives
  task 31.
  Say plainly that the instruction takes effect one round later than it
  sounds.
- ATTRIBUTION WARNING for round three,
  accepted by the user ("Bundle all the
  improvements that could be made,
  in"):
  the roster,
  the editor,
  the checker
  set,
  the quorum rule,
  the adjudication policy,
  and the house policy all
  changed at once,
  and the naturalness lane is still to come.
  A precision delta
  will not be attributable to any single change.
  Say so in the verdict rather
  than implying otherwise.

## Session 2026-08-06: repair quality made measurable, on its own sheet

TASK #47 COMPLETE.
Commits `a10dc94ab` (provenance and sheets),
`bac30e20d` (tests),
`cc9f6ad58` (sheet contradiction fix).

### What was wrong

The grading sheet asked exactly one question per sampled item,
whether the accepted issue is a real defect,
and nothing anywhere recorded what the pipeline actually WROTE.
A correct detection carrying a poor repair therefore scored as an unqualified
success.
Round two shows the gap directly:
four of the thirty-seven true positives came back with the grader asking
whether there was a better way,
and all four counted as successes.

The checker stage does not substitute for that measurement.
Measured across the thirty-one settled artifacts:
2257 accepted issues,
2215 with `resolved: true`,
so checkers confirm 98.1% of repairs.
A verdict that near-unanimous separates almost nothing.

### What was built

`repair-region.ts`:
`RepairRegion` (`envelopeId`,
`issueIds`,
`before`,
`editorAfter`) and
`collectRepairRegions`.
REGION-shaped,
not issue-shaped,
and that is load-bearing.
`deriveEditableEnvelopes` merges overlapping AND touching intervals
(`interval.start <= last.end`),
so one replacement can serve several accepted issues and fix only some of them.
Copying a replacement onto each issue as "the repair for this issue" would erase
that;
the served issue ids travel with the region and the sheet discloses siblings.

`repair-record.ts`:
`RepairIssueRecord` moved here out of `repair-translation.ts`,
plus `RepairDisposition`
(`shipped`,
`not-selected`,
`withdrawn`,
`no-region`) and `buildIssueRecords`.
Shipping status is decided HERE,
not in `repairChunk`,
for two independent
reasons.
A document blocked for non-translation returns its input and withdraws every
slice repair at once,
which no slice can know.
And `runRefinePhase` sets `changed: true` on a refinement-only rewrite,
so after that phase `changed` no longer answers whether an accuracy repair was
selected;
`ChunkRepairOutcome.accuracyPatchSelected` is the frozen accuracy-stage fact.
One builder serves both driver exits so they cannot drift,
which is how the blocked exit came to report `resolved: false` correctly while
carrying no repair provenance at all.

`ChunkRepairOutcome` also gained `refined`,
set by `refine-phase.ts` when a refinement is kept.
`RepairIssueRecord.finalSliceText` is carried ONLY when `refined` is set,
which is exactly where the recorded replacement stopped being the returned
wording.
Always carrying it would multiply a large document's slice text by its
accepted-issue count
(Dethelly has 260 accepted issues) for no added fact.

`artifact-guard.ts` holds the shape checks both artifact readers share;
`artifact-repair-read.ts` reads provenance back out with ONE tolerance,
a named `{ kind: 'unrecorded' }` for artifacts predating repair recording.
Absence and emptiness stay distinct all the way to the sheet:
no disposition means repair quality is unknowable for that item,
while `no-region` is a real measurement belonging in the coverage denominator.

`chunk-measure.ts` holds the selection measurements,
extracted because `repair-chunk.ts` hit the 300-line budget.
Behavior unchanged.

### The two-sheet decision

Repair grading is a SEPARATE sheet
(`repair-sheet.ts`,
`formatRepairSheet`,
path stem `repair-sheet-<seed>`),
not a second box on the detection sheet,
and that is a measurement decision rather than a layout one.
Showing a grader the correction makes an alleged defect look more salient,
which moves the answer to "is this a real defect".
Round two's precision was measured by a sheet showing no repair,
so folding repair text into round three's sheet would compare two rounds through
two different instruments and credit the change of instrument to the pipeline.
The detection sheet is byte-for-byte unchanged.
A unit test asserts the detection sheet contains no repair text;
nothing else would catch a leak.

The repair sheet also never prints the checker verdict,
since 98.1% agreement would anchor the human toward agreement on precisely the
population they are auditing.
Its header orders the detection sheet graded first,
and items whose repair did not reach the reader carry no grade box but do carry
a plain-language reason,
so the coverage denominator stays visible instead of turning into a gap.

### Denominators this enables

Detection precision:
human-confirmed real defects over all sampled accepted issues.
Unchanged from earlier rounds.

Targeted repair coverage:
real defects with a shipped targeted repair over all real defects.

Conditional repair effectiveness:
human-confirmed fixes over real defects with a shipped targeted repair.

End-to-end repair yield:
human-confirmed fixes over all real defects.

`Y` on the repair sheet means the returned wording fully resolves the defect and
introduces no new error nearby.
The number is repair EFFECTIVENESS,
not broad repair quality:
a `Y` is still compatible with a better phrasing existing.

### Verified at the user boundary

Exercised `parseSettledArtifact` -> `extractGradingCandidate` ->
`drawStratifiedSample` -> both formatters over the REAL thirty-one artifacts
(read-only;
sheets written to `${HOME}/temp/agent`,
never the runs dir).
All 2257 accepted issues parse,
all 2257 read as `unrecorded`,
the detection sheet renders 50 grade boxes exactly as before,
and the repair sheet renders 50 `NOT GRADABLE` items with zero grade boxes.
A synthesized recorded artifact exercised the other path and surfaced a real
defect,
fixed in `cc9f6ad58`:
an item could say "grade the FINAL wording" and,
one line later,
"not graded",
because a repair can lose its slice selection and still have its paragraph
rewritten by the naturalness lane.

### Cache invalidation

`repair-translation.ts` gained `SLICE_CACHE_VERSION = 2`,
mixed into every slice-cache key.
A resumed pre-change outcome would splice repair-less slices into a run and
contribute ungradable items to a precision sheet with nothing looking wrong.
`isChunkRepairOutcome` in `slice-cache-store.ts` also now requires
`repairRegions` and `accuracyPatchSelected`,
but the key is the primary mechanism:
the structural guard cannot detect an existing field CHANGING MEANING,
only one going missing.
Measured before bumping:
the single in-flight cache directory (`TianqiChen666`) is EMPTY,
so no partial work was discarded.

### Operational fact for round three

`corpus-pass.ts` treats any existing artifact file name as settled and skips
that entry,
so repair provenance will NOT appear for the entries already on disk however
many times the pass reruns.
Round three needs a fresh artifacts directory.
Filed as task 55,
including the question of archiving rather than deleting the
round-two artifacts,
which remain the calibration set for task 48.

### Deferred defects found while doing this

Filed rather than fixed,
because each changes what the pipeline decides:
