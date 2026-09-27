# Configuration

Part of [the package README](../README.md).

Every setting the package reads from the environment is listed here,
beside the two command-line flags in `Choosing what a run attempts`;
none of them had been written down before 2026-08-24.
Most values are read once per invocation;
an entry says so where its value is read per entry or per round instead.
Git's repository-routing variables are not settings:
every corpus `git` call drops them rather than reading them (`src/corpus-git-context.ts`).

An exported-but-empty variable counts as unset,
which is deliberate rather than incidental:
an empty export is an ordinary shell accident,
and reading one as an instruction has cost this package a defect before.
The two variables under `Probe tools` are the exception:
each uses an empty export as given.

## Credentials

-   `TRANSLATION_REPAIR_SYNTHETIC_API_KEY`.
    Bearer token for the first provider,
    Synthetic.
    Optional like every other provider key:
    a run starts on whichever provider keys are present,
    and only a run with no provider key at all is refused,
    the stated refusal (exit 6) described under `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`
    (`configureProviders` in `src/corpus-run/run-providers.ts`).

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
    Optional and loud like the second.
    Every request carries `provider: { zdr: true, require_parameters: true, sort: 'price', ignore: [...] }`
    (`OPENROUTER_PROVIDER_PREFERENCES` and `openRouterProviderPreferencesFor` in `src/openrouter-catalog.ts`),
    so only zero-data-retention endpoints that support `response_format` may serve a passage,
    and among those the cheapest serves (`sort: 'price'` since 2026-09-09, the owner's instruction to stop bleeding).
    The card's `ignoredEndpoints` (`src/model-cards.ts`) keeps a measured-broken or measured-slow upstream off the wire:
    Parasail and ModelRun for `minimax-m3`
    (Parasail since 2026-09-03, when it answered into the reasoning channel and left content empty;
    ModelRun since 2026-09-04, when it timed out 119 of 300 streams in-stream
    while CoreWeave answered the same schema request 4 of 4),
    and DeepInfra, Wafer, OpenInference, DekaLLM and Sail Research for `deepseek-v4.1-flash`
    (the first two after XingZ607 on 2026-09-18, the last three after XingZ624 to XingZ626 on 2026-09-23).
    A card whose `preferredEndpoints` is not empty also sends `order`,
    which names those endpoints ahead of the price sort and leaves `allow_fallbacks` unset:
    Wafer for `hf:zai-org/GLM-5.3-Flash` and Morph for `deepseek-v4.1-flash`, both since 2026-09-23,
    because the price sort had landed those seats on endpoints that reason at length by default.
    The ignores once kept for DeepSeek V4 Flash, `hf:Qwen/Qwen3.8-27B` and `glm-5.3` left with their OpenRouter rows:
    the last two have been off the OpenRouter catalog since 2026-09-09 (`openrouter-dropped` on their cards),
    and DeepSeek V4 Flash left the roster on 2026-09-16.
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
    Optional and loud like the second and third.
    Under the account's zero-data-retention mode the served models are the three Gemma 4 sizes
    and `openai.gpt-oss-120b`,
    on the `bedrock-mantle` host in us-east-1 over raw fetch and chat completions:
    the Gemma sizes under `/openai/v1` ending on `[DONE]`,
    `openai.gpt-oss-120b` under `/v1` ending on its usage chunk
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

    There is a floor,
    and it is one model exchange.
    A ceiling at or below `RUN_PER_CALL_TIMEOUT_MS`,
    currently 360_000,
    cuts every attempt before any exchange can return,
    so nothing caches,
    the attempt reports no progress,
    and the queue drops the entry as stalled after its first try
    (`readAttemptOutcome` in `src/corpus-run/entry-reattempt.ts`).
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

## Pacing a run

These move how much a run keeps in flight and how long a round waits,
each for one launch and without a rebuild.
The decisions behind the built-in values,
and how the editor calibration differs from the pass,
are in [Deciding who fills a seat](seats-and-calibration.md),
section `Historical writer and editor runners`.

-   `TRANSLATION_REPAIR_SLICE_OVERLAP`.
    How many slices a driver keeps in flight at once.
    The corpus pass defaults to 4 (`PASS_OVERLAP` in `src/corpus-run/pass-overlap.ts`,
    `doc/decision/translation-repair-pass-overlap.md`, 2026-09-06),
    and so does the editor calibration (`CALIBRATION_OVERLAP` in `src/corpus-run/slice-overlap.ts`);
    `1` reproduces the sequential driver.
    The pass reads it once per entry and prints `OVERLAP <id> value=N source=...`,
    where the source is `fallback` or the variable's name.
    Anything but a canonical decimal whole number of at least 1 is refused.

-   `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS`.
    How long a round keeps waiting on stragglers once quorum stands,
    in milliseconds.
    Built in at 120000 (`STRAGGLER_GRACE_MS` in `src/stage-round.ts`);
    the editor calibration adopts 300000 when the variable is unset
    (`CALIBRATION_STRAGGLER_GRACE_MS` in `src/grace-override.ts`).
    Every round reads it when it gathers,
    and a pass whose window differs from the built-in prints `STRAGGLER GRACE OVERRIDDEN` at launch.
    Anything but a whole number of milliseconds from 1 to 2147483647,
    the longest delay a timer holds,
    is refused.

-   `TRANSLATION_REPAIR_WRITER_GRACE_MS`.
    The same window for the writer rounds alone
    (editor, refiner, translate and consolidation producers),
    since a cut writer voice is a whole candidate lost.
    Built in at 180000 (`WRITER_GRACE_MS` in `src/writer-grace-override.ts`,
    the owner's decision of 2026-09-06 in `doc/decision/translation-repair-straggler-grace.md`);
    when it is unset and the round window is longer,
    the writers follow the round window instead.
    Every writer round reads it when it gathers,
    and a launch prints `WRITER GRACE built in` or `WRITER GRACE OVERRIDDEN`
    unless the writers follow the round window.
    It is refused by the same rule as the round window.

-   `TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR`.
    How many Hyper requests may start in any rolling hour,
    retries and credit reads included;
    the rest queue in arrival order instead of being refused with HTTP 429.
    Defaults to 1,000,
    the account's limit as the owner stated it (`HYPER_REQUESTS_PER_HOUR` in `src/request-pace.ts`).
    It is read once, when the Hyper client is built.
    Unlike every other dial here,
    a value that is not a positive number is not refused:
    it silently leaves the default.

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

## Probe tools

Two probe tasks read a variable of their own,
without the package prefix:

-   `DAMAGE_SAMPLE_SEED`.
    Seed for the `damage-sample` draw of shipped regions,
    `damage-round-one` when unset (`src/corpus-run/damage-sample.ts`);
    set a new one to draw a fresh sample for a later round.

-   `VERIFY_SHEET_BASENAME`.
    Which graded sheet `score-verify` joins to its manifest,
    read as `<basename>-sheet.md` under the runs directory;
    `probe-verify` when unset (`src/corpus-run/score-verify.ts`).

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

## Which corpus a run reads

Every corpus read resolves through one pin,
a clone directory and a commit (`RUN_CORPUS_PIN` in `src/corpus-run/run-config.ts`).
Either half can be overridden without editing source,
which is what a fixture run against an unmerged corpus pull request needs.
Both are read once,
when `src/corpus-run/run-config.ts` loads,
by `readCorpusPinSetting` in `src/corpus-run/corpus-pin-override.ts`.
Unset and blank both mean the built-in half;
anything else that is not valid is refused as a stated refusal rather than replaced by the built-in,
because a run against the wrong corpus would record its conclusions as the pinned corpus's.

-   `TRANSLATION_REPAIR_CORPUS_CLONE_DIR`.
    Absolute path of the corpus Git clone every read runs `git` in;
    the clone must hold the pinned commit.
    Defaults to `one-among-us/data` under the running user's home.
    A relative path is refused.

-   `TRANSLATION_REPAIR_CORPUS_COMMIT`.
    Commit every read resolves against,
    written as one full 40-character lowercase hexadecimal name.
    Defaults to `CORPUS_COMMIT_SHA` in `src/corpus-source.ts`,
    the milestone-one benchmark pin.
    An abbreviated name is refused,
    since clones can resolve an abbreviation differently.

A settled artifact records the commit it read as `corpusSha` (`src/corpus-run/pass-entry-artifact.ts`),
so an overridden run's artifacts name the commit they came from.
No launch line prints which half came from the environment,
so record both values with the run's provenance.

Production `corpus-pass` has no pull-request flag;
these two variables replace the uncommitted source fork the 2026-08-29 pull-request runs needed.
For a corpus pull request,
point `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` at an isolated corpus clone or minimal Git fixture
holding the exact head commit,
set `TRANSLATION_REPAIR_CORPUS_COMMIT` to that commit,
write into a throwaway `TRANSLATION_REPAIR_RUNS_DIR`,
run `--plan --only <entry>` first,
and retain provenance mapping the fixture bytes to the pull-request head.
Supply credentials through the trusted worktree environment;
copying secret values into a command,
a log,
or a provenance file is forbidden.

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

The pass writes schema generation 14
(`ARTIFACT_SCHEMA_VERSION_V14`, `src/corpus-run/artifact-two-lane-build.ts`),
and refuses to resume into a directory holding another one (`src/corpus-run/pass-schema-guard.ts`).
That refusal is separate from the build guard in `Pooling artifacts across builds`
and is not waved past by `TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT`:
drift is an opinion about which build filled a pool,
and its remedy works because every file still answers the same questions.
A file of another schema generation cannot answer them at all.

Generation 1 recorded one lane at the top level.
Generations 2 to 4 record the same two-lane shape and differ only in how four keys are spelled,
and generations 5 to 14 keep generation 4's spelling while each changes what the file records
(the version notes in `src/artifact-schema-version.ts` and `src/corpus-run/artifact-two-lane-contract.ts`).
Generations 4 to 14 spell all four keys the current way:

-   `changedSliceIndices`,
    which generations 1 and 2 spelled `shippedChunkIndices`.
-   `withdrawnSliceIndices`,
    which generations 1 and 2 spelled `withdrawnChunkIndices`.
-   `sliceCritics`,
    which generations 1 and 2 spelled `chunkCritics`.
-   `sliceIndex`,
    which generations 1 to 3 spelled `chunkIndex`.

Generation 3 is therefore a mixture:
the change-set arrays already carry their current names there,
and the index does not.
That is why the reader holds a table rather than a flag (`src/artifact-key-vocabulary.ts`).
A reader holding a flag would read every generation 3 artifact's index as absent.

The schema reader knows every generation from 1 to 14
(`KNOWN_ARTIFACT_SCHEMA_VERSIONS` in `src/artifact-schema-version.ts`),
and the key table has a spelling for each;
a reader that needs a shape a generation lacks refuses that generation by name.
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
