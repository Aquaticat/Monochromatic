# Bulletproofing plan: module-logger

This is the source-of-truth plan for raising `@monochromatic-dev/module-logger`
to the verification standard already reached by
`package/module/toml-edit/`.
 It fixes the correctness gaps an assessment
surfaced,
 then installs the repeatable method (budgeted property campaign,
strong model oracle,
 coverage-reachability gate,
 CI wiring,
 decision doc) so the
logger cannot regress to green-but-weak.

"Bulletproof" is shorthand.
 The concrete target is the toml-edit bar:
a discovered defect either gets fixed and pinned as a regression example,
 or it
is recorded as an owner decision.
 Nothing silently survives.

## Implementer notes: read this before touching code

Assume you have no prior context.
 This section is the orientation and the list of
traps.
 Read it fully before editing,
 then read Phase 0,
 then start.

### Where the code is

- `src/create-logger.ts`:
   the orchestrator.
   Verify,
   startup buffering and replay,
  per-sink availability,
   in-flight write tracking,
   `flush()`.
   Every Phase 0 fix
  except the console one lives here.
   This is the load-bearing file.
- `src/logger.ts`:
   builds the default `logger` by applying `createLogger` to the
  default sink set.
   Zero-config;
   it must stay zero-config.
- `src/tagged.ts`:
   wraps a logger to prepend a tag.
   It delegates to the wrapped
  logger's methods,
   so every fix in `create-logger.ts` automatically applies to
  tagged loggers.
   Do not duplicate logic here.
- `src/sink/console.ts`,
   `file.ts`,
   `opfs.ts`,
   `session-storage.ts`,
   `noop.ts`:
  the sinks.
   Only the console one changes in Phase 0 (the escape classifier).
- `src/types.ts`:
   `Logger`,
   `Sink`,
   `LogRecord`,
   `Level` types.
- `DECISIONS.md` (in this package) and `doc/decision/logger-fuzzing.md`:
   why the
  current and the new contracts are what they are.
   Read both before changing a
  contract.

### How to build, test, and lint (the commands are not obvious)

- This package has no `test:unit` mise task yet (Phase 1 adds it).
   Until then run
  a single test file directly with `node <file>`,
   or run the whole package suite
  through the repo root task with explicit file paths:
  `mise run //:test:unit package/module/logger/src/<file>.unit.test.ts`.
   Passing
  a bare directory to that task fails;
   it wants file paths.
- Never run `bun test`.
   It misreports under the `@monochromatic-dev/module-test`
  harness (the `CM4` rule).
   Use `node <file>` or the mise task.
- Type-check with `mise run //package/module/logger:lint:types` after every
  TypeScript edit (there is no automatic type-check).
- Lint with `mise run //package/module/logger:lint:oxlint`.
   Zero warnings is the
  bar,
   not zero errors.

### Do this first, before any fix

Add the tuning knobs to `createLogger` as optional parameters with named-constant
defaults:
 the global flush deadline,
 the per-verify timeout,
 the consecutive-
failure retire threshold,
 and the startup-buffer cap.
 Everything else in Phase 0
depends on them,
 and so does the future fuzz harness,
 because the property tests
must inject tiny deadlines (single-digit milliseconds) to force the timeout paths
deterministically.
 Without injectable deadlines you would be testing timeouts by
waiting whole seconds of real wall-clock,
 which is slow and flaky.
 The default
`logger` passes none of these and gets the defaults,
 so it stays zero-config.

### Order to implement Phase 0

1.  The `createLogger` options surface (above).
2.  Gap A flush deadline and the bounded-wrapper tracking.
3.  Gap A2 concurrent bounded verify.
4.  Gap A3 transient-with-retire failure counter.
5.  Gap B remove the throw.
6.  Gap C startup ring buffer and dropped-count marker.
7.  Gap D console escape classifier (a new sibling module under `src/sink/`).

Each step lands with a direct regression test that fails against the code before
the step and passes after.
 If a test passes before your change,
 it is not
testing your change;
 fix the test,
 not the feeling.

### Traps that will bite you

- `withTimeout` from `@monochromatic-dev/module-async-time` rejects when the
  deadline fires.
   `flush()` must resolve,
   never reject,
   so you must catch and
  swallow that rejection.
   If you forget,
   every flush that hits the deadline throws
  and you have reintroduced Gap B at the flush boundary.
- `pendingWrites` must hold the bounded wrapper promise,
   never the raw sink write
  promise.
   If you keep the raw promise and only race a timeout beside it,
   a write
  that never settles stays in the set forever and leaks,
   and a future flush can
  still observe it.
   Symptom:
   memory grows under a stalling sink,
   or flush slows
  over time.
- The raw sink promise you abandon at the deadline still settles later.
   Attach a
  rejection handler to it (a no-op catch) or a late rejection becomes an
  unhandled rejection that crashes the process or trips the test harness.
   This is
  the single most common timeout-race bug;
   the plan calls it out twice on purpose.
- Abandoned writes are not cancelled.
   The sinks have no `AbortSignal`.
   You drop
  them from the logger's view and move on;
   you do not try to stop them.
- The consecutive-failure counter counts every sink-level failure (write reject,
  write timeout,
   flush-hook reject,
   flush-hook timeout) and resets to zero on any
  success (a write that resolves,
   a hook that resolves).
   It is consecutive,
   not
  cumulative.
   Retire is permanent for the run and emits a breadcrumb.
   Do not retire
  on the first failure;
   that is the rejected "fatal" option.
- Switching verify from sequential to concurrent must not break replay-exactly-once.
  The invariant that makes the current code correct is that a record's
  immediate-write set (sinks already available) and its replay set (a sink the
  moment it becomes available) are disjoint.
   Concurrency changes verify timing,
   not
  that invariant,
   but the Phase 3 property must still pass.
   If you see a record
  delivered twice to one sink,
   you broke the disjointness.
- The console escape classifier must be a single linear pass over the string
  (the `ITR` and `RG2` rules),
   not a regex and not recursion.
   It lives in its own
  module because `console.ts` is already near the max-lines budget;
   do not inline
  it and do not raise the budget (the `MXL` rule forbids that).
   Test it against
  malformed input:
   a trailing lone `ESC`,
   an `ESC [` with no final byte,
   an
  unterminated OSC,
   nested `ESC`.
   A naive classifier passes those straight
  through,
   which is the hole you are closing.
- The breadcrumbs (dead-logger warning,
   dropped-count,
   stall,
   retire) use guarded
  raw `console`,
   wrapped in `try`/`catch`.
   The console sink itself may be the dead
  one,
   so you cannot route a breadcrumb through the logger.
   The `TLG` rule permits
  raw `console` for this kind of last-resort control output.

### Rules you must not break while editing this package

- Do not remove or quiet existing logging to "clean up" (the `LOG` rule).
   Add
  more logging at branch decisions and error paths;
   treat it as permanent.
- Production code uses tagged loggers,
   never raw `console.log`,
   except the guarded
  last-resort breadcrumbs above (the `TLG` rule).
- Do not raise,
   disable,
   or work around the max-lines budget.
   Split into sibling
  modules and re-export (the `MXL` rule).
- Throw and return early;
   never silently swallow an unexpected state except the
  documented per-sink write swallow (the `PP7` and `PP8` rules).
   The deliberate
  swallows in this package each carry a comment saying why;
   keep that discipline.

## The standard we are matching

Distilled from `package/module/toml-edit/` (`HANDOVER.fuzzing.md`,
`mise.toml`,
 `coverage-baseline.json`,
 `doc/decision/toml-edit-fuzzing.md`):

- A budgeted property-fuzz campaign:
   shared `fuzz-budget.ts` with a bounded
  mode for the normal suite and a time-budgeted campaign mode,
   `fast-check`
  properties in `*.property.unit.test.ts`,
   every discovered counterexample
  pinned as a `fast-check` `examples` entry.
- Grammar-complete generators split across `src/fuzz/arb-*.ts` for max-lines,
  structure-aware mutators,
   and a tiered corpus (committed fixtures plus
  campaign-only live discovery).
- Oracles stronger than no-crash:
   round-trip semantic equality,
   metamorphic
  invariance,
   a stateful model,
   and an external conformance suite.
- A deterministic V8 line-coverage reachability gate with a committed
  per-file `coverage-baseline.json`,
   a `fuzz:coverage` task that fails on any
  regression and refreezes with `--write`.
- Property files import the built package entry point,
   so a campaign builds
  first and a stale dist never hides a fix.
   Internal units are exposed through
  underscored seam exports when they need direct fuzzing.
- A path-filtered CI workflow (`.github/workflows/toml-edit-fuzz.yml`) running
  type-check,
   build,
   the bounded suite,
   a short fuzz smoke,
   conformance,
   and the
  coverage gate.
- A decision doc recording the method,
   dependency vetting,
   rejected
  alternatives,
   and a reusable fuzz-target checklist.

## Why the logger needs a different shape

toml-edit is a pure transform:
 text in,
 text out,
 no time,
 no side effects.
Its whole behavior is a function of its input,
 so a generator that covers the
grammar covers the behavior.

The logger is the opposite:
 a stateful async orchestrator fanning records to
side-effecting sinks,
 whose behavior depends on `Date.now()`,
 `queueMicrotask`,
promise settle order,
 verify timing,
 and the host runtime.
 Its bugs are timing
and interleaving bugs,
 not input bugs.
 The assessment's two real findings are
both timing-shaped (a flush that never settles,
 a throw that depends on verify
order),
 which an input-only generator would never reach.

So the toml-edit factor product gains a fourth factor:

```txt
reachable(generator) x scheduled(interleaving) x detectable(oracle) x present(target layer)
```

- `present(target layer)` is already good:
   the orchestration lives in
  `create-logger.ts` and the sinks are isolated factories,
   and the existing unit
  suite hits them directly.
- `detectable(oracle)` is the weak factor today.
   The current tests assert
  specific scenarios but have no reference model that predicts,
   for an arbitrary
  operation sequence,
   the exact records each sink should receive and whether
  flush settles.
   A model oracle is the core new asset.
- `reachable(generator)` is narrow today:
   hand-written sinks,
   fixed sequences.
- `scheduled(interleaving)` is absent:
   nothing explores verify,
   write,
   and flush
  orderings.
   `fast-check`'s `scheduler()` is the tool that makes async
  interleavings deterministic and is the logger analog of toml-edit's grammar
  arbitraries.

One structural advantage over toml-edit:
 `createLogger({ sinks })` already
takes an arbitrary sink list,
 so fake sinks need no production seam to inject.
The orchestrator is fuzzable as-is.
 Only the concrete sinks need a small amount
of host-global faking (console,
 `queueMicrotask`,
 `navigator.storage`,
`sessionStorage`,
 `FileSystemWritableFileStream`).

## Phase 0: fix the correctness gaps before scaffolding

The campaign asserts invariants the current code violates,
 so these land first;
otherwise phase 3 and phase 5 fail on day one against known defects rather than
new ones.
 Each is a finding from the prior assessment.
 The owner decisions that
shaped these fixes are resolved and recorded in
`doc/decision/logger-fuzzing.md`;
 this section states the resulting contracts.

### Failure stance (resolves the direction of every gap below)

The logger is fail-safe with one breadcrumb.
 Log calls never throw.
 `flush()`
always resolves,
 never rejects and never hangs.
 Buffer overflow drops rather
than errors.
 A logger that finishes initialization with no available backend
emits one guarded raw-`console` warning at end of init,
 then discards
subsequently.
 This stance is the root the rest of Phase 0 follows:
 write the
loud signal once,
 at a boundary,
 never at a log call.
 It is grounded in the 102
import sites across CLIs and servers,
 none of which guard log calls in
`try`/`catch`,
 so a throwing log line would crash unguarded callers.

### Gap A: `flush()` can hang forever (the primary fix)

`drainPendingWrites` (`src/create-logger.ts`) awaits
`Promise.all([...pendingWrites])`.
 A tracked write leaves the set only when it
settles,
 and `trackWrite`'s catch fires on rejection,
 not on a promise that
stays pending.
 A sink `write` (or a sink `flush` hook) whose underlying call
never resolves,
 a stuck mount or full-disk `appendFile`,
 a wedged OPFS queue,
leaves `flush()` awaiting forever.
 The documented shutdown path is
`await logger.flush()`,
 so the process never exits cleanly.

Resolved contract:

- One global deadline wraps the entire `flush()` body,
   including `await
  initPromise`,
   the pending-write drain,
   and the flush-hook drain,
   using
  `withTimeout` from `@monochromatic-dev/module-async-time` with its rejection
  swallowed so flush resolves rather than rejects.
   `flush()` provably returns
  within one deadline regardless of how many writes are in flight or whether a
  verify,
   write,
   or hook hangs.
   No per-write timers,
   so no `timeout x writes`
  accumulation.
- `pendingWrites` holds bounded wrapper promises,
   never raw sink promises.
   The
  abandoned raw promise gets a rejection handler so a late settlement after the
  deadline cannot become an unhandled rejection or corrupt sink availability.
  Abandoned writes are not forcibly cancelled (the sinks expose no
  `AbortSignal`);
   they are dropped from the logger's view.
- Default deadline 1000ms,
   overridable via a `createLogger` option.
   The deadline
  bites only when work is actually stuck;
   normal writes settle in single-digit
  milliseconds,
   so ordinary CLI shutdown is not delayed.
   The `withTimeout` timer
  is cleared on settle,
   so it does not keep the process alive between flushes.

### Gap A2: slow or hung `verify()` (concurrent and bounded)

`initialize()` currently awaits verifiers sequentially,
 so one sink whose
`verify()` never resolves head-of-line blocks every later sink and `initialized`
never flips.
 Resolved contract:
 run verifiers concurrently with `Promise.all`,
each bounded by a per-verify timeout (default 1000ms,
 overridable);
 a verify
that times out counts as unavailable.
 The documented sequential order does not
affect replay correctness,
 so concurrency is safe and removes the blocking.

### Gap A3: stall and failure policy (transient, with a retire threshold)

A write or flush-hook timeout,
 a flush-hook rejection,
 and a write rejection are
all transient:
 the sink stays available and `flush()` resolves.
 A per-sink
counter of consecutive sink-level failures retires the sink once it reaches a
threshold (default 10,
 overridable);
 any successful write or hook resets the
counter to zero.
 A threshold retire is permanent for the run and emits a
breadcrumb,
 matching a verify-failure retire.
 This removes the current
inconsistency where a rejecting flush hook retires a sink but a rejecting write
does not,
 and it honors the documented "transient errors stay transient" policy
while still removing a backend that is persistently broken.

### Gap B: a log call can throw (now: never throws)

`logAtLevel` throws `Error('No logging backends available')` once initialized
with zero available sinks.
 Under the fail-safe stance this is removed:
 log calls
never throw.
 A logger that initializes with no available backend discards and
relies on the end-of-init breadcrumb to surface the misconfiguration once.
 Phase
3 pins "no log call throws,
 ever" as an asserted invariant.

### Gap C: pre-init records dropping silently (bounded ring, with a marker)

Records logged before any sink verifies buffer in `startupRecords`;
 if the
buffer were unbounded a burst during the init window could grow memory without a
ceiling,
 and silent loss on a fully-dead logger is inconsistent with the stance.
Resolved contract:
 a bounded ring buffer (default cap ~10,000,
 overridable) that
drops the oldest record on overflow;
 when init completes and any were dropped,
emit one synthetic record,
 `N startup records dropped before a backend
verified`,
 so the loss is never silent.

### Gap D: console terminal-escape boundary (preserve SGR, neutralize the rest)

The console sink passes raw messages to `console.*`,
 so attacker-influenced log
data carrying terminal escapes (clear screen,
 set title,
 write clipboard,
 spoof
hyperlinks) drives the terminal,
 and `%`-specifiers in a single-arg
`console.log` are interpreted by `util.format`.
 Resolved contract:
 a linear-scan
escape classifier (its own module,
 since `console.ts` is already near the
max-lines budget) that allows only well-formed CSI SGR color sequences (`ESC [`
parameters,
 final byte `m`) and `\n` and `\t`,
 and neutralizes `ESC`,
 the C1
range,
 `DEL`,
 and other C0 controls as `\uXXXX`.
 The text is passed as
`console.x('%s', text)` so `util.format` cannot interpret `%`-specifiers in the
message.
 The JSONL sinks need no change here:
 `JSON.stringify` already escapes
control characters and newlines,
 which phase 4 proves.
 The classifier is a
single linear pass,
 not a regex (the `ITR` and `RG2` rules),
 and phase 4 tests
it against malformed and partial escape sequences.

## Phase 1: campaign scaffold

Mirror toml-edit's scaffold,
 package-local.

Deliverables:

- `src/fuzz-budget.ts` with `LOGGER_FUZZ_BUDGET_MS`,
   `fuzzRunPlan`,
   and
  `isCampaignMode`,
   copied from toml-edit's shape (bounded mode runs a fixed
  count,
   campaign mode runs to a per-property time budget with interrupt-and-shrink).
- `mise.toml` tasks the package is currently missing:
   `test:unit` (extends the
  shared task),
   `buildAndTest`,
   `fuzz` (`--budget`,
   default 60000,
   builds the
  bundle first then runs every `src/**/*.property.unit.test.ts` under node),
   and
  later `fuzz:coverage`.
   Add `fast-check: catalog:` to devDependencies.
- `src/fuzz/smoke.property.unit.test.ts` importing the built entry point and
  proving bounded and campaign mode both run under node.
- The seed and counterexample policy from `doc/decision/fast-check.md`:
   random
  seeds in both modes,
   every discovered counterexample pinned as `examples`.

Pass criteria:

- `mise run //package/module/logger:test:unit` passes (the suite currently runs
  only via the root task with explicit file paths;
   this gives the package its
  own task).
- `mise run //package/module/logger:fuzz --budget 1000` exits cleanly.

## Phase 2: fake-sink toolkit, generators, and the model oracle

This is the heart of the logger campaign and has no direct toml-edit analog.

Deliverables under `src/fuzz/`,
 split for max-lines:

- `fake-sink.ts`:
   a configurable `Sink` whose `verify`,
   `write`,
   and optional
  `flush` are driven by a behavior descriptor (resolve true or false,
   reject,
  delay by N microtasks or ticks,
   never settle) and which records every received
  `LogRecord` in arrival order.
   This is the observable surface the oracle checks.
- `host-fakes.ts`:
   installable and restorable fakes for `console` (capturing
  per-method calls),
   `queueMicrotask`,
   `process.env`/`process.argv`,
  `navigator.storage` plus a `FileSystemWritableFileStream` stub,
   and
  `sessionStorage`,
   so console,
   OPFS,
   and sessionStorage sink logic is reachable
  and observable under node without a browser.
- `arb-operations.ts`:
   arbitraries for log operations (the six levels crossed
  with a message-family arbitrary),
   flush operations,
   and runtime-environment
  matrices (console present or absent,
   `queueMicrotask` present or absent,
  `MONOCHROMATIC_VERBOSE`,
   `MONOCHROMATIC_WARN`,
   `--verbose`,
   browser-like or node).
- `arb-sink-config.ts`:
   arbitraries for sink lists,
   each entry a behavior
  descriptor,
   including the empty list and all-failing lists.
- `arb-messages.ts`:
   adversarial message families for the security boundary
  (newlines,
   ` `/` `,
   lone surrogates,
   control characters below
  U+0020,
   `"`,
   `\`,
   `*/`,
   ANSI and terminal escape sequences,
   `%s`-style format
  specifiers,
   NUL,
   very long strings,
   empty string,
   full unicode).
- `model.ts`:
   a reference model of the orchestrator.
   Given an operation sequence
  and a sink-config plus a resolved schedule,
   it predicts,
   per sink,
   the exact
  multiset and order of records that sink must receive,
   whether each log call
  throws,
   and whether `flush()` settles.
   The model encodes the documented
  contract:
   exactly-once delivery to each available sink,
   order preserved per
  sink,
   startup replay exactly once,
   drop only on verify failure,
   throw only per
  the Gap B decision,
   flush total per the Gap A fix.

Pass criteria:

- Every arbitrary family above has at least one deterministic `examples` value.
- The fake sink and host fakes restore global state after each property so files
  do not leak console or storage stubs into the rest of the suite.

## Phase 3: orchestrator properties

Target:
 `src/create-logger.ts`,
 the replay,
 dropout,
 throw,
 and flush machinery.

Properties:

- Totality and no-throw-except-documented:
   for any operation sequence and
  sink-config,
   no log call throws except exactly when the Gap B contract says it
  must.
- Exactly-once delivery:
   every available sink receives each post-availability
  record once,
   with no duplicate and no drop,
   in log order.
- Startup replay exactly once:
   a record logged before a late-verifying sink
  becomes available is replayed to that sink once and only once,
   and a record
  logged after it is available is delivered immediately and never re-replayed.
  This guards the disjoint immediate-write and replay sets the assessment
  verified by hand.
- Dropout:
   a sink whose `verify` resolves false or rejects receives no records;
  a sink whose `flush` hook rejects is marked unavailable and does not fail the
  aggregate flush.
- Write resilience:
   a rejecting or synchronously-throwing `write` does not retire
  the sink (the documented policy),
   and the sink keeps receiving later records.
- Flush totality:
   `flush()` settles for every sink-config,
   including a config
  with a never-settling write or flush hook (the Gap A regression).

Pass criteria:

- The model from phase 2 is the oracle for every property above.
- Each prior assessment finding has a property that fails against the
  pre-Phase-0 code and passes after the fix.

## Phase 4: sink properties, including the security boundary

Each concrete sink gets properties over its own logic,
 using the host fakes.

- console (`src/sink/console.ts`):
   contiguous same-level runs collapse to one
  `console.*` call and level transitions split (the `groupRuns` invariant);
  verbose gating drops debug and trace unless `MONOCHROMATIC_VERBOSE`,
   `--verbose`,
   or browser;
  `MONOCHROMATIC_WARN=false` drops warn;
   each level routes to its mapped method;
   a missing or
  non-callable `console.*` never throws;
   the formatted line is exactly
  `[level] [iso] message`.
- file (`src/sink/file.ts`):
   `findNodeModulesUp` finds the nearest ancestor and
  returns the sentinel when none exists,
   over generated path trees;
   the non-node
  guard short-circuits;
   a rejecting `appendFile` is swallowed;
   concurrent appends
  of small JSONL lines do not interleave mid-line.
- opfs (`src/sink/opfs.ts`):
   verify round-trips a probe;
   concurrent writes to
  the kept-open `FileSystemWritableFileStream` serialize in order and never
  throw a locked-stream error.
   The spec confirms the convenience `write()`
  acquires and releases a writer per call so the stream queue serializes;
   this
  property asserts that behavior against the fake stream rather than trusting the
  reading.
- sessionStorage (`src/sink/session-storage.ts`):
   keys increment and namespace
  correctly;
   a throwing `setItem` (quota full) is swallowed;
   verify round-trips.
- noop (`src/sink/noop.ts`):
   always available,
   discards,
   exposes no flush.

Security-boundary properties (the SYB and STB rules in AGENTS.
md make these
mandatory,
 not optional):

- JSONL destinations (file,
   opfs,
   sessionStorage):
   for every adversarial message
  family,
   each emitted line is valid JSON and `JSON.parse` of it deep-equals the
  source record.
   No message content can terminate the line or corrupt the next.
- console destination:
   assert the Gap D contract.
   Well-formed CSI SGR color
  sequences and `\n` and `\t` survive;
   `ESC`,
   the C1 range,
   `DEL`,
   and other C0
  controls are neutralized as `\uXXXX`;
   the classifier handles malformed and
  partial sequences (a trailing `ESC`,
   a `ESC [` with no final byte,
   an
  unterminated OSC,
   nested `ESC`) without throwing or passing the escape through.
  A separate property asserts that a `%`-bearing message reaches the terminal
  literally,
   proving the `console.x('%s', text)` shape blocks `util.format`
  specifier interpretation.

Pass criteria:

- Every sink has properties for verify,
   write,
   failure handling,
   host absence,
  and the format or security boundary where applicable,
   not merely one block per
  file.
- The coverage gate (phase 7) shows each sink file exercised.

## Phase 5: stateful model and scheduler interleaving

This layer is where logger bugs actually live,
 so it is load-bearing.

Deliverables:

- `src/fuzz/stateful.property.unit.test.ts`:
   drive `createLogger` with a
  generated fake-sink list and a `fast-check` `scheduler()` that controls the
  order in which verify resolutions,
   write settlements,
   and flush hooks
  interleave.
   Generated command sequences mix log calls at random levels,
   flush
  calls at random points,
   and sink-behavior events (verify resolves,
   write
  settles or rejects,
   write never settles).
   The phase 2 model,
   advanced under the
  same schedule,
   is the oracle for per-sink received records and for flush
  settlement.
- Idempotence and ordering invariants checked after each scheduled point,
   not
  only at the end.

Pass criteria:

- The schedule generator explores verify-before-log,
   log-before-verify,
   and
  interleaved-flush orderings,
   named explicitly so a regression in one ordering
  surfaces rather than hides behind a lucky default schedule.
- A never-settling write under any schedule still lets `flush()` settle within
  the bound.

## Phase 6: format and contract conformance

The logger has no upstream spec suite the way toml-edit has toml-test,
 so this
layer is internally defined and the plan says so plainly:
 there is no external
oracle here,
 only the package's own output contract asserted exhaustively.

Deliverables:

- A conformance property set asserting the stable output contracts:
   the console
  line shape `[level] [iso] message` where the ISO segment parses back to the
  record timestamp;
   the JSONL record shape round-tripping through `JSON.parse` to
  the exact `LogRecord`;
   the level-to-`console.*` mapping;
   the verbose and
  `MONOCHROMATIC_WARN=false` gating truth table.
- A committed adversarial-message corpus under `src/fuzz/` (the families from
  phase 2) so the boundary cases are fixed regression seeds,
   the logger analog of
  toml-edit's committed fixture corpus.

A differential oracle (compare against `pino` or `winston`) is a non-goal:
 their
formats differ by design,
 so a disagreement would be noise,
 not signal.
 Recorded
as rejected in the decision doc.

Pass criteria:

- The contract properties run in the bounded suite and the campaign.
- Every adversarial corpus entry is asserted to round-trip or to be neutralized
  per the chosen console-escape contract.

## Phase 7: V8 coverage reachability gate

Mirror toml-edit's deterministic gate.

Deliverables:

- `src/fuzz/coverage-driver.ts` importing the package source (not the bundle),
  replaying the generators,
   the adversarial corpus,
   every sink behavior,
   and the
  default logger path through `createLogger` at a fixed seed under
  `NODE_V8_COVERAGE`,
   with the host fakes installed so console,
   OPFS,
   and
  sessionStorage sink lines are reachable under node.
- A reader and a report that project V8 block ranges to per-file covered lines
  and fail on any per-file regression from `coverage-baseline.json`,
   split across
  helper files for max-lines.
- A `fuzz:coverage` task (`--write` refreezes),
   no build needed.
- An explicit,
   documented exclusion list for lines only reachable in a real
  browser if the host fakes cannot reach them,
   so the gate never silently counts
  a browser-only branch as covered.
   The browser-real paths stay covered by the
  existing `*.browser.test.ts` suite.

Pass criteria:

- The gate fails on a deliberately removed property and passes on the full
  campaign.
- The covered set is saturated across seeds and run counts before the baseline is
  frozen (the toml-edit saturation check).

## Phase 8: CI, decision doc, and reusable checklist

Deliverables:

- `.github/workflows/logger-fuzz.yml`,
   path-filtered to
  `package/module/logger/**` and the decision doc,
   running type-check,
   build,
  the bounded unit suite,
   a short total-budget fuzz smoke (not 60 seconds per
  property),
   and the coverage no-regression gate.
   Use the package tasks,
   not raw
  node pasted into workflow logic.
   Prove the path filter with a real run.
- `doc/decision/logger-fuzzing.md` recording the method,
   the `fast-check` and
  `module-async-time` dependency decisions,
   the rejected differential oracle,
   the
  Phase 0 owner decisions (stance,
   flush deadline,
   stall policy,
   verify liveness,
  startup overflow,
   console boundary) with their options and resolutions,
   and the
  reusable fuzz-target checklist.
- The checklist requires,
   for the logger and any future async target,
   the five
  toml-edit questions plus a sixth for the new factor:
  - Is the tested layer where the logic and bugs live?
  - Are all entry points,
     sinks,
     and seams covered?
  - Is every oracle a reference model,
     not no-crash or returns-a-string?
  - Do generators cover the full operation and message grammar and boundary cases?
  - Are real corpus seeds,
     counterexamples,
     and coverage feedback wired in?
  - Does the schedule generator explore the async interleavings where timing bugs
    live,
     including never-settling work?

Pass criteria:

- Local verification passes for:
   `lint:types`,
   `test:unit`,
   `fuzz --budget 60000`,
  and `fuzz:coverage`.
- CI path filtering is proven by an actual run before the work is called done.

## Resolved decisions

These were owner decisions with more than one valid answer;
 they are now
resolved and recorded in full,
 with options and rationale,
 in
`doc/decision/logger-fuzzing.md`.
 The resulting contracts are written into
Phase 0 above.
 In brief:

- Failure stance:
   fail-safe with one breadcrumb.
   Log calls never throw,
   `flush()`
  always resolves,
   overflow drops,
   a dead logger warns once at end of init.
- Flush deadline:
   one global deadline over the whole `flush()` body,
   default
  1000ms,
   overridable.
- Stall and failure policy:
   transient (keep the sink),
   with a per-sink retire
  after 10 consecutive sink-level failures,
   reset on any success.
- Verify liveness:
   concurrent and per-verify bounded,
   default 1000ms.
- Startup overflow:
   bounded ring,
   drop oldest,
   synthetic dropped-count marker,
  default cap ~10,000.
- Console boundary:
   preserve well-formed CSI SGR color,
   neutralize `ESC`,
   C1,
  `DEL`,
   and other C0 controls as `\uXXXX`,
   pass text via `console.x('%s', text)`.

Settled by default (clearly-dominant,
 no real tradeoff):
 `pendingWrites` holds
bounded wrappers with a rejection handler on each abandoned raw promise;
`@monochromatic-dev/module-async-time` is promoted to a runtime dependency;
 the
deadlines,
 verify timeout,
 retire threshold,
 and buffer cap are optional
`createLogger` parameters (named-constant defaults) so the fuzz harness can force
tiny deadlines deterministically;
 the model oracle is built in three layers (v1
synchronous,
 v2 async verify and replay,
 v3 scheduled writes and flush) each with
deterministic self-tests;
 public-contract properties import the built entry point
while seam and coverage tests import source;
 `tagged.ts` gets its own property
block;
 the flush deadline does not cancel abandoned writes,
 it only drops them
from the logger's view.

## Amendments folded in from the GPT Pro review

These refinements are accepted and apply to the phases named;
 they are recorded
here so the per-phase text stays readable while nothing is lost.

- Phase 2 fake sinks carry an explicit behavior descriptor per hook (`verify`:
  true,
   false,
   reject,
   delayed-true,
   delayed-false,
   never;
   `write`:
   resolve,
  reject,
   throw-sync,
   delay,
   never;
   `flush`:
   absent,
   resolve,
   reject,
   throw-sync,
  delay,
   never) plus a stable sink identity field so a shrunk counterexample
  reads as,
   for example,
   `sink 2: verify delayed-true, write never, flush
  resolve`.
   The adversarial message set has no hostile-`toString` family:
   the log
  API is string-only,
   so callers own serialization and no object reaches a sink.
- Phase 2 includes an early scheduler feasibility spike:
   one minimal property
  proving `fast-check`'s `scheduler()` can control the logger's verify,
   write,
  and flush interleavings (with the `queueMicrotask` host fake) before the full
  stateful suite is built,
   so the harness risk surfaces cheaply.
- Phase 2 fakes install through one disposable harness that restores globals in a
  `finally`,
   rejects nested installs,
   prints the active fake environment on a
  property failure,
   and has its own unit tests;
   every property asserts globals are
  restored afterward.
- Phase 3 states delivery as exactly-once write attempt (the `write` is invoked
  once per available sink),
   not successful persistence,
   since a rejected write is
  swallowed and does not retire the sink.
   Dropout is split:
   verify false or reject
  means never available;
   the threshold retire is the only path that removes an
  initially-available sink;
   a single write or flush failure does not.
- Phase 4 file-sink property weakens the cross-platform non-interleaving claim to
  the provable one:
   each `appendFile` call carries exactly one complete JSONL
  line.
   True ordering across concurrent appends is asserted only if the sink
  grows an internal write queue,
   recorded as an open option,
   not assumed.
- Phase 4 OPFS fake is adversarial:
   it fails the property if the sink ever holds
  two writers at once or writes after close,
   so the spec-serialized contract is
  enforced,
   not trusted.
   Phase 4 sessionStorage property asserts unrelated keys
  are never clobbered and a malformed pre-existing logger key does not break new
  writes.
- Phase 5 names concrete schedule classes the generator must cover:
   all verifies
  settle before the first log;
   logs precede any verify settling;
   one sink
  verifies,
   then a log,
   then another verifies;
   flush races verify;
   flush races a
  write rejection;
   flush races a never-settling write;
   a write resolves after the
  flush deadline.
   It adds a late-effect property:
   after flush times out and
  resolves,
   a late write settlement must not produce an unhandled rejection or
  corrupt sink availability.
- Phase 6 conformance injects the timestamp source (a fake `Date.now` or an
  injected clock) so the ISO round-trip property is deterministic rather than
  flaky around record-creation boundaries.
- Phase 7 baseline records both covered lines and intentionally uncovered lines
  with a reason (browser-only,
   host-fake-unreachable,
   or accepted dead),
   not a
  bare exclusion list,
   and copies toml-edit's V8 source-map handling so coverage
  maps to TypeScript source rather than emitted JS.
- Phase 8 CI path filter covers files that change logger behavior beyond
  `package/module/logger/**`:
   `pnpm-workspace.yaml`,
   the lockfile,
   shared mise
  and tsconfig config,
   the workflow file,
   the decision doc,
   and
  `package/module/async-time/**` now that it is a runtime dependency.
- The `module-async-time` promotion is recorded in the decision doc with its
  runtime impact:
   `wait` and `withTimeout` are thin `setTimeout` wrappers that
  work in node and browser,
   and `withTimeout` clears its timer on settle so a
  flush or verify timer never keeps the process alive past its window.

## Definition of done

- Phase 0 fixes are landed and each has a property that failed before and passes
  after.
- The logger has property coverage across all six levels,
   the full message
  boundary grammar,
   every sink,
   the orchestrator replay and dropout and flush
  machinery,
   and scheduled async interleavings.
- The oracle set includes the reference model,
   the round-trip and format
  contract,
   the stateful model,
   and the security-boundary properties.
- The normal suite runs bounded properties;
   `fuzz` runs a budgeted campaign;
  `fuzz:coverage` reports and gates per-file coverage from a committed baseline.
- Every counterexample from the campaign is fixed in scope and pinned as an
  `examples` entry or a corpus seed;
   deeper defects get a tracked issue.
- `doc/decision/logger-fuzzing.md` records the method,
   the dependency and
  oracle decisions,
   the resolved owner decisions,
   and the reusable checklist.
- CI runs the logger fuzz smoke and coverage gate for relevant changes.

## Target reference

Public entry points from `src/index.ts`:

- `createLogger`
- `logger` and `initPromise`
- `tagged`
- `sinks.createConsoleSink`,
   `createFileSink`,
   `createOpfsSink`,
  `createSessionStorageSink`,
   `createNoopSink`
- `findNodeModulesUp` and `NO_NODE_MODULES_FOUND` (already exported)

Seams needing direct properties or named coverage blocks:

- `src/create-logger.ts` (replay,
   dropout,
   throw,
   flush,
   pending-write tracking)
- `src/sink/console.ts` (`groupRuns`,
   verbose detection,
   MONOCHROMATIC_WARN gating,
   batching)
- `src/sink/file.ts` (`findNodeModulesUp`,
   verify round-trip,
   write guard)
- `src/sink/opfs.ts` (verify,
   kept-open stream,
   concurrent write ordering)
- `src/sink/session-storage.ts` (key counter,
   quota handling)
- `src/tagged.ts` (root-first composition,
   deep nesting)

No production seam export is needed for the orchestrator:
 `createLogger` already
accepts an arbitrary sink list,
 so fake sinks inject without widening the API.
Any future need for an internal helper in a property uses an underscored seam
export,
 following the toml-edit convention.

## Evidence checked

This plan was sharpened against current repository state,
 not memory:

- `package/module/toml-edit/HANDOVER.fuzzing.md`,
   `mise.toml`,
  `coverage-baseline.json`,
   and `package.json` define the standard being matched.
- `package/module/toml-edit/src/fuzz-budget.ts` is the bounded-versus-campaign
  shape to copy.
- `fast-check` is in the catalog at `>=4.8.0` (`pnpm-workspace.yaml`),
   so the
  dependency is available.
- `doc/decision/` already hosts the `*-fuzzing.md` family (`toml-edit-fuzzing.md`,
  `file-enforcer-fuzzing.md`,
   `forbidden-strings-fuzzing.md`,
   `fast-check.md`),
   so
  `logger-fuzzing.md` follows the established placement.
- `.github/workflows/toml-edit-fuzz.yml` is the path-filtered workflow template.
- The logger `mise.toml` currently lacks `test:unit`,
   `buildAndTest`,
   `fuzz`,
   and
  `fuzz:coverage`;
   the suite runs only through the root task with explicit file
  paths,
   so the package needs its own tasks.
- `wait()` from `@monochromatic-dev/module-async-time` is already a logger
  devDependency,
   so the Gap A bounded-settle fix needs no new utility.
- The WHATWG File System Standard defines `FileSystemWritableFileStream.write()`
  as acquire-writer,
   enqueue-chunk,
   release-writer,
   so concurrent writes serialize
  through the stream queue;
   the phase 4 OPFS property asserts this rather than
  assuming it.
