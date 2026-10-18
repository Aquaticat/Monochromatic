# @monochromatic-dev/dsh-plugin-search-fetch

A configuration-only DeepSeek Harness bundle that connects
`@monochromatic-dev/mcp-search-fetch` to a dsh profile over stdio.

## Why

dsh ships exactly one web search provider,
`@deepseek-ai/dsh-web-search-deepseek`,
and the shared base wires it as the only `ctx.web` search backend:
`searchProvider: deepseek-official` in the `dsh-base` bundle patch,
with `apiKeyEnv: DEEPSEEK_API_KEY`.
A deployment without a DeepSeek account therefore has no working `web_search`
at all,
while `web_fetch` keeps working because `@deepseek-ai/dsh-web-fetch-http` is
anonymous public HTTP.

This bundle supplies search from the repo's own provider stack instead.
It does not add a second implementation of search behavior.
`@monochromatic-dev/mcp-search-fetch` already exists to serve
"every other MCP host with the identical behavior" as the pi extension,
and both surfaces delegate to
`@monochromatic-dev/agent-harness-shared-search-fetch`,
so Exa-first search with Linkup fallback,
`gh` CLI routing for mapped GitHub URLs,
the global host blocklist,
and base64 data-URL image stripping all keep one implementation.

dsh is such a host,
so the MCP surface is the intended integration point rather than a new native
`ctx.web` provider,
which would create a third surface.

## What it provides

Two model-facing tools,
namespaced by the `search-fetch` server name:

- `mcp__search-fetch__web_search` searches with Exa fast search first and
  Linkup standard fallback.
- `mcp__search-fetch__web_fetch` fetches one page,
  routing mapped GitHub URLs through the local `gh` CLI.

Truncated output carries the model-visible head plus a
`search-fetch://response/<id>` resource URI,
which a host reads with `resources/read`.

## Configuration

The bundle declares no plugin config.
The inserted row is `@deepseek-ai/dsh-mcp-client` with `transport: stdio`,
`serverName: search-fetch`,
and `failOnStartupError: true`,
so a server that cannot start surfaces as an activation diagnostic instead of
silently missing tools.

`command` is `!!js process.execPath`,
the host's own Node,
so the spawn does not depend on `PATH` resolution.
The single `args` entry resolves the built server entry point through this
bundle's own `package.json` with `createRequire(baseUrl)`,
then walks to `../../mcp/search-fetch/dist/final/node/index.mjs`.
That keeps the wiring relative to the checkout instead of hardcoding a
workspace location or a username.

## Credentials

No credential is copied into this bundle.
The server resolves its own config from
`$HOME/.pi/agent/extensions/pi-search-fetch.json`,
which holds the Exa API key and the host blocklist.
Home resolution is `options.home ?? process.env.HOME ?? homedir()` in
`package/agent-harness-shared/search-fetch/src/config.ts`.

`HOME` reaches the child because the harness subprocess scrub in
`@deepseek-ai/dsh-subprocess` drops only names matching
`KEY|PASSWORD|SECRET|TOKEN` and names beginning with `DSH_`,
and its own documentation states that `PATH`,
`HOME`,
locale,
and proxy variables survive.
`PATH` surviving is also what makes the `gh` CLI route work.

The same scrub is why the Linkup key cannot travel through the environment.
`agent-harness-shared/search-fetch` reads `LINKUP_API_KEY` from `process.env`
(`config-constants.ts:17`),
but that name matches the `KEY` pattern,
so it is dropped from the child environment even when the host has it.
An `export` in `~/.bashrc` is doubly unavailable,
because the harness process is not started from an interactive shell and so
never sources it.
Both keys therefore live in the config file instead,
under `exaApiKey` and `linkupApiKey`,
which are two of the three keys `CONFIG_KEYS` accepts.
The file is mode `0600` and is shared with the pi extension,
so one credential serves both harnesses.

`loadLinkupConfig()` runs once at startup,
before `serve()`,
so a key added while the server is already running is not picked up.
Respawn it by toggling the `include:search-fetch-mcp` row through
`plugin_manager`,
or restart the harness.

## Prerequisites

The server must be built,
because the row points at `dist/final/node/index.mjs`:

```sh
# from the repository root
mise run //package/mcp/search-fetch:build
```

## Install

Install through `plugin_manager` with `action: install_bundle` and this
directory as `target`.
Do not hand-write the profile's `package.json` or `cordis.patch.yml`;
`install_bundle` performs those steps.

Verify by calling `mcp__search-fetch__web_search` in a new session.
Existing sessions keep the plugin revision they started with,
so a freshly installed bundle is visible only to sessions created afterwards.

## Relationship to the native web tools

The `cordis` agent preset mounts `@deepseek-ai/dsh-tool-web`,
whose config carries independent `search` and `fetch` booleans.
With no DeepSeek account,
`search: false` drops the native `web_search` rather than leaving a tool that
can only fail,
and `fetch: true` keeps the native anonymous `web_fetch`.

That leaves two fetch tools with different policies:
the native one accepts any public HTTP(S) destination,
while this bundle's enforces the repo blocklist and routes GitHub URLs through
`gh`.
Which one an agent should prefer is a deployment choice,
recorded in `doc/audit/dsh-setup-gaps-2026-10-17.md`.
