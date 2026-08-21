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

## The detector catches short cycling and lets long cycling through

FOUND 2026-08-18 by probing the built detector directly,
with no rebuild and no quota.
The probe is kept at `~/temp/agent/degeneration-period-probe.mjs`.

WHAT DECIDES DETECTION IS ARITHMETIC, not how repetitive the text is.
Windows are taken every 32 characters,
so for text repeating with period P
the sample can only ever hold P divided by the greatest common divisor of P and 32 distinct windows.
The predicted count matched the observed one in all fifteen cases tried.
A verdict of degenerate needs that count at or below about 409,
which makes the effective rule
"the repeated unit is shorter than roughly 410 characters",
loosened only when the unit happens to be a multiple of 32.

TWO NEIGHBOURING PERIODS LAND ON OPPOSITE SIDES:

```text
period  distinct  ratio   verdict
   409       409  0.0999  degenerate
   410       205  0.0500  degenerate
   500       125  0.0305  degenerate
   501       501  0.1223  healthy
   503       503  0.1228  healthy
  1001      1001  0.2444  healthy
  5000       625  0.1526  healthy
 20000       625  0.1526  healthy
```

A model looping a 501-character paragraph forever is called healthy,
while the same loop one character shorter is caught,
and nothing about the text is different in kind.

THE CONTROL RAN FIRST, per `QPC`.
Text from the same generator that never repeats scores 1.0000 and reads healthy,
so the low ratios above are the loop rather than the fixture.
A first attempt at this probe padded a single sentence to length,
which made the block internally repetitive
and returned the same ratio for every period,
proving nothing;
that fixture was replaced before any of these numbers were read.

WHAT IS STILL COVERED, and it is the case that was asked for:
the thinking runaway of the form "I will output. I will output.",
at period 15,
scores 0.0037 and is refused.
Paragraph-scale looping is the gap,
and it costs exactly as much per hour as phrase-scale looping.

A FIX THAT DOES NOT DEPEND ON THE PERIOD.
Keep the trailing text itself,
and ask whether the most recent few thousand characters occur EARLIER in it.
A stream looping with any period shorter than the buffer answers yes,
whatever the period's arithmetic,
and ordinary prose never repeats a block that long verbatim.
It is one native substring search over a bounded buffer,
run occasionally rather than per chunk.

ONE HIT MUST NOT BE A VERDICT, and this is the part that would go wrong if written quickly.
Reasoning traces in this pipeline restate whole source slices and whole candidates verbatim,
so a model quoting a long candidate twice inside one thinking trace is ORDINARY WORK
and a single recurrence would read as a loop.
Aborting on that would cost a voice for doing its job,
which is the harm the calibration section spent a whole document avoiding.
The verdict has to require the recurrence to PERSIST,
tripping on several consecutive checks as the stream grows,
which a genuine loop does forever and a quotation does once.

It complements the ratio rather than replacing it:
the ratio catches short cycling on a small sample,
the recurrence test catches the long periods the ratio cannot see.

## Two more things the reporting gets wrong, both shown at the boundary

DRIVEN THROUGH `drainBody` ITSELF rather than reasoned about,
by importing the built artifact and feeding it a thinking runaway.
What came back:

```text
[reportStreamProgress] stream hf:whiskers: cut, firstByte 12ms, maxGap 1ms,
  1376256 raw chars, 0 unreadable frames, 1376256 delivered chars,
  opening "data: {\"id\":\"chatcmpl-tabby\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index"

error message : ": ended a runaway call, reasoning channel repeated itself at 0.0037 distinct over 131475 characters"
carries label?: NO label property
```

THE RUNAWAY ERROR NAMES NOTHING.
It is constructed with `response.url` where every other path uses the `label` parameter,
and `label` exists precisely because `#118` found that attributing a stream to the endpoint
rather than to the model makes a per-model figure unreadable.
Here the message opens with a bare colon because a constructed `Response` has no url;
in production it would open with the chat-completions endpoint,
which is the same string for every model in the roster.
`StreamCutShortError` carries `label` as a property and this one carries none,
so which model ran away cannot be recovered from the error at all.

THE OPENING EXCERPT CANNOT SHOW WHAT THE MODEL SAID.
`stream-cut.ts` states the excerpt's purpose in as many words:
the opening tells a thinking block from an answer from an empty cut,
which is the whole diagnostic question.
It shows `partialText`,
and `partialText` is the raw event stream,
so the first 80 characters are always `data: {"id":"` and whatever envelope follows.
Not usually, but in every case,
because every server-sent event body begins that way.
The id itself varies by sender:
the fixture above shows `chatcmpl-tabby`
and production shows a bare hexadecimal string,
so grep for the `data: {"id":` prefix rather than for either id.
The model's words are in there,
JSON-escaped and spread across frame boundaries,
and none of them are in the excerpt.

Both have the same root as the two equal counters:
what the drain hands back is the wire format,
and three separate readers treat it as though it were generated text.

## The guard ends one runaway and the retry layer starts four more

FOUND 2026-08-18 by driving `exchangeWithRetry` from the built artifact
with a transport that fails the way the drain fails.
No quota and no network.

`drainBody` cancels the reader and throws `StreamDegenerateError`.
It does NOT abort the caller's signal,
because the termination is ours rather than the caller's steering.
`attemptExchange` decides what is transient by reading `exchange.signal.aborted`,
which is false here,
so the runaway is captured as weather and re-dispatched.

AT THE PRODUCTION POLICY THAT IS FIVE CALLS, not one:

```text
transport failure: StreamDegenerateError: ... ; retrying in  669ms (attempt 1 of 5)
transport failure: StreamDegenerateError: ... ; retrying in 1635ms (attempt 2 of 5)
transport failure: StreamDegenerateError: ... ; retrying in 2988ms (attempt 3 of 5)
transport failure: StreamDegenerateError: ... ; retrying in 6937ms (attempt 4 of 5)
transport called 5 times over 12242ms, ended as StreamDegenerateError
```

Each of those attempts would run until the model degenerates again,
which takes at least the 131000 generated characters a verdict needs,
so the guard built to stop wasted work MULTIPLIES IT BY FIVE
and adds twelve seconds of backoff on top.

THE DECISION DOCUMENT ALREADY STATED THE RULE and the code does the opposite:
a stall is worth retrying,
and a model that has begun repeating itself will repeat itself again.
That was written about how the loss is FILED.
The retry layer was already retrying it,
which is the same mistake one layer earlier and far more expensive.

CHECKED AND CLEARED at the same time, so it is not re-investigated:
wrapping a failure in `StreamCutShortError` does NOT break caller-abort handling.
`attemptExchange` reads the SIGNAL rather than the error's identity,
so straggler abandonment and user steering still propagate untouched
however the drain has wrapped them.
A fixture whose signal is not aborted does see a cut retried,
but that is the fixture rather than production.

## What is still owed

-   NAME THE MODEL ON A RUNAWAY, which the error currently cannot do,
    and carry `label` as a property as the cut error already does.
-   SHOW GENERATED TEXT IN THE OPENING EXCERPT rather than the envelope,
    so the excerpt answers the question it was added to answer.
-   STOP THE RETRY LAYER RE-DISPATCHING A RUNAWAY, which today turns one into five.
    This is the most expensive of the open items and the cheapest to fix.
-   CATCH LONG-PERIOD LOOPING, which the distinct-window ratio cannot see.
    Held until the targeted pass releases the producing path.
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

## The idle windows' premise, re-derived from first production traffic, `#121`

STATE THE SPREAD BEFORE THE NUMBER, per this repository's own rule. Read separately from each of
the three logs `doc/audit/stream-guards-first-production-traffic.md` names, `flagged-pass-2.log`
(2025 post-`#118` progress lines), `corpus-pass-20260817.log` (2166), and `resume-run-output.log`
(2888), the first-byte median runs 1032, 1207, and 1237 ms, five days and more than one roster
composition apart. That band, not any single figure inside it, is what "the median" means here.
`grace-remeasure-snapshot.log` stays excluded: independently re-run, `cmp` confirms it is byte for
byte the first 811723 bytes of `corpus-pass-20260817.log`, so counting it would count part of one
run twice.

THE 95.6 S MEDIAN `STREAM_FIRST_BYTE_MS` WAS SET FROM IS SUPERSEDED BY 77 TO 93 TIMES, not a round
eighty read off one comparison: 95600 / 1032 = 92.6, 95600 / 1237 = 77.3, 95600 / 1207 = 79.2.
Working no longer looks anything like the old premise's stalled-and-silent shape at the median.

WHAT THIS CORRECTS IS THE STATED REASON, NOT THE CONSTANT. `STREAM_FIRST_BYTE_MS` and
`STREAM_IDLE_MS` stay at 600000, because the tail refuses to agree with the median. Pooling all
7079 rows across the three logs, a fuller read than the audit's own mid-flight counts since two of
the three logs are static files and `flagged-pass-2.log` kept growing after the audit was written,
finds a completed, not cut, first byte at 183755 ms and a completed, not cut, mid-stream gap of
124992 ms on `hf:zai-org/GLM-5.2` (first byte 794 ms, otherwise an ordinary stream). A separate,
uncensored 2026-07-26 run, PASS 7 RUN 014 in `doc/handover/translation-repair.md` (a different,
seven-model roster, three weeks before this traffic), recorded a completed call at 347099 ms,
WITHIN 3.6 PERCENT OF THE CURRENT 360000 MS DEADLINE, with 9 of 764 sampled calls landing at or
past 300 s. Any window tight enough to meaningfully beat the deadline would, on the evidence in
hand, have killed at least one of these healthy completions. That is why the correction lands in
the constants' TSDoc rather than in their values: commit `3893825b2`.

THE REGIME SHIFT ITSELF IS UNEXPLAINED AND STAYS THAT WAY. Time to first byte read 45.8 s (RUN 013,
median, censored at the 240 s deadline live then), 55.2 s (RUN 014, median, uncensored), 95.6 s
(the sentinel probe this file's constants were built from, same day), and roughly 1.1 s (this
traffic, three weeks later). Roster size moved from seven models to six somewhere in between, and
provider-side conditions across those three weeks are entirely unrecorded. Nothing here explains a
swing that size; it is named so the next reader does not mistake today's fast median for a settled
baseline.

BOTH TESTS ARE SHOWN TO FAIL, per `GFP`. With `STREAM_FIRST_BYTE_MS` and `STREAM_IDLE_MS` each set
to 30000 in turn, `stream-idle-guard.unit.test.ts` refuses both: "keeps both windows above the
per-call deadline so the guard measures without killing" (`expected 30000 to be above 360000`) and
"keeps both windows above the highest first-byte wait and mid-stream gap observed in production so
far" (`expected 30000 to be above 347099` against the sabotaged first-byte constant, `124992`
against the sabotaged idle constant). Restored, both pass.

## The straggler grace's cut population, counted to the end of the pass

THE AUDIT'S "NINE OF TEN" WAS A FLOOR, taken mid-flight; the pass log is no longer growing. Read to
the end of `flagged-pass-2.log`, `#121` counts 19 cuts, not 10, over 2025 streams:

```text
model                                               streams   cuts     rate
hf:zai-org/GLM-5.2                                      328     16   0.0488
hf:Qwen/Qwen3.6-27B                                      354      2   0.0056
hf:moonshotai/Kimi-K3                                    322      1   0.0031
hf:openai/gpt-oss-120b                                   351      0   0.0000
hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4        352      0   0.0000
hf:zai-org/GLM-4.7-Flash                                 318      0   0.0000
```

SIXTEEN OF NINETEEN CUTS, 84 PERCENT, ARE STILL ONE MODEL, and `hf:Qwen/Qwen3.6-27B` has now
entered the cut population with two, both among the largest deliveries in the log (3258415 and
3209277 characters), the same producing-not-stalled shape as `GLM-5.2`'s biggest cuts. Three of
six models remain at zero, not four; the finding narrows rather than reverses.

WHETHER TO CHANGE `STRAGGLER_GRACE_MS` IN RESPONSE IS A POLICY QUESTION, not a measurement one: the
input the original 180000 ms derivation used, per-model whole-call latency percentiles under a
bench roster, has no fresh equivalent under the current six-model roster in anything `#121` read,
and estimating one would mean spending quota this task was not authorized to spend. Options,
ranked, are in `doc/planning/translation-repair-open-decisions.md`, Question 9. The idle-window
re-arming posture this section leaves open, whether 600000 should ever be lowered given the
tail evidence above, is the same document's Question 10.

## Both channels were scanned and one of them was never read, `#158`

The section "Both channels are scanned, and the thinking one matters most" was right about why,
and wrong about what the code did.
`scanStreamDeltas` read `content` and `reasoning_content` off `choices[0].delta` and nothing else.
This provider does not spell the thinking channel the same way for every model.

Measured 2026-08-21 with one streaming call per model, a cat-themed invented prompt, no corpus text.
Half the roster uses each spelling.

Carrying `reasoning_content`, which the scanner already read:

- `zai-org/GLM-5.2` on 328 of its 329 frames.
- `Qwen/Qwen3.6-27B` on 463 of its 511 frames.
- `moonshotai/Kimi-K3` on 79 of its 148 frames.

Carrying `reasoning`, which it did not:

- `zai-org/GLM-4.7-Flash` on 871 of its 1029 frames.
- `openai/gpt-oss-120b` on 46 of its 206 frames.
- `nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` on 43 of its 232 frames.

The first reading of this defect put it at two models and it is three.
Counted over every stream record on disk from before the fix,
those three account for 2731 of 5864 calls,
and not one of those 2731 reported a single character of thinking.
So the detector was handed an empty string for every thinking token 47 percent of all recorded traffic
produced,
which is precisely the failure this document already named as the worst case:
a model repeating one sentence forever inside its thinking is never silent,
so the idle guard cannot fire,
and produced no text the degeneration detector could read,
so that could not fire either.
Both models ran to the wall clock instead.

The unreadable-frame tally could not show this and was never going to.
It rises only when a payload fails to parse.
These frames parsed perfectly and were simply not read,
so the number built to make a changed wire format visible sat at zero throughout.
A renamed field is invisible to it,
which is worth remembering before trusting that counter to prove anything about a future provider change.

The fix reads `reasoning_content` first and `reasoning` second,
taking the first non-empty value rather than the first present one,
so a provider that begins sending both spellings as aliases contributes that text once.
Merging them would double every thinking character on such a model
and push the detector toward a verdict on volume the model never produced.

### What proves it

Removing `reasoning` from the precedence list and rebuilding takes the suite from exit 0 to exit 1,
failing the three cases that depend on it,
including a thinking loop spelled `reasoning` that goes from unjudged to `degenerate`.

The control that mattered more ran against the built artifact and a live stream,
because widening the detector's input to a channel its thresholds were never calibrated on
could have produced spurious verdicts on healthy thinking,
which would be worse than the blindness it replaced.
All three models now count their thinking,
`GLM-4.7-Flash` at 5158 characters and Nemotron at 167 where both previously counted zero,
and all three leave both channels `undecided` on an ordinary call.

### What this invalidates

Every generated-character figure recorded for `GLM-4.7-Flash` and Nemotron before this date understates,
by however much thinking those calls did.
Any bound derived from that column has to be re-derived,
which is why `#156` is blocked on this rather than merely related to it.

Timing figures are unaffected.
The straggler and idle windows re-derived in `#121` read `firstByteMs` and `maxGapMs`,
which never depended on which field carried the text.

### The size of what was invisible

Run 8 is the first run with the fix in place, and the before-and-after is not subtle.
Every one of the three affected models went from 0 percent of calls reporting any thinking
to 100 percent of calls reporting it.
The median thinking on those calls is 6236 characters for `gpt-oss-120b`,
12986 for Nemotron,
and 22995 for `GLM-4.7-Flash`,
which is the largest median of any model on the roster and had been recorded as zero throughout.

Anything read off the character columns for those three before 2026-08-21 is wrong by roughly that much,
including the reading that they were the cheap models on the roster.

## The size a cap should read, measured over 515 calls, `#156`

`#156` asked for an absolute output-size cap with a bound taken from the observed distribution
rather than guessed.
The distribution now exists,
because `reportStreamProgress` reports on the completed path as well as the cut one,
and it refutes the obvious instrument.

Measured 2026-08-21 over the consolidation bed's run 8 (complete) and run 9 (partial),
515 calls carrying a progress line,
read from the runs' stdout rather than their `.log`,
which is where those lines land:

```text
completed  502 calls   generated  p50    10992   p90    31430   p99    56730   max     70264
                       raw        p50   515866   p90  2086176   p99  4302244   max   5992537
                       content    p50      335   p90      719   p99     3969   max      4278
cut         11 calls   generated  min    16488   p50    50207                  max    110820
                       raw                                                     max  10811236
degenerate   2 calls   content    both around 131077, which the degeneracy detector caught
```

### A raw-character cap cannot work

Raw characters are SSE wire text, and they inflate the generated text by 22 to 103 times,
median 70,
because every token arrives inside its own JSON frame.

The two populations overlap almost exactly on that measure.
The largest COMPLETED call carries 5,992,537 raw characters.
The 6,495,103-character cut this task was filed over is 8 percent above it.
Any raw cap low enough to have stopped that runaway also kills legitimate completions,
so the figure `#156` was filed with is the wrong number to build a bound from.

### What separates them is silence, not size

Of the 11 cut calls, 9 had emitted ZERO content characters.
They had reasoned for 16,488 to 110,820 characters and said nothing.

Of the 508 completed calls, 507 emitted content.
Exactly one finished silent, at 32,646 reasoning characters.

```text
   16488 reasoning +      0 content   GLM-5.2
   20122 reasoning +  25482 content   Nemotron-3-Super
   22181 reasoning +  28026 content   GLM-4.7-Flash
   27870 reasoning +      0 content   GLM-5.2
   43014 reasoning +      0 content   GLM-5.2
   48836 reasoning +      0 content   GLM-5.2
   53899 reasoning +      0 content   GLM-5.2
   61601 reasoning +      0 content   GLM-5.2
   62229 reasoning +      0 content   GLM-5.2
   84615 reasoning +      0 content   GLM-4.7-Flash
  110820 reasoning +      0 content   Nemotron-3-Super
```

This also confirms `#156`'s reading that no per-model allowance can bound it:
three models appear, and the largest silent runaway is Nemotron's.

### The two bounds the numbers support

A SILENT-REASONING BOUND at 40,000 characters.
Above the single silent completion at 32,646, so no observed completion trips it,
and below 7 of the 9 silent cuts, which it ends early instead of paying 180 seconds for.
The two silent cuts at 16,488 and 27,870 stay under it and are not addressed by this bound.

A CONTENT BOUND at 10,000 characters.
The largest legitimate completion emitted 4,278 content characters,
and the two content-producing cuts emitted 25,482 and 28,026.
Ten thousand sits between them with better than twice the margin over observed legitimate use.

Together they name all 11 cuts as reachable except the two smallest silent ones,
against zero false positives over 508 observed completions.

### What this does not establish

CUT SIZE IS A LOWER BOUND, not a runaway's size.
A cut call was stopped by the clock at 180 seconds, so its recorded characters say how far it got,
not how far it would have gone.
The cut column above therefore understates the population it describes,
which makes both bounds conservative rather than tight.

ONE SILENT COMPLETION IS A THIN MARGIN.
The 40,000 bound rests on a single observed silent completion at 32,646.
A second such call arriving higher would move it.
Re-measure before treating 40,000 as settled,
and prefer raising it over lowering it,
since a false positive costs a voice and a false negative costs 180 seconds.

## Correction: the silent-reasoning bound at 40,000 is unsound, and measured to be so

The two claims made for the 40,000 bound are wrong,
and the error is in which number they compare against.

WHAT THE CENSUS MEASURED was end-of-stream totals.
WHAT THE PREDICATE READS is mid-stream state.
Every thinking model on this roster emits its reasoning before it emits any content,
so a call that finishes with 69,847 reasoning characters and 417 content characters
passed through the state "40,000 reasoning characters, no content" on its way to speaking.
A guard that fires on silent reasoning above 40,000 kills that call before it ever says anything.

The comparator in the committed text is the largest silent COMPLETION, 32,646.
The correct comparator is the largest reasoning on ANY completion, 69,847.

### What the counts are, re-measured over both complete runs

Over 545 completed calls and 11 cut calls, of which 9 emitted no content at all,
the count of completed calls a silent-reasoning bound would kill:

- At 30,000: 61 completed calls killed, 7 of 9 silent cuts caught.
- At 40,000: 22 completed calls killed, 7 of 9 caught.
- At 56,730: 5 completed calls killed, 4 of 9 caught.
- At 69,847: 1 completed call killed, 2 of 9 caught.
- At 70,000: no completed call killed, 2 of 9 caught.
- At 110,821: no completed call killed, none caught.

So "zero false positives over 508 observed completions" should read
TWENTY-TWO LOST VOICES OUT OF 545, and "no observed completion trips it" is simply false.

### What survives

The only window with no observed false positive runs from just above 69,847
to the largest reasoning any cut call reached, 110,820.
That ceiling is not a property of runaways: it is where the 180 second deadline stopped them.
A bound inside that window catches 2 of 9 silent cuts at a margin under 1.3 times.

THE DEADLINE IS ALREADY THE SILENT-RUNAWAY INSTRUMENT.
A reasoning cap that clears every observed legitimate call
cannot catch much that the clock does not already catch a few seconds later.
Either set it as a far backstop well above anything reachable in 180 seconds,
and document it as unreachable under the current deadline,
or do not add it at all.

### The content bound still stands

Content characters are monotone in the same way, and the largest completed call emitted 4,278.
No completed call ever crossed 10,000 content characters mid-stream, because none ever reached it.
The two content-producing cuts emitted 25,482 and 28,026.
That bound is sound in-sample.

TWO CONDITIONS BEFORE IT IS WIRED.
All 556 calls here are consolidation-bed traffic,
so editors, critics and the translate lane are outside the sample,
and their largest legitimate emission must be read off the settled artifacts before 10,000 is called global.
And the cap must be passed per call site the way the exchange timeout is,
defaulting to the measured value rather than freezing a constant into the guard.

### What the guard must not repeat

Whatever error a cap throws has to carry the same retry classification as `StreamDegenerateError`.
`#120` recorded the exact defect: a guard that stops a runaway
and then hands a retryable error to the retry layer buys the same runaway four more times.
The outcome also needs its own label in `reportStreamProgress`,
which means the census pattern gains a fourth alternative and every earlier scan of that log
counts a population that did not include it.

### First condition discharged: no other role emits more than the consolidation bed

The other producing roles were read off the 11 settled artifacts,
taking the largest single model-produced text for each:

- Editor, whole document: 6,679 characters, `Arita`.
- Editor, one slice: 1,766 characters, `dogesir_`.
- Translator candidate: 1,766 characters, `dogesir_`.
- Judge ballot reason: 1,457 characters, `Arita`.
- Critic quoted span: 629 characters, `saurikissa`.
- Critic claim summary: 289 characters, `GLaDOSister`.

THE 6,679 FIGURE IS NOT A STREAM. `Arita`'s repaired document is assembled from 12 slices
whose accepted texts sum to 6,534, the largest of them 1,134,
and every one of them appears verbatim in the assembled text.
No single call produced it, so it does not bound anything a per-stream guard reads.

The largest single-stream emission by any role in the artifacts is therefore 1,766 parsed characters.
Artifact fields hold parsed results rather than raw stream content,
so each understates the stream that carried it by its JSON envelope and escaping.
Even generously inflated, 1,766 stays below the 4,278 the consolidation bed reached.

The consolidation bed is the heaviest emitter measured anywhere,
and its 4,278 is already counted in raw stream content characters rather than parsed length,
which is the unit the guard reads.
A 10,000 character content bound keeps better than twice that margin.

## The census, re-measured over 602 calls, and the bound as shipped

The earlier census undercounted. Its pattern required the whole progress line to
match in one piece, so 44 completed lines whose tail differed were dropped
silently, and two `degenerate` endings never entered any figure at all.
Reading each field separately gives 602 rows across the two complete runs:
589 completed, 11 cut, 2 degenerate, none missing a channel count.

Content characters on the 589 completed calls:
p50 334, p90 703, p99 3,969, maximum 4,278.

The 11 cut calls: 9 emitted nothing, 2 emitted 25,482 and 28,026.

The 2 degenerate calls were both `hf:zai-org/GLM-4.7-Flash`,
at 131,078 and 131,077 content characters.

### Why 131,072 is the number that matters

The recurrence detector fires at exactly 2^17 characters, measured directly by
feeding it a repeated sentence at several chunk widths: it reports nothing at
120,000 characters and reports a runaway at 131,072 every time.
That is why the two real degenerate calls got as far as they did.
Repetition detection is not free, and what it costs is 131,072 characters.

### What the bound does to this population

A content bound at 10,000 characters:

- Ends ZERO of the 589 completed calls early.
- Catches the 2 speaking cuts, which the wall clock would otherwise have taken.
- Reaches both degenerate calls THIRTEEN TIMES EARLIER, at 10,000 instead of 131,072.

It sits between the largest legitimate emission at 4,278 and the nearest runaway
at 25,482, with better than twice the margin on the safe side.
The corrected silent-reasoning figure is 25 completed calls ended early at 40,000,
not the 22 the first census reported, and still zero at 70,000.

### The contract this changes, stated rather than slipped in

Two tests asserted that a model which simply writes a great deal is never cut off,
with fixtures of roughly 420,000 content characters.
`SLICE_CHAR_BUDGET` is 400, and the largest slice text measured anywhere in the
settled artifacts is 1,766, so those fixtures describe output this system cannot
produce. Their answer side now sits inside the bound.

THEIR THINKING SIDE WAS LEFT ALONE, at 6,000 frames and roughly 420,000 reasoning
characters, because no volume bound applies to reasoning and that fixture is now
what pins the refusal recorded above.

A repetitive ANSWER now reports `overrun` where it would once have reported
`degenerate`, because the bound reaches it first. The same call is ended either
way and far sooner. Any census that groups by outcome across this change is
counting two different partitions of the same population.
