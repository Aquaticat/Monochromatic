# File-enforcer watcher helpers cross callback and abort-signal boundaries

## Symptom

`prefer-readonly-parameter-type/prefer-readonly-parameter-types` reported unresolved effects in file-enforcer watch
lifecycle code for promise rejection,
AbortSignal listener registration,
`node:timers/promises` waiting,
and `AsyncLocalStorage.run` callback capture.

Wrapping callback-bearing option objects in `Readonly` also produced dishonest readonly declarations.

## Source audit

The audit used `Node.js` `v26.5.0` embedded sources.

Audited modules:

- `timers/promises`,
  digest `7352c2b6c168ab8003e6715de5e648a31a6fd74f4559d60e9f82a8dfb5f7ae2c`;
- `internal/async_local_storage/async_hooks`,
  digest `8eb45dece17b1a22cffb5af737c2a7cc1624f2d0f308bf447a3168e60f902044`.

The promise-based timer validates `options.signal`,
reads its abort state and reason,
registers an `abort` listener,
and removes or settles that listener through timer cancellation.
The signal is therefore a host capability rather than deeply readonly data.

`AsyncLocalStorage.run(store, callback, ...args)` enables storage,
installs the store on the current async resource,
invokes the callback through `ReflectApply`,
and restores prior storage in `finally`.
The callback invocation is a proven effect,
and the store remains active for asynchronous resources created during that invocation.

Promise resolver rejection retains its reason for later handlers.
It does not prove direct reason mutation,
but the project contract syntax records that caller-observable retention boundary.

## Resolution

File-enforcer now:

- removes mapped `Readonly` projections from callback-bearing watcher option types;
- documents AbortSignal registration and removal through `signal.addEventListener` and `signal.removeEventListener`;
- propagates timer signal effects through the restart supervisor;
- documents rejection-reason retention at watch lifecycle boundaries;
- documents callback invocation through `sourceCaptureStorage.run` and its lazy-write callers.

Primitive delays and paths are not described as directly mutated.
Contracts name the capability-bearing signal,
callback,
or rejection value that actually crosses each boundary.

## Verification

The file-enforcer package Oxlint task checks both direct and propagated contracts.
Removing a supervisor or lazy-write contract restores a documented-uncertainty diagnostic at the first enclosing
callable.

## Upstream filing decision

No upstream issue was filed.
Node's timer cancellation,
async-context propagation,
and Promise rejection behavior are intentional.
The required effect documentation is local policy.

## Sources

- [Node timers promises source][timers-source]
- [Node AsyncLocalStorage source][async-storage-source]

[timers-source]: https://github.com/nodejs/node/blob/v26.5.0/lib/timers/promises.js
[async-storage-source]: https://github.com/nodejs/node/blob/v26.5.0/lib/internal/async_local_storage/async_hooks.js
