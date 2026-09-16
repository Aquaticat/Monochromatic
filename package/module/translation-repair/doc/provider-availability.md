# Provider availability, measured

Part of [the package README](../README.md).

## Eight-seat schema-9 latency diagnosis

Fresh eight-seat `Weideriche_` validation from `88049530a` failed closed after first entry spent
6,433,300 milliseconds.
It wrote no page or artifact;
operator stopped second entry after first terminal refusal.
Matched prior first entries took 3,014,684 and 3,774,160 milliseconds.
This was active work rather than deadlock:
round logs assign 4,797,358 milliseconds,
79.96 minutes,
to post-quorum grace.
GLM-5.3-Flash reached 180,000-millisecond grace cap eleven times,
compared with two and four in matched runs.
Current pass also bought more quality work,
including twenty-seven consolidation rounds compared with ten and fourteen.

Exact final-candidate replay heard all eight seats.
Seven accepted;
GPT-OSS returned one idiomatic-naturalness finding in paragraph three.
Affected phrase preceded second correction and survived all three second-correction proposals.
Previous-candidate replay was also unacceptable,
with GPT-OSS and DeepSeek Flash each returning one different finding;
adjacent GPT findings did not match.
Evidence supports iterative defect discovery,
not claim latest required finding was ignored.
Final floor correctly refused publication after correction cap.
No reviewer wording or corpus wording is retained in readiness record.

Existing round logs proved aggregate cause,
but lacked active consolidation slice,
terminal consolidation exit,
and per-seat absolute-review status.
Pipeline now logs `SLICE-START` plus `SLICE-COST` for consolidation,
distinguishes cache reuse,
unsettled,
failure,
and abort exits,
and reports only absolute-review seat ids,
statuses,
finding counts,
paragraph numbers,
and wording digests.
See `doc/troubleshooting/translation-repair-schema9-latency.md`.

No GLM-5.2 quality result or role calibration transfers to GLM-5.3-Flash.
It enters only catalog-derived broad-roster and image-reading paths;
it does not inherit an editor,
refiner,
checker,
or default benchmark-judge seat.
Admission evidence is replacement-specific:
the live endpoint facts were read on 2026-08-29,
the package client completed 20 of 20 schema-constrained calls,
the full roster health probe heard all nine seats,
and the image-reading boundary returned a usable transcription without exposing its text.
The image-boundary call completed in 78.4 seconds,
inside the production 360-second per-call deadline.
One call does not characterize its latency tail and does not justify a timeout change.
These checks establish wire and modality compatibility,
not actual-output quality.
Fresh schema-9 passage validation remains mandatory before this replacement contributes readiness evidence.

## Running out of budget is normal, and the two providers run out differently

THEY ARE NOT THE SAME KIND OF LIMIT,
and an earlier version of this section had Charm Hyper backwards.

Charm Hyper is a PREPAID BALANCE,
priced per token and per model.
`GET /v1/credits` returns `balance`,
which `parseHyperCredits` reads and the `METERS` line prints as `hyperBalance`.
Spending draws it down and it does not refill on a schedule:
it read `0` continuously across the whole of 2026-08-24,
before,
during and after a pass,
and reached `10000` on 2026-08-25 only because credits were bought.
A reader who hits `hyperBalance=0` and waits is waiting for something that has not been observed to happen.

Synthetic is a SUBSCRIPTION ALLOWANCE,
weekly and five-hourly,
which the `METERS` line prints as `syntheticWeekly` and `syntheticFiveHour`.
That one does refill on its own schedule,
and the account owner can sometimes reset it,
but not reliably and not on demand.

Plan a pass around both facts rather than around a clean window,
because a clean window still cannot be arranged.

A provider that is out of budget does not fail a run.
The budget layer raises `NoProviderForModelError` for each model no reachable provider can take,
the stage records a lost voice,
and the run continues on whoever answered.
On 2026-08-24 a pass ran with Charm Hyper dry from its first second:
the five Hyper-only models were refused,
the five Synthetic-served models kept streaming,
and both meter endpoints kept reading.

TWO CONSEQUENCES FOR READING A RUN.
A per-entry cost measured while a provider is dry is not the cost a two-provider run pays,
and should be labelled with the outage.
Any quality figure measured then rests on whoever was awake,
so five of ten models contributed nothing to it.

## Measuring how much of the time each provider was there

Three writer seats sit on models only Charm Hyper serves,
and until 2026-08-24 the argument for them rested on a quality pass
plus an availability adjustment that was reasoned about rather than measured.

The budget layer already read both meters every sixty seconds and already knew dry from wet,
but said so at `debug` level,
which a run does not record.
It now says so at `info`,
as one line per reading:

```text
[info] [2026-08-24T19:22:07.104Z] [translation-repair] [takeReading] METERS synthetic=wet hyper=dry syntheticWeekly=97% syntheticFiveHour=48/50 syntheticThrottled=no hyperBalance=0
```

Three states,
not two.
A meter that could not be reached at all reads as `unreadable`,
which still routes as spendable,
because a monitoring failure must not become an outage.
It is kept distinct in the record because a duty cycle
that counted an unreachable endpoint as a working provider would report an outage as uptime.

The numbers after the states are what those states were decided from,
and they are there because the verdict alone could not be checked.
`hyper=dry` is equally what an empty balance and a wrong threshold in `budget-routing.ts` look like,
and separating them once took a live call to the provider,
which no longer exists for a moment already past.
Each provider's numbers and its verdict come off one read,
so they can never describe different instants.

They also separate causes that route identically.
Synthetic goes dry when its weekly budget empties,
when its rolling window empties,
or when the account is actively throttled;
those are one bit at the router and three different problems to a reader.

A field the reader has never been taught the name of is carried through,
because a level is defined as any field whose value is not a meter state.
Records written before the numbers existed carry states alone,
and the report names that rather than printing nothing.

Read a collection of those lines back with `meter-report`,
passing one or more log paths after `--`.
It spends no quota:

```sh
mise run //package/module/translation-repair:meter-report -- run3.log run4.log
```

It reports,
per provider,
how many readings fell in each state,
the fraction of answering readings that found budget,
and the longest outage as a range.
The range matters.
A reading happens when a run asks to spend,
so two readings can be a minute apart or a day apart,
and an outage seen at one and gone by the next began and ended somewhere in between.
An outage with no wet reading before it,
or none after it,
is reported open rather than as a number,
since it may have started before the record or may still be running.

Every figure is availability WHEN WE WERE ASKING,
not availability.
That is the quantity that prices a seat,
and it is not the same thing.

## Sampling between runs, so a recovery gets observed

An outage that stops a pass also stops the readings,
so nothing observes when the provider came back,
and every outage that ended a run reads as open-ended forever.

```sh
mise run //package/module/translation-repair:budget-sample > sample.log 2>&1
```

One reading of both meter endpoints.
No model is called and no token is produced;
a live run took 2.4 seconds.
Capture both streams:
the reading is at `info` and an unreadable meter warns at `warn`.

Repeat it on a timer to fill the quiet stretches,
for example `watch --interval 300`,
and point `meter-report` at the collected logs.
