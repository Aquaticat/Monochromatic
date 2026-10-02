# pi-plugin-model-retirement

Pi extension that retires superseded models from the live catalog.

At every session start it reads pi's model registry, decides which entries a newer
sibling in the same family supersedes, and re-registers the affected providers without
those entries.
The model picker then stops offering them and `ModelRegistry.find` stops resolving them.

Design, measurements, and every rejected alternative:
[`doc/planning/pi-model-retirement.md`](../../../doc/planning/pi-model-retirement.md).

## What it does

- Reads chat models through `ModelRegistry.getAll()` and image and classifier models
  through `getModelsOfType`, because `getAll()` reports chat models only.
- Groups entries into families by provider, API, and name shape, then keeps the newest
  member of each family and retires the rest.
- Re-registers a provider only when it loses at least one model, carrying every kept
  model of all three types plus all of its metadata: `contextWindow`, `maxTokens`,
  `reasoning`, `thinkingLevelMap`, `promptCache`, `compat`, `samplingParams`, and
  `inputLimits`.
- Spreads the incumbent configuration of a provider another extension registered, so its
  `api`, `baseUrl`, `apiKey`, `headers`, `oauth`, and `streamSimple` survive the pass.
- Logs one summary line per session, one debug line per retirement, and one warning per
  provider it could not filter.
- Warns when the session started on a model this pass retired, naming the successor.

## What it does not do

- It does not touch pi settings. Neither `enabledModels` nor `defaultModel` is read or
  written.
- It does not switch the session's model. A session that started on a retired model
  keeps running on it, and the warning is the only signal.
- It does not change `pi --list-models`. That command fires no extension event, so it
  lists the unfiltered catalog. The shrunk picker is the visible effect.
- It offers no override. There is no allowlist, no environment variable, and no runtime
  escape hatch. Restoring a retired model means editing this package or removing it from
  your settings.
- It does not remove whole providers. `unregisterProvider` is never called.

## Retirement rule

An id is split into tokens on every character that is not a digit, a lower-case letter,
or a dot. A token is version evidence only when its digits run to the end, optionally
behind a `v` and optionally behind an alphabetic prefix:

- `5.2`, `v4`, and `0813` are version tokens.
- `qwen3.8` splits into the word `qwen` and the version `3.8`, so `qwen3.7-flash` and
  `qwen3.8-flash` are one family and the older one retires.
- `70b`, `a12b`, `2.4t`, and `4o` stay single words, so parameter sizes and glued names
  never order two models against each other.

Everything that is not a version token joins the family's name shape, which is why
tiers stay separate: `glm-5.3-flash` is never retired by `glm-5.3`.

Inside a family, version vectors are compared component by component. Three extra rules
handle the shapes that plain numeric comparison gets wrong:

1. Components whose raw digit lengths differ by two or more belong to different
   numbering schemes, so the pair is left unordered. That keeps `qwen3.5-plus-02-15`
   alive beside `qwen3.5-plus-20260420`.
2. When one vector continues the other, all-date extras mean a pinned snapshot, which
   loses to the rolling alias, and all-version extras mean a point release, which beats
   its own base version. That retires `deepseek-v4-pro-0813` in favor of
   `deepseek-v4-pro`, and retires `claude-opus-5` in favor of `claude-opus-5-5`.
3. A mix of date and version extras is left unordered.

An entry with no version token at all is never retired, which protects rolling aliases
and routing targets such as `openai/gpt-4o`, `auto`, and `syn:large:text`.

Anything the rule cannot order, it leaves alone. Abstention is deliberate: with no
runtime override, a wrong retirement is only fixable by rebuilding, while a missed one
costs a single row in the picker.

Measured over pi-ai's bundled catalog of 1604 entries: 551 retirements, 29 abstentions,
and no retirement whose keeper is not strictly newer.

## Providers it cannot filter

Two rules keep the pass from breaking providers it does not own.

A provider another extension registered as a native object is skipped. Pi lists those
providers in `getRegisteredProviderIds()` but returns no configuration for them, so
re-registering one would replace its streaming, auth, and image handlers with a plain
catalog list.

A provider whose models cannot all be re-declared is skipped. Pi throws when a model
definition resolves neither an `api` nor a `baseUrl`, counting the provider-level values
as fallbacks, and one throw would abort the whole pass, so every plan is validated first.

Measured in the real host: 597 retirements applied across 35 providers, with 4 skipped.
`azure-openai-responses` was skipped because all 44 of its chat models carry an empty
`baseUrl`, and `hyper`, `openai-codex-fast`, and `openai-fast` were skipped as native
registrations.
The same run left `radius` with its `streamSimple` handler and `synthetic` with its
credentials, which is what the incumbent-configuration rule buys.

Per-model `headers` do not survive re-registration: pi's `extensionModelFromDefinition`
sets them to `undefined` for all three model types. In the bundled catalog only
`github-copilot` (34 models) and `nvidia` (19) carry per-model headers, and neither is
in the live set on this machine.

## Logging

Every record is tagged `pi-model-retirement`, then re-tagged with the handler name.

- `info`: one summary line per pass, for example
  `retired 515 models across 33 providers; declined keeperAmbiguity=14 unorderedPair=15 versionlessProtected=6`.
- `debug`: one line per retirement, for example
  `retired hyper/glm-5.2 in favor of glm-5.3`.
- `warn`: one line per skipped or refused provider, and one line when the session is
  running on a retired model.

There is no audit task. The session log and the pinned characterization fixture are the
only two surfaces for the retirement table.

## Installation

Installed into global pi settings on 2026-10-02: the `packages` array went from 17 entries
to 18, the new entry was appended last, no existing entry was removed, and no other setting
changed.

Build the package, then install it by its repository path:

```bash
mise run //package/pi-plugin/model-retirement:build
pi install /var/home/user/Monochromatic/package/pi-plugin/model-retirement
```

Global settings only. Do not add it to a project `.pi/settings.json`, and do not pass
`--local`.

Pi records a local path relative to your home directory, so the stored entry reads
`../../../../var/home/user/Monochromatic/package/pi-plugin/model-retirement`. That is
normal and resolves correctly; `openai-fast` is stored the same way. Removal accepts the
absolute path even though the stored entry is relative:

```bash
pi remove /var/home/user/Monochromatic/package/pi-plugin/model-retirement
```

Install it last in the `packages` array. By `session_start` every provider package has
already registered, so ordering only matters against an extension that registers
providers from a later event handler.

If you script the install, snapshot `~/.pi/agent/settings.json` before and after and fail
on any change outside the `packages` array, the way
`package/pi-plugin/openai-fast/mise.toml` guards its `install:global` task.

## Installed behavior, measured

One pass in the real host after installation: chat models 1677 to 1109, 597 retirements
across 35 providers, 4 providers skipped with a warning each, image 57 and classifier 15
unchanged, `radius` keeping its `streamSimple` handler, `synthetic` keeping its
credentials, and no `extension_error` record from pi.

## Tasks

- `build`, `build:js`, `build:js:node`, `watch:build`, `watch:build:js`,
  `watch:build:js:node`: rolldown builds.
- `lint`, `lint:types`, `lint:oxlint`, `format:oxlint`: checks and formatting.
- `test:unit`: unit and characterization tests, which depend on `build` because they
  import the shipped bundle.
- `verify:extension`: boots the built artifact against a fake host and asserts the
  registration contract.
- `verify:host`: boots a real disposable pi host and asserts what filtering did to a
  live catalog. Gated by `PI_MODEL_RETIREMENT_VERIFY_HOST=1`, which the task sets.
- `fixture:retirement-table`: regenerates the pinned retirement table from the
  installed pi-ai catalog.

## Verification

`verify:host` runs pi in RPC mode inside a throwaway home whose only content is a
`models.json` carrying one context-window override, with no credentials and no other
extension loaded. A probe extension loads before the built one and snapshots the
registry at `session_start`, before filtering, and at `resources_discover`, after it.
The run asserts that the chat catalog shrank, that a retired id disappeared, that the
family winner survived, that the `models.json` override still reports 750000 rather
than the bundled 272000, that thinking levels survived, and that image and classifier
counts did not move.
The same probe, run against the real agent directory, is what reported the incumbent
configuration key counts before and after filtering.

`retirement-table.characterization.unit.test.ts` pins the full retirement table over
the bundled catalog. A pi upgrade that changes any single retirement fails that test
until the diff is reviewed and the fixture is regenerated with
`mise run //package/pi-plugin/model-retirement:fixture:retirement-table`.

## Limits

- Pi's extension API carries no stability guarantee, and its changelog records 59
  breaking changes. The characterization suite and both verification tasks exist to
  catch that early.
- A catalog refresh during a session can reintroduce retired models. Pi fetches a remote
  overlay every four hours and exposes no model-changed event, so the filter reapplies
  at the next session start.
- Filtering happens after pi chooses the startup model, so a session can begin on a
  retired model. Today's configured default survives the rule; the exposure begins when
  a default drifts onto a retired id.
