# Repackage pi search fetch as an MCP server

Status: design grilling in progress.
This records the interview state, measured evidence, and the open frontier.
Nothing is implemented yet.

## Goal

The user asked to repackage the pi search fetch plugin (`package/pi-plugin/search-fetch`) as an MCP server too,
and to grill the plan before any code moves.

## Settled decisions

- Q1: additive MCP surface aimed at non-pi MCP hosts; the pi extension stays the pi-native path.
- Q2: extract a pi-free core package; both the pi extension and the MCP server become thin adapters.
- Q4: full behavioral parity for `web_search` and `web_fetch`, blocklist included and non-negotiable.
- Q5: keep the tool names `web_search` and `web_fetch`, plus a documented one-surface-per-host rule.
- Q3: valibot single source in core, guarded valibot to TypeBox transform for the pi adapter;
  `@monochromatic-dev/mcp-stdio` stays unchanged.
- Q10: the transform is a dependency-free in-repo subset converter with a fail-loud guard
  and verdict-agreement tests; no third-party converter is adopted.

Recorded without asking (policy or sibling precedent), each open for veto:

- `package/mcp/search-fetch` named `@monochromatic-dev/mcp-search-fetch`, bin `search-fetch-mcp`,
  `#!/usr/bin/env node` first line, `private: true`, `LGPL-3.0-or-later` with `LICENSES/`.
- stdio transport only, on `@monochromatic-dev/mcp-stdio`; logs to stderr through tagged `module-logger` loggers.
- `mise.toml` tasks mirroring siblings, tests covering every exported path, package `README.md`.
- Workspace imports through the `/ts` subpath.
- Tool specs (name, description, behavior bullets, schemas) declared once in core;
  pi-only `label` and `promptSnippet` stay in the pi adapter, MCP `instructions` in the MCP adapter.
- The pi plugin slims to a thin adapter; only `package/config/pnpr/config.yaml` references it from outside.
- Schema strictness is behavior: the shared schema must stay an open object so `collectIgnoredKeys`
  keeps warning on ignored `web_fetch` knobs instead of the host rejecting them.

## Open frontier

- Q6: core package home (`package/module/search-fetch` recommended).
- Q7: truncation ownership (import pi's `truncateHead`, `formatSize`, `withFileMutationQueue` as
  pure utilities recommended).
- Q8: truncation delivery to MCP hosts (keep the temp path, document the file-read requirement recommended).
- Q9: registration and verification targets (README snippets plus live verification against one real host recommended).

## Evidence

### Pi tool contract

- `ToolDefinition<TParams extends TSchema ...>` types `parameters` as TypeBox
  (`node_modules/.pnpm/@earendil-works+pi-coding-agent@1.0.2_supports-color@10.2.2/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:439`).
- The pi example tool declares `parameters: Type.Object({...})`
  (`.../examples/extensions/hello.ts:7`).
- Pi compiles and validates tool arguments with TypeBox before coercion (`CHANGELOG.md:819`, `CHANGELOG.md:902`);
  nested tool calls go through the same argument validation (`docs/extensions.md:148`).
- Consequence: handing pi plain JSON Schema is rejected.
  Auto-transforming valibot into real TypeBox builder output is a different mechanism and is untested by that rejection.

### Valibot to TypeBox transform probe

Probe: `/var/home/user/temp/agent/search-fetch-schema-probe/probe.mjs`, output `out.txt`, run 2026-10-02.
It mirrors both tool parameter schemas in valibot and transforms them with `@sinclair/typemap` `TypeBoxFromValibot`.

- Transformed schemas compile under `typebox@1.3.34`, the TypeBox generation pi validates with.
- Verdicts agree with valibot on every case probed: valid input passes, missing required fails,
  wrong type fails, unknown key passes on `v.object`, single string for an array fails.
- Descriptions survive the transform, so model-facing text is intact.
- `v.strictObject` maps to `additionalProperties: false`, `v.object` maps to an open object.
  The valibot source must therefore use `v.object` to preserve today's ignored-key warning behavior.
- Untranslatable constructs degrade silently instead of throwing.
  `v.custom` and `v.variant` produced invalid JSON Schema carrying embedded valibot internals.
  Any transform needs a fail-loud guard, and `typebox/guard` exists for that.

### Library candidates (named at discovery, none vetted or recommended)

- `@sinclair/typemap@0.10.1`: MIT, peer `@sinclair/typebox@^0.34` while this workspace uses `typebox@1.3.x`;
  npm reports the package deprecated (install warning), a likely hard-gate failure.
- `@traversable/valibot@0.0.26` and `@traversable/typebox@0.0.31`: MIT, pre-1.0, not yet vetted.
- In-repo subset converter: no dependency, covers exactly the constructs we use (object, string,
  array, optional, pipe description), throws on anything else.

## Rejected ideas

- Declare once in valibot, convert to plain JSON Schema, hand it to pi behind a cast.
  Rejected on evidence: pi's compiled TypeBox validation needs Kind-bearing schemas
  (`CHANGELOG.md:819`, `CHANGELOG.md:902`), so the cast would hide a runtime break.
- One package carrying both `pi.extensions` and `bin` (round 1 Q2 option C).
  Rejected: one manifest cannot cleanly answer two hosts' packaging conventions.

## Detour: ask_user_question copy

The user noted the `ask_user_question` tool read as one question per call.
Fixed as a copy-only change (`f863b7805`): the parameter and tool descriptions now state that one call carries
one free-form string holding any number of questions, and the user answers them together in one multiline answer.
No schema or implementation change.

## Next action

Waiting on user answers for Q6, Q7, Q8, Q9, re-asked in one `ask_user_question` call.
After the frontier empties, restate the shared understanding and wait for confirmation before implementing.
