# Translation repair handover snapshot: 2026-09-06, part 11

Part 11 of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
whose index lists every part in order.

## What to do next, continued

    itself the class one hundred twelve shape,
    re-paired in 14336a1c2),
    replayed over mikaela15's section 2 pairing:
    `P3:3 S4+ S5+ S6+ S7+ T4+ T5+ T6+`):
    the roster had paired sources 0 to 2 and 8 onward and left sources 3 to 7 and targets 3 to 6 unplaced on both sides,
    which slicing read as insertions plus an undeclined target-only run riding into slice 13 (mikaela12 and 13 lost the passage the same way);
    `pairUnpartneredGaps` (`unpartnered-gap-steps.ts`) reads such an interior gap as one merge (first pair,
    the rest `continuesPairing` on both sides),
    applied by `blockPairingToSteps`;
    leading,
    trailing and one-sided gaps unchanged.
    Not exercised live yet.
    MIKAELA14 READ (frozen `0ab0abdd8`):
    launched 04:53 UTC,
    killed 05:05 UTC 2026-09-24 12 min in at consolidation chunk 26 under always-kill-and-relaunch,
    no tally,
    1,471 calls,
    0.57 USD by the meters;
    class one hundred eleven live at the admission (`insertion-carried-folded (slice 12 into slice 13)`,
    the warn line `slice 11 stays carried: evidence sits in slice at position 13, not a neighbour`,
    the `carried on 3 region(s)` line),
    which showed the chain arm:
    two carried slices in a row,
    the neighbour rule counting positions instead of paired slices,
    slice 11 doomed to the same publish stop;
    class one hundred seven live on slices 13,
    14,
    18 and 24,
    contest 25 of 34 differ,
    all 15 checker rounds 2 of 3,
    48 abstention lines.
    CHAIN ARM BUILT (caac222a6,
    guard red first 9bb99bf9f,
    full suite `suite-class111b.log` 1115 PASS,
    replayed over the real corpus slices 10 to 13:
    `slice 12 into slice 13`,
    `slice 11 into slice 10`):
    `pairedNeighbours` (`corpus-run/insertion-carried-decide.ts`) looks past insertions to the nearest paired slice on each side,
    the abutting check still refuses a fold across a source the carrier has not absorbed,
    and `foldPass` (`corpus-run/insertion-carried-fold.ts`) repeats at most once per carried passage until nothing more folds.
    Not exercised live yet.
    MIKAELA13 READ (frozen `457765221`):
    INCOMPLETE at 04:33 UTC 2026-09-24 in 15 min,
    one attempt,
    2,093 seats,
    1,678 calls,
    0.75 USD by the meters,
    no page or artifact;
    stopped at publish on `carried-insertion-evidence-lost slice 11` again:
    this pairing carried slice 11 alone (class one hundred ten not exercised in mikaela12's shape),
    the archive renders slices 10 to 12 as two paragraphs,
    the second ("That was originally just a typical thing.")
    rendering slice 11's opening clause and slice 12's line together,
    the one coverage ballot quoted both spans,
    the fold wanted one holder and stood aside silently,
    class one hundred seven disputed both neighbours and their stand-ins dropped the passage (class one hundred eleven);
    class one hundred nine not exercised (all 16 checker rounds heard 2 of 3),
    class one hundred seven live on slices 2,
    10,
    12,
    22 and 24,
    contest 24 of 34 differ,
    56 abstention lines,
    Jev 68 of 68.
    CLASS ONE HUNDRED ELEVEN BUILT (0ab0abdd8,
    guard red first 2925802e1,
    full suite `suite-class111.log` 1115 PASS,
    replayed over the real corpus texts of slices 10 to 12:
    `insertion-carried-folded (slice 11 into slice 10)`):
    the fold places each evidence region block by block (`corpus-run/insertion-carried-anchor.ts`,
    `anchorRegion`,
    one holder per block with its code-point share);
    every block must sit in a paired slice next to the carried one,
    the carrier is the neighbour holding the larger share (the earlier on a tie),
    the sources must abut (`corpus-run/insertion-carried-decide.ts`);
    every stand-aside names its reason and `pass-entry.ts` logs it at warn beside one `carried on N region(s)` line per still-carried passage.
    Not exercised live yet.
    MIKAELA12 READ (frozen `21ea25993`):
    INCOMPLETE at 03:54 UTC 2026-09-24 in 15 min,
    one attempt,
    2,196 seats,
    1,744 calls,
    0.71 USD by the meters,
    no page or artifact;
    stopped at publish on `carried-insertion-evidence-lost slice 14`:
    the September sentence the roster anchored sits inside slice 15's archive span (the archive merged two source paragraphs into one rendering),
    the translate lane wrote slice 15 from its own source alone,
    the slate chose the candidate without the passage,
    the contest and gate kept it (class one hundred ten);
    class one hundred nine not exercised (no hold inside the lane;
    all 16 checker rounds heard 2 of 3),
    class one hundred seven live on slices 2,
    15,
    19,
    20 and 26,
    49 abstention lines,
    Jev 78 of 78.
    CLASS ONE HUNDRED TEN BUILT (457765221,
    guard red first 750e87978,
    full suite `suite-class110.log` 1114 PASS with the load-sensitive `lane-contest-stage` grace-window case failing under the parallel run and passing alone):
    `foldCarriedInsertions` (`corpus-run/insertion-carried-fold.ts`) runs after the coverage admission in `pass-entry.ts`;
    where every evidence region of a carried insertion sits inside exactly one adjacent paired slice's target span and the two sources abut,
    the carrier's source widens over both,
    the carried slice moves to `admission.folded`,
    the lanes skip it,
    and the finding `insertion-carried-folded` prints;
    every other shape stands aside and stays carried.
    Not exercised live yet.
    SHI_YUMIAOYA18 READ (frozen `21ea25993`):
    SETTLED at 03:35 UTC 2026-09-24 in 7 min,
    one attempt,
    865 seats,
    686 calls,
    0.38 USD by the meters;
    class one hundred nine not exercised (no hold began inside the lane,
    no "checker stage re-seated" line;
    both checker rounds heard 2 of 3 on gemma-26b and gemma-4-e2b),
    class one hundred seven silent (no accepted addition claim against the archive),
    the filers log live (34 lines),
    the lanes agreed on six slices including the closing quote,
    which shipped as the archive's two lines (classes eighty and one hundred two fine),
    classes seventy-eight,
    seventy-nine,
    ninety-two,
    ninety-five,
    ninety-six and one hundred one holding,
    every check as `shi_Yumiaoya17` (4 headings,
    front matter equal,
    no TA,
    no error finish,
    no double blank line),
    the two page-assembly passes silent,
    slice 12 slate-declined,
    slice 13 gate-kept,
    9 abstention lines,
    Jev 24 of 24;
    no class.
    CLASS ONE HUNDRED NINE BUILT (21ea25993,
    guards red first 1ab453219,
    full suite green `suite-class109.log` 1114 PASS):
    the checker stage re-reads the seating at the stage itself (`repair-checker-reseat.ts` `checkerBenchAtStage`,
    threaded as `reseat` from `repairPreparedDocument` to `proveRepairedChunk` in `repair-chunk-proof.ts`),
    since the class one hundred three re-seat lands only at a chunk's start and with overlap 8 the chunks in flight kept a stale bench through their checker stage;
    not exercised live yet (needs a provider drying out inside the repair lane).
    ZHEERMAO9 READ (entry `zheermao101`,
    frozen `85ed2881f`):
    SETTLED at 03:04 UTC 2026-09-24 in 20 min,
    one attempt,
    988 seats,
    759 calls,
    0.37 USD by the meters;
    class one hundred three live (Synthetic's weekly allowance ran out at 02:56 UTC inside the repair lane,
    five chunks re-seated under the hold to Qwen,
    gemma-26b and gemma-4-e2b),
    class one hundred six not exercised (slice 9's contest chose the repair lane 5 of 5;
    the reply label reads "One Among Us members sent her a reply that very night:"),
    class one hundred seven live on slice 0 (two accepted addition claims,
    the contest chose translate 3 of 4),
    classes seventy-seven,
    ninety-six,
    one hundred one,
    two and four holding,
    every check as `zheermao8`,
    10 abstention lines,
    Jev 29 of 29;
    but seven of eight checker rounds after the dry-out heard 1 of 3 on the stale static bench (class one hundred nine,
    built as read).
    CUSPARIAKLSY12 READ (frozen `85ed2881f`):
    SETTLED at 02:42 UTC 2026-09-24 in 25 min (Synthetic's latency),
    one attempt,
    437 seats,
    420 calls,
    0.13 USD by the meters;
    class one hundred eight live on slice 3 (the repair lane softened the accepted addition into "She fell asleep";
    with the ARCHIVE RENDERING DISPUTED block on the sheets the translate slate ran off and chose the candidate without it,
    the contest chose translate 4 of 5 with every ballot calling the archive flawed,
    the gate kept the contest winner with a ballot writing "both omit the rejected medication detail";
    the page reads "She then attempted suicide and was sent to the hospital for emergency treatment" with no medication detail),
    class one hundred seven live on slice 3 (three accepted claims;
    slice 1 undisputed this run),
    classes one hundred four and five holding,
    every check as `CuspariaKLSY11`,
    slice 1 gate-kept,
    slice 2 slate-declined,
    10 abstention lines,
    Jev 12 of 12,
    glm-5.3 dark on Hyper dry;
    no class.
    CUSPARIAKLSY11 READ (frozen `a40c28cad`):
    SETTLED at 01:55 UTC 2026-09-24 in 5 min,
    one attempt,
    327 seats,
    13 retry rounds,
    256 calls,
    0.10 USD by the meters;
    class one hundred seven live (`translate-archive-disputed` on slices 1 and 3 in the lanes and the consolidation,
    the stand-in the incumbent,
    slice 3 shipped as `{kind: incumbent}` gate-kept,
    the archive's "swallowed lots of her meds" never on the page),
    classes one hundred four and five holding,
    every check as `CuspariaKLSY10`,
    5 abstention lines,
    Jev 11 of 11;
    but the death paragraph still reads "She took medication that night" (服药 nowhere in the original):
    the repair lane softened the accepted addition,
    the contest split 2 to 2,
    the consolidated proposal dropped it,
    the gate split 2 to 2 and kept the stand-in on "dropped page content ... which the Chinese does not contradict":
    class one hundred eight,
    built (the CLASS ONE HUNDRED EIGHT BUILT line).
    CLASS ONE HUNDRED EIGHT BUILT:
    `archiveDisputeNote` (`archive-dispute.ts`) writes the ARCHIVE RENDERING DISPUTED block naming the accepted claims and saying a detail they name is neither page content nor apparatus,
    in the archive's wording or any softer one;
    carried on the consolidation writer,
    slate judge and gate sheets,
    the translate writer and slate judge sheets,
    and the lane contest sheet and key;
    the repair lane's own sheets unchanged;
    guards red first `65d159d2a`,
    built `85ed2881f`,
    lint 0/0,
    types clean,
    full suite green (`suite-class108.log`,
    1113 PASS),
    replayed over the `CuspariaKLSY11` artifact,
    ninth ineligible-standing addendum;
    running on `CuspariaKLSY12`.
    CLASS ONE HUNDRED SEVEN BUILT (owner Q2:
    "Not eligible;
    fall back to the repair text"):
    `archiveDisputesOf` (`archive-dispute.ts`) off the repair chunks,
    the repair text standing in for a disputed archive rendering as the translate slate's and the consolidation's incumbent (`consolidate-archive-stand-in.ts`),
    finding `translate-archive-disputed`;
    guards red first `fba338dc1`,
    built `a452db225`,
    full suite green (`suite-class107.log`,
    1109 PASS),
    eighth addendum `a40c28cad`;
    live on `CuspariaKLSY11`.
    YINGYING8 READ (frozen `d2e39e095`):
    SETTLED at 00:31 UTC 2026-09-24 in 5 min,
    one attempt,
    310 seats,
    13 retry rounds,
    266 calls,
    0.07 USD by the meters;
    class one hundred four on the wire (one polish gate run,
    4 of 7 usable,
    settled on neither,
    base shipped),
    class one hundred five silent by design,
    classes eighty-six,
    ninety-seven,
    one hundred one and one hundred two holding,
    every check as `yingying7` (1 heading,
    4 markers,
    2 definitions,
    front matter equal,
    References line kept,
    "[Farewell.
    I miss you,
    Yingying.]",
    "May you still have",
    no TA,
    no error finish,
    no double blank line),
    8 abstention lines,
    Jev 12 of 12;
    observation,
    not a class:
    slice 1's repair text dropped 硬核视频 ("hardcore video") before "Geek Lab",
    unendorsed.
    GPT-OSS-120B CULLED from every role (owner,
    2026-09-24,
    on the `CuspariaKLSY10` slice 1 claim inverting cause and effect:
    "That particular model got cause and effect wrong.
    Cull it."
    then "cull it from every role"):
    off `RUN_ROSTER` and the static checker bench,
    blocklisted with the owner's words,
    seating-decision addendum,
    through `bc10e3b70`,
    full suite green (`suite-cull2.log`,
    1106 PASS).
    CLAIM FILERS LOGGED (owner:
    "we're not logging enough then.
    Refine how we log."):
    `claim-filers.ts` logs every resolved claim with its filers at the critic stage and every adjudicated issue with each claim's filers,
    and the artifact's adjudicated issues carry `filedBy`;
    `SLICE_CACHE_VERSION` 31;
    guard red first `f049298ac`,
    built `9a6327de5`,
    full suite green (`suite-filers2.log`,
    1107 PASS).
    CLASS ONE HUNDRED SIX BUILT (owner Q1:
    "Run-off only when every contest ballot called the archive flawed"):
    `archiveFlawedByAll` (`consolidate-archive-flawed.ts`) on the contest ballots,
    `runoffOverStanding` through `consolidate-driver.ts`,
    `consolidate-slice-buy.ts` and `consolidate-settle.ts` into `judgeSlateWithRetry`;
    `translate-judge.ts` names `runoffFinalists` on a decline over an incumbent and `translate-retry.ts` narrows and reruns;
    an undecided run-off still ships the standing;
    guards red first `200bf7a53`,
    built `2a872bbed`,
    lint 0/0,
    types clean,
    full suite green (`suite-class106.log`,
    1108 PASS),
    seventh ineligible-standing addendum `7c729d339`;
    not exercised live yet.
    ZHEERMAO8 READ (frozen `d2e39e095`):
    SETTLED at 00:23 UTC 2026-09-24 in 14 min,
    one attempt,
    859 seats,
    33 retry rounds,
    0.25 USD by the meters;
    class one hundred four on the wire (the polish gate on seven slices,
    ballots reading the house rules,
    no tense called a change of meaning),
    class one hundred five silent by design,
    classes seventy-seven,
    ninety-six,
    one hundred one and one hundred two holding,
    every check as `zheermao7`,
    15 abstention lines,
    Jev 25 of 25;
    the reply label kept the archive's "one member ... immediately" for 那些秋叶的成员…连夜 on a 2 to 2 contest (every ballot calling the archive flawed) and a 1/1/1 slate with both lane texts on offer through the class forty path,
    the eligible standing keeping its single round:
    class one hundred six,
    built (see the CLASS ONE HUNDRED SIX BUILT line).
    CUSPARIAKLSY10 READ (frozen `d2e39e095`):
    SETTLED at 00:06 UTC 2026-09-24 in 7 min,
    one attempt,
    375 seats,
    12 retry rounds,
    0.18 USD by the meters;
    class one hundred four live (the life in the past,
    the slice 0 polish gate citing the house tense rule and no ballot calling the tense a change of meaning),
    class one hundred five live (the bench dropped the gloss line again,
    `name-gloss-restored` printed,
    the gloss on the page after the nickname line),
    classes seventy-five,
    seventy-six,
    eighty-five and ninety-six holding,
    every check as `CuspariaKLSY8`,
    13 abstention lines,
    Jev 13 of 13;
    observation,
    not built:
    the death paragraph shipped the repair lane's minimal edit (the fabricated method removed,
    brain-dead restored) with the archive's own omissions (双方情绪爆发,
    抢救,
    又,
    再次得到消息,
    "by" for 于),
    unendorsed;
    the translate slate backed no candidate so the archive stood by the eligible-standing single round,
    the contest chose repair 3 of 4,
    the consolidation slate tied 1/1/0.5 and kept the standing;
    open question for the owner:
    whether an archive rendering the adjudicators found to fabricate a suicide method stays an eligible standing for the translate slate's single round.
    CUSPARIAKLSY9 READ (frozen `334c02f23`):
    SETTLED at 23:41 UTC 2026-09-23 in 4 min,
    one attempt,
    357 seats,
    11 retry rounds,
    0.16 USD by the meters;
    no hold ran,
    so class one hundred three not exercised (checkers 2 of 3 on the substitute and gpt-oss by the dry reading at the lanes boundary);
    1 heading,
    front matter equal,
    no TA,
    no error finish,
    no double blank line,
    7 abstention lines,
    Jev 14 of 14;
    but slice 0 shipped the archive's present tense because the polish gate refused GLM-5.3-Flash's past-tense polish 4 of 4 as "an unsupported change of meaning" with no house rule on its sheet (class one hundred four;
    the slate before it split 1.5/1/1 with an eligible standing keeping its single round by the owner's addenda),
    and slice 1 lost the archive's gloss line a third time on the judges' call,
    the contest 4 to 1 for the gloss-less translate text and the slate endorsing it 4 of 5 (class one hundred five).
    CLASSES ONE HUNDRED FOUR AND FIVE FIXED in d2e39e095:
    `POLISH_GATE_HOUSE_RULES` (`polish-gate-house-rules.ts`,
    "a tense the house rules set is not a change of meaning" plus `JUDGE_POLICY_BLOCK`) on the polish gate's sheet in both modes;
    `restoreNameGlossLines` (`corpus-run/name-gloss-restore.ts`,
    after the titles pass in `page-assembly-guard.ts`) restores the archive's “name” means … line after the name's first appearance in a replaced slice that carries the name unglossed,
    finding `name-gloss-restored`;
    guards red first 487cb2681,
    lint 0/0,
    types clean,
    full suite green (`suite-class104-105.log`,
    1105 PASS),
    replayed over the real `CuspariaKLSY9` slice 1.
    ZHEERMAO7 READ (frozen `6361d74d0`):
    SETTLED at 23:20 UTC 2026-09-23 in 17 min,
    one attempt,
    972 seats,
    32 retry rounds,
    0.52 USD by the meters;
    classes seventy-seven,
    ninety-six,
    one hundred one and one hundred two holding,
    every check as `zheermao6`,
    five slate-declined,
    one gate-kept,
    32 abstention lines,
    Jev 28 of 28;
    but Synthetic's window ran out at 23:15:27 UTC two minutes into the repair lane and the checker bench read once at the lanes boundary (two Synthetic-only seats) ran ten of twelve checker rounds and probes on gpt-oss alone,
    short of quorum,
    while the substitute a dry reading seats sat idle (class one hundred three);
    fixed in 334c02f23 (the repair lane's per-chunk hook re-reads the seats under a hold and hands the driver a `RepairSliceSeating`,
    kept once read;
    `pass-reseat.ts`,
    `repair-contract.ts`,
    `document-lanes.ts`,
    `repair-translation.ts`),
    guards red first c036471c3,
    lint 0/0,
    types clean,
    full suite `suite-class103.log`.
    YINGYING7 READ (frozen `6361d74d0`):
    SETTLED at 23:01 UTC 2026-09-23 in 19 min against yingying6's 4,
    one attempt,
    365 seats,
    1 retry round,
    0.08 USD by the meters;
    classes eighty-six and ninety-seven holding,
    classes one hundred one and one hundred two fine,
    every check as `yingying6`,
    one gate-kept (2),
    3 abstention lines,
    Jev 8 of 8;
    no class;
    the time is Synthetic's (wet again from 22:42 UTC,
    GLM-5.3-Flash 19 streams at 50 s mean there,
    1,270 s of grace across 80 rounds against 91 s),
    the standing latency observation.
    SHI_YUMIAOYA17 READ (frozen `6361d74d0`):
    SETTLED at 22:42 UTC 2026-09-23 in 6 min,
    one attempt,
    879 seats,
    33 retry rounds,
    0.49 USD by the meters;
    the closing quote as the archive's two lines (class one hundred two not exercised live:
    no lane text refused on slice 16 this run,
    the eligible standing shipped unjudged),
    class one hundred one holding (the `[^1]` definition the page's last line,
    the source's one marker),
    the two page-assembly passes silent,
    classes seventy-eight,
    seventy-nine,
    ninety-two,
    ninety-five and ninety-six holding,
    every check as `shi_Yumiaoya14`,
    five slate-declined,
    three gate-kept,
    16 abstention lines,
    Jev 22 of 22;
    no class.
    SHI_YUMIAOYA16 READ (frozen `314ca4b8c`):
    SETTLED at 22:29 UTC 2026-09-23 in 6 min,
    one attempt,
    880 seats,
    32 retry rounds,
    0.60 USD by the meters;
    class one hundred one live (the `[^1]` definition the page's last line,
    both source markers on the page),
    the two page-assembly passes silent,
    classes seventy-eight,
    seventy-nine,
    ninety-two,
    ninety-five and ninety-six holding,
    every check as `shi_Yumiaoya14`,
    one unendorsed (0),
    13 abstention lines,
    Jev 20 of 20;
    but the closing quote shipped its Chinese line beside the English (three lines against the archive's two):
    the repair lane text was refused as the standing on the class eighty pair bound and re-entered through the class forty lane offer,
    whose rule ran without `lineStructured` (class one hundred two);
    fixed in 6361d74d0 (`consolidate-lane-offer.ts` takes the flag,
    `consolidate-driver.ts` passes it),
    guard red first 404b5dada,
    lint 0/0,
    types clean,
    full suite green (`suite-class102.log`,
    1103 PASS),
    replayed over the run's real slice 16 data;
    open,
    not built:
    the repair lane's own floor let the three-line text into the contest.
    SHI_YUMIAOYA15 READ (frozen `0f685f551`):
    TALLY ERROR at 22:14 UTC 2026-09-23 in 7 min,
    two attempts,
    1,020 seats,
    39 retry rounds,
    0.53 USD by the meters,
    no page or artifact;
    "1 wording(s) the artifact says would ship are not in the page in slice order,
    at slices 17 (237 characters)":
    the source's `[^1]` definition,
    inserted,
    whose winning candidate ended in two spaces the insertion composer cuts while the wording check searched the raw text (class one hundred one);
    fixed in 314ca4b8c (`published-page-check.ts`:
    the scan searches the fragment body both splice paths leave on the page),
    guard red first 4c36039b0,
    lint 0/0,
    types clean,
    full suite green (`suite-class101.log`,
    1103 PASS),
    replayed over the run's real wording through `composeInsertion`;
    the two page-assembly passes silent,
    one unendorsed (16),
    24 abstention lines,
    Jev 25 of 25.
    MIKAELA11 READ (frozen `0f685f551`):
    SETTLED at 22:07 UTC 2026-09-23 in 11 min,
    one attempt,
    2,124 seats,
    60 retry rounds,
    1.07 USD by the meters;
    the two page-assembly passes silent,
    classes seventy to seventy-seven and ninety-six holding,
    every check as `mikaela10`,
    four unendorsed (0,
    7,
    12,
    29),
    67 abstention lines;
    no class.
    HULICAIJIA16 READ (frozen `0f685f551`):
    SETTLED at 21:55 UTC 2026-09-23 in 27 min,
    one attempt,
    4,482 seats,
    144 retry rounds,
    3.81 USD by the meters;
    the two page-assembly passes silent by design (the archive renders every heading,
    no rewritten tag attribute),
    classes eighty-four,
    ninety-two,
    ninety-five and ninety-six holding,
    every check as `hulicaijia15` (13 headings,
    18 markers,
    9 definitions,
    2 links,
    3 Sakura,
    front matter equal,
    no TA,
    no error finish,
    no double blank line),
    one unendorsed (35),
    130 abstention lines;
    no class.
    XINGZ631 READ (frozen `5e21134ee`):
    SETTLED at 21:22 UTC 2026-09-23 in 43 min,
    one attempt,
    8,077 seats,
    244 retry rounds,
    8.59 USD by the meters;
    classes ninety-nine and one hundred live (one marker restored to `II`,
    the six markers `II` to `VII`;
    the pinyin credit "Ling Chong Qi Yuan" unified to "Zero-Layer Prayer";
    the link,
    the first credit and footnote 6 already carrying their headings' renderings),
    classes eighty-eight to ninety-eight holding,
    class ninety-four not exercised (the placeholder kept,
    the fifth treatment in six runs;
    the placeholder question stays open for the owner),
    every structural check as `XingZ630`,
    five unendorsed (18,
    27,
    54,
    57,
    65),
    196 abstention lines;
    but the quote search read a TextRing tag's two quoted attributes as spans on slice 98 and stood aside without comparing (the page was right by the bench's own choice);
    fixed in 0f685f551 (`title-reference-marks.ts`:
    a quote span after an attribute's equals sign is skipped,
    and among several spans the one already carrying the heading settles the reading),
    guard red first 1c67cb139,
    lint 0/0,
    types clean,
    full suite green (`suite-class100b.log`,
    1103 PASS),
    replayed over the `XingZ631` artifact;
    observations beside it,
    not built:
    the coined 螐 in two treatments on one page ("A little wun[^7]" and "螐儿",
    three runs,
    three treatments),
    the album 【妄想症Paranoia】 as "【Paranoia】" on the first credit and in full on the second.
    XINGZ630 READ (frozen `2c3a80370`):
    SETTLED at 20:15 UTC 2026-09-23 in 76 min,
    one attempt,
    8,436 seats,
    326 retry rounds,
    8.98 USD by the meters;
    class ninety-eight live (one gemma-4-e2b candidate refused for 《九重现实》 in Han;
    both credits and the linked title in English,
    the second credit's Han in parentheses after the English),
    class ninety-seven on the wire again (thirteen refusals,
    the page in the second person),
    classes eighty-eight to ninety-three holding,
    class ninety-four not exercised (the review kept the placeholder this run,
    the fourth treatment in five runs;
    the placeholder question stays open for the owner),
    every structural check as `XingZ629`,
    five unendorsed (17,
    18,
    27,
    31,
    40),
    207 abstention lines;
    but the marker series shipped `n="II"`,
    `n="5"` and `n="七"` where the archive writes Roman numerals (class ninety-nine) and 笼中之鸟 and 零重祈愿 reached the page in two English renderings each,
    the heading against the linked credit and the heading against footnote 6 (class one hundred;
    `XingZ629` had the same split on the Bird in a Cage link);
    an observation beside them:
    the coined 螐 shipped as "A wu[^7] bird" where `XingZ629` kept the character (one run,
    not built).
    CLASSES NINETY-NINE AND ONE HUNDRED FIXED:
    two page-assembly passes after the heading series pass;
    `restoreJsxAttributes` (`corpus-run/jsx-attribute-restore.ts`,
    `tag-attributes.ts`) takes the archive's value of every quoted attribute where the page carries the archive slice's tags in order;
    `unifyTitleReferences` (`corpus-run/title-reference-unify.ts`,
    `heading-title-lines.ts`,
    `title-reference-locate.ts`,
    `title-reference-scope.ts`) pairs every Han heading with its page rendering and rewrites each bracketed reference in a replaced slice to it,
    located by link destination,
    Han gloss,
    title brackets or quotes,
    the search held to the footnote's own line where the reference stands in a definition,
    reporting an ambiguous slice rather than guessing;
    guards red first a86a3757e and a1ce2c580,
    fixed 2f8bcfe93 and 5e21134ee,
    lint 0/0,
    types clean,
    full suite green twice (`suite-class99-100b.log`,
    1103 PASS),
    replayed over the real `XingZ629` and `XingZ630` artifacts (the markers to `V` and `VII`,
    the link,
    the Han credit and the footnote to their headings).
    XINGZ629 READ (frozen `e78515f56`):
    SETTLED at 18:39 UTC 2026-09-23 in 50 min,
    one attempt,
    8,350 seats,
    286 retry rounds,
    8.70 USD by the meters;
    class ninety-seven on the wire (two minimax-m3 translate candidates refused on the meteor address,
    slices 111 and 115,
    the page addressing her in the second person),
    classes eighty-eight to ninety-three holding,
    class ninety-four not exercised (the review revised the placeholder into an under-construction warning instead of removing it,
    the third treatment in four runs;
    the placeholder question stays open for the owner),
    every structural check as `XingZ628`,
    eight unendorsed (three gate-kept,
    five slate-declined),
    183 abstention lines;
    but the second song credit shipped its title in Han,
    "《零重祈愿》",
    where `XingZ627` and `XingZ628` wrote "《Zero-Layer Prayer》" (class ninety-eight),
    the same flip as the Bird in a Cage link text on `XingZ619` and `XingZ628`;
    an observation beside it:
    the first credit dropped the album name 【妄想症Paranoia】 the original carries (one run,
    not built).
    CLASS NINETY-EIGHT FIXED:
    `hanTitleFindings` (`translate-han-title.ts`,
    `han-only-text.ts`) refuses before any judge a candidate that leaves a 《》-bracketed Han-only title standing bare (no English gloss in parentheses beside it) on a page that never wrote it,
    reading a `《[title](url)》` bracket by its link text;
    the marker,
    address and title floors fold into `sourceCarryFindings` (`translate-source-carry.ts`);
    the policy's work-title bullet says a title is never left in Han as the work's name;
    guards red first 5d58ca85c and 051e7b060,
    fixed 012cec9a1 and 2c3a80370,
    lint 0/0,
    types clean,
    full suite green (`suite-class98b.log`,
    1101 PASS),
    replayed over the real `XingZ629` slice 101 and `XingZ628` slice 95 shipped texts (both refused) and the translated credits (accepted).
    YINGYING6 READ (frozen `e78515f56`):
    SETTLED at 17:49 UTC 2026-09-23 in 4 min,
    one attempt,
    327 seats,
    9 retry rounds,
    0.13 USD by the meters;
    class ninety-seven live (the repair lane's "May she" won the contest and was refused by the floor,
    the standing withheld,
    the translate lane's "May you" shipped through the class forty offer,
    gate 3 to 1),
    class eighty-six holding,
    every check as `yingying4`;
    no class.
    CUSPARIAKLSY8 READ (frozen `e78515f56`):
    SETTLED at 17:44 UTC 2026-09-23 in 10 min,
    one attempt,
    383 seats,
    11 retry rounds,
    0.17 USD by the meters;
    class ninety-seven silent by design (no 你 in the original),
    classes seventy-five,
    seventy-six,
    eighty-five and ninety-six holding (the gloss in the parenthetical form this run),
    every check as `CuspariaKLSY7`;
    no class.
    ZHEERMAO6 READ (frozen `e78515f56`):
    SETTLED at 17:33 UTC 2026-09-23 in 12 min,
    one attempt,
    958 seats,
    34 retry rounds,
    0.31 USD by the meters;
    class ninety-seven not exercised (the bench kept "Thank you ... I'll treat you" itself,
    no refusal),
    classes seventy-seven and ninety-six holding,
    every check as `zheermao4`,
    the email conversation as the archive this run;
    no class.
    YINGYING5 READ (frozen `c62ce70b3`):
    SETTLED at 17:11 UTC 2026-09-23 in 6 min,
    one attempt,
    298 seats,
    11 retry rounds,
    0.21 USD by the meters;
    classes eighty-six,
    ninety-two,
    ninety-five and ninety-six holding,
    every check as `yingying4`;
    but the farewell shipped in the archive's third person ("May she still have...") where the original writes 你 and `yingying1` to `4` wrote "May you":
    the contest tied 2 to 2,
    the consolidation proposed "you",
    the gate kept the standing 2 to 1 on a ballot reading 你 as "she" (class ninety-seven).
    CLASS NINETY-SEVEN FIXED:
    `translate-address-drop.ts` refuses,
    before any judge,
    a candidate carrying no second-person pronoun and a third-person one where the original writes 你 or 您 outside a greeting (comments cut;
    a pronoun-free rendering stays with the judges);
    wired into `validateTranslatedSlice` after the marker floor;
    guard red first `8598cfaeb`,
    fix `e78515f56`,
    lint 0/0,
    types clean,
    full suite green (`suite-class97.log`,
    1100 PASS).
    SHI_YUMIAOYA14 READ (frozen `c62ce70b3`):
    SETTLED at 17:05 UTC 2026-09-23 in 9 min,
    one attempt,
    880 seats,
    38 retry rounds,
    0.54 USD by the meters;
    classes seventy-eight to eighty holding,
    every check as `shi_Yumiaoya13`,
    no unendorsed standing;
    no class.
    MIKAELA10 READ (frozen `c62ce70b3`):
    SETTLED at 16:55 UTC 2026-09-23 in 15 min,
    one attempt,
    2,336 seats,
    65 retry rounds,
    1.21 USD by the meters;
    class ninety-six live ("𝓠𝓾𝓪𝓷’s classmate" curled,
    only the archive's four JSX path literals straight),
    classes seventy to seventy-seven holding,
    every check as `mikaela9`,
    two unendorsed (12,
    19);
    no class.
    MIKAELA9 READ (frozen `b26ea1990`):
    SETTLED at 16:35 UTC 2026-09-23 in 18 min,
    one attempt,
    2,673 seats,
    135 retry rounds,
    1.23 USD by the meters;
    classes seventy to seventy-seven holding,
    every check as `mikaela7`,
    one unendorsed (17);
    but "𝓠𝓾𝓪𝓷's classmate" shipped with a straight apostrophe where the archive curls it:
    the restoration read the neighbour of a quote by UTF-16 unit and saw a lone surrogate (class ninety-six).
    CLASS NINETY-SIX FIXED:
    `restore-typography.ts` reads the neighbours of a quote as whole code points (`codePointBefore`,
    `codePointAt`) and tests letters by general category;
    guard red first `d8b284bf9`,
    fix `c62ce70b3`,
    lint 0/0,
    types clean,
    full suite green (`suite-class96.log`,
    1099 PASS).
    HULICAIJIA15 READ (frozen `b26ea1990`):
    SETTLED at 16:15 UTC 2026-09-23 in 37 min,
    one attempt,
    4,697 seats,
    125 retry rounds,
    4.06 USD by the meters;
    the roster paired 15 of 15 so the relabel closed on the definitions alone (class ninety-five not exercised live;
    its unit guards stand),
    no trim or revert,
    no marker-drop refusal;
    every check as `hulicaijia13` (13 headings,
    18 markers,
    9 definitions,
    2 links,
    3 Sakura,
    front matter equal,
    no TA,
