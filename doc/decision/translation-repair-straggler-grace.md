# The straggler grace moves from 60 to 180 seconds, on the latency distribution

Taken 2026-08-17 on the best-quality guideline, against measurement rather than preference.

THIS OVERRIDES A NUMBER THE OWNER CHOSE. Sixty seconds was their figure on 2026-08-14, picked
between a grace window and cutting at quorum outright. It is flagged here for a cheap veto. What
changed is not the judgement behind it but the evidence: the constant's own comment recorded that it
was "not derived from the latency distribution, and it should be revisited against one", and that
revisit is what this document is.

## The question the queue asked

`#105` and the handover both framed it as a choice: widen the deadline for `hf:zai-org/GLM-5.2`, or
seat a replacement. The measurement answers it, and it answers against replacement.

## What the loss actually is

Over the two-lane cost run of 2026-08-16, under the production roster, 96 voices were lost:

-   91 were `abandoned 60000ms after quorum`, which is this window firing.
-   6 were `schema-mismatch`, a different fault entirely.
-   By model: `hf:zai-org/GLM-5.2` 68, `hf:zai-org/GLM-4.7-Flash` 27, `hf:moonshotai/Kimi-K3` 1.

So the loss is almost entirely this window, and almost entirely the two GLM models.

## Why replacement is the wrong answer

THE MODELS ARE NOT DEFECTIVE. Whole-call latency over the 602 bench exchanges in
`doc/audit/translation-repair-lane-budget.md`:

```text
hf:openai/gpt-oss-120b                  p50  4.4 s   p95  8.3 s   max 10.6 s
hf:moonshotai/Kimi-K3                   p50  9.5 s   p95 30.0 s   max 46.5 s
hf:nvidia/NVIDIA-Nemotron-3-Super       p50 12.9 s   p95 41.1 s
hf:Qwen/Qwen3.6-27B                     p50 23.7 s   p95 38.3 s   max 48.0 s
hf:zai-org/GLM-5.2                      p50 24.0 s   p95 74.0 s   max 85.5 s
hf:zai-org/GLM-4.7-Flash                p50 30.5 s   p95 72.9 s   max 88.6 s
```

Sixty seconds sits between the GLM medians and their 95th percentiles. That is the whole
explanation: the window cuts those two models and no others because it was set inside their ordinary
operating range. Their worst observed call still finished in 88.6 seconds.

In the same run, `hf:zai-org/GLM-5.2` was heard in full: 220 stages reported `6/6 heard`, against 61
at `5/6` and 2 at `4/6`. A model that answers in three quarters of the stages it is seated in is
slow, not broken, and removing it would discard a working voice to work around a mis-set constant.

## Why the window has never done its job

Across those 602 exchanges the only non-ok outcomes were the 8 straggler cuts, all on the two GLM
models. No truncation, no schema-invalid reply, no timeout of any other kind.

NOT ONE HUNG CALL WAS RECORDED. The window exists to stop a model that answers nothing from delaying
the pipeline, and in 602 exchanges it has never once met that model. Every voice it has taken was a
slow-but-working one.

## Why three minutes, and not the observed maximum

Setting it at 90 seconds would clear the 88.6 second maximum and would repeat a mistake this
codebase has already made and written down. `STREAM_IDLE_MS` in `stream-idle-guard.ts` carries the
record: a 30 second window was once justified by a six-stream sample whose largest gap was 733 ms,
called forty times the worst observation, and a larger sample then read max 24673 ms, so the real
margin was about 1.2x rather than 40x. A maximum over a few hundred samples is not a bound.

180000 ms sits above the 88.6 second maximum by more than a factor of two, and stays well under
`RUN_PER_CALL_TIMEOUT_MS` of 360000, so the window still cuts a genuinely hung voice long before its
own deadline would. The user's rule of 2026-08-14, that one model's failure must not delay the
pipeline for the day, is preserved: a voice that never comes is now abandoned at roughly 193 seconds
from dispatch rather than 73, against a deadline of 360.

AND THAT MAXIMUM IS NOT A CORPUS BOUND EITHER, which this document would be repeating its own lesson
to ignore. The bench's ten slices spanned 94 to 497 incumbent characters, which the same audit says
samples the corpus only to about its 90th percentile: slice size runs p99 1512 characters and
`shihai4h` carries 10959 in a single slice. A model's call grows with what it is asked to read, so
on the largest slices these two may still exceed 180 seconds and still be cut.

That does not change the decision, because the fallback is exactly today's behaviour, a lost voice
on a large slice. It does mean the re-measure should read losses BY SLICE SIZE rather than as one
rate, since a residual concentrated in the tail is a different finding from one spread evenly.

## What it costs

MORE THAN THE ESTIMATE BELOW, and the estimate is left standing because the re-measure contradicted
it and that is worth showing rather than hiding.

The estimate was: the window is only paid when a voice is late, a voice that answers before it costs
nothing, and a voice that would have been cut costs the difference between its arrival and the old
60 second cut. Over the cost run, 63 of 283 six-voice stages lost a voice; at roughly 20 seconds
more each that is about 21 minutes across a seven and a half hour run, under half a percent.

WHAT THE RE-MEASURE ACTUALLY REPORTED for `zheermao101`, the first entry through: 5039467 ms against
3917494 ms under the old window, 29 percent longer. That is far more than the estimate.

The estimate is not simply wrong about the window; it is incomplete about what recovering voices
does. The same run also reports 50 issues against 37, 29 accepted against 22, and 26 resolved
against 20. Panels that hear six voices find more than panels that hear five, and finding more costs
more. The extra time is buying extra work, not waiting.

TWO THINGS THIS DOES NOT ESTABLISH, both of which need saying:

-   THE RUN-TO-RUN BAND WAS NEVER MEASURED. One run against one earlier run cannot separate a 29
    percent change from ordinary provider variance, and no unchanged-build repeat exists to say how
    wide that band is. The number is what happened, not what the window costs.
-   HOW MUCH OF IT IS THE WINDOW. Arithmetic says little of it: 6 of 58 stages lost a voice under
    the old window, each would now wait at most tens of seconds longer, which is minutes rather than
    the 18.7 observed. The rest is the wider judging that more surviving voices produce.

The honest summary is that the window costs more than a rounding error and buys more than voices.
Whether the trade is worth it is a quality question the corrected numbers can now be argued from.

## What was rejected, and why it is worth recording

CUTTING ON SILENCE RATHER THAN ELAPSED TIME, which is the obvious better instrument and does not
work on this provider. `stream-idle-guard.ts` records the measurement: of the stalls a full sentinel
probe recorded, 34 of 34 were `first-byte` and not one was `body`, and across 32 successful streams
time to first byte ran p50 95.6 s, p75 123 s, p90 134 s. Long first-byte silence IS normal operation
here, so a silence window cannot separate stalled from working. Both idle constants are set to
600000 so they never fire, and the total deadline does the killing instead.

That is the same shape of answer as this one: when a guard cannot discriminate, do not tighten it,
move the killing to the deadline that can.

## The baseline to compare against, on one definition

THREE DIFFERENT RATES ARE IN CIRCULATION and none of them measure the same thing. The trial's 0.413
counts judgings; the cost run's loss LINES number 96 and count retries, so one voice lost twice
counts twice; and stage completeness is a third number again. A re-measure against the wrong one
would report a change that is only a change of denominator.

The definition this fix is measured on is PER-STAGE VOICE COMPLETENESS: a stage counts as losing
when it heard fewer voices than it seated, whatever the roster size, counted once per stage. Under
that definition, recomputed from the same cost-run log the fix was diagnosed from:

```text
Aniloviraw     5 of  22 stages   0.227
zheermao101    6 of  58 stages   0.103
aiyysk        30 of 208 stages   0.144
XingZ60       22 of 195 stages   0.113
whole run     63 of 483 stages   0.130
```

That 0.130 is the number the new window has to beat, and it is not comparable to the 0.413 quoted
elsewhere.

## What must follow

RE-MEASURE THE DECLINE RATE, which is the recorded next step and the reason this was first in the
queue. Every measurement taken through a panel that lost voices was taken through this defect, so
nothing resting on one should be trusted until the rate is read again.

TWO CONSTRAINTS ON THAT RUN, both learned from getting them wrong elsewhere:

-   COMPARE ON THE DEFINITION ABOVE, not on loss lines and not on judgings.
-   RUN ENTRIES THAT ACTUALLY LOST VOICES, or a clean result proves nothing. The settled pair
    qualifies: `Aniloviraw` lost on 5 of its 22 stages and `zheermao101` on 6 of 58, so 11 of 80
    stages is the positive control, and a run of those two that still loses at that rate says the
    fix did not work rather than that there was nothing to fix.
-   READ THE RESIDUAL BY SLICE SIZE, per the caveat about the bench's slice range.

The per-slice cost telemetry now carries an `exit` key, so the same run reports what the wider
window costs directly rather than by the estimate above. That run is also the telemetry's first
emission in production, so it doubles as the user-boundary check that `SLICE-COST` lines appear and
parse.

## A second reading, on a fresh population, 2026-08-17 evening

THE RE-MEASURE THIS DOCUMENT ASKED FOR WAS ALREADY DELIVERED, the same morning, in
`doc/audit/straggler-grace-remeasure.md`.
It ran the named control,
`Aniloviraw` and `zheermao101`,
on the definition fixed here,
and recorded 3 of 77 stages against 11 of 80, or 0.039 against 0.138.
Nothing below displaces it.

What follows is a second reading taken from a different population:
the evening corpus pass,
five entries none of which appear in that audit or in the baseline table above.
It was read from a frozen snapshot,
`~/temp/agent/grace-remeasure-snapshot.log`,
3271 lines,
taken at 19:34 with four entries settled and the fifth mid-flight.
Frozen first because the live log grows between commands,
and two readings of it disagreed by six stages.

```text
critic    seats 6     4 of  37 stages   0.108
panel     seats 6     6 of  32 stages   0.188
checker   seats 3     0 of  40 stages   0.000
probe     seats 3     0 of  41 stages   0.000
pooled  (critic, panel, checker)  10 of 109   0.092
```

It agrees with the morning audit on shape:
the three-seat stages lose nothing,
the six-seat stages carry every loss,
and the pooled figure sits below the 0.130 recorded here.
Agreement on a population neither reading shares is worth more than either alone.

### What is new, and what it changes

THE DEFINITION CANNOT SEE THE TRANSLATE LANE, which neither this document nor the morning
audit accounts for,
because both predate it.
`translate-document.ts:391` logs selection only when ZERO translators were heard,
so a stage that seats six and hears five leaves no `heard` line to count.
Of the 30 voices lost in this snapshot,
17 were lost in `select` and one in `refiner`,
neither of which the definition can see.
The instrument counts 10 of 30 actual losses.

This does not invalidate either reading,
since both sides of each comparison are measured the same way.
It does mean the figures understate loss in a two-lane pipeline,
and that any future comparison should extend the definition first.
That work is `#119`.

EVERY ABANDONED VOICE IN THIS SNAPSHOT IS A GLM, at a much larger scale than the single
surviving abandonment the morning audit found.
Of 30 `voice lost` lines,
29 attribute to a stage and a model,
and all 29 name `hf:zai-org/GLM-5.2` or `hf:zai-org/GLM-4.7-Flash`.
Zero name `hf:moonshotai/Kimi-K3`,
which appears more often in this log than any other model.
That is a zero-numerator fact rather than a rate,
since appearance counts are log mentions and not calls.
It supersedes `#77`'s finding that Kimi-K3 dominates voice loss,
which was measured before `#64`'s channel-marker fix landed.

ABANDONMENT IS THE ONLY LOSS MODE HERE, so nothing else is quietly eating voices.
Losses reconcile against abandon lines stage by stage:
critic lost 4 stages against 4 abandons,
checker lost 0 against 0,
panel lost 6 stages against 7 abandons,
the extra being one stage that lost two voices at once.

### The residual is not shown to be a latency finding

The morning audit read the one surviving abandonment as the tail this document warned about,
and priced it against bench slices of 94 to 497 characters.
That reading stands,
but it cannot be pushed further than the evidence goes.

An abandoned call is killed at quorum plus 180 seconds,
so its true duration is censored:
unknown, and strictly greater.
The bench maxima of 85.5 s and 88.6 s were measured over calls that COMPLETED.
Whether a GLM call still running at 180 seconds is merely slow,
or has stopped producing anything new and would never have finished,
cannot be told apart from anything currently recorded,
because `#118` discards the partial text and no raw output is stored anywhere.

The user reports that this provider does not terminate token degeneration.
If that is what some of these calls are doing,
no widening of this window would ever have helped them,
and the remedy is to end them ourselves.
That is `doc/decision/translation-repair-runaway-call-termination.md` and `#119`.
