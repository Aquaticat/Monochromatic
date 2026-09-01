# Translation repair history: segment 2.3

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

### The two-arm design does not measure the window, and this is the blocker

FOUND BY REVIEW BEFORE THE RUN,
which is the second defect this probe has shed
without costing a call.
The spec above says to call `settleTranslateSlice` twice
per slice and compare.
Traced through `translate-stage.ts`,
that does not compare
what it claims to.

WHAT THE SECOND CALL ACTUALLY REDOES.
`runTranslateStage` gathers translator
voices at line 188,
repairs invalid candidates at 208 and builds the slate at
222.
The judges only see it at 382,
and the window is rendered into their
evidence at 410.
So the translators run AGAIN on the second call,
and they are
never shown the window.
The two arms therefore differ in two things at once:
the
evidence the judges read,
and a freshly sampled set of candidates for them to
read it against.
Any difference in replacement rate is divisible between them,
and nothing in the record says which.

AND THE JUDGES ARE STOCHASTIC TOO,
so the null this probe could report is not
"the window changed nothing" but "the change was smaller than a spread nobody
measured".
A two-arm design cannot separate those either.

WHAT THE DESIGN HAS TO BECOME,
in order of what each buys:

1.  A THIRD ARM IS REQUIRED whatever else changes:
    narrow,
    run twice.
    Its two
    readings are the run-to-run band,
    and the narrow-to-wide difference means
    nothing until it is bigger than that band.
    This is the positive-control
    discipline the displacement work already used,
    applied to a comparison
    rather than a detector.
2.  HOLDING THE SLATE FIXED is worth a refactor.
    Produce the candidates once per
    slice,
    then judge that exact slate three times.
    It removes the translator
    variance entirely,
    which makes the narrow pair measure judge noise alone,
    and it is CHEAPER:
    80 slices times four production calls plus three judgings
    of six is about 1760 exchanges,
    against roughly 2300 for three unpaired
    arms.
    The cost is splitting `runTranslateStage` into produce and judge
    halves,
    and that file is already 527 lines,
    so the split has to land as
    sibling modules rather than as one longer file.

RECOMMENDED:
do both,
in that order,
and treat the third arm as
non-negotiable.
Option 2 without option 1 still reports an unbanded difference;
option 1 without option 2 works but costs more calls and yields a noisier band.

WHAT THE PROBE MUST RECORD PER SLICE,
widened for the same reason.
A binary
replaced-or-not hides two things the review named:
two different fresh
candidates both count as "replaced" though the judges chose differently,
and the
alignment guard can refuse a wide-arm replacement so a real change in the ballot
lands as `changed: false`.
Record the chosen TEXT and the winning candidate's
producer alongside the flag,
or the tally cannot tell a window that changed the
verdict from one that changed nothing.

FOUR OUTCOMES,
NOT ONE FLAG,
since `changed: false` currently means any of them:
the judges kept the incumbent;
no usable voice answered;
a candidate happened to
equal the incumbent;
or the alignment guard refused a replacement the stage had
selected.
Record which.
Folding a degraded stage into "kept" is the reading that
makes a longer,
slower wide prompt look like a window that works.

AND REFUSE A DEGRADED ARM RATHER THAN RECORDING IT.
Direct settlement skips the
document driver's protections,
so a slice where no translator was heard still
returns an unchanged record and looks like an ordinary keep.
Give each arm its
own fresh signal of equal duration,
never one shared entry deadline whose
remaining time penalises whichever arm runs second,
require the intended
participation,
and record heard model ids and retry counts per arm.
Randomise
which arm runs first,
deterministically,
and run the two adjacent.

COUNT SEPARATELY,
do not fold into the rate:
slices where the stage returns
before judging at all.
An empty candidate set and a sole-incumbent slate both
return early,
so both arms agree trivially and neither read the window.
Folded
into the denominator they dilute the effect toward zero.

BUDGET:
roughly 80 flagged slices.
Two unpaired arms was 1500 exchanges;
the
three-arm paired design is about 1760 for the flagged slices ALONE.
The matched
ordinary controls are not in that figure and have to be added to it:
however many
are drawn,
each costs a full three-arm trial.
Every call is real,
so run it
detached and let it notify.

A WIDE ARM WITH AN EMPTY WINDOW IS NOT A WIDE TRIAL.
A lone slice legitimately
yields `''`,
the stage then renders the narrow sheet,
and the trial would record
a narrow judging in the wide column.
The early-return bucket does not catch it,
because the stage does judge.
Give those their own bucket and keep them out of
the wide denominator.

READING IT:
these instructions live HERE,
in this section,
and nowhere else.
They are not on any GitHub issue:
the numbering incident recorded below means
GitHub `#108` is a dependency audit,
and task-tracker item 108 carries a pointer
back to this section rather than a copy.
Per class;
near-floor candidates
hand-checked rather than counted;
an untranslated slice beside a high one treated
as a possible whole-section move;
and the two transcription suspects reported
apart.

THE ONE CODE STEP BEFORE ANY OF IT,
which nothing else in this document records.
`corpus-run/translate-probe.ts` is hardcoded to `PROBE_ENTRY = 'XingZ60'` with a
fixed slice count and takes no arguments at all.
It has to accept an entry plus a
slice list,
so it can be pointed at the flag list,
and a switch for supplying the
neighbouring source.
That is small,
and it is the only code step left before the
run other than the design changes named above.

DOCUMENT SCALE IS STILL UNANSWERED,
and `#106` is where it belongs.
The slice
verdict exists and is cheap:
`classifyDisplacement` calls a slice `untranslated`
on source at least 150 characters against target at most 60,
deterministically
and with no model.
Four such slices in the pinned corpus,
all in `shi_Yumiaoya`,
at ratios near 0.01,
where the English side is a bare heading.
That is a FLOOR
rather than an estimate:
a section rendered as a heading plus a one-line stub
carries more than 60 target characters and is not counted.

What has no verdict is the DOCUMENT.
`shi_Yumiaoya` is 9795 Chinese characters
against 1630 English,
an aggregate of 0.31,
and `documentBaseline` already
reports which entries fall outside the believable band:
12 of 91 do.
Nothing
turns that reading into a stated verdict,
and no lane consumes any of it.
The
probe prints.

### Six comments were filed on the wrong tracker, and the numbering is why

RECORDED SO IT DOES NOT RECUR.
Everything in this document numbered `#60` to
`#108` is a LOCAL TASK TRACKER item.
Those numbers also exist as GitHub issues in
this repository,
and they are entirely different tickets:
`#84` is an oxlint
`ignorePatterns` workaround,
`#106` is CLI scaffolding,
`#107` and `#108` are
dependency audits.
Six comments about this work were posted onto those four
tickets overnight under the assumption that the numbers referred to GitHub.

The bodies were saved,
then each comment was rewritten in place to a short note
saying it was misfiled and where the work lives.
Rewritten rather than deleted
because deletion was refused,
which was the better outcome:
the correction is now
auditable rather than invisible.
Nothing was lost,
and the two findings those
comments carried that this document did not already hold,
the `PROBE_ENTRY`
step and the document-scale gap,
are recorded above.

ONLY `#431` AND `#432` ARE REAL GITHUB ISSUES for this work,
because they were
created here rather than referenced.
Anything else numbered in this document
belongs to the task tracker and must not be commented onto GitHub.
Before
posting to a GitHub issue from this work,
read its title back and confirm it
matches the subject.

### State the next session inherits, verified rather than assumed

MEASURED AT COMMIT `f44f82b60`,
not carried forward from earlier in the night:

-   `mise run //package/module/translation-repair:test:unit` exits 0.
    The whole
    unit suite,
    not a selection:
    1104 lines of output,
    zero `[error]` lines,
    zero assertion failures.
-   `mise run //package/module/translation-repair:lint` reports 0 warnings and
    0 errors.
-   Working tree is clean except four generated artifacts,
    described below.
-   `HEAD` equals `origin/translation-repair-rebased`;
    auto-push is doing its
    job and nothing is stranded locally.

FOUR FILES ARE DIRTY AND ARE NOT MINE.
Running `mise run file-enforcer` to
regenerate `CLAUDE.md` also rebuilt three plugin bundles and one jar:

    package/claude-code-plugin/bash-output-filter/bundle/node/index.mjs
    package/claude-code-plugin/guardrail/bundle/node/index.mjs
    package/claude-code-plugin/terminal-title/bundle/node/index.mjs
    package/intellij-plugin/islands-black/islands-black.jar

The change is real code rather than a timestamp:
a bundled shell lexer's
`if (lineEnd === -1 && ...)` became `if ((lineEnd === -1 || lineEnd > len) && ...)`,
a bounds fix that arrived with a dependency.
It is unrelated to this task,
so it
was left uncommitted rather than folded into a translation-repair commit or
reverted.
Someone should decide whether that dependency bump is wanted.

TWO `sol` REVIEWS ARE STILL ALIVE AND STILL EMPTY:
`bt8g6brhj` at 5 hours 18
minutes and `b64uex7px` at 3 hours 43 minutes,
each with 00:00:00 of CPU.
Their
siblings the same night finished in minutes.
Treat both as stalled,
do not kill
them without being asked,
and re-check any eventual output against current
source before acting:
both prompts predate tonight's changes.

### Self-preference measured, position bias refused

TWO OF `#84`'s REMAINING ITEMS WERE TAKEN,
2026-08-16,
and only one produced a
number.
Both matter to answers the owner has now given.

SELF-PREFERENCE IS REAL,
REPLICATED,
AND SMALLER THAN FIRST REPORTED.
Two draws
sharing no slices:
four slices gave an excess of 0.20,
fourteen gave 0.13,
and
pooled over all eighteen it is 0.147,
with producers naming their own candidate
148 of 403 times (0.367) against 382 of 1737 (0.220) among judges holding no
stake in the same texts.
That is a lift of 1.67.
THE 0.20 FIGURE IS SUPERSEDED;
it was four slices.
The disinterested rate is identical across both draws at
0.22,
and it is the own rate that fell,
from 0.42 to 0.35.
The half-weight discount
divides a self-vote by 2.
Those are different operations,
one scaling a weight
and the other describing a rate,
so this is not a derivation of the half;
it is
the first evidence that the half is the right ORDER,
where question 4 previously
had only consistency to stand on.

NO TREND WITH WIDTH IS CLAIMABLE,
and the bench is built to say so.
It repeats
one width on purpose;
width 4 came back 0.10 and then 0.23,
so the run-to-run
band is 0.13 and it swallows most of the spread between widths 2 and 6.
What six
runs agree on is the SIGN.

THE INSTRUMENT IS PAIRED,
which is the whole design.
Counting self-votes answers
nothing,
because a model writing the best candidates would cast many without any
favouritism.
Each candidate is scored against itself instead.
Candidates nobody
held a stake in are excluded from both sides,
so the two rates cover the same
texts;
removing that restriction fails the test that names it.

POSITION BIAS COULD NOT BE MEASURED,
and the reason is worth more than the
attempt.
The slate rotation is a pure function of the SLICE.
Across slices it
spreads properly:
the incumbent sat at positions 1,
2,
3,
4 and 5 over the four
slices.
But within one slice the offset never moves,
so `Xu_Yushu/2` put the
incumbent first in all six of its rounds,
and with four slices there are four
rotations in the whole dataset.
Position is therefore locked to candidate
identity.

The pooled distribution looks conclusive and is not.
On slates of three,
picks by
position ran `[2, 2, 31]` against a uniform 11.7;
on slates of six,
`[9, 2, 0, 6,
0, 0]` against 2.8.
That says the candidate that kept winning sat at that
position.
Reporting it as position bias would have repeated the endogenous
estimator this project has already been caught by twice.

WHAT A REAL ONE NEEDS:
many more distinct slices,
so the hash spreads rotations
independently of which candidate is best;
or one slate judged at several forced
rotations,
which wants `#109`'s produce/judge split for the same reason `#108`
does.

### Position bias refused a second time, for a better reason

THE FIRST REFUSAL WAS RIGHT AND THE REASON HAS BEEN SUPERSEDED.
With four
slices there were four rotations,
so slate position was locked to candidate
identity.
The wider draw supplies fourteen more slices sharing none of them,
which is eighteen rotations,
and that objection is gone.

THE BINDING CONSTRAINT NOW IS A FLOOR.
The incumbent shipped in 14 of 108
rounds,
and its pick rate by slate position is zero almost everywhere:
every
position at slates of five,
six and seven,
and two of four positions at slates
of four.
A position effect cannot be detected on a candidate that essentially
never wins,
however many rotations it is seen at.

THE ONE APPARENT SIGNAL IS ONE SLICE.
Slates of four with the incumbent second
showed 9 picks against zero at positions three and four,
which reads as a
first-half preference until the picks are split by slice:
8 of the 9 come from
`XingZ60/55` alone.
That is a slice whose archive English was good,
not a
position.

WHAT WOULD ACTUALLY MEASURE IT:
the fresh candidates rather than the incumbent,
since they win almost everything and so carry the signal;
or one slate judged at
several forced rotations,
which wants `#109`'s produce/judge split.
The
incumbent was the wrong probe because its identity is constant,
which is what
made it attractive,
and its win rate is near zero,
which is what makes it
useless here.

### The replacement rate is higher than question 5 says

Fell out of the same bench,
over 18 slices at six widths.
The archive's English
was replaced 0.83 of the time at widths two to four and 0.94 at widths five and
six,
against the 0.73 that question 5 was written around.
It survived at least
once on 10 of the 18 slices and never on the other 8.

Different draw,
so not directly comparable:
eighteen slices stratified by source
size with an incumbent on every one,
against that figure's ten.
Same direction,
larger,
more texts.

NO WIDTH TREND.
The repeated width returned 3 of 18 on both passes,
which looks
like a band of zero and is not one:
sampling error at 18 rounds is around 0.09,
so the 0.11 step at width five sits inside it.
