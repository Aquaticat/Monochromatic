# Translation repair session handover

Status:
the two-lane pipeline is built and publishing;
the whole-package audit (`#236`) has reported on all ten slices, and every MAJOR it filed (`#237` to `#257`)
is landed, GFP-proven and recorded under "State of the tree" (now in the history, with the audit section);
the three doc passes (A-4, A-5, A-6) are done, and the register's MINORs are being worked in register order:
every group from calibrate through rendering is landed (`acfc7ad22` to `8bffaba9b`) and `#236` is CLOSED;
`#213`, `#230` and `#229` are measured; the readiness signal was put and REJECTED (see "The owner's answers"),
so the pipeline's actual output is being read before anything else: arms A2 and D are running, the fresh
pass over ten entries follows them, and two defects the reading found (`#263`, `#265`) are landed in source
awaiting the build that the running arms forbid (see "Work while the arms ran").
`doc/planning/translation-repair-open-decisions.md` has every question answered; it is kept for the evidence.

WHAT THIS FILE IS.
What a session starting today needs, and nothing else.
Capped at two thousand lines.
When it reaches that cap, its oldest sections move verbatim into
`doc/handover/translation-repair-history.md`, which has no cap.

WHY THE SPLIT.
This file reached twenty thousand lines, at which point it stopped being a handover
and became an archive nobody could read at the start of a session.
The history keeps every measurement; this keeps the working set.

THERE IS NO RELEASE DEADLINE.
The owner withdrew the one that used to sit here, on the grounds that being aware of it
made the work worse: it bought lower quality and, more than once, took longer anyway.
Do not reintroduce a date, do not infer schedule pressure from anything in the archive,
and do not let "time remaining" enter any decision. Quality is the only standing constraint.

ADVISOR IS A STANDING INSTRUCTION.
The owner has asked for it twice, the second time in these words:
"Please call advisor as usual. This is standing instruction."
Call `advisor` at the normal checkpoints:
before committing to an approach, when stuck, when changing approach,
and once more before declaring anything done.
An earlier session barred the tool on the grounds that it forwards the whole transcript
and the transcript names corpus entries from an unlicensed archive.
That bar is superseded and must not be reinstated.
The owner knows what the transcript carries, has said so about this corpus more than once,
and has made the call.
Re-raising it at every invocation is the failure mode to avoid:
the concern is recorded here once, and that is the whole of it.

WHAT BELONGS HERE.
Open tasks and their state, decisions still in force, defects not yet fixed,
and any measurement a reader would otherwise re-run.
What belongs in the history: closed work whose conclusion is already encoded in the code,
and superseded reasoning kept only for its evidence.

## FIXED: half the roster was sent to a provider that cannot serve it (`#235`, 2026-08-25 to 2026-08-26)

STATUS 2026-08-26: fixed in `8b289c3ab`, guards in `e0010019f`, each guard shown to fail with its fix line removed,
verified live the same day (see "State of the tree" under the audit section, now in the history);
`doc/troubleshooting/synthetic-hf-prefix-misroute.md` holds the located cause and the fix.
The body below is the diagnosis as it stood while the cause was being located, kept for its evidence.

This is the most important open item in this file, and it is unfixed.
It was found while running arm A of the `#213` overlap measurement, and it invalidates that run.

### What happened

The run was the serial control arm:
`TRANSLATION_REPAIR_SLICE_OVERLAP=1`, four slices, the full ten-model roster.
Log at `~/temp/agent/overlap-arm-serial.log`, 887 lines;
run directory `~/temp/agent/overlap-arm-serial`.
It started at 01:54:46 UTC and ended at 02:15:58 UTC, about twenty-one minutes,
and it exited cleanly: no refusal line, no fault line, all four slices reported.

Every single round it logged heard five of ten voices.
Twenty-five rounds, `5/10 heard` on all twenty-five, no exceptions.
(Re-measured 2026-08-26 with `grep -oE 'round: [0-9]+/[0-9]+ heard'`.
The first count here was twenty-two; it came from a narrower anchor that required a stage prefix,
and every round is `5/10` under either anchor, so the substance stands.)

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

A hundred percent failure rate on five models, a zero percent failure rate on the other five.
The provider's own words, which are the giveaway:

```text
SyntheticHttpError: provider API returned HTTP 400:
{"error":"Your model name should start with an hf: prefix; for example: ...
```

Synthetic was handed five models that only Charm Hyper serves, and said so, 125 times.

### Why nobody noticed

Quorum is five of ten.
The five surviving models are exactly enough to meet it,
so every round stood, every slice settled, and the command exited zero.

The resilience work is what hid this.
`#199` and the multi-provider landing made the pipeline survive a provider going away,
and it did survive: it produced a complete, well-formed, four-slice calibration.
It just produced it from half the roster.
CORRECTED 2026-08-26: it did not say "nothing above `warn`".
The calibration's closing coverage line (`producer-silence.ts:222`, printed by
`editor-calibrate.ts:359-367`) named all five dark seats twice, as
`WROTE NOTHING AT ALL: ... covers 5 of 10 seats`.
What was missing: per-seat call and failure counts, the failure class
(the line itself says a budget refusal, a refused sheet and a timeout all look alike from there),
any such line in the pass or the other 36 CLIs, and anything louder than stdout prose under exit 0.
Audit finding `calibrate-1` in `doc/audit/translation-repair-package-audit.md`.

That is the defect to fix, and it has two halves that should not be conflated:

1.  **The routing half.**
    A model that only one provider serves must never be offered to the other one.
    CAUSE LOCATED 2026-08-26, and it is NOT `src/budget-routing.ts`.
    That file and `src/roster-reach.ts` were read in full and are correct:
    a bare Charm Hyper label derives `{ onSynthetic: false, onHyper: true }` and routes to Hyper.
    The misroute is the single-provider fallback in `createRunClient`,
    `src/corpus-run/run-config.ts:611-617`:
    when `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY` is unset it returns the bare Synthetic client,
    and that client sends whatever model id it is handed to the wire with no catalog check
    (`src/synthetic-client.ts:265`).
    The log proves the process had no Hyper key:
    `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY is not set` appears four times, once per slice,
    and no `METERS ` line exists at all, because the routing client was never built.
    How the key went missing: arm A was launched with `nohup env ... node dist/final/node/editor-calibrate.mjs 4`
    directly from the fork worktree `~/worktrees/tr-overlap`,
    which has no `.env.local.json`, so nothing injected secrets;
    the process inherited whatever that shell happened to hold.
    The earlier pointer at `budget-routing.ts` was written after reading sixty lines of it,
    and was wrong.

2.  **The silence half.**
    Losing five of ten voices for an entire run should be loud.
    Right now it is a `warn` per call, a `5/10 heard` per round, and one closing coverage
    sentence in the two calibration CLIs that names the seats but not the counts or the cause.
    A run that finishes with a model at a hundred percent failure should say so at the end,
    in its own summary, where a reader who is not grepping will see it.

### What this costs, and what is now void

The arm A measurement is void as a ten-model measurement.
Do not read wall clock, concurrency, or overlap conclusions off it.
Arm B, the `TRANSLATION_REPAIR_SLICE_OVERLAP=4` arm, was never launched;
`~/temp/agent/overlap-arm-four.log` does not exist.
Both arms need re-running after the routing fix, back to back,
and that re-run also pays the recovery rate owed by `#230`, since it will carry `91f0c8ba5`.

`#213` therefore stays open, and it is now blocked on this defect rather than on quota.

This also blocks `#219`.
Production readiness cannot be signalled while one provider's absence
silently halves the roster and the run still reports success.

### Three instruments that lied, and how to not be fooled again

Recorded because each one cost real time in this session.

1.  **The run log stamps are UTC, and the machine is on EDT.**
    A line reading `02:11:48` was written at `22:11:48` local.
    Reading them as local time makes a live run look like it died twenty hours ago.
    Compare against `date -u`, never against `date`.

2.  **Node's `comm` on this machine is `node-MainThread`, not `node`.**
    Scanning `/proc/*/comm` for exactly `node` finds nothing and looks like proof of death.
    Match on a `node*` prefix, or match the `cmdline` instead.

3.  **`pgrep -f PATTERN` matches the shell that is running it.**
    A waiting loop whose own command line contains the pattern never exits.
    This has now cost three separate incidents, including one where a kill loop
    killed its own shell and returned exit 144.
    List PIDs first, confirm the kind from `/proc/<pid>/comm`, then kill by number
    from a command that does not contain the pattern.

### Exactly where to pick this up

- The cause is `createRunClient` in `package/module/translation-repair/src/corpus-run/run-config.ts`;
  the fix design (require the Hyper key, catalog guard in the Synthetic client,
  process-scoped seat tally reported by `reportingRefusals`, `RunConfigError` as a stated refusal)
  is recorded on `#235`, advisor-reviewed, and held until the `#236` audit closes.
- Launch rule from now on: a run starts through `mise run //package/module/translation-repair:<task>`
  from a worktree that holds `.env.local.json`, so sops injects BOTH keys.
  A fork made with `git worktree add` has no secrets file.
  Never `nohup env ... node dist/...`.
- The fix needs a test proven per `GFP`:
  a non-`hf:` model with Synthetic live must never produce a Synthetic call,
  and the test must be shown to fail with the fix removed.
- The overlap prototype itself is built and lint-clean but NOT committed.
  It lives in the fork at `/var/home/user/worktrees/tr-overlap`, detached at `166b08e81`,
  and its two files are saved at `~/temp/agent/proto-slice-overlap.ts`
  and `~/temp/agent/proto-editor-calibrate.ts`,
  with a drafted, unlanded test at `~/temp/agent/proto-slice-overlap.unit.test.ts`.
  Because the fork is pinned to an older commit, recreate it from the new head
  and reapply those two saved files rather than patching the stale checkout.

## The writers are seated, and the queue is being verified live

2026-08-24, after the 40-round producer calibration landed.

### The seating

`editorModelIds` and `refinerModelIds` are now
`hf:moonshotai/Kimi-K3`, `hf:Qwen/Qwen3.8-27B`, `gemma-4-26b-a4b-it`.
`hf:zai-org/GLM-5.2` left both seats and `qwen3.8-max` was not given one.
The whole standing, both raw and availability-adjusted,
the Mann-Whitney proof that `qwen3.8-max`'s top headline is survivorship,
and the reason the same table must NOT be used to move a checker seat,
are in `doc/decision/translation-repair-multi-provider.md`
under "The forty-round pass seats the writers, 2026-08-24".

Two reach checks ran before the swap, since `gemma-4-26b-a4b-it` is text-only
and Hyper-served:

-   Pictures never reach these stages.
    `document-lanes.ts` records that the repair lane edits in place against critic claims
    and none of its stages asks what a picture says,
    and reading is its own stage over `RUN_READER_MODELS`,
    which `run-config.ts` derives from the catalog rather than listing by hand.

-   The catalog's `maxOutputLength` of 25_600 is not a bound this model runs into.
    Nothing in production reads that field at all,
    and the model answered 40 rounds of production-sized slices with no cut.

Structured output was checked too, because these seats emit schema-guarded JSON:
across 937 completed streams in the calibration
there was exactly ONE schema mismatch, and it was `qwen3.8-max`'s.
`gemma-4-26b-a4b-it` had none.

### The live verification of `#196`

The queue was GFP-proven but had never run against a provider.
It does not need XingZ60's thirteen hours to be exercised:
the mechanism is size-independent,
so a mid-sized entry under a deliberately tight cap runs the same code path.

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=5 \
      mise run //package/module/translation-repair:corpus-pass -- --only MocaKawai

`--only` already existed; nothing had to be built to bound this.
What the run has to show is a `REATTEMPT MocaKawai queued` line,
an attempt count above one in the run's attempt map,
and a cache that grew between attempts.

A useful thing fell out of reading the cache layer for this:
`countCachedSlices` counts every `.json` under the entry's cache directory,
and `slice-cache-namespace.ts` gives pairing, contest, refine and translate records
that same suffix and that same directory.
So an attempt that spends its entire cap buying only a section pairing
still registers as progress and still earns its re-attempt.
Had setup cached somewhere else, the largest entries,
the ones this was built for, would have stalled on their first attempt every time.

### What the first live run proved, and the defect it exposed

Run 1, `--only MocaKawai` under a 5-minute ceiling, into a throwaway runs dir.
It exercised BOTH branches of the re-attempt policy in one invocation
and then exited cleanly, exit 0, in 601.84s:

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

THE RE-ATTEMPT REALLY DID START FURTHER ALONG, and the timestamps show it.
Attempt 1 reached "both lanes over 13 slices" 45 seconds in, after buying two block pairings.
Attempt 2 reached the same line 0.16 seconds in, off those cached pairings.

The two records it banked were both `pairing.` files rather than repair slices,
which is the cache-layout fact working exactly as intended:
`countCachedSlices` counts every `.json` in the entry's directory,
so setup progress earns a re-attempt.

#### The ceiling has a floor, and nothing said so

Attempt 2 banked nothing and the entry stalled.
The cause is not the queue: `RUN_PER_CALL_TIMEOUT_MS` is 360_000
and the ceiling was 300_000,
so every attempt was cut BEFORE any single exchange was allowed to return.
No exchange returned, so no slice cached, so no progress could be read,
so the queue correctly dropped the entry.

Every component behaved as designed and the run explained none of it,
while five minutes looks like a perfectly reasonable ceiling to set.
`capOutlastsOneCall` and `capTooTightNote` now catch it and print
`CAP TOO TIGHT` naming both numbers.

WARNED RATHER THAN REFUSED, deliberately:
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

Run 2, `--only Weideriche_` under a 15-minute ceiling, exit 0 in 1801.90s.
It stalled too, and that is the finding:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 15 minutes rather than the built-in 420
    TALLY Weideriche_ status=ERROR ms=900061 aborted=true
    REATTEMPT Weideriche_ queued: cached 1 more slices, so the next attempt starts further along
    TALLY Weideriche_ status=ERROR ms=900002 aborted=true
    STALLED Weideriche_: its 1 cached slices are what it started with
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=1800065ms

`Weideriche_` is the SECOND SMALLEST entry in the corpus,
828 bytes of source against a 41720-byte largest,
and it cuts into 3 slices.
The ceiling was 15 minutes, two and a half times the 6-minute exchange deadline,
so `CAP TOO TIGHT` correctly stayed quiet.

Attempt 1 bought the block pairing in seconds
and then spent the remaining fourteen and three quarter minutes on CHUNK 0 ALONE,
reaching critic, then panel, then editor, and never finishing.
The stage words in that attempt's log come to critic 18, panel 12, editor 2.
Attempt 2 did the same and banked nothing.

SO ONE REPAIR SLICE COSTS MORE THAN 885 SECONDS, on the second smallest entry.
That is not surprising once stated:
a slice runs critic, panel, editor and checker rounds IN SEQUENCE,
and each round is bounded by `RUN_PER_CALL_TIMEOUT_MS` at 360_000 on its own.

THE `CAP TOO TIGHT` FLOOR IS THEREFORE NECESSARY BUT NOT SUFFICIENT.
One exchange is a provable lower bound and it is the honest one to assert
without a measurement.
The practical floor is a whole round sequence, and 15 minutes is under it.
The production ceiling of 420 minutes is nowhere near either floor,
so nothing that ships is affected;
what was affected was two verification runs that looked reasonable and could not work.

The number to replace the estimate with is being measured now:
run 3 is `--only Weideriche_` at the DEFAULT ceiling,
which settles the entry end to end and reports what it actually cost.
Do not raise the warning threshold on the 885-second lower bound.
It is a bound, not a cost.

### Run 3 settles, publishes, and verifies, with half the roster dark

`--only Weideriche_` at the DEFAULT 420-minute ceiling, exit 0 in 7725.66s.

    TALLY Weideriche_ status=SETTLED slices=3 repairStatus=repaired repairIssues=20
      repairAccepted=14 repairResolved=14 repairFindings=135 repairChanged=2
      translateStatus=complete translateChanged=2
    DONE processed=1 of pending=1; artifacts=1/92 elapsed=7723880ms

It wrote one artifact of 412823 bytes and one page,
`fixed/people/Weideriche_/page.en.md`, of 897 bytes,
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
The entry still settled, still published, and still verified.

#### The cost, and why runs 1 and 2 could never have worked

128.7 minutes for a THREE-SLICE entry,
the sixth smallest of 92, 828 bytes of source.
That is roughly 43 minutes a slice, and it settles the earlier puzzle completely:
a 5-minute ceiling and a 15-minute ceiling were never near buying one.

TREAT 43 MINUTES AS AN UPPER BOUND RATHER THAN THE COST.
Five models were dark, so every stage ran retry rounds for lost voices
that could not be filled.
The lower bound from run 2 is 885 seconds, just under 15 minutes.
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

Proved live, each on its own run:

-   An entry the cap cuts is re-attempted inside one invocation against one frozen digest.
-   The re-attempt starts further along, off the cache the previous attempt bought.
-   An attempt that buys nothing stalls the entry rather than looping.
-   An entry settles, publishes, and its page verifies against its artifact.

NOT directly observed: a chain of EARNED re-attempts ending in settlement.
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

-   The writer calibration's coverage report, verified live.
-   The settled artifact speaks one vocabulary, as generation 3 (`#94`).
-   The stamped index is `sliceIndex`, as generation 4 (`#204`).
-   The read-any-generation dispatch never learned generation 3 (`#206`).
-   The 53 indirectly-reached modules, branch by branch (`#209`).

## Charm Hyper got credit, the full roster is running, and a run's cost is now measured (2026-08-25)

The owner bought 10,000 hypercredits.
`budget-sample` confirmed it live before anything was launched:

```text
METERS synthetic=wet hyper=wet syntheticWeekly=97.09290877272727%
syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=10000
```

Both providers wet at once,
which is the window `#200` had been waiting for since the 14-slice run of 2026-08-24 settled no seat.

### The run in flight

Launched 2026-08-25T01:30Z, detached, 40 slices, every seat filled by the whole ten-model roster.

```text
TRANSLATION_REPAIR_RUNS_DIR=~/temp/agent/editor-calibrate-fullroster-20260825 \
  mise run //package/module/translation-repair:editor-calibrate -- 40
```

Log at `~/temp/agent/editor-calibrate-fullroster-20260825.log`,
pid beside it in the `.pid` file.

ALL TEN SEATS ARE ANSWERING, which is the whole reason this run exists.
The five Hyper-only ones wrote nothing last time.
`gemma-4-26b-a4b-it` in particular HOLDS an editor seat and had never been tested.

DO NOT REBUILD `dist/` WHILE IT RUNS.
The run stamps its cache with the runner's own dependency closure,
so a source change plus any restart invalidates every cached slice and re-buys the whole run.
Documentation is outside that closure and safe to edit.

### What a slice actually costs in wall time, and a revision that should not have happened

Measured over the first six slices:

```text
slice 1  lintong chunk 0        214 s   0 editor  0 refiner
slice 2  windward0032 chunk 14 1362 s   5 editor  0 refiner
slice 3  Huasheng chunk 16       503 s   2 editor  0 refiner
slice 4  Mio chunk 10           1083 s   2 editor  1 refiner
slice 5  lintong chunk 4         967 s   2 editor  1 refiner
slice 6  zheermao101 chunk 2      16 s   0 editor  0 refiner

real slices   4, mean  979 s
cheap slices  2, mean  115 s
real share   67 percent
```

Projected total 7.7 hours, which is the figure first estimated from roster-round arithmetic.

A REVISION WAS MADE ON ONE SAMPLE AND WAS WRONG.
After slice 2 alone, at 1362 s, the projection was moved from 8 hours to 12
and the earlier number was declared superseded.
Slice 2 turned out to be the slowest of the four real slices measured,
which span 503 to 1362 s, a 2.7-fold spread.
The mean is 979 s and the original estimate was right.

THIS IS EXACTLY WHAT `QNB` FORBIDS:
measure the run-to-run band before crediting a difference smaller than it.
The rule was quoted in the same session it was broken in.
One slice could not distinguish a real slowdown from the top of an ordinary spread,
and no projection should have moved until it could.

### The refiner lane fires, and the two empty slices were not a signal

Slices 1 through 3 each reported `0 refiner rounds (nothing eligible to rewrite)`,
which looked like the refiner standing was going to come back empty for the second run running.

MEASURED INSTEAD OF WAITED.
Across 74 real shipped slices from four archived runs,
mirroring the bounds in `refine-eligibility.ts`:

```text
paragraphs                 156
  markup or non-prose       41
  hard break                 2
  under 120 chars           78
  over 1200 chars            1
  ELIGIBLE                  34

slices carrying at least one eligible paragraph: 32 of 74 (43%)
```

Three empty slices in a row has probability near 19 percent.
Unremarkable.
Slice 4 then produced a refiner round, which is the first this workstream has ever seen:
the earlier run's binary predated the fix that drives the lane at all.

### What the run costs in credits, and the correction that came with measuring it

The first estimate, computed from assumed tokens per call, was 500 to 1,500 credits for a 40-slice run.
THAT WAS HIGH BY ROUGHLY A FACTOR OF FOUR.

Measured from the run's own `reportStreamProgress` lines,
which carry content and reasoning characters per call:

```text
model                     calls   content   thinking  out-tokens  credits
qwen3.8-max                   9         0    125,612      31,403     3.77
minimax-m3                   10     6,409     98,961      26,343     0.69
deepseek-v4-pro-0813         10     4,512          0       1,128     0.10
deepseek-v4-flash-0731       10     4,214      4,066       2,070     0.05
gemma-4-26b-a4b-it           10     3,986          0         997     0.01
```

Scaled to 40 slices the output side is about 120 credits,
and adding an input side priced two to three times lower puts the whole run near 250.
So 10,000 credits buys on the order of 35 runs of this size, not 6 to 20.

THINKING DOMINATES THE BILL.
`qwen3.8-max` and `hf:zai-org/GLM-5.2` each emitted over 118,000 characters of reasoning
against a few thousand of answer,
and `completion_tokens` counts thinking.
Any cost model built on answer length underreads by most of the bill.

### Nothing we have ever run recorded its token spend (`#210`)

The estimate above had to be computed rather than read,
because token counts are not in any log this project holds.

`formatUsageNote` in `model-content.ts` reads `prompt_tokens` and `completion_tokens`
off the provider's own usage block
and appends them to an `rl.debug` line in both clients.
Every archived run logged at info,
so a grep for `[0-9]+\+[0-9]+ tokens` across every log in `~/temp/agent` returns ZERO matches.

It did not matter while Synthetic was the only provider:
a flat subscription either fits the weekly allowance or it does not,
and the `METERS` line already carries that percentage.
Charm Hyper is metered per token at rates differing by two orders of magnitude across one roster,
so cost depends on which seats answered and by how much.

`spend-line.ts` and `corpus-run/spend-read.ts` close it.
One `SPEND provider=<name> model=<id> prompt=<n> completion=<n>` line per exchange at info,
shaped like the `METERS` line so a reader splits rather than matches,
and a reader that totals a log per provider-and-model seat.

A provider that reports no usage still gets a line carrying `unreported` in both counts.
A run whose provider stayed quiet and a run that spent nothing total the same,
and only the named absence tells them apart.

### Two defects that only writing the consumer could find

Both were in code already reported as verified,
and neither was reachable from the writer's own tests.

THE MARKER CARRIED A LEADING SPACE, copied from `METERS_MARKER`.
That one only ever meets lines carrying a logger prefix, so it can demand the space.
This one also meets the bare line the writer RETURNS,
so `readSpendLine(reportSpend(...))` read as prose and answered `not-a-record`.
The marker is now `'SPEND '`
and the reader accepts it at start-of-line or after a space.

THE FIELD TABLE WAS A PLAIN OBJECT,
so a log line writing `__proto__=` would have reached the prototype.
Keys come off a log line; it is a `Map` now.

This is the same lesson as the `#209` method note from one day earlier,
arriving from the other direction:
there, mutating a module found arms nothing defended;
here, writing the consumer found what the producer's tests could not reach.

### `qwen3.8-max` books all of its output as thinking (`#211`)

Measured on the live run:
`qwen3.8-max` reports 0 content characters on every single call,
13 of 13, against 204,258 reasoning characters.
Other seats do this occasionally,
`hf:zai-org/GLM-5.2` on 3 of 10 and two others on 1 of 10.
Thirteen of thirteen is categorical.

THE VOICE STILL LANDS.
The same model casts ballots with full reasons,
so the answer arrives and is used.
What is wrong is the accounting.

THE OBVIOUS EXPLANATION IS ALREADY REFUTED, recorded so it is not re-walked.
Charm Hyper speaks the Anthropic protocol,
and forced tool use would deliver an answer as `input_json_delta` fragments.
`anthropic-delta-scan.ts` maps that delta to `content` and its own comment names this exact failure mode:

```text
`input_json_delta` IS THE ANSWER CHANNEL ... Routing them to `reasoning`
would leave every schema'd call looking like a model that thought at length
and answered nothing.
```

So the mapping is right and something else produces the symptom.
Settling it needs a captured frame from a live call,
which waits until the run releases the provider.

Not urgent: nothing is broken and no quota is wasted.
But a reader of any run log would conclude the most expensive seat on the roster produced nothing,
and the `SPEND` line sidesteps it entirely,
since `completion_tokens` comes from the provider and is channel-agnostic.

### A run's cost is now attributable per seat, and the run in flight will never be (2026-08-25)

`#210` grew its second half while the calibration held the main worktree.
The writer and reader were already built;
what was missing was the thing that turns token counts into money.

#### The price table is an observation with a date on it

`package/module/translation-repair/src/corpus-run/hyper-price.ts` carries all
twenty-six models Charm Hyper lists,
with input, output, cache-create and cache-hit rates in credits per million tokens.
The operator read them off the provider's model page on 2026-08-25,
and `HYPER_PRICE_READ_ON` ships beside the rates so every report prints how old its figures are.

The numbers were not transcribed by hand.
A parser read the pasted page with strict structural checks,
refusing any row whose label order or rate format did not match,
and emitted the table.
Transcribing a hundred and four figures by eye is exactly where a silent error would live.

#### The two cache columns are unreachable, which makes the input half exact

Nothing in `package/module/translation-repair/src` sends `cache_control`,
which is one grep to confirm.
On the Anthropic protocol Hyper speaks,
that means there are no cache-creation and no cache-read tokens,
and every prompt token bills at the plain input rate.
So the input half is exact rather than an upper bound.
The rates are carried anyway,
so whoever turns caching on finds them recorded and can see what the saving is worth.

#### Synthetic is never priced, and that is a correctness rule

`priceTally` splits seats into three buckets:
metered and priced, metered with no row in the table, and flat-subscription.
Only the first gets a credit figure.
Folding the second into the total at zero would report a cheaper run rather than an incomplete one,
and converting the third would invent a currency that provider does not bill in.
The report names all three separately.

#### What the report says, and the two controls it was checked with

```sh
mise run //package/module/translation-repair:spend-report -- <log> [<log> ...]
```

Positive control, on a throwaway fixture carrying every case at once:
priced seats sorted by cost with their share of the bill,
one unpriced metered seat named rather than zeroed,
one subscription seat carried with tokens and no credits,
one call that reported no usage counted as a floor,
one prose line mentioning the marker correctly not counted,
and one truncated record counted as unreadable.
The arithmetic checks by hand:
`qwen3.8-max` at 84000 prompt and 51065 completion tokens comes to 3.36 plus 6.13, or 9.49 credits.

Negative control, on the live calibration log:
`NOTHING RECORDED`,
which is the honest answer and not a zero total.

#### The run in flight will never have a cost breakdown

The calibration started before `spend-line.ts` existed,
and the running build is the one it started with.
Its log carries no `SPEND` line and never will.
Rebuilding `dist/` mid-run would invalidate every cached slice and re-buy the whole run,
so this is not a thing to fix.
It is the last run this project will make that cannot say what it cost.

What the meter does give is the total.
The balance opened at exactly 10000 and read 9909 after nine slices:
about ten credits per slice,
so a forty-slice run lands near four hundred credits and a ten-thousand balance buys roughly
twenty-five of them.
That corrects the earlier per-slice figure of 8.33,
which came from a smaller sample.
The total is all the meter can say.
Which seat spent it is what the `SPEND` lines add.

#### Proven by removal

Three mutations, each caught by the file that owns the guard and by no other:

- Dropping the `glm-5.2` row from the price table:
   caught by the catalog-join case,
  which asserts every model `hyper-catalog.ts` can seat has a row.
- Making `priceTally` inherit the tally's token order instead of sorting by cost:
   caught by an ordering case built so the two disagree,
  where the seat with ten times the tokens is a quarter of the bill.
- Looking rates up on the object literal instead of the `Map`:
   caught by the `__proto__` case.

Full suite after: 659 suites, zero failures, zero lint warnings.

#### Still parked, not landed

Everything lives in `~/temp/agent/spend-telemetry-210.tar.gz`,
fourteen files with repo-relative paths, untarred over the repo root to apply.
It cannot be committed from the isolated worktree,
which lacks the forbidden-strings scanner and is refused by the `branch-worktree-only` policy.
It must land after the calibration finishes,
and after any second calibration batch,
because pooling needs no drift opt-in only while the build is unchanged.

### `#211` diagnosed from logs and source, without spending a call (2026-08-25)

The earlier note recorded this as needing a captured frame from a live call,
and put the count at 13.
Both were wrong.
The count is about seventy calls,
and most of the diagnosis was reachable by reading.

#### The premise, remeasured

Across the calibration's first nine slices,
`qwen3.8-max` opened seventy-one streams and reported zero content characters on seventy of them,
while casting seventy-one ballots with full prose reasons.

#### There are two independent parsers, and only one of them is blind

`anthropic-completion.ts` imports `json-guard.ts` and `completion-shape.ts` and nothing else.
It never touches `anthropic-delta-scan.ts`.
So the thing that extracts the answer and the thing that counts characters for the progress line
read the same bytes through different code.
The vote landing while the count reads zero is the two disagreeing,
not the model failing.

#### The mechanism, from `channelFor` in `anthropic-delta-scan.ts`

Block type outranks delta type:

```ts
if (blockType === THINKING_BLOCK)
  return 'reasoning';
return DELTA_CHANNELS[deltaType] ?? UNREAD;
```

Its own comment says why that precedence exists:
providers have been seen sending plain text deltas inside a thinking block,
and reading only the delta type would file that as the answer.
The rule is right for the model it was written for.
If `qwen3.8-max` declares a thinking block and sends its answer deltas inside it,
the same rule files its entire reply as reasoning,
while the extractor, which reads only `delta.type` and ignores blocks, still recovers the answer.

`qwen3.8-max` is also the only model on the roster configured `toolChoice: 'auto'`;
every other Hyper seat is `forced`.
`hyper-catalog.ts` records that it answers HTTP 400 to every forced-tool variant tried.

#### What separates this from the ordinary case

For every other model, the zero-content count equals the cut count exactly:
`hf:zai-org/GLM-5.2` five and five,
`hf:Qwen/Qwen3.8-27B` two and two.
Those are streams that ended before any content arrived, which is expected.

`qwen3.8-max` reports seventy zero-content streams against twelve cuts.
Fifty-eight of them completed cleanly and still counted nothing.
Cutting cannot explain that, and no other model shows the pattern.

`deepseek-v4-pro-0813` shows a smaller separate anomaly,
eight zero-content streams with no cuts at all,
recorded here so it is not folded into this one.

#### This is not cosmetic: the runaway guard is blind to this model

`stream-runaway-watch.ts` applies `CONTENT_OVERRUN_CAP` to the content channel only,
and its comment states the reasoning channel is deliberately untouched.
If this model's output is filed as reasoning, the volume bound never sees it,
so nothing stops it early and it runs to the straggler deadline instead.

The cut rates match that prediction.
`qwen3.8-max` is cut on twelve of seventy-one streams, near seventeen percent,
the highest on the roster by a factor of two and a half.
`hf:zai-org/GLM-5.2` is next at five of seventy-two.
Six of the eleven seats are cut zero times.
Each cut is a lost voice on a panel that was paid for.

#### What is still owed

One thing, and it is now a single cheap check rather than an investigation:
capture one `qwen3.8-max` stream and confirm it declares a thinking block
whose deltas carry the answer.
If it does, the fix is at `channelFor`, not at the model,
and the candidate shape is to keep the block-type override only for delta types
that are not themselves answer channels.
Do not change it before the frame is seen:
the override exists because a real provider needed it,
and removing it blind would restore the defect it was added for.

### Authorization to drop weak models, and why the worst-looking seat is not one (2026-08-25)

The owner granted authorization to drop models that are exceptionally bad.
Recorded here with the guard that has to travel with it.

#### The instrument now names drop candidates, and warns about one confound

`~/temp/agent/standing-stats.mjs` previously reported a seat as `SETTLED` on the
absolute value of its z score, which puts a seat far above the pooled null and
one far below it under the same word.
It now splits by direction:
`CARRIES ITS SEAT` above, `DROP CANDIDATE` below,
each still requiring both the per-round and the per-slice reading to clear the
Bonferroni threshold for the actual number of comparisons.

It also prints a standing warning to check a seat's cut rate before dropping it.
A seat whose voice is lost scores low for a reason that is not its judgement.

#### Its control is now a real log rather than pasted figures

The analyser learned the second header shape that `producer-calibrate` prints,
so the prior forty-round producer run reads directly.
That run is now the positive control:
pooled null 13.48% over 336 of 2492 ballots,
ten comparisons, Bonferroni threshold 2.807.

#### The evidence says drop nothing today, and says it twice

`hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` sits at 3.0%, z of -4.99,
which clears the threshold by a wide margin in the negative direction.
Its cut rate in the run now in flight is zero of seventy-eight,
so the score is not voice loss.
That is genuine weakness, and it is already acted on:
the writer seats were settled at three from this same run,
and a model at 3.0% was never among them.
Nothing to drop.

`qwen3.8-max` is the opposite case and the important one.
It is the BEST producer on the roster at 27.0%, z of +5.22,
and it carries the worst cut rate on the roster, twelve of seventy-eight.
It earns the top score while losing twelve voices to the defect in `#211`.

So the seat that looks worst by cut rate is the strongest seat by judgement,
and dropping on the cut rate alone would have removed it.
That is exactly the confound the warning exists for.

#### What this changes about `#211`

It stops being an accounting curiosity.
The scanner mis-files this model's output, the volume bound therefore cannot see it,
it runs to the straggler deadline, and the pipeline loses a sixth of the voices
of its highest-scoring producer.
Fixing it does not tidy a log line, it recovers the best seat's lost ballots.

#### What the authorization is waiting on

The editor standing, which the run in flight is measuring and which is not the
producer standing.
`#136` already recorded a model that is worst at one stage and better than two
peers at another, so a producer table cannot seat or unseat an editor.
When the run lands, the analyser names candidates and the cut rates say which of
them are real.

## No volume guard can see `qwen3.8-max`, and stragglers may cost more than serialization (2026-08-25)

Measured on the live full-roster calibration at 15 of 40 slices, from the run log alone.
Full working in `doc/audit/every-volume-guard-is-blind-to-one-model.md`, committed as `d16a616e3`.
This run predates the parked `#211` fix, so every number here is a clean pre-fix baseline.

### The measurement

Every seat was asked exactly 120 times, so the denominators need no adjustment.
Seven of the ten lose no voice at all.
The 34 losses are `qwen3.8-max` 21, `hf:zai-org/GLM-5.2` 11, `hf:Qwen/Qwen3.8-27B` 2.

`qwen3.8-max` reports content characters of 0 at the median AND at the 95th percentile,
across all 100 of its completed streams.
Not one byte it sent reached the content channel.
Every other seat medians between 303 and 619.
That is `#211` confirmed at production scale, where it had been proved on one captured frame run.

### Why that is worse than a telemetry error

`src/stream-runaway-watch.ts` applies its volume cap to the content channel only,
and its module note says the reasoning channel is untouched.
`#156` set that bound at 32000 and declined a reasoning bound deliberately.
So for this one seat the chain closes: answer filed as reasoning,
cap reads content, content is always zero, no volume guard can ever fire.
The only thing that stops it is `STRAGGLER_GRACE_MS`, and that is what its 21 cuts are.

### The correction to `#211`'s recorded prediction

`#211` predicted the cut rate would fall toward the roster's.
That is not supported and has been replaced on the task.
The cuts are volume runaways, not stalls: `qwen3.8-max` is cut mid-reply after 106,405 characters
once and then 19 of 21 times between 293,163 and 350,293,
a tight cluster because the cut is time-bound while the stream rate is steady.
Post-fix those bytes meet `contentCap`, so the call is cut at roughly 32000 rather than 300,000,
in seconds rather than 180.
What changes is when and how expensively the voice is lost, not obviously whether.
Two mechanisms pull opposite ways: an early overrun rides the retry predicate `#156` built,
giving the model an attempt it never used to get,
against which a model emitting 300,000 characters may simply overrun again.
Record the outcome, not the prediction.

### What it redirects

The straggler cuts group into 29 distinct events.
At 180 seconds each that is an upper bound of 1.45 hours inside a 3.73 hour run.
It is an upper bound and must be read as one:
`runStageRound` assembles from its `arrived` map rather than awaiting abandoned calls,
so the true per-event cost is at most the grace window and may be less.

That is potentially a larger lever than the serialization question `#213` was opened on,
and 21 of the 34 cuts are the seat `#211` already fixes.
So the order is now: land `#211` and re-measure, then re-derive the window, then prototype fan-out.
Measuring fan-out first would be measuring a system about to change underneath it.

### Two tasks this opened

`#214` re-derives the straggler window.
`doc/decision/translation-repair-straggler-grace.md` rests on the claim that no hung call had ever
been recorded and every cut voice was slow-but-working.
A voice cut mid-reply after 3,020,068 characters refutes that.
The decision should be superseded rather than edited, since its reasoning was correct for the
population it had, and it should not be reverted:
60 seconds really did cut `hf:zai-org/GLM-5.2` inside its ordinary range, and still would.

`#215` adds elapsed milliseconds to the stream completion line.
A production run currently cannot answer where its own wall-clock went,
because dispatch is logged at `debug` and production emits only `info` and `warn`,
while the completion line carries `firstByte` and `maxGap` but no duration.
That is why the 1.45 hour figure is a bound rather than a measurement,
and why `#213` cannot yet measure the baseline it needs.

### Corrected count for `#213`

The first pass said seven serialization sites and grepped four wrong paths.
The full sweep finds eleven resting on the refuted premise, seven of them on the production path,
and `src/editor-ensemble.ts:248` is the one with a clean argument:
envelopes within a slice are independent, nothing reads back an earlier envelope's outcome,
and `Promise.all` preserves order, so gathering concurrently and folding in index order is
byte-identical output for pure latency.
The task carries the full list, including the sites that are correctly sequential and must not be
touched.

### Two more findings from the same run (2026-08-25)

The deepseek zero-content anomaly is RESOLVED, and it is the same defect as `#211` intermittently.
It had been held open because the instrument used then was a 40-line scan window over 9 samples
with a measured 39 percent hit rate on healthy calls.
The completion line's own content count answers it on roughly 1,200 streams:
`deepseek-v4-pro-0813` is zero-content on 12 of 127, every one with reasoning above zero,
against a baseline of exactly zero across eight other seats.
What remains a prediction rather than a conclusion is whether `#211`'s fix removes those 12,
since the fix exempts `input_json_delta` and not `text_delta`.
Count them on the first post-fix run.

`#216` implements an owner instruction that turns out never to have been implemented:
"Please make sure to put even the full tool schema into system prompts."
Seventeen modules build a system message and NOT ONE carries its response schema;
the seven that name a schema at all name it only as the API-level `responseFormat`.
The supporting evidence is that all 6 schema failures in this run are on Charm Hyper seats,
`gemma-4-26b-a4b-it` 4 and `qwen3.8-max` 2, with zero on Synthetic,
and one of them reads `{"checks": "\n[{\"region\":` ,
a JSON-stringified array where the schema declares an array of objects.
That is the wrong-tool-call-format failure the owner named.
The provider split is confounded, since those seats are also different models,
so the task says so and does not claim the protocol causes it.

### The `#200` power projection flips, on measured accrual (2026-08-25)

`#200` recorded that 40 slices "lands a hair under the line", worst-case z 2.776 against a
Bonferroni threshold of 2.807 at ten seats.
That rested on a projected 63 percent yield.
Measured at 16 of 40 slices, the yield is 75 percent: 12 of 16 slices contributed a judged round.

Judged-round accrual, counted from `selectBestCandidate` votes rather than projected:

-   407 votes over 16 slices, which at roughly one ballot per judge is about 41 rounds.
-   2.54 rounds per slice, and 2.30 with the single richest slice dropped,
    so no one slice carries the rate.
-   The 14-slice run that settled nothing managed 2.07 per slice from 10 contributing slices.

Holding the prior effect size, 40 slices reaches about 30 contributing slices,
so z scales by the square root of 3 and the deflated best z goes from 1.76 to roughly 3.05,
clearing 2.807 by 0.24.

DO NOT ACT ON THIS EITHER, for the same reason the original projection carried.
The effect size it holds was measured on FIVE models, and the pooled preference rate roughly halves
at ten seats, so the z it implies could move in either direction.
The margin is thin in both directions and the run measures the effect size directly.
Read the standing when it exits; the projection is superseded either way.

## Landing sequence for the parked work, verified ready (2026-08-25)

Everything below is blocked on the calibration exiting and nothing else.
The archive was verified on 2026-08-25 and applies cleanly:
`gzip --test` passes, it holds 33 repo-relative paths,
HEAD descends from its base `f800f1352`,
every commit between that base and HEAD is documentation only,
and NONE of the 33 files changed in that range.
So untarring over the repo root reverts nothing and clobbers no concurrent work.

### Order, and why this order

CORRECTED 2026-08-25: step 1 used to read the pid file, which holds the wrong process.
`doc/runbook/translation-repair-corpus-pass.md` carries the reasoning and the controls.

```sh
# 1. Confirm the run is actually gone, rather than merely quiet.
#    NOT the pid file: it holds the launching bash wrapper, and the work runs
#    two levels below it. Measured live: bash 3038649 at 2792 KB, mise 3038654,
#    node 3038820 at 126340 KB doing the work. Ask what is running instead.
running() {
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    mapfile -d '' -t argv < "$d/cmdline" 2>/dev/null || continue
    [ "${#argv[@]}" -gt 0 ] || continue
    [ "$(basename -- "${argv[0]}")" = node ] || continue
    for a in "${argv[@]:1}"; do
      [ "$(basename -- "$a")" = "$1" ] && echo "alive pid=${d#/proc/}"
    done
  done
}
running editor-calibrate.mjs   # silence means gone

# 2. Read the standing FIRST, while the tree still matches the build that
#    produced it. This answers `#200`, and nothing else here can change it.
node ~/temp/agent/standing-from-log.mjs \
  ~/temp/agent/editor-calibrate-fullroster-20260825.log

# 3. Land the parked work. 16 new files, 17 modified, 0 identical.
tar --extract --file ~/temp/agent/spend-telemetry-210.tar.gz \
  --directory /var/home/user/worktrees/translation-repair

# 4. Build BEFORE any test: the suite imports from `dist/`, so a test run
#    against a stale bundle measures the old code and passes.
mise run //package/module/translation-repair:build

# 5. Then lint, types, tests.
mise run //package/module/translation-repair:lint
mise run //package/module/translation-repair:lint:types
mise run //package/module/translation-repair:test:unit
```

### The commit, and the trap in it

`CPN`: a pathspec commit omits any file it does not name, and this lands SIXTEEN
new files. Naming only the modified ones would commit a tree whose imports do not
resolve at that commit while the working tree still builds, which is invisible
until somebody checks out that commit.

Verify with `git status --short` afterwards that nothing is left untracked.

New files, all of which must appear in the pathspec:

    package/module/translation-repair/src/candidate-ledger.ts
    package/module/translation-repair/src/candidate-ledger.unit.test.ts
    package/module/translation-repair/src/candidate-select-record.ts
    package/module/translation-repair/src/corpus-run/hyper-price.ts
    package/module/translation-repair/src/corpus-run/hyper-price.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-parse.ts
    package/module/translation-repair/src/corpus-run/ledger-read.ts
    package/module/translation-repair/src/corpus-run/ledger-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-report.ts
    package/module/translation-repair/src/corpus-run/spend-cost.ts
    package/module/translation-repair/src/corpus-run/spend-cost.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-read.ts
    package/module/translation-repair/src/corpus-run/spend-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-report.ts
    package/module/translation-repair/src/spend-line.ts
    package/module/translation-repair/src/spend-line.unit.test.ts

Modified files:

    package/module/translation-repair/mise.toml
    package/module/translation-repair/rolldown.node.config.ts
    package/module/translation-repair/src/anthropic-delta-scan.ts
    package/module/translation-repair/src/anthropic-delta-scan.unit.test.ts
    package/module/translation-repair/src/ballot-barrel.ts
    package/module/translation-repair/src/candidate-select.ts
    package/module/translation-repair/src/corpus-run/sentinel-probe.ts
    package/module/translation-repair/src/editor-ensemble.ts
    package/module/translation-repair/src/hyper-client.ts
    package/module/translation-repair/src/judge-fidelity.ts
    package/module/translation-repair/src/pipeline-barrel.ts
    package/module/translation-repair/src/provider-barrel.ts
    package/module/translation-repair/src/refine-stage.ts
    package/module/translation-repair/src/stream-idle-guard.ts
    package/module/translation-repair/src/stream-idle-guard.unit.test.ts
    package/module/translation-repair/src/synthetic-client.ts
    package/module/translation-repair/src/translate-judge.ts

### The three measurements owed immediately after, before anything else is built

Each one is a prediction already on record, and each is falsifiable. Take them on
the first post-fix run rather than reasoning about them.

-   `qwen3.8-max` cut rate. Pre-fix baseline 21 of 119, 17.6 percent, stable
    against an earlier 12 of 71. `#211` predicts NOT that this falls but that
    each cut costs a fraction of the time and bytes, because `contentCap` can
    finally see the model. Record whichever happens.
-   `deepseek-v4-pro-0813` zero-content count. Pre-fix 12 of 127. Twelve to zero
    means it is the same mechanism as `qwen3.8-max`; twelve holding means
    `text_delta` inside a thinking block, which `#211` deliberately does not
    exempt, and that opens its own task.
-   `qwen3.8-max` content characters at p50 and p95. Pre-fix both are 0. Any
    nonzero value confirms the routing fix at the user boundary rather than in a
    unit test.

## The run will finish, and budget is not what would stop it (2026-08-25)

Measured at 4h21m into the full-roster calibration,
off its own 115 `METERS` readings,
read with `node dist/final/node/meter-report.mjs` directly
rather than through the task, which would have rebuilt `dist` underneath it.

Both providers answered every reading:
`synthetic wet=115 dry=0 unreadable=0`, `hyper wet=115 dry=0 unreadable=0`,
so this run has had no outage at all and its numbers carry no availability caveat.

Runway against work left, which is the only question that mattered:

-   Hyper drained 205 of 10000 in 4.39h, so 46.7 per hour, leaving 210 hours of runway.
-   Synthetic drained 5.183pp gross in the same window, so 1.18pp per hour, leaving 79 hours.
-   Seventeen of forty slices are done, and the remaining twenty three come to
    6.0 hours at the whole-run mean gap of 943s,
    7.3 hours at the slower last-half mean of 1150s,
    and 12.9 hours if every remaining slice were as slow as the slowest one yet seen at 2017s.

Even the pessimistic arm finishes with an order of magnitude of budget to spare.
Nothing here needs the account owner to top up or reset anything.

### The weekly allowance refilled mid-run, and endpoint arithmetic is 62% wrong

`syntheticWeekly` ROSE once in 115 steps,
from 95.594% to 97.577% at 2026-08-25T03:03:24.086Z, a jump of 1.982pp.
The subscription window rolls, so an allowance is not a monotone drain.

That breaks the obvious way to price a run.
Net endpoint change reads 3.200pp,
gross drain summed over the downward steps alone reads 5.183pp,
so subtracting the endpoints understates what was actually spent by 62%.

THE SAME DETECTOR FOUND ZERO RISES IN `hyperBalance`, 0 of 115 steps,
which is what a prepaid balance should do and is what makes the synthetic
result meaningful rather than an untested instrument.

`meter-report` prints `level first` and `level last`,
which are exactly the two numbers a reader will subtract.
It does not claim they are spend, and its own job is duty cycle and outages,
but nothing warns that the difference is not the cost.
`#210`'s token-priced spend line is the right instrument for cost
and this is one more reason it is: meter deltas cannot answer the question at all.

### Slice lines carry no timestamp, which is more of `#215`

Sixteen of the seventeen slice gaps here were recovered by carrying the most
recent `METERS` timestamp forward through the log,
because `slice N of 40` lines have no timestamp of their own.
`#215` is recorded as a run being unable to say where its wall-clock went
for want of a duration on the completion line.
It is worse than that: the per-slice progress lines cannot be placed on a clock
at all except by leaning on an unrelated line that happens to be timestamped.
Whatever `#215` adds should cover the progress lines too.

## Corpus text in commits: what the owner decided, and the rule (2026-08-25)

Raised because a sweep found corpus text committed to a PUBLIC repository,
and the working rule carried across sessions said it should never be there.
`doc/audit/corpus-text-reached-a-public-repository.md` has the measurements.
The short version: fifteen documents under `doc/` carry 185 lines of Chinese
source text, plus English memorial sentences that a script-keyed scan cannot see,
on `origin/translation-repair-rebased`, none of it on `origin/main`,
publicly readable since 2026-08-20.

THE OWNER DECIDED NOTHING IS REMOVED.
Exposing corpus text is sometimes fine, because the owner is friends with the
people who run the site the corpus comes from.
So no file changes, no history is rewritten, nothing is force-pushed,
and the repository stays public.
A session that rediscovers this must not reopen it, must not offer to scrub it,
and must not treat it as an incident.
The relationship that makes it fine is not visible from inside the repository,
which is why it is written here.

### The rule going forward

The instruction attached to that decision was to take extra care not to expose
more in commits later.
Permission is not indifference, and it is not retroactive cover for adding more
without thinking.

-   Corpus text enters a commit only when it carries evidence nothing else can carry,
    and only as much of it as the evidence needs.
    Where a rendering changed a tense, or an aligner paired the wrong headings,
    the wording IS the finding and quoting it is right.
    Where the point is a count, a rate, a slice index or a model's behaviour,
    it is not, and the id and index say it better.

-   Never quote because quoting was easier than naming.
    That is the failure mode that produced 185 lines:
    each one was individually defensible and nobody was counting.

-   A document ABOUT the exposure quotes nothing.
    Naming files and counts is the whole discipline,
    so an audit that reprints the evidence repeats the fault it records.

-   Everything else about handling the corpus is unchanged.
    It is read at runtime from the pinned clone by `git show <sha>:<path>`,
    corpus files are never committed,
    and artifacts and grading sheets stay under run directories outside the repository.

### Why this is not an `AGENTS.md` rule

Proposed there and declined by the owner as too narrow to be worth a repo-wide
shortcode: it is a rule about one corpus, in one package, under one relationship.
It belongs where the people working on that package will read it.

## Corpus exposure is not a blocker, and sanitization is the last step (2026-08-25)

Supersedes the caution in the corpus-exposure sections of this handover.
The owner set the plan after `#456` was measured:

-   COMMIT THE CORPUS HOWEVER IS CONVENIENT.
    Do not spend effort avoiding corpus text in commits,
    do not shrink a quote to dodge exposure,
    and do not treat a corpus-bearing diff as something to route around.
    Nothing about corpus text blocks any commit on this branch.

-   SANITIZATION HAPPENS ONCE, AT THE END.
    When the pipeline is production ready,
    tell the owner with the `AskUserQuestion` tool rather than in ordinary prose,
    because that is the signal they are waiting for.
    They will disable branch protection temporarily,
    and the corpus content committed along the way gets sanitized then.

-   THE DENY-LIST IS BUILT AND NOT INSTALLED.
    `doc/decision/corpus-deny-list-for-forbidden-strings.md` has the design and the evidence.
    Installing 10206 literal rules today would cost about two minutes of rule compilation
    on every single commit, because the scanner recompiles the runtime rules file per scan.
    `#456` is the fix. The deny-list waits for it rather than taxing every commit,
    and it waits without cost, since sanitization at the end covers the same ground.

WHAT THIS DOES NOT CHANGE.
The corpus is still read at runtime from the pinned clone,
corpus files are still never committed as corpus files,
and artifacts and grading sheets still live under run directories outside the repository.
The change is that quoting inside our own documents is now unremarkable.

FOR THE SANITIZATION ITSELF (rendering-8, 2026-08-26):
the persisted runs of the settled rendering audit, `<runs dir>/rendering-audit-settled/*.json`,
carry document spans and model prose in every row's `report`
(`locator.text`, `focus.text` on both sides, each voice's `reason`),
so they are corpus-bearing whatever the `textIdentity` digest beside them says;
the module notes that once claimed otherwise were corrected in `744890056`.

## Two source fixes found while the run was live, both owed (2026-08-25)

Both were found by testing documentation against reality rather than by reading code,
and both edit `src/`, which restamps the pipeline digest and invalidates
the slice cache the calibration has been buying since 01:29Z.
So both wait for the run, and both belong in the landing sequence
after the standing is read and the parked work is extracted.

-   `#217`: `verify-published` cannot tell a clean run from an empty one.
    NOW BUILT AND PARKED, in the section `#217` is built, GFP-proven and parked.
    `doc/runbook/translation-repair-corpus-pass.md` carries the workaround until it lands.

-   `#218`: a real Bilibili account UID sat in the TSDoc `@example` for `readingAnchors`
    in `image-reading-sense.ts`.
    NOW FIXED AND PARKED beside `#217`.
    An invented UID was rejected, because any ten-digit number could be somebody's real account.
    The example now reads `'posted by Mittens on 2019-04-07'`,
    which demonstrates more of what the docstring claims than the original did:
    it lists a date and a username first, and the old example carried only a digit run.

`#219` is not a code fix and is the easiest thing here to lose:
when the pipeline is production ready, say so with the `AskUserQuestion` tool,
not in prose, because that is the signal the owner is waiting for
before disabling branch protection to sanitize the committed corpus text.

## Work while the arms ran (2026-08-26)

Arms A2 and D (`bw9dhhs6c`) hold `dist` from 15:54Z; nothing below is built or tested yet. Source edits,
`lint:oxlint` and `lint:types` ran (the type-check emits nothing under `dist/final/node`; it writes only a
`.tsbuildinfo`, the tsconfig has `noEmit`). Every test file that imports the bundle type-errors against the stale
bundle until the next build; those are the only lint findings left and they are not defects.

THE ADVISOR CHECKPOINT ON THE READING PLAN (16:00Z, answered 16:02Z) changed the plan in four places, all done
or scheduled: the fresh pass adds the hard cases (`Toka_ls`, `XIEPT2`, and `XingZ60` in a second launch after
the ten, since `XingZ60` alone projects at 385 minutes against the 420 minute cap and the pass orders `--only`
by the corpus listing); sol reads each fresh page as a second reader (`scratchpad/sol-read.py <entry> <runs-dir>`
attaches the three whole files with `@file` arguments, which `pi --help` documents, and backgrounds the call);
every fresh-page defect is traced into the artifact (slice, lane, ballots) before it is filed; and the reading
document's preamble was made true (it quotes one rendering; it said it quoted none).

`#264` WAS MEASURED INSTEAD OF ASKED. Over all 92 archive `page.en.md` files at the pin, 85 carry typographic
quotes and the corpus holds 1173 U+2019, so a U+2019 the pipeline writes is house style; the defect narrows to
invisible variants (U+2011, U+00A0, U+00AD) written where neither side has them. The decision, recorded in the
reading document with veto invited: normalize that class at candidate intake, before the deciders judge, so both
still judge the bytes that ship (`#162`). Not built yet.

`#263` LANDED IN SOURCE (`d8a040edf`, `04f1ebafd`). The refine stage now returns `heard` (the refiners with a
usable answer, proposal or not), `settleRefinedSlice` threads it out as `refinersHeard`, the calibration's slice
record carries `refinerHeard`, and `readStandingCoverage` takes a fourth input, `answered: SeatAnswers`, which is
`recorded` with ids or `unrecorded`. The coverage has a fourth state, `answeredUnslated`, with its own line
(`ANSWERED AND WAS NEVER SLATED`); the silent line reads `ANSWERED NOTHING USABLE` where answers are recorded and
`NO CANDIDATE OF THEIRS REACHED ANY SLATE ... this seat does not record who answered` where they are not. The
editor and translate seats are unrecorded (`#266`): their stages carry only a heard count out, and the chunk
outcome is persisted, so carrying ids needs the in-memory path `settleRefinedSlice` uses. The seat report moved
to `editor-calibrate-standing.ts` as `standingReportLines`, which returns lines so a test reads it without the
console; the first name chosen collided with `seat-tally.ts`'s `seatReportLines`, which the barrel union refused.
Owed after the build: the suites, GFP on the producer-silence guard (remove the `answered` input from the
refiner's `produced` wiring and see the `#263` cases fail), the whole suite solo, and a live `editor-calibrate`
reading with the REFINER coverage line checked against its SEAT lines.

`#265` LANDED IN SOURCE (`fd4f7546f`). `publishFixedPage` now takes `sourceText`, reads both sides' destinations
off the pipeline's own parse (`parseBodyTolerant` is exported `@internal` from `parse-document.ts`; front matter
split, invisible lines and HTML comments masked, strict MDX with the plain-markdown downgrade) unioned with a
linear scan for `http://` and `https://` runs, and returns `{ path, destinations }`. The pass prints
`DESTINATIONS <id> source=N page=M dropped=K` beside the tally (counts only; the addresses go to the run log at
info, a warn line carries the count). A dropped destination is a finding, never a refusal: the page is what both
deciders approved. `pass-entry.ts` reached its line budget and the capped failure text moved to
`tally-error-text.ts`; the destination exports live in `publish-barrel.ts` because `corpus-barrel.ts` reached
its budget too. Owed after the build: the suites, GFP (drop the union of the scan and see the bare-run cases
fail), and a live reading of the `DESTINATIONS` lines on the fresh pass.

THE SITE'S OWN PARSER, on the owner's pointer. The corpus repo (`~/one-among-us/data`, `package.json` at the
pin) builds each `page.md` itself: `scripts/build.ts` rewrites `<!--` to `{/* ` and `-->` to ` */}`, splits
front matter with `markdown-yaml-metadata-parser`, and `scripts/mdx.ts` compiles with `@mdx-js/mdx` `compileSync`
under `remarkMath` and `rehypeKatex`, no GFM. `one-among-us/web` (cloned shallow to `~/temp/agent/oau-web-20260826`)
renders the compiled page and uses `marked` only for metadata. The pipeline parses with `remark-mdx` plus
`remark-gfm` after masking comments to whitespace. Measured at the pin: two or more `$` on 34 source pages,
`[^` on 23, `<!--` on 17, a JSX component on 53. `#267` holds the reconciliation question; the destination
check is unaffected because it scans bare runs as well as the tree. VERIFIED WITH THE SITE'S OWN RENDERER
(shallow clone at `~/temp/agent/oau-data-20260826`, deps from its lockfile via npm, `renderMdx` driven by
`scratchpad/render-probe.ts`): `[^1]` compiles to literal text, `$x^2$` to KaTeX markup, a JSX comment
vanishes, a GFM table stays literal. Classified at the pin: 6 source pages carry a math-like `$...$` pair
(14 occurrences); the other 171 `$` are lone. So math is real on the site for six pages and the pipeline
reads it as prose; footnotes are structure to the pipeline and literal text on the site, which loses
nothing since the text is preserved either way.

ARM A2 IS IN (`#260`), and the band is wider than one of the two effects it was meant to size. Wall clock from
the log's first to last timestamp (the `run-timing-report` task depends on `build`, which arm D forbids, so the
span was read with a timestamp scan): A 43.18 min, A2 58.95 min, on an unchanged build over the same four
slices. That is a run-to-run band of at least 15.8 min, 37% of A, and the calls themselves were slower, not the
pipeline: stream sum 9294 s against 6312 s, p50 7017 ms against 5260 ms, p95 136 s against 78 s, 8 cut voices
against 6 (all `qwen3.8-max` and `hf:Qwen/Qwen3.8-27B`), 312 of 320 voices heard against 304 of 312, no
recovery round against two. Provider speed between 11:08Z and 15:54Z moved more than any dial did.

NORMALIZED AGAINST CALL TIME the picture is clean. Wall clock over stream sum: A 0.41, A2 0.38 (band about
0.03), C 0.43, B 0.23. Overlap 4 (B) sits 0.18 below A, six times the band, so the overlap effect stands.
The 300000 ms window (C) sits 0.02 above A, inside the band, so its cost is UNMEASURED at this scale rather
than the +24.7% a single pair of runs suggested; the 2-of-6 voices it bought back is also inside what
provider speed alone moved (A2 lost 8 with no window change). Arm D (overlap 4 at 300000 ms) is running; read
it the same two ways. What goes back to the owner with D: the overlap default can be decided on this evidence;
the window cannot be decided on single runs, and the honest options are interleaved repeats (A, C, A, C on one
afternoon) or leaving it at 180000 ms with the dial available.

DOCS UPDATED 2026-08-26 on the owner's instruction "Please update all docs now": this file; the package README
(destinations line, the fold at intake, the site's grammar, the four coverage states, status); the corpus pass
runbook (destinations check); `doc/planning/translation-repair-readiness-signal.md` (since the answers);
`doc/planning/translation-repair-open-decisions.md` (questions 11 and 12, the two dials, with rankings);
`doc/decision/translation-repair-straggler-grace.md` (addendum: the dial and the band);
`doc/audit/translation-repair-package-audit.md` (calibrate-1 superseded in part by `#263`);
`doc/troubleshooting/translation-repair-invisible-characters.md` (the fold);
`doc/troubleshooting/translation-repair-unread-signals.md` (the misread coverage line, the destinations line);
`doc/audit/translation-repair-output-reading-20260826.md` (tooling, the second reader's dry run). `#268` holds
the reading tooling's move into the package.

ARM D IS IN (`#262`): overlap 4 at a 300000 ms window, same four slices, launched 16:53Z after A2, solo.
Wall clock 29.31 min (log first to last timestamp) against B's 24.18 at the built-in window, with calls that
were slower than B's (stream sum 7591 s against 6249 s, p50 5839 ms against 5318, p95 101 s against 89 s), so
normalized as wall clock over stream sum D is 0.23, the same as B. Voices heard 318 of 320 against B's 302
of 312; cut 2 (one `qwen3.8-max`, one `hf:Qwen/Qwen3.8-27B`) against B's 7, A's 6, A2's 8 and C's 4; no
recovery round. Time in grace was 4591 s against B's 2819 s, and overlap filled it: rounds waited up to 300 s
and the other three slices used the wait. So under overlap the longer window costs nothing measurable and
buys the fewest cut voices of any arm, which is the pairing the question 12 ranking in
`doc/planning/translation-repair-open-decisions.md` did not have when it was written; it now does. The
`#263` coverage line did not fire in D: every seated model drew a row in both tables.

THE BUILD AFTER THE ARMS FOUND FOUR CASES WRONG (whole suite 17:23Z: 828 PASS, 8 FAIL counting each case
twice). Two were the fixes' own tests: the fold test had lost its literal invisible characters to the tool that
wrote it (the module's own table had survived, checked by code point), and the coverage case's four-model
roster had a silent fourth model the expectation omitted. Two were a real defect in `#265`: a GFM autolink
literal in Chinese prose runs into the full-width punctuation after the address, so the tree reader and the
scanner disagreed on one link and the union counted it twice; every destination is now cut at the first
stopper and shed of trailing punctuation before comparison (`trimDestination`). Fixed in `5edd6a3b8` and
`fbf23ceae`; the seven touched suites pass and the package lints clean (0 warnings, 0 errors). The
guard-removal rounds (`scratchpad/gfp-three-landings.py`, eight rounds) and a second whole-suite run follow
serially, then the fresh pass. WHOLE SUITE AFTER `fbf23ceae`: 829 PASS, 0 FAIL, exit 0 (solo run, 17:29Z).
The guard script's first launch crashed on a path it built wrong (`src/src/...`) before touching anything;
relaunched after the fix.

THE SECOND READER'S DRY RUN CHANGED THE READING METHOD. sol read the older `wangzihao980` page (2026-08-22
build) and returned 15 items where this session's own reading had two: 1 inherited blocker (the day of death,
"the next day" where the source says the early hours of that day), 5 inherited majors, 5 inherited minors, and
introduced findings including a restored link shipped inside a malformed sentence beside a terminology split;
verdict, not publishable. The first reading had never looked at the front matter, never checked dates as facts,
and graded faithfulness without naturalness. All three are now in the method
(`doc/audit/translation-repair-output-reading-20260826.md`, "The second reader on the older page"). One new
scope gap fell out: the front matter's `desc` is translated prose and no stage ever reads or repairs it
(`#269`; `document-preparation.ts` reads front matter as identity data only).

THE `#263` MISREPORT RECURRED IN A2, now on two seats: `WROTE NOTHING AT ALL: minimax-m3,
deepseek-v4-flash-0731` beside `SEAT minimax-m3 asked=32 usable=32` and `SEAT deepseek-v4-flash-0731 asked=32
usable=32`. The landed fix reports them as answered-but-unslated; the live check after the build reads this
same line on a fresh calibration.

## Sections aged out into the history (2026-08-26)

Moved verbatim into `doc/handover/translation-repair-history.md` when this file passed its cap by
more than 1500 lines (register item A-5), because each is closed work whose conclusion is already
encoded in the code or in a decision record. Their headings, in the order they now sit in the history:

-   The settled artifacts already carry editor rounds, and they do not support the reseat
-   Zero editor rounds does not mean nothing was repaired (`#200`)
-   How many slices an editor calibration needs, measured from production
-   The 14-slice editor calibration finished, and it settles no seat (`#200`)
-   What the suite actually reaches, measured (2026-08-24)
-   `#217` is built, GFP-proven and parked (2026-08-25)
-   The parked work is now build-and-test verified together, not just apply-clean (2026-08-25)
-   `#216` was half wrong, and reading the source before building found it (2026-08-25)
-   `#215`: a run now says where its wall-clock went, and a CLI reads it back
-   `#205`: the two-lane artifact family is named for its shape, not a version
-   The landing was rehearsed on a throwaway, and it works
-   The three report CLIs are documented, and the landing was re-checked for collisions
-   The refiner column is thinner than the editor column, by about four times
-   The run's power inputs, measured at 38 of 40 slices
-   An unreadable run file printed itself, and the fix was a whole class rather than one CLI
-   A second calibration is in flight, to pay four measurements the landing left owed
-   The same defect had a second half, reaching a sink through a catch (`#224`, 2026-08-25)
-   A third shape, found by asking which other parsers quote (`#225`, 2026-08-25)
-   Does any error class quote what it was handed? Scanned, not sampled (2026-08-25)
-   Every entry point now reports its refusals, settled by measurement (`#226`, 2026-08-25)
-   The cause sweep, which the message scan had missed (2026-08-25)
-   A stream the provider cut short was the one transport failure that never retried (`#228`, 2026-08-25)
-   Which error messages may be repeated, decided by a rule rather than an audit (`#227`, 2026-08-25)
-   The guard proof found the guard was somewhere else (`#224`, 2026-08-25)
-   Four guard proofs, run once the bundle was free (`#225`, `#228`, 2026-08-25)
-   The pipeline now keeps what each model wrote (`#212`, 2026-08-25)
-   The ledger has a reader, and writing it found a real gap (`#212`, 2026-08-25)
-   `#211` is proved at the wire, and the fix is in (2026-08-25)

Moved on the evening of 2026-08-26, when this file stood at 1984 lines against the cap of 2000:

-   AUDIT IN PROGRESS: the whole package, before any new work (`#236`, 2026-08-26). The audit is closed;
    its register with every marker is `doc/audit/translation-repair-package-audit.md`, and the closing
    verification (814 PASS, every entry marked) stands in its "State of the tree" subsection, now in the
    history, and in the register.
