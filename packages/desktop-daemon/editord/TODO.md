# editord TODO

## Performance

### File tree

- **Debounce rapid expand/collapse** -- fast toggling fires concurrent fetches
  with no cancellation; `AbortController` per directory would prevent wasted work

### WebSocket protocol

- **No heartbeat or reconnection** -- connection drops are silent;
  the client has no ping/pong or automatic reconnect logic
- **No backpressure** -- rapid `listDir` requests from preloading
  can saturate the server with no queuing or throttling

## Observability

- **No request tracing** -- WS messages have `id` for correlation
  but no timing, no server-side request logs, no latency metrics
