# Translation repair history: Early foundation, segment 3, part 02

Part 02 of [Translation repair history: Early foundation, segment 3](translation-repair-history-01-early-foundation-segment-03-part-01.md),
whose index lists every part in order.

## Continued record, continued

### Preserved chronological continuation, continued

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
