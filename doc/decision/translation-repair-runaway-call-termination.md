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
`AssertionError: expected 'drained' to equal 'raised'`,
and the drain reads the whole runaway,
logging 3,060,000 characters.
With the guard restored that line is absent entirely,
because the call ends before the stream does,
and 378 tests pass with `lint:types` and `lint:oxlint` clean.

The healthy long call logs 1,652,574 characters in BOTH runs,
which is the control that makes the other figure mean something:
the guard removed only the runaway,
and left the verbose call alone.

An empty `data:` payload is a keep-alive rather than an unreadable frame,
so it no longer counts toward the tally that exists to make a changed wire
format visible.

## What the first production traffic showed

The 2026-08-18 targeted pass is the first real traffic through this guard.
Read over its first half hour,
235 streams completed and NONE was ended by either guard:
no `degenerate in` line and no `cut` line appears in the log.
That is the expected healthy reading rather than a null result worth trusting on its own,
since it says only that no runaway happened in that window.

WATCH THE SEARCH ITSELF, because the obvious one lies.
Grepping the pass log for `cut` returns matches on every reply containing the word "cute",
which the models write often when rendering 撒娇.
The pattern that answers the question is `stream .*: cut` or `degenerate in`,
and a bare `cut` returned ten confident false positives here.

## What the progress line still cannot say

TWO FIELDS CARRY THE SAME NUMBER.
`reportStreamProgress` prints `N raw chars` from the idle guard's counter
and `N delivered chars` from `partialText.length`,
and both count the raw event stream:
`drainBody` accumulates undecoded chunks and returns the body itself,
so the text it hands back IS the wire format.
Measured across the pass log,
235 of 235 progress lines have the two equal,
with no line where they differ.

THIS MATTERS BECAUSE THE SECOND FIELD READS AS THOUGH IT MEANT GENERATED TEXT,
which is the figure every open question here needs and the one nothing records.
The scanner already computes it:
`watchRunaway` feeds each channel's detector exactly the generated characters,
and the detectors already hold their own totals.
Only the reporting stops short.

THE OUTCOME LABEL ALSO CONFLATES TWO ENDINGS.
`StreamOutcome` is `completed` or `cut`,
and a call this guard deliberately terminates is reported as `cut`,
the same word a stall gets.
A reader counting cuts to measure stalls would count our own terminations among them,
which is the same mistake the sub-kind item guards against,
one layer further out.

## What is still owed

-   REPORT GENERATED CHARACTERS PER CHANNEL on the progress line,
    replacing the field that repeats the raw count.
    Held until the targeted pass releases the producing path.
-   NAME OUR OWN TERMINATION in `StreamOutcome` rather than filing it as a cut,
    so a stall figure read off a log counts stalls.
-   RECORD THE NEW LOSS CAUSE with its own sub-kind, per `#75`.
    A call ended this way must not be filed with a stall:
    a stall is worth retrying,
    and a model that has begun repeating itself will repeat itself again.
-   MEASURE THE ENVELOPE RATIO and revisit the 131000 character bar.
    The bar is set from artifact evidence
    because the only length telemetry in production counts raw event bytes,
    and the ratio to generated characters has never been measured.
    It is measurable today without touching the frozen path,
    by capturing one stream per model outside the pipeline
    and counting both sides with this package's own scanner.
-   VALIDATE AGAINST A REAL DEGENERATE REPLY.
    `#118` landed and an aborted call now keeps what it received,
    so the material exists as soon as one occurs,
    but none has occurred yet and the detector is still fixture-validated only.
