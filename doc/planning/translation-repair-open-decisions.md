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

QUESTION 6 arrived last, from a defect rather than a bench: both drivers were
caching slices an aborted run never bought. That is fixed; what remains is a
narrower judgement about thin rosters, and it blocks nothing.

WHAT LANDED AFTER THIS DOCUMENT WAS FIRST WRITTEN, so you are not reading
yesterday's state:

-   Both lanes now run from one driver that arbitrates nothing, and each lane
    result names the slices it shipped and withdrew rather than only counting
    them. Decisions 16 and 17, both open to veto.
-   The bench prices sending and answering separately now. Decision 18.
-   QUESTION 1'S COST BULLET CHANGED, because the same bench rows were re-read
    per stage at no new cost and the previous reading was half wrong. Read that
    bullet again if you answer Question 1 from cost.
-   ONE FINDING IS RECORDED AND DELIBERATELY NOT FIXED: an empty critic roster
    settles a document rather than refusing it, so a misconfigured pass would
    write a directory of vacuous settled artifacts and look like a clean run.
    Task `#93` carries it. The quiet path is right for OUTAGES and wrong for a
    deterministic misconfiguration, and the two are indistinguishable
    downstream. Nothing was built because where the refusal belongs is a design
    choice; it needs no answer from you unless you want one.

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
`#84` measures whether the judges are RIGHT when they replace, on a graded
sample, and `#85` rebuilds the damage instrument for output that has no before
text. Neither exists yet, so today the replacement rate is a fact without a
quality reading beside it.

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
    rate for free, since the guard runs whether or not anything ships.
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
