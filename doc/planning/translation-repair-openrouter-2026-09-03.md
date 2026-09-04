# Translation repair: OpenRouter as the paid fallback provider

Planning record, 2026-09-03.
Nothing here is ratified; the owner's answers to the questions at the end decide the seating.
Measurements were taken on 2026-09-03 between 15:24 and 15:45 UTC unless dated otherwise.

## Why now

The owner on 2026-09-03: Charm Hyper ended its bundle subsidization,
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
    Runs measured off the `METERS hyperBalance=` line, first to last, cost 724 (XIEPT2 postscript),
    654 (XIEPT2 stub fix), 654 (Carena0442 rerun of 2026-09-02) and 428 (Toka_ls rerun 2 of 2026-09-02).
    That balance buys three to five more entry runs and will not be topped up.

## What OpenRouter answered

### Account and meter

- `GET https://openrouter.ai/api/v1/key` with the ordinary key: `limit: null`, `limit_remaining: null`,
    `usage: 0`, `is_free_tier: false`, `is_management_key: false`.
- `GET https://openrouter.ai/api/v1/credits` with the same ordinary key answered `200` with
    `total_credits: 1913` and `total_usage: 1855.383100082`, so the balance is about 57.62 USD,
    matching the owner's figure.
    The endpoint's own page says a management key is required;
    the live call says otherwise.
    Recorded as a discrepancy rather than resolved;
    the meter will be built on the live behaviour with an unreadable meter counting as spendable,
    which is this package's existing rule (`provider-budget.ts`).
- Purchase fee per the FAQ: 5.5% with a 0.80 USD minimum by card, 5% by cryptocurrency.
    Credits may expire one year after purchase.
- Rate limits page: paid models carry no documented request ceiling beyond DDoS protection;
    `429` arrives as a status or as an in-stream `finish_reason: "error"`,
    `402` when credits are insufficient.
    Free variants (`:free`) are capped at 20 requests per minute and 1,000 per day.

### Transport

- `POST https://openrouter.ai/api/v1/messages` speaks the Anthropic Messages format:
    `Authorization: Bearer`, streaming SSE in Anthropic event shapes, `tools` and
    `tool_choice: {type: "tool", name}` forced tool use, OpenRouter model slugs in `model`,
    a `provider` object in the body, and usage carrying `input_tokens`, `output_tokens` and an optional `cost` in USD.
    This is the protocol `hyper-client.ts` already speaks,
    so `buildAnthropicBody`, `extractAnthropicCompletion` and `wireFormat: 'anthropic'` are reusable.
- The `provider` object supports `order`, `only`, `ignore`, `allow_fallbacks`, `require_parameters`,
    `data_collection: 'deny'`, `zdr: true`, `sort`, `max_price` and quantization filters.
    The account-level allowed-provider list is a ceiling over request-level `only`;
    account-level ignores merge with request-level ones.
- Zero data retention: `zdr: true` per request ORs with the account setting.
    `GET https://openrouter.ai/api/v1/endpoints/zdr` listed 834 ZDR endpoints.

### Batch

From the batch quickstart:
`POST https://openrouter.ai/api/beta/batches` with `endpoint`, `model` and inline `requests[]`,
polled at `GET /api/beta/batches/:id`, results inline on completion,
text only, the only completion window `24h`,
priced at "50% of the model's standard per-token pricing".

The `:batch` entries in the public listing, USD per million prompt and completion tokens,
against the realtime entry of the same model:

- `moonshotai/kimi-k3`: batch 3 and 15; realtime 3 and 15.
- `minimax/minimax-m3`: batch 0.3 and 1.2; realtime 0.3 and 1.2.
- `deepseek/deepseek-v4-flash-0731`: batch 0.14 and 0.28; realtime 0.065 and 0.18.
- `z-ai/glm-5.3-flash`: batch 0.15 and 0.5; realtime 0.075 and 0.25.
- `openai/gpt-oss-120b`: batch 0.15 and 0.6; realtime 0.037 and 0.17.
- `qwen/qwen3.8-27b` and `z-ai/glm-5.3`: no `:batch` entry.

Which price the "50% of standard" claim discounts from is not established here;
the listing's realtime column is the cheapest endpoint,
and the batch column may discount a single provider's list price.
What is established: for this roster, the listed batch price is never below the listed realtime price,
and two roster models have no batch entry at all.

The structural fact matters more than the price.
A corpus pass is a chain of dependent rounds (critics, panel, editors, judges, contest, consolidation),
about fifty per entry, each waiting on the previous one,
and every round is built on streaming quorum with straggler and writer grace.
A batch whose only window is 24 hours cannot carry that chain within rule `FIT` or `FT2`,
and the guards that keep a stage honest (quorum, grace, abandonment) have no meaning over a batch.

## Roster models on OpenRouter

Spellings, realtime USD per million prompt and completion tokens, total endpoints, ZDR endpoints,
and whether the owner's allowlist carries the model:

- `moonshotai/kimi-k3`: 3 and 15; 18 endpoints, 16 ZDR; allowlisted.
- `minimax/minimax-m3`: 0.3 and 1.2; 11 endpoints, 7 ZDR; allowlisted.
- `deepseek/deepseek-v4-flash-0731`: 0.065 and 0.18; 30 endpoints, 22 ZDR; allowlisted.
- `deepseek/deepseek-v4-pro-0813`: 0.66 and 1.98; 18 endpoints, 13 ZDR; NOT allowlisted.
- `qwen/qwen3.8-27b`: 0.425 and 2.55; 12 endpoints, 9 ZDR; allowlisted.
- `z-ai/glm-5.3`: 1.4 and 4.4; 25 endpoints, 22 ZDR; allowlisted.
- `z-ai/glm-5.3-flash`: 0.075 and 0.25; 23 endpoints, 19 ZDR; allowlisted.
- `google/gemma-4-26b-a4b-it`: 0.07 and 0.34; 9 endpoints, 7 ZDR; NOT allowlisted.
- `openai/gpt-oss-120b`: 0.037 and 0.17; 20 endpoints, 20 ZDR; NOT allowlisted.

Every roster model has at least seven ZDR endpoints, so `zdr: true` removes no model.

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

Method: every `SPEND provider=... model=... prompt=N completion=N` line of a completed run,
mapped through the spelling map and priced at the realtime rates of the 2026-09-03 listing
(`~/temp/agent/openrouter-models-20260903.json`).
Calls whose provider reported zero usage (15 to 42 per run, mostly `glm-5.3` on Hyper) price at zero,
so every total is a floor.
Script: `price-runs-on-openrouter.mjs` in the session scratchpad; it is a measurement aid, not package code.

- XIEPT2 postscript (219 minutes, 2197 calls): 14.41 USD, Kimi-K3 8.74 (61%), 5.67 without Kimi.
- XIEPT2 stub fix (146 minutes, 2024 calls): 12.48 USD, Kimi-K3 7.36 (59%), 5.13 without Kimi.
- Carena0442 rerun 2026-09-02 (190 minutes, 1938 calls): 13.52 USD, Kimi-K3 7.76 (57%), 5.75 without Kimi.
- Carena0442 four-entry pass 2026-09-01 (94 minutes, 1749 calls): 11.40 USD, Kimi-K3 5.90 (52%), 5.50 without Kimi.
- Toka_ls rerun 2 2026-09-02 (100 minutes, 1259 calls): 6.78 USD, Kimi-K3 4.08 (60%), 2.70 without Kimi.

After Kimi, the next largest lines are Qwen3.8-27B (0.88 to 2.74), minimax-m3 (0.69 to 1.29),
GLM-5.3 (0.48 to 1.15) and DeepSeek V4 Pro (0.47 to 1.08).
The three models absent from the allowlist together cost 0.12 to 1.26 per entry.

Auto top-up arithmetic: the observed cadence is three to four entries a day,
so a day bought entirely on OpenRouter is about 50 USD with Kimi-K3 seated and about 20 USD without.
The fee is a percentage with a 0.80 floor,
so a top-up above about 15 USD pays the same rate whatever its size;
the amount only decides how often the purchase happens.
A threshold of 20 USD (one XIEPT2-scale entry plus margin) and a top-up of one day's spend follows.

## Decisions taken here, open to veto

- Routing order: Synthetic while wet, then Hyper while its balance lasts, then OpenRouter.
    This is the plain reading of the owner's two messages of 2026-09-03 taken together.
- Transport: the Anthropic Messages endpoint with forced tool use,
    reusing the Hyper request builder and stream reader with a different URL and auth header.
    `provider.require_parameters: true` so only endpoints supporting `tools` and `tool_choice` are eligible,
    `provider.ignore` for any endpoint that measures badly.
    Conformance is measured twenty times per model before a model is seated on this provider,
    as the Hyper decision did.
- Meter: `GET /api/v1/credits`, balance as `total_credits - total_usage`;
    dry at or below zero; unreadable counts as spendable; `402` and `429` are refusal holds.
    No management key is needed while the ordinary key answers.
- Gemini 3.8 Flash joins the roster blocklist on the owner's words ("a wildly misaligned model").
- `:free` variants are not used: 20 requests per minute and 1,000 per day cannot carry a corpus pass,
    and their data policy is the provider's, not ours.
- Spend lines carry OpenRouter's reported `cost` in USD when present,
    so the price table is a fallback rather than the source.

## Constraints for the build

- Generalize the router to an ordered provider list rather than a third boolean;
    `ProviderName`, `BudgetView`, `ModelReach`, `readBudgetsPastHolds`, `secondOpinionFrom`
    and the all-dry error all encode two providers.
- Seat withholding in `run-seats.ts` is keyed to `syntheticDry` alone;
    with OpenRouter serving Qwen3.8-27B and Kimi-K3, re-derive withholding from where each model would be served.
- Check `anthropic-delta-scan.ts` against OpenRouter's stream: a `[DONE]` sentinel and comment keep-alives
    must not count as unreadable frames; pin with a case taken off the wire.
- Verify where usage lands in the OpenRouter stream before trusting `SPEND` lines.
- `required-providers.ts` accepts `openrouter`; the key is optional and loud like Hyper's.
- Concurrency and any request-rate ceiling on OpenRouter are unmeasured; run the width probe first.

## Questions put to the owner

Asked on 2026-09-03 after this record was written:

1. Batch API: not viable for the pass as designed; use realtime, or redesign for batch.
2. Kimi-K3 when only OpenRouter would buy it: seat at 3 and 15 USD per million, or withhold it there.
3. Allowlist: add `openai/gpt-oss-120b`, `google/gemma-4-26b-a4b-it` and `deepseek/deepseek-v4-pro-0813`,
    or accept an OpenRouter tier without them.
    (As asked, the option text said this "leaves the editor stage on Qwen alone"; that was wrong,
    gemma is a translator and Qwen a checker. Corrected in the decision doc.)
4. Zero data retention: `zdr: true` on every request, or plain routing.

Answers, recorded in `doc/decision/translation-repair-openrouter-fallback.md`: realtime; withhold Kimi-K3 where only
OpenRouter would buy it; all three added to the allowlist; ZDR on every request.

## The `[DONE]` sentinel, fixed before the probe could measure

The first probe against `/api/v1/messages` answered 200 on every call and conformed on none,
because the gateway appends an `event: data` frame carrying `data: [DONE]` after `message_stop`
and `extractAnthropicCompletion` refused the body as "anthropic stream event is not JSON",
while `scanAnthropicDeltas` counted the frame as unreadable.
Both readers now skip the sentinel (`90dcb8745`), each pinned by a case taken off the wire,
and both cases were shown to fail with the skip removed.
The same capture showed the tool arguments arriving in several `input_json_delta` pieces,
usage and `cost` on `message_delta`, the serving provider on `message_start.message.provider`,
and `stop_reason: "end_turn"` on a completed tool call, none of which the reader minded.

## Probe v2: three transports per model

The owner, mid-session: OpenRouter likely supports OpenAI chat completions better,
and the Responses API is also supported (and may be the only route to GPT-5.6 Luna).
`~/temp/agent/openrouter-probe-v2-20260903.mjs` therefore drives each roster model twenty times through
each of `/api/v1/messages` (Anthropic format, forced tool, the pipeline's own builder and reader),
`/api/v1/chat/completions` (OpenAI format, `response_format` json_schema, the Synthetic body shape with the schema
restated in the system prompt) and `/api/v1/responses` (`text.format` json_schema),
every request carrying `provider: { zdr: true, require_parameters: true }`,
four calls in flight per model and transport, and writes one raw stream per model and transport plus a summary to
`~/temp/agent/openrouter-probe-v2-20260903/`.
GPT-5.6 Luna rides along as a candidate, not a roster model.

### Probe v2 results, 15:49 to 16:05 UTC

Conformant attempts of twenty, median milliseconds, and the endpoints that served, per model and transport
(chat = chat completions, msg = Messages, resp = Responses):

- `moonshotai/kimi-k3`: chat 20, 3819 ms (Fireworks, DeepInfra); resp 20, 4554 ms; msg 20, 30660 ms (DeepInfra).
- `minimax/minimax-m3`: chat 20, 1367 ms (ModelRun); resp 20, 1584 ms; msg 20, 3461 ms (Venice).
- `deepseek/deepseek-v4-flash-0731`: chat 20, 7252 ms (Inceptron, Parasail, Makora); resp 20, 5803 ms;
    msg 9 of 20, 7425 ms (DigitalOcean, Inceptron): eleven answers were not JSON.
- `deepseek/deepseek-v4-pro-0813`: chat 20, 6332 ms (Parasail); resp 20, 6755 ms; msg 20, 1566 ms (BaseTen).
- `qwen/qwen3.8-27b`: chat 20, 4856 ms (Parasail); resp 20, 5208 ms; msg 20, 10123 ms (Reka, AkashML).
- `z-ai/glm-5.3`: chat 20, 1068 ms (Together); resp 20, 1058 ms; msg 20, 1126 ms (Together).
- `z-ai/glm-5.3-flash`: chat 20, 7117 ms (Together, Modal); resp 20, 7639 ms; msg 20, 6890 ms (Together).
- `google/gemma-4-26b-a4b-it`: chat 20, 1325 ms (Google, Parasail); resp 20, 1813 ms; msg 20, 1780 ms (Google, NextBit).
- `openai/gpt-oss-120b`: chat 20, 664 ms (Cerebras); resp 20, 717 ms; msg 20, 721 ms (Cerebras).
- `openai/gpt-5.6-luna` (candidate): chat 9 of 20 (Azure), resp 11 of 20, msg 0 of 20 with HTTP 404
    "No endpoints found matching your data policy (Zero data retention)"; the failed chat and Responses
    attempts answered empty text (`response.failed`). Not viable under zero data retention as measured.

Every request cost is on the wire: 20 of 20 priced on every conformant row.
Whole probe: about 0.55 USD.

THE TRANSPORT IS CHAT COMPLETIONS, as the owner suggested mid-session: it conformed on every roster attempt and
answered fastest or within noise of fastest on every model, where Messages answered Kimi-K3 eight times slower and
conformed on 9 of 20 DeepSeek Flash attempts.
The Responses endpoint conformed too and is not used; one OpenAI-shaped path is one reader to maintain.

Qwen3.8-27B's chat median (4856 ms on a short prompt) sits in the band of the other models, unlike its Hyper
serving, so its withholding rule stays "served by Hyper" and it is seated when OpenRouter would serve it;
the live pass below is where that is checked on corpus-sized prompts.

Width: 32 concurrent chat completions per model on `deepseek/deepseek-v4-flash-0731` (32 of 32 conformant,
median 2852 ms, max 7776 ms; Together, Makora, OpenInference) and `z-ai/glm-5.3-flash` (32 of 32, median 7955 ms,
max 49581 ms; Together, Modal, Makora), no refusal.
The client therefore carries no per-model ceiling by default, like Hyper's.

## What landed, 2026-09-03

Commits `0aa800ab4` (source) and `433279f3c` (tests and lint), on top of `90dcb8745` (the `[DONE]` skip):

- `provider-name.ts`: `ProviderName` with `openrouter`, `PROVIDER_ORDER`, `ProviderRecord`, `providerRecord`,
    `otherProviders`, `isProviderName`.
- `openrouter-catalog.ts`, `openrouter-client.ts`, `openrouter-credits.ts`, `openrouter-cost.ts`: the chat
    completions client with `provider: { zdr: true, require_parameters: true, ignore: [] }` on every body, the
    credits meter, and the per-call USD cost read off the final chunk onto the `SPEND` line as `cost=`.
    gemma's OpenRouter row reports no pictures until a transcription is measured, so the reader roster is unchanged.
- `budget-routing.ts`: `routeProviderFor` walks `PROVIDER_ORDER` over dryness and saturation records;
    `providerServing` answers the seat reader's question; `EveryProviderDryError` replaces the two-provider name
    (old name in the local forbidden-strings appendix).
- `provider-budget.ts`, `budget-hold-wait.ts`: three meters, `METERS` gains `openrouter=` and `openrouterUsd=`,
    a wet refuser is held only while some other provider is wet, the all-dry wait is provider-generic.
- `provider-router.ts` with `provider-router-slots.ts` and `provider-router-reask.ts`: callers keyed by provider,
    one attempt per provider on refusals, the re-ask on the next wet provider serving the model, slots counted only
    where a provider states a ceiling.
- `run-seats.ts`: benches derive from `providerServing`; Hyper-slow rules apply where Hyper would serve;
    `OPENROUTER_WITHHELD` (Kimi-K3) applies where OpenRouter would; `OPENROUTER_CHECKER_SUBSTITUTE`
    (gemma) keeps the checker floor, and both checker assertions run per phase; the `JUDGE SEATS` line names every
    provider's state and every withheld model.
- `run-config.ts`, `run-client-contract.ts`, `required-providers.ts`, `budget-sample.ts`: the third key, optional and
    loud; the run client exposes `providerDryness`; `--require-providers` accepts `openrouter`.
- `spend-read.ts`, `spend-cost.ts`, `meter-sample-read.ts`, `meter-dry-span.ts`, `meter-report.ts`: the cost field
    and an OpenRouter USD bucket kept apart from hypercredits; older `METERS` lines read with the third state absent.
- `roster-blocklist.ts`: `google/gemini-3.8-flash` and its `:batch` spelling.

Guards shown to fail: the OpenRouter fallthrough (routing and router tests) with `openrouter` excluded from the
usable providers, and the Kimi withholding (seat test) with the check replaced by `true`; both restored and passing.
915 unit tests pass; oxlint and the type check are clean.

## The first live pass with OpenRouter in the order, keyword233, 16:38 to 16:54 UTC

Launched from the main repo with the Hyper key unset so the walk went Synthetic, then OpenRouter
(`~/temp/agent/openrouter-live-20260903.log`, artifacts beside it):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=957655`, inside the band of the day's earlier keyword233 runs
    (653 to 1,164 seconds). `verify-published` answered 1 of 1 pages with every promised wording at the implied length.
    The page reads as the earlier runs' pages did.
- `METERS synthetic=wet hyper=dry openrouter=wet` throughout; `JUDGE SEATS` at every phase seated the full benches
    with `withheld=none`, since Synthetic served Kimi-K3 and Qwen3.8-27B.
- 146 OpenRouter calls at 0.38 USD by the wire's `cost=`, 111 Synthetic calls, no Hyper call, no refusal from either;
    the meter read 56.94 before and 56.46 after, the probes of the same hour included.
- **MiniMax M3 came back empty on 16 of 31 OpenRouter calls**: `finish_reason=stop`, no content, some reasoning
    characters. The per-endpoint probe (`~/temp/agent/openrouter-minimax-endpoints-20260903`, corpus-sized
    json_schema request, `provider.only` per zero-data-retention endpoint) showed Parasail putting the whole JSON
    answer in the reasoning channel and closing content empty (0 of 2 conformant, 2 rate-limited), ModelRun
    answering 4 of 4, and the five other zero-data-retention endpoints refusing `response_format` with `404 No
    endpoints found that can handle the requested parameters`. Default routing without a preference went to
    ModelRun on 3 of 4 and Parasail on 1; with `ignore: ['parasail']` it went to ModelRun on 8 of 8, every one
    conformant. The catalog row now carries `ignoredEndpoints: ['parasail']` and the client sends it as
    `provider.ignore` (`7d680d7fa`, `3991637a2`); both guards shown to fail with the entry removed, restored and
    passing. The cost fit on the run's own `SPEND` lines agrees: the answered calls priced as ModelRun, the empty
    ones lower.
- Cut streams on OpenRouter, provider of the endpoint unknown because nothing logged it: `deepseek-v4-pro-0813`
    twice at 76 and 90 seconds with reasoning only, `gemma-4-26b-a4b-it` twice at 66 and 77 seconds with content
    arriving at under twenty characters a second, `deepseek-v4-flash-0731` once at 209 seconds in consolidation.
    Medians on OpenRouter: glm-5.3 1.6 s, MiniMax 2.0 s, DeepSeek Flash 3.8 s, gemma 5.3 s, DeepSeek Pro 17.5 s;
    ninetieth percentiles 2.2, 4.3, 42, 66 and 39 seconds. The endpoint name goes on the `SPEND` line next so the
    slow tail can be attributed without another probe.
- Nothing on this pass exercised the all-dry benches (Kimi-K3 withheld, gemma as substitute checker) or
    Qwen3.8-27B served by OpenRouter; both wait for a Synthetic-dry hour.

## The second live pass, keyword233, 17:06 to 17:28 UTC, with Parasail ignored and endpoints named

Launched as the first was (`~/temp/agent/openrouter-live2-20260903.log`, artifacts beside it), after
`7d680d7fa` (Parasail ignored for MiniMax M3) and `c21437745` (endpoint on every `SPEND` and stream line):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=1293410`, above the day's band (653 to 1,164 seconds).
    The lanes phase took 860 seconds against the first pass's 582;
    lane contest and consolidation each came within a minute of the first pass.
    Two things differed in that phase and this log does not separate their shares:
    a Synthetic 502/500 burst at 17:13 to 17:14 UTC (15 retry lines, none reaching the fifth attempt,
    none on the first pass), and 11 abandonments at the 60 second straggler grace against the first pass's 8.
    `verify-published` answered 1 of 1 (`wordings=3 silent=0 chars=787=expected missing=0`);
    the page reads as before.
- **The Parasail ignore held**: 36 of 36 MiniMax calls went to ModelRun and every one completed, mean 2.9 seconds,
    with one schema-mismatch (an answer whose every string field was `", "`),
    against 16 empty and 6 mismatched on the first pass.
- 0.4454 USD over 135 OpenRouter calls by the wire's `cost=` (DeepSeek V4 Pro 0.29 USD and two thirds of it,
    glm-5.3 0.08, MiniMax 0.05, DeepSeek Flash 0.01, gemma 0.01), 117 Synthetic calls, no Hyper call, no refusal,
    no exhausted retry ladder; the meter read 56.37 before and 55.91 after.
- **Per-endpoint attribution**, read off `served by` on the stream lines:
    - DeepSeek V4 Flash: OpenInference finished 2 of 6 (mean 58.8 s when it finished; cut at 67 to 117 s
        with at most one content character over 6.7k to 14.9k reasoning characters), Parasail 12 of 13 (mean 42.8 s),
        Inceptron 4 of 5 (mean 29.9 s), Makora 1 of 1, Together 1 of 1 (11.5 s).
        Every cut was the straggler grace ending a stream still in its reasoning channel.
        OpenInference is now in the row's `ignoredEndpoints` (`08dffd481`),
        the catalog and client guards shown failing with the entry removed, restored and passing.
    - gemma 4 26B: DeepInfra 9 of 10 (mean 20.3 s, the cut at 83 s), SiliconFlow 19 of 19 (mean 4.2 s).
        Not ignored: one cut in ten, the seat is a checker off the critical path,
        and with DeepInfra gone SiliconFlow would serve alone,
        so a rate limit there would lose the voice outright,
        since OpenRouter is the last provider in the order.
        Revisit if a later pass shows DeepInfra cutting again.
    - DeepSeek V4 Pro: Parasail 34 of 35 (mean 21.8 s), one cut at 68 s in the consolidation gate.
    - glm-5.3: Together 16 of 16 (mean 1.9 s); Modal 1 of 1 at 74 s with 27k reasoning characters and a 10 s
        first byte. One sample; watch it before acting.
- **Rejected: re-routing a voice whose transient-retry ladder is exhausted.**
    The idea was to treat five failed attempts on 5xx as a refusal and walk to the next provider.
    Measured before building: the four-entry Carena run of 2026-09-01 had no exhausted ladder,
    the whole archive holds one voice lost that way (`xiept2-postscript-20260903.log`, HTTP 503),
    and both OpenRouter passes had none. Not worth a code path.
- Still not exercised: the all-dry benches and Qwen3.8-27B served by OpenRouter; Synthetic stayed wet.

## The third live pass, keyword233, 18:15 to 18:36 UTC, OpenRouter alone

Launched from the worktree at tip `f26c5fb60` with the Synthetic and Hyper keys unset,
which the run reads as both dry (`~/temp/agent/openrouter-live3-20260903.log`, artifacts beside it):

- `METERS synthetic=dry hyper=dry openrouter=wet` throughout;
    `JUDGE SEATS` at every phase read `wide=6 select=6 late=7 slate=7 checkers=3 withheld=hf:moonshotai/Kimi-K3`,
    the all-dry bench with gemma as the substitute checker.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1247533`; lanes 621 seconds, lane contest 68, consolidation 548.
    `verify-published` answered 1 of 1 (`chars=805=expected missing=0`); the page reads as before.
- 0.7590 USD floor over 235 costed OpenRouter calls (two carried no cost), meter 55.89 before and 55.05 after.
    DeepSeek V4 Pro 0.19 USD, Qwen3.8-27B 0.18, Kimi-K3 0.17 from six calls, glm-5.3 0.10, gpt-oss-120b 0.04,
    MiniMax 0.04, GLM-5.3-Flash 0.02, DeepSeek Flash 0.01, gemma 0.01.
    No refusal, no 5xx retry line, no exhausted ladder.
- **The withhold reached only the judge benches.** Kimi-K3 wrote six translations on OpenRouter
    (Fireworks 3, Modal 3), a quarter of the pass's bill, while every bench had it out:
    `judgeSeatsFor` filtered the wide, late, select and checker seats by `seated` and left
    `translatorModelIds` as the static `RUN_TRANSLATORS`, and `pass-entry.ts` passed the catalog's
    `RUN_READER_MODELS` to the picture stage unfiltered.
    Fixed in `8848f070e`: `JudgeSeats` carries `translators` and `readers` filtered the same way,
    the translate lane takes its writers from there, and the picture stage reads its own seats
    (`JUDGE SEATS phase=pictures`, `pass-seated-pictures.ts`);
    the seat guards shown failing with the filters removed, restored and passing,
    and the entry driver test now counts four meter readings per entry.
    The fourth pass (19:33 UTC, launched on that fix) then bought Kimi-K3's first call from the block-pairing
    round six seconds before any bench was read: preparation, insertion admission and the consolidation
    writers all took the static `RUN_ROSTER`. `68ad11530` adds `roster` to `JudgeSeats`, the whole roster
    less any withheld model, read for `phase=preparation` before the pairing round, and the other two
    stages take their own reading's roster; guard shown failing with the filter removed, restored and passing.
    Not yet exercised live past the pairing round;
    the next OpenRouter-only pass must show no `SPEND provider=openrouter model=moonshotai/kimi-k3` line.
- **The Parasail ignore and the OpenInference ignore both held**: 36 of 36 MiniMax calls to ModelRun, all completed,
    three schema-mismatches (two consolidation gates, one translate vote); no DeepSeek Flash stream on OpenInference.
- **Qwen3.8-27B served by OpenRouter conformed**: 31 of 31 completed answers usable, all on Parasail,
    completed p50 18.3 s, p90 52.8 s, max 147 s,
    against p50 16.5 s, p90 48.8 s, max 228 s on Synthetic on the second pass.
    The endpoint is not the slow part; the model reasons long on either provider.
- **Every cut was a reasoning-only stream on Parasail ending at the 60 second straggler grace**, 14 of them:
    Qwen 7 of 38 asks,
    DeepSeek Flash 6 of 27 (Parasail 17 of 23 completed, p50 16.4 s, p90 49.5 s; Makora 4 of 4 at 6.9 s),
    DeepSeek Pro 1 of 37 (Parasail 20 of 21 at 21.3 s; Sail Research 16 of 16 at 1.5 s).
    Cut at 67 to 188 seconds with no content character and 15k to 43k reasoning characters each,
    across critic, panel, select, lane-contest and consolidation-gate rounds.
    `run-timing-report`: 47 rounds, 28.7 of 34.7 round-minutes waiting after quorum (82.7 percent),
    19 voices never heard, against 43 rounds, 62.3 percent and 12 on the second pass.
    The all-OpenRouter bench reaches quorum sooner (gpt-oss on Cerebras and Groq at 1 to 2 seconds,
    MiniMax at 2.6, gemma at 4 to 8) and the reasoning seats then have less absolute time before the grace ends.
    No ignore fits this: Parasail's completed latencies match Synthetic's for the same model,
    and Qwen has no other endpoint on this run.
    The lever is the grace, `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` (default 180 s in `stage-round.ts`,
    set to 60 s on every keyword233 pass of this day), and that is a speed-against-width tradeoff put to the owner.
- Other endpoints seen, for the record: gemma on DeepInfra 30 of 30 at 8.4 s (the ignore stays rejected),
    gpt-oss on Nebius 14 at 6.6 s, glm-5.3 on Modal 3 at 40.5 s against Together 15 at 5.2 s,
    GLM-5.3-Flash on Together 8 at 65.8 s and Makora 1 at 70 s against Venice 2 at 5.2 s and Reka 1 at 1.8 s.
    GLM-5.3-Flash's slow endpoints cut nothing (14 of 14 usable), so nothing is ignored on one pass's counts.

## The fourth live pass, keyword233, 19:33 to 19:55 UTC, OpenRouter alone at a 120 s grace

Launched from the worktree at tip `f4d59bf65` (the translator and reader withhold, before the roster-wide
one) with `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=120000`, everything else as the third pass
(`~/temp/agent/openrouter-live4-20260903.log`):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=1321136`; `verify-published` 1 of 1
    (`chars=773=expected missing=0`); no refusal, no 5xx retry, one schema-mismatch.
- Cut streams 7 (Qwen3.8-27B 6, gemma 1) against 14 at 60 s; `run-timing-report` 37 rounds,
    34.6 of 37.7 round-minutes waiting after quorum (91.7 percent), 8 voices never heard against 19.
- 0.4502 USD; Kimi-K3 bought 3 calls (0.07 USD): one from the block-pairing round and two as consolidation
    writers, the roster-wide gap `68ad11530` closes. `JUDGE SEATS` read `translators=6 readers=3` at every phase.
- Put to the owner with the third pass's figures; **decided: 120 s**, now the built-in
    (`doc/decision/translation-repair-straggler-grace.md`, "Decision 2026-09-03").
- Decided at the same asking: the recovery round keeps its complaint-appended re-ask
    (`doc/decision/translation-repair-recovery-reask.md`) and per-slice semantic wrap stays
    (`doc/decision/translation-repair-page-shape-per-slice-wrap.md`).

## The fifth live pass, keyword233, 19:58 to 20:21 UTC: the withhold holds through every stage

Launched from the worktree at tip `47a292e2a` (the roster-wide withhold) at the 120 s dial, OpenRouter
alone (`~/temp/agent/openrouter-live5-20260903.log`):

- **No Kimi-K3 call at all**: no `SPEND` line and no stream for `moonshotai/kimi-k3` from preparation to
    consolidation; `JUDGE SEATS` read `roster=8 translators=6 readers=3 withheld=hf:moonshotai/Kimi-K3` at
    all five readings, `phase=preparation` first. The owner's withhold is now verified at the user boundary.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1358549`; `verify-published` 1 of 1
    (`chars=796=expected missing=0`); no refusal, one 5xx retried and recovered, two schema-mismatches.
- 10 cut streams (DeepSeek Flash 5, Qwen 3, GLM-5.3-Flash 2), 12 voices never heard, 40 rounds with 92.5
    percent of round time waiting after quorum; 0.4999 USD; meter 54.45 before, 53.89 after.
    Against the fourth pass's 7 cuts and 8 never heard at the same window: single runs on this entry spread
    that wide, and neither pair is a window effect on its own.
    DeepSeek Flash this time went mostly to Phala (16 of 18 completed) with Parasail 2 of 5; the routing
    moves between passes, which is one more reason single-pass endpoint counts do not earn an ignore.
- The sixth pass launched at 20:21 UTC on `e0509047b` with no straggler dial, to run the built-in 120 s window
    and carry the first `recovery round heard N of M` count (`~/temp/agent/openrouter-live6-20260903.log`).

## The sixth live pass, keyword233, 20:21 to 20:43 UTC: the built-in window, no dial

- No `STRAGGLER GRACE OVERRIDDEN` line; every reader-round abandonment reads `abandoned 120000ms after quorum`
    (six of them) and the one writer-round abandonment `180000ms`, the writer dial still set at launch.
    The built-in 120 s is what the pass runs.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1312386`; `verify-published` 1 of 1
    (`chars=806=expected missing=0`); no Kimi-K3 call, no refusal, no schema-mismatch, 7 cut streams,
    7 voices never heard, 37 rounds with 94.3 percent of round time waiting after quorum; 0.4281 USD;
    meter 53.89 before, 53.41 after.
- No recovery round ran, since no answer came back unreadable, so the `recovery round heard N of M` line
    has no first count yet; the re-ask's yield is read off the earlier passes instead (next bullet).
- **The complaint-appended re-ask recovers about half**, read off today's first, third and fourth passes by
    pairing each `recovery round for N unreadable` line with its stage's next `round: x/N heard` line:
    first pass 2 of 8 parsed rounds heard (the misses were MiniMax on Parasail answering unreadably again,
    before the ignore), third pass 3 of 3, one round on each of the first and fourth passes with an
    unparsed stage label. 5 of 11 in all, and no `PROMPT-REUSE source=memory` after any of them: the
    nudge makes the digest new every time. Issue 473 closed on this measurement.

## The picture passes, 2026-09-04, and the double-quote undercount

Two picture-bearing entries were launched on OpenRouter alone, concurrently with the Toka_ls pronoun
re-run (Synthetic wet, Hyper unset), at the owner's instruction that OpenRouter has no meaningful rate
limits: Hangmster at 04:26 UTC (`~/temp/agent/hangmster-pictures-20260904.log`, one picture) and
BI4PBV at 04:28 (`~/temp/agent/bi4pbv-pictures-20260904.log`, four pictures, two of them carrying text).

- **BI4PBV's picture stage took one millisecond and said nothing.** `JUDGE SEATS phase=pictures` at
    04:29:16.205, `phase=lanes` at 04:29:16.206, and no `gathered N of M pictures` or `reading N pictures`
    line between them, where Hangmster's log has both. Its `page.md` writes its `PhotoScroll` paths in
    double quotes, one per line; `photo-reference.ts` read single-quoted strings only, so the slices
    showed no pictures, and `assertVisualEvidenceComplete`, asking the same reader, found nothing missing.
    Measured at pin `a41fc607` over the source pages: 192 single-quoted paths across 47 entries, 7
    double-quoted across 4 (`yulianNyanner`, `MTF_0615`, `Arita`, `BI4PBV`), no third form.
- **Fixed in `5e013d24b`**: either mark opens a string and only the same mark closes it, so a caption in
    one mark beside paths in the other, or an apostrophe inside a double-quoted name, cannot split a
    path. Three new guards (the multi-line double-quoted array, a page mixing both marks, the caption and
    apostrophe cases) shown to fail with the double mark neutralised: the captioned case then read the
    apostrophe in the caption as an opening quote and lost the path entirely. Suite 922, lint and types
    clean.
- **BI4PBV relaunched on the fixed build at 04:43:35** (`~/temp/agent/bi4pbv-pictures2-20260904.log`,
    fresh runs dir): `gathered 4 of 4 pictures`, `reading 4 pictures`, `image0.webp: no text (0
    characters, under 16)` so no model was asked for it, `image1.webp: read 52 characters without a
    model` then `minimax-m3 read image1.webp: 251 characters`. The first pass runs on as a no-picture
    control. Readings, page and the no-Kimi check follow on the tallies.
- **The displacement screen had the same blind spot** (`corpus-run/markup-slice.ts`): a single-quoted
    path line counted as structure, a double-quoted one as prose, so the double-quoted block read as
    0.4 markup against the 0.8 threshold and was not exempted from the relocation reading. Fixed in
    `4ff42e627`, guard shown to fail neutralised (`expected 0.4 to equal 1`). Scope: `isMarkupOnly` is
    called only from `corpus-run/displacement-probe.ts`, the offline `mise run displacement-probe`
    instrument that asks no model and whose output no lane reads, so no live pass was affected; the
    probe's relocation count for those four entries was the thing at risk. No other rule in the package
    keys on the single mark (`rg` over `src` for `startsWith('\'')` and quote comparisons: the four
    remaining hits are typography and refusal readers, not path readers).
- The undercount was invisible from the run log, which is the lesson worth keeping: a stage that finds
    nothing to do logs nothing, and the completeness guard shared the parser's blind spot. The seats line
    is what made it visible, by putting a timestamp on each side of the stage.
- **The second pass's picture stage, 04:43:52 to 04:49:59**: `image0.webp` and `image2.webp` carried no
    OCR text (0 and 15 characters, under 16), so no model was asked; `image1.webp` was read by minimax-m3
    (251 characters) and Qwen3.8-27B (419) and corroborated by those two at overlap 0.614 after
    GLM-5.3-Flash on Together ran the whole 360 s per-call deadline with 76,412 reasoning characters and
    no content (`stream z-ai/glm-5.3-flash: cut, elapsed 360004ms ... 3932835 raw chars ... 0 content
    chars`); `image3.webp` was read by all three within 3 s and corroborated at 0.966. No Kimi-K3 line.
    The cut stream carries no `cost=`, so the run meter and the spend report undercount it by whatever
    the provider bills for those reasoning tokens.
- **The picture gather has no straggler grace** (`image-reading-pair.ts` gathers with `allSettled` and
    waits for every reader or the deadline), so `image1.webp` waited 284 s after its second reading for a
    reader that never answered. Measured over every run log in `~/temp/agent` (script
    `~/temp/agent/picture-wait-20260904.mjs`): 1,435 pictures with two or more model readings and a
    settlement; the wait after the second reading is 0 s at the median and the 90th percentile, 1,419 s
    in total, and three pictures waited past 120 s (Toka_ls `photo2.webp` 352 s on 2026-09-02 with
    Kimi-K3 failing at the deadline, today's 284 s, Zha_Ke `letter.webp` 168 s on 2026-08-27). A 120 s
    grace after corroboration would have saved 444 s across the whole record. Most of that record is
    two-reader rosters where the wait is zero by construction; the OpenRouter-alone roster seats three
    readers, so today's two text pictures are the first of the population that matters, one of them bad.
    Not built: recorded here to be re-read once more three-reader pictures have run.

## ModelRun's timeouts, 2026-09-04, and what the log called them

- **Symptom.** Today's six runs logged 115 `MalformedCompletionError: ... stream ended without its
    [DONE] terminator; the reply was cut off` retries by 05:00 UTC (Toka_ls 51 of 592 spend lines,
    Hangmster 29 of 278, the first BI4PBV 26 of 245). The retry ladder reached its fourth attempt 8 times
    and gave up at least 5 times (a coverage voice, two critic voices and two panel voices lost, all
    minimax-m3).
- **Attribution.** The stream line before each retry names the model and endpoint: 114 of 115 were
    `minimax/minimax-m3` served by `ModelRun`, body 846 characters (7 of them 871), 0 content
    characters, "completed" after about 10.5 s. ModelRun served 300 MiniMax streams today and 119 of
    them were that body; Venice served 5, all with content.
- **Reproduced directly** (`~/temp/agent/modelrun-probe.mjs`, six trivial calls with `provider.only:
    ['ModelRun']`): the fourth answered HTTP 200 in 10,463 ms with one chunk carrying
    `error: { code: 504, message: "error code: 504", metadata: { error_type: "timeout" } }` and no
    `[DONE]`. The gateway had already sent its success status when the upstream timed out, so the
    failure rides inside the stream.
- **The listing agreed** (`~/temp/agent/minimax-endpoints-20260904.json`, 05:00 UTC): ModelRun
    `uptime_last_30m` 54.9, `status` -5, prompt 0.75 and completion 3.0 USD per million, fp4; every other
    minimax-m3 endpoint read 98 to 100 uptime and status 0 at 0.23 to 0.6 prompt.
- **Why it cannot simply be ignored.** Re-probed with the 2026-09-03 corpus-sized schema request under
    zero data retention (`~/temp/agent/openrouter-minimax-endpoints-20260904.log`): ModelRun 4 of 4
    conformant, 11 to 15 s; DeepInfra and Venice 404 "No endpoints found that can handle the requested
    parameters"; CoreWeave, the only other zero-data-retention endpoint listing `structured_outputs`, 404
    "All providers have been ignored", which is the account-level ignore list; default routing without
    `only` went to Parasail 3 of 4 times with the known empty content channel. Under the ZDR decision,
    ModelRun is MiniMax M3's only endpoint for a schema request.
- **What landed** (`f17feba12`): `openrouter-stream-error.ts` reads the gateway's error chunk before the
    terminator check and throws `InStreamProviderError` naming code, kind and endpoint
    (`stream carried a provider failure instead of a completion: code 504, type timeout, served by
    ModelRun`); the ladder retries it as it retried the truncation. Guard shown to fail with the check
    removed. The catalog comment on the minimax row now states the endpoint situation as re-measured.
- **Open, for the owner** (options in the question put at the end of this session's turn): keep the seat
    and take the 504 retries (about 10.5 s per failed attempt, roughly 1 to 2 percent of MiniMax calls lost
    after five attempts at today's rate); withhold `minimax-m3` from OpenRouter-served seats while
    ModelRun reads degraded, as Kimi-K3 is withheld; or un-ignore CoreWeave at the account level and
    probe it for conformance, which would give the schema request a second zero-data-retention endpoint.

## Build plan, transport-independent layers first

In commit order, each unit tested and committed before the next:

1. `provider-name.ts`: `ProviderName` gains `openrouter`; `PROVIDER_ORDER` states the routing preference
    (Synthetic, Hyper, OpenRouter); helpers over the record shape.
2. `openrouter-catalog.ts` and `roster-reach.ts`: slugs, `sharedWith` for all nine, vision flags and output ceilings from
    the listing; `ModelReach` becomes a record keyed by provider; Gemini 3.8 Flash joins the blocklist.
3. `budget-routing.ts`: `routeProviderFor` walks `PROVIDER_ORDER` over a dryness record and a saturation record;
    the two-provider dry error is renamed `EveryProviderDryError` (misleading name, CRN) and the old name goes to the local
    forbidden-strings appendix; `openRouterIsDry` and its meter fields.
4. `provider-budget.ts` and `budget-hold-wait.ts`: a third meter, `METERS` gains `openrouter=` and `openrouterUsd=`,
    a refusal hold moves traffic only while some other provider reads wet, the all-dry wait generalizes.
5. `provider-router.ts`: callers keyed by provider, a bounded re-route (one attempt per provider), the re-ask asks the
    next wet provider serving the model; the re-ask path splits into its own file at the line budget.
6. `required-providers.ts`, `run-config.ts`, `budget-sample.ts`: the third key, optional and loud; the run client exposes
    the dryness record for the seat reader.
7. `run-seats.ts`: benches derive from where each model would be served (first provider in order that serves it and
    reads wet): Hyper-slow rules apply when served by Hyper, Kimi-K3 is withheld from every seat when served by
    OpenRouter, and `gemma-4-26b-a4b-it` takes the third checker seat there so both checker assertions hold per phase.
    Whether Qwen3.8-27B's rule is "served by Hyper" or "not served by Synthetic" is decided by its OpenRouter median in
    the probe.
8. `spend-line.ts`, `spend-read.ts`, `spend-cost.ts`: a `cost=` field in USD from the wire, an OpenRouter bucket in
    USD kept apart from hypercredits; `meter-sample-read.ts` and `meter-report.ts` accept the third field and its absence
    in older logs.
9. `openrouter-client.ts` and its credits parser, on the transport the probe picks.
10. Live verification, then the decision doc, README and runbook.
