# Ending runaway calls on our side of the wire, part 02

Part 02 of [Ending runaway calls on our side of the wire](translation-repair-runaway-call-termination.md),
whose index lists every part in order.

## Correction: the silent-reasoning bound at 40,000 is unsound, and measured to be so

The two claims made for the 40,000 bound are wrong,
and the error is in which number they compare against.

WHAT THE CENSUS MEASURED was end-of-stream totals.
WHAT THE PREDICATE READS is mid-stream state.
Every thinking model on this roster emits its reasoning before it emits any content,
so a call that finishes with 69,847 reasoning characters and 417 content characters
passed through the state "40,000 reasoning characters,
no content" on its way to speaking.
A guard that fires on silent reasoning above 40,000 kills that call before it ever says anything.

The comparator in the committed text is the largest silent COMPLETION,
32,646.
The correct comparator is the largest reasoning on ANY completion,
69,847.

### What the counts are, re-measured over both complete runs

Over 545 completed calls and 11 cut calls,
of which 9 emitted no content at all,
the count of completed calls a silent-reasoning bound would kill:

- At 30,000:
  61 completed calls killed,
  7 of 9 silent cuts caught.
- At 40,000:
  22 completed calls killed,
  7 of 9 caught.
- At 56,730:
  5 completed calls killed,
  4 of 9 caught.
- At 69,847:
  1 completed call killed,
  2 of 9 caught.
- At 70,000:
  no completed call killed,
  2 of 9 caught.
- At 110,821:
  no completed call killed,
  none caught.

So "zero false positives over 508 observed completions" should read
TWENTY-TWO LOST VOICES OUT OF 545,
and "no observed completion trips it" is simply false.

### What survives

The only window with no observed false positive runs from just above 69,847
to the largest reasoning any cut call reached,
110,820.
That ceiling is not a property of runaways:
it is where the 180 second deadline stopped them.
A bound inside that window catches 2 of 9 silent cuts at a margin under 1.3 times.

THE DEADLINE IS ALREADY THE SILENT-RUNAWAY INSTRUMENT.
A reasoning cap that clears every observed legitimate call
cannot catch much that the clock does not already catch a few seconds later.
Either set it as a far backstop well above anything reachable in 180 seconds,
and document it as unreachable under the current deadline,
or do not add it at all.

### The content bound still stands

Content characters are monotone in the same way,
and the largest completed call emitted 4,278.
No completed call ever crossed 10,000 content characters mid-stream,
because none ever reached it.
The two content-producing cuts emitted 25,482 and 28,026.
That bound is sound in-sample.

TWO CONDITIONS BEFORE IT IS WIRED.
All 556 calls here are consolidation-bed traffic,
so editors,
critics and the translate lane are outside the sample,
and their largest legitimate emission must be read off the settled artifacts before 10,000 is called global.
And the cap must be passed per call site the way the exchange timeout is,
defaulting to the measured value rather than freezing a constant into the guard.

### What the guard must not repeat

Whatever error a cap throws has to carry the same retry classification as `StreamDegenerateError`.
The stream-guard defect audit recorded the exact defect:
a guard that stops a runaway
and then hands a retryable error to the retry layer buys the same runaway four more times.
The outcome also needs its own label in `reportStreamProgress`,
which means the census pattern gains a fourth alternative and every earlier scan of that log
counts a population that did not include it.

### First condition discharged: no other role emits more than the consolidation bed

The other producing roles were read off the 11 settled artifacts,
taking the largest single model-produced text for each:

- Editor,
  whole document:
  6,679 characters,
  `Arita`.
- Editor,
  one slice:
  1,766 characters,
  `dogesir_`.
- Translator candidate:
  1,766 characters,
  `dogesir_`.
- Judge ballot reason:
  1,457 characters,
  `Arita`.
- Critic quoted span:
  629 characters,
  `saurikissa`.
- Critic claim summary:
  289 characters,
  `GLaDOSister`.

THE 6,679 FIGURE IS NOT A STREAM.
`Arita`'s repaired document is assembled from 12 slices
whose accepted texts sum to 6,534,
the largest of them 1,134,
and every one of them appears verbatim in the assembled text.
No single call produced it,
so it does not bound anything a per-stream guard reads.

The largest single-stream emission by any role in the artifacts is therefore 1,766 parsed characters.
Artifact fields hold parsed results rather than raw stream content,
so each understates the stream that carried it by its JSON envelope and escaping.
Even generously inflated,
1,766 stays below the 4,278 the consolidation bed reached.

The consolidation bed is the heaviest emitter measured anywhere,
and its 4,278 is already counted in raw stream content characters rather than parsed length,
which is the unit the guard reads.
A 10,000 character content bound keeps better than twice that margin.

## The census, re-measured over 602 calls, and the bound as shipped

The earlier census undercounted.
Its pattern required the whole progress line to
match in one piece,
so 44 completed lines whose tail differed were dropped
silently,
and two `degenerate` endings never entered any figure at all.
Reading each field separately gives 602 rows across the two complete runs:
589 completed,
11 cut,
2 degenerate,
none missing a channel count.

Content characters on the 589 completed calls:
p50 334,
p90 703,
p99 3,969,
maximum 4,278.

The 11 cut calls:
9 emitted nothing,
2 emitted 25,482 and 28,026.

The 2 degenerate calls were both `hf:zai-org/GLM-4.7-Flash`,
at 131,078 and 131,077 content characters.

### Why 131,072 is the number that matters

The recurrence detector fires at exactly 2^17 characters,
measured directly by
feeding it a repeated sentence at several chunk widths:
it reports nothing at
120,000 characters and reports a runaway at 131,072 every time.
That is why the two real degenerate calls got as far as they did.
Repetition detection is not free,
and what it costs is 131,072 characters.

### What the bound does to this population

A content bound at 10,000 characters:

- Ends ZERO of the 589 completed calls early.
- Catches the 2 speaking cuts,
  which the wall clock would otherwise have taken.
- Reaches both degenerate calls THIRTEEN TIMES EARLIER,
  at 10,000 instead of 131,072.

It sits between the largest legitimate emission at 4,278 and the nearest runaway
at 25,482,
with better than twice the margin on the safe side.
The corrected silent-reasoning figure is 25 completed calls ended early at 40,000,
not the 22 the first census reported,
and still zero at 70,000.

### The contract this changes, stated rather than slipped in

Two tests asserted that a model which simply writes a great deal is never cut off,
with fixtures of roughly 420,000 content characters.
`SLICE_CHAR_BUDGET` is 400,
and the largest slice text measured anywhere in the
settled artifacts is 1,766,
so those fixtures describe output this system cannot
produce.
Their answer side now sits inside the bound.

THEIR THINKING SIDE WAS LEFT ALONE,
at 6,000 frames and roughly 420,000 reasoning
characters,
because no volume bound applies to reasoning and that fixture is now
what pins the refusal to bound reasoning,
recorded in "Correction:
the silent-reasoning bound at 40,000 is unsound,
and measured to be so".

A repetitive ANSWER now reports `overrun` where it would once have reported
`degenerate`,
because the bound reaches it first.
The same call is ended either
way and far sooner.
Any census that groups by outcome across this change is
counting two different partitions of the same population.

## Correction: 10,000 was set on an unrepresentative population, and shipped at 32,000

The 10,000 content bound was measured on completions drawn from the consolidation bed.
That bed replays the reading,
pairing and critic lanes from cache,
so none of their calls were in the sample.
Reading a picture is the one role here that legitimately emits at length,
and it was the one role the measurement could not see.

The `census2.mjs` instrument named earlier reads one log at a time.
`pool-real.mjs` pools every log that records the two channels separately,
and keeps only labels carrying a vendor path,
so the cat-themed fixture `hf:whiskers` and its 381,890-character test streams stay out.

### What the fuller population says

1,887 real provider completions,
from 64 logs.

Seven of them exceed 10,000 content characters.
Every one is a reading-lane transcription,
and the largest is 11,392.
The bound as shipped would have ended all seven mid-answer.

At 32,000 none of the 1,887 is ended.
The margin over the largest legitimate answer is better than two and a half times,
and a runaway is still reached about four times sooner than the repetition detectors manage,
since those need 131,072 characters before a cycle becomes visible to them.

`overrun` appears in no recorded run.
The bound has never fired in anger,
so the old value cost no voice before it was corrected.

### The two large cuts are runaways, not long legitimate answers

A cut is transient and gets retried;
an overrun is permanent and ends the voice.
Raising the bound past a legitimate long answer is therefore the expensive mistake,
and two real cuts sit between 32,000 and 131,072 where the new bound would relabel them.
Both were checked rather than assumed.

`hf:zai-org/GLM-4.7-Flash` was cut at 113,346 content characters in `reading-verify3.log`,
having pulled 9,699,969 raw characters off the wire.
The five largest completed calls in that same log carry 3,054,
2,831,
2,737,
2,704 and 2,683.
That call is 37 times the largest healthy answer in its own population,
and it is the same model as both recorded degenerate calls.

`hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` was cut at 59,869 in `sens-audit.log`,
having pulled 11,366,983 raw characters.
Its peers answering the same question in the same minute emitted 493,
466,
55 and 52.

Neither is legitimate long output.
Reaching both earlier is a gain,
and it is the larger part of what this bound buys.

### The refused reasoning bound, restated on the same population

The refutation recorded earlier stands and gets stronger.
Across the 1,887 real completions,
a silent-reasoning bound at 40,000 would have ended 24 of them,
and even 60,000 would have ended 5.
Nothing under 70,000 is clean.
The largest legitimate completion carried 64,501 reasoning characters and then answered normally.

### What the critic and pairing numbers actually are

The earlier discharge of the first condition compared per-field maxima against a per-stream bound.
Those are different units.
One critic call carries a whole claims list,
not one quoted span.

Reconstructing per critic per slice from `claimAttributions` and the claims they name,
839 claims link across the settled artifacts with none unlinked,
giving 361 payloads whose largest is 6,236 characters.

THIS IS A LOWER BOUND AND NOT A MEASUREMENT OF THE STREAM.
It counts only claims that survived the accept gate,
so a critic's real emission adds whatever the gate rejected plus the JSON envelope around it.
At 32,000 even the largest reconstructed payload leaves more than five times its own size in headroom,
which is why the default is left to cover this role rather than raised again for it.

### The cap parameter stays unthreaded on purpose

`watchRunaway` takes a content bound so a role that knows it emits more can raise it.
Nothing in the pipeline passes one.
`drainBody` neither accepts nor forwards it,
so threading it is an API change through that function and every caller,
not a parameter tweak.
The measurement says one bound clears every role by better than twice,
so the parameter stays reachable from tests and the call site says so in a comment.
A reviewer who finds it dangling should read this section before wiring it up.
