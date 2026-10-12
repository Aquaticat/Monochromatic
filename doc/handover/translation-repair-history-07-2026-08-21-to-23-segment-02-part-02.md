# Translation repair history: 2026-08-21 to 2026-08-23, segment 2, part 02

Part 02 of [Translation repair history: 2026-08-21 to 2026-08-23, segment 2](translation-repair-history-07-2026-08-21-to-23-segment-02.md),
whose index lists every part in order.

## 2026-08-23: the naturalness lane's auditor was blind to neighbours, and now is not

`#68`'s last open item,
closed.

`refine-slice-settle.ts` called `runIntroducedDefectProbe` with no window,
and no window was in scope anywhere in that file.
The accuracy lane's probe has had one since `#107`.
So one lane's auditor reasoned about a slice alone
while the other's reasoned about a slice in context,
and any difference between their findings could have been the lanes differing
or the windows differing,
with no reading of the numbers able to separate the two.

WHY IT MATTERS MOST FOR THIS LANE SPECIFICALLY.
The naturalness lane rewrites for fluency.
The commonest fluent rewrite of a paragraph
that repeats what the paragraph next door already said
is to drop the repetition.
Judged alone that is a deletion.
Judged with the neighbour visible it is the redundancy it was.
So the lane whose characteristic edit needs the neighbour most
was the one that never had it.

### What was threaded, and the one judgement call in it

The chain is `repair-translation.ts:541` to `refineSettledSlices`
to `runRefinePhase` to `settleRefinedSlice`.
The phase already receives `slices`,
so it computes the window itself with `neighbouringSource` and `neighbouringIncumbent`,
the same helpers the accuracy driver uses,
rather than carrying it on `RefinedSliceSettlement`,
which is the cached type and is better kept lean.

THE JUDGEMENT CALL WAS WHICH INDEX TO ADDRESS BY.
`neighbouringSource` throws on a position the entry does not have,
and the phase loop already tolerates an outcome with no prepared slice behind it:
`sourceText` and `incumbentText` both fall back rather than fail.
A window that threw where those fall back
would turn a tolerated shape into a crash.
So the window is computed only when `prepared` is present,
which means the lookup found an element,
which means the index is an integer inside the array
and neither helper can throw.

It addresses by the stamped `chunkIndex`,
like everything else in that loop.
That agrees with the position
because `document-preparation.ts:272` stamps `baseIndex: slices.length`,
a running counter over emitted slices,
so a prepared slice's stamp IS its position.

### An invariant nothing asserts, found while doing it

`refine-phase.ts` reaches its slice by `slices[outcome.chunkIndex]`,
array position indexed by a stamped value.
`repair-refine-step.ts` in the same feature builds a Map from `chunkIndex` to text
and looks up through it,
which is correct whether or not the two agree.
Two files of one feature therefore disagree about whether the identity is a position or a stamp.

Production is safe today,
measured rather than assumed:
`document-preparation.ts:272` and `seed-detection.ts:118`
both pass a running counter as `baseIndex`,
and `slice-pair.ts:288` re-indexes the one path that used to leak a section index.
`corpus-run/probe-relabel-case.ts:197` passes the PAIR index instead,
which is the shape `seed-detection.ts:106` records as having been silently wrong before.
That one is a probe rather than a production path.

Nothing asserts the invariant anywhere,
and `#99` records that `chunkIndex` does not carry one meaning across the codebase.
Recorded on `#94`,
which owns lane index contracts.

### Cache

`refineSliceKey` now covers both window sides,
labelled,
so a source-only and an incumbent-only window carrying identical text cannot share a key.
That is `#126` exactly,
which found the unlabelled version of this hazard at the accuracy key.
Absent and empty key alike,
because `introduced-defect-wire.ts:418` renders no nearby block for either,
so a document-edge slice is asked what a caller without the parameter asks.
`REFINE_CACHE_VERSION` moves to 2
for the documented reason that it moves when the probe's question moves.

DELIBERATE COST:
the next resume rebuys refinement for every cached entry.

### Gate

Written first and proven able to fail,
per GFP.
`refine-window-threading.unit.test.ts` run against the pre-fix build
failed with `expected '' to include 'ZQPREVSRC'`,
an empty window half,
which is the defect itself;
its lone-slice control passed in the same run,
so the assertion discriminates rather than always failing.
Both pass after the rebuild.

Suite 532 PASS / 0 FAIL / exit 0,
up one suite from the 531 baseline for the new file.
`lint` 0 warnings 0 errors,
`lint:types` exit 0.

Two lint findings during the work were both mine and both fixed:
an inserted block had landed between the key's TSDoc and its declaration,
and the test accumulated offsets with a spreading `reduce`.
The offsets are now found by searching the assembled document for each unique paragraph,
which cannot disagree with the text it describes the way a parallel running total can.

## 2026-08-23: one duplication reported as 866 findings, now reported as one

`#183`,
closed.
Commit `b0295583c`.

`assembly-repetition.ts` grows repeats from fixed-length windows,
longest first,
and suppresses any phrase contained in one already reported.
That rule handles shorter-inside-longer and nothing else.
Growth stops at twelve words,
so a passage longer than that spans many windows of exactly twelve,
none of which contains another,
so none suppresses any other.

### What the reporting shape was costing

Measured on `Zha_Ke` in `vub171-20260822`:
one duplicated span of about 877 words arriving as 866 findings.
That was 866 of the corpus-wide 947,
so any rate,
trend or threshold read off `introduced-repetition`
described one slice of one entry rather than the corpus.

### The rule, and why it is about occurrences rather than adjacency

Two windows are one passage when the second occurs
in exactly the places the first does,
each advanced by one word.
Adjacency alone is not evidence:
two unrelated repeated passages can abut,
and merging them would report a span the document never said.
Two unrelated repeats do not repeat in the same places,
so the occurrence test cannot join them.

### Two findings the tests turned up that the plan had not

Both were found by a test failing,
not by reading the code.

A PASSAGE SAID THREE OR MORE TIMES MAKES A SECOND ARTIFACT.
In `P P P` the join between copies occurs twice,
so the tail of one copy followed by the head of the next is itself a repeat.
Suppressing it needs the covered ranges merged into a union:
the join straddles the seam between two adjacent ranges
and is contained in neither alone.
The first attempt tested containment against single ranges and did nothing.

SUPPRESSING SUCH A SPAN OUTRIGHT TURNS ONE FINDING INTO ELEVEN.
Its pieces reappear at every shorter length,
because the containment rule can only suppress against a span it was given.
So what SUPPRESSES and what is REPORTED are two different lists.
Every span suppresses;
only spans no earlier span accounts for become findings.
That is now explicit in the code as `covering` beside `found`,
and in the returned `GrownSpan.accountedFor`.

### The re-measurement, with a positive control

Run over the same stored artifacts with the pre-fix code and then the fixed code.

The pre-fix code reproduced the recorded counts exactly,
866,
73 and 6,
which is the control:
without it a lower number afterwards would not have been evidence,
since the harness might simply have been measuring something else.

    vub171-20260822       Zha_Ke  866 -> 2
    vub-run1-20260821     Zha_Ke   73 -> 53
    readable-20260820     Zha_Ke    6 -> 6
    win107-adj-20260820   lintong   1 -> 1
    win107-panel-20260820 lintong   1 -> 1
    corpus-wide total             947 -> 63

CORRECTING THE FIRST CORRECTION MADE IN THIS SECTION,
which was wrong the other way.
That pass scanned three hardcoded run directories,
reported 945 -> 61,
and called the recorded 947 an overcount.
947 was right for the corpus;
only its per-directory split was not.
`readable-20260820` holds 6 rather than 8,
and the two unaccounted findings are one apiece
in `win107-adj-20260820` and `win107-panel-20260820`,
both on `lintong`.
Rescanned over every directory under the scratch root,
22 of which hold artifacts,
the corpus-wide figure is 947 -> 63.

Neither `lintong` finding moves,
for the same reason `readable-20260820` does not:
a lone repeat has nothing to merge with.
The fix only ever collapses a run of windows over one passage,
so a corpus with no runaway in it reads the same before and after,
which is itself the check that the change is narrow.

63 is the number to carry forward.
It describes the corpus rather than the reporting shape.
`readable-20260820` is unchanged because all six of its repeats
are shorter than the window,
so nothing merges;
`vub-run1-20260821` falls by a fifth,
which is real merging
on top of genuinely distinct short repeats.

### On exporting internals

The barrel had been withholding `wordsOf` and `countPhrases`
with a comment arguing that a barrel decides what is public.
The owner overruled that during this work:
export them and mark `@internal`.
Done,
and the new span helpers follow the same rule,
which is what let the span module get direct tests
against the built bundle the way everything else here is tested.
`@internal` is a MODIFIER tag and takes no content;
the explanation goes in prose above it.

## #184: why no runaway guard saw a 185x emission

### The classification: a gap, not a regression

Both #119 and #120 are DONE and neither regressed.
Every guard they built is structurally unable to reach this event,
for three independent reasons,
each measured rather than read off the code.

FIRST,
LENGTH.
Both repetition detectors are gated behind `MIN_CHARS_FOR_VERDICT`,
which is `MIN_WINDOWS_FOR_VERDICT * WINDOW_STRIDE`,
131072 characters.
The volume bound from #156 is 32000.
The emission was 10381 characters:
7.9 percent of the repetition bar and 32.4 percent of the volume cap.
No guard could form a verdict at all.

SECOND,
SHAPE.
The guards detect a loop,
and this is not a loop.
It is one span of 5032 characters said exactly twice,
at offsets 135 and 5188,
covering 48.5 percent of the emission,
and then the generation stopped on its own.
Every detector rests on the premise stated in `stream-recurrence-watch.ts`:
"a genuine loop never stops,
so it always crosses the bar eventually."
This one stopped.

THIRD,
PHASE,
and this is the finding worth keeping.
The ratio detector samples 64-character windows on a 32-character grid.
The duplication's period is 5053,
which is not a multiple of 32,
so the two copies never land on the same grid offsets.
Measured on the real emission:

    stride 32, the detector's own grid   323 windows, distinct 1.0000, none seen twice
    stride  1, every offset            10318 windows, distinct 0.5184, 4969 seen twice

The duplication is plainly there at stride 1 and perfectly invisible at stride 32.
Lowering the length bar would not have helped:
the detector would still have called this text healthy at any length,
because on its own sampling grid the text genuinely never repeats.

The recurrence detector misses it for a related reason of its own.
Its comment guarantees a sliding search only for periods up to 2048,
the room left in the buffer,
and its decision record accepts
"any period shorter than the buffer", 4096.
The [1024,
3072] interval in the same comment bounds something else:
the LENGTH of a back-to-back duplicated block that can produce hits.
A period of 5053 is past all three numbers,
so the earlier copy has scrolled out of the buffer before the later one arrives.

### How the probe was validated before any of that was believed

The first run reported "neither detector fires" and the positive control ALSO failed,
which under QPC means the run said nothing at all.
Two controls were added before any conclusion was drawn:
a tight loop,
which flags by recurrence at exactly 131072 characters,
and varied prose,
which stays healthy at 1173015 characters.
Only then did the null on the real text become evidence.

A second null was caught the same way.
`countPhrases` was called with `phraseWords` where the parameter is `length`,
and returned an empty map for every input,
including the document
already known to carry 871 repeated phrases.
Zero everywhere is a harness result,
not a measurement.

### One hypothesis raised and refuted

The word instrument sees the duplication clearly:
1800 words,
918 distinct 12-word phrases,
871 of them repeated.
The obvious explanation was that the two copies differ in whitespace,
so words match while characters do not.
Flattening every whitespace run to one space and re-measuring refutes it:
distinct stays at 1.0000 and no period appears.
The cause is phase,
not whitespace.

### The seam the fix needs already exists and is deliberately unused

`watchRunaway` accepts `contentCap`,
defaulted to `CONTENT_OVERRUN_CAP`.
Nothing in the pipeline passes one.
`stream-drain.ts` says so in as many words,
and gives the reason:
threading it "would mean a parameter through this function and every caller,
and the measurement says one bound clears every role by more than twice."

That rationale answers a different question than the one #184 asks.
It is about whether a ROLE that legitimately emits more should raise its own bound.
It is not about a bound relative to the SOURCE,
which is the only kind that can tell a long legitimate passage
from a 56-character line that produced 10381.

### What that settles of the four questions the task said to answer first

MID-STREAM OR AFTER:
mid-stream,
and the mechanism is already there.
The watch already counts produced characters per channel
and already accepts a per-call bound,
so a producer that knows its source length
can pass `sourceChars * limit` and nothing on the retry path changes.
That matters because #120 found six defects in the retry layer,
and this shape does not touch it.

WHAT RATIO:
`sliceImplausibility` already answers this and is already tested.
`IMPLAUSIBLE_MAX_RATIO` is 10,
the largest legitimate observed was 9.27,
and this emission is 185.4,
past the endpoint by more than eighteen times.
The predicate compares `targetChars / sourceChars` on the original,
which is exactly the comparison a producer-side bound needs.

STILL OPEN:
what happens after refusal,
and whether the multiplier
used for a live bound should equal the endpoint used for a settled judgment.
A live bound cuts a call that might still have recovered,
while the settled predicate judges finished text,
so they need not be the same number.

### The census that sets the bound

Measured over every artifact in all 22 run directories:
947 candidate emissions,
772 of them freshly produced,
each against `alignment.sourceCodePoints`,
which is the denominator a live guard has at call time.
The repair lane's slices carry no alignment record,
so this covers the translate lane only.

BY SOURCE LENGTH,
the tail is entirely a short-source effect:

    source   0..64    n=340  p50 3.31  p90 19.24  max 270.02
    source  64..128   n=379  p50 3.17  p90  4.70  max  96.13
    source 128..256   n=185  p50 2.92  p90  3.81  max  17.63
    source 256..1024  n= 43  p50 3.75  p90  4.09  max   4.36

The median barely moves,
2.92 to 3.75 across every bucket:
a correct translation is about three times its Chinese source at any length.
Only the tail moves,
and only where the denominator is small enough
for one runaway to produce an enormous quotient.

THE LEGITIMATE MAXIMUM,
taken as the largest ratio the judges actually SELECTED,
because a candidate that lost is not evidence of a legitimate size.
Among 144 shipped fresh emissions:

    270.0x  source  41  produced 11071   vub171-20260822/Zha_Ke c1
    183.2x  source  56  produced 10259   vub171-20260822/Zha_Ke c2
    136.0x  source  41  produced  5576   readable-20260820/Zha_Ke c1
    135.6x  source  41  produced  5559   vub-run1-20260821/Zha_Ke c1
     99.8x  source  56  produced  5591   vub-run1-20260821/Zha_Ke c2
     98.2x  source  56  produced  5497   readable-20260820/Zha_Ke c2
      9.4x  source 232  produced  2170   163b-verify/dogesir_ c2
      5.2x  source  64  produced   335   vub-run1-20260821/Acheron c1

Six runaways,
then a full order of magnitude of empty space,
then everything else.
The largest legitimate shipped ratio is 9.4,
which independently corroborates the 9.27 recorded in `contest-size-note.ts`
from a different census over 11 settled artifacts.
Two measurements taken different ways agree on where legitimate output stops.

### What bound that supports

Scored as `produced > max(floor, source * K)` against the shipped fresh emissions:

    floor  512  K  8   cuts 7 of 144 shipped,  44 of 772 produced
    floor  512  K 12   cuts 6 of 144 shipped,  43 of 772 produced
    floor 1024  K 16   cuts 6 of 144 shipped,  39 of 772 produced
    floor 1024  K 24   cuts 6 of 144 shipped,  32 of 772 produced
    floor 2048  K 16   cuts 6 of 144 shipped,  36 of 772 produced

Every setting from K 12 to K 24 cuts the same six,
and those six are the runaways.
The bound is insensitive across that whole range,
which is the same flat-tail argument `MAX_INCUMBENT_TO_SOURCE_RATIO` was set on.

CHOSEN:
floor 1024,
K 16.
K 16 because the codebase already carries 16 for the sibling incumbent-to-source ratio,
so the pipeline holds one number rather than two that mean nearly the same thing.
It sits above the settled endpoint of 10 on purpose:
a live cut ends a call that might still have recovered,
while `sliceImplausibility` judges text that is already finished,
so the live bound must be the looser of the two.
Floor 1024 keeps the bound away from short sources,
where three times a 22-character heading is 66 characters
and any proportional bound would be far too tight to be safe.

At that setting the recorded event is cut at 1024 characters rather than 10259,
which is where the saving is.

### Three ratio instruments already exist, and none watches production

    MAX_INCUMBENT_TO_SOURCE_RATIO  16     incumbent vs source, guards PAIRING, runs after the stage
    IMPLAUSIBLE_MAX_RATIO          10     target vs source, judges SETTLED text for the size note
    CONTENT_OVERRUN_CAP            32000  absolute, live, per call

The missing one is produced against source,
live,
per call.
That is what #184 adds,
and the three neighbours are what calibrate it.

### What happens after a refusal, settled by what already happens

No new policy is needed.
`stage-round.ts` turns any stream error into `voice: { heard: false }`,
a silence recorded for that model,
and the ensemble absorbs it.
An overrun is already handled this way,
so a source-relative cut costs the offending model its candidate for that slice and nothing else.
#88's hand-back is a different level:
it covers a slice the whole stage returned invalid,
not one voice among several.

### The fix, and where it was threaded

`produced-volume-bound.ts` holds the bound and what it rests on.
The translate producer computes `producedVolumeBound({ sourceChars })` for each slice
and hands it to the call as `maxAnswerChars`.

THREADED ALONG THE PATH `exchangeTimeoutMs` ALREADY TRAVELS,
which is what keeps this small and keeps it away from the retry layer:
producer,
`stage-quorum`,
`stage-round`,
`stage-call`,
the client,
the transport,
the drain.
Optional at every hop,
so a caller that knows nothing about its input size
is policed at the module default exactly as before.
Nothing on the retry path changed,
which matters because #120 found six defects there.

The `stream-drain.ts` comment that explained why nothing passed a bound
is rewritten in the same commit,
so the code no longer contradicts its own record.

### What the tests prove, and how they could fail

Both controls ride in one run over the same fixture:
an 8192-character answer,
well under the 32000 default so only a per-call bound can end it.

    with maxAnswerChars 2048   overrun at 2210 content chars, 4608 raw chars pulled
    with no bound named        completed, 8590 content chars, 17522 raw chars pulled

The bounded call ends having pulled a quarter of the bytes,
and the unbounded one drains the identical fixture whole,
so the refusal is the bound doing the work rather than anything about the fixture.
That case proves the LAST hop and no other.
It hands `maxAnswerChars` straight to `drainBody`,
so it says nothing about whether the producer computes a bound,
nor whether the hops between forward one.
A sentence claiming otherwise stood here and was wrong.
`#185` built the test that earns the claim
and recorded which hops each test actually pins.

GATE:
suite 536 PASS / 0 FAIL / exit 0,
`lint` 0 warnings 0 errors,
`lint:types` exit 0.

### What this does not cover

The repair lane.
Its slices carry no alignment record,
so the census could not measure a produced-to-incumbent ratio for it
and no bound is passed on its calls.
Every observed runaway was in the translate lane,
so this is a scope statement rather than a known gap,
but a repair-lane runaway would still be policed only by the absolute default.
