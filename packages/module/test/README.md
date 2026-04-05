# @monochromatic-dev/module-test

Jest-style test harness built on chai and sinon.
Designed to replace `bun:test` as the monorepo's test primitive
with a runtime-neutral, self-contained alternative.

## Why not an existing framework

Vitest was evaluated and rejected — it requires substantial configuration
and pulls in Vite's transform pipeline, adding a black-box build step
between test source and execution.

This package is ~250 lines of auditable code with zero magic.
Every failure is traceable through plain `Error` cause chains
and tagged structured logs (console + `.jsonl` file output).
No test transforms, no custom module resolution, no framework-specific globals.

`bun:test` couples every test file to a single runtime.
This package provides the same ergonomic API (`describe`, `it`, `expect`)
backed by chai for assertions and sinon for mocking,
so tests run on any JavaScript runtime that supports ESM — including browsers.

### Concurrent by default

Suites run children concurrently via `Promise.allSettled`.
This is the correct default for well-isolated tests:
sequential execution masks shared-state bugs by making pass/fail order-dependent.
Concurrent execution surfaces these immediately.
`Promise.allSettled` is the most portable concurrency primitive available —
it works identically across Node, Bun, Deno, and browsers
without framework-specific worker pools or process forking.

## API

### `describe({ name, children, sequential?, skip?, repeats?, timeout?, l? })`

Runs all children concurrently via `Promise.allSettled` by default.
Set `sequential: true` to run children one at a time in array order.
Returns `{ name }` on success.
Throws `Error(name, { cause })` on failure,
with `AggregateError` as cause when multiple children fail.
Empty name makes the suite invisible in the error chain
and downgrades success logs from `info` to `debug`
so they stay out of default output.
Use empty-name describe as the top-level wrapper --
the filename already reveals what is being tested.

Children can be promises (eager, start immediately) or thunks (deferred).
Use thunks with `sequential: true` to guarantee execution order.

- **`skip`** (`boolean | string`, default `false`) -- skips the entire suite without running any children;
  a string is logged as the reason
- **`repeats`** (default `0`) -- number of additional runs of the entire suite;
  `repeats: 2` runs the suite 3 times total
- **`sequential`** (`boolean | string`, default `false`) -- run children in array order instead of concurrently;
  a string is logged at debug level as the reason

Logs `childName <- suiteName` for each child result.

**Only one top-level `await describe` per file.**
When a file has multiple logical suites, wrap them in a single
`await describe({ name: '', children: [...] })` where
the inner describes are un-awaited promises in the children array:

```ts
await describe({
  name: '',
  children: [
    describe({
      name: 'suite A',
      children: [/* ... */],
    }),
    describe({
      name: 'suite B',
      children: [/* ... */],
    }),
  ],
});
```

Multiple top-level `await describe(...)` calls break test completeness:
`describe` throws on child failure, so the first failing suite
kills the process and **all subsequent suites are skipped**.
The wrapper pattern runs children through `Promise.allSettled`,
guaranteeing every suite executes regardless of earlier failures.

**Derive `name` from the tested export.**
When the test file exercises a single named export,
derive the suite name from the export itself rather than hardcoding a string literal:

- **Functions** -- use `.name`:
  `name: myFunction.name` (stays in sync with renames)
- **Objects** -- use `.constructor.name`:
  `name: myObj.constructor.name` (reflects the class or constructor that created it)

This keeps suite names automatically consistent with refactors.
Fall back to a string literal only when no single export is the test subject
(e.g. integration tests, multi-export modules).

### `it({ name, fn, timeout?, skip?, repeats?, fails?, l? })`

Executes a single test case.
`fn` receives a `TestContext` containing:

- **`expect`** -- scoped expect with assertion counting (`expect.assertions(n)`, `expect.hasAssertions()`)
- **`sinon`** -- sinon sandbox for stubs, spies, and fake timers; auto-restores after the test.
  The sandbox is created with default config.
  Custom `SinonSandboxConfig` is not supported --
  its only useful option (`useFakeTimers`) is already callable directly via `sinon.useFakeTimers()`.

The global `expect` still works for tests that do not destructure the context.
Returns `{ name }` on success.
Throws `Error(name, { cause })` on failure or timeout.

- **`skip`** (`boolean | string`, default `false`) -- skips execution entirely, logs `SKIP`, and returns immediately;
  a string is logged as the reason
- **`repeats`** (default `0`) -- number of additional runs after the first execution;
  `repeats: 2` runs the test 3 times total, with labels like `[run 1/3]`
- **`fails`** (`boolean | string`, default `false`) -- inverts pass/fail logic;
  a throwing test is treated as PASS, a passing test as FAIL;
  a string is logged as the reason alongside pass/fail output

### `expect(actual)`

Jest-style matchers backed by chai:

- **Equality**: `toBe` (strict `===`), `toEqual` (deep), `toStrictEqual` (deep, alias for `toEqual` -- chai's deep equality is strict by default)
- **Truthiness**: `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeNaN`
- **Numeric**: `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`
- **Strings**: `toMatch` (regex or string)
- **Collections**: `toContain` (reference equality), `toContainEqual` (deep equality), `toHaveLength`, `toHaveProperty`, `toMatchObject`
- **Errors**: `toThrow` (bare, message, regex, or class)
- **Types**: `toBeInstanceOf`, `toBeTypeOf` (native `typeof` check)
- **Predicates**: `toSatisfy` (custom predicate function)
- **Negation**: `expect(x).not.toBe(y)`
- **Promise rejection**: `await expect(promise).rejects.toBeInstanceOf(Error)`
- **Promise resolution**: `await expect(promise).resolves.toBe(42)`

Sinon-chai matchers for stubs and spies:

- `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`
- `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenLastCalledWith`, `toHaveBeenNthCalledWith`
- `toHaveReturned`, `toHaveReturnedTimes`, `toHaveReturnedWith`
- `toHaveLastReturnedWith`, `toHaveNthReturnedWith`

Asymmetric matchers for use inside `toHaveBeenCalledWith`:

- `expect.stringContaining`, `expect.stringMatching`, `expect.objectContaining`, `expect.arrayContaining`
- `expect.anything`, `expect.any`

### `expectTypeOf`

Re-exported from the [`expect-type`](https://www.npmjs.com/package/expect-type) package.
Compile-time type-level assertions with zero runtime cost.

```ts
import { expectTypeOf } from '@monochromatic-dev/module-test';

expectTypeOf<string>().toEqualTypeOf<string>();
expectTypeOf({ a: 1 }).toHaveProperty('a');
expectTypeOf<() => void>().toBeFunction();
```

## Usage

### Basic suite with matchers

```ts
// math.unit.test.ts
import { describe, it, expect } from '@monochromatic-dev/module-test';

await describe({
  name: '',
  children: [
    it({
      name: 'adds two numbers',
      fn: async () => {
        expect(1 + 2).toBe(3);
      },
    }),
    it({
      name: 'deep-equals objects',
      fn: async () => {
        expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
      },
    }),
    it({
      name: 'checks types and truthiness',
      fn: async () => {
        expect(null).toBeNull();
        expect(undefined).toBeUndefined();
        expect(1).toBeDefined();
        expect(1).toBeTruthy();
        expect(0).toBeFalsy();
        expect(Number.NaN).toBeNaN();
        expect(new TypeError('x')).toBeInstanceOf(Error);
      },
    }),
    it({
      name: 'numeric comparisons',
      fn: async () => {
        expect(5).toBeGreaterThan(3);
        expect(5).toBeGreaterThanOrEqual(5);
        expect(3).toBeLessThan(5);
        expect(5).toBeLessThanOrEqual(5);
        expect(0.1 + 0.2).toBeCloseTo(0.3);
      },
    }),
    it({
      name: 'strings and collections',
      fn: async () => {
        expect('hello world').toMatch(/world/);
        expect('hello world').toContain('world');
        expect([1, 2, 3]).toContain(2);
        expect([1, 2, 3]).toHaveLength(3);
        expect({ a: 1 }).toHaveProperty('a', 1);
        expect({ a: 1, b: 2, c: 3 }).toMatchObject({ a: 1, b: 2 });
      },
    }),
  ],
  timeout: 5000,
});
```

### Negation with `not`

```ts
expect(1).not.toBe(2);
expect([1, 2, 3]).not.toContain(4);
expect(1).not.toBeUndefined();
```

### Error assertions with `toThrow`

```ts
it({
  name: 'catches errors',
  fn: async () => {
    expect(() => { throw new Error('boom'); }).toThrow();
    expect(() => { throw new Error('boom'); }).toThrow('boom');
    expect(() => { throw new Error('boom'); }).toThrow(/boo/);
    expect(() => { throw new TypeError('x'); }).toThrow(TypeError);
  },
});
```

### Promise assertions with `rejects` and `resolves`

```ts
it({
  name: 'async assertions',
  fn: async () => {
    await expect(Promise.resolve(42)).resolves.toBe(42);
    await expect(Promise.reject(new Error('fail'))).rejects.toBeInstanceOf(Error);
    await expect(Promise.reject(new Error('fail'))).rejects.toHaveProperty('message', 'fail');
  },
});
```

### Skipping tests

```ts
it({
  name: 'not ready yet',
  skip: 'waiting for upstream fix #123',
  fn: async () => {
    // never runs; logs "SKIP: waiting for upstream fix #123"
  },
});
```

### Repeating tests for flakiness detection

```ts
it({
  name: 'stable under repetition',
  repeats: 4,
  fn: async () => {
    // runs 5 times total (1 + 4 repeats), labeled [run 1/5] through [run 5/5]
    // stops on first failure
    expect(Math.random()).toBeLessThan(1);
  },
});
```

### Expected failures with `fails`

```ts
it({
  name: 'known broken behavior',
  fails: 'parser bug #456',
  fn: async () => {
    // logs "PASS — threw as expected (parser bug #456)"
    throw new Error('expected to break');
  },
});
```

### Nested suites

```ts
await describe({
  name: 'outer',
  children: [
    describe({
      name: 'inner',
      children: [
        it({ name: 'deep test', fn: async () => expect(true).toBeTruthy() }),
      ],
    }),
  ],
});
```

### Sequential suites

Pass thunks (arrow functions returning promises) with `sequential: true`
to run children one at a time in array order.

```ts
await describe({
  name: 'database migration',
  sequential: 'migrations depend on previous state',
  children: [
    () => it({
      name: 'creates table',
      fn: async () => {
        await db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)');
        expect(await db.tableExists('users')).toBe(true);
      },
    }),
    () => it({
      name: 'inserts row',
      fn: async () => {
        await db.exec("INSERT INTO users (id) VALUES (1)");
        expect(await db.count('users')).toBe(1);
      },
    }),
  ],
});
```

### Parameterized tests

Use `.map()` over test data to generate `it` calls.

```ts
const cases = [
  { input: 0, expected: 1 },
  { input: 1, expected: 1 },
  { input: 5, expected: 120 },
  { input: 10, expected: 3628800 },
];

await describe({
  name: '',
  children: cases.map(({ input, expected }) =>
    it({
      name: `factorial(${input}) = ${expected}`,
      fn: async () => {
        expect(factorial(input)).toBe(expected);
      },
    }),
  ),
});
```

### Todo tests

Use `skip: true` with a descriptive name to mark planned tests.

```ts
it({
  name: 'TODO: handle edge case with empty input',
  skip: true,
  fn: async () => {},
});
```

### Custom predicates with `toSatisfy`

```ts
expect(42).toSatisfy((n) => typeof n === 'number' && n > 0);
expect('hello').not.toSatisfy((s) => typeof s === 'number');
```

### Deep equality in arrays with `toContainEqual`

```ts
const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
expect(users).toContainEqual({ id: 1, name: 'Alice' });
```

### Fake timers

Sinon's fake timer API is available through the context's `sinon` sandbox.

```ts
it({
  name: 'debounce fires after delay',
  fn: async ({ sinon, expect }) => {
    const clock = sinon.useFakeTimers();
    const callback = sinon.spy();

    debounce(callback, 100)();
    expect(callback).not.toHaveBeenCalled();

    clock.tick(100);
    expect(callback).toHaveBeenCalledTimes(1);
  },
});
```

### Assertion counting with scoped `expect`

Each `it` passes a `TestContext` with a scoped `expect` to `fn`.
Use `expect.assertions(n)` or `expect.hasAssertions()` to verify
the right number of assertions ran -- prevents silently passing async tests.

```ts
it({
  name: 'catches all async branches',
  fn: async ({ expect }) => {
    expect.assertions(2);

    const result = await fetchData();
    expect(result.status).toBe(200);
    expect(result.body).toBeDefined();
  },
});

it({
  name: 'at least one assertion runs',
  fn: async ({ expect }) => {
    expect.hasAssertions();

    if (featureEnabled) {
      expect(getFeature()).toBeTruthy();
    }
  },
});
```

The global `expect` (imported directly) works for tests that do not need assertion counting.
The scoped `expect` supports all the same matchers and asymmetric matchers.

### Type-level assertions

```ts
import { expectTypeOf } from '@monochromatic-dev/module-test';

expectTypeOf<string>().toEqualTypeOf<string>();
expectTypeOf<string>().not.toEqualTypeOf<number>();
expectTypeOf({ a: 1, b: 'hello' }).toHaveProperty('a');
expectTypeOf<() => string>().returns.toBeString();
```

### Setup and teardown

There are no built-in lifecycle hooks.
Define plain functions and call them explicitly.
This keeps control flow visible -- no implicit lifecycle runs behind the scenes.

For **per-test** setup/teardown, call functions at the start and end of each `fn`:

```ts
async function beforeEach() {
  await db.clear();
  await db.seed({ users: [{ id: 1, name: 'Alice' }] });
}

async function afterEach() {
  await db.disconnect();
}

await describe({
  name: 'user service',
  children: [
    it({
      name: 'finds user by id',
      fn: async () => {
        await beforeEach();
        const user = await findUser(1);
        expect(user).toHaveProperty('name', 'Alice');
        await afterEach();
      },
    }),
    it({
      name: 'returns undefined for missing user',
      fn: async () => {
        await beforeEach();
        const user = await findUser(999);
        expect(user).toBeUndefined();
        await afterEach();
      },
    }),
  ],
});
```

For **suite-level** setup/teardown, use top-level statements before and after `describe`:

```ts
const server = await startTestServer();

await describe({
  name: 'api',
  children: [
    it({
      name: 'returns 200',
      fn: async () => {
        const res = await fetch(server.url);
        expect(res.status).toBe(200);
      },
    }),
  ],
});

await server.close();
```

### Stubs and spies

The `sinon` sandbox from `TestContext` auto-restores after each test.

```ts
import { describe, expect, it } from '@monochromatic-dev/module-test';

await describe({
  name: 'mocking',
  children: [
    it({
      name: 'stubs a method',
      fn: async ({ sinon }) => {
        const obj = { greet: (_name: string): string => 'hi' };
        const stub = sinon.stub(obj, 'greet').returns('hello');

        obj.greet('world');

        expect(stub).toHaveBeenCalled();
        expect(stub).toHaveBeenCalledTimes(1);
        expect(stub).toHaveBeenCalledWith('world');
        expect(stub).toHaveReturnedWith('hello');
      },
    }),
    it({
      name: 'spy without changing behavior',
      fn: async ({ sinon }) => {
        const obj = { getValue: (): number => 42 };
        const spy = sinon.spy(obj, 'getValue');

        obj.getValue();

        expect(spy).toHaveBeenCalled();
        expect(spy).toHaveReturnedWith(42);
      },
    }),
  ],
});
```

### Asymmetric matchers

Used inside `toHaveBeenCalledWith` to match arguments partially.

```ts
it({
  name: 'partial argument matching',
  fn: async ({ sinon }) => {
    const spy = sinon.spy();
    spy('hello world', { id: 1, name: 'test' }, [1, 2, 3]);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('hello'),
      expect.objectContaining({ id: 1 }),
      expect.arrayContaining([1, 3]),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^hello/),
      expect.anything(),
      expect.any(Array),
    );
  },
});
```

## Vitest parity

Systematic comparison against the [Vitest API](https://vitest.dev/api/) surface.
Items are grouped by category with a status:
**supported** (direct equivalent),
**equivalent** (same functionality via different API),
or **omitted** (intentional gap with rationale).

### Test suite API

**Supported:**

- `describe(name, fn)` -- `describe({ name, children })`
- `describe.skip` -- `describe({ skip: true })` or `describe({ skip: 'reason' })`
- `describe.concurrent` -- default behavior; suites run children concurrently via `Promise.allSettled`
- `describe.sequential` -- `describe({ sequential: true })` or `describe({ sequential: 'reason' })`
- `test` / `it` -- `it({ name, fn })`
- `test.skip` -- `it({ skip: true })` or `it({ skip: 'reason' })`
- `test.fails` -- `it({ fails: true })` or `it({ fails: 'reason' })`
- `test.todo` -- `it({ name: 'TODO: ...', skip: true, fn: async () => {} })`
- `describe.todo` -- same pattern with `describe({ skip: true })`

**Equivalent:**

- `test.skipIf(condition)` -- `it({ skip: condition || false })`
- `test.runIf(condition)` -- `it({ skip: !condition || false })`
- `describe.skipIf` / `describe.runIf` -- same pattern with the `skip` option
- `test.each(cases)` / `test.for(cases)` -- `cases.map(c => it({ name: ..., fn: ... }))` passed as `children`
- `describe.each` / `describe.for` -- same `.map()` pattern with `describe`
- `test.concurrent` -- default behavior; all `it` calls start immediately when passed as promises
- `describe.timeout` -- `describe({ timeout: ms })`
- `test.timeout` -- `it({ timeout: ms })`
- `test.repeats` -- `it({ repeats: n })` (Vitest has `retry` which retries on failure;
  our `repeats` always re-runs regardless of outcome)

**Omitted:**

- **`test.only` / `describe.only`** --
  everything is eager execution; there is no central runner to filter through.
  Pipe test output to `rg` to focus on a specific test name.
- **`describe.shuffle`** --
  randomizing test order is a workaround for shared-state bugs.
  Concurrent-by-default execution already surfaces those immediately --
  if tests pass concurrently, order is irrelevant.
- **`test.extend` / fixtures** --
  adds a fixtures system with automatic setup/teardown.
  Plain functions called explicitly in each test serve the same purpose
  without hiding control flow.
- **`test.scoped` / `test.override`** -- fixture-related; same reasoning as `test.extend`
- **`bench`** -- benchmarking is a separate concern; use dedicated benchmarking tools

### Lifecycle hooks

**Equivalent:**

- `beforeEach` / `afterEach` -- define plain functions; call at start/end of each `fn`.
  See the "Setup and teardown" usage section.
- `beforeAll` / `afterAll` -- top-level statements before and after `describe`.
- `aroundEach` / `aroundAll` -- compose before/after functions manually

**Omitted:**

- **`onTestFinished` / `onTestFailed`** --
  use try/catch or `await using` within the test body for cleanup-on-failure patterns.
  No implicit hook system means no hidden execution order.

### expect matchers

**Supported** (direct 1:1 equivalents):

- **Equality**: `toBe`, `toEqual`, `toStrictEqual`
- **Truthiness**: `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeDefined`, `toBeUndefined`, `toBeNaN`
- **Numeric**: `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`
- **Type**: `toBeInstanceOf`, `toBeTypeOf`
- **String/pattern**: `toMatch`
- **Collections**: `toContain`, `toContainEqual`, `toHaveLength`, `toHaveProperty`, `toMatchObject`
- **Error**: `toThrow` (bare, message string, regex, error class)
- **Predicate**: `toSatisfy`
- **Negation**: `not` modifier
- **Promise**: `resolves`, `rejects` modifiers

**Omitted:**

- **`toBeNullable`** --
  `expect(x).toSatisfy(v => v === null || v === undefined)` covers this.
  Not common enough to warrant a dedicated matcher.
- **`toBeOneOf`** --
  `expect([a, b, c]).toContain(actual)` or `toSatisfy` with `includes` achieves the same check.
- **Snapshot matchers** (`toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`,
  `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot`) --
  snapshot tests encode serialization format as a correctness criterion,
  causing spurious failures on whitespace, key ordering, or formatter changes.
  They discourage writing targeted assertions
  and make diffs harder to review than explicit expected values.

### Spy and mock matchers

**Supported** (sinon-chai equivalents):

- `toHaveBeenCalled`
- `toHaveBeenCalledTimes`
- `toHaveBeenCalledWith`
- `toHaveBeenCalledExactlyOnceWith`
- `toHaveBeenLastCalledWith`
- `toHaveBeenNthCalledWith`
- `toHaveReturned`
- `toHaveReturnedTimes`
- `toHaveReturnedWith`
- `toHaveLastReturnedWith`
- `toHaveNthReturnedWith`

**Omitted:**

- **`toHaveBeenCalledBefore` / `toHaveBeenCalledAfter`** --
  sinon tracks `callCount` and call ordering natively;
  compare `spy.calledBefore(otherSpy)` directly in a `toSatisfy` if needed.
- **`toHaveResolved*`** (`toHaveResolved`, `toHaveResolvedTimes`, `toHaveResolvedWith`,
  `toHaveLastResolvedWith`, `toHaveNthResolvedWith`) --
  async spy result tracking requires Vitest's internal mock wrapper.
  Use `await` + standard matchers on the return value instead.

### Asymmetric matchers

**Supported:**

- `expect.anything()`
- `expect.any(Constructor)`
- `expect.arrayContaining(arr)`
- `expect.objectContaining(obj)`
- `expect.stringContaining(str)`
- `expect.stringMatching(pattern)`

**Omitted:**

- **`expect.closeTo`** --
  our asymmetric matchers are sinon matchers, so `closeTo` would only work
  inside `toHaveBeenCalledWith` but not inside `toEqual` --
  an inconsistency that would confuse users expecting Vitest behavior.
  Use `toBeCloseTo` directly for float comparisons.
- **`expect.not.*`** (negated asymmetric matchers) --
  `expect.not.stringContaining(...)`, `expect.not.objectContaining(...)`, etc.
  Too niche to justify the added API surface.
- **`expect.schemaMatching`** --
  Standard Schema v1 validation is a separate concern; validate before asserting.
- **`expect.toBeOneOf`** (asymmetric) --
  same rationale as the regular `toBeOneOf` matcher.

### Assertion control

**Supported:**

- `expect.assertions(n)` -- via scoped `expect` from `TestContext`
- `expect.hasAssertions()` -- via scoped `expect` from `TestContext`

**Omitted:**

- **`expect.unreachable(message?)`** --
  `throw new Error(message)` is equivalent and more explicit.
- **`expect.soft`** --
  soft assertions collect all failures instead of short-circuiting.
  Since suites already run children concurrently and report all failures
  via `AggregateError`, the benefit is narrow --
  it only matters within a single `it` with many assertions.
- **`expect.poll`** --
  retry-based assertions belong in application code (`waitFor` patterns),
  not in the assertion library.
- **`expect.extend`** --
  custom matchers add framework-specific API surface.
  Use `toSatisfy` with a predicate function instead.
- **`expect.addSnapshotSerializer`** -- snapshot testing is omitted entirely
- **`expect.addEqualityTesters`** -- chai's deep equality is sufficient;
  custom equality logic belongs in the comparison function, not the test framework

### Mocking and spies (vi object)

Sinon replaces Vitest's `vi` object.
The `TestContext.sinon` sandbox auto-restores after each test.

**Equivalent:**

- `vi.fn(impl?)` -- `sinon.stub()` or `sinon.spy(impl)`
- `vi.spyOn(obj, method)` -- `sinon.spy(obj, 'method')` or `sinon.stub(obj, 'method')`
- `vi.useFakeTimers()` -- `sinon.useFakeTimers()`
- `vi.advanceTimersByTime(ms)` -- `clock.tick(ms)` (where `clock = sinon.useFakeTimers()`)
- `vi.clearAllMocks()` -- `sinon.reset()`
- `vi.restoreAllMocks()` -- `sinon.restore()` (automatic via `await using`)
- `vi.isFakeTimers()` -- check `clock` reference existence
- `vi.setSystemTime(date)` -- `sinon.useFakeTimers(date)` or `clock.setSystemTime(date)`
- `vi.getRealSystemTime()` -- `Date.now()` before `useFakeTimers`, or `clock.now`
- `vi.runAllTimers()` -- `clock.runAll()`
- `vi.runAllTimersAsync()` -- `await clock.runAllAsync()`
- `vi.advanceTimersToNextTimer()` -- `clock.next()`
- `vi.advanceTimersToNextTimerAsync()` -- `await clock.nextAsync()`
- `vi.runOnlyPendingTimers()` -- `clock.runToLast()`
- `vi.getTimerCount()` -- `clock.countTimers()`
- `vi.clearAllTimers()` -- `clock.reset()`
- `MockInstance.mockReturnValue(v)` -- `stub.returns(v)`
- `MockInstance.mockReturnValueOnce(v)` -- `stub.onFirstCall().returns(v)` (or `onSecondCall`, etc.)
- `MockInstance.mockImplementation(fn)` -- `stub.callsFake(fn)`
- `MockInstance.mockResolvedValue(v)` -- `stub.resolves(v)`
- `MockInstance.mockRejectedValue(v)` -- `stub.rejects(v)`
- `MockInstance.mockClear()` -- `spy.resetHistory()`
- `MockInstance.mockReset()` -- `stub.reset()`
- `MockInstance.mockRestore()` -- `stub.restore()` (automatic via sandbox)
- `MockInstance.mock.calls` -- `spy.args`
- `MockInstance.mock.results` -- `spy.returnValues` and `spy.exceptions`
- `MockInstance.mock.lastCall` -- `spy.lastCall.args`
- `MockInstance.mock.contexts` -- `spy.thisValues`
- `MockInstance.mock.instances` -- not directly available; use `spy.thisValues` with `new`

**Omitted:**

- **`vi.mock` / `vi.doMock` / `vi.unmock`** (module mocking) --
  requires intercepting ESM imports via a build transform or custom loader,
  which contradicts the no-magic, no-custom-module-resolution design.
  Restructure code to accept dependencies as parameters instead.
- **`vi.importActual` / `vi.importMock`** -- module mocking infrastructure
- **`vi.hoisted`** -- module mocking infrastructure
- **`vi.mocked`** -- TypeScript narrowing helper for `vi.fn`; sinon types are already correct
- **`vi.mockObject`** -- deep object mocking; create stubs explicitly for the methods needed
- **`vi.stubEnv` / `vi.unstubAllEnvs`** -- set `process.env` directly; restore in afterEach
- **`vi.stubGlobal` / `vi.unstubAllGlobals`** -- assign to `globalThis` directly; restore in afterEach
- **`vi.resetModules`** -- module mocking infrastructure
- **`vi.dynamicImportSettled`** -- module mocking infrastructure
- **`vi.waitFor` / `vi.waitUntil`** -- retry/polling utilities belong in application code,
  not the test framework
- **`vi.setConfig` / `vi.resetConfig`** -- no per-file configuration to change
- **`vi.defineHelper`** -- error stack trace rewriting; our plain `Error` cause chains
  already provide clear traceability

### Type testing

**Supported:**

- `expectTypeOf` -- re-exported from the [expect-type](https://www.npmjs.com/package/expect-type) package.
  All `expectTypeOf` matchers from Vitest are available since Vitest uses the same library.

**Omitted:**

- **`assertType`** -- requires Vitest's `--typecheck` mode.
  `expectTypeOf` covers the same use cases without a special runner mode.

### Chai assert API

Vitest re-exports the full Chai `assert` API (100+ methods).
This package does not re-export `assert` --
the Jest-style `expect` API is the single assertion interface.
Chai is a direct dependency, so users who want `assert` can import it directly:

```ts
import { assert } from 'chai';
```

## Self-test

```bash
mise run //packages/module/test:test
```

The test files under `src/*.unit.test.ts` use the package's own primitives to validate itself.

## Dependencies

- **chai** -- assertion engine
- **chai-as-promised** -- registered as a chai plugin for users who prefer chai's `.eventually` syntax over the built-in `rejects`/`resolves` API
- **expect-type** -- compile-time type assertions, re-exported as `expectTypeOf`
- **sinon** -- stubs, spies, sandboxes (exposed via `TestContext.sinon`)
- **sinon-chai** -- chai plugin for sinon matchers
- **@monochromatic-dev/module-es** -- tagged logger
