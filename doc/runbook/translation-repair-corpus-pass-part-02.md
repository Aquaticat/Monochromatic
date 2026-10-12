# Running a translation-repair corpus pass, part 02

Part 02 of [Running a translation-repair corpus pass](translation-repair-corpus-pass.md),
whose index lists every part in order.

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

    Expected:
    `0`.

-   `METERS`,
    once per reading,
    roughly once a minute while the run is spending.
    `hyper=dry` or `synthetic=dry` is ordinary and not a failure.
    A state of `unreadable` means the meter endpoint could not be reached;
    it still routes as spendable,
    because a monitoring failure must not become an outage.

-   `ONLY`,
    only when the invocation was restricted.
    Seeing it on a run you meant to be unrestricted means the pass is doing less than you asked.

-   `SPEND CEILING OVERRIDDEN`,
    only when `TRANSLATION_REPAIR_RUN_SPEND_CEILING_USD` was set.
    It names the USD this run may spend on OpenRouter before it stops starting entries;
    the built-in is 20.

-   `SPEND CEILING reached`,
    when the run has spent that allowance.
    The pass starts no further entry and the entries already running finish;
    `DONE processed=` then reads short of `pending=` for money rather than for time.
    Raise the ceiling for a deliberately larger run.

-   `CAP OVERRIDDEN`,
    only when `TRANSLATION_REPAIR_HARD_CAP_MINUTES` was set.
    It names the per-entry ceiling actually in force.

-   `CAP TOO TIGHT`,
    which is a warning and not a refusal.
    It means the ceiling is at or below one model exchange,
    currently 360000 milliseconds,
    so every attempt is cut before any exchange returns,
    nothing caches,
    and the queue drops each entry as stalled on its second try.

-   `REATTEMPT <id> queued`,
    which is healthy only after resumable operational error or hard cap.
    Entry that bought more cache records goes to back of queue.
    Quality rejection and `status=INCOMPLETE` must never produce this line.

-   `TALLY <id> status=INCOMPLETE`,
    which means stage-local work remains.
    It is neither success,
    quality verdict,
    nor publication evidence.
    Cache stays,
    but whole entry does not restart in same invocation.

-   `STALLED <id>`,
    which is the earned-re-attempt rule refusing.
    The entry finished an attempt with no more cache records than it started with,
    so it is dropped for this invocation.
    A few are ordinary.
    Every entry stalling is a defect.

When the run has exited,
check its output rather than its log.

### Three exit codes every command in this runbook can leave

Each command has its own verdicts in `1` through `3`,
listed with it.
Above those sit three that mean the same thing whichever command printed them,
because they come from the reporter every command is wrapped in.

-   `4`.
    A file it needed would not read,
    and it stopped there.
    The first line names the file and the failure,
    never the file's text.
    Re-run the pass to rewrite the file,
    or name a run directory that has it.
-   `5`.
    A fault in the command rather than in the run.
    The first line names the class,
    and stack frames follow.
    There is no message:
    a fault's message can carry text from whatever it
    choked on,
    and a run directory holds unlicensed corpus wording,
    so the reporter drops the message and keeps the frames.
    This one is a bug report.
-   `6`.
    The command declined in its own words,
    and the words are the report.
    A usage line,
    an unset key,
    a control that did not hold.
    Nothing broke and nothing was half-read.

So `6` means read the line,
`4` means fix the input,
`5` means file a bug.

1.  Confirm it is actually gone rather than merely quiet.

    ```sh
    running corpus-pass.mjs
    ```

    Expected:
    no output at all.

2.  Read the published tree back against the artifacts that produced it.

    ```sh
    TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" \
      mise run //package/module/translation-repair:verify-published
    ```

    This spends no quota and calls no model.
    Expected,
    on a run with nothing wrong:

    ```text
    verify-published: matched=<n> settledWithNoPage=0 pageWithNoArtifact=0 declined=<n>
    ```

    followed by one line per entry of the form
    `<id>: wordings=<n> silent=<n> chars=<n>=expected missing=0`,
    and a final line reading

    ```text
    verify-published: <n> of <n> pages carry every wording their artifact promised; <n> of those at the length it implies, 0 UNWEIGHED because the artifact predates the stored archive text
    ```

    A RUN DIRECTORY WITH NOTHING IN IT DOES NOT READ AS A PASS.
    It prints one line and exits `2`:

    ```text
    verify-published: NOTHING VERIFIED, the artifacts directory holds no settled artifact. No page was read and no artifact was compared, so this is not a clean run
    ```

    The other wording is `no artifacts directory under the run (<reason>)`,
    which is where a mistyped `TRANSLATION_REPAIR_RUNS_DIR` lands.
    Before `b6ea1cc51` both cases printed `matched=0` and exited `0`,
    so an empty run and a typo each read as a clean pass over zero entries.

    A RUN ALWAYS SHIPS (the owner,
    2026-09-27),
    so every finding line is printed and the exit is still `0`.
    Only a run that could not be read at all exits `2`.
    Read the lines,
    not the exit code.
    The next pass started in the runs directory repairs what it can before it settles anything:
    it rewrites from its artifact every page that is missing or disagrees,
    and removes every page standing for a declined entry
    (`REPUBLISHED`,
    `REPUBLISH LEFT` and `republish:` lines in the pass log).

    The finding lines,
    each meaning something different:

    -   `SETTLED AND NEVER PUBLISHED: <id>`.
        The worst one.
        A pass publishes before it writes the artifact precisely so that
        an artifact implies a page,
        and a resumed pass builds its skip set from the artifacts.
        So no pass settles this entry again,
        and the archive ships for it
        until the next pass started here writes its page from the artifact.

    -   `PUBLISHED AND NOT SETTLED: <id>`.
        A crash between the page write and the artifact write left a page no artifact records.
        It ships as it stands,
        with nothing to check it against,
        until a pass settles the entry again.

    -   `DECLINED AND PUBLISHED ANYWAY: <id>`.
        The archive's note says the page is the author's own English,
        so the archive must ship;
        the next pass started here removes the page.

    -   `READ BY ANOTHER BUILD: settled by <digest>, read by <digest>`,
        under an entry that disagrees.
        Every page agreed with the build that wrote it,
        and this build reads the artifact through its own typography,
        so the disagreement can be the reading that moved.
        On 2026-09-27 this was 77 of 214 stored pages,
        69 of them only by the class 181 and 147 fixes.
        A pass resumed here on this build (`TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT=yes`)
        rewrites the page to this reading.

    -   `WRONG LENGTH: page is <n> characters off`.
        The page is not as long as the archive plus every change the slices made,
        so text no slice decided on was lost or added.
        This exists because checking the wordings alone passed a real page
        with two hundred characters cut out of its middle.

    -   `MISSING slice <n>`.
        The page does not carry that slice's wording in order.

    A `chars=UNWEIGHED(artifact predates stored archive text)` column
    is not a pass.
    It means that entry could not be weighed at all.

    Then read the destination lines off the pass log,
    which spends nothing either:

    ```sh
    grep '^DESTINATIONS ' "${RUNDIR}.log"
    ```

    Expected:
    one line per settled entry,
    `DESTINATIONS <id> source=<n> page=<n> dropped=<n>`,
    counting the distinct web addresses the source page links to,
    the ones the published page carries,
    and the source's that the page lacks.
    `dropped=0` on every line is the clean reading.
    A non-zero `dropped` is a finding rather than a failure:
    the page is what both deciders approved and it shipped,
    and the addresses themselves are in the run log at `warn`,
    one line each under `entry <id>: page drops source destination`,
    never on stdout.
    A trailing `destinations-mdx-downgraded (source)` or `(page)` says the strict grammar refused that side
    and the plain-markdown parse was read instead;
    the count still stands.
    A checkout that predates `fd4f7546f` prints no such line,
    and a run made from it recorded nothing to read.

    Then read the defect lines the same way:

    ```sh
    grep '^DEFECTS ' "${RUNDIR}.log"
    ```

    Expected:
    no output on a clean pass.
    A line `DEFECTS <id> checks=<a>,<b>` names a page that shipped with those defects.
    `archive-original`,
    `contributor-names`,
    `destinations`,
    `front-matter` and `headings`
    are the publish-time content checks;
    `no-valid-wording` names slices where no wording passed the deterministic rule,
    so the archive's own wording stayed;
    `page-agreement` names a page that does not carry what its artifact says ships,
    which is a defect in page assembly,
    not in the text.
    Each defect's message is in the run log at `warn` under `publish: shipping with defect`,
    naming ids,
    counts and slice indices only.
    A checkout that predates 2026-09-27 refused such entries instead,
    so it prints no such line.

3.  Read what the providers were doing while it ran.

    ```sh
    mise run //package/module/translation-repair:meter-report -- "${RUNDIR}.log"
    ```

    Expected:
    per provider,
    a count of readings in each state,
    the fraction of answering readings that found budget,
    and the longest outage as a range rather than a number.
    An outage with no answering reading before or after it is reported open,
    because it may have begun before the record or may still be running.

    Every figure is availability WHEN WE WERE ASKING,
    which is not availability.

The three tools that follow
(the timing,
spend and ledger reports)
arrived together in `b6ea1cc51`.
If `mise run` reports no such task,
the checkout predates them,
and a run made from that checkout recorded none of what they read either.

4.  Read where the wall clock went.

    ```sh
    mise run //package/module/translation-repair:run-timing-report -- "${RUNDIR}.log"
    ```

    This spends no quota and calls no model.
    Name more than one log to read a resumed run as a single span.
    Expected,
    on a run whose rounds and calls were both recorded:

    ```text
    run-timing-report: 1 logs, 6 lines
    rounds                 2, 1.50min in total
      without quorum       0
      waiting after quorum 40.00s, 44.4% of round time
      voices never heard   1
    calls in flight        mean 1.05, peak 2
      busy against span    21.00s of calls across 20.00s of run
    ```

    `waiting after quorum` is the time rounds spent holding the door open for a straggler
    after enough voices had already answered to proceed.
    That is the quantity `STRAGGLER_GRACE_MS` trades against,
    so read it before changing the window.

    `without quorum` counts rounds that stopped once every ask settled
    with fewer voices than quorum needed.
    Their time and their unheard voices count in the other figures;
    they add nothing to `waiting after quorum`,
    since no quorum stood for them to wait after.

    `calls in flight` is ACHIEVED concurrency,
    not configured concurrency.
    A peak below the producer count means the pipeline never actually ran that wide,
    whatever it was configured to do.

    A log written before round lines and call durations were logged carries neither line,
    and the tool says so instead of reporting zero:

    ```text
    NO ROUND LINE. This log predates round lines and call durations, so how long each fan-out took and how much of that was spent waiting after quorum are both unrecorded. That is not the same as a run that never waited.
    NOTHING IN FLIGHT: no call in this log carried a duration, so nothing can be counted in flight, which is not the same as a run that made one call at a time.
    ```

    Timed calls that all took no time at one instant leave no span to count over either,
    and the `NOTHING IN FLIGHT` line says so in its own words.

    THE EXIT CODE IS `0` EITHER WAY.
    Check for `NO ROUND LINE` in the output rather than reading the exit code as a verdict.

    Read per-slice phase cost separately:

    ```sh
    mise run //package/module/translation-repair:slice-cost-report -- "${RUNDIR}.log"
    ```

    `SLICE-COST` covers repair,
    translate,
    and consolidation exits.
    It does not replace entry wall time:
    pairing,
    lane contest,
    persistence,
    and publication remain outside slice totals.
    Reconcile summed slices against `TALLY ms=` and name remainder.

5.  Read what the run cost.

    ```sh
    mise run //package/module/translation-repair:spend-report -- "${RUNDIR}.log"
    ```

    This spends no quota and calls no model.
    Expected,
    on a run that touched all three providers:

    ```text
    spend-report: 1 logs, 6 lines, 5 seats
    metered seats, priced at rates read 2026-08-26:
      gemma-4-26b-a4b-it: 0.05 credits (72.5%) over 1 calls, in 7168=0.02 out 4096=0.03
      minimax-m3: 0.02 credits (27.5%) over 1 calls, in 1000=0.01 out 500=0.01
    metered run total: 0.07 credits
    OpenRouter seats, billed in USD per token, each priced from the cost= its own lines carried:
      deepseek/deepseek-v4-pro-0813: 0.0701 USD (94.1%) over 8 calls, in 22643 out 13706
      minimax/minimax-m3: 0.0044 USD (5.9%) over 2 calls, in 3514 out 91
    OpenRouter run total: 0.0745 USD, never summed with this report's credits
    subscription seats, which bill no credits and are metered as a percentage of a weekly allowance on the METERS line:
      hf:zai-org/GLM-5.3-Flash: 1 calls, in 4096 out 2048
    ```

    Subscription seats are counted and never priced,
    because a weekly allowance is not a per-call rate and pricing it would invent a number.
    Their consumption shows up on the `METERS` line instead.
    OpenRouter seats are priced from the wire,
    the `cost=` field each `SPEND` line carries,
    and never from a table;
    a seat whose lines lacked the field is marked `a floor: N calls carried no cost`.
    Hypercredits and USD are two currencies and the report never adds them.

    `FLOOR, NOT A TOTAL` appears when any call reported no usage block:

    ```text
    FLOOR, NOT A TOTAL: 1 calls reported no usage block, so their tokens are in no figure of this report
    ```

    Read the total as a lower bound whenever that line is present.

    The price table carries the date it was read.
    A total priced against a stale table is arithmetic about rates that may no longer hold,
    so check the date before quoting the figure anywhere.

    A log written before `spend-line.ts` landed carries no `SPEND` line,
    and again the tool names the absence rather than reporting a free run,
    exiting `0` as it does so.

    On OpenRouter calls the `SPEND` line also names the upstream that served the call (`endpoint=`),
    and every stream progress line,
    cut ones included,
    ends with `served by "..."`.
    A model that keeps coming back empty or slow on that provider is attributed by two greps:

    ```sh
    rg 'SPEND provider=openrouter model=minimax/minimax-m3' "${RUNDIR}.log" \
      | rg --only-matching 'endpoint=\S+' | sort | uniq --count
    rg ': cut, .*served by' "${RUNDIR}.log" | rg --only-matching 'stream \S+:.*served by "[^"]+"'
    ```

    An upstream that fails after the gateway has already answered 200 shows up as a retry line naming
    the failure,
    not as a truncation:

    ```text
    transport failure: InStreamProviderError: stream carried a provider failure instead of a completion: code 504, type timeout, served by ModelRun
    ```

    Count those by endpoint the same way.
    Logs written before 2026-09-04 carry the same event as
    `MalformedCompletionError: ... stream ended without its [DONE] terminator; the reply was cut off`,
    attributable only through the stream progress line just before it (a body of a few hundred raw
    characters with `0 content chars`,
    "completed" after about ten seconds).

    An upstream measured broken goes into that model's `ignoredEndpoints` in `openrouter-catalog.ts`
    with the measurement beside it,
    as Parasail did for MiniMax M3 and OpenInference for DeepSeek V4 Flash
    on 2026-09-03.
    Before ignoring,
    count what would be left:
    an ignore that leaves one endpoint serving turns that endpoint's rate limit into a lost voice,
    since OpenRouter is the last provider in the order.
    Under zero data retention with a schema request
    the listing's `supported_parameters` decides who is left,
    not the endpoint count:
    MiniMax M3 has one
    such endpoint (ModelRun) once Parasail is ignored and CoreWeave sits on the account-level ignore list
    (measured 2026-09-04,
    `~/temp/agent/openrouter-minimax-endpoints-20260904.log`).

6.  Read who produced what,
    and what the judges said about it.

    ```sh
    TRANSLATION_REPAIR_RUNS_DIR="${RUNDIR}" \
      mise run //package/module/translation-repair:ledger-report
    ```

    This spends no quota and calls no model.
    Expected:

    ```text
    ledger-report: 2 contests under /path/to/run
    1 ballots named nothing, 0 named a candidate the slate did not have
      gemma-4-26b-a4b-it: 2 candidates, 1 chosen, 66.7% of 3 disinterested ballots, 0 self-votes
      hf:zai-org/GLM-5.3-Flash: 1 candidates, 0 chosen, 0.0% of 2 disinterested ballots, 0 self-votes
    ```

    `disinterested ballots` excludes the seat's own votes for its own candidate,
    which is why `self-votes` is reported beside the share rather than folded into it.
    A low share means rarely picked as best,
    which is not the same as wrong.

    DO NOT PASTE `--model` OUTPUT ANYWHERE.
    Passing `--model <id>` prints that seat's candidate text verbatim,
    which on a real run is corpus wording from an unlicensed archive,
    along with the judges' reasons quoting it.
    The summary without `--model` names only models and counts and is safe to share;
    the per-model view is not.

    THIS ONE EXITS `1` WHEN IT FINDS NOTHING,
    unlike the two tools before it:

    ```text
    NOTHING RECORDED. This run wrote no ledger, which is not the same as a run whose models wrote nothing: every run started before candidate-ledger.ts landed has none, and so does any run launched without TRANSLATION_REPAIR_RUNS_DIR set.
    ```

    The difference is deliberate.
    An empty ledger usually means the environment variable was never set,
    which is an operator mistake worth failing on,
    while a log with no `SPEND` or round lines is simply an older log
    and says nothing about the operator.

    A ledger file that is malformed rather than absent is named,
    skipped,
    and counted,
    and the exit code becomes `2`:

    ```text
      UNREADABLE 000001.json: could not read 000001.json as JSON (SyntaxError)
      1 of 1 ledger files could not be read. Every figure here counts only the files that could, so a seat that wrote into an unreadable contest is undercounted, and so is every judge who weighed it. Re-run the pass to rewrite them, or read the standing as a floor.
    ```

    A byte offset joins the class where the parser stated one,
    as `(SyntaxError at byte 42)`.
    A file truncated at the end states none,
    which is the `UNREADABLE 000001.json` example's case.

    Read a `2` as a floor rather than a standing.
    The refusal names the class that refused and where it stopped,
    never the file's text,
    because a ledger holds corpus wording and a parse message quotes what it disagrees about.
    If every file refuses,
    the report prints `NOTHING COUNTED` and still exits `2`,
    which is a run whose record was lost rather than a run that recorded nothing.

    A third code exists for one operator slip.
    `--model` with nothing after it exits `3` rather than falling through to the summary,
    because a summary looks exactly like a successful answer to whatever reads the code.

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

Expected:
a later `running corpus-pass.mjs` prints nothing.

A stopped run is resumable and is not wasted.
Run root `prompt-payloads/` contains raw model payloads keyed by canonical prompt digest.
It may contain corpus/model wording:
never quote,
commit,
or share it.
Across interrupted invocations,
these payloads reconstruct correction state without provider resend.
Corrupted payload refuses before network rather than being ignored.
Write failure or corruption retains failed claim for rest of invocation;
entry cannot recover until operator repairs/removes disposable record and relaunches.
This is fail-closed handling,
not quality verdict.

Every stage caches,
so a relaunch into the same `TRANSLATION_REPAIR_RUNS_DIR`
republishes what was already bought rather than re-buying it,
provided no source file changed in between.

When a source file DID change,
the rule is always kill and relaunch:
stop the pass by pid as shown,
build,
and relaunch the entry into a fresh runs dir on the new build.
The old runs dir holds what the old digest bought and is not resumed;
a page finished on a superseded build is not readiness evidence,
whatever it cost.

If a resume supervisor is driving the pass,
stopping the run and stopping the supervisor are two different operations.

-   To stop the supervisor while a pass is running,
    kill it by pid.
    Killing the supervisor does not kill the pass,
    because the pass is a child that outlives it.
    That is what makes swapping supervisors mid-run safe.

-   To stop the run,
    kill the pass by pid.
    The supervisor then sees the field clear,
    and a stop file placed at that point prevents the next launch:

    ```sh
    touch ~/temp/agent/resume-supervisor.stop
    ```

    The stop file is checked on every poll of the supervisor's wait loop,
    so it takes effect within a minute while the supervisor is waiting.
    IT DOES NOTHING WHILE A PASS IS RUNNING.
    The supervisor spends that time awaiting its child and reaches no stop check
    until the pass exits,
    so a stop file placed during a run
    sits unread for as long as the run lasts,
    which can be twelve hours.

To discard a run entirely,
remove its directory and its log.
Do this only for a throwaway run.

```sh
rm --recursive --force -- "${RUNDIR}" "${RUNDIR}.log"
```

Expected:
no output.
Nothing in the repository is touched by a pass,
so there is no working tree state to restore.
