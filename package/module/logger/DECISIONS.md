# Logger design decisions

## No sub-logger hierarchy (2026-03-07)

The logger does not implement pino-style `child()` sub-loggers.

**Per-component level filtering is unnecessary** because the problem it solves
(global `debug` producing unusable noise) is a log viewer problem,
 not a logger problem.
Structured `LogRecord` objects already carry enough information for read-time filtering.

**Per-component sink routing is unnecessary** because this is a library toolkit,
not a long-running server with compliance or multi-audience requirements.

**Write cost at the source is not a concern** for realistic throughput.
Self-hosted log infrastructure (Loki,
 ClickHouse,
 OpenTelemetry) eliminates
per-record pricing and rate limits.
The only remaining argument for source-side suppression is serialization CPU
in extreme-throughput systems,
 which is better solved by efficient serialization
formats than by discarding data.

If log source identification is needed,
 a lightweight `tagged` wrapper or
manual message prefixing is sufficient without any logger API changes.

## String-only messages, no auto-stringify (2026-03-07)

Log methods accept `string`,
 not `unknown`.
The logger does not auto-serialize objects via `JSON.stringify` or libraries like `safe-stringify`.

**Stringify is the caller's responsibility.
**
The caller knows the data structure and which fields matter.
Generic stringify produces output that is either too verbose or too lossy;
callers end up formatting the string themselves anyway.

**Template literals cover the common case.
**
``l.info(`status ${code} for ${url}`)`` gives the caller full control
over formatting without any serialization machinery in the logger.

**String-only keeps the type surface clean.
**
Accepting `unknown` would require every sink to agree on serialization behavior,
and log output would depend on the stringify implementation rather than caller intent.

**It is a one-way door.
**
Once callers depend on auto-stringify behavior,
changing how objects render becomes a breaking change across every call site.

## Sinks are self-describing factory adapters; the logger owns availability (2026-06-14)

A sink is one value satisfying the `Sink` interface,
 carrying `verify`,
 `write`,
 and an
optional `flush`.
 Verification is part of the sink,
 not a sibling `verifyX` export the
logger pairs by hand,
 so the registry is a plain `Sink[]` and a test supplies one
self-contained fake.

Sinks are built by `createXSink()` factories whose buffers,
 streams,
 counters,
 and
verification memo live in the instance closure.
 There is no module-global sink state and
no `__resetForTests` backdoor:
 independent loggers and tests get isolation for free by
constructing fresh instances.

Availability has a single owner,
 the logger.
 `createLogger({ sinks })` holds per-sink
availability,
 sets it from each `verify` result at startup,
 buffers records emitted before
verification,
 and replays them per sink as it verifies.
 Sinks no longer track their own
`available`/`verified` flags.
 This concentrates the orchestration (replay,
 dropout,
 flush,
throw-when-empty) behind one interface that tests cross directly,
 rather than spreading
duplicated bookkeeping across the logger and every sink.

The default `logger` is `createLogger` applied to the default sink set and stays
zero-config;
 `createLogger` is exported so callers can build a logger over an explicit
sink list.

## Write failures do not disable a sink; only verify failure does (2026-06-14)

A sink is dropped from the available set only when its `verify` reports the backend
unavailable (resolves `false` or rejects),
 or when its `flush` hook rejects.
 An individual
`write` rejection is the sink's own concern and leaves the backend available.

Earlier the contract was "any write throw or rejection retires the sink for the rest of
the run.
" That was unreachable in practice (every shipped sink swallows its own write
errors) and a footgun if it were reachable:
 a momentary `ENOSPC`,
 an OPFS quota blip,
 or a
briefly-locked file would silently kill a backend permanently.
 Verification is the one
event that owns availability;
 transient write errors stay transient.
