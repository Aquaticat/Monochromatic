# Charm Hyper v1 USD model quotes require a dated hypercredit conversion

## Symptom

The newly approved `deepseek-v4.1-flash` was absent from the dated credit table.
The package's `hyper price table` test correctly rejected that gap:

```text
# deepseek-v41-full-unit-20260911.out
expected [ 'deepseek-v4.1-flash' ] to deeply equal []
```

The live model row reports `pricing.input: 0.3` and `pricing.output: 1.2`.
Those numbers cannot be copied into a credits-per-million table without establishing their units.
The initial admission kept them unpriced rather than inventing a conversion.

## Source trace

The [model documentation][models]
states:
“Hypercredits are computed based on total token cost with 1 hypercredit equating to $0.05.”
The [FAQ][faq]
independently states that one hypercredit is currently five cents.
The [model-list API documentation][list]
defines the `pricing` object as per-million-token pricing.

An actual public `GET /v1/models` read on 2026-09-11 supplied:

```json
{
  "id": "deepseek-v4.1-flash",
  "pricing": {
    "input": 0.3,
    "output": 1.2,
    "cache_create": 0,
    "cache_hit": 0.03
  }
}
```

Conversion therefore yields 6 input,
24 output,
0 cache-create and 0.6 cache-hit hypercredits per million tokens.
This is a quoted-rate conversion,
not a measurement of an individual account debit.

The consumer's lookup intentionally distinguishes missing pricing from zero.
`package/module/translation-repair/src/corpus-run/hyper-price.ts:322`
returns named absence:

```ts
// package/module/translation-repair/src/corpus-run/hyper-price.ts
if (found === undefined)
  return 'unpriced';
```

Its token estimator at line 371 uses the dated quote:

```ts
// package/module/translation-repair/src/corpus-run/hyper-price.ts
inputCredits: (promptTokens * rates.input) / RATE_UNIT_TOKENS,
outputCredits: (completionTokens * rates.output) / RATE_UNIT_TOKENS,
```

The provider's complete live catalog still contained every prior price-table row.
The read therefore allowed refreshing the whole snapshot,
not falsely stamping a newly added row with the old 2026-09-01 date.
The current table records 34 listed models at `HYPER_PRICE_READ_ON = '2026-09-11'`.
Pricing rows for unapproved models do not create serving or voting identities.

## Verification

The source capture and before/after comparison are:

- `~/temp/agent/check-hyper-credit-prices-20260911.mts`.
- `~/temp/agent/hyper-credit-prices-20260911.json`.
- `~/temp/agent/deepseek-v41-pricing-red-20260911.out`.

The capture enumerated 34 live rows and found every one of the 31 prior rows.
Ten prior rows differed in at least one quoted field,
including cache-create versus cache-hit placement.
The snapshot refresh is `027f59dc3`.

The consumer verification is reproducible after rebuilding:

```text
# Run from the translation-repair worktree.
mise run test -- \
  package/module/translation-repair/src/deepseek-v41-admission.unit.test.ts \
  package/module/translation-repair/src/corpus-run/hyper-price.unit.test.ts \
  package/module/translation-repair/src/corpus-run/spend-cost.unit.test.ts
```

### Cases required to pass

- The new model has the converted quote,
  not V4 Flash 0731's price.
- Every served Hyper model has a price record.
- Unknown model names remain `unpriced`.
- A known model with zero reported tokens yields zero estimated credits.
- Spend reports carry the current price snapshot date.
- Cache discounts are not invented from total prompt-token counts.

### Rejected interpretations

- Treating API USD quote fields as hypercredits.
- Treating a missing price as free usage.
- Updating the global snapshot date without rereading retained rows.
- Calling a dated token-price estimate a provider-reported debit.
- Inferring no server-side cache discount solely from absent caller `cache_control`.

The package estimates ordinary input cost because its retained usage does not establish a cache-token breakdown.
The table preserves quoted cache rates for consumers that do retain that evidence.

## OpenRouter remains a separate accounting path

OpenRouter's advertised base rates and scheduled overrides are not necessarily a serving endpoint's billed rate.
The actual V4.1 Flash calls through DeepInfra reported 0.0000824 USD and 0.0000864 USD.
Those are retained as wire-reported amounts;
no cause of the difference from the aggregate catalog price is inferred.

`package/module/translation-repair/src/openrouter-client.ts:448`
reads the wire cost,
and lines 475 to 477 keep it absent when unreported:

```ts
// package/module/translation-repair/src/openrouter-client.ts
const cost = openRouterCostOf({ bodyText: reply.bodyText, },);
// In reportSpend arguments:
...((cost === COST_UNREPORTED)
  ? {}
  : { costUsd: cost, }),
```

Fixed OpenRouter catalog rates price abandoned-call estimates only.
They do not replace a completed call's reported cost.

## Upstream filing decision

- Upstream fault:
  no.
  The unit conversion is published;
  the consumer's snapshot needed refreshing.
- Upstream fixability:
  no upstream implementation change is required.
- Supported use:
  public model-list and billing documentation cover the required fields and conversion.
- Contribution acceptance:
  not evaluated because no external contribution is proposed.
- Expected upstream action:
  none requested or predicted.
- Compatible implementation:
  consumer-side snapshot refresh and explicit unknown-price handling.

Nothing is proposed for filing.
No upstream issue,
comment or patch was drafted.

[models]: https://hyper.charm.land/docs/models.html
[faq]: https://hyper.charm.land/faq
[list]: https://hyper.charm.land/docs/api/list-models.html
