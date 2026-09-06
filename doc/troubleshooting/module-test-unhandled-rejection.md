# Node 26.8.1 terminates module-test files on detached promise rejection before a named verdict

Investigation for [issue #483](https://github.com/Aquaticat/Monochromatic/issues/483),
2026-09-06.
Implementation is pending completion of the requested grilling session.
The user rejected activation that depends on an optional launcher or preload flag.

## Symptom

A promise rejected outside the promise returned by a test function terminates its Node process.
The observed diagnostic was `Error: issue483-detached`,
followed by Node's stack and exit status 1.
The harness emitted no `[FAIL]` record,
and the next sequential sibling did not execute.

Issue #483 reports the same failure boundary during a logger guard-removal proof:
`Error: transient write failure` terminated the file before the abandoned-write suite executed.
That mutation was not repeated against the concurrently modified logger worktree.
The harness reproduction isolates the detached rejection directly.

## Root cause

### The test function's returned promise is already observed

`package/module/test/src/it.ts:111` starts the supplied function and awaits its promise:

```ts
const promise = fn(ctx,);

await (timeout !== undefined
  ? withTimeout({ promise, ms: timeout, label: name, },)
  : promise);
```

A separate rejected promise does not become a rejection of this returned promise.
The positive control that changed `void Promise.reject(...)` to `await Promise.reject(...)`
produced `[issue483] [leaks] [FAIL]` and executed the later sibling.

The reported logger mutation has such a separate branch.
`package/module/logger/src/create-logger.ts:249` awaits the tracked write in an async cleanup function:

```ts
async function removePendingWriteWhenSettled(
  { trackedWrite, }: { readonly trackedWrite: Promise<void>; },
): Promise<void> {
  await trackedWrite;
  pendingWrites.delete(trackedWrite,);
}
```

The caller at `package/module/logger/src/create-logger.ts:284` discards the cleanup promise:

```ts
void removePendingWriteWhenSettled({ trackedWrite, },);
```

Removing rejection handling from `trackWrite` therefore exposes a cleanup rejection
that the test function does not return.
This explains why another catch around the test function would not cover that branch.

### Node's default mode escalates an unobserved rejection

Inspected Node tag `v26.8.1`,
commit `7be6d3af31a65adea57c94c41e50c2b071ed0b3a`.
The installed runtime's `internal/process/promises` source matched the cloned source byte for byte.

Node's `lib/internal/process/promises.js:316` implements default `throw` mode:

```js
const handled = emitUnhandledRejection(promise, promiseInfo);
if (!handled) {
  const err = isErrorLike(reason) ?
    reason :
    new UnhandledPromiseRejection(reason);
  triggerUncaughtException(err, true /* fromPromise */);
  return false;
}
```

This is the documented behavior of [`--unhandled-rejections=throw`][node-cli].
In a process without an intercepting handler,
the escalation terminates execution before the harness receives a test result.

### Attribution can follow the rejection's async context

Node's `lib/internal/process/promises.js:189` saves the context when recording a rejection:

```js
contextFrame: AsyncContextFrame.current(),
```

At `lib/internal/process/promises.js:402`,
Node restores that context while delivering the rejection:

```js
const { contextFrame } = promiseInfo;
const priorContextFrame = AsyncContextFrame.exchange(contextFrame);
try {
  needPop = unhandledRejectionsMode(promise, promiseInfo, promiseAsyncId);
} finally {
  AsyncContextFrame.set(priorContextFrame);
```

An `AsyncLocalStorage` probe attributed a detached timer created in context A to A
while context B was awaiting.
A separate probe created `Promise.withResolvers()` in A and called its reject function from B;
the rejection handler observed B.
This mechanism identifies the rejecting async context,
not universal promise-creation ownership.
Missing context must produce an explicitly unattributed file failure.
Choosing whichever concurrent test happens to be active would invent attribution.

## Verification

Runtime: `node --version` returned `v26.8.1`.
Repository HEAD at the reproduction was `2d8af1c44ff3e43f05cd2e1919eb7ee5d3443bbd`.
The source worktree included existing changes;
the reproduction exercised current harness source without rebuilding or modifying production code.

Run this command from the repository root.
It moves the child process to the temporary directory before importing the harness,
so the logger does not create a repository log through nearest-`node_modules` discovery.

```bash
node --input-type=module --eval '
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { setTimeout as wait } from "node:timers/promises";
const entry = pathToFileURL(resolve("package/module/test/src/index.ts"));
process.chdir(tmpdir());
const { describe, it } = await import(entry.href);
await describe({
  name: "issue483",
  concurrency: 1,
  children: [
    it({
      name: "leaks",
      fn: async () => {
        void Promise.reject(new Error("issue483-detached"));
        await wait(20);
      },
    }),
    it({
      name: "later sibling",
      fn: async () => { console.log("LATER_SIBLING_RAN"); },
    }),
  ],
});'
```

### Patterns with useful handling

- Replacing `void` with `await` causes a named test failure,
  prints `LATER_SIBLING_RAN`,
  and exits 1 through the suite's failure.
- A Node-only probe with a rejection listener under default `throw` mode receives the reason
  and executes subsequent work without Node's raw warning.
  A listener alone does not set failure status;
  the reporting adapter must own that responsibility.

### Patterns that fail the requested reporting contract

- The detached reproduction under default mode exits 1,
  emits no harness failure,
  and omits `LATER_SIBLING_RAN`.
- Adding `--unhandled-rejections=warn-with-error-code` prints raw warnings,
  executes `LATER_SIBLING_RAN`,
  and exits 1,
  but the harness emits `[issue483] [PASS] leaks, later sibling`.
- A Node-only probe with `--unhandled-rejections=warn` continues with warnings and exits 0.
- Under `--unhandled-rejections=strict`,
  a rejection listener alone does not prevent termination.
  Node's `lib/internal/process/promises.js:270` escalates before invoking the rejection listener.
- `uncaughtExceptionMonitor` observes termination but does not prevent it,
  as verified in a child process and specified in [Node's monitor documentation][node-monitor].

## Verified workarounds

Awaiting and handling a promise works when the caller can access it.
The positive control verifies that path.
Its limitation is ownership:
the logger cleanup promise in the reported mutation is private to the logger.

`--unhandled-rejections=warn-with-error-code` preserves sibling execution and a failing exit status.
The reproduction verifies both.
Its tradeoff is misleading harness PASS output and unattributed runtime warnings.
It is a diagnostic workaround,
not a resolution of #483.

## What does not work

Adding another catch around `fn(ctx)` does not attach handling to discarded promises.
Warning mode does not teach the harness which test should fail.
A monitor only records the runtime's termination path.
These approaches do not satisfy the complete issue contract.

No claim is made that every alternative to a process rejection listener is impossible.
The proposed design uses the supported rejection event at an explicit test-file boundary.

## Revised proposal and pending choice

The user's preference is to avoid installing `unhandledRejection` handling repeatedly or intrusively.
The initial recommendation placed activation in the file launcher.
The user rejected that choice as prone to misuse:
running the file directly would silently omit the requested behavior.
That recommendation is retracted.
Automatic protection through existing `await describe(...)` and `await it(...)` calls is now a design requirement.

The revised proposal activates a shared Node observer when tests first execute,
leaving import and descriptor construction without a rejection-listener side effect.
Tests would provide async context for attribution.
The observer would remain available for rejections that surface after a test or root suite has settled.
This does not add file discovery or process launching to the library,
preserving [the existing file-orchestration decision](../adr/0001-module-test-suite-primitive.md).

### Root-promise settlement is not a sufficient teardown boundary

Node-only lifecycle probes used a listener with a synchronous disposal method
that called `process.off("unhandledRejection", observer)`.
All ran on Node 26.8.1:

- Await an async function that discards `Promise.reject(...)`,
  then dispose immediately:
  disposal ran before rejection delivery and the process exited 1 with a raw stack.
- Await the same function,
  await `setImmediate` from `node:timers/promises`,
  then dispose:
  the observer received the rejection and the process survived.
- Schedule the rejection through a 20 ms timer,
  await the function and `setImmediate`,
  then dispose:
  disposal preceded delivery and the process again exited 1 with a raw stack.

Waiting one event-loop turn therefore covers immediate delivery,
but does not establish that detached work has ended.
The revised proposal retains observation for late failures instead of treating root settlement as proof of completion.

The next user-visible question is how to report a rejection whose attributed test already emitted PASS:
supersede that test result with FAIL,
or preserve its body verdict and add a separate attributed async failure.
Both must fail the file.
No implementation has been applied.

### Proposed agent-guidance update

The correction exposed a design-review gap covered by `AGENTS.md` rule `GAP`.
Proposed replacement for existing `EC4`,
merging the entry-path requirement into its existing effectiveness rule:

```text
EC4:
 Features must achieve their intended effect on normal entry paths.
Required behavior must not depend on optional setup.
Unsupported functionality gets an explanation,
 not non-functional code.
```

This is a proposal;
`AGENTS.md` has not been edited.

## Upstream filing decision

No `.out-of-scope/` entry names this Node rejection behavior.
The defect tracked here belongs to the repository's test reporting.

1.  Upstream fault: no.
    Node's observed default behavior matches its implementation and documentation.
2.  Upstream fixability: Node can change policy,
    but no Node change is required for the consumer's reporting contract.
3.  Supported use case: Node documents rejection listeners and selectable rejection modes.
4.  Contribution welcome: not evaluated because no upstream filing is proposed.
    This is not a claim that contributions are unwelcome.
5.  Likelihood of an upstream fix: not evaluated;
    no Node defect is asserted.
6.  Upstream prototype: unnecessary because the upstream-fault condition fails.
    Consumer implementation remains pending design selection.

Upstream filing artifact: nothing to file.
No upstream issue or comment was drafted or sent.
The existing repository issue #483 remains open.

[node-cli]: https://nodejs.org/docs/latest-v26.x/api/cli.html#--unhandled-rejectionsmode
[node-monitor]: https://nodejs.org/docs/latest-v26.x/api/process.html#event-uncaughtexceptionmonitor
