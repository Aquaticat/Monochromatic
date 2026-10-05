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
- Q6: core lives at `package/agent-harness-shared/search-fetch`,
  named `@monochromatic-dev/agent-harness-shared-search-fetch`.
- Q7: truncation is ported into a neutral module and proven identical to pi's helpers by behavior tests;
  core imports nothing from pi.
- Q8: truncated head plus temp path stay, and the full response is additionally delivered as an MCP resource.
  New evidence (OpenCodeReview ignores resources) reopens the delivery mechanism as Q11.
- Q9: README snippets cover generic stdio and open-codereview.ai only;
  live verification runs against OpenCodeReview (`ocr` on PATH), configured by the agent.

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

- Q11: MCP resource delivery mechanism, given OpenCodeReview renders non-text content as
  `[unsupported content type: ...]`. Options: dynamic resource via `resources/list` and `resources/read`
  with the URI in the text output, inline `resource_link`, or reverting to temp path only.
- Q12: where the ported truncation module lives: inside the core package or its own `package/module/...` package.
- Q13: proposed `AGENTS.md` `RGT` tightening after the rg misuse incident (see Evidence hygiene).

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

### OpenCodeReview MCP integration

Source of truth: `open-code-review` repo, `pages/src/content/docs/en/mcp.md`, `pages/src/content/docs/en/tools.md`,
`internal/mcp/client.go` (cloned at `/home/user/temp/agent/open-code-review-ocr-routing-20260823`).

- OCR is an MCP client over stdio using `github.com/modelcontextprotocol/go-sdk v1.6.1` (`go.mod:12`).
- Servers are configured under `mcp_servers.<name>` in `~/.opencodereview/config.json`, writable via
  `ocr config set mcp_servers.<name>.command|args|tools|setup|env`; `tools` is an optional allowlist.
- Tool names share a namespace with built-ins (`task_done`, `code_comment`, `file_read`, `file_read_diff`,
  `file_find`, `code_search`). `web_search` and `web_fetch` collide with none of them.
- `CallTool` returns text only (`internal/mcp/client.go:157`); `contentToText` keeps `*mcp.TextContent` and renders
  every other content type as `[unsupported content type: %T]` (`internal/mcp/client.go:177`).
  Repo-wide `resource` hits are OpenTelemetry and CSP only, so OCR never follows MCP resources.
- Consequence: the Q8 resource is inert in the verification host, and inline resource content would add a
  placeholder line to its review context.

### Evidence hygiene

The user corrected a wrong claim: I reported a nonexistent bash output filter rewriting terms to `ln`.
Cause was my own `rg -rln` / `rg -rn` misuse (`-r` is `--replace`), the failure mode `AGENTS.md` `RGT` warns about.
Re-verified after the correction: `docs/extensions.md:76` says `pi.registerTool()`, not `pi.ln()`;
the OCR README link is `docs/mcp`; and no conclusion in this document rests on replaced output.

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

Waiting on user answers for Q11, Q12, Q13, asked in one `ask_user_question` call.
After the frontier empties, restate the shared understanding and wait for confirmation before implementing.
