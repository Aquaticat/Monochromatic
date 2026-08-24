# Translation repair: two providers, and the quota reader that was never wired

Decided by the owner on 2026-08-24 across four rounds of questions.
Supersedes the single-provider assumption throughout `package/module/translation-repair`.
Reverses part of `#136` and changes the premise of `#187` and `#188`.

## Why

A corpus pass exhausted Synthetic's weekly credit and 866 of 875 lost voices were
`HTTP 429: You've exceeded your subscription rate limits`.
The owner's assessment:

> The earlier quota running out is self-inflicted.
> I'm surprised and disappointed you didn't build the machinery to gracefully detect and deal with quota.
> The info is available via api on both providers.

That is correct, and the situation is worse than it sounds.
`src/synthetic-quota.ts` already types `GET /v2/quotas`, shape-verified against a live call on 2026-07-16,
modelling exactly the two limits that matter.
It sits on the `chat-contract.ts` interface and is implemented in `synthetic-client.ts`.
Nothing calls it except a test stub named `unusedQuotas`.
The field that predicts this failure, `weekly.percentRemaining`, has been parsed and discarded for five weeks.

## Providers

Synthetic stays the primary.
Charm Hyper joins as the second, at `https://hyper.charm.land/v1`,
keyed by `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`.
Hyper is zero data retention, which the owner confirmed, so corpus passages may cross it.

### Transport

Hyper's OpenAI Chat Completions endpoint is measured NON-VIABLE for schema'd stages.
A deliberately invalid `response_format: {type: "not_a_real_mode_xyz"}` returns 200,
an unknown top-level field returns 200,
and every mode returns markdown-fenced JSON with invented keys.

Hyper's Anthropic Messages endpoint with forced tool-use IS viable.
Measured over 20 streaming attempts per model on 2026-08-24, all 8 allowlisted models conform.
Seven return 20 of 20 under `tool_choice: {type: "tool"}`.
`qwen3.8-max` REFUSES that shape with `HTTP 400 invalid_request_error` regardless of streaming,
system prompt, or `max_tokens`, and returns 20 of 20 under `tool_choice: {type: "auto"}` instead.
An earlier reading that `kimi-k3` honoured the forced tool on only 1 of 3 attempts is RETRACTED:
it measures 20 of 20.

Anthropic SSE events are NORMALIZED into the event shape the existing guards already consume,
rather than reimplemented natively.
The guards in question are `#118` partial-text retention, `#119` and `#120` runaway detection,
`#121` straggler and idle windows, `#156` answer volume, and `#158` the thinking-channel scanner.
Every one of their thresholds came from measurement,
and `#121` re-derived its windows after finding the median premise wrong by a factor of eighty.
A second copy would be unmeasured guesswork, and drift between the two would stay invisible until it cost a run.

Streaming stays ON.

### Reasoning effort

Six of the eight allowlisted Hyper models expose `reasoning.effort_levels`.
The pipeline requests NONE of them and takes each model's own default.
Note that `qwen3.8-max` emits native `thinking` content blocks with `thinking_delta` events,
so on this transport the reasoning channel is TYPED rather than sniffed out of text,
and `#158`'s spelling blindness cannot recur through it.
The owner's reasoning:

> Both providers aren't multi-billion enterprises whose only job is to serve models.
> We do whatever we can to minimize the impact if they didn't implement something in the api.

## Routing

Owner's policy, to be driven by the quota readers:

- Send everything to Synthetic until its per-model concurrent-request limit is reached.
- Overflow to Hyper, which has no per-model concurrency limit.
- Synthetic out of quota on EITHER the 5-hour limit or the weekly limit sends work to Hyper.
- Both providers dry throws an error saying so, ending the run.

Synthetic's per-model concurrency is 1 in production.
`createSyntheticClient` defaults `perModelConcurrency` to 1 in `synthetic-client.ts`,
and `run-config.ts` constructs the client without overriding it.
The provider serves one request per model per subscribed pack and queues the excess server-side.
So the overflow rule is concrete: one in-flight call per model on Synthetic,
and every concurrent call beyond that for the same model goes to Hyper.

### Quota sources

Synthetic `GET /v2/quotas` gives `fiveHour {remaining, max, limited, nextTickAt}`
regenerating 5% per 15 minutes,
and `weekly {percentRemaining, nextRegenAt}` regenerating 2% per roughly 3.4 hours.
Both are already parsed by `src/synthetic-quota.ts`,
and a live read on 2026-08-24 confirms the wire shape has not drifted since July.

The live body also carries fields the typed model does not expose:
`weeklyTokenLimit.remainingCredits` and `maxCredits` as dollar strings,
`weeklyTokenLimit.nextRegenCredits`,
`rollingFiveHourLimit.tickPercent`,
and a `subscription {limit, requests, renewsAt}` block.
Actual dollars remaining is a better pacing signal than a percentage and should be modelled.

Hyper `GET /v1/credits` gives `{"balance": N}`, measured at 249 on 2026-08-24.
The balance refreshes every 24 hours at 02:53, so it is a daily budget and needs no spend cap.

### Non-conformant answers

A model served by both providers that returns a non-conformant answer is re-asked on the OTHER provider.
A model served by only one provider falls back to the existing `#88` invalid-candidate repair path,
which already sends an unusable slice back to its author.

## Roster

`hf:zai-org/GLM-4.7-Flash` is BLOCKLISTED on Synthetic by owner instruction.
It has no Hyper counterpart, so it leaves the pipeline entirely.
This reverses `#136`, which measured that it earned its seat.
It currently sits in `editorModelIds` and `refinerModelIds`, both of which lose a member.

Allowlisted on Hyper by owner instruction, all 8 confirmed present in the catalog:
`qwen3.8-max`, `minimax-m3`, `kimi-k3`, `gpt-oss-120b`, `gemma-4-26b-a4b-it`,
`deepseek-v4-pro-0813`, `deepseek-v4-flash-0731`, `glm-5.2`.

The resulting 10 distinct model identities:

- served by both: `GLM-5.2`, `Kimi-K3`, `gpt-oss-120b`
- Synthetic only: `Qwen3.8-27B`, `NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`
- Hyper only: `qwen3.8-max`, `minimax-m3`, `gemma-4-26b-a4b-it`, `deepseek-v4-pro-0813`, `deepseek-v4-flash-0731`

Provider is NOT part of panelist identity.
`glm-5.2` reached through Hyper is the same panelist as `hf:zai-org/GLM-5.2` reached through Synthetic,
for the `#91` and `#187` self-certification weighting and for the cache key.
Provider IS recorded per call, for diagnosis.

### An allowlisted model that cannot conform

Every one of the 8 gets its forced-tool-use conformance measured before it is seated.
One that measures badly is DROPPED and reported to the owner with its rate,
rather than seated to produce lost voices at full call cost.
As measured, NONE are dropped: all 8 seat.

The system prompt must carry the FULL TOOL SCHEMA, by owner instruction:

> Some model/provider pairs can behave badly w/o a detailed system prompt,
> including but not limited to giving wrong tool call formats.
> Please make sure to put even the full tool schema into system prompts.

So the schema is sent twice, once through the native tool definition and once in prose,
and a model that mishandles the protocol can still read what it was asked for.

### Slot widths

New seats join the wide slots fed by `RUN_ROSTER`:
critics, adjudication panel, repair judges, translators, and translate-judges.

Writers stay NARROW and are chosen by measurement rather than by taking all 10.
This honours "producers stay at three" from `doc/planning/translation-repair-open-decisions.md`,
keeps per-slice cost flat while the roster nearly doubles,
and leaves the widened panel doing what a panel is for.
Until that calibration pass runs, the writer set is whatever survives the GLM-4.7-Flash removal.

New seats carry FULL WEIGHT immediately.
The owner's reason: nothing is shipping artifacts yet, so an uncalibrated vote cannot reach a reader.

### Self-certification

`checkerSelfCertificationPermitted` is ENABLED.
Checkers and writers are no longer disjoint sets,
so the half-weight discount that `#187` found unreachable in production goes live.
`#188`'s finding, that width changed no verdict across 231 rounds,
was measured on a disjoint panel and no longer describes the pipeline it was measured on.

### Picture readers

`RUN_READER_MODELS` stays catalog-derived and widens from 2 to 6,
because 4 of the 8 Hyper models report `capabilities.vision: true`:
`qwen3.8-max`, `minimax-m3`, `kimi-k3`, `glm-5.2`.

The old invariant, that readers never judge so a disinterested judge always remains on a picture slice,
is replaced by the half-weight discount.
That is a weaker guarantee than disjointness and needs its own check:
no slice may end up judged only by models that read its pictures.

### Answer volume

`#156` bounds answer volume at 32000 tokens after measurement.
Two Hyper models cap lower: `gpt-oss-120b` at 13107 output tokens and `kimi-k3` at 16000.
The bound becomes PER MODEL, the lower of `#156` and the model's own cap,
so a truncation is a named refusal rather than a silently short answer a judge scores as complete.

## Still to measure

- Which stages dominate call volume, since "widen to balance load" is a claim about volume.
- The calibration pass that picks the narrow writer set from the 10.
- That no picture-carrying slice is judged only by its own readers.
- Whether the measured concurrency holds for corpus-sized bodies as it does for a two-line prompt.

## What has landed

As of 2026-08-24, in commit order:

-   `anthropic-delta-scan.ts` implements the existing `DeltaScanner` interface over Anthropic SSE,
    so every stream guard covers the second transport with no second copy of a measured threshold.
    GFP-proven with two mutations.
-   `hyper-catalog.ts` records the eight allowlisted models with their measured tool-choice shape,
    vision flag and output ceiling, plus `answerCeilingFor` reconciling each model against `#156`.
    GFP-proven with one mutation.
-   `anthropic-completion.ts` reassembles a drained Anthropic body into `ExtractedCompletion`,
    reading tool-call arguments as the answer and requiring `message_stop`.
    GFP-proven with one mutation.
-   `RosterModelId` replaces `SyntheticModelId` across 111 files,
    since the type is about to name five models Synthetic does not serve.
-   `provider-barrel.ts` splits the provider exports out of `index.ts`, which had reached its line budget.
-   `anthropic-tool.ts` renders one schema into both places the model sees it:
    the `tools` entry the server validates against,
    and the system prompt a weak model actually reads.
    It validates the tool name against what the protocol accepts,
    rather than letting every call of a stage answer `400`.
    GFP-proven with two mutations.
-   `anthropic-content.ts` translates a message into Messages API content blocks,
    taking a picture's data URI apart into a media type and a payload.
    GFP-proven with one mutation.
-   `anthropic-request.ts` assembles the whole body:
    system prompt lifted out of the messages,
    `max_tokens` defaulted to the per-model ceiling,
    streaming always on,
    conversation checked for the opening user turn this protocol requires.
    GFP-proven with two mutations.
-   `hyper-credits.ts` reads `GET /v1/credits`,
    refusing a non-finite balance because that one value would read as an unlimited budget.
-   `budget-routing.ts` decides which provider serves a call, and is the first thing ever to consume a quota reading.
    GFP-proven with two mutations.

-   `roster-id.ts` and `roster-reach.ts` widen the roster to ten models across two providers,
    remove the blocklisted model, and derive reach and picture-reading from both catalogs.
-   `RUN_ROSTER` is now derived rather than listed, and `checkerSelfCertificationPermitted` is on.

State: types clean, zero lint findings, 596 tests passing, none failing.

### The system prompt the owner asked for

The owner's instruction was that a detailed system prompt carrying the full tool schema is required,
because some model and provider pairs emit the wrong tool-call format without one.

`renderToolSystemPrompt` states the caller's instruction first, then the whole schema as JSON,
then a list of format rules.
The rules are not filler.
Each line names a shape a model has been seen to emit instead of a tool call:
the answer as fenced text,
the arguments as a JSON string rather than an object,
the object wrapped in one more envelope key,
renamed properties,
a required field dropped because its honest value was empty,
a second call carrying the rest.

A test checks the tool name in BOTH renderings rather than each alone,
because two renderings of one schema can drift
and a drift teaches a model to call a tool that is not the one being offered.

### Correction: the reader sub-roster is five, not six

The option the owner accepted was worded "All 6 read, and re-derive self-certification",
and the six in that wording was mine, not a measurement.
Deriving the set from both catalogs gives FIVE:
`hf:zai-org/GLM-5.2`, `hf:Qwen/Qwen3.8-27B`, `hf:moonshotai/Kimi-K3`, `qwen3.8-max`, `minimax-m3`.
The substance of the instruction is unchanged and is what landed:
readers are derived from what the catalogs report rather than listed by hand,
and self-certification is re-derived.
The lane still goes from two readers to five.

### Reading is narrower than talking

`hf:zai-org/GLM-5.2` reads pictures on Charm Hyper and does NOT on Synthetic.
The same model, the same weights, a different serving stack,
and each catalog reports its own side correctly.

So a call carrying a picture reaches fewer providers than the same model's text call does,
and `visionReachOf` answers that question separately from `reachOf`.
Asking one question for both would either send a picture where it cannot be read,
or refuse one that can.

### The transport, confirmed live on 2026-08-24

These were measured but never written down, which is how the second session came to need re-measuring:

-   `POST https://hyper.charm.land/v1/messages`, with `Authorization: Bearer <key>`,
    `content-type: application/json` and `anthropic-version: 2023-06-01`.
    An `x-api-key` header, which is what Anthropic's own API takes, answers `401 missing authorization`.
-   `GET https://hyper.charm.land/v1/credits` with the same auth returns `{"balance": N}`;
    read 243 on 2026-08-24, down from 249 earlier the same day.
-   The stream carries `{"type":"ping"}` keep-alive frames between real events.
    Both readers already ignore them and count zero unreadable frames over twenty of them,
    but that was accidental rather than intended, so both now pin it with a case taken off the wire.
-   A forced tool call arrives as one `input_json_delta` whose `partial_json` is the whole answer object,
    with `stop_reason: "tool_use"` on `message_delta` and usage there rather than on `message_start`.

### The client, the budget view, and the router: landed 2026-08-24

`createHyperClient` in `hyper-client.ts` assembles the parts that were built and unreachable:
`buildAnthropicBody` for the body,
`extractAnthropicCompletion` for the drained reply,
`wireFormat: 'anthropic'` on the exchange so the guards read the stream,
and the endpoint facts confirmed live.

It raises `SyntheticHttpError`, named after the other provider, DELIBERATELY.
`benchmark.ts` branches on `error instanceof SyntheticHttpError` to read a status off a failed call,
and a fresh class here would make that site blind
to exactly the provider added to survive the other one's exhaustion.
The name is wrong and the behaviour is right;
renaming it is held with the `SyntheticClient` rename.

The JSON ladder moved to `chat-json-outcome.ts` rather than being copied.
None of it is provider-specific:
it reads text a model wrote and decides whether that text is an answer,
a refusal, or a mismatch.
Every step in it stands for a defect found live,
and a copy would have taken none of the next ones.

`provider-budget.ts` is the first thing that has ever consumed the quota reader built on 2026-07-16.
It reads both meters, caches the view, and lets a refusal correct it.
AN UNREADABLE METER READS AS SPENDABLE:
a budget endpoint that times out is a monitoring failure,
and treating it as exhaustion converts that into an outage.
A refusal is stickier than a meter reading,
because a meter can lag a 429 by its own refresh interval;
the cooldown is one-directional and can only hold a provider out.

`provider-router.ts` is the client seam `routeProviderFor` now threads through.
A budget refusal marks that provider and asks the other one, exactly once.
A failure that is NOT about budget is re-raised untouched,
because spending the second provider's money on someone else's fault
hides the fault and pays for it twice.
Both 429 and 402 count as budget refusals:
a subscription reports exhaustion as a rate limit and a balance reports it as payment due.

Pictures route by `visionReachOf` rather than `reachOf`,
which is what the "reading is narrower than talking" finding demands.

### Per-model concurrency: measured, not inherited

The second provider DOES NOT SERIALISE PER MODEL.
Measured live on 2026-08-24 against `minimax-m3`:

-    4 concurrent calls: all ok, burst 1512 ms.
-    8 concurrent calls: all ok, burst 2128 ms.
-   16 concurrent calls: all ok, burst 1589 ms.
-   32 concurrent calls: all ok, burst 2482 ms.

Single-call band over five runs: 994 to 1641 ms.
Every burst finished in about the time ONE call takes;
serialised, the 32 would have taken some 40 seconds.
Zero refusals at any width.

The default moves from the other provider's 1 to 8.
It is held below the proven 32 because the probe sent a two-line prompt
and a corpus call carries orders of magnitude more:
what was measured is that the provider accepts the width,
not that 32 large bodies stream at once through our own drain and guards.

The balance did not move across roughly 50 calls,
so `hyperIsDry` reading `balance <= 0` detects exhaustion but not approach to it.

### A race the saturation test caught

The router's slot count rose at DISPATCH.
Two calls choosing at once both resume from the budget read before either has been sent,
so both saw a free slot and both went to the same provider.
The count now moves in the same synchronous step as the decision,
with nothing awaited between reading it and incrementing it,
and the slot is released through a `Disposable` rather than a `finally`
so a later early return cannot skip it.

### Still to build

-   Handing the routing client to the stages,
    which today still construct `createSyntheticClient` directly.
-   Cross-provider re-ask for the three shared models;
    `#88`'s repair path for the rest.
-   The calibration pass that picks the narrow writer set from the ten,
    which also settles the provisional third editor and refiner seat.

### The worktree's secrets file is stale

`.env.local.json` is gitignored, so the feature worktree holds its own copy,
and that copy predates `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`.
Live probes against the second provider must run with the main repo as the mise config root;
the built bundle can still be imported from the worktree by absolute path.

### A trap worth remembering

`prepare-section-round.ts` carries a literal NUL byte as a cache-key separator,
so `grep` and `rg` classify it as binary and report NO MATCHES rather than the matches it holds.
A repo-wide rename looked complete and the source looked clean;
only the bundler disagreed.
Use `grep -a` when a search over this package must be exhaustive.
