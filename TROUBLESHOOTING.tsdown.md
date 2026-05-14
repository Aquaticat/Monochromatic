# tsdown DTS generation dominates build time (340-of-380 ms on module-es) because `rolldown-plugin-dts` re-bundles declarations through a single-threaded JS load hook

## Symptom

The [bundler-benchmark](https://github.com/gugustinette/bundler-benchmark)
shows tsdown completing builds in ~36 ms, but every package in
this monorepo takes 360+ ms. Even a 201-line CLI plugin
(`terminal-title`) takes 133 ms.

Wall-clock measurements feel anomalous compared to the published
benchmark; "tsdown is slow on our packages" is the surface
complaint. The root cause is that the benchmark disables the
features (DTS generation, minify, target lowering) that the
workspace requires.

## Root cause

DTS generation accounts for ~340 ms of the ~380 ms total on
`module-es`. Minification and `firefox140` target transforms are
negligible (~1 ms combined).

tsdown uses
[`rolldown-plugin-dts`](https://github.com/sxzz/rolldown-plugin-dts)
(by the same author as tsdown and rolldown, sxzz). This is
distinct from rolldown's builtin `isolatedDeclarationPlugin`:

**Builtin `isolatedDeclarationPlugin`** (Rust, parallel):

- Runs OXC `IsolatedDeclarations` per-file inside the
  `transform_ast` hook, fully in Rust.
- Emits each `.d.ts` as a **separate asset** via
  `ctx.emit_file()`.
- No bundling; output mirrors the source module graph.

**`rolldown-plugin-dts`** (JS plugin, what tsdown uses):

- Generates `.d.ts` per-file via OXC `isolatedDeclarationSync` (a
  sync NAPI call into native OXC).
- Feeds those `.d.ts` files back into rolldown as a **second
  bundle pass** via the `load` hook.
- Rolldown resolves imports between declarations, tree-shakes
  unused types, and emits a **single bundled declaration file**
  (e.g. `index.d.mts`).

tsdown is a library bundler. Its purpose is to produce a
self-contained package with a single JS entry and a single
`.d.ts` entry. If it emitted 483 separate `.d.ts` files,
consumers would need the entire internal module structure in
`node_modules`, defeating the purpose of bundling.

### Why the second pass is slow

Even though OXC isolated declarations is fast per-file
(sub-millisecond for small type files), the DTS bundling pass
has inherent overhead:

1. **JS event loop serialisation.** Rolldown spawns concurrent
   tokio tasks per module (`tokio::spawn` in
   `module_loader.rs`), but each task calls the JS `load` hook
   via NAPI `ThreadsafeFunction.call_async()`. These callbacks
   execute one-at-a-time on the single JS event loop thread.
   The `isolatedDeclarationSync` call within each callback
   blocks that callback from yielding.
2. **Import resolution fanout.** For `module-es`: 483 DTS source
   files produce 1138 cross-file DTS import resolutions. Each
   resolution goes through the JS-side resolver plugin.
   Rolldown discovers imports incrementally; each layer of the
   dependency graph must resolve before the next layer is
   discovered.
3. **Bundle linking.** After all load hooks complete, rolldown
   runs its standard linking phase on the DTS module graph to
   produce the final bundled output.

Verified via `DEBUG='rolldown-plugin-dts:*'` output: resolved
options confirm `oxc: { stripInternal: false, sourcemap: false
}`. OXC is auto-enabled because `tsconfig.json` has
`isolatedDeclarations: true` (detected at
[`rolldown-plugin-dts` options.ts line 944][rdpd]:
`oxc ??= !!(compilerOptions?.isolatedDeclarations && !vue && !tsgo && !tsMacro)`).
No tsc is involved.

[rdpd]: https://github.com/sxzz/rolldown-plugin-dts

## Verification

Version under test:

- tsdown / rolldown / `rolldown-plugin-dts` as pinned by
  `@monochromatic-dev/config-tsdown` at workspace HEAD.
- `module-es` workspace package (483 DTS source files, 1138
  cross-file DTS import resolutions).
- `terminal-title` workspace package (8 DTS source files, 201
  source lines).

Measured `module-es` with features toggled (times in ms):

- Full build (DTS + minify + target): 367-389
- DTS only (no minify): 365
- No DTS (minify + target): 34-41
- No DTS, no minify: 33-36

For `terminal-title` (8 DTS source files): 55 ms with DTS, 22 ms
without (~33 ms DTS overhead).

The benchmark disables every expensive feature: `dts` defaults
to false, `minify: false`, `target: false`,
`skipNodeModulesBundle: true`, and it uses the programmatic API
(no CLI startup).

### Measured timeline for module-es (debug timestamps)

- Config loading + tsconfig resolution: ~23 ms
- JS bundle (rolldown, Rust-side parallel): ~48 ms
- DTS: 483 OXC calls + 1138 import resolutions (JS event loop):
  ~350 ms
- DTS bundle finalisation + dep detection: ~46 ms
- Total (reported by tsdown): ~380 ms

## Verified workarounds

### Set `dts: false` for packages that are not consumed as libraries

CLI tools, Claude Code plugins, and client bundles do not need
`.d.ts` files. Saves 33 ms (small packages) to 340 ms (large
packages) per build.

Tradeoff: cannot consume the package from another workspace as a
typed library. Acceptable for CLI tools and applications;
unacceptable for `module-*` library packages where types are
the public API.

### Reduce the number of source files that need DTS bundling

Cost scales with file count and import-graph depth. Flatter
module structures with fewer re-export layers reduce the
resolution fanout. Tradeoff: contradicts the workspace's
preference for small files split by region; the import graph is
shaped by the file layout we already want.

### Watch mode

`tsdown --watch` reuses the rolldown instance and only
re-processes changed files, avoiding the full DTS bundling pass
on each save. Tradeoff: only helps interactive workflows; CI
builds still pay the full cost.

## What does not work

- **Switching to tsc for DTS**: would be slower, not faster.
  The OXC path is already the fastest available.
- **Setting `dts: { oxc: true }` explicitly**: redundant;
  `rolldown-plugin-dts` auto-detects `isolatedDeclarations:
  true` from tsconfig.
- **Disabling minification**: saves ~1 ms, irrelevant.
- **Running with `DEBUG='rolldown-plugin-dts:*'` or
  `DEBUG='tsdown:*'` to measure**: debug logging adds
  significant overhead. For `module-es`, debug logging produces
  26,481 log lines and inflates reported wall time from ~480 ms
  to ~700 ms+ (~300 ms of pure logging overhead). Always
  measure with debug disabled.

## Why we do not file this upstream

1. **Is it really upstream's fault?** No. The DTS bundling pass
   exists because library consumers expect a single `.d.ts`
   entry. The cost is inherent to the goal, not to a
   suboptimal implementation.
2. **Can upstream fix it?** Possibly. Moving the load-hook
   fan-out to a Rust-side parallel walker would amortise the
   per-file cost, but `isolatedDeclarationSync` is itself a sync
   NAPI call, so the benefit depends on whether OXC's
   declaration generation can be invoked from rust threads
   safely. Non-trivial.
3. **Are they supporting this use case?** Yes; bundled DTS is
   the documented tsdown feature set.
4. **Will they likely fix it?** Maybe. sxzz maintains the
   plugin actively; performance improvements have landed in
   the past.
5. **Have we prototyped a minimal fix?** No.

Decision: no upstream report. The cost is intrinsic to the
bundled-DTS feature; mitigate at our boundary by setting
`dts: false` for non-library packages.
