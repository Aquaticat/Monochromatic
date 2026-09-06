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

## Console output neutralizes control characters (2026-09-06)

The console sink renders every C0 control except newline and tab,
 DEL,
 and every C1 control as a `\uXXXX` escape before text reaches `console.*` or `process.stderr`
(`src/sink/console-control-chars.ts`).
Measured before the change:
 the built artifact passed an OSC title-set and a CSI clear-screen straight to stdout,
 so any log message carrying user-influenced text could drive the terminal.
The repository's syntax-boundary rule makes this mandatory for a published sink.

Alternatives considered:
 preserving well-formed SGR color sequences (rejected:
 no in-repo call site passes color through the logger,
 and an allowlist needs a classifier tested against malformed sequences);
 dropping controls silently (rejected:
 hides an injection attempt);
 replacing with U+FFFD (rejected:
 loses which control was attempted).
Newlines stay literal because multi-line messages are core,
 and the persistent JSONL sinks already escape everything through `JSON.stringify`.
A single-argument `console.info` call does not interpret `%s`,
 so no format-specifier guard is needed;
 that was verified on the built artifact.

## flush() has a deadline (2026-09-06)

`flush()` used to await every in-flight write with no bound,
 so a file append on a stuck mount or an IndexedDB transaction blocked by another tab kept
`await logger.flush()` from ever settling and the process from exiting.
One deadline now wraps startup verification,
 the write drain,
 and every sink flush hook together;
 when it elapses the logger reports one breadcrumb,
 drops the tracked writes from its view,
 and resolves.
Sinks expose no cancellation,
 so abandoned work continues in the background.

The deadline is one `createLogger` option,
 `flushDeadlineMs`,
 with the exported default `DEFAULT_FLUSH_DEADLINE_MS` (5000).
Measured on 2026-09-06:
 a default logger flushing 100 records through the console and file sinks settles in about 2 ms locally
(five runs between 2.02 and 2.69 ms),
 so the default leaves three orders of magnitude for a slow but working backend.
It is an option rather than a constant because a consumer on a network filesystem needs recourse other than a fork.
The other tuning knobs proposed in `bulletproofing.plan.md` (verify timeout,
 retire threshold,
 startup buffer cap) stay out;
 none has a measured trigger.

## Zero-config at import, no configure step (recorded 2026-09-06)

The default `logger` is usable at import time with no setup call,
 and `createLogger` exists only for callers who want an explicit sink list.
One reason for migrating off logtape,
 recorded by the maintainer so it is not lost:
logtape forces every test file to declare the same `createLogger` or `configure` block before logging works,
 and that boilerplate repeated across the whole test tree was part of why it was dropped.
A future change that adds a mandatory configure or setup call reopens that problem.

## Open problem: import-time sink discovery pushes consumers toward dynamic imports (2026-09-06)

Users of this logger have complained that using it effectively introduces dynamic imports into an otherwise clean application.
The mechanism is the flip side of zero-config:
 importing the module runs sink auto-discovery (five verifies,
 a filesystem probe,
 storage probes) as a side effect,
 so any module that must not pay for that in some execution context defers the import instead of importing statically.
The repository has one such consumer of its own:
 `package/ssg/aquati.cat/src/build/compress.ts` imports the logger with `await import(...)` on the main thread only,
 "so worker threads never pay its import-time sink auto-discovery".

Corrected on 2026-09-06 after the maintainer pointed out that users object to the mere existence of `import()` in their bundles,
 not to when discovery runs.
Measured on the 0.2.0 artifacts:
 both `dist/final/node/index.mjs` and `dist/final/neutral/index.mjs` contain two dynamic imports,
 `import('node:fs/promises')` and `import('node:path')`,
 both from the file sink's verify (`src/sink/file.ts`).
A browser consumer that imports the logger statically and never touches the file sink,
 bundled with rolldown for `platform: 'browser'` against the neutral artifact,
 still carries both `import('node:...')` expressions in its output.
So the artifact itself puts dynamic imports into every downstream bundle,
 and starting discovery lazily would change nothing about that.
The earlier lazy-discovery candidate is withdrawn as a fix for this complaint;
 it remains a separate idea for callers that never log.

Candidate fixes,
 ranked:

- Platform-split file sink through package `imports` conditions.
   `src/sink/file.node.ts` imports `node:fs/promises` and `node:path` statically;
   `src/sink/file.neutral.ts` is the same `createFileSink` signature whose verify answers false;
   `package.json` maps `#file-sink` to the node file under the `node` condition and the neutral file under `default`,
   and rolldown selects one per build from its `platform`.
   Pros:
   no `import()` in either artifact,
   public API and types identical on both conditions,
   zero-config kept,
   no new plugin.
   Cons:
   two source files for one sink,
   and TypeScript must resolve `#file-sink` (the `imports` field is honoured under `moduleResolution: bundler`).
- Separate `./node` subpath export carrying the file sink,
   with the root entry free of Node modules.
   Pros:
   the same artifact hygiene.
   Cons:
   the default logger under Node loses file logging unless the `node` condition of `.` re-adds it,
   which lands back on the first option with an extra export to document.
- Static `node:` imports in one file sink plus a browser shim for the two modules.
   Pros:
   one source file.
   Cons:
   the neutral artifact then imports a shim that exists only to fail verification,
   which is the first option's stub with more indirection.
- Keep the dynamic imports and instruct consumers to mark `node:` modules external.
   Pros:
   no code change.
   Cons:
   the complaint is precisely that consumers have to do this.

Ranking:
 platform split > subpath export > static imports with shim > documentation only,
 because the platform split removes the expressions with no API change,
 the subpath export reaches the same artifact only by re-adding the split,
 the shim is the split with more indirection,
 and documentation leaves the artifact as it is.
Acceptance:
 a unit test reads both built artifacts and fails on any `import(`,
 and the consumer bundle probe shows none.

### Prior art (manifests fetched from the registry on 2026-09-06)

- `@logtape/logtape` 2.3.3,
   the logger this package replaced,
   selects platform code through the `imports` field:
   `#util` maps to `util.node.js` under `node` and `bun`,
   `util.deno.js` under `deno`,
   and `util.js` under `browser` and `default`;
   the node file imports `node:util` statically and the default file uses `JSON.stringify`.
   Its file sink is a separate package,
   `@logtape/file`,
   whose `#filesink` maps `bun` and `import` to `filesink.node.js` and `deno` to `filesink.deno.js`,
   with no browser branch at all.
- `chalk` 6.0.0:
   `#supports-color` maps `node` to a file with static `node:process`,
   `node:os`,
   and `node:tty` imports,
   and `default` to a browser file that reads `navigator`.
- `consola` 3.4.2:
   root export `node` to `dist/index.mjs` and `default` to `dist/browser.mjs`,
   plus the legacy `browser` field.
- `tslog` 5.1.0:
   root export per runtime condition (`browser`,
   `worker`,
   `deno`,
   `bun`,
   `node`,
   `react-native`,
   `default`) to `index.node.js`,
   `index.browser.js`,
   or `index.universal.js`.
- `uuid` 14.0.2,
   `supports-color` 11.0.0,
   `yaml` 2.9.0,
   `isomorphic-git` 1.41.9:
   `node` and `default` conditions to separate builds.
- `nanoid` 6.0.1:
   `browser` condition;
   `ws` 8.21.3:
   `browser` condition to a throwing stub;
   `electron-log` 5.4.4:
   `browser` condition to the renderer entry.
- `log4js` 6.9.1:
   the legacy `browser` field maps every file appender to `ignoreBrowser.js`,
   a stub,
   and maps `os` and `streamroller` to `false`;
   `dotenv` 17.4.2 maps `fs` to `false`.
- `pino` 10.3.1,
   `debug` 4.4.3,
   `winston` 3.19.0,
   `roarr` 7.21.7,
   `cross-fetch` 4.1.0:
   legacy `browser` field to a separate browser entry.
- `jose` 6.2.12:
   one Web-API-only entry with no Node module anywhere.
- `puppeteer-core` 25.10.0:
   legacy `browser` field to `puppeteer-core-browser.js`.
   Its maintainer opened vitejs/vite discussion 17661 asking to suppress the
   "externalized for browser compatibility" warning for libraries that import Node modules conditionally at runtime;
   the discussion is unanswered,
   and Vite's troubleshooting page tells users to report such warnings to the library.

Nothing in this sample keeps a runtime-guarded dynamic import of a Node module in an artifact that browsers also receive.
Every package selects the platform at resolution time (export conditions,
 `imports` conditions,
 or the `browser` field) and,
 where a feature cannot exist in the browser,
 ships a stub (`log4js`,
 `ws`,
 `dotenv`) or omits the feature from the browser entry (`consola`,
 LogTape).
Node documents the `imports` field as "conditional exports for internal modules" with resolution rules
"otherwise analogous to the exports field".
The ranked first option therefore has the closest precedent in the logger this package replaced,
 and the current design has precedent only in the unanswered request for warning suppression.

## Sinks verify concurrently under a time limit (2026-09-06)

`initialize()` used to await each sink's `verify` in list order.
One verify that never answered (a filesystem probe on a hung mount,
 an IndexedDB open blocked by another tab's version change) starved every sink after it,
 kept the startup buffer growing for the life of the process,
 and never let the logger mark itself initialized.

Every sink now verifies concurrently,
 each under `withTimeout`;
 a verify that runs past the limit counts as unavailable with one breadcrumb,
 and an answer that arrives later is never observed.
The limit is one `createLogger` option,
 `verifyTimeoutMs`,
 with the exported default `DEFAULT_VERIFY_TIMEOUT_MS` (5000),
 the same shape as `flushDeadlineMs` and for the same reason:
 a consumer whose probe is legitimately slow needs recourse other than losing the sink.
Measured on 2026-09-06:
 the five shipped verifies complete together in about 2.4 ms locally.

Concurrency is safe for the exactly-once guarantee because a record's immediate-write set
(sinks available when it was logged) and its replay set (sinks that become available later)
are disjoint regardless of which verify settles first;
 a unit test pins that with two sinks verifying at different speeds.

## Startup buffer is bounded and overflow is reported (2026-09-06)

Records logged before every sink has answered its verify wait in a startup buffer and replay once a sink becomes available.
That buffer had no cap,
 so a burst during the verify window claimed memory without limit;
 verify liveness bounded the window (`verifyTimeoutMs`) but not the volume.
The buffer now holds at most `STARTUP_BUFFER_CAP` records (10000,
 exported as a constant).
On overflow the oldest buffered record is dropped,
 because the newest records carry the context closest to whatever is being diagnosed,
 and once initialization completes one synthetic `warn` record naming the dropped count is written to every available sink,
 so the loss appears in the log stream itself instead of being silent.

The cap is a constant rather than a `createLogger` option.
The section "`flush()` has a deadline" recorded that a startup buffer cap knob had no measured trigger;
 that still holds for tuning it,
 while the bound itself is a safety property whose cost was measured on 2026-09-06 on the built artifact:
 a full buffer holds about 1.6 MiB of heap,
 a burst of the cap settles in about 3 ms,
 and bursts of ten and one hundred times the cap settle in about 20 ms and 150 ms (five runs each,
 lowest reported),
 so `Array.prototype.shift` on the full buffer stays linear under V8 and no ring buffer is needed.
When no sink survives verification the count is never written;
 the logger throws on the next call in that state,
 and a marker with nowhere to go has no consumer.
