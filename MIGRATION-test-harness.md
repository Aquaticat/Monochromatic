# Migration: test harness package (mostly completed)

**Unit adapter: completed.** The monorepo migrated to `@monochromatic-dev/module-test`,
which took a different shape than originally planned (chai + sinon instead of runtime-conditional adapters).
88 test files now import from `@monochromatic-dev/module-test`.
See `packages/module/test/README.md` for the current API.

**Matrix runner: redesigned, not yet implemented.** Redesigned as a separate package
`@monochromatic-dev/module-matrix-virtualized` that abstracts away container/VM lifecycle.
Container test orchestrators still use manual loops pending implementation.

**Benchmark utilities: pending.** Adopt `mitata` with `@mitata/counters` for micro-benchmarks,
replacing the hand-rolled `measure()` / `measureAsync()` in `file-enforcer-perf`.
The benchmark file (`perf.bench.test.ts`) is the only remaining file importing from `bun:test`.

---

Replace ad-hoc test infrastructure across the monorepo with a shared
test package. The original plan had three layers;
layers 1 and 2 are preserved below as historical context,
layer 3 (benchmarking) is the remaining actionable work.

1.  ~~**Unit adapter** -- runtime-neutral re-exports of `bun:test` / `node:test` primitives
    so 83 `*.unit.test.ts` files decouple from a specific runtime.~~
    **Completed** as `@monochromatic-dev/module-test` with chai + sinon.
2.  **Virtualized matrix runner** -- `@monochromatic-dev/module-matrix-virtualized`,
    a separate package that runs files across a cartesian product of
    OS (container/VM) × user context × JS runtime environments.
    Abstracts away podman lifecycle, prerequisite installation, and runtime setup.
    **Redesigned, not yet implemented.**
3.  **Benchmark utilities** -- adopt `mitata` with `@mitata/counters` for micro-benchmarks,
    replacing the hand-rolled `measure()` / `measureAsync()` in `file-enforcer-perf`.
    **Pending.**

## Motivation

- ~~**Runtime neutrality** -- unit tests run identically under `bun test` and `node --test`~~
  **Done.** `module-test` uses chai + sinon, runs on any ESM runtime.
- ~~**No external test runner** -- each file is self-contained; mise orchestrates file discovery~~
  **Done.** `module-test` has no framework-specific globals or test runner.
- ~~**Fully concurrent execution** -- all tests within a file run concurrently
  (bun:test via `concurrentTestGlob`; node:test via `{ concurrency: true }` on describe)~~
  **Done.** `module-test` runs children concurrently via `Promise.allSettled` by default.
- ~~**ESM-native, TypeScript-first** -- no CJS shims, no `createRequire`, no loaders~~
  **Done.**
- **Eliminate container orchestration boilerplate** -- `module-matrix-virtualized` replaces
  the 218-line orchestrator (`mise.container-test.ts`) with a ~10-line `virtualized()` call.
  **Redesigned, not yet implemented.**
- **Standardized benchmarking** -- `mitata` provides DCE detection, GC-aware measurement,
  auto-batching for fast functions, and optional hardware counters via `@mitata/counters`.
  **Pending.**

## Current state

- 88 `*.unit.test.ts` files import from `@monochromatic-dev/module-test`
- 1 benchmark file (`perf.bench.test.ts`) still imports from `bun:test` -- pending mitata migration
- `module-test` provides `describe`, `it`, `expect` (chai), `sinon` sandbox, `expectTypeOf`
- Container test orchestrators still use manual loops (matrix runner not implemented)

## Architecture

### Unit adapter (completed)

Implemented as `@monochromatic-dev/module-test` at `packages/module/test/`.
Uses chai + sinon instead of the originally planned `@std/expect` + runtime-conditional adapters.
See `packages/module/test/README.md` for the full API.

### Benchmarking (pending)

Consumers use `mitata` and `@mitata/counters` directly as devDependencies --
no wrapper or re-export through `module-test`.
Benchmark files import from `mitata` and `@mitata/counters` directly.
Both packages are added to the pnpm catalog.

### adapter-bun.ts / adapter-node.ts (historical)

<details>
<summary>Originally planned runtime-conditional adapters -- superseded by module-test's chai + sinon approach</summary>

The original plan used `@std/expect` with runtime-conditional exports
routing to bun:test or node:test re-exports.
`module-test` replaced this with a self-contained describe/it runner
backed by chai for assertions and sinon for mocking.
See `packages/module/test/README.md` for the implemented API.

</details>

### Virtualized matrix runner (not yet implemented)

Separate package: `packages/module/matrix-virtualized/`
→ `@monochromatic-dev/module-matrix-virtualized`

Runs files across a cartesian product of virtualized environments.
The consumer specifies axes; the package handles all environment lifecycle
(container/VM creation, prerequisite installation, runtime installation,
user creation, workspace mounting, execution, result collection).

**API:**

```ts
import { virtualized } from '@monochromatic-dev/module-matrix-virtualized';

await virtualized({
  // Files to execute inside each environment.
  // Self-executing scripts run with the selected runtime.
  // Defaults to discovering *.unit.virtualized.test.ts in the calling package.
  files: ['./src/package/ensure-package.unit.virtualized.test.ts'],

  // Environments. Protocol prefix selects the backend.
  // container: → podman (MVP)
  // vm: → mvm (future, not in MVP)
  os: ['container:ubuntu', 'container:fedora'],

  // User contexts. Defaults to ['root'].
  user: ['root', 'user'],

  // JS runtimes to install and execute files with. Defaults to ['bun'].
  runtime: ['bun', 'deno'],

  // Exclude specific combinations from the cartesian product.
  // Each entry is a partial match -- all specified fields must match to exclude.
  exclude: [
    { os: 'container:alpine', user: 'user' },  // alpine non-root needs special handling
  ],

  // Run combinations sequentially. Default false (concurrent).
  sequential: false,
});
```

**Cartesian product:** `files × os × user × runtime`, minus `exclude` matches.

For the example above (without excludes): 1 file × 2 OS × 2 users × 2 runtimes = 8 combinations.

**What the package handles per combination** (e.g. `container:fedora` × `user` × `deno`):

1.  Detect package manager from OS name (ubuntu → apt, fedora → dnf, alpine → apk)
2.  `podman run --rm -v ${monorepoRoot}:/workspace:Z fedora:latest sh -c "..."`
3.  Inside the container:
    - Install prerequisites (curl, unzip, sudo — derived from package manager)
    - If `user` context: create non-root user with passwordless sudo
    - Install the selected runtime (bun or deno)
    - Execute each file with the runtime
4.  Throw on non-zero exit (collected by `describe`/`it` from `module-test`)

**File naming convention:**
Inner files are named `*.unit.virtualized.test.ts`.
The standard `test:unit` mise task discovers `*.unit.test.*` and skips these.
Virtualized test orchestrators discover them via the `files` option or default glob.

**Consumer example** (`mise.container-test.ts` after migration):

```ts
import { virtualized } from '@monochromatic-dev/module-matrix-virtualized';

await virtualized({
  os: ['container:ubuntu', 'container:fedora'],
  user: ['root', 'user'],
});
```

This replaces the entire 218-line orchestrator.
`buildCommand`, `runEntry`, monorepo root detection, result collection,
and summary reporting are all handled by the package.

**What stays per-consumer:**

- Choice of axes (which images, which users, which runtimes)
- The `*.unit.virtualized.test.ts` files that run inside the environments

**Dependencies:**

- `@monochromatic-dev/module-test` -- `describe`/`it` for execution and reporting
- `@monochromatic-dev/module-es` -- tagged logger
- `nano-spawn` -- podman execution
- `find-up` -- monorepo root detection

**Future `vm:` protocol:**
Uses mvm instead of podman. Different lifecycle (create VM, push workspace,
exec, pull results, destroy) but same consumer API.
Not in MVP -- the `os` parser recognizes the prefix but throws
`"vm: protocol not yet implemented"` until the mvm backend is added.

### Benchmark consumer example

Consumers import `mitata` and `@mitata/counters` directly:

```ts
import { bench, boxplot, run, summary } from 'mitata';

summary(function globSummary() {
  bench('glob expansion', async function globBench() {
    await glob('**/*.ts');
  });

  bench('glob expansion (deep)', async function deepGlobBench() {
    await glob('pkg-*/lib/deep/nested/very/deep/module.ts');
  });
});

boxplot(function globBoxplot() {
  bench('mirrorGlobPath', function mirrorBench() {
    mirrorGlobPath('packages/*/src/*.ts', 'output/*/lib/*.ts', 'packages/pkg-00/src/index.ts');
  }).range('iterations', 1, 1024);
});

await run();
```

`mitata` provides:
- Auto-detected high-resolution timing (`Bun.nanoseconds()` on Bun, `process.hrtime.bigint()` on Node)
- Dead-code elimination detection (warns when a benchmark is within 1.42x of a noop baseline)
- GC-aware measurement (forces GC before runs, optionally tracks GC time separately)
- Auto-batching for fast functions (switches to batched mode when iteration time < 65μs)
- Generator-based parameterization (`.range()`, `.args()`)
- Built-in terminal visualization (`summary()`, `boxplot()`, `barplot()`, `lineplot()`)
- `do_not_optimize(value)` sink to prevent DCE on benchmark results
- Works on Node, Bun, Deno, browsers, and raw JS engines (12KB, zero dependencies)

`@mitata/counters` provides optional hardware performance counters (IPC, cache stats)
via a Zig-based NAPI module. Requires elevated permissions for counter access.

### test.each / test.skipIf replacements (completed)

`module-test` uses `.map()` for parameterized tests and `skip` option for conditional skipping.
See `packages/module/test/README.md` sections on parameterized tests and skipping.

## Migration steps

### ~~Step 1: create the harness package~~ (completed)

Implemented as `@monochromatic-dev/module-test` at `packages/module/test/`.

### ~~Step 2: install as workspace dependency~~ (completed)

88 test files now import from `@monochromatic-dev/module-test`.

### ~~Step 3: migrate test imports~~ (completed)

### ~~Step 4: migrate test.each~~ (completed)

### ~~Step 5: migrate test.skipIf~~ (completed)

### Step 6: create module-matrix-virtualized and migrate container tests

1.  Create `packages/module/matrix-virtualized/` with the API described above
2.  Rename `ensure-package.container-test.ts` → `ensure-package.unit.virtualized.test.ts`
    and rewrite its `boolean[]` + summary pattern to use `describe`/`it` from `module-test`
3.  Replace `mise.container-test.ts` (218 lines) with a ~10-line call to `virtualized()`:

    ```ts
    import { virtualized } from '@monochromatic-dev/module-matrix-virtualized';

    await virtualized({
      os: ['container:ubuntu', 'container:fedora'],
      user: ['root', 'user'],
    });
    ```

4.  Remove `buildCommand`, `runEntry`, `MatrixEntry`, monorepo root detection,
    and result collection from the orchestrator -- all handled by the package

### Step 7: migrate benchmarks to mitata (1 file)

- `packages/test-fixture/file-enforcer-perf/src/perf.bench.test.ts`

  1.  Add `mitata` and `@mitata/counters` to the pnpm catalog
  2.  Add both as devDependencies of `file-enforcer-perf`
  3.  Replace the hand-rolled `measure()` / `measureAsync()` timing functions
      with `mitata`'s functional API (imported directly from `mitata`).
      Use `do_not_optimize()` to prevent DCE on benchmark results.
      Use `summary()` / `boxplot()` scopes for grouped output.
  4.  Remove the `bun:test` import -- this is the last file using it

  The benchmark orchestrators (`run-e2e.ts`, `run-constrained.ts`, `bench-in-container.ts`)
  are bespoke multi-phase pipelines and do not benefit from this migration.

### Step 8: verify

1.  Run `mise run buildAndTest` to confirm all unit tests still pass.
2.  Run the benchmark to confirm mitata integration:
    `mise run //packages/test-fixture/file-enforcer-perf:perf:micro`

## Dependencies (remaining)

| Dependency | Source | Purpose | Consumer |
|---|---|---|---|
| `mitata` | npm | Micro-benchmark harness (12KB, zero deps) | file-enforcer-perf devDependency |
| `@mitata/counters` | npm | Optional hardware perf counters (Zig NAPI) | file-enforcer-perf devDependency |
| `nano-spawn` | npm | Podman process execution | module-matrix-virtualized dependency |
| `find-up` | npm | Monorepo root detection | module-matrix-virtualized dependency |
| `@monochromatic-dev/module-test` | workspace | describe/it for execution and reporting | module-matrix-virtualized dependency |
| `@monochromatic-dev/module-es` | workspace | Tagged logger | module-matrix-virtualized dependency |

## Remaining files affected

- **New**: `packages/module/matrix-virtualized/` (package.json, src/, mise.toml)
- **Modified**: `pnpm-workspace.yaml` (add `mitata`, `@mitata/counters`, and matrix-virtualized deps to catalog)
- **Renamed**: `ensure-package.container-test.ts` → `ensure-package.unit.virtualized.test.ts`
- **Modified**: `ensure-package.unit.virtualized.test.ts` (rewrite to use `describe`/`it` from module-test)
- **Replaced**: `mise.container-test.ts` (218 lines → ~10-line `virtualized()` call)
- **Modified**: `packages/test-fixture/file-enforcer-perf/package.json` (add mitata devDependencies)
- **Modified**: 1 benchmark file (`perf.bench.test.ts` -- adopt mitata, remove `bun:test` import)

## Risks (remaining)

- **Virtualized runner OS detection** -- mapping `container:ubuntu` to the correct
  package manager (apt) relies on a hardcoded distro → manager lookup.
  New distros require updating the lookup table. Alpine (apk), Arch (pacman),
  and RHEL-family (dnf/yum) should be covered in the initial implementation.
- **Runtime installation inside containers** -- bun and deno have different
  install mechanisms (`curl -fsSL https://bun.sh/install | bash` vs
  `curl -fsSL https://deno.land/install.sh | sh`). Each runtime needs
  its own install script template and PATH setup.
- **Non-root user creation** -- varies by distro (useradd vs adduser).
  The package must handle this per package manager.
- **Benchmark orchestrators** (`run-constrained.ts`, `run-e2e.ts`) are
  multi-phase pipelines, not parameter sweeps. These files stay as-is.
- **mitata vs hand-rolled benchmarks** -- `mitata` auto-detects the highest-resolution
  timer per runtime (`Bun.nanoseconds()` on Bun), handles GC and DCE automatically,
  and auto-batches fast functions. The existing `measure()` / `measureAsync()`
  in `perf.bench.test.ts` use manual `performance.now()` loops with configurable
  iteration counts and max-time thresholds. Migration replaces explicit threshold checks
  with mitata's built-in statistical output (min, max, avg, p25, p50, p75, p99, p999).
  For programmatic regression detection, mitata's `format: 'json'` output mode
  can be parsed downstream.
- **mitata maintenance** -- mitata's maintainer (evanwashere) has been inactive since
  Feb 2025 with 9 open issues and 5 unanswered PRs. The library is functionally
  complete for our use case (micro-benchmarking with DCE/GC awareness).
  If maintenance becomes a blocker, tatami-ng (`@poolifier/tatami-ng` on JSR)
  is an API-compatible fork. `@mitata/counters` (Zig-based NAPI) may require
  building from source if prebuilt binaries are unavailable for the target platform.

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

`module-matrix-virtualized` uses `nano-spawn` + `podman` internally
but abstracts away the entire container lifecycle. Consumers never see podman args.
