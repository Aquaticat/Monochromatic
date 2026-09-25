## module-p-limit-fork

TypeScript fork of [`p-limit`](https://github.com/sindresorhus/p-limit),
in-repo so its behavior is owned,
 tested,
 fuzzed,
 and mutation-tested here
instead of trusted from a third-party package.

### Attribution

Derived from [`p-limit`](https://github.com/sindresorhus/p-limit) by
[Sindre Sorhus](https://sindresorhus.com),
 released upstream under the
[MIT License](LICENSES/MIT.txt).
The scheduling semantics,
 validation rules,
 and error message texts come from `p-limit` 7.3.3.
Upstream's copyright and permission notice are preserved verbatim in
`LICENSES/MIT.txt`;
this fork's own code is licensed
`LGPL-3.0-or-later AND MIT` as declared in `package.json`.

### Behavior

- `pLimit(concurrency)` or `pLimit({ concurrency, rejectOnClear })` creates
  one limiter.
- Scheduling one call returns a promise settling with that function's result
  or failure.
- Calls start asynchronously,
  never inside the `limit` call that scheduled them,
  and start in FIFO order.
- At most `concurrency` calls run at once;
  `Number.POSITIVE_INFINITY` removes the cap.
- `activeCount` counts running calls,
  `pendingCount` counts queued calls.
- `concurrency` reads and writes the bound;
  raising it admits queued calls from a microtask,
  lowering it never interrupts running calls.
- `clearQueue()` discards queued calls only;
  with `rejectOnClear`,
  each discarded call's promise rejects with
  `AbortSignal.abort().reason`.
- `map({ iterable, mapper })` processes inputs under the bound and collects
  results in input order.
- `limitFunction({ fn, options })` wraps one function in its own bounded call
  queue,
  returning a callable exposing `clearQueue`.

### Usage

```ts
// package/module/p-limit-fork/example.ts
import { pLimit, } from '@monochromatic-dev/module-p-limit-fork';

const limit = pLimit({ concurrency: 2, },);

const results = await Promise.all([
  limit({ fn: fetchUser, args: ['a'], },),
  limit({ fn: fetchUser, args: ['b'], },),
]);
```

### Deviations from upstream `p-limit`

- Calls pass an `args` tuple instead of a rest parameter
  (`limit({ fn, args })`),
  and `map` takes a destructured options object,
  because repository lint bans rest parameters and multi-positional-parameter
  declarations outright.
- `limitFunction({ fn, options })` takes one destructured options object for
  the same reason.
- Invalid configuration throws `InvalidConcurrencyError` or
  `InvalidRejectOnClearError`,
  both `TypeError` subclasses carrying upstream's message text,
  instead of a bare `TypeError`.
- The queue is implemented in `src/task-queue.ts`,
  so the package has zero runtime dependencies;
  upstream depends on `yocto-queue`.
- Each call's promise settles when its function settles,
  without upstream's promise-of-promise adoption hop;
  observable outcomes are identical.

### Testing

```bash
# Unit tests against the built dist
mise run //package/module/p-limit-fork:buildAndTest

# Property-based fuzz campaign (invariants plus an upstream differential oracle)
mise run //package/module/p-limit-fork.fuzz:fuzz

# Coverage-reachability gate over this package's src
mise run //package/module/p-limit-fork.fuzz:fuzz:coverage

# Container-isolated mutation testing
mise run //package/module/p-limit-fork:test:mutation
```

### Design decisions

- **One file per concept.
  ** `p-limit.ts` owns scheduling,
  `task-queue.ts` the FIFO queue,
  `limit-options.ts` configuration,
  `limit-function.ts` the wrapper factory,
  `errors.ts` the error classes.
- **Internal queue over a dependency.
  ** Dropping `yocto-queue` removes the last third-party trust surface from
  the concurrency path.
- **Upstream error message texts kept verbatim.
  ** Callers migrating from `p-limit` see identical diagnostics,
  and the fuzz sidecar's differential oracle can compare both
  implementations directly.
