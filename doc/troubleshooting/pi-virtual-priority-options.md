# Pi 0.99.2 virtual routing does not carry priority request options

## Symptom

Returning a cloned Codex model with request-setting changes from a native virtual router
does not change the dispatched catalog model.
Returning an extra `serviceTier` value does not add priority processing.
Passing that value as an extra option to native Codex `streamSimple()` also does not preserve it.

The installed `pi-openai-codex-fast@0.0.17` uses physical companion models,
not pi's native virtual-model API.
Its allowlist is contrary to the user's accepted requirement.

This is an integration constraint,
not a reproduced backend failure.
No live request or speed measurement was performed.

## Root cause

The installed coding-agent and pi-ai packages under test are version `0.99.2`.
The upstream source was also cloned read-only and inspected at commit
`6f1072cc081f06b86a673bd142f03720d17afe15`.
That commit corroborates the relevant source shape;
it is not asserted to be the release commit of the installed packages.

### Virtual routing is model selection, not request-option configuration

Upstream `packages/coding-agent/src/core/virtual-models.ts:73` defines the route result:

```ts
// packages/coding-agent/src/core/virtual-models.ts:73
export interface ModelRoute<TState = unknown> {
  model: Model<Api>;
  thinkingLevel: ModelThinkingLevel;
  state?: TState;
}
```

The declaration has no request-options field.
Upstream `packages/coding-agent/src/core/model-runtime.ts:1020`
looks up the target by its catalog identity and constructs a restricted result:

```ts
// packages/coding-agent/src/core/model-runtime.ts:1020
const target = this.getPhysicalModel(route.model.provider, route.model.id);
return { model: target, thinkingLevel: clampThinkingLevel(target, route.thinkingLevel), state: route.state };
```

The installed equivalent is
`coding-agent/dist/core/model-runtime.js:744`.
Consequently,
changing properties on a cloned target does not change the canonical target.

### Native simple options omit unsupported tier settings

Upstream `packages/ai/src/api/openai-codex-responses.ts:510`
converts simple options before calling the full native stream:

```ts
// packages/ai/src/api/openai-codex-responses.ts:510
const base = {
  ...buildBaseOptions(model, context, options, apiKey),
  toolChoice: options?.toolChoice,
};
return stream(model, context, {
  ...base,
  reasoningEffort,
});
```

`packages/ai/src/api/simple-options.ts:21` defines `buildBaseOptions()`.
It copies supported settings,
including `transport`,
`signal`,
`sessionId`,
and instrumentation callbacks,
but not `serviceTier`.
The installed equivalents are
`ai/dist/api/openai-codex-responses.js:354`
and `ai/dist/api/simple-options.js:10`.

The full adapter does handle the supported tier option at
`packages/ai/src/api/openai-codex-responses.ts:570`:

```ts
// packages/ai/src/api/openai-codex-responses.ts:570
if (options?.serviceTier !== undefined) {
  body.service_tier = options.serviceTier;
}
```

Its installed equivalent is `ai/dist/api/openai-codex-responses.js:404`.

### Availability filtering can retain a routable physical target

Upstream `packages/coding-agent/src/core/virtual-models.ts:226`
applies the physical provider's availability filter and then retains virtual entries:

```ts
// packages/coding-agent/src/core/virtual-models.ts:226
filterModels: (models, credential) => {
  const real = physical(models);
  return [...(filterModels?.(real, credential) ?? real), ...virtual(models)];
},
```

The installed equivalent begins at `coding-agent/dist/core/virtual-models.js:114`.
The routing fixture verifies availability-list exclusion,
not invisibility in every registry API or in pi's native routed-model display.

## Verification

These harnesses use repository-installed dependencies,
synthetic authentication,
and disposable files.
The native adapter harness throws from the payload callback before any network operation.
The routing harness never streams.

Run from the repository root after saving the fenced programs to the named scratch files:

```sh
# Repository root
node "${HOME}/temp/agent/pi-virtual-routing.test.ts"
node "${HOME}/temp/agent/pi-codex-tier.test.ts"
```

### Routing harness

```ts
// ~/temp/agent/pi-virtual-routing.test.ts
import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
const hostRoot = resolve('package/pi-plugin/advisor/node_modules/@earendil-works');
const { ModelRuntime } = await import(pathToFileURL(join(hostRoot, 'pi-coding-agent/dist/index.js')).href);

//region Probe actual virtual routing and catalog visibility, not priority implementation.
test('virtual selections can route to a physical target omitted from available models', async function verifyVirtualRoute() {
  const temporary = await mkdtemp(join(tmpdir(), 'pi-virtual-routing-'));
  try {
    const runtime = await ModelRuntime.create({
      authPath: join(temporary, 'auth.json'),
      modelsPath: null,
      modelsStorePath: join(temporary, 'models-store.json'),
      allowModelNetwork: false,
      refreshOnCreate: false,
    });
    const base = {
      provider: 'fixture', id: 'base', name: 'Base', api: 'fixture-api',
      baseUrl: 'https://fixture.invalid', reasoning: true, input: ['text'],
      thinkingLevelMap: { high: 'high' }, contextWindow: 100000, maxTokens: 1000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };
    const target = { ...base, id: 'internal/base', name: 'Internal base' };
    function unreachableStream() { throw new Error('This routing-only probe must never stream'); }
    runtime.registerNativeProvider({
      id: 'fixture', name: 'Fixture',
      auth: { apiKey: {
        name: 'Fixture',
        check: async function fixtureCheck() { return { type: 'api_key', source: 'fixture' }; },
        resolve: async function fixtureAuth() { return { auth: { apiKey: 'synthetic-fixture' }, source: 'fixture' }; },
      } },
      getModels: function fixtureCatalog() { return [base, target]; },
      filterModels: function availableCatalog(models) { return models.filter(function isVisible(model) { return model.id === base.id; }); },
      stream: unreachableStream, streamSimple: unreachableStream,
    });
    runtime.registerVirtualModel({
      provider: 'fixture', id: 'base-fast', name: 'Base fast', thinkingLevels: ['high'],
      route: function fixtureRoute(request) {
        return { model: { ...target, api: 'discarded-api' }, thinkingLevel: request.thinkingLevel, serviceTier: 'discarded-priority' };
      },
    });
    const refresh = await runtime.refresh({ allowNetwork: false, providers: ['fixture'] });
    assert.equal(refresh.errors.size, 0);
    await runtime.setRuntimeApiKey('fixture', 'synthetic-fixture');
    assert.equal(runtime.hasConfiguredAuth('fixture'), true);
    const available = await runtime.getAvailable('fixture');
    assert.deepEqual(available.map(function id(model) { return model.id; }), ['base', 'base-fast']);
    const selected = runtime.getModel('fixture', 'base-fast');
    assert.ok(selected);
    assert.equal(selected.api, 'pi-virtual');
    const routed = await runtime.resolveModel(selected, [], { reason: 'user', thinkingLevel: 'high' });
    assert.equal(routed.model.id, target.id);
    assert.equal(routed.model.api, 'fixture-api');
    assert.equal(routed.serviceTier, undefined);
    console.log(JSON.stringify({ available: available.map(function id(model) { return model.id; }), selectedApi: selected.api, routedId: routed.model.id, canonicalApi: routed.model.api, discardedRouteTier: routed.serviceTier === undefined }));
    runtime.unregisterVirtualModel('fixture', 'base-fast');
    runtime.unregisterProvider('fixture');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
//endregion
```

### Native request-construction harness

```ts
// ~/temp/agent/pi-codex-tier.test.ts
import { strict as assert } from 'node:assert';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
const hostRoot = resolve('package/pi-plugin/advisor/node_modules/@earendil-works/pi-ai/dist/api');
const { stream, streamSimple } = await import(pathToFileURL(join(hostRoot, 'openai-codex-responses.js')).href);
const { buildBaseOptions } = await import(pathToFileURL(join(hostRoot, 'simple-options.js')).href);

//region Observe native request construction, aborting before all networking.
const model = {
  provider: 'openai-codex', id: 'fixture-base', name: 'Fixture', api: 'openai-codex-responses',
  baseUrl: 'https://fixture.invalid', reasoning: true, input: ['text'],
  contextWindow: 100000, maxTokens: 1000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};
const context = { messages: [{ role: 'user', content: 'offline fixture', timestamp: 0 }] };
const claims = Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'synthetic-fixture' } })).toString('base64url');
const apiKey = `fixture.${claims}.fixture`;

async function capturedTier({ invoke }) {
  let called = false;
  let tier;
  const result = await invoke(model, context, {
    apiKey, serviceTier: 'priority', transport: 'sse',
    onPayload: function capture(payload) {
      called = true;
      assert.equal(payload.model, 'fixture-base');
      tier = payload.service_tier;
      throw new Error('offline-probe-stop');
    },
    fetch: async function rejectNetwork() { throw new Error('Unexpected network attempt'); },
  }).result();
  assert.equal(called, true);
  assert.match(result.errorMessage, /offline-probe-stop/u);
  return tier;
}

test('full stream keeps priority while native simple conversion drops the unsupported option', async function verifyTierConversion() {
  assert.equal(await capturedTier({ invoke: stream }), 'priority');
  assert.equal(await capturedTier({ invoke: streamSimple }), undefined);
  const signal = new AbortController().signal;
  const converted = buildBaseOptions(model, context, { apiKey, signal, transport: 'auto', sessionId: 'synthetic-session' });
  assert.equal(converted.signal, signal);
  assert.equal(converted.transport, 'auto');
  assert.equal(converted.sessionId, 'synthetic-session');
  console.log(JSON.stringify({ full: 'priority', simple: 'absent', preserved: ['signal', 'transport', 'sessionId'] }));
});
//endregion
```

### Working catalog

- A genuine virtual selection has API `pi-virtual`.
- `getAvailable()` exposes `base` and `base-fast`,
  while routing reaches physical `internal/base`.
- Full native streaming constructs `service_tier: "priority"`.
- The native conversion helper preserves the provided signal,
  `transport: "auto"`,
  and session ID.

### Nonworking catalog

- A cloned route target with `api: "discarded-api"` resolves to the original `fixture-api`.
- An extra route `serviceTier` value disappears.
- An extra top-level `serviceTier` passed to native `streamSimple()` is absent from the constructed payload.

Observed outputs:

```text
# Offline harness results
{"available":["base","base-fast"],"selectedApi":"pi-virtual","routedId":"internal/base","canonicalApi":"fixture-api","discardedRouteTier":true}
{"full":"priority","simple":"absent","preserved":["signal","transport","sessionId"]}
```

Both tests passed.
They do not verify a complete candidate extension,
extension-factory composition,
OAuth refresh,
backend support,
or acceleration.

## Verified mechanisms and proposed workaround

The verified mechanisms are native full-stream tier construction
and a real virtual entry routing to an availability-filtered physical target.

The proposed consumer-side extension combines those mechanisms:
a virtual selection routes to a priority target,
which translates back to the upstream base model before native streaming.
Use native simple-option conversion and reasoning mapping before supplying full-stream priority options.

Tradeoffs:
internal targets still exist in the complete catalog;
native virtual-routing presentation can expose a routed identity;
provider composition,
model refresh,
canonical history,
and OAuth lifecycle require candidate verification.

The combined extension has not been implemented or verified.
See [the design interview](../planning/pi-openai-fast.md).

## What does not work

- Treating the incumbent's physical provider companions as native virtual models.
- Returning modified model properties or request options from a virtual router.
- Supplying unsupported extra tier settings directly to native simple streaming.
- Treating payload-only priority injection as proof of options-based accounting or backend priority service.
- Copying the incumbent's model allowlist,
  which contradicts the accepted requirement.

Initial harness mistakes were corrected rather than attributed to pi:
`ModelRuntime.registerProvider()` is the legacy registration method;
native fixture providers use `registerNativeProvider()`.
The fixture also required a configured disposable auth snapshot.
CommonJS `require.resolve()` did not satisfy the installed packages' import-only exports;
the harnesses now use ESM imports of the repository-installed distributions.

## Upstream filing artifact

Nothing is being filed or drafted.
No upstream defect has been established;
the integration uses extension APIs at the consumer boundary.

### Upstream filing decision

1.  Upstream fault:
    not established.
    The documented virtual route does not promise request-option overrides,
    and the simple stream type does not expose `serviceTier`.
2.  Upstream fixability:
    an expanded API could support request profiles,
    but no upstream change is required to investigate the consumer-side design.
3.  Supported use case:
    pi documents virtual routing and custom providers;
    the route documentation does not promise tier override support.
4.  Contribution policy:
    the inspected upstream README says new-contributor issues and PRs are auto-closed for maintainer review.
    No contribution is proposed here.
5.  Upstream direction:
    [issue 4643][tier-issue] contains a maintainer preference for an extension rather than a general `/fast` abstraction.
    [Issue 6738][profile-issue] contains a maintainer's concern about Fast effectiveness outside Codex harnesses.
    Neither comment proves current backend behavior for this installation.
6.  Prototype:
    no upstream source patch was created.
    The offline consumer fixtures are not an upstream-fix prototype.
    The automatic upstream-prototype requirement does not apply because upstream fault is not established.

Checked `.out-of-scope/codex-harness.md`
and `.out-of-scope/pi-gpt55-long-context.md`.
Neither exempts this pi provider design:
the former excludes Codex harness integrations,
and the latter concerns GPT-5.5 context limits.

Read-only tracker searches covered issues and PRs for `service_tier`
and issues for `virtual model options`.
Related threads were read with their comments:
[5840][config-issue],
[6738][profile-issue],
[9942][sampling-issue],
and [4643][tier-issue].
The source-matched mechanisms do not justify a duplicate feature request.
The user requested a local extension,
not upstream work.

## Backend evidence boundary

[OpenAI's Codex speed documentation][codex-speed] describes increased quota consumption
and plan,
client,
workspace,
and rollout restrictions.
The extension can promise a requested tier,
not backend acceleration.
A successful response or an accounting multiplier alone is not proof of priority execution.

The user accepted no manually maintained compatibility list and no added feedback UI.
Backend model rejection must surface without client tier or model fallback.
Server-side tier behavior,
entitlement,
actual quota consumption,
and latency remain unverified.

[tier-issue]: https://github.com/earendil-works/pi/issues/4643
[profile-issue]: https://github.com/earendil-works/pi/issues/6738
[config-issue]: https://github.com/earendil-works/pi/issues/5840
[sampling-issue]: https://github.com/earendil-works/pi/issues/9942
[codex-speed]: https://developers.openai.com/codex/agent-configuration/speed
