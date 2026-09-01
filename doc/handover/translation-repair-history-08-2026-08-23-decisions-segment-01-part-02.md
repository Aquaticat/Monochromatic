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

## Why the advisor tool was not called on this

Recorded so a later session does not read the omission as an oversight.

The harness instructs calling the `advisor` tool before committing to an approach,
and this reframing of
`#186` is exactly such a moment.
It was not called,
for the same reason the sol advisor is barred:
`advisor` forwards the whole transcript,
and this transcript carries corpus passages,
including source text read out of the probe's own judge rationales earlier today.
The corpus is unlicensed,
all rights reserved,
and sending it to an external reviewer publishes it.
The recorded ban names the sol advisor,
but its stated reason is the transcript's contents,
which is a property of the transcript rather than of which tool reads it.
Any reviewer that reads this transcript is barred by that reason.
A later session wanting outside review of a corpus-touching decision should get it from a reader given
the CODE and the COUNTS,
never the transcript.

## Task 186, two instrument defects found before the draw was spent

Both were found on 2026-08-23 by exercising the probe's own output on invented fixtures while the
smoke run was still in flight,
rather than by reading the code again.
Neither would have announced itself.
Both would have been met for the first time at the end of a draw that had already spent its quota,
which is the expensive moment to learn that the instrument was wrong.

### The null band was measured over the wrong rows

`summarizeWidths` filtered out every row it classified `nothing-shipped` before counting anything,
on the stated grounds that a slice neither arm touched says nothing about width.
That is true of the MOVE count and false of the BAND.

A slice where both arms shipped nothing is classified `nothing-shipped`,
but the narrow arm's REPEAT is a third run and may well have shipped something.
That row carries churn.
It can never carry a move,
because the two arms agreed.
Excluding it therefore removed churn observations while removing no move observations,
so the band came out systematically too small and every reading tilted toward width mattering.

Both counts now run over every row,
with the trivial slices broken out in the report so a reader can
still see how much of the draw was untouched.
The test that pinned the old behaviour was rewritten,
and a new case covers the exact row the old filter dropped:
`nothing-shipped` with the repeat disagreeing.

### The held-back half of the sample could not be run

The probe split its sample in two and said so in its header comment,
in its console output,
and in the
report's own advice about what to do with a result near the band.
Nothing could run the second half.
`main` filtered the even positions into `drawA` and iterated exactly that,
with no selector anywhere.
Both draws would also have written `editor-width.md`,
so even a hand-edited run of draw B would have overwritten the reading it exists to be checked against.

The draw is now named on the command line,
defaults to A,
is REFUSED when it is neither half rather
than quietly spending draw A under another name,
and the report is written per draw and says which
one it describes.

The general lesson is the one the corpus keeps teaching:
a claim written in a comment is not a mechanism.
`grep` for the noun a comment promises,
and check something reads it.

## Task 186, what the smoke run measured and how the real draw is sized

The smoke run on 2026-08-23 spent four sampled slices,
two of which became draw A.
Its job was to prove the wiring,
not to answer anything.

WHAT IT PROVED,
at the user boundary:

-   The positive control works and HELD.
    The panel preferred intact text over the same text with a
    sentence removed,
    on both control pairs,
    over both seating orders.
    The draw is therefore readable.
-   The whole chain runs:
    sample,
    gather,
    three arms,
    contest,
    report.
-   The null band is real rather than an artifact.
    `runEditorStage` holds no cache,
    and the slice cache
    lives a level above where this probe calls in,
    so the narrow arm's repeat is a genuinely fresh run.
    The first draw slice confirmed it empirically by flipping.

THE ONE MEASURED NUMBER worth carrying forward:
about FIFTEEN MINUTES PER SLICE.
Draw A began at 08:48:35 and its first row landed at roughly 09:03:30.
That is one gather plus three editor stages plus a two-order contest,
run strictly sequentially so
every arm meets the same provider conditions.

Sizing follows from that number rather than from the eighteen written into the probe:

-   a draw of nine,
    the old default,
    runs about two and a quarter hours
-   a draw of twenty runs about five hours
-   a draw of thirty runs about seven and a half hours

Twenty is the choice,
from a sample of forty,
leaving twenty untouched in draw B.
The reasoning is that the headline comparison is PAIRED,
one move bit and one churn bit off the same
slice,
so what decides it is the count of discordant slices rather than the raw draw size.
Nine slices yields a handful of discordant pairs and cannot separate anything.
Twenty is affordable in wall time with a week to the deadline,
and leaves an equal held-back half so
a result near the band has a second reading that was never looked at.

THE FIRST DRAW SLICE,
recorded because it is the pattern to watch for and not because one slice
decides anything:
the arms differed,
the narrow arm run twice ALSO differed from itself,
and the
head-to-head came back `position-decided`,
meaning the panel picked whichever candidate sat first in
both orders.
That is what a null result looks like.
It is one slice.
It is not the answer.

## Task 186, the third defect, which biased the answer rather than the plumbing

Found 2026-08-23 by auditing the remaining probe modules for the pattern the first two shared:
a comment asserting a property the code did not have.
This one is worse than the other two,
because it did not break the run,
it tilted the result.

The contest seats two shipped repairs and asks the panel which it prefers.
The winner was read by comparing the shipped text against each arm's text.

AN ARM THAT DECLINES TO REPAIR OFFERS THE UNTOUCHED TRANSLATION.
So does the fallback the stage ships when the panel will not separate the pair.
They are byte-identical,
so the text comparison could not tell them apart,
and the reader credited the declining arm with every indecision.

The comment beside that fallback said the opposite:
"A PAIR THE PANEL WILL NOT SEPARATE FALLS BACK TO NEITHER",
with a note that seating the fallback as the first candidate would launder position bias into a result.
The intent was right;
nothing enforced it.
`editor-ensemble.ts:449` reports `shippedProducer: indecisionFallback.producer` verbatim,
and the fallback was built as a composite with no contributors,
which is exactly what an arm whose own producer went unattributed carries.
So neither the text nor the producer separated them.

WHY THE DIRECTION MATTERS.
The wide arm fields twice the candidates against the same selection minimum,
so it splits its own vote and declines more often than the narrow arm does.
The arm that declines more often is the arm that collects more spurious wins.
The bias therefore ran toward "widening helps",
which is the conclusion the draw exists to test.

THE FIX reads the SEAT a round settled on rather than the text:
the fallback is marked `incumbent` and a rejection is `unattributed`,
while both arms are always seated as composites,
so the producer kind alone separates a decided round from a declined one.
The two orders then map seats to opposite arms,
which is what cancels position bias.

GFP-PROVEN.
Removing the producer-kind guard fails exactly the two collision cases,
the indecision and the rejection,
while the genuine-win case still passes.
Restored byte-identical from the commit.

The three defects share one shape,
and it is worth naming for whoever reads this next:
every one was a COMMENT THAT DESCRIBED AN INVARIANT NOTHING CHECKED.
The null band said it measured the lane's own variance and silently dropped the rows that carried it.
The sample said it held half back and had no way to run that half.
The fallback said it credited neither arm and credited whichever one had declined.
Reading the comments as documentation would have found none of them;
reading each one as a claim to verify found all three.

## Task 186, draw A is running

Launched 2026-08-23 at about 09:22,
sample of 40,
draw A of 20,
draw B untouched.
Runs dir is a throwaway under `~/temp/agent/186-width-draw-a`,
never the real runs directory.
At the measured fifteen minutes a slice it should finish in roughly five hours.
The report is rewritten after every slice,
so it can be read at any point and a killed run keeps
everything it paid for.

READ IT AGAINST THE NULL BAND,
never on its own,
and read the two one-sided ship counts before calling any move an improvement.

## Task 186, what draw A measured

Ran 2026-08-23,
09:24 to 14:01,
twenty slices of a sample of forty,
4.7 hours.
Sixteen slices carried work;
four were skipped for holding no accepted issue.
Positive control held on all three pairs before any of it was spent.
Pipeline commit `4dbf53d0d`.

THE CHANGE SIGNAL IS ENTIRELY INSIDE THE NULL BAND.

-   shipped text moved when the editors doubled:
    12 of 16
-   NULL BAND,
    the narrow arm run twice shipping different text:
    13 of 16
-   slices that moved WITHOUT churning:
    0
-   slices that churned without moving:
    1

Read raw,
"twelve of sixteen moved" sounds like width doing something.
Read against the band it is nothing:
the same roster run twice against the same work disagrees with itself thirteen times out of sixteen,
which is MORE often than doubling the roster changed anything.
The paired reading is the one that decides it,
because both bits are measured on the same slice,
and it is as null as a result can be:
not one slice in sixteen shipped text under a doubled roster that the narrow roster would not have
changed on its own.

THE QUALITY READING IS SUGGESTIVE AND DOES NOT SETTLE.
Of twelve contests,
six were decided by the SEAT rather than the text,
over both orders.
Of the six that survived the swap,
five preferred the wide arm and one the narrow.
Five of six is not evidence at this size:
under no true difference,
a split that lopsided or worse arrives about one time in nine.
Six of twelve contests turning on position is itself worth recording,
because it bounds how finely this panel can separate two serious repairs of the same passage.

NO SUPPRESSION APPEARED.
Both arms shipped a repair on all sixteen rows.
Nothing was suppressed and nothing was bought:
the wide arm never split its vote into keeping the incumbent,
which was the failure mode
the one-sided ship counts were added to catch.

A HONEST NOTE ABOUT THE CONTEST FIX.
Because both arms shipped everywhere,
the fallback collision had no case to fire on in this draw:
with neither arm offering the untouched translation,
the fallback text matched neither,
and the old
reader would have returned the same answers.
The fix did not change these numbers.
It was still required,
because that could not be known before running,
and it protects draw B and
every later run,
where a declining arm is not ruled out.

WHY DRAW B IS BEING RUN rather than calling it here.
The change reading is settled and null.
The quality reading is not settled,
and it is the one `#186` actually asks about.
Draw B is the untouched half of the same sample,
so running it doubles the head-to-head without
redrawing and without looking at the first half twice.
If the wide lean survives it,
there is something to act on;
if it does not,
width is answered null on
both readings and `#188` closes unbuilt.

## Task 186 ANSWERED: the width does not decide it, on both readings

Draw B ran 2026-08-23,
14:05 to 19:29,
5.4 hours,
on the untouched half of the same sample.
Fifteen slices carried work,
five were skipped.
Combined with draw A,
thirty-one slices carried work across forty drawn.

THE PAIRED READING,
combined:

-   moved AND churned,
    so uninformative:
    22
-   moved WITHOUT churning,
    which is width doing something:
    1
-   churned without moving,
    which is the lane alone:
    2
-   neither:
    6

One slice in thirty-one shipped text under a doubled roster that the narrow roster would not have
changed on its own,
against two that the narrow roster changed with no widening at all.
That is not a small effect,
it is no effect:
the discordant slices,
which are the only ones carrying information,
point slightly the wrong way.

Raw totals say the same thing more loudly.
Draw A moved 12 against a band of 13.
Draw B moved 11 against a band of 11.
Both draws put the move count AT OR BELOW its own null band.

THE QUALITY READING,
combined,
and this is why draw B was worth its 5.4 hours:

-   contests run:
    23
-   decided by SEAT rather than text,
    over both orders:
    7
-   survived the swap:
    16,
    splitting 10 wide and 6 narrow

Draw A alone read 5 wide against 1 narrow,
which looked like something.
Draw B read 5 against 5.
Ten against six over sixteen arrives about one time in four under no true difference.
Draw A's lean was noise,
and the split sample is the only reason that is known rather than believed.
Had draw A been reported alone,
the honest reading would still have been "suggestive",
and the temptation to act on it would have been real.

A SECOND THING THE TWO DRAWS DISAGREE ABOUT,
worth carrying forward.
Draw A decided 6 of 12 contests by seat;
draw B decided 1 of 11 that way.
The panel's ability to separate two serious repairs of one passage is NOT stable between runs
hours apart,
on the same models and the same sheet.
Any future measurement resting on this panel separating fine differences should measure that
decisiveness first rather than assume it.

NO SUPPRESSION IN EITHER DRAW.
Both arms shipped a repair on all thirty-one rows.
The wide arm never split its vote into keeping the incumbent,
so the failure mode the one-sided ship
counts were added to catch did not occur.
It also means the indecision-fallback collision had no case to fire on in either draw,
so the contest fix changed neither draw's numbers.
It was still required:
that could not be known before running,
and nothing guarantees the next run
looks like these two.

### What follows, and what is NOT mine to settle

WHAT THE EVIDENCE SUPPORTS:
the roster stays at three editors.
Doubling it to six changed what ships
no more often than re-running the same three did,
and produced no quality difference this panel can
see.
Spending nothing is the measured answer,
not a concession to the deadline.

WHAT THIS COLLIDES WITH:
the owner ruled "All producing roles to 4" in
`doc/planning/translation-repair-open-decisions.md`,
and said so while explicitly noting the four was
not derived from evidence,
having tried and got it wrong twice in one day.
Two facts now bear on that ruling which were not available when it was made:

1.  Widening buys nothing measurable,
    between three and six,
    on both readings.
2.  Four is UNREACHABLE without relaxing `assertCheckerIndependence`,
    because the rosters partition a
    six-model roster exactly.
    Four writers leaves at most two checkers,
    and at two checkers one
    `fixed` against one `not-fixed` resolves nothing.

So implementing the ruling costs checker independence and buys no measured quality.
THE RECOMMENDATION IS TO STAY AT THREE AND LEAVE THE ASSERTION ALONE.
The ruling is the owner's to keep or revise;
this records the evidence,
not a reversal.

## Task 106, one of its two decision-independent items is already done

Checked 2026-08-23,
while looking for work that does not wait on question 28.

`#106` records:
"The probe writes its result with `console.log(JSON.stringify(...))` and nothing
persists it",
and concludes "Persisting probe output into the runs directory is worth doing whichever
option wins."

THAT IS NO LONGER TRUE.
`coverage-probe.ts:438` calls `persistProbeRun` into the resolved runs
directory,
keeping the rows,
the roster,
the corpus pin,
the pipeline digest and the runner closure,
and deliberately keeps standard output as well.
`persistProbeRun` landed in `probe-store.ts` on
2026-08-17,
one day after the note was written,
alongside a commit whose own subject records that
"the redirect this probe was built around never worked".

So the durability gap is closed and a later session acting on that line would rebuild what exists.
This is the same failure the width probe kept producing in reverse:
there,
comments claimed invariants the code did not have;
here,
a task claims a gap the code has since filled.
Both come from reading a recorded sentence as a fact rather than as a claim to check.

WHAT IS STILL TRUE:
the 2026-08-16 numbers themselves are gone.
No `coverage-probe` directory exists
under any runs directory on this machine,
so the probe has not been run since persistence landed,
and
those verdicts survive only in session transcripts as the task says.
Re-running is the only way to get
them back,
and a re-run now keeps them.

## Waiting on a background run: `pgrep -f` matches the agent's own shell

Cost two false "it finished" notifications on 2026-08-23,
once on width draw B and once on the
coverage probe,
and it will keep costing them until someone writes it down.
