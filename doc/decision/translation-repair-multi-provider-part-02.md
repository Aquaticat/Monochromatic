# Translation repair: two providers, and the quota reader that was never wired, part 02

Part 02 of [Translation repair: two providers, and the quota reader that was never wired](translation-repair-multi-provider.md),
whose index lists every part in order.

## What has landed, continued

### The forty-round pass seats the writers, 2026-08-24

40 rounds,
ten models writing a candidate for the same slices
and every other model judging them:
2492 disinterested ballots against a pooled null of 13.48 percent.
That is past the ~284 ballots the twelve-round pass computed as the requirement
to separate the contenders it left tied.

The raw standing,
each rate over the rounds that model produced a candidate in:

    qwen3.8-max              27.0%   47 of 174 ballots, over 28 candidates
    hf:Qwen/Qwen3.8-27B      24.1%   61 of 253, over 37
    gemma-4-26b-a4b-it       18.3%   46 of 252, over 40
    hf:moonshotai/Kimi-K3    14.1%   36 of 255, over 40
    hf:openai/gpt-oss-120b   13.9%   35 of 252, over 40
    minimax-m3               12.3%   32 of 260, over 40
    deepseek-v4-pro-0813     10.7%   28 of 262, over 40
    deepseek-v4-flash-0731    8.4%   20 of 239, over 40
    hf:zai-org/GLM-5.2        8.2%   23 of 280, over 40
    NVIDIA-Nemotron-3-Super   3.0%    8 of 265, over 40

READ THE CANDIDATE COLUMN BEFORE THE RATE COLUMN.
Two models did not answer every round,
and a rate computed over the rounds a model survived
credits it for the rounds it skipped.
Charging each model zero for every round it missed:

    hf:Qwen/Qwen3.8-27B      22.3%   z  4.27   clears Bonferroni 2.81
    qwen3.8-max              18.9%   z  2.50   does not clear
    gemma-4-26b-a4b-it       18.3%   z  2.22   does not clear
    hf:moonshotai/Kimi-K3    14.1%
    hf:openai/gpt-oss-120b   13.9%
    minimax-m3               12.3%
    deepseek-v4-pro-0813     10.7%
    deepseek-v4-flash-0731    8.4%
    hf:zai-org/GLM-5.2        8.2%
    NVIDIA-Nemotron-3-Super   3.0%   z -4.99   the first established WORST

#### qwen3.8-max's headline is survivorship, and it was proved rather than asserted

The suspicion is cheap and the proof is not,
so the log was parsed into its 40 round segments
and the OTHER models' median answer length taken as a proxy for slice size.

Rounds `qwen3.8-max` missed ran a median of 588 characters.
Rounds it answered ran 366.
The ratio is 1.61,
Mann-Whitney `z = +3.51`,
`p ≈ 0.0004`,
and the quartiles barely overlap:
512 to 687 against 259 to 462.

THE PARSE VALIDATED ITSELF.
It found 12 missed rounds and 28 answered,
and 28 is exactly the candidate count the standing reports independently.

So the model that tops the raw table is the model that skips the large slices,
and it also took 29 cuts,
more than any other model on the roster.
It is a good writer of easy passages and absent on hard ones.

#### What was seated

`editorModelIds` and `refinerModelIds` both become:

-   `hf:moonshotai/Kimi-K3`,
    kept:
    40 of 40 candidates,
    at the null.
-   `hf:Qwen/Qwen3.8-27B`,
    kept:
    established in both passes,
    the only model clearing Bonferroni.
-   `gemma-4-26b-a4b-it`,
    seated:
    40 of 40 candidates,
    zero cuts,
    18.3 percent.

`hf:zai-org/GLM-5.2` leaves both seats.
It is below the pooled null in both passes,
and it was independently the second worst model on reliability.

`qwen3.8-max` is not seated and keeps every wide role.
A wide role loses one ballot when a voice is lost;
a three-seat stage facing quorum of two loses the stage.
Those are different bargains and the survivorship finding decides between them.

THE WRITER SEATS NOW CROSS PROVIDERS,
which none of them did before.
The argument runs BOTH WAYS and only one direction was written down at first.
Every previous writer seat was Synthetic-served,
so a Synthetic outage emptied the editor and refiner stages entirely
however well the router covered the wide roles.
Charm Hyper serves `gemma-4-26b-a4b-it`.

THE SYMMETRIC COST IS REAL AND WAS OBSERVED THE SAME DAY.
A run started 2026-08-24 15:36 UTC found Charm Hyper out of budget from its first second,
and the five models it refused were exactly the five Hyper-only ones:
`qwen3.8-max`,
`minimax-m3`,
`gemma-4-26b-a4b-it`,
`deepseek-v4-pro-0813` and `deepseek-v4-flash-0731`.
The five Synthetic-served models kept streaming and both meter endpoints kept reading.

So the seat that protects the editor stage from a Synthetic outage
also exposes it to a Hyper one,
which it was not exposed to before.
Under either outage the stage keeps two of three seats and clears quorum,
which is the property that matters and is why the swap still stands;
what changed is WHICH outage costs the seat,
not whether one can.
Before the swap,
all three writer seats fell together on a single Synthetic outage,
so the stage went from three-of-three exposure on one provider
to two-of-three on each.
That is the trade,
stated in full.

The wide roles were unaffected on the observed day:
they carry all ten,
so five going dark costs ballots rather than the stage.

#### Neither provider can be restored on demand, and that settles the seat

Stated by the owner on 2026-08-24,
correcting an assumption made when the
outage was found:

>   I cannot reset charm hyper on demand.
>   I can only reset synthetic,
>   and only sometimes.

So Charm Hyper capacity returns on its own schedule and cannot be bought back,
and Synthetic capacity can be restored only sometimes.
BOTH PROVIDERS GO DRY AND NEITHER IS RELIABLY RECOVERABLE.

#### Correction, 2026-08-25: half of that inference was wrong

The two sentences above the rule read more into the owner's words than they say,
and one half of it has since been falsified outright.

WHAT WAS STATED was that Charm Hyper cannot be RESET on demand.
WHAT WAS INFERRED was that its capacity therefore returns on its own schedule
and cannot be bought back.
Neither half follows from the quote,
and buying is not resetting.

On 2026-08-25 the owner bought 10,000 hypercredits
and `GET /v1/credits` read `10000` within the minute.
The balance had read `0` continuously through the whole of 2026-08-24,
before,
during and after a pass,
so there is no evidence it returns on its own schedule
and direct evidence it can be bought back.

Charm Hyper is a prepaid balance priced per token,
not a rate limit.
`package/module/translation-repair/README.md` now says so.

WHAT THIS DOES TO THE DECISION:
nothing,
and it strengthens the reasoning.
The count of editors each arrangement keeps when a provider goes dry does not rest on recoverability at all;
it rests on how many editors survive each provider going dry,
and those counts are unchanged.
The correction bears only on the quality-times-availability counter-argument,
where a Hyper outage now ends whenever the owner is willing to pay
rather than whenever the provider decides.
That raises Hyper's effective duty cycle,
which argues FOR the seat the section was already arguing for.

The claim that both providers go dry stands.
The claim that neither is reliably recoverable does not:
Synthetic recovers on its own schedule and resets only sometimes,
while Hyper recovers on purchase.

That is the fact the seating should be judged against,
and it argues FOR the
swap more strongly than the quality table did.
Count what each arrangement does when a provider goes dry:

    three Synthetic seats  Synthetic dry -> 0 editors, the stage is empty
                           Hyper dry     -> 3 editors, untouched
    two Synthetic, one Hyper
                           Synthetic dry -> 1 editor, a candidate is still produced
                           Hyper dry     -> 2 editors, quorum clear

The old arrangement had one outage that emptied the stage outright.
The new one has none.
An empty stage is a different kind of failure from a thin one:
a thin stage still produces a candidate to judge,
and the old shape's whole exposure sat on the provider the owner
can restore only sometimes.

THE COUNTER-ARGUMENT,
weighed and rejected.
A model that is dark contributes nothing,
whatever it scores when awake,
so the honest comparison is quality times availability.
The best Synthetic-served alternative for the third seat is
`hf:openai/gpt-oss-120b` at 13.9 percent against `gemma-4-26b-a4b-it` at 18.3,
which breaks even when Charm Hyper is up 76 percent of the time.
Hyper's duty cycle has not been measured,
so that ratio cannot be evaluated yet.
It does not decide the seat either way,
because it prices only the THIRD seat's marginal quality
while the count of editors each arrangement keeps prices the whole stage's survival,
and survival is the larger term.

THE OUTAGE TABLE STOPPED BEING AN ARGUMENT THE SAME AFTERNOON.
The 15:36 UTC pass reached the naturalness lane with Charm Hyper still dry
and logged both halves of the prediction within ten milliseconds
(log times,
UTC):

```text
17:01:28.240  chunk 2: nothing to edit, unchanged
17:01:28.250  refiner gemma-4-26b-a4b-it: NoProviderForModelError: no provider can take it
17:04:18.932  refinement from hf:Qwen/Qwen3.8-27B won
```

The newly seated Hyper model went dark in the seat it had just been given,
the stage ran on its two remaining seats,
and a refinement still won and shipped.
That is the two-of-three row of the table,
observed rather than reasoned about,
and it is the case the swap was defended on.

WHAT WOULD CHANGE THIS:
a measured Hyper duty cycle well under 76 percent,
at which point `hf:openai/gpt-oss-120b` takes the seat on quality as well.
Recording provider-dry intervals across runs is how that gets measured.

#### A first estimate off the existing logs, and why it does not decide anything

Every log already timestamps `NoProviderForModelError`,
so a first estimate needed no instrumentation and no quota.
759 agent logs were scanned,
and THE DENOMINATOR WAS VALIDATED BEFORE THE RATE:
a log written before the second provider existed cannot show a refusal,
so only the 26 that name a Hyper-only model can count as evidence either way.
Of those,
24 are wet and 2 are dry,
and they fall in one clean block each.

    wet   2026-08-24T09:41:17Z .. 14:58:53Z   24 logs, no refusal in any
    ????  14:58:53Z .. 15:04:28Z              nothing ran, 5m35s wide
    dry   2026-08-24T15:04:28Z .. 17:53:00Z   2 logs plus a model-health probe

Read as fractions of the 8h11m43s observed:
wet 64.6 percent,
dry 34.3,
unknown 1.1.
That is BELOW the 76 percent break-even.

IT STILL DOES NOT MOVE THE SEAT,
for three reasons,
and the third is decisive:

-   ONE TRANSITION IS NOT A DUTY CYCLE.
    There is a single wet-to-dry edge in the
    whole record.
    A rate over one event is the mistake this document already
    caught once today,
    in `qwen3.8-max`'s standing.

-   THE DRY INTERVAL IS RIGHT-CENSORED.
    It was still dry at the last observation,
    so 2h48m is a floor and the fraction could move either way once it lifts.

-   THE DRYNESS IS PROBABLY SELF-INFLICTED.
    A 40-round calibration ran 11:22 to
    14:32 UTC and spent 937 streams,
    and a corpus pass ran to 14:58 UTC.
    Hyper was dry by
    15:04 UTC.
    So this measures how fast heavy verification exhausts a budget and how
    long it takes to refill,
    which is a fact about the day's usage rather than
    about the provider.
    Production traffic has a different shape entirely.

WHAT WOULD SETTLE IT is the same measurement over days rather than one afternoon,
which is why the availability recorder persists transitions rather than sampling.
The number worth having is not the mean but the LONGEST dry interval,
since that is what decides whether a seat can be relied on at all.

`gemma-4-26b-a4b-it` carries `readsImages: false`,
which costs nothing in these seats.
Pictures are read in `image-reading-stage.ts` over `RUN_READER_MODELS`,
a roster derived from the catalog rather than written by hand,
and `document-lanes.ts` records that the repair lane never asks what a picture says.
Its catalog `maxOutputLength` of 25_600 is likewise not a constraint here:
nothing in production reads that field,
and the model answered 40 rounds of production-sized slices without a cut.

#### What this still does not decide

THE INSTRUMENT IS ONE STEP FROM THE SEAT IT WAS USED ON.
`producer-calibrate.ts` drives `runTranslateStage`,
so the thing measured is a model writing a slice from the SOURCE
while every other model votes on the result.
An editor and a refiner both write a slice and are both judged that way,
but from the archive text and a set of critic claims rather than from the source.

That gap is worth naming rather than glossing,
and the same honesty is what keeps this table off the checker seats.
It is nonetheless the nearest instrument that exists,
the seats it moved rested on NO measurement at all before this,
and the direction it points is not marginal:
the model leaving was below the pooled null in two independent passes
and second worst on reliability,
while the model arriving was above it with 40 candidates in 40 rounds.
An editor-role calibration would settle the seat outright.
It is not a variation on the existing runner:
the editor's input includes critic claims,
so the instrument has to buy a critic stage before it can ask an editor anything.

CHECKER SEATS.
`checkerModelIds` still seats `NVIDIA-Nemotron-3-Super`,
which this pass establishes as the worst WRITER on the roster at `z = -4.99`.
That is not evidence about checking.
The instrument measures who writes a candidate other models vote for;
a checker writes nothing.
Moving a checker seat needs a checker-side measurement,
and the checker-width measurement is the shape such a measurement takes.
Acting on this table would be reading the wrong instrument.

### Availability is now recorded rather than argued, 2026-08-24

The availability recorder was built because three writer seats sit on Charm Hyper only,
and the case for them rested on the forty-round quality pass
plus an availability adjustment that was reasoned about,
never measured.
Two things were missing:
a record,
and a way to read it.

#### The record already existed and was invisible

`provider-budget.ts` reads both meters on a sixty-second cache
and already decides dry from wet for routing.
It was saying so at `debug`,
which a corpus run does not record.
Promoting that one line to `info` turns every future run
into an availability record at no extra cost,
bounded by the freshness window rather than by call volume,
so a busy run and a quiet one both cost about a line a minute.

Refusals cannot substitute for it.
`NoProviderForModelError` appears only where something happened
to ask for a model that provider serves,
so an hour when nothing asked reads exactly like an hour when everything worked.
That is why the earlier estimate off 759 existing logs
could find only 26 that could have shown a refusal at all.

#### An unreadable meter was reading back as an available provider

Found while building the reader,
before it produced any number.
`drynessOf` returned `false` both when a meter reported budget
and when the meter could not be read at all.
For routing that is deliberate and stays:
a monitoring failure must not become an outage.
For the record it is backwards,
because a duty cycle counting an unreachable endpoint as a working provider
reports an outage as uptime.

The meter now answers with `wet`,
`dry` or `unreadable`,
and `routesAsDry` maps that back to the bit the router wants.
Routing behaviour is unchanged;
the existing test that an unreadable meter stays spendable passes untouched.

#### Every outage is a range, and the denominator excludes non-answers

Readings happen when a run asks to spend,
so two can be a minute apart or a day apart.
An outage seen at one reading and gone by the next
began and ended somewhere in between.
`meter-report` therefore reports a confirmed lower bound,
an upper bound running to the surrounding wet readings,
and names an end open where no wet reading closes it.
Only `wet` proves recovery and only `dry` proves outage,
so an `unreadable` reading ends a confirmed stretch without closing its bound.

The duty cycle divides by readings that answered.

#### What this still does not decide

The record starts empty.
It measures availability WHEN WE WERE ASKING,
which is the quantity that prices a seat and is not the same as availability,
and `budget-sample` exists to fill the quiet stretches
so a recovery gets observed rather than inferred.

Nothing here re-opens the seating.
It replaces an argument with an instrument,
and the instrument has one reading in it:
2026-08-24T18:17:35Z,
`synthetic=wet hyper=dry`,
which is the same outage the roster probe found earlier that day.

### The editor seats get their own instrument, 2026-08-24

That instrument was started on a self-correction recorded in "The forty-round pass seats the writers,
2026-08-24"
(its "THE INSTRUMENT IS ONE STEP FROM THE SEAT IT WAS USED ON" paragraph):
the forty-round pass was described as measuring the job both stages do,
and it does not.
`producer-calibrate.ts` drives `runTranslateStage`,
a model writing English from Chinese with nothing in front of it but the source.
An editor is handed archive text,
a set of adjudicated claims against it,
and a window of neighbouring prose,
and asked to repair what the claims name without disturbing what they do not.

#### The blocker turned out not to exist

The task was held because a settled artifact exposes
neither the envelopes nor the issues an editor worked from,
so the claims could not be replayed,
and the choice looked like extending the artifact schema
or inventing claims as fixtures.

Reading the contracts settles it differently.
`ChunkRepairOutcome.rounds` already carries,
per round,
the slate judges saw with each candidate's producer attached,
and every ballot cast over it.
That is `SelectionRound` one re-shape away,
and both sides name the same `CandidateProducer` and `SelectionBallot`.

So the calibration drives the lane live and reads the rounds it records.
Nothing is replayed,
nothing is stored,
and no artifact field changes.
The claims an editor works from are claims models really raised about that passage.

#### What the shape commits to

Every model edits every slice and every model judges,
for the reason the writer calibration gives:
a narrow slate compares only the models that happened to be seated.

A declined round counts.
A standing counts votes rather than wins,
so dropping the rounds that failed to resolve
would keep only the slates judges found easy.

The refiner standing is reported off the same spend,
because the refine rounds are recorded beside the editor's
and belong to a different seat.

Checkers self-certify,
here and nowhere else.
Production forbids a checker proving its own repair,
and a full editor roster leaves nobody independent when the roster is ten.
Rotating editors out would reintroduce the survivorship the shape exists to avoid.
It is safe for this measurement because checking runs after selection:
the ballots a standing reads are cast before any checker is asked,
so self-certification can move how many rounds happen,
not who won the ones that did.

#### What it does not yet decide

Nothing,
until it runs on a full roster.
Charm Hyper has been dry all day,
so a run now would seat five of ten
and produce exactly the survivorship the shape was built to prevent.
The instrument exists and is verified to execute;
the measurement waits on availability,
which `budget-sample` now makes observable.

#### What the first run of it showed

Zero rounds,
on one slice,
in 7m18s.
That is the lane working rather than the instrument failing:
critics raised two claims,
the panel adjudicated two issues,
and the lane then reported nothing to edit,
because neither issue was accepted.

ADJUDICATED IS NOT ACCEPTED.
A slice can buy ten critics and a ten-model panel
and contribute nothing to an editor standing,
so the sample has to be drawn on the rate of ACCEPTED issues,
not on the rate of claims.
Both seats now report how many slices paid in beside the round count,
because a standing drawn entirely from one slice
reads identically to one drawn evenly from six otherwise.

A null from a probe never shown able to produce a non-null decides nothing,
so the reading chain now carries a positive control:
projection and tally driven together over real-shaped rounds,
asserting a standing with its counts.

### `qwen3.8-max` is culled, 2026-08-28

The owner authorized removing `qwen3.8-max` from the pipeline because its metered cost is disproportionate
and exceptionally expensive.
This supersedes the 2026-08-24 decision that kept it in wide roles.
No replacement was requested or selected;
the operational roster narrows from ten models to nine.

The removal reaches every active path:

-   `RosterModelId` no longer admits it.
-   Charm Hyper catalog no longer allowlists it.
-   Corpus critics,
    translators,
    judges,
    pairing,
    coverage,
    picture reading,
    repair panels,
    and consolidation no longer
    seat it because they derive from the roster.
-   The request builder no longer carries its automatic-tool exception;
    every remaining Hyper model uses forced tool
    choice.

Dated pricing and spend parsing keep the old label so historical run artifacts can still be accounted.
Historical measurements remain evidence about their recorded ten-model roster and are not rewritten as current runs.

Rollback requires an explicit owner decision plus new cost evidence.
Restoring it would require adding the model to roster identity and Hyper catalog together,
then rebuilding and validating
consumer-boundary routing before any live corpus run.

### Synthetic GLM-5.2 is replaced, 2026-08-29

The requested operational change replaces Synthetic `hf:zai-org/GLM-5.2` with
`hf:zai-org/GLM-5.3-Flash` because the live endpoint confirmed the successor and the operational request reported
Synthetic's plan to retire the older model.
This is an availability-driven replacement,
not a claim that the successor inherits any GLM-5.2 performance result or calibrated role standing.
It enters catalog-derived broad-roster and image-reading paths only;
it does not inherit an editor,
refiner,
checker,
or default benchmark-judge seat.

The provider's live model endpoint reports the successor as always-on beta with text and image input,
a 524288-token context,
a 65536-token output ceiling,
and support for tools,
JSON mode,
structured output,
and reasoning.
The package client completed 20 of 20 schema-constrained calls,
the full roster health probe heard all nine seats,
and the image-reading boundary produced a usable transcription without recording its text here.

The replacement reaches every active broad-roster path through the catalog-derived roster.
The old `glm-5.2` Charm Hyper spelling also leaves the active allowlist:
it identifies GLM-5.2,
not GLM-5.3-Flash.
Hyper's live catalog still listed `glm-5.2` but no GLM-5.3-Flash spelling on 2026-08-29.
It reported `glm-5.2` vision false that day,
changed from the vision-true catalog reading recorded on 2026-08-24.
Dated Hyper pricing retains `glm-5.2` for historical spend accounting.

Wire and modality conformance do not establish translation quality.
Fresh schema-9 actual-output validation is required before the replacement contributes readiness evidence.
Historical GLM-5.2 measurements retain their recorded name and do not transfer.

### Nemotron leaves every stage, 2026-08-29

The owner removed `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` from every stage after adjacent
required-correction reviews contradicted one another:
it first proposed concrete wording,
then was sole reviewer rejecting candidate that used it while other eight approved.
This is direct evidence from role owner removed it from,
not inference from unrelated writer calibration.

Removal reaches roster identity,
Synthetic callable catalog,
whole-roster production stages,
explicit checker roster,
and default restoration-benchmark judges.
Historical artifacts,
provider observations,
and dated measurements keep departed id as evidence rather than being rewritten.
Operational roster narrows from nine models to eight.
Broad-stage quorum moves from five to four,
equal to entire Synthetic side.
Every production stage now starts straggler grace at exact-half participation rather than requiring every seat.
A stage may therefore settle while all four Hyper seats are dark;
that is degraded evidence and cannot establish readiness.

Checker roster cannot simply shrink to two because `MINIMUM_CHECKER_COUNT` refuses roster below three.
Kimi-K3 takes departed seat.
It already participated among added voices in 231-round wide checker comparison where added voices changed zero
resolution verdicts.
That establishes compatibility with checker ensemble,
not independent optimality of replacement seat;
fresh checker-seat calibration remains open.

GPT-OSS takes departed default restoration-benchmark judge seat because it already serves production checker and
judging roles that seat the whole configured roster while settling at exact-half participation.
No benchmark-specific calibration is inferred from that role overlap.

GLM-4.7-Flash remains absent from roster identity,
callable catalogs,
and every typed active stage.
Interrupted schema-9 pass launched immediately before this cull logged zero GLM-4.7-Flash model labels and was stopped
when roster changed.
No translation-repair process remained alive afterward.
That evidence rules it out as caller in interrupted pass,
but does not identify source or time window of calls observed outside pass log.
Widened same-day validation,
review,
replay,
and probe-log search found zero GLM-4.7 call labels;
remaining matches were live provider catalog listings or historical stream-parser test names.

Same catalog read showed `syn:large:text` had moved to GLM-5.3-Flash,
while current rate-limit documentation names Kimi-K3 as one-request baseline.
Planning denominator therefore moves to Kimi-K3 input price without admitting any alias to roster.
Diagnosis and consumer-side guard are recorded in
`doc/troubleshooting/synthetic-rate-limit-default-drift.md`.

### Exact-half validation stopped and generation 13 follows, 2026-08-29

Commits `97fda9f95` and `68c37da59` add repeated absolute acceptance and exact-half participation.
Generation-12 `Weideriche_` and pull-request 386 `Carena0442` processes were stopped.
`Weideriche_` first attempt refused absolute naturalness after 4,840,305 milliseconds,
wrote no artifact or page,
and incorrectly queued whole-entry reattempt.
Carena process stopped after same-model same-prompt repetition was rejected as independence mechanism.
Neither root is publication,
readiness,
or completion-time evidence.

Generation 13 continues correction from latest exact rejection
and uses distinct defect-discovery and acceptance-challenge responsibilities.
Generation 14 threads every reviewed rejection into strategy history
and durably memoizes model-plus-canonical-prompt payloads under run root.
Exact duplicates and interrupted replay reuse first payload without another provider call.
One configured or wet provider is valid normal operation;
absent provider is dry,
and exact-half participation may come entirely from other provider.
No provider family or cross-provider response is mandatory in ordinary operation.
Measured arms requiring both pass `--require-providers synthetic,hyper`;
harness checks both keys and live meters before model calls.

Stopped runs shared provider capacity,
so their durations do not compare provider performance.
Fresh Carena median below two hours is objective before broader launch,
without weakening quality.
Fresh artifact,
publication verification,
complete-page reading,
and checker calibration remain required before readiness claim.
