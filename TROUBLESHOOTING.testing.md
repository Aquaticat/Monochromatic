# Testing troubleshooting

## Duplicate describe names causing confusing error output

Symptoms:

- Error cause chains show the wrong suite name for a failing test.
- Multiple suites report the same name in output, making it hard to locate the failure.

Root cause:

- `describe` propagates child failures as `Error(name, { cause })`.
  When two sibling describes share the same `name`, the error chain is ambiguous;
  both suites wrap their errors with the same message string.
- The harness does not merge or deduplicate suites with the same name
  (unlike bun:test's reporter), but the output becomes hard to read.

Prevention:

- Keep `describe` names unique at the same scope within a file.
- Use `functionName.name` for imported functions -- this is inherently unique per import.
- Use region markers to visually separate groups and catch accidental duplication.

## Tests silently skipped after first failure with multiple top-level awaits

Symptoms:

- Only the first failing suite's errors appear in output.
- Suites defined after the failing one never run.
- The process exits before all tests complete.

Root cause:

- `describe` throws on child failure.
  Multiple `await describe(...)` at the top level means a throw in the first
  kills the process, skipping all subsequent describes.

Fix:

- Wrap all suites in a single `await describe({ name: '', children: [...] })`.
  The empty-name wrapper runs children through `Promise.allSettled`,
  guaranteeing every suite executes regardless of earlier failures.

```ts
// BAD: second suite skipped if first throws
await describe({ name: 'suite A', children: [...] });
await describe({ name: 'suite B', children: [...] });

// GOOD: both suites always run
await describe({
  name: '',
  children: [
    describe({ name: 'suite A', children: [...] }),
    describe({ name: 'suite B', children: [...] }),
  ],
});
```

## Concurrent tests sharing mutable state

Symptoms:

- Tests pass when run individually but fail when run together.
- Assertions see values set by a different test.
- Flaky failures that depend on execution order.

Root cause:

- Children run concurrently by default via `Promise.allSettled`.
  Tests that share module-level mutable state (counters, caches, singletons)
  interfere with each other.

Fix:

- Isolate state per test: create fresh state inside each `fn`.
- Use `concurrency: 1` on the describe when shared state is unavoidable.
  Children are lazy descriptors and dispatched by the parent, so no thunk
  wrapping is needed; the parent's effective concurrency is inherited by
  nested describes:

```ts
describe({
  name: 'shared resource -- tests mutate shared cache',
  concurrency: 1,
  children: [
    it({ name: 'first', fn: async () => { ... } }),
    it({ name: 'second', fn: async () => { ... } }),
  ],
})
```

## Assertion count mismatch with global expect

Symptoms:

- `expect.assertions(n)` is not available or does not work.
- Tests with async branches pass silently when an assertion is never reached.

Root cause:

- The global `expect` (imported directly from `@monochromatic-dev/module-test`)
  does not support assertion counting.
  Only the scoped `expect` from the test context tracks counts.

Fix:

- Destructure `expect` from the `fn` parameter:

```ts
it({
  name: 'all branches assert',
  fn: async ({ expect, },) => {
    expect.assertions(2,);
    expect(await fetchA(),).toBe('a',);
    expect(await fetchB(),).toBe('b',);
  },
},);
```

## Sinon stubs not restored between tests

Symptoms:

- A stub set in one test leaks into another.
- Tests fail with "already wrapped" errors.

Root cause:

- Using `sinon` imported directly instead of the per-test sandbox from context.
  The global sinon instance does not auto-restore.

Fix:

- Use `ctx.sinon` from the test context, which auto-restores via `await using`:

```ts
it({
  name: 'stubs cleanly',
  fn: async ({ sinon, },) => {
    sinon.stub(obj, 'method',).returns('mocked',);
    // stub is automatically restored after this test
  },
},);
```
