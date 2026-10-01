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

The consumer extension is implemented at `package/pi-plugin/openai-fast`.
Its live request checks passed;
 complete offline verification is tracked in [the design record](../planning/pi-openai-fast.md).

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

## Host verification findings

### Availability queries and auth snapshots are separate surfaces

Installed `coding-agent/dist/core/model-runtime.js:308` returns provider-scoped availability
without publishing the auth snapshot used by native virtual routing.
The no-provider query calls the snapshot refresh:

```js
// coding-agent/dist/core/model-runtime.js:308
if (providerId) {
  const available = await this.models.getAvailable(providerId, options);
  return available;
}
await this.queueAvailabilityRefresh(options?.signal);
```

Registration also schedules cached model refreshes.
A snapshot-only query can be superseded by that pending work.
The real CLI's service initializer awaits full cached/availability initialization.
A disposable readiness control reported both providers unconfigured after the earlier fixture,
then both configured after `runtime.refresh({ allowNetwork: false })`.
Using that same initialization boundary in the fixture produced canonical original-model responses.

Complete catalogs intentionally include physical targets.
Filtered availability excludes them.
The inventories must be checked separately rather than calling every complete-catalog entry virtual.

### Composed provider identity is not native registration ownership

Installed `coding-agent/dist/core/model-runtime.js:581` reloads configuration and recomposes providers:

```js
// coding-agent/dist/core/model-runtime.js:581
this.config = await ModelConfig.load(this.modelsPath);
this.configureRadiusProviders();
this.rebuildProviders();
```

The no-plugin control confirmed that configured provider wrapper references change after refresh.
The fast extension preserves the registered native provider,
normal request behavior,
authentication,
and original model header precedence.
It does not promise wrapper-object identity across native recomposition.

### Native error codes remain observable separately from formatted messages

The Codex adapter has its own failure conversion before the shared Responses parser.
Installed `ai/dist/api/openai-codex-responses.js:554` chooses the supplied message:

```js
// ai/dist/api/openai-codex-responses.js:554
if (type === "response.failed") {
  const code = response?.error?.code;
  const message = response?.error?.message;
  throw new CodexApiError(message || "Codex response failed", { code, payload: event });
}
```

Tests assert that exact native message,
the raw `provider_stream_event` failure code,
original model identity,
terminal error status,
and no fallback request.
They do not invent an extension-specific error formatter.

## Live verification and recursion control

The real pi CLI ordinary and fast Luna probes returned the expected marker.
The captured requests used `gpt-6-luna`,
with `service_tier: "priority"` only for fast selection.
Disposable settings used only the existing access token through an environment override.
No real credential store was copied or refreshed.
This is not a live OAuth-refresh test or an acceleration measurement.

The live driver's recursion guard was tested with allowed and rejected disposable fixtures.
Removing the guard from a scratch copy made the same rejection assertion fail.
Both controls stopped before inference at either the recursion guard or an expired synthetic-token check.

```sh
# Repository root
node "${HOME}/temp/agent/pi-fast-live-guard.test.ts"
```

```ts
// ~/temp/agent/pi-fast-live-guard.test.ts
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

const run = promisify(execFile);
const packageRoot = resolve('package/pi-plugin/openai-fast');

test('live driver rejects recursion before token access, and the same assertion fails without its guard', async function verifyGuard() {
  const fixture = await mkdtemp(join(tmpdir(), 'pi-fast-guard-'));
  try {
    const authDir = join(fixture, '.pi', 'agent');
    await mkdir(authDir, { recursive: true });
    await writeFile(join(authDir, 'auth.json'), JSON.stringify({ 'openai-codex': { type: 'oauth', access: 'expired-synthetic-fixture', expires: 0 } }));
    const config = await readFile(join(packageRoot, 'mise.toml'), 'utf8');
    const taskStart = config.indexOf('[tasks."verify:live"]');
    const bodyStart = config.indexOf("run = '''", taskStart) + "run = '''".length;
    const bodyEnd = config.indexOf("'''", bodyStart);
    const body = config.slice(bodyStart, bodyEnd);
    const guard = "if (process.env.PI_OPENAI_FAST_LIVE_CHILD === '1') {\n  throw new LiveVerificationError('Live verification cannot recursively launch itself')\n}\n";
    assert.ok(body.includes(guard));
    async function diagnostic({ source, flag }) {
      try {
        await run(process.execPath, ['--input-type=module-typescript', '-e', source], {
          cwd: packageRoot, env: { ...process.env, HOME: fixture, PI_OPENAI_FAST_LIVE_CHILD: flag },
        });
        throw new Error('Fixture unexpectedly passed');
      } catch (error) {
        assert.ok(error && typeof error === 'object' && 'stderr' in error);
        return String(error.stderr);
      }
    }
    const rejected = await diagnostic({ source: body, flag: '1' });
    assert.ok(rejected.includes('cannot recursively launch itself'));
    const accepted = await diagnostic({ source: body, flag: '0' });
    assert.ok(accepted.includes('currently valid original Codex OAuth access token'));
    const removed = await diagnostic({ source: body.replace(guard, ''), flag: '1' });
    assert.ok(!removed.includes('cannot recursively launch itself'));
    assert.ok(removed.includes('currently valid original Codex OAuth access token'));
    console.log('PASS: allowed/rejected fixtures and removed-guard positive control; no real credentials or inference used');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
```

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

## Pi 1.0 local installation and relative package declarations

### Symptom

The native package commands reported successful removal of the incumbent and installation of the replacement.
The repository's installation verifier then emitted:

```text
# Repository installation verifier
GlobalInstallationError: Pi global package replacement did not produce the expected package declarations.
```

This was a consumer assertion error,
 not a failed native installation.
The verifier had already compared non-package settings successfully.
Its unrelated-package comparison had not run when the path assertion failed.

### Root cause

Pi `1.0.0` normalizes local package sources relative to the owning settings directory.
Installed `coding-agent/dist/core/package-manager.js:1159` contains:

```js
// coding-agent/dist/core/package-manager.js:1159
normalizePackageSourceForSettings(source, scope) {
    const parsed = this.parseSource(source);
    if (parsed.type !== "local") {
        return source;
    }
    const baseDir = this.getBaseDirForScope(scope);
    const resolved = this.resolvePath(parsed.path);
    const rel = relative(baseDir, resolved);
    return rel || ".";
}
```

The previously cloned upstream source has the same method in
`packages/coding-agent/src/core/package-manager.ts:1469`.
The deciding installed `1.0.0` implementation was inspected separately.
Pi's `docs/packages.md` explicitly says relative local paths resolve from their owning settings file.

The initial repository assertion used `installedPackages.includes(packagePath)`.
A relative declaration did not equal the absolute input string,
 although it resolved to the same package.
The replacement assertion uses the installed native `isLocalPath()` and `resolvePath()` helpers,
 accepts string and object declarations,
 and resolves against `dirname(settingsPath)`.
Incumbent checks recognize versioned and object-form npm declarations.

### Verification and workaround

Build,
 type checking,
 the complete offline suite,
 zero-warning lint,
 and extension-host verification passed on pi `1.0.0`.
Native installed-package discovery also passed ordinary and fast Luna live requests.
Only the fast requests supplied priority;
 both used the original model ID.

The installed verifier now resolves the same native agent directory as installation,
 rebases the source to a relative path inside disposable state,
 and preserves object declaration filters.
This consumer-side fix does not alter native installation semantics.
It depends on the installed unbundled path helpers,
 so host upgrades require these installation probes as well as the provider tests.

A disposable reproduction of the corrected installation task:

```ts
// ~/temp/agent/pi-fast-relative-install.ts, run from repository root
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = await mkdtemp(join(homedir(), 'temp', 'agent', 'pi-fast-relative-'));
try {
  const before = {
    packages: ['npm:pi-openai-codex-fast', { source: 'npm:unrelated-fixture', extensions: [] }],
    defaultProvider: 'fixture', defaultModel: 'ordinary', enabledModels: ['fixture/ordinary'],
  };
  await writeFile(join(root, 'settings.json'), JSON.stringify(before));
  const result = await run('mise', ['run', '//package/pi-plugin/openai-fast:install:global'], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: root, PI_CODING_AGENT_DIR: root, PI_OFFLINE: '1' },
  });
  assert.match(result.stdout, /PASS global replacement/u);
  const after = JSON.parse(await readFile(join(root, 'settings.json'), 'utf8'));
  assert.equal(resolve(root, after.packages[1]), resolve('package/pi-plugin/openai-fast'));
  assert.deepEqual(after.packages[0], before.packages[1]);
  assert.deepEqual({ ...after, packages: [] }, { ...before, packages: [] });
} finally {
  await rm(root, { recursive: true, force: true });
}
```

The executed installation controls covered a string incumbent and a versioned filtered-object incumbent.
Both retained defaults,
 exact enabled-model scope,
 and an unrelated filtered package declaration.
Native discovery controls covered:

- Correct relative declaration:
   the built extension loads.
- Filtered declaration with `extensions: []`:
   the extension does not load.
- Wrong or missing package path:
   the replacement does not load.
- Active npm package factories:
   all configured npm extensions affected by reconciliation load without extension errors.

The factory probe is not a complete behavioral test of those other extensions.
No saved pre-install package baseline was found in the agent directory or accessible scratch settings candidates.
The original interrupted comparison is therefore not retrospectively claimed as a pass.

### Native uninstall reconciliation

Installed `coding-agent/dist/core/package-manager.js:1532` invokes npm rather than deleting one directory:

```js
// coding-agent/dist/core/package-manager.js:1542
const args = ["uninstall", source.name, "--prefix", installRoot];
if (packageManagerName !== "pnpm") {
    args.push("--legacy-peer-deps");
}
await this.runNpmCommand(args);
```

The executed npm `11.19.1` log records
`npm uninstall pi-openai-codex-fast --prefix <agent-dir>/npm --legacy-peer-deps`.
It also records failure to reuse the installed tree lock metadata because `node_modules/ajv` was missing from that lockfile.
Npm reported removing the incumbent and changing 80 packages.
Those entries include active provider,
 process,
 Radius,
 subagent,
 and BTW packages.
The log does not establish that all changed entries moved to new versions.

Npm also reported 14 vulnerabilities:
 1 low,
 2 moderate,
 and 11 high.
No audit remediation was attempted.
The affected active extension factories were exercised in disposable,
 credential-free,
 offline state.
Settings preservation must not be described as dependency-tree preservation.

### What does not work

- Comparing a persisted local source to its absolute command input as raw strings.
- Stripping object filters while testing installed discovery.
- Using a different agent directory for installation and installed verification.
- Treating a passed post-install check as recovery of an absent pre-install baseline.
- Claiming that targeted native npm removal leaves every other installed dependency untouched.

### Upstream filing decision

1.  Fault:
    this was the repository's assertion,
    not an upstream defect.
2.  Fixability:
    the consumer assertion was corrected without changing pi.
3.  Supported use case:
    pi documents relative local package sources.
4.  Contribution:
    no upstream contribution is needed.
5.  Direction:
    no undocumented behavior or contradictory upstream promise was established.
6.  Prototype:
    the consumer fix and disposable positive/negative controls passed;
    no upstream patch is warranted.

Upstream filing artifact:
 nothing to add.
The upstream-fault gate fails,
 so no issue or comment is proposed for expected package-source normalization.

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
