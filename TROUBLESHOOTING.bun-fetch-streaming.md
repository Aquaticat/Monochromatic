# Bun fetch streaming: process hangs after stream consumption

## Symptom

A Bun process that consumes a streaming HTTP response (SSE, chunked transfer) via `fetch` fails to exit
after all work completes.
The process hangs indefinitely or until the server closes the TCP connection.
Node.js exits in ~4ms under identical conditions.

Affected patterns:

```typescript
// Breaking from a streaming response
const response = await fetch(url,);
for await (const chunk of response.body!) {
  // process chunk
  break; // process hangs here -- Bun keeps the HTTP connection alive
}

// OpenAI SDK streaming (uses fetch internally)
const stream = await client.chat.completions.create({ model, messages,
  stream: true, },);
for await (const chunk of stream) {
  // process chunk
}
// process should exit here but may hang
```

## Root cause

Bun's `FetchTasklet` maintains a `poll_ref` that keeps the JS event loop alive while a fetch request is in progress.
The ref is set when the fetch starts (`poll_ref.ref()`) and only cleared when:

1. The HTTP thread receives the complete response (`is_done == true` in `onProgressUpdate`)
2. `ignoreRemainingResponseBody()` is called (e.g., when the `Response` object is GC'd without body consumption)

**The bug:** calling `ReadableStream.cancel()` on the response body (which happens when breaking from `for await`,
calling `reader.cancel()`, or `stream.cancel()`) does **not** propagate to the HTTP layer.
The `FetchTasklet` never learns the JS side is done with the stream, so `poll_ref` stays ref'd
until the server finishes sending or closes the connection.

For SSE streams (like OpenAI/OpenRouter chat completions with `stream: true`),
the server may hold the connection open after sending `[DONE]` due to HTTP keep-alive,
causing the process to hang for seconds to minutes.
With infinite streams, the process never exits.

**Upstream issue:** [oven-sh/bun#17048](https://github.com/oven-sh/bun/issues/17048)

**Upstream fix:** [oven-sh/bun#27232](https://github.com/oven-sh/bun/pull/27232) adds a `cancel_handler` callback
that propagates `ReadableStream.cancel()` to `FetchTasklet.ignoreRemainingResponseBody()`.
Not merged as of March 2026.

## Why the hang is intermittent

The hang depends on server-side TCP connection teardown timing.
After the SSE `[DONE]` sentinel, if the server closes the connection immediately,
`poll_ref` unrefs via the `onProgressUpdate(is_done=true)` path and the process exits.
If the server holds the connection (HTTP/1.1 keep-alive), `poll_ref` stays ref'd.

## Workaround: watchdog with diagnostics

The inference-canary uses an unref'd watchdog timer that dumps active async handles
via `why-is-node-running` before force-exiting:

```typescript
import whyIsNodeRunning from 'why-is-node-running';

// ... after all work completes ...

const WATCHDOG_TIMEOUT_SECONDS = 5;
const watchdog = setTimeout(() => {
  console.error('process did not exit naturally, dumping active handles:',);
  whyIsNodeRunning();
  process.exit(0,);
}, WATCHDOG_TIMEOUT_SECONDS * 1000,);
watchdog.unref(); // the watchdog itself must not prevent exit
```

Normal case: event loop drains, unref'd timer never fires, clean exit.
Hang case: after 5 seconds the watchdog logs which resources are alive, then force-exits.

## Workaround: AbortController

Using `AbortController.abort()` on the fetch request bypasses the `ReadableStream.cancel()` path
and tears down the HTTP connection directly:

```typescript
const controller = new AbortController();
const response = await fetch(url, { signal: controller.signal, },);
for await (const chunk of response.body!) {
  // process chunk
}
controller.abort(); // tears down HTTP connection at the transport level
```

The OpenAI SDK accepts a `signal` option on `.create()` calls,
but aborting after successful completion produces an `AbortError` that must be caught.

## Alternative transports that avoid the bug

| Transport                                      | Uses fetch ReadableStream          | Affected |
| ---------------------------------------------- | ---------------------------------- | -------- |
| SSE via fetch (OpenRouter, OpenAI default)     | Yes                                | Yes      |
| HTTP chunked via fetch                         | Yes                                | Yes      |
| WebSocket via `ws` (OpenAI Responses API only) | No                                 | No       |
| WebSocket via Bun native                       | No                                 | No       |
| undici fetch (bypasses Bun's native fetch)     | Unclear -- Bun polyfills Node APIs | Untested |

OpenRouter's Responses API (`/api/v1/responses`) supports `stream: true` but returns SSE over HTTP POST --
the same fetch ReadableStream path as Chat Completions. No WebSocket transport is available.
OpenAI's Responses API supports WebSocket via `openai/resources/responses/ws`
(requires `ws` npm package, beta feature, header `OpenAI-Beta: responses_websockets=2026-02-06`),
but this is only available when calling OpenAI directly, not through OpenRouter.

## Affected versions

- **Bun:** all versions as of 1.3.10 (until PR #27232 merges)
- **OpenAI SDK:** v5+ (uses native fetch; v4 had a separate `agentkeepalive` hang bug)
- **OpenRouter SDK:** all versions (uses native fetch)
- **Node.js:** not affected -- undici unrefs idle sockets via `socket.unref()` in `resumeH1`
