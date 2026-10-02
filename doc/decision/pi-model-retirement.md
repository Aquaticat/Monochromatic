# Retire superseded pi models by re-registering providers at session start

## Context

Pi 1.0.0 gives an extension no way to hide or refuse a model.
`enabledModels` sets the picker's default view only, and one Tab keystroke shows the full
catalog again (`dist/modes/interactive/components/model-selector.js:39,52,119,201-219`).
`model_select` has no result channel, and `AgentSession.setModel` assigns the new model
before emitting (`dist/core/extensions/types.d.ts:1179`,
`dist/core/agent-session.js:1910-1926`).
Extensions cannot write settings, because `pi.getSettings()` returns a clone
(`dist/core/settings-manager.js:305-307`).

The catalog carries no age metadata either: 1604 bundled entries across 42 providers, with
no per-model release date, deprecation flag, or version field
(`pi-ai/dist/types.d.ts:900-912`).
On this machine the live list held 525 rows across 10 providers, and the hand-maintained
`enabledModels` allow-list had already drifted twice.

Two goals were settled before design: shrink the picker, and stop a superseded model being
chosen on a path nobody watches.
Evidence, measurements, and rejected options are in
`doc/planning/pi-model-retirement.md`; the pi behavior itself is traced in
`doc/troubleshooting/pi-extension-model-catalog.md`.

## Decision

One package, `package/pi-plugin/model-retirement`, filters the catalog at `session_start`,
the earliest point an extension can read it, by re-registering each affected provider with
the models it keeps.

Registration carries every kept model of all three types, because `ModelRegistry.getAll()`
reports chat models only, and it spreads the incumbent configuration underneath, so a
provider another extension registered keeps its `api`, `baseUrl`, `apiKey`, `headers`,
`oauth`, and `streamSimple`.

Retirement is decided from model ids alone.
A family is one provider, one API, and one name shape, where the name shape is every
non-version token in id order.
A token counts as version evidence only when its digits run to the end, optionally behind a
`v` or an alphabetic prefix, so `qwen3.8` splits into `qwen` and `3.8` while `70b`, `a12b`,
and `4o` stay words.
Ordering compares version components, then applies three tie rules: components whose raw
digit lengths differ by two or more are incommensurable, all-date extras mark a pinned
snapshot that loses to its rolling alias, and all-version extras mark a point release that
beats its base version.
Anything the id text cannot order is left alone, and an entry with no version token is never
retired.

The package writes no pi settings, offers no runtime override, applies no context-window
guard, and logs every retirement plus one warning per provider it cannot filter.

A provider is skipped, with a warning, when pi lists it as extension-registered but returns
no configuration for it, or when any of its models resolves neither an `api` nor a
`baseUrl` counting provider-level fallbacks.
Each registration is isolated, so one failure cannot abort the pass.

## Alternatives

Generate `enabledModels` from policy and let pi's native scope hide models.
Rejected: the native scope does not hide, as the `model-selector.js` trace shows.

Veto selection through an event result.
Rejected: no such contract exists in pi 1.0.0.

`unregisterProvider` for providers nobody selects from.
Rejected by the scope decision, which limited the work to within-family supersession.
It remains the cheapest clutter lever if that decision is revisited: removing `openrouter`
alone would drop 399 rows, and no installed package references it.

Virtual-model `route()` throw as the block.
Rejected: it fires only for ids the extension registers as virtual.

Age-based retirement.
Rejected: no per-model date exists in the catalog.

Ordering via `compareVersions` in `@monochromatic-dev/pi-shared-model-selection`.
Rejected on measurement: its documented alias-wins tiebreak retired `radius/claude-opus-5-5`
in favor of `radius/claude-opus-5`, inverting three point releases on a provider in daily
use.
That helper also treats 4-digit snapshots as versions, takes only the first digit run of a
token, and discards leading zeros.

A curated `keep` list for known false positives.
Rejected in favor of abstention, which needs no curation and errs toward keeping models.

Filtering in the extension factory.
Rejected as impossible: the factory argument exposes no catalog read at all.

## Consequences

Measured in the real host after installation: chat models 1677 to 1109, 597 retirements
across 35 providers, image 57 and classifier 15 unchanged, `openai-codex/gpt-6-luna`
keeping its overridden 750000 context window in the disposable host, `radius` keeping
`streamSimple`, `synthetic` keeping its credentials, and no `extension_error` record.

`models.json` overrides cannot be lost by re-registration, because pi applies them after
extension model replacement (`dist/core/provider-composer.js:337-353`).

Accepted costs:

- `pi --list-models` fires no extension event, so it keeps printing the unfiltered catalog.
- Startup model resolution precedes the filter, so a session can start on a retired model
  and keeps running on it; the pass warns and does not switch.
- Four providers are unfilterable today: `azure-openai-responses` for a missing `baseUrl`,
  and `hyper`, `openai-fast`, and `openai-codex-fast` as native registrations pi will not
  describe.
- Per-model `headers` are dropped by `extensionModelFromDefinition`, which affects
  `github-copilot` and `nvidia` in the bundled catalog and neither in the live set.
- A catalog refresh mid-session can reintroduce retired models, since pi exposes no
  model-changed event; the filter reapplies at the next session start.
- With no override, a wrong retirement is recoverable only by rebuilding or removing the
  package.

Regression protection: a characterization test pins the full 551-row retirement table over
the bundled catalog, so a pi upgrade that changes any retirement fails until the diff is
reviewed and the fixture is regenerated with
`mise run //package/pi-plugin/model-retirement:fixture:retirement-table`.
Pi's extension API carries no stability guarantee and its changelog records 59 breaking
changes, so that fixture and the two verification tasks are the early-warning system.

Still open, recorded in `doc/planning/pi-model-retirement.md`: whether skip warnings should
stay at warn for every session, whether `radius` belongs in scope given it serves advisor
and MCP rather than interactive picks, whether `hyper`'s owner should register a
configuration pi can return, and whether the fixture should also record the pi and pi-ai
versions it was generated against.
