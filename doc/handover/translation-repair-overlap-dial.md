# Handover: the overlap dial for the corpus pass (`#261`)

Written 2026-08-26 for whoever picks this up next, including an agent that has read no transcript.
Everything needed to continue is here or in the files it names.

## What this task is

The corpus pass runs its slices one at a time.
Every per-slice loop in the pipeline carries the same comment,
that "aggregate concurrency beyond one stream per model collapses throughput on this plan".
That premise was measured on 2026-08-26 and is wrong:
`doc/decision/translation-repair-calibration-overlap.md` records five matched arms
where four slices in flight took the same total call time in 0.23 of the wall clock
that one slice at a time took in 0.41,
which is six run-to-run bands apart.

The owner decided the editor calibration defaults to four slices in flight under a 300000 ms straggler window.
The corpus pass was deliberately left alone until it is measured there, which is this task.
The dial exists already:
`readOverlap({ fallback, })` in `package/module/translation-repair/src/corpus-run/slice-overlap.ts`
reads `TRANSLATION_REPAIR_SLICE_OVERLAP` and refuses anything that is not a whole number of at least one.
The pass's fallback stays `1` until the measurement says otherwise.

## What has landed

Both commits are on branch `translation-repair-rebased` in worktree `/var/home/user/worktrees/translation-repair`,
and auto-push is on.

-   `5ad32cc5d`:
    `src/overlapped-map.ts` plus `src/overlapped-map.unit.test.ts`, exported from `src/stage-barrel.ts`.
    `mapOverlapped({ items, overlap, oneItem, })` opens at most `overlap` lanes,
    each taking the next unclaimed item and running it to the end before taking another.
    Items therefore START in item order,
    results come back in item order however they finished,
    a failure stops further items from starting while the ones in flight finish,
    and the error thrown is the LOWEST position's,
    which is the one a sequential loop would have thrown.
    `overlap: 1` reproduces the loop it replaces.
    Not `p-limit`, whose queue keeps draining after a failure;
    `p-limit` is still what `editor-calibrate.ts` uses, which is fine because that command has no entry to abandon.
    Three guards are GFP-proven
    (script kept at `~/temp/agent/gfp-overlapped-map.py`):
    the failure short circuit, the lowest-position throw, and the lane count.

-   `748b54841`:
    `src/twin-memo.ts` plus its suite, and `src/translate-slice-settle.ts` plus `src/translate-slice-buy.ts`.
-   `e7e017a36` through `9f1c843d6`:
    `translateDocument` now calls `mapOverlapped` over `settleTranslateSlice`, defaults `overlap` to `1`,
    aggregates records, unfilled passages and findings in slice order,
    counts only records resumed from disk,
    and runs both twin cases at overlap `1` and `2`.
    A successful-call instrument proves `overlap: 2` puts two slices in flight.
-   `1c4a8b78e`:
    the first whole-suite run exposed three expectations left stale by earlier committed changes.
    The message inventory now names `OverlapRefusedError`,
    the one-provider router case uses the still Synthetic-only Nemotron seat rather than the newly dual-routed Qwen seat,
    and spend-cost expectations follow the 2026-08-26 Hyper rates.
-   `bb6883548` through `84ba6eecb`:
    `repairPreparedDocument` now calls `mapOverlapped` over `settleRepairSlice`,
    defaults `overlap` to `1`,
    and exposes the optional argument through standalone `repairTranslation` without reading the environment there.
    It aggregates accuracy outcomes and cache-refusal findings in slice order,
    shares one eligibility-aware twin memo across the document,
    and normalizes torn-down in-flight calls to the caller's abort reason.
    Its twin tests run at overlap `1` and `2`,
    and a successful-critic instrument proves two slices are active at overlap `2`.

## The twin memo, which is the part that is easy to get wrong

Two slices carrying identical source, incumbent and governance ask ONE question,
and since the key stopped naming the slice index they hash the same.
Each sequential driver memoized what it PERSISTED so the second twin reused it,
which is what makes a cold run settle what a warm run resumes.
The memo deliberately held persisted records only:
a record the driver refused to store (nobody heard, an unfilled passage, a stage under quorum)
was not memoized, so the twin asked again,
exactly as a warm run would.
`#238` is the defect that rule came from,
and both `translate-document.unit.test.ts` and `repair-translation.unit.test.ts`
carry an "ASKS AGAIN for a twin of a slice no translator answered" case that pins it.

Under overlap the twin may arrive while the first is still buying,
so the memo holds a PROMISE of what the buy left behind:

-   `TwinStored<Settled>` is `{ kind: 'stored', record, }` or `{ kind: 'nothing', }`.
    Tagged rather than nullish, which the repository requires
    (`no-restricted-syntax(no-nullish-union)` refuses `Settled | undefined`).
-   A twin waiting on `nothing` buys its own, which is the sequential behaviour.
-   The buyer withdraws its entry BEFORE resolving `nothing`,
    so a third twin waking up finds either the second twin's entry to wait on or no entry at all.
-   A failed buy withdraws its entry, warns, and resolves `nothing`:
    the buyer throws on its own path, and the waiter goes and asks for itself,
    or throws under the same abort when it tries.
-   The lookup and the registration are SYNCHRONOUS with respect to each other.
    Two twins that both looked, both found nothing, and both yielded before registering would both buy.
    The buy is started and the entry is set in one synchronous run, with no await between.

One path changed deliberately with the move,
and it is written into `translate-slice-settle.ts`'s module note:
a slice whose CACHED record was refused used to bypass the memo,
so two twins with the same refused record each bought and each persisted under one key.
Both twins now reach the memo after refusing the cache,
so the second reuses what the first persisted, which is what the warm run does.

## Bounded failure cost

At overlap greater than one,
a lower-position failure stops new slices from starting but lets already active slices finish.
Up to `overlap - 1` later slices may therefore spend after a sequential run would have stopped.
This is a deliberate consequence of bounded parallelism,
not semantic equivalence with overlap one after the failure point.
Measurement arms and production readings must report failures and spend beside wall-clock results.

## What is left to do

Order matters only in that each driver should be green and committed before the next one starts,
so the tree is shippable at any moment (see "Do not land a driver into a live pass launch").

1.  `translateDocument`: DONE in `e7e017a36` through `9f1c843d6`.
    Build, focused suites, `lint:oxlint` and `lint:types` pass.
    Removing the overlap argument made the driver suite fail,
    and replacing the shared twin memo with one memo per slice made it fail too;
    both mutations were restored and rebuilt.
    The post-handover whole suite passed with 832 PASS, 0 FAIL and exit 0
    after its first run found and fixed the three stale expectations above.
2.  `repairPreparedDocument`: DONE in `bb6883548` through `84ba6eecb`.
    Build, focused suites, `lint:oxlint` and `lint:types` pass.
    Forcing the driver to overlap one failed the successful-critic concurrency case.
    Replacing the shared twin memo with one map per slice failed the overlap-two ASKS ONCE case.
    Returning the torn-down exchange instead of `signal.reason` failed the abort identity case.
    All mutations were restored and rebuilt.
    Logs are `~/temp/agent/gfp-repair-overlap-ignored.log`,
    `~/temp/agent/gfp-repair-twin-memo.log`,
    and `~/temp/agent/gfp-repair-abort-normalization.log`,
    with matching restored logs beside them.
    Whole-package `buildAndTest` passed with 832 PASS, 0 FAIL and exit 0;
    log: `~/temp/agent/buildAndTest-repair-overlap-20260827T062031Z.log`.
3.  `runRefinePhase` (`src/refine-phase.ts`, 189 code lines, loop at line 211):
    no twin memo (this lane caches but never memoized in-run),
    and its persist condition is `everyStageHeard({ findings, })`.
    Keep `askedRewriters` true if ANY slice asked.
4.  `contestDocumentLanes` (`src/lane-contest-driver.ts`, loop at line 159):
    smallest of the five;
    `worthResuming` decides persistence, and only eligible rows are visited.
5.  `consolidateDocument` (`src/consolidate-driver.ts`, 230 code lines, loop at line 315):
    same shape, `consolidationWorthResuming` decides persistence.
6.  Thread the dial:
    `settleEntry` in `src/corpus-run/pass-entry.ts` reads
    `readOverlap({ fallback: PASS_OVERLAP, },)` ONCE (with `PASS_OVERLAP = 1`),
    logs one line naming the value and where it came from
    (`editor-calibrate.ts` prints exactly such a line and is worth copying),
    and passes it to `runDocumentLanes` and to the contest and consolidation calls.
    `runDocumentLanes` (`src/document-lanes.ts`, line 240) passes it to both lanes.
7.  Measure, then record the result in
    `doc/decision/translation-repair-calibration-overlap.md`
    and in the open-decisions register.

## What is NOT in scope, and why

-   Lane concurrency in `document-lanes.ts`.
    Repair runs, then translate.
    Running both at once doubles the roster's concurrent load,
    which is the variable arm A2 showed dominates single-run wall clock (37% band from provider speed alone),
    so landing it beside the slice dial would make the pass measurement unattributable.
    It is a separate task if anyone wants it.
-   `readDocumentPictures` (`src/document-readings.ts`, loop at line 163).
    Check whether picture reading is even on the measured path per entry before touching it;
    on the ten-entry pass being read now it barely appears.
    If its cost is trivial, leave it sequential and say so in the decision note
    rather than widening the diff.
-   `producer-calibrate.ts`.
    It gets the same dial as follow-up work so both calibrations run under one default;
    until then it runs one slice at a time.

## How to measure it

Arms must be matched the way the calibration arms were, because a single run resolves nothing:

-   Same entries, same build, back to back, nothing else running.
-   A THROWAWAY runs directory per arm.
    A shared directory would resume arm one's slices into arm two and measure the cache, not the dial.
-   Read the result as wall clock over the sum of stream time,
    not as wall clock alone.
    The unnormalized numbers move 37% run to run on provider speed.
    `~/temp/agent/reading-instruments/compare-arms.py` computes exactly this from two run logs;
    its `ARMS` dictionary names the logs to compare.
-   Report cut voices beside the timing.
    Arm D (overlap 4, 300000 ms window) heard 318 of 320 with 2 cut,
    the best of the five arms, so overlap is not obviously paid for in lost voices.

## Do not land a driver into a live pass launch

The `corpus-pass` mise task BUILDS the tree it then runs.
A pass already running is unaffected by a rebuild
(there are no dynamic imports; this was verified, not assumed),
but the NEXT launch ships whatever the tree holds.
So either finish a driver completely, suites and GFP included, and commit it,
or hold the work and launch from the committed tree.
The reading of the pass output gates the readiness signal;
this task does not.

## The verification chain for each landing

Run from the repository root unless stated:

```sh
mise run //package/module/translation-repair:build
mise run //package/module/translation-repair:lint:oxlint   # must print "Found 0 warnings and 0 errors"
mise run //package/module/translation-repair:lint:types
```

Then, from `package/module/translation-repair`, the suites that cover the driver, for example:

```sh
node src/translate-document.unit.test.ts
node src/overlapped-map.unit.test.ts
node src/twin-memo.unit.test.ts
```

The runner prints `] PASS ` and `] FAIL ` per case;
count with those exact strings, never a bare `PASS`, and let the exit code decide.

Both twin cases must be run at overlap 1 AND at a higher overlap,
since the higher one is the case the refactor can silently break.
The two cases are named
"ASKS ONCE for two slices carrying identical text"
and
"ASKS AGAIN for a twin of a slice no translator answered"
in `src/translate-document.unit.test.ts`,
with a matching pair in `src/repair-translation.unit.test.ts`.

Whole suite, in the background, nothing else touching `dist`:

```sh
LOG="${HOME}/temp/agent/buildAndTest-$(date -u +%Y%m%dT%H%M%SZ).log"
mise run //package/module/translation-repair:buildAndTest > "$LOG" 2>&1
echo "exit=$? PASS=$(grep -c '\] PASS ' "$LOG") FAIL=$(grep -c '\] FAIL ' "$LOG")"
```

The last whole-suite run before the repair driver was 832 PASS, 0 FAIL, exit 0.

Guard-failure proof, per the repository rule that a guard proves nothing until it is shown to fail:
remove the guard, rebuild, run the suite, restore, rebuild.
`~/temp/agent/gfp-overlapped-map.py` is a worked example of the shape,
and `~/temp/agent/reading-instruments/gfp-three-landings.py` is the larger one from the previous landings.
