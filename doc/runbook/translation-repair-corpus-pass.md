# Running a translation-repair corpus pass

A pass reads the pinned corpus,
sends slices to two model providers,
writes one settled artifact per entry,
and publishes a mirrored tree of fixed English pages.
It costs real money and real subscription allowance,
and a long one runs for hours.

This document is the procedure.
`package/module/translation-repair/README.md` is the reference for what each knob means,
and `doc/handover/translation-repair-run-continuity.md` is the record of how the supervisors
and their guards came to be the way they are.
Neither is ordered,
and neither can be followed from top to bottom by someone who has not run one before.

## What this proves

That a person who is not the agent which built the pipeline can start a pass,
tell a healthy one from a sick one while it runs,
and afterwards decide whether its output is fit to ship,
using only this document and access they can obtain.

## Why this is a runbook rather than a script

Two prerequisites cannot be bridged,
and they are the reason this is written for a person.

-   The decryption identity at `~/.config/mise/age.txt` is a private key.
    An agent cannot create it, recover it, or read it out of anywhere else.
    Without it every credential in `.env.local.json` stays encrypted
    and the run reaches its first model call and throws.

-   Budget is bought, not arranged.
    Charm Hyper is a prepaid balance that does not refill on a schedule:
    it read `0` continuously through the whole of 2026-08-24,
    before, during and after a pass,
    and reached `10000` on 2026-08-25 only because credits were purchased.
    Synthetic is a subscription allowance that does refill on its own schedule,
    which the account owner can sometimes reset, but not reliably and not on demand.

Everything else here is scripted,
and is given as the exact command to paste.

## Setup

Status:
TODO | DONE

1.  Confirm the decryption identity exists.

    ```sh
    ls -l ~/.config/mise/age.txt
    ```

    Expected: one line naming the file.
    If it is absent, stop.
    Nothing further in this runbook can work,
    and the key cannot be regenerated from anything in the repository.

2.  Confirm both credentials are present in the encrypted store,
    without printing their values.

    ```sh
    cd -- /var/home/user/worktrees/translation-repair
    grep --only-matching '"TRANSLATION_REPAIR_[A-Z_]*"' .env.local.json | sort --unique
    ```

    Expected, exactly these two lines:

    ```text
    "TRANSLATION_REPAIR_CHARM_HYPER_API_KEY"
    "TRANSLATION_REPAIR_SYNTHETIC_API_KEY"
    ```

    Key NAMES are plaintext in a sops-encrypted JSON file and values are not,
    so this reads the names and cannot disclose a secret.
    Never read a running process's environment to check this:
    `/proc/<pid>/environ` prints key values in full.

    The Charm Hyper name carries `CHARM` in the middle.
    A variable missing it is read by nothing and reported by nothing,
    and the run proceeds on one provider while appearing configured for two.

3.  Prepare the scratch root that will hold the log, the pid file and the run directory.

    ```sh
    mkdir --parents "${HOME}/temp/agent"
    chmod 700 "${HOME}/temp/agent"
    ```

    Expected: no output.
    The mode matters: trust checks reject group and other permission bits.

4.  Check the setup for no quota at all.

    ```sh
    mise run //package/module/translation-repair:corpus-pass -- --plan
    ```

    Expected: a line beginning `PLAN ok tip=`,
    carrying `pipeline=`, `client=constructed`, `pending=` and `first=`.
    It reads the corpus, builds the pending list, constructs the client,
    and returns without opening a stream.
    A live invocation took 1.88 seconds.

    `client=constructed` is the credential check.
    A missing Synthetic key fails here rather than an hour into a run.

5.  Read both meters before committing to a launch.

    ```sh
    mise run //package/module/translation-repair:budget-sample > ~/temp/agent/pre-launch.log 2>&1
    cat ~/temp/agent/pre-launch.log
    ```

    Expected: one line containing `METERS`, for example:

    ```text
    METERS synthetic=wet hyper=dry syntheticWeekly=97% syntheticFiveHour=48/50 syntheticThrottled=no hyperBalance=0
    ```

    Capture both streams as shown: the reading is at `info`
    and a meter that could not be reached warns at `warn`.

    A provider reading `dry` does not block a launch.
    The budget layer refuses each model no reachable provider can take,
    the stage records a lost voice, and the run continues on whoever answered.
    It does change what the run's output means:
    any quality figure measured while a provider was dry
    rests on whoever was awake, which can be five of the ten seats.

## Steps

Status:
TODO | DONE

1.  Decide where the run writes,
    and make it a throwaway directory unless this run's output is meant
    to join the pool that later draws treat as natural accumulation.

    ```sh
    RUNDIR="${HOME}/temp/agent/corpus-pass-$(date +%Y%m%d)"
    mkdir --parents "${RUNDIR}"
    ```

    Expected: no output.
    Leaving `TRANSLATION_REPAIR_RUNS_DIR` unset writes into
    `node_modules/.monochromatic/translation-repair-runs` under the worktree root,
    which is the pooled location.
    Any hand-picked run, meaning one carrying `--only`, wants a throwaway.

2.  Launch it detached, with its output captured.

    ```sh
    cd -- /var/home/user/worktrees/translation-repair
    TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" nohup setsid \
      mise run //package/module/translation-repair:corpus-pass \
      > "${RUNDIR}.log" 2>&1 < /dev/null &
    ```

    Expected: the shell prints a job number and a pid, and returns immediately.

    THE PID THE SHELL PRINTS IS NOT THE RUN.
    It is a wrapper, and the work sits two levels below it.
    Measured on a live calibration, the tree was
    a `bash` wrapper holding 2792 KB of resident memory,
    a `mise run` child,
    and a `node dist/final/node/<script>.mjs` grandchild holding 126340 KB,
    which is the process doing the work.
    Do not record the printed pid as the run's identity.

3.  Confirm the run is alive by what it is, rather than by a recorded number.

    Paste this function once per shell.
    It reads each process's argument vector out of `/proc` directly.

    ```sh
    running() {
      for d in /proc/[0-9]*; do
        [ -r "$d/cmdline" ] || continue
        mapfile -d '' -t argv < "$d/cmdline" 2>/dev/null || continue
        [ "${#argv[@]}" -gt 0 ] || continue
        [ "$(basename -- "${argv[0]}")" = node ] || continue
        for a in "${argv[@]:1}"; do
          [ "$(basename -- "$a")" = "$1" ] \
            && printf 'alive pid=%s %s\n' "${d#/proc/}" "$(ps -o etime= -p "${d#/proc/}" | tr -d ' ')"
        done
      done
    }
    running corpus-pass.mjs
    ```

    Expected: one line beginning `alive pid=`.

    DO NOT REPLACE THIS WITH A `pgrep` PATTERN.
    Two separate flag interactions have each left this exact check silently blind,
    and both failed by returning false, which reads precisely like a clear field.
    A pattern is matched against the whole flattened command line,
    so it also matches the shell that merely carries the pattern text,
    and `--exact` then fails against any run carrying `--only`.
    `doc/handover/translation-repair-run-continuity.md` records the measurements.

    Matching the file NAME rather than its path is deliberate,
    and it is what survives the file move that broke this once already.
    It also means a run of the same script under any other path counts as running.
    That asymmetry is chosen: reporting a run that is not there makes you wait,
    while missing one that is there launches a second pass
    into the same runs directory and the same slice cache.

4.  Run nothing else through `mise` until the pass is finished.

    Every pass and probe task declares `depends = ["build"]`,
    so invoking any of them rewrites `dist/final/node` underneath the running pass.
    A pass computes its pipeline digest once at startup and stamps it into every artifact,
    so a rebuild that changes any output file leaves the run recording a digest
    that no longer describes what is on disk,
    and leaves its process holding a mix of old modules and new files.

    A rebuild with no source change is byte-identical and harmless,
    which is exactly why this is easy to get away with and worth stating anyway.

    To read something while a pass is in flight, invoke the built entry point directly
    and skip the task that would rebuild it:

    ```sh
    node dist/final/node/meter-report.mjs "${RUNDIR}.log"
    ```

## What to check

Status:
TODO | DONE

Watch these while it runs.
Each is the exact string the log carries.

-   `[error]` at any point.
    A healthy long run carries none.
    Count them rather than reading for them:

    ```sh
    grep --count '\[error\]' "${RUNDIR}.log"
    ```

    Expected: `0`.

-   `METERS`, once per reading, roughly once a minute while the run is spending.
    `hyper=dry` or `synthetic=dry` is ordinary and not a failure.
    A state of `unreadable` means the meter endpoint could not be reached;
    it still routes as spendable, because a monitoring failure must not become an outage.

-   `ONLY`, only when the invocation was restricted.
    Seeing it on a run you meant to be unrestricted means the pass is doing less than you asked.

-   `CAP OVERRIDDEN`, only when `TRANSLATION_REPAIR_HARD_CAP_MINUTES` was set.
    It names the per-entry ceiling actually in force.

-   `CAP TOO TIGHT`, which is a warning and not a refusal.
    It means the ceiling is at or below one model exchange,
    currently 360000 milliseconds,
    so every attempt is cut before any exchange returns,
    nothing caches, and the queue drops each entry as stalled on its second try.

-   `REATTEMPT <id> queued`, which is healthy.
    The cap ends an attempt rather than an entry,
    and an entry that bought more cache records goes to the back of the queue
    and is tried again inside the same invocation.

-   `STALLED <id>`, which is the earned-re-attempt rule refusing.
    The entry finished an attempt with no more cache records than it started with,
    so it is dropped for this invocation.
    A few are ordinary. Every entry stalling is a defect.

When the run has exited, check its output rather than its log.

1.  Confirm it is actually gone rather than merely quiet.

    ```sh
    running corpus-pass.mjs
    ```

    Expected: no output at all.

2.  Read the published tree back against the artifacts that produced it.

    ```sh
    TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" \
      mise run //package/module/translation-repair:verify-published
    ```

    This spends no quota and calls no model.
    Expected, on a run with nothing wrong:

    ```text
    verify-published: matched=<n> settledWithNoPage=0 pageWithNoArtifact=0
    ```

    followed by one line per entry of the form
    `<id>: wordings=<n> silent=<n> chars=<n>=expected missing=0`,
    and a final line reading
    `verify-published: <n> of <n> pages carry every wording their artifact promised, at the length it implies`.

    CHECK `matched=` BEFORE YOU CHECK THE EXIT CODE.
    A run directory with nothing in it prints the same shape and exits 0:

    ```text
    verify-published: matched=0 settledWithNoPage=0 pageWithNoArtifact=0
    verify-published: 0 of 0 pages carry every wording their artifact promised, at the length it implies
    ```

    The two notices that would reveal the emptiness go to STDERR,
    so a reader who redirected stdout to a file sees a clean pass over zero entries.
    A mistyped `TRANSLATION_REPAIR_RUNS_DIR` currently reads as a green run.
    Capture both streams, and treat `matched=0` on a run you believe settled entries
    as a failure whatever the exit code says.
    Tracked as `#217`.

    Otherwise the exit code is the verdict.
    It is `1` when any page disagreed or any settled entry has no page.

    Four failure lines, each meaning something different:

    -   `SETTLED AND NEVER PUBLISHED: <id>`.
        The worst one.
        A pass publishes before it writes the artifact precisely so that
        an artifact implies a page, and a resumed pass builds its skip set from the artifacts.
        So this entry will never be attempted again and no reader will ever find a rendering of it.

    -   `PUBLISHED AND NOT SETTLED: <id>`.
        A resumed pass re-settles it and overwrites the page.

    -   `WRONG LENGTH: page is <n> characters off`.
        The page is not as long as the archive plus every change the slices made,
        so text no slice decided on was lost or added.
        This exists because checking the wordings alone passed a real page
        with two hundred characters cut out of its middle.

    -   `MISSING slice <n>`.
        The page does not carry that slice's wording in order.

    A `chars=UNWEIGHED(artifact predates stored archive text)` column
    is not a pass. It means that entry could not be weighed at all.

3.  Read what the providers were doing while it ran.

    ```sh
    mise run //package/module/translation-repair:meter-report -- "${RUNDIR}.log"
    ```

    Expected: per provider, a count of readings in each state,
    the fraction of answering readings that found budget,
    and the longest outage as a range rather than a number.
    An outage with no answering reading before or after it is reported open,
    because it may have begun before the record or may still be running.

    Every figure is availability WHEN WE WERE ASKING, which is not availability.

The three tools that follow arrived with `#210`, `#212` and `#215`.
If `mise run` reports no such task, the checkout predates them,
and a run made from that checkout recorded none of what they read either.

4.  Read where the wall clock went.

    ```sh
    mise run //package/module/translation-repair:run-timing-report -- "${RUNDIR}.log"
    ```

    This spends no quota and calls no model.
    Name more than one log to read a resumed run as a single span.
    Expected, on a run whose rounds and calls were both recorded:

    ```text
    run-timing-report: 1 logs, 6 lines
    rounds                 2, 1.50min in total
      waiting after quorum 40.00s, 44.4% of round time
      voices never heard   1
    calls in flight        mean 1.05, peak 2
      busy against span    21.00s of calls across 20.00s of run
    ```

    `waiting after quorum` is the time rounds spent holding the door open for a straggler
    after enough voices had already answered to proceed.
    That is the quantity `STRAGGLER_GRACE_MS` trades against,
    so read it before changing the window.

    `calls in flight` is ACHIEVED concurrency, not configured concurrency.
    A peak below the producer count means the pipeline never actually ran that wide,
    whatever it was configured to do.

    A log written before `#215` landed carries neither line,
    and the tool says so instead of reporting zero:

    ```text
    NO ROUND LINE. This log predates `#215`, so how long each fan-out took and how much of that was spent waiting after quorum are both unrecorded. That is not the same as a run that never waited.
    NO TIMED CALL. Nothing here can be counted in flight, which is not the same as a run that made one call at a time.
    ```

    THE EXIT CODE IS `0` EITHER WAY.
    Check for `NO ROUND LINE` in the output rather than reading the exit code as a verdict.

5.  Read what the run cost.

    ```sh
    mise run //package/module/translation-repair:spend-report -- "${RUNDIR}.log"
    ```

    This spends no quota and calls no model.
    Expected, on a run that touched both providers:

    ```text
    spend-report: 1 logs, 6 lines, 3 seats
    metered seats, priced at rates read 2026-08-25:
      qwen3.8-max: 0.78 credits (97.5%) over 3 calls, in 7168=0.29 out 4096=0.49
      minimax-m3: 0.02 credits (2.5%) over 1 calls, in 1000=0.01 out 500=0.01
    metered run total: 0.80 credits
    subscription seats, which bill no credits and are metered as a percentage of a weekly allowance on the METERS line:
      hf:zai-org/GLM-5.2: 1 calls, in 4096 out 2048
    ```

    Subscription seats are counted and never priced,
    because a weekly allowance is not a per-call rate and pricing it would invent a number.
    Their consumption shows up on the `METERS` line instead.

    `FLOOR, NOT A TOTAL` appears when any call reported no usage block:

    ```text
    FLOOR, NOT A TOTAL: 1 calls reported no usage block, so their tokens are in no figure above
    ```

    Read the total as a lower bound whenever that line is present.

    The price table carries the date it was read.
    A total priced against a stale table is arithmetic about rates that may no longer hold,
    so check the date before quoting the figure anywhere.

    A log written before `spend-line.ts` landed carries no `SPEND` line,
    and again the tool names the absence rather than reporting a free run,
    exiting `0` as it does so.

6.  Read who produced what, and what the judges said about it.

    ```sh
    TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" \
      mise run //package/module/translation-repair:ledger-report
    ```

    This spends no quota and calls no model.
    Expected:

    ```text
    ledger-report: 2 contests under /path/to/run
    1 ballots named nothing, 0 named a candidate the slate did not have
      qwen3.8-max: 2 candidates, 1 chosen, 66.7% of 3 disinterested ballots, 0 self-votes
      hf:zai-org/GLM-5.2: 1 candidates, 0 chosen, 0.0% of 2 disinterested ballots, 0 self-votes
    ```

    `disinterested ballots` excludes the seat's own votes for its own candidate,
    which is why `self-votes` is reported beside the share rather than folded into it.
    A low share means rarely picked as best, which is not the same as wrong.

    DO NOT PASTE `--model` OUTPUT ANYWHERE.
    Passing `--model <id>` prints that seat's candidate text verbatim,
    which on a real run is corpus wording from an unlicensed archive,
    along with the judges' reasons quoting it.
    The summary above names only models and counts and is safe to share;
    the per-model view is not.

    THIS ONE EXITS `1` WHEN IT FINDS NOTHING, unlike the two tools before it:

    ```text
    NOTHING RECORDED. This run wrote no ledger, which is not the same as a run whose models wrote nothing: every run started before candidate-ledger.ts landed has none, and so does any run launched without TRANSLATION_REPAIR_RUNS_DIR set.
    ```

    The difference is deliberate.
    An empty ledger usually means the environment variable was never set,
    which is an operator mistake worth failing on,
    while a log with no `SPEND` or round lines is simply an older log
    and says nothing about the operator.

    A ledger file that is malformed rather than absent currently aborts the whole report
    with an uncaught error and a page of minified JavaScript,
    losing every good file beside it.
    Tracked as `#220`.

## Restore

Status:
TODO | DONE

To stop a run in progress,
kill the worker by the pid that `running` reported,
not the pid the launching shell printed.

```sh
running corpus-pass.mjs
kill <pid>
```

Expected: a later `running corpus-pass.mjs` prints nothing.

A stopped run is resumable and is not wasted.
Every stage caches, so a relaunch into the same `TRANSLATION_REPAIR_RUNS_DIR`
republishes what was already bought rather than re-buying it,
provided no source file changed in between.

If a resume supervisor is driving the pass,
stopping the run and stopping the supervisor are two different operations.

-   To stop the supervisor while a pass is running, kill it by pid.
    Killing the supervisor does not kill the pass,
    because the pass is a child that outlives it.
    That is what makes swapping supervisors mid-run safe.

-   To stop the run, kill the pass by pid.
    The supervisor then sees the field clear,
    and a stop file placed at that point prevents the next launch:

    ```sh
    touch ~/temp/agent/resume-supervisor.stop
    ```

    The stop file is checked on every poll of the supervisor's wait loop,
    so it takes effect within a minute while the supervisor is waiting.
    IT DOES NOTHING WHILE A PASS IS RUNNING.
    The supervisor spends that time awaiting its child and reaches no stop check
    until the pass exits, so a stop file placed during a run
    sits unread for as long as the run lasts, which can be twelve hours.

To discard a run entirely, remove its directory and its log.
Do this only for a throwaway run.

```sh
rm --recursive --force -- "${RUNDIR}" "${RUNDIR}.log"
```

Expected: no output.
Nothing in the repository is touched by a pass,
so there is no working tree state to restore.
