# Translation repair history: segment 1.2

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

WHAT CHANGED SHAPE:
anchors sharing a boundary are now ONE edit rather than
several writes in sequence,
because the separators between them are decided
once for the group.
Content replacements still go in verbatim,
so nothing in
production moves:
no producer emits an anchor yet.

FOUR SPLICE EXPECTATIONS CHANGED,
which is the point rather than a regression.
Each asserted the verbatim write this replaces,
and two of them had an insertion
running into the paragraph after it.
A test that pins the old behaviour of the
thing you are fixing is not a regression test;
it is the defect,
written down.

PROBE:
composition replaced by joining the fragments,
which is exactly the old
behaviour.
Five cases fail,
including the heading case this exists for.

WHAT THE REVIEW LEFT OPEN,
recorded in `#101` and `#100`:
whether a MISSING
replacement for an anchor should be refused the way a blank one now is.
It
cannot be answered until the absent-incumbent work says whether assembly may
ever withdraw an anchor's replacement,
since withdrawing one restores nothing
where a translation belongs.

### A ledger now has to agree with the document it describes

`2920df105`.
`buildSliceDelivery` joins three reports from one lane,
and every
check it made was INSIDE that join:
a row cannot say shipped and undecided at
once,
and a shipped row's text is its accepted text by construction.
What no row
could check is whether the join describes the document the lane returned,
since
the document is not one of its inputs.

TWO CLAIMS,
both needing the document in hand:
the rows marked shipped are the
slices the result names,
and writing those rows over the archive reproduces the
returned text.
The second is the one that earns its keep.
It crosses from what
the lane DECIDED,
which is where a row's text comes from,
to what the document
CARRIES,
which the assembly guard decided;
those are two derivations that agree
today by construction and never said so.

THROUGH THE SAME ASSEMBLY rather than by concatenation,
which is what keeps the
comparison true once anchors exist:
the blank lines around an inserted rendering
are composed and belong to no slice,
so a row's shipped text is NOT a substring
of the document,
and a check that searched for one would refuse a document
nothing is wrong with.
There is a test for exactly that case.

`runDocumentLanes` returns a ledger per lane now,
each checked.
Derived rather
than decided:
each describes its own lane's document and neither mentions the
other,
so which document ships is still Question 5.
Writing one into an artifact
stays there too,
since the settled schema carries one lane (`#96`).

### The lane can be handed a passage the archive never translated

`a5091af5e` and `0ba633b62`,
the third landing of `#100`.
Nothing produces such
a slice yet;
landings four and five are the producers.

THE WRONG-SUCCESS STATE REMOVED:
every fallback in the translate stage ships the
wording already in the archive.
That is right for a slice that HAS one,
since
leaving a passage as it stands is the state the run began in,
and shipping text
no judge vetted is a new claim about the archive.
For a slice with none,
the
same fallback shipped the empty string and reported a settled slice,
so the run
read as having delivered a translation it never produced.

ABSENCE IS A MODE,
NOT AN INFERENCE.
`incumbentKind` is decided from the target
chunk being an insertion anchor,
never from the text being blank:
a content span
holding only whitespace is the archive's own wording,
thin as it is,
and the two
ask different questions.
That is also why it is in the CACHE KEY rather than
only in the record:
both carry identical texts,
so a key over texts alone would
hand one the other's answer.
Schema version 3,
and the bump discarded nothing,
measured first.

NOT STORED ON THE RECORD,
against the review's suggestion,
because the prepared
slice is the source of truth and cannot go stale,
while a copy inside a cache
record could be resumed against a slice of the other kind.

AN ERROR RATHER THAN A RESULT at the stage boundary,
because there is no honest
result to build:
the stage returns the text that ships plus who produced it,
and
here nothing ships and nobody produced it,
so every field would be invented.

WHERE I DEPARTED FROM THE REVIEW,
recorded as decision 26 for veto:
it wanted
the lane to throw and leave the entry unsettled.
The driver instead catches the
refusal per slice,
records the passage as unfilled with the stage's findings,
caches nothing,
and lets the rest of the document settle.
The document keeps the
gap the archive already had,
which states nothing false;
a decline depends on
which judges answered,
so throwing discards every other slice's work over
something that varies between runs;
and `unfilledChunkIndices` names those
slices,
so a missing passage cannot be read as one the judges kept.

THIS ANSWERS WHAT `#101` LEFT OPEN,
and the answer is in the lane rather than in
assembly:
a MISSING replacement for an anchor is legitimate and writes nothing,
because that is exactly what an unfilled slice produces,
while a BLANK
replacement for an anchor whose source says something is still refused,
because
that is a lane claiming delivery.
The two were never the same case.

A BLANK TRANSLATOR REPLY IS NOW A LOST VOICE.
`{"translation": ""}` satisfies
the schema,
so it arrived as a heard voice,
was dropped further down as an
unusable candidate,
and its model counted as answered and was never re-asked.
The wire guard refuses it,
so the roster asks again.
Decision 27 records what
that changes in a count.

THE REPAIR LANE SAYS THE QUESTION DOES NOT APPLY.
Its critics compare a
translation with its original,
its editor rewrites the regions their defects
name,
its checkers confirm they are gone;
handed an anchor,
every stage is asked
about text that does not exist.
`notApplicableRepair` states that,
with no
exchange spent,
and the outcome list stays position-aligned with the slice list,
which is what a skip would have broken.
Measured rather than asserted:
the same
preparation with and without an anchor spends 14 exchanges,
against 17 when the
branch is neutered.

TWO FILES WERE SPLIT AT THEIR LINE BUDGET rather than raised.
`translate-stage-result.ts` holds what a round DECIDED,
which is the record every
later reader joins to,
and `translate-slice-attempt.ts` holds one slice's two
honest endings.
The second split was forced by a rule worth knowing about:
`no-nullish-union` refuses `TranslateSliceRecord | undefined` as a return type,
so the two endings had to be named rather than one of them spelled as absence.

FOUR PROBES,
each shown to fail before being trusted:
the absent-mode
no-candidate refusal removed (only the no-candidate case fails),
the absent-mode
decline refusal removed (only the two decline cases fail),
the wire guard's
blank rejection reverted (the re-ask case fails on the heard count,
3 against
2),
and the repair lane's anchor branch removed (the exchange count moves from
14 to 17).

### What the review of that landing found, and what is still open

A source-bearing external review of the absent-incumbent work,
run over the
whole lane,
the selector and the assembly path.
Four defects were real and are
fixed;
three items are recorded rather than built,
and one claim it made is
answered by a measurement rather than by code.

WHAT COULD HAVE RECORDED A TRANSLATED PASSAGE AS A MISSING ONE,
which is the
class that mattered.
A blank winner raised the ABSENCE error,
so a deletion for
a slice the archive does translate would have been caught by the driver and
written into the unfilled list.
It now raises its own error,
in either mode,
since a deletion is a defect rather than an outcome.
Two more layers refuse the
same shape:
the attempt layer accepts an unfilled result only for an anchor,
and
the wording builder refuses an unfilled index naming a slice with archive
wording.
None of the three was reachable through the normal path;
all three are
one regression away from being reachable,
and the failure is silent.

THE ALIGNMENT REFUSAL WAS NOT GATED BY MODE.
It restores the incumbent,
which at
an anchor is nothing,
so a selected rendering could have been turned into a
settled blank anchor:
the exact wrong-success state this work removes,
arriving
by the back door.
Gated to a present incumbent,
with a check that a record for an
absent slice carries a translation before it is built.

A DOCUMENT WITH HOLES NOW SAYS SO.
`status` is `complete` or `unfilled`,
and the
gaps are entries carrying their reason and the stage findings rather than a list
of indices.
The old shape was nameable and still missable:
a consumer reading
the text and the counts saw an ordinary success,
and several unfilled slices
flattened their evidence into one list where nothing said which passage each
belonged to.

THE JUDGE SHEET WAS PROMISING A FALLBACK THAT DOES NOT EXIST.
Every judge is told
declining is safe because the caller keeps text it already trusts;
at an anchor
there is none,
so the sentence bought a missing passage with the caution it
asked for.
The consequence is now the caller's to state,
defaulted to the old
sentence so no other caller changes,
and the test reads the sheets the judges
received rather than trusting the builder.

ONE CLAIM ANSWERED BY MEASUREMENT rather than by code:
the review doubted that
the repair lane spends nothing on an anchor,
since the not-applicable outcome
still reaches refinement.
It does reach it,
and costs nothing,
because
refinement derives its envelopes from the outcome text and an empty text yields
none.
The test measures the exchange count with and without an anchor:
14 both
ways,
against 17 when the branch is neutered.

ONE CORRECTION TO MY OWN REASONING,
worth keeping because the rationale was
wrong while the change was right.
The cache key carries the incumbent kind,
and
I justified it with a collision between an anchor and a whitespace-only content
span.
There is no such collision:
the whitespace span carries its whitespace
rather than the empty string,
and a content chunk covering nothing is refused by
the layout guard.
The field stays because the QUESTION differs,
which is a
better reason and holds even if those two facts change.

WHAT IS RECORDED RATHER THAN BUILT,
all in `#100` and `#102`:
a machine-readable
disposition on the repair not-applicable outcome,
which is prose-only today;
a
structured attempt ledger with an explicit retry policy,
which the review ranks
above both the current always-retry behaviour and an expiring negative cache,
and which needs the decline rate measured first;
and the settled-record list
still holding only filled slices rather than a full-length union,
which the
status field and the unfilled entries make legible but do not make positional.

ONE THING DELIBERATELY LEFT AS IS,
since the review flagged it as a cost:
two
identical anchors in one document are both bought,
because an unfilled slice is
memoized nowhere.
That is the cold-warm agreement rule rather than an oversight.
A warm run finds nothing cached for an unfilled slice and buys it again,
so an
in-run memo would make a cold run cheaper than a warm one over the same
document,
which is the divergence that memo exists to prevent.

### Landing four has its guard and its grouper, and is not wired

Two commits,
both inert:
`40d335504` adds the check the landing needs before its
producer changes,
and `70f46b590` adds the grouper beside the existing one.
The
slicing every run uses is untouched,
so this can be proven before it decides a
corpus.

THE GUARD FIRST,
because it is the one correction on the landing's list with
nothing behind it.
A content span's offsets come from the first and last node of
its run and its text is sliced from those offsets,
so a block lying between two
members of the run but missing from it is INSIDE the range,
agrees with the
document byte for byte,
and passes every check there was.
Assembly then writes
over the range,
replacing a block no lane ever read.
`assertSpanContiguity` runs
at preparation,
where the document's whole node sequence is in hand,
and checks
by identity rather than by count:
a slice carrying one block from outside its
range and one fewer from inside would count correctly and describe two different
passages.
Every slice produced today passes it,
which is expected,
since
consecutive grouping cannot skip a block.
A run built by FILTERING can,
and that
is what the new grouper would have done naively.

THE GROUPER,
in `group-source-first.ts`.
A source run with no counterpart
becomes its own unit carrying the BOUNDARY its translation belongs at,
rather
than being folded into a neighbour that already covers text and has nowhere to
put a rendering.
A paired unit never spans such a gap.
Target intervals are
taken as a slice of the whole target sequence between the first and last
supported index,
so a target-only block inside the interval belongs to the unit
rather than falling out of its run;
a target-only run that pairs with nothing
joins the unit before it,
or the one after it when there is none,
rather than
becoming a block no slice covers and nobody reviews.

SPLIT FROM THE ALIGNING on purpose,
which is also why the tests read the way
they do.
`groupAlignedSteps` takes the steps;
`groupSourceFirst` is the wrapper
that computes them.
Which block pairs with which is the aligner's judgement from
similarity,
and the first draft of these tests asserted an anchor's boundary
after feeding Chinese and English through the real aligner:
it failed,
because
the aligner had paired the blocks differently and the test was measuring that
rather than the grouping.
The structural cases now write their steps out.

WHAT THE WIRING STILL OWES,
which is the rest of landing four:

-   `subdivideChunkPair` calls `groupSourceFirst` instead of `groupNodesAligned`,
    turns a paired unit into a `ChunkPair` as it does now,
    and turns an anchored
    unit into a pair whose target side is `makeInsertionChunk` at the boundary.
    The boundary is a target NODE INDEX;
    the offset is that node's start,
    or the
    section's end when the index is the block count.
-   `mergeOneSidedRuns` and the unreachable proportional branch come out with it.
-   Several existing fixtures will break,
    and correctly:
    any that assert a
    one-sided run folded into a neighbour are asserting the behaviour this
    replaces.
-   `alignmentPairCount` stops meaning what it says once insertions enter the
    pairs,
    per `#100`.

WHAT IT WILL COST IN CACHE TERMS:
nothing measurable.
Re-slicing changes slice
texts,
which changes both lanes' keys,
and the runs directory holds no record
under either lane's current version.

### Landing four is blocked, and the measurement that blocked it

The wiring was reviewed before it was written,
which is why nothing shipped a
duplicated paragraph into the archive.
Two independent reviews found the same
reflow defect,
and one found the thing that stops the landing.

THE REFLOW DEFECT,
fixed in `0495fb1a5`.
An orphan translation run attached to a
paired unit on the far side of an anchor stretches that unit's span past the
boundary the anchor names,
so the anchor sits inside a span that precedes it in
slice order and `assertPlacementLayout` refuses the whole preparation.
Both
attachment directions have the fault,
so the rule is about the anchor rather
than about the direction:
anchors partition the units into regions,
and an
orphan joins a paired unit only inside its own region,
the one before it where
that exists.
A region with no paired unit leaves its blocks uncovered,
which
costs review and nothing else,
since assembly writes nothing there.

BOTH GUARDS WERE SHOWN TO FAIL against the reflow as `70f46b590` had it,
and one
of them had to be rewritten first:
a target-only step inside an open group joins
that group's interval,
so the case never built a source-less unit and passed
against both implementations.
A budget flush between the two blocks is what
closes a group with no source side.
The first probe of the pair was also
unfaithful,
restoring the region rule's absence but not the original's trailing
attach,
and it reported everything green;
that is the shape of a null result
from a probe that cannot show a difference.

THREE SMALLER CORRECTIONS rode along.
`groupNodes` moved to `group-nodes.ts`,
because the wiring would have had `slice-pair.ts` and `group-source-first.ts`
importing each other.
The anchor boundary became a value naming a BLOCK or the
section end,
rather than an index into a sequence the holder has to guess,
which
is the same class of confusion `#99` fixed for slice indices.
Alignment steps
naming a block that is not there are now refused rather than dropped,
since
dropping shortens a run that then covers a span it does not carry.

WHAT STOPS THE LANDING:
a `source-only` step is not evidence that a passage is
untranslated.
`alignBlocks` can pair one with one,
skip a source block,
or skip a
target block,
and that is all;
it cannot say that two source paragraphs were
rendered as one.
So a merged pair spends the aligner's only available move and
the second paragraph arrives as `source-only`,
identical to an omission.

MEASURED OVER THE PINNED CORPUS,
92 entries and 275 two-sided sections:
2290
paired steps,
95 source-only,
132 target-only.
Twenty-three entries carry at
least one,
and two of them carry sixty of the ninety-five.
A length signal
(how far the neighbouring pair's target-to-source ratio exceeds the section
median) has a long tail,
p90 at 2.41,
and 67 of the 95 sit under 1.2.

A HAND SAMPLE OF TWELVE,
six from each end,
says the length signal separates the
top and says nothing about the bottom.
At the top the steps are merges:
one
entry renders four consecutive Chinese lines as a single English block,
so three
arrive as source-only,
and another does the same to a blockquote.
At the bottom
they are mostly MISPAIRINGS:
an English footnote definition paired with the
following Chinese footnote leaves the preceding one reading as untranslated with
its translation sitting right there,
and a narration line paired with the
translation of a line three blocks later leaves two quoted lines apparently
unrendered.

SO THE ANCHOR DESIGN RESTS ON BLOCK PAIRING BEING TRUSTWORTHY,
and the sample
says it is not.
This is `#74` restated one level down:
that task found the
section-level scoring broken,
and the same weakness decides block pairing.
The
paths out are in `#106` and the question for the morning is in the decisions
doc,
because they differ in expense rather than in correctness.

WHAT IS STILL TRUE AND UNBLOCKED:
the guard (`40d335504`),
the grouper and its
tests,
the reflow rule,
the boundary value,
and every invariant landed earlier.
Nothing calls the grouper,
so none of it decides a corpus yet.

### The section-level census, which refuted the plan it was run to support

Landing five looked unblocked:
a source section with no target section is
stronger evidence than a single unpaired block,
so it could ship while landing
four waited.
That belief lasted until it was measured,
and the measurement is
the reason nothing was built on it.

WHAT THE CORPUS HOLDS:
92 entries,
of which 85 never reach the section matcher
at all,
because equal heading counts short circuit it (`#98`).
Of the seven that
do,
two produce unpaired source sections,
eleven in total.

EIGHT OF THE ELEVEN ARE FALSE.
One entry carries eight Chinese sections whose
English counterparts are plainly there under corresponding headings,
and the
matcher refused every one of them with reason `ambiguous`.
Its target side
carries a preamble chunk the source lacks,
which is `#74`'s asymmetric-preamble
finding arriving one level up.
Inserting on those eleven would have added about
seven thousand characters of duplicate translation to a document that is already
complete.
The three true ones are the tail sections of the entry `#71` is about.

THE REFUSAL REASON DOES NOT SEPARATE THEM:
all eleven say `ambiguous`,
so there
is no field a filter could read.
The matcher distinguishes PAIRED from UNPAIRED
and nothing else,
and an insertion needs a third verdict it never produces.

SO BOTH LANDINGS REST ON THE SAME MISSING THING,
and it is not a slicing
problem.
Question 28 in the decisions doc puts the four ways out,
and its
ranking changed because of this census:
the option that asks a model whether the
translation carries a passage AT ALL is the only one that does not consult the
pairing this measurement impeached.

WHAT THIS DOES NOT CHANGE:
everything landed so far stays.
The guards,
the
grouper,
the reflow rule,
the boundary value,
the delivery ledger and the
absent-incumbent lane are all correct and tested,
and none of them decides a
corpus until something wires the grouper up.

THE MEASUREMENTS ARE REPEATABLE:
`scratchpad/merge-census.mjs` for blocks and
`scratchpad/section-census.mjs` for sections,
both reading the pinned corpus and
spending no quota.
Neither prints corpus text into anything durable;
the hand
samples were read in the terminal only.

### Four findings from the section review, three fixed and one refuted

The review that blocked landing five also found defects in code that is already
running,
and they are independent of the decision it blocked.

THE CONTIGUITY CHECK COULD NOT SEE A CUT BLOCK.
It counted document nodes wholly
inside a span's range,
so a range stopping partway through a paragraph hid in
the gap between two facts:
the straddled block is not inside,
so it was not
counted,
and a span carrying nothing across half a paragraph agreed with itself.
It now reads every node the range touches and refuses a partial one by name.

THE SAME CHECK SKIPPED INSERTIONS ENTIRELY,
and the layout check cannot cover
them either:
an empty span starts where it ends,
so it never overlaps a
neighbour however wrong its offset is.
An anchor strictly inside a block would
have had assembly split that block around the inserted text.
Refused now,
and
both guards were shown to fail against the previous version.

THE FRAGMENT TRIM WAS DESCRIBED WRONGLY RATHER THAN WRITTEN WRONGLY.
Its comment
said it cut blank-line material and nothing else,
and the trailing side cuts
spaces too,
including the two that make a Markdown hard break.
Every caller
reaches it through `composeInsertion`,
which joins fragments with a blank line,
and a hard break before a blank line breaks nothing,
so the behaviour is right
and the claim was not.
The comment now names the condition that makes it safe
and a test pins both ends,
so a join that ever put two fragments on consecutive
lines fails there.

THE FLOATING-POINT CONCERN DOES NOT BITE,
and this is the one worth recording
because it was a plausible cause of a real symptom.
Lexicographic scores are
compared with strict equality while forward and backward path sums recombine the
same affinities in different orders,
so a genuinely optimal edge could fail the
comparison and manufacture an ambiguous refusal.
Measured:
comparing with a
tolerance of 1e-9 leaves all eleven unpaired source sections exactly as they
were,
and so does a tolerance of 0.05.
THE PROBE CAN SHOW A DIFFERENCE,
which is
what makes those nulls worth anything:
making every comparison return true moves
the same census from 11 unpaired source sections in 2 entries to 35 in 7.
So the refusals are the scorer's own judgement rather than numerical noise,
which strengthens rather than weakens what `#106` concluded.
The scorer was left
alone;
quantizing it can wait until something inserts on its verdicts.

### Body-token evidence for handle-free headings: measured, and it makes things worse

`#98` says the fast path can only be gated once heading scoring has a signal for
headings that share no Latin,
which is most of this corpus.
The obvious
candidate is the section BODY:
a memorial page carries names,
handles,
links and
dates that survive translation,
and a token appearing in exactly one section of
its own side identifies that section.

THE SIGNAL IS REALLY THERE.
Scoring each source section's distinctive body
tokens against each target section's pairs 其二：铃语 with Lingyu and 其四：无常
with Ann at 1.00,
which heading Latin alone cannot do,
and it leaves the two
sections the English never carried without a match.

AND FEEDING IT TO THE MATCHER MAKES ALIGNMENT WORSE.
Measured without changing
the library,
since the matcher scores Latin runs in whatever label it is handed:
appending each section's distinctive body tokens to its heading changes seven
entries and raises unpaired source sections from 11 to 18.
Two entries lose
correct pairings outright,
one of them turning a correctly paired section into a
refusal on both sides.

WHY,
and this is the part worth keeping:
with no Latin anywhere,
every pairing
scores zero,
the scorer has no preference,
and the lexicographic gap-count
component pairs by position,
which is right.
Body tokens give many pairings a
small non-zero score,
some of them spurious,
and a spurious strict row-and-column
maximum becomes a TRUSTED ANCHOR,
which outranks gap count and drags the rest of
the alignment into gaps around it.
Evidence that is weak and plentiful is worse
than none,
because the top of this scorer's order is designed to trust evidence.

WHAT WOULD HAVE TO BE TRUE for a second attempt:
body evidence entering BELOW
gap count,
as a tie-break among otherwise equal optima rather than as an anchor.
That is a fourth lexicographic component and a real change to the scorer,
and it
would fix at most one of the eight false refusals in `XIEPT2`,
whose sections
share no body tokens with their translations either.
It is not worth it.

SO THE DETERMINISTIC PATHS ARE EXHAUSTED for this corpus:
heading Latin,
section
length,
and body tokens have all now been measured,
and none of them can tell a
translated section from an absent one when the two sides share no characters.
What is left is semantic,
which is question 28's option A.

### The coverage probe corrected me, which is the strongest thing it could have done

`#106` says nothing produces a positive verdict that a passage is untranslated,
and question 28 asks what should.
Its stated default was to ask a model whether
the translation carries the passage AT ALL,
scoped to the whole translation
rather than to the neighbours an aligner chose.
That is built,
in
`coverage-wire.ts`,
`coverage-verdict.ts`,
`coverage-stage.ts`,
`coverage-candidates.ts` and the `coverage-probe` task,
and nothing calls any of
it:
no slicing,
no artifact and no lane reads a word of its output.

THE SHEET SEARCHES RATHER THAN TRANSLATES,
and every claim of coverage must
quote the English carrying the passage,
copied from what the model was shown.
A
claim whose quote is not in the document is DROPPED,
and is not counted for
absence either:
a bad quote is a voice that answered unusably,
and reading it as
agreement with "nothing carries this" would turn an invented quote into a reason
to insert text.

WHAT IT FOUND,
and it is not what I expected.
Asked about the eight unpaired
sections of `XIEPT2`,
six models answered `absent` on all eight,
near
unanimously.
I had labelled all eight CARRIED in the census,
because their
English headings plainly correspond:
经历 with Experience,
遇见 with Meeting,
and so on.
I checked after the probe disagreed with me.

THE ENGLISH DOCUMENT IS 1,218 CHARACTERS AGAINST 7,365 CHINESE.
Every section of
it except the last is a HEADING WITH NO BODY,
one block long,
seven to thirteen
characters.
The headings correspond and the translations do not exist.
My label
inferred body coverage from heading correspondence,
which is exactly the
reasoning this project keeps catching elsewhere,
and the probe caught it in me.

WHAT THAT CHANGES:
the section matcher's refusals were RIGHT IN OUTCOME on that
entry,
though for a reason it cannot state,
and the count of genuine insertion
candidates at section scale is higher than the corrected census said,
not lower.
Question 28's ranking moved with it.

AND IT EXPOSED A DESIGN DEFECT no amount of reading would have:
when a source
section's counterpart is a heading with no body,
the body belongs UNDER THAT
HEADING,
not inserted as a fresh section.
Landing five as designed inserts the
whole source section,
heading included,
at a boundary,
so on this entry it would
have produced eight duplicated headings.
The insertion unit has to be the
section BODY,
anchored after the existing target heading,
whenever a
corresponding heading is present.

### What the coverage probe measured, and the one thing anchoring does not prove

Eleven section candidates,
six voices each,
about two minutes and sixty-six
calls in total.
Verdicts against what the documents actually contain:

-   `XIEPT2`,
    eight sections:
    ABSENT on all eight,
    near unanimously.
    Correct.
    That entry's English is a set of headings with no bodies.
-   `XingZ60` section 12:
    CARRIED,
    four anchored and none absent.
    Correct,
    and I
    had it labelled missing.
    The source heading is 其九：空白,
    meaning blank,
    and
    the English heading is `### __`,
    which is the rendering.
    The matcher could
    not pair them because `__` carries no Latin run to score,
    and the bodies
    correspond underneath.
-   `XingZ60` sections 13 and 14:
    ABSENT.
    Correct;
    the English ends at the
    section that pairs with 12.

SO ELEVEN OF ELEVEN,
and my hand labels were wrong on nine of them.
That is the
result worth acting on:
the probe is not merely cheaper than reading,
it was
RIGHT where careful reading was wrong,
twice in opposite directions.

WHAT ANCHORING DOES NOT PROVE,
measured on the same run:
on section 14 two of
six voices claimed coverage and their quote WAS in the document,
a sentence
about helping people in marginalised groups that belongs to the introduction
rather than to the passage asked about.
An anchored quote proves the English
exists.
It does not prove the English renders THIS passage,
and the verdict
treats the two as the same thing.
Both voices agreed on the same irrelevant
sentence,
so agreement between voices does not separate them either.
The majority rule absorbed it here,
four to two.
It would not have on a roster
of three,
and it will not when the irrelevant sentence is the one most voices
reach for.

WHAT THAT COSTS AND WHAT WOULD FIX IT:
the failure direction is a false CARRIED,
which suppresses an insertion rather than causing one,
so it is the cheap
direction to be wrong in and nothing is at risk while nothing is wired.
The
straightforward fix is a second field:
the model names the SOURCE sentence its
quote renders,
and a verdict keeps only claims whose named source sentence is
actually in the passage asked about.
That is a wire change and a rerun,
not a
redesign.

### Block scale measured too, and it settles what landing four would have done

Twenty-two unpaired blocks,
from three entries,
six voices each:

    carried    18, most of them unanimous
    absent      1
    split       3, all with ZERO votes for absence: every voice believed the
                translation carried it and some could not quote it exactly

So at paragraph scale,
at most one of twenty-two passages the aligner refused is
a passage nobody translated.
Landing four inserts on all of them.
Corpus-wide
that is 95 refusals,
and this sample says the great majority already read
correctly in the archive.

THE SIX I HAD LABELLED BY HAND ALL AGREE with the probe,
including the three
consecutive lines one entry renders as a single English block,
the footnote
whose translation is paired with the following footnote,
and the blockquote
another entry renders as one paragraph.

HOW MUCH OF THIS IS THE MEASUREMENT AND HOW MUCH IS THE CLASS BALANCE,
which a
review asked and is the right question.
Within either set alone,
a constant
answer scores well:
always CARRIED gets 18 of 22 at block scale,
always ABSENT
gets 10 of 11 at section scale.
POOLED ACROSS BOTH,
thirty-three candidates
drawn the same way from the same corpus,
no constant answer beats 19 of 33.
The
probe agrees with every label I have,
in both directions,
which is what a
constant answer cannot do.

WHAT IS NOT ESTABLISHED,
and should not be claimed:
eleven of the thirty-three
sit in two entries and twenty-two in three,
so these are not thirty-three
independent documents.
Sixteen of the twenty-two blocks have no hand label at
all.
The labels were made by me,
after seeing the aligner's verdicts.
A real
accuracy number needs a preregistered sample,
blinded labels and a held-out set,
and `#106` says so rather than quoting a percentage.

THE VERDICT RULE WAS WRONG AND IS FIXED.
It took the majority over voices HEARD,
so one voice reporting it found nothing decided absence with five models lost
and quorum unmet,
while four fabricated quotes plus two such reports gave only
split:
silence was more dangerous than fabrication.
It now needs a majority of
every model ASKED,
an unmet quorum is inconclusive,
and partial coverage is its
own verdict rather than collapsing into carried.

### A correct quote was being refused over a line break, in both lanes

The three coverage candidates that came back SPLIT had something in common:
no
voice said the passage was absent.
Every one believed the translation carried
it,
and some could not point at it.
The new rows keep the quotes that failed to
anchor,
so the reason is now measurable rather than guessable.

TEN OF ELEVEN FAILED ANCHORS ARE A SOFT LINE WRAP AND NOTHING ELSE.
A model
copying a sentence out of a wrapped paragraph writes it on one line;
the
document holds the same characters with a newline in the middle;
the locator
searched byte-exact,
then with punctuation normalised,
and refused.
It then
NAMED the cause in the failure reason,
`[line-break-collapsible]`,
having
computed the collapsed match to say so.
