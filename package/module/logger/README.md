# module-logger

Zero-config multi-sink logger with tagged composition.
Works immediately at import:
 auto-discovers available backends for the current runtime,
and records emitted while async backend verification is still pending replay to those
backends as soon as they verify.
 Consumers do not await `initPromise` before logging.

## Usage

```ts
import { tagged, } from '@monochromatic-dev/module-logger/tagged';

const l = tagged({ tag: 'http', },);
l.info('server started on port 3000',);
// console output: [info] [2026-03-11T...] [http] server started on port 3000
```

### Composing tags

Pass a parent logger via the `l` parameter to build hierarchical prefixes:

```ts
const l = tagged({ tag: 'http', },);
const rl = tagged({ tag: 'retry', l, },);
rl.warn('attempt 3 failed',);
// [warn] [...] [http] [retry] attempt 3 failed
```

Composed tags render root-first because each wrapper prepends before delegating to its parent logger.

Convention:
 use `myFn.name` as the tag so prefixes stay in sync with refactors.

```ts
function handleRequest({ l, }: { l: Logger; },): void {
  const rl = tagged({ tag: handleRequest.name, l, },);
  rl.info('received',);
}
```

### Default logger (no tags)

Import the singleton directly when tags are not needed:

```ts
import { logger, } from '@monochromatic-dev/module-logger/logger';

logger.error('unexpected shutdown',);
```

## Log levels

Six levels,
 each mapping to a dedicated method:
 `trace`,
 `debug`,
 `info`,
 `warn`,
 `error`,
 `fatal`.

All methods accept a single `string` argument.
The caller owns serialization;
 template literals cover the common case
and keep the logger free of stringify opinions.

```ts
l.info(`status ${code} for ${url}`,);
```

The console sink silences `debug` and `trace` by default in non-browser environments.
Set `MONOCHROMATIC_VERBOSE=true` or pass `--verbose` to enable them.
In browsers,
 verbose mode is enabled automatically because DevTools
already provides its own log-level filtering.

## Sinks

The default logger writes to **all** available sinks simultaneously.
Availability is verified at module load;
 records emitted while an async sink is
still being verified are replayed to that sink when it becomes available.

- **console**:
   formats as `[level] [ISO timestamp] message`;
  maps levels to corresponding `console.*` methods,
  except `debug` writes to `process.stderr` when `process.stderr.write` is available
- **file**:
   Node.
  js only;
   walks up from `process.cwd()` to the nearest
  ancestor `node_modules/`,
   then appends JSONL records to
  `<that dir>/node_modules/.monochromatic/{timestamp}.log.jsonl` via
  `node:fs/promises`.
   When no ancestor `node_modules/` exists,
   the sink
  is marked unavailable rather than creating one at cwd;
   this prevents
  stray log directories from landing inside build output or other
  non-project trees when a script is invoked from an unexpected cwd
- **OPFS**:
   browser only;
   buffers records and appends them to the Origin Private File System as
  newline-joined JSONL batches, one queued stream write per batch, under
  the same flush triggers as the sessionStorage sink;
   keeps a `FileSystemWritableFileStream` open for the session,
   and `logger.flush()` settles every issued batch write
- **sessionStorage**:
   available wherever `globalThis.sessionStorage` exists (browsers, Node, Deno);
   buffers records and stores them as newline-joined JSONL batches under
  `monochromatic.log.{n}` keys with an auto-incrementing counter;
   one uniform write path on every runtime flushes a batch when it reaches
  32 KiB, when a record's severity is `warn` or worse, after 250 ms of quiet,
  on `pagehide`/document-hidden where those events exist, and on
  `logger.flush()`;
   caps its own footprint at half the runtime's default sessionStorage quota
  (a measured per-runtime heuristic: 5 MiB on Node and the browser engines,
  10 MiB on Deno),
   evicting its oldest batches first and reclaiming further space reactively
  if the real store still overflows
- **localStorage**:
   available wherever `globalThis.localStorage` round-trips (browsers,
   Deno,
   Node launched with `--localstorage-file`;
   flagless Node skips the probe silently);
   buffers through the same shared policy and flush triggers as the
  sessionStorage sink,
   but stores each batch under a run-scoped key
  (`monochromatic.log.{stamp}.{nonce}.{index}`) because localStorage is shared
  across tabs and survives restarts;
   adopts entries left by earlier runs and evicts oldest-first,
   capping the combined footprint at half the runtime's default localStorage
  quota (5 MiB on Node and the browser engines,
   just under 10 MiB on Deno);
   the one web storage sink whose records remain inspectable after tab close
  or a full browser restart
- **noop**:
   discards all records;
   a stand-in that disables logging without removing log calls

Each sink is a factory,
 `createConsoleSink()`,
 `createFileSink()`,
 `createOpfsSink()`,
`createSessionStorageSink()`,
 `createLocalStorageSink()`,
 and `createNoopSink()`,
 exported under the `sinks` namespace.
A sink instance keeps its own buffers,
 streams,
 and counters,
 so independent loggers never
share state.

Async sinks are fire-and-forget;
 the log call never blocks the caller.
Call `logger.flush()` before assertions or process shutdown to wait for startup
verification,
 pending sink writes,
 and sink-owned flush hooks.
A sink is dropped only when its `verify` reports the backend unavailable (resolves
`false` or rejects);
 a sink whose `flush` hook rejects is also dropped.
Individual `write` failures are the sink's own concern and do not disable the backend,
so one transient I/O hiccup never silently kills a sink for the rest of the run.

## Log record format

Every sink receives a `LogRecord`:

```ts
type LogRecord = {
  level: Level; // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string;
  timestamp: number; // Date.now()
};
```

File,
 OPFS,
 sessionStorage,
 and localStorage sinks write records as one JSON object per line (JSONL).

## Error handling

- `initPromise` resolves after eager verification and startup replay;
   consumers do not await it before logging
- `logger.flush()` awaits startup verification,
   pending sink writes,
   and sink-owned flush hooks
- Throws at log time once initialization has completed with no available backend
- A sink is dropped when its `verify` reports unavailable (or its flush hook rejects);
   remaining sinks continue
- Individual `write` failures are handled per sink and do not disable the backend

## Custom loggers

The default `logger` is `createLogger` applied to the default sink set,
 and it stays
zero-config.
 `createLogger` is also exported for building a logger over an explicit sink
list,
 for example to write to a fixed subset of backends or to inject a fake in tests.

```ts
import { createLogger, sinks, } from '@monochromatic-dev/module-logger';

const { logger, initPromise, } = createLogger({ sinks: [sinks.createNoopSink()], },);
logger.info('goes nowhere');
await initPromise; // optional; flush() awaits it internally
```

A custom sink is any object satisfying the `Sink` interface,
 a single self-describing
adapter carrying `verify`,
 `write`,
 and an optional `flush`:

```ts
import type { LogRecord, Sink, } from '@monochromatic-dev/module-logger';

function createArraySink(): { records: LogRecord[]; sink: Sink; } {
  const records: LogRecord[] = [];
  const sink: Sink = {
    verify: () => Promise.resolve(true),
    write: (record) => {
      records.push(record);
      return Promise.resolve();
    },
  };
  return { records, sink, };
}
```

`verify`,
 `write`,
 and `flush` are all async (returning `Promise`) so the logger awaits
them uniformly.

## Design decisions

See [DECISIONS.md](DECISIONS.md) for rationale on:

- No sub-logger hierarchy;
   per-component filtering is a log viewer problem
- String-only messages;
   callers own serialization;
   no auto-stringify

## Source files

- `src/types.ts`:
   `Logger`,
   `LogRecord`,
   `Sink`,
   `SinkFlush`,
   `Verify`,
   `Level` type definitions
- `src/create-logger.ts`:
   `createLogger({ sinks })` orchestration (verify,
   startup replay,
   flush)
- `src/logger.ts`:
   default singleton built by applying `createLogger` to the default sinks
- `src/tagged.ts`:
   `tagged()` wrapper for composable prefixes
- `src/sink/console.ts`:
   `createConsoleSink()`,
   verbose-mode gating and microtask batching
- `src/sink/file.ts`:
   `createFileSink()`,
   Node.
  js file sink (JSONL via `appendFile`)
- `src/sink/opfs.ts`:
   `createOpfsSink()`,
   browser OPFS sink with persistent writable stream (batched writes)
- `src/sink/record-buffer.ts`:
   buffering stage shared by the OPFS and sessionStorage sinks
   (byte cap, severity flush, quiet-period deadline, page lifecycle)
- `src/sink/session-storage.ts`:
   `createSessionStorageSink()`,
   cross-runtime web storage sink (buffering, flush triggers)
- `src/sink/session-storage-store.ts`:
   persistence engine behind it (key allocation, footprint accounting,
   quota eviction)
- `src/sink/local-storage.ts`:
   `createLocalStorageSink()`,
   cross-runtime persistent web storage sink (same buffering, run-scoped keys)
- `src/sink/local-storage-store.ts`:
   persistence engine behind it (run identity, prior-run adoption,
   cross-run oldest-first eviction)
- `src/sink/local-storage-key.ts`:
   run-scoped key building, strict parsing, and eviction ordering
- `src/sink/local-storage-quota.ts` and `src/sink/session-storage-quota.ts`:
   fill-probed per-runtime quota tables
- `src/sink/web-storage-runtime.ts` and `src/sink/web-storage-quota-error.ts`:
   host-runtime detection and quota-overflow recognition shared by both
  web storage engines
- `src/sink/noop.ts`:
   `createNoopSink()`,
   discards all records
