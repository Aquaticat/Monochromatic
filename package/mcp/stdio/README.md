# @monochromatic-dev/mcp-stdio

Minimal MCP server framework for stdio transport.
Zero runtime dependencies,
 ~800 lines of TypeScript.

## Why

The official `@modelcontextprotocol/sdk` pulls in 5.8 MB and 17 dependencies
(Express,
 Hono,
 jose,
 CORS,
 rate limiting,
 SSE infrastructure)
to support HTTP transport,
 OAuth,
 and session management.
None of that applies to a local stdio server with a handful of tools.

This package implements only what a stdio tool server needs:
JSON-RPC 2.0 over newline-delimited stdin/stdout,
the MCP initialization handshake,
`tools/list`,
 `tools/call`,
 and `ping`.

## Usage

```ts
// package/mcp/my-server/src/index.ts
import {
  createMcpServer,
  defineTool,
  serve,
} from '@monochromatic-dev/mcp-stdio';

const server = createMcpServer(
  { name: 'my-server', version: '0.1.0', },
  [
    defineTool('greet', {
      description: 'Greets by name.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', }, },
        required: ['name',],
      },
      handler: async args => ({
        content: [{ type: 'text', text: `Hello, ${args.name}!`, },],
      }),
    },),
  ],
);

await serve(server,);
```

## Protocol coverage

Implements MCP spec revision **2025-03-26** (stdio transport only).

- `initialize` / `notifications/initialized` handshake
- `tools/list` with full tool definitions
- `tools/call` with argument dispatch and input validation
- `ping` keep-alive
- JSON-RPC error codes for parse errors,
   invalid messages,
   unknown methods,
   unknown tools

Features intentionally omitted (not needed for stdio):
HTTP/SSE transport,
 OAuth,
 session management,
 resources,
 prompts,
 sampling,
progress notifications,
 cancellation.

## Architecture

```text
src/
  json-rpc.ts      JSON-RPC 2.0 types, error codes, and message validation
  protocol.ts      MCP protocol types (initialization, capabilities, tool definitions)
  server-types.ts  Server configuration, tool entry, and handle types
  server.ts        createMcpServer factory and defineTool (JSON-RPC dispatch)
  transport.ts     Connects server handle to stdin/stdout
  line-reader.ts   Async iterator yielding newline-delimited lines from a byte stream
  index.ts         Public API re-exports
```
