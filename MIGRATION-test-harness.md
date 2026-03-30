# Migration: test harness package

Replace ad-hoc test infrastructure across the monorepo with a shared
`@monochromatic-dev/test-harness` package that provides three layers:

1.  **Unit adapter** -- runtime-neutral re-exports of `bun:test` / `node:test` primitives
    so 73 `*.unit.test.ts` files decouple from a specific runtime.
2.  **Matrix runner** -- typed matrix definition, sequential/parallel execution,
    result collection, and summary reporting for `*.container-test.ts` orchestrators
    and other parameter-sweep scripts.
3.  **Benchmark utilities** -- adopt `tinybench` for micro-benchmarks,
    replacing the hand-rolled `measure()` / `measureAsync()` in `file-enforcer-perf`.

## Motivation

- **Runtime neutrality** -- unit tests run identically under `bun test` and `node --test`
- **No external test runner** -- each file is self-contained; mise orchestrates file discovery
- **Fully concurrent execution** -- all tests within a file run concurrently
  (bun:test via `concurrentTestGlob`; node:test via `{ concurrency: true }` on describe)
- **ESM-native, TypeScript-first** -- no CJS shims, no `createRequire`, no loaders
- **Eliminate repeated boilerplate** -- the matrix execution + result reporting skeleton
  appears in 2 container test files today (47 lines); the harness extracts it once
- **Standardized benchmarking** -- `tinybench` provides statistically sound measurement
  with warmup, iteration control, and cross-runtime support

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

Three entry points via conditional exports:

- `.` -- unit test adapter (runtime-conditional: bun vs node)
- `./matrix` -- matrix runner (runtime-neutral)
- `./bench` -- re-exports from `tinybench` (runtime-neutral)

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
    },
    "./matrix": "./src/matrix.ts",
    "./bench":  "./src/bench.ts"
  },
  "dependencies": {
    "@std/expect": "npm:@jsr/std__expect@*",
    "tinybench": "*"
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

### matrix.ts (~60 lines)

Runtime-neutral matrix runner for parameter-sweep scripts.
No external dependencies -- uses `Promise.allSettled` for parallel execution
and a sequential `for` loop for ordered execution.

**Types:**

```ts
/** Result of a single matrix entry execution */
type MatrixResult<TEntry> = {
  readonly entry: TEntry;
  readonly label: string;
  readonly status: 'passed' | 'failed';
  readonly error?: unknown;
};

/** Options for {@link runMatrix} */
type MatrixOptions<TEntry> = {
  /** Entries to sweep over */
  readonly entries: readonly TEntry[];
  /** Human-readable label for each entry (used in console output) */
  readonly label: (entry: TEntry) => string;
  /** Async function to execute per entry -- throw to signal failure */
  readonly run: (entry: TEntry) => Promise<void>;
  /**
   * Execution mode.
   * - `'sequential'` -- one at a time, in order (default)
   * - `number` -- run up to N entries concurrently
   */
  readonly concurrency?: 'sequential' | number;
};
```

**Functions:**

```ts
/**
 * Runs an async function across every matrix entry,
 * collecting labeled pass/fail results.
 *
 * Each entry is logged with a header before execution.
 * Failures are caught and recorded -- execution continues
 * for remaining entries regardless of failures.
 */
async function runMatrix<TEntry>(
  options: MatrixOptions<TEntry>,
): Promise<readonly MatrixResult<TEntry>[]>;

/**
 * Prints a labeled summary table to stdout and sets
 * `process.exitCode` to 1 if any entry failed.
 *
 * @example
 * ```
 * ============================================================
 * [matrix] Results:
 *   ubuntu:latest (root): PASSED
 *   ubuntu:latest (user): FAILED
 *   fedora:latest (root): PASSED
 *   fedora:latest (user): PASSED
 *
 * [matrix] SOME FAILED
 * ```
 */
function reportMatrix<TEntry>(
  results: readonly MatrixResult<TEntry>[],
): void;
```

**Consumer example** (`mise.container-test.ts` after migration):

```ts
import { runMatrix, reportMatrix } from '@monochromatic-dev/test-harness/matrix';

const results = await runMatrix({
  entries: MATRIX,
  label: function formatLabel(entry) {
    return `${entry.image} (${entry.asRoot ? 'root' : 'user'})`;
  },
  run: runEntry,
  concurrency: 'sequential',
});

reportMatrix(results);
```

This replaces 18 lines of loop + summary + exit code management
(lines 160-177 of `mise.container-test.ts`)
and 8 lines of label/status logging inside `runEntry` (lines 129-133, 149, 153-154).

**What stays per-consumer:**

- Matrix entry type definition (`MatrixEntry`)
- Entry array (`MATRIX`)
- The `run` function body (container commands, podman invocation, domain logic)
- The `label` function (what to print for each entry)

The matrix runner does not own container lifecycle, command building,
or monorepo root detection -- those remain in each consumer file.

### bench.ts (~5 lines)

Re-exports from `tinybench` for micro-benchmark files.

```ts
export { Bench } from 'tinybench';
export type { Task, TaskResult } from 'tinybench';
```

Consumers use `Bench` directly instead of hand-rolled `measure()` / `measureAsync()`:

```ts
import { Bench } from '@monochromatic-dev/test-harness/bench';

const bench = new Bench({ warmupIterations: 5, iterations: 50 });

bench.add('glob expansion', async function globBench() {
  await glob('**/*.ts');
});

await bench.run();
console.table(bench.table());
```

`tinybench` provides:
- Configurable warmup and iteration counts
- Statistical analysis (mean, p75, p99, margin of error)
- `bench.table()` for formatted console output
- Works on Node, Bun, and browsers (7KB, zero dependencies)

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
    (`.` for unit adapter, `./matrix` for matrix runner, `./bench` for tinybench)
3.  Add `@std/expect` dependency via `bunx jsr add @std/expect`
4.  Add `tinybench` dependency
5.  Write `src/adapter-bun.ts` and `src/adapter-node.ts`
6.  Write `src/matrix.ts` (runMatrix + reportMatrix)
7.  Write `src/bench.ts` (tinybench re-exports)
8.  Add `mise.toml` matching sibling packages

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

### Step 6: migrate container test orchestrators (2 files)

Replace the manual loop + result collection + summary reporting
in `*.container-test.ts` orchestrators with `runMatrix` / `reportMatrix`:

- `packages/dev-script/file-enforcer/src/package/mise.container-test.ts`

  Remove: sequential `for` loop (lines 161-165), summary block (lines 167-177),
  label/status logging in `runEntry` (lines 131-133, 149, 153-154).

  Replace with `runMatrix({ entries: MATRIX, label, run: runEntry })` + `reportMatrix(results)`.

  Keep: `MATRIX` definition, `buildCommand`, the podman `spawn` call inside `runEntry`
  (but `runEntry` changes from returning `boolean` to throwing on failure).

- `packages/dev-script/file-enforcer/src/package/ensure-package.container-test.ts`

  This file runs **inside** a container (not an orchestrator).
  Its `boolean[]` + summary pattern (lines 95-129) is a candidate for `reportMatrix`,
  but the execution is manually sequenced with different test shapes rather than a uniform sweep.
  Migrate only if the API fits naturally; otherwise leave as-is.

### Step 7: migrate benchmarks to tinybench (1 file)

- `packages/test-fixture/file-enforcer-perf/src/perf.bench.test.ts`

  Replace the hand-rolled `measure()` / `measureAsync()` timing functions
  with `Bench` from `@monochromatic-dev/test-harness/bench`.

  The benchmark orchestrators (`run-e2e.ts`, `run-constrained.ts`, `bench-in-container.ts`)
  are bespoke multi-phase pipelines and do not benefit from this migration.

### Step 8: update mise test tasks

The `test:unit` task in root `mise.toml` currently runs `bun test ...files`.

For runtime-neutral execution, update to detect the preferred runtime
or keep `bun test` as the default (the adapter still works -- Bun resolves the `"bun"` export).

To run under Node: `node --test ...files` (Node 25+ runs `.ts` natively).

### Step 9: verify

1.  Run `mise run buildAndTest` to confirm all unit tests pass.
2.  Optionally run under Node (`node --test`) to verify cross-runtime behavior.
3.  Run the container test orchestrator to confirm matrix runner integration:
    `bun packages/dev-script/file-enforcer/src/package/mise.container-test.ts`
4.  Run the benchmark to confirm tinybench integration:
    `mise run //packages/test-fixture/file-enforcer-perf:perf:micro`

## Dependencies

| Dependency | Source | Purpose | Size |
|---|---|---|---|
| `@std/expect` | JSR (`@jsr/std__expect`) | Jest-compatible matchers for Node path | 4 packages (ESM-native) |
| `tinybench` | npm | Micro-benchmark harness for `./bench` entry point | 7KB, zero dependencies |

The matrix runner (`./matrix`) has zero external dependencies --
it uses `Promise.allSettled` and a sequential `for` loop.

The Bun adapter path has zero external dependencies (re-exports from `bun:test`).

## Files affected

- **New**: `packages/test-fixture/test-harness/` (package.json, src/adapter-bun.ts, src/adapter-node.ts, src/matrix.ts, src/bench.ts, mise.toml)
- **Modified**: 73 `*.unit.test.ts` files (import path change)
- **Modified**: 3 files (test.each to for...of)
- **Modified**: 2 files (test.skipIf to options form)
- **Modified**: 1 container test orchestrator (mise.container-test.ts -- adopt runMatrix/reportMatrix)
- **Modified**: 1 benchmark file (perf.bench.test.ts -- adopt tinybench Bench)
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
- **Matrix runner scope** -- the runner handles uniform parameter sweeps
  (same function, different inputs). The inner container test
  (`ensure-package.container-test.ts`) runs heterogeneous assertions
  that don't fit this shape cleanly. The benchmark orchestrators
  (`run-constrained.ts`, `run-e2e.ts`) are multi-phase pipelines,
  not parameter sweeps. These files stay as-is.
- **tinybench vs hand-rolled benchmarks** -- `tinybench` uses high-resolution
  timing with statistical analysis. The existing `measure()` / `measureAsync()`
  in `perf.bench.test.ts` use manual `performance.now()` loops with configurable
  iteration counts and max-time thresholds. Migration requires mapping the
  existing threshold checks to tinybench's result properties (`mean`, `p75`, etc.).

## Alternatives considered

### Local CI systems (Dagger, act, Earthly)

The container test pattern is fundamentally a CI problem --
define environments, run scripts across them, collect results.
Tools like **Dagger** (TypeScript SDK, BuildKit-native),
**act** (GitHub Actions locally), and **Earthly** (Makefile + Dockerfile)
were evaluated.

**Why not adopted:**

- **Dagger** requires the Dagger Engine daemon and uses BuildKit instead of podman.
  The monorepo already uses podman directly; switching container runtimes
  adds infrastructure weight without reducing complexity.
- **act** is CLI-only (no TypeScript API) and requires YAML workflow definitions.
- **Earthly** is CLI-only with no TypeScript API.

The current `nano-spawn` + `podman` calls are ~10 lines per consumer.
The matrix runner extracts the repeated *orchestration* skeleton (execution loop,
result collection, summary reporting) without touching the container lifecycle layer.

### Promise utilities (p-settle, listr2)

**p-settle** provides `Promise.allSettled` with concurrency control and a mapper function.
**listr2** is a terminal task runner with built-in progress rendering.

**Why not adopted:**

- `Promise.allSettled` is a language built-in; `p-settle` adds a mapper
  and concurrency limiting that a simple `for` loop or `Promise.allSettled` already covers.
- listr2 owns terminal rendering, which conflicts with container tests
  that stream verbose stdout (apt-get, bun install, test output).
  Its default renderer collapses output that is useful for debugging failures.

### vitest `test.for`

Parameterized test cases within a single vitest process.
Does not orchestrate across containers or processes.
Not applicable to the cross-environment execution pattern.
