# Translation repair history: Early foundation, segment 3, part 03

Part 03 of [Translation repair history: Early foundation, segment 3](translation-repair-history-01-early-foundation-segment-03-part-01.md),
whose index lists every part in order.

## Continued record, continued

### Preserved chronological continuation, continued

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
