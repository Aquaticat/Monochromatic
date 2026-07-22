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

## localStorage sink: absent by omission, added with run-scoped keys (2026-07-22)

The original sink set (commit `7fe3a2044`,
 2025-12-29) shipped console,
 file,
 OPFS,
 sessionStorage,
 and noop.
No decision record,
 code comment,
 or issue explains localStorage's absence;
 the commit message enumerates the set with one-line rationales and never mentions it.
The absence was an omission,
 not a decision.

The omission was accidentally defensible,
 which is probably why nobody noticed it.
The sessionStorage sink's design leans on two properties localStorage lacks:
 per-tab isolation (so flat `monochromatic.log.{n}` counter keys cannot collide with
another tab) and tab-close cleanup (so the sink cannot permanently squat on the
origin's quota).
A localStorage sink reusing that design would corrupt itself across tabs and,
 worse,
 fill the store with dead-session leftovers until no future run could ever write again,
 because the sessionStorage engine's eviction only touches keys it wrote itself.

The added sink (`src/sink/local-storage.ts`) resolves both differences instead of
inheriting them:

- Keys carry a run identity,
   `monochromatic.log.{stamp}.{nonce}.{index}` (`local-storage-key.ts`):
   the stamp orders runs oldest-first,
   the nonce separates same-millisecond tabs,
   the index orders batches within a run.
- On its first persist the engine adopts every strictly-parsed entry left by other
  runs into its footprint tally and evicts those oldest-first before its own,
   so leftovers roll off instead of bricking the store.
   Keys that fail the strict parse,
   including the host application's and the sessionStorage sink's flat shape,
   are never counted and never evicted.
- The half-quota footprint cap covers the combined (adopted plus own) footprint,
   from a fill-probed per-runtime table (`local-storage-quota.ts`).
- Buffering composes the same `record-buffer.ts` stage as the sessionStorage and
  OPFS sinks:
   one uniform write path,
   no per-runtime mode.
- `verify` elects by probe wherever `localStorage` round-trips (browsers,
   Deno,
   Node with `--localstorage-file`).
   The single short-circuit returns the probe's own answer for flagless plain Node
  without touching the getter,
   because merely accessing `globalThis.localStorage` there prints an
  `ExperimentalWarning` on every consumer's stderr.

It also earns its default-set slot rather than duplicating sessionStorage:
 localStorage is the only web storage sink whose records survive tab close and a
full browser restart (Chromium's browser process commits localStorage to disk on a
five-second cadence),
 so it is the backend whose records remain inspectable after the crash classes the
other sinks lose.
Measurements,
 crash taxonomy,
 and the buffering design live in
`doc/troubleshooting/web-storage-sink-main-thread-cost.md`.

## IndexedDB takes the default persistent-browser slot from OPFS (2026-07-22)

The OPFS sink keeps one `FileSystemWritableFileStream` open for the whole session,
 and stream writes stage into a swap file that only becomes the real file on `close()`;
 the sink's own verify comment records that `getFile()` reads stale content while a
writable is open.
A crash never closes,
 so the OPFS sink's records were unreadable mid-session and effectively lost in
exactly the crash scenarios a persistent sink exists for.

`createIndexedDbSink` replaces it in the default set because IndexedDB commits per
transaction:
 records are readable the moment the transaction settles (DevTools Application tab
included),
 survive tab close and full browser restart,
 and the API is also exposed in workers,
 unlike `[Exposed=Window]` web storage.
Probes found `indexedDB` undefined on Node 26,
 Deno 2.9,
 and Bun,
 so the sink is browser-only,
 the same election set OPFS had.

Shape and cost were measured on headless Chromium 149 before building
(130-char-equivalent records):

- one transaction per record:
   18.6 µs of main-thread enqueue per record,
   worse than unbatched `setItem`,
   so a naive per-record port was rejected;
- one transaction per batch with one `add` per record:
   8.0 µs per record;
- one `add` per batch storing the exact newline-joined JSONL string
  `record-buffer.ts` emits:
   0.15 µs per record,
   the shape shipped;
- the alternative of keeping OPFS and closing-and-reopening its writable per batch
  for durability:
   1.56 ms per flush,
   6.26 µs per record,
   rejected as costlier for less capability.

Retention caps the store at 2048 batches,
 trimmed oldest-first inside the same transaction as each add,
 bounding the store near 64 MiB at the 32 KiB flush cap without a cross-session
byte tally.
Transactions use relaxed durability deliberately:
 relaxed commits reach the browser's storage backend promptly and survive renderer
crashes,
 and the OS-crash window `durability: 'strict'` would close is the rarest failure
class per the humility principle,
 not worth an fsync per batch.
Known limits,
 stated rather than hidden:
 the measurements are Chromium-only,
 and IndexedDB sits under best-effort origin storage,
 evictable by the browser under disk pressure unless the application obtains
`navigator.storage.persist()`.

The OPFS factory stays exported for callers who want an origin-private JSONL file
and accept its close-to-persist semantics.
