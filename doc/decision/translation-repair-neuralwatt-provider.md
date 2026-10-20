# Translation repair: NeuralWatt is the fifth provider and the first in order

Decided by the owner on 2026-10-20.
Extends `doc/decision/translation-repair-multi-provider.md` (Synthetic and Charm Hyper),
`doc/decision/translation-repair-openrouter-fallback.md` (OpenRouter)
and the Bedrock decision of 2026-09-07 (`package/translation-repair/doc/provider-availability.md`).
The code is in `package/translation-repair/provider/src/neuralwatt-*.ts`.

## Why

The owner,
2026-10-20:
"I just added TRANSLATION_REPAIR_NEURALWATT_API_KEY .
It includes 550Wh of energy on DeepSeek V4.1 Flash and GLM 5.3 Flash per day.
And we need to meter (using estimations) ourselves because overage eats into my normal plan which I use for other stuff."

The same day,
on the order:
"Use the neuralwatt free energy front and center."

Free daily energy that does not carry over is the most perishable budget the pipeline has,
so NeuralWatt is first in `PROVIDER_ORDER` (`shared-contract/src/provider-name.ts`),
and every seat of DeepSeek V4.1 Flash and GLM-5.3-Flash goes to it first in every role the model holds.
The roster does not change:
no model is seated in a new role and no owner hold is lifted
(GLM-5.3-Flash stays unseated as a judge,
as the owner decided on 2026-09-02).

## Facts the design rests on

All read on 2026-10-20.

- **The API is OpenAI-compatible.**
  Base address `https://api.neuralwatt.com/v1`,
  bearer key,
  `POST /v1/chat/completions` with streaming
  (`https://docs.neuralwatt.com`).
- **Two models are covered,
  on their standard ids.**
  `GET https://api.neuralwatt.com/v1/models` (public) lists `deepseek-v4.1-flash`
  (context 1,048,560,
  maximum output 393,216,
  0.15 and 0.60 USD per million tokens in and out,
  image input,
  reasoning on by default)
  and `glm-5.3-flash`
  (context 1,048,560,
  no listed output ceiling,
  0.15 and 0.50 USD,
  image input,
  reasoning mandatory at the default effort `max`).
  The `-flex` ids,
  the `-speed` ids and the `nw-flash` alias are not used.
- **The daily free energy is 550 Wh.**
  `https://docs.neuralwatt.com/billing/daily-free-energy`:
  500 Wh from the Max plan and 50 Wh for the email address,
  reset at 00:00 UTC,
  unused energy does not carry over,
  it covers the standard and Flex tiers and not Speed,
  and it is used before anything else.
  The page says no API reports what is left of it.
- **Per-request energy is on the stream.**
  `https://docs.neuralwatt.com/energy-methodology.md`:
  before `data: [DONE]` the stream carries a comment line `: energy {"energy_kwh": ...}`
  (only when measurement is available)
  and `: cost {"request_cost_usd": ...}`
  (on every request with cost metadata,
  free ones included,
  where it may be 0).
  `energy_kwh` is the energy consumed;
  the energy charged is that times the lane's multiplier,
  which is 1.0 on the standard lane.
- **`GET /v1/quota` reports the plan and not the free energy.**
  `https://docs.neuralwatt.com/api/quota`:
  `subscription.kwh_used` is the charged energy of the billing period,
  with `kwh_remaining` and `in_overage`;
  the limit is one request per second.
  It says nothing about the daily free energy.
- **NeuralWatt publishes its own per-request means.**
  `https://portal.neuralwatt.com/api/energy-pricing/matrix`
  (generated 2026-10-20T20:04:27Z,
  seven-day window,
  mean watt-hours per request on the charged basis,
  by prompt-size bucket).

## What the pipeline does

### Order and seating

`'neuralwatt'` is first in `PROVIDER_ORDER`,
with the owner's sentence in the comment beside it.
The compile errors at every `ProviderRecord` site were the checklist;
the Bedrock commit `7b532ae314` and the order move `a317f4e032` were the precedents.
Both existing cards gain a `neuralwatt` side with the served id,
the picture flag,
the context window and the output ceiling the listing states
(`shared-contract/src/neuralwatt-card-sides.ts`);
GLM-5.3-Flash's listing states no ceiling,
so the context window stands in.
A test holds every hold of both cards as it was.

### The meter

The pipeline meters the free energy itself,
because nothing reports it and overage is the owner's plan.

- **A durable ledger,
  one line per call,
  by UTC day.**
  `~/.local/state/translation-repair/neuralwatt-energy.jsonl` unless `TRANSLATION_REPAIR_NEURALWATT_LEDGER` names another place.
  The day's allowance is 550 Wh unless `TRANSLATION_REPAIR_NEURALWATT_DAILY_WH` says otherwise
  (a non-negative number;
  anything else is refused at once).
- **A call holds its estimate before it is sent.**
  The estimate is the matrix mean for the model and the prompt-size bucket,
  times the margin.
  The prompt size is the request body's bytes over `PROMPT_BYTES_PER_TOKEN`,
  rounded up.
  Concurrent calls each hold their share,
  so a burst cannot all read the same remainder
  (a guard test inserts an awaited read between the check and the hold and fails).
  A call whose estimate does not fit is refused by name before any request leaves
  (`NeuralWattAllowanceError`),
  and the router moves it to the next provider without holding NeuralWatt out for the small calls behind it.
- **The measured energy replaces the estimate at settlement.**
  The `: energy` comment's figure is written to the ledger.
  A call whose comment is missing or will not read settles at its estimate,
  marked `unreported-estimate`;
  an attempt abandoned before its stream ended settles at its estimate,
  marked `abandoned-estimate`.
  The `METERS` line carries `neuralwattWh=` (left),
  `neuralwattReckonedWh=` (the share of the day's spend resting on estimates)
  and `neuralwattBilled=`.
- **Dry when the day cannot hold even the smallest call,
  or when anything was billed.**
  The smallest call's hold is the first bucket's lowest mean times the margin.
- **A request that comes back with a cost ends the day for NeuralWatt.**
  The free energy is used before anything else,
  so a `request_cost_usd` above zero means it was spent and the owner's plan was charged.
  The ledger marks the UTC day billed,
  the provider reads dry until 00:00 UTC,
  and the log says so plainly.
  This is the backstop that holds whatever the estimates get wrong.
- **An absent key leaves the provider unconfigured.**
  It reads dry and is never routed to,
  as for every other provider.

### The margin

The margin is 2,
uniform across models and buckets.

- **What it sizes.**
  Only the hold a call has while in flight.
  Settlement replaces it with the measured figure,
  so the margin decides how much is held and never how much was spent.
- **Why this much.**
  The matrix's means come from traffic whose prompts were mostly served from the prefix cache
  (the matrix prints the share per bucket),
  and this pipeline's prompts are mostly fresh.
  If a bucket's energy were wholly prefill,
  a mean over a cached share h would understate a fresh prompt by 1/(1-h).
  For the lightest bucket with a cached share
  (256 to 1,023 tokens,
  DeepSeek V4.1 Flash,
  h of 0.458)
  that is 1.84,
  and 2 is the smallest whole number at or above it.
  For the sheet-sized buckets of 1,024 to 16,383 tokens the same bound reads 2.65 to 3.29
  (GLM-5.3-Flash 1.45 to 1.57),
  so 2 sits in the middle of the range there and is not claimed to cover the heavier buckets.
  The true multiplier lies between 1 and the bound,
  because decode work,
  which these reasoning models spend heavily,
  does not scale with fresh prompt tokens.
- **What it can strand.**
  At the end of a day a call is refused only if its hold does not fit,
  so what is left unspent is less than one hold of the size being sent.
  At the matrix means and a margin of 2,
  per bucket of prompt tokens
  (DeepSeek V4.1 Flash first,
  GLM-5.3-Flash second,
  each in watt-hours and as a share of 550 Wh):
  - Under 256:
    0.0023 (0.0004 percent) and 0.0061 (0.0011 percent).
  - 256 to 1,023:
    0.0147 (0.0027 percent) and 0.0178 (0.0032 percent).
  - 1,024 to 4,095:
    0.0466 (0.0085 percent) and 0.0779 (0.0142 percent).
  - 4,096 to 16,383:
    0.1392 (0.0253 percent) and 0.2030 (0.0369 percent).
  - 16,384 to 65,535:
    0.2789 (0.0507 percent) and 0.4017 (0.0730 percent).
  - 65,536 to 262,143:
    0.5569 (0.1013 percent) and 0.7998 (0.1454 percent).
  - 262,144 to 1,048,575:
    1.2157 (0.2210 percent) and 1.8179 (0.3305 percent).

  A larger margin raises every figure and refuses large prompts earlier in the day.
  A smaller one lets more calls start together on a remainder that may not cover them.
  Calls in flight at the moment work stops are not counted in the table:
  their holds are freed as they settle,
  but nothing sends again that day if the run has ended.
- **What the margin cannot do.**
  It cannot stop plan spend by itself.
  If the real energy of a fresh prompt is several times the estimate,
  the calls in flight together can pass the day's end by their combined excess before the first one settles.
  At the prefill-dominated bound,
  and with 64 calls in flight,
  a figure assumed because no ceiling is set,
  the excess is about 6 Wh in the 4,096 to 16,383 bucket and about 62 Wh in the 16,384 to 65,535 bucket,
  both for DeepSeek V4.1 Flash.
  That bound is an upper limit that decode-heavy reasoning calls do not reach.
  The cost comment ends the day at the first billed request,
  so the overshoot is bounded by the calls already in flight at that moment.
- **Recalibrate from the first keyed run.**
  Every settled call logs its measured energy beside its estimate and its prompt tokens,
  so the first run supplies the pipeline's own means per bucket,
  which replace the matrix's.
  Until then the margin is a start and not a measurement.

### The spend report

A run that calls NeuralWatt reads `GET /v1/quota` once before its first call
and once when it ends,
and prints the difference in `subscription.kwh_used` and whether `in_overage` is true.
The reading exists only in a keyed run that made a NeuralWatt call;
no test reads it,
and a failed read never blocks a call.
Its end report is registered when the run client is built and printed by `reportingRefusals`
(`run/src/corpus-run/run-end-report.ts`).

`spend-report` lists NeuralWatt seats in a bucket of their own,
in no credit total and no USD total,
and says in capitals when any of their calls came back with a cost.

### Credentials

`TRANSLATION_REPAIR_NEURALWATT_API_KEY` is named wherever another provider key is:
the run client,
the start guard of `--require-providers`,
the budget sample,
the roster-card command,
the no-key refusal and its fixtures,
and the setup step of `doc/runbook/translation-repair-corpus-pass.md`.
A built command's refusal to start in a process that holds keys,
and the child-process environment scrub,
match any variable ending in `_API_KEY`,
so they cover it without a list.
The key's value is masked in every logged exchange by the same credential masking as the others.

## What the meter cannot see

- **The owner's other use of covered models.**
  The free energy is per account.
  Anything the owner runs on DeepSeek V4.1 Flash or GLM-5.3-Flash outside this pipeline spends the same 550 Wh,
  and the ledger does not know it.
  The ledger can then say energy is left when the account has none,
  in which case the next request comes back billed,
  the cost comment ends the day for NeuralWatt,
  and the owner's plan is charged for that one request and the calls in flight.
  The quota difference in the spend report is the only signal of plan energy spent,
  and it includes the owner's other use of the plan in the same hours.
- **Whether there is any free energy today.**
  The billing page says the daily free energy exists during promotions
  (often weekends,
  with amounts that can change)
  and that without a promotion there is none.
  The pipeline cannot read the promotion calendar.
  On a day without one the first request comes back billed,
  and the ledger ends the day at once;
  the owner can set `TRANSLATION_REPAIR_NEURALWATT_DAILY_WH=0` to keep the provider dry from the start.
  The page also says the free energy does not apply to per-token accounts,
  the free trial or a past-due account.
- **Another process on the same ledger.**
  A reservation lives in the process that made it.
  Two pipeline processes run at once on one ledger each read the other's settled lines but not its holds,
  so together they can start more than the remainder covers.
  The margin and the billed mark bound the effect;
  nothing else does.

## Not verifiable without a key

- That `request_cost_usd` is 0 on a free standard-lane request.
  The documentation says it may be.
  If it is not,
  the first call would end the day for NeuralWatt,
  and the log would say so.
- How NeuralWatt handles a picture on either model.
  The listing reports image input for both,
  so both cards say so and a picture call may route there;
  DeepSeek V4.1 Flash keeps its `reader-unmeasured` hold,
  so no picture reader is seated on it.
  A failed picture call is not rerouted,
  because only budget refusals reroute.
- The cache share and the energy of this pipeline's real prompts.
- Whether `stream_options.include_usage` is honoured.
- Whether the quota's `kwh_used` moves for free energy at all.
  If it does not,
  the report shows no plan energy spent on a clean run,
  which is what the owner wants it to show.
- Any concurrency ceiling per model.
  None is known,
  so the client's default is no ceiling,
  as for Synthetic since 2026-10-19.

## Cache versions

None moves.
No cache key names a provider,
the roster is unchanged,
and the build `pipeline=` digest discards namespaced slice caches by itself.
The Bedrock decision moved none either.
This is not a claim that anything rides inside an existing version:
no existing version's account is edited,
and `slice-cache:cache-account-audit` reads the unchanged accounts.

## Rejected

- **A flat daily call count.**
  Energy per call spans three orders of magnitude with prompt size,
  so a count either strands most of the day or overshoots it.
- **Reading the quota to decide dryness.**
  It reports the plan and not the free energy,
  and it is limited to one request per second.
- **A per-model or per-bucket margin.**
  Nothing measured separates them yet;
  the first keyed run supplies the data.
- **Seating either model in a new role,
  or lifting a hold,
  because the energy is free.**
  The roster is the owner's decision;
  this record changes where calls go and not who is asked.
