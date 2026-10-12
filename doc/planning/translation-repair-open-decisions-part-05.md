# Decisions waiting on you, 2026-08-15 morning, still open on 2026-08-19, part 05

Part 05 of [Decisions waiting on you, 2026-08-15 morning, still open on 2026-08-19](translation-repair-open-decisions.md),
whose index lists every part in order.

## Decisions I took without you, veto cheaply, continued

27. A TRANSLATOR REPLY THAT SAYS NOTHING IS NO LONGER A REPLY.
    `{"translation":
    ""}` satisfies the structured-output schema,
    so it arrived as a heard voice,
    was dropped further down as an unusable candidate,
    and the model that sent
    it counted as having answered and was never asked again.
    The wire guard now
    refuses it,
    which makes it a lost voice:
    the roster re-asks that model in
    the next round,
    and if it stays blank the loss is named like any other.
    Every source slice says something,
    so no legitimate reply is blank.
    WHAT THIS CHANGES IN A COUNT you may already be reading:
    a blank reply used
    to show up as `translate-blank (model)` beside a full `heardTranslators`
    tally.
    It now shows up as `stage-voice-lost (translate model)` with one
    fewer heard translator,
    which is the same event described honestly.
    The
    blank filter downstream stays as a backstop and should now never fire.
28. WHAT COUNTS AS PROOF THAT A PASSAGE WAS NEVER TRANSLATED?
    THE PIPELINE IS ABOUT TO ACT ON AN ANSWER IT DOES NOT HAVE.
    Both halves of
    the one-sided slicing work insert text where an aligner reports no
    counterpart:
    at paragraph scale (landing four) and at section scale
    (landing five).
    I measured what those reports are actually made of,
    and
    they are not evidence of a missing translation.
    AT PARAGRAPH SCALE:
    the block aligner can pair one with one,
    skip a source
    block,
    or skip a target block,
    and nothing else.
    It cannot say two source
    paragraphs were rendered as one,
    so a merged pair reports the second as
    unpaired,
    identically to an omission.
    Corpus:
    2290 paired steps,
    95
    unpaired source blocks,
    in 23 of 92 entries,
    sixty of them inside two
    entries.
    A hand sample of twelve found the strongest signals were merges
    (one entry renders four consecutive lines as a single English block) and
    the weakest were MISPAIRINGS (a footnote definition paired with the wrong
    footnote;
    a narration line paired with a translation three blocks away).
    AT SECTION SCALE the numbers are smaller and I READ THEM WRONG THE FIRST
    TIME,
    which is worth your attention because the correction is what the
    prototype below was able to make.
    Eighty-five of the 92 entries never reach
    the section matcher at all,
    because equal heading counts short circuit it
    (`#98`).
    Of the seven that do,
    two produce unpaired source sections,
    eleven
    in total.
    WHAT I FIRST CONCLUDED,
    and recorded here in an earlier draft:
    eight of the
    eleven were false,
    because one entry's sections carry English headings that
    plainly correspond,
    经历 with Experience,
    遇见 with Meeting,
    and so on
    through eight of them.
    WHAT IS ACTUALLY TRUE:
    that entry's English document is 1,218 characters
    against 7,365 Chinese,
    and every section of it except the last is a HEADING
    WITH NO BODY.
    The headings correspond and the translations do not exist.
    I
    had inferred body coverage from heading correspondence,
    which is the same
    reasoning error I have been refusing elsewhere,
    and the six-model coverage
    probe reported all eight as uncarried before I checked.
    SO THE MATCHER'S REFUSALS WERE RIGHT IN OUTCOME on that entry,
    for a reason
    it could not state,
    and the count of genuine candidates at section scale is
    higher than the earlier draft said rather than lower.
    WHY IT IS YOURS TO ANSWER:
    the paths differ in expense and in how long the
    lane stays unable to fill a real gap.
    None of them is wrong.
    A.
    ASK A MODEL WHETHER THE TARGET DOCUMENT CARRIES THIS PASSAGE AT ALL,
    scoped to the whole translation rather than to the neighbours the aligner
    picked.
    Pros:
    it is the only option immune to the pairing quality this
    measurement just impeached,
    since it never consults the pairing;
    about a
    hundred and six questions corpus-wide is a small bill;
    it caches like every
    other slice;
    and it answers both scales with one mechanism.
    Cons:
    a new
    stage with its own prompt,
    schema,
    roster and failure modes,
    and a long
    document makes a long question.
    B.
    FIX ALIGNMENT FIRST,
    then revisit insertion.
    Pros:
    the mispairings and
    the ambiguous refusals are defects rather than limits,
    `#74` and `#98`
    already own them,
    and every stage reads better pairs,
    not just this one.
    Cons:
    the largest item here,
    it does not by itself separate a merge from an
    omission,
    and both landings wait on it.
    C.
    INSERT ONLY WHERE THE EVIDENCE IS ALREADY OVERWHELMING,
    meaning a source
    section whose absence is corroborated by more than the matcher's refusal:
    no target heading resembles it,
    and the target document is shorter than the
    source by about that section's size.
    Pros:
    no new stage,
    no model call,
    and
    it would have admitted the three true ones and refused the eight false ones
    in this corpus.
    Cons:
    a threshold tuned on two entries is a threshold tuned
    on nothing,
    and it silently does nothing on the 85 entries that skip the
    matcher.
    D.
    DO NOT INSERT AT ALL for now.
    Keep both landings parked,
    ship the
    translate lane over slices that HAVE incumbent text,
    and revisit when
    alignment is trustworthy.
    Pros:
    no corpus risk whatever;
    every invariant
    built for insertion stays and stays tested.
    Cons:
    the archive's genuinely
    missing sections stay missing,
    which is the thing the second lane exists
    for.
    MY RANKING:
    A > C > B > D.
    A over C because A answers the question for both scales with one mechanism
    and does not depend on the aligner being right,
    where C still rests on
    refusals whose reasons do not distinguish the cases.
    C over B because C can ship a genuinely missing section now and B is the
    largest item here,
    and because the correction above raised how many section
    candidates are genuine rather than lowering it.
    B over D because B is work that pays off in every stage,
    where D is a
    holding position.
    WHAT I DID RATHER THAN WAIT:
    built A and measured it,
    since it was the
    stated default and the prototype touches no corpus state.
    It is four files
    and a probe task,
    nothing calls them,
    and no slicing or artifact reads them.
    WHAT IT MEASURED,
    thirty-three candidates,
    six voices each,
    about a hundred
    and ninety calls and under ten minutes:
    ELEVEN SECTIONS:
    ten absent,
    one carried.
    Every verdict agrees with what the
    documents contain,
    and NINE of my eleven hand labels were wrong.
    It found
    that one entry's English side is headings without bodies,
    and that a source
    heading meaning "blank" is rendered by an English heading spelled `__`,
    which the matcher cannot score because it holds no letters.
    TWENTY-TWO BLOCKS:
    eighteen carried,
    most unanimously,
    one absent,
    and three
    split with NO votes for absence at all.
    So at paragraph scale at most one of
    twenty-two passages the aligner refuses is one nobody translated,
    and
    landing four would insert on all twenty-two.
    WHAT THAT IS NOT:
    an accuracy number.
    The candidates come from five entries,
    most blocks carry no hand label,
    and I made the labels after seeing the
    aligner.
    What the class balance cannot explain is that pooled across both
    scales no constant answer beats nineteen of thirty-three,
    while the probe
    agrees with every label I have in both directions.
    WHAT IT COSTS:
    about six calls per candidate,
    roughly a hundred and six
    candidates corpus-wide,
    so one pass over every unpaired passage in the
    corpus is around six hundred and forty calls and a quarter of an hour.
    ONE DESIGN DEFECT IT EXPOSED,
    which matters whichever option you choose:
    a
    source section whose translation is a HEADING WITH NO BODY must have its
    body inserted UNDER that heading,
    not inserted as a whole new section,
    or
    the document gains a duplicate heading.
    Landing five as designed would have
    made that mistake on eight sections of one entry.
    RERUN AFTER THE REVIEW CHANGES LANDED,
    because the numbers above are what
    this question rests on and three things moved underneath them:
    the sheet was
    rewritten,
    the threshold became a majority of the roster rather than of the
    voices heard,
    and the quote locator learned to see through a soft line wrap.
    Nine of the eleven section verdicts are identical.
    XingZ60's section 12 reads
    `partly-carried` where it read `carried`,
    which is not the models changing
    their minds:
    the tallies are zero full and five partial,
    and the old verdict
    counted any claim of coverage as one vote,
    so those same five votes used to
    print as carried.
    XIEPT2's section 7 reads `split` where it read `absent`,
    and that one I CANNOT attribute:
    the votes themselves moved,
    and votes of
    that shape read as split under either threshold,
    so the cause is the new
    sheet or ordinary variance between two samples of six stochastic models,
    and
    one run cannot separate those.
    WHAT DID NOT MOVE IS THE ANSWER TO YOUR QUESTION.
    No candidate in either run
    reports full coverage.
    Nine of eleven are absent by a majority of the whole
    roster with every model heard,
    and both verdicts that moved moved AWAY from
    coverage rather than toward it.
    The sections I had labelled as plainly
    translated are still reported as carrying nothing.
    THE BLOCK SET WAS RERUN TOO,
    on `mikaela_khara`,
    the entry that produced the
    three splits.
    All three are now carried,
    and of the quotes still unanchored
    none is a soft line wrap where ten of eleven were before,
    so the refusals
    that remain are English a model composed rather than copied,
    plus one
    single-word quote refused for occurring twice.
    Across both runs of that entry,
    ninety-six answers from six models,
    NOT ONE VOTE FOR ABSENCE was cast on
    sixteen passages the block aligner refuses to pair.
    If anything,
    the paragraph
    scale reads worse for landing four than it did:
    at most one of twenty-two,
    and
    plausibly none.
    RUN A THIRD TIME under unchanged code,
    because the one sentence above that
    said "this might be variance" deserved testing rather than repeating.
    All
    eleven verdicts came back IDENTICAL to the second run,
    section 7's split
    included.
    So that split reproduces,
    and the eleven verdicts this question
    rests on are now two independent samples in agreement rather than one sample.

### MEASURED 2026-08-23: the absence vote is reachable, so the block-scale null is about the corpus

The unanimity recorded for `mikaela_khara`,
ninety-six answers with not one vote for absence,
had two readings and nothing separated them.
Either the translation carries every passage,
or the coverage wire's evidence rule admits any non-empty quote,
which would make an absence verdict unreachable and the count meaningless.
Both produce the same reading,
and the second would undercut everything this question leans on.

Measured both,
on that same entry,
at the current wire.

FIRST,
the verdicts were graded deterministically,
no model in the loop,
over the sixteen block-scale answers from a fresh run:
no evidence span is offered for two different blocks,
no block's evidence sits out of document order relative to its neighbours,
and no evidence is too short to be rendering its source,
the thinnest being 2.08 English characters per source character against a spread running to 6.78.
Every detector was first shown to fire on a planted case,
and the reuse detector was also shown NOT to fire on several voters quoting one span for one block.

SECOND,
and this is what settles it,
the roster was asked about a passage,
THE SPANS IT ITSELF ANCHORED ON were deleted,
and it was asked again.
Two of three cases flipped from `carried` to `absent`,
with six of six and five of six voices calling it absent where none had before.
The third moved to `partly-carried`,
which is what a passage partly rendered elsewhere should produce.

THIRD,
the same cases were cut again by the same number of characters
taken from a part of the page the roster had not pointed at.
None of the three produced a single absence vote.
The deleted region was classified structurally rather than assumed to be ordinary:
one prose line of 111 characters,
not a heading,
list,
link or footer.
So the flip follows the rendering,
not the damage.

The targeted arm returned identical verdicts on two independent runs,
and the coverage path holds no cache,
so that agreement was bought rather than replayed.

WHAT THIS DOES AND DOES NOT LICENSE.
It establishes that the wire can say no,
which is what question 28's premise needed.
It does not establish that the corpus carries everything:
that is one entry and three damaged cases,
enough to settle reachability and not enough to make a claim about ninety-three pages.
The wiring itself stays where the owner left it,
`groupSourceFirst` unwired and `alignDocumentSections` emitting no insertion pairs,
because what the pipeline should DO with a reachable absence verdict is a separate decision.

Runner:
`mise run //package/module/translation-repair:coverage-control-probe -- --only <entry>`.

### AND THE NULL ITSELF WAS ONE ENTRY, measured the same day

Ran the same control over six entries,
picked off a zero-quota census
that found 26 of the 92 pairs carry coverage candidates at all.

Three entries HELD,
meaning damage was detected and only the right damage:
`mikaela_khara`,
`TianqiChen666` and `Futajuhuacha` gave absence votes on 8 of 9 targeted cuts
and on 0 of 9 equally sized cuts taken where the roster had not pointed.

On the other three the control had NOTHING TO DAMAGE,
because the roster refused to call
a single candidate covered before anything was cut:

-   `shi_Yumiaoya`,
    8 of 8 candidates:
    seven `absent` with 4 to 6 of 6 voices,
    one `split`.
-   `Aniloviraw`,
    3 of 3:
    all `absent`,
    5 to 6 voices.
-   `XingZ60`,
    4 of 4:
    section 13 `absent` with 5 voices,
    the rest `partly-carried`.

Fifteen of fifteen undamaged candidates were not called covered,
and not one refusal anywhere in the run was an anchoring failure.
`XingZ60` also reproduced its recorded section-scale verdicts,
section 12 `partly-carried` and section 13 `absent`.

SO THE SENTENCE THIS QUESTION LEANS ON,
ninety-six answers with not one vote for absence,
IS A FACT ABOUT `mikaela_khara`.
It is not a fact about the wire,
which votes absence near-unanimously on other pages,
and it is not a fact about the corpus.
The reading that follows from it,
at most one of twenty-two and plausibly none,
inherits the same limit and needs re-deriving over a spread before it can carry
the weight the paragraph-scale refusal puts on it.

NOT ESTABLISHED:
whether those absence verdicts are CORRECT.
They are consistent with genuine omissions rather than merges,
since a merge puts the content somewhere and that is what `carried` reports while `absent`
claims it is nowhere,
but that is an argument and not a measurement.
Settling it means reading those passages against their source.

Still nothing wired,
and still the owner's call.


### Taken on 2026-08-21, all four vetoable

1.  `#164` IS CLOSED WITH NOTHING BUILT.
    It was opened because the gate's ballots name the consolidation faulty
    more often than the standing text at five of 37 gated slices,
    and shipped it at two of them anyway.
    Measured over all 217 ballots of runs 6 to 9:
    `unsupported` and `dropped` are lists of rendering NAMES,
    so the 35 ballots naming both cancel,
    and 74 of the 76 asymmetric ballots name faulty exactly the rendering they voted against.
    The field restates the vote rather than testing it.
    At the two shipped cases the panel was five to one and two to one,
    and the contrary evidence is the dissenting voter's own ballot.
    I did not read the Chinese at those two slices,
    because the question a reading would settle stopped existing.
    VETO THIS if you want the two passages read anyway.
2.  `#162`'s free version is off the table.
    Wrapping consolidation proposals before the slate would show judges text
    breaking the line-structure rule they were told to enforce,
    on 189 of the corpus's 211 line-structured slices.
    The band pair could not have shown this:
    it contains none.
3.  `#163`'s expansion band of 2.09 to 4.24 is refuted rather than refined.
    It fires on 27 percent of the archive's own paired slices.
    I propose block-count disparity beside it as a second,
    unit-free instrument,
    since 88 percent of slices carry equal block counts,
    but I have built neither and the action on a breach is still yours to set.
4.  THE VERIFICATION PROTOCOL FOR `#138` CHANGED SHAPE.
    Two plain runs cannot exercise the resume path,
    because a settled entry's cache is deleted by design.
    The run's cache is copied aside while it runs and restored into a fresh directory
    for the second run.
    VETO THIS if you would rather the resume path be verified by interrupting a run,
    which reaches the case organically but only for whichever stages happened to be finished.

## Question 11: whether the editor calibration overlaps slices by default

`TRANSLATION_REPAIR_SLICE_OVERLAP` (`slice-overlap.ts`,
landed `ce5ca2368`) sets how many slices
`editor-calibrate` keeps in flight;
the default is 1.
Measured on 2026-08-26 over the same four slices,
one run per arm:
arm B (overlap 4) took 24.18 min against arm A's 43.18 (overlap 1),
heard 302 of 312
voices against 304,
and the calls themselves cost the same (stream sums 6249 s and 6312 s).
Arm A2
repeated arm A unchanged and took 58.95 min,
so the run-to-run band is 37% of wall clock and comes from
provider speed.
Normalized as wall clock over stream sum:
A 0.41,
A2 0.38,
B 0.23.
The overlap effect is
six bands wide.
The owner's 2026-08-26 answer was "measure the run-to-run band first";
it is measured.

### Options

A.
 **Default `editor-calibrate` to overlap 4,
keep the dial.**
    -   For:
halves the wall clock of the one command a session waits on most,
on evidence that clears the
        band six times over;
voices heard moved by 2 of 312,
inside what provider speed alone moves (A2 lost
        8 with no dial change).
    -   Against:
a four-slice standing is noise either way (GLM-5.2 swung 52.2% to 26.7% to 10.0% between
        identical runs),
so faster standings are faster noise until the sample grows;
`producer-calibrate`
        has no dial yet,
so the two calibrations would run under different defaults.
B.
 **Keep the default at 1;
document `TRANSLATION_REPAIR_SLICE_OVERLAP=4` as the recommended launch.**
    -   For:
nothing changes for a reader of an old log;
the pass drivers (question 3,
`#261`) still run at
        1,
so calibration and pass stay alike until the pass is measured.
    -   Against:
the recommendation lives in a doc a reader may not open;
every default run pays 19 minutes
        for nothing measurable.
C.
 **Move both calibrations and the pass to overlap 4 together,
after `#261` is measured.**
    -   For:
one story for every driver.
    -   Against:
couples a decided measurement to an undone one for no gain in evidence.

### Ranking

A > B > C.
A over B because the effect is measured and six bands wide,
and the standing-noise objection
applies equally at either overlap;
B over C because C delays a decided question behind an undecided one.

### DECIDED 2026-08-26: A, by the owner

`CALIBRATION_OVERLAP = 4` in `slice-overlap.ts`;
the dial's fallback is now the caller's,
so the pass keeps
1 until `#261`.
Record:
`doc/decision/translation-repair-calibration-overlap.md`.

`#261` was measured on four matched pass pairs on 2026-08-27 and 2026-08-28,
and on 2026-09-06 the pass fallback moved to 4 on that reading,
flagged for the owner's veto.
Record:
`doc/decision/translation-repair-pass-overlap.md`.

## Question 12: whether the straggler window moves from 180000 ms

`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` (`grace-override.ts`,
landed `4c070f729`) overrides the window for
one run.
Arm C (300000 ms,
overlap 1) took 53.87 min against arm A's 43.18 and bought back 2 of 6 cut
voices,
all `qwen3.8-max`.
Arm A2 then showed the band:
58.95 min for an unchanged arm A,
8 cut voices
instead of 6.
Normalized,
A 0.41,
A2 0.38,
C 0.43:
the window's cost sits inside the band,
and so does its
recovery.
Arm D (overlap 4 at 300000 ms) is running;
under overlap the wait a longer window adds is what
overlap fills,
so D is the arm that could show a cheap window.

### Options

A.
 **Keep 180000 ms,
keep the dial,
read arm D before reopening.**
    -   For:
nothing about the longer window is shown at this scale;
the decision doc's own derivation
        still stands;
the dial lets any later trial run without a build.
    -   Against:
6 to 8 cut voices per four-slice calibration persist,
all on one model.
B.
 **Move to 300000 ms on arm C's 2-of-6.**
    -   For:
two voices came back on one run.
    -   Against:
the band swallows both the cost and the recovery;
A2 lost 8 voices with no window change,
        so 2 of 6 is not distinguishable from noise on single runs.
C.
 **Run interleaved repeats (A,
C,
A,
C in one sitting) and decide on the normalized pair.**
    -   For:
the only design that resolves a difference smaller than the band.
    -   Against:
about four hours of provider time for a dial whose largest plausible effect is two voices
        per calibration,
all from one model that `#121` already names as the window's single payer.

### Arm D, read the same evening

Overlap 4 at 300000 ms over the same four slices:
29.31 min against arm B's 24.18,
with slower calls (stream
sum 7591 s against 6249 s),
so the normalized figure is 0.23 for both.
Voices heard 318 of 320 against B's
302 of 312;
2 cut against B's 7 and A2's 8.
Time in grace 4591 s against 2819 s,
filled by the other slices
in flight.
Under overlap,
the longer window is free and it is the arm with the fewest cut voices of the five.

D.
 **Move the window to 300000 ms together with overlap 4 as the calibration default (question 11,
A).**
    -   For:
the one arm that pairs them shows no measurable wall-clock cost and the lowest voice loss of
        any arm;
the window's price was always the wait,
and overlap is what fills the wait.
    -   Against:
one run;
the voice-loss difference (2 against 7) is larger than the band's spread of cuts
        (4 to 8 across single-overlap arms) but not by much;
at overlap 1 the price returns,
so the two
        settings must move together or not at all.

### Ranking, revised

D > A > C > B.
D over A because it is measured where A was waiting for the measurement;
A over C and C over
B as before.
D is conditional on question 11 resolving to overlap 4;
at overlap 1 the window stays at
180000 ms.

### DECIDED 2026-08-26: D, by the owner

`CALIBRATION_STRAGGLER_GRACE_MS = 300_000` in `grace-override.ts`,
adopted by the calibration through the
variable;
the built-in `STRAGGLER_GRACE_MS` stays 180000 for the pass until `#261`.
Record:
`doc/decision/translation-repair-calibration-overlap.md`.

## Question 13: entry time to complete after quality hardening

Generation-12 `Weideriche_` and pull-request 386 `Carena0442` runs were stopped after correctness blockers.
They are partial phase traces,
not completion samples or matched arms:
they have different corpus inputs and pipeline digests,
and overlapped against shared provider capacity.
Their elapsed-time ratio cannot establish scaling or concurrency effect.

Owner set fresh `Carena0442` median below two hours as objective without weakening quality.
No new validation launches before generation-13 correctness commit,
partial-log phase attribution,
and matched performance plan.

`doc/planning/translation-repair-entry-time-to-complete.md` is authoritative protocol.
It requires phase attribution,
post-quorum grace accounting,
completed-versus-abandoned call separation,
cache state,
slice and source size,
run-to-run band,
and verified publication-quality outcome before recommendation.

## Open on 2026-09-24

Every numbered question in this document is answered.
The items below are the owner questions and the open observations of the 2026-09-16 to 2026-09-24 sessions
that have not been put or not been built;
the pass log carries the evidence under the read that found each.

- The placeholder block "**Come back later!**" on XingZ60
  (the archive block review removed it 5 of 6 on XingZ627 and XingZ628,
  kept it on XingZ626,
  XingZ630 and XingZ631,
  rewrote it into an under-construction warning on XingZ629):
  whether a placeholder the archive's translator left is apparatus the page owes,
  to be kept as the archive has it,
  or a block the review may remove.
  Never put to the owner;
  the page is right either way by the review's own vote,
  and the double blank line its removal left is fixed (class ninety-four).
- The coined character 螐 on XingZ60:
  "A wu[^7] bird" on XingZ630,
  "A little wun[^7]" beside "螐儿" on XingZ631.
  An observation,
  not built:
  a coined character has no pinyin reading and no corpus rendering,
  so the handle rule of 2026-09-22 does not reach it.
- The repair lane's own floor let a three-line closing quote into the lane contest on shi_Yumiaoya16;
  class one hundred two closed the consolidation side
  (the lane-text offer now carries `lineStructured`),
  and the repair lane's floor is unchanged.
  Not reproduced since.
- An empty standing with no valid lane text still fails at publish rather than at once
  (noted with class eighty-seven,
  never reached).
- The coverage admission logged `coverage=carried` without the evidence regions;
  built in 0ab0abdd8 (class one hundred eleven):
  every stand-aside of the fold names its reason at warn,
  and every passage still carried prints its evidence regions at the admission.
