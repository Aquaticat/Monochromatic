# Translation repair: DeepSeek and Xiaomi are called directly, each for one model

Granted by the owner on 2026-10-22.
Extends `doc/decision/translation-repair-neuralwatt-provider.md` (the fifth provider),
`doc/decision/translation-repair-openrouter-fallback.md` (OpenRouter)
and the Bedrock decision of 2026-09-07 (`package/translation-repair/doc/provider-availability.md`).
The code is in `package/translation-repair/provider/src/direct-*.ts`,
`deepseek-*.ts` and `xiaomi-*.ts`.

## Why

The owner's two grants of 2026-10-22,
quoted as the code quotes them:

- DeepSeek:
  "You can also use the DEEPSEEK_API_KEY as you wish,
  but you may only use deepseek v4.1 flash 1017 with that key."
- Xiaomi:
  "You may only use v2.6-flash with this key."

Neither key is scoped to a model by the provider,
so the restriction is held three ways in code:
the served-id types are single literals (`DeepSeekServedId`,
`XiaomiServedId` in `shared-contract/src/roster-id.ts`),
the model cards carry exactly one side each (`shared-contract/src/direct-card-sides.ts`),
and both clients throw before any request is built for any other roster model
(`DeepSeekModelNotServedError`,
`XiaomiModelNotServedError`).
`shared-contract/src/direct-cards.unit.test.ts` and `provider/src/direct-client.unit.test.ts` fail when any of the three is removed.

The roster does not change.
No model is seated in a new role and no owner hold is lifted:
the same seats are reached by one more route.

## Facts the design rests on

All read in the providers' documentation on 2026-10-22,
or taken from the parent session's probes of that day,
unless stated.
This change itself used no key and made no request;
every live probe cited here was run by the parent session on 2026-10-22 with the owner's keys,
and none was repeated by this change.
The statements that rest on documentation alone are the prices,
the context and output ceilings,
the rate limits,
the error codes,
the claim that `deepseek-flash` is the 1017 build,
and the addresses of the model listings.

- DeepSeek serves `deepseek-flash` (roster seat `deepseek-v4.1-flash`) on `https://api.deepseek.com/chat/completions`.
  Its `response_format` of type `json_schema` is refused with HTTP 400,
  and `{type: 'json_object'}` is accepted
  when the word "json" is in the prompt.
  The client sends JSON mode and states the schema in the system prompt,
  whose text carries that word.
- Xiaomi serves `mimo-v2.6-flash` (roster seat `xiaomi/mimo-v2.6-flash`) on `https://api.xiaomimimo.com/v1/chat/completions`.
  It accepts `json_schema` with `strict` unchanged.
- Both put reasoning in `delta.reasoning_content`,
  which the stream reader drops,
  and both send `:` comment lines,
  which it ignores.
  Neither request carries a reasoning or thinking member for now:
  the owner's standing instruction of 2026-08-25 was lifted for NeuralWatt on 2026-10-21
  and,
  on 2026-10-22,
  for DeepSeek direct,
  Xiaomi direct and Anthropic,
  so both routes are cleared for their documented thinking parameters.
  None is sent until an effort bench has measured one,
  and a value that disables thinking is never sent.
- DeepSeek reports `system_fingerprint` on every reply.
  The client writes it on the completion log line (encoded,
  bounded) as the one per-call evidence of the build.
- Limits:
  DeepSeek documents 2,500 concurrent requests for `deepseek-flash` (HTTP 429 over),
  Xiaomi documents 100 requests a minute and 10 million tokens a minute for `mimo-v2.6-flash`.
  The DeepSeek client bounds concurrency at 2,500.
  The Xiaomi client paces every attempt,
  retries included,
  to 100 in any minute (`createRequestPace`).
- An exhausted balance answers HTTP 402 "Insufficient Balance" on both
  (`https://api-docs.deepseek.com/quick_start/error_codes`,
  `https://mimo.mi.com/docs/en-US/api/guidance/error-codes`).
  The router passes it to `markRefused` as `paymentRequired`.
- No cache key in the pipeline includes the serving provider.
  The slice,
  translate-slice and image-reading keys carry no provider,
  and `servedBy` is stored beside a replayed reply,
  not in its key,
  so a reply replays whichever route first produced it.

## Where they sit in the order

`PROVIDER_ORDER` is now NeuralWatt,
Synthetic,
Bedrock,
DeepSeek,
Xiaomi,
Hyper,
OpenRouter.
**This order is open to the owner's veto.**
The reasoning follows the Bedrock precedent:
Hyper's balance is never renewed and the Hyper-only seats run on it,
DeepSeek's prepaid balance was given to use "as you wish",
and Xiaomi bills per token and serves only the seat OpenRouter otherwise serves,
so both direct routes are tried before Hyper and OpenRouter spend money the owner tops up.
Neither is placed ahead of NeuralWatt's free daily energy.

## Meters

DeepSeek has a balance endpoint.
`GET /user/balance` is parsed strictly (`DeepSeekBalanceShapeError` for any body off the documented shape),
and the provider reads dry when `is_available` is false or the USD total is at or under `DEEPSEEK_DRY_FLOOR_USD`,
which is zero.
The floor has no margin above zero because its balance is prepaid,
one call costs at most a few cents at the peak rates the card prices,
and a balance too small for the next call surfaces as the 402 at the wire.
Bedrock alone carries a margin,
because its overshoot reaches the owner's card.

Xiaomi documents no balance or billing endpoint.
Its meter answers wet always and reports this process's priced spend,
so the `METERS` line shows `xiaomi=wet xiaomiUsdSpent=...`.
Exhaustion is learned from the 402.

Because that meter never reads dry by itself,
the run-ending stop (`EveryProviderDryError`) fires only once Xiaomi has refused a call for payment as well.
Until then Xiaomi reads wet, and a run that holds a funded Xiaomi never reaches the stop.
That is intended, by the owner's ruling of 2026-10-22 (open to the owner's veto):
only dryness of every provider the run holds ends the run,
and a model whose own providers are all dry while another provider is wet is a lost seat.
Xiaomi, wet, is such a provider: it still buys MiMo V2.6 Flash for its own seat.
A fleet that is dry except for Xiaomi therefore loses the seat of every other model (`NoProviderForModelError`)
and the run goes on.
An earlier version of this passage read Xiaomi as dry for a model it does not serve
(`dryForTheModelAsked` in `budget-routing.ts`, added and removed on 2026-10-22),
so that the stop could fire while Xiaomi was configured;
the ruling removed it, and restoring it is one revert.
The `EveryProviderDryError` text says "Xiaomi has refused a call for payment" in every case now.
The `NoProviderForModelError` for a lost seat names the model and how each provider read
(`modelDarkReason` in `model-dark-reason.ts`),
and the router logs it as `<model> went dark: ...`.
A funded real-meter provider that serves only some models (DeepSeek,
for one) behaves the same way:
it keeps its own wet reading,
so a model it does not serve is a lost seat per call and the run does not stop.

How the hold behaves,
in both directions (pinned in `provider-budget-xiaomi-hold.unit.test.ts`):
the budget layer clears a payment mark when the meter's level text changes,
and the level here is the run's own spend.

- With no in-flight call settling after the 402 the spend does not move,
  so the refusal holds Xiaomi dry for the rest of the process.
  That is the current behaviour,
  and the precondition matters:
  in a busy run every Xiaomi call already in flight settles after the refusal and moves the spend,
  so the hold clears early (next item) and Xiaomi flaps rather than staying out.
  The process cannot know that the account was topped up,
  so a top-up within a run is seen on the next launch.
  Xiaomi's error list names 402 as "Insufficient Balance"
  but this change did not check what else may return 402.
- A call that was already in flight settles after the refusal and moves the spend,
  which clears the mark early and lets one more call through to meet the refusal again.
  The cost is one extra refused request per such settle.

A run without a key logs `deepseek=dry` or `xiaomi=dry` on the `METERS` line,
as every unconfigured provider does,
so the duty cycle `meter-report` prints for a provider the run never had reads as fully dry.
Logs written before today carry neither field,
and the reader (`meter-sample-read.ts`) reads them as absent.

## Keys

`DEEPSEEK_API_KEY` (the owner's name,
without the package prefix) and `TRANSLATION_REPAIR_XIAOMI_MIMO_API_KEY`.
Both are optional.
An absent key leaves the provider unconfigured,
with one info line naming the variable,
printed after the no-key refusal so a launch with no key at all still prints its refusal alone.
No key falls back to another provider's.
A 401 from either provider reaches the log without the provider's own words,
because a refusal of a key may echo a fragment of it (DeepSeek's documented text shows the last four characters),
the transport's mask finds whole credentials and not tails,
and masking every four-character piece of a key would rewrite ordinary words in answers that carry no refusal.
The status alone is what the router and an operator act on (`withoutRefusedKeyBody` in `provider/src/direct-client.ts`).
Neither is a valid `--require-providers` value:
no arm can depend on an optional route being ready.
Both names are in the no-key error text,
the budget sample,
the roster-card tool and the tests' named cases;
the child-environment scrub and the keyless scans match the `_API_KEY` suffix,
so both are covered there without a list.

## Prices

DeepSeek is priced at peak always:
0.006 (cache hit),
0.3 (cache miss) and 1.2 (output) USD per million tokens,
with the hit and miss split read from the usage block.
The page halves every rate off peak (01:00 to 04:00 UTC and 06:00 to 10:00 UTC on weekdays other than Chinese public holidays are peak),
and a run cannot know the holidays,
so a peak price is an upper bound and never an under-read of the balance.
Xiaomi is 0.0028 (cached),
0.14 and 0.28 USD per million tokens,
with the cached count read from the usage block.

## The Xiaomi token cap

Xiaomi's chat reference lists `max_completion_tokens` and not `max_tokens`,
and the shared wire body sends `max_tokens`.
It is kept,
because the parent session measured it on 2026-10-22 with the owner's Xiaomi key
(a probe this change did not run or repeat).
On `mimo-v2.6-flash` with a cap of 64,
both members returned `finish_reason` "length" with `completion_tokens` 64
(`reasoning_tokens` 22 included).
The two result lines,
as the probe wrote them:

```jsonl
{"field":"max_tokens","status":200,"finish":"length","usage":{"completion_tokens":64,"prompt_tokens":28,"total_tokens":92,"completion_tokens_details":{"reasoning_tokens":22},"prompt_tokens_details":{"cached_tokens":0}}}
{"field":"max_completion_tokens","status":200,"finish":"length","usage":{"completion_tokens":64,"prompt_tokens":28,"total_tokens":92,"completion_tokens_details":{"reasoning_tokens":22},"prompt_tokens_details":{"cached_tokens":0}}}
```

The limit of this evidence:
it is one non-streamed call pair at a cap of 64.
The production body streams with `stream_options`,
and no call has shown the member honoured on a stream or at the real cap (13,082 style values).
The first streamed Xiaomi call of a real run should show `completion_tokens` at or under the cap on its `SPEND` line.
The probe's output file is kept in the parent session's scratch area (`w287-xingz18/xiaomi-max-tokens-probe.out`)
and is a convenience only:
this section stands without it.

## No zero data retention

Neither route promises zero data retention.
The owner's ruling of 2026-10-05 (the corpus is public,
PII is allowed) and the two grants are what permit it.
The OpenRouter route of Xiaomi's model sends `zdr: true` and is behind this one in the order.

## The 1017 limit

The grant names "deepseek v4.1 flash 1017".
The client cannot ask for a build:
`deepseek-flash` is the only wire id,
and the claim that it is the 1017 build rests on DeepSeek's documentation,
with `system_fingerprint` logged per call as the only evidence a reader can compare across days.
This change made no call with a key to check it.

## Not done

- **Undecided:
  recovery from a Xiaomi 402 within a run.**
  The owner has not ruled on it.
  If a run should recover (a top-up,
  or a 402 that was transient),
  the Xiaomi meter level needs a coarse time bucket so the mark clears on a schedule.

- This change used no real key and sent no request:
  every test runs over a recorded transport,
  and neither `roster-card` listing address was fetched (DeepSeek's rests on its documentation,
  Xiaomi's on the OpenAI-compatible protocol's).
  The keyed probes this record cites were the parent session's,
  not this change's.
- The rotation sweep and the gate were not run.
- The cap census maps both providers' served ids to their seats,
  but no call has been counted.
