# Bulletproofing plan: module-logger

This is the source-of-truth plan for raising `@monochromatic-dev/module-logger`
to the verification standard already reached by
`packages/module/toml-edit/`. It fixes the correctness gaps an assessment
surfaced, then installs the repeatable method (budgeted property campaign,
strong model oracle, coverage-reachability gate, CI wiring, decision doc) so the
logger cannot regress to green-but-weak.

"Bulletproof" is shorthand. The concrete target is the toml-edit bar:
a discovered defect either gets fixed and pinned as a regression example, or it
is recorded as an owner decision. Nothing silently survives.

## The standard we are matching

Distilled from `packages/module/toml-edit/` (`HANDOVER.fuzzing.md`,
`mise.toml`, `coverage-baseline.json`, `docs/decisions/toml-edit-fuzzing.md`):

- A budgeted property-fuzz campaign: shared `fuzz-budget.ts` with a bounded
  mode for the normal suite and a time-budgeted campaign mode, `fast-check`
  properties in `*.property.unit.test.ts`, every discovered counterexample
  pinned as a `fast-check` `examples` entry.
- Grammar-complete generators split across `src/fuzz/arb-*.ts` for max-lines,
  structure-aware mutators, and a tiered corpus (committed fixtures plus
  campaign-only live discovery).
- Oracles stronger than no-crash: round-trip semantic equality, metamorphic
  invariance, a stateful model, and an external conformance suite.
- A deterministic V8 line-coverage reachability gate with a committed
  per-file `coverage-baseline.json`, a `fuzz:coverage` task that fails on any
  regression and refreezes with `--write`.
- Property files import the built package entry point, so a campaign builds
  first and a stale dist never hides a fix. Internal units are exposed through
  underscored seam exports when they need direct fuzzing.
- A path-filtered CI workflow (`.github/workflows/toml-edit-fuzz.yml`) running
  type-check, build, the bounded suite, a short fuzz smoke, conformance, and the
  coverage gate.
- A decision doc recording the method, dependency vetting, rejected
  alternatives, and a reusable fuzz-target checklist.

## Why the logger needs a different shape

toml-edit is a pure transform: text in, text out, no time, no side effects.
Its whole behavior is a function of its input, so a generator that covers the
grammar covers the behavior.

The logger is the opposite: a stateful async orchestrator fanning records to
side-effecting sinks, whose behavior depends on `Date.now()`, `queueMicrotask`,
promise settle order, verify timing, and the host runtime. Its bugs are timing
and interleaving bugs, not input bugs. The assessment's two real findings are
both timing-shaped (a flush that never settles, a throw that depends on verify
order), which an input-only generator would never reach.

So the toml-edit factor product gains a fourth factor:

```txt
reachable(generator) x scheduled(interleaving) x detectable(oracle) x present(target layer)
```

- `present(target layer)` is already good: the orchestration lives in
  `create-logger.ts` and the sinks are isolated factories, and the existing unit
  suite hits them directly.
- `detectable(oracle)` is the weak factor today. The current tests assert
  specific scenarios but have no reference model that predicts, for an arbitrary
  operation sequence, the exact records each sink should receive and whether
  flush settles. A model oracle is the core new asset.
- `reachable(generator)` is narrow today: hand-written sinks, fixed sequences.
- `scheduled(interleaving)` is absent: nothing explores verify, write, and flush
  orderings. `fast-check`'s `scheduler()` is the tool that makes async
  interleavings deterministic and is the logger analog of toml-edit's grammar
  arbitraries.

One structural advantage over toml-edit: `createLogger({ sinks })` already
takes an arbitrary sink list, so fake sinks need no production seam to inject.
The orchestrator is fuzzable as-is. Only the concrete sinks need a small amount
of host-global faking (console, `queueMicrotask`, `navigator.storage`,
`sessionStorage`, `FileSystemWritableFileStream`).

## Phase 0: fix the correctness gaps before scaffolding

The campaign asserts invariants the current code violates, so these land first;
otherwise phase 3 and phase 5 fail on day one against known defects rather than
new ones. Each is a finding from the prior assessment.

### Gap A: `flush()` can hang forever (must fix)

`drainPendingWrites` (`src/create-logger.ts`) awaits
`Promise.all([...pendingWrites])`. A tracked write leaves the set only when it
settles, and `trackWrite`'s catch fires on rejection, not on a promise that
stays pending. A sink `write` (or a sink `flush` hook) whose underlying call
never resolves, a stuck mount or full-disk `appendFile`, a wedged OPFS queue,
leaves `flush()` awaiting forever. The documented shutdown path is
`await logger.flush()`, so the process never exits cleanly. There is no timeout
or `AbortController` anywhere.

Fix direction: bound every tracked write and every sink flush hook with a
timeout race, using `wait()` from `@monochromatic-dev/module-async-time` (already
a devDependency, promoted to a dependency here) rather than a hand-rolled
`new Promise`. `flush()` resolves when all tracked work settles or its bound
elapses, never later. The per-write bound and the on-timeout policy are owner
decisions (see Decisions needed). This is the primary bulletproofing fix.

Deliverables:

- A bounded-settle helper in `src/create-logger.ts` wrapping each entry in
  `pendingWrites` and each `flush` hook.
- A decision-doc entry recording the bound, the on-timeout behavior, and why a
  logger flush must be total.

Pass criteria:

- A property in phase 5 with a fake sink whose `write` never resolves proves
  `flush()` settles within the bound rather than hanging the harness.

### Gap B: a log call can throw (owner decision, then implement)

`logAtLevel` throws `Error('No logging backends available')` once initialized
with zero available sinks. Near-unreachable for the default logger (only if
console verify fails: no `console.debug` or no `queueMicrotask`), but reachable
via `createLogger` with an all-failing sink list. A diagnostic line becoming a
synchronous exception is the sharpest non-bulletproof property, because callers
assume logging never throws.

This is a genuine design choice with several valid answers, so it is an owner
decision (see Decisions needed), not a unilateral change. Whichever option is
chosen, phase 3 pins it as an asserted invariant so the behavior is exact and
intentional rather than incidental.

### Gap C: pre-init records can vanish silently (small fix)

Records logged before initialization buffer in `startupRecords`; if no sink ever
verifies available, `initialize()` clears the buffer and those records are lost
with no output and no throw, while later calls throw. Decide one consistent
no-backend contract (drop both, or signal both) and bound the startup buffer so
a flood before a slow verify cannot grow memory without limit. Phase 3 asserts
the chosen contract.

## Phase 1: campaign scaffold

Mirror toml-edit's scaffold, package-local.

Deliverables:

- `src/fuzz-budget.ts` with `LOGGER_FUZZ_BUDGET_MS`, `fuzzRunPlan`, and
  `isCampaignMode`, copied from toml-edit's shape (bounded mode runs a fixed
  count, campaign mode runs to a per-property time budget with interrupt-and-shrink).
- `mise.toml` tasks the package is currently missing: `test:unit` (extends the
  shared task), `buildAndTest`, `fuzz` (`--budget`, default 60000, builds the
  bundle first then runs every `src/**/*.property.unit.test.ts` under node), and
  later `fuzz:coverage`. Add `fast-check: catalog:` to devDependencies.
- `src/fuzz/smoke.property.unit.test.ts` importing the built entry point and
  proving bounded and campaign mode both run under node.
- The seed and counterexample policy from `docs/decisions/fast-check.md`: random
  seeds in both modes, every discovered counterexample pinned as `examples`.

Pass criteria:

- `mise run //packages/module/logger:test:unit` passes (the suite currently runs
  only via the root task with explicit file paths; this gives the package its
  own task).
- `mise run //packages/module/logger:fuzz --budget 1000` exits cleanly.

## Phase 2: fake-sink toolkit, generators, and the model oracle

This is the heart of the logger campaign and has no direct toml-edit analog.

Deliverables under `src/fuzz/`, split for max-lines:

- `fake-sink.ts`: a configurable `Sink` whose `verify`, `write`, and optional
  `flush` are driven by a behavior descriptor (resolve true or false, reject,
  delay by N microtasks or ticks, never settle) and which records every received
  `LogRecord` in arrival order. This is the observable surface the oracle checks.
- `host-fakes.ts`: installable and restorable fakes for `console` (capturing
  per-method calls), `queueMicrotask`, `process.env`/`process.argv`,
  `navigator.storage` plus a `FileSystemWritableFileStream` stub, and
  `sessionStorage`, so console, OPFS, and sessionStorage sink logic is reachable
  and observable under node without a browser.
- `arb-operations.ts`: arbitraries for log operations (the six levels crossed
  with a message-family arbitrary), flush operations, and runtime-environment
  matrices (console present or absent, `queueMicrotask` present or absent,
  `DEBUG`, `WARN`, `--verbose`, browser-like or node).
- `arb-sink-config.ts`: arbitraries for sink lists, each entry a behavior
  descriptor, including the empty list and all-failing lists.
- `arb-messages.ts`: adversarial message families for the security boundary
  (newlines, ` `/` `, lone surrogates, control characters below
  U+0020, `"`, `\`, `*/`, ANSI and terminal escape sequences, `%s`-style format
  specifiers, NUL, very long strings, empty string, full unicode).
- `model.ts`: a reference model of the orchestrator. Given an operation sequence
  and a sink-config plus a resolved schedule, it predicts, per sink, the exact
  multiset and order of records that sink must receive, whether each log call
  throws, and whether `flush()` settles. The model encodes the documented
  contract: exactly-once delivery to each available sink, order preserved per
  sink, startup replay exactly once, drop only on verify failure, throw only per
  the Gap B decision, flush total per the Gap A fix.

Pass criteria:

- Every arbitrary family above has at least one deterministic `examples` value.
- The fake sink and host fakes restore global state after each property so files
  do not leak console or storage stubs into the rest of the suite.

## Phase 3: orchestrator properties

Target: `src/create-logger.ts`, the replay, dropout, throw, and flush machinery.

Properties:

- Totality and no-throw-except-documented: for any operation sequence and
  sink-config, no log call throws except exactly when the Gap B contract says it
  must.
- Exactly-once delivery: every available sink receives each post-availability
  record once, with no duplicate and no drop, in log order.
- Startup replay exactly once: a record logged before a late-verifying sink
  becomes available is replayed to that sink once and only once, and a record
  logged after it is available is delivered immediately and never re-replayed.
  This guards the disjoint immediate-write and replay sets the assessment
  verified by hand.
- Dropout: a sink whose `verify` resolves false or rejects receives no records;
  a sink whose `flush` hook rejects is marked unavailable and does not fail the
  aggregate flush.
- Write resilience: a rejecting or synchronously-throwing `write` does not retire
  the sink (the documented policy), and the sink keeps receiving later records.
- Flush totality: `flush()` settles for every sink-config, including a config
  with a never-settling write or flush hook (the Gap A regression).

Pass criteria:

- The model from phase 2 is the oracle for every property above.
- Each prior assessment finding has a property that fails against the
  pre-Phase-0 code and passes after the fix.

## Phase 4: sink properties, including the security boundary

Each concrete sink gets properties over its own logic, using the host fakes.

- console (`src/sinks/console.ts`): contiguous same-level runs collapse to one
  `console.*` call and level transitions split (the `groupRuns` invariant);
  verbose gating drops debug and trace unless `DEBUG`, `--verbose`, or browser;
  `WARN=false` drops warn; each level routes to its mapped method; a missing or
  non-callable `console.*` never throws; the formatted line is exactly
  `[level] [iso] message`.
- file (`src/sinks/file.ts`): `findNodeModulesUp` finds the nearest ancestor and
  returns the sentinel when none exists, over generated path trees; the non-node
  guard short-circuits; a rejecting `appendFile` is swallowed; concurrent appends
  of small JSONL lines do not interleave mid-line.
- opfs (`src/sinks/opfs.ts`): verify round-trips a probe; concurrent writes to
  the kept-open `FileSystemWritableFileStream` serialize in order and never
  throw a locked-stream error. The spec confirms the convenience `write()`
  acquires and releases a writer per call so the stream queue serializes; this
  property asserts that behavior against the fake stream rather than trusting the
  reading.
- sessionStorage (`src/sinks/session-storage.ts`): keys increment and namespace
  correctly; a throwing `setItem` (quota full) is swallowed; verify round-trips.
- noop (`src/sinks/noop.ts`): always available, discards, exposes no flush.

Security-boundary properties (the SYB and STB rules in AGENTS.md make these
mandatory, not optional):

- JSONL destinations (file, opfs, sessionStorage): for every adversarial message
  family, each emitted line is valid JSON and `JSON.parse` of it deep-equals the
  source record. No message content can terminate the line or corrupt the next.
- console destination: assert the handling of terminal escape sequences and
  `%s`-style format specifiers in messages. The console sink currently passes the
  raw message to `console.*`, so a message containing terminal control codes can
  drive the terminal. Whether to neutralize terminal escapes at the console sink
  is an owner decision (see Decisions needed); the property pins whatever
  contract is chosen.

Pass criteria:

- Every sink file has at least one property block.
- The coverage gate (phase 7) shows each sink file exercised.

## Phase 5: stateful model and scheduler interleaving

This layer is where logger bugs actually live, so it is load-bearing.

Deliverables:

- `src/fuzz/stateful.property.unit.test.ts`: drive `createLogger` with a
  generated fake-sink list and a `fast-check` `scheduler()` that controls the
  order in which verify resolutions, write settlements, and flush hooks
  interleave. Generated command sequences mix log calls at random levels, flush
  calls at random points, and sink-behavior events (verify resolves, write
  settles or rejects, write never settles). The phase 2 model, advanced under the
  same schedule, is the oracle for per-sink received records and for flush
  settlement.
- Idempotence and ordering invariants checked after each scheduled point, not
  only at the end.

Pass criteria:

- The schedule generator explores verify-before-log, log-before-verify, and
  interleaved-flush orderings, named explicitly so a regression in one ordering
  surfaces rather than hides behind a lucky default schedule.
- A never-settling write under any schedule still lets `flush()` settle within
  the bound.

## Phase 6: format and contract conformance

The logger has no upstream spec suite the way toml-edit has toml-test, so this
layer is internally defined and the plan says so plainly: there is no external
oracle here, only the package's own output contract asserted exhaustively.

Deliverables:

- A conformance property set asserting the stable output contracts: the console
  line shape `[level] [iso] message` where the ISO segment parses back to the
  record timestamp; the JSONL record shape round-tripping through `JSON.parse` to
  the exact `LogRecord`; the level-to-`console.*` mapping; the verbose and
  `WARN=false` gating truth table.
- A committed adversarial-message corpus under `src/fuzz/` (the families from
  phase 2) so the boundary cases are fixed regression seeds, the logger analog of
  toml-edit's committed fixture corpus.

A differential oracle (compare against `pino` or `winston`) is a non-goal: their
formats differ by design, so a disagreement would be noise, not signal. Recorded
as rejected in the decision doc.

Pass criteria:

- The contract properties run in the bounded suite and the campaign.
- Every adversarial corpus entry is asserted to round-trip or to be neutralized
  per the chosen console-escape contract.

## Phase 7: V8 coverage reachability gate

Mirror toml-edit's deterministic gate.

Deliverables:

- `src/fuzz/coverage-driver.ts` importing the package source (not the bundle),
  replaying the generators, the adversarial corpus, every sink behavior, and the
  default logger path through `createLogger` at a fixed seed under
  `NODE_V8_COVERAGE`, with the host fakes installed so console, OPFS, and
  sessionStorage sink lines are reachable under node.
- A reader and a report that project V8 block ranges to per-file covered lines
  and fail on any per-file regression from `coverage-baseline.json`, split across
  helper files for max-lines.
- A `fuzz:coverage` task (`--write` refreezes), no build needed.
- An explicit, documented exclusion list for lines only reachable in a real
  browser if the host fakes cannot reach them, so the gate never silently counts
  a browser-only branch as covered. The browser-real paths stay covered by the
  existing `*.browser.test.ts` suite.

Pass criteria:

- The gate fails on a deliberately removed property and passes on the full
  campaign.
- The covered set is saturated across seeds and run counts before the baseline is
  frozen (the toml-edit saturation check).

## Phase 8: CI, decision doc, and reusable checklist

Deliverables:

- `.github/workflows/logger-fuzz.yml`, path-filtered to
  `packages/module/logger/**` and the decision doc, running type-check, build,
  the bounded unit suite, a short total-budget fuzz smoke (not 60 seconds per
  property), and the coverage no-regression gate. Use the package tasks, not raw
  node pasted into workflow logic. Prove the path filter with a real run.
- `docs/decisions/logger-fuzzing.md` recording the method, the `fast-check` and
  `module-async-time` dependency decisions, the rejected differential oracle, the
  Gap A, B, and C owner decisions and their resolutions, and the reusable
  fuzz-target checklist.
- The checklist requires, for the logger and any future async target, the five
  toml-edit questions plus a sixth for the new factor:
  - Is the tested layer where the logic and bugs live?
  - Are all entry points, sinks, and seams covered?
  - Is every oracle a reference model, not no-crash or returns-a-string?
  - Do generators cover the full operation and message grammar and boundary cases?
  - Are real corpus seeds, counterexamples, and coverage feedback wired in?
  - Does the schedule generator explore the async interleavings where timing bugs
    live, including never-settling work?

Pass criteria:

- Local verification passes for: `lint:types`, `test:unit`, `fuzz --budget 60000`,
  and `fuzz:coverage`.
- CI path filtering is proven by an actual run before the work is called done.

## Decisions needed

These are non-measurable design choices with more than one valid answer. They
are owner decisions; the plan records a recommendation but does not presume it.

- Gap A on-timeout policy: when a bounded write or flush hook exceeds its bound,
  does `flush()` resolve and leave the sink available (treat the stall as a
  transient write hiccup, consistent with the write-failures-do-not-disable
  policy), or mark the sink unavailable? Recommendation: resolve flush, keep the
  sink available, emit one internal `console.error`, since a single slow write
  should not retire a backend. Also choose the default bound (recommendation: a
  few seconds, overridable).
- Gap B no-backend contract: keep the fail-loud throw, never throw and drop
  silently, or never throw from log calls and move the assertion to an explicit
  readiness check. Recommendation: keep the throw for `createLogger` callers who
  opt into a custom sink list, but guarantee the default `logger` never throws
  because it always includes a console sink whose verify cannot fail in a sane
  runtime. Stated as an invariant and pinned by a property either way.
- Gap C no-backend startup contract: drop pre-init records silently or surface
  them on the first post-init failure. Recommendation: make it consistent with
  Gap B and bound the startup buffer.
- Console terminal-escape contract: pass messages through raw (status quo, fast,
  but a terminal-escape injection vector per SYB), or neutralize control and
  escape sequences at the console sink. Recommendation: neutralize, since a log
  message is attacker-influenceable data crossing into the terminal grammar.

## Definition of done

- Phase 0 fixes are landed and each has a property that failed before and passes
  after.
- The logger has property coverage across all six levels, the full message
  boundary grammar, every sink, the orchestrator replay and dropout and flush
  machinery, and scheduled async interleavings.
- The oracle set includes the reference model, the round-trip and format
  contract, the stateful model, and the security-boundary properties.
- The normal suite runs bounded properties; `fuzz` runs a budgeted campaign;
  `fuzz:coverage` reports and gates per-file coverage from a committed baseline.
- Every counterexample from the campaign is fixed in scope and pinned as an
  `examples` entry or a corpus seed; deeper defects get a tracked issue.
- `docs/decisions/logger-fuzzing.md` records the method, the dependency and
  oracle decisions, the resolved owner decisions, and the reusable checklist.
- CI runs the logger fuzz smoke and coverage gate for relevant changes.

## Target reference

Public entry points from `src/index.ts`:

- `createLogger`
- `logger` and `initPromise`
- `tagged`
- `sinks.createConsoleSink`, `createFileSink`, `createOpfsSink`,
  `createSessionStorageSink`, `createNoopSink`
- `findNodeModulesUp` and `NO_NODE_MODULES_FOUND` (already exported)

Seams needing direct properties or named coverage blocks:

- `src/create-logger.ts` (replay, dropout, throw, flush, pending-write tracking)
- `src/sinks/console.ts` (`groupRuns`, verbose detection, WARN gating, batching)
- `src/sinks/file.ts` (`findNodeModulesUp`, verify round-trip, write guard)
- `src/sinks/opfs.ts` (verify, kept-open stream, concurrent write ordering)
- `src/sinks/session-storage.ts` (key counter, quota handling)
- `src/tagged.ts` (root-first composition, deep nesting)

No production seam export is needed for the orchestrator: `createLogger` already
accepts an arbitrary sink list, so fake sinks inject without widening the API.
Any future need for an internal helper in a property uses an underscored seam
export, following the toml-edit convention.

## Evidence checked

This plan was sharpened against current repository state, not memory:

- `packages/module/toml-edit/HANDOVER.fuzzing.md`, `mise.toml`,
  `coverage-baseline.json`, and `package.json` define the standard being matched.
- `packages/module/toml-edit/src/fuzz-budget.ts` is the bounded-versus-campaign
  shape to copy.
- `fast-check` is in the catalog at `>=4.8.0` (`pnpm-workspace.yaml`), so the
  dependency is available.
- `docs/decisions/` already hosts the `*-fuzzing.md` family (`toml-edit-fuzzing.md`,
  `file-enforcer-fuzzing.md`, `forbidden-strings-fuzzing.md`, `fast-check.md`), so
  `logger-fuzzing.md` follows the established placement.
- `.github/workflows/toml-edit-fuzz.yml` is the path-filtered workflow template.
- The logger `mise.toml` currently lacks `test:unit`, `buildAndTest`, `fuzz`, and
  `fuzz:coverage`; the suite runs only through the root task with explicit file
  paths, so the package needs its own tasks.
- `wait()` from `@monochromatic-dev/module-async-time` is already a logger
  devDependency, so the Gap A bounded-settle fix needs no new utility.
- The WHATWG File System Standard defines `FileSystemWritableFileStream.write()`
  as acquire-writer, enqueue-chunk, release-writer, so concurrent writes serialize
  through the stream queue; the phase 4 OPFS property asserts this rather than
  assuming it.
