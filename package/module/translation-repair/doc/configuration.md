# Configuration

Part of [the package README](../README.md).

Every knob is an environment variable,
and none of them had been written down before 2026-08-24.
Values are read once per invocation.

An EXPORTED-BUT-EMPTY variable counts as unset throughout,
which is deliberate rather than incidental:
an empty export is an ordinary shell accident,
and reading one as an instruction has cost this package a defect before.

## Credentials

-   `TRANSLATION_REPAIR_SYNTHETIC_API_KEY`.
    Bearer token for the first provider.
    A run that reaches a model call without it throws.

-   `TRANSLATION_REPAIR_EXA_API_KEY`.
    Key for the Exa search endpoint,
    which the pass asks once per work the original names in 《…》 marks for its official English title
    (the owner's rule of 2026-09-02,
    `doc/decision/translation-repair-work-titles-established-vocabulary.md`).
    The top results reach every sheet as `web lookup` lines in the identity context,
    beside the `note` and `editor comment` lines carrying both pages' footnotes and editors' comments,
    and the house policy says what each kind licenses.
    OPTIONAL:
    unset means one warning per entry naming how many titles went unlooked-up,
    and nothing else changes.
    Every lookup is cached durably under `TRANSLATION_REPAIR_LOOKUP_CACHE_DIR`,
    else `$XDG_CACHE_HOME/translation-repair/lookup`,
    else `~/.cache/translation-repair/lookup`,
    keyed by the query's digest,
    so a title is bought once across runs and a resumed run keeps its preparation identity.
    Measured 2026-09-02:
    about 1.5 s and $0.007 a query;
    the pinned corpus's 118 spans cost about a dollar once.
    The same key buys the pages the original cites through the Exa contents endpoint
    (class thirty-five,
    2026-09-16),
    cached semi-permanently under the `reference` subdirectory of that cache,
    one JSON record per url named by the url's digest,
    a failure cached too so a dead link is not hit on every pass;
    delete a record's file to refresh that page.
    59 of the 92 pinned originals link somewhere,
    116 links in all,
    profiles and the corpus's own pages excluded before any is bought.
    Unset,
    one warning per citing entry says how many references went unread.

-   `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`.
    Bearer token for the second provider,
    Charm Hyper.
    OPTIONAL AND LOUD:
    a run starts on whichever provider keys are present,
    an absent provider is marked dry before routing so its seats are unavailable,
    and every key absent is a stated refusal naming the variables (exit 6).
    A calibration once settled clean with half its roster dark (`#235`) because a missing key was silent;
    it is not silent now,
    and the seat lines at the end of every command name what was dark.
    Note the `CHARM` in the middle;
    a name missing it is read by nothing and reported by nothing.
    The owner will not top this balance up again (2026-09-03),
    so it serves until it runs dry.

-   `TRANSLATION_REPAIR_OPENROUTER_API_KEY`.
    Bearer token for the third provider,
    OpenRouter,
    the paid per-token fallback the owner chose on
    2026-09-03 (`doc/decision/translation-repair-openrouter-fallback.md`).
    OPTIONAL AND LOUD like the second.
    Every request carries `provider: { zdr: true, require_parameters: true, ignore: [...] }`,
    so only zero-data-retention endpoints that support `response_format` may serve a passage,
    and the catalog row's `ignoredEndpoints` keeps a measured-broken upstream off the wire
    (Parasail for MiniMax M3 since 2026-09-03:
    it answered into the reasoning channel and left content empty;
    ModelRun for MiniMax M3 since 2026-09-04:
    it timed out 119 of 300 streams in-stream,
    and CoreWeave answers the same schema request 4 of 4;
    OpenInference,
    Parasail and Reka for DeepSeek V4 Flash,
    Reka and Io Net for Qwen3.8-27B,
    and Reka for GLM-5.3 since 2026-09-04,
    each cutting a quarter or more of at least twenty streams at the straggler grace in a day's runs).
    Slugs are the ones `GET /api/v1/providers` lists,
    not display names lower-cased:
    `open-inference`,
    not `openinference`,
    which is how the 2026-09-03 ignore stayed off the wire for a day.
    Credits are read from `GET /api/v1/credits` (purchased less used,
    in USD) and printed on the `METERS` line as `openrouterUsd=`;
    every call's cost is read off the final stream chunk onto its `SPEND` line as `cost=`,
    so a run's OpenRouter bill is summed from the wire rather than from a price table.
    The upstream that served each call is read off the same chunks:
    `endpoint=` on the `SPEND` line (percent-encoded) and `served by "..."` on the stream progress line,
    cut streams included,
    so a slow or broken upstream is named by a grep of the run log.
    An upstream that fails after the gateway has answered 200 writes one chunk carrying an `error` object
    and closes without `[DONE]`;
    the client reads that chunk first and retries under `InStreamProviderError`,
    whose message names the code,
    the gateway's error type and the endpoint (`openrouter-stream-error.ts`;
    ModelRun's 504 timeouts on MiniMax M3,
    2026-09-04,
    were the case).

-   `TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY`.
    Bearer token for the fourth provider,
    Amazon Bedrock,
    the owner's 200 USD of prepaid credits of 2026-09-07,
    expiring early next year and never to be topped up,
    to be spent freely until then.
    OPTIONAL AND LOUD like the second and third.
    Under the account's zero-data-retention mode the served models are the three Gemma 4 sizes and gpt-oss-120b,
    on the `bedrock-mantle` host in us-east-1 over raw fetch and chat completions:
    the Gemma sizes under `/openai/v1` ending on `[DONE]`,
    gpt-oss-120b under `/v1` ending on its usage chunk
    (`bedrock-catalog.ts` records the probes).
    The provider exposes no balance to a bearer key,
    so every priced call appends one line to a durable ledger and the `METERS` line's `bedrockUsd=`
    is the credit less that file's sum;
    `SPEND` lines carry `cost=` computed from the usage and the catalog's prices.

-   `TRANSLATION_REPAIR_BEDROCK_LEDGER`.
    Where that ledger lives;
    `~/.local/state/translation-repair/bedrock-spend.jsonl` under the running user's home when unset.
    Append-only JSON lines,
    one per priced call;
    a line that will not read stops the meter with the line's number rather than reading the money as unspent.

-   `TRANSLATION_REPAIR_BEDROCK_CREDIT_USD`.
    The credit line the ledger is read against;
    200 when unset,
    the owner's figure.
    Set it when the console reads a different balance;
    anything that is not a non-negative number is refused at once.

Every key lives in the sops-encrypted,
gitignored `.env.local.json` at the repository root,
which `mise run` decrypts into the task's environment.
A worktree created with `git worktree add` starts without that file;
copy the encrypted file into the worktree root (it stays encrypted at rest) or launch from the main worktree.
Either way,
launch under `mise run`:
a bare `node dist/...` launch has no key,
and since `#235` it fails at once with the refusal instead of running half-dark.

Every command ends by printing one `SEAT <model> asked=N usable=N unusable=N threw=N` line per seat to stderr,
and a `SEATS DARK:` line naming every seat that was asked and never once produced a usable answer.
A dark seat is a provider that cannot serve it,
a key that was never injected,
or a model that answers nothing readable;
the run log names which.
Do not read a run with a dark seat as a comparison of the roster.

## Where a run writes

-   `TRANSLATION_REPAIR_RUNS_DIR`.
    Root for artifacts,
    the published tree,
    slice caches,
    and the attempt map.
    Defaults to `node_modules/.monochromatic/translation-repair-runs` under the worktree root.
    Point it at a throwaway directory for any run whose output should not join a pool later.

## Bounding one run

-   `TRANSLATION_REPAIR_RUN_SPEND_CEILING_USD`.
    Overrides the per-run spend ceiling,
    a non-negative number of USD,
    built in at 20 (`doc/decision/translation-repair-run-spend-ceiling.md`,
    the owner's decision of 2026-09-04).
    Every OpenRouter call's reported `cost=` feeds a process-wide meter as its `SPEND` line is written,
    and before each entry the scheduler stops starting new ones once the run's OpenRouter spend is at or
    past the ceiling,
    printing `SPEND CEILING reached`;
    entries already running finish.
    Unset and blank are the built-in;
    an unreadable or negative value is REFUSED at launch for the same reason the entry ceiling's is;
    zero is allowed and means start nothing,
    which is how the guard is shown to fire on a live run at no cost.
    A run that overrides logs `SPEND CEILING OVERRIDDEN`.
-   `TRANSLATION_REPAIR_HARD_CAP_MINUTES`.
    Overrides the per-entry ceiling,
    a positive number of minutes.
    A value that is not one is REFUSED rather than replaced by the default,
    including `30m`,
    which `parseFloat` would have read as 30:
    a ceiling is what stops a runaway entry,
    so an operator who set it must not be left believing a run is bounded some way it is not.
    A run that overrides logs `CAP OVERRIDDEN` above its work.

    THERE IS A FLOOR,
    and it is one model exchange.
    A ceiling at or below `RUN_PER_CALL_TIMEOUT_MS`,
    currently 360_000,
    cuts every attempt before any exchange can return,
    so nothing caches,
    every attempt reports no progress,
    and the queue drops the entry as stalled after its second try.
    A run in that state logs `CAP TOO TIGHT` naming both numbers.
    It is warned rather than refused,
    because cutting mid-exchange is exactly what a test of the stall path wants.

The cap ends an ATTEMPT rather than an entry.
An entry the cap cut goes to the back of the queue and is attempted again inside the same invocation,
against the same frozen pipeline digest,
so an entry too large for one attempt no longer needs a relaunch per attempt.

A re-attempt is EARNED rather than automatic.
The pass counts the entry's cache records before and after each attempt,
and re-queues only when that count grew.
An attempt that bought nothing logs `STALLED` and the entry is dropped for this invocation,
because no progress guarantee holds:
an abort can land before the first persistence,
and the slices a lane deliberately leaves uncached produce no record however long they took.
Without the earned rule a stuck entry would spend the whole soft budget.

A re-attempt logs `REATTEMPT <id> queued`,
naming what the attempt bought.

## Choosing what a run attempts

These two are command-line flags rather than variables,
passed after `--`:

-   `--only Id1,Id2`.
    Restricts the invocation to the named entries and bypasses the ordering.
    Run it into a throwaway `TRANSLATION_REPAIR_RUNS_DIR`,
    so a hand-picked entry never joins a pool that later draws treat as natural accumulation.
    A flag with no value,
    or one whose value parses to no id at all,
    is REFUSED:
    a flag that parsed to nothing would run the WHOLE corpus,
    which is the opposite of what was asked and expensive to discover afterwards.
    A restricted run logs `ONLY` and the ids it took.

-   `--plan`.
    Reads the corpus,
    builds the pending list,
    constructs the client,
    prints `PLAN ok` with the tip,
    the pipeline digest and the first few pending ids,
    and returns without calling a model.
    Use it to check a run's setup,
    selection and credentials for no quota.
    Measured at 1.88 seconds with no stream opened.

## A source change while a pass is in flight means kill and relaunch

Every pass and probe task declares `depends = ["build"]`,
so invoking one rewrites `dist/final/node` underneath any pass already running from the same worktree.
The running process survives that
(the bundle has no dynamic imports,
verified rather than assumed:
[`translation-repair-overlap-dial.md`](../../../../doc/handover/translation-repair-overlap-dial.md),
"Do not land a driver into a live pass launch"),
but the pass is now on a superseded build:
it computed its pipeline digest once at startup and stamps that digest into every artifact it writes,
so its artifacts name files that are no longer on disk,
and its page cannot say whether the change that prompted the rebuild worked.

The rule is ALWAYS KILL AND RELAUNCH,
the owner's on 2026-09-06.
When source changes while a pass is running,
kill the pass by pid,
build,
and relaunch the same entry into a fresh `TRANSLATION_REPAIR_RUNS_DIR` on the new build.
Never let a pass finish on a build a commit has superseded,
and never read its page as readiness evidence.
The calls the killed run spent are the price of a fix landing while it ran;
a relaunch into the old runs dir would republish what the old digest bought,
which is why the runs dir is fresh.
When the fix is already known before the launch,
fix first and launch once:
a launch made ahead of a change that will be built within the hour buys nothing.

A rebuild with no source change is byte-identical and harmless,
which is exactly why this is easy to get away with and worth stating anyway:
the digest is the only thing that reveals it,
and it reveals it after the fact.
Same immutable build may back concurrent passes when no rebuild follows.
Source-distinct pass requires separate throwaway worktree built before that process launches.

Concurrent passes require separate run roots,
logs,
and publication roots.
They still share provider capacity,
so elapsed times are operational results rather than matched performance comparison.
Record each pipeline digest and corpus commit separately.

Production `corpus-pass` currently has no pull-request input flag.
Pull-request 386 run uses uncommitted throwaway fork that changes only corpus commit
and exposes corpus clone path through `TRANSLATION_REPAIR_CORPUS_DIR`.
For another pull request,
prepare equivalent source-distinct worktree,
use exact commit in isolated corpus clone or minimal Git fixture,
run `--plan --only <entry>` first,
and retain provenance mapping fixture bytes to pull-request head.
Supply credentials through trusted worktree environment;
copying secret values into command,
log,
or provenance file is forbidden.

## Pooling artifacts across builds

Each settled artifact records the digest of the pipeline that produced it,
and readers refuse to mix generations unless told to.

-   `TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT`.
    Set to `yes` to resume an accumulation under a build different from the one that filled it.
    The value is spelled out so a stray `0` cannot silently disable the guard.

-   `TRANSLATION_REPAIR_REQUIRED_COMMIT`.
    Restricts a pool to entries whose recorded pipeline contains that commit.

-   `TRANSLATION_REPAIR_POOL_ALL`.
    Set to `yes` to take every generation and say so above the resulting number.
    Setting this together with `TRANSLATION_REPAIR_REQUIRED_COMMIT` throws:
    that asks for a filtered pool and an unfiltered one at once,
    and preferring either would record a policy nobody chose.

## Schema generations, which the drift opt-in does not cover

The pass writes SCHEMA GENERATION 4,
and refuses to resume into a directory holding another one.
That refusal is separate from the build guard above and is not waved past by
`TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT`:
drift is an opinion about which BUILD filled a pool,
and its remedy works because every file still answers the same questions.
A file of another schema generation cannot answer them at all.

Three generations record the same two-lane shape and differ only in how four keys are spelled.
Generation 4 spells all four the current way:

-   `changedSliceIndices`,
    which generation 2 spelled `shippedChunkIndices`.
-   `withdrawnSliceIndices`,
    which generation 2 spelled `withdrawnChunkIndices`.
-   `sliceCritics`,
    which generation 2 spelled `chunkCritics`.
-   `sliceIndex`,
    which generations 2 AND 3 spelled `chunkIndex`.

Generation 3 is therefore a MIXTURE:
the change-set arrays already carry their current names there,
and the index does not.
That is why the reader holds a table rather than a flag.
A reader holding a flag reads every generation 3 artifact's index as ABSENT.

All three generations are READ.
The reader takes the spelling from the version the file records,
so nothing is ever tried under two spellings,
and a stamp over another generation's keys is refused rather than read as a file missing the keys it names.

Meeting the refusal on a resume,
the ways forward are the ones the message lists:
start a fresh directory with `TRANSLATION_REPAIR_RUNS_DIR`,
restore the code those entries were settled under and resume there,
or move the older artifacts to an archive directory and pay for their re-run.
Deleting them is the one thing to avoid:
it costs the same re-run and destroys a sound result of the generation that wrote it.
