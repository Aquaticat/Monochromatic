# Post-release verification track: module-logger

Status:
 proposal,
 not a release gate.
Rewritten on 2026-09-06 from the June plan after the owner reclassified that
plan as a historical reference by an unreliable narrator
(`doc/planning/module-logger-release.md`).
Nothing here blocks a publish;
 the release process is `doc/decision/npm-publishing.md`.

## What the June plan got wrong, so it is not repeated

- It predated the IndexedDB and localStorage sinks,
   the shared record buffer,
   and the bounded storage retries (2026-07-22),
   so its file map and sink inventory were stale.
- It proposed retiring a sink after ten consecutive failures.
   Every shipped sink swallows its own write errors,
   so the counter could never fire,
   and it reversed the 2026-06-14 decision in `DECISIONS.md` one day later.
   Dropped.
- It proposed four `createLogger` tuning options to serve a fuzz harness.
   Only `flushDeadlineMs` survived,
   because it has a consumer-facing reason (a slow but working backend).
- It claimed a single-argument `console.info` interprets `%s`.
   Measured false on the built artifact.
- It called the no-backend throw a defect at 102 unguarded call sites.
   The throw is reachable only through `createLogger` with sinks that all fail verification;
   the default logger always has the console sink.
   Kept,
   documented,
   tested.

## What already shipped (0.1.0)

- Console control-character neutralization (`src/sink/console-control-chars.ts`),
   with adversarial tests for malformed and partial sequences.
- `flush()` deadline via `flushDeadlineMs` (`DEFAULT_FLUSH_DEADLINE_MS`),
   with tests forcing the deadline for a wedged write,
   flush hook,
   and verify.
- Every unit test imports the built artifact through the package name;
   internals are exposed as underscore-prefixed entry exports.

## What shipped after 0.1.0 (pending release)

- Verify liveness (2026-09-06):
   every sink verifies concurrently under `verifyTimeoutMs` (`DEFAULT_VERIFY_TIMEOUT_MS`),
   with tests for a never-settling verify no longer starving later sinks and for the replay invariant under concurrency.
   The guard was shown to fail against the sequential,
   unbounded code before the fix was restored.
- Startup buffer bound (2026-09-06):
   pre-initialization records buffer under `STARTUP_BUFFER_CAP`,
   oldest dropped on overflow,
   one synthetic `warn` record naming the dropped count once every sink has answered.
   Measured on the built artifact:
   a full buffer holds about 1.6 MiB of heap and a burst one hundred times the cap settles in about 150 ms,
   so the drop path stays linear.
   The guard was shown to fail against the unbounded code before the fix was restored.
- Abandoned-write accounting (2026-09-06):
   two tests pin that a write the flush deadline abandoned may reject or resolve late without an unhandled rejection,
   with a late rejection reported once as a breadcrumb and the sink kept available for later writes.
   No code change was needed.
   The guard was shown to fail (the captured `late failure` rejection) when the tracked-write catch was stripped;
   that stripped run also exposed a harness gap,
   the file process dying on an older test before the new suite ran (#483).

## Open robustness items, in priority order

1.   Dynamic imports in the published artifacts.
     Both built entries carry `import('node:fs/promises')` and `import('node:path')` from the file sink's verify,
     and a browser consumer bundle inherits both,
     which is what users complain about.
     Lazy discovery would not remove them.
     Candidate:
     platform-split file sink selected through package `imports` conditions,
     guarded by a test that reads both artifacts and rejects any `import(`.
     See `DECISIONS.md`,
     "Open problem:
      import-time sink discovery".
2.   Deferred discovery for callers that never log.
     Still the reason `package/ssg/aquati.cat/src/build/compress.ts` defers its import on worker threads;
     separate from item 1 and unscheduled.

## Verification campaign (the toml-edit bar)

`package/module/toml-edit` has a budgeted property campaign,
 a model oracle,
 a committed coverage baseline,
 and a green CI workflow.
The logger differs:
 its bugs are timing and interleaving bugs,
 not input bugs,
 so the campaign needs a scheduler,
 not a grammar.

Deliverables,
 each a separate change with its own tests:

- `src/fuzz/fake-sink.ts`:
   a `Sink` driven by a behavior descriptor per hook (`verify`:
   true,
   false,
   reject,
   delayed,
   never;
   `write` and `flush` likewise) with a stable identity so a shrunk counterexample reads as
   `sink 2: verify delayed-true, write never, flush resolve`.
- `src/fuzz/model.ts`:
   a reference model predicting,
   per sink,
   the exact records received and whether `flush()` settles,
   for a given operation sequence and schedule.
- `src/fuzz/*.property.unit.test.ts`:
   `fast-check` properties for exactly-once delivery,
   startup replay exactly once,
   dropout on failed verify,
   write resilience,
   flush totality under the deadline,
   and a scheduler-driven stateful model covering verify-before-log,
   log-before-verify,
   interleaved flush,
   and never-settling work.
- Sink boundary properties:
   JSONL sinks round-trip every adversarial message through `JSON.parse`;
   the console sink never emits a forbidden control.
- A coverage-reachability gate and a path-filtered CI workflow mirroring `toml-edit-fuzz.yml`,
   only after the properties exist.

Rejected:
 a differential oracle against pino or winston (formats differ by design);
 a hostile `toString` message family (the API is string-only).

## Definition of done for this track

- Each open robustness item is either implemented with a test that failed before the change,
   or closed with a recorded reason in `DECISIONS.md`.
- The property files run in the package unit task in bounded mode and in a budgeted campaign task.
- Every counterexample found is pinned as an example or a corpus seed.
