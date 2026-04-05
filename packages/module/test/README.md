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
- **Types**: `toBeInstanceOf`
- **Predicates**: `toSatisfy` (custom predicate function)
- **Negation**: `expect(x).not.toBe(y)`
- **Promise rejection**: `await expect(promise).rejects.toBeInstanceOf(Error)`
- **Promise resolution**: `await expect(promise).resolves.toBe(42)`

Sinon-chai matchers for stubs and spies:

- `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`
- `toHaveBeenLastCalledWith`, `toHaveBeenNthCalledWith`
- `toHaveReturnedWith`

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
