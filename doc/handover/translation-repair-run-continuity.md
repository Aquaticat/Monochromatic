# Keeping the corpus pass running across agent sessions

A corpus pass outlives the session that started it, and the API failures that
 end an agent session mid-work do not end the pass. This records what is
 supervising the `pass13` run, why there are two supervisors rather than one,
 and how to stop them.

Nothing here lives in the repository. The scripts, logs and the runs directory
 are all outside git, because the runs directory holds corpus text from an
 unlicensed source.

## What stops a pass on its own

Read from `START` output at tip `c3f95de9d`,
2026-08-21:

-   Soft budget `259200000ms`,
    seventy-two hours.
    The pass stops accepting new
    entries past it.
-   Hard per-entry cap `25200000ms`,
    seven hours.

BOTH NUMBERS MOVED since this section was first written against tip
 `7a6894152`,
where they were twelve hours and three.
`#114` raised the
 per-entry cap after measuring that four to six entries hit the old one.
Anyone
 reasoning about when a pass ends on its own should read the `START` line of the
 run in front of them rather than any number written here.

So a pass now runs for days rather than for a night,
with entries settled and
 its slice cache holding only whatever was in flight.
Resuming is cheap:
 `discardSliceCache` drops each entry's cache as it settles,
so the cache only
 ever holds in-flight work.


## Two supervisors, deliberately

`~/temp/agent/resume-run.sh` is the older, single-shot watcher. It waits for one
 stop, resumes once, and exits when that resumed run ends. It also aborts
 outright if the pass is still alive at its own six-hour deadline.

`~/temp/agent/resume-supervisor.ts` loops instead, up to eight resumes.

They cannot race. The supervisor refuses to launch anything while the watcher's
 pid is alive, so the watcher always gets the field first and the supervisor
 takes over only once it exits.

The supervisor is TypeScript run directly by node, not bash, for two reasons.
 The repo forbids shell scripts, and bash reads a script INCREMENTALLY: editing
 a running watcher can make it execute a spliced mixture of old and new bytes.
 Node reads the whole file before executing any of it.

## How to stop it

```sh
touch ~/temp/agent/resume-supervisor.stop
```

Checked on every poll of the WAIT loop, so while the supervisor is waiting for a
 pass to stop, the file takes effect within a minute.

IT DOES NOTHING WHILE A PASS IS RUNNING, and this was learned the hard way
 rather than reasoned about. The supervisor spends that time inside `run()`,
 awaiting its child, and reaches no stop check until the pass exits. A stop file
 placed during a run sits unread for as long as the run lasts, which can be
 twelve hours.

So there are two different operations:

-   To stop the SUPERVISOR while a pass is running, kill it by pid. Verified:
    killing the supervisor does NOT kill the pass, because the pass is a child
    that outlives it. That is what makes swapping supervisors mid-run safe.
-   To stop the RUN, kill the pass by pid. The supervisor then sees the field
    clear, and a stop file placed at that point prevents the next launch.

## Guards, and what each one is for

-   **Exact process match.** `pgrep --full --exact 'node src/corpus-run/corpus-pass.ts'`.
    A loose `--full` match without `--exact` also matches any SHELL whose
    command line contains that string, including the supervisor's own launcher,
    so it reports the pass alive forever and nothing ever fires. Measured: loose
    matched four processes, exact matched only the real one.
### The exact-match guard no longer matches the pass, measured 2026-08-21

THE GUARD IS STALE AND THE SUPERVISOR CANNOT SEE ITS OWN CHILD.
 `PASS_PATTERN` in `~/temp/agent/resume-supervisor.ts` is
 `node src/corpus-run/corpus-pass.ts`,
from when the pass ran straight from
 source.
The mise task the supervisor launches,
 `//package/module/translation-repair:corpus-pass`,
now depends on `build` and
 runs `node dist/final/node/corpus-pass.mjs`.

Measured against a live pass:
`pgrep --full --exact 'node src/corpus-run/corpus-pass.ts'`
 returned nothing while `ps` showed
 `node dist/final/node/corpus-pass.mjs --only ...` running.

So `passRunning` reads FALSE whenever a pass is running,
which is the one answer
 every other guard here is built on.
The supervisor would launch a second pass
 on top of a live one.
What contains it is not the guard:
`lockRunsDir` refuses
 the second pass on the same runs directory,
and the SPIN GUARD then reads that
 fast exit as a spin and stands down.
A second pass pointed at a DIFFERENT runs
 directory has no lock to refuse it,
and would compete for provider concurrency,
 which `doc/troubleshooting/synthetic-aggregate-concurrency-stall.md` measured as
 degrading every backend above roughly seven aggregate streams.

The positive and negative controls recorded further down this document were run
 when the pattern was correct,
and they passed.
They do not carry forward
 through a change to how the task launches the pass,
which is the general
 lesson:
a process-identity guard has to be re-verified against the command line
 the task actually produces,
every time that task changes.

`#169` carries the fix.
Nothing was armed when this was found,
so no double
 launch occurred.

### Fixed 2026-08-22: the guard reads `/proc`, and `pgrep` patterns are abandoned

THE PATH WAS ONLY HALF THE DEFECT.
Correcting `PASS_PATTERN` to the built path leaves the guard exactly as blind,
because `--exact` compares the pattern against the WHOLE command line,
and every pass launched by hand carries `--only <entries>`.
Measured against the live pass,
 in order:

-   `pgrep --full --exact 'node src/corpus-run/corpus-pass.ts'`,
    the shipped pattern:
    exit 1.
-   `pgrep --full --exact 'node dist/final/node/corpus-pass.mjs'`,
    the path corrected and nothing else changed:
    exit 1.
-   `pgrep --full 'node dist/final/node/corpus-pass.mjs'`,
    `--exact` dropped:
    exit 0,
    matching the pass and also the shell carrying the pattern text.
-   `pgrep --full --exact` against the entire command line including the
    `--only` list:
    exit 0,
    matching only the pass,
    and useless because that list changes per run.

So the guard has been blind to every hand-launched pass since it was written,
and correct only for the argument-free passes the supervisor launches itself.
That is why the log carries a real `another launcher won the field` line from
 2026-08-14:
that pass had no arguments.

`passRunning` no longer asks `pgrep` anything.
It reads `/proc`,
the way `watcherAlive` in the same file already did,
and counts a process as a pass when its interpreter is `node` and one of its
 arguments is named exactly `corpus-pass.mjs` or `corpus-pass.ts`.
Matching the file NAME rather than the path is what survives the move that broke
 this.
Matching an EXACT name rather than a prefix keeps a `node --eval` one-liner that
 merely mentions the file from counting as a pass.

DO NOT RESTORE A `pgrep` PATTERN HERE.
Two separate flag interactions have each left this guard silently blind,
and both failed by returning false,
which reads exactly like a clear field.

The scan deliberately reads every argument rather than only the one node treats
 as the script.
The two errors do not cost the same.
Reporting a pass that is not there makes the supervisor wait and launch nothing.
Missing a pass that is there makes it launch a second one into the same runs
 directory and the same slice cache.
A rule keyed on argument position would go blind in the expensive direction the
 moment the task grew a node flag ahead of the script.

#### Controls for the pass guard, and why the old ones passed a broken guard

The controls recorded under "Verifying it rather than trusting it" tested whether
 `pgrep` works,
not whether the pattern matches the passes this project runs.
The positive control there used a supervisor-launched pass with no arguments,
and the negative control varied the PATTERN rather than the process state.
Both are satisfiable by a guard that cannot see a `--only` pass.

The replacement varies the PROCESS STATE,
and runs the real function through the real code path:

-   Fail first,
    per GFP:
    the shipped pattern against the live pass,
    exit 1,
    recorded before any fix was written.
-   Live positive,
    against the running pass:
    `passRunning returned true`.
-   Nothing running at all:
    `passRunning returned false`.
-   A pass carrying `--only`:
    `passRunning returned true`.
-   A shell naming `//package/module/translation-repair:corpus-pass`,
    which is the launcher shape that made a loose match useless:
    `passRunning returned false`.
-   A `node --eval` one-liner naming the built path inside its code:
    `passRunning returned false`.

Every control after the live positive answers true on this host while a pass is
 alive,
because the live pass satisfies all of them.
They run inside a fresh PID namespace instead,
where it is invisible:

```sh
unshare --user --map-root-user --fork --pid --mount-proc bash -c \
  'node /decoy/dist/final/node/corpus-pass.mjs --only x & sleep 1;
   RESUME_SUPERVISOR_PASSCHECK=1 node ~/temp/agent/resume-supervisor.ts'
```

`RESUME_SUPERVISOR_PASSCHECK` exists because `RESUME_SUPERVISOR_SELFTEST` runs
 `smokeCheck` first,
which shells out to a mise task that can rebuild `dist`,
and a running pass is EXECUTING from `dist`.
That coupling is why this guard could not be checked against a live pass without
 risking the run,
and it is a large part of why it stayed broken.
The two are now separable.

-   **Smoke check before every launch.** The pass runs straight from SOURCE, so
    a session that stopped mid-edit leaves a broken module graph and the resume
    would die instantly. `--plan` is the documented zero-quota setup check: it
    loads that exact graph, resolves the corpus at the pinned tip, and
    constructs the client, so it also catches a corpus or key failure no build
    would. It runs against a throwaway runs directory, never the real one.
-   **Watcher IDENTITY, not just liveness.** The supervisor defers to the
    watcher by pid, and `kernel.pid_max` here is 4194304 with the counter
    already at 4054937, so pids wrap within days. A recycled pid belonging to an
    unrelated process would make the supervisor defer to a stranger for the rest
    of the night while reporting itself armed. It now reads
    `/proc/<pid>/cmdline` and requires the watcher's own script name, so a
    recycled pid reads as gone. An unreadable process reads as ALIVE, because
    launching a second pass is worse than waiting.
-   **Spin guard.** A resume that exits in under two minutes is treated as a
    spin rather than as work, and the supervisor stands down instead of
    spending its remaining attempts.
-   **Attempt budget.** Sixty resumes. It began at eight and that was wrong, for
    a reason worth keeping: its purpose is stopping a run that dies instantly
    from spinning, which the SPIN GUARD above already does. What the count
    actually consumed was legitimate operator restarts, since landing a pipeline
    change means stopping the pass so it picks the change up. Three of eight
    went that way inside an hour on 2026-08-13. Exhausting it would have ended
    the night's run silently, which is the one outcome every guard here exists
    to prevent.

## Verifying it rather than trusting it

Every check below was run against the live system before the supervisor was
 armed, because a supervisor whose detection is wrong is worse than none: it
 reports itself armed in the log and never fires.

-   Positive control: the real pass pattern must exit 0. It did.
-   Negative control: a bogus pattern must exit non-zero. It did.
-   Liveness: the watcher pid must read alive and a nonexistent pid must read
    dead. Both did.
-   Identity: the watcher pid must match its own script name and must NOT match
    a different one, and a dead pid must match nothing. All three did, so the
    check distinguishes "this pid runs the watcher" from "this pid exists".
-   End to end: with the stop file present, the supervisor logs its arming line
    and stands down, which exercises the whole file including module-level
    await.
-   Smoke check: run by hand at the current tip before arming, exit 0, client
    constructed.

The two functions that decide the night, `run` and `smokeCheck`, are otherwise
 never exercised until the moment they matter. They now have a self-test:

```sh
RESUME_SUPERVISOR_SELFTEST=1 node ~/temp/agent/resume-supervisor.ts
```

It runs the real guard through the real code path and logs what each returned,
 then exits before the loop. Confirmed: `smokeCheck` true, `passRunning` true,
 and the smoke log carried the child's own `PLAN ok` line, which is what proves
 the spawn, the working directory, the environment override and the output
 capture all work rather than merely not throwing. The resume itself calls the
 same `run` with different arguments, so that path is proven too.

Editing the supervisor file cannot disturb a supervisor already running, because
 node reads a module completely before executing any of it. That is the property
 bash lacks and the reason this is not a shell script.

Two probes that FAILED silently while investigating this, both worth
 remembering:

-   `pgrep --exact --list-full node | rg corpus-pass` reported nothing while the
    pass was running. `ps --no-headers -eo pid,etime,args` found it at once.
-   `find <dir> -type f -newermt '-60 minutes'` matched nothing while eleven
    files had been written in that window. `touch --date='60 minutes ago' <ref>`
    followed by `find -newer <ref>` reported them correctly, and a thirty-day
    reference served as the positive control.

Both would have supported the same wrong conclusion, that the run was dead.

## The verification run in flight, started 2026-08-21

This one is NOT under either supervisor.
It is a short bounded run started by
 hand for `#138`'s verification at the user boundary,
and it needs different
 handling from a production pass.

### What is running

-   The pass,
    over six entries into a throwaway directory:

    ```sh
    TRANSLATION_REPAIR_RUNS_DIR=~/temp/agent/vub-run1-20260821 \
      mise run //package/module/translation-repair:corpus-pass \
      -- --only lintong,gaoyanger,keyword233,Weideriche_,Zha_Ke,Acheron
    ```

    Log at `~/temp/agent/vub-run1.log`.
    Find it with
     `pgrep --full 'corpus-pass.mj[s]'`.

-   A capture poller,
    `~/temp/agent/vub-cache-capture.mjs`,
    copying
     `vub-run1-20260821/slice-cache` into `~/temp/agent/vub-cache-capture` every
     200 milliseconds.
    Log at `~/temp/agent/vub-capture.log`.
    Find it with
     `pgrep --full 'vub-cache-captur[e].mjs'`.

The bracket in both patterns is not a typo.
A plain `pgrep --full` matches the
 shell running the `pgrep` itself,
which is recorded in
 `doc/troubleshooting/pgrep-wait-loop-matches-itself.md` and cost two wrong
 readings while setting this up.

One command answers all of it with no pattern to get wrong:
`node ~/temp/agent/vub-status.mjs`.
It scans `/proc` the way the pass guard now does,
matching on the interpreter and on the script's base name,
so it cannot match the shell that invoked it and arguments cannot defeat it.
It prints the settled entries,
the entry still holding a cache,
the captured file count,
and one line per watched script with its pids.

PREFER IT TO A HAND-WRITTEN PATTERN.
A hand-written `pgrep` was read as a dead poller on 2026-08-22 because the
 pattern named a script that never existed,
which the bracket does nothing to catch.
A status check that under-reports invites restarting a poller,
or worse a second pass into the same runs directory and the same slice cache.

### Why a poller exists at all

`runOneEntry` calls `discardSliceCache` the moment an entry reaches its
 artifact,
by design.
That makes a plain second pass unable to exercise the
 resume path:
it either skips the entry on its artifact,
or re-runs it with no
 cache.
Copying the cache aside while the pass runs is what makes a restored
 second run possible.
`doc/planning/the-third-rendering.md` carries the full
 reasoning under "Verifying the stage at the user boundary".

### The constraint a taking-over session must respect

LIFTED 2026-08-22 08:12Z.
Run 2 finished,
`DONE processed=6 of pending=6`,
so the freeze this section describes no longer binds.
The rest of the section is kept because it explains WHY the digest matters,
which the next cached run will need again.

The historical constraint read:
DO NOT EDIT ANYTHING UNDER `package/module/translation-repair/src/` UNTIL RUN 2
 HAS FINISHED.
The slice cache is keyed on the pipeline digest,
which
 `digestPipeline` takes over the built output directory.
An edit moves the
 digest,
every namespace discards,
run 2 re-buys everything,
and the
 verification reports a validator failure that never happened.

Docs are safe:
`tip` moves and the digest does not.
Two builds of unchanged
 source were measured to reproduce
 `sha256-tree-v1:2384524b15c2482c37db147b9654b0036eeebfba7e24b6297854d7bcddef4cc0`.

### How to finish it

1.  `node ~/temp/agent/vub-report.mjs ~/temp/agent/vub-run1-20260821/artifacts`
     parses every artifact back through the shipped whole-artifact parser and
     reports each consolidation slice.
2.  `node ~/temp/agent/vub-capture-check.mjs <artifacts> <capture>` says whether
     the capture holds every settlement worth resuming.
    It is a LOWER BOUND,
    not
     a verdict,
    because `slate-kept-standing` persists on a decision the artifact
     does not record.
3.  Copy the capture,
    never move it,
    into a fresh runs directory's
     `slice-cache`,
    repoint the poller at that directory,
    and run the same
     `--only` line into it.
    A re-bought settlement is the diagnostic evidence and
     the discard will delete it the same way.
4.  Run 2 passes on the per-slice accounting registered under
     "What run 2 must re-buy",
    NOT on a count of
     `reportStreamProgress` lines.
    Those lines are tagged `translation-repair`
     rather than an entry,
    so they cannot be attributed to a slice at all,
    and
     a zero was never reachable.
5.  `node ~/temp/agent/vub-compare.mjs <run1-artifacts> <run2-artifacts>`
     confirms the consolidation records are byte-identical.
6.  Kill the poller.
    It loops forever and will not stop on its own.

### How to stop it instead

Kill the pass by pid.
Its artifacts and its captured cache both survive,
and the
 verification can proceed on whatever subset settled.
A failed or killed entry
 keeps its cache in the run's own directory,
by the same rule that discards a
 settled one,
so re-running that entry in place is a resume case reached
 organically rather than restored.

Nothing in the repository depends on this run.
It writes only under
 `~/temp/agent/`,
outside git,
because a runs directory holds corpus text from an
 unlicensed source.

## What run 2 must re-buy

REGISTERED 2026-08-22 from run 1's capture and artifacts,
before run 2 started.

THIS ACCOUNTING COVERS `Acheron` and `Weideriche_` ONLY,
the two entries settled when it was written.
Four more entries were still to come.
EVERY FURTHER SETTLED ENTRY NEEDS THE SAME ACCOUNTING BEFORE RUN 2 STARTS,
from `~/temp/agent/slice-terminals.mjs` over its artifact and
 `~/temp/agent/capture-decisions.mjs` over its capture.
Reading this list as complete would call a legitimate re-buy a failure.
The criterion this replaces,
zero `reportStreamProgress` lines,
would have
 reported a failure that never happened.

### Why zero was never reachable

`consolidationWorthResuming` in
 `package/module/translation-repair/src/consolidate-driver.ts`
 REFUSES TO PERSIST a `slate-kept-standing` settlement whose decision is
 `declined-indecision` or `declined-rejection`.
Those two are `UNSETTLED_DECISIONS`,
and the reason is given beside them:
a
 thin panel is a fact about a provider on one night,
not a property of the
 question,
and freezing it into the cache would answer every later resume of
 that entry with that night.

So a declining slice is never written to the cache at all.
No poll rate catches
 it,
and run 2 re-asks it BY DESIGN.
`Acheron` slice 0 is exactly that case,
measured in run 1's log at `2026-08-22T02:17:44.907Z`:
`translate stage: winner short of the minimum vote weight; keeping the
 incumbent`.

### What the capture actually holds

Read with `~/temp/agent/capture-decisions.mjs`,
which prints the `decided`
 field the artifact does not carry.

- `Acheron` slice 1 and slice 2 persisted.
   Both `consolidated`,
   both
   `judged` from a `fresh` origin,
   both at gate `usable` 6.
   They are
   identified by `rewrapped`,
   false on slice 1 and true on slice 2,
   which
   matches the artifact.
- `Weideriche_` persisted one of its two slices.
   `consolidated`,
   `judged`,
   `fresh`,
   gate `usable` 6.
   Both its slices carry `rewrapped` true,
   so
   the envelope does not say which one.

### What must re-buy, and why

- `Acheron` slice 0,
   `slate-kept-standing`,
   REFUSED BY RULE.
   Never cached,
   so nothing was lost.
- `Acheron` slice 3,
   `no-standing-text`,
   RACED AWAY.
   The rule persists it,
   the capture does not hold it,
   and the entry is already discarded from the
   live cache,
   so it is gone for good.
- One `Weideriche_` slice,
   RACED AWAY,
   on the same evidence.

Two entries,
two race losses,
one each.
The poller loses roughly one file per
 entry to `discardSliceCache`.

### The instrument, and its positive control

A resumed slice is SILENT.
`consolidateDocument` reads
 `const settlement = resumed ?? await settleFresh()`,
so a cache hit calls
 neither `produceConsolidations` nor `settleConsolidation` and neither tag can
 appear.
A fresh purchase calls both.

Count `[<entry>] [consolidateDocument] [settleConsolidation]` and the same with
 `[produceConsolidations]`.
Run 1's positive control is 27 and 2 for `Acheron`
 across 4 slices,
19 and 1 for `Weideriche_` across 2.

### The pass criterion

Per slice,
against run 1's artifact:

- `Acheron` slice 1 and slice 2 MUST be byte-identical.
   A difference there
   means the resume path is broken,
   which is what this verification exists to
   decide.
- `Acheron` slice 0 and slice 3 MAY differ,
   and a difference is not a
   failure.
- One `Weideriche_` slice MUST be byte-identical and one MAY differ.
   Which is
   which is not predictable from the capture,
   so either assignment passes.
- Both entries MUST show fewer fresh-purchase lines than run 1,
   since half
   their slices resume.
   Equality with run 1 means nothing resumed.

Keep `Acheron` in run 2 rather than dropping it for a cleaner result.
Slice 0
 is the only place the decline-refusal path can be watched executing on real
 state.

### Scope run 2 to entries that settled

Only entries holding a settled artifact when run 1 ends belong in run 2's
 `--only` line.
An entry killed mid-flight keeps a partial cache in the run's own directory,
which is a snapshot rather than a resume,
and it cannot be predicted from an
 artifact that does not exist.

### Run 1 baseline per entry, captured before run 2 starts

Counted from `~/temp/agent/vub-run1.log` at 05:21Z,
with 4 of 6 entries settled.

- `Acheron`:
   27 `settleConsolidation`,
   2 `produceConsolidations`,
   30 lines tagged `consolidateDocument`.
- `Weideriche_`:
   19,
   1,
   21.
- `Zha_Ke`:
   12,
   1,
   14.
- `gaoyanger`:
   9,
   2,
   12.
- `keyword233`:
   still in flight,
   so it has bought nothing yet.
- `lintong`:
   not started.

The accounting closes exactly.
The four settled entries sum to 77 `consolidateDocument` lines,
which is the total the log carries.
That is the positive control for this count,
and it is why these figures can be trusted as a baseline rather than as a filter
 that happened to match.

Run 2 must show fewer than these on every entry it resumes.
Equality means nothing resumed.

## Setting up run 2

STARTED 2026-08-22 06:51Z,
after run 1 settled all six entries in 18932.72s.

### Run 1 finished clean

`DONE processed=6 of pending=6; artifacts=6/92`.
Final per-entry consolidation counts,
which supersede the four-entry list recorded earlier:

- `Acheron`:
   27 settle,
   2 produce,
   30 tagged.
- `Weideriche_`:
   19,
   1,
   21.
- `Zha_Ke`:
   12,
   1,
   14.
- `gaoyanger`:
   9,
   2,
   12.
- `keyword233`:
   19,
   0,
   20.
- `lintong`:
   21,
   3,
   25.

Those sum to 122,
which is the log's total,
so the split is a closed accounting rather than a filter that happened to match.

### Two things had to change before run 2 could run at all

THE PASS SKIPS ENTRIES THAT ALREADY HAVE AN ARTIFACT,
which `corpus-pass.ts:48` states and `settledEntryIds` at `corpus-pass.ts:265`
 implements.
Pointing a second pass at the same directory would have reported `pending=0` and
 processed nothing.
Run 1's artifacts moved to `vub-run1-20260821/artifacts-run1`,
which also preserves them for the byte comparison the criterion needs.

THE LIVE CACHE WAS EMPTY.
`discardSliceCache` deletes each entry's cache as it settles,
and all six settled,
so `vub-run1-20260821/slice-cache` held zero files.
The 107 files under `~/temp/agent/vub-cache-capture` were the only surviving
 copy,
and they were copied back in.
Per entry the restored counts are
 `Acheron` 22,
`Zha_Ke` 23,
`lintong` 18,
`Weideriche_` 16,
`gaoyanger` 14 and
`keyword233` 14.

### The digest held

Run 2's `START` line carries the same
 `pipeline=sha256-tree-v1:2384524b15c2482c37db147b9654b0036eeebfba7e24b6297854d7bcddef4cc0`
 run 1 carried.
Had any file under `src` changed,
every cache namespace would have moved and the restore would have bought
 nothing.
That is what the source freeze was for.
THE FREEZE STILL HOLDS UNTIL RUN 2 FINISHES.
Its cache-key job is done,
because the digest was read at startup and matched,
but run 2 is executing `dist/final/node/corpus-pass.mjs`,
and editing `src` triggers a rebuild that would overwrite `dist` under a live
 pass.

`START files=96 pending=6 done=0` confirms all six were found unsettled,
and the first `SLICE-COST` lines report `exit=resumed`,
so the restored cache is being read rather than ignored.

### How to read the result

The log is `~/temp/agent/vub-run2.log`.
Run 2's artifacts land in `vub-run1-20260821/artifacts`,
beside run 1's in `artifacts-run1`.
No capture poller runs for run 2,
because the criterion reads the log and the artifacts rather than the cache.

## Run 2's first entry, and what it decided

`Acheron` settled in run 2 at 07:24Z,
33 minutes after the pass started,
against 5.3 hours for all six in run 1.

### The consolidation resume works

Slice 2 reproduced byte for byte,
350 characters in both runs.
Slice 3 reproduced as `no-standing-text` with nothing shipped.
Slice 0 was allowed to differ and did,
moving from `slate-kept-standing` to `gate-kept-standing` while shipping the
 same standing text,
which is the refused-persistence path re-executing and landing on a real vote.

Slice 1 differed,
181 characters against 195,
and the criterion called that a failure.
It is not one.
`consolidate-key.ts:108` puts `repairText` in the consolidation cache key,
so a slice whose repair candidate changed has a different key by construction
 and must re-buy.
The consolidation resumed wherever its input was stable and re-bought wherever
 its input moved,
which is what a correct cache does.

### The repair lane does not reproduce, and that is the finding

Every one of the eight lane-slices reported `exit=resumed` with `ms=0`,
so nothing was re-bought at the lane level.
The delivered text still moved.

The restored cache holds repair `repairedText` lengths of
 255,
340,
371 and 251.
Run 1's own artifact recorded `comparison[].repairText` of
 242,
344,
371 and 251.
Run 2 recorded
 252,
326,
371 and 251.

Chunks carrying 371 and 251 agree across all three readings.
The other two disagree in all three,
and 255 and 340 appear in neither artifact.
Those are multisets,
so the `chunkIndex` ambiguity `#99` records cannot explain the gap:
no remapping makes 255 and 340 into 242 and 344.

So run 1's artifact already disagreed with run 1's own cache,
and run 2 disagreed with both.

### What this rules in and out

The lane contest is not the cause.
Every verdict is identical across the runs,
at the same `usable` of 6,
and the translate lane reproduced its text exactly on all four slices.

The mechanism between the cached `repairedText` and the delivered `repairText`
 is not yet identified,
and naming it is the next step rather than a guess to record here.
What is measured is that `exit=resumed` is not evidence that a slice reproduced
 what it cached.

### What this does to the criterion

The per-slice criterion recorded earlier reads a difference at a MUST slice as a
 broken resume.
That inference does not hold,
because a legitimate upstream change moves the key.
The criterion needs to compare against the CACHE rather than against run 1's
 artifact,
since the artifact is the thing now known not to match it.

### The delivered text is not the cached text, measured by overlap

Comparing each cached `repairedText` against the `shippedText` the same run
 delivered,
by common prefix and common suffix,
which needs no passage quoted.

- chunk 2 is identical in both runs at 371 characters.
- chunk 3 is the same length in both runs and NOT identical,
   sharing a 14 character prefix and a 209 character suffix.
   Both runs give the same two numbers,
   so whatever rewrites the middle there is deterministic.
- chunk 0 shares a 62 character prefix in both runs,
   and a suffix of 32 in run 1 against 38 in run 2.
- chunk 1 shares a 39 character suffix in both,
   and a prefix of 222 in run 1 against 82 in run 2.

MOST OF THAT IS THE SEMANTIC WRAP,
which `repair-assemble.ts` applies at assembly and which is length preserving,
so it is benign and expected.
Normalising whitespace on both sides separates it from a real change.
Of 14 readings across the two entries,
11 are wrap-only.
Three carry a genuine text difference:
`Acheron` chunk 0 and chunk 1 in both runs,
and `Weideriche_` chunk 1 in run 1 but NOT in run 2,
where it came back wrap-only.

So which slices diverge from their cache is itself unstable between runs.

### The fact that carries the finding

Chunk 0's cached record says `changed` is false,
carries zero `repairRegions`,
and records no rounds.
The repair lane did nothing there.
Its `repairedText` is 255 characters,
the same length as the incumbent.

Both runs nevertheless recorded `delivery=replacement-shipped` for that chunk,
shipping 242 characters in run 1 and 252 in run 2.
Neither is the incumbent and neither is the cached text.

A slice whose own record says it changed nothing cannot have produced that
 delivery,
so the delivered text does not come from the cached record.
That holds without naming the stage that does produce it,
which is the next thing to find and is deliberately not guessed here.

### The positive control that makes chunk 0 an anomaly

`Weideriche_` chunk 2 has the same cache state as `Acheron` chunk 0:
`changed` false,
zero repair regions.
It delivered `incumbent-retained`,
with the shipped text identical to the cached text,
in both runs.

That is the correct handling of a slice the lane did not change,
and it proves the pipeline can produce it.

`Acheron` chunk 0 has that same cache state and delivered
 `replacement-shipped` instead,
with text that is neither the incumbent nor the cached text,
and that differs between the two runs.
Two slices with the same recorded lane outcome took different delivery paths.

### What run 2 has decided so far

The consolidation resume works.
The semantic wrap accounts for 11 of the 14 cache-to-delivery comparisons.
Three readings carry a real divergence,
and one of those appeared in run 1 and not in run 2.
A slice recorded as changing nothing shipped a replacement.

`#171` carries this.
It outranks the frozen queue,
because a rerun over an unchanged corpus publishing different text is a
 correctness problem on a memorial corpus rather than a performance one.

## Run 2 finished, and the verification's answer

`DONE processed=6 of pending=6` in 4825 seconds,
against 18933 for run 1.
All 36 lane-slices reported `exit=resumed`,
none `computed`.

### The resume works mechanically

The cache is doing its job.
Run 2 took 80 minutes where run 1 took 5.3 hours,
every lane-slice resumed,
and consolidation work fell on five of six entries:
`Acheron` 30 to 24,
`Weideriche_` 21 to 11,
`gaoyanger` 12 to 9,
`keyword233` 20 to 11,
`lintong` 25 to 12.
`Zha_Ke` rose,
14 to 30,
for a reason the next section gives.

### The pipeline does not publish the same text twice

This is the finding,
and it is what verifying at the user boundary was for.

Comparing run 1's artifacts against run 2's,
on the same corpus,
under the same pipeline digest,
from the same restored cache:

- Repair lane,
   18 slices:
   11 published identical text,
   0 differed only by wrapping,
   7 published DIFFERENT TEXT.
- Consolidation,
   17 slices:
   11 identical,
   0 wrap-only,
   6 published DIFFERENT TEXT,
   and 3 changed terminal.

The repair-lane divergences are
 `Acheron` chunks 0 and 1,
`Weideriche_` chunk 1,
`Zha_Ke` chunk 0,
chunk 1 and chunk 3,
and `gaoyanger` chunk 1.
Two entries,
`keyword233` and `lintong`,
reproduced their repair lane exactly.

### The largest divergence

`Zha_Ke` chunks 0 and 3 settled `no-standing-text` in run 1,
shipping nothing at all,
and settled `consolidated` in run 2,
shipping 162 and 278 characters.

Text appeared where a previous run published none.
That is also why `Zha_Ke` bought MORE consolidation work in run 2:
two slices that had no standing text to consolidate acquired some.

### The consolidation contributes its own share

`keyword233` chunk 1 published 419 characters in run 1 and 411 in run 2,
while its repair lane reproduced exactly between the runs.
So the divergence there did not come from upstream.
`consolidate-key.ts` puts `ballots` in the consolidation key,
and ballots come from the contest,
so a contest that answered differently moves the consolidation key even when
 the lane text is stable.

### What this settles

The question run 2 was built to answer was whether the resume path works.
It does.
The question it actually answered is larger:
the pipeline is not reproducible,
and the resume signal does not indicate reproduction.

`#171` carries this.
It outranks the frozen queue.

## The cause: the slice cache stops before the naturalness lane

FOUND 2026-08-22,
from source and confirmed by measurement.

### The structure

`repair-translation.ts` threads `sliceCache` through the ACCURACY pass only.
It resumes at `repair-translation.ts:330` and persists at
 `repair-translation.ts:454`.

`refineSettledSlices` is then called at `repair-translation.ts:535`,
over every slice the accuracy pass settled,
under a comment saying it runs after every accuracy outcome settled and before
 anything reads `changed`.
Neither `repair-refine-step.ts` nor `refine-phase.ts` reads or writes the slice
 cache.

So a resumed run replays the accuracy pass from disk and then BUYS THE
 NATURALNESS LANE AGAIN,
with fresh model calls,
every time.
That is also why run 2 ran a checker stage four times while every slice reported
 `exit=resumed`:
`refine-phase.ts:441` has its own checker.

### The confirmation

Every cached envelope carries `refined` false,
because the cache is written before the naturalness lane runs.

Reading `lanes.repair.result.chunks[].refined` in the artifacts,
against whether a slice published different text in the two runs:

- diverged and refined:
   7.
- diverged and NOT refined:
   0.
- stable and refined:
   1.
- stable and NOT refined:
   10.

Every divergence is a refined slice,
and almost every stable slice was never refined.

The flags also show the mechanism directly.
`Weideriche_` chunk 1,
`Zha_Ke` chunk 0 and `Zha_Ke` chunk 3 were refined in run 1 and NOT refined in
 run 2.
The lane fired on those slices once and declined to the next,
which is why their text moved.

### What this explains that was previously unexplained

`Acheron` chunk 0's cached record says `changed` false with zero repair regions,
and it still shipped a replacement.
It was refined.
A refinement-only change is a real change to the page made by a slice the
 accuracy pass left alone,
and `repair-translation.ts:531` says so outright:
a refinement-only change reaches `changedOutcomes` and `anyChanged`.

`Zha_Ke` publishing 162 and 278 characters where run 1 published nothing follows
 the same way,
one stage further on.

### What a fix has to decide

This is not a bug in the naturalness lane.
The lane is doing what it was built to do.
What is missing is that its output is not part of the unit the cache stores,
so the cache cannot make a run reproducible.

The decision is whether the cached unit becomes the slice AFTER refinement,
or whether the refinement gets a cache of its own keyed on the accuracy result.
Both make a resumed run reproduce.
They differ in what a cache invalidation costs and in whether a refinement can
 be re-asked without re-buying the accuracy pass.

## The full accounting from cache to shipped text

MEASURED 2026-08-22 over all 18 repair-lane slices of the band pair,
comparing each captured slice-cache record against the text that lane
 delivered.
Two transforms separate them,
and together they explain every row with no residue.

### Refinement explains every divergent row and nothing else does

`refined=false` and "the cached text is what shipped" are the same fact on
 16 of 18 rows,
and the two remaining rows are explained in the next section.

The correlation carries its own positive control,
which is why it is worth more than a count.
Three slices changed their refinement answer between the runs:
`Zha_Ke` chunk 0,
`Zha_Ke` chunk 3,
and `Weideriche_` chunk 1 were refined in run 1 and not in run 2.
At all three the cache match flips in lockstep,
from mismatching in run 1 to matching in run 2.
A predictor that moves when the thing it predicts moves is not a coincidence
 of one sample.

`refine-phase.ts` sets `refined: true` on exactly one path,
`refine-phase.ts:352`,
the path where a rewrite both changed the text and kept every confirmed issue.
Every other path pushes the accuracy outcome unmodified.
So `refined=false` is a positive claim that the accuracy text is what shipped,
which is what makes the correlation testable at all.

### The wrap is not length-preserving inside a blockquote

`lintong` chunks 1 and 2 were the only rows refinement did not explain.
They ship 4 and 12 characters more than the cache holds,
they are identical across both runs,
and neither was refined.

The cause is the semantic wrap.
Chunk 1 gains 2 blockquote markers and exactly 4 characters,
chunk 2 gains 6 markers and exactly 12.
When the wrap breaks a line that sits inside a blockquote,
the new line needs its own `> ` prefix,
so two characters appear per inserted break.

Stripping blockquote markers and collapsing whitespace makes the cached text
 and the shipped text equal on 10 of 10 unrefined rows,
with no exceptions.

This corrects a claim recorded earlier in this file and in
 `doc/planning/the-third-rendering.md`,
that the wrap is length-preserving because it only exchanges a space for a
 newline.
That holds in running prose and fails inside a blockquote.
`#167` is where the wrap's treatment of line-structured slices is decided,
and this belongs to it.

### Why this matters for the fix

Once refinement is cached,
cache to shipped becomes a pure deterministic function.
The reproduction criterion can therefore be stated exactly:
a resumed slice must ship text equal to its cached text after blockquote
 markers are normalised,
and any other difference is a defect.

Before this measurement the criterion could not be stated,
because two unexplained rows would have failed it.

## Correction: the consolidation divergence was an incomplete capture

The section titled "The consolidation contributes its own share" names the
 wrong mechanism.
It attributes `keyword233` chunk 1 publishing 419 characters in run 1 and 411
 in run 2 to ballots moving the consolidation key.
That mechanism was never measured.

What the capture actually holds settles it.
`keyword233` has one captured consolidation envelope,
a `gate-kept-standing` terminal carrying 212 characters,
which is chunk 0's length.
Chunk 1's settlement was never captured,
so run 2 had nothing to resume and bought a fresh one.

This is not confined to one entry.
Every entry in the band pair is missing at least one consolidation envelope:
`keyword233` 1 of 2,
`gaoyanger` 1 of 2,
`lintong` 2 of 3,
`Weideriche_` 1 of 3,
`Zha_Ke` 3 of 4,
`Acheron` 2 of 4.
The consolidation settles last per slice,
and the poller loses the last file it has not yet copied,
so the stage that settles last is the stage the capture is worst at holding.

### What still stands and what does not

A consolidation bought fresh produces different text between runs.
That is expected of fresh model calls and is not evidence of a defect.

A consolidation RESUMED from cache reproduces byte for byte.
That was verified separately on `Acheron` slice 2 through the validating
 store,
and `Acheron` slice 1 correctly re-bought because `consolidate-key.ts:108`
 puts `repairText` in the key and the repair text had moved.

So the consolidation resume path is clean,
and run 2 exercised it far less than the run's own numbers suggest.
The repair lane's refinement remains the only measured source of
 non-determinism on a resumed run.

## The fix: the naturalness lane caches in its own namespace

LANDED 2026-08-22 as `fda817aaf`,
with tests in `0f781c687`.

### Why the per-stage cache and not the other option

The fork recorded earlier was whether the cached unit becomes the slice AFTER
 refinement,
or whether refinement gets a cache of its own keyed on the accuracy result.

The first option is not merely worse,
it does not work.
Folding refinement into the existing record means a resumed slice must skip the
 lane,
and the only marker available to skip on is `refined`.
`refine-phase.ts` set that flag on exactly one path,
where a rewrite both changed the text and kept every confirmed issue,
so it reads false both for a slice refinement declined and for a slice
 refinement never saw.
Skipping on it would still rebuy the lane at precisely the slices that flipped
 between the two runs,
which is where the divergence came from.

The second option also keeps a refinement re-askable without rebuying the
 accuracy pass,
which matters because the rewriter roster has churned before.

### What the key covers

`refine-slice-key.ts` keys on the slice source,
the accuracy text,
the declared names,
the filed issues whole rather than by identifier,
the confirmed subset,
the non-translation verdict,
and the rewriter,
judge and checker rosters.

It also keys on the DEFINITIONS of the whole assembled document.
Those are collected across every slice so a paragraph's references resolve
 while it is gated,
which means a neighbour settling differently changes what this rewriter is
 shown.
A key blind to that resumes a stale rewrite,
which is the failure `#126` already recorded once at the accuracy window.

The checkers are in the key even though they never rewrite anything,
because they decide whether a rewrite is rolled back for breaking a confirmed
 repair,
so a different checker roster ships wording this one refused.

### What a resumed slice does not carry

`askedRewriters` is re-derived rather than stored.
It says whether THIS run reached a rewriter,
and the driver reads it to decide whether a run overtaken by an abort may still
 call itself finished.
A slice resumed from disk asked nobody anything,
so carrying the stored answer would report a previous run's purchase as this
 one's.

### How it was verified

Three phase cases and twelve key cases,
all passing,
with the package at 504 passing tests and zero lint findings.

The phase cases COUNT MODEL CALLS rather than compare text.
The scripted client answers the same way every time by construction,
so identical text proves nothing about whether anything was bought.

Shown to fail per GFP.
With the resume removed and the package rebuilt,
the second run makes 8 calls instead of 0 and `askedRewriters` reads true
 instead of false.
The first run asserting it bought something is the positive control:
without it,
a second run buying nothing would prove only that the lane never ran.

### What is still owed

The band pair has not been re-run under the fix.
That is the user-boundary verification,
and it is the next thing to do:
two passes over the same six entries,
comparing published text slice by slice,
with the criterion this file now states exactly,
that a resumed slice must ship its cached text once blockquote markers are
 normalised.

## The capture poller reads directories only

The method that makes this verification possible nearly produced nothing,
and it would have failed silently.

`vub-cache-capture.mjs` walks its source directory,
skips every entry that is not itself a directory,
and copies the files one level down.
Pointed at `slice-cache`,
that is exactly right,
because each entry id is a directory and its cache files sit inside.
Pointed at `slice-cache/<id>`,
every entry it sees is a plain file,
so it skips all of them and copies nothing,
forever,
while still logging as a healthy process.

Run one of the pair was launched with the source pointed one level too deep.
The cache held eight files,
the capture held zero,
and the poller was alive the whole time.
Nothing in the poller reports the difference between
a directory that is empty
and a directory whose every entry it refuses.

Corrected mid-run,
with no loss,
because the poller keys what it has already copied by size and modification time
rather than by having watched it appear,
so a restart recaptures everything present.
All eight files were captured on the first poll after the restart,
which is the evidence that the walk now reaches them.

The markers came with them,
and that matters more than it looks.
`openNamespacedCache` reads each lane's marker
and discards the whole namespace when it is absent or does not match,
so a restore missing them would delete every restored file before anything resumed,
buy the lane again,
publish different text,
and present as this fix not working.
A capture that copies only the slice files is not a capture that can be restored.

The general shape,
which is the reusable part:
a poller that filters by a structural predicate reports the same silence
for nothing to do
and for everything filtered out.
A capture is not verified by the process still running.
It is verified by naming a file that must be in it,
and finding that file.

## The refinement resume verified at the user boundary

Run the same entry twice,
capture the first run's cache before it is discarded,
restore it,
and compare what the second run publishes.
`Zha_Ke` under pipeline `sha256-tree-v1:851f8020`.

The result.
Every published slice is byte-identical across the pair,
in both lanes,
four repair slices and four translate slices,
zero differing.
Before the refinement cache existed the same instrument found
7 of 18 repair-lane slices publishing different text on identical inputs.

The second run made 19 model calls against the first run's 301,
settled in 207 seconds against 4838,
and discarded no namespace.
Both runs recorded the same pipeline digest
even though `tip` moved,
because a documentation commit landed between them:
the digest reads the built directory rather than the commit,
which is the case `pipeline-digest.ts` was written for
and which this pair demonstrates rather than assumes.

The direct evidence for the lane under test is an absence.
The first run's log carries three `runRefineStage` decisions,
two rewrites that won on weight
and one panel tie that kept the repaired text.
The second run's log carries no refinement line at all.
The lane ran once,
was read back the second time,
and published the same words.

### The one slice that differs is the instrument rather than the pipeline

Consolidation slice 3 shipped 277 characters in the first run and 281 in the second.
That difference is the capture,
and the timestamps say so exactly.

The first run gated three consolidations,
at 10:10:01,
10:14:22 and 10:18:50.
The capture holds three consolidation records,
written at 06:10:01,
06:14:23 and 06:15:34 local,
so its newest predates the final gate by more than three minutes.
The artifact was written at 06:18:50,
and `discardSliceCache` runs immediately after it,
so the record for the last gated slice was created and deleted
inside one 200 millisecond poll.
The second run resumed the three it had
and bought the one it did not,
which is one purchase,
matching its single gate line.

This was scoped before the comparison was read,
not after it,
which is the only reason it can be called an artifact rather than a result.
A difference confined to a consolidation slice the capture demonstrably lost
is the measurement failing to record,
not the pipeline failing to resume.
Any other difference would have been a defect.

### A resumed run under-reports its own findings

Found by the same comparison,
and unrelated to the resume under test.

The first run records `alignmentFindings` twice and 34 repair findings.
The second records one and 33.
The missing entry is the same string in both places,
`block-pairing section 0`,
and it is missing because the pairing stage emits it when it BUYS
and does not persist it with the record it caches.

So a resumed artifact's findings list is not a faithful account of what the pipeline determined.
It is an account of what this particular run happened to pay for.
Anything reading findings to characterise an entry
reads a different answer depending on cache state,
which is the same class of defect as `#171`
with telemetry in place of published text.

## The refinement key now covers the incumbent

Landed 2026-08-22 as `f8d747f9c`,
the obligation `#172` left open.

### A field no model reads still belongs in a key

`refineSliceKey` covered the source,
the repaired text,
the definitions,
the declared names,
the issues,
the confirmed set,
the non-translation verdict and the roster.
It did not cover the archive wording.

That absence reads as correct on the first pass through the stage,
because nothing shown to a rewriter,
a judge or a checker carries the incumbent.
Every prompt in the lane is built from the source and the repaired text.

The stored RECORD is a different question from the prompt.
`refine-slice-settle.ts` sets `changed` by comparing its rewrite against the incumbent,
and drops `resolvedIssueIds` wherever the two match,
on the rule the accuracy stage already applies:
a resolution credited to text the document does not carry is a repair no reader saw.
So two runs over one source and one repaired text
but different archive wording settle differently,
and shared a key.

### The failure is a hard stop rather than a wasted purchase

A key too narrow usually costs correctness quietly.
This one does not.
`repair-refine-step.ts` asserts over every refined outcome,
resumed ones included,
that the stored `changed` agrees with the incumbent the current run computed.
There is no discard path.
A resumed slice carrying the other run's verdict throws,
and it throws on every later resume of that entry rather than once.

### Nothing pinned the two texts together

The obvious way to close this without touching the key
is to establish that no path yields a moved incumbent under an unchanged repaired text,
which would make the omission harmless.
That check was not run,
deliberately.
Even a true answer would be a coincidence of what other stages happen to do
rather than an invariant anything asserts,
and a later change to slicing or pairing would break it with no test failing.
`consolidate-key.ts` already covers the standing text for the same reason,
which makes this the in-repo precedent rather than a new idea.

### The phase hands over its resolved incumbent

The key is given the same variable the settlement compares against,
not a re-derivation of it.

`refine-phase.ts` computes the incumbent as the prepared slice's target text
falling back to the outcome's repaired text,
and the fallback fires wherever no prepared slice sits at an index.
A key that re-read the prepared slice itself would cover an absent incumbent
while the settlement below compared against the repaired text,
so the two would answer different questions
on exactly the path that has no archive wording to check.

### Shown to fail without it

The key-movement test was committed first,
then the pre-change `refineSliceKey` was restored over it and the package rebuilt.
Exactly one test failed,
the new one,
and the suite passed again once the field was put back.

No cache generation bump was needed.
The hashed array gains an element,
so no key written before this change can collide with one written after it,
and any source edit moves the pipeline digest regardless.

One consequence worth stating for the next session:
the `vub171` capture taken for `#172` is no longer restorable,
because its stored markers name a digest this change moved.
That is expected and costs nothing.

## The pairing cache now stores what the round reported

The pairing namespace held a bare list of correspondences.
A resumed entry makes no calls for a cached section,
so everything that section reported the first time was reported by nothing the
 second time:
the per-section pairing counts,
the `block-pairing section N fell back to scoring` notice,
and every voice-level finding the round produced.

The stored record now carries the findings beside the pairs,
matching `RefinedSliceSettlement`,
which is the shape that already got this right.
`isCachedPairing` refuses a bare array,
though nothing depends on that refusal:
the namespace is discarded whenever the stored generation differs from the
 running pipeline digest,
and editing these files moves that digest.

### The two gates were never the same gate

Three findings leave a section,
under three different conditions.
The voice-level findings arrive unconditionally.
The pairing-count line is filed where any voice was usable,
which is also what decides whether the round may be stored at all.
The fallback notice is filed where the roster agreed on nothing,
which is independent of both.

Collecting them into one list and storing it invites a regression that the
 resume test cannot see:
if the document's own list is fed only where the record is persisted,
a round nobody answered loses its findings on the COLD run,
and no cached section exists to notice.
The list is therefore fed on every path,
and only the persist stays gated.

### The fallback notice had to move

It was filed after the store wrote,
so storing the collected list would have stored everything except the one
 finding the comparison originally caught.
It is now filed before the write.
The warning beside it is emitted again on a resumed run rather than only the
 first time,
because keeping the deterministic aligner is what that run is doing,
not something that merely happened once.

### Roster reachability is stored on purpose

`block-pairing unusable (<model>: <message>)` names a call that failed.
Replayed off disk it describes a call the resumed run never made,
which is a fair objection and it is stored anyway.
The findings say what buying this pairing cost,
and a resume that dropped them would report a healthier roster than the one
 that produced the stored pairs.
`RefinedSliceSettlement` keeps its `refine-candidates (N/M heard)` line for the
 same reason.

### Shown to fail

The driver had no cache coverage at all before this,
so nothing would have noticed the findings going missing.
The new test runs the same document twice over one map and compares the two
 findings lists whole,
rather than sampling a string,
because a replay that keeps some findings and drops others is the shape this
 defect actually had.
It asserts the cold run said something first,
since two empty lists compare equal.
Removing the replay line and rebuilding fails that test and no other.
