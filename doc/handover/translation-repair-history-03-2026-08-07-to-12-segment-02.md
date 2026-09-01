# Translation repair history: 2026-08-07 to 2026-08-12, segment 2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

### What this does NOT establish

That Kimi-K3 is permanently broken.
Two passes is two points,
and one of them is the only one showing the problem.
The next pass decides whether this is a provider window or a standing condition,
 and the refiner and editor lines are now the place to read it.
Do not change the roster before that,
and do not change it unasked:
 round three already carries an accepted attribution cost for changing the
 roster,
the editor,
the checker set and the lane at once.
Task #64 holds the decision.

## Task 51 is measured: recall on the current roster is 0.889

```text
SCORECARD dispatched=9 coverage=1.000 planted=27 detected=24 detectionRate=0.889
REPAIR judged=27 restored=23 partial=1 strict=0.852 lenient=0.889
```

From the scorecard JSON,
which the driver was not printing:
 `policyDeclinedSeeds=0`,
so `seedDetectionRateExcludingPolicy` equals the raw
 rate and all three misses are genuine.
That also removes one stated objection to comparability:
 the handover has said since 2026-08-06 that the house policy makes round-three
 recall non-comparable on that axis,
and on THIS run the policy never fired.

The driver now prints both fields.
Computing an attribution and leaving it in a file nobody opens is the same
 failure as the naturalness lane's:
the number that distinguishes two very
 different situations existed and reached no reader.

### What 0.889 against 0.981 does and does not say

It does NOT say recall regressed.
Two proportions,
24 of 27 against 53 of 54,
give a z of about 1.8,
which is not
 significant at any conventional threshold,
and the Wilson intervals overlap
 across roughly 0.90 to 0.96.
Three misses against one is also a difference of two events,
and this document
 already carries two withdrawn claims built on event counts that small.

The runs are not otherwise matched either:
 different roster (seven models against six),
different entries,
half the seeds,
 and several changed stages between detection and reporting.

What IS supportable:
the configuration running today detects seeded omissions at
 0.889 on this sample,
with no policy declines,
and the milestone-one figure is
 evidence about a configuration that no longer exists.
The README now says exactly that.

### Read this beside task 64

The recall run's own log carries the same refiner failure:
 `refiner hf:moonshotai/Kimi-K3: schema-mismatch, voice lost`,
through all three
 retry rounds,
plus a `restoration-judge` voice lost to the same cause.
So Kimi-K3's schema-mismatch is now observed in a THIRD run,
on a different
 driver,
hours after run 013.
That is no longer comfortably a provider window,
and it is the strongest
 argument yet for the per-stage minimum rather than waiting.
Still the user's call.

### CORRECTION, within the hour: 0.889 was measured on a degraded ensemble

The first version of the entry above,
and of the README paragraph,
presented
 0.889 as the current roster's recall.
It is not,
and the run's own log says so.

```text
recall run   Kimi-K3   312 schema-mismatches
             (refiner 96, critic 76, panel 69, editor 62, restoration-judge 9)
             GLM-5.2     3

critic stage:  72 x 5/6 heard    8 x 3/6 heard    1 x 0/6 heard
panel  stage:  64 x 5/6 heard    4 x 4/6 heard    2 x 3/6 heard
```

The critic stage NEVER reached 6/6 in this run.
One chunk was critiqued by NOBODY.
So the number describes a five-critic ensemble that occasionally fell to three,
 not the six the roster configures.

That is worth having,
because it is what the pipeline actually delivers under
 the condition it is currently in.
It is not worth calling "the current roster's recall",
and both documents now
 say which of the two it is.

TWO FURTHER FACTS,
both from the scorecard rather than inference:

-   All three misses are ONE entry,
    `Chinatsu_Suzuki`,
    which went 0 for 3 while
     the other eight entries went 24 for 24.
    An entry failing wholesale and a rate of 0.889 are different objects,
    and
     only the first is what happened.
-   That entry completed normally,
    `status=repaired` with 19 issues found,
    so
     its critics did run and did report.
    The `0/6` chunk cannot be attributed to it from the log,
    because the recall
     log carries NO per-entry markers.
    Not guessed either way;
     adding an entry marker to that driver would settle it next time.

### What this does to task 64

It removes the provider-window reading.
Kimi-K3 now shows schema-mismatch in THREE runs across two drivers,
rising:
 0 in run 012,
61 in run 013,
312 in the recall run hours later.
Every stage it sits in is affected,
and the two with no meaningful quorum,
the
 editor pair and the single refiner,
are affected worst.
The decision is still the user's,
but it should no longer wait on another pass
 to establish persistence.

## Run 014: the degradation is now the dominant fact about the pipeline

```text
DONE processed=9 of pending=45; artifacts=56/92 elapsed=53396640ms
```

Nine entries settled,
47 to 56,
one deadline casualty (`hulicaijia`).
Good throughput,
and almost none of it under the configuration the roster
 describes.

### Kimi-K3, four runs

```text
run 012        0 schema-mismatches
run 013       61
recall run   312
run 014      507
```

Run 014's critic stage reached its full roster ONCE in 166 chunk-runs
 (158 at 5/6,
5 at 4/6,
2 at 3/6,
1 at 6/6).

### What that has done to the two stages with no real quorum

```text
at 47 entries   editorDegraded=15/322   refineSilent=6/101
at 56 entries   editorDegraded=71/405   refineSilent=34/129
```

So run 014 alone contributed 56 degraded editor chunks and 28 silent refine
 slices.
The naturalness lane has now produced nothing at all for two consecutive passes:
 `entriesWithRewrites` is still 15,
unchanged since run 012 settled.

This is no longer a curiosity to report beside the real numbers.
A majority of the recent corpus was repaired by ONE editor of two,
and the
 milestone-two repair figures were measured when both answered.

### The evidence guard fired, and was right

`score-probe` refused to run at 56 entries:
 an envelope carried disagreeing probe copies.
The guard was correct and the CALLER was wrong.
Envelope ids are derived from the text they cover,
so they are unique within a
 document and not across a corpus,
and `summarizeProbeTelemetry` collapsed on
 the id alone across every artifact.
Two entries containing the same wording produced one id for regions serving
 different issues,
and the guard caught them disagreeing about which.

Measured before fixing,
because "how wrong were the old numbers" is the first
 question a reader will have:
 exactly TWO envelope ids span more than one entry,
and the old global collapse
 lost two regions out of 848.
No figure reported so far was materially wrong.
What the bug did was break the tool outright the first time a colliding pair
 disagreed,
and collisions only get likelier as the corpus grows.

The summary now takes readings grouped by entry and keys on the pair.
A test pins it:
two entries sharing an envelope id count as two regions.

## Round three is GRADED, and the gate is not met

Graded by the user 2026-08-12.

```text
PRECISION items=50 gradeable=43 scored=42 realDefects=34
          strict=0.791 excluded=0.810 lenient=0.814
          duplicates=10,11,13,14,15,29,49 unscored=48
AGREEMENT compared=42 agreed=37 rate=0.881 disagreed=20,23,24,26,41
```

Bar is 0.9.
Across rounds:
0.560/0.636/0.680,
then 0.740/0.787/0.800,
now
 0.791/0.810/0.814.
All three readings improved and none clears the bar.
Full verdict,
with the reasoning,
at
 `node_modules/.monochromatic/translation-repair-runs/gate-verdict-round-three.md`
 (outside git,
as the earlier verdicts are).

### The finding of the round is the sampling instrument, not the number

SEVEN of the 50 drawn items are the same defect as an earlier item.
The user marked them `Duplicate`;
 the agent's blind pre-grades had independently annotated the SAME seven as
 "Same defect as item N".
Two readers,
no sight of each other,
identical set.

As drawn,
that read 0.680/0.810/0.840,
because strict counts a decline as a
 false positive.
So round three's apparent strict REGRESSION from round two was the seven
 duplicates,
not detection getting worse.

User decision,
2026-08-12:
EXCLUDE duplicates from every denominator.
`duplicate` is now its own `GradeVerdict`,
not folded into `unscored`,
because
 the two are declined for opposite reasons:
 unscored is nobody could decide,
duplicate is already decided elsewhere.
Agreement excludes them too;
 counting them charged the agent seven wrong answers for reaching the same
 conclusion by another route.
Verified backward compatible:
rounds one and two reproduce their published
 figures exactly,
`duplicates=none`.

The pipeline emitting one defect as several accepted issues is its own defect
 and is task #65,
which also holds the question of whether a future gate should
 count it.

### Calibration: the agent grader is STRICTER than the user

Five disagreements remain,
and all five run one way:
the agent called a defect
 where the user did not.
Their reasons are one policy,
quoted from the sheet:

```text
20  "on that day here enhances fluency" ... "it is indeed her last plan"
24  "there is no better way to express this in English"
26  "总会 can be often"
41  "context shows they went to the afterlife"
```

Additions and nuance that fluency or surrounding context licenses.
It is the same non-literal-translation policy the critics are taught,
applied
 more tightly by the grader than by the person the gate is defined against.
That is the clearest lead into round four.

TWO ITEMS CHANGED on the user's instruction after being asked about,
and the
 asking is why they changed:
 both were cases where the two readers had answered DIFFERENT PARTS of one
 claim.

-   `38` N to Y:
    the location was context-licensed,
    but "worked away" adds
     employment 当时在外地 does not carry and 事后称 is dropped.
-   `43` Y to N:
    wrongly anchored,
    since 亦没有倾诉对象 is translated elsewhere.

They cancel in the numerator.
The lesson is not the arithmetic,
it is that a
 one-line grade and a multi-part claim can pass each other silently,
and asking
 caught two of five.
The graded sheet keeps both revisions inline,
marked and dated,
beside a
 `.graded-backup.md` of the sheet as first submitted.

## The model was never broken: a two-character prefix cost four runs

Kimi-K3 began emitting a `|>` channel marker in front of its JSON.
The JSON behind it was correct and complete every time.

```text
hf:zai-org/GLM-5.2      ok   {"count": 2, "first": "Mittens"}
hf:zai-org/GLM-4.7-Flash ok  {"count": 2, "first": "Mittens"}
hf:Qwen/Qwen3.6-27B     ok   {"count": 2, "first": "Mittens"}
hf:moonshotai/Kimi-K3   schema-mismatch   |>{"count":2,"first":"Mittens"}
hf:nvidia/...Nemotron   ok   {"count": 2, "first": "Mittens"}
hf:openai/gpt-oss-120b  ok   {"count": 2, "first": "Mittens"}
```

That single prefix produced 0,
then 61,
then 312,
then 507 schema-mismatches
 across four runs,
in every one of the five roles Kimi-K3 holds,
and everything
 attributed to "the degradation" in this document traces to it:
 the editor pair collapsing to one voice on 71 of 405 chunks,
 the naturalness lane silent on 34 of 129 slices,
 run 014's critic stage reaching a full roster once in 166 chunk-runs,
 and task 51's recall measured on an effectively five-critic ensemble.

### Why four runs went by without anyone seeing it

`schema-mismatch, voice lost` is where THREE different faults arrive wearing one
 label:
truncated thinking,
content that is not JSON,
and JSON the guard
 rejected.
`synthetic-client.ts` does distinguish them,
and says which at DEBUG level.
A corpus run records none of that.
So the logs could name the model and the stage and never the cause,
and four
 passes of evidence pointed at a model that was answering correctly.

THE DIAGNOSIS TOOK ONE CALL once the right question was asked.
`mise run //package/module/translation-repair:model-health` asks every roster
 model one trivial structured question and prints the raw reply.
Reach for it FIRST the next time a model looks dead.

### The fix, and what it deliberately does not do

`stripChannelMarker` removes a marker from a known list,
and only when what
 follows opens a JSON value.
A general "skip forward to the first brace" rule would have worked here and
 would also swallow a model that prefixes an apology before refusing,
turning
 content the refusal detector exists to classify into a silent parse success.
Verified live:
the identical call that returned `schema-mismatch` returns `ok`.

### What this does NOT fix

`stage-quorum.ts:154` still computes `Math.ceil(rosterSize / 2)`,
so a two-model
 editor roster still reaches quorum on ONE voice.
That is why one model's trouble could halve the ensemble silently,
and it stays
 true of whichever model has trouble next.
The user chose to widen the editor and refiner rosters and to switch them to
 `full-roster` retry,
but chose it believing Kimi-K3 was dead,
and that choice
 included dropping Kimi-K3 from both stages.
That specific membership change is now wrong.
Re-confirm before acting:
the premise changed,
not necessarily the decision.

## Every fan-out stage now has a quorum one voice cannot meet

Landed 2026-08-12 on the user's rule that the system must not have single-model
 failures.

```text
             before            after
editors      2 (quorum 1)      3 (quorum 2)
refiners     1 (quorum 1)      3 (quorum 2)
checkers     3 (quorum 2)      3 (quorum 2)
retry        quorum            full-roster on editor and refine
```

The arithmetic is the whole point.
`ceil(rosterSize / 2)` is ONE on a roster of two and cannot fail at all on a
 roster of one,
so the old editor pair could ship a repair written by a single
 model while reporting a met quorum.
That is not a bug in the stages;
 it is a quorum rule sized for a six-model critic panel being applied to a pair.

DEVIATION FROM WHAT WAS APPROVED,
recorded rather than buried:
 the option the user chose said refiners two.
Two leaves the quorum at one,
which would not have achieved what the change is
 for,
so refiners are THREE.
One line to revert if that is unwanted.

GLM-4.7-Flash takes the third editor and refiner seat because the constraints
 leave no alternative:
checkers must exclude every editor and refiner,
judges
 need two disinterested seats,
and the other three models hold the checker
 roster.
It is the model that most often loses its voice,
which now argues FOR seating it
 there:
a third editor that sometimes drops still leaves two,
while the same
 model among the checkers would cost proof rather than coverage.

Verified rather than assumed:
 `assertJudgeableEditorRoster` and `assertCheckerIndependence` both pass,
all
 three producing rosters sit at three voices with a quorum of two,
and three
 disinterested judges remain for each.

`pass9-run-001` is running on this configuration,
and is the first pass with
 the channel-marker fix,
the widened rosters,
and full-roster retry all in place.
Read its ROSTER line first:
 `editorDegraded` should collapse toward zero,
and if it does not,
the cause is
 something this session has not found.

## The repair sheet is not gradeable, and the reason is not the sheet

The user stopped before grading it:
"the repairs are currently too broken to
 grade".
Read end to end,
that judgement is correct,
and it is not harsh.

### What reading found

Many repairs ARE competent and surgical.
Items 3,
5,
6,
8,
9,
12,
13,
16,
17 and 18 fix exactly what was claimed and
 touch nothing else.
So the stage is not uniformly broken,
which is what makes the failures worth
 naming precisely rather than dismissing the whole thing.

The failures are two distinct modes.

SCOPE.
Measured:
21 of the 50 drawn edits replace a span more than 1.35 times
 the length of the quoted defect;
 the widest are 12.2x,
5.1x and 4.4x.
Reaching past the defect is where damage enters:

-   `2/7/11/15` asked to remove an unsupported "often shared her insights",
     replaced four lines with one and DELETED the clause about the hi3861 board
     and the Klipper videos,
    which the source does contain.
-   `21` asked to change a full-width colon,
    changed it and deleted `Bilibi - `
     from a contributor credit line.
-   `43` asked about one omitted parenthetical,
    re-translated two sentences and
     invented "in numbered form" and "via private messages".
-   `37` fixed 断断续续 correctly and turned "reminiscing" into "pleading".
-   `20` reordered two sentences and rewrote both.

QUALITY,
which the user raised and which scope does not cover.
Item `1` renders 家庭变故 as "a family misfortune".
That fixes the semantic complaint,
since "discord" wrongly implies conflict,
and
 it is still not English anyone writes:
 变故 is an upheaval or a change in circumstances,
so "upheaval at home" or
 "what happened in her family" is the register.
Item `24` ends at "chose release".
Fixing scope would not fix these.

### The finding that matters more than either

THE PROBE MISSED ALL OF IT.

```text
item  2/7/11/15  deleted a source-supported clause     3/3 probers noneFound
item 21          deleted a contributor's name          3/3 probers noneFound
item 37          "reminiscing" became "pleading"       3/3 probers noneFound
item 20          two sentences reordered and rewritten 3/3 probers noneFound
item 43          re-translation with invented detail   1/3 corroborated
```

`runIntroducedDefectProbe` exists to answer exactly "did this repair break
 something nobody raised".
Across 848 regions it reports 16 majority-introduced,
about 1.9 percent,
and on
 the specific repairs a reader can see are damaged it reported nothing.

That inverts task #60 and the gating decision.
Both defer gating until the probe's FALSE-POSITIVE rate is known,
reasoning that
 a probe blocking correct repairs would discard good work.
The measured behaviour is the opposite problem:
 the probe barely fires,
so its false-NEGATIVE rate is what matters,
and a
 shadow-mode instrument that almost never fires is not a safety net but a source
 of false assurance.
`doc/decision/introduced-defect-probe-gating.md` states a reopening condition
 that is now wrong as written.

The probe is NOT blind in principle:
 `probe-sensitivity` shows it catching injected omission and contradiction at
 3/3.
So the gap is in what it is shown or how it is framed,
not in whether it can
 see.
Item `21` is the sharpest test case available:
deleting a name while
 fixing a colon,
inside a two-line span.

Tracked as #66 (probe false negatives) and #67 (editor scope and quality).
The repair sheet stays UNGRADED on purpose;
 asking for grades against "fixes it and breaks nothing nearby" would spend
 hours to produce a column of N and teach nothing that reading five items did
 not.

## State at the 2026-08-12 compaction

Two user decisions,
both taken after the repair sheet was read:

-   STOP AND RE-PLAN the milestone rather than start the next fix.
    The proposal is `doc/planning/translation-repair-milestone-replan.md`.
    It is a PROPOSAL,
    not a decision,
    and it ends with three open questions the
    user has not answered.
-   `pass9-run-001` LETS RUN,
    and its REPAIRS ARE TO BE DISCARDED.
    Its detection output stays valid,
    since the editor defect does not touch
    which issues are accepted.
    NOTE THE GAP,
    which was stated when the option was chosen and is still true:
    nothing today can re-repair a settled entry without recomputing it whole,
    so
    "discard the repairs" means recomputing those entries when the editor is
    fixed.
    Whoever picks this up should not expect a cheap re-repair path to
    exist.

### The analysis that should survive compaction

The eight round-three false positives are two classes,
not eight problems.
FIVE are one class:
a claim that content is unsupported,
filed because the
 licensing evidence sits outside the window the critic judged.

```text
 4  "adds she"        the original uses she/her throughout
 7  "adds gamer"      the original does say so, in another sentence
41  "adds in heaven"  context shows they went to the afterlife
43  "omits confidant" it IS translated, elsewhere in the passage
50  "adds She"        pronouns are she/her from context
```

THREE are a smaller class,
the critic being more literal than the user's policy:
 `20` "on that day" enhances fluency,
`24` 解脱 has no better English rendering
 and is not vague,
`26` 总会 can be "often".

Removing the first class alone would put this sample near 39 of 42,
about 0.93,
 which clears the bar.
That is the entire precision gap,
and it is now explained rather than mysterious.

DO NOT read that as "widen the context window".
Tasks #40 and #41 already
 widened judged context and already render a source context window for
 addition-class claims,
and both are complete;
these five still got through.
An addition claim asserts content appears NOWHERE in the source,
which a window
 cannot establish at all.
The planning doc proposes a document-wide absence
 check instead.

### Open task numbers, in the order the plan touches them

-   `#66` probe reports `noneFound` on damage a reader sees at once.
    Blocks
     cheap verification of any repair change.
-   `#67` editor replaces far more than the defect span,
    21 of 50 edits beyond
     1.35x,
    and separately writes unidiomatic English.
-   `#65` duplicate accepted issues,
    14 percent of the last sample.
    The gate
     excludes them now;
    the pipeline still emits them.
-   `#31` judge crosscheck,
    still deferred and now clearly downstream of #66.
-   `#60` is SUPERSEDED in its framing:
    it asks for the probe's false-positive
     rate,
    and #66 shows the false-negative rate is the problem.

### Everything landed this session, for the record

Channel-marker fix recovering Kimi-K3 across five roles;
widened rosters with
 every fan-out stage at three voices and a quorum of two,
plus full-roster
 retry;
draw digest binding sheets to an exact draw;
narrowed telemetry claim
 types;
per-entry scoping of the probe region collapse;
ROSTER reporting for
 stage degradation;
duplicate as a first-class grade verdict;
the round-three
 gate verdict;
and the recall re-measure.
All committed and pushed on `translation-repair-rebased`.
