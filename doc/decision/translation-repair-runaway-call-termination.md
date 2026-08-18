# Ending runaway calls on our side of the wire

Decided 2026-08-17 by the user, on the observation that the provider does not
auto-terminate token degeneration.

## The decision

DO NOT SEND `max_tokens`.
Termination is ours to perform, in our own client.

The provider is a two-person shop,
and its inference quality is not on par with the large vendors.
A token cap only helps if the provider implements it correctly.
Relying on one would move the failure rather than remove it:
instead of a call that runs too long,
we would get a reply truncated at an arbitrary point,
arriving as a well-formed short answer that nothing downstream can tell
from a model that simply had little to say.
That is a worse failure than the one it replaces,
because it is silent.

The request body stays as lean as it is today:
`model`,
`messages`,
`stream`,
`stream_options`,
and `response_format` when a stage asks for one.

This is also the current behaviour,
which is worth stating plainly:
no production stage sets `maxTokens`.
`chat-contract.ts` declares it optional,
`synthetic-client.ts` sends `max_tokens` only when it is defined,
and every other reference to it in the package is in a test.
The decision is to keep that deliberately,
rather than to leave it as an omission nobody had examined.

## Why anything is needed at all

A degenerating model streams forever,
and until now nothing anywhere in the system could end it or even see it.

THE IDLE GUARD CANNOT SEE IT.
`stream-idle-guard.ts` watches for silence,
and a degenerating stream is the opposite of silent:
it emits continuously, at full speed.
Measured over 1677 completed streams in the 2026-08-17 pass,
only 61 ever paused longer than five seconds,
and the largest streams ran with gaps of 202 to 858 ms.
Both idle constants are set to 600000 so they never fire,
which `doc/decision/translation-repair-straggler-grace.md` already recorded
after finding that 34 of 34 observed stalls were `first-byte` and none were `body`.
That finding is about STALLS.
Degeneration is a `body` phenomenon,
so it was never in scope,
and the earlier decision is narrowed by this rather than contradicted.

THE ARTIFACT CANNOT SEE IT.
Raw model output is never stored.
Across all 56 settled artifacts,
every string longer than 500 characters is EXTRACTED text
(`finalSliceText`, `repairedText`, `editorAfter`, `before`, `quotedText`),
and the longest is 8358 characters.
A scan of them for repeated content found nothing,
which is a statement about scope and not evidence of health:
a degenerate reply never reaches an artifact.

THE ABANDONED CALL CANNOT SEE IT.
`drainBody` accumulates its parts and the catch rethrows,
discarding everything received.
That is `#118`,
and it is why no degenerate reply has ever been examined.

## What was built

`watchForDegeneration` in `package/module/translation-repair/src/stream-degeneration.ts`.

It measures the share of recent windows of generated text that are distinct.
A model writing prose emits almost entirely fresh windows;
one cycling on a phrase emits the same few forever.

THE SAMPLE TRAILS rather than accumulating,
so a reply that runs healthy and then begins cycling is still caught.
A cumulative ratio over a long good opening cannot fall far enough to trip,
however long the model then repeats itself.

MEMORY IS BOUNDED,
which matters more here than usual:
the population this exists to stop is the calls that never end,
so a detector whose cost grew with the stream would fail on exactly those.

IT KNOWS NOTHING OF THE WIRE FORMAT,
and must be fed extracted content.
Fed the raw body it would condemn every healthy stream,
because the JSON envelope wrapped around each token is identical by construction
and would dominate the sample.

## Both channels are scanned, and the thinking one matters most

Required 2026-08-17 by the user:
degeneration inside a thinking trace must be caught,
in the shape "I will output. I will output. I will output.", repeating without end.

THIS IS THE CASE THAT WOULD OTHERWISE ESCAPE ENTIRELY.
A model cycling inside its reasoning emits no answer at all,
so a scanner reading only `content` hands the detector an empty string.
An empty string reads as a short reply,
which is exactly the state the detector is built to stay silent about,
so the worst failure would have produced the most reassuring reading.

`scanStreamDeltas` in `package/module/translation-repair/src/stream-delta-scan.ts`
reads both fields this provider uses,
`content` and `reasoning_content`,
and tags each piece with the channel it came from
so a verdict can say where the repetition happened.
The two are judged separately,
because varied thinking must not excuse a repeating answer
and a good answer must not excuse thinking that never ended.

The other delivery shape needs nothing extra.
Some models embed `<think>` blocks inside `content`,
which `model-content.ts` strips after the fact;
such text arrives as content and is scanned as content.

The scanner COUNTS frames it cannot read rather than throwing on them.
It runs inside the drain loop for every chunk of every call,
so one unreadable frame must leave a working stream working,
and a provider that changes its wire format then shows up
as a rising count rather than as silence.

Verified end to end through scanner and detector:
an infinite thinking trace is refused while its answer channel stays unjudged,
long varied thinking is not condemned,
a runaway in the answer channel is refused,
and keep-alive comments, usage-only frames, finish-only frames and the done
marker all pass through without producing text.

## Calibration

Threshold is 0.1 distinct.
Measured:

```text
varied prose                     0.9909
structured output, repeated keys 1.0000
a phrase repeated                0.0015
```

The middle row is the one that mattered.
Stages ask for structured replies,
so a reply full of identical field names is ordinary output rather than a symptom,
and a detector that flagged it would abort good work and cost a voice,
which is the harm the straggler-grace decision spent a whole document avoiding.

Nothing observed falls between 0.1 and 0.99,
so the threshold sits in empty space rather than at a fitted boundary.

## What is wired, and what proves it

LANDED 2026-08-17, once the corpus pass released the producing path.
`drainBody` now asks the runaway watch about every chunk,
and on a runaway it cancels the reader before reporting,
so the socket is released rather than left feeding a model that will not stop.
It then throws `StreamDegenerateError`,
naming the channel, the ratio, and what the call had already cost.

THE TEST ASSERTS THE CALL STOPS EARLY, not merely that it raises.
A drain that read every byte and complained afterwards
would satisfy every assertion about the error
while leaving the socket open for the whole runaway,
which is the entire cost this exists to avoid,
so the test counts how much of the body was pulled.

SHOWN TO FAIL BEFORE BEING TRUSTED, per `GFP`.
With the verdict computed but not acted on,
the suite reports
`AssertionError: expected 'drained' to equal 'raised'`
and the drain reads 1,652,574 characters of the runaway to its end.
With the guard restored it stops well before that,
and 378 tests pass with `lint:types` and `lint:oxlint` clean.

An empty `data:` payload is a keep-alive rather than an unreadable frame,
so it no longer counts toward the tally that exists to make a changed wire
format visible.

## What is still owed

-   `#118`, so an aborted call keeps what it received.
    Until then the detector is validated only against fixtures,
    never against a real degenerate reply,
    because no real one has ever been kept.
-   RECORD THE NEW LOSS CAUSE with its own sub-kind, per `#75`.
    A call ended this way must not be filed with a stall:
    a stall is worth retrying,
    and a model that has begun repeating itself will repeat itself again.
-   MEASURE THE ENVELOPE RATIO and revisit the 131000 character bar,
    which is set from artifact evidence
    because the only length telemetry in production counts raw event bytes
    and relates to generated characters by a ratio never measured.
