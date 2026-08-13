# Keeping the corpus pass running across agent sessions

A corpus pass outlives the session that started it, and the API failures that
 end an agent session mid-work do not end the pass. This records what is
 supervising the `pass13` run, why there are two supervisors rather than one,
 and how to stop them.

Nothing here lives in the repository. The scripts, logs and the runs directory
 are all outside git, because the runs directory holds corpus text from an
 unlicensed source.

## What stops a pass on its own

Read from `--plan` output at tip `7a6894152`:

-   Soft budget `43200000ms`, twelve hours. The pass stops accepting new
    entries past it.
-   Hard per-entry cap `10800000ms`, three hours.

So a pass ends by itself roughly twelve hours after it starts, with entries
 settled and its slice cache holding only whatever was in flight. Resuming is
 cheap: `discardSliceCache` drops each entry's cache as it settles, so the cache
 only ever holds in-flight work.

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
