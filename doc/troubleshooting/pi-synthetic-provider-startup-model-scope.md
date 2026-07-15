# Pi 0.79.6 and @benvargas/pi-synthetic-provider 1.1.14: startup model scope drops Synthetic GLM-5.2

Current status (2026-06-18):
diagnosed and reproduced.
The local package was not patched.
A minimal upstream-compatible prototype patch is recorded in
[`pi-synthetic-provider-startup-model-scope.patch`](pi-synthetic-provider-startup-model-scope.patch).

## Symptom

Pi prints this warning during startup:

```text
Warning: No models match pattern "synthetic/hf:zai-org/GLM-5.2"
```

The local trigger is an exact `enabledModels` entry in `~/.pi/agent/settings.json:36-40`:

```json
"enabledModels": [
  "openai-codex/gpt-5.5",
  "moonshotai/kimi-k2.7-code",
  "moonshotai/kimi-k2.7-code-highspeed",
  "synthetic/hf:zai-org/GLM-5.2"
]
```

The warning is not a Synthetic API catalog problem.
The live endpoint returns GLM-5.2 as `always_on=true` with tools support:

```bash
curl --silent --show-error --location https://api.synthetic.new/openai/v1/models \
  | jq --raw-output '
    .data[]
    | select(.id == "hf:zai-org/GLM-5.2")
    | {id, name, always_on, supported_features, context_length, max_output_length}
  '
```

```json
{
  "id": "hf:zai-org/GLM-5.2",
  "name": "zai-org/GLM-5.2",
  "always_on": true,
  "supported_features": [
    "tools",
    "json_mode",
    "structured_outputs",
    "reasoning"
  ],
  "context_length": 524288,
  "max_output_length": 65536
}
```

## Root cause

The provider registers a four-model hardcoded fallback catalog during extension loading,
then fetches the live Synthetic catalog later in `session_start`.
Behavior shows `enabledModels` is resolved against the provider catalog that exists
before the `session_start` refresh is visible.
GLM-5.2 is live in Synthetic,
but it is not in the provider's startup fallback catalog,
so the exact scoped-model pattern misses and Pi emits the warning.
Line references under `package/pi-synthetic-provider/` refer to upstream clone commit
`a14dbe2ba398271392483f31d0f5f62e3cb33a98` unless otherwise noted.

### Step 1: Pi reads an exact scoped-model pattern

The observed local settings entry is exact,
not fuzzy and not a glob:
`~/.pi/agent/settings.json:36-40` shows `synthetic/hf:zai-org/GLM-5.2`.

```json
"enabledModels": [
  "openai-codex/gpt-5.5",
  "moonshotai/kimi-k2.7-code",
  "moonshotai/kimi-k2.7-code-highspeed",
  "synthetic/hf:zai-org/GLM-5.2"
]
```

### Step 2: the provider's startup registration uses only fallback models

`package/pi-synthetic-provider/extensions/index.ts:73-83` registers the provider
synchronously with `getFallbackModels()`:

```typescript
export default function (pi: ExtensionAPI) {
	// Register provider synchronously with fallback models.
	// pi.registerProvider() during loading is queued and applied during
	// runner.initialize(). Registrations in event handlers (e.g., session_start)
	// are queued but never flushed, so the initial registration must happen here.
	pi.registerProvider("synthetic", {
		baseUrl: SYNTHETIC_API_BASE_URL,
		apiKey: "$SYNTHETIC_API_KEY",
		api: "openai-completions",
		models: getFallbackModels(),
	});
```

Pi applies registrations queued during extension loading before session services return.
`@earendil-works/pi-coding-agent@0.79.6/dist/core/agent-session-services.js:66-81`
flushes `pendingProviderRegistrations` into the model registry:

```javascript
await resourceLoader.reload(options.resourceLoaderReloadOptions);
const diagnostics = [];
const extensionsResult = resourceLoader.getExtensions();
for (const { name, config, extensionPath } of extensionsResult.runtime.pendingProviderRegistrations) {
    try {
        modelRegistry.registerProvider(name, config);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        diagnostics.push({
            type: "error",
            message: `Extension "${extensionPath}" error: ${message}`,
        });
    }
}
extensionsResult.runtime.pendingProviderRegistrations = [];
```

### Step 3: the provider's live refresh is not visible to startup model matching

`package/pi-synthetic-provider/extensions/index.ts:85-109` fetches live models only
inside `session_start`:

```typescript
// After session starts, replace fallback models with live data from the API.
// pi.registerProvider() now takes effect immediately after startup and also
// lets the runtime refresh the current model reference if the provider config
// changes beneath an already-selected model.
pi.on("session_start", async (_event, ctx) => {
	const apiKey = await getSyntheticApiKey(ctx);
	const hasKey = await hasSyntheticApiKey(ctx);

	// Fetch live models and update the runtime provider registration
	const models = await fetchSyntheticModels(apiKey);

	if (models.length > 0) {
		pi.registerProvider("synthetic", {
			baseUrl: SYNTHETIC_API_BASE_URL,
			apiKey: "$SYNTHETIC_API_KEY",
			api: "openai-completions",
			models,
		});
```

Pi's own custom-provider documentation says dynamic model discovery belongs in an
async extension factory,
not `session_start`,
when the catalog must be visible
during startup and to `pi --list-models`.
`@earendil-works/pi-coding-agent@0.79.6/docs/custom-provider.md:63`:

```text
The extension factory can also be `async`. For dynamic model discovery, fetch and register models in the factory instead of `session_start`. pi waits for the factory before startup continues, so the provider is available during interactive startup and to `pi --list-models`.
```

The loader does wait for async extension factories.
`@earendil-works/pi-coding-agent@0.79.6/dist/core/extensions/loader.js:296-306`:

```javascript
async function loadExtension(extensionPath, cwd, eventBus, runtime) {
    const resolvedPath = resolvePath(extensionPath, cwd, { normalizeUnicodeSpaces: true });
    try {
        const factory = await loadExtensionModule(resolvedPath);
        if (!factory) {
            return { extension: null, error: `Extension does not export a valid factory function: ${extensionPath}` };
        }
        const extension = createExtension(extensionPath, resolvedPath);
        const api = createExtensionAPI(extension, runtime, cwd, eventBus);
        await factory(api);
```

`session_start` is emitted later,
when extensions are bound to an `AgentSession`.
`@earendil-works/pi-coding-agent@0.79.6/dist/core/agent-session.js:1654-1656`:

```javascript
this._applyExtensionBindings(this._extensionRunner);
await this._extensionRunner.emit(this._sessionStartEvent);
await this.extendResourcesFromExtensions(this._sessionStartEvent.reason === "reload" ? "reload" : "startup");
```

### Step 4: Pi warns when the current catalog has no match

`@earendil-works/pi-coding-agent@0.79.6/dist/core/model-resolver.js:209-248`
resolves scoped model patterns against `modelRegistry.getAvailable()` and prints the
warning when no model matches:

```javascript
export async function resolveModelScope(patterns, modelRegistry) {
    const availableModels = await modelRegistry.getAvailable();
    const scopedModels = [];
    for (const pattern of patterns) {
        // Check if pattern contains glob characters
        if (pattern.includes("*") || pattern.includes("?") || pattern.includes("[")) {
            // Match against "provider/modelId" format OR just model ID
            const matchingModels = availableModels.filter((m) => {
                const fullId = `${m.provider}/${m.id}`;
                return minimatch(fullId, globPattern, { nocase: true }) || minimatch(m.id, globPattern, { nocase: true });
            });
            if (matchingModels.length === 0) {
                console.warn(chalk.yellow(`Warning: No models match pattern "${pattern}"`));
                continue;
            }
        }

        const { model, thinkingLevel, warning } = parseModelPattern(pattern, availableModels);

        if (!model) {
            console.warn(chalk.yellow(`Warning: No models match pattern "${pattern}"`));
```

### Step 5: the live fetch would include GLM-5.2, but the fallback list cannot

`package/pi-synthetic-provider/extensions/models.ts:13-24` fetches the live endpoint,
and `models.ts:34-40` includes every model that is always-on and supports tools:

```typescript
export async function fetchSyntheticModels(apiKey?: string): Promise<ProviderModelConfig[]> {
	try {
		const headers: Record<string, string> = {
			Accept: "application/json",
		};

		// API key is optional for model listing (public endpoint)
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const response = await fetch(SYNTHETIC_MODELS_ENDPOINT, { headers });

		for (const model of data.data) {
			// Only include always-on models.
			// Treat null/missing supported_features as "all features supported"
			// since the API only populates this field for Synthetic-hosted models.
			if (!model.always_on) continue;
			if (model.supported_features && !model.supported_features.includes("tools")) continue;
```

`package/pi-synthetic-provider/extensions/models.ts:78-89` documents the fallback
catalog as Kimi-K2.6,
MiniMax-M2.5,
Nemotron,
and GLM-5.1:

```typescript
/**
 * Fallback models if API fetch fails.
 * Data sourced from: curl https://api.synthetic.new/openai/v1/models
 * Last updated: 2026-05-01
 *
 * Pricing format: $/million tokens
 * Synthetic-hosted models:
 * - Kimi-K2.6: $0.95 input, $4.00 output, 262K context
 * - MiniMax-M2.5: $0.40 input, $2.00 output, 191K context
 * - Nemotron-3-Super-120B-A12B-NVFP4: $0.30 input, $1.00 output, 262K context
 * - GLM-5.1: $1.00 input, $3.00 output, 196K context
 */
```

The fallback implementation includes GLM-5.1 at
`package/pi-synthetic-provider/extensions/models.ts:137-151`,
not GLM-5.2:

```typescript
{
	id: "hf:zai-org/GLM-5.1",
	name: "zai-org/GLM-5.1",
	reasoning: true,
	input: ["text"],
	cost: {
		input: 1,
		output: 3,
		cacheRead: 1,
		cacheWrite: 0,
	},
	contextWindow: 196608,
	maxTokens: 65536,
	compat: SYNTHETIC_COMPAT,
},
```

## Verification

Version under test:

- Pi CLI value from `pi --version` was `0.79.6`.
- `SYNTHETIC_API_KEY=dummy` in the `pi --list-models` commands below is only a
  scratch value to mark the provider as auth-configured for model listing.
  It is not valid for inference;
  real model calls need a real Synthetic key.
- Installed provider was `@benvargas/pi-synthetic-provider` version `1.1.14`
  from `~/.pi/agent/npm/node_modules/@benvargas/pi-synthetic-provider/package.json`.
- Source clone was `ben-vargas/pi-packages` at
  `a14dbe2ba398271392483f31d0f5f62e3cb33a98`,
  cloned from `https://github.com/ben-vargas/pi-packages.git`.

### Failing catalog

Exact GLM-5.2 scoped pattern fails before live model refresh:

```bash
scratch_dir=$(mktemp --directory /tmp/agent/pi-synthetic-warning-XXXXXX)
python - "$scratch_dir/settings.json" <<'PY'
import json, sys
settings = {
  "packages": ["/var/home/user/.pi/agent/npm/node_modules/@benvargas/pi-synthetic-provider"],
  "defaultProvider": "synthetic",
  "defaultModel": "hf:zai-org/GLM-5.2",
  "enabledModels": ["synthetic/hf:zai-org/GLM-5.2"]
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2)
PY
PI_CODING_AGENT_DIR="$scratch_dir" SYNTHETIC_API_KEY=dummy pi --list-models synthetic 2>&1 | head --lines 80
```

```text
Warning: No models match pattern "synthetic/hf:zai-org/GLM-5.2"
provider   model                                              context  max-out  thinking  images
synthetic  hf:MiniMaxAI/MiniMax-M2.5                          191.5K   65.5K    yes       no
synthetic  hf:moonshotai/Kimi-K2.6                            262.1K   65.5K    yes       yes
synthetic  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4  262.1K   65.5K    yes       no
synthetic  hf:zai-org/GLM-5.1                                 196.6K   65.5K    yes       no
```

A `models.json` provider entry does load when the provider package is absent:

```text
provider   model               context  max-out  thinking  images
synthetic  hf:zai-org/GLM-5.2  524.3K   65.5K    yes       no
```

The same `models.json` entry does not fix the package case when the provider
extension is also installed:

```text
Warning: No models match pattern "synthetic/hf:zai-org/GLM-5.2"
provider   model                                              context  max-out  thinking  images
synthetic  hf:MiniMaxAI/MiniMax-M2.5                          191.5K   65.5K    yes       no
synthetic  hf:moonshotai/Kimi-K2.6                            262.1K   65.5K    yes       yes
synthetic  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4  262.1K   65.5K    yes       no
synthetic  hf:zai-org/GLM-5.1                                 196.6K   65.5K    yes       no
```

That result follows Pi's provider-registration semantics:
`@earendil-works/pi-coding-agent@0.79.6/dist/core/model-registry.js:691-692`
checks for model-bearing registrations,
and the following block removes existing
models for that provider before pushing the registered list:

```javascript
this.storeProviderRequestConfig(providerName, config);
if (config.models && config.models.length > 0) {
    // Full replacement: remove existing models for this provider
```

### Working catalog

An exact fallback model works because it exists before `session_start`:

```bash
scratch_dir=$(mktemp --directory /tmp/agent/pi-synthetic-glm51-XXXXXX)
python - "$scratch_dir/settings.json" <<'PY'
import json, sys
settings = {
  "packages": ["/var/home/user/.pi/agent/npm/node_modules/@benvargas/pi-synthetic-provider"],
  "enabledModels": ["synthetic/hf:zai-org/GLM-5.1"]
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2)
PY
PI_CODING_AGENT_DIR="$scratch_dir" SYNTHETIC_API_KEY=dummy pi --list-models GLM-5 2>&1 | head --lines 80
```

```text
provider   model               context  max-out  thinking  images
synthetic  hf:zai-org/GLM-5.1  196.6K   65.5K    yes       no
```

A fuzzy fallback pattern also works cleanly,
but it resolves to GLM-5.1,
not GLM-5.2:

```text
provider   model               context  max-out  thinking  images
synthetic  hf:zai-org/GLM-5.1  196.6K   65.5K    yes       no
```

The upstream prototype patch makes exact GLM-5.2 work before `session_start`:

```bash
scratch_dir=$(mktemp --directory /tmp/agent/pi-synthetic-prototype-verify-XXXXXX)
python - "$scratch_dir/settings.json" <<'PY'
import json, sys
settings = {
  "packages": ["/tmp/agent/pi-synthetic-prototype-KOhVns/repo/packages/pi-synthetic-provider"],
  "enabledModels": ["synthetic/hf:zai-org/GLM-5.2"]
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2)
PY
PI_CODING_AGENT_DIR="$scratch_dir" SYNTHETIC_API_KEY=dummy pi --list-models GLM-5.2 2>&1 | head --lines 80
```

```text
provider   model               context  max-out  thinking  images
synthetic  hf:zai-org/GLM-5.2  524.3K   65.5K    yes       no
```

## Verified workarounds

### Add a local startup shim extension

Use a shim extension after `@benvargas/pi-synthetic-provider` in `packages` to
register GLM-5.2 during extension loading.
This consumer-side workaround does not edit the third-party package.

```typescript
// ~/.pi/agent/extensions/synthetic-glm-52.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SYNTHETIC_COMPAT = {
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsStrictMode: false,
  supportsUsageInStreaming: false,
  supportsStore: false,
  maxTokensField: "max_tokens",
  requiresToolResultName: true,
} as const;

export default function syntheticGlm52StartupModel(pi: ExtensionAPI): void {
  pi.registerProvider("synthetic", {
    baseUrl: "https://api.synthetic.new/openai/v1",
    apiKey: "$SYNTHETIC_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "hf:zai-org/GLM-5.2",
        name: "zai-org/GLM-5.2",
        reasoning: true,
        input: ["text"],
        cost: { input: 1, output: 3, cacheRead: 1, cacheWrite: 0 },
        contextWindow: 524288,
        maxTokens: 65536,
        compat: SYNTHETIC_COMPAT,
      },
    ],
  });
}
```

Settings shape:

```json
{
  "packages": [
    "npm:@benvargas/pi-synthetic-provider",
    "~/.pi/agent/extensions/synthetic-glm-52.ts"
  ],
  "enabledModels": ["synthetic/hf:zai-org/GLM-5.2"]
}
```

Verified result:

```text
provider   model               context  max-out  thinking  images
synthetic  hf:zai-org/GLM-5.2  524.3K   65.5K    yes       no
```

Tradeoff:
this hardcodes GLM-5.2 metadata at the consumer boundary.
Add every other Synthetic model from `enabledModels` to the shim too.
Do the same for each Synthetic model needed for startup cycling before the provider's
`session_start` refresh.
After a full interactive session starts the upstream provider's existing
`session_start` handler still refreshes the live catalog.

### Use a fallback model in `enabledModels`

Pointing `enabledModels` at `synthetic/hf:zai-org/GLM-5.1` avoids the warning
because GLM-5.1 is in the startup fallback catalog.

Tradeoff:
this changes the selected model to GLM-5.1.
It is only acceptable when the goal is a quiet startup rather than using GLM-5.2.

## What does not work

- Adding GLM-5.2 to `~/.pi/agent/models.json` while the provider package is installed
  does not work because the package's model-bearing `registerProvider("synthetic", ...)`
  call replaces the existing `synthetic` provider models before scoped-model resolution.
- Changing the pattern to a broader fallback match such as `hf:zai-org/GLM-5`
  avoids the GLM-5.2 warning only by resolving to GLM-5.1.
  That is not a GLM-5.2 workaround.
- Waiting for `session_start` does not help `pi --list-models` or the initial
  scoped-model warning.
  Pi's custom-provider documentation explicitly says dynamic model discovery needed
  at startup belongs in the extension factory.

## Upstream filing decision

### Out-of-scope check

No matching exemption exists in `.out-of-scope/`.
The search checked files under `.out-of-scope/` for `synthetic`,
`pi`,
`provider`,
and `GLM`;
matches were unrelated to this provider warning.

### Duplicate search

No duplicate issue or PR was found in `ben-vargas/pi-packages`.
The checked searches were:

```bash
gh search issues --repo ben-vargas/pi-packages 'GLM-5.2 No models match pattern synthetic provider' --state open
gh search issues --repo ben-vargas/pi-packages 'GLM-5.2 No models match pattern synthetic provider' --state closed
gh search prs --repo ben-vargas/pi-packages 'GLM-5.2 synthetic provider fallback session_start' --state open
gh search prs --repo ben-vargas/pi-packages 'GLM-5.2 synthetic provider fallback session_start' --state closed
gh search issues --repo ben-vargas/pi-packages 'synthetic provider dynamic model discovery session_start' --state open
gh search issues --repo ben-vargas/pi-packages 'synthetic provider dynamic model discovery session_start' --state closed
gh search issues --repo ben-vargas/pi-packages 'fallback models GLM synthetic' --state open
gh search issues --repo ben-vargas/pi-packages 'fallback models GLM synthetic' --state closed
gh search prs --repo ben-vargas/pi-packages 'fallback models GLM synthetic' --state open
gh search prs --repo ben-vargas/pi-packages 'fallback models GLM synthetic' --state closed
```

Each returned `[]`.

### Constraint check

#### Is it really upstream's fault

Yes.
The local settings entry is valid Pi syntax.
The live Synthetic endpoint includes GLM-5.2.
The provider registers stale fallback models during extension loading.
The warning comes from Pi resolving a valid pattern against that stale provider catalog.

#### Can upstream fix it

Yes.
The provider can fetch live models in an async factory before initial registration,
exactly as Pi's custom-provider documentation recommends.

#### Are they supporting this use case

Yes.
`package/pi-synthetic-provider/README.md:7-13` advertises dynamic model discovery
at session start and graceful degradation through fallback models.
Pi's custom-provider docs explicitly support async factory registration for dynamic
catalogs that must be visible to startup and `pi --list-models`.

#### Would the repo welcome our contribution

Soft yes.
No repository policy was found that discourages filing.
The repository has no `CONTRIBUTING.md`,
no issue template,
no PR template,
and no AI-assisted filing ban in the cloned source.
The README has a Contributing section with local testing instructions.
Recent repo history shows merged PRs.
Examples include PR 7 for a Synthetic fallback update and PR 13 for Pi compatibility.

#### Will they likely fix it

Soft yes under the default filing check.
No duplicate or wontfix signal was found.
The repo has prior Synthetic fallback maintenance.
This is enough to make filing reasonable,
not a prediction of maintainer response.

#### Have we prototyped a minimal fix compatible with their architecture

Yes.
The patch in `pi-synthetic-provider-startup-model-scope.patch` makes the extension
factory async.
It fetches live models before initial registration.
It keeps fallback behavior through the existing `fetchSyntheticModels()` catch path.
It updates the package's startup registration test.
The prototype was verified with `PI_CODING_AGENT_DIR` pointing at the patched clone;
`pi --list-models GLM-5.2` listed GLM-5.2 without the warning.
Tradeoff:
startup now waits for the model-catalog fetch.
`package/pi-synthetic-provider/extensions/models.ts:13-24` has no explicit timeout,
so an upstream patch should consider a bounded fetch if startup latency matters.

### Draft issue

~~~md
Title: pi-synthetic-provider misses live Synthetic models during startup model-scope resolution

Labels: bug

## Summary

`@benvargas/pi-synthetic-provider` 1.1.14 can warn at Pi startup when `enabledModels`
contains a live Synthetic model that is absent from the hardcoded fallback catalog.
For example, Pi 0.79.6 prints:

```text
Warning: No models match pattern "synthetic/hf:zai-org/GLM-5.2"
```

The live Synthetic `/models` endpoint currently returns `hf:zai-org/GLM-5.2`
with `always_on=true` and `tools` support, so the warning is not caused by
Synthetic removing the model.

## Reproduction

Use a scratch Pi agent dir with only this package enabled:

```bash
scratch_dir=$(mktemp --directory /tmp/pi-synthetic-warning-XXXXXX)
python - "$scratch_dir/settings.json" <<'PY'
import json, sys
settings = {
  "packages": ["/path/to/pi-synthetic-provider"],
  "enabledModels": ["synthetic/hf:zai-org/GLM-5.2"]
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2)
PY
PI_CODING_AGENT_DIR="$scratch_dir" SYNTHETIC_API_KEY=dummy pi --list-models synthetic
```

Observed:

```text
Warning: No models match pattern "synthetic/hf:zai-org/GLM-5.2"
provider   model                                              context  max-out  thinking  images
synthetic  hf:MiniMaxAI/MiniMax-M2.5                          191.5K   65.5K    yes       no
synthetic  hf:moonshotai/Kimi-K2.6                            262.1K   65.5K    yes       yes
synthetic  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4  262.1K   65.5K    yes       no
synthetic  hf:zai-org/GLM-5.1                                 196.6K   65.5K    yes       no
```

## Source trace

`package/pi-synthetic-provider/extensions/index.ts:73-83` registers the provider
at extension-load time with `getFallbackModels()`.
That fallback list in `package/pi-synthetic-provider/extensions/models.ts:78-89`
contains Kimi-K2.6, MiniMax-M2.5, Nemotron, and GLM-5.1, but not GLM-5.2.

The live catalog fetch is deferred to the `session_start` handler at
`package/pi-synthetic-provider/extensions/index.ts:85-109`.
That is too late for Pi startup model-scope resolution and `pi --list-models`.
Pi's custom-provider docs say dynamic model discovery should happen in an async
extension factory when the provider must be available during startup and to
`pi --list-models`.

## Suggested fix

Make the extension factory async and use the existing `fetchSyntheticModels()`
helper before the initial `registerProvider` call:

```diff
-export default function (pi: ExtensionAPI) {
+export default async function (pi: ExtensionAPI) {
+	const startupModels = await fetchSyntheticModels();
+
	pi.registerProvider("synthetic", {
		baseUrl: SYNTHETIC_API_BASE_URL,
		apiKey: "$SYNTHETIC_API_KEY",
		api: "openai-completions",
-		models: getFallbackModels(),
+		models: startupModels,
	});
```

`fetchSyntheticModels()` already catches endpoint failures and returns
`getFallbackModels()`, so the existing graceful-degradation behavior is preserved.
The tradeoff is that startup now waits for the model-catalog fetch.
The current helper has no explicit timeout, so a production patch should consider
bounding that fetch if startup latency matters.

I prototyped this in a disposable clone and verified:

```text
provider   model               context  max-out  thinking  images
synthetic  hf:zai-org/GLM-5.2  524.3K   65.5K    yes       no
```
~~~
