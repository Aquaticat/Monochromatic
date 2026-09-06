# Sinon 22.1.0: overlapping sandbox method stubs collide on a shared target

Investigation for [Monochromatic issue #481][issue],
verified on 2026-09-06.
The proposed production direction is in
[`issue-481-context-owned-stubs.md`](../planning/issue-481-context-owned-stubs.md).
Only documentation and the disposable experiment patch were committed to the main worktree.

## Symptom

Concurrent sibling suites each call `ctx.sinon.stub(console, 'warn')`.
Sinon throws:

```text
TypeError: Attempted to wrap warn which is already wrapped
```

Giving each sibling `concurrency: 1` does not serialize the siblings against each other.
The forced-overlap control also exposed an independent failure:
a concurrent test without a stub observed the first test's fake instead of the original method.
Suppressing the double-wrap error would not fix that reader contamination.

## Root cause

### Injected context owns cleanup, not the target object

`package/module/test/src/it.ts:215` creates and passes a per-test sandbox:

```ts
// package/module/test/src/it.ts
await using sandbox = createSinon();
const ctx: TestContext = {
  expect: scopedExpect,
  sinon: sandbox,
};
```

`package/module/test/src/sinon.ts:39` delegates to ordinary Sinon:

```ts
// package/module/test/src/sinon.ts
const sandbox = createSandbox(config,) as DisposableSandbox;
```

`package/module/test/src/describe.ts:184` selects an inherited concurrency value,
but `package/module/test/src/describe.ts:304` allocates a limiter for this suite's children:

```ts
// package/module/test/src/describe.ts
const effectiveConcurrency = concurrency ?? ctx
  .effectiveConcurrency;
```

```ts
// package/module/test/src/describe.ts
const limit = pLimit(effectiveConcurrency,);
```

### Sinon replaces the real property

Installed dependency resolution selected `sinon@22.1.0`.
The matching upstream source was cloned at tag `v22.1.0`,
commit `ab289e92cdd76caf8cec2b0a8c9a391283e6c9df`.

Upstream `src/sinon/stub.js:150` delegates function replacement to `wrapMethod`:

```js
// sinon/src/sinon/stub.js
return isStubbingNonFuncProperty ? s : wrapMethod(object, property, s);
```

Upstream `src/sinon/util/core/wrap-method.js:81` rejects an existing wrapped function:

```js
// sinon/src/sinon/util/core/wrap-method.js
} else if (wrappedMethod.restore && wrappedMethod.restore.sinon) {
    error = new TypeError(
        `Attempted to wrap ${valueToString(
            property,
        )} which is already wrapped`,
    );
}
```

The same file at line 162 installs the descriptor on the supplied object:

```js
// sinon/src/sinon/util/core/wrap-method.js
Object.defineProperty(object, property, methodDesc);
```

The sandbox-specific context in upstream `src/sinon/sandbox.js:228`
concerns call-order counters:

```js
// sinon/src/sinon/sandbox.js
// Use withContext to pass sandbox context for isolated callId tracking
```

[Sinon PR #2715][call-id] introduced that counter isolation,
not execution-context-dependent target properties.
It does not remove this incident's wrapping guard.

### The harness already has an execution-context boundary

`package/module/test/src/execution-node.ts:173` creates async storage:

```ts
// package/module/test/src/execution-node.ts
storage: new AsyncLocalStorage<ObservedExecution | ReportingExecution>(),
```

`package/module/test/src/execution-node.ts:283` runs each descriptor in that store:

```ts
// package/module/test/src/execution-node.ts
return runtime.storage
  .run(
    execution,
    async function runBody(): Promise<Result> {
```

This is an integration point for production ownership,
not an already implemented mocking feature.
`package/module/test/src/execution.ts:25` currently delegates directly outside detected Node:

```ts
// package/module/test/src/execution.ts
if (((typeof process) === 'undefined')
  || ((typeof process.versions
    ?.node) !== 'string'))
  return options.run();
```

The [Node async-context documentation][node-context] describes propagation through promises and callbacks,
and explicitly discusses `EventEmitter` listeners running in a context different from registration.

## Verification

The experiment used repository base `089d4c953b4fec7c63bfcb8d635c2405aefdc0a0`,
Sinon 22.1.0,
and Node `v26.7.0` printed inside the final mise-driven probe.
It ran in a disposable worktree,
with read-only dependency links to installed packages.
No main-worktree implementation or logger test was edited.

The [experiment patch](sinon-context-owned-stubs.patch) preserves the helper,
harness integration,
and runnable probes.
The fixtures import the fork's real `describe` and `it` source,
not replacement test-runner functions.
This is source-level feasibility evidence,
not built-artifact acceptance evidence.

### Failure control

Before adding the adapter and execution wrapper,
the forced-overlap fixture ran through the existing package task:

```bash
# From the disposable repository root, with only the first probe fixture present.
mise run //package/module/test:test:unit -- package/module/test/src/issue-481-probe.unit.test.ts
```

Observed output included:

```text
Attempted to wrap warn which is already wrapped
+ 'A'
- 'original:reader'
BASELINE_CONFIRMED: collision with sequential siblings; exact descriptor restored
```

The command exited successfully because the fixture asserts that the baseline collision occurred.
That exit is not a claim that the unmodified harness isolated the tests.

### Working prototype catalog

With the adapter and execution wrapper installed in the fork:

```bash
# From the disposable repository root.
PROBE_MODE=contextual mise run //package/module/test:test:unit -- \
  package/module/test/src/issue-481-probe.unit.test.ts \
  package/module/test/src/issue-481-lifecycle-probe.unit.test.ts
mise run //package/module/test:lint:types
```

Both commands exited zero.
Consumer assertions verified:

- Different fake behavior and call histories under forced overlap.
- Original method behavior for an unstubbed concurrent reader.
- Actual `console.warn` isolation across timer awaits.
- Fake identity at property read,
  and a reference captured by one owner remaining that owner's fake when another calls it.
- Independent `stub.restore()` and `sandbox.restore()`.
- Exact final descriptor restoration.
- Repeats,
  same-owner double-stub rejection,
  `callThrough`,
  receiver preservation,
  history reset,
  restubbing,
  and repeated restoration of an older fake.
- A timed-out attempt's later method read reaching the original,
  never a subsequent test's fake.

The timeout fixture intentionally logs and asserts `Timed out after 1ms: timed-out owner`.
It is an expected failure path,
not an unresolved test failure.

### Behavioral boundary catalog

The plain `EventEmitter` probe registers under one owner and emits under another.
A method read inside that callback sees the emitting context's fake.
This passed as an explicit ownership-boundary assertion,
not as proof of registration-owner isolation.

The prototype rejects nonzero stub argument forms other than contextual two-argument method stubs,
and requires a configurable own function property.
Browser execution,
accessor stubs,
fake timers,
whole-object stubs,
spies,
and descriptor mutation interactions were not verified.

## Verified experimental workaround

The adapter asks ordinary Sinon to stub a private per-owner facade.
It installs a getter on the actual target that selects the facade using the current async context.
Readers without an active replacement see the original method.
Cleanup removes one owner and restores the original descriptor after the final owner leaves.

The test call remains `ctx.sinon.stub(target, property)`.
No test scheduling option or suite restructuring was required in the successful probes.
The prototype allocates a fresh ownership token for each test-body attempt.

Tradeoffs:

- The temporary getter changes descriptor reflection and assignment behavior.
  The probe does not claim descriptor transparency while owners are active.
- Ownership follows property-read context,
  not arbitrary causal ownership of events.
- The prototype is Node-only and covers a method subset,
  not the complete `SinonSandbox` contract.
- Retained `ctx.sinon` can still request new mutations after a test has completed.
  Production needs an irreversible completed-owner guard before this is shippable.

The existing sequential ancestor remains a fallback,
not the recommended endpoint for this method-stub incident.
It sacrifices concurrency and does not inherently stop asynchronous work after timeout.

## What does not work

- Separate ordinary sandboxes:
  the failure control proves they still share the target property.
- `concurrency: 1` on each sibling:
  the same control proves sibling suites still overlap.
- Treating the installed per-sandbox call-ID context as target isolation:
  the installed source retains direct replacement and the wrapping guard.
- Calling the experiment a drop-in implementation of Sinon:
  unsupported operations and descriptor behavior remain outside its evidence.

An initial source clone used an older tag inferred from test fixture text.
It was excluded after checking installed dependency resolution;
all upstream findings in this document use the matching 22.1.0 source.

## Upstream filing artifact

No upstream report or comment was sent.
The related [Sinon issue #2622][duplicate] requests double wrapping across sandboxes.
Its complete thread was read,
including the maintainer's objection to restoration order and shared fake state.
Our experiment implements harness-owned read-context selection instead;
it does not establish a Sinon bug.
There is no upstream bug-report artifact to add.

### Upstream filing decision

- Fault attribution:
  no.
  Sinon rejects overlapping replacements;
  this harness can provide a stronger ownership abstraction at its own boundary.
- Fix feasibility:
  the consumer-side method experiment works.
  A complete upstream design was not established.
- Supported use case:
  upstream documents sandbox grouping and cleanup,
  not independent values of one property in overlapping async executions.
- Contribution policy:
  `CONTRIBUTING.md` was read and welcomes issues with reproductions.
  A broader policy audit is unnecessary for a filing already rejected on fault attribution.
- Maintainer direction:
  issue #2622 explicitly declines the related multi-sandbox wrapping feature.
- Compatible upstream prototype:
  no upstream patch was attempted.
  This is a consumer-side experiment,
  not an upstream-ready fix.

`.out-of-scope/` filenames were checked;
none names Sinon or this bug class.
Searches for `"already wrapped" concurrent` and `"parallel" "sandbox"` returned no results.
Broader issue search for `"already wrapped"` found #2622;
broader PR search for `parallel` found #2715.
Both matching threads were read in full.

[issue]: https://github.com/Aquaticat/Monochromatic/issues/481
[duplicate]: https://github.com/sinonjs/sinon/issues/2622
[call-id]: https://github.com/sinonjs/sinon/pull/2715
[node-context]: https://nodejs.org/api/async_context.html
