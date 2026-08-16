# Fix `mvm` MCP and upgrade `@monochromatic-dev/mcp-stdio` to protocol revision 2026-07-28

Status: in progress.
Opened 2026-08-16 after `/mcp` reported `Failed to reconnect to mvm: CONNECTION_CLOSED`.

## Defect 1: `mvm` server path is stale

`~/.claude.json` registers the server as:

```json
// ~/.claude.json -> mcpServers.mvm
{
  "type": "stdio",
  "command": "node",
  "args": ["/home/user/Monochromatic/packages/mcp/mvm/dist/final/node/index.mjs"],
  "env": {}
}
```

The path segment is `packages`, but the repo directory is `package` (rule `SGD`, singular segments).
Reproduced directly:

```text
Error: Cannot find module '/home/user/Monochromatic/packages/mcp/mvm/dist/final/node/index.mjs'
code: 'MODULE_NOT_FOUND'
```

Node exits before writing a single JSON-RPC frame, which Claude Code surfaces as `CONNECTION_CLOSED`.
`claude mcp list` reproduces the same line:

```text
mvm: node /home/user/Monochromatic/packages/mcp/mvm/dist/final/node/index.mjs - x Failed to connect - CONNECTION_CLOSED: Connection closed
```

The built artifact at `package/mcp/mvm/dist/final/node/index.mjs` dates from 2026-07-13 and predates later source edits,
so the fix is both to repoint the registration and to rebuild.

## Defect 2: the library implements a protocol revision that is two eras behind

`package/mcp/stdio/src/protocol.ts` pins `PROTOCOL_VERSION = '2025-03-26'`.
Released revisions, from `modelcontextprotocol/modelcontextprotocol` `schema/`:
`2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`, `2026-07-28`, plus `draft`.
`https://modelcontextprotocol.io/specification/versioning` names **2026-07-28** the current revision.

### What changed in 2026-07-28

The `initialize` handshake is no longer the negotiation mechanism.
The spec calls handshake revisions (`2025-11-25` and earlier) **legacy** and the new scheme **modern**:

-   Every request carries `_meta["io.modelcontextprotocol/protocolVersion"]`,
    plus a required `_meta["io.modelcontextprotocol/clientCapabilities"]`
    and an optional `_meta["io.modelcontextprotocol/clientInfo"]`.
-   Servers **MUST** implement `server/discover`, returning `supportedVersions`, `capabilities`, `instructions`.
-   Unsupported versions get `UnsupportedProtocolVersionError`, JSON-RPC code `-32022`,
    with `data.supported` and `data.requested`.
-   Every result **MUST** carry `resultType` (`'complete'` for ordinary results).
-   `server/discover` and `tools/list` results are `CacheableResult`: they also carry `ttlMs` and `cacheScope`.
-   `Tool.description` became optional and `Tool` gained `title`, `outputSchema`, `annotations`, `icons`, `_meta`.
-   `CallToolResult` gained `structuredContent`.
-   A server may be **dual-era** and serve both, which is what this library should become.

## Measured client behavior: Claude Code 2.1.233 is dual-era

Probed with a throwaway stdio server registered at local scope in a scratch directory
(`~/temp/agent/mcp-probe-2026-08-16`), health-checked through `claude mcp list` and `claude mcp get probe`.

When the probe answers `server/discover`, the client stays modern:

```text
IN  {"jsonrpc":"2.0","id":"server-discover-probe-1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"claude-code","version":"2.1.233",...},"io.modelcontextprotocol/clientCapabilities":{"roots":{"listChanged":true},"elicitation":{}}}}}
IN  {"method":"tools/list","jsonrpc":"2.0","id":0,"params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28",...}}}
```

Returning `{"tools":[]}` without `resultType` is rejected by the client:

```text
probe: ... - ! Connected - tools fetch failed - Invalid result for tools/list: missing required resultType
- servers implementing protocol revision 2026-07-28 MUST include it
(the absent-means-complete bridge applies only to earlier-revision servers)
```

When the probe rejects `server/discover` with `-32601`, the client falls back to the legacy handshake
and asks for `2025-11-25`:

```text
OUT {"jsonrpc":"2.0","id":"server-discover-probe-1","error":{"code":-32601,"message":"Method not found: server/discover"}}
IN  {"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{"roots":{"listChanged":true},"elicitation":{}},"clientInfo":{"name":"claude-code",...}},"jsonrpc":"2.0","id":0}
IN  {"jsonrpc":"2.0","method":"notifications/initialized"}
IN  {"method":"tools/list","jsonrpc":"2.0","id":1}
```

A server answering `protocolVersion: '2025-06-18'` to that `initialize` is accepted and `tools/list` proceeds.

Consequence: the current library still works with Claude Code through the legacy fallback path,
so `mvm` is broken by the path alone, not by its protocol revision.
The upgrade is a separate, larger piece of work and must preserve the legacy path,
because a modern-only server has no way to serve a legacy client.

## Open questions

-   Does the client enforce `ttlMs` and `cacheScope` on `server/discover` and `tools/list`,
    or only `resultType`? The probe returned a `server/discover` result lacking all three and the client accepted it.
-   Does the client enforce `resultType` on `tools/call` results too?

## Cleanup owed

-   `claude mcp remove probe -s local` in `~/temp/agent/mcp-probe-2026-08-16/work`,
    which also leaves a project entry in `~/.claude.json`.
