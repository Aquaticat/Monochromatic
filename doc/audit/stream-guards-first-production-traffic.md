# First production traffic through the stream guards

Read 2026-08-18 from `~/temp/agent/flagged-pass-2.log`,
covering the first 48 minutes of the targeted corpus pass started 01:29Z,
which is the first traffic of any kind through the `#118` cut reporting
and the `#119` degeneration guard.

Everything below is read from a pass still running,
so every count is a floor rather than a total.

## What the window held

```text
streams                347
total raw characters   219574656
smallest stream             4662
median                    357921
ninetieth percentile     1689688
largest                  5558524
```

RAW CHARACTERS ARE WIRE BYTES, envelope included,
which is the only length column production records.
Nothing here reports generated characters,
and that gap decides how the rest of this document reads.

## Both new instruments worked

A voice was lost and,
for the first time,
the log says WHY:

```text
panel hf:zai-org/GLM-5.2: abandoned 180000ms after quorum
  (cut-mid-reply after 2915229 delivered chars, first byte at 2087ms), voice lost
```

Before `#118` that line read only `voice lost`,
and the 2.9 million characters the call had already delivered were discarded.
The companion progress line records `maxGap 460ms`,
so this call was streaming steadily when it was ended.
It was not stalled,
and the idle guard could never have seen it:
both idle constants sit at 600000 ms and the largest gap was under half a second.

WHAT ENDED IT WAS THE STRAGGLER GRACE, exactly as designed,
180000 ms after quorum.
That is the first direct look at what the grace actually cuts,
and it cut a call that was still producing.

## Neither guard has refused a call

No `degenerate in` line appears anywhere in the window.
The single `cut` line is the straggler above.

THE OBVIOUS SEARCH LIES, and it is worth writing down.
Grepping this log for `cut` returns ten confident matches,
every one of them the word "cute" inside a rationale about 撒娇.
The searches that answer the question are `stream .*: cut` and `degenerate in`.

## The case the guards were built for happened, and nothing can diagnose it

```text
stream hf:zai-org/GLM-4.7-Flash: completed, firstByte 920ms, maxGap 91ms,
  2052766 raw chars, 0 unreadable frames, 2052766 delivered chars
select hf:zai-org/GLM-4.7-Flash: schema-mismatch
  (content is not valid JSON: SyntaxError: Unexpected end of JSON input) raw="", voice lost
```

The model streamed two million characters of wire and delivered NO ANSWER AT ALL.
The stream completed on its own,
so this is not a runaway in the sense of a call that never ends,
and the guard was right not to refuse it.
Whether the model spent that budget thinking usefully or cycling
is exactly the question the reasoning-channel detector exists to answer,
and the log cannot say,
because:

-   the progress line reports raw characters twice and generated characters never,
    so the size of the thinking trace is unknown;
-   the opening excerpt is shown only on a cut, and this stream completed;
-   and had it been shown it would have carried envelope rather than words,
    since `partialText` is the raw event stream and every such body opens
    `data: {"id":"`,
    with a bare hexadecimal id in production
    and `chatcmpl-tabby` in the fixture that demonstrated it.

All three are recorded in `doc/decision/translation-repair-runaway-call-termination.md`.

## Why the unmeasured envelope ratio decides how much the guard sees

A verdict needs about 131000 characters of GENERATED text.
The pass records only raw characters.
The two are related by a ratio that has never been measured,
and the choice of ratio moves the answer by a factor of six:

```text
if the envelope costs 10x   45 of 347 streams reach the bar, about 13 percent
if the envelope cost  1x   282 of 347 streams reach the bar, about 81 percent
```

So the open question is not academic bookkeeping.
It decides whether this guard judges one stream in eight or four in five,
and today nobody knows which.

## The idle windows rest on a premise the current traffic contradicts

`stream-idle-guard.ts` sets both windows to 600000 ms so they never fire,
and the reason it gives is that silence cannot discriminate on this provider:

> Across 32 successful streams,
> time to first byte ran p50 95.6 s, p75 123 s, p90 134 s, max 147.5 s.
> A window cannot separate "stalled and silent" from "working and silent"
> when working looks like that.

MEASURED OVER THIS PASS, working no longer looks like that:

```text
                p50     p75     p90     p99      max
firstByte ms    1174    1349    1726    3091     9084
maxGap ms        207     257     463     989    11659
```

395 streams,
which is every stream that reached the drain in the window,
cut and completed alike.
Time to first byte is about eighty times faster at the median
than the figure the constant rests on.
Every one of the 395 received a first byte:
zero progress lines carry the negative `firstByteMs` that marks a call which never got one.

THIS DISTRIBUTION IS UNCENSORED, which the old one was not.
The old sample was taken with a 150 s window live,
so anything slower was aborted instead of recorded,
and the guard's own comment says so.
Here both windows sit at 600000 ms and neither fired,
so these maxima are maxima rather than the shadow of a guard.

IT IS ALSO THE UNBIASED SUCCESSOR TO A RETRACTED FIGURE.
A reading of "1349 streams, mean firstByte 1822 ms" was retracted for survivorship bias,
because abandoned calls were excluded by construction.
Since `#118`, progress is reported on the cut path too,
so an abandoned call is in this sample rather than missing from it.

WHAT IT DOES NOT SAY.
It does not say the constants are wrong,
and it does not explain the gap between the two readings:
different stage shapes, provider capacity, routing and time of day are all unexcluded,
and one pass over five entries is one workload.
What it does say is that the stated reason for disabling the guard
is not what the current traffic looks like,
and that a first-byte window is worth re-deriving rather than assumed useless.

## Three workloads agree on the middle and disagree with any small window

The single-pass reading above is not enough to set a constant,
so the same two columns were read from every pass log that carries them.
`grace-remeasure-snapshot.log` is excluded as a copy of `corpus-pass-20260817.log`:
same opening line, same maxima, not an independent workload.

```text
log                        streams   p50    p75    p90     p99      max
resume-run-output             2888  1032   1191   1477    3955   183755
corpus-pass-20260817          2166  1237   1451   1951   10163    91843
flagged-pass-2 (this one)      416  1173   1352   1726    2768     9084
```

THE MIDDLE IS STABLE ACROSS FIVE DAYS AND THREE WORKLOADS,
at one to one and a third seconds,
and none of them resembles the 95.6 second median the constant was set from.

THE TAIL IS REAL, and it is the half a single pass could not have shown.
One call waited 183 seconds for its first byte and another 92.
Counted over the 5470 streams in the three logs:

```text
first byte over    30 s   10 streams   about 1 in 550
                   60 s    2 streams
                  120 s    1 stream
                  180 s    1 stream
                  300 s    0 streams

largest gap over   30 s    4 streams
                   60 s    1 stream
                  120 s    0 streams
```

SO A SHORT WINDOW IS NOT FREE, which is the correction this second reading makes to the first.
A 30 second first-byte window would have fired on about one call in 550,
and at six voices a stage that is roughly one stage in ninety losing a voice to the guard itself.
A 300 second window would have fired on none of the 5470
and would still end a dead call in five minutes rather than never.

THESE COUNTS ARE LOWER BOUNDS.
Two of the three logs predate `#118`,
so they record only streams that completed,
and a call abandoned before completing is exactly the one most likely to have waited longest
for a first byte.
The true exceedance is at or above every figure above,
which argues against the small windows rather than for them.

IT ALSO RE-FRAMES WHAT THE STRAGGLER GRACE CUTS.
If a call reaches its first byte in about a second,
then one still running 180 s after quorum is not waiting to start;
it is producing.
The single abandonment in this window proves it directly:
2915229 characters delivered, largest gap 460 ms.
`doc/audit/straggler-grace-remeasure.md` measured what widening the grace did to voice loss
and did not measure this,
so the two readings sit beside each other rather than in conflict.

## What this changes

-   `#120` gains production evidence rather than fixture evidence.
    The generated-character count is not a tidiness item;
    it is the difference between a guard that is known to be watching
    and one that is assumed to be.
-   The straggler grace now has one observed case with a full description,
    which `doc/decision/translation-repair-straggler-grace.md` never had.
    One case decides nothing;
    it is the first of a population that can now be counted at all.
-   Voice loss in this window is two calls,
    one cut after quorum and one that answered with an empty string,
    and they want opposite remedies.
