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

## Open robustness items, in priority order

1.   Verify liveness.
     `initialize()` awaits verifiers sequentially,
     so one sink whose `verify` never settles keeps `initialized` false forever and starves the later sinks.
     The flush deadline bounds shutdown but not steady-state delivery to sinks behind the stuck one.
     Candidate:
     concurrent verification with a per-verify bound;
     the replay invariant (immediate-write set and replay set are disjoint per record) must hold under concurrency.
2.   Startup buffer bound.
     Records logged before initialization accumulate without a cap.
     The Node init window is one filesystem probe,
     so no trigger has been observed;
     a bounded ring with a dropped-count marker is the candidate if one ever is.
3.   Abandoned-write accounting.
     After a deadline hit the logger clears its view of in-flight writes;
     the sinks keep working in the background.
     Worth a property that a late settlement never surfaces as an unhandled rejection.

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
