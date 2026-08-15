# Decisions waiting on you, 2026-08-15 morning

Written overnight on 2026-08-14 to 15, while the translate lane was built out.
Each question below is one I could not answer from the code, the corpus, or a
measurement I could take without spending your quota on a decision you may
reverse.
Every one of them names what it blocks, so you can skip the ones that block
nothing you care about today.

The last section lists decisions I took WITHOUT you, with the reasoning, so you
can veto any of them cheaply.

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

-   COST, roughly linear in producers for the translate calls, and worse than
    linear downstream, because every candidate becomes repeated input to every
    judge in the selection round.
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

AT 22 ROWS OF 60 THE BAND HAS NOT NARROWED. Four slices are finished, and the
width-four repeat flipped the outcome on two of them and moved the winning
weight on a third:

    Mio#5            pass 1 replaced at 4.5   pass 2 declined, kept
    aiyysk#39        pass 1 replaced at 3.5   pass 2 declined, kept
    zhangyubaka#23   pass 1 replaced at 5.5   pass 2 replaced at 2.5
    noname#9         pass 1 replaced at 3.0   pass 2 replaced at 5.5

That is the same slice, the same width and the same roster each time. I expect
this to decide the shape of the answer more than the width sweep does: if the
sweep lands inside this band, the honest reading is that width does not
measurably change agreement on ten slices, not that some width won.

ONE EARLY TENDENCY, on four slices and so not yet a rate: the lane replaced the
archive translation in 17 of those 22 rows, at every width including two. If
that holds across the sample it matters more than the width question, because it
says the judges prefer fresh text over the human translation most of the time,
and `#84` is what would tell us whether they are right to.

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
