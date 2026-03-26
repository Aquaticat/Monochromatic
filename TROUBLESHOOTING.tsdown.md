# tsdown Troubleshooting

## DTS generation dominates build time (360+ms vs 36ms benchmarks)

### Problem

The [bundler-benchmark](https://github.com/gugustinette/bundler-benchmark) shows tsdown completing builds in ~36ms,
but every package in this monorepo takes 360+ms.
Even a 201-line CLI plugin (`terminal-title`) takes 133ms.

### Investigation

Measured `module-es` (483 source files, bundles workspace deps) with features toggled:

| Configuration | Reported time |
|---|---|
| Full build (DTS + minify + target) | 367-389ms |
| DTS only (no minify) | 365ms |
| No DTS (minify + target) | 34-41ms |
| No DTS, no minify | 33-36ms |

DTS generation accounts for ~340ms of the ~380ms total.
Minification and `firefox140` target transforms are negligible (~1ms combined).

For `terminal-title` (8 DTS source files): 55ms with DTS, 22ms without -- ~33ms DTS overhead.

The benchmark disables every expensive feature: `dts` defaults to false, `minify: false`, `target: false`,
`skipNodeModulesBundle: true`, and it uses the programmatic API (no CLI startup).

### Root cause: DTS bundling requires a JS-side second pass through rolldown

tsdown uses [`rolldown-plugin-dts`](https://github.com/sxzz/rolldown-plugin-dts) (by the same author, sxzz).
This is distinct from rolldown's builtin `isolatedDeclarationPlugin`.

**Builtin `isolatedDeclarationPlugin`** (Rust, parallel):
- Runs OXC `IsolatedDeclarations` per-file inside the `transform_ast` hook, fully in Rust
- Emits each `.d.ts` as a **separate asset** via `ctx.emit_file()`
- No bundling -- output mirrors the source module graph

**`rolldown-plugin-dts`** (JS plugin, what tsdown uses):
- Generates `.d.ts` per-file via OXC `isolatedDeclarationSync` (a sync NAPI call into native OXC)
- Feeds those `.d.ts` files back into rolldown as a **second bundle pass** via the `load` hook
- Rolldown resolves imports between declarations, tree-shakes unused types,
  and emits a **single bundled declaration file** (e.g. `index.d.mts`)

tsdown is a library bundler. Its purpose is to produce a self-contained package with a single JS entry
and a single `.d.ts` entry. If it emitted 483 separate `.d.ts` files, consumers would need the entire
internal module structure in `node_modules`, defeating the purpose of bundling.

### Why the second pass is slow

Even though OXC isolated declarations is fast per-file (sub-millisecond for small type files),
the DTS bundling pass has inherent overhead:

1. **JS event loop serialization.**
   Rolldown spawns concurrent tokio tasks per module (`tokio::spawn` in `module_loader.rs`),
   but each task calls the JS `load` hook via NAPI `ThreadsafeFunction.call_async()`.
   These callbacks execute one-at-a-time on the single JS event loop thread.
   The `isolatedDeclarationSync` call within each callback blocks that callback from yielding.

2. **Import resolution fanout.**
   For `module-es`: 483 DTS source files produce 1138 cross-file DTS import resolutions.
   Each resolution goes through the JS-side resolver plugin.
   Rolldown discovers imports incrementally -- each layer of the dependency graph
   must resolve before the next layer is discovered.

3. **Bundle linking.**
   After all load hooks complete, rolldown runs its standard linking phase
   on the DTS module graph to produce the final bundled output.

Verified via `DEBUG='rolldown-plugin-dts:*'` output:
the resolved options confirm `oxc: { stripInternal: false, sourcemap: false }` --
OXC is auto-enabled because `tsconfig.json` has `isolatedDeclarations: true`
(detected at [`rolldown-plugin-dts` options.ts line 944](https://github.com/sxzz/rolldown-plugin-dts):
`oxc ??= !!(compilerOptions?.isolatedDeclarations && !vue && !tsgo && !tsMacro)`).
No tsc is involved.

### Measured timeline for module-es (from debug timestamps)

| Phase | Duration |
|---|---|
| Config loading + tsconfig resolution | ~23ms |
| JS bundle (rolldown, Rust-side parallel) | ~48ms |
| DTS: 483 OXC calls + 1138 import resolutions (JS event loop) | ~350ms |
| DTS bundle finalization + dep detection | ~46ms |
| **Total (reported by tsdown)** | **~380ms** |

### What does not help

- **Switching to tsc for DTS** -- would be slower, not faster.
  The OXC path is already active and is the fastest available option.
- **Setting `dts: { oxc: true }` explicitly** -- redundant,
  `rolldown-plugin-dts` auto-detects `isolatedDeclarations: true` from tsconfig.
- **Disabling minification** -- saves ~1ms, irrelevant.

### What helps

- **Set `dts: false` for packages that are not consumed as libraries.**
  CLI tools, Claude Code plugins, and client bundles do not need `.d.ts` files.
  Saves 33ms (small packages) to 340ms (large packages) per build.

- **Reduce the number of source files that need DTS bundling.**
  The cost scales with file count and import graph depth.
  Flatter module structures with fewer re-export layers reduce the resolution fanout.

- **Watch mode.**
  `tsdown --watch` reuses the rolldown instance and only re-processes changed files,
  avoiding the full DTS bundling pass on each save.

### Caution with `DEBUG` logging

Running with `DEBUG='rolldown-plugin-dts:*'` or `DEBUG='tsdown:*'` adds significant overhead.
For `module-es`, debug logging produces 26,481 log lines and inflates reported wall time
from ~480ms to ~700ms+ (~300ms of pure logging overhead).
Always measure with debug disabled.
