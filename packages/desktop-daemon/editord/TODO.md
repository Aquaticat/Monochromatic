# editord TODO

## Performance

Many performance and observability issues exist across the entire daemon.

### File tree

The file tree has significant optimization opportunities:

- **Pre-render entries into hidden `<details><summary>` elements** instead of
  creating DOM nodes on expand via JS click handlers.
  The browser handles expand/collapse natively with no JS,
  and pre-rendered content is ready instantly without closure state management.
- **Debounce rapid expand/collapse** — fast toggling fires concurrent fetches
  with no cancellation; `AbortController` per directory would prevent wasted work

### WebSocket protocol

- **No heartbeat or reconnection** — connection drops are silent;
  the client has no ping/pong or automatic reconnect logic
- **No backpressure** — rapid `listDir` requests from preloading
  can saturate the server with no queuing or throttling

## Observability

- **No structured logging** — server uses raw `console.log`;
  should use tagged loggers from `@monochromatic-dev/module-es`
- **No client-side error reporting** — WS operation failures surface
  as uncaught promise rejections with no user-visible feedback
- **No request tracing** — WS messages have `id` for correlation
  but no timing, no server-side request logs, no latency metrics
