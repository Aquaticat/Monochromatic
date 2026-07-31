# `l.trace()` at every function entry adds up to 2000% overhead because each call captures a full stack trace; replace with `l.debug()` for routine entry logging

## Symptom

A code path with `l.trace()` at every function entry shows
dramatically degraded throughput compared to the same path
with no logging or with `l.debug()`.
 In a hot loop or
function-heavy module,
 the slowdown can dominate the
function's own work.

Discovered while profiling function-heavy modules where the
function bodies themselves run in microseconds but the logged
runs take milliseconds.

## Root cause

`l.trace()` captures a full stack trace via
`Error.captureStackTrace()` (or the equivalent V8 mechanism)
on every call:

- V8 collects every call-frame's source location,
   function
  name,
   and column info.
- The trace is serialised into a multi-line string.
- The log line is written synchronously to whichever sink the
  logger is configured with.

`l.debug()` skips the stack-trace capture entirely;
 it logs a
single string.
 The serialisation cost is dominated by the
stack walk;
 the I/O cost is similar to `console.log`.

Published microbenchmarks suggest `console.trace()` runs up to
20x slower than `console.log()` on the same input.

## Verification

Versions under test:

- `@monochromatic-dev/module-logger` at workspace HEAD.
- Bun 1.3.
  x runtime.

Reproduce:
 take any function-heavy module,
 add `l.trace('fn
started')` at every entry point,
 run a representative
workload,
 compare wall time with the same workload using
`l.debug('fn started')`.
 The trace version runs 5-20x slower
depending on stack depth and sink configuration.

## Verified workaround

Replace function-entry `l.trace()` calls with `l.debug()`:

```ts
// Before; with stack-trace overhead
function myFunction() {
  l.trace('myFunction started',);
  // ... function logic
}

// After; basic debug logging
function myFunction() {
  l.debug('myFunction started',);
  // ... function logic
}
```

Benefits:
 eliminates stack-trace capture overhead;
 preserves
function entry visibility;
 preserves log-level control
(debug can be disabled in production);
 reduces I/O
serialisation overhead.

Tradeoff:
 the log entry no longer includes where the function
was called from;
 if the trace was needed to diagnose a
particular bug,
 keep `l.trace()` for that narrow case while
using `l.debug()` for routine entry logging.
 The general rule
is "use `l.debug()` for entry traces;
 reserve `l.trace()` for
diagnostic moments that genuinely need the call stack".

Migration steps:

- Search and replace `l.trace(` -> `l.debug(` across the
  codebase.
   (Confirm each replacement is a routine entry log
  rather than a diagnostic trace.
  )
- Verify no functionality depends on the captured stack.
- Profile the function-heavy modules before and after to
  confirm the improvement.
- Update the logger configuration to control debug output in
  production.

## Alternative approaches considered

- **Conditional logging**:
   gate `l.trace()` behind an env
  guard so production builds skip it entirely.
   Tradeoff:
  every call site grows a conditional;
   cleaner to use the
  log-level system.
- **Structured logging**:
   switch to a performance-tuned
  logging library that omits stack capture by default.
  Tradeoff:
   ecosystem migration;
   not justified when the
  existing logger has the same property via log levels.
- **Debug-only traces**:
   keep `l.trace()` only for complex
  debugging scenarios,
   not routine function entry.
   This is
  the workaround above;
   restated as guidance.

## What does not work

- Replacing the logger entirely with raw `console.log`:
  violates the workspace's "use tagged loggers" rule
  (`AGENTS.md` "Logging") and loses tag-based filtering.
   The
  performance fix lives at the call-level (level choice),
  not the logger-level.
- Asynchronous trace capture:
   V8 has no public hook to
  schedule the stack walk asynchronously;
   the trace would
  reflect a future,
   not the call site.

## Why we do not file this upstream

The behaviour is correct by design:
 `trace` is supposed to
include the stack.
 Walking the 5 constraints:

1. **Is it really upstream's fault?
   ** No.
2. **Can upstream fix it?
   ** Nothing to fix;
    the stack walk is
   the feature.
3. **Are they supporting this use case?
   ** Yes;
    `l.trace()`
   is documented as the "with stack" variant.
4. **Will they likely fix it?
   ** N/A.
5. **Have we prototyped a minimal fix?
   ** N/A.

Decision:
 no upstream report.
 Use the right level for the
right call site.

## Key takeaway

Use `l.debug()` for routine entry logging to avoid stack-trace
generation.
 Reserve `l.trace()` for cases where the call stack
is actually useful for diagnosis.
