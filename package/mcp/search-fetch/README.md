# @monochromatic-dev/mcp-search-fetch

MCP server exposing the shared web_search and web_fetch tools over stdio,
with truncated responses delivered as resources.

## Why

The pi extension `@monochromatic-dev/pi-plugin-search-fetch` serves pi hosts.
This server serves every other MCP host with the identical behavior:
Exa-first search with Linkup fallback,
gh CLI routing for mapped GitHub URLs,
the global host blocklist,
base64 data-URL image stripping,
and the same tool names and descriptions.
Both surfaces delegate to `@monochromatic-dev/agent-harness-shared-search-fetch`,
so behavior has exactly one implementation.

One surface per host:
a host that loads this server should not also load the pi extension.

## Tools

- `web_search` searches with Exa fast search first and Linkup standard fallback.
- `web_fetch` fetches one page,
  routing mapped GitHub URLs through the local `gh` CLI.

Both keep the shared open parameter schema,
so unsupported keys produce a warning instead of a rejection.

## Truncated responses as resources

Truncated tool output still carries the model-visible head plus a full-response temp path,
identical to the pi surface.
Additionally this server records the full response and adds:

- a text line naming the `search-fetch://response/<id>` resource URI, and
- a `resource_link` content block pointing at the same URI.

Hosts read the full text with `resources/read`,
or list what is available with `resources/list`.
Hosts without resource support can still use the temp path when their tools can read files.
Hosts that render only text content show one placeholder line for the `resource_link` block;
OpenCodeReview is such a host.

## Registration

### Generic stdio

`search-fetch-mcp` speaks newline-delimited JSON-RPC 2.0 over stdin and stdout,
so any MCP client that launches stdio servers can register it:

```jsonc
{
  "mcpServers": {
    "search-fetch": {
      "command": "search-fetch-mcp"
    }
  }
}
```

### open-codereview.ai

OpenCodeReview registers MCP servers under `mcp_servers.<name>` in
`~/.opencodereview/config.json`:

```bash
ocr config set mcp_servers.search-fetch.command search-fetch-mcp
```

Optional allowlist restricting the exposed tools:

```bash
ocr config set mcp_servers.search-fetch.tools '["web_search", "web_fetch"]'
```

See <https://open-codereview.ai/docs/mcp> for every configuration field.

## Configuration

Loads the same global config file and environment keys as the pi extension
(`EXA_API_KEY`, `LINKUP_API_KEY`, and the blocklist),
so one config serves both surfaces.

## Tests

`src/index.unit.test.ts` drives the built artifact through its own dispatch surface:
discovery capabilities,
tool listing,
ignored-key warnings,
blocklist failures as tool errors,
and the truncated-response resource round trip
(oversized stub response to `resources/read`).
