# @monochromatic-dev/module-test

Ready to publish.

Jest-style test harness built on chai and sinon.
Designed to replace `bun:test` as the monorepo's test primitive
with a runtime-neutral,
 self-contained alternative.

## Why not an existing framework

Vitest was evaluated and rejected;
 it requires substantial configuration
and pulls in Vite's transform pipeline,
 adding a black-box build step
between test source and execution.

This package is plain TypeScript with zero magic.
Every failure is traceable through plain `Error` cause chains
and tagged structured logs (console + `.jsonl` file output).
No test transforms,
 no custom module resolution,
 no framework-specific globals.

`bun:test` couples every test file to a single runtime.
This package provides the same ergonomic API (`describe`,
 `it`,
 `expect`)
backed by chai for assertions and sinon for mocking,
so tests run on any JavaScript runtime that supports ESM,
 including browsers.

### Concurrent by default

Suites run children concurrently via `Promise.allSettled`.
This is the correct default for well-isolated tests:
sequential execution masks shared-state bugs by making pass/fail order-dependent.
Concurrent execution surfaces these immediately.
`Promise.allSettled` is the most portable concurrency primitive available;
it works identically across Node,
 Bun,
 Deno,
 and browsers
without framework-specific worker pools or process forking.

Concurrency is capped at 16 children at a time by default
to avoid overwhelming shared resources (file handles,
 network connections,
 database pools).
The limit is configurable per suite via the `concurrency` option.

## API

### `describe({ name, children, concurrency?, skip?, repeats?, timeout?, l? })`

Runs all children concurrently via `Promise.allSettled` by default,
capped at `concurrency` (default 16) simultaneous children.
Returns `{ name }` on success.
Throws `Error(name, { cause })` on failure,
with `AggregateError` as cause when multiple children fail.
Empty name makes the suite invisible in the error chain
and downgrades success logs from `info` to `debug`
so they stay out of default output.
Use empty-name describe as the top-level wrapper;
the filename already reveals what is being tested.

Children are lazy {@link TestDescriptor} values from nested `describe` or `it`
calls;
 they do not run until the parent suite dispatches them.
 Sequential,
bounded,
 and unbounded modes all work without wrapping children in thunks.

- **`concurrency`** (`number`,
   default `16` at the root):
   maximum number of children running at the same time.
  The implementation adapts to the value:
  - `1`:
     sequential execution via `for...of` loop,
     no `p-limit` overhead
  - `2`..`Number.MAX_SAFE_INTEGER - 1`:
     bounded concurrency via [`p-limit`](https://www.npmjs.com/package/p-limit)
  - `Infinity` or `Number.MAX_SAFE_INTEGER`:
     unbounded concurrency via raw `Promise.allSettled`,
     no `p-limit` overhead

  **Inherited by child describes.
  ** A nested `describe` without its own
  `concurrency` inherits the parent's effective value,
   so setting
  `concurrency: 1` once at the top sequences all descendants.
   When child tests
  stub shared global state (e.g. prototype methods,
   module-level variables),
  set `concurrency: 1` on the outermost `describe` that contains those tests;
  the inheritance carries through.
   Concurrent tests that stub the same target
  fail with `"Attempted to wrap X which is already wrapped"` because sinon
  refuses to wrap a method that another concurrent test's sandbox has already
  wrapped.
- **`skip`** (`boolean | string`,
   default `false`):
   skips the entire suite without running any children;
  a string is logged as the reason
- **`repeats`** (default `0`):
   number of additional runs of the entire suite;
  `repeats: 2` runs the suite 3 times total

On success,
 the suite emits one `info` line listing every fulfilled child's name plus the
suite's wall-clock duration:
 `PASS childA, childB, ... (<duration>)`.
 The full `[outer] [inner]`
tag chain is in the line's prefix,
 so the parent-children mapping is visible at default
verbosity.
 Per-test `PASS` lines are at `debug` (hidden by default;
 surface with
`MONOCHROMATIC_VERBOSE=true`).
 On failure the suite emits a `FAIL (<duration>)` line at `error`.
 Empty-name
suites downgrade the success line to `debug`.
 See the [Output format](#output-format)
section for the full contract.

**Only one top-level `await describe` per file.
**
When a file has multiple logical suites,
 wrap them in a single
`await describe({ name: '', children: [...] })` where
the inner describes are un-awaited promises in the children array:

````ts
await describe({
  name: '',
  children: [
    describe({
      name: 'suite A',
      children: [/* ... */],
    },),
    describe({
      name: 'suite B',
      children: [/* ... */],
    },),
  ],
},);
```text

Multiple top-level `await describe(...)` calls break test completeness:
`describe` throws on child failure, so the first failing suite
kills the process and **all subsequent suites are skipped**.
The wrapper pattern runs children through `Promise.allSettled`,
guaranteeing every suite executes regardless of earlier failures.

**Derive `name` from the tested export.**
When the test file exercises a single named export,
derive the suite name from the export itself rather than hardcoding a string literal:

- **Functions**: use `.name`:
  `name: myFunction.name` (stays in sync with renames)
- **Objects**: use `.constructor.name`:
  `name: myObj.constructor.name` (reflects the class or constructor that created it)

This keeps suite names automatically consistent with refactors.
Fall back to a string literal only when no single export is the test subject
(e.g. integration tests, multi-export modules).

### `it({ name, fn, timeout?, skip?, repeats?, fails?, l? })`

Executes a single test case.
`fn` receives a `TestContext` containing:

- **`expect`**: scoped expect with assertion counting (`expect.assertions(n)`, `expect.hasAssertions()`)
- **`sinon`**: sinon sandbox for stubs, spies, and fake timers; auto-restores after the test.
  The sandbox is created with default config.
  Custom `SinonSandboxConfig` is not supported;
  its only useful option (`useFakeTimers`) is already callable directly via `sinon.useFakeTimers()`.

The global `expect` still works for tests that do not destructure the context.
Returns `{ name }` on success.
Throws `Error(name, { cause })` on failure or timeout.

- **`skip`** (`boolean | string`, default `false`): skips execution entirely, logs `SKIP`, and returns immediately;
  a string is logged as the reason
- **`repeats`** (default `0`): number of additional runs after the first execution;
  `repeats: 2` runs the test 3 times total, with labels like `[run 1/3]`
- **`fails`** (`boolean | string`, default `false`): inverts pass/fail logic;
  a throwing test is treated as PASS, a passing test as FAIL;
  a string is logged as the reason alongside pass/fail output

### `expect(actual)`

Jest-style matchers backed by chai:

- **Equality**: `toBe` (strict `===`), `toEqual` (deep), `toStrictEqual` (deep, alias for `toEqual`: chai's deep equality is strict by default)
- **Truthiness**: `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeNaN`
- **Numeric**: `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`
- **Strings**: `toMatch` (regex or string)
- **Collections**: `toContain` (reference equality), `toContainEqual` (deep equality), `toHaveLength`, `toHaveProperty`, `toMatchObject`
- **Errors**: `toThrow` (bare, message, regex, or class)
- **Types**: `toBeInstanceOf`, `toBeTypeOf` (native `typeof` check)
- **Predicates**: `toSatisfy` (custom predicate function)
- **All-equal collections**: `toAllBe` (every array element strictly equals the first, mirrors `toBe`), `toAllEqual` (deep, mirrors `toEqual`), `toSatisfyAll` (predicate holds for every element)
- **Negation**: `expect(x).not.toBe(y)`
- **Async errors**: await first, then assert on the caught error (see "Async error assertions")
- **Promise rejection** (legacy): `await expect(promise).rejects.toBeInstanceOf(Error)`
- **Promise resolution** (legacy): `await expect(promise).resolves.toBe(42)`

The all-equal matchers take an array actual and anchor on its first element, so
they assert mutual equality across the whole array (`expect([a, b, c]).toAllBe()`
replaces a transitive `toBe` chain). `toAllBe` and `toAllEqual` throw on a
non-array actual or fewer than two values, since comparing zero or one value is a
test-author mistake; `toSatisfyAll` passes vacuously on an empty array, mirroring
`Array.prototype.every`.

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
import { expectTypeOf, } from '@monochromatic-dev/module-test';

expectTypeOf<string>().toEqualTypeOf<string>();
expectTypeOf({ a: 1, },).toHaveProperty('a',);
expectTypeOf<() => void>().toBeFunction();
```text

## Output format

Test output goes through `@monochromatic-dev/module-logger`. Every line carries the
full suite hierarchy as a tag chain, so the parent-children mapping is always visible
without a separate enumeration. The harness keeps default output compact by surfacing
one suite-level info line per parent and demoting per-test `PASS` to `debug`.

### Per-line shape

```text
[level] [iso-timestamp] [outer] [inner] [child] message
```text

The leftmost tag is the outermost `describe`; the rightmost tag is the current `it`
or innermost `describe`. The chain falls out of `tagged` composition: each suite
wraps its parent's logger with its own name, and `it` wraps that again with the
test name. Empty-name suites contribute no tag segment.

### What each level emits

- **`info`**: per-suite `[outer] [inner] PASS childA, childB, ... (<duration>)` listing
  every fulfilled child (tests and nested describes alike) plus the suite's
  wall-clock duration. Mixed-result suites still emit a names list (without
  duration) so passing siblings stay visible alongside the error-level FAIL
  rollup. `SKIP` messages from `it` are also `info`. Visible by default.
- **`error`**: `[chain...] FAIL (<duration>)` for each failing test, plus a rollup
  `[chain...] FAIL (<duration>)` for each suite that has failing children. Always visible.
- **`debug`**: per-test `[chain...] PASS (<duration>)` for each passing test (full
  hierarchy in the tag chain), per-suite `[chain...] start (concurrency: N)`
  traces, and the rollup for empty-name (invisible) suites. Hidden by default;
  enable with `MONOCHROMATIC_VERBOSE=true` or `--verbose`.

The duration renders adaptively: below 10ms shows one decimal place (`0.3ms`,
`9.9ms`), 10ms to 999ms shows whole milliseconds (`51ms`, `999ms`), and 1000ms
or more shows seconds with one decimal (`1.2s`, `15.3s`). The harness measures
with `performance.now()`, so the sub-ms detail reflects the underlying clock,
not a synthetic estimate.

### Worked example

For a file laid out as:

```ts
await describe({
  name: '',
  children: [
    describe({
      name: 'math',
      children: [
        it({ name: 'adds', fn: async () => expect(1 + 1,).toBe(2,), },),
        it({ name: 'subtracts', fn: async () => expect(2 - 1,).toBe(1,), },),
      ],
    },),
  ],
},);
````

a successful run prints (default verbosity):

```text
[info] [...] [math] PASS adds, subtracts (1.4ms)
```

The empty-name root suite's enumeration goes to `debug`,
 so it stays silent.
 With
`MONOCHROMATIC_VERBOSE=true`,
 per-test detail surfaces too:

```text
[debug] [...] [math] start (concurrency: 16)
[debug] [...] [math] [adds] PASS (0.5ms)
[debug] [...] [math] [subtracts] PASS (0.6ms)
[info]  [...] [math] PASS adds, subtracts (1.4ms)
[debug] [...] PASS math (1.5ms)
```

A failure in `subtracts` emits (default verbosity):

```text
[error] [...] [math] [subtracts] FAIL (0.7ms) Error: ... at fn (math.unit.test.ts:9:19) at runFnOnce (...)
Caused by: Error: ... at otherFn (...) at ...
[info]  [...] [math] PASS adds
[error] [...] [math] FAIL (1.4ms) Error: subtracts at runIt (...) at ...
Caused by: Error: ... at fn (math.unit.test.ts:9:19) at ...
```

The failing test's FAIL line emits during execution (from inside `runIt`),
 so
it appears first.
 After all children settle,
 the parent suite emits the
passing-siblings list (so `adds` stays visible at `info`) and then the
suite-level `FAIL` rollup with wall-clock duration.
 `Error.cause` carries the
original failure for stack-trace navigation;
 the `name` of each thrown `Error`
matches the corresponding tag segment.

### Inline error diagnostics

Every `FAIL` summary line is fused with the caught error's first formatted
line (header plus stack frames concatenated inline) in the same `l.error`
call,
 so the whole thing fits on a single tagged line and `grep` matches by
message,
 class,
 or frame.
 Subsequent `.cause` chain entries (each marked
`Caused by:`) and `AggregateError.errors` entries (marked `[N/M]`) follow on
the next lines,
 untagged because readers already know which suite or test the
error belongs to from the summary's tag.
 Each suite that re-throws walks the
chain again with its own wrapping,
 so a deeply nested failure appears at
every enclosing level.

The log stream alone is sufficient for diagnosis.
 This holds whether the
rejection escapes uncaught (where Bun's runtime printer would also fire) or is
caught programmatically (where the runtime printer never fires).
 Non-Error
throws (`throw 'oops'`,
 `throw 42`,
 `throw null`) render as a single
`Threw non-Error value: ...` continuation line.

### Top-level `try`/`catch` is supported

```ts
try {
  await describe({ name: 'suite', children: [/* ... */], },);
}
catch (e) {
  // Custom reporter, CI integration, post-failure cleanup, etc.
  // `e` is the wrapped `Error(name, { cause })` from the outermost suite.
}
```

The throw contract is preserved end-to-end.
 Leaf failures throw
`Error(testName, { cause: original })`;
 parent suites wrap their children's
errors in `Error(suiteName, { cause })` for a single failure or
`Error(suiteName, { cause: AggregateError(errors,) })` for multiple;
 the
top-level `await` rejects with the outermost wrapping.
 The `.cause` chain is
walkable programmatically,
 which is also why the inline log is consistent end
to end.

A consequence:
 at process entry where no `try`/`catch` wraps the top-level
`await`,
 Bun's runtime printer dumps the cause chain again at the bottom,
after the harness output.
 This duplicates content already inline-logged.
 The
harness deliberately does not suppress Bun's printer because the alternatives
each violate either the Promise contract or library isolation:

- Swallow at descriptor `then`:
   lies to awaiters (resolves with `undefined` on
  failure),
   silently discards user `onrejected` handlers,
   breaks `Promise.all`
  failure visibility,
   hides nested-await failures inside test fns.
- Process-wide `unhandledRejection` handler installed on import:
   invisible
  global side effect that affects any non-test code in the same process.

Users who find the tail dump noisy can wrap their top-level `await` in
`try`/`catch`;
 the wrapped error is fully diagnostic and the runtime printer
no longer activates.

## Usage

### Basic suite with matchers

```ts
// math.unit.test.ts
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

await describe({
  name: '',
  children: [
    it({
      name: 'adds two numbers',
      fn: async () => {
        expect(1 + 2,).toBe(3,);
      },
    },),
    it({
      name: 'deep-equals objects',
      fn: async () => {
        expect({ a: 1, b: [2, 3,], },).toEqual({ a: 1, b: [2, 3,], },);
      },
    },),
    it({
      name: 'checks types and truthiness',
      fn: async () => {
        expect(null,).toBeNull();
        expect(undefined,).toBeUndefined();
        expect(1,).toBeDefined();
        expect(1,).toBeTruthy();
        expect(0,).toBeFalsy();
        expect(Number.NaN,).toBeNaN();
        expect(new TypeError('x',),).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'numeric comparisons',
      fn: async () => {
        expect(5,).toBeGreaterThan(3,);
        expect(5,).toBeGreaterThanOrEqual(5,);
        expect(3,).toBeLessThan(5,);
        expect(5,).toBeLessThanOrEqual(5,);
        expect(0.1 + 0.2,).toBeCloseTo(0.3,);
      },
    },),
    it({
      name: 'strings and collections',
      fn: async () => {
        expect('hello world',).toMatch(/world/,);
        expect('hello world',).toContain('world',);
        expect([1, 2, 3,],).toContain(2,);
        expect([1, 2, 3,],).toHaveLength(3,);
        expect({ a: 1, },).toHaveProperty('a', 1,);
        expect({ a: 1, b: 2, c: 3, },).toMatchObject({ a: 1, b: 2, },);
      },
    },),
  ],
  timeout: 5000,
},);
```

### Negation with `not`

```ts
expect(1,).not.toBe(2,);
expect([1, 2, 3,],).not.toContain(4,);
expect(1,).not.toBeUndefined();
```

### Error assertions with `toThrow`

```ts
it({
  name: 'catches errors',
  fn: async () => {
    expect(() => {
      throw new Error('boom',);
    },)
      .toThrow();
    expect(() => {
      throw new Error('boom',);
    },)
      .toThrow('boom',);
    expect(() => {
      throw new Error('boom',);
    },)
      .toThrow(/boo/,);
    expect(() => {
      throw new TypeError('x',);
    },)
      .toThrow(TypeError,);
  },
},);
```

### Async error assertions

Await the async operation first,
 then assert on the result or caught error.
Avoid `.rejects` and `.resolves`:
 they add an indirection layer
that obscures stack traces and makes assertion failures harder to diagnose.

```ts
// Preferred: await first, assert on the error
it({
  name: 'rejects on invalid input',
  fn: async () => {
    let caught: unknown;
    try {
      await parseConfig('/nonexistent',);
    }
    catch (error) {
      caught = error;
    }
    expect(caught,).toBeInstanceOf(ConfigError,);
    expect((caught as Error).message,).toContain('not found',);
  },
},);

// Preferred: await first, assert on the resolved value
it({
  name: 'resolves to the parsed config',
  fn: async () => {
    const result = await parseConfig('/valid/path',);
    expect(result,).toHaveProperty('version', 2,);
  },
},);
```

**Why not `.rejects`/`.resolves`?
**

- The rejected value is already unwrapped,
   but `.rejects.toThrow()` passes it to
  chai's `.throw()` which expects a **function** to call,
   a semantic mismatch.
  The harness patches around this,
   but the indirection remains fragile.
- `.resolves.toBe(x)` is strictly equivalent to `const v = await p; expect(v).toBe(x)`
  with worse stack traces.
- Awaiting first gives direct access to the value for multiple assertions
  without re-awaiting the same promise.

The `.rejects` and `.resolves` APIs exist for compatibility
but should not be used in new test code.

### Duration and hang assertions

There is no dedicated `toTakeLongerThan` / `toResolveWithin` matcher
and no `expect.poll` / `vi.waitFor` equivalent;
both Vitest features are intentionally omitted
(see [expect matchers](#expect-matchers) and [Mocking and spies (vi object)](#mocking-and-spies-vi-object)).
Both patterns compose from existing primitives.

**Assert that something takes more than N ms** by measuring with `performance.now()`
and asserting the elapsed delta with `toBeGreaterThan`:

```ts
it({
  name: 'is slow',
  fn: async ({ expect, },) => {
    const start = performance.now();
    await someOperation();
    expect(performance.now() - start,).toBeGreaterThan(100,);
  },
},);
```

**Assert that something hangs**,
 in two forms.

**Loose form**:
 combine the `timeout` and `fails` options.
`runFnOnce` wraps `fn` in `withTimeout` from `@monochromatic-dev/module-async-time`,
which throws when the timer expires;
`fails: true` inverts pass/fail logic so the timeout-throw counts as PASS:

```ts
it({
  name: 'never resolves',
  timeout: 100,
  fails: 'expected to hang',
  fn: async () => {
    await new Promise(() => {},);
  },
},);
```

The loose form swallows **any** throw as PASS,
 including throws unrelated to hanging.
If the fn throws synchronously for a different reason,
 the test still passes
and the real bug is hidden.

**Strict form**:
 call `withTimeout` directly inside the fn,
catch the rejection,
 and assert on the error message.
This rejects unrelated throws as real failures
and only treats the labeled timeout error as success:

```ts
import { withTimeout, } from '@monochromatic-dev/module-async-time';

it({
  name: 'hangs',
  fn: async ({ expect, },) => {
    let caught: unknown = undefined;
    try {
      await withTimeout({
        promise: possiblyHangingOp(),
        ms: 100,
        label: 'possiblyHangingOp',
      },);
    }
    catch (error) {
      caught = error;
    }
    expect(caught,).toBeInstanceOf(Error,);
    expect((caught as Error).message,).toContain('Timed out after 100ms',);
  },
},);
```

Caveats common to both forms:

- The assertion is "did not finish within N ms",
   not "hangs forever";
  the halting problem prevents the framework from distinguishing the two.
  Pick a `timeout` that is comfortably longer than any legitimate completion path
  the code under test might take.
- A genuinely infinite synchronous loop (`while (true) {}`) blocks the event loop,
  so the `withTimeout` timer never fires and the test hangs the whole process.
  This pattern only catches **async** hangs:
  unresolved promises,
   awaits on never-settling I/O,
   deadlocked locks.
  For sync infinite loops,
   isolate the call in a worker or subprocess
  and apply the timeout there.

### Skipping tests

```ts
it({
  name: 'not ready yet',
  skip: 'waiting for upstream fix #123',
  fn: async () => {
    // never runs; logs "SKIP: waiting for upstream fix #123"
  },
},);
```

### Repeating tests for flakiness detection

```ts
it({
  name: 'stable under repetition',
  repeats: 4,
  fn: async () => {
    // runs 5 times total (1 + 4 repeats), labeled [run 1/5] through [run 5/5]
    // stops on first failure
    expect(Math.random(),).toBeLessThan(1,);
  },
},);
```

### Expected failures with `fails`

```ts
it({
  name: 'known broken behavior',
  fails: 'parser bug #456',
  fn: async () => {
    // logs "PASS: threw as expected (parser bug #456)"
    throw new Error('expected to break',);
  },
},);
```

### Nested suites

```ts
await describe({
  name: 'outer',
  children: [
    describe({
      name: 'inner',
      children: [
        it({ name: 'deep test', fn: async () => expect(true,).toBeTruthy(), },),
      ],
    },),
  ],
},);
```

### Concurrency control

The `concurrency` option controls how many children run at the same time.
Children are lazy descriptors and do not start until the parent dispatches
them,
 so the limit takes effect uniformly regardless of how the children
were constructed.

**Sequential** (`concurrency: 1`):
 runs children one at a time via `for...of`:

```ts
await describe({
  name: 'database migration -- migrations depend on previous state',
  concurrency: 1,
  children: [
    it({
      name: 'creates table',
      fn: async () => {
        await db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)',);
        expect(await db.tableExists('users',),).toBe(true,);
      },
    },),
    it({
      name: 'inserts row',
      fn: async () => {
        await db.exec('INSERT INTO users (id) VALUES (1)',);
        expect(await db.count('users',),).toBe(1,);
      },
    },),
  ],
},);
```

**Bounded** (`concurrency: 3`):
 caps simultaneous children via `p-limit`:

```ts
await describe({
  name: 'rate-limited API calls',
  concurrency: 3,
  children: Array.from({ length: 10, }, (_, index,) =>
    it({
      name: `request ${index}`,
      fn: async () => {
        const res = await fetch(`/api/item/${index}`,);
        expect(res.status,).toBe(200,);
      },
    },),),
},);
```

**Unbounded** (`concurrency: Infinity`):
 raw `Promise.allSettled`,
 no `p-limit` overhead:

```ts
await describe({
  name: 'unbounded parallelism',
  concurrency: Infinity,
  children: tests,
},);
```

### Parameterized tests

Use `.map()` over test data to generate `it` calls.

```ts
const cases = [
  { input: 0, expected: 1, },
  { input: 1, expected: 1, },
  { input: 5, expected: 120, },
  { input: 10, expected: 3628800, },
];

await describe({
  name: '',
  children: cases.map(({ input, expected, },) =>
    it({
      name: `factorial(${input}) = ${expected}`,
      fn: async () => {
        expect(factorial(input,),).toBe(expected,);
      },
    },)
  ),
},);
```

### Todo tests

Use `skip: true` with a descriptive name to mark planned tests.

```ts
it({
  name: 'TODO: handle edge case with empty input',
  skip: true,
  fn: async () => {},
},);
```

### Custom predicates with `toSatisfy`

```ts
expect(42,).toSatisfy(n => typeof n === 'number' && n > 0);
expect('hello',).not.toSatisfy(s => typeof s === 'number');
```

### Deep equality in arrays with `toContainEqual`

```ts
const users = [{ id: 1, name: 'Alice', }, { id: 2, name: 'Bob', },];
expect(users,).toContainEqual({ id: 1, name: 'Alice', },);
```

### Fake timers

Sinon's fake timer API is available through the context's `sinon` sandbox.

```ts
it({
  name: 'debounce fires after delay',
  fn: async ({ sinon, expect, },) => {
    const clock = sinon.useFakeTimers();
    const callback = sinon.spy();

    debounce(callback, 100,)();
    expect(callback,).not.toHaveBeenCalled();

    clock.tick(100,);
    expect(callback,).toHaveBeenCalledTimes(1,);
  },
},);
```

### Assertion counting with scoped `expect`

Each `it` passes a `TestContext` with a scoped `expect` to `fn`.
Use `expect.assertions(n)` or `expect.hasAssertions()` to verify
the right number of assertions ran;
 prevents silently passing async tests.

```ts
it({
  name: 'catches all async branches',
  fn: async ({ expect, },) => {
    expect.assertions(2,);

    const result = await fetchData();
    expect(result.status,).toBe(200,);
    expect(result.body,).toBeDefined();
  },
},);

it({
  name: 'at least one assertion runs',
  fn: async ({ expect, },) => {
    expect.hasAssertions();

    if (featureEnabled)
      expect(getFeature(),).toBeTruthy();
  },
},);
```

The global `expect` (imported directly) works for tests that do not need assertion counting.
The scoped `expect` supports all the same matchers and asymmetric matchers.

### Type-level assertions

```ts
import { expectTypeOf, } from '@monochromatic-dev/module-test';

expectTypeOf<string>().toEqualTypeOf<string>();
expectTypeOf<string>().not.toEqualTypeOf<number>();
expectTypeOf({ a: 1, b: 'hello', },).toHaveProperty('a',);
expectTypeOf<() => string>().returns.toBeString();
```

### Setup and teardown

There are no built-in lifecycle hooks.
Define plain functions and call them explicitly.
This keeps control flow visible;
 no implicit lifecycle runs behind the scenes.

For **per-test** setup/teardown,
 call functions at the start and end of each `fn`:

```ts
async function beforeEach() {
  await db.clear();
  await db.seed({ users: [{ id: 1, name: 'Alice', },], },);
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
        const user = await findUser(1,);
        expect(user,).toHaveProperty('name', 'Alice',);
        await afterEach();
      },
    },),
    it({
      name: 'returns undefined for missing user',
      fn: async () => {
        await beforeEach();
        const user = await findUser(999,);
        expect(user,).toBeUndefined();
        await afterEach();
      },
    },),
  ],
},);
```

For **suite-level** setup/teardown,
 use top-level statements before and after `describe`:

```ts
const server = await startTestServer();

await describe({
  name: 'api',
  children: [
    it({
      name: 'returns 200',
      fn: async () => {
        const res = await fetch(server.url,);
        expect(res.status,).toBe(200,);
      },
    },),
  ],
},);

await server.close();
```

### Stubs and spies

The `sinon` sandbox from `TestContext` auto-restores after each test.

**Stubbing shared global state requires sequential execution.
**
When tests stub prototype methods or module-level variables
(`sinon.stub(SomeClass.prototype, 'method')`),
the stub affects all code running in the process,
 including concurrent tests.
Sinon refuses to wrap an already-wrapped method,
 throwing
`"Attempted to wrap X which is already wrapped"`.
To avoid this,
 set `concurrency: 1` on the `describe` that contains those
tests;
 children are lazy descriptors and the parent dispatches them one at a
time:

```ts
await describe({
  name: 'service with HTTP stubs',
  concurrency: 1,
  children: [
    it({
      name: 'handles success',
      fn: async ({ sinon, },) => {
        sinon.stub(HttpClient.prototype, 'fetch',).resolves({ ok: true, },);
        // ...
      },
    },),
    it({
      name: 'handles failure',
      fn: async ({ sinon, },) => {
        sinon.stub(HttpClient.prototype, 'fetch',).rejects(
          new Error('network',),
        );
        // ...
      },
    },),
  ],
},);
```

Stubbing **local** objects (created within the test) is safe at any concurrency;
each test has its own object,
 so stubs never overlap.

```ts
await describe({
  name: 'mocking',
  children: [
    it({
      name: 'stubs a method',
      fn: async ({ sinon, },) => {
        const obj = { greet: (_name: string,): string => 'hi', };
        const stub = sinon.stub(obj, 'greet',).returns('hello',);

        obj.greet('world',);

        expect(stub,).toHaveBeenCalled();
        expect(stub,).toHaveBeenCalledTimes(1,);
        expect(stub,).toHaveBeenCalledWith('world',);
        expect(stub,).toHaveReturnedWith('hello',);
      },
    },),
    it({
      name: 'spy without changing behavior',
      fn: async ({ sinon, },) => {
        const obj = { getValue: (): number => 42, };
        const spy = sinon.spy(obj, 'getValue',);

        obj.getValue();

        expect(spy,).toHaveBeenCalled();
        expect(spy,).toHaveReturnedWith(42,);
      },
    },),
  ],
},);
```

### Asymmetric matchers

Used inside `toHaveBeenCalledWith` to match arguments partially.

```ts
it({
  name: 'partial argument matching',
  fn: async ({ sinon, },) => {
    const spy = sinon.spy();
    spy('hello world', { id: 1, name: 'test', }, [1, 2, 3,],);

    expect(spy,).toHaveBeenCalledWith(
      expect.stringContaining('hello',),
      expect.objectContaining({ id: 1, },),
      expect.arrayContaining([1, 3,],),
    );
    expect(spy,).toHaveBeenCalledWith(
      expect.stringMatching(/^hello/,),
      expect.anything(),
      expect.any(Array,),
    );
  },
},);
```

## Vitest parity

Systematic comparison against the [Vitest API](https://vitest.dev/api/) surface.
Items are grouped by category with a status:
**supported** (direct equivalent),
**equivalent** (same functionality via different API),
or **omitted** (intentional gap with rationale).

### Test suite API

**Supported:
**

- `describe(name, fn)`:
   `describe({ name, children })`
- `describe.skip`:
   `describe({ skip: true })` or `describe({ skip: 'reason' })`
- `describe.concurrent`:
   default behavior;
   suites run children concurrently via `Promise.allSettled`
- `describe.sequential`:
   `describe({ concurrency: 1 })`
- `test` / `it`:
   `it({ name, fn })`
- `test.skip`:
   `it({ skip: true })` or `it({ skip: 'reason' })`
- `test.fails`:
   `it({ fails: true })` or `it({ fails: 'reason' })`
- `test.todo`:
   `it({ name: 'TODO: ...', skip: true, fn: async () => {} })`
- `describe.todo`:
   same pattern with `describe({ skip: true })`

**Equivalent:
**

- `test.skipIf(condition)`:
   `it({ skip: condition || false })`
- `test.runIf(condition)`:
   `it({ skip: !condition || false })`
- `describe.skipIf` / `describe.runIf`:
   same pattern with the `skip` option
- `test.each(cases)` / `test.for(cases)`:
   `cases.map(c => it({ name: ..., fn: ... }))` passed as `children`
- `describe.each` / `describe.for`:
   same `.map()` pattern with `describe`
- `test.concurrent`:
   default behavior;
   all `it` descriptors dispatch through the parent's concurrency limit
- Vitest `maxConcurrency` config;
   `describe({ concurrency: n })` per suite;
   see "Concurrency model comparison" below
- `describe.timeout`:
   `describe({ timeout: ms })`
- `test.timeout`:
   `it({ timeout: ms })`
- `test.repeats`:
   `it({ repeats: n })` (Vitest has `retry` which retries on failure;
  our `repeats` always re-runs regardless of outcome)

**Omitted:
**

- **`test.only` / `describe.only`**:
  everything is eager execution;
   there is no central runner to filter through.
  Pipe test output to `rg` to focus on a specific test name.
- **`describe.shuffle`**:
  randomizing test order is a workaround for shared-state bugs.
  Concurrent-by-default execution already surfaces those immediately;
  if tests pass concurrently,
   order is irrelevant.
- **`test.extend` / fixtures**:
  adds a fixtures system with automatic setup/teardown.
  Plain functions called explicitly in each test serve the same purpose
  without hiding control flow.
- **`test.scoped` / `test.override`**:
   fixture-related;
   same reasoning as `test.extend`
- **`bench`**:
   benchmarking is a separate concern;
   use dedicated benchmarking tools

### Lifecycle hooks

**Equivalent:
**

- `beforeEach` / `afterEach`:
   define plain functions;
   call at start/end of each `fn`.
  See the "Setup and teardown" usage section.
- `beforeAll` / `afterAll`:
   top-level statements before and after `describe`.
- `aroundEach` / `aroundAll`:
   compose before/after functions manually

**Omitted:
**

- **`onTestFinished` / `onTestFailed`**:
  use try/catch or `await using` within the test body for cleanup-on-failure patterns.
  No implicit hook system means no hidden execution order.

### expect matchers

**Supported** (direct 1:1 equivalents):

- **Equality**:
   `toBe`,
   `toEqual`,
   `toStrictEqual`
- **Truthiness**:
   `toBeTruthy`,
   `toBeFalsy`,
   `toBeNull`,
   `toBeDefined`,
   `toBeUndefined`,
   `toBeNaN`
- **Numeric**:
   `toBeGreaterThan`,
   `toBeGreaterThanOrEqual`,
   `toBeLessThan`,
   `toBeLessThanOrEqual`,
   `toBeCloseTo`
- **Type**:
   `toBeInstanceOf`,
   `toBeTypeOf`
- **String/pattern**:
   `toMatch`
- **Collections**:
   `toContain`,
   `toContainEqual`,
   `toHaveLength`,
   `toHaveProperty`,
   `toMatchObject`
- **Error**:
   `toThrow` (bare,
   message string,
   regex,
   error class)
- **Predicate**:
   `toSatisfy`
- **Negation**:
   `not` modifier
- **Promise**:
   `resolves`,
   `rejects` modifiers (legacy;
   prefer awaiting first;
   see README)

**Omitted:
**

- **`toBeNullable`**:
  `expect(x).toSatisfy(v => v === null || v === undefined)` covers this.
  Not common enough to warrant a dedicated matcher.
- **`toBeOneOf`**:
  `expect([a, b, c]).toContain(actual)` or `toSatisfy` with `includes` achieves the same check.
- **Snapshot matchers** (`toMatchSnapshot`,
   `toMatchInlineSnapshot`,
   `toMatchFileSnapshot`,
  `toThrowErrorMatchingSnapshot`,
   `toThrowErrorMatchingInlineSnapshot`):
  snapshot tests encode serialization format as a correctness criterion,
  causing spurious failures on whitespace,
   key ordering,
   or formatter changes.
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

**Omitted:
**

- **`toHaveBeenCalledBefore` / `toHaveBeenCalledAfter`**:
  sinon tracks `callCount` and call ordering natively;
  compare `spy.calledBefore(otherSpy)` directly in a `toSatisfy` if needed.
- **`toHaveResolved*`** (`toHaveResolved`,
   `toHaveResolvedTimes`,
   `toHaveResolvedWith`,
  `toHaveLastResolvedWith`,
   `toHaveNthResolvedWith`):
  async spy result tracking requires Vitest's internal mock wrapper.
  Use `await` + standard matchers on the return value instead.

### Asymmetric matchers

**Supported:
**

- `expect.anything()`
- `expect.any(Constructor)`
- `expect.arrayContaining(arr)`
- `expect.objectContaining(obj)`
- `expect.stringContaining(str)`
- `expect.stringMatching(pattern)`

**Omitted:
**

- **`expect.closeTo`**:
  our asymmetric matchers are sinon matchers,
   so `closeTo` would only work
  inside `toHaveBeenCalledWith` but not inside `toEqual`;
  an inconsistency that would confuse users expecting Vitest behavior.
  Use `toBeCloseTo` directly for float comparisons.
- **`expect.not.*`** (negated asymmetric matchers):
  `expect.not.stringContaining(...)`,
   `expect.not.objectContaining(...)`,
   etc.
  Too niche to justify the added API surface.
- **`expect.schemaMatching`**:
  Standard Schema v1 validation is a separate concern;
   validate before asserting.
- **`expect.toBeOneOf`** (asymmetric):
  same rationale as the regular `toBeOneOf` matcher.

### Assertion control

**Supported:
**

- `expect.assertions(n)`:
   via scoped `expect` from `TestContext`
- `expect.hasAssertions()`:
   via scoped `expect` from `TestContext`

**Omitted:
**

- **`expect.unreachable(message?)`**:
  `throw new Error(message)` is equivalent and more explicit.
- **`expect.soft`**:
  soft assertions collect all failures instead of short-circuiting.
  Since suites already run children concurrently and report all failures
  via `AggregateError`,
   the benefit is narrow;
  it only matters within a single `it` with many assertions.
- **`expect.poll`**:
  retry-based assertions belong in application code (`waitFor` patterns),
  not in the assertion library.
  For duration and hang assertions specifically,
  see [Duration and hang assertions](#duration-and-hang-assertions).
- **`expect.extend`**:
  custom matchers add framework-specific API surface.
  Use `toSatisfy` with a predicate function instead.
- **`expect.addSnapshotSerializer`**:
   snapshot testing is omitted entirely
- **`expect.addEqualityTesters`**:
   chai's deep equality is sufficient;
  custom equality logic belongs in the comparison function,
   not the test framework

### Mocking and spies (vi object)

Sinon replaces Vitest's `vi` object.
The `TestContext.sinon` sandbox auto-restores after each test.

**Equivalent:
**

- `vi.fn(impl?)`:
   `sinon.stub()` or `sinon.spy(impl)`
- `vi.spyOn(obj, method)`:
   `sinon.spy(obj, 'method')` or `sinon.stub(obj, 'method')`
- `vi.useFakeTimers()`:
   `sinon.useFakeTimers()`
- `vi.advanceTimersByTime(ms)`:
   `clock.tick(ms)` (where `clock = sinon.useFakeTimers()`)
- `vi.clearAllMocks()`:
   `sinon.reset()`
- `vi.restoreAllMocks()`:
   `sinon.restore()` (automatic via `await using`)
- `vi.isFakeTimers()`:
   check `clock` reference existence
- `vi.setSystemTime(date)`:
   `sinon.useFakeTimers(date)` or `clock.setSystemTime(date)`
- `vi.getRealSystemTime()`:
   `Date.now()` before `useFakeTimers`,
   or `clock.now`
- `vi.runAllTimers()`:
   `clock.runAll()`
- `vi.runAllTimersAsync()`:
   `await clock.runAllAsync()`
- `vi.advanceTimersToNextTimer()`:
   `clock.next()`
- `vi.advanceTimersToNextTimerAsync()`:
   `await clock.nextAsync()`
- `vi.runOnlyPendingTimers()`:
   `clock.runToLast()`
- `vi.getTimerCount()`:
   `clock.countTimers()`
- `vi.clearAllTimers()`:
   `clock.reset()`
- `MockInstance.mockReturnValue(v)`:
   `stub.returns(v)`
- `MockInstance.mockReturnValueOnce(v)`:
   `stub.onFirstCall().returns(v)` (or `onSecondCall`,
   etc.)
- `MockInstance.mockImplementation(fn)`:
   `stub.callsFake(fn)`
- `MockInstance.mockResolvedValue(v)`:
   `stub.resolves(v)`
- `MockInstance.mockRejectedValue(v)`:
   `stub.rejects(v)`
- `MockInstance.mockClear()`:
   `spy.resetHistory()`
- `MockInstance.mockReset()`:
   `stub.reset()`
- `MockInstance.mockRestore()`:
   `stub.restore()` (automatic via sandbox)
- `MockInstance.mock.calls`:
   `spy.args`
- `MockInstance.mock.results`:
   `spy.returnValues` and `spy.exceptions`
- `MockInstance.mock.lastCall`:
   `spy.lastCall.args`
- `MockInstance.mock.contexts`:
   `spy.thisValues`
- `MockInstance.mock.instances`:
   not directly available;
   use `spy.thisValues` with `new`

**Omitted:
**

- **`vi.mock` / `vi.doMock` / `vi.unmock`** (module mocking):
  requires intercepting ESM imports via a build transform or custom loader,
  which contradicts the no-magic,
   no-custom-module-resolution design.
  Restructure code to accept dependencies as parameters instead.
- **`vi.importActual` / `vi.importMock`**:
   module mocking infrastructure
- **`vi.hoisted`**:
   module mocking infrastructure
- **`vi.mocked`**:
   TypeScript narrowing helper for `vi.fn`;
   sinon types are already correct
- **`vi.mockObject`**:
   deep object mocking;
   create stubs explicitly for the methods needed
- **`vi.stubEnv` / `vi.unstubAllEnvs`**:
   set `process.env` directly;
   restore in afterEach
- **`vi.stubGlobal` / `vi.unstubAllGlobals`**:
   assign to `globalThis` directly;
   restore in afterEach
- **`vi.resetModules`**:
   module mocking infrastructure
- **`vi.dynamicImportSettled`**:
   module mocking infrastructure
- **`vi.waitFor` / `vi.waitUntil`**:
   retry/polling utilities belong in application code,
  not the test framework
- **`vi.setConfig` / `vi.resetConfig`**:
   no per-file configuration to change
- **`vi.defineHelper`**:
   error stack trace rewriting;
   our plain `Error` cause chains
  already provide clear traceability

### Type testing

**Supported:
**

- `expectTypeOf`:
   re-exported from the [expect-type](https://www.npmjs.com/package/expect-type) package.
  All `expectTypeOf` matchers from Vitest are available since Vitest uses the same library.

**Omitted:
**

- **`assertType`**:
   requires Vitest's `--typecheck` mode.
  `expectTypeOf` covers the same use cases without a special runner mode.

### Chai assert API

Vitest re-exports the full Chai `assert` API (100+ methods).
This package does not re-export `assert`;
the Jest-style `expect` API is the single assertion interface.
Chai is a direct dependency,
 so users who want `assert` can import it directly:

```ts
import { assert, } from 'chai';
```

## Concurrency model comparison

Both this harness and Vitest run concurrent tests as in-process promises
within a single thread.
 Neither spawns additional workers for test-level concurrency.
The differences are in scope,
 defaults,
 and error handling.

**Scope of the concurrency limit.
**
Vitest uses a single global semaphore per worker (`maxConcurrency`,
 default 5).
All concurrent suites in a file share that one limiter;
3 concurrent suites each with 5 tests still only run 5 tests at a time total.
This harness uses a **per-suite** limiter via `p-limit`,
 and the effective
limit is inherited by nested describes that don't set their own.
 The root
defaults to 16;
 setting `concurrency: 1` once at the top sequences all
descendants.

**Default mode.
**
Vitest runs tests **sequentially** within a file unless
`test.concurrent` or `describe.concurrent` is used.
This harness runs children **concurrently** by default;
sequential execution is the opt-in (`concurrency: 1`).

**Dispatch primitive.
**
Vitest dispatches concurrent groups via `Promise.all`.
Individual tests catch their own errors internally,
so `Promise.all` effectively behaves like `Promise.allSettled` in practice.
This harness uses `Promise.allSettled` directly,
making the "run all,
 collect all" intent explicit.

**File-level parallelism.
**
Vitest distributes test **files** across OS-level workers
(processes via `forks` or threads via `threads`),
capped at `maxWorkers` (default:
 CPU count).
This harness has no file-level parallelism;
everything runs in a single process.
The test runner (`mise run ...test`) can parallelize files externally if needed.

**Concurrency control surface.
**
Vitest has separate APIs:
 `describe.concurrent` / `test.concurrent` (opt-in per suite/test),
`describe.sequential` / `test.sequential` (opt-out overrides),
and a global `maxConcurrency` config (default 5,
 cannot be set per suite).
This harness has a single `concurrency` number per `describe`,
covering sequential (`1`),
 bounded (`2`..`n`),
 and unbounded (`Infinity`) in one option.

## Self-test

```bash
mise run //package/module/test:buildAndTest
```

The test files under `src/*.unit.test.ts` use the package's own primitives to validate itself.
`buildAndTest` builds the harness,
 then runs the shared `test:unit` task,
 which executes each
`*.unit.test.ts` file in its own `bun` process (`mise run //package/module/test:test:unit` once
the dist is built).
 Per-file process isolation keeps each suite's event loop independent;
 a single
shared process let one suite's timers starve another's,
 making a wall-clock concurrency assertion
flaky under load.

## Property-based testing (internal)

`format-error.property.unit.test.ts` fuzzes the wide-input surfaces of `format-error.ts` with
[fast-check](https://www.npmjs.com/package/fast-check).
 fast-check is an internal dev tool for this
self-test only:
 it is a `devDependency`,
 is not re-exported from `index.ts`,
 and never reaches
consumers of the harness.

Conventions for adding property tests here:

- No wrapper.
   Call `await assert(asyncProperty(arbitrary, predicate), { numRuns })` directly inside
  an `it` `fn`.
   A thrown counterexample propagates out of `fn` and the harness records it as a
  normal FAIL,
   so no integration layer is needed;
   this matches the harness's no-magic design.
- Write predicates as named functions (the workspace callback style),
   single-argument where
  possible (bundle multiple generated values into one `record` arbitrary).
- Inside a predicate,
   use the imported global `expect`,
   never the scoped `expect.assertions(n)` from
  `TestContext`.
   A property runs its body `numRuns` times,
   so assertion counting would multiply and
  misfire.
- Bind `numRuns` to a named constant and set an explicit `timeout` on the `it`;
   a property runs its
  body many times,
   so the default single-assertion budget is too tight.
- Leave the seed random.
   On failure fast-check prints the `seed`,
   the shrunk `Counterexample`,
   and a
  `path`,
   which together reproduce the exact case;
   pin nothing.
- Assert invariants that can actually fail.
   A vacuous shape check (`Array.isArray(...)`) passes
  whether or not the property exercises anything;
   prefer falsifiable invariants (exact line counts,
  marker presence,
   fragment absence).
   The cycle-marker property was verified to fail and shrink to
  the minimal counterexample when the source marker was changed.

## Dependencies

- **chai**:
   assertion engine
- **chai-as-promised**:
   registered as a chai plugin for users who prefer chai's `.eventually` syntax over the built-in `rejects`/`resolves` API
- **expect-type**:
   compile-time type assertions,
   re-exported as `expectTypeOf`
- **sinon**:
   stubs,
   spies,
   sandboxes (exposed via `TestContext.sinon`)
- **sinon-chai**:
   chai plugin for sinon matchers
- **@monochromatic-dev/module-logger**:
   tagged logger

fast-check is a `devDependency` used only by the property-based self-tests;
 it is not a runtime
dependency and is not part of the public API.
