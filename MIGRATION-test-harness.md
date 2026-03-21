# Migration: bun:test to runtime-neutral test harness

Replace `bun:test` imports across all 73 unit test files with a thin adapter package
that re-exports native test primitives from the host runtime (`bun:test` or `node:test`)
behind a single import path.
Assertions come from `@std/expect` (JSR) on Node; on Bun, `bun:test`'s built-in `expect` is used.

This decouples test files from a specific runtime while keeping all existing syntax intact.

## Motivation

- **Runtime neutrality** -- tests run identically under `bun test` and `node --test`
- **No external test runner** -- each file is self-contained; mise orchestrates file discovery
- **Fully concurrent execution** -- all tests within a file run concurrently
  (bun:test via `concurrentTestGlob`; node:test via `{ concurrency: true }` on describe)
- **ESM-native, TypeScript-first** -- no CJS shims, no `createRequire`, no loaders

## Current state

- 73 `*.unit.test.ts` files import from `bun:test`
- Test primitives used: `describe`, `test`, `expect`, `beforeEach`, `afterEach`
- Advanced APIs: `test.each` (3 files), `test.skip` (2 files), `test.skipIf` (2 files), `spyOn` (2 files)
- `spyOn` usage is limited to `console.log`/`console.warn` spying
  with `.mock.calls[0]?.[0]` and `.mockClear()` -- no `toHaveBeenCalledTimes` or similar
- `bunfig.toml` sets `concurrentTestGlob = "**/*.test.ts"` for within-file concurrency
- `mise run test:unit` discovers files via `rg --files --glob '**/*.unit.test.*'`
  and passes them to `bun test`

## Architecture

### Workspace package: `@monochromatic-dev/test-harness`

Location: `packages/test-fixture/test-harness/`

**Conditional exports** in `package.json` route to runtime-specific entry points:

```json
{
  "name": "@monochromatic-dev/test-harness",
  "type": "module",
  "exports": {
    ".": {
      "bun":     "./src/adapter-bun.ts",
      "node":    "./src/adapter-node.ts",
      "default": "./src/adapter-node.ts"
    }
  },
  "dependencies": {
    "@std/expect": "npm:@jsr/std__expect@*"
  }
}
```

### adapter-bun.ts (~1 line)

Re-exports everything from `bun:test`.
No transformation needed -- the test files already use bun:test's API shape.

```ts
export { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
```

### adapter-node.ts (~50 lines)

Re-exports from `node:test` with two shims:

1.  **`describe` wrapper** -- injects `{ concurrency: true }` as the default option,
    matching bun:test's concurrent behavior set by `concurrentTestGlob`.
    Callers can still pass `{ concurrency: false }` to override.

    ```ts
    import { describe as nodeDescribe } from 'node:test';

    function describe(name: string, fn: () => void): void;
    function describe(name: string, options: Record<string, unknown>, fn: () => void): void;
    function describe(
      name: string,
      optionsOrFn: (() => void) | Record<string, unknown>,
      maybeFn?: () => void,
    ): void {
      if (typeof optionsOrFn === 'function') {
        nodeDescribe(name, { concurrency: true }, optionsOrFn);
      } else {
        nodeDescribe(name, { concurrency: true, ...optionsOrFn }, maybeFn);
      }
    }
    export { describe };
    ```

2.  **`spyOn` adapter** -- normalizes the mock API shape.
    `bun:test` spies expose `.mock.calls` as `[["arg1"], ["arg2"]]` and `.mockClear()`.
    `node:test` mocks expose `.mock.calls` as `[{arguments: ["arg1"]}, ...]`
    and `.mock.resetCalls()`.
    The adapter translates Node's shape to Bun's so test code is unchanged.

    ```ts
    import { mock } from 'node:test';

    function spyOn(obj, method) {
      const nodeSpy = mock.method(obj, method);
      return {
        mock: {
          get calls() {
            return nodeSpy.mock.calls.map(c => c.arguments);
          },
          restore() { nodeSpy.mock.restore(); },
          clear()   { nodeSpy.mock.resetCalls(); },
        },
        mockClear()   { nodeSpy.mock.resetCalls(); },
        mockRestore() { nodeSpy.mock.restore(); },
      };
    }
    export { spyOn };
    ```

3.  **`expect` from `@std/expect`** (JSR) --
    ESM-native, TypeScript-first, cross-runtime (Node/Bun/Deno/browsers).
    Full Jest-compatible matcher set:
    `toBe`, `toEqual`, `toStrictEqual`, `toContain`, `toThrow`, `toBeCloseTo`,
    `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`,
    `toBeUndefined`, `toBeNull`, `toBeTruthy`, `toBeFalsy`, `toHaveLength`,
    `toHaveProperty`, `toMatch`, `toMatchObject`, `toBeInstanceOf`, `not.*`.

    ```ts
    export { expect } from '@std/expect';
    ```

4.  **Remaining re-exports** -- passed through directly.

    ```ts
    export { test, beforeEach, afterEach } from 'node:test';
    ```

### test.each replacement

`node:test` does not have `test.each`. The 3 files that use it should switch to a `for...of` loop:

```ts
// Before (bun:test)
test.each(['.d.ts', '.d.mts'])('returns true for %s extension', ext => {
  expect(shouldIgnoreFile(`/path/file${ext}`)).toBe(true);
});

// After
for (const ext of ['.d.ts', '.d.mts']) {
  test(`returns true for ${ext} extension`, () => {
    expect(shouldIgnoreFile(`/path/file${ext}`)).toBe(true);
  });
}
```

Alternatively, add a `testEach` helper to the harness that generates the loop.

### test.skipIf replacement

`node:test` does not have `test.skipIf`. The 2 files that use it should switch to the options form:

```ts
// Before (bun:test)
test.skipIf(process.platform === 'win32')('unix-only test', () => { ... });

// After
test('unix-only test', { skip: process.platform === 'win32' }, () => { ... });
```

On the Bun path, `test` from `bun:test` also accepts this options form,
so the same syntax works on both runtimes.

## Verified behavior (proof of concept)

All results from prototyping in `/tmp/claude-1000/`:

- **Concurrency**: 3 tests each sleeping 200ms complete in 200ms total (both runtimes)
- **Matchers**: `toBe`, `toEqual`, `toContain`, `toThrow`, `toBeCloseTo`,
  `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeUndefined` all pass
- **spyOn adapter**: `.mock.calls[0]?.[0]`, `.mockClear()`, `.mockRestore()` work
- **test.skip**: works on both runtimes
- **Parameterized tests**: `for...of` loop works on both runtimes
- **ESM-native**: no CJS, no `createRequire` hack
- **TypeScript-native**: Node 25 strips types natively; Bun runs `.ts` natively

**Known concurrency caveat**:
`beforeEach` with `{ concurrency: true }` does not isolate mutable state
between concurrent tests -- both runtimes behave this way.
Tests that share mutable state via `beforeEach` (e.g. a shared spy that gets `mockClear()`-ed)
should either use isolated-per-test state or `{ concurrency: false }` on that specific describe block.
This is the same behavior as the current `concurrentTestGlob` setup.

## Migration steps

### Step 1: create the harness package

1.  Create `packages/test-fixture/test-harness/`
2.  Add `package.json` with conditional exports as shown above
3.  Add `@std/expect` dependency via `bunx jsr add @std/expect`
4.  Write `src/adapter-bun.ts` and `src/adapter-node.ts`
5.  Add `mise.toml` matching sibling packages

### Step 2: install the harness as a workspace dependency

Add `@monochromatic-dev/test-harness` as a devDependency
in every package that has unit tests (via `workspace:*`).

### Step 3: migrate test imports (73 files)

Mechanical find-and-replace per file:

```
- import { describe, test, expect, ... } from 'bun:test';
+ import { describe, test, expect, ... } from '@monochromatic-dev/test-harness';
```

For the 2 files that import `spyOn`:

```
- import { ..., spyOn } from 'bun:test';
+ import { ..., spyOn } from '@monochromatic-dev/test-harness';
```

### Step 4: migrate test.each (3 files)

- `packages/config/oxlint-tsdoc/src/tsdoc-utils.unit.test.ts`
- `packages/module/es/src/deprecated/fs/fs.pathParse.default.unit.test.ts`
- `packages/module/es/src/deprecated/fs/fs.pathJoin.default.unit.test.ts`

Replace `test.each(values)(name, fn)` with `for...of` loop.

### Step 5: migrate test.skipIf (2 files)

- `packages/dev-script/task-util/src/append.unit.test.ts`
- `packages/dev-script/task-util/src/command.unit.test.ts`

Replace `test.skipIf(condition)(name, fn)` with `test(name, { skip: condition }, fn)`.

### Step 6: update mise test tasks

The `test:unit` task in root `mise.toml` currently runs `bun test ...files`.

For runtime-neutral execution, update to detect the preferred runtime
or keep `bun test` as the default (the adapter still works -- Bun resolves the `"bun"` export).

To run under Node: `node --test ...files` (Node 25+ runs `.ts` natively).

### Step 7: verify

Run `mise run buildAndTest` to confirm all tests pass.
Optionally run under Node (`node --test`) to verify cross-runtime behavior.

## Dependencies

| Dependency | Source | Purpose | Size |
|---|---|---|---|
| `@std/expect` | JSR (`@jsr/std__expect`) | Jest-compatible matchers for Node path | 4 packages (ESM-native) |

No other new dependencies.
The Bun adapter path has zero external dependencies (re-exports from `bun:test`).

## Files affected

- **New**: `packages/test-fixture/test-harness/` (package.json, src/adapter-bun.ts, src/adapter-node.ts, mise.toml)
- **Modified**: 73 `*.unit.test.ts` files (import path change)
- **Modified**: 3 files (test.each to for...of)
- **Modified**: 2 files (test.skipIf to options form)
- **Modified**: root `mise.toml` (optional -- update test:unit task for dual-runtime support)

## Risks

- **`@std/expect` matcher parity** -- `@std/expect` covers all matchers used in the codebase.
  It lacks `toThrowErrorMatchingSnapshot` and `toThrowErrorMatchingInlineSnapshot`,
  neither of which are used here.
- **Spy API surface** -- only `.mock.calls`, `.mockClear()`, `.mockRestore()` are used.
  The adapter covers these. If future tests need `toHaveBeenCalledTimes` or similar
  mock matchers, the spy objects would need to carry `@std/expect`'s mock symbol
  (or those assertions would need to use `.mock.calls.length` directly).
- **Node type stripping** -- Node 25's type stripping does not support
  non-erasable TypeScript syntax (`enum`, `namespace`, `as const` on object literals).
  The test files do not use these. If they did, `--experimental-transform-types` or
  a loader like `tsx` would be needed.
