# Logger design decisions

## No sub-logger hierarchy (2026-03-07)

The logger does not implement pino-style `child()` sub-loggers.

**Per-component level filtering is unnecessary** because the problem it solves
(global `debug` producing unusable noise) is a log viewer problem, not a logger problem.
Structured `LogRecord` objects already carry enough information for read-time filtering.

**Per-component sink routing is unnecessary** because this is a library toolkit,
not a long-running server with compliance or multi-audience requirements.

**Write cost at the source is not a concern** for realistic throughput.
Self-hosted log infrastructure (Loki, ClickHouse, OpenTelemetry) eliminates
per-record pricing and rate limits.
The only remaining argument for source-side suppression is serialization CPU
in extreme-throughput systems, which is better solved by efficient serialization
formats than by discarding data.

If log source identification is needed, a lightweight `tagged` wrapper or
manual message prefixing is sufficient without any logger API changes.

## String-only messages, no auto-stringify (2026-03-07)

Log methods accept `string`, not `unknown`.
The logger does not auto-serialize objects via `JSON.stringify` or libraries like `safe-stringify`.

**Stringify is the caller's responsibility.**
The caller knows the data structure and which fields matter.
Generic stringify produces output that is either too verbose or too lossy;
callers end up formatting the string themselves anyway.

**Template literals cover the common case.**
``l.info(`status ${code} for ${url}`)`` gives the caller full control
over formatting without any serialization machinery in the logger.

**String-only keeps the type surface clean.**
Accepting `unknown` would require every sink to agree on serialization behavior,
and log output would depend on the stringify implementation rather than caller intent.

**It is a one-way door.**
Once callers depend on auto-stringify behavior,
changing how objects render becomes a breaking change across every call site.
