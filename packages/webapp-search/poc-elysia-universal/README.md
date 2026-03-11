# poc-elysia-universal

Proof-of-concept demonstrating that a **single Elysia codebase** runs unchanged on Bun, Node.js, and Deno.

## Motivation

The `webapp-productivity` and `webapp-search` packages use `Bun.serve()` with its built-in `routes` object
for pattern matching (`:param`) and per-method dispatch (`{ GET, POST, PUT, DELETE }`).
Replacing `Bun.serve()` with a cross-runtime alternative was investigated, and the question arose:
does Elysia require code changes per runtime, or can one file serve all three?

**Answer: zero application code changes needed.**
Runtime adapter selection is a runtime decision via dynamic import, not a source-level fork.

## How it works

The entire adapter logic is five lines:

```ts
// src/server.ts
async function resolveAdapter(): Promise<unknown> {
  if (typeof globalThis.Bun !== 'undefined') {
    return undefined; // Elysia auto-selects BunAdapter
  }
  const { node } = await import('@elysiajs/node');
  return node();
}
```

- **Bun** -- Elysia detects `globalThis.Bun` and uses its built-in `BunAdapter`,
  which delegates to `Bun.serve({ routes })` internally for SIMD-accelerated routing.
- **Node.js** -- `@elysiajs/node` is dynamically imported; it uses srvx under the hood.
- **Deno** -- the same `@elysiajs/node` adapter works because srvx has a Deno adapter internally.
  Deno does **not** need a separate adapter or `Deno.serve()` call; `.listen()` works.

Route definitions, middleware, validation, and business logic are identical across all runtimes.

## Running

```sh
# Bun (primary runtime)
bun src/server.ts

# Node.js (requires --experimental-strip-types for .ts)
node --experimental-strip-types src/server.ts

# Deno (requires --unstable-net for srvx's reusePort; run from package directory)
deno run --allow-net --allow-read --allow-env --unstable-net --node-modules-dir=auto src/server.ts
```

All three serve on `http://localhost:3099`.

## Verified endpoints

Every endpoint returns identical JSON across all runtimes:

```sh
curl http://localhost:3099/
# {"message":"Elysia universal PoC","runtime":"Bun 1.3.10"}

curl http://localhost:3099/tasks
# [{"id":"1","title":"Try Bun","done":true}, ...]

curl http://localhost:3099/tasks/1
# {"id":"1","title":"Try Bun","done":true}

curl -X POST -H 'Content-Type: application/json' -d '{"title":"New"}' http://localhost:3099/tasks
# {"id":"4","title":"New","done":false}

curl -X POST http://localhost:3099/tasks/2/complete
# {"id":"2","title":"Try Node.js","done":true}
```

## Test results

Tested 2026-03-11:

- **Bun 1.3.10** -- all endpoints pass
- **Node.js v25.8.1** -- all endpoints pass
- **Deno 2.7.5** -- all endpoints pass

## Caveats

### Deno does not support `catalog:` version specifiers

Bun workspaces use `"elysia": "catalog:"` in `package.json` to resolve versions from the root catalog.
Deno's npm resolver does not understand this protocol.
Dependencies consumed by Deno must use standard semver ranges (`^1.4.22`).

### Deno requires `--unstable-net`

The `@elysiajs/node` adapter uses srvx, which calls `Deno.listen({ reusePort: true })`.
This API is still unstable in Deno 2.7.5 and requires the `--unstable-net` flag.

### Deno must resolve `node_modules`

Run from the package directory or pass `--node-modules-dir=auto`
so Deno can find the npm packages installed by Bun.

### Elysia remains Bun-first

New features land for Bun first; other runtimes catch up via adapters.
The RFC to make Elysia "truly cross-runtime" was [closed as NOT_PLANNED][rfc].
Plugins that use Bun-specific APIs (`Bun.file`, etc.) may not work on Node.js or Deno.

[rfc]: https://github.com/elysiajs/elysia/issues/1174

## Comparison with alternatives

### srvx + rou3

Lightest option (~6KB combined).
srvx provides the server; rou3 provides radix-tree routing with `:param` and per-method dispatch.
Requires manual wiring between the router and the fetch handler.
Both are from the h3js/unjs ecosystem (same author as Elysia's node adapter dependency).

### Hono

Full framework (~20KB) with built-in routing, middleware, and runtime adapters.
Zero code changes between runtimes.
Different API paradigm (context object, middleware chain) from the current `Bun.serve({ routes })` pattern.

### Elysia (this PoC)

Framework (~50KB) with built-in routing, validation (typebox), and type inference.
On Bun, delegates to `Bun.serve({ routes })` for native performance.
Dynamic import pattern eliminates all code changes between runtimes.
Closest match to the existing `Bun.serve({ routes })` pattern in the monorepo.
