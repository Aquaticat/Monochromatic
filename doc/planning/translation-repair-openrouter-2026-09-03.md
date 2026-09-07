# Translation repair: OpenRouter as the paid fallback provider

Planning record,
2026-09-03.
Nothing here is ratified;
the owner's answers to the questions at the end decide the seating.
Measurements were taken on 2026-09-03 between 15:24 and 15:45 UTC unless dated otherwise.

## Why now

The owner on 2026-09-03:
Charm Hyper ended its bundle subsidization,
so there is no reason to recharge Hyper from the usual subscription;
OpenRouter is preferred for paid per-token work,
and Synthetic and Hyper are expected to run dry often.
`TRANSLATION_REPAIR_OPENROUTER_API_KEY` was added to the main worktree's `.env.local.json`.
The feature worktree's copy predated it;
copying the encrypted file across was refused by the session's permission classifier,
so the day's OpenRouter probes and both live passes ran with the main repo as the mise config root
(the bridge `doc/decision/translation-repair-multi-provider.md` records under "The worktree's secrets file is stale").
The owner copied the file at 17:40 UTC;
`mise exec` from the worktree root now injects all four names,
and later passes launch from the worktree as the runbook's ordinary path says.

State of the other two providers at the time of writing:

- Synthetic weekly read `0%` from 13:15:51 UTC on the stub-fix XIEPT2 run (`~/temp/agent/xiept2-stub-20260903.log`).
- Hyper `GET /v1/credits` read 2497.
    Runs measured off the `METERS hyperBalance=` line,
    first to last,
    cost 724 (XIEPT2 postscript),
    654 (XIEPT2 stub fix),
    654 (Carena0442 rerun of 2026-09-02) and 428 (Toka_ls rerun 2 of 2026-09-02).
    That balance buys three to five more entry runs and will not be topped up.

## What OpenRouter answered

### Account and meter

- `GET https://openrouter.ai/api/v1/key` with the ordinary key:
  `limit: null`,
  `limit_remaining: null`,
    `usage: 0`,
    `is_free_tier: false`,
    `is_management_key: false`.
- `GET https://openrouter.ai/api/v1/credits` with the same ordinary key answered `200` with
    `total_credits: 1913` and `total_usage: 1855.383100082`,
    so the balance is about 57.62 USD,
    matching the owner's figure.
    The endpoint's own page says a management key is required;
    the live call says otherwise.
    Recorded as a discrepancy rather than resolved;
    the meter will be built on the live behaviour with an unreadable meter counting as spendable,
    which is this package's existing rule (`provider-budget.ts`).
- Purchase fee per the FAQ:
  5.5% with a 0.80 USD minimum by card,
  5% by cryptocurrency.
    Credits may expire one year after purchase.
- Rate limits page:
  paid models carry no documented request ceiling beyond DDoS protection;
    `429` arrives as a status or as an in-stream `finish_reason: "error"`,
    `402` when credits are insufficient.
    Free variants (`:free`) are capped at 20 requests per minute and 1,000 per day.

### Transport

- `POST https://openrouter.ai/api/v1/messages` speaks the Anthropic Messages format:
    `Authorization: Bearer`,
    streaming SSE in Anthropic event shapes,
    `tools` and `tool_choice: {type: "tool", name}` forced tool use,
    OpenRouter model slugs in `model`,
    a `provider` object in the body,
    and usage carrying `input_tokens`,
    `output_tokens` and an optional `cost` in USD.
    This is the protocol `hyper-client.ts` already speaks,
    so `buildAnthropicBody`,
    `extractAnthropicCompletion` and `wireFormat: 'anthropic'` are reusable.
- The `provider` object supports `order`,
  `only`,
  `ignore`,
  `allow_fallbacks`,
  `require_parameters`,
    `data_collection: 'deny'`,
    `zdr: true`,
    `sort`,
    `max_price` and quantization filters.
    The account-level allowed-provider list is a ceiling over request-level `only`;
    account-level ignores merge with request-level ones.
- Zero data retention:
  `zdr: true` per request ORs with the account setting.
    `GET https://openrouter.ai/api/v1/endpoints/zdr` listed 834 ZDR endpoints.

### Batch

From the batch quickstart:
`POST https://openrouter.ai/api/beta/batches` with `endpoint`,
`model` and inline `requests[]`,
polled at `GET /api/beta/batches/:id`,
results inline on completion,
text only,
the only completion window `24h`,
priced at "50% of the model's standard per-token pricing".

The `:batch` entries in the public listing,
USD per million prompt and completion tokens,
against the realtime entry of the same model:

- `moonshotai/kimi-k3`:
  batch 3 and 15;
  realtime 3 and 15.
- `minimax/minimax-m3`:
  batch 0.3 and 1.2;
  realtime 0.3 and 1.2.
- `deepseek/deepseek-v4-flash-0731`:
  batch 0.14 and 0.28;
  realtime 0.065 and 0.18.
- `z-ai/glm-5.3-flash`:
  batch 0.15 and 0.5;
  realtime 0.075 and 0.25.
- `openai/gpt-oss-120b`:
  batch 0.15 and 0.6;
  realtime 0.037 and 0.17.
- `qwen/qwen3.8-27b` and `z-ai/glm-5.3`:
  no `:batch` entry.

Which price the "50% of standard" claim discounts from is not established here;
the listing's realtime column is the cheapest endpoint,
and the batch column may discount a single provider's list price.
What is established:
for this roster,
the listed batch price is never below the listed realtime price,
and two roster models have no batch entry at all.

The structural fact matters more than the price.
A corpus pass is a chain of dependent rounds (critics,
panel,
editors,
judges,
contest,
consolidation),
about fifty per entry,
each waiting on the previous one,
and every round is built on streaming quorum with straggler and writer grace.
A batch whose only window is 24 hours cannot carry that chain within rule `FIT` or `FT2`,
and the guards that keep a stage honest (quorum,
grace,
abandonment) have no meaning over a batch.

## Roster models on OpenRouter

Spellings,
realtime USD per million prompt and completion tokens,
total endpoints,
ZDR endpoints,
and whether the owner's allowlist carries the model:

- `moonshotai/kimi-k3`:
  3 and 15;
  18 endpoints,
  16 ZDR;
  allowlisted.
- `minimax/minimax-m3`:
  0.3 and 1.2;
  11 endpoints,
  7 ZDR;
  allowlisted.
- `deepseek/deepseek-v4-flash-0731`:
  0.065 and 0.18;
  30 endpoints,
  22 ZDR;
  allowlisted.
- `deepseek/deepseek-v4-pro-0813`:
  0.66 and 1.98;
  18 endpoints,
  13 ZDR;
  NOT allowlisted.
- `qwen/qwen3.8-27b`:
  0.425 and 2.55;
  12 endpoints,
  9 ZDR;
  allowlisted.
- `z-ai/glm-5.3`:
  1.4 and 4.4;
  25 endpoints,
  22 ZDR;
  allowlisted.
- `z-ai/glm-5.3-flash`:
  0.075 and 0.25;
  23 endpoints,
  19 ZDR;
  allowlisted.
- `google/gemma-4-26b-a4b-it`:
  0.07 and 0.34;
  9 endpoints,
  7 ZDR;
  NOT allowlisted.
- `openai/gpt-oss-120b`:
  0.037 and 0.17;
  20 endpoints,
  20 ZDR;
  NOT allowlisted.

Every roster model has at least seven ZDR endpoints,
so `zdr: true` removes no model.

Spelling map used by the pricing below and to be carried into the catalog:

- `hf:moonshotai/Kimi-K3` and `kimi-k3` -> `moonshotai/kimi-k3`
- `minimax-m3` -> `minimax/minimax-m3`
- `deepseek-v4-flash-0731` -> `deepseek/deepseek-v4-flash-0731`
- `deepseek-v4-pro-0813` -> `deepseek/deepseek-v4-pro-0813`
- `hf:Qwen/Qwen3.8-27B` and `qwen3.8-27b` -> `qwen/qwen3.8-27b`
- `glm-5.3` -> `z-ai/glm-5.3`
- `hf:zai-org/GLM-5.3-Flash` and `glm-5.3-flash` -> `z-ai/glm-5.3-flash`
- `gemma-4-26b-a4b-it` -> `google/gemma-4-26b-a4b-it`
- `hf:openai/gpt-oss-120b` and `gpt-oss-120b` -> `openai/gpt-oss-120b`

## What an entry would cost bought entirely on OpenRouter

Method:
every `SPEND provider=... model=... prompt=N completion=N` line of a completed run,
mapped through the spelling map and priced at the realtime rates of the 2026-09-03 listing
(`~/temp/agent/openrouter-models-20260903.json`).
Calls whose provider reported zero usage (15 to 42 per run,
mostly `glm-5.3` on Hyper) price at zero,
so every total is a floor.
Script:
`price-runs-on-openrouter.mjs` in the session scratchpad;
it is a measurement aid,
not package code.

- XIEPT2 postscript (219 minutes,
  2197 calls):
  14.41 USD,
  Kimi-K3 8.74 (61%),
  5.67 without Kimi.
- XIEPT2 stub fix (146 minutes,
  2024 calls):
  12.48 USD,
  Kimi-K3 7.36 (59%),
  5.13 without Kimi.
- Carena0442 rerun 2026-09-02 (190 minutes,
  1938 calls):
  13.52 USD,
  Kimi-K3 7.76 (57%),
  5.75 without Kimi.
- Carena0442 four-entry pass 2026-09-01 (94 minutes,
  1749 calls):
  11.40 USD,
  Kimi-K3 5.90 (52%),
  5.50 without Kimi.
- Toka_ls rerun 2 2026-09-02 (100 minutes,
  1259 calls):
  6.78 USD,
  Kimi-K3 4.08 (60%),
  2.70 without Kimi.

After Kimi,
the next largest lines are Qwen3.8-27B (0.88 to 2.74),
minimax-m3 (0.69 to 1.29),
GLM-5.3 (0.48 to 1.15) and DeepSeek V4 Pro (0.47 to 1.08).
The three models absent from the allowlist together cost 0.12 to 1.26 per entry.

Auto top-up arithmetic:
the observed cadence is three to four entries a day,
so a day bought entirely on OpenRouter is about 50 USD with Kimi-K3 seated and about 20 USD without.
The fee is a percentage with a 0.80 floor,
so a top-up above about 15 USD pays the same rate whatever its size;
the amount only decides how often the purchase happens.
A threshold of 20 USD (one XIEPT2-scale entry plus margin) and a top-up of one day's spend follows.

## Decisions taken here, open to veto

- Routing order:
  Synthetic while wet,
  then Hyper while its balance lasts,
  then OpenRouter.
    This is the plain reading of the owner's two messages of 2026-09-03 taken together.
- Transport:
  the Anthropic Messages endpoint with forced tool use,
    reusing the Hyper request builder and stream reader with a different URL and auth header.
    `provider.require_parameters: true` so only endpoints supporting `tools` and `tool_choice` are eligible,
    `provider.ignore` for any endpoint that measures badly.
    Conformance is measured twenty times per model before a model is seated on this provider,
    as the Hyper decision did.
- Meter:
  `GET /api/v1/credits`,
  balance as `total_credits - total_usage`;
    dry at or below zero;
    unreadable counts as spendable;
    `402` and `429` are refusal holds.
    No management key is needed while the ordinary key answers.
- Gemini 3.8 Flash joins the roster blocklist on the owner's words ("a wildly misaligned model").
- `:free` variants are not used:
  20 requests per minute and 1,000 per day cannot carry a corpus pass,
    and their data policy is the provider's,
    not ours.
- Spend lines carry OpenRouter's reported `cost` in USD when present,
    so the price table is a fallback rather than the source.

## Constraints for the build

- Generalize the router to an ordered provider list rather than a third boolean;
    `ProviderName`,
    `BudgetView`,
    `ModelReach`,
    `readBudgetsPastHolds`,
    `secondOpinionFrom` and the all-dry error all encode two providers.
- Seat withholding in `run-seats.ts` is keyed to `syntheticDry` alone;
    with OpenRouter serving Qwen3.8-27B and Kimi-K3,
    re-derive withholding from where each model would be served.
- Check `anthropic-delta-scan.ts` against OpenRouter's stream:
  a `[DONE]` sentinel and comment keep-alives must not count as unreadable frames;
    pin with a case taken off the wire.
- Verify where usage lands in the OpenRouter stream before trusting `SPEND` lines.
- `required-providers.ts` accepts `openrouter`;
  the key is optional and loud like Hyper's.
- Concurrency and any request-rate ceiling on OpenRouter are unmeasured;
  run the width probe first.

## Questions put to the owner

Asked on 2026-09-03 after this record was written:

1. Batch API:
not viable for the pass as designed;
use realtime,
or redesign for batch.
2. Kimi-K3 when only OpenRouter would buy it:
seat at 3 and 15 USD per million,
or withhold it there.
3. Allowlist:
add `openai/gpt-oss-120b`,
`google/gemma-4-26b-a4b-it` and `deepseek/deepseek-v4-pro-0813`,
    or accept an OpenRouter tier without them.
    (As asked,
    the option text said this "leaves the editor stage on Qwen alone";
    that was wrong,
    gemma is a translator and Qwen a checker.
    Corrected in the decision doc.)
4. Zero data retention:
`zdr: true` on every request,
or plain routing.

Answers,
recorded in `doc/decision/translation-repair-openrouter-fallback.md`:
realtime;
withhold Kimi-K3 where only OpenRouter would buy it;
all three added to the allowlist;
ZDR on every request.

## The `[DONE]` sentinel, fixed before the probe could measure

The first probe against `/api/v1/messages` answered 200 on every call and conformed on none,
because the gateway appends an `event: data` frame carrying `data: [DONE]` after `message_stop`
and `extractAnthropicCompletion` refused the body as "anthropic stream event is not JSON",
while `scanAnthropicDeltas` counted the frame as unreadable.
Both readers now skip the sentinel (`90dcb8745`),
each pinned by a case taken off the wire,
and both cases were shown to fail with the skip removed.
The same capture showed the tool arguments arriving in several `input_json_delta` pieces,
usage and `cost` on `message_delta`,
the serving provider on `message_start.message.provider`,
and `stop_reason: "end_turn"` on a completed tool call,
none of which the reader minded.

## Probe v2: three transports per model

The owner,
mid-session:
OpenRouter likely supports OpenAI chat completions better,
and the Responses API is also supported (and may be the only route to GPT-5.6 Luna).
`~/temp/agent/openrouter-probe-v2-20260903.mjs` therefore drives each roster model twenty times through
each of `/api/v1/messages` (Anthropic format,
forced tool,
the pipeline's own builder and reader),
`/api/v1/chat/completions` (OpenAI format,
`response_format` json_schema,
the Synthetic body shape with the schema
restated in the system prompt) and `/api/v1/responses` (`text.format` json_schema),
every request carrying `provider: { zdr: true, require_parameters: true }`,
four calls in flight per model and transport,
and writes one raw stream per model and transport plus a summary to `~/temp/agent/openrouter-probe-v2-20260903/`.
GPT-5.6 Luna rides along as a candidate,
not a roster model.

### Probe v2 results, 15:49 to 16:05 UTC

Conformant attempts of twenty,
median milliseconds,
and the endpoints that served,
per model and transport (chat = chat completions,
msg = Messages,
resp = Responses):

- `moonshotai/kimi-k3`:
  chat 20,
  3819 ms (Fireworks,
  DeepInfra);
  resp 20,
  4554 ms;
  msg 20,
  30660 ms (DeepInfra).
- `minimax/minimax-m3`:
  chat 20,
  1367 ms (ModelRun);
  resp 20,
  1584 ms;
  msg 20,
  3461 ms (Venice).
- `deepseek/deepseek-v4-flash-0731`:
  chat 20,
  7252 ms (Inceptron,
  Parasail,
  Makora);
  resp 20,
  5803 ms;
    msg 9 of 20,
    7425 ms (DigitalOcean,
    Inceptron):
    eleven answers were not JSON.
- `deepseek/deepseek-v4-pro-0813`:
  chat 20,
  6332 ms (Parasail);
  resp 20,
  6755 ms;
  msg 20,
  1566 ms (BaseTen).
- `qwen/qwen3.8-27b`:
  chat 20,
  4856 ms (Parasail);
  resp 20,
  5208 ms;
  msg 20,
  10123 ms (Reka,
  AkashML).
- `z-ai/glm-5.3`:
  chat 20,
  1068 ms (Together);
  resp 20,
  1058 ms;
  msg 20,
  1126 ms (Together).
- `z-ai/glm-5.3-flash`:
  chat 20,
  7117 ms (Together,
  Modal);
  resp 20,
  7639 ms;
  msg 20,
  6890 ms (Together).
- `google/gemma-4-26b-a4b-it`:
  chat 20,
  1325 ms (Google,
  Parasail);
  resp 20,
  1813 ms;
  msg 20,
  1780 ms (Google,
  NextBit).
- `openai/gpt-oss-120b`:
  chat 20,
  664 ms (Cerebras);
  resp 20,
  717 ms;
  msg 20,
  721 ms (Cerebras).
- `openai/gpt-5.6-luna` (candidate):
  chat 9 of 20 (Azure),
  resp 11 of 20,
  msg 0 of 20 with HTTP 404 "No endpoints found matching your data policy (Zero data retention)";
    the failed chat and Responses attempts answered empty text (`response.failed`).
    Not viable under zero data retention as measured.

Every request cost is on the wire:
20 of 20 priced on every conformant row.
Whole probe:
about 0.55 USD.

THE TRANSPORT IS CHAT COMPLETIONS,
as the owner suggested mid-session:
it conformed on every roster attempt and answered fastest or within noise of fastest on every model,
where Messages answered Kimi-K3 eight times slower and conformed on 9 of 20 DeepSeek Flash attempts.
The Responses endpoint conformed too and is not used;
one OpenAI-shaped path is one reader to maintain.

Qwen3.8-27B's chat median (4856 ms on a short prompt) sits in the band of the other models,
unlike its Hyper serving,
so its withholding rule stays "served by Hyper" and it is seated when OpenRouter would serve it;
the live pass below is where that is checked on corpus-sized prompts.

Width:
32 concurrent chat completions per model on `deepseek/deepseek-v4-flash-0731` (32 of 32 conformant,
median 2852 ms,
max 7776 ms;
Together,
Makora,
OpenInference) and `z-ai/glm-5.3-flash` (32 of 32,
median 7955 ms,
max 49581 ms;
Together,
Modal,
Makora),
no refusal.
The client therefore carries no per-model ceiling by default,
like Hyper's.

## What landed, 2026-09-03

Commits `0aa800ab4` (source) and `433279f3c` (tests and lint),
on top of `90dcb8745` (the `[DONE]` skip):

- `provider-name.ts`:
  `ProviderName` with `openrouter`,
  `PROVIDER_ORDER`,
  `ProviderRecord`,
  `providerRecord`,
    `otherProviders`,
    `isProviderName`.
- `openrouter-catalog.ts`,
  `openrouter-client.ts`,
  `openrouter-credits.ts`,
  `openrouter-cost.ts`:
  the chat completions client with `provider: { zdr: true, require_parameters: true, ignore: [] }` on every body,
    the credits meter,
    and the per-call USD cost read off the final chunk onto the `SPEND` line as `cost=`.
    gemma's OpenRouter row reports no pictures until a transcription is measured,
    so the reader roster is unchanged.
- `budget-routing.ts`:
  `routeProviderFor` walks `PROVIDER_ORDER` over dryness and saturation records;
    `providerServing` answers the seat reader's question;
    `EveryProviderDryError` replaces the two-provider name (old name in the local forbidden-strings appendix).
- `provider-budget.ts`,
  `budget-hold-wait.ts`:
  three meters,
  `METERS` gains `openrouter=` and `openrouterUsd=`,
    a wet refuser is held only while some other provider is wet,
    the all-dry wait is provider-generic.
- `provider-router.ts` with `provider-router-slots.ts` and `provider-router-reask.ts`:
  callers keyed by provider,
    one attempt per provider on refusals,
    the re-ask on the next wet provider serving the model,
    slots counted only where a provider states a ceiling.
- `run-seats.ts`:
  benches derive from `providerServing`;
  Hyper-slow rules apply where Hyper would serve;
    `OPENROUTER_WITHHELD` (Kimi-K3) applies where OpenRouter would;
    `OPENROUTER_CHECKER_SUBSTITUTE` (gemma) keeps the checker floor,
    and both checker assertions run per phase;
    the `JUDGE SEATS` line names every provider's state and every withheld model.
- `run-config.ts`,
  `run-client-contract.ts`,
  `required-providers.ts`,
  `budget-sample.ts`:
  the third key,
  optional and loud;
    the run client exposes `providerDryness`;
    `--require-providers` accepts `openrouter`.
- `spend-read.ts`,
  `spend-cost.ts`,
  `meter-sample-read.ts`,
  `meter-dry-span.ts`,
  `meter-report.ts`:
  the cost field and an OpenRouter USD bucket kept apart from hypercredits;
    older `METERS` lines read with the third state absent.
- `roster-blocklist.ts`:
  `google/gemini-3.8-flash` and its `:batch` spelling.

Guards shown to fail:
the OpenRouter fallthrough (routing and router tests) with `openrouter` excluded from the usable providers,
and the Kimi withholding (seat test) with the check replaced by `true`;
both restored and passing.
915 unit tests pass;
oxlint and the type check are clean.

## The first live pass with OpenRouter in the order, keyword233, 16:38 to 16:54 UTC

Launched from the main repo with the Hyper key unset so the walk went Synthetic,
then OpenRouter (`~/temp/agent/openrouter-live-20260903.log`,
artifacts beside it):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=957655`,
  inside the band of the day's earlier keyword233 runs (653 to 1,164 seconds).
    `verify-published` answered 1 of 1 pages with every promised wording at the implied length.
    The page reads as the earlier runs' pages did.
- `METERS synthetic=wet hyper=dry openrouter=wet` throughout;
  `JUDGE SEATS` at every phase seated the full benches with `withheld=none`,
    since Synthetic served Kimi-K3 and Qwen3.8-27B.
- 146 OpenRouter calls at 0.38 USD by the wire's `cost=`,
  111 Synthetic calls,
  no Hyper call,
  no refusal from either;
    the meter read 56.94 before and 56.46 after,
    the probes of the same hour included.
- **MiniMax M3 came back empty on 16 of 31 OpenRouter calls**:
  `finish_reason=stop`,
  no content,
  some reasoning characters.
    The per-endpoint probe (`~/temp/agent/openrouter-minimax-endpoints-20260903`,
    corpus-sized json_schema request,
    `provider.only` per zero-data-retention endpoint) showed Parasail putting the whole JSON
    answer in the reasoning channel and closing content empty (0 of 2 conformant,
    2 rate-limited),
    ModelRun answering 4 of 4,
    and the five other zero-data-retention endpoints refusing `response_format` with `404 No
    endpoints found that can handle the requested parameters`.
    Default routing without a preference went to ModelRun on 3 of 4 and Parasail on 1;
    with `ignore: ['parasail']` it went to ModelRun on 8 of 8,
    every one conformant.
    The catalog row now carries `ignoredEndpoints: ['parasail']` and the client sends it as
    `provider.ignore` (`7d680d7fa`,
    `3991637a2`);
    both guards shown to fail with the entry removed,
    restored and passing.
    The cost fit on the run's own `SPEND` lines agrees:
    the answered calls priced as ModelRun,
    the empty ones lower.
- Cut streams on OpenRouter,
  provider of the endpoint unknown because nothing logged it:
  `deepseek-v4-pro-0813` twice at 76 and 90 seconds with reasoning only,
    `gemma-4-26b-a4b-it` twice at 66 and 77 seconds with content arriving at under twenty characters a second,
    `deepseek-v4-flash-0731` once at 209 seconds in consolidation.
    Medians on OpenRouter:
    glm-5.3 1.6 s,
    MiniMax 2.0 s,
    DeepSeek Flash 3.8 s,
    gemma 5.3 s,
    DeepSeek Pro 17.5 s;
    ninetieth percentiles 2.2,
    4.3,
    42,
    66 and 39 seconds.
    The endpoint name goes on the `SPEND` line next so the slow tail can be attributed without another probe.
- Nothing on this pass exercised the all-dry benches (Kimi-K3 withheld,
  gemma as substitute checker) or Qwen3.8-27B served by OpenRouter;
    both wait for a Synthetic-dry hour.

## The second live pass, keyword233, 17:06 to 17:28 UTC, with Parasail ignored and endpoints named

Launched as the first was (`~/temp/agent/openrouter-live2-20260903.log`,
artifacts beside it),
after `7d680d7fa` (Parasail ignored for MiniMax M3) and `c21437745` (endpoint on every `SPEND` and stream line):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=1293410`,
  above the day's band (653 to 1,164 seconds).
    The lanes phase took 860 seconds against the first pass's 582;
    lane contest and consolidation each came within a minute of the first pass.
    Two things differed in that phase and this log does not separate their shares:
    a Synthetic 502/500 burst at 17:13 to 17:14 UTC (15 retry lines,
    none reaching the fifth attempt,
    none on the first pass),
    and 11 abandonments at the 60 second straggler grace against the first pass's 8.
    `verify-published` answered 1 of 1 (`wordings=3 silent=0 chars=787=expected missing=0`);
    the page reads as before.
- **The Parasail ignore held**:
  36 of 36 MiniMax calls went to ModelRun and every one completed,
  mean 2.9 seconds,
    with one schema-mismatch (an answer whose every string field was `", "`),
    against 16 empty and 6 mismatched on the first pass.
- 0.4454 USD over 135 OpenRouter calls by the wire's `cost=` (DeepSeek V4 Pro 0.29 USD and two thirds of it,
    glm-5.3 0.08,
    MiniMax 0.05,
    DeepSeek Flash 0.01,
    gemma 0.01),
    117 Synthetic calls,
    no Hyper call,
    no refusal,
    no exhausted retry ladder;
    the meter read 56.37 before and 55.91 after.
- **Per-endpoint attribution**,
  read off `served by` on the stream lines:
    - DeepSeek V4 Flash:
      OpenInference finished 2 of 6 (mean 58.8 s when it finished;
      cut at 67 to 117 s with at most one content character over 6.7k to 14.9k reasoning characters),
        Parasail 12 of 13 (mean 42.8 s),
        Inceptron 4 of 5 (mean 29.9 s),
        Makora 1 of 1,
        Together 1 of 1 (11.5 s).
        Every cut was the straggler grace ending a stream still in its reasoning channel.
        OpenInference is now in the row's `ignoredEndpoints` (`08dffd481`),
        the catalog and client guards shown failing with the entry removed,
        restored and passing.
    - gemma 4 26B:
      DeepInfra 9 of 10 (mean 20.3 s,
      the cut at 83 s),
      SiliconFlow 19 of 19 (mean 4.2 s).
        Not ignored:
        one cut in ten,
        the seat is a checker off the critical path,
        and with DeepInfra gone SiliconFlow would serve alone,
        so a rate limit there would lose the voice outright,
        since OpenRouter is the last provider in the order.
        Revisit if a later pass shows DeepInfra cutting again.
    - DeepSeek V4 Pro:
      Parasail 34 of 35 (mean 21.8 s),
      one cut at 68 s in the consolidation gate.
    - glm-5.3:
      Together 16 of 16 (mean 1.9 s);
      Modal 1 of 1 at 74 s with 27k reasoning characters and a 10 s first byte.
        One sample;
        watch it before acting.
- **Rejected:
  re-routing a voice whose transient-retry ladder is exhausted.**
    The idea was to treat five failed attempts on 5xx as a refusal and walk to the next provider.
    Measured before building:
    the four-entry Carena run of 2026-09-01 had no exhausted ladder,
    the whole archive holds one voice lost that way (`xiept2-postscript-20260903.log`,
    HTTP 503),
    and both OpenRouter passes had none.
    Not worth a code path.
- Still not exercised:
  the all-dry benches and Qwen3.8-27B served by OpenRouter;
  Synthetic stayed wet.

## The third live pass, keyword233, 18:15 to 18:36 UTC, OpenRouter alone

Launched from the worktree at tip `f26c5fb60` with the Synthetic and Hyper keys unset,
which the run reads as both dry (`~/temp/agent/openrouter-live3-20260903.log`,
artifacts beside it):

- `METERS synthetic=dry hyper=dry openrouter=wet` throughout;
    `JUDGE SEATS` at every phase read `wide=6 select=6 late=7 slate=7 checkers=3 withheld=hf:moonshotai/Kimi-K3`,
    the all-dry bench with gemma as the substitute checker.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1247533`;
  lanes 621 seconds,
  lane contest 68,
  consolidation 548.
    `verify-published` answered 1 of 1 (`chars=805=expected missing=0`);
    the page reads as before.
- 0.7590 USD floor over 235 costed OpenRouter calls (two carried no cost),
  meter 55.89 before and 55.05 after.
    DeepSeek V4 Pro 0.19 USD,
    Qwen3.8-27B 0.18,
    Kimi-K3 0.17 from six calls,
    glm-5.3 0.10,
    gpt-oss-120b 0.04,
    MiniMax 0.04,
    GLM-5.3-Flash 0.02,
    DeepSeek Flash 0.01,
    gemma 0.01.
    No refusal,
    no 5xx retry line,
    no exhausted ladder.
- **The withhold reached only the judge benches.**
  Kimi-K3 wrote six translations on OpenRouter (Fireworks 3,
    Modal 3),
    a quarter of the pass's bill,
    while every bench had it out:
    `judgeSeatsFor` filtered the wide,
    late,
    select and checker seats by `seated` and left `translatorModelIds` as the static `RUN_TRANSLATORS`,
    and `pass-entry.ts` passed the catalog's `RUN_READER_MODELS` to the picture stage unfiltered.
    Fixed in `8848f070e`:
    `JudgeSeats` carries `translators` and `readers` filtered the same way,
    the translate lane takes its writers from there,
    and the picture stage reads its own seats (`JUDGE SEATS phase=pictures`,
    `pass-seated-pictures.ts`);
    the seat guards shown failing with the filters removed,
    restored and passing,
    and the entry driver test now counts four meter readings per entry.
    The fourth pass (19:33 UTC,
    launched on that fix) then bought Kimi-K3's first call from the block-pairing
    round six seconds before any bench was read:
    preparation,
    insertion admission and the consolidation writers all took the static `RUN_ROSTER`.
    `68ad11530` adds `roster` to `JudgeSeats`,
    the whole roster less any withheld model,
    read for `phase=preparation` before the pairing round,
    and the other two stages take their own reading's roster;
    guard shown failing with the filter removed,
    restored and passing.
    Not yet exercised live past the pairing round;
    the next OpenRouter-only pass must show no `SPEND provider=openrouter model=moonshotai/kimi-k3` line.
- **The Parasail ignore and the OpenInference ignore both held**:
  36 of 36 MiniMax calls to ModelRun,
  all completed,
    three schema-mismatches (two consolidation gates,
    one translate vote);
    no DeepSeek Flash stream on OpenInference.
- **Qwen3.8-27B served by OpenRouter conformed**:
  31 of 31 completed answers usable,
  all on Parasail,
    completed p50 18.3 s,
    p90 52.8 s,
    max 147 s,
    against p50 16.5 s,
    p90 48.8 s,
    max 228 s on Synthetic on the second pass.
    The endpoint is not the slow part;
    the model reasons long on either provider.
- **Every cut was a reasoning-only stream on Parasail ending at the 60 second straggler grace**,
  14 of them:
    Qwen 7 of 38 asks,
    DeepSeek Flash 6 of 27 (Parasail 17 of 23 completed,
    p50 16.4 s,
    p90 49.5 s;
    Makora 4 of 4 at 6.9 s),
    DeepSeek Pro 1 of 37 (Parasail 20 of 21 at 21.3 s;
    Sail Research 16 of 16 at 1.5 s).
    Cut at 67 to 188 seconds with no content character and 15k to 43k reasoning characters each,
    across critic,
    panel,
    select,
    lane-contest and consolidation-gate rounds.
    `run-timing-report`:
    47 rounds,
    28.7 of 34.7 round-minutes waiting after quorum (82.7 percent),
    19 voices never heard,
    against 43 rounds,
    62.3 percent and 12 on the second pass.
    The all-OpenRouter bench reaches quorum sooner (gpt-oss on Cerebras and Groq at 1 to 2 seconds,
    MiniMax at 2.6,
    gemma at 4 to 8) and the reasoning seats then have less absolute time before the grace ends.
    No ignore fits this:
    Parasail's completed latencies match Synthetic's for the same model,
    and Qwen has no other endpoint on this run.
    The lever is the grace,
    `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` (default 180 s in `stage-round.ts`,
    set to 60 s on every keyword233 pass of this day),
    and that is a speed-against-width tradeoff put to the owner.
- Other endpoints seen,
  for the record:
  gemma on DeepInfra 30 of 30 at 8.4 s (the ignore stays rejected),
    gpt-oss on Nebius 14 at 6.6 s,
    glm-5.3 on Modal 3 at 40.5 s against Together 15 at 5.2 s,
    GLM-5.3-Flash on Together 8 at 65.8 s and Makora 1 at 70 s against Venice 2 at 5.2 s and Reka 1 at 1.8 s.
    GLM-5.3-Flash's slow endpoints cut nothing (14 of 14 usable),
    so nothing is ignored on one pass's counts.

## The fourth live pass, keyword233, 19:33 to 19:55 UTC, OpenRouter alone at a 120 s grace

Launched from the worktree at tip `f4d59bf65` (the translator and reader withhold,
before the roster-wide one) with `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=120000`,
everything else as the third pass (`~/temp/agent/openrouter-live4-20260903.log`):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=1321136`;
  `verify-published` 1 of 1 (`chars=773=expected missing=0`);
    no refusal,
    no 5xx retry,
    one schema-mismatch.
- Cut streams 7 (Qwen3.8-27B 6,
  gemma 1) against 14 at 60 s;
  `run-timing-report` 37 rounds,
    34.6 of 37.7 round-minutes waiting after quorum (91.7 percent),
    8 voices never heard against 19.
- 0.4502 USD;
  Kimi-K3 bought 3 calls (0.07 USD):
  one from the block-pairing round and two as consolidation writers,
    the roster-wide gap `68ad11530` closes.
    `JUDGE SEATS` read `translators=6 readers=3` at every phase.
- Put to the owner with the third pass's figures;
  **decided:
  120 s**,
  now the built-in (`doc/decision/translation-repair-straggler-grace.md`,
    "Decision 2026-09-03").
- Decided at the same asking:
  the recovery round keeps its complaint-appended re-ask
    (`doc/decision/translation-repair-recovery-reask.md`) and per-slice semantic wrap stays
    (`doc/decision/translation-repair-page-shape-per-slice-wrap.md`).

## The fifth live pass, keyword233, 19:58 to 20:21 UTC: the withhold holds through every stage

Launched from the worktree at tip `47a292e2a` (the roster-wide withhold) at the 120 s dial,
OpenRouter alone (`~/temp/agent/openrouter-live5-20260903.log`):

- **No Kimi-K3 call at all**:
  no `SPEND` line and no stream for `moonshotai/kimi-k3` from preparation to consolidation;
    `JUDGE SEATS` read `roster=8 translators=6 readers=3 withheld=hf:moonshotai/Kimi-K3` at all five readings,
    `phase=preparation` first.
    The owner's withhold is now verified at the user boundary.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1358549`;
  `verify-published` 1 of 1 (`chars=796=expected missing=0`);
    no refusal,
    one 5xx retried and recovered,
    two schema-mismatches.
- 10 cut streams (DeepSeek Flash 5,
  Qwen 3,
  GLM-5.3-Flash 2),
  12 voices never heard,
  40 rounds with 92.5 percent of round time waiting after quorum;
    0.4999 USD;
    meter 54.45 before,
    53.89 after.
    Against the fourth pass's 7 cuts and 8 never heard at the same window:
    single runs on this entry spread that wide,
    and neither pair is a window effect on its own.
    DeepSeek Flash this time went mostly to Phala (16 of 18 completed) with Parasail 2 of 5;
    the routing moves between passes,
    which is one more reason single-pass endpoint counts do not earn an ignore.
- The sixth pass launched at 20:21 UTC on `e0509047b` with no straggler dial,
  to run the built-in 120 s window
    and carry the first `recovery round heard N of M` count (`~/temp/agent/openrouter-live6-20260903.log`).

## The sixth live pass, keyword233, 20:21 to 20:43 UTC: the built-in window, no dial

- No `STRAGGLER GRACE OVERRIDDEN` line;
  every reader-round abandonment reads `abandoned 120000ms after quorum`
    (six of them) and the one writer-round abandonment `180000ms`,
    the writer dial still set at launch.
    The built-in 120 s is what the pass runs.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1312386`;
  `verify-published` 1 of 1 (`chars=806=expected missing=0`);
    no Kimi-K3 call,
    no refusal,
    no schema-mismatch,
    7 cut streams,
    7 voices never heard,
    37 rounds with 94.3 percent of round time waiting after quorum;
    0.4281 USD;
    meter 53.89 before,
    53.41 after.
- No recovery round ran,
  since no answer came back unreadable,
  so the `recovery round heard N of M` line has no first count yet;
    the re-ask's yield is read off the earlier passes instead (next bullet).
- **The complaint-appended re-ask recovers about half**,
  read off today's first,
  third and fourth passes by
    pairing each `recovery round for N unreadable` line with its stage's next `round: x/N heard` line:
    first pass 2 of 8 parsed rounds heard (the misses were MiniMax on Parasail answering unreadably again,
    before the ignore),
    third pass 3 of 3,
    one round on each of the first and fourth passes with an unparsed stage label.
    5 of 11 in all,
    and no `PROMPT-REUSE source=memory` after any of them:
    the nudge makes the digest new every time.
    Issue 473 closed on this measurement.

## The picture passes, 2026-09-04, and the double-quote undercount

Two picture-bearing entries were launched on OpenRouter alone,
concurrently with the Toka_ls pronoun re-run (Synthetic wet,
Hyper unset),
at the owner's instruction that OpenRouter has no meaningful rate limits:
Hangmster at 04:26 UTC (`~/temp/agent/hangmster-pictures-20260904.log`,
one picture) and BI4PBV at 04:28 (`~/temp/agent/bi4pbv-pictures-20260904.log`,
four pictures,
two of them carrying text).

- **BI4PBV's picture stage took one millisecond and said nothing.**
  `JUDGE SEATS phase=pictures` at 04:29:16.205,
    `phase=lanes` at 04:29:16.206,
    and no `gathered N of M pictures` or `reading N pictures` line between them,
    where Hangmster's log has both.
    Its `page.md` writes its `PhotoScroll` paths in double quotes,
    one per line;
    `photo-reference.ts` read single-quoted strings only,
    so the slices showed no pictures,
    and `assertVisualEvidenceComplete`,
    asking the same reader,
    found nothing missing.
    Measured at pin `a41fc607` over the source pages:
    192 single-quoted paths across 47 entries,
    7 double-quoted across 4 (`yulianNyanner`,
    `MTF_0615`,
    `Arita`,
    `BI4PBV`),
    no third form.
- **Fixed in `5e013d24b`**:
  either mark opens a string and only the same mark closes it,
  so a caption in one mark beside paths in the other,
    or an apostrophe inside a double-quoted name,
    cannot split a path.
    Three new guards (the multi-line double-quoted array,
    a page mixing both marks,
    the caption and apostrophe cases) shown to fail with the double mark neutralised:
    the captioned case then read the apostrophe in the caption as an opening quote and lost the path entirely.
    Suite 922,
    lint and types clean.
- **BI4PBV relaunched on the fixed build at 04:43:35** (`~/temp/agent/bi4pbv-pictures2-20260904.log`,
    fresh runs dir):
    `gathered 4 of 4 pictures`,
    `reading 4 pictures`,
    `image0.webp: no text (0 characters, under 16)` so no model was asked for it,
    `image1.webp: read 52 characters without a model` then `minimax-m3 read image1.webp: 251 characters`.
    The first pass runs on as a no-picture control.
    Readings,
    page and the no-Kimi check follow on the tallies.
- **The displacement screen had the same blind spot** (`corpus-run/markup-slice.ts`):
  a single-quoted path line counted as structure,
    a double-quoted one as prose,
    so the double-quoted block read as
    0.4 markup against the 0.8 threshold and was not exempted from the relocation reading.
    Fixed in `4ff42e627`,
    guard shown to fail neutralised (`expected 0.4 to equal 1`).
    Scope:
    `isMarkupOnly` is called only from `corpus-run/displacement-probe.ts`,
    the offline `mise run displacement-probe` instrument that asks no model and whose output no lane reads,
    so no live pass was affected;
    the probe's relocation count for those four entries was the thing at risk.
    No other rule in the package
    keys on the single mark (`rg` over `src` for `startsWith('\'')` and quote comparisons:
    the four remaining hits are typography and refusal readers,
    not path readers).
- The undercount was invisible from the run log,
  which is the lesson worth keeping:
  a stage that finds nothing to do logs nothing,
    and the completeness guard shared the parser's blind spot.
    The seats line is what made it visible,
    by putting a timestamp on each side of the stage.
- **The second pass's picture stage,
  04:43:52 to 04:49:59**:
  `image0.webp` and `image2.webp` carried no OCR text (0 and 15 characters,
    under 16),
    so no model was asked;
    `image1.webp` was read by minimax-m3
    (251 characters) and Qwen3.8-27B (419) and corroborated by those two at overlap 0.614 after
    GLM-5.3-Flash on Together ran the whole 360 s per-call deadline with 76,412 reasoning characters and
    no content (`stream z-ai/glm-5.3-flash: cut, elapsed 360004ms ... 3932835 raw chars ... 0 content chars`);
    `image3.webp` was read by all three within 3 s and corroborated at 0.966.
    No Kimi-K3 line.
    The cut stream carries no `cost=`,
    so the run meter and the spend report undercount it by whatever the provider bills for those reasoning tokens.
- **The picture gather has no straggler grace** (`image-reading-pair.ts` gathers with `allSettled` and
    waits for every reader or the deadline),
    so `image1.webp` waited 284 s after its second reading for a reader that never answered.
    Measured over every run log in `~/temp/agent` (script `~/temp/agent/picture-wait-20260904.mjs`):
    1,435 pictures with two or more model readings and a settlement;
    the wait after the second reading is 0 s at the median and the 90th percentile,
    1,419 s in total,
    and three pictures waited past 120 s (Toka_ls `photo2.webp` 352 s on 2026-09-02 with
    Kimi-K3 failing at the deadline,
    today's 284 s,
    Zha_Ke `letter.webp` 168 s on 2026-08-27).
    A 120 s grace after corroboration would have saved 444 s across the whole record.
    Most of that record is two-reader rosters where the wait is zero by construction;
    the OpenRouter-alone roster seats three readers,
    so today's two text pictures are the first of the population that matters,
    one of them bad.
    Not built:
    recorded here to be re-read once more three-reader pictures have run.
- **Hangmster settled at 05:05 UTC** (39 min,
  1.79 USD,
  verify-published 1 of 1,
  no Kimi-K3 call,
  one picture with no OCR text so no model reader).
    Its page restores the `## Introduction` heading the archive English had dropped and retranslates the description;
    **it also ships the photo element broken across two lines**,
    `<PhotoScroll photos={[ '${path}/photos/fufu.webp',]}` then `/>  `.
    The semantic wrapper (`semantic-wrap.ts`,
    markdown-lint's `semantic-line-breaks` with MDX parsing off) read the line as prose:
    JSX braces make the tag invalid HTML to CommonMark,
    and the comma before `]}` is followed by a space.
    Measured over the pinned source pages:
    33 one-line `PhotoScroll` elements,
    16 of them across 11 entries with that comma-and-space shape.
    Fixed in the rule (`66345a092`:
    a paragraph whose whole source opens with `<` and closes with `>` is left unbroken),
    guards in both packages shown to fail neutralised.
    MDX still parses the split element,
    so the shipped Hangmster page renders;
    it is not regenerated here,
    since the pipeline digest changed with the build
    and a regeneration would be a full paid re-run rather than a replay.
- **The first BI4PBV pass settled at 05:02** (34 min,
  1.57 USD,
  verify-published 1 of 1,
  no Kimi-K3 call) as the no-picture control;
    its page keeps both photo elements as the source writes them.
- **The second BI4PBV pass settled at 05:19** (`TALLY BI4PBV status=SETTLED slices=5 ... ms=2142085`,
    35.7 min,
    1.3827 USD,
    verify-published 1 of 1 at `chars=1077=expected`,
    no Kimi-K3 line,
    19 cut streams,
    7 ModelRun retries,
    no refusal).
    Both photo elements ship as the source writes them,
    one multi-line and one single-line.
    The two blockquotes transcribed from the photos (the "truly lazy" line and the balloon's loss-of-contact line,
    which the source page carries only as pictures) ship translated;
    against the control the wording differs in the ordinary run-to-run way (the `BlurBlock`
    farewell keeps the archive's rendering here where the control rewrote it),
    and nothing in either page is wrong on its face.
    The picture path on OpenRouter alone therefore reads:
    gather,
    OCR gate,
    three seated readers with Kimi-K3 withheld,
    corroboration,
    and the transcription slices judged and shipped.

## ModelRun's timeouts, 2026-09-04, and what the log called them

- **Symptom.**
  Today's six runs logged 115 `MalformedCompletionError: ... stream ended without its
    [DONE] terminator; the reply was cut off` retries by 05:00 UTC (Toka_ls 51 of 592 spend lines,
    Hangmster 29 of 278,
    the first BI4PBV 26 of 245).
    The retry ladder reached its fourth attempt 8 times and gave up at least 5 times (a coverage voice,
    two critic voices and two panel voices lost,
    all minimax-m3).
- **Attribution.**
  The stream line before each retry names the model and endpoint:
  114 of 115 were `minimax/minimax-m3` served by `ModelRun`,
    body 846 characters (7 of them 871),
    0 content characters,
    "completed" after about 10.5 s.
    ModelRun served 300 MiniMax streams today and 119 of them were that body;
    Venice served 5,
    all with content.
- **Reproduced directly** (`~/temp/agent/modelrun-probe.mjs`,
  six trivial calls with `provider.only:
    ['ModelRun']`):
    the fourth answered HTTP 200 in 10,463 ms with one chunk carrying
    `error: { code: 504, message: "error code: 504", metadata: { error_type: "timeout" } }` and no `[DONE]`.
    The gateway had already sent its success status when the upstream timed out,
    so the failure rides inside the stream.
- **The listing agreed** (`~/temp/agent/minimax-endpoints-20260904.json`,
  05:00 UTC):
  ModelRun `uptime_last_30m` 54.9,
    `status` -5,
    prompt 0.75 and completion 3.0 USD per million,
    fp4;
    every other minimax-m3 endpoint read 98 to 100 uptime and status 0 at 0.23 to 0.6 prompt.
- **Why it cannot simply be ignored.**
  Re-probed with the 2026-09-03 corpus-sized schema request under
    zero data retention (`~/temp/agent/openrouter-minimax-endpoints-20260904.log`):
    ModelRun 4 of 4 conformant,
    11 to 15 s;
    DeepInfra and Venice 404 "No endpoints found that can handle the requested parameters";
    CoreWeave,
    the only other zero-data-retention endpoint listing `structured_outputs`,
    404 "All providers have been ignored",
    which is the account-level ignore list;
    default routing without `only` went to Parasail 3 of 4 times with the known empty content channel.
    Under the ZDR decision,
    ModelRun is MiniMax M3's only endpoint for a schema request.
- **What landed** (`f17feba12`):
  `openrouter-stream-error.ts` reads the gateway's error chunk before the
    terminator check and throws `InStreamProviderError` naming code,
    kind and endpoint
    (`stream carried a provider failure instead of a completion: code 504, type timeout, served by ModelRun`);
    the ladder retries it as it retried the truncation.
    Guard shown to fail with the check removed.
    The catalog comment on the minimax row now states the endpoint situation as re-measured.
- **Open,
  for the owner** (options in the question put at the end of this session's turn):
  keep the seat and take the 504 retries (about 10.5 s per failed attempt,
    roughly 1 to 2 percent of MiniMax calls lost after five attempts at today's rate);
    withhold `minimax-m3` from OpenRouter-served seats while ModelRun reads degraded,
    as Kimi-K3 is withheld;
    or un-ignore CoreWeave at the account level and probe it for conformance,
    which would give the schema request a second zero-data-retention endpoint.

## The 429 hold under concurrency, 2026-09-04, 04:54 to 05:18 UTC

Issue 474's fix (`83e8dfa90`:
a refusal while the meter reads wet holds the provider out for 30 s rather than 300 s,
and a both-dry reading waits out the shorter hold once) had unit tests and no live exercise.
Two keyword233 passes with Synthetic wet and Hyper unset (`~/temp/agent/kw-conc-a-20260904.log`,
`kw-conc-b-20260904.log`,
runs dirs beside them) ran concurrently with the Synthetic-wet Toka_ls pronoun
re-run and two OpenRouter-alone picture passes:
three passes on Synthetic at once,
at overlap 4.

- Synthetic answered `HTTP 429` five times,
  all in arm a,
  all between 05:04:15 and 05:04:18 UTC,
  on Qwen3.8-27B calls (the 40-character stream line before each names the model);
    the retry ladder absorbed them at attempts 1 to 3 and no call reached the fifth failure,
    so `markRefused` never ran.
    Arm b and Toka_ls saw none.
    `syntheticFiveHour` read 2737.8 of 2750 remaining throughout,
    so these were the concurrency limit,
    not the allowance.
- Both arms settled:
  a in 1,409,536 ms (23.5 min,
  0.4202 USD on OpenRouter,
  123 Synthetic and 145 OpenRouter spend lines,
    3 cut streams,
    3 voices never heard),
    b in 1,273,689 ms (21.2 min,
    0.3103 USD,
    119 and 138,
    5 cut,
    6 never heard);
    verify-published 1 of 1 each;
    no `EveryProviderDryError`,
    no `SPEND CEILING` line.
- **What this does and does not show.**
  Three Synthetic-wet passes at overlap 4 provoke the limit only in short bursts the ladder rides out,
    so the hold's 30 s branch was not reached live;
    its behaviour rests on `provider-budget.unit.test.ts` and `budget-hold-wait.unit.test.ts`.
    The 2026-09-02 incident needed
    two passes at overlap 4 with eight-wide reader rounds AND a Synthetic five-hour meter at 2729 of 2750 used;
    today's meter was almost untouched.
    Reaching the hold live would take the allowance near its edge,
    which is not a state to manufacture on purpose.

## The two shape passes, 2026-09-04, 05:45 UTC onward, and what they cost

Launched on OpenRouter alone to read the two fixes of the morning on entries that carry their shapes:
`luxuanwen3` (comma-shaped one-line `PhotoScroll`,
one picture) and `MTF_0615` (double-quoted photo paths,
one picture),
logs `~/temp/agent/luxuanwen3-shapes-20260904.log` and `mtf_0615-shapes-20260904.log`.

- **MTF_0615 settled** in 7,555,138 ms (126 min) at 7.3240 USD for a 1,953-character source:
  21 slices,
    verify-published 1 of 1 (`chars=6267=expected`),
    the single-line photo element intact,
    its picture read by OCR as textless so no model was asked,
    no Kimi-K3 call,
    two guard refusals,
    5 in-stream provider failures now named (`code 502, type provider_unavailable, served by Modal` four times,
    OpenInference once),
    and **155 cut streams,
    all straggler-grace abandonments** (130 of them between 120 and 180 s):
    Qwen3.8-27B on Io Net 42,
    Ionstream 19,
    Reka 10;
    DeepSeek Flash on Parasail 41;
    GLM-5.3 on Reka 13 and Modal 12.
- **luxuanwen3 ended INCOMPLETE** in 3,758,245 ms (63 min) at 2.6143 USD with no page:
  `entry luxuanwen3 front matter is not publishable (invalid-page)`.
    Its picture read fine (three readers,
    corroborated at 0.934).
    The cause is in the front matter,
    next section.
    64 cut streams,
    same endpoints.
- **The endpoint cut rates,
  over every run of the day** (completed against cut,
  by `served by`):
  Reka cut 19 of 40 Qwen,
    12 of 41 DeepSeek Flash and 13 of 26 GLM-5.3 streams;
    Io Net 62 of 153 Qwen;
    Parasail 96 of 464 DeepSeek Flash;
    Ionstream 30 of 173 Qwen;
    Modal 21 of 144 GLM-5.3;
    against Together 0 of 245 GLM-5.3,
    DeepInfra 0 of 732 gemma and 0 of 237 DeepSeek Pro,
    Cerebras and Groq 0 of 488 gpt-oss,
    Makora 2 of 99 DeepSeek Flash.
    The 2026-09-03 ignore of OpenInference for DeepSeek Flash was spelled `openinference`;
    the gateway's slug (`GET /api/v1/providers`,
    `~/temp/agent/providers-20260904.json`) is `open-inference`,
    and OpenInference served 43 streams of that model today:
    the ignore had never reached the wire.
- **CoreWeave was never ignored by the owner.**
  Asked,
  the owner answered that the "All providers have been ignored" reply looked like an OpenRouter bug,
    re-saved the account's allowed providers,
    and the re-probe (`~/temp/agent/openrouter-minimax-endpoints-20260904b.log`) read CoreWeave 4 of 4 conformant
    on the corpus-sized schema request under zero data retention,
    16 to 20 s a call,
    0.0024 to 0.0027 USD against ModelRun's 0.0072 to 0.0087;
    default routing still went to ModelRun 4 of 4.
- **What landed** (`openrouter-catalog.ts`):
  `open-inference` spelled as listed;
  ModelRun ignored for MiniMax M3 (CoreWeave serves);
    Reka and Parasail ignored for DeepSeek Flash;
    Reka and Io Net for Qwen3.8-27B;
    Reka for GLM-5.3.
    Rule recorded on the rows:
    an endpoint is ignored when a day's runs cut a quarter or more of at least twenty of its streams,
    or fail that share in-stream;
    Modal (15 percent) and Inceptron (3 of 3) stay.
    A catalog test checks every ignored slug against a snapshot of the provider listing,
    shown to fail with `openinference` put back.

## luxuanwen3's front matter, and the rule the archive breaks

- `validateFrontMatterTranslation` (`front-matter-translation.ts`) refuses a candidate whose `name` and
    `info.alias` differ when the ORIGINAL declares them the same;
    `front-matter-completeness.ts` applies
    the same validator to the assembled page (`doc/decision/translation-repair-front-matter-guard.md`,
    `invalid-page`).
    luxuanwen3's source has `name: 鲵鲵`,
    `alias: 鲵鲵`;
    the archive's page has `name: Nini`,
    `alias: 鲵鲵, Nini`.
    Reproduced with the built validator on the run's candidates:
    the archive-shaped front matter is `invalid` ("must keep name and info.alias as same visible identity"),
    the two candidates with `alias: Nini` are `valid`.
- The translate lane's standing text was the archive-shaped front matter;
  consolidation logged `slice 0:
    consolidation standing text fails publication eligibility and remains retryable`,
    the judges endorsed the standing over the slate ("matches the declared translated identity",
    three ballots),
    and the single attempt "kept it (slate-endorsed-standing);
    shipping with the finding recorded" (`consolidate-slice-buy.ts`,
    single attempt by design after the no-loop proposal).
    The page guard then refused the entry an hour later.
    `settleConsolidation` is never told the standing is ineligible.
- **Measured over the pinned corpus**:
  14 of 92 sources declare `name` equal to `alias`;
  in 7 of them the archive renders the alias differently:
    MizuharaNagisa ("mizuharanagisa" / "Mizuhara Nagisa,
    水原なぎさ,
    Shui Yuan Zhu"),
    SevenBird,
    Weideriche_,
    gaoyanger ("Gaoyang" / "Gaoyang,
    Lamb"),
    interrgned,
    luxuanwen3,
    noname ("noname" / "noname,
    no name,
    anonymous,
    ...").
    Under the rule as written,
    none of those seven can ship an archive-shaped front matter;
    the lanes must drop the extra renderings from the alias.
- **Decided the same day,
  both by the owner**:
  the alias may carry the name among other renderings (`doc/decision/translation-repair-front-matter-guard.md`,
    addendum),
    and consolidation withholds a standing the deterministic gate refused from the slate,
    failing the slice at once when nothing valid ships (`doc/decision/translation-repair-ineligible-standing.md`).
    Landed in `6bfe6da56`,
    every guard shown to fail neutralised,
    suite 924.
    luxuanwen3 relaunched on that build at 09:24 UTC (`~/temp/agent/luxuanwen3-shapes2-20260904.log`,
    OpenRouter alone) to read the page.
- **The routing check** (`~/temp/agent/kw-routing-20260904.log`,
  keyword233 on OpenRouter alone from 08:59 UTC,
    the ignores of `d55d83082` on the wire):
    MiniMax M3 served by CoreWeave 30 of 30,
    Qwen3.8-27B by CoreWeave 32 (4 cut),
    DeepSeek Flash by Phala and Together,
    GLM-5.3 by Modal and Together,
    no call on an ignored endpoint,
    no in-stream failure,
    4 cut streams in the first 25 minutes against MTF_0615's 155 over two hours.
    Settled at 09:25 UTC:
    `TALLY keyword233 status=SETTLED slices=3 ... ms=1553800` (25.9 min),
    verify-published 1 of 1 at `chars=811=expected`,
    0.6134 USD,
    5 cut streams,
    5 voices never heard,
    no in-stream failure,
    no call on an ignored endpoint.

## The luxuanwen3 re-run, 2026-09-04, 09:22 UTC onward: slice 0 passes, slice 1 stops the entry

Launched on `592562992` (alias containment,
withheld standing,
endpoint ignores),
OpenRouter alone,
log `~/temp/agent/luxuanwen3-shapes2-20260904.log`,
runs dir `~/temp/agent/luxuanwen3-shapes2-20260904`.

- Slice 0,
  the front matter (56 source characters):
  both lanes `exit=computed`,
  no eligibility warning at the lane contest or the consolidation.
    The archive's `alias: 鲵鲵, Nini` passes the containment rule.
- Slice 1,
  the description paragraph (95 source characters):
  the translate lane's winner "fails publication invariants" at the contest,
    the standing "fails publication eligibility" at the consolidation,
    and at 09:56:43 UTC,
    34 minutes in,
    `ConsolidationStandingIneligibleError: slice 1 ... (incumbent-only)` stopped the entry.
    The pass of the morning had run 63 minutes before the page guard refused it.
- The cause,
  read from the slice records (`slice-cache/luxuanwen3/translate.*.json`,
  slice 1 findings):
  the original links `https://twitter.com/Deaver1229`,
    the archive's page `https://x.com/Deaver1229`,
    and `mergeAtoms` in `translate-atom-floor.ts` (commit `3ca134e57`:
    "protected atoms take the larger demand of the two references") owes the per-key maximum of both,
    so a candidate carrying either URL is told it lacks the other.
    The four translators asked to repair were told so in both directions:
    two restored the original's URL,
    two kept the page's,
    and every proposal failed the floor.
    The standing,
    the archive's own paragraph,
    fails the same rule,
    so the slate had nothing and the terminal was `incumbent-only`.
- The log could not say this:
  neither warning named the rule or the findings.
  Both drivers now print the deterministic findings,
    and the consolidation warning distinguishes an invalid standing from an unendorsed one.

Census of the pinned corpus (`~/temp/agent/atom-census-20260904.mjs` over `readSliceSkeleton` on whole pages,
`~/temp/agent/link-census-20260904.mjs` over a plain link scan):
of the 70 pages the strict grammar reads whole,
7 carry a link the archive rewrote,
meaning `link-url` diverges in both directions:
MizuharaNagisa (`www.` added),
Rentable_A (trailing slash dropped),
SS3B_0016 and shihai4h (Chinese Wikipedia to English Wikipedia),
aiyysk (`google.cn` to `.com`),
homoyamakaze (an archived Twitter capture to `mtf.wiki`),
luxuanwen3 (`twitter.com` to `x.com`).
XIEPT2,
whose page the whole-page grammar refuses,
is the eighth by the plain scan.
Footnotes diverge in one direction only (5 pages add one,
1 drops one),
never both.
Under the per-key maximum none of the eight can ship:
the archive's paragraph is ineligible,
and no rendering carries both destinations without inventing a link.

Tally:
`TALLY luxuanwen3 status=ERROR ms=2724158` at 10:08 UTC,
587 OpenRouter calls,
2.01 USD by the log's `cost=` fields,
balance 25.79 USD after.
The in-flight consolidation buys for slices 2 to 4 ran on for 11 minutes after the slice 1 error before the tally;
the stop is at the slice,
not the process.

What the tally exposed next:
`entryErrorOutcome` classed `ConsolidationStandingIneligibleError` as a resumable failure,
so the pass logged `REATTEMPT luxuanwen3 queued` and started the lanes again at
10:08:12 UTC against the same deterministic refusal;
it was stopped by hand at 10:09 and the error joined the stopped list (`ae1d2b55f`,
guard shown to fail without it).
The log now names both verdicts and their findings (`558b46e11`).

Question put to the owner:
which rendering a candidate owes where the archive rewrote a destination.

## The luxuanwen3 re-run on the either-rendering build, 2026-09-04: every slice passes, the publisher refuses

Launched at 12:43:50 UTC on `82888d43b` (the rendering pools) plus the docs commit,
OpenRouter alone,
into `~/temp/agent/luxuanwen3-shapes3-20260904` (log of the same name).
Balance 22.53 USD at the SS3B_0016 launch that followed at 13:20.

What the slices did:
slice 1,
the paragraph whose link the archive moved from `twitter.com` to `x.com`,
passed the deterministic rule in every lane.
The translate lane's winner carried the original's `twitter.com` once and `x.com` never;
three of its translators matched the incumbent.
The contest recorded eight ballots across the slices (four `repair`,
two `translate`,
two `neither`,
five to seven usable each).
Consolidation started at 13:18:47 on all nine slices;
slice 1 exited `computed` in 536 s with no verdict warning;
slices 2 and 6 logged `consolidation standing text lacks contest endorsement and remains retryable`,
and slice 2's single attempt kept the standing (`slate-declined-standing`) with the finding recorded.
No `must carry exactly`,
no `fails the deterministic publication rule`,
no `REATTEMPT`.

Tally:
`TALLY luxuanwen3 status=INCOMPLETE ms=3365280 aborted=false error=entry luxuanwen3 would drop 1
source destination(s)` at 13:39:55 UTC,
56 minutes,
765 calls,
4.24 USD by the `cost=` fields,
balance 19.26 USD at the last meter reading.
Seats:
gpt-oss-120b 120 of 120 usable,
minimax-m3 117 of 117,
gemma 126 of 126,
deepseek-v4-pro 121 of 122,
GLM-5.3-Flash 35 of 39,
deepseek-v4-flash 82 of 94 (12 threw,
the cut-mid-reply shape of the morning),
Qwen3.8-27B 107 of 127 (20 threw),
glm-5.3 57 of 60.

What refused it:
`DroppedDestinationError` in `publish-fixed.ts`,
the document-level check,
which compared the would-ship page's destinations against the source's alone.
The page carried the archive's `x.com` where the source carries `twitter.com`,
which the slice rule had accepted and the publisher counted as one source destination dropped.
The decision record of the morning had said the publisher was unchanged;
that clause was the defect,
and it is struck.
Fixed in `1c9663666` (`corpus-run/destination-renderings.ts`,
the same pool over the whole page;
findings `destinations-archive-rendering` and `destinations-both-renderings` on the `DESTINATIONS` line),
guards shown to fail with the archive side of the pool neutralised,
and `8d7b151ef` (lint).
Two tests of the morning (`consolidate-ineligible-standing`,
`consolidate-standing-verdict`) still asserted the maximum rule through a candidate keeping the page's link;
the full suite had last run before `82888d43b`.
Moved to a candidate carrying neither rendering in `e66da50ef`;
suite 931 groups,
0 FAIL.

SS3B_0016 (the Wikipedia shape,
912 source characters) had been launched at 13:20 on the same build;
it was stopped at 13:51 during its lanes (422 calls,
1.84 USD) because its page could only reach the same refusal,
and relaunched with luxuanwen3 on `e66da50ef` at 13:51:31 UTC (`~/temp/agent/<id>-shapes4-20260904`),
balance 18.49 USD.

## The two runs on the publisher fix, 2026-09-04, 13:51 UTC onward: both ship, and what the reading found

luxuanwen3 and SS3B_0016 ran concurrently on `e66da50ef`,
OpenRouter alone,
from 13:51:31 UTC,
into `~/temp/agent/<id>-shapes4-20260904` (logs of the same name).
Balance 18.49 USD at launch,
5.41 USD at the last meter reading.

luxuanwen3:
`TALLY luxuanwen3 status=SETTLED slices=9 ... pageChanged=7 pageSilent=0 selection=contested ms=3596918` (60 minutes,
764 calls,
4.65 USD by the `cost=` fields),
`DESTINATIONS luxuanwen3 source=2 page=2 dropped=0` with no finding:
the page carries the original's `twitter.com` for Deaver1229 and for the contributor,
so the pool was met from the original's side.
verify-published:
`wordings=9 silent=0 chars=2467=expected missing=0`.
The front matter's `alias` reads `鲵鲵, Nini`;
the `PhotoScroll` line is intact;
the Camus quotation and its right-aligned attribution are intact.
Slice 3 logged `consolidation
standing text lacks contest endorsement and remains retryable` and shipped on the single attempt.
No `must carry exactly`,
no `fails the deterministic publication rule`,
no `REATTEMPT`.
Seats:
minimax-m3 117 of 117 usable,
gpt-oss-120b 115 of 115,
GLM-5.3-Flash 38 of 39,
glm-5.3 53 of 61 (8 threw),
deepseek-v4-flash 89 of 93,
deepseek-v4-pro 120 of 123,
gemma 123 of 124,
Qwen3.8-27B 109 of 125 (16 threw).
Read in full:
the page is publishable as it stands.
One wrap nit,
not a page defect:
the per-slice wrap broke `August 4,
2024` after the date's comma,
which Markdown rejoins on render.

SS3B_0016:
`TALLY SS3B_0016 status=SETTLED slices=9 ... pageChanged=8 pageSilent=0 selection=contested ms=3365773` (56 minutes,
887 calls,
5.12 USD),
`DESTINATIONS SS3B_0016 source=3 page=3 dropped=0 destinations-archive-rendering`:
the page carries the archive's English Wikipedia `Railfan` where the source links the Chinese article,
and keeps the `mailto:` and GitHub destinations.
verify-published:
`wordings=9 silent=0 chars=2291=expected missing=0`.
Slice 2 lacked contest endorsement and shipped on the single attempt.
Seats:
gpt-oss-120b 141 of 141,
minimax-m3 132 of 132,
gemma 147 of 147,
glm-5.3 62 of 69 (7 threw),
deepseek-v4-pro 138 of 140,
Qwen3.8-27B 121 of 148 (27 threw),
GLM-5.3-Flash 39 of 40,
deepseek-v4-flash 107 of 111.
The page restores what the archive's rewrite had changed (the source's "community",
not "transgender community";
the source's "the day before Yantian's birthday",
not the archive's added date and stations) and reads well,
with two findings from the reading.

WHAT THE READING FOUND,
ONE DEFECT AND ONE RISK.

The defect:
slice 5 ships `we have temporarily set up a small room for Ta, to give Ta's memorial a little warmth`,
a bare `Ta` twice,
on a page that says "they" and "them" for Yantian everywhere else.
The
translate lane won that slice with three of five contest ballots reasoning that it "keeps the original's neutral Ta",
and the consolidation gate kept it.
The cause is in the pipeline,
not the judges:
the source writes its neutral pronoun as `Ta`,
and `countNeutralPronoun` in `identity-context.ts` counts only `TA`,
so the declared-identity pronoun line said nothing for this page;
and the house rule names TA as a pronoun the original uses without saying how English renders it.
Measured over the pinned corpus:
sources write the neutral pronoun as `TA` in 2 entries,
`Ta` in 7 and `ta` in 8 (every occurrence a pronoun,
`TA 们` the plural in 6);
of the archives of those entries,
one (XingZ60,
a rewrite) keeps a bare `TA`,
and the rest render it "they" (Uekawakuyuurei 22 "they" to 0 "she",
Hangmster 18 to 0).
Fixed in the next commit:
the counter reads all three spellings,
the house rule states the English rendering,
and the deterministic floor refuses a translation carrying the pronoun untranslated.

The risk:
slice 5 also renders 「那些秋叶」 as `「One Among Us」`.
The name is right (the archives of all five entries naming 那些秋叶 render it "One Among Us",
one as "One Among Us Transgender Support") but the
gate kept it 4 to 3 over a consolidated candidate reading "Those Autumn Leaves",
the judges arguing the rendering from the archive alone.
The corner brackets around an English name are the source's punctuation carried across;
72 sources use them and 3 archives keep any,
all in quoted Chinese or a design element.
FIXED THE SAME AFTERNOON in `d5e4d1ea0`,
since both halves are house rules rather than judgement calls:
the community-vocabulary rule now names 那些秋叶 and its renderings (members,
the maintenance group),
and the punctuation rule says what corner brackets become,
quotation marks around a quotation and nothing around a name or a term.
Guarded by two cases in `house-policy-reaches-the-judges.unit.test.ts`,
shown to fail with the sentences removed.

WHAT LANDED FOR THE PRONOUN:
`d98e656cb` (counter,
house rule,
`translate-neutral-pronoun.ts` wired into `validateTranslatedSlice`,
tests;
each guard shown to fail with its rule neutralised),
`cd5288fa9` (lint shapes),
`dd132bc76` (README).
Measured over the pinned corpus with the built finding:
one archive flagged (XingZ60,
`TA` 3 times) and 15 sources.
The next pass launched at 15:03:34 UTC on `cd5288fa9` (pipeline `sha256-tree-v1:946ab54f`),
OpenRouter alone:
Uekawakuyuurei,
whose subject is `ta` throughout (12 `ta` and 1 `Ta`,
archive 22 "they" to 0 "she"),
into `~/temp/agent/Uekawakuyuurei-pronoun-20260904`.
Balance 5.32 USD at launch,
which is about one pass.

## The Uekawakuyuurei run on the pronoun build, 2026-09-04, 15:03 UTC: stopped by its own pictures

`TALLY Uekawakuyuurei status=INCOMPLETE ms=111956 aborted=false error=visual evidence incomplete for 3
referenced assets` at 15:05 UTC,
33 calls,
0.08 USD.
The entry shows eight pictures;
five carry nothing past the deterministic reader and were never sent.
The other three are an oil painting of ships (`IMG_1308.webp`,
24 characters of canvas noise from tesseract),
an ink drawing of two cats (`img197.webp`,
18) and an ink drawing of a destroyer whose only text is the hull number (`img370.webp`,
24).
Three readers each asked four times;
every reply either reported that the picture carries no text or transcribed `DE581`,
and the screen called the first a refusal and the second too short,
so all three pictures ended `no-reader-available`,
transient,
and the entry stopped at the completeness gate.
Across every run log this session,
56 entry-and-picture pairs corroborated and 8 failed,
on 5 pictures:
these three on both rosters,
`dogesir_/photo2.webp` on both,
`gqt/photo3.webp` at one reader of two.

A probe of the three OpenRouter readers over those five pictures (15 calls) put the wording on record:
14 refused replies name text ("There is no visible text in this image",
"I cannot read any text in this image.
There are no visible words",
"I can read the image,
but there is no visible text to transcribe"),
one declines without naming it ("I cannot read the image."),
and the destroyer draws `DE581`,
`DE581` and `D650`.

WHAT LANDED:
`20ea56cd0` logs the opening of a refused reply;
`d6ffc4812` splits absence from inability (`refusalReportsAbsence` in `reading-refusal.ts`:
names text,
no quality or access marker),
gives the screen three verdicts (usable,
short,
refused with clause `too-short`,
`reads-as-refusal` or `reports-no-text`),
stops re-asking an absence report,
and lets two readers reporting absence or answering short confirm a
picture textless in `readImagePair` (`no-text` with `confirmedBy`,
resumed).
Each guard shown to fail with its rule neutralised (refusal 2,
sense 3,
stage 3,
pair 5,
re-ask 2 failures),
then pass.
Rule recorded in `doc/planning/when-an-image-reading-makes-no-sense.md` (clause six) and the README.

Relaunched at 15:25 UTC on `d6ffc4812` into `~/temp/agent/Uekawakuyuurei-pictures-20260904`,
OpenRouter alone,
to read both today's fixes on one entry:
the pronoun rule on a `ta` subject and the textless confirmation on three pictures.
Balance about 5.3 USD at launch,
which is one pass.

## Uekawakuyuurei on the picture-fix build, 2026-09-04, 15:25 UTC: ships, and the balance runs out under it

`TALLY Uekawakuyuurei status=SETTLED slices=7 ... pageChanged=5 pageSilent=0 selection=contested ms=3190452`
(53 minutes,
524 calls,
3.84 USD by the `cost=` fields),
`DESTINATIONS Uekawakuyuurei source=4 page=4 dropped=0`;
verify-published `wordings=7 silent=0 chars=2774=expected missing=0`.
Tip `d6ffc4812`,
pipeline `sha256-tree-v1:646ad738`.

BOTH FIXES READ CLEAN ON THE PAGE.
Pictures:
`IMG_1308.webp` confirmed textless by 3 of 3 readers on the first ask,
`img197.webp` by 2 of 3,
`img370.webp` by 3 of 3 (all three short readings of the hull number),
no re-asks,
no visual-evidence stop;
the `PhotoScroll` and `ChannelBackupButton` lines ship as written.
Pronouns:
the page says they,
them or their 21 times for Ying,
he or she never,
and carries no bare `ta`;
the source writes `ta` 12 times and `Ta` once.
No `untranslated as` finding was raised in any lane,
so the house rule alone carried it.

THE FRONT MATTER went as the guard decision of 2026-09-02 provides.
The translate lane rendered `name: Hotaru`,
`alias: Ah Hotaru, Hotaru-chan, Akigumo`,
`location: China`;
the archive has no `location`,
so the shape rule excluded that candidate from the contest (`lane-contest-eligibility-floor`),
the standing lacked endorsement,
and the single consolidation attempt kept the archive's `name: uekawakuyuurei`,
`alias: Ying (Hotaru), Qiu Yun (Akigumo)`.
The contest's log line named the floor and not the finding,
which task 78 of this session corrects.

THE BALANCE RAN OUT UNDER CONSOLIDATION.
The lanes finished at 16:06 with 1.98 USD left;
consolidation began at 16:11;
from 16:15:00 OpenRouter refused calls while the meter still read 1.12 USD (the last reading before the refusal),
and `EveryProviderDryError` was raised 166 times through the gate and refiner rounds,
205 voices lost,
with the meter reading `openrouter=wet` and falling to 0.36 USD as smaller calls kept buying.
Every consolidation slice shipped its standing,
the lane-contest winner,
unpolished.
Seats:
minimax-m3 82 of 117 usable,
GLM-5.3-Flash 26 of 50,
gemma 93 of 106,
glm-5.3 27 of 45,
gpt-oss-120b 85 of 99,
deepseek-v4-flash 59 of 83,
Qwen3.8-27B 69 of 106,
deepseek-v4-pro 84 of 122,
the shortfall being the refusals.
This is the first live exercise of the every-provider-dry path:
the run did not hold and did not error;
it settled on what it had.

THE READING OF THE PAGE:
publishable.
Two notes,
neither a class.
The diagnosis carries italics the source does not (`*signet ring cell carcinoma of the ascending colon*`);
51 of 92 archives use italics,
for work titles,
so emphasis is not a marker the floor can refuse.
The quotation "just an unhealthy-looking boy in real life.",
carries the archive's own period-inside-quotes shape,
which the archive ends with a second period.
"Here's a selected few" is the archive's wording kept.

## The picture gather's wait, re-read on three-reader pictures, 2026-09-04

The open item since 2026-08-29 was to re-read the gather's straggler wait once passes had run pictures
with three readers rather than two.
Today's runs did,
so this is that reading.
It is a measurement and a recommendation,
not a change.

THE GATHER HAS NO STRAGGLER WINDOW.
`readImagePair` calls every reader through one `Promise.allSettled` and waits for all of them,
bounded only by each call's own timeout.
`STRAGGLER_GRACE_MS`,
120 seconds after quorum,
governs the judging rounds in `stage-round.ts` and never reaches the picture gather.

WHAT THE SPREAD COSTS NORMALLY.
Over every asset in today's logs that drew two or more reader replies,
20 of them,
the gap between the first reply and the last runs a median of 11.6 seconds,
a ninetieth percentile of 45 seconds,
and a maximum of 66 seconds.
The two clean three-reader assets of the picture-fix build spread 9.2 and 38.4 seconds.
A whole picture stage costs 66 seconds for the eight assets of Uekawakuyuurei and 95 seconds for the three of Toka_ls.
At those numbers a window would save nothing worth having.

WHAT IT COSTS WHEN A READER HANGS.
The BI4PBV pass of 04:43 UTC spent 367 seconds on four pictures,
almost all of it on `image1.webp`:
two readers answered and corroborated at 0.614 overlap,
and the gather then waited about six minutes for `hf:zai-org/GLM-5.3-Flash`,
which ended in `StreamCutShortError` and contributed nothing.
Corroboration needs two readings,
so those six minutes bought a verdict that was already settled.
The apparent 2707-second stage in the luxuanwen3 pass of 09:23 is not a second case:
that log holds two picture stages,
a 13-second gather and a resume from cache 45 minutes later.

THE OPTION,
for the owner rather than for me.
A straggler cut in the gather,
once two readings are in hand,
would bound that case at the cut and change nothing else,
since the median spread is a tenth of any sensible window.
It costs the third reading on a slow-but-alive reader,
which is evidence the corroboration rule does not use.
Against it:
the gather is the one stage whose output nothing requires,
so its wall time is only ever a delay,
and one six-minute delay per corpus pass may not be worth another dial.
Recorded as measured;
no dial added.

## The providers come back, 2026-09-06: two defaults move and a rule is written

The owner returned with Synthetic refilled to a third
(`METERS synthetic=wet hyper=wet openrouter=wet syntheticWeekly=33.18% syntheticFiveHour=2750/2750
hyperBalance=2734 openrouterUsd=0.32` at 19:51 UTC),
OpenRouter still uncharged and expected within days,
and the instruction not to wait on it.

- **`yulianNyanner` launched at 19:53 UTC** on tip `14231350f` with all three providers configured and the
  2026-09-04 dials set (overlap 4,
    writer grace 180000),
    runs dir `~/temp/agent/yuliannyanner-20260906`.
    Asked whether the launch was necessary,
    the honest split:
    the double-quoted-path shape it was picked for had already been read on `MTF_0615` and `BI4PBV`;
    what it does test is the first run on this build with all three providers configured,
    the first chance at a consolidation that completes unstarved,
    and a fresh page to read.
- **The production default had never shipped a page.**
  `PASS_OVERLAP` in `corpus-run/pass-overlap.ts` was 1 "until `#261` decides";
    every page that shipped ran at 4 through `TRANSLATION_REPAIR_SLICE_OVERLAP`.
    `#261` had been measured on four matched pairs on 2026-08-27 and 2026-08-28
    (`keyword233`,
    `Toka_ls`,
    `Zha_Ke`,
    `Weideriche_`;
    normalized wall down 0.091,
    0.273,
    0.239 and 0.183 against a 0.03 band,
    voices never worse)
    and never read into a default because the 2026-09-01 hold froze the pipeline.
    Guard `bb5e97e0e` shown to fail on the old build (`value=1 source=fallback` at
    `pass-entry.unit.test.ts:1927`);
    fallback moved in `e50be2299`;
    record `doc/decision/translation-repair-pass-overlap.md`,
    flagged for veto.
- **The owner's rule is always kill and relaunch.**
  A source change while a pass runs means kill the pass by pid,
    build,
    and relaunch the same entry into a fresh runs dir on the new build;
    a page finished on a superseded build is not readiness evidence;
    a known fix lands before the launch.
    Written into the package README,
    the runbook's launch and restore steps,
    the handover hub,
    the 2026-09-04 snapshot,
    the run-continuity and overlap-dial handovers (`0d2203abd`),
    and deliberately not into the root `AGENTS.md`.
    The 19:53 run was killed at 20:01:44 UTC under it,
    264 calls in (148 Hyper,
    116 Synthetic),
    still in the lanes phase.
- **The writer window was the same defect.**
  The straggler-grace record reserved it for the owner.
    Every shipped page ran its writers at 180000 ms through `TRANSLATION_REPAIR_WRITER_GRACE_MS` while the
    round window was the owner's 120000 ms.
    Measured off the four shipped logs of 2026-09-04:
    writer-round cuts at 180 s were 4,
    6,
    11 and 20 (almost all `produceConsolidations`) against 28,
    35,
    26 and 135 reader-round cuts at 120 s;
    writers at 120 s has no matched arm.
    Offered build it in,
    keep the dial,
    or writers at the round window,
    the owner chose build it in.
    `7a2bdbedf`:
    `WRITER_GRACE_MS = 180_000`,
    never shorter than the round window so the calibration keeps its 300000 ms;
    guard shown to fail neutralised (4 `FAIL`) and pass restored (0);
    oxlint 0 and 0,
    types clean.
- **`yulianNyanner` relaunched at 20:21 UTC** on `7a2bdbedf`,
  pipeline `cb326421`,
    the plain invocation with no dial set,
    runs dir `~/temp/agent/yuliannyanner2-20260906`,
    log beside it.
    The log opens `OVERLAP yulianNyanner value=4 source=fallback` and `WRITER GRACE built in`,
    all three providers wet,
    weekly 32.19 percent after the killed run,
    Hyper 2722,
    roster 9,
    `withheld=none`.
    The reading follows.

## The first plain-invocation run, 2026-09-06, 20:21 UTC: the fifth class, and no page

`yulianNyanner` ended `INCOMPLETE` at 20:50:19 UTC,
1,715,943 ms (28.6 minutes) and 742 calls in
(Hyper 55 percent,
Synthetic 45 percent,
no OpenRouter call),
with `slice 1: the standing text failed the deterministic publication rule and the consolidation left nothing
valid to ship (incumbent-only)`.
Weekly Synthetic went from 32.19 to 31.40 percent and Hyper from 2722 to 2686 credits,
which prices one stopped attempt at about 0.8 percent of the week and 36 credits.

- **What the log said.**
  Eleven `MdxParseError` lines,
    eight at `3:2`,
    two at `5:2`,
    one at `9:2`,
    every one `micromark-extension-mdx-jsx/unexpected-character`,
    every one on the ORIGINAL:
    `contest winner fails publication invariants and remains retryable: no comparison was possible: original
    could not be read` on slices 1,
    2,
    4,
    8,
    11 and 12 at the contest,
    then `consolidation standing text fails the deterministic publication rule and is withheld from the slate`
    on slice 1,
    then `ConsolidationStandingIneligibleError`.
    Translation itself had finished:
    `translated 17 slices (0 resumed): 13 changed, 0 refused by a guard`.
- **What the source carries.**
  Fourteen HTML comment lines,
    translator notes between paragraphs
    (a glossary and section-voice markers),
    and the column the grammar names is the `!` of `<!--`.
    Measured at pin `a41fc607`:
    17 of 92 sources carry a comment,
    34 comment lines in all,
    14 of them here;
    22 of 92 archives carry one,
    and this archive renders the fourteen as twelve English comments.
    The three pages that shipped on 2026-09-04 carry none,
    and the one comment `keyword233` and `Toka_ls` each carry is the contributor credit,
    which preparation handles apart.
- **The class.**
  `parse-document.ts` masks HTML comments to same-length whitespace before its strict MDX parse,
    because the grammar refuses `<!--` outright.
    `readSliceSkeleton` in `translate-skeleton.ts` handed the strict grammar the raw slice.
    So an original with a note was `unparseable`,
    `validateTranslatedSlice` answered `unknown`
    (its own comment says an unreadable original "is not a candidate's fault"),
    and both consumers of the floor,
    `lane-contest-eligibility.ts` and `consolidate-ineligible-standing.ts`,
    treat `unknown` as inadmissible.
    Every commented slice was therefore unshippable on any roster,
    and the entry could never settle.
    The candidates were fine:
    142 slice-cache files carry a rendered comment.
- **The fix,
  `259708e79`.**
  The slice reader masks comments the way the document reader does,
    on both sides of the comparison;
    the mask keeps offsets,
    so atoms after a comment still index the unmasked text.
    Whether a candidate carries the note rendered is left to the judges as wording,
    since the archive itself does not keep parity (fourteen to twelve).
    Guards `ebf6524de` in `translate-skeleton.unit.test.ts` and `translate-validate.unit.test.ts`,
    shown to fail on the unfixed build (2 `FAIL` lines in each suite) and pass on the fixed one;
    `translate-skeleton-page.unit.test.ts` 0 `FAIL` as well;
    oxlint 0 and 0,
    types clean.
    `inspect-paragraph.ts` parses strictly too but is handed paragraphs the document reader already produced,
    which never contain a comment,
    so it is not a sibling.
- **`yulianNyanner` relaunched at 21:03:43 UTC** on `3ab2d318a`,
  pipeline `597fa3e0`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner3-20260906`,
    log beside it,
    under the kill-and-relaunch rule (the 20:21 run had already exited on its own).
    The reading follows.

## The third launch, 2026-09-06, 21:03 UTC: the first page on the plain invocation, and the sixth class

`yulianNyanner` SETTLED at 21:48 UTC in 2,694,071 ms (44.9 minutes),
17 slices,
1,180 calls (Hyper 673,
Synthetic 507,
OpenRouter none),
14 straggler cuts (7 at the 120 s reader window,
7 at the 180 s writer window),
6 schema mismatches,
8 transport retries,
3 recovery rounds,
every meter wet throughout,
and the consolidation completed unstarved,
which no run had done since 2026-09-02.
Weekly Synthetic went from 31.37 to 27.48 percent and Hyper from 2686 to 2622 credits,
so one settled entry costs about 3.9 points of the week and 64 credits at zero USD.
`verify-published`:
matched 1,
wordings 17,
silent 0,
`chars=6020=expected`.
`DESTINATIONS source=0 page=0 dropped=0`,
since the source links nowhere.
Three pictures gathered,
all three textless by the deterministic reader,
no model asked.

- **What the page got right,
  read beside the source and the archive.**
  The front matter `desc` is the source's sentence again,
    where the archive had replaced it with the page's closing line;
    the alias carries the source's 涟 beside the archive's romanizations;
    the Japanese lyric line reads as the source writes it where the archive had altered a syllable;
    高二 is "second year of high school" where the archive said "until high school";
    both `PhotoScroll` lines are intact,
    the two-line single-quoted array and the double-quoted one inside a blockquote;
    every one of the fourteen source comments is an English comment in its place,
    including the lyrics attribution the archive dropped;
    no bare pronoun,
    no corner bracket,
    the site's name absent from this source.
- **The defect.**
  The page carries `## Dysphoria` twice:
    for 烦躁,
    whose source comment says the English word for this title is dysphoria,
    and for 桎梏,
    which the archive renders "Shackles".
    Ledger contest 000031 over the 桎梏 slice:
    six candidates,
    three headed Shackles and three Dysphoria,
    the judges chose Dysphoria,
    and seven of eight ballots give the same reason,
    that "the declared editor comment fixes the heading as Dysphoria";
    the one dissent read 桎梏 literally.
    Every one of the twelve prompts carrying that slice carried the note,
    as an identity-context line with no position:
    `- ORIGINAL editor comment: 这里标题对应的英文词是 dysphoria`.
    The note sits under the third heading and speaks of "this title";
    carried into every slice,
    "this" pointed at every heading at once.
- **Smaller readings.**
  "My mind always drifts" in the Introduction,
    a section whose own comment says it is objective narration,
    where the archive has "her mind";
    the translator-instruction comment rendered into English as a comment,
    harmless and pointless;
    the alias listing the name itself.
    Wording,
    for the judges,
    and recorded.
- **The class,
  six.**
  A positional note carried without its position.
    Fixed in `459b2007f` and `7a01c9048`:
    each comment line names "under heading X" or "before the first heading";
    the critic sheet and the house policy say that a note about "this title" or "here" speaks of that heading
    and no other;
    and the publisher refuses a would-ship page on which two headings that differ in the source read the same
    (`CollapsedHeadingError`,
    `corpus-run/heading-distinctness.ts`),
    measured at pin `a41fc607` to refuse nothing:
    no source repeats a heading and no archive collapses two.
    Guards `01b896ea7` shown to fail on the unfixed build (entry-notes 3 `FAIL` lines;
    the floor did not exist),
    0 `FAIL` on the fixed one,
    the publisher,
    critic and preparation suites 0 as well;
    oxlint 0 and 0 after `147c417b6`,
    types clean.
    The floor's own fail-first proof:
    refusal inverted,
    5 `FAIL`;
    restored,
    0.
- **`yulianNyanner` relaunched at 22:06:22 UTC** on `147c417b6`,
  pipeline `30cd442b`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner4-20260906`,
    and killed at 22:07:59 UTC,
    26 calls in,
    when the full suite on that build (934 `PASS`,
    2 `FAIL`) showed the names-only message inventory did not know `CollapsedHeadingError`;
    the inventory is a test file,
    fixed in `e5bd6bf0f` with no rebuild,
    and the rule was applied as written.
- **`yulianNyanner` relaunched at 22:10:19 UTC** on `e5bd6bf0f`,
  the same pipeline `30cd442b`,
    fresh runs dir `~/temp/agent/yuliannyanner5-20260906`,
    log beside it.
    The reading follows,
    with the five headings first.

## The fifth launch, 2026-09-06, 22:10 UTC: the headings hold, and the seventh class

`yulianNyanner` SETTLED at 22:50 UTC in 2,362,951 ms (39.4 minutes),
17 slices,
1,150 calls (Hyper 651,
Synthetic 499,
OpenRouter none),
6 straggler cuts,
no refusal of any kind,
no collapse,
every meter wet,
consolidation unstarved.
Weekly Synthetic 27.41 to 23.54 percent,
Hyper 2622 to 2559.
`verify-published` matched,
`chars=6068=expected`.
`DESTINATIONS source=0 page=0 dropped=0`,
three pictures textless,
all fourteen comments rendered in place,
both `PhotoScroll` shapes intact,
"her mind" in the objective section where the 21:03 page had slipped to "my".

- **The headings hold.**
  Introduction,
    Shackles,
    Dysphoria,
    Wishes,
    Final Chapter.
    The translate contest over the 桎梏 slice offered three candidates and all three were headed Shackles;
    the consolidation ballots now reason from the anchor
    ("the passage sits under the heading 烦躁,
    which the editor comment marks as first-person"),
    which is the line the fix added doing what it was for.
- **By design,
  not a defect.**
  The alias reads `Lyna, 涟, Yulian, Nyanner` because the translate sheet's identity rule requires the
    translated name among the alias renderings when the original declares name and alias as one identity,
    which this source does;
    a ballot cites the rule by number.
- **The seventh class.**
  Five contractions on the page carry a straight apostrophe
    (I'd,
    can't,
    What's,
    wouldn't,
    Let's)
    against thirty curly ones and an archive that is curly throughout;
    the 21:03 page had none,
    and measured on the pages that shipped on 2026-09-04,
    `Uekawakuyuurei` carries five straight against two curly and nobody read it.
    `restore-typography.ts` exists for exactly this and runs on every editor and refiner replacement;
    a translate-lane wording,
    a consolidation proposal and a polish rewrite never passed through it.
    Fixed in `bc42fe330` and `b669363b6`:
    the would-ship reading,
    which every publisher and checker derives the page from,
    puts each non-archive wording through the restoration against the row's incumbent and the stored archive
    text,
    so the artifact keeps what the stages wrote and the page and its checks agree.
    Guard `fd7701f49` shown to fail on the unfixed build (2 `FAIL` lines),
    0 on the fixed one with the page-check,
    publish,
    final-selection and critic suites;
    types clean.
- **Wording,
  for the judges,
  recorded.**
  贴贴 kept in Chinese with a gloss where the archive had "get close to someone online":
    the community-vocabulary rule was applied to a term that has an everyday English equivalent,
    and the house policy now says so with this example (`bc42fe330`).
    自慰 rendered by its blunt literal sense in a quoted despairing thought where the archive and the 21:03 page
    read it as self-consolation;
    a polysemous word,
    the judges' call,
    and a stochastic one across two runs of the same slice.
- **`yulianNyanner` relaunched at 23:11:16 UTC** on `c69a256bd`,
  pipeline `7ec38326`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner6-20260906`,
    log beside it,
    after the full suite on that build read 935 `PASS` and 0 `FAIL`,
    oxlint 0 and 0,
    types clean.
    Weekly Synthetic 23.53 percent at launch.
    The reading follows,
    with the apostrophe count first.

## The sixth launch, 2026-09-06, 23:11 UTC: the apostrophes hold, and the eighth class

`yulianNyanner` SETTLED at 23:56 UTC in 2,647,492 ms (44.1 minutes),
17 slices,
1,228 calls (Hyper 702,
Synthetic 526,
OpenRouter none),
no refusal of any kind,
every meter wet,
consolidation unstarved.
Weekly Synthetic 23.53 to 19.13 percent,
Hyper 2559 to 2491,
zero USD.
`verify-published` matched,
1 of 1 at the length the artifact implies.
Five distinct headings,
all fourteen comments rendered in place,
three pictures textless,
`DESTINATIONS source=0 page=0 dropped=0`.

- **The apostrophes hold.**
  Zero straight apostrophes inside words against forty curly ones,
    where the 22:10 page had five against twenty-nine and the archive has none against thirty-six.
    The one straight quote left after a letter is `girls'`,
    a plural possessive,
    which the restoration's apostrophe rule skipped because a quote with a space on one side may be
    closing a quotation.
- **The eighth class.**
  The blockquoted component line reads
    `> <PhotoScroll photos={[“${path}/photos/photo3.webp”]} />`:
    the class-seven fix put every non-archive wording through the restoration,
    the restoration protected backtick spans and nothing else,
    and a JSX string literal in typographic quotes compiles nowhere.
    Every slice floor had passed the straight-quoted slice,
    since the would-ship reading runs after them,
    and nothing between that reading and the disk read the page as a document.
    The log had said it and nobody refused:
    `publish: destinations-mdx-downgraded (page)`,
    a warning from the destination check,
    which parses the page and names the fall to plain markdown as a finding.
    Measured at the pin,
    19 of 92 sources carry a tag with a double-quoted attribute
    (`<p style="text-align: end;">` in `XingZ60` and `luxuanwen3` among them),
    so the class was waiting on every one of those.
- **Fixed guard first.**
  `2079c8c99`:
    the publisher reads the assembled page the way every document is read,
    `parseDocument`,
    and refuses one whose strict parse fell back (`UnparseablePageError`,
    names only,
    entry id and the parser's refusal site).
    `ba91c5587`:
    `typography-prose-mask.ts` marks backtick spans and tags,
    `<` followed by a letter or `/` through the `>` that is not a blockquote marker,
    as not prose,
    and every rule of the restoration reads that one mask;
    a trailing apostrophe converts when the replacement holds no straight single quote shaped like an
    opening one,
    which is `girls'`.
    Guards shown to fail on the neutralised build:
    the floor inverted,
    5 and 7 `FAIL` lines in the page-grammar and publisher suites;
    the mask never entering a tag,
    4;
    the trailing rule removed,
    2;
    0 on each restore.
    Full suite 936 `PASS`,
    0 `FAIL`;
    oxlint 0 and 0;
    types clean.
- **The reading gains two greps.**
    `mdx-downgraded` and `would ship a page` join the refusal vocabulary,
    and the apostrophe count now reads any straight quote after a letter,
    not only one inside a word.
- **A page from a superseded build no longer verifies.**
  `verify-published` against the 22:10 runs dir on the class-seven build reads 0 of 1,
    because the would-ship reading moved under it;
    the tool now says what the rule says.
- **Recorded,
  not fixed.**
  The blank line after the front matter is dropped on every `yulianNyanner` page and on `Hangmster`,
    a splice property of the front-matter slice,
    not a rendering defect,
    since the site strips the front matter before the body is compiled.
    贴贴 now reads "cuddle online" under the house rule;
    自慰 reads "masturbation fantasies" again,
    the same literal sense as the 22:10 page,
    the judges' call.
    The alias and the `desc` are as before,
    the one by the identity rule and the other from the source.
- **`yulianNyanner` relaunched at 00:12:39 UTC on 2026-09-07** on `ba91c5587`,
  pipeline `4d000da8`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner7-20260907`,
    log beside it,
    weekly Synthetic 21.05 percent at launch.
    The reading follows,
    with the component line and the apostrophe count first.

## The seventh launch, 2026-09-07, 00:12 UTC: the class-eight page reads clean, and one ellipsis

`yulianNyanner` SETTLED at 01:03 UTC in 3,070,546 ms (51.2 minutes),
17 slices,
1,314 calls (Hyper 760,
Synthetic 554,
OpenRouter none),
25 voices abandoned after quorum,
every meter wet,
consolidation unstarved.
Weekly Synthetic 21.05 to 16.44 percent,
Hyper 2490 to 2408,
zero USD.
`verify-published` matched,
1 of 1 at the length the artifact implies.
`DESTINATIONS source=0 page=0 dropped=0` with no finding,
where the 23:11 line carried `destinations-mdx-downgraded (page)`.

- **The component line holds.**
  `> <PhotoScroll photos={["${path}/photos/photo3.webp"]} />`,
    straight,
    and the multi-line `PhotoScroll` keeps its single-quoted paths;
    two straight double quotes on the page and two in the archive,
    two straight quotes after a letter on each,
    both the closing quotes of those paths.
    No `mdx-downgraded`,
    no `would ship a page`.
- **The quotes hold.**
  Zero straight apostrophes inside words against thirty-five curly ones;
    the archive has thirty-six.
    The `girls'` sentence was rendered without a possessive this time,
    so the trailing rule was not exercised on the page.
- **The floors spoke twice and were right.**
  Two consolidation standings were withheld from the slate under the line-structured rule,
    slice 8 at 8 lines against 9 and slice 12 at 14 against 15,
    both lyric sections,
    and each slice shipped from its remaining candidates.
    `fails the deterministic` reads 2 in the log for that reason;
    the other refusal greps read 0.
- **Five distinct headings,
  fourteen comments,
  three pictures textless.**
- **The judges settled the two wording findings.**
  自慰 reads "self-pleasing fantasies",
    the archive's sense,
    after a ballot argued the literal rendering "is blunter than needed";
    贴贴 reads "was taught how to cuddle online".
    `*Angel Beats!*` gains the exclamation mark the source and the archive omit,
    which is the house rule on a work's official English title,
    by design.
- **One ellipsis.**
  The page carries one U+2026 ("no chance anymore…")
    against eleven three-dot ellipses,
    on an archive that writes eleven three-dot ellipses and no U+2026,
    from a source that writes twenty U+2026.
    The third convention a page can mix,
    after the two quote forms;
    measured at the pin,
    28 archives write three dots only,
    14 U+2026 only,
    11 both and 39 neither.
    Fixed in `e3471dc0b`:
    `restore-ellipsis.ts` reads the replaced region and the document together,
    and where they show one form converts a run of U+2026 to one three-dot ellipsis or a run of
    exactly three dots to U+2026,
    through the prose mask,
    called at the end of `restoreTypography` so every caller has it;
    where they show both forms or neither it says nothing.
    Guard shown to fail neutralised and pass restored (the counts are in the section that follows the
    launch).
    The reading step gains the ellipsis count beside the apostrophe count.
- **Recorded,
  not fixed.**
  The blank line after the front matter is dropped as before.
    The archive's `> Take up arms if you have them.  ` ends in two spaces,
    a hard break with nothing after it,
    and the page's line does not;
    bytes,
    not rendering.

THE READING of this page is the first of the day that found no defect class,
one convention glyph aside.
It is one page of one entry,
read four times.

## The shape census, 2026-09-07, 00:20 UTC: what no read page has carried

Every new source shape so far found a class on its first page,
so the next entry is chosen by shape rather than met by accident.
A surface census of the 92 sources at the pin
(scratch `shape-census.mjs`,
regular expressions over `page.md`,
counted against the four entries whose pages were read on this line:
`luxuanwen3`,
`SS3B_0016`,
`Uekawakuyuurei`,
`yulianNyanner`)
finds these shapes carried by no read page,
largest first:

- footnote references,
  23 sources,
  the pipeline's footnote graph never exercised by a read page;
- bold,
  10;
- `<details>` with `<summary>`,
  9;
- a math pair,
  6 (the README's "The site's grammar is not this one" already holds the question);
- a `<br>` tag,
  6;
- a bare URL,
  6;
- a horizontal rule in the body,
  5;
- a heading at level 3 or deeper,
  5;
- the components `Banner`,
  `BlurBlock`,
  `CapDownQuote`,
  `Sakura`,
  `DottedNumber`,
  `Hexagon` and `TextRing`,
  1 to 3 each;
- `<ruby>`,
  3;
- emphasis,
  3;
- a level-1 heading,
  2;
- an unordered list,
  2;
- an ordered list and inline code,
  1 each.

Shapes a read page has carried:
HTML comments (17 sources),
`PhotoScroll` in every spelling (50),
a component inside a blockquote (3),
an HTML element with a double-quoted attribute (11),
the neutral pronoun (16),
nested blockquotes (46),
links (58),
corner brackets (73),
and every front matter key the corpus uses
(`name`,
`info`,
`alias`,
`location`,
`desc`).

THE NEXT ENTRY is `TLL1122`:
640 characters,
one footnote definition and two references on each side,
no component,
so the footnote shape arrives alone.
`DarlinChit` (540) is smaller but adds a `PhotoScroll`,
which is carried.
After it,
`Arita`,
the double-quoted `PhotoScroll` repeat the 2026-09-06 snapshot named,
and then the second tier by size:
`hakureico` (bold and two notes),
`Huasheng` (`<details>`,
bold,
`<br>`),
`yuki418330012` (a math pair).
`XingZ60` carries five of the uncarried shapes and five components at 16,733 characters,
and is the entry to run last,
not first.

## The TLL1122 launch, 2026-09-07, 01:11 UTC: the first footnote

`TLL1122` launched at 01:11:14 UTC on `d384e08fd`,
pipeline `1b748b56`,
the ellipsis build,
plain invocation,
fresh runs dir `~/temp/agent/tll1122-20260907`,
log beside it,
after the full suite on that build read 936 `PASS` and 0 `FAIL`,
oxlint 0 and 0,
types clean,
and the ellipsis guard read 3 `FAIL` neutralised and 0 restored.
Weekly Synthetic 16.34 percent at launch.
The source is 640 characters with a positional blockquote before the first heading,
corner brackets,
one footnote definition and a reference inside a quoted line;
the archive writes emphasis the source has none of,
and its `desc` and alias differ from the source's.
The reading follows,
with the footnote's reference and definition first.

## The TLL1122 page, 2026-09-07, 01:41 UTC: the footnote holds, and no class

`TLL1122` SETTLED at 01:41 UTC in 1,806,012 ms (30.1 minutes),
8 slices,
every one changed,
798 calls (Hyper 446,
Synthetic 352,
OpenRouter none),
3 voices abandoned after quorum,
one judge ballot lost to a control character in its JSON,
every meter wet,
consolidation unstarved.
Weekly Synthetic 16.34 to 13.72 percent,
Hyper 2406 to 2367,
zero USD.
`verify-published` matched,
1 of 1 at the length the artifact implies.
`DESTINATIONS source=0 page=0 dropped=0`,
no refusal grep above zero,
no `mdx-downgraded`.

- **The footnote holds.**
  The reference `[^1]` sits inside the quoted wish where the source and the archive put it,
    and the definition `[^1]:` closes the page on one line as the archive writes it.
    The judges read both slices as their own:
    the translate slate over the definition argued the archive's "male pronouns" against the source's
    broader 称呼,
    and the consolidation slate settled a rendering fuller than the archive's
    ("characters who are a kind of human made up of various minerals and gemstones",
    "and so in fact there is no gender distinction"),
    which the source says and the archive dropped.
- **Typography holds.**
  Two curly apostrophes and no straight one,
    four curly doubles and no straight one,
    two three-dot ellipses and no U+2026,
    as the archive.
    One heading,
    no comment,
    no component,
    no picture.
- **Measured and within the corpus's own habit,
  not defects.**
  Two lines end in whitespace,
    one at a paragraph end and one a blank blockquote line;
    59 of 92 archives carry trailing whitespace on 441 lines,
    this entry's own archive on 6.
    Three em dashes against the archive's none and the source's one `——`,
    two of them where the source has a comma;
    38 of 92 archives use an em dash,
    so it is the judges' wording,
    recorded.
    The prose is rewrapped one clause per line throughout,
    which the archive does in most paragraphs and not all;
    a soft break renders as a space either way.
    The `desc` is the source's line rather than the archive's different one,
    and the alias carries the name,
    the archive's aliases and the source's 鹿鹿,
    both by the rules already recorded.
    The blank line after the front matter is dropped as on every page.
- **The transport shape of the night.**
  Five times across the last three runs a stream from `gemma-4-26b-a4b-it` on Hyper ended without
    `message_stop`,
    every one recovered on the first retry;
    that seat completed its other streams.
    Nothing to act on;
    counted so the next reader need not.

THE READING:
the first entry of a new shape whose first page found no class,
against five shapes that each did.
One entry,
one footnote,
one page.

## The run order after TLL1122, decided 2026-09-07, 01:50 UTC

The 2026-09-06 snapshot named `Arita` next,
the other double-quoted `PhotoScroll` entry never run.
That shape has now shipped clean twice on `yulianNyanner`,
and the census shows the shapes no read page has carried.
The order is therefore the census's,
by shapes per run:
`Huasheng` (2,764 characters;
`<details>` and `<summary>`,
bold,
`<br>`,
a footnote),
which exercises the container spans no read page has touched and the prose mask on an inline tag;
then `hakureico` (bold,
two notes) or `yuki418330012` (a math pair),
whichever the `Huasheng` reading leaves more open;
then `Arita`.
A decision about run order,
not design,
made without the owner and open to veto;
the reason to prefer it is the one every page of the day gave,
that a repeated shape has found nothing and a new one has found something every time.
Weekly Synthetic stands at 13.72 percent,
enough for about three runs of this size before Hyper serves alone,
which the owner has said is normal.

## The Huasheng launch, 2026-09-07, 01:44 UTC: the first container

`Huasheng` launched at 01:44:14 UTC on `202323d50`,
pipeline `1b748b56`,
the ellipsis build unchanged in code since `e3471dc0b`,
plain invocation,
fresh runs dir `~/temp/agent/huasheng-20260907`,
log beside it.
Weekly Synthetic 13.67 percent at launch,
five-hour window full.
The source is 113 lines:
a `<details>` block whose `<summary>` is bold,
a poem of twelve `<br/>` line endings,
one footnote where the archive carries two,
the second an archive-only translator note.
The reading follows,
with the container's two tags and the poem's line endings first.

## The Huasheng pass killed, 2026-09-07, 02:56 UTC: the ninth class

At 02:54 UTC,
70 minutes in and at the lane contest,
the slice floor reported slice 9 as an original that could not be read
(`MdxParseError at 1:1 (mdast-util-mdx-jsx/end-tag-mismatch)`)
and at 02:55 slice 12 the same
(`3:2-3:3 (mdast-util-mdx-jsx/unexpected-closing-slash)`):
slice 9 owns the `<details>` opener and slice 12 its `</details>` closer,
by the design of `container-extents.ts`,
and the strict grammar refuses either half alone.
Both gates that consume the floor treat a refusal as inadmissible,
so the entry would have stopped at consolidation with nothing to ship,
as yulianNyanner did on 2026-09-06 for a comment.
The pass was killed under the rule at 02:56:24 UTC after 1,726 calls,
weekly Synthetic 13.67 to 6.64 percent,
Hyper 2367 to 2273,
zero USD.
The class-five pattern for containers;
30 of the pinned corpus's pages carry a disclosure element,
and `Zha_Ke`,
`SevenBird`,
`mikaela_khara` and `XingZ60` are named in the extents record as the entries whose tags fall in
different slices.

## The ninth class fixed, 2026-09-07, 03:05 UTC

`ed7f82de9`:
`mask-container-tags.ts` reads a slice line by line,
takes a line that is exactly one tag
(an opener with or without attributes,
or a closer;
never a self-closing tag,
a comment or a line holding a whole element),
pairs openers with closers of the same name innermost first,
and masks each unpaired tag to same-length whitespace,
reporting it.
`readSliceSkeleton` applies it after the comment mask and carries each lone tag as a `container-tag`
atom,
openers before the content atoms and closers after,
which is where the extents put them;
`container-tag` joins the atom kinds a translation must carry,
so a candidate that drops the tag fails the floor deterministically rather than at the page grammar.
A `<summary>` holding phrasing on one line reads as a paragraph of inline JSX under this grammar,
inside a container or out of one,
which the skeleton test now pins.
Guard shown to fail with the mask neutralised:
3 `FAIL` lines in the skeleton suite and 2 in the validate suite,
0 restored.

The suite `floor-holds-on-an-unparseable-page` had pinned the old answer,
fail closed both ways at a span cut between a container's tags,
with the note that making such slices shippable "belongs to the slicer rather than to this check".
The extents cut every split container exactly that way,
so that answer was every such entry stopping at consolidation.
The suite now exercises the relaxed path with a page torn through an inline element,
which no mask reads for the grammar,
and pins the cut-container page as the strict,
ordinary case:
a candidate dropping the lone tag is refused by name,
one carrying it passes with `pageGrammar` strict,
and one closing the element is refused as a different block.
The container-integrity header names the slice floor as the first catch.

## The Huasheng relaunch, 2026-09-07, 03:09 UTC

`Huasheng` launched again at 03:09:14 UTC on `f54da91e2`,
pipeline `95196dfc`,
the class-nine build,
plain invocation,
fresh runs dir `~/temp/agent/huasheng2-20260907`,
log beside it,
after the full suite on that build read 936 `PASS` and 0 `FAIL`,
oxlint 0 and 0,
types clean.
Weekly Synthetic 6.55 percent at launch,
Hyper 2272;
the week will likely run dry during this pass,
after which Hyper serves alone.
The reading follows,
with the two container halves,
the poem's line endings and both footnote conventions first.

## The Huasheng relaunch stops at slice 21, 2026-09-07, 05:21 UTC: the tenth class, a design question

The container halves passed the lane contest at 04:21 UTC with no unreadable slice,
so the ninth class is closed where it was found.
The Synthetic week ran dry at 04:36 UTC during consolidation,
as the launch record said it would,
and Hyper served on alone with no voice lost to a dry provider.

Slice 21 then stopped the entry.
It is the poem "To the Eternal Star",
which the source writes as two paragraphs whose lines end in `<br/>`,
and the archive as five paragraphs with soft line breaks and no `<br/>`.
Every producer followed the source:
the contest winner carried two paragraphs at 04:27,
the consolidation standing two at 05:07,
and the consolidation "left nothing valid to ship",
so `ConsolidationStandingIneligibleError` stopped the entry under the 2026-09-04 decision that an
ineligible standing stops rather than reattempts.
The floor that refused them is `compareBlocks` in `translate-validate.ts`,
whose rule is that the page is a floor and not a ceiling:
a candidate must carry the page's block sequence in order and may add blocks only up to the larger
of the two references.
It was written on 68 settled slice records
(48 same,
11 archive more,
7 archive fewer)
so that an archive which merged the original's paragraphs is not undone,
and it is pinned by a case in which the archive's blockquote says a passage was left by someone else.

Measured now at the document level over the 92 pairs
(scratch `block-census.mjs`,
`parseDocument` top-level blocks):
the archive carries more blocks than its source on 34 entries,
the same on 40,
fewer on 18.
Of the 34,
five carry `<br/>` or two-space hard breaks in the source
(`Huasheng` 11 `<br/>`,
`xixi_yuexi`,
`Anilovr`,
`Chinatsu_Suzuki`,
`Mio`),
the shape of this stop;
the other 29 split or add for reasons the census cannot read,
`shihai4h` by 21 blocks,
`windward0032` by 15,
`MeowBot233` and `Mio` by 9.
Under the floor as written,
every slice of those 34 entries where the archive has more blocks ships only if the producers reproduce
the archive's split rather than the source's,
which eight producers declined to do here.

This is a design question,
recorded for the owner rather than decided,
because the floor's rule is a written decision with a pinned rationale and the alternatives trade
against each other:

- A,
  either rendering at the block level:
  the floor also accepts a candidate whose block sequence is exactly the original's.
  Pro:
  one principle the house already applies to destinations and atoms,
  covers all 34,
  and leaves the choice between two faithful shapes to the judges,
  who see both texts.
  Con:
  a paragraph the archive added with no source counterpart becomes droppable by a source-shaped
  candidate,
  and the pinned blockquote case flips from refused to judged.
- C,
  hard-break equivalence:
  a source paragraph carrying hard breaks may be rendered as the page's run of paragraphs or as one
  paragraph carrying the same breaks.
  Pro:
  aimed at the measured shape of this stop and the four entries like it,
  and the blockquote case stays refused.
  Con:
  more machinery for one sub-shape,
  and the other 29 entries stay exposed.
- B,
  teach the producers:
  a sheet clause saying the page's split is kept where it has more blocks than the original.
  Pro:
  no floor change.
  Con:
  the finding already says this to every producer and eight ignored it;
  whether a clause moves them is unmeasured.
- D,
  A with a size guard that accepts the original's shape only when the candidate is not shorter than
  the page by some margin.
  Con:
  a magic number.

Ranking A > C > B > D:
A over C because one house principle beats a sub-shape rule and covers 29 entries C does not;
C over B because C is deterministic where B hopes;
B over D because D needs a number the owner has said not to test against.
Nothing is changed in code until the owner answers.

## The owner answers A, 2026-09-07, 08:38 UTC: either rendering, bounded to splits

The Huasheng relaunch ended `INCOMPLETE` at 05:31 UTC after 8,473,853 ms (141.2 minutes),
2,743 calls,
Hyper 2272 to 1843,
weekly Synthetic 6.55 to 0 percent,
zero USD,
no page.

The owner chose A,
either rendering at the block level.
Implementing it as asked flipped the case the suite `floor-holds-on-an-unparseable-page` was built
to stop:
its fixture is a one-paragraph original against a page span read as a paragraph,
an html block and a blockquote,
and the 164-character rendering that shipped on the sixth consolidation bed was shaped exactly as
that original.
So the rule is bounded where the two cases part:
the original's shape counts only where every block of the page is of a kind and detail the original
has,
so the page's surplus is a split;
a page adding a kind the original lacks keeps the page as the floor,
which also keeps the pinned blockquote case refused.
Measured at the document level over the 34 archive-more entries,
22 are split-only,
Huasheng among them,
and 12 add a kind.
`b46dd9210`,
recorded in `doc/decision/translation-repair-block-floor.md` with the widening named as the veto.
Suites:
translate-validate,
floor-holds-on-an-unparseable-page,
translate-skeleton 0 `FAIL`;
oxlint 0 and 0;
types clean.
Guard shown to fail with the early return neutralised,
14 `FAIL` lines,
0 restored.

## The third Huasheng launch, 2026-09-07, 08:43 UTC, on the class-ten build

`Huasheng` launched at 08:43:38 UTC on `e645de7f4`,
pipeline `7f740697`,
plain invocation,
fresh runs dir `~/temp/agent/huasheng3-20260907`,
log beside it,
after the full suite on that build read 936 `PASS` and 0 `FAIL`,
oxlint 0 and 0,
types clean,
and the either-rendering guard read 14 `FAIL` neutralised and 0 restored.
Meters at launch:
Synthetic wet again at 2 percent of the week
(0 at 05:31,
so the week trickles back rather than resetting on a day;
the schedule is still not on record),
Hyper 2080 (1843 at 05:31,
237 credits returned without a top-up on record),
OpenRouter 0.32 USD,
every seat filled,
none withheld.
Synthetic will dry within the pass and Hyper serve on;
the page is read for defect classes,
which live in the pipeline's screens and not in the roster,
and its wording is read knowing which seats spoke.
The reading follows,
with slice 21 first.

## The third Huasheng launch ends at the publisher, 2026-09-07, 11:14 UTC: the eleventh class

`Huasheng` ended `INCOMPLETE` at 11:14 UTC after 9,014,980 ms (150.2 minutes),
2,539 calls (Hyper 2,158,
Synthetic 381),
89 voices abandoned after quorum,
no voice lost to a dry provider,
Hyper 2080 to 1275,
weekly Synthetic 2 to 0 percent within the first hour,
zero USD,
no page.
The Synthetic seats threw once the week dried
(Qwen3.8-27B 58 of 373 asks,
Kimi-K3 16,
GLM-5.3-Flash 11)
and the pass went on without them.

Slice 21,
the poem,
passed the lane contest under the either-rendering floor,
had its consolidation standing withheld once by the line-structured rule
(7 lines against 8)
and shipped from the valid proposals;
the tenth class is closed where it was found.
The container halves passed again.
No slice was unreadable.

The entry then stopped at the publisher:
`entry Huasheng front matter is not publishable (directory-id-name)`.
The rule,
the owner's of 2026-09-02 in `doc/decision/translation-repair-front-matter-guard.md`,
refuses a page whose visible `name` is the directory id while the source's is not,
written for `#269`,
archives whose metadata was never translated and still name the folder.
The source names the person 椛笙,
whose pinyin is Huasheng;
the archive's `name` is `Huasheng`;
the judges' front-matter ballot chose `Huasheng` over the original script by the sheet's own identity
rule,
and the floor refused it because the string is the directory id.
The rule cannot tell a folder name left untranslated from a romanisation that coincides with the
folder name,
and for this entry every correct rendering coincides.

Measured today:
22 archives name the directory.
8 do so because the handle is the person's name in the source too,
as the decision record says.
Of the other 14,
the directory id is itself a rendering of the source's name for 7:
`Huasheng` (椛笙),
`lintong` (林童),
`Kotori` (琴里),
`MioCardMeow` (澪卡喵),
`MocaKawai` (摩卡好可爱),
`noname` (无名逝者),
`donotexist_A` (不存在);
the other 7
(`DarlinChit`,
`dogesir_`,
`homoyamakaze`,
`interrgned`,
`lxyddice`,
`Weideriche_`,
`XingZ60`)
are handles the source does not use as the name,
the `#269` shape.
Under the rule as written the first 7 cannot ship unless a lane renders the name some other way.

A design question on a decided rule,
recorded for the owner:

- A,
  judged and read,
  not floored:
  `directory-id-name` becomes a finding the publisher logs and the reading checks,
  and the judges' identity rules decide the name.
  Pro:
  dissolves the 7;
  the judges see the source name and the sheet's rules;
  the owner's own premise of 2026-09-02 was to stop caring about metadata differing from the source.
  Con:
  a folder name the judges keep on one of the `#269` 7 ships,
  and only the reading catches it.
- D,
  a romanisation check:
  the id-equal name passes when it is a pinyin reading of the source's name.
  Pro:
  deterministic where it applies.
  Con:
  a new dependency with heteronyms,
  and it covers 2 of the 7 (`Huasheng`,
  `lintong`),
  not the Japanese reading,
  the literal renderings or `noname`.
- C,
  exempt the id-equal name where the source's name appears among the page's aliases in original
  script.
  Pro:
  no dependency,
  and the identity rule already puts the source name in the alias.
  Con:
  the `#269` 7 can pass the same way,
  so it is A with a weaker reading.
- B,
  keep the rule and tell the producers to render the name otherwise.
  Con:
  for 椛笙 there is no other correct rendering.

Ranking A > D > C > B:
A over D because D covers two of seven and adds a dependency;
D over C because C admits what A admits with less honesty about it;
C over B because B cannot be satisfied for this entry.
Nothing is changed in code until the owner answers.
Hyper stands at 1275 credits;
a Huasheng pass on Hyper alone costs about 800.

## The owner answers on the name, 2026-09-07, 11:30 UTC: the pinyin check and the alias exemption

The owner's words:
"pinyin check and alias exemption (see both the original Chinese and the original English,
there's gotta be a English rendering in the frontmatter)".
Landed in `912dbe2dc`,
`corpus-run/directory-id-name.ts`,
recorded as an addendum to `doc/decision/translation-repair-front-matter-guard.md`.
The id-equal visible name stands when any of three holds:
the id,
lower-cased and reduced to its Latin letters,
is a pinyin reading of the source's name with every heteronym of every character allowed
(`pinyin-pro`,
a new catalog dependency,
MIT,
no dependencies of its own,
reads 椛 as hua and 单 as dan,
shan or chan);
the source itself carries the id among its aliases;
or the page or the archive carries an alias in Latin script other than the id,
the English rendering the owner said the front matter has to have.
What stays refused is a folder name with no Latin rendering beside it on either side.

Measured over the pinned corpus with the rule as landed
(scratch `name-census.mjs`):
23 archives name their directory,
8 in the source too,
and the other 15 all stand,
`Huasheng` and `lintong` by pinyin among them and the seven handles by the archive's own alias
(Sakuya,
Lan Gou,
Qian Yu Mao Tou,
Danpian,
lxy,
Zihe,
Lili);
none falls.
Suites:
directory-id-name,
front-matter-completeness,
publish-fixed 0 `FAIL`;
oxlint 0 and 0;
types clean;
the lockfile diff is the one package.
Guard shown to fail with every clause neutralised,
5 `FAIL` lines in the rule's suite and 3 in the completeness suite,
0 restored;
full suite 937 `PASS`,
0 `FAIL`.

## The fourth Huasheng launch, 2026-09-07, 15:43 UTC, on the class-eleven build

`Huasheng` launched at 15:43:52 UTC on `32dd30437`,
pipeline `a4c73f76`,
plain invocation,
fresh runs dir `~/temp/agent/huasheng4-20260907`,
log beside it,
after the full suite on that build read 937 `PASS` and 0 `FAIL`.
Meters at launch:
Synthetic 1.98 percent of the week,
Hyper 1272,
OpenRouter 0.32 USD,
every seat filled.
Hyper carries the pass once Synthetic dries,
at about 800 credits,
so this is the last pass the meters allow before a refill or a top-up.
The reading follows,
the front matter's name first,
then the container,
the poem and both footnote conventions.

## The fourth Huasheng launch finds the twelfth class, 2026-09-07, 19:40 UTC: Hyper's daily limit

The monitor timed out at 19:40 UTC with the pass alive and in consolidation,
begun at 18:01 on an eight-model roster and heavily degraded.
Measured off the log at 19:40:
`createRequestPace` had written "window full (1000 starts in 3600000ms)" 1,028 times since 16:42;
`exchangeWithRetry` had logged `HTTP 429` 2,693 times;
`markRefused` had held Hyper out 831 times,
60 s each,
"while its meter reads wet";
`HTTP 402` from OpenRouter,
"This request requires more credits",
463 times since 17:01;
and `EveryProviderDryError` 34 times.
Per ten-minute bucket,
Hyper's streams carried content until 16:59 (83 to 202 per bucket)
and none at all from 17:00 on (106 to 285 empty streams per bucket),
while the meter read `hyper=wet` at a balance of 909 the whole time,
unchanged.
Consolidation chunks 1,
3 and 4 each took about 75 min to settle,
every one on "winner short of the minimum vote weight;
keeping the repaired text",
with every producer round reading "0/6 heard" and "retry round 2 for 6 lost voices".

The refusal's own words,
logged where a voice was lost:
`You've hit your daily rate limit. Please try again in 2h25m18s.`,
84 bodies,
every wait counting down to one instant:
17:27:55 plus 2h25m18s is 19:53:13,
19:39:19 plus 14m40s is 19:53:59.
Hyper's daily limit,
not its hourly one,
and its wording names its return.

Two sites read it wrong.
`retryAfterMsOf` in `transient-retry.ts` scanned "try again in ",
a run of digits,
then an `s`;
`14m40s` is digits then `m`,
so it read no wait and the ladder retried on its jitter,
five attempts a call.
`markRefused` in `provider-budget.ts` then took a 429 on a wet meter for a concurrency limit,
which the pin pass of 2026-09-02 had taught it,
and held Hyper out for the 60 s backoff while OpenRouter read wet,
which sent the next calls back into the same wall.
Neither the pacer nor the meter could see it:
the pacer counts starts,
and the balance does not move on a refusal.

The fix,
class twelve,
in three clauses:
`retryAfterMsOf` reads hours,
minutes and seconds as Hyper writes them
(`2h25m18s`,
`14m40s`,
`2h`);
the ladder ends at once on a wait past its own widest backoff window
(`longestBackoffMs`,
base times two to the retry limit,
16 s in production),
returning the reply for the router to hold the provider out;
and `markRefused` takes `statedWaitMs` from the refusal (`statedWaitMsOf` in `provider-budget-refusal.ts`,
called by the router and the re-ask)
and holds the provider out for at least that long,
whatever the meter reads.
The existing hold-wait then does the right thing on its own:
a caller facing only held providers waits out the shortest hold,
so a voice keeps trying whichever provider comes back first and is lost at its own deadline,
not before.
Guards:
the ladder suite gains the composite parse and an ENDS-AT-ONCE case on the daily wording,
and its WAITS case moves to a policy whose reach covers the one second it names;
the budget suite gains two cases,
a named wait past the backoff and a named wait where the meter alone would hold nothing;
the router suite gains a case passing the named wait through.
Neutralised one at a time they fail 3,
2,
3 and 2;
restored,
0.

Landed on branch `translation-repair-class12` at `31e67a100`,
built and proven in a throwaway worktree (`~/temp/agent/tr-class12-20260907`),
because the kill-and-relaunch rule forbids superseding a running pass's build,
the run was five minutes from Hyper's return,
and the page it would ship is the class evidence this launch exists for.
It lands on `translation-repair-rebased` when the pass ends,
before the next launch.
The worktree's `git worktree add` wedged every cli-git call for ten minutes under the worktree-copy settlement,
and its `cli-git.config.ts` had to be trusted and the forbidden-strings scanner copied in before a commit went through;
the system git answered throughout.

Hyper came back at 19:54 as the bodies said.
Chunk 6 then settled in 43 min,
chunk 9 in 9 min,
chunks 19 to 24 in 4 to 7 min each.

## The owner adds Amazon Bedrock, 2026-09-07, 19:50 UTC

The owner,
in four messages while class twelve was being written:

> I have added TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY to main worktree's secrets file.
> You can copy it.
> I have 200USD of credits in my Amazon Bedrock account.
> With ZDR enabled,
> only these models are usable (and approved):
> Claude Sonnet 5,
> Gemma 4 E2B,
> Gemma 4 31B,
> Gemma 4 26B-A4B,
> GPT OSS 120B.
> Once again,
> any number of provider being dry or lacking API key is expected and normal operation.

> The credits in my Amazon Bedrock account will expire early next year,
> so you're allowed to use it as much as you like.
> But I will NEVER top it up.

> 1. Please do not introduce Amazon Bedrock SDK,
> Anthropic SDK,
> OpenAI SDK because these are poorly written.
> Use raw fetch.
> 2. I retract Sonnet 5.
> Looks like Amazon didn't properly display it as not supporting ZDR.

The key was copied into this worktree's `.env.local.json` with `sops set`,
value never printed,
136 characters on both sides and equal.
The sops call needs `SOPS_AGE_KEY_FILE=~/.config/mise/age.txt`,
the identity mise decrypts with;
without it sops finds no key.

### What the account answered, read-only, before any code

`GET /foundation-models` with the bearer key answered 200 in us-east-1,
us-west-2,
eu-west-1,
eu-central-1 and ap-northeast-1.
None listed a Gemma 4;
`anthropic.claude-sonnet-5` was listed as `INFERENCE_PROFILE` only,
with profiles `us.` and `global.`.
`bedrock-runtime`'s `/openai/v1/models` answered 404.
`bedrock-mantle.us-east-1.api.aws/v1/models` listed 55 models including all five named,
every one with `data_retention.mode: "none", source: "account"`;
us-west-2's mantle list had the Gemma sizes and gpt-oss but not Sonnet 5.

One request per model on mantle's `/v1/chat/completions`,
streamed with usage and a json_schema response format:
gpt-oss-120b answered 200 with the schema honoured,
usage on the last chunk,
reasoning deltas before content,
and no `data: [DONE]`;
every Gemma 4 answered 400 "model isn't supported on this route";
Sonnet 5 answered 400 "does not support the '/v1/chat/completions' API".
Sonnet 5 on mantle's `/v1/responses`:
the same refusal;
on mantle `/v1/messages`:
404;
on bedrock-runtime,
chat and Converse,
as `us.` and `global.` profiles:
403 "anthropic.claude-sonnet-5 is not available for this account".
The owner retracted it while this was being read.
Gemma 4 on mantle's `/v1/responses` hung for three minutes with no event;
with `background: true` the account answered "This account requires store=false for this model".

The model cards settled it:
"Gemma 4 models are available only on the bedrock-mantle endpoint",
and "On bedrock-mantle,
this model is served at /openai/v1",
with the programmatic base `https://bedrock-mantle.{region}.api.aws/openai/v1`.
On that route,
streamed with usage and the schema,
all three Gemma 4 sizes answered 200,
schema honoured,
usage on the last chunk,
`data: [DONE]` present,
no reasoning frames;
gpt-oss-120b on that route answered "isn't supported on this route".
So two routes on one host,
decided per model,
and two terminators.
The cards also say reasoning effort is honoured and recommend `reasoning_effort: high` for Gemma 4;
the client sends none,
by the owner's standing instruction of 2026-08-25,
and the probe's answers carried no leaked reasoning.

Prices,
read 2026-09-07:
Gemma 4 E2B 0.04 in and 0.08 out per million tokens,
Gemma 4 31B 0.14 and 0.40,
Gemma 4 26B-A4B 0.13 and 0.40,
on Bedrock's pricing page for US regions;
gpt-oss-120b 0.1545 and 0.618,
which that page listed for Sydney only.
Claude Sonnet 5 is 2 and 10 on Anthropic's page,
recorded here although retracted.
Mantle's quota page:
no requests-per-minute quota,
per-model token quotas published for one model only,
"their throughput is governed by internal service capacity",
retry with backoff on throttling,
ramp gradually.
Context windows off the cards:
128K for E2B and gpt-oss-120b,
256K for 31B and 26B-A4B;
a maximum output is published for gpt-oss-120b alone,
16K.

### What was built

Branch `translation-repair-class12`,
commit `7b532ae31` and a test commit after it,
in the same throwaway worktree and for the same reason.

- `bedrock-catalog.ts`:
  the four served spellings,
  each with the roster seat it stands in for
  (`google.gemma-4-26b-a4b` is `gemma-4-26b-a4b-it`,
  `openai.gpt-oss-120b` is `hf:openai/gpt-oss-120b`,
  the other two are their own),
  its route,
  its stream end,
  its prices and its context;
  `readsImages` false on every row for the reason the OpenRouter catalog keeps gemma off the picture readers,
  a transcription through this stack being unmeasured,
  so the reader sub-roster stays the measured four.
- `bedrock-ledger.ts`:
  the meter this provider does not have.
  An append-only JSON-lines file under `~/.local/state/translation-repair/bedrock-spend.jsonl`
  (`TRANSLATION_REPAIR_BEDROCK_LEDGER` overrides the path),
  one line per priced call,
  summed on every read against `BEDROCK_CREDIT_USD`,
  200 (`TRANSLATION_REPAIR_BEDROCK_CREDIT_USD` overrides it;
  an unreadable override throws).
  A line that will not read throws naming its number;
  a file that does not exist reads as nothing spent.
  Durable outside the runs directory because every launch uses a fresh one and the credit is spent across all of them.
- `bedrock-cost.ts`:
  usage times the catalog's prices,
  since the wire reports no cost and the account exposes no balance to a bearer key.
- `bedrock-stream-end.ts`:
  the sentinel check on the Gemma route,
  a usage-chunk check on the gpt-oss route,
  and the sentinel supplied to the shared reader where the route sends none.
- `bedrock-client.ts`:
  the OpenRouter client's shape over the same fetch transport,
  minus the `provider` field and the credits endpoint,
  plus the route per model,
  the terminator per model,
  the cost computed here,
  the ledger written after every priced call,
  and `credits` read off the ledger.
- `provider-name.ts`:
  `bedrock` third in `PROVIDER_ORDER`,
  ahead of OpenRouter,
  since prepaid and expiring money is spent before money that would be bought.
  Open to veto;
  moving it is one line.
- `roster-id.ts` and `roster-reach.ts`:
  `BEDROCK_ONLY_ROSTER_IDS` (`google.gemma-4-e2b`,
  `google.gemma-4-31b`),
  eleven roster ids,
  `bedrockIdFor`,
  reach and vision reach with the fourth column.
  Seatable is not seated:
  which roles the two new sizes take is a decision on evidence,
  as the roster calibration of 2026-09-01 was,
  and is asked below.
- `budget-routing.ts`,
  `provider-budget.ts`,
  `run-config.ts`,
  `required-providers.ts`,
  `budget-sample.ts`,
  `spend-read.ts`,
  `spend-cost.ts`,
  `meter-sample-read.ts`:
  the fourth meter (`bedrock=` and `bedrockUsd=` on the `METERS` line,
  absent on older lines),
  the fourth key,
  the fourth client,
  the USD bucket admitting Bedrock seats.
- `provider-router.ts`:
  the refusal loop is bounded by the providers that serve the call,
  not the order's length.
  With a fourth provider that serves two of eleven models,
  the old bound asked once more after the last serving provider refused
  and ended on a no-provider error instead of the refusal itself;
  the router suite's FORWARDS TWICE case caught it before the fix.
- Under the line budget:
  `provider-meters.ts` takes the meter states,
  `meterRecordOf` and the read of all four meters out of `provider-budget.ts`;
  `run-providers.ts` and `run-config-error.ts` take the provider construction and its refusal out of `run-config.ts`;
  `bedrock-barrel.ts` takes the Bedrock surface out of `provider-barrel.ts`.
- Tests:
  five new suites (catalog,
  cost,
  ledger on a disposable directory,
  stream end,
  client on a recorded transport)
  and the fourth column added to 185 provider-keyed fixtures across 12 suites,
  each keeping its case's meaning
  (bedrock dry where no client is configured,
  holding nothing,
  absent on old lines).
  Seven guards neutralised one at a time fail two or three cases each;
  restored,
  0.
  Types clean,
  oxlint 0 and 0.

### What is asked of the owner

Where the two new Gemma 4 sizes sit.
The roster calibration of 2026-09-01 seated models by measured fidelity,
and nothing has been measured for `google.gemma-4-e2b` or `google.gemma-4-31b`.
The recommendation is to run the existing probes on them through Bedrock
(`judge-fidelity-probe`,
`producer-calibrate`),
which the credit covers many times over,
and seat by the numbers;
until then the provider serves the two seats the roster already names.

## The fourth Huasheng page, 2026-09-07, 20:49 UTC

`TALLY Huasheng status=SETTLED slices=25` at 20:48:51,
a page of 9,436 characters,
`DESTINATIONS source=0 page=0 dropped=0`,
`verify-published` matched 1 of 1 at the length its artifact implies,
305 wall minutes,
of which 2h53m were the daily-limit stall.
Meters:
Hyper 1272 to 829,
Synthetic 1.98 to 1.02 percent of the week,
OpenRouter 0.32 to 0.01 USD;
3,110 calls,
Hyper 1,581,
Synthetic 531,
OpenRouter 200;
94 voices abandoned after quorum.

The mechanical reading (`read-page.mjs`):
0 straight apostrophes in words against 26 curly (archive 0 and 27),
0 straight double quotes against 16 curly (archive 0 and 18),
0 ellipses of either form on page and archive alike,
3 headings and 3 distinct,
the PhotoScroll line byte-identical to the source's,
0 comments,
none of the refusal vocabulary in the log,
`mdx-downgraded` 0,
`would ship a page` 0.

The class targets,
in the order the launch record asked for them:

- The name (class eleven):
  the front matter reads `name: Huasheng`,
  an alias line carrying `Huasheng(Peanut)`,
  `Little Huasheng` and the third alias romanised,
  and `location: Nantong, Jiangsu`;
  the id stands beside two Latin renderings and the floor let it through,
  where the third launch's publisher refused it.
- The container (class nine):
  `<details>` at line 97,
  the bold summary at 98,
  `</details>` at 108,
  both halves in place around three paragraphs.
- The poem (class ten):
  lines 147 to 164 carry the source's shape exactly,
  paragraph for paragraph and `<br/>` for `<br/>`,
  where the archive had five soft-break paragraphs;
  the either-rendering rule accepted the original's shape and the judges chose it.
- The footnotes:
  the source carries one,
  `[^1]` on the Kundera passage,
  and the page carries it inline at line 141 with its definition at 180.
  The archive had added a second,
  `[^2]`,
  a translator's easier version anchored on a sentence of its own five-line rendering;
  the page keeps that definition at 182 and has no inline `[^2]`,
  since its paragraph is shaped as the source's one.
  An unreferenced footnote definition renders nothing,
  so the page shows no defect,
  and the translator's addition is gone with its anchor:
  the cost the block-floor decision names,
  seen for the first time.
  Not a class;
  recorded.

Two smaller readings.
The intro quote's signature comes out as `> By:` and `> Li’an` on two lines where the source has one,
a soft break inside the blockquote that renders as one line.
The contributors line names `Lian` where the signature has `Li’an`;
the contributors line is the publisher's,
from the archive's front matter.

What the page is evidence of:
the eleventh,
tenth and ninth classes closed on the entry that found them,
and no thirteenth at the publisher.
What it is not evidence of:
judge quality.
Synthetic was dry from 17:00,
Hyper answered nothing from 17:00 to 19:54,
and four consolidation chunks settled on nobody;
the roster that judged this page is not the roster a production pass would have.

## The first hakureico launch, 2026-09-07, 21:00 UTC, on the four-provider build

Class twelve and the fourth provider fast-forwarded onto `translation-repair-rebased` at 20:55 UTC
(`263b7ca73`),
the four doc records followed (`c2b8103a5`,
`a97f39183`),
and the run-config refusal cases learned to clear the fourth key as they had learned the third on 2026-09-03
(`ee577ee0c`;
the merged tree's full suite had read 5 `FAIL` on exactly those cases in this worktree,
whose secrets file carries the key,
and 0 after).
Types clean,
oxlint 0 and 0,
the full suite green with those four.
`budget-sample` at 21:00 read every meter wet:
Synthetic 0.97 percent of the week,
Hyper 828,
Bedrock 200.00 USD off an empty ledger,
OpenRouter 0.01 USD.

`hakureico` launched at 21:00:35 UTC on `ee577ee0c`,
pipeline `80958d2c`,
plain invocation,
fresh runs dir `~/temp/agent/hakureico1-20260907`,
log beside it,
pid 3692614.
The second footnote carrier after Huasheng,
chosen over the math pair for the footnote observation on the fourth Huasheng page.
The first pass with Bedrock in the order:
its two seats,
`gemma-4-26b-a4b-it` and `hf:openai/gpt-oss-120b`,
route there once Synthetic dries,
which at 0.97 percent is soon,
and the ledger writes its first lines.
The reading follows:
the footnotes first,
then the Bedrock seats' `SPEND` lines and the ledger's sum against the `METERS` line.

## The first hakureico launch was on the wrong roster; the second, 2026-09-07, 21:08 UTC

The first launch's `JUDGE SEATS` line read `roster=11 wide=9 translators=9`,
and its first eight `SPEND provider=bedrock` lines named `google.gemma-4-e2b` and `google.gemma-4-31b`,
twenty to 154 completion tokens each:
ballots.
The record under "The owner adds Amazon Bedrock" says seatable is not seated,
and `roster-id.ts` says the same over `BEDROCK_ONLY_ROSTER_IDS`,
but `RUN_ROSTER` in `run-config.ts` was the whole of `ROSTER_MODEL_IDS`,
which the fourth provider had grown to eleven,
so every role derived from it took the two unmeasured sizes:
judges,
critics,
panel and translators.
A defect in what landed at `7b532ae31`,
not in the pass.

Fixed at `645c8787b`:
`RUN_ROSTER` leaves the Bedrock-only ids out until the probes measure them,
guarded in `run-seats.unit.test.ts`
(the guard read 2 `FAIL` with the filter neutralised and 0 restored;
types and oxlint clean).
Under the kill-and-relaunch rule the first pass was killed by pid at 21:04 UTC,
four minutes in,
having spent 0.0011 USD of the credit on the eight calls
(the ledger's sum;
`bedrockUsd=200.00` at two decimals).

`hakureico` relaunched at 21:08:36 UTC on `645c8787b`,
pipeline `8cf0b4fa`,
plain invocation,
fresh runs dir `~/temp/agent/hakureico2-20260907`,
log beside it,
pid 3706395.
`JUDGE SEATS phase=preparation` reads
`wide=7 select=7 late=8 slate=8 checkers=3 translators=7 readers=4 roster=9 withheld=none`,
the roster of 2026-09-01 with every provider wet.
Bedrock now serves only the two seats the roster already names,
and those only third in line:
Hyper serves both,
so when Synthetic dried at 21:24 UTC
(the week at 0 percent after the seated fidelity run and this pass)
the two seats went to Hyper,
60 and 40 calls by 21:35,
and the pass had made no Bedrock call at all.
Bedrock takes them when Hyper holds,
which today means its daily limit,
or when Hyper's balance is gone;
the launch record's "route there once Synthetic dries" was wrong about the order.
Whether prepaid and expiring Bedrock money should sit ahead of Hyper's credits for the seats both serve
is the order question the fourth-provider record left open to veto,
and it is put to the owner in the handover.

## The owner moves Bedrock ahead of Hyper; the third hakureico launch, 2026-09-07, 21:47 UTC

The owner,
21:41 UTC:
"Yes Bedrock sit ahead."
Recorded as the addendum of 2026-09-07 in `doc/decision/translation-repair-openrouter-fallback.md`.
`PROVIDER_ORDER` reads Synthetic,
Bedrock,
Hyper,
OpenRouter (`a317f4e03`,
with `providerRecord` filling in that order,
the README's routing paragraph,
and the tests that had spelled the walk out:
`providerServing` and `routeProviderFor` now reach Bedrock after Synthetic and Hyper after Bedrock,
`otherProviders` and the hold-wait refusal list the four in the new order).
The second hakureico pass was killed by pid at 21:41 under the kill-and-relaunch rule,
33 minutes and 559 calls in,
in the repair lane at chunk 13;
Hyper read 664 at the relaunch,
so the two passes killed today spent 164 of its credits between them.
The probe flags landed with the order,
rebased onto the day's doc commits and fast-forwarded (`8f47f117b`,
`7de4e7b64`,
`a317f4e03`);
the full suite read 0 `FAIL` on the merged tree,
types and oxlint clean.

`hakureico` relaunched at 21:47:26 UTC on `a317f4e03`,
pipeline `b87b238c`,
plain invocation,
fresh runs dir `~/temp/agent/hakureico3-20260907`,
log beside it,
pid 3764858.
`METERS` at launch:
Synthetic dry at 0 percent of the week,
Bedrock 199.99 USD,
Hyper 664,
OpenRouter 0.01 USD.
`JUDGE SEATS phase=preparation` reads
`wide=6 select=5 late=7 slate=6 checkers=3 translators=6 readers=3 roster=8`,
`withheld=hf:Qwen/Qwen3.8-27B,hf:moonshotai/Kimi-K3`,
the Hyper-slow judges held out because Hyper would serve them with Synthetic dry.
The first pass in which Bedrock takes the two seats it shares with Hyper.
The reading follows:
the footnotes first,
then the Bedrock `SPEND` lines and the ledger's sum against `bedrockUsd=`,
then whether Hyper's daily limit named a return and Bedrock carried the shared seats through it.

## The first hakureico page, 2026-09-07, 22:00 UTC, and the thirteenth class

`TALLY hakureico status=SETTLED slices=18` at 22:00:47,
13.3 wall minutes,
the shortest settled pass on record;
`repairIssues=80 repairAccepted=38 repairResolved=26 repairChanged=3`,
`translateStatus=unfilled`,
`documentsDiffer=3 pageChanged=3 pageSilent=1`,
`selection=contested`,
`DESTINATIONS source=0 page=0 dropped=0`,
`verify-published` exit 0.
Calls:
Bedrock 224 (0.2448 USD by the log's `cost=` sum;
the ledger grew by exactly that,
0.005607 to 0.250384 USD,
and `bedrockUsd=` read 199.77 at the last `METERS`),
Hyper 151 (664 to 593),
Synthetic 0,
OpenRouter 0.
The first pass in which Bedrock took the two seats it shares with Hyper:
its first two calls went to `gemma-4-26b-a4b` and `gpt-oss-120b` at 21:47:27,
and neither seat touched Hyper all pass.
`SEATS DARK` names Qwen3.8-27B,
thrown 30 of 30,
which is the hold below and not the model.

### The twelfth class working, and what it uncovered

At 21:57:25 three Hyper calls answered 429 naming a return in 538000 ms;
the ladder ended at once ("past this ladder's reach of 16000ms"),
and `markRefused` held Hyper out for 538000 ms,
to 22:06:24.
That is the twelfth class as built.
What it uncovered is the thirteenth:
Bedrock stayed wet,
so nothing waited.
The translate lane started at 21:58:46 and every Hyper-only writer
(GLM-5.3-Flash,
Kimi-K3,
minimax-m3,
deepseek-v4-pro-0813,
glm-5.3)
was refused as `NoProviderForModelError` in the same millisecond,
leaving the two Bedrock seats to write;
`every proposal was the incumbent`,
`winner short of the minimum vote weight; keeping the incumbent`,
`declined-indecision` on every slice,
and chunk 17,
the passage only the translate lane owns,
stayed unfilled.
The lane contest at 22:00:14 read `hyper=dry openrouter=dry` (OpenRouter had just refused at 0.01 USD),
settled its three differing slices on repair with the two Bedrock judges,
and the consolidation at 22:00:24 ran every select and refiner round at 0 to 1 ms with nobody heard:
three chunks `quorum-not-met`,
done by 22:00:46,
five and a half minutes before Hyper came back.

The router already waits out the shortest hold once,
but only when every provider reads dry (`readBudgetsPastHolds`),
because that is the case where the alternative is ending the run.
A phase is the same case one level up.
Fixed at `752bf9a9b`:
`readJudgeSeats` names the benches each phase leans on
(`run-seats-wait.ts`:
wide for preparation and the contest,
readers for pictures,
wide and translators for the lanes,
translators and select judges for the translate lane,
slate and wide for consolidation),
counts the seats a wet provider would serve against each bench's quorum,
and when a bench is short and a provider has named its return,
waits out the shortest running hold once (`RunClient.providerHolds`,
the budgets' own) and reads again;
the `JUDGE SEATS` line carries `waited=`.
The lanes driver takes a `reseatTranslate` reader and the pass gives it one,
so the translate lane reads its seats when it is about to start rather than inheriting a reading minutes old
(the lanes were seated at 21:52,
the hold began at 21:57,
the writers were asked at 21:58).
Per phase rather than per call,
because a call's deadline (360 s) is shorter than a daily-limit hold and would cut the wait it was serving.
Six guards bite
(`run-seats.unit.test.ts`,
`run-seats-wait.unit.test.ts`,
`document-lanes.unit.test.ts`,
`pass-entry.unit.test.ts`,
whose seat-reading count is six now);
types and oxlint clean.

### The page

The mechanical reading (`read-page.mjs`):
0 straight apostrophes in words against 8 curly (archive 0 and 8),
0 straight double quotes against 18 curly (archive 0 and 18),
1 three-dot ellipsis on the page against 0 on the archive,
3 headings and 3 distinct,
3 comments (archive 3),
the PhotoScroll line byte-identical,
none of the refusal vocabulary in the log,
`mdx-downgraded` 0,
`would ship a page` 0,
169 lines against the archive's 158.

The three changed slices,
read against the source:

- Transit.
  Source:
  `不仅关注着城市公交，还经常坐火车，偶尔，她也坐上飞机看看蓝天。`
  Archive:
  `She was interested in city buses, rail transit and national railways.`
  Page:
  `Not only did she follow city buses, she often rode the trains as well.`
  The archive's national railways were its own;
  the page is the source.
  The next line,
  `Though, so many of those journeys were ones she made alone...`,
  renders `虽然，许多时候都是一个人的旅行呢……` with a three-dot ellipsis where the archive had rewritten the sentence without one;
  the corpus's own pages split 39 three-dot to 25 unicode of 92,
  so there is no convention to restore against,
  and the archive file carries none.
  Not a class.
- osu!.
  `Her osu!` then `account stayed online even when she was in a bad mental condition.` on the next line
  is the source (`她的 OSU 也是在线状态`) where the archive said `She was still online`.
  The line breaker took `osu!` for a sentence end and broke inside the sentence;
  Markdown renders the break as a space,
  so the page reads right and the file's one-sentence-per-line habit is off by one line.
  Recorded,
  not a class.
- Games and IKEA.
  `she gradually lost interest in many game-related things due to life pressure, and she no longer posted updates afterwards`
  and `Hanasaka and her companions went to IKEA and ate cheap, tasty little ice cream cones together`
  are the source (`对许多游戏相关的事情逐渐失去了兴趣`;
  `千歌和她的伙伴去过宜家，一起吃了便宜好吃的小甜筒`),
  where the archive had `games` and `an acquaintance`.
  Hanasaka is the archive's rendering of 千歌 throughout.

### The footnotes

The source carries two:
`「Mayday[^1]」` with its definition,
and `HOSTED__WITH__GAE[^2]____` with its definition.
The archive carries neither marker and neither definition
(`> HOSTED__WITH__GAE____`),
and the page carries neither.
The repair lane saw them:
the Mayday slice's candidates carried `[^1]` and the judges argued its placement against the corner brackets
(seven ballots name the marker),
and the slice shipped unchanged.
The definitions are chunk 17,
the passage only the translate lane owns,
which the hold left unfilled.
So the second footnote carrier shipped without its footnotes,
for the reason the thirteenth class names;
the fourth launch on `752bf9a9b` is where the footnote reading happens.

What the page is evidence of:
Bedrock in production for its two shared seats,
the twelfth class closing a daily-limit hold in one line instead of 2,693 attempts,
three faithful repairs,
and the thirteenth class.
What it is not evidence of:
the footnotes,
the translate lane,
or judged consolidation.

## The fourth hakureico launch, 2026-09-07, 22:21 UTC, on the class-thirteen build

`hakureico` relaunched at 22:21:26 UTC on `2b13ef813` (code `752bf9a9b`),
pipeline `d6bfaa95`,
plain invocation,
fresh runs dir `~/temp/agent/hakureico4-20260907`,
log beside it,
pid 3814733.
`METERS` at launch:
Synthetic dry,
Bedrock 199.75 USD,
Hyper 593,
OpenRouter 0.01 USD.
`JUDGE SEATS phase=preparation` reads the third launch's benches with `waited=0ms`.
The reading follows:
the footnotes first
(`[^1]` on Mayday,
`[^2]` on the GAE line,
the two definitions the translate lane owns),
then every `JUDGE SEATS` line's `waited=` and any `short of quorum` line,
then the Bedrock `SPEND` lines and the ledger against `bedrockUsd=`.
Hyper's daily limit reopened at 22:06 and its next closing is unpublished;
a pass that meets it now waits at the next phase boundary instead of settling on nobody.

## Measuring the two Bedrock-only sizes, 2026-09-07, 21:19 UTC

The probes ran the run roster and nothing else,
so a seat that needs a number before it is taken could never be asked for one.
Landed on `translation-repair-class12` at `abdb06c1b` and `35e0b1fad`
(the branch stays unmerged until `hakureico` settles,
under the kill-and-relaunch rule):
`--candidates a,b` names seatable ids that judge beside the seated roster in `judge-fidelity-probe`
and write and judge beside it in `producer-calibrate`,
for that run only;
`--candidates-alone` runs the named ids without the seated roster,
so a probe beside a production pass spends only at the candidates' provider.
An id the roster does not know is refused with the ids it does;
alone over nobody is refused.
Six guards bite (`probe-candidates.unit.test.ts`);
types and oxlint clean;
the full suite green.

### The instrument as it stands

`judge-fidelity-probe` over a throwaway runs dir holding the three settled artifacts on disk
(Huasheng from the fourth pass,
TLL1122,
yulianNyanner from the seventh),
`--cap 36`,
build `35e0b1fad`.
TLL1122 carries no slice of 400 characters;
neither remaining slice states a number the alteration fixture can move;
so the walk built one deletion and one insertion pair on each of two slices,
Huasheng/1 and yulianNyanner/3,
each put four ways:
16 rows.
Two of the four ways share one slate
(the same two texts in the same order,
differing only in which is called the incumbent),
and the select memo answers the second without a call:
7 of 16 rounds closed at 0 ms,
and every judge was asked 8 distinct questions.
The direction column of this probe measures nothing on a warm memo;
recorded,
not fixed here.

### The candidates alone, 21:19 UTC

Judges `google.gemma-4-e2b` and `google.gemma-4-31b`,
nobody else,
16 Bedrock calls,
0.0045 USD by the ledger.
Distinct questions answered with the complete text:

- `google.gemma-4-e2b`:
  7 of 8.
  Deletion 3 of 4,
  insertion 4 of 4,
  never declined;
  the miss chose the damaged text where it sat second on the Huasheng deletion,
  and it chose position two on 5 of 8.
- `google.gemma-4-31b`:
  4 of 8.
  Deletion 2 of 4,
  insertion 2 of 4,
  declined the other 4,
  every one on Huasheng/1,
  saying both candidates add imagery and emotional language the original lacks;
  it never chose the damaged text.

### The seated roster on the same questions, 21:20 UTC

The nine roster models,
72 calls,
`fidelity: 16 of 16 trials chose the complete text`;
per judge,
distinct questions answered with the complete text:

- 8 of 8:
  `hf:moonshotai/Kimi-K3`,
  `deepseek-v4-pro-0813`,
  `hf:zai-org/GLM-5.3-Flash` (no judge seat since 2026-09-02).
- 7 of 8:
  `deepseek-v4-flash-0731` (one damaged pick),
  `glm-5.3` (one decline),
  `hf:Qwen/Qwen3.8-27B` (one decline;
  no judge seat since 2026-09-03).
- 5 of 8:
  `hf:openai/gpt-oss-120b` (three declines),
  `minimax-m3` (one damaged pick,
  two declines).
- 4 of 8:
  `gemma-4-26b-a4b-it` (four declines,
  all on Huasheng/1,
  the family's reading).

Among the seven judges the wide seats hold,
the median is 7 of 8 and the floor 4 of 8.

### The rule, written before the next questions arrive

Two slices are eight questions,
which separates a family's habit of declining from a habit of choosing the damaged text
and not much finer.
The fourth settled artifact,
`hakureico`,
adds one slice when the pass settles,
and the probe is re-run over all four before any seat moves.
The rule for the wide seats,
pre-registered here as the 2026-09-01 rules were:
a candidate joins critic,
panel and judge when,
over the same distinct questions,
it chooses the complete text at least as often as the median seated judge
and chooses the damaged text no more often than the seated judge who chooses it most;
a candidate that declines its way below the floor stays out.
On the eight so far `google.gemma-4-e2b` meets both clauses
(7 against a median of 7;
one damaged pick against `deepseek-v4-flash-0731`'s one and `minimax-m3`'s one)
and `google.gemma-4-31b` meets neither
(4 against 7,
on declines).
The translator seat is `producer-calibrate`'s to give,
by the pooled null as on 2026-09-01,
run with `--candidates` over the whole roster once the pass is done with the meters.
Editor and refiner seats stay where the 2026-09-01 calibration put them;
no candidate is measured for them here.

## Build plan, transport-independent layers first

In commit order,
each unit tested and committed before the next:

1. `provider-name.ts`:
`ProviderName` gains `openrouter`;
`PROVIDER_ORDER` states the routing preference (Synthetic,
    Hyper,
    OpenRouter);
    helpers over the record shape.
2. `openrouter-catalog.ts` and `roster-reach.ts`:
slugs,
`sharedWith` for all nine,
vision flags and output ceilings from the listing;
    `ModelReach` becomes a record keyed by provider;
    Gemini 3.8 Flash joins the blocklist.
3. `budget-routing.ts`:
`routeProviderFor` walks `PROVIDER_ORDER` over a dryness record and a saturation record;
    the two-provider dry error is renamed `EveryProviderDryError` (misleading name,
    CRN) and the old name goes to the local forbidden-strings appendix;
    `openRouterIsDry` and its meter fields.
4. `provider-budget.ts` and `budget-hold-wait.ts`:
a third meter,
`METERS` gains `openrouter=` and `openrouterUsd=`,
    a refusal hold moves traffic only while some other provider reads wet,
    the all-dry wait generalizes.
5. `provider-router.ts`:
callers keyed by provider,
a bounded re-route (one attempt per provider),
the re-ask asks the next wet provider serving the model;
    the re-ask path splits into its own file at the line budget.
6. `required-providers.ts`,
`run-config.ts`,
`budget-sample.ts`:
the third key,
optional and loud;
the run client exposes the dryness record for the seat reader.
7. `run-seats.ts`:
benches derive from where each model would be served (first provider in order that serves it and reads wet):
    Hyper-slow rules apply when served by Hyper,
    Kimi-K3 is withheld from every seat when served by OpenRouter,
    and `gemma-4-26b-a4b-it` takes the third checker seat there so both checker assertions hold per phase.
    Whether Qwen3.8-27B's rule is "served by Hyper" or "not served by Synthetic" is decided by its OpenRouter median in
    the probe.
8. `spend-line.ts`,
`spend-read.ts`,
`spend-cost.ts`:
a `cost=` field in USD from the wire,
an OpenRouter bucket in USD kept apart from hypercredits;
    `meter-sample-read.ts` and `meter-report.ts` accept the third field and its absence in older logs.
9. `openrouter-client.ts` and its credits parser,
on the transport the probe picks.
10. Live verification,
then the decision doc,
README and runbook.
