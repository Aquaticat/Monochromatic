# dsh-plugin-neuralwatt

NeuralWatt provider for DSH: the plugin owns the `neuralwatt` provider route
over the shipped `@deepseek-ai/dsh-llm-pi-ai` adapter, with the model list
fetched live from the NeuralWatt API at activation. Each fetched model carries
its accurate context window and its selectable thinking levels, and a
checked-in snapshot of the same listing serves while the API is unreachable.

## How it serves

Activation is one synchronous registration plus one bounded async fetch:

1. The checked-in snapshot maps to a provider dict immediately and hands it to
   the shipped adapter's `apply` through a stable `get()` reference.
2. `apply` registers the `neuralwatt` route and its adapter exactly once, so
   the default model keeps streaming without waiting on the network.
3. The mount fetch reads the public listing endpoint
   `[the NeuralWatt listing endpoint][neuralwatt-listing]` within a fixed time
   bound, maps it, and swaps the reference's current value in place.
4. A fetch failure, a non-listing body, or a listing mapping to no serviceable
   model logs the reason and keeps the served mapping, so an unreachable
   endpoint never takes the route down.

## Model mapping

Each listing entry maps to one pi-ai model profile:

- Entries the listing marks deprecated, or without an id, are skipped rather
  than served with wrong facts.
- `name` comes from `metadata.display_name`, falling back to the id.
- `contextWindow` comes from `metadata.limits.max_context_length`, then the
  entry's `max_model_len`; both absent leaves the field unset.
- `maxTokens` comes from `metadata.limits.max_output_tokens`; a null value
  leaves the field unset instead of guessing.
- `input` is `['text']`, or `['text', 'image']` when `capabilities.vision` is
  true.
- `reasoningEfforts` is `false` for a model `capabilities.reasoning` marks
  non-reasoning. Otherwise the keys are the thinking levels the listing's
  `metadata.reasoning.supported_efforts` spellings map to, each level sending
  its own spelling as its wire value. The spelling `none` maps to the `off`
  level and sends `reasoning_effort: "none"` when thinking is off. A model
  whose efforts include no level beyond `off` also declares `false`, since
  nothing is selectable.
- `metadata.reasoning.accepted_efforts` serves as the effort source only when
  `supported_efforts` is missing, minus the spellings
  `metadata.reasoning.effort_aliases` marks as aliases of another effort.
- An effort spelling this mapping cannot express is skipped instead of
  guessed, so a listing it does not know yet degrades to fewer offered levels.

## Thinking level dispatch

The route pins `compat.supportsReasoningEffort` so a selected thinking level
dispatches as the documented top-level `reasoning_effort` parameter. Without
the pin, pi-ai's URL-based detection for `https://api.neuralwatt.com/v1/`
finds no known effort format and silently drops reasoning from requests.

Declaring the `off` level is a behavior change for models whose server default
is thinking on: `mimo-v2.6-pro` previously received no reasoning parameter
when thinking was off and ran its server default at `high`, and now receives
`reasoning_effort: "none"` explicitly.

## Deliberately omitted scope

The listing's `metadata.pricing` block exists but is never read. This provider
serves models and their capabilities; it does not estimate cost, price
requests, or meter energy. Request-level token accounting stays the harness's
concern.

## Wiring

The bundle is `@monochromatic-dev/dsh-plugin-neuralwatt`, installed through
`plugin_manager` `install_bundle` like any workspace bundle. The `neuralwatt`
route has exactly one owner, so a profile `cordis.patch.yml` that still
declares a hand-written `neuralwatt` block under `llm-pi-ai` `providers` must
drop that block; the plugin's route replaces it. Credentials resolve the
`NEURALWATT_API_KEY` environment name exactly as the hand-written block did.

```ts
// package/dsh-plugin/neuralwatt/src/constants.ts
export const NEURALWATT_API_KEY_ENV = 'NEURALWATT_API_KEY';
```

`src/constants.ts` names the route key, wire protocol, endpoint base, listing
endpoint, credential reference, and the listing fetch bound in milliseconds.

## Tasks

```sh
# package/dsh-plugin/neuralwatt
mise run build
mise run lint:types
mise run test:unit
```

Unit tests import package behavior from the built `dist` entry, so run `build`
before `test:unit` after source changes.

[neuralwatt-listing]: https://api.neuralwatt.com/v1/models
