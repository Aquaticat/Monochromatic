# Translation repair history 2026-08-07 to 2026-08-12: round three graded, the repair sheet judged ungradeable

The round-three grading result (the gate not met),
the duplicate-exclusion decision and the grader calibration,
the reading of the repair sheet that found scope and quality failures the probe missed,
and the state at the 2026-08-12 compaction with the decision to re-plan the milestone.

Part of [Translation repair history: 2026-08-07 to 2026-08-12](translation-repair-history-2026-08-07-to-12.md),
which lists every file of this record.

Historical evidence only:
no next-action list here is a current instruction,
and the stop condition in the index applies.

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
