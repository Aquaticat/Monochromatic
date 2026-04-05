# @monochromatic-dev/module-test

Jest-style test harness built on chai and sinon.
Designed to replace `bun:test` as the monorepo's test primitive
with a runtime-neutral, self-contained alternative.

## Why

`bun:test` couples every test file to a single runtime.
This package provides the same ergonomic API (`describe`, `it`, `expect`)
backed by chai for assertions and sinon for mocking,
so tests run on any JavaScript runtime that supports ESM.

## API

### `describe({ name, children, timeout?, l? })`

Runs all children concurrently via `Promise.allSettled`.
Returns `{ name }` on success.
Throws `Error(name, { cause })` on failure,
with `AggregateError` as cause when multiple children fail.
Empty name makes the suite invisible in the error chain.

Logs `childName <- suiteName` for each child result.

### `it({ name, fn, timeout?, skip?, repeats?, fails?, l? })`

Executes a single test case.
Returns `{ name }` on success.
Throws `Error(name, { cause })` on failure or timeout.

- **`skip`** (default `false`) -- skips execution entirely, logs `SKIP`, and returns immediately
- **`repeats`** (default `0`) -- number of additional runs after the first execution;
  `repeats: 2` runs the test 3 times total, with labels like `[run 1/3]`
- **`fails`** (default `false`) -- inverts pass/fail logic;
  a throwing test is treated as PASS, a passing test as FAIL

### `expect(actual)`

Jest-style matchers backed by chai:

- **Equality**: `toBe` (strict `===`), `toEqual` (deep)
- **Truthiness**: `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeNaN`
- **Numeric**: `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`
- **Strings**: `toMatch` (regex or string)
- **Collections**: `toContain`, `toHaveLength`, `toHaveProperty`, `toMatchObject`
- **Errors**: `toThrow` (bare, message, regex, or class)
- **Types**: `toBeInstanceOf`
- **Negation**: `expect(x).not.toBe(y)`
- **Promise rejection**: `await expect(promise).rejects.toBeInstanceOf(Error)`
- **Promise resolution**: `await expect(promise).resolves.toBe(42)`

Sinon-chai matchers for stubs and spies:

- `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, `toHaveReturnedWith`

Asymmetric matchers for use inside `toHaveBeenCalledWith`:

- `expect.stringContaining`, `expect.stringMatching`, `expect.objectContaining`, `expect.arrayContaining`
- `expect.anything`, `expect.any`

### `createSinon(config?)`

Returns a sinon sandbox with `Symbol.dispose` and `Symbol.asyncDispose` attached.
Use with `await using` for automatic cleanup:

```ts
await using sandbox = createSinon();
sandbox.stub(obj, 'method').returns('mocked');
// sandbox.restore() called automatically at scope exit
```

## Usage

```ts
import { describe, it, expect, createSinon } from '@monochromatic-dev/module-test';

await describe({
  name: 'math',
  children: [
    it({
      name: 'adds two numbers',
      fn: function adds() {
        expect(1 + 2).toBe(3);
      },
    }),
    it({
      name: 'deep-equals objects',
      fn: function deepEquals() {
        expect({ a: 1 }).toEqual({ a: 1 });
      },
    }),
  ],
  timeout: 5000,
});
```

## Self-test

```bash
mise run //packages/module/test:test
```

The test files under `src/*.unit.test.ts` use the package's own primitives to validate itself.

## Dependencies

- **chai** -- assertion engine
- **chai-as-promised** -- async/promise assertion support
- **sinon** -- stubs, spies, sandboxes
- **sinon-chai** -- chai plugin for sinon matchers
- **@monochromatic-dev/module-es** -- tagged logger
