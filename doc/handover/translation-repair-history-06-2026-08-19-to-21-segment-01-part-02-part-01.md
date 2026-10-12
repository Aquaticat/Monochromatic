# Translation repair history: segment 1.2, part 01

Part 01 of [Translation repair history: segment 1.2](translation-repair-history-06-2026-08-19-to-21-segment-01-part-02.md),
whose index lists every part in order.

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

WORTH PROMOTING INTO THE PACKAGE as a driver-level test,
since it covers the threading no
builder test can.
Source work,
so it waits for the run.

### EARLY: the window is costing critic voices, and TWO of my explanations were wrong

Read 23 minutes into the verify,
on the first entry.
The observation is solid;
the cause is
not established,
and this section records both the falsified explanations rather than only
the surviving question,
because each was committed here before it was measured.

#### The observation

```text
GLaDOSister   baseline heard   new heard   baseline claims   new claims
chunk 0       6 of 6           6 of 6      4                 0
chunk 1       6 of 6           5 of 6      30                17
chunk 2       6 of 6           3 of 6      16                10
```

The baseline heard SIX OF SIX on every chunk of this entry.
The windowed run has dropped to
three.
Four critics were abandoned,
across four different models:

```text
critic <model>: abandoned 180000ms after quorum (cut-mid-reply after N delivered chars)
```

CLAIM COUNTS FALLING IS THEREFORE UNREADABLE AS IT STANDS.
Gate E watched for claim
INFLATION and claims went the other way,
but a stage that heard half its roster raises fewer
claims whatever it was shown.
Nothing yet separates "better-informed critics complain less"
from "fewer critics answered".

#### Not the sheet size

"The window roughly triples the sheet" was an estimate carried in and never measured.
Measured:

```text
critic sheet, no window   10485 chars
critic sheet, windowed    11997 chars     1.14x
of which fixed system prompt  9823
the varying half            662 -> 2174   3.28x
```

The varying half does triple;
it is small against a system prompt that dominates,
so the
whole prompt grows FOURTEEN PERCENT.
That cannot explain a reply still arriving when the
straggler window closes.

#### Not runaway generation either

The second explanation was that critics were echoing the two nearby blocks and running away,
which would fit "2,535,524 delivered chars".
It does not survive the conversion.

DELIVERED CHARS ARE RAW STREAM BYTES,
not produced text.
Over 110 completed streams in this
same run the raw-to-produced ratio has median 413:

```text
GLM-5.2         2535524 raw  ~=  6141 produced
GLM-4.7-Flash   1718876 raw  ~=  4163 produced
Nemotron         813057 raw  ~=  1969 produced
Qwen             260739 raw  ~=   632 produced
```

Those are ORDINARY REPLY SIZES.
In the same run GLM-5.2 COMPLETED a reply of 50,572 produced
characters,
eight times the largest abandoned one.
A model producing 6,141 characters is not
running away.

THE CONVERSION IS ROUGH AND SAYS SO:
the ratio spreads from 28 to 93,910 with p90 at 3,290,
so these are order-of-magnitude figures.
They are wide enough to rule out runaway and not
tight enough to rank the four against each other.

#### The matched baseline exists, and it SHRINKS the anomaly

`~/temp/agent/flagged-pass-2.log` covers exactly these five entries under the same rosters,
so it is the matched baseline.
Read properly it makes the signal much weaker than the first
reading of it here claimed.

```text
                        stages   abandoned   rate     stream retries
baseline (5 entries)       115          15   13.0%                52
this run (so far)           11           4   36.4%                 0
```

```text
critic stage, roster 6      stages   short   min heard
baseline                        42       3           5
this run                         5       2           3
```

THE 0.13 PERCENT BASE RATE PREVIOUSLY RECORDED HERE WAS WRONG and is withdrawn.
It came from
pooling all 242 logs in the agent scratch,
most of which are unit-test runs with small
rosters and no real fan-out.
Against the matched baseline the real figure is 13 percent of
stages,
a hundred times higher,
and 36 percent against it is elevated rather than
extraordinary.
At a 13 percent base rate,
four abandonments in eleven stages is roughly a one
in fifteen outcome:
uncommon,
not remarkable.

WHAT STILL STANDS is narrower and worth keeping:
the baseline's critic stage never went
below FIVE of six across 42 stages,
and this run reached THREE of six.
That single value is
outside the baseline's observed range.
One observation.

TWO THINGS ARGUE AGAINST THE WINDOW as the cause,
and both were missed on the first pass:

-   THE PANEL IS WINDOWED TOO and is clean:
    3 stages,
    none short,
    minimum six of six.
    If
    carrying two extra passages degraded a six-model fan-out,
    the panel should show it as
    well.
    It does not,
    though three stages is little to conclude from
-   STREAM RETRIES ARE ZERO this run against 52 in the baseline.
    Whatever else is true,
    the
    provider is not obviously having a worse night than it had on 08-18

AND ONE READING WAS SIMPLY AN ARTEFACT:
`checker` and `probe` report a minimum heard of 3 in
both runs,
which looked like degradation next to the critic's 6 until the denominators were
checked.
Their roster IS three,
so three of three is a full house.

#### Two more readings, and both say the window is behaving

CLAIMS PER STAGE ARE UNCHANGED,
which is the null that matters most:

```text
              critic stages   claims raised   claims per stage
baseline                 42             429              10.21
this run                  5              51              10.20
```

Identical to two decimal places.
Whatever the window is doing to the roster,
it is not
changing how much critics find per stage.

ANCHORING DISCARDS ARE DOWN,
NOT UP,
which refutes the pre-registered worry directly.
The
expectation was that critics would quote from the NEARBY blocks,
that those claims would die
at anchoring because a quote from next door cannot anchor here,
and that the discard count
would spike:

```text
              claims raised   unanchored   rate
baseline                429           39   9.1%
this run                 51            3   5.9%
```

It did not spike.
On five stages that is weak,
but it is weak in the direction of the window
being harmless rather than in the direction of the worry.

#### Where this leaves the alarm, honestly

Raised loudly,
then dismantled by better measurement,
three times.
What survives is ONE
critic stage at three of six,
a value the matched baseline never produced in 42 stages.
Everything else that looked like corroboration has evaporated:

-   sheet size:
    1.14x,
    not 3x
-   runaway generation:
    abandoned replies convert to ordinary sizes,
    and a much larger reply
    completed in the same run
-   an extraordinary base rate:
    withdrawn,
    the matched baseline abandons 13 percent of stages
-   generic windowing damage:
    the panel is windowed too and is clean
-   provider having a bad night:
    stream retries are 0 against 52
-   critics quoting the neighbours:
    anchoring discards went down
-   claims suppressed:
    claims per stage identical to two decimals

THE RIGHT POSTURE IS TO FINISH THE RUN AND READ THE GATES.
The remaining four entries will
produce roughly forty more critic stages,
which is the sample that decides whether one 3-of-6
was a burst.
Nothing should change in the pipeline before then,
and the reason is now on the
record:
six of the seven things that would have justified a change turned out not to be true.

#### What is left, and it is a question rather than an answer

The abandoned replies were simply still arriving when the 180-second straggler window closed
after quorum,
which is the behaviour `#121` designed.
Whether the window made replies slower,
or this is ordinary run-to-run variance against a baseline that is itself one sample,
is not
established and cannot be from one entry.
`QNB` applies:
the run-to-run band was never
measured for heard-count,
so a single-run difference resolves nothing on its own.

WHAT WOULD SETTLE IT,
in preference order:

-   the remaining four entries of this verify.
    If heard-counts stay depressed across all
    five,
    variance is a poor explanation
-   MORE OF THE SAME COMPARISON.
    The matched baseline above is already read;
    what it cannot
    do is separate the window from run-to-run drift in the provider between 08-18 and today
-   a heard-count band measured over repeated runs of ONE unchanged entry,
    which is the only
    thing that makes a single-run comparison meaningful

WHAT NOT TO DO YET:
change the deadline,
change the straggler window,
or gate the window to
flagged slices.
All three are responses to a cause that has not been established,
and two of
the three would have been adopted on explanations that turned out to be false.

### The separate-worktree escape hatch does not work cheaply, so code work really is blocked

Tried 2026-08-19 while the verify ran,
because "do code work in another worktree" had been
floated as the way to keep moving without touching the running pool's digest.

`git worktree add --detach` succeeds instantly and the tree is correct,
but it carries no
`node_modules`,
at the root or in the package,
so `mise run //package/module/translation-repair:build`
there needs a full workspace install first.
It was still going after two minutes and was
stopped.
The reasoning behind the idea holds:
a build in another worktree cannot move the
running worktree's `dist/final/node`,
and the main tree's `dist` timestamp was unchanged
afterwards.
It is the setup cost that makes it not worth it for a short wait.

SO CODE WORK IS GENUINELY BLOCKED until the run finishes,
rather than blocked by caution.
What front-loads well instead,
and did:

-   prepare the patch as a script that applies later,
    as `~/temp/agent/apply-126-key-labels.mjs` does
-   validate the instruments that will read the results,
    in BOTH directions
-   do the read-only audits,
    which need no build at all

The worktree was removed with `git worktree remove --force` and the running verify was
confirmed healthy immediately after.

ONE TRAP WORTH REPEATING,
since it fired twice today:
`pgrep --full '<pattern>'` matches its
OWN command line,
so a check for processes under `wt-126` reports the pgrep itself.
Anchor
the pattern to the binary,
as in `pgrep --full '^node .*corpus-pass\.mjs'`.

## SCOPE CORRECTION 2026-08-20: there is no full corpus pass, ever

Owner instruction,
verbatim:
"We don't need 'the full 92-entry pass',
ever."

READ THIS BEFORE PLANNING ANY RUN.
Several sections above size their work against a
corpus-wide pass and treat it as the thing standing between the pipeline and the release.
It
is not,
and it never was:
the deliverable is THE PIPELINE PACKAGE,
and "production ready for
at least this corpus" means the pipeline handles the corpus rather than that the corpus gets
processed end to end.

WHAT THAT DELETES from the plan:
about four days of wall clock that sat on the critical path,
the sharding question,
the argument about measuring a superseded pipeline,
and the pressure
that made an eight-hour verify feel cheap by comparison.

THE RULE THAT REPLACES IT:
SIZE THE RUN TO THE QUESTION.
A pipeline change is validated on
the entries that can actually show it,
and no others.

`#107`'s window is the worked example.
Its two concrete pieces of damage live in two entries,
`lintong` for the duplicated farewell and `saurikissa` for the severed sentence,
so its
validation is those TWO entries and roughly two hours.
The five-entry version was sized by
the flag list rather than by the question,
and the extra three would have bought a slightly
wider replacement-rate reading for six more hours.

### What this cost before the instruction arrived

One 92-entry launch,
killed after four minutes with zero settled artifacts.
One five-entry
verify,
killed after forty minutes with zero settled artifacts.
Both stops were right on
their own reasoning at the time,
so the waste is about forty minutes of one entry.

### What is running now

`--only lintong,saurikissa` into `~/temp/agent/win107-min-20260820`,
on the build carrying
`#126`'s key fix,
detached.
Gates read with
`node ~/temp/agent/window-gates.mjs --new ~/temp/agent/win107-min-20260820/artifacts`.

`#126` LANDED FIRST AND ON PURPOSE,
which is the one piece of sequencing that still mattered
under the new scope:
it re-keys every windowed slice,
so any run started before it would have
had its slice cache invalidated the moment it landed.

## The damage instruments now see past one slice

Three changes landed 2026-08-20,
all from `#66`,
and the ordering among them is the finding
rather than a preference.

```text
assembly-repetition.ts      NEW    document-scale repetition, no model and no quota
repair-assemble.ts          wired  emits the finding where the footnote guard runs
translate-assemble.ts       wired  same, because the check found damage in that lane too
introduced-defect-wire.ts   window the probe now sees the neighbours, fence included
introduced-defect-probe.ts  window forwards them
repair-chunk.ts             window one windowFragment now feeds four stages
```

WHY REPETITION IS CHECKED AT ASSEMBLY and not inside a stage:
`repair-assemble.ts` already
carries the argument in its own words,
for footnotes.
"A footnote is a relation BETWEEN
slices,
and every stage works inside one,
so this is the only layer that can see it."
Repetition is the same shape,
which is why `#66` found the probe structurally unable to
report `lintong`'s duplication however it was tuned.

THE ARCHIVE IS WHAT MAKES IT DECIDABLE,
and `#128` put it in the artifact hours earlier.
A phrase the archive says once and the shipped document says twice is a repetition this
pipeline added.
Counting against the archive rather than against a rule about prose inherits
the author's own judgement about acceptable repetition,
so refrains and repeated names never
fire.

BOTH LANES,
and that was not the plan.
The damage was found in `lintong`'s REPAIR lane,
and
running the check over the settled pool immediately produced one finding in `saurikissa`'s
translate lane and one in `dogesir_`'s,
where the archive never carried the wording at all and
the document says it twice.
Writing a slice from its source rather than editing an incumbent
does not stop a lane repeating itself.

### What is verified, and what is only predicted

VERIFIED:
the function,
by six cases including the three it must NOT fire on.
That the call
ships in the same built chunk as the assembler.

CORRECTED 2026-08-19,
and the correction is the important part:
the sentence that used to
stand here claimed the check "reproduces both the known `lintong` duplication and the known
lane split" on real data.
It does not,
and the reading that produced that claim was made
against a RECONSTRUCTED archive rather than the real one.
See
`doc/audit/an-archive-rebuilt-from-the-ledger-is-not-the-archive.md`.

NOT VERIFIED:
that a finding actually lands in an artifact written by a live run.
The unit
tests cover the function and the dist check covers the call's presence,
but neither is an
artifact carrying `introduced-repetition`.

THE CHECKABLE PREDICTION,
RE-RECORDED 2026-08-19 because the first wording was unsound.
It
said the next run settling `lintong` MUST produce a repair-lane `introduced-repetition`,
and
that rested on the belief that the archive says the duplicated phrase once.
The archive says
it twice,
so a `lintong` artifact carrying NO finding is now the expected good outcome,
and
the old wording would have told the next reader to call a healthy run broken wiring.

The sound test is a CONSISTENCY test,
and it needs no prediction about the corpus at all.
Run `findIntroducedRepetitions` offline over the artifact's OWN `archiveText` and assembled
text,
then compare against the findings the artifact recorded:

```text
offline fires, artifact records it        wiring is good
offline fires, artifact silent            WIRING IS BROKEN
offline silent, artifact silent           consistent, and says nothing about wiring
offline silent, artifact records one      the shipped path sees something offline cannot
```

Only the second row is a defect.
Reading the third as one is the mistake the first wording
would have caused.

### A trap hit twice in one session

Inserting a new declaration between an existing TSDoc block and the declaration it documents
orphans the doc,
and `tsdoc(require-tsdoc)` then reports the ORIGINAL declaration as
undocumented,
which reads like an unrelated regression.
It happened in
`artifact-v2-read-contract.ts` and again in `introduced-defect-wire.ts`.
Put a new constant
ABOVE the whole doc-plus-declaration pair,
never between them.

## `saurikissa` settled under the window, and the repair lane got much quieter

First entry of the minimal validation,
settled 2026-08-20 at 01:51Z after 102 minutes.
The roster is identical on both sides,
11 critic stages and 65 critic voices heard,
so none
of what follows is a voice-loss artefact.

```text
saurikissa repair lane      baseline    new
critic claims raised              94     83
issues surviving adjudication     43     48
issues RESOLVED                   23      6
slices shipped                     9      3
```

```text
repair shipped slices   baseline  1,2,3,4,5,7,8,9,10
                        new       1,2,5
translate shipped       baseline  1,2,3,5,6,7,8,9
                        new       1,2,3,5,6,7,8,9,10
```

THE TRANSLATE LANE IS UNMOVED,
which is the control:
the window was wired into the repair
lane only,
and the translate lane shipped 8 slices before and 9 now.

### Gate B is NOT the clean pass it first reads as

The severed-sentence census returns 0 of 3 repair rows,
against 1 of 30 in the baseline pool.
That looks like the defect is fixed.
It is not evidence of that.

THE SEVERED SENTENCE WAS AT SLICE 7,
AND SLICE 7 IS NO LONGER EDITED.
The baseline shipped a
repair there;
this run does not.
So the census reads zero because the lane declined to touch
the slice,
not because it edited it without severing anything.
A gate that cannot tell those
apart has not cleared the defect.

WHICH IS NOT NOTHING,
and may be the point.
Slice 7 is unflagged but sits beside the flagged
run at 8 and 9,
and `#107` recorded that its shipped text carried three passages belonging to
neighbouring slices.
A lane shown its neighbours declining to edit exactly there is the
behaviour the window was built to produce.
But "declined to edit" and "edited safely" are
different claims and only the first is evidenced.

### The number that needs a decision: resolved fell 23 to 6

More issues now survive adjudication,
43 to 48,
and far fewer are resolved,
23 to 6,
with
slices shipped falling 9 to 3.
Two readings fit and this entry cannot separate them:

-   THE LANE STOPPED MAKING EDITS IT COULD NOT JUSTIFY.
    The editor sheet now forbids removing
    wording on the grounds that a neighbour ought to carry it,
    and much of what it used to
    "resolve" at relocation-adjacent slices was exactly that.
    Fewer and safer changes.
-   THE LANE LOST REAL REPAIR CAPACITY,
    failing to fix seventeen issues it previously fixed.

WHAT WOULD SEPARATE THEM:
read the 17 issues resolved in the baseline and not now,
and ask
whether their baseline repairs were improvements or damage.
That is a reading of two settled
artifacts and needs no further quota.
It is the next thing to do and it is not done.

DO NOT TUNE THE WINDOW ON THIS.
One entry,
and the two readings have opposite remedies.

## What the 17 lost resolutions were, and what the re-run should do to them

Owed since `saurikissa` settled under the window,
and done now,
before the re-run settles,
so the reading is a prediction rather than a rationalisation.

Zero quota:
two settled artifacts.
No corpus text:
categories,
severities,
slice indices and counts only.
Note that `quote-not-found` findings carry the NEEDLE,
which is corpus text,
so they can be counted but never quoted into a document.

### What was lost

```text
resolved issues            baseline 23   window 6

by category
  accuracy/addition               10 ->  0
  accuracy/omission                8 ->  4
  accuracy/non-translation         4 ->  1
  accuracy/mistranslation          2 ->  0
  style/register                   1 ->  0
  extension/interpretive-ambiguity 1 ->  0
  fluency/grammar                  1 ->  1

by severity
  critical  5 -> 1      major  9 -> 1      minor  9 -> 4

by slice
  1: 5->4   2: 3->1   3: 1->0   4: 5->0   5: 1->1
  7: 2->0   8: 2->0   9: 2->0  10: 2->0
```

THE WHOLE TAIL STOPPED BEING REPAIRED.
Slices 7 through 10 resolved eight issues between them in the baseline and none under the
window.

### The mechanism, localised

Claims were still raised at a similar rate,
94 against 83,
so the critics did not go quiet.
What changed is what happened to a claim after it was raised:

```text
                no-region      not-selected    shipped
TOTAL           16 -> 37        1 -> 4         26 -> 7

slice 8          2 -> 14        0 -> 0          2 -> 0
slice 4          4 ->  7        0 -> 0          5 -> 0
slice 3          0 ->  4        0 -> 1          1 -> 0
```

Slice 8 alone accounts for twelve of the twenty-one added `no-region` issues,
and its critics raised MORE claims under the window,
fourteen against eighteen.
More to say and nowhere to put it is the signature of a critic quoting the nearby blocks:
a quote copied from next door cannot be located in the passage under review,
so the claim is discarded whole and the issue gets no region.
That is what `afc7854b4` forbids.

### What the re-run should show, recorded in advance

The fixed build forbids quoting the nearby blocks while keeping the window itself.
Three outcomes,
each meaning something different:

```text
no-region stays near 37            the quote rule did not take; cause is NOT anchoring
no-region falls toward 16 AND
  additions return to about 10     the window buys nothing for additions; reconsider #107
no-region falls AND additions
  return only part of the way      the window works and the hole was anchoring
```

The third is what the fix predicts.
`accuracy/addition` is the class the window exists for:
wording that looks added here
because it belongs to a neighbouring passage.
Suppressing SOME addition claims is the window doing its job.
Suppressing all ten,
alongside a collapse in every other category,
is the anchoring failure
dragging them down with it.

ONE STOCHASTIC RUN PER ARM,
so read direction and magnitude,
never a single number.
A rerun that moves `no-region` from 37 to 30 has not shown much;
one that returns it near 16 has.
