# Decisions waiting on you, 2026-08-15 morning, still open on 2026-08-19, part 03

Part 03 of [Decisions waiting on you, 2026-08-15 morning, still open on 2026-08-19](translation-repair-open-decisions.md),
whose index lists every part in order.

## Question 6: what a thin roster's verdict is worth to the cache

BLOCKS NOTHING.
It changes how much a resumed run re-buys,
so it is worth
answering before a long run rather than during one.

WHAT IS ALREADY DECIDED AND BUILT,
so this question is only about the middle
ground:
a slice NOBODY examined is never cached.
Zero critics heard,
or zero
translators heard,
settles for the run and is left out of the cache,
so the next
attempt asks again instead of resuming an outage as a verdict.
A caller abort
now stops both drivers rather than settling the slices it interrupted.

THE MIDDLE GROUND is a slice that was examined by FEWER models than the stage
asks for.
Quorum is half the roster rounded up,
so on six critics a slice
decided by three met quorum exactly,
and one decided by two did not.

MEASURED,
on what is actually on disk:

-   Of the 150 cached repair slices,
    `heardCritics` runs 3 for 1 slice,
    4 for 3,
    5 for 92 and 6 for 54.
    Not one is below quorum,
    and one sits exactly on it.
-   Across all 56 settled artifacts,
    34 unmet-quorum findings appear,
    in 7
    entries,
    and every one of them is the REFINER.
    Critics,
    panel,
    editor,
    judges and checkers never fell short of quorum in the settled corpus.

So the population this question governs is small,
and it is concentrated in the
one lane that is optional:
naturalness refinement,
whose silence was traced to a
single model in `#73` and `#77`.

### Options

A.
 Cache only a slice where EVERY stage met quorum;
re-buy the rest next
    attempt.
    Pros:
what resumes is then work done at full strength,
and nothing thin
    survives into an artifact by being cached first.
    Cons:
the cache is per SLICE,
so a refiner that lost quorum re-buys the
    critics,
the panel,
the editor,
the judges and the checkers with it,
to
    retry one optional lane.
And it can loop:
the refiner's silence has a known
    chronic cause,
so those slices may never cache at all.

B.
 Cache anything that was examined at all,
which is the rule as it now stands:
    zero voices is not cached,
one voice is.
    Pros:
matches what the stages already decided to do,
since a stage short of
    quorum deliberately proceeds with findings rather than failing;
costs
    nothing to keep.
    Cons:
a slice decided by a thin roster resumes forever with no way to tell
    it apart from one decided at full strength,
unless a reader goes looking in
    the findings.

C.
 Cache it,
but RECORD that it was thin,
and let a later pass re-buy only
    those slices.
    Pros:
keeps the budget while making the population addressable;
the record
    already exists in `findings` and would only need a field a reader can filter
    on.
    Cons:
a schema field,
a version bump and a reader for a population that is
    34 slices in 7 entries today.

RANKING:
B > C > A.

B over C because the measured population is small and sits entirely in the lane
where thinness means "no improvement was attempted" rather than "nothing
inspected this",
and C's field cannot be added without a cache version bump,
which discards the 150 slices already on disk to gain a filter over none of them.
C over A because A pays for a whole slice to retry one optional lane,
and pays
it again on every attempt while the cause persists.

B

## Question 7: what the non-translation block counts against

BLOCKS NOTHING TODAY,
and nothing changed behaviourally overnight.
It decides
what one whole-document refusal MEANS,
and that refusal is terminal:
it returns
the archive untouched and stops the entry from inside the slice loop.

WHAT THE CODE DOES.
`assessNonTranslationDominance` sums characters over the
SLICES it was handed,
on both sides of the comparison,
and blocks when the
slices standing as non-translation are more than half of them with no anchor
in sight.
Anything the aligner refused to pair,
and anything slicing left
whole,
is in neither term.
So the sentence the block currently supports is
"most of what we EXAMINED is not a translation",
while the parameter
documentation until last night said "archive characters in total".

MEASURED,
at zero quota,
over the pinned corpus of 92 prepared pairs.
Each
pair was prepared,
its slice characters summed,
and the total compared against
the whole English document:

-   Mean slice coverage,
    over entries with no alignment finding,
    is 92.5%.
-   14 entries fall under 90% covered,
    2 under 50%.
-   Only 2 entries carry any alignment finding at all.

The routine gap is front matter and the separators between chunks,
which
belong in no slice by construction and are not what this question is about.
The tail is,
and its two ends name the two causes.
`XIEPT2` produces ZERO
slices from 17 alignment refusals,
so 0 of its 1218 characters are examined:
both terms are zero,
the block cannot fire,
and the entry settles as a clean
unchanged document having looked at nothing.
`ArtsEpiphany` at 27.5% and
`windward0032` at 60.9% carry no alignment finding at all,
so their shortfall
is slicing rather than pairing,
which is `#90`'s territory rather than this
question's.

### Options

A.
 Read the ratio over the DOCUMENT,
so the block means "most of this
    translation is not a translation".
    Pros:
matches what every reader of a whole-document refusal will assume it
    measured,
and stops an entry whose examined part is all non-translation but
    whose bulk was never sliced from blocking the whole document.
    Cons:
an entry can then hide non-translation behind unsliced bulk,
since
    the majority it needs is now over text nothing inspected.
It also makes the
    block quieter the worse the slicing gets,
which is the wrong direction for
    a signal.

B.
 Read it over the SLICES,
as today,
and say so in the contract.
    Pros:
every character in the ratio was actually examined,
so the block
    never rests on text no model read;
costs one documentation pass,
which is
    already half done.
    Cons:
the refusal's name promises more than it measures,
and a document
    that is mostly unsliced cannot reach the block however bad the part that
    was examined.

C.
 Keep B's denominator and add a coverage floor:
refuse to DECIDE on a
    document whose sliced fraction falls below it.
    Pros:
the only option that gives `XIEPT2` an honest outcome,
which is
    neither clean nor blocked but unexaminable;
the floor is one number and the
    measurement above says where it would sit.
    Cons:
a third terminal outcome to represent,
and `#96` says the artifact
    cannot express "unknown" yet,
so this one waits on that.
It also needs a
    number picked from 92 entries,
and 2 of them are the whole population it
    would catch.

RANKING:
C > B > A.

C over B because B leaves `XIEPT2` settling as a clean unchanged document on
the strength of having examined nothing,
which is the one outcome in this
question that is actively wrong rather than merely narrow,
and C fixes it
without changing what the block itself counts.
B over A because A's failure
mode grows with the very defect it is meant to survive:
the less of a document
gets sliced,
the harder its examined non-translation is to see,
whereas B's
narrowness is stated and constant.

WHAT I WOULD DO IF YOU DELEGATE THIS:
take B now,
since it is documentation of
what already happens,
and hold C until `#96` can carry an unexaminable verdict.
That ordering costs nothing,
because C keeps B's denominator.

DELEGATE

## Question 8: where the rendering audit runs, now that it works

ANSWERED 2026-08-16:
option B,
standalone over EVERY settled artifact.
Recorded with three other decisions of that date in
`doc/decision/translation-repair-four-answers.md`.

The ranking below puts C first and is SUPERSEDED,
deliberately and for a reason worth keeping:
C won
its place as "the cheapest way to get a RATE rather than a verdict",
and under the standing
best-quality guideline cost is not a constraint,
so the saving is not a benefit.
A census has no
sampling error and additionally answers questions about particular entries,
which C says outright it
cannot.
Everything else in the ranking still holds,
including why the audit stays OUT of the
producing path until its production error rate is known.

The options are kept as written,
because they are the record of what the answer was chosen against.

The absent-baseline instrument (`#85`) is built,
tested,
and MEASURED against
its own planted defect,
three runs of each arm.
On the positive fixture the
dropped negator was found in all three runs:
by all three auditors twice,
and by
two of three once,
where the remaining voice pointed at it but quoted wording
that could not be anchored.
On the faithful fixture every auditor claimed
nothing at all,
every time.

It is wired to nothing.
That is the last decision on it,
and it is yours because
the options differ in what they cost you rather than in whether they work.

WHAT EACH CALL COSTS,
structurally:
one exchange per voice per audited unit,
against whatever roster it is given.
The multiplier is how many units you audit,
and that is what the options differ on.

### Options

A.
 **Per slice,
inside the translate lane,
on every slice it renders.**
    -   For:
every rendering is audited before anything downstream reads it,
and
        the findings arrive while that slice's context is still in hand,
so a
        future gate could act on them without a second pass.
    -   Against:
it multiplies a corpus pass by the roster width,
does that on
        slices nobody has reason to doubt,
and puts an instrument whose
        production error rate is unmeasured inside the path that produces the
        output rather than beside it.

B.
 **Standalone,
over settled version 2 artifacts,
after a pass.**
    -   For:
nothing in the producing path changes,
so a bad audit run cannot
        cost a pass.
It reads the artifact the pass already wrote,
and it can be
        re-run against those same artifacts when the instrument changes,
which
        is exactly what this week needed and did not have.
    -   Against:
it cannot influence what ships without a second pass,
and it
        re-reads text the pass already had in memory.

C.
 **Standalone over a SAMPLE of settled artifacts,
not all of them.**
    -   For:
the cheapest way to get a RATE rather than a verdict,
which is what
        an instrument in shadow mode is for.
A sample is enough to say how often
        the lane's renderings carry corroborated defects.
    -   Against:
it says nothing about any particular entry,
so it cannot settle
        a question about one.

D.
 **Leave it unwired,
and run it by hand when investigating.**
    -   For:
costs nothing,
and the sensitivity arms already show it works when
        pointed at something.
    -   Against:
nothing accumulates.
Every question about the lane's fidelity
        would start from zero,
which is how an instrument built at some expense
        quietly stops being used.

### Ranking

C > B > A > D.

-   C over B,
    because the first thing anyone will ask of this instrument is a
    RATE,
    and a sample answers that for a fraction of the cost.
    B's advantage,
    covering every entry,
    only pays once a rate exists and someone wants to act
    per entry.
-   B over A,
    because re-runnability is worth more than immediacy while the
    instrument is still changing:
    the matcher was rebuilt twice this week,
    and
    under A each rebuild would have needed a fresh corpus pass to re-measure,
    while under B the artifacts are still on disk.
-   A over D,
    because A at least accumulates evidence,
    and D's cost argument is
    real but its outcome is an unused instrument.

WHAT I WOULD DO IF YOU DELEGATE THIS:
C now,
B once a rate exists and per-entry
action is wanted,
and A only if a gate is ever built on the audit,
which would
need its false-positive rate measured on real renderings rather than on one
faithful fixture.

DELEGATE

## Question 9: what to do about the straggler grace's one-model tax

`STRAGGLER_GRACE_MS` is 180000,
unchanged since `doc/decision/translation-repair-straggler-grace.md`
widened it from 60000 and measured a roughly three-and-a-half-times drop in voice loss.
First
production traffic now shows WHO pays that window's remaining cost:
of 19 cuts over 2025 streams,
16 are `hf:zai-org/GLM-5.2` (4.88 percent of its 328 streams) and 2 are `hf:Qwen/Qwen3.6-27B`,
newly appeared and on its two largest deliveries in the log (3258415 and 3209277 characters).
Three
of six models have never been cut.

THE WINDOW ALSO CANNOT TELL A FULL-SPEED CALL FROM A CRAWLING ONE,
which is a second,
separate
finding:
the audit's two example abandonments were both cut at exactly 180000 ms,
so dividing
delivered characters by that shared floor gives an upper bound on each rate,
at most 16196
characters a second for one and at most 686 for the other,
twenty-three times apart.
Both are
upper bounds,
since the true duration is censored at the cut,
but the shapes read as different:
one
was still producing,
the other was closer to crawling.

AND NOTHING RE-ASKS A CUT VOICE,
by design.
`stage-quorum.ts` stops its retry rounds once quorum is
satisfied,
so a voice lost to the grace after quorum already stood is never re-dispatched.
The
consequence named in the audit is the one worth deciding on:
on the stages this happens,
the
ensemble is effectively five of six,
always missing the same member.

WHAT REDOING THE ORIGINAL DERIVATION WOULD NEED,
and does not have:
the 180000 figure came from
per-model whole-call latency percentiles over a 602-exchange bench under the roster of the time.
Nothing read for `#121` measures that under the CURRENT six-model roster;
first-byte and mid-stream
gap are a different measurement,
and cut rate by model is a rate rather than a latency.
A fresh
per-model latency bench is the prerequisite for computing a new number rather than guessing one,
and running it spends quota this task was not authorized to spend.

### Options

A.
 **Leave `STRAGGLER_GRACE_MS` at 180000.**
    -   For:
it already measured a roughly three-and-a-half-times drop in voice loss over the
        window it replaced,
costs nothing to keep,
and the residual is concentrated on models this
        ensemble is built to tolerate losing occasionally rather than a class of hangs.
        `doc/decision/translation-repair-straggler-grace.md`'s own backlog already says the LAST
        widening's cost needs a run-to-run band before it needs a decision,
and that band still
        does not exist.
    -   Against:
it keeps taxing the same voice on the same stages repeatedly rather than fixing
        anything,
and 84 percent of cuts landing on one model is the shape the audit specifically
        flagged as worth deciding on rather than absorbing quietly.

B.
 **Widen `STRAGGLER_GRACE_MS` further,
pending a fresh per-model latency bench.**
    -   For:
directly targets the harm the audit's full-speed example shows,
a call still
        delivering real content when the grace ends it,
and the prior widening (60000 to 180000)
        is precedented,
measured,
and worked.
    -   Against:
no fresh per-model latency data exists to derive a new number from under the
        current roster,
so any figure chosen now is a guess dressed as a measurement;
it also
        raises the cost on the crawling-call shape (the 686 characters-a-second example),
and the
        prior widening's own remeasure found a real,
unbanded wall-time cost (+21 percent
        aggregate,
+28.6 percent on one entry) that widening again would compound before it is
        even priced.

C.
 **Give `hf:zai-org/GLM-5.2` (or any model crossing a cut-rate threshold) a longer grace than
    the roster default,
rather than moving the shared window.**
    -   For:
targets exactly what was found,
one model's concentration,
without paying a wider
        window's cost on the other five models' much rarer cuts.
    -   Against:
`runGatherRound` takes one shared `graceMs` per round with no per-model concept
        today,
so this is a real implementation change layered on top of the policy choice,
and it
        privileges one vendor's model by name in code,
which stays meaningful only while the
        roster does not change.

D.
 **Switch from a fixed-duration grace to a production-rate cutoff.**
    -   For:
the audit's two examples show the fixed window conflates "still producing" with
        "crawling",
and a rate test would keep the first kind of call and cut the second,
which is
        closer to what the grace is actually meant to discriminate.
    -   Against:
exactly two examples exist to validate any rate floor against,
both upper bounds
        with an unknown true rate,
so a specific threshold chosen now fits n=2;
it is also a larger
        implementation than a constant edit.

E.
 **Drop `hf:zai-org/GLM-5.2` from the roster.**
    -   For:
removes the tax at its source,
and the model's cut rate under the CURRENT roster
        (4.88 percent,
sixteen times the next-highest model measured here) is now a direct
        measurement rather than an inference from an older bench.
    -   Against:
the straggler-grace decision already measured this model answering in full on a
        large share of its seated stages,
so dropping it trades a slow-but-mostly-working voice for
        a permanently five-model ensemble on every stage rather than most of them;
`#105`'s framing
        was explicitly "widen the deadline,
or seat a replacement",
and the straggler-grace
        decision already answered against replacement once.

F.
 **Re-ask a straggler once the grace cuts it,
instead of leaving the round at whatever quorum
    already heard.**
    -   For:
recovers the lost answer even when the round itself could not wait for it,
so a
        working-but-slow reply is not simply discarded.
    -   Against:
this reverses deliberate,
documented design;
`stage-quorum.ts`'s retry rounds stop
        once quorum stands specifically so a satisfied round is not delayed further,
and re-asking
        after the round has moved on means judging the straggler against a slate the rest of the
        panel no longer shares,
close to the confound `#109`'s window-trial ledger exists to avoid.

### Ranking

A > C > D > B > F > E.

-   A over C,
    because C is a real,
    unvalidated behavior change naming a single vendor's model in
    code,
    while A costs nothing and `translation-repair-straggler-grace.md`'s own backlog already
    says the LAST widening's cost needs measuring before the next one is decided;
    acting again
    before that band exists repeats a mistake this document family has already corrected twice.
-   C over D,
    because both target the concentration precisely,
    but C only has to choose one number
    (a per-model grace) where D has to fit a rate floor to two examples,
    both upper bounds;
    being
    wrong about C's number costs one model some extra minutes,
    being wrong about D's rate risks
    cutting any slow-starting healthy call on any model.
-   D over B,
    because D at least targets the signal the audit found,
    rate rather than duration,
    where B pays the same wider-window cost on all six models' rare cuts to fix a problem that is
    concentrated on one.
-   B over F,
    because B is at least the same kind of change,
    a constant,
    with a measured precedent
    behind its last move;
    F fights the pipeline's own documented design intent and risks the exact
    judging confound `#109` was built to remove.
-   F over E,
    because F costs a design conflict and a possible confound,
    both recoverable;
    E is a
    roster change already argued against once in this codebase's own history,
    and it discards a
    model shown to answer usefully on most of the stages that seat it.

WHAT I WOULD DO IF YOU DELEGATE THIS:
A now,
then C once the run-to-run cost band the
straggler-grace backlog already calls for is measured,
since C is the option that answers "the
grace's cost is concentrated on one model" without guessing at a number the current roster has no
bench for.

DELEGATE

## Question 10: whether to re-arm the idle windows below the deadline

`STREAM_FIRST_BYTE_MS` and `STREAM_IDLE_MS` stay at 600000 after `#121`'s re-derivation
(`doc/decision/translation-repair-runaway-call-termination.md`),
which corrected the STATED REASON
for that value without finding a number below it that clears every regime measured.
This question
is the one the correction explicitly left open:
given the median is now fast,
is any of the
360000 ms the deadline currently spends on a dead call worth trying to reclaim.

WHAT A FALSE TRIP ACTUALLY COSTS,
which softens but does not remove the risk:
`stream-idle-guard.ts`
aborts on a controller it owns rather than the caller's signal,
so `exchangeWithRetry` treats a
tripped guard as transient and re-dispatches at transport level on a roughly one-second backoff.
No voice is lost the way a straggler-grace cut loses one.
What IS spent is a full fresh call:
real
wall-clock time and quota,
and if the model reliably pauses near the same point in its own reply,
a retry can walk into the same trip again rather than clearing it.

### Options

A.
 **Leave both constants at 600000,
effectively disabled.**
(Current state,
landed in `#121`.)
    -   For:
zero demonstrated risk against every regime read,
including the closest historical
        near-miss,
a completed call at 347099 ms three weeks before this traffic under a different
        roster.
The 360000 ms deadline already ends a truly dead call within six minutes,
achieving
        the guard's stated purpose with a coarser instrument.
    -   Against:
a call whose first byte never arrives runs the full six minutes even though the
        new median says most of that wait is now abnormal,
and the idle guard exists specifically
        to notice silence faster than the deadline does.

B.
 **Arm `STREAM_FIRST_BYTE_MS` (and `STREAM_IDLE_MS`) at a value grounded only in the CURRENT
    traffic,
past its observed maxima (183755 ms firstByte,
124992 ms gap),
setting aside the
    older RUN 014 regime as no longer representative.**
    -   For:
meaningfully faster than 360000 ms at catching a dead call,
and grounded in the
        largest,
freshest sample read,
7079 streams this month.
    -   Against:
this is a bet that RUN 014's regime,
a completed call at 347099 ms,
cannot recur,
        which is a bet about a two-person provider's infrastructure that the audit explicitly
        declined to make:
different stage shapes,
provider capacity,
routing,
and time of day are
        all unexcluded between the two readings.
A false trip is soft,
a retried call rather than a
        lost voice,
but it is not free:
each one re-buys a whole exchange.

C.
 **Arm both constants just under the deadline,
clearing every regime on record with minimal
    margin (roughly 350000).**
    -   For:
technically active and carries none of option B's regime risk,
since it clears even
        RUN 014's uncensored maximum.
    -   Against:
leaves ten seconds or less of daylight before the deadline would end the same call
        anyway,
so the benefit over option A is bounded by that same margin.
Worth the
        implementation and re-test cost only if there is an operational reason to want the guard to
        fire and log rather than relying on the deadline,
which nothing read for `#121` establishes.

### Ranking

A > C > B.

-   A over C,
    because C costs a real change for a benefit bounded at single-digit seconds per dead
    call;
    it is worth doing only for a reason beyond the seconds saved,
    such as wanting the guard's
    own logging on a dead call rather than the deadline's,
    and nothing gathered here shows that
    reason exists.
-   C over B,
    because C carries zero regime risk,
    clearing even RUN 014's 347099 ms,
    while B is the
    only option that knowingly accepts a documented historical near-failure as unlikely to recur,
    on a provider this codebase has already twice caught treating a small sample's maximum as a
    bound.

WHAT I WOULD DO IF YOU DELEGATE THIS:
A,
unchanged.
Revisit C only if there is a stated operational
reason to want the guard armed for its own sake,
and revisit B only after the July-to-August regime
shift gets an actual explanation,
which nothing read for `#121` provides.

DELEGATE

## Decisions I took without you, veto cheaply
