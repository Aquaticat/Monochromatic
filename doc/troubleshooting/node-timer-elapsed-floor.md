# Node.js 26.10.0 single timer wait does not establish a measured elapsed-time floor

## Symptom

The first-party Jev study runner stopped with
`AssertionError: Research pacing timer returned early`.
Its outer error was
`JevStudyStopped: Frozen Jev phase stopped; inspect retained evidence, with no automatic retry or expansion`.

The first two-source assessment completed in `1005.230366` ms,
with both HTTP responses accepted.
The next assessment had zero dispatched calls.
The failure was in the separate research-pacing gap,
not a Jev refusal or a five-second assessment-budget failure.
The exact failing gap was not retained because the assertion preceded its recording.
The original stopped result is preserved at private commit `9cb065a` in
`~/temp/agent/jev-native-qualification-2026-09-29`.

## Root cause

The caller assumed one timer wakeup established its independently measured minimum.
In the private study's frozen `run.mjs:33` to `37`:

```js
// ~/temp/agent/jev-native-qualification-2026-09-29/run.mjs
const gapStarted = performance.now();
await wait(study.plan.schedule.researchGapAfterCompletedPairMs);
const elapsedMs = performance.now() - gapStarted;
assert(elapsedMs >= study.plan.schedule.researchGapAfterCompletedPairMs, 'Research pacing timer returned early');
researchGaps.push({ beforeEntry: entry.id, elapsedMs, outsideAssessmentClock: true });
```

Node's documented contract does not supply that exact-timing guarantee.
At tag `v26.10.0`,
`doc/api/timers.md:274` to `277` states:

```text
# nodejs/node: doc/api/timers.md
The `callback` will likely not be invoked in precisely `delay` milliseconds.
Node.js makes no guarantees about the exact timing of when callbacks will fire,
nor of their ordering.
```

The source clone is `~/temp/agent/node-timer-floor-2026-09-29`,
commit `151845ab90d3926ceb36eedf1eade09619c3adc9`.
No upstream source or build was modified or executed.

The promise API uses the same timer machinery.
`lib/timers/promises.js:80` to `81`:

```js
// nodejs/node: lib/timers/promises.js
const timeout = new Timeout(resolve, after, [value], false, ref);
insert(timeout, timeout._idleTimeout);
```

`lib/internal/timers.js:426` to `430` records an integer-millisecond timer origin:

```js
// nodejs/node: lib/internal/timers.js
function insert(item, msecs, start = binding.getLibuvNow()) {
  // Truncate so that accuracy of sub-millisecond timers is not assumed.
  msecs = MathTrunc(msecs);
  item._idleStart = start;
```

The matching release's `src/env.cc:1822` to `1827` reads libuv's clock:

```cpp
// nodejs/node: src/env.cc
uint64_t Environment::GetNowUint64() {
  uv_update_time(event_loop());
  uint64_t now = uv_now(event_loop());
  CHECK_GE(now, timer_base());
  now -= timer_base();
  return now;
}
```

Its Unix implementation,
`deps/uv/src/unix/internal.h:467` to `470`,
uses millisecond precision:

```c
// nodejs/node: deps/uv/src/unix/internal.h
UV_UNUSED(static void uv__update_time(uv_loop_t* loop)) {
  /* Use a fast time source if available.  We only need millisecond precision.
   */
  loop->time = uv__hrtime(UV_CLOCK_FAST) / 1000000;
```

This explains why the caller must not turn timer scheduling into a high-resolution elapsed-time proof.
The requested delay was already the integer `4000`;
truncating a fractional requested delay is not this incident's diagnosis.
The exact native execution path of the original wakeup was not captured.

## Verification

Process `proc_726c` ran the finite control task:

```sh
# ~/temp/agent/jev-native-qualification-2026-09-29/recovery
mise --no-env --no-hooks run check:pacing
```

This is create-new evidence;
do not rerun it over the completed receipt.
`recovery/pacing-checks.json` records Node `v26.10.0` and confirms installed embedded
`timers/promises` and `internal/timers` JavaScript exactly matches the pinned release files.
That comparison does not establish a complete native-artifact provenance chain.

Working controls include an exact `4000` ms wakeup,
a late `4001` ms wakeup,
and an injected `3999.5` ms wakeup followed by another wait.
The corrected helper requested the remaining wait and returned at `4000.5` ms.
It rejected stalled and backward injected clocks.
Removing its post-wakeup floor check made the early fixture return at `3999.5` ms,
exposing the guard omission.

The finite live control run recorded four ordinary timer waits and four corrected waits.
All met the floor in that run;
it did not reproduce the original early wakeup.
The original stopped receipt and the injected positive control remain separate evidence.
Do not infer global timer reliability,
an early-wakeup frequency,
or a speed comparison from these samples.

## Verified workaround

The consumer-side implementation is `recovery/pacing.mjs:8` to `28` in the private study.
It records an elapsed-time deadline,
checks it after every timer wakeup,
and waits for the remaining duration if needed.
It never lowers the `4000` ms floor.
It caps wakeups at eight and rejects nonfinite or backward clock values.
The controls exercise the actual helper and a separately copied omission module.

The tradeoff is a possible additional wakeup and extra elapsed time.
A stalled clock stops rather than waiting indefinitely.
This is appropriate for research pacing outside the unchanged assessment clock;
it is not a live queue-latency guarantee.

## What does not work

The original single-wait assertion stopped the live study before its second assessment.
Passing later ordinary-timer samples does not repair that assumption.
Removing the floor check accepted the injected early wakeup and therefore changed the promised minimum.
Neither lower bounds nor provider capacity should be inferred from the requested timer delay alone.

## Upstream filing decision

- Upstream fault: not established.
  The caller demanded a guarantee that Node's documentation does not make.
- Upstream fix: no upstream change is required for the verified consumer-side correction.
- Supported use: ordinary timer scheduling is supported;
  this exact measured-floor inference is not its documented contract.
- Contribution policy: not investigated because no upstream issue or patch is proposed.
- Maintainer willingness: no claim is made.
  The read-only query `gh search issues 'setTimeout early' --repo nodejs/node --limit 20`
  returned no results;
  that bounded literal search is not proof no related issue exists.
- Upstream prototype: not applicable.
  The tested change belongs in the caller,
  not Node's timer implementation.

Nothing is filed or drafted upstream.
The first filing condition fails;
there is no upstream defect claim to publicize.
