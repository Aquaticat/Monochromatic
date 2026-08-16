# Decisions waiting on you, 2026-08-15 morning

Written overnight on 2026-08-14 to 15, while the translate lane was built out.
Each question below is one I could not answer from the code, the corpus, or a
measurement I could take without spending your quota on a decision you may
reverse.
Every one of them names what it blocks, so you can skip the ones that block
nothing you care about today.

The last section lists decisions I took WITHOUT you, with the reasoning, so you
can veto any of them cheaply.

READ QUESTION 5 FIRST if you read only one. It was not on the list last night;
the bench put it there. The lane replaces the archive's English on most of the
slices it was benched over, and that is a decision about what this project is,
not a tuning question. It is also the one that blocks wiring the corpus pass,
because report-only and shipping are different wirings.

QUESTION 6 arrived from a defect rather than a bench: both drivers were caching
slices an aborted run never bought. That is fixed; what remains is a narrower
judgement about thin rosters, and it blocks nothing.

QUESTION 7 ARRIVED LAST, from a free measurement over the pinned corpus rather
than from either. One entry in it produces no slices at all and settles as a
clean unchanged document on the strength of having examined nothing. The
question is what the one whole-document refusal should count against, and my
own answer is in it, so delegating is cheap.

WHAT LANDED AFTER THIS DOCUMENT WAS FIRST WRITTEN, so you are not reading
yesterday's state:

-   Both lanes now run from one driver that arbitrates nothing, and each lane
    result names the slices it shipped and withdrew rather than only counting
    them. Decisions 16 and 17, both open to veto.
-   The bench prices sending and answering separately now. Decision 18.
-   QUESTION 1'S COST BULLET CHANGED, because the same bench rows were re-read
    per stage at no new cost and the previous reading was half wrong. Read that
    bullet again if you answer Question 1 from cost.
-   THE ASSEMBLY CONTRACT WAS REBUILT, in decisions 20, 21 and 22. Three things
    changed that a reader of a count needs to know. A contradictory cached slice
    is now discarded and recomputed rather than reaching assembly, so one bad
    file costs one slice. An assembly that changes no byte now ships nothing,
    whatever its slices decided. And the shipped set is DERIVED from the
    surviving replacements and checked against the document's own bytes rather
    than accepted as a separate list.
-   WHAT `withdrawn` MEANS IS WIDER THAN IT WAS. It used to be an integrity veto
    and nothing else. It now says the document does not carry that slice's
    change, for any of three reasons, and only the findings say which. If you
    were going to read `withdrawnSliceCount` as footnote damage, do not; it
    would over-count.
-   ONE SUSPECTED DEFECT WAS REFUTED RATHER THAN FIXED, `#97`. The claim was
    that a checker verdict recorded as `resolved` might describe pre-refinement
    text. A checker DOES run after refinement, and any issue it fails to
    re-confirm rolls back the whole slice. Measured over the 56 settled
    artifacts: 32 resolved-and-refined slices against 32 re-check findings, zero
    violations, with the probe validated first. Nothing to build.
-   THE EMPTY-ROSTER REFUSAL WAS BUILT for every role except the critics. A lane
    configured with nobody in a required role now refuses before buying
    anything, at all three depths a caller can enter at. The quiet path is still
    right for OUTAGES and is untouched; what is refused is the deterministic
    case, before any work is done. CRITICS ARE STILL UNGUARDED, and that is
    Question 3's doing rather than an oversight: if the critic stage survives,
    an empty critic roster is a misconfiguration and belongs in the same check,
    and if it does not survive, an empty critic roster is the intended
    configuration. A second review sharpened the cost of leaving it open: the
    stage RUNS today, so an empty critic roster today produces exactly the quiet
    vacuous pass this check exists to refuse. Task `#93` carries the remainder.
-   THE ASSEMBLY AND SLICE-RECORD CONTRACTS WERE HARDENED AGAIN overnight on the
    15th, after a second review of the same code. Three of these change numbers
    you may read, so they are worth knowing before you read any:
    -   A NATURALNESS REFINEMENT THAT LANDS BACK ON THE ARCHIVE WORDING is now
        recorded as unchanged, and its slice's resolved-issue credit is dropped.
        The rewriter is measured against the accuracy text it rewrites, so it
        can move off that text right back onto the archive's own words; that was
        being recorded as a change, which would have named the slice in the
        shipped set and then failed the whole document at assembly.
    -   A FRESHLY SETTLED SLICE RECORD is now checked against its own text
        before it is cached, on both lanes, exactly as a resumed one is. Only
        one direction of that contradiction was ever caught downstream: a record
        claiming a change it did not make is refused at assembly, while one
        DENYING a change it made was dropped in silence.
    -   REFINEMENT NOW HONORS THE ABORT. It had none: a torn-down exchange
        surfaced as whichever stage happened to fail, and a phase that settled
        under an abort returned a document that read as a finished run. A fully
        cached document still finishes, because what a stopped run cannot do is
        buy what it is missing.
-   A REPO-WIDE LINT GAP was measured while doing that, and it is a question for
    you rather than a defect: `doc/planning/unused-import-lint-policy.md`. It
    blocks nothing.
-   THE EVENING OF THE 15TH went to the cache-key review and to the first two
    landings of one-sided slicing. NONE OF IT ADDS A QUESTION, which is why it
    is a list rather than a section: every choice in it was settled by a review,
    by your ruling on the cache keys, or by the design already recorded in
    `#100`. Decisions 23 to 25 carry the reasoning, and what changed is:
    -   A SLICE'S CACHE KEY NO LONGER NAMES ITS POSITION, on both lanes, which
        is the change you authorized to land while the window is free. A record
        is now keyed by what was asked, and the answer to that question does not
        depend on where in the document it was asked; a resumed record is
        re-stamped with the index it is resumed under. Both caches were measured
        empty first, so nothing was discarded.
    -   A REFUSAL THAT NAMES A SLICE BY NUMBER IS NO LONGER STORED. It was the
        one thing in a stored record that did depend on position, so it would
        have survived the key change and reported the wrong slice number after a
        resume. The number is now derived at the document level, where the
        positions are known.
    -   A COLD RUN AND A WARM ONE NOW BUY THE SAME THING. Both lanes memoized
        every settled slice in process, including ones the cache deliberately
        refused to persist, so a document with two identical sections bought one
        of them on a cold run and two on a resumed one, and no count said so.
    -   A CHUNK CAN NOW NAME A PLACE rather than only cover text, and assembly
        refuses every placement shape that would move or overwrite existing
        wording. Nothing produces such an anchor yet, deliberately: `#100` lands
        the producers last, so by the time a section with no translation is
        sliced, the assembly it flows into already refuses what it must.
    -   THE BLANK LINE BETWEEN TWO BLOCKS HAS AN OWNER, which is assembly rather
        than the prompt. This closes `#101`.
    -   THE LANES CAN NOW BE HANDED A SLICE THE ARCHIVE NEVER TRANSLATED, which
        is the third landing of `#100`. The translate lane refuses to settle one
        it could not fill rather than reporting a settled slice carrying the
        empty string, and the repair lane says the question does not apply
        rather than sending critics to complain about a blank. Decisions 26 and
        27 carry the two choices in it that are yours to veto; nothing produces
        such a slice yet, so no run changes today.
-   THE NIGHT OF THE 15TH INTO THE 16TH went to the quote anchoring chain and to
    building `#84`'s instrument. One item here changes a number you may read and
    one adds a question, so both are stated plainly:
    -   QUOTE ANCHORING COULD ANCHOR A CRITIC'S QUOTE TO THE WRONG OCCURRENCE.
        Ambiguity was judged inside each matching pass rather than over the
        broadest form the chain accepts, so a quote appearing twice under
        whitespace folding could still bind to the first. The three passes are
        now one, over one normalization. MEASURED COST: zero. Across three
        corpus passes, 16,479 real critic quotes, not one became ambiguous under
        the stricter rule, and a positive control proved the probe could see
        ambiguity when it exists (566 hits when the same needles were searched
        over whole pages). The slice cache version moved for it, since the
        change alters which claims survive while every keyed input stays
        identical.
    -   `#84` NOW HAS AN INSTRUMENT AND A FIRST READING, which Question 5 carries
        in full. The short version: over four entries the judges chose the
        complete text in all sixteen trials, which rules out keeping what they
        were handed and preferring a ballot position, and CANNOT rule out
        preferring the longer text, because a deleted sentence makes the
        complete candidate the longer one every time. An insertion fixture, whose
        correct answer is the shorter candidate, is built and running.
    -   TWO OF SIX JUDGES ABSTAINED ON ELEVEN OF SIXTEEN of those trials, both
        refusing the pair because the archive's own handle romanisation violates
        the sheet's exact-names criterion. That is worth knowing before Question
        6, since it means the effective roster on such slices is four voices.

## Question 1: how wide should the producing rosters be

BLOCKS the roster half of `#91`, and through it the first long run under the
new shape.

The GUARD half of `#91` no longer waits on you and landed overnight in
`285af2867`: the code still forbade what you had already ruled, so a roster
where every model produces threw before any model was asked. Details in the
"decisions I took without you" section. What is still yours is how many
producers to seat by default.

You ruled "All producing roles to 4" and then "don't hardcode magic numbers like
4 or 6".
I tried to derive the four from the roster size and got it wrong twice in one
day, both times by the same mistake, so I stopped deriving and am asking.

WHAT IS NOT A CONSTRAINT, verified in the code rather than assumed:
selection imposes no ceiling at all.
The half-weight discount applies to a judge's ballot for its OWN candidate, so a
candidate's full-weight judges are everyone who did not write it.
Four editors judging each other work fine; so would six.

WHAT ACTUALLY MOVES with width:

-   COST, now measured rather than reasoned about, in
    `doc/audit/translation-repair-lane-budget.md`. Per slice: width 2 costs 7.2
    calls and 22118 tokens, width 4 costs 10.2 calls and 34567 tokens, width 6
    costs 12.4 calls and 40294 tokens. Over the whole corpus that is 27.9M,
    43.6M and 50.8M tokens for one pass. So the widest roster costs about 1.8
    times the narrowest, not six times, and the reason is where those tokens go.
    MEASURED PER STAGE on 2026-08-15 from the same rows, at no new cost, and it
    corrects what this bullet said yesterday: the judge round takes 5.4 calls
    per slice at EVERY width from three up, because the judge roster does not
    widen when the producing one does, but its tokens still rise 58% from width
    2 to width 6. Which half of a ballot grows is not knowable from those rows,
    which carry one total per exchange: the prompt repeats every candidate to
    every judge, and the answer may carry a verdict per candidate. The judge
    round dominates at both ends either way, 60% of a slice's tokens at width 2
    and 52% at width 6.
    So widening buys more candidates at a discount rather than for free, and a
    cheaper decision procedure would save more than a narrower roster.
-   AGREEMENT. Ballots spread thinner across more candidates, so the leader more
    often falls short of the minimum weight or ties. Both outcomes decline, and
    a decline keeps the incumbent, so widening can quietly REDUCE how often
    anything is replaced.
-   COVERAGE, which is what the widening is for, on your reasoning that these
    models have different blind spots.

### Measured overnight, so this is no longer a guess

`mise run //package/module/translation-repair:slice-census` reads the pinned
corpus, slices it exactly as the pipeline does, and spends no quota.
First run, 92 complete pairs:

    1260 slices
    slice source chars   p50 101, p90 174, p99 374, max 1313
    slice target chars   p50 299, p90 486, p99 1512, max 10959
    slices over 4641 target chars   1 of 1260

COST, which is now arithmetic rather than an adjective. Translate calls are
slices times producers, so the whole corpus costs:

    3 producers   3780 translate calls
    4 producers   5040
    6 producers   7560

Selection is 1260 rounds whatever the producer count, one call per judge, so
7560 judge calls at the current six-model judge roster.
What producer count changes there is the SIZE of each judge prompt, since every
candidate is repeated to every judge: about 101 source characters plus one
candidate of about 299 per producer, plus the incumbent.

    3 producers   about 1300 characters per judge prompt
    4 producers   about 1600
    6 producers   about 2200

So widening from three producers to six doubles the translate calls and adds
about seventy percent to each judge prompt. Neither is a cliff, and neither is
free.

THAT SEVENTY PERCENT WAS AN OVER-ESTIMATE, and the bench now says by how much.
Measured per stage on 2026-08-15: a ballot costs 2794 tokens at width 3 and 3861
at width 6, which is 38% rather than 69%. The character arithmetic counted only
the part of the prompt that grows, and a ballot also carries the policy, the
source and the incumbent, none of which widen with the roster. Use 38% when
pricing a width, and keep the arithmetic for the shape of the effect rather than
its size.

THE TAIL IS ONE ENTRY. Exactly one slice of 1260 exceeds 4641 target
characters, which is the size the translate probe already watched time out at
six minutes and return schema-invalid output. It is in `shihai4h`, at 10959
characters, and that entry also owns the largest target-only block count. So
the oversized-call risk is a single entry rather than a distribution problem,
and it can be handled without changing the roster at all.

THE AGREEMENT LIMB IS BEING MEASURED NOW, and it is the half of this question
the corpus cannot answer: whether more candidates make the judges converge less.
`mise run //package/module/translation-repair:roster-bench` runs the same ten
stratified slices through the translate lane at every width from two to the
whole roster, interleaved so each width meets the same provider weather, with
one width run twice for a run-to-run band. Results are folded in below as they
land.

THE FIRST THING IT SHOWED IS THE BAND ITSELF, and it is wide. On one slice, at
one width, the two passes disagreed about the outcome: one judged and replaced
the archive text at weight 4.5, the other declined for indecision and kept it.
Same slice, same width, same roster, minutes apart. Any difference between
widths smaller than that is noise, which is exactly why the repeat was built in
before the sweep rather than after.

THE SWEEP IS FINISHED, 60 rows, and it lands inside that band. Per width, over
the same ten slices:

    width 2   kept 3   declined 0   72 calls    221k tokens    70s per slice
    width 3   kept 2   declined 1   90 calls    300k tokens    91s
    width 4   kept 3   declined 2  102 calls    344k tokens    88s
    width 4   kept 4   declined 3  101 calls    347k tokens    97s   (repeat)
    width 5   kept 2   declined 1  113 calls    417k tokens   111s
    width 6   kept 2   declined 1  124 calls    403k tokens    93s

THE TWO WIDTH-FOUR PASSES DIFFER BY AS MUCH AS THE WIDTHS DO. They disagree
about the outcome on three of the ten slices, and their kept counts, 3 and 4,
span the whole range every other width falls in. So the honest reading is that
WIDTH DOES NOT MEASURABLY CHANGE AGREEMENT on ten slices, not that some width
won. Ten slices cannot resolve a difference smaller than the noise, and this
noise is large.

The agreement worry that motivated the question is not supported either: the
widest roster declined once, the narrowest declined never, and nothing in
between trends. Ballots spreading thinner across more candidates did not produce
more declines here.

WHAT THE SWEEP DOES SETTLE IS COST, which now has numbers rather than an
estimate: going from two producers to six multiplies calls by 1.7 and tokens by
1.8, and the whole bench spent 602 calls, 2.03 million tokens and 1.5 hours of
wall time on ten slices.

So this question is now a coverage-versus-cost decision and not an agreement
decision. Nothing measured says a wider roster decides worse; what it costs is
`1.8x` at six.

WHAT THIS BENCH DOES NOT MEASURE: every slice it drew already has a translation,
94 to 302 characters so far. The numbers therefore describe preserve-or-replace
only. Filling a GAP, a slice whose incumbent is blank, is the case the new shape
exists for, and no row here covers it: the draw is stratified by source size over
slices the aligner paired, and one-sided sections are not sliced at all, which is
`#90`. Nothing in this question needs a redraw to answer, but no answer here
transfers to the gap case.

### Options

A.  Fixed count in run configuration, named and commented, e.g.
    `PRODUCERS_PER_ROLE = 4`.
    Pros: says exactly what it means; one line to change when the provider
    changes; no false derivation.
    Cons: it is the literal you told me not to write, and it silently means
    "all but two" at six models and "half" at eight.

B.  A share of the roster, e.g. two thirds, rounded down.
    Pros: tracks the provider with nothing edited, which is what you asked for.
    Cons: the fraction is as arbitrary as the count, and rounding makes it
    jump at odd sizes.

C.  Every model produces in every role, and the discounts carry the whole load.
    Pros: no number at all; maximum coverage; the simplest rule to state.
    Cons: most candidates per slice, so the largest judge prompts and the
    thinnest ballots; and with every model a producer, self-votes and
    self-certifications are the norm rather than the exception, which makes
    the discounts load-bearing in a way nothing has measured.

D.  Keep the current three until `#84` measures judge quality, then widen on
    evidence.
    Pros: the only option that spends nothing before the measurement that says
    whether wider slates help; leaves every other decision intact.
    Cons: it is what you already overruled, and it delays the coverage you
    widened for.

RANKING: A > D > B > C.

A over D because you have already decided to widen and a named constant is the
honest way to write "four" while you decide whether four is right; D would be
re-litigating a decision you made.
D over B because a fraction invents precision nobody has: two thirds of six is
four only by coincidence, and at seven models it silently becomes four again.
B over C because C makes both discounts load-bearing on every slice at once,
and the self-preference rate they compensate for is exactly what `#84` has not
measured yet.

## Question 2: the transcribed-image class

BLOCKS nothing mechanically, and is the largest known quality risk in the new
shape. The class is now enumerated rather than estimated: 8 blockquotes over 6
entries, 15299 characters, sitting inside a wider target-only population of 132
blocks and 44731 characters that also holds translator apparatus and alignment
slop.

WHICH NUMBER COUNTS WHAT, since three have been in circulation and they are not
the same population. 44731 is every block the translation carries that no
source block partnered, apparatus and slop included. 16249 is the blockquote
part of it. 15299 is the 8 blockquotes over 1000 characters, which is the
transcription class itself. The handover's older "roughly 31 thousand
characters, 6 entries verified" reproduces from none of these, so it should not
be carried forward: it appears to have counted whole English blockquotes in the
named entries rather than the part with no Chinese counterpart.

Chinese pages hold letters and documents as IMAGES. English pages transcribe
and translate them. So the English carries text with no counterpart in the
Chinese markdown at all.

Under the repair shape this was safe: nothing asked a model to produce the
English from scratch, so the transcription simply survived.
Under the translate shape it is in danger twice over. A translator working from
the source has no source for it, so its candidate omits it. A judge comparing
candidates against the source cannot tell that omission from a correct one, and
the structural validator cannot either, since the source genuinely has no
footnote, link or block for that text.

Your standing ruling is that accurate translator additions are kept. Nothing in
the lane yet makes that happen.

### Measured overnight, and it changes the options

Four measurements, all from the pinned corpus, none spending quota.

A CORRECTION FIRST. An earlier draft of this section said the image is not in
the markdown at all, and drew conclusions from it. That was wrong, and it was
wrong because the search was: it looked for Markdown image syntax and for the
string `img`. The corpus writes images as an MDX component instead, and
`<PhotoScroll ...>` appears in 50 of 92 entries, matching on both sides in 49
of them. The one exception is `shi_Yumiaoya`, whose Chinese page carries a
photo block the English page does not. Everything the earlier draft concluded
from the absence is struck.

WHAT THE 132 TARGET-ONLY BLOCKS ARE MADE OF. This is the measurement the
options actually turn on, and no earlier draft had it:

    blockquote            17 blocks   16249 chars
    paragraph             87 blocks   14370 chars
    mdxFlowExpression      7 blocks   11179 chars
    footnoteDefinition    16 blocks    2746 chars
    list                   1 block       160 chars
    heading                2 blocks       21 chars
    thematicBreak          2 blocks        6 chars

Three populations, not one. The blockquotes are the transcriptions. The
`mdxFlowExpression` blocks are translator apparatus: the largest single
target-only block in the corpus, 10737 characters in `shihai4h`, is a
commented-out block of localization notes, and the footnote definitions are the
citation apparatus the translator added to go with them. The 87 paragraphs are
mostly ordinary alignment slop, a sentence moved or a paragraph split, at 165
characters each on average.

THE TRANSCRIPTIONS ARE EXACTLY THE BIG TARGET-ONLY BLOCKQUOTES, and they match
the entries `doc/planning/translation-pipeline-redesign.md` named by hand:

    Zha_Ke          3625     zheermao101   2115 + 1071
    Mio      2052 + 1882     MizuharaNagisa      1969
    dogesir_        1487     wangzihao980        1098

That is 8 blocks over 6 entries, and it answers the question the earlier draft
could not: the class does land in the target-only population, so a structural
rule can reach it.

ONE TRANSCRIPTION IS NOT TARGET-ONLY, and it is the reason a size test alone is
not enough. Across the corpus there are 210 aligned blockquote pairs, and their
growth band is narrow: p50 2.71, p90 3.68. Exactly one pair sits outside it,
`shihai4h` at 102 characters against 1665, a ratio of 16.3. That is a letter
transcribed INTO a quote the Chinese also has, so it is aligned as an ordinary
pair and no target-only rule will ever see it. It is one block in one entry,
and the ratio band says a paired quote over five times its source is the test
that finds it without catching ordinary growth.

### Options

A.  Protect the class structurally: keep every target-only block out of
    translation and splice it back unchanged, and add the paired-quote ratio
    guard for the one merged case.
    Pros: the transcription cannot be lost by any model decision; cheap; no
    model has to be told anything; now measurable rather than hypothetical,
    since the population it protects is enumerated above.
    Cons: rests on the aligner, the component with the worst track record in
    this pipeline, and the aligner is being rebuilt under `#74`. It also
    protects the 87 alignment-slop paragraphs, which simply are not
    retranslated; at 165 characters each that is a small amount of text left
    exactly as it stands.

B.  Supply the image to the translators and judges, so the text has a source.
    Pros: the only option where the translation of that text can be CHECKED
    rather than preserved; would also catch a bad existing transcription; and
    the component naming the image file is right there in the markdown, so
    finding the asset is a path resolution rather than a new corpus reader.
    Cons: needs image transport and models that read images, which this
    provider roster may not have; and OCR of handwritten Chinese letters is its
    own failure surface.

C.  Licence it as evidence: pass the incumbent's target-only blocks to the
    judges as "verified additions the archive keeps", without asking anyone to
    reproduce them.
    Pros: no new machinery; judges stop reading the omission as correct.
    Cons: tells the judges what to believe rather than letting them check, and
    the incumbent's additions are exactly what nobody has verified.

RANKING: A > C > B, unchanged by the measurements, though A is now a smaller
and better-specified piece of work than when it was ranked.

A over C because A cannot be talked out of by a model, while C depends on every
judge weighing an instruction the same way.
C over B because B needs capabilities the roster may not have, and its OCR
failure mode replaces a known-good human transcription with a machine guess,
which is the one outcome worse than losing it.

WHAT I WOULD DO WITHOUT AN ANSWER: build A for target-only blocks, since it is
structural and needs no decision from you, and leave the paired-quote guard
alone until you have ruled, because that one is a threshold and thresholds are
yours to set.

## Question 3: does the critic stage survive

BLOCKS `#86`, and the answer changes the cost of every entry.

Critics exist to find defects for an editor to repair, and the decided shape
repairs nothing. Dropping them removes 582 calls per corpus and adds 105,
making the new shape CHEAPER than the one it replaces. Keeping them gives the
judges evidence and keeps a stage that reasons about the source, which
Question 2 argues for.

There is a third answer I did not see until the review: if critics stay, their
BLOCKING behaviour cannot. `repairChunk` returns the input unchanged when
non-translation votes stand, and the document-level dominance check can return
the whole original target, discarding translated slices that already succeeded.
On a sparse target, which is exactly what the lane exists for, that is the
common case rather than the rare one.

THIS QUESTION ALSO DECIDES WHETHER `#93` IS A DEFECT. An empty critic roster
today settles a document rather than refusing it, which is wrong when the roster
is empty by MISCONFIGURATION and right when critics were dropped on purpose.
Answer A makes an empty critic roster the intended configuration, so any guard
`#93` grows has to refuse a MISSING STAGE rather than an empty list, or be
placed where the stage is requested rather than where its roster is read.

### Options

A.  Drop critics from the translate path.
    Pros: cheapest; removes the blocking behaviour by removing the stage;
    the judges already compare against the source.
    Cons: loses the only stage that names WHY a passage is wrong, which is what
    every grading sheet has been built on.

B.  Keep critics as evidence for the judges, with every early return removed.
    Pros: keeps the diagnosis and the sheets; judges get named defects rather
    than only two texts.
    Cons: pays for a stage whose output no longer decides anything, and the
    numbers that would justify it do not exist until `#83` lands.

C.  Keep critics only where the incumbent is substantial, and skip them where
    it is thin.
    Pros: spends the calls where a critic can see something.
    Cons: "substantial" is a threshold, which is the kind of number you
    rejected when it was called a coverage ratio.

RANKING: B > A > C.

B over A because the sheets are the instrument every quality claim rests on,
and losing the critic loses the vocabulary they are written in; the cost is
recoverable later and the instrument is not.
A over C because C reintroduces exactly the magic threshold you rejected in the
pipeline-shape decision, and a threshold that decides whether a passage is
examined at all is worse than one that decides how it is routed.

## Question 4: what a self-certifying checker's verdict is worth

BLOCKS `#91` alongside Question 1.

You ruled that checkers may certify text they helped write, at lower weight.
The selection discount is a half, and that number rests on an argument that
does NOT transfer: in selection a winner needs weight 2, so half-weight
self-votes cannot carry a candidate. Resolution checking tallies verdicts about
one claim rather than ranking candidates, so nothing in the arithmetic picks a
number.

### Options

A.  A half, matching the selection discount.
    Pros: one number to explain, one to tune; visibly consistent.
    Cons: consistency is the only argument for it.

B.  Zero weight, meaning a self-certifier's verdict is recorded but not counted.
    Pros: keeps the record while never letting a model certify itself; closest
    to the old exclusion without refusing the roster.
    Cons: with every model producing, a claim could end up with no counted
    verdict at all, which reads as unproven rather than as unchecked.

C.  Weighted by measured agreement: a checker's verdict on its own work counts
    at the rate its verdicts agree with disinterested checkers elsewhere.
    Pros: the only option grounded in evidence.
    Cons: needs a measurement nobody has taken, and it cannot be taken until
    the new shape has run.

RANKING: A > B > C.

A over B because B's failure mode is silent: a claim with no counted verdict
looks identical to one nobody could prove, and this pipeline has been bitten by
that shape repeatedly.
B over C because C is right and unavailable: it needs a corpus run under the new
shape to produce the agreement rates it weighs by, so A or B has to hold the
seat until then anyway.

## Question 5: the lane replaces most of the archive's English

BLOCKS the first long run. Not on last night's list; the bench put it here.

MEASURED, on ten stratified slices run at six roster widths, 60 rounds in all:
THE JUDGES CHOSE A FRESH TRANSLATION OVER THE ARCHIVE'S OWN IN 44 OF 60 ROUNDS,
73 percent. The archive text survived on 16, and only ONE slice of the ten kept
it at every width:

    slice                    w2 w3 w4 w4 w5 w6   source/incumbent chars
    Mio#5                     K  .  .  D  D  .    20/94
    zhangyubaka#23            .  .  .  .  .  .    47/180
    noname#9                  .  .  .  .  .  .    69/213
    aiyysk#39                 .  .  .  D  .  .    85/302
    xixi_yuexi#3              .  .  .  .  .  .    96/143
    aiyysk#74                 K  .  .  .  .  D   107/336
    XingZ60#81                .  D  D  D  .  .   117/401
    MeowBot233#2              .  .  .  .  .  .   130/371
    Chinatsu_Suzuki#7         .  .  D  .  .  .   151/497
    yuki418330012#6           K  K  K  K  K  K   229/229

`K` kept the archive text, `.` replaced it, `D` declined and therefore kept it.

WHAT THIS IS NOT. It is not the judges being broken: they are choosing between
anonymized candidates on stated criteria, and the archive's English is often
genuinely awkward, which is why this project exists. It is also not the
mispairing case, which now has its own guard: none of these ten slices trips it.

WHAT IT MEANS IN PRACTICE. Run over the corpus, this shape rewrites roughly
three of every four slices of a memorial archive's English, replacing text
volunteers wrote about people who died with text six models agreed on. That may
be exactly what you decided when you re-scoped the pipeline from repair to
translation. It may also be more than you meant, and it is not a decision I can
take for you.

HOW FIRM THE NUMBER IS. 44 of 60 counts ROUNDS, not slices: ten slices seen six
times each. Per width the rate ran 6 to 8 of 10, and the two width-4 passes
disagreed on 3 of the 10 slices, so the corpus rate is "most of it" rather than
"73 percent of it". Ten slices is a bench, not a census, and option C is also
what would turn it into one.

WHAT WOULD MAKE IT SAFER TO ACCEPT, in the order it becomes available:
`#84` measures whether the judges are RIGHT when they replace, and `#85` rebuilds
the damage instrument for output that has no before text.

`#84` NOW HAS ITS FIRST READING, and it is a floor rather than a verdict. A trial
takes a real archive slice, deletes one whole sentence, puts both texts on the
ballot the production sheet builds, and runs all four arrangements: clean text as
incumbent and as proposal, listed first and listed second. Over four pairs from
`AmbeR_the_anpa`, `Arita`, `Chinatsu_Suzuki` and `CuspariaKLSY`, ALL SIXTEEN
TRIALS CHOSE THE COMPLETE TEXT. Of 95 ballots, 66 backed it, 3 backed the
deletion, and 26 declined to choose.

READ IT AS FOUR QUESTIONS ASKED FOUR WAYS, not sixteen questions: the four
arrangements of one pair share their text.

WHAT IT RULES OUT: a roster that keeps whatever it is handed, and one that
prefers the first candidate. Both score half by construction, and neither shape
appeared.

WHAT IT CANNOT RULE OUT: preferring the LONGER text, which also scores sixteen of
sixteen, because a deletion is a strict subset. That habit is not harmless in
production, where it favours a padded fresh rendering over a tight archive one.
The judges' written reasons name the missing propositions specifically, which a
length rule cannot produce, but reasons are self-reports. The test that settles it
is an insertion fixture, where the correct answer is the SHORTER text, and it is
the next build under `#84`.

ALSO WORTH KNOWING BEFORE ANY QUORUM DECISION: two of the six judges declined on
eleven of sixteen trials, both because the pair violates the sheet's exact-names
criterion in a way THE ARCHIVE ITSELF introduced (the handle `AmbeR_the_安帕`
romanised to `AmbeR_the_anpa`). On slices like that the effective roster is four
voices, not six.

So today the replacement rate has a floor beside it and not yet a quality
reading: a roster that could not see a deleted sentence would be disqualified,
and this one is not.

### Options

A.  Ship the lane as it stands: the judges decide, and the archive text wins
    only when it wins on the criteria.
    Pros: it is what the ensemble is for, and the incumbent is on the ballot
    anonymously so nothing is stacked against it; the archive is in git, so
    every replacement is reversible.
    Cons: a 73 percent rewrite of a memorial archive is a large action taken on
    an ensemble's aesthetic judgement, before `#84` says whether that judgement
    is any good.

B.  Require MORE than a plurality to replace the archive text: the incumbent
    keeps its slice unless a fresh candidate clears a higher bar than it takes
    to beat another fresh candidate.
    Pros: encodes that replacing human work is a bigger step than choosing
    between two machine renderings, which is a value judgement rather than a
    measurement, and it is yours to make.
    Cons: another number to pick, and it would slow the lane's ability to fix
    genuinely bad translations, which is what you asked for.

C.  Run the lane in report-only mode first: translate everything, record every
    decision, ship nothing, and grade a sample of what it WOULD have replaced.
    Pros: buys the `#84` measurement with the same calls the real run would
    spend, and nothing in the archive changes until you have read it. It does
    NOT cost a second corpus of calls: each lane now owns its cache namespace,
    so a report-only pass's settled slices resume into the shipping pass
    unchanged, same run shape, same texts, same key. Shipping afterwards costs a
    splice, not a re-translation. This option now has something concrete to run:
    `runDocumentLanes` puts both lanes over one preparation and returns both
    documents without choosing between them, which is exactly a report-only
    pass minus the artifact wiring. It also measures decision 12's withdraw-all
    rate for free, since the guard runs whether or not anything ships. And since
    each lane result now NAMES the slices it shipped and withdrew, such a pass
    answers "which slices did each lane change, and how often the same one"
    without anything further being built; what it still cannot show side by side
    is the two lanes' TEXT for one slice, which needs both contracts widened.
    Cons: the grading is your time rather than mine, and the corpus ships later
    by however long that reading takes.

D.  Restrict replacement to slices that carry evidence of a defect, which is the
    repair lane's rule, and translate only where the English is missing.
    Pros: the most conservative reading of "improve the translation".
    Cons: it is the shape you deliberately moved away from, and the graded
    sheets showed the critics miss most of what is wrong.

RANKING: C > A > B > D.

C over A because the whole disagreement is about whether the judges are right,
and C answers that with the calls the run would spend anyway; A spends the same
quota and commits the result before anyone has read it.
A over B because B invents a threshold to express a preference you have not
stated, and if you do want the archive favoured, saying so is better than
tuning a number until it looks right.
B over D because D is the shape you already rejected on evidence: the critics
miss most of what is wrong, so gating replacement on a filed defect keeps the
worst translations exactly as they are.

## Question 6: what a thin roster's verdict is worth to the cache

BLOCKS NOTHING. It changes how much a resumed run re-buys, so it is worth
answering before a long run rather than during one.

WHAT IS ALREADY DECIDED AND BUILT, so this question is only about the middle
ground: a slice NOBODY examined is never cached. Zero critics heard, or zero
translators heard, settles for the run and is left out of the cache, so the next
attempt asks again instead of resuming an outage as a verdict. A caller abort
now stops both drivers rather than settling the slices it interrupted.

THE MIDDLE GROUND is a slice that was examined by FEWER models than the stage
asks for. Quorum is half the roster rounded up, so on six critics a slice
decided by three met quorum exactly, and one decided by two did not.

MEASURED, on what is actually on disk:

-   Of the 150 cached repair slices, `heardCritics` runs 3 for 1 slice, 4 for 3,
    5 for 92 and 6 for 54. Not one is below quorum, and one sits exactly on it.
-   Across all 56 settled artifacts, 34 unmet-quorum findings appear, in 7
    entries, and every one of them is the REFINER. Critics, panel, editor,
    judges and checkers never fell short of quorum in the settled corpus.

So the population this question governs is small, and it is concentrated in the
one lane that is optional: naturalness refinement, whose silence was traced to a
single model in `#73` and `#77`.

### Options

A.  Cache only a slice where EVERY stage met quorum; re-buy the rest next
    attempt.
    Pros: what resumes is then work done at full strength, and nothing thin
    survives into an artifact by being cached first.
    Cons: the cache is per SLICE, so a refiner that lost quorum re-buys the
    critics, the panel, the editor, the judges and the checkers with it, to
    retry one optional lane. And it can loop: the refiner's silence has a known
    chronic cause, so those slices may never cache at all.

B.  Cache anything that was examined at all, which is the rule as it now stands:
    zero voices is not cached, one voice is.
    Pros: matches what the stages already decided to do, since a stage short of
    quorum deliberately proceeds with findings rather than failing; costs
    nothing to keep.
    Cons: a slice decided by a thin roster resumes forever with no way to tell
    it apart from one decided at full strength, unless a reader goes looking in
    the findings.

C.  Cache it, but RECORD that it was thin, and let a later pass re-buy only
    those slices.
    Pros: keeps the budget while making the population addressable; the record
    already exists in `findings` and would only need a field a reader can filter
    on.
    Cons: a schema field, a version bump and a reader for a population that is
    34 slices in 7 entries today.

RANKING: B > C > A.

B over C because the measured population is small and sits entirely in the lane
where thinness means "no improvement was attempted" rather than "nothing
inspected this", and C's field cannot be added without a cache version bump,
which discards the 150 slices already on disk to gain a filter over none of them.
C over A because A pays for a whole slice to retry one optional lane, and pays
it again on every attempt while the cause persists.

## Question 7: what the non-translation block counts against

BLOCKS NOTHING TODAY, and nothing changed behaviourally overnight. It decides
what one whole-document refusal MEANS, and that refusal is terminal: it returns
the archive untouched and stops the entry from inside the slice loop.

WHAT THE CODE DOES. `assessNonTranslationDominance` sums characters over the
SLICES it was handed, on both sides of the comparison, and blocks when the
slices standing as non-translation are more than half of them with no anchor
in sight. Anything the aligner refused to pair, and anything slicing left
whole, is in neither term. So the sentence the block currently supports is
"most of what we EXAMINED is not a translation", while the parameter
documentation until last night said "archive characters in total".

MEASURED, at zero quota, over the pinned corpus of 92 prepared pairs. Each
pair was prepared, its slice characters summed, and the total compared against
the whole English document:

-   Mean slice coverage, over entries with no alignment finding, is 92.5%.
-   14 entries fall under 90% covered, 2 under 50%.
-   Only 2 entries carry any alignment finding at all.

The routine gap is front matter and the separators between chunks, which
belong in no slice by construction and are not what this question is about.
The tail is, and its two ends name the two causes. `XIEPT2` produces ZERO
slices from 17 alignment refusals, so 0 of its 1218 characters are examined:
both terms are zero, the block cannot fire, and the entry settles as a clean
unchanged document having looked at nothing. `ArtsEpiphany` at 27.5% and
`windward0032` at 60.9% carry no alignment finding at all, so their shortfall
is slicing rather than pairing, which is `#90`'s territory rather than this
question's.

### Options

A.  Read the ratio over the DOCUMENT, so the block means "most of this
    translation is not a translation".
    Pros: matches what every reader of a whole-document refusal will assume it
    measured, and stops an entry whose examined part is all non-translation but
    whose bulk was never sliced from blocking the whole document.
    Cons: an entry can then hide non-translation behind unsliced bulk, since
    the majority it needs is now over text nothing inspected. It also makes the
    block quieter the worse the slicing gets, which is the wrong direction for
    a signal.

B.  Read it over the SLICES, as today, and say so in the contract.
    Pros: every character in the ratio was actually examined, so the block
    never rests on text no model read; costs one documentation pass, which is
    already half done.
    Cons: the refusal's name promises more than it measures, and a document
    that is mostly unsliced cannot reach the block however bad the part that
    was examined.

C.  Keep B's denominator and add a coverage floor: refuse to DECIDE on a
    document whose sliced fraction falls below it.
    Pros: the only option that gives `XIEPT2` an honest outcome, which is
    neither clean nor blocked but unexaminable; the floor is one number and the
    measurement above says where it would sit.
    Cons: a third terminal outcome to represent, and `#96` says the artifact
    cannot express "unknown" yet, so this one waits on that. It also needs a
    number picked from 92 entries, and 2 of them are the whole population it
    would catch.

RANKING: C > B > A.

C over B because B leaves `XIEPT2` settling as a clean unchanged document on
the strength of having examined nothing, which is the one outcome in this
question that is actively wrong rather than merely narrow, and C fixes it
without changing what the block itself counts. B over A because A's failure
mode grows with the very defect it is meant to survive: the less of a document
gets sliced, the harder its examined non-translation is to see, whereas B's
narrowness is stated and constant.

WHAT I WOULD DO IF YOU DELEGATE THIS: take B now, since it is documentation of
what already happens, and hold C until `#96` can carry an unexaminable verdict.
That ordering costs nothing, because C keeps B's denominator.

## Decisions I took without you, veto cheaply

1.  A revision that still fails validation is NOT taken; the original candidate
    stands. Reasoning: the model was asked to fix those findings and did not,
    so nothing says the new text is better, while the original is at least what
    it produced with the whole sheet in front of it.
2.  The incumbent never passes through structural validation and can never be
    dropped by it. Reasoning: it is the fallback, so a check that could drop it
    could delete the archive.
3.  A slice's candidate order is rotated by a hash of the source, so the
    incumbent does not sit in one ballot position. Deterministic, so a resumed
    slice asks the judges the same question a fresh one did.
4.  Structural validation compares block structure, footnote markers, link and
    image destinations, and inline code, and deliberately NOT numbers or names,
    because 三封信 becomes "three letters" and no digit survives on either side.
5.  Atoms are compared as a multiset rather than in order, since a translation
    reorders clauses and a link moving inside a sentence is not damage.
6.  THE ROSTER GUARD NOW MATCHES YOUR RULING. It required two judges with no
    stake in any candidate, which is the rule your self-vote discount replaced,
    and on six models that capped producers at four. It now refuses only
    rosters that could not decide a round however they voted: repeats on either
    side, no producer, or too little available weight to reach the minimum.
    The weight limb catches a case a seat count would have passed, one producer
    judged by itself and one other model, which tops out at 1.5 against a
    minimum of 2 and would have declined every round in silence.
    CORRECTED LATER THE SAME NIGHT, in `9e43d5afc`, after a second review: my
    first weight limb measured what a candidate would draw if EVERY producer
    had a stake in it, and on that reading it refused three authors judging only
    each other. That bench decides comfortably, because a candidate one of them
    wrote draws half a vote from its author and a full one from each of the
    other two. It now measures the most favourable candidate instead, which is
    the question a guard refusing rosters that could not decide HOWEVER they
    voted has to ask. The case above still refuses.
    ONE EXCEPTION worth your veto if you dislike it: four models returning
    byte-identical text collapse into one candidate, and four self-votes at a
    half reach the minimum with no outside judge. I kept it, because agreement
    to the byte between independent models is itself the corroboration, and
    pinned both it and the three-contributor case that falls short in tests.
    THE ALTERNATIVE, which an external reviewer proposed and I did not take:
    require at least one FULL-weight ballot on the winner, which would refuse
    that four-way agreement outright. I left it for you because it is a new rule
    on top of the weighting you chose rather than an implementation of it, and
    because it would also block the case where four models agree and the two
    remaining judges simply went quiet. Say the word and it is a three-line
    change plus its tests.
7.  IDENTICAL CANDIDATES NOW MERGE THEIR AUTHORS in the editor and naturalness
    lanes. They did not, so a model could vote at full weight for its own words
    whenever another model wrote them first, and the ballot split across
    identical texts. Found by an external review of the guard change.
8.  The translate stage now RECORDS THE SLATE the judges were shown, with each
    position's text, hash, origin and producer. Ballots name a position and the
    slate is rotated per slice, so a stored ballot could not be joined to any
    text afterwards. Judges still see anonymous positions; provenance is
    attached to the record after the round.
9.  The source-side slice budget is now derived from the whole document pair
    rather than from one section, and capped at the target budget. Reasoning in
    `#90`; the cap encodes that Chinese runs shorter than its English rendering,
    so a ratio above one is missing translation rather than density.
10. A SELECTION ROUND NOW REFUSES A ROSTER NAMING ONE MODEL TWICE, before it
    spends a call. The stage guard already refused that, but two of the
    selection entry points are reachable without the stage, and a repeat there
    bought two exchanges from one model, which is two ballots and enough to
    reach the minimum weight alone. Refused rather than silently deduplicated,
    since a caller that passed a repeat believes it has more judges than it has.
11. A REPLACEMENT THAT BREAKS A FOOTNOTE IS WITHDRAWN AT ASSEMBLY, rather than
    reported and shipped, IN BOTH LANES. Reasoning: it is the same species of
    guard as the alignment refusal you already have, and a dangling `[^1]` is
    not a judgement call. The judges are not wrong here either: each slice
    validated on its own, and the marker that went missing belongs to a line in
    a slice they never saw. The per-slice record still says a replacement was
    chosen, so the record and the document disagree ON PURPOSE: one says what
    was chosen, the other says what the document could carry, and the shipped
    counts follow the document.
    IN THE REPAIR LANE IT ALSO REACHES THE ISSUE RECORDS, which is the part
    that could have gone wrong quietly: an issue whose slice was withdrawn is
    recorded `withdrawn` and unresolved, the same disposition a non-translation
    block already used, because both mean the repair reached no reader.
    Crediting it would overstate the precision measurement directly.
    WHAT THIS GUARD IS NOT, so you do not read more into it than it does: it
    checks INTEGRITY, not preservation. It compares the footnote graph the
    document comes out with against the graph it went in with, and withdraws a
    replacement that made that graph worse. A candidate that drops a footnote
    pair WHOLE, marker and definition together, leaves a graph with one fewer
    footnote and nothing dangling, so it ships with no finding. So does one that
    renames both halves consistently. Both are losses of content rather than
    breaks in structure, and the instrument for those is `#85`, which is where
    the damage question belongs.
12. WHEN NO SLICE CAN BE BLAMED, EVERY replacement is withdrawn and the archive
    text ships. Reasoning: that shape comes from how replacements MEET, a stray
    comment opener masking markers document-wide above all, so picking a slice
    to withdraw would be a guess and shipping a document the lane knowingly
    broke is worse. Rare by construction, loud when it happens.
    A STRUCTURAL REGRESSION ALWAYS TAKES THIS BRANCH, even where one replacement
    visibly contains the `<!--` that caused it. Attribution asks which slice
    changed its mention of an IDENTIFIER, and an unterminated comment or an MDX
    downgrade names none, so there is nothing to match it against. Worth knowing
    because the branch is expensive: one bad slice costs the document every
    other repair in it.
    HOW OFTEN THIS FIRES IS FREE TO MEASURE under Question 5's report-only
    option, since a pass that writes nothing still runs the guard and records
    what it withdrew. If you pick that option, the rate arrives with it.
13. NO OTHER CROSS-SLICE GRAPH WAS BUILT, though an external review listed
    several. Measured over all 184 corpus documents: 209 GFM footnote markers in
    45 files, and zero reference-style link definitions, zero reference-style
    link uses, and zero heading-anchor links. Footnotes are the only cross-slice
    relation this corpus has. Structural parse regressions are read alongside
    them, because an unterminated comment and an MDX downgrade name no
    identifier and nothing else would notice.
14. A GRADING SHEET NO LONGER SHOWS A REWRITE THE DOCUMENT DID NOT CARRY as the
    wording that shipped. The record's final-wording field was written whenever
    the naturalness lane rewrote a slice, which was right until decision 11 let
    assembly take a rewritten slice back. It is now written only where the
    document carries the rewrite, so a withdrawn slice states no final wording
    and the sheet says the rewrite was taken back rather than fencing an empty
    block under "the slice as actually returned". Found by an external review of
    tonight's guard change; the artifact reader was taught the same rule in the
    same commit, because it required that field of every rewritten slice and
    would otherwise have refused to read the run.
15. FOOTNOTE LABELS ARE FOLDED THE WAY THE PARSER FOLDS THEM before anything
    compares them. Markdown reads `[^Note]` and `[^note]` as one footnote and
    mdast hands back one spelling, while the raw scans this guard attributes
    with see what was written. Measured on a fixture before the fix: the guard
    looked for a finding about `note` in mentions keyed `Note`, could blame no
    slice, and withdrew BOTH replacements including one that touched no footnote.
    Nothing settled is affected, because all 209 corpus markers are numeric and
    folding a digit changes nothing; a model writing a word-labelled footnote
    into a replacement triggers it at once.
16. BOTH LANES NOW RUN FROM ONE DRIVER THAT ARBITRATES NOTHING.
    `runDocumentLanes` takes one prepared pair, runs repair and then translate
    over it, and returns both documents with no winner, no preferred lane and no
    merged text, because choosing between them is Question 5 and a driver that
    chose would answer it invisibly for every later count. Three sub-choices are
    open to veto on their own: the lanes run SEQUENTIALLY, since the quota spent
    is the same and both already serialize their own slices; REPAIR RUNS FIRST,
    because its naturalness phase settles after the slice loop and nothing
    persists what that phase produced, while the translate lane caches every
    slice as it finishes, so a deadline cutting the entry loses less of what was
    bought; and there is NO ABORT CHECK BETWEEN THE LANES, since both drivers
    deliberately let a fully cached lane finish after an abort and a gate there
    would refuse that. Alignment findings are reported once at the top level
    rather than per lane, because they belong to the preparation both lanes
    shared and counting them per lane would count one defect in the archive
    twice.
17. EACH LANE RESULT NOW NAMES THE SLICES IT SHIPPED AND WITHDREW, read off the
    assembly guard rather than off the per-slice records. A record says what its
    own slice CHOSE, and a slice can be withdrawn while carrying no issue of its
    own, so a comparison built from records would credit a lane with slices the
    returned document does not carry. Recorded into the settled artifact too, so
    the withdraw rate is countable over a directory. Artifacts settled before
    2026-08-15 lack both fields, and a reader must treat their absence as
    unknown rather than as empty.
20. BOTH LANES NOW REFUSE A CHANGE THE DOCUMENT DOES NOT CARRY, rather than
    reporting it, AND THE PLACE THEY REFUSE IT MOVED ON 2026-08-15. The way in
    was the slice cache: a resumed record was trusted on its index alone, so one
    claiming a change while holding the archive's own wording reached assembly,
    survived the footnote guard untouched, and landed in the shipped set beside
    a document nobody changed. Both lanes now check that a resumed record's
    changed flag agrees with its own text WHERE THEY ACCEPT IT, in both
    directions, and discard a record that disagrees so that slice is simply
    bought again. One bad cache file costs one slice rather than the entry, and
    each discard is named in the findings, because a recomputed slice is
    otherwise indistinguishable from one that was never cached. The quieter
    direction is the one nothing caught: only changed records become
    replacements, so a record DENYING a change it made had its wording dropped
    at assembly with nothing said.
    THE ASSEMBLY CHECKS REMAIN, as a backstop rather than the first line: one
    refuses a replacement that repeats its slice's incumbent or names a slice
    the preparation never produced, and one derives the shipped set from the
    surviving replacements, re-splices them, and refuses any returned document
    they do not reconstruct. Both index sets are also checked against each other
    and put in document order, which the withdrawn one never was.
    THEY STILL THROW, and that is now the only place the throw-versus-finding
    question is live. Dropping a suspect replacement silently would leave a run
    reporting counts nobody can reproduce, but throwing loses an entry's
    unpersisted work. The shape the review recommends is a typed error caught at
    the corpus-entry boundary, so the pass continues and the entry stays
    unsettled with its cached slices reusable, and that boundary is part of the
    wiring Question 5 shapes. `#95` records the rest.
19. THE TWO LANES CAN NOW BE COMPARED SLICE BY SLICE, and the comparison reads
    what each DOCUMENT carries rather than what each lane chose. Every lane
    result reports, for every prepared slice, the archive's own wording beside
    the wording that lane decided on. A separate pure function joins two results
    on the slice index and names each slice: the archive stands in both, one
    lane moved, both moved to the same wording, or both moved apart. That last
    one is the case a human has to read, and it is the reason the two-lane shape
    exists. Deliberately NOT on the per-slice records: whether a slice shipped
    is decided by an assembly guard reading the whole document and can differ
    between two runs of the same slice, so it stays on the document-level index
    sets and the comparison derives the rest. Nothing calls the comparison yet;
    wiring it into a pass is shaped by Question 5.
18. THE BENCH NOW PRICES SENDING AND ANSWERING SEPARATELY. One total could not
    answer the width question the bench exists for: seating one more producer
    resends the SAME prompt and adds one more answer, while a judge pays a
    prompt carrying every candidate, so those three costs scale with width
    differently and a single number prices them the same way. The server's own
    total is kept beside both halves rather than derived from them, so the
    headline cost stays what the provider stated; the derived sum is the
    fallback for servers that report no total at all. Whether any provider here
    ever states a total that differs from its two halves is unmeasured, and the
    first bench run under the split answers it.
21. AN ASSEMBLY THAT CHANGES NO BYTE NOW SHIPS NOTHING, whatever its slices
    decided. Two adjacent slices whose replacements each differ from their own
    incumbent can reassemble to the archive text: moving a paragraph across the
    join does it, and subdivision groups small paragraphs into slices where that
    join exists, so this is reachable rather than hypothetical. The lane used to
    return a non-empty shipped set beside a byte-identical document, while both
    contracts said those indices name slices the document CARRIES a change for.
    The guard now withdraws that whole set under its own reason and returns no
    survivors. CANONICALIZATION RATHER THAN REFUSAL, because nobody did anything
    wrong: each lane still holds every wording it decided, and only the
    document-level claim changes, to the true one. It also bought something
    back, which is why it is worth the code: with the guard guaranteeing it, the
    check that a document equal to the archive names no changed slice became
    enforceable again, and it had been dropped as unenforceable a day earlier.
    THIS BROADENS WHAT `withdrawn` MEANS. It is no longer only an integrity veto:
    a withdrawal now says the document does not carry that slice's change, for
    any of three reasons, and only the findings say which. A reader counting
    footnote damage from `withdrawnSliceCount` alone would now over-count.
22. A REPAIRED SLICE IS ONE WHOSE TEXT MOVED, not one whose patch won. The
    repair lane derived `changed` from which candidate selection chose, which is
    a different question: the patch gate refuses an operation that rewrites its
    region to itself, but two operations in adjacent envelopes can each change
    their own region and concatenate back to the archive text, the same shape as
    decision 21 one level down. Such a patch could win and write no byte, and
    the per-slice assertion would then throw on a run nobody did anything wrong
    in. `changed` now reads the text; `accuracyPatchSelected` keeps the
    selection fact, which stays true in that case and is a different thing. The
    translate lane already worked this way, so the invariant now holds by
    construction on both.
23. A CACHE KEY NOW NAMES THE QUESTION AND NOT THE PLACE IT WAS ASKED. You
    authorized the invalidation; the shape is mine and is open to veto. A key is
    the run's shape, both slice texts and the governance flag, and the slice
    index was in it for no reason a reader could defend: the same source and the
    same incumbent produce the same answer wherever they sit, and one-sided
    slicing moves indices around by design, so keeping it would have made every
    slice after an inserted section a miss. A resumed record is RE-STAMPED with
    the index it is resumed under, rather than trusted to carry its own, since
    the stored one is now meaningless. What made this safe to do rather than
    merely right was that nothing had settled under either lane's current
    version, measured before the change: the translate cache was empty and the
    repair one held no record under its current version.
    THE ONE THING THAT DEPENDED ON POSITION was removed rather than kept: a
    refusal sentence naming `slice 3` was being stored inside the record, so
    after the key change it would have been resumed at another position and
    reported the wrong slice number. The stored record now carries the finding
    without the sentence, and the sentence is composed at the document level
    where the positions are known.
24. A CHUNK IS EITHER CONTENT OR A PLACE, and the discriminant is a FIELD rather
    than emptiness. This is the first landing of `#100` and it changes nothing
    that runs today, because nothing produces a place yet. Reasoning: a
    `nodes.length === 0` test would work today and would silently promote any
    fabricated empty chunk to an insertion tomorrow, while a field says what a
    value is. An external review argued me out of my first shape, an optional
    `placement` marker on one broad type, which buys the word without the
    protection: an insertion would stay assignable everywhere content is
    expected.
    ONE RULE REFUSES EVERY BAD PLACEMENT, checked at assembly: each target span
    starts at or after the previous one ends, walked in slice order. Overlaps, an
    anchor sitting inside a span, two spans at one offset, backwards ranges and
    stale text all fall out of it, and the review agreed there is no
    offset-only counterexample once the per-slice shape checks pass. It also
    found something I had not: array order is only slice order if the indices ARE
    positions, which assembly never asserted, so two anchors at one boundary with
    unique but shuffled indices would have been written in reverse.
    WHAT IT LEFT OPEN, and I did not decide: whether a MISSING replacement for an
    anchor should be refused the way a BLANK one now is. A blank one is refused
    because an anchor is where a rendering belongs, so blank text there leaves
    the passage missing while the run reports it delivered. A missing one cannot
    be answered until the absent-incumbent work says whether assembly may ever
    withdraw an anchor's replacement, since withdrawing one restores nothing.
25. THE SEPARATOR BETWEEN TWO BLOCKS IS ASSEMBLY'S, NOT THE PROMPT'S. Every
    replacement until now went into a span that already sat between the right
    blank lines, so writing model text verbatim preserved them; an anchor has no
    span, and verbatim text written before a heading produces `...afternoon.##
    Habits`, which still parses as Markdown and says something else. A prompt
    asking for correct leading and trailing blank lines is a hope that fails
    silently, and it cannot be right anyway, since several fragments landing at
    one boundary would each carry their own and put two between every pair.
    THE RULES, all add-only: strip only outer blank-line material from a
    fragment and keep its indentation, because a rendering that begins with
    spaces is inside a list or a quote; join same-boundary fragments with one
    blank line; preserve existing whitespace byte for byte and only top it up;
    write the document's OWN line ending, which a Windows translation needs and a
    diff would otherwise report as changes to lines nobody touched; and treat the
    end of a file as termination rather than as separation from nothing. Four
    existing test expectations changed, each of which had pinned the verbatim
    write this replaces.
26. A PASSAGE THE RUN COULD NOT TRANSLATE COSTS ITS OWN SLICE, NOT THE ENTRY.
    This is the one place I departed from a review's recorded shape, so it is
    the decision in tonight's work most worth your veto.
    THE PROBLEM IT SOLVES either way: every fallback in the translate stage
    ships the wording already in the archive, which is right for a slice that
    HAS one, since leaving a passage as it stands is the state the run began in.
    For a slice with none, the same fallback shipped the empty string and
    reported a settled slice, so the run read as having delivered a translation
    it never produced.
    THE REVIEW'S SHAPE was for the lane to throw and leave the whole entry
    unsettled, its cached slices reusable by the next attempt.
    WHAT I BUILT INSTEAD: the stage raises a typed refusal, the driver catches
    it per slice, and the document settles with that passage still missing and
    named in a new `unfilledChunkIndices` field, with the findings saying which
    translators were heard and what the judges counted. Nothing is cached for
    such a slice, so the next run asks again.
    REASONING: the document keeps the gap the archive already had, which states
    nothing false; a decline depends on which judges answered, so it varies
    between runs, and throwing the entry away discards every other slice's work
    over that; and the missing passage is now nameable, which is what stops it
    being read as a slice the judges kept.
    WHAT WOULD CHANGE IF YOU PREFER THE REVIEW'S SHAPE: one branch in the
    driver, plus the entry-level catch that Question 5's wiring needs anyway.
27. A TRANSLATOR REPLY THAT SAYS NOTHING IS NO LONGER A REPLY. `{"translation":
    ""}` satisfies the structured-output schema, so it arrived as a heard voice,
    was dropped further down as an unusable candidate, and the model that sent
    it counted as having answered and was never asked again. The wire guard now
    refuses it, which makes it a lost voice: the roster re-asks that model in
    the next round, and if it stays blank the loss is named like any other.
    Every source slice says something, so no legitimate reply is blank.
    WHAT THIS CHANGES IN A COUNT you may already be reading: a blank reply used
    to show up as `translate-blank (model)` beside a full `heardTranslators`
    tally. It now shows up as `stage-voice-lost (translate model)` with one
    fewer heard translator, which is the same event described honestly. The
    blank filter downstream stays as a backstop and should now never fire.
28. WHAT COUNTS AS PROOF THAT A PASSAGE WAS NEVER TRANSLATED?
    THE PIPELINE IS ABOUT TO ACT ON AN ANSWER IT DOES NOT HAVE. Both halves of
    the one-sided slicing work insert text where an aligner reports no
    counterpart: at paragraph scale (landing four) and at section scale
    (landing five). I measured what those reports are actually made of, and
    they are not evidence of a missing translation.
    AT PARAGRAPH SCALE: the block aligner can pair one with one, skip a source
    block, or skip a target block, and nothing else. It cannot say two source
    paragraphs were rendered as one, so a merged pair reports the second as
    unpaired, identically to an omission. Corpus: 2290 paired steps, 95
    unpaired source blocks, in 23 of 92 entries, sixty of them inside two
    entries. A hand sample of twelve found the strongest signals were merges
    (one entry renders four consecutive lines as a single English block) and
    the weakest were MISPAIRINGS (a footnote definition paired with the wrong
    footnote; a narration line paired with a translation three blocks away).
    AT SECTION SCALE the numbers are smaller and I READ THEM WRONG THE FIRST
    TIME, which is worth your attention because the correction is what the
    prototype below was able to make. Eighty-five of the 92 entries never reach
    the section matcher at all, because equal heading counts short circuit it
    (`#98`). Of the seven that do, two produce unpaired source sections, eleven
    in total.
    WHAT I FIRST CONCLUDED, and recorded here in an earlier draft: eight of the
    eleven were false, because one entry's sections carry English headings that
    plainly correspond, 经历 with Experience, 遇见 with Meeting, and so on
    through eight of them.
    WHAT IS ACTUALLY TRUE: that entry's English document is 1,218 characters
    against 7,365 Chinese, and every section of it except the last is a HEADING
    WITH NO BODY. The headings correspond and the translations do not exist. I
    had inferred body coverage from heading correspondence, which is the same
    reasoning error I have been refusing elsewhere, and the six-model coverage
    probe reported all eight as uncarried before I checked.
    SO THE MATCHER'S REFUSALS WERE RIGHT IN OUTCOME on that entry, for a reason
    it could not state, and the count of genuine candidates at section scale is
    higher than the earlier draft said rather than lower.
    WHY IT IS YOURS TO ANSWER: the paths differ in expense and in how long the
    lane stays unable to fill a real gap. None of them is wrong.
    A. ASK A MODEL WHETHER THE TARGET DOCUMENT CARRIES THIS PASSAGE AT ALL,
    scoped to the whole translation rather than to the neighbours the aligner
    picked. Pros: it is the only option immune to the pairing quality this
    measurement just impeached, since it never consults the pairing; about a
    hundred and six questions corpus-wide is a small bill; it caches like every
    other slice; and it answers both scales with one mechanism. Cons: a new
    stage with its own prompt, schema, roster and failure modes, and a long
    document makes a long question.
    B. FIX ALIGNMENT FIRST, then revisit insertion. Pros: the mispairings and
    the ambiguous refusals are defects rather than limits, `#74` and `#98`
    already own them, and every stage reads better pairs, not just this one.
    Cons: the largest item here, it does not by itself separate a merge from an
    omission, and both landings wait on it.
    C. INSERT ONLY WHERE THE EVIDENCE IS ALREADY OVERWHELMING, meaning a source
    section whose absence is corroborated by more than the matcher's refusal:
    no target heading resembles it, and the target document is shorter than the
    source by about that section's size. Pros: no new stage, no model call, and
    it would have admitted the three true ones and refused the eight false ones
    in this corpus. Cons: a threshold tuned on two entries is a threshold tuned
    on nothing, and it silently does nothing on the 85 entries that skip the
    matcher.
    D. DO NOT INSERT AT ALL for now. Keep both landings parked, ship the
    translate lane over slices that HAVE incumbent text, and revisit when
    alignment is trustworthy. Pros: no corpus risk whatever; every invariant
    built for insertion stays and stays tested. Cons: the archive's genuinely
    missing sections stay missing, which is the thing the second lane exists
    for.
    MY RANKING: A > C > B > D.
    A over C because A answers the question for both scales with one mechanism
    and does not depend on the aligner being right, where C still rests on
    refusals whose reasons do not distinguish the cases.
    C over B because C can ship a genuinely missing section now and B is the
    largest item here, and because the correction above raised how many section
    candidates are genuine rather than lowering it.
    B over D because B is work that pays off in every stage, where D is a
    holding position.
    WHAT I DID RATHER THAN WAIT: built A and measured it, since it was the
    stated default and the prototype touches no corpus state. It is four files
    and a probe task, nothing calls them, and no slicing or artifact reads them.
    WHAT IT MEASURED, thirty-three candidates, six voices each, about a hundred
    and ninety calls and under ten minutes:
    ELEVEN SECTIONS: ten absent, one carried. Every verdict agrees with what the
    documents contain, and NINE of my eleven hand labels were wrong. It found
    that one entry's English side is headings without bodies, and that a source
    heading meaning "blank" is rendered by an English heading spelled `__`,
    which the matcher cannot score because it holds no letters.
    TWENTY-TWO BLOCKS: eighteen carried, most unanimously, one absent, and three
    split with NO votes for absence at all. So at paragraph scale at most one of
    twenty-two passages the aligner refuses is one nobody translated, and
    landing four would insert on all twenty-two.
    WHAT THAT IS NOT: an accuracy number. The candidates come from five entries,
    most blocks carry no hand label, and I made the labels after seeing the
    aligner. What the class balance cannot explain is that pooled across both
    scales no constant answer beats nineteen of thirty-three, while the probe
    agrees with every label I have in both directions.
    WHAT IT COSTS: about six calls per candidate, roughly a hundred and six
    candidates corpus-wide, so one pass over every unpaired passage in the
    corpus is around six hundred and forty calls and a quarter of an hour.
    ONE DESIGN DEFECT IT EXPOSED, which matters whichever option you choose: a
    source section whose translation is a HEADING WITH NO BODY must have its
    body inserted UNDER that heading, not inserted as a whole new section, or
    the document gains a duplicate heading. Landing five as designed would have
    made that mistake on eight sections of one entry.
    RERUN AFTER THE REVIEW CHANGES LANDED, because the numbers above are what
    this question rests on and three things moved underneath them: the sheet was
    rewritten, the threshold became a majority of the roster rather than of the
    voices heard, and the quote locator learned to see through a soft line wrap.
    Nine of the eleven section verdicts are identical. XingZ60's section 12 reads
    `partly-carried` where it read `carried`, which is not the models changing
    their minds: the tallies are zero full and five partial, and the old verdict
    counted any claim of coverage as one vote, so those same five votes used to
    print as carried. XIEPT2's section 7 reads `split` where it read `absent`,
    and that one I CANNOT attribute: the votes themselves moved, and votes of
    that shape read as split under either threshold, so the cause is the new
    sheet or ordinary variance between two samples of six stochastic models, and
    one run cannot separate those.
    WHAT DID NOT MOVE IS THE ANSWER TO YOUR QUESTION. No candidate in either run
    reports full coverage. Nine of eleven are absent by a majority of the whole
    roster with every model heard, and both verdicts that moved moved AWAY from
    coverage rather than toward it. The sections I had labelled as plainly
    translated are still reported as carrying nothing.
    THE BLOCK SET WAS RERUN TOO, on `mikaela_khara`, the entry that produced the
    three splits. All three are now carried, and of the quotes still unanchored
    none is a soft line wrap where ten of eleven were before, so the refusals
    that remain are English a model composed rather than copied, plus one
    single-word quote refused for occurring twice. Across both runs of that entry,
    ninety-six answers from six models, NOT ONE VOTE FOR ABSENCE was cast on
    sixteen passages the block aligner refuses to pair. If anything, the paragraph
    scale reads worse for landing four than it did: at most one of twenty-two, and
    plausibly none.
    RUN A THIRD TIME under unchanged code, because the one sentence above that
    said "this might be variance" deserved testing rather than repeating. All
    eleven verdicts came back IDENTICAL to the second run, section 7's split
    included. So that split reproduces, and the eleven verdicts this question
    rests on are now two independent samples in agreement rather than one sample.
