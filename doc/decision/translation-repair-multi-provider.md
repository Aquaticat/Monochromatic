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

### Verified live at the production seam, 2026-08-24

`createRunClient()` with both keys, driven from a consuming script.
The wire label each call carried names the provider that served it,
because the two providers spell a shared model differently:

-   `hf:moonshotai/Kimi-K3` -> Synthetic, the roster spelling.
    A shared model with budget goes to the preferred provider.
-   `deepseek-v4-flash-0731` -> Charm Hyper, its own spelling.
    The only provider that serves it.
-   `hf:zai-org/GLM-5.2` -> Synthetic, the roster spelling.
    Shared, and this was a TEXT call;
    the same model carrying a picture routes to Hyper instead.
-   `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` -> Synthetic.
    The only provider that serves it, and the router did not try Hyper.

All four returned schema-valid answers.
The `quotas` passthrough answered five-hour 2735/2750, weekly 99.797%.

The budget layer read each meter ONCE across the four calls,
one `quotas` and one `credits`,
which is the caching working rather than a coincidence:
a second `quotas` line appears only because the probe called the passthrough itself.

### The cross-provider re-ask: landed 2026-08-24

`chatJson` on the routing client reads its outcome,
and a non-conformant one from a model BOTH providers serve is re-asked on the other stack.

Why this is worth a second call rather than a retry:
the two providers extract structure by genuinely different mechanisms,
a forced tool on one and a `response_format` on the other,
so the same weights can conform on one serving stack and not the other.

It is not a budget failover and does not pretend to be one.
A bad answer marks nobody as refusing.
The re-ask is skipped where the other provider does not serve the model,
which is the `#88` invalid-candidate path the policy names,
and skipped where the other provider has no budget.
When both stacks disagree with the schema,
the PREFERRED provider's answer is returned,
because the caller's own handling is written against it;
both are logged.

### Wiring: landed 2026-08-24

`createRunClient` is the one factory every corpus-run entrypoint calls,
so the routing client reaches all of them at once.
The returned surface is unchanged, `quotas` included,
so no caller and not the bench recorder needed touching.

The routing client deliberately does NOT offer `quotas`:
the two providers meter differently and there is no single reading.
The wiring layer is where the knowledge that `quotas` means the Synthetic meter belongs.

The second key is OPTIONAL and its absence is LOUD.
Refusing to start would stop a run the first provider can serve alone;
starting silently would hide a setup mistake until a 429 storm read as a provider outage.

### Still to build

-   The calibration pass that picks the narrow writer set from the ten,
    which also settles the provisional third editor and refiner seat.

### The twelve-round calibration settles seat one and nothing else

Ten models writing and ten judging the same twelve slices,
scored by the share of DISINTERESTED ballots each producer's work drew,
where disinterested means the judge held no stake in that candidate.
Finished in 3637 seconds.

    hf:Qwen/Qwen3.8-27B         29.7%   27 of 91    z  5.65   CI [20.3, 39.1]
    gemma-4-26b-a4b-it          17.9%   15 of 84    z  1.98   CI [ 9.7, 26.0]
    qwen3.8-max                 17.6%   15 of 85    z  1.93   CI [ 9.5, 25.8]
    hf:openai/gpt-oss-120b      11.8%   10 of 85    z  0.20   CI [ 4.9, 18.6]
    hf:moonshotai/Kimi-K3       10.6%    9 of 85    z -0.14   CI [ 4.0, 17.1]
    minimax-m3                   9.6%    9 of 94    z -0.46   CI [ 3.6, 15.5]
    NVIDIA-Nemotron-3-Super      4.1%    4 of 97    z -2.18   CI [ 0.2,  8.1]
    deepseek-v4-pro-0813         3.4%    3 of 88    z -2.29   CI [-0.4,  7.2]
    hf:zai-org/GLM-5.2           2.7%    2 of 74    z -2.29   CI [-1.0,  6.4]
    deepseek-v4-flash-0731       2.4%    2 of 84    z -2.54   CI [-0.9,  5.6]

The null is the POOLED share, 11.1 percent, 96 wins over 867 ballots:
what a producer drawing ballots at its fair rate would take.
Ten models are compared at once,
so the threshold that survives the multiplicity is Bonferroni's,
`|z| >= 2.81` rather than 1.96.

WHAT IS SETTLED: `hf:Qwen/Qwen3.8-27B`, at `z = 5.65`,
with a confidence interval that does not come near the null.
It clears the corrected threshold twice over and is the first writer's seat.

WHAT IS NOT SETTLED, and this is the part the ranking's ordering hides.
`gemma-4-26b-a4b-it` and `qwen3.8-max` sit at 17.9 and 17.6 percent,
which reads like a second and a third place.
Neither clears the corrected threshold,
BOTH confidence intervals contain the null,
and the 0.3 points between them is far inside the noise of either.
They are tied with each other and unproven against chance.
Seating them in that order would be reading a ranking as a result.

The four at the bottom are consistently below the null,
`z` between -2.18 and -2.54,
and not one of them clears the corrected threshold either.
Four independent models all landing below by a similar margin is suggestive,
but no single one of them is individually established as worse.

WHAT IT WOULD TAKE. For a producer at 17.9 percent to clear the null by three standard deviations
needs about 284 disinterested ballots,
against the 84 it has.
At the observed 7.6 ballots per producer per round that is about 37 rounds.

So the twelve-round pass is not a failed measurement;
it is a measurement whose denominator answers one question and not three.
The owner's standing instruction decides what follows from that:

> If measurement cannot settle a decision under the guideline of "max quality",
> you're not measuring right or enough.

A forty-round pass is therefore running rather than three seats being filled from this table.

### Which seats the forty-round pass actually decides

`RUN_ROSTER` is `ROSTER_MODEL_IDS`, all TEN, so the wide roles already fan out
across both providers:
critics, panel, judges, and both stages of the translate lane.
The calibration's roster is therefore production's roster rather than a superset of it.

Only three roles are narrow, and this is how they stand against the twelve-round table:

    editors    Kimi-K3 10.6% (at chance)   GLM-5.2 2.7% (z -2.29)   Qwen3.8-27B 29.7% (established)
    refiners   the same three
    checkers   Qwen3.8-27B 29.7%   Nemotron 4.1% (z -2.18)   gpt-oss-120b 11.8% (at chance)

THE SEAT IN QUESTION IS GLM-5.2's.
It holds an editor seat AND a refiner seat while scoring third from bottom as a writer,
and it is also the second worst model measured on reliability,
losing 2 voices of 21.
Those two facts point the same way, which is rare enough to be worth saying;
the reliability finding and the quality finding are independent measurements
and they agree.

IT IS NOT YET GROUNDS TO MOVE IT.
`z = -2.29` does not clear the Bonferroni threshold of 2.81,
so on this evidence GLM-5.2 is suggestively weak rather than measurably weak.
The seat's own comment already calls the third writer provisional
and names this calibration as what settles it.

CHECKER SEATS ARE A DIFFERENT QUESTION and this table does not answer them.
The standing measures who WRITES well, and a checker does not write;
`#188` settled checker width separately across 231 rounds.
Nothing here argues Nemotron should leave the checker roster
merely because it writes below the null.

### Two models lose voices and eight do not

Measured on the 2026-08-24 producer calibration,
ten models writing and ten judging the same slices,
over 46.5 minutes and 216 model streams.

Streams that completed against streams cut off after quorum:

-   `qwen3.8-max`, 17 completed and 3 cut, the worst at about 15 percent.
-   `hf:zai-org/GLM-5.2`, 19 completed and 2 cut, about 9.5 percent.
-   Every other model lost nothing at all:
    `deepseek-v4-flash-0731` 21,
    `deepseek-v4-pro-0813` 22,
    `gemma-4-26b-a4b-it` 21,
    `minimax-m3` 22,
    `hf:moonshotai/Kimi-K3` 21,
    `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` 23,
    `hf:openai/gpt-oss-120b` 24,
    `hf:Qwen/Qwen3.8-27B` 22.

THE LOSSES ARE A MODEL PROPERTY RATHER THAN A PROVIDER ONE,
which the split across providers settles:
`qwen3.8-max` is served only by Hyper and GLM-5.2 was called under its Synthetic spelling,
so both stacks lost voices while eight models on those same two stacks lost none.
That distinguishes this from the 2026-08-24 degradation window recorded in the handover,
where losses were spread and no single model explained them.

`qwen3.8-max` FAILS IN ONE RECOGNISABLE WAY.
All three of its cuts delivered 0 content characters
after 33000 to 36000 characters of reasoning,
each opening with the same words,
and each was abandoned at the 180-second post-quorum deadline.
It is not answering slowly;
it is not answering.

### The router was observed crossing providers

One stream in the same log carries the bare Hyper spelling `gpt-oss-120b`
where every other call to that model carries the Synthetic spelling `hf:openai/gpt-oss-120b`.
The two providers name the shared models differently,
so the wire label is direct evidence of the routing decision
rather than an inference from it.

### The budget layer was reading its meters 3.4 times too often

Same log:
158 quota reads and 158 credit reads in 46.5 minutes,
against a 60-second freshness window that should allow about 46 of each.

The cause is the shape this session already fixed once in `provider-router.ts`:
state checked before an `await` and written after it.
Every call arriving while a reading was in flight saw the old stamp and started its own.
Fixed in `88a092d32` by collapsing "fresh" and "in flight" into one idea:
a reading STARTED inside the window is the reading every caller uses,
so the stamp goes on before the await.
GFP-proven by restoring the late stamp, which fails the new case.

ONE CONSEQUENCE IS NAMED RATHER THAN HIDDEN:
the first caller's signal governs the shared reading,
so its abort resolves the reading WET for every sharer.
That is already this file's answer for an unreadable meter,
and the router still recovers a real refusal through failover.

VERIFIED AT THE USER BOUNDARY on the forty-round pass,
which is a live run of the fixed build rather than a test double:
0.50 quota reads and 0.50 credit reads per minute over a twelve-minute window,
against 3.40 of each before the fix
and a ceiling of 1.00 that the sixty-second window permits.
A 6.8-fold reduction, and under the ceiling rather than merely nearer it.

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

### The forty-round pass seats the writers, 2026-08-24

40 rounds, ten models writing a candidate for the same slices
and every other model judging them:
2492 disinterested ballots against a pooled null of 13.48 percent.
That is past the ~284 ballots the twelve-round pass computed as the requirement
to separate the contenders it left tied.

The raw standing, each rate over the rounds that model produced a candidate in:

    qwen3.8-max              27.0%   47 of 174 ballots, over 28 candidates
    hf:Qwen/Qwen3.8-27B      24.1%   61 of 253, over 37
    gemma-4-26b-a4b-it       18.3%   46 of 252, over 40
    hf:moonshotai/Kimi-K3    14.1%   36 of 255, over 40
    hf:openai/gpt-oss-120b   13.9%   35 of 252, over 40
    minimax-m3               12.3%   32 of 260, over 40
    deepseek-v4-pro-0813     10.7%   28 of 262, over 40
    deepseek-v4-flash-0731    8.4%   20 of 239, over 40
    hf:zai-org/GLM-5.2        8.2%   23 of 280, over 40
    NVIDIA-Nemotron-3-Super   3.0%    8 of 265, over 40

READ THE CANDIDATE COLUMN BEFORE THE RATE COLUMN.
Two models did not answer every round,
and a rate computed over the rounds a model survived
credits it for the rounds it skipped.
Charging each model zero for every round it missed:

    hf:Qwen/Qwen3.8-27B      22.3%   z  4.27   clears Bonferroni 2.81
    qwen3.8-max              18.9%   z  2.50   does not clear
    gemma-4-26b-a4b-it       18.3%   z  2.22   does not clear
    hf:moonshotai/Kimi-K3    14.1%
    hf:openai/gpt-oss-120b   13.9%
    minimax-m3               12.3%
    deepseek-v4-pro-0813     10.7%
    deepseek-v4-flash-0731    8.4%
    hf:zai-org/GLM-5.2        8.2%
    NVIDIA-Nemotron-3-Super   3.0%   z -4.99   the first established WORST

#### qwen3.8-max's headline is survivorship, and it was proved rather than asserted

The suspicion is cheap and the proof is not,
so the log was parsed into its 40 round segments
and the OTHER models' median answer length taken as a proxy for slice size.

Rounds `qwen3.8-max` missed ran a median of 588 characters.
Rounds it answered ran 366.
The ratio is 1.61,
Mann-Whitney `z = +3.51`, `p ≈ 0.0004`,
and the quartiles barely overlap:
512 to 687 against 259 to 462.

THE PARSE VALIDATED ITSELF.
It found 12 missed rounds and 28 answered,
and 28 is exactly the candidate count the standing reports independently.

So the model that tops the raw table is the model that skips the large slices,
and it also took 29 cuts, more than any other model on the roster.
It is a good writer of easy passages and absent on hard ones.

#### What was seated

`editorModelIds` and `refinerModelIds` both become:

-   `hf:moonshotai/Kimi-K3`, kept: 40 of 40 candidates, at the null.
-   `hf:Qwen/Qwen3.8-27B`, kept: established in both passes, the only model clearing Bonferroni.
-   `gemma-4-26b-a4b-it`, seated: 40 of 40 candidates, zero cuts, 18.3 percent.

`hf:zai-org/GLM-5.2` leaves both seats.
It is below the pooled null in both passes,
and it was independently the second worst model on reliability.

`qwen3.8-max` is not seated and keeps every wide role.
A wide role loses one ballot when a voice is lost;
a three-seat stage facing quorum of two loses the stage.
Those are different bargains and the survivorship finding decides between them.

THE WRITER SEATS NOW CROSS PROVIDERS, which none of them did before.
The argument runs BOTH WAYS and only one direction was written down at first.
Every previous writer seat was Synthetic-served,
so a Synthetic outage emptied the editor and refiner stages entirely
however well the router covered the wide roles.
Charm Hyper serves `gemma-4-26b-a4b-it`.

THE SYMMETRIC COST IS REAL AND WAS OBSERVED THE SAME DAY.
A run started 2026-08-24 15:36 found Charm Hyper out of budget from its first second,
and the five models it refused were exactly the five Hyper-only ones:
`qwen3.8-max`, `minimax-m3`, `gemma-4-26b-a4b-it`,
`deepseek-v4-pro-0813` and `deepseek-v4-flash-0731`.
The five Synthetic-served models kept streaming and both meter endpoints kept reading.

So the seat that protects the editor stage from a Synthetic outage
also exposes it to a Hyper one, which it was not exposed to before.
Under either outage the stage keeps two of three seats and clears quorum,
which is the property that matters and is why the swap still stands;
what changed is WHICH outage costs the seat, not whether one can.
Before the swap, all three writer seats fell together on a single Synthetic outage,
so the stage went from three-of-three exposure on one provider
to two-of-three on each. That is the trade, stated in full.

The wide roles were unaffected on the observed day:
they carry all ten, so five going dark costs ballots rather than the stage.

#### Neither provider can be restored on demand, and that settles the seat

Stated by the owner on 2026-08-24, correcting an assumption made when the
outage was found:

>   I cannot reset charm hyper on demand.
>   I can only reset synthetic, and only sometimes.

So Charm Hyper capacity returns on its own schedule and cannot be bought back,
and Synthetic capacity can be restored only sometimes.
BOTH PROVIDERS GO DRY AND NEITHER IS RELIABLY RECOVERABLE.

That is the fact the seating should be judged against, and it argues FOR the
swap more strongly than the quality table did.
Count what each arrangement does when a provider goes dry:

    three Synthetic seats  Synthetic dry -> 0 editors, the stage is empty
                           Hyper dry     -> 3 editors, untouched
    two Synthetic, one Hyper
                           Synthetic dry -> 1 editor, a candidate is still produced
                           Hyper dry     -> 2 editors, quorum clear

The old arrangement had one outage that emptied the stage outright.
The new one has none.
An empty stage is a different kind of failure from a thin one:
a thin stage still produces a candidate to judge,
and the old shape's whole exposure sat on the provider the owner
can restore only sometimes.

THE COUNTER-ARGUMENT, weighed and rejected.
A model that is dark contributes nothing, whatever it scores when awake,
so the honest comparison is quality times availability.
The best Synthetic-served alternative for the third seat is
`hf:openai/gpt-oss-120b` at 13.9 percent against `gemma-4-26b-a4b-it` at 18.3,
which breaks even when Charm Hyper is up 76 percent of the time.
Hyper's duty cycle has not been measured, so that ratio cannot be evaluated yet.
It does not decide the seat either way,
because it prices only the THIRD seat's marginal quality
while the arrangement above prices the whole stage's survival,
and survival is the larger term.

THE OUTAGE TABLE STOPPED BEING AN ARGUMENT THE SAME AFTERNOON.
The 15:36 pass reached the naturalness lane with Charm Hyper still dry
and logged both halves of the prediction within ten milliseconds:

    17:01:28.240  chunk 2: nothing to edit, unchanged
    17:01:28.250  refiner gemma-4-26b-a4b-it: NoProviderForModelError: no provider can take it
    17:04:18.932  refinement from hf:Qwen/Qwen3.8-27B won

The newly seated Hyper model went dark in the seat it had just been given,
the stage ran on its two remaining seats,
and a refinement still won and shipped.
That is the two-of-three row of the table, observed rather than reasoned about,
and it is the case the swap was defended on.

WHAT WOULD CHANGE THIS: a measured Hyper duty cycle well under 76 percent,
at which point `hf:openai/gpt-oss-120b` takes the seat on quality as well.
Recording provider-dry intervals across runs is how that gets measured.

#### A first estimate off the existing logs, and why it does not decide anything

Every log already timestamps `NoProviderForModelError`,
so a first estimate needed no instrumentation and no quota.
759 agent logs were scanned, and THE DENOMINATOR WAS VALIDATED BEFORE THE RATE:
a log written before the second provider existed cannot show a refusal,
so only the 26 that name a Hyper-only model can count as evidence either way.
Of those, 24 are wet and 2 are dry, and they fall in one clean block each.

    wet   2026-08-24T09:41:17Z .. 14:58:53Z   24 logs, no refusal in any
    ????  14:58:53Z .. 15:04:28Z              nothing ran, 5m35s wide
    dry   2026-08-24T15:04:28Z .. 17:53:00Z   2 logs plus a model-health probe

Read as fractions of the 8h11m43s observed: wet 64.6 percent, dry 34.3,
unknown 1.1. That is BELOW the 76 percent break-even.

IT STILL DOES NOT MOVE THE SEAT, for three reasons, and the third is decisive:

-   ONE TRANSITION IS NOT A DUTY CYCLE. There is a single wet-to-dry edge in the
    whole record. A rate over one event is the mistake this document already
    caught once today, in `qwen3.8-max`'s standing.

-   THE DRY INTERVAL IS RIGHT-CENSORED. It was still dry at the last observation,
    so 2h48m is a floor and the fraction could move either way once it lifts.

-   THE DRYNESS IS PROBABLY SELF-INFLICTED. A 40-round calibration ran 11:22 to
    14:32 and spent 937 streams, and a corpus pass ran to 14:58. Hyper was dry by
    15:04. So this measures how fast heavy verification exhausts a budget and how
    long it takes to refill, which is a fact about the day's usage rather than
    about the provider. Production traffic has a different shape entirely.

WHAT WOULD SETTLE IT is the same measurement over days rather than one afternoon,
which is why `#201` persists transitions rather than sampling.
The number worth having is not the mean but the LONGEST dry interval,
since that is what decides whether a seat can be relied on at all.

`gemma-4-26b-a4b-it` carries `readsImages: false`,
which costs nothing in these seats.
Pictures are read in `image-reading-stage.ts` over `RUN_READER_MODELS`,
a roster derived from the catalog rather than written by hand,
and `document-lanes.ts` records that the repair lane never asks what a picture says.
Its catalog `maxOutputLength` of 25_600 is likewise not a constraint here:
nothing in production reads that field,
and the model answered 40 rounds of production-sized slices without a cut.

#### What this still does not decide

THE INSTRUMENT IS ONE STEP FROM THE SEAT IT WAS USED ON.
`producer-calibrate.ts` drives `runTranslateStage`,
so the thing measured is a model writing a slice from the SOURCE
while every other model votes on the result.
An editor and a refiner both write a slice and are both judged that way,
but from the archive text and a set of critic claims rather than from the source.

That gap is worth naming rather than glossing,
and the same honesty is what keeps this table off the checker seats.
It is nonetheless the nearest instrument that exists,
the seats it moved rested on NO measurement at all before this,
and the direction it points is not marginal:
the model leaving was below the pooled null in two independent passes
and second worst on reliability,
while the model arriving was above it with 40 candidates in 40 rounds.
An editor-role calibration would settle the seat outright.
It is not a variation on the existing runner:
the editor's input includes critic claims,
so the instrument has to buy a critic stage before it can ask an editor anything.

CHECKER SEATS.
`checkerModelIds` still seats `NVIDIA-Nemotron-3-Super`,
which this pass establishes as the worst WRITER on the roster at `z = -4.99`.
That is not evidence about checking.
The instrument measures who writes a candidate other models vote for;
a checker writes nothing.
Moving a checker seat needs a checker-side measurement,
and `#188` is the shape such a measurement takes.
Acting on this table would be reading the wrong instrument.
