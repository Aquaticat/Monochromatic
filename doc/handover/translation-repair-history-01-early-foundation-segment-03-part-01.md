# Translation repair history: Early foundation, segment 3

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

RESUME PROCEDURE (historical,
loop closed at milestone-two
declaration).
The user ran an unattended milestone-two accumulation
loop,
"spare no expense,
only stop when genuinely blocked;
back in a
few hours" (2026-07-17).
Standing procedure was one run at a time
(never concurrent;
one stream per model is the fastest dispatch on
this plan):
1. Launch a budgeted benchmark pass:
   `cd <worktree> && mise exec -- node <scratchpad>/repair-benchmark-run.ts`
   where `<scratchpad>` is this session's scratchpad dir.
   The driver
   uses a 25-minute run budget,
   4-minute per-call deadlines,
   a 45-minute
   outer safety net,
   oversamples 6 shuffled small entries (700 to 2500
   chars;
   XIEPT2,
   BI4PBV,
   and shi_Yumiaoya quarantined),
   and grades
   with the zh-anchored judge as headline plus the lexical grader for
   comparison.
2. On completion (task notification re-invokes you):
   read the run's
   output file,
   extract SCORECARD and the per-entry `judgments`
   (headline),
   `detection`,
   and `lexical` lines.
3. Append the run to the milestone-two run log below,
   update the
   JUDGE ACCUMULATED and detection tallies,
   commit with
   `/usr/bin/git` (docs(*) message),
   push (auto-push on).
4. Relaunch the next pass.
   Repeat until the user returns or a genuine
   blocker appears.
Artifacts persist in this session's scratchpad across compaction:
`repair-benchmark-run.ts` (driver),
   `repair-benchmark-accumulator.jsonl`
(one line per run with judge+detection+lexical per seed),
`repair-benchmark-result-<ts>.json` (full per-run dumps;
   from run 33
they also carry `repairedText` per dispatched record,
   commit
`66e0d0f42`),
   and `partial-needle-analysis.ts` (offline per-sentence
coverage report over non-restored seeds in enriched artifacts,
   zero
quota;
   run it when a stable-partial entry re-draws).
THE HEADLINE NUMBER is judge `seededRepairRate` (zh-anchored,
   strict
restored/judged);
   `seededRepairRateLenient` adds partial;
`lexicalRepairRate` is the retired vocabulary grader kept for contrast.
Do NOT set temperature or reasoning effort;
   chat calls MUST stream.
Open question already answered by the user:
   grade against the Chinese
source (done).
   No open questions currently block the loop.

1. MILESTONE ONE NUMBER IS IN (2026-07-17,
   93-minute reference run,
   pre-budget code):
   `ensembleRecall` 0.981 (53 of 54 seeds) over 18
   entries spanning 714 to 5_826 chars,
   all seven models,
   one stream per
   model.
   Every one of the 126 calls ended `ok` (schemaOkRate 1.0 for
   every model,
   zero refusals);
   the retry layer recovered all four
   deadline forfeits (GLM-5.2,
   Flash,
   Qwen,
   MiniMax each once).
   Per-model seeded recall:
   GLM-5.2 0.889,
   Qwen 0.889,
   Kimi 0.815,
   gpt-oss 0.741,
   Nemotron 0.722,
   Flash 0.426,
   MiniMax 0.407;
   the ensemble union is the design working as intended.
   The single ensemble miss,
   analyzed at repair-phase kickoff
   (2026-07-17):
   wangzihao980 `seed/omission-1`,
   found by nobody.
   Sharper than first recorded:
   on that entry six models found ONLY
   `omission-2` and gpt-oss-120b found ONLY `omission-0` (its sole hit).
   Structural facts (no content):
   the missed needle is a 73-char
   interior sentence deleted from MID-paragraph (64 chars into its
   line);
   both found seeds were list items whose deletion left a
   countable zh/en structure asymmetry.
   Two consequences adopted:
   interior-sentence omissions are the critic's weak class (future
   prompt polish),
   and a real defect can arrive with exactly ONE
   proposer,
   so adjudication judges claims on evidence and never gates
   on corroboration count (confirms the settled panel design).
   Unresolved-reason distribution across the run (233 rejected claims):
   quote-outside-blocks source 90,
   quote-not-found source 39 / target
   33,
   ambiguous-quote 39,
   empty-quote 27,
   two model category typos;
   source-side anchoring is future critic polish,
   not a repair blocker.
   Quota after the whole run:
   2747.5/2750
   (regeneration outpaced consumption).
   MiniMax quirk:
   on 7 of 18 entries it returned near-empty reports
   (5-6 completion tokens,
   zero claims) yet valid JSON;
   on others it
   produced 10-19 resolved claims.
   Ensemble absorbs it;
   noted for
   scheduler weighting later.
   Future runs are 25-minute-budget runs via the updated
   `broadened-benchmark.ts` (shuffled samples,
   coverage-reporting
   scorecard).
2. Per-call deadlines are DONE (commit `18a8e95ca`):
   `armCallDeadline` in
   `benchmark.ts` arms a plain-timer-driven `AbortController` per call and
   forwards caller aborts through a listener;
   disposal (`using`) clears both.
   Never compose `AbortSignal.any` with an `AbortSignal.timeout` source on
   Node 26.5.0:
   the dependent signal never aborts (isolated repro confirmed;
   single-source `AbortSignal.any([signal,],)` works fine,
   verified by probe).
3. Pack-scaled concurrency is DONE:
   `createSyntheticClient` takes
   `perModelConcurrency` (default 1;
   provider grants one concurrent request
   per model per subscribed pack),
   and benchmark entries run in parallel.
   The user bought 4 more packs (joining a 1.5-pack-equivalent founder's
   pack);
   live quota ceiling is 2750 (5.5 pack-equivalents),
   the driver floors to `perModelConcurrency: 5`.
4. Driver env:
   the API key resolves only through mise sops,
   so run the
   scratchpad driver as
   `cd <worktree> && mise exec -- node <scratchpad>/run-benchmark.ts`;
   a bare `node` invocation dies on the missing env var.
5. The `prefer-readonly-parameter-types` idiom learned for opaque DOM calls:
   the `@mutates` contract must sit on the function DIRECTLY containing the
   calls,
   name every flagged boundary verbatim on an unbroken line
   (`signal.addEventListener`,
   `signal.removeEventListener`,
   `DOM commit 5796f716 AbortController abort steps retain reason`),
   and the parameter must be `ForeignBorrowed`-marked (the
   `fetchTransport`/`chatJson` pattern);
   callers inherit the documented
   uncertainty without re-documenting.
- REPAIR PHASE PLAN (tasks 11 to 17,
  dependency-ordered;
  user confirmed
  repair phase as the next scope 2026-07-17):
  11 claim aggregation (cross-model dedupe proposing clusters,
  deterministic span-overlap plus category-family compatibility,
  merges only PROPOSED),
  12 adjudication panel (provenance-blind,
  vote states
  supported/unsupported/ambiguous/source-defect/abstain,
  quorum,
  evidence-based never corroboration-gated,
  disposes proposed merges),
  DONE (commit `ebfe447a2`) with live boundary check on seeded
  DarlinChit (2026-07-17):
  7 critics -> 58 validated claims -> 15
  clusters (one 28-member hot-region mega-cluster,
  a refinement
  candidate) -> 5 of 7 panelists returned complete 58-verdict ballots
  with ZERO wire findings (integer-reference ballots work;
  Nemotron
  and gpt-oss forfeited the 5-minute deadline,
  driver had no retry)
  -> tally 42 issues (39 accepted,
  2 rejected,
  1 needs-human),
  BOTH
  planted seeds inside accepted issues,
  net quota cost ~0.
  chatJson success discriminant is `kind === 'ok'` (a first driver
  run wasted 5.6 quota units checking `'value'`),
  13 patch-operation model plus editable envelopes plus deterministic
  apply guards,
  DONE (commit `15450a437`:
  envelopes merge overlapping
  and touching accepted target spans,
  editors replace whole envelope
  contents against echoed base hashes,
  gate rejects unknown/duplicate/
  stale/drifted/unchanged as data,
  overlap throws),
  14 editor stage,
  DONE (commit `249dafad1`:
  numbered regions with
  current text and context,
  integer-referenced wire,
  resolver binds
  numbers to envelopes so models never echo hashes).
  Live editor check
  on the saved DarlinChit adjudication (2026-07-17):
  39 accepted
  issues merged to 10 envelopes,
  GLM-5.2 answered in 7 s,
  10/10 edits
  resolved and applied with zero findings and zero rejections;
  both
  deleted needles restored at about two-thirds content-word overlap
  (editor re-translates from zh,
  so byte-exact restoration is not
  expected).
  DESIGN FACT:
  the quote-based critic wire anchors
  omissions via the adjacent sentence,
  so omission repairs flow
  through replacement envelopes,
  not zero-width insertions;
  zero-width
  machinery stays for other producers.
  15 resolution check plus no-regression gate plus lexicographic
  candidate selection,
  DONE (commit `015b67b89`:
  checkers vote
  fixed/not-fixed/worse per issue,
  strict fixed majority resolves,
  worse majority counts as regression;
  selection order integrity >
  high-severity resolution > regressions > total resolution >
  preservation,
  unchanged candidate always competes and wins perfect
  ties).
  Live check (2026-07-17):
  3 checkers,
  39/39 verdicts each,
  zero findings,
  25 s;
  38/39 resolved (13 high-severity),
  0
  regressed,
  patched candidate parsed clean,
  selection picked the
  repaired candidate over unchanged.
  Note checker leniency mirrors
  panel leniency;
  canary calibration remains the designed control,
  16 `repairTranslation` end-to-end,
  DONE (commit `a4d384dcb`:
  `repair-translation.ts` batch driver over `repair-chunk.ts` and the
  stage runners in `repair-stages.ts`/`repair-edit-stages.ts`;
  `stage-call.ts` turns lost voices into ensemble degradation,
  caller
  aborts always propagate;
  two wire-level critical non-translation
  votes block repair;
  changed chunks splice back descending;
  unit-tested end to end over a stub client scripted per
  response-format schema name).
  LIVE end-to-end on seeded DarlinChit
  (2026-07-17,
  523 s,
  ~8.5 quota units):
  status `repaired`,
  critics
  5/7 heard (Nemotron and gpt-oss forfeited 4-minute deadlines,
  gracefully absorbed),
  41 claims -> 31 issues (29 accepted,
  2
  rejected),
  editor 10/10 applied zero rejections,
  checkers 3/3 with
  29/29 accepted issues resolved,
  BOTH deleted needles restored
  (11/18 and 10/15 distinctive words returned),
  17 milestone-two benchmark,
  DONE (commit `765e3059c`,
  `repair-benchmark.ts`):
  restoration grades on the distinctive
  vocabulary the deletion removed (words surviving elsewhere in the
  seeded text prove nothing;
  half returning marks restored,
  `RESTORATION_WORD_THRESHOLD`);
  `runRepairBenchmark` budget-gates
  entries sequentially with an injectable repair seam for tests;
  `computeRepairScorecard` reports `seededRepairRate` over measurable
  seeds plus coverage.
  FIRST MILESTONE-TWO NUMBER (2026-07-17,
  25-minute budget,
  1502 s
  wall,
  driver `repair-benchmark-run.ts` in the session scratchpad):
  seededRepairRate 0.75 (3 of 4 measurable seeds restored),
  2 of 4
  sampled entries dispatched (coverage 0.5,
  budget cut the rest
  honestly),
  both dispatched entries status `repaired`
  (a2581911655 25/29 issues resolved,
  homoyamakaze 33/34).
  The one missed seed (a2581911655 omission-0,
  5/18 words returned)
  is the first repair-quality calibration datum.
  One chunk
  (a2581911655 chunk 1) lost SIX of seven critics to 4-minute
  deadlines while GLM-5.2 completed and chunk 0 of the same entry had
  completed 7/7 four minutes earlier;
  the pipeline finished the chunk
  on the surviving voice.
  PROBE VERDICT (task 19,
  2026-07-17):
  the
  exact seeded chunk re-run in a fresh window completed on ALL SEVEN
  models (44 to 205 s,
  six substantive reports plus MiniMax's known
  near-empty quirk),
  so the forfeit was provider weather,
  not
  content-hard input;
  retry-to-quorum is the right remedy.
  gpt-oss
  and Nemotron ran 200+ s even in the calm window:
  they are the
  systematic slow tail on this plan,
  not occasionally unlucky.
  Net quota over the whole run POSITIVE
  (2740.5 -> 2745.6 of 2750).
  The repair-phase exports live in `pipeline-barrel.ts` (root barrel
  hit max-lines).
  MILESTONE TWO IS NOT DONE (user directive 2026-07-17):
  a stage that
  loses voices must retry the lost ones until over half its roster is
  heard,
  DONE (task 18,
  commit `46d716ffa`:
  `stage-quorum.ts`
  `gatherStageVoices`,
  retries stop at quorum,
  unmet quorum proceeds
  with a finding;
  wired through critic,
  panel,
  checker,
  and the
  one-model editor roster).
  Budgeted runs now accumulate the real
  seededRepairRate (task 20);
  per-run accumulator JSONL sits in the
  session scratchpad.
  Run log (25-minute budget each,
  retries active from run 2 on):
  run 1 (2026-07-17,
  pre-retry):
  0.75 (3/4 seeds),
  2 entries
  dispatched,
  both repaired.
  run 2 (2026-07-17,
  retries active,
  1964 s):
  0.75 (3/4),
  entries
  Hangmster (34/34 issues resolved,
  1 of 2 seeds) and Everythings99
  (27/29,
  2 of 2);
  one panel round lost four voices and retry round
  one recovered them.
  run 3 (2026-07-17,
  1872 s):
  0.5 (3/6),
  THREE entries fit the same
  budget (retries keep stages complete instead of limping):
  DarlinChit
  2/2,
  s5ehfr9 1/2,
  TLL1122 0/2 while still shipping a 29/31-resolved
  repair;
  critic and panel each lost four voices once and retry round
  one recovered both fully.
  run 4 (2026-07-17,
  1679 s,
  no retries needed):
  0.33 (2/6):
  Katerina 2/2 (40/40 issues resolved),
  TLL1122 0/2 AGAIN (same
  entry,
  same misses as run 3:
  reproducible entry-specific failure),
  luxuanwen3 near-zero restoration (1/13 and 2/8 words) despite a
  23/26-resolved repair.
  run 5 (2026-07-17,
  1655 s,
  detection grading active):
  repair 1/5,
  detection 2/6;
  the split works immediately:
  SevenBird both seeds DETECTED,
  one restored 8/11,
  one editor
  under-restoration 6/14 (just under threshold);
  wangzihao980 both seeds UNDETECTED,
  the same entry as milestone
  one's single ensemble miss,
  confirming interior omissions as the
  critics' weak class at the detection layer;
  XIEPT2 returned `blocked-non-translation` and a structural probe
  proved the block CORRECT (7365-char zh prose vs 1218-char en
  heading skeleton,
  a third still CJK):
  the guard works on real
  corpus data,
  and XIEPT2 joins BI4PBV in benchmark quarantine.
  run 6 (2026-07-17,
  1813 s):
  repair 3/4,
  detection 4/4:
  qiqi233345 2/2;
  SS3B_0016 both detected,
  the 12-word needle came
  back 3/12 (editor compression on the longest needle again) while
  the 11-word one restored 6/11.
  Accumulated:
  15/29 seeds restored (0.52);
  detection 6/10 over the
  graded runs.
  The misses have named classes:
  editor compression on long needles (detection fine),
  critic
  detection on interior omissions (wangzihao980),
  and one correctly
  blocked non-translation (XIEPT2,
  quarantined).
  QUANTIFIED (over all 29 graded seeds):
  needles over eleven
  distinctive words restore at 6/16 versus 9/13 for shorter ones;
  missed seeds average a 0.25 return ratio versus 0.67 for restored
  ones,
  so misses are real failures,
  not threshold noise.
  REMEDY SHIPPED (commit `a69cfdbe1`):
  the editor prompt now forbids
  summarizing or compressing omitted content ('a short paraphrase of
  a long omission is not a fix');
  run 7 predates it,
  run 8 onward
  measures it.
  run 7 (2026-07-17,
  1422 s,
  last pre-remedy baseline):
  repair 4/6,
  detection 6/6,
  all three entries repaired;
  misses are keyword233's
  15-word needle (4/15) and CuspariaKLSY's 7-word needle (1/7),
  the
  first SHORT-needle editor miss,
  so compression is dominant on long
  needles but not exclusive to them.
  Accumulated:
  19/35 repair (0.54);
  detection 16/20 (0.80) over
  graded runs.
  run 8 (2026-07-17,
  1826 s,
  FIRST with the anti-compression rule):
  repair 5/6 (0.83),
  detection 6/6,
  best multi-entry pass yet.
  Long needles went 3/4 this run versus 6/16 pre-remedy:
  chunchun_yudong's 17-word needle (longest graded) restored 12/17,
  SevenBird's 14-word needle that failed 6/14 in run 5 passed 8/14.
  The miss is s5ehfr9's 13-word needle again (2/13;
  3/13 in run 3),
  a repeat offender worth an entry-specific look.
  Accumulated:
  24/41 repair (0.59);
  post-remedy sample is one run,
  keep accumulating before crediting the rule.
  run 9 (2026-07-17,
  2068 s):
  repair 3/4,
  detection 4/4:
  Rentable_A 2/2 with one PERFECT 7/7 restoration,
  a2581911655's
  16-word needle passed 9/16 while its 18-word needle missed again
  (6/18;
  5/18 in run 1).
  POST-REMEDY TALLY after runs 8 and 9:
  8/10 (0.80) versus 16/31
  (0.52) pre-remedy.
  run 10 (2026-07-17,
  1778 s):
  repair 0/4,
  detection 2/4,
  the
  hardest pass yet:
  Anilovr both seeds detected but under-restored
  (2/7 and 2/8,
  SHORT needles,
  post-remedy),
  and wangzihao980
  reproduced its both-seeds-undetected failure from run 5,
  making it
  a STABLE detection hole (interior omissions defeat the critics on
  this entry across independent runs).
  Post-remedy tally corrected:
  8/14 (0.57) versus 0.52 pre-remedy;
  the anti-compression rule's benefit is no longer clearly
  established,
  keep accumulating.
  Accumulated:
  27/49 repair (0.55);
  detection 26/32 (0.81) over
  graded runs.
  run 11 (2026-07-17,
  1717 s):
  repair 3/4,
  detection 4/4:
  MioCardMeow 2/2 with one PERFECT 8/8 and a 13-worder at 7/13;
  s5ehfr9's 13-word needle missed for the THIRD straight time
  (3/13,
  2/13,
  3/13):
  a stable editor-side repeat offender with
  detection fine,
  the editor-layer counterpart to wangzihao980's
  detection hole.
  Accumulated:
  30/53 repair (0.57);
  post-remedy 11/18 (0.61) versus
  0.52 pre-remedy;
  detection 30/36 (0.83).
  run 12 (2026-07-17,
  1488 s):
  the retry ladder's sternest live
  test:
  one chunk lost ALL SEVEN critics in a round,
  six again on
  retry round one,
  and five panelists in another round;
  the ladder
  recovered quorum every time (zero quorum-unmet findings) and the
  single entry that fit the budget completed with 51/51 issues
  resolved,
  detection 2/2,
  repair 1/2.
  Retries traded coverage
  (0.17) for completeness,
  as designed.
  Accumulated:
  31/55 repair (0.56);
  post-remedy 12/20 (0.60);
  detection 32/38 (0.84).
  run 13 (2026-07-17,
  1573 s):
  repair 3/4,
  detection 4/4:
  SU5ZI2MO1's 20-word needle,
  the longest graded yet,
  restored
  11/20 (a class that reliably failed pre-remedy);
  xixi_yuexi's
  11-worder missed just under threshold at 5/11.
  Accumulated:
  34/59 repair (0.58);
  post-remedy 15/24 (0.63);
  detection 36/42 (0.86).
  run 14 (2026-07-17,
  1639 s):
  repair 3/4,
  detection 4/4:
  coin one perfect 7/7 and one miss (2/11);
  xixi_yuexi 2/2 including
  the 11-worder that missed run 13 now passing 6/11 (nondeterminism
  cuts both ways at the editor too).
  Accumulated:
  37/63 repair (0.59);
  post-remedy 18/28 (0.64);
  detection 40/46 (0.87).
  run 15 (2026-07-17,
  2217 s):
  repair 3/4,
  detection 4/4;
  the
  EDITOR retry fired for the first time and recovered a lost editor
  voice (pre-quorum that chunk would have shipped unchanged).
  Uekawakuyuurei's 9-word seed missed at exactly 3/9 in two
  independent runs (12 and 15):
  a third stable repeat offender,
  editor-layer.
  Accumulated:
  40/67 repair (0.60);
  post-remedy 21/32 (0.66);
  detection 44/50 (0.88).
  run 16 (2026-07-17,
  2042 s):
  repair 3/4,
  detection 4/4 through a
  second whole-roster critic wipeout recovered in two retry rounds;
  lxy's 16-word needle near-missed at 7/16,
  SevenBird 2/2 again.
  Accumulated:
  43/71 repair (0.61);
  post-remedy 24/36 (0.67);
  detection 48/54 (0.89).
  The rates have stabilized:
  repair around
  0.6 overall and about two thirds post-remedy,
  detection just
  under 0.9.
  run 17 (2026-07-17,
  2302 s,
  calm weather,
  zero retries):
  repair
  3/4,
  detection 4/4;
  Everythings99 restored both 14-worders;
  a2581911655's 18-word needle missed a third time (7/18 after 5/18
  and 6/18):
  the longest needles trend upward post-remedy but the
  18-word class still sits under threshold.
  Accumulated:
  46/75 repair (0.61);
  post-remedy 27/40 (0.68);
  detection 52/58 (0.90).
  run 18 (2026-07-17,
  1858 s):
  repair 3/6,
  detection 6/6;
  TLL1122's
  classification settles:
  both seeds DETECTED yet under-restored
  (6/15 and 5/12),
  so it is editor-side,
  not a detection hole;
  Katerina 2/2 again;
  the checker retry recovered two lost voices.
  Accumulated:
  49/81 repair (0.60);
  post-remedy 30/46 (0.65);
  detection 58/64 (0.91).
  run 19 (2026-07-17,
  1729 s):
  repair 4/6,
  detection 6/6;
  chunchun_yudong's 17-worder restored 12/17 a second time,
  while
  s5ehfr9's 13-worder missed a FOURTH time at a near-constant 3/13
  and keyword233's 15-worder repeated its exact 4/15:
  the specific
  editor misses look entry-deterministic despite editor
  nondeterminism,
  suggesting the failing needles share a content
  property (for the next design pass to identify).
  Accumulated:
  53/87 repair (0.61);
  post-remedy 34/52 (0.65);
  detection 64/70 (0.91).
  run 20 (2026-07-17,
  2272 s):
  repair 2/4,
  detection 4/4;
  a2581911655's 18-worder missed a fourth time at exactly 7/18 while
  its 16-worder restored a third time;
  new entry ttttsuuukikoo_
  (81 issues,
  the largest issue count yet) split 1/1.
  Accumulated:
  55/91 repair (0.60);
  post-remedy 36/56 (0.64);
  detection 68/74 (0.92).
  NEEDLE-PROPERTY ANALYSIS (2026-07-17,
  offline,
  structural only):
  no single structural feature (quote marks,
  footnote refs,
  parentheticals,
  digits,
  comma density,
  paragraph position,
  document position) separates the stubborn misses from reliable
  restorations;
  both classes span the same ranges.
  Combined with
  the near-constant per-seed return ratios across independent runs
  (3/13 four times,
  7/18 twice,
  4/15 twice),
  the leading hypothesis
  is that the editor consistently produces a faithful-but-terse
  re-translation of a compact zh sentence,
  and vocabulary overlap
  against the wordier ORIGINAL EN under-credits it.
  CONSEQUENCE:
  the lexical seededRepairRate is a LOWER BOUND on true
  repair quality.
  USER DECISION (2026-07-17):
  grade restoration against the Chinese
  source.
  DONE (commit `81271a63d`):
  the headline seededRepairRate is
  now a bilingual ensemble JUDGE anchored on zh (`restoration-judge.ts`,
  `restoration-judge-wire.ts`).
  Judges read the original Chinese,
  the
  deleted sentence as a content pointer,
  and the repaired text,
  then
  rule restored/partial/absent,
  tolerating terse-but-faithful
  rewording and requiring zh grounding.
  No single judge decides:
  the roster (GLM-5.2,
  Qwen,
  Kimi by default) fans out with
  retry-to-quorum and each seed's verdict is the conservative lower
  median (an even split rounds toward the less-credited verdict).
  Scorecard now reports judgedSeeds,
  restoredSeeds,
  partialSeeds,
  seededRepairRate (strict,
  zh-anchored),
  seededRepairRateLenient
  (restored+partial),
  plus the lexical* fields for comparison.
  The lexical grader moved to `lexical-restoration.ts`;
  the benchmark
  takes an injectable `judge` seam (tests stub it) and a
  `judgeModelIds` roster.
  All prior run numbers (0.60 repair) were
  LEXICAL;
  the judge rate supersedes them from the next live run and
  the two rates print side by side so the gap is visible.
  JUDGE LIVE BOUNDARY CHECK (2026-07-17,
  `judge-boundary.ts`):
  on the
  saved DarlinChit repaired text,
  3/3 judges heard,
  quorum met,
  both
  seeds ruled `restored` in 15 s for ~2 quota units.
  The live judge
  works;
  the overnight loop resumes on it from run 22.
  run 21 (2026-07-17,
  2413 s,
  LAST lexical-only run):
  lexical repair
  2/4,
  detection 4/4;
  a2581911655's 18-worder missed a FIFTH time
  (5/18) and Acheron's 9-worder at 1/9,
  exactly the terse-faithful
  cases the judge is expected to re-credit,
  so run 21 is the natural
  before/after datum.
  FINAL LEXICAL ACCUMULATED:
  57/97 (0.59) over 21 runs;
  detection
  72/78 (0.92).
  The judge rate starts fresh at run 22.
  run 22 (2026-07-17,
  2271 s,
  FIRST judge-graded run):
  judge repair
  2/4 (0.50) versus lexical 0/4 on the SAME seeds,
  and the split is
  the validation,
  not noise:
  - ttttsuuukikoo_ both seeds JUDGE=restored but LEXICAL=absent
    (2/6 and 2/7 words):
    the editor faithfully re-translated the zh
    with different English wording,
    vocabulary overlap missed it,
    the
    bilingual judge caught it.
    This is the under-crediting the user
    predicted,
    now corrected.
  - wangzihao980 both seeds JUDGE=absent AND LEXICAL=absent while the
    run still resolved 37/37 OTHER issues:
    a genuine repair failure
    the judge agrees on.
    Detection was true (issue accepted at the
    region) but the editor did not actually restore the content,
    so
    detection-yet-unrepaired is real and the judge exposes it.
  The judge discriminates (credits faithful rewording,
    fails genuine
  misses) rather than inflating;
    that is the whole point.
  run 23 (2026-07-17,
    2069 s):
    judge 4/4 (1.0),
    lexical also 4/4;
  noname3031 and MioCardMeow both fully restored,
    both graders
  agreeing this run (agreement is common;
    disagreement appears on the
  terse-rewording cases like run 22's ttttsuuukikoo_).
  run 24 (2026-07-17,
    2469 s,
    first post-compaction run):
    judge 3/4
  (0.75),
    lexical also 3/4;
    detection 4/4.
    Acheron seed 0 (9 words)
  JUDGE=partial with 2/9 lexical words returned;
    its sibling seed 1
  (10 words) fully restored.
    MioCardMeow both restored again (repeat
  draw from run 23).
    Four entries budget-skipped including
  luxuanwen3,
    so the anti-compression prompt retest did not draw.
  PATTERN NOTE:
    Acheron breaks the "missed seed is always the LONGEST
  needle of its entry" streak;
    the partial (9 words) is shorter than
  its fully restored sibling (10 words).
  run 25 (2026-07-17,
    1795 s):
    judge 6/6 (1.0),
    lexical 6/6,
  detection 6/6;
    yingying,
    lxy,
    SU5ZI2MO1 all fully repaired (three
  dispatched,
    three budget-skipped).
    SU5ZI2MO1 seed 0 was a 20-word
  needle restored fully (11/20 lexical words,
    judge unanimous):
    the
  longest needle restored to date,
    evidence the anti-compression
  editor prompt (edit-prompt.ts) is working on exactly the long-needle
  compression failure it was written for.
  run 26 (2026-07-17,
    1608 s):
    judge 6/6 (1.0),
    lexical 4/6,
  detection 6/6;
    coin,
    Mizuki_Yuuki,
    AkiraComplex all fully repaired
  (three dispatched,
    three budget-skipped).
    Two more judge-vs-lexical
  disagreements,
    both unanimous judge=restored on low word overlap
  (coin seed 0:
    3/11 words;
    AkiraComplex seed 0:
    4/10):
    the
  faithful-rewording under-credit pattern run 22 first exposed.
  Mizuki_Yuuki seed 0 (18 words) restored fully,
    a second long
  needle credited since the anti-compression prompt.
  run 27 (2026-07-17,
    2414 s):
    judge 5/6 (0.83,
    one partial),
  lexical 3/6,
    detection 6/6;
    CuspariaKLSY,
    Hangmster,
  CutOceanHeyFis1 all repaired (three dispatched,
    three
  budget-skipped).
    Three more unanimous judge=restored on low overlap
  (1/7,
    6/14,
    3/11 words).
    FIRST INVERSION:
    CuspariaKLSY seed 1 is
  lexical=restored (4/8 words) but judge=partial against the zh
  source;
    the judge discriminates in BOTH directions,
    catching a
  half-restoration the word counter credited.
    Lenient rate still 1.0.
  run 28 (2026-07-17,
    1462 s):
    raw scorecard judge 2/4,
    detection
  2/4;
    but shi_Yumiaoya came back status=blocked-non-translation.
  Probe confirmed the block is CORRECT:
    its en page holds a genuinely
  untranslated CJK region (six lines at 33 to 83 percent CJK;
    zh 3935
  chars vs en 1458),
    4/7 critics voted non-translation on that chunk,
  whole entry returned unchanged by design.
    Like XIEPT2,
    seeding it
  grades nothing about repair,
    so shi_Yumiaoya is now QUARANTINED in
  the driver (third entry).
    Its two run-28 seeds are excluded from
  the accumulated tallies below.
  JUDGE CAVEAT found:
    on the unchanged blocked text the judges
  unanimously called the 231-char seed 0 "restored" though the needle
  occurs 0 times;
    only 2 of its content words uniquely disappeared,
  so near-duplicate needles (vocabulary still present elsewhere) can
  fool the judge.
    Rare (first in 28 runs),
    quarantine prevents this
  instance;
    benchmark-side fix (exclude blocked entries from the
  judge universe) noted as a calibration follow-up.
  The repairable entry CuspariaKLSY,
    a repeat draw from run 27,
  reproduced its run 27 judgments exactly (seed 0 restored on 0/7
  lexical words,
    seed 1 partial):
    judge verdicts are stable across
  independent runs.
    Detection 2/2 there.
  run 29 (2026-07-17,
    2405 s):
    judge 2/4 (0.50,
    two partials),
  lexical 2/4,
    detection 4/4;
    Anilovr and Acheron repaired (two
  dispatched,
    four budget-skipped).
    Acheron is a repeat draw from run
  24 and its seed 0 judged PARTIAL both times (independent runs):
  second reproducibility case;
    that specific needle consistently
  comes back half-restored from the editor.
    Anilovr seed 0 is a
  second inversion (lexical=restored on 4/7 words,
    judge=partial
  against the zh source).
    Lenient rate stays 1.0:
    every judged seed
  in the repairable universe is at least partial.
  run 30 (2026-07-18,
    1598 s):
    judge 6/6 (1.0),
    lexical 4/6,
  detection 6/6;
    Mizuki_Yuuki,
    Barron12312,
    mone all fully repaired
  (three dispatched,
    three budget-skipped).
    Mizuki_Yuuki is a repeat
  draw from run 26 and both seeds judged restored BOTH times
  (including its 18-word needle):
    reproducibility now shown on the
  restored side as well as the partial side.
    mone adds two more
  unanimous judge=restored on low overlap (5/12,
    3/11 words).
  run 31 (2026-07-18,
    1818 s):
    judge 3/4 (0.75,
    one partial),
  lexical 4/4,
    detection 4/4;
    Anilovr and yingying repaired (two
  dispatched,
    four budget-skipped).
    Anilovr seed 0 judged PARTIAL
  again (runs 29 and 31,
    lexical over-crediting it both times):
    the
  inversion reproduces,
    third stable-partial seed alongside Acheron
  seed 0 and CuspariaKLSY seed 1.
    yingying reproduced run 25's
  double-restored.
  run 32 (2026-07-18,
    2044 s):
    judge 6/6 (1.0),
    lexical 5/6,
  detection 6/6;
    Mizuki_Yuuki,
    SU5ZI2MO1,
    a2581911655 all fully
  repaired (three dispatched,
    three budget-skipped).
    Mizuki_Yuuki is
  three-for-three across independent draws;
    SU5ZI2MO1's 20-word
  needle restored again on repeat;
    a2581911655 seed 0 is another
  under-credit (8/18 words,
    unanimous judge=restored).
  run 33 (2026-07-18,
    1444 s):
    judge 4/4 (1.0),
    lexical 3/4,
  detection 4/4;
    MioCardMeow and AkiraComplex repaired (two
  dispatched,
    four budget-skipped).
    MioCardMeow three-for-three
  across draws;
    AkiraComplex reproduced run 26 exactly including the
  same 4/10 lexical under-credit on seed 0.
    First enriched artifact
  (carries repairedText) but no partial verdicts to analyze this run.
  run 34 (2026-07-18,
    1542 s):
    judge 5/6 (0.83,
    one partial),
  lexical 3/6,
    detection 6/6;
    keyword233,
    mone,
    Mizuki_Yuuki repaired
  (three dispatched,
    three budget-skipped).
    mone reproduced run 30's
  double-restored double-under-credit;
    Mizuki_Yuuki restored on its
  FOURTH draw.
    New partial:
    keyword233 seed 0,
    15 content words,
  6 returned.
  FIRST ENRICHED-ARTIFACT ANALYSIS (partial-needle-analysis.ts,
    zero
  quota):
    keyword233's partial needle is a SINGLE sentence;
    its
  ordered coverage bitmap is 000100101110001,
    scattered mid-sentence
  coverage,
    so the residual failure mode is within-sentence
  paraphrase of one long sentence,
    NOT head-truncation and NOT
  dropped trailing sentences.
    OPEN HYPOTHESIS:
    if the deleted EN
  sentence embellished beyond the zh source,
    a faithful zh-anchored
  editor cannot restore those words and "partial" is the correct
  ceiling for that seed;
    testable later by asking the judge ensemble
  whether each needle is fully derivable from zh.
  run 35 (2026-07-18,
    2404 s):
    judge 4/4 (1.0),
    lexical 2/4,
  detection 4/4;
    ttttsuuukikoo_ and CutOceanHeyFis1 repaired (two
  dispatched,
    four budget-skipped).
    Both are repeats reproducing
  earlier verdicts:
    ttttsuuukikoo_ (run 22's original under-credit
  case) restored again;
    CutOceanHeyFis1 matched run 27 including the
  same judge=restored-lexical=absent split on seed 0.
  run 36 (2026-07-18,
    1554 s):
    judge 2/4 (0.50,
    both akasa_musha
  seeds partial),
    lexical 2/4,
    detection 4/4;
    akasa_musha (new entry)
  and CutOceanHeyFis1 (third draw,
    reproduced again) repaired.
  akasa_musha seed 0 is the largest needle yet (23 content words over
  three sentences);
    seed 1 is another inversion (lexical=restored
  8/13,
    judge=partial).
  ENRICHED ANALYSIS:
    akasa_musha seed 0's three sentences covered
  0.45/0.57/0.60 (none dropped whole);
    seed 1 single sentence at
  0.69 yet still judged partial.
    All three enriched partials to date
  show the same signature:
    scattered within-sentence paraphrase,
    no
  head-truncation,
    no sentence-dropping;
    the judges hold a high bar
  even at 0.69 word coverage.
  JUDGE ACCUMULATED (repairable universe):
    59/70 (0.84) over 15 runs
  (22 to 36).
    Lexical over the same runs 45/70 (0.64).
    Detection
  142/148 (0.96).
  USER DIRECTION (2026-07-18,
    interactive):
    pursue BOTH the
  derivability probe AND the editor calibration A/B,
    probe first.
  Built and committed while run 37 was in flight:
  - Derivability probe (commit `2951e9b42`):
    derivability-wire.ts +
    derivability-probe.ts ask the judge ensemble whether each deleted
    sentence is fully derivable from the zh source
    (derivable/partially-derivable/not-derivable).
    UPPER-median
    resolution (opposite of the restoration judge) rounds splits
    toward derivable:
    the probe can only EXCUSE a partial,
    so the
    excuse carries the burden of proof.
    Unjudged defaults derivable.
    Driver `derivability-probe-run.ts` (scratchpad) probes all five
    stable-partial entries with restored siblings as controls;
    run it
    BETWEEN benchmark runs (one stream per model is fastest).
  - Editor rule addendum (commit `c767a550a`):
    RepairModels.editorRuleAddendum threads one extra rule line into
    the editor system prompt (composed from named blocks,
    never
    string surgery).
    A/B plan:
    baseline vs clause-enumeration rule on
    the stable-partial entries,
    judge verdicts on target seeds
    compared;
    only meaningful for seeds the probe rules derivable.
  run 37 (2026-07-18,
    1531 s):
    judge 3/6 (0.50,
    three partials),
  lexical 3/6,
    detection 6/6;
    TLL1122,
    DarlinChit,
    keyword233
  repaired (three dispatched,
    three budget-skipped).
    TLL1122 (one of
  the two original long-needle miss entries) re-drew at last:
    BOTH
  seeds judged partial.
    keyword233 seed 0 reproduced its run 34
  partial (0.40 then 0.47 coverage across independent runs).
  DarlinChit fully restored.
    Stable-partial set now SIX seeds over
  five entries:
    Acheron 0,
    CuspariaKLSY 1,
    Anilovr 0,
    keyword233 0,
  TLL1122 0 and 1 (akasa_musha's two included makes eight probe
  targets).
    Enriched analysis over all six shows the one signature:
  scattered within-sentence paraphrase,
    0.40 to 0.69 coverage,
    no
  sentence dropped whole.
  JUDGE ACCUMULATED (repairable universe):
    62/76 (0.82) over 16 runs
  (22 to 37).
    Lexical over the same runs 48/76 (0.63).
    Detection
  148/154 (0.96).
  DERIVABILITY PROBE RESULTS (2026-07-18,
    144 s total,
    ~14 quota
  units,
    every quorum 3/3,
    every vote unanimous):
  - Six of eight stable-partial seeds are PARTIALLY-DERIVABLE
    (Acheron 0,
    CuspariaKLSY 1,
    Anilovr 0,
    keyword233 0,
    akasa_musha
    0 and 1):
    the original EN translation embellished beyond the zh
    source,
    so partial restoration is those seeds' correct CEILING.
  - TLL1122 seeds 0 and 1 are DERIVABLE yet only partially restored:
    the only genuine editor shortfall;
    the A/B target.
  - wangzihao980's two ABSENT seeds (run 22) are NOT-DERIVABLE:
    the
    deleted sentences have no zh support,
    so the editor rule "Never
    introduce content the ORIGINAL does not support" makes refusal
    CORRECT;
    run 22's "genuine repair failure" reading is retracted.
  - All four restored-sibling controls probed derivable:
    the probe
    discriminates rather than excuses.
  MISS ATTRIBUTION through run 37 (76 judged seed-results):
    62
  restored;
    10 partials on partially-derivable seeds (ceiling met);
  2 partials on derivable TLL1122 seeds (real shortfall);
    2 absents
  on not-derivable wangzihao980 seeds (correct refusal).
  PROBE-ADJUSTED EFFECTIVE RATE:
    74/76 (0.97).
    Strict rate over
  winnable (derivable) seeds:
    62/64 (0.97).
  ERRATUM:
    run 29 to 37 notes said accumulated lenient stayed 1.0;
  wrong,
    run 22's two wangzihao980 absents make lenient through run
  37 74/76 (0.97).
    Per-run lenient scorecards were correct;
    only the
  accumulated claim in these notes was wrong.
  EDITOR A/B,
    VARIANT ARM 1 (2026-07-18,
    937 s):
    TLL1122 with the
  clause-enumeration editorRuleAddendum.
    Seed 1 FLIPPED partial ->
  RESTORED (unanimous,
    on 5/12 lexical words:
    meaning-complete
  rewording only the zh-anchored judge credits).
    Seed 0 stayed
  partial.
    Word coverage identical across arms (0.47 and 0.50),
    so
  the flip is purely semantic.
    Retry-to-quorum recovered a 4-critic
  forfeit and a whole-panel 7-voice forfeit inside this run.
  The rule text lives in scratchpad `editor-ab-run.ts` as
  CLAUSE_ENUMERATION_RULE.
    Variant arm 2 (replicate) launched to
  confirm the n=1 flip before drawing conclusions.
  EDITOR A/B,
    VARIANT ARM 2 (2026-07-18,
    591 s):
    reproduces arm 1
  EXACTLY:
    seed 1 restored (unanimous),
    seed 0 partial,
    identical
  lexical counts (6/15,
    5/12).
  A/B VERDICT:
    the clause-enumeration rule reliably flips TLL1122
  seed 1 (2/2 variant arms vs partial at baseline);
    TLL1122 seed 0 is
  now the accumulation's ONLY unresolved derivable seed,
    resisting
  both arms at 0.47 coverage.
    Why it resists is open;
    candidate
  probes:
    per-clause derivability of that one sentence,
    or a
  different editor model on that entry.
  DECISION FOR USER:
    promote CLAUSE_ENUMERATION_RULE into the
  baseline editor prompt?
    Evidence:
    2/2 reproducible win on the one
  targeted seed,
    no observed regression (arm seeds elsewhere weren't
  run).
    Promotion changes the measured pipeline mid-accumulation,
    so
  it awaits explicit direction;
    the loop continues on the BASELINE
  prompt meanwhile for measurement continuity.
  run 38 (2026-07-18,
    1598 s):
    judge 4/4 (1.0),
    lexical 3/4,
  detection 4/4;
    xixi_yuexi and homoyamakaze (both first-time
  entries) fully repaired (two dispatched,
    four budget-skipped).
  homoyamakaze includes a 16-word needle restored at 11/16 and
  another under-credit (3/10 words,
    unanimous judge=restored).
  JUDGE ACCUMULATED (repairable universe):
    66/80 (0.83) over 17 runs
  (22 to 38).
    Lexical 51/80 (0.64).
    Detection 152/158 (0.96).
  Lenient 78/80 (0.98).
    Probe-adjusted effective 78/80 (0.98).
  run 39 (2026-07-18,
    2281 s):
    judge 6/6 (1.0),
    lexical 5/6,
  detection 6/6;
    Katerina (first draw),
    homoyamakaze,
    a2581911655
  all fully repaired (three dispatched,
    three budget-skipped).
    Both
  repeats reproduced earlier verdicts;
    a2581911655 seed 0 repeated
  its under-credit (6/18,
    unanimous judge=restored).
  JUDGE ACCUMULATED (repairable universe):
    72/86 (0.84) over 18 runs
  (22 to 39).
    Lexical 56/86 (0.65).
    Detection 158/164 (0.96).
  Lenient and probe-adjusted effective both 84/86 (0.98).
  run 40 (2026-07-18,
    1504 s):
    judge 6/6 (1.0),
    lexical 2/6,
  detection 6/6;
    SU5ZI2MO1,
    luxuanwen3,
    coin all fully repaired
  (three dispatched,
    three budget-skipped).
    LUXUANWEN3 at last:
    one
  of the two original pre-judge long-needle miss entries dispatched
  for the first time in the judge era,
    and BOTH seeds judged restored
  on extreme under-credits (2/13 and 2/8 lexical words,
    unanimous).
  Its historic lexical-era "miss" was faithful rewording;
    with
  TLL1122 probed and A/B'd,
    every pre-judge question is now closed.
  SU5ZI2MO1's 20-word needle restored again (third time).
  JUDGE ACCUMULATED (repairable universe):
    78/92 (0.85) over 19 runs
  (22 to 40).
    Lexical 58/92 (0.63).
    Detection 164/170 (0.96).
  Lenient and probe-adjusted effective both 90/92 (0.98).
  run 41 (2026-07-18,
    1919 s):
    judge 2/4,
    lexical 1/4,
    detection 2/4;
  wangzihao980 and a2581911655 repaired (two dispatched,
    four
  budget-skipped).
    wangzihao980's first re-draw since run 22
  REPRODUCES it exactly:
    both seeds absent,
    detection false.
    With the
  probe's not-derivable verdict this is the correct-refusal case
  confirming across independent runs,
    and the detection "misses" are
  the same coin:
    nothing is actually missing relative to zh,
    so the
  panel rightly accepts no issue there.
    a2581911655 third draw,
    both
  restored again.
  JUDGE ACCUMULATED (repairable universe):
    80/96 (0.83) over 20 runs
  (22 to 41).
    Lexical 59/96 (0.61).
    Detection 166/174 (0.95,
    the four
  wangzihao980 falses being correct refusals in disguise).
    Lenient
  92/96 (0.96).
    Probe-adjusted effective 94/96 (0.98).
  PROMOTION AND DECLARATION (2026-07-18,
    user directive):
    the
  clause-enumeration rule is now a baseline editor prompt rule
  (commit `b6967cbc9`;
    the editorRuleAddendum plumbing stays for
  future calibration experiments),
    and MILESTONE TWO IS DECLARED
  COMPLETE with the final numbers recorded at the top of the resume
  block.
    Run 42,
    launched before the promotion,
    ran the old baseline
  and closes the baseline era;
    no run 43.
  run 42,
    CLOSING RUN (2026-07-18,
    1523 s,
    pre-promotion prompt):
  judge 2/4,
    lexical 2/4,
    detection 4/4;
    chunchun_yudong (first
  draw) both restored;
    SS3B_0016 (first draw) both partial,
    and an
  immediate derivability probe ruled both seeds PARTIALLY-DERIVABLE
  (unanimous,
    19 s):
    embellishment-capped,
    misses attributed,
    the
  dominant pattern to the end.
  WHOLE-ACCUMULATION TOTALS including the closing run,
    21 runs (22
  to 42),
    exactly 100 seed-results:
    judge strict 82/100 (0.82);
  PROBE-ADJUSTED EFFECTIVE 98/100 (0.98);
    lenient 96/100 (0.96);
  detection 170/178 (0.96);
    retired lexical 61/100 (0.61).
    LOOP
  CLOSED.
  NEXT AFTER CLOSURE:
    package completeness per PKG (README,
    exported
  API surface review,
    test coverage over every exported path) awaits
  user direction,
    as does any milestone-three scoping.
  The point after run 23 is where the user chose to compact.
  Seed-detection grading (commit `a5c368a8a`) is active from run 5:
  it splits panel detection misses from editor under-restoration
  per seed,
    which TLL1122 and luxuanwen3 need.
  PATTERN:
    every missed seed so far is the LONGEST needle of its
  entry,
    restored only partially (5/18 and 5/14 words returned);
  long omissions come back compressed.
    Calibration candidates when
  data accumulates:
    widen omission envelopes,
    or grade long needles
  by clause.
  Follow-ups beyond that,
    none yet requested:
    canary calibration
  feeding panel weights,
    per-model editor comparison in candidate
  slates.
    MILESTONE-TWO GO/NO-GO NUMBER:
    seeded
  repair rate,
    the fraction of seeded omissions whose repaired
  candidate restores content matching the known deleted needle
  (normalized similarity;
    we planted it,
    so ground truth is exact)
  with ZERO out-of-envelope diffs.
    Reuses the seeded harness and the
  25-minute budget discipline.
- Task list lives in the session task tool;
  mirror of current state is in "Task state" below.
