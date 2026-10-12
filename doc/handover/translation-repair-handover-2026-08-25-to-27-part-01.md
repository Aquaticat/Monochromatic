# Translation repair handover snapshots: 2026-08-25 to 2026-08-27, part 01

Part 01 of [Translation repair handover snapshots: 2026-08-25 to 2026-08-27](translation-repair-handover-2026-08-25-to-27.md),
whose index lists every part in order.

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01,
and no corpus run,
model call,
spent-prompt retry,
or successor implementation is authorized by this snapshot.

## Superseded handover snapshot through 2026-08-27

Status:
the two-lane pipeline and all five per-slice overlap drivers are built;
whole-package suite passed 832 cases before live measurement.
The corpus overlap smoke pair settled and verified `keyword233` at overlap 1 and 4;
overlap 4 reduced normalized wall time from `0.383` to `0.291`.
The `Toka_ls` overlap-4 arm then settled 15 slices at normalized `0.147`,
but actual output reading found page not publishable:
linked death paragraph was recorded `gap-remains` and knowingly omitted.

That blocker is fixed in source.
Pass now asks whole-document coverage roster about every source-only slice;
admission requires verdict `absent` plus page shortfall or missing destination;
any remaining unfilled passage fails before artifact and publication.
Inherited invisible variants are folded before preparation.
Focused suites,
lint and five guard-failure mutations are green.
The matched old-digest serial `Toka_ls` arm settled in 313.24 minutes at normalized `0.420`;
overlap 4 reduced wall time 66.7 percent and normalized wall time 64.9 percent,
with same 61 unheard voices in both arms.
First whole-package suite exposed `UnfilledPageError` missing from names-only message inventory;
`d5b448754` classified its entry id,
counts and slice indexes.
Rerun passed 834 cases with zero failures;
log `~/temp/agent/buildAndTest-toka-gap-fix-v2-20260827.log`.
Current ten-model coverage control passed:
two targeted cuts flipped from `carried` to `absent` with 10 and 9 votes,
third moved to `partly-carried`,
and all three equal-size decoys received zero absence votes.
Both providers stayed wet.
Fixed-build `Toka_ls` overlap-4 rerun restored linked paragraph,
settled 15 wordings with zero silent,
retained source URL and removed all U+FEFF.
At 180-second grace strict reread still failed inherited first-person intrusion:
repair fixed it,
translate retained it,
and 8 heard contest voices split 4 to 4.
Same-digest overlap-4 rerun at 300-second grace recovered page:
15 complete slices,
35 voices unheard,
127.43 minutes wall over 15.15 call-hours,
normalized `0.140`,
with both providers wet.
Strict first and independent readings find no blocker or major;
page is publishable as-is.
Declined-archive seam remains open:
slices 3 and 11 had archive declined,
consolidation bought nothing,
and assembly revived archive.
No old-digest `Toka_ls` page is readiness evidence.
`doc/audit/translation-repair-output-reading-20260826.md` carries full trace;
`doc/planning/translation-repair-corpus-overlap-measurement.md` carries arm protocol.

WHAT THIS FILE IS.
What a session starting today needs,
and nothing else.
Capped at two thousand lines.
When it reaches that cap,
its oldest sections move verbatim into
`doc/handover/translation-repair-history.md`,
which has no cap.

WHY THE SPLIT.
This file reached twenty thousand lines,
at which point it stopped being a handover
and became an archive nobody could read at the start of a session.
The history keeps every measurement;
this keeps the working set.

THERE IS NO RELEASE DEADLINE.
The owner withdrew the one that used to sit here,
on the grounds that being aware of it
made the work worse:
it bought lower quality and,
more than once,
took longer anyway.
Do not reintroduce a date,
do not infer schedule pressure from anything in the archive,
and do not let "time remaining" enter any decision.
Quality is the only standing constraint.

ADVISOR IS A STANDING INSTRUCTION.
The owner has asked for it twice,
the second time in these words:
"Please call advisor as usual.
This is standing instruction."
Call `advisor` at the normal checkpoints:
before committing to an approach,
when stuck,
when changing approach,
and once more before declaring anything done.
An earlier session barred the tool on the grounds that it forwards the whole transcript
and the transcript names corpus entries from an unlicensed archive.
That bar is superseded and must not be reinstated.
The owner knows what the transcript carries,
has said so about this corpus more than once,
and has made the call.
Re-raising it at every invocation is the failure mode to avoid:
the concern is recorded here once,
and that is the whole of it.

WHAT BELONGS HERE.
Open tasks and their state,
decisions still in force,
defects not yet fixed,
and any measurement a reader would otherwise re-run.
What belongs in the history:
closed work whose conclusion is already encoded in the code,
and superseded reasoning kept only for its evidence.

## FIXED: half the roster was sent to a provider that cannot serve it (`#235`, 2026-08-25 to 2026-08-26)

STATUS 2026-08-26:
fixed in `8b289c3ab`,
guards in `e0010019f`,
each guard shown to fail with its fix line removed,
verified live the same day (see "State of the tree" under the audit section,
now in the history);
`doc/troubleshooting/synthetic-hf-prefix-misroute.md` holds the located cause and the fix.
The body below is the diagnosis as it stood while the cause was being located,
kept for its evidence.

This is the most important open item in this file,
and it is unfixed.
It was found while running arm A of the `#213` overlap measurement,
and it invalidates that run.

### What happened

The run was the serial control arm:
`TRANSLATION_REPAIR_SLICE_OVERLAP=1`,
four slices,
the full ten-model roster.
Log at `~/temp/agent/overlap-arm-serial.log`,
887 lines;
run directory `~/temp/agent/overlap-arm-serial`.
It started at 01:54:46 UTC and ended at 02:15:58 UTC,
about twenty-one minutes,
and it exited cleanly:
no refusal line,
no fault line,
all four slices reported.

Every single round it logged heard five of ten voices.
Twenty-five rounds,
`5/10 heard` on all twenty-five,
no exceptions.
(Re-measured 2026-08-26 with `grep -oE 'round: [0-9]+/[0-9]+ heard'`.
The first count here was twenty-two;
it came from a narrower anchor that required a stage prefix,
and every round is `5/10` under either anchor,
so the substance stands.)

The five that were lost are exactly the five Charm Hyper endpoint labels,
the ones whose identifiers do not carry an `hf:` prefix,
and each of them failed on every call it made:

```text
model                                              http400  streams
  qwen3.8-max                                           25       25
  minimax-m3                                            25       25
  gemma-4-26b-a4b-it                                    25       25
  deepseek-v4-pro-0813                                  25       25
  deepseek-v4-flash-0731                                25       25
  hf:zai-org/GLM-5.2                                     0       26
  hf:Qwen/Qwen3.8-27B                                    0       25
  hf:moonshotai/Kimi-K3                                  0       25
  hf:openai/gpt-oss-120b                                 0       25
  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4      0       25
```

A hundred percent failure rate on five models,
a zero percent failure rate on the other five.
The provider's own words,
which are the giveaway:

```text
SyntheticHttpError: provider API returned HTTP 400:
{"error":"Your model name should start with an hf: prefix; for example: ...
```

Synthetic was handed five models that only Charm Hyper serves,
and said so,
125 times.

### Why nobody noticed

Quorum is five of ten.
The five surviving models are exactly enough to meet it,
so every round stood,
every slice settled,
and the command exited zero.

The resilience work is what hid this.
`#199` and the multi-provider landing made the pipeline survive a provider going away,
and it did survive:
it produced a complete,
well-formed,
four-slice calibration.
It just produced it from half the roster.
CORRECTED 2026-08-26:
it did not say "nothing above `warn`".
The calibration's closing coverage line (`producer-silence.ts:222`,
printed by
`editor-calibrate.ts:359-367`) named all five dark seats twice,
as
`WROTE NOTHING AT ALL: ... covers 5 of 10 seats`.
What was missing:
per-seat call and failure counts,
the failure class
(the line itself says a budget refusal,
a refused sheet and a timeout all look alike from there),
any such line in the pass or the other 36 CLIs,
and anything louder than stdout prose under exit 0.
Audit finding `calibrate-1` in `doc/audit/translation-repair-package-audit.md`.

That is the defect to fix,
and it has two halves that should not be conflated:

1.  **The routing half.**
    A model that only one provider serves must never be offered to the other one.
    CAUSE LOCATED 2026-08-26,
    and it is NOT `src/budget-routing.ts`.
    That file and `src/roster-reach.ts` were read in full and are correct:
    a bare Charm Hyper label derives `{ onSynthetic: false, onHyper: true }` and routes to Hyper.
    The misroute is the single-provider fallback in `createRunClient`,
    `src/corpus-run/run-config.ts:611-617`:
    when `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY` is unset it returns the bare Synthetic client,
    and that client sends whatever model id it is handed to the wire with no catalog check
    (`src/synthetic-client.ts:265`).
    The log proves the process had no Hyper key:
    `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY is not set` appears four times,
    once per slice,
    and no `METERS ` line exists at all,
    because the routing client was never built.
    How the key went missing:
    arm A was launched with `nohup env ... node dist/final/node/editor-calibrate.mjs 4`
    directly from the fork worktree `~/worktrees/tr-overlap`,
    which has no `.env.local.json`,
    so nothing injected secrets;
    the process inherited whatever that shell happened to hold.
    The earlier pointer at `budget-routing.ts` was written after reading sixty lines of it,
    and was wrong.

2.  **The silence half.**
    Losing five of ten voices for an entire run should be loud.
    Right now it is a `warn` per call,
    a `5/10 heard` per round,
    and one closing coverage
    sentence in the two calibration CLIs that names the seats but not the counts or the cause.
    A run that finishes with a model at a hundred percent failure should say so at the end,
    in its own summary,
    where a reader who is not grepping will see it.

### What this costs, and what is now void

The arm A measurement is void as a ten-model measurement.
Do not read wall clock,
concurrency,
or overlap conclusions off it.
Arm B,
the `TRANSLATION_REPAIR_SLICE_OVERLAP=4` arm,
was never launched;
`~/temp/agent/overlap-arm-four.log` does not exist.
Both arms need re-running after the routing fix,
back to back,
and that re-run also pays the recovery rate owed by `#230`,
since it will carry `91f0c8ba5`.

`#213` therefore stays open,
and it is now blocked on this defect rather than on quota.

This also blocks `#219`.
Production readiness cannot be signalled while one provider's absence
silently halves the roster and the run still reports success.

### Three instruments that lied, and how to not be fooled again

Recorded because each one cost real time in this session.

1.  **The run log stamps are UTC,
    and the machine is on EDT.**
    A line reading `02:11:48` was written at `22:11:48` local.
    Reading them as local time makes a live run look like it died twenty hours ago.
    Compare against `date -u`,
    never against `date`.

2.  **Node's `comm` on this machine is `node-MainThread`,
    not `node`.**
    Scanning `/proc/*/comm` for exactly `node` finds nothing and looks like proof of death.
    Match on a `node*` prefix,
    or match the `cmdline` instead.

3.  **`pgrep -f PATTERN` matches the shell that is running it.**
    A waiting loop whose own command line contains the pattern never exits.
    This has now cost three separate incidents,
    including one where a kill loop
    killed its own shell and returned exit 144.
    List PIDs first,
    confirm the kind from `/proc/<pid>/comm`,
    then kill by number
    from a command that does not contain the pattern.

### Exactly where to pick this up

- The cause is `createRunClient` in `package/module/translation-repair/src/corpus-run/run-config.ts`;
  the fix design (require the Hyper key,
  catalog guard in the Synthetic client,
  process-scoped seat tally reported by `reportingRefusals`,
  `RunConfigError` as a stated refusal)
  is recorded on `#235`,
  advisor-reviewed,
  and held until the `#236` audit closes.
- Launch rule from now on:
  a run starts through `mise run //package/module/translation-repair:<task>`
  from a worktree that holds `.env.local.json`,
  so sops injects BOTH keys.
  A fork made with `git worktree add` has no secrets file.
  Never `nohup env ... node dist/...`.
- The fix needs a test proven per `GFP`:
  a non-`hf:` model with Synthetic live must never produce a Synthetic call,
  and the test must be shown to fail with the fix removed.
- The overlap prototype itself is built and lint-clean but NOT committed.
  It lives in the fork at `/var/home/user/worktrees/tr-overlap`,
  detached at `166b08e81`,
  and its two files are saved at `~/temp/agent/proto-slice-overlap.ts`
  and `~/temp/agent/proto-editor-calibrate.ts`,
  with a drafted,
  unlanded test at `~/temp/agent/proto-slice-overlap.unit.test.ts`.
  Because the fork is pinned to an older commit,
  recreate it from the new head
  and reapply those two saved files rather than patching the stale checkout.

## The writers are seated, and the queue is being verified live

2026-08-24,
after the 40-round producer calibration landed.

### The seating

`editorModelIds` and `refinerModelIds` are now
`hf:moonshotai/Kimi-K3`,
`hf:Qwen/Qwen3.8-27B`,
`gemma-4-26b-a4b-it`.
`hf:zai-org/GLM-5.2` left both seats and `qwen3.8-max` was not given one.
The whole standing,
both raw and availability-adjusted,
the Mann-Whitney proof that `qwen3.8-max`'s top headline is survivorship,
and the reason the same table must NOT be used to move a checker seat,
are in `doc/decision/translation-repair-multi-provider.md`
under "The forty-round pass seats the writers,
2026-08-24".

Two reach checks ran before the swap,
since `gemma-4-26b-a4b-it` is text-only
and Hyper-served:

-   Pictures never reach these stages.
    `document-lanes.ts` records that the repair lane edits in place against critic claims
    and none of its stages asks what a picture says,
    and reading is its own stage over `RUN_READER_MODELS`,
    which `run-config.ts` derives from the catalog rather than listing by hand.

-   The catalog's `maxOutputLength` of 25_600 is not a bound this model runs into.
    Nothing in production reads that field at all,
    and the model answered 40 rounds of production-sized slices with no cut.

Structured output was checked too,
because these seats emit schema-guarded JSON:
across 937 completed streams in the calibration
there was exactly ONE schema mismatch,
and it was `qwen3.8-max`'s.
`gemma-4-26b-a4b-it` had none.

### The live verification of `#196`

The queue was GFP-proven but had never run against a provider.
It does not need XingZ60's thirteen hours to be exercised:
the mechanism is size-independent,
so a mid-sized entry under a deliberately tight cap runs the same code path.

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=5 \
      mise run //package/module/translation-repair:corpus-pass -- --only MocaKawai

`--only` already existed;
nothing had to be built to bound this.
What the run has to show is a `REATTEMPT MocaKawai queued` line,
an attempt count above one in the run's attempt map,
and a cache that grew between attempts.

A useful thing fell out of reading the cache layer for this:
`countCachedSlices` counts every `.json` under the entry's cache directory,
and `slice-cache-namespace.ts` gives pairing,
contest,
refine and translate records
that same suffix and that same directory.
So an attempt that spends its entire cap buying only a section pairing
still registers as progress and still earns its re-attempt.
Had setup cached somewhere else,
the largest entries,
the ones this was built for,
would have stalled on their first attempt every time.

### What the first live run proved, and the defect it exposed

Run 1,
`--only MocaKawai` under a 5-minute ceiling,
into a throwaway runs dir.
It exercised BOTH branches of the re-attempt policy in one invocation
and then exited cleanly,
exit 0,
in 601.84s:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 5 minutes rather than the built-in 420
    TALLY MocaKawai status=ERROR ms=300002 aborted=true error=Timeout: MocaKawai exceeded its 300000ms deadline
    REATTEMPT MocaKawai queued: cached 2 more slices, so the next attempt starts further along
    TALLY MocaKawai status=ERROR ms=300004 aborted=true error=Timeout: MocaKawai exceeded its 300000ms deadline
    STALLED MocaKawai: its 2 cached slices are what it started with,
    so a further attempt in this invocation would repeat it
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=600008ms

`attempts.json` read `{"MocaKawai": 2}`,
so the second attempt happened inside the SAME invocation
against the same `sha256-tree-v1:38a0fcb...` digest.
That is the whole of what `#196` said was untested.

THE RE-ATTEMPT REALLY DID START FURTHER ALONG,
and the timestamps show it.
Attempt 1 reached "both lanes over 13 slices" 45 seconds in,
after buying two block pairings.
Attempt 2 reached the same line 0.16 seconds in,
off those cached pairings.

The two records it banked were both `pairing.` files rather than repair slices,
which is the cache-layout fact working exactly as intended:
`countCachedSlices` counts every `.json` in the entry's directory,
so setup progress earns a re-attempt.

#### The ceiling has a floor, and nothing said so

Attempt 2 banked nothing and the entry stalled.
The cause is not the queue:
`RUN_PER_CALL_TIMEOUT_MS` is 360_000
and the ceiling was 300_000,
so every attempt was cut BEFORE any single exchange was allowed to return.
No exchange returned,
so no slice cached,
so no progress could be read,
so the queue correctly dropped the entry.

Every component behaved as designed and the run explained none of it,
while five minutes looks like a perfectly reasonable ceiling to set.
`capOutlastsOneCall` and `capTooTightNote` now catch it and print
`CAP TOO TIGHT` naming both numbers.

WARNED RATHER THAN REFUSED,
deliberately:
cutting mid-exchange is exactly what a test of the stall path wants,
and refusing would have blocked the run that found this.
GFP-proven at the equal-values boundary,
which is the case a `>=` would silently accept.

This also answers half of `#196`'s open question about raising the cap by slice count.
Any such rule has a hard floor at one exchange deadline,
and a practical floor well above it,
since a slice runs several exchange rounds in sequence:
the critic round alone took over 200 seconds on the measured attempt.

### The second run says the floor is much higher than one exchange

Run 2,
`--only Weideriche_` under a 15-minute ceiling,
exit 0 in 1801.90s.
It stalled too,
and that is the finding:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 15 minutes rather than the built-in 420
    TALLY Weideriche_ status=ERROR ms=900061 aborted=true
    REATTEMPT Weideriche_ queued: cached 1 more slices, so the next attempt starts further along
    TALLY Weideriche_ status=ERROR ms=900002 aborted=true
    STALLED Weideriche_: its 1 cached slices are what it started with
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=1800065ms

`Weideriche_` is the SECOND SMALLEST entry in the corpus,
828 bytes of source against a 41720-byte largest,
and it cuts into 3 slices.
The ceiling was 15 minutes,
two and a half times the 6-minute exchange deadline,
so `CAP TOO TIGHT` correctly stayed quiet.

Attempt 1 bought the block pairing in seconds
and then spent the remaining fourteen and three quarter minutes on CHUNK 0 ALONE,
reaching critic,
then panel,
then editor,
and never finishing.
The stage words in that attempt's log come to critic 18,
panel 12,
editor 2.
Attempt 2 did the same and banked nothing.

SO ONE REPAIR SLICE COSTS MORE THAN 885 SECONDS,
on the second smallest entry.
That is not surprising once stated:
a slice runs critic,
panel,
editor and checker rounds IN SEQUENCE,
and each round is bounded by `RUN_PER_CALL_TIMEOUT_MS` at 360_000 on its own.

THE `CAP TOO TIGHT` FLOOR IS THEREFORE NECESSARY BUT NOT SUFFICIENT.
One exchange is a provable lower bound and it is the honest one to assert
without a measurement.
The practical floor is a whole round sequence,
and 15 minutes is under it.
The production ceiling of 420 minutes is nowhere near either floor,
so nothing that ships is affected;
what was affected was two verification runs that looked reasonable and could not work.

The number to replace the estimate with is being measured now:
run 3 is `--only Weideriche_` at the DEFAULT ceiling,
which settles the entry end to end and reports what it actually cost.
Do not raise the warning threshold on the 885-second lower bound.
It is a bound,
not a cost.

### Run 3 settles, publishes, and verifies, with half the roster dark

`--only Weideriche_` at the DEFAULT 420-minute ceiling,
exit 0 in 7725.66s.

    TALLY Weideriche_ status=SETTLED slices=3 repairStatus=repaired repairIssues=20
      repairAccepted=14 repairResolved=14 repairFindings=135 repairChanged=2
      translateStatus=complete translateChanged=2
    DONE processed=1 of pending=1; artifacts=1/92 elapsed=7723880ms

It wrote one artifact of 412823 bytes and one page,
`fixed/people/Weideriche_/page.en.md`,
of 897 bytes,
over 253 model streams.
`verify-published` then read the page back against the artifact that produced it:

    verify-published: matched=1 settledWithNoPage=0 pageWithNoArtifact=0
    Weideriche_: wordings=3 silent=0 chars=895=expected missing=0
    verify-published: 1 of 1 pages carry every wording their artifact promised, at the length it implies

`chars=895=expected` is the strong form:
the page is EXACTLY the archive plus every change the slices made,
so no text outside a slice was lost or added.

THIS RAN THROUGH A PROVIDER OUTAGE FROM START TO FINISH.
Charm Hyper was dry from the run's first second,
so five of the ten roster models never answered,
including `gemma-4-26b-a4b-it` in the editor and refiner seats it had just been given.
The entry still settled,
still published,
and still verified.

#### The cost, and why runs 1 and 2 could never have worked

128.7 minutes for a THREE-SLICE entry,
the sixth smallest of 92,
828 bytes of source.
That is roughly 43 minutes a slice,
and it settles the earlier puzzle completely:
a 5-minute ceiling and a 15-minute ceiling were never near buying one.

TREAT 43 MINUTES AS AN UPPER BOUND RATHER THAN THE COST.
Five models were dark,
so every stage ran retry rounds for lost voices
that could not be filled.
The lower bound from run 2 is 885 seconds,
just under 15 minutes.
A healthy two-provider slice sits somewhere between the two,
and nothing has measured it.

THE `CAP TOO TIGHT` THRESHOLD STAYS AT ONE EXCHANGE for exactly that reason.
Two bounds that differ by a factor of three do not support a threshold,
and the one-exchange floor is the only value that is provable rather than fitted.

#### A tested edge case turned up live

The entry's cache directory holds ZERO records after settlement,
having held ten a few minutes earlier.
That is the first of the two counterintuitive cases `entry-reattempt.ts` carries a test for:
a settled entry discards its cache on the way out,
so settlement has to be an INPUT to the re-attempt verdict
rather than inferred from a count that just fell to zero.
Inferring it would have read this run as an entry that lost everything it had.

#### What is proved, and the one thing that is not

Proved live,
each on its own run:

-   An entry the cap cuts is re-attempted inside one invocation against one frozen digest.
-   The re-attempt starts further along,
    off the cache the previous attempt bought.
-   An attempt that buys nothing stalls the entry rather than looping.
-   An entry settles,
    publishes,
    and its page verifies against its artifact.

NOT directly observed:
a chain of EARNED re-attempts ending in settlement.
Run 3 settled in a single attempt because the production ceiling never cut it.
Showing the composition needs a ceiling between one slice and one entry,
which on these numbers means roughly 60 minutes:

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=60 \
      mise run //package/module/translation-repair:corpus-pass -- --only Weideriche_

Expect two or three attempts and about two and a half hours.
It was not run because Synthetic quota is restorable only sometimes,
and the composition is arithmetic over four facts each already observed.

## Five sections aged out into the history (2026-08-25)

Moved verbatim into `doc/handover/translation-repair-history.md` when this file reached its cap,
because each is closed work whose conclusion is already encoded in the code:

-   The writer calibration's coverage report,
    verified live.
-   The settled artifact speaks one vocabulary,
    as generation 3 (`#94`).
-   The stamped index is `sliceIndex`,
    as generation 4 (`#204`).
-   The read-any-generation dispatch never learned generation 3 (`#206`).
-   The 53 indirectly-reached modules,
    branch by branch (`#209`).
