# Pi OpenAI fast provider constraints

## Scope and evidence

Installed-source research for pi `0.99.2`,
 not an architecture decision or implementation.
No credentials or incumbent fast-extension source were inspected.
The main investigation supplied Codex-login-only,
 opt-in companions,
 replacement-after-verification requirements,
`transport: "auto"`,
 and exact enabled scopes.
Later answers keep `enabledModels` unchanged and cover every registered base Codex model.
Every model is assumed priority-capable;
 no manually maintained eligibility list is authorized.
Backend support remains an assumption,
 not verified evidence.

Source prefixes resolve to these installed package roots:

- `coding-agent/`:
  `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.99.2_supports-color@10.2.2/node_modules/@earendil-works/pi-coding-agent/`.
- `ai/`:
  `node_modules/.pnpm/@earendil-works+pi-ai@0.99.2_supports-color@10.2.2_undici@8.11.2/node_modules/@earendil-works/pi-ai/`.

Completely read `coding-agent/docs/extensions.md`,
 `custom-provider.md`,
 `models.md`,
`virtual-models.md`,
 `providers.md`,
 `configuration.md`,
 `settings.md`,
 `packages.md`,
 `security.md`,
 and `cli.md`.

## Companion registration and identity

Same-provider suffixed physical models are supported,
 but supplying legacy `models` replaces the complete catalog,
not just chat aliases (`coding-agent/dist/core/provider-composer.js:177`):

```js
// coding-agent/dist/core/provider-composer.js:177
return config.models.map((definition) => extensionModelFromDefinition(providerId, models, config, definition));
```

Omitting `models` preserves existing entries.
Definitions retain spread metadata,
 including capabilities,
 thinking maps,
 limits,
 cache lifetimes,
compatibility flags,
 and cost tiers;
 headers are resolved separately
(`coding-agent/dist/core/provider-composer.js:135`,
 `:311`).
Preserving base entries requires carrying the complete existing catalog,
 not aliases alone.

A suffixed physical entry is not a Pi virtual model.
`registerVirtualModel` adds a separate selectable entry without replacing physical models.
Its route type has no request-options channel (`coding-agent/dist/core/virtual-models.d.ts:60`):

```ts
// coding-agent/dist/core/virtual-models.d.ts:61
model: Model<Api>;
thinkingLevel: ModelThinkingLevel;
```

`state?: TState` is the other return field.
Routing canonicalizes the target,
 discarding changes to a cloned model
(`coding-agent/dist/core/model-runtime.js:744`,
 `:750`):

```js
// coding-agent/dist/core/model-runtime.js:744
const target = this.getPhysicalModel(route.model.provider, route.model.id);
```

Native Codex streaming uses `model.id` for both request and assistant identity
(`ai/dist/api/openai-codex-responses.js:152`,
 `:390`).
Passing the base model before native conversion preserves its replay identity;
rewriting only the payload does not change assistant identity.
Replay signatures compare provider,
 API,
 and model ID
(`ai/dist/api/transform-messages.js:68`).

## Priority and delegation

Both full-stream option types expose
`serviceTier?: ResponseCreateParamsStreaming["service_tier"]`
(`ai/dist/api/openai-codex-responses.d.ts:6`,
 `openai-responses.d.ts:6`).
Both native `streamSimple` adapters rebuild options through `buildBaseOptions`,
which drops top-level `serviceTier` but preserves `onPayload`
(`ai/dist/api/simple-options.js:10`,
 `:23`;
 Codex `:354`,
 OpenAI Responses `:177`).
Therefore delegating `streamSimple(..., { serviceTier: "priority" })` alone does not request priority.
Native wrapping is structurally supported through base-model identity translation and the retained payload hook;
it does not require copying the Codex transport implementation.

Full streams map the option to `service_tier`;
 Codex invokes its payload hook before either transport
(`ai/dist/api/openai-codex-responses.js:174`,
 `:404`):

```js
// ai/dist/api/openai-codex-responses.js:174
const nextBody = await options?.onPayload?.(body, model);
```

The hook can replace payloads;
 replacement must not discard existing hook results.
Legacy custom `streamSimple` handles both simple and full registry calls for its configured API
(`coding-agent/dist/core/provider-composer.js:360`).
`before_provider_request` exposes only `payload`,
 not dispatched model identity
(`coding-agent/dist/core/extensions/types.d.ts:665`).
Handlers compose sequentially;
 exceptions are reported and processing continues
(`extensions/runner.js:1060`).
SDK instrumentation is attached to agent requests,
 not automatically every extension registry call
(`coding-agent/dist/core/sdk.js:213`,
 `:262`).

## OAuth and transport preservation

Same-provider legacy overlays inherit built-in OAuth unless explicitly replaced
(`coding-agent/dist/core/provider-composer.js:296`):

```js
// coding-agent/dist/core/provider-composer.js:296
const oauth = extension?.oauth ? adaptOAuth(extension.oauth) : base?.auth.oauth;
```

Stored credentials are keyed by provider ID
(`ai/dist/auth/resolve.js:24`):

```js
// ai/dist/auth/resolve.js:24
const stored = await readCredential(credentials, provider.id, signal);
```

Copying OAuth callbacks to another physical provider does not reuse the existing login.
Stored credentials prevent silent environment fallback (`ai/dist/auth/resolve.js:25`).
A virtual entry under another provider can still route to the original authenticated physical model.
Request-time auth refresh uses serialized credential modification before deriving access auth
(`auth/resolve.js:53`,
 `:61`,
 `:94`).
`ctx.modelRegistry.streamSimple` resolves authentication;
 calling an API adapter directly requires passing it
(`coding-agent/dist/core/model-runtime.js:447`;
 Codex `:355`).

Codex uses `chatgpt.com/backend-api`,
 JWT account extraction,
 and account/session headers;
OpenAI Responses uses `api.openai.com/v1` and HTTP/SSE,
 with a separate ChatGPT OAuth flow
(`ai/dist/providers/openai-codex.js:10`,
 `openai.js:10`;
 Codex `:169`,
 `:1281`;
 Responses `:133`).
They are not interchangeable transports.

Delegation must retain transport,
 session ID,
 cache retention,
 cancellation,
 timeouts,
 retries,
headers,
 environment,
 and instrumentation (`ai/dist/api/simple-options.js:10`).
Codex `auto` tries cached WebSocket continuation;
 transport failures before content starts can fall back to SSE.
Failures after start do not replay through SSE (`Codex :184`,
 `:227`,
 `:240`,
 `:1175`).
Connections are session/account keyed;
 continuation requires matching non-input fields and transcript prefix
(`:867`,
 `:1124`).
`cacheRetention: "none"` removes session reuse;
 custom `fetch` does not control WebSockets
(`:171`;
 `ai/dist/types.d.ts:62`).

## Listing, updates, costs, and verification gaps

Factory registrations precede startup scope resolution and `--list-models`
(`coding-agent/dist/core/agent-session-services.js:72`,
 `:98`,
 `:111`;
 `coding-agent/dist/main.js:651`,
 `:710`).
Legacy re-registration merges defined fields;
 native registration replaces its provider.
Virtual re-registration replaces that provider/ID;
 unregistering a provider does not remove virtual entries
(`coding-agent/dist/core/model-runtime.js:626`,
 `:656`,
 `:675`,
 `:687`).

`/model` starts scoped when scopes exist,
 but its scope toggle exposes all authenticated models
(`coding-agent/dist/modes/interactive/components/model-selector.js:52`,
 `:119`,
 `:302`).
Aliases need not join `enabledModels` to be available there or in `--list-models`.
Exact scopes do not automatically include suffixed companions (`coding-agent/dist/core/model-resolver.js:76`,
 `:106`).

Pi calculates base catalog costs,
 then applies tier multipliers:
 priority is `2`,
 except `gpt-5.5` at `2.5`.
Codex can treat returned `default` as requested priority for pricing
(`ai/dist/api/openai-responses-shared.js:454`;
 Codex `:432`,
 `:453`).
Payload-only tier injection does not update the options-based pricing fallback.
Raw `provider_stream_event.data.response.service_tier` remains observable before normalization;
`AssistantMessage` has no normalized tier field (`ai/dist/api/openai-responses-shared.js:478`;
 `ai/dist/types.d.ts:372`).
Cost estimates do not establish billing or served tier.

Repo provider precedents inspected are disposable fixtures:
`package/pi-plugin/advisor/src/verify-host-fixture.ts:211` uses native registration;
`package/pi-plugin/goal/src/pi-runtime-verifier-provider.ts:450` uses legacy registration.

No live requests,
 transport probes,
 auth refreshes,
 or candidate implementation were tested.
Backend priority acceptance,
 entitlement,
 latency,
 actual charges,
 and incumbent-hook interaction remain unverified.
Catalog-refresh alias synchronization and actual startup/reload behavior require candidate verification.
