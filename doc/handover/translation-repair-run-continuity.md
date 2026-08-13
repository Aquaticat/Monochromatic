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

Checked before each wait and again before each launch, so it takes effect
 promptly rather than after the current wait expires. To stop a run already in
 flight, kill the pass by pid; the supervisor will see the field clear, and the
 stop file then prevents the next launch.

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
-   **Spin guard.** A resume that exits in under two minutes is treated as a
    spin rather than as work, and the supervisor stands down instead of
    spending its remaining attempts.
-   **Attempt budget.** Eight resumes, so a failure mode nobody predicted
    cannot run all night.

## Verifying it rather than trusting it

Every check below was run against the live system before the supervisor was
 armed, because a supervisor whose detection is wrong is worse than none: it
 reports itself armed in the log and never fires.

-   Positive control: the real pass pattern must exit 0. It did.
-   Negative control: a bogus pattern must exit non-zero. It did.
-   Liveness: the watcher pid must read alive and a nonexistent pid must read
    dead. Both did.
-   End to end: with the stop file present, the supervisor logs its arming line
    and stands down, which exercises the whole file including module-level
    await.
-   Smoke check: run by hand at the current tip before arming, exit 0, client
    constructed.

Two probes that FAILED silently while investigating this, both worth
 remembering:

-   `pgrep --exact --list-full node | rg corpus-pass` reported nothing while the
    pass was running. `ps --no-headers -eo pid,etime,args` found it at once.
-   `find <dir> -type f -newermt '-60 minutes'` matched nothing while eleven
    files had been written in that window. `touch --date='60 minutes ago' <ref>`
    followed by `find -newer <ref>` reported them correctly, and a thirty-day
    reference served as the positive control.

Both would have supported the same wrong conclusion, that the run was dead.
