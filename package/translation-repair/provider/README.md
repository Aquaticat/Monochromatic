# @monochromatic-dev/translation-repair-provider

Everything that talks to a model provider:
routing a call to the provider that serves its model and still has budget,
the OpenRouter,
Bedrock,
Anthropic,
Hyper and Synthetic clients and catalogues,
retries,
deadlines and spend reporting.
It is its own package so the stage and lane layers above call one routing client and the clients
load from one built file.

## What it provides

`src/index.ts` re-exports each public name from the module that declares it.
The groups below name the main ones.

- Routing and budgets:
  choose the provider for a model,
  pass calls down the provider order when one is dry,
  read the provider meters,
  and pace requests to a provider's rate limit.
  Names:
  `createRoutingClient`,
  `routeProviderFor`,
  `createProviderBudgets`,
  `readEveryMeter`,
  `EveryProviderDryError`,
  `createRequestPace`.
  Declared in `provider-router.ts`,
  `budget-routing.ts`,
  `provider-budget.ts`,
  `provider-meters.ts`,
  and `request-pace.ts`.
- Provider clients:
  one client for each provider,
  each with its per-model concurrency.
  Names:
  `createSyntheticClient`,
  `createHyperClient`,
  `createOpenRouterClient`,
  `createBedrockClient`,
  `SYNTHETIC_PER_MODEL_CONCURRENCY`,
  `OPENROUTER_PER_MODEL_CONCURRENCY`.
  Declared in `synthetic-client.ts`,
  `hyper-client.ts`,
  `openrouter-client.ts`,
  and `bedrock-client.ts`.
- Catalogues and reach:
  the models each provider serves,
  and which models reach which provider with images.
  Names:
  `SYNTHETIC_MODELS`,
  `OPENROUTER_MODELS`,
  `BEDROCK_MODELS`,
  `syntheticServes`,
  `reachOf`,
  `visionReachOf`.
  Declared in `synthetic-catalog.ts`,
  `openrouter-catalog.ts`,
  `bedrock-catalog.ts`,
  and `roster-reach.ts`.
- Anthropic wire:
  build the request body and read the completion of the Anthropic messages format.
  Names:
  `buildAnthropicBody`,
  `extractAnthropicCompletion`,
  `contentBlocksFor`,
  `answerToolDefinition`,
  `requireWholeAnthropicMessage`.
  Declared in `anthropic-request.ts`,
  `anthropic-completion.ts`,
  `anthropic-content.ts`,
  `anthropic-tool.ts`,
  and `anthropic-whole-message.ts`.
- Chat contract and retry:
  the typed model caller,
  structured-answer calls,
  transient retries,
  call deadlines and stream bounds.
  Names:
  `ModelCaller`,
  `chatJsonThrough`,
  `readJsonOutcome`,
  `exchangeWithRetry`,
  `DEFAULT_RETRY_POLICY`,
  `armCallDeadline`,
  `armStreamBound`.
  Declared in `chat-contract.ts`,
  `chat-json-through.ts`,
  `chat-json-outcome.ts`,
  `transient-retry.ts`,
  `call-deadline.ts`,
  and `stream-bound.ts`.
- Spend and cost:
  report what a call cost and keep the credit ledgers.
  Names:
  `reportSpend`,
  `SPEND_MARKER`,
  `openRouterCostOf`,
  `bedrockCostOf`,
  `createBedrockLedger`,
  `estimateAbandonedSpend`.
  Declared in `spend-line.ts`,
  `openrouter-cost.ts`,
  `bedrock-cost.ts`,
  `bedrock-ledger.ts`,
  and `openrouter-abandoned-spend.ts`.

## Family dependencies

Short names are directory names under `package/translation-repair`;
a package is named `@monochromatic-dev/translation-repair-<short name>`.

### Depends on

Production dependencies (`dependencies` in `package.json`):

- `document-structure`
- `glossary`
- `house-rule`
- `markup`
- `provider-stream`
- `shared-contract`
- `typography`

### Used by

Packages that list it in `dependencies`:

- `adjudication`
- `archive`
- `artifact`
- `bench`
- `consistency`
- `consolidate`
- `corpus-pass`
- `coverage-census`
- `lane-contest`
- `page-check`
- `probe`
- `reference`
- `rendering-audit`
- `repair`
- `run`
- `slice-reading`
- `stage`
- `translate-floor`
- `translate-lane`
- `translate-stage`

Packages that list it only in `devDependencies`:

- `slice-cache`

## Tests

Tests sit beside the sources as `*.unit.test.ts` and import built output:
this package through its own build,
`../dist/final/node/index.mjs`,
and the siblings they need through their package names,
which resolve to each sibling's built entry.

Build before testing:
`mise run //package/translation-repair/provider:build` builds this package,
and the library build keeps family siblings external,
so this package's built entry imports the siblings' built entries.
Its `build:js:node` task therefore declares `depends` on the `build:js:node` of every sibling
listed in `package.json`,
and the siblings build first.

Run the tests with `mise run //package/translation-repair/provider:test:unit`,
or build and test together with `mise run //package/translation-repair/provider:buildAndTest`.
Pass test file paths to run only those files.

Its `./ts/*` export also serves test fixtures that sibling tests import,
for example `provider-status-failure.test-fixture.ts`,
`stage-trivial-reply.test-fixture.ts`,
and `chat-message-reading.test-fixture.ts`.

Test helpers used across the family,
such as scratch directories and capturing loggers,
come from `test-fixture`,
imported as `@monochromatic-dev/translation-repair-test-fixture/ts/<file>`.

## Family docs

- `../../module/translation-repair/README.md`:
  the overview of the pipeline,
  from before the split.
- `../../../doc/planning/translation-repair-package-split.md`:
  the split plan,
  with the package map and the rules the move keeps.
