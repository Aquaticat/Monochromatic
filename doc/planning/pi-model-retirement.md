# Pi model retirement extension proposal

Status: proposal from a grilling session held 2026-10-02.
Not accepted.
No implementation is authorized by this file.

## Purpose

Retire superseded models from pi's live catalog so the model picker shrinks and so a
superseded model cannot be selected on a path nobody watches.
Measured starting point on this machine: `pi --list-models` prints 525 rows across
10 providers, 399 of them `openrouter`, and the bundled catalog underneath holds
1604 entries across 42 providers.

## Settled decisions

Each item below was decided by the user during the grilling session.

1. Scope is within-family superseded models only.
   Whole-provider removal is out of scope, so the 399 `openrouter` rows stay except
   where a family inside that provider is superseded.
2. Mechanism is per-provider re-registration with a filtered model list.
   Rationale: it is the only catalog mutation pi exposes.
   The registration point is not settled by this decision, because the typed
   `ExtensionAPI` cannot read the catalog; see the first implementation risk.
3. Retirement is automatic at every load, with no approval step and no curated
   retirement list.
4. There is no runtime escape hatch: no allowlist, no environment override.
   The only recovery paths are rebuilding the package or removing it from `packages`.
5. The extension writes no pi settings, neither `enabledModels` nor `defaultModel`.
6. Tier suffixes such as `flash`, `pro`, `mini`, `batch`, and `lite` form separate
   families, so a cheaper or faster variant is never retired by a larger one.
7. An entry whose id carries no version token is never retired.
   This protects rolling aliases and routing targets such as `auto`,
   `syn:large:text`, and `openai/gpt-4o`.
8. There is no context-window regression guard.
   A newer model with a smaller context window still retires the older larger one.
9. Every retirement is logged through a tagged logger.
   There is no audit task.
   The load-time log and the pinned characterization fixture are the only two surfaces
   for the retirement table.
10. A session that starts on a retired model is not corrected and not switched.
    The consequence is recorded under "Implementation risks".
11. The package must be installed last in the global `packages` array, and a
    misordered install warns rather than throws.
12. Cross-provider duplicates are left alone; families never span providers.
    `kimi-k3` on five providers stays on five providers.
13. Package directory `package/pi-plugin/model-retirement`, package name
    `@monochromatic-dev/pi-plugin-model-retirement`.

## Why native pi mechanisms cannot do this

All paths are relative to the installed
`@earendil-works/pi-coding-agent@1.0.0` and `@earendil-works/pi-ai@1.0.0`.

- `enabledModels` does not hide models.
  `dist/modes/interactive/components/model-selector.js:39,52,119,201-219` shows the
  picker defaulting to `scope = "scoped"` when a scope exists and binding Tab to
  `setScope`, which switches `activeModels` to `this.allModels`.
  The setting narrows the default view and Ctrl+P cycling, nothing more.
- Model selection cannot be vetoed.
  `dist/core/extensions/types.d.ts:1179` declares
  `on(event: "model_select", handler: ExtensionHandler<ModelSelectEvent>)` with no
  result type, unlike `tool_call` at `:1181` which returns `ToolCallEventResult`.
  `AgentSession.setModel` assigns `agent.state.model` before emitting
  (`dist/core/agent-session.js:1910-1926`).
- Extensions cannot write settings.
  `pi.getSettings()` returns a structured clone
  (`dist/core/settings-manager.js:305-307`), and `SettingsManager.setEnabledModels()`
  is not reachable from `ExtensionAPI`.
- The only catalog mutations are provider-level.
  `registerProvider(name, config)` whose `models` array replaces every model of that
  provider (`dist/core/provider-composer.js:171-178`, applied at `:329`), and
  `unregisterProvider(name)` (`dist/core/extensions/types.d.ts:1328`).
  There is no `filterModels`, no `removeModel`, and no `modelsChanged` event.
- No model carries age metadata.
  `BaseModel` (`pi-ai/dist/types.d.ts:900-912`) has `id`, `name`, `api`, `provider`,
  `baseUrl`, `input`, `inputLimits`, `cost`, and `headers`.
  A sweep of all 42 bundled catalog files found no per-model date, deprecation, or
  version field; the only timestamp is catalog-wide
  (`pi-ai/dist/providers/data/.manifest.json`, `generatedAt: 2026-10-01T18:57:11.882Z`).
  An "older than N months" rule therefore has no data source.
- Startup model resolution precedes extension registration.
  `findInitialModel` runs in `dist/core/sdk.js:92-118` and `dist/main.js:657-674`,
  before `new AgentSession` flushes `pendingProviderRegistrations`
  (`dist/core/agent-session.js:197`, `dist/core/runner.js:248-267`).

## The retirement rule

The rule was designed against the measured catalog and validated by a throwaway
prototype.
It decides three things per catalog entry: its family, its version evidence, and
whether it loses to another member of the same family.
Anything it cannot order, it leaves alone.

### Family key

A family is `(provider, api, name-shape)`.

- `provider` and `api` come from the catalog entry, never from the id text.
  Including `api` is required: 3 ids in the bundled catalog appear under two APIs for
  the same provider (`openrouter/google/gemini-3-pro-image`, `openrouter/auto`,
  `openrouter/auto-beta`), and without `api` in the key an entry can retire its own
  sibling route.
- `name-shape` is the id lowercased, stripped of a leading `~` and of an `hf:<org>/`
  prefix, split on separators, with every version token removed and the remaining
  tokens rejoined in order.
  The `<org>/` prefix of a router id is kept, so `anthropic/claude-opus-5` and
  `openai/gpt-5.5` can never share a family.
  Keeping tier words in the name-shape is what implements decision 6.

### Version tokens

A token is a version token when its digits run to the end of the token, optionally
behind a `v` and optionally behind an alphabetic prefix.
So `5.2`, `v4`, and `0813` are version tokens, and `qwen3.8` splits into the word
`qwen` plus the version `3.8`, which is what makes `qwen3.7-flash` and
`qwen3.8-flash` members of one family.
A token whose digits are followed by letters stays a single word, so `4o`, `70b`,
`a12b`, and `2.4t` join the name-shape instead of becoming version evidence.
That distinction is what keeps parameter sizes out of the ordering: `llama-3.1-8b`
and `llama-3.1-70b` land in different families and can never retire each other.
Each version token contributes its components to a version vector and keeps its raw
text beside them, because leading zeros decide date classification: `0813` is a
month-day snapshot and `813` is not.

Tokenization and classification are a single character pass per id with no regular
expressions, matching the style of `splitModelIdTokens` in
`package/pi-shared/model-selection/src/version.ts`.

A raw numeric token is date-shaped when it is 4 digits and reads as `MMDD` or `YYMM`,
6 digits and reads as `YYMMDD`, or 8 digits and reads as `YYYYMMDD`.

### Ordering

Two entries in the same family are compared component by component over their version
vectors.

1. At the first differing component, the larger component wins, unless the two raw
   components differ in digit length by 2 or more.
   In that case the pair is unordered, because the ids are using incommensurable
   numbering schemes; `qwen3.5-plus-02-15` against `qwen3.5-plus-20260420` is the
   measured example.
2. When the vectors are equal in length and content, the entry with no date-shaped
   token wins, which keeps a rolling alias alive over a pinned snapshot.
   When both carry dates, the later date wins; when the date shapes differ, the pair
   is unordered.
3. When one vector is a strict prefix of the other, the extra raw components decide.
   All extra components date-shaped: the shorter vector wins, so
   `deepseek-v4-pro-0813` loses to `deepseek-v4-pro`.
   No extra component date-shaped: the longer vector wins, so `claude-opus-5` loses
   to `claude-opus-5-5` and `amazon.nova-lite-v1:0` loses to
   `amazon.nova-2-lite-v1:0`.
   Mixed: unordered.

### Abstention

The rule abstains, keeping both entries, when any of these hold.

- Either entry has an empty version vector (decision 7).
- The name-shapes differ, so they are not in the same family.
- Any comparison step above reports the pair unordered.
- The two entries have the same provider, api, and id.
- Keeper selection inside a family was itself ambiguous for at least one pair.

Abstention is the deliberate error direction.
Decision 4 removed every runtime override, so a false positive is recoverable only by
rebuilding the package, while a false negative costs one extra row in the picker.

### Invariants

- A retired entry's version vector is never greater than its keeper's under the
  ordering above.
  The verification suite asserts this over the whole catalog, not over samples.
- An entry with no version token is never retired and is never chosen as a keeper.
  The second half matters: a versionless entry that becomes the keeper blocks every
  retirement in its family, which was a live bug in the prototype.
- Re-registration never drops a model type.
  `getAll()` returns chat, image, and classifier models; the config shape differs per
  type (`ProviderChatModelConfig`, `ProviderImageModelConfig`,
  `ProviderClassifierModelConfig` in `dist/core/extensions/types.d.ts:1422-1470`), and
  image models require `output`.

## Measured behavior of the rule

Prototype: throwaway Python over the bundled catalog, run 2026-10-02, written as a
character scan with no regular expressions so that it validates the shape the
TypeScript implementation must take.
The prototype is not retained; the durable artifacts are the implementation and its
tests.

- Full bundled catalog, 1604 entries: 551 retirements, 29 abstentions, 0 misordered
  pairs.
  Largest contributors: `openrouter` 142, `vercel-ai-gateway` 91, `amazon-bedrock` 71,
  `opencode` 38, `azure-openai-responses` 23, `huggingface` 23, `openai` 23,
  `cloudflare-ai-gateway` 22.
- Live subset, the 481 of 525 `pi --list-models` rows that exist in the bundled
  catalog: 151 retirements, 12 abstentions, 0 misordered pairs.
  Contributors: `openrouter` 129, `radius` 9, `opencode-go` 6, `openai-codex` 3,
  `qwen-token-plan-individual` 3, `moonshotai` 1.
  The picker would therefore drop from 525 rows to about 374 before `synthetic` and
  `hyper` are counted.
  The remaining 44 live rows belong to `synthetic` and `hyper`, which are registered
  by npm packages and are absent from the bundled catalog, so the prototype could not
  evaluate them.
  The runtime rule sees them through `getAll()`; measuring them needs a host probe.
- 14 tokenizer controls pass, covering whole-numeric tokens, `v`-prefixed tokens,
  alphabetic-prefix tokens, trailing-letter tokens, parameter sizes, and each date
  width.
- 18 asserted policy controls pass and 1 is skipped because `hyper/kimi-k2-thinking`
  is not in the bundled catalog.
  They pin the three `radius` inversions, the alias-versus-snapshot pairs, the
  magnitude-guard abstentions, the versionless protections, and the size-token
  separation.
- Splitting alphabetic-prefix versions is what raised the live count from 124 to 151
  and the catalog count from 462 to 551, with no retirements removed and no keeper
  changes.
  The 27 added live retirements are families that the whole-token-only variant could
  not see at all: `qwen3.5` through `qwen3.7` against `qwen3.8`, `kimi-k2` through
  `kimi-k2.6` against `kimi-k3`, `minimax-m1` through `minimax-m2.7` against
  `minimax-m3`, and `o1` against `o3`.

Retirements the rule makes on providers in daily use, all verified correct by hand:
`opencode-go/glm-5.2` by `glm-5.3`, `opencode-go/mimo-v2.5-pro` by `mimo-v2.6-pro`,
`opencode-go/grok-4.6` by `grok-4.7`,
`opencode-go/muse-spark-1.2-contributor` by `muse-spark-1.3-contributor`,
`openai-codex/gpt-6-sol` by `gpt-6.1-sol`, `openai-codex/gpt-5.6-luna` by
`gpt-6-luna`, `radius/claude-opus-5` by `claude-opus-5-5`,
`radius/claude-sonnet-5` by `claude-sonnet-5-5`, `radius/gpt-5.4` by `gpt-5.5`,
`moonshotai/kimi-k2.6` by `kimi-k3`,
`qwen-token-plan-individual/qwen3.6-flash` by `qwen3.8-flash`, and
`qwen-token-plan-individual/qwen3.7-max` by `qwen3.8-max`.

Abstentions the rule accepts rather than guessing, all measured:
`openrouter/qwen/qwen3.5-plus-02-15` against `qwen3.5-plus-20260420`, where a
month-day pair meets an 8-digit date, and
`openrouter/deepseek/deepseek-v4-flash-0731` against `deepseek-v4.1-flash`, where a
snapshot component meets a minor version component.

### What the naive rule got wrong

The first candidate rule reused the ordering semantics of
`@monochromatic-dev/pi-shared-model-selection` directly.
Measured failures that motivated the design above:

- Three inversions on `radius`, a provider in daily use: `claude-fable-5-1` retired by
  `claude-fable-5`, `claude-opus-5-5` retired by `claude-opus-5`, and
  `claude-sonnet-5-5` retired by `claude-sonnet-5`.
  In each case the newer point release lost to the older base version.
- Eight live retirements where the keeper's context window was strictly smaller,
  including `gpt-5.6-luna` at 1050000 retired by `gpt-6-luna` at 272000.
  Decision 8 accepts this class.
- 89 catalog-wide retirements whose ids carry parameter-size tokens (`70b`, `120b`,
  `235b`, `a12b`), 4-digit snapshots, or glued versions, where numeric comparison of
  unlike components decided the outcome.

## Why the shared version parser is not reused

`package/pi-shared/model-selection/src/version.ts` owns model version parsing for
`advisor`, `auto-mode`, and `thinking-default`.
Its semantics are correct for picking a model out of candidates and wrong for deleting
one, in four specific ways.

1. `DATE_TOKEN_DIGIT_COUNT` is 8 (`version.ts:17`) and `isDateLikeToken` requires
   `token.length >= 8` (`version.ts:312`), so 4-digit snapshots such as `0813` and
   `2407` are read as version numbers.
2. `firstDigitRun` takes the first digit run inside any token and stops there, so
   `qwen3.8` yields 3 and loses the minor version, `gpt-4o` yields 4, and
   `llama-3.1-70b-instruct` yields 3 then 70.
   This rule splits an alphabetic prefix from trailing digits and keeps every
   component, so `qwen3.8` yields 3 then 8, while a token whose digits are followed
   by letters stays a word, so `gpt-4o` yields nothing and `70b` stays in the
   name-shape.
3. `Math.trunc(Number(digits))` discards leading zeros, so `0813` reaches the caller
   as 813 and can no longer be classified as a date downstream.
4. `compareVersions` documents "shorter vectors sort first so aliases win over dated
   snapshots", which is the tiebreak that produced the three `radius` inversions.

If a second package ever needs strict version tokens, the right move is to add a
separate extractor to `pi-shared/model-selection` rather than change
`extractVersionNumbers`, per that package's category rule requiring at least two
consumers.

## Decisions adopted by default, open to veto

These four were put to the user and not answered, so they are recorded as adopted
defaults rather than settled decisions.

1. Family key includes `api`, making the same-id-different-route invariant structural
   instead of a check a later edit can drop.
2. A session found to be running on a retired model logs a warning naming the model
   and its successor and takes no other action, which honors decision 10 while keeping
   the leak visible under decision 9.
3. A provider that resolves to zero models when the factory runs is skipped with a
   warning, and the filter runs again at `session_start` so a late registration is
   still caught.
   Without this, a misordered install would re-register a provider from an empty read
   and delete its models.
4. A `*.characterization.unit.test.ts` pins the full retirement table over the bundled
   catalog, so a pi upgrade that changes any single retirement fails the suite until
   the diff is reviewed.
   Repo precedent: `package/pi-plugin/thinking-default/src/model-policy.characterization.unit.test.ts`.
   The cost is a review commit on catalog-affecting pi upgrades.

## Rejected options

- Generate `enabledModels` from policy and let pi's native scope do the hiding.
  Rejected because the native scope does not hide, as the `model-selector.js` citations
  show.
- Veto model selection through an event result.
  Rejected because no such contract exists in pi 1.0.0.
- `unregisterProvider` for unused providers.
  Rejected by decision 1.
  It remains the cheapest fix for picker clutter if that decision is ever revisited:
  removing `openrouter` alone would drop 399 rows, and no installed npm extension
  references that provider.
- Virtual-model `route()` throw as the block.
  Rejected: it fires only for ids the extension itself registers as virtual, so it
  covers a narrow path while adding a routing surface.
- Age-based retirement.
  Rejected: no per-model date exists in the catalog.
- Aggressive ordering via the shared `compareVersions`.
  Rejected on the measured inversions.
- Source-level `keep` list for known false positives.
  Rejected by decision 3.
  Abstention replaces it: the rule declines to order ambiguous pairs instead of
  recording exceptions to a wrong ordering.
- Context-window regression guard.
  Rejected by decision 8, against the recommendation, with the measured cost recorded
  above.

## Implementation risks, ordered by severity

1. The factory cannot read the catalog, so the registration point is unsettled.
   `ExtensionAPI` spans `dist/core/extensions/types.d.ts:1143-1363` and exposes no
   model read at all: no registry getter, no `getAll`, no `getAvailable`, no `find`.
   Its only model members are `setModel`, `registerProvider`, `unregisterProvider`,
   `registerVirtualModel`, `unregisterVirtualModel`, and the `model_select` event.
   Registry reads live on `ExtensionContext.modelRegistry`
   (`dist/core/extensions/types.d.ts:225`), which is only reachable from event handlers
   and tool execution, so after the factory has returned.
   Re-registering a provider needs that provider's current models, since `models`
   replaces the whole list.
   The candidates are therefore: read the bundled catalog from `@earendil-works/pi-ai`
   directly in the factory, which sees neither `models.json` overrides nor models
   registered by other extensions; or register from an event handler that carries
   `ctx.modelRegistry`, which sees the composed catalog but runs after startup model
   resolution and possibly not at all under `--list-models`.
   Decisive probe, required before implementation: in a disposable host, log the
   factory's own property names, log which events fire and in what order, and compare
   `ctx.modelRegistry.getAll()` against the bundled value for a model whose
   `contextWindow` is overridden in `models.json`.
2. Losing `models.json` overrides on re-registration.
   Composition is `applyExtension(providerId, applyModelsJson(providerId, base,
   modelsConfig), extension)` at `dist/core/provider-composer.js:329`, and
   `applyExtension` returns only the extension's own list (`:171-178`).
   If the factory reads `getAll()` before `models.json` is applied, the values it
   re-declares are the bundled ones.
   Measured gap: the bundled catalog gives `openai-codex/gpt-6-luna` a
   `contextWindow` of 272000 while the live catalog shows 750000, which comes from the
   `modelOverrides` block in `~/.pi/agent/models.json`.
   The same file overrides `gpt-6.1-sol` and `gpt-6-astra`, plus two
   `openai-codex-fast` models.
   A silent revert would land directly on the long-context limitation recorded in
   `.out-of-scope/pi-gpt55-long-context.md`.
   `refreshModels` is not the alternative: its context
   (`pi-ai/dist/models.d.ts:13-31`) exposes `credential`, `stored`, `publish`,
   `allowNetwork`, `force`, and `signal`, but not the composed model list, so it
   cannot filter what pi already resolved.
   Decisive probe, required before implementation: in a disposable host, log
   `getAll()` inside an extension factory and compare `contextWindow` for
   `openai-codex/gpt-6-luna` against 750000.
3. Per-model headers are dropped.
   `extensionModelFromDefinition` returns `{ ...definition, api, provider, baseUrl,
   headers: undefined }` for all three model types
   (`dist/core/provider-composer.js:119-136`).
   Measured exposure in the bundled catalog: `github-copilot` 34 models and `nvidia`
   19, neither in the live set.
   The extension-registered providers `synthetic`, `hyper`, and `openai-codex-fast`
   cannot be inspected from the bundled catalog and must be checked in the same host
   probe.
   Provider-level headers survive, since `ProviderConfig.headers` is passed through.
4. Whole-list replacement.
   `applyExtension` discards every model not present in the extension's list, so a
   partial read deletes models.
   Mitigated by adopted default 3.
5. Type-aware re-declaration.
   Chat, image, and classifier models need different config shapes, and image models
   require `output`.
   A chat-only mapping would silently delete image and classifier models, which
   `codemode` classifiers and openrouter image routes depend on.
6. Startup leak, accepted by decision 10.
   pi keeps a removed model object when the registry lookup fails, so a session that
   resolved a retired model before the flush keeps serving from it.
   Today's `defaultModel`, `mimo-v2.6-pro` on `opencode-go`, is a keeper under the
   rule, so nothing leaks now; the exposure begins the day the default drifts.
7. No extension API stability guarantee.
   pi's `CHANGELOG.md` carries 59 `BREAKING` mentions and the docs name source as the
   contract.
   Mitigated by the characterization suite, `verify:extension`, and a gated host probe.
8. No escape hatch, accepted by decision 4.
   Mitigations are abstention, per-retirement logging, and the
   characterization suite.
   None of them restores a model mid-session.

## Package shape

```text
# package/pi-plugin/model-retirement
README.md
mise.toml
package.json
rolldown.node.config.ts
tsconfig.json
src/
  index.ts                                   # default-exported factory over ExtensionAPI
  register-model-retirement.ts               # testable registration core, injected deps
  retirement-rule.ts                         # family key, ordering, abstention
  id-tokens.ts                               # single-pass tokenizer, no regex
  provider-filter.ts                         # getAll to ProviderModelConfig per type
  retirement-log.ts                          # tagged logger output
  retirement-report.ts                       # formats the retirement table for the log
  retirement-rule.unit.test.ts
  id-tokens.unit.test.ts
  provider-filter.unit.test.ts
  retirement-table.characterization.unit.test.ts
  mise.verify-extension.ts
  verify-host.ts                             # gated disposable-host probe
```

`package.json` follows the sibling pi-plugin shape: `"private": true`, `"type":
"module"`, the two-key `exports` block with a `./ts` subpath,
`"pi": { "extensions": ["./dist/final/node/index.mjs"] }`,
`peerDependencies` on the pi packages at `"*"`, and the same packages in
`devDependencies` at `catalog:`.
Rationale for the peer shape: `doc/troubleshooting/pi-extension-peer-deps.md`.

`mise.toml` carries the 12 tasks shared by `package/pi-plugin/thinking-default` and
`package/pi-plugin/ask-user-question`, plus two of its own: `verify:extension`
depending on `build`, and `verify:host` gated by an environment variable in a
`[tasks."verify:host".env]` block, following `package/pi-plugin/advisor/mise.toml`.

Installation goes in the README, matching the sibling convention:

```bash
# global settings only, never project .pi/settings.json, and last in the array
pi install /var/home/user/Monochromatic/package/pi-plugin/model-retirement
```

## Verification plan

1. Unit tests covering every branch of the tokenizer and the rule. Tokenizer:
   whole-numeric, `v`-prefixed, alphabetic-prefix with dotted digits, trailing-letter
   tokens, parameter sizes, and each date width. Rule: first-component difference,
   magnitude abstention, equal vectors with and without dates, prefix with date-shaped
   extras, prefix with version extras, mixed extras, versionless entries as both loser
   and keeper candidate, and same-id-different-api pairs.
   No regular expressions in the implementation, per the tokenizer requirement in
   "Version tokens".
2. The invariant assertion over the whole bundled catalog: no retirement whose loser
   orders newer than its keeper.
3. The characterization table, per adopted default 4.
4. `verify:extension` against the built `.mjs` with a fake `ExtensionAPI`, asserting
   which providers were re-registered and that no registration carried an empty model
   list.
5. `verify:host` in a disposable pi host, asserting that `pi --list-models` shrank by
   the expected count, that a retired id is no longer findable, that
   `openai-codex/gpt-6-luna` still reports `contextWindow` 750000, and that image and
   classifier model counts are unchanged.
   This is the probe that resolves the factory-read risk and the `models.json`
   override risk, and it must run before the filtering code is written, not after.
6. Manual check in the interactive TUI: the picker no longer offers a retired id, and
   Tab to `all` does not bring it back.

## Open questions

1. Which surface can read the composed catalog early enough to filter it, and does the
   factory's `pi` object carry an undocumented registry handle that the typed
   interface omits?
   The first implementation risk turns on this, and only the host probe answers it.
2. Does `--list-models` fire any event that carries `ctx.modelRegistry`?
   If it does not, and the filter must move to an event handler, then `--list-models`
   keeps printing the unfiltered catalog and the shrunk picker becomes the only
   user-visible evidence that the extension loaded.
3. Is `radius` in scope at all, given it serves the advisor and MCP transports rather
   than interactive picks, and that 9 of its entries are retired by the rule?
4. Should `synthetic` and `hyper` be filtered in the first release, given their
   metadata can only be read at runtime and their owning packages re-register their
   own models?
