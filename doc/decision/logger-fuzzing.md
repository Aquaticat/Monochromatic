# module-logger bulletproofing and fuzzing

## Status

Accepted,
 Phase 0 design only.
 Implementation pending.
Plan:
 `packages/module/logger/bulletproofing.plan.md`.

This doc records the owner decisions resolved during a design grilling.
 The plan
holds the phased work;
 this doc holds why each contract is what it is,
 the
options considered,
 and the rejected alternatives.

## Context

An assessment asked whether `@monochromatic-dev/module-logger` is bulletproof.
 It
is robust (clean orchestration,
 isolated sink factories,
 a passing unit suite)
but not bulletproof.
 Two findings stood out:
 `flush()` can hang forever on a
write that never settles,
 and a log call can throw when no backend is available.
The goal is to reach the verification bar already set by
`packages/module/toml-edit` (a budgeted property campaign,
 a strong model oracle,
a committed coverage-reachability gate,
 CI wiring,
 and this decision doc),
adapted for an async sink orchestrator rather than a pure transform.

The logger differs from toml-edit in one structural way that drives the whole
design:
 its bugs are timing and interleaving bugs,
 not input bugs.
 So the
toml-edit quality product gains a fourth factor,
 `scheduled(interleaving)`,
 and
`fast-check`'s `scheduler()` becomes the analog of toml-edit's grammar
arbitraries.

Two facts were measured during the grilling and ground the decisions below:

- The logger is imported at 102 sites across CLIs,
   servers,
   statusline,
   advisor,
  and stress tools,
   and no site guards a log call in `try`/`catch`.
   A throwing
  log line would crash unguarded callers.
- No color or escape sequences flow through the logger today.
   The color
  libraries in the repo (picocolors and similar) are used through raw `console`
  in `watch-restart` and `morph-compact`,
   which the `TLG` rule permits.

## Decision: failure stance

The logger is fail-safe with one breadcrumb.
 Log calls never throw.
 `flush()`
always resolves,
 never rejects and never hangs.
 Buffer overflow drops rather than
errors.
 A logger that finishes initialization with no available backend emits one
guarded raw-`console` warning at end of init,
 then discards.

This is the root decision;
 it sets the direction for the flush,
 no-backend,
 and
overflow contracts at once.
 The principle is to write the loud signal once,
 at a
boundary,
 never at a log call.

Options considered:

- Fail-safe with a breadcrumb (chosen).
   Never crashes a caller,
   and a
  misconfigured logger still surfaces once,
   near its cause.
- Fail-safe and fully silent.
   Rejected:
   a dead logger would be diagnosed only by
  the absence of logs,
   which wastes real debugging time.
   The breadcrumb costs
  almost nothing.
- Keep the fail-loud throw.
   Rejected:
   it throws at 102 unguarded sites,
  repeatedly,
   and far from the cause (a startup verify that found no backend).
  This is the exact non-bulletproof property the assessment flagged.

## Decision: flush deadline

One global deadline wraps the entire `flush()` body,
 the `await initPromise`,
 the
pending-write drain,
 and the flush-hook drain,
 using `withTimeout` from
`@monochromatic-dev/module-async-time` with its rejection swallowed so flush
resolves.
 Default 1000ms,
 overridable via a `createLogger` option.

`pendingWrites` holds bounded wrapper promises,
 never raw sink promises.
 Each
abandoned raw promise gets a rejection handler so a late settlement after the
deadline cannot become an unhandled rejection or corrupt sink availability.
Abandoned writes are dropped from the logger's view,
 not cancelled (the sinks
expose no `AbortSignal`).

Options considered:

- One global deadline (chosen).
   Tightest,
   simplest shutdown guarantee;
   `flush()`
  provably returns within one deadline;
   `withTimeout` implements it by wrapping
  the whole drain in one line;
   a hung verify cannot wedge flush either.
- Two-stage global deadline (writes under one deadline,
   hooks under another).
  Rejected:
   a looser 2x total bound for a fairness benefit that does not matter
  when both drains are best-effort.
- Per-write deadline.
   Rejected outright:
   N timers and a worst case of
  `timeout x writes` sequential accumulation.

The deadline bites only when work is actually stuck;
 normal writes settle in
single-digit milliseconds,
 so ordinary CLI shutdown is not delayed.
 `withTimeout`
clears its timer on settle,
 so a flush timer never keeps the process alive past
its window.

## Decision: verify liveness

`initialize()` runs verifiers concurrently with `Promise.all`,
 each bounded by a
per-verify timeout (default 1000ms,
 overridable).
 A timed-out verify counts as
unavailable.

The current code awaits verifiers sequentially,
 so one sink whose `verify()`
never resolves head-of-line blocks every later sink and `initialized` never
flips.
 The documented sequential order does not affect replay correctness (every
verified sink replays the full startup buffer),
 so concurrency is safe and
removes the blocking.

Options considered:

- Concurrent and bounded (chosen).
   One hung verify cannot starve the others;
   init
  completes within one bound;
   more interleaving for the scheduler to fuzz.
- Sequential and bounded.
   Rejected:
   a hung verify still delays every later sink
  by up to the bound;
   worst case is the sum of the per-verify bounds.
- Leave verify unbounded.
   Rejected:
   a single hung verify permanently stalls init,
  so steady-state logging reaches only the sinks that verified before it.

## Decision: stall and failure policy

A write or flush-hook timeout,
 a flush-hook rejection,
 and a write rejection are
all transient;
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

This removes the current inconsistency where a rejecting flush hook retires a
sink but a rejecting write does not,
 and it honors the documented "transient
errors stay transient" policy while still removing a backend that is persistently
broken.

Options considered:

- Transient with a retire threshold (chosen).
   Consistent with "only verify
  failure retires a sink,
  " but a backend that fails 10 times in a row without a
  single success is removed so flush stops paying for it.
- Pure transient (never retire on write or flush failures).
   The base of the
  chosen option;
   the threshold adds the only safeguard it lacked.
- Fatal (retire on the first flush failure).
   Rejected:
   contradicts the
  write-failure policy;
   a one-off `ENOSPC`,
   quota,
   or lock hiccup during flush
  would permanently kill a backend,
   the footgun `DECISIONS.md` warns against.
- Re-verify to decide.
   Rejected:
   verify has side effects (the file sink writes a
  probe and re-resolves its path;
   OPFS reopens a stream),
   so re-running it from
  inside flush is risky and could itself hang.

## Decision: startup overflow

A bounded ring buffer (default cap roughly 10,000 records,
 overridable) drops the
oldest record on overflow.
 When init completes and any were dropped,
 it emits one
synthetic record,
 `N startup records dropped before a backend verified`,
 so the
loss is never silent.

With verify now bounded,
 the pre-init window is roughly one second,
 so this is
mainly insurance against a high-rate burst in that window.

Options considered:

- Ring,
   drop oldest,
   plus a marker (chosen).
   Bounded memory,
   keeps the
  most-recent (usually most diagnostic) context,
   loss never silent.
- Drop newest,
   plus a marker.
   Rejected:
   loses the recent context right before
  backends came up,
   which is usually what explains a startup problem.
- Unbounded buffer.
   Rejected:
   a flood during the init window still grows memory
  with no ceiling,
   the one remaining unbounded path.

## Decision: console terminal-escape boundary

A linear-scan escape classifier (its own module,
 since `console.ts` is already
near the max-lines budget) allows only well-formed CSI SGR color sequences (`ESC
[` parameters,
 final byte `m`) and `\n` and `\t`,
 and neutralizes `ESC`,
 the C1
range,
 `DEL`,
 and other C0 controls as `\uXXXX`.
 The text is passed as
`console.x('%s', text)` so `util.format` cannot interpret `%`-specifiers in the
message.
 The classifier is a single linear pass,
 not a regex,
 per the `ITR` and
`RG2` rules.

The JSONL sinks (file,
 OPFS,
 sessionStorage) need no change here:
 `JSON.stringify`
already escapes control characters and newlines,
 which phase 4 proves with
adversarial inputs.

Options considered:

- Preserve SGR color,
   neutralize the rest (chosen).
   Keeps colored logs possible
  if any are ever routed through the logger,
   while blocking the dangerous escapes
  (clear screen,
   set title,
   write clipboard,
   spoof hyperlinks).
   Costs a correct
  escape-sequence classifier,
   tested against malformed and partial sequences.
- Neutralize everything (keep `\n` and `\t`).
   Simpler and no allowlist gaps,
   and
  loses nothing today since no color flows through the logger.
   The runner-up;
   the
  owner chose to keep the door open for colored logs.
- Pass raw with only the `%s` fix.
   Rejected:
   leaves the terminal-escape injection
  open;
   does not satisfy the `SYB` boundary rule at the sink.

Newlines stay literal in console output because multi-line logs (stack traces)
are core,
 and the persistent JSONL record is already forge-proof through
`JSON.stringify`,
 so newline-based log forging is a cosmetic console-only residue
rather than a record-integrity issue.

## Dependencies

- `fast-check`,
   already in the catalog at `>=4.8.0` and the established
  property-test tool for TypeScript packages in this repo.
   See
  `doc/decision/fast-check.md`.
- `@monochromatic-dev/module-async-time` is promoted from a logger devDependency
  to a runtime dependency for `withTimeout` and `wait`.
   Both are thin
  `setTimeout` wrappers that work in node and browser.
   `withTimeout` clears its
  timer on settle,
   so a flush or verify timer never keeps the process alive past
  its window.
   No new third-party dependency is added.

## Rejected alternatives

- A differential oracle comparing the logger against `pino` or `winston`.
   Their
  formats differ by design,
   so a disagreement would be noise,
   not signal.
   The
  conformance layer is the package's own output contract asserted exhaustively,
  plus a committed adversarial-message corpus.
- A hostile-`toString` message family.
   The log API is string-only;
   callers own
  serialization and no object reaches a sink.

## Reusable fuzz-target checklist

For the logger and any future async target,
 all six must hold before a campaign
is called strong:

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

## Deferred follow-up

Mutation testing,
 to measure oracle strength more directly,
 is deferred to a
separate plan,
 the same follow-up toml-edit recorded.
 File or update an issue for
it when the logger campaign lands.
