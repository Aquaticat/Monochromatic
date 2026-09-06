# module-logger verification campaign

## Status

Campaign in progress.
The Node orchestration layer landed on 2026-09-06 in the sidecar package `package/module/logger.fuzz`.
Sink boundary properties,
 the coverage-reachability gate,
 the CI workflow,
the toml-edit sidecar migration,
 and the Playwright browser layer follow in that order.
Plan,
 grill records,
 and landed commits:
 `package/module/logger/bulletproofing.plan.md`.
Per-contract design rationale:
 `package/module/logger/DECISIONS.md`.

This document is the decision record for how `@monochromatic-dev/module-logger` is verified,
rewritten on 2026-09-06 from the June design-only record.
The June contracts that the shipped code reversed are listed under "Superseded decisions" so the history stays readable.

## Context

The goal is the verification bar `package/module/toml-edit` already meets:
a budgeted property campaign,
 a reference-model oracle,
 a committed coverage-reachability gate,
a path-filtered CI workflow,
 and a decision record.
The logger differs from a parser in one structural way that drives the whole design:
its bugs are timing and interleaving bugs,
 not input bugs.
So the generator is a scheduler over sink hook settlements,
 not a grammar,
and every oracle is a reference model of the orchestration contract.

Two facts measured before the campaign shaped it:
the logger is imported at 102 sites in this repository and no site guards a log call,
and no colour or escape sequence flows through the logger today.

## Decision: sidecar package

The campaign lives in `package/module/logger.fuzz`,
 a private workspace package,
the convention `jsonc-edit.fuzz` and `css-edit.fuzz` set.
The runtime package's `src` stays pure production code and ships in the tarball;
`fast-check`,
 the scripted fake sinks,
 the reference model,
 the properties,
the run-budget tooling,
 and the coverage gate never publish.
Every property file imports the built runtime artifact through the package name,
never the runtime package's source,
 so the suite crosses the consumer boundary.
The sidecar's `fuzz` task rebuilds the runtime package first for that reason.

The toml-edit campaign,
 which still lives inside its runtime package under `src/fuzz/`,
migrates into `package/module/toml-edit.fuzz` after the logger campaign,
 copying this layout.

## Decision: scheduler, not grammar

Interleavings come from fast-check's `scheduler()`.
Every fake-sink hook settlement (verify,
 write,
 flush) is a scheduled task,
so the scheduler decides the order in which outcomes reach the logger,
and a shrunk counterexample names the exact release order.
Never-settling work is a promise the scheduler never releases.

The logger's own timers stay real.
Deadline properties therefore use short real deadlines and bounded run counts
(`src/harness.ts`:
 verify timeout 25 ms,
 flush deadline 300 ms,
 a 60 ms tolerance below the deadline for the "settled within" verdict).
Faking timers was rejected:
 `withTimeout` and the sinks share the same clock,
and a faked clock would prove nothing about the real deadline path.

## Decision: scripted fake sinks

A fake sink (`src/fake-sink.ts`) is driven by one script per hook.
Each script is a per-call outcome sequence with a repeating tail:
verify outcomes are resolve-true,
 resolve-false,
 reject,
 throw synchronously,
 or never;
write and flush outcomes are resolve,
 reject,
 throw synchronously,
 or never;
flush may be absent.
Every sink carries a stable index,
 so a shrunk counterexample reads as
`sink 2: verify [resolve-true*] write [reject, resolve*] flush absent`.
Every scripted rejection gets its own rejection handler at creation,
because the scheduler holds rejected promises until released and an unhandled rejection would otherwise kill the test-file process.
A trace records every hook call and settlement with its call index,
 so the model can fold the observed order.

## Decision: reference model scope

`src/model.ts` predicts,
 per sink,
 the exact records attempted and delivered,
 in order,
 and the final availability;
whether each `flush()` settled within its deadline;
the dropped-count marker record after startup overflow;
and the count of `console.warn` breadcrumbs.
The "loud signal once,
 at a boundary" contract is therefore a checked invariant,
 not a comment.
Properties that stub `console.warn` run sequentially,
 the same rule the runtime package's breadcrumb suites follow.

## Decision: two run layers

The same `*.property.unit.test.ts` files run bounded in `test:unit`
(60 runs per property under a 60 s harness timeout)
and as a time-budgeted campaign through the sidecar `fuzz --budget <ms>` task,
keyed on `LOGGER_FUZZ_BUDGET_MS` (`src/fuzz-budget.ts`).
Campaign mode uses `interruptAfterTimeLimit` with an unbounded run count and a harness timeout of budget plus 30 s,
so fast-check owns the stop and still has room to shrink.

`interruptAfterTimeLimit` abandons the in-flight run rather than awaiting it.
An abandoned run's logger keeps firing timers into the next property's `console.warn` stub,
which surfaced as one extra verify-timeout breadcrumb that appeared only in campaign mode.
The harness tracks every in-flight run and `settleRuns()` is awaited after each `assert`,
so no run outlives its property.

## Landed: scheduled orchestration property

`src/orchestration.property.unit.test.ts` runs a random program of `log`,
 `release`,
 and `flush` steps
(weighted three to two to one,
 at most eight steps)
against a logger over one to four scripted sinks.
Two properties:

- The real sinks and the model agree on attempts,
   deliveries,
   flush verdicts,
   breadcrumb count,
   and whether a log call threw
  (exactly-once delivery,
   startup replay,
   dropout on failed verify,
   write resilience,
   flush totality,
   and the no-backend throw,
   in one oracle).
- Over always-available sinks,
   every record reaches every sink exactly once regardless of release order.

Guard-failure proof on 2026-09-06:
with the startup replay removed from `create-logger.ts` and the artifact rebuilt,
both properties fail and shrink to one sink and one log call;
restored and rebuilt,
 both pass.

Model defects the property found before the logger was ever wrong:

- A write that never settles keeps `flush()` in its write drain until the deadline,
   so no flush hook runs;
  the model had run the hooks anyway.
- A rejecting flush hook retires the sink (the shipped contract),
   so the always-available property restricts flush outcomes to resolve and never.

No logger defect has been found by this layer yet.
That is consistent with the three robustness changes having been built test-first the week before;
the campaign's value so far is that the contract is now executable.

## Superseded decisions

The June record fixed several contracts at design time;
 the shipped code reversed them.
Each is recorded in `package/module/logger/DECISIONS.md`.

- Failure stance:
   log calls never throw.
  Shipped:
   a log call throws `No logging backends available` once initialization has proven that no sink is available.
  The startup-buffer section of `DECISIONS.md` records why a marker with nowhere to go has no consumer;
  the no-backend throw is a property the campaign checks,
   not a bug it hunts.
- Flush deadline default 1000 ms and verify timeout default 1000 ms.
  Shipped:
   `DEFAULT_FLUSH_DEADLINE_MS` and `DEFAULT_VERIFY_TIMEOUT_MS` are 5000,
   each with a measured local settle time of a few milliseconds.
- Retire threshold of ten consecutive sink failures.
  Not shipped:
   a write rejection stays transient with one breadcrumb and a rejecting flush hook retires the sink,
  per "Write failures do not disable a sink;
   only verify failure does".
- Console boundary preserving well-formed SGR colour sequences.
  Shipped:
   every C0 control except newline and tab,
   DEL,
   and every C1 control is rendered as `\uXXXX`;
  the allowlist classifier was rejected because no in-repo call site passes colour through the logger.
- Startup buffer cap as a `createLogger` option.
  Shipped:
   `STARTUP_BUFFER_CAP` is an exported constant (10000),
   dropping oldest with a marker record.
- `@monochromatic-dev/module-async-time` promoted to a runtime dependency.
  Shipped:
   it stays a devDependency imported through its `/ts` subpath and inlined by the build;
  the published `dependencies` map is empty.

## Pending deliverables

- Sink boundary properties under Node:
  the file and sessionStorage sinks round-trip every adversarial message through `JSON.parse`,
  and the console neutralizer never emits a forbidden control.
- Coverage-reachability gate in the sidecar:
  a fixed-seed driver importing the runtime package's `/ts` source,
  a committed `coverage-baseline.json`,
   and a `fuzz:coverage` task mirroring `jsonc-edit.fuzz`.
- `.github/workflows/logger-fuzz.yml` mirroring `toml-edit-fuzz.yml`:
  build,
   `lint:types`,
   `test:unit`,
   `fuzz --budget 3000`,
   `fuzz:coverage`,
  path-filtered to the runtime package,
   the sidecar,
   and this document.
- The toml-edit sidecar migration.
- A Playwright browser property layer for the IndexedDB,
   OPFS,
   and localStorage sinks,
  one browser bundle of fast-check plus the neutral artifact loaded by the harness page.
  No workflow runs the browser suite today (it is a local podman run),
   so this lands last.

## Rejected alternatives

- A differential oracle comparing the logger against `pino` or `winston`:
  their formats differ by design,
   so a disagreement would be noise.
- A hostile `toString` message family:
   the log API is string-only,
   so no object reaches a sink.
- Fake timers:
   see "Decision:
   scheduler,
   not grammar".

## Reusable fuzz-target checklist

For the logger and any future async target,
 all six must hold before a campaign is called strong:

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
- Does the schedule generator explore the async interleavings where timing bugs live,
  including never-settling work?

## Deferred follow-up

Mutation testing,
 to measure oracle strength more directly,
 is deferred to a separate plan,
the same follow-up toml-edit recorded.
File or update an issue for it when the logger campaign lands.
