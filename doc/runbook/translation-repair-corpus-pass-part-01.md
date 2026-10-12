# Running a translation-repair corpus pass, part 01

Part 01 of [Running a translation-repair corpus pass](translation-repair-corpus-pass.md),
whose index lists every part in order.

## What this proves

That a person who is not the agent which built the pipeline can start a pass,
tell a healthy one from a sick one while it runs,
and afterwards decide whether its output is fit to ship,
using only this document and access they can obtain.

Concurrent targeted passes require separate run roots,
logs,
and publication roots.
Same immutable build may back more than one pass when no rebuild follows.
Use separate worktree whenever source differs,
build it before launching its own process,
and leave every worktree backing active process unchanged until terminal state.
Shared provider capacity makes concurrent elapsed times unsuitable as matched performance comparison.
Record pipeline digest,
corpus commit,
and fixture provenance for each pass.

Production `corpus-pass` has no pull-request input flag.
It reads corpus clone and commit from `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` and `TRANSLATION_REPAIR_CORPUS_COMMIT`
(package `doc/configuration.md`)
and prints `CORPUS PIN OVERRIDDEN` at launch when either is set.
Pull-request validation points them at exact pull-request commit in isolated corpus clone or minimal Git fixture.
Pull-request 386 procedure of 2026-08-29 predates both variables (`b0a79eb66`,
2026-09-01);
its uncommitted throwaway fork read a `TRANSLATION_REPAIR_CORPUS_DIR` of its own,
which production never reads.
Run `--plan --only <entry>` before spending quota.
Provenance must name throwaway source changes,
pull-request head,
fixture location,
pipeline commit,
pipeline digest,
run root,
and log without copying credentials or corpus wording.

## Why this is a runbook rather than a script

Two prerequisites cannot be bridged,
and they are the reason this is written for a person.

-   The decryption identity at `~/.config/mise/age.txt` is a private key.
    An agent cannot create it,
    recover it,
    or read it out of anywhere else.
    Without it every credential in `.env.local.json` stays encrypted
    and the run reaches its first model call and throws.

-   Budget is bought,
    not arranged.
    Charm Hyper is a prepaid balance that does not refill on a schedule:
    it read `0` continuously through the whole of 2026-08-24,
    before,
    during and after a pass,
    and reached `10000` on 2026-08-25 only because credits were purchased.
    Synthetic is a subscription allowance that does refill on its own schedule,
    which the account owner can sometimes reset,
    but not reliably and not on demand.

Everything else here is scripted,
and is given as the exact command to paste.

## Setup

Status:
TODO | DONE

1.  Confirm the decryption identity exists.

    ```sh
    ls -l ~/.config/mise/age.txt
    ```

    Expected:
    one line naming the file.
    If it is absent,
    stop.
    Nothing further in this runbook can work,
    and the key cannot be regenerated from anything in the repository.

2.  Confirm configured credential names in encrypted store,
    without printing their values.

    ```sh
    cd -- /var/home/user/worktrees/translation-repair
    grep --only-matching '"TRANSLATION_REPAIR_[A-Z_]*"' .env.local.json | sort --unique
    ```

    Fully configured store prints these three lines (the Exa lookup key may appear beside them):

    ```text
    "TRANSLATION_REPAIR_CHARM_HYPER_API_KEY"
    "TRANSLATION_REPAIR_OPENROUTER_API_KEY"
    "TRANSLATION_REPAIR_SYNTHETIC_API_KEY"
    ```

    Key NAMES are plaintext in a sops-encrypted JSON file and values are not,
    so this reads the names and cannot disclose a secret.
    Never read a running process's environment to check this:
    `/proc/<pid>/environ` prints key values in full.

    At least one name must exist.
    One configured provider is valid normal operation;
    an absent provider is marked dry and its seats are unavailable.
    Every name absent is launch refusal.
    The Charm Hyper name carries `CHARM` in the middle.
    A variable missing it configures a run without Hyper rather than silently failing.
    Routing spends in the order Synthetic,
    Charm Hyper,
    OpenRouter
    (`doc/decision/translation-repair-openrouter-fallback.md`);
    a worktree whose store predates the OpenRouter name can still exercise it by launching the worktree's
    bundle with the main repository as the mise config root,
    where the bundle is `package/module/translation-repair/dist/final/node/corpus-pass.mjs`:

    ```sh
    cd /var/home/user/Monochromatic
    TRANSLATION_REPAIR_STARTED_BY=corpus-pass mise exec -- node <worktree>/<bundle> --only <id>
    ```

    Put `env --unset=TRANSLATION_REPAIR_CHARM_HYPER_API_KEY` between `--` and `node` to leave Hyper out of that run.
    The `TRANSLATION_REPAIR_STARTED_BY=corpus-pass` before `mise exec` is what the command's own task would set:
    since 2026-10-06 a built command refuses to run in a process that holds provider keys
    unless that variable names it
    (`package/module/translation-repair/src/task-runner-guard.ts`),
    so a start that skips the task names the command by hand.
    Check which names a root injects before choosing,
    printing presence and never a value:
    `mise exec -- node -e "console.log(process.env.TRANSLATION_REPAIR_OPENROUTER_API_KEY === undefined ? 'absent' : 'present')"`.

3.  Prepare the scratch root that will hold the log,
    the pid file and the run directory.

    ```sh
    mkdir --parents "${HOME}/temp/agent"
    chmod 700 "${HOME}/temp/agent"
    ```

    Expected:
    no output.
    The mode matters:
    trust checks reject group and other permission bits.

4.  Check the setup for no quota at all.

    ```sh
    mise run //package/module/translation-repair:corpus-pass -- --plan
    ```

    Expected:
    a line beginning `PLAN ok tip=`,
    carrying `pipeline=`,
    `client=constructed`,
    `pending=` and `first=`.
    It reads the corpus,
    builds the pending list,
    constructs the client,
    and returns without opening a stream.
    A live invocation took 1.88 seconds.

    `client=constructed` is the credential check.
    A missing Synthetic key fails here rather than an hour into a run.

5.  Read both meters before committing to a launch.

    ```sh
    mise run //package/module/translation-repair:budget-sample > ~/temp/agent/pre-launch.log 2>&1
    cat ~/temp/agent/pre-launch.log
    ```

    Expected:
    one line containing `METERS`,
    for example:

    ```text
    METERS synthetic=wet hyper=dry syntheticWeekly=97% syntheticFiveHour=48/50 syntheticThrottled=no hyperBalance=0
    ```

    Capture both streams as shown:
    the reading is at `info`
    and a meter that could not be reached warns at `warn`.

    A provider reading `dry` does not block ordinary launch.
    Validation or performance arm requiring particular providers must add
    `-- --require-providers synthetic,hyper` (any subset of `synthetic`,
    `hyper`,
    `openrouter`);
    that mode refuses before model calls unless every named key and meter is wet.
    The budget layer refuses each model no reachable provider can take,
    the stage records a lost voice,
    and the run continues on whoever answered.
    It does change what the run's output means:
    any quality figure measured while a provider was dry
    rests on whoever was awake,
    which can be five of the ten seats.

6.  Re-read the completion caps against the runs since the last launch.

    ```sh
    mise run //package/module/translation-repair:cap-census -- ~/temp/agent > ~/temp/agent/cap-census.log 2>&1
    rg '^cap-census:|^[a-z].*: card cap|^  [A-Z]{4}' ~/temp/agent/cap-census.log
    ```

    Expected:
    a `cap-census:` summary line,
    then per seat its card cap and the rule's reading,
    and any flags under it.
    It reads ids and numbers only,
    and spends no quota.
    `PLACEHOLDER WITH A DISTRIBUTION` means a card still names the pooled 99th percentile
    though the rule can now read its own calls (ledger P10):
    write the measured cap on the card.
    `RULE READS ... AGAINST THE CARD'S ...` and `CUTS OVER ONE PERCENT` are for reading,
    not for acting on at once:
    a capped call cannot show a longer answer,
    and the log scope differs from the 2026-09-09 table,
    so read each provider's cut columns (with content,
    with none,
    unpaired) in the full log before moving a cap,
    as `completion-cap.ts` records for the 2026-09-28 reading.

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

    Expected:
    no output.
    Leaving `TRANSLATION_REPAIR_RUNS_DIR` unset writes into
    `node_modules/.monochromatic/translation-repair-runs` under the worktree root,
    which is the pooled location.
    Any hand-picked run,
    meaning one carrying `--only`,
    wants a throwaway.

2.  Launch it detached,
    with its output captured.

    ```sh
    cd -- /var/home/user/worktrees/translation-repair
    TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" nohup setsid \
      mise run //package/module/translation-repair:corpus-pass \
      > "${RUNDIR}.log" 2>&1 < /dev/null &
    ```

    Expected:
    the shell prints a job number and a pid,
    and returns immediately.

    The repository's `CLAUDE.md` asks that long runs start as their own systemd user unit,
    out of the cgroup every session's shell commands share,
    which `systemd-oomd` may kill whole.
    The same launch as a unit:

    ```sh
    systemd-run --user --unit="corpus-pass-$(basename -- "${RUNDIR}")" --collect \
      --property=MemoryMax=12G \
      --working-directory=/var/home/user/worktrees/translation-repair \
      --setenv=TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" \
      --property=StandardOutput=truncate:"${RUNDIR}.log" \
      "$(command -v mise)" run //package/module/translation-repair:corpus-pass
    ```

    Give the unit no `StandardError` property:
    stderr then inherits stdout's file through the same descriptor.
    `StandardError=append:` on the same file opens a second descriptor,
    and stdout,
    writing at its own offset,
    overwrites every line stderr wrote,
    every `warn` among them;
    the TianqiChen66622 launch lost all of them that way
    (the package's audit ledger,
    M147).
    Right after the launch,
    read how systemd wired the unit's two streams:

    ```sh
    systemctl --user show --property=StandardOutput --property=StandardError "corpus-pass-$(basename -- "${RUNDIR}")"
    ```

    Expected:
    `StandardOutput=truncate` and `StandardError=inherit`.
    `StandardError=append` is the form that loses stderr;
    stop the unit and launch again.
    (Measured 2026-10-11 on two throwaway units,
    one launched each way.)
    Under a unit,
    stop the pass with `systemctl --user stop corpus-pass-<name>`,
    where the steps that follow say to kill it by pid.

    Launch-time dials,
    each printed above the work so the log says which run this was:
    `TRANSLATION_REPAIR_SLICE_OVERLAP=<n>` (prints `OVERLAP <entry> value=<n> source=...` per entry),
    `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=<ms>` (prints `STRAGGLER GRACE OVERRIDDEN by ...`),
    `TRANSLATION_REPAIR_WRITER_GRACE_MS=<ms>` (prints `WRITER GRACE OVERRIDDEN by ...`;
    the editor,
    refiner,
    translate and consolidate rounds alone wait this long on a straggler after quorum,
    the other rounds keep the round window).
    Unset,
    the writer rounds wait their built-in 180000 ms and the launch prints `WRITER GRACE built in`,
    and the pass keeps four slices in flight (`OVERLAP <entry> value=4 source=fallback`);
    since 2026-09-06 the plain launch is the production launch,
    and a dial is for a measured arm.
    A value the dial cannot read refuses the launch in one line naming the variable,
    at zero quota,
    which `-- --plan` shows without spending anything.

    ALWAYS KILL AND RELAUNCH,
    the owner's rule of 2026-09-06:
    if source changes after this launch,
    kill the pass by its pid,
    build,
    and launch the same entry again into a fresh `TRANSLATION_REPAIR_RUNS_DIR` on the new build.
    A pass that finishes on a superseded build stamps a digest that no longer describes the files on disk,
    and its page is not readiness evidence.
    When a fix is already known before the launch,
    land it first and launch once.

    For a measured arm that needs named providers,
    insert `-- --require-providers synthetic,hyper` (or any subset of `synthetic`,
    `hyper`,
    `openrouter`)
    after `corpus-pass`.
    Log must contain `REQUIRED-PROVIDERS synthetic,hyper status=wet` before model traffic.
    This flag is wired only to `corpus-pass`;
    probes and calibrations do not support it and cannot serve as required-provider timing arms.

    THE PID THE SHELL PRINTS IS NOT THE RUN.
    It is a wrapper,
    and the work sits two levels below it.
    Measured on a live calibration,
    the tree was
    a `bash` wrapper holding 2792 KB of resident memory,
    a `mise run` child,
    and a `node dist/final/node/<script>.mjs` grandchild holding 126340 KB,
    which is the process doing the work.
    Do not record the printed pid as the run's identity.

3.  Confirm the run is alive by what it is,
    rather than by a recorded number.

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

    Expected:
    one line beginning `alive pid=`.

    DO NOT REPLACE THIS WITH A `pgrep` PATTERN.
    Two separate flag interactions have each left this exact check silently blind,
    and both failed by returning false,
    which reads precisely like a clear field.
    A pattern is matched against the whole flattened command line,
    so it also matches the shell that merely carries the pattern text,
    and `--exact` then fails against any run carrying `--only`.
    `doc/handover/translation-repair-run-continuity.md` records the measurements.

    Matching the file NAME rather than its path is deliberate,
    and it is what survives the file move that broke this once already.
    It also means a run of the same script under any other path counts as running.
    That asymmetry is chosen:
    reporting a run that is not there makes you wait,
    while missing one that is there launches a second pass
    into the same runs directory and the same slice cache.

4.  Run nothing else through `mise` until the pass is finished.

    Every pass and probe task declares `depends = ["build"]`,
    so invoking any of them rewrites `dist/final/node` underneath the running pass.
    A pass computes its pipeline digest once at startup and stamps it into every artifact,
    so a rebuild that changes any output file leaves the run recording a digest
    that no longer describes what is on disk.
    That is the whole of the reason,
    and it is enough on its own.

    NOT BECAUSE THE PROCESS WOULD LOAD A MIX OF OLD AND NEW MODULES,
    which this runbook used to claim and which was measured false on 2026-08-25.
    Every one of the 176 chunks is reached by a static import resolved at startup,
    the only dynamic imports in the whole bundle are `node:fs/promises` and `node:path`
    inside the logger,
    and no child process the bundle spawns runs a file under `dist`.
    A running pass never reads that directory again.
    The claim is corrected rather than deleted because a wrong mechanism invites
    someone to disprove it and conclude the rule is safe to break.

    A rebuild with no source change is byte-identical and harmless,
    which is exactly why this is easy to get away with and worth stating anyway.

    THE RULE IS ABOUT WHAT THE RUN WRITES,
    not about whether the process would notice.
    A measurement CLI that settles no artifact stamps no digest,
    and `editor-calibrate` is one:
    its output is its log.
    Its bundle was rebuilt eight times under a live 40-slice calibration on 2026-08-25,
    twice with deliberately broken source for a guard proof,
    and the run kept producing rounds throughout.
    Three facts were checked on the running process first,
    rather than assumed:
    one process with zero children,
    no descriptor open under `translation-repair/dist`,
    and zero occurrences of `import(` in its entry bundle.

    That is a licence for a calibration and NOT for a corpus pass.
    A pass stamps its digest into every artifact it settles,
    so a rebuild leaves the run recording a digest that no longer describes what is on disk,
    and the pool partitions generations by exactly that field.

    To read something while a pass is in flight,
    invoke the built entry point directly
    and skip the task that would rebuild it,
    naming the command as its task would,
    since a built command refuses to run in a shell that holds provider keys unless that variable names it:

    ```sh
    TRANSLATION_REPAIR_STARTED_BY=meter-report node dist/final/node/meter-report.mjs "${RUNDIR}.log"
    ```

    To exercise a CHANGE while a pass is in flight,
    run the source rather than the bundle:

    ```sh
    node --experimental-strip-types --disable-warning=ExperimentalWarning src/hyper-client.ts
    ```

    Node runs the package's TypeScript directly,
    resolving its `.ts` extension imports,
    so a probe that injects a fake transport can exercise a provider path end to end
    with no key,
    no network and no build.
    The refusal report at every entry point,
    the rule for which classes may repeat their message
    and the verify wiring on cut streams were each verified this way while a pass held the bundle.
    Two limits:
    a suite that imports `../dist/final/node/index.mjs` still needs the build,
    and a probe run this way exercises the source rather than the artifact,
    so it verifies the change and not the packaging.

    `mise run //package/module/translation-repair:lint:types` and `:lint:oxlint`
    carry no build dependency and are safe at any time.
