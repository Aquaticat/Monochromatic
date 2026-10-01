# pi-plugin-openai-fast

Genuine pi virtual models that request priority through the existing Codex login.
The implementation is being verified against pi `0.99.2`.

## Model selection

Each registered base Codex model gets a selectable virtual companion:

- Ordinary:
   `openai-codex/<model-id>`.
- Priority request:
   `openai-codex-fast/<model-id>`.

Companions are discovered from pi's configured native Codex catalog,
 not a manually maintained compatibility list.
Selecting an unsupported model in fast mode surfaces the provider error.
The extension does not silently change the model or retry with an ordinary tier.
Normal native transient retries and transport recovery remain pi behavior.

The original upstream model ID is sent with `service_tier: "priority"`.
No invented `-fast` upstream model ID is sent.
Assistant history retains the original Codex model identity;
 pi keeps the virtual selection separately.

Defaults and `enabledModels` are not changed.
Fast companions do not enter exact ordinary-model scopes.
Existing wildcards that already match the fast namespace can include them.
There are no added commands,
 footer widgets,
 badges,
 or selection notifications.
Pi's standard virtual-model presentation remains host behavior.

## Authentication and transport

Reuse the native `openai-codex` login.
There is no separate login or copied credential store for fast models.
Public OpenAI API-key inference is outside this package's scope.

The native provider still owns OAuth refresh,
 logout,
 ordinary model dispatch,
 and transport behavior.
Priority requests use the native Codex stream implementation,
 preserving reasoning,
 tools,
 callback replacement payloads,
 cache/session settings,
 abort signals,
 retries,
 timeouts,
 headers,
 and request instrumentation.

Priority targets are local physical entries under the fast adapter provider,
 excluded from normal filtered availability lists.
Their IDs start with `__pi_openai_fast__/` and are never sent upstream.
Do not use that reserved prefix for configured Codex models.
The complete registry and pi's own routing display can still expose physical target identities.

## Backend contract

The guarantee is **requesting priority**,
 not guaranteed acceleration or confirmed priority execution.
Backend support,
 entitlement,
 rollout,
 and actual quota consumption can differ from request intent.
[OpenAI documents increased usage consumption for Fast][codex-speed].
No compatibility list or served-tier reporting UI is maintained here.

## Installation

Build and verify the package before adding its repository path to global pi packages.
Remove `npm:pi-openai-codex-fast` before loading this replacement:
its physical model IDs conflict with the new virtual entries using the same companion identities.

Keep installation in global `~/.pi/agent/settings.json`,
 not this repository's intentionally package-free project settings.
The package manifest loads `dist/final/node/index.mjs`.

## Development verification

From the repository root:

```sh
# Repository root
mise run //package/pi-plugin/openai-fast:build:js:node
mise run //package/pi-plugin/openai-fast:lint:types
mise run //package/pi-plugin/openai-fast:lint:oxlint
mise run //package/pi-plugin/openai-fast:test:unit
mise run //package/pi-plugin/openai-fast:verify:extension
```

Tests use built artifacts,
 synthetic provider responses,
 and disposable state.
A native payload-construction check alone does not establish backend acceleration.
Live validation must use isolated pi settings and synthetic prompts,
 never real project files or shared session state.

## Source boundaries

- `catalog.ts` restores configured and cached native metadata using empty read-only credentials and no network.
- `virtual-registration.ts` derives native virtual definitions and synchronizes catalog changes.
- `priority-provider.ts` creates keyless targets while leaving the original native provider untouched.
- `priority-stream.ts` reuses native option conversion and full streaming.
- `priority-payload.ts` composes payload callbacks while preserving the priority request.
- `original-dispatch.ts` owns the live registry binding and resolves original-model authentication and headers.
- `index.ts` registers the adapter and virtual entries without another request-mode switch.

Small named helpers are exported so artifact tests can exercise these boundaries.
The default export is the pi extension factory.

Design and evidence:
[accepted plan](../../../doc/planning/pi-openai-fast.md)
and [verified pi integration constraints](../../../doc/troubleshooting/pi-virtual-priority-options.md).

[codex-speed]: https://developers.openai.com/codex/agent-configuration/speed
