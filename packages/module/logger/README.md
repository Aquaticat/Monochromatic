# module-logger

Zero-config multi-sink logger with tagged composition.
Works immediately at import: auto-discovers available backends for the current runtime
without a configuration step.

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

Convention: use `myFn.name` as the tag so prefixes stay in sync with refactors.

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

Six levels, each mapping to a dedicated method: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

All methods accept a single `string` argument.
The caller owns serialization; template literals cover the common case
and keep the logger free of stringify opinions.

```ts
l.info(`status ${code} for ${url}`,);
```

The console sink silences `debug` and `trace` by default in non-browser environments.
Set `DEBUG=true`, pass `--verbose`, or set `import.meta.env.DEBUG` to `'true'` to enable them.
In browsers, verbose mode is enabled automatically because DevTools
already provides its own log-level filtering.

## Sinks

The default logger writes to **all** available sinks simultaneously.
Availability is verified once at module load; sinks that fail verification are skipped.

- **console** -- formats as `[level] [ISO timestamp] message`;
  maps levels to corresponding `console.*` methods
- **file** -- Node.js only; walks up from `process.cwd()` to the nearest
  ancestor `node_modules/`, then appends JSONL records to
  `<that dir>/node_modules/.monochromatic/{timestamp}.log.jsonl` via
  `node:fs/promises`. When no ancestor `node_modules/` exists, the sink
  is marked unavailable rather than creating one at cwd; this prevents
  stray log directories from landing inside build output or other
  non-project trees when a script is invoked from an unexpected cwd
- **OPFS** -- browser only; appends JSONL records to Origin Private File System;
  keeps a `FileSystemWritableFileStream` open for the session
- **sessionStorage** -- browser only; stores JSONL records under `monochromatic.log.{n}` keys
  with an auto-incrementing counter
- **noop** -- discards all records; useful for testing

Sinks can be sync or async.
Async sinks are fire-and-forget; the log call never blocks the caller.
If a sink throws or its promise rejects, it is marked unavailable and excluded from future calls.

## Log record format

Every sink receives a `LogRecord`:

```ts
type LogRecord = {
  level: Level; // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string;
  timestamp: number; // Date.now()
};
```

File, OPFS, and sessionStorage sinks write records as one JSON object per line (JSONL).

## Error handling

- `initPromise` rejects during eager initialization if **no** backends pass verification
- Throws at log time once initialization has completed with no available backend
- Individual sink failures are silent -- the sink is disabled and remaining sinks continue

## Design decisions

See [DECISIONS.md](DECISIONS.md) for rationale on:

- No sub-logger hierarchy -- per-component filtering is a log viewer problem
- String-only messages -- callers own serialization; no auto-stringify

## Source files

- `src/types.ts` -- `Logger`, `LogRecord`, `Sink`, `SinkFlush`, `Verify`, `Level` type definitions
- `src/logger.ts` -- default multi-sink logger singleton with eager initialization
- `src/tagged.ts` -- `tagged()` wrapper for composable prefixes
- `src/sinks/console.ts` -- console sink with verbose-mode gating and microtask batching
- `src/sinks/file.ts` -- Node.js file sink (JSONL via `appendFile`)
- `src/sinks/opfs.ts` -- browser OPFS sink with persistent writable stream
- `src/sinks/session-storage.ts` -- browser sessionStorage sink
- `src/sinks/noop.ts` -- noop sink for testing
