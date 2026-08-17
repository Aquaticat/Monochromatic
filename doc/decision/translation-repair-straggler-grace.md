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

## What it costs

Almost nothing, and the handover's earlier note that widening "pushes the wrong way" on entry cost
was wrong.

The window is only paid when a voice is late. A voice that answers before it costs nothing at all,
and a voice that would have been cut now costs the difference between when it arrives and the old 60
second cut, which the distribution puts in the tens of seconds. Over the cost run, 63 of 283
six-voice stages lost a voice; at roughly 20 seconds more each that is about 21 minutes across a
seven and a half hour run, under half a percent.

Against that, `doc/audit/two-lane-entry-cost.md` measures entries costing hours. Voice loss is worth
more than the seconds it takes to stop losing them.

## What was rejected, and why it is worth recording

CUTTING ON SILENCE RATHER THAN ELAPSED TIME, which is the obvious better instrument and does not
work on this provider. `stream-idle-guard.ts` records the measurement: of the stalls a full sentinel
probe recorded, 34 of 34 were `first-byte` and not one was `body`, and across 32 successful streams
time to first byte ran p50 95.6 s, p75 123 s, p90 134 s. Long first-byte silence IS normal operation
here, so a silence window cannot separate stalled from working. Both idle constants are set to
600000 so they never fire, and the total deadline does the killing instead.

That is the same shape of answer as this one: when a guard cannot discriminate, do not tighten it,
move the killing to the deadline that can.

## What must follow

RE-MEASURE THE DECLINE RATE, which is the recorded next step and the reason this was first in the
queue. The 0.413 loss rate quoted throughout the handover describes the 60 second window, and every
measurement taken through a panel that lost voices was taken through this defect. Nothing that rests
on it should be trusted until the rate is read again under the new window.

The per-slice cost telemetry now carries an `exit` key, so the re-measure run reports what the wider
window costs directly rather than by the estimate above.
