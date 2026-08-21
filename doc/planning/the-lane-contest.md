# The lane contest

The stage that was missing.

## What was actually absent

`compareDocumentLanes` is deterministic and answers one question:
do the two lanes' texts differ.
Over the six entries read on 2026-08-20, four of sixteen slices agreed and
twelve differed.

`laneSelection` in the version 2 artifact has exactly one possible value,
`pending-human-decision`,
and that is deliberate:
a stated pending state rather than an absent field,
so "nobody has decided" and "this artifact predates the question" cannot be
confused.

The judge that declined 82% of lane contests was a scratch instrument written to
measure whether a contest was viable.
It was never a pipeline stage.

So the pipeline produced both lanes, compared them, and stopped.
Nothing chose.
That, rather than any decision, is what stood between the pipeline and a
document that can ship.

## Why the question had to change

`doc/audit/eight-entries-read-against-the-original.md` found the two lanes
failing in opposite directions:

-   The repair lane INHERITS. It edits the archive, so an invention no critic
    flagged ships untouched.

-   The translate lane DISCARDS. It owes the archive nothing, so accurate detail
    the archive knew and the source does not carry is lost, and where content
    lives only in pictures it has nothing to translate at all.

A judge asked "which of these is better?" has to weigh an inherited invention
against a discarded detail with nothing to weigh them with.
An 82% decline rate is what that looks like from outside.

So the contest asks for the two findings that decide it, per candidate,
and takes the choice as their consequence:

-   UNSUPPORTED: does this candidate state something the original does not?

-   DROPPED: does this candidate omit something the original does say?

Preference between two faithful renderings is explicitly NOT asked for.

## What the prompt commits to

THE ORIGINAL IS THE STANDARD, per `doc/decision/translation-repair-output-goal.md`.
The archive rendering is shown as evidence about what the original says and as
wording worth keeping where it is right, never as the thing a candidate is
scored against.

ACCURATE ADDED DETAIL IS NOT UNSUPPORTED.
The same decision record says detail a translator added is kept rather than
stripped, and the reading found the translate lane stripping exactly that.
The prompt says so directly, because a judge told only to check for unsupported
statements would call every such detail one.

DECLINING IS A VERDICT.
Two candidates that differ only in wording have no better one.
A judge forced to choose would be inventing a preference the evidence does not
carry, and the stage records that separately from a judge that never answered:
those need opposite handling and would otherwise be indistinguishable.

## What the stage commits to

NO SINGLE MODEL DECIDES, as everywhere else in this package.
Two voices must back a candidate, and it must outpoll the other.

A TIE SHIPS NOTHING.
Deciding what a reader sees on a memorial page by which lane the code names
first is not a decision.

A DECLINE IS NOT A FINDING; too few ballots is.
Three judges calling two candidates equally faithful is a settled slice.
Three judges never answering is not, and only the second is reported.

## How it is measured

Thirteen slices from the eight read entries are a ground truth for the first
time: each carries which lane the reading judged better, and why.

The control arm asks the general-preference question over the same roster,
schema, guard, reader and counting rule.
Only the question differs, which is the thing under test.

THE CAVEAT IS REAL AND STATED.
The ground truth is one agent's reading.
Earlier milestones calibrated agent grading against the owner's corrections
precisely because agent calls drift, and several of the thirteen are close.
Agreement with that reading is a signal, not correctness, and the owner
reversing individual calls would move the score.

## What calibration found before it finished scoring

THE GUARD WAS STRICTER THAN ITS OWN CONTRACT, and it cost voices.

`isLaneContestWire` documented itself as checking shape only, and then demanded
that every member of `unsupported` and `dropped` name a candidate.
Judges do not always answer that way.
Two of the first sixty calibration voices filled the findings with the offending
phrases instead, or annotated a candidate name with what was wrong:

-   `unsupported: ["at peace", "this one's for you", "even angry"]`,
    alongside `choice: "repair"`.

-   `unsupported: ["repair (changes ... and alters the dream request ...)"]`,
    alongside `choice: "neither"`.

Both replies carried a usable choice, and both were discarded whole.
One slice settled on four ballots rather than six because of it.

THE CHOICE IS THE THING THE CONTEST COUNTS, so no wording of a finding may cost
a voice.
The guard now checks shape.
The reader narrows the findings to the candidates they blame, reading an
annotated name as naming that candidate and a longer word that merely begins
with one, `repairing`, as naming nobody.
The ballot keeps the findings verbatim beside the narrowed list, so a judge
answering in phrases leaves an audit trail rather than reading as a judge that
found nothing.

WHY THE ROUNDS ALREADY SETTLED WERE KEPT.
The change only ever turns a lost voice into a kept one, never the reverse,
which was checked case by case against the old predicate.
A round that settled on a full roster therefore settles identically under the
fix, and only the one short round was re-run.

## What is still owed after this

Wiring the contest into the pass, which changes what an artifact records and so
needs `laneSelection` to gain the kinds it currently lacks.
That touches the version 2 readers, which refuse unknown keys by design, so the
writer and the reader move together.

And the question that is genuinely the owner's, which the mechanism does not
answer: what a slice the contest declines should ship.
That is a values question about the release rather than a measurable one, and it
is answerable once the mechanism exists rather than before.
