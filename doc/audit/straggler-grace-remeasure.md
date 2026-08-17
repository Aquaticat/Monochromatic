# What widening the straggler grace actually did, measured 2026-08-17

The re-measure `doc/decision/translation-repair-straggler-grace.md` called for. Same two entries,
same roster, same corpus pin, one constant changed: `STRAGGLER_GRACE_MS` from 60000 to 180000.

## The headline

VOICE LOSS FELL BY ABOUT THREE AND A HALF TIMES, and it fell for the reason the fix predicted: the
window stopped cutting voices that were merely slow.

```text
                 now              before             change
Aniloviraw    1 of 18  0.056    5 of 22  0.227      -0.172
zheermao101   2 of 59  0.034    6 of 58  0.103      -0.070
both          3 of 77  0.039   11 of 80  0.138      -0.099
```

Counted as PER-STAGE VOICE COMPLETENESS, the definition the decision fixed in advance: a stage
counts once when it heard fewer voices than it seated. Loss lines and judgings are different
denominators and are not comparable to these.

## What the window still cuts

ONE ABANDONMENT SURVIVED, at 180000 ms, on `hf:zai-org/GLM-5.2`. So the tail the decision warned
about is real: the 88.6 second maximum behind the new window came from bench slices of 94 to 497
characters, and a slower call exists outside that sample.

Against 91 abandonments in the run this replaces, one is a different situation rather than a smaller
version of the same one.

The other two surviving losses were NOT abandonments. With the window no longer firing on them they
are some other fault, and naming it is work this run does not do.

## What it cost

```text
                 now ms      before ms    change
Aniloviraw      2273456      2121755      +7.1%
zheermao101     5039467      3917494     +28.6%
both            7312938      6039249     +21.1%
```

MORE THAN THE ESTIMATE THE DECISION CARRIED, which said under half a percent. That estimate was
wrong, and it is left standing in the decision with this correction beside it.

It was incomplete rather than backwards. The same entries did MORE WORK:

```text
                issues      accepted     resolved
zheermao101   50 vs 37     29 vs 22     26 vs 20
Aniloviraw    27 vs 28     12 vs 12     11 vs 11
```

`zheermao101` found a third more issues and resolved a third more of them. Panels that hear six
voices find more than panels that hear five, and finding more costs more. The extra time bought
extra work rather than extra waiting.

THE SPREAD IS THE WARNING: +7.1 percent on one entry and +28.6 on the other, from one run each. No
unchanged-build repeat exists, so the run-to-run band is unmeasured and a 21 percent aggregate
cannot be separated from ordinary provider variance. Arithmetic also attributes only minutes of
`zheermao101`'s 18.7 to the window itself, since only 6 of its 58 stages were being cut and each
would wait tens of seconds longer. The rest is the wider judging that surviving voices produce.

## The telemetry's first production emission

`slice-cost-log.ts` and `slice-cost-read.ts` ran in production for the first time. 40 rows, 0
refused, read back through the shipped `readSliceCosts` rather than a throwaway parser, so the pair
is verified across the artifact-consumer boundary rather than only in tests.

Every row carried `exit=computed`, which is correct for a cold run: nothing was cached, so no slice
could resume, and no slice was left unfilled or found untranslatable.

## What it says about cost against slice size, which is less than hoped

```text
ms = 102673 + 774.0 * sourceChars      n = 40,  R2 = 0.076
source chars: min 31, p50 77, max 189
elapsed ms:   p50 152107, p90 342819, max 600675
```

THE FIT EXPLAINS ALMOST NOTHING. An R-squared of 0.076 means slice size accounts for about seven
percent of the variance in what a slice cost, so neither the intercept nor the slope should be
quoted as a cost model, and the apparent 103 second fixed cost is an artifact of fitting a line
through a cloud.

What is safe to read: OVER THE RANGE THIS RUN SAMPLED, 31 to 189 source characters, a slice's cost
does not track its size. Something else dominates, and voice latency is the obvious candidate given
a p50 of 2.5 minutes against a p90 of 5.7.

WHAT THIS DOES NOT SETTLE is `#92`'s question, because the range is far too narrow. Corpus slices
run to 10959 characters, roughly 58 times the largest sampled here. A run over entries with large
slices is what would answer it, and until then the honest statement is that size does not explain
cost among small slices.

## What follows

-   THE WINDOW STAYS. It did what it was changed to do, and the residual is one call rather than a
    class of them.
-   THE COST NEEDS A BAND BEFORE IT NEEDS A DECISION. One unchanged-build repeat of one entry would
    say whether 21 percent is signal, and costs about half an hour.
-   `#92` NEEDS SLICES THAT DIFFER IN SIZE, not more slices that do not.
