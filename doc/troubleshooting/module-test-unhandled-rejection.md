# Node 26.8.1 terminates module-test files on detached promise rejection before a named verdict

Investigation for [issue #483](https://github.com/Aquaticat/Monochromatic/issues/483),
2026-09-06.
Implementation and subprocess verification completed in an isolated worktree.
The user rejected activation that depends on an optional launcher or preload flag.
The accepted reporting contract preserves body verdicts and adds a detailed,
separate async-failure warning that fails the file.

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

## Accepted design and verification

The user's preference is to avoid installing `unhandledRejection` handling repeatedly or intrusively.
The user clarified that this is a preference,
not a prohibition: broader handling may be proposed if narrower approaches fail verification.
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

The user selected a stable body verdict plus a separate attributed async failure.
Both active-body and post-completion rejections fail the file,
without changing the descriptor's returned result.

### Q2 clarification: concrete reporting examples

The user requested an example before answering Q2.
The following output illustrates the proposed alternatives;
it is not output from an implemented fix.

Suppose `saves settings` starts an async write without awaiting it.
Its assertions pass and the harness prints PASS.
While `loads profile` runs,
the background write rejects with `disk full`.

Option A supersedes the originating test's passing verdict:

```text
[saves settings] PASS
[saves settings] FAIL: unhandled rejection after completion: disk full
[loads profile] PASS
[file] FAIL
```

Its benefit is that the test responsible for the rejection ends marked failed.
Its cost is that the earlier PASS line needs a later correction.

Option B preserves the test body's passing verdict and records a separate async failure:

```text
[saves settings] PASS
[async work from saves settings] FAIL: disk full
[loads profile] PASS
[file] FAIL
```

Its benefit is that the body verdict remains stable.
Its cost is that `saves settings` stays marked passed despite causing the file failure.

The original recommendation of A is retracted.
The user correctly challenged its fit with the existing architecture:
printing a later FAIL cannot revise a resolved descriptor promise or a parent's collected results.
`package/module/test/src/describe.ts:365` collects settled child results locally:

```ts
const settled = await awaitSettleWithTimeoutLogging();
const errors: unknown[] = [];
const passedNames: string[] = [];
```

There is no shared mutable verdict registry to update.
Option B is accepted.
The warning must explain that PASS covers only the awaited body,
that detached rejection usually indicates harness misuse,
and that timed-out work and dependency-owned background work are relevant exceptions.
It must explain awaiting operations and async assertions,
stopping and draining background work,
cancelling timed-out work,
fixing dependency leaks at their owner,
and isolating deliberate fault injection in child processes.

The first built-artifact regression run on Node 26.7.0 passed six tests:
import/descriptor construction has no observer side effect;
handled rejection remains successful;
active and late detached rejection preserve sibling execution and body settlement;
post-root rejection remains observed;
unattributed work fails without inventing a test name.
The same subprocess regression failed before implementation on the four escaped-work cases.
Expanded verification passed all 27 new subprocess checks,
then all 13 unit-test files in the package.
The package's `lint:types` task passed,
and `lint:oxlint` reported zero warnings and errors.
TypeScript's emitted build-info list included every new implementation,
fixture,
and test file;
this was not a stale-cache or excluded-file result.

### Regression proofs and reproduction commands

The guard was first committed in isolated checkpoint `e63cd0859`.
Removing only the `process.on('unhandledRejection', ...)` registration,
rebuilding,
and running `unhandled-rejection.unit.test.ts` failed the four escaped-work cases;
the import-only and handled-rejection controls passed.
Restoring the guard recovers the passing run.

A second positive control installed an inert listener during module import.
After rebuilding,
only the import-side-effect test failed,
with `LISTENER_DELTA=1` instead of `LISTENER_DELTA=0`.
Both temporary mutations were restored and the source diff was verified empty.

From the repository root,
run the package tasks in order:

```bash
mise run //package/module/test:build:js:browser
mise run //package/module/test:test:unit
mise run //package/module/test:lint:types
mise run //package/module/test:lint:oxlint
```

The tests launch plain Node child processes against the built artifact,
with no preload or alternate runner.
They override ambient `NODE_OPTIONS` and use disposable working directories.
During the isolated verification,
`TMPDIR` was set to the user's requested `~/temp/agent` scratch root.

### Reporter exit fallback and narrow lint exceptions

The independent lifecycle probe found that the original `process.stderr.write(...)`
fallback disappeared when stderr was corked and the reporter's flush remained pending.
The uncorked positive control printed the fallback.
The implementation now uses `writeSync(2, message)` only for emergency diagnostics;
normal diagnostics still use the tagged logger and existing error formatter.

Node tag `v26.8.1`,
`doc/api/process.md:128`,
requires synchronous exit callbacks:

```text
Listener functions **must** only perform **synchronous** operations.
```

The same document at line 4223 identifies POSIX pipe writes as asynchronous.
`rejection-fixture-reporting.ts` reproduces the boundary with:

```ts
process.stderr.cork();
return Promise.withResolvers<void>().promise;
```

The `reporter-unfinished` subprocess test requires the final stderr fallback and exit 1.
It passed with the synchronous writer.
No artificial keepalive is added for a reporter that never settles.

`package/oxlint-plugin/no-restricted-syntax/src/rule/no-sync.ts:30`
defines the rule metadata without an options schema,
and its call visitor at line 65 reports every recognized Node synchronous call:

```ts
if ((typeof calleeName) === 'symbol')
  return;
context.report({ node, messageId: 'forbidden', data: { name: calleeName, }, });
```

There is no per-operation allow-list to configure.
The single synchronous writer has a call-scoped exception,
with this exit regression as its justification;
changing the package-wide rule would exempt unrelated blocking I/O.

The primitive-reason fixture intentionally rejects both a string and explicit `undefined`.
The observed lint diagnostics were `eslint(prefer-promise-reject-errors)`
and `typescript(prefer-promise-reject-errors)`.
The inspected Oxlint source,
`crates/oxc_linter/src/rules/eslint/prefer_promise_reject_errors.rs:28`,
exposes only `allow_empty_reject: bool`.
Its check at line 146 allows that option only when the argument list is empty:

```rs
if call_expr.arguments.is_empty() && allow_empty_reject {
    return;
}
```

Neither fixture call omits its argument.
The type-aware companion's options at
`crates/oxc_linter/src/rules/typescript/prefer_promise_reject_errors.rs:15`
also include named-type allowances and any/unknown allowances;
they do not remove the syntactic rule's rejection of these literal cases.
Both calls therefore carry line-scoped exceptions instead of hiding the literal behind a different syntax.

### Explicit runtime and competing-listener boundaries

The lifecycle regression covers all five Node rejection modes.
`throw`,
`none`,
`warn`,
and `warn-with-error-code` continue siblings and fail the file with harness diagnostics.
`warn` additionally retains Node's requested warning output.
`strict` terminates before the rejection event and therefore does not continue siblings.
The harness does not install an uncaught-exception recovery handler or alter runtime flags.

Existing listeners remain installed.
An independent probe confirmed that another rejection listener can still throw and terminate the process,
and a later-registered exit listener can overwrite the status after the harness exit callback.
The observer does not override these other owners.
Its sticky-status guarantee covers ordinary body writes before its exit callback,
not deliberate changes by a subsequent exit callback.

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
    Consumer implementation follows the accepted separate-failure design.

Upstream filing artifact: nothing to file.
No upstream issue or comment was drafted or sent.
The existing repository issue #483 remains open.

[node-cli]: https://nodejs.org/docs/latest-v26.x/api/cli.html#--unhandled-rejectionsmode
[node-monitor]: https://nodejs.org/docs/latest-v26.x/api/process.html#event-uncaughtexceptionmonitor
