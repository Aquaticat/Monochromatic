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
    `data: {"id":"chatcmpl-`.

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
