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

## What is still owed

-   WIRE IT INTO THE DRAIN, fed by an incremental delta extractor.
    That extractor belongs in its own module:
    `stream-drain.ts` is 179 lines and `stream-idle-guard.ts` is 307.
-   `#118`, so an aborted call keeps what it received.
    Until then the detector is validated only against fixtures,
    never against a real degenerate reply,
    because no real one has ever been kept.

Both touch the producing path,
which is frozen while the corpus pass holds it.
