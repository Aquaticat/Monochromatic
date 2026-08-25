# Every volume guard is blind to one model, and the straggler window is all that stops it

Measured 2026-08-25 against the live full-roster editor calibration
(`editor-calibrate.mjs 40`, 15 of 40 slices, 3 hours 44 minutes elapsed, zero `[error]` lines).
Read from the run log alone.
No corpus wording appears here: model ids, counts and durations only.

## What was measured

Every model was asked exactly 120 times, so the denominators need no adjustment.
Streams that completed, plus voices abandoned, per model:

-   `minimax-m3`: 120 completed, 0 abandoned.
-   `hf:openai/gpt-oss-120b`: 120 completed, 0 abandoned.
-   `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`: 120 completed, 0 abandoned.
-   `hf:moonshotai/Kimi-K3`: 120 completed, 0 abandoned.
-   `deepseek-v4-pro-0813`: 120 completed, 0 abandoned.
-   `deepseek-v4-flash-0731`: 120 completed, 0 abandoned.
-   `gemma-4-26b-a4b-it`: 120 completed, 0 abandoned, 4 schema mismatches.
-   `hf:Qwen/Qwen3.8-27B`: 118 completed, 2 abandoned, 1.7 percent.
-   `hf:zai-org/GLM-5.2`: 109 completed, 11 abandoned, 9.2 percent.
-   `qwen3.8-max`: 98 completed, 21 abandoned, 17.6 percent.

Seven of ten seats lose no voice at all.
The loss is 34 voices, and 21 of them are one model.

## The finding

`qwen3.8-max` reports content characters of 0 at the median AND at the 95th percentile,
across all 100 of its completed streams in this run.
Not one byte it has sent in this run was accounted to the content channel.
Its 34,202 character maximum is entirely reasoning.

Every other seat reports content between 303 and 619 characters at the median.

This is `#211` at production scale.
`#211` was proved on a single captured frame sequence: the provider emits two `content_block_start`
frames for the same block index, the second declaring `thinking`, so the `input_json_delta` frames
carrying the tool-call arguments are routed to `reasoning` by `channelFor` in
`src/anthropic-delta-scan.ts`.
`qwen3.8-max` is the one seat on `toolChoice: 'auto'`, so its whole answer arrives as
`input_json_delta`, so its whole answer is filed as reasoning.

## Why that is worse than a telemetry error

`src/stream-runaway-watch.ts` applies its volume cap to the content channel only:

```ts
// src/stream-runaway-watch.ts
const contentChars = ratioDetectors.content
  .charsSeen();
if (contentChars >= contentCap)
  return {
    kind: 'overrun',
    channel: 'content',
    charsSeen: contentChars,
    cap: contentCap,
  };
```

The module note beside it states the intent plainly, that the reasoning channel is untouched.
`#156` measured the answer bound at 32000 and declined a reasoning bound deliberately.
`maxAnswerChars` reaches this cap as `contentCap` through `drainBody` in `src/stream-drain.ts`,
and `producedVolumeBound` scales it per call for the translate lane.

So for `qwen3.8-max` the chain is:
its answer is filed as reasoning,
the volume cap reads content,
content remains zero,
and no volume guard can ever fire on it.
The ratio and recurrence detectors still watch reasoning,
but they did not fire on any of the 21 cuts.

The only thing that stops this model is `STRAGGLER_GRACE_MS`.
That is what the 21 cuts are.

## What the cuts look like

The abandoned voices were cut mid-reply having delivered, per model:

-   `qwen3.8-max`: 106,405 characters once, then 19 of 21 clustered between 293,163 and 350,293.
-   `hf:zai-org/GLM-5.2`: 248,535 to 3,020,068.
-   `hf:Qwen/Qwen3.8-27B`: 656,600 and 1,276,871.

The `qwen3.8-max` cluster is tight because the cut is time-bound rather than volume-bound:
at a steady stream rate, 180 seconds buys a roughly constant number of characters.

## The decision this refutes

`doc/decision/translation-repair-straggler-grace.md`, taken 2026-08-17, moved the window from 60 to
180 seconds. Its central claim:

> NOT ONE HUNG CALL WAS RECORDED. The window exists to stop a model that answers nothing from
> delaying the pipeline, and in 602 exchanges it has never once met that model. Every voice it has
> taken was a slow-but-working one.

That premise does not survive this run.
A voice cut mid-reply after 3,020,068 characters is not slow-but-working.
The decision also records a latency table whose worst observation was 88.6 seconds, and set 180 as
"more than a factor of two" above it.
Against a model emitting millions of characters, the multiple of a healthy maximum is not the
quantity that matters.

The decision should not simply be reverted.
It was right that `hf:zai-org/GLM-5.2` was being cut inside its ordinary operating range at 60
seconds, and that is still true.
What has changed is that the population now contains a second kind of call the window was never
sized against, and one window cannot serve both.

## What this costs

The 34 cut voices fall into 29 distinct straggler events,
grouping voices cut within 5 seconds of each other as one round.
At 180 seconds each that is 1.45 hours of waiting, inside a run that has so far taken 3.73 hours.

That figure is an upper bound and should be read as one.
It holds only where the round's completion actually waits on the straggler.
`runStageRound` in `src/stage-round.ts` assembles its result from the `arrived` map rather than by
awaiting abandoned calls, precisely so a client that ignored an abort could not hang the stage,
so the true cost per event is at most the grace window and may be less.
Confirming it needs the dispatch timestamps the run does not currently record.

## The logging gap this exposes

The question "how concurrent was this run, and where did its wall-clock go" cannot be answered from
the run's own logs.

-   The client logs dispatch at `debug` (`-> modelId: N messages` in `src/synthetic-client.ts`).
-   This run emits only `info` and `warn`, 3,642 and 41 lines.
-   `reportStreamProgress` logs completion at `info` but carries no duration:
    its fields are `firstByte`, `maxGap`, raw characters, unreadable frames, content and reasoning
    characters.

So a stream's start time is not recoverable, and neither is its duration.
Adding a duration field to the existing completion line is the cheaper of the two fixes:
it adds no line volume, and start time follows by subtraction.

### Closed by `#215`, with the measurement still owed

Both halves landed on 2026-08-25.

`reportStreamProgress` now prints `elapsed <n>ms` beside the outcome,
so a completion line plus its own timestamp gives every call an interval.

A SECOND GAP WAS FOUND WHILE FIXING THIS ONE, and it is the larger of the two.
The log has no round boundary either.
Surveying every line shape in the live calibration finds three tags and no others:
`reportStreamProgress`, `takeReading` (the availability meter) and `exchangeWithRetry`.
Nothing delimits a fan-out, so even with per-call durations
the waiting could not be attributed to the rounds that did it.
`runGatherRound` now writes one line per round:

```text
editor round: 6/7 heard, 91402ms total, 61401ms to quorum, 30001ms in grace
```

`ms in grace` is this section's figure, measured rather than bounded.

THE 1.45 HOUR FIGURE ABOVE REMAINS AN UPPER BOUND until a run emits these lines.
The calibration running when they landed was launched from the older build,
so the first real reading comes from the next pass.
`mise run //package/module/translation-repair:run-timing-report -- <log>` reads them back,
and on a log written before this it says so rather than reporting zeros.

What could be measured on the OLD log, as a floor rather than the figure:
each completion carries `firstByte` and `maxGap`, and the largest gap falls strictly
after the first byte, so their sum bounds a call's duration from below.
Sweeping those subset intervals over 2405 calls across 6.15 hours gives
a mean of at least 0.39 in flight and a peak of at least 9.
That is a floor and says nothing about the true figure.

## What follows

-   `#211`'s fix routes `input_json_delta` to content, which is what lets any volume guard see this
    model at all. That is its real value, larger than the telemetry correction it was opened as.
-   `#211`'s recorded expectation, that the cut rate falls, is not supported.
    The likelier outcome is that the cut rate holds near 17 percent while each cut costs a fraction
    of the time and bytes, because `contentCap` fires long before 180 seconds.
    Record the outcome either way rather than the prediction.
-   The straggler window needs re-deriving against a population that now contains runaways.
-   Whether the reasoning channel should carry a volume cap of its own is a separate question.
    52 of 1,182 completed streams exceeded 32000 reasoning characters and completed fine,
    `hf:Qwen/Qwen3.8-27B` reaching 99,244, so a naive cap would cut working voices.

## The deepseek anomaly is the same defect, intermittently (resolved 2026-08-25)

`#211` recorded a second, smaller anomaly on `deepseek-v4-pro-0813` and held it open,
because the instrument used then was a 40-line scan window over 9 samples,
and a positive control on `hf:openai/gpt-oss-120b` showed that instrument had a 39 percent hit rate
on healthy calls.
Nine samples against a 39 percent baseline separate nothing, and the honest conclusion was that the
log could not answer it.

The same run answers it now, because the right instrument is the completion line's own content
count and this run carries roughly 1,200 of them.
Zero-content streams per seat, at 15 of 40 slices:

-   `qwen3.8-max`: 104 of 106, 98.1 percent.
-   `deepseek-v4-pro-0813`: 12 of 127, 9.4 percent.
-   `gemma-4-26b-a4b-it`: 0 of 127.
-   `deepseek-v4-flash-0731`: 0 of 127.
-   `minimax-m3`: 0 of 127.
-   `hf:openai/gpt-oss-120b`: 0 of 127.
-   `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`: 0 of 127.
-   `hf:moonshotai/Kimi-K3`: 0 of 127.
-   `hf:Qwen/Qwen3.8-27B`: 0 of 124.
-   `hf:zai-org/GLM-5.2`: 0 of 115.

THE BASELINE IS EXACTLY ZERO, not 39 percent.
Eight seats across roughly 1,000 streams produce not one zero-content call,
so 12 of 127 is not something a null distribution supplies.
Every one of the 12 carried reasoning characters above zero,
which is the same signature as `qwen3.8-max`: bytes arrived, and none were accounted to content.

The split follows the provider.
Both affected seats are served by Charm Hyper, which speaks the Anthropic protocol that
`src/anthropic-delta-scan.ts` reads, and every `hf:` seat on Synthetic is clean.
Three other Hyper seats are also clean, so this is not "the Hyper path is broken":
it is a frame pattern only some upstream models emit.

### What is still not settled, and the prediction that settles it

Why constant for one seat and intermittent for the other is not readable from the log.
`qwen3.8-max` is the one seat on `toolChoice: 'auto'`, so its whole answer always arrives as
tool-call arguments, which is exactly the delta type `#211` found misrouted.
For `deepseek-v4-pro-0813` two readings remain, and they differ in whether `#211`'s fix helps:

-   Same mechanism, occurring on 9.4 percent of calls because the duplicate
    `content_block_start` is what varies. `#211`'s fix removes all 12.
-   A different delta type, `text_delta` inside a thinking block, which `#211`
    deliberately does NOT exempt. The fix removes none of the 12.

That is a clean falsifiable prediction rather than an open question:
count zero-content streams for `deepseek-v4-pro-0813` on the first post-`#211` run.
Twelve becoming zero confirms the first reading; twelve staying put confirms the second and opens
its own task.
Do not fold the answer into `#211` before that count exists.

## What it costs in generated volume, measured at 30 of 40 slices

Counted from the live full-roster calibration log while it was still running,
so the figures are partial and will grow. Every seat had been asked
about the same number of times, so the shares below compare like with like.

```text
run-wide          3149 streams   content  1242020   reasoning 21392195   94.5% reasoning

qwen3.8-max        271 streams   content      892   reasoning  4001251  100.0% reasoning
hf:Qwen/Qwen3.8-27B 275 streams  content   116314   reasoning  5765153   98.0%
hf:zai-org/GLM-5.2  272 streams  content   131653   reasoning  3930074   96.8%
nvidia Nemotron-3   272 streams  content   123186   reasoning  2650296   95.6%
minimax-m3          272 streams  content   175386   reasoning  2971259   94.4%
hf:openai/gpt-oss-120b 272 streams content 110702   reasoning  1021604   90.2%
hf:moonshotai/Kimi-K3  272 streams content 138577   reasoning   694423   83.4%
deepseek-v4-pro-0813   272 streams content 129296   reasoning   353174   73.2%
deepseek-v4-flash-0731 272 streams content 151192   reasoning     4961    3.2%
gemma-4-26b-a4b-it     272 streams content 164251   reasoning        0    0.0%
```

`qwen3.8-max` spent 18.7 percent of the run's entire generated reasoning volume
to deliver 0.07 percent of its content.

267 of its 271 streams carried EXACTLY zero content characters.
The four that carried any managed 3, 9, 10 and 870.
That extends the 16-slice reading of 104 of 106 to 267 of 271, at nearly three times the sample,
and it is the same defect rather than a new one.

### A high reasoning share is not itself the finding

Seven other seats sit between 73 and 98 percent reasoning and produce real content throughout,
because they are thinking models and that is where thinking models legitimately spend.
`gemma-4-26b-a4b-it` emits no reasoning at all and still reached 30737 content characters
on a single call. Reading the run-wide 94.5 percent as waste would be wrong.

THE PATHOLOGY IS THE PAIR, not either half:
a stream that finishes with zero content characters while consuming millions of reasoning
characters, and is recorded `completed` rather than failed.

### The outcome field cannot see it

Of the 271 `qwen3.8-max` streams, 232 are recorded `completed` and 39 `cut`.
So on 232 occasions the pipeline believed the call succeeded and received nothing.

No success-or-failure check can find this, because by that measure nothing failed.
Only a content-volume reading finds it, which is the same blindness this document
was opened on, seen from the producing side rather than the guard side.

That is worth keeping after `#211` lands: the fix removes this instance of the defect,
but nothing yet refuses a completed stream that delivered no content,
so a future recurrence by another mechanism would again be invisible.

### The pre-`#211` baseline, so the prediction can be checked

Zero-content streams counted against COMPLETED streams only, per seat, at 31 of 40 slices.
Cut streams are excluded on purpose: a cut stream carrying no content is explained by the
cut, while a completed one is not.

```text
qwen3.8-max             236 completed   232 zero-content   98.3%
deepseek-v4-pro-0813    278 completed    31 zero-content   11.2%
hf:Qwen/Qwen3.8-27B     272 completed     4 zero-content    1.5%
hf:zai-org/GLM-5.2      255 completed     2 zero-content    0.8%
minimax-m3              280 completed     0
hf:openai/gpt-oss-120b  280 completed     0
nvidia Nemotron-3       280 completed     0
hf:moonshotai/Kimi-K3   280 completed     0
gemma-4-26b-a4b-it      279 completed     0
deepseek-v4-flash-0731  280 completed     0
```

`deepseek-v4-pro-0813` holds its rate across samples: 12 of 127 at the earlier reading,
9.4 percent, against 31 of 278 here, 11.2 percent. So it is stable intermittent behaviour
rather than something drifting during the run, and the falsifiable prediction stands as
written with 31 as its new before-number.

TWO SEATS APPEAR HERE THAT NO EARLIER COUNT NAMED.
`hf:Qwen/Qwen3.8-27B` at 4 and `hf:zai-org/GLM-5.2` at 2 were both recorded as losing
voices to CUTS, which is a different column, and neither was known to complete a stream
empty. The counts are small enough to be noise and large enough to be a third mechanism,
and nothing here separates those two readings.

OWED AT EXIT: recount this table on the finished run, then again on the first post-`#211`
run. The instrument is `~/temp/agent/zero-content-from-log.mjs`, which takes one or more log
paths and was cross-checked against an independently written pass over the same log rather
than against itself. It belongs in the package beside `run-timing-report` once `#221` is
built; until then the method is the whole of it, and is stated above. Three outcomes are worth telling apart, and only the pair of counts tells them apart:

-   `qwen3.8-max` falling from 232 to near zero confirms `#211` addresses the seat it was
    diagnosed on, which is the whole of its claim.
-   `deepseek-v4-pro-0813` falling to zero confirms the first reading recorded in this
    document; staying near 31 confirms the second and opens its own task.
-   The two small seats going to zero makes them noise. Either of them surviving while
    `qwen3.8-max` clears means a mechanism `#211` does not cover, and it would be invisible
    to every check the pipeline currently makes (`#221`).
